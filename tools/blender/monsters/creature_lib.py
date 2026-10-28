"""creature_lib.py — the shared kit for the non-humanoid monster bases (rat, hound, spider, bat).

`tools/blender/README.md` ("Phase 6 → Monsters") is the contract; this file is how monster pass A meets it. A base is
one re-runnable `build_<base>.py` that regenerates everything from nothing:

- **Bodies are implicit surfaces.** A body is a list of metaball elements (balls, ellipsoids, capsules), each bound to
  a bone and carrying a palette slot. Blender polygonizes them, the mesh is decimated to the triangle budget and every
  vertex is projected back onto the surface with a numpy copy of Blender's field function (it matches Blender's mesher
  to 2e-4); the normals are the field's gradient, so the toon bands follow the smooth surface, not the decimation.
  A vertex's skin weights are the bones' shares of the field there (limbs blend into the body the way the surface
  does); a face takes the slot of the element that dominates it, then rules may override (a mouth, a belly).
- **Variants are fields too.** A shape key `var_<name>` is the same vertices projected onto the surface of a changed
  element list (a swollen belly, a longer abdomen), so a variant keeps the topology and the weights.
- **Attachments** (tails, ears, eyes, teeth, claws, legs, wings and the variant parts) are numpy geometry — lofts along
  polylines, spheres, cones — with explicit weights or weights copied from the nearest body vertex.
- **Rigs** follow the hero rig's axis rules (`lib/rig.py`): local Y runs head → tail; local Z is the creature's front for
  bones that hang (legs) and up for bones that lie along the body (spine, neck, head, tail, feet), so +X swings a bone's
  tip toward its Z (a hanging leg forward, a lying spine or tail up) and +Z toward its −X; `_L` / `_R` suffixes. The
  creature faces −Y, the origin is on the floor under it, +X is its left.
- **Clips** are pose tables sampled on every frame (30 fps, linear keys): keyed poses blended with per-segment easing,
  or a periodic function for loops. A leg is `('ik', offset, dirs)` — its foot solved onto its rest mark + offset by an
  analytic two-bone IK in the leg's own plane, the end bones (paws, feet, tarsi) aimed along `dirs` — or `('fk', angles)`.
"""
import json
import math
import os
import sys
import time

import bpy
import numpy as np
from mathutils import Euler, Matrix, Quaternion, Vector
from mathutils.kdtree import KDTree

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(os.path.dirname(HERE), 'lib')
if LIB not in sys.path:
    sys.path.insert(0, LIB)

from common import BUILD, CONTENT, MODELS, RENDERS, REPO, args, log, read_json, save_blend  # noqa: E402
import toon  # noqa: E402

FPS = 30
MON = os.path.join(MODELS, 'monsters')
OUT_ROOT = os.path.join(RENDERS, 'monsters')
HERO_BLEND = os.path.join(BUILD, 'hero_body.blend')

# palette slots (tools/blender/palette.json; README "Monsters → Colour")
MAIN, SECOND, ACCENT, INK, LEATHER, METAL, TRIM, GLOW, WOOD, BONE, GEM = 0, 1, 2, 5, 8, 9, 10, 11, 12, 13, 14
SLOT_NAME = {s['id']: s['name'] for s in toon.PALETTE['slots']}

os.makedirs(MON, exist_ok=True)


# ====================================================================== small maths
def unit(v):
    v = np.asarray(v, dtype=np.float64)
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.maximum(n, 1e-12)


def lerp(a, b, w):
    return tuple(x + (y - x) * w for x, y in zip(a, b))


def smooth(s):
    s = min(1.0, max(0.0, s))
    return s * s * (3 - 2 * s)


EASE = {
    'smooth': smooth,
    'linear': lambda s: s,
    'in': lambda s: s * s,                       # accelerates into the key (a strike)
    'in3': lambda s: s * s * s,
    'out': lambda s: 1 - (1 - s) ** 2,           # decelerates into the key (a recoil settling)
    'out3': lambda s: 1 - (1 - s) ** 3,
    'hold': lambda s: 1.0 if s >= 0.999 else 0.0,
}


def rot_about(v, axis, ang):
    return Matrix.Rotation(ang, 3, Vector(axis)) @ Vector(v)


# ====================================================================== implicit field (metaballs)
THRESH = 0.6


def kvis(s=2.0):
    """The visible radius of a lone element as a fraction of its influence radius (stiffness s, threshold 0.6)."""
    return math.sqrt(1.0 - (THRESH / s) ** (1.0 / 3.0))


class E:
    """One metaball element. R is Blender's `radius` (the influence radius); `bones` maps bone → share of the weight;
    `slot` is the palette slot of the faces it dominates."""

    def __init__(self, kind, co, R, size=(1.0, 1.0, 1.0), rot=None, s=2.0, neg=False, bone=None, slot=MAIN, tag=''):
        self.kind = kind
        self.co = Vector(co)
        self.R = float(R)
        self.size = tuple(float(x) for x in size)
        self.rot = Quaternion(rot) if rot is not None else Quaternion()
        self.s = float(s)
        self.neg = neg
        self.bones = dict(bone) if isinstance(bone, dict) else ({bone: 1.0} if bone else {})
        self.slot = slot
        self.tag = tag

    def copy(self):
        e = E(self.kind, self.co.copy(), self.R, self.size, self.rot.copy(), self.s, self.neg, dict(self.bones), self.slot, self.tag)
        return e

    def mirrored(self):
        """The same element mirrored across x = 0 (bone names _L ↔ _R)."""
        e = self.copy()
        e.co = Vector((-self.co.x, self.co.y, self.co.z))
        # a reflection of a rotation: conjugate by the X mirror → (w, x, -y, -z)
        q = self.rot
        e.rot = Quaternion((q.w, q.x, -q.y, -q.z))
        e.bones = {swap_side(b): w for b, w in self.bones.items()}
        e.tag = swap_side(self.tag)
        return e

    def scaled_about(self, c, k):
        """Scaled by k (a scalar or (kx, ky, kz) in world axes, only for unrotated ellipsoids) about point c."""
        e = self.copy()
        c = Vector(c)
        if isinstance(k, (int, float)):
            e.co = c + (self.co - c) * k
            if self.kind == 'ELLIPSOID':
                e.size = tuple(x * k for x in self.size)
            elif self.kind == 'CAPSULE':
                e.size = (self.size[0] * k,) + self.size[1:]
                e.R = self.R * k
            else:
                e.R = self.R * k
        else:
            kx, ky, kz = k
            d = self.co - c
            e.co = c + Vector((d.x * kx, d.y * ky, d.z * kz))
            if self.kind == 'BALL':
                e.kind = 'ELLIPSOID'
                kk = kvis(self.s)
                r = self.R * kk
                e.R = 1.0
                e.size = (r * kx / kk, r * ky / kk, r * kz / kk)
            elif self.kind == 'ELLIPSOID':
                e.size = (self.size[0] * kx, self.size[1] * ky, self.size[2] * kz)
            else:
                e.R = self.R * (kx + ky + kz) / 3
                e.size = (self.size[0] * (kx + ky + kz) / 3,) + self.size[1:]
        return e


def swap_side(name):
    if name.endswith('_L'):
        return name[:-2] + '_R'
    if name.endswith('_R'):
        return name[:-2] + '_L'
    return name


def ball(co, r, bone=None, slot=MAIN, s=2.0, tag=''):
    """A ball whose visible radius (alone) is r."""
    return E('BALL', co, r / kvis(s), s=s, bone=bone, slot=slot, tag=tag)


def ellipsoid(co, radii, bone=None, slot=MAIN, s=2.0, rot=None, tag=''):
    """An ellipsoid whose visible semi-axes (alone, in its own frame) are radii."""
    k = kvis(s)
    return E('ELLIPSOID', co, 1.0, size=tuple(r / k for r in radii), rot=rot, s=s, bone=bone, slot=slot, tag=tag)


def capsule(a, b, r, bone=None, slot=MAIN, s=2.0, tag=''):
    """A capsule from a to b whose visible radius (alone) is r."""
    a = Vector(a)
    b = Vector(b)
    d = b - a
    rot = Vector((1, 0, 0)).rotation_difference(d.normalized()) if d.length > 1e-9 else Quaternion()
    return E('CAPSULE', (a + b) / 2, r / kvis(s), size=(d.length / 2, 1.0, 1.0), rot=rot, s=s, bone=bone, slot=slot, tag=tag)


def carve(co, R, s=2.0, tag=''):
    """A negative ball (influence radius R) that hollows the surface."""
    return E('BALL', co, R, s=s, neg=True, tag=tag)


def with_mirror(elems):
    """Elements with an x > 0 centre get a mirrored twin (bones _L → _R); centred ones stay single."""
    out = []
    for e in elems:
        out.append(e)
        if e.co.x > 1e-6:
            out.append(e.mirrored())
    return out


def _local(P, e):
    M = np.array(e.rot.to_matrix(), dtype=np.float64)
    d = (P - np.array(e.co, dtype=np.float64)) @ M
    if e.kind == 'ELLIPSOID':
        d = d / np.array(e.size)
    elif e.kind == 'CAPSULE':
        sx = e.size[0]
        d[:, 0] = d[:, 0] - np.clip(d[:, 0], -sx, sx)
    return d


def contributions(P, elems):
    """(n points, m elements) signed field contributions — Blender's densfunc."""
    P = np.asarray(P, dtype=np.float64).reshape(-1, 3)
    out = np.zeros((len(P), len(elems)))
    for j, e in enumerate(elems):
        d = _local(P, e)
        g = 1.0 - (d * d).sum(1) / (e.R * e.R)
        f = np.where(g > 0, e.s * np.maximum(g, 0) ** 3, 0.0)
        out[:, j] = -f if e.neg else f
    return out


def field(P, elems):
    return contributions(P, elems).sum(1)


def gradient(P, elems, h=2e-4):
    P = np.asarray(P, dtype=np.float64).reshape(-1, 3)
    G = np.zeros_like(P)
    for i in range(3):
        dp = np.zeros(3)
        dp[i] = h
        G[:, i] = (field(P + dp, elems) - field(P - dp, elems)) / (2 * h)
    return G


def project(P, elems, iters=10, max_step=0.03):
    """Newton steps along the gradient onto the iso-surface field = THRESH."""
    P = np.array(P, dtype=np.float64).reshape(-1, 3)
    for _ in range(iters):
        f = field(P, elems) - THRESH
        G = gradient(P, elems)
        g2 = (G * G).sum(1)
        step = (np.where(g2 > 1e-10, f / np.maximum(g2, 1e-10), 0.0))[:, None] * G
        n = np.linalg.norm(step, axis=1)
        step *= np.minimum(1.0, max_step / np.maximum(n, 1e-12))[:, None]
        P = P - step
        if np.abs(f).max() < 1e-5:
            break
    return P


def field_normals(P, elems):
    return unit(-gradient(P, elems))


def surface_point(elems, origin, direction, reach=1.0, steps=200):
    """The first point where a ray from inside the body (origin) leaves the surface."""
    o = np.array(origin, dtype=np.float64)
    d = unit(np.array(direction, dtype=np.float64))
    ts = np.linspace(0.0, reach, steps)
    f = field(o[None, :] + ts[:, None] * d[None, :], elems)
    inside = f >= THRESH
    if not inside[0]:
        return Vector(o)
    k = int(np.argmin(inside)) if not inside.all() else steps - 1
    lo, hi = ts[max(0, k - 1)], ts[k]
    for _ in range(40):
        mid = (lo + hi) / 2
        if field((o + mid * d)[None, :], elems)[0] >= THRESH:
            lo = mid
        else:
            hi = mid
    return Vector(o + lo * d)


def polygonize(elems, res, name='gv_mb'):
    mb = bpy.data.metaballs.new(name)
    mb.resolution = res
    mb.render_resolution = res
    mb.threshold = THRESH
    mb.update_method = 'UPDATE_ALWAYS'
    for e in elems:
        el = mb.elements.new(type=e.kind)
        el.co = e.co
        el.radius = e.R
        el.stiffness = e.s
        el.use_negative = e.neg
        el.rotation = e.rot
        if e.kind in ('ELLIPSOID', 'CAPSULE'):
            el.size_x, el.size_y, el.size_z = e.size
    ob = bpy.data.objects.new(name, mb)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    bpy.data.metaballs.remove(mb)
    return me


def decimate(me, tris, sym=True):
    ob = bpy.data.objects.new('gv_dec', me)
    bpy.context.scene.collection.objects.link(ob)
    n = sum(len(p.vertices) - 2 for p in me.polygons)
    m = ob.modifiers.new('Dec', 'DECIMATE')
    m.decimate_type = 'COLLAPSE'
    m.ratio = min(1.0, tris / max(1, n))
    m.use_symmetry = sym
    m.symmetry_axis = 'X'
    m.use_collapse_triangulate = True
    bpy.context.view_layer.update()
    out = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    return out


def mesh_arrays(me):
    V = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', V)
    F = [tuple(p.vertices) for p in me.polygons]
    return V.reshape(-1, 3), F


def voxel_remesh(me, size):
    ob = bpy.data.objects.new('gv_vox', me)
    bpy.context.scene.collection.objects.link(ob)
    m = ob.modifiers.new('Remesh', 'REMESH')
    m.mode = 'VOXEL'
    m.voxel_size = size
    bpy.context.view_layer.update()
    out = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    return out


def implicit_mesh(elems, res, tris, sym=True, name='gv_mb', uniform=True):
    """Elements → (V, F, N): polygonized; remeshed to a uniform voxel grid sized for ~tris triangles (round 2: a
    straight decimation leaves long slivers whose outline hull shows through as dark cracks); decimated to the budget;
    projected back onto the surface; normals from the field's gradient."""
    t0 = time.time()
    dense = polygonize(elems, res, name)
    nd = len(dense.polygons)
    if uniform:
        area = sum(p.area for p in dense.polygons)
        vox = voxel_remesh(dense.copy(), math.sqrt(2 * area / tris) * 0.92)
        low = decimate(vox, tris, sym)
        bpy.data.meshes.remove(vox)
    else:
        low = decimate(dense, tris, sym)
    V, F = mesh_arrays(low)
    bpy.data.meshes.remove(dense)
    bpy.data.meshes.remove(low)
    V = project(V, elems)
    N = field_normals(V, elems)
    # winding: the face normals must agree with the field normals (outward)
    FN = face_normals(V, F)
    agree = np.array([FN[i].dot(N[list(f)].mean(0)) for i, f in enumerate(F)])
    if (agree < 0).sum() > len(F) / 2:
        F = [tuple(reversed(f)) for f in F]
    log('implicit %s: %d dense faces → %d tris (%.2fs)' % (name, nd, sum(len(f) - 2 for f in F), time.time() - t0))
    return V, F, N


def dominant(P, elems):
    """Index of the positive element with the largest contribution at each point."""
    K = contributions(P, elems)
    for j, e in enumerate(elems):
        if e.neg:
            K[:, j] = -1.0
    return K.argmax(1)


def field_weights(P, elems, power=2.0, keep=4, floor=0.03):
    K = np.clip(contributions(P, elems), 0.0, None) ** power
    bones = sorted({b for e in elems for b in e.bones})
    W = np.zeros((len(K), len(bones)))
    for j, e in enumerate(elems):
        for b, share in e.bones.items():
            W[:, bones.index(b)] += K[:, j] * share
    return finalize_weights(W, bones, keep, floor)


def finalize_weights(W, bones, keep=4, floor=0.03):
    out = []
    for row in W:
        s = row.sum()
        if s <= 0:
            out.append({})
            continue
        row = row / s
        order = np.argsort(-row)[:keep]
        d = {bones[i]: float(row[i]) for i in order if row[i] >= floor}
        if not d:
            d = {bones[order[0]]: 1.0}
        t = sum(d.values())
        out.append({b: w / t for b, w in d.items()})
    return out


# ====================================================================== plain geometry
def face_normals(V, F):
    V = np.asarray(V)
    out = np.zeros((len(F), 3))
    for i, f in enumerate(F):
        p = V[list(f)]
        out[i] = np.cross(p, np.roll(p, -1, axis=0)).sum(0)
    return unit(out)


def vertex_normals(V, F):
    V = np.asarray(V, dtype=np.float64)
    N = np.zeros_like(V)
    for f in F:
        f = list(f)
        p = V[f]
        n = np.cross(p, np.roll(p, -1, axis=0)).sum(0)
        N[f] += n
    return unit(N)


def uv_sphere(c, radii, rings=6, segs=8, rot=None):
    """An ellipsoid (poles along its local Z); returns V, F, N."""
    rx, ry, rz = (radii, radii, radii) if isinstance(radii, (int, float)) else radii
    R = np.array((rot.to_matrix() if rot is not None else Matrix.Identity(3)), dtype=np.float64)
    U = [(0.0, 0.0, 1.0)]
    for i in range(1, rings):
        th = math.pi * i / rings
        for j in range(segs):
            ph = 2 * math.pi * j / segs
            U.append((math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), math.cos(th)))
    U.append((0.0, 0.0, -1.0))
    U = np.array(U)
    F = []
    for j in range(segs):
        F.append((0, 1 + j, 1 + (j + 1) % segs))
    for i in range(rings - 2):
        a0 = 1 + i * segs
        b0 = 1 + (i + 1) * segs
        for j in range(segs):
            j2 = (j + 1) % segs
            F.append((a0 + j, b0 + j, b0 + j2, a0 + j2))
    last = len(U) - 1
    a0 = 1 + (rings - 2) * segs
    for j in range(segs):
        F.append((last, a0 + (j + 1) % segs, a0 + j))
    sc = np.array((rx, ry, rz))
    Vl = U * sc
    Nl = unit(U / sc)
    V = Vl @ R.T + np.array(c)
    N = Nl @ R.T
    return V, F, N


def frames_along(points, up=None):
    """Tangents and rotation-minimising normals along a polyline."""
    P = np.asarray(points, dtype=np.float64)
    n = len(P)
    T = np.zeros_like(P)
    for i in range(n):
        a = P[max(0, i - 1)]
        b = P[min(n - 1, i + 1)]
        T[i] = b - a
    T = unit(T)
    up = np.array(up if up is not None else (0.0, 0.0, 1.0))
    N0 = up - T[0] * up.dot(T[0])
    if np.linalg.norm(N0) < 1e-6:
        alt = np.array((1.0, 0.0, 0.0)) if abs(T[0][0]) < 0.9 else np.array((0.0, 1.0, 0.0))
        N0 = alt - T[0] * alt.dot(T[0])
    Ns = [unit(N0)]
    for i in range(1, n):
        m = Ns[-1] - T[i] * Ns[-1].dot(T[i])
        Ns.append(unit(m) if np.linalg.norm(m) > 1e-9 else Ns[-1])
    Ns = np.array(Ns)
    B = np.cross(T, Ns)
    return T, Ns, B


def tube(points, radii, sides=8, cap0='flat', cap1='point', up=None, flat=None, twist=None, phase=0.0):
    """
    A loft along a polyline. radii: one per point (or a scalar). cap0/cap1: 'flat' (a fan), 'point' (the ring at that
    end collapses into one apex at the point), None (open). flat: per-point (sx, sy) scales of the section along the
    frame's normal (first, ~`up`) and binormal. twist: per-point extra rotation (radians). Returns V, F, N, ring_of_vertex.
    """
    P = np.asarray(points, dtype=np.float64)
    n = len(P)
    rr = np.full(n, float(radii)) if isinstance(radii, (int, float)) else np.asarray(radii, dtype=np.float64)
    T, Nn, B = frames_along(P, up)
    V = []
    ring_of = []
    rings = []
    for i in range(n):
        if (i == 0 and cap0 == 'point') or (i == n - 1 and cap1 == 'point'):
            rings.append([len(V)])
            V.append(P[i])
            ring_of.append(i)
            continue
        sx, sy = (flat[i] if flat is not None else (1.0, 1.0))
        tw = twist[i] if twist is not None else 0.0
        idx = []
        for j in range(sides):
            a = 2 * math.pi * j / sides + phase + tw
            p = P[i] + rr[i] * (math.cos(a) * sx * Nn[i] + math.sin(a) * sy * B[i])
            idx.append(len(V))
            V.append(p)
            ring_of.append(i)
        rings.append(idx)
    F = []
    for i in range(n - 1):
        a, b = rings[i], rings[i + 1]
        if len(a) == 1 and len(b) == 1:
            continue
        for j in range(sides):
            j2 = (j + 1) % sides
            if len(a) == 1:
                F.append((a[0], b[j2], b[j]))
            elif len(b) == 1:
                F.append((a[j], a[j2], b[0]))
            else:
                F.append((a[j], a[j2], b[j2], b[j]))
    if cap0 == 'flat' and len(rings[0]) > 1:
        c = len(V)
        V.append(P[0])
        ring_of.append(0)
        r = rings[0]
        for j in range(sides):
            F.append((c, r[(j + 1) % sides], r[j]))
    if cap1 == 'flat' and len(rings[-1]) > 1:
        c = len(V)
        V.append(P[-1])
        ring_of.append(n - 1)
        r = rings[-1]
        for j in range(sides):
            F.append((c, r[j], r[(j + 1) % sides]))
    V = np.array(V)
    return V, F, vertex_normals(V, F), np.array(ring_of)


def ring_tube(points, radius, sides=6, flat=(1.0, 1.0), twist=0.0, up=None):
    """A closed loop of tube (a collar, a rope, a band) through `points`; flat scales the section along the loop's
    in-plane normal (sx) and its axis (sy). Returns V, F, N."""
    P = np.asarray(points, dtype=np.float64)
    n = len(P)
    T = unit(np.roll(P, -1, axis=0) - np.roll(P, 1, axis=0))
    c = P.mean(0)
    ax = np.cross(P[1] - P[0], P[2] - P[0]) if up is None else np.array(up, dtype=np.float64)
    ax = unit(ax)
    V = []
    for i in range(n):
        out = unit(P[i] - c)
        out = unit(out - T[i] * out.dot(T[i]))
        b = np.cross(T[i], out)
        for j in range(sides):
            a = 2 * math.pi * j / sides + twist * i
            V.append(P[i] + radius * (math.cos(a) * flat[0] * out + math.sin(a) * flat[1] * b))
    F = []
    for i in range(n):
        i2 = (i + 1) % n
        for j in range(sides):
            j2 = (j + 1) % sides
            F.append((i * sides + j, i * sides + j2, i2 * sides + j2, i2 * sides + j))
    V = np.array(V)
    N = vertex_normals(V, F)
    # the loop runs either way round: make the normals point away from the tube's own core
    core = np.repeat(P, sides, axis=0)
    if ((V - core) * N).sum() < 0:
        F = [tuple(reversed(f)) for f in F]
        N = -N
    return V, F, N


def torus(center, axis, R, r, segs=8, sides=4, up=None):
    """A ring (a chain link): major radius R around `axis` through `center`, tube radius r."""
    ax = Vector(axis).normalized()
    u = Vector(up) if up is not None else (Vector((0, 0, 1)) if abs(ax.z) < 0.9 else Vector((1, 0, 0)))
    u = (u - ax * u.dot(ax)).normalized()
    v = ax.cross(u)
    pts = [Vector(center) + (u * math.cos(2 * math.pi * i / segs) + v * math.sin(2 * math.pi * i / segs)) * R for i in range(segs)]
    return ring_tube(pts, r, sides=sides)


def cone(base, tip, r, sides=5, up=None):
    V, F, N, _ = tube([base, tip], [r, 0.0], sides=sides, cap0='flat', cap1='point', up=up)
    return V, F, N


def curve_points(ctrl, n):
    """n points along a Catmull-Rom curve through the control points."""
    C = [np.array(c, dtype=np.float64) for c in ctrl]
    pts = []
    segs = len(C) - 1
    for k in range(n):
        u = k / (n - 1) * segs
        i = min(int(u), segs - 1)
        t = u - i
        p0 = C[max(0, i - 1)]
        p1 = C[i]
        p2 = C[i + 1]
        p3 = C[min(segs, i + 2)]
        pts.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    return np.array(pts)


def transform(V, N=None, rot=None, loc=(0, 0, 0), scale=1.0):
    R = np.array(rot.to_matrix() if rot is not None else Matrix.Identity(3), dtype=np.float64)
    V2 = (np.asarray(V) * scale) @ R.T + np.array(loc)
    if N is None:
        return V2
    return V2, np.asarray(N) @ R.T


# ====================================================================== assembling a mesh object
class Geo:
    """Vertices, faces with palette slots, per-vertex normals, weights and shape-key deltas, piece by piece."""

    def __init__(self):
        self.V = []
        self.N = []
        self.F = []
        self.S = []
        self.W = []
        self.keys = {}
        self.pieces = []
        self.n = 0

    def add(self, V, F, slots, N=None, W=None, name='', keys=None):
        V = np.asarray(V, dtype=np.float64)
        n = len(V)
        if N is None:
            N = vertex_normals(V, F)
        if isinstance(slots, int):
            slots = [slots] * len(F)
        if W is None:
            W = [{}] * n
        elif isinstance(W, dict):
            W = [dict(W)] * n
        elif callable(W):
            W = W(V)
        assert len(W) == n and len(slots) == len(F)
        off = self.n
        self.V.append(V)
        self.N.append(np.asarray(N, dtype=np.float64))
        self.F += [tuple(i + off for i in f) for f in F]
        self.S += list(slots)
        self.W += list(W)
        for k, d in (keys or {}).items():
            self.keys.setdefault(k, {})[off] = np.asarray(d, dtype=np.float64)
        self.pieces.append((name, off, n))
        self.n += n
        return off

    def arrays(self):
        V = np.concatenate(self.V) if self.V else np.zeros((0, 3))
        N = np.concatenate(self.N) if self.N else np.zeros((0, 3))
        return V, N

    def key_deltas(self, name):
        D = np.zeros((self.n, 3))
        for off, d in self.keys.get(name, {}).items():
            D[off:off + len(d)] = d
        return D

    def piece(self, name):
        for nm, off, n in self.pieces:
            if nm == name:
                return off, n
        raise KeyError(name)

    def tris(self):
        return sum(len(f) - 2 for f in self.F)


def make_object(geo, name, rig_ob=None, collection='Monster', key_names=None):
    """A mesh object from a Geo: faces of different slots get their own vertices (crisp colours, smooth custom
    normals), `gv` codes, vertex groups, shape keys (`var_*`), an Armature modifier and the rig as parent."""
    V, N = geo.arrays()
    remap = {}
    old = []
    slot_of = []
    faces = []
    seen = set()
    for f, s in zip(geo.F, geo.S):
        key = tuple(sorted(f))
        if key in seen or len(set(f)) < len(f):
            owner = [nm for nm, off, n in geo.pieces if off <= f[0] < off + n]
            log('make_object %s: dropped a duplicate or degenerate face in %s' % (name, owner[0] if owner else '?'))
            continue
        seen.add(key)
        nf = []
        for v in f:
            k = (v, s)
            if k not in remap:
                remap[k] = len(old)
                old.append(v)
                slot_of.append(s)
            nf.append(remap[k])
        faces.append(nf)
    old = np.array(old, dtype=np.int64)
    verts = V[old]
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in verts], [], faces)
    me.update()
    if me.validate(verbose=True):
        log('make_object %s: validate() repaired the mesh (see above)' % name)
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    nrm = N[old]
    me.normals_split_custom_set([tuple(nrm[l.vertex_index]) for l in me.loops])
    toon.set_vertex_codes(me, slot_of, [0] * len(verts))
    ob = bpy.data.objects.new(name, me)
    col = bpy.data.collections.get(collection) or bpy.data.collections.new(collection)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    col.objects.link(ob)
    groups = {}
    for i, oi in enumerate(old):
        for b, w in geo.W[oi].items():
            if b not in groups:
                groups[b] = ob.vertex_groups.new(name=b)
            groups[b].add([i], w, 'REPLACE')
    names = key_names if key_names is not None else sorted(geo.keys)
    if names:
        ob.shape_key_add(name='Basis', from_mix=False)
        for k in names:
            D = geo.key_deltas(k)[old]
            kb = ob.shape_key_add(name=k, from_mix=False)
            kb.data.foreach_set('co', (verts + D).ravel())
            kb.value = 0.0
    if rig_ob is not None:
        ob.parent = rig_ob
        m = ob.modifiers.new('Armature', 'ARMATURE')
        m.object = rig_ob
    ob['tris'] = geo.tris()
    return ob


def deltas_from(points, src_points, src_deltas, k=3):
    """Shape-key deltas for new points (a part on the body): the inverse-distance blend of the nearest body deltas."""
    kd = KDTree(len(src_points))
    for i, p in enumerate(src_points):
        kd.insert(Vector(p), i)
    kd.balance()
    out = np.zeros((len(points), 3))
    for j, p in enumerate(points):
        acc = np.zeros(3)
        tot = 0.0
        for co, i, d in kd.find_n(Vector(p), k):
            w = 1.0 / max(d, 1e-4)
            acc += w * src_deltas[i]
            tot += w
        out[j] = acc / max(tot, 1e-9)
    return out


def chain_weights(rig, V, chain, root_bone, blend=0.4, rooted=None):
    """Weights for points along a bone chain (a tail): the nearest bone, blended half-and-half into its neighbour at
    each joint and fading to the bone alone `blend` of the way along; `rooted(p)` → True gives root_bone outright."""
    out = []
    for p in V:
        p = Vector(p)
        if rooted is not None and rooted(p):
            out.append({root_bone: 1.0})
            continue
        best = None
        for i, b in enumerate(chain):
            h, t = rig.head[b], rig.tail[b]
            d = t - h
            u = max(0.0, min(1.0, (p - h).dot(d) / d.length_squared))
            dist = (h + d * u - p).length
            if best is None or dist < best[0] - 1e-9:
                best = (dist, i, u)
        _, i, u = best
        w = {chain[i]: 1.0}
        if u < blend:
            k = 0.5 * (1 - u / blend)
            prev = chain[i - 1] if i > 0 else root_bone
            w = {chain[i]: 1 - k, prev: k}
        elif u > 1 - blend and i < len(chain) - 1:
            k = 0.5 * (1 - (1 - u) / blend)
            w = {chain[i]: 1 - k, chain[i + 1]: k}
        out.append(w)
    return out


def clump(base, normal, back, length, width, sides=4, bend=0.8, flat=0.32, sink=0.006, lift=0.55):
    """A fur clump / spike: a flattened, curved leaf from just under the skin at `base`, lifted along `normal` and
    swept along `back`. Returns V, F, N and its root point (where var_bald-style keys sink it)."""
    n = Vector(normal).normalized()
    bk = Vector(back).normalized()
    bk = (bk - n * bk.dot(n))
    bk = bk.normalized() if bk.length > 1e-6 else Vector((0, 1, 0))
    b0 = Vector(base) - n * sink
    p1 = b0 + n * (0.62 * lift * length) + bk * (0.35 * length * bend)
    p2 = b0 + n * (lift * length) + bk * (1.0 * length * bend)
    V, F, N, ring = tube([b0, p1, p2], [width, width * 0.7, 0.0], sides=sides, cap0='flat', cap1='point',
                         up=tuple(n), flat=[(flat, 1.0), (flat, 1.0), (1.0, 1.0)])
    return V, F, N, np.array(b0)


def surface_band(elems, center, axis, radius_guess, n=12, offset=0.006, up=(0, 0, 1)):
    """Points around a limb or neck: rays from the axis (through center) outward in the plane ⟂ axis hit the
    surface; returned pushed out by `offset`, with the in-plane frame (for collars and bands)."""
    ax = Vector(axis).normalized()
    u = Vector(up)
    u = (u - ax * u.dot(ax))
    if u.length < 1e-6:
        u = Vector((1, 0, 0)) - ax * ax.x
    u.normalize()
    v = ax.cross(u)
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        d = u * math.cos(a) + v * math.sin(a)
        p = surface_point(elems, tuple(center), tuple(d), reach=radius_guess * 3)
        pts.append(p + d * offset)
    return pts, u, v


def weights_from(points, src_points, src_weights, k=3):
    """Weights for new points: the inverse-distance blend of the k nearest source vertices' weights."""
    kd = KDTree(len(src_points))
    for i, p in enumerate(src_points):
        kd.insert(Vector(p), i)
    kd.balance()
    out = []
    for p in points:
        acc = {}
        tot = 0.0
        for co, i, d in kd.find_n(Vector(p), k):
            w = 1.0 / max(d, 1e-4)
            tot += w
            for b, x in src_weights[i].items():
                acc[b] = acc.get(b, 0.0) + x * w
        top = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
        s = sum(x for _, x in top)
        out.append({b: x / s for b, x in top} if s > 0 else {})
    return out


# ====================================================================== rigs
class CRig:
    """An armature built from a bone table, its rest frames, forward kinematics, the leg IK and the keyer."""

    def __init__(self, name, bones, legs=(), loc_bones=('Root',), collection='Monster'):
        """bones: [(name, parent, head, tail, z_hint)]; legs: [Leg]."""
        arm = bpy.data.armatures.new(name)
        ob = bpy.data.objects.new(name, arm)
        col = bpy.data.collections.get(collection) or bpy.data.collections.new(collection)
        if col.name not in bpy.context.scene.collection.children:
            bpy.context.scene.collection.children.link(col)
        col.objects.link(ob)
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.mode_set(mode='EDIT')
        ebs = {}
        for bname, parent, head, tail, z in bones:
            eb = arm.edit_bones.new(bname)
            eb.head = Vector(head)
            eb.tail = Vector(tail)
            if parent:
                eb.parent = ebs[parent]
                eb.use_connect = False
            eb.align_roll(Vector(z))
            eb.use_deform = True
            ebs[bname] = eb
        bpy.ops.object.mode_set(mode='POSE')
        for pb in ob.pose.bones:
            pb.rotation_mode = 'XYZ'
        bpy.ops.object.mode_set(mode='OBJECT')
        arm.display_type = 'STICK'
        self.ob = ob
        self.order = [b[0] for b in bones]
        self.parent = {b[0]: b[1] for b in bones}
        self.rest = {b.name: b.matrix_local.copy() for b in arm.bones}
        self.length = {b.name: b.length for b in arm.bones}
        self.rel = {}
        for n in self.order:
            p = self.parent[n]
            self.rel[n] = (self.rest[p].inverted() @ self.rest[n]) if p else self.rest[n].copy()
        self.head = {n: self.rest[n].translation.copy() for n in self.order}
        self.tail = {n: (self.rest[n] @ Vector((0, self.length[n], 0))) for n in self.order}
        self.rest_dir = {n: (self.tail[n] - self.head[n]).normalized() for n in self.order}
        self.legs = list(legs)
        self.leg = {l.name: l for l in self.legs}
        self.neutral = {}
        for l in self.legs:
            last = l.ends[-1] if l.ends else l.ik[1]
            self.neutral[l.name] = self.tail[last].copy()
        self.loc_bones = list(loc_bones)
        self.residual = {}

    # ------------------------------------------------------------ forward kinematics
    @staticmethod
    def euler(r):
        return Euler([math.radians(a) for a in r], 'XYZ').to_matrix().to_4x4()

    def fk(self, pose, upto=None):
        """Posed armature-space matrices of every bone; also the local translations of the `.loc` bones."""
        M = {}
        locs = {}
        for n in self.order:
            p = self.parent[n]
            base = (M[p] @ self.rel[n]) if p else self.rel[n]
            T = Matrix.Identity(4)
            if n + '.loc' in pose:
                lt = base.to_3x3().inverted() @ Vector(pose[n + '.loc'])
                locs[n] = lt
                T = Matrix.Translation(lt)
            M[n] = base @ T @ self.euler(pose.get(n, (0, 0, 0)))
        return M, locs

    def point(self, M, bone, where='tail'):
        return M[bone] @ Vector((0, self.length[bone] if where == 'tail' else 0.0, 0))

    # ------------------------------------------------------------ IK
    def solve_leg(self, leg, pose, M, target, dirs=None, record=True):
        """Sets the leg's bone angles in `pose` so the tail of its last bone reaches `target` (armature space)."""
        A, B = leg.ik
        if leg.yaw:
            Y = leg.yaw
            F = M[self.parent[Y]] @ self.rel[Y]
            yx, yy, _ = pose.get(Y, (0, 0, 0))
            F = F @ self.euler((yx, yy, 0))
            tl = F.inverted() @ Vector(target)
            psi = math.degrees(math.atan2(-tl.x, tl.y)) + leg.yaw_bias
            pose[Y] = (yx, yy, psi)
            M[Y] = M[self.parent[Y]] @ self.rel[Y] @ self.euler(pose[Y])
        ax, ay, az = pose.get(A, (0, 0, 0))
        Mp = M[self.parent[A]]
        if leg.abduct:
            # swing the leg's plane about the upper bone's own Z (its forward axis when it hangs) so the plane holds
            # the target — a planar leg cannot reach a foot the body has shifted or rolled away from (round 3)
            Fb = Mp @ self.rel[A] @ self.euler((0, ay, 0))
            tl = Fb.inverted() @ Vector(target)
            psi = math.degrees(math.atan2(-tl.x, tl.y)) if abs(tl.y) > 1e-6 else 0.0
            if psi > 90:
                psi -= 180
            elif psi < -90:
                psi += 180
            az = az + max(-leg.abduct, min(leg.abduct, psi))
        F0 = Mp @ self.rel[A] @ self.euler((0, ay, az))
        H = F0.translation
        a = F0.col[0].xyz.normalized()
        ends = list(leg.ends)
        if dirs is None:
            dirs = [None] * len(ends)
        # an end bone without a given direction keeps its rest direction — turned with the yaw bone's frame when the
        # leg's plane yaws (a spider's tarsus keeps its slant as the leg swings)
        carry = (M[leg.yaw].to_3x3() @ self.rest[leg.yaw].to_3x3().inverted()) if leg.yaw else None
        dl = []
        goal = Vector(target)
        for e, d in reversed(list(zip(ends, dirs))):
            if d is not None:
                d = Vector(d)
            elif carry is not None:
                d = carry @ self.rest_dir[e]
            else:
                d = self.rest_dir[e].copy()
            d = d - a * d.dot(a)
            d.normalize()
            goal = goal - d * self.length[e]
            dl.insert(0, d)
        g = goal - a * (goal - H).dot(a)
        L1, L2 = self.length[A], self.length[B]
        v = g - H
        dist = max(v.length, 1e-6)
        u = v / dist
        dd = min(max(dist, abs(L1 - L2) + 1e-4), (L1 + L2) * 0.99995)
        ca = (L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd)
        al = math.acos(max(-1.0, min(1.0, ca))) * leg.bend
        dirA = u * math.cos(al) + a.cross(u) * math.sin(al)
        thA = signed_angle(F0.col[1].xyz, dirA, F0.col[0].xyz)
        pose[A] = (math.degrees(thA), ay, az)
        MA = F0 @ Matrix.Rotation(thA, 4, 'X')
        M[A] = MA
        bx, by, bz = pose.get(B, (0, 0, 0))
        F0B = MA @ self.rel[B] @ self.euler((0, by, bz))
        dirB = (g - F0B.translation)
        if dirB.length < 1e-9:
            dirB = F0B.col[1].xyz
        thB = signed_angle(F0B.col[1].xyz, dirB.normalized(), F0B.col[0].xyz)
        pose[B] = (math.degrees(thB), by, bz)
        prev = F0B @ Matrix.Rotation(thB, 4, 'X')
        M[B] = prev
        for e, d in zip(ends, dl):
            ex, ey, ez = pose.get(e, (0, 0, 0))
            F0E = prev @ self.rel[e] @ self.euler((0, ey, ez))
            th = signed_angle(F0E.col[1].xyz, d, F0E.col[0].xyz)
            pose[e] = (math.degrees(th), ey, ez)
            prev = F0E @ Matrix.Rotation(th, 4, 'X')
            M[e] = prev
        tip = prev @ Vector((0, self.length[ends[-1] if ends else B], 0))
        err = (tip - Vector(target)).length
        if record:
            self.residual[leg.name] = max(self.residual.get(leg.name, 0.0), err)
        return err

    def leg_angles(self, leg, pose, M, state, record=True):
        """{bone: angles} for one leg in a state ('ik', offset, dirs) / ('fk', {bone: angles})."""
        bones = ([leg.yaw] if leg.yaw else []) + list(leg.ik) + list(leg.ends)
        if state[0] == 'fk':
            return {b: tuple(state[1].get(b, (0, 0, 0))) for b in bones}
        p = dict(pose)
        M2 = dict(M)
        target = self.neutral[leg.name] + Vector(state[1])
        self.solve_leg(leg, p, M2, target, state[2] if len(state) > 2 else None, record=record)
        return {b: p[b] for b in bones}

    def resolve(self, pose):
        """A sampled pose → plain angles: every leg solved (or blended between solved and given angles)."""
        pose = dict(pose)
        legs = pose.pop('legs', None) or {}
        M, _ = self.fk(pose)
        for leg in self.legs:
            st = legs.get(leg.name, ('ik', (0, 0, 0), None))
            if st[0] == 'blend':
                sa, sb, w = st[1], st[2], st[3]
                aa = self.leg_angles(leg, pose, M, sa, record=False)
                bb = self.leg_angles(leg, pose, M, sb, record=False)
                for b in aa:
                    pose[b] = lerp(aa[b], bb[b], w)
            else:
                pose.update(self.leg_angles(leg, pose, M, st))
        return pose

    # ------------------------------------------------------------ keying
    def bake(self, clip):
        """Samples a Clip on every frame and keys every bone (linear); loops get cyclic F-curves."""
        ob = self.ob
        ad = ob.animation_data or ob.animation_data_create()
        if clip.name in bpy.data.actions:
            bpy.data.actions.remove(bpy.data.actions[clip.name])
        act = bpy.data.actions.new(clip.name)
        ad.action = act
        prefs = bpy.context.preferences.edit
        old_interp = prefs.keyframe_new_interpolation_type
        prefs.keyframe_new_interpolation_type = 'LINEAR'
        nfr = clip.frames()
        self.residual = {}
        clip.poses = []
        for f in range(nfr + 1):
            t = f / FPS
            pose = self.resolve(clip.pose_at(t))
            clip.poses.append(pose)
            _, locs = self.fk(pose)
            for pb in ob.pose.bones:
                r = pose.get(pb.name, (0, 0, 0))
                pb.rotation_euler = [math.radians(a) for a in r]
                pb.keyframe_insert('rotation_euler', frame=f, group=pb.name)
                if pb.name in self.loc_bones:
                    pb.location = locs.get(pb.name, Vector((0, 0, 0)))
                    pb.keyframe_insert('location', frame=f, group=pb.name)
        prefs.keyframe_new_interpolation_type = old_interp
        act.use_frame_range = True
        act.frame_start = 0
        act.frame_end = max(1, nfr)
        act.use_cyclic = clip.loop
        act['loop'] = clip.loop
        act.use_fake_user = True
        if clip.loop:
            for fc in channelbag(act).fcurves:
                if not fc.modifiers:
                    fc.modifiers.new('CYCLES')
        clip.residual = dict(self.residual)
        return act

    def assign(self, act, ob=None):
        ob = ob or self.ob
        ad = ob.animation_data or ob.animation_data_create()
        ad.action = act
        if ad.action_slot is None and len(act.slots):
            ad.action_slot = act.slots[0]

    def rest_pose(self):
        for pb in self.ob.pose.bones:
            pb.rotation_euler = (0, 0, 0)
            pb.location = (0, 0, 0)
            pb.scale = (1, 1, 1)


def channelbag(act):
    from bpy_extras import anim_utils
    return anim_utils.action_get_channelbag_for_slot(act, act.slots[0])


def signed_angle(a, b, axis):
    a = Vector(a)
    b = Vector(b)
    axis = Vector(axis).normalized()
    a = a - axis * a.dot(axis)
    b = b - axis * b.dot(axis)
    return math.atan2(a.cross(b).dot(axis), a.dot(b))


class Leg:
    """A leg chain: two IK bones (upper, lower), then end bones aimed along given directions (paw, foot, tarsus);
    bend +1 puts the middle joint on the +Z side of the chain's line (a hind knee forward, a spider's knee up), −1 behind
    (a front elbow). `yaw`: a bone (a spider's coxa) turned about its local Z to aim the leg's plane at the target."""

    def __init__(self, name, ik, ends=(), bend=1, yaw=None, yaw_bias=0.0, abduct=0.0):
        self.name = name
        self.ik = tuple(ik)
        self.ends = tuple(ends)
        self.bend = bend
        self.yaw = yaw
        self.yaw_bias = yaw_bias
        self.abduct = abduct          # > 0: the upper bone may swing its plane sideways up to this many degrees


# ====================================================================== clips
class Clip:
    """keys: [(seconds, pose, ease)] — every pose complete (build them with `step`); or fn(t) → pose for loops.
    overlay(t, pose) → pose adds secondary motion. events: {name: seconds}. shots: seconds for the review strip."""

    def __init__(self, name, seconds, loop=False, keys=None, fn=None, overlay=None, events=None, speed=None, shots=None,
                 view=None):
        self.name = name
        self.seconds = seconds
        self.loop = loop
        self.keys = keys
        self.fn = fn
        self.overlay = overlay
        self.events = events or {}
        self.speed = speed
        self.shots = shots
        self.view = view or {}
        self.poses = []
        self.residual = {}

    def frames(self):
        return max(1, round(self.seconds * FPS))

    def pose_at(self, t):
        if self.fn is not None:
            pose = copy_pose(self.fn(t))
        else:
            pose = blend_keys(self.keys, t)
        if self.overlay is not None:
            pose = self.overlay(t, pose)
        return pose


def step(prev, changes=None, legs=None):
    """A new complete pose: `prev` with bone channels and leg states replaced."""
    p = {k: v for k, v in prev.items() if k != 'legs'}
    p['legs'] = dict(prev.get('legs', {}))
    for k, v in (changes or {}).items():
        p[k] = tuple(v)
    for k, v in (legs or {}).items():
        p['legs'][k] = v
    return p


def copy_pose(p):
    q = dict(p)
    q['legs'] = dict(p.get('legs', {}))
    return q


def blend_keys(keys, t):
    if t <= keys[0][0]:
        return copy_pose(keys[0][1])
    if t >= keys[-1][0]:
        return copy_pose(keys[-1][1])
    for i in range(len(keys) - 1):
        t0, p0, _ = keys[i]
        t1, p1, ease = keys[i + 1]
        if t0 <= t <= t1:
            s = (t - t0) / max(1e-9, t1 - t0)
            w = EASE[ease or 'smooth'](s)
            return blend_poses(p0, p1, w)
    return copy_pose(keys[-1][1])


def blend_poses(p0, p1, w):
    out = {}
    names = set(p0) | set(p1)
    names.discard('legs')
    for n in names:
        a = p0.get(n, (0, 0, 0))
        b = p1.get(n, (0, 0, 0))
        out[n] = lerp(a, b, w)
    legs = {}
    l0 = p0.get('legs', {})
    l1 = p1.get('legs', {})
    for ln in set(l0) | set(l1):
        a = l0.get(ln, ('ik', (0, 0, 0), None))
        b = l1.get(ln, ('ik', (0, 0, 0), None))
        legs[ln] = blend_leg(a, b, w)
    out['legs'] = legs
    return out


def blend_leg(a, b, w):
    if a[0] == 'ik' and b[0] == 'ik':
        oa = Vector(a[1])
        ob_ = Vector(b[1])
        o = oa.lerp(ob_, w)
        # a step between two marks on the floor lifts the foot on an arc instead of sliding it
        dist = (ob_ - oa).xy.length
        slide = (len(a) > 3 and a[3] == 'slide') or (len(b) > 3 and b[3] == 'slide')
        if dist > 0.012 and oa.z <= 0.005 and ob_.z <= 0.005 and not slide:
            o.z += min(0.10, max(0.012, 0.4 * dist)) * math.sin(math.pi * w)
        da = a[2] if len(a) > 2 else None
        db = b[2] if len(b) > 2 else None
        if da is None and db is None:
            d = None
        else:
            d = []
            n = len(da) if da is not None else len(db)
            for i in range(n):
                x = Vector(da[i]) if da is not None and da[i] is not None else None
                y = Vector(db[i]) if db is not None and db[i] is not None else None
                if x is None or y is None:
                    d.append(y if x is None else x)
                else:
                    d.append(x.lerp(y, w).normalized())
        return ('ik', tuple(o), d)
    if a[0] == 'fk' and b[0] == 'fk':
        bones = set(a[1]) | set(b[1])
        return ('fk', {k: lerp(a[1].get(k, (0, 0, 0)), b[1].get(k, (0, 0, 0)), w) for k in bones})
    return ('blend', a, b, w)


def wave(t, period, phase=0.0):
    return math.sin(2 * math.pi * (t / period + phase))


def gait_foot(u, duty, stride, lift, lift_bias=0.5):
    """Foot offset along the travel axis (+ = forward) and its height, for a cycle position u ∈ [0, 1) where the foot
    lands at u = 0. Stance (u < duty): straight back at the body's speed. Swing: forward on an arc."""
    u = u % 1.0
    if u < duty:
        s = u / duty
        return stride * duty * (0.5 - s), 0.0, 'stance', s
    s = (u - duty) / (1 - duty)
    fwd = -stride * duty / 2 + stride * duty * smooth(s)
    # the arc peaks a little after mid-swing for a hind leg (lift_bias > 0.5) — snappier lift-off
    k = s ** (math.log(0.5) / math.log(lift_bias)) if 0 < s < 1 else s
    up = lift * math.sin(math.pi * k)
    return fwd, up, 'swing', s


# ====================================================================== shared files (other passes write them too)
def merge_json(path, updates, retries=200):
    """Reads `path`, sets the top-level keys in `updates`, writes it back atomically (other passes own other keys)."""
    lock = path + '.lock'
    got = False
    for _ in range(retries):
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.close(fd)
            got = True
            break
        except FileExistsError:
            try:
                if time.time() - os.path.getmtime(lock) > 60:
                    os.remove(lock)
                    continue
            except OSError:
                pass
            time.sleep(0.1)
    try:
        data = {}
        if os.path.exists(path):
            with open(path, encoding='utf-8') as f:
                txt = f.read().strip()
                data = json.loads(txt) if txt else {}
        data.update(updates)
        tmp = path + '.tmp%d' % os.getpid()
        with open(tmp, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write('\n')
        os.replace(tmp, path)
    finally:
        if got:
            try:
                os.remove(lock)
            except OSError:
                pass
    return data


def content_palette(mid, pet=False):
    path = os.path.join(CONTENT, 'pets' if pet else 'monsters', mid + '.json')
    if not os.path.exists(path):
        return None
    return list(read_json(path)['visual']['palette'])


# ====================================================================== review renders
def preview_for(variant):
    pal = variant['palette']
    d = {'skin': pal[0], 'skin2': pal[1], 'hair': pal[2]}
    if variant.get('glow'):
        d['glow'] = variant['glow']
    return d


def look(ob, preview, key, outline=0.006):
    me = ob.data
    me.materials.clear()
    me.materials.append(toon.palette_material(preview, name='GV_Palette_' + key))
    me.materials.append(toon.outline_material())
    me.polygons.foreach_set('material_index', [0] * len(me.polygons))
    if outline and 'Outline' not in ob.modifiers:
        so = ob.modifiers.new('Outline', 'SOLIDIFY')
        so.thickness = outline
        so.offset = 1.0
        so.use_flip_normals = True
        so.use_rim = False
        so.material_offset = 1
        so.use_quality_normals = True
    elif 'Outline' in ob.modifiers:
        ob.modifiers['Outline'].thickness = outline
    return ob


def snapshot(ob, name, collection='GV_Snap'):
    """A static copy of a mesh as it is evaluated now (posed, shape keys mixed); no outline (add one after)."""
    out = None
    if 'Outline' in ob.modifiers:
        out = ob.modifiers['Outline'].show_viewport
        ob.modifiers['Outline'].show_viewport = False
        ob.modifiers['Outline'].show_render = False
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    if out is not None:
        ob.modifiers['Outline'].show_viewport = out
        ob.modifiers['Outline'].show_render = True
    st = bpy.data.objects.new(name, me)
    col = bpy.data.collections.get(collection) or bpy.data.collections.new(collection)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    col.objects.link(st)
    st.matrix_world = ob.matrix_world.copy()
    return st


def evaluated_coords(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co)
    ev.to_mesh_clear()
    co = co.reshape(-1, 3)
    M = np.array(ob.matrix_world)
    return co @ M[:3, :3].T + M[:3, 3]


def emission_material(name, rgb, strength=1.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs[0].default_value = (*rgb, 1)
    e.inputs[1].default_value = strength
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


def diffuse_material(name, rgb):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    if bsdf is not None:
        bsdf.inputs['Base Color'].default_value = (*rgb, 1)
        bsdf.inputs['Roughness'].default_value = 0.95
        try:
            bsdf.inputs['Specular IOR Level'].default_value = 0.0
        except Exception:
            pass
    return m


def text(body, loc, size=0.1, rot=(math.radians(90), 0, 0), rgb=(0.86, 0.84, 0.74), collection='GV_Snap', align='CENTER'):
    cu = bpy.data.curves.new('GV_Text', 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = align
    ob = bpy.data.objects.new('GV_Text', cu)
    col = bpy.data.collections.get(collection) or bpy.data.collections.new(collection)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    col.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = rot
    cu.materials.append(emission_material('GV_TextMat', rgb))
    return ob


def floor(size=40.0, rgb=(0.085, 0.072, 0.062), name='GV_Floor', collection='GV_Snap', grid=0.5):
    """A floor plane with a faint grid (so feet can be judged against it)."""
    me = bpy.data.meshes.new(name)
    h = size / 2
    me.from_pydata([(-h, -h, 0), (h, -h, 0), (h, h, 0), (-h, h, 0)], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new(name, me)
    col = bpy.data.collections.get(collection) or bpy.data.collections.new(collection)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    col.objects.link(ob)
    m = bpy.data.materials.get(name + 'Mat')
    if m is None:
        m = bpy.data.materials.new(name + 'Mat')
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        bsdf = nt.nodes.new('ShaderNodeBsdfDiffuse')
        tc = nt.nodes.new('ShaderNodeTexCoord')
        mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (1 / grid, 1 / grid, 1)
        chk = nt.nodes.new('ShaderNodeTexChecker')
        chk.inputs['Color1'].default_value = (*rgb, 1)
        chk.inputs['Color2'].default_value = (rgb[0] * 1.25, rgb[1] * 1.25, rgb[2] * 1.25, 1)
        chk.inputs['Scale'].default_value = 1.0
        nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
        nt.links.new(mp.outputs['Vector'], chk.inputs['Vector'])
        nt.links.new(chk.outputs['Color'], bsdf.inputs['Color'])
        nt.links.new(bsdf.outputs[0], out.inputs[0])
    me.materials.append(m)
    return ob


def hero_silhouette(collection='GV_Snap'):
    """The broad hero body (1.79 m) as a flat grey figure for scale; a capsule if the build file is missing."""
    col = bpy.data.collections.get(collection) or bpy.data.collections.new(collection)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    ob = None
    if os.path.exists(HERO_BLEND):
        try:
            with bpy.data.libraries.load(HERO_BLEND, link=False) as (src, dst):
                dst.objects = ['Body_broad']
            ob = dst.objects[0]
            for m in list(ob.modifiers):
                ob.modifiers.remove(m)
            ob.parent = None
            for o in list(bpy.data.objects):
                if o.type == 'ARMATURE' and o.name.startswith('Rig_') and o.users_collection == ():
                    bpy.data.objects.remove(o)
            col.objects.link(ob)
            ob.matrix_world = Matrix.Identity(4)
        except Exception as ex:  # pragma: no cover
            log('hero silhouette: %s' % ex)
            ob = None
    if ob is None:
        V, F, N, _ = tube([(0, 0, 0.05), (0, 0, 0.9), (0, 0, 1.55), (0, 0, 1.75)], [0.12, 0.18, 0.14, 0.1], sides=12, cap0='flat', cap1='point')
        me = bpy.data.meshes.new('GV_Hero')
        me.from_pydata([tuple(p) for p in V], [], F)
        ob = bpy.data.objects.new('GV_Hero', me)
        col.objects.link(ob)
    me = ob.data
    me.materials.clear()
    me.materials.append(diffuse_material('GV_HeroMat', (0.20, 0.21, 0.24)))
    me.polygons.foreach_set('material_index', [0] * len(me.polygons))
    return ob


def place_camera(stage, pts, az=35.0, el=10.0, lens=50.0, margin=1.1, aspect=1.0):
    """Frames a point cloud (world) from azimuth az (degrees, 0 = the creature's front, + toward its left side) and
    elevation el. Blender's AUTO sensor fit spreads the 36 mm sensor over the wider side of the image."""
    P = np.asarray(pts)
    lo = P.min(0)
    hi = P.max(0)
    c = (lo + hi) / 2
    a = math.radians(az)
    e = math.radians(el)
    d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    fwd = -d
    right = fwd.cross(Vector((0, 0, 1))).normalized()
    up = right.cross(fwd).normalized()
    Q = P - c
    xs = np.abs(Q @ np.array(right))
    ys = np.abs(Q @ np.array(up))
    zs = Q @ np.array(d)
    t = 18.0 / lens
    tan_h, tan_v = (t, t / aspect) if aspect >= 1 else (t * aspect, t)
    dist = max(float(np.max(xs * margin / tan_h + zs)), float(np.max(ys * margin / tan_v + zs)))
    loc = Vector(c) + d * dist
    stage.camera(tuple(loc), tuple(c), lens=lens)
    return loc, Vector(c)


def cam_label(stage, size=0.032):
    cu = bpy.data.curves.new('GV_Label', 'FONT')
    cu.size = size
    ob = bpy.data.objects.new('GV_Label', cu)
    stage.col.objects.link(ob)
    cu.materials.append(emission_material('GV_LabelMat', (0.86, 0.84, 0.74)))
    ob.parent = stage.cam
    ob.location = (-0.335, 0.315, -1.0)
    return ob


def world_to_pixel(cam, p, w, h):
    from bpy_extras.object_utils import world_to_camera_view
    v = world_to_camera_view(bpy.context.scene, cam, Vector(p))
    return v.x * w, (1 - v.y) * h


def crop(px, x0, y0, w, h, bg=(0.012, 0.013, 0.02)):
    """A w×h window of a Blender pixel array (rows bottom-up) whose top-left is (x0, y0) in image coordinates."""
    H, Wd, _ = px.shape
    out = np.zeros((h, w, 4), dtype=np.float32)
    out[..., :3] = bg
    out[..., 3] = 1.0
    for r in range(h):
        yy = y0 + r
        if 0 <= yy < H:
            src_row = H - 1 - yy
            xa = max(0, x0)
            xb = min(Wd, x0 + w)
            if xb > xa:
                out[h - 1 - r, xa - x0:xb - x0] = px[src_row, xa:xb]
    return out


# ====================================================================== the build harness
GUARDPOST_CAM = dict(pos=(0.0, -10.6, 7.5), look=(0.0, 0.0, 1.0), fov=40.0)   # cel-t-guardpost, game → Blender
PHONE = (1784, 824)                     # the S25 Ultra's landscape canvas at the client's pixel-ratio cap (2)


class Monster:
    """One base: its rig, body, parts, variants and clips, and the review / export steps every base shares."""

    def __init__(self, base, quick=False):
        self.base = base
        self.quick = quick
        self.out = os.path.join(OUT_ROOT, base)
        os.makedirs(self.out, exist_ok=True)
        self.rig = None
        self.body = None
        self.parts = {}
        self.variants = []
        self.clips = []
        self.lines = []
        self.view = dict(az=62.0, el=12.0)        # strip camera
        self.card_view = dict(az=38.0, el=16.0)
        self.lineup_yaw = -55.0
        self.fight = dict(girth=1.0, count=3)

    # ------------------------------------------------------------ variants
    def meshes(self):
        return [self.body] + list(self.parts.values())

    def set_variant(self, v):
        for ob in self.meshes():
            keys = ob.data.shape_keys
            if keys:
                for kb in keys.key_blocks[1:]:
                    kb.value = float(v.get('shapes', {}).get(kb.name, 0.0))
            on = ob is self.body or ob.name in v.get('parts', [])
            ob.hide_render = not on
            ob.hide_viewport = not on

    def tris_of(self, v):
        return int(self.body['tris']) + sum(int(self.parts[p]['tris']) for p in v.get('parts', []))

    def clip(self, name):
        for c in self.clips:
            if c.name == name:
                return c
        raise KeyError(name)

    def vertex_mask(self, bones, at_least=0.5):
        """Body vertices whose weights on `bones` sum to at least `at_least` (the torso, to ground a lying body)."""
        ob = self.body
        idx = {g.index for g in ob.vertex_groups if g.name in bones}
        out = np.zeros(len(ob.data.vertices), dtype=bool)
        for v in ob.data.vertices:
            out[v.index] = sum(g.weight for g in v.groups if g.group in idx) >= at_least
        return out

    def pose_frame(self, clip_name, frame):
        self.rig.assign(bpy.data.actions[clip_name])
        bpy.context.scene.frame_set(frame)

    def apply_pose(self, pose):
        """Poses the rig directly (no action), e.g. to measure a key before it is baked."""
        rig = self.rig
        if rig.ob.animation_data:
            rig.ob.animation_data.action = None
        p = rig.resolve(pose)
        _, locs = rig.fk(p)
        for pb in rig.ob.pose.bones:
            pb.rotation_euler = [math.radians(a) for a in p.get(pb.name, (0, 0, 0))]
            pb.location = locs.get(pb.name, Vector((0, 0, 0))) if pb.name in rig.loc_bones else (0, 0, 0)
        bpy.context.view_layer.update()
        return p

    def ground(self, pose, keep_x=True, lift=0.0, iters=3, mask=None):
        """The pose with Root.loc moved so the body's lowest point is on the floor (+ lift) and, with keep_x, its
        centre back over x = 0 (a body rolled about the Root lands beside it otherwise)."""
        p = dict(pose)
        for _ in range(iters):
            self.apply_pose(p)
            co = evaluated_coords(self.body)
            if mask is not None:
                co = co[mask]
            loc = list(p.get('Root.loc', (0, 0, 0)))
            loc[2] += lift - co[:, 2].min()
            if keep_x:
                loc[0] -= co[:, 0].mean()
            p['Root.loc'] = tuple(loc)
        self.rig.rest_pose()
        bpy.context.view_layer.update()
        return p

    # ------------------------------------------------------------ clips
    def bake_clips(self):
        bpy.context.scene.render.fps = FPS
        bpy.context.scene.render.fps_base = 1.0
        for c in self.clips:
            self.rig.bake(c)
            log('clip %-8s %5.2f s %3d frames%s  ik residual %s' % (
                c.name, c.seconds, c.frames(), ' loop' if c.loop else '',
                ', '.join('%s %.1f cm' % (k, v * 100) for k, v in sorted(c.residual.items()))))
        self.rig.ob.animation_data.action = None
        self.rig.rest_pose()

    def check_clips(self):
        """Per clip: the lowest point of the body over every frame, the worst IK residual, loop closure."""
        lines = ['## %s clip checks' % self.base, '']
        v0 = self.variants[0]
        self.set_variant(v0)
        for c in self.clips:
            self.rig.assign(bpy.data.actions[c.name])
            lows = []
            low_v = []
            for f in range(c.frames() + 1):
                bpy.context.scene.frame_set(f)
                co = evaluated_coords(self.body)
                lows.append(co[:, 2].min())
                low_v.append(int(co[:, 2].argmin()))
            lows = np.array(lows)
            fmin = int(lows.argmin())
            vg = {g.index: g.name for g in self.body.vertex_groups}
            vv = self.body.data.vertices[low_v[fmin]]
            low_bone = max(((g.weight, vg[g.group]) for g in vv.groups), default=(0, '?'))[1]
            res = max(c.residual.values()) if c.residual else 0.0
            closure = ''
            if c.loop and c.poses:
                a, b = c.poses[0], c.poses[-1]
                worst = 0.0
                for k in a:
                    if k == 'legs' or k.endswith('.loc'):
                        continue
                    worst = max(worst, max(abs(x - y) for x, y in zip(a.get(k, (0, 0, 0)), b.get(k, (0, 0, 0)))))
                closure = ' · loop closure %.3f deg' % worst
            lines.append('- %s (%.2f s): lowest body point min %.1f cm (f%d, %s) / max %.1f cm · worst IK residual %.1f cm%s' % (
                c.name, c.seconds, lows.min() * 100, fmin, low_bone, lows.max() * 100, res * 100, closure))
            c.low = lows
        self.rig.ob.animation_data.action = None
        self.rig.rest_pose()
        bpy.context.scene.frame_set(0)
        self.lines += lines
        for line in lines:
            log(line)
        return lines

    # ------------------------------------------------------------ renders
    def stage(self, size=None):
        from render import Stage
        return Stage(self.out, size=size or (300 if self.quick else 400), quick=self.quick, platform=False)

    def clear_snaps(self):
        col = bpy.data.collections.get('GV_Snap')
        if col:
            for o in list(col.objects):
                d = o.data
                bpy.data.objects.remove(o, do_unlink=True)
                if d is not None and d.users == 0:
                    if isinstance(d, bpy.types.Mesh):
                        bpy.data.meshes.remove(d)
                    elif isinstance(d, bpy.types.Curve):
                        bpy.data.curves.remove(d)

    def variant_snapshot(self, v, clip_name='Idle', frame=0, tag=''):
        """Static copies of the variant's meshes at a clip frame, with its palette and outline; returns a parent empty."""
        self.set_variant(v)
        if clip_name:
            self.pose_frame(clip_name, frame)
        else:
            self.rig.ob.animation_data.action = None
            self.rig.rest_pose()
            bpy.context.view_layer.update()
        root = bpy.data.objects.new('GV_V_' + v['id'] + tag, None)
        col = bpy.data.collections.get('GV_Snap') or bpy.data.collections.new('GV_Snap')
        if col.name not in bpy.context.scene.collection.children:
            bpy.context.scene.collection.children.link(col)
        col.objects.link(root)
        for ob in self.meshes():
            if ob.hide_render:
                continue
            st = snapshot(ob, 'GV_S_%s_%s%s' % (v['id'], ob.name, tag))
            look(st, preview_for(v), v['id'], outline=0.006 / v['scale'])
            st.parent = root
        for ob in self.meshes():
            ob.hide_render = True
        root.scale = (v['scale'],) * 3
        return root

    def snap_points(self, root):
        pts = []
        bpy.context.view_layer.update()
        for ch in root.children:
            if ch.type == 'MESH':
                M = np.array(ch.matrix_world)
                co = np.empty(len(ch.data.vertices) * 3)
                ch.data.vertices.foreach_get('co', co)
                co = co.reshape(-1, 3)
                pts.append(co @ M[:3, :3].T + M[:3, 3])
        return np.concatenate(pts)

    def render_lineup(self, st):
        self.clear_snaps()
        sc = bpy.context.scene
        floor()
        hero = hero_silhouette()
        items = [('hero', None, hero)]
        for v in sorted(self.variants, key=lambda v: v['scale']):
            items.append((v['id'], v, self.variant_snapshot(v, 'Idle', 0)))
        x = 0.0
        labels = []
        for name, v, ob in items:
            ob.rotation_euler = (0, 0, math.radians(0 if v is None else self.lineup_yaw))
            bpy.context.view_layer.update()
            P = self.snap_points(ob) if v is not None else evaluated_coords(ob)
            lo, hi = P.min(0), P.max(0)
            w = hi[0] - lo[0]
            ob.location.x = x - lo[0] + 0.15
            if v is not None:
                ob.location.y = -(lo[1] + hi[1]) / 2
            cx = x + 0.15 + w / 2
            x += w + 0.3
            lab = 'hero 1.8 m' if v is None else '%s\nx%.2g  %d tris' % (v['name'], v['scale'], self.tris_of(v))
            labels.append((cx, lab))
        size = max(0.07, min(0.16, x / 40))
        last = -1e9
        row = 0
        for cx, lab in labels:
            wid = max(len(t) for t in lab.splitlines()) * size * 0.55
            row = (row + 1) % 2 if cx - last < wid else 0
            text(lab, (cx, -1.2 - 0.42 * row * size / 0.1, 0.02), size=size, rot=(math.radians(70), 0, 0))
            last = cx if row == 0 else last
        bpy.context.view_layer.update()
        pts = [np.array([[labels[0][0] - size * 6, -1.2, 0.0], [labels[-1][0] + size * 6, -1.2, 0.0]])]
        for o in bpy.data.collections['GV_Snap'].objects:
            if o.type == 'MESH' and not o.name.startswith('GV_Floor'):
                pts.append(evaluated_coords(o))
        P = np.concatenate(pts)
        W, H = (2000, 760) if not self.quick else (1500, 570)
        sc.render.resolution_x, sc.render.resolution_y = W, H
        place_camera(st, P, az=0.0, el=9.0, lens=50, margin=1.06, aspect=W / H)
        path = os.path.join(self.out, 'lineup.png')
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        self.clear_snaps()
        return [path]

    def render_cards(self, st):
        """Every variant at Idle and at Attack1's hit frame, each filling a cell, 3/4 view; and the 200-px reads."""
        from render import grid_sheet
        sc = bpy.context.scene
        cell = 380 if self.quick else 520
        tmp = os.path.join(self.out, '_tmp')
        os.makedirs(tmp, exist_ok=True)
        hit = self.clip('Attack1').events.get('hit', 0.3)
        rows = [('Idle', 0), ('Attack1', round(hit * FPS))]
        label = cam_label(st, size=0.03)
        cells = []
        for clip_name, fr in rows:
            for v in self.variants:
                self.clear_snaps()
                floor()
                root = self.variant_snapshot(v, clip_name, fr)
                root.scale = (1, 1, 1)
                bpy.context.view_layer.update()
                P = self.snap_points(root)
                sc.render.resolution_x = sc.render.resolution_y = cell
                place_camera(st, P, az=self.card_view['az'], el=self.card_view['el'], lens=50, margin=1.1)
                label.data.body = '%s  %s f%d' % (v['name'], clip_name, fr)
                p = os.path.join(tmp, 'card_%s_%s.png' % (clip_name, v['id']))
                sc.render.filepath = p
                bpy.ops.render.render(write_still=True)
                cells.append(p)
        out = os.path.join(self.out, 'cards.png')
        grid_sheet(cells, out, cols=len(self.variants))
        small = os.path.join(self.out, 'cards_200.png')
        grid_sheet(cells[:len(self.variants)], small, cols=len(self.variants), cell=200)
        for p in cells:
            os.remove(p)
        bpy.data.objects.remove(label)
        self.clear_snaps()
        return [out, small]

    def live_look(self, v):
        self.set_variant(v)
        for ob in self.meshes():
            look(ob, preview_for(v), v['id'] + '_live', outline=0.006 / v['scale'])

    def render_strips(self, st, only=None):
        from render import grid_sheet
        sc = bpy.context.scene
        self.clear_snaps()
        floor()
        v0 = self.variants[0]
        self.live_look(v0)
        cell = 300 if self.quick else 400
        tmp = os.path.join(self.out, '_tmp')
        os.makedirs(tmp, exist_ok=True)
        label = cam_label(st, size=0.028)
        made = []
        for c in self.clips:
            if only and c.name not in only:
                continue
            act = bpy.data.actions[c.name]
            self.rig.assign(act)
            shots = c.shots or [i * c.seconds / 5 for i in range(6)]
            pts = []
            for t in shots:
                sc.frame_set(round(t * FPS))
                pts.append(evaluated_coords(self.body))
            P = np.concatenate(pts)
            view = dict(self.view)
            view.update(c.view)
            sc.render.resolution_x = sc.render.resolution_y = cell
            place_camera(st, P, az=view['az'], el=view['el'], lens=50, margin=1.08)
            cells = []
            for i, t in enumerate(shots):
                fr = round(t * FPS)
                sc.frame_set(fr)
                ev = ' '.join(k for k, x in c.events.items() if abs(x - t) < 0.5 / FPS)
                label.data.body = '%s  %.2f s  f%d  %s' % (c.name, t, fr, ev)
                p = os.path.join(tmp, 'strip_%s_%d.png' % (c.name, i))
                sc.render.filepath = p
                bpy.ops.render.render(write_still=True)
                cells.append(p)
            out = os.path.join(self.out, 'clip_%s.png' % c.name)
            grid_sheet(cells, out, cols=len(cells))
            for p in cells:
                os.remove(p)
            made.append(out)
        bpy.data.objects.remove(label)
        toon.remove_outlines(self.meshes())
        self.rig.ob.animation_data.action = None
        self.rig.rest_pose()
        sc.frame_set(0)
        self.clear_snaps()
        return made

    def render_fight(self, st):
        """The fight camera at the phone's canvas: three hero silhouettes on the left, the variant (and, for fodder,
        two more of it) on the right; a full frame per variant and a 240-px crop around it at the phone's own scale."""
        from render import load_pixels, save_pixels
        sc = bpy.context.scene
        W, H = PHONE
        crops = []
        frames = []
        for v in self.variants:
            self.clear_snaps()
            floor(rgb=(0.11, 0.095, 0.08), grid=1.0)
            heroes = []
            for i, (hx, hy) in enumerate(((-1.35, 0.35), (-2.55, -0.35), (-2.55, 0.9))):
                if i == 0:
                    hb = hero_silhouette()
                else:
                    hb = heroes[0].copy()
                    bpy.data.collections['GV_Snap'].objects.link(hb)
                hb.location = (hx, hy, 0)
                hb.rotation_euler = (0, 0, math.radians(70))
                heroes.append(hb)
            root = self.variant_snapshot(v, 'Idle', 0)
            girth = v.get('girth', self.fight['girth']) * v['scale']
            first = 0.85 + girth / 2
            spots = [(first, 0.0)]
            if v.get('role') == 'fodder' and not v.get('pet'):
                spots += [(first + 0.25, -0.9), (first + girth / 2 + 1.0, 0.75)]
            insts = [root]
            for k in range(1, len(spots)):
                r2 = root.copy()
                bpy.data.collections['GV_Snap'].objects.link(r2)
                for ch in root.children:
                    c2 = ch.copy()
                    bpy.data.collections['GV_Snap'].objects.link(c2)
                    c2.parent = r2
                insts.append(r2)
            for r, (sx, sy) in zip(insts, spots):
                r.location = (sx, sy, 0)
                r.rotation_euler = (0, 0, math.radians(-70))
                r.scale = (v['scale'],) * 3
            sc.render.resolution_x, sc.render.resolution_y = W, H
            st.camera(GUARDPOST_CAM['pos'], GUARDPOST_CAM['look'], lens=50)
            st.cam.data.sensor_fit = 'VERTICAL'
            st.cam.data.angle_y = math.radians(GUARDPOST_CAM['fov'])
            path = os.path.join(self.out, '_tmp', 'fight_%s.png' % v['id'])
            os.makedirs(os.path.dirname(path), exist_ok=True)
            sc.render.filepath = path
            bpy.ops.render.render(write_still=True)
            bpy.context.view_layer.update()
            P = self.snap_points(root)
            c3 = P.mean(0)
            px_, py_ = world_to_pixel(st.cam, c3, W, H)
            px = load_pixels(path)
            cw = 240
            crops.append(crop(px, int(px_ - cw / 2), int(py_ - cw / 2), cw, cw))
            frames.append(path)
            st.cam.data.sensor_fit = 'AUTO'
        out = os.path.join(self.out, 'fight_read.png')
        if crops:
            save_pixels(out, np.concatenate(crops, axis=1))
        full = os.path.join(self.out, 'fight_view.png')
        if frames:
            os.replace(frames[0], full)
            for p in frames[1:]:
                os.remove(p)
        self.clear_snaps()
        return [out, full]

    def finish_renders(self):
        tmp = os.path.join(self.out, '_tmp')
        if os.path.isdir(tmp) and not os.listdir(tmp):
            os.rmdir(tmp)

    # ------------------------------------------------------------ export
    def export(self):
        from export import export_glb, stash_actions
        toon.remove_outlines(self.meshes())
        for ob in self.meshes():
            ob.data.materials.clear()
            keys = ob.data.shape_keys
            if keys:
                for kb in keys.key_blocks[1:]:
                    kb.value = 0.0
            ob.hide_render = False
            ob.hide_viewport = False
        arm = self.rig.ob
        names = [c.name for c in self.clips]
        if arm.animation_data:
            arm.animation_data.action = None
        stash_actions(arm, names)
        for tr in arm.animation_data.nla_tracks:
            for s in tr.strips:
                if s.action_slot is None and len(s.action.slots):
                    s.action_slot = s.action.slots[0]
        self.rig.rest_pose()
        bpy.context.scene.frame_set(0)
        path = os.path.join(MON, '%s.glb' % self.base)
        kb = export_glb(path, [arm] + self.meshes(), animations=True, animation_mode='ACTIONS',
                        extra={'export_optimize_animation_size': True,
                               'export_optimize_animation_keep_anim_armature': True})
        return path, kb

    def write_tables(self):
        clips = {'fps': FPS, 'clips': []}
        for c in self.clips:
            e = {'name': c.name, 'seconds': round(c.frames() / FPS, 4), 'loop': bool(c.loop),
                 'events': {k: round(v, 4) for k, v in c.events.items()}}
            if c.speed:
                e['speed'] = round(c.speed, 3)
            clips['clips'].append(e)
        merge_json(os.path.join(MON, 'clips.json'), {self.base: clips})
        man = {}
        for v in self.variants:
            e = {'base': self.base, 'scale': v['scale'], 'parts': list(v.get('parts', [])),
                 'shapes': {k: float(w) for k, w in v.get('shapes', {}).items()}, 'palette': list(v['palette']),
                 'clipSpeed': v['clipSpeed']}
            # fixed-slot overrides, the other passes' convention: {"11": glow colour}
            e['slots'] = {'11': v['glow']} if v.get('glow') else {}
            if v.get('ghost'):
                e['ghost'] = True
            if v.get('pet'):
                e['pet'] = v['pet']
            cm = {k.name: k.name for k in self.clips if k.name in ('Idle', 'Move', 'Attack1', 'Attack2', 'Hit', 'Death', 'Flee')}
            cm.update(v.get('clipMap', {}))
            e['clipMap'] = cm
            e['name'] = v['name']
            e['tris'] = self.tris_of(v)
            man[v['id']] = e
        merge_json(os.path.join(MON, 'manifest.json'), man)
        return clips, man

    def write_lines(self, extra=()):
        path = os.path.join(BUILD, 'monsters_%s_checks.txt' % self.base)
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(list(self.lines) + list(extra)) + '\n')
        return path

"""robe_lib.py — helpers for the Robes gear passes (Arcanist, Mender), on top of gear_lib.py (which is used as is).

What this adds to gear_lib (README §Gear):
- `Ctx`: the broad body's triangles with ray / nearest queries limited to regions, a side and a height band, the legs'
  support (how far the legs reach in a direction at a height) and the bone lines.
- `low_shell`: a gear_lib shell decimated to the phone budget whose every vertex is still one of the shell's own
  sources (push / lerp, snapped back after Blender's decimator), so it fits both frames and every species key exactly.
  Seam planes are sliced first and kept through the decimation, so colour fields (a tabard, a cuff) stay straight.
- free cloth bound to *chosen* triangles: every point is bound to the body triangle a ray from it toward a chosen
  target meets first (a leg's bone line, the body's centre line, the neck axis), so it carries that triangle's weights.
  `skirt` builds a robe skirt in two halves that share their rows above the slits and ride their own leg below — a
  stride opens the front and back slits instead of tearing the cloth (and a Draconid tail leaves through the back slit);
  `hood` (dome rows hug the skull, rings gather at the neck and flare onto the shoulders — Ascend's lesson), `rings`
  (mantles, collars, belts, cuffs, circlets) and `tube` (bell sleeves, bracers) are row x column grids that hug the body.
- review: test poses, a body copy with the hidden regions dropped (what the client draws), the render set, sheets.
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(os.path.dirname(HERE), 'lib')
for _p in (LIB, HERE):
    if _p not in sys.path:
        sys.path.insert(0, _p)
from common import BUILD, CONTENT, RENDERS, REPO, args, collection, log, read_json, save_blend  # noqa: E402,F401
from fit import SurfaceMap  # noqa: E402
import toon  # noqa: E402
import rig as riglib  # noqa: E402
import gear_lib as gl  # noqa: E402

SL = toon.SLOT
REG = toon.REGION
REG_NAME = {v: k for k, v in REG.items()}
TAU = 2.0 * math.pi
FRAMES = gl.FRAMES


def u(theta):
    """Horizontal unit vector at angle theta: 0 = the character's front (-Y), +90 deg = the character's left (+X)."""
    return Vector((math.sin(theta), -math.cos(theta), 0.0))


def smoothstep(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0) if b != a else (1.0 if x >= b else 0.0)
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


# ------------------------------------------------------------------ the source file
def open_source():
    """Opens hero_species.blend if it exists, else hero_body.blend; drops the body build's review leftovers."""
    path = gl.source_blend()
    bpy.ops.wm.open_mainfile(filepath=path)
    for ob in list(bpy.data.objects):
        if ob.name.startswith('GV_') or ob.name.startswith('Sticks_'):
            bpy.data.objects.remove(ob, do_unlink=True)
    for ob in bpy.data.objects:
        if ob.type == 'ARMATURE':
            if ob.animation_data:
                ob.animation_data_clear()
            riglib.rest_pose(ob)
    for act in list(bpy.data.actions):
        if act.users == 0:
            bpy.data.actions.remove(act)
    log('gear source:', os.path.relpath(path, REPO))
    return path


# ------------------------------------------------------------------ the body, queried
class Ctx:
    """The broad body's rest triangles (the space every piece is built in) with region/side/height filtered queries."""

    def __init__(self, bodies):
        self.bodies = bodies
        b = self.b = bodies['broad']
        self.smap = SurfaceMap(b.shapes['Basis'], b.faces)
        self.rest = self.smap.rest
        self.tris = self.smap.tris
        self.tri_face = [fi for fi, f in enumerate(b.faces) for _ in range(len(f) - 2)]
        self.tri_region = [b.face_regions[fi] for fi in self.tri_face]
        self.tri_center = [(self.rest[a] + self.rest[c] + self.rest[d]) / 3.0 for a, c, d in self.tris]
        self.tri_normal = []
        for a, c, d in self.tris:
            n = (self.rest[c] - self.rest[a]).cross(self.rest[d] - self.rest[a])
            self.tri_normal.append(n.normalized() if n.length > 1e-12 else Vector((0, 0, 1)))
        self._trees = {}
        self._sup = {}
        self._vt = {}
        for ti, t in enumerate(self.tris):
            for v in t:
                self._vt.setdefault(v, []).append(ti)
        vs = b.shapes['Basis']
        self.V = np.array([tuple(v) for v in vs])
        self.vregion = np.array(b.regions)
        hv = self.V[self.vregion == REG['head']]
        self.head_lo, self.head_hi = hv.min(axis=0), hv.max(axis=0)

    def tri_by_vertex(self, vi):
        return self._vt.get(vi, [])

    def normal_at(self, ti, p):
        """The body's smooth (full-resolution) normal at point p of triangle ti."""
        a, b, c = self.tris[ti]
        w = gl._bary(Vector(p), self.rest[a], self.rest[b], self.rest[c])
        N = self.b.normals['Basis']
        n = N[a] * w[0] + N[b] * w[1] + N[c] * w[2]
        return n.normalized() if n.length > 1e-9 else self.tri_normal[ti]

    def body_kd(self, regions):
        key = tuple(sorted(regions))
        if not hasattr(self, '_kd'):
            self._kd = {}
        if key not in self._kd:
            want = [REG[r] for r in regions]
            ids = [i for i in range(len(self.V)) if int(self.vregion[i]) in want]
            kd = KDTree(len(ids))
            for i in ids:
                kd.insert(Vector(self.V[i]), i)
            kd.balance()
            self._kd[key] = kd
        return self._kd[key]

    # ---- joints and lines
    def joint(self, bone, end='head'):
        return gl.joint(self.bodies, bone, end, 'broad')

    def leg_axis(self, side, z):
        pre = 'Left' if side > 0 else 'Right'
        hip, knee, ankle = self.joint(pre + 'UpperLeg'), self.joint(pre + 'LowerLeg'), self.joint(pre + 'Foot')
        if z >= knee.z:
            t = (hip.z - z) / max(1e-6, hip.z - knee.z)
            return hip.lerp(knee, min(max(t, 0.0), 1.0))
        t = (knee.z - z) / max(1e-6, knee.z - ankle.z)
        return knee.lerp(ankle, min(max(t, 0.0), 1.0))

    def spine_y(self, z):
        """y of the body's centre line at height z (through the spine and neck joints, nudged to the body's middle)."""
        pts = [self.joint(n) for n in ('Hips', 'Spine', 'Chest', 'UpperChest', 'Neck', 'Head')] + [self.joint('Head', 'tail')]
        pts.sort(key=lambda p: p.z)
        if z <= pts[0].z:
            return pts[0].y
        for a, c in zip(pts, pts[1:]):
            if a.z <= z <= c.z:
                return lerp(a.y, c.y, (z - a.z) / max(1e-6, c.z - a.z))
        return pts[-1].y

    def head_center(self):
        lo, hi = self.head_lo, self.head_hi
        return Vector((0.0, 0.5 * (lo[1] + hi[1]) + 0.012, lo[2] + 0.56 * (hi[2] - lo[2])))

    # ---- triangle queries
    def tree(self, regions=None, side=0, zmin=-9.0, zmax=9.0, exclude=None):
        key = (tuple(sorted(regions)) if regions else None, side, round(zmin, 3), round(zmax, 3),
               tuple(sorted(exclude)) if exclude else None)
        if key not in self._trees:
            want = {REG[r] if isinstance(r, str) else r for r in regions} if regions else None
            excl = {REG[r] if isinstance(r, str) else r for r in exclude} if exclude else set()
            ids = []
            for ti, c in enumerate(self.tri_center):
                rg = self.tri_region[ti]
                if want is not None and rg not in want:
                    continue
                if rg in excl:
                    continue
                if side and c.x * side < -0.004:
                    continue
                if not (zmin <= c.z <= zmax):
                    continue
                ids.append(ti)
            tree = BVHTree.FromPolygons(self.rest, [self.tris[i] for i in ids]) if ids else None
            self._trees[key] = (tree, ids)
        return self._trees[key]

    def ray(self, origin, direction, maxd=2.0, **filt):
        tree, ids = self.tree(**filt)
        if tree is None:
            return None
        d = Vector(direction)
        if d.length < 1e-9:
            return None
        loc, nor, idx, dist = tree.ray_cast(Vector(origin), d.normalized(), maxd)
        if idx is None:
            return None
        return ids[idx], loc, dist

    def nearest(self, p, **filt):
        tree, ids = self.tree(**filt)
        if tree is None:
            tree, ids = self.tree()
        loc, nor, idx, dist = tree.find_nearest(Vector(p))
        return ids[idx], loc, dist

    def outermost(self, origin, direction, maxd=1.0, **filt):
        """The last surface a ray from `origin` crosses within maxd (from inside a limb or the torso: its outer skin)."""
        tree, ids = self.tree(**filt)
        if tree is None:
            return None
        o = Vector(origin)
        d = Vector(direction).normalized()
        left, travelled, last = maxd, 0.0, None
        for _ in range(12):
            loc, nor, idx, dist = tree.ray_cast(o, d, left)
            if idx is None:
                break
            travelled += dist
            last = (ids[idx], loc.copy(), travelled)
            o = loc + d * 2e-4
            left -= dist + 2e-4
            travelled += 2e-4
            if left <= 0:
                break
        return last

    # ---- the legs' support
    def support(self, theta, z, yc, regions=('belly', 'thighs', 'shins', 'feet'), half=0.025):
        """max over body vertices of `regions` within +-half of height z of (v - c) . u(theta): how far the body
        reaches in that direction from the centre (0, yc) — a convex enclosure of both legs at that height."""
        key = tuple(regions)
        if key not in self._sup:
            m = np.isin(self.vregion, [REG[r] for r in regions])
            self._sup[key] = self.V[m]
        V = self._sup[key]
        sel = V[np.abs(V[:, 2] - z) < half]
        if len(sel) == 0:
            return 0.0
        P = sel[:, :2] - np.array([0.0, yc])
        uu = np.array([math.sin(theta), -math.cos(theta)])
        return float((P @ uu).max())

    def slab_center_y(self, z, regions=('belly', 'thighs', 'shins'), half=0.025):
        key = tuple(regions)
        if key not in self._sup:
            m = np.isin(self.vregion, [REG[r] for r in regions])
            self._sup[key] = self.V[m]
        V = self._sup[key]
        sel = V[np.abs(V[:, 2] - z) < half]
        if len(sel) == 0:
            return self.spine_y(z)
        return float(0.5 * (sel[:, 1].min() + sel[:, 1].max()))


# ------------------------------------------------------------------ pieces: sources, binding, merging
def bind_at(piece, ctx, p, ti, off=0.0):
    piece._smap = ctx.smap
    piece.src.append(('bind', ti, Vector(p), off))
    return len(piece.src) - 1


def bind_toward(piece, ctx, p, target, fallback=True, **filt):
    """Binds p to the first body triangle met on the way from p toward `target` (the surface p hangs over)."""
    p = Vector(p)
    d = Vector(target) - p
    hit = ctx.ray(p, d, d.length + 0.08, **filt) if d.length > 1e-6 else None
    if hit is None and fallback:
        hit = ctx.nearest(p, **filt)
    return bind_at(piece, ctx, p, hit[0])


def bind_nearest(piece, ctx, p, **filt):
    return bind_at(piece, ctx, p, ctx.nearest(p, **filt)[0])


def src_pos(piece, s, ctx, at_body=False):
    """A source's broad-basis position, offsets included (at_body: pushed and lerp sources on the skin itself)."""
    if s[0] == 'bind':
        p = Vector(s[2])
        if s[3]:
            p = p + ctx.tri_normal[s[1]] * s[3]
        return p
    if at_body:
        B = ctx.b.shapes['Basis']
        if s[0] == 'push':
            return B[s[1]].copy()
        return B[s[1]].lerp(B[s[2]], s[3])
    return gl._src_basis(piece, s, ctx.b)


def positions(piece, ctx, at_body=False):
    return [src_pos(piece, s, ctx, at_body) for s in piece.src]


def merge(name, parts, ctx):
    out = gl.Piece(name)
    out._smap = ctx.smap
    out._loose = {}
    out._lining = set()
    for part in parts:
        base = len(out.src)
        out.src.extend(part.src)
        for f, s in zip(part.faces, part.slots):
            out.add_face([base + i for i in f], s)
        for i, rg in getattr(part, '_loose', {}).items():
            out._loose[base + i] = rg
        for i in getattr(part, '_lining', ()):
            out._lining.add(base + i)
    return out


def mark_loose(piece, regions, rigid=False):
    """Marks every bound point of a piece as loose cloth whose other shapes (the slight frame, the species keys) come
    from the body's smooth displacement around it (see refit_loose) rather than from its one triangle. rigid=True
    moves the whole piece by the one displacement at its centre (a metal sun, a floating shard: they must not bend
    with the chest or the brow under them). Call it when the part is complete (after its rims)."""
    piece._loose = getattr(piece, '_loose', {})
    spec = ('rigid', id(piece), tuple(regions)) if rigid else tuple(regions)
    for i, s in enumerate(piece.src):
        if s[0] == 'bind':
            piece._loose[i] = spec
    return piece


def face_center_normal(piece, f, pos):
    pts = [pos[i] for i in f]
    c = sum(pts, Vector((0, 0, 0))) / len(pts)
    n = Vector((0, 0, 0))
    for k in range(len(pts)):
        n += pts[k].cross(pts[(k + 1) % len(pts)])
    return c, (n.normalized() if n.length > 1e-12 else Vector((0, 0, 1)))


def paint(piece, ctx, fn):
    """Re-slots faces: fn(center, normal, old_slot, face_index) -> new slot or None (keep)."""
    pos = positions(piece, ctx)
    changed = 0
    for i, f in enumerate(piece.faces):
        c, n = face_center_normal(piece, f, pos)
        s = fn(c, n, piece.slots[i], i)
        if s is not None and s != piece.slots[i]:
            piece.slots[i] = s
            changed += 1
    log('paint %s: %d of %d faces re-slotted' % (piece.name, changed, len(piece.faces)))
    return piece


def orient(piece, ctx, outward):
    """Flips faces whose normal points against outward(center) (free grids are built in either winding)."""
    pos = positions(piece, ctx)
    for i, f in enumerate(piece.faces):
        c, n = face_center_normal(piece, f, pos)
        if n.dot(outward(c)) < 0:
            piece.faces[i] = tuple(reversed(f))
    return piece


def drop_faces(piece, ctx, fn):
    """Removes faces where fn(center, normal, slot) is true (unused sources stay; realize keeps them harmless)."""
    pos = positions(piece, ctx)
    keep_f, keep_s = [], []
    for f, s in zip(piece.faces, piece.slots):
        c, n = face_center_normal(piece, f, pos)
        if not fn(c, n, s):
            keep_f.append(f)
            keep_s.append(s)
    piece.faces, piece.slots = keep_f, keep_s
    return compact(piece)


def compact(piece):
    used = sorted({i for f in piece.faces for i in f})
    remap = {o: n for n, o in enumerate(used)}
    piece.src = [piece.src[o] for o in used]
    piece.faces = [tuple(remap[i] for i in f) for f in piece.faces]
    return piece


# ------------------------------------------------------------------ plane slicing (both sides kept) and cutting free cloth
def _as_edge(s):
    """A push or lerp source as (i, j, param, offset) on a body edge (j None for a plain vertex)."""
    if s[0] == 'push':
        return (s[1], None, 0.0, s[2])
    if s[0] == 'lerp':
        return (s[1], s[2], s[3], s[4])
    return None


def _on_edge(e, i, j):
    ei, ej, es = e[0], e[1], e[2]
    if ej is None:
        return 0.0 if ei == i else (1.0 if ei == j else None)
    if (ei, ej) == (i, j):
        return es
    if (ei, ej) == (j, i):
        return 1.0 - es
    return None


def _crossing_src(piece, ctx, a, b, t, pos):
    sa, sb = piece.src[a], piece.src[b]
    if sa[0] == 'bind' and sb[0] == 'bind':
        p = pos[a].lerp(pos[b], t)
        ti = sa[1] if t < 0.5 else sb[1]
        # stored point excludes the triangle-normal offset: blend the offsets
        off = sa[3] + (sb[3] - sa[3]) * t
        return ('bind', ti, p - ctx.tri_normal[ti] * off, off)
    ea, eb = _as_edge(sa), _as_edge(sb)
    if ea and eb:
        off = ea[3] + (eb[3] - ea[3]) * t
        if ea[1] is None and eb[1] is None:
            return ('lerp', ea[0], eb[0], t, off)
        # both on one body edge (a vertex and a point of an edge through it, or two points of one edge): exact blend
        for e in (ea, eb):
            if e[1] is None:
                continue
            i, j = e[0], e[1]
            pa, pb = _on_edge(ea, i, j), _on_edge(eb, i, j)
            if pa is not None and pb is not None:
                return ('lerp', i, j, pa + (pb - pa) * t, off)
    return sa if t < 0.5 else sb


def clip(piece, ctx, point=None, normal=None, keep='front', both=False, face_filter=None, fn=None, regions=None,
         at_body=False):
    """Clips faces against a plane (broad-basis space) or a field fn(P) (>= 0 is the kept side). keep='front' keeps the
    side `normal` points to; both=True keeps both sides (the faces are split along the cut and the new edge vertices
    shared). Works on push/lerp sources (new vertices are 'lerp' blends of body vertices, exact on every frame and
    species) and on bind sources (new vertices are bound points on the cut edge). face_filter(center) -> False, or a
    face whose body region is not in `regions`, is left untouched. Returns the set of vertex indices on the cut."""
    sign = 1.0 if keep == 'front' else -1.0
    pos = positions(piece, ctx, at_body)
    if fn is not None:
        d = [sign * fn(p) for p in pos]
    else:
        n = Vector(normal).normalized()
        c0 = Vector(point)
        d = [sign * (p - c0).dot(n) for p in pos]
    only = {REG[r] if isinstance(r, str) else r for r in regions} if regions else None
    edge_new = {}
    on_plane = set()

    def crossing(a, b):
        key = (min(a, b), max(a, b))
        if key in edge_new:
            return edge_new[key]
        t = d[a] / (d[a] - d[b])
        piece.src.append(_crossing_src(piece, ctx, a, b, t, pos))
        pos.append(pos[a].lerp(pos[b], t))
        d.append(0.0)
        edge_new[key] = len(piece.src) - 1
        on_plane.add(edge_new[key])
        return edge_new[key]

    faces, slots = [], []
    for f, sl in zip(piece.faces, piece.slots):
        if face_filter is not None:
            cc = sum((pos[i] for i in f), Vector((0, 0, 0))) / len(f)
            if not face_filter(cc):
                faces.append(f)
                slots.append(sl)
                continue
        if only is not None and gl._face_region(piece, f, ctx.b) not in only:
            faces.append(f)
            slots.append(sl)
            continue
        ins = [d[v] >= 0 for v in f]
        if all(ins):
            faces.append(f)
            slots.append(sl)
            continue
        if not any(ins):
            if both:
                faces.append(f)
                slots.append(sl)
            continue
        front, back = [], []
        for k in range(len(f)):
            a, b = f[k], f[(k + 1) % len(f)]
            if d[a] >= 0:
                front.append(a)
            else:
                back.append(a)
            if (d[a] >= 0) != (d[b] >= 0):
                x = crossing(a, b)
                front.append(x)
                back.append(x)
        if len(front) >= 3:
            faces.append(tuple(front))
            slots.append(sl)
        if both and len(back) >= 3:
            faces.append(tuple(back))
            slots.append(sl)
    piece.faces, piece.slots = faces, slots
    return on_plane


# ------------------------------------------------------------------ low-poly shells
def low_shell(piece, ctx, ratio, seams=(), symmetry=True, name=None):
    """The piece decimated to `ratio` of its triangles. Every vertex of the result is one of the piece's own sources
    (Blender's decimator places merged vertices freely; each is snapped back to the nearest source), so the shell stays
    exact on both frames and every species. `seams` = [(point, normal)] planes sliced first and protected through the
    decimation (vertex group weight x 1000), so colour fields painted afterwards by face centre have straight edges."""
    seam_verts = set()
    for pt, nrm in seams:
        seam_verts |= clip(piece, ctx, pt, nrm, both=True)
    pos = positions(piece, ctx)
    me = bpy.data.meshes.new('gv_tmp_dec')
    me.from_pydata([tuple(p) for p in pos], [], [tuple(f) for f in piece.faces])
    me.update()
    ob = bpy.data.objects.new('gv_tmp_dec', me)
    bpy.context.scene.collection.objects.link(ob)
    if seam_verts:
        vg = ob.vertex_groups.new(name='keep')
        vg.add(sorted(seam_verts), 1.0, 'REPLACE')
    mod = ob.modifiers.new('dec', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    mod.use_symmetry = symmetry
    mod.symmetry_axis = 'X'
    if seam_verts:
        # Blender's decimate penalises edges by (2 - w1 - w2) x factor: weight 0 is what it keeps, so invert
        mod.vertex_group = 'keep'
        mod.vertex_group_factor = 1000.0
        mod.invert_vertex_group = True
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    dm = ev.to_mesh()
    dverts = [v.co.copy() for v in dm.vertices]
    dfaces = [tuple(p.vertices) for p in dm.polygons]
    ev.to_mesh_clear()
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.meshes.remove(me)
    kd = KDTree(len(pos))
    for i, p in enumerate(pos):
        kd.insert(p, i)
    kd.balance()
    # boundary vertices snap to boundary sources only (else a hem zig-zags onto the vertices behind it)
    old_bnd = sorted({i for lp in gl.boundary_loops(piece) for i in lp})
    kdb = KDTree(max(1, len(old_bnd)))
    for i in old_bnd:
        kdb.insert(pos[i], i)
    kdb.balance()
    ecount = {}
    for f in dfaces:
        for k in range(len(f)):
            e = tuple(sorted((f[k], f[(k + 1) % len(f)])))
            ecount[e] = ecount.get(e, 0) + 1
    new_bnd = {v for e, c in ecount.items() if c == 1 for v in e}
    snap = [(kdb.find(v)[1] if (i in new_bnd and old_bnd) else kd.find(v)[1]) for i, v in enumerate(dverts)]
    # slot of each new face: the slot of the nearest old face centre
    fkd = KDTree(len(piece.faces))
    for i, f in enumerate(piece.faces):
        fkd.insert(sum((pos[j] for j in f), Vector((0, 0, 0))) / len(f), i)
    fkd.balance()
    out = gl.Piece(name or piece.name)
    out._smap = ctx.smap
    remap = {}
    seen = set()
    flipped = 0
    for f in dfaces:
        ids = [snap[i] for i in f]
        if len(set(ids)) < len(ids):
            continue
        key = tuple(sorted(ids))
        if key in seen:
            continue
        seen.add(key)
        c = sum((pos[i] for i in ids), Vector((0, 0, 0))) / len(ids)
        slot = piece.slots[fkd.find(c)[1]]
        nf = []
        for i in ids:
            if i not in remap:
                out.src.append(piece.src[i])
                remap[i] = len(out.src) - 1
            nf.append(remap[i])
        # snapping can fold a triangle over: one facing against the skin would be culled by the client's
        # front-face-only material and leave a hole, so it is wound back to face out
        cc, nn = face_center_normal(out, [ids[0], ids[1], ids[2]], pos)
        ref = piece.faces[fkd.find(c)[1]]
        _, rn = face_center_normal(piece, ref, pos)
        if nn.dot(rn) < 0.0:
            flipped += 1
            nf = list(reversed(nf))
        out.add_face(nf, slot)
    log('low_shell %s: %d -> %d tris (%d folded)' % (out.name, gl.tri_count_piece(piece), gl.tri_count_piece(out), flipped))
    return out


def covered(piece, ctx, region):
    """True when every body face of `region` is used whole by the piece's pushed vertices (before decimation)."""
    b = ctx.b
    rid = REG[region]
    pushed = {}
    for s in piece.src:
        if s[0] == 'push':
            pushed[s[1]] = True
    have = set()
    for f in piece.faces:
        idx = [piece.src[i][1] for i in f if piece.src[i][0] == 'push']
        if len(idx) == len(f):
            have.add(tuple(sorted(idx)))
    missing = 0
    for fi, f in enumerate(b.faces):
        if b.face_regions[fi] != rid:
            continue
        if tuple(sorted(f)) not in have:
            missing += 1
    return missing


# ------------------------------------------------------------------ free cloth: grids
def grid_faces(piece, idx, slot, closed=True, slot_fn=None):
    """Quads over a rows x cols grid of vertex indices (idx[r][c]); closed wraps the columns."""
    rows = len(idx)
    cols = len(idx[0])
    for r in range(rows - 1):
        for c in range(cols if closed else cols - 1):
            c2 = (c + 1) % cols
            q = (idx[r][c], idx[r + 1][c], idx[r + 1][c2], idx[r][c2])
            if len(set(q)) < 3:
                continue
            if len(set(q)) == 3:
                q = tuple(dict.fromkeys(q))
            piece.add_face(q, slot_fn(r, c) if slot_fn else slot)


def rings(ctx, name, *, center, levels, cols, slot, regions, bind_target=None, arc=None, slot_fn=None,
          bind_regions=None, side=0, mode='normal'):
    """A stack of rings around a vertical axis: levels = [(z or z(θ), off or off(θ))] top to bottom. Each point starts
    at the outermost body surface met by a horizontal ray from the axis point (0, yc(z), z) at angle θ (regions) and is
    pushed `off` along the body's normal there (mode 'normal': clears a sloping shoulder too) or horizontally
    ('radial'). Points bind toward bind_target(z, θ) (default: the axis point at their height). arc=(θa, θb) builds an
    open strip instead of a closed ring. Returns (piece, idx grid, thetas)."""
    p = gl.Piece(name)
    p._smap = ctx.smap
    if arc:
        thetas = [arc[0] + (arc[1] - arc[0]) * j / (cols - 1) for j in range(cols)]
    else:
        thetas = [TAU * j / cols for j in range(cols)]
    idx = []
    for li, (zf, of) in enumerate(levels):
        row = []
        for th in thetas:
            z = zf(th) if callable(zf) else zf
            yc = center(z) if callable(center) else center
            o = Vector((0.0, yc, z))
            off = of(th) if callable(of) else of
            hit = ctx.outermost(o, u(th), 0.6, regions=regions, zmin=z - 0.06, zmax=z + 0.06)
            if hit is None:
                P = o + u(th) * (0.05 + off)
            elif mode == 'normal':
                n = ctx.normal_at(hit[0], hit[1])
                if n.dot(u(th)) < 0.25:
                    n = (n + u(th)).normalized()
                P = hit[1] + n * off
            else:
                P = o + u(th) * (hit[2] + off)
            tgt = bind_target(z, th) if bind_target else o
            row.append(bind_toward(p, ctx, P, tgt, regions=bind_regions or regions, side=side))
        idx.append(row)
    grid_faces(p, idx, slot, closed=not arc, slot_fn=slot_fn)
    return p, idx, thetas


def tube(ctx, name, *, a, b, levels, cols, slot, regions, side=0, slot_fn=None, roll_ref=None, bind_regions=None):
    """Rings around the segment a→b (a limb): levels = [(t or t(φ) along a→b, radius(φ, ρ))] where ρ is the limb's
    outermost surface distance from the axis at angle φ (measured on the ring's own plane at t). Points bind toward
    the axis point of their ring, so the tube rides the limb under it. φ = 0 faces roll_ref (default: the front)."""
    p = gl.Piece(name)
    p._smap = ctx.smap
    a, b = Vector(a), Vector(b)
    ax = (b - a).normalized()
    ref = Vector(roll_ref) if roll_ref is not None else Vector((0, -1, 0))
    e1 = (ref - ax * ref.dot(ax)).normalized()
    e2 = ax.cross(e1).normalized()
    idx = []
    for t, rf in levels:
        row = []
        for j in range(cols):
            ph = TAU * j / cols
            tt = t(ph) if callable(t) else t
            o = a.lerp(b, tt)
            dvec = e1 * math.cos(ph) + e2 * math.sin(ph)
            hit = ctx.outermost(o, dvec, 0.3, regions=regions, side=side)
            rho = hit[2] if hit else 0.04
            P = o + dvec * rf(ph, rho)
            row.append(bind_toward(p, ctx, P, o, regions=bind_regions or regions, side=side))
        idx.append(row)
    grid_faces(p, idx, slot, closed=True, slot_fn=slot_fn)
    axis_pt = lambda c: a + ax * (c - a).dot(ax)  # noqa: E731
    orient(p, ctx, lambda c: c - axis_pt(c))
    return p, idx


# ------------------------------------------------------------------ body-hugging pieces (decimated shells)
def arm_points(ctx, side):
    pre = 'Left' if side > 0 else 'Right'
    return ctx.joint(pre + 'UpperArm'), ctx.joint(pre + 'LowerArm'), ctx.joint(pre + 'Hand'), ctx.joint(pre + 'Hand', 'tail')


def neck_angle(ctx, P):
    yc = ctx.spine_y(P.z)
    return math.atan2(P.x, -(P.y - yc)) % TAU


def neckline(ctx, margin=0.007, raise_front=0.0, bins=24):
    """z(θ) of a neckline that just covers the chest region: the chest's top edge measured around the neck axis
    (smoothed with its neighbours' maximum) plus a margin. θ = 0 at the front."""
    b = ctx.b
    rid = REG['chest']
    top = [0.0] * bins
    vs = b.shapes['Basis']
    for fi, f in enumerate(b.faces):
        if b.face_regions[fi] != rid:
            continue
        for i in f:
            v = vs[i]
            if v.z < 1.30 or abs(v.x) > 0.16:
                continue
            k = int(neck_angle(ctx, v) / TAU * bins) % bins
            top[k] = max(top[k], v.z)
    base = min(t for t in top if t > 0)
    top = [t if t > 0 else base for t in top]
    sm = [max(top[(k + d) % bins] for d in (-1, 0, 1)) for k in range(bins)]
    sm = [0.25 * sm[(k - 1) % bins] + 0.5 * sm[k] + 0.25 * sm[(k + 1) % bins] for k in range(bins)]
    sm = [max(s, t) + margin for s, t in zip(sm, top)]

    def z(th):
        x = th / TAU * bins - 0.5
        k0 = int(math.floor(x)) % bins
        f = x - math.floor(x)
        return lerp(sm[k0], sm[(k0 + 1) % bins], f) + raise_front * max(0.0, math.cos(th)) ** 2
    return z


def robe_torso(ctx, name, *, offset, slot, sleeve_t, bottom_z=0.80, ratio=0.3, seams=(), neck_margin=0.007):
    """The robe's body: neck base, chest, belly, upper arms and sleeves down to `sleeve_t` of the forearm (0 at the
    elbow), down to bottom_z through the hips (under the skirt). The neckline follows the chest region's top edge, so
    the chest is always covered. Returns (piece, hides)."""
    regions = ['neck', 'chest', 'belly', 'upperArms', 'forearms', 'thighs']
    p, _ = gl.shell(ctx.bodies, regions, offset, slot, name=name)
    nz = neckline(ctx, neck_margin)
    ctx.neck_z = nz
    clip(p, ctx, fn=lambda P: nz(neck_angle(ctx, P)) - P.z, regions=['neck', 'chest'], at_body=True)
    gl.cut(p, ctx.bodies, (0, 0, bottom_z), (0, 0, 1), keep='front', regions=['thighs', 'belly'])
    for side in (1, -1):
        # a plane runs forever: limit each arm's cut to that arm's side, or it deletes the other forearm
        sh, el, wr, tip = arm_points(ctx, side)
        pt = el.lerp(wr, sleeve_t)
        clip(p, ctx, pt, (el - wr).normalized(), keep='front', regions=['forearms', 'hands'],
             face_filter=lambda c, side=side: c.x * side > 0)
    hides = [r for r in ('chest', 'belly', 'upperArms') if covered(p, ctx, r) == 0]
    missing = {r: covered(p, ctx, r) for r in ('chest', 'belly', 'upperArms')}
    log('%s coverage (faces not covered): %s' % (name, missing))
    low = low_shell(p, ctx, ratio, seams=seams, name=name)
    return low, hides


def leggings(ctx, name, *, offset, slot, waist_z=1.045, ratio=0.17):
    p, _ = gl.shell(ctx.bodies, ['belly', 'thighs', 'shins'], offset, slot, name=name)
    gl.cut(p, ctx.bodies, (0, 0, waist_z), (0, 0, 1), keep='back', regions=['belly'])
    hides = [r for r in ('thighs', 'shins') if covered(p, ctx, r) == 0]
    log('%s coverage: thighs %d shins %d' % (name, covered(p, ctx, 'thighs'), covered(p, ctx, 'shins')))
    return low_shell(p, ctx, ratio, name=name), hides


def gloves(ctx, name, *, offset, slot, cuff_t, ratio=0.2, seams_fn=None):
    """Hands and the forearm up to cuff_t of its length from the wrist."""
    p, _ = gl.shell(ctx.bodies, ['hands', 'forearms'], offset, slot, name=name)
    for side in (1, -1):
        sh, el, wr, tip = arm_points(ctx, side)
        pt = wr.lerp(el, cuff_t)
        clip(p, ctx, pt, (wr - el).normalized(), keep='front', regions=['forearms'],
             face_filter=lambda c, side=side: c.x * side > 0)
    hides = ['hands'] if covered(p, ctx, 'hands') == 0 else []
    log('%s coverage: hands %d' % (name, covered(p, ctx, 'hands')))
    seams = seams_fn(ctx) if seams_fn else ()
    return low_shell(p, ctx, ratio, seams=seams, name=name), hides


def to_bound(piece, ctx, move=None):
    """Every vertex of a shell turned into a bound point (bound to a triangle under its own body vertex) so it can be
    sculpted: move(P) -> new P (e.g. a pointed toe). The bound point keeps the weights of that spot of the body."""
    pos = positions(piece, ctx)
    out = gl.Piece(piece.name)
    out._smap = ctx.smap
    for s, P in zip(piece.src, pos):
        vi = s[1]
        cands = ctx.tri_by_vertex(vi)
        best, bd = None, 1e9
        for ti in cands:
            d = (ctx.tri_center[ti] - P).length
            if d < bd:
                best, bd = ti, d
        Q = move(P) if move else P
        out.src.append(('bind', best, Q, 0.0))
    out.faces = list(piece.faces)
    out.slots = list(piece.slots)
    return out


def sphere_dir(alpha, theta):
    return Vector((math.sin(alpha) * math.sin(theta), -math.sin(alpha) * math.cos(theta), math.cos(alpha)))


def alpha_for_z(ctx, O, theta, z, regions, lo=0.05, hi=2.6):
    """The polar angle (from straight up, about O) whose outermost ray hit lies at height z (bisection)."""
    for _ in range(28):
        mid = 0.5 * (lo + hi)
        hit = ctx.outermost(O, sphere_dir(mid, theta), 0.7, regions=regions)
        hz = hit[1].z if hit else O.z
        if hz > z:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def cap_rows(ctx, name, *, center, alpha_top, alpha_bot, rows, cols, off, slot, regions, slot_fn=None,
             extra_alpha=None, arc=None):
    """Rows of a cape-let or mantle laid over the shoulders: each point is where a ray from the centre (inside the
    upper chest) at polar angle alpha and azimuth theta leaves the body, pushed off(k) along the body's normal. Rows
    are spread evenly in alpha between alpha_top(theta) and alpha_bot(theta), so they follow the shoulder's curve
    (horizontal slices leave the nearly flat shoulder top between two rows, and the robe under it pokes through)."""
    p = gl.Piece(name)
    p._smap = ctx.smap
    O = Vector(center)
    if arc:
        thetas = [arc[0] + (arc[1] - arc[0]) * j / (cols - 1) for j in range(cols)]
    else:
        thetas = [TAU * j / cols for j in range(cols)]
    tops = [alpha_top(th) for th in thetas]
    bots = [alpha_bot(th) for th in thetas]
    idx = []
    for k in range(rows):
        row = []
        for j, th in enumerate(thetas):
            a = lerp(tops[j], bots[j], k / (rows - 1))
            if extra_alpha and k == rows - 1:
                a += extra_alpha(j, th)
            d = sphere_dir(a, th)
            hit = ctx.outermost(O, d, 0.7, regions=regions)
            if hit is None:
                row.append(bind_nearest(p, ctx, O + d * 0.2, regions=regions))
                continue
            n = ctx.normal_at(hit[0], hit[1])
            if n.dot(d) < 0.2:
                n = (n + d).normalized()
            P = hit[1] + n * (off(k) if callable(off) else off)
            row.append(bind_at(p, ctx, P, hit[0]))
        idx.append(row)
    grid_faces(p, idx, slot, closed=not arc, slot_fn=slot_fn)
    orient(p, ctx, lambda c: c - O)
    return p, idx, thetas


# ------------------------------------------------------------------ the robe skirt
class Skirt:
    """A robe skirt in two halves (character's left θ in [0°, 180°], right in [180°, 360°]). Rows run from z_top down to
    hem(θ); the radius at each point is max(shape(θ, t), legs' support + clearance(z)), smoothed around. Above the slit
    heights the halves share their centre columns; below, the centre columns are doubled and each copy rides its own
    leg. Every point is bound to the triangle a ray toward its leg's bone line meets (toward the body's centre above
    `crotch`), so it carries that triangle's weights."""

    def __init__(self, ctx, *, z_top, hem, shape, clearance, cols=28, rows=9, slit_front=0.78, slit_back=0.86,
                 notch=0.0, crotch=0.845, t_power=1.0, feather=0.0, feather_every=2):
        self.ctx = ctx
        self.cols, self.rows = cols, rows
        self.z_top, self.hem, self.shape, self.clearance = z_top, hem, shape, clearance
        self.slit_front, self.slit_back, self.notch, self.crotch = slit_front, slit_back, notch, crotch
        self.t_power = t_power
        self.thetas = [TAU * j / cols for j in range(cols)]
        self.ts = [(k / (rows - 1)) ** t_power for k in range(rows)]
        self.feather, self.feather_every = feather, feather_every
        # radius table r[k][j] and heights z[k][j]
        self.z = [[self.z_at(th, t) for th in self.thetas] for t in self.ts]
        raw = []
        for k, t in enumerate(self.ts):
            row = []
            for j, th in enumerate(self.thetas):
                z = self.z[k][j]
                yc = self.yc(z)
                sup = ctx.support(th, z, yc)
                row.append((max(shape(th, t, z), sup + clearance(z)), sup))
            raw.append(row)
        self.r = []
        for k in range(rows):
            row = []
            for j in range(cols):
                rs = [raw[k][(j + dj) % cols][0] for dj in (-1, 0, 1)]
                sm = 0.25 * rs[0] + 0.5 * rs[1] + 0.25 * rs[2]
                row.append(max(sm, raw[k][j][1] + 0.75 * clearance(self.z[k][j])))
            self.r.append(row)
        # never narrower lower down than the ring above, below the hips (cloth falls, it does not tuck in)
        for k in range(1, rows):
            for j in range(cols):
                if self.z[k][j] < 0.86:
                    self.r[k][j] = max(self.r[k][j], self.r[k - 1][j] * 0.985)

    def yc(self, z):
        return self.ctx.slab_center_y(min(z, 1.0))

    def z_at(self, th, t):
        return self.z_top + (self.hem(th) - self.z_top) * t

    def radius(self, th, z):
        """The skirt's radius at angle th (any) and height z, interpolated from the table."""
        j0 = int(math.floor(th / TAU * self.cols)) % self.cols
        j1 = (j0 + 1) % self.cols
        fj = (th / TAU * self.cols) - math.floor(th / TAU * self.cols)
        out = []
        for j in (j0, j1):
            zs = [self.z[k][j] for k in range(self.rows)]
            if z >= zs[0]:
                out.append(self.r[0][j])
                continue
            if z <= zs[-1]:
                out.append(self.r[-1][j])
                continue
            for k in range(self.rows - 1):
                if zs[k] >= z >= zs[k + 1]:
                    f = (zs[k] - z) / max(1e-6, zs[k] - zs[k + 1])
                    out.append(lerp(self.r[k][j], self.r[k + 1][j], f))
                    break
        return lerp(out[0], out[1], fj)

    def point(self, th, z, extra=0.0):
        return Vector((0.0, self.yc(z), z)) + u(th) * (self.radius(th, z) + extra)

    def bind(self, piece, P, z, side):
        ctx = self.ctx
        if side == 0 or z > self.crotch:
            tgt = Vector((0.0, self.yc(z), z))
            return bind_toward(piece, ctx, P, tgt, regions=('belly', 'thighs', 'chest'), zmin=z - 0.12, zmax=z + 0.12)
        tgt = ctx.leg_axis(side, z)
        return bind_toward(piece, ctx, P, tgt, regions=('thighs', 'shins', 'feet'), side=side,
                           zmin=z - 0.14, zmax=z + 0.14)

    def build(self, name, slot, slot_fn=None, extra=0.0):
        """The skirt surface as a Piece (extra pushes it out, for a second layer over the first)."""
        ctx = self.ctx
        p = gl.Piece(name)
        p._smap = ctx.smap
        cols, rows, half = self.cols, self.rows, self.cols // 2
        shared, copies = {}, {}
        for k in range(rows):
            for j in range(cols):
                z = self.z[k][j]
                if k == rows - 1 and self.feather and (j % self.feather_every) == 1:
                    z -= self.feather
                P = Vector((0.0, self.yc(self.z[k][j]), z)) + u(self.thetas[j]) * (self.r[k][j] + extra)
                centre = j in (0, half)
                split = centre and ((j == 0 and self.z[k][j] < self.slit_front) or (j == half and self.z[k][j] < self.slit_back))
                if split:
                    for s in (1, -1):
                        Q = P.copy()
                        if j == half and self.notch:
                            w = smoothstep(self.slit_back - 0.16, self.slit_back - 0.02, self.z[k][j]) * \
                                (1.0 - smoothstep(self.slit_back - 0.02, self.slit_back, self.z[k][j]))
                            Q.x += s * self.notch * w
                        copies[(k, j, s)] = self.bind(p, Q, self.z[k][j], s)
                else:
                    side = 0 if centre else (1 if j < half else -1)
                    shared[(k, j)] = self.bind(p, P, self.z[k][j], side)

        def v(k, j, s):
            return copies.get((k, j, s), shared.get((k, j)))

        for k in range(rows - 1):
            for j in range(cols):
                jn = (j + 1) % cols
                s = 1 if j < half else -1
                q = (v(k, j, s), v(k + 1, j, s), v(k + 1, jn, s), v(k, jn, s))
                p.add_face(q, slot_fn(k, j) if slot_fn else slot)
        orient(p, ctx, lambda c: Vector((c.x, c.y - self.yc(c.z), 0.0)))
        self.last_shared, self.last_copies = shared, copies
        return p

    def hem_loop_rows(self):
        return self.rows - 1


# ------------------------------------------------------------------ the hood
def chin_height(ctx):
    """The lowest point of the head near the front centre line (the chin)."""
    C = ctx.head_center()
    hv = ctx.V[ctx.vregion == REG['head']]
    fr = hv[(np.abs(hv[:, 0]) < 0.02) & (hv[:, 1] < C.y - 0.05)]
    return float(fr[:, 2].min()) if len(fr) else C.z - 0.13


def hood(ctx, name, *, cols=24, dome_rows=6, upper_rings=3, drape_rows=3, base_off=0.022, peak=0.0, peak_at=(65, 180),
         peak_w=(20, 34), crown=0.0, fall_from=72.0, gather_z=1.462, gather_r=0.118, bottom=None, drape_off=0.032,
         open_point=(0.0, -0.035, 1.50), open_tilt=0.36, sill_below=0.012, throat_off=0.026, slot=None,
         slot_fn=None):
    """A hood (Ascend's lesson: rows that hug and gather, not slabs). Dome rows from near the crown to the head's
    equator (rays from the head centre; the cloth sits base_off off the skull, plus a peak bump at the back), then rings
    that fall from the head's widest line at the sides and back but hug the chin and throat at the front, gather at the
    neck (radius >= gather_r about the neck axis) and drape onto the shoulders down to bottom(θ), drape_off along the
    body's normal. The face opening is cut by a plane leaning forward at the top, above a sill ring just under the
    chin, so the whole face shows and the throat stays covered."""
    p = gl.Piece(name)
    p._smap = ctx.smap
    C = ctx.head_center()
    thetas = [TAU * j / cols for j in range(cols)]
    sill = chin_height(ctx) - sill_below
    gather_z = min(gather_z, sill - 0.035)
    rows_pts = []
    a0 = math.radians(16)
    for i in range(dome_rows):
        a = a0 + (math.radians(90) - a0) * i / (dome_rows - 1)
        row = []
        for th in thetas:
            d = Vector((math.sin(a) * math.sin(th), -math.sin(a) * math.cos(th), math.cos(a)))
            hit = ctx.outermost(C, d, 0.4, regions=('head',))
            rho = hit[2] if hit else 0.1
            off = base_off
            if peak:
                da = (math.degrees(a) - peak_at[0]) / peak_w[0]
                dth = (((math.degrees(th) - peak_at[1]) + 180) % 360 - 180) / peak_w[1]
                off += peak * math.exp(-da * da) * math.exp(-dth * dth)
            if crown:
                off += crown * math.exp(-((math.degrees(a) - 10) / 30.0) ** 2)
            row.append(C + d * (rho + off))
        rows_pts.append(row)
    # the fall: below fall_from the horizontal radius never shrinks under the radius at fall_from
    fall_i = min(range(dome_rows), key=lambda i: abs((16 + (90 - 16) * i / (dome_rows - 1)) - fall_from))
    rmin = [Vector((P.x - C.x, P.y - C.y, 0)).length for P in rows_pts[fall_i]]
    for i in range(fall_i + 1, dome_rows):
        for j, P in enumerate(rows_pts[i]):
            h = Vector((P.x - C.x, P.y - C.y, 0))
            if h.length < rmin[j]:
                h = h.normalized() * rmin[j]
                rows_pts[i][j] = Vector((C.x + h.x, C.y + h.y, P.z))
    eq = rows_pts[-1]
    r_eq = [Vector((P.x - C.x, P.y - C.y, 0)).length for P in eq]
    # rings below the equator, one of them on the sill
    fs = (C.z - sill) / max(1e-6, C.z - gather_z)
    fracs = [fs * (m + 1) / (upper_rings - 1) for m in range(upper_rings - 1)] + [1.0]
    ring_z = [C.z - (C.z - gather_z) * f for f in fracs]
    for m, (z, s) in enumerate(zip(ring_z, fracs)):
        yc = ctx.spine_y(z)
        row = []
        for j, th in enumerate(thetas):
            o = Vector((0.0, yc, z))
            hit = ctx.outermost(o, u(th), 0.4, regions=('head', 'neck'), zmin=z - 0.05, zmax=z + 0.05)
            rho = hit[2] if hit else 0.06
            r_fall = lerp(r_eq[j], max(gather_r, rho + 0.03), smoothstep(0.0, 1.0, s))
            thw = abs(((th + math.pi) % TAU) - math.pi)
            w_front = 1.0 - smoothstep(0.55, 1.35, thw)
            r = max(rho + 0.02, lerp(r_fall, rho + throat_off, w_front))
            row.append(Vector((0.0, lerp(C.y, yc, s), z)) + u(th) * r)
        rows_pts.append(row)
    # drape: rows laid by rays from inside the upper chest (they follow the shoulder's curve, see cap_rows), from the
    # gather ring down to bottom(θ), drape_off along the body's normal, never narrower than the row above
    bottom = bottom or (lambda th: 1.42)
    cz = ctx.joint('UpperChest').z + 0.02
    O = Vector((0.0, ctx.spine_y(cz), cz))
    reg_d = ('neck', 'chest', 'upperArms')
    last = rows_pts[-1]
    a_g = [math.atan2(Vector((P.x - O.x, P.y - O.y, 0)).length, P.z - O.z) for P in last]
    a_b = [alpha_for_z(ctx, O, th, bottom(th), reg_d) for th in thetas]
    for m in range(drape_rows):
        s = (m + 1) / drape_rows
        row = []
        for j, th in enumerate(thetas):
            d = sphere_dir(lerp(a_g[j], a_b[j], s), th)
            hit = ctx.outermost(O, d, 0.7, regions=reg_d)
            if hit is None:
                P = O + d * 0.2
            else:
                n = ctx.normal_at(hit[0], hit[1])
                if n.dot(d) < 0.2:
                    n = (n + d).normalized()
                P = hit[1] + n * drape_off
            ax = Vector((0.0, ctx.spine_y(P.z), 0.0))
            hl = Vector((last[j].x, last[j].y - ctx.spine_y(last[j].z), 0)).length
            hp = Vector((P.x - ax.x, P.y - ax.y, 0))
            if hp.length < hl:
                hp = hp.normalized() * hl
                P = Vector((ax.x + hp.x, ax.y + hp.y, P.z))
            row.append(P)
        rows_pts.append(row)
        last = row
    hit = ctx.outermost(C, Vector((0, 0, 1)), 0.4, regions=('head',))
    pole_P = C + Vector((0, 0, 1)) * ((hit[2] if hit else 0.14) + base_off + crown)
    idx = []
    pole = bind_toward(p, ctx, pole_P, C, regions=('head',))
    for i, row in enumerate(rows_pts):
        ids = []
        for j, P in enumerate(row):
            if i < dome_rows:
                ids.append(bind_toward(p, ctx, P, C, regions=('head',)))
            else:
                tgt = Vector((0.0, ctx.spine_y(P.z), P.z))
                ids.append(bind_toward(p, ctx, P, tgt, regions=('head', 'neck', 'chest', 'upperArms'),
                                       zmin=P.z - 0.08, zmax=P.z + 0.08))
        idx.append(ids)
    for j in range(cols):
        p.add_face((pole, idx[0][j], idx[0][(j + 1) % cols]), slot)
    grid_faces(p, idx, slot, closed=True, slot_fn=slot_fn)
    orient(p, ctx, lambda c: (c - C) if c.z > gather_z else Vector((c.x, c.y - ctx.spine_y(c.z), 0.0)))
    n = Vector((0.0, -1.0, -open_tilt)).normalized()
    clip(p, ctx, open_point, n, keep='back', face_filter=lambda cc: cc.z > sill + 0.004 and cc.y < 0.02)
    compact(p)
    p._sill = sill
    return p


# ------------------------------------------------------------------ shoes and boots (lofted along the foot)
def foot_axis(ctx, side):
    pre = 'Left' if side > 0 else 'Right'
    ank = ctx.joint(pre + 'Foot')
    toe = ctx.joint(pre + 'Toes', 'tail')
    a = Vector((toe.x - ank.x, toe.y - ank.y, 0.0)).normalized()
    lat = Vector((-a.y, a.x, 0.0))
    if lat.x * side < 0:
        lat = -lat
    A0 = Vector((ank.x, ank.y, 0.0))
    m = (ctx.vregion == REG['feet']) & (ctx.V[:, 0] * side > 0)
    F = ctx.V[m]
    s = (F[:, 0] - A0.x) * a.x + (F[:, 1] - A0.y) * a.y
    return A0, a, lat, F, s


def shoe(ctx, name, side, *, offset=0.012, stations=(0.0, 0.1, 0.26, 0.45, 0.63, 0.8, 0.93, 1.0), cols=10,
         toe=0.0, curl=0.0, slot, n_exp=2.6, widen=1.04, collar=0.0):
    """A chunky shoe lofted along one foot: rings across the foot from the heel to past the toes, each a rounded box
    fitted to the foot's width and height in a slab at that station plus `offset` (so the toes merge into one cap and
    the feet read big). toe extends a point past the toes, curl lifts it; collar raises the rings behind the ankle.
    Each ring binds toward its own centre on the foot (Foot/Toes weights)."""
    p = gl.Piece(name)
    p._smap = ctx.smap
    A0, a, lat, F, s = foot_axis(ctx, side)
    s0, s1 = float(s.min()), float(s.max())
    up = Vector((0, 0, 1))
    zfloor = float(F[:, 2].min()) - 0.002
    rings_, centres = [], []
    sts = list(stations)
    if toe > 0:
        sts.append(1.0 + toe / (s1 - s0))
    for k, f in enumerate(sts):
        sk = s0 + (s1 - s0) * min(f, 1.0)
        slab = F[np.abs(s - sk) < 0.016]
        if len(slab) < 3:
            slab = F[np.argsort(np.abs(s - sk))[:12]]
        latv = (slab[:, 0] - A0.x) * lat.x + (slab[:, 1] - A0.y) * lat.y
        lo, hi = float(latv.min()), float(latv.max())
        ztop = float(slab[:, 2].max())
        cl = 0.5 * (lo + hi)
        hw = 0.5 * (hi - lo) * widen + offset
        if f <= 0.12 and collar:
            ztop += collar
        hh = 0.5 * (ztop - zfloor) + offset * 0.75
        cz = zfloor + hh - offset * 0.25
        sk_eff = s0 + (s1 - s0) * f
        if f > 1.0:
            t = (f - 1.0) / max(1e-6, sts[-1] - 1.0)
            hw *= 0.42
            hh *= 0.5
            cz += curl * t
        base = A0 + a * sk_eff
        ctr = base + lat * cl + up * cz
        ring = []
        for j in range(cols):
            ph = TAU * j / cols
            sx = math.sin(ph)
            cz_ = math.cos(ph)
            lx = math.copysign(abs(sx) ** (2.0 / n_exp), sx) * hw
            lz = math.copysign(abs(cz_) ** (2.0 / n_exp), cz_) * hh
            P = ctr + lat * lx + up * lz
            if P.z < zfloor - 0.004:
                P.z = zfloor - 0.004
            ring.append(P)
        rings_.append(ring)
        centres.append(ctr)
    idx = []
    for ring, ctr in zip(rings_, centres):
        idx.append([bind_toward(p, ctx, P, ctr, regions=('feet', 'shins'), side=side) for P in ring])
    grid_faces(p, idx, slot, closed=True)
    heel = centres[0] - a * 0.008
    toe_tip = centres[-1] + a * (0.006 + (0.01 if toe > 0 else 0.0))
    hv = bind_toward(p, ctx, heel, centres[0], regions=('feet',), side=side)
    tv = bind_nearest(p, ctx, toe_tip, regions=('feet',), side=side)
    for j in range(cols):
        j2 = (j + 1) % cols
        p.add_face((hv, idx[0][j2], idx[0][j]), slot)
        p.add_face((tv, idx[-1][j], idx[-1][j2]), slot)
    mid = sum(centres, Vector((0, 0, 0))) / len(centres)
    orient(p, ctx, lambda c: c - (A0 + a * (c - A0).dot(a) + up * mid.z))
    p._foot = (A0, a, lat, s0, s1, zfloor)
    return p


def shaft(ctx, name, side, *, z0, z1, offset, slot, rows=3, cols=10, flare=0.0, slot_fn=None):
    """A boot shaft: rings around the shin from z0 up to z1, `offset` off the leg (flare added toward the top)."""
    pre = 'Left' if side > 0 else 'Right'
    ank, knee = ctx.joint(pre + 'Foot'), ctx.joint(pre + 'LowerLeg')

    def t(z):
        return (z - ank.z) / (knee.z - ank.z)
    levels = []
    for k in range(rows):
        z = lerp(z0, z1, k / (rows - 1))
        fl = flare * (k / (rows - 1)) ** 2
        levels.append((t(z), (lambda ph, rho, fl=fl: rho + offset + fl)))
    return tube(ctx, name, a=ank, b=knee, levels=levels, cols=cols, slot=slot, regions=('shins', 'feet'),
                side=side, slot_fn=slot_fn)


# ------------------------------------------------------------------ rims on chosen loops
def loops_where(piece, ctx, fn):
    """Boundary loops whose mean position satisfies fn(mean, loop_positions)."""
    pos = positions(piece, ctx)
    out = []
    for lp in gl.boundary_loops(piece):
        pts = [pos[i] for i in lp]
        if len(pts) < 3:
            continue
        m = sum(pts, Vector((0, 0, 0))) / len(pts)
        if fn(m, pts):
            out.append(lp)
    return out


def rim(piece, ctx, extra, slot, where=None, loops=None):
    """gear_lib.add_rim on the loops chosen by where(mean, pts) (all boundary loops when None)."""
    lps = loops if loops is not None else (loops_where(piece, ctx, where) if where else None)
    if lps is not None and not lps:
        return piece
    return gl.add_rim(piece, extra, slot, loops=lps)


# ------------------------------------------------------------------ flat shapes laid on the body (patches, emblems)
def surface_frame(ctx, hint, direction, regions=None, up=Vector((0, 0, 1))):
    """The body surface point seen from `hint` + direction (a ray coming back along -direction), its normal and a
    tangent frame (e1 up the surface, e2 across)."""
    d = Vector(direction).normalized()
    hit = ctx.ray(Vector(hint) + d * 0.4, -d, 0.8, regions=regions)
    if hit is None:
        hit = ctx.nearest(hint, regions=regions)
    n = ctx.normal_at(hit[0], hit[1])
    e1 = (up - n * up.dot(n)).normalized()
    e2 = n.cross(e1).normalized()
    return hit[1], n, e1, e2


def surface_shape(ctx, name, hint, direction, verts2d, faces, slots, off, regions=None, lift=None):
    """A flat 2-D shape (x across, y up) laid on the body around the surface point seen from hint+direction: each
    vertex projected onto the body along the local normal and lifted `off` (+ lift[i]) off it; bound to the triangle
    under it, so it bends with the body (a patch on a robe, a sunburst on a chest)."""
    S, n, e1, e2 = surface_frame(ctx, hint, direction, regions)
    p = gl.Piece(name)
    p._smap = ctx.smap
    for i, (x, y) in enumerate(verts2d):
        Q = S + e2 * x + e1 * y
        hit = ctx.ray(Q + n * 0.15, -n, 0.4, regions=regions) or ctx.nearest(Q, regions=regions)
        nq = ctx.normal_at(hit[0], hit[1])
        P = hit[1] + nq * (off + (lift[i] if lift else 0.0))
        bind_at(p, ctx, P, hit[0])
    for f, s in zip(faces, slots):
        p.add_face(f, s)
    orient(p, ctx, lambda c: n)
    return p


def rect2d(w, h, cols=2, rows=2):
    vs = [(-w / 2 + w * i / cols, -h / 2 + h * j / rows) for j in range(rows + 1) for i in range(cols + 1)]
    fs = []
    for j in range(rows):
        for i in range(cols):
            a = j * (cols + 1) + i
            fs.append((a, a + 1, a + cols + 2, a + cols + 1))
    return vs, fs


def sun2d(r, rays=12, ray_len=0.5, ray_w=0.32, segs=12):
    """A sunburst: a disc of `segs` segments and `rays` pointed rays (alternate long/short). Returns verts, faces,
    kinds ('disc'/'ray')."""
    vs, fs, kinds = [(0.0, 0.0)], [], []
    for k in range(segs):
        a = TAU * k / segs
        vs.append((r * math.cos(a), r * math.sin(a)))
    for k in range(segs):
        fs.append((0, 1 + k, 1 + (k + 1) % segs))
        kinds.append('disc')
    for k in range(rays):
        a = TAU * (k + 0.5) / rays + math.pi / 2
        L = r * ray_len * (1.0 if k % 2 == 0 else 0.6)
        w = r * ray_w * (1.0 if k % 2 == 0 else 0.75)
        cx, cy = math.cos(a), math.sin(a)
        sx, sy = -cy, cx
        i0 = len(vs)
        vs += [(cx * r * 0.9 + sx * w, cy * r * 0.9 + sy * w), (cx * (r + L), cy * (r + L)),
               (cx * r * 0.9 - sx * w, cy * r * 0.9 - sy * w)]
        fs.append((i0, i0 + 1, i0 + 2))
        kinds.append('ray')
    return vs, fs, kinds


# ------------------------------------------------------------------ small solids bound to the body
def solid(ctx, name, verts, faces, slots, bind_point=None, **filt):
    """Free geometry (a gem, a buckle, an emblem): every vertex bound to the triangle nearest to bind_point (default:
    nearest to itself), so a small rigid thing moves with one spot of the body."""
    p = gl.Piece(name)
    p._smap = ctx.smap
    ti = ctx.nearest(bind_point, **filt)[0] if bind_point is not None else None
    for v in verts:
        if ti is None:
            bind_nearest(p, ctx, v, **filt)
        else:
            bind_at(p, ctx, v, ti)
    for f, s in zip(faces, slots):
        p.add_face(f, s)
    return p


def bipyramid(center, radius, h_up, h_down, n=6, roll=0.0):
    c = Vector(center)
    verts = [c + Vector((0, 0, h_up)), c - Vector((0, 0, h_down))]
    for k in range(n):
        a = roll + TAU * k / n
        verts.append(c + Vector((math.cos(a) * radius, math.sin(a) * radius, 0)))
    faces = []
    for k in range(n):
        a, b = 2 + k, 2 + (k + 1) % n
        faces.append((0, a, b))
        faces.append((1, b, a))
    return verts, faces


def disc(center, normal, radius, n=12, rays=0, ray_len=0.0, ray_w=0.35, depth=0.004, up=Vector((0, 0, 1))):
    """A flat disc (+ optional sunburst rays) facing `normal`: returns verts, faces, face kinds ('disc'/'ray'/'side')."""
    c = Vector(center)
    nn = Vector(normal).normalized()
    e1 = (up - nn * up.dot(nn)).normalized()
    e2 = nn.cross(e1).normalized()
    verts, faces, kinds = [c + nn * depth], [], []
    for k in range(n):
        a = TAU * k / n
        verts.append(c + (e1 * math.cos(a) + e2 * math.sin(a)) * radius + nn * depth)
    for k in range(n):
        faces.append((0, 1 + k, 1 + (k + 1) % n))
        kinds.append('disc')
    if rays:
        for k in range(rays):
            a = TAU * (k + 0.5) / rays
            dirv = e1 * math.cos(a) + e2 * math.sin(a)
            side = e1 * math.cos(a + math.pi / 2) + e2 * math.sin(a + math.pi / 2)
            base = c + dirv * radius * 0.92
            w = radius * ray_w * (1.0 if k % 2 == 0 else 0.75)
            L = ray_len * (1.0 if k % 2 == 0 else 0.62)
            i0 = len(verts)
            verts += [base + side * w + nn * depth * 0.6, c + dirv * (radius + L) + nn * depth * 0.6, base - side * w + nn * depth * 0.6]
            faces.append((i0, i0 + 1, i0 + 2))
            kinds.append('ray')
    return verts, faces, kinds


# ------------------------------------------------------------------ loose cloth on the other shapes
def idt_weights(ctx, P, regions, k=24):
    """Gaussian weights over the k body vertices of `regions` nearest to P (broad basis): a smooth neighbourhood."""
    found = ctx.body_kd(regions).find_n(Vector(P), k)
    d0 = found[0][2]
    sigma = max(0.03, d0 * 0.8)
    ws = [(i, math.exp(-(d * d - d0 * d0) / (2 * sigma * sigma))) for co, i, d in found]
    s = sum(w for _, w in ws) or 1.0
    return [(i, w / s) for i, w in ws], d0


def refit_loose(ob, piece, ctx, frame, near=0.008, far=0.035):
    """Loose cloth (bound points far off the body: a skirt hem, a flap, a bell sleeve) takes its slight-frame and
    species-key positions from the body's displacement averaged over a smooth neighbourhood (inverse-distance style)
    instead of from the one small triangle it is bound to, whose tilt would swing a point 10 cm away by centimetres.
    Points within `near` of the body keep the exact triangle transfer; between near and far the two are blended.
    Skin weights are untouched (they still come from the bound triangle)."""
    loose = getattr(piece, '_loose', None)
    if not loose:
        return 0
    body = ctx.bodies[frame]
    smap = piece._smap
    fb = body.shapes['Basis']
    bb = ctx.bodies['broad'].shapes['Basis']
    basis_f = [gl._position(piece, s, body, 'Basis', smap) for s in piece.src]
    kd = KDTree(len(basis_f))
    for i, p in enumerate(basis_f):
        kd.insert(p, i)
    kd.balance()
    me = ob.data
    src_of = [kd.find(v.co)[1] for v in me.vertices]
    groups = {}
    for si, spec in loose.items():
        if spec and spec[0] == 'rigid':
            groups.setdefault(spec[1], []).append(si)
    gw = {}
    for gid, members in groups.items():
        Pc = sum((src_pos(piece, piece.src[si], ctx) for si in members), Vector((0.0, 0.0, 0.0))) / len(members)
        gw[gid] = idt_weights(ctx, Pc, loose[members[0]][2])
    newpos = {}
    for si, spec in loose.items():
        s = piece.src[si]
        P = src_pos(piece, s, ctx)
        if spec and spec[0] == 'rigid':
            ws, d0 = gw[spec[1]]
            blend = 1.0
        else:
            ws, d0 = idt_weights(ctx, P, spec)
            blend = smoothstep(near, far, d0)
        if blend <= 0.0:
            continue
        if frame == 'broad':
            nb = basis_f[si]
        else:
            disp = Vector((0.0, 0.0, 0.0))
            for i, w in ws:
                disp += (fb[i] - bb[i]) * w
            nb = basis_f[si].lerp(P + disp, blend)
        keys = {}
        for key in body.species_keys:
            dk = Vector((0.0, 0.0, 0.0))
            ks = body.shapes[key]
            for i, w in ws:
                dk += (ks[i] - fb[i]) * w
            keys[key] = gl._position(piece, s, body, key, smap).lerp(nb + dk, blend)
        newpos[si] = (nb, keys)
    kb = me.shape_keys.key_blocks if me.shape_keys else None
    n = 0
    for v, si in zip(me.vertices, src_of):
        if si not in newpos:
            continue
        nb, keys = newpos[si]
        v.co = nb
        n += 1
        if kb:
            kb['Basis'].data[v.index].co = nb
            for key, pk in keys.items():
                kb[key].data[v.index].co = pk
    me.update()
    if n:
        # smooth normals again on the refitted shape, shared across the palette split (vertices of one source)
        acc = {}
        for poly in me.polygons:
            nrm = poly.normal * poly.area
            for vi in poly.vertices:
                si = src_of[vi]
                acc[si] = acc.get(si, Vector((0.0, 0.0, 0.0))) + nrm
        loop_n = []
        for lp in me.loops:
            v = acc.get(src_of[lp.vertex_index], Vector((0, 0, 1)))
            loop_n.append(v.normalized() if v.length > 1e-12 else Vector((0, 0, 1)))
        me.normals_split_custom_set(loop_n)
    return n


# ------------------------------------------------------------------ realize, props, tri counts
def realize_all(ctx, cls, pieces):
    """pieces: {(slot, tier): (Piece, hides)} → {frame: [objects]} named gear_<cls>_<slot>_<tier>.<frame>."""
    objs = {f: [] for f in FRAMES}
    for (slot, tier), (piece, hides) in sorted(pieces.items()):
        for f in FRAMES:
            name = 'gear_%s_%s_%s.%s' % (cls, slot, tier, f)
            old = bpy.data.objects.get(name)
            if old:
                bpy.data.objects.remove(old, do_unlink=True)
            props = {'slot': slot, 'tier': tier, 'class': cls, 'hides': list(hides)}
            ob = gl.realize(piece, ctx.bodies, f, name, props)
            if ob.data.shape_keys:
                for kb in ob.data.shape_keys.key_blocks:
                    kb.value = 0.0            # Blender 5.2 adds shape keys at 1.0: the human basis is what we review
            n = refit_loose(ob, piece, ctx, f)
            if n:
                log('refit %s: %d loose vertices' % (name, n))
            if slot == 'helmet':
                m = ear_pockets(ob, ctx, f)
                if m:
                    log('ear pockets %s: %d vertices' % (name, m))
            objs[f].append(ob)
    return objs


def tris_of(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def tri_table(objs):
    lines = ['| piece | tris | verts | hides |', '|---|---:|---:|---|']
    tot = {}
    for ob in sorted(objs, key=lambda o: o.name):
        n = tris_of(ob)
        tier = ob['tier']
        tot[tier] = tot.get(tier, 0) + n
        lines.append('| %s | %d | %d | %s |' % (ob.name, n, len(ob.data.vertices), ', '.join(ob['hides']) or '—'))
    for t in sorted(tot):
        lines.append('| **set %s** | **%d** | | |' % (t, tot[t]))
    return lines, tot


# ------------------------------------------------------------------ review: poses, body copies, renders
def mirrored(p):
    return riglib.mirrored(p)


def test_poses():
    P = {}
    P['idle'] = mirrored({'LeftUpperArm': (4, 0, -14), 'LeftLowerArm': (14, 0, 0), 'Spine': (2, 0, 0)})
    P['stride'] = {
        'LeftUpperLeg': (30, 0, 2), 'LeftLowerLeg': (-10, 0, 0), 'LeftFoot': (8, 0, 0),
        'RightUpperLeg': (-22, 0, -2), 'RightLowerLeg': (-28, 0, 0), 'RightFoot': (-12, 0, 0),
        'LeftUpperArm': (-22, 0, -14), 'LeftLowerArm': (20, 0, 0),
        'RightUpperArm': (26, 0, 14), 'RightLowerArm': (30, 0, 0), 'Hips.loc': (0, -0.03, 0)}
    P['run'] = {
        'Spine': (10, 0, 0), 'Chest': (4, 6, 0),
        'LeftUpperLeg': (52, 0, 2), 'LeftLowerLeg': (-70, 0, 0), 'LeftFoot': (10, 0, 0),
        'RightUpperLeg': (-28, 0, -2), 'RightLowerLeg': (-98, 0, 0), 'RightFoot': (-20, 0, 0),
        'LeftUpperArm': (-38, 0, -18), 'LeftLowerArm': (80, 0, 0),
        'RightUpperArm': (48, 0, 18), 'RightLowerArm': (88, 0, 0), 'Hips.loc': (0, -0.05, 0)}
    P['lunge'] = {
        'Spine': (14, 0, 0), 'Chest': (6, 0, 0),
        'LeftUpperLeg': (82, 0, 8), 'LeftLowerLeg': (-98, 0, 0), 'LeftFoot': (18, 0, 0),
        'RightUpperLeg': (-36, 0, -6), 'RightLowerLeg': (-22, 0, 0), 'RightFoot': (-10, 0, 0),
        'LeftUpperArm': (62, 0, -6), 'LeftLowerArm': (30, 0, 0),
        'RightUpperArm': (74, 0, 6), 'RightLowerArm': (24, 0, 0), 'Hips.loc': (0, -0.22, 0.04)}
    P['overhead'] = mirrored({'LeftUpperArm': (18, 0, 152), 'LeftLowerArm': (24, 0, 0), 'Chest': (-6, 0, 0)})
    P['heavy'] = {
        'Spine': (-4, -18, 0), 'Chest': (-8, -16, 0), 'Neck': (6, 14, 0),
        'LeftUpperArm': (132, 0, 32), 'LeftLowerArm': (62, 0, 0),
        'RightUpperArm': (142, 0, -18), 'RightLowerArm': (52, 0, 0),
        'LeftUpperLeg': (26, 0, 6), 'LeftLowerLeg': (-32, 0, 0),
        'RightUpperLeg': (-16, 0, -6), 'RightLowerLeg': (-12, 0, 0), 'Hips.loc': (0, -0.06, 0)}
    P['crouch'] = mirrored({'LeftUpperLeg': (78, 0, 10), 'LeftLowerLeg': (-112, 0, 0), 'LeftFoot': (30, 0, 0),
                            'LeftUpperArm': (40, 0, -8), 'LeftLowerArm': (40, 0, 0)})
    P['crouch'].update({'Spine': (24, 0, 0), 'Chest': (8, 0, 0), 'Neck': (-18, 0, 0), 'Hips.loc': (0, -0.34, -0.06)})
    return P


def pose_rigs(pose):
    for f in FRAMES:
        rg = bpy.data.objects['Rig_' + f]
        riglib.key_pose(rg, 1, pose)
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()


def clear_poses():
    for f in FRAMES:
        rg = bpy.data.objects['Rig_' + f]
        if rg.animation_data:
            rg.animation_data_clear()
        riglib.rest_pose(rg)
    for act in list(bpy.data.actions):
        if act.users == 0 or not act.use_fake_user:
            bpy.data.actions.remove(act)
    bpy.context.view_layer.update()


def body_view(ctx, frame, hidden, cache):
    """A render copy of Body_<frame> with the faces of the hidden regions removed (what the client draws)."""
    key = (frame, tuple(sorted(hidden)))
    if key in cache:
        return cache[key]
    src = bpy.data.objects['Body_' + frame]
    ob = src.copy()
    ob.data = src.data.copy()
    ob.name = 'Review_Body_%s_%d' % (frame, len(cache))
    collection('Review').objects.link(ob)
    ids = {REG[r] for r in hidden}
    regions = ctx.bodies[frame].face_regions
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.faces.ensure_lookup_table()
    kill = [bm.faces[i] for i in range(len(bm.faces)) if regions[i] in ids]
    if kill:
        bmesh.ops.delete(bm, geom=kill, context='FACES_ONLY')
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    toon.apply_look(ob, outline=0.004)
    cache[key] = ob
    return ob


def outline_copy(ob, width=0.004):
    """The review outline drawn the way the client draws it (client/src/scene/characters/material.ts: the back faces
    of the mesh pushed out along its normals): a copy with its faces reversed, pushed `width` along the original
    normals after skinning, in the culled outline material. Unlike a Solidify shell, a lining's copy goes behind the
    lining and a folded lip stays put, so the renders show what the game will."""
    cp = ob.copy()
    cp.data = ob.data.copy()
    cp.name = 'Review_OL_' + ob.name
    collection('Review').objects.link(cp)
    for m in list(cp.modifiers):
        if m.type != 'ARMATURE':
            cp.modifiers.remove(m)
    bm = bmesh.new()
    bm.from_mesh(cp.data)
    bmesh.ops.reverse_faces(bm, faces=bm.faces[:], flip_multires=False)
    bm.to_mesh(cp.data)
    bm.free()
    cp.data.materials.clear()
    cp.data.materials.append(toon.outline_material())
    d = cp.modifiers.new('OL', 'DISPLACE')
    d.direction = 'NORMAL'
    d.mid_level = 0.0
    d.strength = -width          # the copy's normals face inward: a negative push moves it out along the original's
    return cp


def show_only(objs):
    keep = set(o.name for o in objs)
    for o in bpy.data.objects:
        if o.type == 'MESH' and not o.name.startswith('GV_'):
            o.hide_render = o.name not in keep


class Review:
    """The render set for one class: sets (F, S, mixed) on both frames, the gear sheet, the test poses, species."""

    def __init__(self, ctx, cls, objs, palettes, out_dir, quick=False):
        from render import Stage
        self.ctx, self.cls, self.objs, self.palettes, self.out = ctx, cls, objs, palettes, out_dir
        self.quick = quick
        os.makedirs(out_dir, exist_ok=True)
        self.st = Stage(out_dir, size=640 if quick else 1024, quick=quick)
        self.cache = {}
        self.ol = {}
        for o in list(bpy.data.objects):
            if o.type == 'MESH' and o.name.startswith('gear_'):
                toon.apply_look(o, outline=0)
                self.ol[o.name] = outline_copy(o)
        self.H = {'broad': 1.86, 'slight': 1.68}

    def pieces(self, frame, tiers):
        """tiers: {slot: tier} → the objects of that frame."""
        out = []
        for o in self.objs[frame]:
            if tiers.get(o['slot']) == o['tier']:
                out.append(o)
        return out

    def dress(self, frame, tiers, palette_tier=None):
        ps = self.pieces(frame, tiers)
        hidden = set()
        for o in ps:
            hidden |= set(o['hides'])
        body = body_view(self.ctx, frame, hidden, self.cache)
        show_only(ps + [self.ol[o.name] for o in ps if o.name in self.ol] + [body])
        self.palette(palette_tier or list(tiers.values())[0])
        return ps, body

    def palette(self, tier):
        m = toon.palette_material(self.palettes[tier])
        # the client draws the hero front faces only (client/src/scene/characters/material.ts): so does the review
        m.use_backface_culling = True
        return m

    def cam(self, view, h):
        k = h / 1.8
        st = self.st
        if view == 'card':
            st.camera((-1.95 * k, -2.45 * k, 1.45 * k), (0.04 * k, 0, 0.97 * k), lens=55)
        elif view == 'side':
            st.camera((-3.3 * k, 0.15 * k, 1.05 * k), (0.0, 0.0, 0.88 * k), lens=50)
        elif view == 'back':
            st.camera((1.6 * k, 2.8 * k, 1.4 * k), (0.0, 0.0, 0.95 * k), lens=55)
        elif view == 'low':
            st.camera((-1.2 * k, -2.9 * k, 0.55 * k), (0.0, 0.0, 0.75 * k), lens=50)

    def sets(self, slots):
        F = {s: 'F' for s in slots}
        S = {s: 'S' for s in slots}
        paths = []
        for f in FRAMES:
            for name, tiers in (('F', F), ('S', S)):
                self.dress(f, tiers)
                h = self.H[f]
                self.st.card(h, name='set_%s_%s.png' % (name, f))
                self.st.ortho_sheet(h, name='ortho_%s_%s.png' % (name, f))
                self.cam('back', h)
                paths.append(self.st.shot('back_%s_%s.png' % (name, f)))
        # mixed grades (the helmet of one tier over the chest of the other)
        mix = []
        for name, tiers in (('Fhelm_Sbody', dict(S, helmet='F')), ('Shelm_Fbody', dict(F, helmet='S'))):
            self.dress('broad', tiers, palette_tier='S')
            self.cam('card', self.H['broad'])
            mix.append(self.st.shot('_mix_%s.png' % name))
            self.cam('back', self.H['broad'])
            mix.append(self.st.shot('_mixb_%s.png' % name))
        from render import grid_sheet
        grid_sheet(mix, os.path.join(self.out, 'mixed_tiers.png'), cols=4, cell=420)
        for pth in mix:
            os.remove(pth)
        # F | S side by side at 200 px (the read the brief asks for)
        reads = [os.path.join(self.out, 'set_%s_%s_200.png' % (t, f)) for f in FRAMES for t in ('F', 'S')]
        grid_sheet(reads, os.path.join(self.out, 'read_200_F_S.png'), cols=4)

    def gear_sheet(self, slots):
        from render import grid_sheet
        paths = []
        for tier in ('F', 'S'):
            for slot in slots:
                ps = self.pieces('broad', {slot: tier})
                if not ps:
                    continue
                ob = ps[0]
                show_only([ob] + ([self.ol[ob.name]] if ob.name in self.ol else []))
                self.palette(tier)
                vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
                lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
                hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
                c = (lo + hi) / 2
                ext = max((hi - lo).length, 0.25)
                d = Vector((-0.62, -0.78, 0.32)).normalized() * ext * 1.75
                self.st.show_platform(False)
                self.st.camera(c + d, c, lens=50)
                paths.append(self.st.shot('_piece_%s_%s.png' % (slot, tier)))
                self.st.show_platform(True)
        grid_sheet(paths, os.path.join(self.out, 'gear_sheet.png'), cols=len(slots), cell=360)
        for pth in paths:
            os.remove(pth)

    def poses(self, slots, frames=FRAMES):
        from render import grid_sheet
        poses = test_poses()
        for f in frames:
            for tier in ('F', 'S'):
                tiers = {s: tier for s in slots}
                paths = []
                for views in (('card',), ('side',)):
                    for pname, pose in poses.items():
                        pose_rigs(pose)
                        self.dress(f, tiers)
                        self.cam(views[0], self.H[f])
                        paths.append(self.st.shot('_pose_%s_%s.png' % (pname, views[0])))
                clear_poses()
                grid_sheet(paths, os.path.join(self.out, 'poses_%s_%s.png' % (tier, f)), cols=len(poses), cell=300)
                for pth in paths:
                    os.remove(pth)

    def closeups(self, slots):
        """Front close-ups of the head/shoulders and of the hem, F and S, broad."""
        from render import grid_sheet
        paths = []
        for tier in ('F', 'S'):
            tiers = {s: tier for s in slots}
            self.dress('broad', tiers)
            self.st.camera((-0.55, -0.95, 1.62), (0.0, 0.0, 1.55), lens=70)
            paths.append(self.st.shot('_cu_head_%s.png' % tier))
            self.st.camera((0.75, 0.85, 1.62), (0.0, 0.0, 1.52), lens=70)
            paths.append(self.st.shot('_cu_headb_%s.png' % tier))
            self.st.camera((-0.9, -1.6, 0.55), (0.0, 0.0, 0.45), lens=55)
            paths.append(self.st.shot('_cu_hem_%s.png' % tier))
            self.st.camera((-1.0, -1.1, 1.05), (0.33, 0.0, 0.95), lens=60)
            paths.append(self.st.shot('_cu_hand_%s.png' % tier))
        grid_sheet(paths, os.path.join(self.out, 'closeups.png'), cols=4, cell=420)
        for pth in paths:
            os.remove(pth)

    def species(self, slots, cases=(('draconid', 'broad'), ('human', 'slight'), ('elf', 'broad'))):
        """One Draconid and one Human-slight wearing the set: species key 1 on body and gear, bone scales on the rig."""
        from render import grid_sheet
        b = self.ctx.bodies['broad']
        if not b.species_keys:
            log('species renders skipped: no species keys on the body yet')
            return False
        paths = []
        for sp, frame in cases:
            data = read_json(os.path.join(CONTENT, 'species', sp + '.json'))['body']
            keys = data.get('shapeKeys', [])
            for tier in ('F', 'S'):
                tiers = {s: tier for s in slots}
                ps, body = self.dress(frame, tiers)
                touched = [body] + ps + [self.ol[o.name] for o in ps if o.name in self.ol]
                for o in touched:
                    if o.data.shape_keys:
                        for kb in o.data.shape_keys.key_blocks:
                            if kb.name.startswith('spc_'):
                                kb.value = 1.0 if kb.name in keys else 0.0
                parts = [bpy.data.objects.get(n + '.' + frame) or bpy.data.objects.get(n) for n in data.get('parts', [])]
                parts = [o for o in parts if o is not None]
                for o in parts:
                    o.hide_render = False
                rg = bpy.data.objects['Rig_' + frame]
                apply_bone_scales(rg, data.get('boneScales', {}))
                bpy.context.view_layer.update()
                h = self.H[frame] * data.get('boneScales', {}).get('root', 1.0)
                self.cam('card', h)
                paths.append(self.st.shot('_sp_%s_%s.png' % (sp, tier)))
                self.cam('back', h)
                paths.append(self.st.shot('_spb_%s_%s.png' % (sp, tier)))
                apply_bone_scales(rg, {})
                for o in touched:
                    if o.data.shape_keys:
                        for kb in o.data.shape_keys.key_blocks:
                            kb.value = 0.0
                for o in parts:
                    o.hide_render = True
        grid_sheet(paths, os.path.join(self.out, 'species.png'), cols=4, cell=420)
        for pth in paths:
            os.remove(pth)
        return True


BONE_GROUPS = {
    'upperLeg': ('LeftUpperLeg', 'RightUpperLeg'), 'lowerLeg': ('LeftLowerLeg', 'RightLowerLeg'),
    'shoulder': ('LeftShoulder', 'RightShoulder'), 'chest': ('Chest',), 'upperChest': ('UpperChest',),
    'upperArm': ('LeftUpperArm', 'RightUpperArm'), 'lowerArm': ('LeftLowerArm', 'RightLowerArm'),
    'hand': ('LeftHand', 'RightHand'), 'head': ('Head',), 'neck': ('Neck',), 'foot': ('LeftFoot', 'RightFoot'),
    'toes': ('LeftToes', 'RightToes'),
}


def apply_bone_scales(rg, scales):
    for pb in rg.pose.bones:
        pb.scale = (1, 1, 1)
    rg.scale = (1, 1, 1)
    for grp, s in scales.items():
        if grp == 'root':
            rg.scale = (s, s, s)
            continue
        if grp == 'fingers':
            for pb in rg.pose.bones:
                if any(f in pb.name for f in riglib.FINGERS) and ('Left' in pb.name or 'Right' in pb.name):
                    pb.scale = (s, s, s)
            continue
        for bn in BONE_GROUPS.get(grp, ()):
            if bn in rg.pose.bones:
                rg.pose.bones[bn].scale = (s, s, s)


def finish_and_save(cls):
    """Rest poses, no actions, review objects removed, then the .blend saved."""
    clear_poses()
    for o in list(bpy.data.objects):
        if o.name.startswith('Review_'):
            bpy.data.objects.remove(o, do_unlink=True)
    for f in FRAMES:
        bpy.data.objects['Body_' + f].hide_render = False
    save_blend(os.path.join(BUILD, 'gear_%s.blend' % cls))


# ------------------------------------------------------------------ robe parts that lie on a skirt
def wedge(a_hem, b_hem, a_top=0.12, b_top=0.10, n=2.3, power=1.25):
    """A superellipse that grows from the waist to the hem (half width a, half depth b): a skirt's designed flare
    (the legs' support + clearance wins wherever it is wider)."""
    def f(th, t, z):
        a = lerp(a_top, a_hem, t ** power)
        b = lerp(b_top, b_hem, t ** power)
        s, c = abs(math.sin(th)) + 1e-9, abs(math.cos(th)) + 1e-9
        return ((s / a) ** n + (c / b) ** n) ** (-1.0 / n)
    return f


def clearance(z):
    """The minimum gap between a skirt and the legs' support: tight at the waist, looser below the hips."""
    return 0.024 + 0.022 * smoothstep(0.95, 0.80, z)


def front_angle(sk, c):
    """|θ| of a point about the skirt's axis (0 at the front centre, π at the back)."""
    return abs(((math.atan2(c.x, -(c.y - sk.yc(c.z))) + math.pi) % TAU) - math.pi)


def sash(ctx, sk, name, slot, z_mid=1.0, half_h=0.026, extra=0.011, cols=20, bulge=0.004, lip=-0.009, rows=3):
    """A band around the waist lying on the skirt `sk` (its radius field + extra), with lips for thickness. rows=4
    with a bigger bulge makes a round rope."""
    p = gl.Piece(name)
    p._smap = ctx.smap
    idx = []
    for li in range(rows):
        t = li / (rows - 1)
        z = z_mid + half_h * (1 - 2 * t)
        b = bulge * math.sin(math.pi * t)
        row = []
        for j in range(cols):
            th = TAU * j / cols
            row.append(sk.bind(p, sk.point(th, z, extra + b), z, 0))
        idx.append(row)
    grid_faces(p, idx, slot, closed=True)
    orient(p, ctx, lambda c: Vector((c.x, c.y - sk.yc(c.z), 0.0)))
    if lip:
        rim(p, ctx, lip, slot)
    return p


def strip(ctx, sk, th0, width, z0, z1, extra, rows, slot, side=1, name='strip', lip=0.004, taper=1.0):
    """A cloth strip (2 vertices across) hanging on the skirt surface — sash tails, cords — bound like the skirt."""
    p = gl.Piece(name)
    p._smap = ctx.smap
    idx = []
    for k in range(rows):
        f = k / (rows - 1)
        z = lerp(z0, z1, f)
        r = sk.radius(th0, z) + extra
        dth = width * lerp(1.0, taper, f) / max(r, 0.05)
        idx.append([sk.bind(p, sk.point(th0 + d * dth, z, extra), z, side) for d in (-0.5, 0.5)])
    grid_faces(p, idx, slot, closed=False)
    orient(p, ctx, lambda c: Vector((c.x, c.y - sk.yc(c.z), 0.0)))
    if lip:
        rim(p, ctx, lip, slot)
    return p


def knot(ctx, sk, th, z, extra, slot, size=0.022, name='knot'):
    """A small faceted knot on the waist (an octahedron squashed against the skirt)."""
    P = sk.point(th, z, extra)
    out = u(th)
    side = Vector((math.cos(th), math.sin(th), 0.0))
    verts = [P + out * size * 0.9, P - out * size * 0.2, P + Vector((0, 0, size)), P - Vector((0, 0, size * 0.9)),
             P + side * size * 1.1, P - side * size * 1.1]
    faces = [(0, 2, 4), (0, 4, 3), (0, 3, 5), (0, 5, 2), (1, 4, 2), (1, 3, 4), (1, 5, 3), (1, 2, 5)]
    p = gl.Piece(name)
    p._smap = ctx.smap
    for v in verts:
        sk.bind(p, v, z, 0)
    for f in faces:
        p.add_face(f, slot)
    orient(p, ctx, lambda c: c - P)
    return p


def flap(ctx, sk, name, th0, th1, side, z0, z1, extra, slot, cols=3, rows=5, slot_fn=None, hem=None):
    """A panel lying on the skirt `sk` from angle th0 to th1 and from z0 down to z1 (hem(f) shapes the bottom edge:
    f in 0..1 across → extra drop in metres), `extra` outside the skirt, bound like the skirt with the given side
    (a tabard's front-left flap rides the left leg, so it opens with the skirt's slit and never crosses it)."""
    p = gl.Piece(name)
    p._smap = ctx.smap
    idx = []
    for k in range(rows):
        t = k / (rows - 1)
        row = []
        for j in range(cols + 1):
            f = j / cols
            th = lerp(th0, th1, f)
            z = lerp(z0, z1 - (hem(f) if (hem and k == rows - 1) else 0.0), t)
            zr = lerp(z0, z1, t)
            P = Vector((0.0, sk.yc(zr), z)) + u(th) * (sk.radius(th, zr) + extra)
            row.append(sk.bind(p, P, zr, side))
        idx.append(row)
    grid_faces(p, idx, slot, closed=False, slot_fn=slot_fn)
    orient(p, ctx, lambda c: Vector((c.x, c.y - sk.yc(c.z), 0.0)))
    return p


def hand_axes(ctx, side):
    """(along the hand, out of the palm) for one side, from the Hand bone's rest matrix."""
    rg = ctx.b.rig
    m = rg.matrix_world.to_3x3() @ rg.data.bones[('Left' if side > 0 else 'Right') + 'Hand'].matrix_local.to_3x3()
    return m.col[1].normalized(), m.col[2].normalized()


def arm_d(ctx, c):
    """For a point on a glove: (side, distance past the wrist along the arm, wrist, arm axis)."""
    side = 1 if c.x > 0 else -1
    sh, el, wr, tip = arm_points(ctx, side)
    ax = (tip - el).normalized()
    return side, (c - wr).dot(ax), wr, ax


def mantle(ctx, name, *, slot, rim_slot, bottom, cols=28, rows=4, off=(0.021, 0.008), feather=0.0, feather_every=2,
           slot_fn=None, center_z=None, arc=None, rim_extra=0.005, top_drop=0.018):
    """A shoulder mantle (cape-let) from just under the neckline down to bottom(θ), laid with cap_rows from a centre
    inside the upper chest; feather > 0 drops every feather_every-th column of the last row by that many radians
    (feather points or scallops). The bottom edge gets a rim in rim_slot."""
    nz = neckline(ctx)
    cz = center_z if center_z is not None else ctx.joint('UpperChest').z + 0.02
    O = Vector((0.0, ctx.spine_y(cz), cz))
    regions = ('neck', 'chest', 'upperArms')

    def top(th):
        # a little under the neckline, so a hood's or cowl's drape always closes over the mantle's top edge
        return alpha_for_z(ctx, O, th, nz(th) - top_drop, regions)

    def bot(th):
        return alpha_for_z(ctx, O, th, bottom(th), regions)

    ex = (lambda j, th: feather if j % feather_every == 1 else 0.0) if feather else None
    p, idx, ths = cap_rows(ctx, name, center=O, alpha_top=top, alpha_bot=bot, rows=rows, cols=cols,
                           off=lambda k: off[0] + off[1] * k / (rows - 1), slot=slot, regions=regions,
                           slot_fn=slot_fn, extra_alpha=ex, arc=arc)
    z_mid = 0.5 * (nz(0.0) + bottom(0.0))
    if rim_slot is not None:
        rim(p, ctx, rim_extra, rim_slot, where=lambda m, pts: m.z < z_mid)
    return p


def inner_layer(piece, ctx, depth, slot=None, select=None):
    """The inside of a single-sheet cloth, for a client that draws front faces only: every selected face is copied
    `depth` metres inward along the cloth's own normal there (averaged over the selected faces, so a hood point bound
    to an ear triangle still goes the right way) with its winding reversed, so the inside of a hood beside the face, a
    collar, a bell sleeve or a skirt half seen through an open slit is drawn instead of showing the background.
    select(center, normal, slot) -> bool. The copies are recorded in piece._lining (no review outline on them)."""
    pos = positions(piece, ctx)
    chosen = []
    acc = {}
    for fi, f in enumerate(list(piece.faces)):
        c, n = face_center_normal(piece, f, pos)
        if select is not None and not select(c, n, piece.slots[fi]):
            continue
        chosen.append(fi)
        raw = Vector((0.0, 0.0, 0.0))
        for k in range(len(f)):
            raw += pos[f[k]].cross(pos[f[(k + 1) % len(f)]])
        for vi in f:
            acc[vi] = acc.get(vi, Vector((0.0, 0.0, 0.0))) + raw
    piece._lining = getattr(piece, '_lining', set())
    twin = {}
    new_faces = []
    for fi in chosen:
        f = piece.faces[fi]
        ids = []
        for vi in f:
            if vi not in twin:
                s = piece.src[vi]
                nv = acc[vi].normalized() if acc[vi].length > 1e-12 else Vector((0, 0, 1))
                if s[0] == 'bind':
                    piece.src.append(('bind', s[1], pos[vi] - nv * depth, 0.0))
                elif s[0] == 'push':
                    piece.src.append(('push', s[1], s[2] - depth))
                else:
                    piece.src.append(('lerp', s[1], s[2], s[3], s[4] - depth))
                twin[vi] = len(piece.src) - 1
                piece._lining.add(twin[vi])
            ids.append(twin[vi])
        new_faces.append((tuple(reversed(ids)), slot if slot is not None else piece.slots[fi]))
    for f, s in new_faces:
        piece.add_face(f, s)
    log('inner_layer %s: %d faces' % (piece.name, len(new_faces)))
    return piece


# ------------------------------------------------------------------ species ears under helmets
EAR_PARTS = {'spc_elf_lean': ('spc_elf_ears', 'spc_elf_ears_long'), 'spc_orc_bulk': ('spc_orc_ears',)}


def part_points(name, frame, key):
    """A species part's vertices in world space with its species key at 1.0 (empty if the part is not in the file)."""
    ob = bpy.data.objects.get('%s.%s' % (name, frame)) or bpy.data.objects.get(name)
    if ob is None or ob.type != 'MESH':
        return []
    me = ob.data
    mw = ob.matrix_world
    kb = me.shape_keys.key_blocks.get(key) if me.shape_keys else None
    src = kb.data if kb is not None else me.vertices
    return [mw @ d.co for d in src]


def _head_centre(body, shape):
    hs = body.shapes[shape]
    head = [i for i, r in enumerate(body.regions) if r == REG['head']]
    lo = Vector((min(hs[i].x for i in head), min(hs[i].y for i in head), min(hs[i].z for i in head)))
    hi = Vector((max(hs[i].x for i in head), max(hs[i].y for i in head), max(hs[i].z for i in head)))
    return Vector((0.0, 0.5 * (lo.y + hi.y) + 0.012, lo.z + 0.56 * (hi.z - lo.z))), head


def body_ear_points(body, shape):
    """The body's own ears in one shape: head vertices standing out sideways (beyond 82% of the widest) near ear
    height. A helmet grid can pass between two samples and let an ear tip through; these are pocketed too."""
    C, head = _head_centre(body, shape)
    hs = body.shapes[shape]
    band = [i for i in head if C.z - 0.09 < hs[i].z < C.z + 0.05]
    if not band:
        return []
    w = max(abs(hs[i].x) for i in band)
    return [hs[i] for i in band if abs(hs[i].x) > 0.82 * w]


def _pocket(datas, C, pts, margin, full, reach):
    eu = []
    for E in pts:
        d = E - C
        if d.length > 1e-6:
            eu.append((d.normalized(), d.length))
    if not eu:
        return 0
    c_reach, c_full = math.cos(reach), math.cos(full)
    moved = 0
    first = datas[0]
    for idx in range(len(first)):
        V = first[idx].co
        dv = V - C
        rv = dv.length
        if rv < 1e-6:
            continue
        uv = dv / rv
        need = 0.0
        for ue, re in eu:
            ca = uv.dot(ue)
            if ca <= c_reach:
                continue
            need = max(need, (re + margin - rv) * smoothstep(c_reach, c_full, ca))
        if need > 0.0:
            for data in datas:
                data[idx].co = data[idx].co + uv * need
            moved += 1
    return moved


def ear_pockets(ob, ctx, frame, margin=0.012, full=math.radians(9), reach=math.radians(26)):
    """The hood's ear cut-out (docs/classes/arcanist.md §9 species notes), as pockets: the helmet's vertices near an
    ear's direction from the head centre are pushed out radially until the ear sits `margin` inside the cloth, with a
    smooth falloff in angle. Done for the body's own ears in the basis and every species key (an ear tip can pass
    between two grid samples), then for the species' part ears (Elf, Orc) on their own key. Returns vertices moved."""
    me = ob.data
    body = ctx.bodies[frame]
    kbs = me.shape_keys.key_blocks if me.shape_keys else None
    moved = 0
    # the body's own ears: basis (mesh + Basis block together), then each species key
    C, _ = _head_centre(body, 'Basis')
    datas = [me.vertices] + ([kbs['Basis'].data] if kbs and 'Basis' in kbs else [])
    moved += _pocket(datas, C, body_ear_points(body, 'Basis'), 0.010, math.radians(7), math.radians(20))
    if kbs:
        for key in body.species_keys:
            if key in kbs:
                Ck, _ = _head_centre(body, key)
                moved += _pocket([kbs[key].data], Ck, body_ear_points(body, key), 0.010, math.radians(7),
                                 math.radians(20))
        for key, parts in EAR_PARTS.items():
            if key not in kbs or key not in body.shapes:
                continue
            ears = []
            for nm in parts:
                ears += part_points(nm, frame, key)
            if ears:
                Ck, _ = _head_centre(body, key)
                moved += _pocket([kbs[key].data], Ck, ears, margin, full, reach)
    me.update()
    return moved

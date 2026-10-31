"""build_kit_vault.py — the Drowned Vault kit (`vlt_`), its review renders and its export (tools/blender/README.md,
Phase 6 → Environments; docs/07-DUNGEONS.md §2.2 owns the piece list, the budgets and the room templates).

Run (headless; any working directory):
    blender -b -P tools/blender/env/build_kit_vault.py -- [--quick] [--only vlt_a,vlt_b] [--no-bake] [--no-export]
                                                         [--no-renders] [--no-sheet] [--templates id,id] [--no-templates]
                                                         [--no-fog]

What it does, end to end (a re-run rebuilds everything; nothing is hand-edited):
1. writes the Vault palette (tools/blender/palettes/vault.json, kit_lib's {zone, about, names, colours}) and builds
   every piece of 07 §2.2's Vault list (+ the shell's cut-away pieces and the extra props the Vault templates need)
   from vertex/face lists, one palette slot per face;
2. bakes ambient occlusion per piece with Cycles into COLOR_0.B (each piece among stand-ins for its room: the floor
   1 cm under it, the wall behind it, copies of the tiles or segments it tiles with), AO distance kit_lib.AO_DIST;
3. exports client/public/models/env/kit_vault.glb (one object per piece named by its meshId at the origin, extras kind
   'kit', zone, tris, role, mount; moving parts as children `<meshId>.<part>` with their origin at the hinge, extras kind
   'part', part, piece, axis, note; empties light_<n> / fx_<n> under the piece, extras kind, light | fx, piece, color)
   and client/public/models/env/vault.json in kit_lib.export_kit's layout (palette, shell, per-piece tris / budget / role
   / mount / bounds / parts / lights / fx / hole / water / extra) plus the Vault's water note;
4. renders the review set into art/renders/env/vault/: the labelled kit sheet, and every Vault template
   (content/dungeons/gravehollow-keep/templates/vlt-t-*.json, or .json.later until Phase 7) assembled from its JSON the
   way the client builds it — floor tiles (minus the holes), walls, doorways and corners from its footprint and doors
   (the camera-facing sides cut down, wall-hung props there left out), its props outlined — from the template's own
   camera with two torch lights at the party and the pieces' lamps (kit_lib.env_material + a water material); a plan
   view; at full quality a half-size phone read; report.md with the triangles per piece and per room.

Conventions (the contract): metres; Blender Z up; a piece's front faces −Y (game +z); origin at floor level in the
centre of its footprint. A wall-type piece (wall, doorway, quay edge) has its origin at the centre of its base on the
room-side face; the masonry stands behind it (+Y, 0.4 m thick) and reaches 0.8 m below the floor, so sunk water never
shows a gap. Wall-hung props (shelf wall, breach, leech shelf, banner) have their origin 0.1 m in front of the wall
face — templates place them at the room edge − 0.1, as the Cellars place their sconces. A corner post at rotationY 0 is
the room's north-west corner (the room lies toward +x / +z); NE −90, SE 180, SW 90. COLOR_0 (`gv`): R = slot / 15,
G = variation (0.5 neutral; lower = wetter, darker), B = baked AO (1 open), A = opacity (1; water 0.62 knee-deep,
fading to 0 at soft edges). Water surfaces: knee-deep +0.45 m over the floor (an overlay; the floor stays), deep
−0.35 m (the deep tile replaces the floor tile; quay edges line it).
"""
import json
import math
import os
import random
import struct
import sys
import time
from collections import defaultdict

import bpy
import numpy as np
from mathutils import Matrix, Vector, noise

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
from common import BUILD, CONTENT, MODELS, RENDERS, REPO, TOOLS, args, hexcol, log, read_json, write_json  # noqa: E402
import kit_lib as K  # noqa: E402  (the shared kit conventions: palettes, the review material, AO distance)

ARGS = args()
QUICK = bool(ARGS.get('quick'))
ONLY = [s for s in str(ARGS.get('only', '')).split(',') if s] if ARGS.get('only') else []
DO_BAKE = not ARGS.get('no_bake')
DO_EXPORT = not ARGS.get('no_export') and not ONLY
DO_RENDERS = not ARGS.get('no_renders')
DO_SHEET = DO_RENDERS and not ARGS.get('no_sheet')
DO_TEMPLATES = DO_RENDERS and not ARGS.get('no_templates')
TPL_ONLY = [s for s in str(ARGS.get('templates', '')).split(',') if s] if ARGS.get('templates') else []
FOG = not ARGS.get('no_fog')

ZONE = 'vault'
OUT = os.path.join(RENDERS, 'env', 'vault')
GLB = os.path.join(MODELS, 'env', 'kit_vault.glb')
META_JSON = os.path.join(MODELS, 'env', 'vault.json')
BLEND = os.path.join(BUILD, 'kit_vault.blend')
TPL_DIR = os.path.join(CONTENT, 'dungeons', 'gravehollow-keep', 'templates')
SHARED_GLB = os.path.join(MODELS, 'env', 'kit_shared.glb')

# The Drowned Vault's 16 colours (kit_lib slot order). 07 §2.2's four: wet basalt #23303A is the floor's dark basalt
# lifted a step (slot 1 carries floors and paving in every kit, so it must read at phone size), verdigris #3F8C7E the moss
# slot, brine foam #A9C5CC the bone slot (barnacles, salt lines, shells, foam), deep-lantern cyan #58D3E0 the glow.
VAULT = ['#4d6372', '#34444e', '#7a6e58', '#463d31', '#505a60', '#0a1418', '#2f7189', '#c8693f',
         '#8c7a55', '#a3b6bc', '#c99b45', '#58d3e0', '#3f8c7e', '#a9c5cc', '#d2fbf2', '#1d4f5a']
VAULT_ABOUT = ('The Drowned Vault (07 §2.2): wet basalt, verdigris, brine foam and deep-lantern cyan, with the cult\'s brass; '
               'teal and brass, distinct from the Cellars\' browns and the Crypts\' bone and green (11 §1). Slot 0 the walls\' '
               'lifted basalt, slot 1 the floors and paving (07\'s #23303A lifted so it reads at phone size), 10 brass (pipes, '
               'valves, lamps, trims), 11 the cyan of the cult lamps and anemones, 12 verdigris and weed, 13 brine foam '
               '(barnacles, salt tide-lines, shells), 14 pearl light, 15 the water (COLOR_0.A carries its opacity).')
HEX = VAULT
SLOT_NAMES = list(K.SLOT_NAMES)
EMISSIVE = set(K.EMISSIVE)

(STONE, DSTONE, WOOD, DWOOD, IRON, INK, CLOTH1, CLOTH2, ROPE, BMETAL, BRASS, GLOW, MOSS, BONE, GEM, WATER) = range(16)

WALL_H = 3.5
WALL_T = 0.4
SINK = -0.8          # walls, posts and doorways reach this far below the floor
KNEE = 0.45          # knee-deep water surface (over the floor)
DEEP = -0.35         # deep water surface (the deep tile replaces the floor tile)
A_KNEE = 0.62        # knee-deep water opacity
CUT_H = 0.55         # the client's cut-away height for camera-facing walls
TAU = 2.0 * math.pi

CYAN = '#58d3e0'
WARM = '#ffb060'
PEARL = '#d2fbf2'


def V3(x, y, z):
    return Vector((float(x), float(y), float(z)))


# ============================================================================ modelling kit
def newell(pts):
    n = Vector((0.0, 0.0, 0.0))
    k = len(pts)
    for i in range(k):
        a = pts[i]
        b = pts[(i + 1) % k]
        n.x += (a.y - b.y) * (a.z + b.z)
        n.y += (a.z - b.z) * (a.x + b.x)
        n.z += (a.x - b.x) * (a.y + b.y)
    return n


class Geo:
    """Vertices, faces, one palette slot and one smoothing angle (degrees, 0 = flat) per face; per-vertex opacity and
    optional fixed variation (G)."""

    def __init__(self):
        self.V = []
        self.F = []
        self.S = []
        self.A = []
        self.alpha = {}
        self.gfix = {}

    def v(self, p, alpha=None, g=None):
        self.V.append(Vector(p))
        i = len(self.V) - 1
        if alpha is not None:
            self.alpha[i] = alpha
        if g is not None:
            self.gfix[i] = g
        return i

    def f(self, idx, slot, smooth=0.0, out=None):
        idx = list(idx)
        if len(set(idx)) < 3:
            return
        if out is not None:
            n = newell([self.V[i] for i in idx])
            if n.dot(Vector(out)) < 0:
                idx.reverse()
        self.F.append(tuple(idx))
        self.S.append(slot)
        self.A.append(smooth)

    def poly(self, pts, slot, smooth=0.0, out=None, alpha=None, g=None):
        self.f([self.v(p, alpha, g) for p in pts], slot, smooth, out)

    def mark(self):
        return (len(self.V), len(self.F))

    def xform(self, mat, mark=(0, 0)):
        v0, f0 = mark
        for i in range(v0, len(self.V)):
            self.V[i] = mat @ self.V[i]
        if mat.to_3x3().determinant() < 0:
            for k in range(f0, len(self.F)):
                self.F[k] = tuple(reversed(self.F[k]))

    def recolor(self, slot, mark=(0, 0), only=None):
        for k in range(mark[1], len(self.F)):
            if only is None or self.S[k] == only:
                self.S[k] = slot

    def tris(self):
        return sum(len(f) - 2 for f in self.F)


def M(loc=(0, 0, 0), rz=0.0, rx=0.0, ry=0.0, s=1.0):
    """Translation · Rz · Ry · Rx · scale (degrees)."""
    m = Matrix.Translation(Vector(loc))
    if rz:
        m = m @ Matrix.Rotation(math.radians(rz), 4, 'Z')
    if ry:
        m = m @ Matrix.Rotation(math.radians(ry), 4, 'Y')
    if rx:
        m = m @ Matrix.Rotation(math.radians(rx), 4, 'X')
    if isinstance(s, (tuple, list)):
        m = m @ Matrix.Diagonal((s[0], s[1], s[2], 1.0))
    elif s != 1.0:
        m = m @ Matrix.Scale(s, 4)
    return m


def qy(g, x0, x1, z0, z1, y, slot, out=-1, smooth=0.0):
    """A quad in the plane y = const facing −Y (out=-1) or +Y."""
    g.poly([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], slot, smooth, out=(0, out, 0))


def qx(g, y0, y1, z0, z1, x, slot, out=1, smooth=0.0):
    g.poly([(x, y0, z0), (x, y1, z0), (x, y1, z1), (x, y0, z1)], slot, smooth, out=(out, 0, 0))


def qz(g, x0, x1, y0, y1, z, slot, out=1, smooth=0.0, alpha=None, gv=None):
    g.poly([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], slot, smooth, out=(0, 0, out), alpha=alpha, g=gv)


def box(g, lo, hi, slot, skip=(), smooth=0.0, slots=None, mat=None):
    """An axis-aligned box (optionally transformed); `skip` drops faces among -x +x -y +y -z +z; `slots` overrides per face."""
    mk = g.mark()
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    P = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    faces = {'-y': (0, 1, 5, 4), '+y': (2, 3, 7, 6), '-x': (3, 0, 4, 7), '+x': (1, 2, 6, 5), '+z': (4, 5, 6, 7), '-z': (3, 2, 1, 0)}
    used = set()
    for k, q in faces.items():
        if k not in skip:
            used.update(q)
    idx = {i: g.v(P[i]) for i in sorted(used)}
    for k, q in faces.items():
        if k in skip:
            continue
        g.f([idx[i] for i in q], (slots or {}).get(k, slot), smooth)
    if mat is not None:
        g.xform(mat, mk)
    return mk


def cbox(g, c, size, slot, skip=(), mat=None, slots=None, smooth=0.0):
    """A box centred on c (local), then transformed by mat."""
    c = Vector(c)
    h = Vector(size) / 2
    mk = box(g, c - h, c + h, slot, skip, smooth, slots)
    if mat is not None:
        g.xform(mat, mk)
    return mk


def ring_pts(c, r, n, phase=0.0, axis='Z', sx=1.0, sy=1.0):
    c = Vector(c)
    out = []
    for i in range(n):
        a = phase + TAU * i / n
        u, w = math.cos(a) * r * sx, math.sin(a) * r * sy
        if axis == 'Z':
            out.append(c + Vector((u, w, 0)))
        elif axis == 'Y':
            out.append(c + Vector((u, 0, w)))
        else:
            out.append(c + Vector((0, u, w)))
    return out


def skin(g, rings, slot, smooth=50.0, cap0=False, cap1=False, closed=True, slot_fn=None, cap_slot=None, alphas=None):
    """Quads between consecutive rings (lists of points, same length); faces oriented away from the rings' axis.
    A ring whose points all coincide is an apex (triangles)."""
    n = len(rings[0])
    idx = []
    for ri, r in enumerate(rings):
        a = alphas[ri] if alphas else None
        if all((Vector(p) - Vector(r[0])).length < 1e-9 for p in r):
            k = g.v(r[0], a)
            idx.append([k] * n)
        else:
            idx.append([g.v(p, a) for p in r])
    cents = [sum((Vector(p) for p in r), Vector()) / n for r in rings]
    m = n if closed else n - 1
    for i in range(len(rings) - 1):
        axis_mid = (cents[i] + cents[i + 1]) / 2
        for j in range(m):
            j2 = (j + 1) % n
            q = [idx[i][j], idx[i][j2], idx[i + 1][j2], idx[i + 1][j]]
            uq = []
            for k in q:
                if k not in uq:
                    uq.append(k)
            if len(uq) < 3:
                continue
            mid = sum((g.V[k] for k in uq), Vector()) / len(uq)
            out = mid - axis_mid
            s = slot_fn(i, j) if slot_fn else slot
            g.f(uq, s, smooth, out=out if out.length > 1e-9 else None)
    if cap0 and len(set(idx[0])) > 2:
        ax = cents[1] - cents[0]
        g.f(idx[0], cap_slot if cap_slot is not None else slot, 0.0, out=-ax)
    if cap1 and len(set(idx[-1])) > 2:
        ax = cents[-1] - cents[-2]
        g.f(idx[-1], cap_slot if cap_slot is not None else slot, 0.0, out=ax)
    return idx


def lathe(g, profile, n, slot, c=(0, 0, 0), smooth=50.0, cap0=False, cap1=False, phase=None, slot_fn=None,
          cap_slot=None, sx=1.0, sy=1.0, mat=None):
    """Revolves (r, z) around a vertical axis through c (rings of n points; r = 0 makes an apex)."""
    mk = g.mark()
    c = Vector(c)
    ph = (math.pi / n) if phase is None else phase
    rings = [ring_pts(c + Vector((0, 0, z)), r, n, ph, 'Z', sx, sy) for r, z in profile]
    skin(g, rings, slot, smooth, cap0, cap1, True, slot_fn, cap_slot)
    if mat is not None:
        g.xform(mat, mk)
    return mk


def prism(g, c, r, z0, z1, n, slot, cap_top=True, cap_bottom=False, smooth=50.0, phase=None, mat=None, sx=1.0, sy=1.0):
    return lathe(g, [(r, z0), (r, z1)], n, slot, c, smooth, cap_bottom, cap_top, phase, None, None, sx, sy, mat)


def frame(t, up=None):
    t = Vector(t).normalized()
    u = Vector(up) if up is not None else (Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0)))
    x = (u - t * u.dot(t))
    if x.length < 1e-6:
        x = Vector((1, 0, 0)) - t * t.x
    x.normalize()
    y = t.cross(x)
    return x, y


def sweep(g, path, r, n, slot, smooth=60.0, cap0=False, cap1=False, phase=0.0, up=None, slot_fn=None, radii=None):
    """A tube of n sides along a polyline (parallel-transported frames)."""
    path = [Vector(p) for p in path]
    rings = []
    x_prev = None
    for i, p in enumerate(path):
        if i == 0:
            t = path[1] - path[0]
        elif i == len(path) - 1:
            t = path[-1] - path[-2]
        else:
            t = (path[i + 1] - path[i]).normalized() + (path[i] - path[i - 1]).normalized()
        t.normalize()
        if x_prev is None:
            x, y = frame(t, up)
        else:
            x = x_prev - t * x_prev.dot(t)
            if x.length < 1e-6:
                x, y = frame(t, up)
            else:
                x.normalize()
                y = t.cross(x)
        x_prev = x
        rr = radii[i] if radii else r
        rings.append([p + x * (math.cos(phase + TAU * k / n) * rr) + y * (math.sin(phase + TAU * k / n) * rr) for k in range(n)])
    return skin(g, rings, slot, smooth, cap0, cap1, True, slot_fn)


def torus(g, R, r, nmaj, nmin, slot, mat=None, smooth=70.0, slot_fn=None, arc=1.0, phase=0.0):
    """A ring around local Z (in the XY plane), transformed by mat; arc < 1 leaves it open."""
    mk = g.mark()
    steps = nmaj if arc >= 1.0 else nmaj + 1
    idx = []
    for i in range(steps):
        a = phase + TAU * arc * i / nmaj
        cx, cy = math.cos(a), math.sin(a)
        ring = []
        for j in range(nmin):
            b = TAU * j / nmin
            rr = R + r * math.cos(b)
            ring.append(g.v(Vector((cx * rr, cy * rr, r * math.sin(b)))))
        idx.append(ring)
    if arc >= 1.0:
        idx.append(idx[0])
    for i in range(len(idx) - 1):
        a = phase + TAU * arc * (i + 0.5) / nmaj
        cen = Vector((math.cos(a) * R, math.sin(a) * R, 0))
        for j in range(nmin):
            j2 = (j + 1) % nmin
            q = [idx[i][j], idx[i][j2], idx[i + 1][j2], idx[i + 1][j]]
            mid = sum((g.V[k] for k in q), Vector()) / 4
            g.f(q, slot_fn(i, j) if slot_fn else slot, smooth, out=mid - cen)
    if mat is not None:
        g.xform(mat, mk)
    return mk


def cone(g, base_c, tip, r, n, slot, cap=False, phase=0.0, smooth=0.0):
    base_c, tip = Vector(base_c), Vector(tip)
    x, y = frame(tip - base_c)
    ring = [base_c + x * (math.cos(phase + TAU * k / n) * r) + y * (math.sin(phase + TAU * k / n) * r) for k in range(n)]
    return skin(g, [ring, [tip] * n], slot, smooth, cap, False)


def bipyramid(g, c, r, h_up, h_down, n, slot, phase=0.0, smooth=0.0, squash=1.0):
    c = Vector(c)
    ring = [c + Vector((math.cos(phase + TAU * k / n) * r, math.sin(phase + TAU * k / n) * r * squash, 0)) for k in range(n)]
    skin(g, [[c + Vector((0, 0, -h_down))] * n, ring, [c + Vector((0, 0, h_up))] * n], slot, smooth)


def rock(g, c, size, slot, rnd, n=5, smooth=0.0):
    """A chunky low-poly stone: a jittered n-gon frustum with a peaked top (3n tris, no bottom)."""
    c = Vector(c)
    sx, sy, sz = size
    ph = rnd.uniform(0, TAU)
    bot, mid = [], []
    for k in range(n):
        a = ph + TAU * k / n + rnd.uniform(-0.25, 0.25)
        rr = rnd.uniform(0.85, 1.1)
        bot.append(c + Vector((math.cos(a) * sx * rr, math.sin(a) * sy * rr, 0.0)))
        rr2 = rr * rnd.uniform(0.62, 0.8)
        mid.append(c + Vector((math.cos(a) * sx * rr2, math.sin(a) * sy * rr2, sz * rnd.uniform(0.55, 0.8))))
    top = c + Vector((rnd.uniform(-0.15, 0.15) * sx, rnd.uniform(-0.15, 0.15) * sy, sz))
    skin(g, [bot, mid, [top] * n], slot, smooth)


def barnacle(g, c, r, slot=BONE, n=4, h=None, phase=0.0, up=(0, 0, 1)):
    """A tiny cone (n tris) standing on a surface along `up`."""
    c = Vector(c)
    u = Vector(up).normalized()
    cone(g, c - u * (r * 0.2), c + u * (h if h is not None else r * 1.1), r, n, slot, False, phase)


def ribbon(g, path, width, slot, normal=(0, -1, 0), two_sided=False, alpha=None):
    """A flat strip along a polyline, facing `normal` (weed, chains, cloth tails)."""
    path = [Vector(p) for p in path]
    nrm = Vector(normal).normalized()
    left, right = [], []
    for i, p in enumerate(path):
        t = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        side = t.cross(nrm)
        if side.length < 1e-6:
            side = Vector((1, 0, 0))
        side.normalize()
        w = width[i] if isinstance(width, (list, tuple)) else width
        left.append(p - side * (w / 2))
        right.append(p + side * (w / 2))
    for i in range(len(path) - 1):
        q = [left[i], right[i], right[i + 1], left[i + 1]]
        g.poly(q, slot, 0.0, out=nrm, alpha=alpha)
        if two_sided:
            g.poly(list(reversed(q)), slot, 0.0, out=-nrm, alpha=alpha)


def chain(g, path, link=0.16, w=0.07, slot=IRON, normal=(0, -1, 0), alt_slot=None, normal_fn=None):
    """Flat links along a polyline: each a quad facing `normal` (or normal_fn(point)), alternating wide and narrow so
    the band reads as a chain at game distance."""
    path = [Vector(p) for p in path]
    segs = []
    total = 0.0
    for i in range(len(path) - 1):
        L = (path[i + 1] - path[i]).length
        if L > 1e-9:
            segs.append((path[i], path[i + 1], L))
            total += L
    n = max(1, int(round(total / link)))

    def at(s):
        for a, b, L in segs:
            if s <= L:
                return a + (b - a) * (s / L), (b - a).normalized()
            s -= L
        a, b, L = segs[-1]
        return b, (b - a).normalized()
    for k in range(n):
        p0, t = at(k * total / n)
        p1, _ = at((k + 0.9) * total / n)
        nrm = Vector(normal_fn(p0)) if normal_fn else Vector(normal)
        side = t.cross(nrm)
        if side.length < 1e-6:
            side = Vector((1, 0, 0))
        side.normalize()
        ww = w if k % 2 == 0 else w * 0.42
        s = slot if (alt_slot is None or k % 2 == 0) else alt_slot
        g.poly([p0 - side * ww / 2, p0 + side * ww / 2, p1 + side * ww / 2, p1 - side * ww / 2], s, 0.0, out=nrm)


def disc_pool(g, c, r_in, r_out, n, z_in, z_out, a_in, a_out, slot=WATER, sy=1.0, phase=0.0, g_c=None, a_c=None):
    """A soft-edged water pool: a centre fan to r_in at (z_in, a_in), then a ring out to r_out at (z_out, a_out)."""
    c = Vector(c)
    ctr = g.v(c + Vector((0, 0, z_in)), a_in if a_c is None else a_c, g_c)
    inner = [g.v(c + Vector((math.cos(phase + TAU * k / n) * r_in, math.sin(phase + TAU * k / n) * r_in * sy, z_in)), a_in) for k in range(n)]
    outer = [g.v(c + Vector((math.cos(phase + TAU * k / n) * r_out, math.sin(phase + TAU * k / n) * r_out * sy, z_out)), a_out) for k in range(n)]
    for k in range(n):
        k2 = (k + 1) % n
        g.f([ctr, inner[k], inner[k2]], slot, 0.0, out=(0, 0, 1))
        g.f([inner[k], outer[k], outer[k2], inner[k2]], slot, 0.0, out=(0, 0, 1))


# ============================================================================ pieces
class Piece:
    """One kit piece: its static geometry, moving parts, light / fx points (Blender local coordinates) and metadata."""

    def __init__(self, name, budget, group, mount='floor', replaces_floor=False, extra=False, gmode='noise',
                 footprint=None, note='', width=2.0):
        self.name = name
        self.budget = budget
        self.group = group              # shell | floor | water | wall | door | prop | set
        self.mount = mount              # floor | wall (hung 0.1 m in front of a wall) | edge (a wall-type piece) | hole
        self.replaces_floor = replaces_floor
        self.extra = extra              # not in 07 §2.2's list (the shell's cut-aways, props the templates need)
        self.gmode = gmode              # noise | wall (periodic at x = ±1) | tile (periodic at x, y = ±1) | const
        self.footprint = footprint      # game-space rect [x0, z0, x1, z1] it covers on the floor (replaces_floor)
        self.note = note
        self.g = Geo()
        self.parts = {}                 # part -> dict(g=Geo (piece-local), pivot=Vector, motion=str, axis=(x,y,z))
        self.lights = []                # (Vector, hex, kind)
        self.fx = []                    # (Vector, kind)
        self.seed = sum(ord(c) for c in name) % 97
        self.width = width              # along x, for wall-type pieces (2 m segment, 4 m doorway)
        self.half = width / 2.0         # G stays periodic across the piece's ends (x = ±half)
        self.role = ROLE_OF.get(group, 'prop')   # kit_lib roles: shell, prop, wall-hung, hanging, decal (+ water)

    def part(self, name, pivot, motion, axis, note=None):
        """A moving part `<meshId>.<name>` (kit_lib names: leaf, gate, panel, lid, prisoner …), modelled in the piece's
        space with its origin at `pivot`; `axis` is the game-space axis it turns or slides on ('x', 'y', 'z', 'none')."""
        g = Geo()
        self.parts[name] = dict(g=g, pivot=Vector(pivot), motion=motion, axis=axis, note=note)
        return g

    def light(self, p, hexcol_='#58d3e0', kind='flame'):
        self.lights.append((Vector(p), hexcol_, kind))

    def emit(self, p, kind):
        self.fx.append((Vector(p), kind))

    def tris(self):
        return self.g.tris() + sum(p['g'].tris() for p in self.parts.values())

    def client_mount(self):
        """The `mount` the client reads (tile, shell, corner, floor, wall): wall-hung props say 'wall' so the client never
        takes them for a wall segment (a `_wall_` piece on the room edge replaces the shell there) and hides them on the
        walls cut down for the camera."""
        if self.role == 'wall-hung':
            return 'wall'
        if self.mount == 'corner':
            return 'corner'
        if self.mount == 'edge':
            return 'shell'
        if self.role == 'water' or (self.footprint == [-1, -1, 1, 1] and self.mount in ('floor', 'hole')):
            return 'tile'
        return 'floor'


ROLE_OF = {'shell': 'shell', 'water': 'water', 'floor': 'decal', 'wall': 'wall-hung', 'prop': 'prop', 'set': 'prop'}
BUILDERS = []


def piece(fn):
    BUILDERS.append(fn)
    return fn


# ---------------------------------------------------------------- shared shapes
def slab(g, slot=DSTONE, joint=DSTONE, half=1.0, ch=0.05, depth=0.035, g_top=0.5):
    """A 2 m floor slab: a flat top at floor level and chamfered joints sinking 3.5 cm at its edges (darkened by G, their
    slope and the baked AO), so a floor of them shows its 2 m grid without a hard ink grid (10 triangles; tiles
    seamlessly in any quarter turn)."""
    i = half - ch
    top = [g.v((-i, -i, 0.0), g=g_top), g.v((i, -i, 0.0), g=g_top), g.v((i, i, 0.0), g=g_top), g.v((-i, i, 0.0), g=g_top)]
    bot = [g.v((-half, -half, -depth), g=0.05), g.v((half, -half, -depth), g=0.05), g.v((half, half, -depth), g=0.05), g.v((-half, half, -depth), g=0.05)]
    g.f(top, slot, 0.0, out=(0, 0, 1))
    outs = ((0, -1, 1), (1, 0, 1), (0, 1, 1), (-1, 0, 1))
    for k in range(4):
        k2 = (k + 1) % 4
        g.f([bot[k], bot[k2], top[k2], top[k]], joint, 0.0, out=outs[k])


def wall_layers(g, x0, x1, top=3.18, salt=(1.14, 1.31)):
    """The dressed face of a vault wall between x0 and x1 (plane y = 0, facing -Y): a proud plinth reaching below the
    floor, the stone face with the old water line (a verdigris algae band under a thin pale salt line), up to the cornice."""
    qy(g, x0, x1, SINK, 0.0, -0.06, DSTONE)
    qy(g, x0, x1, 0.0, 0.42, -0.06, DSTONE)
    g.poly([(x0, -0.06, 0.42), (x1, -0.06, 0.42), (x1, 0.0, 0.5), (x0, 0.0, 0.5)], DSTONE, out=(0, -1, 1))
    qy(g, x0, x1, 0.5, salt[0], 0.0, STONE)
    qy(g, x0, x1, salt[0], salt[1] - 0.05, 0.0, MOSS)
    qy(g, x0, x1, salt[1] - 0.05, salt[1], 0.0, BONE)
    qy(g, x0, x1, salt[1], top, 0.0, STONE)


def cornice(g, x0, x1, z0=3.18, z1=WALL_H, proud=0.14):
    g.poly([(x0, 0, z0), (x1, 0, z0), (x1, -proud, z0), (x0, -proud, z0)], DSTONE, out=(0, 0, -1))
    qy(g, x0, x1, z0, z1, -proud, DSTONE)
    qz(g, x0, x1, -proud, WALL_T, z1, DSTONE)


def cut_section(g, xs, tops):
    """A cut-down wall run (the client lowers the walls that face the camera): plinth, a broken top, and the back face
    the camera sees."""
    x0, x1 = xs[0], xs[-1]
    qy(g, x0, x1, SINK, 0.0, -0.06, DSTONE)
    qy(g, x0, x1, 0.0, 0.42, -0.06, DSTONE)
    g.poly([(x0, -0.06, 0.42), (x1, -0.06, 0.42), (x1, 0.0, 0.5), (x0, 0.0, 0.5)], DSTONE, out=(0, -1, 1))
    for i in range(len(xs) - 1):
        a, b = xs[i], xs[i + 1]
        ta, tb = tops[i], tops[i + 1]
        g.poly([(a, 0, 0.5), (b, 0, 0.5), (b, 0, tb), (a, 0, ta)], STONE, out=(0, -1, 0))
        g.poly([(a, 0, ta), (b, 0, tb), (b, WALL_T, tb - 0.04), (a, WALL_T, ta - 0.04)], DSTONE, out=(0, 0, 1))
        g.poly([(a, WALL_T, SINK), (b, WALL_T, SINK), (b, WALL_T, tb - 0.04), (a, WALL_T, ta - 0.04)], DSTONE, out=(0, 1, 0))


def flat_ring(g, c, r0, r1, n, slot, depth=0.0, phase=0.0, mat=None):
    """An annulus in the local XZ plane facing -Y, with an optional outer band `depth` deep toward +Y."""
    mk = g.mark()
    c = Vector(c)
    inner = [c + Vector((math.cos(phase + TAU * k / n) * r0, 0, math.sin(phase + TAU * k / n) * r0)) for k in range(n)]
    outer = [c + Vector((math.cos(phase + TAU * k / n) * r1, 0, math.sin(phase + TAU * k / n) * r1)) for k in range(n)]
    for k in range(n):
        k2 = (k + 1) % n
        g.poly([inner[k], outer[k], outer[k2], inner[k2]], slot, 0.0, out=(0, -1, 0))
        if depth:
            d = Vector((0, depth, 0))
            g.poly([outer[k], outer[k2], outer[k2] + d, outer[k] + d], slot, 30.0, out=(outer[k] + outer[k2]) / 2 - c)
    if mat is not None:
        g.xform(mat, mk)
    return mk


def stud(g, c, r, h, slot=BMETAL, n=4, normal=(0, -1, 0)):
    """A rivet / bolt head: an n-sided pyramid on a surface."""
    c = Vector(c)
    nrm = Vector(normal).normalized()
    cone(g, c - nrm * 0.004, c + nrm * h, r, n, slot, False, math.pi / 4)


# ---------------------------------------------------------------- floors and water
@piece
def floor_basalt():
    p = Piece('vlt_floor_basalt', 4, 'shell', gmode='tile', footprint=[-1, -1, 1, 1],
              note='2 m wet black-stone tile; joints darker through G; tiles seamlessly')
    slab(p.g)
    return p


@piece
def floor_basalt_wet():
    p = Piece('vlt_floor_basalt_wet', 20, 'shell', gmode='tile', extra=True, footprint=[-1, -1, 1, 1],
              note='floor variant for the decoration pass: a slab with a standing puddle that fades at its edge')
    g = p.g
    slab(g, g_top=0.38)
    ctr = g.v((0.15, -0.1, 0.006), 0.6, 0.5)
    rim = []
    for k in range(8):
        a = TAU * k / 8 + 0.3
        rr = 0.6 * (1.0, 0.86, 0.95, 0.8)[k % 4]
        rim.append(g.v((0.15 + math.cos(a) * rr, -0.1 + math.sin(a) * rr * 0.78, 0.006), 0.0, 0.5))
    for k in range(8):
        g.f([ctr, rim[k], rim[(k + 1) % 8]], WATER, 0.0, out=(0, 0, 1))
    return p


@piece
def floor_water_knee():
    p = Piece('vlt_floor_water_knee', 2, 'water', gmode='const', footprint=[-1, -1, 1, 1],
              note='knee-deep water: an overlay 0.45 m over the floor (the floor tile stays); characters wade; tiles seamlessly (opacity 0.62 in A)')
    qz(p.g, -1, 1, -1, 1, KNEE, WATER, alpha=A_KNEE, gv=0.5)
    p.emit((0.35, -0.2, KNEE + 0.01), 'glint')
    return p


@piece
def floor_water_deep():
    p = Piece('vlt_floor_water_deep', 2, 'water', mount='hole', replaces_floor=True, gmode='const',
              footprint=[-1, -1, 1, 1], note='black deep water 0.35 m below the floor; replaces the floor tile; line it with vlt_quay_edge_2m')
    qz(p.g, -1, 1, -1, 1, DEEP, WATER, alpha=1.0, gv=0.3)
    p.emit((0.0, 0.0, DEEP + 0.15), 'fog')
    return p


@piece
def floor_water_edge():
    p = Piece('vlt_floor_water_edge', 4, 'water', gmode='const', extra=True,
              note='the soft shore: knee-deep water behind the origin (+Y, game -z) runs down to the dry floor in front and fades out over 1 m')
    g = p.g
    rows = [(0.0, KNEE, A_KNEE), (-0.45, 0.17, 0.30), (-1.0, 0.012, 0.0)]
    idx = [[g.v((-1, y, z), a, 0.5), g.v((1, y, z), a, 0.5)] for y, z, a in rows]
    for i in range(2):
        g.f([idx[i][0], idx[i][1], idx[i + 1][1], idx[i + 1][0]], WATER, 0.0, out=(0, 0, 1))
    return p


@piece
def floor_channel():
    p = Piece('vlt_floor_channel', 36, 'floor', mount='hole', replaces_floor=True, gmode='tile', footprint=[-1, -1, 1, 1],
              note='a 1 m sluice channel along local x (rotationY 90 runs it north-south), brass coping, water at -0.3: the Sluice Surge socket')
    g = p.g
    w = 0.5
    qz(g, -1, 1, -1, -0.62, 0.0, STONE)
    qz(g, -1, 1, 0.62, 1, 0.0, STONE)
    qz(g, -1, 1, -0.62, -w, 0.02, BRASS)
    qz(g, -1, 1, w, 0.62, 0.02, BRASS)
    qy(g, -1, 1, -0.3, 0.02, -w, STONE, out=1)
    qy(g, -1, 1, -0.75, -0.3, -w, DSTONE, out=1)
    qy(g, -1, 1, -0.3, 0.02, w, STONE, out=-1)
    qy(g, -1, 1, -0.75, -0.3, w, DSTONE, out=-1)
    qz(g, -1, 1, -w, w, -0.75, DSTONE)
    rows = [(-w, 0.40), (0.0, 0.68), (w, 0.40)]
    idx = [[g.v((-1, y, -0.3), 0.8, gg), g.v((1, y, -0.3), 0.8, gg)] for y, gg in rows]
    for i in range(2):
        g.f([idx[i][0], idx[i][1], idx[i + 1][1], idx[i + 1][0]], WATER, 0.0, out=(0, 0, 1))
    p.emit((0.0, 0.0, -0.28), 'flow')
    return p


@piece
def floor_anemone():
    p = Piece('vlt_floor_anemone', 180, 'floor', replaces_floor=True, gmode='tile', footprint=[-1, -1, 1, 1],
              note='a slab with a cluster of glowing anemones (emissive): the Anemone Floor trap skin')
    g = p.g
    slab(g, g_top=0.44)
    spots = [(-0.38, -0.28, 0.20), (0.20, -0.44, 0.26), (0.44, 0.10, 0.18), (-0.08, 0.26, 0.30), (0.06, -0.06, 0.15), (-0.52, 0.38, 0.14)]
    for i, (x, y, h) in enumerate(spots):
        r = 0.05 + h * 0.16
        prism(g, (x, y, 0), r, 0.0, h, 5, MOSS, cap_top=False, smooth=60.0, phase=i * 0.7)
        ctr = g.v((x, y, h + 0.012))
        rim = []
        for k in range(10):
            a = i * 0.7 + TAU * k / 10
            rr = r * (2.7 if k % 2 == 0 else 1.06)
            rim.append(g.v((x + math.cos(a) * rr, y + math.sin(a) * rr, h + (0.07 if k % 2 == 0 else 0.0))))
        for k in range(10):
            g.f([ctr, rim[k], rim[(k + 1) % 10]], GLOW, 35.0, out=(0, 0, 1))
    for (x, y) in ((0.5, -0.55), (-0.62, -0.05), (0.3, 0.55), (-0.25, -0.6)):
        cone(g, (x, y, 0), (x, y, 0.09), 0.035, 4, GLOW)
    p.emit((0.0, 0.0, 0.45), 'motes')
    return p


# ---------------------------------------------------------------- walls
@piece
def wall_vault():
    p = Piece('vlt_wall_vault_2m', 30, 'shell', mount='edge', gmode='wall',
              note='2 m dressed vault wall, 3.5 m: plinth, salt tide-line, verdigris drips, cornice; reaches 0.8 m below the floor')
    g = p.g
    wall_layers(g, -1, 1)
    cornice(g, -1, 1)
    for (xc, wt, wb, zb) in ((-0.52, 0.11, 0.035, 2.2), (0.36, 0.08, 0.03, 2.62)):
        g.poly([(xc - wb / 2, -0.008, zb), (xc + wb / 2, -0.008, zb), (xc + wt / 2, -0.008, 3.18), (xc - wt / 2, -0.008, 3.18)], MOSS, out=(0, -1, 0))
    return p


@piece
def wall_pipes():
    p = Piece('vlt_wall_pipes_2m', 180, 'shell', mount='edge', gmode='wall', extra=True,
              note='wall variant: the vault wall with two brass pipes and a valve wheel; the client mixes it into wall runs (never behind a wall prop)')
    g = p.g
    wall_layers(g, -1, 1)
    cornice(g, -1, 1)
    pipes = ((-0.42, 0.09, -0.17), (0.12, 0.06, -0.13))
    for (x, r, yo) in pipes:
        sweep(g, [(x, yo, -0.02), (x, yo, 3.22)], r, 6, BRASS, smooth=70.0)
        prism(g, (x, yo, 0), r * 1.7, 0.0, 0.09, 6, BRASS, cap_top=True, smooth=0.0)
    for (x, r, yo), z in ((pipes[0], 1.0), (pipes[0], 2.5), (pipes[1], 2.5)):
        box(g, (x - r - 0.025, yo - r - 0.025, z), (x + r + 0.025, 0.0, z + 0.09), IRON, skip=('+y', '-z'))
    sweep(g, [(-0.42, -0.17, 1.92), (0.12, -0.13, 1.92)], 0.045, 5, BRASS, smooth=70.0)
    flat_ring(g, (-0.15, -0.3, 1.92), 0.12, 0.165, 8, IRON, depth=0.03)
    g.poly([(-0.27, -0.31, 1.905), (-0.03, -0.31, 1.905), (-0.03, -0.31, 1.935), (-0.27, -0.31, 1.935)], IRON, out=(0, -1, 0))
    g.poly([(-0.165, -0.31, 1.8), (-0.135, -0.31, 1.8), (-0.135, -0.31, 2.04), (-0.165, -0.31, 2.04)], IRON, out=(0, -1, 0))
    cbox(g, (-0.15, -0.23, 1.92), (0.06, 0.12, 0.06), BRASS, skip=('+y',))
    p.emit((-0.15, -0.2, 1.75), 'drip')
    return p


@piece
def wall_cut():
    p = Piece('vlt_wall_cut_2m', 40, 'shell', mount='edge', gmode='wall', extra=True,
              note='the camera-facing wall cut down to about 0.55 m with a broken top and a back face (the client cuts walls that face the camera)')
    cut_section(p.g, [-1.0, -0.5, 0.0, 0.5, 1.0], [CUT_H, CUT_H + 0.09, CUT_H - 0.03, CUT_H + 0.12, CUT_H])
    return p


@piece
def wall_corner():
    p = Piece('vlt_wall_corner_in', 90, 'shell', mount='corner',
              note='inside corner post with a chained ring; at rotationY 0 the north-west corner (room toward +x/+z), NE -90, SE 180, SW 90; scale it down for cut corners')
    g = p.g

    def outline(d):
        return [(-0.42 - d, -0.22 - d), (0.10 + d * 0.4, -0.22 - d), (0.22 + d, -0.10 - d * 0.4), (0.22 + d, 0.42 + d), (-0.42 - d, 0.42 + d)]

    def ring(d, z):
        return [Vector((x, y, z)) for x, y in outline(d)]
    skin(g, [ring(0.0, 0.5), ring(0.0, 3.3)], STONE, 0.0)
    skin(g, [ring(0.05, SINK), ring(0.05, 0.5)], DSTONE, 0.0)
    a, b = ring(0.05, 0.5), ring(0.0, 0.5)
    for k in range(3):
        g.poly([a[k], a[k + 1], b[k + 1], b[k]], DSTONE, 0.0, out=(0, 0, 1))
    skin(g, [ring(0.05, 3.3), ring(0.05, 3.62)], BRASS, 0.0, cap1=True)
    n = Vector((1, -1, 0)).normalized()
    c = Vector((0.16, -0.16, 1.9)) + n * 0.05
    torus(g, 0.12, 0.018, 6, 3, IRON, mat=M(c, rz=45, rx=90))
    chain(g, [c + Vector((0, 0, -0.12)), c + Vector((0, 0, -0.44))], link=0.16, w=0.05, slot=IRON, normal=n)
    return p


def corner_outline(d):
    return [(-0.42 - d, -0.22 - d), (0.10 + d * 0.4, -0.22 - d), (0.22 + d, -0.10 - d * 0.4), (0.22 + d, 0.42 + d), (-0.42 - d, 0.42 + d)]


@piece
def wall_corner_cut():
    p = Piece('vlt_wall_corner_cut', 40, 'shell', mount='corner', extra=True,
              note='the corner post where a camera-facing wall meets it, cut to about 0.7 m with a broken top (kit_lib cornerCut)')
    g = p.g
    ring = lambda d, z: [Vector((x, y, z)) for x, y in corner_outline(d)]
    skin(g, [ring(0.05, SINK), ring(0.05, 0.5)], DSTONE, 0.0)
    a, b = ring(0.05, 0.5), ring(0.0, 0.5)
    for k in range(5):
        k2 = (k + 1) % 5
        g.poly([a[k], a[k2], b[k2], b[k]], DSTONE, 0.0, out=(0, 0, 1))
    tops = (0.68, 0.76, 0.63, 0.72, 0.8)
    jag = [Vector((x, y, t)) for (x, y), t in zip(corner_outline(0.0), tops)]
    skin(g, [ring(0.0, 0.5), jag], STONE, 0.0, cap1=True, cap_slot=DSTONE)
    return p


# ---------------------------------------------------------------- doors
def arch_pts(r, cz, n=8):
    """A semicircle of radius r centred at height cz, from the left springer over the crown to the right: [(x, z)]."""
    return [(math.cos(math.pi - math.pi * k / n) * r, cz + math.sin(math.pi - math.pi * k / n) * r) for k in range(n + 1)]


@piece
def door_arch():
    p = Piece('vlt_door_arch_iron', 300, 'shell', mount='edge', gmode='wall', width=4.0,
              note='the open doorway: 4 m wide (two wall segments) with a 2 m iron-bound round arch at its centre; origin at the doorway midpoint on the room face')
    g = p.g
    ri, ro, cz, n = 1.0, 1.28, 2.1, 8
    wall_layers(g, -2.0, -ro)
    wall_layers(g, ro, 2.0)
    cornice(g, -2.0, 2.0)
    inner = arch_pts(ri, cz, n)
    outer = arch_pts(ro, cz, n)
    yb = -0.08
    for k in range(n):
        (xi0, zi0), (xi1, zi1) = inner[k], inner[k + 1]
        (xo0, zo0), (xo1, zo1) = outer[k], outer[k + 1]
        g.poly([(xo0, 0, zo0), (xo1, 0, zo1), (xo1, 0, 3.18), (xo0, 0, 3.18)], STONE, out=(0, -1, 0))
        g.poly([(xi0, yb, zi0), (xo0, yb, zo0), (xo1, yb, zo1), (xi1, yb, zi1)], IRON, out=(0, -1, 0))
        g.poly([(xo0, yb, zo0), (xo1, yb, zo1), (xo1, 0, zo1), (xo0, 0, zo0)], IRON, 0.0, out=(xo0 + xo1, 0, zo0 + zo1 - 2 * cz))
        g.poly([(xi0, yb, zi0), (xi1, yb, zi1), (xi1, WALL_T, zi1), (xi0, WALL_T, zi0)], DSTONE, 0.0, out=(-(xi0 + xi1), 0, -(zi0 + zi1 - 2 * cz)))
    for s in (-1, 1):
        x_in, x_out = s * ri, s * ro
        g.poly([(x_in, yb, 0.0), (x_out, yb, 0.0), (x_out, yb, cz), (x_in, yb, cz)], IRON, out=(0, -1, 0))
        g.poly([(x_out, yb, 0.0), (x_out, 0.0, 0.0), (x_out, 0.0, cz), (x_out, yb, cz)], IRON, out=(s, 0, 0))
        g.poly([(x_in, yb, SINK), (x_in, WALL_T, SINK), (x_in, WALL_T, cz), (x_in, yb, cz)], DSTONE, out=(-s, 0, 0))
        for z in (0.95, 2.45):
            if abs(z - cz) < 0.2:
                continue
            x0, x1 = (min(s * 1.28, s * 2.0), max(s * 1.28, s * 2.0))
            qy(g, x0, x1, z, z + 0.12, -0.035, IRON)
            qz(g, x0, x1, -0.035, 0.0, z + 0.12, IRON)
        for z in (0.6, 1.45):
            stud(g, (s * 1.14, yb, z), 0.045, 0.035)
    qz(g, -ri, ri, yb, WALL_T, 0.015, DSTONE)
    for ang in (15, 40, 65, 115, 140, 165):
        a = math.radians(ang)
        stud(g, (math.cos(a) * 1.14, yb, cz + math.sin(a) * 1.14), 0.045, 0.035)
    # brass keystone at the crown
    kz0, kz1 = cz + 0.94, cz + 1.42
    g.poly([(-0.14, -0.2, kz0), (0.14, -0.2, kz0), (0.2, -0.2, kz1), (-0.2, -0.2, kz1)], BRASS, out=(0, -1, 0))
    g.poly([(-0.2, -0.2, kz1), (0.2, -0.2, kz1), (0.2, 0.0, kz1), (-0.2, 0.0, kz1)], BRASS, out=(0, 0, 1))
    g.poly([(-0.14, -0.2, kz0), (-0.2, -0.2, kz1), (-0.2, 0.0, kz1), (-0.14, 0.0, kz0)], BRASS, out=(-1, 0, 0))
    g.poly([(0.14, -0.2, kz0), (0.14, 0.0, kz0), (0.2, 0.0, kz1), (0.2, -0.2, kz1)], BRASS, out=(1, 0, 0))
    g.poly([(-0.14, -0.2, kz0), (-0.14, 0.0, kz0), (0.14, 0.0, kz0), (0.14, -0.2, kz0)], BRASS, out=(0, 0, -1))
    return p


@piece
def door_arch_cut():
    p = Piece('vlt_door_arch_cut', 60, 'shell', mount='edge', gmode='wall', width=4.0, extra=True,
              note='the open doorway on a camera-facing wall: the cut-down jambs and the iron band stubs')
    g = p.g
    cut_section(g, [-2.0, -1.64, -1.28], [CUT_H, CUT_H + 0.1, CUT_H + 0.2])
    cut_section(g, [1.28, 1.64, 2.0], [CUT_H + 0.2, CUT_H + 0.08, CUT_H])
    yb = -0.08
    for s in (-1, 1):
        x_in, x_out = s * 1.0, s * 1.28
        h = CUT_H + 0.3
        g.poly([(x_in, yb, 0.0), (x_out, yb, 0.0), (x_out, yb, h), (x_in, yb, h)], IRON, out=(0, -1, 0))
        g.poly([(x_in, yb, h), (x_out, yb, h), (x_out, WALL_T, h - 0.02), (x_in, WALL_T, h - 0.02)], IRON, out=(0, 0, 1))
        g.poly([(x_in, yb, SINK), (x_in, WALL_T, SINK), (x_in, WALL_T, h - 0.02), (x_in, yb, h)], DSTONE, out=(-s, 0, 0))
        g.poly([(x_in, WALL_T, SINK), (x_out, WALL_T, SINK), (x_out, WALL_T, h - 0.02), (x_in, WALL_T, h - 0.02)], IRON, out=(0, 1, 0))
    qz(g, -1.0, 1.0, yb, WALL_T, 0.015, DSTONE)
    return p


@piece
def door_vault():
    p = Piece('vlt_door_vault', 1100, 'shell', mount='edge', gmode='wall', width=4.0,
              note='the Locked-door skin: a round vault door in a brass-bolted collar; .door swings on its hinge (left, game -x side)')
    g = p.g
    cz, rc, ri, n = 1.59, 1.45, 1.1, 20
    wall_layers(g, -2.0, -1.5)
    wall_layers(g, 1.5, 2.0)
    cornice(g, -2.0, 2.0)
    qy(g, -1.5, 1.5, SINK, 0.0, 0.0, DSTONE)
    # the centre panel around the collar: a strip from the circle to the square [-1.5, 1.5] x [0, 3.18]
    circ = []
    sq = []
    for k in range(16):
        a = TAU * k / 16
        cx, cy = math.cos(a), math.sin(a)
        circ.append((cx * rc, cz + cy * rc))
        tx = 1.5 / abs(cx) if abs(cx) > 1e-6 else 1e9
        tz = ((3.18 - cz) if cy > 0 else cz) / abs(cy) if abs(cy) > 1e-6 else 1e9
        t = min(tx, tz)
        sq.append((cx * t, cz + cy * t))
    for k in (2, 6, 10, 14):
        sq[k] = (1.5 if k in (2, 14) else -1.5, 3.18 if k in (2, 6) else 0.0)
    for k in range(16):
        k2 = (k + 1) % 16
        g.poly([(circ[k][0], 0, circ[k][1]), (sq[k][0], 0, sq[k][1]), (sq[k2][0], 0, sq[k2][1]), (circ[k2][0], 0, circ[k2][1])], STONE, out=(0, -1, 0))
    # the collar: front annulus, outer rim, bore
    yf = -0.2
    flat_ring(g, (0, yf, cz), ri, rc, n, IRON, depth=-yf)
    for k in range(n):
        a0, a1 = TAU * k / n, TAU * (k + 1) / n
        p0 = (math.cos(a0) * ri, math.sin(a0) * ri)
        p1 = (math.cos(a1) * ri, math.sin(a1) * ri)
        g.poly([(p0[0], yf, cz + p0[1]), (p1[0], yf, cz + p1[1]), (p1[0], WALL_T, cz + p1[1]), (p0[0], WALL_T, cz + p0[1])], DSTONE, 20.0,
               out=(-(p0[0] + p1[0]), 0, -(p0[1] + p1[1])))
    for k in range(12):
        a = TAU * (k + 0.5) / 12
        stud(g, (math.cos(a) * 1.28, yf, cz + math.sin(a) * 1.28), 0.05, 0.05, BRASS)
    # hinge block and knuckles (left)
    box(g, (-1.52, -0.3, 0.6), (-1.36, yf, 2.6), IRON, skip=('+y',))
    for z0 in (0.75, 2.05):
        prism(g, (-1.32, -0.28, 0), 0.09, z0, z0 + 0.4, 6, IRON, cap_top=True, cap_bottom=True, smooth=60.0)
    # the door (its origin on the hinge axis)
    pv = Vector((-1.32, -0.28, cz))
    d = p.part('leaf', pv, 'swing', 'y', note='the round door on its hinge (the game -x side of the collar): open = rotation.y down to -1.9 rad, swinging into the room')
    rd = 1.07
    flat_ring(d, (0, -0.18, cz), 0.86, rd, n, BMETAL)
    for k in range(n):
        a0, a1 = TAU * k / n, TAU * (k + 1) / n
        for (r, y0, y1, slot, sgn) in ((0.86, -0.18, -0.12, IRON, -1), (rd, -0.18, 0.12, IRON, 1)):
            q0 = (math.cos(a0) * r, math.sin(a0) * r)
            q1 = (math.cos(a1) * r, math.sin(a1) * r)
            d.poly([(q0[0], y0, cz + q0[1]), (q1[0], y0, cz + q1[1]), (q1[0], y1, cz + q1[1]), (q0[0], y1, cz + q0[1])], slot, 30.0,
                   out=(sgn * (q0[0] + q1[0]), 0, sgn * (q0[1] + q1[1])))
    flat_ring(d, (0, -0.12, cz), 0.3, 0.86, n, IRON)
    back = [d.v((math.cos(TAU * k / n) * rd, 0.12, cz + math.sin(TAU * k / n) * rd)) for k in range(n)]
    d.f(back, IRON, 0.0, out=(0, 1, 0))
    lathe(d, [(0.3, 0.0), (0.3, 0.1), (0.14, 0.16), (0.0, 0.17)], 8, BRASS, smooth=40.0, mat=M((0, -0.12, cz), rx=90))
    torus(d, 0.5, 0.035, 12, 3, BRASS, mat=M((0, -0.33, cz), rx=90))
    for k in range(4):
        a = math.radians(45 + 90 * k)
        c = Vector((math.cos(a) * 0.4, -0.3, cz + math.sin(a) * 0.4))
        cbox(d, (0, 0, 0), (0.2, 0.05, 0.05), BRASS, skip=('+y',), mat=M(c, ry=-math.degrees(a)))
    for k in range(12):
        a = TAU * (k + 0.5) / 12
        stud(d, (math.cos(a) * 0.97, -0.18, cz + math.sin(a) * 0.97), 0.04, 0.035)
    for k in range(4):
        a = math.radians(90 * k)
        c = Vector((math.cos(a) * 1.08, -0.02, cz + math.sin(a) * 1.08))
        cbox(d, (0, 0, 0), (0.14, 0.12, 0.12), BRASS, mat=M(c, ry=-math.degrees(a)))
    box(d, (-1.36, -0.27, cz - 0.3), (-0.95, -0.17, cz + 0.3), IRON, skip=())
    return p


@piece
def door_sluice():
    p = Piece('vlt_door_sluice', 500, 'shell', mount='edge', gmode='wall', width=4.0,
              note='a sluice gate under a winch: the Tide Gate trap skin; .gate lifts straight up (game +y)')
    g = p.g
    wall_layers(g, -2.0, -1.4)
    wall_layers(g, 1.4, 2.0)
    cornice(g, -2.0, 2.0)
    qy(g, -1.4, 1.4, 3.15, 3.18, 0.0, STONE)
    for s in (-1, 1):
        x0, x1 = sorted((s * 1.0, s * 1.4))
        box(g, (x0, -0.25, SINK), (x1, WALL_T, 3.0), DSTONE, skip=('+y', '-z'), slots={('-x' if s > 0 else '+x'): IRON})
    box(g, (-1.4, -0.3, 2.75), (1.4, WALL_T, 3.15), DWOOD, skip=('+y',))
    for x in (-0.6, 0.6):
        box(g, (x - 0.08, -0.31, 2.74), (x + 0.08, 0.0, 3.16), BRASS, skip=('+y', '-x', '+x'))
    lathe(g, [(0.18, -0.9), (0.18, 0.9)], 8, WOOD, smooth=60.0, cap0=True, cap1=True, mat=M((0, -0.34, 3.36), ry=90))
    for x in (-1.0, 1.0):
        lathe(g, [(0.3, -0.05), (0.3, 0.05)], 10, BRASS, smooth=0.0, cap0=True, cap1=True, mat=M((x, -0.34, 3.36), ry=90))
        box(g, (x - 0.06 if x < 0 else x - 0.1, -0.44, 3.15), (x + 0.1 if x < 0 else x + 0.06, -0.14, 3.42), IRON, skip=('-z', '+y'))
    for x in (-0.6, 0.6):
        chain(g, [(x, -0.4, 3.22), (x, -0.13, 2.66)], link=0.15, w=0.06, slot=IRON)
    qz(g, -1.0, 1.0, -0.25, WALL_T, 0.015, DSTONE)
    # the gate (origin at the sill, centre)
    gt = p.part('gate', (0, -0.05, 0.0), 'lift', 'y', note='lifts straight up into the winch: open = position.y + 2.6')
    xs = [-1.05, -0.63, -0.21, 0.21, 0.63, 1.05]
    for i in range(5):
        qy(gt, xs[i], xs[i + 1], 0.0, 2.7, -0.08, WOOD if i % 2 == 0 else DWOOD)
    qy(gt, -1.05, 1.05, 0.0, 2.7, 0.08, DWOOD, out=1)
    qz(gt, -1.05, 1.05, -0.08, 0.08, 2.7, DWOOD)
    qx(gt, -0.08, 0.08, 0.0, 2.7, -1.05, DWOOD, out=-1)
    qx(gt, -0.08, 0.08, 0.0, 2.7, 1.05, DWOOD, out=1)
    for z in (0.35, 1.35, 2.35):
        box(gt, (-1.07, -0.11, z), (1.07, -0.08, z + 0.16), IRON, skip=('+y', '-x', '+x'))
        for x in (-0.84, 0.0, 0.84):
            stud(gt, (x, -0.11, z + 0.08), 0.035, 0.03, BRASS)
    zz = [(-1.05, 0.0), (-0.7, 0.22), (-0.35, 0.05), (0.0, 0.26), (0.35, 0.04), (0.7, 0.2), (1.05, 0.0)]
    for i in range(len(zz) - 1):
        (xa, za), (xb, zb) = zz[i], zz[i + 1]
        gt.poly([(xa, -0.085, 0.0), (xb, -0.085, 0.0), (xb, -0.085, zb + 0.06), (xa, -0.085, za + 0.06)], MOSS, out=(0, -1, 0))
    for x in (-0.6, 0.6):
        flat_ring(gt, (x, -0.1, 2.62), 0.05, 0.09, 6, IRON)
    return p


def shelf_unit(g, x0, x1, y_back, depth, rnd, levels=(0.15, 0.78, 1.41, 2.04), top=2.55, boxes=6, kelp=True):
    """A treasury shelf against a wall: iron uprights, dark boards with brass lips, empty strongboxes with open lids."""
    yb, yf = y_back, y_back - depth
    qy(g, x0 + 0.07, x1 - 0.07, 0.1, top, yb - 0.01, DWOOD)
    for (a, b) in ((x0, x0 + 0.07), (x1 - 0.07, x1)):
        box(g, (a, yf, 0.0), (b, yb, top), IRON, skip=('+y', '-z'))
    for z in levels:
        box(g, (x0 + 0.07, yf, z), (x1 - 0.07, yb, z + 0.06), DWOOD, skip=('+y', '-x', '+x'), slots={'-y': BRASS})
    box(g, (x0 - 0.02, yf - 0.04, top), (x1 + 0.02, yb, top + 0.1), BRASS, skip=('+y', '-z'))
    span = (x1 - x0) - 0.3
    for i in range(boxes):
        lvl = levels[i % len(levels)] + 0.06
        bw, bd, bh = rnd.uniform(0.28, 0.4), rnd.uniform(0.22, 0.3), rnd.uniform(0.17, 0.25)
        bx = x0 + 0.15 + bw / 2 + ((i * 0.37 + rnd.uniform(0.0, 0.2)) % 1.0) * (span - bw)
        by = yb - 0.06 - bd / 2
        box(g, (bx - bw / 2, by - bd / 2, lvl), (bx + bw / 2, by + bd / 2, lvl + bh), IRON, skip=('+y', '-z', '+z'))
        qz(g, bx - bw / 2 + 0.02, bx + bw / 2 - 0.02, by - bd / 2 + 0.02, by + bd / 2 - 0.02, lvl + bh - 0.04, INK)
        qy(g, bx - bw / 2, bx + bw / 2, lvl + bh * 0.45, lvl + bh * 0.62, by - bd / 2 - 0.006, BRASS)
        lean = rnd.uniform(0.05, 0.12)
        g.poly([(bx - bw / 2, by + bd / 2, lvl + bh), (bx + bw / 2, by + bd / 2, lvl + bh),
                (bx + bw / 2, by + bd / 2 + lean, lvl + bh + bd * 0.95), (bx - bw / 2, by + bd / 2 + lean, lvl + bh + bd * 0.95)], IRON, out=(0, -1, 0.2))
    if kelp:
        ribbon(g, [(x0 + 0.32, yf - 0.012, top), (x0 + 0.36, yf - 0.02, top - 0.5), (x0 + 0.3, yf - 0.02, top - 1.05)], 0.08, MOSS)
        ribbon(g, [(x1 - 0.5, yf - 0.012, levels[2] + 0.06), (x1 - 0.47, yf - 0.02, levels[2] - 0.4)], 0.06, MOSS)
    for k in range(4):
        barnacle(g, (x0 + 0.1 + rnd.uniform(0, x1 - x0 - 0.2), yf - 0.02, rnd.uniform(0.02, 0.12)), rnd.uniform(0.025, 0.04), up=(0, -1, 0.3))


@piece
def wall_shelf():
    p = Piece('vlt_wall_shelf_2m', 280, 'wall', mount='wall',
              note='treasury shelf wall with empty strongboxes; hung 0.1 m in front of a wall (templates: room edge - 0.1)')
    shelf_unit(p.g, -1.0, 1.0, 0.1, 0.55, random.Random(3))
    return p


@piece
def door_secret():
    p = Piece('vlt_door_secret', 300, 'shell', mount='edge', gmode='wall', width=4.0,
              note='a shelf wall that pivots: identical to a wall with a treasury shelf until found; .panel turns about its centre')
    g = p.g
    wall_layers(g, -2.0, -1.0)
    wall_layers(g, 1.0, 2.0)
    cornice(g, -2.0, 2.0)
    qy(g, -1.0, 1.0, 3.0, 3.18, 0.0, STONE)
    for s in (-1, 1):
        qx(g, 0.0, WALL_T, SINK, 3.0, s * 1.0, DSTONE, out=-s)
    qz(g, -1.0, 1.0, 0.0, WALL_T, 3.0, DSTONE, out=-1)
    pn = p.part('panel', (0, 0.2, 0.0), 'pivot', 'y', note='the shelf wall turns about its centre: open = rotation.y ±1.57 rad')
    wall_layers(pn, -0.98, 0.98, top=3.0)
    qy(pn, -0.98, 0.98, SINK, 3.0, WALL_T - 0.02, DSTONE, out=1)
    shelf_unit(pn, -0.95, 0.95, -0.07, 0.42, random.Random(5), levels=(0.55, 1.15, 1.75), top=2.3, boxes=4)
    return p


@piece
def wall_breach():
    p = Piece('vlt_wall_breach', 400, 'wall', mount='wall',
              note='a wall burst inward by water: the dark hole in a rim of broken blocks, a waterfall sheet, its soft-edged pool, rubble and a burst brass pipe')
    g = p.g
    rnd = random.Random(11)
    hz, R = 1.95, 0.72
    ctr = g.v((0, 0.085, hz))
    rim = [g.v((math.cos(TAU * k / 9) * R * 1.08, 0.085, hz + math.sin(TAU * k / 9) * R)) for k in range(9)]
    for k in range(9):
        g.f([ctr, rim[k], rim[(k + 1) % 9]], INK, 0.0, out=(0, -1, 0))
    for k in range(9):
        a = TAU * k / 9 + rnd.uniform(-0.12, 0.12)
        dep = rnd.uniform(0.28, 0.42)
        c = Vector((math.cos(a) * (R + 0.2), 0.1 - dep / 2, hz + math.sin(a) * (R + 0.16)))
        size = (rnd.uniform(0.34, 0.46), dep, rnd.uniform(0.26, 0.36))
        cbox(g, (0, 0, 0), size, STONE if k % 3 else DSTONE, skip=('+y',),
             mat=M(c, ry=-math.degrees(a) + rnd.uniform(-12, 12), rz=rnd.uniform(-8, 8), rx=rnd.uniform(-8, 8)))
    prof = [(-0.02, 1.36), (-0.22, 1.27), (-0.42, 1.02), (-0.58, 0.66), (-0.70, 0.30), (-0.78, 0.05)]
    wid = [0.62, 0.66, 0.72, 0.80, 0.88, 0.96]
    rows = []
    for (y, z), w in zip(prof, wid):
        rows.append([g.v((-w / 2, y, z), 0.82, 0.42), g.v((0.0, y - 0.02, z), 0.82, 0.70), g.v((w / 2, y, z), 0.82, 0.42)])
    for i in range(len(rows) - 1):
        for j in range(2):
            g.f([rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]], WATER, 30.0, out=(0, -1, 0.4))
    disc_pool(g, (0, -0.95, 0), 0.75, 1.55, 10, 0.035, 0.008, 0.72, 0.0, sy=0.62, g_c=0.62)
    flat = Vector((0, -0.8, 0.055))
    fr = [g.v(flat + Vector((math.cos(TAU * k / 6) * 0.2, math.sin(TAU * k / 6) * 0.14, 0))) for k in range(6)]
    fo = [g.v(flat + Vector((math.cos(TAU * k / 6) * 0.42, math.sin(TAU * k / 6) * 0.28, -0.02))) for k in range(6)]
    for k in range(6):
        g.f([fr[k], fo[k], fo[(k + 1) % 6], fr[(k + 1) % 6]], BONE, 0.0, out=(0, 0, 1))
    spots = [(-1.25, -0.35), (-1.05, -1.25), (-0.45, -1.78), (0.6, -1.72), (1.2, -1.1), (1.38, -0.42), (-0.72, -0.22), (0.78, -0.2), (0.15, -1.98)]
    for k, (x, y) in enumerate(spots):
        rock(g, (x, y, 0), (rnd.uniform(0.12, 0.24), rnd.uniform(0.1, 0.2), rnd.uniform(0.1, 0.22)), STONE if k % 2 else DSTONE, rnd, n=4)
    for x in (-1.15, 1.2):
        rock(g, (x, -0.1, 0), (0.22, 0.2, 0.34), DSTONE, rnd, n=5)
    sweep(g, [(0.98, 0.12, 2.6), (0.98, -0.12, 2.6), (0.88, -0.34, 2.46)], 0.07, 5, BRASS, smooth=70.0)
    end = Vector((0.88, -0.34, 2.46))
    t = (end - Vector((0.98, -0.12, 2.6))).normalized()
    x_, y_ = frame(t)
    ring1 = [end + x_ * math.cos(TAU * k / 5) * 0.07 + y_ * math.sin(TAU * k / 5) * 0.07 for k in range(5)]
    ring2 = [end + t * 0.05 + x_ * math.cos(TAU * k / 5) * 0.1 + y_ * math.sin(TAU * k / 5) * 0.1 for k in range(5)]
    skin(g, [ring1, ring2], BRASS, 0.0)
    prism(g, (0.98, 0.0, 0), 0.11, -0.02, 0.06, 6, BRASS, cap_top=True, smooth=0.0, mat=M((0, 0.06, 2.6), rx=90))
    ribbon(g, [(0.92, 0.075, 2.45), (0.95, 0.075, 1.9), (0.9, 0.075, 1.35)], 0.09, MOSS)
    p.emit((0.0, -0.8, 0.2), 'splash')
    p.emit((0.0, -0.05, 2.5), 'drip')
    p.emit((0.86, -0.4, 2.4), 'drip')
    return p


# ---------------------------------------------------------------- props
@piece
def pillar_chained():
    p = Piece('vlt_pillar_chained', 140, 'prop',
              note='square 3.5 m pillar with chamfered corners, a salt line, wrapped in chain, barnacles at the foot, a brass cap')
    g = p.g
    s, ch = 0.33, 0.09
    octo = [(s - ch, -s), (s, -s + ch), (s, s - ch), (s - ch, s), (-s + ch, s), (-s, s - ch), (-s, -s + ch), (-s + ch, -s)]
    box(g, (-0.43, -0.43, 0.0), (0.43, 0.43, 0.4), DSTONE, skip=('-z',))
    rings = [[Vector((x, y, z)) for x, y in octo] for z in (0.4, 1.24, 1.29, 3.2)]
    skin(g, rings, STONE, 0.0, slot_fn=lambda i, j: (STONE, BONE, STONE)[i])
    box(g, (-0.42, -0.42, 3.2), (0.42, 0.42, 3.5), BRASS, skip=('-z',))
    helix = []
    for k in range(25):
        t = k / 24
        a = 2.2 * TAU * t + 0.4
        helix.append((math.cos(a) * 0.415, math.sin(a) * 0.415, 0.62 + 2.3 * t))
    chain(g, helix, link=0.25, w=0.08, slot=IRON, alt_slot=BMETAL, normal_fn=lambda q: Vector((q.x, q.y, 0)).normalized())
    rnd = random.Random(21)
    for k in range(4):
        a = TAU * k / 4 + 0.5
        barnacle(g, (math.cos(a) * 0.44, math.sin(a) * 0.44, 0.06 + rnd.uniform(0, 0.25)), 0.05, up=(math.cos(a), math.sin(a), 0.4))
    return p


@piece
def plinth_sentinel():
    p = Piece('vlt_plinth_sentinel', 260, 'prop',
              note='a plinth with a dormant kneeling construct (.construct: hide it when the bestiary Vault Sentinel stands up); the core glows')
    g = p.g
    box(g, (-0.75, -0.75, 0.0), (0.75, 0.75, 0.3), DSTONE, skip=('-z',))
    box(g, (-0.6, -0.6, 0.3), (0.6, 0.6, 0.55), BRASS, skip=('-z',), slots={'+z': DSTONE})
    c = p.part('construct', (0, 0, 0.55), 'none', 'none', note='the dormant construct: hide it when the Vault Sentinel (the bestiary mesh) stands up from the plinth')
    b = 0.55
    cbox(c, (0, 0.05, b + 0.62), (0.5, 0.32, 0.22), BRASS, skip=('-z',))
    lathe(c, [(0.3, 0.0), (0.42, 0.56)], 4, BRASS, smooth=0.0, cap1=True, phase=math.pi / 4, sy=0.62,
          slot_fn=lambda i, j: MOSS if j == 1 else BRASS, mat=M((0, 0.04, b + 0.72), rx=14))
    bipyramid(c, (0, -0.25, b + 1.0), 0.08, 0.09, 0.09, 4, GEM, phase=math.pi / 4, squash=0.6)
    cbox(c, (0, 0, 0), (0.28, 0.3, 0.3), BRASS, skip=('-z',), mat=M((0, -0.18, b + 1.42), rx=28))
    qy(c, -0.1, 0.1, b + 1.42, b + 1.46, -0.335, INK)
    for sx in (-1, 1):
        cbox(c, (0, 0, 0), (0.28, 0.36, 0.2), BRASS, skip=('-z',), slots={'+z': MOSS}, mat=M((sx * 0.43, 0.0, b + 1.3), rx=12, ry=sx * 14))
        sweep(c, [(sx * 0.42, 0.0, b + 1.22), (sx * 0.4, -0.22, b + 0.95), (sx * 0.1, -0.44, b + 0.86)], 0.085, 4, BRASS, smooth=0.0, phase=math.pi / 4)
    sweep(c, [(0.17, 0.05, b + 0.6), (0.2, -0.42, b + 0.56), (0.2, -0.44, b + 0.1)], 0.1, 4, BRASS, smooth=0.0, phase=math.pi / 4)
    sweep(c, [(-0.17, 0.05, b + 0.58), (-0.18, -0.22, b + 0.1), (-0.18, 0.38, b + 0.1)], 0.1, 4, BRASS, smooth=0.0, phase=math.pi / 4)
    cbox(c, (0.2, -0.5, b + 0.06), (0.18, 0.3, 0.12), IRON, skip=('-z',))
    cbox(c, (-0.18, 0.48, b + 0.08), (0.16, 0.14, 0.24), IRON, skip=('-z',))
    cbox(c, (0, -0.56, b + 0.48), (0.12, 0.035, 0.86), BMETAL, skip=('-z',))
    cbox(c, (0, -0.56, b + 0.94), (0.42, 0.07, 0.07), BRASS)
    prism(c, (0, -0.56, 0), 0.03, b + 0.97, b + 1.17, 4, DWOOD, cap_top=False, smooth=0.0)
    bipyramid(c, (0, -0.56, b + 1.2), 0.05, 0.05, 0.03, 4, BRASS)
    p.emit((0, -0.3, b + 1.0), 'glow')
    return p


def cult_lamp(g, base, h=1.62, s=1.0, legs=True):
    """An oil lamp with a blue flame on an iron stand; returns the flame's light point."""
    bx, by, bz = base
    if legs:
        for k in range(3):
            a = TAU * k / 3 + math.pi / 2
            sweep(g, [(bx + math.cos(a) * 0.3 * s, by + math.sin(a) * 0.3 * s, bz), (bx + math.cos(a) * 0.05 * s, by + math.sin(a) * 0.05 * s, bz + 0.38 * s)],
                  0.025 * s, 3, IRON, smooth=0.0)
        prism(g, (bx, by, 0), 0.035 * s, bz + 0.3 * s, bz + h - 0.2 * s, 5, IRON, cap_top=False, smooth=60.0)
        prism(g, (bx, by, 0), 0.06 * s, bz + 0.98 * s, bz + 1.04 * s, 6, BRASS, cap_top=True, cap_bottom=True, smooth=0.0)
    top = bz + h
    lathe(g, [(0.04 * s, top - 0.22 * s), (0.15 * s, top - 0.16 * s), (0.21 * s, top - 0.08 * s), (0.19 * s, top - 0.04 * s)], 6, BRASS,
          c=(bx, by, 0), smooth=45.0, cap1=True, cap_slot=INK)
    bipyramid(g, (bx, by, top + 0.02 * s), 0.075 * s, 0.24 * s, 0.06 * s, 5, GLOW)
    return (bx, by, top + 0.1 * s)


@piece
def lamp_cult():
    p = Piece('vlt_lamp_cult', 110, 'prop', note='an oil lamp with a blue flame on an iron tripod (light_0 at the flame)')
    p.light(cult_lamp(p.g, (0, 0, 0)), CYAN, 'lamp')
    return p


def small_lamp(g, base, s=1.0):
    """A squat brass lamp standing on a surface (altar, gallery rail); returns the flame point."""
    bx, by, bz = base
    prism(g, (bx, by, 0), 0.04 * s, bz, bz + 0.18 * s, 6, BRASS, cap_top=False, smooth=50.0)
    lathe(g, [(0.05 * s, bz + 0.16 * s), (0.17 * s, bz + 0.24 * s), (0.15 * s, bz + 0.31 * s)], 6, BRASS, c=(bx, by, 0), smooth=45.0,
          cap1=True, cap_slot=INK)
    bipyramid(g, (bx, by, bz + 0.33 * s), 0.065 * s, 0.22 * s, 0.05 * s, 5, GLOW)
    return (bx, by, bz + 0.42 * s)


@piece
def altar_tide():
    p = Piece('vlt_altar_tide', 700, 'prop',
              note='the Tide Altar: a black altar on a two-step dais (above knee water), a scallop-shell basin, the wave sigil and three cult lamps')
    g = p.g
    rnd = random.Random(31)
    box(g, (-1.6, -1.25, 0.0), (1.6, 1.15, 0.3), DSTONE, skip=('-z',))
    box(g, (-1.3, -0.95, 0.3), (1.3, 0.95, 0.6), DSTONE, skip=('-z',))
    qy(g, -1.3, 1.3, 0.52, 0.6, -0.958, BRASS)
    box(g, (-0.85, -0.42, 0.6), (0.85, 0.42, 1.48), DSTONE, skip=('-z',))
    box(g, (-0.87, -0.44, 1.24), (0.87, 0.44, 1.36), BRASS, skip=('-z', '+z', '+y'))
    box(g, (-0.95, -0.5, 1.48), (0.95, 0.5, 1.6), DSTONE, skip=('-z',))
    wave = [(-0.55, 1.0), (-0.36, 1.13), (-0.18, 0.99), (0.0, 1.13), (0.18, 0.99), (0.36, 1.13), (0.55, 1.0)]
    ribbon(g, [(x, -0.428, z) for x, z in wave], 0.05, GLOW, normal=(0, -1, 0))
    # the scallop basin, hinge at the back
    hinge = Vector((0, 0.36, 1.62))
    rim, mid = [], []
    for k in range(10):
        th = math.radians(-78 + 156 * k / 9)
        bump = 0.04 if k % 2 == 0 else 0.0
        rim.append(hinge + Vector((math.sin(th) * 0.62, -math.cos(th) * 0.76, 0.17 + bump)))
        mid.append(hinge + Vector((math.sin(th) * 0.33, -math.cos(th) * 0.4, 0.05 + bump * 0.5)))
    hv = g.v(hinge)
    mv = [g.v(q) for q in mid]
    rv = [g.v(q) for q in rim]
    for k in range(9):
        g.f([hv, mv[k], mv[k + 1]], BONE, 25.0, out=(0, 0, 1))
        g.f([mv[k], rv[k], rv[k + 1], mv[k + 1]], BONE, 25.0, out=(0, 0, 1))
    for k in range(9):
        a, b = rim[k], rim[k + 1]
        o = (a + b) / 2 - hinge
        g.poly([a, b, Vector((b.x, b.y, 1.6)), Vector((a.x, a.y, 1.6))], BONE, 0.0, out=(o.x, o.y, 0))
    wc = g.v(hinge + Vector((0, -0.38, 0.12)), 0.85, 0.55)
    wr = [g.v(Vector((hinge.x + (q.x - hinge.x) * 0.86, hinge.y + (q.y - hinge.y) * 0.86, 1.75)), 0.85, 0.5) for q in rim]
    for k in range(9):
        g.f([wc, wr[k], wr[k + 1]], WATER, 0.0, out=(0, 0, 1))
    for (x, y) in ((-0.15, -0.05), (0.12, 0.02), (0.02, -0.18)):
        bipyramid(g, (x, y, 1.79), 0.035, 0.035, 0.03, 4, GEM)
    p.light(small_lamp(g, (-0.72, -0.28, 1.6)), CYAN, 'lamp')
    p.light(small_lamp(g, (0.72, -0.28, 1.6)), CYAN, 'lamp')
    p.light(cult_lamp(g, (0.0, 0.78, 0.6), h=1.75), CYAN, 'lamp')
    for x in (-0.6, 0.2, 0.75):
        ribbon(g, [(x, -0.51, 1.61), (x + 0.03, -0.53, 1.35), (x - 0.02, -0.52, 1.0)], 0.07, MOSS)
    for k in range(8):
        a = rnd.uniform(0, TAU)
        barnacle(g, (math.cos(a) * 1.45, math.sin(a) * 1.05, rnd.uniform(0.05, 0.22)), 0.045, up=(math.cos(a), math.sin(a), 0.3))
    return p


@piece
def wheel_sluice():
    p = Piece('vlt_wheel_sluice', 380, 'prop',
              note='the 2 m iron sluice wheel on its pedestal, its brass pipe going into the floor; .wheel turns about the front axis (game z)')
    g = p.g
    box(g, (-0.35, -0.3, 0.0), (0.35, 0.3, 1.15), DSTONE, skip=('-z',))
    box(g, (-0.28, -0.32, 1.15), (0.28, 0.25, 1.62), IRON, skip=('-z',))
    box(g, (-0.29, -0.33, 1.36), (0.29, 0.26, 1.44), BRASS, skip=('-z', '+z'))
    sweep(g, [(0, -0.3, 1.5), (0, -0.6, 1.5)], 0.05, 6, BMETAL, smooth=60.0)
    sweep(g, [(0, 0.22, 1.42), (0, 0.62, 1.42), (0, 0.62, -0.05)], 0.11, 6, BRASS, smooth=60.0)
    prism(g, (0, 0, 0), 0.15, -0.04, 0.04, 6, BRASS, cap_top=True, cap_bottom=True, smooth=0.0, mat=M((0, 0.27, 1.42), rx=90))
    prism(g, (0, 0.62, 0), 0.16, 0.0, 0.08, 6, BRASS, cap_top=True, smooth=0.0)
    w = p.part('wheel', (0, -0.62, 1.5), 'turn', 'z', note='turns about its axle (the game z axis): a quarter turn or more when the wheel is used')
    torus(w, 0.95, 0.055, 14, 3, IRON, mat=M((0, -0.66, 1.5), rx=90), slot_fn=lambda i, j: MOSS if i in (3, 4, 10) and j == 0 else IRON)
    for k in range(6):
        a = TAU * k / 6
        cbox(w, (0, 0, 0), (0.9, 0.05, 0.06), IRON, skip=('+y',), mat=M((math.cos(a) * 0.5, -0.66, 1.5 + math.sin(a) * 0.5), ry=-math.degrees(a)))
        sweep(w, [(math.cos(a) * 1.0, -0.66, 1.5 + math.sin(a) * 1.0), (math.cos(a) * 1.17, -0.66, 1.5 + math.sin(a) * 1.17)], 0.032, 4, BRASS, smooth=0.0, cap1=True)
    lathe(w, [(0.14, 0.0), (0.14, 0.12), (0.0, 0.14)], 6, BRASS, smooth=40.0, mat=M((0, -0.62, 1.5), rx=90))
    return p


@piece
def cage_thrall():
    p = Piece('vlt_cage_thrall', 460, 'prop',
              note='a half-sunk iron cage with a slumped drowned thrall, in its own soft-edged pool (the Thrall\'s Cage curio)')
    g = p.g
    rnd = random.Random(41)
    disc_pool(g, (0, 0, 0), 0.95, 1.55, 12, 0.34, 0.01, A_KNEE, 0.0)
    mk = g.mark()
    R = 0.62
    for k in range(8):
        a = TAU * k / 8
        sweep(g, [(math.cos(a) * R, math.sin(a) * R, -0.06), (math.cos(a) * R, math.sin(a) * R, 1.75)], 0.03, 4, IRON, smooth=0.0)
    for z in (0.15, 0.95, 1.72):
        skin(g, [ring_pts((0, 0, z), R + 0.035, 8, math.pi / 8), ring_pts((0, 0, z + 0.07), R + 0.035, 8, math.pi / 8)], IRON, 30.0)
    for k in range(4):
        a = TAU * k / 4 + math.pi / 8
        pts = []
        for t in (0.0, 0.5, 1.0):
            rr = R * math.cos(t * math.pi / 2)
            pts.append((math.cos(a) * rr, math.sin(a) * rr, 1.75 + math.sin(t * math.pi / 2) * 0.42))
        sweep(g, pts, 0.03, 4, IRON, smooth=0.0)
    torus(g, 0.1, 0.025, 6, 3, BRASS, mat=M((0, 0, 2.27), rx=90))
    cbox(g, (0, -R - 0.04, 1.0), (0.1, 0.06, 0.16), BRASS)
    g.xform(M((0, 0, 0), rx=-7, ry=6), mk)
    f = p.part('prisoner', (0, 0.05, 0.0), 'none', 'none', note='the slumped thrall: hide it when it wakes free, attacks (the Drowned Thrall monster) or dissolves')
    cbox(f, (0, 0, 0), (0.36, 0.22, 0.5), CLOTH1, skip=('-z',), mat=M((0, 0.12, 0.38), rx=24))
    bipyramid(f, (0, -0.06, 0.72), 0.12, 0.12, 0.12, 4, BONE, phase=math.pi / 4)
    ribbon(f, [(-0.05, -0.1, 0.8), (-0.06, -0.17, 0.6), (-0.04, -0.2, 0.45)], 0.07, MOSS)
    ribbon(f, [(0.06, -0.1, 0.8), (0.07, -0.18, 0.62)], 0.06, MOSS)
    for sx in (-1, 1):
        sweep(f, [(sx * 0.2, 0.08, 0.58), (sx * 0.2, -0.22, 0.3)], 0.05, 4, BONE, smooth=0.0)
        sweep(f, [(sx * 0.12, 0.12, 0.12), (sx * 0.14, -0.24, 0.36), (sx * 0.14, -0.36, -0.05)], 0.065, 4, CLOTH1, smooth=0.0)
    for k in range(3):
        barnacle(f, (rnd.uniform(-0.15, 0.15), 0.0 + rnd.uniform(-0.05, 0.05), 0.55 + rnd.uniform(0, 0.12)), 0.035, up=(0, -0.3, 1))
    for k in range(6):
        a = TAU * k / 6 + 0.4
        barnacle(g, (math.cos(a) * (R + 0.05), math.sin(a) * (R + 0.05), 0.2 + rnd.uniform(0.0, 0.6)), 0.04, up=(math.cos(a), math.sin(a), 0.2))
    for k in range(3):
        a = TAU * k / 3 + 1.0
        ribbon(g, [(math.cos(a) * (R + 0.06), math.sin(a) * (R + 0.06), 1.0), (math.cos(a) * (R + 0.07), math.sin(a) * (R + 0.07), 0.6),
                   (math.cos(a) * (R + 0.06), math.sin(a) * (R + 0.06), 0.3)], 0.06, MOSS, normal=(math.cos(a), math.sin(a), 0))
    p.emit((0.3, -0.2, 0.36), 'bubbles')
    return p


@piece
def chest_drowned():
    p = Piece('vlt_chest_drowned', 560, 'prop',
              note='a large iron-banded chest lying on its side in its own shallow pool, weed-wrapped and barnacled (the Drowned Chest curio)')
    g = p.g
    rnd = random.Random(51)
    disc_pool(g, (0, 0, 0), 1.0, 1.7, 12, 0.3, 0.01, A_KNEE, 0.0)
    mk = g.mark()
    box(g, (-0.65, -0.36, 0.0), (0.65, 0.36, 0.5), DWOOD)
    prof = [(math.cos(math.pi * k / 8) * 0.36, 0.5 + math.sin(math.pi * k / 8) * 0.22) for k in range(9)]
    for k in range(8):
        (y0, z0), (y1, z1) = prof[k], prof[k + 1]
        g.poly([(-0.65, y0, z0), (0.65, y0, z0), (0.65, y1, z1), (-0.65, y1, z1)], WOOD, 30.0, out=(0, y0 + y1, z0 + z1 - 1.0))
    for sx in (-1, 1):
        cap = [g.v((sx * 0.65, y, z)) for y, z in prof]
        g.f(cap, WOOD, 0.0, out=(sx, 0, 0))
    for x in (-0.42, 0.42):
        for k in range(8):
            (y0, z0), (y1, z1) = prof[k], prof[k + 1]
            g.poly([(x - 0.06, y0 * 1.04, 0.5 + (z0 - 0.5) * 1.15), (x + 0.06, y0 * 1.04, 0.5 + (z0 - 0.5) * 1.15),
                    (x + 0.06, y1 * 1.04, 0.5 + (z1 - 0.5) * 1.15), (x - 0.06, y1 * 1.04, 0.5 + (z1 - 0.5) * 1.15)], IRON, 30.0, out=(0, y0 + y1, z0 + z1 - 1.0))
        qy(g, x - 0.06, x + 0.06, 0.0, 0.5, -0.375, IRON)
        qy(g, x - 0.06, x + 0.06, 0.0, 0.5, 0.375, IRON, out=1)
    for x in (-0.25, 0.25):
        cbox(g, (x, -0.385, 0.42), (0.1, 0.03, 0.16), BRASS)
    cbox(g, (0, -0.385, 0.4), (0.16, 0.035, 0.14), BRASS)
    g.xform(M((0, -0.36, 0), rx=-90), mk)
    g.xform(M((0, 0, 0.31), rz=192, ry=8), mk)
    for k in range(5):
        x = -0.5 + k * 0.25 + rnd.uniform(-0.05, 0.05)
        ribbon(g, [(x, -0.62, 0.0), (x + 0.02, -0.45, 0.42), (x + 0.04, -0.05, 0.66), (x + 0.03, 0.35, 0.52), (x + 0.05, 0.5, 0.0)],
               0.07, MOSS, normal=(0, 0, 1))
    for k in range(10):
        barnacle(g, (rnd.uniform(-0.6, 0.6), rnd.uniform(-0.4, 0.3), 0.6 + rnd.uniform(-0.05, 0.05)), rnd.uniform(0.03, 0.05))
    return p


@piece
def jar_leech():
    p = Piece('vlt_jar_leech', 120, 'wall', mount='wall',
              note='a glass jar of black leeches on a small wall shelf, one of them very large (the Leech Jar curio); hung 0.1 m in front of a wall')
    g = p.g
    box(g, (-0.32, -0.22, 1.25), (0.32, 0.1, 1.31), DWOOD, skip=('+y',))
    for x in (-0.24, 0.24):
        g.poly([(x, 0.1, 1.25), (x, -0.16, 1.25), (x, 0.1, 1.0)], IRON, out=(1, 0, 0))
        g.poly([(x, 0.1, 1.25), (x, 0.1, 1.0), (x, -0.16, 1.25)], IRON, out=(-1, 0, 0))
    jc = (0, -0.06, 0)
    b = 1.31
    lathe(g, [(0.11, b), (0.15, b + 0.05), (0.15, b + 0.27), (0.11, b + 0.33), (0.09, b + 0.37)], 6, WATER, c=jc, smooth=50.0,
          slot_fn=lambda i, j: BONE if i == 3 else WATER)
    lathe(g, [(0.1, b + 0.37), (0.105, b + 0.41), (0.0, b + 0.43)], 6, BRASS, c=jc, smooth=30.0)
    for (ang, z, r) in ((-100, b + 0.12, 0.05), (-62, b + 0.2, 0.035), (-128, b + 0.22, 0.03)):
        a = math.radians(ang)
        c = Vector((math.cos(a) * 0.152, -0.06 + math.sin(a) * 0.152, z))
        bipyramid(g, c, r, r * 1.6, r * 1.6, 4, INK, phase=a, squash=0.5)
    return p


@piece
def raft_merchant():
    p = Piece('vlt_raft_merchant', 800, 'prop', mount='raft',
              note="the pedlar's raft: six logs riding in deep water (deck at about -0.13), his goods under a coral awning, a pole and his lamp (light_0, +15 light)")
    g = p.g
    rnd = random.Random(61)
    for k in range(6):
        y = -0.85 + 0.34 * k
        dx = rnd.uniform(-0.12, 0.12)
        lathe(g, [(0.17, -1.8 + dx), (0.17, 1.8 + dx)], 6, WOOD, smooth=55.0, cap0=True, cap1=True, cap_slot=DWOOD, mat=M((0, y, -0.3), ry=90))
    for x in (-1.25, 1.25):
        box(g, (x - 0.1, -1.0, -0.14), (x + 0.1, 1.0, 0.0), DWOOD, skip=('-z',))
        for y in (-0.92, 0.92):
            skin(g, [ring_pts((x, y, -0.08), 0.15, 6, 0.0, 'Y'), ring_pts((x, y + 0.06, -0.08), 0.15, 6, 0.0, 'Y')], ROPE, 40.0)
    cbox(g, (-0.8, 0.32, 0.11), (0.5, 0.5, 0.42), DWOOD, skip=('-z',))
    cbox(g, (-0.75, -0.25, 0.06), (0.45, 0.4, 0.32), WOOD, skip=('-z',))
    cbox(g, (-0.78, 0.3, 0.47), (0.36, 0.36, 0.3), WOOD, skip=('-z',), mat=M((0, 0, 0), rz=8))
    for (x, y) in ((0.05, 0.45), (-0.2, -0.55)):
        lathe(g, [(0.22, -0.1), (0.2, 0.2), (0.0, 0.28)], 5, ROPE, c=(x, y, 0.0), smooth=50.0)
    lathe(g, [(0.2, -0.1), (0.24, 0.15), (0.2, 0.4)], 8, WOOD, c=(0.5, 0.45, 0.0), smooth=50.0, cap1=True, cap_slot=DWOOD,
          slot_fn=lambda i, j: IRON if i == 1 and j % 2 == 0 else WOOD)
    cbox(g, (0.45, -0.4, 0.02), (0.4, 0.28, 0.24), BRASS, skip=('-z',), slots={'+z': DWOOD})
    for (x, y) in ((0.62, -0.78), (0.62, 0.78), (-1.15, -0.78), (-1.15, 0.78)):
        h = 1.95 if x > 0 else 1.55
        prism(g, (x, y, 0), 0.04, -0.12, h, 4, WOOD, cap_top=True, smooth=0.0)
    cols = [0.66, -0.25, -1.2]
    rows = [-0.85, 0.0, 0.85]
    grid = []
    for i, x in enumerate(cols):
        z = 1.95 - (0.66 - x) / 1.86 * 0.4 - (0.06 if i == 1 else 0.0)
        grid.append([(x, y, z - (0.07 if j == 1 else 0.0)) for j, y in enumerate(rows)])
    for i in range(2):
        for j in range(2):
            q = [grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]]
            g.poly(q, CLOTH2, 0.0, out=(0, 0, 1))
            g.poly(list(reversed(q)), CLOTH2, 0.0, out=(0, 0, -1))
    prism(g, (1.45, -0.72, 0), 0.04, -0.12, 1.75, 4, WOOD, cap_top=True, smooth=0.0)
    box(g, (1.2, -0.75, 1.68), (1.48, -0.69, 1.73), WOOD)
    cbox(g, (1.22, -0.72, 1.48), (0.18, 0.18, 0.24), BRASS, slots={'-x': GEM, '+x': GEM, '-y': GEM, '+y': GEM})
    p.light((1.22, -0.72, 1.48), WARM, 'lamp')
    sweep(g, [(-1.95, 0.05, -1.1), (-1.72, 0.15, 2.45)], 0.035, 4, WOOD, smooth=0.0, cap0=True, cap1=True)
    sweep(g, [(1.7, -0.85, 0.0), (1.9, -1.4, -0.08), (2.1, -1.95, 0.06)], 0.025, 3, ROPE, smooth=40.0)
    return p


@piece
def brazier():
    p = Piece('vlt_brazier', 160, 'prop', extra=True,
              note='a brass brazier on a tall iron tripod, above shin-deep water: the throne room has four (06 3.4); a Torch relights it (light_0, warm)')
    g = p.g
    rnd = random.Random(71)
    for k in range(3):
        a = TAU * k / 3 + math.pi / 6
        sweep(g, [(math.cos(a) * 0.42, math.sin(a) * 0.42, 0.0), (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.55), (math.cos(a) * 0.12, math.sin(a) * 0.12, 1.06)],
              0.03, 3, IRON, smooth=0.0)
    skin(g, [ring_pts((0, 0, 0.5), 0.31, 6, 0.0), ring_pts((0, 0, 0.56), 0.31, 6, 0.0)], IRON, 30.0)
    lathe(g, [(0.1, 1.02), (0.36, 1.12), (0.46, 1.3), (0.43, 1.36)], 8, BRASS, smooth=45.0)
    ctr = g.v((0, 0, 1.31))
    rim = [g.v((math.cos(TAU * k / 8 + math.pi / 8) * 0.43, math.sin(TAU * k / 8 + math.pi / 8) * 0.43, 1.31)) for k in range(8)]
    for k in range(8):
        g.f([ctr, rim[k], rim[(k + 1) % 8]], INK, 0.0, out=(0, 0, 1))
    for k in range(4):
        a = TAU * k / 4 + 0.3
        rock(g, (math.cos(a) * 0.18, math.sin(a) * 0.18, 1.3), (0.12, 0.1, 0.1), DWOOD, rnd, n=4)
    p.light((0, 0, 1.5), WARM, 'brazier')
    return p


@piece
def pew():
    p = Piece('vlt_pew', 70, 'prop', extra=True,
              note='a waterlogged chapel pew, 3 m; a sitter faces the piece front (+z game): rotationY 180 faces north')
    g = p.g
    rnd = random.Random(81)
    for x in (-1.5, 1.42):
        box(g, (x, -0.25, 0.0), (x + 0.08, 0.25, 0.95), WOOD, skip=('-z',))
    box(g, (-1.42, -0.22, 0.42), (1.42, 0.2, 0.48), WOOD, skip=('-x', '+x'))
    box(g, (-1.42, 0.16, 0.6), (1.42, 0.22, 1.0), DWOOD, skip=('-x', '+x', '-z'))
    box(g, (-1.42, -0.45, 0.12), (1.42, -0.38, 0.2), DWOOD, skip=('-x', '+x', '-z'))
    ribbon(g, [(0.4, 0.13, 1.0), (0.42, 0.12, 0.75), (0.38, 0.12, 0.5)], 0.08, MOSS)
    for k in range(3):
        barnacle(g, (rnd.uniform(-1.3, 1.3), -0.23, rnd.uniform(0.2, 0.4)), 0.035, up=(0, -1, 0))
    return p


@piece
def banner_tide():
    p = Piece('vlt_banner_tide', 60, 'wall', mount='wall', extra=True,
              note="a Tidebound banner: teal cloth on a brass rod with the cult's brass wave ring; hung 0.1 m in front of a wall")
    g = p.g
    sweep(g, [(-0.55, 0.0, 3.2), (0.55, 0.0, 3.2)], 0.03, 4, BRASS, smooth=0.0)
    for x in (-0.58, 0.58):
        cone(g, (x, 0.0, 3.2), (x + (0.1 if x > 0 else -0.1), 0.0, 3.2), 0.04, 4, BRASS)
    xs = [-0.45, 0.0, 0.45]
    zs = [3.16, 2.55, 1.9, 1.32]
    ys = [-0.03, -0.06, -0.035, -0.06]
    pts = [[(x, ys[i] + (0.015 if j == 1 else 0.0), zs[i] + (0.28 if (i == 3 and j == 1) else 0.0)) for j, x in enumerate(xs)] for i in range(4)]
    for i in range(3):
        for j in range(2):
            g.poly([pts[i][j], pts[i][j + 1], pts[i + 1][j + 1], pts[i + 1][j]], CLOTH1, 20.0, out=(0, -1, 0))
    flat_ring(g, (0, -0.075, 2.55), 0.13, 0.19, 8, BRASS)
    ribbon(g, [(-0.1, -0.08, 2.52), (-0.03, -0.08, 2.6), (0.04, -0.08, 2.5), (0.11, -0.08, 2.58)], 0.035, BRASS)
    return p


@piece
def quay_edge():
    p = Piece('vlt_quay_edge_2m', 40, 'prop', mount='quay', gmode='wall', extra=True,
              note='the edge of a deep-water basin: a coping stone and the quay face down past the water line, a mooring ring; its front (+z game) faces the water')
    g = p.g
    qz(g, -1, 1, -0.1, 0.22, 0.06, DSTONE)
    qy(g, -1, 1, -0.12, 0.06, -0.1, DSTONE)
    qy(g, -1, 1, 0.0, 0.06, 0.22, DSTONE, out=1)
    g.poly([(-1, -0.1, -0.12), (1, -0.1, -0.12), (1, 0.0, -0.12), (-1, 0.0, -0.12)], DSTONE, out=(0, 0, -1))
    qy(g, -1, 1, -0.30, -0.12, 0.0, STONE)
    qy(g, -1, 1, -0.42, -0.30, 0.0, MOSS)
    qy(g, -1, 1, -0.95, -0.42, 0.0, DSTONE)
    flat_ring(g, (0.45, -0.115, -0.22), 0.07, 0.1, 8, IRON)
    qy(g, 0.42, 0.48, -0.14, -0.1, -0.112, IRON)
    return p


@piece
def rope_ladder():
    p = Piece('vlt_rope_ladder', 50, 'prop', mount='quay', extra=True,
              note='a rope ladder hooked over a quay edge, hanging into the water (place it on a vlt_quay_edge_2m with the same transform)')
    g = p.g
    for x in (-0.25, 0.25):
        box(g, (x - 0.025, -0.14, 0.06), (x + 0.025, 0.12, 0.11), IRON, skip=('-z',))
        ribbon(g, [(x, -0.14, 0.1), (x - 0.01, -0.17, -0.4), (x, -0.16, -0.9)], 0.035, ROPE, normal=(0, -1, 0))
    for z in (-0.08, -0.3, -0.52, -0.74):
        box(g, (-0.27, -0.19, z), (0.27, -0.15, z + 0.045), WOOD, skip=('-x', '+x', '+y', '-z'))
    return p


@piece
def stairs_flooded():
    p = Piece('vlt_stairs_flooded', 400, 'prop', mount='hole', replaces_floor=True, extra=True, footprint=[-2.0, -2.5, 2.0, 1.5],
              note="the Vault's stair-well: eight steps descending north into water, water pouring down the top steps, brass rails and kerb; the stairs pit of the client")
    g = p.g
    rnd = random.Random(91)
    for i in range(8):
        top = -(i + 1) * 0.24
        y0 = -1.5 + 0.5 * i
        y1 = y0 + 0.5
        sl = STONE if i < 4 else DSTONE
        qy(g, -1.8, 1.8, top, top + 0.24, y0, sl)
        qz(g, -1.8, 1.8, y0, y1, top, sl)
    qx(g, -1.5, 2.5, -2.6, 0.0, -1.8, DSTONE, out=1)
    qx(g, -1.5, 2.5, -2.6, 0.0, 1.8, DSTONE, out=-1)
    qy(g, -1.8, 1.8, -2.6, 0.0, 2.5, DSTONE, out=-1)
    box(g, (-2.2, -1.5, 0.0), (-1.8, 2.7, 0.18), DSTONE, skip=('-z',), slots={'+z': BRASS})
    box(g, (1.8, -1.5, 0.0), (2.2, 2.7, 0.18), DSTONE, skip=('-z',), slots={'+z': BRASS})
    box(g, (-1.8, 2.5, 0.0), (1.8, 2.7, 0.18), DSTONE, skip=('-z', '-x', '+x'), slots={'+z': BRASS})
    for x in (-1.6, 1.6):
        sweep(g, [(x, -1.35, 0.92), (x, 1.45, -0.95)], 0.035, 5, BRASS, smooth=60.0, cap0=True, cap1=True)
        for (y, z0, z1) in ((-1.25, -0.24, 0.86), (0.1, -0.96, -0.05)):
            prism(g, (x, y, 0), 0.03, z0, z1, 4, BRASS, cap_top=False, smooth=0.0)
    qz(g, -1.8, 1.8, 0.5, 2.5, -1.05, WATER, alpha=0.86, gv=0.42)
    qz(g, -1.8, 1.8, -1.5, 2.5, -2.6, INK)
    for i in range(4):
        top = -(i + 1) * 0.24
        y0 = -1.5 + 0.5 * i
        y1 = y0 + 0.5
        g.poly([(-0.65, y0 - 0.025, top + 0.02), (0.65, y0 - 0.025, top + 0.02), (0.65, y0 - 0.025, top + 0.27), (-0.65, y0 - 0.025, top + 0.27)],
               WATER, 0.0, out=(0, -1, 0), alpha=0.72, g=0.66)
        g.poly([(-0.65, y0 - 0.025, top + 0.025), (0.65, y0 - 0.025, top + 0.025), (0.65, y1, top + 0.025), (-0.65, y1, top + 0.025)],
               WATER, 0.0, out=(0, 0, 1), alpha=0.72, g=0.6)
    qz(g, -0.75, 0.75, 0.42, 0.78, -1.03, BONE)
    box(g, (-0.75, -1.62, 0.0), (0.75, -1.5, 0.05), BRASS, skip=('-z',))
    for k in range(6):
        i = rnd.randint(2, 4)
        barnacle(g, (rnd.uniform(-1.6, 1.6), -1.5 + 0.5 * i + rnd.uniform(0.05, 0.4), -(i + 1) * 0.24), 0.04)
    for x in (-1.2, 1.1):
        ribbon(g, [(x, -0.5, -0.47), (x + 0.05, 0.0, -0.71), (x, 0.5, -0.95)], 0.12, MOSS, normal=(0, -0.4, 1))
    p.emit((0.0, 0.62, -0.98), 'splash')
    p.emit((0.0, 1.5, -0.8), 'mist')
    return p


# ---------------------------------------------------------------- the throne
STEP_RISE, STEP_RUN = 0.25, 0.45


def step_front(k):
    """Blender y of step k's riser (k = 1 bottom .. 8 = the platform at 2.0 m)."""
    return -(0.15 + (8 - k) * STEP_RUN)


def step_width(k):
    return 9.0 - (k - 1) * 0.6


@piece
def throne_hollow():
    p = Piece('vlt_throne_hollow', 2400, 'set',
              note="the Hollow King's throne: a dais of eight 0.25 m steps (platform at 2.0 m, the lowest two under the knee-deep water), "
                   "the gallery behind it with six cult lamps (light_0..5: the Silence tell), chains and coral; .seat is the empty iron throne "
                   "(hide it while the King's own throne is drawn); origin at the dais' centre line, 3.3 m behind its bottom step")
    g = p.g
    rnd = random.Random(101)
    for k in range(1, 9):
        w = step_width(k)
        yk = step_front(k)
        box(g, (-w / 2, yk, STEP_RISE * (k - 1)), (w / 2, 1.75, STEP_RISE * k), DSTONE if k <= 3 else STONE, skip=('+y', '-z'))
        if k % 2 == 0:
            qy(g, -w / 2, w / 2, STEP_RISE * k - 0.06, STEP_RISE * k + 0.005, yk - 0.012, BRASS)
            qz(g, -w / 2, w / 2, yk - 0.012, yk + 0.07, STEP_RISE * k + 0.005, BRASS)
    for k in (1, 2, 3):
        w = step_width(k)
        for _ in range(5):
            barnacle(g, (rnd.uniform(-w / 2 + 0.3, w / 2 - 0.3), step_front(k) + rnd.uniform(0.08, 0.32), STEP_RISE * k), rnd.uniform(0.04, 0.06))
    for x in (-3.1, -1.4, 1.9, 3.3):
        path = []
        for k in range(5, 0, -1):
            yk = step_front(k)
            xx = x * (step_width(k) / step_width(1))
            path += [(xx, yk + 0.2, STEP_RISE * k + 0.012), (xx, yk - 0.015, STEP_RISE * k + 0.012), (xx, yk - 0.015, STEP_RISE * (k - 1) + 0.03)]
        ribbon(g, path, 0.14, MOSS, normal=(0, -0.6, 0.8))
    for k in (2, 3, 4, 5, 6):
        for sx in (-1, 1):
            if (k + (sx > 0)) % 2:
                continue
            base = Vector((sx * (step_width(k) / 2 - 0.15), step_front(k) + 0.2, STEP_RISE * k))
            cone(g, base, base + Vector((sx * 0.06, -0.05, 0.42)), 0.07, 5, CLOTH2)
            cone(g, base + Vector((sx * 0.02, 0.05, 0.1)), base + Vector((sx * 0.22, 0.0, 0.3)), 0.045, 4, CLOTH2)
    # the gallery behind the dais: arcade, slab, balustrade, back screen with the sigil
    box(g, (-7.0, 1.75, 2.8), (7.0, 3.75, 3.1), DSTONE, skip=('+y',))
    qy(g, -7.0, 7.0, 2.9, 3.02, 1.738, BRASS)
    for x in (-6.6, -4.6, -2.6, 2.6, 4.6, 6.6):
        prism(g, (x, 2.0, 0), 0.2, 0.25, 2.62, 6, STONE, cap_top=False, smooth=50.0)
        box(g, (x - 0.27, 1.73, 2.62), (x + 0.27, 2.27, 2.8), BRASS, skip=('+z', '+y'))
        box(g, (x - 0.27, 1.73, 0.0), (x + 0.27, 2.27, 0.25), DSTONE, skip=('-z', '+y'))
    qy(g, -7.0, 7.0, 0.0, 2.8, 3.72, DSTONE)
    for i in range(13):
        x = -6.8 + 13.6 * i / 12
        prism(g, (x, 1.86, 0), 0.05, 3.1, 3.62, 4, BRASS, cap_top=False, smooth=0.0, phase=math.pi / 4)
    box(g, (-7.0, 1.79, 3.62), (7.0, 1.93, 3.72), BRASS, skip=('+y',))
    qy(g, -7.0, 7.0, 3.1, 6.6, 3.75, STONE)
    for x in (-7.0, -3.5, 0.0, 3.5, 7.0):
        box(g, (x - 0.25, 3.45, 3.1), (x + 0.25, 3.75, 6.6), DSTONE, skip=('+y', '-z'))
    box(g, (-7.25, 3.35, 6.6), (7.25, 3.75, 6.9), DSTONE, skip=('+y', '-z'))
    flat_ring(g, (0, 3.41, 5.55), 0.5, 0.64, 12, GLOW)
    ribbon(g, [(-0.32, 3.4, 5.5), (-0.12, 3.4, 5.66), (0.08, 3.4, 5.48), (0.3, 3.4, 5.64)], 0.07, GLOW)
    p.emit((0, 3.2, 5.55), 'glow')
    for x in (-6.4, -4.4, -2.2, 2.2, 4.4, 6.4):
        p.light(small_lamp(g, (x, 1.86, 3.72), s=1.2), CYAN, 'lamp')
    for x in (-5.6, -3.6, 3.6, 5.6):
        ribbon(g, [(x, 1.7, 2.78), (x + 0.02, 1.69, 2.05), (x - 0.01, 1.7, 1.3)], 0.6, CLOTH1, normal=(0, -1, 0))
        flat_ring(g, (x, 1.675, 2.2), 0.09, 0.14, 8, BRASS)
    for sx in (-1, 1):
        path = [(sx * 1.05, 0.3, 2.35), (sx * 1.2, step_front(8) - 0.02, 2.04)]
        for k in range(7, 0, -1):
            f = (8 - k) / 7
            path.append((sx * (1.2 + f * 1.8), step_front(k) - 0.02, STEP_RISE * k + 0.04))
        path.append((sx * 3.2, step_front(1) - 0.5, 0.03))
        chain(g, path, link=0.22, w=0.09, slot=IRON, normal=(0, -0.5, 0.85))
    # the seat (a part, so the client can hide it under the King's own throne)
    s = p.part('seat', (0, 0.75, 2.0), 'none', 'none', note="the empty iron throne: hide it while the Hollow King's own throne (his mesh) is drawn")
    box(s, (-0.9, 0.1, 2.0), (0.9, 1.4, 2.9), IRON, skip=('-z',))
    box(s, (-0.9, 1.12, 2.9), (0.9, 1.5, 5.3), IRON, skip=('-z',))
    for i, x in enumerate((-0.72, -0.36, 0.0, 0.36, 0.72)):
        h = (0.45, 0.62, 0.8, 0.62, 0.45)[i]
        cone(s, (x, 1.31, 5.28), (x, 1.31, 5.3 + h), 0.13, 4, IRON, phase=math.pi / 4)
    for sx in (-1, 1):
        box(s, (sx * 0.95 - 0.13, 0.0, 2.9), (sx * 0.95 + 0.13, 1.4, 3.25), IRON, skip=('-z',))
        bipyramid(s, (sx * 0.95, 0.06, 3.38), 0.12, 0.12, 0.1, 4, BONE, phase=math.pi / 4)
        for z in (3.6, 4.3, 4.9):
            base = Vector((sx * 0.9, 1.3, z))
            cone(s, base, base + Vector((sx * 0.3, -0.05, 0.18)), 0.07, 5, CLOTH2)
    for _ in range(10):
        barnacle(s, (rnd.uniform(-0.85, 0.85), 0.09, rnd.uniform(2.1, 2.85)), rnd.uniform(0.03, 0.05), up=(0, -1, 0.2))
    bipyramid(s, (0, 1.1, 4.55), 0.15, 0.17, 0.17, 4, GEM, phase=math.pi / 4, squash=0.6)
    box(s, (-0.75, 0.15, 2.9), (0.75, 1.1, 2.98), CLOTH1, skip=('-z',))
    chain(s, [(-0.9, 1.1, 4.15), (0.9, 1.1, 3.75)], link=0.18, w=0.08, slot=IRON, normal=(0, -1, 0))
    p.emit((0, 1.0, 4.55), 'glow')
    return p


# ============================================================================ meshes
def corner_normals(V, F, A):
    """Per face corner: the angle-weighted normal of the faces around the corner's vertex reachable through edges
    flatter than both faces' smoothing angle (0 = flat face). [[normal per corner] per face]."""
    fn = []
    for f in F:
        n = newell([V[i] for i in f])
        fn.append(n.normalized() if n.length > 1e-12 else Vector((0, 0, 1)))
    ef = defaultdict(list)
    for fi, f in enumerate(F):
        for k in range(len(f)):
            a, b = f[k], f[(k + 1) % len(f)]
            ef[(min(a, b), max(a, b))].append(fi)
    out = []
    for fi, f in enumerate(F):
        row = []
        for vi in f:
            if A[fi] <= 0:
                row.append(fn[fi])
                continue
            group = {fi}
            stack = [fi]
            while stack:
                cf = stack.pop()
                cfv = F[cf]
                m = cfv.index(vi)
                for nb in (cfv[(m - 1) % len(cfv)], cfv[(m + 1) % len(cfv)]):
                    for of in ef[(min(vi, nb), max(vi, nb))]:
                        if of in group:
                            continue
                        lim = min(A[cf], A[of])
                        if lim > 0 and fn[cf].angle(fn[of], math.pi) < math.radians(lim):
                            group.add(of)
                            stack.append(of)
            n = Vector()
            for gf in group:
                gfv = F[gf]
                m = gfv.index(vi)
                pv = V[vi]
                e1 = V[gfv[(m - 1) % len(gfv)]] - pv
                e2 = V[gfv[(m + 1) % len(gfv)]] - pv
                ang = e1.angle(e2, 0.0) if e1.length > 1e-9 and e2.length > 1e-9 else 0.0
                n += fn[gf] * ang
            row.append(n.normalized() if n.length > 1e-9 else fn[fi])
        out.append(row)
    return out


def gvalue(p, mode, seed, half=1.0):
    """G = variation: 0.5 neutral, darker toward the wet floor, a soft noise; periodic modes keep tile seams equal."""
    if mode == 'const':
        return 0.5
    n = noise.noise(Vector((p.x * 1.15 + seed * 3.17, p.y * 1.15 + seed * 1.91, p.z * 0.95 + seed * 0.37)))
    wet = 0.12 * min(1.0, max(0.0, (1.3 - p.z) / 1.3))
    w = 1.0
    if mode == 'wall':
        w = min(1.0, max(0.0, (half - abs(p.x)) / 0.35))
    elif mode == 'tile':
        w = min(1.0, max(0.0, (half - abs(p.x)) / 0.35), max(0.0, (half - abs(p.y)) / 0.35))
    return min(0.95, max(0.05, 0.5 - wet + 0.2 * n * w))


def make_mesh(name, g, gmode='noise', seed=0, half=1.0, offset=None):
    """Builds a Blender mesh from a Geo: one vertex per (vertex, slot), custom normals by smoothing angle, and the
    `gv` attribute (R slot / 15, G variation, B 1 until the AO bake, A opacity)."""
    cn = corner_normals(g.V, g.F, g.A)
    key = {}
    verts, vslot, valpha, vg = [], [], [], []
    faces = []
    for fi, f in enumerate(g.F):
        s = g.S[fi]
        nf = []
        for vi in f:
            k = (vi, s)
            if k not in key:
                key[k] = len(verts)
                verts.append(g.V[vi] - offset if offset is not None else g.V[vi])
                vslot.append(s)
                valpha.append(g.alpha.get(vi, 1.0))
                vg.append(g.gfix[vi] if vi in g.gfix else gvalue(g.V[vi], gmode, seed, half))
            nf.append(key[k])
        faces.append(nf)
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    if len(me.polygons) != len(faces):
        raise RuntimeError('%s: %d faces became %d' % (name, len(faces), len(me.polygons)))
    ln = []
    for fi, poly in enumerate(me.polygons):
        row = cn[fi]
        if len(row) != poly.loop_total:
            raise RuntimeError('%s: face %d corner count changed' % (name, fi))
        ln.extend(row)
        poly.use_smooth = True
    me.normals_split_custom_set(ln)
    at = me.color_attributes.new('gv', 'FLOAT_COLOR', 'POINT')
    for i, d in enumerate(at.data):
        d.color = (vslot[i] / 15.0, vg[i], 1.0, valpha[i])
    me.color_attributes.active_color = at
    try:
        me.color_attributes.render_color_index = me.color_attributes.find('gv')
    except Exception:
        pass
    return me


POINT_N = {'light': 0, 'fx': 0}


def build_objects(p, col):
    """The piece's object, its moving parts and its light / fx empties, with kit_lib's custom properties (glTF extras):
    piece kind 'kit', zone, tris, role; part kind 'part', part, piece, axis (+ note); point kind 'light' | 'fx', the
    sub-kind under `light` / `fx`, piece (+ color for lights). Points are numbered across the session (light_0 …), as
    kit_lib does: the client matches the prefix under a piece, never the number."""
    me = make_mesh(p.name, p.g, p.gmode, p.seed, p.half)
    ob = bpy.data.objects.new(p.name, me)
    col.objects.link(ob)
    ob['kind'] = 'kit'
    ob['zone'] = ZONE
    ob['tris'] = p.tris()
    ob['role'] = p.role
    ob['mount'] = p.client_mount()
    parts, empties = [], []
    for pname, pd in p.parts.items():
        nm = '%s.%s' % (p.name, pname)
        pme = make_mesh(nm, pd['g'], p.gmode, p.seed, p.half, offset=pd['pivot'])
        po = bpy.data.objects.new(nm, pme)
        col.objects.link(po)
        po.parent = ob
        po.matrix_parent_inverse = Matrix.Identity(4)
        po.location = pd['pivot']
        po['kind'] = 'part'
        po['part'] = pname
        po['piece'] = p.name
        po['axis'] = pd['axis']
        po['zone'] = ZONE
        po['tris'] = pd['g'].tris()
        if pd.get('note'):
            po['note'] = pd['note']
        parts.append(po)
    p.points = []
    pts = [('light', pos, sub, hx) for pos, hx, sub in p.lights] + [('fx', pos, sub, None) for pos, sub in p.fx]
    for kind, pos, sub, hx in pts:
        n = POINT_N[kind]
        POINT_N[kind] += 1
        e = bpy.data.objects.new('%s_%d' % (kind, n), None)
        e.empty_display_type = 'SPHERE' if kind == 'light' else 'PLAIN_AXES'
        e.empty_display_size = 0.08
        col.objects.link(e)
        e.parent = ob
        e.matrix_parent_inverse = Matrix.Identity(4)
        e.location = pos
        e['kind'] = kind
        e[kind] = sub
        e['piece'] = p.name
        if hx:
            e['color'] = hx
        empties.append(e)
        p.points.append((e.name, kind, sub, Vector(pos), hx))
    return ob, parts, empties


# ============================================================================ ambient occlusion (Cycles → COLOR_0.B)
def quad_mesh(name, rects, z=0.0):
    vs, fs = [], []
    for (x0, y0, x1, y1) in rects:
        if x1 - x0 < 1e-6 or y1 - y0 < 1e-6:
            continue
        b = len(vs)
        vs += [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)]
        fs.append((b, b + 1, b + 2, b + 3))
    me = bpy.data.meshes.new(name)
    me.from_pydata(vs, [], fs)
    me.update()
    return me


def occluders(p, ob, wall_me, occ_col, floor_me=None):
    """The world a piece is baked in: the floor it stands on, the wall it hangs on, the neighbours it tiles with."""
    out = []
    L = ob.location.copy()

    def add(me, loc=(0, 0, 0), rot=0.0):
        o = bpy.data.objects.new('occ', me)
        occ_col.objects.link(o)
        o.location = L + Vector(loc)
        o.rotation_euler = (0, 0, math.radians(rot))
        out.append(o)
    big = 12.0 if p.group == 'set' else 6.0
    z = -0.01   # occluder planes sit 1 cm under the floor: in its plane they would black out every floor vertex
    if p.footprint == [-1, -1, 1, 1] and p.mount in ('floor', 'hole'):
        # a 2 m tile bakes among copies of the floor tile, so its joints match the tiles round it
        tile = floor_me or ob.data
        for dx in (-2, 0, 2):
            for dy in (-2, 0, 2):
                if dx or dy:
                    add(tile, (dx, dy, 0))
    elif p.mount == 'floor':
        add(quad_mesh('occ_g', [(-big, -big, big, big)], z))
    elif p.mount == 'raft':
        add(quad_mesh('occ_w', [(-big, -big, big, big)], DEEP - 0.01))
    elif p.mount == 'hole':
        x0, z0, x1, z1 = p.footprint
        bx0, by0, bx1, by1 = x0, -z1, x1, -z0
        add(quad_mesh('occ_g', [(-big, -big, big, by0), (-big, by1, big, big), (-big, by0, bx0, by1), (bx1, by0, big, by1)], z))
    elif p.mount == 'quay':
        add(quad_mesh('occ_g', [(-big, 0.22, big, big)], z))
        add(quad_mesh('occ_w', [(-big, -big, big, -0.1)], DEEP - 0.01))
        add(ob.data, (-2, 0, 0))
        add(ob.data, (2, 0, 0))
    elif p.mount == 'wall':
        add(quad_mesh('occ_g', [(-big, -big, big, 0.1)], z))
        for x in (-2.0, 0.0, 2.0):
            add(wall_me, (x, 0.1, 0))
    elif p.mount == 'edge':
        add(quad_mesh('occ_g', [(-big, -big, big, 0.0)], z))
        if p.width > 2.01:
            add(wall_me, (-(p.width / 2 + 1), 0, 0))
            add(wall_me, (p.width / 2 + 1, 0, 0))
        else:
            add(ob.data, (-2, 0, 0))
            add(ob.data, (2, 0, 0))
    elif p.mount == 'corner':
        add(quad_mesh('occ_g', [(0.0, -big, big, 0.0)], z))
        for x in (1.0, 3.0):
            add(wall_me, (x, 0, 0))
        for y in (-1.0, -3.0):
            add(wall_me, (0, y, 0), 90.0)
    return out


def bake_ao(objs):
    t = time.time()
    sc = bpy.context.scene
    occ_col = bpy.data.collections.new('VLT_Occluders')
    sc.collection.children.link(occ_col)
    wall_me = bpy.data.meshes.get('vlt_wall_vault_2m')
    if wall_me is None:
        wall_me = make_mesh('occ_wall', wall_vault().g, 'wall')
    occ = []
    targets = []
    floor_me = bpy.data.meshes.get('vlt_floor_basalt')
    for p, ob, parts, empties in objs:
        occ += occluders(p, ob, wall_me, occ_col, floor_me)
        targets += [ob] + parts
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 24 if QUICK else 96
    w = sc.world or bpy.data.worlds.new('VLT_BakeWorld')
    sc.world = w
    w.light_settings.distance = K.AO_DIST
    for ob in targets:
        tmp = ob.data.color_attributes.new('ao_tmp', 'FLOAT_COLOR', 'POINT')
        ob.data.color_attributes.active_color = tmp
    bpy.context.view_layer.update()
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for ob in targets:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', use_clear=True)
    for ob in targets:
        me = ob.data
        ao = [d.color[0] for d in me.color_attributes['ao_tmp'].data]
        me.color_attributes.remove(me.color_attributes['ao_tmp'])
        gv = me.color_attributes['gv']
        me.color_attributes.active_color = gv
        water_tile = ob.name in ('vlt_floor_water_knee', 'vlt_floor_water_deep', 'vlt_floor_water_edge')
        for d, a in zip(gv.data, ao):
            r, gg, _, al = d.color
            d.color = (r, gg, 1.0 if water_tile else min(1.0, a * 1.04), al)
    for o in occ:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(occ_col)
    for me in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(me)
    log('ao baked on %d objects in %.1fs' % (len(targets), time.time() - t))


# ============================================================================ export
def game(v):
    """Blender (x, y, z) → game (x, y up, z south) = (x, z, −y)."""
    return [round(v.x, 3), round(v.z, 3), round(-v.y, 3)]


def export_kit(objs):
    from export import export_glb
    saved = {}
    for p, ob, parts, empties in objs:
        saved[ob.name] = ob.location.copy()
        ob.location = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    sel = []
    for p, ob, parts, empties in objs:
        sel += [ob] + parts + empties
    kb = export_glb(GLB, sel)
    if not ARGS.get('no_fbx'):
        # The same pieces for Unity (Phase 11, D-140): meshes only; the pieces already sit at the origin here.
        from export import export_fbx
        export_fbx(K.unity_fbx_path('vault'), [o for o in sel if o.type == 'MESH'], at_origin=False)
    for p, ob, parts, empties in objs:
        ob.location = saved[ob.name]
    bpy.context.view_layer.update()
    log('kit_vault.glb: %.1f KB' % kb)
    return kb


SHELL = {
    'floor': 'vlt_floor_basalt',
    'wall': 'vlt_wall_vault_2m',
    'doorway': 'vlt_door_arch_iron',
    'corner': 'vlt_wall_corner_in',
    'wallCut': 'vlt_wall_cut_2m',
    'doorwayCut': 'vlt_door_arch_cut',
    'cornerCut': 'vlt_wall_corner_cut',
    'floorAlt': [['vlt_floor_basalt_wet', 0.15]],
    'wallAlt': [['vlt_wall_pipes_2m', 0.2]],
    'doorways': {'open': 'vlt_door_arch_iron', 'locked': 'vlt_door_vault', 'secret': 'vlt_door_secret', 'trap': 'vlt_door_sluice'},
    'tile': 2,
    'segment': 2,
    'doorwayWidth': 4,
    'opening': {'width': 2, 'spring': 2.1, 'apex': 3.1},
    'wallHeight': WALL_H,
    'wallThickness': WALL_T,
    'cutHeight': CUT_H,
    'notes': ('Pivots as kit_lib: a wall, doorway or cut piece has its origin at the centre of its base on the room-side face '
              '(the room is its local +z in game space; masonry behind it to z -0.4, and down to y -0.8 so sunk water never '
              'shows a gap); an 8 m cell edge is segment, doorway, segment (2 + 4 + 2 m) or four segments. Corner: origin on '
              "the room's inside corner, the room in its local +x/+z quadrant: NW rotationY 0, NE -90, SE 180, SW 90. Walls "
              'whose outer side faces the camera use the cut pieces. Floor tiles: 2 m, any quarter turn. floorAlt / wallAlt: '
              '[meshId, chance] per tile / full wall segment, never a wallAlt behind a wall-hung prop. doorways.trap is the '
              'Tide Gate trap skin (a lifting sluice gate).'),
}

WATER_NOTE = {
    'knee': KNEE, 'deep': DEEP, 'kneeOpacity': A_KNEE,
    'note': ('Pieces with "water": true carry slot-15 faces whose COLOR_0.A is their opacity (kit_lib keeps A = 1 elsewhere): '
             'knee-deep 0.62, deep 1, falling to 0 at soft edges (vlt_floor_water_edge, the pools of the breach, cage and '
             'chest, the wet tile\'s puddle). Draw them with a transparent water material (07: caustics scrolling on the '
             'knee-deep water, a fog volume on the deep). Knee-deep water is an overlay 0.45 m over the floor (the floor '
             'tile stays; characters standing at y 0 wade); deep water sits 0.35 m below the floor and its tile has a hole '
             '(the floor tile goes), lined by vlt_quay_edge_2m. The arena tides (07 §2.8) can move the knee-deep tiles up.'),
}


def write_meta(objs, kb):
    """client/public/models/env/vault.json in kit_lib.export_kit's layout: {zone, about, palette, shell, pieces: {meshId:
    {tris, budget, role, bounds, parts, lights, fx, …}}} + the Vault's water note. Game space throughout."""
    pieces = {}
    for p, ob, parts, empties in objs:
        allv = list(p.g.V) + [v for d in p.parts.values() for v in d['g'].V]
        lo = Vector((min(v.x for v in allv), min(v.y for v in allv), min(v.z for v in allv)))
        hi = Vector((max(v.x for v in allv), max(v.y for v in allv), max(v.z for v in allv)))
        e = {'tris': p.tris(), 'budget': p.budget, 'role': p.role, 'mount': p.client_mount(),
             'bounds': {'min': [round(lo.x, 3) + 0.0, round(lo.z, 3) + 0.0, round(-hi.y, 3) + 0.0],
                        'max': [round(hi.x, 3) + 0.0, round(hi.z, 3) + 0.0, round(-lo.y, 3) + 0.0]},
             'parts': [dict({'name': '%s.%s' % (p.name, k), 'part': k, 'tris': d['g'].tris(), 'pivot': game(d['pivot']), 'axis': d['axis']},
                            **({'note': d['note']} if d.get('note') else {})) for k, d in p.parts.items()],
             'lights': [{'name': nm, 'kind': sub, 'at': game(pos), 'color': hx} for nm, kind, sub, pos, hx in p.points if kind == 'light'],
             'fx': [{'name': nm, 'kind': sub, 'at': game(pos)} for nm, kind, sub, pos, hx in p.points if kind == 'fx']}
        if p.replaces_floor:
            e['hole'] = p.footprint
        if any(s == WATER for s in p.g.S) or any(s == WATER for d in p.parts.values() for s in d['g'].S):
            e['water'] = True
        if p.extra:
            e['extra'] = True
        e['note'] = p.note
        pieces[p.name] = e
    data = {
        'zone': ZONE,
        'about': ('The Drowned Vault kit (tools/blender/env/build_kit_vault.py, kit_lib conventions). kit_vault.glb holds one '
                  'object per meshId at the origin; moving parts are children <meshId>.<part> (three.js strips the dot: find '
                  'them by userData.part / userData.piece) with their origin on the hinge or axis; light_<n> / fx_<n> empties '
                  'under their piece (userData.light: lamp | brazier, userData.color the flame colour; userData.fx: glow, drip, '
                  'motes, splash, glint, fog, flow, bubbles, mist). "extra": true marks a piece beyond 07 §2.2\'s table. '
                  'COLOR_0 as kit_lib (R slot / 15, G variation, B baked AO) with A the water\'s opacity — see "water".'),
        'palette': VAULT,
        'shell': SHELL,
        'water': WATER_NOTE,
        'pieces': pieces,
    }
    write_json(META_JSON, data)
    log('wrote %s (%d pieces, glb %.1f KB)' % (os.path.relpath(META_JSON, REPO), len(pieces), kb))


# ============================================================================ review: materials and stage
TORCH = (1.0, 0.62, 0.34)
TORCH_W = 170.0
LAMP_W = {'lamp': 45.0, 'brazier': 110.0, 'fire': 110.0, 'torch': 90.0, 'candle': 12.0}


def _mix(nt, a, b, blend='MULTIPLY', fac=None):
    m = nt.nodes.new('ShaderNodeMix')
    m.data_type = 'RGBA'
    m.blend_type = blend
    if fac is None:
        m.inputs['Factor'].default_value = 1.0
    elif isinstance(fac, (int, float)):
        m.inputs['Factor'].default_value = fac
    else:
        nt.links.new(fac, m.inputs['Factor'])
    for sock, v in ((m.inputs[6], a), (m.inputs[7], b)):
        if isinstance(v, (tuple, list)):
            sock.default_value = v
        else:
            nt.links.new(v, sock)
    return m.outputs[2]


def _madd(nt, inp, mul, add):
    n = nt.nodes.new('ShaderNodeMath')
    n.operation = 'MULTIPLY_ADD'
    nt.links.new(inp, n.inputs[0])
    n.inputs[1].default_value = mul
    n.inputs[2].default_value = add
    return n.outputs[0]


def water_material():
    """Slot-15 faces in the review: the palette water through the toon ramp (the same steps as kit_lib.env_material),
    caustic lines on the translucent water (07: the knee-deep water's caustic-scrolling shader), soft lamp glints, blended
    by COLOR_0.A (deep water, A = 1, gets no caustics)."""
    import toon
    m = bpy.data.materials.get('VLT_Water') or bpy.data.materials.new('VLT_Water')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    L = nt.links.new
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    attr = nt.nodes.new('ShaderNodeAttribute')
    attr.attribute_name = 'gv'
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    L(attr.outputs['Color'], sep.inputs[0])
    diff = nt.nodes.new('ShaderNodeBsdfDiffuse')
    diff.inputs['Color'].default_value = (1, 1, 1, 1)
    s2r = nt.nodes.new('ShaderNodeShaderToRGB')
    L(diff.outputs[0], s2r.inputs[0])
    bw = nt.nodes.new('ShaderNodeRGBToBW')
    L(s2r.outputs[0], bw.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = toon.RAMP_AT[0], (toon.RAMP[0],) * 3 + (1,)
    els[1].position, els[1].color = toon.RAMP_AT[1], (toon.RAMP[1],) * 3 + (1,)
    for at, v in zip(toon.RAMP_AT[2:], toon.RAMP[2:]):
        e = els.new(at)
        e.color = (v,) * 3 + (1,)
    L(bw.outputs[0], ramp.inputs[0])
    c = _mix(nt, ramp.outputs['Color'], hexcol(HEX[WATER]))
    c = _mix(nt, c, _madd(nt, sep.outputs[1], 0.5, 0.75))
    # caustics: thin lines at the edges of warped world-space Voronoi cells, broken up by noise, only on translucent
    # water that faces up (a falling sheet shows its G streaks instead)
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 0.55
    nz.inputs['Detail'].default_value = 1.0
    L(geo.outputs['Position'], nz.inputs['Vector'])
    ctr = nt.nodes.new('ShaderNodeVectorMath')
    ctr.operation = 'SUBTRACT'
    L(nz.outputs['Color'], ctr.inputs[0])
    ctr.inputs[1].default_value = (0.5, 0.5, 0.5)
    warp = nt.nodes.new('ShaderNodeVectorMath')
    warp.operation = 'MULTIPLY_ADD'
    L(ctr.outputs[0], warp.inputs[0])
    warp.inputs[1].default_value = (0.9, 0.9, 0.9)
    L(geo.outputs['Position'], warp.inputs[2])
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.feature = 'DISTANCE_TO_EDGE'
    vor.inputs['Scale'].default_value = 1.5
    L(warp.outputs[0], vor.inputs['Vector'])
    edge = nt.nodes.new('ShaderNodeMapRange')
    edge.inputs['From Min'].default_value = 0.0
    edge.inputs['From Max'].default_value = 0.04
    edge.inputs['To Min'].default_value = 1.0
    edge.inputs['To Max'].default_value = 0.0
    edge.clamp = True
    L(vor.outputs['Distance'], edge.inputs['Value'])
    nb = nt.nodes.new('ShaderNodeTexNoise')
    nb.inputs['Scale'].default_value = 0.9
    L(geo.outputs['Position'], nb.inputs['Vector'])
    brk = nt.nodes.new('ShaderNodeMapRange')
    brk.inputs['From Min'].default_value = 0.42
    brk.inputs['From Max'].default_value = 0.62
    brk.clamp = True
    L(nb.outputs['Fac'], brk.inputs['Value'])
    sxyz = nt.nodes.new('ShaderNodeSeparateXYZ')
    L(geo.outputs['Normal'], sxyz.inputs[0])
    upf = nt.nodes.new('ShaderNodeMapRange')
    upf.inputs['From Min'].default_value = 0.75
    upf.inputs['From Max'].default_value = 0.95
    upf.clamp = True
    L(sxyz.outputs['Z'], upf.inputs['Value'])
    em1 = nt.nodes.new('ShaderNodeMath')
    em1.operation = 'MULTIPLY'
    L(edge.outputs['Result'], em1.inputs[0])
    L(brk.outputs['Result'], em1.inputs[1])
    em2 = nt.nodes.new('ShaderNodeMath')
    em2.operation = 'MULTIPLY'
    L(em1.outputs[0], em2.inputs[0])
    L(upf.outputs['Result'], em2.inputs[1])
    clear = nt.nodes.new('ShaderNodeMapRange')
    clear.inputs['From Min'].default_value = 0.9
    clear.inputs['From Max'].default_value = 0.98
    clear.inputs['To Min'].default_value = 1.0
    clear.inputs['To Max'].default_value = 0.0
    clear.clamp = True
    L(attr.outputs['Alpha'], clear.inputs['Value'])
    mask = nt.nodes.new('ShaderNodeMath')
    mask.operation = 'MULTIPLY'
    L(em2.outputs[0], mask.inputs[0])
    L(clear.outputs['Result'], mask.inputs[1])
    caus = _mix(nt, (0.0, 0.0, 0.0, 1.0), (0.07, 0.22, 0.24, 1.0), 'MIX', mask.outputs[0])
    caus = _mix(nt, caus, ramp.outputs['Color'])
    c = _mix(nt, c, caus, 'ADD')
    gl = nt.nodes.new('ShaderNodeBsdfGlossy')
    gl.inputs['Roughness'].default_value = 0.32
    s2g = nt.nodes.new('ShaderNodeShaderToRGB')
    L(gl.outputs[0], s2g.inputs[0])
    spec = _mix(nt, s2g.outputs[0], (0.08, 0.1, 0.1, 1.0))
    c = _mix(nt, c, spec, 'ADD')
    em = nt.nodes.new('ShaderNodeEmission')
    L(c, em.inputs['Color'])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mx = nt.nodes.new('ShaderNodeMixShader')
    L(attr.outputs['Alpha'], mx.inputs[0])
    L(tr.outputs[0], mx.inputs[1])
    L(em.outputs[0], mx.inputs[2])
    L(mx.outputs[0], out.inputs[0])
    try:
        m.surface_render_method = 'BLENDED'
    except Exception:
        m.blend_method = 'BLEND'
    m.use_backface_culling = True
    return m


def apply_review_mats(meshes):
    """kit_lib.env_material (the shading the client is asked for) on every face, the water material on slot 15, the
    toon outline material third (for the Outline hull of props)."""
    import toon
    tm, wm, om = K.env_material(VAULT, 'VLT_Env'), water_material(), toon.outline_material()
    for me in meshes:
        me.materials.clear()
        me.materials.append(tm)
        me.materials.append(wm)
        me.materials.append(om)
        at = me.color_attributes.get('gv')
        if at is None:
            continue
        data = at.data
        for poly in me.polygons:
            poly.material_index = 1 if round(data[poly.vertices[0]].color[0] * 15) == WATER else 0


def add_outline(ob, thickness):
    """The inverted-hull outline on a prop instance (kit_lib: every role but shell and decal; here not water either):
    water vertices get no thickness, so pools keep their soft edges."""
    if thickness <= 0 or ob.type != 'MESH' or 'Outline' in ob.modifiers:
        return
    me = ob.data
    vg = None
    at = me.color_attributes.get('gv')
    if at is not None and any(round(d.color[0] * 15) == WATER for d in at.data):
        vg = ob.vertex_groups.new(name='solid')
        vg.add([i for i, d in enumerate(at.data) if round(d.color[0] * 15) != WATER], 1.0, 'REPLACE')
    so = ob.modifiers.new('Outline', 'SOLIDIFY')
    so.thickness = thickness
    so.offset = 1.0
    so.use_flip_normals = True
    so.use_rim = False
    so.material_offset = 2
    so.use_quality_normals = True
    if vg is not None:
        so.vertex_group = vg.name
        so.thickness_vertex_group = 0.0


def flame_object(col, pos, s=1.0):
    """A warm flame stand-in where the client will draw a lit brazier's or campfire's fire."""
    me = bpy.data.meshes.get('VLT_FlameMesh')
    if me is None:
        g = Geo()
        lathe(g, [(0.0, -0.04), (0.11, 0.05), (0.08, 0.2), (0.0, 0.42)], 6, GLOW, smooth=60.0)
        me = bpy.data.meshes.new('VLT_FlameMesh')
        me.from_pydata([tuple(v) for v in g.V], [], g.F)
        m = bpy.data.materials.new('VLT_Flame')
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs[0].default_value = (1.0, 0.6, 0.22, 1.0)
        em.inputs[1].default_value = 5.0
        o = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(em.outputs[0], o.inputs[0])
        me.materials.append(m)
    ob = bpy.data.objects.new('VLT_Flame~', me)
    col.objects.link(ob)
    ob.location = pos
    ob.scale = (s, s, s)
    ob.visible_shadow = False
    return ob


def eevee(sc, samples):
    sc.render.engine = 'BLENDER_EEVEE'
    try:
        sc.eevee.taa_render_samples = samples
    except Exception:
        pass
    sc.view_settings.view_transform = 'Standard'
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.resolution_percentage = 100


def set_world(sc, color, strength=1.0, fog=0.0, fog_color=(0.35, 0.62, 0.66)):
    w = bpy.data.worlds.get('VLT_World') or bpy.data.worlds.new('VLT_World')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs[0].default_value = (color[0], color[1], color[2], 1.0)
    bg.inputs[1].default_value = strength
    nt.links.new(bg.outputs[0], out.inputs['Surface'])
    if fog > 0:
        vs = nt.nodes.new('ShaderNodeVolumeScatter')
        vs.inputs['Color'].default_value = (fog_color[0], fog_color[1], fog_color[2], 1.0)
        vs.inputs['Density'].default_value = fog
        try:
            vs.inputs['Anisotropy'].default_value = 0.3
        except Exception:
            pass
        nt.links.new(vs.outputs[0], out.inputs['Volume'])
        for k, v in (('volumetric_start', 0.5), ('volumetric_end', 70.0), ('volumetric_tile_size', '8' if not QUICK else '16'),
                     ('volumetric_samples', 48 if not QUICK else 24), ('use_volumetric_shadows', False)):
            try:
                setattr(sc.eevee, k, v)
            except Exception:
                pass


def point_light(col, loc, color, watts, radius=0.12, name='VLT_Light'):
    ld = bpy.data.lights.new(name, 'POINT')
    ld.energy = watts
    ld.color = color[:3]
    ld.shadow_soft_size = radius
    try:
        ld.use_shadow = True
    except Exception:
        pass
    ob = bpy.data.objects.new(name, ld)
    col.objects.link(ob)
    ob.location = loc
    return ob


def sun(col, name, direction, energy, color):
    ld = bpy.data.lights.new(name, 'SUN')
    ld.energy = energy
    ld.color = color
    ld.angle = math.radians(5)
    ob = bpy.data.objects.new(name, ld)
    col.objects.link(ob)
    ob.rotation_euler = Vector(direction).to_track_quat('-Z', 'Y').to_euler()
    return ob


class Labels:
    """Text strips rendered in their own Workbench scene, for labelling contact-sheet cells."""

    def __init__(self):
        sc = bpy.data.scenes.new('VLT_Labels')
        sc.render.engine = 'BLENDER_WORKBENCH'
        sc.display.shading.light = 'FLAT'
        sc.display.shading.color_type = 'SINGLE'
        sc.display.shading.single_color = (0.93, 0.9, 0.82)
        w = bpy.data.worlds.new('VLT_LabelWorld')
        w.color = (0.03, 0.035, 0.045)
        sc.world = w
        sc.view_settings.view_transform = 'Standard'
        sc.render.image_settings.file_format = 'PNG'
        sc.render.image_settings.color_mode = 'RGBA'
        sc.render.resolution_percentage = 100
        cu = bpy.data.curves.new('VLT_Label', 'FONT')
        cu.align_x = 'LEFT'
        cu.align_y = 'CENTER'
        self.txt = bpy.data.objects.new('VLT_Label', cu)
        sc.collection.objects.link(self.txt)
        cam = bpy.data.objects.new('VLT_LabelCam', bpy.data.cameras.new('VLT_LabelCam'))
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = 10.0
        cam.location = (0, 0, 10)
        sc.collection.objects.link(cam)
        sc.camera = cam
        self.sc = sc

    def image(self, text, w, h):
        from render import load_pixels
        sc = self.sc
        sc.render.resolution_x, sc.render.resolution_y = w, h
        hm = 10.0 * h / w
        lines = text.count('\n') + 1
        self.txt.data.body = text
        self.txt.data.size = hm * (0.5 if lines == 1 else 0.34)
        self.txt.location = (-5.0 + 0.2, 0.0, 0)
        path = os.path.join(OUT, '_label.png')
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True, scene=sc.name)
        px = load_pixels(path)
        os.remove(path)
        return px


def compose(cells, labels, cols, out_path, bg=(0.03, 0.035, 0.045)):
    from render import save_pixels
    blocks = [np.concatenate([lab[..., :4], img[..., :4]], axis=0) for img, lab in zip(cells, labels)]
    h, w, _ = blocks[0].shape
    rows = (len(blocks) + cols - 1) // cols
    sheet = np.zeros((rows * h, cols * w, 4), dtype=np.float32)
    sheet[..., :3] = bg
    sheet[..., 3] = 1.0
    for i, b in enumerate(blocks):
        r, c = divmod(i, cols)
        y0 = (rows - 1 - r) * h
        sheet[y0:y0 + h, c * w:(c + 1) * w] = b
    save_pixels(out_path, sheet)
    return out_path


def ensure_rgba(px):
    if px.shape[2] == 4:
        return px
    a = np.ones(px.shape[:2] + (1,), dtype=np.float32)
    return np.concatenate([px, a], axis=2)


# ============================================================================ review: the kit sheet
def kit_sheet(objs):
    from render import load_pixels
    sc = bpy.context.scene
    eevee(sc, 8 if QUICK else 24)
    set_world(sc, (0.05, 0.062, 0.072), 1.0)
    size = 300 if QUICK else 420
    sc.render.resolution_x = sc.render.resolution_y = size
    stage = bpy.data.collections.new('VLT_SheetStage')
    sc.collection.children.link(stage)
    sun(stage, 'VLT_Key', (0.45, 0.75, -0.7), 2.4, (1.0, 0.96, 0.9))
    sun(stage, 'VLT_Fill', (-0.8, 0.3, -0.45), 0.6, (0.7, 0.85, 1.0))
    sun(stage, 'VLT_Rim', (-0.2, -0.9, -0.4), 0.9, (0.6, 0.9, 1.0))
    gme = quad_mesh('VLT_SheetGround', [(-5, -5, 5, 5)], -0.004)
    gmat = bpy.data.materials.new('VLT_SheetGroundMat')
    gmat.use_nodes = True
    gnt = gmat.node_tree
    gnt.nodes.clear()
    go = gnt.nodes.new('ShaderNodeOutputMaterial')
    ge = gnt.nodes.new('ShaderNodeEmission')
    ge.inputs[0].default_value = (0.045, 0.058, 0.066, 1)
    gnt.links.new(ge.outputs[0], go.inputs[0])
    gme.materials.append(gmat)
    ground = bpy.data.objects.new('VLT_SheetGround', gme)
    stage.objects.link(ground)
    cam = bpy.data.objects.new('VLT_SheetCam', bpy.data.cameras.new('VLT_SheetCam'))
    stage.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.clip_end = 400.0
    sc.camera = cam
    d = Vector((0.55, 1.0, -0.62)).normalized()
    right = d.cross(Vector((0, 0, 1))).normalized()
    up = right.cross(d).normalized()
    every = []
    for p, ob, parts, empties in objs:
        every += [ob] + parts
    labels = Labels()
    cells, labs = [], []
    for p, ob, parts, empties in objs:
        mine = [ob] + parts
        if p.role in ('prop', 'wall-hung'):
            for o in mine:
                add_outline(o, 0.008)
        for o in every:
            o.hide_render = o not in mine
        ground.hide_render = p.mount in ('hole', 'raft', 'quay')
        ground.location = ob.location
        ground.scale = (2.2 if p.group == 'set' else 1.0,) * 2 + (1.0,)
        pts = []
        for o in mine:
            for v in o.data.vertices:
                pts.append(o.matrix_world @ v.co)
        cen = sum(pts, Vector()) / len(pts)
        lo = [min((q - cen).dot(ax) for q in pts) for ax in (right, up)]
        hi = [max((q - cen).dot(ax) for q in pts) for ax in (right, up)]
        mid = cen + right * ((lo[0] + hi[0]) / 2) + up * ((lo[1] + hi[1]) / 2)
        cam.data.ortho_scale = max(hi[0] - lo[0], hi[1] - lo[1], 0.6) * 1.14
        cam.location = mid - d * 120.0
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        path = os.path.join(OUT, 'piece_%s.png' % p.name)
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        cells.append(ensure_rgba(load_pixels(path)))
        tag = ' (extra)' if p.extra else ''
        over = '  OVER' if p.tris() > p.budget else ''
        labs.append(ensure_rgba(labels.image('%s%s\n%d / %d tris%s' % (p.name, tag, p.tris(), p.budget, over), size, 52)))
    for o in every:
        o.hide_render = False
    out = compose(cells, labs, 6, os.path.join(OUT, 'kit_sheet.png'))
    for o in list(stage.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(stage)
    log('kit sheet', os.path.relpath(out, REPO))
    return out


# ============================================================================ review: the templates assembled from their JSON
SHARED_TRIS = {'shr_chest_small': 300, 'shr_chest_large': 520, 'shr_stairs_down': 400, 'shr_waystone': 800, 'shr_campfire': 180,
               'shr_torch_sconce': 90, 'shr_trap_plate': 24, 'shr_lore_tablet': 160, 'shr_gold_pile': 60, 'shr_door_frame_fx': 40}
SIDES = {'north': ((0, -1), 0.0), 'east': ((1, 0), -90.0), 'south': ((0, 1), 180.0), 'west': ((-1, 0), 90.0)}


def shared_placeholders(col):
    """Stand-ins for the shared kit (built by another pass) when kit_shared.glb is not there yet."""
    out = {}
    rnd = random.Random(5)

    def mk(name, g, light=None):
        me = make_mesh(name, g, 'noise', 3)
        ob = bpy.data.objects.new(name, me)
        col.objects.link(ob)
        if light:
            e = bpy.data.objects.new('light_0.' + name, None)
            col.objects.link(e)
            e.parent = ob
            e.location = light[0]
            e['color'] = light[1]
            e['light'] = light[2]
        out[name] = ob
    for name, (w, d, h) in (('shr_chest_small', (0.8, 0.5, 0.42)), ('shr_chest_large', (1.25, 0.62, 0.52))):
        g = Geo()
        box(g, (-w / 2, -d / 2, 0), (w / 2, d / 2, h), DWOOD, skip=('-z',))
        lathe(g, [(d / 2, -w / 2), (d / 2, w / 2)], 6, WOOD, smooth=40.0, cap0=True, cap1=True, phase=0.0, sy=1.0,
              mat=M((0, 0, h), ry=90, s=(0.45, 1.0, 1.0)))
        for x in (-w * 0.3, w * 0.3):
            box(g, (x - 0.04, -d / 2 - 0.01, 0.0), (x + 0.04, d / 2 + 0.01, h + 0.01), IRON, skip=('-z',))
        cbox(g, (0, -d / 2 - 0.02, h * 0.8), (0.12, 0.04, 0.14), BRASS)
        mk(name, g)
    g = Geo()
    for k in range(5):
        rock(g, (rnd.uniform(-0.4, 0.4), rnd.uniform(-0.3, 0.3), 0), (0.2, 0.18, 0.12), BRASS, rnd, n=5)
    mk('shr_gold_pile', g)
    g = Geo()
    for k in range(8):
        a = TAU * k / 8
        rock(g, (math.cos(a) * 0.62, math.sin(a) * 0.62, 0), (0.18, 0.15, 0.16), DSTONE, rnd, n=4)
    for k in range(3):
        a = TAU * k / 3
        sweep(g, [(math.cos(a) * 0.45, math.sin(a) * 0.45, 0.05), (-math.cos(a) * 0.1, -math.sin(a) * 0.1, 0.3)], 0.07, 5, WOOD, smooth=40.0)
    bipyramid(g, (0, 0, 0.32), 0.22, 0.55, 0.05, 6, CLOTH2)
    mk('shr_campfire', g, ((0, 0, 0.6), WARM, 'fire'))
    return out


def load_shared(col):
    if not os.path.exists(SHARED_GLB):
        log('no kit_shared.glb yet: shared pieces are stand-ins')
        return shared_placeholders(col), False
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=SHARED_GLB)
    new = [o for o in bpy.data.objects if o not in before]
    out = {}
    for o in new:
        for c in o.users_collection:
            c.objects.unlink(o)
        col.objects.link(o)
        if o.type == 'MESH':
            ca = o.data.color_attributes
            if 'gv' not in ca and len(ca):
                ca[0].name = 'gv'
        if o.type == 'MESH' and (o.parent is None or o.parent.type != 'MESH'):
            out[o.name] = o
    log('kit_shared.glb: %d pieces' % len(out))
    return out, True


def tpl_files():
    out = []
    for f in sorted(os.listdir(TPL_DIR)):
        if f.startswith('vlt-t-') and (f.endswith('.json') or f.endswith('.json.later')):
            t = read_json(os.path.join(TPL_DIR, f))
            if TPL_ONLY and t['id'] not in TPL_ONLY:
                continue
            out.append(t)
    return out


def rot_xz(x, z, deg):
    a = math.radians(deg)
    return x * math.cos(a) + z * math.sin(a), -x * math.sin(a) + z * math.cos(a)


def room_layout(tpl, pieces_by_name, rnd):
    """The shell (floor tiles, walls, doorways, corners) and the props of a template: [(meshId, (x, y, z), rotationY, scaleZ)]."""
    fw, fh = tpl['footprint']['w'], tpl['footprint']['h']
    W, D = 8 * fw, 8 * fh
    cam = tpl['camera']
    cdx, cdz = cam['position'][0] - cam['lookAt'][0], cam['position'][2] - cam['lookAt'][2]
    ln = math.hypot(cdx, cdz) or 1.0
    cd = (cdx / ln, cdz / ln)

    def low(side):
        n = SIDES[side][0]
        return n[0] * cd[0] + n[1] * cd[1] > 0.5
    def nearest_side(x, z):
        if W / 2 - abs(x) < D / 2 - abs(z):
            return 'east' if x > 0 else 'west'
        return 'south' if z > 0 else 'north'
    items, wall_props, holes = [], [], []
    for pr in tpl['props']:
        mid = pr['meshId']
        x, y, z = pr['position']
        r = pr['rotationY']
        pc = pieces_by_name.get(mid)
        if pc is not None and pc.role == 'wall-hung' and low(nearest_side(x, z)):
            continue   # the client hides wall-hung props on walls cut down for the camera (kit_lib.room_placements)
        items.append((mid, (x, y, z), r, 1.0))
        if pc is not None and pc.mount == 'wall':
            wall_props.append((x, z))
        if pc is not None and pc.replaces_floor and pc.footprint:
            fx0, fz0, fx1, fz1 = pc.footprint
            cs = [rot_xz(a, b, r) for a, b in ((fx0, fz0), (fx1, fz0), (fx1, fz1), (fx0, fz1))]
            holes.append((x + min(c[0] for c in cs), z + min(c[1] for c in cs), x + max(c[0] for c in cs), z + max(c[1] for c in cs)))
    for i in range(W // 2):
        for j in range(D // 2):
            tx, tz = -W / 2 + 1 + 2 * i, -D / 2 + 1 + 2 * j
            if any(x0 < tx < x1 and z0 < tz < z1 for (x0, z0, x1, z1) in holes):
                continue
            mid = 'vlt_floor_basalt_wet' if rnd.random() < 0.15 else 'vlt_floor_basalt'
            items.append((mid, (tx, 0, tz), 90 * rnd.randint(0, 3), 1.0))
    for side, ((nx, nz), rot) in SIDES.items():
        along_x = side in ('north', 'south')
        cells = fw if along_x else fh
        L = W if along_x else D
        fixed = (nz * D / 2) if along_x else (nx * W / 2)
        doors = [d['offset'] for d in tpl['doors'] if d['side'] == side]
        lo = low(side)
        for k in range(cells):
            a = -L / 2 + 8 * k
            segs = [(a + 1, 'wall'), (a + 4, 'door'), (a + 7, 'wall')] if k in doors else [(a + 1, 'wall'), (a + 3, 'wall'), (a + 5, 'wall'), (a + 7, 'wall')]
            for c, kind in segs:
                gx, gz = (c, fixed) if along_x else (fixed, c)
                if kind == 'door':
                    mid = 'vlt_door_arch_cut' if lo else 'vlt_door_arch_iron'
                elif lo:
                    mid = 'vlt_wall_cut_2m'
                else:
                    near = any(abs(gx - wx) < 1.7 and abs(gz - wz) < 1.7 for wx, wz in wall_props)
                    mid = 'vlt_wall_pipes_2m' if (not near and rnd.random() < 0.25) else 'vlt_wall_vault_2m'
                items.append((mid, (gx, 0, gz), rot, 1.0))
    for (sx, sz, rot, sa, sb) in ((-1, -1, 0.0, 'north', 'west'), (1, -1, -90.0, 'north', 'east'), (1, 1, 180.0, 'south', 'east'), (-1, 1, 90.0, 'south', 'west')):
        lo = low(sa) or low(sb)
        items.append(('vlt_wall_corner_cut' if lo else 'vlt_wall_corner_in', (sx * W / 2, 0, sz * D / 2), rot, 1.0))
    return items, W, D, cd


def place(col, mid, pos, rot, sz, objmap, lights, outline=0.0):
    src = objmap.get(mid)
    if src is None:
        return None
    gx, gy, gz = pos
    mw = Matrix.Translation((gx, -gz, gy)) @ Matrix.Rotation(math.radians(rot), 4, 'Z') @ Matrix.Diagonal((1.0, 1.0, sz, 1.0))
    o = bpy.data.objects.new(mid + '~', src.data)
    col.objects.link(o)
    o.matrix_world = mw
    o.hide_render = False
    add_outline(o, outline)
    meshes = [src.data]
    for ch in src.children:
        if ch.type == 'MESH':
            c = bpy.data.objects.new(ch.name + '~', ch.data)
            col.objects.link(c)
            c.matrix_world = mw @ ch.matrix_basis
            add_outline(c, outline)
            meshes.append(ch.data)
        elif ch.name.startswith('light_') and sz > 0.5:
            lights.append(((mw @ ch.matrix_basis).translation.copy(), ch.get('color', CYAN), ch.get('light', 'flame')))
    return meshes


def tri_count_mesh(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def render_template(tpl, objmap, pieces_by_name, kit_objs):
    sc = bpy.context.scene
    rnd = random.Random(tpl['id'])
    items, W, D, cd = room_layout(tpl, pieces_by_name, rnd)
    col = bpy.data.collections.new('TPL_' + tpl['id'])
    sc.collection.children.link(col)
    for o in kit_objs:
        o.hide_render = True
    lights = []
    tris, calls, missing = 0, set(), set()
    for mid, pos, rot, sz in items:
        pc = pieces_by_name.get(mid)
        role = pc.role if pc is not None else ('prop' if mid.startswith('shr_') else 'shell')
        ms = place(col, mid, pos, rot, sz, objmap, lights, 0.012 if role in ('prop', 'wall-hung', 'hanging') else 0.0)
        if ms is None:
            missing.add(mid)
            continue
        for me in ms:
            calls.add(me.name)
            tris += SHARED_TRIS[mid] if (mid in SHARED_TRIS and me is ms[0]) else tri_count_mesh(me)
    look = tpl['camera']['lookAt']
    reach = 0.42 * min(W, D) / 2 + 0.6
    party = (look[0] + cd[0] * reach, look[2] + cd[1] * reach)
    lat = (-cd[1], cd[0])
    for s in (-1, 1):
        point_light(col, (party[0] + lat[0] * 1.5 * s, -(party[1] + lat[1] * 1.5 * s), 2.1), TORCH, TORCH_W, 0.15, 'VLT_Torch')
    for pos, hx, kind in lights:
        point_light(col, pos, hexcol(hx), LAMP_W.get(kind, 40.0), 0.08, 'VLT_Lamp')
        if kind in ('brazier', 'fire'):
            flame_object(col, pos - Vector((0, 0, 0.18)), 1.0)
    c = tpl['camera']
    cam = bpy.data.objects.new('VLT_TplCam', bpy.data.cameras.new('VLT_TplCam'))
    col.objects.link(cam)
    P = Vector((c['position'][0], -c['position'][2], c['position'][1]))
    Lk = Vector((c['lookAt'][0], -c['lookAt'][2], c['lookAt'][1]))
    cam.location = P
    cam.rotation_euler = (Lk - P).to_track_quat('-Z', 'Y').to_euler()
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.sensor_height = 24.0
    cam.data.lens = 12.0 / math.tan(math.radians(c['fov']) / 2)
    cam.data.clip_start = 0.1
    cam.data.clip_end = 300.0
    sc.camera = cam
    eevee(sc, 12 if QUICK else 48)
    set_world(sc, (0.016, 0.03, 0.036), 1.0, fog=(0.012 if FOG else 0.0))
    sc.render.resolution_x, sc.render.resolution_y = (1040, 480) if QUICK else (1560, 720)
    view = os.path.join(OUT, 'tpl_%s.png' % tpl['id'])
    sc.render.filepath = view
    bpy.ops.render.render(write_still=True)
    if not QUICK:
        K.save_px(os.path.join(OUT, 'tpl_%s_phone.png' % tpl['id']), K.shrink(K.load_px(view), 2))
    # plan view: straight down, flat light, no fog
    for o in [o for o in col.objects if o.type == 'LIGHT']:
        o.hide_render = True
    s1 = sun(col, 'VLT_PlanSun', (0.15, 0.25, -1.0), 2.6, (1.0, 0.97, 0.92))
    set_world(sc, (0.08, 0.1, 0.11), 1.0)
    cam.data.type = 'ORTHO'
    cam.data.sensor_fit = 'AUTO'
    cam.data.ortho_scale = max(W, D) + 3.0
    cam.location = (0.0, 0.0, 60.0)
    cam.rotation_euler = (0.0, 0.0, 0.0)
    big = 820 if QUICK else 1100
    sc.render.resolution_x = int(big * (W + 3.0) / (max(W, D) + 3.0))
    sc.render.resolution_y = int(big * (D + 3.0) / (max(W, D) + 3.0))
    plan = os.path.join(OUT, 'plan_%s.png' % tpl['id'])
    sc.render.filepath = plan
    bpy.ops.render.render(write_still=True)
    for o in list(col.objects):
        data = o.data if o.type in ('LIGHT', 'CAMERA') else None
        bpy.data.objects.remove(o, do_unlink=True)
        if data is not None:
            if isinstance(data, bpy.types.Light):
                bpy.data.lights.remove(data)
            else:
                bpy.data.cameras.remove(data)
    bpy.data.collections.remove(col)
    for o in kit_objs:
        o.hide_render = False
    info = dict(id=tpl['id'], tris=tris, calls=len(calls), lamps=len(lights), missing=sorted(missing), view=view, plan=plan, W=W, D=D)
    log('template %s: %d tris, %d meshes, %d lamps%s' % (tpl['id'], tris, len(calls), len(lights), (' missing ' + ', '.join(sorted(missing))) if missing else ''))
    return info


# ============================================================================ main
def report(objs, tpl_info, kb):
    lines = ['# Drowned Vault kit — build report', '', 'Generated by tools/blender/env/build_kit_vault.py%s.' % (' (--quick)' if QUICK else ''), '',
             '| piece | group | tris | budget | parts | lights | fx |', '|---|---|---:|---:|---|---:|---:|']
    for p, ob, parts, empties in objs:
        flag = ' **over**' if p.tris() > p.budget else ''
        lines.append('| `%s`%s | %s | %d%s | %d | %s | %d | %d |' % (p.name, ' (extra)' if p.extra else '', p.group, p.tris(), flag, p.budget,
                     ', '.join(p.parts.keys()) or '—', len(p.lights), len(p.fx)))
    if kb:
        lines += ['', 'kit_vault.glb: %.1f KB' % kb]
    if tpl_info:
        lines += ['', '| template | room | tris | meshes (draw calls) | lamps | missing |', '|---|---|---:|---:|---:|---|']
        for t in tpl_info:
            lines.append('| `%s` | %d x %d m | %d | %d | %d | %s |' % (t['id'], t['W'], t['D'], t['tris'], t['calls'], t['lamps'], ', '.join(t['missing']) or '—'))
    path = os.path.join(OUT, 'report.md')
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')
    log('report', os.path.relpath(path, REPO))


def main():
    t0 = time.time()
    os.makedirs(OUT, exist_ok=True)
    K.write_palette('vault', VAULT, VAULT_ABOUT)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    col = bpy.data.collections.new('VLT_Kit')
    sc.collection.children.link(col)
    pieces = []
    for fn in BUILDERS:
        p = fn()
        if ONLY and p.name not in ONLY:
            continue
        pieces.append(p)
    objs = []
    for i, p in enumerate(pieces):
        ob, parts, empties = build_objects(p, col)
        ob.location = (1000.0 + (i % 6) * 32.0, -(i // 6) * 32.0, 0.0)
        objs.append((p, ob, parts, empties))
        log('%-26s %5d / %5d tris%s' % (p.name, p.tris(), p.budget, '  OVER' if p.tris() > p.budget else ''))
    bpy.context.view_layer.update()
    if DO_BAKE:
        bake_ao(objs)
    kb = 0.0
    if DO_EXPORT:
        kb = export_kit(objs)
        write_meta(objs, kb)
    meshes = set()
    for p, ob, parts, empties in objs:
        meshes.add(ob.data)
        for po in parts:
            meshes.add(po.data)
    apply_review_mats(meshes)
    tpl_info = []
    if DO_SHEET:
        kit_sheet(objs)
    if DO_TEMPLATES:
        shared_col = bpy.data.collections.new('VLT_Shared')
        sc.collection.children.link(shared_col)
        shared, real = load_shared(shared_col)
        apply_review_mats({o.data for o in shared_col.objects if o.type == 'MESH'})
        for o in shared_col.objects:
            o.hide_render = True
        objmap = {p.name: ob for p, ob, parts, empties in objs}
        objmap.update(shared)
        by_name = {p.name: p for p in pieces}
        kit_objs = [o for p, ob, parts, empties in objs for o in [ob] + parts]
        for tpl in tpl_files():
            tpl_info.append(render_template(tpl, objmap, by_name, kit_objs))
    report(objs, tpl_info, kb)
    from common import save_blend
    save_blend(BLEND)
    log('done in %.1fs' % (time.time() - t0))


if __name__ == '__main__':
    main()

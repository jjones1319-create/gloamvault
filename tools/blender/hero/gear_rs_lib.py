"""gear_rs_lib.py — building blocks for the Ranger and Shade gear builds (build_gear_ranger.py, build_gear_shade.py),
on top of `gear_lib.py` (which stays untouched).

Why a second layer: the body is 10,498 triangles, so a plain shell of its faces (gear_lib.shell) is far too dense for a
4.5k-triangle set (the hands alone are 1,540 triangles). Here a piece is built as an ordinary mesh in broad-basis space
(an `MB`), from any of these:
- `garment()`: a gear_lib shell with exact plane-cut hems, smoothed (anatomy softened into cloth and leather, kept a
  minimum clearance off the skin), simplified to even triangles (`simplify_uniform`, cut hems kept on their planes) and
  inflated so the *faces*, not just the vertices, keep the clearance (`inflate_faces`, optionally over another piece's
  surface: layering by reference);
- `tube()` / `cuff()` / `ring_band()`: rings fitted to the body's (or another piece's) cross-sections round a limb or
  the torso — cuffs, bracers, belts, straps that follow a boot; `boot_tube()`: a boot as one tube bent at the ankle;
- `hood_shell()` / `face_mask()`: rows fitted to the head from a centre (hoods hug the skull, gather at the neck, drape);
- `drape()`: cloth hung from an attachment line, falling under gravity but kept off the body (cloaks);
- `ribbon()`, `edge_band()`, `two_band()`, `wrap_lines()`, `tiles()`, `box()`, `blob()`, `patch()`: straps, trim bands,
  glow lines, wraps, scales, buckles, studs, pouches, knee patches; `rim()` / `thicken()`: lips and linings;
and then `to_piece()` splits every quad safely (`triangulate_safe`: a twisted quad would render half backward) and
binds EVERY vertex to a body triangle (gear_lib 'bind' sources — the triangle under the shell vertex it came from, or
the nearest triangle of chosen regions), so `gear_lib.realize()` carries it to the slight frame and through every
species key, with weights blended from that triangle. Optional per-vertex weight overrides (`MB.w`) are applied after
`realize()` by `realize_piece()`. `covered_regions()` decides `hides`: a region goes in only if no game camera (level
or above, not grazing) can see any of its vertices past the piece.

The review harness (palette per class and tier, the body with the hidden regions dropped the way the client drops
them, outlines that do not move the surface, set / gear-sheet / pose / species renders, a numeric poke-through count)
and `run_class()` (build → realize both frames → review → save → export → re-import) are at the end. Every number is a
tuning value; the scripts are re-runnable end to end.
"""
import math
import os
import sys

import bmesh  # noqa: F401  (kept for scripts that import * from here)
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import closest_point_on_tri
from mathutils.kdtree import KDTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))
import gear_lib as G  # noqa: E402
import toon  # noqa: E402
from common import CONTENT, log, read_json  # noqa: E402
from fit import SurfaceMap  # noqa: E402

REG = toon.REGION
SL = toon.SLOT
TAU = 2 * math.pi


# ====================================================================== the body, read once
class Fit:
    """The broad body as a fitting surface: positions, normals, triangles, BVH trees per region set, adjacency."""

    def __init__(self, bodies):
        self.bodies = bodies
        b = bodies['broad']
        self.b = b
        self.P = b.shapes['Basis']
        self.N = b.normals['Basis']
        self.smap = SurfaceMap(self.P, b.faces)
        self.tri_face = []
        for fi, f in enumerate(b.faces):
            for _ in range(1, len(f) - 1):
                self.tri_face.append(fi)
        self.tri_region = [b.face_regions[fi] for fi in self.tri_face]
        self.vert_tris = [[] for _ in self.P]
        self.vert_nbrs = [set() for _ in self.P]
        for ti, t in enumerate(self.smap.tris):
            for a in t:
                self.vert_tris[a].append(ti)
                for c in t:
                    if c != a:
                        self.vert_nbrs[a].add(c)
        self.all_tree = BVHTree.FromPolygons(self.P, self.smap.tris)
        self._trees = {}
        self._region_verts = {}

    def ids(self, regions):
        return frozenset(REG[r] if isinstance(r, str) else r for r in regions)

    def tree(self, regions=None):
        """(BVH tree, triangle index map) over the triangles of the given regions (names or ids), or of a target registered by
        custom_tree() under a string name."""
        if regions is None:
            return self.all_tree, None
        if isinstance(regions, str):
            if regions in self._trees:
                return self._trees[regions]
            regions = (regions,)
        key = self.ids(regions)
        if key not in self._trees:
            tris = [ti for ti, r in enumerate(self.tri_region) if r in key]
            self._trees[key] = (BVHTree.FromPolygons(self.P, [self.smap.tris[t] for t in tris]), tris)
        return self._trees[key]

    def nearest(self, p, regions=None):
        tree, tris = self.tree(regions)
        loc, n, i, d = tree.find_nearest(Vector(p))
        if loc is None:
            raise RuntimeError('no body surface near %s' % (tuple(p),))
        return (tris[i] if tris is not None else i), loc, n.normalized(), d

    def signed(self, p, regions=None):
        ti, loc, n, d = self.nearest(p, regions)
        return (Vector(p) - loc).dot(n), loc, n, ti

    def on_surface(self, p, off=0.0, regions=None):
        ti, loc, n, d = self.nearest(p, regions)
        return loc + n * off, n

    def region_verts(self, regions):
        key = self.ids(regions)
        if key not in self._region_verts:
            self._region_verts[key] = [i for i, r in enumerate(self.b.regions) if r in key]
        return self._region_verts[key]

    def tri_near_vertex(self, p, vi, rings=2):
        verts = {vi}
        for _ in range(rings):
            verts = verts | set().union(*(self.vert_nbrs[v] for v in verts))
        cand = set()
        for v in verts:
            cand.update(self.vert_tris[v])
        best, best_d = None, 1e9
        p = Vector(p)
        for ti in cand:
            a, b, c = (self.P[k] for k in self.smap.tris[ti])
            q = closest_point_on_tri(p, a, b, c)
            d = (q - p).length
            if d < best_d:
                best, best_d = ti, d
        return best

    def joint(self, bone, end='head'):
        return G.joint(self.bodies, bone, end)


# ====================================================================== a piece as a mesh in broad space
class MB:
    """Vertices (broad-basis positions) with a binding rule each — ('hint', body vertex) · ('regions', names) ·
    ('tri', triangle) — an optional weight override [(bone, w)], faces and a palette slot per face."""

    def __init__(self):
        self.v, self.bind, self.w, self.f, self.s = [], [], [], [], []

    def add_v(self, co, bind, w=None):
        self.v.append(Vector(co))
        self.bind.append(bind)
        self.w.append(w)
        return len(self.v) - 1

    def add_f(self, vs, slot):
        self.f.append(tuple(vs))
        self.s.append(slot)

    def extend(self, *others):
        for o in others:
            if o is None:
                continue
            base = len(self.v)
            self.v += [Vector(c) for c in o.v]
            self.bind += list(o.bind)
            self.w += list(o.w)
            self.f += [tuple(base + i for i in f) for f in o.f]
            self.s += list(o.s)
        return self

    def tris(self):
        return sum(len(f) - 2 for f in self.f)

    def centroid(self, k):
        f = self.f[k]
        return sum((self.v[i] for i in f), Vector()) / len(f)

    def face_normal(self, k):
        f = self.f[k]
        n = Vector()
        for i in range(len(f)):
            a, b = self.v[f[i]], self.v[f[(i + 1) % len(f)]]
            n += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
        return n.normalized() if n.length > 1e-12 else Vector((0, 0, 1))

    def vertex_normals(self):
        acc = [Vector() for _ in self.v]
        for k, f in enumerate(self.f):
            n = self.face_normal(k)
            for i in f:
                acc[i] += n
        return [a.normalized() if a.length > 1e-12 else Vector((0, 0, 1)) for a in acc]

    def adjacency(self):
        nb = [set() for _ in self.v]
        count = {}
        for f in self.f:
            for k in range(len(f)):
                a, c = f[k], f[(k + 1) % len(f)]
                nb[a].add(c)
                nb[c].add(a)
                e = (min(a, c), max(a, c))
                count[e] = count.get(e, 0) + 1
        bnd = set()
        for (a, c), m in count.items():
            if m == 1:
                bnd.update((a, c))
        return nb, bnd

    def boundary_loops(self):
        count, order = {}, {}
        for f in self.f:
            for k in range(len(f)):
                a, c = f[k], f[(k + 1) % len(f)]
                e = (min(a, c), max(a, c))
                count[e] = count.get(e, 0) + 1
                order[e] = (a, c)
        nxt = {}
        for e, m in count.items():
            if m == 1:
                a, c = order[e]
                nxt[a] = c          # the face's winding: walking the open edges keeps the face on one side
        loops, seen = [], set()
        for s in list(nxt):
            if s in seen:
                continue
            loop, cur = [], s
            while cur in nxt and cur not in seen:
                seen.add(cur)
                loop.append(cur)
                cur = nxt[cur]
            if len(loop) >= 3:
                loops.append(loop)
        return loops

    def restyle(self, fn):
        """fn(centroid, face normal, current slot) → slot, per face."""
        for k in range(len(self.f)):
            self.s[k] = fn(self.centroid(k), self.face_normal(k), self.s[k])
        return self

    def flip(self):
        self.f = [tuple(reversed(f)) for f in self.f]
        return self

    def tree(self):
        return BVHTree.FromPolygons(self.v, self.f)

    def compact(self):
        used = sorted({i for f in self.f for i in f})
        remap = {o: n for n, o in enumerate(used)}
        self.v = [self.v[o] for o in used]
        self.bind = [self.bind[o] for o in used]
        self.w = [self.w[o] for o in used]
        self.f = [tuple(remap[i] for i in f) for f in self.f]
        return self


def merge(*mbs):
    return MB().extend(*mbs)


# ====================================================================== shells: garment()
def garment(fit, regions, offset, cuts=(), keep_face=None, offset_fn=None, smooth=0, clear=None, ratio=None,
            protect=None, slot=0, pin_boundary=True, clear_regions=None, slot_fn=None, post=None):
    """A shell of the body's faces in `regions` pushed out by `offset` (or offset_fn(pos, normal, region) per vertex),
    clipped by `cuts` ([{point, normal, keep, regions}] — gear_lib.cut, exact hems), smoothed `smooth` Taubin rounds
    while kept `clear` off the skin, decimated to `ratio` with the hems (and `protect(pos)` → 0..1 weights) kept.
    slot_fn(region, centroid) → slot per face (before decimation, so sleeves and body keep their colours);
    post(mb) runs after smoothing, before decimation (e.g. flattening a sole)."""
    p, _ = G.shell(fit.bodies, regions, offset, slot, 'garment', keep_face)
    if offset_fn:
        for k, s in enumerate(p.src):
            if s[0] == 'push':
                p.src[k] = ('push', s[1], offset_fn(fit.P[s[1]], fit.N[s[1]], fit.b.regions[s[1]]))
    for c in cuts:
        G.cut(p, fit.bodies, c['point'], c['normal'], c.get('keep', 'front'), c.get('regions'))
    used = sorted({v for f in p.faces for v in f})
    remap = {o: n for n, o in enumerate(used)}
    mb = MB()
    for o in used:
        s = p.src[o]
        co = G._position(p, s, fit.b, 'Basis', fit.smap)
        hint = s[1] if s[0] == 'push' else (s[1] if s[3] < 0.5 else s[2])
        mb.add_v(co, ('hint', hint))
    for f, sl in zip(p.faces, p.slots):
        mb.add_f([remap[v] for v in f], sl)
    if slot_fn:
        for k, f in enumerate(mb.f):
            rs = [fit.b.regions[mb.bind[i][1]] for i in f]
            mb.s[k] = slot_fn(max(set(rs), key=rs.count), mb.centroid(k))
    if smooth:
        smooth_mb(fit, mb, smooth, clear if clear is not None else offset * 0.7, pin_boundary, clear_regions)
    if post:
        post(mb)
    if ratio and ratio < 1:
        mb = simplify_uniform(mb, ratio, protect)
        if clear is not None or smooth:
            enforce_clear(fit, mb, clear if clear is not None else offset * 0.7, clear_regions)
            inflate_faces(fit, mb, clear if clear is not None else offset * 0.7, regions=clear_regions)
    return mb


def smooth_mb(fit, mb, iters, clear, pin_boundary=True, regions=None, lam=0.55, mu=-0.58, boundary_1d=True):
    """Taubin smoothing (no shrinking) with the open edges pinned (or smoothed along themselves only), then every
    vertex pushed back to at least `clear` off the skin."""
    nb, bnd = mb.adjacency()
    bnb = {i: [j for j in nb[i] if j in bnd] for i in bnd}
    for _ in range(iters):
        for fac in (lam, mu):
            new = []
            for i, v in enumerate(mb.v):
                if i in bnd:
                    if pin_boundary and not boundary_1d or len(bnb[i]) != 2:
                        new.append(v)
                        continue
                    if pin_boundary and boundary_1d:
                        avg = (mb.v[bnb[i][0]] + mb.v[bnb[i][1]]) * 0.5
                        new.append(v + (avg - v) * fac * 0.5)
                        continue
                    ns = bnb[i]
                else:
                    ns = nb[i]
                if not ns:
                    new.append(v)
                    continue
                avg = sum((mb.v[j] for j in ns), Vector()) / len(ns)
                new.append(v + (avg - v) * fac)
            mb.v = new
        enforce_clear(fit, mb, clear, regions)
    return mb


def enforce_clear(fit, mb, clear, regions=None, only=None):
    """Every vertex at least `clear` metres outside the skin (nearest point, along that triangle's normal)."""
    moved = 0
    for i, v in enumerate(mb.v):
        if only is not None and i not in only:
            continue
        sd, loc, n, _ = fit.signed(v, regions)
        if sd < clear:
            mb.v[i] = loc + n * clear
            moved += 1
    return moved


def inflate_faces(fit, mb, clear, iters=4, regions=None, cap=0.012, ref=None, ref_clear=0.004, ref_reach=0.035):
    """After simplification the vertices keep their clearance but a long face sags toward the skin between them (a
    5 cm chord over a thigh sags ~6 mm). Each face is sampled (centroid and edge midpoints); where a sample is closer
    than `clear` to the skin — or, with `ref` (the BVH of the layer underneath: leggings under a jerkin or a boot, a
    sleeve under a bracer), closer than `ref_clear` to that layer — that face's vertices move out along their normals
    by the deficit (at most `cap` a pass)."""
    samples = ((1 / 3, 1 / 3, 1 / 3), (0.5, 0.5, 0.0), (0.0, 0.5, 0.5), (0.5, 0.0, 0.5))
    for _ in range(iters):
        vn = mb.vertex_normals()
        push = [0.0] * len(mb.v)
        hit = False
        for f in mb.f:
            for k in range(1, len(f) - 1):
                ids = (f[0], f[k], f[k + 1])
                a, b, c = (mb.v[i] for i in ids)
                for wa, wb, wc in samples:
                    q = a * wa + b * wb + c * wc
                    sd, _, _, _ = fit.signed(q, regions)
                    deficit = clear - sd
                    if ref is not None:
                        loc, nrm, _, dist = ref.find_nearest(q)
                        if loc is not None and dist < ref_reach:
                            deficit = max(deficit, ref_clear - (q - loc).dot(nrm.normalized()))
                    if deficit > 0:
                        d = min(cap, deficit * 1.08)
                        for i in ids:
                            if d > push[i]:
                                push[i] = d
                        hit = True
        if not hit:
            break
        for i, d in enumerate(push):
            if d > 0:
                mb.v[i] = mb.v[i] + vn[i] * d
    return mb


def decimate_mb(mb, ratio, protect=None, factor=4.0):
    """Blender's collapse decimator (X-symmetric) on the piece, open edges weighted to stay. Each new vertex takes the
    binding of the nearest old vertex on the old face under it; each new face the slot of the old face under it."""
    me = bpy.data.meshes.new('gv_dec')
    me.from_pydata([tuple(v) for v in mb.v], [], mb.f)
    me.update()
    ob = bpy.data.objects.new('gv_dec', me)
    bpy.context.scene.collection.objects.link(ob)
    _, bnd = mb.adjacency()
    vg = ob.vertex_groups.new(name='keep')
    for i, v in enumerate(mb.v):
        vg.add([i], 0.0 if i in bnd else (protect(v) if protect else 1.0), 'REPLACE')
    mod = ob.modifiers.new('dec', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = ratio
    mod.use_symmetry = True
    mod.symmetry_axis = 'X'
    mod.vertex_group = 'keep'
    mod.vertex_group_factor = factor
    mod.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    m2 = ev.to_mesh()
    verts = [v.co.copy() for v in m2.vertices]
    faces = [tuple(p.vertices) for p in m2.polygons]
    ev.to_mesh_clear()
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    old = mb.tree()
    out = MB()
    for co in verts:
        _, _, fi, _ = old.find_nearest(co)
        j = min(mb.f[fi], key=lambda k: (mb.v[k] - co).length)
        out.add_v(co, mb.bind[j], mb.w[j])
    for f in faces:
        c = sum((out.v[i] for i in f), Vector()) / len(f)
        _, _, fi, _ = old.find_nearest(c)
        out.add_f(f, mb.s[fi])
    return out


# ====================================================================== rims, bands and thickness
def rim(mb, width, slot, loops=None, direction='normal', select=None):
    """A lip along open edges: each loop vertex gets a twin `width` further along the piece's vertex normal
    (direction='normal') or along `direction` (a Vector), joined by a strip of faces in `slot`. `select(loop)` may
    keep only some loops (e.g. the hem, not the collar)."""
    loops = loops if loops is not None else mb.boundary_loops()
    vn = mb.vertex_normals()
    for loop in loops:
        if select is not None and not select([mb.v[i] for i in loop]):
            continue
        twins = []
        for i in loop:
            d = vn[i] if direction == 'normal' else Vector(direction)
            twins.append(mb.add_v(mb.v[i] + d * width, mb.bind[i], mb.w[i]))
        n = len(loop)
        for k in range(n):
            a, c = loop[k], loop[(k + 1) % n]
            mb.add_f((c, a, twins[k], twins[(k + 1) % n]), slot)
    return mb


def thicken(mb, t, slot_in, slot_rim, flip_inner=True, inward=None):
    """A closed thin solid from an open surface: an inner copy `t` inward (along -vertex normal, or along
    inward(i, point, normal) — e.g. toward a hood's centre, so a peak cannot fold through itself), flipped, and a rim
    strip joining every open edge — cloth that reads from both sides and never shows a back face.
    Keep t >= 0.010: the review outline (toon.apply_look) moves each surface 4 mm along -normal, which swaps two
    surfaces closer than 8 mm."""
    vn = mb.vertex_normals()
    n0 = len(mb.v)
    loops = mb.boundary_loops()
    for i in range(n0):
        d = inward(i, mb.v[i], vn[i]) if inward else -vn[i]
        mb.add_v(mb.v[i] + d.normalized() * t, mb.bind[i], mb.w[i])
    nf = len(mb.f)
    cents = [mb.centroid(k) for k in range(nf)]
    for k in range(nf):
        f = mb.f[k]
        inner = tuple(n0 + i for i in f)
        mb.add_f(tuple(reversed(inner)) if flip_inner else inner, slot_in(cents[k]) if callable(slot_in) else slot_in)
    for loop in loops:
        n = len(loop)
        for k in range(n):
            a, c = loop[k], loop[(k + 1) % n]
            mb.add_f((c, a, n0 + a, n0 + c), slot_rim)
    return mb


# ====================================================================== fitted rings: tube()
def axes_for(d, ref=Vector((0, -1, 0))):
    d = Vector(d).normalized()
    u = Vector(ref) - d * Vector(ref).dot(d)
    if u.length < 1e-6:
        u = Vector((1, 0, 0)) - d * d.x
    u.normalize()
    return d, u, d.cross(u)


def section(fit, c, d, u, v, regions, segs, slab=0.014, window=1.4, verts=None, centre=False, points=None):
    """Max radius of the body's vertices (in `regions`) within a slab around the plane through c ⟂ d, per sector of
    `segs` (angle from u toward v). Empty sectors are interpolated. With centre=True the ring centre moves to the slab's
    centroid first (torso rings). Returns (centre, radii)."""
    src = points if points is not None else [fit.P[i] for i in (verts if verts is not None else fit.region_verts(regions))]
    side = 0.0 if abs(c.x) < 0.04 else math.copysign(1.0, c.x)   # a limb: never the other limb in the slab
    pts = []
    for P_ in src:
        if side and P_.x * side < 0.01:
            continue
        q = P_ - c
        if abs(q.dot(d)) <= slab:
            pts.append(P_)
    if centre and pts:
        m = sum(pts, Vector()) / len(pts)
        c = c + (m - c) - d * (m - c).dot(d)
    R = [0.0] * segs
    for p in pts:
        q = p - c
        x, y = q.dot(u), q.dot(v)
        r = math.hypot(x, y)
        a = (math.atan2(y, x) % TAU) / TAU * segs
        for kk in range(int(math.floor(a - window)), int(math.ceil(a + window)) + 1):
            if abs(kk - a) <= window:
                j = kk % segs
                if r > R[j]:
                    R[j] = r
    known = [k for k in range(segs) if R[k] > 0]
    if not known:
        return c, None
    for k in range(segs):
        if R[k] == 0:
            lo = max((j for j in known if j < k), default=known[-1] - segs)
            hi = min((j for j in known if j > k), default=known[0] + segs)
            t = (k - lo) / (hi - lo)
            R[k] = R[lo % segs] * (1 - t) + R[hi % segs] * t
    return c, R


def smooth_ring(R, passes=1, keep_max=True):
    n = len(R)
    out = list(R)
    for _ in range(passes):
        out = [(out[(k - 1) % n] + 2 * out[k] + out[(k + 1) % n]) / 4 for k in range(n)]
    if keep_max:
        out = [max(a, b) for a, b in zip(out, R)]
    return out


def tube(fit, a, b, ts, regions, segs, clear, slot, ref=Vector((0, -1, 0)), slab=0.014, centre=False, bind=None,
         scale=None, caps=False, smooth_passes=1, close=True, points=None):
    """Rings fitted around the axis a→b at parameters `ts` (0 = a, 1 = b, may run past either end): radius per sector
    = the body's section there (+ chord margin) + clear(t) (a number or a function of t); scale(t, angle) may shape it
    (flares, folds). Faces in `slot` (a value or a function (row, seg) → slot). Bound to the nearest triangle of `regions`
    (or `bind`). Returns the MB; mb.rows holds the ring vertex indices."""
    a, b = Vector(a), Vector(b)
    d, u, v = axes_for(b - a, ref)
    mb = MB()
    rows = []
    margin = 1.0 / math.cos(math.pi / segs)
    prevR = None
    for t in ts:
        c = a.lerp(b, t)
        c2, R = section(fit, c, d, u, v, regions, segs, slab, centre=centre, points=points)
        if R is None and points is not None:          # too few given points in this slab: the body's section
            c2, R = section(fit, c, d, u, v, regions, segs, slab, centre=centre)
        if R is None:
            R = prevR
            c2 = c
        if R is None:
            raise ValueError('tube: nothing to fit at t=%s' % t)
        prevR = R
        R = smooth_ring(R, smooth_passes)
        cl = clear(t) if callable(clear) else clear
        row = []
        for k in range(segs):
            th = TAU * k / segs
            r = R[k] * margin + cl
            if scale:
                r = scale(t, th, r)
            p = c2 + (u * math.cos(th) + v * math.sin(th)) * r
            row.append(mb.add_v(p, bind or ('regions', tuple(regions))))
        rows.append(row)
    nseg = segs if close else segs - 1
    for i in range(len(rows) - 1):
        for k in range(nseg):
            k2 = (k + 1) % segs
            sl = slot(i, k) if callable(slot) else slot
            mb.add_f((rows[i][k], rows[i][k2], rows[i + 1][k2], rows[i + 1][k]), sl)
    # faces must point outward: check one face against the radial direction
    if mb.f:
        n = mb.face_normal(0)
        cen = mb.centroid(0)
        axis_pt = a + d * (cen - a).dot(d)
        if n.dot(cen - axis_pt) < 0:
            mb.flip()
    mb.rows = rows
    return mb


def cuff(fit, a, b, t0, t1, regions, segs, clear, slot, n_rows=2, lip=0.004, lip_slot=None, **kw):
    """A short band around a limb (t0..t1 along a→b) with lips at both edges: a cuff, a strap, a boot fold."""
    ts = [t0 + (t1 - t0) * i / (n_rows - 1) for i in range(n_rows)]
    mb = tube(fit, a, b, ts, regions, segs, clear, slot, **kw)
    if lip:
        rim(mb, lip, lip_slot if lip_slot is not None else slot)
    return mb


# ====================================================================== straps and lines on a surface
def project_tree(tree, p):
    loc, n, i, d = tree.find_nearest(Vector(p))
    return loc, n.normalized()


def polyline_on(fit, pts, off, regions=None, tree=None, samples=None):
    """Points resampled along a polyline, each moved to the nearest point of the body (or of `tree`, e.g. a garment's)
    and `off` out along that surface's normal. Returns [(point, normal)]."""
    pts = [Vector(p) for p in pts]
    if samples:
        L = [0.0]
        for i in range(1, len(pts)):
            L.append(L[-1] + (pts[i] - pts[i - 1]).length)
        out = []
        for s in range(samples):
            x = L[-1] * s / (samples - 1)
            j = max(0, min(len(pts) - 2, max(k for k in range(len(L) - 1) if L[k] <= x + 1e-9)))
            t = (x - L[j]) / max(1e-9, L[j + 1] - L[j])
            out.append(pts[j].lerp(pts[j + 1], min(1.0, t)))
        pts = out
    res = []
    for p in pts:
        if tree is not None:
            loc, n = project_tree(tree, p)
        else:
            _, loc, n, _ = fit.nearest(p, regions)
        res.append((loc + n * off, n))
    return res


def ribbon(fit, path, width, slot, regions, thick=0.0, side_slot=None, closed=False, bind=None, w=None, taper=None):
    """A strip of quads `width` wide along `path` ([(point, normal)] from polyline_on), across the path in the surface's
    tangent plane; with `thick` a raised strap (top + two side walls in side_slot)."""
    mb = MB()
    n = len(path)
    left, right = [], []
    bd = bind or ('regions', tuple(regions))
    for i, (p, nn) in enumerate(path):
        if closed:
            t = path[(i + 1) % n][0] - path[(i - 1) % n][0]
        else:
            t = path[min(n - 1, i + 1)][0] - path[max(0, i - 1)][0]
        s = nn.cross(t)
        s = s.normalized() if s.length > 1e-9 else Vector((1, 0, 0))
        wd = width * (taper(i / max(1, n - 1)) if taper else 1.0)
        base = p + nn * thick
        left.append(mb.add_v(base + s * wd * 0.5, bd, w))
        right.append(mb.add_v(base - s * wd * 0.5, bd, w))
    m = n if closed else n - 1
    for i in range(m):
        j = (i + 1) % n
        mb.add_f((left[i], right[i], right[j], left[j]), slot)
    if thick > 0:
        ls, rs = [], []
        for i, (p, nn) in enumerate(path):
            ls.append(mb.add_v(mb.v[left[i]] - nn * thick, bd, w))
            rs.append(mb.add_v(mb.v[right[i]] - nn * thick, bd, w))
        ss = side_slot if side_slot is not None else slot
        for i in range(m):
            j = (i + 1) % n
            mb.add_f((ls[i], left[i], left[j], ls[j]), ss)
            mb.add_f((right[i], rs[i], rs[j], right[j]), ss)
        if not closed:
            mb.add_f((left[0], ls[0], rs[0], right[0]), ss)
            mb.add_f((left[-1], right[-1], rs[-1], ls[-1]), ss)
    # orient: the top faces should face along the surface normal
    if mb.f and mb.face_normal(0).dot(path[0][1]) < 0:
        mb.flip()
    return mb


# ====================================================================== solids: buckles, studs, pouches
def box(center, u, v, n, su, sv, sn, slot, bind, w=None, bevel=0.0):
    """A box with half-sizes su, sv, sn along the axes u, v, n (n = out of the surface)."""
    c, u, v, n = Vector(center), Vector(u).normalized(), Vector(v).normalized(), Vector(n).normalized()
    mb = MB()
    idx = {}
    for i in (-1, 1):
        for j in (-1, 1):
            for k in (-1, 1):
                kk = k
                shrink = (1 - bevel) if k > 0 else 1.0
                idx[(i, j, kk)] = mb.add_v(c + u * su * i * shrink + v * sv * j * shrink + n * sn * kk, bind, w)
    quads = [((1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)), ((-1, -1, -1), (-1, -1, 1), (-1, 1, 1), (-1, 1, -1)),
             ((-1, 1, -1), (-1, 1, 1), (1, 1, 1), (1, 1, -1)), ((-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1)),
             ((-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)), ((-1, -1, -1), (-1, 1, -1), (1, 1, -1), (1, -1, -1))]
    for q in quads:
        mb.add_f([idx[x] for x in q], slot)
    # outward check (u × v should be n): flip if the frame is left-handed
    if u.cross(v).dot(n) < 0:
        mb.flip()
    return mb


def blob(center, rx, ry, rz, slot, bind, w=None, segs=8, rings=4, axes=None, hemi=False):
    """A low-poly ellipsoid (or a dome with hemi=True, its flat side toward -axes[2])."""
    c = Vector(center)
    ax = axes or (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
    ex, ey, ez = (Vector(a).normalized() for a in ax)
    mb = MB()
    lat0 = 0.0 if hemi else -math.pi / 2
    top = mb.add_v(c + ez * rz, bind, w)
    rows = []
    for r in range(1, rings + (0 if hemi else 0)):
        phi = math.pi / 2 - (math.pi / 2 - lat0) * r / rings
        row = []
        for k in range(segs):
            th = TAU * k / segs
            row.append(mb.add_v(c + ex * (rx * math.cos(phi) * math.cos(th)) + ey * (ry * math.cos(phi) * math.sin(th)) + ez * (rz * math.sin(phi)), bind, w))
        rows.append(row)
    if hemi:
        row = []
        for k in range(segs):
            th = TAU * k / segs
            row.append(mb.add_v(c + ex * (rx * math.cos(th)) + ey * (ry * math.sin(th)), bind, w))
        rows.append(row)
        bottom = mb.add_v(c, bind, w)
    else:
        bottom = mb.add_v(c - ez * rz, bind, w)
    for k in range(segs):
        mb.add_f((top, rows[0][k], rows[0][(k + 1) % segs]), slot)
    for i in range(len(rows) - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            mb.add_f((rows[i][k], rows[i + 1][k], rows[i + 1][k2], rows[i][k2]), slot)
    for k in range(segs):
        mb.add_f((rows[-1][k], bottom, rows[-1][(k + 1) % segs]), slot)
    if ex.cross(ey).dot(ez) < 0:
        mb.flip()
    return mb


def surface_frame(fit, p, down=Vector((0, 0, -1)), regions=None, off=0.0, tree=None):
    """(point on the surface + off, u across, v down the surface, n out) at the surface point nearest p."""
    if tree is not None:
        loc, n = project_tree(tree, p)
    else:
        _, loc, n, _ = fit.nearest(p, regions)
    v = Vector(down) - n * Vector(down).dot(n)
    if v.length < 1e-6:
        v = Vector((0, 0, -1)) - n * n.z
    v.normalize()
    u = v.cross(n).normalized()
    return loc + n * off, u, v, n


def tiles(fit, centres, size, slot, regions, off, tilt=0.006, down=Vector((0, 0, -1)), tree=None, shape='scale', w=None,
          edge_slot=None):
    """Scales / shingles: a small rounded tile at each surface point, its top edge on the surface + off, its bottom edge
    tilted out by `tilt`, so rows overlap like a roof. size = (width, height)."""
    mb = MB()
    sw, sh = size
    if shape == 'scale':
        outline = [(-0.5, 0.0), (0.5, 0.0), (0.5, 0.58), (0.22, 0.97), (-0.22, 0.97), (-0.5, 0.58)]
    else:  # a squared tab
        outline = [(-0.5, 0.0), (0.5, 0.0), (0.5, 0.85), (0.35, 1.0), (-0.35, 1.0), (-0.5, 0.85)]
    for cp in centres:
        p, u, v, n = surface_frame(fit, cp, down, regions, off, tree)
        bd = ('regions', tuple(regions))
        ring = []
        for (x, y) in outline:
            q = p + u * (x * sw) + v * (y * sh) + n * (tilt * y)
            ring.append(mb.add_v(q, bd, w))
        c = mb.add_v(p + v * (0.5 * sh) + n * (tilt * 0.62), bd, w)
        m = len(ring)
        for k in range(m):
            mb.add_f((c, ring[(k + 1) % m], ring[k]), slot)
        if mb.face_normal(len(mb.f) - 1).dot(n) < 0:
            for k in range(m):
                mb.f[-1 - k] = tuple(reversed(mb.f[-1 - k]))
        if edge_slot is not None:
            # a raised lip along the bottom curve (y > 0.5 of the outline)
            pass
    return mb


# ====================================================================== cloth hung from a line: drape()
def drape(fit, top, lengths, step, clear, regions_avoid=None, push_out=None, flare=None):
    """Cloth hung from an attachment line: `top` = points on the attachment (broad space, outside the body); each falls
    straight down in steps of `step` metres for lengths[i] metres, kept at least `clear` off the body (any region, or
    `regions_avoid`), with an optional outward `flare(i, s)` (s = fraction down). Returns a grid [column][row] of points
    (rows padded so every column has the same count — shorter columns are compressed)."""
    cols = []
    nrows = max(2, int(round(max(lengths) / step)) + 1)
    for i, p0 in enumerate(top):
        p = Vector(p0)
        L = lengths[i]
        col = [p.copy()]
        s_prev = 0.0
        for r in range(1, nrows):
            s = r / (nrows - 1)
            target_z = p0.z - L * s
            q = Vector((col[-1].x, col[-1].y, target_z))
            if push_out is not None:
                q = q + push_out * (L * (s - s_prev))
            if flare is not None:
                q = q + (flare(i, s) - flare(i, s_prev))      # the flare is a total by s, not a step
            s_prev = s
            for _ in range(3):
                sd, loc, n, _ = fit.signed(q, regions_avoid)
                if sd < clear:
                    q = loc + n * clear
            col.append(q)
        cols.append(col)
    return cols


def grid_mb(grid, slot, bind_fn, w_fn=None, closed=False):
    """A surface from a grid [column][row] of points: quads, bound per vertex by bind_fn(col, row, point)."""
    mb = MB()
    idx = []
    for i, col in enumerate(grid):
        ids = []
        for r, p in enumerate(col):
            ids.append(mb.add_v(p, bind_fn(i, r, p), w_fn(i, r, p) if w_fn else None))
        idx.append(ids)
    nc = len(grid)
    for i in range(nc if closed else nc - 1):
        j = (i + 1) % nc
        for r in range(len(grid[i]) - 1):
            mb.add_f((idx[i][r], idx[i][r + 1], idx[j][r + 1], idx[j][r]), slot(i, r) if callable(slot) else slot)
    mb.grid = idx
    return mb


# ====================================================================== the head: hoods and masks
class HeadProfile:
    """The head (and neck) as seen from a centre C: max distance of the body's head/neck vertices per direction cell
    (theta from +Z, phi around Z from -Y = front, toward +X = the character's left), dilated and smoothed so ears and
    the nose become soft bulges."""

    def __init__(self, fit, centre, regions=('head', 'neck'), n_theta=36, n_phi=48, dilate=2, smooth=3, skip=None):
        self.C = Vector(centre)
        self.nt, self.np = n_theta, n_phi
        R = [[0.0] * n_phi for _ in range(n_theta)]
        for i in fit.region_verts(regions):
            p = fit.P[i]
            if skip and skip(p):
                continue
            q = p - self.C
            r = q.length
            if r < 1e-6:
                continue
            th = math.acos(max(-1.0, min(1.0, q.z / r)))
            ph = math.atan2(q.x, -q.y) % TAU
            ti = min(n_theta - 1, int(th / math.pi * n_theta))
            pi = int(ph / TAU * n_phi) % n_phi
            for dt in range(-dilate, dilate + 1):
                for dp in range(-dilate, dilate + 1):
                    a = ti + dt
                    if 0 <= a < n_theta:
                        b = (pi + dp) % n_phi
                        if r > R[a][b]:
                            R[a][b] = r
        # fill empty cells from the row (or the nearest filled row)
        for a in range(n_theta):
            row = R[a]
            if not any(row):
                continue
            known = [k for k in range(n_phi) if row[k] > 0]
            for k in range(n_phi):
                if row[k] == 0:
                    lo = max((j for j in known if j < k), default=known[-1] - n_phi)
                    hi = min((j for j in known if j > k), default=known[0] + n_phi)
                    t = (k - lo) / (hi - lo)
                    row[k] = row[lo % n_phi] * (1 - t) + row[hi % n_phi] * t
        for a in range(n_theta):
            if not any(R[a]):
                src = min((b for b in range(n_theta) if any(R[b])), key=lambda b: abs(b - a))
                R[a] = list(R[src])
        for _ in range(smooth):
            S = [[0.0] * n_phi for _ in range(n_theta)]
            for a in range(n_theta):
                for b in range(n_phi):
                    acc, wsum = 0.0, 0.0
                    for da, db, ww in ((0, 0, 4), (1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1)):
                        aa = min(n_theta - 1, max(0, a + da))
                        acc += R[aa][(b + db) % n_phi] * ww
                        wsum += ww
                    S[a][b] = max(R[a][b] * 0.0, acc / wsum)
            R = [[max(S[a][b], R[a][b] * 0.92) for b in range(n_phi)] for a in range(n_theta)]
        self.R = R

    def r(self, theta, phi):
        """Bilinear sample."""
        x = theta / math.pi * self.nt - 0.5
        y = (phi % TAU) / TAU * self.np - 0.5
        a0 = int(math.floor(x))
        b0 = int(math.floor(y))
        fa, fb = x - a0, y - b0
        out = 0.0
        for da, wa in ((0, 1 - fa), (1, fa)):
            a = min(self.nt - 1, max(0, a0 + da))
            for db, wb in ((0, 1 - fb), (1, fb)):
                out += self.R[a][(b0 + db) % self.np] * wa * wb
        return out


def sph(theta, phi):
    """Unit direction: theta from +Z, phi from -Y (front) toward +X."""
    st = math.sin(theta)
    return Vector((st * math.sin(phi), -st * math.cos(phi), math.cos(theta)))


def ring_section(fit, z, regions, segs, centre_xy=None, slab=0.012, window=1.4, phi0=0.0):
    """A horizontal section at height z: radii per sector (phi from -Y toward +X, like sph) around centre_xy (or the
    slab's centroid)."""
    vs = [fit.P[i] for i in fit.region_verts(regions) if abs(fit.P[i].z - z) <= slab]
    if not vs:
        return None, None
    if centre_xy is None:
        m = sum(vs, Vector()) / len(vs)
        cx, cy = m.x, m.y
    else:
        cx, cy = centre_xy
    R = [0.0] * segs
    for p in vs:
        x, y = p.x - cx, p.y - cy
        r = math.hypot(x, y)
        a = ((math.atan2(x, -y) - phi0) % TAU) / TAU * segs
        for kk in range(int(math.floor(a - window)), int(math.ceil(a + window)) + 1):
            if abs(kk - a) <= window:
                j = kk % segs
                if r > R[j]:
                    R[j] = r
    known = [k for k in range(segs) if R[k] > 0]
    for k in range(segs):
        if R[k] == 0 and known:
            lo = max((j for j in known if j < k), default=known[-1] - segs)
            hi = min((j for j in known if j > k), default=known[0] + segs)
            t = (k - lo) / (hi - lo)
            R[k] = R[lo % segs] * (1 - t) + R[hi % segs] * t
    return (cx, cy), R


# ====================================================================== binding and realizing
def triangulate_safe(mb):
    """Every quad split along the diagonal whose two triangles face the same way (and the shorter one when both do);
    n-gons fanned from their best-shaped corner. A twisted quad left to the renderer's choice of diagonal turns one
    half backwards: a hole when back faces are culled (found on the hood, the mantle and the knee patches, round 5)."""
    faces, slots = [], []
    for f, sl in zip(mb.f, mb.s):
        if len(f) == 3:
            faces.append(f)
            slots.append(sl)
            continue
        if len(f) == 4:
            a, b, c, d = (mb.v[i] for i in f)
            opts = []
            for tri1, tri2, diag in (((0, 1, 2), (0, 2, 3), (c - a).length), ((0, 1, 3), (1, 2, 3), (d - b).length)):
                n1 = (mb.v[f[tri1[1]]] - mb.v[f[tri1[0]]]).cross(mb.v[f[tri1[2]]] - mb.v[f[tri1[0]]])
                n2 = (mb.v[f[tri2[1]]] - mb.v[f[tri2[0]]]).cross(mb.v[f[tri2[2]]] - mb.v[f[tri2[0]]])
                agree = (n1.normalized().dot(n2.normalized()) if n1.length > 1e-14 and n2.length > 1e-14 else -1.0)
                opts.append((agree < 0.0, diag, tri1, tri2))
            opts.sort(key=lambda o: (o[0], o[1]))
            _, _, t1, t2 = opts[0]
            faces += [tuple(f[i] for i in t1), tuple(f[i] for i in t2)]
            slots += [sl, sl]
            continue
        # n-gon: fan from each corner, keep the fan with the fewest backward triangles
        n = len(f)
        best = None
        for s0 in range(n):
            tris = [(f[s0], f[(s0 + k) % n], f[(s0 + k + 1) % n]) for k in range(1, n - 1)]
            ns = [(mb.v[t[1]] - mb.v[t[0]]).cross(mb.v[t[2]] - mb.v[t[0]]) for t in tris]
            tot = sum(ns, Vector())
            back = sum(1 for x in ns if x.dot(tot) < 0)
            if best is None or back < best[0]:
                best = (back, tris)
        faces += best[1]
        slots += [sl] * len(best[1])
    mb.f, mb.s = faces, slots
    return mb


def to_piece(fit, mb, name='piece'):
    """The MB as a gear_lib Piece: every vertex a 'bind' source on the broad body (the triangle under the shell vertex
    it came from for 'hint' bindings, else the nearest triangle of the given regions). Quads are split safely first."""
    triangulate_safe(mb)
    p = G.Piece(name)
    p._smap = fit.smap
    p._wover = {}
    for i, (co, bd) in enumerate(zip(mb.v, mb.bind)):
        if bd[0] == 'hint':
            ti = fit.tri_near_vertex(co, bd[1])
            a_, b_, c_ = (fit.P[k] for k in fit.smap.tris[ti])
            if (closest_point_on_tri(Vector(co), a_, b_, c_) - Vector(co)).length > 0.03:
                ti = fit.nearest(co, (fit.b.regions[bd[1]],))[0]     # a hint that drifted away: its region's nearest
        elif bd[0] == 'regions':
            ti = fit.nearest(co, bd[1])[0]
        elif bd[0] == 'tri':
            ti = bd[1]
        else:
            raise ValueError(bd)
        p.src.append(('bind', ti, Vector(co), 0.0))
        if mb.w[i]:
            p._wover[i] = mb.w[i]
    for f, s in zip(mb.f, mb.s):
        p.add_face(f, s)
    return p


def realize_piece(fit, piece, frame, name, props):
    """gear_lib.realize, then the weight overrides (MB.w) put on the vertices made from those sources."""
    ob = G.realize(piece, fit.bodies, frame, name, props)
    if getattr(piece, '_wover', None):
        body = fit.bodies[frame]
        pos = [G._position(piece, s, body, 'Basis', piece._smap) for s in piece.src]
        kd = KDTree(len(pos))
        for i, q in enumerate(pos):
            kd.insert(q, i)
        kd.balance()
        groups = list(ob.vertex_groups)
        for v in ob.data.vertices:
            _, si, _ = kd.find(v.co)
            ws = piece._wover.get(si)
            if not ws:
                continue
            for vg in groups:
                vg.remove([v.index])
            s = sum(w for _, w in ws) or 1.0
            for bone, wt in ws:
                vg = ob.vertex_groups.get(bone) or ob.vertex_groups.new(name=bone)
                vg.add([v.index], wt / s, 'REPLACE')
            groups = list(ob.vertex_groups)
    return ob


# ====================================================================== coverage (what a piece may list in `hides`)
def _hemisphere(n_dirs=24, max_angle=55.0):
    """Unit directions over a cap round +Z (up to max_angle from it), Fibonacci-spread, the pole included."""
    out = [Vector((0, 0, 1))]
    ga = math.pi * (3 - math.sqrt(5))
    zmin = math.cos(math.radians(max_angle))
    for i in range(n_dirs - 1):
        z = 1 - (i + 0.5) / (n_dirs - 1) * (1 - zmin)
        r = math.sqrt(max(0.0, 1 - z * z))
        out.append(Vector((r * math.cos(ga * i), r * math.sin(ga * i), z)))
    return out


_HEMI = _hemisphere()


def covered_regions(fit, mb, regions, tol=0.0, min_view_z=-0.15, max_view_z=0.94, reach=1.0, report=True):
    """Regions the piece hides from every game view: from each body vertex of the region, a fan of rays within 55° of
    its normal (no grazing looks into a hem gap) and not from below (z < min_view_z: game cameras sit level or above)
    must all be stopped by the piece or by the body outside that region (the chin over the throat, the other thigh).
    A region the piece leaves visible anywhere must not go in `hides`. A chord dipping under the skin still covers."""
    tree = mb.tree()
    out = []
    for r in regions:
        rid = REG[r] if isinstance(r, str) else r
        others = custom_tree(fit, '_not_%d' % rid, lambda reg, c, rid=rid: reg != rid) if ('_not_%d' % rid) not in fit._trees else '_not_%d' % rid
        btree = fit._trees[others][0]
        miss = 0
        bad = []
        vs = fit.region_verts([r])
        for i in vs:
            p, n = fit.P[i], fit.N[i]
            o = p + n * 0.0008
            dip = tree.ray_cast(p + n * 0.0005, -n, 0.012)
            if dip[0] is not None:
                o = dip[0] - n * 0.0008                  # the piece dips under the skin here: look out from under it
            t1 = n.orthogonal().normalized()
            t2 = n.cross(t1)
            seen = False
            for d in _HEMI:
                w = (t1 * d.x + t2 * d.y + n * d.z).normalized()
                if w.z < min_view_z or w.z > max_view_z:     # no camera looks up from below or straight down a boot
                    continue
                if tree.ray_cast(o, w, reach)[0] is not None:
                    continue
                if btree.ray_cast(o, w, reach)[0] is not None:
                    continue
                seen = True
                break
            if seen:
                miss += 1
                bad.append(p)
        if miss <= tol * len(vs):
            out.append(r)
        elif report:
            zs = sorted(round(q.z, 2) for q in bad)
            log('  coverage: %s visible at %d of %d vertices (z %s..%s)' % (r, miss, len(vs), zs[0], zs[-1]))
    return out


# ====================================================================== review: palettes, bodies, renders, poses
GREY_TRIM = '#8d8d8d'      # F (Crude) grade colour
RED_TRIM = '#c8323a'       # S (Legendary) grade colour


def tier_palette(class_colors, tier, glow):
    pal = dict(class_colors)
    pal['trim'] = GREY_TRIM if tier == 'F' else RED_TRIM
    pal['glow'] = glow
    return pal


def clean_stage():
    """The body blend carries its own review stage: remove it so a new Stage does not double the lights."""
    for ob in list(bpy.data.objects):
        if ob.name.startswith('GV_') or ob.name.startswith('Sticks_'):
            bpy.data.objects.remove(ob)
    for name in ('GV_Stage',):
        col = bpy.data.collections.get(name)
        if col:
            bpy.data.collections.remove(col)


def body_view(frame, hides, name):
    """A render copy of Body_<frame> with the body triangles of `hides` dropped (by majority region, as the client
    drops them), skinned to the same rig, carrying the same shape keys."""
    src = bpy.data.objects['Body_' + frame]
    ob = src.copy()
    ob.data = src.data.copy()
    ob.name = name
    bpy.data.collections['Gear'].objects.link(ob) if 'Gear' in bpy.data.collections else bpy.context.scene.collection.objects.link(ob)
    if hides:
        ids = {REG[h] for h in hides}
        codes = toon.vertex_codes(ob.data)
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bm.faces.ensure_lookup_table()
        kill = []
        for f in bm.faces:
            rs = [codes[v.index][1] for v in f.verts]
            if max(set(rs), key=rs.count) in ids:
                kill.append(f)
        bmesh.ops.delete(bm, geom=kill, context='FACES')
        bm.to_mesh(ob.data)
        bm.free()
    for m in list(ob.modifiers):
        if m.type != 'ARMATURE':
            ob.modifiers.remove(m)
    return ob


def set_material(obs, mat):
    for ob in obs:
        if ob.data.materials:
            ob.data.materials[0] = mat
        else:
            ob.data.materials.append(mat)


def bone_groups():
    return {
        'upperLeg': ['LeftUpperLeg', 'RightUpperLeg'], 'lowerLeg': ['LeftLowerLeg', 'RightLowerLeg'],
        'shoulder': ['LeftShoulder', 'RightShoulder'], 'chest': ['Chest'], 'upperChest': ['UpperChest'],
        'upperArm': ['LeftUpperArm', 'RightUpperArm'], 'lowerArm': ['LeftLowerArm', 'RightLowerArm'],
        'hand': ['LeftHand', 'RightHand'], 'head': ['Head'], 'neck': ['Neck'], 'foot': ['LeftFoot', 'RightFoot'],
        'toes': ['LeftToes', 'RightToes'],
        'fingers': [s + f + p for s in ('Left', 'Right') for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Little')
                    for p in ('Proximal', 'Intermediate', 'Distal')],
    }


def species_body(species):
    return read_json(os.path.join(CONTENT, 'species', species + '.json'))['body']


def apply_species(rig, objs, species, value=1.0):
    """Species key 1 on the body and gear, the species' bone scales on the pose bones (root = the rig's scale)."""
    sb = species_body(species)
    for ob in objs:
        keys = ob.data.shape_keys
        if keys:
            for kb in keys.key_blocks:
                if kb.name.startswith('spc_'):
                    kb.value = value if kb.name in sb['shapeKeys'] else 0.0
    groups = bone_groups()
    for g, s in sb.get('boneScales', {}).items():
        if g == 'root':
            rig.scale = (s, s, s) if value else (1, 1, 1)
            continue
        for bn in groups.get(g, []):
            pb = rig.pose.bones.get(bn)
            if pb:
                pb.scale = (s, s, s) if value else (1, 1, 1)
    return sb


def clear_species(rig, objs):
    for ob in objs:
        keys = ob.data.shape_keys
        if keys:
            for kb in keys.key_blocks:
                if kb.name.startswith('spc_'):
                    kb.value = 0.0
    rig.scale = (1, 1, 1)
    for pb in rig.pose.bones:
        pb.scale = (1, 1, 1)


def test_poses():
    """The poses every set is checked in. Measured on this rig (round 2): on the left upper arm +Z raises the arm
    (abduction) and -40 drives the hand into the hip, +X flexes forward; on the left leg +Z swings the foot outward;
    knees bend with -X; the right side mirrored (rig.mirrored negates Y and Z). Idle with the arms down, a Run stride,
    an Attack_Heavy-like overhead swing, a deep lunge, knees bent (crouch), both arms straight up (reach)."""
    from rig import mirrored
    fist = {}
    for s in ('Left', 'Right'):
        for f in ('Index', 'Middle', 'Ring', 'Little'):
            for ph, a in (('Proximal', 72), ('Intermediate', 95), ('Distal', 55)):
                fist[s + f + ph] = (a, 0, 0)
        for ph, a in (('Proximal', 25), ('Intermediate', 40), ('Distal', 35)):
            fist[s + 'Thumb' + ph] = (a, 0, 0)
    poses = {}
    poses['idle'] = mirrored({'LeftUpperArm': (4, 0, -21), 'LeftLowerArm': (12, 0, 0), 'Spine': (2, 0, 0), 'Head': (-3, 0, 0)})
    p = {'Spine': (10, 0, 0), 'Chest': (4, -12, 0),
         'LeftUpperLeg': (50, 0, 0), 'LeftLowerLeg': (-45, 0, 0), 'LeftFoot': (10, 0, 0),
         'RightUpperLeg': (-28, 0, 0), 'RightLowerLeg': (-95, 0, 0), 'RightFoot': (25, 0, 0),
         'LeftUpperArm': (-40, 0, -20), 'LeftLowerArm': (60, 0, 0), 'RightUpperArm': (50, 0, 20), 'RightLowerArm': (85, 0, 0),
         'Hips.loc': (0, -0.04, 0)}
    p.update(fist)
    poses['run'] = p
    p = mirrored({'Spine': (-10, 0, 0), 'Chest': (-8, 0, 0), 'LeftUpperArm': (150, 20, 15), 'LeftLowerArm': (55, 0, 0),
                  'LeftHand': (20, 0, 0), 'Head': (8, 0, 0)})
    p.update({'LeftUpperLeg': (20, 0, 6), 'LeftLowerLeg': (-25, 0, 0), 'RightUpperLeg': (-12, 0, -6), 'RightLowerLeg': (-8, 0, 0)})
    p.update(fist)
    poses['heavy'] = p
    p = {'Spine': (12, 0, 0), 'Chest': (6, 0, 0), 'Head': (-10, 0, 0),
         'LeftUpperLeg': (85, 0, 4), 'LeftLowerLeg': (-95, 0, 0), 'LeftFoot': (12, 0, 0),
         'RightUpperLeg': (-38, 0, -4), 'RightLowerLeg': (-35, 0, 0), 'RightFoot': (30, 0, 0),
         'LeftUpperArm': (40, 0, -10), 'LeftLowerArm': (50, 0, 0), 'RightUpperArm': (-30, 0, 10), 'RightLowerArm': (30, 0, 0),
         'Hips.loc': (0, -0.24, 0.0)}
    poses['lunge'] = p
    p = mirrored({'LeftUpperLeg': (78, 0, 10), 'LeftLowerLeg': (-118, 0, 0), 'LeftFoot': (40, 0, 0),
                  'Spine': (28, 0, 0), 'Chest': (8, 0, 0), 'Head': (-25, 0, 0),
                  'LeftUpperArm': (55, 0, -8), 'LeftLowerArm': (70, 0, 0)})
    p['Hips.loc'] = (0, -0.33, 0.06)
    poses['crouch'] = p
    poses['reach'] = mirrored({'LeftUpperArm': (5, 0, 100), 'LeftLowerArm': (10, 0, 0)})
    return poses


def pose_rigs(pose):
    from rig import key_pose
    for f in G.FRAMES:
        rig = bpy.data.objects['Rig_' + f]
        key_pose(rig, 1, pose)
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()


def unpose_rigs():
    from rig import rest_pose
    for f in G.FRAMES:
        rig = bpy.data.objects['Rig_' + f]
        rig.animation_data_clear()
        rest_pose(rig)
        rig.scale = (1, 1, 1)
    for act in list(bpy.data.actions):
        if act.users == 0 or not act.use_fake_user:
            bpy.data.actions.remove(act)
    bpy.context.view_layer.update()


def evaluated_world(ob):
    """World positions and faces of the posed mesh: the Armature only (any outline Solidify — the species blend saves
    one on Body_* — is switched off for the evaluation and restored)."""
    off = [m for m in ob.modifiers if m.type != 'ARMATURE' and m.show_viewport]
    for m in off:
        m.show_viewport = False
    if off:
        bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    mw = ob.matrix_world
    vs = [mw @ v.co for v in me.vertices]
    fs = [tuple(p.vertices) for p in me.polygons]
    ev.to_mesh_clear()
    for m in off:
        m.show_viewport = True
    return vs, fs


def poke_count(body_src, gear_obs, hidden=(), depth=0.0015, reach=0.04):
    """Gear vertices under the visible skin (more than `depth` inside it): where the skin shows through the gear. Measured
    against the whole posed body; a vertex whose nearest skin is in a hidden region (dropped by the client) is skipped."""
    bv, bf = evaluated_world(body_src)
    codes = toon.vertex_codes(body_src.data)
    hid = {REG[h] for h in hidden}
    face_region = []
    for f in bf:
        rs = [codes[i][1] for i in f]
        face_region.append(max(set(rs), key=rs.count))
    tree = BVHTree.FromPolygons(bv, bf)
    out = {}
    for ob in gear_obs:
        gv, _ = evaluated_world(ob)
        n = 0
        for p in gv:
            loc, nn, i, d = tree.find_nearest(p)
            if loc is None or d > reach or face_region[i] in hid:
                continue
            if (p - loc).dot(nn) < -depth:
                n += 1
        out[ob.name] = n
    return out


def card_shot(st, h, name, side='front'):
    k = h / 1.8
    if side == 'front':
        st.camera((-1.95 * k, -2.45 * k, 1.45 * k), (0.04 * k, 0, 0.97 * k), lens=55)
    elif side == 'left':   # the character's left side, from the front-left
        st.camera((1.95 * k, -2.45 * k, 1.45 * k), (-0.04 * k, 0, 0.97 * k), lens=55)
    else:                  # from behind, over the left shoulder
        st.camera((1.9 * k, 2.5 * k, 1.5 * k), (0.0, 0, 0.97 * k), lens=55)
    path = st.shot(name)
    return path


def downscale(path, size=200, out=None):
    img = bpy.data.images.load(path)
    img.scale(size, size)
    out = out or path.replace('.png', '_%d.png' % size)
    img.filepath_raw = out
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)
    return out


# ====================================================================== the review set (one call per class)
HEIGHT = {'broad': 1.794, 'slight': 1.613}
SPECIES_PARTS = {'elf': ['spc_elf_ears'], 'halfling': ['spc_halfling_feet'], 'dwarf': ['spc_dwarf_beard'],
                 'orc': ['spc_orc_tusks', 'spc_orc_ears'], 'draconid': ['spc_draconid_horns', 'spc_draconid_tail']}


def hull_off_linings(obs):
    """The review outline's hull is pushed out along each vertex normal; on a lining (a surface facing the body) it
    would push toward the outer cloth and show through it near the rims. Vertices whose normal faces the body get
    hull thickness 0 (vertex group gv_hull)."""
    trees = {}
    for o in obs:
        m = o.modifiers.get('Outline')
        if m is None or o.parent is None:
            continue
        frame = o.parent.name.replace('Rig_', '')
        if frame not in trees:
            bo = bpy.data.objects.get('Body_' + frame)
            if bo is None:
                continue
            trees[frame] = BVHTree.FromPolygons([v.co for v in bo.data.vertices], [tuple(p.vertices) for p in bo.data.polygons])
        tree = trees[frame]
        vg = o.vertex_groups.get('gv_hull') or o.vertex_groups.new(name='gv_hull')
        on, off = [], []
        for v in o.data.vertices:
            loc, _, _, _ = tree.find_nearest(v.co)
            (off if loc is not None and (loc - v.co).dot(v.normal) > 0 else on).append(v.index)
        if on:
            vg.add(on, 1.0, 'REPLACE')
        if off:
            vg.add(off, 0.0, 'REPLACE')
        m.vertex_group = 'gv_hull'
        m.thickness_vertex_group = 0.0


def _outline_off_in_viewport(obs):
    """Outlines render (show_render) but stay out of the evaluated meshes the poke count reads (show_viewport).
    The hull goes outside the surface without moving it (thickness +, offset +1): toon.apply_look's own settings
    (thickness -, offset +1) move the visible surface 4 mm in along its normals, which swaps a cloth lining closer
    than 8 mm with its outer face and widens every gear-to-skin gap by 4 mm in the renders (found round 1)."""
    for o in obs:
        m = o.modifiers.get('Outline')
        if m:
            m.thickness = abs(m.thickness)
            m.offset = 1.0
            m.show_viewport = False


def piece_shot(st, obs, name, view=(-1.0, -1.25, 0.55), pad=1.25):
    """One piece (or a few) framed by its bounding box, from the front-right."""
    vs = []
    for o in obs:
        wv, _ = evaluated_world(o)
        vs += wv
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    c = (lo + hi) / 2
    size = max((hi - lo).length, 0.12)
    d = Vector(view).normalized()
    fov = 2 * math.atan(36 / (2 * 55))
    dist = size * pad / (2 * math.tan(fov / 2))
    st.camera(c + d * dist, c, lens=55)
    return st.shot(name)


def show(obs, on=True):
    for o in obs:
        o.hide_render = not on


def review_class(class_id, sets, hides, out, palette, glow, quick=False, poses=None, species_list=('elf', 'halfling'),
                 log_lines=None, slot_order=None):
    """Every review render of one class. sets = {tier: {frame: [objects]}}, hides = {object name: [regions]}.
    Writes PNGs into `out` and returns lines for the log (tri counts are the caller's)."""
    from render import Stage, grid_sheet
    lines = log_lines if log_lines is not None else []
    clean_stage()
    for o in bpy.data.objects:
        if o.type == 'MESH':
            o.hide_render = True
    st = Stage(out, size=640 if quick else 1024, quick=quick)
    mats = {t: toon.palette_material(tier_palette(palette, t, glow), name='GV_Pal_%s_%s' % (class_id, t)) for t in sets}
    views = {}
    for t, by_frame in sets.items():
        for f, obs in by_frame.items():
            hid = sorted(set().union(*[set(hides[o.name]) for o in obs]))
            bv = body_view(f, hid, 'View_%s_%s_%s' % (class_id, t, f))
            for o in [bv] + obs:
                toon.apply_look(o, outline=0.004)
            set_material([bv] + obs, mats[t])
            _outline_off_in_viewport([bv] + obs)
            hull_off_linings(obs)
            for o in obs:
                if o.get('slot') == 'helmet':
                    o.visible_shadow = False      # Ascend's lesson: the hood's shadow darkens the whole face a step
            views[(t, f)] = (bv, hid)
            show([bv], False)
    # ---- the sets: card + 200-px read, left and back views, ortho front/side/back
    reads = []
    for t, by_frame in sets.items():
        for f, obs in by_frame.items():
            bv, hid = views[(t, f)]
            show([bv] + obs)
            h = HEIGHT[f]
            p = card_shot(st, h, 'set_%s_%s.png' % (t, f))
            reads.append(downscale(p, 200))
            card_shot(st, h, 'set_%s_%s_left.png' % (t, f), side='left')
            card_shot(st, h, 'set_%s_%s_back.png' % (t, f), side='back')
            st.ortho_sheet(h, name='ortho_%s_%s.png' % (t, f))
            show([bv] + obs, False)
    grid_sheet(reads, os.path.join(out, 'read200_all.png'), cols=len(reads))
    grid_sheet([os.path.join(out, 'set_%s_%s%s.png' % (t, f, v)) for t in sets for f in sets[t] for v in ('', '_left', '_back')],
               os.path.join(out, 'sets_sheet.png'), cols=3, cell=512)
    # ---- the gear sheet: every piece alone (broad frame), tiers in rows
    cells = []
    for t, by_frame in sets.items():
        def order(o):
            return slot_order.index(o['slot']) if slot_order and o['slot'] in slot_order else 99
        for o in sorted(by_frame['broad'], key=order):
            show([o])
            cells.append(piece_shot(st, [o], '_piece_%s.png' % o.name.replace('.', '_')))
            show([o], False)
    ncol = max(len(v['broad']) for v in sets.values())
    grid_sheet(cells, os.path.join(out, 'gear_sheet.png'), cols=ncol, cell=360)
    for c in cells:
        os.remove(c)
    # ---- test poses
    poses = poses or test_poses()
    lines.append('')
    lines.append('Poke-through count (gear vertices more than 1.5 mm under visible skin; hidden regions skipped):')
    lines.append('')
    lines.append('| pose | ' + ' | '.join('%s %s' % (t, f) for t in sets for f in sets[t]) + ' |')
    lines.append('|---|' + '---:|' * sum(len(v) for v in sets.values()))
    pose_cells = []
    for pname, pose in poses.items():
        pose_rigs(pose)
        row = []
        for t, by_frame in sets.items():
            for f, obs in by_frame.items():
                bv, hid = views[(t, f)]
                show([bv] + obs)
                pose_cells.append(card_shot(st, HEIGHT[f], 'pose_%s_%s_%s.png' % (pname, t, f)))
                if pname in ('run', 'heavy', 'reach'):
                    card_shot(st, HEIGHT[f], 'pose_%s_%s_%s_back.png' % (pname, t, f), side='back')
                show([bv] + obs, False)
                pk = poke_count(bpy.data.objects['Body_' + f], obs, hidden=hid)
                worst = [kv for kv in sorted(pk.items(), key=lambda kv: -kv[1]) if kv[1]]
                detail = ', '.join('%s %d' % (k.split('_')[2], v) for k, v in worst)
                row.append('%d%s' % (sum(pk.values()), (' (%s)' % detail) if detail else ''))
        lines.append('| %s | %s |' % (pname, ' | '.join(row)))
        unpose_rigs()
    ncols = sum(len(v) for v in sets.values())
    grid_sheet(pose_cells, os.path.join(out, 'poses_sheet.png'), cols=ncols, cell=420)
    # ---- species (only once the body carries the species keys)
    keys = bpy.data.objects['Body_broad'].data.shape_keys
    has_keys = bool(keys) and any(kb.name.startswith('spc_') for kb in keys.key_blocks)
    if has_keys and species_list:
        sp_cells = []
        for sp, f in zip(species_list, ('slight', 'broad')):
            for t, by_frame in sets.items():
                obs = by_frame[f]
                bv, hid = views[(t, f)]
                rig = bpy.data.objects['Rig_' + f]
                # the species' own parts that stay visible with this set (a part replacing a region the set hides —
                # Halfling feet under boots — is assumed dropped with it; hair is assumed hidden under a helmet)
                parts = []
                for pn in SPECIES_PARTS.get(sp, ()):
                    po = bpy.data.objects.get('%s.%s' % (pn, f))
                    if po is None or set(po.get('hides', [])) & set(hid):
                        continue
                    toon.apply_look(po, outline=0.004)
                    set_material([po], mats[t])
                    _outline_off_in_viewport([po])
                    parts.append(po)
                sb = apply_species(rig, [bv] + obs + parts, sp)
                bpy.context.view_layer.update()
                show([bv] + obs + parts)
                h = HEIGHT[f] * sb.get('boneScales', {}).get('root', 1.0) * (1.08 if sp == 'elf' else 1.0)
                sp_cells.append(card_shot(st, h, 'species_%s_%s_%s.png' % (sp, t, f)))
                card_shot(st, h, 'species_%s_%s_%s_back.png' % (sp, t, f), side='back')
                k = h / 1.8
                st.camera((-0.75 * k, -0.95 * k, 1.75 * k), (0.0, 0, 1.58 * k), lens=70)
                st.shot('species_%s_%s_%s_head.png' % (sp, t, f))
                show([bv] + obs + parts, False)
                clear_species(rig, [bv] + obs + parts)
        grid_sheet(sp_cells, os.path.join(out, 'species_sheet.png'), cols=len(sets), cell=512)
        lines.append('')
        lines.append('Species renders: %s (key 1.0 on body and gear, bone scales on the pose bones).' % ', '.join(species_list))
    else:
        lines.append('')
        lines.append('Species renders skipped: the body carries no species keys yet (hero_species.blend not built).')
    # ---- remove the render-only objects
    for (t, f), (bv, hid) in views.items():
        bpy.data.objects.remove(bv)
    unpose_rigs()
    return lines


# ====================================================================== hoods and masks (rows fitted to the head)
def custom_tree(fit, name, pred):
    """Registers a binding target `name`: the body triangles for which pred(region, centroid) is true."""
    tris = []
    for ti, t in enumerate(fit.smap.tris):
        c = (fit.P[t[0]] + fit.P[t[1]] + fit.P[t[2]]) / 3
        if pred(fit.tri_region[ti], c):
            tris.append(ti)
    fit._trees[name] = (BVHTree.FromPolygons(fit.P, [fit.smap.tris[t] for t in tris]), tris)
    return name


def hood_shell(fit, C, thetas, segs, clr, opening, neck_rows=(), point=None, prof=None, bind=None, phi_shift=0.0):
    """The outer surface of a hood: spherical rows around the head centre C at polar angles `thetas` (radians; the
    first must be 0 — the pole, which `point` may pull into a peak), each at the head's profile + clr(theta, phi);
    rows crossing the face opening run as a C from phi = a to 2pi - a (a = opening(theta) half-width), so the opening's
    edge is a clean curve; then closed horizontal rings `neck_rows` = [(z, clear, regions, scale)] for the gather and
    the drape. bind(theta or None, phi, point) gives each vertex's binding. Returns the MB (outer surface only) with
    mb.opening_side = the vertex indices on the opening edge."""
    prof = prof or HeadProfile(fit, C)
    mb = MB()
    rows = []
    edge = set()

    def place(th, ph):
        r = prof.r(th, ph) + clr(th, ph)
        p = C + sph(th, ph) * r
        if point:
            p = p + point(th, ph)
        return p

    p0 = place(0.0, math.pi)
    rows.append(('pole', [mb.add_v(p0, bind(0.0, math.pi, p0))]))
    for th in thetas[1:]:
        a = opening(th)
        idx = []
        if a <= 1e-6:
            for k in range(segs):
                ph = TAU * k / segs + phi_shift
                p = place(th, ph)
                idx.append(mb.add_v(p, bind(th, ph, p)))
            rows.append(('closed', idx))
        else:
            for k in range(segs + 1):
                ph = a + (TAU - 2 * a) * k / segs
                p = place(th, ph)
                idx.append(mb.add_v(p, bind(th, ph, p)))
            edge.update((idx[0], idx[-1]))
            rows.append(('open', idx))
    for (z, clear, regs, scale) in neck_rows:
        centre, R = ring_section(fit, z, regs, segs)
        R = smooth_ring(R, 2)
        idx = []
        margin = 1.0 / math.cos(math.pi / segs)
        for k in range(segs):
            ph = TAU * k / segs + phi_shift
            r = R[k] * margin + (clear(ph) if callable(clear) else clear)
            if scale:
                r = scale(ph, r)
            p = Vector((centre[0] + math.sin(ph) * r, centre[1] - math.cos(ph) * r, z))
            idx.append(mb.add_v(p, bind(None, ph, p)))
        rows.append(('closed', idx))
    # stitch
    for (ka, A), (kb, B) in zip(rows[:-1], rows[1:]):
        if ka == 'pole':
            for k in range(len(B) - (1 if kb == 'open' else 0)):
                k2 = (k + 1) % len(B)
                mb.add_f((A[0], B[k], B[k2]), 0)
            continue
        if ka == 'closed' and kb == 'closed':
            n = len(A)
            for k in range(n):
                mb.add_f((A[k], B[k], B[(k + 1) % n], A[(k + 1) % n]), 0)
        elif ka == 'closed' and kb == 'open':
            n = len(A)
            for k in range(n):
                mb.add_f((A[k], B[k], B[k + 1], A[(k + 1) % n]), 0)
        elif ka == 'open' and kb == 'closed':
            n = len(B)
            for k in range(n):
                mb.add_f((A[k], B[k], B[(k + 1) % n], A[k + 1]), 0)
        else:
            for k in range(len(A) - 1):
                mb.add_f((A[k], B[k], B[k + 1], A[k + 1]), 0)
    orient_from(mb, C, lambda c: c.z > C.z - 0.06)
    mb.opening_side = edge
    mb.rows = rows
    return mb


def orient_from(mb, C, where=None):
    """Flips the whole piece if most of its faces (those whose centroid passes where()) face toward C."""
    vote = 0.0
    for k in range(len(mb.f)):
        c = mb.centroid(k)
        if where is None or where(c):
            vote += mb.face_normal(k).dot((c - C).normalized())
    if vote < 0:
        mb.flip()
    return mb


def edge_band(mb, loop, width, lift, slot, bind_from=True, closed=False, inward=None):
    """A band on the surface along a boundary loop of `mb` (indices), `width` into the surface from the edge, `lift`
    above it — a hem trim that reads from the front, not just as an edge."""
    vn = mb.vertex_normals()
    out = MB()
    n = len(loop)
    ids_a, ids_b = [], []
    # the interior side: the face centroid next to each edge
    for j, i in enumerate(loop):
        if closed:
            t = mb.v[loop[(j + 1) % n]] - mb.v[loop[(j - 1) % n]]
        else:
            t = mb.v[loop[min(n - 1, j + 1)]] - mb.v[loop[max(0, j - 1)]]
        b = vn[i].cross(t)
        b = b.normalized() if b.length > 1e-9 else Vector((0, 0, 1))
        if inward is not None and b.dot(inward(mb.v[i])) < 0:
            b = -b
        p = mb.v[i] + vn[i] * lift
        ids_a.append(out.add_v(p, mb.bind[i], mb.w[i]))
        ids_b.append(out.add_v(p + b * width, mb.bind[i], mb.w[i]))
    m = n if closed else n - 1
    for j in range(m):
        j2 = (j + 1) % n
        out.add_f((ids_a[j], ids_a[j2], ids_b[j2], ids_b[j]), slot)
    # orient along the surface normal
    if out.f:
        k = 0
        if out.face_normal(k).dot(vn[loop[0]]) < 0:
            out.flip()
    return out


def loop_where(mb, pred):
    """The boundary loops of mb whose vertex centroid satisfies pred(centroid)."""
    res = []
    for lp in mb.boundary_loops():
        c = sum((mb.v[i] for i in lp), Vector()) / len(lp)
        if pred(c):
            res.append(lp)
    return res


def face_mask(fit, C, thetas, phis, clr, prof=None, widen=0.35, bind=None):
    """A mask over the lower face: a grid of rows (thetas) x columns (phis, around the front), each point on the
    head profile maxed over +-`widen` radians of phi (the nose becomes a soft ridge, not a beak) + clr(theta, phi)."""
    prof = prof or HeadProfile(fit, C)
    grid = []
    for ph in phis:
        col = []
        for th in thetas:
            r = max(prof.r(th, ph + d) for d in (-widen, -widen / 2, 0.0, widen / 2, widen))
            p = C + sph(th, ph) * (r + clr(th, ph))
            col.append(p)
        grid.append(col)
    mb = grid_mb(grid, 0, bind or (lambda i, r, p: ('regions', ('head',))))
    orient_from(mb, C)
    return mb


def plane_loops(mb, z, axis=Vector((0, 0, 1))):
    """Where the plane (normal `axis`, at height z along it) crosses the piece: polylines of points."""
    axis = Vector(axis).normalized()
    segs = []
    for f in mb.f:
        pts = []
        n = len(f)
        for k in range(n):
            a, b = mb.v[f[k]], mb.v[f[(k + 1) % n]]
            da, db = a.dot(axis) - z, b.dot(axis) - z
            if (da < 0) != (db < 0):
                t = da / (da - db)
                pts.append(a.lerp(b, t))
        if len(pts) == 2:
            segs.append(pts)
    # chain segments by nearest endpoints
    chains = []
    used = [False] * len(segs)
    for s0 in range(len(segs)):
        if used[s0]:
            continue
        used[s0] = True
        chain = [segs[s0][0], segs[s0][1]]
        grown = True
        while grown:
            grown = False
            for s in range(len(segs)):
                if used[s]:
                    continue
                a, b = segs[s]
                if (a - chain[-1]).length < 1e-6:
                    chain.append(b)
                elif (b - chain[-1]).length < 1e-6:
                    chain.append(a)
                elif (a - chain[0]).length < 1e-6:
                    chain.insert(0, b)
                elif (b - chain[0]).length < 1e-6:
                    chain.insert(0, a)
                else:
                    continue
                used[s] = True
                grown = True
        chains.append(chain)
    return chains


def resample(pts, spacing, closed=False):
    pts = [Vector(p) for p in pts]
    if closed:
        pts = pts + [pts[0]]
    L = [0.0]
    for i in range(1, len(pts)):
        L.append(L[-1] + (pts[i] - pts[i - 1]).length)
    n = max(2, int(round(L[-1] / spacing)) + (0 if closed else 1))
    out = []
    for s in range(n):
        x = L[-1] * s / (n if closed else (n - 1))
        j = 0
        while j < len(L) - 2 and L[j + 1] < x:
            j += 1
        t = (x - L[j]) / max(1e-9, L[j + 1] - L[j])
        out.append(pts[j].lerp(pts[j + 1], min(1.0, max(0.0, t))))
    return out


# ====================================================================== the whole build of one class
FIVE = ('helmet', 'chest', 'legs', 'gloves', 'boots')


def run_class(class_id, build, palette, glow, slot_order, notes=()):
    """Opens the source blend, builds tiers F and S with build(fit, tier) → {key: {mb, slot?, hides, props?}}, realizes
    every piece on both frames (objects gear_<class>_<key>_<tier>.<frame>), renders the review set, saves
    art/build/gear_<class>.blend, exports gear_<class>_<frame>.glb and re-imports them. Flags: --quick (smaller, fewer
    samples), --no-render."""
    from common import BUILD, RENDERS, REPO, args as cargs, save_blend
    from export import reimport_report
    A = cargs()
    quick = bool(A.get('quick'))
    render = not A.get('no_render')
    src = G.source_blend()
    bpy.ops.wm.open_mainfile(filepath=src)
    log('gear %s: source %s' % (class_id, os.path.relpath(src, REPO)))
    bodies = G.load_bodies()
    fit = Fit(bodies)
    sets = {t: {f: [] for f in G.FRAMES} for t in ('F', 'S')}
    hides_by_name, tris, slots_of = {}, {}, {}
    for tier in ('F', 'S'):
        built = build(fit, tier)
        for key, e in built.items():
            mb = e['mb']
            piece = to_piece(fit, mb, key)
            props = {'slot': e.get('slot', key), 'tier': tier, 'class': class_id, 'hides': list(e.get('hides', []))}
            props.update(e.get('props', {}))
            for f in G.FRAMES:
                name = 'gear_%s_%s_%s.%s' % (class_id, key, tier, f)
                old = bpy.data.objects.get(name)
                if old:
                    bpy.data.objects.remove(old)
                ob = realize_piece(fit, piece, f, name, props)
                sets[tier][f].append(ob)
                hides_by_name[name] = props['hides']
            tris[(key, tier)] = mb.tris()
            slots_of[key] = props['slot']
            log('  %s %s: %d tris, hides %s' % (key, tier, mb.tris(), props['hides']))
    keys = sorted({k for k, _ in tris}, key=lambda k: slot_order.index(k) if k in slot_order else 99)
    report = ['# gear_%s — build report (generated by build_gear_%s.py)' % (class_id, class_id), '',
              'Source: `%s` · species keys on the body: %s' % (os.path.relpath(src, REPO).replace('\\', '/'),
                                                               ', '.join(bodies['broad'].species_keys) or 'none yet'), '',
              '| piece | slot | F tris | S tris | hides (F / S) |', '|---|---|---:|---:|---|']
    for k in keys:
        hf = hides_by_name.get('gear_%s_%s_F.broad' % (class_id, k), [])
        hs = hides_by_name.get('gear_%s_%s_S.broad' % (class_id, k), [])
        report.append('| %s | %s | %s | %s | %s / %s |' % (k, slots_of[k], tris.get((k, 'F'), '—'), tris.get((k, 'S'), '—'),
                                                         ', '.join(hf) or '—', ', '.join(hs) or '—'))
    for t in ('F', 'S'):
        five = sum(tris.get((k, t), 0) for k in keys if k in FIVE)
        allp = sum(tris.get((k, t), 0) for k in keys)
        report.append('')
        report.append('- **%s**: five armour pieces %d tris (budget 4,500); with every extra piece %d' % (t, five, allp))
    for n in notes:
        report.append('- ' + n)
    out = os.path.join(RENDERS, 'hero', 'gear', class_id)
    os.makedirs(out, exist_ok=True)
    if render:
        review_class(class_id, sets, hides_by_name, out, palette, glow, quick=quick, log_lines=report, slot_order=slot_order)
    unpose_rigs()
    for o in list(bpy.data.objects):
        if o.name.startswith('View_'):
            bpy.data.objects.remove(o)
    save_blend(os.path.join(BUILD, 'gear_%s.blend' % class_id))
    sizes = G.export_class(class_id, {f: [o for t in sets for o in sets[t][f]] for f in G.FRAMES})
    report.append('')
    report.append('Exports: ' + ', '.join('gear_%s_%s.glb %.1f KB' % (class_id, f, kb) for f, kb in sizes.items()))
    path = os.path.join(out, 'build_report.md')

    def write():
        with open(path, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write('\n'.join(report) + '\n')
    write()
    from common import MODELS
    report.append('')
    for f in G.FRAMES:
        report += reimport_report(os.path.join(MODELS, 'hero', 'gear_%s_%s.glb' % (class_id, f)))
    write()
    for line in report:
        log(line)


# ====================================================================== uniform simplification
def simplify_uniform(mb, ratio, protect=None, max_passes=40, min_dot=0.35):
    """Even triangles: collapses the shortest edges first, in independent sets (no two collapses share a 1-ring), until
    len(verts) ≈ ratio × the start. Open-edge vertices only slide along the open edge (a plane-cut hem stays on its
    plane); a collapse that would turn a neighbouring face over is skipped. protect(pos) → 0..1 scales an edge's
    length up (0.5 makes it look twice as long), so joints keep their density. Faces keep their slots; vertices take
    the binding of the nearest old vertex on the old face under them."""
    import bmesh as _bm
    bm = _bm.new()
    vs = [bm.verts.new(tuple(v)) for v in mb.v]
    slot_layer = bm.faces.layers.int.new('slot')
    for f, s in zip(mb.f, mb.s):
        try:
            face = bm.faces.new([vs[i] for i in f])
            face[slot_layer] = s
        except ValueError:
            pass
    _bm.ops.triangulate(bm, faces=bm.faces[:])
    bm.verts.ensure_lookup_table()
    target = max(8, int(len(bm.verts) * ratio))

    def weight(v):
        return protect(v.co) if protect else 1.0

    def flips(a, b, co):
        for v in (a, b):
            for f in v.link_faces:
                if a in f.verts and b in f.verts:
                    continue
                pts_old = [x.co for x in f.verts]
                pts_new = [co if (x is a or x is b) else x.co for x in f.verts]
                n0 = (pts_old[1] - pts_old[0]).cross(pts_old[2] - pts_old[0])
                n1 = (pts_new[1] - pts_new[0]).cross(pts_new[2] - pts_new[0])
                if n1.length < 1e-12:
                    return True
                if n0.length > 1e-12 and n0.normalized().dot(n1.normalized()) < min_dot:
                    return True
        return False

    for _ in range(max_passes):
        if len(bm.verts) <= target:
            break
        need = len(bm.verts) - target
        edges = sorted(bm.edges, key=lambda e: e.calc_length() * (2.5 if e.is_boundary else 1.0)
                       / max(0.05, min(weight(e.verts[0]), weight(e.verts[1]))))
        touched = set()
        plan = []
        for e in edges:
            if len(plan) >= need:
                break
            a, b = e.verts
            if a in touched or b in touched:
                continue
            ab, bb = a.is_boundary, b.is_boundary
            if ab and bb and not e.is_boundary:
                continue
            # a vertex where the boundary turns sharply keeps its place (corners of a cut, the ends of a slit)
            if ab and bb:
                co = (a.co + b.co) / 2
                for v in (a, b):
                    be = [x for x in v.link_edges if x.is_boundary]
                    if len(be) == 2:
                        d1 = (be[0].other_vert(v).co - v.co).normalized()
                        d2 = (be[1].other_vert(v).co - v.co).normalized()
                        if d1.dot(d2) > -0.85:          # a corner sharper than ~150°
                            co = v.co.copy()
            elif ab:
                co = a.co.copy()
            elif bb:
                co = b.co.copy()
            else:
                co = (a.co + b.co) / 2
            if flips(a, b, co):
                continue
            # the link condition: the two vertices may share only the faces of this edge's neighbours
            na = {x.other_vert(a) for x in a.link_edges}
            nb = {x.other_vert(b) for x in b.link_edges}
            if len(na & nb) > (1 if e.is_boundary else 2):
                continue
            plan.append((a, b, co))
            touched.update(na | nb | {a, b})
        if not plan:
            break
        for a, b, co in plan:
            if a.is_valid and b.is_valid:
                _bm.ops.pointmerge(bm, verts=[a, b], merge_co=co)
        # clean degenerate faces
        _bm.ops.dissolve_degenerate(bm, dist=1e-7, edges=bm.edges[:])
    bm.verts.ensure_lookup_table()
    bm.verts.index_update()
    old = mb.tree()
    out = MB()
    for v in bm.verts:
        _, _, fi, _ = old.find_nearest(v.co)
        j = min(mb.f[fi], key=lambda k: (mb.v[k] - v.co).length)
        out.add_v(v.co.copy(), mb.bind[j], mb.w[j])
    for f in bm.faces:
        if len(f.verts) >= 3:
            out.add_f([v.index for v in f.verts], f[slot_layer])
    bm.free()
    return out


# ====================================================================== boots: one tube bent at the ankle
def _catmull(pts, n):
    """n points along a Catmull-Rom curve through pts (ends clamped), evenly spaced in arc length."""
    pts = [Vector(p) for p in pts]
    dense = []
    ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for s in range(12):
            t = s / 12
            t2, t3 = t * t, t * t * t
            dense.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    dense.append(pts[-1])
    return resample(dense, 1.0, closed=False) if n is None else _even(dense, n)


def _even(dense, n):
    L = [0.0]
    for i in range(1, len(dense)):
        L.append(L[-1] + (dense[i] - dense[i - 1]).length)
    out = []
    j = 0
    for s in range(n):
        x = L[-1] * s / (n - 1)
        while j < len(L) - 2 and L[j + 1] < x:
            j += 1
        t = (x - L[j]) / max(1e-9, L[j + 1] - L[j])
        out.append(dense[j].lerp(dense[j + 1], min(1.0, max(0.0, t))))
    return out


def boot_tube(fit, side, z_top, segs, clear, rings, slot, sole_slot=None, sole_z=-0.006, slab=0.022, shape=None,
              toe_push=0.012, regions=('shins', 'feet'), inflate=None, inflate_ref=None, inflate_ref_clear=0.0045,
              max_gap=None):
    """A boot as one tube: rings around a curve that runs down the shin from z_top, bends at the ankle and runs along
    the foot to the toe, each ring fitted to the body's section there (polar max — toes, heel and ankle bones become
    one smooth shape) + clear(s) (s = 0 at the top … 1 at the toe), the sole flattened to the floor, the toe closed by
    a cap pushed `toe_push` forward. shape(s, angle, r) may reshape a ring (a split toe, a flare). Returns the MB."""
    kn, an = fit.joint(side + 'LowerLeg', 'head'), fit.joint(side + 'LowerLeg', 'tail')
    ball, toe = fit.joint(side + 'Foot', 'tail'), fit.joint(side + 'Toes', 'tail')
    t_top = (kn.z - z_top) / (kn.z - an.z)
    top = kn.lerp(an, t_top)
    mid = kn.lerp(an, 0.72)
    ankle = Vector((an.x, an.y + 0.004, 0.105))
    instep = Vector((an.x + 0.45 * (ball.x - an.x), an.y - 0.05, 0.062))
    ballp = Vector((ball.x, ball.y + 0.005, 0.045))
    toep = Vector(((ball.x + toe.x) / 2, toe.y - 0.010, 0.04))   # past the toe tips, centred on the toe box
    curve = _catmull([top, mid, ankle, instep, ballp, toep], rings)
    mb = MB()
    rows = []
    margin = 1.0 / math.cos(math.pi / segs)
    n = len(curve)
    prev = None
    bd = ('regions', tuple(regions))
    u_prev = None
    for i, c in enumerate(curve):
        tng = (curve[min(n - 1, i + 1)] - curve[max(0, i - 1)]).normalized()
        if u_prev is None:
            d, u, v = axes_for(tng, Vector((0, -1, 0)))
        else:                                   # parallel transport: no twist round the ankle
            d = tng
            u = (u_prev - d * u_prev.dot(d)).normalized()
            v = d.cross(u)
        u_prev = u
        s_ = i / (n - 1)
        sl = slab * (1.7 if 0.3 < s_ < 0.75 else 1.0)    # round the bend: wide enough to take in the heel
        _, R = section(fit, c, d, u, v, regions, segs, sl)
        if R is None:
            R = prev
        prev = R
        R = smooth_ring(R, 2)
        s = i / (n - 1)
        cl = clear(s) if callable(clear) else clear
        row = []
        for k in range(segs):
            th = TAU * k / segs
            r = R[k] * margin + cl
            if shape:
                r = shape(s, th, r)
            p = c + (u * math.cos(th) + v * math.sin(th)) * r
            if p.z < sole_z:
                p.z = sole_z
            row.append(mb.add_v(p, bd))
        rows.append(row)
    for i in range(n - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            mb.add_f((rows[i][k], rows[i][k2], rows[i + 1][k2], rows[i + 1][k]), slot)
    # the toe cap
    last = rows[-1]
    cen = sum((mb.v[i] for i in last), Vector()) / segs
    tipd = (curve[-1] - curve[-2]).normalized()
    tip = mb.add_v(cen + tipd * toe_push, bd)
    for k in range(segs):
        mb.add_f((last[k], last[(k + 1) % segs], tip), slot)
    # outward
    k = len(mb.f) // 3
    cen_k = mb.centroid(k)
    nearest = min(curve, key=lambda q: (q - cen_k).length)
    if mb.face_normal(k).dot(cen_k - nearest) < 0:
        mb.flip()
    if max_gap:
        # no part of the boot more than max_gap off the skin: the bend rings, wide enough for the heel, otherwise leave
        # the ankle loose (a 4 cm gap at its front, round 6)
        for i, q in enumerate(mb.v):
            sd, loc, nrm, _ = fit.signed(q, regions)
            if sd > max_gap and q.z > sole_z + 0.004:
                mb.v[i] = loc + nrm * max_gap
    if inflate:
        inflate_faces(fit, mb, inflate, regions=regions, ref=inflate_ref, ref_clear=inflate_ref_clear)
        for i, p in enumerate(mb.v):
            if p.z < sole_z:
                mb.v[i] = Vector((p.x, p.y, sole_z))
    if sole_slot is not None:
        mb.restyle(lambda cc, nn, sl: sole_slot if (nn.z < -0.6 and cc.z < 0.012) else sl)
    mb.rows = rows
    mb.curve = curve
    return mb


def patch(fit, regions, centre, radius, offset, slot, ratio=0.5, smooth=1, clear=None, squash=None):
    """A conforming patch: the body's faces within `radius` of `centre` (squash scales the distance per axis, e.g.
    (1, 1, 0.7) for a taller oval), pushed `offset` off the skin, smoothed and simplified."""
    sq = Vector(squash or (1, 1, 1))
    c0 = Vector(centre)

    def keep(fi, c):
        dlt = c - c0
        return Vector((dlt.x * sq.x, dlt.y * sq.y, dlt.z * sq.z)).length < radius
    mb = garment(fit, regions, offset, keep_face=keep, smooth=smooth, clear=clear if clear is not None else offset * 0.8,
                 ratio=ratio, slot=slot)
    return mb


# ====================================================================== helpers both classes use
def protect_joints(fit, w_joint=0.45):
    """Simplification weights: keep density at the elbows, shoulders, knees and hips (where the gear bends)."""
    pts = []
    for side in ('Left', 'Right'):
        pts += [(fit.joint(side + 'LowerArm'), 0.06), (fit.joint(side + 'UpperArm'), 0.08), (fit.joint(side + 'LowerLeg'), 0.08),
                (fit.joint(side + 'UpperLeg'), 0.09)]

    def w(p):
        for c, r in pts:
            if (p - c).length < r:
                return w_joint
        return 1.0
    return w


def arm_cut(fit, side, t, toward='elbow', regions=('forearms', 'hands'), bone='LowerArm'):
    """A plane across a limb bone at fraction t (head→tail), keeping the elbow side (or the hand side)."""
    a, b = fit.joint(side + bone, 'head'), fit.joint(side + bone, 'tail')
    p = a.lerp(b, t)
    n = (a - b) if toward == 'elbow' else (b - a)
    return dict(point=p, normal=n, keep='front', regions=list(regions))


def two_band(mb, loop, widths, lift, inward=None, closed=True):
    """Bands along a boundary loop: widths = [(width, slot), ...] from the edge inward (a trim band, then a glow line)."""
    out = MB()
    acc = 0.0
    for w, slot in widths:
        b = edge_band(mb, loop, acc + w, lift, slot, closed=closed, inward=inward)
        if acc > 0:
            for j in range(len(loop)):
                a_id, b_id = 2 * j, 2 * j + 1
                b.v[a_id] = b.v[a_id] + (b.v[b_id] - b.v[a_id]) * (acc / (acc + w))
        out.extend(b)
        acc += w
    return out


def spiral(fit, a, b, t0, t1, turns, radius=0.25, samples=None, phase=0.0):
    """Guide points winding round the limb axis a→b from t0 to t1 (far outside; project them with polyline_on)."""
    a, b = Vector(a), Vector(b)
    d, u, v = axes_for(b - a)
    n = samples or max(8, int(turns * 14))
    out = []
    for i in range(n):
        s = i / (n - 1)
        th = phase + TAU * turns * s
        out.append(a.lerp(b, t0 + (t1 - t0) * s) + (u * math.cos(th) + v * math.sin(th)) * radius)
    return out


def wrap_lines(fit, tree, a, b, t0, t1, turns, width, slot, regions, off=0.0025, phase=0.0, segs_per_turn=18, reach=0.09):
    """A spiral strap line on a surface (tree) round the limb a→b: wraps that read as wrapping. Points are projected
    radially (the guide spiral is close to the axis's ring, so the nearest surface point stays on the right side)."""
    pts = []
    a, b = Vector(a), Vector(b)
    d, u, v = axes_for(b - a)
    n = max(8, int(turns * segs_per_turn))
    for i in range(n):
        s = i / (n - 1)
        th = phase + TAU * turns * s
        c = a.lerp(b, t0 + (t1 - t0) * s)
        ray = (u * math.cos(th) + v * math.sin(th))
        hit = tree.ray_cast(c + ray * reach, -ray, reach)
        if hit[0] is None:
            continue
        nrm = hit[1].normalized()
        if nrm.dot(ray) < 0:
            nrm = -nrm
        pts.append((hit[0] + nrm * off, nrm))
    if len(pts) < 2:
        return MB()
    return ribbon(fit, pts, width, slot, regions)


def ring_band(mb, rows, r0, f0, f1, push, slot, lip=0.0, lip_slot=None):
    """A strap that follows a tube (mb.rows from tube()/boot_tube()): the band between fractions f0 and f1 of the way
    from ring r0 to ring r0+1, pushed 'push' out along the tube's normals, with optional lips."""
    vn = mb.vertex_normals()
    A, B = rows[r0], rows[r0 + 1]
    out = MB()
    n = len(A)
    e0, e1 = [], []
    for k in range(n):
        for f, lst in ((f0, e0), (f1, e1)):
            p = mb.v[A[k]].lerp(mb.v[B[k]], f)
            nn = (vn[A[k]].lerp(vn[B[k]], f)).normalized()
            lst.append(out.add_v(p + nn * push, mb.bind[A[k]] if f < 0.5 else mb.bind[B[k]]))
    for k in range(n):
        k2 = (k + 1) % n
        out.add_f((e0[k], e0[k2], e1[k2], e1[k]), slot)
    if out.face_normal(0).dot(vn[A[0]]) < 0:
        out.flip()
    if lip:
        rim(out, lip, lip_slot if lip_slot is not None else slot)
    return out


def ring_at(mb, z):
    """The index of the tube ring (mb.curve) whose span holds height z, and the fraction toward the next ring."""
    best = min(range(len(mb.curve) - 1), key=lambda i: abs((mb.curve[i].z + mb.curve[i + 1].z) / 2 - z))
    a, b = mb.curve[best].z, mb.curve[best + 1].z
    f = 0.5 if abs(a - b) < 1e-6 else min(0.9, max(0.1, (a - z) / (a - b)))
    return best, f

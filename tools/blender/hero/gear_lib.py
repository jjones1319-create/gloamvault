"""gear_lib.py — building gear that fits both body frames and every species (tools/blender/README.md §Gear).

A gear piece is built once, on the broad frame, out of vertices of two kinds:
- **body vertices pushed out**: (body vertex index, offset in metres along that vertex's normal) — a shell of the
  body's own faces, so it follows every shape of the body exactly (both frames, every species key);
- **bound points**: free geometry (a pauldron, a buckle, a skirt hem) bound to the broad body's nearest triangle with
  `fit.SurfaceMap`, re-evaluated on the same triangle in every other shape.
`realize()` turns a piece into a Blender object for one frame: basis positions from that frame, one shape key per
species key the body carries, skin weights from the body (copied for pushed vertices, blended barycentrically for
bound ones, 4 influences), the palette split, custom properties, an Armature modifier on `Rig_<frame>`.

Open `art/build/hero_species.blend` when it exists (the body then carries the species keys; gear inherits them), else
`art/build/hero_body.blend` (no species keys yet — re-run once the species pass has landed).
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.geometry import barycentric_transform

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'lib'))
from common import BUILD, collection, log  # noqa: E402
from fit import SurfaceMap  # noqa: E402
import toon  # noqa: E402

FRAMES = ('broad', 'slight')
SPECIES_KEYS = ('spc_dwarf_broad', 'spc_elf_lean', 'spc_orc_bulk', 'spc_halfling_round', 'spc_draconid_ridge')


def source_blend():
    sp = os.path.join(BUILD, 'hero_species.blend')
    return sp if os.path.exists(sp) else os.path.join(BUILD, 'hero_body.blend')


def _normals(verts, faces):
    me = bpy.data.meshes.new('gv_tmp_normals')
    me.from_pydata([tuple(v) for v in verts], [], faces)
    for p in me.polygons:
        p.use_smooth = True
    me.update()
    out = [v.normal.copy() for v in me.vertices]
    bpy.data.meshes.remove(me)
    return out


class Body:
    """One frame's body, read once: positions and normals per shape, faces, regions, weights."""

    def __init__(self, frame):
        self.frame = frame
        self.ob = bpy.data.objects['Body_' + frame]
        self.rig = bpy.data.objects['Rig_' + frame]
        me = self.ob.data
        self.faces = [tuple(p.vertices) for p in me.polygons]
        self.face_regions = []
        codes = toon.vertex_codes(me)
        self.regions = [c[1] for c in codes]
        for f in self.faces:
            rs = [self.regions[i] for i in f]
            self.face_regions.append(max(set(rs), key=rs.count))
        self.shapes = {'Basis': [v.co.copy() for v in me.vertices]}
        if me.shape_keys:
            for kb in me.shape_keys.key_blocks:
                if kb.name != 'Basis':
                    self.shapes[kb.name] = [d.co.copy() for d in kb.data]
        # custom (full-resolution) normals for the basis; computed normals for the other shapes
        me.update()
        loop_n = [None] * len(me.vertices)
        try:
            for l in me.loops:
                if loop_n[l.vertex_index] is None:
                    loop_n[l.vertex_index] = Vector(l.normal)
        except Exception:
            pass
        basis_n = [n if n is not None else v.normal.copy() for n, v in zip(loop_n, me.vertices)]
        self.normals = {'Basis': basis_n}
        for name, verts in self.shapes.items():
            if name != 'Basis':
                # the key's normal = the basis normal rotated by how the key turned the surface around it
                computed_basis = _normals(self.shapes['Basis'], self.faces)
                computed_key = _normals(verts, self.faces)
                self.normals[name] = [(bn + (ck - cb)).normalized() for bn, cb, ck in zip(basis_n, computed_basis, computed_key)]
        groups = {vg.index: vg.name for vg in self.ob.vertex_groups}
        self.weights = [[(groups[g.group], g.weight) for g in v.groups if g.weight > 0] for v in me.vertices]
        self.species_keys = [k for k in SPECIES_KEYS if k in self.shapes]


def load_bodies():
    bodies = {f: Body(f) for f in FRAMES}
    log('gear bodies: species keys on the body: %s' % (bodies['broad'].species_keys or 'none yet'))
    return bodies


class Piece:
    """A gear piece under construction (broad-frame terms). Vertex sources: ('push', body index, offset),
    ('lerp', body index i, body index j, t, offset) — a point on a body edge, made by `cut()` — or
    ('bind', triangle index, point in broad-basis space, offset)."""

    def __init__(self, name):
        self.name = name
        self.src = []
        self.faces = []
        self.slots = []

    # ---- building
    def add_push(self, body_index, offset):
        self.src.append(('push', body_index, offset))
        return len(self.src) - 1

    def add_face(self, verts, slot):
        self.faces.append(tuple(verts))
        self.slots.append(slot)


def shell(bodies, regions, offset, slot, name='shell', keep_face=None):
    """The body's faces in `regions` (region names or ids), pushed out by `offset` metres. `keep_face(i, center)` may
    reject faces (e.g. cut a neckline). Returns the Piece and the body→piece vertex map."""
    b = bodies['broad']
    want = {toon.REGION[r] if isinstance(r, str) else r for r in regions}
    p = Piece(name)
    vmap = {}
    for fi, f in enumerate(b.faces):
        if b.face_regions[fi] not in want:
            continue
        if keep_face is not None:
            c = sum((b.shapes['Basis'][i] for i in f), Vector((0, 0, 0))) / len(f)
            if not keep_face(fi, c):
                continue
        ids = []
        for i in f:
            if i not in vmap:
                vmap[i] = p.add_push(i, offset)
            ids.append(vmap[i])
        p.add_face(ids, slot)
    return p, vmap


def boundary_loops(piece):
    """The piece's open edges chained into loops (lists of piece vertex indices)."""
    count = {}
    for f in piece.faces:
        for k in range(len(f)):
            e = tuple(sorted((f[k], f[(k + 1) % len(f)])))
            count[e] = count.get(e, 0) + 1
    open_edges = [e for e, n in count.items() if n == 1]
    nbr = {}
    for a, c in open_edges:
        nbr.setdefault(a, []).append(c)
        nbr.setdefault(c, []).append(a)
    seen, loops = set(), []
    for start in nbr:
        if start in seen:
            continue
        loop, cur, prev = [start], start, None
        seen.add(start)
        while True:
            nxt = [n for n in nbr[cur] if n != prev and n not in seen]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            loop.append(cur)
            seen.add(cur)
        loops.append(loop)
    return loops


def add_rim(piece, extra_offset, slot, loops=None):
    """A thickness band along the open edges: each boundary vertex gets a twin pushed `extra_offset` further out (or
    in, if negative), joined by a strip of faces in `slot` — gives hems, cuffs and plate edges a visible lip."""
    loops = loops if loops is not None else boundary_loops(piece)
    for loop in loops:
        if len(loop) < 3:
            continue
        twins = []
        for vi in loop:
            kind = piece.src[vi]
            if kind[0] == 'push':
                twins.append(piece.add_push(kind[1], kind[2] + extra_offset))
            elif kind[0] == 'lerp':
                piece.src.append(('lerp', kind[1], kind[2], kind[3], kind[4] + extra_offset))
                twins.append(len(piece.src) - 1)
            else:
                piece.src.append(('bind', kind[1], kind[2], kind[3] + extra_offset))
                twins.append(len(piece.src) - 1)
        n = len(loop)
        closed = True
        for k in range(n if closed else n - 1):
            a, c = loop[k], loop[(k + 1) % n]
            ta, tc = twins[k], twins[(k + 1) % n]
            piece.add_face((a, c, tc, ta), slot)
    return piece


def bind_mesh(piece, bodies, verts, faces, slots):
    """Free geometry in broad-basis space: every vertex bound to the broad body's nearest triangle."""
    b = bodies['broad']
    smap = SurfaceMap(b.shapes['Basis'], b.faces)
    base = len(piece.src)
    for ti, p in smap.bind(verts):
        piece.src.append(('bind', ti, p, 0.0))
    for f, s in zip(faces, slots):
        piece.add_face([base + i for i in f], s)
    piece._smap = smap
    return piece


def _position(piece, src, body, shape, smap):
    if src[0] == 'push':
        _, i, off = src
        return body.shapes[shape][i] + body.normals[shape][i] * off
    if src[0] == 'lerp':
        _, i, j, t, off = src
        p = body.shapes[shape][i].lerp(body.shapes[shape][j], t)
        n = body.normals[shape][i].lerp(body.normals[shape][j], t)
        return p + (n.normalized() if n.length > 1e-9 else n) * off
    _, ti, p, off = src
    a, b, c = smap.tris[ti]
    rest = smap.rest
    q = barycentric_transform(p, rest[a], rest[b], rest[c], body.shapes[shape][a], body.shapes[shape][b], body.shapes[shape][c])
    if off:
        n = (body.shapes[shape][b] - body.shapes[shape][a]).cross(body.shapes[shape][c] - body.shapes[shape][a])
        if n.length > 1e-12:
            q = q + n.normalized() * off
    return q


def _bary(p, a, b, c):
    v0, v1, v2 = b - a, c - a, p - a
    d00, d01, d11 = v0.dot(v0), v0.dot(v1), v1.dot(v1)
    d20, d21 = v2.dot(v0), v2.dot(v1)
    den = d00 * d11 - d01 * d01
    if abs(den) < 1e-14:
        return (1.0, 0.0, 0.0)
    v = (d11 * d20 - d01 * d21) / den
    w = (d00 * d21 - d01 * d20) / den
    u = 1.0 - v - w
    u, v, w = max(0.0, u), max(0.0, v), max(0.0, w)
    s = u + v + w or 1.0
    return (u / s, v / s, w / s)


def _blend_weights(src, body, smap):
    if src[0] == 'push':
        return list(body.weights[src[1]])
    if src[0] == 'lerp':
        _, i, j, t, _ = src
        acc = {}
        for vi, w in ((i, 1.0 - t), (j, t)):
            for bone, bw in body.weights[vi]:
                acc[bone] = acc.get(bone, 0.0) + bw * w
        top = sorted(acc.items(), key=lambda q: -q[1])[:4]
        s = sum(w for _, w in top) or 1.0
        return [(bone, w / s) for bone, w in top]
    _, ti, p, _ = src
    a, b, c = smap.tris[ti]
    ws = _bary(p, smap.rest[a], smap.rest[b], smap.rest[c])
    acc = {}
    for vi, w in zip((a, b, c), ws):
        for bone, bw in body.weights[vi]:
            acc[bone] = acc.get(bone, 0.0) + bw * w
    top = sorted(acc.items(), key=lambda t: -t[1])[:4]
    s = sum(w for _, w in top) or 1.0
    return [(bone, w / s) for bone, w in top]


def realize(piece, bodies, frame, name, props, collection_name='Gear'):
    """The piece as an object for one frame: basis + species shape keys, weights, palette split, props, armature."""
    body = bodies[frame]
    smap = getattr(piece, '_smap', None) or SurfaceMap(bodies['broad'].shapes['Basis'], bodies['broad'].faces)
    # bound points are evaluated on this frame's triangles: rebuild a map whose rest is the broad basis
    basis = [_position(piece, s, body, 'Basis', smap) for s in piece.src]
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in basis], [], piece.faces)
    for p in me.polygons:
        p.use_smooth = True
    me.update()
    ob = bpy.data.objects.new(name, me)
    collection(collection_name).objects.link(ob)
    # weights
    for vi, s in enumerate(piece.src):
        for bone, w in _blend_weights(s, body, smap):
            vg = ob.vertex_groups.get(bone) or ob.vertex_groups.new(name=bone)
            vg.add([vi], w, 'REPLACE')
    # palette (and region 0 everywhere: gear has no body regions)
    toon.set_vertex_codes(me, slots=[0] * len(me.vertices), regions=[0] * len(me.vertices))
    face_slots = list(piece.slots)
    toon.split_by_face_slots(ob, face_slots)
    # species keys: positions recomputed per key from the sources (after the split, map new vertices to sources)
    if body.species_keys:
        ob.shape_key_add(name='Basis')
        # the split keeps old vertex order for the first len(src) vertices? not guaranteed: rebuild by nearest basis position
        from mathutils.kdtree import KDTree
        kd = KDTree(len(basis))
        for i, v in enumerate(basis):
            kd.insert(v, i)
        kd.balance()
        src_of = [kd.find(v.co)[1] for v in me.vertices]
        for key in body.species_keys:
            kb = ob.shape_key_add(name=key)
            kb.value = 0.0  # Blender 5.2 adds keys at 1.0: left so, every key would show in renders and export as weight 1
            pos = [_position(piece, s, body, key, smap) for s in piece.src]
            for vi, si in enumerate(src_of):
                kb.data[vi].co = pos[si]
    for k, v in props.items():
        ob[k] = v
    ob.parent = body.rig
    mod = ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = body.rig
    return ob



# ------------------------------------------------------------------ clean hems: plane cuts
def joint(bodies, bone, end='head', frame='broad'):
    """A bone's head or tail in world space on a frame's rest pose (cut planes are placed from joints)."""
    rig = bodies[frame].rig
    b = rig.data.bones[bone]
    return rig.matrix_world @ (b.head_local if end == 'head' else b.tail_local)


def _src_basis(piece, s, body):
    """A source's broad-basis position (for plane tests)."""
    if s[0] == 'push':
        return body.shapes['Basis'][s[1]] + body.normals['Basis'][s[1]] * s[2]
    if s[0] == 'lerp':
        _, i, j, t, off = s
        p = body.shapes['Basis'][i].lerp(body.shapes['Basis'][j], t)
        n = body.normals['Basis'][i].lerp(body.normals['Basis'][j], t)
        return p + (n.normalized() if n.length > 1e-9 else n) * off
    return s[2]


def _face_region(piece, f, body):
    rs = []
    for v in f:
        s = piece.src[v]
        if s[0] == 'push':
            rs.append(body.regions[s[1]])
        elif s[0] == 'lerp':
            rs.append(body.regions[s[1]])
    return max(set(rs), key=rs.count) if rs else -1


def cut(piece, bodies, point, normal, keep='front', regions=None):
    """Clips the piece against a plane (broad-basis space): keeps the side `normal` points to ('front') or the other
    ('back'). Faces crossing the plane are trimmed; the new edge vertices are blends of two body vertices ('lerp'
    sources) so the hem stays exact on every frame and species. A plane runs forever, so a cut meant for one limb
    takes `regions` (names): only faces of those body regions are clipped, every other face is kept as it is.
    Only pushed-body vertices can be cut."""
    body = bodies['broad']
    only = {toon.REGION[r] if isinstance(r, str) else r for r in regions} if regions else None
    n = Vector(normal).normalized()
    c = Vector(point)
    sign = 1.0 if keep == 'front' else -1.0
    pos = [_src_basis(piece, s, body) for s in piece.src]
    d = [sign * (p - c).dot(n) for p in pos]
    edge_new = {}

    def crossing(a, b):
        key = (min(a, b), max(a, b))
        if key in edge_new:
            return edge_new[key]
        sa, sb = piece.src[a], piece.src[b]
        t = d[a] / (d[a] - d[b])
        if sa[0] == 'push' and sb[0] == 'push':
            new = ('lerp', sa[1], sb[1], t, sa[2] + (sb[2] - sa[2]) * t)
        elif sa[0] == 'lerp' or sb[0] == 'lerp':
            # a cut across an earlier cut's edge: keep the nearer source (rare; the hem moves < half an edge)
            new = sa if abs(d[a]) < abs(d[b]) else sb
        else:
            new = sa if abs(d[a]) < abs(d[b]) else sb
        piece.src.append(new)
        pos.append(pos[a].lerp(pos[b], t))
        d.append(0.0)
        edge_new[key] = len(piece.src) - 1
        return edge_new[key]

    faces, slots = [], []
    for f, sl in zip(piece.faces, piece.slots):
        if only is not None and _face_region(piece, f, body) not in only:
            faces.append(f)
            slots.append(sl)
            continue
        ins = [d[v] >= 0 for v in f]
        if all(ins):
            faces.append(f)
            slots.append(sl)
            continue
        if not any(ins):
            continue
        out = []
        for k in range(len(f)):
            a, b = f[k], f[(k + 1) % len(f)]
            if d[a] >= 0:
                out.append(a)
            if (d[a] >= 0) != (d[b] >= 0):
                out.append(crossing(a, b))
        if len(out) >= 3:
            faces.append(tuple(out))
            slots.append(sl)
    piece.faces, piece.slots = faces, slots
    return piece


def tri_count_piece(piece):
    return sum(len(f) - 2 for f in piece.faces)


# ------------------------------------------------------------------ export
def export_class(class_id, objects_by_frame, out_dir=None):
    """Writes gear_<class>_<frame>.glb for each frame: the frame's rig (as `Rig`) and that frame's pieces, the frame
    suffix stripped from every name (`gear_warden_chest_F.broad` → `gear_warden_chest_F`), outlines removed."""
    from common import MODELS
    from export import export_glb, prepare_for_export
    out_dir = out_dir or os.path.join(MODELS, 'hero')
    sizes = {}
    for frame, pieces in objects_by_frame.items():
        rig = bpy.data.objects['Rig_' + frame]
        objs = [rig] + list(pieces)
        prepare_for_export(objs)
        renames = [(o, o.name) for o in objs] + [(o.data, o.data.name) for o in pieces if o.data is not None]
        clash = [o for o in bpy.data.objects if o.name == 'Rig']
        for o in clash:
            o.name = o.name + '.hold'
        try:
            rig.name = 'Rig'
            for o in pieces:
                if o.name.endswith('.' + frame):
                    o.name = o.name[: -len(frame) - 1]
                if o.data is not None and o.data.name.endswith('.' + frame):
                    o.data.name = o.data.name[: -len(frame) - 1]
            sizes[frame] = export_glb(os.path.join(out_dir, 'gear_%s_%s.glb' % (class_id, frame)), objs)
        finally:
            for o, n in renames:
                o.name = n
            for o in clash:
                o.name = o.name[: -len('.hold')]
    return sizes

"""build_body.py — the two hero body frames on the shared rig (05-SPECIES §5, 11-ART-PIPELINE §2).

Run:  blender -b -P tools/blender/hero/build_body.py -- [--quick] [--stage mesh|rig|all]

1. Mesh. The CC0 Human Base Meshes bundle's stylized male and female bodies share one topology (12,502 vertices,
   12,500 quads). Each is merged with its two eyes in a fixed order, the broad (male) one is decimated to the phone
   budget with X symmetry, and the slight (female) shape is carried onto the decimated mesh through a Surface Deform
   bound at the broad rest — so the two frames keep one topology to the last vertex.
2. Rig. Joints are guessed from a table and snapped to the centroid of the vertex ring around each joint on the broad
   frame; the same vertex rings place the joints of the slight frame. Fingers are found by slicing each hand.
3. Skin. Bone-heat weights on the broad frame, copied by vertex index to the slight frame (same topology).
4. Codes. Every vertex gets its palette slot (skin, lips, eyes) and body region (by its strongest bone).

Outputs: art/build/hero_body.blend; art/renders/hero/body/*.png (the review set); the exports come from
export_hero.py once species, clips and gear exist.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'lib'))
from common import BUILD, BUNDLE, RENDERS, args, append_objects, clear_scene, collection, log, save_blend, set_active  # noqa: E402
import toon  # noqa: E402
from fit import SurfaceMap, mesh_verts_faces  # noqa: E402

ARGS = args()
QUICK = bool(ARGS.get('quick'))
OUT = os.path.join(RENDERS, 'hero', 'body')
SRC = {
    'broad': ('GEO-body_male_stylized', 'GEO-body_male_stylized.eye.L', 'GEO-body_male_stylized.eye.R'),
    'slight': ('GEO-body_female_stylized', 'GEO-body_female_stylized.eye.L', 'GEO-body_female_stylized.eye.R'),
}
FULL_BODY_VERTS = 12502   # the bundle body's vertex count; its two eyes follow it in the merged mesh
TARGET_TRIS = 10500        # body + eyes after decimation (11 §9: ≤ 12k naked)
EYE_KEEP = 0.22            # eyes are decimated on their own, harder


# ------------------------------------------------------------------ 1. mesh
def merged_mesh(name, parts):
    """One mesh from the body and its eyes, in that order, world transforms baked. Returns (object, counts per part)."""
    verts, faces, uvs, counts = [], [], [], []
    for ob in parts:
        me = ob.data
        mw = ob.matrix_world
        base = len(verts)
        verts += [mw @ v.co for v in me.vertices]
        uv = me.uv_layers.active
        for p in me.polygons:
            faces.append([base + i for i in p.vertices])
            uvs.append([tuple(uv.data[li].uv) if uv else (0.0, 0.0) for li in p.loop_indices])
        counts.append(len(me.vertices))
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    lay = me.uv_layers.new(name='UVMap')
    li = 0
    for p, puv in zip(me.polygons, uvs):
        for k, idx in enumerate(p.loop_indices):
            lay.data[idx].uv = puv[k]
        li += len(puv)
    for p in me.polygons:
        p.use_smooth = True
    me.update()
    ob = bpy.data.objects.new(name, me)
    collection('Work').objects.link(ob)
    return ob, counts


def decimate(ob, ratio, symmetry=True):
    set_active(ob)
    mod = ob.modifiers.new('Decimate', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = ratio
    mod.use_symmetry = symmetry
    mod.symmetry_axis = 'X'
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def build_mesh():
    """→ the decimated broad body with a 'slight' shape key, plus the eye vertex ranges."""
    names = [n for frame in ('broad', 'slight') for n in SRC[frame]]
    obs = append_objects(BUNDLE, names)
    by = dict(zip(names, obs))
    for o in obs:
        collection('Source').objects.link(o)
    # the bundle offsets each body sideways with its object location; the meshes themselves are centred on x = 0
    for frame in ('broad', 'slight'):
        body = by[SRC[frame][0]]
        body.location = (0, 0, 0)
    bpy.context.view_layer.update()
    full = {}
    for frame in ('broad', 'slight'):
        body, eye_l, eye_r = (by[n] for n in SRC[frame])
        full[frame], counts = merged_mesh('Full_' + frame, [body, eye_l, eye_r])
    n_body = counts[0]
    n_eye = counts[1]
    # the slight frame as a shape key of the full-resolution broad mesh (one topology)
    fb, fs = full['broad'], full['slight']
    assert len(fb.data.vertices) == len(fs.data.vertices)
    fb.shape_key_add(name='Basis')
    k = fb.shape_key_add(name='slight')
    for i, v in enumerate(fs.data.vertices):
        k.data[i].co = v.co
    # the decimated mesh: body and eyes decimated apart (eyes harder), then merged
    work = fb.copy()
    work.data = fb.data.copy()
    work.shape_key_clear()
    work.name = 'Body'
    work.data.name = 'Body'
    collection('Work').objects.link(work)
    bm = bmesh.new()
    bm.from_mesh(work.data)
    bm.verts.ensure_lookup_table()
    eye_verts = [bm.verts[i] for i in range(n_body, n_body + 2 * n_eye)]
    eyes_bm = bmesh.new()
    # split: copy the eyes out into their own mesh, delete them from the body
    eye_faces = {f for v in eye_verts for f in v.link_faces}
    eye_me = bpy.data.meshes.new('Eyes')
    eb = bmesh.new()
    vmap = {}
    for f in eye_faces:
        for v in f.verts:
            if v not in vmap:
                vmap[v] = eb.verts.new(v.co)
        eb.faces.new([vmap[v] for v in f.verts])
    eb.to_mesh(eye_me)
    eb.free()
    eyes_bm.free()
    bmesh.ops.delete(bm, geom=list(eye_faces) + eye_verts, context='VERTS')
    bm.to_mesh(work.data)
    bm.free()
    eyes = bpy.data.objects.new('Eyes', eye_me)
    collection('Work').objects.link(eyes)
    for p in eye_me.polygons:
        p.use_smooth = True
    body_tris = tris(work)
    eye_tris = tris(eyes)
    decimate(eyes, EYE_KEEP, symmetry=True)
    target_body = TARGET_TRIS - tris(eyes)
    decimate(work, min(1.0, target_body / body_tris), symmetry=True)
    log('decimated body %d → %d tris, eyes %d → %d tris' % (body_tris, tris(work), eye_tris, tris(eyes)))
    n_body_dec = len(work.data.vertices)
    # merge eyes back (body first, then eyes)
    set_active(work)
    eyes.select_set(True)
    work.select_set(True)
    bpy.context.view_layer.objects.active = work
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    # carry the slight shape: bind every decimated vertex to the full broad mesh, re-evaluate on the full slight mesh
    kb = fb.data.shape_keys.key_blocks
    rest, faces = mesh_verts_faces(fb.data, kb['Basis'])
    smap = SurfaceMap(rest, faces)
    bindings = smap.bind([v.co for v in body.data.vertices])
    slight_pos = smap.evaluate(bindings, [d.co for d in kb['slight'].data])
    body.shape_key_add(name='Basis')
    sk = body.shape_key_add(name='slight')
    for i, p in enumerate(slight_pos):
        sk.data[i].co = p
    log('body verts %d (eyes from %d)' % (len(body.data.vertices), n_body_dec))
    return body, n_body_dec, full, smap, bindings


# ------------------------------------------------------------------ 2. frames, normals
def split_frames(body):
    """Two objects with one topology: Body_broad (the basis) and Body_slight (the 'slight' key)."""
    kb = body.data.shape_keys.key_blocks
    out = {}
    for frame in ('broad', 'slight'):
        ob = body.copy()
        ob.data = body.data.copy()
        ob.name = 'Body_' + frame
        ob.data.name = 'Body_' + frame
        collection('Character').objects.link(ob)
        src = kb['Basis'] if frame == 'broad' else kb['slight']
        pos = [d.co.copy() for d in src.data]
        ob.shape_key_clear()
        for v, p in zip(ob.data.vertices, pos):
            v.co = p
        ob.data.update()
        out[frame] = ob
    bpy.data.objects.remove(body)
    return out


def bary(p, a, b, c):
    """Barycentric weights of p's projection on the triangle abc."""
    v0, v1, v2 = b - a, c - a, p - a
    d00, d01, d11 = v0.dot(v0), v0.dot(v1), v1.dot(v1)
    d20, d21 = v2.dot(v0), v2.dot(v1)
    den = d00 * d11 - d01 * d01
    if abs(den) < 1e-14:
        return (1.0, 0.0, 0.0)
    v = (d11 * d20 - d01 * d21) / den
    w = (d00 * d21 - d01 * d20) / den
    u = 1.0 - v - w
    # clamp to the triangle and renormalise
    u, v, w = max(0.0, u), max(0.0, v), max(0.0, w)
    s = u + v + w or 1.0
    return (u / s, v / s, w / s)


def full_res_normals(full_ob, shape_name, bindings, smap):
    """Per decimated vertex: the full-resolution mesh's smooth normal at the bound point (in that frame's shape)."""
    kb = full_ob.data.shape_keys.key_blocks
    pos = [d.co.copy() for d in kb[shape_name].data]
    me = bpy.data.meshes.new('tmp_normals')
    me.from_pydata([tuple(p) for p in pos], [], [tuple(p.vertices) for p in full_ob.data.polygons])
    for p in me.polygons:
        p.use_smooth = True
    me.update()
    vn = [v.normal.copy() for v in me.vertices]
    bpy.data.meshes.remove(me)
    out = []
    for ti, p in bindings:
        a, b, c = smap.tris[ti]
        u, v, w = bary(p, smap.rest[a], smap.rest[b], smap.rest[c])
        n = vn[a] * u + vn[b] * v + vn[c] * w
        out.append(n.normalized() if n.length > 1e-9 else Vector((0, 0, 1)))
    return out


# ------------------------------------------------------------------ 3. the rig
class Section:
    """Cross-sections of one mesh: a plane cut gives one closed loop of points per limb it crosses. A joint is the
    average of its loop's points, each stored as (edge a, edge b, t) so the same loop is read on another shape of the
    same topology."""

    def __init__(self, me):
        self.edges = [tuple(e.vertices) for e in me.edges]
        key = {tuple(sorted(e)): i for i, e in enumerate(self.edges)}
        self.face_edges = [[key[tuple(sorted(k))] for k in p.edge_keys] for p in me.polygons]

    def loops(self, pos, center, axis, radius=None, side=0):
        n = axis.normalized()
        d = [(p - center).dot(n) for p in pos]
        cross = {}
        for ei, (a, b) in enumerate(self.edges):
            da, db = d[a], d[b]
            if (da > 0) == (db > 0) or da == db:
                continue
            t = da / (da - db)
            p = pos[a].lerp(pos[b], t)
            if radius is not None and (p - center).length > radius:
                continue
            if side and p.x * side <= 0:
                continue
            cross[ei] = (a, b, t, p)
        parent = {e: e for e in cross}

        def find(e):
            while parent[e] != e:
                parent[e] = parent[parent[e]]
                e = parent[e]
            return e
        for fe in self.face_edges:
            hit = [e for e in fe if e in cross]
            for e in hit[1:]:
                ra, rb = find(hit[0]), find(e)
                if ra != rb:
                    parent[ra] = rb
        groups = {}
        for e in cross:
            groups.setdefault(find(e), []).append(cross[e])
        out = []
        for g in groups.values():
            c = Vector((0, 0, 0))
            for s in g:
                c += s[3]
            c /= len(g)
            out.append({'samples': [(s[0], s[1], s[2]) for s in g], 'center': c, 'n': len(g), 'size': max((s[3] - c).length for s in g)})
        return out

    def nearest_loop(self, pos, center, axis, radius=None, side=0, max_size=None):
        ls = [l for l in self.loops(pos, center, axis, radius, side) if max_size is None or l['size'] <= max_size]
        if not ls:
            raise RuntimeError('no loop near %s' % (tuple(round(c, 3) for c in center),))
        return min(ls, key=lambda l: (l['center'] - center).length)


class Joint:
    """The average of a set of samples (edge a, edge b, t) plus an offset scaled with the frame's height."""

    def __init__(self, samples, offset=None):
        self.samples = samples
        self.offset = offset if offset is not None else Vector((0, 0, 0))

    def at(self, pos, scale=1.0):
        c = Vector((0, 0, 0))
        for a, b, t in self.samples:
            c += pos[a].lerp(pos[b], t)
        return c / len(self.samples) + self.offset * scale


def vjoint(idx, offset=None):
    return Joint([(i, i, 0.0) for i in idx], offset)


def fit_joints(me, pos, eye_idx, H):
    """→ {name: Joint} fitted on the broad frame (positions `pos` of mesh `me`); `eye_idx` = (left, right) vertex lists."""
    k = H / 1.794
    S = Section(me)
    J = {}
    Z = Vector((0, 0, 1))

    def v(x, y, z):
        return Vector((x * k, y * k, z * k))

    # the trunk: horizontal cuts; the loop that holds the middle of the body; the joint a little behind its centre
    def trunk(name, z, back=0.25, radius=0.20):
        c = Vector((0, 0, z * k))
        loop = S.nearest_loop(pos, c, Z, radius * k)
        ctr = loop['center']
        ymax = max(pos[a].lerp(pos[b], t).y for a, b, t in loop['samples'])
        target = Vector((0.0, ctr.y + back * (ymax - ctr.y), z * k))
        J[name] = Joint(loop['samples'], target - ctr)

    trunk('pelvis', 0.885)
    trunk('spine', 0.99)
    trunk('chest', 1.13)
    trunk('upperchest', 1.28)
    trunk('neck', 1.425, back=0.15, radius=0.12)
    trunk('head', 1.53, back=0.05, radius=0.12)
    top = max(range(len(pos)), key=lambda i: pos[i].z)
    J['headtop'] = vjoint([top])
    for s, side in (('L', 1), ('R', -1)):
        hip_g, knee_g, ankle_g = v(0.095 * side, 0, 0.86), v(0.10 * side, -0.005, 0.49), v(0.10 * side, 0.02, 0.09)
        leg = (hip_g - ankle_g).normalized()
        loop = S.nearest_loop(pos, hip_g - leg * 0.08 * k, leg, 0.15 * k, side)
        J['hip' + s] = Joint(loop['samples'], Vector((0, 0, hip_g.z - loop['center'].z)))
        loop = S.nearest_loop(pos, knee_g, leg, 0.12 * k, side)
        J['knee' + s] = Joint(loop['samples'])
        loop = S.nearest_loop(pos, ankle_g + Z * 0.035 * k, leg, 0.10 * k, side)
        J['ankle' + s] = Joint(loop['samples'], Vector((0, 0, -0.035 * k)))
        foot = [i for i, p in enumerate(pos) if p.z < 0.06 * k and p.x * side > 0]
        tip = min(foot, key=lambda i: pos[i].y)
        heel = max(foot, key=lambda i: pos[i].y)
        J['toetip' + s] = vjoint([tip], Vector((0, 0, 0.01 * k)))
        ball_y = pos[heel].y + 0.70 * (pos[tip].y - pos[heel].y)
        loop = S.nearest_loop(pos, Vector((pos[tip].x, ball_y, 0.03 * k)), Vector((0, 1, 0)), 0.10 * k, side)
        J['ball' + s] = Joint(loop['samples'], Vector((0, 0, 0.02 * k - loop['center'].z)))
        sh_g, el_g, wr_g = v(0.18 * side, 0.0, 1.355), v(0.30 * side, 0.0, 1.12), v(0.375 * side, 0.0, 0.935)
        up = (el_g - sh_g).normalized()
        loop = S.nearest_loop(pos, sh_g + up * 0.07 * k, up, 0.09 * k, side)
        J['shoulder' + s] = Joint(loop['samples'], -up * 0.07 * k)
        loop = S.nearest_loop(pos, el_g, up, 0.08 * k, side)
        J['elbow' + s] = Joint(loop['samples'])
        fore = (wr_g - el_g).normalized()
        loop = S.nearest_loop(pos, wr_g, fore, 0.07 * k, side)
        J['wrist' + s] = Joint(loop['samples'])
        nb = J['neck'].at(pos)
        loop = S.nearest_loop(pos, Vector((0.03 * side * k, nb.y, nb.z - 0.02 * k)), Vector((1, 0, 0)), 0.20 * k, side)
        J['clavicle' + s] = Joint(loop['samples'], Vector((0.025 * side * k, nb.y, nb.z - 0.02 * k)) - loop['center'])
        fit_hand(S, pos, J, s, side, k)
    for s, idx in (('L', eye_idx[0]), ('R', eye_idx[1])):
        J['eye' + s] = vjoint(list(idx))
    return J


def fit_hand(S, pos, J, s, side, k):
    """Fingers and thumb by cuts across the hand (Phase 5 round 1, after two misses):
    four small loops near the tips, each walked toward the palm in 2 mm steps until it merges with a neighbour (the
    web: its loop jumps in size or centre); the knuckle joint sits a little behind the web. The thumb is the small
    loop in front of the finger chains on a cut through the palm; it is flood-filled to its tip and walked back to
    its own web."""
    W = J['wrist' + s].at(pos)
    E = J['elbow' + s].at(pos)
    hand = [i for i, p in enumerate(pos) if p.x * side > 0 and (p - W).dot((W - E).normalized()) > -0.005 and (p - W).length < 0.25 * k]
    hand_set = set(hand)
    far = max(hand, key=lambda i: (pos[i] - W).length)
    a = (pos[far] - W).normalized()
    tmax = (pos[far] - W).dot(a)
    small = 0.024 * k      # a finger loop measures 1.5–1.9 cm from its centre; the thigh, also cut, 8 cm

    def cut(t, limit=small):
        return [l for l in S.loops(pos, W + a * t, a, 0.12 * k, side) if l['size'] < limit]

    fingers, start = [], None
    seen = []
    for step in range(0, 30):
        tt = tmax - (0.015 + 0.004 * step) * k
        ls = cut(tt)
        seen.append(len(ls))
        if len(ls) >= 4:
            ls.sort(key=lambda l: l['center'].y)
            fingers = ls[-4:]
            start = tt
            break
    if len(fingers) < 4:
        raise RuntimeError('found no cut with four fingers on hand %s: loops per cut %s' % (s, seen))
    fingers.sort(key=lambda l: l['center'].y)
    webs = {}
    def walk(l0, t, jump):
        """Follows one loop toward the wrist until it merges (its size passes 1.8× the median so far, or its centre
        jumps); a knuckle bulge grows a loop ~1.5×, a merge with a neighbour or the palm 2× and more."""
        prev, sizes = l0, [l0['size']]
        while t > 0.01 * k:
            t -= 0.002 * k
            ls = S.loops(pos, W + a * t, a, 0.12 * k, side)
            if not ls:
                break
            best = min(ls, key=lambda l: (l['center'] - prev['center']).length)
            med = sorted(sizes)[len(sizes) // 2]
            if best['size'] > 1.8 * med or (best['center'] - prev['center']).length > jump:
                break
            prev = best
            sizes.append(best['size'])
        return prev

    for name, l0 in zip(('Index', 'Middle', 'Ring', 'Little'), fingers):
        webs[name] = walk(l0, start, 0.007 * k)
    for name in ('Index', 'Middle', 'Ring', 'Little'):
        web = webs[name]
        # the tip: the hand vertex furthest along the hand axis that stays close to this finger's line
        def score(i):
            d = pos[i] - web['center']
            along = d.dot(a)
            off = (d - a * along).length
            return along - 3.0 * off
        tipi = max(hand, key=score)
        tip = pos[tipi]
        axis = (tip - web['center']).normalized()
        J[name + 'MCP' + s] = Joint(web['samples'], -axis * 0.014 * k)
        J[name + 'Tip' + s] = vjoint([tipi])
        mcp = J[name + 'MCP' + s].at(pos)
        fa = tip - mcp
        for jn, f in (('PIP', 0.44), ('DIP', 0.74)):
            loop = S.nearest_loop(pos, mcp + fa * f, fa, 0.03 * k, side, max_size=small * 1.4)
            J[name + jn + s] = Joint(loop['samples'])
    # the thumb: a small loop in front of the finger chains on a cut through the palm
    front_y = min(J[n + 'MCP' + s].at(pos).y for n in ('Index', 'Middle', 'Ring', 'Little'))
    thumb, tcut = None, None
    for step in range(0, 40):
        tt = tmax * (0.25 + 0.015 * step)
        cand = [l for l in cut(tt, 0.022 * k) if l['center'].y < front_y - 0.006 * k]
        if cand:
            thumb, tcut = min(cand, key=lambda l: l['center'].y), tt
            break
    if thumb is None:
        raise RuntimeError('no thumb found on hand %s' % s)
    # flood fill beyond the cut from the loop's vertices → the thumb's far part; the tip is its furthest vertex
    plane_c, n = W + a * tcut, a
    seeds = {x for smp in thumb['samples'] for x in smp[:2] if (pos[x] - plane_c).dot(n) > 0}
    adj = {}
    for e0, e1 in S.edges:
        adj.setdefault(e0, []).append(e1)
        adj.setdefault(e1, []).append(e0)
    region, frontier = set(seeds), list(seeds)
    while frontier:
        cur = frontier.pop()
        for nb in adj.get(cur, ()):
            if nb not in region and nb in hand_set and (pos[nb] - plane_c).dot(n) > 0:
                region.add(nb)
                frontier.append(nb)
    if not region:
        raise RuntimeError('thumb region empty on hand %s' % s)
    tipi = max(region, key=lambda i: (pos[i] - thumb['center']).length)
    tip = pos[tipi]
    # walk the thumb's loop back toward the wrist until it joins the palm: its web
    web = walk(thumb, tcut, 0.008 * k)
    J['ThumbMCP' + s] = Joint(web['samples'])
    mcp = J['ThumbMCP' + s].at(pos)
    J['ThumbCMC' + s] = Joint(web['samples'], (W - mcp) * 0.45 + (mcp - W).dot(a) * Vector((0, 0, 0)))
    ta = tip - mcp
    loop = S.nearest_loop(pos, mcp + ta * 0.55, ta, 0.035 * k, side, max_size=0.022 * k)
    J['ThumbIP' + s] = Joint(loop['samples'])
    J['ThumbTip' + s] = vjoint([tipi])


def joints_to_bones(P, H):
    """Joint positions (one frame) → {bone: (head, tail, roll_target)} for every bone of rig.ALL_BONES."""
    from rig import ALL_BONES, FWD
    k = H / 1.794
    B = {}
    B['Hips'] = (P['pelvis'], P['spine'], FWD)
    B['Spine'] = (P['spine'], P['chest'], FWD)
    B['Chest'] = (P['chest'], P['upperchest'], FWD)
    B['UpperChest'] = (P['upperchest'], P['neck'], FWD)
    B['Neck'] = (P['neck'], P['head'], FWD)
    B['Head'] = (P['head'], Vector((P['head'].x, P['head'].y, P['headtop'].z)), FWD)
    for s, pre, side in (('L', 'Left', 1), ('R', 'Right', -1)):
        B[pre + 'Eye'] = (P['eye' + s], P['eye' + s] + Vector((0, -0.025 * k, 0)), Vector((0, 0, 1)))
        B[pre + 'Shoulder'] = (P['clavicle' + s], P['shoulder' + s], FWD)
        B[pre + 'UpperArm'] = (P['shoulder' + s], P['elbow' + s], FWD)
        B[pre + 'LowerArm'] = (P['elbow' + s], P['wrist' + s], FWD)
        # the palm's normal (out of the palm): across the hand × along it, pointing at the body's middle
        along = (P['MiddleMCP' + s] - P['wrist' + s]).normalized()
        across = (P['IndexMCP' + s] - P['LittleMCP' + s]).normalized()
        n = along.cross(across).normalized()
        if n.x * side > 0:
            n = -n
        B[pre + 'Hand'] = (P['wrist' + s], P['MiddleMCP' + s], n)
        for f in ('Index', 'Middle', 'Ring', 'Little'):
            B[pre + f + 'Proximal'] = (P[f + 'MCP' + s], P[f + 'PIP' + s], n)
            B[pre + f + 'Intermediate'] = (P[f + 'PIP' + s], P[f + 'DIP' + s], n)
            B[pre + f + 'Distal'] = (P[f + 'DIP' + s], P[f + 'Tip' + s], n)
        tn = (n + (P['LittleMCP' + s] - P['IndexMCP' + s]).normalized() * 0.6).normalized()
        B[pre + 'ThumbProximal'] = (P['ThumbCMC' + s], P['ThumbMCP' + s], tn)
        B[pre + 'ThumbIntermediate'] = (P['ThumbMCP' + s], P['ThumbIP' + s], tn)
        B[pre + 'ThumbDistal'] = (P['ThumbIP' + s], P['ThumbTip' + s], tn)
        B[pre + 'UpperLeg'] = (P['hip' + s], P['knee' + s], FWD)
        B[pre + 'LowerLeg'] = (P['knee' + s], P['ankle' + s], FWD)
        B[pre + 'Foot'] = (P['ankle' + s], P['ball' + s], Vector((0, 0, 1)))
        B[pre + 'Toes'] = (P['ball' + s], P['toetip' + s], Vector((0, 0, 1)))
    # optional chains, placed from the body so parts can hang on them
    hb = P['pelvis']
    back = Vector((0, 1, 0))
    t0 = Vector((0, hb.y + 0.09 * k, hb.z - 0.06 * k))
    step = [Vector((0, 0.10, -0.07)), Vector((0, 0.11, -0.05)), Vector((0, 0.11, -0.03)), Vector((0, 0.10, -0.01))]
    p = t0
    for i in range(4):
        q = p + step[i] * k
        B['Tail_%02d' % (i + 1)] = (p, q, Vector((0, 0, 1)))
        p = q
    head = P['head']
    top = P['headtop']
    hh = top.z - head.z
    for s, side in (('L', 1), ('R', -1)):
        e0 = Vector((side * 0.075 * k, head.y + 0.01 * k, head.z + 0.42 * hh))
        B['Ear_' + s] = (e0, e0 + Vector((side * 0.035, 0.02, 0.05)) * k, FWD)
    c0 = Vector((0, head.y - 0.07 * k, head.z + 0.02 * k))
    B['Beard_01'] = (c0, c0 + Vector((0, -0.01, -0.05)) * k, FWD)
    B['Beard_02'] = (B['Beard_01'][1], B['Beard_01'][1] + Vector((0, -0.005, -0.05)) * k, FWD)
    h0 = Vector((0, head.y + 0.09 * k, head.z + 0.55 * hh))
    q = h0
    for i in range(3):
        r = q + Vector((0, 0.02, -0.09)) * k
        B['Hair_%02d' % (i + 1)] = (q, r, back)
        q = r
    missing = [b for b, _ in ALL_BONES if b not in B]
    if missing:
        raise RuntimeError('bones not placed: %s' % missing)
    return B


def add_sockets(arm, P, H, frame):
    """The attachment empties (rig.SOCKETS). Names carry the frame (Socket_HandR.broad) because one .blend holds both;
    the export strips the suffix. A hand socket sits in the palm where a fist closes: +Y out of the thumb side (where a
    held blade points), +Z along the hand toward the knuckles."""
    from rig import add_socket
    k = H / 1.794
    for s, pre, tag in (('L', 'Left', 'HandL'), ('R', 'Right', 'HandR')):
        along = (P['MiddleMCP' + s] - P['wrist' + s]).normalized()
        across = (P['IndexMCP' + s] - P['LittleMCP' + s]).normalized()
        n = along.cross(across).normalized()
        side = 1 if s == 'L' else -1
        if n.x * side > 0:
            n = -n
        loc = P['wrist' + s].lerp(P['MiddleMCP' + s], 0.72) + n * 0.022 * k
        add_socket(arm, 'Socket_%s.%s' % (tag, frame), pre + 'Hand', loc, across, along)
    head, top = P['head'], P['headtop']
    add_socket(arm, 'Socket_Head.%s' % frame, 'Head', Vector((0, head.y, top.z)), Vector((0, 0, 1)), Vector((0, -1, 0)))
    add_socket(arm, 'Socket_Mouth.%s' % frame, 'Head', Vector((0, head.y - 0.10 * k, head.z + 0.05 * k)), Vector((0, -1, 0)), Vector((0, 0, 1)))
    nk = P['neck']
    add_socket(arm, 'Socket_Neck.%s' % frame, 'Neck', Vector((0, nk.y - 0.07 * k, nk.z - 0.02 * k)), Vector((0, 0, -1)), Vector((0, -1, 0)))
    uc = P['upperchest']
    add_socket(arm, 'Socket_Back.%s' % frame, 'UpperChest', Vector((0, uc.y + 0.13 * k, uc.z)), Vector((0, 0, 1)), Vector((0, 1, 0)))
    pv = P['pelvis']
    add_socket(arm, 'Socket_Belt.%s' % frame, 'Hips', Vector((0.15 * k, pv.y, pv.z)), Vector((0.15, -0.35, -1.0)), Vector((1, 0, 0)))
    add_socket(arm, 'Socket_Pet.%s' % frame, 'Hips', Vector((-0.45 * k, 0.10 * k, 0.0)), Vector((0, -1, 0)), Vector((0, 0, 1)))


def build_rigs(full_broad, full_eye_ranges):
    """Fits the joints on the full-resolution broad mesh (dense enough to slice fingers) and reads the same rings on
    its 'slight' shape (one topology); builds both armatures."""
    from rig import build_armature
    kb = full_broad.data.shape_keys.key_blocks
    pos = {'broad': [d.co.copy() for d in kb['Basis'].data], 'slight': [d.co.copy() for d in kb['slight'].data]}
    H = {f: max(p.z for p in pos[f]) for f in pos}
    J = fit_joints(full_broad.data, pos['broad'], full_eye_ranges, H['broad'])
    rigs, joints = {}, {}
    for f in ('broad', 'slight'):
        scale = H[f] / H['broad']
        P = {name: j.at(pos[f], scale) for name, j in J.items()}
        joints[f] = P
        B = joints_to_bones(P, H[f])
        rigs[f] = build_armature('Rig_' + f, B, collection('Character'))
        add_sockets(rigs[f], P, H[f], f)
    log('rig fitted: broad H %.3f, slight H %.3f' % (H['broad'], H['slight']))
    return rigs, joints, J


# ------------------------------------------------------------------ 4. skin, regions, eyes
def skin(body, arm, eye_ranges):
    """Bone-heat weights from the body bones only (eyes and the optional chains held out), then the eyes rigid on
    their bones, 4 influences, normalised."""
    from rig import CHAIN_BONES
    from export import normalize_weights
    held = {b for b, _ in CHAIN_BONES} | {'LeftEye', 'RightEye'}
    for b in arm.data.bones:
        b.use_deform = b.name not in held
    bpy.context.view_layer.update()
    for o in bpy.data.objects:
        if o.name in bpy.context.view_layer.objects:
            o.select_set(False)
    body.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for b in arm.data.bones:
        b.use_deform = True
    for bone, idx in (('LeftEye', eye_ranges[0]), ('RightEye', eye_ranges[1])):
        vg = body.vertex_groups.get(bone) or body.vertex_groups.new(name=bone)
        for i in idx:
            for g in list(body.data.vertices[i].groups):
                body.vertex_groups[g.group].remove([i])
            vg.add([i], 1.0, 'REPLACE')
    for b in arm.data.bones:
        if b.name not in body.vertex_groups:
            body.vertex_groups.new(name=b.name)
    normalize_weights(body, 4)
    unweighted = [v.index for v in body.data.vertices if not v.groups]
    if unweighted:
        log('WARNING %d unweighted vertices; giving them their nearest weighted neighbour' % len(unweighted))
        fix_unweighted(body, unweighted)


def fix_unweighted(body, idx):
    from mathutils.kdtree import KDTree
    me = body.data
    good = [v.index for v in me.vertices if v.groups]
    kd = KDTree(len(good))
    for n, i in enumerate(good):
        kd.insert(me.vertices[i].co, n)
    kd.balance()
    for i in idx:
        _, n, _ = kd.find(me.vertices[i].co)
        src = me.vertices[good[n]]
        for g in src.groups:
            body.vertex_groups[g.group].add([i], g.weight, 'REPLACE')


def copy_weights(src, dst, arm):
    """Same topology: weights copied vertex by vertex; dst parented to its own armature."""
    for vg in src.vertex_groups:
        if vg.name not in dst.vertex_groups:
            dst.vertex_groups.new(name=vg.name)
    for g in list(dst.vertex_groups):
        pass
    names = {vg.index: vg.name for vg in src.vertex_groups}
    for v in src.data.vertices:
        for g in v.groups:
            dst.vertex_groups[names[g.group]].add([v.index], g.weight, 'REPLACE')
    dst.parent = arm
    mod = dst.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm


REGION_OF_BONE = {
    'Head': 'head', 'LeftEye': 'head', 'RightEye': 'head', 'Ear_L': 'head', 'Ear_R': 'head', 'Beard_01': 'head', 'Beard_02': 'head',
    'Hair_01': 'head', 'Hair_02': 'head', 'Hair_03': 'head',
    'Neck': 'neck',
    'UpperChest': 'chest', 'Chest': 'chest', 'LeftShoulder': 'chest', 'RightShoulder': 'chest',
    'Spine': 'belly', 'Hips': 'belly', 'Tail_01': 'belly', 'Tail_02': 'belly', 'Tail_03': 'belly', 'Tail_04': 'belly',
    'LeftUpperArm': 'upperArms', 'RightUpperArm': 'upperArms',
    'LeftLowerArm': 'forearms', 'RightLowerArm': 'forearms',
    'LeftUpperLeg': 'thighs', 'RightUpperLeg': 'thighs',
    'LeftLowerLeg': 'shins', 'RightLowerLeg': 'shins',
    'LeftFoot': 'feet', 'RightFoot': 'feet', 'LeftToes': 'feet', 'RightToes': 'feet',
}


def vertex_regions(body):
    names = {vg.index: vg.name for vg in body.vertex_groups}
    out = []
    for v in body.data.vertices:
        best = max(v.groups, key=lambda g: g.weight, default=None)
        bone = names[best.group] if best else 'Hips'
        if bone not in REGION_OF_BONE:
            region = 'hands'                    # Hand and the finger bones
        else:
            region = REGION_OF_BONE[bone]
        out.append(toon.REGION[region])
    return out


def eye_face_slots(body, eye_ranges):
    """Pupil, iris and sclera by the angle of each eye face from the eye's centre to its front (−Y)."""
    me = body.data
    slots = {}
    for idx in eye_ranges:
        ids = set(idx)
        c = Vector((0, 0, 0))
        for i in idx:
            c += me.vertices[i].co
        c /= len(idx)
        fwd = Vector((0, -1, 0))
        for p in me.polygons:
            if p.vertices[0] not in ids:
                continue
            d = (p.center - c).normalized()
            ang = math.degrees(math.acos(max(-1.0, min(1.0, d.dot(fwd)))))
            slots[p.index] = toon.SLOT['ink'] if ang < EYE_PUPIL_DEG else (toon.SLOT['iris'] if ang < EYE_IRIS_DEG else toon.SLOT['sclera'])
    return slots


EYE_PUPIL_DEG = 13.0
EYE_IRIS_DEG = 29.0


def finish_codes(body, eye_ranges, normals, eye_slots=None):
    """Regions per vertex, eye slots per face, the split along slot borders with the full-resolution normals kept."""
    regions = vertex_regions(body)
    toon.set_vertex_codes(body.data, slots=[toon.SLOT['skin']] * len(body.data.vertices), regions=regions)
    face_slots = {i: toon.SLOT['skin'] for i in range(len(body.data.polygons))}
    face_slots.update(eye_slots if eye_slots is not None else eye_face_slots(body, eye_ranges))
    toon.split_by_face_slots(body, face_slots, normals=normals)


# ------------------------------------------------------------------ 5. review renders
def bone_sticks(arm, name='Sticks'):
    """A mesh of thin boxes along each bone and a ball at each head, in the glow slot, for the skeleton overlay."""
    bm = bmesh.new()
    mw = arm.matrix_world
    for b in arm.data.bones:
        h = mw @ b.head_local
        t = mw @ b.tail_local
        d = t - h
        L = d.length
        if L < 1e-5:
            continue
        r = max(0.0025, min(0.012, L * 0.08))
        geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=r, radius2=r * 0.4, depth=L)
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        for v in geom['verts']:
            v.co = q @ v.co + (h + t) / 2
        sph = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=r * 1.3)
        for v in sph['verts']:
            v.co += h
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    collection('Debug').objects.link(ob)
    toon.ensure_attr(me, slot=toon.SLOT['glow'])
    toon.apply_look(ob, outline=0)
    return ob


TEST_POSE = None


def test_pose():
    from rig import mirrored
    p = mirrored({
        'Spine': (8, 0, 0), 'Chest': (6, 8, 0), 'Neck': (-6, 0, 0), 'Head': (6, 15, 0),
        'LeftUpperArm': (70, 0, 20), 'LeftLowerArm': (95, 0, 0), 'LeftHand': (30, 0, 0),
        'LeftUpperLeg': (45, 0, 4), 'LeftLowerLeg': (-80, 0, 0), 'LeftFoot': (25, 0, 0),
    })
    p['RightUpperArm'] = (-25, 0, -12)
    p['RightLowerArm'] = (40, 0, 0)
    p['RightUpperLeg'] = (-10, 0, -3)
    p['RightLowerLeg'] = (-15, 0, 0)
    for f in ('Index', 'Middle', 'Ring', 'Little'):
        for ph, a in (('Proximal', 70), ('Intermediate', 90), ('Distal', 55)):
            p['Left' + f + ph] = (a, 0, 0)
    for ph, a in (('Proximal', 20), ('Intermediate', 35), ('Distal', 30)):
        p['LeftThumb' + ph] = (a, 0, 0)
    return p


def apply_pose(arm, pose):
    from rig import key_pose
    key_pose(arm, 1, pose)
    bpy.context.scene.frame_set(1)


def review(frames, rigs):
    from render import Stage, load_pixels, save_pixels
    from rig import rest_pose
    import numpy as np
    st = Stage(OUT, size=900 if QUICK else 1200, quick=QUICK)
    for f in ('broad', 'slight'):
        frames[f].hide_render = True
        rigs[f].hide_render = True
    for f in ('broad', 'slight'):
        body, arm = frames[f], rigs[f]
        H = max(v.co.z for v in body.data.vertices)
        body.hide_render = False
        toon.apply_look(body, outline=0.004)
        rest_pose(arm)
        bpy.context.view_layer.update()
        st.card(H, name='card_%s.png' % f)
        st.ortho_sheet(H, name='ortho_%s.png' % f)
        k = H / 1.8
        st.camera((-0.55 * k, -0.75 * k, 1.66 * k), (0.0, 0, 1.6 * k), lens=85)
        st.shot('head_%s.png' % f)
        # skeleton overlay: sticks drawn over the body (two renders composited)
        sticks = bone_sticks(arm, 'Sticks_' + f)
        sticks.hide_render = True
        st.show_platform(False)
        st.sc.render.film_transparent = True
        for view, loc in (('front', (0, -6, H / 2)), ('side', (-6, 0, H / 2))):
            st.camera(loc, (0, 0, H / 2), ortho=H * 1.15)
            p_body = load_pixels(st.shot('_b.png'))
            body.hide_render = True
            sticks.hide_render = False
            p_st = load_pixels(st.shot('_s.png'))
            body.hide_render = False
            sticks.hide_render = True
            a = p_st[..., 3:4]
            out = p_body * 0.55 * (1 - a) + p_st * a
            out[..., 3] = np.maximum(p_body[..., 3], p_st[..., 3])
            bg = np.array([0.012, 0.013, 0.02, 1.0], dtype=np.float32)
            al = out[..., 3:4]
            out = out * al + bg * (1 - al)
            out[..., 3] = 1
            save_pixels(os.path.join(OUT, 'skeleton_%s_%s.png' % (f, view)), out)
        for tmp in ('_b.png', '_s.png'):
            if os.path.exists(os.path.join(OUT, tmp)):
                os.remove(os.path.join(OUT, tmp))
        st.sc.render.film_transparent = False
        st.show_platform(True)
        # hands close-up with the skeleton and the test pose
        apply_pose(arm, test_pose())
        bpy.context.view_layer.update()
        st.card(H, name='pose_test_%s.png' % f)
        st.camera((1.2 * k, -1.6 * k, 1.5 * k), (0.15 * k, -0.2 * k, 1.25 * k), lens=70)
        st.shot('pose_test_hand_%s.png' % f)
        arm.animation_data_clear()
        for act in [x for x in bpy.data.actions if x.users == 0 or x.use_fake_user is False]:
            bpy.data.actions.remove(act)
        rest_pose(arm)
        bpy.context.view_layer.update()
        body.hide_render = True
    for f in ('broad', 'slight'):
        frames[f].hide_render = False


def main():
    clear_scene()
    body, n_body, full, smap, bindings = build_mesh()
    for ob in list(bpy.data.collections['Source'].objects):
        bpy.data.objects.remove(ob)
    eyes = range(n_body, len(body.data.vertices))
    eye_ranges = ([i for i in eyes if body.data.vertices[i].co.x > 0], [i for i in eyes if body.data.vertices[i].co.x < 0])
    frames = split_frames(body)
    normals = {
        'broad': full_res_normals(full['broad'], 'Basis', bindings, smap),
        'slight': full_res_normals(full['broad'], 'slight', bindings, smap),
    }
    fb = full['broad']
    n_full = len(fb.data.vertices)
    n_eye_full = (n_full - FULL_BODY_VERTS) // 2
    full_eyes = range(FULL_BODY_VERTS, n_full)
    kb0 = fb.data.shape_keys.key_blocks['Basis'].data
    full_eye_ranges = ([i for i in full_eyes if kb0[i].co.x > 0], [i for i in full_eyes if kb0[i].co.x < 0])
    rigs, joints, J = build_rigs(fb, full_eye_ranges)
    for ob in list(full.values()):
        bpy.data.objects.remove(ob)
    skin(frames['broad'], rigs['broad'], eye_ranges)
    copy_weights(frames['broad'], frames['slight'], rigs['slight'])
    # the eye pattern is read once, on the broad frame, so both frames split identically (one topology to the end)
    eye_slots = eye_face_slots(frames['broad'], eye_ranges)
    for fr in ('broad', 'slight'):
        finish_codes(frames[fr], eye_ranges, normals[fr], eye_slots)
    assert len(frames['broad'].data.vertices) == len(frames['slight'].data.vertices)
    log('codes: broad %d verts, slight %d verts' % (len(frames['broad'].data.vertices), len(frames['slight'].data.vertices)))
    review(frames, rigs)
    # the review outline is a Solidify: strip it so anything reading the evaluated body sees the real mesh
    toon.remove_outlines()
    save_blend(os.path.join(BUILD, 'hero_body.blend'))


main()

"""spirit_lib.py — the shared helpers of monster pass C (Phase 6): wraith, wisp, tentacle, ooze, leech.

Every build follows tools/blender/README.md (Phase 6 → Monsters): metres, Blender Z up, the monster faces −Y (+z in the
game), its origin on the floor under it; a bone's local Y runs head → tail and its local Z faces the monster's front
(up for bones lying along the floor), so in pose space +X bends a bone toward its Z side; palette slots in `gv`
(R = slot / 15, G = 0 — monsters have no body regions); clips at 30 fps. What this file adds to tools/blender/lib
(which it only imports):

- `MB`, a mesh builder: vertices with per-vertex data (skin weights), faces with palette slots, the slot split
  (`toon.split_by_face_slots`) with a map back to the builder's vertices so weights and shape keys survive it;
- small custom rigs (`make_rig`) and analytic weights along chains (`chain_weights`);
- one action per clip with one slot per animated ID (armature, objects, shape-key blocks): Blender 5.x slotted
  actions let the glTF exporter write each clip as ONE animation with every node's channels (checked: ACTIONS mode,
  merge by action — the default);
- the review set: a lineup against a 1.8 m hero silhouette, clip strips, the 200-px card read and the fight read (the
  fight camera: 41° down, 42° vertical FOV, a 1.8 m hero 27 % of the frame, 1338 × 618 = the phone's internal size);
- the manifest / clips.json merge (other passes' keys are kept).
"""
import json
import math
import os
import subprocess
import sys

import bpy
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(os.path.dirname(HERE), 'lib')
if LIB not in sys.path:
    sys.path.insert(0, LIB)

import common  # noqa: E402
import toon  # noqa: E402
from common import MODELS, REPO, log  # noqa: E402

FPS = 30
MON = os.path.join(MODELS, 'monsters')
os.makedirs(MON, exist_ok=True)
SLOT_NAMES = [s['name'] for s in sorted(toon.PALETTE['slots'], key=lambda s: s['id'])]
# the fixed monster slots the review renders use (README Phase 6 → Colour: 5 ink, 8 leather, 9 metal, 11 glow, 12 wood,
# 13 bone, 14 gem); a monster may override any of them with its manifest entry's `slots` (e.g. a blue glow for eyes)
FIXED = {5: '#15121a', 8: '#6b4428', 9: '#8f969e', 11: '#7fe3ff', 12: '#7a5432', 13: '#e9e0c8', 14: '#fff6e0'}


def args():
    return common.args()


# ====================================================================== palette
def preview(palette3, slots=None):
    """Slot-name → hex for toon.palette_material: slots 0–2 from the monster's palette, the fixed slots, overrides."""
    out = {}
    for i, h in enumerate(palette3[:3]):
        out[SLOT_NAMES[i]] = h
    for i, h in FIXED.items():
        out[SLOT_NAMES[i]] = h
    for i, h in (slots or {}).items():
        out[SLOT_NAMES[int(i)]] = h
    return out


def look(ob, palette3, slots=None, name=None, outline=0.006, cull=True):
    """The review toon material (one per variant palette) and the inverted-hull outline; back faces culled like the
    client's FrontSide material, so a face wound the wrong way shows as a hole in the renders."""
    toon.apply_look(ob, preview(palette3, slots), outline=outline)
    mat = toon.palette_material(preview(palette3, slots), name=name or ('GV_' + ob.name))
    mat.use_backface_culling = cull
    ob.data.materials[0] = mat
    if 'Outline' in ob.modifiers:
        ob.modifiers['Outline'].thickness = outline
    return ob


def set_material(ob, palette3, slots=None, name='GV_var'):
    mat = toon.palette_material(preview(palette3, slots), name=name)
    mat.use_backface_culling = True
    ob.data.materials[0] = mat


def set_outline(objs, thickness):
    for ob in objs:
        if ob.type == 'MESH' and 'Outline' in ob.modifiers:
            ob.modifiers['Outline'].thickness = thickness


# ====================================================================== mesh builder
class MB:
    """Vertices (with per-vertex data: 'w' = {bone: weight}) and faces (with a palette slot each)."""

    def __init__(self):
        self.co = []
        self.data = []
        self.faces = []
        self.slots = []
        self.parts = []          # (name, first face, end face, first vertex, end vertex)
        self._part = None

    def v(self, co, w=None, **kw):
        self.co.append(Vector(co))
        d = {'w': dict(w or {})}
        d.update(kw)
        self.data.append(d)
        return len(self.co) - 1

    def f(self, idx, slot):
        idx = tuple(idx)
        assert len(set(idx)) == len(idx), idx
        self.faces.append(idx)
        self.slots.append(slot)
        return len(self.faces) - 1

    def begin(self, name):
        self._part = (name, len(self.faces), len(self.co))

    def end(self):
        name, f0, v0 = self._part
        self.parts.append((name, f0, len(self.faces), v0, len(self.co)))
        return (f0, len(self.faces))

    # -------- connections
    def bridge(self, a, b, slot, closed=True, flip=False):
        """Quads between two rows of equal length (a below / behind b); `slot` is a value or fn(i) → slot."""
        n = len(a)
        assert n == len(b), (n, len(b))
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            s = slot(i) if callable(slot) else slot
            q = (a[i], a[j], b[j], b[i])
            self.f(q[::-1] if flip else q, s)

    def fan(self, ring, apex, slot, closed=True, flip=False):
        n = len(ring)
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            s = slot(i) if callable(slot) else slot
            t = (ring[i], ring[j], apex)
            self.f(t[::-1] if flip else t, s)

    def face_normal(self, k):
        vs = [self.co[i] for i in self.faces[k]]
        nrm = (vs[1] - vs[0]).cross(vs[2] - vs[0])
        if len(vs) == 4:
            nrm += (vs[2] - vs[0]).cross(vs[3] - vs[0])
        return nrm, sum(vs, Vector()) / len(vs)

    def orient(self, faces, inside):
        """Flips every face of [f0, f1) if most of them face toward `inside` (a point or fn(face centre) → point)."""
        f0, f1 = faces
        score = 0
        for k in range(f0, f1):
            nrm, c = self.face_normal(k)
            p = inside(c) if callable(inside) else Vector(inside)
            score += 1 if nrm.dot(c - p) >= 0 else -1
        if score < 0:
            for k in range(f0, f1):
                self.faces[k] = self.faces[k][::-1]
        return score

    def tris(self):
        return sum(len(f) - 2 for f in self.faces)

    def transform(self, v0, v1, fn):
        for i in range(v0, v1):
            self.co[i] = Vector(fn(self.co[i]))

    # -------- the Blender object
    def build(self, name, col=None, normals=None):
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(c) for c in self.co], [], self.faces)
        me.update()
        ob = bpy.data.objects.new(name, me)
        (col or bpy.context.scene.collection).objects.link(ob)
        at = me.attributes.new('src', 'INT', 'POINT')
        at.data.foreach_set('value', list(range(len(self.co))))
        for p in me.polygons:
            p.use_smooth = True
        toon.ensure_attr(me)
        toon.split_by_face_slots(ob, list(self.slots), normals=normals)
        src = [0] * len(me.vertices)
        me.attributes['src'].data.foreach_get('value', src)
        me.attributes.remove(me.attributes['src'])
        ob['_src'] = src           # weights and keys map back through it; `finish` removes it before export
        return ob


def src_of(ob):
    return list(ob['_src'])


def finish(ob):
    if '_src' in ob.keys():
        del ob['_src']


def apply_weights(ob, mb, arm):
    """Vertex groups from the builder's per-vertex 'w' (≤ 4 influences, normalised); an Armature modifier on `arm`."""
    src = src_of(ob)
    groups = {b.name: ob.vertex_groups.new(name=b.name) for b in arm.data.bones}
    for i, s in enumerate(src):
        w = mb.data[s]['w']
        items = sorted(((k, x) for k, x in w.items() if x > 1e-4), key=lambda t: -t[1])[:4]
        tot = sum(x for _, x in items)
        if tot <= 0:
            raise RuntimeError('%s: vertex %d (builder %d) has no weight' % (ob.name, i, s))
        for k, x in items:
            groups[k].add([i], x / tot, 'REPLACE')
    mod = ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    ob.parent = arm
    return ob


def add_keys(ob, keys):
    """Shape keys from builder positions: keys = [(name, [Vector per builder vertex])]; all at value 0."""
    src = src_of(ob)
    if not ob.data.shape_keys:
        ob.shape_key_add(name='Basis', from_mix=False)
    for name, pos in keys:
        kb = ob.shape_key_add(name=name, from_mix=False)
        kb.value = 0.0         # Blender 5.2 adds keys at 1.0 (art/LOG.md, gear round 6)
        flat = []
        for s in src:
            p = pos[s]
            flat.extend((p[0], p[1], p[2]))
        kb.data.foreach_set('co', flat)
    ob.data.update()
    return ob


# ====================================================================== geometry
def frame_from(t, front):
    """(u, v) with u × v = t and v = −front (so the angle θ = −90° points at `front`)."""
    t = Vector(t).normalized()
    fr = Vector(front)
    v = -(fr - fr.dot(t) * t)
    if v.length < 1e-6:
        v = Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((0, 0, 1))
        v = v - v.dot(t) * t
    v.normalize()
    u = v.cross(t).normalized()
    return u, v


def catmull(points, n_out):
    """A Catmull-Rom curve through `points`, resampled to n_out points evenly by arc length; returns (points, length)."""
    pts = [Vector(p) for p in points]
    dense = []
    ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for k in range(32):
            t = k / 32
            t2, t3 = t * t, t * t * t
            dense.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    dense.append(pts[-1])
    acc = [0.0]
    for a, b in zip(dense, dense[1:]):
        acc.append(acc[-1] + (b - a).length)
    L = acc[-1]
    out = []
    j = 0
    for k in range(n_out):
        s = L * k / (n_out - 1)
        while j < len(acc) - 2 and acc[j + 1] < s:
            j += 1
        seg = acc[j + 1] - acc[j]
        f = 0 if seg < 1e-9 else (s - acc[j]) / seg
        out.append(dense[j].lerp(dense[j + 1], f))
    return out, L


def resample(curve, s_list):
    """Points at arc lengths s_list along a dense polyline."""
    acc = [0.0]
    for a, b in zip(curve, curve[1:]):
        acc.append(acc[-1] + (b - a).length)
    out = []
    for s in s_list:
        j = 0
        while j < len(acc) - 2 and acc[j + 1] < s:
            j += 1
        seg = acc[j + 1] - acc[j]
        f = 0 if seg < 1e-9 else (s - acc[j]) / seg
        out.append(curve[j].lerp(curve[j + 1], max(0.0, min(1.0, f))))
    return out, acc[-1]


def smoothstep(e0, e1, x):
    if e1 == e0:
        return 0.0 if x < e0 else 1.0
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


# ====================================================================== rigs
def make_rig(name, bones, col=None):
    """bones: [(name, head, tail, parent | None, z_dir)] — local Y head → tail, local Z rolled toward z_dir."""
    arm = bpy.data.armatures.new(name)
    ob = bpy.data.objects.new(name, arm)
    (col or bpy.context.scene.collection).objects.link(ob)
    bpy.context.view_layer.update()
    common.set_active(ob)
    bpy.ops.object.mode_set(mode='EDIT')
    ebs = {}
    for bname, head, tail, parent, zdir in bones:
        eb = arm.edit_bones.new(bname)
        eb.head = Vector(head)
        eb.tail = Vector(tail)
        eb.align_roll(Vector(zdir))
        eb.use_deform = True
        if parent:
            eb.parent = ebs[parent]
            eb.use_connect = False
        ebs[bname] = eb
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in ob.pose.bones:
        pb.rotation_mode = 'XYZ'
    arm.display_type = 'STICK'
    return ob


def chain_weights(s, knots, names, blend=0.45):
    """Skin weights at arc length s on a chain whose bone k spans knots[k] → knots[k + 1] (len(knots) = len(names) + 1):
    full weight in a bone's middle, a smoothstep blend with the neighbour over ± `blend` × the shorter bone at each joint."""
    n = len(names)
    s = max(knots[0], min(knots[-1], s))
    w = {}
    for j in range(1, n):            # interior joints
        J = knots[j]
        L = min(knots[j] - knots[j - 1], knots[j + 1] - knots[j]) * blend
        if abs(s - J) < L:
            t = smoothstep(-L, L, s - J)          # 0 → the bone below the joint, 1 → the bone above
            w[names[j - 1]] = w.get(names[j - 1], 0) + (1 - t)
            w[names[j]] = w.get(names[j], 0) + t
            return w
    for k in range(n):
        if knots[k] <= s <= knots[k + 1]:
            return {names[k]: 1.0}
    return {names[-1]: 1.0}


# ====================================================================== animation
def channelbags(act):
    from bpy_extras import anim_utils
    out = []
    for s in act.slots:
        cb = anim_utils.action_get_channelbag_for_slot(act, s)
        if cb is not None:
            out.append(cb)
    return out


def make_cyclic(act):
    for cb in channelbags(act):
        for fc in cb.fcurves:
            if not fc.modifiers:
                fc.modifiers.new('CYCLES')
            fc.update()


def set_interp(act, mode):
    for cb in channelbags(act):
        for fc in cb.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = mode
            fc.update()


def key_pose(arm, frame, pose):
    """Keys every bone at `frame`: pose[bone] = (x, y, z) degrees (XYZ Euler, local); pose[bone + '.loc'] = local
    location (m); pose[bone + '.scl'] = scale (a number or xyz). Bones absent from the pose are keyed at rest."""
    for pb in arm.pose.bones:
        r = pose.get(pb.name, (0, 0, 0))
        pb.rotation_euler = Euler([math.radians(a) for a in r], 'XYZ')
        pb.keyframe_insert('rotation_euler', frame=frame)
        pb.location = pose.get(pb.name + '.loc', (0, 0, 0))
        pb.keyframe_insert('location', frame=frame)
        s = pose.get(pb.name + '.scl', (1, 1, 1))
        pb.scale = (s, s, s) if isinstance(s, (int, float)) else s
        pb.keyframe_insert('scale', frame=frame)


def rest(arm):
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)


def _finish_action(act, keys, loop, interp):
    act.use_frame_range = True
    act.frame_start = 0
    act.frame_end = max(1, round(keys[-1][0] * FPS))
    act.use_cyclic = loop
    act['loop'] = loop
    act.use_fake_user = True
    if interp:
        set_interp(act, interp)
    if loop:
        make_cyclic(act)
    return act


def make_action(arm, name, keys, loop=False, interp=None):
    """keys: [(seconds, pose)] on an armature → an Action (fake user; loops cyclic), left assigned to `arm`."""
    act = bpy.data.actions.new(name)
    adt = arm.animation_data or arm.animation_data_create()
    adt.action = act
    for t, pose in keys:
        key_pose(arm, round(t * FPS), pose)
    if adt.action_slot is None and act.slots:
        adt.action_slot = act.slots[0]
    return _finish_action(act, keys, loop, interp)


def make_node_action(name, keys, loop=False, interp=None):
    """Object-level clip: keys = [(seconds, {object: {'loc': v, 'rot': (deg xyz), 'scl': v | number}})]; one action,
    one slot per object (Blender 5.x), so the glTF exporter writes one animation with every node's channels. Objects
    absent from a key keep their rest transform there."""
    act = bpy.data.actions.new(name)
    obs = []
    for _t, d in keys:
        for ob in d:
            if ob not in obs:
                obs.append(ob)
    rest_tf = {ob: (ob.location.copy(), ob.rotation_euler.copy(), ob.scale.copy()) for ob in obs}
    for ob in obs:
        adt = ob.animation_data or ob.animation_data_create()
        adt.action = act
        loc0, rot0, scl0 = rest_tf[ob]
        for t, d in keys:
            tf = d.get(ob, {})
            ob.location = tf.get('loc', loc0)
            ob.rotation_euler = Euler([math.radians(a) for a in tf['rot']], 'XYZ') if 'rot' in tf else rot0
            s = tf.get('scl', scl0)
            ob.scale = (s, s, s) if isinstance(s, (int, float)) else s
            fr = round(t * FPS)
            ob.keyframe_insert('location', frame=fr)
            ob.keyframe_insert('rotation_euler', frame=fr)
            ob.keyframe_insert('scale', frame=fr)
        ob.location, ob.rotation_euler, ob.scale = loc0, rot0, scl0
    return _finish_action(act, keys, loop, interp)


def make_key_action(name, meshes, keys, loop=False, interp=None):
    """Shape-key clip on meshes that share key names: keys = [(seconds, {key: value})]; one action, one KEY slot per
    mesh. Keys absent from a frame are keyed at 0, so every frame is whole."""
    act = bpy.data.actions.new(name)
    for ob in meshes:
        key = ob.data.shape_keys
        adt = key.animation_data or key.animation_data_create()
        adt.action = act
        kbs = list(key.key_blocks[1:])
        for t, d in keys:
            fr = round(t * FPS)
            for kb in kbs:
                kb.value = d.get(kb.name, 0.0)
                kb.keyframe_insert('value', frame=fr)
        for kb in kbs:
            kb.value = 0.0
    return _finish_action(act, keys, loop, interp)


def slot_for(act, idb):
    """The slot of `act` meant for `idb` (by name, ignoring .001 suffixes), else the first of its type."""
    kind = 'KEY' if isinstance(idb, bpy.types.Key) else 'OBJECT'
    base = idb.name.split('.')[0]
    best = None
    for s in act.slots:
        if s.target_id_type != kind:
            continue
        nm = s.identifier[2:]
        if nm == idb.name:
            return s
        if best is None and nm.split('.')[0] == base:
            best = s
    if best is None:
        for s in act.slots:
            if s.target_id_type == kind:
                return s
    return best


def assign(idb, act, slot_src=None, offset_frames=0):
    """Plays `act` on an ID (armature, object or shape-key block) through its own slot (a second rig given the same
    action needs its action_slot set — art/LOG.md). `slot_src` names the original ID when `idb` is a copy. A loop with
    an offset plays through a repeated NLA strip."""
    adt = idb.animation_data or idb.animation_data_create()
    for t in list(adt.nla_tracks):
        adt.nla_tracks.remove(t)
    slot = slot_for(act, slot_src or idb)
    if not offset_frames:
        adt.action = act
        adt.action_slot = slot
        return
    adt.action = None
    tr = adt.nla_tracks.new()
    n = max(1, int(act.frame_end))
    st = tr.strips.new(act.name, int(-n * 4 + offset_frames), act)
    st.action_slot = slot
    st.repeat = 12.0
    st.extrapolation = 'HOLD'


def unassign(idb):
    adt = idb.animation_data
    if adt:
        adt.action = None
        for t in list(adt.nla_tracks):
            adt.nla_tracks.remove(t)


def stash(idb, acts):
    """Every clip on its own muted NLA track with this ID's slot, so the ACTIONS export writes all of them."""
    adt = idb.animation_data or idb.animation_data_create()
    adt.action = None
    for t in list(adt.nla_tracks):
        adt.nla_tracks.remove(t)
    for act in acts:
        tr = adt.nla_tracks.new()
        tr.name = act.name
        st = tr.strips.new(act.name, 0, act)
        st.name = act.name
        st.action_slot = slot_for(act, idb)
        tr.mute = True


# ====================================================================== review renders
def emission_material(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs[0].default_value = (*rgb, 1)
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


def hero_silhouette(col, name='GV_Hero', color=(0.13, 0.15, 0.19)):
    """The 1.8 m broad hero body from the committed export, flat grey-blue, A-pose: the scale reference."""
    path = os.path.join(MODELS, 'hero', 'hero_broad.glb')
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    body = next(o for o in new if o.type == 'MESH' and o.name.startswith('Body'))
    me = body.data.copy()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    ob.matrix_world = body.matrix_world.copy()
    if me.shape_keys:
        ob.shape_key_clear()
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    me.materials.clear()
    me.materials.append(emission_material(name + '_mat', color))
    return ob


def floor(col, size=60, color=(0.035, 0.04, 0.042), name='GV_Floor', z=0.0):
    me = bpy.data.meshes.new(name)
    s = size / 2
    me.from_pydata([(-s, -s, z), (s, -s, z), (s, s, z), (-s, s, z)], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = 1.0
    me.materials.append(m)
    return ob


class Review:
    """The Stage from lib/render.py plus a floor, a hero silhouette, labels, camera fitting and strips."""

    def __init__(self, out_dir, quick=False, floor_color=(0.035, 0.04, 0.042)):
        import render as R
        self.R = R
        self.out = out_dir
        os.makedirs(out_dir, exist_ok=True)
        self.tmp = os.path.join(out_dir, '_tmp')
        os.makedirs(self.tmp, exist_ok=True)
        self.quick = quick
        self.stage = R.Stage(out_dir, size=512 if quick else 1024, quick=quick, platform=False)
        self.sc = bpy.context.scene
        self.sc.render.fps = FPS
        self.floor = floor(self.stage.col, color=floor_color)
        self.hero = hero_silhouette(self.stage.col)
        self.hero.hide_render = True
        self.labels = []
        cu = bpy.data.curves.new('GV_CamLabel', 'FONT')
        cu.size = 0.03
        self.cam_label = bpy.data.objects.new('GV_CamLabel', cu)
        self.stage.col.objects.link(self.cam_label)
        cu.materials.append(emission_material('GV_LabelMat', (0.85, 0.85, 0.75)))
        self.cam_label.parent = self.stage.cam
        self.cam_label.location = (-0.335, 0.31, -1.0)
        self.cam_label.hide_render = True

    def label3d(self, text, loc, size=0.12, tilt=70):
        cu = bpy.data.curves.new('GV_L', 'FONT')
        cu.body = text
        cu.size = size
        cu.align_x = 'CENTER'
        cu.align_y = 'BOTTOM'          # extra lines grow upward, never into the floor
        ob = bpy.data.objects.new('GV_L', cu)
        self.stage.col.objects.link(ob)
        cu.materials.append(emission_material('GV_LabelMat', (0.85, 0.85, 0.75)))
        ob.location = loc
        ob.rotation_euler = (math.radians(tilt), 0, 0)
        self.labels.append(ob)
        return ob

    def clear_labels(self):
        for ob in self.labels:
            bpy.data.objects.remove(ob, do_unlink=True)
        self.labels = []

    def camera_ortho_off(self):
        cam = self.stage.cam.data
        cam.type = 'PERSP'
        cam.sensor_fit = 'AUTO'

    def fit(self, pts, az=30.0, el=14.0, lens=50, pad=0.08, aspect=1.0):
        """Camera from azimuth / elevation (degrees; az 0 = straight in front, + = from the monster's left) fitted to pts."""
        self.camera_ortho_off()
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))) - Vector((pad, pad, pad))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))) + Vector((pad, pad, pad))
        ctr = (lo + hi) / 2
        a, e = math.radians(az), math.radians(el)
        d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        z = -d
        x = z.cross(Vector((0, 0, 1))).normalized()
        y = x.cross(z).normalized()
        corners = [Vector((cx, cy, cz)) for cx in (lo.x, hi.x) for cy in (lo.y, hi.y) for cz in (lo.z, hi.z)]
        hw = max(abs((c - ctr).dot(x)) for c in corners)
        hh = max(abs((c - ctr).dot(y)) for c in corners)
        depth = max(abs((c - ctr).dot(z)) for c in corners)
        tan_half = 18.0 / lens                       # 36 mm sensor across the wider side
        if aspect >= 1:
            dist_w = hw / tan_half
            dist_h = hh / (tan_half / aspect)
        else:
            dist_w = hw / (tan_half * aspect)
            dist_h = hh / tan_half
        dist = max(dist_w, dist_h) * 1.04 + depth * 0.5
        self.stage.camera(ctr + d * dist, ctr, lens=lens)
        return ctr, dist

    def shot(self, name, size=None, w=None, h=None):
        sc = self.sc
        if w and h:
            sc.render.resolution_x, sc.render.resolution_y = w, h
        elif size:
            sc.render.resolution_x = sc.render.resolution_y = size
        path = os.path.join(self.tmp if name.startswith('_') else self.out, name)
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        sc.render.resolution_x = sc.render.resolution_y = self.stage.size
        return path

    def downscale(self, path, out, size=200):
        img = bpy.data.images.load(path)
        w, h = img.size
        if w >= h:
            img.scale(size, max(1, round(h * size / w)))
        else:
            img.scale(max(1, round(w * size / h)), size)
        img.filepath_raw = out
        img.file_format = 'PNG'
        img.save()
        bpy.data.images.remove(img)
        return out

    def sheet(self, paths, out, cols):
        return self.R.grid_sheet(paths, out, cols)

    def strip(self, name, frames, bounds_fn, place, label_fn, cell=None, az=30.0, el=14.0, lens=50, rows=None):
        """A clip as rows of frames (one row per entry of `rows`, `place(row)` sets the subject up): the camera is fitted
        once to every frame of every row, then each frame is shot with its label."""
        cell = cell or (300 if self.quick else 400)
        rows = rows or [None]
        cells = []
        for ri, row in enumerate(rows):
            place(row)
            pts = []
            for fr in frames:
                self.sc.frame_set(fr)
                pts += bounds_fn(row)
            self.fit(pts, az=az, el=el, lens=lens)
            self.cam_label.hide_render = False
            for i, fr in enumerate(frames):
                self.sc.frame_set(fr)
                self.cam_label.data.body = label_fn(row, fr)
                cells.append(self.shot('_%s_%d_%d.png' % (name, ri, i), size=cell))
        self.cam_label.hide_render = True
        out = os.path.join(self.out, name + '.png')
        self.sheet(cells, out, cols=len(frames))
        for p in cells:
            os.remove(p)
        return out


def world_points(objs, step=1):
    """Evaluated world-space vertices of meshes (skinned, keyed, node-animated) — for camera fitting."""
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for ob in objs:
        if ob.type != 'MESH' or ob.hide_render:
            continue
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world
        co = [0.0] * (3 * len(me.vertices))
        me.vertices.foreach_get('co', co)
        for i in range(0, len(me.vertices), step):
            pts.append(mw @ Vector((co[3 * i], co[3 * i + 1], co[3 * i + 2])))
        ev.to_mesh_clear()
    return pts


# The fight camera (client/src/scene/room.ts and the Cellars templates): pitched 41° down, vertical FOV 42°, a 1.8 m
# hero 27 % of the frame's height; the party on the left (front line x −1.35, back −2.55), the enemies on the right,
# everyone turned 29° toward the camera; the phone's internal render size 892 × 412 CSS px × 1.5 = 1338 × 618.
FIGHT_W, FIGHT_H = 1338, 618
FIGHT_PITCH, FIGHT_FOV = 41.0, 42.0
FIGHT_TURN = math.degrees(math.atan(0.55))


def fight_camera(stage, centre, dist):
    p = math.radians(FIGHT_PITCH)
    loc = Vector(centre) + Vector((0, -math.cos(p), math.sin(p))) * dist
    stage.camera(loc, centre, lens=50)
    cam = stage.cam.data
    cam.sensor_fit = 'VERTICAL'
    cam.angle_y = math.radians(FIGHT_FOV)


def fight_distance(hero_share=0.27):
    """The distance at which a 1.8 m hero is `hero_share` of the frame height, seen 41° from above."""
    h = 1.8 * math.cos(math.radians(FIGHT_PITCH))
    return h / (hero_share * 2 * math.tan(math.radians(FIGHT_FOV / 2)))


def fight_rot(side):
    """Z rotation (degrees) of an actor on the party side (faces +X) or the enemy side (faces −X), turned to the camera."""
    return 90 - FIGHT_TURN if side == 'party' else -90 + FIGHT_TURN


# ====================================================================== export and data
def tri_count(objs):
    return sum(common.tri_count(o) for o in objs if o.type == 'MESH')


def _read(path):
    if not os.path.exists(path):
        return {}
    for attempt in range(3):
        try:
            with open(path, encoding='utf-8') as f:
                return json.load(f)
        except Exception:            # another pass may be mid-write: wait and retry
            import time
            time.sleep(1.5)
    raise RuntimeError('cannot read ' + path)


def write_clips(base, kind, clips, extra=None):
    """client/public/models/monsters/clips.json → bases.<base> = {animation, fps, clips: [{name, seconds, loop, events}]}.
    Other bases (other passes) are kept; if the file keeps bases at its top level, so does this."""
    entry = {'animation': kind, 'fps': FPS, 'clips': clips}
    entry.update(extra or {})
    path = os.path.join(MON, 'clips.json')
    data = _read(path)
    data.setdefault('fps', FPS)
    # one key per base at the top level (the rat pass's layout); an older entry of ours under 'bases' moves up
    if isinstance(data.get('bases'), dict):
        data['bases'].pop(base, None)
        if not data['bases']:
            del data['bases']
    data[base] = entry
    common.write_json(path, data)


NAMES = {'wraith': 'Wraith', 'vault-lantern': 'Vault Lantern', 'wisp': 'Wisp (pet)', 'pet-wisp': 'Wisp (pet)', 'deep-tentacle': 'Deep Tentacle',
         'deep-maw': 'Deep Maw', 'naesa-arm': "Sister Naesa's tentacle arm", 'brine-ooze': 'Brine Ooze',
         'pearl-ooze': 'Pearl Ooze', 'vault-leech': 'Vault Leech'}


def write_manifest(entries):
    """client/public/models/monsters/manifest.json → <monster id> = {base, scale, parts, shapes, palette, clipSpeed, …};
    other passes' ids are kept (under `monsters` if the file has that key, else at the top level)."""
    path = os.path.join(MON, 'manifest.json')
    data = _read(path)
    tgt = data['monsters'] if isinstance(data.get('monsters'), dict) else data
    for k, v in entries.items():
        v = dict(v)
        v.setdefault('name', NAMES.get(k, k))
        if v.get('pet') is True:
            v['pet'] = k            # the pet's content id (content/pets/<id>.json), as the rat pass writes it
        tgt[k] = v
    common.write_json(path, data)


def inspect(path):
    """node tools/blender/inspect-glb.ts on an export, printed into the build log."""
    try:
        out = subprocess.run(['node', os.path.join(REPO, 'tools', 'blender', 'inspect-glb.ts'), path], capture_output=True,
                             text=True, timeout=120, cwd=REPO)
        log('inspect-glb:\n' + out.stdout + out.stderr)
        return out.stdout
    except Exception as e:
        log('inspect-glb failed', e)
        return ''


def strip_rest(objs):
    """Rest state before export: armatures at rest, every shape key at 0."""
    for ob in objs:
        if ob.type == 'ARMATURE':
            rest(ob)
        if ob.type == 'MESH' and ob.data.shape_keys:
            for kb in ob.data.shape_keys.key_blocks[1:]:
                kb.value = 0.0


def write_log(path, lines):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')

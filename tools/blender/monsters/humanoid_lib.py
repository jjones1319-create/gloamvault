"""humanoid_lib.py — the monsters built on the hero rig (Phase 6, monsters pass B; tools/blender/README.md → Monsters).

The humanoid bases (`humanoid`, `skeleton`, `zombie`, `sentinel`, `hollow-king`) hold only meshes skinned to the hero
`Rig` and play the hero clips (`clips: "hero"`). Everything is built on the **broad** frame of
`art/build/hero_species.blend`, opened by `Session`:

- a **low-poly body** (`Session.body_copy`): the hero body decimated (~2.6k triangles with its eyes; the face and hands
  kept denser), weights interpolated by the decimator, slots and regions read back from the full body, normals
  interpolated from the full body's custom normals. Per variant it is cut to what the costume leaves visible
  (`cull_hidden`), re-slotted (skin, eyes, wounds — `paint`) and given its own `var_*` shape keys (`add_key`);
- **costume pieces** built with `gear_loft` (fields, grids, parts — `Session.make`) or **re-used hero gear** from
  `art/build/gear_<class>.blend` (`Session.reuse`: slots re-mapped, faces dropped, optionally decimated);
- **rigid props** (`Kit` → `Session.rigid`): modelled in a socket's space (grip at the origin, +Y along the blade, as
  the hero weapons) or in world space, skinned 100 % to one bone; hero weapons are copied from `art/build/weapons.blend`
  (`Session.weapon`);
- **reviews** (`Review`): a lineup of every variant at its scale beside a 1.8 m hero, the same lineup at the fight
  camera's size, per variant a card and its 200-px read, and hero-clip frames (`art/build/hero_clips.blend`'s
  actions sampled onto the rig, with the variant's pose offsets);
- the **export** (`export_base`: the rig as `Rig` + every piece, extras `kind: "monster"`) and the variant table
  (`write_manifest`, merged into `client/public/models/monsters/manifest.json`).

Palette (README → Monsters → Colour): slots 0/1/2 carry the monster's three colours (content `visual.palette`, else the
`06` Visual line); the rest are this pass's fixed meanings — 3 eye / pale detail · **4 skin** (human flesh that is not
one of the three colours) · 5 ink · 6/7 cloth · 8 leather · 9 metal · 10 trim (brass, rims) · 11 glow · 12 wood ·
13 bone · 14 gem (emissive) · 15 cloth3 / hair. Every manifest entry also carries `colors` (all 16), the palette the
review renders use.
"""
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(TOOLS, 'lib'))
sys.path.insert(0, os.path.join(TOOLS, 'hero'))
import gear_lib as GL  # noqa: E402
import gear_loft as L  # noqa: E402
import toon  # noqa: E402
from common import BUILD, MODELS, RENDERS, REPO, collection, log, save_blend  # noqa: E402

SRC_BLEND = os.path.join(BUILD, 'hero_species.blend')
CLIPS_BLEND = os.path.join(BUILD, 'hero_clips.blend')
WEAPONS_BLEND = os.path.join(BUILD, 'weapons.blend')
OUT_DIR = os.path.join(MODELS, 'monsters')
MANIFEST = os.path.join(OUT_DIR, 'manifest.json')
COL = 'Monster'
SLOT = toon.SLOT
SLOT_NAMES = [s['name'] for s in sorted(toon.PALETTE['slots'], key=lambda s: s['id'])]
D = math.radians

# the client's map from monster clips to hero clips (README → Monsters → Humanoid bases)
CLIP_MAP = {'Idle': 'Idle', 'Move': 'Walk', 'Attack1': 'Attack_Light', 'Attack2': 'Attack_Heavy', 'Hit': 'Hit',
            'Death': 'Defeat', 'Flee': 'Run'}
# hero clip frames shown in the review strips: (clip, frame, label)
STRIP = [('Idle', 30, 'Idle'), ('Walk', 8, 'Move'), ('Attack_Light', 8, 'Attack1 hit'), ('Attack_Heavy', 12, 'Attack2 windup'),
         ('Attack_Heavy', 17, 'Attack2 hit'), ('Hit', 5, 'Hit'), ('Defeat', 54, 'Death end')]


def strip_frames(v):
    """The review strip of a variant: the shared hero-clip frames, plus the frame of each clip its clipMap sends
    Attack1/Attack2 (or a special) to when that is not the default one."""
    frames = list(STRIP)
    seen = set()
    for key, c in v.get('clipMap', {}).items():
        if c in ('Idle', 'Walk', 'Attack_Light', 'Attack_Heavy', 'Hit', 'Defeat') or c in seen:
            continue
        seen.add(c)
        fr = {'Shoot': 15, 'Cast': 24, 'Guard_Shield': 8, 'Guard': 8, 'Roar': 20, 'Run': 5, 'Interact': 18,
              'Revive': 40, 'Victory': 30, 'Attack_Dual': 7, 'Dodge': 8}.get(c, 10)
        frames.append((c, fr, '%s=%s' % (key, c)))
    return frames[:10]


def vec(p):
    return Vector((float(p[0]), float(p[1]), float(p[2])))


def unit(v):
    v = Vector(v)
    return v.normalized() if v.length > 1e-12 else v


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(a, b, x):
    if b == a:
        return 1.0 if x >= a else 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def tris_of(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def apply_modifier(ob, name):
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier=name)


def colors_list(base, over):
    """A 16-entry palette: `base` (list or dict slot → hex) with `over` (dict slot name/index → hex) on top."""
    out = list(base) if isinstance(base, (list, tuple)) else [base.get(i) for i in range(16)]
    for k, v in (over or {}).items():
        i = SLOT[k] if isinstance(k, str) else int(k)
        out[i] = v
    return out


# the fixed monster palette (slots 3–15); every variant overrides what it needs
FIXED = {3: '#e9e2cf', 4: '#c99a78', 5: '#17121a', 6: '#3b3a40', 7: '#8c8273', 8: '#5e3d26', 9: '#7f858c',
         10: '#b9933f', 11: '#7fe3ff', 12: '#6a4a2e', 13: '#e3d6b4', 14: '#9ff3ff', 15: '#4a3a2c'}


def palette(main, second, accent, **over):
    """[16 hex]: slots 0/1/2 from the monster's palette, the fixed meanings for the rest, `over` by slot name."""
    base = [main, second, accent] + [FIXED[i] for i in range(3, 16)]
    return colors_list(base, over)


# ====================================================================== the session
class Session:
    """The hero source opened for one base: the broad body and rig, the gear_loft forge, the pieces made so far."""

    def __init__(self, base, keep_parts=()):
        self.base = base
        bpy.ops.wm.open_mainfile(filepath=SRC_BLEND)
        keep = set(keep_parts)
        for ob in list(bpy.data.objects):
            n = ob.name
            if n.endswith('.slight') or n.endswith('_slight') or n.startswith('Sticks_'):
                bpy.data.objects.remove(ob, do_unlink=True)
            elif ob.type == 'MESH' and n.endswith('.broad') and n not in keep:
                bpy.data.objects.remove(ob, do_unlink=True)
        for c in ('GV_Stage', 'Debug', 'Gear', 'Review', COL):
            col = bpy.data.collections.get(c)
            if col:
                for o in list(col.objects):
                    bpy.data.objects.remove(o, do_unlink=True)
        self.rig = bpy.data.objects['Rig_broad']
        self.body = bpy.data.objects['Body_broad']
        L.rest(self.rig)
        if self.rig.animation_data:
            self.rig.animation_data_clear()
        me = self.body.data
        self.face_keys = {}
        if me.shape_keys:
            kb = me.shape_keys.key_blocks
            basis = np.array([d.co[:] for d in kb[0].data])
            for k in kb[1:]:
                if k.name.startswith('face_'):
                    self.face_keys[k.name] = np.array([d.co[:] for d in k.data]) - basis
            self.body.shape_key_clear()
        for n in keep:
            ob = bpy.data.objects.get(n)
            if ob is not None and ob.data.shape_keys:
                ob.shape_key_clear()
        self.codes = toon.vertex_codes(me)                 # (slot, region) per full-body vertex
        self.bodies = {'broad': GL.Body('broad')}          # no keys: gear is realized without species keys
        self.fg = L.Forge(self.bodies)
        self._K = None
        self.objects = {}                                  # final name -> object
        self.hides = {}                                    # re-used hero piece name -> its `hides` regions
        self.sockets = {s: bpy.data.objects[s + '.broad'] for s in
                        ('Socket_HandR', 'Socket_HandL', 'Socket_Head', 'Socket_Back', 'Socket_Belt', 'Socket_Neck',
                         'Socket_Mouth')}
        self._weapons = None
        log('monsters session %s: body %d tris, face keys %d' % (base, tris_of(self.body), len(self.face_keys)))

    @property
    def K(self):
        if self._K is None:
            self._K = L.Fields(self.fg)
        return self._K

    def joint(self, bone, end='head'):
        b = self.rig.data.bones[bone]
        return self.rig.matrix_world @ (b.head_local if end == 'head' else b.tail_local)

    def bone_matrix(self, bone):
        """The bone's rest matrix in world space (Y along the bone, Z toward the character's front)."""
        return self.rig.matrix_world @ self.rig.data.bones[bone].matrix_local

    def socket(self, name):
        return self.sockets[name].matrix_world.copy()

    def register(self, ob, name, props):
        ob.name = name
        if ob.data is not None:
            ob.data.name = name
        for k, v in props.items():
            ob[k] = v
        ob['tris'] = tris_of(ob)
        self.objects[name] = ob
        return ob

    # ------------------------------------------------------------------ the low-poly body
    def body_copy(self, name, ratio=0.24, face=None, protect=None, factor=0.0):
        """The hero body decimated to about `ratio` of its triangles, as a new object skinned to the rig (uniform by
        default: a test showed protecting the head and hands starves the limbs and leaves specks at the mouth).
        `face` {face key: weight} shapes the head first (the species pass's face keys); `protect` {region: weight
        0–1} (lower keeps more, with `factor` > 0) steers the decimator. Per-vertex `kind` (0 skin, 1 eye) and the
        normals ride along as attributes `_kind`, `_n` until `paint()`."""
        src = self.body
        me = src.data.copy()
        me.name = name
        n0 = len(me.vertices)
        pos = np.array([v.co[:] for v in me.vertices])
        if face:
            for k, w in face.items():
                if k in self.face_keys:
                    pos = pos + w * self.face_keys[k]
            for v, c in zip(me.vertices, pos):
                v.co = c
        ob = bpy.data.objects.new(name, me)
        collection(COL).objects.link(ob)
        if len(ob.vertex_groups) == 0:
            for g in src.vertex_groups:
                ob.vertex_groups.new(name=g.name)
        prot = dict(protect or {})
        pg = ob.vertex_groups.new(name='_decim')
        for i, (s, r) in enumerate(self.codes):
            pg.add([i], float(prot.get(r, 1.0)), 'REPLACE')
        mod = ob.modifiers.new('Decimate', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = ratio
        mod.use_symmetry = True
        mod.symmetry_axis = 'X'
        mod.vertex_group = '_decim'
        mod.vertex_group_factor = factor
        mod.use_collapse_triangulate = True
        apply_modifier(ob, 'Decimate')
        ob.vertex_groups.remove(ob.vertex_groups['_decim'])
        # read slots, regions and normals back from the full body
        full = self.bodies['broad']
        P = [Vector(c) for c in pos]
        tree = BVHTree.FromPolygons(P, full.faces)
        N = full.normals['Basis']
        kinds, regs, nrm = [], [], []
        for v in me.vertices:
            loc, _, fi, _ = tree.find_nearest(v.co)
            # snapped back onto the full body: the collapse decimator puts merged points outside convex skin (up to
            # ~1.5 cm on the chest and shoulders — zombie round 1: skin through an 11 mm tunic)
            v.co = loc
            f = full.faces[fi]
            w = GL._bary(loc, P[f[0]], P[f[1]], P[f[2]])
            n = (N[f[0]] * w[0] + N[f[1]] * w[1] + N[f[2]] * w[2])
            nrm.append(n.normalized() if n.length > 1e-9 else Vector((0, 0, 1)))
            j = f[max(range(3), key=lambda k: w[k])]
            s, r = self.codes[j]
            kinds.append(1 if s in (3, 4, 5) else 0)
            regs.append(r)
        toon.set_vertex_codes(me, slots=[0] * len(me.vertices), regions=regs)
        ka = me.attributes.new('_kind', 'INT', 'POINT')
        na = me.attributes.new('_n', 'FLOAT_VECTOR', 'POINT')
        for i in range(len(me.vertices)):
            ka.data[i].value = kinds[i]
            na.data[i].vector = nrm[i]
        import export as EX
        EX.normalize_weights(ob, 4)
        ob.parent = self.rig
        am = ob.modifiers.new('Armature', 'ARMATURE')
        am.object = self.rig
        log('body copy %s: %d -> %d tris (%d -> %d verts)' % (name, tris_of(src), tris_of(ob), n0, len(me.vertices)))
        return ob

    # ------------------------------------------------------------------ re-used hero gear
    def reuse(self, cls, src_name, name, slot_map=None, drop_slots=(), drop=None, ratio=None, props=None,
              offset=0.0):
        """A hero gear piece from art/build/gear_<cls>.blend (`gear_<cls>_<slot>_<tier>.broad`), re-parented to this
        rig, keys and outlines removed, slots re-mapped (`slot_map` {old: new}), faces dropped (slots in
        `drop_slots`, or `drop(face centre, slot, bone)` true), optionally decimated to `ratio`, `offset` metres
        pushed out along the normals (a thicker shell over a scaled body)."""
        path = os.path.join(BUILD, 'gear_%s.blend' % cls)
        before = set(bpy.data.objects)
        with bpy.data.libraries.load(path, link=False) as (src, dst):
            if src_name not in src.objects:
                raise RuntimeError('%s not in %s' % (src_name, path))
            dst.objects = [src_name]
        ob = dst.objects[0]
        for o in set(bpy.data.objects) - before:
            if o is not ob:
                bpy.data.objects.remove(o, do_unlink=True)
        collection(COL).objects.link(ob)
        for m in list(ob.modifiers):
            if m.type != 'ARMATURE':
                ob.modifiers.remove(m)
        ob.parent = self.rig
        ob.matrix_parent_inverse = Matrix.Identity(4)
        for m in ob.modifiers:
            m.object = self.rig
        if ob.data.shape_keys:
            ob.shape_key_clear()
        ob.data.materials.clear()
        hides = list(ob.get('hides', []) or [])
        for k in list(ob.keys()):
            del ob[k]
        if name:
            self.hides[name] = hides          # the gear pass's own coverage (regions the piece covers by itself)
        me = ob.data
        codes = toon.vertex_codes(me)
        if drop_slots or drop:
            names = {g.index: g.name for g in ob.vertex_groups}
            bm = bmesh.new()
            bm.from_mesh(me)
            dl = bm.verts.layers.deform.verify()
            dead = []
            for f in bm.faces:
                ss = [codes[v.index][0] for v in f.verts]
                s = max(set(ss), key=ss.count)
                if s in drop_slots:
                    dead.append(f)
                    continue
                if drop is not None:
                    acc = {}
                    for v in f.verts:
                        for gi, w in v[dl].items():
                            acc[names.get(gi, '')] = acc.get(names.get(gi, ''), 0.0) + w
                    bone = max(acc, key=acc.get) if acc else ''
                    if drop(f.calc_center_median(), s, bone):
                        dead.append(f)
            bmesh.ops.delete(bm, geom=dead, context='FACES')
            bm.to_mesh(me)
            bm.free()
            me.update()
            codes = toon.vertex_codes(me)
        if slot_map:
            toon.set_vertex_codes(me, slots=[slot_map.get(s, s) for s, _ in codes], regions=[0] * len(codes))
        if ratio:
            decimate_piece(ob, ratio)
        if offset:
            push_along_normals(ob, offset)
        if name:
            self.register(ob, name, props or {})
            self.fg.made[('broad', name)] = ob        # later gear_loft parts may clear it (Part(over=(name,)))
        return ob

    # ------------------------------------------------------------------ hero weapons
    def weapon(self, src_name, name, socket='Socket_HandR', slot_map=None, M=None, props=None, place=None, bone=None):
        """A hero weapon from art/build/weapons.blend held at `socket` (identity transform, as the client holds
        weapons), skinned 100 % to the socket's bone. `M` (socket space) moves it first; `place` (a world matrix
        standing in for the socket's) with `bone` hangs it anywhere (a quiver at the hip)."""
        before = set(bpy.data.objects)
        with bpy.data.libraries.load(WEAPONS_BLEND, link=False) as (src, dst):
            dst.objects = [src_name]
        ob = dst.objects[0]
        for o in set(bpy.data.objects) - before:
            if o is not ob:
                bpy.data.objects.remove(o, do_unlink=True)
        me = ob.data
        codes = toon.vertex_codes(me)
        kit = Kit()
        kit.verts = [v.co.copy() for v in me.vertices]
        kit.faces = [tuple(p.vertices) for p in me.polygons]
        kit.slots = []
        for p in me.polygons:
            ss = [codes[v][0] for v in p.vertices]
            s = max(set(ss), key=ss.count)
            kit.slots.append((slot_map or {}).get(s, s))
        bpy.data.objects.remove(ob, do_unlink=True)
        if M is not None:
            kit.transform(M)
        if place is not None:
            return self.rigid(name, kit, bone=bone, M=place, props=dict(props or {}, hero=src_name), smooth_angle=35)
        return self.rigid(name, kit, socket=socket, props=dict(props or {}, hero=src_name), smooth_angle=35)

    # ------------------------------------------------------------------ rigid pieces
    def rigid(self, name, kit, bone=None, socket=None, M=None, props=None, smooth_angle=40.0, weights=None):
        """A Kit placed in world space (from `socket` space, or by matrix `M`, else as it is) and skinned 100 % to one
        bone (the socket's parent bone by default), or by `weights(world point) -> {bone: w}`."""
        if socket:
            T = self.socket(socket)
            bone = bone or self.sockets[socket].parent_bone
        else:
            T = M if M is not None else Matrix.Identity(4)
        verts = [T @ Vector(v) for v in kit.verts]
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in kit.faces])
        me.update()
        ob = bpy.data.objects.new(name, me)
        collection(COL).objects.link(ob)
        toon.set_vertex_codes(me, slots=[0] * len(me.vertices), regions=[0] * len(me.vertices))
        toon.split_by_face_slots(ob, list(kit.slots))
        set_angle_normals(me, smooth_angle)
        if weights is None:
            vg = ob.vertex_groups.new(name=bone)
            vg.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
        else:
            groups = {}
            for v in me.vertices:
                ws = weights(ob.matrix_world @ v.co)
                s = sum(ws.values()) or 1.0
                for b, w in ws.items():
                    g = groups.get(b) or ob.vertex_groups.new(name=b)
                    groups[b] = g
                    g.add([v.index], w / s, 'REPLACE')
        ob.parent = self.rig
        am = ob.modifiers.new('Armature', 'ARMATURE')
        am.object = self.rig
        self.register(ob, name, dict(props or {}, socket=socket or '', bone=bone or ''))
        return ob

    def multi(self, name, entries, props=None, smooth_angle=62.0):
        """One mesh from several world-space Kits, each skinned 100 % to its bone: entries [(kit, bone)] (a skeleton:
        every bone piece rigid on its own bone, one object for the client to draw)."""
        kit = Kit()
        owner = []
        for k, bone in entries:
            if not k.verts:
                continue
            kit.extend(k)
            owner += [bone] * len(k.verts)
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in kit.verts], [], [tuple(f) for f in kit.faces])
        me.update()
        ob = bpy.data.objects.new(name, me)
        collection(COL).objects.link(ob)
        ow = me.attributes.new('_owner', 'INT', 'POINT')
        names = sorted(set(owner))
        idx = {n: i for i, n in enumerate(names)}
        for i, b in enumerate(owner):
            ow.data[i].value = idx[b]
        toon.set_vertex_codes(me, slots=[0] * len(me.vertices), regions=[0] * len(me.vertices))
        toon.split_by_face_slots(ob, list(kit.slots))
        me = ob.data
        set_angle_normals(me, smooth_angle)
        ow = me.attributes['_owner']
        groups = {}
        for v in me.vertices:
            b = names[ow.data[v.index].value]
            g = groups.get(b) or ob.vertex_groups.new(name=b)
            groups[b] = g
            g.add([v.index], 1.0, 'REPLACE')
        me.attributes.remove(ow)
        ob.parent = self.rig
        am = ob.modifiers.new('Armature', 'ARMATURE')
        am.object = self.rig
        return self.register(ob, name, props or {})

    # ------------------------------------------------------------------ bound (skinned) pieces through gear_loft
    def make(self, name, parts, props=None):
        """gear_loft parts realized on the broad frame and joined into one object (weights from the body)."""
        ob = self.fg.make(name, parts, 'broad', {}, register=name)
        for c in ob.users_collection:
            c.objects.unlink(ob)
        collection(COL).objects.link(ob)
        return self.register(ob, name, props or {})

    def bound(self, key, kit, fidx=None, orient='body', **part_kw):
        """A Kit (world space) as a gear_loft Part bound to the body (every vertex to its nearest triangle among
        `fidx`), so it follows the skin like gear."""
        g = L.Grid()
        g.poly(kit.verts, kit.faces, kit.slots, orient)
        piece = self.fg.piece(key, g, fidx)
        return L.Part(key, piece, **part_kw)


# ====================================================================== mesh helpers
def set_angle_normals(me, angle_deg):
    """Custom normals that are smooth across edges flatter than `angle_deg` (coincident vertices — the palette split —
    count as one), so props keep crisp edges and smooth round parts."""
    me.update()
    cos_t = math.cos(math.radians(angle_deg))
    key, rep = {}, []
    for v in me.vertices:
        k = (round(v.co.x, 6), round(v.co.y, 6), round(v.co.z, 6))
        rep.append(key.setdefault(k, v.index))
    fn = [p.normal.copy() for p in me.polygons]
    around = {}
    for p in me.polygons:
        for vi in p.vertices:
            around.setdefault(rep[vi], []).append(p.index)
    loops = [None] * len(me.loops)
    for p in me.polygons:
        n0 = fn[p.index]
        for li in p.loop_indices:
            r = rep[me.loops[li].vertex_index]
            acc = Vector((0, 0, 0))
            for q in around[r]:
                if fn[q].dot(n0) >= cos_t:
                    acc += fn[q] * me.polygons[q].area
            loops[li] = acc.normalized() if acc.length > 1e-12 else n0
    me.normals_split_custom_set(loops)


def smooth_normals_welded(me):
    """Per-vertex normals averaged over coincident vertices (smooth across the palette seams)."""
    me.update()
    key, rep = {}, []
    for v in me.vertices:
        k = (round(v.co.x, 5), round(v.co.y, 5), round(v.co.z, 5))
        rep.append(key.setdefault(k, v.index))
    acc = {}
    for p in me.polygons:
        for vi in p.vertices:
            r = rep[vi]
            acc[r] = acc.get(r, Vector((0, 0, 0))) + p.normal * p.area
    return [(acc.get(rep[i], Vector((0, 0, 1)))).normalized() for i in range(len(me.vertices))]


def decimate_piece(ob, ratio):
    """Decimates a palette-split piece: its seams welded first (a face attribute keeps each face's slot), collapsed
    with X symmetry, split again, normals smooth across the seams."""
    me = ob.data
    codes = toon.vertex_codes(me)
    fa = me.attributes.get('_fslot') or me.attributes.new('_fslot', 'INT', 'FACE')
    for p in me.polygons:
        ss = [codes[v][0] for v in p.vertices]
        fa.data[p.index].value = max(set(ss), key=ss.count)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()
    me.update()
    # the decimator alone on the stack (the armature comes back after), so applying it is exact
    arms = [m.object for m in ob.modifiers if m.type == 'ARMATURE']
    for m in list(ob.modifiers):
        ob.modifiers.remove(m)
    mod = ob.modifiers.new('Decimate', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = ratio
    mod.use_symmetry = True
    mod.symmetry_axis = 'X'
    mod.use_collapse_triangulate = True
    apply_modifier(ob, 'Decimate')
    for a in arms:
        am = ob.modifiers.new('Armature', 'ARMATURE')
        am.object = a
    me = ob.data
    fa = me.attributes['_fslot']
    slots = [fa.data[p.index].value for p in me.polygons]
    normals = smooth_normals_welded(me)
    toon.set_vertex_codes(me, slots=[0] * len(me.vertices), regions=[0] * len(me.vertices))
    toon.split_by_face_slots(ob, slots, normals=normals)
    me.attributes.remove(me.attributes['_fslot'])
    import export as EX
    EX.normalize_weights(ob, 4)
    return ob


def push_along_normals(ob, d):
    me = ob.data
    ns = smooth_normals_welded(me)
    for v, n in zip(me.vertices, ns):
        v.co = v.co + n * d
    me.update()


def face_centres(me):
    return [p.center.copy() for p in me.polygons]


def camera_dirs(elev=(5.0, 22.0, 40.0), n_az=16):
    """Directions from a figure toward the cameras the game uses: all round, from just below level to 40° above
    (the fight and room cameras sit level or above; nobody looks straight down a collar)."""
    out = []
    for e in elev:
        for k in range(n_az):
            a = 2 * math.pi * (k + 0.5 * (e > 0)) / n_az
            er = math.radians(e)
            out.append(Vector((math.sin(a) * math.cos(er), -math.cos(a) * math.cos(er), math.sin(er))))
    return out


def cull_hidden(ob, covers, reach=0.3, grow=1, keep=None, lift=0.002, min_dot=-0.05, dirs=None, drop_regions=(),
                keep_regions=(), min_escape=2, strict_regions=(), strict_escape=5):
    """Deletes the faces of a body copy that no game camera can see under the `covers` (rest pose). A face is seen
    when at least `min_escape` of the camera directions it faces (`camera_dirs`, d·n > min_dot) are not blocked by a
    cover within `reach`; faces seen from a single direction survive only next to seen ones (`grow` rings), so seams
    that open in a stride keep their skin while skin wholly under cloth goes. `drop_regions` (a hero piece's own
    `hides`) are removed outright, `keep_regions` and `keep(centre, region)` never. Returns the faces removed.
    (Round 1 used a fan round each normal and grew every kept face: rays up the collar and under hems kept ~85 % of a
    robed body.)"""
    drop_set = {toon.REGION[r] if isinstance(r, str) else r for r in drop_regions}
    keep_set = {toon.REGION[r] if isinstance(r, str) else r for r in keep_regions}
    # in regions a costume covers by design (`strict_regions`) skin stays only where it is plainly in view: a few
    # grazing rays out between a sleeve and an armhole kept shoulder skin that pushed through in raised-arm clips
    strict_set = {toon.REGION[r] if isinstance(r, str) else r for r in strict_regions}
    trees = []
    for c in covers:
        me = c.data
        trees.append(BVHTree.FromPolygons([c.matrix_world @ v.co for v in me.vertices], [tuple(p.vertices) for p in me.polygons]))
    me = ob.data
    codes = toon.vertex_codes(me)
    me.update()
    cams = dirs or camera_dirs()
    state = []           # 2 seen, 1 glimpsed (one direction), 0 covered, -1 dropped outright
    for p in me.polygons:
        n = p.normal.copy()
        c = ob.matrix_world @ p.center + n * lift
        reg = codes[p.vertices[0]][1]
        if reg in keep_set or (keep is not None and keep(c, reg)):
            state.append(2)
            continue
        if reg in drop_set:
            state.append(-1)
            continue
        dirs_f = [d for d in cams if d.dot(n) > min_dot]
        if not dirs_f:
            state.append(1)
            continue
        need = strict_escape if reg in strict_set else min_escape
        esc = 0
        for d in dirs_f:
            hit = False
            for t in trees:
                loc, _, _, dist = t.ray_cast(c, d, reach)
                if loc is not None:
                    hit = True
                    break
            if not hit:
                esc += 1
                if esc >= need:
                    break
        if reg in strict_set:
            state.append(2 if esc >= need else 0)
        else:
            state.append(2 if esc >= need else (1 if esc else 0))
    keep_f = [s == 2 for s in state]
    vf = {}
    for p in me.polygons:
        for v in p.vertices:
            vf.setdefault(v, []).append(p.index)
    for _ in range(grow):
        kv = set()
        for p in me.polygons:
            if keep_f[p.index]:
                kv.update(p.vertices)
        for v in kv:
            for f in vf[v]:
                if state[f] == 1:
                    keep_f[f] = True
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    dead = [bm.faces[i] for i, k in enumerate(keep_f) if not k]
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    bm.to_mesh(me)
    bm.free()
    me.update()
    return len(dead)


def cut_faces(ob, pred):
    """Deletes faces where pred(centre, region, bone) is true (bone: the face's strongest weighted bone)."""
    me = ob.data
    codes = toon.vertex_codes(me)
    names = {g.index: g.name for g in ob.vertex_groups}
    dead_idx = []
    for p in me.polygons:
        acc = {}
        for vi in p.vertices:
            for g in me.vertices[vi].groups:
                nm = names.get(g.group, '')
                acc[nm] = acc.get(nm, 0.0) + g.weight
        bone = max(acc, key=acc.get) if acc else ''
        if pred(p.center.copy(), codes[p.vertices[0]][1], bone):
            dead_idx.append(p.index)
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in dead_idx], context='FACES')
    bm.to_mesh(me)
    bm.free()
    me.update()
    return len(dead_idx)


def paint(ob, skin_slot, eye_slot, face_slot=None):
    """Splits a body copy by palette slot: skin faces → `skin_slot`, eye faces → `eye_slot`, and
    `face_slot(centre, normal, region, kind) -> slot or None` for anything else (wounds, gums, stitches)."""
    me = ob.data
    codes = toon.vertex_codes(me)
    ka = me.attributes['_kind']
    na = me.attributes['_n']
    slots = []
    for p in me.polygons:
        kinds = [ka.data[v].value for v in p.vertices]
        kind = max(set(kinds), key=kinds.count)
        s = eye_slot if kind == 1 else skin_slot
        if face_slot is not None:
            r = face_slot(p.center.copy(), p.normal.copy(), codes[p.vertices[0]][1], kind)
            if r is not None:
                s = r
        slots.append(s)
    normals = [Vector(na.data[i].vector) for i in range(len(me.vertices))]
    toon.split_by_face_slots(ob, slots, normals=normals)
    me = ob.data
    for a in ('_kind', '_n'):
        if me.attributes.get(a):
            me.attributes.remove(me.attributes[a])
    return ob


def add_key(ob, name, fn):
    """A shape key `name` (value 0): each vertex moved by fn(co, region) -> Vector (rest space). Coincident
    vertices move together (fn sees only the position and region)."""
    me = ob.data
    if not me.shape_keys:
        ob.shape_key_add(name='Basis')
    codes = toon.vertex_codes(me)
    kb = ob.shape_key_add(name=name)
    kb.value = 0.0
    for i, v in enumerate(me.vertices):
        kb.data[i].co = v.co + fn(v.co.copy(), codes[i][1])
    return kb


def bone_weight_map(ob):
    names = {g.index: g.name for g in ob.vertex_groups}
    out = []
    for v in ob.data.vertices:
        out.append({names[g.group]: g.weight for g in v.groups if g.weight > 1e-4})
    return out


def seg_closest(p, a, b):
    ab = b - a
    L2 = ab.length_squared
    t = 0.0 if L2 < 1e-12 else max(0.0, min(1.0, (p - a).dot(ab) / L2))
    return a + ab * t, t


class RadialField:
    """A displacement field over the rig: every vertex moves away from (k > 0) or toward (k < 0) the axis of each
    bone it is weighted to, by k × its distance, blended by its weights — so a key built from it keeps the joints
    still and gives every skinned piece (body, rags, straps) the same change: `var_bulk`, `var_gaunt`."""

    def __init__(self, sess, factors, extra=None):
        self.k = dict(factors)
        self.segs = {b: (sess.joint(b), sess.joint(b, 'tail')) for b in sess.rig.data.bones.keys()}
        self.extra = extra              # extra(co, region) -> Vector, added after

    def __call__(self, co, weights, region=0):
        d = Vector((0, 0, 0))
        for b, w in weights.items():
            k = self.k.get(b, 0.0)
            if not k or b not in self.segs:
                continue
            a, t = self.segs[b]
            c, _ = seg_closest(co, a, t)
            d += (co - c) * (k * w)
        if self.extra is not None:
            d += self.extra(co, region)
        return d


def add_field_key(ob, name, field):
    """A shape key from a RadialField (or any field(co, weights, region)), on any skinned mesh."""
    W = bone_weight_map(ob)
    me = ob.data
    if not me.shape_keys:
        ob.shape_key_add(name='Basis')
    codes = toon.vertex_codes(me)
    kb = ob.shape_key_add(name=name)
    kb.value = 0.0
    for i, v in enumerate(me.vertices):
        kb.data[i].co = v.co + field(v.co.copy(), W[i], codes[i][1])
    return kb


# ====================================================================== a small mesh kit for props
class Kit:
    """Vertices, faces and per-face palette slots in some local space; primitives append to it."""

    def __init__(self):
        self.verts, self.faces, self.slots = [], [], []

    def tris(self):
        return sum(len(f) - 2 for f in self.faces)

    def add(self, verts, faces, slot):
        b = len(self.verts)
        self.verts += [Vector(v) for v in verts]
        for f in faces:
            self.faces.append(tuple(b + i for i in f))
            self.slots.append(slot(f) if callable(slot) else slot)
        return b

    def extend(self, other):
        b = len(self.verts)
        self.verts += [v.copy() for v in other.verts]
        self.faces += [tuple(b + i for i in f) for f in other.faces]
        self.slots += list(other.slots)
        return self

    def transform(self, M):
        self.verts = [M @ v for v in self.verts]
        return self

    def copy(self):
        k = Kit()
        return k.extend(self)

    def mirrored_x(self):
        k = Kit()
        k.verts = [Vector((-v.x, v.y, v.z)) for v in self.verts]
        k.faces = [tuple(reversed(f)) for f in self.faces]
        k.slots = list(self.slots)
        return k

    # -- primitives (all faces wound outward)
    def rings(self, rings, slot, closed=True, cap0=None, cap1=None, flip=False):
        """Quads between consecutive rings (closed rings are turned counter-clockwise about the direction they advance
        in, so the faces look out of the tube); optional caps (an apex point or 'flat'); `flip` turns every face of
        this call inward (flanges, linings)."""
        f_start = len(self.faces)
        m = len(rings[0])
        rings = [[Vector(p) for p in r] for r in rings]
        if closed and len(rings) >= 2 and m >= 3:
            # rings must turn counter-clockwise about the direction they advance in, or every face looks inward
            c0 = sum(rings[0], Vector((0, 0, 0))) / m
            c1 = sum(rings[-1], Vector((0, 0, 0))) / m
            nrm = Vector((0, 0, 0))
            r0 = rings[0]
            for k in range(m):
                a, bb = r0[k], r0[(k + 1) % m]
                nrm.x += (a.y - bb.y) * (a.z + bb.z)
                nrm.y += (a.z - bb.z) * (a.x + bb.x)
                nrm.z += (a.x - bb.x) * (a.y + bb.y)
            if nrm.dot(c1 - c0) < 0:
                rings = [[r[0]] + r[1:][::-1] for r in rings]
        b = len(self.verts)
        for r in rings:
            self.verts += [Vector(p) for p in r]
        cols = m if closed else m - 1
        for i in range(len(rings) - 1):
            for j in range(cols):
                a = b + i * m + j
                c = b + i * m + (j + 1) % m
                d = b + (i + 1) * m + (j + 1) % m
                e = b + (i + 1) * m + j
                self.faces.append((a, c, d, e))
                self.slots.append(slot(i, j) if callable(slot) else slot)
        for cap, ring_i, rev in ((cap0, 0, True), (cap1, len(rings) - 1, False)):
            if cap is None:
                continue
            base = b + ring_i * m
            cs = slot(-1, 0) if callable(slot) else slot
            if isinstance(cap, str):
                f = tuple(base + j for j in range(m))
                self.faces.append(tuple(reversed(f)) if rev else f)
                self.slots.append(cs)
            else:
                ai = len(self.verts)
                self.verts.append(Vector(cap))
                for j in range(m):
                    f = (base + j, base + (j + 1) % m, ai)
                    self.faces.append(tuple(reversed(f)) if rev else f)
                    self.slots.append(cs)
        if flip:
            for i in range(f_start, len(self.faces)):
                self.faces[i] = tuple(reversed(self.faces[i]))
        return b

    def lathe(self, profile, n, slot, axis=Vector((0, 1, 0)), centre=Vector((0, 0, 0)), ref=None, cap0=None, cap1=None,
              phase=0.0, scale_xz=(1.0, 1.0), flip=False):
        """Revolves profile [(radius, height)] about `axis` through `centre` with n sides."""
        a = unit(axis)
        r0 = unit(ref if ref is not None else (Vector((1, 0, 0)) if abs(a.x) < 0.9 else Vector((0, 0, 1))))
        u = unit(r0 - a * r0.dot(a))
        v = a.cross(u)
        rings = []
        for rad, h in profile:
            ring = []
            for k in range(n):
                t = phase + 2 * math.pi * k / n
                ring.append(Vector(centre) + a * h + u * (rad * math.cos(t) * scale_xz[0]) + v * (rad * math.sin(t) * scale_xz[1]))
            rings.append(ring)
        c0 = cap0 if (cap0 is None or isinstance(cap0, Vector) or cap0 != 'apex') else Vector(centre) + a * profile[0][1]
        c1 = cap1 if (cap1 is None or isinstance(cap1, Vector) or cap1 != 'apex') else Vector(centre) + a * profile[-1][1]
        return self.rings(rings, slot, True, c0, c1, flip=flip)

    def tube(self, path, radii, n, slot, cap0='flat', cap1='flat', ref=None, scale_xz=(1.0, 1.0), twist=0.0):
        """A tube along a polyline `path` with radius per point (number or list); rings perpendicular to the path
        (parallel-transported frames)."""
        pts = [Vector(p) for p in path]
        rs = radii if isinstance(radii, (list, tuple)) else [radii] * len(pts)
        tangents = []
        for i in range(len(pts)):
            a = pts[max(0, i - 1)]
            b = pts[min(len(pts) - 1, i + 1)]
            tangents.append(unit(b - a))
        t0 = tangents[0]
        u = unit(ref if ref is not None else t0.orthogonal())
        u = unit(u - t0 * u.dot(t0))
        rings = []
        for i, (p, t, r) in enumerate(zip(pts, tangents, rs)):
            u = unit(u - t * u.dot(t))
            v = t.cross(u)
            ring = []
            for k in range(n):
                ang = 2 * math.pi * k / n + twist * i
                ring.append(p + u * (r * math.cos(ang) * scale_xz[0]) + v * (r * math.sin(ang) * scale_xz[1]))
            rings.append(ring)
        c0 = pts[0] - tangents[0] * rs[0] if (isinstance(cap0, str) and cap0 == 'apex') else cap0
        c1 = pts[-1] + tangents[-1] * rs[-1] if (isinstance(cap1, str) and cap1 == 'apex') else cap1
        return self.rings(rings, slot, True, c0, c1)

    def box(self, c, x, y, z, slot):
        c = Vector(c)
        x, y, z = Vector(x), Vector(y), Vector(z)
        vs = [c + sx * x + sy * y + sz * z for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)]
        fs = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
        # wind outward whatever the handedness of x, y, z
        if x.cross(y).dot(z) < 0:
            fs = [tuple(reversed(f)) for f in fs]
        return self.add(vs, fs, slot)

    def sphere(self, c, r, n_u=8, n_v=5, slot=0, scale=(1, 1, 1), axis_z=None):
        """A UV sphere (n_v rings between the poles), optionally squashed by `scale` in its own frame."""
        c = Vector(c)
        zax = unit(axis_z) if axis_z is not None else Vector((0, 0, 1))
        xax = unit(zax.orthogonal())
        yax = zax.cross(xax)
        rings = []
        for i in range(1, n_v):
            th = math.pi * i / n_v
            ring = []
            for k in range(n_u):
                ph = 2 * math.pi * k / n_u
                p = (xax * (math.sin(th) * math.cos(ph) * scale[0]) + yax * (math.sin(th) * math.sin(ph) * scale[1])
                     - zax * (math.cos(th) * scale[2])) * r
                ring.append(c + p)
            rings.append(ring)
        return self.rings(rings, slot, True, c - zax * r * scale[2], c + zax * r * scale[2])

    def cone(self, base_c, tip, r, n, slot, base_slot=None):
        a = unit(Vector(tip) - Vector(base_c))
        u = unit(a.orthogonal())
        v = a.cross(u)
        ring = [Vector(base_c) + (u * math.cos(2 * math.pi * k / n) + v * math.sin(2 * math.pi * k / n)) * r for k in range(n)]
        b = len(self.verts)
        self.verts += ring
        ti = len(self.verts)
        self.verts.append(Vector(tip))
        for k in range(n):
            self.faces.append((b + k, b + (k + 1) % n, ti))
            self.slots.append(slot)
        self.faces.append(tuple(reversed([b + k for k in range(n)])))
        self.slots.append(base_slot if base_slot is not None else slot)
        return b

    def torus(self, c, axis, R, r, n_major, n_minor, slot):
        a = unit(axis)
        u = unit(a.orthogonal())
        v = a.cross(u)
        rings = []
        for i in range(n_major):
            t = 2 * math.pi * i / n_major
            d = u * math.cos(t) + v * math.sin(t)
            centre = Vector(c) + d * R
            ring = []
            for k in range(n_minor):
                s = 2 * math.pi * k / n_minor
                ring.append(centre + (d * math.cos(s) + a * math.sin(s)) * r)
            rings.append(ring)
        b = len(self.verts)
        for ring in rings:
            self.verts += ring
        for i in range(n_major):
            for k in range(n_minor):
                i2, k2 = (i + 1) % n_major, (k + 1) % n_minor
                self.faces.append((b + i * n_minor + k, b + i2 * n_minor + k, b + i2 * n_minor + k2, b + i * n_minor + k2))
                self.slots.append(slot)
        return b

    def slab(self, outline, thick, slot, rim_slot=None, origin=Vector((0, 0, 0)), x=Vector((1, 0, 0)),
             y=Vector((0, 1, 0)), bevel=0.0):
        """A flat shape: a 2-D outline (counter-clockwise points in the x/y plane of a frame) extruded `thick` along
        x × y, centred; the faces fan from the outline's centroid (convex or star-shaped outlines)."""
        x, y = unit(x), unit(y)
        z = x.cross(y)
        o = Vector(origin)
        pts = [Vector(p) for p in outline]
        area = sum(pts[k].x * pts[(k + 1) % len(pts)].y - pts[(k + 1) % len(pts)].x * pts[k].y for k in range(len(pts)))
        if area < 0:
            pts = pts[::-1]
        cx = sum((p.x for p in pts)) / len(pts)
        cy = sum((p.y for p in pts)) / len(pts)
        top = [o + x * p.x + y * p.y + z * (thick / 2) for p in pts]
        bot = [o + x * p.x + y * p.y - z * (thick / 2) for p in pts]
        ct = o + x * cx + y * cy + z * (thick / 2)
        cb = o + x * cx + y * cy - z * (thick / 2)
        n = len(pts)
        b = len(self.verts)
        self.verts += top + bot + [ct, cb]
        it, ib = b + 2 * n, b + 2 * n + 1
        for k in range(n):
            k2 = (k + 1) % n
            self.faces.append((b + k, b + k2, it))
            self.slots.append(slot)
            self.faces.append((b + n + k2, b + n + k, ib))
            self.slots.append(slot)
            self.faces.append((b + k2, b + k, b + n + k, b + n + k2))
            self.slots.append(rim_slot if rim_slot is not None else slot)
        return b

    def chain(self, path, link_len, wire, slot, alt_slot=None, n_major=6, n_minor=3, width=None):
        """Chain links along a polyline: flattened rings alternating 90° about the path."""
        pts = [Vector(p) for p in path]
        seg = []
        for a, b in zip(pts, pts[1:]):
            seg.append((a, b, (b - a).length))
        total = sum(s[2] for s in seg)
        n = max(1, int(total / (link_len * 0.82)))
        w = width or link_len * 0.55
        for i in range(n):
            s = (i + 0.5) / n * total
            acc = 0.0
            for a, b, l in seg:
                if acc + l >= s or (a, b, l) == seg[-1]:
                    t = (s - acc) / l if l > 1e-9 else 0.0
                    p = a.lerp(b, min(1.0, t))
                    d = unit(b - a)
                    break
                acc += l
            up = unit(d.orthogonal())
            side = d.cross(up)
            if i % 2:
                up, side = side, up
            # an elongated ring in the plane (d, side) with its normal `up`
            b0 = len(self.verts)
            ring_c = []
            for k in range(n_major):
                t = 2 * math.pi * k / n_major
                ring_c.append((math.cos(t), math.sin(t)))
            rings = []
            for cx_, cy_ in ring_c:
                centre = p + d * (cx_ * link_len / 2) + side * (cy_ * w / 2)
                rad = unit(d * cx_ * (w / link_len) + side * cy_) if (cx_ or cy_) else side
                ring = []
                for k in range(n_minor):
                    a2 = 2 * math.pi * k / n_minor
                    ring.append(centre + (rad * math.cos(a2) + up * math.sin(a2)) * wire)
                rings.append(ring)
            for ring in rings:
                self.verts += ring
            for i2 in range(n_major):
                for k in range(n_minor):
                    j2, k2 = (i2 + 1) % n_major, (k + 1) % n_minor
                    self.faces.append((b0 + i2 * n_minor + k, b0 + j2 * n_minor + k, b0 + j2 * n_minor + k2, b0 + i2 * n_minor + k2))
                    self.slots.append(alt_slot if (alt_slot is not None and i % 2) else slot)
        return self


# ====================================================================== poses and clips
def action_fcurves(act):
    out = []
    try:
        for layer in act.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    out.extend(cb.fcurves)
    except AttributeError:
        out = list(act.fcurves)
    return out


def load_clips(names=None):
    have = set(a.name for a in bpy.data.actions)
    with bpy.data.libraries.load(CLIPS_BLEND, link=False) as (src, dst):
        want = [n for n in src.actions if (names is None or n in names) and n not in have]
        dst.actions = want
    return {a.name: a for a in bpy.data.actions}


def sample_clip(act, frame):
    """{bone: ('rot', [x, y, z] radians) or ('loc', [x, y, z])} at `frame` from a hero clip action."""
    out = {}
    for fc in action_fcurves(act):
        dp = fc.data_path
        if not dp.startswith('pose.bones["'):
            continue
        bone = dp[len('pose.bones["'):dp.index('"]')]
        prop = dp[dp.index('"].') + 3:]
        d = out.setdefault((bone, prop), [0.0, 0.0, 0.0])
        if fc.array_index < 3:
            d[fc.array_index] = fc.evaluate(frame)
    return out


def pose_rig(rig, clip=None, frame=0, add=None, hold=None, bone_scales=None):
    """Puts a hero-clip frame on the rig without an action (so nothing re-evaluates it), then the variant's pose
    offsets: `add` {bone: (x, y, z) degrees} composed after the clip's rotation (pose = clip × add), `hold` {bone:
    (x, y, z) degrees} replacing it; `bone_scales` (species groups, absolute) via gear_loft."""
    vals = sample_clip(clip, frame) if clip is not None else {}
    for pb in rig.pose.bones:
        mode = pb.rotation_mode
        e = vals.get((pb.name, 'rotation_euler'), [0.0, 0.0, 0.0])
        q = Euler(e, mode).to_quaternion()
        if hold and pb.name in hold:
            q = Euler([math.radians(a) for a in hold[pb.name]], mode).to_quaternion()
        elif add and pb.name in add:
            q = q @ Euler([math.radians(a) for a in add[pb.name]], mode).to_quaternion()
        pb.rotation_euler = q.to_euler(mode)
        if pb.name == 'Hips':
            loc = vals.get(('Hips', 'location'), [0.0, 0.0, 0.0])
            if hold and 'Hips.loc' in hold:
                loc = hold['Hips.loc']
            pb.location = loc
        else:
            pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    rig.scale = (1, 1, 1)
    if bone_scales:
        L.apply_bone_scales(rig, bone_scales)
    bpy.context.view_layer.update()


def gltf_quat(bone_mode_euler_deg, mode):
    """A pose rotation (degrees, the bone's Euler mode) as the quaternion [x, y, z, w] the client composes onto the
    joint. Checked against hero_clips.glb: every exported channel (root included) is `rest × pose` with the pose
    quaternion unswizzled, so `poseAdd` is `joint.quaternion.multiply(q)` after the mixer and `poseHold` is
    `joint.quaternion = restQuaternion × q`."""
    q = Euler([math.radians(a) for a in bone_mode_euler_deg], mode).to_quaternion()
    return [round(q.x, 5), round(q.y, 5), round(q.z, 5), round(q.w, 5)]


# ====================================================================== reviews
class Review:
    """The review renders of one base (art/renders/monsters/<base>/)."""

    def __init__(self, sess, quick=True):
        from render import Stage
        self.sess = sess
        self.base = sess.base
        self.quick = quick
        self.out = os.path.join(RENDERS, 'monsters', sess.base)
        os.makedirs(self.out, exist_ok=True)
        self.st = Stage(self.out, size=560 if quick else 900, quick=quick)
        self.st.sc.render.fps = 30
        self.mats = {}
        self.clips = load_clips()
        self.label = self._label()
        self.hero = None

    def _label(self):
        cu = bpy.data.curves.new('GV_Label', 'FONT')
        cu.size = 0.03
        ob = bpy.data.objects.new('GV_Label', cu)
        self.st.col.objects.link(ob)
        m = bpy.data.materials.new('GV_LabelMat')
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        o = nt.nodes.new('ShaderNodeOutputMaterial')
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs[0].default_value = (0.85, 0.85, 0.75, 1)
        nt.links.new(em.outputs[0], o.inputs[0])
        cu.materials.append(m)
        ob.parent = self.st.cam
        ob.location = (-0.31, 0.285, -1.0)
        ob.hide_render = True
        return ob

    def material(self, key, colors):
        if key in self.mats:
            return self.mats[key]
        pre = {SLOT_NAMES[i]: colors[i] for i in range(16)}
        m = toon.palette_material(pre, name='GV_Mon_%s' % key)
        m.use_backface_culling = True
        self.mats[key] = m
        return m

    def look(self, objs, key, colors, outline=0.005):
        mat = self.material(key, colors)
        for ob in objs:
            me = ob.data
            me.materials.clear()
            me.materials.append(mat)
            me.materials.append(toon.outline_material())
            for p in me.polygons:
                p.material_index = 0
            if outline and 'Outline' not in ob.modifiers:
                so = ob.modifiers.new('Outline', 'SOLIDIFY')
                so.thickness = outline
                so.offset = 1.0
                so.use_flip_normals = True
                so.use_rim = False
                so.material_offset = 1
                so.use_quality_normals = True

    def hero_ref(self):
        """The plain hero body in flat grey (the 1.8 m reference in the lineups)."""
        if self.hero is None:
            src = self.sess.body
            me = src.data.copy()
            ob = bpy.data.objects.new('GV_HeroRef', me)
            self.st.col.objects.link(ob)
            m = bpy.data.materials.new('GV_HeroRefMat')
            m.use_nodes = True
            nt = m.node_tree
            nt.nodes.clear()
            o = nt.nodes.new('ShaderNodeOutputMaterial')
            em = nt.nodes.new('ShaderNodeEmission')
            em.inputs[0].default_value = (0.16, 0.17, 0.2, 1)
            nt.links.new(em.outputs[0], o.inputs[0])
            me.materials.clear()
            me.materials.append(m)
            ob.hide_render = True
            self.hero = ob
        return self.hero

    def show(self, objs):
        keep = {o.name for o in objs}
        for o in bpy.data.objects:
            if o.type in ('MESH', 'CURVE') and not o.name.startswith('GV_'):
                o.hide_render = o.name not in keep
        if self.hero is not None:
            self.hero.hide_render = self.hero.name not in keep

    def pose(self, v, clip=None, frame=0):
        act = self.clips.get(clip) if clip else None
        pose_rig(self.sess.rig, act, frame, add=v.get('poseAdd'), hold=v.get('poseHold'), bone_scales=v.get('boneScales'))
        s = v.get('scale', 1.0) * (v.get('boneScales', {}).get('root', 1.0) if v.get('boneScales') else 1.0)
        self.sess.rig.scale = (s, s, s)
        bpy.context.view_layer.update()

    def rest(self):
        L.rest(self.sess.rig)

    def cell_camera(self, h, az=38.0, el=14.0, fill=1.0, target_z=None):
        """A perspective camera from the front-left, framing a figure of height h (metres)."""
        k = h / 1.8 * fill
        tz = target_z if target_z is not None else 0.52 * h
        d = 3.3 * k
        a, e = math.radians(az), math.radians(el)
        loc = Vector((-math.sin(a) * math.cos(e) * d, -math.cos(a) * math.cos(e) * d, tz + math.sin(e) * d))
        self.st.camera(loc, Vector((0.0, 0.0, tz)), lens=55)

    def card(self, v, objs, name):
        self.show(objs)
        self.pose(v, 'Idle', 30)
        h = v['height']
        self.cell_camera(h, az=34, el=16, fill=1.12)
        p = self.st.shot(name)
        small = p.replace('.png', '_200.png')
        downscale(p, 200, small)
        self.rest()
        return p, small

    def heads(self, variants, name, az=32.0, zoom=1.0):
        """Close-ups of every variant's head at rest (masks, skulls, helms, faces), in one row."""
        from render import grid_sheet
        paths = []
        self.label.hide_render = False
        for i, v in enumerate(variants):
            self.show(v['objs'])
            self.pose(v, 'Idle', 30)
            s = v.get('scale', 1.0) * (v.get('boneScales', {}) or {}).get('root', 1.0)
            # aim at the posed head (hunched monsters carry it low and forward)
            rig = self.sess.rig
            pb = rig.pose.bones['Head']
            hm = rig.matrix_world @ pb.matrix
            centre = hm @ Vector((0, pb.length * 0.42, 0.0))
            face = (hm.to_3x3() @ Vector((0, 0, 1))).normalized()
            face.z = 0.0
            face = face.normalized() if face.length > 1e-6 else Vector((0, -1, 0))
            d = 0.95 * s / zoom
            a = math.radians(-az)
            rot = Matrix.Rotation(a, 3, 'Z')
            loc = centre + (rot @ face) * d + Vector((0, 0, 0.08 * s))
            self.st.camera(loc, centre + Vector((0, 0, -0.03 * s)), lens=50)
            self.label.data.body = v['id']
            paths.append(self.st.shot('_head_%d.png' % i, size=360 if self.quick else 480))
        self.label.hide_render = True
        self.rest()
        out = os.path.join(self.out, name)
        grid_sheet(paths, out, cols=len(paths))
        for p in paths:
            os.remove(p)
        return out

    def strip(self, v, objs, frames, name, cell=None):
        """Hero-clip frames of one variant in a row (labelled)."""
        from render import grid_sheet
        cell = cell or (300 if self.quick else 420)
        self.show(objs)
        self.label.hide_render = False
        paths = []
        h = v['height']
        for i, (clip, fr, lab) in enumerate(frames):
            self.pose(v, clip, fr)
            down = clip in ('Defeat', 'Downed', 'SitRest')
            self.cell_camera(h, az=40, el=22 if down else 12, fill=1.25 if down else 1.12,
                             target_z=0.3 * h if down else None)
            self.label.data.body = '%s\n%s f%d' % (v['id'], lab, fr)
            paths.append(self.st.shot('_strip_%d.png' % i, size=cell))
        self.label.hide_render = True
        self.rest()
        out = os.path.join(self.out, name)
        grid_sheet(paths, out, cols=len(paths))
        for p in paths:
            os.remove(p)
        return out

    def lineup(self, entries, name, hmax, px=900, az=25.0, label=True):
        """entries: [(variant dict or None for the hero, objs)] rendered one by one with the same orthographic scale
        (so heights compare) and composited left to right. Also writes `<name>_fight.png`, downscaled so a 1.8 m
        hero is ~110 px tall (a fight on the phone frames a hero at about a quarter of the screen)."""
        st = self.st
        sc = st.sc
        ortho = hmax * 1.12
        w = int(px * 0.62)
        sc.render.resolution_x, sc.render.resolution_y = w, px
        sc.render.film_transparent = True
        st.show_platform(False)
        a = math.radians(az)
        cam_loc = Vector((-math.sin(a) * 12, -math.cos(a) * 12, ortho * 0.5 + 0.9))
        st.camera(cam_loc, Vector((0, 0, ortho * 0.5 - 0.08)), ortho=ortho)
        lab = self.label
        # an orthographic portrait frame spans `ortho` in height and ortho·w/px in width (camera space)
        lab.data.size = 0.024 * ortho
        lab.location = (-0.47 * ortho * w / px, -0.43 * ortho, -1.0)
        cells = []
        for i, (v, objs) in enumerate(entries):
            if v is None:
                ref = self.hero_ref()
                self.show([ref])
                self.rest()
                text = 'hero 1.80 m'
            else:
                self.show(objs)
                self.pose(v, 'Idle', 30)
                text = '%s\n%.2f m  %d tris' % (v['id'], v['height'], v.get('tris', 0))
            if label:
                lab.data.body = text
                lab.hide_render = False
            sc.render.filepath = os.path.join(self.out, '_lu_%02d.png' % i)
            bpy.ops.render.render(write_still=True)
            cells.append(sc.render.filepath)
        lab.hide_render = True
        lab.data.size = 0.03
        lab.location = (-0.31, 0.285, -1.0)
        self.rest()
        sc.render.film_transparent = False
        st.show_platform(True)
        sc.render.resolution_x = sc.render.resolution_y = st.size
        out = os.path.join(self.out, name)
        composite_row(cells, out)
        for c in cells:
            os.remove(c)
        # the fight-distance read
        fight = out.replace('.png', '_fight.png')
        scale = 110.0 / (px * 1.8 / ortho)
        img = bpy.data.images.load(out)
        W, H = img.size
        img.scale(max(1, int(W * scale)), max(1, int(H * scale)))
        img.filepath_raw = fight
        img.file_format = 'PNG'
        img.save()
        bpy.data.images.remove(img)
        return out, fight


def _evaluated_world(ob):
    """World positions of an object's evaluated mesh (armature applied, the review outline switched off)."""
    mods = [m for m in ob.modifiers if m.type == 'SOLIDIFY']
    for m in mods:
        m.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    pts = [ob.matrix_world @ v.co for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    ev.to_mesh_clear()
    for m in mods:
        m.show_viewport = True
    return pts, polys


def poke_report(rv, v, body, covers, frames=None, depth=0.002, reach=0.03):
    """Skin through cloth, counted: at each strip frame, body vertices lying more than `depth` outside the nearest
    cover surface within `reach` (the cover's normals face out). Returns [(label, count)]."""
    out = []
    for clip, fr, lab in (frames or STRIP):
        rv.pose(v, clip, fr)
        bpts, _ = _evaluated_world(body)
        trees = []
        for c in covers:
            pts, polys = _evaluated_world(c)
            trees.append(BVHTree.FromPolygons(pts, polys))
        n = 0
        for p in bpts:
            for t in trees:
                loc, nrm, _, dist = t.find_nearest(p, reach)
                if loc is not None and (p - loc).dot(nrm) > depth:
                    n += 1
                    break
        out.append((lab, n))
    rv.rest()
    return out


NOT_COVERS = ('props', 'claws', 'teeth', 'kelp', 'facebarnacles', 'barnacles', 'net', 'hair', 'mask', 'pearls',
              'tentacle', 'core', 'helm', 'sword', 'chains', 'straps', 'bell', 'lantern', 'circlet', 'mantlebells')


def poke_lines(rv, vs):
    """`poke_report` for every variant that has a body under a costume, as log lines (also written to
    art/build/monsters_<base>_pokes.txt)."""
    lines = []
    for v in vs:
        body = next((o for o in v['objs'] if o.name.endswith('_body') or o.name.endswith('_inner')), None)
        if body is None:
            continue
        covers = [o for o in v['objs'] if o is not body and o.get('piece', '') not in NOT_COVERS]
        if not covers:
            continue
        res = poke_report(rv, v, body, covers)
        lines.append('- %s (body %d verts under %s): %s' % (v['id'], len(body.data.vertices),
                                                          ', '.join(o.name.split('_', 2)[-1] for o in covers),
                                                          ' · '.join('%s %d' % (lab, n) for lab, n in res)))
    if lines:
        write_log_lines(os.path.join(BUILD, 'monsters_%s_pokes.txt' % rv.base), lines)
        for ln in lines:
            log('pokes', ln)
    return lines


def downscale(path, size, out):
    img = bpy.data.images.load(path)
    img.scale(size, size)
    img.filepath_raw = out
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)
    return out


def composite_row(paths, out, bg=(0.012, 0.013, 0.02), gap=14):
    from render import load_pixels, save_pixels
    cols = []
    H = None
    for p in paths:
        px = load_pixels(p)
        H = px.shape[0]
        a = px[..., 3]
        xs = np.nonzero(a.max(0) > 0.02)[0]
        if len(xs) == 0:
            continue
        x0, x1 = max(0, xs[0] - gap), min(px.shape[1], xs[-1] + gap)
        cols.append(px[:, x0:x1])
    sheet = np.concatenate(cols, axis=1)
    bgc = np.array([*bg, 1.0], dtype=np.float32)
    a = sheet[..., 3:4]
    sheet = sheet * a + bgc * (1 - a)
    sheet[..., 3] = 1.0
    save_pixels(out, sheet)
    return out


# ====================================================================== export and manifest
def export_base(sess, objects, extra_props=None):
    """client/public/models/monsters/<base>.glb: the rig as `Rig` and every piece (skinned), outlines and review
    materials removed, extras on every node."""
    from export import export_glb, prepare_for_export
    rig = sess.rig
    L.rest(rig)
    if rig.animation_data:
        rig.animation_data_clear()
    objs = list(objects)
    prepare_for_export(objs)
    for ob in objs:
        ob.data.materials.clear()
        ob['kind'] = 'monster'
        ob['base'] = sess.base
        ob['clips'] = 'hero'
        for k, v in (extra_props or {}).items():
            ob[k] = v
    clash = [o for o in bpy.data.objects if o.name == 'Rig']
    for o in clash:
        o.name = o.name + '.hold'
    old = rig.name
    try:
        rig.name = 'Rig'
        kb = export_glb(os.path.join(OUT_DIR, sess.base + '.glb'), [rig] + objs)
    finally:
        rig.name = old
        for o in clash:
            o.name = o.name[: -len('.hold')]
    return kb


def write_manifest(entries):
    """Merges {monster id: entry} into manifest.json (other passes' keys are kept)."""
    os.makedirs(OUT_DIR, exist_ok=True)
    data = {}
    if os.path.exists(MANIFEST):
        try:
            with open(MANIFEST, encoding='utf-8') as f:
                data = json.load(f)
        except Exception:
            data = {}
    data.update(entries)
    with open(MANIFEST, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')
    log('manifest: %d entries (%d ours)' % (len(data), len(entries)))


def manifest_entry(v, parts, rig):
    """The variant table entry (README → Monsters → the variant table) plus this pass's extras."""
    e = {
        'base': v['base'],
        'scale': v.get('scale', 1.0),
        'parts': list(parts),
        'shapes': dict(v.get('shapes', {})),
        'palette': list(v['colors'][:3]),
        'colors': list(v['colors']),
        'clips': 'hero',
        'clipMap': dict(CLIP_MAP, **v.get('clipMap', {})),
        'clipSpeed': v.get('clipSpeed', 1.0),
        'tris': v.get('tris', 0),
        'height': round(v['height'], 3),
    }
    if v.get('boneScales'):
        e['boneScales'] = v['boneScales']
    pa = {}
    for b, rot in (v.get('poseAdd') or {}).items():
        pa[b] = gltf_quat(rot, rig.pose.bones[b].rotation_mode)
    ph = {}
    for b, rot in (v.get('poseHold') or {}).items():
        if b == 'Hips.loc':
            continue
        ph[b] = gltf_quat(rot, rig.pose.bones[b].rotation_mode)
    if pa:
        e['poseAdd'] = pa
    if ph:
        e['poseHold'] = ph
    for k in ('phases', 'props', 'notes', 'sockets'):
        if v.get(k):
            e[k] = v[k]
    return e


def write_log_lines(path, lines):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')


def reimport_check(base):
    """The exported .glb re-imported into an empty scene (lib/export.py): meshes, armature, colour attribute, morphs —
    written to art/build/monsters_<base>_check.txt with a Workbench render in the base's render folder. Wipes the
    session, so it runs last."""
    import export as EX
    path = os.path.join(OUT_DIR, base + '.glb')
    render = os.path.join(RENDERS, 'monsters', base, 'reimport_check.png')
    lines = EX.reimport_report(path, render)
    write_log_lines(os.path.join(BUILD, 'monsters_%s_check.txt' % base), lines)
    for ln in lines[:4]:
        log(ln)
    return lines

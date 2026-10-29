"""pet_lib.py — what the two Drowned Vault pet bases (`build_crab.py`, `build_imp.py`) share (Phase 7, pets pass E).

`creature_lib.py` (monsters pass A) is the kit: implicit bodies, `CRig`, `Clip`, `Monster` and its review renders. This
module changes nothing in it for anyone else; it adds what a pet base needs on top:

- **The game's 16 colours.** `game_colors()` fills the palette exactly as the client does
  (`client/src/scene/monsters/manifest.ts` → `monsterPaletteHexes`: the three content colours in slots 0–2, the trim and
  gem slots following the accent, the contract's fixed ink / leather / metal / glow / bone …, the entry's own `slots`
  over them), and every review render of this process uses it — so a pearl in the gem slot glows in the render the way it
  glows in the game.
- **`PetBase(Monster)`**: a card sheet (four views at Idle, the two attacks at their events), a lineup beside the 1.8 m
  hero silhouette and every other pet read from its shipped `.glb` and manifest entry, clip checks over the body *and*
  the variant's parts, the `clips.json` / `manifest.json` entries (merged under creature_lib's lock, other keys
  untouched), and the re-import check of the exported file with a render.
"""
import math
import os
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import creature_lib as C  # noqa: E402
import toon  # noqa: E402

FPS = C.FPS

# client/src/scene/monsters/manifest.ts → monsterPaletteHexes: the fixed slots of an own-rig monster or pet
GAME_FIXED = {3: '#ffd24a', 4: '#f2ece2', 5: '#1a1218', 6: '#5a4636', 7: '#7a6a52', 8: '#5e3d26', 9: '#8a8f98',
              11: '#ffe08a', 12: '#7a5432', 13: '#e8dcc0', 15: '#3a3440'}
SLOT_NAMES = [s['name'] for s in sorted(toon.PALETTE['slots'], key=lambda s: s['id'])]
# the order the pets are listed in 06 §9 (the lineup follows it)
PET_ORDER = ['cellar-hound', 'rat-prince', 'spiderling', 'crypt-bat', 'bone-pup', 'wisp', 'brine-crab', 'vault-imp']


def game_colors(palette3, slots=None):
    """The 16 colours the client gives a monster or pet: palette in 0–2, accent also in 10 (trim) and 14 (gem)."""
    p = [palette3[i] if i < len(palette3) else palette3[0] for i in range(3)]
    out = [p[0], p[1], p[2]] + [GAME_FIXED[i] for i in range(3, 10)] + [p[2], GAME_FIXED[11], GAME_FIXED[12],
                                                                         GAME_FIXED[13], p[2], GAME_FIXED[15]]
    for k, c in (slots or {}).items():
        i = int(k)
        if 0 <= i < 16:
            out[i] = c
    return out


def preview(v):
    """A variant's review colours by slot name (toon.palette_material), exactly the game's."""
    cols = game_colors(v['palette'], v.get('slots'))
    return {SLOT_NAMES[i]: cols[i] for i in range(16)}


# creature_lib's review renders colour a snapshot with `preview_for(variant)` (slots 0–2 and glow only); a pet's
# renders must show the gem slot as the game does. This rebinding lives only in this Blender process.
C.preview_for = preview


def strip_suffix(name):
    """'hound_body.001' → 'hound_body' (a second import of one base gets numbered names)."""
    head, dot, tail = name.rpartition('.')
    return head if dot and tail.isdigit() else name


def part_shown(mesh_name, base, parts):
    """client/src/scene/monsters/manifest.ts → partShown, for an own-rig base."""
    name = strip_suffix(mesh_name)
    short = name[len(base) + 1:] if name.startswith(base + '_') else name
    if name in (base + '_body', base, 'body'):
        return True
    if parts is None:
        return True
    return short in parts or name in parts


def codes_from_import(ob):
    """An imported mesh's COLOR_0 (the importer's `Color`, per corner, bytes) → our `gv` attribute (point, whole codes)."""
    me = ob.data
    src = None
    for a in me.color_attributes:
        if a.name != toon.ATTR:
            src = a
            break
    slots = [0] * len(me.vertices)
    regions = [0] * len(me.vertices)
    if src is not None:
        if src.domain == 'CORNER':
            for l in me.loops:
                c = src.data[l.index].color
                slots[l.vertex_index] = int(round(c[0] * 15))
                regions[l.vertex_index] = int(round(c[1] * 15))
        else:
            for i, d in enumerate(src.data):
                slots[i] = int(round(d.color[0] * 15))
                regions[i] = int(round(d.color[1] * 15))
    toon.set_vertex_codes(me, slots, regions)
    return slots


def import_glb(path):
    """Imports a .glb; returns (new objects, new actions)."""
    before = set(bpy.data.objects)
    before_act = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    bpy.context.scene.render.fps = FPS
    new = [o for o in bpy.data.objects if o not in before]
    acts = [a for a in bpy.data.actions if a not in before_act]
    return new, acts


def pose_imported(objects, actions, clip='Idle', frame=0):
    """Puts every imported animated object on the action named `clip` (the importer numbers repeated names) at `frame`."""
    act = None
    for a in actions:
        if strip_suffix(a.name) == clip:
            act = a
            break
    for o in objects:
        ad = o.animation_data
        if ad is None:
            continue
        ad.action = None
        if act is None:
            continue
        slot = None
        for s in act.slots:
            if s.name_display == o.name or s.identifier == 'OB' + o.name:
                slot = s
                break
        if slot is None and o.type == 'ARMATURE' and len(act.slots) == 1:
            slot = act.slots[0]
        if slot is not None:
            ad.action = act
            ad.action_slot = slot
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    return act


def remove_objects(objects, actions=()):
    for o in objects:
        if o.name not in bpy.data.objects:
            continue
        d = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if d is not None and d.users == 0:
            if isinstance(d, bpy.types.Mesh):
                bpy.data.meshes.remove(d)
            elif isinstance(d, bpy.types.Armature):
                bpy.data.armatures.remove(d)
    for a in actions:
        if a.name in bpy.data.actions:
            bpy.data.actions.remove(a)


def shipped_pet_snapshot(key, entry, tag=''):
    """Another pet as the game shows it: its base's .glb, its manifest entry's parts and shapes, Idle frame 0, the game's
    colours, a static copy under a root empty scaled to the entry. Returns (root, tris) or (None, 0)."""
    path = os.path.join(C.MON, entry['base'] + '.glb')
    if not os.path.exists(path):
        return None, 0
    new, acts = import_glb(path)
    parts = entry.get('parts')
    shapes = entry.get('shapes') or {}
    v = {'id': key, 'palette': entry.get('palette') or ['#6a5a4a', '#d9d2c2', '#c8a040'], 'slots': entry.get('slots') or {}}
    meshes = []
    for o in new:
        if o.type != 'MESH' or any(c.name == 'glTF_not_exported' for c in o.users_collection):
            continue
        if not part_shown(o.name, entry['base'], parts):
            continue
        codes_from_import(o)
        keys = o.data.shape_keys
        if keys:
            for kb in keys.key_blocks[1:]:
                kb.value = float(shapes.get(strip_suffix(kb.name), 0.0))
        meshes.append(o)
    pose_imported(new, acts, 'Idle', 0)
    root = bpy.data.objects.new('GV_P_' + key + tag, None)
    col = bpy.data.collections.get('GV_Snap') or bpy.data.collections.new('GV_Snap')
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    col.objects.link(root)
    tris = 0
    for o in meshes:
        st = C.snapshot(o, 'GV_S_%s_%s%s' % (key, strip_suffix(o.name), tag))
        C.look(st, preview(v), key, outline=0.006 / float(entry.get('scale', 1.0)))
        st.parent = root
        tris += sum(len(p.vertices) - 2 for p in st.data.polygons)
    remove_objects(new, acts)
    root.scale = (float(entry.get('scale', 1.0)),) * 3
    return root, tris


def world_points(root):
    pts = []
    bpy.context.view_layer.update()
    for ch in root.children:
        if ch.type == 'MESH':
            M = np.array(ch.matrix_world)
            co = np.empty(len(ch.data.vertices) * 3)
            ch.data.vertices.foreach_get('co', co)
            co = co.reshape(-1, 3)
            pts.append(co @ M[:3, :3].T + M[:3, 3])
    return np.concatenate(pts) if pts else np.zeros((1, 3))


class PetBase(C.Monster):
    """A pet's base: creature_lib's Monster with the pet pass's reviews, checks and tables."""

    def __init__(self, base, quick=False):
        super().__init__(base, quick)
        self.slots_of = {}            # variant id → {slot: colour} written to the manifest
        self.extra_clips = {}         # clips.json extras for this base (rig, bones)

    # ------------------------------------------------------------ checks (the body and the variant's parts)
    def check_clips(self):
        lines = ['## %s clip checks (body + the pet\'s parts)' % self.base, '']
        v0 = self.variants[0]
        self.set_variant(v0)
        shown = [ob for ob in self.meshes() if ob is self.body or ob.name in v0.get('parts', [])]
        for c in self.clips:
            self.rig.assign(bpy.data.actions[c.name])
            lows = []
            who = []
            for f in range(c.frames() + 1):
                bpy.context.scene.frame_set(f)
                best = None
                for ob in shown:
                    co = C.evaluated_coords(ob)
                    i = int(co[:, 2].argmin())
                    if best is None or co[i, 2] < best[0]:
                        best = (co[i, 2], ob, i)
                lows.append(best[0])
                who.append(best)
            lows = np.array(lows)
            fmin = int(lows.argmin())
            _, ob, vi = who[fmin]
            vg = {g.index: g.name for g in ob.vertex_groups}
            vv = ob.data.vertices[vi]
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
                la = a.get('Root.loc', (0, 0, 0))
                lb = b.get('Root.loc', (0, 0, 0))
                closure = ' · loop closure %.3f deg, %.4f m' % (worst, max(abs(x - y) for x, y in zip(la, lb)))
            ev = ', '.join('%s %.2f s' % (k, x) for k, x in c.events.items())
            lines.append('- %s (%.2f s%s): lowest point min %.1f cm (f%d, %s on %s) / max %.1f cm · worst IK residual '
                         '%.1f cm%s' % (c.name, c.seconds, (', ' + ev) if ev else '', lows.min() * 100, fmin, low_bone,
                                        ob.name, lows.max() * 100, res * 100, closure))
            c.low = lows
        self.rig.ob.animation_data.action = None
        self.rig.rest_pose()
        bpy.context.scene.frame_set(0)
        self.lines += lines
        for line in lines:
            C.log(line)
        return lines

    def location_channels(self):
        """Which bones carry location keys in the baked actions (the contract: Root only)."""
        out = set()
        for c in self.clips:
            act = bpy.data.actions[c.name]
            for fc in C.channelbag(act).fcurves:
                if fc.data_path.endswith('.location'):
                    out.add(fc.data_path.split('"')[1])
        return sorted(out)

    # ------------------------------------------------------------ renders
    def event_time(self, clip_name):
        c = self.clip(clip_name)
        for k in ('hit', 'release'):
            if k in c.events:
                return c.events[k], k
        return c.seconds / 2, 'mid'

    def render_cards(self, st):
        """The card sheet: Idle from 3/4, front, side and behind; Attack1 and Attack2 at their events. card.png is the
        3/4 cell at full size, card_200.png its 200-px read, cards_200.png the sheet at 200 px a cell."""
        from render import grid_sheet
        sc = bpy.context.scene
        cell = 420 if self.quick else 560
        tmp = os.path.join(self.out, '_tmp')
        os.makedirs(tmp, exist_ok=True)
        v = self.variants[0]
        t1, e1 = self.event_time('Attack1')
        t2, e2 = self.event_time('Attack2')
        az, el = self.card_view['az'], self.card_view['el']
        shots = [('Idle', 0, az, el, '3/4'), ('Idle', 0, 0.0, 6.0, 'front'), ('Idle', 0, 90.0, 6.0, 'side'),
                 ('Idle', 0, 155.0, 24.0, 'behind'), ('Attack1', round(t1 * FPS), az, el, e1),
                 ('Attack2', round(t2 * FPS), az, el, e2)]
        label = C.cam_label(st, size=0.03)
        cells = []
        for i, (clip_name, fr, a, e, tag) in enumerate(shots):
            self.clear_snaps()
            C.floor()
            root = self.variant_snapshot(v, clip_name, fr)
            root.scale = (1, 1, 1)
            bpy.context.view_layer.update()
            P = self.snap_points(root)
            sc.render.resolution_x = sc.render.resolution_y = cell
            C.place_camera(st, P, az=a, el=e, lens=50, margin=1.12)
            label.data.body = '%s  %s f%d  %s' % (v['name'], clip_name, fr, tag)
            p = os.path.join(tmp, 'card_%d.png' % i)
            sc.render.filepath = p
            bpy.ops.render.render(write_still=True)
            cells.append(p)
        out = os.path.join(self.out, 'cards.png')
        grid_sheet(cells, out, cols=3)
        grid_sheet(cells, os.path.join(self.out, 'cards_200.png'), cols=3, cell=200)
        grid_sheet(cells[:1], os.path.join(self.out, 'card.png'), cols=1)
        grid_sheet(cells[:1], os.path.join(self.out, 'card_200.png'), cols=1, cell=200)
        for p in cells:
            os.remove(p)
        bpy.data.objects.remove(label)
        self.clear_snaps()
        return [out, os.path.join(self.out, 'card.png'), os.path.join(self.out, 'card_200.png')]

    def render_lineup(self, st):
        """This base's pet(s) beside the 1.8 m hero silhouette and every other pet the manifest lists, each read from its
        shipped .glb at its entry's scale, parts, shapes and colours — the sizes the game shows."""
        self.clear_snaps()
        sc = bpy.context.scene
        C.floor()
        hero = C.hero_silhouette()
        man_path = os.path.join(C.MON, 'manifest.json')
        manifest = C.read_json(man_path) if os.path.exists(man_path) else {}
        own = {v['pet']: v for v in self.variants if v.get('pet')}
        entries = {}
        for key, e in manifest.items():
            if isinstance(e, dict) and isinstance(e.get('pet'), str) and e.get('base') != self.base:
                entries[e['pet']] = (key, e)
        order = [p for p in PET_ORDER if p in entries or p in own]
        order += sorted(p for p in list(entries) + list(own) if p not in order)
        items = [('hero 1.8 m', hero, None)]
        for pid in order:
            if pid in own:
                v = own[pid]
                root = self.variant_snapshot(v, 'Idle', 0)
                items.append(('%s  x%.2g  %d tris' % (v['name'].replace(' (pet)', ''), v['scale'], self.tris_of(v)), root, v))
            else:
                key, e = entries[pid]
                root, tris = shipped_pet_snapshot(key, e)
                if root is None:
                    continue
                nm = (e.get('name') or pid).replace(' (pet)', '')
                items.append(('%s  x%.2g  %d tris' % (nm, float(e.get('scale', 1)), int(e.get('tris', tris))), root, e))
        x = 0.0
        labels = []
        for lab, ob, v in items:
            ob.rotation_euler = (0, 0, math.radians(0 if v is None else self.lineup_yaw))
            bpy.context.view_layer.update()
            P = world_points(ob) if v is not None else C.evaluated_coords(ob)
            lo, hi = P.min(0), P.max(0)
            w = hi[0] - lo[0]
            ob.location.x = x - lo[0] + 0.12
            if v is not None:
                ob.location.y = -(lo[1] + hi[1]) / 2
            cx = x + 0.12 + w / 2
            x += w + 0.24
            labels.append((cx, lab))
        size = 0.055
        last = -1e9
        row = 0
        for cx, lab in labels:
            wid = max(len(t) for t in lab.splitlines()) * size * 0.55
            row = (row + 1) % 2 if cx - last < wid else 0
            C.text(lab, (cx, -0.55 - 0.32 * row, 0.02), size=size, rot=(math.radians(70), 0, 0))
            last = cx if row == 0 else last
        bpy.context.view_layer.update()
        pts = [np.array([[labels[0][0] - 0.5, -0.55, 0.0], [labels[-1][0] + 0.5, -0.55, 0.0]])]
        for o in bpy.data.collections['GV_Snap'].objects:
            if o.type == 'MESH' and not o.name.startswith('GV_Floor'):
                pts.append(C.evaluated_coords(o))
        P = np.concatenate(pts)
        W, H = (2200, 700) if not self.quick else (1800, 580)
        sc.render.resolution_x, sc.render.resolution_y = W, H
        C.place_camera(st, P, az=0.0, el=8.0, lens=50, margin=1.04, aspect=W / H)
        path = os.path.join(self.out, 'lineup.png')
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        self.clear_snaps()
        return [path]

    # ------------------------------------------------------------ tables
    def write_tables(self):
        clips = {'animation': 'skeletal', 'fps': FPS, 'clips': [], 'rig': self.rig.ob.name, 'bones': len(self.rig.order)}
        for c in self.clips:
            e = {'name': c.name, 'seconds': round(c.frames() / FPS, 4), 'loop': bool(c.loop),
                 'events': {k: round(v, 4) for k, v in c.events.items()}}
            if c.speed:
                e['speed'] = round(c.speed, 3)
            clips['clips'].append(e)
        C.merge_json(os.path.join(C.MON, 'clips.json'), {self.base: clips})
        man = {}
        for v in self.variants:
            e = {'base': self.base, 'scale': v['scale'], 'parts': list(v.get('parts', [])),
                 'shapes': {k: float(w) for k, w in v.get('shapes', {}).items()}, 'palette': list(v['palette']),
                 'slots': dict(v.get('slots', {})), 'clipSpeed': v['clipSpeed']}
            if v.get('pet'):
                e['pet'] = v['pet']
            cm = {k.name: k.name for k in self.clips if k.name in ('Idle', 'Move', 'Attack1', 'Attack2', 'Hit', 'Death', 'Flee')}
            cm.update(v.get('clipMap', {}))
            e['clipMap'] = cm
            e['name'] = v['name']
            e['tris'] = self.tris_of(v)
            man[v['id']] = e
        C.merge_json(os.path.join(C.MON, 'manifest.json'), man)
        return clips, man

    # ------------------------------------------------------------ the re-import check (empties the scene: run it last)
    def reimport(self, glb_path):
        """Imports the exported file into an empty scene the way a reader would: meshes, rig, clips and their lengths,
        COLOR_0 codes, morphs; then shows the pet from it (its manifest entry's parts and shapes, the game's colours) at
        Idle and at Attack1's event, rendered to reimport.png."""
        from export import reimport_report
        from render import Stage, grid_sheet
        lines = list(reimport_report(glb_path))
        v = self.variants[0]
        want = {c.name: c for c in self.clips}
        acts = list(bpy.data.actions)
        sc0 = bpy.context.scene.render
        fps_in = sc0.fps / sc0.fps_base          # the importer turned seconds into frames at the scene rate it found
        for a in acts:
            n = strip_suffix(a.name)
            if n in want:
                f0, f1 = a.frame_range
                lines.append('  - %s: %.3f s after re-import (built %.3f s)' % (n, (f1 - f0) / fps_in, want[n].frames() / FPS))
        missing = sorted(set(want) - {strip_suffix(a.name) for a in acts})
        lines.append('  - clips missing after re-import: %s' % (', '.join(missing) if missing else 'none'))
        objs = list(bpy.data.objects)
        meshes = [o for o in objs if o.type == 'MESH' and not any(c.name == 'glTF_not_exported' for c in o.users_collection)]
        for o in objs:
            if o.type == 'MESH' and o not in meshes:
                bpy.data.objects.remove(o, do_unlink=True)
        hist = {}
        for o in meshes:
            for sl in codes_from_import(o):
                hist[sl] = hist.get(sl, 0) + 1
            if not part_shown(o.name, self.base, v.get('parts')):
                o.hide_render = True
            keys = o.data.shape_keys
            if keys:
                for kb in keys.key_blocks[1:]:
                    kb.value = float(v.get('shapes', {}).get(strip_suffix(kb.name), 0.0))
        lines.append('  - slots decoded after re-import (vertices): %s (exactness: inspect-glb.ts reads the file itself; the'
                     ' importer stores COLOR_0 as bytes)' % ', '.join('%d:%d' % kv for kv in sorted(hist.items())))
        sc = bpy.context.scene
        st = Stage(self.out, size=420 if self.quick else 560, quick=self.quick, platform=False)
        C.floor()
        for o in meshes:
            if not o.hide_render:
                C.look(o, preview(v), 'reimport', outline=0.012)
        new = list(bpy.data.objects)
        t1, e1 = self.event_time('Attack1')
        cells = []
        tmp = os.path.join(self.out, '_tmp')
        os.makedirs(tmp, exist_ok=True)
        label = C.cam_label(st, size=0.03)
        for i, (clip_name, fr) in enumerate((('Idle', 0), ('Attack1', round(t1 * fps_in)), ('Death', None))):
            act = pose_imported(new, acts, clip_name, 0)
            if fr is None:
                fr = int(act.frame_range[1]) if act is not None else 0
            sc.frame_set(fr)
            bpy.context.view_layer.update()
            P = np.concatenate([C.evaluated_coords(o) for o in meshes if not o.hide_render])
            C.place_camera(st, P, az=self.card_view['az'], el=self.card_view['el'], lens=50, margin=1.12)
            label.data.body = 're-imported %s  %s %.2f s' % (os.path.basename(glb_path), clip_name, fr / fps_in)
            p = os.path.join(tmp, 'reimport_%d.png' % i)
            sc.render.filepath = p
            bpy.ops.render.render(write_still=True)
            cells.append(p)
        out = os.path.join(self.out, 'reimport.png')
        grid_sheet(cells, out, cols=len(cells))
        for p in cells:
            os.remove(p)
        self.finish_renders()
        lines.append('  - rendered %s' % os.path.relpath(out, C.REPO))
        return lines


def sym(pose):
    """A pose given for the left side (`_L` bones) → both sides: the right is the mirror (Y and Z negated)."""
    out = {}
    for k, val in pose.items():
        out[k] = tuple(val)
        if k.endswith('_L'):
            x, y, z = val
            out[k[:-2] + '_R'] = (x, -y, -z)
    return out


def J(*poses):
    """Pose dicts merged left to right (a later one wins)."""
    out = {}
    for p in poses:
        out.update(p)
    return out


def clear_floor(M, pose, bone, masks, channel=0, inc=3.0, limit=120.0, floor=0.006):
    """Turns one channel of `bone` (0 = X) in whichever direction lifts the vertices of `masks` (body vertex masks)
    above the floor with the smaller turn; returns the pose (unchanged if it is already clear or nothing clears)."""
    def lowest(p):
        M.apply_pose(p)
        co = C.evaluated_coords(M.body)
        return min(co[m][:, 2].min() for m in masks if m.any())
    best = None
    base = list(pose.get(bone, (0, 0, 0)))
    if lowest(pose) >= floor:
        best = dict(pose)
    else:
        for sgn in (1, -1):
            k = inc
            while k <= limit:
                p = dict(pose)
                v = list(base)
                v[channel] += sgn * k
                p[bone] = tuple(v)
                if lowest(p) >= floor:
                    if best is None or k < best[0]:
                        best = (k, p)
                    break
                k += inc
        best = best[1] if best is not None else dict(pose)
    M.rig.rest_pose()
    bpy.context.view_layer.update()
    return best

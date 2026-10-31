"""build_kit_crypts.py — the Crypts kit (Phase 6): every `cry_` piece of 07-DUNGEONS §2.2, the cut-away shell pieces,
and the props the Crypts templates and the Barrow Warden's arena name — built procedurally, palette-coded (`gv`: R slot ·
G weathering · B Cycles AO), exported rigid to client/public/models/env/kit_crypts.glb with
client/public/models/env/crypts.json (kit_lib.export_kit's format); the Crypts room templates
(content/dungeons/gravehollow-keep/templates/cry-t-*.json.later) assembled from their JSON the way the client builds a
room (kit_lib.room_placements) and rendered from their own cameras, plus a labelled kit sheet, into
art/renders/env/crypts/.

    blender -b -P tools/blender/env/build_kit_crypts.py -- [--quick] [--write-templates] [--no-renders]
            [--no-sheet] [--rooms cry-t-ossuary,cry-t-chapel]

Re-runnable end to end: it starts from an empty scene and rewrites every output. `--write-templates` regenerates the
template JSON from `crypts_rooms.TEMPLATES` (otherwise the JSON on disk is the source and is only read). The pieces are
authored with crypts_geo / crypts_pieces and handed to tools/blender/env/kit_lib.py (the shared toolkit) for the AO bake,
the export, the room layout and the review look. Readings: art/log/env-crypts.md.
"""
import math
import os
import random
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.join(os.path.dirname(HERE), 'lib')]

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from common import BUILD, CONTENT, MODELS, RENDERS, REPO, args, log, read_json, save_blend, write_json  # noqa: E402

import kit_lib as kl  # noqa: E402
import crypts_geo as G  # noqa: E402
import crypts_pieces as P  # noqa: E402
import crypts_rooms as R  # noqa: E402

ZONE = 'crypts'
# 11 §1: the Crypts are bone-white and sickly green; 07 §2.2: bone #D9CBB0 · slate #3C4048 · grave-moss teal #2F5F5A ·
# corpse-candle green #8FE3A1 — stone and slate pushed toward green-grey and lifted a step so rooms read at phone size
PALETTE = [
    '#77867f',  # 0 stone: cold grey-green dressed stone (walls)
    '#46555a',  # 1 dark stone: teal slate (floors, plinths, reveals)
    '#7a6650',  # 2 wood: weathered coffin wood
    '#4a3e33',  # 3 dark wood: frames, beams, shutters
    '#545d62',  # 4 iron: gates, grates, brackets
    '#0d1315',  # 5 ink: deep recesses, eye sockets, pits
    '#6a5878',  # 6 cloth1: mourning violet (altar cloth, blanket, awning)
    '#d6cfba',  # 7 cloth2: shroud linen, wax, webs
    '#7a6448',  # 8 rope: rope, sacks
    '#b4bcbe',  # 9 bright metal: pewter
    '#a08a50',  # 10 brass: tarnished bronze (the bell, candlesticks, lamps)
    '#8fe3a1',  # 11 glow: corpse-candle green (emissive)
    '#3f8573',  # 12 moss: grave-moss teal
    '#dccfb2',  # 13 bone
    '#cfe6f2',  # 14 gem: moonlight (emissive) — the window
    '#9cc6b3',  # 15 water: grave mist, the basin's tears (translucent where flagged)
]
FLAME = {'candle': (0.55, 1.0, 0.62), 'lamp': (1.0, 0.68, 0.32), 'fire': (1.0, 0.62, 0.28), 'torch': (1.0, 0.65, 0.3),
         'brazier': (1.0, 0.62, 0.28)}

OUT_DIR = os.path.join(RENDERS, 'env', 'crypts')
GLB = os.path.join(MODELS, 'env', 'kit_crypts.glb')
MANIFEST = os.path.join(MODELS, 'env', 'crypts.json')
TEMPLATE_DIR = os.path.join(CONTENT, 'dungeons', 'gravehollow-keep', 'templates')
SHARED_GLB = os.path.join(MODELS, 'env', 'kit_shared.glb')
REPORT = os.path.join(BUILD, 'kit_crypts_report.json')

DEFAULT_BAKE = {'shell': {'ground': 0.0}, 'prop': {'ground': 0.0}, 'wall-hung': {'ground': 0.0, 'wall': kl.HANG_OFF},
                'hanging': {'ground': None}, 'decal': {'skip': True}}

NOTES = {
    'doorSkins': 'cry_door_arch is the open doorway; cry_door_iron the reliquary\'s door; cry_door_portcullis both doors of '
                 'cry-t-well-of-bones (gate raised; it drops for the Falling Portcullis on N) and any Locked door; cry_door_secret '
                 'a found secret door and the E/W sockets of cry-t-wardens-vigil (closed; the panel swings at phase 2)',
    'facings': 'cry_wall_niche_2m and cry_wall_bone_2m are wall-hung facings 1.6 m wide (0.45 / 0.3 m deep) in front of the shell wall',
    'mist': 'every Crypts template carries one cry_floor_mist per cell (07 §2.2: floor mist everywhere); draw it translucent',
    'cutaway': 'walls, doorways and corners on a side facing the camera use wallCut / doorwayCut / cornerCut; hide wall-hung props there',
    'points': 'light kind candle = a corpse-candle (tone corpse: cold green); lamp = a warm lantern; fx motes / smoke / drip / glow',
}


# ───────────────────────────────────────────── build ─────────────────────────────────────────────────

def build_kit(quick):
    kit = kl.Kit(ZONE, PALETTE)
    col = bpy.data.collections.get(kit.col) or bpy.data.collections.new(kit.col)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    authored = {}
    t0 = time.time()
    for builder in P.PIECES:
        cp = builder()
        if cp.hang:
            cp.shift((0.0, kl.HANG_OFF, 0.0))
        main, parts = G.realize(cp, col)
        bake = cp.bake if cp.bake is not None else DEFAULT_BAKE[cp.role]
        kp = kl.Piece(kit, cp.id, main, cp.budget, bake, None, cp.role)
        kp.parts = parts
        kit.pieces[cp.id] = kp
        for pos, kind, tone in cp.lights:
            e = kit.light(kp, tuple(pos), kind)
            e['tone'] = tone
        for pos, kind, tone in cp.fx:
            e = kit.fx(kp, tuple(pos), kind)
            if tone:
                e['tone'] = tone
        kp.info.update(cp.info)
        for k, v in cp.info.items():
            main[k] = v
        authored[cp.id] = cp
    log('built %d pieces in %.1f s' % (len(kit.pieces), time.time() - t0))
    t0 = time.time()
    kl.bake_ao(list(kit.pieces.values()), samples=32 if quick else 96)
    log('baked AO in %.1f s' % (time.time() - t0))
    for p in kit.pieces.values():
        over = p.budget is not None and p.tris() > p.budget
        log('%-24s %4d tris / %-4s %s%s' % (p.id, p.tris(), p.budget, p.role, '  OVER BUDGET' if over else ''))
    return kit, authored


def write_templates():
    os.makedirs(TEMPLATE_DIR, exist_ok=True)
    for t in R.TEMPLATES:
        path = os.path.join(TEMPLATE_DIR, t['id'] + '.json.later')
        if os.path.exists(os.path.join(TEMPLATE_DIR, t['id'] + '.json')):
            log('skip %s: the live .json exists (Phase 7 owns it now)' % t['id'])
            continue
        write_json(path, R.template_json(t))
        log('wrote', os.path.relpath(path, REPO))


def read_templates():
    out = []
    for t in R.TEMPLATES:
        path = R.template_path(TEMPLATE_DIR, t['id'])
        out.append(read_json(path) if os.path.exists(path) else R.template_json(t))
    return out


def check_codes():
    """R must be whole slot codes in the exported file (G and B are continuous for environments)."""
    import struct
    import json
    with open(GLB, 'rb') as f:
        data = f.read()
    jlen = struct.unpack_from('<I', data, 12)[0]
    gl = json.loads(data[20:20 + jlen])
    bin_off = 20 + jlen + 8
    worst, n = 0.0, 0
    for m in gl['meshes']:
        for prim in m['primitives']:
            acc = gl['accessors'][prim['attributes']['COLOR_0']]
            view = gl['bufferViews'][acc['bufferView']]
            comps = 4 if acc['type'] == 'VEC4' else 3
            size = 2 if acc['componentType'] == 5123 else 4
            stride = view.get('byteStride', comps * size)
            base = bin_off + view.get('byteOffset', 0) + acc.get('byteOffset', 0)
            for i in range(acc['count']):
                o = base + i * stride
                r = struct.unpack_from('<H', data, o)[0] / 65535.0 if size == 2 else struct.unpack_from('<f', data, o)[0]
                worst = max(worst, abs(r * 15 - round(r * 15)))
                n += 1
    return worst, n


# ───────────────────────────────────────────── the review look ───────────────────────────────────────

def translucent(base, name, alpha):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = base.copy()
    m.name = name
    nt = m.node_tree
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    src = out.inputs[0].links[0].from_socket
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    mix.inputs['Fac'].default_value = alpha
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(src, mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    try:
        m.surface_render_method = 'BLENDED'
    except Exception:
        pass
    m.use_backface_culling = False
    return m


def dress(kit, authored):
    base = kl.env_material(PALETTE, 'GV_Env_crypts')
    base.use_backface_culling = True
    outline = G.outline_material()
    for mid, p in kit.pieces.items():
        a = authored[mid].info.get('translucent')
        m = translucent(base, 'GV_Env_crypts_%s' % mid, a) if a else base
        for o in p.meshes():
            o.data.materials.clear()
            o.data.materials.append(m)
            o.data.materials.append(outline)
    return base


def flame_mesh():
    me = bpy.data.meshes.get('GV_Flame')
    if me:
        return me
    g = G.Geo()
    g.lathe([(0.0, -0.01), (0.045, 0.035), (0.034, 0.1), (0.0, 0.18)], 5, 11, sg=1, cap_top=False)
    return G.mesh_from_geo('GV_Flame', g, grime=False)


def flame(pos, kind, col):
    ob = bpy.data.objects.new('flame', flame_mesh())
    col.objects.link(ob)
    ob.location = pos
    rgb = FLAME.get(kind, FLAME['lamp'])
    name = 'GV_Flame_%s' % kind
    m = bpy.data.materials.get(name) or G.flat_material(name, rgb, strength=2.4)
    if not ob.data.materials:
        ob.data.materials.append(m)
    ob.material_slots[0].link = 'OBJECT'
    ob.material_slots[0].material = m
    return ob


def point_light(name, pos, color, energy, col, radius=0.12):
    ld = bpy.data.lights.new(name, 'POINT')
    ld.energy = energy
    ld.color = color
    ld.shadow_soft_size = radius
    ob = bpy.data.objects.new(name, ld)
    col.objects.link(ob)
    ob.location = pos
    return ob


def clear_collection(name):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
        return col
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    return col


# ───────────────────────────────────────────── the kit sheet ─────────────────────────────────────────

def render_kit_sheet(kit, quick):
    sc = bpy.context.scene
    cell = 300 if quick else 420
    G.eevee(quick, (cell, cell))
    G.world_hemisphere(sky=(0.42, 0.46, 0.45), ground=(0.12, 0.12, 0.12), bg=(0.045, 0.055, 0.055), strength=1.0)
    stage = clear_collection('SheetStage')
    for nm, rot, en, colr in (('Key', (math.radians(52), 0, math.radians(-38)), 2.6, (1.0, 0.97, 0.92)),
                              ('Fill', (math.radians(62), 0, math.radians(70)), 0.9, (0.75, 0.85, 1.0))):
        ld = bpy.data.lights.new('Sheet' + nm, 'SUN')
        ld.energy = en
        ld.color = colr
        ld.angle = math.radians(3)
        ob = bpy.data.objects.new('Sheet' + nm, ld)
        stage.objects.link(ob)
        ob.rotation_euler = rot
    gme = bpy.data.meshes.new('SheetGround')
    S = 30
    gme.from_pydata([(-S, -S, -0.004), (S, -S, -0.004), (S, S, -0.004), (-S, S, -0.004)], [], [(0, 1, 2, 3)])
    ground = bpy.data.objects.new('SheetGround', gme)
    stage.objects.link(ground)
    gme.materials.append(G.flat_material('GV_SheetGround', (0.035, 0.04, 0.042)))
    cam = bpy.data.objects.new('SheetCam', bpy.data.cameras.new('SheetCam'))
    stage.objects.link(cam)
    sc.camera = cam
    kitdir = os.path.join(OUT_DIR, 'kit')
    os.makedirs(kitdir, exist_ok=True)
    labels = kl.Labels(kitdir)
    flames = clear_collection('SheetFlames')
    cells, labs = [], []
    for o in kit.objects():
        o.hide_render = True
    for mid, p in kit.pieces.items():
        meshes = p.meshes()
        for o in meshes:
            o.hide_render = False
        for o in list(flames.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        for e in p.points:
            if e['kind'] == 'light':
                flame(e.matrix_world.translation, e['light'], flames)
        bpy.context.view_layer.update()
        lo, hi = kl.world_bounds(meshes)
        ground.hide_render = lo.z < -0.05 or p.role == 'hanging'
        kl.frame_ortho(cam, meshes, az=32.0, el=34.0, margin=1.14)
        path = os.path.join(kitdir, mid + '.png')
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        cells.append(kl.load_px(path))
        over = p.budget is not None and p.tris() > p.budget
        text = '%s\n%d / %s tris%s%s' % (mid, p.tris(), p.budget, '  OVER' if over else '', ('  · ' + ' '.join(o['part'] for o in p.parts)) if p.parts else '')
        labs.append(labels.image(text, cell, int(cell * 0.2)))
        for o in meshes:
            o.hide_render = True
    for o in list(flames.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    out = os.path.join(OUT_DIR, 'kit_sheet.png')
    kl.compose(cells, labs, 7, out)
    for o in list(stage.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    log('kit sheet', os.path.relpath(out, REPO))
    return out


# ───────────────────────────────────────────── shared pieces ─────────────────────────────────────────

class _Stub:
    """Enough of kit_lib.Piece for room_placements / build_room: a shared prop drawn in a Crypts room."""

    def __init__(self, mid, ob, parts=(), points=(), role='prop'):
        self.id = mid
        self.ob = ob
        self.parts = list(parts)
        self.points = list(points)
        self.role = role
        self.info = {}
        self.budget = None

    def meshes(self):
        return [self.ob] + self.parts

    def tris(self):
        return sum(kl.mesh_tris(o) for o in self.meshes())


def placeholder_shared(col):
    """Stand-ins for the shared kit's props when kit_shared.glb is not there yet (palette-coded)."""
    out = {}

    def mk(mid, fn, lights=()):
        g = G.Geo()
        fn(g)
        me = G.mesh_from_geo(mid + '__ph', g, grime=False)
        ob = bpy.data.objects.new(mid + '__ph', me)
        col.objects.link(ob)
        ob.hide_render = True
        pts = []
        for at, kind in lights:
            e = bpy.data.objects.new('ph_light', None)
            col.objects.link(e)
            e.parent = ob
            e.location = at
            e['kind'] = 'light'
            e['light'] = kind
            pts.append(e)
        bpy.context.view_layer.update()
        out[mid] = _Stub(mid, ob, points=pts)

    def campfire(g):
        for k in range(7):
            a = 2 * math.pi * k / 7
            g.box((0.5 * math.cos(a) - 0.12, 0.5 * math.sin(a) - 0.12, 0), (0.5 * math.cos(a) + 0.12, 0.5 * math.sin(a) + 0.12, 0.2), P.DSTONE, skip=('-z',), taper=(0.7, 0.7))
        g.bar((-0.35, -0.1, 0.12), (0.35, 0.1, 0.18), 0.12, 0.12, P.DWOOD)
        g.bar((-0.1, 0.35, 0.12), (0.1, -0.35, 0.2), 0.12, 0.12, P.DWOOD)
    mk('shr_campfire', campfire, lights=[((0, 0, 0.45), 'fire')])
    mk('shr_chest_small', lambda g: (g.box((-0.42, -0.28, 0), (0.42, 0.28, 0.42), P.WOOD, skip=('-z',)),
                                     g.box((-0.44, -0.3, 0.42), (0.44, 0.3, 0.56), P.DWOOD, skip=('-z',), taper=(1, 0.6)),
                                     g.box((-0.08, -0.31, 0.3), (0.08, -0.27, 0.46), P.BRASS)))
    mk('shr_chest_large', lambda g: (g.box((-0.72, -0.34, 0), (0.72, 0.34, 0.5), P.WOOD, skip=('-z',)),
                                     g.box((-0.74, -0.36, 0.5), (0.74, 0.36, 0.66), P.DWOOD, skip=('-z',), taper=(1, 0.6)),
                                     g.box((-0.4, -0.37, 0.36), (-0.26, -0.33, 0.54), P.BRASS),
                                     g.box((0.26, -0.37, 0.36), (0.4, -0.33, 0.54), P.BRASS)))
    mk('shr_gold_pile', lambda g: (g.lathe([(0.45, 0.0), (0.25, 0.12), (0.0, 0.2)], 7, P.BRASS, sg=1, cap_top=False),
                                   g.lathe([(0.22, 0.0, 0.42, 0.2), (0.0, 0.14, 0.42, 0.2)], 6, P.BRASS, sg=1, cap_top=False)))
    mk('shr_trap_plate', lambda g: g.box((-0.5, -0.5, 0.0), (0.5, 0.5, 0.025), P.IRON, skip=('-z',)))
    return out


def load_shared(col):
    if not os.path.exists(SHARED_GLB):
        log('kit_shared.glb not there yet — shared props drawn as placeholders')
        return placeholder_shared(col), False
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=SHARED_GLB)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        col.objects.link(o)
        o.hide_render = True
    out = {}
    for o in new:
        if o.type == 'MESH' and o.parent is None:
            for m in [o] + [c for c in o.children if c.type == 'MESH']:
                me = m.data
                if me.color_attributes and G.ATTR not in me.color_attributes:
                    me.color_attributes[0].name = G.ATTR
            parts = [c for c in o.children if c.type == 'MESH']
            points = [c for c in o.children if c.type == 'EMPTY' and 'kind' in c]
            out[o.name] = _Stub(o.name, o, parts=parts, points=points)
    log('shared kit loaded: %d pieces' % len(out))
    return out, True


# ───────────────────────────────────────────── the rooms ─────────────────────────────────────────────

def capsule_mesh(h, r):
    name = 'GV_Capsule_%.2f_%.2f' % (h, r)
    me = bpy.data.meshes.get(name)
    if me:
        return me
    g = G.Geo()
    g.lathe([(0.0, 0.0), (r * 0.8, 0.05), (r, 0.25), (r, h - r * 1.2), (r * 0.7, h - r * 0.4), (0.0, h)], 10, 0, sg=1, cap_top=False)
    me = G.mesh_from_geo(name, g, grime=False)
    me.materials.append(toon_flat('GV_MarkFoe', (0.80, 0.77, 0.66)))
    return me


def toon_flat(name, rgb):
    """A flat-colour toon material for the mark stand-ins (the kit's light ramp)."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    diff = nt.nodes.new('ShaderNodeBsdfDiffuse')
    s2r = nt.nodes.new('ShaderNodeShaderToRGB')
    bw = nt.nodes.new('ShaderNodeRGBToBW')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    els = ramp.color_ramp.elements
    els[0].position = 0.0
    els[0].color = (0.42, 0.42, 0.42, 1)
    els[1].position = 0.22
    els[1].color = (0.68, 0.68, 0.68, 1)
    for at, v in ((0.5, 0.9), (0.82, 1.06)):
        e = els.new(at)
        e.color = (v, v, v, 1)
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs[7].default_value = G.srgb_to_lin('#%02x%02x%02x' % tuple(int(c * 255) for c in rgb))
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(diff.outputs[0], s2r.inputs[0])
    nt.links.new(s2r.outputs[0], bw.inputs[0])
    nt.links.new(bw.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs['Color'], mix.inputs[6])
    nt.links.new(mix.outputs[2], em.inputs['Color'])
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


def review_template(tpl):
    """The template as the review draws it: only the sockets open to the party (REVIEW) — the others are walls."""
    rv = R.REVIEW.get(tpl['id'], {})
    t = dict(tpl)
    if rv.get('open'):
        t['doors'] = [d for d in tpl['doors'] if d['side'] in rv['open']]
    return t, rv.get('skins', {})


def side_of(mw, tpl):
    x, z = mw.translation.x, -mw.translation.y
    W, D = tpl['footprint']['w'] * R.CELL, tpl['footprint']['h'] * R.CELL
    return kl.nearest_side(W, D, x, z)


def render_room(tpl, pieces, quick):
    sc = bpy.context.scene
    size = (1300, 600) if quick else (2080, 960)
    G.eevee(quick, size)
    G.world_hemisphere(sky=(0.15, 0.19, 0.18), ground=(0.05, 0.055, 0.055), bg=(0.03, 0.04, 0.04), strength=1.0)
    col = clear_collection('Room')
    t, skins = review_template(tpl)
    rng = random.Random(sum(ord(c) for c in tpl['id']))
    placements = kl.room_placements(t, P.SHELL, rng, pieces)
    if skins:
        placements = [((skins.get(side_of(mw, t), mid) if tag == 'doorway' else mid), mw, tag) for mid, mw, tag in placements]
    objs, lights, stats = kl.build_room(placements, pieces, collection_name='Room', outline=0.014)
    for o in objs:
        if o.data.materials and o.data.materials[0].name.startswith('GV_Env_crypts_cry_floor_mist'):
            o.modifiers.clear()
    for pos, kind, mid in lights:
        flame(pos, kind, col)
    # the review's lights: the party's torch, the strongest candle group (cold green), fires and lamps where they burn
    marks = R.party_marks(tpl)
    heroes = [m for m, who in marks if who == 'hero']
    hx = sum(m[0] for m in heroes) / len(heroes)
    hz = sum(m[2] for m in heroes) / len(heroes)
    point_light('Torch', kl.game_to_blender((hx, 2.3, hz)), FLAME['torch'], 900.0, col, radius=0.15)
    groups = {}
    for pos, kind, mid in lights:
        if kind == 'candle':
            key = (mid, round(pos.x / 3), round(pos.y / 3))
            groups.setdefault(key, []).append(pos)
    if groups:
        best = max(groups.values(), key=lambda ps: len(ps) - 0.1 * (sum(ps, Vector()) / len(ps)).to_2d().length)
        c = sum(best, Vector()) / len(best)
        point_light('Candles', c + Vector((0, 0, 0.35)), FLAME['candle'], 260.0 + 25.0 * len(best), col, radius=0.3)
    for pos, kind, mid in lights:
        if kind in ('fire', 'lamp', 'torch', 'brazier'):
            point_light('Fire', pos + Vector((0, 0, 0.25)), FLAME[kind], 650.0 if kind == 'fire' else 300.0, col, radius=0.25)
    if set(tpl['kinds']) & R.FIGHT_KINDS:
        hero_cols = [(0.23, 0.38, 0.72), (0.70, 0.24, 0.20), (0.30, 0.55, 0.32), (0.62, 0.50, 0.26)]
        k = 0
        for m, who in marks:
            ob = bpy.data.objects.new('mark', capsule_mesh(1.75 if who == 'hero' else 1.7, 0.28))
            col.objects.link(ob)
            ob.location = kl.game_to_blender(m)
            ob.material_slots[0].link = 'OBJECT'
            if who == 'hero':
                ob.material_slots[0].material = toon_flat('GV_MarkHero%d' % k, hero_cols[k % 4])
                k += 1
            else:
                ob.material_slots[0].material = toon_flat('GV_MarkFoe', (0.80, 0.77, 0.66))
    cam = bpy.data.objects.new('RoomCam', bpy.data.cameras.new('RoomCam'))
    col.objects.link(cam)
    kl.template_camera(cam, tpl)
    sc.camera = cam
    out = os.path.join(OUT_DIR, 'room_%s.png' % tpl['id'])
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    kl.clear_room('Room')
    log('rendered %s: %d tris, %d instances, %d unique meshes' % (os.path.relpath(out, REPO), stats['tris'], stats['instances'], stats['unique']))
    return out, stats


def rooms_sheet(paths, out_path, cols=2, factor=2):
    imgs = [kl.shrink(kl.load_px(p), factor) for p in paths]
    h, w, _ = imgs[0].shape
    rows = (len(imgs) + cols - 1) // cols
    sheet = np.zeros((rows * h, cols * w, 4), dtype=np.float32)
    sheet[..., 3] = 1.0
    for i, px in enumerate(imgs):
        r, c = divmod(i, cols)
        y0 = (rows - 1 - r) * h
        sheet[y0:y0 + h, c * w:(c + 1) * w] = px
    kl.save_px(out_path, sheet)
    return out_path


# ───────────────────────────────────────────── main ──────────────────────────────────────────────────

def main():
    a = args()
    quick = bool(a.get('quick'))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    kl.write_palette(ZONE, PALETTE, 'The Crypts (Gravehollow F4–6): bone-white and sickly green over cold grey-green stone '
                     '(11 §1, 07 §2.2). Written by tools/blender/env/build_kit_crypts.py.')
    if a.get('write_templates'):
        write_templates()
    kit, authored = build_kit(quick)
    shell = dict(P.SHELL)
    shell.update({
        'floorAlt': [], 'wallAlt': [],
        'doorways': {'open': 'cry_door_arch', 'locked': 'cry_door_portcullis', 'secret': 'cry_door_secret', 'gate': 'cry_door_iron'},
        'tile': 2, 'segment': 2, 'doorwayWidth': P.DOOR_PIECE_W,
        'opening': {'width': P.DOOR_W, 'spring': P.DOOR_SPRING, 'apex': P.DOOR_APEX},
        'wallHeight': P.WALL_H, 'wallThickness': P.WALL_T, 'cutHeight': P.CUT_H,
        'notes': 'Pivots as kit_lib: a wall, doorway or cut piece has its origin at the centre of its base on the room-side face '
                 '(masonry behind it, 0.4 m); an 8 m cell edge is segment, doorway, segment (2 + 4 + 2 m) or four segments. Corner: '
                 'origin on the inside corner of the room, NW rotationY 0, NE -90, SE 180, SW 90. Walls whose outer side faces the camera '
                 'use the cut pieces. Floor tiles: 2 m, any quarter turn. Wall-hung pieces 0.1 m in front of the wall face.',
    })
    door_skins = {'cry-t-reliquary': {'*': 'cry_door_iron'},
                  'cry-t-well-of-bones': {'north': 'cry_door_portcullis', 'south': 'cry_door_portcullis'},
                  'cry-t-wardens-vigil': {'east': 'cry_door_secret', 'west': 'cry_door_secret'}}
    kb = kl.export_kit(kit, GLB, MANIFEST, shell=shell,
                       about='The Crypts kit (07 §2.2): the 22 cry_ pieces, the cut-away shell, and the props the Crypts templates and the Barrow Warden\'s arena name.',
                       extra={'notes': NOTES, 'floorMix': {}, 'substitute': {}, 'doorSkins': door_skins},
                       fbx_path=None if a.get('no_fbx') else kl.unity_fbx_path('crypts'))
    worst, n = check_codes()
    log('kit_crypts.glb %.1f KB; COLOR_0 R worst distance from a whole slot code %.5f over %d vertices' % (kb, worst, n))
    report = {'glbKB': round(kb, 1), 'slotCodeWorst': worst,
              'pieces': {m: {'tris': p.tris(), 'budget': p.budget, 'role': p.role, 'parts': [o.name for o in p.parts],
                             'points': len(p.points)} for m, p in kit.pieces.items()}}
    dress(kit, authored)
    save_blend(os.path.join(BUILD, 'kit_crypts.blend'))
    if not a.get('no_renders'):
        if not a.get('no_sheet'):
            render_kit_sheet(kit, quick)
        shared_col = clear_collection('SharedKit')
        shared, real = load_shared(shared_col)
        if real:
            for s in shared.values():
                for o in s.meshes():
                    o.data.materials.clear()
                    o.data.materials.append(bpy.data.materials['GV_Env_crypts'])
                    o.data.materials.append(G.outline_material())
        report['sharedKit'] = 'kit_shared.glb' if real else 'placeholders'
        pieces = dict(kit.pieces)
        pieces.update(shared)
        for o in kit.objects():
            o.hide_render = True
        only = set(a['rooms'].split(',')) if a.get('rooms') else None
        paths = []
        report['rooms'] = {}
        for tpl in read_templates():
            if only and tpl['id'] not in only:
                continue
            p, stats = render_room(tpl, pieces, quick)
            paths.append(p)
            report['rooms'][tpl['id']] = stats
        if paths and not only:
            out = rooms_sheet(paths, os.path.join(OUT_DIR, 'rooms_sheet.png'))
            log('rooms sheet', os.path.relpath(out, REPO))
    write_json(REPORT, report)
    log('report', os.path.relpath(REPORT, REPO))


if __name__ == '__main__':
    main()

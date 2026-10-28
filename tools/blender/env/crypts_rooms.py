"""crypts_rooms.py — the Crypts room templates (07-DUNGEONS §2.2, "Crypts room templates (10)") as content JSON, and
what the review renders need beyond them (which sockets to draw open, which door skin each takes, the fight marks).

Template space is the game's (D-020 content, `client/src/scene/room/layout.ts`): a room is centred on the origin,
+x east, +z south, y up, one cell 8 × 8 m; a prop's `rotationY` turns its front (+z) about +y. The client builds the
floor, walls, doorways and corners from the footprint and doors (kit_lib.room_placements is the Blender twin of that),
then places the props. Readings (logged as Proposed in art/log/env-crypts.md):
- every wall-hung piece (brackets, facings, the hearth, the window, the reliquary, cocoons) stands 0.1 m in from the
  room edge (±3.9 in a 1×1 room, as the Cellars' sconces); a niche or bone facing next to a corner sits 0.25 m off its
  2 m slot so the corner post and its mourner stay clear;
- nothing replaces a shell piece: door skins (the reliquary's iron gate, the well's portcullis frames, the Vigil's secret
  doors) are the client's choice per door and are listed in `REVIEW` and the pass's report;
- "floor mist everywhere" (07 §2.2): every template carries one `cry_floor_mist` per cell;
- "one, any side" templates list all four doors (as the Cellars' strongroom and stairwell do);
- vault ribs over a cut-away side become `cry_vault_rib_half` from the far walls (the crossing) or wall arches on the
  far wall (the spider gallery: a rib seen end-on from its camera reads as a post);
- triBudget 30000 (lint rule 17's cap) and drawCallBudget 40 (07 §2.2 / 11 §9: ≤ 40 draw calls).
"""
import math
import os

ZONE_ID = 'the-crypts'
CELL = 8.0

COMPASS = {'N': (0, -1), 'S': (0, 1), 'E': (1, 0), 'W': (-1, 0), 'NE': (1, -1), 'NW': (-1, -1), 'SE': (1, 1), 'SW': (-1, 1)}
ALL4 = [('north', 0), ('east', 0), ('south', 0), ('west', 0)]


def mist(w, h):
    return [('cry_floor_mist', (-w * 4 + 4 + 8 * i, 0, -h * 4 + 4 + 8 * j), 0) for i in range(w) for j in range(h)]


TEMPLATES = [
    dict(id='cry-t-ossuary', w=1, h=1, doors=ALL4, kinds=['entry', 'fight', 'curio', 'keyRoom'], cam=('S', 36, 13, 40),
         note='bone walls on two sides (N, W), the urn row (a curio socket) on the E wall, 2 candle brackets by the N door',
         props=[('cry_wall_bone_2m', (-2.75, 0, -3.9), 0), ('cry_wall_bone_2m', (2.75, 0, -3.9), 0),
                ('cry_wall_bone_2m', (-3.9, 0, -2.75), 90), ('cry_wall_bone_2m', (-3.9, 0, 2.75), 90),
                ('cry_urn_row', (3.66, 0, -2.55), -90),
                ('cry_candle_bracket', (-1.6, 2.1, -3.9), 0), ('cry_candle_bracket', (1.6, 2.1, -3.9), 0)] + mist(1, 1)),
    dict(id='cry-t-catacomb-run', w=2, h=1, doors=[('west', 0), ('east', 0)], kinds=['fight', 'trapGauntlet', 'lockedDoor'],
         cam=('N', 28, 17, 38),
         note='niche walls along the far long side (the near one is the cutaway), 4 coffins (two stacked), mist, the Bone Scythe socket at the midline',
         props=[('cry_wall_niche_2m', (x, 0, 3.9), 180) for x in (-6.75, -5, -3, -1, 1, 3, 5, 6.75)] +
               [('cry_coffin_wood', (-5.4, 0, 2.95), 180), ('cry_coffin_wood', (-5.35, 0.47, 2.95), 174),
                ('cry_coffin_wood', (5.0, 0, 3.0), 183), ('cry_coffin_wood', (1.6, 0, 3.05), 177),
                ('shr_trap_plate', (0, 0, 0), 0),
                ('cry_candle_bracket', (-7.9, 2.1, 2.6), 90), ('cry_candle_bracket', (7.9, 2.1, -2.6), -90)] + mist(2, 1)),
    dict(id='cry-t-chapel', w=2, h=2, doors=[('south', 0), ('north', 1)], kinds=['elite', 'curio', 'treasure'],
         cam=('S', 34, 20, 44),
         note='the altar step (a 0.6 m chancel: EB2 stands on it), the candle ring round the altar, the weeping statue, 2 clustered pillars as cover',
         props=[('cry_altar_step', (0, 0, -4.8), 0), ('cry_candle_ring', (0, 0.6, -5.6), 0),
                ('cry_statue_weeping', (-6.2, 0, -6.2), 35),
                ('cry_pillar_cluster', (-5, 0, -1), 0), ('cry_pillar_cluster', (5, 0, -1), 0)] +
               [('cry_wall_niche_2m', (-7.9, 0, z), 90) for z in (-4, -2)] +
               [('cry_wall_niche_2m', (7.9, 0, z), -90) for z in (-4, -2)] +
               [('cry_floor_slab_open', (-5, 0, 5), 0), ('cry_floor_slab_open', (5, 0, 3), 180),
                ('cry_candle_bracket', (-5.4, 2.2, -7.9), 0), ('cry_candle_bracket', (6.6, 2.2, -7.9), 0),
                ('cry_candle_bracket', (-7.9, 2.2, 2.2), 90), ('cry_candle_bracket', (7.9, 2.2, 2.2), -90)] + mist(2, 2)),
    dict(id='cry-t-sextons-cell', w=1, h=1, doors=ALL4, kinds=['rest'], cam=('N', 30, 10, 36),
         note="the hearth with its campfire, a cot under the shuttered window (the moor on F4), the sexton's tools",
         props=[('cry_hearth_niche', (-2.3, 0, 3.9), 180), ('shr_campfire', (-2.3, 0, 3.3), 0, {'lightSource': True}),
                ('cry_window_shuttered', (2.5, 1.3, 3.9), 180), ('cry_cot', (2.55, 0, 3.35), 0),
                ('cry_sexton_tools', (-3.9, 0, 2.0), 90), ('cry_candle_bracket', (3.9, 2.1, 2.6), -90)] + mist(1, 1)),
    dict(id='cry-t-crossing', w=1, h=1, doors=ALL4, kinds=['entry', 'fight', 'merchant', 'keyRoom'], cam=('SE', 40, 14, 42),
         note='a sarcophagus in each corner (cover marks; the barrow parks by one), half ribs from the far walls meeting at the crossing, a hanging candle crown',
         props=[('cry_sarcophagus', (-2.7, 0, -2.7), -45), ('cry_sarcophagus', (2.7, 0, -2.7), 45),
                ('cry_sarcophagus', (2.7, 0, 2.7), -45), ('cry_sarcophagus', (-2.7, 0, 2.7), 45),
                ('cry_vault_rib_half', (0, 3.5, -4), 0), ('cry_vault_rib_half', (-4, 3.5, 0), 90),
                ('cry_candle_crown', (0, 4.75, 0), 0)] + mist(1, 1)),
    dict(id='cry-t-well-of-bones', w=1, h=1, doors=[('north', 0), ('south', 0)], kinds=['fight', 'trapGauntlet', 'lockedDoor'],
         cam=('E', 48, 12, 42),
         note='a bone-grate floor over the pit (the Grave Breath vent), 2 candle brackets, portcullis frames on both doors (the Falling Portcullis on N)',
         props=[('cry_floor_bonegrate', (-1, 0, -1), 0), ('cry_floor_bonegrate', (1, 0, -1), 90),
                ('cry_floor_bonegrate', (1, 0, 1), 180), ('cry_floor_bonegrate', (-1, 0, 1), 270),
                ('cry_candle_bracket', (-3.9, 2.1, -2), 90), ('cry_candle_bracket', (-3.9, 2.1, 2), 90),
                ('cry_bone_pile', (-3.0, 0, -2.6), 30)] + mist(1, 1)),
    dict(id='cry-t-reliquary', w=1, h=1, doors=ALL4, kinds=['treasure', 'secret'], cam=('S', 45, 11, 42),
         note='chests on stone shelves, the reliquary niche (curio), gold; its door takes the iron gate skin (cry_door_iron)',
         props=[('cry_shelf_stone', (-2.6, 0, -3.5), 0), ('shr_chest_small', (-2.6, 0.5, -3.5), 0),
                ('cry_reliquary_niche', (2.7, 0, -3.9), 0),
                ('cry_shelf_stone', (-3.5, 0, 2.4), 90), ('shr_chest_large', (-3.5, 0.5, 2.4), 90),
                ('shr_gold_pile', (1.6, 0, -1.4), 0), ('shr_gold_pile', (-0.8, 0, 1.2), 40),
                ('cry_candle_bracket', (3.9, 2.1, 2.6), -90)] + mist(1, 1)),
    dict(id='cry-t-stair-shaft', w=1, h=1, doors=ALL4, kinds=['stairs', 'entry'], cam=('S', 30, 11, 40),
         note='the spiral stair round its newel pillar, opening toward the camera; 2 candle brackets (the Entry variant holds the Waystone on F4)',
         props=[('cry_stair_spiral', (0, 0, 0), 0),
                ('cry_candle_bracket', (-2.6, 2.1, -3.9), 0), ('cry_candle_bracket', (2.6, 2.1, -3.9), 0)] + mist(1, 1)),
    dict(id='cry-t-spider-gallery', w=3, h=1, doors=[('west', 0), ('east', 0)], kinds=['fight', 'elite'], cam=('N', 26, 22, 36),
         note='6 web sheets, 3 cocoons (wrapped coffins), the vault ribs as three wall arches crowning the far wall; the enemy back row are ceiling marks 2.5 m up',
         props=[('cry_vault_rib', (x, 3.5, 3.86), 0) for x in (-8, 0, 8)] +
               [('cry_web_sheet', (-11.05, 0, 3.05), 135), ('cry_web_sheet', (11.05, 0, 3.05), -135),
                ('cry_web_sheet', (-4, 0, 3.75), 180), ('cry_web_sheet', (4.2, 0, 3.75), 180),
                ('cry_web_sheet', (-1.6, 0.2, 3.3), 165), ('cry_web_sheet', (7.4, 0.3, 3.4), 195),
                ('cry_cocoon', (-6.2, 0, 3.9), 180), ('cry_cocoon', (1.4, 0, 3.9), 180), ('cry_cocoon', (9.4, 0, 3.9), 180),
                ('cry_candle_bracket', (-9.5, 2.2, 3.9), 180), ('cry_candle_bracket', (5.6, 2.2, 3.9), 180)] + mist(3, 1)),
    dict(id='cry-t-wardens-vigil', w=2, h=2, doors=[('south', 0), ('east', 0), ('west', 0)], kinds=['boss'], cam=('S', 30, 21, 44),
         note='the bier in its ring of candles, 4 clustered pillars, niche walls with bone walls behind the bier, 4 bone piles (07 §2.8); E and W are the secret doors (add spawns)',
         props=[('cry_bier_stone', (0, 0, -1.5), 0), ('cry_candle_ring', (0, 0, -1.5), 0),
                ('cry_pillar_cluster', (-5, 0, -5), 0), ('cry_pillar_cluster', (5, 0, -5), 0),
                ('cry_pillar_cluster', (-5, 0, 3), 0), ('cry_pillar_cluster', (5, 0, 3), 0)] +
               [('cry_wall_niche_2m', (x, 0, -7.9), 0) for x in (-6.75, -5, -3, 3, 5, 6.75)] +
               [('cry_wall_bone_2m', (x, 0, -7.9), 0) for x in (-1, 1)] +
               [('cry_wall_niche_2m', (7.9, 0, z), -90) for z in (-6.75, -1, 1, 3, 5, 6.75)] +
               [('cry_wall_niche_2m', (-7.9, 0, z), 90) for z in (-6.75, -1, 1, 3, 5, 6.75)] +
               [('cry_bone_pile', (-3.2, 0, -6.6), 10), ('cry_bone_pile', (3.2, 0, -6.6), -10),
                ('cry_bone_pile', (-6.6, 0, 1.8), 80), ('cry_bone_pile', (6.6, 0, 1.8), -80)] + mist(2, 2)),
]

# What the review renders draw beyond the template: the sockets open to the party (a single-door template shows its
# far one) and the door skin on each socket (the client's choice per door; listed for it).
REVIEW = {
    'cry-t-sextons-cell': {'open': ['south']},
    'cry-t-reliquary': {'open': ['north'], 'skins': {'north': 'cry_door_iron'}},
    'cry-t-stair-shaft': {'open': ['north']},
    'cry-t-well-of-bones': {'skins': {'north': 'cry_door_portcullis', 'south': 'cry_door_portcullis'}},
    'cry-t-wardens-vigil': {'skins': {'east': 'cry_door_secret', 'west': 'cry_door_secret'}},
}
FIGHT_KINDS = {'fight', 'elite', 'boss', 'trapGauntlet'}


def num(v):
    v = round(float(v) + 0.0, 2) + 0.0
    return int(v) if v == int(v) else v


def camera_from(spec):
    side, pitch, dist, fov = spec
    dx, dz = COMPASS[side]
    L = math.hypot(dx, dz)
    dx, dz = dx / L, dz / L
    h = dist * math.cos(math.radians(pitch))
    y = dist * math.sin(math.radians(pitch))
    return {'position': [num(round(dx * h, 1)), num(round(y, 1)), num(round(dz * h, 1))], 'lookAt': [0, 1, 0], 'fov': fov}


def template_json(t):
    props = []
    for p in t['props']:
        d = {'meshId': p[0], 'position': [num(v) for v in p[1]], 'rotationY': num(p[2])}
        if len(p) > 3 and p[3].get('lightSource'):
            d['lightSource'] = True
        props.append(d)
    return {
        'id': t['id'], 'zoneId': ZONE_ID, 'footprint': {'w': t['w'], 'h': t['h']},
        'doors': [{'side': s, 'offset': o} for s, o in t['doors']],
        'kinds': list(t['kinds']), 'camera': camera_from(t['cam']), 'props': props,
        'triBudget': 30000, 'drawCallBudget': 40,
    }


def template_path(tdir, tid):
    """`<id>.json` once Phase 7 renames it, else `<id>.json.later`."""
    live = os.path.join(tdir, tid + '.json')
    return live if os.path.exists(live) else live + '.later'


def party_marks(tpl):
    """Approximate fight marks (`layout.ts` → fightSideFormation): the party left of the camera, the enemies right."""
    cam = tpl['camera']
    cdx = cam['position'][0] - cam['lookAt'][0]
    cdz = cam['position'][2] - cam['lookAt'][2]
    L = math.hypot(cdx, cdz) or 1.0
    cdx, cdz = cdx / L, cdz / L
    right = (cdz, -cdx)
    away = (-cdx, -cdz)
    W = tpl['footprint']['w'] * CELL
    D = tpl['footprint']['h'] * CELL
    lim = abs(right[0]) * W / 2 + abs(right[1]) * D / 2 - 0.7
    marks = []
    for x, d, who in ((-1.35, -0.55, 'hero'), (-1.35, 0.55, 'hero'), (-2.55, -0.5, 'hero'), (-2.55, 0.6, 'hero'),
                      (1.85, -0.7, 'foe'), (1.85, 0.7, 'foe'), (3.45, 0.0, 'foe')):
        x = max(-lim, min(lim, x + (d * 0.35 if x < 0 else -d * 0.35)))
        marks.append(((right[0] * x + away[0] * d, 0.0, right[1] * x + away[1] * d), who))
    return marks

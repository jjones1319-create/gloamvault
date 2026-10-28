"""build_kit_cellars.py — the shared room kit (`shr_`) and the Cellars kit (`cel_`), Phase 6 (07 §2.2, §2.4, §2.7).

Run (Blender 5.2, headless; ~3 minutes, ~1 with --quick):
  blender -b -P tools/blender/env/build_kit_cellars.py -- [--quick] [--no-bake] [--no-export] [--no-renders]
                                                          [--rooms cel-t-storeroom,cel-t-cistern] [--no-sheets]

Builds every piece procedurally with kit_lib.py (read its docstring for the conventions: pivots, the `gv` codes, the
bake, the export), bakes Cycles ambient occlusion into gv.B, writes
  tools/blender/palettes/cellars.json, shared.json             the 16-colour palettes (slot order)
  client/public/models/env/kit_shared.glb + shared.json        the shared pieces (they take the zone's palette in game)
  client/public/models/env/kit_cellars.glb + cellars.json      the Cellars pieces + the shell map the client builds from
  art/build/kit_cellars.blend                                  for inspection (git-ignored)
and renders the review set: art/renders/env/shared/kit_sheet.png, art/renders/env/cellars/kit_sheet.png, and every
Cellars template (content/dungeons/gravehollow-keep/templates/cel-t-*.json) assembled the way the client builds it —
floor tiles, walls cut down on the camera's side, doorways, corners, the props — seen from the template's own camera
with two warm point lights at its fires / sconces: room_<id>.png (2× phone) and room_<id>_phone.png (phone size).

THE SHELL (07 names these; the client builds floors and walls from them):
  floor    cel_floor_flag_a — variants cel_floor_flag_b (cracked, a raised corner: the Loose Flagstone) and
           cel_floor_dirt (packed earth: kennels, cisterns); 2 × 2 m, origin at the centre.
  wall     cel_wall_brick_2m — variant cel_wall_brick_dmg (collapsed top, rubble skirt); 2 m × 3.5 m.
  doorway  cel_door_arch — 4 m wide (a 2 m arched opening + 1 m of wall each side), replacing the two middle segments
           of a cell edge; cel_door_wood (a plank `leaf`), cel_door_portcullis (a lifting `gate`) and cel_door_secret
           (a sliding brick `panel`, looking like two plain segments) share its footprint.
  corner   cel_wall_corner_in — a dressed-stone pier in the corner square behind the two walls.
  cut-away (not in 07): cel_wall_brick_cut, cel_door_arch_cut, cel_wall_corner_cut — the same footprints cut to
           0.55 m (client CUTAWAY_HEIGHT) with their outer faces dressed, for the walls on the camera's side.
Pieces beyond 07's table: the props 07's Cellars template table names (cel_stool, cel_sack_pile, cel_bone_pile,
cel_chain_hanging, cel_lantern, cel_lantern_hook, cel_tripwire_rail, cel_dais, cel_chair_captain), the curio looks of
07 §2.4 that are not kit pieces yet (cel_dice_table, cel_larder, cel_toll_shrine, cel_gallows_beam), and the shared
shr_brazier (07: "shr_campfire on an iron stand", for guardposts) and shr_stairs_up (the entry's way up).

Floors and walls carry their detail as geometry (raised flagstones, bricks with lit top bevels), not as a texture:
D-110 / the Phase 6 contract has no textures, so 07's 2- and 24-triangle tile and wall numbers (written for a 2k
albedo atlas) are exceeded on purpose; the room budgets (≤ 30k triangles, the template's triBudget) are what holds.
"""
import glob
import math
import os
import random
import sys
import time
import zlib

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import kit_lib as K  # noqa: E402
from kit_lib import (STONE, DSTONE, WOOD, DWOOD, IRON, INK, CLOTH1, CLOTH2, ROPE, BMETAL, BRASS, GLOW, MOSS,  # noqa: E402
                     BONE, WATER, WALL_T)
from common import BUILD, CONTENT, RENDERS, REPO, args, log, read_json, save_blend  # noqa: E402

ARGS = args()
QUICK = bool(ARGS.get('quick'))
NO_BAKE = bool(ARGS.get('no_bake'))
NO_EXPORT = bool(ARGS.get('no_export'))
NO_RENDERS = bool(ARGS.get('no_renders'))
NO_SHEETS = bool(ARGS.get('no_sheets'))
ROOMS = [r for r in str(ARGS.get('rooms', '')).split(',') if r] if ARGS.get('rooms') else []

OUT_SHARED = os.path.join(RENDERS, 'env', 'shared')
OUT_CELLARS = os.path.join(RENDERS, 'env', 'cellars')
TEMPLATE_DIR = os.path.join(CONTENT, 'dungeons', 'gravehollow-keep', 'templates')

# ---------------------------------------------------------------------------------------------------- palettes
# slot order: stone (here: brick) · dark stone/mortar (+ floors) · wood · dark wood · iron · ink · cloth1 · cloth2 ·
# rope/straw · bright metal · brass/gold · glow · moss/damp · bone · gem/ember · water/glass
CELLARS = ['#7a5230', '#5d5650', '#7d5a36', '#4e3520', '#46444c', '#26201c', '#8e2f2a', '#b39b6b',
           '#a08a4a', '#a3a4ab', '#d4a03a', '#e8a33c', '#3f5a3a', '#d9cfb4', '#ff7a3a', '#3a6066']
SHARED = ['#8a8378', '#5e5a55', '#7a5634', '#4b3424', '#45454d', '#1d1b1c', '#7a2e2a', '#a89a78',
          '#9a8656', '#b0b3ba', '#d2a13c', '#ffb347', '#4f6b40', '#ddd3bc', '#7fd4ff', '#2f4a50']
CELLARS_ABOUT = ('The Cellars (07 §2.2): brick ochre #7A5230 in mortar grey #5B5650, damp green #3F5A3A, lantern '
                 'amber #E8A33C; warm browns and rust. Slot 0 is the walls\' brick, slot 1 the mortar and the '
                 'flagstone floor (its joints are ink), the earth floor borrows dark wood.')
SHARED_ABOUT = ('A neutral palette for reviewing the shared pieces (shr_). In game a shared piece takes the palette of '
                'the zone it stands in.')

SHELL = {'floor': 'cel_floor_flag_a', 'wall': 'cel_wall_brick_2m', 'doorway': 'cel_door_arch',
         'corner': 'cel_wall_corner_in', 'wallCut': 'cel_wall_brick_cut', 'doorwayCut': 'cel_door_arch_cut',
         'cornerCut': 'cel_wall_corner_cut'}
SHELL_EXTRA = {
    'floorAlt': [['cel_floor_flag_b', 0.12]],
    'floorDirt': 'cel_floor_dirt',
    'wallAlt': [['cel_wall_brick_dmg', 0.04]],
    'floorWhole': ['cel_floor_dirt'],      # a whole room or none: never mixed tile by tile with flagstones
    'doorways': {'open': 'cel_door_arch', 'wood': 'cel_door_wood', 'locked': 'cel_door_portcullis',
                 'secret': 'cel_door_secret'},
    'tile': 2.0, 'segment': 2.0, 'doorwayWidth': 4.0, 'opening': {'width': 2.0, 'spring': 2.1, 'apex': 3.1},
    'wallHeight': 3.5, 'wallThickness': 0.4, 'cutHeight': 0.55,
    'notes': ('Pivots: a wall, doorway or cut piece has its origin at the centre of its base on the room-side face '
              '(the room is its local +z in game space; masonry behind it to z −0.4); an 8 m cell edge is '
              'segment, doorway, segment (2 + 4 + 2 m) or four segments. Corner: origin on the room\'s inside '
              'corner, the room in its local +x/+z quadrant: NW rotationY 0, NE −90, SE 180, SW 90. Walls whose '
              'outer side faces the camera use the cut pieces. Floor tiles: 2 m, any quarter turn.'),
}
FLOOR_MIX = {           # 07: packed earth for the kennels and cisterns — a whole room of it (mixed in 2 m squares
    'cel-t-kennels': [('cel_floor_dirt', 1.0)],          # among flagstones it reads as a checkerboard, round 1)
    'cel-t-cistern': [('cel_floor_dirt', 1.0)],
}
SUBSTITUTE = {'cel-t-guardpost': {'shr_campfire': 'shr_brazier'}}   # 07: the guardpost's brazier is a fire on a stand
# The review rooms' light: an ambient that lands every open surface on the toon ramp's second step (the client's
# hemisphere light stands in here) and two warm point lights at the room's fires / sconces (2,700 K) weak enough that
# the steps change within ~3 m of a flame — round 2 showed 380 W lifting a whole 8 m room into the top two steps.
ROOM_AMBIENT = (0.34, 0.28, 0.23, 1.0)
TORCH_W, FIRE_W = 130.0, 220.0


def R(name):
    return random.Random(zlib.crc32(name.encode('utf-8')))


def T(x, y, z):
    return Matrix.Translation((x, y, z))


def Rz(deg):
    return Matrix.Rotation(math.radians(deg), 4, 'Z')


def Rx(deg):
    return Matrix.Rotation(math.radians(deg), 4, 'X')


def Ry(deg):
    return Matrix.Rotation(math.radians(deg), 4, 'Y')


def Sc(x, y=None, z=None):
    return Matrix.Diagonal((x, x if y is None else y, x if z is None else z, 1.0))


def jit(rng, a):
    return 0.5 + rng.uniform(-a, a)


# ---------------------------------------------------------------------------------------------------- helpers
def brk(g, rng, *a, **kw):
    """The Cellars' bricks: kit_lib.bricks with a livelier shade per brick (± 0.18 of G)."""
    kw.setdefault('var', 0.18)
    return K.bricks(g, rng, *a, **kw)


def framed_box(g, rng, centre, size, yaw, frame=0.075, slot_frame=DWOOD, slot_panel=WOOD, skip=('-z',)):
    """A crate: each visible face a dark frame round a lighter panel (coplanar)."""
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    m = T(*centre) @ Rz(yaw)
    c = [m @ Vector(p) for p in ((-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
                                 (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz))]
    sides = {'+z': (4, 5, 6, 7), '-z': (0, 3, 2, 1), '-y': (0, 1, 5, 4), '+y': (2, 3, 7, 6),
             '-x': (3, 0, 4, 7), '+x': (1, 2, 6, 5)}
    vp = jit(rng, 0.1)
    for k, idx in sides.items():
        if k in skip:
            continue
        q = [c[i] for i in idx]
        inner = []
        for i in range(4):
            a, b, d = q[i], q[(i + 1) % 4], q[i - 1]
            inner.append(a + (b - a).normalized() * frame + (d - a).normalized() * frame)
        for i in range(4):
            K.quad(g, q[i], q[(i + 1) % 4], inner[(i + 1) % 4], inner[i], slot_frame, vp - 0.08)
        g.pf(inner, slot_panel, vp + (0.05 if k == '+z' else 0.0))


def coping(g, x0, x1, z=3.35, top=3.5, over=0.035, slot=DSTONE):
    """The wall's top course: a dark stone cap standing a little proud (front + top); kept dark (G) so the cut tops
    frame the diorama instead of glaring."""
    K.quad(g, (x0, -over, z), (x1, -over, z), (x1, -over, top), (x0, -over, top), slot, 0.36)
    K.quad(g, (x0, -over, top), (x1, -over, top), (x1, WALL_T, top), (x0, WALL_T, top), slot, 0.24)


def end_caps(g, x0, x1, top=3.5, z=3.35, over=0.035):
    """The wall's two ends as its dark cross-section: hidden between neighbours, but where a full-height wall meets the
    cut-down corner on the camera's side its end shows (round 3: without them the wall read hollow, its coping a flap)."""
    sec = [(0.0, 0.0), (WALL_T, 0.0), (WALL_T, top), (-over, top), (-over, z), (0.0, z)]
    g.pf([(x1, y, zz) for y, zz in sec], DSTONE, 0.3)
    g.pf([(x0, y, zz) for y, zz in reversed(sec)], DSTONE, 0.3)


def block(g, xa, xb, za, zb, slot, var, y=-0.03, depth=0.03, bevel=0.02, sides=(True, True)):
    """A dressed stone standing proud of the wall plane y + depth: front, top bevel and its two ends."""
    p = [g.v(c) for c in ((xa, y, za), (xb, y, za), (xb, y, zb - bevel), (xa, y, zb - bevel))]
    g.f(p, slot, var)
    q2 = g.v((xb, y + depth, zb))
    q3 = g.v((xa, y + depth, zb))
    g.f((p[3], p[2], q2, q3), slot, min(1.0, var + 0.06))
    if sides[0]:
        K.quad(g, (xa, y + depth, za), (xa, y, za), (xa, y, zb - bevel), (xa, y + depth, zb), slot, var - 0.05)
    if sides[1]:
        K.quad(g, (xb, y, za), (xb, y + depth, za), (xb, y + depth, zb), (xb, y, zb - bevel), slot, var - 0.05)


def grin(g, centre, width, slot=BONE, teeth_slot=INK, y_of=None, n=8, thick=0.12):
    """The Grinning Company's painted grin on a surface facing −Y (y_of(x, z) gives the surface's y)."""
    cx, cz = centre
    yy = (lambda x, z: -0.006) if y_of is None else y_of
    R_ = width / 2 / math.sin(math.radians(70))
    cy0 = cz + R_ * math.cos(math.radians(70)) * 0.9
    outer, inner = [], []
    for i in range(n + 1):
        t = i / n
        a = math.radians(-160 + 140 * t)
        w = thick * (0.25 + 0.75 * math.sin(math.pi * t))
        px, pz = cx + math.cos(a) * R_, cy0 + math.sin(a) * R_
        nx, nz = math.cos(a), math.sin(a)
        outer.append((px + nx * w / 2, pz + nz * w / 2))
        inner.append((px - nx * w / 2, pz - nz * w / 2))
    for i in range(n):
        pts = [outer[i], outer[i + 1], inner[i + 1], inner[i]]
        g.pf([(x, yy(x, z), z) for x, z in pts], slot, 0.6)
    for i in range(1, n, 2):
        (ax, az), (bx, bz) = inner[i], outer[i]
        dx, dz = (bz - az), -(bx - ax)
        ln = math.hypot(dx, dz) or 1.0
        dx, dz = dx / ln * 0.012, dz / ln * 0.012
        pts = [(ax - dx, az - dz), (ax + dx, az + dz), (bx + dx, bz + dz), (bx - dx, bz - dz)]
        g.pf([(x, yy(x, z) - 0.002, z) for x, z in pts], teeth_slot, 0.5)
    for ex in (-0.32, 0.32):
        x0, z0 = cx + ex * width, cz + R_ * 0.55
        pts = [(x0, z0 - 0.05), (x0 + 0.045, z0), (x0, z0 + 0.05), (x0 - 0.045, z0)]
        g.pf([(x, yy(x, z), z) for x, z in pts], slot, 0.6)


def barrel_geo(g, rng, h=1.0, r_end=0.335, r_belly=0.42, n=10, m=None, hoops=(0.1, 0.17, 0.83, 0.9), lid=True):
    """A standing barrel: staves (each its own shade), two iron hoops, a sunk lid."""
    z = h
    prof = [(r_end, 0.0), (r_end + (r_belly - r_end) * 0.45, hoops[0] * z), (r_end + (r_belly - r_end) * 0.62, hoops[1] * z),
            (r_belly, 0.5 * z), (r_end + (r_belly - r_end) * 0.62, hoops[2] * z),
            (r_end + (r_belly - r_end) * 0.45, hoops[3] * z), (r_end, z), (r_end - 0.035, z), (r_end - 0.035, z - 0.04)]
    staves = [jit(rng, 0.09) for _ in range(n)]

    def slot(i, k):
        if i in (1, 4):
            return IRON
        if i in (6, 7):
            return DWOOD
        return WOOD

    def var(i, k):
        if i < 0:
            return 0.45
        return staves[k] if slot(i, k) == WOOD else 0.5
    mk = K.lathe(g, prof + ([(0.0, z - 0.04)] if lid else []), n, slot, var, smooth=40, cap0=False, cap1=not lid,
                 phase=rng.uniform(0, 1), m=m)
    return mk


def lantern_geo(g, at=(0, 0, 0), s=1.0, glass=GLOW, frame=IRON, handle=True):
    """A box lantern standing at `at`: base, four posts, glowing panes, a pyramid cap and a ring."""
    x, y, z = at
    b = 0.17 * s
    K.bevel_box(g, (x - b, y - b, z), (x + b, y + b, z + 0.06 * s), 0.015 * s, frame)
    for sx in (-1, 1):
        for sy in (-1, 1):
            K.box(g, (x + sx * (b - 0.025 * s) - 0.018 * s, y + sy * (b - 0.025 * s) - 0.018 * s, z + 0.06 * s),
                  (x + sx * (b - 0.025 * s) + 0.018 * s, y + sy * (b - 0.025 * s) + 0.018 * s, z + 0.5 * s), frame,
                  skip=('-z', '+z'))
    K.box(g, (x - b + 0.02 * s, y - b + 0.02 * s, z + 0.06 * s), (x + b - 0.02 * s, y + b - 0.02 * s, z + 0.48 * s), glass,
          var=0.62, skip=('-z', '+z'))
    K.hull(g, [(x - b - 0.02 * s, y - b - 0.02 * s, z + 0.48 * s), (x + b + 0.02 * s, y - b - 0.02 * s, z + 0.48 * s),
               (x + b + 0.02 * s, y + b + 0.02 * s, z + 0.48 * s), (x - b - 0.02 * s, y + b + 0.02 * s, z + 0.48 * s),
               (x, y, z + 0.66 * s)], frame)
    if handle:
        K.torus(g, 0.06 * s, 0.012 * s, 6, 3, frame, smooth=0, m=T(x, y, z + 0.71 * s) @ Rx(90))
    return (x, y, z + 0.28 * s)


# ---------------------------------------------------------------------------------------------------- shared kit
def chest(kit, mesh_id, w, d, h, lid_h, bands, hasps, budget):
    rng = R(mesh_id)
    g = K.Geo()
    hw, hd = w / 2, d / 2
    K.box(g, (-hw, -hd, 0), (hw, hd, h), WOOD, var=lambda s: jit(rng, 0.06), skip=('-z', '+z'))
    t = 0.055
    ix, iy = hw - t, hd - t
    K.box(g, (-ix, -iy, 0.08), (ix, iy, h), DWOOD, var=0.35, skip=('+z',), slots={'-z': INK}, m=Sc(-1, 1, 1))
    o = [(-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd)]
    i_ = [(-ix, -iy), (ix, -iy), (ix, iy), (-ix, iy)]
    for k in range(4):
        k2 = (k + 1) % 4
        K.quad(g, (*o[k], h), (*o[k2], h), (*i_[k2], h), (*i_[k], h), DWOOD, 0.45)
    for bx in bands:
        K.box(g, (bx - 0.04, -hd - 0.012, 0.0), (bx + 0.04, hd + 0.012, h + 0.004), IRON, var=0.5, skip=('-z', '+z'))
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * (hw - 0.048), sy * (hd - 0.048)
            K.box(g, (cx - 0.06, cy - 0.06, 0.0), (cx + 0.06, cy + 0.06, 0.13), IRON, var=0.42, skip=('-z',))
    for hx in hasps:
        K.box(g, (hx - 0.075, -hd - 0.02, h - 0.17), (hx + 0.075, -hd + 0.001, h - 0.02), BRASS, var=0.5, skip=('+y',))
        K.quad(g, (hx - 0.012, -hd - 0.021, h - 0.13), (hx + 0.012, -hd - 0.021, h - 0.13),
               (hx + 0.012, -hd - 0.021, h - 0.08), (hx - 0.012, -hd - 0.021, h - 0.08), INK)
    for sx in (-1, 1):
        K.torus(g, 0.07, 0.016, 6, 3, IRON, smooth=0, m=T(sx * (hw + 0.022), 0, h * 0.62) @ Ry(90))
    p = kit.add(mesh_id, g, budget=budget, sheet={'az': 32, 'el': 28})
    # the lid, modelled closed, hinged on the back top edge
    lg = K.Geo()
    n = 6
    prof = []
    for k in range(n + 1):
        a = math.pi - math.pi * k / n
        prof.append(((hd + 0.012) * math.cos(a), h + lid_h * math.sin(a)))
    xl, xr = -hw - 0.012, hw + 0.012
    L = [lg.v((xl, y, z)) for y, z in prof]
    Rr = [lg.v((xr, y, z)) for y, z in prof]
    lv = [jit(rng, 0.07) for _ in range(n)]
    for k in range(n):
        lg.f((L[k], Rr[k], Rr[k + 1], L[k + 1]), WOOD, lv[k], 35)
    lg.f(tuple(L), DWOOD, 0.45)
    lg.f(tuple(reversed(Rr)), DWOOD, 0.45)
    lg.f((L[0], L[n], Rr[n], Rr[0]), DWOOD, 0.3)
    for bx in bands:
        for k in range(n):
            (y0, z0), (y1, z1) = prof[k], prof[k + 1]
            s0 = 1.0 + 0.012 / max(0.1, hd)
            def pt(x, y, z):
                return (x, y * s0, h + (z - h) * (1 + 0.012 / lid_h))
            K.quad(lg, pt(bx - 0.04, y0, z0), pt(bx + 0.04, y0, z0), pt(bx + 0.04, y1, z1), pt(bx - 0.04, y1, z1), IRON, 0.5)
    for hx in hasps:
        K.box(lg, (hx - 0.035, -hd - 0.032, h - 0.14), (hx + 0.035, -hd - 0.014, h + 0.07), BRASS, var=0.55, skip=('+y',))
    kit.part(p, 'lid', lg, (0.0, hd, h), axis='x', note='hinge on the back top edge: open = rotation.x from 0 to about -1.9 rad')
    return p


def stairs_down(kit):
    rng = R('shr_stairs_down')
    g = K.Geo()
    n, tread, rise, y0 = 8, 0.5, 0.28, -1.5
    for i in range(n):
        ya, yb = y0 + i * tread, y0 + (i + 1) * tread
        top, prev = -(i + 1) * rise, -i * rise
        v = jit(rng, 0.06) - (0.04 if i % 2 else 0.0)
        K.quad(g, (-2, ya, top), (2, ya, top), (2, yb, top), (-2, yb, top), DSTONE, v)            # tread
        K.quad(g, (2, ya, top), (-2, ya, top), (-2, ya, prev), (2, ya, prev), DSTONE, v - 0.1)    # riser (faces back)
    deep = -2.6
    for x, yaw in ((-2.0, 90), (2.0, -90)):
        m = T(x, 0.5, 0.0) @ Rz(yaw)
        brk(g, rng, -2.0, 2.0, -1.34, 0.0, slot=STONE, base_z=0.0, grime=0.0, var=0.1, m=m)
        K.backing(g, -2.0, 2.0, deep, 0.0, DSTONE, y=0.025, var=0.3, m=m)
    m = T(0.0, 2.5, 0.0)
    brk(g, rng, -2.0, 2.0, -1.34, 0.0, slot=STONE, base_z=0.0, grime=0.0, var=0.1, m=m)
    K.backing(g, -2.0, 2.0, deep, 0.0, DSTONE, y=0.025, var=0.3, m=m)
    K.quad(g, (-2, -1.5, deep), (2, -1.5, deep), (2, 2.5, deep), (-2, 2.5, deep), INK, 0.3)
    K.bevel_box(g, (-2.3, -1.5, 0.0), (-2.0, 2.8, 0.14), 0.03, DSTONE, var=0.56)
    K.bevel_box(g, (2.0, -1.5, 0.0), (2.3, 2.8, 0.14), 0.03, DSTONE, var=0.56)
    K.bevel_box(g, (-2.0, 2.5, 0.0), (2.0, 2.8, 0.14), 0.03, DSTONE, var=0.56)

    def fade(co):
        return max(0.0, min(1.0, 1.0 + co.z / 2.3)) ** 1.25
    p = kit.add('shr_stairs_down', g, budget=400, role='prop', sheet={'az': 20, 'el': 50},
                bake={'ground_hole': (-2.0, -1.5, 2.0, 2.5), 'fade': fade})
    p.info['hole'] = [-2.0, -2.5, 2.0, 1.5]
    return p


def stairs_up(kit):
    rng = R('shr_stairs_up')
    g = K.Geo()
    n, tread, rise, y0 = 6, 0.5, 0.3, -1.5
    for i in range(n):
        ya, yb = y0 + i * tread, y0 + (i + 1) * tread
        top = (i + 1) * rise
        v = jit(rng, 0.06)
        K.quad(g, (-1.5, ya, top - rise), (1.5, ya, top - rise), (1.5, ya, top), (-1.5, ya, top), DSTONE, v - 0.12)
        K.quad(g, (-1.5, ya, top), (1.5, ya, top), (1.5, yb, top), (-1.5, yb, top), DSTONE, v)
    top = n * rise
    K.quad(g, (-1.5, 1.5, top), (1.5, 1.5, top), (1.5, 2.5, top), (-1.5, 2.5, top), DSTONE, 0.4)
    for sx in (-1, 1):
        x0, x1 = (-1.85, -1.5) if sx < 0 else (1.5, 1.85)
        # side walls: brick inner face (toward the stairs), plain outer face, a coping on top
        m = T(-1.5 if sx < 0 else 1.5, 0.5, 0.0) @ Rz(90 if sx < 0 else -90)
        brk(g, rng, -2.0, 2.0, 0.0, 2.35, slot=STONE, var=0.12, m=m)
        K.backing(g, -2.0, 2.0, 0.0, 2.35, DSTONE, y=0.025, m=m)
        K.box(g, (x0, -1.5, 0.0), (x1, 2.5, 2.35), STONE, var=0.4, skip=('-z', '+x' if sx < 0 else '-x'))
        K.bevel_box(g, (x0 - 0.04, -1.54, 2.35), (x1 + 0.04, 2.54, 2.47), 0.03, DSTONE, var=0.5)
    # the opening at the top: a dark arch in a short wall
    brk(g, rng, -1.5, 1.5, top, top + 1.6, slot=STONE, y=2.5, base_z=top,
             keep=lambda xa, xb, za, zb: not K.rect_hits_opening(xa, xb, za - top, zb - top, half=0.85, spring=0.8, margin=0.08))
    g.pf([(x, 2.53, z + top) for x, z in K.opening_outline(7, half=0.85, spring=0.8)], INK, 0.2)
    m2 = g.mark()
    K.backing(g, -1.5, 1.5, top, top + 1.6, DSTONE, y=2.525)
    p = kit.add('shr_stairs_up', g, budget=400, sheet={'az': 25, 'el': 30})
    p.info['footprint'] = [-1.85, -2.5, 1.85, 1.5]
    return p


def waystone(kit):
    rng = R('shr_waystone')
    g = K.Geo()
    base = 0.16
    K.bevel_box(g, (-0.78, -0.58, 0.0), (0.78, 0.52, base), 0.05, DSTONE, var=0.5)
    rings = [(0.0, 0.44, 0.54, 0.36, -0.34), (0.35, 0.39, 0.48, 0.31, -0.28), (0.9, 0.36, 0.45, 0.29, -0.255),
             (2.0, 0.33, 0.41, 0.27, -0.255), (2.33, 0.22, 0.31, 0.2, -0.18), (2.52, 0.08, 0.12, 0.08, -0.06)]
    rv = []
    for ri, (z, a, s, b, f) in enumerate(rings):
        flat = ri in (2, 3)
        pts = [(-a, f), (a, f), (s, 0.02), (0.6 * s, b), (-0.6 * s, b), (-s, 0.0)]
        ring = []
        for k, (x, y) in enumerate(pts):
            if not (flat and k < 2):
                x += rng.uniform(-0.03, 0.03)
                y += rng.uniform(-0.02, 0.02)
            ring.append(g.v((x, y, base + z)))
        rv.append(ring)
    for i in range(len(rv) - 1):
        for k in range(6):
            k2 = (k + 1) % 6
            s = MOSS if (i == 0 and rng.random() < 0.35) else STONE
            g.f((rv[i][k], rv[i][k2], rv[i + 1][k2], rv[i + 1][k]), s, jit(rng, 0.08))
    g.f(tuple(rv[-1]), STONE, 0.55)
    for k in range(6):
        a = 2 * math.pi * k / 6 + 0.4
        K.rock(g, rng, (math.cos(a) * 0.95, math.sin(a) * 0.75, 0.09), (0.16, 0.13, 0.1), DSTONE, n=7, var=jit(rng, 0.12))
    cz = base + 1.45
    path = []
    turns = 2.6
    for i in range(49):
        t = i / 48
        th = t * turns * 2 * math.pi
        r = 0.035 + 0.25 * t
        path.append((r * math.cos(th), -0.259, cz + r * math.sin(th)))
    K.ribbon(g, path, 0.048, GLOW, var=0.6, normal=(0, -1, 0), smooth=0)
    ring = [(0.345 * math.cos(2 * math.pi * i / 20), -0.257, cz + 0.345 * math.sin(2 * math.pi * i / 20)) for i in range(21)]
    K.ribbon(g, ring, 0.032, INK, var=0.4, normal=(0, -1, 0), smooth=0)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        x, z = 0.42 * math.cos(a), cz + 0.42 * math.sin(a)
        g.pf(((x - 0.025, -0.257, z - 0.04), (x + 0.025, -0.257, z - 0.04), (x + 0.025, -0.257, z + 0.04),
              (x - 0.025, -0.257, z + 0.04)), GLOW, 0.55)
    p = kit.add('shr_waystone', g, budget=800, sheet={'az': 25, 'el': 15})
    kit.fx(p, (0.0, -0.3, cz), 'glow')
    return p


def campfire(kit):
    rng = R('shr_campfire')
    g = K.Geo()
    for i in range(8):
        a = 2 * math.pi * i / 8 + rng.uniform(-0.12, 0.12)
        K.rock(g, rng, (math.cos(a) * 0.63, math.sin(a) * 0.63, 0.1), (0.16, 0.14, 0.12), DSTONE, n=6, var=jit(rng, 0.14))
    K.disc(g, 0.5, 8, DSTONE, z=0.012, var=0.22)
    K.disc(g, 0.28, 7, GLOW, z=0.03, var=0.5, rng=rng, jitter=0.2)
    for k in range(4):
        a = math.pi * k / 2 + 0.35
        K.tube(g, (math.cos(a) * 0.46, math.sin(a) * 0.46, 0.05), (math.cos(a) * 0.04, math.sin(a) * 0.04, 0.36), 0.055,
               DWOOD, n=5, var=jit(rng, 0.08))
    top = (0.0, 0.0, 1.28)
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.5
        K.tube(g, (math.cos(a) * 0.82, math.sin(a) * 0.82, 0.0), top, 0.022, IRON, n=4, cap0=False, cap1=False)
    K.tube(g, top, (0.0, 0.0, 0.96), 0.009, IRON, n=3, cap0=False)
    K.lathe(g, [(0.0, 0.70), (0.12, 0.72), (0.17, 0.80), (0.16, 0.92), (0.18, 0.95)], 7, IRON, var=0.45, cap1=False)
    K.disc(g, 0.155, 7, INK, z=0.9, var=0.4)
    p = kit.add('shr_campfire', g, budget=180, sheet={'az': 30, 'el': 32})
    kit.light(p, (0.0, 0.0, 0.42), 'fire')
    kit.fx(p, (0.0, 0.0, 0.06), 'embers')
    return p


def brazier(kit):
    rng = R('shr_brazier')
    g = K.Geo()
    # an iron bowl with a raised rim; a glowing bed sunk inside it under dark lumps of coal
    K.lathe(g, [(0.1, 0.80), (0.3, 0.9), (0.41, 1.03), (0.45, 1.14), (0.41, 1.14), (0.38, 1.08)], 8, IRON,
            var=lambda i, k: 0.45 if i < 3 else 0.32, cap0=True, cap1=False, smooth=50)
    K.disc(g, 0.385, 8, GLOW, z=1.06, var=0.5)
    for k in range(11):
        a = 2 * math.pi * k / 8 + rng.uniform(-0.25, 0.25)
        r = 0.0 if k == 0 else (0.16 if k < 4 else 0.28)
        K.rock(g, rng, (math.cos(a) * r, math.sin(a) * r, 1.1 - 0.15 * r), (0.11, 0.1, 0.075), INK, n=7,
               var=jit(rng, 0.15))
    for k in range(3):
        a = 2 * math.pi * k / 3
        K.tube(g, (math.cos(a) * 0.22, math.sin(a) * 0.22, 0.86), (math.cos(a) * 0.44, math.sin(a) * 0.44, 0.0), 0.028,
               IRON, n=4, var=0.4)
        K.bevel_box(g, (math.cos(a) * 0.44 - 0.06, math.sin(a) * 0.44 - 0.06, 0.0),
                    (math.cos(a) * 0.44 + 0.06, math.sin(a) * 0.44 + 0.06, 0.05), 0.012, IRON, var=0.4)
    K.torus(g, 0.3, 0.018, 8, 3, IRON, smooth=0, m=T(0, 0, 0.42))
    p = kit.add('shr_brazier', g, budget=180, sheet={'az': 30, 'el': 32})
    kit.light(p, (0.0, 0.0, 1.45), 'brazier')
    kit.fx(p, (0.0, 0.0, 1.2), 'embers')
    return p


def sconce(kit):
    g = K.Geo()
    K.box(g, (-0.08, 0.07, -0.17), (0.08, 0.1, 0.13), IRON, var=0.42, skip=('+y',))
    K.box(g, (-0.022, -0.21, -0.075), (0.022, 0.07, -0.035), IRON, var=0.5, skip=('+y',))
    K.lathe(g, [(0.035, -0.13), (0.065, -0.05), (0.072, -0.01)], 6, IRON, var=0.5, cap1=False, m=T(0, -0.23, 0))
    K.tube(g, (0.0, -0.22, -0.11), (0.0, -0.28, 0.29), 0.027, DWOOD, r1=0.034, n=5, var=0.45)
    K.tube(g, (0.0, -0.276, 0.24), (0.0, -0.284, 0.37), 0.046, ROPE, n=5, var=0.45)
    K.lathe(g, [(0.046, 0.0), (0.0, 0.06)], 5, GLOW, var=0.6, cap0=False, m=T(0.0, -0.284, 0.37))
    p = kit.add('shr_torch_sconce', g, budget=90, role='wall-hung', bake={'ground': -2.0, 'wall': 0.1},
                sheet={'az': 35, 'el': 18})
    kit.light(p, (0.0, -0.29, 0.52), 'torch')
    return p


def trap_plate(kit):
    g = K.Geo()
    K.bevel_box(g, (-0.48, -0.48, 0.0), (0.48, 0.48, 0.058), 0.016, DSTONE, var=0.47)
    o, i = 0.5, 0.48
    ring_o = [(-o, -o), (o, -o), (o, o), (-o, o)]
    ring_i = [(-i, -i), (i, -i), (i, i), (-i, i)]
    for k in range(4):
        k2 = (k + 1) % 4
        K.quad(g, (*ring_o[k], 0.05), (*ring_o[k2], 0.05), (*ring_i[k2], 0.05), (*ring_i[k], 0.05), INK, 0.4)
    kit.add('shr_trap_plate', g, budget=24, role='decal', sheet={'az': 30, 'el': 50})


def lore_tablet(kit):
    rng = R('shr_lore_tablet')
    g = K.Geo()
    K.bevel_box(g, (-0.42, -0.27, 0.0), (0.42, 0.27, 0.42), 0.04, DSTONE, var=0.48)
    outline = [(-0.36, 0.42), (0.36, 0.42), (0.36, 1.12)]
    for i in range(1, 5):
        a = math.pi * i / 5
        outline.append((0.36 * math.cos(a), 1.12 + 0.2 * math.sin(a)))
    outline.append((-0.36, 1.12))
    K.slab_xz(g, outline, -0.08, 0.08, STONE, var=lambda k: 0.5 if k != 'front' else 0.56)
    for j in range(5):
        z = 0.62 + j * 0.095
        w = 0.25 - (0.06 if j % 2 else 0.0) + rng.uniform(-0.03, 0.03)
        K.quad(g, (-w, -0.082, z), (w, -0.082, z), (w, -0.082, z + 0.032), (-w, -0.082, z + 0.032), INK, 0.4)
    K.disc(g, 0.07, 6, INK, var=0.4, m=T(0, -0.082, 1.17) @ Rx(90))
    kit.add('shr_lore_tablet', g, budget=160, sheet={'az': 25, 'el': 18})


def gold_pile(kit):
    rng = R('shr_gold_pile')
    g = K.Geo()
    # low rounded heaps of coin (smooth-shaded so they read as piles, not lumps), a coin or two lying on each, more
    # scattered round them on the floor
    for x, y, r in ((0.0, 0.0, 0.3), (0.36, 0.12, 0.21), (-0.28, 0.2, 0.18)):
        K.lathe(g, [(r, 0.0), (r * 0.78, r * 0.17), (r * 0.42, r * 0.31), (0.0, r * 0.36)], 7, BRASS,
                var=lambda i, k: (0.42, 0.55, 0.68)[min(i, 2)], phase=rng.uniform(0, 1), cap0=False, m=T(x, y, 0.0),
                smooth=70)
        for c in range(2):
            a = rng.uniform(0, 2 * math.pi)
            d = r * rng.uniform(0.15, 0.45)
            z = r * 0.36 * (1 - (d / r) ** 2 * 0.9) + 0.006
            K.disc(g, 0.05, 6, BRASS, z=z, var=0.85, m=T(x + math.cos(a) * d, y + math.sin(a) * d, 0.0) @ Rz(rng.uniform(0, 60)))
    for i in range(7):
        a = rng.uniform(0, 2 * math.pi)
        d = rng.uniform(0.38, 0.62)
        K.disc(g, 0.05, 6, BRASS, z=0.056, var=0.7, m=T(math.cos(a) * d, math.sin(a) * d * 0.8, 0.0) @ Rz(rng.uniform(0, 60)))
    kit.add('shr_gold_pile', g, budget=60, sheet={'az': 30, 'el': 45})


def door_frame_fx(kit):
    g = K.Geo()
    # up the left jamb, over the arch, down the right jamb — just inside the opening, in front of the dressings
    left_up =[(-0.97, -0.05, 0.02), (-0.97, -0.05, K.DOOR_SPRING)]
    arch = [(0.97 * math.cos(math.pi - math.pi * i / 9), -0.05, K.DOOR_SPRING + 0.97 * math.sin(math.pi - math.pi * i / 9))
            for i in range(1, 9)]
    right_down = [(0.97, -0.05, K.DOOR_SPRING), (0.97, -0.05, 0.02)]
    path = left_up + arch + right_down
    K.ribbon(g, path, 0.085, GLOW, var=0.6, normal=(0, -1, 0), smooth=0)
    K.quad(g, (-0.97, -0.4, 0.06), (0.97, -0.4, 0.06), (0.97, 0.0, 0.06), (-0.97, 0.0, 0.06), GLOW, 0.35)
    kit.add('shr_door_frame_fx', g, budget=40, role='decal', bake={'skip': True}, sheet={'az': 20, 'el': 15})


def build_shared(kit):
    chest(kit, 'shr_chest_small', 0.95, 0.62, 0.48, 0.2, bands=(-0.3, 0.3), hasps=(0.0,), budget=300)
    chest(kit, 'shr_chest_large', 1.5, 0.8, 0.58, 0.26, bands=(-0.5, 0.0, 0.5), hasps=(-0.3, 0.3), budget=520)
    stairs_down(kit)
    waystone(kit)
    campfire(kit)
    sconce(kit)
    trap_plate(kit)
    lore_tablet(kit)
    gold_pile(kit)
    door_frame_fx(kit)
    brazier(kit)
    stairs_up(kit)


# ---------------------------------------------------------------------------------------------------- the shell
def wall_seg(kit):
    g = K.Geo()
    brk(g, R('cel_wall_brick_2m'), -1, 1, 0, 3.35, slot=STONE, moss=0.07)
    K.backing(g, -1, 1, 0, 3.35)
    coping(g, -1, 1)
    end_caps(g, -1, 1)
    kit.add('cel_wall_brick_2m', g, budget=24, role='shell', sheet={'az': 25, 'el': 15},
            bake={'ground': 0.0, 'occluders': [('cel_wall_brick_2m', (-2, 0, 0)), ('cel_wall_brick_2m', (2, 0, 0))]})


def wall_dmg(kit):
    rng = R('cel_wall_brick_dmg')
    g = K.Geo()

    def notch(x):                       # the break, its two end columns left whole (they carry the coping)
        return min(3.35, 1.85 + 1.9 * (abs(x) / 0.78) ** 1.6)
    brk(g, rng, -1, 1, 0, 3.35, slot=STONE, moss=0.09, var=0.18,
             keep=lambda xa, xb, za, zb: zb <= notch((xa + xb) / 2) + 0.12)
    xs = [-1.0 + 0.1 * i for i in range(21)]
    top = [(x, notch(x) + (rng.uniform(-0.04, 0.04) if abs(x) < 0.95 else 0.0)) for x in xs]
    for (x0, z0), (x1, z1) in zip(top, top[1:]):
        K.quad(g, (x0, 0.025, 0.0), (x1, 0.025, 0.0), (x1, 0.025, z1), (x0, 0.025, z0), DSTONE, 0.4)
        K.quad(g, (x0, 0.025, z0), (x1, 0.025, z1), (x1, WALL_T, z1), (x0, WALL_T, z0), DSTONE, 0.26)
    coping(g, -1.0, -0.72)
    coping(g, 0.72, 1.0)
    end_caps(g, -1, 1)
    for i in range(9):
        x = rng.uniform(-0.8, 0.9)
        y = -rng.uniform(0.15, 0.85)
        s = rng.uniform(0.09, 0.2)
        K.rock(g, rng, (x, y, s * 0.6), (s * 1.3, s, s * 0.8), DSTONE if i % 3 else STONE, n=7, var=jit(rng, 0.15))
    for i in range(4):
        x = rng.uniform(-0.6, 0.8)
        y = -rng.uniform(0.1, 0.6)
        K.box(g, (-0.16, -0.08, 0.0), (0.16, 0.08, 0.13), STONE, var=jit(rng, 0.12), skip=('-z',),
              m=T(x, y, 0.0) @ Rz(rng.uniform(0, 180)))
    kit.add('cel_wall_brick_dmg', g, budget=180, role='shell', sheet={'az': 25, 'el': 15},
            bake={'ground': 0.0, 'occluders': [('cel_wall_brick_2m', (-2, 0, 0)), ('cel_wall_brick_2m', (2, 0, 0))]})


def wall_cut_geo(g, rng, x0, x1, h=K.CUT_H, moss=0.07):
    """A cut-down run x0..x1: bricks on both faces, mortar behind, the cut top."""
    brk(g, rng, x0, x1, 0, h, slot=STONE, moss=moss)
    K.backing(g, x0, x1, 0, h)
    m = T(0, WALL_T, 0) @ Rz(180)
    brk(g, rng, -x1, -x0, 0, h, slot=STONE, moss=moss, m=m)
    K.backing(g, -x1, -x0, 0, h, m=m)
    K.quad(g, (x0, 0.0, h), (x1, 0.0, h), (x1, WALL_T, h), (x0, WALL_T, h), DSTONE, 0.38)


def wall_cut(kit):
    g = K.Geo()
    wall_cut_geo(g, R('cel_wall_brick_cut'), -1, 1)
    kit.add('cel_wall_brick_cut', g, budget=None, role='shell', sheet={'az': 155, 'el': 30},
            bake={'ground': 0.0, 'occluders': [('cel_wall_brick_cut', (-2, 0, 0)), ('cel_wall_brick_cut', (2, 0, 0))]})


def doorway_geo(rng, quoin=True):
    """The 4 m arched doorway of the Cellars: brick, a dressed-stone surround, the reveal, a threshold, the void."""
    g = K.Geo()
    sp = K.DOOR_SPRING
    brk(g, rng, -2, 2, 0, 3.35, slot=STONE, moss=0.07,
             keep=lambda xa, xb, za, zb: not K.rect_hits_opening(xa, xb, za, zb, margin=0.24))
    K.backing(g, -2, -1, 0, 3.35)
    K.backing(g, 1, 2, 0, 3.35)
    for i in range(9):
        a0, a1 = math.pi - math.pi * i / 9, math.pi - math.pi * (i + 1) / 9
        P0 = (math.cos(a0), sp + math.sin(a0))
        P1 = (math.cos(a1), sp + math.sin(a1))
        K.quad(g, (P0[0], 0.025, P0[1]), (P1[0], 0.025, P1[1]), (P1[0], 0.025, 3.35), (P0[0], 0.025, 3.35), DSTONE, 0.45)
    for s in (-1, 1):
        z = 0.0
        for j in range(6):
            w = 0.45 if j % 2 == 0 else 0.3
            za, zb = j * 0.35 + 0.012, (j + 1) * 0.35 - 0.012
            v = jit(rng, 0.08)
            if s < 0:
                block(g, -1.0 - w, -1.0, za, zb, DSTONE, v, sides=(True, False))
            else:
                block(g, 1.0, 1.0 + w, za, zb, DSTONE, v, sides=(False, True))
    K.quad(g, (-1, -0.03, 0), (-1, WALL_T, 0), (-1, WALL_T, sp), (-1, -0.03, sp), DSTONE, 0.42)
    K.quad(g, (1, WALL_T, 0), (1, -0.03, 0), (1, -0.03, sp), (1, WALL_T, sp), DSTONE, 0.42)
    gap = 0.012
    for i in range(9):
        a0 = math.pi - math.pi * i / 9 - gap
        a1 = math.pi - math.pi * (i + 1) / 9 + gap
        ro = 1.46 if i == 4 else 1.36
        v = jit(rng, 0.08) + (0.06 if i == 4 else 0.0)
        i0 = (math.cos(a0), -0.03, sp + math.sin(a0))
        i1 = (math.cos(a1), -0.03, sp + math.sin(a1))
        o1 = (ro * math.cos(a1), -0.03, sp + ro * math.sin(a1))
        o0 = (ro * math.cos(a0), -0.03, sp + ro * math.sin(a0))
        K.quad(g, i0, i1, o1, o0, DSTONE, v)
        o0b = (ro * math.cos(a0), 0.0, sp + ro * math.sin(a0))
        o1b = (ro * math.cos(a1), 0.0, sp + ro * math.sin(a1))
        K.quad(g, o0, o1, o1b, o0b, DSTONE, v + 0.05)
    for i in range(9):
        a0, a1 = math.pi - math.pi * i / 9, math.pi - math.pi * (i + 1) / 9
        f0 = (math.cos(a0), -0.03, sp + math.sin(a0))
        f1 = (math.cos(a1), -0.03, sp + math.sin(a1))
        b0 = (math.cos(a0), WALL_T, sp + math.sin(a0))
        b1 = (math.cos(a1), WALL_T, sp + math.sin(a1))
        K.quad(g, f0, b0, b1, f1, DSTONE, 0.38)
    K.bevel_box(g, (-1.0, -0.09, 0.0), (1.0, WALL_T, 0.035), 0.01, DSTONE, var=0.5)
    g.pf([(x, WALL_T, z) for x, z in K.opening_outline(9)], INK, 0.25)
    coping(g, -2, 2)
    return g


DOOR_BAKE = {'ground': 0.0, 'occluders': [('cel_wall_brick_2m', (-3, 0, 0)), ('cel_wall_brick_2m', (3, 0, 0))]}


def door_arch(kit):
    kit.add('cel_door_arch', doorway_geo(R('cel_door_arch')), budget=220, role='shell', bake=DOOR_BAKE,
            sheet={'az': 25, 'el': 15})


def door_wood(kit):
    rng = R('cel_door_wood')
    p = kit.add('cel_door_wood', doorway_geo(R('cel_door_arch')), budget=480, role='shell', bake=DOOR_BAKE,
                sheet={'az': 25, 'el': 15})
    lg = K.Geo()
    r = 0.975
    n = 5
    edges = [-r + 2 * r * i / n for i in range(n + 1)]

    def ztop(x):
        return K.DOOR_SPRING + math.sqrt(max(0.0, r * r - x * x))
    for i in range(n):
        xa, xb = edges[i] + 0.006, edges[i + 1] - 0.006
        xm = (xa + xb) / 2
        poly = [(xa, 0.04), (xb, 0.04), (xb, ztop(xb)), (xm, ztop(xm)), (xa, ztop(xa))]
        K.slab_xz(lg, poly, 0.16, 0.23, WOOD, var=jit(rng, 0.08), back=True)
    for z in (0.5, 1.75):
        K.box(lg, (-0.95, 0.142, z - 0.045), (0.95, 0.16, z + 0.045), IRON, var=0.45, skip=('+y',))
        for x in (-0.8, -0.4, 0.0, 0.4, 0.8):
            K.box(lg, (x - 0.02, 0.135, z - 0.02), (x + 0.02, 0.142, z + 0.02), IRON, var=0.6, skip=('+y', '-z'))
    K.torus(lg, 0.07, 0.014, 6, 3, IRON, smooth=0, m=T(0.62, 0.135, 1.05) @ Rx(90))
    kit.part(p, 'leaf', lg, (-0.975, 0.195, 0.0), axis='y', note='hinge on the left jamb: open = rotation.y up to ±1.75 rad')
    return p


def door_portcullis(kit):
    rng = R('cel_door_portcullis')
    g = doorway_geo(R('cel_door_arch'))
    for s in (-1, 1):
        x = s * 0.997
        q = [(x, 0.17, 0.0), (x, 0.24, 0.0), (x, 0.24, K.DOOR_SPRING), (x, 0.17, K.DOOR_SPRING)]
        K.quad(g, *(q if s < 0 else [q[1], q[0], q[3], q[2]]), INK, 0.3)
    K.box(g, (-1.6, -0.06, 3.0), (-1.3, 0.0, 3.3), IRON, var=0.4, skip=('+y',))
    K.torus(g, 0.09, 0.02, 6, 3, IRON, smooth=0, m=T(-1.45, -0.07, 2.9) @ Rx(90))
    p = kit.add('cel_door_portcullis', g, budget=650, role='shell', bake=DOOR_BAKE, sheet={'az': 25, 'el': 15})
    gg = K.Geo()
    r = 0.985

    def ztop(x):
        return K.DOOR_SPRING + math.sqrt(max(0.0, r * r - x * x)) - 0.03
    for i in range(7):
        x = -0.84 + 0.28 * i
        K.box(gg, (x - 0.026, 0.175, 0.12), (x + 0.026, 0.227, ztop(x)), IRON, var=jit(rng, 0.06), skip=('-z', '+z'))
        K.hull(gg, [(x - 0.026, 0.175, 0.12), (x + 0.026, 0.175, 0.12), (x + 0.026, 0.227, 0.12), (x - 0.026, 0.227, 0.12),
                    (x, 0.201, 0.0)], IRON, var=0.55)
    for z in (0.5, 1.2, 1.9, 2.55):
        hw = 0.94 if z < K.DOOR_SPRING else math.sqrt(max(0.0, r * r - (z - K.DOOR_SPRING) ** 2)) - 0.05
        K.box(gg, (-hw, 0.165, z - 0.03), (hw, 0.237, z + 0.03), IRON, var=0.42)
    kit.part(p, 'gate', gg, (0.0, 0.2, 0.0), axis='y', note='lift: translate along +y (game up); 2.2 m clears a hero')
    return p


def door_secret(kit):
    rng = R('cel_door_secret')
    g = K.Geo()
    ph = 2.6
    for (x0, x1, z0, z1) in ((-2, -1, 0, 3.35), (1, 2, 0, 3.35), (-1, 1, ph, 3.35)):
        brk(g, rng, x0, x1, z0, z1, slot=STONE, phase_x=-2, moss=0.07)
        K.backing(g, x0, x1, z0, z1)
    coping(g, -2, 2)
    K.quad(g, (-1, 0.03, 0), (-1, WALL_T, 0), (-1, WALL_T, ph), (-1, 0.03, ph), DSTONE, 0.35)
    K.quad(g, (1, WALL_T, 0), (1, 0.03, 0), (1, 0.03, ph), (1, WALL_T, ph), DSTONE, 0.35)
    K.quad(g, (-1, 0.03, ph), (-1, WALL_T, ph), (1, WALL_T, ph), (1, 0.03, ph), DSTONE, 0.3)
    K.quad(g, (-1, WALL_T, 0.0), (1, WALL_T, 0.0), (1, WALL_T, ph), (-1, WALL_T, ph), INK, 0.25)
    K.quad(g, (-1, 0.03, 0.002), (1, 0.03, 0.002), (1, WALL_T, 0.002), (-1, WALL_T, 0.002), DSTONE, 0.4)
    p = kit.add('cel_door_secret', g, budget=120, role='shell', sheet={'az': 25, 'el': 15},
                bake={'ground': 0.0, 'occluders': [('cel_wall_brick_2m', (-3, 0, 0)), ('cel_wall_brick_2m', (3, 0, 0))]})
    pg = K.Geo()
    brk(pg, rng, -1, 1, 0, ph, slot=STONE, phase_x=-2, moss=0.07)
    K.backing(pg, -1, 1, 0, ph)
    kit.part(p, 'panel', pg, (0.0, 0.0, 0.0), axis='x',
             note='slides: push back 0.1 m (game −z), then along x by ±2 m behind the wall')
    return p


def door_arch_cut(kit):
    rng = R('cel_door_arch_cut')
    g = K.Geo()
    h = K.CUT_H
    for (x0, x1) in ((-2, -1), (1, 2)):
        brk(g, rng, x0, x1, 0, h, slot=STONE, phase_x=-2, moss=0.07)
        K.backing(g, x0, x1, 0, h)
        m = T(0, WALL_T, 0) @ Rz(180)
        brk(g, rng, -x1, -x0, 0, h, slot=STONE, phase_x=-2, moss=0.07, m=m)
        K.backing(g, -x1, -x0, 0, h, m=m)
        K.quad(g, (x0, 0.0, h), (x1, 0.0, h), (x1, WALL_T, h), (x0, WALL_T, h), DSTONE, 0.38)
    K.quad(g, (-1, 0.0, 0), (-1, WALL_T, 0), (-1, WALL_T, h), (-1, 0.0, h), DSTONE, 0.42)
    K.quad(g, (1, WALL_T, 0), (1, 0.0, 0), (1, 0.0, h), (1, WALL_T, h), DSTONE, 0.42)
    K.bevel_box(g, (-1.0, -0.09, 0.0), (1.0, WALL_T + 0.06, 0.035), 0.01, DSTONE, var=0.5)
    kit.add('cel_door_arch_cut', g, budget=None, role='shell', sheet={'az': 155, 'el': 30},
            bake={'ground': 0.0, 'occluders': [('cel_wall_brick_cut', (-3, 0, 0)), ('cel_wall_brick_cut', (3, 0, 0))]})


CORNER_P = 0.25      # how far the corner pier stands out of each wall


def corner(kit):
    """A dressed-stone pier in the corner: quoin courses (alternately 0.25 / 0.21 m proud) on its two room faces."""
    rng = R('cel_wall_corner_in')
    g = K.Geo()
    bev = 0.024
    for j in range(10):
        za, zb = j * 0.35, (j + 1) * 0.35
        p = CORNER_P if j % 2 == 0 else CORNER_P - 0.04
        zt = zb - bev
        v = jit(rng, 0.08)
        # face A toward Blender +X (along the north wall's face), face B toward −Y (along the west wall's face)
        K.quad(g, (p, -p, za), (p, 0.0, za), (p, 0.0, zt), (p, -p, zt), DSTONE, v)
        K.quad(g, (0.0, -p, za), (p, -p, za), (p, -p, zt), (0.0, -p, zt), DSTONE, v - 0.04)
        K.quad(g, (p, -p, zt), (p, 0.0, zt), (p - bev, 0.0, zb), (p - bev, -p + bev, zb), DSTONE, v + 0.06)
        K.quad(g, (0.0, -p, zt), (p, -p, zt), (p - bev, -p + bev, zb), (0.0, -p + bev, zb), DSTONE, v + 0.02)
    K.bevel_box(g, (-WALL_T - 0.02, -CORNER_P - 0.03, 3.5), (CORNER_P + 0.03, WALL_T + 0.02, 3.6), 0.025, DSTONE, var=0.5)
    kit.add('cel_wall_corner_in', g, budget=80, role='shell', sheet={'az': 45, 'el': 20})


def corner_cut(kit):
    g = K.Geo()
    K.bevel_box(g, (-WALL_T - 0.02, -CORNER_P, 0.0), (CORNER_P, WALL_T + 0.02, K.CUT_H + 0.03), 0.025, DSTONE, var=0.48)
    kit.add('cel_wall_corner_cut', g, budget=None, role='shell', sheet={'az': 135, 'el': 30})


def floor_a(kit):
    rng = R('cel_floor_flag_a')
    g = K.Geo()
    K.quad(g, (-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0), INK, 0.4)
    cells = [(-1, -1, 0.2, -0.2), (0.2, -1, 1, 0.2), (-0.2, 0.2, 1, 1), (-1, -0.2, -0.2, 1), (-0.2, -0.2, 0.2, 0.2)]
    for (x0, y0, x1, y1) in cells:
        K.flagstone(g, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], rng.uniform(0.024, 0.042), DSTONE, var=jit(rng, 0.21),
                    joint=0.045, bevel=0.028, tilt=(rng.uniform(-0.012, 0.012), rng.uniform(-0.012, 0.012)))
    kit.add('cel_floor_flag_a', g, budget=2, role='shell', sheet={'az': 30, 'el': 55}, bake=FLOOR_BAKE('cel_floor_flag_a'))


def FLOOR_BAKE(mid):
    return {'occluders': [(mid, (dx, dy, 0)) for dx in (-2, 0, 2) for dy in (-2, 0, 2) if dx or dy]}


def floor_b(kit):
    rng = R('cel_floor_flag_b')
    g = K.Geo()
    K.quad(g, (-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0), INK, 0.4)
    cells = [
        ([(-1, -1), (-0.5, -1), (-0.1, 0.0), (-1, 0.0)], 0.03, (0.0, 0.0)),
        ([(-0.5, -1), (0.1, -1), (0.1, 0.0), (-0.1, 0.0)], 0.022, (0.01, -0.01)),
        ([(0.1, -1), (1, -1), (1, 0.3), (0.1, 0.3)], 0.035, (-0.01, 0.005)),
        ([(-1, 0.0), (-0.3, 0.0), (-0.3, 1), (-1, 1)], 0.03, (0.006, 0.0)),
        ([(-0.3, 0.3), (1, 0.3), (1, 1), (-0.3, 1)], 0.062, (0.052, 0.07)),
        ([(-0.3, 0.0), (0.1, 0.0), (0.1, 0.3), (-0.3, 0.3)], 0.026, (0.0, 0.0)),
    ]
    for poly, h, tilt in cells:
        K.flagstone(g, poly, h, DSTONE, var=jit(rng, 0.2), joint=0.045, bevel=0.028, tilt=tilt)
    kit.add('cel_floor_flag_b', g, budget=12, role='shell', sheet={'az': 30, 'el': 55}, bake=FLOOR_BAKE('cel_floor_flag_b'))


def floor_dirt(kit):
    rng = R('cel_floor_dirt')
    g = K.Geo()
    n = 4
    hts = [[0.0 if i in (0, n) or j in (0, n) else rng.uniform(0.0, 0.035) for j in range(n + 1)] for i in range(n + 1)]
    pv = [[jit(rng, 0.12) - 0.04 for j in range(n)] for i in range(n)]
    K.surface(g, n, n, lambda i, j: (-1 + 2 * i / n, -1 + 2 * j / n, hts[i][j]), DWOOD, var=lambda i, j: pv[i][j], smooth=40)
    for i in range(3):
        x, y = rng.uniform(-0.7, 0.7), rng.uniform(-0.7, 0.7)
        K.rock(g, rng, (x, y, 0.03), (0.07, 0.055, 0.04), DSTONE, n=6, var=jit(rng, 0.15))
    for i in range(4):
        x, y = rng.uniform(-0.75, 0.75), rng.uniform(-0.75, 0.75)
        a = rng.uniform(0, math.pi)
        dx, dy = math.cos(a) * 0.16, math.sin(a) * 0.16
        K.ribbon(g, [(x - dx, y - dy, 0.045), (x + dx, y + dy, 0.05)], 0.025, ROPE, var=0.55, normal=(0, 0, 1))
    kit.add('cel_floor_dirt', g, budget=2, role='shell', sheet={'az': 30, 'el': 55}, bake=FLOOR_BAKE('cel_floor_dirt'))


def puddle(kit):
    rng = R('cel_floor_puddle')
    g = K.Geo()
    K.disc(g, 0.78, 11, WATER, z=0.056, var=0.42, rng=rng, jitter=0.22, scale=(1.0, 0.68))
    K.disc(g, 0.42, 8, WATER, z=0.057, var=0.72, rng=rng, jitter=0.2, scale=(1.0, 0.55), m=T(-0.08, 0.04, 0.0))
    K.disc(g, 0.18, 6, WATER, z=0.058, var=1.0, rng=rng, jitter=0.25, scale=(1.0, 0.45), m=T(-0.2, 0.1, 0.0))
    for (x, y, l) in ((-0.22, 0.12, 0.2), (0.18, -0.12, 0.13)):      # glints: the wet reflection reads as light
        K.quad(g, (x - l, y - 0.012, 0.059), (x + l, y - 0.03, 0.059), (x + l, y - 0.008, 0.059), (x - l, y + 0.012, 0.059),
               BMETAL, 0.9)
    kit.add('cel_floor_puddle', g, budget=2, role='decal', bake={'skip': True}, sheet={'az': 30, 'el': 55})


def grate(kit):
    g = K.Geo()
    o, i, z = 0.72, 0.52, 0.09
    ro = [(-o, -o), (o, -o), (o, o), (-o, o)]
    ri = [(-i, -i), (i, -i), (i, i), (-i, i)]
    for k in range(4):
        k2 = (k + 1) % 4
        K.quad(g, (*ro[k], z), (*ro[k2], z), (*ri[k2], z), (*ri[k], z), DSTONE, 0.5)
        K.quad(g, (*ro[k], 0.0), (*ro[k2], 0.0), (*ro[k2], z), (*ro[k], z), DSTONE, 0.42)
        K.quad(g, (*ri[k2], 0.03), (*ri[k], 0.03), (*ri[k], z), (*ri[k2], z), DSTONE, 0.3)
    K.quad(g, (-i, -i, 0.058), (i, -i, 0.058), (i, i, 0.058), (-i, i, 0.058), INK, 0.2)
    for b in range(5):
        x = -0.4 + 0.2 * b
        K.box(g, (x - 0.028, -i, 0.06), (x + 0.028, i, 0.1), IRON, var=0.48, skip=('-z', '-y', '+y'))
    for y in (-0.24, 0.24):
        K.box(g, (-i, y - 0.03, 0.06), (i, y + 0.03, 0.095), IRON, var=0.4, skip=('-z', '-x', '+x'))
    p = kit.add('cel_floor_grate', g, budget=60, role='decal', sheet={'az': 30, 'el': 50})
    kit.fx(p, (0.0, 0.0, 0.07), 'drip')


def shelf(kit):
    rng = R('cel_wall_shelf')
    g = K.Geo()
    yb, yf, h = 0.1, -0.18, 2.7
    K.quad(g, (-2.0, 0.09, 0.0), (2.0, 0.09, 0.0), (2.0, 0.09, h), (-2.0, 0.09, h), DWOOD, 0.3)
    for x in (-2.0, -0.7, 0.7, 2.0):
        K.bevel_box(g, (x - 0.05, yf - 0.02, 0.0), (x + 0.05, yb, h + 0.06), 0.02, DWOOD, var=jit(rng, 0.06))
    levels = [0.08, 0.72, 1.36, 2.0, 2.62]
    for z in levels:
        K.box(g, (-2.0, yf, z), (2.0, yb - 0.01, z + 0.05), WOOD, var=jit(rng, 0.06), skip=('+y', '-x', '+x'))
    for bay in range(3):
        xa = -2.0 + bay * 1.3333 + 0.12
        for li, z in enumerate(levels[:-1]):
            for k in range(6):
                if rng.random() < 0.18:
                    continue
                for row in range(2):
                    x = xa + 0.09 + k * 0.19 + (0.095 if row else 0.0)
                    if x > xa + 1.08:
                        continue
                    zz = z + 0.11 + row * 0.16
                    K.disc(g, 0.052, 5, WATER, var=0.35 + rng.uniform(0.0, 0.4), m=T(x, yf - 0.004, zz) @ Rx(90))
    kit.add('cel_wall_shelf', g, budget=320, role='wall-hung', bake={'ground': 0.0, 'wall': 0.1}, sheet={'az': 25, 'el': 15})


def low_wall(kit):
    rng = R('cel_wall_low')
    g = K.Geo()
    t = 0.15
    m_front = T(0, -t, 0)
    brk(g, rng, -1, 1, 0, 0.9, slot=STONE, moss=0.08, m=m_front)
    K.backing(g, -1, 1, 0, 0.9, m=m_front)
    m_back = T(0, t, 0) @ Rz(180)
    brk(g, rng, -1, 1, 0, 0.9, slot=STONE, moss=0.08, m=m_back)
    K.backing(g, -1, 1, 0, 0.9, m=m_back)
    K.bevel_box(g, (-1.03, -t - 0.04, 0.9), (1.03, t + 0.04, 1.02), 0.025, DSTONE, var=0.5)
    for s in (-1, 1):
        x = s * 1.0
        if s < 0:
            K.quad(g, (x, t, 0), (x, -t, 0), (x, -t, 0.9), (x, t, 0.9), STONE, 0.42)
        else:
            K.quad(g, (x, -t, 0), (x, t, 0), (x, t, 0.9), (x, -t, 0.9), STONE, 0.42)
    kit.add('cel_wall_low', g, budget=40, sheet={'az': 30, 'el': 25})


def pillar(kit):
    rng = R('cel_pillar_brick')
    g = K.Geo()
    K.bevel_box(g, (-0.4, -0.4, 0.0), (0.4, 0.4, 0.24), 0.04, DSTONE, var=0.5)
    z = 0.24
    hgt = (3.3 - 0.24) / 9
    for j in range(9):
        w = 0.3 + rng.uniform(-0.012, 0.012) + (0.012 if j % 2 else 0.0)
        bev = 0.022
        za, zb = z + 0.012, z + hgt
        ring_b = [(-w, -w), (w, -w), (w, w), (-w, w)]
        ring_t = [(-w + bev, -w + bev), (w - bev, -w + bev), (w - bev, w - bev), (-w + bev, w - bev)]
        fv = [jit(rng, 0.1) for _ in range(4)]
        for k in range(4):
            k2 = (k + 1) % 4
            K.quad(g, (*ring_b[k], za), (*ring_b[k2], za), (*ring_b[k2], zb - bev), (*ring_b[k], zb - bev), STONE, fv[k])
            K.quad(g, (*ring_b[k], zb - bev), (*ring_b[k2], zb - bev), (*ring_t[k2], zb), (*ring_t[k], zb), STONE, fv[k] + 0.06)
        g.pf([(*p, zb) for p in ring_t], DSTONE, 0.4)
        z += hgt
    K.bevel_box(g, (-0.42, -0.42, 3.3), (0.42, 0.42, 3.5), 0.04, DSTONE, var=0.52)
    kit.add('cel_pillar_brick', g, budget=48, sheet={'az': 35, 'el': 20})


def beam(kit):
    rng = R('cel_beam_timber')
    g = K.Geo()
    c, h = 0.045, 0.165
    oct_ = [(-h + c, -h), (h - c, -h), (h, -h + c), (h, h - c), (h - c, h), (-h + c, h), (-h, h - c), (-h, -h + c)]
    # the section in XZ, swept along Y (the beam runs along game z = Blender −Y)
    pts = [(x, z) for x, z in oct_]
    K.slab_xz(g, pts, -4.0, 4.0, DWOOD, var=lambda k: 0.45 + (0.08 if k in (4, 5) else 0.0), smooth=0)
    for y in (-3.55, 3.55):
        K.box(g, (-h - 0.012, y - 0.06, -h - 0.012), (h + 0.012, y + 0.06, h + 0.012), IRON, var=0.45, skip=('-y', '+y'))
    for y in (-2.0, 0.6, 2.6):
        K.tube(g, (0, y, -h), (0, y, -h - 0.3), 0.016, IRON, n=4, cap0=False)
        K.tube(g, (0, y, -h - 0.3), (0, y - 0.09, -h - 0.22), 0.016, IRON, n=4, cap0=False)
    kit.add('cel_beam_timber', g, budget=36, role='hanging', bake={'ground': -3.5}, sheet={'az': 70, 'el': 25})


def barrel(kit):
    rng = R('cel_barrel')
    g = K.Geo()
    barrel_geo(g, rng)
    kit.add('cel_barrel', g, budget=160, sheet={'az': 30, 'el': 25})


def cask(kit):
    rng = R('cel_cask_large')
    g = K.Geo()
    zc = 0.86
    prof = [(0.5, -1.0), (0.535, -0.86), (0.555, -0.76), (0.6, 0.0), (0.555, 0.76), (0.535, 0.86), (0.5, 1.0),
            (0.46, 1.0), (0.46, 0.96)]
    staves = [jit(rng, 0.09) for _ in range(12)]

    def slot(i, k):
        if i in (1, 4):
            return IRON
        if i in (6, 7):
            return DWOOD
        return WOOD
    m = T(0, 0, zc) @ Ry(90)
    K.lathe(g, prof + [(0.0, 0.96)], 12, slot, lambda i, k: staves[k] if i >= 0 and slot(i, k) == WOOD else 0.48,
            smooth=35, cap0=False, cap1=False, m=m)
    K.lathe(g, [(0.0, -0.96), (0.46, -0.96), (0.46, -1.0), (0.5, -1.0)], 12, DWOOD, 0.46, smooth=0, cap0=False,
            cap1=False, m=m)
    for x in (-0.55, 0.55):
        # a saddle: the polygon in the YZ plane (y right seen from +X), extruded along X
        poly = [(-0.52, 0.0), (0.52, 0.0), (0.52, 0.12), (0.4, 0.42), (0.0, 0.3), (-0.4, 0.42), (-0.52, 0.12)]
        K.slab_xz(g, poly, -0.1, 0.1, DWOOD, var=0.42, m=T(x, 0, 0) @ Rz(90))
    K.tube(g, (0.0, 0.0, zc + 0.585), (0.0, 0.0, zc + 0.66), 0.05, DWOOD, n=6, var=0.4)
    K.disc(g, 0.07, 6, CLOTH1, z=zc + 0.662, var=0.55)
    K.tube(g, (1.0, 0.0, zc - 0.22), (1.13, 0.0, zc - 0.22), 0.028, BRASS, n=5, var=0.55)
    K.box(g, (1.1, -0.012, zc - 0.22), (1.124, 0.012, zc - 0.1), BRASS, var=0.6)
    kit.add('cel_cask_large', g, budget=320, sheet={'az': 40, 'el': 22})


def crates(kit):
    rng = R('cel_crate_stack')
    g = K.Geo()
    framed_box(g, rng, (-0.47, 0.0, 0.45), (0.9, 0.9, 0.9), 6)
    framed_box(g, rng, (0.47, 0.04, 0.45), (0.9, 0.9, 0.9), -7)
    framed_box(g, rng, (0.02, 0.02, 1.3), (0.8, 0.8, 0.8), 14)
    kit.add('cel_crate_stack', g, budget=36, sheet={'az': 30, 'el': 25})


def table(kit):
    rng = R('cel_table_long')
    g = K.Geo()
    for i in range(3):
        y0 = -0.5 + i * 0.334 + 0.008
        K.bevel_box(g, (-2.0, y0, 0.78), (2.0, y0 + 0.318, 0.86), 0.014, WOOD, var=jit(rng, 0.08))
    for x in (-1.55, 1.55):
        K.box(g, (x - 0.06, -0.06, 0.0), (x + 0.06, 0.06, 0.78), DWOOD, var=0.42, skip=('-z', '+z'))
        K.box(g, (x - 0.07, -0.42, 0.0), (x + 0.07, 0.42, 0.1), DWOOD, var=0.4, skip=('-z',))
        K.box(g, (x - 0.065, -0.45, 0.7), (x + 0.065, 0.45, 0.78), DWOOD, var=0.4, skip=('+z',))
    K.box(g, (-1.5, -0.05, 0.3), (1.5, 0.05, 0.4), DWOOD, var=0.38, skip=('-x', '+x'))
    for s in (-1, 1):
        y = s * 0.85
        K.bevel_box(g, (-1.8, y - 0.16, 0.42), (1.8, y + 0.16, 0.48), 0.012, WOOD, var=jit(rng, 0.08))
        for x in (-1.45, 1.45):
            K.box(g, (x - 0.05, y - 0.13, 0.0), (x + 0.05, y + 0.13, 0.42), DWOOD, var=0.42, skip=('-z', '+z'))
    for x, y in ((-1.1, 0.2), (0.35, -0.22), (1.25, 0.12)):
        K.lathe(g, [(0.05, 0.86), (0.055, 0.99), (0.042, 0.99), (0.042, 0.95)], 6, BMETAL, var=0.5, cap0=False,
                m=T(x, y, 0.0), smooth=0)
    K.disc(g, 0.17, 8, BONE, z=0.865, var=0.55, m=T(-0.45, 0.12, 0.0))
    kit.add('cel_table_long', g, budget=200, sheet={'az': 30, 'el': 30})


def rat_nest(kit):
    rng = R('cel_rat_nest')
    g = K.Geo()
    mound = []
    for ring, (rr, zz, cnt) in enumerate(((1.0, 0.0, 9), (0.72, 0.22, 7), (0.38, 0.4, 5), (0.08, 0.47, 2))):
        for k in range(cnt):
            a = 2 * math.pi * k / cnt + ring * 0.4 + rng.uniform(-0.15, 0.15)
            s = rr * rng.uniform(0.88, 1.08)
            mound.append((math.cos(a) * 0.85 * s, math.sin(a) * 0.65 * s, zz * rng.uniform(0.85, 1.12)))
    K.hull(g, mound, ROPE, var=lambda c, n: jit(rng, 0.14))
    for i in range(10):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(0.3, 0.75)
        base = (math.cos(a) * r * 0.9, math.sin(a) * r * 0.7, 0.18 * (1 - r))
        tip = (base[0] + math.cos(a) * 0.25, base[1] + math.sin(a) * 0.2, base[2] + rng.uniform(0.12, 0.3))
        K.hull(g, [base, (base[0] + 0.05, base[1], base[2]), (base[0], base[1] + 0.05, base[2]), tip], ROPE,
               var=jit(rng, 0.15) + 0.08)
    for i in range(4):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(0.35, 0.8)
        c = Vector((math.cos(a) * r * 0.9, math.sin(a) * r * 0.75, 0.12 + (0.2 if r < 0.5 else 0.0)))
        d = Vector((math.cos(a + 1.6), math.sin(a + 1.6), rng.uniform(-0.2, 0.2))).normalized() * 0.2
        K.tube(g, c - d, c + d, 0.022, BONE, n=4, var=0.55)
        for e in (c - d, c + d):
            K.rock(g, rng, tuple(e), (0.04, 0.04, 0.035), BONE, n=6, var=0.6, flat=False)
    for s, (x, y) in ((CLOTH1, (-0.35, -0.35)), (CLOTH2, (0.4, 0.3))):
        K.surface(g, 2, 2, lambda i, j, x=x, y=y: (x - 0.2 + 0.2 * i, y - 0.15 + 0.15 * j, 0.2 + 0.05 * ((i + j) % 2)), s,
                  var=0.45, smooth=0)
    kit.add('cel_rat_nest', g, budget=260, sheet={'az': 30, 'el': 35})


def cage(kit):
    rng = R('cel_cage_hanging')
    g = K.Geo()
    r, z0, z1 = 0.5, -0.65, 0.55
    for k in range(9):
        a = 2 * math.pi * k / 9
        K.tube(g, (math.cos(a) * r, math.sin(a) * r, z0), (math.cos(a) * r, math.sin(a) * r, z1), 0.018, IRON, n=4,
               cap0=False, cap1=False, var=0.45)
    for z, hgt in ((z0, 0.07), (-0.05, 0.05), (z1 - 0.04, 0.06)):
        K.lathe(g, [(r + 0.02, z), (r + 0.02, z + hgt), (r - 0.02, z + hgt), (r - 0.02, z)], 9,
                lambda i, k: IRON, var=lambda i, k: 0.3 if i == 2 else 0.5, cap0=False, cap1=False, smooth=45)
    K.lathe(g, [(r + 0.02, z0), (0.0, z0)], 9, IRON, var=0.35, cap0=False, cap1=False, smooth=0)
    K.lathe(g, [(r + 0.03, z1 + 0.02), (0.05, z1 + 0.32), (0.0, z1 + 0.33)], 9, IRON, var=0.5, cap0=False, smooth=0)
    K.torus(g, 0.06, 0.014, 6, 3, IRON, smooth=0, m=T(0, 0, z1 + 0.4) @ Rx(90))
    K.chain(g, (0, 0, z1 + 0.45), (0, 0, z1 + 1.45), IRON, link=0.17, wire=0.016)
    p = kit.add('cel_cage_hanging', g, budget=420, role='hanging', bake={'ground': -2.5}, sheet={'az': 30, 'el': 15})
    pg = K.Geo()
    K.rock(pg, rng, (0.05, 0.08, -0.38), (0.24, 0.2, 0.26), CLOTH2, n=10, var=0.42, flat=False)
    K.rock(pg, rng, (0.08, -0.02, -0.05), (0.13, 0.12, 0.14), ROPE, n=9, var=0.55, flat=False)
    K.rock(pg, rng, (0.12, -0.03, 0.05), (0.13, 0.11, 0.07), ROPE, n=7, var=0.3, flat=False)
    for s in (-1, 1):
        K.tube(pg, (s * 0.18, 0.02, -0.25), (s * 0.4, -0.18, -0.02), 0.045, ROPE, n=5, var=0.5)
        K.tube(pg, (s * 0.12, -0.05, -0.55), (s * 0.18, -0.38, -0.6), 0.055, CLOTH2, n=5, var=0.38)
    kit.part(p, 'prisoner', pg, (0.0, 0.0, 0.0), axis='none', note='optional: show for the Hanging Cage curio')
    return p


def banner(kit):
    rng = R('cel_banner_grin')
    g = K.Geo()
    w, top, bot = 0.5, 0.95, -0.95

    def yof(x, z):
        return -0.035 * math.sin((x + 0.5) * 3.1) * (0.4 + 0.6 * (top - z) / (top - bot)) - 0.01
    nu, nv = 3, 4
    cut = [bot + 0.0, bot + 0.2, bot - 0.05, bot + 0.22]

    def pt(i, j):
        x = -w + 2 * w * i / nu
        zb = cut[i]
        z = zb + (top - zb) * j / nv
        return (x, yof(x, z), z)
    K.surface(g, nu, nv, pt, CLOTH1, var=lambda i, j: 0.5 + (0.06 if j > 2 else 0.0) - (0.05 if j == 0 else 0.0), smooth=50)
    grin(g, (0.0, -0.05), 0.72, y_of=lambda x, z: yof(x, z) - 0.006)
    K.box(g, (-0.62, -0.03, top), (0.62, 0.01, top + 0.05), IRON, var=0.45)
    for x in (-0.55, 0.55):
        K.box(g, (x - 0.02, 0.01, top), (x + 0.02, 0.1, top + 0.04), IRON, var=0.4, skip=('+y',))
    kit.add('cel_banner_grin', g, budget=60, role='wall-hung', bake={'ground': -2.5, 'wall': 0.1}, sheet={'az': 25, 'el': 10})


def cart(kit):
    rng = R('cel_merchant_cart')
    g = K.Geo()
    framed_box(g, rng, (0.0, 0.0, 0.76), (1.8, 1.0, 0.42), 0, frame=0.07)
    for y in (-0.56, 0.56):
        m = T(0.25, y, 0.48) @ Rx(90)
        s = -1 if y < 0 else 1
        K.lathe(g, [(0.47, -0.05), (0.47, 0.05)], 12, IRON, var=0.45, cap0=False, cap1=False, smooth=40, m=m)
        K.lathe(g, [(0.47, 0.05), (0.43, 0.05), (0.0, 0.05)], 12, lambda i, k: IRON if i == 0 else DWOOD, var=0.42,
                cap0=False, cap1=False, smooth=0, m=m)
        K.lathe(g, [(0.0, -0.05), (0.43, -0.05), (0.47, -0.05)], 12, lambda i, k: DWOOD if i == 0 else IRON, var=0.42,
                cap0=False, cap1=False, smooth=0, m=m)
        for k in range(4):
            a = math.pi * k / 4
            for face in (-1, 1):
                yy = y + face * 0.053
                pts = [(0.25 + math.cos(a) * 0.4 - math.sin(a) * 0.03, yy, 0.48 + math.sin(a) * 0.4 + math.cos(a) * 0.03),
                       (0.25 - math.cos(a) * 0.4 - math.sin(a) * 0.03, yy, 0.48 - math.sin(a) * 0.4 + math.cos(a) * 0.03),
                       (0.25 - math.cos(a) * 0.4 + math.sin(a) * 0.03, yy, 0.48 - math.sin(a) * 0.4 - math.cos(a) * 0.03),
                       (0.25 + math.cos(a) * 0.4 + math.sin(a) * 0.03, yy, 0.48 + math.sin(a) * 0.4 - math.cos(a) * 0.03)]
                g.pf(pts[::-1] if face > 0 else pts, WOOD, 0.55)
        K.tube(g, (0.25, y - 0.09 * s, 0.48), (0.25, y + 0.08 * s, 0.48), 0.07, IRON, n=6, var=0.5)
    for y in (-0.38, 0.38):
        K.tube(g, (-0.9, y, 0.7), (-2.05, y, 0.62), 0.035, DWOOD, n=5, var=0.45)
    K.tube(g, (-1.98, -0.42, 0.63), (-1.98, 0.42, 0.63), 0.03, DWOOD, n=5, var=0.4)
    for x in (0.82,):
        for y in (-0.38, 0.38):
            K.box(g, (x - 0.04, y - 0.04, 0.0), (x + 0.04, y + 0.04, 0.55), DWOOD, var=0.4, skip=('-z', '+z'))
    for x, y in ((-0.85, -0.47), (0.85, -0.47), (-0.85, 0.47), (0.85, 0.47)):
        K.box(g, (x - 0.03, y - 0.03, 0.97), (x + 0.03, y + 0.03, 2.05), DWOOD, var=0.42, skip=('-z', '+z'))
    nu = 6
    sag = 0.06

    def roof(i, j):
        x = -1.0 + 2.0 * i / nu
        y = -0.62 + 1.24 * j / 2
        return (x, y, 2.12 - sag * math.sin(math.pi * j / 2) + 0.12 * (j / 2))
    K.surface(g, nu, 2, roof, lambda i, j: CLOTH1 if i % 2 else CLOTH2, var=0.5, smooth=30)
    for i in range(nu):
        x0, x1 = -1.0 + 2.0 * i / nu, -1.0 + 2.0 * (i + 1) / nu
        g.pf(((x1, -0.62, 2.12), (x0, -0.62, 2.12), ((x0 + x1) / 2, -0.62, 1.94)), CLOTH1 if i % 2 else CLOTH2, 0.46)
    framed_box(g, rng, (-0.35, 0.05, 1.18), (0.5, 0.45, 0.4), 12, frame=0.05)
    for x, y, s in ((0.35, -0.15, 0.22), (0.62, 0.2, 0.19)):
        K.rock(g, rng, (x, y, 0.97 + s * 0.7), (s, s * 0.85, s * 0.8), CLOTH2, n=9, var=jit(rng, 0.1), smooth=50)
    K.lathe(g, [(0.08, 0.97), (0.14, 1.07), (0.1, 1.2), (0.06, 1.25)], 7, BRASS, var=0.5, cap0=False, m=T(0.0, 0.32, 0.0))
    for x in (0.12, 0.2):
        K.lathe(g, [(0.04, 0.97), (0.045, 1.15), (0.016, 1.2), (0.016, 1.27)], 6, WATER, var=0.5, cap0=False,
                m=T(x, -0.32, 0.0), smooth=40)
    K.box(g, (0.85, -0.47, 1.86), (1.12, -0.44, 1.9), IRON, var=0.4)
    lamp = lantern_geo(g, (1.1, -0.455, 1.33), s=0.75)
    p = kit.add('cel_merchant_cart', g, budget=900, sheet={'az': 35, 'el': 25})
    kit.light(p, lamp, 'lamp')
    return p


# ---------------------------------------------------------------------------------------------------- extras
def stool(kit):
    rng = R('cel_stool')
    g = K.Geo()
    K.lathe(g, [(0.0, 0.40), (0.21, 0.40), (0.22, 0.46), (0.0, 0.46)], 8, WOOD, var=jit(rng, 0.06), smooth=0,
            cap0=False, cap1=False)
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.3
        K.tube(g, (math.cos(a) * 0.13, math.sin(a) * 0.13, 0.4), (math.cos(a) * 0.22, math.sin(a) * 0.22, 0.0), 0.025,
               DWOOD, n=4, var=0.42, cap0=False)
    kit.add('cel_stool', g, budget=None, sheet={'az': 30, 'el': 25})


def sack_pile(kit):
    rng = R('cel_sack_pile')
    g = K.Geo()
    for (x, y, z, sx, sy, sz) in ((-0.3, 0.0, 0.26, 0.32, 0.28, 0.27), (0.32, 0.05, 0.25, 0.3, 0.27, 0.26),
                                  (0.02, 0.1, 0.62, 0.3, 0.26, 0.22)):
        K.rock(g, rng, (x, y, z), (sx, sy, sz), CLOTH2, n=11, var=jit(rng, 0.1), smooth=55, flat=(z < 0.4))
        K.tube(g, (x, y, z + sz * 0.85), (x + 0.03, y, z + sz * 1.15), 0.05, CLOTH2, r1=0.07, n=5, var=0.42)
        K.torus(g, 0.052, 0.012, 6, 3, ROPE, smooth=0, m=T(x + 0.01, y, z + sz * 0.95))
    kit.add('cel_sack_pile', g, budget=None, sheet={'az': 30, 'el': 25})


def bone_pile(kit):
    rng = R('cel_bone_pile')
    g = K.Geo()
    K.rock(g, rng, (0.0, 0.0, 0.08), (0.55, 0.45, 0.12), DSTONE, n=9, var=0.35)
    for i in range(9):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(0.0, 0.42)
        c = Vector((math.cos(a) * r, math.sin(a) * r * 0.8, 0.16 + rng.uniform(0.0, 0.12)))
        d = Vector((math.cos(a + rng.uniform(0.8, 2.3)), math.sin(a + rng.uniform(0.8, 2.3)), rng.uniform(-0.25, 0.25)))
        d = d.normalized() * rng.uniform(0.16, 0.24)
        K.tube(g, c - d, c + d, 0.022, BONE, n=4, var=jit(rng, 0.08))
        for e in (c - d, c + d):
            K.rock(g, rng, tuple(e), (0.038, 0.038, 0.032), BONE, n=6, var=0.55, flat=False)
    for x, y in ((-0.18, -0.12), (0.22, 0.05)):
        K.rock(g, rng, (x, y, 0.33), (0.11, 0.13, 0.1), BONE, n=10, var=0.6, flat=False, smooth=60)
        for ex in (-0.04, 0.04):
            K.disc(g, 0.022, 5, INK, var=0.4, m=T(x + ex, y - 0.125, 0.34) @ Rx(90))
    kit.add('cel_bone_pile', g, budget=None, sheet={'az': 30, 'el': 30})


def chain_hanging(kit):
    g = K.Geo()
    K.torus(g, 0.07, 0.016, 6, 3, IRON, smooth=0, m=Rx(90))
    K.chain(g, (0, 0, -0.06), (0, 0, -1.9), IRON, link=0.17, wire=0.017)
    K.tube(g, (0, 0, -1.9), (0, 0, -2.06), 0.016, IRON, n=4, cap0=False)
    K.tube(g, (0, 0, -2.06), (0.09, 0, -2.0), 0.016, IRON, n=4, cap0=False)
    kit.add('cel_chain_hanging', g, budget=None, role='hanging', bake={'ground': -3.5}, sheet={'az': 30, 'el': 10})


def lantern(kit):
    g = K.Geo()
    c = lantern_geo(g, (0, 0, 0))
    p = kit.add('cel_lantern', g, budget=None, sheet={'az': 30, 'el': 25})
    kit.light(p, c, 'lamp')


def lantern_hook(kit):
    g = K.Geo()
    K.box(g, (-0.06, 0.07, -0.12), (0.06, 0.1, 0.12), IRON, var=0.42, skip=('+y',))
    K.box(g, (-0.02, -0.42, 0.0), (0.02, 0.07, 0.04), IRON, var=0.5, skip=('+y',))
    K.tube(g, (0.0, -0.05, -0.12), (0.0, -0.3, 0.02), 0.012, IRON, n=4, cap0=False, cap1=False)
    K.chain(g, (0.0, -0.4, 0.0), (0.0, -0.4, -0.22), IRON, link=0.08, wire=0.009)
    c = lantern_geo(g, (0.0, -0.4, -0.75), s=0.75)
    p = kit.add('cel_lantern_hook', g, budget=None, role='wall-hung', bake={'ground': -2.0, 'wall': 0.1},
                sheet={'az': 35, 'el': 15})
    kit.light(p, c, 'lamp')


def tripwire(kit):
    g = K.Geo()
    for x in (-1.0, 1.0):
        K.tube(g, (x, 0.0, 0.0), (x, 0.0, 0.3), 0.025, IRON, r1=0.016, n=4, var=0.45)
    K.tube(g, (-1.0, 0.0, 0.16), (1.0, 0.0, 0.16), 0.006, ROPE, n=3, var=0.6, cap0=False, cap1=False)
    K.lathe(g, [(0.0, 0.18), (0.035, 0.2), (0.05, 0.27), (0.02, 0.31), (0.0, 0.31)], 6, BRASS, var=0.55,
            m=T(1.0, -0.06, 0.0), smooth=40)
    kit.add('cel_tripwire_rail', g, budget=None, sheet={'az': 30, 'el': 30})


def dais(kit):
    rng = R('cel_dais')
    g = K.Geo()
    K.box(g, (-2.0, -1.2, 0.0), (2.0, 1.2, 0.2), DWOOD, var=0.38, skip=('-z', '+z'))
    for i in range(8):
        y0 = -1.2 + i * 0.3 + 0.006
        K.bevel_box(g, (-2.0, y0, 0.2), (2.0, y0 + 0.288, 0.25), 0.012, WOOD, var=jit(rng, 0.08))
    K.bevel_box(g, (-1.4, -1.6, 0.0), (1.4, -1.2, 0.13), 0.015, WOOD, var=jit(rng, 0.06))
    kit.add('cel_dais', g, budget=None, sheet={'az': 30, 'el': 30})


def captain_chair(kit):
    rng = R('cel_chair_captain')
    g = K.Geo()
    K.bevel_box(g, (-0.42, -0.4, 0.42), (0.42, 0.4, 0.52), 0.02, DWOOD, var=0.45)
    K.bevel_box(g, (-0.36, -0.36, 0.52), (0.36, 0.32, 0.62), 0.04, CLOTH1, var=0.5)
    for x in (-0.36, 0.36):
        for y in (-0.34, 0.34):
            K.box(g, (x - 0.05, y - 0.05, 0.0), (x + 0.05, y + 0.05, 0.42), DWOOD, var=0.42, skip=('-z', '+z'))
    back = [(-0.44, 0.0), (0.44, 0.0), (0.44, 1.05), (0.3, 1.3), (0.0, 1.42), (-0.3, 1.3), (-0.44, 1.05)]
    K.slab_xz(g, [(x, z + 0.52) for x, z in back], 0.3, 0.42, DWOOD, var=0.42)
    grin(g, (0.0, 1.45), 0.5, y_of=lambda x, z: 0.294)
    for x in (-0.47, 0.47):
        K.bevel_box(g, (x - 0.06, -0.42, 0.78), (x + 0.06, 0.38, 0.86), 0.02, DWOOD, var=0.48)
        K.box(g, (x - 0.04, -0.38, 0.52), (x + 0.04, -0.3, 0.78), DWOOD, var=0.42, skip=('-z', '+z'))
        K.rock(g, rng, (x, -0.43, 0.84), (0.06, 0.06, 0.05), BRASS, n=7, var=0.6, flat=False)
    kit.add('cel_chair_captain', g, budget=None, sheet={'az': 30, 'el': 22})


def dice_table(kit):
    rng = R('cel_dice_table')
    g = K.Geo()
    barrel_geo(g, rng, h=0.9)
    for (x, y, a) in ((-0.08, 0.02, 20), (0.1, -0.06, 55), (0.02, 0.12, 5)):
        K.box(g, (-0.04, -0.04, 0.0), (0.04, 0.04, 0.08), BONE, var=0.6, skip=('-z',), m=T(x, y, 0.86) @ Rz(a))
    for i in range(4):
        x = -0.2 + i * 0.05
        K.quad(g, (x, 0.18, 0.865), (x + 0.012, 0.18, 0.865), (x + 0.012, 0.26, 0.865), (x, 0.26, 0.865), BONE, 0.7)
    for x, y in ((0.15, 0.15), (0.2, 0.08)):
        K.disc(g, 0.04, 6, BRASS, z=0.866, var=0.6, m=T(x, y, 0.0))
    kit.add('cel_dice_table', g, budget=None, sheet={'az': 30, 'el': 35})


def larder(kit):
    rng = R('cel_larder')
    g = K.Geo()
    w, d, h = 1.4, 0.5, 1.8
    for x in (-w / 2, w / 2):
        K.bevel_box(g, (x - 0.04, -d / 2, 0.0), (x + 0.04, d / 2, h), 0.015, DWOOD, var=0.42)
    K.quad(g, (-w / 2, d / 2 - 0.01, 0.0), (w / 2, d / 2 - 0.01, 0.0), (w / 2, d / 2 - 0.01, h), (-w / 2, d / 2 - 0.01, h), DWOOD, 0.3)
    for z in (0.1, 0.65, 1.2, 1.75):
        K.box(g, (-w / 2, -d / 2, z), (w / 2, d / 2 - 0.01, z + 0.05), WOOD, var=jit(rng, 0.06), skip=('+y', '-x', '+x'))
    for z in (0.15, 0.7, 1.25):
        x = -0.48
        while x < 0.5:
            if rng.random() < 0.55:
                r = rng.uniform(0.11, 0.15)
                K.lathe(g, [(r, 0.0), (r, 0.09), (0.0, 0.09)], 8, BRASS, var=0.4, cap0=False, smooth=40,
                        m=T(x, -0.05, z))
                if rng.random() < 0.6:
                    K.disc(g, r * 0.6, 6, MOSS, z=0.092, var=0.5, m=T(x + 0.02, -0.06, z))
                x += 2 * r + 0.04
            else:
                for k in range(3):
                    K.tube(g, (x + k * 0.05, -0.12, z + 0.5), (x + k * 0.05 + 0.02, -0.12, z + 0.22), 0.025, CLOTH1, n=5,
                           var=0.4)
                x += 0.2
    kit.add('cel_larder', g, budget=None, sheet={'az': 25, 'el': 15})


def toll_shrine(kit):
    rng = R('cel_toll_shrine')
    g = K.Geo()
    K.bevel_box(g, (-0.45, -0.3, 0.0), (0.45, 0.3, 0.95), 0.03, DWOOD, var=0.42)
    K.slab_xz(g, [(-0.5, 0.95), (0.5, 0.95), (0.5, 1.6), (0.0, 1.8), (-0.5, 1.6)], 0.18, 0.24, CLOTH1, var=0.5)
    grin(g, (0.0, 1.32), 0.6, y_of=lambda x, z: 0.174)
    K.lathe(g, [(0.08, 0.95), (0.2, 1.0), (0.24, 1.08), (0.225, 1.08), (0.185, 1.01), (0.0, 0.98)], 8, IRON,
            var=lambda i, k: 0.45 if i < 2 else 0.3, cap0=True, cap1=False, m=T(0.0, -0.08, 0.0))
    for i in range(5):
        K.disc(g, 0.04, 6, BRASS, z=1.04 + 0.006 * i, var=0.6, m=T(rng.uniform(-0.1, 0.1), -0.08 + rng.uniform(-0.08, 0.08), 0.0))
    for x in (-0.36, 0.36):
        K.tube(g, (x, -0.18, 0.95), (x, -0.18, 1.12), 0.03, BONE, n=5, var=0.6)
        K.lathe(g, [(0.02, 0.0), (0.0, 0.07)], 4, GLOW, var=0.6, cap0=False, m=T(x, -0.18, 1.12))
    p = kit.add('cel_toll_shrine', g, budget=None, sheet={'az': 25, 'el': 20})
    kit.light(p, (0.0, -0.18, 1.25), 'candle')


def gallows(kit):
    rng = R('cel_gallows_beam')
    g = K.Geo()
    for x in (-1.0, 1.0):
        K.box(g, (x - 0.1, -0.1, 0.0), (x + 0.1, 0.1, 2.9), DWOOD, var=jit(rng, 0.06), skip=('-z',))
        K.box(g, (x - 0.12, -0.3, 0.0), (x + 0.12, 0.3, 0.12), DWOOD, var=0.4, skip=('-z',))
    K.box(g, (-1.25, -0.11, 2.9), (1.25, 0.11, 3.12), DWOOD, var=0.45)
    K.tube(g, (0.0, 0.0, 2.9), (0.0, 0.0, 2.15), 0.02, ROPE, n=4, var=0.55)
    K.torus(g, 0.13, 0.025, 7, 3, ROPE, smooth=0, m=T(0.0, 0.0, 2.02) @ Rx(90) @ Sc(1.0, 1.35, 1.0))
    for x in (-0.08, 0.08):
        K.hull(g, [(x - 0.05, -0.05, 1.5), (x + 0.05, -0.05, 1.5), (x + 0.05, 0.05, 1.5), (x - 0.05, 0.05, 1.5),
                   (x - 0.055, -0.06, 1.82), (x + 0.055, -0.06, 1.82), (x + 0.055, 0.06, 1.82), (x - 0.055, 0.06, 1.82),
                   (x - 0.05, -0.2, 1.45), (x + 0.05, -0.2, 1.45), (x - 0.05, -0.2, 1.52), (x + 0.05, -0.2, 1.52)],
               ROPE, var=0.35)
    kit.add('cel_gallows_beam', g, budget=None, sheet={'az': 30, 'el': 15})


def build_cellars(kit):
    floor_a(kit)
    floor_b(kit)
    floor_dirt(kit)
    puddle(kit)
    grate(kit)
    wall_seg(kit)
    wall_dmg(kit)
    shelf(kit)
    corner(kit)
    low_wall(kit)
    door_arch(kit)
    door_wood(kit)
    door_portcullis(kit)
    door_secret(kit)
    pillar(kit)
    beam(kit)
    barrel(kit)
    cask(kit)
    crates(kit)
    table(kit)
    rat_nest(kit)
    cage(kit)
    banner(kit)
    cart(kit)
    wall_cut(kit)
    door_arch_cut(kit)
    corner_cut(kit)
    stool(kit)
    sack_pile(kit)
    bone_pile(kit)
    chain_hanging(kit)
    lantern(kit)
    lantern_hook(kit)
    tripwire(kit)
    dais(kit)
    captain_chair(kit)
    dice_table(kit)
    larder(kit)
    toll_shrine(kit)
    gallows(kit)


# ---------------------------------------------------------------------------------------------------- reviews
class Review:
    def __init__(self):
        sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))
        from render import Stage
        self.stage = Stage(OUT_CELLARS, size=400, quick=QUICK, platform=False)
        self.sc = bpy.context.scene
        self.cam = self.stage.cam
        self.labels = K.Labels(OUT_CELLARS)
        self.sun_lights = [o for o in self.stage.col.objects if o.type == 'LIGHT']
        self.sheet_world = self.sc.world
        # rooms: the camera sees the game's fog colour (#17110e); everything else is lit by a dim warm ambient
        rw = bpy.data.worlds.new('GV_RoomWorld')
        rw.use_nodes = True
        nt = rw.node_tree
        nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputWorld')
        amb = nt.nodes.new('ShaderNodeBackground')
        amb.inputs[0].default_value = ROOM_AMBIENT
        bg = nt.nodes.new('ShaderNodeBackground')
        bg.inputs[0].default_value = (0.008, 0.0056, 0.0044, 1.0)
        lp = nt.nodes.new('ShaderNodeLightPath')
        mix = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs[0])
        nt.links.new(amb.outputs[0], mix.inputs[1])
        nt.links.new(bg.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs[0])
        self.room_world = rw
        gm = bpy.data.meshes.new('GV_SheetGround')
        gm.from_pydata([(-40, -40, 0), (40, -40, 0), (40, 40, 0), (-40, 40, 0)], [], [(0, 1, 2, 3)])
        mat = bpy.data.materials.new('GV_SheetGroundMat')
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs[0].default_value = (0.045, 0.04, 0.038, 1)
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(em.outputs[0], out.inputs[0])
        gm.materials.append(mat)
        self.ground = bpy.data.objects.new('GV_SheetGround', gm)
        self.stage.col.objects.link(self.ground)
        fm = bpy.data.materials.new('GV_Flame')
        fm.use_nodes = True
        nt = fm.node_tree
        nt.nodes.clear()
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs[0].default_value = (1.0, 0.62, 0.22, 1)
        em.inputs[1].default_value = 6.0
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(em.outputs[0], out.inputs[0])
        g = K.Geo()
        K.lathe(g, [(0.0, -0.04), (0.07, 0.04), (0.05, 0.14), (0.0, 0.26)], 6, 0, smooth=60)
        me = bpy.data.meshes.new('GV_FlameMesh')
        me.from_pydata([tuple(v) for v in g.V], [], g.F)
        me.materials.append(fm)
        self.flame_mesh = me

    def sheet(self, kit, pieces, out_dir, name, cols, cell):
        os.makedirs(out_dir, exist_ok=True)
        sc = self.sc
        for o in self.sun_lights:
            o.hide_render = False
        sc.world = self.sheet_world
        everything = [o for o in bpy.data.objects if o.type == 'MESH' and not o.name.startswith('GV_')]
        cells, labels = [], []
        for p in pieces:
            for o in everything:
                o.hide_render = True
            for o in p.meshes():
                o.hide_render = False
            sp = p.sheet
            lo, hi = K.frame_ortho(self.cam, p.meshes(), az=sp.get('az', 35), el=sp.get('el', 28), margin=1.1)
            self.ground.location = (0, 0, min(0.0, lo.z) - 0.002)
            self.ground.hide_render = p.role == 'hanging'
            sc.render.resolution_x = sc.render.resolution_y = cell
            path = os.path.join(out_dir, '_cell.png')
            sc.render.filepath = path
            bpy.ops.render.render(write_still=True)
            cells.append(K.load_px(path))
            os.remove(path)
            budget = '—' if p.budget is None else str(p.budget)
            labels.append(self.labels.image('%s\n%d tris  (07: %s)' % (p.id, p.tris(), budget), cell, 46))
        self.ground.hide_render = True
        for o in everything:
            o.hide_render = False
        out = K.compose(cells, labels, cols, os.path.join(out_dir, name))
        log('sheet', os.path.relpath(out, REPO))
        return out

    def room(self, tpl, pieces, out_dir, kit_objects):
        sc = self.sc
        for o in self.sun_lights:
            o.hide_render = True
        self.ground.hide_render = True
        for o in kit_objects:
            o.hide_render = True
        sc.world = self.room_world
        rng = R(tpl['id'])
        sub = SUBSTITUTE.get(tpl['id'], {})
        tpl = dict(tpl)
        tpl['props'] = [dict(p, meshId=sub.get(p['meshId'], p['meshId'])) for p in tpl['props']]
        placements = K.room_placements(tpl, SHELL, rng, pieces, floor=FLOOR_MIX.get(tpl['id'], [('cel_floor_flag_b', 0.12)]),
                                       wall_alts=[('cel_wall_brick_dmg', 0.04)])
        objs, lights, stats = K.build_room(placements, pieces, outline=0.012)
        made = []
        order = sorted(lights, key=lambda l: (0 if l[1] in ('fire', 'brazier') else 1))
        for i, (pos, kind, mid) in enumerate(order):
            fl = bpy.data.objects.new('GV_Flame~', self.flame_mesh)
            bpy.data.collections['Room'].objects.link(fl)
            fl.location = pos
            fl.visible_shadow = False      # the stand-in encloses its light: casting shadows it blocked it (rounds 1–3)
            if kind == 'lamp':
                fl.scale = (0.5, 0.5, 0.5)
            made.append(fl)
            if i < 2:
                ld = bpy.data.lights.new('GV_RoomLight%d' % i, 'POINT')
                ld.energy = FIRE_W if kind in ('fire', 'brazier') else TORCH_W
                ld.color = (1.0, 0.62, 0.32)
                ld.shadow_soft_size = 0.12
                lo = bpy.data.objects.new('GV_RoomLight%d~' % i, ld)
                bpy.data.collections['Room'].objects.link(lo)
                lo.location = pos + Vector((0, 0, 0.1))
                made.append(lo)
        K.template_camera(self.cam, tpl)
        w, h = (915, 412) if QUICK else (1830, 824)
        sc.render.resolution_x, sc.render.resolution_y = w, h
        path = os.path.join(out_dir, 'room_%s.png' % tpl['id'])
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        if not QUICK:
            K.save_px(os.path.join(out_dir, 'room_%s_phone.png' % tpl['id']), K.shrink(K.load_px(path), 2))
        K.clear_room()
        for o in kit_objects:
            o.hide_render = False
        log('room %-18s tris %6d  instances %4d  unique meshes %3d  lights %d' % (
            tpl['id'], stats['tris'], stats['instances'], stats['unique'], len(lights)))
        return stats


# ---------------------------------------------------------------------------------------------------- main
def report(kits):
    lines = ['| piece | tris | 07 budget | role | parts | lights / fx |', '|---|---:|---:|---|---|---|']
    for kit in kits:
        for p in kit.pieces.values():
            parts = ', '.join('%s %d' % (o['part'], K.mesh_tris(o)) for o in p.parts)
            pts = ', '.join('%s (%s)' % (e.name, e.get('light', e.get('fx'))) for e in p.points)
            lines.append('| %s | %d | %s | %s | %s | %s |' % (p.id, p.tris(), '—' if p.budget is None else p.budget,
                                                             p.role, parts, pts))
    return lines


def main():
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    K.write_palette('cellars', CELLARS, CELLARS_ABOUT)
    K.write_palette('shared', SHARED, SHARED_ABOUT)
    shr = K.Kit('shared', SHARED)
    cel = K.Kit('cellars', CELLARS)
    build_shared(shr)
    build_cellars(cel)
    allp = dict(shr.pieces)
    allp.update(cel.pieces)
    log('built %d shared + %d cellars pieces in %.1f s' % (len(shr.pieces), len(cel.pieces), time.time() - t0))
    if not NO_BAKE:
        K.bake_ao(list(allp.values()), samples=48 if QUICK else 160, lookup=allp)
        log('baked AO in %.1f s' % (time.time() - t0))
    if not NO_EXPORT:
        os.makedirs(K.ENV_MODELS, exist_ok=True)
        K.export_kit(shr, os.path.join(K.ENV_MODELS, 'kit_shared.glb'), os.path.join(K.ENV_MODELS, 'shared.json'),
                     shell=None, about=SHARED_ABOUT + ' Conventions: tools/blender/env/kit_lib.py.')
        shell = dict(SHELL)
        shell.update(SHELL_EXTRA)
        K.export_kit(cel, os.path.join(K.ENV_MODELS, 'kit_cellars.glb'), os.path.join(K.ENV_MODELS, 'cellars.json'),
                     shell=shell, about=CELLARS_ABOUT + ' Conventions: tools/blender/env/kit_lib.py.',
                     extra={'floorMix': {k: [[m, p] for m, p in v] for k, v in FLOOR_MIX.items()},
                            'substitute': SUBSTITUTE})
    save_blend(os.path.join(BUILD, 'kit_cellars.blend'))
    for line in report([shr, cel]):
        print(line)
    if NO_RENDERS:
        return
    shr_mat = K.env_material(SHARED, 'GV_Env_shared')
    cel_mat = K.env_material(CELLARS, 'GV_Env_cellars')
    cel_mat_for_shared = K.env_material(CELLARS, 'GV_Env_cellars_shr')
    rv = Review()
    if not NO_SHEETS:
        K.apply_look(shr.objects(), shr_mat, outline=0.008)
        rv.sheet(shr, list(shr.pieces.values()), OUT_SHARED, 'kit_sheet.png', 6, 300 if QUICK else 400)
        K.apply_look(cel.objects(), cel_mat, outline=0.008)
        rv.sheet(cel, list(cel.pieces.values()), OUT_CELLARS, 'kit_sheet.png', 8, 300 if QUICK else 400)
    # in the Cellars rooms the shared pieces wear the Cellars palette
    K.apply_look(cel.objects(), cel_mat, outline=0.0)
    K.apply_look(shr.objects(), cel_mat_for_shared, outline=0.0)
    kit_objects = [o for o in shr.objects() + cel.objects() if o.type == 'MESH']
    stats = {}
    for path in sorted(glob.glob(os.path.join(TEMPLATE_DIR, 'cel-t-*.json'))):
        tpl = read_json(path)
        if ROOMS and tpl['id'] not in ROOMS:
            continue
        stats[tpl['id']] = rv.room(tpl, allp, OUT_CELLARS, kit_objects)
    print('| template | tris | instances | unique meshes |')
    print('|---|---:|---:|---:|')
    for k, s in stats.items():
        print('| %s | %d | %d | %d |' % (k, s['tris'], s['instances'], s['unique']))
    log('done in %.1f s' % (time.time() - t0))


main()

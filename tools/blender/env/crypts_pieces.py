"""crypts_pieces.py — every Crypts kit piece as a procedural build (07-DUNGEONS §2.2, the `cry_` table, plus the props
its room templates and the Barrow Warden's arena name, and the cut-away shell pieces kit_lib asks every zone for).
Each builder returns a `Piece` (crypts_geo.py): faces carry palette slots, moving parts are separate Geo with a hinge,
lights and fx are points. Budgets are 07's per-piece numbers; the extras carry this pass's own (logged).

Blender space, kit_lib's conventions: metres, Z up, a piece's front faces −Y. Shell walls stand behind their origin
(+Y, 0.4 m thick); the doorway opening is kit_lib's (straight jambs to 2.1 m, a round arch to 3.1 m); wall-hung props are
authored against a wall face at y = 0 and moved back 0.1 m when realized (their origin 0.1 m in front of the wall);
hanging pieces hang from their origin.
"""
import math

from mathutils import Vector

from crypts_geo import Piece

# environment palette slots (tools/blender/README.md → Phase 6 → Environments; kit_lib's names)
STONE, DSTONE, WOOD, DWOOD, IRON, INK, CLOTH1, CLOTH2, ROPE, BMETAL, BRASS, GLOW, MOSS, BONE, GEM, WATER = range(16)

WALL_T = 0.4        # shell wall thickness (behind the room-side face)
WALL_H = 3.5
CUT_H = 0.55        # the client's cutaway height
DOOR_W = 2.0        # the opening
DOOR_SPRING = 2.1   # kit_lib: straight jambs to 2.1 m …
DOOR_APEX = 3.1     # … a round arch to 3.1 m (the same in every zone, so the lit-door marker fits)
DOOR_PIECE_W = 4.0  # a doorway piece fills the two middle 2 m slots of a cell's edge: 1 m jambs either side
HANG_OFF = 0.1
POINT_APEX = 3.32   # the Crypts' pointed archivolt over the round opening (its dark tympanum makes the doorway read pointed)

WALL_BAKE = {'ground': 0.0, 'occluders': [('cry_wall_plain_2m', (-2.0, 0.0, 0.0)), ('cry_wall_plain_2m', (2.0, 0.0, 0.0))]}
DOOR_BAKE = {'ground': 0.0, 'occluders': [('cry_wall_plain_2m', (-3.0, 0.0, 0.0)), ('cry_wall_plain_2m', (3.0, 0.0, 0.0))]}
HUNG_BAKE = {'ground': 0.0, 'wall': HANG_OFF}
SKIP = {'skip': True}


# ───────────────────────────────────────────── shared bits ───────────────────────────────────────────

def wall_frame(g, x0, x1, plinth=0.28, cornice=True, ends=True, back=True, moss=True):
    """The common parts of a 2 m shell wall: plinth course (moss on its top), cornice, top cap, back and ends. The
    room-side face between the plinth and the cornice is the caller's."""
    pz = plinth
    g.box((x0, -0.06, 0.0), (x1, 0.0, pz), DSTONE, skip=('-z', '+y', '-x', '+x'),
          slots={'+z': MOSS if moss else DSTONE}, hint={'+z': -0.05, '-y': -0.08})
    top0 = WALL_H - 0.2 if cornice else WALL_H
    if cornice:
        g.box((x0, -0.07, top0), (x1, 0.0, WALL_H), STONE, skip=('+y', '+z', '-x', '+x'), hint={'-z': -0.1, '-y': 0.06})
    g.qf([(x0, -0.07 if cornice else 0.0, WALL_H), (x1, -0.07 if cornice else 0.0, WALL_H), (x1, WALL_T, WALL_H), (x0, WALL_T, WALL_H)], (0, 0, 1), STONE, hint=0.05)
    if back:
        g.qf([(x0, WALL_T, 0), (x1, WALL_T, 0), (x1, WALL_T, WALL_H), (x0, WALL_T, WALL_H)], (0, 1, 0), DSTONE, hint=-0.1)
    if ends:
        g.qf([(x0, 0, pz), (x0, WALL_T, 0), (x0, WALL_T, WALL_H), (x0, 0, top0)], (-1, 0, 0), STONE)
        g.qf([(x1, 0, pz), (x1, WALL_T, 0), (x1, WALL_T, WALL_H), (x1, 0, top0)], (1, 0, 0), STONE)
    return pz, top0


def face_grid(g, xs, zs, holes, y=0.0, slot=STONE, hints=None):
    """A face at depth y (looking −Y) as a grid of quads over the cuts `xs` × `zs`, minus the cells in `holes`
    ({(col, row)}); every vertex is shared with its neighbours (no T-junctions)."""
    for ri in range(len(zs) - 1):
        for ci in range(len(xs) - 1):
            if (ci, ri) in holes:
                continue
            h = (hints or {}).get((ci, ri), 0.0)
            g.qf([(xs[ci], y, zs[ri]), (xs[ci + 1], y, zs[ri]), (xs[ci + 1], y, zs[ri + 1]), (xs[ci], y, zs[ri + 1])],
                 (0, -1, 0), slot, hint=h)


def recess(g, x0, x1, z0, z1, y0, y1, back_slot=INK, side_slot=DSTONE, floor_slot=DSTONE):
    """A rectangular hole from the face at y0 back to y1: back, floor, ceiling and sides, facing in."""
    g.qf([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], (0, -1, 0), back_slot, hint=-0.1)
    g.qf([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], (0, 0, 1), floor_slot, hint=-0.05)
    g.qf([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], (0, 0, -1), side_slot, hint=-0.2)
    g.qf([(x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1)], (1, 0, 0), side_slot, hint=-0.15)
    g.qf([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], (-1, 0, 0), side_slot, hint=-0.15)


def candle(g, x, y, z, h=0.24, w=0.08, slot=CLOTH2, piece=None, kind='candle', tone='corpse'):
    """A chunky corpse-candle (a square stick with a top), its light point at the wick."""
    g.box((x - w / 2, y - w / 2, z), (x + w / 2, y + w / 2, z + h), slot, skip=('-z',), hint={'+z': 0.1}, taper=(0.9, 0.9))
    if piece is not None:
        piece.light((x, y, z + h + 0.05), kind, tone)


def niche_contents(g, x_mid, z0, kind, y_mid):
    """What lies in a burial niche: a shrouded body, or a skull and long bones; nothing for an empty one."""
    if kind == 'shroud':
        g.box((x_mid - 0.66, y_mid - 0.15, z0), (x_mid + 0.62, y_mid + 0.13, z0 + 0.22), CLOTH2, skip=('-z', '+y'),
              taper=(0.92, 0.6), hint=0.05)
        g.box((x_mid + 0.40, y_mid - 0.11, z0 + 0.20), (x_mid + 0.62, y_mid + 0.09, z0 + 0.30), CLOTH2, skip=('-z', '+y', '-x'),
              taper=(0.7, 0.7))
    elif kind == 'bones':
        with g.at((x_mid - 0.25, y_mid, z0), rz=-12):
            g.skull_flat(w=0.22, depth=0.10)
        g.bar((x_mid + 0.0, y_mid - 0.02, z0 + 0.04), (x_mid + 0.62, y_mid + 0.06, z0 + 0.04), 0.07, 0.07, BONE, caps=False, skip=('bottom',))
        g.bar((x_mid + 0.05, y_mid + 0.08, z0 + 0.04), (x_mid + 0.58, y_mid - 0.06, z0 + 0.10), 0.06, 0.06, BONE, caps=False, skip=('bottom',))


def round_arc(n=4, half=DOOR_W / 2, spring=DOOR_SPRING):
    """The left half of kit_lib's opening: from the spring (−half, spring) round to the apex (0, spring + half)."""
    return [(-half * math.cos(math.pi / 2 * i / n), spring + half * math.sin(math.pi / 2 * i / n)) for i in range(n + 1)]


def pointed_arc(n=4, half=DOOR_W / 2, spring=DOOR_SPRING, apex=POINT_APEX):
    """The left half of a pointed arch from (−half, spring) to (0, apex): an arc centred `c` beyond the axis."""
    rise = apex - spring
    c = (rise * rise - half * half) / (2 * half)
    r = half + c
    a_ap = math.atan2(rise, -c)
    pts = [(c + r * math.cos(math.pi + (a_ap - math.pi) * i / n), spring + r * math.sin(math.pi + (a_ap - math.pi) * i / n)) for i in range(n + 1)]
    pts[0] = (-half, spring)
    pts[-1] = (0.0, apex)
    return pts


def arch_z(x, half=DOOR_W / 2, spring=DOOR_SPRING):
    """The height of the round opening above x (the spring outside it)."""
    if abs(x) >= half:
        return spring
    return spring + math.sqrt(half * half - x * x)


def doorway_wall(g, moulding=True, keystone=True, plinths=True, reveal=True, back=True, cornice=True):
    """A 4 m shell piece with kit_lib's opening: the face as rings round it, a dark pointed tympanum over the round
    head inside a proud pointed archivolt (the Crypts' pointed arch), the reveal through the 0.4 m wall, top cap,
    ends, jamb plinths and the cornice (broken where the archivolt rises through it)."""
    X = DOOR_PIECE_W / 2
    half = DOOR_W / 2
    rnd = round_arc()
    pnt = pointed_arc()
    inner = [(-half, 0.0)] + pnt                            # jamb foot, spring, pointed arc to the apex
    outer = [(-X, 0.0), (-X, DOOR_SPRING), (-X, 2.85), (-X, WALL_H), (-1.0, WALL_H), (0.0, WALL_H)]
    for k in range(len(inner) - 1):
        for sgn in (1, -1):
            a = (sgn * outer[k][0], 0.0, outer[k][1])
            b = (sgn * inner[k][0], 0.0, inner[k][1])
            c = (sgn * inner[k + 1][0], 0.0, inner[k + 1][1])
            d = (sgn * outer[k + 1][0], 0.0, outer[k + 1][1])
            g.qf([a, b, c, d], (0, -1, 0), STONE)
    # the tympanum between the round head and the pointed outline: dark, so the doorway reads pointed
    for k in range(len(rnd) - 1):
        for sgn in (1, -1):
            pts = [(sgn * rnd[k][0], 0.0, rnd[k][1]), (sgn * rnd[k + 1][0], 0.0, rnd[k + 1][1]),
                   (sgn * pnt[k + 1][0], 0.0, pnt[k + 1][1]), (sgn * pnt[k][0], 0.0, pnt[k][1])]
            if k == 0:
                pts = pts[:3]
            g.qf(pts, (0, -1, 0), DSTONE, hint=-0.22)
    opening = [(-half, 0.0)] + rnd
    if back:
        outer_b = [(-X, 0.0), (-X, DOOR_SPRING), (-X, 2.85), (-X, WALL_H), (-1.0, WALL_H), (0.0, WALL_H)]
        for k in range(len(opening) - 1):
            for sgn in (1, -1):
                a = (sgn * outer_b[k][0], WALL_T, outer_b[k][1])
                b = (sgn * opening[k][0], WALL_T, opening[k][1])
                c = (sgn * opening[k + 1][0], WALL_T, opening[k + 1][1])
                d = (sgn * outer_b[k + 1][0], WALL_T, outer_b[k + 1][1])
                g.qf([a, b, c, d], (0, 1, 0), STONE, hint=-0.1)
    if reveal:
        for k in range(len(opening) - 1):
            for sgn in (1, -1):
                p, q = opening[k], opening[k + 1]
                nrm = (q[1] - p[1], 0, -(q[0] - p[0])) if sgn == 1 else (-(q[1] - p[1]), 0, -(q[0] - p[0]))
                g.qf([(sgn * p[0], 0, p[1]), (sgn * q[0], 0, q[1]), (sgn * q[0], WALL_T, q[1]), (sgn * p[0], WALL_T, p[1])],
                     nrm, DSTONE, hint=-0.1)
    g.qf([(-X, -0.07 if cornice else 0.0, WALL_H), (X, -0.07 if cornice else 0.0, WALL_H), (X, WALL_T, WALL_H), (-X, WALL_T, WALL_H)], (0, 0, 1), STONE, hint=0.05)
    g.qf([(-X, 0, 0), (-X, WALL_T, 0), (-X, WALL_T, WALL_H), (-X, 0, WALL_H)], (-1, 0, 0), STONE)
    g.qf([(X, 0, 0), (X, WALL_T, 0), (X, WALL_T, WALL_H), (X, 0, WALL_H)], (1, 0, 0), STONE)
    if cornice:
        for sgn in (1, -1):
            x0, x1 = sorted((sgn * X, sgn * 0.62))
            g.box((x0, -0.07, WALL_H - 0.2), (x1, 0.0, WALL_H), STONE, skip=('+y', '+z', '-x' if sgn < 0 else '+x'),
                  hint={'-z': -0.1, '-y': 0.06})
    if moulding:
        band, proud = 0.16, 0.09
        path = [(-half, 0.32)] + pnt                         # up the jamb from the plinth, round the pointed arc
        outer_m = []
        for i, p in enumerate(path):
            q_prev = path[max(0, i - 1)]
            q_next = path[min(len(path) - 1, i + 1)]
            tx, tz = q_next[0] - q_prev[0], q_next[1] - q_prev[1]
            L = math.hypot(tx, tz) or 1.0
            outer_m.append((p[0] - tz / L * band, p[1] + tx / L * band))
        outer_m[0] = (-half - band, 0.32)
        outer_m[-1] = (0.0, path[-1][1] + band * 1.02)
        for k in range(len(path) - 1):
            low = path[k + 1][1] <= DOOR_SPRING + 1e-6
            for sgn in (1, -1):
                a = (sgn * path[k][0], -proud, path[k][1])
                b = (sgn * path[k + 1][0], -proud, path[k + 1][1])
                c = (sgn * outer_m[k + 1][0], -proud, outer_m[k + 1][1])
                d = (sgn * outer_m[k][0], -proud, outer_m[k][1])
                g.qf([a, b, c, d], (0, -1, 0), STONE, hint=0.1)
                e0 = (sgn * outer_m[k][0], -proud, outer_m[k][1])
                e1 = (sgn * outer_m[k + 1][0], -proud, outer_m[k + 1][1])
                g.qf([e0, e1, (e1[0], 0.0, e1[2]), (e0[0], 0.0, e0[2])], (-sgn * (1.0 if low else 0.4), 0, 0.0 if low else 1.0), STONE)
                i0 = (sgn * path[k][0], -proud, path[k][1])
                i1 = (sgn * path[k + 1][0], -proud, path[k + 1][1])
                g.qf([i0, i1, (i1[0], 0.0, i1[2]), (i0[0], 0.0, i0[2])], (sgn * (1.0 if low else 0.4), 0, 0.0 if low else -1.0), DSTONE, hint=-0.05)
    if keystone:
        az = POINT_APEX
        g.box((-0.15, -0.14, az - 0.16), (0.15, 0.0, min(WALL_H - 0.01, az + 0.17)), STONE, skip=('+y',), taper=(1.2, 1.0), hint=0.12)
        with g.at((0, -0.14, az - 0.1)):
            g.skull_flat(w=0.2, depth=0.05)
    if plinths:
        for sgn in (1, -1):
            x0, x1 = sorted((sgn * (half + 0.2), sgn * (half - 0.02)))
            g.box((x0, -0.13, 0.0), (x1, 0.0, 0.32), DSTONE, skip=('-z', '+y'), slots={'+z': MOSS}, hint={'-y': -0.06})
    return POINT_APEX


def jagged(x0, x1, n, base, amp, seed):
    """A broken top line: n + 1 points from x0 to x1 at `base` ± `amp`, the ends at `base`."""
    pts = []
    for i in range(n + 1):
        t = i / n
        h = base + (0.0 if i in (0, n) else amp * math.sin(seed * 12.9898 + i * 78.233) * 0.9)
        pts.append((x0 + (x1 - x0) * t, h))
    return pts


def cut_block(g, x0, x1, top_front, top_back, plinth=0.28, ends=(True, True), moss=True, y0=0.0, y1=WALL_T):
    """A wall stub cut down for the camera side: front face (the room side), back face (the side the camera looks at),
    a broken top through the thickness, plinth course, ends."""
    g.box((x0, y0 - 0.06, 0.0), (x1, y0, plinth), DSTONE, skip=('-z', '+y', '-x', '+x'), slots={'+z': MOSS if moss else DSTONE})
    for i in range(len(top_front) - 1):
        (xa, ha), (xb, hb) = top_front[i], top_front[i + 1]
        (_, ka), (_, kb) = top_back[i], top_back[i + 1]
        g.qf([(xa, y0, plinth), (xb, y0, plinth), (xb, y0, hb), (xa, y0, ha)], (0, -1, 0), STONE)
        g.qf([(xa, y1, 0.0), (xb, y1, 0.0), (xb, y1, kb), (xa, y1, ka)], (0, 1, 0), STONE, hint=-0.05)
        g.qf([(xa, y0, ha), (xb, y0, hb), (xb, y1, kb), (xa, y1, ka)], (0, 0, 1), DSTONE, hint=-0.12)
    if ends[0]:
        g.qf([(x0, y0, 0.0), (x0, y1, 0.0), (x0, y1, top_back[0][1]), (x0, y0, top_front[0][1])], (-1, 0, 0), STONE)
    if ends[1]:
        g.qf([(x1, y0, 0.0), (x1, y1, 0.0), (x1, y1, top_back[-1][1]), (x1, y0, top_front[-1][1])], (1, 0, 0), STONE)


def grave_slab(g, x0, x1, y0, y1, top=0.035, bev=0.03, panel=0.17, tilt=(0.0, 0.0), hint=0.0, sg_panel=7):
    """A bevelled grave slab with a worn inscription panel (the names worn off): bevels down to the joint, the top
    split into a frame and a darker panel (its own smoothing group, so its weathering stays crisp). 18 triangles."""
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2

    def zt(x, y):
        return top + tilt[0] * (x - cx) + tilt[1] * (y - cy)
    ix0, ix1, iy0, iy1 = x0 + bev, x1 - bev, y0 + bev, y1 - bev
    lo = 0.004
    g.qf([(x0, y0, lo), (x1, y0, lo), (ix1, iy0, zt(ix1, iy0)), (ix0, iy0, zt(ix0, iy0))], (0, -1, 1), DSTONE, hint=hint - 0.06)
    g.qf([(x1, y1, lo), (x0, y1, lo), (ix0, iy1, zt(ix0, iy1)), (ix1, iy1, zt(ix1, iy1))], (0, 1, 1), DSTONE, hint=hint - 0.02)
    g.qf([(x0, y1, lo), (x0, y0, lo), (ix0, iy0, zt(ix0, iy0)), (ix0, iy1, zt(ix0, iy1))], (-1, 0, 1), DSTONE, hint=hint - 0.04)
    g.qf([(x1, y0, lo), (x1, y1, lo), (ix1, iy1, zt(ix1, iy1)), (ix1, iy0, zt(ix1, iy0))], (1, 0, 1), DSTONE, hint=hint)
    px0, px1 = ix0 + panel, ix1 - panel
    py0, py1 = iy0 + panel * 1.3, iy1 - panel * 1.3
    for (a0, a1, b0, b1) in ((ix0, ix1, iy0, py0), (ix0, ix1, py1, iy1), (ix0, px0, py0, py1), (px1, ix1, py0, py1)):
        g.qf([(a0, b0, zt(a0, b0)), (a1, b0, zt(a1, b0)), (a1, b1, zt(a1, b1)), (a0, b1, zt(a0, b1))], (0, 0, 1), DSTONE, hint=hint + 0.12)
    g.qf([(px0, py0, zt(px0, py0)), (px1, py0, zt(px1, py0)), (px1, py1, zt(px1, py1)), (px0, py1, zt(px0, py1))], (0, 0, 1), DSTONE,
         sg=sg_panel, hint=hint - 0.2)


def ashlar(g, x0, x1, z0, z1, courses=5, proud=0.025, joint=0.032, bevel=0.035, seed=0):
    """Dressed-stone courses on a wall face (y = 0 is the face plane): blocks proud of a dark backing, each with a
    lit top bevel; even courses break at the middle (half joints at the ends, so neighbours make a full joint), odd
    courses run half, full, half (the halves join their neighbours' into whole blocks). 4 triangles a block."""
    g.qf([(x0, 0.0, z0), (x1, 0.0, z0), (x1, 0.0, z1), (x0, 0.0, z1)], (0, -1, 0), DSTONE, hint=-0.28)
    ch = (z1 - z0) / courses
    w = x1 - x0
    for c in range(courses):
        za = z0 + c * ch + joint / 2
        zb = z0 + (c + 1) * ch - joint / 2
        if c % 2 == 0:
            spans = [(x0 + joint / 2, x0 + w / 2 - joint / 2), (x0 + w / 2 + joint / 2, x1 - joint / 2)]
        else:
            spans = [(x0, x0 + w / 4 - joint / 2), (x0 + w / 4 + joint / 2, x0 + 3 * w / 4 - joint / 2), (x0 + 3 * w / 4 + joint / 2, x1)]
        for i, (xa, xb) in enumerate(spans):
            h = 0.09 * math.sin(seed * 3.7 + c * 12.9898 + i * 78.233) - 0.04 * (c == 0)
            g.qf([(xa, -proud, za), (xb, -proud, za), (xb, -proud, zb - bevel), (xa, -proud, zb - bevel)], (0, -1, 0), STONE, hint=h)
            g.qf([(xa, -proud, zb - bevel), (xb, -proud, zb - bevel), (xb, 0.0, zb), (xa, 0.0, zb)], (0, -1, 1.2), STONE, hint=h + 0.1)


# ───────────────────────────────────────────── shell and floors ──────────────────────────────────────

TILE_BAKE = {'ground': None, 'occluders': [('cry_floor_slab', (dx, dy, 0.0)) for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2))]}


def cry_floor_slab():
    """A 2 m floor tile of two grave slabs (bevelled, the names worn off their panels) with grave-moss in the joints.
    07 counts 4 triangles for a textured tile; without textures (D-110) the slabs and joints are geometry: 38."""
    p = Piece('cry_floor_slab', role='shell', budget=40, bake=TILE_BAKE, grime=False)
    g = p.main
    g.qf([(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)], (0, 0, 1), MOSS, hint=-0.1)
    grave_slab(g, -0.985, -0.02, -0.985, 0.985, hint=0.04)
    grave_slab(g, 0.02, 0.985, -0.985, 0.985, tilt=(0.012, -0.008), hint=-0.06)
    p.info['tile'] = True
    p.info['budgetNote'] = '07 counts 4 for a textured tile; the slabs and joints are geometry here (D-110: no textures)'
    return p


def cry_floor_slab_open():
    p = Piece('cry_floor_slab_open', role='shell', budget=80, grime=False, bake={'ground': None})
    g = p.main
    x0, x1, y0, y1, d = 0.06, 0.94, -0.94, 0.94, 0.75
    g.qf([(-1, -1, 0), (0.02, -1, 0), (0.02, 1, 0), (-1, 1, 0)], (0, 0, 1), MOSS, hint=-0.1)
    g.qf([(0.02, -1, 0), (1, -1, 0), (1, y0, 0), (0.02, y0, 0)], (0, 0, 1), MOSS, hint=-0.1)
    g.qf([(0.02, y1, 0), (1, y1, 0), (1, 1, 0), (0.02, 1, 0)], (0, 0, 1), MOSS, hint=-0.1)
    g.qf([(0.02, y0, 0), (x0, y0, 0), (x0, y1, 0), (0.02, y1, 0)], (0, 0, 1), MOSS, hint=-0.1)
    g.qf([(x1, y0, 0), (1, y0, 0), (1, y1, 0), (x1, y1, 0)], (0, 0, 1), MOSS, hint=-0.1)
    grave_slab(g, -0.985, -0.02, -0.985, 0.985, hint=0.02)
    g.qf([(x0, y0, 0), (x1, y0, 0), (x1, y0, -d), (x0, y0, -d)], (0, 1, 0), DSTONE, hint=-0.2)
    g.qf([(x0, y1, 0), (x1, y1, 0), (x1, y1, -d), (x0, y1, -d)], (0, -1, 0), DSTONE, hint=-0.2)
    g.qf([(x0, y0, 0), (x0, y1, 0), (x0, y1, -d), (x0, y0, -d)], (1, 0, 0), DSTONE, hint=-0.2)
    g.qf([(x1, y0, 0), (x1, y1, 0), (x1, y1, -d), (x1, y0, -d)], (-1, 0, 0), DSTONE, hint=-0.2)
    g.qf([(x0, y0, -d), (x1, y0, -d), (x1, y1, -d), (x0, y1, -d)], (0, 0, 1), INK)
    with g.at((0.78, 0.25, 0.0), rz=16):
        g.box((-0.46, -0.96, 0.0), (0.46, 0.96, 0.12), DSTONE, skip=('-z',), taper=(0.95, 0.98), hint={'+z': 0.08})
    with g.at((0.45, -0.3, -d), rx=-75):
        g.skull_flat(w=0.24, depth=0.02)
    p.mote((0, 0, -0.3), 'motes', 'corpse')
    p.info['tile'] = True
    p.info['hole'] = [-1, -1, 1, 1]
    return p


def cry_floor_bonegrate():
    p = Piece('cry_floor_bonegrate', role='shell', budget=70, grime=False, bake={'ground': None})
    g = p.main
    h, d = 0.74, 1.0
    g.qf([(-1, -1, 0), (-h, -1, 0), (-h, 1, 0), (-1, 1, 0)], (0, 0, 1), STONE, hint=-0.05)
    g.qf([(h, -1, 0), (1, -1, 0), (1, 1, 0), (h, 1, 0)], (0, 0, 1), STONE, hint=-0.05)
    g.qf([(-h, -1, 0), (h, -1, 0), (h, -h, 0), (-h, -h, 0)], (0, 0, 1), STONE, hint=-0.05)
    g.qf([(-h, h, 0), (h, h, 0), (h, 1, 0), (-h, 1, 0)], (0, 0, 1), STONE, hint=-0.05)
    for a, b, n in (((-h, -h), (h, -h), (0, 1, 0)), ((-h, h), (h, h), (0, -1, 0)),
                    ((-h, -h), (-h, h), (1, 0, 0)), ((h, -h), (h, h), (-1, 0, 0))):
        g.qf([(a[0], a[1], 0), (b[0], b[1], 0), (b[0], b[1], -d), (a[0], a[1], -d)], n, DSTONE, hint=-0.25)
    g.qf([(-h, -h, -d), (h, -h, -d), (h, h, -d), (-h, h, -d)], (0, 0, 1), BONE, hint=-0.1)
    with g.at((-0.25, 0.2, -d), rz=25, rx=-70):
        g.skull_flat(w=0.26, depth=0.02)
    for t in (-0.37, 0.0, 0.37):
        g.box((t - 0.045, -h, -0.07), (t + 0.045, h, 0.0), IRON, skip=('-z', '-y', '+y'), hint=0.05)
    cuts = [-h, -0.415, -0.325, -0.045, 0.045, 0.325, 0.415, h]     # cross bars between the long bars
    for t in (-0.2, 0.2):
        for i in range(0, len(cuts) - 1, 2):
            g.qf([(cuts[i], t - 0.04, -0.006), (cuts[i + 1], t - 0.04, -0.006), (cuts[i + 1], t + 0.04, -0.006), (cuts[i], t + 0.04, -0.006)],
                 (0, 0, 1), IRON)
    p.mote((0, 0, -0.4), 'smoke', 'corpse')
    p.info['tile'] = True
    p.info['hole'] = [-1, -1, 1, 1]
    p.info['trap'] = 'the Grave Breath vent rises from under it (fx smoke, corpse green)'
    return p


def cry_floor_mist():
    p = Piece('cry_floor_mist', role='decal', budget=2, bake=SKIP, grime=False)
    p.main.qf([(-4, -4, 0.14), (4, -4, 0.14), (4, 4, 0.14), (-4, 4, 0.14)], (0, 0, 1), WATER)
    p.gfun = lambda q, h: 0.5
    p.info.update({'translucent': 0.22, 'scroll': [0.12, 0.05], 'note': 'one per 8 m cell at the cell centre; floor mist everywhere (07 §2.2)'})
    return p


def cry_wall_plain_2m():
    """Dressed stone in five courses of ashlar over a mossy plinth (07 counts 24 triangles for a textured wall)."""
    p = Piece('cry_wall_plain_2m', role='shell', budget=80, bake=WALL_BAKE)
    g = p.main
    pz, top0 = wall_frame(g, -1.0, 1.0)
    ashlar(g, -1.0, 1.0, pz, top0)
    p.info['budgetNote'] = '07 counts 24 for a textured wall; the ashlar courses are geometry here (D-110: no textures)'
    return p


def cry_wall_cut_2m():
    """The camera-side wall, cut down to about 0.55 m with a broken top (the client cuts walls facing the camera)."""
    p = Piece('cry_wall_cut_2m', role='shell', budget=40, bake=WALL_BAKE)
    front = jagged(-1.0, 1.0, 4, CUT_H, 0.08, 1.0)
    back = jagged(-1.0, 1.0, 4, CUT_H - 0.03, 0.07, 2.0)
    cut_block(p.main, -1.0, 1.0, front, back)
    return p


def cry_wall_niche_2m():
    """A burial-niche facing (wall-hung against a shell wall): three loculi, two filled, 0.45 m deep."""
    p = Piece('cry_wall_niche_2m', role='wall-hung', budget=140, bake=HUNG_BAKE, hang=True)
    g = p.main
    F = -0.45
    g.box((-1.0, F - 0.06, 0.0), (1.0, F, 0.28), DSTONE, skip=('-z', '+y', '-x', '+x'), slots={'+z': MOSS}, hint={'-y': -0.08})
    g.box((-1.0, F - 0.07, WALL_H - 0.2), (1.0, F, WALL_H), STONE, skip=('+y', '+z', '-x', '+x'), hint={'-z': -0.1, '-y': 0.06})
    g.qf([(-1.0, F - 0.07, WALL_H), (1.0, F - 0.07, WALL_H), (1.0, 0.1, WALL_H), (-1.0, 0.1, WALL_H)], (0, 0, 1), STONE, hint=0.05)
    for x, n in ((-1.0, (-1, 0, 0)), (1.0, (1, 0, 0))):
        g.qf([(x, F, 0.0), (x, 0.1, 0.0), (x, 0.1, WALL_H), (x, F, WALL_H)], n, STONE, hint=-0.04)
    xs = [-1.0, -0.82, 0.82, 1.0]
    zs = [0.28, 0.42, 1.02, 1.30, 1.90, 2.16, 2.76, WALL_H - 0.2]
    face_grid(g, xs, zs, {(1, 1), (1, 3), (1, 5)}, y=F, hints={(1, 0): -0.05, (1, 6): 0.05})
    for (z0, z1), kind in zip(((0.42, 1.02), (1.30, 1.90), (2.16, 2.76)), ('shroud', None, 'bones')):
        recess(g, -0.82, 0.82, z0, z1, F, -0.06)
        if kind:
            niche_contents(g, 0.0, z0, kind, F + 0.2)
    p.info['note'] = 'a facing: place it 0.1 m in front of a wall face (rotationY as a wall-hung prop); it reaches 0.45 m into the room'
    return p


def cry_wall_bone_2m():
    """An ossuary facing (wall-hung): rows of skulls between bands of long bones in a stone frame, a memento-mori
    crest above; 0.3 m deep."""
    p = Piece('cry_wall_bone_2m', role='wall-hung', budget=260, bake=HUNG_BAKE, hang=True)
    g = p.main
    F = -0.3
    pz, relief_top = 0.28, 2.34
    g.box((-1.0, F - 0.06, 0.0), (1.0, F, pz), DSTONE, skip=('-z', '+y', '-x', '+x'), slots={'+z': MOSS}, hint={'-y': -0.08})
    g.box((-1.0, F - 0.07, WALL_H - 0.2), (1.0, F, WALL_H), STONE, skip=('+y', '+z', '-x', '+x'), hint={'-z': -0.1, '-y': 0.06})
    g.qf([(-1.0, F - 0.07, WALL_H), (1.0, F - 0.07, WALL_H), (1.0, 0.1, WALL_H), (-1.0, 0.1, WALL_H)], (0, 0, 1), STONE, hint=0.05)
    for x, n in ((-1.0, (-1, 0, 0)), (1.0, (1, 0, 0))):
        g.qf([(x, F, 0.0), (x, 0.1, 0.0), (x, 0.1, WALL_H), (x, F, WALL_H)], n, STONE, hint=-0.04)
    for x0, x1, n in ((-1.0, -0.92, (1, 0, 0)), (0.92, 1.0, (-1, 0, 0))):
        g.qf([(x0, F, pz), (x1, F, pz), (x1, F, relief_top), (x0, F, relief_top)], (0, -1, 0), STONE)
        xi = x1 if n[0] > 0 else x0
        g.qf([(xi, F, pz), (xi, -0.04, pz), (xi, -0.04, relief_top), (xi, F, relief_top)], n, DSTONE, hint=-0.1)
    g.qf([(-1.0, F, relief_top), (1.0, F, relief_top), (1.0, F, WALL_H - 0.2), (-1.0, F, WALL_H - 0.2)], (0, -1, 0), STONE, hint=0.04)
    g.qf([(-0.92, F, relief_top), (0.92, F, relief_top), (0.92, -0.04, relief_top), (-0.92, -0.04, relief_top)], (0, 0, -1), DSTONE, hint=-0.15)
    g.qf([(-0.92, -0.04, pz), (0.92, -0.04, pz), (0.92, -0.04, relief_top), (-0.92, -0.04, relief_top)], (0, -1, 0), INK)
    z = pz + 0.03
    rows = []
    for band in range(3):
        for k in range(3):
            z0 = z + k * 0.135
            fy = F + 0.02 + 0.03 * ((k + band) % 2)
            g.box((-0.92, fy, z0), (0.92, -0.04, z0 + 0.115), BONE, skip=('-z', '+y', '-x', '+x'),
                  hint={'-y': 0.04 * ((k + band) % 2) - 0.02, '+z': 0.08})
        z += 3 * 0.135 + 0.02
        if band < 2:
            rows.append(z)
            z += 0.33
    for zr in rows:
        for i in range(5):
            x = -0.72 + i * 0.36
            with g.at((x, F + 0.12, zr)):
                g.skull_flat(w=0.29, depth=0.13)
    with g.at((0, F, relief_top + 0.30)):
        g.skull_flat(w=0.30, depth=0.12)
    g.bar((-0.36, F - 0.06, relief_top + 0.12), (0.36, F - 0.06, relief_top + 0.62), 0.08, 0.08, BONE, caps=False, skip=('bottom', 'left'), up=(0, -1, 0))
    g.bar((-0.36, F - 0.06, relief_top + 0.62), (0.36, F - 0.06, relief_top + 0.12), 0.08, 0.08, BONE, caps=False, skip=('bottom', 'left'), up=(0, -1, 0))
    p.info['note'] = 'a facing: place it 0.1 m in front of a wall face; it reaches 0.3 m into the room'
    return p


CORNER_OL = [(-WALL_T, WALL_T), (-WALL_T, -0.34), (0.12, -0.34), (0.34, -0.12), (0.34, WALL_T)]
CORNER_BASE = [(-WALL_T, WALL_T), (-WALL_T, -0.42), (0.16, -0.42), (0.42, -0.16), (0.42, WALL_T)]


def cry_wall_corner_in():
    """The inside corner post: fills the outer corner block where two walls meet and stands a hooded mourner on a
    corbel at the corner, facing the room. rotationY 0 = the room's NW corner (the room in local +x / −y)."""
    p = Piece('cry_wall_corner_in', role='shell', budget=160, bake={'ground': 0.0, 'wall': 0.0})
    g = p.main
    g.prism(CORNER_BASE, 0.0, 0.34, DSTONE, top=True, top_slot=MOSS, hint=-0.05)
    g.prism(CORNER_OL, 0.34, WALL_H - 0.26, STONE, top=False)
    g.prism(CORNER_BASE, WALL_H - 0.26, WALL_H, STONE, top=True, hint=0.06, top_hint=0.08)
    d = Vector((1, -1, 0)).normalized()
    c = Vector((0.23, -0.23, 0)) + d * 0.12
    with g.at((c.x, c.y, 1.55), rz=-45):
        g.box((-0.22, -0.26, -0.22), (0.22, 0.05, 0.0), STONE, skip=('+y',), hint=0.05)
        rings = [(0.19, 0.0), (0.22, 0.46), (0.17, 0.94), (0.15, 1.06)]
        g.lathe(rings, 6, BONE, sg=2, cap_top=False, phase=math.pi / 6, hint=-0.05)
        g.lathe([(0.15, 1.06), (0.165, 1.2, 0, -0.03), (0.12, 1.35, 0, -0.08), (0.0, 1.42, 0, -0.1)], 6, BONE, sg=3,
                cap_top=False, phase=math.pi / 6, hint=-0.02)
        g.qf([(-0.08, -0.15, 1.08), (0.08, -0.15, 1.08), (0.065, -0.185, 1.24), (-0.065, -0.185, 1.24)], (0, -1, 0.2), INK)
        g.box((-0.08, -0.24, 0.72), (0.08, -0.13, 0.88), BONE, skip=('+y',), hint=0.1)
    p.info['corner'] = 'rotationY 0 = the NW corner; NE −90, SE 180, SW 90'
    return p


def cry_wall_corner_cut():
    """The corner post cut down for a corner on the camera side."""
    p = Piece('cry_wall_corner_cut', role='shell', budget=40, bake={'ground': 0.0, 'wall': 0.0})
    g = p.main
    g.prism(CORNER_BASE, 0.0, 0.34, DSTONE, top=True, top_slot=MOSS, hint=-0.05)
    n = len(CORNER_OL)
    hs = [CUT_H + 0.05, CUT_H - 0.02, CUT_H + 0.09, CUT_H + 0.03, CUT_H - 0.03]
    b = [g.v((x, y, 0.34)) for x, y in CORNER_OL]
    t = [g.v((x, y, hs[i])) for i, (x, y) in enumerate(CORNER_OL)]
    for i in range(n):
        j = (i + 1) % n
        g.face([b[i], b[j], t[j], t[i]], STONE, 0, 0.0)
    g.face(t, DSTONE, 0, -0.12)
    return p


def cry_door_arch():
    p = Piece('cry_door_arch', role='shell', budget=240, bake=DOOR_BAKE)
    doorway_wall(p.main)
    p.info.update({'opening': [-1.0, 1.0], 'width': DOOR_PIECE_W, 'spring': DOOR_SPRING, 'apex': DOOR_APEX})
    return p


def cry_door_arch_cut():
    """The doorway on the camera side, cut down: two jamb stubs either side of the opening."""
    p = Piece('cry_door_arch_cut', role='shell', budget=60, bake=DOOR_BAKE)
    g = p.main
    for sgn, seed in ((-1, 3.0), (1, 5.0)):
        x0, x1 = sorted((sgn * DOOR_PIECE_W / 2, sgn * DOOR_W / 2))
        front = jagged(x0, x1, 2, CUT_H, 0.07, seed)
        back = jagged(x0, x1, 2, CUT_H - 0.03, 0.06, seed + 1)
        cut_block(g, x0, x1, front, back, ends=(True, True))
    p.info.update({'opening': [-1.0, 1.0], 'width': DOOR_PIECE_W})
    return p


def cry_door_iron():
    """The doorway with a barred iron gate (two leaves swing on the jambs) — the reliquary's door skin."""
    p = Piece('cry_door_iron', role='shell', budget=520, bake=DOOR_BAKE)
    g = p.main
    doorway_wall(g)
    gy = 0.16
    sp = DOOR_SPRING
    g.bar((-0.98, gy, sp), (0.98, gy, sp), 0.07, 0.07, IRON, caps=False)
    for xt in (-0.5, 0.0, 0.5):
        g.bar((xt, gy, sp + 0.03), (xt * 0.8, gy, arch_z(xt * 0.8) - 0.02), 0.045, 0.045, IRON, caps=False)
    for sgn in (1, -1):
        for zz in (0.35, 1.55):
            g.box((sgn * 1.0 - 0.05, gy - 0.05, zz), (sgn * 1.0 + 0.05, gy + 0.05, zz + 0.12), IRON, skip=('+y', '-z', '+z'))

    def leaf(name, hinge_x, sgn):
        lg = p.part(name, (hinge_x, gy, 0.0), axis='z', note='swings about its hinge (game y): up to ±100°, into the far room')
        x_out = hinge_x + sgn * 0.96
        xa, xb = sorted((hinge_x, x_out))
        for x in (hinge_x + sgn * 0.035, x_out - sgn * 0.035):
            lg.bar((x, gy, 0.06), (x, gy, 2.02), 0.065, 0.065, IRON, caps=False)
        for z in (0.12, 1.02, 1.98):
            lg.bar((xa, gy, z), (xb, gy, z), 0.06, 0.06, IRON, caps=False)
        for t in (0.25, 0.5, 0.75):
            x = hinge_x + sgn * 0.96 * t
            lg.bar((x, gy, 0.12), (x, gy, 2.0), 0.04, 0.04, IRON, caps=False)
        if sgn < 0:
            lg.box((x_out - 0.16, gy - 0.07, 0.9), (x_out + 0.0, gy + 0.05, 1.14), BRASS, skip=('+y',), hint=0.1)
    leaf('leaf_l', -1.0, 1)
    leaf('leaf_r', 1.0, -1)
    p.info.update({'opening': [-1.0, 1.0], 'width': DOOR_PIECE_W})
    return p


def cry_door_portcullis():
    """The Falling Portcullis trap and the Locked-door skin: the doorway with its grate in grooves (part `gate`)."""
    p = Piece('cry_door_portcullis', role='shell', budget=650, bake=DOOR_BAKE)
    g = p.main
    doorway_wall(g)
    gy = 0.2
    for sgn in (1, -1):
        g.qf([(sgn * 1.0, gy - 0.05, 0.0), (sgn * 1.0, gy + 0.05, 0.0), (sgn * 1.0, gy + 0.05, DOOR_SPRING), (sgn * 1.0, gy - 0.05, DOOR_SPRING)],
             (-sgn, 0, 0), INK)
    gate = p.part('gate', (0.0, gy, 0.0), axis='z', note='lifts along game y: +2.2 m to open (hide it when raised); drops for the trap')
    for x in (-0.84, -0.5, -0.17, 0.17, 0.5, 0.84):
        top = arch_z(x) - 0.03
        gate.bar((x, gy, 0.12), (x, gy, top), 0.075, 0.075, IRON, caps=False)
        gate.lathe([(0.0, 0.0, x, gy), (0.055, 0.12, x, gy)], 4, IRON, sg=0, cap_top=False, phase=math.pi / 4)
    for z in (0.35, 0.9, 1.45, 2.0, 2.55):
        half = (math.sqrt(max(0.0, 1.0 - (z - DOOR_SPRING) ** 2)) if z > DOOR_SPRING else 1.0) - 0.04
        gate.bar((-half, gy, z), (half, gy, z), 0.07, 0.06, IRON, caps=False)
    p.info.update({'opening': [-1.0, 1.0], 'width': DOOR_PIECE_W})
    return p


def cry_door_secret():
    """A niche wall whose middle swings: closed, its middle 2 m reads as a niche bay between plain jambs; open, it shows
    kit_lib's opening. The `panel` is hinged at the left jamb."""
    p = Piece('cry_door_secret', role='shell', budget=180, bake=DOOR_BAKE)
    g = p.main
    X = DOOR_PIECE_W / 2
    pz = 0.28
    top_panel = DOOR_APEX + 0.08
    rnd = [(-1.0, 0.0)] + round_arc()
    for sgn in (1, -1):
        x0, x1 = sorted((sgn * 1.0, sgn * X))
        g.qf([(x0, 0, pz), (x1, 0, pz), (x1, 0, WALL_H - 0.2), (x0, 0, WALL_H - 0.2)], (0, -1, 0), STONE)
        g.box((x0, -0.06, 0.0), (x1, 0.0, pz), DSTONE, skip=('-z', '+y', '-x', '+x'), slots={'+z': MOSS})
    g.qf([(-1, 0, top_panel), (1, 0, top_panel), (1, 0, WALL_H - 0.2), (-1, 0, WALL_H - 0.2)], (0, -1, 0), STONE)
    g.box((-X, -0.07, WALL_H - 0.2), (X, 0.0, WALL_H), STONE, skip=('+y', '+z', '-x', '+x'), hint={'-z': -0.1, '-y': 0.06})
    g.qf([(-X, -0.07, WALL_H), (X, -0.07, WALL_H), (X, WALL_T, WALL_H), (-X, WALL_T, WALL_H)], (0, 0, 1), STONE, hint=0.05)
    g.qf([(-X, 0, 0), (-X, WALL_T, 0), (-X, WALL_T, WALL_H), (-X, 0, WALL_H)], (-1, 0, 0), STONE)
    g.qf([(X, 0, 0), (X, WALL_T, 0), (X, WALL_T, WALL_H), (X, 0, WALL_H)], (1, 0, 0), STONE)
    outer_b = [(-X, 0.0), (-X, DOOR_SPRING), (-X, 2.85), (-X, WALL_H), (-1.0, WALL_H), (0.0, WALL_H)]
    for k in range(len(rnd) - 1):
        for sgn in (1, -1):
            g.qf([(sgn * outer_b[k][0], WALL_T, outer_b[k][1]), (sgn * rnd[k][0], WALL_T, rnd[k][1]),
                  (sgn * rnd[k + 1][0], WALL_T, rnd[k + 1][1]), (sgn * outer_b[k + 1][0], WALL_T, outer_b[k + 1][1])], (0, 1, 0), STONE)
            pp, q = rnd[k], rnd[k + 1]
            nrm = (q[1] - pp[1], 0, -(q[0] - pp[0])) if sgn == 1 else (-(q[1] - pp[1]), 0, -(q[0] - pp[0]))
            g.qf([(sgn * pp[0], 0.05, pp[1]), (sgn * q[0], 0.05, q[1]), (sgn * q[0], WALL_T, q[1]), (sgn * pp[0], WALL_T, pp[1])], nrm, DSTONE, hint=-0.1)
    d = p.part('panel', (-1.0, 0.0, 0.0), axis='z', note='swings about the left jamb (game y) into the far room: −95° to open')
    xs = [-0.99, -0.82, 0.82, 0.99]
    zs = [pz, 0.42, 1.02, 1.30, 1.90, 2.16, 2.76, top_panel]
    face_grid(d, xs, zs, {(1, 1), (1, 3), (1, 5)})
    d.box((-0.99, -0.06, 0.0), (0.99, 0.0, pz), DSTONE, skip=('-z', '+y', '-x', '+x'), slots={'+z': MOSS})
    depth = 0.24
    for (z0, z1), kind in zip(((0.42, 1.02), (1.30, 1.90), (2.16, 2.76)), ('shroud', None, 'bones')):
        recess(d, -0.82, 0.82, z0, z1, 0.0, depth)
        if kind:
            niche_contents(d, 0.0, z0, kind, depth * 0.55)
    d.qf([(-0.99, 0.3, 0), (0.99, 0.3, 0), (0.99, 0.3, top_panel), (-0.99, 0.3, top_panel)], (0, 1, 0), DSTONE)
    for xe, n in ((-0.99, (-1, 0, 0)), (0.99, (1, 0, 0))):
        d.qf([(xe, 0.0, 0.0), (xe, 0.3, 0.0), (xe, 0.3, top_panel), (xe, 0.0, top_panel)], n, DSTONE)
    p.info.update({'opening': [-1.0, 1.0], 'width': DOOR_PIECE_W})
    return p


# ───────────────────────────────────────────── structure ─────────────────────────────────────────────

def cry_pillar_cluster():
    p = Piece('cry_pillar_cluster', role='prop', budget=220)
    g = p.main
    g.lathe([(0.52, 0.0), (0.52, 0.22), (0.42, 0.34)], 8, DSTONE, sg=0, cap_top=True, phase=math.pi / 8, top_slot=MOSS, hint=-0.04)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        c = (0.17 * math.cos(a), 0.17 * math.sin(a))
        g.lathe([(0.16, 0.34), (0.16, 3.0)], 6, STONE, sg=4 + k, cap_top=False, center=c, phase=a)
    g.lathe([(0.2, 0.34), (0.2, 3.0)], 4, STONE, sg=9, cap_top=False, phase=0.0)
    g.lathe([(0.36, 2.96), (0.48, 3.22), (0.5, 3.3)], 8, STONE, sg=0, cap_top=False, phase=math.pi / 8, hint=0.05)
    g.box((-0.5, -0.5, 3.3), (0.5, 0.5, 3.5), STONE, skip=('-z',), hint={'+z': 0.08})
    g.lathe([(0.34, 1.64), (0.34, 1.74)], 8, DSTONE, sg=0, cap_top=False, phase=math.pi / 8)
    g.box((-0.26, -0.56, 1.70), (0.26, -0.18, 1.80), IRON, skip=('+y',), hint=0.05)
    g.box((-0.05, -0.36, 1.52), (0.05, -0.18, 1.70), IRON, skip=('+y', '-z'), taper=(1, 0.3), shift=(0, -0.07))
    candle(g, -0.12, -0.42, 1.80, 0.26, piece=p)
    candle(g, 0.11, -0.38, 1.80, 0.18, piece=p)
    return p


def _rib_points(span=4.05, rise=2.0, n=3, side=-1, t_end=70.0):
    """One half of a gently pointed rib from its foot (side · span, 0) to the apex (0, rise): an elliptical arc that
    leaves the foot vertically and still climbs at the apex (so two halves meet in a point), never above the apex."""
    T = math.radians(t_end)
    pts = []
    for i in range(n + 1):
        t = T * i / n
        x = span * (1.0 - math.cos(t)) / (1.0 - math.cos(T))
        z = rise * math.sin(t) / math.sin(T)
        pts.append((side * (span - x), z))
    pts[-1] = (0.0, rise)
    return pts


def _rib(g, pts, w=0.26, dep=0.3):
    hw = w / 2
    for i in range(len(pts) - 1):
        (x0, z0), (x1, z1) = pts[i], pts[i + 1]
        tx, tz = x1 - x0, z1 - z0
        L = math.hypot(tx, tz)
        nx, nz = -tz / L, tx / L
        if nz < 0:
            nx, nz = -nx, -nz
        o0 = (x0 + nx * dep, z0 + nz * dep)
        o1 = (x1 + nx * dep, z1 + nz * dep)
        g.qf([(o0[0], -hw, o0[1]), (o1[0], -hw, o1[1]), (o1[0], hw, o1[1]), (o0[0], hw, o0[1])], (nx, 0, nz), STONE, hint=0.08)
        g.qf([(x0, -hw, z0), (x1, -hw, z1), (x1, hw, z1), (x0, hw, z0)], (-nx, 0, -nz), DSTONE, hint=-0.1)
        g.qf([(x0, -hw, z0), (x1, -hw, z1), (o1[0], -hw, o1[1]), (o0[0], -hw, o0[1])], (0, -1, 0), STONE)
        g.qf([(x0, hw, z0), (x1, hw, z1), (o1[0], hw, o1[1]), (o0[0], hw, o0[1])], (0, 1, 0), STONE)


def cry_vault_rib():
    """A pointed ceiling rib spanning 8 m along X (its feet on the wall tops); placed at y = 3.5."""
    p = Piece('cry_vault_rib', role='hanging', budget=48, grime=False, bake={'ground': None})
    left = _rib_points(side=-1)
    right = list(reversed(_rib_points(side=1)))[1:]
    _rib(p.main, left + right)
    p.info['place'] = 'y = 3.5 (the wall top) on the line it spans; rotationY 90 spans N–S. Over a cut-away wall use cry_vault_rib_half, or set it against a far wall as a wall arch (the spider gallery)'
    return p


def cry_vault_rib_half():
    """The far half of a vault rib for the cut-away rooms (the near half is cut away with the near walls): it springs
    from a corbel on a wall (the origin, on the wall's room face at the springing height) and rises 1.6 m over 4 m into
    the room to a pendant boss. Spring it low enough that the apex stays in front of the far wall in the camera's view
    (the spider gallery springs it at 2.6 m) or on the wall top (3.5 m) where the camera looks down steeply."""
    p = Piece('cry_vault_rib_half', role='hanging', budget=60, grime=False, bake={'ground': None})
    g = p.main
    rise = 1.6
    pts = _rib_points(rise=rise, side=-1)
    with g.at((0, 0, 0), rz=-90):
        _rib(g, [(x + 4.05, z) for x, z in pts])
    g.lathe([(0.0, rise - 0.42), (0.18, rise - 0.24), (0.15, rise + 0.02)], 5, STONE, sg=1, cap_top=False, center=(0.0, -4.05), hint=0.06)
    g.box((-0.19, -0.3, -0.34), (0.19, 0.1, 0.0), STONE, skip=('+y',), taper=(1.0, 1.0), hint={'+z': 0.06, '-y': 0.02})
    p.info['place'] = 'on the room edge line of a standing wall (the far side), rotationY as a wall prop there; y = the springing height; two meet at a crossing'
    return p


# ───────────────────────────────────────────── tombs ─────────────────────────────────────────────────

def cry_sarcophagus():
    p = Piece('cry_sarcophagus', role='prop', budget=480)
    g = p.main
    L, W = 1.1, 0.5
    g.box((-L - 0.12, -W - 0.12, 0.0), (L + 0.12, W + 0.12, 0.16), DSTONE, skip=('-z',), slots={'+z': MOSS}, taper=(0.98, 0.95))
    g.box((-L, -W, 0.16), (L, W, 0.9), STONE, skip=('-z', '-y', '+y'))
    for side in (-1, 1):
        yy = side * W
        want = (0, side, 0)
        xs = [-L, -L + 0.14, L - 0.14, L]
        zs = [0.16, 0.30, 0.76, 0.9]
        for ri in range(3):
            for ci in range(3):
                if (ci, ri) == (1, 1):
                    continue
                g.qf([(xs[ci], yy, zs[ri]), (xs[ci + 1], yy, zs[ri]), (xs[ci + 1], yy, zs[ri + 1]), (xs[ci], yy, zs[ri + 1])], want, STONE)
        rin = yy - side * 0.05
        g.qf([(xs[1], rin, zs[1]), (xs[2], rin, zs[1]), (xs[2], rin, zs[2]), (xs[1], rin, zs[2])], want, DSTONE, hint=-0.06)
        for (a, b), n in ((((xs[1], zs[1]), (xs[2], zs[1])), (0, 0, 1)), (((xs[1], zs[2]), (xs[2], zs[2])), (0, 0, -1)),
                          (((xs[1], zs[1]), (xs[1], zs[2])), (1, 0, 0)), (((xs[2], zs[1]), (xs[2], zs[2])), (-1, 0, 0))):
            g.qf([(a[0], yy, a[1]), (b[0], yy, b[1]), (b[0], rin, b[1]), (a[0], rin, a[1])], n, DSTONE, hint=-0.1)
        if side < 0:
            with g.at((0.0, rin, 0.40)):
                g.skull_flat(w=0.26, depth=0.06)
    lid = p.part('lid', (0.0, W + 0.06, 0.9), axis='x', note='hinges on its back top edge: −80° about game x opens it backward')
    lid.box((-L - 0.06, -W - 0.06, 0.9), (L + 0.06, W + 0.06, 1.02), STONE, skip=('-z',), hint={'+z': 0.04})
    sec = [(-W - 0.02, 1.02), (W + 0.02, 1.02), (W + 0.02, 1.04), (0.0, 1.13), (-W - 0.02, 1.04)]
    for i in range(1, len(sec)):
        a, b = sec[i], sec[(i + 1) % len(sec)]
        nrm = Vector((0, b[1] - a[1], -(b[0] - a[0]))) * -1
        lid.qf([(-L - 0.03, a[0], a[1]), (L + 0.03, a[0], a[1]), (L + 0.03, b[0], b[1]), (-L - 0.03, b[0], b[1])], tuple(nrm), STONE, hint=0.06)
    for xe, n in ((-L - 0.03, (-1, 0, 0)), (L + 0.03, (1, 0, 0))):
        lid.qf([(xe, y, z) for y, z in sec], n, STONE)
    lid.box((-0.78, -0.2, 1.08), (0.56, 0.2, 1.24), BONE, skip=('-z',), taper=(0.96, 0.8), hint={'+z': 0.08})
    lid.box((-0.02, -0.08, 1.24), (0.18, 0.08, 1.30), BONE, skip=('-z',), hint=0.1)
    lid.box((0.58, -0.22, 1.10), (0.92, 0.22, 1.18), BONE, skip=('-z',), taper=(0.9, 0.9))
    lid.box((0.6, -0.12, 1.18), (0.86, 0.12, 1.36), BONE, skip=('-z',), taper=(0.75, 0.8), hint={'+z': 0.1})
    lid.box((-0.98, -0.16, 1.08), (-0.78, 0.16, 1.26), BONE, skip=('-z',), taper=(0.7, 0.8))
    ch = p.part('chains', (0.0, 0.0, 0.0), axis='z', note='the Sealed Sarcophagus\x27s chains: hide them when it is opened')
    for xc in (-0.55, 0.55):
        path = [(-W - 0.075, 0.2), (-W - 0.075, 1.04), (-W + 0.05, 1.07), (0.0, 1.16), (W - 0.05, 1.07), (W + 0.075, 1.04), (W + 0.075, 0.2)]
        k = 0
        for i in range(len(path) - 1):
            (y0, z0), (y1, z1) = path[i], path[i + 1]
            seg = math.hypot(y1 - y0, z1 - z0)
            n = max(1, int(round(seg / 0.2)))
            for j in range(n):
                t0, t1 = j / n, (j + 0.92) / n
                a = (xc, y0 + (y1 - y0) * t0, z0 + (z1 - z0) * t0)
                b = (xc, y0 + (y1 - y0) * t1, z0 + (z1 - z0) * t1)
                up = (0, 0, 1) if abs(z1 - z0) > abs(y1 - y0) else (0, 1, 0)
                if k % 2 == 0:
                    ch.bar(a, b, 0.08, 0.025, IRON, caps=False, up=up)
                else:
                    ch.bar(a, b, 0.025, 0.07, IRON, caps=False, up=up)
                k += 1
    ch.box((0.42, -W - 0.16, 0.5), (0.68, -W - 0.06, 0.72), IRON, hint=0.12)
    p.info['curio'] = 'sealed-sarcophagus'
    return p


def cry_coffin_wood():
    p = Piece('cry_coffin_wood', role='prop', budget=120)
    g = p.main
    ol = [(-1.0, -0.22), (0.42, -0.36), (1.0, -0.25), (1.0, 0.25), (0.42, 0.36), (-1.0, 0.22)]
    g.prism(ol, 0.0, 0.36, WOOD, top=False, hint=-0.04)
    big = [(x * 1.03, y * 1.08) for x, y in ol]
    g.prism(big, 0.36, 0.44, DWOOD, top=True)
    panel = [(x * 0.84, y * 0.72) for x, y in ol]
    g.prism(panel, 0.44, 0.47, WOOD, top=True, top_hint=0.08)
    for side in (-1, 1):
        for xh in (-0.45, 0.6):
            yy = side * (0.25 + (0.36 - 0.25) * (1 - abs(xh - 0.42) / 1.42)) + side * 0.03
            g.bar((xh - 0.12, yy, 0.2), (xh + 0.12, yy, 0.2), 0.035, 0.05, IRON, caps=True)
    p.info['stack'] = 'coffins stack at y = 0.47'
    return p


def cry_urn_row():
    """Five funerary urns on a stone bench (the Funeral Urns curio); each urn a part that breaks on its own."""
    p = Piece('cry_urn_row', role='prop', budget=300)
    g = p.main
    g.box((-1.25, -0.3, 0.62), (1.25, 0.3, 0.72), STONE, skip=('-z',), hint={'+z': 0.05})
    for xl in (-0.95, 0.95):
        g.box((xl - 0.17, -0.24, 0.0), (xl + 0.17, 0.24, 0.62), DSTONE, skip=('-z', '+z'), hint=-0.05)
    for i, x in enumerate((-1.0, -0.5, 0.0, 0.5, 1.0)):
        u = p.part('urn_%d' % i, (x, 0.0, 0.72), axis='z', note='breaks on its own when smashed: hide it and spawn shards')
        s = 1.0 + 0.12 * ((i * 7) % 3) / 2
        body = MOSS if i % 2 == 0 else BONE
        prof = [(0.11 * s, 0.72), (0.2 * s, 0.72 + 0.16 * s), (0.135 * s, 0.72 + 0.35 * s), (0.1 * s, 0.72 + 0.42 * s)]
        u.lathe([(r, z, x, 0.0) for r, z in prof], 6, body, sg=1, cap_top=True, top_slot=INK, phase=0.3 * i)
    p.info['curio'] = 'funeral-urns'
    return p


def cry_candle_ring():
    """Twelve corpse-candles on an iron ring (the Mourner's Candles; the ring round the Warden's bier). Each wick is its
    own light point, so the client can snuff them one by one (counter-clockwise from game +x)."""
    p = Piece('cry_candle_ring', role='prop', budget=360)
    g = p.main
    R, zr, n = 1.85, 0.3, 12
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        ri, ro, zb, zt = R - 0.06, R + 0.06, zr - 0.08, zr
        p0o, p1o = (ro * math.cos(a0), ro * math.sin(a0)), (ro * math.cos(a1), ro * math.sin(a1))
        p0i, p1i = (ri * math.cos(a0), ri * math.sin(a0)), (ri * math.cos(a1), ri * math.sin(a1))
        am = (a0 + a1) / 2
        g.qf([(*p0i, zt), (*p0o, zt), (*p1o, zt), (*p1i, zt)], (0, 0, 1), IRON, hint=0.08)
        g.qf([(*p0o, zb), (*p1o, zb), (*p1o, zt), (*p0o, zt)], (math.cos(am), math.sin(am), 0), IRON)
        g.qf([(*p0i, zb), (*p1i, zb), (*p1i, zt), (*p0i, zt)], (-math.cos(am), -math.sin(am), 0), IRON)
    for k in range(6):
        a = 2 * math.pi * (k + 0.5) / 6
        top = (R * math.cos(a), R * math.sin(a), zr - 0.06)
        foot = ((R + 0.14) * math.cos(a), (R + 0.14) * math.sin(a), 0.0)
        g.bar(foot, top, 0.06, 0.06, IRON, caps=False, up=(math.cos(a), math.sin(a), 0))
    heights = (0.30, 0.22, 0.36, 0.26, 0.20, 0.33, 0.28, 0.24, 0.38, 0.21, 0.31, 0.27)
    for i in range(n):
        a = 2 * math.pi * i / n
        candle(g, R * math.cos(a), R * math.sin(a), zr, heights[i], w=0.095, piece=p)
    p.info['curio'] = 'mourners-candles'
    return p


def cry_statue_weeping():
    p = Piece('cry_statue_weeping', role='prop', budget=900)
    g = p.main
    g.lathe([(0.64, 0.0), (0.64, 0.26), (0.56, 0.32), (0.56, 0.44)], 8, DSTONE, sg=0, cap_top=True, phase=math.pi / 8, top_slot=MOSS, hint=-0.04)
    z0 = 0.44
    robe = [(0.44, z0, 0, 0.0), (0.42, z0 + 0.45, 0, 0.0), (0.34, z0 + 0.95, 0, -0.02), (0.31, z0 + 1.28, 0, -0.03), (0.34, z0 + 1.46, 0, -0.04)]
    g.lathe(robe, 10, STONE, sg=1, cap_top=False, phase=math.pi / 10, hint=0.02)
    hood = [(0.34, z0 + 1.46, 0, -0.04), (0.26, z0 + 1.66, 0, -0.10), (0.21, z0 + 1.84, 0, -0.16), (0.11, z0 + 1.97, 0, -0.2), (0.0, z0 + 2.0, 0, -0.21)]
    g.lathe(hood, 10, STONE, sg=2, cap_top=False, phase=math.pi / 10, hint=0.06)
    g.qf([(-0.12, -0.36, z0 + 1.52), (0.12, -0.36, z0 + 1.52), (0.11, -0.385, z0 + 1.80), (-0.11, -0.385, z0 + 1.80)], (0, -1, 0.15), INK)
    for sgn in (1, -1):
        g.tube([(sgn * 0.3, -0.05, z0 + 1.38), (sgn * 0.26, -0.28, z0 + 1.30), (sgn * 0.12, -0.42, z0 + 1.52)], 0.09, 6, STONE, sg=5 + (sgn > 0), caps=False)
        g.box((sgn * 0.12 - 0.08, -0.5, z0 + 1.50), (sgn * 0.12 + 0.08, -0.38, z0 + 1.70), STONE, skip=('+y',), taper=(0.8, 0.8), hint=0.1)
        g.qf([(sgn * 0.06 - 0.02, -0.45, z0 + 1.48), (sgn * 0.06 + 0.02, -0.45, z0 + 1.48), (sgn * 0.07 + 0.018, -0.40, z0 + 0.95), (sgn * 0.07 - 0.018, -0.40, z0 + 0.95)],
             (0, -1, 0.1), GLOW)
    by = -0.95
    g.lathe([(0.2, 0.0, 0, by), (0.16, 0.12, 0, by), (0.12, 0.62, 0, by), (0.2, 0.7, 0, by)], 8, DSTONE, sg=7, cap_top=False, phase=math.pi / 8)
    g.lathe([(0.2, 0.7, 0, by), (0.44, 0.84, 0, by), (0.5, 0.94, 0, by)], 8, STONE, sg=8, cap_top=False, phase=math.pi / 8, hint=0.04)
    g.lathe([(0.5, 0.94, 0, by), (0.42, 0.94, 0, by), (0.40, 0.88, 0, by)], 8, STONE, sg=0, cap_top=False, phase=math.pi / 8)
    g.lathe([(0.40, 0.88, 0, by)], 8, WATER, cap_top=True, phase=math.pi / 8)
    p.mote((0.0, by, 1.25), 'drip')
    p.info['curio'] = 'weeping-statue'
    return p


def cry_bell_grave():
    p = Piece('cry_bell_grave', role='prop', budget=240)
    g = p.main
    for sx in (-0.62, 0.62):
        g.box((sx - 0.08, -0.5, 0.0), (sx + 0.08, 0.5, 0.16), DWOOD, skip=('-z',), taper=(1.0, 0.85))
        g.box((sx - 0.07, -0.07, 0.16), (sx + 0.07, 0.07, 2.3), DWOOD, skip=('-z',), hint={'+z': 0.08})
        g.bar((sx, 0.0, 1.75), (sx * 0.45, 0.0, 2.22), 0.08, 0.08, DWOOD, caps=False)
    g.box((-0.86, -0.09, 2.2), (0.86, 0.09, 2.38), DWOOD, hint={'+z': 0.06})
    bell = p.part('bell', (0.0, 0.0, 2.2), axis='x', note='swings about game x under the beam (±25°) when rung')
    bell.box((-0.06, -0.06, 2.08), (0.06, 0.06, 2.2), IRON, skip=('+z',))
    bell.lathe([(0.27, 1.56), (0.25, 1.64), (0.17, 1.9), (0.12, 2.02), (0.0, 2.08)], 8, BRASS, sg=1, cap_top=False, hint=0.06)
    bell.lathe([(0.27, 1.56)], 8, INK, cap_top=True)
    bell.box((-0.05, -0.05, 1.46), (0.05, 0.05, 1.58), IRON, taper=(0.7, 0.7))
    g.tube([(0.2, 0.0, 1.62), (0.22, -0.02, 1.25), (0.24, -0.03, 0.92)], 0.028, 4, ROPE, sg=6, caps=True)
    g.box((0.2, -0.07, 0.8), (0.29, 0.02, 0.92), ROPE, taper=(1.3, 1.3), skip=('+z',))
    p.info['curio'] = 'grave-bell'
    return p


def cry_web_sheet():
    """A web strung across a corner: a translucent fan of silk between four anchors (one sector torn away) with four
    radial strands and a ring drawn over it."""
    p = Piece('cry_web_sheet', role='decal', budget=20, bake=SKIP, grime=False)
    g = p.main
    hub = Vector((0.1, 0.0, 2.45))
    anchors = [Vector((-1.35, 0.0, 3.35)), Vector((1.35, 0.0, 3.3)), Vector((1.3, 0.0, 1.55)), Vector((-1.32, 0.0, 1.35))]
    w = 0.09
    # the silk: three sectors between the anchors (the fourth, at the left, is the tear), set 1 cm behind the strands
    back = Vector((0.0, 0.01, 0.0))
    for i in range(3):
        a, b = anchors[i], anchors[i + 1]
        g.qf([tuple(hub + back), tuple(a + back), tuple(b + back)], (0, -1, 0), CLOTH2)

    def strand(a, b, width=w):
        d = (b - a).normalized()
        n = Vector((-d.z, 0.0, d.x)) * (width / 2)
        g.qf([tuple(a - n), tuple(b - n), tuple(b + n), tuple(a + n)], (0, -1, 0), CLOTH2)
    for a in anchors:
        strand(hub, a)
    ring = [hub + (a - hub) * 0.6 for a in anchors]
    for i in range(3):
        strand(ring[i], ring[i + 1], w * 0.85)
    p.gfun = lambda q, h: 0.7
    p.info.update({'translucent': 0.5, 'doubleSided': True, 'note': 'spans a corner diagonally (rotationY 135 / −135 …) or hangs flat in front of a wall'})
    return p


def cry_bier_stone():
    p = Piece('cry_bier_stone', role='prop', budget=420)
    g = p.main
    g.box((-1.45, -0.85, 0.0), (1.45, 0.85, 0.24), DSTONE, skip=('-z',), slots={'+z': MOSS}, taper=(0.99, 0.98))
    g.box((-1.3, -0.7, 0.24), (1.3, 0.7, 0.48), DSTONE, skip=('-z',), taper=(0.99, 0.98))
    g.box((-1.18, -0.56, 0.48), (1.18, 0.56, 0.76), STONE, skip=('-z', '-y'), taper=(0.98, 0.96), hint={'+z': 0.06})
    xs, zs = [-1.18, -0.95, 0.95, 1.18], [0.48, 0.54, 0.70, 0.76]
    yy = -0.56
    for ri in range(3):
        for ci in range(3):
            if (ci, ri) == (1, 1):
                continue
            g.qf([(xs[ci], yy, zs[ri]), (xs[ci + 1], yy, zs[ri]), (xs[ci + 1], yy, zs[ri + 1]), (xs[ci], yy, zs[ri + 1])], (0, -1, 0), STONE)
    g.qf([(xs[1], yy + 0.04, zs[1]), (xs[2], yy + 0.04, zs[1]), (xs[2], yy + 0.04, zs[2]), (xs[1], yy + 0.04, zs[2])], (0, -1, 0), INK)
    g.qf([(xs[1], yy, zs[1]), (xs[2], yy, zs[1]), (xs[2], yy + 0.04, zs[1]), (xs[1], yy + 0.04, zs[1])], (0, 0, 1), DSTONE)
    g.qf([(xs[1], yy, zs[2]), (xs[2], yy, zs[2]), (xs[2], yy + 0.04, zs[2]), (xs[1], yy + 0.04, zs[2])], (0, 0, -1), DSTONE)
    with g.at((0.0, yy, 0.26)):
        g.skull_flat(w=0.3, depth=0.1)
    secs = [(-1.0, 0.13, 0.09), (-0.82, 0.17, 0.14), (-0.35, 0.22, 0.17), (0.1, 0.27, 0.2), (0.45, 0.29, 0.2), (0.66, 0.16, 0.12),
            (0.8, 0.15, 0.17), (0.98, 0.12, 0.16), (1.06, 0.07, 0.09)]
    ring = []
    for x, ry, rz in secs:
        ring.append([g.v((x, -ry * math.cos(math.pi * k / 4), 0.76 + rz * math.sin(math.pi * k / 4))) for k in range(5)])
    for i in range(len(ring) - 1):
        for k in range(4):
            a, b = ring[i][k], ring[i][k + 1]
            c, d = ring[i + 1][k + 1], ring[i + 1][k]
            g.face([a, d, c, b], CLOTH2, sg=3, hint=0.06)
    g.face(list(ring[0]), CLOTH2, sg=0)
    g.face(list(reversed(ring[-1])), CLOTH2, sg=0)
    for cx, cy in ((-1.05, -0.45), (1.05, -0.45), (-1.05, 0.45), (1.05, 0.45)):
        candle(g, cx, cy, 0.76, 0.16, w=0.09, piece=p)
    p.mote((0.0, 0.0, 1.3), 'motes', 'corpse')
    p.info['arena'] = 'the Barrow Warden (F6): the Crypt Waystone rises from it; the open slab is the stair to F7'
    return p


# ───────────────────────────────────────────── extras the templates name ─────────────────────────────

def cry_candle_bracket():
    """A wall bracket of three corpse-candles (the templates' "candle brackets"), hung at y ≈ 2.1."""
    p = Piece('cry_candle_bracket', role='wall-hung', budget=100, bake={'ground': None, 'wall': HANG_OFF}, hang=True)
    g = p.main
    g.box((-0.12, -0.05, -0.24), (0.12, 0.08, 0.2), IRON, skip=('+y',), taper=(0.8, 1.0), hint=0.05)
    g.bar((0.0, -0.05, -0.12), (0.0, -0.36, -0.02), 0.05, 0.05, IRON, caps=False)
    g.box((-0.23, -0.52, -0.03), (0.23, -0.2, 0.03), IRON, hint={'+z': 0.06})
    candle(g, -0.13, -0.37, 0.03, 0.22, w=0.085, piece=p)
    candle(g, 0.0, -0.33, 0.03, 0.31, w=0.09, piece=p)
    candle(g, 0.13, -0.38, 0.03, 0.17, w=0.08, piece=p)
    return p


def cry_candle_crown():
    """A hanging iron crown of candles (the crossing's "central bracket"); origin = the suspension point."""
    p = Piece('cry_candle_crown', role='hanging', budget=200, grime=False, bake={'ground': None})
    g = p.main
    R, zr, n = 0.72, -1.5, 8
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        ro, ri, zb, zt = R + 0.05, R - 0.05, zr - 0.07, zr
        p0o, p1o = (ro * math.cos(a0), ro * math.sin(a0)), (ro * math.cos(a1), ro * math.sin(a1))
        p0i, p1i = (ri * math.cos(a0), ri * math.sin(a0)), (ri * math.cos(a1), ri * math.sin(a1))
        am = (a0 + a1) / 2
        g.qf([(*p0i, zt), (*p0o, zt), (*p1o, zt), (*p1i, zt)], (0, 0, 1), IRON)
        g.qf([(*p0o, zb), (*p1o, zb), (*p1o, zt), (*p0o, zt)], (math.cos(am), math.sin(am), 0), IRON)
        g.qf([(*p0i, zb), (*p1i, zb), (*p1i, zt), (*p0i, zt)], (-math.cos(am), -math.sin(am), 0), IRON)
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.3
        g.bar((R * math.cos(a), R * math.sin(a), zr), (0.06 * math.cos(a), 0.06 * math.sin(a), -0.1), 0.035, 0.035, IRON, caps=False)
    g.box((-0.08, -0.08, -0.14), (0.08, 0.08, 0.0), IRON)
    heights = (0.22, 0.3, 0.2, 0.27, 0.24, 0.32, 0.19, 0.26)
    for i in range(n):
        a = 2 * math.pi * (i + 0.5) / n
        candle(g, R * math.cos(a), R * math.sin(a), zr, heights[i], w=0.085, piece=p)
    p.info['place'] = 'y = the suspension height (4.75 under the crossing\x27s rib bosses); the hoop hangs 1.5 m below'
    return p


def cry_altar_step():
    """The chapel's raised chancel: a 0.6 m dais (6 × 5.2 m) with two steps at the front and an altar at the back;
    an elite on EB2 stands on it (07 §2.2)."""
    p = Piece('cry_altar_step', role='prop', budget=300)
    g = p.main
    g.box((-3.0, -2.6, 0.0), (3.0, 2.6, 0.6), STONE, skip=('-z',), taper=(0.995, 0.995), hint={'+z': -0.02, '-y': -0.04})
    g.box((-2.6, -3.2, 0.0), (2.6, -2.6, 0.2), DSTONE, skip=('-z', '+y'), slots={'+z': MOSS})
    g.box((-2.6, -2.9, 0.2), (2.6, -2.6, 0.4), DSTONE, skip=('-z', '+y'), hint={'+z': 0.05})
    ay0, ay1 = 1.2, 2.0
    g.box((-0.85, ay0, 0.6), (0.85, ay1, 1.6), STONE, skip=('-z', '-y'))
    xs, zs = [-0.85, -0.65, 0.65, 0.85], [0.6, 0.78, 1.42, 1.6]
    for ri in range(3):
        for ci in range(3):
            if (ci, ri) == (1, 1):
                continue
            g.qf([(xs[ci], ay0, zs[ri]), (xs[ci + 1], ay0, zs[ri]), (xs[ci + 1], ay0, zs[ri + 1]), (xs[ci], ay0, zs[ri + 1])], (0, -1, 0), STONE)
    g.qf([(xs[1], ay0 + 0.05, zs[1]), (xs[2], ay0 + 0.05, zs[1]), (xs[2], ay0 + 0.05, zs[2]), (xs[1], ay0 + 0.05, zs[2])], (0, -1, 0), DSTONE)
    for (a, b), n in ((((xs[1], zs[1]), (xs[2], zs[1])), (0, 0, 1)), (((xs[1], zs[2]), (xs[2], zs[2])), (0, 0, -1)),
                      (((xs[1], zs[1]), (xs[1], zs[2])), (1, 0, 0)), (((xs[2], zs[1]), (xs[2], zs[2])), (-1, 0, 0))):
        g.qf([(a[0], ay0, a[1]), (b[0], ay0, b[1]), (b[0], ay0 + 0.05, b[1]), (a[0], ay0 + 0.05, a[1])], n, DSTONE)
    g.box((-1.0, ay0 - 0.1, 1.6), (1.0, ay1 + 0.1, 1.72), STONE, skip=('-z',), hint={'+z': 0.05})
    g.box((-0.62, ay0 - 0.12, 1.72), (0.62, ay1 + 0.12, 1.745), CLOTH1, skip=('-z',))
    g.qf([(-0.62, ay0 - 0.12, 1.25), (0.62, ay0 - 0.12, 1.25), (0.62, ay0 - 0.12, 1.72), (-0.62, ay0 - 0.12, 1.72)], (0, -1, 0), CLOTH1)
    for sx in (-0.72, 0.72):
        g.lathe([(0.1, 1.72, sx, 1.6), (0.05, 1.76, sx, 1.6), (0.04, 1.98, sx, 1.6), (0.08, 2.02, sx, 1.6)], 6, BRASS, sg=1, cap_top=True)
        candle(g, sx, 1.6, 2.02, 0.3, w=0.08, piece=p)
    p.info['raised'] = 0.6
    return p


def cry_hearth_niche():
    """The sexton's hearth against the wall: cheeks, mantel, a soot-dark hood and chimney breast; the shared
    `shr_campfire` burns in front of it (07 §2.2: "hearth niche with campfire")."""
    p = Piece('cry_hearth_niche', role='wall-hung', budget=220, bake=HUNG_BAKE, hang=True)
    g = p.main
    for sx in (-1, 1):
        x0, x1 = sorted((sx * 0.76, sx * 1.06))
        g.box((x0, -0.72, 0.0), (x1, 0.1, 1.25), STONE, skip=('-z', '+y'), hint={'-y': 0.02})
    g.box((-1.18, -0.82, 1.25), (1.18, 0.1, 1.5), STONE, skip=('+y',), hint={'+z': 0.04})
    g.box((-1.0, -0.72, 1.5), (1.0, 0.1, 2.6), DSTONE, skip=('-z', '+y'), taper=(0.56, 0.5), shift=(0.0, 0.2), hint=-0.08)
    g.box((-0.56, -0.31, 2.6), (0.56, 0.1, 3.5), DSTONE, skip=('-z', '+y'), hint=-0.12)
    g.qf([(-0.76, -0.02, 0.0), (0.76, -0.02, 0.0), (0.76, -0.02, 1.25), (-0.76, -0.02, 1.25)], (0, -1, 0), INK)
    g.qf([(-0.76, -0.72, 1.25), (0.76, -0.72, 1.25), (0.76, -0.02, 1.25), (-0.76, -0.02, 1.25)], (0, 0, -1), INK)
    g.box((-1.15, -0.98, 0.0), (1.15, 0.1, 0.07), DSTONE, skip=('-z', '+y'), hint={'+z': -0.08})
    g.bar((0.0, -0.3, 1.25), (0.0, -0.3, 0.75), 0.03, 0.03, IRON, caps=True)
    p.info['companion'] = 'shr_campfire about 0.65 m in front of the wall face (lightSource)'
    return p


def cry_cot():
    p = Piece('cry_cot', role='prop', budget=120)
    g = p.main
    for sx in (-0.88, 0.88):
        for sy in (-0.36, 0.36):
            g.box((sx - 0.05, sy - 0.05, 0.0), (sx + 0.05, sy + 0.05, 0.32), DWOOD, skip=('-z', '+z'))
    g.box((-0.96, -0.43, 0.3), (0.96, 0.43, 0.42), WOOD, skip=('-z',))
    g.box((-0.96, -0.47, 0.36), (0.5, 0.47, 0.52), CLOTH1, skip=('-z',), taper=(0.98, 0.9), hint={'+z': 0.05})
    g.box((0.56, -0.3, 0.42), (0.93, 0.3, 0.58), CLOTH2, skip=('-z',), taper=(0.85, 0.85), hint=0.04)
    return p


def cry_sexton_tools():
    """The sexton's tool rack against a wall: spade, pick, mattock, a coil of rope, a lantern, a bucket (Field Repair
    +1 rank in the sexton's cell)."""
    p = Piece('cry_sexton_tools', role='wall-hung', budget=260, bake=HUNG_BAKE, hang=True)
    g = p.main
    for sx in (-0.72, 0.72):
        g.box((sx - 0.05, -0.12, 0.0), (sx + 0.05, -0.02, 1.75), DWOOD, skip=('-z', '+y'), hint={'+z': 0.08})
    for z in (0.62, 1.52):
        g.bar((-0.8, -0.13, z), (0.8, -0.13, z), 0.06, 0.08, DWOOD, caps=True)
    g.bar((-0.5, -0.32, 0.36), (-0.42, -0.2, 1.62), 0.045, 0.045, WOOD, caps=True)
    g.box((-0.62, -0.38, 0.02), (-0.38, -0.3, 0.38), IRON, taper=(1.1, 1.0), hint=0.1)
    g.bar((-0.12, -0.3, 0.05), (-0.06, -0.2, 1.42), 0.045, 0.045, WOOD, caps=True)
    g.bar((-0.42, -0.24, 1.32), (-0.06, -0.24, 1.48), 0.05, 0.05, IRON, caps=True)
    g.bar((-0.06, -0.24, 1.48), (0.3, -0.24, 1.34), 0.05, 0.05, IRON, caps=True)
    g.bar((0.2, -0.3, 0.05), (0.26, -0.18, 1.3), 0.045, 0.045, WOOD, caps=True)
    g.box((0.12, -0.36, 1.18), (0.42, -0.22, 1.32), IRON, hint=0.06)
    with g.at((0.52, -0.16, 1.05), rx=90):
        g.lathe([(0.17, 0.0), (0.17, 0.12)], 8, ROPE, sg=1, cap_top=True, top_slot=ROPE, phase=math.pi / 8)
        g.lathe([(0.07, 0.121)], 8, INK, cap_top=True, phase=math.pi / 8)
    g.box((0.42, -0.3, 0.5), (0.62, -0.1, 0.76), IRON, hint=0.05)
    g.box((0.41, -0.31, 0.76), (0.63, -0.09, 0.86), IRON, taper=(0.3, 0.3))
    g.qf([(0.45, -0.302, 0.53), (0.59, -0.302, 0.53), (0.59, -0.302, 0.73), (0.45, -0.302, 0.73)], (0, -1, 0), CLOTH2, hint=0.3)
    g.bar((0.52, -0.2, 0.86), (0.52, -0.16, 1.52), 0.02, 0.02, IRON, caps=False)
    p.light((0.52, -0.2, 0.64), 'lamp', 'flame')
    g.lathe([(0.15, 0.0, -0.35, -0.42), (0.19, 0.34, -0.35, -0.42)], 8, WOOD, sg=1, cap_top=False)
    g.lathe([(0.17, 0.30, -0.35, -0.42)], 8, INK, cap_top=True)
    return p


def cry_window_shuttered():
    """A small shuttered window (the sexton's cell: it shows the moor on F4), hung with its sill at y ≈ 1.3."""
    p = Piece('cry_window_shuttered', role='wall-hung', budget=110, bake={'ground': None, 'wall': HANG_OFF}, hang=True)
    g = p.main
    g.box((-0.58, -0.2, -0.09), (0.58, 0.1, 0.0), STONE, skip=('+y',), hint={'+z': 0.06})
    for sx in (-1, 1):
        x0, x1 = sorted((sx * 0.42, sx * 0.56))
        g.box((x0, -0.1, 0.0), (x1, 0.1, 1.0), STONE, skip=('+y', '-z', '+z'))
    g.box((-0.62, -0.14, 1.0), (0.62, 0.1, 1.16), STONE, skip=('+y',), hint={'+z': 0.04})
    g.qf([(-0.42, -0.02, 0.0), (0.42, -0.02, 0.0), (0.42, -0.02, 1.0), (-0.42, -0.02, 1.0)], (0, -1, 0), GEM)
    for x in (-0.15, 0.15):
        g.bar((x, -0.06, 0.0), (x, -0.06, 1.0), 0.035, 0.035, IRON, caps=False)
    for sx in (-1, 1):
        with g.at((sx * 0.44, -0.1, 0.04), rz=sx * -68):
            x0, x1 = sorted((0.0, sx * 0.42))
            g.box((x0, -0.035, 0.0), (x1, 0.0, 0.92), DWOOD, hint={'-y': 0.04})
    p.mote((0.0, -0.4, 0.5), 'glow', 'moon')
    return p


def cry_shelf_stone():
    """A low stone shelf the reliquary's chests stand on (chest props at y = 0.5)."""
    p = Piece('cry_shelf_stone', role='prop', budget=60)
    g = p.main
    g.box((-0.95, -0.42, 0.4), (0.95, 0.42, 0.5), STONE, skip=('-z',), hint={'+z': 0.05})
    for sx in (-0.65, 0.65):
        g.box((sx - 0.16, -0.36, 0.0), (sx + 0.16, 0.36, 0.4), DSTONE, skip=('-z', '+z'))
    p.info['top'] = 0.5
    return p


def cry_reliquary_niche():
    """The Bone Reliquary curio: a shrine frame on the wall, a saint's skull on a cushion ringed by finger bones,
    two votive candles."""
    p = Piece('cry_reliquary_niche', role='wall-hung', budget=300, bake=HUNG_BAKE, hang=True)
    g = p.main
    for sx in (-1, 1):
        x0, x1 = sorted((sx * 0.56, sx * 0.78))
        g.box((x0, -0.3, 0.0), (x1, 0.1, 2.25), STONE, skip=('-z', '+y'), hint={'+z': 0.05})
    g.box((-0.82, -0.42, 0.82), (0.82, 0.1, 0.96), STONE, skip=('+y',), hint={'+z': 0.06})
    g.box((-0.56, -0.24, 0.0), (0.56, 0.1, 0.82), DSTONE, skip=('-z', '+y', '-x', '+x'))
    g.qf([(-0.84, -0.32, 2.25), (0.84, -0.32, 2.25), (0.0, -0.32, 2.85)], (0, -1, 0), STONE, hint=0.04)
    g.qf([(-0.84, -0.32, 2.25), (0.0, -0.32, 2.85), (0.0, 0.1, 2.85), (-0.84, 0.1, 2.25)], (-0.6, 0, 0.8), STONE, hint=0.08)
    g.qf([(0.84, -0.32, 2.25), (0.0, -0.32, 2.85), (0.0, 0.1, 2.85), (0.84, 0.1, 2.25)], (0.6, 0, 0.8), STONE, hint=0.08)
    g.qf([(-0.84, -0.32, 2.25), (0.84, -0.32, 2.25), (0.84, 0.1, 2.25), (-0.84, 0.1, 2.25)], (0, 0, -1), DSTONE)
    g.qf([(-0.56, -0.01, 0.96), (0.56, -0.01, 0.96), (0.56, -0.01, 2.0), (0.0, -0.01, 2.22), (-0.56, -0.01, 2.0)], (0, -1, 0), INK)
    g.box((-0.34, -0.3, 0.96), (0.34, -0.02, 1.08), CLOTH1, skip=('-z', '+y'), taper=(0.9, 0.85), hint=0.05)
    with g.at((0.0, -0.18, 1.08)):
        g.skull(w=0.28)
    for k in range(13):
        a = math.radians(12 + k * 156 / 12)
        r0, r1 = 0.36, 0.5
        c = (0.0, 1.24)
        a0 = (c[0] + r0 * math.cos(a), c[1] + r0 * math.sin(a))
        a1 = (c[0] + r1 * math.cos(a), c[1] + r1 * math.sin(a))
        g.bar((a0[0], -0.04, a0[1]), (a1[0], -0.04, a1[1]), 0.04, 0.04, BONE, caps=False, skip=('left', 'bottom'), up=(0, -1, 0))
    candle(g, -0.44, -0.24, 0.96, 0.2, w=0.075, piece=p)
    candle(g, 0.44, -0.24, 0.96, 0.15, w=0.075, piece=p)
    p.mote((0.0, -0.3, 1.45), 'motes', 'corpse')
    p.info['curio'] = 'bone-reliquary'
    return p


def cry_stair_spiral():
    """The Stairs room's centrepiece: a round well (r 1.75 m) with a low parapet open toward the front, a newel
    pillar, wedge treads winding down into the dark. Replaces the 4 m × 4 m of floor it stands in."""
    depth = 2.6
    p = Piece('cry_stair_spiral', role='prop', budget=700,
              bake={'ground': None, 'fade': lambda co: max(0.08, min(1.0, 1.0 + co.z / depth * 0.92))})
    g = p.main
    n = 20
    r_in, r_out = 1.75, 1.95
    gap = set()
    for i in range(n):
        a = 2 * math.pi * (i + 0.5) / n
        if abs(math.atan2(math.sin(a + math.pi / 2), math.cos(a + math.pi / 2))) < math.radians(38):
            gap.add(i)
    ang = [2 * math.pi * i / n for i in range(n + 1)]

    def sq(a):
        c, s = math.cos(a), math.sin(a)
        k = 2.0 / max(abs(c), abs(s))
        return (c * k, s * k)
    corners = [math.radians(a) for a in (45, 135, 225, 315)]
    for i in range(n):
        a0, a1 = ang[i], ang[i + 1]
        p0, p1 = (r_in * math.cos(a0), r_in * math.sin(a0)), (r_in * math.cos(a1), r_in * math.sin(a1))
        q0, q1 = sq(a0), sq(a1)
        mid_corner = [c for c in corners if a0 < c < a1]
        outer = [q0] + [sq(c) for c in mid_corner] + [q1]
        g.qf([(*p0, 0), (*p1, 0)] + [(x, y, 0) for x, y in reversed(outer)], (0, 0, 1), DSTONE)
        am = (a0 + a1) / 2
        g.qf([(*p0, 0), (*p1, 0), (p1[0], p1[1], -depth), (p0[0], p0[1], -depth)], (-math.cos(am), -math.sin(am), 0), DSTONE, hint=-0.2)
        if i not in gap:
            o0, o1 = (r_out * math.cos(a0), r_out * math.sin(a0)), (r_out * math.cos(a1), r_out * math.sin(a1))
            hp = 0.78
            g.qf([(*p0, hp), (*o0, hp), (*o1, hp), (*p1, hp)], (0, 0, 1), STONE, hint=0.08)
            g.qf([(*o0, 0), (*o1, 0), (*o1, hp), (*o0, hp)], (math.cos(am), math.sin(am), 0), STONE)
            g.qf([(*p0, 0), (*p1, 0), (*p1, hp), (*p0, hp)], (-math.cos(am), -math.sin(am), 0), STONE, hint=-0.05)
            if (i - 1) % n in gap:
                g.qf([(*p0, 0), (*o0, 0), (*o0, hp), (*p0, hp)], (math.sin(a0), -math.cos(a0), 0), STONE)
            if (i + 1) % n in gap:
                g.qf([(*p1, 0), (*o1, 0), (*o1, hp), (*p1, hp)], (-math.sin(a1), math.cos(a1), 0), STONE)
    g.qf([(r_in * math.cos(a), r_in * math.sin(a), -depth) for a in ang[:-1]], (0, 0, 1), INK)
    g.lathe([(0.3, -depth), (0.3, 2.9)], 8, STONE, sg=1, cap_top=False, phase=math.pi / 8)
    g.lathe([(0.3, 2.9), (0.42, 3.15), (0.42, 3.3)], 8, STONE, sg=0, cap_top=True, phase=math.pi / 8, hint=0.06)
    steps = 14
    start = -math.pi / 2 + math.radians(30)
    span = math.radians(23)
    for k in range(steps):
        a0 = start - k * span
        a1 = a0 - span
        z = -0.19 * (k + 1)
        pa0, pa1 = (0.3 * math.cos(a0), 0.3 * math.sin(a0)), (0.3 * math.cos(a1), 0.3 * math.sin(a1))
        pb0, pb1 = ((r_in - 0.02) * math.cos(a0), (r_in - 0.02) * math.sin(a0)), ((r_in - 0.02) * math.cos(a1), (r_in - 0.02) * math.sin(a1))
        g.qf([(*pa0, z), (*pb0, z), (*pb1, z), (*pa1, z)], (0, 0, 1), STONE, hint=0.04 - 0.02 * k)
        g.qf([(*pa0, z), (*pb0, z), (*pb0, z + 0.19), (*pa0, z + 0.19)], (math.sin(a0), -math.cos(a0), 0), DSTONE, hint=-0.05)
    g.box((-0.16, -0.5, 1.9), (0.16, -0.28, 1.98), IRON, skip=('+y',))
    candle(g, -0.07, -0.42, 1.98, 0.24, piece=p)
    candle(g, 0.08, -0.38, 1.98, 0.16, piece=p)
    p.mote((0.0, 0.0, -1.2), 'motes', 'corpse')
    p.info['hole'] = [-2, -2, 2, 2]
    p.info['note'] = 'the stair opens toward its front (game +z); the Entry variant on F4 adds the Waystone'
    return p


def cry_cocoon():
    """A wrapped coffin (the spider gallery's cocoons) standing against the wall and leaning back into it."""
    p = Piece('cry_cocoon', role='wall-hung', budget=140, bake=HUNG_BAKE, hang=True)
    g = p.main
    with g.at((0.0, -0.4, 0.0), rx=-10):
        secs = [(0.0, 0.18, 0.13), (0.22, 0.25, 0.17), (1.22, 0.36, 0.23), (1.5, 0.33, 0.21), (1.78, 0.23, 0.16), (1.98, 0.11, 0.09), (2.06, 0.0, 0.0)]
        g.lathe([(ry, z, 0.0, 0.0, (rx / ry) if ry > 0 else 1.0) for z, rx, ry in secs], 8, CLOTH2, sg=1, cap_top=False, cap_bottom=True,
                band_hints=[0.08, -0.06, 0.1, -0.08, 0.06, 0.0])
        g.bar((0.14, -0.2, 0.95), (0.32, -0.27, 0.82), 0.045, 0.045, BONE, caps=True)
        g.bar((0.32, -0.27, 0.82), (0.38, -0.3, 0.66), 0.035, 0.035, BONE, caps=True)
    g.qf([(-0.08, -0.05, 1.95), (0.08, -0.05, 1.95), (0.04, 0.0, 2.95), (-0.04, 0.0, 2.95)], (0, -1, 0), CLOTH2)
    g.qf([(0.25, -0.2, 1.25), (0.32, -0.2, 1.35), (0.92, 0.0, 1.95), (0.86, 0.0, 1.87)], (0, -1, 0), CLOTH2)
    return p


def cry_bone_pile():
    """A heap of bones (the Warden's arena: Footmen rise from live piles; Holy or Fire burns one out)."""
    p = Piece('cry_bone_pile', role='prop', budget=180)
    g = p.main
    g.lathe([(0.8, 0.0), (0.62, 0.16), (0.32, 0.36), (0.0, 0.46)], 7, BONE, sg=1, cap_top=False, phase=0.4, hint=-0.06)
    for (x, y, z, rz, rx) in ((-0.25, -0.35, 0.26, 20, -12), (0.3, -0.28, 0.2, -25, -6), (0.02, 0.05, 0.42, 5, -20)):
        with g.at((x, y, z), rz=rz, rx=rx):
            g.skull(w=0.26, sides=False)
    for (a, b) in (((-0.7, -0.3, 0.08), (0.1, -0.62, 0.12)), ((0.2, -0.6, 0.06), (0.75, -0.1, 0.1)), ((-0.5, 0.25, 0.3), (0.3, 0.35, 0.36)),
                   ((-0.65, -0.05, 0.18), (-0.2, -0.55, 0.32)), ((0.45, 0.1, 0.25), (0.55, -0.45, 0.15))):
        g.bar(a, b, 0.075, 0.075, BONE, caps=True, hint=0.05)
    p.mote((0.0, 0.0, 0.5), 'motes', 'corpse')
    return p


def cry_merchant_barrow():
    """Dunmore Quist's barrow in the Crypts (07 §2.7): a one-wheeled barrow of wares with an awning and his lamp
    (+15 light while the party is there)."""
    p = Piece('cry_merchant_barrow', role='prop', budget=700)
    g = p.main
    x0, x1, y0, y1, zb, zt = -0.9, 0.7, -0.45, 0.45, 0.55, 0.95
    g.box((x0, y0, zb), (x1, y1, zt), WOOD, skip=('+z',), hint={'-y': 0.02})
    t = 0.05
    g.qf([(x0 + t, y0 + t, zb + 0.05), (x1 - t, y0 + t, zb + 0.05), (x1 - t, y1 - t, zb + 0.05), (x0 + t, y1 - t, zb + 0.05)], (0, 0, 1), DWOOD)
    g.qf([(x0 + t, y0 + t, zb + 0.05), (x1 - t, y0 + t, zb + 0.05), (x1 - t, y0 + t, zt), (x0 + t, y0 + t, zt)], (0, 1, 0), DWOOD)
    g.qf([(x0 + t, y1 - t, zb + 0.05), (x1 - t, y1 - t, zb + 0.05), (x1 - t, y1 - t, zt), (x0 + t, y1 - t, zt)], (0, -1, 0), DWOOD)
    g.qf([(x0 + t, y0 + t, zb + 0.05), (x0 + t, y1 - t, zb + 0.05), (x0 + t, y1 - t, zt), (x0 + t, y0 + t, zt)], (1, 0, 0), DWOOD)
    g.qf([(x1 - t, y0 + t, zb + 0.05), (x1 - t, y1 - t, zb + 0.05), (x1 - t, y1 - t, zt), (x1 - t, y0 + t, zt)], (-1, 0, 0), DWOOD)
    g.qf([(x0, y0, zt), (x1, y0, zt), (x1 - t, y0 + t, zt), (x0 + t, y0 + t, zt)], (0, 0, 1), WOOD, hint=0.06)
    g.qf([(x1, y0, zt), (x1, y1, zt), (x1 - t, y1 - t, zt), (x1 - t, y0 + t, zt)], (0, 0, 1), WOOD, hint=0.06)
    g.qf([(x1, y1, zt), (x0, y1, zt), (x0 + t, y1 - t, zt), (x1 - t, y1 - t, zt)], (0, 0, 1), WOOD, hint=0.06)
    g.qf([(x0, y1, zt), (x0, y0, zt), (x0 + t, y0 + t, zt), (x0 + t, y1 - t, zt)], (0, 0, 1), WOOD, hint=0.06)
    wx, wr = 1.0, 0.42
    for yy, want in ((-0.08, (0, -1, 0)), (0.08, (0, 1, 0))):
        for k in range(12):
            a0, a1 = 2 * math.pi * k / 12, 2 * math.pi * (k + 1) / 12
            o0 = (wx + wr * math.cos(a0), wr + wr * math.sin(a0))
            o1 = (wx + wr * math.cos(a1), wr + wr * math.sin(a1))
            i0 = (wx + (wr - 0.08) * math.cos(a0), wr + (wr - 0.08) * math.sin(a0))
            i1 = (wx + (wr - 0.08) * math.cos(a1), wr + (wr - 0.08) * math.sin(a1))
            g.qf([(o0[0], yy, o0[1]), (o1[0], yy, o1[1]), (i1[0], yy, i1[1]), (i0[0], yy, i0[1])], want, DWOOD)
    for k in range(12):
        a0, a1 = 2 * math.pi * k / 12, 2 * math.pi * (k + 1) / 12
        o0 = (wx + wr * math.cos(a0), wr + wr * math.sin(a0))
        o1 = (wx + wr * math.cos(a1), wr + wr * math.sin(a1))
        am = (a0 + a1) / 2
        g.qf([(o0[0], -0.08, o0[1]), (o1[0], -0.08, o1[1]), (o1[0], 0.08, o1[1]), (o0[0], 0.08, o0[1])], (math.cos(am), 0, math.sin(am)), IRON)
    for k in range(6):
        a = math.pi * k / 3
        g.bar((wx + 0.06 * math.cos(a), 0.0, wr + 0.06 * math.sin(a)), (wx + (wr - 0.07) * math.cos(a), 0.0, wr + (wr - 0.07) * math.sin(a)), 0.04, 0.04, WOOD, caps=False)
    with g.at((wx, 0.0, wr), rx=90):
        g.lathe([(0.08, -0.12), (0.08, 0.12)], 6, IRON, sg=1, cap_top=True, cap_bottom=True)
    for yy in (-0.36, 0.36):
        g.bar((-0.62, yy, zb), (-0.66, yy, 0.0), 0.06, 0.06, DWOOD, caps=True)
        g.bar((x0, yy, zb + 0.15), (-1.65, yy * 1.1, 0.72), 0.06, 0.06, DWOOD, caps=True)
    for (sx, sy, s) in ((-0.5, -0.12, 1.0), (-0.12, 0.12, 0.85)):
        g.lathe([(0.2 * s, zt - 0.3, sx, sy), (0.24 * s, zt - 0.05, sx, sy), (0.16 * s, zt + 0.22 * s, sx, sy), (0.07 * s, zt + 0.32 * s, sx, sy)], 6, ROPE if s < 1 else CLOTH1, sg=2, cap_top=True)
    g.box((0.18, -0.3, zt - 0.12), (0.58, 0.1, zt + 0.22), WOOD, skip=('-z',), hint=0.04)
    g.box((0.24, 0.16, zt - 0.05), (0.56, 0.34, zt + 0.08), CLOTH2, skip=('-z',))
    g.tube([(-0.85, 0.28, zt + 0.05), (-0.25, 0.32, zt + 0.08)], 0.07, 6, CLOTH1, sg=3, caps=True)
    for yy in (-0.42, 0.42):
        g.bar((-0.82, yy, zt), (-0.82, yy, 1.85), 0.04, 0.04, DWOOD, caps=True)
    g.box((-0.95, -0.55, 1.85), (0.55, 0.55, 1.9), CLOTH1, hint={'+z': 0.05})
    g.bar((x1 - 0.05, y0 + 0.05, zt), (x1 - 0.05, y0 + 0.05, 2.15), 0.045, 0.045, DWOOD, caps=True)
    g.bar((x1 - 0.05, y0 + 0.05, 2.12), (x1 + 0.32, y0 + 0.05, 2.12), 0.04, 0.04, DWOOD, caps=True)
    lx, ly, lz = x1 + 0.3, y0 + 0.05, 1.9
    g.box((lx - 0.09, ly - 0.09, lz - 0.12), (lx + 0.09, ly + 0.09, lz + 0.1), BRASS, hint=0.06)
    g.box((lx - 0.1, ly - 0.1, lz + 0.1), (lx + 0.1, ly + 0.1, lz + 0.2), BRASS, taper=(0.3, 0.3))
    g.qf([(lx - 0.07, ly - 0.092, lz - 0.08), (lx + 0.07, ly - 0.092, lz - 0.08), (lx + 0.07, ly - 0.092, lz + 0.07), (lx - 0.07, ly - 0.092, lz + 0.07)], (0, -1, 0), CLOTH2, hint=0.3)
    p.light((lx, ly, lz), 'lamp', 'flame')
    p.info['merchant'] = 'Dunmore Quist\x27s barrow: parks in a Crypts merchant room (the crossing: by one of the sarcophagi)'
    return p


def cry_embalmer_table():
    """The Embalmer's Table curio: a stone table with a channel, a drawer, hooks on a rail and jars."""
    p = Piece('cry_embalmer_table', role='prop', budget=320)
    g = p.main
    g.box((-1.0, -0.45, 0.78), (1.0, 0.45, 0.9), STONE, skip=('-z', '+z'))
    g.qf([(-1.0, -0.45, 0.9), (1.0, -0.45, 0.9), (1.0, -0.08, 0.9), (-1.0, -0.08, 0.9)], (0, 0, 1), STONE, hint=0.06)
    g.qf([(-1.0, 0.08, 0.9), (1.0, 0.08, 0.9), (1.0, 0.45, 0.9), (-1.0, 0.45, 0.9)], (0, 0, 1), STONE, hint=0.06)
    g.qf([(-1.0, -0.08, 0.87), (1.0, -0.08, 0.87), (1.0, 0.08, 0.87), (-1.0, 0.08, 0.87)], (0, 0, 1), INK)
    g.qf([(-1.0, -0.08, 0.87), (1.0, -0.08, 0.87), (1.0, -0.08, 0.9), (-1.0, -0.08, 0.9)], (0, 1, 0), DSTONE)
    g.qf([(-1.0, 0.08, 0.87), (1.0, 0.08, 0.87), (1.0, 0.08, 0.9), (-1.0, 0.08, 0.9)], (0, -1, 0), DSTONE)
    g.box((-0.9, -0.4, 0.6), (0.9, 0.4, 0.78), DSTONE, skip=('+z',))
    g.box((-0.3, -0.43, 0.63), (0.3, -0.4, 0.75), WOOD, skip=('+y',))
    g.box((-0.05, -0.47, 0.67), (0.05, -0.43, 0.71), BRASS)
    for sx in (-0.7, 0.7):
        g.box((sx - 0.18, -0.3, 0.0), (sx + 0.18, 0.3, 0.6), DSTONE, skip=('-z', '+z'))
    for sx in (-0.95, 0.95):
        g.bar((sx, 0.42, 0.9), (sx, 0.42, 1.7), 0.05, 0.05, IRON, caps=True)
    g.bar((-0.97, 0.42, 1.68), (0.97, 0.42, 1.68), 0.05, 0.05, IRON, caps=True)
    for hx in (-0.45, 0.0, 0.45):
        g.bar((hx, 0.42, 1.66), (hx, 0.42, 1.42), 0.03, 0.03, IRON, caps=False)
        g.bar((hx, 0.42, 1.42), (hx, 0.3, 1.36), 0.03, 0.03, IRON, caps=True)
    for (jx, jy, s, slot) in ((-0.62, 0.25, 1.0, MOSS), (-0.38, 0.28, 0.8, BRASS), (0.66, 0.22, 0.9, CLOTH2)):
        g.lathe([(0.08 * s, 0.9, jx, jy), (0.11 * s, 0.95 + 0.05 * s, jx, jy), (0.06 * s, 0.9 + 0.22 * s, jx, jy)], 6, slot, sg=1, cap_top=True, top_slot=INK)
    p.info['curio'] = 'embalmers-table'
    return p


def cry_ledger_lectern():
    """The Warden's Ledger curio: a stone book open on a stone lectern, one candle."""
    p = Piece('cry_ledger_lectern', role='prop', budget=200)
    g = p.main
    g.lathe([(0.4, 0.0), (0.4, 0.12), (0.28, 0.17)], 8, DSTONE, sg=0, cap_top=True, phase=math.pi / 8)
    g.lathe([(0.15, 0.17), (0.13, 0.95)], 8, STONE, sg=1, cap_top=False, phase=math.pi / 8)
    sec = [(-0.3, 0.98), (0.3, 1.2), (0.3, 1.28), (-0.32, 1.06)]
    for i in range(len(sec)):
        a, b = sec[i], sec[(i + 1) % len(sec)]
        nrm = Vector((0, b[1] - a[1], -(b[0] - a[0])))
        g.qf([(-0.42, a[0], a[1]), (0.42, a[0], a[1]), (0.42, b[0], b[1]), (-0.42, b[0], b[1])], tuple(-nrm), STONE)
    g.qf([(-0.42, y, z) for y, z in sec], (-1, 0, 0), STONE)
    g.qf([(0.42, y, z) for y, z in sec], (1, 0, 0), STONE)
    g.box((-0.13, -0.08, 0.92), (0.13, 0.1, 0.98), STONE, skip=('-z', '+z'))
    slope = math.degrees(math.atan2(0.22, 0.6))
    with g.at((0.0, 0.0, 1.17), rx=slope):
        for sx in (-1, 1):
            x0, x1 = sorted((sx * 0.02, sx * 0.34))
            g.box((x0, -0.22, 0.0), (x1, 0.22, 0.06), BONE, skip=('-z',), hint={'+z': 0.08})
    candle(g, 0.36, 0.2, 1.24, 0.18, w=0.07, piece=p)
    p.info['curio'] = 'the-wardens-ledger'
    return p


PIECES = [
    # 07 §2.2's table, in its order
    cry_floor_slab, cry_floor_slab_open, cry_floor_bonegrate, cry_floor_mist,
    cry_wall_niche_2m, cry_wall_plain_2m, cry_wall_bone_2m, cry_wall_corner_in,
    cry_door_arch, cry_door_iron, cry_door_portcullis, cry_door_secret,
    cry_pillar_cluster, cry_vault_rib,
    cry_sarcophagus, cry_coffin_wood, cry_urn_row, cry_candle_ring, cry_statue_weeping, cry_bell_grave,
    cry_web_sheet, cry_bier_stone,
    # the cut-away shell (kit_lib asks every zone for them)
    cry_wall_cut_2m, cry_door_arch_cut, cry_wall_corner_cut,
    # extras the templates and the arena name
    cry_vault_rib_half, cry_candle_bracket, cry_candle_crown, cry_altar_step, cry_hearth_niche, cry_cot,
    cry_sexton_tools, cry_window_shuttered, cry_shelf_stone, cry_reliquary_niche, cry_stair_spiral, cry_cocoon,
    cry_bone_pile, cry_merchant_barrow, cry_embalmer_table, cry_ledger_lectern,
]

IN_07 = 22   # the first 22 builders are 07 §2.2's table

SHELL = {'floor': 'cry_floor_slab', 'wall': 'cry_wall_plain_2m', 'doorway': 'cry_door_arch', 'corner': 'cry_wall_corner_in',
         'wallCut': 'cry_wall_cut_2m', 'doorwayCut': 'cry_door_arch_cut', 'cornerCut': 'cry_wall_corner_cut'}

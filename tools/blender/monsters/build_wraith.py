"""build_wraith.py — the wraith base (06 §3.5): the Wraith of the Crypts.

Run:  blender -b -P tools/blender/monsters/build_wraith.py -- [--quick] [--no-renders]

A hooded shape of torn grave-cloth with no legs, 2.0 m floating, two lit eyes in a black void (06: grave-cloth grey /
black void / blue light). Built as cloth that hugs and gathers (art/LOG.md): a hood whose rows gather round an arched
face opening, rolled in to a rim, the void behind it; a mantle over the shoulders; a robe that narrows at the waist and
trails back into twelve tatters; bell sleeves with tattered cuffs and long spectral claws. Every open edge has an inside
(the void colour), because the client draws front faces only. Rig: `Root` (floor; its Y-location is the hover) →
`Spine_01..03` → `Head`; `Arm_{L,R}_01/02` + `Hand_{L,R}`; six hem chains `Hem_<k>_01/02` round the robe (local Z
outward, so +X flares a tatter). Clips (skeletal): Idle (hover), Move (glide), Attack1 (Wail), Attack2 (Chill Touch),
Hit, Death (collapse and sink). Slots: 0 grave-cloth, 1 void, 2 spectral light (claws), 11 the eyes (emissive).
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import spirit_lib as S  # noqa: E402
from spirit_lib import MB, smoothstep  # noqa: E402

import common  # noqa: E402
from common import BUILD, RENDERS, log  # noqa: E402

A = S.args()
QUICK = bool(A.get('quick'))
RENDER = not A.get('no_renders')
BASE = 'wraith'
OUT = os.path.join(RENDERS, 'monsters', BASE)

VARIANTS = {
    'wraith': dict(scale=1.0, parts=[], shapes={}, palette=['#707a87', '#0a0c16', '#a3cff2'], slots={'11': '#78dcff'},
                   clipSpeed=1.0),
}

NCOL = 24
HEMS = 6
HEM_ANG = [-90 + k * 60 for k in range(HEMS)]
HEAD_C = Vector((0.0, -0.015, 1.79))
EYE_Z = 1.785
HEM_TOP = 0.95
HEM_Z = (0.95, 0.62, 0.32)           # the hem chains' joints


def cy(z):
    """The robe trails back below the waist."""
    return 0.15 * smoothstep(1.05, 0.3, z) ** 1.5


PROFILE = [(1.61, 0.115, 0.075), (1.585, 0.25, 0.15), (1.46, 0.25, 0.165), (1.26, 0.21, 0.16), (1.06, 0.17, 0.15),
           (0.90, 0.175, 0.165), (0.74, 0.19, 0.18)]
HEM_BASE = 0.74                      # the robe ends here; tatters hang below it (their tips 0.29–0.47 m off the floor)


def prof_at(z):
    for (z0, a0, b0), (z1, a1, b1) in zip(PROFILE, PROFILE[1:]):
        if z1 <= z <= z0:
            t = (z0 - z) / (z0 - z1)
            return a0 + (a1 - a0) * t, b0 + (b1 - b0) * t
    return PROFILE[-1][1], PROFILE[-1][2]


def tatter_len(i):
    """Column i's tatter: even columns are points of varying length, odd ones the notches between."""
    if i % 2 == 0:
        return [0.40, 0.30, 0.44, 0.34, 0.27, 0.42, 0.31, 0.45, 0.28, 0.38, 0.33, 0.43][(i // 2) % 12]
    return [0.05, 0.09, 0.04, 0.08][(i // 2) % 4]


# ================================================================ weights
def spine_w(z):
    return S.chain_weights(z, [0.0, 0.80, 1.15, 1.45, 1.66, 2.1], ['Root', 'Spine_01', 'Spine_02', 'Spine_03', 'Head'],
                           blend=0.5)


def hem_w(th_deg, z):
    """Below the waist: the two hem chains either side of this angle, 01 above 0.55 m, 02 below."""
    a = (th_deg + 90) % 360
    k0 = int(a // 60) % HEMS
    k1 = (k0 + 1) % HEMS
    f = (a - k0 * 60) / 60
    seg = smoothstep(HEM_Z[1] + 0.06, HEM_Z[1] - 0.06, z)          # 0 → _01, 1 → _02
    w = {}
    for k, wk in ((k0, 1 - f), (k1, f)):
        w['Hem_%d_01' % k] = w.get('Hem_%d_01' % k, 0) + wk * (1 - seg)
        w['Hem_%d_02' % k] = w.get('Hem_%d_02' % k, 0) + wk * seg
    blend = smoothstep(HEM_TOP, HEM_TOP - 0.16, z)     # 0 → the spine, 1 → the hems
    out = {k: v * blend for k, v in w.items()}
    for k, v in spine_w(z).items():
        out[k] = out.get(k, 0) + v * (1 - blend)
    return out


def robe_w(th_deg, z):
    return hem_w(th_deg, z) if z < HEM_TOP else spine_w(z)


# ================================================================ the robe
def build_robe(mb):
    zs = [1.61, 1.585, 1.50, 1.40, 1.28, 1.16, 1.04, 0.93, 0.83, HEM_BASE]
    rows = []
    for z in zs:
        rx, ry = prof_at(z)
        fold = 0.06 * smoothstep(1.2, HEM_BASE, z)
        row = []
        for i in range(NCOL):
            th = math.radians(-90 + i * 360 / NCOL)
            k = 1 + fold * math.sin(6 * th + 0.8) + 0.02 * math.sin(11 * th)
            p = (rx * k * math.cos(th), ry * k * math.sin(th) + cy(z), z)
            row.append(mb.v(p, w=robe_w(-90 + i * 360 / NCOL, z), z=z))
        rows.append(row)
    # tatters: each column runs down its own length; the rows are fractions of it
    tat = []
    for f in (0.33, 0.66, 1.0):
        row = []
        for i in range(NCOL):
            L = tatter_len(i)
            z = HEM_BASE - f * L
            rx, ry = prof_at(HEM_BASE)
            fl = 1 + 0.14 * f * (1 if i % 2 == 0 else 0.4)
            th = math.radians(-90 + i * 360 / NCOL)
            k = 1 + 0.06 * math.sin(6 * th + 0.8) + 0.02 * math.sin(11 * th)
            p = (rx * k * fl * math.cos(th), ry * k * fl * math.sin(th) + cy(z) + 0.06 * f, z)
            row.append(mb.v(p, w=robe_w(-90 + i * 360 / NCOL, z), z=z))
        tat.append(row)
    allrows = rows + tat
    mb.begin('robe')
    for k in range(len(allrows) - 1):
        mb.bridge(allrows[k + 1], allrows[k], 0)
    top = mb.v((0, 0.01, 1.63), w=spine_w(1.63))    # the neck stays behind the void dish (round 3: it poked through at the chin)
    mb.fan(rows[0], top, 1)            # void colour: any gap inside the hood shows dark
    robe = mb.end()
    mb.orient(robe, lambda c: Vector((0, cy(c.z), c.z)))
    # the inside of the robe (the void), from the hem up to 0.95 m, closed by a ceiling
    inner = []
    for row in allrows[7:]:
        irow = []
        for idx in row:
            p = mb.co[idx]
            ctr = Vector((0, cy(p.z), p.z))
            d = (p - ctr)
            d.z = 0
            q = p - d.normalized() * 0.022 + Vector((0, 0, 0.012))
            irow.append(mb.v(q, w=dict(mb.data[idx]['w']), z=p.z))
        inner.append(irow)
    mb.begin('robe_inner')
    for k in range(len(inner) - 1):
        mb.bridge(inner[k], inner[k + 1], 1)
    ceil = mb.v((0, cy(0.95), 0.93), w=robe_w(0, 0.93))
    mb.fan(inner[0], ceil, 1)
    # join the hem: outer last row → inner last row
    mb.bridge(allrows[-1], inner[-1], 1)
    inn = mb.end()
    mb.orient(inn, lambda c: Vector((c.x * 3, (c.y - cy(c.z)) * 3 + cy(c.z), c.z + 0.6)))


# ================================================================ the hood
PHI = [-52, -40, -28, -16, -4, 8, 20, 32, 44, 58, 72, 86]
PHI_LO, PHI_HI = -34, 40


def opening(phi):
    if phi <= PHI_LO or phi >= PHI_HI:
        return 0.0
    t = (phi - PHI_LO) / (PHI_HI - PHI_LO)
    return 50.0 * math.sin(math.pi * t ** 0.85) ** 0.45


def hood_point(phi, th):
    """The hood's outer surface at elevation phi / azimuth th (degrees) round the head centre."""
    ph, t = math.radians(phi), math.radians(th)
    rx, ry, rz = 0.175, 0.200, 0.190
    if phi < -14:                       # the mantle flares out over the shoulders
        k = smoothstep(-14, -52, phi)
        rx += 0.16 * k
        ry += 0.07 * k
    p = Vector((rx * math.cos(ph) * math.cos(t), ry * math.cos(ph) * math.sin(t), rz * math.sin(ph)))
    if phi < -14:
        p.z -= 0.10 * smoothstep(-14, -52, phi)
    if phi > 30:                        # a slouched cowl: the crown falls back, no point
        s = ((phi - 30) / 56) ** 1.6
        p += Vector((0, 0.17 * s, -0.02 * s))
    # gathers: soft vertical folds on the mantle and the back
    fold = 0.012 * smoothstep(0, -52, phi) * math.sin(5 * t)
    p += Vector((math.cos(t), math.sin(t), 0)) * fold
    return HEAD_C + p


def hood_w(phi, z):
    k = smoothstep(-18, -50, phi)
    w = {'Head': 1 - k}
    for nm, x in spine_w(min(z, 1.60)).items():
        w[nm] = w.get(nm, 0) + x * k
    return w


def build_hood(mb):
    rows = []
    for phi in PHI:
        w_open = opening(phi)
        row = []
        if w_open <= 0:
            for i in range(NCOL):
                th = -90 + i * 360 / NCOL
                p = hood_point(phi, th)
                row.append(mb.v(p, w=hood_w(phi, p.z)))
            row.append(row[0])
        else:
            for i in range(NCOL + 1):
                th = -90 + w_open + (360 - 2 * w_open) * i / NCOL
                p = hood_point(phi, th)
                row.append(mb.v(p, w=hood_w(phi, p.z)))
        rows.append(row)
    mb.begin('hood')
    for k in range(len(rows) - 1):
        mb.bridge(rows[k], rows[k + 1], 0, closed=False)
    crown = mb.v(hood_point(90, 90), w={'Head': 1.0})
    mb.fan(rows[-1][:-1], crown, 0)
    hood = mb.end()
    mb.orient(hood, HEAD_C + Vector((0, 0.02, -0.04)))
    # the mantle's underside (the void), so its lower edge is closed seen from below
    under = []
    for idx in rows[0][:-1]:
        p = mb.co[idx]
        q = HEAD_C + (p - HEAD_C) * 0.86
        q.z = p.z + 0.035
        under.append(mb.v(q, w=dict(mb.data[idx]['w'])))
    mb.begin('mantle_under')
    mb.bridge(rows[0][:-1], under, 1)
    neck = mb.v((0, 0.02, 1.62), w=hood_w(-52, 1.62))
    mb.fan(under, neck, 1)
    mu = mb.end()
    mb.orient(mu, HEAD_C + Vector((0, 0, 0.3)))
    # the face opening: its boundary loop, a rim rolled inward, the void dish behind
    open_rows = [k for k, phi in enumerate(PHI) if opening(phi) > 0]
    k_lo, k_hi = open_rows[0] - 1, open_rows[-1] + 1
    loop = [rows[k_lo][0]]
    loop += [rows[k][0] for k in open_rows]
    loop += [rows[k_hi][0]]
    loop += [rows[k][NCOL] for k in reversed(open_rows)]
    rim, deep = [], []
    for idx in loop:
        p = mb.co[idx]
        d = (HEAD_C + Vector((0, 0.03, 0)) - p)
        q = p + d.normalized() * 0.04 + Vector((0, 0.03, 0))
        rim.append(mb.v(q, w={'Head': 1.0}))
        r2 = p + d * 0.55 + Vector((0, 0.04, 0))
        deep.append(mb.v(r2, w={'Head': 1.0}))
    mb.begin('rim')
    # the rolled edge shows grey at the sides and brow; below the eyes it is void (round 2's grey wedge at the chin)
    mb.bridge(loop, rim, lambda i: 1 if max(mb.co[loop[i]].z, mb.co[loop[(i + 1) % len(loop)]].z) < EYE_Z - 0.04 else 0)
    rimf = mb.end()
    mb.orient(rimf, HEAD_C + Vector((0, 0.30, 0)))
    mb.begin('void')
    mb.bridge(rim, deep, 1)
    back = mb.v(HEAD_C + Vector((0, 0.07, -0.01)), w={'Head': 1.0})
    mb.fan(deep, back, 1)
    vf = mb.end()
    mb.orient(vf, HEAD_C + Vector((0, 0.40, 0)))
    # the eyes: slanted almonds floating in the void
    for side in (1, -1):
        eye(mb, Vector((side * 0.056, HEAD_C.y - 0.105, EYE_Z)), side)


def eye(mb, c, side):
    w = {'Head': 1.0}
    hw, hh, hd = 0.043, 0.019, 0.012
    slant = math.radians(14) * side        # outer corner up
    pts = []
    for ax, az in ((-1, 0), (0, 1), (1, 0), (0, -1)):
        x = ax * hw
        z = az * hh
        xr = x * math.cos(slant) - z * math.sin(slant)
        zr = x * math.sin(slant) + z * math.cos(slant)
        pts.append(mb.v(c + Vector((xr, 0, zr)), w=w))
    front = mb.v(c + Vector((0, -hd, 0)), w=w)
    backv = mb.v(c + Vector((0, hd * 0.5, 0)), w=w)
    mb.begin('eye')
    mb.fan(pts, front, 11)
    mb.fan(pts, backv, 11, flip=True)
    e = mb.end()
    mb.orient(e, c)


# ================================================================ sleeves and claws
ARM = {  # shoulder, elbow, wrist, fingertips (left side; the right mirrors x)
    'sh': Vector((0.215, 0.0, 1.565)), 'el': Vector((0.315, -0.045, 1.215)), 'wr': Vector((0.355, -0.11, 0.90)),
    'tip': Vector((0.36, -0.15, 0.70))}


def arm_pts(side):
    return {k: Vector((v.x * side, v.y, v.z)) for k, v in ARM.items()}


def arm_w(side, t):
    """t: 0 shoulder … 1 elbow … 2 wrist … 3 fingertips."""
    s = 'L' if side > 0 else 'R'
    return S.chain_weights(t, [-0.4, 0.0, 1.0, 2.0, 3.0], ['Spine_03', 'Arm_%s_01' % s, 'Arm_%s_02' % s, 'Hand_%s' % s],
                           blend=0.45)


def build_sleeve(mb, side):
    P = arm_pts(side)
    stations = [(-0.15, 0.072), (0.0, 0.078), (0.4, 0.08), (0.75, 0.082), (1.0, 0.085), (1.3, 0.09), (1.6, 0.105),
                (1.85, 0.125), (2.0, 0.14)]
    n = 10
    rings = []
    for t, r in stations:
        if t <= 1:
            c = P['sh'].lerp(P['el'], max(0.0, t)) + (P['sh'] - P['el']).normalized() * (0.15 * max(0.0, -t) / 0.15 * 0.08 if t < 0 else 0)
            tan = (P['el'] - P['sh']).normalized()
        else:
            c = P['el'].lerp(P['wr'], t - 1)
            tan = (P['wr'] - P['el']).normalized()
        if t < 0:
            c = P['sh'] + (P['sh'] - P['el']).normalized() * 0.06 + Vector((-side * 0.06, 0, 0))
        u, v = S.frame_from(tan, Vector((0, -1, 0)))
        ring = []
        for i in range(n):
            th = 2 * math.pi * i / n
            rr = r * (1 + (0.12 * (1 if i % 2 == 0 else -0.4) if t >= 2.0 else 0))
            p = c + u * (rr * math.cos(th)) + v * (rr * math.sin(th))
            if t >= 2.0:
                p += tan * (0.06 if i % 2 == 0 else -0.015) * [1.0, 0.7, 1.2, 0.8, 1.1][i % 5]
            ring.append(mb.v(p, w=arm_w(side, t)))
        rings.append((ring, c, tan, r))
    mb.begin('sleeve')
    for k in range(len(rings) - 1):
        mb.bridge(rings[k][0], rings[k + 1][0], 0)
    sl = mb.end()
    mb.orient(sl, lambda c: nearest_on(c, P['sh'], P['el'], P['wr']))
    # the cuff's inside (void), up into the sleeve, capped
    cuff, cc, ctan, cr = rings[-1]
    inner = []
    deep = []
    for idx in cuff:
        p = mb.co[idx]
        q = p + (cc - p).normalized() * 0.018
        inner.append(mb.v(q, w=arm_w(side, 1.95)))
        deep.append(mb.v(q - ctan * 0.12 + (cc - q) * 0.15, w=arm_w(side, 1.75)))
    mb.begin('cuff_inner')
    mb.bridge(cuff, inner, 1)
    mb.bridge(inner, deep, 1)
    cap = mb.v(cc - ctan * 0.14, w=arm_w(side, 1.7))
    mb.fan(deep, cap, 1)
    ci = mb.end()
    mb.orient(ci, cc + ctan * 0.3)
    build_claw(mb, side, P)


def nearest_on(c, a, b, d):
    best = None
    for p, q in ((a, b), (b, d)):
        ab = q - p
        t = max(0.0, min(1.0, (c - p).dot(ab) / ab.length_squared))
        x = p + ab * t
        if best is None or (x - c).length < (best - c).length:
            best = x
    return best


def build_claw(mb, side, P):
    """A long spectral hand: a slim palm and four hooked fingers (slot 2)."""
    wr = P['wr']
    down = (P['tip'] - P['wr']).normalized()
    fwd = Vector((0, -1, 0))
    lat = down.cross(fwd).normalized() * side
    palm_c = wr + down * 0.06
    w_palm = arm_w(side, 2.3)
    # palm: a flattened box
    corners = []
    for a in (-1, 1):
        for b in (-1, 1):
            for c in (-1, 1):
                corners.append(mb.v(palm_c + down * (0.045 * a) + lat * (0.032 * b) + fwd * (0.012 * c), w=w_palm))
    # box faces (indices: a b c bits)
    q = corners
    mb.begin('palm')
    for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        mb.f([q[i] for i in f], 2)
    pf = mb.end()
    mb.orient(pf, palm_c)
    for j, (off, L) in enumerate(((-0.024, 0.13), (-0.008, 0.155), (0.009, 0.145), (0.024, 0.115))):
        base = palm_c + down * 0.04 + lat * off
        pts = [base]
        d = down.copy()
        seg = L / 3
        for s in range(3):
            # each joint hooks forward (a claw)
            d = (d + fwd * 0.38).normalized()
            pts.append(pts[-1] + d * seg)
        rings = []
        for s, p in enumerate(pts[:-1]):
            rad = 0.0085 * (1 - 0.25 * s)
            t = (pts[s + 1] - p).normalized()
            u, v = S.frame_from(t, fwd)
            ring = [mb.v(p + u * (rad * math.cos(a)) + v * (rad * math.sin(a)), w=arm_w(side, 2.5 + 0.17 * s))
                    for a in (0.0, math.pi / 2, math.pi, 3 * math.pi / 2)]
            rings.append(ring)
        tip = mb.v(pts[-1], w=arm_w(side, 3.0))
        mb.begin('finger')
        for s in range(len(rings) - 1):
            mb.bridge(rings[s], rings[s + 1], 2)
        mb.fan(rings[-1], tip, 2)
        fi = mb.end()
        mb.orient(fi, lambda c, pts=pts: nearest_poly(c, pts))
    # thumb
    base = palm_c + lat * (-0.03) + fwd * 0.01
    pts = [base, base + (down * 0.5 + fwd * 0.6 - lat * 0.4).normalized() * 0.06,
           base + (down * 0.9 + fwd * 0.7 - lat * 0.3).normalized() * 0.10]
    rings = []
    for s, p in enumerate(pts[:-1]):
        t = (pts[s + 1] - p).normalized()
        u, v = S.frame_from(t, fwd)
        rings.append([mb.v(p + u * (0.008 * math.cos(a)) + v * (0.008 * math.sin(a)), w=arm_w(side, 2.4))
                      for a in (0.0, math.pi / 2, math.pi, 3 * math.pi / 2)])
    tip = mb.v(pts[-1], w=arm_w(side, 2.6))
    mb.begin('thumb')
    mb.bridge(rings[0], rings[1], 2)
    mb.fan(rings[1], tip, 2)
    th = mb.end()
    mb.orient(th, lambda c, pts=pts: nearest_poly(c, pts))


def nearest_poly(c, pts):
    best = None
    for p, q in zip(pts, pts[1:]):
        ab = q - p
        t = max(0.0, min(1.0, (c - p).dot(ab) / max(1e-9, ab.length_squared)))
        x = p + ab * t
        if best is None or (x - c).length < (best - c).length:
            best = x
    return best


# ================================================================ rig
def build_rig(col):
    F = (0, -1, 0)
    bones = [('Root', (0, 0, 0), (0, 0, 0.25), None, F),
             ('Spine_01', (0, cy(0.80), 0.80), (0, 0.01, 1.15), 'Root', F),
             ('Spine_02', (0, 0.01, 1.15), (0, 0.0, 1.45), 'Spine_01', F),
             ('Spine_03', (0, 0.0, 1.45), (0, 0.0, 1.66), 'Spine_02', F),
             ('Head', (0, 0.0, 1.66), (0, 0.0, 2.0), 'Spine_03', F)]
    for side, s in ((1, 'L'), (-1, 'R')):
        P = arm_pts(side)
        bones += [('Arm_%s_01' % s, tuple(P['sh']), tuple(P['el']), 'Spine_03', F),
                  ('Arm_%s_02' % s, tuple(P['el']), tuple(P['wr']), 'Arm_%s_01' % s, F),
                  ('Hand_%s' % s, tuple(P['wr']), tuple(P['tip']), 'Arm_%s_02' % s, F)]
    for k, a in enumerate(HEM_ANG):
        ar = math.radians(a)
        out = (math.cos(ar), math.sin(ar), 0)
        z0, z1, z2 = HEM_Z
        p0 = (0.17 * math.cos(ar), 0.155 * math.sin(ar) + cy(z0), z0)
        p1 = (0.19 * math.cos(ar), 0.18 * math.sin(ar) + cy(z1), z1)
        p2 = (0.22 * math.cos(ar), 0.21 * math.sin(ar) + cy(z2) + 0.06, z2)
        bones += [('Hem_%d_01' % k, p0, p1, 'Spine_01', out), ('Hem_%d_02' % k, p1, p2, 'Hem_%d_01' % k, out)]
    return S.make_rig('Rig', bones, col)


# ================================================================ clips
def hem(t, T, flare=0.0, flare2=0.0, stream=0.0, amp=1.0, phase0=0.0):
    p = {}
    for k, a in enumerate(HEM_ANG):
        ph = 2 * math.pi * t / T - k * math.pi / 3 + phase0
        st = stream * math.sin(math.radians(a))    # + streams the hem back (front chains in, back chains out)
        p['Hem_%d_01' % k] = (4 * amp * math.sin(ph) + flare + st, 0, 5 * amp * math.cos(ph))
        p['Hem_%d_02' % k] = (7 * amp * math.sin(ph - 0.9) + flare2 + st * 1.3, 0, 8 * amp * math.cos(ph - 0.9))
    return p


def body(spine=(0, 0, 0), spine2=(0, 0, 0), spine3=(0, 0, 0), head=(0, 0, 0), arm_l=(8, 0, 4), fore_l=(16, 0, 0),
         hand_l=(12, 0, 0), arm_r=None, fore_r=None, hand_r=None, root_loc=(0, 0, 0)):
    m = lambda v: (v[0], -v[1], -v[2])  # noqa: E731 — left → right: Y and Z negate (rig.mirrored)
    # a hunch under every pose: the shoulders roll forward, the head stays up so the void faces the party
    spine2 = (spine2[0] + 4, spine2[1], spine2[2])
    spine3 = (spine3[0] + 8, spine3[1], spine3[2])
    head = (head[0] - 6, head[1], head[2])
    return {'Root.loc': root_loc, 'Spine_01': spine, 'Spine_02': spine2, 'Spine_03': spine3, 'Head': head,
            'Arm_L_01': arm_l, 'Arm_L_02': fore_l, 'Hand_L': hand_l,
            'Arm_R_01': arm_r if arm_r else m(arm_l), 'Arm_R_02': fore_r if fore_r else m(fore_l),
            'Hand_R': hand_r if hand_r else m(hand_l)}


def idle_pose(t, T=3.0):
    ph = 2 * math.pi * t / T
    p = body(spine=(2 * math.sin(ph), 0, 1.5 * math.cos(ph)), spine2=(1.5 * math.sin(ph - 0.5), 0, 0),
             head=(3 * math.sin(ph - 1.0), 0, 4 * math.sin(ph * 0.5 + 0.3) if False else 4 * math.sin(ph + 0.3)),
             arm_l=(10 + 5 * math.sin(ph - 0.6), 0, 5 + 2 * math.cos(ph)), fore_l=(18 + 5 * math.sin(ph - 1.1), 0, 0),
             hand_l=(14 + 6 * math.sin(ph - 1.5), 0, 0),
             arm_r=(10 + 5 * math.sin(ph + 0.9), 0, -(5 + 2 * math.cos(ph + 1.5))), fore_r=(18 + 5 * math.sin(ph + 0.4), 0, 0),
             hand_r=(14 + 6 * math.sin(ph), 0, 0), root_loc=(0, 0.045 * math.sin(ph), 0))
    p.update(hem(t, T))
    return p


def move_pose(t, T=1.2):
    ph = 2 * math.pi * t / T
    p = body(spine=(12, 0, 2 * math.sin(ph)), spine2=(4, 0, 0), head=(-8, 0, 0), arm_l=(-12 + 4 * math.sin(ph), 0, 8),
             fore_l=(10, 0, 0), hand_l=(6, 0, 0), arm_r=(-12 + 4 * math.sin(ph + math.pi), 0, -8), fore_r=(10, 0, 0),
             hand_r=(6, 0, 0), root_loc=(0, 0.05 * math.sin(2 * ph), 0))
    p.update(hem(t, T, stream=16, amp=1.5))
    return p


def sampled(T, fn, step=3):
    n = round(T * S.FPS)
    keys = [(f / S.FPS, fn(f / S.FPS)) for f in range(0, n, step)]
    keys.append((T, fn(0.0)))
    return keys


CLIPS = []


def clip(name, seconds, loop=False, events=None, shots=None):
    def deco(fn):
        CLIPS.append(dict(name=name, seconds=seconds, loop=loop, events=events or {}, fn=fn, shots=shots))
        return fn
    return deco


@clip('Idle', 3.0, loop=True, shots=[0, 0.5, 1.0, 1.5, 2.0, 2.5])
def c_idle():
    return sampled(3.0, idle_pose)


@clip('Move', 1.2, loop=True, shots=[0, 0.2, 0.4, 0.6, 0.8, 1.0])
def c_move():
    return sampled(1.2, move_pose)


@clip('Attack1', 1.3, events={'hit': 0.6}, shots=[0, 0.25, 0.4, 0.6, 0.85, 1.1])
def c_attack1():
    i0 = idle_pose(0)
    draw = body(spine=(-10, 0, 0), spine2=(-6, 0, 0), spine3=(-4, 0, 0), head=(-14, 0, 0), arm_l=(30, 0, 30),
                fore_l=(30, 0, 0), hand_l=(20, 0, 0), root_loc=(0, 0.06, 0.05))
    draw.update(hem(0, 1, flare=-6, flare2=-8, amp=0))
    wail = body(spine=(14, 0, 0), spine2=(8, 0, 0), spine3=(6, 0, 0), head=(14, 0, 0), arm_l=(28, 0, 62),
                fore_l=(6, 0, 0), hand_l=(-24, 0, 0), root_loc=(0, 0.12, -0.12))
    wail.update(hem(0, 1, flare=24, flare2=30, amp=0))
    hold = body(spine=(12, 0, 0), spine2=(6, 0, 0), spine3=(4, 0, 0), head=(10, 0, 0), arm_l=(24, 0, 56),
                fore_l=(10, 0, 0), hand_l=(-14, 0, 0), root_loc=(0, 0.1, -0.08))
    hold.update(hem(0, 1, flare=18, flare2=22, amp=0.5))
    return [(0.0, i0), (0.4, draw), (0.6, wail), (0.85, hold), (1.3, i0)]


@clip('Attack2', 1.0, events={'hit': 0.5}, shots=[0, 0.2, 0.35, 0.5, 0.7, 0.9])
def c_attack2():
    i0 = idle_pose(0)
    wind = body(spine=(-8, 0, -6), spine2=(-4, 0, -4), head=(-4, 0, 6), arm_l=(4, 0, 8), fore_l=(20, 0, 0),
                arm_r=(-40, 0, -14), fore_r=(36, 0, 0), hand_r=(20, 0, 0), root_loc=(0, 0.03, -0.08))
    wind.update(hem(0, 1, stream=-8, amp=0.3))
    strike = body(spine=(20, 0, 6), spine2=(8, 0, 4), head=(4, 0, -4), arm_l=(-16, 0, 10), fore_l=(14, 0, 0),
                  arm_r=(82, 0, 4), fore_r=(6, 0, 0), hand_r=(-16, 0, 0), root_loc=(0, 0.05, 0.55))
    strike.update(hem(0, 1, stream=22, amp=0.5))
    hold = body(spine=(16, 0, 4), spine2=(6, 0, 2), head=(2, 0, -2), arm_l=(-10, 0, 10), fore_l=(16, 0, 0),
                arm_r=(76, 0, 4), fore_r=(14, 0, 0), hand_r=(10, 0, 0), root_loc=(0, 0.05, 0.45))
    hold.update(hem(0, 1, stream=14, amp=0.5))
    return [(0.0, i0), (0.3, wind), (0.5, strike), (0.68, hold), (1.0, i0)]


@clip('Hit', 0.5, shots=[0, 0.07, 0.14, 0.24, 0.36, 0.5])
def c_hit():
    i0 = idle_pose(0)
    jolt = body(spine=(-14, 0, 6), spine2=(-8, 0, 4), head=(-14, 0, -8), arm_l=(30, 0, 18), fore_l=(30, 0, 0),
                hand_l=(24, 0, 0), root_loc=(0, 0.06, -0.16))
    jolt.update(hem(0, 1, stream=-20, amp=0.3))
    over = body(spine=(5, 0, -2), spine2=(3, 0, -2), head=(6, 0, 3), arm_l=(4, 0, 6), fore_l=(12, 0, 0),
                hand_l=(8, 0, 0), root_loc=(0, 0.02, 0.04))
    over.update(hem(0, 1, stream=8, amp=0.5))
    return [(0.0, i0), (0.07, jolt), (0.22, over), (0.5, i0)]


@clip('Death', 1.8, events={'down': 1.3}, shots=[0, 0.3, 0.6, 0.9, 1.3, 1.7])
def c_death():
    i0 = idle_pose(0)
    rise = body(spine=(-14, 0, 0), spine2=(-8, 0, 0), spine3=(-6, 0, 0), head=(-22, 0, 0), arm_l=(40, 0, 60),
                fore_l=(10, 0, 0), hand_l=(-20, 0, 0), root_loc=(0, 0.25, 0))
    rise.update(hem(0, 1, flare=20, flare2=26, amp=0))
    crumple = body(spine=(24, 0, 6), spine2=(16, 0, 4), spine3=(10, 0, 0), head=(30, 0, 8), arm_l=(-6, 0, 16),
                   fore_l=(30, 0, 0), hand_l=(20, 0, 0), root_loc=(0, -0.35, 0.05))
    crumple.update(hem(0, 1, flare=26, flare2=14, amp=0))
    heap = body(spine=(34, 0, 8), spine2=(24, 0, 6), spine3=(14, 0, 2), head=(36, 0, 10), arm_l=(-14, 0, 30),
                fore_l=(40, 0, 0), hand_l=(30, 0, 0), root_loc=(0, -0.72, 0.08))
    heap.update(hem(0, 1, flare=34, flare2=12, amp=0))
    gone = dict(heap)
    gone['Root.loc'] = (0, -1.05, 0.1)
    return [(0.0, i0), (0.3, rise), (0.75, crumple), (1.3, heap), (1.8, gone)]


def author(arm):
    acts = [S.make_action(arm, c['name'], c['fn'](), loop=c['loop']) for c in CLIPS]
    S.rest(arm)
    return acts


# ================================================================ review
def variant(col, arm, body_ob, name, at_=(0, 0, 0), rot=0.0, act=None, offset=0, outline=None):
    v = VARIANTS[name]
    root = bpy.data.objects.new('V.%s' % name, None)
    col.objects.link(root)
    root.location = at_
    root.rotation_euler = (0, 0, math.radians(rot))
    root.scale = (v['scale'],) * 3
    a2 = arm.copy()
    a2.name = 'Rig.%s' % name
    col.objects.link(a2)
    a2.parent = root
    o2 = body_ob.copy()
    o2.data = body_ob.data.copy()
    o2.name = 'wraith_body.%s' % name
    col.objects.link(o2)
    o2.parent = a2
    o2.modifiers['Armature'].object = a2
    S.set_material(o2, v['palette'], v.get('slots'), name='GV_%s' % name)
    o2.hide_render = False
    if outline:
        S.set_outline([o2], outline)
    if act:
        S.assign(a2, act, slot_src=arm, offset_frames=offset)
    return root, [a2, o2]


def remove(objs):
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)


def review(arm, body_ob, acts, tris):
    rv = S.Review(OUT, quick=QUICK, floor_color=(0.04, 0.042, 0.04))
    col = bpy.data.collections.new('Review')
    bpy.context.scene.collection.children.link(col)
    body_ob.hide_render = True
    made = []
    idle = bpy.data.actions['Idle']
    rv.hero.hide_render = False
    rv.hero.location = (-0.9, 0, 0)
    root, objs = variant(col, arm, body_ob, 'wraith', at_=(0.25, 0, 0), act=idle)
    bpy.context.scene.frame_set(0)
    pts = S.world_points(objs, step=4) + S.world_points([rv.hero], step=20)
    rv.label3d('hero 1.8 m', (-0.9, -0.6, 0.02), size=0.1)
    rv.label3d('wraith  1.0x  %s tris' % format(tris, ','), (0.25, -0.6, 0.02), size=0.1)
    rv.fit(pts + [Vector((0, -0.7, 0))], az=18, el=10, lens=50)
    made.append(rv.shot('lineup.png', w=1200 if QUICK else 1600, h=900 if QUICK else 1200))
    rv.clear_labels()
    rv.hero.hide_render = True
    # turn-around + 200-px read
    views = []
    for az in (0, 35, 90, 180):
        rv.fit(S.world_points(objs, step=4), az=az, el=12, lens=50)
        views.append(rv.shot('_view_%d.png' % az, size=512 if QUICK else 800))
    made.append(rv.sheet(views, os.path.join(OUT, 'views_sheet.png'), cols=len(views)))
    rv.fit(S.world_points(objs, step=4), az=32, el=20, lens=50)
    big = rv.shot('_card.png', size=512 if QUICK else 1024)
    made.append(rv.downscale(big, os.path.join(OUT, 'read200_wraith.png'), 200))
    # a face close-up
    rv.fit([p for p in S.world_points(objs, step=1) if p.z > 1.55], az=20, el=18, lens=60)
    made.append(rv.shot('closeup_hood.png', size=512 if QUICK else 800))
    remove(objs + [root])
    for act in acts:
        c = next(c for c in CLIPS if c['name'] == act.name)
        frames = [round(t * S.FPS) for t in c['shots']]
        state = {}

        def place(row, act=act):
            for o in state.get('objs', []) + ([state['root']] if 'root' in state else []):
                bpy.data.objects.remove(o, do_unlink=True)
            state['root'], state['objs'] = variant(col, arm, body_ob, 'wraith', act=act)

        def bounds(row):
            return S.world_points(state['objs'], step=6)

        def label(row, fr, c=c):
            t = fr / S.FPS
            ev = [k for k, v in c['events'].items() if abs(v - t) < 0.02]
            return '%s · wraith\n%.2f s  f%d  %s' % (c['name'], t, fr, ' '.join(ev))
        made.append(rv.strip('clip_%s' % act.name, frames, bounds, place, label, az=40, el=12, lens=50))
        remove(state['objs'] + [state['root']])
    made.append(fight(rv, col, arm, body_ob))
    return made


def fight(rv, col, arm, body_ob):
    import bpy_extras
    sc = bpy.context.scene
    heroes = []
    for x, y in ((-1.35, -0.48), (-1.35, 0.48), (-2.55, -0.48), (-2.55, 0.48)):
        h = rv.hero.copy()
        col.objects.link(h)
        h.hide_render = False
        h.location = (x, y, 0)
        h.rotation_euler = (0, 0, math.radians(S.fight_rot('party')))
        heroes.append(h)
    placed = []
    # Belfry: 3 Grave Bats (not this pass) + 1 Wraith in the back row; here the wraith alone in the back row and one in
    # the front, to read both distances
    for (x, y, off) in ((1.25, -0.4, 0), (2.6, 0.5, 30)):
        placed.append(variant(col, arm, body_ob, 'wraith', at_=(x, y, 0), rot=S.fight_rot('enemy'),
                              act=bpy.data.actions['Idle'], offset=off, outline=0.016))
    sc.frame_set(20)
    pts = S.world_points(heroes, step=9)
    for _r, objs in placed:
        pts += S.world_points(objs, step=5)
    xs = [p.x for p in pts]
    centre = Vector(((min(xs) + max(xs)) / 2, 0.0, 0.9))
    d = S.fight_distance()
    for _i in range(40):
        S.fight_camera(rv.stage, centre, d)
        sc.render.resolution_x, sc.render.resolution_y = S.FIGHT_W, S.FIGHT_H
        bpy.context.view_layer.update()
        if all(0.03 <= c.x <= 0.97 and 0.03 <= c.y <= 0.97 for c in
               (bpy_extras.object_utils.world_to_camera_view(sc, rv.stage.cam, p) for p in pts)):
            break
        d *= 1.05
    path = rv.shot('fight_belfry.png', w=S.FIGHT_W, h=S.FIGHT_H)
    rv.camera_ortho_off()
    for h in heroes:
        bpy.data.objects.remove(h, do_unlink=True)
    for root, objs in placed:
        remove(objs + [root])
    log('fight read: camera %.2f m (hero-share distance %.2f m)' % (d, S.fight_distance()))
    return path


# ================================================================ export
def export(arm, body_ob, acts):
    from export import export_glb
    S.strip_rest([arm, body_ob])
    S.finish(body_ob)
    if 'Outline' in body_ob.modifiers:
        body_ob.modifiers.remove(body_ob.modifiers['Outline'])
    S.stash(arm, acts)
    body_ob['kind'] = 'monster'
    body_ob['base'] = BASE
    bpy.context.view_layer.update()
    path = os.path.join(S.MON, BASE + '.glb')
    export_glb(path, [arm, body_ob], animations=True, animation_mode='ACTIONS',
               extra={'export_optimize_animation_size': True, 'export_optimize_animation_keep_anim_armature': True,
                      'export_merge_animation': 'ACTION'})
    return path


def main():
    common.clear_scene()
    sc = bpy.context.scene
    sc.render.fps = S.FPS
    col = common.collection('Wraith')
    arm = build_rig(col)
    mb = MB()
    build_robe(mb)
    build_hood(mb)
    for side in (1, -1):
        build_sleeve(mb, side)
    log('wraith_body: %d tris' % mb.tris())
    body_ob = mb.build('wraith_body', col)
    S.apply_weights(body_ob, mb, arm)
    v = VARIANTS['wraith']
    S.look(body_ob, v['palette'], v['slots'])
    acts = author(arm)
    body_ob.modifiers['Outline'].show_viewport = False
    tris = S.tri_count([body_ob])
    body_ob.modifiers['Outline'].show_viewport = True
    log('tris', tris)
    if RENDER:
        made = review(arm, body_ob, acts, tris)
        log('renders:', ', '.join(os.path.basename(p) for p in made))
    for o in list(bpy.data.objects):
        if o.name.startswith('Rig.') or o.name.startswith('wraith_body.') or o.name.startswith('V.'):
            bpy.data.objects.remove(o, do_unlink=True)
    common.save_blend(os.path.join(BUILD, 'wraith.blend'))
    path = export(arm, body_ob, acts)
    S.write_manifest({n: dict(base=BASE, scale=vv['scale'], parts=vv['parts'], shapes=vv['shapes'], palette=vv['palette'],
                              slots=vv['slots'], clipSpeed=vv['clipSpeed'], tris=tris) for n, vv in VARIANTS.items()})
    S.write_clips(BASE, 'skeletal', [dict(name=c['name'], seconds=c['seconds'], loop=c['loop'], events=c['events'])
                                     for c in CLIPS], extra={'rig': 'Rig', 'bones': len(arm.data.bones)})
    from export import reimport_report
    lines = reimport_report(path, os.path.join(OUT, 'reimport_check.png') if RENDER else None)
    a = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    if a and 'Attack2' in bpy.data.actions:
        act = bpy.data.actions['Attack2']
        adt = a.animation_data or a.animation_data_create()
        adt.action = act
        adt.action_slot = act.slots[0]
        sc = bpy.context.scene
        sc.frame_set(0)
        p0 = (a.matrix_world @ a.pose.bones['Hand_R'].tail).copy()
        sc.frame_set(round(0.5 * sc.render.fps))
        p1 = (a.matrix_world @ a.pose.bones['Hand_R'].tail).copy()
        lines.append('  - re-imported Attack2 moves the right claw %.2f m (frame 0 → hit)' % (p0 - p1).length)
    for ln in lines:
        log(ln)


main()

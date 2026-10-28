"""costume_lib.py — costume pieces for the humanoid monsters, lofted with gear_loft over the hero body (Phase 6,
monsters pass B). Every builder returns gear_loft Parts (or Kits for rigid props) and takes its palette slots as
arguments, so one shape serves several variants whose palettes put the colours in different slots (the Netter's coat
is its accent, the Hexer's clothes its second colour).

Coordinates: the broad frame's rest pose (metres, Z up, the character faces −Y, +X is the character's left). Fields
and spheres come from `gear_loft.Fields` (`K`): `K.torso` (z 0.50→1.56), `K.uarm`, `K.farm`, `K.hand`, `K.thigh`,
`K.shin`, `K.foot`, `K.head` (a sphere from the skull's centre, the face included). Left-side pieces are built once
and mirrored.
"""
import math
import os
import sys

import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import humanoid_lib as H  # noqa: E402

L = H.L
D = math.radians
V = Vector
SPINE = ['Hips', 'Spine', 'Chest', 'UpperChest', 'Neck']
TH_BODY = [3, 24, 48, 72, 96, 120, 144, 168, 177, 183, 192, 216, 240, 264, 288, 312, 336, 357]


def mirror_for(sign, g):
    return g if sign > 0 else g.mirrored()


def band_rows(field, ts, ths, offs):
    return [[field.pt(t(th) if callable(t) else t, th, o(th) if callable(o) else o) for th in ths]
            for t, o in zip(ts, offs)]


def interp(table, x):
    """Piecewise-linear lookup in [(x, y)] (sorted by x), clamped."""
    if x <= table[0][0]:
        return table[0][1]
    for (x0, y0), (x1, y1) in zip(table, table[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return table[-1][1]


# ====================================================================== head: hoods, masks, grins
def hood_sphere(K):
    """The coif's envelope (gear_build_blade): the head and neck without the eyes and nose, a quarter convex."""
    fg = K.fg
    env = fg.fsel(['head', 'neck', 'chest'], where=lambda c: (c[:, 2] > 1.30) & (np.abs(c[:, 0]) < 0.24) & ~(
        (c[:, 1] < -0.08) & (c[:, 2] > 1.585) & (c[:, 2] < 1.665) & (np.abs(c[:, 0]) < 0.075)))
    return L.Sphere(fg, (0, -0.012, 1.62), L.FRONT, L.UP, env, [D(e) for e in range(-72, 91, 4)], 40, smooth=4,
                    dilate=0, convex_cols=0.25)


def hood(sess, K, slot, lining, open_c=-12.0, open_a=34.0, open_w=60.0, e_bot=-50.0, point=0.035, off_top=0.016,
         C=None, key='hood'):
    """A cloth or mail hood: the head's envelope with a face opening (an ellipse centred at elevation `open_c`,
    half-height `open_a`, half-width `open_w` degrees), hanging to `e_bot` round the neck, a soft point at the back
    of the crown, the inside of the opening edged in `lining`."""
    fg = K.fg
    C = C or hood_sphere(K)
    bs = [D(b) for b in (0, 15, 30, 46, 64, 86, 112, 145, 180, 215, 248, 274, 296, 314, 330, 345)]
    e_c, a, bf = D(open_c), D(open_a), D(open_w)

    def half(b):
        x = math.atan2(math.sin(b), math.cos(b)) / bf
        return a * math.sqrt(max(0.0, 1 - x * x))

    def e_lo(b):
        return e_c - half(b)

    def e_hi(b):
        return e_c + half(b)
    eb = D(e_bot)

    def off(e):
        return 0.010 + 0.004 * L.smoothstep(D(-30), D(-50), e) + (off_top - 0.010) * L.smoothstep(D(-20), D(10), e)

    def P(e, b, extra=0.0):
        return C.pt(e, b, off(e) + extra)
    lo = [[P(eb + (e_lo(b) - eb) * s, b) for b in bs] for s in (0.0, 0.5, 1.0)]
    hi = [[P(e_hi(b) + (D(84) - e_hi(b)) * s, b) for b in bs] for s in (0.0, 0.45, 0.82)]
    opening = [half(b) > 1e-6 for b in bs]
    g = L.Grid()
    hem = [P(eb - D(2), b, 0.004) for b in bs]
    g.rows([hem, lo[0]], slot, closed=True)
    g.rows(lo, lambda i, j: lining if (i == 1 and opening[j]) else slot, closed=True)
    g.rows(hi, lambda i, j: lining if (i == 0 and opening[j]) else slot, closed=True)
    apex = P(D(86), D(180), 0.0) + V((0, point, point * 0.4))
    g.fan(hi[-1], apex, slot)
    g.weld()
    sel = fg.fsel(['head', 'neck', 'chest'], where=lambda c: (c[:, 2] > 1.30) & (np.abs(c[:, 0]) < 0.24))
    piece = fg.piece(key, g, sel)
    return L.Part(key, piece, smooth=3, clear=0.008, over=('jerkin', 'coat', 'capelet'), gap=0.003)


def capelet(sess, K, slot, z_top=1.47, z_bot=1.30, points=True, key='capelet', off=0.022):
    """A short shoulder cape under the hood (the hood's skirt), its hem cut in points."""
    T = K.torso
    ths = L.circle(18)
    rows = [[T.pt(K.tz(z_top), th, 0.012) for th in ths], [T.pt(K.tz(1.40), th, off) for th in ths]]
    hem = []
    for q, th in enumerate(ths):
        z = z_bot - (0.05 if (points and q % 2) else 0.0)
        hem.append(T.pt(K.tz(z), th, off + 0.008))
    rows.append(hem)
    g = L.Grid()
    g.rows(rows, slot, closed=True)
    piece = K.fg.piece(key, g, K.f_torso)
    return L.Part(key, piece, allow=['UpperChest', 'Chest', 'Neck', 'LeftShoulder', 'RightShoulder', 'LeftUpperArm',
                                     'RightUpperArm'], smooth=4, clear=0.016, over=('jerkin', 'coat', 'hauberk'), gap=0.006,
                  reach=0.06, cap={'LeftUpperArm': 0.35, 'RightUpperArm': 0.35})


# the mask's top edge (elevation in degrees, by azimuth in degrees from the front): across the nose bridge, under the
# eyes, back up toward the ears
HALF_TOP = [(0, 3.0), (10, -3.0), (18, -13.0), (28, -17.0), (40, -14.0), (55, -8.0), (75, -4.0)]


def face_mask(sess, K, slot, key='mask', top=None, bottom=None, width=74.0, off=0.0075, eyes=None, eye_slot=None,
              rows=6, cols=13, glow_eye=None):
    """A mask over the face on the head's own envelope (`K.head` includes the nose): `top`/`bottom` are elevation
    tables by azimuth (degrees); `eyes` (e0, e1, b0, b1) paints eye holes in `eye_slot`; `glow_eye` (sign) puts the
    glowing eye on that side instead. Rigid on the head."""
    C = K.head
    top = top or HALF_TOP
    bottom = bottom or [(0, -56.0), (30, -50.0), (55, -38.0), (75, -24.0)]
    bs = [D(-width + 2 * width * q / (cols - 1)) for q in range(cols)]
    grid = []
    for i in range(rows):
        s = i / (rows - 1)
        row = []
        for b in bs:
            bd = abs(math.degrees(b))
            e0 = interp(bottom, bd)
            e1 = interp(top, bd)
            row.append(C.pt(D(e0 + (e1 - e0) * s), b, off))
        grid.append(row)

    def sl(i, j):
        if eyes is None:
            return slot
        e = None
        bd = abs(math.degrees((bs[j] + bs[j + 1]) / 2))
        s = (i + 0.5) / (rows - 1)
        b_deg = math.degrees((bs[j] + bs[j + 1]) / 2)
        e0 = interp(bottom, bd)
        e1 = interp(top, bd)
        e = e0 + (e1 - e0) * s
        if eyes[0] <= e <= eyes[1] and eyes[2] <= bd <= eyes[3]:
            if glow_eye is not None and (b_deg > 0) == (glow_eye > 0):
                return H.SLOT['glow']
            return eye_slot
        return slot
    g = L.Grid()
    g.rows(grid, sl, closed=False, orient=V((0, 0.02, 1.62)))
    piece = K.fg.piece(key, g, K.f_head)
    return L.Part(key, piece, rigid='Head', clear=0.006, over=('hood',), gap=0.002), C


def grin(sess, K, ink, teeth, key='grin', e_mid=-28.0, half_w=50.0, height=7.0, lips=None, off=0.0095, C=None,
         n=17):
    """A painted grin over a mask: a black crescent curving up at the corners, a row of white teeth over it, an
    optional outline in `lips`. Rigid on the head."""
    C = C or K.head
    g = L.Grid()
    bs = [D(-half_w + 2 * half_w * q / (n - 1)) for q in range(n)]

    def mid(b):
        x = math.degrees(b) / half_w
        return e_mid + 9.0 * x * x

    def th(b):
        x = math.degrees(b) / half_w
        return height * math.sqrt(max(0.0, 1 - x * x)) + 1.2

    up = [C.pt(D(mid(b) + th(b) * 0.38), b, off) for b in bs]
    dn = [C.pt(D(mid(b) - th(b)), b, off) for b in bs]
    if lips is not None:
        up2 = [C.pt(D(mid(b) + th(b) * 0.38 + 2.2), b, off - 0.0004) for b in bs]
        dn2 = [C.pt(D(mid(b) - th(b) - 2.2), b, off - 0.0004) for b in bs]
        g.rows([up2, up], lips, orient=V((0, 0.02, 1.6)))
        g.rows([dn, dn2], lips, orient=V((0, 0.02, 1.6)))
    g.rows([up, dn], ink, orient=V((0, 0.02, 1.6)))
    # teeth: triangles hanging from the upper edge and rising from the lower one, 0.7 mm proud of the crescent
    tk = H.Kit()
    for q in range(n - 1):
        if q in (0, n - 2):
            continue
        b0, b1 = bs[q], bs[q + 1]
        bm = (b0 + b1) / 2
        for (e_edge, e_tip) in ((lambda b: mid(b) + th(b) * 0.38, lambda b: mid(b) - th(b) * 0.25),
                                (lambda b: mid(b) - th(b), lambda b: mid(b) - th(b) * 0.55)):
            a_ = C.pt(D(e_edge(b0)), b0, off + 0.0007)
            b_ = C.pt(D(e_edge(b1)), b1, off + 0.0007)
            t_ = C.pt(D(e_tip(bm)), bm, off + 0.0007)
            tk.add([a_, b_, t_], [(0, 1, 2)], teeth)
    g.poly(tk.verts, tk.faces, tk.slots, V((0, 0.02, 1.6)))
    piece = K.fg.piece(key, g, K.f_head)
    return L.Part(key, piece, rigid='Head', clear=0.0, over=(), gap=0.0)


# ====================================================================== torso
def jerkin(sess, K, slot, edge=None, hem=0.86, ragged=0.0, front_open=0.0, off_fn=None, key='jerkin', seam=None,
           studs=None):
    """A sleeveless jerkin (or a coat's body): torso rows from the collar to `hem`; `front_open` (degrees) leaves a
    V open down the front (the coat's lapels show the shirt); `edge` slot for the hem row; `seam` slot paints a
    front lacing; `studs` (slot) adds rivets."""
    T = K.torso
    ths = [D(a) for a in TH_BODY]
    zs = [1.455, 1.40, 1.33, 1.24, 1.13, 1.03, 0.96, 0.90]
    zs = [z for z in zs if z > hem + 0.02] + [hem]

    def off(z):
        if off_fn:
            return off_fn(z)
        if z >= 1.12:
            return 0.012
        if z >= 0.96:
            return 0.010
        return 0.013 + 0.01 * L.smoothstep(0.96, 0.80, z)
    rows = []
    for i, z in enumerate(zs):
        row = []
        for q, th in enumerate(ths):
            zz = z
            if i == len(zs) - 1 and ragged:
                zz = z - ragged * (0.5 + 0.5 * math.sin(q * 2.3 + 0.7))
            row.append(T.pt(K.tz(zz), th, off(zz)))
        rows.append(row)
    flange = [T.pt(K.tz(1.46), th, 0.002) for th in ths]
    g = L.Grid()
    allrows = [flange] + rows

    def sl(i, j):
        if edge is not None and i == len(allrows) - 2:
            return edge
        if seam is not None and (j == 0 or j == len(ths) - 1):
            return seam
        return slot
    if front_open:
        # leave the front cells open where the V is: rows by height, columns by angle
        g2 = L.Grid()
        for i in range(len(allrows) - 1):
            z = zs[max(0, i - 1)]
            vh = front_open * L.smoothstep(1.06, 1.42, z)
            for j in range(len(ths)):
                j2 = (j + 1) % len(ths)
                a0 = math.degrees(ths[j])
                a1 = math.degrees(ths[j2]) if j2 else 360.0
                am = (a0 + a1) / 2
                dist = min(am, 360 - am)
                if dist < vh:
                    continue
                g2.poly([allrows[i][j], allrows[i][j2], allrows[i + 1][j2], allrows[i + 1][j]], [(0, 1, 2, 3)],
                        sl(i, j), 'body')
        g = g2
    else:
        g.rows(allrows, sl, closed=True)
    if studs is not None:
        for a in (40, 80, 280, 320):
            for z in (1.30, 1.15):
                g.stud(T.pt(K.tz(z), D(a), off(z) + 0.0015), T.dir(D(a)), 0.006, studs)
    piece = K.fg.piece(key, g, K.f_torso)
    return L.Part(key, piece, smooth=2, clear=0.007, over=('trousers', 'hipband', 'leg_1', 'leg_-1', 'sleeve_1', 'sleeve_-1'),
                  gap=0.003)


def coat_skirt(sess, K, slot, lining, z_top=0.93, z_bot=0.52, key='skirt', trim=None):
    """A coat's skirt in two halves riding their thighs (split front and back so a stride opens the slits)."""
    T = K.torso
    parts = []
    ths = [D(a) for a in TH_BODY if 0 < a < 180]
    zs = [z_top, 0.86, 0.78, 0.70, 0.62, z_bot]

    def off(z):
        return 0.024 + 0.03 * L.smoothstep(0.9, 0.5, z)
    for sign in (1, -1):
        rows = [[T.pt(K.tz(z), th, off(z)) for th in ths] for z in zs]
        g = L.Grid()
        g.rows(rows, lambda i, j: (trim if (trim is not None and i == len(zs) - 2) else slot))
        sel = K.side(sign, ['thighs', 'belly'])
        up = ['LeftUpperLeg'] if sign > 0 else ['RightUpperLeg']
        piece = K.fg.piece('%s_%d' % (key, sign), mirror_for(sign, g), sel)
        parts.append(L.Part('%s_%d' % (key, sign), piece, allow=['Hips'] + up, smooth=2, clear=0.012,
                            over=('trousers', 'hipband', 'leg_1', 'leg_-1', 'boot_1', 'boot_-1'), gap=0.006))
    return parts


def sash(sess, K, slot, z=1.03, width=0.035, knot_side=1, tails=True, key='sash'):
    """A sash wrapped round the waist with a knot at one hip and two hanging tails."""
    T = K.torso
    ths = L.circle(18)
    rows = [[T.pt(K.tz(z + dz), th, o) for th in ths] for dz, o in ((-width, 0.017), (0.0, 0.021), (width, 0.017))]
    g = L.Grid()
    g.rows(rows, slot, closed=True)
    th_k = D(90 * knot_side)
    c = T.pt(K.tz(z), th_k, 0.026)
    n = T.dir(th_k)
    g.box(c, n.cross(V((0, 0, 1))).normalized() * 0.03, n * 0.012, V((0, 0, 0.032)), slot)
    parts = [L.Part(key, K.fg.piece(key, g, K.f_torso), allow=SPINE, smooth=2, clear=0.012,
                    over=('jerkin', 'coat', 'hauberk', 'belt'), gap=0.004)]
    if tails:
        tg = L.Grid()
        for k, dth in enumerate((-10, 8)):
            th = th_k + D(dth)
            top = T.pt(K.tz(z - 0.02), th, 0.03)
            d_ = T.dir(th)
            side = d_.cross(V((0, 0, 1))).normalized()
            pts = [top, top + d_ * 0.01 + V((0, 0, -0.1)), top + d_ * 0.015 + V((0, 0, -0.2 - 0.04 * k))]
            w = 0.022
            tg.rows([[p - side * w for p in pts], [p + side * w for p in pts]], slot, orient=top - d_ * 0.1)
        side_bone = 'LeftUpperLeg' if knot_side > 0 else 'RightUpperLeg'
        parts.append(L.Part(key + '_tails', K.fg.piece(key + '_tails', tg), allow=['Hips', side_bone], smooth=2,
                            clear=0.02, cap={side_bone: 0.5}))
    return parts


def belt(sess, K, slot, buckle, z=0.975, key='belt', width=0.022):
    T = K.torso
    ths = L.circle(16)
    rows = [[T.pt(K.tz(z + dz), th, o) for th in ths] for dz, o in ((-width, 0.016), (0, 0.019), (width, 0.016))]
    g = L.Grid()
    g.rows(rows, slot, closed=True)
    c = T.pt(K.tz(z), 0.0, 0.022)
    g.box(c, (0.022, 0, 0), (0, 0.005, 0), (0, 0, 0.022), buckle)
    return L.Part(key, K.fg.piece(key, g, K.f_torso), allow=SPINE, smooth=2, clear=0.012,
                  over=('jerkin', 'coat', 'hauberk', 'robe'), gap=0.004)


def sleeves(sess, K, slot, t_end=1.0, cuff=None, key='sleeve', off=0.011, farm_end=None):
    """Sleeves from the shoulder down the upper arm (to `t_end` along it) and optionally on down the forearm to
    `farm_end`, with a cuff band in `cuff`."""
    parts = []
    for sign in (1, -1):
        A = K.uarm
        ths = L.circle(8)
        spec = [(-0.06, 0.002), (-0.04, off), (0.35, off), (0.7, off), (t_end, off + 0.001)]
        rows = band_rows(A, [t for t, _ in spec], ths, [o for _, o in spec])
        g = L.Grid()
        g.rows(rows, slot, closed=True)
        if farm_end:
            F = K.farm
            fr = band_rows(F, [-0.05, 0.3, 0.6, farm_end], ths, [off, off, off, off + 0.002])
            fg_ = L.Grid()
            fg_.rows(fr, lambda i, j: cuff if (cuff is not None and i == 2) else slot, closed=True)
            g.extend(fg_)
        elif cuff is not None:
            cr = band_rows(A, [t_end - 0.06, t_end - 0.06, t_end + 0.02, t_end + 0.02], ths,
                           [off + 0.001, off + 0.006, off + 0.006, off + 0.001])
            cg = L.Grid()
            cg.rows(cr, cuff, closed=True)
            g.extend(cg)
        sel = K.side(sign, ['upperArms', 'forearms', 'chest'], xmin=0.10)
        piece = K.fg.piece('%s_%d' % (key, sign), mirror_for(sign, g), sel)
        parts.append(L.Part('%s_%d' % (key, sign), piece, smooth=1, clear=0.006, reach=0.03))
    return parts


def bracers(sess, K, slot, t0=0.45, t1=0.92, key='bracer', off=0.012):
    parts = []
    for sign in (1, -1):
        A = K.farm
        ths = L.circle(8)
        rows = band_rows(A, [t0, t0 + 0.02, t1 - 0.02, t1], ths, [off - 0.006, off, off, off - 0.006])
        g = L.Grid()
        g.rows(rows, slot, closed=True)
        pre = 'Left' if sign > 0 else 'Right'
        sel = K.side(sign, ['forearms', 'hands'], bones=[pre + 'LowerArm', pre + 'Hand'])
        piece = K.fg.piece('%s_%d' % (key, sign), mirror_for(sign, g), sel)
        parts.append(L.Part('%s_%d' % (key, sign), piece, allow=[pre + 'LowerArm', pre + 'Hand'], smooth=2, clear=0.006,
                            over=('sleeve_%d' % sign,), gap=0.003))
    return parts


# ====================================================================== legs, feet
def trousers(sess, K, slot, knee_slot=None, shin_end=0.72, key='trousers'):
    """Trousers: a hip band and two leg tubes from the hip down the shin to `shin_end` (tucked into the boots)."""
    T = K.torso
    ths = L.circle(16)
    rows = [[T.pt(K.tz(z), th, o) for th in ths] for z, o in ((1.03, 0.006), (0.96, 0.009), (0.89, 0.011), (0.83, 0.012))]
    g = L.Grid()
    g.rows(rows, slot, closed=True)
    parts = [L.Part('hipband', K.fg.piece('hipband', g, K.fg.fsel(['belly', 'thighs'])), smooth=2, clear=0.006)]
    for sign in (1, -1):
        A, S = K.thigh, K.shin
        lth = L.circle(10)
        tr = band_rows(A, [0.0, 0.5, 1.0], lth, [0.010, 0.010, 0.011])
        sr = band_rows(S, [0.1, shin_end], lth, [0.011, 0.009])
        lg = L.Grid()
        lg.rows(tr + sr, lambda i, j: knee_slot if (knee_slot is not None and i == 2) else slot, closed=True)
        sel = K.side(sign, ['thighs', 'shins'])
        piece = K.fg.piece('leg_%d' % sign, mirror_for(sign, lg), sel)
        parts.append(L.Part('leg_%d' % sign, piece, smooth=1, clear=0.006))
    return parts


def boots(sess, K, slot, cuff=None, top=0.3, key='boot', sole=None):
    """Crude boots: a foot loft (heel to toe) and a shaft from the ankle up the shin to `top` (the shin field's
    station: 0 at the knee, 1 at the ankle) with a turned-down cuff."""
    parts = []
    for sign in (1, -1):
        F = K.foot
        n = 10
        ths = L.circle(n)
        floor_z = -0.003

        def P(t, th):
            o = 0.009 if math.cos(th) > -0.3 else 0.007
            p = F.pt(t, th, o)
            if p.z < floor_z:
                p.z = floor_z
            return p
        rows = [[P(t, th) for th in ths] for t in (0.0, 0.45, 0.8, 0.97)]
        g = L.Grid()
        g.rows(rows, lambda i, j: (sole if (sole is not None and math.cos(ths[j]) < -0.6) else slot), closed=True)
        tip = F.pt(1.03, 0.0, 0.0)
        tip.z = max(tip.z, 0.014)
        g.fan(rows[-1], tip, slot)
        heel = F.pt(-0.04, 0.0, 0.0)
        heel.z = 0.03
        g.fan(rows[0], heel, slot)
        S = K.shin
        sth = L.circle(10)
        spec = [(top, 0.002), (top, 0.012), (top + (1.0 - top) * 0.55, 0.011), (1.02, 0.013)]
        sr = band_rows(S, [t for t, _ in spec], sth, [o for _, o in spec])
        sg = L.Grid()
        sg.rows(sr, slot, closed=True)
        if cuff is not None:
            cr = band_rows(S, [top - 0.002, top - 0.002, top + 0.06, top + 0.06], sth, [0.012, 0.016, 0.016, 0.012])
            cg = L.Grid()
            cg.rows(cr, cuff, closed=True)
            sg.extend(cg)
        foot_sel = K.side(sign, ['feet'])
        shin_sel = K.side(sign, ['shins', 'feet'])
        parts.append(L.Part('foot_%d' % sign, K.fg.piece('foot_%d' % sign, mirror_for(sign, g), foot_sel), smooth=1,
                            clear=0.005))
        parts.append(L.Part('boot_%d' % sign, K.fg.piece('boot_%d' % sign, mirror_for(sign, sg), shin_sel), smooth=1,
                            clear=0.007, over=('foot_%d' % sign, 'leg_%d' % sign), gap=0.003))
    return parts


# ====================================================================== props (rigid kits, world space at rest)
def at_socket(sess, socket, kit):
    """A kit modelled in a socket's space, moved to the socket's rest place in the world."""
    k = kit.copy()
    k.transform(sess.socket(socket))
    return k


def hang(sess, bone_point, kit):
    k = kit.copy()
    k.transform(Matrix.Translation(V(bone_point)))
    return k


def purse(slot, tie):
    """A small coin purse (world space at the origin, hang it with `hang`)."""
    k = H.Kit()
    k.lathe([(0.025, 0.0), (0.045, -0.03), (0.05, -0.06), (0.04, -0.085), (0.0, -0.092)], 8, slot, axis=V((0, 0, 1)),
            cap0=V((0, 0, 0.004)), cap1=None)
    k.torus(V((0, 0, -0.004)), V((0, 0, 1)), 0.022, 0.006, 8, 4, tie)
    return k


def bolt_quiver(slot, bolts, tips):
    k = H.Kit()
    k.lathe([(0.04, 0.0), (0.042, 0.28)], 8, slot, axis=V((0, 0, 1)), cap0='flat', cap1=None)
    for q in range(5):
        a = q * 1.25
        p = V((math.cos(a) * 0.022, math.sin(a) * 0.022, 0.25))
        k.lathe([(0.004, 0.0), (0.004, 0.12)], 4, bolts, axis=V((0, 0, 1)), centre=p, cap0=None, cap1=None)
        k.box(p + V((0, 0, 0.13)), V((0.012, 0, 0)), V((0, 0.002, 0)), V((0, 0, 0.012)), tips)
    return k


def club(wood, studs):
    """A crude club (socket space: the haft along +Y)."""
    k = H.Kit()
    k.lathe([(0.018, -0.12), (0.02, 0.05), (0.032, 0.30), (0.046, 0.52), (0.045, 0.6), (0.03, 0.63)], 7, wood,
            axis=V((0, 1, 0)), cap0='flat', cap1='apex')
    for q in range(6):
        a = q * math.pi / 3
        y = 0.42 + 0.08 * (q % 2)
        r = 0.044
        p = V((math.cos(a) * r, y, math.sin(a) * r))
        k.cone(p * 0.85 + V((0, y * 0.15, 0)), p + V((math.cos(a) * 0.025, 0, math.sin(a) * 0.025)), 0.009, 4, studs)
    return k


def gaff(wood, iron):
    """A gaff hook (socket space): a pole with an iron hook curling forward at its tip."""
    k = H.Kit()
    k.lathe([(0.014, -0.35), (0.013, 0.75)], 6, wood, axis=V((0, 1, 0)), cap0='flat', cap1='flat')
    pts = [V((0, 0.74, 0)), V((0, 0.84, 0.0)), V((0, 0.91, 0.04)), V((0, 0.92, 0.10)), V((0, 0.88, 0.14)), V((0, 0.83, 0.13))]
    k.tube(pts, [0.012, 0.011, 0.010, 0.008, 0.006, 0.003], 5, iron, 'flat', 'apex')
    return k


def net_coil(sess, net, floats, floats_dark=5):
    """A coiled net slung over the left shoulder (world space at rest): a fat lumpy ring from the left shoulder
    across the chest and back to the right hip, with cork floats."""
    k = H.Kit()
    pts = []
    n = 18
    for q in range(n + 1):
        t = q / n
        a = 2 * math.pi * t
        # an ellipse round the torso, high on the left shoulder, low at the right hip, clear of the coat
        x = 0.05 + 0.245 * math.sin(a)
        y = -0.012 + 0.205 * math.cos(a)
        z = 1.20 + 0.21 * math.sin(a)
        pts.append(V((x, y, z)))
    radii = [0.058 + 0.012 * math.sin(q * 2.7) for q in range(len(pts))]
    k.tube(pts, radii, 8, lambda i, j: net if (i + j) % 2 == 0 else floats_dark, None, None)
    for q in range(1, n, 3):
        p = pts[q]
        k.sphere(p + V((0, -0.06, 0.01)), 0.022, 6, 3, floats)
    return k


def fetishes(bone, cord, glow=None):
    """Bone charms on a cord (world space at the origin): little skulls and bones dangling."""
    k = H.Kit()
    for q in range(5):
        x = -0.08 + 0.04 * q
        length = 0.07 + 0.03 * (q % 2)
        k.lathe([(0.0025, 0.0), (0.0025, -length)], 3, cord, axis=V((0, 0, 1)), centre=V((x, 0, 0)), cap0=None, cap1=None)
        c = V((x, 0, -length - 0.016))
        if q % 2 == 0:
            k.sphere(c, 0.017, 6, 4, bone, scale=(1.0, 0.9, 1.05))
            k.box(c + V((0, -0.012, -0.012)), V((0.009, 0, 0)), V((0, 0.004, 0)), V((0, 0, 0.005)), bone)
        else:
            k.lathe([(0.008, -0.02), (0.005, 0.0), (0.005, 0.03), (0.008, 0.045)], 4, bone, axis=V((0, 0, 1)),
                    centre=c + V((0, 0, -0.02)), cap0='flat', cap1='flat')
    return k


def conch(slot, inner=None, s=1.0):
    """A conch shell (world space at the origin, its long axis along +X): a spiralling cone with ridges."""
    k = H.Kit()
    prof = []
    for q in range(8):
        t = q / 7
        r = (0.012 + 0.07 * math.sin(math.pi * min(1.0, t * 1.25))) * s
        prof.append((max(r, 0.004 * s), (-0.09 + 0.24 * t) * s))
    k.lathe(prof, 9, lambda i, j: (inner if (inner is not None and i >= 5 and j in (0, 1)) else slot),
            axis=V((1, 0, 0)), cap0='apex', cap1='apex', phase=0.3)
    for q in range(4):
        x = (-0.05 + 0.05 * q) * s
        k.cone(V((x, 0.0, 0.05 * s)), V((x + 0.01 * s, 0.0, 0.085 * s)), 0.012 * s, 4, slot)
    return k


def boat_hook(wood, iron):
    """A boat-hook (socket space): a stout pole, an iron spike and a back-curved hook."""
    k = H.Kit()
    k.lathe([(0.015, -0.2), (0.014, 0.62)], 6, wood, axis=V((0, 1, 0)), cap0='flat', cap1='flat')
    k.lathe([(0.017, 0.6), (0.017, 0.66)], 6, iron, axis=V((0, 1, 0)), cap0='flat', cap1='flat')
    k.cone(V((0, 0.66, 0)), V((0, 0.80, 0)), 0.011, 5, iron)
    pts = [V((0, 0.66, 0)), V((0, 0.70, 0.05)), V((0, 0.66, 0.10)), V((0, 0.60, 0.11))]
    k.tube(pts, [0.009, 0.008, 0.007, 0.003], 5, iron, 'flat', 'apex')
    return k


def anchor_maul(haft, head, rim):
    """The Drowner's anchor maul (socket space): a long haft and an anchor's crown for a head."""
    k = H.Kit()
    k.lathe([(0.02, -0.45), (0.019, 0.72)], 6, haft, axis=V((0, 1, 0)), cap0='flat', cap1='flat')
    k.box(V((0, 0.80, 0)), V((0.03, 0, 0)), V((0, 0.10, 0)), V((0, 0, 0.03)), head)
    k.torus(V((0, 0.93, 0)), V((1, 0, 0)), 0.035, 0.011, 8, 4, rim)
    arm = [V((0, 0.72, -0.17)), V((0, 0.69, -0.10)), V((0, 0.68, 0.0)), V((0, 0.69, 0.10)), V((0, 0.72, 0.17))]
    k.tube(arm, [0.022, 0.026, 0.03, 0.026, 0.022], 6, head, 'flat', 'flat')
    for sgn in (1, -1):
        k.cone(V((0, 0.71, 0.17 * sgn)), V((0, 0.80, 0.21 * sgn)), 0.03, 4, head)
    return k


def cutlass(blade, guard, grip):
    """A cutlass (socket space: the blade along +Y curving back, edges in the YZ plane, the basket guard over the
    knuckles)."""
    k = H.Kit()
    outline = [V((0.0, 0.0, 0)), V((0.022, 0.02, 0)), V((0.026, 0.36, 0)), V((0.012, 0.62, 0)), V((-0.02, 0.70, 0)),
               V((-0.024, 0.60, 0)), V((-0.016, 0.30, 0)), V((-0.012, 0.02, 0))]
    k.slab(outline, 0.008, blade, origin=V((0, 0.07, 0)), x=V((0, 0, 1)), y=V((0, 1, 0)))
    k.tube([V((0, 0.07, 0.025)), V((0, 0.03, 0.06)), V((0, -0.05, 0.065)), V((0, -0.1, 0.03))],
           [0.008, 0.008, 0.008, 0.008], 5, guard, 'flat', 'flat')
    k.box(V((0, 0.065, 0)), V((0.012, 0, 0)), V((0, 0.008, 0)), V((0, 0, 0.04)), guard)
    k.lathe([(0.015, -0.1), (0.014, 0.055)], 6, grip, axis=V((0, 1, 0)), cap0='flat', cap1='flat')
    k.sphere(V((0, -0.11, 0)), 0.02, 6, 3, guard)
    return k


def conch_staff(wood, shell, inner, pearl):
    """Naesa's staff (socket space): a driftwood staff topped with a great conch, a few pearls on cords."""
    k = H.Kit()
    k.lathe([(0.017, -0.55), (0.015, 0.25), (0.018, 0.75), (0.014, 0.95)], 6, wood, axis=V((0, 1, 0)),
            cap0='flat', cap1='flat')
    c = conch(shell, inner, 1.25)
    c.transform(Matrix.Translation(V((0, 1.05, 0.02))) @ Matrix.Rotation(D(80), 4, 'Z'))
    k.extend(c)
    for q in range(3):
        a = q * 2.1
        p = V((math.cos(a) * 0.03, 0.88, math.sin(a) * 0.03))
        k.lathe([(0.002, 0.0), (0.002, -0.08)], 3, wood, axis=V((0, 1, 0)), centre=p, cap0=None, cap1=None)
        k.sphere(p + V((0, -0.09, 0)), 0.013, 6, 4, pearl)
    return k


def bell_helm(brass, glass, rivet, lead):
    """The Drowner's diving-bell helm (world space, on Head): a round brass bell over the head with three round
    glass ports, rivet rows and a lead collar."""
    k = H.Kit()
    C = V((0.0, -0.012, 1.655))
    R = 0.186
    n = 16
    els = [-50, -32, -12, 8, 26, 44, 62, 78]
    rings = []
    for e in els:
        er = D(e)
        ring = []
        for q in range(n):
            a = 2 * math.pi * q / n
            ring.append(C + V((math.sin(a) * math.cos(er) * R, -math.cos(a) * math.cos(er) * R, math.sin(er) * R * 1.02)))
        rings.append(ring)

    def sl(i, j):
        if i in (1, 5):
            return rivet
        return brass
    k.rings(rings, sl, True, cap0=None, cap1=C + V((0, 0, R * 1.04)))
    # the collar: from the bell's lowest ring a lead skirt flaring onto the shoulders, then its rim
    def ring_at(r_x, r_y, z):
        return [V((math.sin(2 * math.pi * q / n) * r_x, C.y - math.cos(2 * math.pi * q / n) * r_y, z)) for q in range(n)]
    c0 = rings[0]
    c1 = ring_at(0.165, 0.150, C.z - R * 0.86)
    c2 = ring_at(0.225, 0.195, C.z - R * 1.02)
    k.rings([c0, c1, c2], lead, True)
    k.rings([c2, [p + V((0, 0, -0.028)) for p in c2]], lead, True)
    # the ports: front and both sides, a brass rim and pale glass
    for a_deg, e_deg, r in ((0, 4, 0.062), (90, 0, 0.045), (-90, 0, 0.045)):
        a, e = D(a_deg), D(e_deg)
        d = V((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        c = C + d * (R * 1.01)
        k.lathe([(r * 1.18, 0.0), (r * 1.18, 0.022), (r, 0.024)], 12, brass, axis=d, centre=c, cap0=None, cap1=None)
        k.lathe([(r, 0.012), (r * 0.6, 0.016)], 12, glass, axis=d, centre=c, cap0=None, cap1=c + d * 0.018)
    return k


def pearl_circlet(band, pearl, gem, n=12, r=(0.092, 0.108), z=1.715):
    """The Brine Hag's crown of brine pearls: a band round the brow, tall prongs each topped with a pearl."""
    k = H.Kit()
    C = V((0.0, -0.01, z))
    rings = []
    for dz in (-0.012, 0.012):
        ring = []
        for q in range(n * 2):
            a = 2 * math.pi * q / (n * 2)
            ring.append(C + V((math.sin(a) * r[0], -math.cos(a) * r[1], dz)))
        rings.append(ring)
    k.rings(rings, band, True)
    for q in range(n):
        a = 2 * math.pi * (q + 0.5) / n
        frontish = math.cos(a) > 0.2
        h = 0.07 if frontish else 0.045
        base = C + V((math.sin(a) * r[0] * 1.02, -math.cos(a) * r[1] * 1.02, 0.008))
        top = base + V((math.sin(a) * 0.012, -math.cos(a) * 0.012, h))
        k.lathe([(0.006, 0.0), (0.004, (top - base).length)], 4, band, axis=top - base, centre=base, cap0=None, cap1=None)
        k.sphere(top + V((0, 0, 0.006)), 0.013 if frontish else 0.01, 6, 4, gem if q % 3 == 0 else pearl)
    return k


def tentacle_arm(sess, sign, flesh, sucker, tip, extra=0.55, r0=0.07):
    """One of Naesa's tentacle arms (world space at rest) from the shoulder along the arm bones and on past the hand,
    curling at the tip, pale suckers along its underside. Returns (kit, weights function)."""
    pre = 'Left' if sign > 0 else 'Right'
    j = sess.joint
    sh, el, wr, ha = j(pre + 'UpperArm'), j(pre + 'LowerArm'), j(pre + 'Hand'), j(pre + 'Hand', 'tail')
    d = (ha - wr).normalized()
    base = [sh, sh.lerp(el, 0.35), sh.lerp(el, 0.7), el, el.lerp(wr, 0.35), el.lerp(wr, 0.7), wr, ha]
    # a slow S-wave across the arm's line (round 2: the arms read as long green sleeves)
    side = V((sign, 0.0, 0.0))
    pts = []
    for q, p in enumerate(base):
        s = q / (len(base) - 1)
        pts.append(p + side * (0.03 * math.sin(s * math.pi * 2.0)) + V((0, -0.02 * math.sin(s * math.pi), 0)))
    # on past the hand, curling forward, up and back in toward the body
    t = d
    p = pts[-1]
    curl = V((-0.25 * sign, -1.0, 0.55)).normalized()
    for q in range(6):
        t = (t + curl * (0.35 + 0.12 * q)).normalized()
        p = p + t * (extra / 6)
        pts.append(p)
    n = len(pts)
    radii = [r0 * (1.15 - 0.95 * (q / (n - 1)) ** 0.8) for q in range(n)]
    k = H.Kit()
    # suckers: pale cells down the inner (front) face, every other ring
    k.tube(pts, radii, 8, lambda i, jq: sucker if (jq in (0, 7) and i % 2 == 1 and i > 0) else
           (tip if i >= n - 3 else flesh), 'flat', 'apex', ref=V((0, -1, 0)))
    # where each point of the arm sits along the chain, for the weights
    seg = [(pre + 'UpperArm', sh, el), (pre + 'LowerArm', el, wr), (pre + 'Hand', wr, pts[-1])]

    def weights(p):
        best = None
        for bn, a, b in seg:
            c, tt = H.seg_closest(p, a, b)
            dist = (p - c).length
            if best is None or dist < best[0]:
                best = (dist, bn, tt)
        _, bn, tt = best
        w = {bn: 1.0}
        if bn == pre + 'LowerArm' and tt < 0.15:
            w = {bn: 0.5 + tt / 0.3, pre + 'UpperArm': 0.5 - tt / 0.3}
        if bn == pre + 'Hand' and tt < 0.1:
            w = {bn: 0.5 + tt / 0.2, pre + 'LowerArm': 0.5 - tt / 0.2}
        return w
    return k, weights

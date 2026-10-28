"""build_gear_warden.py — the Warden's Plate set, tiers F and S (docs/classes/warden.md §9, tools/blender/README.md §Gear).

Run:  blender -b -P tools/blender/hero/build_gear_warden.py -- [--quick] [--no-render]
Opens art/build/hero_species.blend when it exists (else hero_body.blend), builds every slot in both tiers on both
frames, renders the review set into art/renders/hero/gear/warden/, saves art/build/gear_warden.blend and writes
client/public/models/hero/gear_warden_<frame>.glb. Re-runnable end to end (gear_loft.py holds the machinery).

The look: a trapezoid — wide domed pauldrons, a barrel cuirass under a two-tone tabard (bone-white | oxblood), a
sallet with a swept tail; plate everywhere but the face. Palette slots: F wears raw metal (`metal`), rivets, no crest,
no glow; S wears the class finish (`cloth1`, slate blue in the review palette) with `trim` rims (the grade colour),
more lames, haute-pieces on the pauldrons, an oxblood crest (`cloth3`) and `glow` lines. The tabard is `cloth2` |
`cloth3`, straps and belt `leather`.
Pieces: helmet (sallet) · chest (cuirass, collar, pauldrons, rerebraces, couters, tabard, belt) · legs (skirt
lames, tassets, cuisses, poleyns) · boots (greaves, sabatons) · gloves (vambraces, bell cuffs, mitten gauntlets).
"""
import math
import os
import sys

import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gear_loft as L  # noqa: E402
import gear_lib as GL  # noqa: E402
from common import args, log  # noqa: E402

ARGS = args()
QUICK = bool(ARGS.get('quick'))
CLASS = 'warden'
S = L.SL
D = math.radians
SLOTS = ('helmet', 'chest', 'legs', 'boots', 'gloves')
SPINE = ['Hips', 'Spine', 'Chest', 'UpperChest', 'Neck']

PALETTES = {
    'F': {'cloth1': '#56708f', 'cloth2': '#e3dac6', 'cloth3': '#7a2b33', 'leather': '#6b3b2b', 'metal': '#8e959c',
          'trim': '#a3a3a3', 'glow': '#7fe3ff'},
    'S': {'cloth1': '#56708f', 'cloth2': '#e3dac6', 'cloth3': '#7a2b33', 'leather': '#6b3b2b', 'metal': '#5f6770',
          'trim': '#d24a3c', 'glow': '#7fe3ff'},
}

CUIRASS_OFF = 0.018
SKIRT_TOP = 0.995


def skirt_off(z):
    """The skirt's stand-off at height z (the tabard hangs 1 cm outside it)."""
    return 0.020 + 0.014 * L.smoothstep(SKIRT_TOP, 0.76, z)


def rim(tier, f_slot=None):
    return S['trim'] if tier == 'S' else (f_slot if f_slot is not None else S['metal'])


def plate(tier):
    return S['cloth1'] if tier == 'S' else S['metal']


def band_rows(field, ts, ths, offs):
    """Rows over a Field from (t, offset) pairs; t or offset may be fn(θ)."""
    return [[field.pt(t(th) if callable(t) else t, th, o(th) if callable(o) else o) for th in ths]
            for t, o in zip(ts, offs)]


def flange(field, t, ths, out=0.002):
    """A row on the skin: closes the gap under a plate edge so a hidden region never shows through."""
    return band_rows(field, [t], ths, [out])[0]


def mirror_for(sign, g):
    return g if sign > 0 else g.mirrored()


# ------------------------------------------------------------------ helmet: the sallet
def helmet(K, tier):
    H = K.head
    n = 18
    bs = L.circle(n)

    def emin(b):
        c = math.cos(b)
        return D(-34 + 33.5 * c + 17.5 * c * c)     # brow 17° · over the ears to -34° · the tail -50°

    def off(b, s):
        return 0.021 + 0.03 * max(0.0, -math.cos(b)) ** 1.5 * (1 - s) ** 2

    def at(s):
        return [H.pt(emin(b) + (D(88) - emin(b)) * s, b, off(b, s)) for b in bs]
    ss = [0.0, 0.18, 0.4, 0.62, 0.84]
    rows = [at(s) for s in ss]
    lip = [H.pt(emin(b) - D(1.5), b, off(b, 0) + 0.006) for b in bs]
    lip_in = [H.pt(emin(b) - D(1.5), b, off(b, 0) - 0.008) for b in bs]
    g = L.Grid()
    g.rows([lip_in, lip, rows[0]], rim(tier), closed=True)
    if tier == 'S':
        glow_row = [H.pt(emin(b) + D(4), b, off(b, 0.04) + 0.0015) for b in bs]
        g.rows([rows[0], glow_row], lambda i, j: S['glow'] if (j <= 3 or j >= n - 3) else plate(tier), closed=True)
        g.rows([glow_row] + rows[1:], plate(tier), closed=True)
    else:
        g.rows(rows, plate(tier), closed=True)
    g.fan(rows[-1], H.pt(D(90), 0.0, 0.021), plate(tier))
    if tier == 'F':
        for b in bs:
            if abs(math.cos(b)) > 0.85:
                continue
            e = emin(b) + D(6)
            g.stud(H.pt(e, b, off(b, 0.06) + 0.001), H.dir(e, b), 0.0045, S['metal'])
    else:
        # the crest: an oxblood fin from the brow over the crown to the tail
        path = [(D(40), 0.0), (D(60), 0.0), (D(76), 0.0), (D(88), 0.0), (D(76), math.pi), (D(58), math.pi),
                (D(34), math.pi)]
        heights = [0.012, 0.032, 0.045, 0.05, 0.045, 0.032, 0.012]
        base, top = [], []
        for (e, b), h in zip(path, heights):
            p = H.pt(e, b, 0.019)
            base.append(p)
            top.append(p + H.dir(e, b) * h)
        hw = Vector((0.007, 0, 0))
        crest = L.Grid()
        crest.rows([[p - hw for p in base], [p - hw for p in top], [p + hw for p in top], [p + hw for p in base]],
                   lambda i, j: S['trim'] if i == 1 else S['cloth3'], orient=Vector((0, -0.01, 1.62)))
        g.extend(crest)
        # cheek guards: a small plate over each cheekbone
        for side in (1, -1):
            cb = [side * D(a) for a in (38, 50, 62)]
            if side < 0:
                cb = list(reversed(cb))
            cr = [[H.pt(emin(b) + D(dd), b, off(b, 0) + 0.004 + 0.002 * k) for b in cb] for k, dd in enumerate((-16, -8, 0))]
            cg = L.Grid()
            cg.rows(cr, lambda i, j: S['trim'] if i == 0 else plate(tier))
            g.extend(cg)
    piece = K.fg.piece('helmet', g, K.f_head)
    return [L.Part('sallet', piece, rigid='Head', clear=0.012, over=('chest.F', 'chest.S'), gap=0.004)], []


# ------------------------------------------------------------------ chest
def cuirass(K, tier):
    T = K.torso
    n = 20 if tier == 'S' else 18
    ths = L.circle(n)
    zb = 0.93

    def ztop(th):
        # armholes at 1.30 m; high at the neckline in front, and behind it stays high further round so the shoulder
        # blades are covered up to the pauldrons' back edges (round 3: see-through gaps there)
        c = math.cos(th)
        if c >= 0:
            return 1.30 + 0.132 * c * c
        return 1.30 + 0.144 * (1 - abs(math.sin(th)) ** 2.5)

    def off(th):
        c = math.cos(th)
        o = CUIRASS_OFF + 0.004 * max(0.0, c)
        if tier == 'S' and c > 0 and abs(math.sin(th)) < 0.16:
            o += 0.007 * (1 - abs(math.sin(th)) / 0.16)     # the keel down the front
        return o

    ss = [0.0, 0.17, 0.37, 0.58, 0.8, 1.0]
    rows = [[T.pt(K.tz(zb + (ztop(th) - zb) * s), th, off(th)) for th in ths] for s in ss]
    top_lip = [T.pt(K.tz(ztop(th) + 0.004), th, off(th) + 0.006) for th in ths]
    top_fl = [T.pt(K.tz(ztop(th) + 0.004), th, 0.002) for th in ths]
    bot_lip = [T.pt(K.tz(zb - 0.012), th, off(th) + 0.007) for th in ths]
    bot_in = [T.pt(K.tz(zb - 0.012), th, off(th) - 0.004) for th in ths]
    g = L.Grid()
    g.rows([bot_in, bot_lip, rows[0]], rim(tier), closed=True)
    g.rows(rows, plate(tier), closed=True)
    g.rows([rows[-1], top_lip, top_fl], rim(tier), closed=True)
    return g


def collar(K, tier):
    """A low gorget that spreads over the shoulder tops (under the pauldrons) and stands up round the neck."""
    T = K.torso
    n = 14
    ths = L.circle(n)

    def ztop(th):
        return 1.468 + 0.022 * (1 - math.cos(th)) / 2

    rows = band_rows(T, [K.tz(1.405), K.tz(1.435), lambda th: K.tz(ztop(th) - 0.012), lambda th: K.tz(ztop(th))], ths,
                     [0.022, 0.019, 0.016, 0.016])
    lip = band_rows(T, [lambda th: K.tz(ztop(th) + 0.006)] * 2, ths, [0.020, 0.008])
    g = L.Grid()
    g.rows(rows, plate(tier), closed=True)
    g.rows([rows[-1]] + lip, rim(tier), closed=True)
    return g


def pauldron_left(K, tier):
    P, A = K.pauld, K.uarm
    n = 14
    bs = L.circle(n)
    SC = 1.1        # the dome a size larger than the shoulder: the Warden's trapezoid

    def eedge(b):
        return D(4 - 9 * math.sin(b) - 7 * max(0.0, -math.cos(b)))     # lower behind, over the shoulder blade

    def off(s, b=0.0):
        # thicker over the crown, and the outer edge flares away from the arm
        return 0.026 + 0.012 * s + 0.014 * max(0.0, math.sin(b)) * (1 - s) ** 2

    def at(s, b, extra=0.0):
        return P.pt(eedge(b) + (D(88) - eedge(b)) * s, b, off(s, b) + extra, SC)
    ss = [0.0, 0.3, 0.33, 0.62, 0.86] if tier == 'S' else [0.0, 0.32, 0.62, 0.86]
    rows = [[at(s, b) for b in bs] for s in ss]
    lip = [P.pt(eedge(b) - D(2), b, off(0, b) + 0.006, SC) for b in bs]
    lip_in = [P.pt(eedge(b) - D(2), b, off(0, b) - 0.014, SC) for b in bs]
    g = L.Grid()
    g.rows([lip_in, lip, rows[0]], rim(tier), closed=True)
    if tier == 'S':
        # a glow line across the outer face of the dome
        g.rows(rows, lambda i, j: S['glow'] if (i == 1 and 1 <= j <= 6) else plate(tier), closed=True)
    else:
        g.rows(rows, plate(tier), closed=True)
    g.fan(rows[-1], P.pt(D(90), 0.0, off(1.0), SC), plate(tier))
    # lames on the upper arm's outer side, tucked under the cap's edge
    outer = A.theta_of((1.0, 0.0, -0.35))
    lth = [outer + D(a) for a in np.linspace(-85, 85, 6)]
    for k in range(2 if tier == 'S' else 1):
        t0, t1 = 0.18 + 0.12 * k, 0.36 + 0.12 * k
        o0, o1 = 0.021 + 0.003 * k, 0.028 + 0.003 * k
        lr = band_rows(A, [t0, t0, t1, t1 + 0.012, t1 + 0.012], lth, [o0 - 0.007, o0, o1, o1 + 0.005, o1 - 0.009])
        lg = L.Grid()
        lg.rows(lr[:3], plate(tier))
        lg.rows(lr[2:], rim(tier))
        g.extend(lg)
    if tier == 'S':
        # the haute-piece: an upright flange on the inner crown that guards the neck (a strong 200-px silhouette)
        hb = L.arc(214, 326, 6)
        base = [P.pt(D(46), b, off(0.4, b), SC) for b in hb]
        top = [p + Vector((-0.012, 0.0, 0.042 - 0.018 * abs(math.cos(b - D(270))) ** 2)) for p, b in zip(base, hb)]
        t_ = Vector((0.006, 0, 0))
        hp = L.Grid()
        hp.rows([[p - t_ for p in base], [p - t_ for p in top], [p + t_ for p in top], [p + t_ for p in base]],
                lambda i, j: S['trim'] if i == 1 else plate(tier), orient=Vector((0.165, 0.005, 1.30)))
        g.extend(hp)
    else:
        for b in L.arc(30, 150, 5):
            e = eedge(b) + D(10)
            g.stud(P.pt(e, b, off(0.1, b) + 0.001, SC), P.dir(e, b), 0.0045, S['metal'])
    return g


def rerebrace_left(K, tier):
    A = K.uarm
    ths = L.circle(10)
    ts = [0.06, 0.32, 0.62, 0.95]
    rows = band_rows(A, ts, ths, [0.013] * 4)
    g = L.Grid()
    g.rows([flange(A, 0.05, ths)] + rows, plate(tier), closed=True)
    g.rows([rows[-1]] + band_rows(A, [0.97, 0.97], ths, [0.019, 0.006]), rim(tier), closed=True)
    return g


def couter_left(K, tier):
    A = K.uarm
    back = A.theta_of((0.0, 1.0, 0.0))
    span = 78 if tier == 'S' else 64
    ths = [back + D(a) for a in np.linspace(-span, span, 6)]
    ts = [0.84, 0.95, 1.05, 1.15]
    rows = band_rows(A, ts, ths, [0.017, 0.025, 0.025, 0.017])
    g = L.Grid()
    g.rows(rows, plate(tier))
    g.rows([band_rows(A, [ts[0] - 0.02], ths, [0.012])[0], rows[0]], rim(tier))
    g.rows([rows[-1], band_rows(A, [ts[-1] + 0.02], ths, [0.012])[0]], rim(tier))
    if tier == 'S':
        out = A.theta_of((1.0, 0.0, -0.3))
        fth = [out + D(a) for a in np.linspace(-28, 28, 4)]
        fr = band_rows(A, [0.9, 1.0, 1.1], fth, [0.028, 0.034, 0.028])
        fan = L.Grid()
        fan.rows(fr, plate(tier))
        fan.rows([fr[1], [p + (p - A.centre(1.0)).normalized() * 0.004 for p in fr[1]]], S['trim'])
        g.extend(fan)
    return g


def tabard(K, tier):
    """The two-tone tabard — wearer's right bone-white, left oxblood — to above the knee in front, to the seat behind."""
    T = K.torso

    def off(z, front=True):
        if z >= 0.95:
            return CUIRASS_OFF + 0.012 + (0.004 if front else 0.004 * L.smoothstep(1.15, 1.30, z))
        if z >= 0.90:
            k = (0.95 - z) / 0.05
            return (CUIRASS_OFF + 0.012) * (1 - k) + (skirt_off(z) + 0.011) * k
        return skirt_off(z) + 0.011

    def pale(i, j):
        return S['cloth2'] if j < 3 else S['cloth3']

    def bpale(i, j):
        return S['cloth3'] if j < 3 else S['cloth2']

    g = L.Grid()
    ths = [D(a) for a in np.linspace(-33, 33, 7)]
    # rows close enough to follow the cuirass's curve (round 3: the plate showed through a flat facet)
    zs = [1.395, 1.33, 1.27, 1.20, 1.13, 1.02, 0.95, 0.86, 0.76, 0.66, 0.565]
    rows = [[T.pt(K.tz(z), th, off(z)) for th in ths] for z in zs]
    g.rows(rows, pale)
    hem = [T.pt(K.tz(zs[-1] - 0.025), th, off(zs[-1]) + 0.002) for th in ths]
    g.rows([rows[-1], hem], lambda i, j: S['trim'] if tier == 'S' else pale(i, j))
    bths = [math.pi + D(a) for a in np.linspace(-30, 30, 7)]
    bzs = [1.40, 1.35, 1.30, 1.25, 1.15, 1.05, 0.95, 0.88, 0.80]
    brows = [[T.pt(K.tz(z), th, off(z, False)) for th in bths] for z in bzs]
    g.rows(brows, bpale)
    bhem = [T.pt(K.tz(bzs[-1] - 0.022), th, off(bzs[-1], False) + 0.002) for th in bths]
    g.rows([brows[-1], bhem], lambda i, j: S['trim'] if tier == 'S' else bpale(i, j))
    if tier == 'S':
        c = T.pt(K.tz(1.25), 0.0, off(1.25) + 0.003)
        nrm = T.dir(0.0)
        ux, uz = Vector((1, 0, 0)), Vector((0, 0, 1))
        pts = [c + uz * 0.05, c + ux * 0.032, c - uz * 0.05, c - ux * 0.032]
        g.poly(pts, [(0, 1, 2, 3)], S['glow'], c - nrm * 0.05)
        inner = [c + (p - c) * 0.5 + nrm * 0.0015 for p in pts]
        g.poly(inner, [(0, 1, 2, 3)], S['trim'], c - nrm * 0.05)
    # single-sided, like every cloth panel here: a second, inward-facing layer showed its outline hull through the
    # front (round 2), and from behind the panel's back reads dark through the outline anyway
    return g


def belt(K, tier):
    T = K.torso
    ths = L.circle(16)

    def off(th):
        return CUIRASS_OFF + (0.019 if abs(math.cos(th)) > math.cos(D(36)) else 0.010)
    zs = [0.972, 0.99, 1.012, 1.03]
    rows = [[T.pt(K.tz(z), th, off(th) + (0.002 if 0 < k < 3 else 0.0)) for th in ths] for k, z in enumerate(zs)]
    g = L.Grid()
    g.rows(rows, S['leather'], closed=True)
    c = T.pt(K.tz(1.001), 0.0, off(0.0) + 0.006)
    g.box(c, (0.024, 0, 0), (0, 0.006, 0), (0, 0, 0.022), S['trim'] if tier == 'S' else S['metal'])
    return g


def chest(K, tier):
    fg = K.fg
    over_legs = ('legs.F', 'legs.S')
    tab_sel = fg.fsel(['chest', 'belly', 'thighs'], where=lambda c: np.abs(c[:, 0]) < 0.2)
    tab_allow = SPINE + ['LeftUpperLeg', 'RightUpperLeg']
    parts = [L.Part('cuirass', fg.piece('cuirass', cuirass(K, tier), K.f_torso), allow=SPINE, smooth=2, clear=0.012,
                    over=over_legs, gap=0.004),
             L.Part('tabard', fg.piece('tabard', tabard(K, tier), tab_sel), allow=tab_allow, smooth=3, clear=0.010,
                    over=('cuirass',) + over_legs, gap=0.006, reach=0.06),
             L.Part('collar', fg.piece('collar', collar(K, tier), fg.fsel(['neck', 'chest'])),
                    allow=['Chest', 'UpperChest', 'Neck'], smooth=2, clear=0.010, over=('cuirass', 'tabard'), gap=0.003)]
    for sd, sign in (('L', 1), ('R', -1)):
        bones = L.side_bones(['LeftShoulder', 'LeftUpperArm', 'LeftLowerArm'], sign)
        parts.append(L.Part('rere_' + sd, fg.piece('rere_' + sd, mirror_for(sign, rerebrace_left(K, tier)),
                                                  K.side(sign, ['upperArms', 'chest'], xmin=0.10)),
                            smooth=1, clear=0.008, over=('gloves.F', 'gloves.S'), gap=0.003))
        parts.append(L.Part('couter_' + sd, fg.piece('couter_' + sd, mirror_for(sign, couter_left(K, tier)),
                                                    K.side(sign, ['upperArms', 'forearms'], xmin=0.10)),
                            allow=bones[1:], smooth=4, clear=0.012, over=('rere_' + sd, 'gloves.F', 'gloves.S'), gap=0.004))
    parts.append(L.Part('belt', fg.piece('belt', belt(K, tier), K.f_torso), allow=SPINE, smooth=2, clear=0.012,
                        over=('cuirass', 'tabard') + over_legs, gap=0.003))
    for sd, sign in (('L', 1), ('R', -1)):
        bones = L.side_bones(['LeftShoulder', 'LeftUpperArm'], sign)
        # the dome follows the upper arm at most halfway, so an arm raised overhead lifts it without burying the head
        parts.append(L.Part('pauldron_' + sd, fg.piece('pauldron_' + sd, mirror_for(sign, pauldron_left(K, tier)),
                                                      K.side(sign, ['chest', 'upperArms', 'neck'], xmin=0.03)),
                            allow=bones + ['UpperChest'], smooth=8, clear=0.016, cap={bones[1]: 0.5},
                            over=('collar', 'cuirass', 'rere_' + sd), gap=0.005, reach=0.06))
    return parts, ['chest', 'upperArms']


# ------------------------------------------------------------------ legs
def skirt(K, tier):
    T = K.torso
    ths = L.circle(16)
    lames = [(0.995, 0.905), (0.915, 0.83)] + ([(0.84, 0.765)] if tier == 'S' else [])
    g = L.Grid()
    for k, (z0, z1) in enumerate(lames):
        o0, o1 = skirt_off(z0) - (0.003 if k else 0.0), skirt_off(z1)
        r0 = [T.pt(K.tz(z0), th, o0) for th in ths]
        r1 = [T.pt(K.tz(z1), th, o1) for th in ths]
        lip = [T.pt(K.tz(z1 - 0.006), th, o1 + 0.005) for th in ths]
        g.rows([r0, r1], plate(tier), closed=True)
        g.rows([r1, lip], rim(tier), closed=True)
    if tier == 'F':
        for th in L.circle(8, 22.5):
            g.stud(T.pt(K.tz(0.95), th, skirt_off(0.95) + 0.001), T.dir(th), 0.0045, S['metal'])
    return g


def cuisse_left(K, tier):
    A = K.thigh
    ths = L.circle(10)
    ts = [0.10, 0.30, 0.52, 0.74, 0.985]

    def off(t, th):
        o = 0.014 + 0.003 * L.smoothstep(0.8, 0.985, t)
        if tier == 'S' and math.cos(th) > 0 and abs(math.sin(th)) < 0.2:
            o += 0.005
        return o
    rows = [[A.pt(t, th, off(t, th)) for th in ths] for t in ts]
    g = L.Grid()
    g.rows([flange(A, 0.09, ths)] + rows, plate(tier), closed=True)
    g.rows([rows[-1]] + band_rows(A, [1.0, 1.0], ths, [0.020, 0.002]), rim(tier), closed=True)
    return g


def tasset_left(K, tier):
    A = K.thigh
    c = A.theta_of((0.55, -1.0, 0.0))
    ths = [c + D(a) for a in np.linspace(-60, 62, 5)]
    g = L.Grid()
    plates = [(0.02, 0.27), (0.22, 0.47)] if tier == 'S' else [(0.02, 0.42)]
    for k, (t0, t1) in enumerate(plates):
        o0, o1 = 0.024 + 0.003 * k, 0.028 + 0.003 * k
        rows = band_rows(A, [t0, t0, t1], ths, [o0 - 0.008, o0, o1])
        lip = band_rows(A, [t1 + 0.012, t1 + 0.012], ths, [o1 + 0.005, o1 - 0.009])
        g.rows(rows, plate(tier))
        g.rows([rows[-1]] + lip, rim(tier))
        if tier == 'F':
            for th in (ths[1], ths[3]):
                g.stud(A.pt(t0 + 0.05, th, o0 + 0.001), A.dir(th), 0.004, S['metal'])
    return g


def poleyn_left(K, tier):
    A = K.thigh
    front = A.theta_of((0.0, -1.0, 0.0))
    ths = [front + D(a) for a in np.linspace(-74, 74, 6)]
    ts = [0.87, 0.95, 1.05, 1.13]
    rows = band_rows(A, ts, ths, [0.021, 0.029, 0.029, 0.021])
    g = L.Grid()
    g.rows(rows, plate(tier))
    g.rows([band_rows(A, [ts[0] - 0.015], ths, [0.013])[0], rows[0]], rim(tier))
    g.rows([rows[-1], band_rows(A, [ts[-1] + 0.015], ths, [0.013])[0]], rim(tier))
    outer = A.theta_of((1.0, 0.0, 0.0))
    if tier == 'S':
        wth = [outer + D(a) for a in np.linspace(-26, 26, 4)]
        wr = band_rows(A, [0.92, 1.0, 1.08], wth, [0.031, 0.038, 0.031])
        wg = L.Grid()
        wg.rows(wr, plate(tier))
        wg.rows([wr[1], [p + (p - A.centre(1.0)).normalized() * 0.004 for p in wr[1]]], S['trim'])
        g.extend(wg)
        g.stud(A.pt(1.0, front, 0.030), A.dir(front), 0.008, S['glow'])
    else:
        g.stud(A.pt(1.0, front, 0.030), A.dir(front), 0.006, S['metal'])
    return g


def legs(K, tier):
    fg = K.fg
    parts = []
    for sd, sign in (('L', 1), ('R', -1)):
        bones = L.side_bones(['LeftUpperLeg', 'LeftLowerLeg'], sign)
        thigh = K.side(sign, ['thighs'])
        parts.append(L.Part('cuisse_' + sd, fg.piece('cuisse_' + sd, mirror_for(sign, cuisse_left(K, tier)), thigh),
                            smooth=1, clear=0.010, over=('boots.F', 'boots.S'), gap=0.004))
        parts.append(L.Part('tasset_' + sd, fg.piece('tasset_' + sd, mirror_for(sign, tasset_left(K, tier)), thigh),
                            allow=['Hips', bones[0]], smooth=4, clear=0.016, over=('cuisse_' + sd,), gap=0.005))
        parts.append(L.Part('poleyn_' + sd, fg.piece('poleyn_' + sd, mirror_for(sign, poleyn_left(K, tier)),
                                                    K.side(sign, ['thighs', 'shins'])),
                            allow=bones, smooth=4, clear=0.015, over=('cuisse_' + sd, 'boots.F', 'boots.S'), gap=0.004))
    parts.append(L.Part('skirt', fg.piece('skirt', skirt(K, tier), fg.fsel(['belly', 'thighs'])), smooth=3, clear=0.015,
                        over=('tasset_L', 'tasset_R', 'cuisse_L', 'cuisse_R'), gap=0.004, reach=0.06))
    return parts, ['thighs']


# ------------------------------------------------------------------ boots
def greave_left(K, tier):
    A = K.shin
    ths = L.circle(10)

    def off(t, th):
        o = 0.012
        if tier == 'S' and math.cos(th) > 0 and abs(math.sin(th)) < 0.2:
            o += 0.005
        return o
    ts = [-0.04, 0.3, 0.62, 0.88]
    rows = [[A.pt(t, th, off(t, th)) for th in ths] for t in ts]
    bell = band_rows(A, [0.99], ths, [0.024])
    g = L.Grid()
    g.rows([flange(A, -0.05, ths), band_rows(A, [-0.05], ths, [0.016])[0], rows[0]], rim(tier), closed=True)
    g.rows(rows + bell, plate(tier), closed=True)
    g.rows([bell[0]] + band_rows(A, [1.01, 1.01], ths, [0.029, 0.012]), rim(tier), closed=True)
    return g


def sabaton_left(K, tier):
    F = K.foot
    n = 10
    ths = L.circle(n)
    lames = 3 if tier == 'S' else 2
    spec = [(0.0, 0.010), (0.2, 0.010)]
    lam_t = np.linspace(0.38, 0.86, lames + 1)
    for k in range(lames):
        spec += [(lam_t[k] + 0.01, 0.009), (lam_t[k + 1] - 0.015, 0.0135)]
    spec += [(0.95, 0.009)]
    floor_z = -0.003

    def P(t, th, o):
        p = F.pt(t, th, o if math.cos(th) > -0.3 else 0.006)
        if p.z < floor_z:
            p.z = floor_z
        return p
    rows = [[P(t, th, o) for th in ths] for t, o in spec]

    def slot(i, j):
        if math.cos(ths[j]) < -0.55:
            return S['leather']
        if tier == 'S' and i >= 2 and (i - 2) % 2 == 1 and i < len(spec) - 1:
            return S['trim']
        return plate(tier)
    g = L.Grid()
    g.rows(rows, slot, closed=True)
    tip = F.pt(1.03, 0.0, 0.0)
    tip.z = max(tip.z, 0.012)
    g.fan(rows[-1], tip, lambda j: S['leather'] if math.cos(ths[j]) < -0.55 else plate(tier))
    heel = F.pt(-0.04, 0.0, 0.0)
    heel.z = 0.03
    g.fan(rows[0], heel, lambda j: S['leather'] if math.cos(ths[j]) < -0.55 else plate(tier))
    return g


def boots(K, tier):
    fg = K.fg
    parts = []
    for sd, sign in (('L', 1), ('R', -1)):
        parts.append(L.Part('sabaton_' + sd, fg.piece('sabaton_' + sd, mirror_for(sign, sabaton_left(K, tier)),
                                                     K.side(sign, ['feet'])), smooth=1, clear=0.006))
        parts.append(L.Part('greave_' + sd, fg.piece('greave_' + sd, mirror_for(sign, greave_left(K, tier)),
                                                    K.side(sign, ['shins', 'feet'])),
                            smooth=1, clear=0.009, over=('sabaton_' + sd,), gap=0.004))
    return parts, ['shins', 'feet']


# ------------------------------------------------------------------ gloves
def vambrace_left(K, tier):
    A = K.farm
    ths = L.circle(8)
    rows = band_rows(A, [-0.04, 0.35, 0.74], ths, [0.012] * 3)
    g = L.Grid()
    g.rows([flange(A, -0.05, ths), band_rows(A, [-0.05], ths, [0.016])[0], rows[0]], rim(tier), closed=True)
    g.rows(rows, plate(tier), closed=True)
    return g


def cuff_left(K, tier):
    A = K.farm
    ths = L.circle(10)
    spec = [(0.58, 0.036), (0.75, 0.027), (0.9, 0.017), (1.04, 0.011)]
    if tier == 'S':
        spec = spec[:1] + [(0.62, 0.0345), (0.645, 0.0335)] + spec[1:]
    rows = band_rows(A, [t for t, _ in spec], ths, [o for _, o in spec])
    lip = band_rows(A, [0.585, 0.575], ths, [0.016, 0.042])
    g = L.Grid()
    g.rows(lip + [rows[0]], rim(tier), closed=True)
    if tier == 'S':
        g.rows(rows, lambda i, j: S['glow'] if i == 1 else plate(tier), closed=True)
    else:
        g.rows(rows, plate(tier), closed=True)
    return g


def hand_left(K, tier):
    Hf = K.hand
    ths = L.circle(8)
    g = L.Grid()
    g.rows(band_rows(Hf, [0.0, 0.5, 0.98], ths, [0.009, 0.010, 0.009]), plate(tier), closed=True)
    return g


def mitten_left(K, tier):
    M = K.fing
    ths = L.circle(8)
    rows = band_rows(M, [-0.08, 0.25, 0.55, 0.8, 0.95], ths, [0.008, 0.007, 0.007, 0.006, 0.005])
    g = L.Grid()
    g.rows(rows, lambda i, j: S['trim'] if (tier == 'S' and i == 0) else plate(tier), closed=True)
    g.fan(rows[-1], M.centre(1.02), plate(tier))
    return g


def thumb_left(K, tier):
    Tm = K.thumb
    ths = L.circle(6)
    rows = band_rows(Tm, [-0.25, 0.4, 0.92], ths, [0.007, 0.006, 0.004])
    g = L.Grid()
    g.rows(rows, plate(tier), closed=True)
    g.fan(rows[-1], Tm.centre(1.02), plate(tier))
    return g


def gloves(K, tier):
    fg = K.fg
    parts = []
    for sd, sign in (('L', 1), ('R', -1)):
        pre = 'Left' if sign > 0 else 'Right'
        fb = ['%s%s%s' % (pre, f, p) for f in ('Index', 'Middle', 'Ring', 'Little') for p in ('Proximal', 'Intermediate', 'Distal')]
        tb = ['%sThumb%s' % (pre, p) for p in ('Proximal', 'Intermediate', 'Distal')]
        parts += [
            L.Part('vamb_' + sd, fg.piece('vamb_' + sd, mirror_for(sign, vambrace_left(K, tier)),
                                          K.side(sign, ['forearms', 'upperArms'])), smooth=1, clear=0.009),
            L.Part('hand_' + sd, fg.piece('hand_' + sd, mirror_for(sign, hand_left(K, tier)),
                                          K.side(sign, ['hands'], bones=[pre + 'Hand', pre + 'ThumbProximal'])),
                   smooth=1, clear=0.006),
            L.Part('mitten_' + sd, fg.piece('mitten_' + sd, mirror_for(sign, mitten_left(K, tier)),
                                            K.side(sign, ['hands'], bones=fb)),
                   smooth=1, clear=0.004, over=('hand_' + sd,), gap=0.002, reach=0.02),
            L.Part('thumb_' + sd, fg.piece('thumb_' + sd, mirror_for(sign, thumb_left(K, tier)),
                                           K.side(sign, ['hands'], bones=tb)), smooth=1, clear=0.004),
            L.Part('cuff_' + sd, fg.piece('cuff_' + sd, mirror_for(sign, cuff_left(K, tier)),
                                          K.side(sign, ['forearms', 'hands'], bones=[pre + 'LowerArm', pre + 'Hand'])),
                   allow=[pre + 'LowerArm', pre + 'Hand'], smooth=3, clear=0.010, over=('vamb_' + sd, 'hand_' + sd),
                   gap=0.004),
        ]
    return parts, ['hands', 'forearms']


BUILDERS = {'boots': boots, 'legs': legs, 'gloves': gloves, 'chest': chest, 'helmet': helmet}
ORDER = ('boots', 'legs', 'gloves', 'chest', 'helmet')     # inner layers first: later pieces clear the earlier ones


def build(fg, K):
    objects = {f: [] for f in L.FRAMES}
    by = {(t, f): {} for t in ('F', 'S') for f in L.FRAMES}
    for slot in ORDER:
        for tier in ('F', 'S'):
            parts, hides = BUILDERS[slot](K, tier)
            tris = sum(GL.tri_count_piece(p.piece) for p in parts)
            for frame in L.FRAMES:
                name = 'gear_%s_%s_%s.%s' % (CLASS, slot, tier, frame)
                ob = fg.make(name, parts, frame, {'slot': slot, 'tier': tier, 'class': CLASS, 'hides': list(hides)},
                             register='%s.%s' % (slot, tier))
                objects[frame].append(ob)
                by[(tier, frame)][slot] = ob
            fg.tris['%s_%s' % (slot, tier)] = tris
            log('%s %s %s: %d tris, hides %s' % (CLASS, slot, tier, tris, hides))
    return objects, by


def review(objects, by):
    rv = L.Review(CLASS, PALETTES, quick=QUICK)
    for (tier, frame), d in by.items():
        for ob in d.values():
            rv.look(ob, tier)
    sets = {(t, f): [by[(t, f)][s] for s in SLOTS] for t in ('F', 'S') for f in L.FRAMES}
    rv.set_views(sets)
    for f in L.FRAMES:
        rv.gear_sheet(f, {t: by[(t, f)] for t in ('F', 'S')}, SLOTS)
    poses = L.test_poses()
    for t in ('F', 'S'):
        for f in L.FRAMES:
            rv.poses(f, t, sets[(t, f)], poses)
    fists = L._mir(L.FIST)
    for t in ('F', 'S'):
        rv.closeups('broad', t, sets[(t, 'broad')], 'joints_%s_broad.png' % t, [
            ((-0.9, -1.1, 1.75), (0.0, 0.0, 1.45), 45, poses['overhead']),
            ((1.1, -0.9, 1.6), (0.15, 0.0, 1.35), 45, poses['overhead']),
            ((-1.2, -1.4, 0.9), (0.0, -0.1, 0.7), 45, poses['lunge']),
            ((-1.3, 1.0, 0.9), (0.1, 0.0, 0.55), 45, poses['crouch']),
            ((0.85, -0.55, 0.98), (0.40, -0.02, 0.86), 50, fists),
            ((0.35, 0.95, 1.55), (0.0, 0.04, 1.32), 45, None),
        ])
    shown = rv.species('broad', sets)
    log('species renders:', shown or 'none (no species keys on the body yet)')
    rv.finish()
    log('renders in', rv.out)


def main():
    L.open_source()
    bodies = GL.load_bodies()
    fg = L.Forge(bodies)
    K = L.Fields(fg)
    objects, by = build(fg, K)
    for t in ('F', 'S'):
        log('%s set %s: %d tris' % (CLASS, t, sum(fg.tris['%s_%s' % (s, t)] for s in SLOTS)))
    if not ARGS.get('no_render'):
        review(objects, by)
    sizes = L.save_and_export(CLASS, objects)
    log('exported', sizes)


main()

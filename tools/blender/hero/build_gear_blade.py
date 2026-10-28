"""build_gear_blade.py — the Blade's Mail set, tiers F and S (docs/classes/blade.md §9, tools/blender/README.md §Gear).

Run:  blender -b -P tools/blender/hero/build_gear_blade.py -- [--quick] [--no-render]
Opens art/build/hero_species.blend when it exists (else hero_body.blend), builds every slot in both tiers on both
frames, renders the review set into art/renders/hero/gear/blade/, saves art/build/gear_blade.blend and writes
client/public/models/hero/gear_blade_<frame>.glb. Re-runnable end to end (gear_loft.py holds the machinery).

The look: the leaner metal class — an open mail coif with a nasal bar, a hauberk to mid-thigh (split front and back,
cinched at a narrow waist), short mail sleeves over linen so the forearms stay bare, a leather baldric across the
chest, one spaulder on the lead (left) shoulder, mail chausses under leather thigh straps, buckled riding boots and
fingerless half-gauntlets. Palette slots: F wears raw mail (`metal`), plain leather, no glow; S wears blued mail in
the class finish (`cloth1`, charcoal in the review palette), `trim` hem bands and buckles (the grade colour), a
spangenhelm cap and knee cops in `metal`, and `glow` lines. The under-tunic is `cloth2`, straps and boots `leather`.
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
CLASS = 'blade'
S = L.SL
D = math.radians
SLOTS = ('helmet', 'chest', 'legs', 'boots', 'gloves')
SPINE = ['Hips', 'Spine', 'Chest', 'UpperChest', 'Neck']

PALETTES = {
    'F': {'cloth1': '#4a5466', 'cloth2': '#e6dfcd', 'cloth3': '#8c3a2c', 'leather': '#8a4f2c', 'metal': '#8f9398',
          'trim': '#a3a3a3', 'glow': '#ff9a5a'},
    'S': {'cloth1': '#4a5466', 'cloth2': '#e6dfcd', 'cloth3': '#8c3a2c', 'leather': '#8a4f2c', 'metal': '#7d858e',
          'trim': '#d24a3c', 'glow': '#ff9a5a'},
}


def mail(tier):
    return S['cloth1'] if tier == 'S' else S['metal']


def rim(tier, f_slot=None):
    return S['trim'] if tier == 'S' else (f_slot if f_slot is not None else S['metal'])


def band_rows(field, ts, ths, offs):
    return [[field.pt(t(th) if callable(t) else t, th, o(th) if callable(o) else o) for th in ths]
            for t, o in zip(ts, offs)]


def flange(field, t, ths, out=0.002):
    return band_rows(field, [t], ths, [out])[0]


def mirror_for(sign, g):
    return g if sign > 0 else g.mirrored()


def mail_off(z):
    """The hauberk's stand-off: close over the chest, cinched at the waist, out over the hips, flaring to the hem."""
    if z >= 1.12:
        return 0.011
    if z >= 1.06:
        return L.lerp(0.007, 0.011, (z - 1.06) / 0.06)
    if z >= 0.96:
        return 0.007
    if z >= 0.90:
        return L.lerp(0.012, 0.007, (z - 0.90) / 0.06)
    return 0.012 + 0.010 * L.smoothstep(0.90, 0.66, z)


# ------------------------------------------------------------------ helmet: an open coif with a nasal bar
def helmet(K, tier):
    fg = K.fg
    sel = fg.fsel(['head', 'neck', 'chest'], where=lambda c: (c[:, 2] > 1.30) & (np.abs(c[:, 0]) < 0.24))
    # the hood's envelope ignores the eyes and nose (round 3: the nose, dilated and smoothed, pushed the brow band out
    # into a visor; round 4: leaving out the chin too let the hood ride up over the mouth), the profile goes a quarter
    # of the way to convex so it hugs the throat (round 2: a bib), and smoothing evens the hem over collar and trapezius
    env = fg.fsel(['head', 'neck', 'chest'], where=lambda c: (c[:, 2] > 1.30) & (np.abs(c[:, 0]) < 0.24) & ~(
        (c[:, 1] < -0.08) & (c[:, 2] > 1.585) & (c[:, 2] < 1.665) & (np.abs(c[:, 0]) < 0.075)))
    C = L.Sphere(fg, (0, -0.012, 1.62), L.FRONT, L.UP, env, [D(e) for e in range(-72, 91, 4)], 40, smooth=4, dilate=0,
                 convex_cols=0.25)
    bs = [D(b) for b in (0, 12, 24, 36, 50, 66, 84, 104, 126, 152, 180, 208, 234, 256, 276, 294, 310, 324, 336, 348)]
    # the face opening: from the brow to just under the chin (round 1's opening stopped at the mouth: a bandit's mask)
    e_c, a, bf = D(-7.5), D(29), D(56)

    def half(b):
        x = math.atan2(math.sin(b), math.cos(b)) / bf
        return a * math.sqrt(max(0.0, 1 - x * x))

    def e_lo(b):
        return e_c - half(b)

    def e_hi(b):
        return e_c + half(b)
    e_bot = D(-50)

    def off(e):
        # 9 mm at the throat, 13 at the drape's hem, 13 over the skull (round 6: smoothing lowers the crown's envelope
        # and the scalp showed through the F hood between vertices)
        return 0.009 + 0.004 * L.smoothstep(D(-30), D(-50), e) + 0.004 * L.smoothstep(D(-20), D(10), e)

    def P(e, b, extra=0.0):
        return C.pt(e, b, off(e) + extra)
    lo = [[P(e_bot + (e_lo(b) - e_bot) * s, b) for b in bs] for s in (0.0, 0.35, 0.7, 1.0)]
    hi = [[P(e_hi(b) + (D(86) - e_hi(b)) * s, b) for b in bs] for s in (0.0, 0.25, 0.5, 0.75, 0.92)]
    opening = [half(b) > 1e-6 for b in bs]
    g = L.Grid()
    hem = [P(e_bot - D(2), b, 0.004) for b in bs]
    g.rows([hem, lo[0]], rim(tier, mail(tier)), closed=True)
    g.rows(lo, lambda i, j: S['trim'] if (tier == 'S' and i == 2 and opening[j]) else mail(tier), closed=True)
    g.rows(hi, lambda i, j: S['trim'] if (tier == 'S' and i == 0 and opening[j]) else mail(tier), closed=True)
    g.fan(hi[-1], P(D(90), 0.0), mail(tier))
    g.weld()
    coif = fg.piece('coif', g, sel)
    # the helm: a brow band (and at S a spangenhelm cap) with the nasal bar, rigid on the head
    h = L.Grid()
    band = [[P(e_hi(b) + D(d), b, 0.004) for b in bs] for d in (2, 9)]
    h.rows([[P(e_hi(b) + D(2), b, 0.0) for b in bs]] + band + [[P(e_hi(b) + D(9), b, 0.0) for b in bs]],
           rim(tier), closed=True)
    # the nasal follows the real brow-and-nose profile, 6 mm out: its own rays to the farthest head surface (the hood's
    # envelope leaves the nose out; round 5 placed the bar inside the nose and the clearance pass threw it sideways)
    path = [D(e) for e in (e_hi(0) / math.pi * 180 + 5, 16, 6, -4, -12)]
    nrm = [C.dir(e, 0.0) for e in path]
    ctr = []
    for e, n_ in zip(path, nrm):
        r = fg.far(C.c, n_, K.f_head)
        ctr.append(C.c + n_ * ((r if r is not None else C.radius(e, 0.0)) + 0.006))
    x = Vector((0.009, 0, 0))
    h.rows([[c - x - n_ * 0.005 for c, n_ in zip(ctr, nrm)], [c - x for c in ctr], [c + x for c in ctr],
            [c + x - n_ * 0.005 for c, n_ in zip(ctr, nrm)]], S['metal'], orient=Vector((0, -0.01, 1.62)))
    if tier == 'S':
        ribs = {0, 6, 10, 14}
        cap = [[P(e_hi(b) + D(9) + (D(88) - e_hi(b) - D(9)) * s, b, 0.008 + 0.010 * s * s) for b in bs]
               for s in (0.0, 0.35, 0.7, 0.92)]
        h.rows(cap, lambda i, j: S['trim'] if j in ribs else S['metal'], closed=True)
        h.fan(cap[-1], P(D(90), 0.0, 0.026), S['metal'])
        c0 = P(e_hi(0) + D(5.5), 0.0, 0.0055)
        n0 = C.dir(e_hi(0) + D(5.5), 0.0)
        ux, uz = Vector((1, 0, 0)), Vector((0, 0, 1))
        h.poly([c0 + uz * 0.012, c0 + ux * 0.016, c0 - uz * 0.012, c0 - ux * 0.016], [(0, 1, 2, 3)], S['glow'], c0 - n0 * 0.05)
    else:
        for b in (D(40), D(110), D(250), D(320)):
            e = e_hi(b) + D(5.5)
            h.stud(P(e, b, 0.005), C.dir(e, b), 0.004, S['metal'])
    helm = fg.piece('helm', h, K.f_head)
    return [L.Part('coif', coif, smooth=3, clear=0.008, over=('chest.F', 'chest.S'), gap=0.003),
            L.Part('helm', helm, rigid='Head', clear=0.010, over=('coif',), gap=0.002)], ['neck']


# ------------------------------------------------------------------ chest: the hauberk
TH_BODY = [3, 24, 48, 72, 96, 120, 144, 168, 177, 183, 192, 216, 240, 264, 288, 312, 336, 357]


def hauberk(K, tier):
    T = K.torso
    ths = [D(a) for a in TH_BODY]
    zs = [1.455, 1.40, 1.33, 1.24, 1.13, 1.03, 0.96, 0.88, 0.80, 0.73]
    rows = [[T.pt(K.tz(z), th, mail_off(z)) for th in ths] for z in zs]
    g = L.Grid()
    g.rows([flange(T, K.tz(1.46), ths)] + rows, mail(tier), closed=True)
    return g


def skirt_half(K, tier):
    """The left half of the hauberk's skirt below the slits (mirrored for the right): under the body's hem at the top,
    then the mail hem band (trim at S) and the linen under-tunic peeking below it."""
    T = K.torso
    ths = [D(a) for a in TH_BODY if 0 < a < 180]
    spec = [(0.77, -0.002), (0.70, 0.0), (0.665, 0.0)]
    rows = [[T.pt(K.tz(z), th, mail_off(z) + d) for th in ths] for z, d in spec]
    tunic = [[T.pt(K.tz(z), th, mail_off(0.665) - 0.004) for th in ths] for z in (0.665, 0.628)]
    g = L.Grid()
    g.rows(rows, lambda i, j: rim(tier, mail(tier)) if i == 1 else mail(tier))
    g.rows(tunic, S['cloth2'])
    return g


def sleeve_left(K, tier):
    A = K.uarm
    ths = L.circle(8)
    spec = [(-0.06, 0.002), (-0.04, 0.011), (0.30, 0.011), (0.64, 0.011), (0.68, 0.011), (0.68, 0.0075), (1.02, 0.0075),
            (1.04, 0.002)]
    rows = band_rows(A, [t for t, _ in spec], ths, [o for _, o in spec])
    g = L.Grid()

    def slot(i, j):
        if i >= 5:
            return S['cloth2']
        if i == 3:
            return rim(tier, mail(tier))
        return mail(tier)
    g.rows(rows, slot, closed=True)
    return g


def collar(K, tier):
    T = K.torso
    ths = L.circle(14)
    rows = band_rows(T, [K.tz(1.44), K.tz(1.48), K.tz(1.515)], ths, [0.016, 0.0145, 0.0155])
    lip = band_rows(T, [K.tz(1.522), K.tz(1.522)], ths, [0.018, 0.008])
    g = L.Grid()
    g.rows(rows, mail(tier), closed=True)
    g.rows([rows[-1]] + lip, rim(tier, mail(tier)), closed=True)
    return g


def ribbon(T, K, z0, th0, z1, th1, n, half_w, extra, slot):
    """A strap over the torso field from (z0, θ0) to (z1, θ1) (degrees), `half_w` tall, `extra` over the mail."""
    rows = [[], [], []]
    for k in range(n):
        s = k / (n - 1)
        z = L.lerp(z0, z1, s)
        th = D(L.lerp(th0, th1, s))
        o = mail_off(z) + extra
        rows[0].append(T.pt(K.tz(z - half_w), th, o))
        rows[1].append(T.pt(K.tz(z), th, o + 0.0025))
        rows[2].append(T.pt(K.tz(z + half_w), th, o))
    g = L.Grid()
    g.rows(rows, slot)
    return g


def baldric(K, tier):
    T = K.torso
    g = L.Grid()
    g.extend(ribbon(T, K, 1.38, 52, 0.985, -118, 10, 0.022, 0.006, S['leather']))
    g.extend(ribbon(T, K, 1.385, 76, 0.985, 242, 10, 0.022, 0.006, S['leather']))
    # the buckle on the chest, where the strap crosses the sternum
    s = 52 / 170.0
    z = L.lerp(1.38, 0.985, s)
    c = T.pt(K.tz(z), 0.0, mail_off(z) + 0.011)
    g.box(c, (0.016, 0, 0), (0, 0.004, 0), (0, 0, 0.016), rim(tier))
    if tier == 'S':
        for s in (0.12, 0.55, 0.75):
            z = L.lerp(1.38, 0.985, s)
            th = D(L.lerp(52, -118, s))
            g.stud(T.pt(K.tz(z), th, mail_off(z) + 0.0095), T.dir(th), 0.0045, S['trim'])
    return g


def spaulder_left(K, tier):
    P, A = K.pauld, K.uarm
    bs = L.circle(12)
    SC = 1.08       # one size up from the shoulder so the single spaulder reads at 200 px (round 1: a small flap)

    def eedge(b):
        return D(6 - 10 * math.sin(b))

    def off(s, b=0.0):
        return 0.022 + 0.010 * s + 0.010 * max(0.0, math.sin(b)) * (1 - s) ** 2
    ss = (0.0, 0.33, 0.37, 0.7, 0.9) if tier == 'S' else (0.0, 0.35, 0.7, 0.9)
    rows = [[P.pt(eedge(b) + (D(88) - eedge(b)) * s, b, off(s, b), SC) for b in bs] for s in ss]
    lip = [P.pt(eedge(b) - D(2), b, off(0, b) + 0.005, SC) for b in bs]
    lip_in = [P.pt(eedge(b) - D(2), b, off(0, b) - 0.012, SC) for b in bs]
    g = L.Grid()
    g.rows([lip_in, lip, rows[0]], rim(tier), closed=True)
    if tier == 'S':
        # an etched glow line across the outer face
        g.rows(rows, lambda i, j: S['glow'] if (i == 1 and 1 <= j <= 5) else S['metal'], closed=True)
    else:
        g.rows(rows, S['metal'], closed=True)
    g.fan(rows[-1], P.pt(D(90), 0.0, off(1.0), SC), S['metal'])
    outer = A.theta_of((1.0, 0.0, -0.35))
    lth = [outer + D(a) for a in np.linspace(-80, 80, 5)]
    for k in range(2 if tier == 'S' else 1):
        t0, t1 = 0.20 + 0.11 * k, 0.34 + 0.11 * k
        o0, o1 = 0.016 + 0.003 * k, 0.021 + 0.003 * k
        lr = band_rows(A, [t0, t0, t1, t1 + 0.012, t1 + 0.012], lth, [o0 - 0.006, o0, o1, o1 + 0.004, o1 - 0.008])
        lg = L.Grid()
        lg.rows(lr[:3], S['metal'])
        lg.rows(lr[2:], rim(tier))
        g.extend(lg)
    if tier == 'F':
        for b in L.arc(30, 150, 4):
            e = eedge(b) + D(9)
            g.stud(P.pt(e, b, off(0.1, b) + 0.001, SC), P.dir(e, b), 0.004, S["metal"])
    return g


def belt(K, tier):
    T = K.torso
    ths = L.circle(16)
    zs = [0.968, 0.985, 1.015, 1.032]
    rows = [[T.pt(K.tz(z), th, mail_off(z) + 0.004 + (0.002 if 0 < k < 3 else 0.0)) for th in ths] for k, z in enumerate(zs)]
    g = L.Grid()
    g.rows(rows, S['leather'], closed=True)
    c = T.pt(K.tz(1.0), 0.0, mail_off(1.0) + 0.0085)
    g.box(c, (0.02, 0, 0), (0, 0.005, 0), (0, 0, 0.02), rim(tier))
    return g


def chest(K, tier):
    fg = K.fg
    over_legs = ('legs.F', 'legs.S')
    parts = [L.Part('hauberk', fg.piece('hauberk', hauberk(K, tier), K.f_torso), smooth=2, clear=0.007,
                    over=over_legs, gap=0.003)]
    for sd, sign in (('L', 1), ('R', -1)):
        up = L.side_bones(['LeftUpperLeg'], sign)
        parts.append(L.Part('skirt_' + sd, fg.piece('skirt_' + sd, mirror_for(sign, skirt_half(K, tier)),
                                                   K.side(sign, ['thighs', 'belly'])),
                            allow=['Hips'] + up, smooth=2, clear=0.010, over=over_legs, gap=0.004))
        parts.append(L.Part('sleeve_' + sd, fg.piece('sleeve_' + sd, mirror_for(sign, sleeve_left(K, tier)),
                                                    K.side(sign, ['upperArms', 'forearms', 'chest'], xmin=0.10)),
                            smooth=1, clear=0.006, over=('hauberk',), gap=0.002, reach=0.03))
    parts += [
        L.Part('collar', fg.piece('collar', collar(K, tier), fg.fsel(['neck', 'chest'])), allow=['Chest', 'UpperChest', 'Neck'],
               smooth=2, clear=0.010, over=('hauberk',), gap=0.003),
        L.Part('baldric', fg.piece('baldric', baldric(K, tier), K.f_torso), allow=SPINE + ['LeftShoulder'], smooth=2,
               clear=0.010, over=('hauberk',), gap=0.003),
        L.Part('belt', fg.piece('belt', belt(K, tier), K.f_torso), allow=SPINE, smooth=2, clear=0.010,
               over=('hauberk', 'baldric'), gap=0.003),
        L.Part('spaulder', fg.piece('spaulder', spaulder_left(K, tier), K.side(1, ['chest', 'upperArms', 'neck'], xmin=0.03)),
               allow=['LeftShoulder', 'LeftUpperArm', 'UpperChest'], smooth=8, clear=0.014,
               over=('hauberk', 'sleeve_L', 'baldric', 'collar'), gap=0.004, reach=0.05),
    ]
    return parts, ['chest', 'upperArms', 'belly']


# ------------------------------------------------------------------ legs: mail chausses under leather thigh straps
def hoop(K, tier):
    T = K.torso
    ths = L.circle(16)
    rows = band_rows(T, [K.tz(z) for z in (1.0, 0.92, 0.86, 0.80)], ths, [0.007, 0.010, 0.011, 0.012])
    g = L.Grid()
    g.rows(rows, mail(tier), closed=True)
    return g


def chausse_left(K, tier):
    A = K.thigh
    ths = L.circle(10)
    spec = [(-0.01, 0.002), (0.0, 0.006), (0.25, 0.008), (0.5, 0.008), (0.75, 0.008), (1.0, 0.009), (1.12, 0.008),
            (1.13, 0.002)]
    rows = band_rows(A, [t for t, _ in spec], ths, [o for _, o in spec])
    g = L.Grid()
    g.rows(rows, mail(tier), closed=True)
    return g


def straps_left(K, tier):
    A = K.thigh
    ths = L.circle(10)
    g = L.Grid()
    outer = A.theta_of((1.0, 0.0, 0.0))
    for t0 in (0.63, 0.79):     # below the hauberk hem (round 1: the upper buckle poked through it)
        rows = band_rows(A, [t0, t0 + 0.035, t0 + 0.07], ths, [0.012, 0.0145, 0.012])
        sg = L.Grid()
        sg.rows(rows, S['leather'], closed=True)
        g.extend(sg)
        c = A.pt(t0 + 0.035, outer, 0.0175)
        n_ = A.dir(outer)
        g.box(c, n_.cross(A.axis).normalized() * 0.009, n_ * 0.003, A.axis * 0.011, rim(tier))
    return g


def knee_left(K, tier):
    A = K.thigh
    front = A.theta_of((0.0, -1.0, 0.0))
    ths = [front + D(a) for a in np.linspace(-62, 62, 5)]
    ts = [0.9, 1.0, 1.1]
    rows = band_rows(A, ts, ths, [0.016, 0.022, 0.016])
    g = L.Grid()
    g.rows(rows, S['metal'])
    g.rows([band_rows(A, [0.885], ths, [0.010])[0], rows[0]], S['trim'])
    g.rows([rows[-1], band_rows(A, [1.115], ths, [0.010])[0]], S['trim'])
    g.stud(A.pt(1.0, front, 0.0225), A.dir(front), 0.006, S['glow'])
    return g


def legs(K, tier):
    fg = K.fg
    parts = [L.Part('hoop', fg.piece('hoop', hoop(K, tier), fg.fsel(['belly', 'thighs'])), smooth=2, clear=0.005)]
    for sd, sign in (('L', 1), ('R', -1)):
        bones = L.side_bones(['LeftUpperLeg', 'LeftLowerLeg'], sign)
        sel = K.side(sign, ['thighs', 'shins'])
        parts.append(L.Part('chausse_' + sd, fg.piece('chausse_' + sd, mirror_for(sign, chausse_left(K, tier)), sel),
                            smooth=1, clear=0.005))
        parts.append(L.Part('straps_' + sd, fg.piece('straps_' + sd, mirror_for(sign, straps_left(K, tier)), sel),
                            smooth=1, clear=0.010, over=('chausse_' + sd,), gap=0.003))
        if tier == 'S':
            parts.append(L.Part('knee_' + sd, fg.piece('knee_' + sd, mirror_for(sign, knee_left(K, tier)), sel),
                                allow=bones, smooth=4, clear=0.012, over=('chausse_' + sd, 'boots.F', 'boots.S'), gap=0.004))
    return parts, ['thighs']


# ------------------------------------------------------------------ boots: buckled riding boots
def shaft_left(K, tier):
    A = K.shin
    ths = L.circle(10)
    spec = [(0.03, 0.002), (0.03, 0.019), (0.145, 0.019), (0.17, 0.019), (0.17, 0.010), (0.45, 0.010), (0.75, 0.010),
            (1.02, 0.012)]
    rows = band_rows(A, [t for t, _ in spec], ths, [o for _, o in spec])
    g = L.Grid()

    def slot(i, j):
        if tier == 'S' and i == 2:
            return S['trim']
        return S['leather']
    g.rows(rows, slot, closed=True)
    return g


def foot_left(K, tier):
    F = K.foot
    n = 10
    ths = L.circle(n)
    ts = [0.0, 0.25, 0.5, 0.75, 0.95]
    floor_z = -0.003

    def P(t, th):
        o = 0.008 if math.cos(th) > -0.3 else 0.006
        p = F.pt(t, th, o)
        if p.z < floor_z:
            p.z = floor_z
        return p
    rows = [[P(t, th) for th in ths] for t in ts]

    def slot(i, j):
        if tier == 'S' and i >= 3 and math.cos(ths[j]) > 0.0:
            return S['metal']          # the steel toe cap
        return S['leather']
    g = L.Grid()
    g.rows(rows, slot, closed=True)
    tip = F.pt(1.03, 0.0, 0.0)
    tip.z = max(tip.z, 0.012)
    g.fan(rows[-1], tip, lambda j: S['metal'] if (tier == 'S' and math.cos(ths[j]) > 0.0) else S['leather'])
    heel = F.pt(-0.04, 0.0, 0.0)
    heel.z = 0.03
    g.fan(rows[0], heel, S['leather'])
    return g


def boot_straps_left(K, tier):
    A = K.shin
    ths = L.circle(10)
    outer = A.theta_of((1.0, 0.0, 0.0))
    g = L.Grid()
    for t0 in (0.40, 0.66):
        rows = band_rows(A, [t0, t0 + 0.03, t0 + 0.06], ths, [0.0135, 0.016, 0.0135])
        sg = L.Grid()
        sg.rows(rows, S['leather'], closed=True)
        g.extend(sg)
        c = A.pt(t0 + 0.03, outer, 0.019)
        n_ = A.dir(outer)
        g.box(c, n_.cross(A.axis).normalized() * 0.009, n_ * 0.003, A.axis * 0.010, rim(tier))
    return g


def boots(K, tier):
    fg = K.fg
    parts = []
    for sd, sign in (('L', 1), ('R', -1)):
        parts += [
            L.Part('foot_' + sd, fg.piece('foot_' + sd, mirror_for(sign, foot_left(K, tier)), K.side(sign, ['feet'])),
                   smooth=1, clear=0.005),
            L.Part('shaft_' + sd, fg.piece('shaft_' + sd, mirror_for(sign, shaft_left(K, tier)), K.side(sign, ['shins', 'feet'])),
                   smooth=1, clear=0.007, over=('foot_' + sd,), gap=0.003),
            L.Part('bstrap_' + sd, fg.piece('bstrap_' + sd, mirror_for(sign, boot_straps_left(K, tier)), K.side(sign, ['shins'])),
                   smooth=1, clear=0.010, over=('shaft_' + sd,), gap=0.003),
        ]
    return parts, ['shins', 'feet']


# ------------------------------------------------------------------ gloves: fingerless half-gauntlets
def glove_left(K, tier):
    """Leather over the palm and the back of the hand, open at the knuckles. The hand stays visible (no `hides`), so
    the open end gets a small outward lip, not a flange (round 4: a flange closed it to a dark point that read as a
    spike), and rows close enough that the palm and the thumb's root stay under the leather."""
    Hf = K.hand
    ths = L.circle(10)
    rows = band_rows(Hf, [-0.05, 0.18, 0.4, 0.62, 0.82], ths, [0.007, 0.0085, 0.009, 0.0085, 0.0075])
    lip = band_rows(Hf, [0.84, 0.84], ths, [0.0105, 0.006])
    g = L.Grid()
    g.rows(rows, S['leather'], closed=True)
    g.rows([rows[-1]] + lip, S['leather'], closed=True)
    return g


def plate_left(K, tier):
    Hf = K.hand
    back = Hf.theta_of((1.0, 0.0, 0.0))
    ths = [back + D(a) for a in np.linspace(-50, 50, 5)]
    rows = band_rows(Hf, [0.15, 0.5, 0.82], ths, [0.0105, 0.0125, 0.0115])
    g = L.Grid()
    if tier == 'S':
        g.rows(rows, lambda i, j: S['glow'] if (i == 0 and j == 2) else S['metal'])
    else:
        g.rows(rows, S['metal'])
    g.rows([band_rows(Hf, [0.135], ths, [0.007])[0], rows[0]], rim(tier))
    knuck = band_rows(Hf, [0.82, 0.86, 0.94], ths, [0.0115, 0.016, 0.009])
    g.rows([rows[-1]] + knuck[1:], lambda i, j: S['trim'] if (tier == 'S' and i == 0) else S['metal'])
    if tier == 'F':
        for th in (ths[1], ths[3]):
            g.stud(Hf.pt(0.4, th, 0.013), Hf.dir(th), 0.003, S['metal'])
    return g


def cuff_left(K, tier):
    A = K.farm
    ths = L.circle(8)
    rows = band_rows(A, [0.80, 0.90, 1.0, 1.05], ths, [0.015, 0.012, 0.009, 0.008])
    lip = band_rows(A, [0.795, 0.795], ths, [0.019, 0.008])
    g = L.Grid()
    g.rows(lip[::-1] + [rows[0]], rim(tier, S['leather']), closed=True)
    g.rows(rows, S['leather'], closed=True)
    return g


def gloves(K, tier):
    fg = K.fg
    parts = []
    for sd, sign in (('L', 1), ('R', -1)):
        pre = 'Left' if sign > 0 else 'Right'
        hand = K.side(sign, ['hands'], bones=[pre + 'Hand', pre + 'ThumbProximal'])
        parts += [
            # hand and wrist bones only: knuckle-edge vertices bound to triangles that carry finger weights were dragged
            # into the fist as spikes (round 3)
            L.Part('glove_' + sd, fg.piece('glove_' + sd, mirror_for(sign, glove_left(K, tier)), hand),
                   allow=[pre + 'Hand', pre + 'LowerArm'], fallback=pre + 'Hand', smooth=2, clear=0.004),
            L.Part('plate_' + sd, fg.piece('plate_' + sd, mirror_for(sign, plate_left(K, tier)), hand),
                   allow=[pre + 'Hand'], smooth=2, clear=0.008, over=('glove_' + sd,), gap=0.003),
            L.Part('cuff_' + sd, fg.piece('cuff_' + sd, mirror_for(sign, cuff_left(K, tier)),
                                          K.side(sign, ['forearms', 'hands'], bones=[pre + 'LowerArm', pre + 'Hand'])),
                   allow=[pre + 'LowerArm', pre + 'Hand'], smooth=2, clear=0.006, over=('glove_' + sd,), gap=0.003),
        ]
    return parts, []


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
            ((-0.45, -0.75, 1.62), (0.0, -0.05, 1.52), 45, None),
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

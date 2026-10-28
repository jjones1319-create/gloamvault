"""build_gear_mender.py — the Mender's armour (docs/classes/mender.md §9; tools/blender/README.md §Gear).

Run:  & $B -b -P tools/blender/hero/build_gear_mender.py -- [--quick] [--no-render]
Opens art/build/hero_species.blend (else hero_body.blend), builds every slot in tiers F and S once on the broad frame,
realizes both frames (skinned, palette-split, the species keys the body carries), renders the review set into
art/renders/hero/gear/mender/, saves art/build/gear_mender.blend and writes client/public/models/hero/gear_mender_<frame>.glb.
Re-run it after any body or species change: nothing is hand-edited.

The look (the sheet): a broad, grounded column — an ankle-length robe under a knee-length tabard that carries a
sunburst; ivory robe (cloth1), oxblood tabard and trim (cloth2), pale gold emblem (cloth3, glow), silver (metal).
The tabard is the Mender's read beside the Arcanist (both wear Robes): it is painted on the robe's body between two
straight seams and hangs below the belt as four flaps (front and back, each split at the centre so a stride opens it
like the skirt under it).
F — undyed burlap: a round cowl with a cape-let, a rope belt with hanging cords, an embroidered sun, sandals, wraps.
S — Phoenix Weave: a low mitre with a gold orphrey and a sun, a raised silver sun on the tabard, a feathered oxblood
mantle, a feathered and faintly luminous hem, pointed tabard flaps with red (S) trim, silver bracers with a palm glow,
wrapped boots with silver toe caps.
Slots: helmet (cowl | mitre), chest (robe + tabard + belt in one mesh), legs (leggings, hidden but for the shins),
gloves (wraps | gloves + bracers), boots (sandals | wrapped boots).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import robe_lib as rl  # noqa: E402
from robe_lib import SL, TAU, Vector, gl, lerp, log, u  # noqa: E402

CLS = 'mender'
ARGS = rl.args()
QUICK = bool(ARGS.get('quick'))
SLOTS = ('helmet', 'chest', 'legs', 'gloves', 'boots')
PAL = {'cloth1': '#e8dfc6', 'cloth2': '#7d2633', 'cloth3': '#e3c26a', 'leather': '#7a5636', 'metal': '#cfd5de',
       'glow': '#fff0b0', 'gem': '#fff6cf', 'ink': '#1a1218'}
PALETTES = {'F': dict(PAL, trim='#8d8a84'), 'S': dict(PAL, trim='#d8363e')}
SKIRT_REG = ('belly', 'thighs', 'shins', 'feet')
TABARD_X = 0.105          # the tabard's half width on the robe's body (straight seams at ±x)
ROBE_OFF = 0.0135         # the robe's body off the skin: the sleeves reach the wrist over visible forearms, so the
                          # decimated sleeve needs more room than the 11 mm of a robe over hidden regions only


# ------------------------------------------------------------------ helmet
def helmet_F(ctx):
    """A round cowl: no peak, a little more volume than the Arcanist's hood, and a cape-let to the upper arms."""
    p = rl.hood(ctx, 'helmet_F', cols=24, dome_rows=7, upper_rings=3, drape_rows=4, base_off=0.027, peak=0.0,
                crown=0.006, gather_z=1.468, gather_r=0.124, bottom=lambda th: 1.29 - 0.05 * math.cos(th) ** 2,
                drape_off=0.040, open_point=(0.0, -0.035, 1.50), open_tilt=0.30, sill_below=0.016,
                throat_off=0.027, slot=SL['cloth1'])
    sill = p._sill
    rl.rim(p, ctx, -0.013, SL['cloth2'], where=lambda m, pts: m.z > sill - 0.02)
    rl.rim(p, ctx, 0.006, SL['leather'], where=lambda m, pts: m.z <= sill - 0.02)
    C = ctx.head_center()
    rl.inner_layer(p, ctx, 0.012, SL['cloth2'],
                   select=lambda c, n, s: s == SL['cloth1'] and c.y < C.y - 0.005 and c.z > sill - 0.005)
    rl.mark_loose(p, ('head', 'neck', 'chest', 'upperArms'))
    return p, []


def helmet_S(ctx):
    """A low mitre: a silver band round the brow, two ivory panels rising to a ridge (a pointed arch seen from the
    front), a gold orphrey down the front and back, and a sun on the front panel."""
    C = ctx.head_center()
    cols = 20

    def zf(th):
        return 1.706 + 0.02 * (1 - math.cos(th)) / 2

    lv = [(lambda th: zf(th) - 0.013, 0.007), (zf, 0.011), (lambda th: zf(th) + 0.017, 0.008)]
    band, bidx, ths = rl.rings(ctx, 'mitre_band', center=C.y, levels=lv, cols=cols, slot=SL['metal'],
                               regions=('head',), bind_target=lambda z, th: C)
    rl.orient(band, ctx, lambda c: Vector((c.x, c.y - C.y, 0.0)))
    bpos = rl.positions(band, ctx)
    top = [bpos[i] for i in bidx[-1]]
    rl.rim(band, ctx, 0.004, SL['trim'], where=lambda m, pts: m.z < zf(0.0) + 0.004)
    # the body: the band's top ring, narrowed in x toward a ridge and a little in y, rising H
    H = 0.135
    hs = [-0.006, 0.035, 0.07, 0.10, 0.122, 0.134]
    body = gl.Piece('mitre')
    body._smap = ctx.smap
    rows = []
    for h in hs:
        f = max(0.0, h) / H
        fa = max(0.05, (1.0 - f ** 1.8)) ** 0.55 * (0.975 if h < 0 else 1.0)
        fb = (1.0 - 0.42 * f ** 1.2) * (0.975 if h < 0 else 1.0)
        row = []
        for T in top:
            P = Vector((T.x * fa, C.y + (T.y - C.y) * fb, T.z + h))
            row.append(rl.bind_toward(body, ctx, P, C, regions=('head',)))
        rows.append(row)

    def orphrey(r, c):
        return SL['cloth3'] if c in (cols - 1, 0, cols // 2 - 1, cols // 2) else SL['cloth1']
    rl.grid_faces(body, rows, SL['cloth1'], closed=True, slot_fn=orphrey)
    apex = rl.bind_toward(body, ctx, Vector((0.0, C.y, max(T.z for T in top) + H + 0.006)), C, regions=('head',))
    for j in range(cols):
        body.add_face((apex, rows[-1][j], rows[-1][(j + 1) % cols]), orphrey(0, j))
    rl.orient(body, ctx, lambda c: Vector((c.x, c.y - C.y, 0.25)))
    # the sun on the front panel
    h0 = 0.045
    f0 = h0 / H
    T0 = top[0]
    fb0 = 1.0 - 0.42 * f0 ** 1.2
    fr = Vector((0.0, C.y + (T0.y - C.y) * fb0, T0.z + h0))
    fr2 = Vector((0.0, C.y + (T0.y - C.y) * (1.0 - 0.42 * ((h0 + 0.01) / H) ** 1.2), T0.z + h0 + 0.01))
    tang = (fr2 - fr).normalized()
    nrm = Vector((0.0, -tang.z, tang.y)).normalized()
    if nrm.y > 0:
        nrm = -nrm
    sv, sf, kinds = rl.disc(fr + nrm * 0.004, nrm, 0.017, n=10, rays=10, ray_len=0.016, ray_w=0.38, depth=0.0,
                            up=Vector((0, 0, 1)))
    sun = rl.solid(ctx, 'mitre_sun', sv, sf, [SL['glow'] if k == 'disc' else SL['metal'] for k in kinds],
                   bind_point=C + Vector((0, -0.08, 0.1)), regions=('head',))
    rl.orient(sun, ctx, lambda c: nrm)
    for pc in (band, body):
        rl.mark_loose(pc, ('head',))
    rl.mark_loose(sun, ('head',), rigid=True)
    return rl.merge('helmet_S', [band, body, sun], ctx), []


# ------------------------------------------------------------------ chest (robe + tabard + belt)
def column_skirt(ctx, feather=0.0, cols=24, rows=7):
    return rl.Skirt(ctx, z_top=1.035, hem=lambda th: 0.10 - 0.012 * (1 - math.cos(th)) / 2,
                    shape=rl.wedge(0.236, 0.212, a_top=0.12, b_top=0.10, power=1.0), clearance=rl.clearance,
                    cols=cols, rows=rows, slit_front=0.78, slit_back=0.88, notch=0.016, feather=feather)


def tabard_flaps(ctx, sk, slot, extra=0.017, pointed=False, slot_fn=None, z0=0.99, z1=0.47):
    """Four flaps hanging from under the belt to the knee, each riding the leg on its side."""
    w = 0.55
    g = 0.006
    hem = (lambda f: 0.05 * (1.0 - abs(2.0 * f - 1.0))) if pointed else None
    spec = (('flap_fl', g, w, 1), ('flap_fr', -w, -g, -1), ('flap_bl', math.pi - w, math.pi - g, 1),
            ('flap_br', math.pi + g, math.pi + w, -1))
    return [rl.flap(ctx, sk, name, a, b, side, z0, z1, extra, slot, cols=3, rows=5, slot_fn=slot_fn, hem=hem)
            for name, a, b, side in spec]


def tabard_paint(ctx, torso, trim_band=False):
    def f(c, n, s, i):
        if c.z < 0.93 or abs(c.x) > TABARD_X:
            return None
        if trim_band and abs(c.x) > TABARD_X - 0.016:
            return SL['trim']
        return SL['cloth2']
    rl.paint(torso, ctx, f)


def chest_F(ctx):
    seams = [((TABARD_X, 0, 0), (1, 0, 0)), ((-TABARD_X, 0, 0), (1, 0, 0))]
    torso, hides = rl.robe_torso(ctx, 'chest_F_torso', offset=ROBE_OFF, slot=SL['cloth1'], sleeve_t=0.9, ratio=0.23,
                                 seams=seams)
    tabard_paint(ctx, torso)
    rl.rim(torso, ctx, 0.006, SL['leather'], where=lambda m, pts: m.z > 1.35)
    rl.rim(torso, ctx, 0.007, SL['leather'], where=lambda m, pts: abs(m.x) > 0.25)
    vs, fs, kinds = rl.sun2d(0.038, rays=12, ray_len=0.55, ray_w=0.30)
    emblem = rl.surface_shape(ctx, 'emblem', Vector((0, -0.1, 1.17)), Vector((0, -1, 0)), vs, fs,
                              [SL['cloth3']] * len(fs), ROBE_OFF + 0.0045, regions=('chest', 'belly'))
    sk = column_skirt(ctx)
    skirt = sk.build('chest_F_skirt', SL['cloth1'])
    rl.rim(skirt, ctx, 0.006, SL['leather'], where=lambda m, pts: m.z < 0.8)
    rl.inner_layer(skirt, ctx, 0.012, SL['cloth1'], select=lambda c, n, s: s != SL['leather'] and c.z < 0.80)
    flaps = tabard_flaps(ctx, sk, SL['cloth2'])
    for fp in flaps:
        rl.rim(fp, ctx, 0.004, SL['cloth2'])
    rope = rl.sash(ctx, sk, 'rope', SL['leather'], z_mid=1.0, half_h=0.013, extra=0.033, cols=20, bulge=0.012,
                   lip=0, rows=4)
    kn = rl.knot(ctx, sk, 0.5, 1.0, 0.05, SL['leather'], size=0.02)
    cords = [rl.strip(ctx, sk, a, 0.014, 0.985, z1, 0.036, 4, SL['leather'], lip=0.003, taper=0.7)
             for a, z1 in ((0.46, 0.66), (0.56, 0.70))]
    for pc in [skirt, rope, kn] + flaps + cords:
        rl.mark_loose(pc, SKIRT_REG)
    rl.mark_loose(emblem, ('chest', 'belly'))
    return rl.merge('chest_F', [torso, emblem, skirt, rope, kn] + flaps + cords, ctx), hides


def chest_S(ctx):
    seams = [((TABARD_X, 0, 0), (1, 0, 0)), ((-TABARD_X, 0, 0), (1, 0, 0)),
             ((TABARD_X - 0.016, 0, 0), (1, 0, 0)), ((-(TABARD_X - 0.016), 0, 0), (1, 0, 0))]
    torso, hides = rl.robe_torso(ctx, 'chest_S_torso', offset=ROBE_OFF, slot=SL['cloth1'], sleeve_t=0.9, ratio=0.28,
                                 seams=seams)
    tabard_paint(ctx, torso, trim_band=True)
    rl.rim(torso, ctx, 0.006, SL['trim'], where=lambda m, pts: m.z > 1.35)
    rl.rim(torso, ctx, 0.007, SL['trim'], where=lambda m, pts: abs(m.x) > 0.25)
    # the raised silver sun: rays and disc lifted 9 mm off the robe, side walls down to it, a glowing heart
    vs, fs, kinds = rl.sun2d(0.04, rays=12, ray_len=0.62, ray_w=0.30)
    sun = rl.surface_shape(ctx, 'sun', Vector((0, -0.1, 1.235)), Vector((0, -1, 0)), vs, fs,
                           [SL['metal']] * len(fs), ROBE_OFF + 0.009, regions=('chest', 'belly'))
    rl.rim(sun, ctx, -0.007, SL['metal'])
    hv, hf, hk = rl.sun2d(0.017, rays=0, segs=10)
    heart = rl.surface_shape(ctx, 'sun_heart', Vector((0, -0.1, 1.235)), Vector((0, -1, 0)), hv, hf,
                             [SL['glow']] * len(hf), ROBE_OFF + 0.0105, regions=('chest', 'belly'))
    sk = column_skirt(ctx, feather=0.045, cols=28, rows=8)
    skirt = sk.build('chest_S_skirt', SL['cloth1'],
                     slot_fn=lambda k, j: SL['cloth3'] if k == sk.rows - 2 else SL['cloth1'])
    rl.rim(skirt, ctx, 0.005, SL['glow'], where=lambda m, pts: m.z < 0.8)
    rl.inner_layer(skirt, ctx, 0.012, SL['cloth3'], select=lambda c, n, s: s != SL['glow'] and c.z < 0.80)
    flaps = tabard_flaps(ctx, sk, SL['cloth2'], pointed=True,
                         slot_fn=lambda r, c: SL['cloth3'] if r == 3 else SL['cloth2'])
    for fp in flaps:
        rl.rim(fp, ctx, 0.004, SL['trim'])
    belt = rl.sash(ctx, sk, 'belt', SL['leather'], z_mid=1.0, half_h=0.024, extra=0.030, cols=24, bulge=0.004)
    bpt = sk.point(0.0, 1.0, 0.044)
    bv, bf, bk = rl.disc(bpt, u(0), 0.024, n=10, depth=0.0)
    buckle = rl.solid(ctx, 'buckle', bv, bf, [SL['metal']] * len(bf), bind_point=bpt, regions=('belly', 'thighs'))
    gv, gf, gk = rl.disc(bpt + u(0) * 0.003, u(0), 0.010, n=6, depth=0.0)
    gem = rl.solid(ctx, 'buckle_gem', gv, gf, [SL['gem']] * len(gf), bind_point=bpt, regions=('belly', 'thighs'))
    for pc in (buckle, gem):
        rl.orient(pc, ctx, lambda c: u(0))
    man = rl.mantle(ctx, 'mantle', slot=SL['cloth2'], rim_slot=SL['trim'],
                    bottom=lambda th: 1.30 + 0.025 * math.cos(th) ** 2, cols=24, rows=4, off=(0.027, 0.008),
                    feather=0.09, slot_fn=lambda r, c: SL['cloth3'] if r == 2 else SL['cloth2'])
    for pc in [skirt, belt] + flaps:
        rl.mark_loose(pc, SKIRT_REG)
    rl.mark_loose(buckle, SKIRT_REG, rigid=True)
    rl.mark_loose(gem, SKIRT_REG, rigid=True)
    sun = rl.merge('sun', [sun, heart], ctx)
    rl.mark_loose(sun, ('chest', 'belly'), rigid=True)
    rl.mark_loose(man, ('neck', 'chest', 'upperArms'))
    parts = [torso, sun, skirt, belt, buckle, gem, man] + flaps
    return rl.merge('chest_S', parts, ctx), hides


# ------------------------------------------------------------------ legs
def legs_F(ctx):
    p, hides = rl.leggings(ctx, 'legs_F', offset=0.005, slot=SL['leather'], ratio=0.15)
    return p, hides


def legs_S(ctx):
    p, hides = rl.leggings(ctx, 'legs_S', offset=0.005, slot=SL['cloth2'], ratio=0.18)
    rl.paint(p, ctx, lambda c, n, s, i: SL['trim'] if 0.455 < c.z < 0.50 else None)
    return p, hides


# ------------------------------------------------------------------ gloves
def gloves_F(ctx):
    p, hides = rl.gloves(ctx, 'gloves_F', offset=0.006, slot=SL['cloth1'], cuff_t=0.32, ratio=0.17)

    def stripes(c, n, s, i):
        side, d, wr, ax = rl.arm_d(ctx, c)
        if -0.09 < d < 0.03 and int(math.floor((d + 0.004) / 0.019)) % 2 == 0:
            return SL['leather']
        return None
    rl.paint(p, ctx, stripes)
    rl.rim(p, ctx, 0.004, SL['leather'])
    return p, hides


def bracer(ctx, side):
    sh, el, wr, tip = rl.arm_points(ctx, side)
    levels = [(0.36, lambda ph, rho: rho + 0.027), (0.42, lambda ph, rho: rho + 0.022),
              (0.64, lambda ph, rho: rho + 0.021), (0.84, lambda ph, rho: rho + 0.022),
              (0.90, lambda ph, rho: rho + 0.027)]

    def slots(r, c):
        if r in (0, 3):
            return SL['trim']
        if r == 2 and c % 2 == 0:
            return SL['glow']
        return SL['metal']
    p, idx = rl.tube(ctx, 'bracer', a=el, b=wr, levels=levels, cols=10, slot=SL['metal'],
                     regions=('forearms', 'hands'), side=side, slot_fn=slots)
    rl.rim(p, ctx, -0.008, SL['metal'])
    rl.mark_loose(p, ('forearms', 'hands'))
    return p


def gloves_S(ctx):
    p, hides = rl.gloves(ctx, 'gloves_S', offset=0.006, slot=SL['leather'], cuff_t=0.30, ratio=0.2)

    def palm(c, n, s, i):
        side, d, wr, ax = rl.arm_d(ctx, c)
        along, pn = rl.hand_axes(ctx, side)
        pc = wr + along * 0.05
        if d > 0.0 and n.dot(pn) > 0.45 and (c - pc).length < 0.026:
            return SL['glow']
        return None
    rl.paint(p, ctx, palm)
    rl.rim(p, ctx, 0.004, SL['trim'])
    return rl.merge('gloves_S', [p, bracer(ctx, 1), bracer(ctx, -1)], ctx), hides


# ------------------------------------------------------------------ boots
def strap(ctx, side, planes, name, offset=0.0055):
    """A strap: the feet/shins shell of one side kept between planes [(point, normal)] (no lip: a ragged edge
    doubled by a lip costs more than the strap)."""
    p, _ = gl.shell(ctx.bodies, ['feet', 'shins'], offset, SL['leather'], name=name)
    rl.clip(p, ctx, (0, 0, 0), (side, 0, 0), keep='front')
    for pt, nr in planes:
        rl.clip(p, ctx, pt, nr, keep='front')
    rl.compact(p)
    return rl.low_shell(p, ctx, 0.35, symmetry=False, name=name)


def sandal(ctx, side):
    """F sandals: a sole band round the foot's footprint and four straps (ankle, instep, toes, and a T up the front);
    the toes and the foot show between them (no hides)."""
    A0, a, lat, F, s = rl.foot_axis(ctx, side)
    s0, s1 = float(s.min()), float(s.max())
    zf = float(F[:, 2].min())
    low = F[F[:, 2] < zf + 0.03]
    sl = (low[:, 0] - A0.x) * a.x + (low[:, 1] - A0.y) * a.y
    lv = (low[:, 0] - A0.x) * lat.x + (low[:, 1] - A0.y) * lat.y
    N = 9
    plus, minus = [], []
    for k in range(N):
        sk_ = s0 + (s1 - s0) * k / (N - 1)
        m = abs(sl - sk_) < 0.018
        if not m.any():
            continue
        plus.append((sk_, float(lv[m].max())))
        minus.append((sk_, float(lv[m].min())))
    mid0 = 0.5 * (plus[0][1] + minus[0][1])
    mid1 = 0.5 * (plus[-1][1] + minus[-1][1])
    outline = [(s0 - 0.004, mid0)] + plus + [(s1 + 0.004, mid1)] + list(reversed(minus))
    ctr = sum((Vector((ss, ll, 0)) for ss, ll in outline), Vector((0, 0, 0))) / len(outline)

    def pt(ss, ll, grow, z):
        d = Vector((ss - ctr.x, ll - ctr.y, 0))
        d = d.normalized() * (d.length + grow) if d.length > 1e-6 else d
        return A0 + a * (ctr.x + d.x) + lat * (ctr.y + d.y) + Vector((0, 0, z))
    sole = gl.Piece('sole')
    sole._smap = ctx.smap
    rings_ = []
    for grow, z in ((0.007, zf - 0.004), (0.007, zf + 0.016), (-0.008, zf + 0.016)):
        rings_.append([rl.bind_nearest(sole, ctx, pt(ss, ll, grow, z), regions=('feet',), side=side) for ss, ll in outline])
    rl.grid_faces(sole, rings_, SL['leather'], closed=True)
    cen = A0 + a * ctr.x + lat * ctr.y
    rl.orient(sole, ctx, lambda c: Vector((c.x - cen.x, c.y - cen.y, 0.3)))
    L = s1 - s0
    si, st = s0 + 0.47 * L, s0 + 0.80 * L
    up = Vector((0, 0, 1))
    mid = A0 + lat * (0.5 * (mid0 + mid1))
    straps = [
        strap(ctx, side, [((0, 0, 0.066), up), ((0, 0, 0.092), -up)], 'ankle_strap'),
        strap(ctx, side, [(A0 + a * (si - 0.010), a), (A0 + a * (si + 0.010), -a), ((0, 0, zf + 0.012), up)], 'instep'),
        strap(ctx, side, [(A0 + a * (st - 0.008), a), (A0 + a * (st + 0.008), -a), ((0, 0, zf + 0.010), up)], 'toe_strap'),
        strap(ctx, side, [(mid - lat * 0.009, lat), (mid + lat * 0.009, -lat), (A0 + a * (si - 0.004), -a),
                          ((0, 0, 0.035), up), ((0, 0, 0.08), -up)], 't_strap'),
    ]
    for pc in [sole] + straps:
        rl.mark_loose(pc, ('feet', 'shins'))
    return [sole] + straps


def boots_F(ctx):
    parts = sandal(ctx, 1) + sandal(ctx, -1)
    return rl.merge('boots_F', parts, ctx), []


def boots_S(ctx):
    parts = []
    for side in (1, -1):
        sh = rl.shoe(ctx, 'boot_foot', side, offset=0.012, slot=SL['leather'], collar=0.01)
        A0, a, lat, s0, s1, zf = sh._foot
        rl.paint(sh, ctx, lambda c, n, s, i: SL['metal'] if (c - A0).dot(a) > s1 - 0.035 else None)
        sf, idx = rl.shaft(ctx, 'boot_shaft', side, z0=0.085, z1=0.28, offset=0.012, slot=SL['cloth1'], rows=4,
                           cols=10, flare=0.01, slot_fn=lambda r, c: SL['leather'] if r == 1 else SL['cloth1'])
        rl.rim(sf, ctx, 0.006, SL['trim'], where=lambda m, pts: m.z > 0.2)
        for pc in (sh, sf):
            rl.mark_loose(pc, ('feet', 'shins'))
        parts += [sh, sf]
    return rl.merge('boots_S', parts, ctx), ['feet']


BUILDERS = {('helmet', 'F'): helmet_F, ('helmet', 'S'): helmet_S, ('chest', 'F'): chest_F, ('chest', 'S'): chest_S,
            ('legs', 'F'): legs_F, ('legs', 'S'): legs_S, ('gloves', 'F'): gloves_F, ('gloves', 'S'): gloves_S,
            ('boots', 'F'): boots_F, ('boots', 'S'): boots_S}


def main():
    rl.open_source()
    bodies = gl.load_bodies()
    ctx = rl.Ctx(bodies)
    pieces = {}
    only = ARGS.get('only')
    for key, fn in BUILDERS.items():
        if only and key[0] != only:
            continue
        piece, hides = fn(ctx)
        pieces[key] = (piece, hides)
        log('built %s %s: %d tris, hides %s' % (key[0], key[1], gl.tri_count_piece(piece), hides))
    objs = rl.realize_all(ctx, CLS, pieces)
    lines, tot = rl.tri_table(objs['broad'])
    for ln in lines:
        log(ln)
    if not ARGS.get('no_render'):
        out = os.path.join(rl.RENDERS, 'hero', 'gear', CLS)
        rv = rl.Review(ctx, CLS, objs, PALETTES, out, quick=QUICK)
        rv.sets(SLOTS)
        rv.gear_sheet(SLOTS)
        rv.closeups(SLOTS)
        rv.poses(SLOTS, frames=('broad',) if QUICK else rl.FRAMES)
        rv.species(SLOTS)
    rl.finish_and_save(CLS)
    sizes = gl.export_class(CLS, objs)
    log('exported', sizes)


main()

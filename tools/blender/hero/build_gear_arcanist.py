"""build_gear_arcanist.py — the Arcanist's armour (docs/classes/arcanist.md §9; tools/blender/README.md §Gear).

Run:  & $B -b -P tools/blender/hero/build_gear_arcanist.py -- [--quick] [--no-render]
Opens art/build/hero_species.blend (else hero_body.blend), builds every slot in tiers F and S once on the broad frame,
realizes both frames (skinned, palette-split, the species keys the body carries), renders the review set into
art/renders/hero/gear/arcanist/, saves art/build/gear_arcanist.blend and writes
client/public/models/hero/gear_arcanist_<frame>.glb. Re-run it after the species pass lands: nothing is hand-edited.

The look (the sheet): a tall narrow wedge — a long robe flaring at the hem, a hood (F) or a stand-up collar under a
circlet with a floating shard (S, "circlet at B+"). Deep indigo robe (cloth1), ash grey trim and straps (cloth2,
leather), ember-orange runes (glow), brass (metal); cloth3 is the Phoenix Weave's ember feathers.
F — patched burlap: a plain pointed hood, a plain robe with patches and a tied sash, wrapped hands, soft slippers.
S — Phoenix Weave: a knee-length overskirt of feather points and a feathered shoulder mantle with ember runes over the
robe, a stand-up collar, bell sleeves over rune gauntlets, pointed wrapped boots, red (S) trim on every edge.
Slots: helmet (hood | circlet), chest (the robe: torso, sleeves and the split skirt in one mesh), legs (leggings,
mostly hidden), gloves (wraps | rune gauntlets), boots (slippers | wrapped boots).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import robe_lib as rl  # noqa: E402
from robe_lib import SL, TAU, Vector, gl, lerp, log, smoothstep, u  # noqa: E402

CLS = 'arcanist'
ARGS = rl.args()
QUICK = bool(ARGS.get('quick'))
SLOTS = ('helmet', 'chest', 'legs', 'gloves', 'boots')
PAL = {'cloth1': '#4448a8', 'cloth2': '#a29d95', 'cloth3': '#a2452a', 'leather': '#605852', 'metal': '#cfa64e',
       'glow': '#ff9a3c', 'gem': '#ffc35a', 'ink': '#1a1218'}
PALETTES = {'F': dict(PAL, trim='#8d8a84'), 'S': dict(PAL, trim='#d8363e')}


# ------------------------------------------------------------------ shared shapes (robe_lib)
wedge, clearance, sash, strip, knot = rl.wedge, rl.clearance, rl.sash, rl.strip, rl.knot
hand_axes, arm_d, front_angle = rl.hand_axes, rl.arm_d, rl.front_angle


# ------------------------------------------------------------------ helmet
def helmet_F(ctx):
    p = rl.hood(ctx, 'helmet_F', cols=24, dome_rows=7, upper_rings=3, drape_rows=2, base_off=0.022, peak=0.055,
                peak_at=(70, 180), peak_w=(18, 32), gather_z=1.468, gather_r=0.122,
                bottom=lambda th: 1.405 - 0.045 * math.cos(th) ** 2, drape_off=0.030,
                open_point=(0.0, -0.035, 1.50), open_tilt=0.36, sill_below=0.014, throat_off=0.024, slot=SL['cloth1'])
    sill = p._sill
    rl.rim(p, ctx, -0.012, SL['cloth2'], where=lambda m, pts: m.z > sill - 0.02)
    rl.rim(p, ctx, 0.006, SL['leather'], where=lambda m, pts: m.z <= sill - 0.02)
    C = ctx.head_center()
    rl.inner_layer(p, ctx, 0.012, SL['cloth2'],
                   select=lambda c, n, s: s == SL['cloth1'] and c.y < C.y + 0.03 and c.z > sill - 0.005)
    rl.mark_loose(p, ('head', 'neck', 'chest', 'upperArms'))
    return p, []


def helmet_S(ctx):
    C = ctx.head_center()
    cols = 24

    def zf(th):
        return 1.708 + 0.032 * (1 - math.cos(th)) / 2

    levels = [(lambda th: zf(th) + 0.009, 0.006), (zf, 0.010), (lambda th: zf(th) - 0.009, 0.006)]
    band, idx, ths = rl.rings(ctx, 'circlet', center=C.y, levels=levels, cols=cols, slot=SL['metal'],
                              regions=('head',), bind_target=lambda z, th: C)
    rl.orient(band, ctx, lambda c: Vector((c.x, c.y - C.y, 0.0)))
    rl.rim(band, ctx, 0.004, SL['trim'])
    # the front setting: a flat diamond on the brow, and the shard floating above it
    hit = ctx.outermost(Vector((0, C.y, zf(0))), u(0), 0.3, regions=('head',))
    front = Vector((0, C.y, zf(0))) + u(0) * (hit[2] + 0.012)
    dv = [front + Vector((0, 0, 0.022)), front + Vector((0.014, 0, 0)), front - Vector((0, 0, 0.016)),
          front - Vector((0.014, 0, 0)), front + Vector((0, -0.007, 0.002)), front + Vector((0, 0.004, 0.0))]
    df = [(4, 0, 3), (4, 3, 2), (4, 2, 1), (4, 1, 0), (5, 3, 0), (5, 2, 3), (5, 1, 2), (5, 0, 1)]
    setting = rl.solid(ctx, 'setting', dv, df, [SL['metal']] * 4 + [SL['metal']] * 4, bind_point=front - Vector((0, -0.01, 0)), regions=('head',))
    gv = [front + Vector((0, -0.009, 0.004)), front + Vector((0.006, -0.004, 0.003)), front + Vector((0, -0.004, -0.004)),
          front + Vector((-0.006, -0.004, 0.003))]
    gem = rl.solid(ctx, 'setting_gem', gv, [(0, 1, 2), (0, 2, 3)], [SL['gem']] * 2, bind_point=front, regions=('head',))
    sv, sf = rl.bipyramid(front + Vector((0, -0.03, 0.082)), 0.016, 0.05, 0.032, n=5, roll=0.3)
    shard = rl.solid(ctx, 'shard', sv, sf, [SL['gem']] * len(sf), bind_point=front, regions=('head',))
    for pc, ctr in ((setting, front), (gem, front + Vector((0, 0.01, 0))), (shard, front + Vector((0, -0.03, 0.082)))):
        rl.orient(pc, ctx, lambda c, ctr=ctr: c - ctr)
    rl.mark_loose(band, ('head',))
    for pc in (setting, gem, shard):
        rl.mark_loose(pc, ('head',), rigid=True)
    return rl.merge('helmet_S', [band, setting, gem, shard], ctx), []


# ------------------------------------------------------------------ chest (the robe)
def chest_F(ctx):
    torso, hides = rl.robe_torso(ctx, 'chest_F_torso', offset=0.011, slot=SL['cloth1'], sleeve_t=0.55, ratio=0.26)

    patch_parts = []
    for hint, d, w, h, rot in (((-0.085, -0.1, 1.24), (0, -1, 0), 0.07, 0.06, 0), ((0.07, 0.1, 1.05), (0, 1, 0), 0.08, 0.07, 0),
                               ((0.31, 0.0, 1.12), (0.4, -1, 0.1), 0.05, 0.045, 0)):
        vs, fs = rl.rect2d(w, h, 2, 2)
        pt = rl.surface_shape(ctx, 'patch', Vector(hint), Vector(d), vs, fs, [SL['cloth2']] * len(fs), 0.0165,
                              regions=('chest', 'belly', 'upperArms', 'forearms'))
        rl.rim(pt, ctx, 0.003, SL['leather'])
        patch_parts.append(pt)
    rl.rim(torso, ctx, 0.006, SL['leather'], where=lambda m, pts: m.z > 1.35)
    rl.rim(torso, ctx, 0.007, SL['cloth2'], where=lambda m, pts: abs(m.x) > 0.25)
    sk = rl.Skirt(ctx, z_top=1.035, hem=lambda th: 0.215 - 0.04 * (1 - math.cos(th)) / 2, shape=wedge(0.29, 0.235),
                  clearance=clearance, cols=24, rows=7, slit_front=0.78, slit_back=0.88, notch=0.016)
    patch_cells = {(3, 3), (4, 19), (2, 10), (2, 11)}
    skirt = sk.build('chest_F_skirt', SL['cloth1'],
                     slot_fn=lambda k, j: SL['cloth2'] if (k, j) in patch_cells else SL['cloth1'])
    rl.rim(skirt, ctx, 0.006, SL['leather'], where=lambda m, pts: m.z < 0.8)
    rl.inner_layer(skirt, ctx, 0.012, SL['cloth1'], select=lambda c, n, s: s != SL['leather'] and c.z < 0.80)
    belt = sash(ctx, sk, 'chest_F_sash', SL['cloth2'], z_mid=1.0, half_h=0.024, extra=0.011, cols=20)
    tails = [strip(ctx, sk, math.radians(a), 0.034, 0.985, z1, 0.018, 4, SL['cloth2']) for a, z1 in ((27, 0.70), (40, 0.74))]
    kn = knot(ctx, sk, math.radians(33), 1.0, 0.026, SL['cloth2'])
    for pc in [skirt, belt, kn] + tails:
        rl.mark_loose(pc, ('belly', 'thighs', 'shins', 'feet'))
    for pc in patch_parts:
        rl.mark_loose(pc, ('chest', 'belly', 'upperArms', 'forearms'))
    return rl.merge('chest_F', [torso, skirt, belt, kn] + tails + patch_parts, ctx), hides


def bell_sleeve(ctx, side, slot, lip_slot, rim_slot, glow=True):
    sh, el, wr, tip = rl.arm_points(ctx, side)
    a = el + (sh - el).normalized() * 0.04
    levels = [(0.0, lambda ph, rho: rho + 0.021),
              (0.34, lambda ph, rho: rho + 0.031),
              (0.68, lambda ph, rho: rho + 0.047),
              (lambda ph: 0.97 + 0.11 * max(0.0, -math.cos(ph)), lambda ph, rho: rho + 0.064)]
    p, idx = rl.tube(ctx, 'bell', a=a, b=wr, levels=levels, cols=12, slot=slot, regions=('upperArms', 'forearms'),
                     side=side, slot_fn=(lambda r, c: SL['glow'] if (glow and r == 2 and c % 2 == 0) else slot))
    rl.rim(p, ctx, -0.012, lip_slot, where=lambda m, pts: (m - wr).length < (m - a).length)
    rl.rim(p, ctx, 0.005, rim_slot, where=lambda m, pts: (m - wr).length < (m - a).length)
    ax, L = (wr - a).normalized(), (wr - a).length
    rl.inner_layer(p, ctx, 0.012, lip_slot, select=lambda c, n, s: s in (slot, SL['glow']) and (c - a).dot(ax) > 0.36 * L)
    return p


def collar(ctx, slot, rim_slot, glow_slot):
    nz = rl.neckline(ctx)

    def zb(th):
        return nz(th) - 0.004

    def hgt(th):
        return 0.018 + 0.072 * ((1 - math.cos(th)) / 2) ** 1.3

    def w(th):
        return (1 - math.cos(th)) / 2      # 0 at the open front, 1 at the back: the flare tapers off toward the front
                                           # so a hood's throat (F helmet over an S robe) still closes over it
    levels = [(zb, 0.022),
              (lambda th: zb(th) + hgt(th) * 0.5, lambda th: 0.025 + 0.008 * w(th)),
              (lambda th: zb(th) + hgt(th), lambda th: 0.027 + 0.023 * w(th))]
    p, idx, ths = rl.rings(ctx, 'collar', center=lambda z: ctx.spine_y(z), levels=levels, cols=16, slot=slot,
                           regions=('neck', 'chest'), arc=(math.radians(52), math.radians(308)),
                           bind_target=lambda z, th: Vector((0.0, ctx.spine_y(zb(th)), zb(th))),
                           slot_fn=lambda r, c: glow_slot if (r == 1 and c % 3 == 1) else slot, mode='radial')
    rl.orient(p, ctx, lambda c: Vector((c.x, c.y - ctx.spine_y(c.z), 0.0)))
    rl.rim(p, ctx, -0.008, rim_slot)
    rl.inner_layer(p, ctx, 0.010, SL['cloth3'], select=lambda c, n, s: s != rim_slot)
    return p


def mantle(ctx, slot, rim_slot, glow_slot, cols=24, feather=0.11):
    def zb(th):
        return 1.302 + 0.035 * math.cos(th) ** 2 - 0.012 * (1 - math.cos(th)) / 2
    return rl.mantle(ctx, 'mantle', slot=slot, rim_slot=rim_slot, bottom=zb, cols=cols, rows=4, off=(0.021, 0.008),
                     feather=feather, slot_fn=lambda r, c: glow_slot if (r == 2 and c % 2 == 1) else slot)


def chest_S(ctx):
    seams = [((0.03, 0.0, 0.0), (1, 0, 0)), ((-0.03, 0.0, 0.0), (1, 0, 0))]
    torso, hides = rl.robe_torso(ctx, 'chest_S_torso', offset=0.011, slot=SL['cloth1'], sleeve_t=0.08, ratio=0.23,
                                 seams=seams)
    rl.paint(torso, ctx, lambda c, n, s, i: SL['cloth3'] if abs(c.x) < 0.03 and c.y < -0.02 and c.z > 0.95 else None)
    rl.rim(torso, ctx, 0.006, SL['trim'], where=lambda m, pts: m.z > 1.35)
    rl.rim(torso, ctx, 0.005, SL['trim'], where=lambda m, pts: abs(m.x) > 0.22)
    sk = rl.Skirt(ctx, z_top=1.035, hem=lambda th: 0.175 - 0.045 * (1 - math.cos(th)) / 2, shape=wedge(0.31, 0.25),
                  clearance=clearance, cols=24, rows=9, slit_front=0.78, slit_back=0.88, notch=0.016)
    skirt = sk.build('chest_S_skirt', SL['cloth1'],
                     slot_fn=lambda k, j: SL['cloth3'] if k == sk.rows - 2 else SL['cloth1'])
    rl.rim(skirt, ctx, 0.006, SL['trim'], where=lambda m, pts: m.z < 0.8)
    rl.inner_layer(skirt, ctx, 0.012, SL['cloth3'], select=lambda c, n, s: s != SL['trim'] and c.z < 0.80)

    def over_r(th, t, z):
        return max(sk.radius(th, z + dz) for dz in (-0.07, -0.035, 0.0, 0.035, 0.07)) + 0.019
    # the feathered overskirt: knee length, open at the front so the indigo robe shows between its edges
    fl = rl.Skirt(ctx, z_top=1.0, hem=lambda th: 0.505 - 0.035 * (1 - math.cos(th)) / 2, shape=over_r,
                  clearance=lambda z: 0.0, cols=24, rows=4, slit_front=0.78, slit_back=0.88, notch=0.016,
                  feather=0.075, feather_every=2)
    over = fl.build('chest_S_feathers', SL['cloth3'],
                    slot_fn=lambda k, j: SL['glow'] if (k == fl.rows - 2 and j % 2 == 1) else SL['cloth3'])
    rl.drop_faces(over, ctx, lambda c, n, s: front_angle(fl, c) < math.radians(36))
    rl.rim(over, ctx, 0.005, SL['trim'])
    belt = sash(ctx, fl, 'chest_S_sash', SL['leather'], z_mid=1.0, half_h=0.027, extra=0.010, cols=24)
    bpt = fl.point(0.0, 1.0, 0.024)
    bv, bf, kinds = rl.disc(bpt, u(0), 0.022, n=10, depth=0.0)
    buckle = rl.solid(ctx, 'buckle', bv, bf, [SL['metal']] * len(bf), bind_point=bpt, regions=('belly', 'thighs'))
    gv, gf, gk = rl.disc(bpt + u(0) * 0.003, u(0), 0.009, n=6, depth=0.0)
    rune = rl.solid(ctx, 'buckle_gem', gv, gf, [SL['glow']] * len(gf), bind_point=bpt, regions=('belly', 'thighs'))
    for pc in (buckle, rune):
        rl.orient(pc, ctx, lambda c: u(0))
    sleeves = [bell_sleeve(ctx, s, SL['cloth1'], SL['cloth3'], SL['trim']) for s in (1, -1)]
    col = collar(ctx, SL['cloth1'], SL['trim'], SL['glow'])
    man = mantle(ctx, SL['cloth3'], SL['trim'], SL['glow'])
    for pc in (skirt, over, belt):
        rl.mark_loose(pc, ('belly', 'thighs', 'shins', 'feet'))
    for pc in (buckle, rune):
        rl.mark_loose(pc, ('belly', 'thighs', 'shins', 'feet'), rigid=True)
    for pc in sleeves:
        rl.mark_loose(pc, ('upperArms', 'forearms', 'hands'))
    for pc in (col, man):
        rl.mark_loose(pc, ('neck', 'chest', 'upperArms'))
    parts = [torso, skirt, over, belt, buckle, rune, col, man] + sleeves
    return rl.merge('chest_S', parts, ctx), hides


# ------------------------------------------------------------------ legs
def legs_F(ctx):
    p, hides = rl.leggings(ctx, 'legs_F', offset=0.005, slot=SL['cloth2'], ratio=0.15)
    rl.paint(p, ctx, lambda c, n, s, i: SL['leather'] if any(z0 < c.z < z0 + 0.035 for z0 in (0.16, 0.27, 0.38)) else None)
    rl.rim(p, ctx, 0.004, SL['leather'], where=lambda m, pts: m.z < 0.3)
    return p, hides


def legs_S(ctx):
    p, hides = rl.leggings(ctx, 'legs_S', offset=0.005, slot=SL['cloth2'], ratio=0.13)

    def deco(c, n, s, i):
        if 0.455 < c.z < 0.50:
            return SL['trim']
        side = 1 if c.x > 0 else -1
        if 0.13 < c.z < 0.44 and n.x * side > 0.82:
            return SL['glow']
        return None
    rl.paint(p, ctx, deco)
    rl.rim(p, ctx, 0.004, SL['trim'], where=lambda m, pts: m.z < 0.3)
    return p, hides


# ------------------------------------------------------------------ gloves
def gloves_F(ctx):
    p, hides = rl.gloves(ctx, 'gloves_F', offset=0.006, slot=SL['cloth2'], cuff_t=0.5, ratio=0.17)

    def stripes(c, n, s, i):
        side, d, wr, ax = arm_d(ctx, c)
        if -0.12 < d < 0.01 and int(math.floor(d / 0.017)) % 2 == 0:
            return SL['leather']
        return None
    rl.paint(p, ctx, stripes)
    rl.rim(p, ctx, 0.004, SL['leather'])
    return p, hides


def gloves_S(ctx):
    cuff_t = 0.62
    p, hides = rl.gloves(ctx, 'gloves_S', offset=0.007, slot=SL['leather'], cuff_t=cuff_t, ratio=0.22)
    sh, el, wr, tip = rl.arm_points(ctx, 1)
    cuff_len = (el - wr).length * cuff_t

    def deco(c, n, s, i):
        side, d, wr_, ax = arm_d(ctx, c)
        if -d > cuff_len - 0.040:
            return SL['metal']
        if cuff_len - 0.056 < -d <= cuff_len - 0.040:
            return SL['glow']
        along, palm = hand_axes(ctx, side)
        hc = wr_ + along * 0.042
        if d > 0.0 and n.dot(-palm) > 0.45:
            r = (c - hc).length
            if r < 0.017:
                return SL['glow']
            if r < 0.036:
                return SL['metal']
        if -0.03 < d < 0.0:
            return SL['metal']
        return None
    rl.paint(p, ctx, deco)
    rl.rim(p, ctx, 0.005, SL['trim'])
    return p, hides


# ------------------------------------------------------------------ boots
def boots_F(ctx):
    parts = []
    for side in (1, -1):
        sh = rl.shoe(ctx, 'slipper', side, offset=0.011, slot=SL['leather'], collar=0.018)
        f = sh._foot
        rl.paint(sh, ctx, lambda c, n, s, i: SL['cloth2'] if c.z > 0.105 else None)
        rl.mark_loose(sh, ('feet', 'shins'))
        parts.append(sh)
    return rl.merge('boots_F', parts, ctx), ['feet']


def boots_S(ctx):
    parts = []
    for side in (1, -1):
        sh = rl.shoe(ctx, 'boot_foot', side, offset=0.012, slot=SL['leather'], toe=0.04, curl=0.022, collar=0.01)
        A0, a, lat, s0, s1, zf = sh._foot
        rl.paint(sh, ctx, lambda c, n, s, i: SL['metal'] if (c - A0).dot(a) > s1 - 0.02 else None)
        bands = lambda r, c_: SL['leather'] if r == 1 else SL['cloth2']  # noqa: E731
        sf, idx = rl.shaft(ctx, 'boot_shaft', side, z0=0.085, z1=0.30, offset=0.012, slot=SL['cloth2'], rows=4,
                           cols=10, flare=0.012, slot_fn=bands)
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
    for key, fn in BUILDERS.items():
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

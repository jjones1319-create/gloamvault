"""build_gear_shade.py — the Shade's armour, tiers F and S (docs/classes/shade.md §9, tools/blender/README.md §Gear).

Run (from the repo root; the script opens the source blend itself — hero_species.blend when it exists, else
hero_body.blend):
    blender -b -P tools/blender/hero/build_gear_shade.py -- [--quick] [--no-render]
Outputs: art/build/gear_shade.blend, client/public/models/hero/gear_shade_{broad,slight}.glb, review renders and
build_report.md in art/renders/hero/gear/shade/. Fully re-runnable.

The set (Leather/cloth, hooded, masked; dark but readable — 11 §1: dark palettes vanish at 200 px, so the ink pieces
are broken by light ash grey and violet: a grey mask in the black hood, a grey cloak diagonal across the black back,
grey wrapped limbs, a violet edge on the jerkin's diagonal closure):
- helmet: a close hood (ink; an ink lining round the face) with a cloth half-mask (`half_mask`: from under the eyes,
  hanging straight from the nose to the chin, wrapping under it and tucked under the hood's edges; F plain ash grey,
  S dusk violet with two steel bands, a trim top edge and a glow line under the eyes). The S mask closes the throat
  off from every camera, so the S helmet hides the neck.
- chest: a fitted jerkin (ink) with sleeves past the elbow, collar turned in, a diagonal closure from the left collar
  to the right hip (F violet edge; S trim with three steel buckles and a glow seam), a standing collar.
- cloak (its own slot, the sheet's "separate cloth mesh"): a half-cloak thrown over the left shoulder — its front hem
  rises from the collarbone to the shoulder, the cap over the shoulder is short (the arm moves under it), the back
  falls to a corner swinging out past the right hip: the diagonal from the front, the back and the card angle; soft
  folds; ash grey outside, violet lining and a frayed hem (F) or a glow lining, trim edges and a steel clasp with a
  gem (S). Skinned to the torso only (the rig has no cape bones).
- legs: wrapped leggings (ash grey, ink spiral wraps on the shins) and the knife belt low on the hips with six leather
  sheaths at the front-right (S: trim rims, steel chapes, a glow line down the outer seam).
- knives (slot legs, part "knives", a separate object so the client can show it with throwing knives equipped): the
  six handles in the sheaths — light grips, a steel guard, a trim pommel, large enough to read at 200 px.
- gloves: fingerless wraps from the knuckles to above the elbow on both hands (ash grey, ink spiral wraps; S: a
  leather vambrace plate with a trim lip, two steel studs and a glow line) — they hide the forearms.
- boots: soft split-toe boots to mid-shin (ink; one tube bent at the ankle, top turned in) with two grey wraps
  following the boot (S: trim lip, steel toe caps, glow line).
Layering: the leggings' shell and the wraps are built once and shared by both tiers; the jerkin and the boots clear
them, so any F/S mix fits.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gear_rs_lib as L  # noqa: E402
from mathutils import Vector  # noqa: E402

D = math.radians
S = L.SL
CLASS = 'shade'
# review colours: content/classes/shade.json palette = ink black, dusk violet, ash grey, blackened steel
PALETTE = {'cloth1': '#15151c', 'cloth2': '#5b3b8a', 'cloth3': '#8a8a8f', 'metal': '#2e3036', 'leather': '#3b2d27',
           'ink': '#0b0b10'}
GLOW = '#b98cff'
ORDER = ['helmet', 'chest', 'cloak', 'legs', 'knives', 'gloves', 'boots']

LEG = 0.006
TORSO = 0.010
SLEEVE = 0.008
WRAP = 0.0045
BOOT = 0.011
CLOAK = 0.028


_CACHE = {}


def legging_shell(fit):
    """The leggings' shell (both tiers): the layer the jerkin's hem and the boots must clear."""
    if 'legs' not in _CACHE:
        _CACHE['legs'] = L.garment(fit, ['belly', 'thighs', 'shins', 'feet'], LEG,
                                   cuts=[dict(point=(0, 0, 1.0), normal=(0, 0, -1)), dict(point=(0, 0, 0.075), normal=(0, 0.4, 1))],
                                   smooth=3, clear=0.005, ratio=0.22, protect=L.protect_joints(fit), slot=0)
        _CACHE['legs_tree'] = _CACHE['legs'].tree()
    return _CACHE['legs']


def wrap_shell(fit, side):
    """One hand's fingerless wrap (both tiers): knuckles to above the elbow, its elbow end turned in."""
    key = 'wrap' + side
    if key not in _CACHE:
        W = fit.b.weights
        sx = 1 if side == 'Left' else -1
        keep_bones = {side + 'Hand', side + 'LowerArm', side + 'ThumbProximal'}

        def keep_face(fi, c):
            if c.x * sx <= 0:
                return False
            if fit.b.face_regions[fi] == L.REG['upperArms']:
                return True                      # just above the elbow: the cut trims it
            f = fit.b.faces[fi]
            tops = [max(W[i], key=lambda bw: bw[1])[0] if W[i] else '' for i in f]
            return sum(1 for t in tops if t in keep_bones) >= 2

        def off(p, n, r):
            return 0.003 if r == 6 else WRAP
        w = L.garment(fit, ['forearms', 'hands', 'upperArms'], WRAP, keep_face=keep_face,
                      cuts=[L.arm_cut(fit, side, -0.26, toward='hand', regions=('forearms', 'upperArms')),
                            L.arm_cut(fit, side, 0.86, toward='elbow', regions=('hands',), bone='Hand')],
                      offset_fn=off, smooth=1, clear=0.003, ratio=0.30, slot=S['cloth3'])
        elbow_z = fit.joint(side + 'LowerArm', 'head').z
        L.rim(w, -0.0035, S['cloth3'], select=lambda pts: abs(sum(q.z for q in pts) / len(pts) - elbow_z) < 0.05)
        _CACHE[key] = w
    return _CACHE[key]


def skull(fit):
    if 'skull' not in fit._trees:
        L.custom_tree(fit, 'skull', lambda r, c: r == 0 and not (abs(c.x) > 0.100 and 1.55 < c.z < 1.68 and abs(c.y) < 0.05)
                      and not (c.y < -0.05 and c.z < 1.73))
    return 'skull'


# ---------------------------------------------------------------------------------------------------------- helmet
def half_mask(fit, C):
    """A cloth half-mask: rows from under the eyes to under the chin, columns across the front (tucked under the hood's
    edges at the sides). Each column follows a tight face profile, but going down it never moves back toward the face
    until the chin — it hangs from the nose like cloth instead of following the lips."""
    mprof = L.HeadProfile(fit, C, ('head',), dilate=1, smooth=1)
    eye = fit.joint('LeftEye')
    q = Vector((0, -0.15, eye.z - 0.027)) - C
    th_top = math.acos(q.z / q.length)
    th_chin = D(134)
    th_m = [th_top + (th_chin - th_top) * i / 4 for i in range(5)] + [D(144), D(155)]
    ph_m = [D(a) for a in (-60, -44, -28, -13, 0, 13, 28, 44, 60)]
    grid = []
    for ph in ph_m:
        side = min(1.0, abs(ph) / D(55))
        fwd = Vector((math.sin(ph), -math.cos(ph), 0))
        col, f_prev = [], None
        for th in th_m:
            r = mprof.r(th, ph) + 0.0095 - 0.0025 * side
            d = L.sph(th, ph)
            if f_prev is not None and th <= th_chin:
                r = max(r, 0.985 * f_prev / max(0.2, d.dot(fwd)))     # hang: no tucking back under the nose
            p = C + d * r
            f_prev = (p - C).dot(fwd)
            col.append(p)
        grid.append(col)
    # bound away from the lips: a mouth that opens (the slight frame's, a face preset's) must not pull the cloth in
    if 'face_no_mouth' not in fit._trees:
        import bpy
        sm = bpy.data.objects.get('Socket_Mouth.broad')
        mouth = sm.matrix_world.translation.copy() if sm else Vector((0, -0.113, 1.58))
        L.custom_tree(fit, 'face_no_mouth', lambda reg, c: reg == 0 and (c - mouth).length > 0.032)
    mask = L.grid_mb(grid, 0, lambda i, r, p: ('regions', 'face_no_mouth'))
    L.orient_from(mask, C)
    return mask, th_top, ph_m


def helmet(fit, tier):
    C = Vector((0, -0.015, 1.64))
    skull(fit)
    prof = L.HeadProfile(fit, C, ('head', 'neck'))

    def clr(th, ph):
        back = 0.5 - 0.5 * math.cos(ph)
        side = abs(math.sin(ph))
        if th > D(132):
            return 0.021 + 0.008 * back
        cheek = 0.010 * side if th > D(78) else 0.0      # room for the mask's edges under the hood
        return 0.017 + 0.007 * back * math.sin(th) + cheek

    def opening(th):
        tc, h, A = D(95), D(37), D(50)
        x = (th - tc) / h
        return A * math.sqrt(1 - x * x) if abs(x) < 1 else 0.0

    V = Vector((0, 0.03, 0.016))

    def point(th, ph):
        s = min(1.0, th / D(80))
        g = 0.5 - 0.5 * math.cos(ph)
        return V * ((1 - s) ** 2 * (1 - s + s * g))

    def bind(th, ph, p):
        if th is None:
            if math.hypot(p.x, p.y + 0.015) > 0.10:
                return ('regions', ('chest',))
            return ('regions', ('neck', 'head')) if p.z > 1.43 else ('regions', ('chest', 'neck'))
        if th < D(124):
            return ('regions', 'skull')
        return ('regions', ('neck', 'head'))

    thetas = [D(a) for a in (0, 18, 36, 52, 66, 80, 94, 108, 122, 136, 148)]
    neck = [(1.468, 0.024, ('neck', 'head'), None), (1.436, 0.031, ('neck', 'chest'), None), (1.408, 0.042, ('chest',), None)]
    hood = L.hood_shell(fit, C, thetas, 12, clr, opening, neck, point=point, prof=prof, bind=bind)
    for k in range(len(hood.f)):
        hood.s[k] = S['cloth1']
    outer = L.MB().extend(hood)
    op = L.loop_where(hood, lambda c: c.y < C.y and c.z > 1.5)[0]
    extras = []
    if tier == 'S':
        extras.append(L.two_band(outer, op, [(0.010, S['trim'])], 0.0025))

    def inward(i, p, n):
        # along the surface normal (true thickness, also where the hood bulges over the ears); toward the centre
        # only round the crown and the point, where normals fan out and a normal offset would fold through itself
        return (C - p) if (p - C).normalized().z > 0.80 else -n
    L.thicken(hood, 0.009, lambda c: S['ink'] if c.z > 1.50 else S['cloth1'], S['cloth1'], inward=inward)
    # the half-mask: from under the eyes, over the nose, hanging straight down to the chin like cloth, closing under it
    mask, th_top, ph_m = half_mask(fit, C)
    mslot = S['cloth3'] if tier == 'F' else S['cloth2']
    for k in range(len(mask.f)):
        mask.s[k] = mslot
    mtree = mask.tree()
    mtop = [mask.v[mask.grid[c][0]].lerp(mask.v[mask.grid[c][1]], 0.18) for c in range(len(ph_m))]
    if tier == 'S':
        # two raised steel bands across the mask (the "scale face"), a trim top edge and a glow line under the eyes
        for th in (th_top + D(13), th_top + D(25)):
            guide = [C + L.sph(th, D(a)) * 0.3 for a in range(-48, 49, 8)]
            extras.append(L.ribbon(fit, L.polyline_on(fit, guide, 0.0022, tree=mtree), 0.008, S['metal'], ('head',)))
        top_path = [(p + (p - C).normalized() * 0.0016, (p - C).normalized()) for p in mtop]
        extras.append(L.ribbon(fit, top_path, 0.008, S['trim'], ('head',)))
        guide = [C + L.sph(th_top + D(6), D(a)) * 0.3 for a in range(-44, 45, 8)]
        extras.append(L.ribbon(fit, L.polyline_on(fit, guide, 0.0020, tree=mtree), 0.004, S['glow'], ('head',)))
    L.thicken(mask, 0.004, S['ink'], mslot)
    mb = L.merge(hood, mask, *extras)
    hides = L.covered_regions(fit, mb, ['neck'])
    return dict(mb=mb, hides=hides)


# ---------------------------------------------------------------------------------------------------------- chest
def chest(fit, tier):
    collar = dict(point=(0, -0.06, 1.468), normal=(0, 0.46, -1))
    hem = dict(point=(0, 0, 0.806), normal=(0, 0, 1))
    arms = (4, 5, 6)

    def off(p, n, r):
        return SLEEVE if r in arms else (0.009 if r == 1 else TORSO)
    jerkin = L.garment(fit, ['neck', 'chest', 'belly', 'upperArms', 'forearms', 'thighs'], TORSO,
                       cuts=[collar, hem, L.arm_cut(fit, 'Left', 0.24, regions=('forearms',)),
                             L.arm_cut(fit, 'Right', 0.24, regions=('forearms',))],
                       offset_fn=off, smooth=3, clear=0.0085, ratio=0.21, protect=L.protect_joints(fit), slot=S["cloth1"])
    under = L.merge(legging_shell(fit), wrap_shell(fit, 'Left'), wrap_shell(fit, 'Right'))
    L.inflate_faces(fit, jerkin, 0.0085, ref=under.tree(), ref_clear=0.0045)
    jtree = jerkin.tree()
    edge = S['cloth2'] if tier == 'F' else S['trim']
    L.rim(jerkin, -0.009, S['cloth1'], select=lambda pts: sum(p.z for p in pts) / len(pts) > 1.38)        # collar, turned in
    hides = L.covered_regions(fit, jerkin, ['chest', 'belly', 'upperArms'])
    L.rim(jerkin, 0.004, edge, select=lambda pts: abs(sum(p.x for p in pts) / len(pts)) > 0.2)          # sleeve ends
    L.rim(jerkin, 0.005, S['cloth1'] if tier == 'F' else S['trim'], select=lambda pts: sum(p.z for p in pts) / len(pts) < 0.9)
    parts = [jerkin]
    # a standing collar round the neck base
    na, nb = Vector((0, -0.012, 1.40)), Vector((0, -0.02, 1.50))
    col = L.tube(fit, na, nb, [0.30, 0.55], ('neck',), 12, 0.014, S['cloth1'] if tier == 'F' else S['cloth2'], centre=True)
    L.rim(col, 0.003, edge)
    parts.append(col)
    # the diagonal closure: left collar → right hip
    guide = [Vector((0.075, -0.3, 1.43)), Vector((0.02, -0.3, 1.27)), Vector((-0.05, -0.3, 1.10)), Vector((-0.115, -0.3, 0.93))]
    path = L.polyline_on(fit, guide, 0.0016, tree=jtree, samples=16)
    parts.append(L.ribbon(fit, path, 0.018, edge, ('chest', 'belly')))
    if tier == 'S':
        glow_path = [(p + n * 0.0012, n) for p, n in path]
        parts.append(L.ribbon(fit, glow_path, 0.0045, S['glow'], ('chest', 'belly')))
        for fr in (0.25, 0.5, 0.75):
            p = guide[0].lerp(guide[-1], fr)
            fp, u, v, n = L.surface_frame(fit, p, tree=jtree, off=0.004)
            parts.append(L.box(fp, u, v, n, 0.014, 0.009, 0.004, S['metal'], ('regions', ('chest', 'belly'))))
    return dict(mb=L.merge(*parts), hides=hides)


# ---------------------------------------------------------------------------------------------------------- cloak
def cloak(fit, tier):
    """The half-cloak: an attachment line from the left collarbone over the left shoulder and across the upper back,
    each column hung straight down (kept off the body), shortest at the front, longest at the right hip."""
    top_guide = [Vector(p) for p in ((0.065, -0.19, 1.415), (0.11, -0.16, 1.43), (0.16, -0.10, 1.425), (0.21, -0.01, 1.40),
                                     (0.18, 0.14, 1.40), (0.09, 0.20, 1.42), (-0.01, 0.20, 1.415), (-0.09, 0.20, 1.39),
                                     (-0.15, 0.18, 1.34), (-0.18, 0.13, 1.28))]
    top, norms = [], []
    for p in L.resample(top_guide, 0.066):
        _, loc, n, _ = fit.nearest(p, ('chest', 'neck'))
        top.append(loc + n * CLOAK)
        norms.append(n)
    ncol = len(top)
    # lengths: the front panel's hem rises from the sternum to the shoulder (the diagonal seen from the front), the cap
    # over the shoulder stays short (the arm moves under it), the back falls longer to the right hip (the diagonal from
    # behind)
    key = [(0.0, 0.16), (0.10, 0.13), (0.22, 0.10), (0.36, 0.11), (0.5, 0.20), (0.65, 0.34), (0.82, 0.48), (1.0, 0.60)]

    def length(s):
        for (a, la), (b, lb) in zip(key[:-1], key[1:]):
            if a <= s <= b:
                return la + (lb - la) * (s - a) / (b - a)
        return key[-1][1]
    lengths = [length(i / (ncol - 1)) for i in range(ncol)]
    if tier == 'F':
        lengths = [L_ + (0.022 if i % 2 else -0.012) * min(1.0, L_ / 0.2) for i, L_ in enumerate(lengths)]   # a frayed hem

    def flare(i, s):
        back = max(0.0, (top[i].y - 0.05) / 0.15)
        right = max(0.0, (-top[i].x - 0.06) / 0.1)           # the right-hip corner swings out past the hip
        fold = 0.011 * math.sin(i * 2.1) * s                  # soft vertical folds, deeper toward the hem
        return Vector((-0.04 * s * s * right, 0.03 * s * s * back, 0)) + norms[i] * fold
    grid = L.drape(fit, top, lengths, 0.075, CLOAK, flare=flare)
    # equalise rows: drape gives every column the same row count already (compressed where shorter)
    outer = L.grid_mb(grid, S['cloth3'], lambda i, r, p: ('regions', ('chest', 'belly')))
    # outward: the first face should face away from the body
    ti, loc, n, _ = fit.nearest(outer.centroid(len(outer.f) // 2))
    if outer.face_normal(len(outer.f) // 2).dot(n) < 0:
        outer.flip()
    lining = S['cloth2'] if tier == 'F' else S['glow']
    rim_slot = S['cloth3'] if tier == 'F' else S['trim']
    parts = []
    if tier == 'S':
        for lp in outer.boundary_loops():
            parts.append(L.two_band(outer, lp, [(0.012, S['trim'])], 0.002))
    L.thicken(outer, 0.010, lining, rim_slot)
    # the clasp at the left collarbone
    fp, u, v, n = L.surface_frame(fit, top[0] + Vector((0, -0.05, -0.01)), regions=('chest', 'neck'), off=CLOAK + 0.006)
    if tier == 'S':
        parts.append(L.box(fp, u, v, n, 0.016, 0.016, 0.006, S['metal'], ('regions', ('chest',))))
        parts.append(L.blob(fp + n * 0.007, 0.008, 0.008, 0.005, S['gem'], ('regions', ('chest',)), segs=6, rings=2, axes=(u, v, n), hemi=True))
    else:
        parts.append(L.blob(fp, 0.014, 0.012, 0.010, S['cloth3'], ('regions', ('chest',)), segs=6, rings=3, axes=(u, v, n)))
    return dict(mb=L.merge(outer, *parts), hides=[])


# ---------------------------------------------------------------------------------------------------------- legs + knives
def knife_layout(fit):
    """Six sheath positions on the belt's front-right, each with its frame (centre, across, down, out)."""
    out = []
    for k in range(6):
        ang = D(-12 - 12.5 * k)                # from the front toward the character's right
        guide = Vector((math.sin(ang) * 0.4, -math.cos(ang) * 0.4, 0.905))
        out.append(guide)
    return out


def legs_and_knives(fit, tier):
    mb = L.MB().extend(legging_shell(fit))
    mb.s = [S['cloth3']] * len(mb.f)
    hides = L.covered_regions(fit, mb, ['thighs', 'shins'])
    tree = mb.tree()
    L.rim(mb, 0.004, S['cloth3'])
    parts = [mb]
    for side, sx in (('Left', 1), ('Right', -1)):
        kn, an = fit.joint(side + 'LowerLeg', 'head'), fit.joint(side + 'LowerLeg', 'tail')
        parts.append(L.wrap_lines(fit, tree, kn, an, 0.12, 0.82, 2.5, 0.006, S['ink'], ('shins',), phase=0.0 if sx > 0 else math.pi,
                                  segs_per_turn=14))
        if tier == 'S':
            hp = fit.joint(side + 'UpperLeg', 'head')
            seam = [hp + Vector((sx * 0.25, 0, -0.06)), kn + Vector((sx * 0.25, 0, 0)), an + Vector((sx * 0.25, 0, 0.05))]
            parts.append(L.ribbon(fit, L.polyline_on(fit, seam, 0.0016, tree=tree, samples=22), 0.005, S['glow'], ('thighs', 'shins')))
    # the knife belt, low on the hips, over the jerkin's hem
    belt = L.tube(fit, (0, 0, 0.885), (0, 0, 0.93), [0.0, 0.5, 1.0], ('belly', 'thighs'), 16, 0.024, S['leather'], centre=True, slab=0.02)
    L.rim(belt, 0.003, S['leather'] if tier == 'F' else S['trim'])
    parts.append(belt)
    btree = belt.tree()
    knives = []
    for g in knife_layout(fit):
        fp, u, v, n = L.surface_frame(fit, g, tree=btree, off=0.002)
        tilt = (v * math.cos(D(28)) - u * math.sin(D(28))).normalized()     # sheaths lean, handles up and inward
        acr = n.cross(tilt).normalized()
        sc = fp + n * 0.009 + tilt * 0.032
        parts.append(L.box(sc, acr, tilt, n, 0.011, 0.045, 0.006, S['leather'], ('regions', ('belly', 'thighs'))))
        if tier == 'S':
            parts.append(L.box(sc + tilt * 0.047, acr, tilt, n, 0.012, 0.007, 0.0065, S['metal'], ('regions', ('belly', 'thighs'))))
        # the handle above the sheath mouth: a light grip that reads against the black jerkin, a guard, a pommel
        hc = fp + n * 0.010 - tilt * 0.040
        hc = hc - tilt * 0.008
        knives.append(L.box(hc, acr, tilt, n, 0.009, 0.042, 0.0075, S['cloth3'], ('regions', ('belly', 'thighs'))))
        knives.append(L.box(hc + tilt * 0.044, acr, tilt, n, 0.014, 0.0045, 0.0085, S['metal'], ('regions', ('belly', 'thighs'))))
        knives.append(L.box(hc - tilt * 0.049, acr, tilt, n, 0.012, 0.009, 0.0095, S['trim'], ('regions', ('belly', 'thighs'))))
    return (dict(mb=L.merge(*parts), hides=hides),
            dict(mb=L.merge(*knives), slot='legs', hides=[], props={'part': 'knives', 'handles': 6}))


# ---------------------------------------------------------------------------------------------------------- gloves
def gloves(fit, tier):
    W = fit.b.weights
    parts = []
    covered = []
    for side, sx in (('Left', 1), ('Right', -1)):
        keep_bones = {side + 'Hand', side + 'LowerArm', side + 'ThumbProximal'}

        def keep_face(fi, c, kb=keep_bones, sx=sx):
            f = fit.b.faces[fi]
            tops = [max(W[i], key=lambda bw: bw[1])[0] if W[i] else '' for i in f]
            return c.x * sx > 0 and sum(1 for t in tops if t in kb) >= 2

        def off(p, n, r):
            return 0.003 if r == 6 else WRAP
        w = L.MB().extend(wrap_shell(fit, side))
        covered.append(w)
        wt = w.tree()
        a, b = fit.joint(side + 'LowerArm', 'head'), fit.joint(side + 'LowerArm', 'tail')
        parts.append(L.wrap_lines(fit, wt, a, b, 0.12, 0.98, 2.5, 0.005, S['ink'], ('forearms',), reach=0.08, segs_per_turn=14))
        if tier == 'S':
            # a vambrace plate on the outside of the forearm
            outv = Vector((sx, 0.25, 0.1)).normalized()
            _, ploc, _, _ = fit.nearest(a.lerp(b, 0.55) + outv * 0.1, ('forearms',))
            plate = L.patch(fit, ['forearms'], ploc, 0.045, WRAP + 0.004, S['leather'], ratio=0.5, squash=(1.0, 1.0, 0.55))
            L.rim(plate, 0.003, S['trim'])
            parts.append(plate)
            pt = plate.tree()
            for fr in (0.4, 0.7):
                fp, u, v, n = L.surface_frame(fit, a.lerp(b, fr) + outv * 0.1, tree=pt, off=0.0015)
                parts.append(L.blob(fp, 0.006, 0.006, 0.004, S['metal'], ('regions', ('forearms',)), segs=6, rings=2, axes=(u, v, n), hemi=True))
            line = [a.lerp(b, 0.3) + outv * 0.1, a.lerp(b, 0.8) + outv * 0.1]
            parts.append(L.ribbon(fit, L.polyline_on(fit, line, 0.0015, tree=pt, samples=8), 0.004, S['glow'], ('forearms',)))
    shell = L.merge(*covered)
    hides = L.covered_regions(fit, shell, ['forearms'])
    for w in covered:
        L.rim(w, 0.003, S['cloth3'], select=lambda pts: sum(q.z for q in pts) / len(pts) < 0.95)   # the knuckle end
    return dict(mb=L.merge(*covered, *parts), hides=hides)


# ---------------------------------------------------------------------------------------------------------- boots
def boots(fit, tier):
    shells, parts = [], []
    for side, sx in (('Left', 1), ('Right', -1)):
        notch = D(28) if sx > 0 else D(-28)             # toward the big toe (medial)

        def split_toe(s, th, r, notch=notch):
            if s < 0.80:
                return r
            dth = abs(math.atan2(math.sin(th - notch), math.cos(th - notch)))
            if dth > D(22):
                return r
            k = (1 - dth / D(22)) * min(1.0, (s - 0.80) / 0.12)
            return r * (1 - 0.22 * k)
        legging_shell(fit)
        bt = L.boot_tube(fit, side, 0.33, 12, lambda s: BOOT - 0.002 * max(0.0, 1 - s / 0.3), 9, S['cloth1'], sole_slot=S['ink'],
                         shape=split_toe, toe_push=0.01,
                         inflate=0.0095, inflate_ref=_CACHE['legs_tree'], max_gap=0.022)
        L.rim(bt, -0.008, S['cloth1'])                    # the top turned in: no looking down the shaft at the instep
        shells.append(bt)
        kn, an = fit.joint(side + 'LowerLeg', 'head'), fit.joint(side + 'LowerLeg', 'tail')
        for z in (0.215, 0.16):
            r0, f = L.ring_at(bt, z)
            parts.append(L.ring_band(bt, bt.rows, r0, max(0.0, f - 0.24), min(1.0, f + 0.24), 0.0035, S['cloth3']))
        if tier == 'S':
            tt = bt.tree()
            line = [kn.lerp(an, 0.45) + Vector((sx * 0.2, 0, 0)), kn.lerp(an, 0.95) + Vector((sx * 0.2, 0.0, 0))]
            parts.append(L.ribbon(fit, L.polyline_on(fit, line, 0.0016, tree=tt, samples=8), 0.005, S['glow'], ('shins', 'feet')))
            toe = fit.joint(side + 'Toes', 'tail')
            fp, u, v, n = L.surface_frame(fit, toe + Vector((0, -0.05, 0.03)), tree=tt, off=0.003, down=Vector((0, -1, 0)))
            parts.append(L.blob(fp, 0.022, 0.016, 0.008, S['metal'], ('regions', ('feet',)), segs=8, rings=2, axes=(u, v, n), hemi=True))
    mb = L.merge(*shells)
    hides = L.covered_regions(fit, mb, ['feet'])
    if tier == 'S':
        for bt in shells:
            parts.append(L.two_band(bt, L.loop_where(bt, lambda c: c.z > 0.25)[0], [(0.008, S['trim'])], 0.002))
    return dict(mb=L.merge(mb, *parts), hides=hides)


def build(fit, tier):
    lg, kn = legs_and_knives(fit, tier)
    return {'helmet': helmet(fit, tier), 'chest': chest(fit, tier), 'cloak': cloak(fit, tier), 'legs': lg, 'knives': kn,
            'gloves': gloves(fit, tier), 'boots': boots(fit, tier)}


if __name__ == '__main__':
    L.run_class(CLASS, build, PALETTE, GLOW, ORDER,
                notes=['cloak: slot "cloak", skinned to the torso only (the rig has no cape bones: sway is the client\'s)',
                       'knives: slot "legs", part "knives" — the six throwing-knife handles, a separate object'])

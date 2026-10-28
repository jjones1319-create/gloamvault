"""build_gear_ranger.py — the Ranger's armour, tiers F and S (docs/classes/ranger.md §9, tools/blender/README.md §Gear).

Run (from the repo root; the script opens the source blend itself — hero_species.blend when it exists, else
hero_body.blend):
    blender -b -P tools/blender/hero/build_gear_ranger.py -- [--quick] [--no-render]
Outputs: art/build/gear_ranger.blend, client/public/models/hero/gear_ranger_{broad,slight}.glb, review renders and
build_report.md in art/renders/hero/gear/ranger/. Fully re-runnable: re-run after the body or species keys change.

The set (Leather, woodland hunter — a hood point and a bow arc):
- helmet: a deep pointed hood (moss; an ink lining round the face, a moss one in the drape) that gathers at the neck
  and drapes onto the mantle; S adds a trim band and glow line round the face, the leather cap's brim across the
  forehead, a brass throat clasp; F has a crude stitched seam over the crown. The open face leaves the throat visible
  under the chin, so the hood hides no region.
- chest: a jerkin over long undyed-cream sleeves, belted, collar and cuffs turned in, with a moss mantle over the
  shoulders; S: two rows of overlapping scales on the mantle and a trim hem band, a trim placket with brass clasps and
  buckle; F: rawhide jerkin, plain mantle, a stitched front seam, a knotted belt.
- legs: fitted leggings (F dark bark with leather knee patches, S moss with leather knee guards) and a strap round the
  left thigh (the draw side); F: stitched outer seams; S: a pouch and buckle on the strap, a glow line down the seam.
- gloves: the bow is in the right hand (build_weapons.py: BOW_SOCKET = Socket_HandR; build_clips.py draws with the
  left), so a bracer on the right forearm (fitted round the sleeve) and a three-finger shooting glove (index, middle,
  ring) on the left hand with a wrist cuff; F: grey lacing bands; S: trim edges, brass studs, a glow line.
- boots: soft knee-high boots (one tube bent at the ankle: no toes show) with a folded top and a dark sole (F leather
  with a bark fold, S bark); S: two straps following the boot with brass buckles, a trim lip on the fold, a glow line.
Layering: the leggings' shell and the jerkin are built once and shared by both tiers; the jerkin and the boots clear
the leggings' shell, the bracer and cuff the sleeve, so any F/S mix fits. The quiver is the weapons pass's (qvr_quiver
on Socket_Back), not built here.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gear_rs_lib as L  # noqa: E402
from mathutils import Vector  # noqa: E402

D = math.radians
S = L.SL
CLASS = 'ranger'
# review colours: content/classes/ranger.json palette = moss, bark, undyed cream, brass → cloth1, cloth2, cloth3, metal
PALETTE = {'cloth1': '#4f6b3a', 'cloth2': '#5b4532', 'cloth3': '#ece3cf', 'metal': '#b08d3c', 'leather': '#7d5634'}
GLOW = '#c4f27a'
ORDER = ['helmet', 'chest', 'legs', 'gloves', 'boots']

# layers, metres off the skin
LEG = 0.006
BOOT = 0.013
TORSO = 0.012
SLEEVE = 0.008
MANTLE = 0.027


protect_joints = L.protect_joints
_CACHE = {}


def legging_shell(fit):
    """The leggings' shell (both tiers share it): the layer the jerkin's hem and the boots must clear."""
    if 'legs' not in _CACHE:
        _CACHE['legs'] = L.garment(fit, ['belly', 'thighs', 'shins', 'feet'], LEG,
                                   cuts=[dict(point=(0, 0, 1.0), normal=(0, 0, -1)), dict(point=(0, 0, 0.075), normal=(0, 0.4, 1))],
                                   smooth=3, clear=0.005, ratio=0.22, protect=protect_joints(fit), slot=0)
        _CACHE['legs_tree'] = _CACHE['legs'].tree()
    return _CACHE['legs']


def jerkin_shell(fit):
    """The jerkin with its sleeves (both tiers share it; slot 0 = body, cloth3 = sleeves), inflated over the leggings.
    The bracer and the wrist cuff are fitted round its sleeves."""
    if 'jerkin' not in _CACHE:
        legging_shell(fit)
        collar = dict(point=(0, -0.06, 1.468), normal=(0, 0.46, -1))
        hem = dict(point=(0, 0, 0.806), normal=(0, 0, 1))
        arms = (4, 5, 6)

        def off(p, n, r):
            return SLEEVE if r in arms else (0.010 if r == 1 else TORSO)
        j = L.garment(fit, ['neck', 'chest', 'belly', 'upperArms', 'forearms', 'thighs', 'hands'], TORSO,
                      cuts=[collar, hem, arm_cut(fit, 'Left', 1.06), arm_cut(fit, 'Right', 1.06)],
                      offset_fn=off, smooth=4, clear=0.0085, ratio=0.19, protect=protect_joints(fit),
                      slot_fn=lambda r, c: S['cloth3'] if r in arms else 0)
        L.inflate_faces(fit, j, 0.0085, ref=_CACHE['legs_tree'], ref_clear=0.0045)
        _CACHE['jerkin'] = j
    return _CACHE['jerkin']


arm_cut = L.arm_cut


two_band = L.two_band


# ---------------------------------------------------------------------------------------------------------- helmet
def helmet(fit, tier):
    C = Vector((0, -0.015, 1.64))
    if 'skull' not in fit._trees:
        L.custom_tree(fit, 'skull', lambda r, c: r == 0 and not (abs(c.x) > 0.100 and 1.55 < c.z < 1.68 and abs(c.y) < 0.05)
                      and not (c.y < -0.05 and c.z < 1.73))
    prof = L.HeadProfile(fit, C, ('head', 'neck'))

    def clr(th, ph):
        back = 0.5 - 0.5 * math.cos(ph)
        if th > D(128):
            return 0.021 + 0.010 * back
        return 0.025 + 0.016 * back * max(0.0, math.sin(th))

    def opening(th):
        tc, h, A = D(99), D(42), D(58)
        x = (th - tc) / h
        return A * math.sqrt(1 - x * x) if abs(x) < 1 else 0.0

    V = Vector((0, 0.085, 0.055))

    def point(th, ph):
        s = min(1.0, th / D(88))
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

    thetas = [D(a) for a in (0, 18, 36, 52, 67, 82, 97, 112, 127, 142)]
    neck = [(1.47, 0.025, ('neck', 'head'), None), (1.432, 0.034, ('neck', 'chest'), None),
            (1.402, 0.050, ('chest',), None), (1.378, 0.054, ('chest',), None)]
    mb = L.hood_shell(fit, C, thetas, 12, clr, opening, neck, point=point, prof=prof, bind=bind)
    for k in range(len(mb.f)):
        mb.s[k] = S['cloth1']
    outer = L.MB().extend(mb)            # the outer surface alone, for bands and seams
    otree = outer.tree()
    op = L.loop_where(mb, lambda c: c.y < C.y and c.z > 1.5)[0]
    extras = []
    if tier == 'S':
        extras.append(two_band(outer, op, [(0.014, S['trim']), (0.006, S['glow'])], 0.0025,
                               ))
        # the leather cap's brim across the forehead, inside the opening
        brim_pts = [C + L.sph(D(64), D(a)) * 0.2 for a in range(-62, 63, 12)]
        path = L.polyline_on(fit, brim_pts, 0.006, regions=('head',))
        extras.append(L.ribbon(fit, path, 0.024, S['leather'], ('head',), thick=0.004))
        # a brass clasp under the chin, on the gather
        fp, u, v, n = L.surface_frame(fit, Vector((0, -0.20, 1.468)), tree=otree, off=0.003)
        extras.append(L.box(fp, u, v, n, 0.016, 0.012, 0.006, S['metal'], ('regions', ('neck', 'head'))))
    else:
        # a crude stitched seam from the forehead over the crown to the point and down the back
        seam = [C + L.sph(D(a), 0.0) * 0.25 for a in (58, 40, 20)] + [C + L.sph(D(a), math.pi) * 0.3 for a in (5, 30, 60, 90, 115, 138)]
        path = L.polyline_on(fit, seam, 0.0018, tree=otree, samples=22)
        extras.append(L.ribbon(fit, path, 0.007, S['trim'], ('head', 'neck', 'chest')))

    def inward(i, p, n):
        # along the surface normal (true thickness, also where the hood bulges over the ears); toward the centre
        # only round the crown and the point, where normals fan out and a normal offset would fold through itself
        return (C - p) if (p - C).normalized().z > 0.80 else -n
    # the dark lining only where it is seen (round the face); the drape's inside matches its outside, so a fold in
    # an overhead swing shows green, not a black hole
    L.thicken(mb, 0.009, lambda c: S['ink'] if c.z > 1.50 else S['cloth1'], S['cloth1'], inward=inward)
    mb.extend(*extras)
    hides = L.covered_regions(fit, mb, ['neck'])
    return dict(mb=mb, hides=hides)


# ---------------------------------------------------------------------------------------------------------- chest
def chest(fit, tier):
    body_slot = S['leather'] if tier == 'F' else S['cloth2']
    jerkin = L.MB().extend(jerkin_shell(fit))
    jerkin.s = [body_slot if sl == 0 else sl for sl in jerkin.s]
    jtree = jerkin.tree()
    jv = list(jerkin.v)
    # cuffs and collar turned in toward the skin (closes the gap a camera could look down), the hem's lip out
    L.rim(jerkin, -0.007, S['cloth3'], select=lambda pts: abs(sum(p.x for p in pts) / len(pts)) > 0.3)        # cuffs
    L.rim(jerkin, -0.009, body_slot, select=lambda pts: sum(p.z for p in pts) / len(pts) > 1.38)              # collar
    hides = L.covered_regions(fit, jerkin, ['chest', 'belly', 'upperArms', 'forearms'])
    L.rim(jerkin, 0.005, body_slot if tier == 'F' else S['trim'], select=lambda pts: sum(p.z for p in pts) / len(pts) < 0.9)  # hem
    parts = [jerkin]
    # the belt, hugging the jerkin
    belt = L.tube(fit, (0, 0, 0.928), (0, 0, 0.982), [0.0, 0.5, 1.0], ('belly', 'thighs'), 16, 0.004, S['leather'],
                  centre=True, points=[p for p in jv if abs(p.x) < 0.2], slab=0.02)
    L.rim(belt, 0.003, S['leather'] if tier == 'F' else S['trim'])
    parts.append(belt)
    front = L.surface_frame(fit, Vector((0, -0.25, 0.955)), tree=belt.tree(), off=0.002)
    if tier == 'S':
        fp, u, v, n = front
        parts.append(L.box(fp, u, v, n, 0.024, 0.02, 0.006, S['metal'], ('regions', ('belly', 'thighs'))))
        # a trim placket down the front with three brass clasps
        pl = L.polyline_on(fit, [Vector((0, -0.3, z)) for z in (1.40, 1.30, 1.20, 1.10, 1.0)], 0.0018, tree=jtree, samples=8)
        parts.append(L.ribbon(fit, pl, 0.026, S['trim'], ('chest', 'belly'), thick=0.0))
        for z in (1.29, 1.10):
            fp, u, v, n = L.surface_frame(fit, Vector((0, -0.3, z)), tree=jtree, off=0.004)
            parts.append(L.box(fp, u, v, n, 0.016, 0.009, 0.004, S['metal'], ('regions', ('chest', 'belly'))))
    else:
        fp, u, v, n = front
        parts.append(L.blob(fp + u * 0.05 + n * 0.006, 0.016, 0.012, 0.012, S['leather'], ('regions', ('belly', 'thighs')),
                            segs=6, rings=3, axes=(u, v, n)))
        pl = L.polyline_on(fit, [Vector((0.0, -0.3, z)) for z in (1.40, 1.30, 1.20, 1.10, 1.0)], 0.0018, tree=jtree, samples=12)
        parts.append(L.ribbon(fit, pl, 0.007, S['trim'], ('chest', 'belly')))
    # the mantle over the shoulders
    mcollar = dict(point=(0, -0.06, 1.47), normal=(0, 0.46, -1))
    mantle = L.garment(fit, ['neck', 'chest', 'upperArms'], MANTLE,
                       cuts=[mcollar, dict(point=(0, 0, 1.30), normal=(0, 0, 1))],
                       smooth=6, clear=0.021, ratio=0.25, slot=S['cloth1'])
    mtree = mantle.tree()
    hem_loops = L.loop_where(mantle, lambda c: c.z < 1.40)
    if tier == 'S':
        for lp in hem_loops:
            parts.append(two_band(mantle, lp, [(0.013, S['trim'])], 0.002, closed=True))
        # two rows of overlapping scales
        rows = []
        for z, sp in ((1.395, 0.072), (1.35, 0.072)):
            for chain in L.plane_loops(mantle, z):
                rows += L.resample(chain, sp, closed=(chain[0] - chain[-1]).length < 1e-4)
        parts.append(L.tiles(fit, rows, (0.07, 0.06), S['cloth1'], ('chest', 'upperArms', 'neck'), 0.004, tilt=0.008,
                             tree=mtree))
    L.rim(mantle, 0.006, S['cloth1'], select=lambda pts: sum(p.z for p in pts) / len(pts) < 1.40)
    parts.insert(1, mantle)
    return dict(mb=L.merge(*parts), hides=hides)


# ---------------------------------------------------------------------------------------------------------- legs
def legs(fit, tier):
    slot = S['cloth2'] if tier == 'F' else S['cloth1']
    mb = L.MB().extend(legging_shell(fit))
    mb.s = [slot] * len(mb.f)
    hides = L.covered_regions(fit, mb, ['thighs', 'shins'])
    tree = mb.tree()
    pts = list(mb.v)
    L.rim(mb, 0.004, slot)
    parts = [mb]
    hip, knee = fit.joint('LeftUpperLeg', 'head'), fit.joint('LeftLowerLeg', 'head')
    strap = L.tube(fit, hip, knee, [0.40, 0.47], ('thighs',), 12, 0.004, S['leather'], points=pts, slab=0.02)
    L.rim(strap, 0.003, S['leather'] if tier == 'F' else S['trim'])
    parts.append(strap)
    for side, sx in (('Left', 1), ('Right', -1)):
        hp, kn = fit.joint(side + 'UpperLeg', 'head'), fit.joint(side + 'LowerLeg', 'head')
        an = fit.joint(side + 'LowerLeg', 'tail')
        # the outer seam: F stitches (trim), S a glow line
        seam = [hp + Vector((sx * 0.25, 0, -0.04)), kn + Vector((sx * 0.25, 0, 0)), an + Vector((sx * 0.25, 0, 0.03))]
        path = L.polyline_on(fit, seam, 0.0016, tree=tree, samples=24)
        parts.append(L.ribbon(fit, path, 0.006, S['trim'] if tier == 'F' else S['glow'], ('thighs', 'shins')))
        # knee patch (F, bark hide) / knee guard (S, leather with a trim lip): a conforming patch on the kneecap
        _, kloc, _, _ = fit.nearest(kn + Vector((0, -0.12, 0.0)), ('thighs', 'shins'))
        kp = L.patch(fit, ['thighs', 'shins'], kloc, 0.05 if tier == 'F' else 0.058, LEG + 0.0035,
                     S['leather'], ratio=0.45, squash=(1.2, 1.0, 0.85))
        L.rim(kp, 0.003, S['leather'] if tier == 'F' else S['trim'])
        parts.append(kp)
    if tier == 'S':
        # a pouch and a buckle on the thigh strap (outer side)
        st = strap.tree()
        fp, u, v, n = L.surface_frame(fit, hip.lerp(knee, 0.46) + Vector((0.25, -0.02, 0)), tree=st, off=0.001)
        parts.append(L.box(fp + n * 0.018 + v * 0.03, u, v, n, 0.032, 0.04, 0.018, S['leather'], ('regions', ('thighs',)), bevel=0.25))
        parts.append(L.box(fp + n * 0.037 + v * 0.0, u, v, n, 0.034, 0.012, 0.002, S['trim'], ('regions', ('thighs',))))
        fp2, u2, v2, n2 = L.surface_frame(fit, hip.lerp(knee, 0.435) + Vector((0.05, -0.25, 0)), tree=st, off=0.003)
        parts.append(L.box(fp2, u2, v2, n2, 0.012, 0.012, 0.004, S['metal'], ('regions', ('thighs',))))
    return dict(mb=L.merge(*parts), hides=hides)


# ---------------------------------------------------------------------------------------------------------- gloves
def gloves(fit, tier):
    rim_slot = S['leather'] if tier == 'F' else S['trim']
    parts = []
    # bracer on the bow arm (right forearm), over the sleeve
    a, b = fit.joint('RightLowerArm', 'head'), fit.joint('RightLowerArm', 'tail')
    sleeve_r = [p for p in jerkin_shell(fit).v if p.x < -0.2]
    sleeve_l = [p for p in jerkin_shell(fit).v if p.x > 0.2]
    br = L.tube(fit, a, b, [0.24, 0.58, 0.92], ('forearms',), 12, 0.0055, S['leather'], points=sleeve_r, slab=0.02)
    L.rim(br, 0.004, rim_slot)
    parts.append(br)
    btree = br.tree()
    out_dir = Vector((-1, 0.0, 0.25)).normalized()      # the outside of the right forearm
    if tier == 'F':
        for t in (0.36, 0.55, 0.74):   # crude lacing: thin grey bands round the bracer
            parts.append(L.tube(fit, a, b, [t - 0.012, t + 0.012], ('forearms',), 12, 0.009, S['trim'], points=sleeve_r, slab=0.02))
    else:
        for t in (0.35, 0.55, 0.75):
            fp, u, v, n = L.surface_frame(fit, a.lerp(b, t) + out_dir * 0.2, tree=btree, off=0.002)
            parts.append(L.blob(fp, 0.007, 0.007, 0.005, S['metal'], ('regions', ('forearms',)), segs=6, rings=2, axes=(u, v, n), hemi=True))
        line = [a.lerp(b, 0.25) + Vector((0, -0.2, 0)), a.lerp(b, 0.9) + Vector((0, -0.2, 0))]
        parts.append(L.ribbon(fit, L.polyline_on(fit, line, 0.0016, tree=btree, samples=8), 0.006, S['glow'], ('forearms',)))
    # three-finger shooting glove on the draw hand (left)
    keep_bones = {'LeftHand'} | {'Left%s%s' % (f, p) for f in ('Index', 'Middle', 'Ring') for p in ('Proximal', 'Intermediate', 'Distal')}
    W = fit.b.weights

    def keep_face(fi, c):
        f = fit.b.faces[fi]
        tops = [max(W[i], key=lambda bw: bw[1])[0] if W[i] else '' for i in f]
        return sum(1 for t in tops if t in keep_bones) >= 2 and c.x > 0
    la, lb = fit.joint('LeftLowerArm', 'head'), fit.joint('LeftLowerArm', 'tail')
    glove = L.garment(fit, ['hands'], 0.0035, keep_face=keep_face, cuts=[arm_cut(fit, 'Left', 0.97, toward='hand', regions=('hands',))],
                      smooth=1, clear=0.0025, ratio=0.32, slot=S['leather'])
    L.rim(glove, 0.0025, S['leather'])
    parts.append(glove)
    cuff = L.tube(fit, la, lb, [0.84, 0.99], ('forearms', 'hands'), 12, 0.005, S['leather'], points=sleeve_l, slab=0.02)
    L.rim(cuff, 0.003, rim_slot)
    parts.append(cuff)
    if tier == 'S':
        fp, u, v, n = L.surface_frame(fit, la.lerp(lb, 0.915) + Vector((0.2, -0.05, 0.1)), tree=cuff.tree(), off=0.002)
        parts.append(L.blob(fp, 0.008, 0.008, 0.005, S['metal'], ('regions', ('forearms', 'hands')), segs=6, rings=2, axes=(u, v, n), hemi=True))
    return dict(mb=L.merge(*parts), hides=[])


# ---------------------------------------------------------------------------------------------------------- boots
def boots(fit, tier):
    legging_shell(fit)
    shaft = S['leather'] if tier == 'F' else S['cloth2']
    parts, shells = [], []
    for side, sx in (('Left', 1), ('Right', -1)):
        # soft knee-high boot: one tube from below the knee round the ankle to the toe; a slight flare at the top
        bt = L.boot_tube(fit, side, 0.452, 12, lambda s: BOOT + 0.004 * max(0.0, 0.25 - s) / 0.25, 9, shaft,
                         sole_slot=S['ink'], toe_push=0.008, inflate=0.0105, inflate_ref=_CACHE['legs_tree'])
        L.rim(bt, 0.004, shaft, select=lambda pts: sum(p.z for p in pts) / len(pts) > 0.3)
        shells.append(bt)
        kn, an = fit.joint(side + 'LowerLeg', 'head'), fit.joint(side + 'LowerLeg', 'tail')
        # the folded top: a flared cuff over the shaft's top edge
        fold = L.tube(fit, kn, an, [0.015, 0.10], ('shins',), 12,
                      lambda t: BOOT + 0.012 + 0.008 * max(0.0, 0.10 - t) / 0.085, S['cloth2'])
        L.rim(fold, 0.004, S['cloth2'] if tier == 'F' else S['trim'])
        parts.append(fold)
        if tier == 'S':
            for z in (0.215, 0.16):
                r0, f = L.ring_at(bt, z)
                st = L.ring_band(bt, bt.rows, r0, max(0.0, f - 0.22), min(1.0, f + 0.22), 0.004, S['leather'])
                parts.append(st)
                fp, u, v, n = L.surface_frame(fit, kn.lerp(an, (kn.z - z) / (kn.z - an.z)) + Vector((sx * 0.2, -0.02, 0)), tree=st.tree(), off=0.002)
                parts.append(L.box(fp, u, v, n, 0.011, 0.01, 0.004, S['metal'], ('regions', ('shins', 'feet'))))
            line = [kn.lerp(an, 0.2) + Vector((sx * 0.2, 0, 0)), kn.lerp(an, 0.72) + Vector((sx * 0.2, 0, 0))]
            parts.append(L.ribbon(fit, L.polyline_on(fit, line, 0.0016, tree=bt.tree(), samples=10), 0.006, S['glow'], ('shins',)))
    mb = L.merge(*shells)
    hides = L.covered_regions(fit, mb, ['feet'])
    return dict(mb=L.merge(mb, *parts), hides=hides)


def build(fit, tier):
    return {'helmet': helmet(fit, tier), 'chest': chest(fit, tier), 'legs': legs(fit, tier), 'gloves': gloves(fit, tier),
            'boots': boots(fit, tier)}


if __name__ == '__main__':
    L.run_class(CLASS, build, PALETTE, GLOW, ORDER,
                notes=['bow hand: right (weapons pass BOW_SOCKET); bracer right forearm, shooting glove left hand',
                       'quiver: built by the weapons pass (qvr_quiver on Socket_Back)'])

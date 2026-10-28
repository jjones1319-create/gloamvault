"""build_zombie.py — the `zombie` base on the hero rig (docs/06-MONSTERS.md §3.2–§3.3, §3.5; README → Monsters).

Run:  blender -b -P tools/blender/monsters/build_zombie.py -- [--quick] [--no-render] [--no-export]
Opens art/build/hero_species.blend (humanoid_lib.Session), builds every variant, renders the review set into
art/renders/monsters/zombie/, saves art/build/monsters_zombie.blend, writes client/public/models/monsters/zombie.glb
and merges the variants into manifest.json.

A zombie is the hero body (decimated, `Session.body_copy`) with its own shape keys, skin in the monster's main colour
(slot 0), milky eyes (slot 3), wounds and rot painted into its faces, and rags built with gear_loft over it; the body
under the rags is culled. Shape keys are built from one displacement field (`humanoid_lib.RadialField`: away from or
toward each bone's axis, blended by the weights, so joints stay still) and given to the rags too, so nothing pokes
through when a key is on. Variants:
- shambling-corpse — `var_swollen`, a torn tunic and ragged breeches, black-blood wounds, the left arm hanging
  broken (`poseHold` on the left arm);
- bursting-corpse — `var_belly` (1.0; the client raises it to 1.35 for the Swell tell) and `var_cheeks`, the belly kept
  dense and lit with gas-green cracks (glow), ragged breeches only;
- ghoul (0.95) — `var_gaunt`, long arms (`boneScales`), a hunch (`poseAdd`), black gums, bared teeth, red claws, a
  loincloth;
- drowned-thrall — `var_bloat`, barnacle crusts, kelp in the hair and over the shoulders, the cult's grey rags;
- charnel-hulk (2.2) — `var_bulk`, a second torso grown out of the right shoulder, black stitching, bruised patches,
  a loincloth and straps, a hunch.
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import humanoid_lib as H  # noqa: E402
from common import BUILD, args, log, save_blend  # noqa: E402

ARGS = args()
QUICK = bool(ARGS.get('quick'))
BASE = 'zombie'
D = math.radians
V = Vector
SKIN, SECOND, ACC, EYE, INK, CLOTH, CLOTH2, LEATHER, METAL, GLOW, BONE = 0, 1, 2, 3, 5, 6, 7, 8, 9, 11, 13
SPINE = ['Hips', 'Spine', 'Chest', 'UpperChest', 'Neck']


# ====================================================================== fields for the shape keys
LIMB = ['UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot']


def both(d):
    out = {}
    for k, v in d.items():
        if k in LIMB or k in ('Shoulder', 'Toes'):
            out['Left' + k] = v
            out['Right' + k] = v
        else:
            out[k] = v
    return out


def belly_bulge(amount=0.11, zc=1.02, w=0.12):
    def f(co, region):
        if region not in (2, 3, 7):
            return V((0, 0, 0))
        dh = V((co.x, co.y - 0.02, 0.0))
        if dh.length < 1e-6:
            return V((0, 0, 0))
        dirn = dh.normalized()
        g = math.exp(-((co.z - zc) / w) ** 2)
        front = 0.3 + 0.7 * max(0.0, -dirn.y)
        return dirn * (amount * g * front)
    return f


def cheek_puff(amount=0.016):
    def f(co, region):
        if region != 0 or co.y > -0.04:
            return V((0, 0, 0))
        ax = abs(co.x)
        g = math.exp(-((co.z - 1.585) / 0.03) ** 2) * math.exp(-((ax - 0.06) / 0.03) ** 2)
        return V((math.copysign(0.8, co.x), -0.5, 0.0)).normalized() * (amount * g)
    return f


def sunken_face(amount=0.008):
    def f(co, region):
        if region != 0 or co.y > -0.03:
            return V((0, 0, 0))
        ax = abs(co.x)
        g = math.exp(-((co.z - 1.585) / 0.028) ** 2) * math.exp(-((ax - 0.058) / 0.025) ** 2)
        return V((-math.copysign(0.7, co.x), 0.6, 0.0)).normalized() * (amount * g)
    return f


def combine(*fs):
    def f(co, region):
        d = V((0, 0, 0))
        for g in fs:
            d += g(co, region)
        return d
    return f


# ====================================================================== rags (gear_loft)
def tunic(sess, K, slot, hem=0.80, ragged=0.06, sleeves=True, cols=16, seed=1.0):
    """A torn sleeveless-or-short-sleeved tunic: torso rows from the collar to a ragged hem."""
    import gear_loft as L
    T = K.torso
    ths = L.circle(cols)
    zs = [1.455, 1.40, 1.31, 1.20, 1.09, 0.98, 0.89]
    rows = [[T.pt(K.tz(z), th, 0.011 if z > 1.0 else 0.014) for th in ths] for z in zs]
    hemrow = []
    for q, th in enumerate(ths):
        z = hem - ragged * (0.5 + 0.5 * math.sin(q * 2.3 + seed)) - (0.04 if q % 3 == 0 else 0.0)
        hemrow.append(T.pt(K.tz(z), th, 0.018))
    rows.append(hemrow)
    flange = [T.pt(K.tz(1.46), th, 0.002) for th in ths]
    g = L.Grid()
    g.rows([flange] + rows, slot, closed=True)
    parts = [L.Part('tunic', sess.fg.piece('tunic', g, K.f_torso), smooth=2, clear=0.008)]
    if sleeves:
        for sgn in (1, -1):
            A = K.uarm
            sth = L.circle(8)
            spec = [(-0.06, 0.002), (-0.04, 0.012), (0.25, 0.012), (0.42, 0.013)]
            rr = []
            for t, o in spec:
                rr.append([A.pt(t, th, o) for th in sth])
            last = [A.pt(0.5 + 0.12 * math.sin(q * 1.9 + seed), th, 0.014) for q, th in enumerate(sth)]
            rr.append(last)
            sg = L.Grid()
            sg.rows(rr, slot, closed=True)
            if sgn < 0:
                sg = sg.mirrored()
            sel = K.side(sgn, ['upperArms', 'forearms', 'chest'], xmin=0.10)
            parts.append(L.Part('sleeve_%d' % sgn, sess.fg.piece('sleeve_%d' % sgn, sg, sel), smooth=1, clear=0.006,
                                over=('tunic',), gap=0.002, reach=0.03))
    return parts


def breeches(sess, K, slot, knee=0.92, ragged=0.10, seed=0.0):
    """Ragged breeches: a hip band and two thigh tubes ending in torn hems above or at the knee."""
    import gear_loft as L
    T = K.torso
    ths = L.circle(16)
    rows = [[T.pt(K.tz(z), th, o) for th in ths] for z, o in ((1.02, 0.006), (0.95, 0.010), (0.88, 0.012), (0.82, 0.013))]
    g = L.Grid()
    g.rows(rows, slot, closed=True)
    parts = [L.Part('hipband', sess.fg.piece('hipband', g, sess.fg.fsel(['belly', 'thighs'])), smooth=2, clear=0.006)]
    for sgn in (1, -1):
        A = K.thigh
        lth = L.circle(10)
        rr = [[A.pt(t, th, 0.011) for th in lth] for t in (0.0, 0.3, 0.6)]
        rr.append([A.pt(knee - ragged * (0.5 + 0.5 * math.sin(q * 2.7 + seed + sgn)), th, 0.013)
                   for q, th in enumerate(lth)])
        lg = L.Grid()
        lg.rows(rr, slot, closed=True)
        if sgn < 0:
            lg = lg.mirrored()
        sel = K.side(sgn, ['thighs', 'shins'])
        parts.append(L.Part('leg_%d' % sgn, sess.fg.piece('leg_%d' % sgn, lg, sel), smooth=1, clear=0.006))
    return parts


def loincloth(sess, K, slot, belt=None, length=0.22):
    import gear_loft as L
    T = K.torso
    ths = L.circle(16)
    band = [[T.pt(K.tz(z), th, o) for th in ths] for z, o in ((0.99, 0.006), (0.955, 0.010), (0.92, 0.010))]
    g = L.Grid()
    g.rows(band, belt if belt is not None else slot, closed=True)
    parts = [L.Part('loinband', sess.fg.piece('loinband', g, sess.fg.fsel(['belly', 'thighs'])), smooth=2, clear=0.006)]
    for name, th0 in (('front', 0.0), ('back', 180.0)):
        cols = [th0 - 26, th0 - 9, th0 + 9, th0 + 26]
        rr = []
        for z in (0.93, 0.86, 0.93 - length):
            rr.append([T.pt(K.tz(max(z, 0.62)), D(c), 0.02) for c in cols])
        # the flap hangs straight below the crotch
        low = rr[-1]
        y0 = rr[1][1].y
        rr[-1] = [V((p.x * 0.9, y0 + (-0.012 if name == 'front' else 0.012), 0.93 - length)) for p in low]
        fg = L.Grid()
        fg.rows(rr, slot)
        parts.append(L.Part('flap_' + name, sess.fg.piece('flap_' + name, fg), allow=['Hips', 'LeftUpperLeg', 'RightUpperLeg'],
                            smooth=2, clear=0.01, cap={'LeftUpperLeg': 0.4, 'RightUpperLeg': 0.4}))
    return parts


def stitches(sess, K, slot):
    """Stitched seams where the Hulk's corpses were joined, as raised bands on the skin with cross-stitches (round 2:
    seams painted into the decimated body's big faces read as jagged black triangles): round the waist, down the
    breastbone, round the left upper arm, the right forearm and the left thigh."""
    import gear_loft as L
    g_t = L.Grid()
    T = K.torso
    ths = L.circle(18)
    rows = [[T.pt(K.tz(z), th, o) for th in ths] for z, o in ((1.022, 0.004), (1.03, 0.007), (1.038, 0.004))]
    g_t.rows(rows, slot, closed=True)
    zs = [1.38, 1.30, 1.22, 1.14, 1.08]
    rows = [[T.pt(K.tz(z), D(a), o) for z in zs] for a, o in ((-2.2, 0.004), (0.0, 0.007), (2.2, 0.004))]
    g_t.rows(rows, slot)
    for q, th in enumerate(ths):
        if q % 2 == 0:
            c = T.pt(K.tz(1.03), th, 0.0075)
            g_t.box(c, T.dir(th).cross(V((0, 0, 1))).normalized() * 0.003, T.dir(th) * 0.002, V((0, 0, 0.016)), slot)
    for z in zs[1:-1]:
        c = T.pt(K.tz(z), 0.0, 0.0075)
        g_t.box(c, V((0.016, 0, 0)), V((0, 0.002, 0)), V((0, 0, 0.003)), slot)
    parts = [L.Part('seams_torso', sess.fg.piece('seams_torso', g_t, K.f_torso), allow=SPINE, smooth=2, clear=0.003)]
    for key, field, t, sign, sel_regions in (('seam_uarm', K.uarm, 0.32, 1, ['upperArms', 'chest']),
                                            ('seam_farm', K.farm, 0.45, -1, ['forearms', 'upperArms']),
                                            ('seam_thigh', K.thigh, 0.45, 1, ['thighs'])):
        lth = L.circle(10)
        rr = [[field.pt(t + dt, th, o) for th in lth] for dt, o in ((-0.025, 0.004), (0.0, 0.007), (0.025, 0.004))]
        g = L.Grid()
        g.rows(rr, slot, closed=True)
        for q, th in enumerate(lth):
            c = field.pt(t, th, 0.0075)
            g.box(c, field.dir(th).cross(field.axis).normalized() * 0.003, field.dir(th) * 0.002, field.axis * 0.016, slot)
        if sign < 0:
            g = g.mirrored()
        sel = K.side(sign, sel_regions)
        parts.append(L.Part(key, sess.fg.piece(key, g, sel), smooth=1, clear=0.003))
    return parts


def straps(sess, K, slot):
    """Two leather straps crossing the chest (the Hulk's harness)."""
    import gear_loft as L
    T = K.torso
    g = L.Grid()
    for th0, th1 in ((-55, 125), (55, -125)):
        pts = []
        for q in range(8):
            s = q / 7
            pts.append((H.lerp(1.40, 1.0, s), D(H.lerp(th0, th1, s))))
        rows = [[T.pt(K.tz(z + dz), th, 0.012) for z, th in pts] for dz in (-0.025, 0.025)]
        sg = L.Grid()
        sg.rows(rows, slot)
        g.extend(sg)
    return [L.Part('straps', sess.fg.piece('straps', g, K.f_torso), allow=SPINE, smooth=2, clear=0.012)]


# ====================================================================== painted details
def blotches(spots):
    """face_slot rule: faces within any (centre, radius, slot) spot get that slot."""
    def f(c, n, region, kind):
        if kind == 1:
            return None
        for centre, r, slot in spots:
            if (c - V(centre)).length < r:
                return slot
        return None
    return f


def belly_cracks(slot_glow, core=V((0.0, -0.13, 1.02))):
    def f(c, n, region, kind):
        if kind == 1 or region not in (2, 3):
            return None
        d = c - core
        if d.y > 0.07 or c.y > -0.02:
            return None
        r = math.hypot(d.x, d.z)
        if r < 0.045:
            return slot_glow
        ang = math.atan2(d.z, d.x)
        if r < 0.16 and abs(math.sin(ang * 3.0 + r * 18.0)) < 0.22:
            return slot_glow
        return None
    return f


def plane_bands(planes, slot, width=0.012):
    """face_slot rule: faces whose centre lies within `width` of any plane (point, normal[, (zmin, zmax)[, xsign]]) —
    stitched seams, each limited to a height range (and side) so a seam crosses only what it should."""
    def f(c, n, region, kind):
        if kind == 1:
            return None
        for pl in planes:
            p, nn = pl[0], pl[1]
            if len(pl) > 2 and not (pl[2][0] <= c.z <= pl[2][1]):
                continue
            if len(pl) > 3 and c.x * pl[3] < 0:
                continue
            if abs((c - V(p)).dot(V(nn).normalized())) < width:
                return slot
        return None
    return f


def first(*fs):
    def f(c, n, region, kind):
        for g in fs:
            r = g(c, n, region, kind)
            if r is not None:
                return r
        return None
    return f


# ====================================================================== kits
def teeth_strip(slot=BONE):
    """Bared teeth over the closed mouth (on Head): an upper and a lower sawtooth row."""
    k = H.Kit()
    # the mouth line on the broad body is at z 1.561, the lips' front at y −0.164, the corners at x ±0.03
    for z_top, z_tip, off in ((1.574, 1.558, 0.0), (1.547, 1.562, 0.5)):
        xs = [-0.03 + 0.06 * (q + off) / 6 for q in range(7)]
        xs = [x for x in xs if abs(x) <= 0.0305]
        for x0, x1 in zip(xs, xs[1:]):
            xm = (x0 + x1) / 2
            y0 = -0.171 + 21.0 * x0 * x0
            y1 = -0.171 + 21.0 * x1 * x1
            ym = -0.172 + 21.0 * xm * xm
            a, b, t = V((x0, y0, z_top)), V((x1, y1, z_top)), V((xm, ym, z_tip))
            fn = (b - a).cross(t - b)
            f = (a, b, t) if fn.y < 0 else (b, a, t)
            k.add(list(f), [(0, 1, 2)], slot)
    return k


def claws(sess, slot):
    """Long claws on the finger tips: one cone per distal bone (entries for Session.multi)."""
    out = []
    for pre in ('Left', 'Right'):
        for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Little'):
            bn = pre + f + 'Distal'
            a, b = sess.joint(bn), sess.joint(bn, 'tail')
            d = (b - a).normalized()
            k = H.Kit()
            k.cone(b - d * 0.008, b + d * 0.046 + V((0, -0.01, -0.006)), 0.0082, 4, slot)
            out.append((k, bn))
    return out


def barnacles(spots, slot, seed=0.0):
    """Clusters of little cones (world space) at (centre, outward normal, count)."""
    k = H.Kit()
    for ci, (c, n, cnt) in enumerate(spots):
        c, n = V(c), V(n).normalized()
        t1 = n.orthogonal().normalized()
        t2 = n.cross(t1)
        for q in range(cnt):
            a = q * 2.399 + seed + ci
            r = 0.016 + 0.011 * (q % 3)
            p = c + (t1 * math.cos(a) + t2 * math.sin(a)) * r * (0.5 + 0.5 * (q % 2))
            h = 0.016 + 0.006 * ((q + ci) % 3)
            k.lathe([(0.014 - 0.002 * (q % 3), 0.0), (0.007, h)], 5, slot, axis=n, centre=p - n * 0.004, cap0=None,
                    cap1='flat')
    return k


def kelp(slot=ACC, n=9, length=0.34):
    """Kelp hanging from the crown (on Head): flat-ish 3-sided strands that start on the scalp and fall past the
    ears and the back of the neck to the shoulders."""
    k = H.Kit()
    C = V((0.0, 0.004, 1.672))
    for q in range(n):
        a = D(-120 + 240 * q / (n - 1)) + math.pi       # round the back and sides, none over the face
        dirn = V((math.sin(a), -math.cos(a), 0.0))
        top = C + dirn * 0.055 + V((0, 0, 0.105))
        mid = C + dirn * 0.104 + V((0, 0, 0.03))
        low = C + dirn * 0.112 + V((0, 0, -0.07))
        end = C + dirn * (0.11 + 0.02 * (q % 2)) + V((0.012 * math.sin(q * 1.7), 0, -0.07 - length * (0.7 + 0.3 * (q % 3) / 2)))
        k.tube([top, mid, low, end], [0.012, 0.011, 0.009, 0.004], 3, slot, 'flat', 'apex', scale_xz=(1.0, 0.45))
    return k


def second_torso(sess, src):
    """The Hulk's second torso: the head, neck, chest and upper arms of a body copy, shrunk, tilted out of the right
    shoulder and fused into it. Returns the kept object (rigid on UpperChest and the right shoulder)."""
    import toon
    ob = src
    H.cut_faces(ob, lambda c, region, bone: region not in (0, 1, 2, 4) or c.z < 1.18)
    piv = V((0.0, 0.0, 1.24))
    M = (Matrix.Translation(V((-0.205, 0.035, 1.36))) @ Matrix.Rotation(D(-14), 4, 'Z') @
         Matrix.Rotation(D(-42), 4, 'Y') @ Matrix.Rotation(D(8), 4, 'X') @ Matrix.Scale(0.72, 4) @
         Matrix.Translation(-piv))
    me = ob.data
    for v in me.vertices:
        v.co = M @ v.co
    na = me.attributes.get('_n')
    if na:
        R = M.to_3x3().normalized()
        for i in range(len(me.vertices)):
            na.data[i].vector = (R @ V(na.data[i].vector)).normalized()
    me.update()
    for g in list(ob.vertex_groups):
        ob.vertex_groups.remove(g)
    gu = ob.vertex_groups.new(name='UpperChest')
    gs = ob.vertex_groups.new(name='RightShoulder')
    for v in me.vertices:
        gu.add([v.index], 0.65, 'REPLACE')
        gs.add([v.index], 0.35, 'REPLACE')
    return ob


# ====================================================================== the variants
VARIANTS = [
    dict(id='shambling-corpse', scale=1.0,
         colors=H.palette('#7b8f6e', '#5b4632', '#1c1010', iris='#cfd2b0', ink='#120d0d', cloth2='#4d3e2e',
                          leather='#3e2f22'),
         shapes={'var_swollen': 0.8},
         # the broken arm: the shoulder dropped, the arm hanging turned in, the elbow bent the wrong way, the hand limp
         poseHold={'LeftShoulder': (0, 0, -16), 'LeftUpperArm': (12, 42, -26), 'LeftLowerArm': (-14, 0, 0),
                   'LeftHand': (36, 0, 12)},
         poseAdd={'Spine': (6, 0, -3), 'Neck': (8, 0, 12), 'Head': (6, 0, 8)},
         clipMap={'Attack1': 'Attack_Light', 'Attack2': 'Attack_Heavy', 'Rise': 'Revive'}),
    dict(id='bursting-corpse', scale=1.0,
         colors=H.palette('#6e4f6b', '#8cff5a', '#e3d8bd', iris='#d8d0b0', ink='#140c12', glow='#8cff5a',
                          cloth2='#5e5446', leather='#3e2f22'),
         shapes={'var_belly': 1.0, 'var_cheeks': 1.0},
         clipMap={'Attack1': 'Attack_Light', 'Attack2': 'Roar', 'Swell': 'Roar', 'Burst': 'Defeat'},
         notes='Swell tell: raise var_belly 1.0 -> 1.35 over the tell turn (the Burst follows).'),
    dict(id='ghoul', scale=0.95,
         colors=H.palette('#c9c7bb', '#181414', '#b0302a', iris='#e8e2b0', ink='#100c0c', cloth2='#4a4038',
                          leather='#3a2c22', bone='#e8dcc0'),
         shapes={'var_gaunt': 1.0},
         boneScales={'upperArm': 1.16, 'lowerArm': 1.3, 'hand': 1.22, 'fingers': 1.3},
         poseAdd={'Spine': (22, 0, 0), 'Chest': (14, 0, 0), 'UpperChest': (10, 0, 0), 'Neck': (-24, 0, 0),
                  'Head': (-18, 0, 0), 'LeftShoulder': (0, 0, -8), 'RightShoulder': (0, 0, 8)},
         clipMap={'Move': 'Run', 'Attack1': 'Attack_Light', 'Attack2': 'Attack_Dual', 'Grab-hold': 'Guard'}),
    dict(id='drowned-thrall', scale=1.0,
         colors=H.palette('#6f8494', '#e9e6dc', '#3f6b3a', iris='#d6dccc', ink='#0f1418', cloth1='#5a5f63',
                          cloth2='#4a4f52', leather='#33302a'),
         shapes={'var_bloat': 0.7},
         poseAdd={'Spine': (5, 0, 0), 'Neck': (6, 0, -10), 'Head': (4, 0, -6)},
         clipMap={'Attack1': 'Attack_Light', 'Attack2': 'Attack_Dual', 'Cling': 'Attack_Dual'}),
    # 06 §3.5 lists 2.2; at 2.2 the Hulk stands 3.9 m (taller than the Barrow Warden, the zone's boss): 2.0 hunched
    # gives the 3.2–3.4 m of its Visual line (logged as Proposed in art/log/monsters-b.md)
    dict(id='charnel-hulk', scale=2.0,
         colors=H.palette('#6f8a5f', '#6b4a5e', '#141014', iris='#d6d8b8', ink='#0e0a0c', leather='#3b2c20',
                          cloth2='#4a3c30'),
         shapes={'var_bulk': 1.0},
         boneScales={'hand': 1.2, 'fingers': 1.1, 'head': 0.86, 'lowerArm': 1.08},
         poseAdd={'Spine': (18, 0, 0), 'Chest': (12, 0, 0), 'UpperChest': (8, 0, 0), 'Neck': (-20, 0, 0),
                  'Head': (-14, 0, 0)},
         clipMap={'Attack1': 'Attack_Heavy', 'Attack2': 'Attack_Heavy', 'Toss': 'Attack_Heavy', 'Shed': 'Roar',
                  'Flail': 'Attack_Dual'}),
]


def build(sess):
    K = sess.K
    out = {}
    ratio = 0.22

    # ---------------- shambling corpse
    rags = [sess.make('zombie_shambling_tunic', tunic(sess, K, SECOND, hem=0.82, seed=0.7), {'variant': 'shambling', 'piece': 'tunic'}),
            sess.make('zombie_shambling_breeches', breeches(sess, K, CLOTH2, knee=0.88, seed=0.3), {'variant': 'shambling', 'piece': 'breeches'})]
    body = sess.body_copy('zombie_shambling_body', ratio=ratio)
    H.cull_hidden(body, rags, strict_regions=('chest', 'belly', 'upperArms', 'thighs'))
    wounds = blotches([((0.07, -0.13, 1.18), 0.035, ACC), ((0.095, -0.115, 1.205), 0.02, INK),
                       ((-0.36, 0.02, 1.02), 0.03, ACC), ((0.09, -0.07, 0.42), 0.035, ACC),
                       ((-0.04, -0.12, 1.66), 0.018, ACC)])
    H.paint(body, SKIN, EYE, wounds)
    f_sw = H.RadialField(sess, both({'Spine': 0.12, 'Chest': 0.1, 'UpperChest': 0.06, 'Hips': 0.08, 'UpperLeg': 0.05,
                                      'Neck': 0.1}), extra=cheek_puff(0.008))
    for o in [body] + rags:
        H.add_field_key(o, 'var_swollen', f_sw)
    out['shambling-corpse'] = [body] + rags

    # ---------------- bursting corpse
    rags = [sess.make('zombie_bursting_breeches', breeches(sess, K, CLOTH2, knee=0.8, ragged=0.12, seed=1.3),
                      {'variant': 'bursting', 'piece': 'breeches'})]
    body = sess.body_copy('zombie_bursting_body', ratio=ratio, protect={3: 0.0, 2: 0.5}, factor=1.0)
    H.cull_hidden(body, rags, strict_regions=('thighs',))
    H.paint(body, SKIN, EYE, belly_cracks(GLOW))
    H.add_key(body, 'var_belly', belly_bulge(0.17, 1.03, 0.13))
    for o in rags:
        H.add_field_key(o, 'var_belly', lambda co, w, region: belly_bulge(0.17, 1.03, 0.13)(co, 3 if co.z > 0.9 else 7))
    H.add_key(body, 'var_cheeks', cheek_puff(0.018))
    out['bursting-corpse'] = [body] + rags

    # ---------------- ghoul
    lc = sess.make('zombie_ghoul_loincloth', loincloth(sess, K, CLOTH2, belt=LEATHER), {'variant': 'ghoul', 'piece': 'loincloth'})
    body = sess.body_copy('zombie_ghoul_body', ratio=ratio)
    H.cull_hidden(body, [lc])
    gums = blotches([((0.0, -0.138, 1.566), 0.03, SECOND)])
    H.paint(body, SKIN, EYE, gums)
    f_g = H.RadialField(sess, both({'Spine': -0.22, 'Chest': -0.12, 'UpperChest': -0.06, 'Hips': -0.06,
                                     'UpperArm': -0.22, 'LowerArm': -0.2, 'UpperLeg': -0.2, 'LowerLeg': -0.16,
                                     'Neck': -0.15}), extra=sunken_face(0.009))
    for o in (body, lc):
        H.add_field_key(o, 'var_gaunt', f_g)
    teeth = sess.rigid('zombie_ghoul_teeth', teeth_strip(BONE), bone='Head', props={'variant': 'ghoul', 'piece': 'teeth'})
    cl = sess.multi('zombie_ghoul_claws', claws(sess, ACC), {'variant': 'ghoul', 'piece': 'claws'})
    out['ghoul'] = [body, lc, teeth, cl]

    # ---------------- drowned thrall
    # the cult's grey rags to mid-thigh, bare legs (round 2: rags + breeches + barnacles were 3,980 of a 3,000 budget)
    rags = [sess.make('zombie_thrall_rags', tunic(sess, K, CLOTH, hem=0.66, ragged=0.10, seed=2.1), {'variant': 'thrall', 'piece': 'rags'})]
    body = sess.body_copy('zombie_thrall_body', ratio=ratio)
    H.cull_hidden(body, rags, strict_regions=('chest', 'belly', 'upperArms'))
    H.paint(body, SKIN, EYE, blotches([((-0.06, -0.10, 1.62), 0.025, SECOND)]))
    f_b = H.RadialField(sess, both({'Spine': 0.08, 'Chest': 0.06, 'UpperArm': 0.1, 'LowerArm': 0.12, 'Hand': 0.08,
                                     'Neck': 0.12, 'UpperLeg': 0.06, 'LowerLeg': 0.08}), extra=cheek_puff(0.01))
    for o in [body] + rags:
        H.add_field_key(o, 'var_bloat', f_b)
    # barnacle crusts where a body lying in water would collect them: shoulders, upper back, forearm, shin, the
    # tunic's shoulders and a cheek (each spot: a point on the surface, its outward normal, how many)
    spots_body = [((0.17, 0.0, 1.44), (0.35, 0.1, 1.0), 7), ((-0.16, 0.02, 1.445), (-0.35, 0.1, 1.0), 5),
                  ((-0.06, 0.125, 1.33), (-0.15, 1.0, 0.25), 6), ((0.08, 0.11, 1.20), (0.2, 1.0, 0.0), 5),
                  ((0.375, -0.035, 1.02), (0.75, -0.55, 0.0), 5), ((-0.11, -0.065, 0.40), (-0.45, -0.9, 0.0), 5)]
    bk = barnacles(spots_body, SECOND)
    bpart = sess.bound('barnacles', bk, orient='body', smooth=2, clear=0.002)
    barn = sess.make('zombie_thrall_barnacles', [bpart], {'variant': 'thrall', 'piece': 'barnacles'})
    H.add_field_key(barn, 'var_bloat', f_b)
    face_b = sess.rigid('zombie_thrall_facebarnacles',
                        barnacles([((-0.078, -0.108, 1.605), (-0.6, -0.8, 0.05), 4), ((0.05, -0.12, 1.70), (0.4, -0.8, 0.5), 3)],
                                  SECOND, 1.0),
                        bone='Head', props={'variant': 'thrall', 'piece': 'facebarnacles'})
    kl = sess.rigid('zombie_thrall_kelp', kelp(slot=ACC), bone='Head', props={'variant': 'thrall', 'piece': 'kelp'})
    out['drowned-thrall'] = [body] + rags + [barn, face_b, kl]

    # ---------------- charnel hulk
    lc = sess.make('zombie_hulk_loincloth', loincloth(sess, K, LEATHER, belt=LEATHER, length=0.26), {'variant': 'hulk', 'piece': 'loincloth'})
    st = sess.make('zombie_hulk_straps', straps(sess, K, LEATHER) + stitches(sess, K, ACC), {'variant': 'hulk', 'piece': 'straps'})
    body = sess.body_copy('zombie_hulk_body', ratio=ratio)
    H.cull_hidden(body, [lc])
    bruises = blotches([((0.1, -0.12, 1.12), 0.05, SECOND), ((-0.12, 0.1, 1.28), 0.06, SECOND), ((0.11, -0.05, 0.6), 0.05, SECOND)])
    H.paint(body, SKIN, EYE, bruises)
    f_k = H.RadialField(sess, both({'Spine': 0.32, 'Chest': 0.26, 'UpperChest': 0.22, 'Hips': 0.2, 'Neck': 0.35,
                                     'Shoulder': 0.3, 'UpperArm': 0.5, 'LowerArm': 0.48, 'Hand': 0.18,
                                     'UpperLeg': 0.32, 'LowerLeg': 0.3, 'Foot': 0.12}),
                        extra=belly_bulge(0.06, 1.02, 0.14))
    for o in (body, lc, st):
        H.add_field_key(o, 'var_bulk', f_k)
    t2 = sess.body_copy('zombie_hulk_torso2', ratio=ratio)
    second_torso(sess, t2)
    H.paint(t2, SKIN, EYE, first(plane_bands([((-0.2, 0.03, 1.33), (0.6, 0, 1))], ACC, 0.02),
                                  blotches([((-0.3, -0.04, 1.47), 0.04, SECOND)])))
    sess.register(t2, 'zombie_hulk_torso2', {'variant': 'hulk', 'piece': 'torso2'})
    out['charnel-hulk'] = [body, lc, st, t2]
    for v in ('zombie_shambling_body', 'zombie_bursting_body', 'zombie_ghoul_body', 'zombie_thrall_body', 'zombie_hulk_body'):
        o = sess.objects.get(v) or bpy.data.objects.get(v)
        sess.register(o, v, {'variant': v.split('_')[1], 'piece': 'body'})
    return out


# ====================================================================== review, export
def height_of(objs, v):
    z = 0.0
    for ob in objs:
        for vv in ob.data.vertices:
            z = max(z, (ob.matrix_world @ vv.co).z)
    return z * v['scale'] * (v.get('boneScales') or {}).get('root', 1.0)


def apply_shapes(objs, shapes, on=True):
    for ob in objs:
        sk = ob.data.shape_keys
        if not sk:
            continue
        for k, w in shapes.items():
            kb = sk.key_blocks.get(k)
            if kb:
                kb.value = w if on else 0.0


def main():
    sess = H.Session(BASE)
    parts = build(sess)
    vs = []
    for v in VARIANTS:
        v = dict(v)
        v['base'] = BASE
        v['objs'] = parts[v['id']]
        v['tris'] = sum(H.tris_of(o) for o in v['objs'])
        v['height'] = height_of(v['objs'], v)
        vs.append(v)
        log('%s: %d tris, %.2f m, parts %s' % (v['id'], v['tris'], v['height'], [o.name for o in v['objs']]))
    if not ARGS.get('no_render'):
        rv = H.Review(sess, quick=QUICK)
        for v in vs:
            rv.look(v['objs'], v['id'], v['colors'])
            apply_shapes(v['objs'], v.get('shapes', {}))
        hmax = max(v['height'] for v in vs) + 0.1
        rv.lineup([(None, [])] + [(v, v['objs']) for v in vs], 'lineup.png', hmax)
        cards = []
        for v in vs:
            p, small = rv.card(v, v['objs'], 'card_%s.png' % v['id'])
            cards.append(small)
        from render import grid_sheet
        grid_sheet(cards, os.path.join(rv.out, 'read200_all.png'), cols=len(cards))
        rv.heads(vs, 'heads.png')
        for v in vs:
            rv.strip(v, v['objs'], H.strip_frames(v), 'clips_%s.png' % v['id'])
        H.poke_lines(rv, vs)
        for v in vs:
            apply_shapes(v['objs'], v.get('shapes', {}), on=False)
    H.L.rest(sess.rig)
    save_blend(os.path.join(BUILD, 'monsters_%s.blend' % BASE))
    if not ARGS.get('no_export'):
        objs = []
        for v in vs:
            for o in v['objs']:
                if o not in objs:
                    objs.append(o)
        for o in objs:
            o['tris'] = H.tris_of(o)
            o['monsters'] = [v['id'] for v in vs if o in v['objs']]
        kb = H.export_base(sess, objs)
        H.write_manifest({v['id']: H.manifest_entry(v, [o.name for o in v['objs']], sess.rig) for v in vs})
        log('zombie.glb %.1f KB' % kb)
        H.reimport_check(BASE)


main()

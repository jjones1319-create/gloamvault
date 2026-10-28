"""build_skeleton.py — the `skeleton` base on the hero rig (docs/06-MONSTERS.md §3.2, §3.5; README → Monsters).

Run:  blender -b -P tools/blender/monsters/build_skeleton.py -- [--quick] [--no-render] [--no-export]
Opens art/build/hero_species.blend (humanoid_lib.Session), builds every variant, renders the review set into
art/renders/monsters/skeleton/, saves art/build/monsters_skeleton.blend, writes client/public/models/monsters/
skeleton.glb and merges the variants into manifest.json.

The bones are rigid pieces, each skinned 100 % to its rig bone (skull, jaw and teeth on Head; vertebrae on Spine,
Chest, UpperChest, Neck; ribs on Chest/UpperChest; clavicle and shoulder blade on the Shoulder; humerus, radius and
ulna, carpals, metacarpals and one piece per finger bone; pelvis on Hips; femur, tibia and fibula, kneecap, foot and
toes), chunky and knobbly so they read at 200 px. Variants (a scale, parts on or off, a palette, props):
- skeleton-footman — all bones, a rotted tabard, a round shield (Socket_HandL) and a rusted sword (hero sword F);
- skeleton-archer — all bones, the hero longbow F (Socket_HandR), the hero quiver F with arrows on Socket_Back, a strap;
- bone-knight (1.25) — the Warden's F plate (chest, legs, boots) in tarnished iron with a tattered tabard, a closed
  great helm with a lit visor slit, bare bone forearms and hands, the hero greatsword F;
- crypt-sexton — the Arcanist's F robe and hood in grave black, the skull in the hood, bone hands, shins and feet, a
  hand-bell (Socket_HandL) and a lantern pole with a green lantern (Socket_HandR);
- barrow-warden (1.75) — the Warden's F plate in iron black, the skull with a spiked iron circlet, a bell-hung mantle,
  a lantern on a chain (Socket_HandL), a slab-sword (Socket_HandR), a great bell at the hip.
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
BASE = 'skeleton'
D = math.radians
V = Vector

# slots used by the bone kits (per variant the palette gives them colours)
BONE, CLOTH, ACC = 0, 1, 2
INK, LEATHER, METAL, TRIM, GLOW, WOOD, BONE2 = 5, 8, 9, 10, 11, 12, 13


# ====================================================================== bone pieces
def long_bone(kit, p0, p1, r0, rm, r1, slot=BONE, n=6, knob=0.1):
    a = V(p1) - V(p0)
    L_ = a.length
    prof = [(r0 * 0.55, 0.0), (r0, knob * 0.45 * L_), (rm, knob * 1.6 * L_), (rm, L_ * (1 - knob * 1.6)),
            (r1, L_ * (1 - knob * 0.45)), (r1 * 0.55, L_)]
    kit.lathe(prof, n, slot, axis=a, centre=V(p0), cap0='apex', cap1='apex')


def stick(kit, p0, p1, r, slot=BONE, n=4, r1=None):
    a = V(p1) - V(p0)
    kit.lathe([(r, 0.0), (r1 if r1 is not None else r, a.length)], n, slot, axis=a, centre=V(p0), cap0='flat',
              cap1='flat')


def vertebra(kit, c, axis, r, h, slot=BONE, process=None, n=6):
    a = H.unit(axis)
    kit.lathe([(r, -h / 2), (r, h / 2)], n, slot, axis=a, centre=V(c), cap0='flat', cap1='flat')
    if process is not None:
        p = V(process)
        kit.box(V(c) + p * 0.55, p * 0.45, a * h * 0.35, a.cross(p).normalized() * 0.006, slot)


def flat_rib(kit, pts, h, w, slot=BONE):
    """A flat band along a polyline: `h` half-height (along z), `w` half-thickness (radial)."""
    rings = []
    for i, p in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        t = H.unit(b - a)
        up = H.unit(V((0, 0, 1)) - t * t.z)
        out = t.cross(up)
        rings.append([p + up * h + out * w, p + up * h - out * w, p - up * h - out * w, p - up * h + out * w])
    kit.rings(rings, slot, True, 'flat', 'flat')


def skull(S):
    """The skull (on Head): one grid over an egg-shaped cranium and a narrowing face, eye sockets and the nasal hole
    recessed in ink, an ink mouth band with sawtooth teeth over it, glowing points in the sockets."""
    k = H.Kit()
    C = V((0.0, -0.006, 1.645))
    rows = [-62, -50, -42, -36, -29, -22, -16, -6, 4, 12, 26, 46, 68]
    cols = [0, 9, 15, 26, 38, 52, 74, 105, 140, 180, 220, 255, 286, 308, 322, 334, 345, 351]

    def d(e, b):
        e, b = D(e), D(b)
        return V((math.sin(b) * math.cos(e), -math.cos(b) * math.cos(e), math.sin(e)))

    def R(e, b):
        v = d(e, b)
        rx, ry = 0.079, (0.099 if v.y < 0 else 0.104)
        rz = 0.112 if v.z > 0 else 0.094
        r = 1.0 / math.sqrt((v.x / rx) ** 2 + (v.y / ry) ** 2 + (v.z / rz) ** 2)
        return r

    def P(e, b):
        v = d(e, b)
        p = C + v * R(e, b)
        front = max(0.0, -v.y)
        # the face: flatter in front, narrowing below the cheekbones toward a square jaw
        if p.y < -0.085:
            p.y = -0.085 + (p.y + 0.085) * 0.45
        lo = H.smoothstep(C.z - 0.015, C.z - 0.095, p.z)
        p.x *= 1.0 - 0.26 * lo * (0.4 + 0.6 * front)
        # cheekbones a little proud
        if -14 <= e <= 0 and 34 <= abs(((b + 180) % 360) - 180) <= 60:
            p.x *= 1.06
        # the back of the skull closes in a base plane above the neck
        if v.y > 0.15 and p.z < C.z - 0.055:
            p.z = C.z - 0.055 + (p.z - (C.z - 0.055)) * 0.25
        return p

    def bb(b):
        return ((b + 180) % 360) - 180

    def socket(e, b):
        return -16 <= e <= 4 and 15 <= abs(bb(b)) <= 38

    def nasal(e, b):
        return -29 <= e <= -16 and abs(bb(b)) <= 9

    def mouth(e, b):
        return -42 <= e <= -36 and abs(bb(b)) <= 38

    grid = []
    for e in rows:
        row = []
        for b in cols:
            p = P(e, b)
            # recess the inner points of the sockets and the nasal hole; round the sockets' corners in
            if e == -6 and abs(bb(b)) == 26:
                p = p + (C - p).normalized() * 0.026
            if e == -22 and bb(b) == 0:
                p = p + (C - p).normalized() * 0.014
            if e in (-16, 4) and abs(bb(b)) in (15, 38):
                p = p + (C - p).normalized() * 0.004
            row.append(p)
        grid.append(row)

    def cell_slot(i, j):
        e = (rows[i] + rows[i + 1]) / 2
        b0, b1 = cols[j], cols[(j + 1) % len(cols)]
        if b1 < b0:
            b1 += 360
        b = (b0 + b1) / 2
        if socket(e, b) or nasal(e, b) or mouth(e, b):
            return INK
        return BONE
    k.rings(grid, cell_slot, True, cap0=C + V((0, 0.012, -0.052)), cap1=C + V((0, 0.004, 0.112)))
    # teeth: two sawtooth strips over the mouth band
    for e_top, e_tip, off in ((-36.0, -40.5, 0.0), (-42.0, -37.5, 0.5)):
        bs = [-33 + 66 * (q + off) / 8 for q in range(9)]
        bs = [b for b in bs if -34 <= b <= 34]
        base = [P(e_top, b) + d(e_top, b) * 0.0035 for b in bs]
        tips = [P(e_tip, (b0 + b1) / 2) + d(e_tip, (b0 + b1) / 2) * 0.0035 for b0, b1 in zip(bs, bs[1:])]
        for q in range(len(tips)):
            a, b2, t = base[q], base[q + 1], tips[q]
            fn = (b2 - a).cross(t - b2)
            out = (a + b2 + t) / 3 - C
            f = (a, b2, t) if fn.dot(out) > 0 else (b2, a, t)
            k.add(list(f), [(0, 1, 2)], BONE2)
    # the glowing points in the sockets
    for sgn in (1, -1):
        c = P(-6, 26 * sgn) + (C - P(-6, 26 * sgn)).normalized() * 0.016
        k.sphere(c, 0.0095, 6, 4, GLOW)
    # chunky: the skull a size up, grown from the top of the neck
    piv = V((0.0, -0.01, 1.535))
    k.transform(Matrix.Translation(piv) @ Matrix.Scale(1.14, 4) @ Matrix.Translation(-piv))
    return k


def hand_bones(sess, side, slot=BONE):
    """{bone: Kit} for one hand: carpal block, metacarpals (on the Hand) and one piece per finger bone."""
    pre = 'Left' if side > 0 else 'Right'
    j = sess.joint
    out = {}
    hk = H.Kit()
    h0, h1 = j(pre + 'Hand'), j(pre + 'Hand', 'tail')
    ax = H.unit(h1 - h0)
    c = h0 + ax * 0.028
    side_v = H.unit(V((0, 1, 0)) - ax * ax.y)
    hk.box(c, ax * 0.022, side_v * 0.022, ax.cross(side_v).normalized() * 0.011, slot)
    for f in ('Index', 'Middle', 'Ring', 'Little'):
        stick(hk, h0 + ax * 0.045, j(pre + f + 'Proximal'), 0.0055, slot, n=3)
    out[pre + 'Hand'] = hk
    for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Little'):
        for ph in ('Proximal', 'Intermediate', 'Distal'):
            bn = pre + f + ph
            kk = H.Kit()
            a, b = j(bn), j(bn, 'tail')
            r = 0.0062 if ph == 'Proximal' else (0.0056 if ph == 'Intermediate' else 0.005)
            if f == 'Thumb':
                r *= 1.15
            stick(kk, a + (b - a) * 0.08, b + (b - a) * (0.08 if ph == 'Distal' else -0.06), r, slot, n=3)
            out[bn] = kk
    return out


def bone_kits(sess, K):
    """{rig bone: Kit} for the whole skeleton (rest pose, world space)."""
    j = sess.joint
    kits = {}

    def k(b):
        return kits.setdefault(b, H.Kit())
    k('Head').extend(skull(None))
    # neck and spine: vertebrae a little behind the bone line
    back = V((0, 0.032, 0))
    a, b = j('Neck'), j('Neck', 'tail')
    for t in (0.2, 0.62):
        vertebra(k('Neck'), a.lerp(b, t) + back * 0.6, b - a, 0.0145, 0.026, n=5)
    a, b = j('Spine'), j('Spine', 'tail')
    for t in (0.12, 0.45, 0.78):
        vertebra(k('Spine'), a.lerp(b, t) + back, b - a, 0.021, 0.03, process=V((0, 0.03, 0)))
    for bn, ts in (('Chest', (0.2, 0.65)), ('UpperChest', (0.15, 0.6))):
        a, b = j(bn), j(bn, 'tail')
        for t in ts:
            vertebra(k(bn), a.lerp(b, t) + back * 1.6, b - a, 0.017, 0.03, n=5)
    # ribs: flat bands on the torso envelope (80 %), from the spine round each side to the sternum
    T = K.torso
    zs = [(1.375, 'UpperChest'), (1.315, 'UpperChest'), (1.255, 'Chest'), (1.195, 'Chest')]
    for zb, bn in zs:
        for sgn in (1, -1):
            pts = []
            for q, th in enumerate((172, 140, 100, 62, 30)):
                z = zb - 0.06 * H.smoothstep(172, 30, th) - 0.012 * (1 if q == 4 else 0)
                pts.append(T.pt(K.tz(z), D(th * sgn), 0.0, 0.8 if q not in (0,) else 0.62))
            flat_rib(k(bn), pts, 0.0072 if zb > 1.3 else 0.0066, 0.0042)
    # the sternum
    top = T.pt(K.tz(1.375), 0.0, 0.0, 0.8)
    bot = T.pt(K.tz(1.17), 0.0, 0.0, 0.8)
    k('UpperChest').box((top + bot) / 2 + V((0, 0.004, 0)), V((0.012, 0, 0)), V((0, 0.006, 0)), (top - bot) / 2, BONE)
    # clavicles and shoulder blades
    for sgn, pre in ((1, 'Left'), (-1, 'Right')):
        sh = j(pre + 'UpperArm')
        st = V((0.022 * sgn, top.y + 0.01, 1.395))
        mid = V((sgn * (abs(sh.x) * 0.55), st.y + 0.035, 1.405))
        k(pre + 'Shoulder').tube([st, mid, sh + V((-0.02 * sgn, -0.015, 0.03))], [0.0085, 0.009, 0.011], 5, BONE)
        k(pre + 'Shoulder').slab([V((0.0, 0.0, 0)), V((0.11, -0.01, 0)), V((0.035, -0.15, 0))], 0.009, BONE,
                                 origin=V((sgn * 0.05, 0.088, 1.385)), x=V((sgn, 0, 0)), y=V((0, 0, 1)) if sgn < 0 else V((0, 0, 1)))
    # pelvis: iliac wings, sacrum, pubic arch
    hp = j('Hips')
    for sgn in (1, -1):
        out = [V((0.0, 0.0, 0)), V((0.055, -0.015, 0)), V((0.075, 0.075, 0)), V((0.035, 0.105, 0)), V((-0.01, 0.07, 0))]
        k('Hips').slab([V((p.x, p.y, 0)) for p in out] if sgn > 0 else [V((-p.x, p.y, 0)) for p in reversed(out)],
                       0.012, BONE, origin=V((sgn * 0.06, 0.03, 0.885)), x=V((1, 0, 0)), y=V((0, -0.35, 0.94)))
    k('Hips').box(V((0, 0.06, 0.905)), V((0.032, 0, 0)), V((0, 0.014, 0)), V((0, 0, 0.045)), BONE)
    k('Hips').tube([V((0.07, -0.01, 0.84)), V((0.04, -0.05, 0.815)), V((0, -0.06, 0.81)), V((-0.04, -0.05, 0.815)),
                    V((-0.07, -0.01, 0.84))], 0.012, 5, BONE)
    # arms, hands, legs, feet
    for sgn, pre in ((1, 'Left'), (-1, 'Right')):
        a, b = j(pre + 'UpperArm'), j(pre + 'UpperArm', 'tail')
        long_bone(k(pre + 'UpperArm'), a, b, 0.027, 0.0145, 0.022)
        a, b = j(pre + 'LowerArm'), j(pre + 'LowerArm', 'tail')
        ax = H.unit(b - a)
        off = H.unit(V((0, 1, 0)) - ax * ax.y) * 0.0085
        long_bone(k(pre + 'LowerArm'), a + off, b + off * 1.1, 0.0135, 0.0075, 0.011, n=5)
        long_bone(k(pre + 'LowerArm'), a - off, b - off * 1.1, 0.011, 0.0075, 0.0125, n=5)
        for bn, kk in hand_bones(sess, sgn).items():
            k(bn).extend(kk)
        a, b = j(pre + 'UpperLeg'), j(pre + 'UpperLeg', 'tail')
        long_bone(k(pre + 'UpperLeg'), a + V((sgn * -0.01, 0, 0.012)), b, 0.031, 0.0185, 0.028)
        a, b = j(pre + 'LowerLeg'), j(pre + 'LowerLeg', 'tail')
        long_bone(k(pre + 'LowerLeg'), a, b + V((0, 0, 0.012)), 0.027, 0.0155, 0.021)
        stick(k(pre + 'LowerLeg'), a + V((sgn * 0.022, 0.012, -0.03)), b + V((sgn * 0.02, 0.01, 0.03)), 0.0065, n=4)
        k(pre + 'LowerLeg').sphere(a + V((0, -0.035, 0.01)), 0.017, 6, 3, BONE, scale=(1, 0.6, 1.15))
        fa, fb = j(pre + 'Foot'), j(pre + 'Foot', 'tail')
        fax = H.unit(V((fb.x - fa.x, fb.y - fa.y, 0)))
        heel = V((fa.x, fa.y + 0.035, 0.032))
        k(pre + 'Foot').box(heel + fax * 0.045 + V((0, 0, 0.004)), fax * 0.06, fax.cross(V((0, 0, 1))) * 0.026,
                            V((0, 0, 0.026)), BONE)
        for q in (-1, 0, 1):
            sv = fax.cross(V((0, 0, 1))) * (0.017 * q)
            stick(k(pre + 'Foot'), heel + fax * 0.1 + sv + V((0, 0, 0.012)), fb + sv * 1.2 + V((0, 0, 0.002)), 0.0065, n=4)
        ta, tb = j(pre + 'Toes'), j(pre + 'Toes', 'tail')
        tax = H.unit(V((tb.x - ta.x, tb.y - ta.y, 0)))
        for q in (-1, 0, 1):
            sv = tax.cross(V((0, 0, 1))) * (0.018 * q)
            stick(k(pre + 'Toes'), ta + sv + V((0, 0, 0.002)), ta + tax * 0.055 + sv + V((0, 0, 0.002)), 0.0068, n=4)
    return kits


SUBSETS = {
    'all': None,
    'arms': {'LeftLowerArm', 'RightLowerArm', 'LeftHand', 'RightHand'},     # + finger bones
    'neck': {'Neck'},
    'head': {'Head'},
    'legs_low': {'LeftLowerLeg', 'RightLowerLeg', 'LeftFoot', 'RightFoot', 'LeftToes', 'RightToes'},
}


def pick(kits, groups, bone_slot=BONE):
    """[(kit, bone)] for the bone groups asked; `bone_slot` re-slots the bone faces (variants whose bone colour is
    their second palette colour: the knight, the sexton, the warden)."""
    out = []
    for bn, kit in kits.items():
        ok = False
        for g in groups:
            s = SUBSETS[g]
            if s is None or bn in s:
                ok = True
            if g == 'arms' and any(f in bn for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Little')):
                ok = True
        if ok:
            if bone_slot != BONE:
                kit = kit.copy()
                kit.slots = [bone_slot if s == BONE else s for s in kit.slots]
            out.append((kit, bn))
    return out


# ====================================================================== props
def round_shield():
    """A round wooden shield (Socket_HandL space: the board faces +X, the back of the hand), iron boss, rusted rim."""
    k = H.Kit()
    # front (boss) to back across the rim; heights along the board's normal (+X of the left hand)
    prof = [(0.045, 0.05), (0.062, 0.032), (0.07, 0.022), (0.235, 0.012), (0.258, 0.018), (0.275, 0.006),
            (0.27, -0.008)]
    ax = V((1, 0, 0))
    c = V((0.03, 0.0, -0.05))

    def sl(i, j):
        if i < 0:
            return METAL
        if i <= 1:
            return METAL
        if i == 2:
            return WOOD
        if i in (3, 4, 5):
            return ACC
        return WOOD
    k.lathe(prof, 14, sl, axis=ax, centre=c, ref=V((0, 0, 1)), cap0=c + ax * 0.056, cap1=c + ax * -0.008)
    return k


def tabard_panels(sess, K, cloth=CLOTH, trim=ACC):
    """A rotted tabard hanging from the shoulders over the ribcage, front and back panels with ragged hems, straps
    over the clavicles. Bound to the hero body under it for its weights (hips and thighs share the hem)."""
    import gear_loft as L
    parts = []
    T = K.torso
    corners = {}
    for side, th0 in (('front', 0.0), ('back', 180.0)):
        g = L.Grid()
        cols = [-40, -24, -8, 8, 24, 40] if side == 'front' else [-42, -25, -8, 8, 25, 42]
        zs = [1.40, 1.31, 1.18, 1.04, 0.92, 0.78]
        rows = []
        for i, z in enumerate(zs):
            row = []
            for q, c in enumerate(cols):
                th = D(th0 + c)
                zz = z
                if i == len(zs) - 1:
                    zz = z - (0.05 if q % 2 else 0.0) - 0.02 * math.sin(q * 2.1)
                sc = 0.86 if z > 1.15 else 0.92
                p = T.pt(K.tz(zz), th, 0.018, sc)
                if z < 1.15:
                    # below the ribs the cloth falls straight
                    q_ = T.pt(K.tz(1.15), th, 0.018, 0.86)
                    p = V((p.x, q_.y + (-0.006 if side == 'front' else 0.006) * (1.15 - zz) / 0.35, p.z))
                row.append(p)
            rows.append(row)
        corners[side] = (rows[0][0], rows[0][-1])
        g.rows(rows, lambda i, jj: trim if (i == len(rows) - 2 and trim is not None and jj % 2 == 0) else cloth)
        piece = sess.fg.piece('tabard_' + side, g)
        parts.append(L.Part('tabard_' + side, piece, allow=['Hips', 'Spine', 'Chest', 'UpperChest', 'LeftUpperLeg',
                                                             'RightUpperLeg'], smooth=3, clear=0.006,
                            cap={'LeftUpperLeg': 0.45, 'RightUpperLeg': 0.45}))
    # straps over the shoulders: from each front top corner over the clavicle to the back top corner
    g = L.Grid()
    for k_ in (0, 1):
        f, b = corners['front'][k_], corners['back'][1 - k_]
        sgn = 1 if f.x > 0 else -1
        pts = []
        for s in (0.0, 0.25, 0.5, 0.75, 1.0):
            p = f.lerp(b, s)
            p.z += 0.05 * math.sin(math.pi * s)
            pts.append(p)
        w = V((0.02 * sgn, 0, 0))
        g.rows([[p + w for p in pts], [p - w for p in pts]], cloth, orient=V((f.x, 0.0, 1.30)))
    piece = sess.fg.piece('tabard_straps', g)
    parts.append(L.Part('tabard_straps', piece, allow=['UpperChest', 'LeftShoulder', 'RightShoulder'], smooth=2,
                        clear=0.004))
    return parts


def great_helm(slot=0, glow=GLOW, ink=INK, trim=None):
    """A closed great helm (on Head): a flat-topped barrel round the head, a glowing visor slit, breaths."""
    k = H.Kit()
    C = V((0.0, -0.022, 0.0))
    prof = [(0.118, 1.495), (0.124, 1.545), (0.127, 1.60), (0.128, 1.632), (0.128, 1.652), (0.126, 1.69),
            (0.118, 1.75), (0.098, 1.80), (0.0, 1.818)]
    n = 18
    rings = []
    for r, z in prof[:-1]:
        ring = []
        for q in range(n):
            t = 2 * math.pi * q / n
            ring.append(V((math.sin(t) * r * 0.96, -math.cos(t) * r * 1.16 + C.y, z)))
        rings.append(ring)

    def sl(i, jq):
        front = abs(((jq + 0.5) * 360 / n + 180) % 360 - 180) < 58
        if i == 3 and front:
            return glow
        if trim is not None and i in (0, 5):
            return trim
        return slot
    # the visor slit: a little taller, recessed (round 2: the breaths read as a second pair of eyes — dropped)
    rings[3] = [V((p.x, p.y, 1.626)) for p in rings[3]]
    rings[4] = [V((p.x, p.y, 1.66)) for p in rings[4]]
    for q in range(n):
        if abs((q * 360 / n + 180) % 360 - 180) < 50:
            for i in (3, 4):
                p = rings[i][q]
                rings[i][q] = V((p.x * 0.97, (p.y - C.y) * 0.95 + C.y, p.z))
    k.rings(rings, sl, True, cap0=None, cap1=V((0, C.y, prof[-1][1])))
    # an inward lip at the bottom edge (seen from below it closes the open rim)
    inner = [V((p.x * 0.88, (p.y - C.y) * 0.88 + C.y, p.z + 0.012)) for p in rings[0]]
    k.rings([rings[0], inner], ink, True, flip=True)
    return k


def hip_quiver(sess):
    """Where the archer's quiver hangs: at the left hip, mouth up and leaning out (on a skeleton a quiver on the back
    shows through the ribs as a block in the chest — round 2). The hero quiver is modelled for Socket_Back (Y up,
    Z back); this matrix stands in for that socket."""
    R = sess.socket('Socket_Back').to_3x3()
    M = (Matrix.Rotation(D(14), 4, 'Y') @ R.to_4x4())
    M.translation = V((0.2, 0.07, 0.78))
    return M


def hand_bell(sess, socket='Socket_HandL', scale=1.0, bell=METAL, handle=WOOD):
    """A hand-bell in world space at the rest pose: the handle across the fist (the socket's Y), the bell hanging
    below the knuckles, mouth down (world −Z while the arm hangs). Skin it rigidly to the hand."""
    k = H.Kit()
    s = scale
    S = sess.socket(socket)
    y = (S.to_3x3() @ V((0, 1, 0))).normalized()
    o = S.translation
    k.lathe([(0.012 * s, -0.045 * s), (0.013 * s, 0.045 * s)], 6, handle, axis=y, centre=o, cap0='flat', cap1='flat')
    top = o + V((0, 0, -0.05 * s))
    k.lathe([(0.008 * s, 0.05 * s), (0.008 * s, 0.0)], 5, handle, axis=V((0, 0, 1)), centre=top, cap0='flat', cap1='flat')
    prof = [(0.016 * s, 0.0), (0.032 * s, -0.016 * s), (0.044 * s, -0.06 * s), (0.058 * s, -0.10 * s),
            (0.066 * s, -0.112 * s), (0.052 * s, -0.106 * s)]
    k.lathe(prof, 10, bell, axis=V((0, 0, 1)), centre=top, cap0=top, cap1=None)
    k.sphere(top + V((0, 0, -0.1 * s)), 0.014 * s, 5, 3, bell)
    return k


def lantern(cage=METAL, glow=GLOW, s=1.0, top=V((0, 0, 0))):
    """A caged lantern hanging from `top` (world/socket space, −Z down): a roof, four bars, a glowing core."""
    k = H.Kit()
    t = V(top)
    k.lathe([(0.006 * s, 0.0), (0.05 * s, -0.035 * s), (0.055 * s, -0.045 * s), (0.03 * s, -0.05 * s)], 8, cage,
            axis=V((0, 0, 1)), centre=t, cap0=None, cap1='flat')
    for q in range(4):
        a = math.pi / 4 + q * math.pi / 2
        p = t + V((math.cos(a) * 0.042 * s, math.sin(a) * 0.042 * s, 0))
        k.box(p + V((0, 0, -0.1 * s)), V((0.005 * s, 0, 0)), V((0, 0.005 * s, 0)), V((0, 0, 0.055 * s)), cage)
    k.sphere(t + V((0, 0, -0.1 * s)), 0.034 * s, 8, 5, glow)
    k.lathe([(0.05 * s, 0.0), (0.05 * s, -0.012 * s)], 8, cage, axis=V((0, 0, 1)), centre=t + V((0, 0, -0.155 * s)),
            cap0='flat', cap1='flat')
    k.torus(t + V((0, 0, 0.012 * s)), V((1, 0, 0)), 0.016 * s, 0.0045 * s, 8, 4, cage)
    return k


def lantern_pole(sess, socket='Socket_HandR', cage=METAL, glow=GLOW, wood=WOOD):
    """The Sexton's lantern pole in world space at the rest pose: the pole along the socket's Y (held out ahead, the
    way the hero clips carry a weapon), an iron crook at its tip and the lantern hanging from it (world −Z)."""
    k = H.Kit()
    S = sess.socket(socket)
    y = (S.to_3x3() @ V((0, 1, 0))).normalized()
    o = S.translation
    k.lathe([(0.0135, -0.18), (0.012, 0.78)], 6, wood, axis=y, centre=o, cap0='flat', cap1='flat')
    tip = o + y * 0.78
    hook = [tip, tip + y * 0.05 + V((0, 0, 0.03)), tip + y * 0.11 + V((0, 0, 0.02)), tip + y * 0.13 + V((0, 0, -0.02))]
    k.tube(hook, [0.011, 0.010, 0.009, 0.008], 5, cage, 'flat', 'flat')
    top = tip + y * 0.13 + V((0, 0, -0.03))
    k.extend(lantern(cage, glow, 1.0, top))
    return k


def slab_sword(blade=METAL, guard=METAL, grip=LEATHER, length=1.18, width=0.15):
    """A slab-sword (socket space: the blade along +Y, its flats facing ±X, edges in the YZ plane)."""
    k = H.Kit()
    w = width / 2
    outline = [V((-0.0, 0.0, 0)), V((w, 0.02, 0)), V((w * 1.02, length * 0.55, 0)), V((w * 0.85, length * 0.72, 0)),
               V((w * 0.95, length * 0.86, 0)), V((w * 0.5, length, 0)), V((-w * 0.6, length * 0.97, 0)),
               V((-w, length * 0.8, 0)), V((-w, 0.02, 0))]
    # slab in the plane (z, y) of the socket: x of the outline → socket Z, y → socket Y; thickness along X
    k.slab([V((p.x, p.y, 0)) for p in outline], 0.028, blade, origin=V((0, 0.09, 0)), x=V((0, 0, 1)), y=V((0, 1, 0)))
    k.box(V((0, 0.075, 0)), V((0.022, 0, 0)), V((0, 0.016, 0)), V((0, 0, w + 0.05)), guard)
    k.lathe([(0.017, -0.13), (0.016, 0.06)], 6, grip, axis=V((0, 1, 0)), cap0='flat', cap1='flat')
    k.sphere(V((0, -0.15, 0)), 0.03, 6, 4, guard)
    return k


def great_bell(bell=METAL, rope=LEATHER, s=1.0, n=12):
    k = H.Kit()
    prof = [(0.03 * s, -0.004 * s), (0.055 * s, -0.04 * s), (0.07 * s, -0.11 * s), (0.09 * s, -0.17 * s),
            (0.1 * s, -0.19 * s), (0.08 * s, -0.185 * s)]
    k.lathe(prof, n, bell, axis=V((0, 0, 1)), centre=V((0, 0, 0)), cap0=V((0, 0, 0)), cap1=None)
    k.sphere(V((0, 0, -0.17 * s)), 0.025 * s, 6, 3, bell)
    k.torus(V((0, 0, 0.02 * s)), V((1, 0, 0)), 0.022 * s, 0.007 * s, 8, 4, rope)
    return k


def iron_circlet(slot=METAL, n=14):
    """A spiked iron circlet round the skull's brow (on Head)."""
    k = H.Kit()
    C = V((0.0, -0.006, 1.645))
    rings = []
    for z, s in ((1.672, 1.0), (1.70, 1.0)):
        ring = []
        for q in range(n):
            t = 2 * math.pi * q / n
            ring.append(V((math.sin(t) * 0.088 * s, -math.cos(t) * 0.106 * s + C.y, z)))
        rings.append(ring)
    k.rings(rings, slot, True)
    for q in range(0, n, 2):
        t = 2 * math.pi * (q + 0.5) / n
        base = V((math.sin(t) * 0.09, -math.cos(t) * 0.108 + C.y, 1.695))
        k.cone(base, base + V((math.sin(t) * 0.012, -math.cos(t) * 0.012, 0.055)), 0.012, 4, slot)
    return k


def mantle(sess, K, cloth, lining, trim, bell, z_top=1.47, rows=None, over=()):
    """A bell-hung mantle over the shoulders (and the pauldrons under it): a bell of cloth from the collar to the
    upper arms, a ragged hem with small bells. Bound to the body for weights; the arms move it at most halfway."""
    import gear_loft as L
    n = 18
    spec = rows or [(1.48, 0.112, 0.092), (1.45, 0.215, 0.152), (1.40, 0.315, 0.205), (1.32, 0.372, 0.232),
                    (1.22, 0.392, 0.242), (1.12, 0.40, 0.248)]
    grid = []
    for i, (z, rx, ry) in enumerate(spec):
        ring = []
        for q in range(n):
            t = 2 * math.pi * q / n
            zz = z
            if i == len(spec) - 1:
                zz = z - (0.06 if q % 2 else 0.0)
            ring.append(V((math.sin(t) * rx, -math.cos(t) * ry + 0.012, zz)))
        grid.append(ring)
    g = L.Grid()
    g.rows(grid, lambda i, jq: trim if i == 0 else cloth, closed=True, orient=V((0, 0.0, 1.2)))
    piece = sess.fg.piece('mantle', g)
    part = L.Part('mantle', piece, allow=['UpperChest', 'Chest', 'Neck', 'LeftShoulder', 'RightShoulder',
                                          'LeftUpperArm', 'RightUpperArm'], smooth=4, clear=0.02,
                  over=over, gap=0.012, reach=0.08, cap={'LeftUpperArm': 0.35, 'RightUpperArm': 0.35})
    # the bells on the hem
    bk = H.Kit()
    for q in range(1, n, 3):
        t = 2 * math.pi * q / n
        z, rx, ry = spec[-1]
        p = V((math.sin(t) * rx * 1.02, -math.cos(t) * ry * 1.02 + 0.012, z - 0.06))
        b = great_bell(bell, bell, 0.42, n=8)
        b.transform(Matrix.Translation(p))
        bk.extend(b)
    return [part], bk


# ====================================================================== the variants
VARIANTS = [
    dict(id='skeleton-footman', scale=1.0,
         colors=H.palette('#d9cdb0', '#5e7350', '#8b4a2b', ink='#14110f', leather='#4a3426', metal='#77736b',
                          glow='#a6ff7a', wood='#5a4330', bone='#efe6cd'),
         clipMap={'Attack2': 'Guard_Shield', 'Rise': 'Revive'}),
    dict(id='skeleton-archer', scale=1.0,
         colors=H.palette('#d9cdb0', '#24211f', '#f2efe6', ink='#14110f', leather='#24211f', metal='#f2efe6',
                          glow='#a6ff7a', wood='#6b5136', bone='#efe6cd', cloth3='#3a3430'),
         clipMap={'Attack1': 'Shoot', 'Attack2': 'Shoot', 'Fire': 'Shoot'}),
    dict(id='bone-knight', scale=1.25,
         colors=H.palette('#50555c', '#d6cbb0', '#5fb8ff', ink='#0f1014', leather='#3b2f28', metal='#50555c',
                          glow='#6cc4ff', cloth1='#34404f', cloth2='#53606e', cloth3='#2a313b', bone='#ece2c6'),
         clipMap={'Attack1': 'Attack_Heavy', 'Attack2': 'Attack_Heavy', 'Guard': 'Guard', 'Cleave': 'Attack_Heavy'}),
    dict(id='crypt-sexton', scale=1.0,
         colors=H.palette('#302d35', '#d6cbb0', '#7dff6a', ink='#0d0c10', leather='#3d332c', metal='#6e6a62',
                          glow='#8dff7a', cloth2='#45433a', wood='#4d3b2b', bone='#ece2c6', trim='#b08a4a'),
         clipMap={'Attack1': 'Cast', 'Attack2': 'Cast', 'Cast': 'Cast', 'Ring': 'Cast'}),
    dict(id='barrow-warden', scale=1.75,
         colors=H.palette('#2e2f35', '#d8ccb2', '#7dffb0', ink='#0b0b0e', leather='#33291f', metal='#3e4048',
                          glow='#7dffb0', cloth1='#25262c', cloth2='#3d3a35', cloth3='#56524a', trim='#9a7b45',
                          bone='#ece2c6'),
         clipMap={'Attack1': 'Attack_Heavy', 'Attack2': 'Attack_Light', 'Toll': 'Cast', 'Bulwark': 'Guard',
                  'Verdict': 'Cast', 'Grip': 'Attack_Light', 'PhaseTurn': 'Roar'},
         phases={'2': {'colors': {'2': '#6fa8ff', '11': '#6fa8ff'}, 'note': 'the lantern turns blue (Shadow)'}}),
]


def build(sess):
    K = sess.K
    kits = bone_kits(sess, K)
    out = {}
    # ---- shared: the whole skeleton (footman, archer)
    allb = sess.multi('skeleton_common_bones', pick(kits, ['all']), {'variant': 'common', 'piece': 'bones'})
    # ---- footman
    tab = sess.make('skeleton_footman_tabard', tabard_panels(sess, K, trim=None), {'variant': 'footman', 'piece': 'tabard'})
    shield = sess.rigid('skeleton_footman_shield', round_shield(), socket='Socket_HandL',
                        props={'variant': 'footman', 'piece': 'shield'})
    sword = sess.weapon('wpn_sword_F', 'skeleton_footman_sword', 'Socket_HandR',
                        slot_map={10: ACC}, props={'variant': 'footman', 'piece': 'sword'})
    out['skeleton-footman'] = [allb, tab, shield, sword]
    # ---- archer
    bow = sess.weapon('wpn_longbow_F', 'skeleton_archer_bow', 'Socket_HandR', props={'variant': 'archer', 'piece': 'bow'})
    quiv = sess.weapon('qvr_quiver_F', 'skeleton_archer_quiver', slot_map={LEATHER: CLOTH}, place=hip_quiver(sess),
                       bone='Hips', props={'variant': 'archer', 'piece': 'quiver'})
    arrows = sess.weapon('qvr_arrowsFull_F', 'skeleton_archer_arrows', slot_map={METAL: ACC}, place=hip_quiver(sess),
                         bone='Hips', props={'variant': 'archer', 'piece': 'arrows'})
    out['skeleton-archer'] = [allb, bow, quiv, arrows, archer_strap(sess, K)]
    # ---- bone knight: Warden F plate, tattered tabard, great helm, bone arms
    pl = {9: 0, 7: 6, 15: 7}

    def ragged(c, s, bone):
        # the tabard (cloth2/cloth3 on the Warden's chest piece) torn to a ragged hem
        return s in (7, 15) and c.z < 0.64 + 0.09 * (0.5 + 0.5 * math.sin(c.x * 97.0 + c.y * 31.0))
    kn_chest = sess.reuse('warden', 'gear_warden_chest_F.broad', 'skeleton_knight_chest', slot_map=pl, drop=ragged,
                          props={'variant': 'knight', 'piece': 'chest'})
    kn_legs = sess.reuse('warden', 'gear_warden_legs_F.broad', 'skeleton_knight_legs', slot_map=pl,
                         props={'variant': 'knight', 'piece': 'legs'})
    kn_boots = sess.reuse('warden', 'gear_warden_boots_F.broad', 'skeleton_knight_boots', slot_map=pl,
                          props={'variant': 'knight', 'piece': 'boots'})
    kn_helm = sess.rigid('skeleton_knight_helm', great_helm(0, GLOW, INK), bone='Head',
                         props={'variant': 'knight', 'piece': 'helm'})
    kn_bones = sess.multi('skeleton_knight_bones', pick(kits, ['arms', 'neck'], 1), {'variant': 'knight', 'piece': 'bones'})
    kn_sword = sess.weapon('wpn_greatsword_F', 'skeleton_knight_sword', 'Socket_HandR', props={'variant': 'knight', 'piece': 'sword'})
    out['bone-knight'] = [kn_chest, kn_legs, kn_boots, kn_helm, kn_bones, kn_sword]
    # ---- crypt sexton: Arcanist F robe + hood, skull, bone hands and shins, bell, lantern pole
    rm = {6: 0, 7: 7, 8: 8}
    sx_robe = sess.reuse('arcanist', 'gear_arcanist_chest_F.broad', 'skeleton_sexton_robe', slot_map=rm,
                         props={'variant': 'sexton', 'piece': 'robe'})
    sx_hood = sess.reuse('arcanist', 'gear_arcanist_helmet_F.broad', 'skeleton_sexton_hood', slot_map={6: 0, 7: INK, 8: 8},
                         props={'variant': 'sexton', 'piece': 'hood'})
    sx_bones = sess.multi('skeleton_sexton_bones', pick(kits, ['arms', 'head', 'neck', 'legs_low'], 1),
                          {'variant': 'sexton', 'piece': 'bones'})
    sx_bell = sess.rigid('skeleton_sexton_bell', hand_bell(sess, 'Socket_HandL', 1.7, TRIM, WOOD), bone='LeftHand',
                         props={'variant': 'sexton', 'piece': 'bell'})
    sx_pole = sess.rigid('skeleton_sexton_lantern', lantern_pole(sess, 'Socket_HandR', METAL, GLOW, WOOD),
                         bone='RightHand', props={'variant': 'sexton', 'piece': 'lantern'})
    out['crypt-sexton'] = [sx_robe, sx_hood, sx_bones, sx_bell, sx_pole]
    # ---- barrow warden: Warden F plate (iron black), skull + circlet, mantle with bells, lantern, slab-sword, bell
    bw_chest = sess.reuse('warden', 'gear_warden_chest_F.broad', 'skeleton_warden_chest', slot_map=pl, drop=ragged,
                          props={'variant': 'warden', 'piece': 'chest'})
    bw_legs = sess.reuse('warden', 'gear_warden_legs_F.broad', 'skeleton_warden_legs', slot_map=pl,
                         props={'variant': 'warden', 'piece': 'legs'})
    bw_boots = sess.reuse('warden', 'gear_warden_boots_F.broad', 'skeleton_warden_boots', slot_map=pl,
                          props={'variant': 'warden', 'piece': 'boots'})
    bw_bones = sess.multi('skeleton_warden_bones', pick(kits, ['arms', 'head', 'neck'], 1), {'variant': 'warden', 'piece': 'bones'})
    bw_circ = sess.rigid('skeleton_warden_circlet', iron_circlet(METAL), bone='Head', props={'variant': 'warden', 'piece': 'circlet'})
    m_parts, m_bells = mantle(sess, K, 15, 15, TRIM, TRIM, over=('skeleton_warden_chest',))
    bw_mantle = sess.make('skeleton_warden_mantle', m_parts, {'variant': 'warden', 'piece': 'mantle'})
    bw_bells = sess.rigid('skeleton_warden_mantlebells', m_bells, bone='UpperChest', props={'variant': 'warden', 'piece': 'mantlebells'})
    # the lantern on its chain hangs below the left fist (world −Z at the rest pose), rigid on the hand
    lan = H.Kit()
    lan.chain([V((0, 0.0, 0.02)), V((0, 0.0, -0.12)), V((0, 0.0, -0.34))], 0.05, 0.0055, METAL)
    lan.extend(lantern(METAL, GLOW, 1.15, V((0, 0, -0.36))))
    lan.transform(Matrix.Translation(sess.socket('Socket_HandL').translation + V((0, 0, -0.02))))
    bw_lantern = sess.rigid('skeleton_warden_lantern', lan, bone='LeftHand', props={'variant': 'warden', 'piece': 'lantern'})
    bw_sword = sess.rigid('skeleton_warden_sword', slab_sword(METAL, METAL, LEATHER), socket='Socket_HandR',
                          props={'variant': 'warden', 'piece': 'sword'})
    gb = great_bell(METAL, LEATHER, 1.0)
    gb.transform(Matrix.Translation(V((0.205, 0.02, 0.86))))
    bw_bell = sess.rigid('skeleton_warden_bell', gb, bone='Hips', props={'variant': 'warden', 'piece': 'bell'})
    out['barrow-warden'] = [bw_chest, bw_legs, bw_boots, bw_bones, bw_circ, bw_mantle, bw_bells, bw_lantern, bw_sword, bw_bell]
    return out


def archer_strap(sess, K):
    """A leather strap from the right shoulder to the left hip that carries the quiver."""
    import gear_loft as L
    T = K.torso
    g = L.Grid()
    pts = []
    for q in range(8):
        s = q / 7
        z = H.lerp(1.40, 0.98, s)
        th = D(H.lerp(-62, 118, s))
        pts.append((z, th))
    rows = []
    for dz in (-0.022, 0.022):
        rows.append([T.pt(K.tz(z + dz), th, 0.006, 0.84) for z, th in pts])
    g.rows(rows, LEATHER)
    g2 = L.Grid()
    g2.rows([[T.pt(K.tz(z + dz), th, 0.0, 0.84) for z, th in pts] for dz in (0.022, -0.022)], LEATHER)
    g.extend(g2)
    part = L.Part('strap', sess.fg.piece('strap', g), allow=['UpperChest', 'Chest', 'Spine', 'Hips'], smooth=2, clear=0.002)
    return sess.make('skeleton_archer_strap', [part], {'variant': 'archer', 'piece': 'strap'})


# ====================================================================== review, export
def height_of(objs, scale):
    z = 0.0
    for ob in objs:
        for v in ob.data.vertices:
            z = max(z, (ob.matrix_world @ v.co).z)
    return z * scale


def main():
    sess = H.Session(BASE)
    parts = build(sess)
    vs = []
    for v in VARIANTS:
        v = dict(v)
        v['base'] = BASE
        objs = parts[v['id']]
        v['objs'] = objs
        v['tris'] = sum(H.tris_of(o) for o in objs)
        v['height'] = height_of(objs, v['scale'])
        vs.append(v)
        log('%s: %d tris, %.2f m, parts %s' % (v['id'], v['tris'], v['height'], [o.name for o in objs]))
    if not ARGS.get('no_render'):
        rv = H.Review(sess, quick=QUICK)
        for v in vs:
            rv.look(v['objs'], v['id'], v['colors'])
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
            users = [v['id'] for v in vs if o in v['objs']]
            o['monsters'] = users
        kb = H.export_base(sess, objs)
        entries = {}
        for v in vs:
            entries[v['id']] = H.manifest_entry(v, [o.name for o in v['objs']], sess.rig)
        H.write_manifest(entries)
        log('skeleton.glb %.1f KB' % kb)
        H.reimport_check(BASE)


main()

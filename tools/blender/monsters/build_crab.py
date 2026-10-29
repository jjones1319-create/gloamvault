"""build_crab.py — the crab base (06 §9, D-117): the Brine Crab pet of the Drowned Vault.

Run:  blender -b -P tools/blender/monsters/build_crab.py -- [--quick] [--no-renders] [--no-export] [--only Idle,Move]

A broad, chunky shore crab (scale 1 = a 1.0 m carapace, a giant crab; the pet is x0.5, a 0.5 m shell, 06 §9 "crab base
0.5 m"): a domed teal carapace with a pale lip round its rim, three pale teeth along each front edge and two horns
between the eyes, black eyes on stalks, a pale underside, two claws held before its face — the left a heavier crusher —
each a swollen palm and two pale, dark-tipped fingers open in a C (the pincer's plane tilted toward a camera in front
and above), and four stout, jointed walking legs a side, pale-banded at the joints. The part `crab_pearl` is the pet's mark: a
big pearl (palette slot 14, gem: the client fills it with the accent colour and lets it glow) set in a scalloped collar of
nacre on the top of the shell. Rig (44 bones): Root · Body · Eye_L/R · per claw Claw_Arm / Claw_Fore / Claw_Hand /
Claw_Finger · per leg (1–4, L/R) Coxa / Femur / Tibia / Tarsus — each leg a yawing coxa and a two-bone IK (knee up), the
dactyl slanted to the floor (creature_lib's spider legs).

Clips: Idle (breathing, eye stalks, the crusher opens and snaps shut, a leg re-planted), Move (alternating-tetrapod
scuttle, claws up), Attack1 (Pinch: rear, the crusher cocked open, lunge and snap — `hit` — then a shake while it holds),
Attack2 (Tide Shell: it rises, claws flung high and wide, clacks them — `release` — and settles into a low guard behind
crossed claws), Hit, Death (legs give way and splay, it drops onto its belly, claws limp, eye stalks folded — `down`).

Outputs: client/public/models/monsters/crab.glb, the `crab` key of clips.json, the `pet-brine-crab` entry of
manifest.json, art/renders/monsters/crab/*.png, art/build/monsters_crab.blend, art/build/monsters_crab_checks.txt.
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import creature_lib as C  # noqa: E402
import pet_lib as P  # noqa: E402
from creature_lib import (ACCENT, GEM, INK, MAIN, SECOND, CRig, Clip, Geo, Leg, ball, capsule, ellipsoid,  # noqa: E402
                          step, wave)
from pet_lib import J, sym  # noqa: E402

ARGS = C.args()
QUICK = bool(ARGS.get('quick'))
ONLY = set(ARGS['only'].split(',')) if isinstance(ARGS.get('only'), str) else None
BASE = 'crab'
BUDGET = 3150          # the body object (shell, claws, legs, eyes); the pearl part comes on top — a pet is 2–4k (06 §9)
RES = 0.009            # metaball resolution at scale 1 (a 1 m shell)

UP = (0, 0, 1)
FWD = (0, -1, 0)
LEG_DEF = [(1, 60.0, 0.98), (2, 86.0, 1.04), (3, 111.0, 1.0), (4, 136.0, 0.88)]   # leg, yaw from forward, length
CLAW_K = {1: 1.14, -1: 0.94}     # the left claw (+X) is the crusher
FINGER_SHUT = -10.0              # Claw_Finger X that closes the resting gape


def sd(name, s):
    return name + ('_L' if s > 0 else '_R')


def leg_name(i, part, s):
    return 'Leg%d_%s%s' % (i, part, '_L' if s > 0 else '_R')


def leg_points(i, theta, k, s):
    """Coxa head, then the coxa / merus / carpus-propodus / dactyl joints and the tip on the floor; d = the leg's heading."""
    t = math.radians(theta)
    d = Vector((s * math.sin(t), -math.cos(t), 0.0))
    base = Vector((s * 0.235 * math.sin(t), 0.05 - 0.21 * math.cos(t), 0.36))
    a1 = math.radians(16.0)
    a2 = math.radians(72.0)
    p1 = base + d * (0.07 * k) + Vector((0, 0, -0.004))
    p2 = p1 + d * (0.30 * k * math.cos(a1)) + Vector((0, 0, 0.30 * k * math.sin(a1)))
    p3 = p2 + d * (0.30 * k * math.cos(a2)) + Vector((0, 0, -0.30 * k * math.sin(a2)))
    p4 = p3 + d * (0.05 * k)
    p4.z = 0.004
    return base, p1, p2, p3, p4, d


def claw_points(s):
    """Shoulder, elbow, wrist, the finger base on the palm's front, the hinge of the moving finger and the two finger
    tips (a resting gape between them), for one claw (left: s = 1), scaled by its size about the shoulder."""
    k = CLAW_K[s]
    S0 = Vector((s * 0.22, -0.22, 0.38))

    def sc(p):
        return S0 + (Vector(p) - S0) * k
    E = sc((s * 0.38, -0.32, 0.36))
    Wr = sc((s * 0.35, -0.43, 0.42))
    ax = Vector((-s * 0.55, -0.80, 0.22)).normalized()
    FB = Wr + ax * (0.19 * k)
    # the pincer opens in a plane tilted 30 degrees from the vertical toward outward-forward, so the C shows to a camera
    # in front and above (the fight camera looks down about 30 degrees)
    out_fwd = (-s * ax.cross(Vector((0, 0, 1)))).normalized()
    up = Vector((0, 0, 1)) * math.cos(math.radians(30)) + out_fwd * math.sin(math.radians(30))
    up = (up - ax * up.dot(ax)).normalized()

    def fp(u, w):
        """A point in the claw's own plane: u along the hand from the palm's front, w up (metres at k = 1)."""
        return FB + ax * (u * k) + up * (w * k)
    H = fp(-0.04, 0.05)
    Tp = fp(0.20, -0.015)
    Td = fp(0.205, 0.03)
    return dict(S0=S0, E=E, Wr=Wr, FB=FB, ax=ax, up=up, fp=fp, H=H, Tp=Tp, Td=Td, k=k)


RIM_Z = 0.47
EYE_BASE = Vector((0.075, -0.31, 0.53))
EYE_TIP = Vector((0.095, -0.355, 0.645))


def bone_table():
    b = [
        ('Root', None, (0, 0, 0), (0, -0.20, 0), UP),
        ('Body', 'Root', (0, 0.20, 0.44), (0, -0.25, 0.44), UP),
    ]
    for s in (1, -1):
        eb = Vector((EYE_BASE.x * s, EYE_BASE.y, EYE_BASE.z))
        et = Vector((EYE_TIP.x * s, EYE_TIP.y, EYE_TIP.z))
        b.append((sd('Eye', s), 'Body', tuple(eb), tuple(et), FWD))
        c = claw_points(s)
        b += [
            (sd('Claw_Arm', s), 'Body', tuple(c['S0']), tuple(c['E']), UP),
            (sd('Claw_Fore', s), sd('Claw_Arm', s), tuple(c['E']), tuple(c['Wr']), UP),
            (sd('Claw_Hand', s), sd('Claw_Fore', s), tuple(c['Wr']), tuple(c['FB']), tuple(c['up'])),
            (sd('Claw_Finger', s), sd('Claw_Hand', s), tuple(c['H']), tuple(c['Td']), tuple(c['up'])),
        ]
        for i, th, k in LEG_DEF:
            base, p1, p2, p3, p4, d = leg_points(i, th, k, s)
            b += [
                (leg_name(i, 'Coxa', s), 'Body', tuple(base), tuple(p1), UP),
                (leg_name(i, 'Femur', s), leg_name(i, 'Coxa', s), tuple(p1), tuple(p2), UP),
                (leg_name(i, 'Tibia', s), leg_name(i, 'Femur', s), tuple(p2), tuple(p3), UP),
                (leg_name(i, 'Tarsus', s), leg_name(i, 'Tibia', s), tuple(p3), tuple(p4), UP),
            ]
    return b


def legs():
    out = []
    for s in (1, -1):
        for i, th, k in LEG_DEF:
            out.append(Leg('%s%d' % ('L' if s > 0 else 'R', i), (leg_name(i, 'Femur', s), leg_name(i, 'Tibia', s)),
                           (leg_name(i, 'Tarsus', s),), bend=1, yaw=leg_name(i, 'Coxa', s)))
    return out


# ====================================================================== body
def body_elements():
    el = [
        ellipsoid((0, 0.02, 0.47), (0.50, 0.36, 0.12), bone='Body', tag='shell'),
        ellipsoid((0.26, -0.14, 0.465), (0.24, 0.18, 0.10), bone='Body', tag='lobe_L'),
        ellipsoid((0, 0.02, 0.53), (0.32, 0.25, 0.11), bone='Body', tag='dome'),
        ellipsoid((0, 0.06, 0.38), (0.27, 0.22, 0.075), bone='Body', slot=SECOND, tag='belly'),
        ellipsoid((0, -0.29, 0.42), (0.13, 0.07, 0.06), bone='Body', tag='face'),
    ]
    for i, th, k in LEG_DEF:
        base, p1, p2, p3, p4, d = leg_points(i, th, k, 1)
        el.append(ball(tuple(base + d * 0.02), 0.055, bone={leg_name(i, 'Coxa', 1): 0.5, 'Body': 0.5}, slot=SECOND,
                       tag='coxa%d_L' % i))
    c = claw_points(1)
    el.append(ball(tuple(c['S0']), 0.06, bone={'Claw_Arm_L': 0.4, 'Body': 0.6}, slot=SECOND, tag='claw_socket_L'))
    return C.with_mirror(el)


def claw_elements(s):
    c = claw_points(s)
    k = c['k']
    ax = c['ax']
    zz = c['up']
    xx = ax.cross(zz)
    rot = Matrix((xx, ax, zz)).transposed().to_quaternion()
    pc = c['Wr'] + ax * (0.105 * k)
    return [
        capsule(tuple(c['S0']), tuple(c['E']), 0.040 * k, bone=sd('Claw_Arm', s), tag='arm'),
        ball(tuple(c['E']), 0.048 * k, bone={sd('Claw_Arm', s): 0.5, sd('Claw_Fore', s): 0.5}, tag='elbow'),
        capsule(tuple(c['E']), tuple(c['Wr']), 0.044 * k, bone=sd('Claw_Fore', s), tag='fore'),
        ball(tuple(c['Wr']), 0.052 * k, bone={sd('Claw_Fore', s): 0.5, sd('Claw_Hand', s): 0.5}, tag='wrist'),
        ellipsoid(tuple(pc), (0.078 * k, 0.118 * k, 0.122 * k), bone=sd('Claw_Hand', s), rot=rot, tag='palm'),
    ]


def finger_tube(pts, radii, k, up, slot_tip=INK, tip=0.3, slot=SECOND, n=8):
    """A tapered, curved finger through the control points (radii from root to tip, resampled over n rings); its last
    `tip` of the length is ink (the dark pincer tip)."""
    P = C.curve_points([tuple(p) for p in pts], n)
    rr = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(radii)), radii) * k
    V, F, N, ring = C.tube(P, rr, sides=6, cap0='flat', cap1='point', up=tuple(up), flat=[(1.15, 0.85)] * n)
    first_tip = int(round((n - 1) * (1 - tip)))
    slots = []
    for f in F:
        rs = [ring[v] for v in f]
        slots.append(slot_tip if min(rs) >= first_tip else slot)
    return V, F, N, slots


def spike(base, tip, r, flat=0.45, sides=5):
    """A flattened cone (a shell tooth): wide in the horizontal, thin in the vertical."""
    V, F, N, _ = C.tube([tuple(base), tuple(tip)], [r, 0.0], sides=sides, cap0='flat', cap1='point', up=(0, 0, 1),
                        flat=[(flat, 1.0), (flat, 1.0)])
    return V, F, N


def build_geometry(rig):
    body_el = body_elements()
    att = Geo()
    # ---------------------------------------------------------------- eyes on stalks (black, a pale glint)
    for s in (1, -1):
        eb = rig.head[sd('Eye', s)]
        et = rig.tail[sd('Eye', s)]
        d = (et - eb).normalized()
        pts = [eb - d * 0.05, eb, eb.lerp(et, 0.55), et]
        V, F, N, _ = C.tube(pts, [0.022, 0.022, 0.020, 0.018], sides=5, cap0='flat', cap1='flat', up=(0, -1, 0))
        att.add(V, F, MAIN, N, {sd('Eye', s): 1.0}, name='stalk')
        ec = et + d * 0.014
        V, F, N = C.uv_sphere(tuple(ec), (0.042, 0.042, 0.048), rings=5, segs=7, rot=d.to_track_quat('Z', 'Y'))
        att.add(V, F, INK, N, {sd('Eye', s): 1.0}, name='eye')
        g = ec + Vector((s * 0.013, -0.031, 0.024))
        V, F, N = C.uv_sphere(tuple(g), 0.012, rings=3, segs=4)
        att.add(V, F, ACCENT, N, {sd('Eye', s): 1.0}, name='glint')
    # ---------------------------------------------------------------- horns between the eyes, teeth on the front edges
    for s in (1, -1):
        b0 = C.surface_point(body_el, (s * 0.035, -0.25, 0.49), (0, -1, 0.15), reach=0.3)
        V, F, N = spike(b0 + Vector((0, 0.02, 0)), b0 + Vector((s * 0.01, -0.075, 0.012)), 0.032, flat=0.6)
        att.add(V, F, MAIN, N, {'Body': 1.0}, name='horn')
        for j, phi in enumerate((30.0, 48.0, 66.0)):
            a = math.radians(phi)
            dr = Vector((s * math.sin(a), -math.cos(a), 0.0))
            p0 = C.surface_point(body_el, (0, -0.02, RIM_Z), tuple(dr), reach=0.8)
            ta = math.radians(phi - 20.0)
            tdir = Vector((s * math.sin(ta), -math.cos(ta), 0.06)).normalized()
            ln = 0.11 - 0.01 * j
            V, F, N = spike(p0 - dr * 0.04, p0 + tdir * ln, 0.062 - 0.005 * j)
            att.add(V, F, SECOND, N, {'Body': 1.0}, name='tooth')
    # ---------------------------------------------------------------- the rim: a pale lip round the shell's widest edge
    rim = []
    for i in range(20):
        a = 2 * math.pi * i / 20
        dr = Vector((math.sin(a), -math.cos(a), 0.0))
        rim.append(C.surface_point(body_el, (0, 0.02, RIM_Z), tuple(dr), reach=0.8) + dr * 0.004)
    V, F, N = C.ring_tube(rim, 0.03, sides=5, flat=(0.7, 1.0))
    att.add(V, F, SECOND, N, {'Body': 1.0}, name='rim')
    # ---------------------------------------------------------------- walking legs: stout, flattened, knuckled
    for s in (1, -1):
        for i, th, k in LEG_DEF:
            base, p1, p2, p3, p4, d = leg_points(i, th, k, s)
            chain = [leg_name(i, p, s) for p in ('Coxa', 'Femur', 'Tibia', 'Tarsus')]
            ctrl = [base, p1, p2, p3, p4]
            pts, rad, band, seg = [], [], [], []
            radii = [0.058, 0.055, 0.047, 0.037, 0.0]
            nsegs = [1, 3, 3, 2]
            for j in range(4):
                a, b_ = Vector(ctrl[j]), Vector(ctrl[j + 1])
                for q in range(nsegs[j]):
                    u = q / nsegs[j]
                    pts.append(a.lerp(b_, u))
                    r0 = radii[j]
                    r1 = radii[j + 1] if j < 3 else 0.012
                    r = r0 + (r1 - r0) * u
                    if q == 0 and j > 0:
                        r *= 1.14
                    rad.append(r * k ** 0.5)
                    band.append(q == 0 and j > 0)
                    seg.append(j)
            pts.append(Vector(p4))
            rad.append(0.0)
            band.append(False)
            seg.append(3)
            V, F, N, ring = C.tube(pts, rad, sides=6, cap0='flat', cap1='point', up=(0, 0, 1),
                                   flat=[(1.18, 0.82)] * len(pts))
            slots = []
            for f in F:
                rs = [ring[v] for v in f]
                r0 = min(rs)
                if seg[r0] == 3:
                    slots.append(SECOND)              # the dactyl
                elif band[r0] and max(rs) == r0 + 1:
                    slots.append(SECOND)              # a pale band at the joint
                else:
                    slots.append(MAIN)
            W = C.chain_weights(rig, V, chain, 'Body', blend=0.3)
            att.add(V, F, slots, N, W, name='leg')
    # ---------------------------------------------------------------- claws: an implicit arm-forearm-palm, tube fingers
    claw_tris = 360
    claws = []
    for s in (1, -1):
        c = claw_points(s)
        el = claw_elements(s)
        Vc, Fc, Nc = C.implicit_mesh(el, RES * 0.55, int(claw_tris * (1.1 if s > 0 else 0.9)), sym=False,
                                     name='crab_mb_claw_%s' % ('L' if s > 0 else 'R'))
        Wc = C.field_weights(Vc, el, power=2.0)
        FNc = C.face_normals(Vc, Fc)
        dom = C.dominant(np.array([Vc[list(f)].mean(0) for f in Fc]), el)
        sl = []
        for q, f in enumerate(Fc):
            e = el[dom[q]]
            sl.append(SECOND if (e.tag == 'palm' and FNc[q][2] < -0.62) else MAIN)
        claws.append((Vc, Fc, Nc, sl, Wc))
        k = c['k']
        fp = c['fp']
        pts = [fp(-0.06, -0.04), fp(0.05, -0.065), fp(0.13, -0.055), c['Tp']]         # the fixed finger, tip curling up
        V, F, N, slots = finger_tube(pts, [0.042, 0.040, 0.034, 0.025, 0.013, 0.0], k, c['up'])
        att.add(V, F, slots, N, {sd('Claw_Hand', s): 1.0}, name='pollex')
        pts = [fp(-0.06, 0.05), fp(0.06, 0.085), fp(0.14, 0.075), c['Td']]           # the moving finger, tip hooking down
        V, F, N, slots = finger_tube(pts, [0.040, 0.038, 0.032, 0.023, 0.012, 0.0], k, c['up'])
        att.add(V, F, slots, N, {sd('Claw_Finger', s): 1.0}, name='dactyl')
    used = att.tris() + sum(sum(len(f) - 2 for f in cl[1]) for cl in claws)
    body_tris = BUDGET - used - 20
    C.log('crab: attachments %d tris, claws %s, body implicit target %d' % (
        att.tris(), [sum(len(f) - 2 for f in cl[1]) for cl in claws], body_tris))
    # ---------------------------------------------------------------- the implicit body
    V, F, N = C.implicit_mesh(body_el, RES, body_tris, name='crab_mb_body')
    W = C.field_weights(V, body_el, power=2.0)
    dom = C.dominant(np.array([V[list(f)].mean(0) for f in F]), body_el)
    FN = C.face_normals(V, F)
    slots = []
    for q, f in enumerate(F):
        c = V[list(f)].mean(0)
        e = body_el[dom[q]]
        sl = e.slot
        if e.tag in ('shell', 'lobe_L', 'lobe_R', 'face') and FN[q][2] < -0.3:
            sl = SECOND                                # the pale underside of the shell
        if c[1] < -0.30 and c[2] < 0.44 and FN[q][1] < -0.45 and abs(c[0]) < 0.085:
            sl = INK                                   # the mouth under the horns
        slots.append(sl)
    geo = Geo()
    geo.add(V, F, slots, N, W, name='body')
    for q, (Vc, Fc, Nc, sl, Wc) in enumerate(claws):
        geo.add(Vc, Fc, sl, Nc, Wc, name='claw')
    Vx, Nx = att.arrays()
    for nm, off, n in att.pieces:
        fs = [tuple(i - off for i in f) for f in att.F if off <= f[0] < off + n]
        ss = [s for f, s in zip(att.F, att.S) if off <= f[0] < off + n]
        geo.add(Vx[off:off + n], fs, ss, Nx[off:off + n], att.W[off:off + n], name=nm)
    body = C.make_object(geo, 'crab_body', rig.ob, key_names=[])
    body['kind'] = 'body'
    body['base'] = BASE
    parts = {'crab_pearl': build_pearl(rig, body_el)}
    for nm, ob in parts.items():
        ob['kind'] = 'part'
        ob['base'] = BASE
        ob['part'] = nm
    return body, parts


def build_pearl(rig, el):
    """The pet's pearl: a big pearl (slot 14, gem — it glows in the accent colour) in a scalloped nacre collar."""
    g = Geo()
    top = C.surface_point(el, (0, 0.04, 0.45), (0, 0, 1), reach=0.4)
    r = 0.105
    pc = top + Vector((0, 0, r * 0.52))
    V, F, N = C.uv_sphere(tuple(pc), r, rings=8, segs=12)
    g.add(V, F, GEM, N, {'Body': 1.0}, name='pearl')
    lobes = []
    n = 9
    for i in range(n):
        a = 2 * math.pi * (i + 0.5) / n
        q = Vector((pc.x + 0.10 * math.cos(a), pc.y + 0.10 * math.sin(a), 0.42))
        sp = C.surface_point(el, tuple(q), (0, 0, 1), reach=0.4)
        lobes.append(ball(tuple(sp + Vector((0, 0, 0.006))), 0.034, bone='Body', slot=SECOND))
    Vl, Fl, Nl = C.implicit_mesh(lobes, 0.006, 220, sym=False, name='crab_mb_collar')
    g.add(Vl, Fl, SECOND, Nl, {'Body': 1.0}, name='collar')
    return C.make_object(g, 'crab_pearl', rig.ob)


# ====================================================================== clips
GROUP_A = ('L1', 'R2', 'L3', 'R4')


def author(rig, M):
    clips = []
    N0 = {'legs': {}}
    shell = M.vertex_mask(('Body',))
    claw_mask = {s: M.vertex_mask(tuple(sd(b, s) for b in ('Claw_Arm', 'Claw_Fore', 'Claw_Hand', 'Claw_Finger')), at_least=0.5)
                 for s in (1, -1)}
    all_legs = [l.name for l in rig.legs]

    def bump(t, t0, dur):
        u = (t - t0) / dur
        return math.sin(math.pi * u) if 0.0 <= u <= 1.0 else 0.0

    def click(t, t0):
        """The crusher's click: opens wide, snaps shut, holds, eases back to the resting gape."""
        u = t - t0
        if u < 0:
            return 0.0
        if u < 0.25:
            return 28 * C.smooth(u / 0.25)
        if u < 0.32:
            return 28 + (FINGER_SHUT - 28) * ((u - 0.25) / 0.07) ** 2
        if u < 0.45:
            return FINGER_SHUT
        if u < 0.75:
            return FINGER_SHUT * (1 - C.smooth((u - 0.45) / 0.3))
        return 0.0

    def clear_claws(pose, floor=0.008, inc=2.0, limit=40.0):
        """Raises each claw (Claw_Arm X) until none of its vertices is below the floor."""
        p = dict(pose)
        for s in (1, -1):
            b = sd('Claw_Arm', s)
            x0, y0, z0 = p.get(b, (0, 0, 0))
            x = x0
            while True:
                p[b] = (x, y0, z0)
                M.apply_pose(p)
                lo = C.evaluated_coords(M.body)[claw_mask[s]][:, 2].min()
                if lo >= floor or x - x0 >= limit:
                    break
                x += inc
        M.rig.rest_pose()
        bpy.context.view_layer.update()
        return p

    # ---------------------------------------------------------- Idle: breathing, eye stalks, the crusher clicks, a leg re-planted
    def idle(t):
        br = wave(t, 1.0)
        p = {'legs': {}}
        p['Root.loc'] = (0.0, 0.0, 0.006 * br)
        p['Body'] = (1.2 * wave(t, 2.0, 0.15), 1.0 * wave(t, 2.0, 0.4), 1.5 * wave(t, 2.0))
        p.update(sym({'Claw_Arm_L': (4 + 3 * wave(t, 2.0, 0.1), 0, -2 * wave(t, 2.0, 0.3)),
                      'Claw_Fore_L': (-2 + 2 * wave(t, 1.0, 0.3), 0, 0),
                      'Claw_Hand_L': (3 + 3 * wave(t, 1.0, 0.2), 0, 0)}))
        p['Claw_Arm_R'] = (3 + 3 * wave(t, 2.0, 0.6), 0, 2 * wave(t, 2.0, 0.8))
        p['Claw_Finger_L'] = (click(t, 0.6), 0, 0)
        p['Claw_Finger_R'] = (-6 * bump(t, 1.4, 0.3), 0, 0)
        p['Eye_L'] = (8 * wave(t, 2.0 / 3, 0.1), 0, -7 * wave(t, 2.0, 0.6))
        p['Eye_R'] = (8 * wave(t, 1.0, 0.45), 0, 7 * wave(t, 2.0, 0.2))
        for name, t0 in (('L2', 0.30), ('R3', 1.30)):
            u = (t - t0) / 0.28
            if 0 <= u <= 1:
                p['legs'][name] = ('ik', (0, -0.03 * math.sin(math.pi * u), 0.06 * math.sin(math.pi * u)), None)
        return p

    clips.append(Clip('Idle', 2.0, loop=True, fn=idle, shots=[0, 0.4, 0.8, 0.9, 1.4, 1.8]))

    # ---------------------------------------------------------- Move: an alternating-tetrapod scuttle, claws held up
    T = 12 / 30.0
    S = 0.56
    duty = 0.55

    def move(t):
        u = t / T
        legs = {}
        for name in all_legs:
            ph = 0.0 if name in GROUP_A else 0.5
            fwd, up, mode, s = C.gait_foot(u - ph, duty, S, 0.08)
            legs[name] = ('ik', (0.0, -fwd, up), None)
        c2 = math.cos(4 * math.pi * u)
        s1 = math.sin(2 * math.pi * u)
        p = {'legs': legs, 'Root.loc': (0.010 * s1, 0.0, 0.012 - 0.009 * c2)}
        p['Body'] = (-2 + 1.0 * c2, 3 * s1, 2 * s1)
        p.update(sym({'Claw_Arm_L': (12 + 2 * c2, 0, 2), 'Claw_Fore_L': (-4, 0, 0), 'Claw_Hand_L': (6, 0, 0),
                      'Claw_Finger_L': (-6, 0, 0), 'Eye_L': (-12 + 3 * c2, 0, 0)}))
        return p

    clips.append(Clip('Move', T, loop=True, fn=move, speed=S / T, shots=[i / 30 for i in (0, 2, 4, 6, 8, 10)]))

    # ---------------------------------------------------------- Attack1 (Pinch): rear, crusher cocked open, lunge, snap, shake
    k1 = step(N0, J({'Root.loc': (0, 0.06, 0.05), 'Body': (12, 0, -10)},
                    sym({'Eye_L': (-15, 0, 0)}),
                    {'Claw_Arm_L': (30, 0, 28), 'Claw_Fore_L': (-8, 0, 0), 'Claw_Hand_L': (18, 0, 0), 'Claw_Finger_L': (40, 0, 0),
                     'Claw_Arm_R': (12, 0, -6), 'Claw_Fore_R': (-4, 0, 0), 'Claw_Hand_R': (6, 0, 0), 'Claw_Finger_R': (6, 0, 0)}),
              legs={'L1': ('ik', (0.0, 0.03, 0.0), None), 'R1': ('ik', (0.0, 0.02, 0.0), None)})
    lunge = {'L1': ('ik', (0.0, -0.12, 0.0), None), 'R1': ('ik', (0.0, -0.10, 0.0), None),
             'L2': ('ik', (0.0, -0.07, 0.0), None), 'R2': ('ik', (0.0, -0.06, 0.0), None)}
    k2 = step(k1, {'Root.loc': (0, -0.13, -0.01), 'Body': (-4, 0, 8), 'Claw_Arm_L': (4, 0, -6), 'Claw_Fore_L': (6, 0, -4),
                   'Claw_Hand_L': (-4, 0, 0), 'Claw_Finger_L': (FINGER_SHUT, 0, 0), 'Eye_L': (-6, 0, 0), 'Eye_R': (-6, 0, 0)},
              legs=lunge)
    k3 = step(k2, {'Body': (-4, 5, 12), 'Claw_Arm_L': (8, 0, -2), 'Claw_Finger_L': (FINGER_SHUT - 2, 0, 0)})
    k4 = step(k2, {'Body': (-4, -4, 3), 'Claw_Arm_L': (2, 0, -10)})
    keys = [(0.0, N0, None), (0.26, k1, 'smooth'), (0.40, k2, 'in'), (0.52, k3, 'out'), (0.64, k4, 'smooth'),
            (28 / 30.0, N0, 'smooth')]
    clips.append(Clip('Attack1', 28 / 30.0, keys=keys, events={'hit': 0.40}, shots=[0, 0.26, 0.4, 0.52, 0.64, 28 / 30.0]))

    # ---------------------------------------------------------- Attack2 (Tide Shell): rise, claws high, clack, low guard
    a1 = step(N0, J({'Root.loc': (0, 0.02, 0.08), 'Body': (12, 0, 0)},
                    sym({'Claw_Arm_L': (50, 0, 30), 'Claw_Fore_L': (-18, 0, 8), 'Claw_Hand_L': (24, 0, 0),
                         'Claw_Finger_L': (34, 0, 0), 'Eye_L': (-18, 0, -8)})))
    a2 = step(a1, J({'Root.loc': (0, 0.02, 0.10), 'Body': (15, 0, 0)},
                    sym({'Claw_Arm_L': (58, 0, 34), 'Claw_Finger_L': (FINGER_SHUT, 0, 0)})))
    a3 = step(N0, J({'Root.loc': (0, 0.03, -0.06), 'Body': (-5, 0, 0)},
                    sym({'Claw_Arm_L': (8, 0, -20), 'Claw_Fore_L': (2, 0, -12), 'Claw_Hand_L': (-6, 0, 0),
                         'Claw_Finger_L': (FINGER_SHUT, 0, 0), 'Eye_L': (30, 0, -35)})))
    keys = [(0.0, N0, None), (0.32, a1, 'smooth'), (0.50, a2, 'in'), (0.74, a3, 'out'), (0.92, a3, 'smooth'),
            (1.20, N0, 'smooth')]
    clips.append(Clip('Attack2', 1.20, keys=keys, events={'release': 0.50}, shots=[0, 0.32, 0.5, 0.74, 0.92, 1.2]))

    # ---------------------------------------------------------- Hit: knocked back, claws flung up, eye stalks tucked
    splay = {n: ('ik', (0.03 if n[0] == 'L' else -0.03, 0.03, 0.0), None, 'slide') for n in all_legs}
    h1 = step(N0, J({'Root.loc': (0, 0.07, 0.03), 'Body': (12, -6, 0)},
                    sym({'Claw_Arm_L': (24, 0, 14), 'Claw_Finger_L': (26, 0, 0), 'Claw_Hand_L': (12, 0, 0),
                         'Eye_L': (40, 0, -30)})), legs=splay)
    h2 = step(h1, J({'Root.loc': (0, 0.03, 0.0), 'Body': (4, -2, 0)},
                    sym({'Claw_Arm_L': (10, 0, 6), 'Claw_Finger_L': (10, 0, 0), 'Eye_L': (20, 0, -15)})))
    keys = [(0.0, N0, None), (0.07, h1, 'out'), (0.22, h2, 'smooth'), (0.50, N0, 'smooth')]
    clips.append(Clip('Hit', 0.50, keys=keys, shots=[0, 0.07, 0.15, 0.22, 0.35, 0.5]))

    # ---------------------------------------------------------- Death: legs give way and splay, it drops, claws limp
    out = {}
    for l in rig.legs:
        s = 1 if l.name[0] == 'L' else -1
        i = int(l.name[1])
        th = [d[1] for d in LEG_DEF if d[0] == i][0]
        t_ = math.radians(th)
        out[l.name] = Vector((s * math.sin(t_), -math.cos(t_), 0.0))
    d1 = step(N0, J({'Root.loc': (0, 0.05, 0.03), 'Body': (10, 0, 0)},
                    sym({'Claw_Arm_L': (20, 0, 12), 'Claw_Finger_L': (24, 0, 0), 'Eye_L': (25, 0, -10)})))
    wob = {n: ('ik', tuple(out[n] * 0.05), None, 'slide') for n in all_legs}
    d2 = step(d1, J({'Root.loc': (0.03, 0.03, -0.06), 'Body': (2, -6, 4)},
                    sym({'Claw_Arm_L': (-2, 0, 10), 'Claw_Finger_L': (18, 0, 0), 'Eye_L': (40, 0, -20)})), legs=wob)
    flat = {n: ('ik', tuple(out[n] * 0.10), None, 'slide') for n in all_legs}
    d3 = step(d2, J({'Root.loc': (0.0, 0.0, -0.28), 'Body': (0.5, 0, 3)},
                    sym({'Claw_Arm_L': (-8, 0, 34), 'Claw_Fore_L': (0, 0, 14), 'Claw_Hand_L': (0, 35, 0),
                         'Claw_Finger_L': (26, 0, 0), 'Eye_L': (75, 0, -45)})), legs=flat)
    d3 = M.ground(d3, mask=shell, keep_x=False, lift=0.004)     # the shell rests on the floor (a level body keeps the legs clear)
    d3 = clear_claws(d3)
    d4 = step(d3, {'Root.loc': tuple(Vector(d3['Root.loc']) + Vector((0, 0, 0.018)))})
    tw = dict(flat)
    tw['L2'] = ('ik', tuple(out['L2'] * 0.10 + Vector((0, 0, 0.06))), None)
    d5 = step(d3, {'Claw_Finger_R': (8, 0, 0)}, legs=tw)
    keys = [(0.0, N0, None), (0.10, d1, 'out'), (0.32, d2, 'smooth'), (0.58, d3, 'in'), (0.70, d4, 'out'),
            (0.82, d3, 'in'), (1.10, d5, 'smooth'), (1.35, d3, 'smooth'), (1.60, d3, 'smooth')]
    clips.append(Clip('Death', 1.60, keys=keys, events={'down': 0.58}, shots=[0, 0.1, 0.32, 0.58, 1.1, 1.6]))
    return clips


# ====================================================================== variants
def variants():
    return [
        dict(id='pet-brine-crab', name='Brine Crab (pet)', scale=0.5, parts=['crab_pearl'], shapes={}, clipSpeed=1.25,
             role='pet', pet='brine-crab', palette=C.content_palette('brine-crab', pet=True), slots={},
             clipMap={'Pinch': 'Attack1', 'TideShell': 'Attack2'}),
    ]


# ====================================================================== main
def main():
    C.log('build_crab: quick=%s' % QUICK)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = C.FPS
    M = P.PetBase(BASE, quick=QUICK)
    M.view = dict(az=40.0, el=22.0)
    M.card_view = dict(az=35.0, el=24.0)
    M.lineup_yaw = -35.0
    M.fight = dict(girth=1.0, count=1)
    M.rig = CRig('Rig', bone_table(), legs=legs(), loc_bones=('Root',))
    body, parts = build_geometry(M.rig)
    M.body = body
    M.parts = parts
    M.variants = variants()
    co = C.evaluated_coords(body)
    lo, hi = co.min(0), co.max(0)
    C.log('crab_body: %d tris, %d verts; rest bounds x %.3f..%.3f y %.3f..%.3f z %.3f..%.3f' % (
        body['tris'], len(body.data.vertices), lo[0], hi[0], lo[1], hi[1], lo[2], hi[2]))
    for nm, ob in parts.items():
        cp = C.evaluated_coords(ob)
        C.log('%s: %d tris; top %.3f' % (nm, ob['tris'], cp[:, 2].max()))
    for v in M.variants:
        C.log('variant %-16s x%.2f  %d tris  palette %s' % (v['id'], v['scale'], M.tris_of(v), v['palette']))
    M.clips = author(M.rig, M)
    M.bake_clips()
    M.check_clips()
    M.lines.append('')
    M.lines.append('- location keys on: %s' % ', '.join(M.location_channels()))
    M.lines.append('- crab_body %d tris; parts %s' % (body['tris'], ', '.join('%s %d' % (n, o['tris']) for n, o in parts.items())))
    for v in M.variants:
        M.lines.append('- %s: x%.2f, %d tris' % (v['id'], v['scale'], M.tris_of(v)))
    if not ARGS.get('no_renders'):
        st = M.stage()
        made = []
        made += M.render_strips(st, only=ONLY)
        if not ONLY:
            made += M.render_cards(st)
            made += M.render_lineup(st)
            made += M.render_fight(st)
        M.finish_renders()
        for p in made:
            C.log('render', os.path.relpath(p, C.REPO))
    M.write_lines()
    if not ARGS.get('no_export'):
        path, kb = M.export()
        M.write_tables()
        C.log('crab.glb %.1f KB' % kb)
        C.save_blend(os.path.join(C.BUILD, 'monsters_crab.blend'))
        lines = M.reimport(path)
        for line in lines:
            C.log(line)
        M.write_lines(['', '## re-import', ''] + lines)
    else:
        C.save_blend(os.path.join(C.BUILD, 'monsters_crab.blend'))


if __name__ == '__main__':
    main()

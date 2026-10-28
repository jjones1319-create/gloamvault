"""build_spider.py — the spider base (06 §3.5): Cellar Spider, Cellar Weaver, Broodmother, Tomb Spider, Spiderling pet.

Run:  blender -b -P tools/blender/monsters/build_spider.py -- [--quick] [--no-renders] [--no-export] [--only Idle,Move]

A flat, long-legged cellar spider 0.8 m across (scale 1 = the Cellar Spider): a low cephalothorax with a raised eye
mound carrying an oversized eight-eye cluster, chunky fangs and palps, an abdomen with a pale central stripe and
chevrons, and eight legs whose knees ride high above the body, banded at every joint. Rig (41 bones): Root · Body ·
Abdomen · Fang_L/R · Palp1/2_L/R · per leg (1–4, L/R) Coxa / Femur / Tibia / Tarsus; each leg is a yawing coxa and a
two-bone IK (knee up) with the tarsus slanted to the floor.

Variants (manifest.json): var_abdomen (the Cellar Weaver's long, swollen abdomen); var_abdomen 0.6 + spider_eggsac (the
Broodmother's lit egg sac); spider_plates (the Tomb Spider's bone plates and skull pattern); var_baby (the Spiderling:
big eyes, round body). Clips: Idle, Move (alternating-tetrapod scuttle), Attack1 (rear and fang strike), Attack2 (leap
and pin), Hit, Death (legs curl, flips onto its back).

Outputs: client/public/models/monsters/spider.glb, the `spider` key of clips.json, the spider entries of manifest.json,
art/renders/monsters/spider/*.png, art/build/monsters_spider.blend, art/build/monsters_spider_checks.txt.
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
from creature_lib import (ACCENT, BONE, GLOW, INK, MAIN, SECOND, CRig, Clip, Geo, Leg, ball, capsule, ellipsoid,  # noqa: E402
                          step, wave)

ARGS = C.args()
QUICK = bool(ARGS.get('quick'))
ONLY = set(ARGS['only'].split(',')) if isinstance(ARGS.get('only'), str) else None
BASE = 'spider'
BUDGET = 3000          # the Cellar Spider's visual.triBudget
RES = 0.004

UP = (0, 0, 1)
FWD = (0, -1, 0)
CEPH = Vector((0, -0.045, 0.125))
ABD = Vector((0, 0.15, 0.155))
LEG_DEF = [(1, 36.0, 1.00), (2, 70.0, 0.93), (3, 108.0, 0.87), (4, 146.0, 1.0)]   # leg, yaw from forward, length
BODY_BONES = ('Body', 'Abdomen')


def sd(name, s):
    return name + ('_L' if s > 0 else '_R')


def leg_name(i, part, s):
    return 'Leg%d_%s%s' % (i, part, '_L' if s > 0 else '_R')


def leg_points(i, theta, k, s):
    t = math.radians(theta)
    d = Vector((s * math.sin(t), -math.cos(t), 0.0))
    base = CEPH + Vector((s * 0.052 * math.sin(t), -0.062 * math.cos(t), -0.004))
    p1 = base + d * (0.03 * k) + Vector((0, 0, 0.01))
    p2 = p1 + d * (0.12 * k) + Vector((0, 0, 0.115 * k))
    p3 = p2 + d * (0.13 * k) + Vector((0, 0, -0.14 * k))
    p4 = p3 + d * (0.055 * k)
    p4.z = 0.004
    return base, p1, p2, p3, p4, d


def bone_table():
    b = [
        ('Root', None, (0, 0, 0), (0, -0.10, 0), UP),
        ('Body', 'Root', (0, 0.03, 0.13), (0, -0.11, 0.13), UP),
        ('Abdomen', 'Body', (0, 0.04, 0.14), (0, 0.28, 0.16), UP),
    ]
    for s in (1, -1):
        b += [
            (sd('Fang', s), 'Body', (s * 0.022, -0.112, 0.118), (s * 0.018, -0.15, 0.07), FWD),
            (sd('Palp1', s), 'Body', (s * 0.035, -0.10, 0.12), (s * 0.06, -0.165, 0.125), UP),
            (sd('Palp2', s), sd('Palp1', s), (s * 0.06, -0.165, 0.125), (s * 0.07, -0.20, 0.07), UP),
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
def body_elements(abdomen=0.0, baby=0.0):
    a = abdomen
    el = [
        ellipsoid(tuple(CEPH), (0.064 * (1 + 0.12 * baby), 0.076 * (1 + 0.08 * baby), 0.042 * (1 + 0.2 * baby)), bone='Body',
                  tag='ceph'),
        ellipsoid((0, -0.096, 0.146 + 0.01 * baby), (0.036 * (1 + 0.3 * baby), 0.03 * (1 + 0.3 * baby), 0.03 * (1 + 0.3 * baby)),
                  bone='Body', tag='mound'),
        ball((0, 0.035, 0.132), 0.022, bone={'Body': 0.5, 'Abdomen': 0.5}, tag='pedicel'),
        ellipsoid((0, ABD.y + 0.045 * a, ABD.z + 0.02 * a),
                  (0.086 * (1 + 0.18 * a + 0.1 * baby), 0.115 * (1 + 0.38 * a - 0.1 * baby), 0.07 * (1 + 0.4 * a + 0.18 * baby)),
                  bone='Abdomen', tag='abdomen'),
        ball((0, 0.262 + 0.07 * a, 0.148 + 0.01 * a), 0.026, bone='Abdomen', tag='spinnerets'),
        ellipsoid((0.021, -0.113, 0.104), (0.019, 0.021, 0.03), bone='Fang_L',
                  rot=Matrix.Rotation(math.radians(-20), 3, 'X').to_quaternion(), tag='chelicera_L'),
    ]
    for s in (1,):
        for i, th, k in LEG_DEF:
            base, p1, p2, p3, p4, d = leg_points(i, th, k, s)
            el.append(ball(tuple(base + d * 0.012), 0.024, bone={leg_name(i, 'Coxa', s): 0.5, 'Body': 0.5}, tag='coxa%d_L' % i))
    return C.with_mirror(el)


def abdomen_pattern(c, n, el_abd):
    """The folium: a pale central stripe and chevrons on the abdomen's back (slot 1)."""
    x = c[0]
    y = c[1] - el_abd.co.y
    if n[2] < 0.25:
        return False
    if abs(x) < 0.02 and y < 0.02:
        return True
    w = el_abd.size[0] * C.kvis(el_abd.s)
    if abs(x) < 0.8 * w and y > -0.02:
        q = (y - 0.7 * abs(x) + 0.2) % 0.064
        return q < 0.026
    return False


def build_geometry(rig):
    body_el = body_elements()
    abd_el = body_elements(abdomen=1.0)
    baby_el = body_elements(baby=1.0)
    abd_main = [e for e in body_el if e.tag == 'abdomen'][0]
    att = Geo()
    # the eye cluster: two big front eyes, two front-laterals, four on top — oversized so the cluster reads
    eyes = [((0.013, -0.127, 0.158), 0.016), ((0.034, -0.118, 0.148), 0.011), ((0.017, -0.107, 0.178), 0.010),
            ((0.036, -0.100, 0.166), 0.009)]
    for (x, y, z), r in eyes:
        for s in (1, -1):
            c = Vector((s * x, y, z))
            d = (c - Vector((0, -0.08, 0.13))).normalized()
            p = C.surface_point(body_el, (s * x * 0.3, y + 0.03, 0.14), tuple(d), reach=0.15)
            cc = p - d * (0.3 * r)
            V, F, N = C.uv_sphere(tuple(cc), r, rings=4, segs=6, rot=d.to_track_quat('Z', 'Y'))
            big = np.array(cc) + (V - np.array(cc)) * 1.65
            pb = C.surface_point(baby_el, (s * x * 0.3, y + 0.03, 0.14 + 0.01), tuple(d), reach=0.15) - d * (0.3 * r * 1.65)
            big = big + (np.array(pb) - np.array(cc))
            att.add(V, F, ACCENT, N, {'Body': 1.0}, name='eye', keys={'var_baby': big - V})
    # fangs: curved, out of the chelicerae
    for s in (1, -1):
        pts = [(s * 0.021, -0.128, 0.092), (s * 0.019, -0.142, 0.072), (s * 0.012, -0.146, 0.052)]
        V, F, N, _ = C.tube(pts, [0.0085, 0.006, 0.0], sides=5, cap0='flat', cap1='point', up=(0, -1, 0))
        att.add(V, F, BONE, N, {sd('Fang', s): 1.0}, name='fang')
    # palps: two short segments
    for s in (1, -1):
        h1, t1 = rig.head[sd('Palp1', s)], rig.tail[sd('Palp1', s)]
        t2 = rig.tail[sd('Palp2', s)]
        pts = [h1, (h1 + t1) / 2, t1, (t1 + t2) / 2, t2]
        V, F, N, _ = C.tube(pts, [0.011, 0.011, 0.012, 0.011, 0.008], sides=5, cap0='flat', cap1='point')
        att.add(V, F, MAIN, N, C.chain_weights(rig, V, [sd('Palp1', s), sd('Palp2', s)], 'Body'), name='palp')
    # legs: tubes along the chain, banded at the joints (slot 1)
    for s in (1, -1):
        for i, th, k in LEG_DEF:
            base, p1, p2, p3, p4, d = leg_points(i, th, k, s)
            chain = [leg_name(i, p, s) for p in ('Coxa', 'Femur', 'Tibia', 'Tarsus')]
            ctrl = [base, p1, p2, p3, p4]
            pts = []
            rad = []
            band = []
            radii = [0.020, 0.021, 0.019, 0.016, 0.0]
            for j in range(4):
                a, b = Vector(ctrl[j]), Vector(ctrl[j + 1])
                nseg = 1 if j == 0 else (2 if j == 3 else 3)
                for q in range(nseg):
                    u = q / nseg
                    pts.append(a.lerp(b, u))
                    r0, r1 = radii[j], radii[j + 1] if j < 3 else 0.006
                    r = r0 + (r1 - r0) * u
                    if q == 0 and j > 0:
                        r *= 1.18                      # a knuckle at each joint
                    rad.append(r * k ** 0.5)
                    band.append(q == 0 and j > 0)
            pts.append(Vector(p4))
            rad.append(0.0)
            band.append(False)
            V, F, N, ring = C.tube(pts, rad, sides=7, cap0='flat', cap1='point', up=(0, 0, 1))
            slots = []
            for f in F:
                rs = [ring[v] for v in f]
                r0 = min(rs)
                slots.append(INK if (r0 > 0 and band[r0] and max(rs) == r0 + 1) else MAIN)
            W = C.chain_weights(rig, V, chain, 'Body', blend=0.3)
            att.add(V, F, slots, N, W, name='leg')
    body_tris = BUDGET - att.tris() - 30
    # ---------------------------------------------------------------- the implicit body
    V, F, N = C.implicit_mesh(body_el, RES, body_tris, name='spider_mb_body')
    W = C.field_weights(V, body_el, power=2.0)
    dom = C.dominant(np.array([V[list(f)].mean(0) for f in F]), body_el)
    FN = C.face_normals(V, F)
    slots = []
    for k, f in enumerate(F):
        c = V[list(f)].mean(0)
        e = body_el[dom[k]]
        sl = e.slot
        if e.tag == 'abdomen' and abdomen_pattern(c, FN[k], abd_main):
            sl = SECOND
        if e.tag in ('ceph', 'mound') and abs(c[0]) < 0.011 and FN[k][2] > 0.5:
            sl = SECOND
        slots.append(sl)
    Va = C.project(V, abd_el)
    Vb = C.project(V, baby_el)
    geo = Geo()
    geo.add(V, F, slots, N, W, name='body', keys={'var_abdomen': Va - V, 'var_baby': Vb - V})
    body_V, body_W = V, W
    Vx, Nx = att.arrays()
    for nm, off, n in att.pieces:
        fs = [tuple(i - off for i in f) for f in att.F if off <= f[0] < off + n]
        ss = [s for f, s in zip(att.F, att.S) if off <= f[0] < off + n]
        keys = {k: d[off] for k, d in att.keys.items() if off in d}
        geo.add(Vx[off:off + n], fs, ss, Nx[off:off + n], att.W[off:off + n], name=nm, keys=keys)
    body = C.make_object(geo, 'spider_body', rig.ob, key_names=['var_abdomen', 'var_baby'])
    body['kind'] = 'body'
    body['base'] = BASE
    parts = {
        'spider_eggsac': build_eggsac(rig, body_V, body_W, Va - V),
        'spider_plates': build_plates(rig, body_el, V, F, body_W, FN, dom),
    }
    for nm, ob in parts.items():
        ob['kind'] = 'part'
        ob['base'] = BASE
        ob['part'] = nm
    return body, parts


def build_eggsac(rig, bV, bW, Da):
    """The Broodmother's egg sac: a lumpy, lit cluster slung under the rear of the abdomen (follows var_abdomen)."""
    g = Geo()
    c0 = Vector((0, 0.24, 0.085))
    rng = np.random.default_rng(7)
    el = [ellipsoid(tuple(c0), (0.075, 0.085, 0.065), bone='Abdomen', tag='sac')]
    for _ in range(14):
        d = Vector(rng.normal(size=3)).normalized()
        d.z = abs(d.z) * 0.4 - 0.3
        el.append(ball(tuple(c0 + Vector((d.x * 0.065, d.y * 0.075, d.z * 0.05))), 0.03 + 0.008 * rng.random(), bone='Abdomen'))
    V, F, N = C.implicit_mesh(el, 0.004, 700, name='spider_mb_sac')
    keys = {'var_abdomen': C.deltas_from(V, bV, Da)}
    g.add(V, F, GLOW, N, {'Abdomen': 1.0}, name='sac', keys=keys)
    # silk threads binding it to the abdomen
    for x in (-0.05, 0.0, 0.05):
        pts = [(x, 0.17, 0.115), (x * 1.3, 0.23, 0.14), (x * 1.1, 0.30, 0.10)]
        Vt, Ft, Nt, _ = C.tube(pts, [0.006, 0.007, 0.006], sides=4, cap0='point', cap1='point')
        g.add(Vt, Ft, SECOND, Nt, {'Abdomen': 1.0}, name='silk', keys={'var_abdomen': C.deltas_from(Vt, bV, Da)})
    return C.make_object(g, 'spider_eggsac', rig.ob, key_names=['var_abdomen'])


def build_plates(rig, el, V, F, W, FN, dom):
    """The Tomb Spider's bone plates (a carapace shield and three abdominal plates) and the skull on the hindmost."""
    g = Geo()
    abd = [e for e in el if e.tag == 'abdomen'][0]
    Nf = C.field_normals(V, el)
    groups = {'carapace': [], 'p0': [], 'p1': [], 'p2': []}
    for k, f in enumerate(F):
        c = V[list(f)].mean(0)
        tag = el[dom[k]].tag
        if FN[k][2] < 0.35:
            continue
        if tag in ('ceph',) and c[1] > -0.095:
            groups['carapace'].append(f)
        elif tag == 'abdomen':
            y = c[1] - abd.co.y
            if -0.075 < y < -0.025:
                groups['p0'].append(f)
            elif -0.015 < y < 0.035:
                groups['p1'].append(f)
            elif 0.045 < y < 0.11:
                groups['p2'].append(f)
    for nm, fs in groups.items():
        used = sorted({i for f in fs for i in f})
        if not used:
            continue
        remap = {v: k for k, v in enumerate(used)}
        lift = 0.009
        Vs = V[used] + Nf[used] * lift
        Fs = [tuple(remap[i] for i in f) for f in fs]
        g.add(Vs, Fs, BONE, Nf[used], [W[i] for i in used], name=nm)
    # the skull pattern on the hindmost plate: two sockets and a row of teeth (ink on bone)
    for s in (1, -1):
        p = C.surface_point(el, (s * 0.032, abd.co.y - 0.025, abd.co.z), (s * 0.3, -0.05, 1.0), reach=0.2)
        n = Vector(C.field_normals(np.array([p]), el)[0])
        Vk, Fk, Nk = C.uv_sphere(tuple(p + n * 0.013), (0.028, 0.025, 0.006), rings=4, segs=8, rot=n.to_track_quat('Z', 'Y'))
        g.add(Vk, Fk, INK, Nk, {'Abdomen': 1.0}, name='socket')
    p = C.surface_point(el, (0, abd.co.y + 0.02, abd.co.z), (0, 0.1, 1.0), reach=0.2)
    n = Vector(C.field_normals(np.array([p]), el)[0])
    Vk, Fk, Nk = C.uv_sphere(tuple(p + n * 0.013), (0.011, 0.013, 0.005), rings=3, segs=5, rot=n.to_track_quat('Z', 'Y'))
    g.add(Vk, Fk, INK, Nk, {'Abdomen': 1.0}, name='nose')
    p = C.surface_point(el, (0, abd.co.y + 0.06, abd.co.z), (0, 0.35, 1.0), reach=0.2)
    n = Vector(C.field_normals(np.array([p]), el)[0])
    for x in (-0.021, -0.007, 0.007, 0.021):
        Vk, Fk, Nk = C.uv_sphere(tuple(p + Vector((x * 1.2, 0, 0)) + n * 0.013), (0.006, 0.011, 0.004), rings=3, segs=5,
                                 rot=n.to_track_quat('Z', 'Y'))
        g.add(Vk, Fk, INK, Nk, {'Abdomen': 1.0}, name='tooth')
    return C.make_object(g, 'spider_plates', rig.ob)


# ====================================================================== clips
GROUP_A = ('L1', 'R2', 'L3', 'R4')


def author(rig, M):
    clips = []
    N0 = {'legs': {}}
    body = M.vertex_mask(BODY_BONES)
    all_legs = [l.name for l in rig.legs]

    def palps(p, t, period, amp=10.0):
        for s, ph in (('L', 0.0), ('R', 0.5)):
            x0, y0, z0 = p.get('Palp1_' + s, (0, 0, 0))
            p['Palp1_' + s] = (x0 + amp * wave(t, period, ph), y0, z0)
            x0, y0, z0 = p.get('Palp2_' + s, (0, 0, 0))
            p['Palp2_' + s] = (x0 + amp * 0.6 * wave(t, period, ph + 0.25), y0, z0)
        return p

    # ---------------------------------------------------------- Idle: breathing abdomen, palps, a leg re-planted now and then
    def idle(t):
        br = wave(t, 1.0)
        p = {'legs': {}}
        p['Root.loc'] = (0.0, 0.0, 0.003 * br)
        p['Body'] = (1.5 * wave(t, 2.0, 0.2), 0, 2 * wave(t, 2.0))
        p['Abdomen'] = (2.5 * br, 0, 2 * wave(t, 2.0, 0.3))
        p['Fang_L'] = (6 * max(0, wave(t, 0.5)), 0, 0)
        p['Fang_R'] = (6 * max(0, wave(t, 0.5, 0.5)), 0, 0)
        # L1 and R3 lift and re-plant in turn (a nervous shift)
        for name, t0 in (('L1', 0.3), ('R3', 1.3)):
            u = (t - t0) / 0.3
            if 0 <= u <= 1:
                p['legs'][name] = ('ik', (0, -0.015 * math.sin(math.pi * u), 0.04 * math.sin(math.pi * u)), None)
        return palps(p, t, 1.0, amp=8.0)

    clips.append(Clip('Idle', 2.0, loop=True, fn=idle, shots=[0, 0.4, 0.8, 1.2, 1.6, 2.0]))

    # ---------------------------------------------------------- Move: an alternating-tetrapod scuttle
    T = 10 / 30.0
    S = 0.40
    duty = 0.55

    def move(t):
        u = t / T
        legs = {}
        for name in all_legs:
            ph = 0.0 if name in GROUP_A else 0.5
            fwd, up, mode, s = C.gait_foot(u - ph, duty, S, 0.06)
            legs[name] = ('ik', (0.0, -fwd, up), None)
        c2 = math.cos(4 * math.pi * u)
        s1 = math.sin(2 * math.pi * u)
        p = {'legs': legs, 'Root.loc': (0.0, 0.0, 0.006 - 0.005 * c2)}
        p['Body'] = (0, 2 * s1, 3 * s1)
        p['Abdomen'] = (-3 + 2 * c2, 0, -6 * s1)
        p['Fang_L'] = (4, 0, 0)
        p['Fang_R'] = (4, 0, 0)
        return palps(p, t, T, amp=14.0)

    clips.append(Clip('Move', T, loop=True, fn=move, speed=S / T, shots=[i / 30 for i in (0, 2, 4, 5, 7, 9)]))

    # ---------------------------------------------------------- Attack1: rear, fangs wide, strike down
    raise_f = {'L1': ('ik', (0.02, -0.06, 0.20), None), 'R1': ('ik', (-0.02, -0.06, 0.20), None),
               'L2': ('ik', (0.0, -0.02, 0.06), None), 'R2': ('ik', (0.0, -0.02, 0.06), None)}
    k1 = step(N0, {'Root.loc': (0, 0.05, 0.03), 'Body': (24, 0, 0), 'Abdomen': (16, 0, 0), 'Fang_L': (-25, 0, -18),
                   'Fang_R': (-25, 0, 18), 'Palp1_L': (30, 0, 0), 'Palp1_R': (30, 0, 0)}, legs=raise_f)
    strike_f = {'L1': ('ik', (0.0, -0.13, 0.0), None), 'R1': ('ik', (0.0, -0.13, 0.0), None),
                'L2': ('ik', (0.0, -0.06, 0.0), None), 'R2': ('ik', (0.0, -0.06, 0.0), None)}
    k2 = step(k1, {'Root.loc': (0, -0.10, -0.02), 'Body': (-14, 0, 0), 'Abdomen': (-8, 0, 0), 'Fang_L': (30, 0, 6),
                   'Fang_R': (30, 0, -6), 'Palp1_L': (25, 0, 0), 'Palp1_R': (25, 0, 0)}, legs=strike_f)
    k3 = step(k2, {'Body': (-10, 0, 0), 'Fang_L': (20, 0, 0), 'Fang_R': (20, 0, 0)})
    keys = [(0.0, N0, None), (0.30, k1, 'smooth'), (0.42, k2, 'in'), (0.55, k3, 'out'), (0.85, N0, 'smooth')]
    clips.append(Clip('Attack1', 0.85, keys=keys, events={'hit': 0.42}, shots=[0, 0.3, 0.42, 0.55, 0.7, 0.85]))

    # ---------------------------------------------------------- Attack2: crouch, leap forward, land legs-first and pin
    crouch = {n: ('ik', (0.0, 0.02, 0.0), None) for n in all_legs}
    a1 = step(N0, {'Root.loc': (0, 0.05, -0.05), 'Body': (6, 0, 0), 'Abdomen': (6, 0, 0)}, legs=crouch)
    fly = {}
    for n in all_legs:
        i = int(n[1])
        fly[n] = ('ik', (0.0, -0.30 - (0.06 if i <= 2 else -0.02), 0.10 if i <= 2 else 0.05), None)
    a2 = step(a1, {'Root.loc': (0, -0.30, 0.16), 'Body': (10, 0, 0), 'Abdomen': (4, 0, 0), 'Fang_L': (-20, 0, -15),
                   'Fang_R': (-20, 0, 15)}, legs=fly)
    land = {}
    for n in all_legs:
        i = int(n[1])
        land[n] = ('ik', (0.0, -0.42 if i <= 2 else -0.30, 0.0), None, 'slide')
    a3 = step(a2, {'Root.loc': (0, -0.36, -0.02), 'Body': (-12, 0, 0), 'Abdomen': (-6, 0, 0), 'Fang_L': (30, 0, 6),
                   'Fang_R': (30, 0, -6)}, legs=land)
    planted = {}
    for n in all_legs:
        i = int(n[1])
        planted[n] = ('ik', (0.0, -0.42 if i <= 2 else -0.30, 0.0), None)
    a4 = step(a3, {'Root.loc': (0, -0.36, 0.0), 'Body': (-4, 0, 0), 'Fang_L': (15, 0, 0), 'Fang_R': (15, 0, 0)}, legs=planted)
    back = {n: ('ik', (0.0, 0.0, 0.0), None) for n in all_legs}
    a5 = step(N0, {}, legs=back)
    keys = [(0.0, N0, None), (0.22, a1, 'smooth'), (0.40, a2, 'out'), (0.55, a3, 'in'), (0.70, a4, 'out'), (1.20, a5, 'smooth')]
    clips.append(Clip('Attack2', 1.20, keys=keys, events={'hit': 0.55}, shots=[0, 0.22, 0.4, 0.55, 0.8, 1.2]))

    # ---------------------------------------------------------- Hit: jolted back, legs splay, abdomen kicks up
    splay = {n: ('ik', (0.03 if n[0] == 'L' else -0.03, 0.03, 0.0), None, 'slide') for n in all_legs}
    h1 = step(N0, {'Root.loc': (0, 0.07, 0.03), 'Body': (16, 0, 6), 'Abdomen': (10, 0, -8), 'Fang_L': (-25, 0, -15),
                   'Fang_R': (-25, 0, 15), 'Palp1_L': (25, 0, 0), 'Palp1_R': (25, 0, 0)}, legs=splay)
    h2 = step(h1, {'Root.loc': (0, 0.03, 0.0), 'Body': (4, 0, 2), 'Abdomen': (2, 0, -2)})
    keys = [(0.0, N0, None), (0.07, h1, 'out'), (0.22, h2, 'smooth'), (0.50, N0, 'smooth')]
    clips.append(Clip('Hit', 0.50, keys=keys, shots=[0, 0.07, 0.15, 0.22, 0.35, 0.5]))

    # ---------------------------------------------------------- Death: legs crumple, it flips onto its back, legs curl
    curl = {}
    for s in (1, -1):
        for i, th, k in LEG_DEF:
            curl[leg_name(i, 'Coxa', s)] = (0, 0, 0)
            curl[leg_name(i, 'Femur', s)] = (-20, 0, 0)
            curl[leg_name(i, 'Tibia', s)] = (-50, 0, 0)
            curl[leg_name(i, 'Tarsus', s)] = (-30, 0, 0)
    tight = {}
    for s in (1, -1):
        for i, th, k in LEG_DEF:
            tight[leg_name(i, 'Coxa', s)] = (0, 0, 0)
            tight[leg_name(i, 'Femur', s)] = (-40, 0, 0)
            tight[leg_name(i, 'Tibia', s)] = (-60, 0, 0)
            tight[leg_name(i, 'Tarsus', s)] = (-40, 0, 0)

    def leg_states(angles):
        out = {}
        for l in rig.legs:
            out[l.name] = ('fk', {b: angles[b] for b in (l.yaw,) + l.ik + l.ends})
        return out

    d1 = step(N0, {'Root.loc': (0, 0.05, 0.03), 'Body': (18, 0, 0), 'Abdomen': (12, 0, 0), 'Fang_L': (-30, 0, -20),
                   'Fang_R': (-30, 0, 20)})
    d2 = step(d1, {'Root.loc': (0, 0.04, 0.20), 'Root': (0, 100, 0), 'Body': (0, 0, 0), 'Abdomen': (-6, 0, 0)},
              legs=leg_states(curl))
    d2 = M.ground(d2, keep_x=False, lift=0.12)
    d3 = step(d2, {'Root': (0, 180, 0), 'Body': (0, 0, 0), 'Abdomen': (6, 0, 0), 'Fang_L': (10, 0, 0), 'Fang_R': (10, 0, 0)},
              legs=leg_states(tight))
    d3 = M.ground(d3, mask=body)
    d4 = step(d3, {'Root': (0, 172, 0)})
    d4 = M.ground(d4, mask=body, lift=0.015)
    twitch = dict(tight)
    twitch['Leg2_Tibia_L'] = (-35, 0, 0)
    twitch['Leg3_Tibia_R'] = (-42, 0, 0)
    d5 = step(d3, {}, legs=leg_states(twitch))
    keys = [(0.0, N0, None), (0.10, d1, 'out'), (0.35, d2, 'in'), (0.58, d3, 'in'), (0.70, d4, 'out'), (0.82, d3, 'in'),
            (1.05, d5, 'smooth'), (1.30, d3, 'smooth'), (1.50, d3, 'smooth')]
    clips.append(Clip('Death', 1.50, keys=keys, events={'down': 0.58}, shots=[0, 0.1, 0.35, 0.58, 1.05, 1.5]))

    # ---------------------------------------------------------- Web (the Weaver's shot; the Tomb Spider's rear): abdomen up, a flick
    w1 = step(N0, {'Root.loc': (0, 0.03, 0.02), 'Body': (8, 0, 0), 'Abdomen': (38, 0, 0), 'Palp1_L': (20, 0, 0),
                   'Palp1_R': (20, 0, 0), 'Fang_L': (-15, 0, -10), 'Fang_R': (-15, 0, 10)})
    w2 = step(w1, {'Root.loc': (0, -0.03, 0.035), 'Body': (2, 0, 0), 'Abdomen': (56, 0, 0)})
    w3 = step(w1, {'Abdomen': (28, 0, 0)})
    keys = [(0.0, N0, None), (0.30, w1, 'smooth'), (0.42, w2, 'in'), (0.60, w3, 'out'), (1.0, N0, 'smooth')]
    clips.append(Clip('Web', 1.0, keys=keys, events={'release': 0.42}, shots=[0, 0.3, 0.42, 0.6, 0.8, 1.0]))

    # ---------------------------------------------------------- Brood (the Broodmother's call and pulse): the abdomen pumps, then heaves
    b1 = step(N0, {'Root.loc': (0, 0, 0.02), 'Body': (4, 0, 0), 'Abdomen': (14, 0, 0)})
    b2 = step(N0, {'Root.loc': (0, 0, -0.01), 'Abdomen': (-4, 0, 0)})
    b3 = step(N0, {'Root.loc': (0, 0, 0.035), 'Body': (6, 0, 0), 'Abdomen': (24, 0, 0), 'Fang_L': (-20, 0, -12),
                   'Fang_R': (-20, 0, 12)})
    keys = [(0.0, N0, None), (0.2, b1, 'smooth'), (0.38, b2, 'smooth'), (0.56, b1, 'smooth'), (0.74, b2, 'smooth'),
            (0.92, b3, 'in'), (1.3, N0, 'smooth')]
    clips.append(Clip('Brood', 1.3, keys=keys, events={'release': 0.92}, shots=[0, 0.2, 0.38, 0.74, 0.92, 1.3]))
    return clips


# ====================================================================== variants
def variants():
    vs = [
        dict(id='cellar-spider', name='Cellar Spider', scale=1.0, parts=[], shapes={}, clipSpeed=1.0, role='fodder',
             palette=C.content_palette('cellar-spider'), clipMap={'Drop': 'Attack2'}),
        dict(id='cellar-weaver', name='Cellar Weaver', scale=1.4, parts=[], shapes={'var_abdomen': 1.0}, clipSpeed=0.9,
             role='special', palette=C.content_palette('cellar-weaver'), clipMap={'Drop': 'Attack2', 'Web': 'Web', 'Reel': 'Web'}),
        dict(id='broodmother', name='Broodmother', scale=3.0, parts=['spider_eggsac'], shapes={'var_abdomen': 0.6},
             clipSpeed=0.62, role='monster', glow='#e0a030', palette=C.content_palette('broodmother'),
             clipMap={'Drop': 'Attack2', 'Brood': 'Brood', 'Sweep': 'Attack2', 'Pulse': 'Brood'}),
        dict(id='tomb-spider', name='Tomb Spider', scale=2.4, parts=['spider_plates'], shapes={}, clipSpeed=0.7,
             role='special', palette=['#6f6f6a', '#e3dccb', '#f0a830'], clipMap={'Rear': 'Web', 'Shroud': 'Web', 'Cocoon': 'Attack1'}),
        dict(id='pet-spiderling', name='Spiderling (pet)', scale=0.3, parts=[], shapes={'var_baby': 1.0}, clipSpeed=1.5,
             role='pet', pet='spiderling', palette=C.content_palette('spiderling', pet=True)),
    ]
    return vs


# ====================================================================== main
def main():
    C.log('build_spider: quick=%s' % QUICK)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = C.FPS
    M = C.Monster(BASE, quick=QUICK)
    M.view = dict(az=38.0, el=28.0)
    M.card_view = dict(az=35.0, el=30.0)
    M.lineup_yaw = -40.0
    M.fight = dict(girth=0.8, count=3)
    M.rig = CRig('Rig', bone_table(), legs=legs(), loc_bones=('Root',))
    body, parts = build_geometry(M.rig)
    M.body = body
    M.parts = parts
    M.variants = variants()
    lo = C.evaluated_coords(body)[:, 2].min()
    C.log('spider_body: %d tris, %d verts; rest lowest point %.1f mm' % (body['tris'], len(body.data.vertices), lo * 1000))
    for nm, ob in parts.items():
        C.log('%s: %d tris' % (nm, ob['tris']))
    for v in M.variants:
        C.log('variant %-16s x%.2f  %d tris  palette %s' % (v['id'], v['scale'], M.tris_of(v), v['palette']))
    M.clips = author(M.rig, M)
    M.bake_clips()
    M.check_clips()
    M.lines.append('')
    M.lines.append('- spider_body %d tris; parts %s' % (body['tris'], ', '.join('%s %d' % (n, o['tris']) for n, o in parts.items())))
    for v in M.variants:
        M.lines.append('- %s: x%.2f, %d tris' % (v['id'], v['scale'], M.tris_of(v)))
    if not ARGS.get('no_renders'):
        st = M.stage()
        made = []
        made += M.render_strips(st, only=ONLY)
        if not ONLY:
            made += M.render_lineup(st)
            made += M.render_cards(st)
            made += M.render_fight(st)
        M.finish_renders()
        for p in made:
            C.log('render', os.path.relpath(p, C.REPO))
    M.write_lines()
    if not ARGS.get('no_export'):
        M.write_tables()
        path, kb = M.export()
        C.log('spider.glb %.1f KB' % kb)
        C.save_blend(os.path.join(C.BUILD, 'monsters_spider.blend'))
        from export import reimport_report
        for line in reimport_report(path):
            C.log(line)
    else:
        C.save_blend(os.path.join(C.BUILD, 'monsters_spider.blend'))


if __name__ == '__main__':
    main()

"""build_bat.py — the bat base (06 §3.5): the Grave Bat and the Crypt Bat pet.

Run:  blender -b -P tools/blender/monsters/build_bat.py -- [--quick] [--no-renders] [--no-export] [--only Idle,Move]

A grave bat with a 1.2 m span hovering at a hero's head height (scale 1): a furry body and a big head whose face is a
pale skull mask with deep-set red eyes and a jaw that drops on a red mouth and fangs; tall ears; wings that are thin
double-sided membranes stretched between pale finger bones, scalloped between the finger tips and run back to the
ankles; hind legs dangling with claws. Rig (23 bones): Root (on the floor) · Body (hovering) · Head · Jaw · Ear_L/R ·
Tail · per side Wing_Upper / Wing_Lower / Wing_F2..F5 and Leg / Foot. Wings: +X on any wing bone lifts it, +Z sweeps
the left wing back (the right wing forward: mirrored poses negate Y and Z).

Variants (manifest.json): the Grave Bat; the Crypt Bat pet (x0.6, var_round_ears). Clips: Idle (hover), Move (forward
flight), Attack1 (dive bite), Attack2 (shriek: wings flung wide, mouth open — `release`), Hit, Death (crumples and
falls — `down` when it hits the floor).

Outputs: client/public/models/monsters/bat.glb, the `bat` key of clips.json, the bat entries of manifest.json,
art/renders/monsters/bat/*.png, art/build/monsters_bat.blend, art/build/monsters_bat_checks.txt.
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
from creature_lib import (ACCENT, BONE, INK, MAIN, SECOND, CRig, Clip, Geo, ball, capsule, ellipsoid,  # noqa: E402
                          step, wave)

ARGS = C.args()
QUICK = bool(ARGS.get('quick'))
ONLY = set(ARGS['only'].split(',')) if isinstance(ARGS.get('only'), str) else None
BASE = 'bat'
BUDGET = 2000          # the Grave Bat (06 §3.2)
RES = 0.0035
H = 1.25               # hover height of the body (m, at scale 1)

UP = (0, 0, 1)
FWD = (0, -1, 0)
BODY_C = Vector((0, 0.0, H))
HEAD_C = Vector((0, -0.105, H + 0.045))


def sd(name, s):
    return name + ('_L' if s > 0 else '_R')


def wing_points(s):
    """Shoulder, elbow, wrist and the four finger tips of one wing (left: s = 1), wings spread level."""
    S = Vector((s * 0.05, -0.03, H + 0.03))
    E = Vector((s * 0.17, -0.01, H + 0.05))
    W = Vector((s * 0.36, -0.07, H + 0.06))
    F2 = Vector((s * 0.52, -0.12, H + 0.06))
    F3 = Vector((s * 0.61, 0.02, H + 0.05))
    F4 = Vector((s * 0.48, 0.17, H + 0.035))
    F5 = Vector((s * 0.30, 0.235, H + 0.02))
    A = Vector((s * 0.07, 0.17, H - 0.07))        # the ankle, where the membrane ends
    Hp = Vector((s * 0.05, 0.08, H - 0.02))       # the hip on the body side
    return S, E, W, F2, F3, F4, F5, A, Hp


def bone_table():
    b = [
        ('Root', None, (0, 0, 0), (0, -0.10, 0), UP),
        ('Body', 'Root', (0, 0.07, H), (0, -0.05, H + 0.02), UP),
        ('Head', 'Body', (0, -0.05, H + 0.03), (0, -0.17, H + 0.04), UP),
        ('Jaw', 'Head', (0, -0.09, H + 0.005), (0, -0.165, H + 0.0), UP),
        ('Tail', 'Body', (0, 0.09, H - 0.01), (0, 0.18, H - 0.04), UP),
    ]
    for s in (1, -1):
        S, E, W, F2, F3, F4, F5, A, Hp = wing_points(s)
        b += [
            (sd('Ear', s), 'Head', (s * 0.035, -0.09, H + 0.09), (s * 0.06, -0.08, H + 0.18), FWD),
            (sd('Wing_Upper', s), 'Body', tuple(S), tuple(E), UP),
            (sd('Wing_Lower', s), sd('Wing_Upper', s), tuple(E), tuple(W), UP),
            (sd('Wing_F2', s), sd('Wing_Lower', s), tuple(W), tuple(F2), UP),
            (sd('Wing_F3', s), sd('Wing_Lower', s), tuple(W), tuple(F3), UP),
            (sd('Wing_F4', s), sd('Wing_Lower', s), tuple(W), tuple(F4), UP),
            (sd('Wing_F5', s), sd('Wing_Lower', s), tuple(W), tuple(F5), UP),
            (sd('Leg', s), 'Body', tuple(Hp), tuple(A), FWD),
            (sd('Foot', s), sd('Leg', s), tuple(A), tuple(A + Vector((0, 0.01, -0.05))), FWD),
        ]
    return b


# ====================================================================== body
def body_elements():
    el = [
        ellipsoid(tuple(BODY_C), (0.062, 0.095, 0.066), bone='Body', tag='torso'),
        ellipsoid((0, -0.045, H + 0.02), (0.07, 0.06, 0.062), bone='Body', tag='chest'),
        ellipsoid(tuple(HEAD_C), (0.064, 0.062, 0.058), bone='Head', tag='skull'),
        ellipsoid((0, -0.15, H + 0.03), (0.04, 0.03, 0.033), bone='Head', slot=SECOND, tag='face'),
        ellipsoid((0, -0.128, H + 0.068), (0.05, 0.024, 0.02), bone='Head', slot=SECOND, tag='brow'),
        ball((0.035, -0.135, H + 0.02), 0.026, bone='Head', slot=SECOND, tag='cheek_L'),
        ball((0.052, -0.03, H + 0.05), 0.026, bone={'Body': 0.6, 'Wing_Upper_L': 0.4}, tag='shoulder_L'),
    ]
    return C.with_mirror(el)


def jaw_elements():
    return [capsule((0, -0.10, H + 0.008), (0, -0.155, H + 0.002), 0.024, bone='Jaw', slot=SECOND, tag='jaw')]


def segment_weights(V, rig, bones, k=3, power=2.0):
    out = []
    for p in V:
        p = Vector(p)
        ds = []
        for b in bones:
            h, t = rig.head[b], rig.tail[b]
            d = t - h
            u = max(0.0, min(1.0, (p - h).dot(d) / d.length_squared))
            ds.append(((h + d * u - p).length, b))
        ds.sort()
        near = ds[:k]
        ws = [(1.0 / max(d, 0.004) ** power, b) for d, b in near]
        tot = sum(w for w, _ in ws)
        out.append({b: w / tot for w, b in ws})
    return out


def membrane(s, rig, thick=0.004):
    """One wing's membrane: the hand-wing (a fan from the wrist between the fingers, scalloped between the tips) and the
    arm-wing (a grid from the arm to the fifth finger, the ankle and the body side), as a thin closed slab."""
    S, E, W, F2, F3, F4, F5, A, Hp = wing_points(s)

    def scallop(a, b, k=0.16):
        m = (a + b) / 2
        return m + (W - m) * k

    # hand-wing spokes from the wrist
    tips = [F2, F3, scallop(F3, F4), F4, scallop(F4, F5), F5]
    rows = []
    for tp in tips:
        rows.append([W.lerp(tp, u) for u in (1 / 3, 2 / 3, 1.0)])
    pts = [W]
    grid = []
    for r in rows:
        idx = []
        for p in r:
            idx.append(len(pts))
            pts.append(p)
        grid.append(idx)
    F = []
    for i in range(len(rows) - 1):
        a, b = grid[i], grid[i + 1]
        F.append((0, a[0], b[0]))
        for j in range(2):
            F.append((a[j], a[j + 1], b[j + 1], b[j]))
    # arm-wing: leading edge S→E→W, trailing edge A→(scallop)→F5
    lead = [S, S.lerp(E, 0.5), E, E.lerp(W, 0.5), W]
    trail = [Hp, A, scallop(A, F5, 0.12), A.lerp(F5, 0.75), F5]
    trail[0] = Hp
    nv = 3
    agrid = []
    for i in range(5):
        idx = []
        for j in range(nv + 1):
            v = j / nv
            p = lead[i].lerp(trail[i], v)
            if i == 4 and j == 0:
                idx.append(0)                         # the wrist
                continue
            if i == 4 and j == nv:
                idx.append(grid[-1][-1])              # F5's tip
                continue
            if i == 4:
                idx.append(grid[-1][j - 1])           # along the fifth finger
                continue
            idx.append(len(pts))
            pts.append(p)
        agrid.append(idx)
    for i in range(4):
        a, b = agrid[i], agrid[i + 1]
        for j in range(nv):
            F.append((a[j], b[j], b[j + 1], a[j + 1]))
    P = np.array([tuple(p) for p in pts])
    # orient: faces up (+Z) on the top sheet
    FN = C.face_normals(P, F)
    if FN[:, 2].mean() < 0:
        F = [tuple(reversed(f)) for f in F]
    # the slab: top sheet up by thick/2, bottom sheet down, a rim along the boundary
    n = len(P)
    top = P + np.array((0, 0, thick / 2))
    bot = P - np.array((0, 0, thick / 2))
    V = np.concatenate([top, bot])
    Fs = list(F) + [tuple(reversed([i + n for i in f])) for f in F]
    edges = {}
    for f in F:
        for i in range(len(f)):
            a, b = f[i], f[(i + 1) % len(f)]
            key = (min(a, b), max(a, b))
            edges[key] = edges.get(key, 0) + 1
            edges.setdefault(('dir',) + key, (a, b))
    for key, cnt in list(edges.items()):
        if key[0] == 'dir' or cnt != 1:
            continue
        a, b = edges[('dir',) + key]
        Fs.append((b, a, a + n, b + n))
    Nv = C.vertex_normals(V, Fs)
    bones = [sd(x, s) for x in ('Wing_Upper', 'Wing_Lower', 'Wing_F2', 'Wing_F3', 'Wing_F4', 'Wing_F5', 'Leg')] + ['Body']
    Wt = segment_weights(V, rig, bones, k=2, power=2.0)
    return V, Fs, Nv, Wt


def build_geometry(rig):
    body_el = body_elements()
    att = Geo()
    # eyes: deep in the skull mask
    for s in (1, -1):
        r = 0.0145
        d = Vector((s * 0.55, -0.80, 0.22)).normalized()
        p = C.surface_point(body_el, (s * 0.01, -0.11, H + 0.05), tuple(d), reach=0.2)
        c = p - d * (0.25 * r)
        V, F, N = C.uv_sphere(tuple(c), r, rings=4, segs=6, rot=d.to_track_quat('Z', 'Y'))
        att.add(V, F, ACCENT, N, {'Head': 1.0}, name='eye')
        # a dark socket rim round each eye (the skull read)
        Vs, Fs, Ns = C.uv_sphere(tuple(c - d * 0.004), (r * 1.55, r * 1.55, r * 0.5), rings=4, segs=7,
                                 rot=d.to_track_quat('Z', 'Y'))
        att.add(Vs, Fs, INK, Ns, {'Head': 1.0}, name='socket')
    # ears: tall pointed leaves, round-tipped for the Crypt Bat (var_round_ears)
    for s in (1, -1):
        base = C.surface_point(body_el, (s * 0.02, -0.095, H + 0.06), (s * 0.45, 0.1, 1.0), reach=0.2)
        up = Vector((s * 0.35, 0.05, 1.0)).normalized()
        face = Vector((s * 0.35, -0.92, 0.0)).normalized()
        face = (face - up * face.dot(up)).normalized()
        side = up.cross(face)
        pts = [base - up * 0.01, base + up * 0.04, base + up * 0.085, base + up * 0.125]
        V, F, N, ring = C.tube(pts, [0.024, 0.026, 0.017, 0.0], sides=6, cap0='flat', cap1='point', up=tuple(face),
                               flat=[(0.35, 1.0)] * 4)
        Vr = np.array(V)
        # the pet's round ears: shorter, the tip widened and blunted
        d = Vr - np.array(base)
        hgt = d @ np.array(up)
        rnd = Vr - np.outer(np.clip(hgt - 0.06, 0, None) * 0.45, np.array(up))
        lat = (Vr - np.array(base)) @ np.array(side)
        rnd = rnd + np.outer(lat * np.clip((hgt - 0.03) / 0.06, 0, 1) * 0.6, np.array(side))
        slots = []
        for f in F:
            c = Vr[list(f)].mean(0)
            slots.append(INK if (c - np.array(base)) @ np.array(face) > 0.002 else MAIN)
        att.add(V, F, slots, N, {sd('Ear', s): 0.9, 'Head': 0.1}, name='ear', keys={'var_round_ears': rnd - Vr})
    # fangs: two long upper fangs, two small lower
    for s in (1, -1):
        V, F, N = C.cone((s * 0.016, -0.158, H + 0.012), (s * 0.015, -0.162, H - 0.018), 0.0058, sides=4)
        att.add(V, F, BONE, N, {'Head': 1.0}, name='fang')
        V, F, N = C.cone((s * 0.012, -0.148, H - 0.002), (s * 0.012, -0.153, H + 0.014), 0.004, sides=4)
        att.add(V, F, BONE, N, {'Jaw': 1.0}, name='fang')
    # finger bones (pale) over the membranes, the thumb claws
    for s in (1, -1):
        S, E, W, F2, F3, F4, F5, A, Hp = wing_points(s)
        for bone, a, b, r0, r1 in (('Wing_Upper', S, E, 0.014, 0.011), ('Wing_Lower', E, W, 0.011, 0.009),
                                   ('Wing_F2', W, F2, 0.007, 0.004), ('Wing_F3', W, F3, 0.007, 0.0035),
                                   ('Wing_F4', W, F4, 0.006, 0.0035), ('Wing_F5', W, F5, 0.006, 0.0035)):
            pts = [a, a.lerp(b, 0.5), b]
            V, F, N, _ = C.tube(pts, [r0, (r0 + r1) / 2, r1], sides=5, cap0='flat', cap1='point')
            wb = sd(bone, s)
            if bone in ('Wing_Upper',):
                W_ = C.chain_weights(rig, V, [wb, sd('Wing_Lower', s)], 'Body', blend=0.3)
            elif bone == 'Wing_Lower':
                W_ = C.chain_weights(rig, V, [sd('Wing_Upper', s), wb], 'Body', blend=0.3)
            else:
                W_ = [{wb: 1.0}] * len(V)
            att.add(V, F, SECOND, N, W_, name='finger')
        V, F, N = C.cone(tuple(W + Vector((0, -0.005, 0.004))), tuple(W + Vector((s * 0.01, -0.04, 0.012))), 0.007, sides=4)
        att.add(V, F, BONE, N, {sd('Wing_Lower', s): 1.0}, name='thumb')
        # legs: thin, ending in a little claw fan
        V, F, N, _ = C.tube([Hp, Hp.lerp(A, 0.5), A], [0.013, 0.011, 0.009], sides=5, cap0='flat', cap1='flat')
        att.add(V, F, MAIN, N, C.chain_weights(rig, V, [sd('Leg', s)], 'Body'), name='leg')
        for dx in (-0.01, 0.0, 0.01):
            a = A + Vector((s * dx, 0.0, -0.004))
            V, F, N = C.cone(tuple(a), tuple(a + Vector((s * dx * 0.5, -0.012, -0.035))), 0.0045, sides=4)
            att.add(V, F, BONE, N, {sd('Foot', s): 1.0}, name='claw')
        Vm, Fm, Nm, Wm = membrane(s, rig)
        att.add(Vm, Fm, MAIN, Nm, Wm, name='membrane')
    # a short tail
    V, F, N, _ = C.tube([(0, 0.07, H - 0.005), (0, 0.13, H - 0.025), (0, 0.18, H - 0.04)], [0.016, 0.011, 0.0], sides=5,
                        cap0='flat', cap1='point')
    att.add(V, F, MAIN, N, C.chain_weights(rig, V, ['Tail'], 'Body'), name='tail')
    jaw_tris = 70
    body_tris = BUDGET - att.tris() - jaw_tris - 20
    V, F, N = C.implicit_mesh(body_el, RES, body_tris, name='bat_mb_body')
    W = C.field_weights(V, body_el, power=2.0)
    dom = C.dominant(np.array([V[list(f)].mean(0) for f in F]), body_el)
    FN = C.face_normals(V, F)
    slots = []
    for k, f in enumerate(F):
        c = V[list(f)].mean(0)
        sl = body_el[dom[k]].slot
        if c[1] < -0.125 and FN[k][2] < -0.35 and abs(c[0]) < 0.03:
            sl = ACCENT                             # the red roof of the mouth
        if body_el[dom[k]].tag == 'skull' and FN[k][1] < -0.55 and c[2] > H + 0.02:
            sl = SECOND                             # the mask runs up over the brow
        slots.append(sl)
    geo = Geo()
    geo.add(V, F, slots, N, W, name='body')
    Vj, Fj, Nj = C.implicit_mesh(jaw_elements(), RES * 0.8, jaw_tris, name='bat_mb_jaw')
    FNj = C.face_normals(Vj, Fj)
    sj = [ACCENT if FNj[k][2] > 0.3 else SECOND for k in range(len(Fj))]
    geo.add(Vj, Fj, sj, Nj, {'Jaw': 1.0}, name='jaw')
    Va, Na = att.arrays()
    for nm, off, n in att.pieces:
        fs = [tuple(i - off for i in f) for f in att.F if off <= f[0] < off + n]
        ss = [s for f, s in zip(att.F, att.S) if off <= f[0] < off + n]
        keys = {k: d[off] for k, d in att.keys.items() if off in d}
        geo.add(Va[off:off + n], fs, ss, Na[off:off + n], att.W[off:off + n], name=nm, keys=keys)
    body = C.make_object(geo, 'bat_body', rig.ob, key_names=['var_round_ears'])
    body['kind'] = 'body'
    body['base'] = BASE
    return body, {}


# ====================================================================== clips
def wings(p, up, sweep=0.0, fold=0.0, twist=0.0, spread=0.0):
    """Both wings: `up` lifts the arm (+ up), `fold` closes the hand-wing (0 open, 1 folded), `sweep` swings the arm
    back, `twist` pitches the hand-wing, `spread` fans the fingers wider."""
    for s, sg in (('L', 1), ('R', -1)):
        p['Wing_Upper_' + s] = (up, sg * twist * 0.4, sg * (sweep + 10 * fold))
        p['Wing_Lower_' + s] = (0.35 * up, sg * twist, sg * (-35 * fold))
        p['Wing_F2_' + s] = (0.15 * up, 0, sg * (40 * fold - 4 * spread))
        p['Wing_F3_' + s] = (0.15 * up, 0, sg * (55 * fold))
        p['Wing_F4_' + s] = (0.10 * up, 0, sg * (60 * fold + 6 * spread))
        p['Wing_F5_' + s] = (0.05 * up, 0, sg * (55 * fold + 10 * spread))
    return p


def flap(t, period, amp=55.0, base=5.0, phase=0.0):
    """A wingbeat: a fast, full downstroke and a slower, folded upstroke (the hand-wing folds on the way up)."""
    u = (t / period + phase) % 1.0
    if u < 0.45:                       # downstroke
        s = u / 0.45
        ang = base + amp * math.cos(math.pi * s)
        fold = 0.0
    else:                              # upstroke
        s = (u - 0.45) / 0.55
        ang = base - amp * math.cos(math.pi * s)
        fold = 0.55 * math.sin(math.pi * s)
    lift = -math.sin(2 * math.pi * u)  # the body rises on the downstroke
    return ang, fold, lift


def author(rig, M):
    clips = []
    N0 = {'legs': {}}
    body = M.vertex_mask(('Body', 'Head'))

    def dangle(p, t, period):
        for s, ph in (('L', 0.0), ('R', 0.3)):
            p['Leg_' + s] = (8 + 6 * wave(t, period, ph), 0, 0)
            p['Foot_' + s] = (10 + 8 * wave(t, period, ph + 0.2), 0, 0)
        p['Tail'] = (6 * wave(t, period, 0.4), 0, 0)
        return p

    # ---------------------------------------------------------- Idle: hovering, two beats a second
    TI = 16 / 30.0

    def idle(t):
        ang, fold, lift = flap(t, TI)
        p = {'legs': {}}
        p['Root.loc'] = (0.0, 0.0, 0.035 * lift)
        p['Body'] = (-8 + 4 * lift, 0, 0)
        p['Head'] = (8 - 4 * lift, 0, 0)
        p['Jaw'] = (-4, 0, 0)
        p['Ear_L'] = (4 * lift, 0, 0)
        p['Ear_R'] = (4 * lift, 0, 0)
        wings(p, ang, sweep=-4 * lift, fold=fold, twist=8 * lift)
        return dangle(p, t, TI)

    clips.append(Clip('Idle', TI, loop=True, fn=idle, shots=[i / 30 for i in (0, 3, 6, 8, 11, 14)]))

    # ---------------------------------------------------------- Move: forward flight, body pitched down, harder beats
    TM = 12 / 30.0

    def move(t):
        ang, fold, lift = flap(t, TM, amp=62.0, base=0.0)
        p = {'legs': {}}
        p['Root.loc'] = (0.0, 0.0, 0.04 * lift)
        p['Body'] = (-24 + 4 * lift, 0, 0)
        p['Head'] = (18 - 4 * lift, 0, 0)
        p['Ear_L'] = (-20, 0, 0)
        p['Ear_R'] = (-20, 0, 0)
        wings(p, ang, sweep=-10 - 6 * lift, fold=fold, twist=-12 + 10 * lift)
        p = dangle(p, t, TM)
        p['Leg_L'] = (30, 0, 0)
        p['Leg_R'] = (30, 0, 0)
        return p

    clips.append(Clip('Move', TM, loop=True, fn=move, speed=3.0, shots=[i / 30 for i in (0, 2, 4, 6, 8, 10)]))

    # ---------------------------------------------------------- Attack1: wings up, dive and bite, beat back up
    k0 = wings({'legs': {}, 'Body': (-8, 0, 0), 'Head': (8, 0, 0)}, 5.0)
    k1 = wings(step(k0, {'Root.loc': (0, 0.06, 0.10), 'Body': (6, 0, 0), 'Head': (0, 0, 0), 'Jaw': (-14, 0, 0),
                         'Ear_L': (-25, 0, 0), 'Ear_R': (-25, 0, 0)}), 70.0, fold=0.2, sweep=-6)
    k2 = wings(step(k1, {'Root.loc': (0, -0.42, -0.40), 'Body': (-38, 0, 0), 'Head': (6, 0, 0), 'Jaw': (-48, 0, 0)}),
               -20.0, sweep=18, spread=1.0)
    k3 = wings(step(k2, {'Root.loc': (0, -0.40, -0.36), 'Body': (-30, 0, 0), 'Jaw': (-4, 0, 0), 'Head': (0, 8, 10)}),
               -45.0, sweep=10)
    k4 = wings(step(k3, {'Root.loc': (0, -0.15, -0.10), 'Body': (-10, 0, 0), 'Head': (6, 0, 0), 'Jaw': (-6, 0, 0)}),
               55.0, fold=0.4)
    k5 = wings(step(k4, {'Root.loc': (0, 0.0, 0.0), 'Body': (-8, 0, 0), 'Head': (8, 0, 0), 'Jaw': (-4, 0, 0),
                         'Ear_L': (0, 0, 0), 'Ear_R': (0, 0, 0)}), 5.0)
    keys = [(0.0, k0, None), (0.22, k1, 'smooth'), (0.38, k2, 'in'), (0.46, k3, 'out'), (0.66, k4, 'smooth'),
            (0.90, k5, 'smooth')]
    clips.append(Clip('Attack1', 0.90, keys=keys, events={'hit': 0.40}, shots=[0, 0.22, 0.38, 0.46, 0.66, 0.9],
                      overlay=lambda t, p: dangle(p, t, 0.45)))

    # ---------------------------------------------------------- Attack2: the shriek — rear back, wings flung wide, mouth open
    s1 = wings(step(k0, {'Root.loc': (0, 0.10, 0.12), 'Body': (18, 0, 0), 'Head': (-6, 0, 0), 'Jaw': (-10, 0, 0),
                         'Ear_L': (-20, 0, 0), 'Ear_R': (-20, 0, 0)}), 40.0, fold=0.5)
    s2 = wings(step(s1, {'Root.loc': (0, 0.04, 0.08), 'Body': (-4, 0, 0), 'Head': (-14, 0, 0), 'Jaw': (-55, 0, 0),
                         'Ear_L': (25, 0, 0), 'Ear_R': (25, 0, 0)}), 20.0, sweep=-14, spread=1.0)
    s3 = wings(step(s2, {'Head': (-12, 0, 0), 'Jaw': (-50, 0, 0)}), 26.0, sweep=-12, spread=1.0, twist=6)
    s4 = wings(step(s3, {'Head': (-14, 0, 0), 'Jaw': (-55, 0, 0)}), 16.0, sweep=-14, spread=1.0, twist=-6)
    s5 = wings(step(s4, {'Root.loc': (0, 0.0, 0.0), 'Body': (-8, 0, 0), 'Head': (8, 0, 0), 'Jaw': (-4, 0, 0),
                         'Ear_L': (0, 0, 0), 'Ear_R': (0, 0, 0)}), 5.0)
    keys = [(0.0, k0, None), (0.25, s1, 'smooth'), (0.38, s2, 'in'), (0.52, s3, 'smooth'), (0.66, s4, 'smooth'),
            (1.0, s5, 'smooth')]
    clips.append(Clip('Attack2', 1.0, keys=keys, events={'release': 0.38}, shots=[0, 0.25, 0.38, 0.52, 0.66, 1.0],
                      overlay=lambda t, p: dangle(p, t, 0.5)))

    # ---------------------------------------------------------- Hit: knocked back and tipped, a scramble of beats
    h1 = wings(step(k0, {'Root.loc': (0, 0.16, 0.06), 'Root': (-10, 18, 0), 'Body': (20, 0, 0), 'Head': (20, 10, 0),
                         'Jaw': (-26, 0, 0), 'Ear_L': (-30, 0, 0), 'Ear_R': (-30, 0, 0)}), 60.0, fold=0.6, sweep=10)
    h2 = wings(step(h1, {'Root.loc': (0, 0.08, 0.0), 'Root': (-4, 6, 0), 'Body': (2, 0, 0), 'Head': (8, 0, 0),
                         'Jaw': (-8, 0, 0)}), -40.0)
    h3 = wings(step(h2, {'Root.loc': (0, 0.0, 0.0), 'Root': (0, 0, 0), 'Body': (-8, 0, 0), 'Head': (8, 0, 0),
                         'Jaw': (-4, 0, 0), 'Ear_L': (0, 0, 0), 'Ear_R': (0, 0, 0)}), 5.0)
    keys = [(0.0, k0, None), (0.08, h1, 'out'), (0.30, h2, 'smooth'), (0.55, h3, 'smooth')]
    clips.append(Clip('Hit', 0.55, keys=keys, shots=[0, 0.08, 0.18, 0.3, 0.42, 0.55],
                      overlay=lambda t, p: dangle(p, t, 0.3)))

    # ---------------------------------------------------------- Death: a jolt, wings crumple, it drops and lies spread on its back
    d1 = wings(step(k0, {'Root.loc': (0, 0.08, 0.08), 'Body': (24, 0, 0), 'Head': (24, 0, 0), 'Jaw': (-40, 0, 0)}),
               75.0, fold=0.3)
    d3 = wings(step(d1, {'Root': (0, 0, 0), 'Body': (-6, 0, 0), 'Head': (-8, 0, 10), 'Jaw': (-12, 0, 0),
                         'Ear_L': (-30, 0, 0), 'Ear_R': (-20, 0, 0), 'Leg_L': (-30, 0, 0), 'Leg_R': (-26, 0, 0), 'Foot_L': (-20, 0, 0), 'Foot_R': (-20, 0, 0)}),
               -6.0, fold=0.1, sweep=8, spread=1.0)
    d3 = M.ground(d3, mask=body)
    lz = d3['Root.loc']
    d2 = wings(step(d1, {'Root.loc': (0, 0.06, lz[2] * 0.5), 'Root': (-14, 10, 0), 'Body': (-20, 0, 0), 'Head': (6, 0, 0),
                         'Jaw': (-34, 0, 0)}), 40.0, fold=0.6, sweep=14)
    d4 = wings(step(d3, {}), 8.0, fold=0.15, sweep=8, spread=1.0)
    d4 = M.ground(d4, mask=body, lift=0.02)
    d5 = dict(d3)
    d5['Wing_Upper_L'] = (12, 0, 8)
    keys = [(0.0, k0, None), (0.10, d1, 'out'), (0.38, d2, 'in'), (0.56, d3, 'in'), (0.66, d4, 'out'), (0.80, d3, 'in'),
            (1.05, d5, 'smooth'), (1.25, d3, 'smooth'), (1.40, d3, 'smooth')]
    clips.append(Clip('Death', 1.40, keys=keys, events={'down': 0.56}, shots=[0, 0.1, 0.38, 0.56, 0.8, 1.4]))
    return clips


# ====================================================================== variants
def variants():
    return [
        dict(id='grave-bat', name='Grave Bat', scale=1.0, parts=[], shapes={}, clipSpeed=1.0, role='fodder',
             palette=['#4a4f5c', '#e6dcc4', '#c8243a'], girth=0.7),
        dict(id='pet-crypt-bat', name='Crypt Bat (pet)', scale=0.6, parts=[], shapes={'var_round_ears': 1.0},
             clipSpeed=1.2, role='pet', pet='crypt-bat', palette=C.content_palette('crypt-bat', pet=True), girth=0.7),
    ]


# ====================================================================== main
def main():
    C.log('build_bat: quick=%s' % QUICK)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = C.FPS
    M = C.Monster(BASE, quick=QUICK)
    M.view = dict(az=30.0, el=14.0)
    M.card_view = dict(az=30.0, el=14.0)
    M.lineup_yaw = -30.0
    M.fight = dict(girth=0.7, count=3)
    M.rig = CRig('Rig', bone_table(), legs=[], loc_bones=('Root',))
    body, parts = build_geometry(M.rig)
    M.body = body
    M.parts = parts
    M.variants = variants()
    C.log('bat_body: %d tris, %d verts' % (body['tris'], len(body.data.vertices)))
    for v in M.variants:
        C.log('variant %-16s x%.2f  %d tris  palette %s' % (v['id'], v['scale'], M.tris_of(v), v['palette']))
    M.clips = author(M.rig, M)
    M.bake_clips()
    M.check_clips()
    M.lines.append('')
    M.lines.append('- bat_body %d tris' % body['tris'])
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
        C.log('bat.glb %.1f KB' % kb)
        C.save_blend(os.path.join(C.BUILD, 'monsters_bat.blend'))
        from export import reimport_report
        for line in reimport_report(path):
            C.log(line)
    else:
        C.save_blend(os.path.join(C.BUILD, 'monsters_bat.blend'))


if __name__ == '__main__':
    main()

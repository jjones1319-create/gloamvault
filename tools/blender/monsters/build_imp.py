"""build_imp.py — the imp base (06 §9, D-117): the Vault Imp pet of the Drowned Vault (the Brine Hag's familiar).

Run:  blender -b -P tools/blender/monsters/build_imp.py -- [--quick] [--no-renders] [--no-export] [--only Idle,Move]

A small salt-white imp of the flooded vault (scale 1 = 1.0 m tall; the pet is x0.6, 06 §9 "imp base 0.6 m"): a crouched,
pot-bellied biped with a big round head, a wide toothy grin, heavy slanted brows over two big pearl eyes sunk in dark
sockets (palette slot 14, gem: the client fills it with the accent colour and lets it glow), fin-ears of spines and
membrane swept back from the head, a small fin crest, long thin arms ending in long-fingered hands, digitigrade legs on
webbed three-toed feet, and an S-curved tail ending in a fin; hands, feet, brows and fins are its grey-beige points
(palette slot 1). The part `imp_satchel` is a thief's leather pouch on a strap
across the chest (Forage: +10 % gold; the Hag's Fingers trait). Rig (34 bones): Root · Hips · Spine · Chest · Neck ·
Head · Jaw · Ear_L/R · Tail_01..05 · per arm UpperArm / LowerArm / Hand / Fingers1 / Fingers2 / Thumb · per leg
UpperLeg / LowerLeg / Foot / Toes (a two-bone IK, knee forward, the heel held up off the floor).

Clips: Idle (rubs its hands, breathing, ear flicks, the tail swaying), Move (a crouched scamper, arms swinging),
Attack1 (Pilfer: a crouch, a dart, a snatch with the right hand — `hit` — and the prize hugged to the chest), Attack2
(Hex: up on its toes, both hands thrust out with the fingers splayed — `release` — and a cackle), Hit, Death (stumbles
back and falls on its back, limbs splayed — `down`).

Outputs: client/public/models/monsters/imp.glb, the `imp` key of clips.json, the `pet-vault-imp` entry of manifest.json,
art/renders/monsters/imp/*.png, art/build/monsters_imp.blend, art/build/monsters_imp_checks.txt.
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
from creature_lib import (BONE, GEM, INK, MAIN, SECOND, CRig, Clip, Geo, Leg, ball, capsule, ellipsoid,  # noqa: E402
                          step, wave)
from pet_lib import J, sym  # noqa: E402

ARGS = C.args()
QUICK = bool(ARGS.get('quick'))
ONLY = set(ARGS['only'].split(',')) if isinstance(ARGS.get('only'), str) else None
BASE = 'imp'
BUDGET = 2900          # the body object (body, head, arms, fins, tail); the satchel part on top — a pet is 2–4k
RES = 0.006
LEATHER, METAL = 8, 9

UP = (0, 0, 1)
FWD = (0, -1, 0)


def MED(s):
    """The hand bones' Z: toward the body's midline (the palm), so +X curls the fingers into the palm on both sides."""
    return (-s, 0.0, 0.0)


def sd(name, s):
    return name + ('_L' if s > 0 else '_R')


def mx(p, s):
    return (p[0] * s, p[1], p[2])


# the skeleton's key points, left side (x > 0)
HIP = (0.095, 0.03, 0.36)          # the leg's joints lie in one plane (x = 0.095): the IK's plane holds the foot exactly
KNEE = (0.095, -0.085, 0.225)
ANKLE = (0.095, 0.035, 0.09)
BALL = (0.095, -0.055, 0.022)
TOE = (0.095, -0.145, 0.012)
SHO = (0.115, 0.0, 0.615)
ELB = (0.175, 0.04, 0.455)
WRI = (0.19, -0.035, 0.32)
KNU = (0.192, -0.06, 0.25)
FMID = (0.193, -0.074, 0.205)
FTIP = (0.193, -0.082, 0.16)
THB0 = (0.172, -0.058, 0.29)
THB1 = (0.158, -0.095, 0.257)
TAIL = [(0, 0.075, 0.37), (0, 0.19, 0.30), (0, 0.31, 0.31), (0, 0.41, 0.38), (0, 0.47, 0.49), (0, 0.49, 0.61)]
EAR0 = (0.125, -0.045, 0.855)
EAR1 = (0.33, 0.07, 0.94)
EYE = (0.074, -0.168, 0.818)
EYE_R = 0.048
TORSO = ('Hips', 'Spine', 'Chest')
TOES = ((-0.045, 0.085), (0.0, 0.11), (0.045, 0.085))      # (sideways, forward) of each toe tip from the ball


def bone_table():
    b = [
        ('Root', None, (0, 0, 0), (0, -0.10, 0), UP),
        ('Hips', 'Root', (0, 0.03, 0.36), (0, 0.0, 0.46), FWD),
        ('Spine', 'Hips', (0, 0.0, 0.46), (0, -0.015, 0.56), FWD),
        ('Chest', 'Spine', (0, -0.015, 0.56), (0, -0.03, 0.655), FWD),
        ('Neck', 'Chest', (0, -0.03, 0.655), (0, -0.045, 0.715), FWD),
        ('Head', 'Neck', (0, -0.045, 0.715), (0, -0.05, 0.95), FWD),
        ('Jaw', 'Head', (0, -0.085, 0.715), (0, -0.205, 0.69), UP),
    ]
    for i in range(5):
        b.append(('Tail_%02d' % (i + 1), 'Hips' if i == 0 else 'Tail_%02d' % i, TAIL[i], TAIL[i + 1], UP))
    for s in (1, -1):
        b += [
            (sd('Ear', s), 'Head', mx(EAR0, s), mx(EAR1, s), UP),
            (sd('UpperArm', s), 'Chest', mx(SHO, s), mx(ELB, s), FWD),
            (sd('LowerArm', s), sd('UpperArm', s), mx(ELB, s), mx(WRI, s), FWD),
            (sd('Hand', s), sd('LowerArm', s), mx(WRI, s), mx(KNU, s), MED(s)),
            (sd('Fingers1', s), sd('Hand', s), mx(KNU, s), mx(FMID, s), MED(s)),
            (sd('Fingers2', s), sd('Fingers1', s), mx(FMID, s), mx(FTIP, s), MED(s)),
            (sd('Thumb', s), sd('Hand', s), mx(THB0, s), mx(THB1, s), MED(s)),
            (sd('UpperLeg', s), 'Hips', mx(HIP, s), mx(KNEE, s), FWD),
            (sd('LowerLeg', s), sd('UpperLeg', s), mx(KNEE, s), mx(ANKLE, s), FWD),
            (sd('Foot', s), sd('LowerLeg', s), mx(ANKLE, s), mx(BALL, s), UP),
            (sd('Toes', s), sd('Foot', s), mx(BALL, s), mx(TOE, s), UP),
        ]
    return b


LEGS = [Leg('L', ('UpperLeg_L', 'LowerLeg_L'), ('Foot_L', 'Toes_L'), bend=1, abduct=20.0),
        Leg('R', ('UpperLeg_R', 'LowerLeg_R'), ('Foot_R', 'Toes_R'), bend=1, abduct=20.0)]


# ====================================================================== body
def body_elements():
    """Head, torso and legs (one surface); the arms and the jaw are their own."""
    rb = Matrix.Rotation(math.radians(-22), 3, 'Y').to_quaternion()       # the brows slant down toward the nose
    el = [
        ellipsoid((0, -0.05, 0.80), (0.15, 0.135, 0.13), bone='Head', tag='cranium'),
        ellipsoid((0, -0.03, 0.865), (0.115, 0.11, 0.075), bone='Head', tag='crown'),
        ball((0.095, -0.125, 0.75), 0.058, bone='Head', tag='cheek_L'),
        ellipsoid((0, -0.175, 0.758), (0.072, 0.05, 0.042), bone='Head', tag='muzzle'),
        ellipsoid((0.072, -0.165, 0.87), (0.058, 0.032, 0.022), bone='Head', rot=rb, slot=SECOND, tag='brow_L'),
        ellipsoid((0, -0.03, 0.665), (0.055, 0.05, 0.05), bone={'Neck': 0.7, 'Head': 0.3}, tag='neck'),
        ellipsoid((0, -0.012, 0.57), (0.098, 0.075, 0.085), bone='Chest', tag='chest'),
        ball((0.10, -0.005, 0.612), 0.042, bone={'Chest': 0.6, 'UpperArm_L': 0.4}, tag='shoulder_L'),
        ellipsoid((0, -0.035, 0.465), (0.112, 0.105, 0.10), bone='Spine', tag='belly'),
        ellipsoid((0, 0.02, 0.385), (0.10, 0.08, 0.07), bone='Hips', tag='hips'),
        capsule(HIP, KNEE, 0.034, bone='UpperLeg_L', tag='thigh_L'),
        ball(KNEE, 0.031, bone={'UpperLeg_L': 0.5, 'LowerLeg_L': 0.5}, tag='knee_L'),
        capsule(KNEE, ANKLE, 0.026, bone='LowerLeg_L', tag='shin_L'),
        capsule(ANKLE, (BALL[0], BALL[1], 0.030), 0.021, bone='Foot_L', slot=SECOND, tag='foot_L'),
        ball((BALL[0], BALL[1], 0.028), 0.024, bone={'Foot_L': 0.5, 'Toes_L': 0.5}, slot=SECOND, tag='ball_L'),
    ]
    for dx, ln in TOES:
        tip = (BALL[0] + dx, BALL[1] - ln, 0.020)
        el.append(capsule((BALL[0] + dx * 0.3, BALL[1] - 0.01, 0.022), tip, 0.0165, bone='Toes_L', slot=SECOND, tag='toe_L'))
    return C.with_mirror(el)


def arm_elements(s):
    def m(p):
        return mx(p, s)
    hand_c = tuple(Vector(m(WRI)).lerp(Vector(m(KNU)), 0.5))
    return [
        capsule(m(SHO), m(ELB), 0.026, bone=sd('UpperArm', s), tag='upper'),
        ball(m(ELB), 0.027, bone={sd('UpperArm', s): 0.5, sd('LowerArm', s): 0.5}, tag='elbow'),
        capsule(m(ELB), m(WRI), 0.024, bone=sd('LowerArm', s), tag='fore'),
        ellipsoid(hand_c, (0.022, 0.034, 0.045), bone=sd('Hand', s), slot=SECOND, tag='palm'),
    ]


def jaw_elements():
    """The lower jaw, resting a little open so the grin shows a dark mouth behind the teeth."""
    return [
        ellipsoid((0, -0.146, 0.688), (0.084, 0.062, 0.027), bone='Jaw', tag='jaw'),
        ball((0, -0.188, 0.678), 0.03, bone='Jaw', tag='chin'),
    ]


def slab(grid, thick):
    """A thin closed sheet through a grid of points (rows × columns): two faces thick apart and the border."""
    Pg = np.array([[tuple(p) for p in row] for row in grid], dtype=np.float64)
    R, Cn = Pg.shape[0], Pg.shape[1]
    dU = np.gradient(Pg, axis=0)
    dV = np.gradient(Pg, axis=1)
    Nn = C.unit(np.cross(dU, dV))
    top = (Pg + Nn * thick / 2).reshape(-1, 3)
    bot = (Pg - Nn * thick / 2).reshape(-1, 3)
    V = np.concatenate([top, bot])

    def idx(r, c, layer):
        return layer * R * Cn + r * Cn + c
    F = []
    for r in range(R - 1):
        for c in range(Cn - 1):
            F.append((idx(r, c, 0), idx(r + 1, c, 0), idx(r + 1, c + 1, 0), idx(r, c + 1, 0)))
            F.append((idx(r, c, 1), idx(r, c + 1, 1), idx(r + 1, c + 1, 1), idx(r + 1, c, 1)))
    loop = [(0, c) for c in range(Cn)] + [(r, Cn - 1) for r in range(1, R)] + \
           [(R - 1, c) for c in range(Cn - 2, -1, -1)] + [(r, 0) for r in range(R - 2, 0, -1)]
    cen = Pg.reshape(-1, 3).mean(0)
    for k in range(len(loop)):
        a, b_ = loop[k], loop[(k + 1) % len(loop)]
        f = (idx(*a, 0), idx(*b_, 0), idx(*b_, 1), idx(*a, 1))
        pts = V[list(f)]
        n = np.cross(pts[1] - pts[0], pts[3] - pts[0])
        if n.dot(pts.mean(0) - cen) < 0:
            f = tuple(reversed(f))
        F.append(f)
    N = np.concatenate([Nn.reshape(-1, 3), -Nn.reshape(-1, 3)])
    return V, F, N


def fin(base, tips, rows=3, scallop=0.25, thick=0.008, spine_r=0.010, over=1.07, spine_slot=MAIN):
    """A fin: a scalloped membrane (SECOND) between spines (MAIN) radiating from `base` to `tips`. Returns pieces
    [(V, F, N, slot)] and the membrane's rows (for weights)."""
    B = Vector(base)
    tv = [Vector(t) for t in tips]
    cols = []
    for i, t in enumerate(tv):
        cols.append(t)
        if i < len(tv) - 1:
            m = (t + tv[i + 1]) / 2
            cols.append(m + (B - m) * scallop)
    us = [0.06 + 0.94 * r / rows for r in range(rows + 1)]
    grid = [[B.lerp(c, u) for c in cols] for u in us]
    V, F, N = slab(grid, thick)
    out = [(V, F, N, SECOND)]
    for t in tv:
        Vs, Fs, Ns, _ = C.tube([B, B.lerp(t, over)], [spine_r, 0.0], sides=4, cap0='flat', cap1='point')
        out.append((Vs, Fs, Ns, spine_slot))
    return out


def build_geometry(rig):
    body_el = body_elements()
    jaw_el = jaw_elements()
    att = Geo()
    # ---------------------------------------------------------------- eyes: big pearls (gem slot, glowing) in dark sockets
    eyes = {}
    for s in (1, -1):
        c = Vector(mx(EYE, s))
        d = Vector((s * 0.42, -1.0, 0.08)).normalized()
        V, F, N = C.uv_sphere(tuple(c), EYE_R, rings=6, segs=8, rot=d.to_track_quat('Z', 'Y'))
        att.add(V, F, GEM, N, {'Head': 1.0}, name='eye')
        eyes[s] = (c, d)
    # ---------------------------------------------------------------- teeth: a grin of small fangs on both lips
    for k, x in enumerate((-0.052, -0.031, -0.01, 0.01, 0.031, 0.052)):
        lip = C.surface_point(body_el, (x * 0.8, -0.16, 0.725), (x * 1.5, -1.0, -0.12), reach=0.2)
        ln = 0.021 if abs(x) > 0.04 else 0.016
        V, F, N = C.cone(tuple(lip + Vector((0, 0.008, 0.004))), tuple(lip + Vector((x * 0.05, -0.002, -ln))), 0.0085, sides=4)
        att.add(V, F, BONE, N, {'Head': 1.0}, name='tooth_up')
    for x in (-0.042, -0.014, 0.014, 0.042):
        lip = C.surface_point(jaw_el, (x * 0.8, -0.16, 0.695), (x * 1.5, -1.0, 0.3), reach=0.2)
        V, F, N = C.cone(tuple(lip + Vector((0, 0.008, -0.004))), tuple(lip + Vector((x * 0.05, -0.002, 0.017))), 0.0075, sides=4)
        att.add(V, F, BONE, N, {'Jaw': 1.0}, name='tooth_lo')
    # ---------------------------------------------------------------- fin-ears, the crest, the tail and its fin
    for s in (1, -1):
        e0 = Vector(mx(EAR0, s))
        e1 = Vector(mx(EAR1, s))
        dirn = (e1 - e0).normalized()
        upv = Vector((0, 0.25, 1.0))
        upv = (upv - dirn * upv.dot(dirn)).normalized()
        L = (e1 - e0).length
        tips = []
        for ang, ln in ((-38, 0.70), (-14, 1.0), (10, 1.04), (34, 0.86), (58, 0.62)):
            a = math.radians(ang)
            tips.append(e0 + (dirn * math.cos(a) + upv * math.sin(a)) * L * ln)
        for V, F, N, sl in fin(e0 - dirn * 0.01, tips, rows=3, scallop=0.28, thick=0.009, spine_r=0.011):
            W = []
            for p in V:
                u = (Vector(p) - e0).dot(dirn) / L
                w = max(0.0, min(1.0, u * 3.0))
                W.append({sd('Ear', s): w, 'Head': 1 - w} if w < 1 else {sd('Ear', s): 1.0})
            att.add(V, F, sl, N, W, name='ear')
    crest_base = Vector((0, -0.02, 0.905))
    tips = [crest_base + Vector((0, -0.085, 0.07)), crest_base + Vector((0, -0.01, 0.105)), crest_base + Vector((0, 0.075, 0.08)),
            crest_base + Vector((0, 0.135, 0.02))]
    for V, F, N, sl in fin(crest_base + Vector((0, 0.0, -0.02)), tips, rows=2, scallop=0.30, thick=0.008, spine_r=0.009):
        V = np.array(V)
        att.add(V, F, sl, N, {'Head': 1.0}, name='crest')
    chain = ['Tail_%02d' % i for i in range(1, 6)]
    Pt = C.curve_points(TAIL, 12)
    rad = np.interp(np.linspace(0, 1, 12), [0, 0.15, 1.0], [0.034, 0.026, 0.011])
    V, F, N, ring = C.tube(Pt, rad, sides=6, cap0='flat', cap1='flat', up=(0, -1, 0))
    att.add(V, F, MAIN, N, C.chain_weights(rig, V, chain, 'Hips', blend=0.4, rooted=lambda p: p.y < 0.11), name='tail')
    tb = Vector(TAIL[-1])
    tdir = (Vector(TAIL[-1]) - Vector(TAIL[-2])).normalized()
    side = Vector((0, -tdir.z, tdir.y)).normalized()            # in the tail's own plane (x = 0)
    tips = [tb + tdir * 0.07 + side * 0.085, tb + tdir * 0.11 + side * 0.03, tb + tdir * 0.11 - side * 0.03,
            tb + tdir * 0.07 - side * 0.085]
    for V, F, N, sl in fin(tb - tdir * 0.03, tips, rows=2, scallop=0.32, thick=0.008, spine_r=0.008):
        att.add(V, F, sl, N, {'Tail_05': 1.0}, name='fluke')
    # ---------------------------------------------------------------- arms: an implicit arm and palm, tube fingers
    arms = []
    for s in (1, -1):
        el = arm_elements(s)
        Va, Fa, Na = C.implicit_mesh(el, RES * 0.6, 230, sym=False, name='imp_mb_arm_%s' % ('L' if s > 0 else 'R'))
        Wa = C.field_weights(Va, el, power=2.0)
        doma = C.dominant(np.array([Va[list(f)].mean(0) for f in Fa]), el)
        arms.append((Va, Fa, Na, Wa, [el[j].slot for j in doma]))
        knu = Vector(mx(KNU, s))
        fm = Vector(mx(FMID, s))
        ft = Vector(mx(FTIP, s))
        for dx, ln in ((-0.016, 0.9), (0.0, 1.0), (0.016, 0.92)):
            sideo = Vector((0.0, dx, 0.0))                  # the fingers fan across the hand's width (front to back)
            pts = [knu + sideo * 0.8 + Vector((0, 0, 0.02)), knu + sideo, fm + sideo * 1.15, knu.lerp(ft, 1.0 * ln) + sideo * 1.3]
            Pf = C.curve_points([tuple(p) for p in pts], 5)
            V, F, N, ring = C.tube(Pf, [0.0125, 0.012, 0.0105, 0.0085, 0.0], sides=5, cap0='flat', cap1='point',
                                   up=(s, 0, 0))
            W = C.chain_weights(rig, V, [sd('Fingers1', s), sd('Fingers2', s)], sd('Hand', s), blend=0.35,
                                rooted=lambda p, z=knu.z + 0.008: p.z > z)
            att.add(V, F, SECOND, N, W, name='finger')
        t0 = Vector(mx(THB0, s))
        t1 = Vector(mx(THB1, s))
        V, F, N, _ = C.tube([t0 + (t0 - t1) * 0.3, t0, t0.lerp(t1, 0.5), t1 + (t1 - t0) * 0.25], [0.012, 0.012, 0.010, 0.0],
                            sides=5, cap0='flat', cap1='point')
        att.add(V, F, SECOND, N, {sd('Thumb', s): 1.0}, name='thumb')
    used = att.tris() + sum(sum(len(f) - 2 for f in a[1]) for a in arms)
    jaw_tris = 130
    body_tris = BUDGET - used - jaw_tris - 20
    C.log('imp: attachments %d tris, arms %s, body implicit target %d' % (att.tris(), [sum(len(f) - 2 for f in a[1]) for a in arms],
                                                                        body_tris))
    # ---------------------------------------------------------------- the implicit body and jaw
    V, F, N = C.implicit_mesh(body_el, RES, body_tris, name='imp_mb_body')
    W = C.field_weights(V, body_el, power=2.0)
    # the sole snap: the remesh rounds the thin feet off by a centimetre or two either way; move the feet (by their
    # Foot + Toes weight) so the lowest sole point sits 4 mm above the floor
    wf = np.array([sum(w.get(b, 0.0) for b in ('Foot_L', 'Toes_L', 'Foot_R', 'Toes_R')) for w in W])
    feet = wf > 0.5
    delta = V[feet][:, 2].min() - 0.004
    V = V.copy()
    V[:, 2] -= delta * np.clip(wf, 0.0, 1.0)
    C.log('imp: sole snap %.1f mm' % (delta * 1000))
    dom = C.dominant(np.array([V[list(f)].mean(0) for f in F]), body_el)
    FN = C.face_normals(V, F)
    slots = []
    for q, f in enumerate(F):
        c = V[list(f)].mean(0)
        sl = body_el[dom[q]].slot
        for s in (1, -1):
            ec, ed = eyes[s]
            if (Vector(c) - ec).length < EYE_R * 1.22 and Vector(FN[q]).dot(ed) > 0.3:
                sl = INK                                    # a dark rim round each eye
        if c[1] < -0.17 and c[2] < 0.742 and FN[q][2] < -0.2 and abs(c[0]) < 0.085:
            sl = INK                                        # the roof of the mouth (shows when the jaw drops)
        for s in (1, -1):
            if (Vector(c) - Vector((s * 0.022, -0.215, 0.778))).length < 0.0105:
                sl = INK                                    # nostrils
        slots.append(sl)
    geo = Geo()
    geo.add(V, F, slots, N, W, name='body')

    for s in (1, -1):
        b0 = Vector(mx(BALL, s)) + Vector((0, -0.012, 0))
        b0.z = 0.011
        tips = [Vector((b0.x + s * dx * 0.95, BALL[1] - ln * 0.95, 0.011)) for dx, ln in TOES]
        if s < 0:
            tips = tips[::-1]
        for Vw, Fw, Nw, sl in fin(b0, tips, rows=2, scallop=0.30, thick=0.006, spine_r=0.0, over=1.0, spine_slot=SECOND)[:1]:
            geo.add(Vw, Fw, SECOND, Nw, {sd('Toes', s): 1.0}, name='web')
    Vj, Fj, Nj = C.implicit_mesh(jaw_el, RES * 0.8, jaw_tris, sym=True, name='imp_mb_jaw')
    FNj = C.face_normals(Vj, Fj)
    sj = [INK if (FNj[k][2] > 0.3 and Vj[list(f)].mean(0)[1] < -0.125) else MAIN for k, f in enumerate(Fj)]
    geo.add(Vj, Fj, sj, Nj, {'Jaw': 1.0}, name='jaw')
    for Va, Fa, Na, Wa, sa in arms:
        geo.add(Va, Fa, sa, Na, Wa, name='arm')
    Vx, Nx = att.arrays()
    for nm, off, n in att.pieces:
        fs = [tuple(i - off for i in f) for f in att.F if off <= f[0] < off + n]
        ss = [s for f, s in zip(att.F, att.S) if off <= f[0] < off + n]
        geo.add(Vx[off:off + n], fs, ss, Nx[off:off + n], att.W[off:off + n], name=nm)
    body = C.make_object(geo, 'imp_body', rig.ob, key_names=[])
    body['kind'] = 'body'
    body['base'] = BASE
    parts = {'imp_satchel': build_satchel(rig, body_el)}
    for nm, ob in parts.items():
        ob['kind'] = 'part'
        ob['base'] = BASE
        ob['part'] = nm
    return body, parts


def build_satchel(rig, el):
    """The thief's satchel: a leather pouch at the right hip with a flap and a metal clasp, on a strap from the left
    shoulder across the chest and back."""
    g = Geo()
    pc = Vector((-0.135, -0.005, 0.405))
    pouch = [ellipsoid(tuple(pc), (0.04, 0.05, 0.05), bone='Hips', slot=LEATHER),
             ellipsoid(tuple(pc + Vector((-0.004, -0.004, -0.028))), (0.045, 0.054, 0.032), bone='Hips', slot=LEATHER)]
    V, F, N = C.implicit_mesh(pouch, 0.004, 150, sym=False, name='imp_mb_pouch')
    g.add(V, F, LEATHER, N, {'Hips': 1.0}, name='pouch')
    V, F, N = C.uv_sphere(tuple(pc + Vector((-0.044, -0.004, 0.006))), (0.012, 0.016, 0.016), rings=3, segs=6,
                          rot=Vector((-1, 0, 0)).to_track_quat('Z', 'Y'))
    g.add(V, F, METAL, N, {'Hips': 1.0}, name='clasp')
    # the strap: a loop round the torso from the left shoulder to the right hip
    a = Vector((0.085, -0.02, 0.64))
    b_ = Vector((-0.118, 0.0, 0.43))
    mid = (a + b_) / 2
    axis = (a - b_).normalized()
    pts = []
    for i in range(14):
        t = 2 * math.pi * i / 14
        u = Vector((0, -1, 0))
        u = (u - axis * u.dot(axis)).normalized()
        v = axis.cross(u)
        d = u * math.cos(t) + v * math.sin(t)
        p = C.surface_point(el, tuple(mid), tuple(d), reach=0.4)
        pts.append(p + d * 0.006)
    V, F, N = C.ring_tube(pts, 0.009, sides=4, flat=(0.45, 1.6))

    def strap_w(p):
        z = p[2]
        wc = C.smooth((z - 0.50) / 0.10)
        wh = C.smooth((0.47 - z) / 0.08)
        ws = max(0.0, 1.0 - wc - wh)
        return {k: w for k, w in (('Chest', wc), ('Spine', ws), ('Hips', wh)) if w > 1e-3}
    g.add(V, F, LEATHER, N, [strap_w(p) for p in V], name='strap')
    return C.make_object(g, 'imp_satchel', rig.ob)


# ====================================================================== clips
def author(rig, M):
    clips = []
    N0 = {'legs': {}}
    torso = M.vertex_mask(TORSO + ('Neck', 'Head'))
    tail_masks = [M.vertex_mask(('Tail_%02d' % i,), at_least=0.5) for i in range(1, 6)]
    ear_masks = {s: M.vertex_mask((sd('Ear', s),), at_least=0.3) for s in (1, -1)}

    def clear_tail(pose, floor=0.006, inc=3.0, limit=120.0):
        """Lifts the tail bone by bone (X) until none of its vertices is under the floor (it lies on its back)."""
        p = dict(pose)
        for i in range(1, 6):
            b = 'Tail_%02d' % i
            x0, y0, z0 = p.get(b, (0, 0, 0))
            x = x0
            while True:
                p[b] = (x, y0, z0)
                M.apply_pose(p)
                co = C.evaluated_coords(M.body)
                lo = min(co[m][:, 2].min() for m in tail_masks[i - 1:])
                if lo >= floor or abs(x - x0) >= limit:
                    break
                x += inc
        M.rig.rest_pose()
        bpy.context.view_layer.update()
        return p

    def tail_sway(p, t, period, amp=10.0, lift=0.0, lag=0.15):
        for i in range(1, 6):
            x0, y0, z0 = p.get('Tail_%02d' % i, (0, 0, 0))
            p['Tail_%02d' % i] = (x0 + lift * (1.0 - 0.15 * i), y0, z0 + amp * (0.4 + 0.25 * i) * wave(t, period, -lag * i))
        return p

    # ---------------------------------------------------------- Idle: rubs its hands, breathes, ears flick, the tail sways
    rub = sym({'UpperArm_L': (38, 0, -16), 'LowerArm_L': (62, 0, 0), 'Hand_L': (6, 0, 0), 'Fingers1_L': (12, 0, 0),
               'Fingers2_L': (10, 0, 0), 'Thumb_L': (10, 0, 0)})

    def idle(t):
        br = wave(t, 1.0)
        p = {'legs': {}}
        p.update(rub)
        p['Root.loc'] = (0.006 * wave(t, 2.0), 0.0, -0.004 + 0.003 * br)
        p['Hips'] = (2.0, 0, -2 * wave(t, 2.0))
        p['Spine'] = (4 + 1.5 * br, 0, 1 * wave(t, 2.0))
        p['Chest'] = (6 + 1.5 * br, 0, 1 * wave(t, 2.0))
        p['Neck'] = (-8, 0, 0)
        p['Head'] = (-6 + 3 * wave(t, 2.0, 0.3), 5 * wave(t, 2.0, 0.6), 6 * wave(t, 2.0, 0.1))
        p['Jaw'] = (-2 - 2 * max(0.0, wave(t, 1.0, 0.2)), 0, 0)
        # the rub: the hands slide past each other
        r = wave(t, 0.5)
        p['LowerArm_L'] = (62 + 5 * r, 0, 0)
        p['LowerArm_R'] = (62 - 5 * r, 0, 0)
        p['Ear_L'] = (4 * wave(t, 2.0, 0.2), 0, 12 * max(0.0, wave(t, 1.0, 0.1)) ** 4)
        p['Ear_R'] = (4 * wave(t, 2.0, 0.7), 0, -12 * max(0.0, wave(t, 1.0, 0.6)) ** 4)
        return tail_sway(p, t, 2.0, amp=8.0, lift=2.0)

    clips.append(Clip('Idle', 2.0, loop=True, fn=idle, shots=[0, 0.4, 0.8, 1.2, 1.6, 2.0]))

    # ---------------------------------------------------------- Move: a crouched scamper, arms swinging, the tail balancing
    T = 15 / 30.0
    S = 0.66
    duty = 0.45

    def move(t):
        u = t / T
        legs = {}
        for name, ph in (('L', 0.0), ('R', 0.5)):
            fwd, up, mode, sg = C.gait_foot(u - ph, duty, S, 0.075)
            dirs = None
            if mode == 'swing':
                k = math.sin(math.pi * sg)
                dirs = [None, (0.0, -math.cos(math.radians(40 * k)), -math.sin(math.radians(40 * k)))]
            legs[name] = ('ik', (0.0, -fwd, up), dirs)
        c2 = math.cos(4 * math.pi * u)
        s1 = math.sin(2 * math.pi * u)
        p = {'legs': legs, 'Root.loc': (0.0, 0.0, -0.035 + 0.018 * c2)}
        p['Hips'] = (8, 5 * s1, -4 * s1)
        p['Spine'] = (8, -2 * s1, 0)
        p['Chest'] = (8, -3 * s1, 2 * s1)
        p['Neck'] = (-14, 0, 0)
        p['Head'] = (-6 + 3 * c2, 3 * s1, -2 * s1)
        p['Jaw'] = (-4, 0, 0)
        p['UpperArm_L'] = (-30 * s1 + 10, 0, -6)
        p['UpperArm_R'] = (30 * s1 + 10, 0, 6)
        p['LowerArm_L'] = (40 + 15 * max(0, -s1), 0, 0)
        p['LowerArm_R'] = (40 + 15 * max(0, s1), 0, 0)
        p.update(sym({'Fingers1_L': (20, 0, 0), 'Fingers2_L': (20, 0, 0), 'Ear_L': (-6 + 4 * c2, 0, 14)}))
        return tail_sway(p, t, T, amp=10.0, lift=6.0, lag=0.12)

    clips.append(Clip('Move', T, loop=True, fn=move, speed=S / T, shots=[i / 30 for i in (0, 3, 5, 8, 10, 13)]))

    # ---------------------------------------------------------- Attack1 (Pilfer): crouch, dart, snatch, hug the prize
    k1 = step(N0, J({'Root.loc': (0, 0.06, -0.08), 'Hips': (14, 0, 0), 'Spine': (10, 0, 0), 'Chest': (8, 0, 0), 'Neck': (-18, 0, 0),
                     'Head': (-10, 0, 0), 'Jaw': (-6, 0, 0)},
                    sym({'UpperArm_L': (-25, 0, 10), 'LowerArm_L': (50, 0, 0), 'Fingers1_L': (30, 0, 0), 'Fingers2_L': (30, 0, 0),
                         'Ear_L': (-10, 0, 30)}),
                    {'Tail_01': (-10, 0, 0)}),
              legs={'L': ('ik', (0, 0.02, 0), None), 'R': ('ik', (0, 0.03, 0), None)})
    k2 = step(k1, J({'Root.loc': (0, -0.24, -0.03), 'Hips': (18, 0, 6), 'Spine': (10, 0, 6), 'Chest': (10, 0, 8),
                     'Neck': (-14, 0, 0), 'Head': (-8, -8, 0), 'Jaw': (-16, 0, 0),
                     'UpperArm_R': (95, 0, 8), 'LowerArm_R': (5, 0, 0), 'Hand_R': (-10, 0, 0), 'Fingers1_R': (-15, 0, 0),
                     'Fingers2_R': (-10, 0, 0), 'Thumb_R': (-10, 0, 0),
                     'UpperArm_L': (-35, 0, 16), 'LowerArm_L': (40, 0, 0), 'Tail_01': (20, 0, 0), 'Tail_02': (10, 0, 0)}),
              legs={'L': ('ik', (0, -0.20, 0), None), 'R': ('ik', (0, -0.10, 0), None)})
    k3 = step(k2, J({'Root.loc': (0, -0.20, -0.05), 'UpperArm_R': (70, 0, -10), 'LowerArm_R': (70, 0, 0), 'Hand_R': (20, 0, 0),
                     'Fingers1_R': (75, 0, 0), 'Fingers2_R': (80, 0, 0), 'Thumb_R': (40, 0, 0), 'Jaw': (-4, 0, 0),
                     'Head': (-4, 6, 0)}))
    k4 = step(N0, J({'Root.loc': (0, -0.03, -0.03), 'Spine': (6, 0, 0), 'Chest': (8, 0, 0), 'Head': (-4, 8, 6), 'Jaw': (-10, 0, 0)},
                    sym({'UpperArm_L': (40, 0, -20), 'LowerArm_L': (90, 0, 0), 'Fingers1_L': (60, 0, 0), 'Fingers2_L': (70, 0, 0),
                         'Thumb_L': (30, 0, 0)})),
              legs={'L': ('ik', (0, -0.03, 0), None), 'R': ('ik', (0, -0.03, 0), None)})
    keys = [(0.0, N0, None), (0.24, k1, 'smooth'), (0.38, k2, 'in'), (0.50, k3, 'out'), (0.68, k4, 'smooth'), (0.90, N0, 'smooth')]
    clips.append(Clip('Attack1', 0.90, keys=keys, events={'hit': 0.38}, shots=[0, 0.24, 0.38, 0.5, 0.68, 0.9],
                      overlay=lambda t, p: tail_sway(p, t, 0.9, amp=6.0)))

    # ---------------------------------------------------------- Attack2 (Hex): up on its toes, hands thrust, fingers splayed, cackle
    a1 = step(N0, J({'Root.loc': (0, 0.03, -0.05), 'Spine': (10, 0, 0), 'Chest': (12, 0, 0), 'Head': (-4, 0, 0)},
                    sym({'UpperArm_L': (-20, 0, 20), 'LowerArm_L': (70, 0, 0), 'Fingers1_L': (60, 0, 0), 'Fingers2_L': (60, 0, 0),
                         'Ear_L': (-8, 0, 25)})))
    a2 = step(N0, J({'Root.loc': (0, -0.04, 0.03), 'Hips': (-4, 0, 0), 'Spine': (-6, 0, 0), 'Chest': (-6, 0, 0), 'Neck': (-4, 0, 0),
                     'Head': (-10, 0, 0), 'Jaw': (-30, 0, 0)},
                    sym({'UpperArm_L': (85, 0, -14), 'LowerArm_L': (10, 0, 0), 'Hand_L': (-20, 0, 0), 'Fingers1_L': (-20, 0, 0),
                         'Fingers2_L': (-12, 0, 0), 'Thumb_L': (-25, 0, 0), 'Ear_L': (15, 0, -20)}),
                    {'Tail_01': (25, 0, 0), 'Tail_02': (12, 0, 0)}),
              legs={'L': ('ik', (0, -0.02, 0), None), 'R': ('ik', (0, -0.02, 0), None)})
    a3 = step(a2, J({'Head': (-14, 6, 0), 'Jaw': (-22, 0, 0)}, sym({'UpperArm_L': (80, 0, -10)})))
    a4 = step(N0, J({'Spine': (8, 0, 0), 'Chest': (10, 0, 0), 'Head': (6, 0, 0), 'Jaw': (-18, 0, 0)},
                    sym({'UpperArm_L': (10, 0, 0), 'LowerArm_L': (60, 0, 0), 'Fingers1_L': (40, 0, 0), 'Ear_L': (0, 0, 10)})))
    a5 = step(a4, {'Head': (10, 0, 0), 'Jaw': (-6, 0, 0), 'Chest': (6, 0, 0)})
    keys = [(0.0, N0, None), (0.28, a1, 'smooth'), (0.46, a2, 'in'), (0.62, a3, 'out'), (0.78, a4, 'smooth'), (0.90, a5, 'smooth'),
            (1.10, N0, 'smooth')]
    clips.append(Clip('Attack2', 1.10, keys=keys, events={'release': 0.46}, shots=[0, 0.28, 0.46, 0.62, 0.84, 1.1],
                      overlay=lambda t, p: tail_sway(p, t, 1.1, amp=5.0)))

    # ---------------------------------------------------------- Hit: snapped back, ears flat, arms up
    h1 = step(N0, J({'Root.loc': (0, 0.06, 0.0), 'Hips': (-6, 0, 0), 'Spine': (-8, 0, 0), 'Chest': (-10, 0, 0), 'Neck': (-8, 0, 0),
                     'Head': (-14, -8, 6), 'Jaw': (-20, 0, 0)},
                    sym({'UpperArm_L': (30, 0, 30), 'LowerArm_L': (70, 0, 0), 'Fingers1_L': (-15, 0, 0), 'Ear_L': (-20, 0, 40)}),
                    {'Tail_01': (30, 0, 0), 'Tail_02': (15, 0, 0)}),
              legs={'L': ('ik', (0, 0.03, 0), None, 'slide'), 'R': ('ik', (0, 0.03, 0), None, 'slide')})
    h2 = step(h1, J({'Root.loc': (0, 0.03, 0.0), 'Spine': (0, 0, 0), 'Chest': (0, 0, 0), 'Head': (-4, -4, 2), 'Jaw': (-8, 0, 0)},
                    sym({'UpperArm_L': (15, 0, 12), 'LowerArm_L': (40, 0, 0), 'Ear_L': (-8, 0, 20)})))
    keys = [(0.0, N0, None), (0.08, h1, 'out'), (0.24, h2, 'smooth'), (0.50, N0, 'smooth')]
    clips.append(Clip('Hit', 0.50, keys=keys, shots=[0, 0.08, 0.16, 0.24, 0.36, 0.5]))

    # ---------------------------------------------------------- Death: a stumble back, the knees go, it falls on its back
    d1 = step(N0, J({'Root.loc': (0, 0.06, 0.0), 'Spine': (-10, 0, 0), 'Chest': (-10, 0, 0), 'Head': (-16, 10, 0), 'Jaw': (-26, 0, 0)},
                    sym({'UpperArm_L': (35, 0, 35), 'LowerArm_L': (60, 0, 0), 'Ear_L': (-20, 0, 40)})),
              legs={'L': ('ik', (0, 0.06, 0), None), 'R': ('ik', (0, 0.0, 0), None)})
    sag = {'UpperLeg_L': (70, 0, -8), 'LowerLeg_L': (-110, 0, 0), 'Foot_L': (50, 0, 0), 'Toes_L': (10, 0, 0)}
    d2 = step(d1, J({'Root.loc': (0, 0.10, -0.15), 'Hips': (-20, 0, 0), 'Spine': (-6, 0, 0), 'Head': (-10, 14, 0)},
                    sym({'UpperArm_L': (50, 0, 45), 'LowerArm_L': (40, 0, 0)})),
              legs={'L': ('fk', sag), 'R': ('fk', {k.replace('_L', '_R'): (x, -y, -z) for k, (x, y, z) in sag.items()})})
    dead_l = {'UpperLeg_L': (55, 0, 18), 'LowerLeg_L': (-55, 0, 0), 'Foot_L': (35, 0, 0), 'Toes_L': (0, 0, 0)}
    dead_r = {'UpperLeg_R': (12, 0, -22), 'LowerLeg_R': (-12, 0, 0), 'Foot_R': (20, 0, 0), 'Toes_R': (0, 0, 0)}
    d3 = step(d2, J({'Root': (88, 0, 0), 'Root.loc': (0, 0.30, 0.0), 'Hips': (0, 0, 0), 'Spine': (-4, 0, 0), 'Chest': (-4, 0, 0),
                     'Neck': (-6, 0, 0), 'Head': (-14, 30, 0), 'Jaw': (-22, 0, 0)},
                    sym({'UpperArm_L': (6, 0, 82), 'LowerArm_L': (30, 0, 0), 'Fingers1_L': (25, 0, 0), 'Fingers2_L': (30, 0, 0),
                         'Ear_L': (-10, 0, 10)}),
                    {'Tail_01': (-20, 0, 10), 'Tail_02': (-10, 0, 14), 'Tail_03': (-6, 0, 10), 'Tail_04': (0, 0, 6)}),
              legs={'L': ('fk', dead_l), 'R': ('fk', dead_r)})
    d3 = M.ground(d3, mask=torso, keep_x=True, lift=0.004)
    d3 = clear_tail(d3)
    for s in (1, -1):
        d3 = P.clear_floor(M, d3, sd('Ear', s), [ear_masks[s]], channel=0)
        d3 = P.clear_floor(M, d3, sd('Ear', s), [ear_masks[s]], channel=2)
    d4 = step(d3, {'Root.loc': tuple(Vector(d3['Root.loc']) + Vector((0, 0, 0.02)))})
    d5 = step(d3, {'Jaw': (-12, 0, 0), 'Fingers1_R': (40, 0, 0), 'Fingers2_R': (50, 0, 0)})
    keys = [(0.0, N0, None), (0.12, d1, 'out'), (0.36, d2, 'smooth'), (0.62, d3, 'in'), (0.72, d4, 'out'), (0.84, d3, 'in'),
            (1.2, d5, 'smooth'), (1.6, d3, 'smooth')]
    clips.append(Clip('Death', 1.60, keys=keys, events={'down': 0.62}, shots=[0, 0.12, 0.36, 0.62, 1.2, 1.6]))
    return clips


# ====================================================================== variants
def variants():
    return [
        dict(id='pet-vault-imp', name='Vault Imp (pet)', scale=0.6, parts=['imp_satchel'], shapes={}, clipSpeed=1.2,
             role='pet', pet='vault-imp', palette=C.content_palette('vault-imp', pet=True), slots={},
             clipMap={'Pilfer': 'Attack1', 'Hex': 'Attack2'}),
    ]


# ====================================================================== main
def main():
    C.log('build_imp: quick=%s' % QUICK)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = C.FPS
    M = P.PetBase(BASE, quick=QUICK)
    M.view = dict(az=40.0, el=10.0)
    M.card_view = dict(az=32.0, el=12.0)
    M.lineup_yaw = -30.0
    M.fight = dict(girth=0.6, count=1)
    M.rig = CRig('Rig', bone_table(), legs=LEGS, loc_bones=('Root',))
    body, parts = build_geometry(M.rig)
    M.body = body
    M.parts = parts
    M.variants = variants()
    co = C.evaluated_coords(body)
    lo, hi = co.min(0), co.max(0)
    C.log('imp_body: %d tris, %d verts; rest bounds x %.3f..%.3f y %.3f..%.3f z %.3f..%.3f' % (
        body['tris'], len(body.data.vertices), lo[0], hi[0], lo[1], hi[1], lo[2], hi[2]))
    for nm, ob in parts.items():
        C.log('%s: %d tris' % (nm, ob['tris']))
    for v in M.variants:
        C.log('variant %-16s x%.2f  %d tris  palette %s' % (v['id'], v['scale'], M.tris_of(v), v['palette']))
    M.clips = author(M.rig, M)
    M.bake_clips()
    M.check_clips()
    M.lines.append('')
    M.lines.append('- location keys on: %s' % ', '.join(M.location_channels()))
    M.lines.append('- imp_body %d tris; parts %s' % (body['tris'], ', '.join('%s %d' % (n, o['tris']) for n, o in parts.items())))
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
        C.log('imp.glb %.1f KB' % kb)
        C.save_blend(os.path.join(C.BUILD, 'monsters_imp.blend'))
        lines = M.reimport(path)
        for line in lines:
            C.log(line)
        M.write_lines(['', '## re-import', ''] + lines)
    else:
        C.save_blend(os.path.join(C.BUILD, 'monsters_imp.blend'))


if __name__ == '__main__':
    main()

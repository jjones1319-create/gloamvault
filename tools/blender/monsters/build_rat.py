"""build_rat.py — the rat base (06 §3.5): Giant Rat, Plague Rat, Warren Alpha, Old Gnaw and the Rat Prince pet.

Run:  blender -b -P tools/blender/monsters/build_rat.py -- [--quick] [--no-renders] [--no-export] [--only Idle,Move]

A fat, hunched cellar rat 0.57 m at the hunch (scale 1 = the Giant Rat): a metaball body (creature_lib), a bare
tail, big cupped ears, beady eyes, a separate lower jaw that opens on a dark mouth, yellow incisors, leaf-like fur clumps
swept back along the spine and cheeks. Rig (27 bones): Root · Hips · Spine · Chest · Neck · Head · Jaw · Ear_L/R ·
Tail_01..06 · per side Front_Upper / Front_Lower / Front_Paw and Hind_Upper / Hind_Lower / Hind_Foot.

Variants (manifest.json): var_belly + rat_boils (the Plague Rat's swollen, glowing belly); rat_ridge (the Warren
Alpha's raised ridge and flank scars); var_bald + var_one_eye + rat_scars (Old Gnaw); var_bald 0.6 + rat_crown (the
Rat Prince pet). Clips: Idle, Move (trot), Flee (half-bound gallop), Attack1 (bite), Attack2 (rear and pounce), Hit,
Death.

Outputs: client/public/models/monsters/rat.glb, the `rat` key of clips.json, the rat entries of manifest.json,
art/renders/monsters/rat/*.png, art/build/monsters_rat.blend, art/build/monsters_rat_checks.txt.
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
BASE = 'rat'
BUDGET = 2500          # the Giant Rat's visual.triBudget (the body mesh alone)
RES = 0.005            # metaball resolution (m)

UP = (0, 0, 1)
FWD = (0, -1, 0)
HL = 0.13              # the hind legs' plane (x)
FL = 0.11              # the front legs' plane
TAIL = [(0, 0.47, 0.22), (0, 0.61, 0.165), (0, 0.76, 0.11), (0, 0.91, 0.068), (0, 1.06, 0.042), (0, 1.21, 0.027),
        (0, 1.35, 0.021)]
TORSO = ('Hips', 'Spine', 'Chest')


def sd(name, s):
    return name + ('_L' if s > 0 else '_R')


def bone_table():
    b = [
        ('Root', None, (0, 0, 0), (0, -0.15, 0), UP),
        ('Hips', 'Root', (0, 0.28, 0.30), (0, 0.06, 0.38), UP),
        ('Spine', 'Hips', (0, 0.06, 0.38), (0, -0.13, 0.36), UP),
        ('Chest', 'Spine', (0, -0.13, 0.36), (0, -0.27, 0.31), UP),
        ('Neck', 'Chest', (0, -0.27, 0.31), (0, -0.37, 0.30), UP),
        ('Head', 'Neck', (0, -0.37, 0.30), (0, -0.68, 0.20), UP),
        ('Jaw', 'Head', (0, -0.42, 0.235), (0, -0.62, 0.172), UP),
    ]
    for i in range(6):
        b.append(('Tail_%02d' % (i + 1), 'Hips' if i == 0 else 'Tail_%02d' % i, TAIL[i], TAIL[i + 1], UP))
    for s in (1, -1):
        b += [
            (sd('Ear', s), 'Head', (s * 0.07, -0.42, 0.37), (s * 0.115, -0.41, 0.47), FWD),
            (sd('Front_Upper', s), 'Chest', (s * FL, -0.21, 0.20), (s * FL, -0.15, 0.115), FWD),
            (sd('Front_Lower', s), sd('Front_Upper', s), (s * FL, -0.15, 0.115), (s * FL, -0.22, 0.038), FWD),
            (sd('Front_Paw', s), sd('Front_Lower', s), (s * FL, -0.22, 0.038), (s * FL, -0.30, 0.022), UP),
            (sd('Hind_Upper', s), 'Hips', (s * HL, 0.27, 0.22), (s * HL, 0.17, 0.13), FWD),
            (sd('Hind_Lower', s), sd('Hind_Upper', s), (s * HL, 0.17, 0.13), (s * HL, 0.29, 0.042), FWD),
            (sd('Hind_Foot', s), sd('Hind_Lower', s), (s * HL, 0.29, 0.042), (s * HL, 0.11, 0.026), UP),
        ]
    return b


LEGS = [
    Leg('FL', ('Front_Upper_L', 'Front_Lower_L'), ('Front_Paw_L',), bend=-1, abduct=30.0),
    Leg('FR', ('Front_Upper_R', 'Front_Lower_R'), ('Front_Paw_R',), bend=-1, abduct=30.0),
    Leg('HL', ('Hind_Upper_L', 'Hind_Lower_L'), ('Hind_Foot_L',), bend=1, abduct=30.0),
    Leg('HR', ('Hind_Upper_R', 'Hind_Lower_R'), ('Hind_Foot_R',), bend=1, abduct=30.0),
]


# ====================================================================== body
def body_elements(belly=1.0):
    """The body's metaball elements (left side mirrored). belly > 1 swells the belly (the Plague Rat's key)."""
    k = belly - 1.0
    el = [
        ellipsoid((0, 0.29, 0.29), (0.18, 0.17, 0.17), bone='Hips', tag='rump'),
        ellipsoid((0, 0.10, 0.36), (0.20 * (1 + 0.06 * k), 0.23, 0.21), bone={'Hips': 0.55, 'Spine': 0.45}, tag='loins'),
        ellipsoid((0, -0.01 + 0.02 * k, 0.235 - 0.05 * k), (0.18 * (1 + 0.30 * k), 0.20 * (1 + 0.30 * k), 0.15 * (1 + 0.45 * k)),
                  bone='Spine', tag='belly'),
        ellipsoid((0, -0.18, 0.28), (0.15, 0.16, 0.155), bone='Chest', tag='chest'),
        ellipsoid((0, -0.30, 0.30), (0.115, 0.09, 0.11), bone='Neck', tag='neck'),
        ellipsoid((0, -0.41, 0.30), (0.105, 0.11, 0.095), bone='Head', tag='cranium'),
        ball((0.055, -0.46, 0.265), 0.06, bone='Head', tag='cheek_L'),
        capsule((0, -0.45, 0.255), (0, -0.59, 0.215), 0.055, bone='Head', tag='snout'),
        ball((0, -0.635, 0.205), 0.036, bone='Head', tag='muzzle'),
        ball((0, -0.668, 0.200), 0.022, bone='Head', slot=SECOND, tag='nose'),
        # hind legs: a big round haunch, a thick shin, a long flat pink foot with three toes
        ellipsoid((0.11, 0.23, 0.21), (0.085, 0.14, 0.12), bone={'Hind_Upper_L': 0.75, 'Hips': 0.25}, tag='haunch_L'),
        capsule((HL, 0.175, 0.13), (HL, 0.285, 0.05), 0.04, bone='Hind_Lower_L', tag='shin_L'),
        capsule((HL, 0.285, 0.036), (HL, 0.135, 0.026), 0.027, bone='Hind_Foot_L', slot=SECOND, tag='hfoot_L'),
        ball((HL + 0.021, 0.108, 0.019), 0.017, bone='Hind_Foot_L', slot=SECOND, tag='htoe1_L'),
        ball((HL, 0.102, 0.019), 0.018, bone='Hind_Foot_L', slot=SECOND, tag='htoe2_L'),
        ball((HL - 0.021, 0.108, 0.019), 0.017, bone='Hind_Foot_L', slot=SECOND, tag='htoe3_L'),
        # front legs: shoulder, a short thick forearm, a small hand-like paw
        ellipsoid((0.095, -0.20, 0.20), (0.065, 0.08, 0.085), bone={'Front_Upper_L': 0.6, 'Chest': 0.4}, tag='shoulder_L'),
        capsule((FL, -0.15, 0.11), (FL, -0.215, 0.045), 0.032, bone='Front_Lower_L', tag='forearm_L'),
        capsule((FL, -0.22, 0.032), (FL, -0.28, 0.022), 0.022, bone='Front_Paw_L', slot=SECOND, tag='fpaw_L'),
        ball((FL + 0.017, -0.293, 0.015), 0.014, bone='Front_Paw_L', slot=SECOND, tag='ftoe1_L'),
        ball((FL, -0.299, 0.015), 0.014, bone='Front_Paw_L', slot=SECOND, tag='ftoe2_L'),
        ball((FL - 0.017, -0.293, 0.015), 0.014, bone='Front_Paw_L', slot=SECOND, tag='ftoe3_L'),
    ]
    return C.with_mirror(el)


def jaw_elements():
    return [
        capsule((0, -0.44, 0.214), (0, -0.60, 0.178), 0.035, bone='Jaw', tag='jaw'),
        ball((0, -0.615, 0.174), 0.025, bone='Jaw', tag='chin'),
    ]


def eye_place(elems, s, r):
    origin = Vector((s * 0.02, -0.48, 0.295))
    d = Vector((s * 1.0, -0.66, 0.45)).normalized()
    p = C.surface_point(elems, origin, d, reach=0.3)
    return p - d * (0.4 * r), d


def ear_frame(s):
    face = Vector((s * 0.50, -0.86, 0.08)).normalized()     # the cup opens forward and out
    up = Vector((s * 0.32, 0.10, 0.94)).normalized()
    up = (up - face * up.dot(face)).normalized()
    x = up.cross(face)
    return Matrix((x, face, up)).transposed(), face


def build_geometry(rig):
    body_el = body_elements()
    jaw_el = jaw_elements()
    att = Geo()      # attachments first: their triangles set the body's budget
    eyes = {}
    for s in (1, -1):
        r = 0.0175
        c, d = eye_place(body_el, s, r)
        V, F, N = C.uv_sphere(tuple(c), r, rings=5, segs=7, rot=d.to_track_quat('Z', 'Y'))
        keys = {'var_one_eye': (np.array(c) - V) if s > 0 else np.zeros_like(V)}
        att.add(V, F, ACCENT, N, {'Head': 1.0}, name=sd('eye', s), keys=keys)
        eyes[s] = (c, d)
    for s in (1, -1):
        base = C.surface_point(body_el, (s * 0.035, -0.42, 0.33), (s * 0.5, 0.05, 1.0), reach=0.3)
        R, face = ear_frame(s)
        c = base + Vector((s * 0.014, 0.006, 0.05))
        rw, rt, rh = 0.072, 0.012, 0.078
        V, F, N = C.uv_sphere((0, 0, 0), (rw, rt, rh), rings=6, segs=8)
        Vl = np.array(V)
        front = Vl[:, 1] < 0
        rr = (Vl[:, 0] / rw) ** 2 + (Vl[:, 2] / rh) ** 2
        Vl[front, 1] += 0.016 * np.clip(1 - rr[front], 0, 1)          # cup the front
        Vl[:, 1] += 0.010 * (Vl[:, 2] / rh) ** 2                        # and curl the rim back a little
        Rm = np.array(R)
        Vw = Vl @ Rm.T + np.array(c)
        Nw = C.vertex_normals(Vw, F)
        slots = []
        for k, f in enumerate(F):
            cen = np.array(V)[list(f)].mean(0)
            slots.append(SECOND if cen[1] < -0.003 else MAIN)
        att.add(Vw, F, slots, Nw, {sd('Ear', s): 0.85, 'Head': 0.15}, name=sd('ear', s))
    for s in (1, -1):
        top = (s * 0.0078, -0.643, 0.188)
        bot = (s * 0.0078, -0.650, 0.150)
        V, F, N, _ = C.tube([top, bot], [0.0072, 0.006], sides=4, cap0='flat', cap1='flat', up=(0, -1, 0),
                            flat=[(0.65, 1.0), (0.65, 1.0)], phase=math.pi / 4)
        att.add(V, F, BONE, None, {'Head': 1.0}, name=sd('tooth_up', s))
        V, F, N, _ = C.tube([(s * 0.006, -0.612, 0.180), (s * 0.006, -0.628, 0.203)], [0.0052, 0.0042], sides=4,
                            cap0='flat', cap1='flat', up=(0, -1, 0), flat=[(0.65, 1.0), (0.65, 1.0)], phase=math.pi / 4)
        att.add(V, F, BONE, None, {'Jaw': 1.0}, name=sd('tooth_lo', s))
    # (no claws: at 2-3 mm on a toe the remesh rounds away, they floated in front of the paws — round 4)
    ctrl = [(0, 0.39, 0.26)] + TAIL
    n_ring = 13
    P = C.curve_points(ctrl, n_ring)
    rad = np.interp(np.linspace(0, 1, n_ring), [0, 0.07, 0.3, 1.0], [0.046, 0.039, 0.027, 0.006])
    V, F, N, ring = C.tube(P, rad, sides=7, cap0='flat', cap1='point', up=(0, 0, 1))
    chain = ['Tail_%02d' % i for i in range(1, 7)]
    att.add(V, F, SECOND, N, tail_weights(rig, V, chain), name='tail')
    # fur clumps: along the spine, on the cheeks and the throat (they sink into the skin with var_bald)
    tufts = []
    back_y = [-0.27, -0.12, 0.03, 0.17, 0.31]
    for i, y in enumerate(back_y):
        x = 0.02 * (1 if i % 2 else -1)
        p = C.surface_point(body_el, (x, y, 0.27), (x * 6, 0.05, 1.0), reach=0.4)
        n = C.field_normals(np.array([p]), body_el)[0]
        ln = 0.075 + 0.025 * math.sin(math.pi * (i + 1) / (len(back_y) + 1))
        tufts.append(C.clump(p, n, (x * 4, 1.0, 0.1), ln, 0.036, bend=0.6, flat=0.42, lift=0.8))
    for s in (1, -1):
        for (y, z, ln) in ((-0.455, 0.255, 0.05), (-0.41, 0.225, 0.042)):
            p = C.surface_point(body_el, (0, y, z), (s * 1.0, 0.1, -0.2), reach=0.3)
            n = C.field_normals(np.array([p]), body_el)[0]
            tufts.append(C.clump(p, n, (s * 0.2, 1.0, -0.3), ln, 0.026, bend=0.8, flat=0.4, lift=0.6))
    for x in (0.03, -0.03):
        p = C.surface_point(body_el, (x, -0.27, 0.26), (x * 3, -0.35, -1.0), reach=0.3)
        n = C.field_normals(np.array([p]), body_el)[0]
        tufts.append(C.clump(p, n, (0, 0.5, -1.0), 0.045, 0.026, bend=0.8, flat=0.4, lift=0.6))
    att_tris = att.tris() + sum(sum(len(f) - 2 for f in F) for _, F, _, _ in tufts)
    jaw_tris = 110
    body_tris = BUDGET - att_tris - jaw_tris - 30
    # ---------------------------------------------------------------- the implicit body and jaw
    V, F, N = C.implicit_mesh(body_el, RES, body_tris, name='rat_mb_body')
    W = C.field_weights(V, body_el, power=2.0)
    dom = C.dominant(np.array([V[list(f)].mean(0) for f in F]), body_el)
    slots = [body_el[j].slot for j in dom]
    FN = C.face_normals(V, F)
    for k, f in enumerate(F):
        c = V[list(f)].mean(0)
        if c[1] < -0.465 and FN[k][2] < -0.45 and abs(c[0]) < 0.036 and c[2] < 0.228:
            slots[k] = INK                         # the roof of the mouth (shows when the jaw drops)
    belly_el = body_elements(belly=1.6)
    Vb = C.project(V, belly_el)
    geo = Geo()
    geo.add(V, F, slots, N, W, name='body', keys={'var_belly': Vb - V})
    body_V, body_W = V, W
    Vj, Fj, Nj = C.implicit_mesh(jaw_el, RES * 0.8, jaw_tris, name='rat_mb_jaw')
    FNj = C.face_normals(Vj, Fj)
    sj = [INK if (FNj[k][2] > 0.35 and Vj[list(f)].mean(0)[1] < -0.45) else MAIN for k, f in enumerate(Fj)]
    geo.add(Vj, Fj, sj, Nj, {'Jaw': 1.0}, name='jaw')
    Va, Na = att.arrays()
    for nm, off, n in att.pieces:
        fs = [tuple(i - off for i in f) for f in att.F if off <= f[0] < off + n]
        ss = [s for f, s in zip(att.F, att.S) if off <= f[0] < off + n]
        keys = {k: d[off] for k, d in att.keys.items() if off in d}
        geo.add(Va[off:off + n], fs, ss, Na[off:off + n], att.W[off:off + n], name=nm, keys=keys)
    for V2, F2, N2, b0 in tufts:
        geo.add(V2, F2, MAIN, N2, C.weights_from(V2, body_V, body_W, k=4), name='tuft', keys={'var_bald': (b0 - V2) * 0.96})
    body = C.make_object(geo, 'rat_body', rig.ob, key_names=['var_belly', 'var_bald', 'var_one_eye'])
    body['kind'] = 'body'
    body['base'] = BASE
    parts = {
        'rat_ridge': build_ridge(rig, body_el, body_V, body_W),
        'rat_boils': build_boils(rig, belly_el, V, F, Vb, body_W),
        'rat_scars': build_scars(rig, body_el, body_V, body_W, eyes),
        'rat_crown': build_crown(rig, body_el),
    }
    for nm, ob in parts.items():
        ob['kind'] = 'part'
        ob['base'] = BASE
        ob['part'] = nm
    return body, parts


def tail_weights(rig, V, chain, blend=0.4):
    out = []
    for p in V:
        p = Vector(p)
        best = None
        for i, b in enumerate(chain):
            h, t = rig.head[b], rig.tail[b]
            d = t - h
            u = max(0.0, min(1.0, (p - h).dot(d) / d.length_squared))
            dist = (h + d * u - p).length
            if best is None or dist < best[0] - 1e-9:
                best = (dist, i, u)
        _, i, u = best
        w = {chain[i]: 1.0}
        if u < blend:
            k = 0.5 * (1 - u / blend)
            prev = chain[i - 1] if i > 0 else 'Hips'
            w = {chain[i]: 1 - k, prev: k}
        elif u > 1 - blend and i < len(chain) - 1:
            k = 0.5 * (1 - (1 - u) / blend)
            w = {chain[i]: 1 - k, chain[i + 1]: k}
        if p.y < 0.45:
            w = {'Hips': 1.0}
        out.append(w)
    return out


def build_ridge(rig, el, bV, bW):
    """The Warren Alpha's ridge of raised fur (tall swept clumps from the neck to the rump) and pink flank scars."""
    g = Geo()
    ys = [-0.32, -0.24, -0.15, -0.06, 0.03, 0.12, 0.21, 0.30, 0.38]
    for i, y in enumerate(ys):
        p = C.surface_point(el, (0, y, 0.27), (0, 0.05, 1.0), reach=0.4)
        n = C.field_normals(np.array([p]), el)[0]
        h = 0.11 + 0.06 * math.sin(math.pi * (i + 0.5) / len(ys))
        for k, sx in enumerate((0.0, 1.0, -1.0)):
            off = Vector((sx * 0.026, 0.014 * abs(sx), -0.008 * abs(sx)))
            nn = Vector(n) + Vector((sx * 0.5, 0, 0))
            V, F, N, b0 = C.clump(p + off, nn, (sx * 0.1, 1.0, 0.0), h * (1.0 if k == 0 else 0.7), 0.034 if k == 0 else 0.028,
                                  sides=5, bend=0.55, flat=0.45, lift=0.85)
            g.add(V, F, MAIN, N, C.weights_from(V, bV, bW, k=4), name='spike')
    for s in (1, -1):
        for (y0, z0, y1, z1) in ((0.02, 0.43, 0.14, 0.31), (-0.11, 0.39, -0.01, 0.27), (0.21, 0.40, 0.30, 0.30)):
            pts = []
            for u in np.linspace(0, 1, 6):
                y = y0 + (y1 - y0) * u
                z = z0 + (z1 - z0) * u
                pts.append(C.surface_point(el, (0, y, z), (s, 0.0, 0.15), reach=0.4))
            pts = [Vector(p) + Vector(C.field_normals(np.array([p]), el)[0]) * 0.002 for p in pts]
            V, F, N, _ = C.tube(pts, [0.006, 0.01, 0.01, 0.01, 0.009, 0.005], sides=5, cap0='point', cap1='point')
            g.add(V, F, SECOND, N, C.weights_from(V, bV, bW, k=4), name='scar')
    return C.make_object(g, 'rat_ridge', rig.ob)


def build_boils(rig, el, V, F, Vb, bW):
    """The Plague Rat's swollen belly: a glowing, blotchy skin over the var_belly surface and pustules on it."""
    g = Geo()
    Nb = C.field_normals(Vb, el)
    keep = []
    for f in F:
        c = V[list(f)].mean(0)
        ang = math.atan2(c[0], c[1] + 0.02)
        edge = 0.235 + 0.014 * math.sin(5 * ang) + 0.006 * math.sin(11 * ang + 1.0)
        if c[2] < edge and -0.215 < c[1] < 0.27 and abs(c[0]) < 0.30:
            keep.append(f)
    used = sorted({i for f in keep for i in f})
    remap = {v: k for k, v in enumerate(used)}
    Vs = Vb[used] + Nb[used] * 0.004
    Fs = [tuple(remap[i] for i in f) for f in keep]
    g.add(Vs, Fs, GLOW, Nb[used], [bW[i] for i in used], name='belly')
    spots = [((0.6, 0.0, -0.8), 0.036), ((-0.6, 0.05, -0.8), 0.034), ((0.95, 0.15, -0.3), 0.032), ((-0.95, -0.12, -0.3), 0.034),
             ((0.8, -0.35, -0.45), 0.026), ((-0.75, 0.3, -0.55), 0.028), ((0.2, -0.2, -1.0), 0.026), ((0.9, 0.45, 0.05), 0.024),
             ((-0.85, 0.42, 0.05), 0.022)]
    for d, r in spots:
        p = C.surface_point(el, (0, 0.02, 0.24), d, reach=0.5)
        n = Vector(C.field_normals(np.array([p]), el)[0])
        Vx, Fx, Nx = C.uv_sphere(tuple(p + n * (r * 0.3)), (r, r, r * 0.8), rings=5, segs=7, rot=n.to_track_quat('Z', 'Y'))
        g.add(Vx, Fx, GLOW, Nx, C.weights_from(Vx, Vb, bW, k=4), name='boil')
    return C.make_object(g, 'rat_boils', rig.ob)


def build_scars(rig, el, bV, bW, eyes):
    """Old Gnaw's scars: pale raised seams across the bald back and one over the lost left eye."""
    g = Geo()
    seams = [((-0.30, 0.25), (-0.16, -0.25)), ((-0.12, 0.3), (0.05, -0.3)), ((0.05, -0.3), (0.21, 0.3)),
             ((0.21, -0.25), (0.37, 0.22)), ((0.30, 0.35), (0.42, -0.05))]
    for (y0, x0), (y1, x1) in seams:
        pts = []
        for j, u in enumerate(np.linspace(0, 1, 9)):
            y = y0 + (y1 - y0) * u + (0.012 if j % 2 else -0.012)
            x = x0 + (x1 - x0) * u
            pts.append(C.surface_point(el, (0, y, 0.27), (x * 2.2, 0.0, 1.0), reach=0.4))
        pts = [Vector(p) + Vector(C.field_normals(np.array([p]), el)[0]) * 0.002 for p in pts]
        V, F, N, _ = C.tube(pts, [0.005, 0.008, 0.009, 0.009, 0.009, 0.009, 0.009, 0.008, 0.005], sides=4, cap0='point',
                            cap1='point')
        g.add(V, F, BONE, N, C.weights_from(V, bV, bW, k=4), name='seam')
    c, d = eyes[1]
    up = Vector((0, 0, 1))
    t = d.cross(up).normalized()
    pts = []
    for u in np.linspace(-1, 1, 7):
        q = c + t * (0.045 * u) + up * (0.05 * u) + d * 0.03
        pts.append(C.surface_point(el, tuple(q - d * 0.08), tuple(d), reach=0.2) + d * 0.002)
    V, F, N, _ = C.tube(pts, [0.005, 0.009, 0.011, 0.012, 0.011, 0.009, 0.005], sides=5, cap0='point', cap1='point')
    g.add(V, F, BONE, N, {'Head': 1.0}, name='eye_scar')
    return C.make_object(g, 'rat_scars', rig.ob)


def build_crown(rig, el):
    """The Rat Prince's tin crown, tipped rakishly between the ears."""
    g = Geo()
    top = C.surface_point(el, (0, -0.41, 0.30), (0.0, 0.1, 1.0), reach=0.3)
    c = Vector(top) + Vector((0.0, 0.0, -0.008))
    tilt = Matrix.Rotation(math.radians(14), 3, 'Y') @ Matrix.Rotation(math.radians(-8), 3, 'X')
    segs, r_out, t, h = 12, 0.07, 0.009, 0.045
    V = []
    F = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        for rr, z in ((r_out, 0), (r_out, h), (r_out - t, h), (r_out - t, 0)):
            V.append((rr * math.cos(a), rr * math.sin(a), z))
    for i in range(segs):
        j = (i + 1) % segs
        for k in range(4):
            k2 = (k + 1) % 4
            F.append((i * 4 + k, j * 4 + k, j * 4 + k2, i * 4 + k2))
    V = np.array(V)
    for i in range(5):
        a = 2 * math.pi * i / 5 + 0.3
        base = np.array((r_out * 0.95 * math.cos(a), r_out * 0.95 * math.sin(a), h - 0.002))
        Vc, Fc, Nc = C.cone(tuple(base), tuple(base + np.array((0.006 * math.cos(a), 0.006 * math.sin(a), 0.05))), 0.013, sides=4)
        F += [tuple(x + len(V) for x in f) for f in Fc]
        V = np.concatenate([V, Vc])
    V = V @ np.array(tilt).T + np.array(c)
    g.add(V, F, ACCENT, None, {'Head': 1.0}, name='crown')
    return C.make_object(g, 'rat_crown', rig.ob)


# ====================================================================== clips
def tail_sway(p, t, period, amp=10.0, lift=0.0, lag=0.09, x_amp=2.0):
    for i in range(1, 7):
        k = i / 6
        x0, y0, z0 = p.get('Tail_%02d' % i, (0, 0, 0))
        p['Tail_%02d' % i] = (x0 + lift * (1 - k) + x_amp * (0.6 + 0.5 * wave(t, period, -lag * i + 0.25)),
                              y0, z0 + amp * (0.4 + k) * wave(t, period, -lag * i))
    return p


def foot_dirs(rig, leg, mode, s):
    end = rig.leg[leg].ends[0]
    R = rig.rest_dir[end]
    front = leg[0] == 'F'
    if mode == 'stance':
        phi = 0.0 if s < 0.5 else (45.0 if front else 35.0) * C.smooth((s - 0.5) / 0.5)
    else:
        top = 95.0 if front else 55.0
        start = 45.0 if front else 35.0
        phi = start + (top - start) * C.smooth(min(1, s / 0.35)) if s < 0.35 else top * (1 - C.smooth((s - 0.35) / 0.65))
    return [tuple(C.rot_about(R, (1, 0, 0), math.radians(phi)))]


def gait(rig, t, T, stride, duty, phases, lift_f, lift_h):
    legs = {}
    for name, ph in phases.items():
        fwd, up, mode, s = C.gait_foot(t / T - ph, duty, stride, lift_f if name[0] == 'F' else lift_h)
        legs[name] = ('ik', (0.0, -fwd, up), foot_dirs(rig, name, mode, s))
    return legs


def author(rig, M):
    clips = []
    N0 = {'legs': {}}
    torso = M.vertex_mask(TORSO)

    # ---------------------------------------------------------- Idle (2 s loop): breathing, sniffing, a look round
    def idle(t):
        br = wave(t, 1.0)
        burst = max(0.0, wave(t, 2.0, 0.05)) ** 2
        sniff = wave(t, 0.2) * burst
        look = wave(t, 2.0)
        p = {'legs': {}}
        p['Root.loc'] = (0.0, 0.0, 0.004 * br)
        p['Spine'] = (1.5 * br, 0, 0)
        p['Chest'] = (-1.2 * br, 0, 0)
        p['Neck'] = (3 * wave(t, 2.0, 0.25), 0, 7 * look)
        p['Head'] = (5 * sniff + 4 * wave(t, 2.0, 0.6), 5 * wave(t, 2.0, 0.3), 9 * look)
        p['Jaw'] = (-4 * burst * (0.5 + 0.5 * wave(t, 0.2, 0.25)), 0, 0)
        p['Ear_L'] = (8 * wave(t, 1.0, 0.1) + 6 * burst, 0, 4 * wave(t, 2.0, 0.4))
        p['Ear_R'] = (8 * wave(t, 1.0, 0.35), 0, -4 * wave(t, 2.0, 0.7))
        return tail_sway(p, t, 2.0, amp=9.0, x_amp=2.5)

    clips.append(Clip('Idle', 2.0, loop=True, fn=idle, shots=[0, 0.4, 0.8, 1.2, 1.6, 2.0]))

    # ---------------------------------------------------------- Move: a scurrying trot (diagonal pairs)
    T = 9 / 30.0
    S = 0.42

    def move(t):
        u = t / T
        legs = gait(rig, t, T, S, 0.5, {'HL': 0.0, 'FR': 0.0, 'HR': 0.5, 'FL': 0.5}, 0.05, 0.045)
        c2 = math.cos(4 * math.pi * u)
        s1 = math.sin(2 * math.pi * u)
        p = {'legs': legs, 'Root.loc': (0.0, 0.0, 0.002 - 0.008 * c2)}
        p['Hips'] = (1.5 * c2, 3 * s1, 4 * s1)
        p['Spine'] = (0, 0, -3 * s1)
        p['Chest'] = (-1.5 * c2, -2 * s1, -3 * s1)
        p['Neck'] = (5, 0, 2 * s1)
        p['Head'] = (-2 + 2 * c2, 0, 2 * s1)
        p['Ear_L'] = (-12 + 6 * c2, 0, 0)
        p['Ear_R'] = (-12 + 6 * c2, 0, 0)
        return tail_sway(p, t, T, amp=7.0, lift=6.0, x_amp=3.0, lag=0.12)

    clips.append(Clip('Move', T, loop=True, fn=move, speed=S / T, shots=[i / 30 for i in (0, 2, 3, 5, 6, 8)]))

    # ---------------------------------------------------------- Flee: a half-bound gallop, back flexing
    TG = 8 / 30.0
    SG = 0.62

    def flee(t):
        u = t / TG
        legs = gait(rig, t, TG, SG, 0.40, {'HL': 0.0, 'HR': 0.06, 'FL': 0.48, 'FR': 0.58}, 0.06, 0.065)
        flex = math.cos(2 * math.pi * (u - 0.1))
        p = {'legs': legs}
        p['Root.loc'] = (0.0, 0.0, 0.006 + 0.012 * math.sin(2 * math.pi * (u - 0.2)))
        p['Root'] = (3 * math.sin(2 * math.pi * (u + 0.15)), 0, 0)
        p['Hips'] = (7 * flex, 0, 0)
        p['Spine'] = (3 * flex, 0, 0)
        p['Chest'] = (-6 * flex, 0, 0)
        p['Neck'] = (6 - 3 * flex, 0, 0)
        p['Head'] = (-6 + 4 * flex, 0, 0)
        p['Ear_L'] = (-35, 0, 6)
        p['Ear_R'] = (-35, 0, -6)
        p['Jaw'] = (-6, 0, 0)
        for i in range(1, 7):
            p['Tail_%02d' % i] = ((16 if i == 1 else 4) - 3 * flex, 0, 0)
        return tail_sway(p, t, TG, amp=4.0, x_amp=6.0, lag=0.1)

    clips.append(Clip('Flee', TG, loop=True, fn=flee, speed=SG / TG, shots=[i / 30 for i in range(8)]))

    # ---------------------------------------------------------- Attack1: coil, spring, snap, shake
    tails_up = {'Tail_01': (14, 0, 0), 'Tail_02': (6, 0, 6), 'Tail_03': (4, 0, 10), 'Tail_04': (2, 0, 12)}
    k1 = step(N0, dict({'Root.loc': (0, 0.05, -0.028), 'Hips': (-3, 0, 0), 'Spine': (3, 0, 0), 'Chest': (-3, 0, 0),
                        'Neck': (-8, 0, 0), 'Head': (6, 0, 0), 'Jaw': (-12, 0, 0), 'Ear_L': (-28, 0, 0), 'Ear_R': (-28, 0, 0)},
                       **tails_up))
    k2 = step(k1, {'Root.loc': (0, -0.10, 0.0), 'Hips': (2, 0, 0), 'Spine': (-2, 0, 0), 'Chest': (4, 0, 0),
                   'Neck': (14, 0, 0), 'Head': (10, 0, 0), 'Jaw': (-46, 0, 0)})
    k3 = step(k2, {'Jaw': (0, 0, 0), 'Head': (6, 8, 14), 'Neck': (12, 0, 8)})
    k4 = step(k3, {'Head': (6, -8, -14), 'Neck': (10, 0, -8), 'Root.loc': (0, -0.075, 0.0)})
    keys = [(0.0, N0, None), (0.20, k1, 'smooth'), (0.30, k2, 'in'), (0.36, k3, 'out'), (0.47, k4, 'smooth'),
            (0.70, N0, 'smooth')]
    clips.append(Clip('Attack1', 0.70, keys=keys, events={'hit': 0.30}, shots=[0, 0.2, 0.3, 0.37, 0.47, 0.7],
                      overlay=lambda t, p: tail_sway(p, t, 0.7, amp=6)))

    # ---------------------------------------------------------- Attack2: rear up, pounce, pin and bite
    box_f = {'Front_Upper_L': (40, 0, -8), 'Front_Lower_L': (50, 0, 0), 'Front_Paw_L': (40, 0, 0),
             'Front_Upper_R': (40, 0, 8), 'Front_Lower_R': (50, 0, 0), 'Front_Paw_R': (40, 0, 0)}
    reach_f = {'Front_Upper_L': (75, 0, 0), 'Front_Lower_L': (-5, 0, 0), 'Front_Paw_L': (20, 0, 0),
               'Front_Upper_R': (75, 0, 0), 'Front_Lower_R': (-5, 0, 0), 'Front_Paw_R': (20, 0, 0)}
    r1 = step(N0, {'Root.loc': (0, 0.06, 0.0), 'Hips': (32, 0, 0), 'Spine': (6, 0, 0), 'Chest': (2, 0, 0),
                   'Neck': (-12, 0, 0), 'Head': (-10, 0, 0), 'Jaw': (-30, 0, 0), 'Ear_L': (-20, 0, 0), 'Ear_R': (-20, 0, 0),
                   'Tail_01': (34, 0, 0), 'Tail_02': (6, 0, 0), 'Tail_03': (4, 0, 0)},
              legs={'FL': ('fk', box_f), 'FR': ('fk', box_f)})
    r2 = step(r1, {'Root.loc': (0, -0.12, 0.04), 'Hips': (4, 0, 0), 'Spine': (-4, 0, 0), 'Chest': (-4, 0, 0),
                   'Neck': (4, 0, 0), 'Head': (0, 0, 0), 'Jaw': (-46, 0, 0), 'Tail_01': (16, 0, 0), 'Tail_02': (6, 0, 0)},
              legs={'FL': ('fk', reach_f), 'FR': ('fk', reach_f)})
    r3 = step(r2, {'Root.loc': (0, -0.15, -0.02), 'Hips': (-4, 0, 0), 'Spine': (-4, 0, 0), 'Chest': (-2, 0, 0),
                   'Neck': (10, 0, 0), 'Head': (6, 0, 0), 'Jaw': (-14, 0, 0), 'Tail_01': (10, 0, 0)},
              legs={'FL': ('ik', (0.01, -0.20, 0.0), None), 'FR': ('ik', (-0.01, -0.20, 0.0), None)})
    r4 = step(r3, {'Head': (6, 8, 14), 'Neck': (10, 0, 8), 'Jaw': (0, 0, 0)})
    r5 = step(r4, {'Head': (6, -8, -14), 'Neck': (10, 0, -8)})
    keys = [(0.0, N0, None), (0.30, r1, 'smooth'), (0.48, r2, 'in'), (0.58, r3, 'in'), (0.68, r4, 'out'),
            (0.80, r5, 'smooth'), (1.10, N0, 'smooth')]
    clips.append(Clip('Attack2', 1.10, keys=keys, events={'hit': 0.58}, shots=[0, 0.3, 0.48, 0.58, 0.8, 1.1]))

    # ---------------------------------------------------------- Hit: knocked back, head snapped up
    h1 = step(N0, {'Root.loc': (0, 0.06, 0.008), 'Hips': (-4, 0, 0), 'Spine': (7, 0, 0), 'Chest': (5, 0, 0),
                   'Neck': (18, 0, 0), 'Head': (16, 10, -8), 'Jaw': (-18, 0, 0), 'Ear_L': (-35, 0, 0), 'Ear_R': (-35, 0, 0),
                   'Tail_01': (18, 0, 0), 'Tail_02': (10, 0, 6), 'Tail_03': (8, 0, 10)})
    h2 = step(h1, {'Root.loc': (0, 0.03, 0.0), 'Neck': (8, 0, 0), 'Head': (6, 4, -3), 'Jaw': (-6, 0, 0)})
    keys = [(0.0, N0, None), (0.08, h1, 'out'), (0.22, h2, 'smooth'), (0.50, N0, 'smooth')]
    clips.append(Clip('Hit', 0.50, keys=keys, shots=[0, 0.08, 0.15, 0.22, 0.35, 0.5]))

    # ---------------------------------------------------------- Death: recoil, buckle, roll onto the right side, a last kick
    buckle_f = {'Front_Upper_L': (-12, 0, 0), 'Front_Lower_L': (38, 0, 0), 'Front_Paw_L': (40, 0, 0),
                'Front_Upper_R': (-12, 0, 0), 'Front_Lower_R': (38, 0, 0), 'Front_Paw_R': (40, 0, 0)}
    buckle_h = {'Hind_Upper_L': (30, 0, 0), 'Hind_Lower_L': (-50, 0, 0), 'Hind_Foot_L': (20, 0, 0),
                'Hind_Upper_R': (30, 0, 0), 'Hind_Lower_R': (-50, 0, 0), 'Hind_Foot_R': (20, 0, 0)}
    # rolled onto the right side: the right (down) legs swing up off the floor (+Z), the left (up) legs droop (-Z)
    dead_f = {'Front_Upper_L': (50, 0, -14), 'Front_Lower_L': (40, 0, 0), 'Front_Paw_L': (55, 0, 0),
              'Front_Upper_R': (35, 0, 22), 'Front_Lower_R': (45, 0, 0), 'Front_Paw_R': (55, 0, 0)}
    dead_h = {'Hind_Upper_L': (35, 0, -12), 'Hind_Lower_L': (20, 0, 0), 'Hind_Foot_L': (30, 0, 0),
              'Hind_Upper_R': (20, 0, 22), 'Hind_Lower_R': (10, 0, 0), 'Hind_Foot_R': (35, 0, 0)}
    kick_h = dict(dead_h)
    kick_h['Hind_Upper_L'] = (5, 0, -4)
    kick_h['Hind_Lower_L'] = (45, 0, 0)
    tail_flop = {'Tail_01': (4, 0, 30), 'Tail_02': (0, 0, -12), 'Tail_03': (0, 0, -14), 'Tail_04': (0, 0, -4)}
    d1 = step(N0, {'Root.loc': (0, 0.05, 0.008), 'Neck': (20, 0, 0), 'Head': (18, 8, 0), 'Jaw': (-28, 0, 0),
                   'Spine': (6, 0, 0), 'Ear_L': (-35, 0, 0), 'Ear_R': (-35, 0, 0), 'Tail_01': (20, 0, 0)})
    d2 = step(d1, {'Root.loc': (0.0, 0.04, -0.05), 'Root': (0, 20, 0), 'Hips': (-4, 0, 0), 'Spine': (-2, 0, 0),
                   'Neck': (8, 0, 0), 'Head': (8, 10, 0), 'Jaw': (-14, 0, 0), 'Tail_01': (6, 0, 0)},
              legs={'FL': ('fk', buckle_f), 'FR': ('fk', buckle_f), 'HL': ('fk', buckle_h), 'HR': ('fk', buckle_h)})
    d2 = M.ground(d2, keep_x=False)         # a transitional crouch: the lowest point (a folded forearm) on the floor
    d3 = step(d2, dict({'Root': (0, 90, 0), 'Hips': (-6, 0, 4), 'Spine': (-4, 0, 4), 'Chest': (-2, 0, 0), 'Neck': (-10, 0, 8),
                        'Head': (-10, 4, 10), 'Jaw': (-24, 0, 0), 'Ear_L': (-10, 0, 0), 'Ear_R': (-10, 0, 0)}, **tail_flop),
              legs={'FL': ('fk', dead_f), 'FR': ('fk', dead_f), 'HL': ('fk', dead_h), 'HR': ('fk', dead_h)})
    d3 = M.ground(d3, mask=torso)
    d4 = step(d3, {'Root': (0, 84, 0), 'Head': (-12, 4, 6)})
    d4 = M.ground(d4, mask=torso, lift=0.01)
    d5 = step(d3, {}, legs={'HL': ('fk', kick_h)})
    d6 = step(d3, {'Jaw': (-16, 0, 0), 'Head': (-12, 4, 12)})
    keys = [(0.0, N0, None), (0.10, d1, 'out'), (0.38, d2, 'in'), (0.62, d3, 'in'), (0.74, d4, 'out'),
            (0.86, d3, 'in'), (1.05, d5, 'smooth'), (1.25, d6, 'smooth'), (1.50, d6, 'smooth')]
    clips.append(Clip('Death', 1.50, keys=keys, events={'down': 0.62}, shots=[0, 0.1, 0.38, 0.62, 1.05, 1.5]))

    # ---------------------------------------------------------- Howl (the Warren Alpha): rear up, head thrown back, a long squeal
    w1 = step(N0, {'Root.loc': (0, 0.07, 0.0), 'Hips': (36, 0, 0), 'Spine': (8, 0, 0), 'Chest': (6, 0, 0),
                   'Neck': (10, 0, 0), 'Head': (22, 0, 0), 'Jaw': (-36, 0, 0), 'Ear_L': (-30, 0, 0), 'Ear_R': (-30, 0, 0),
                   'Tail_01': (38, 0, 0), 'Tail_02': (6, 0, 0)}, legs={'FL': ('fk', box_f), 'FR': ('fk', box_f)})
    w2 = step(w1, {'Head': (26, 0, 5), 'Neck': (12, 0, 4), 'Jaw': (-44, 0, 0)})
    w3 = step(w1, {'Head': (24, 0, -5), 'Neck': (12, 0, -4), 'Jaw': (-40, 0, 0)})
    keys = [(0.0, N0, None), (0.30, w1, 'smooth'), (0.45, w2, 'smooth'), (0.65, w3, 'smooth'), (0.85, w2, 'smooth'),
            (1.25, N0, 'smooth')]
    clips.append(Clip('Howl', 1.25, keys=keys, events={'release': 0.40}, shots=[0, 0.3, 0.45, 0.65, 0.85, 1.25]))

    # ---------------------------------------------------------- Retch (the Plague Rat): two heaves, then a spew
    q1 = step(N0, {'Root.loc': (0, 0.04, -0.02), 'Spine': (10, 0, 0), 'Chest': (6, 0, 0), 'Neck': (-12, 0, 0),
                   'Head': (-6, 0, 0), 'Jaw': (-8, 0, 0), 'Ear_L': (-20, 0, 0), 'Ear_R': (-20, 0, 0)})
    q2 = step(N0, {'Root.loc': (0, 0.02, -0.01), 'Spine': (-4, 0, 0), 'Chest': (-2, 0, 0), 'Neck': (4, 0, 0)})
    q3 = step(q1, {'Spine': (14, 0, 0), 'Chest': (9, 0, 0), 'Neck': (-14, 0, 0)})
    q4 = step(N0, {'Root.loc': (0, -0.08, 0.0), 'Spine': (-6, 0, 0), 'Chest': (4, 0, 0), 'Neck': (16, 0, 0), 'Head': (6, 0, 0),
                   'Jaw': (-48, 0, 0), 'Ear_L': (-30, 0, 0), 'Ear_R': (-30, 0, 0)})
    keys = [(0.0, N0, None), (0.18, q1, 'smooth'), (0.32, q2, 'smooth'), (0.50, q3, 'smooth'), (0.62, q4, 'in'),
            (0.85, q4, 'smooth'), (1.15, N0, 'smooth')]
    clips.append(Clip('Retch', 1.15, keys=keys, events={'release': 0.62}, shots=[0, 0.18, 0.5, 0.62, 0.85, 1.15]))
    return clips


# ====================================================================== variants
def variants():
    vs = [
        dict(id='giant-rat', name='Giant Rat', scale=1.0, parts=[], shapes={}, clipSpeed=1.0, role='fodder'),
        dict(id='plague-rat', name='Plague Rat', scale=1.1, parts=['rat_boils'], shapes={'var_belly': 1.0},
             clipSpeed=0.95, role='fodder', glow='#c9c24a', clipMap={'Retch': 'Retch'}),
        dict(id='warren-alpha', name='Warren Alpha', scale=1.6, parts=['rat_ridge'], shapes={}, clipSpeed=0.85,
             role='elite', clipMap={'Howl': 'Howl', 'Pin': 'Attack2'}),
        dict(id='old-gnaw', name='Old Gnaw', scale=2.4, parts=['rat_scars'], shapes={'var_bald': 1.0, 'var_one_eye': 1.0},
             clipSpeed=0.72, role='hunter', clipMap={'Lunge': 'Attack2', 'BoltHole': 'Flee'}),
        dict(id='pet-rat-prince', name='Rat Prince (pet)', scale=0.6, parts=['rat_crown'], shapes={'var_bald': 0.6},
             clipSpeed=1.2, role='pet', pet='rat-prince'),
    ]
    for v in vs:
        v['palette'] = C.content_palette(v['pet'] if v.get('pet') else v['id'], pet=bool(v.get('pet')))
    return vs


# ====================================================================== main
def main():
    C.log('build_rat: quick=%s' % QUICK)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = C.FPS
    M = C.Monster(BASE, quick=QUICK)
    M.view = dict(az=62.0, el=12.0)
    M.lineup_yaw = -62.0
    M.fight = dict(girth=0.9, count=3)
    M.rig = CRig('Rig', bone_table(), legs=LEGS, loc_bones=('Root',))
    body, parts = build_geometry(M.rig)
    M.body = body
    M.parts = parts
    M.variants = variants()
    lo = C.evaluated_coords(body)[:, 2].min()
    C.log('rat_body: %d tris, %d verts; rest lowest point %.1f mm' % (body['tris'], len(body.data.vertices), lo * 1000))
    for nm, ob in parts.items():
        C.log('%s: %d tris' % (nm, ob['tris']))
    for v in M.variants:
        C.log('variant %-16s x%.2f  %d tris  palette %s' % (v['id'], v['scale'], M.tris_of(v), v['palette']))
    M.clips = author(M.rig, M)
    M.bake_clips()
    M.check_clips()
    M.lines.append('')
    M.lines.append('- rat_body %d tris; parts %s' % (body['tris'], ', '.join('%s %d' % (n, o['tris']) for n, o in parts.items())))
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
        C.log('rat.glb %.1f KB' % kb)
        C.save_blend(os.path.join(C.BUILD, 'monsters_rat.blend'))
        from export import reimport_report
        for line in reimport_report(path):
            C.log(line)
    else:
        C.save_blend(os.path.join(C.BUILD, 'monsters_rat.blend'))


if __name__ == '__main__':
    main()

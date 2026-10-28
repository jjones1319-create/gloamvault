"""build_hound.py — the hound base (06 §3.5): Cellar Hound, the Warden's Hound, and the Cellar Hound and Bone Pup pets.

Run:  blender -b -P tools/blender/monsters/build_hound.py -- [--quick] [--no-renders] [--no-export] [--only Idle,Move]

A lean, ribby cellar mastiff 0.83 m at the withers (scale 1 = the Cellar Hound): a deep ribcage with ribs showing and a
hard tuck-up, a broad skull with a heavy brow and a short dark muzzle, folded rose ears, a lower jaw that opens on a dark
mouth with canines, a whip tail, four-clawed paws (creature_lib metaball body). Rig (29 bones): Root · Hips · Spine ·
Chest · Neck · Head · Jaw · Ear_L/R · Tail_01..04 · per side Scap / Front_Upper / Front_Lower / Front_Paw and
Hind_Upper / Hind_Lower / Hind_Meta / Hind_Paw (digitigrade hind legs).

Variants (manifest.json): hound_collar (the Cellar Hound's spiked collar); hound_chain + hound_ribs + ghost (the
Warden's Hound: a chain collar and a lantern-lit ribcage, x1.5); var_pup + hound_rope (the Cellar Hound pet); var_pup +
hound_ribs (the Bone Pup). Clips: Idle, Move (trot), Attack1 (lunge bite), Attack2 (hamstring: a low darting
slash-bite and yank), Hit, Death.

Outputs: client/public/models/monsters/hound.glb, the `hound` key of clips.json, the hound entries of manifest.json,
art/renders/monsters/hound/*.png, art/build/monsters_hound.blend, art/build/monsters_hound_checks.txt.
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
from creature_lib import (ACCENT, BONE, GLOW, INK, MAIN, METAL, SECOND, CRig, Clip, Geo, Leg, ball, capsule,  # noqa: E402
                          ellipsoid, step, wave)

ARGS = C.args()
QUICK = bool(ARGS.get('quick'))
ONLY = set(ARGS['only'].split(',')) if isinstance(ARGS.get('only'), str) else None
BASE = 'hound'
BUDGET = 2780          # the Cellar Hound's visual.triBudget is 3,000 with its collar
RES = 0.006

UP = (0, 0, 1)
FWD = (0, -1, 0)
HX = 0.13
FX = 0.11
TAIL = [(0, 0.40, 0.72), (0, 0.49, 0.67), (0, 0.56, 0.58), (0, 0.61, 0.47), (0, 0.64, 0.36)]
TORSO = ('Hips', 'Spine', 'Chest')
SKULL = Vector((0, -0.50, 0.87))
HEAD_TAGS = {'skull', 'brow', 'cheek_L', 'cheek_R', 'muzzle', 'nose'}


def sd(name, s):
    return name + ('_L' if s > 0 else '_R')


def bone_table():
    b = [
        ('Root', None, (0, 0, 0), (0, -0.15, 0), UP),
        ('Hips', 'Root', (0, 0.34, 0.66), (0, 0.12, 0.70), UP),
        ('Spine', 'Hips', (0, 0.12, 0.70), (0, -0.10, 0.72), UP),
        ('Chest', 'Spine', (0, -0.10, 0.72), (0, -0.30, 0.74), UP),
        ('Neck', 'Chest', (0, -0.30, 0.74), (0, -0.42, 0.86), UP),
        ('Head', 'Neck', (0, -0.42, 0.86), (0, -0.72, 0.80), UP),
        ('Jaw', 'Head', (0, -0.47, 0.785), (0, -0.70, 0.745), UP),
    ]
    for i in range(4):
        b.append(('Tail_%02d' % (i + 1), 'Hips' if i == 0 else 'Tail_%02d' % i, TAIL[i], TAIL[i + 1], UP))
    for s in (1, -1):
        b += [
            (sd('Ear', s), 'Head', (s * 0.075, -0.46, 0.945), (s * 0.13, -0.465, 0.905), FWD),
            (sd('Scap', s), 'Chest', (s * FX, -0.20, 0.80), (s * FX, -0.33, 0.60), FWD),
            (sd('Front_Upper', s), sd('Scap', s), (s * FX, -0.33, 0.60), (s * FX, -0.23, 0.40), FWD),
            (sd('Front_Lower', s), sd('Front_Upper', s), (s * FX, -0.23, 0.40), (s * FX, -0.26, 0.10), FWD),
            (sd('Front_Paw', s), sd('Front_Lower', s), (s * FX, -0.26, 0.10), (s * FX, -0.33, 0.028), UP),
            (sd('Hind_Upper', s), 'Hips', (s * HX, 0.34, 0.60), (s * HX, 0.24, 0.40), FWD),
            (sd('Hind_Lower', s), sd('Hind_Upper', s), (s * HX, 0.24, 0.40), (s * HX, 0.40, 0.20), FWD),
            (sd('Hind_Meta', s), sd('Hind_Lower', s), (s * HX, 0.40, 0.20), (s * HX, 0.37, 0.055), FWD),
            (sd('Hind_Paw', s), sd('Hind_Meta', s), (s * HX, 0.37, 0.055), (s * HX, 0.30, 0.028), UP),
        ]
    return b


LEGS = [
    Leg('FL', ('Front_Upper_L', 'Front_Lower_L'), ('Front_Paw_L',), bend=-1, abduct=30.0),
    Leg('FR', ('Front_Upper_R', 'Front_Lower_R'), ('Front_Paw_R',), bend=-1, abduct=30.0),
    Leg('HL', ('Hind_Upper_L', 'Hind_Lower_L'), ('Hind_Meta_L', 'Hind_Paw_L'), bend=1, abduct=30.0),
    Leg('HR', ('Hind_Upper_R', 'Hind_Lower_R'), ('Hind_Meta_R', 'Hind_Paw_R'), bend=1, abduct=30.0),
]


# ====================================================================== body
def body_elements():
    el = [
        ellipsoid((0, -0.15, 0.625), (0.145, 0.22, 0.195), bone={'Chest': 0.7, 'Spine': 0.3}, tag='ribcage'),
        ellipsoid((0, -0.22, 0.745), (0.12, 0.13, 0.085), bone='Chest', tag='withers'),
        ellipsoid((0, -0.31, 0.60), (0.115, 0.08, 0.12), bone='Chest', tag='forechest'),
        ellipsoid((0, 0.13, 0.67), (0.095, 0.17, 0.085), bone={'Spine': 0.6, 'Hips': 0.4}, tag='loins'),
        ellipsoid((0, 0.32, 0.665), (0.125, 0.13, 0.115), bone='Hips', tag='croup'),
        ball((0.085, 0.21, 0.735), 0.04, bone='Hips', tag='hipbone_L'),
        ellipsoid((0.105, 0.30, 0.53), (0.07, 0.115, 0.135), bone={'Hind_Upper_L': 0.75, 'Hips': 0.25},
                  rot=Matrix.Rotation(math.radians(-22), 3, 'X').to_quaternion(), tag='thigh_L'),
        capsule((HX, 0.25, 0.40), (HX, 0.39, 0.215), 0.045, bone='Hind_Lower_L', tag='gaskin_L'),
        capsule((HX, 0.40, 0.20), (HX, 0.375, 0.075), 0.03, bone='Hind_Meta_L', tag='hock_L'),
        ellipsoid((HX, 0.335, 0.034), (0.038, 0.052, 0.032), bone='Hind_Paw_L', tag='hpaw_L'),
        ellipsoid((0.10, -0.29, 0.53), (0.065, 0.085, 0.12), bone={'Front_Upper_L': 0.6, 'Chest': 0.4}, tag='arm_L'),
        capsule((FX, -0.235, 0.40), (FX, -0.26, 0.115), 0.036, bone='Front_Lower_L', tag='forearm_L'),
        capsule((FX, -0.26, 0.10), (FX, -0.295, 0.05), 0.028, bone='Front_Paw_L', tag='pastern_L'),
        ellipsoid((FX, -0.305, 0.034), (0.04, 0.055, 0.033), bone='Front_Paw_L', tag='fpaw_L'),
        capsule((0, -0.29, 0.74), (0, -0.43, 0.85), 0.105, bone='Neck', tag='neck'),
        ellipsoid((0, -0.40, 0.765), (0.085, 0.07, 0.075), bone={'Neck': 0.6, 'Head': 0.4}, tag='throat'),
        ellipsoid((0, -0.51, 0.88), (0.11, 0.115, 0.10), bone='Head', tag='skull'),
        ellipsoid((0, -0.565, 0.925), (0.085, 0.045, 0.035), bone='Head', tag='brow'),
        ball((0.065, -0.57, 0.82), 0.065, bone='Head', tag='cheek_L'),
        ellipsoid((0, -0.65, 0.825), (0.078, 0.085, 0.068), bone='Head', slot=SECOND, tag='muzzle'),
        ball((0, -0.728, 0.845), 0.031, bone='Head', slot=INK, tag='nose'),
    ]
    for k in range(3):                                   # ribs showing on the flanks
        el.append(capsule((0.115, -0.24 + 0.075 * k, 0.74), (0.148, -0.19 + 0.075 * k, 0.52), 0.016, bone='Chest', s=1.3,
                          tag='rib%d_L' % k))
    return C.with_mirror(el)


def pup_xform(p):
    """The pup's head: 1.22x about the skull, the muzzle pushed back 4 cm (a puppy's short face)."""
    p = Vector(p)
    w = C.smooth((-p.y - 0.40) / 0.08)
    q = SKULL + (p - SKULL) * 1.22
    out = p.lerp(q, w)
    m = C.smooth((-p.y - 0.60) / 0.06)
    out.y += 0.045 * m
    return out


def pup_elements():
    out = []
    for e in body_elements():
        e2 = e.copy()
        if e.tag in HEAD_TAGS:
            e2 = e.scaled_about(SKULL, 1.22)
            if e.tag in ('muzzle', 'nose'):
                e2.co.y += 0.045
                if e.tag == 'muzzle':
                    e2.size = (e2.size[0], e2.size[1] * 0.78, e2.size[2])
        elif e.tag == 'loins':
            e2.co.z -= 0.04
            e2.size = (e2.size[0] * 1.15, e2.size[1], e2.size[2] * 1.6)
        elif e.tag in ('ribcage',):
            e2.size = tuple(x * 1.05 for x in e2.size)
        elif e.tag.startswith(('hpaw', 'fpaw')):
            c = Vector((e.co.x, e.co.y, 0.0))
            e2 = e.scaled_about(c, 1.35)
        elif e.kind == 'CAPSULE' and e.tag.split('_')[0] in ('gaskin', 'hock', 'forearm', 'pastern'):
            e2.R *= 1.15
        elif e.tag.startswith('rib'):
            e2.R *= 0.6
        out.append(e2)
    return out


def jaw_elements(pup=False):
    el = [
        capsule((0, -0.50, 0.777), (0, -0.68, 0.757), 0.038, bone='Jaw', tag='jaw'),
        ball((0, -0.69, 0.756), 0.030, bone='Jaw', tag='chin'),
    ]
    if pup:
        el = [e.scaled_about(SKULL, 1.22) for e in el]
        for e in el:
            e.co.y += 0.045 * C.smooth((-e.co.y - 0.60) / 0.06)
    return el


def build_geometry(rig):
    body_el = body_elements()
    pup_el = pup_elements()
    att = Geo()
    # eyes: under the heavy brow
    for s in (1, -1):
        r = 0.021
        origin = Vector((s * 0.025, -0.555, 0.885))
        d = Vector((s * 0.80, -0.58, 0.18)).normalized()
        p = C.surface_point(body_el, origin, d, reach=0.3)
        c = p - d * (0.35 * r)
        V, F, N = C.uv_sphere(tuple(c), r, rings=5, segs=7, rot=d.to_track_quat('Z', 'Y'))
        pup = np.array([tuple(pup_xform(v)) for v in V])
        cp = np.array(tuple(pup_xform(c)))
        pup = cp + (pup - cp) * 1.3
        att.add(V, F, ACCENT, N, {'Head': 1.0}, name=sd('eye', s), keys={'var_pup': pup - V})
    # rose ears: flaps folded back and out from the top of the skull
    for s in (1, -1):
        base = C.surface_point(body_el, (s * 0.03, -0.47, 0.90), (s * 0.55, 0.15, 1.0), reach=0.3)
        out = Vector((s * 0.85, 0.15, -0.5)).normalized()
        face = Vector((s * 0.3, -0.6, 0.75)).normalized()
        face = (face - out * face.dot(out)).normalized()
        x = out.cross(face)
        R = Matrix((x, face, out)).transposed()
        c = base + out * 0.035 + Vector((0, 0, 0.005))
        V, F, N = C.uv_sphere((0, 0, 0), (0.048, 0.012, 0.055), rings=5, segs=8)
        Vl = np.array(V)
        Vl[:, 1] += 0.012 * (Vl[:, 2] / 0.055) ** 2                     # the flap curls over
        Vw = Vl @ np.array(R).T + np.array(c)
        Nw = C.vertex_normals(Vw, F)
        pup = np.array([tuple(pup_xform(v)) for v in Vw])
        bp = np.array(tuple(pup_xform(base)))
        pup = bp + (pup - bp) * 1.3
        att.add(Vw, F, MAIN, Nw, {sd('Ear', s): 0.85, 'Head': 0.15}, name=sd('ear', s), keys={'var_pup': pup - Vw})
    # teeth: upper and lower canines, a row of small incisors
    teeth = []
    for s in (1, -1):
        teeth.append(((s * 0.043, -0.703, 0.792), (s * 0.046, -0.708, 0.742), 0.0095, 'Head'))
        teeth.append(((s * 0.036, -0.676, 0.768), (s * 0.039, -0.684, 0.806), 0.0085, 'Jaw'))
    for x in (-0.021, -0.007, 0.007, 0.021):
        teeth.append(((x, -0.722, 0.79), (x, -0.724, 0.772), 0.0055, 'Head'))
    for a, b, r, bone in teeth:
        V, F, N = C.cone(a, b, r, sides=4)
        pup = np.array([tuple(pup_xform(v)) for v in V])
        att.add(V, F, BONE, N, {bone: 1.0}, name='tooth', keys={'var_pup': pup - V})
    # claws: four per paw
    for s in (1, -1):
        for front in (True, False):
            cy, x0 = (-0.355, FX) if front else (0.285, HX)
            bone = sd('Front_Paw' if front else 'Hind_Paw', s)
            pc = Vector((s * x0, cy + 0.05, 0.034))
            for dx in (-0.027, -0.009, 0.009, 0.027):
                a = Vector((s * x0 + dx, cy + 0.004, 0.018))
                b = a + Vector((dx * 0.25, -0.022, -0.014))
                V, F, N = C.cone(tuple(a), tuple(b), 0.0068, sides=4, up=(0, 0, 1))
                pup = np.array(pc) + (np.array(V) - np.array(pc)) * 1.35
                pup[:, 2] = np.array(V)[:, 2] * 1.35
                att.add(V, F, BONE, N, {bone: 1.0}, name='claw', keys={'var_pup': pup - V})
    # tail: a whip, thick at the root
    ctrl = [(0, 0.34, 0.745)] + TAIL
    n_ring = 11
    P = C.curve_points(ctrl, n_ring)
    rad = np.interp(np.linspace(0, 1, n_ring), [0, 0.12, 1.0], [0.042, 0.034, 0.011])
    V, F, N, ring = C.tube(P, rad, sides=7, cap0='flat', cap1='point', up=(0, 0, 1))
    chain = ['Tail_%02d' % i for i in range(1, 5)]
    att.add(V, F, MAIN, N, C.chain_weights(rig, V, chain, 'Hips', rooted=lambda p: p.y < 0.385), name='tail')
    jaw_tris = 130
    body_tris = BUDGET - att.tris() - jaw_tris - 30
    # ---------------------------------------------------------------- the implicit body and jaw
    V, F, N = C.implicit_mesh(body_el, RES, body_tris, name='hound_mb_body')
    W = C.field_weights(V, body_el, power=2.0)
    dom = C.dominant(np.array([V[list(f)].mean(0) for f in F]), body_el)
    slots = [body_el[j].slot for j in dom]
    FN = C.face_normals(V, F)
    for k, f in enumerate(F):
        c = V[list(f)].mean(0)
        if c[1] < -0.61 and FN[k][2] < -0.4 and abs(c[0]) < 0.05 and c[2] < 0.80:
            slots[k] = INK                         # the roof of the mouth
    Vp = C.project(np.array([tuple(pup_xform(v)) for v in V]), pup_el)
    geo = Geo()
    geo.add(V, F, slots, N, W, name='body', keys={'var_pup': Vp - V})
    body_V, body_W, body_Dp = V, W, Vp - V
    jaw_el = jaw_elements()
    Vj, Fj, Nj = C.implicit_mesh(jaw_el, RES * 0.8, jaw_tris, name='hound_mb_jaw')
    FNj = C.face_normals(Vj, Fj)
    sj = []
    for k, f in enumerate(Fj):
        c = Vj[list(f)].mean(0)
        sj.append(INK if (FNj[k][2] > 0.3 and c[1] < -0.52) else (SECOND if c[1] < -0.60 else MAIN))
    Vjp = C.project(np.array([tuple(pup_xform(v)) for v in Vj]), jaw_elements(pup=True))
    geo.add(Vj, Fj, sj, Nj, {'Jaw': 1.0}, name='jaw', keys={'var_pup': Vjp - Vj})
    Va, Na = att.arrays()
    for nm, off, n in att.pieces:
        fs = [tuple(i - off for i in f) for f in att.F if off <= f[0] < off + n]
        ss = [s for f, s in zip(att.F, att.S) if off <= f[0] < off + n]
        keys = {k: d[off] for k, d in att.keys.items() if off in d}
        geo.add(Va[off:off + n], fs, ss, Na[off:off + n], att.W[off:off + n], name=nm, keys=keys)
    body = C.make_object(geo, 'hound_body', rig.ob, key_names=['var_pup'])
    body['kind'] = 'body'
    body['base'] = BASE
    parts = {
        'hound_collar': build_collar(rig, body_el, body_V, body_W),
        'hound_chain': build_chain(rig, body_el, body_V, body_W),
        'hound_ribs': build_ribs(rig, body_el, body_V, body_W, body_Dp),
        'hound_rope': build_rope(rig, pup_el, Vp, body_W),
    }
    for nm, ob in parts.items():
        ob['kind'] = 'part'
        ob['base'] = BASE
        ob['part'] = nm
    return body, parts


NECK_C = Vector((0, -0.365, 0.795))
NECK_AX = Vector((0, -0.12, 0.11)).normalized()


def build_collar(rig, el, bV, bW):
    """The Cellar Hound's spiked collar: a broad rust band round the neck with iron spikes."""
    g = Geo()
    pts, u, v = C.surface_band(el, NECK_C, NECK_AX, 0.12, n=14, offset=0.010)
    V, F, N = C.ring_tube(pts, 0.022, sides=4, flat=(0.42, 1.25))
    g.add(V, F, SECOND, N, C.weights_from(V, bV, bW, k=4), name='band')
    c = np.mean(np.array([tuple(p) for p in pts]), axis=0)
    for i in range(0, 14, 2):
        p = Vector(pts[i])
        d = (p - Vector(c))
        d = (d - NECK_AX * d.dot(NECK_AX)).normalized()
        a = p + d * 0.006
        V, F, N = C.cone(tuple(a), tuple(a + d * 0.05), 0.012, sides=5)
        g.add(V, F, METAL, N, C.weights_from(V, bV, bW, k=4), name='spike')
    return C.make_object(g, 'hound_collar', rig.ob)


def build_chain(rig, el, bV, bW):
    """The Warden's Hound's chain collar: twelve iron links round the neck and a short length hanging from the throat."""
    g = Geo()
    pts, u, v = C.surface_band(el, NECK_C, NECK_AX, 0.12, n=12, offset=0.016)
    P = [Vector(p) for p in pts]
    for i in range(12):
        a, b = P[i], P[(i + 1) % 12]
        mid = (a + b) / 2
        along = (b - a).normalized()
        out = (mid - NECK_C)
        out = (out - NECK_AX * out.dot(NECK_AX)).normalized()
        axis = out if i % 2 == 0 else NECK_AX
        V, F, N = C.torus(tuple(mid), tuple(axis), 0.024, 0.0068, segs=8, sides=4, up=tuple(along))
        g.add(V, F, SECOND, N, C.weights_from(V, bV, bW, k=4), name='link')
    low = min(range(12), key=lambda i: P[i].z)
    top = P[low]
    for k in range(4):
        cpt = top + Vector((0, -0.01, -0.035 - 0.042 * k))
        axis = Vector((1, 0, 0)) if k % 2 == 0 else Vector((0, 1, 0))
        V, F, N = C.torus(tuple(cpt), tuple(axis), 0.022, 0.0065, segs=8, sides=4, up=(0, 0, 1))
        g.add(V, F, SECOND, N, {'Neck': 0.6, 'Chest': 0.4}, name='hang')
    return C.make_object(g, 'hound_chain', rig.ob)


def build_ribs(rig, el, bV, bW, Dp):
    """The lantern-lit ribcage (the Warden's Hound; the Bone Pup in its own blue): five glowing ribs a side."""
    g = Geo()
    for s in (1, -1):
        for k in range(5):
            y0 = -0.27 + 0.065 * k
            pts = []
            for j, z in enumerate(np.linspace(0.79, 0.47, 7)):
                y = y0 + 0.07 * (0.79 - z) / 0.32
                pts.append(C.surface_point(el, (0, y, z), (s * 1.0, 0.0, 0.25 * (z - 0.63) / 0.16), reach=0.4))
            pts = [Vector(p) + Vector(C.field_normals(np.array([p]), el)[0]) * 0.006 for p in pts]
            V, F, N, _ = C.tube(pts, [0.008, 0.012, 0.013, 0.013, 0.012, 0.011, 0.007], sides=4, cap0='point', cap1='point')
            keys = {'var_pup': C.deltas_from(V, bV, Dp)}
            g.add(V, F, GLOW, N, C.weights_from(V, bV, bW, k=4), name='rib', keys=keys)
    return C.make_object(g, 'hound_ribs', rig.ob, key_names=['var_pup'])


def build_rope(rig, el, Vp, bW):
    """The pets' rope collar, twisted, with a knot under the chin (on the pup's neck: var_pup = 1)."""
    g = Geo()
    c = pup_xform(NECK_C) + Vector((0, 0.01, -0.01))
    pts, u, v = C.surface_band(el, c, NECK_AX, 0.12, n=16, offset=0.012)
    V, F, N = C.ring_tube(pts, 0.014, sides=5, twist=0.7)
    g.add(V, F, SECOND, N, C.weights_from(V, Vp, bW, k=4), name='rope')
    low = min(pts, key=lambda p: p.z)
    V, F, N = C.uv_sphere(tuple(low + Vector((0, -0.012, -0.012))), 0.022, rings=4, segs=6)
    g.add(V, F, SECOND, N, C.weights_from(V, Vp, bW, k=4), name='knot')
    return C.make_object(g, 'hound_rope', rig.ob)


# ====================================================================== clips
def foot_dirs(rig, leg, mode, s):
    lg = rig.leg[leg]
    front = leg[0] == 'F'
    out = []
    if front:
        R = rig.rest_dir[lg.ends[0]]
        if mode == 'stance':
            phi = 0.0 if s < 0.55 else 25.0 * C.smooth((s - 0.55) / 0.45)
        else:
            phi = 25 + 75 * C.smooth(min(1, s / 0.4)) if s < 0.4 else 100 * (1 - C.smooth((s - 0.4) / 0.6))
        out.append(tuple(C.rot_about(R, (1, 0, 0), math.radians(phi))))
    else:
        Rm = rig.rest_dir[lg.ends[0]]
        Rp = rig.rest_dir[lg.ends[1]]
        if mode == 'stance':
            pm = 0.0
            pp = 0.0 if s < 0.55 else 35.0 * C.smooth((s - 0.55) / 0.45)
        else:
            k = math.sin(math.pi * s)
            pm = 28.0 * k
            pp = 35.0 * (1 - s) + 45.0 * k
        out.append(tuple(C.rot_about(Rm, (1, 0, 0), math.radians(pm))))
        out.append(tuple(C.rot_about(Rp, (1, 0, 0), math.radians(pp))))
    return out


def author(rig, M):
    clips = []
    N0 = {'legs': {}}
    torso = M.vertex_mask(TORSO)

    def tail_wag(p, t, period, amp=10.0, lift=0.0, lag=0.12):
        for i in range(1, 5):
            x0, y0, z0 = p.get('Tail_%02d' % i, (0, 0, 0))
            p['Tail_%02d' % i] = (x0 + lift * (1.2 - i * 0.3), y0, z0 + amp * (0.5 + 0.3 * i) * wave(t, period, -lag * i))
        return p

    # ---------------------------------------------------------- Idle: heavy breathing, a look round, ears and tail
    def idle(t):
        br = wave(t, 1.0)
        pant = wave(t, 0.25)
        look = wave(t, 2.0)
        p = {'legs': {}}
        p['Root.loc'] = (0.0, 0.0, -0.004 + 0.004 * br)
        p['Spine'] = (1.0 * br, 0, 0)
        p['Chest'] = (1.5 * br, 0, 0)
        p['Neck'] = (-4 + 3 * wave(t, 2.0, 0.3), 0, 10 * look)
        p['Head'] = (-3 + 3 * wave(t, 2.0, 0.55), 4 * wave(t, 2.0, 0.2), 8 * look)
        p['Jaw'] = (-6 + 2 * pant, 0, 0)
        p['Ear_L'] = (4 * wave(t, 1.0, 0.1), 0, 3 * wave(t, 2.0, 0.6))
        p['Ear_R'] = (4 * wave(t, 1.0, 0.4), 0, -3 * wave(t, 2.0, 0.9))
        p['Scap_L'] = (0, 0, 0)
        return tail_wag(p, t, 2.0, amp=6.0, lift=-4.0)

    clips.append(Clip('Idle', 2.0, loop=True, fn=idle, shots=[0, 0.4, 0.8, 1.2, 1.6, 2.0]))

    # ---------------------------------------------------------- Move: a trot, the shoulder blades swinging
    T = 15 / 30.0
    S = 0.74
    duty = 0.5
    phases = {'HL': 0.0, 'FR': 0.0, 'HR': 0.5, 'FL': 0.5}

    def move(t):
        u = t / T
        legs = {}
        p = {}
        for name, ph in phases.items():
            fwd, up, mode, s = C.gait_foot(u - ph, duty, S, 0.075 if name[0] == 'F' else 0.07)
            legs[name] = ('ik', (0.0, -fwd, up), foot_dirs(rig, name, mode, s))
            if name[0] == 'F':
                p['Scap_' + name[1]] = (11.0 * fwd / (S * duty / 2), 0, 0)
        c2 = math.cos(4 * math.pi * u)
        s1 = math.sin(2 * math.pi * u)
        p['legs'] = legs
        p['Root.loc'] = (0.0, 0.0, -0.028 - 0.012 * c2)
        p['Hips'] = (1.0 * c2, 3 * s1, 3 * s1)
        p['Spine'] = (0, 0, -2 * s1)
        p['Chest'] = (-1.0 * c2, -3 * s1, -2 * s1)
        p['Neck'] = (-6 + 2 * c2, 0, 2 * s1)
        p['Head'] = (2 - 2 * c2, 0, 1 * s1)
        p['Jaw'] = (-10, 0, 0)
        p['Ear_L'] = (-6 + 6 * c2, 0, 0)
        p['Ear_R'] = (-6 + 6 * c2, 0, 0)
        return tail_wag(p, t, T, amp=7.0, lift=6.0, lag=0.15)

    clips.append(Clip('Move', T, loop=True, fn=move, speed=S / T, shots=[i / 30 for i in (0, 3, 5, 8, 10, 13)]))

    # ---------------------------------------------------------- Attack1: crouch, lunge and snap, shake
    k1 = step(N0, {'Root.loc': (0, 0.07, -0.06), 'Hips': (-3, 0, 0), 'Spine': (2, 0, 0), 'Chest': (-4, 0, 0),
                   'Neck': (-14, 0, 0), 'Head': (-4, 0, 0), 'Jaw': (-14, 0, 0), 'Ear_L': (-25, 0, 0), 'Ear_R': (-25, 0, 0),
                   'Tail_01': (-10, 0, 0)})
    k2 = step(k1, {'Root.loc': (0, -0.20, 0.0), 'Hips': (2, 0, 0), 'Spine': (-2, 0, 0), 'Chest': (6, 0, 0),
                   'Neck': (16, 0, 0), 'Head': (6, 0, 0), 'Jaw': (-42, 0, 0), 'Tail_01': (12, 0, 0)},
              legs={'FL': ('ik', (0, -0.20, 0.0), None), 'FR': ('ik', (0, -0.16, 0.0), None)})
    k3 = step(k2, {'Jaw': (-2, 0, 0), 'Head': (4, 8, 16), 'Neck': (14, 0, 10)})
    k4 = step(k3, {'Head': (4, -8, -16), 'Neck': (14, 0, -10), 'Root.loc': (0, -0.17, 0.0)})
    keys = [(0.0, N0, None), (0.25, k1, 'smooth'), (0.36, k2, 'in'), (0.43, k3, 'out'), (0.55, k4, 'smooth'),
            (0.85, N0, 'smooth')]
    clips.append(Clip('Attack1', 0.85, keys=keys, events={'hit': 0.36}, shots=[0, 0.25, 0.36, 0.43, 0.55, 0.85],
                      overlay=lambda t, p: tail_wag(p, t, 0.85, amp=5)))

    # ---------------------------------------------------------- Attack2: hamstring — a low darting bite and a yank
    a1 = step(N0, {'Root.loc': (0.03, 0.05, -0.07), 'Hips': (-2, 0, 0), 'Spine': (0, 0, -5), 'Chest': (-6, 0, -6),
                   'Neck': (-18, 0, -12), 'Head': (-8, 0, -8), 'Jaw': (-10, 0, 0), 'Ear_L': (-30, 0, 0), 'Ear_R': (-30, 0, 0)})
    a2 = step(a1, {'Root.loc': (-0.06, -0.16, -0.06), 'Spine': (0, 0, 6), 'Chest': (-8, 0, 8), 'Neck': (-22, 0, 14),
                   'Head': (-6, 25, 10), 'Jaw': (-44, 0, 0)},
              legs={'FL': ('ik', (-0.05, -0.15, 0.0), None), 'FR': ('ik', (-0.06, -0.10, 0.0), None),
                    'HL': ('ik', (-0.05, -0.13, 0.0), None), 'HR': ('ik', (-0.05, -0.11, 0.0), None)})
    a3 = step(a2, {'Neck': (-10, 0, -26), 'Head': (-2, 10, -22), 'Jaw': (-4, 0, 0), 'Chest': (-4, 0, -8),
                   'Root.loc': (-0.05, -0.13, -0.05)})
    keys = [(0.0, N0, None), (0.22, a1, 'smooth'), (0.36, a2, 'in'), (0.48, a3, 'out'), (0.90, N0, 'smooth')]
    clips.append(Clip('Attack2', 0.90, keys=keys, events={'hit': 0.36}, shots=[0, 0.22, 0.36, 0.48, 0.65, 0.9],
                      overlay=lambda t, p: tail_wag(p, t, 0.9, amp=5)))

    # ---------------------------------------------------------- Hit: a yelp — head thrown up, tail tucked
    h1 = step(N0, {'Root.loc': (0, 0.08, 0.01), 'Hips': (-4, 0, 0), 'Spine': (5, 0, 0), 'Chest': (4, 0, 0),
                   'Neck': (20, 0, 0), 'Head': (14, 10, -6), 'Jaw': (-20, 0, 0), 'Ear_L': (-30, 0, 0), 'Ear_R': (-30, 0, 0),
                   'Tail_01': (-30, 0, 0), 'Tail_02': (-10, 0, 0)})
    h2 = step(h1, {'Root.loc': (0, 0.04, 0.0), 'Neck': (6, 0, 0), 'Head': (4, 4, -2), 'Jaw': (-8, 0, 0)})
    keys = [(0.0, N0, None), (0.08, h1, 'out'), (0.24, h2, 'smooth'), (0.55, N0, 'smooth')]
    clips.append(Clip('Hit', 0.55, keys=keys, shots=[0, 0.08, 0.16, 0.24, 0.4, 0.55]))

    # ---------------------------------------------------------- Death: the hind end goes, then the front; onto the right side
    sit_h = {'Hind_Upper_L': (55, 0, 0), 'Hind_Lower_L': (-95, 0, 0), 'Hind_Meta_L': (60, 0, 0), 'Hind_Paw_L': (10, 0, 0),
             'Hind_Upper_R': (55, 0, 0), 'Hind_Lower_R': (-95, 0, 0), 'Hind_Meta_R': (60, 0, 0), 'Hind_Paw_R': (10, 0, 0)}
    dead_f = {'Front_Upper_L': (35, 0, -10), 'Front_Lower_L': (15, 0, 0), 'Front_Paw_L': (30, 0, 0),
              'Front_Upper_R': (25, 0, 18), 'Front_Lower_R': (20, 0, 0), 'Front_Paw_R': (30, 0, 0)}
    dead_h = {'Hind_Upper_L': (30, 0, -10), 'Hind_Lower_L': (-15, 0, 0), 'Hind_Meta_L': (20, 0, 0), 'Hind_Paw_L': (20, 0, 0),
              'Hind_Upper_R': (20, 0, 18), 'Hind_Lower_R': (-10, 0, 0), 'Hind_Meta_R': (15, 0, 0), 'Hind_Paw_R': (20, 0, 0)}
    tail_flop = {'Tail_01': (6, 0, 26), 'Tail_02': (0, 0, -10), 'Tail_03': (0, 0, -12), 'Tail_04': (0, 0, -4)}
    d1 = step(N0, {'Root.loc': (0, 0.06, 0.01), 'Neck': (18, 0, 0), 'Head': (12, 8, 0), 'Jaw': (-26, 0, 0),
                   'Ear_L': (-30, 0, 0), 'Ear_R': (-30, 0, 0)})
    d2 = step(d1, {'Root.loc': (0, 0.10, -0.20), 'Hips': (-18, 0, 0), 'Spine': (6, 0, 0), 'Chest': (4, 0, 0),
                   'Neck': (6, 0, 0), 'Head': (0, 8, 0), 'Jaw': (-16, 0, 0), 'Tail_01': (-10, 0, 0)},
              legs={'HL': ('fk', sit_h), 'HR': ('fk', sit_h)})
    d3 = step(d2, dict({'Root': (0, 90, 0), 'Hips': (-4, 0, 4), 'Spine': (-2, 0, 4), 'Chest': (0, 0, 2), 'Neck': (-14, 0, 10),
                        'Head': (-12, 6, 10), 'Jaw': (-22, 0, 0), 'Ear_L': (-10, 0, 0), 'Ear_R': (-10, 0, 0)}, **tail_flop),
              legs={'FL': ('fk', dead_f), 'FR': ('fk', dead_f), 'HL': ('fk', dead_h), 'HR': ('fk', dead_h)})
    d3 = M.ground(d3, mask=torso)
    fold_f = {'Front_Upper_L': (-20, 0, 0), 'Front_Lower_L': (70, 0, 0), 'Front_Paw_L': (20, 0, 0),
              'Front_Upper_R': (-20, 0, 0), 'Front_Lower_R': (70, 0, 0), 'Front_Paw_R': (20, 0, 0)}
    d2b = step(d2, {'Root': (0, 28, 0), 'Hips': (-14, 0, 2), 'Neck': (-4, 0, 4), 'Head': (-6, 8, 4)},
               legs={'FL': ('fk', fold_f), 'FR': ('fk', fold_f)})
    d2b = M.ground(d2b, keep_x=False)
    d4 = step(d3, {'Root': (0, 85, 0), 'Head': (-14, 6, 6)})
    d4 = M.ground(d4, mask=torso, lift=0.012)
    d5 = step(d3, {'Chest': (3, 0, 2), 'Jaw': (-28, 0, 0)})
    d6 = step(d3, {'Jaw': (-18, 0, 0), 'Head': (-14, 6, 12)})
    keys = [(0.0, N0, None), (0.10, d1, 'out'), (0.42, d2, 'smooth'), (0.56, d2b, 'in'), (0.70, d3, 'in'), (0.82, d4, 'out'),
            (0.95, d3, 'in'), (1.25, d5, 'smooth'), (1.60, d6, 'smooth')]
    clips.append(Clip('Death', 1.60, keys=keys, events={'down': 0.70}, shots=[0, 0.1, 0.42, 0.7, 1.25, 1.6]))

    # ---------------------------------------------------------- Howl (the Warden's Hound): sits back, muzzle to the ceiling
    w1 = step(N0, {'Root.loc': (0, 0.05, -0.03), 'Hips': (-6, 0, 0), 'Chest': (6, 0, 0), 'Neck': (30, 0, 0), 'Head': (26, 0, 0),
                   'Jaw': (-30, 0, 0), 'Ear_L': (-20, 0, 0), 'Ear_R': (-20, 0, 0), 'Tail_01': (-12, 0, 0)})
    w2 = step(w1, {'Neck': (34, 0, 3), 'Head': (30, 0, 3), 'Jaw': (-36, 0, 0)})
    keys = [(0.0, N0, None), (0.30, w1, 'smooth'), (0.60, w2, 'smooth'), (0.95, w1, 'smooth'), (1.35, N0, 'smooth')]
    clips.append(Clip('Howl', 1.35, keys=keys, events={'release': 0.35}, shots=[0, 0.3, 0.6, 0.95, 1.15, 1.35]))
    return clips


# ====================================================================== variants
def variants():
    vs = [
        dict(id='cellar-hound', name='Cellar Hound', scale=1.0, parts=['hound_collar'], shapes={}, clipSpeed=1.0,
             role='fodder', palette=C.content_palette('cellar-hound')),
        dict(id='wardens-hound', name="Warden's Hound", scale=1.5, parts=['hound_chain', 'hound_ribs'], shapes={},
             clipSpeed=0.85, role='hunter', ghost=True, glow='#ff8a3d', palette=['#a8d8f0', '#1d1f24', '#ff8a3d'],
             clipMap={'Howl': 'Howl', 'Harry': 'Attack2'}),
        dict(id='pet-cellar-hound', name='Cellar Hound (pet)', scale=0.7, parts=['hound_rope'], shapes={'var_pup': 1.0},
             clipSpeed=1.1, role='pet', pet='cellar-hound', palette=C.content_palette('cellar-hound', pet=True)),
        dict(id='pet-bone-pup', name='Bone Pup (pet)', scale=0.7, parts=['hound_ribs'], shapes={'var_pup': 1.0},
             clipSpeed=1.1, role='pet', pet='bone-pup', glow='#4aa3ff', palette=C.content_palette('bone-pup', pet=True)),
    ]
    return vs


# ====================================================================== main
def main():
    C.log('build_hound: quick=%s' % QUICK)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = C.FPS
    M = C.Monster(BASE, quick=QUICK)
    M.view = dict(az=64.0, el=10.0)
    M.lineup_yaw = -62.0
    M.fight = dict(girth=1.0, count=3)
    M.rig = CRig('Rig', bone_table(), legs=LEGS, loc_bones=('Root',))
    body, parts = build_geometry(M.rig)
    M.body = body
    M.parts = parts
    M.variants = variants()
    lo = C.evaluated_coords(body)[:, 2].min()
    C.log('hound_body: %d tris, %d verts; rest lowest point %.1f mm' % (body['tris'], len(body.data.vertices), lo * 1000))
    for nm, ob in parts.items():
        C.log('%s: %d tris' % (nm, ob['tris']))
    for v in M.variants:
        C.log('variant %-18s x%.2f  %d tris  palette %s' % (v['id'], v['scale'], M.tris_of(v), v['palette']))
    M.clips = author(M.rig, M)
    M.bake_clips()
    M.check_clips()
    M.lines.append('')
    M.lines.append('- hound_body %d tris; parts %s' % (body['tris'], ', '.join('%s %d' % (n, o['tris']) for n, o in parts.items())))
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
        C.log('hound.glb %.1f KB' % kb)
        C.save_blend(os.path.join(C.BUILD, 'monsters_hound.blend'))
        from export import reimport_report
        for line in reimport_report(path):
            C.log(line)
    else:
        C.save_blend(os.path.join(C.BUILD, 'monsters_hound.blend'))


if __name__ == '__main__':
    main()

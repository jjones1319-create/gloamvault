"""build_species.py — the six species on both body frames (05-SPECIES §3 and §5, tools/blender/README.md).

Run:  blender -b art/build/hero_body.blend -P tools/blender/hero/build_species.py -- [--quick] [--norender]
      [--renders lineup,cards,heads,poses,keys] [--no-save]

Adds to the two frames of hero_body.blend and saves art/build/hero_species.blend (hero_body.blend is never written):

1. Species shape keys on Body_broad and Body_slight — spc_dwarf_broad, spc_elf_lean, spc_orc_bulk, spc_halfling_round,
   spc_draconid_ridge (Human is the basis). Built from the skeleton, the same code on both frames: cross-sections scaled
   about bone axes with the skin weights as the falloff (thick or lean limbs and torso; joints stay where they are) and
   local bumps and scales placed from face landmarks. Landmarks are vertex indices found once on the broad frame and
   read on both (one topology), so a "chin" is the same vertex on both frames.
2. Twelve face keys (face_brow_heavy … face_mouth_wide), small and local to the face.
3. Parts: species meshes and shared hair and brow styles, built on the broad frame and carried to the slight frame —
   fit.SurfaceMap for parts that hug the body, rigid by an anchor on the skull for ears, tusks and horns, through the
   tail bones for the tail. Every part carries the five species keys (transferred from the body's), head parts the
   twelve face keys too, and is skinned to the frame's rig.
4. Face presets (3 per species) → client/public/models/hero/manifest.json → `species` (other top-level keys kept).
5. Review renders → art/renders/hero/species/ (lineups, cards and their 200-px reads, preset heads, test poses, keys).

Bone scales (content/species/<id>.json → body.boneScales) are previewed the way 05-SPECIES §3's absolute proportions
read: every body bone's absolute scale is root × its group's factor (unlisted groups 1.0) — scales do not compound down
the chain — while the eyes and the chain bones (Tail, Ear, Beard, Hair) inherit their parent's scale.
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'lib'))
from common import BUILD, CONTENT, MODELS, RENDERS, REPO, args, collection, log, read_json, save_blend, write_json  # noqa: E402
import toon  # noqa: E402
from fit import SurfaceMap, triangulate  # noqa: E402

ARGS = args()
QUICK = bool(ARGS.get('quick'))
OUT = os.path.join(RENDERS, 'hero', 'species')
FRAMES = ('broad', 'slight')
SPECIES = ('human', 'dwarf', 'elf', 'orc', 'halfling', 'draconid')
SPECIES_KEY = {'dwarf': 'spc_dwarf_broad', 'elf': 'spc_elf_lean', 'orc': 'spc_orc_bulk',
               'halfling': 'spc_halfling_round', 'draconid': 'spc_draconid_ridge'}
SPC_KEYS = list(SPECIES_KEY.values())
FACE_KEYS = ['face_brow_heavy', 'face_brow_raise', 'face_jaw_wide', 'face_jaw_narrow', 'face_chin_long',
             'face_cheek_high', 'face_cheek_full', 'face_eye_big', 'face_eye_narrow', 'face_nose_wide',
             'face_nose_long', 'face_mouth_wide']
EPS = 5e-5             # deltas below 0.05 mm are written as exact zeros (sparse morph targets stay small)
HAIR_COLORS = ['#1f1b1e', '#3e2a1d', '#6b4026', '#9a4524', '#c69a5e', '#8b8985', '#e2ddd3', '#3d4a33']
HAIR_NAMES = ['raven', 'dark brown', 'chestnut', 'rust', 'wheat', 'iron grey', 'white', 'moss-dark']
BONE_COLORS = ['#e6dcc2', '#2b2a30', '#a8874a']     # ivory, obsidian, aged brass (05 §3.6)
EYE_COLORS = {                                       # 05-SPECIES §3 "Hair / eyes", the eye half
    'human': ['#5b3a22', '#7a6a34', '#4e7a3c', '#3f7fb8', '#7d8790'],
    'dwarf': ['#b27a22', '#4a2e1c', '#5d6b78'],
    'elf': ['#7a5aa8', '#b4bcc6', '#4f8a4a', '#c9a033'],
    'orc': ['#c28a28', '#8a3a24', '#c9b230'],
    'halfling': ['#5b3a22', '#4e7a3c', '#7a6a34'],
    'draconid': ['#d6a628', '#c27a1c', '#c4daf0'],
}


def V3(*a):
    return np.array(a, dtype=float)


def unit(v):
    n = float(np.linalg.norm(v))
    return v / n if n > 1e-12 else v


def falloff(d):
    """1 at d = 0, 0 from d = 1 on, smooth: (1 - d²)²."""
    t = np.clip(1.0 - d * d, 0.0, 1.0)
    return t * t


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


# ====================================================================== 1. the frames
class Frame:
    """One body frame: rest positions, normals, skin weights, bones and landmarks, as numpy arrays."""

    def __init__(self, name):
        self.name = name
        self.body = bpy.data.objects['Body_' + name]
        self.rig = bpy.data.objects['Rig_' + name]
        me = self.body.data
        if me.shape_keys:
            raise RuntimeError('Body_%s already has shape keys: run on hero_body.blend' % name)
        n = len(me.vertices)
        co = np.zeros(n * 3)
        me.vertices.foreach_get('co', co)
        self.V = co.reshape(n, 3)
        nor = np.zeros(n * 3)
        me.vertices.foreach_get('normal', nor)
        self.N = nor.reshape(n, 3)
        self.faces = [tuple(p.vertices) for p in me.polygons]
        self.n = n
        mw = self.rig.matrix_world
        self.bones = {}
        for b in self.rig.data.bones:
            m = (mw @ b.matrix_local).to_3x3().normalized()
            self.bones[b.name] = dict(head=np.array((mw @ b.head_local)[:]), tail=np.array((mw @ b.tail_local)[:]),
                                      M=np.array([list(m.col[0]), list(m.col[1]), list(m.col[2])]).T, length=b.length)
        names = {vg.index: vg.name for vg in self.body.vertex_groups}
        self.W = {nm: np.zeros(n) for nm in names.values()}
        self.Wd = []
        for v in me.vertices:
            d = {}
            for g in v.groups:
                if g.weight > 0:
                    d[names[g.group]] = g.weight
                    self.W[names[g.group]][v.index] = g.weight
            self.Wd.append(d)
        at = me.color_attributes['gv']
        self.region = np.array([round(d.color[1] * 15) for d in at.data])
        self.H = float(self.V[:, 2].max())
        self.hh = self.bones['Head']['length']
        self.eye_mask = (self.W['LeftEye'] > 0.5) | (self.W['RightEye'] > 0.5)

    def bone(self, name):
        return self.bones[name]


def find_landmarks(fr):
    """Vertex indices of the face landmarks, searched on the broad frame (the points are broad-frame metres)."""
    pts = {
        'nose': (0, -0.176, 1.585), 'noseBase': (0, -0.152, 1.568), 'noseBridge': (0, -0.146, 1.625),
        'glabella': (0, -0.148, 1.655), 'forehead': (0, -0.141, 1.700), 'upperLip': (0, -0.163, 1.551),
        'mouth': (0, -0.150, 1.541), 'lowerLip': (0, -0.160, 1.534), 'chin': (0, -0.152, 1.492),
        'chinBottom': (0, -0.118, 1.463), 'throat': (0, -0.075, 1.445),
        'mouthL': (0.030, -0.137, 1.542), 'jawL': (0.074, -0.046, 1.515), 'cheekL': (0.056, -0.124, 1.575),
        'zygoL': (0.075, -0.102, 1.603), 'browL': (0.040, -0.137, 1.657), 'browOutL': (0.068, -0.118, 1.652),
        'templeL': (0.090, -0.075, 1.680), 'nostrilL': (0.016, -0.158, 1.572),
        'chestFront': (0, -0.115, 1.25), 'belly': (0, -0.095, 1.00), 'nape': (0, 0.075, 1.53),
    }
    for k in list(pts):
        if k.endswith('L'):
            x, y, z = pts[k]
            pts[k[:-1] + 'R'] = (-x, y, z)
    ok = [i for i in range(fr.n) if not fr.eye_mask[i]]
    kd = KDTree(len(ok))
    for j, i in enumerate(ok):
        kd.insert(Vector(fr.V[i]), j)
    kd.balance()
    out = {}
    for k, p in pts.items():
        _, j, _ = kd.find(Vector(p))
        out[k] = ok[j]
    top = int(np.argmax(fr.V[:, 2]))
    out['crown'] = top
    return out


def setup_frame(fr, lm_idx, ear_idx):
    """Per-frame landmark positions, the head scale s (head bone length vs the broad frame's) and the eye data."""
    fr.lm = lm_idx
    fr.P = {k: fr.V[i].copy() for k, i in lm_idx.items()}
    fr.s = fr.hh / BROAD_HH[0]
    fr.eye = {}
    me = fr.body.data
    at = me.color_attributes['gv']
    slots = np.array([round(d.color[0] * 15) for d in at.data])
    for side, bone in (('L', 'LeftEye'), ('R', 'RightEye')):
        idx = np.where(fr.W[bone] > 0.5)[0]
        E = fr.V[idx]
        # the eyeball is a big sphere (r ~3.8 cm) mostly inside the head: fit it; the iris marks the opening
        A = np.c_[2 * E, np.ones(len(E))]
        sol = np.linalg.lstsq(A, (E ** 2).sum(1), rcond=None)[0]
        c = sol[:3]
        r = float(np.sqrt(sol[3] + c @ c))
        iris = idx[np.isin(slots[idx], (toon.SLOT['iris'], toon.SLOT['ink']))]
        o = fr.V[iris].mean(axis=0)
        fr.eye[side] = dict(c=c, idx=idx, r=r, o=o, k=r / 0.0377)
    fr.ear_idx = ear_idx
    fr.ear = {}
    for side, sg in (('L', 1), ('R', -1)):
        idx = ear_idx[side]
        c = fr.V[idx].mean(axis=0)
        top = fr.V[idx][:, 2].max()
        # the skull's side just above the ear: where the flattened ear lands
        band = (np.abs(fr.V[:, 2] - (top + 0.012 * fr.s)) < 0.005 * fr.s) & (fr.V[:, 0] * sg > 0) & ~fr.eye_mask
        x0 = 0.96 * float(np.abs(fr.V[band][:, 0]).max())
        fr.ear[side] = dict(c=c, x0=x0, top=top, sg=sg)


BROAD_HH = [None]


def find_ears(fr):
    """The round ears' vertices (broad frame): head vertices beside the skull, near the ear, outside the skull's width."""
    out = {}
    for side, sg in (('L', 1), ('R', -1)):
        outer = (fr.V[:, 0] * sg > 0.110) & (fr.V[:, 2] > 1.565) & (fr.V[:, 2] < 1.705) & (fr.V[:, 1] > -0.045) & (fr.V[:, 1] < 0.07)
        c = fr.V[outer].mean(axis=0)
        d = np.linalg.norm(fr.V - c, axis=1)
        sel = (d < 0.062) & (fr.V[:, 0] * sg > 0.093) & ~fr.eye_mask & (fr.region == 0)
        out[side] = np.where(sel)[0]
    return out


# ====================================================================== 2. deformations (deltas, numpy)
def ell(V, c, r):
    return np.sqrt((((V - c) / np.asarray(r, dtype=float)) ** 2).sum(axis=1))


def op_bump(fr, c, r, vec, amt, mask=None):
    """A smooth bump: every vertex inside the ellipsoid (c, r) moves along vec (a unit vector, or 'normal')."""
    w = falloff(ell(fr.V, c, r))
    if mask is not None:
        w = w * mask
    if isinstance(vec, str):
        d = fr.N
    else:
        d = np.broadcast_to(unit(np.asarray(vec, dtype=float)), fr.V.shape)
    return w[:, None] * amt * d


def op_scale(fr, c, r, s, pivot=None, mask=None):
    """Scales the region (c, r) by s = (sx, sy, sz) about pivot (default c), fading with the falloff."""
    w = falloff(ell(fr.V, c, r))
    if mask is not None:
        w = w * mask
    p = c if pivot is None else pivot
    return w[:, None] * (fr.V - p) * (np.asarray(s, dtype=float) - 1.0)


def op_thicken(fr, factors):
    """Scales each vertex's distance from a bone's axis by (sx, sz) along the bone's X and Z, weighted by its skin
    weight on that bone: thicker or leaner limbs and torso, the joints unmoved."""
    D = np.zeros_like(fr.V)
    for name, f in factors.items():
        sx, sz = (f, f) if np.isscalar(f) else f
        w = fr.W.get(name)
        if w is None:
            continue
        sel = np.where(w > 0)[0]
        if not len(sel):
            continue
        b = fr.bones[name]
        h, t = b['head'], b['tail']
        ax = t - h
        L2 = float(ax @ ax)
        P = fr.V[sel]
        tt = np.clip(((P - h) @ ax) / L2, 0.0, 1.0)
        C = h + tt[:, None] * ax
        R = P - C
        X, Z = b['M'][:, 0], b['M'][:, 2]
        rx = (R @ X)[:, None] * X
        rz = (R @ Z)[:, None] * Z
        D[sel] += w[sel][:, None] * (rx * (sx - 1.0) + rz * (sz - 1.0))
    return D


def both(name):
    return ['Left' + name, 'Right' + name]


FINGERS = [s + f + p for s in ('Left', 'Right') for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Little')
           for p in ('Proximal', 'Intermediate', 'Distal')]


def groups(spec):
    """{'UpperArm': 1.1, 'Spine': (1.1, 1.2), 'fingers': 1.1} → per-bone factors (paired names get both sides)."""
    out = {}
    for k, f in spec.items():
        if k == 'fingers':
            for b in FINGERS:
                out[b] = f
        elif k in ('Shoulder', 'UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot', 'Toes'):
            for b in both(k):
                out[b] = f
        else:
            out[k] = f
    return out


def not_eyes(fr):
    return (~fr.eye_mask).astype(float)


def front_mask(fr, y_back):
    """1 for vertices in front of y_back (fades over 2 cm): keeps face bumps off the back of the head."""
    return 1.0 - smoothstep(y_back - 0.01 * fr.s, y_back + 0.01 * fr.s, fr.V[:, 1])


# ---------------------------------------------------------------------- face keys
def lid_rotation(fr, up_deg, low_deg):
    """Closes (or opens) the lids: the skin around the eye opening turns about the eyeball's left-right axis, so it
    slides over the ball instead of cutting into it; upper and lower lids apart."""
    D = np.zeros_like(fr.V)
    for side in ('L', 'R'):
        e = fr.eye[side]
        c, o, k = e['c'], e['o'], e['k']
        q = fr.V - c
        d = np.linalg.norm(fr.V - o, axis=1)
        w = (1.0 - smoothstep(0.024 * k, 0.04 * k, d)) * (~fr.eye_mask)
        ang = np.where(fr.V[:, 2] > o[2], math.radians(up_deg), -math.radians(low_deg)) * w
        ca, sa = np.cos(ang), np.sin(ang)
        y2 = q[:, 1] * ca - q[:, 2] * sa
        z2 = q[:, 1] * sa + q[:, 2] * ca
        D[:, 1] += y2 - q[:, 1]
        D[:, 2] += z2 - q[:, 2]
    return D


def eye_scale(fr, s):
    """A bigger eye: the ball and the skin around the opening scaled together about the ball's centre."""
    D = np.zeros_like(fr.V)
    for side in ('L', 'R'):
        e = fr.eye[side]
        c, o, k = e['c'], e['o'], e['k']
        d = np.linalg.norm(fr.V - o, axis=1)
        w = 1.0 - smoothstep(0.027 * k, 0.046 * k, d)
        w[e['idx']] = 1.0
        D += w[:, None] * (fr.V - c) * (s - 1.0)
    return D


def face_key(fr, name):
    P, s = fr.P, fr.s
    ne = not_eyes(fr)
    D = np.zeros_like(fr.V)
    if name == 'face_brow_heavy':
        for sd in 'LR':
            D += op_bump(fr, P['brow' + sd] + V3(0, 0.004, 0.003) * s, V3(0.034, 0.03, 0.016) * s, (0, -0.9, -0.42), 0.0064 * s, ne)
        D += op_bump(fr, P['glabella'] + V3(0, 0.004, 0.0) * s, V3(0.02, 0.03, 0.014) * s, (0, -1, -0.2), 0.0042 * s, ne)
    elif name == 'face_brow_raise':
        for sd in 'LR':
            D += op_bump(fr, P['brow' + sd] + V3(0, 0.006, 0.012) * s, V3(0.045, 0.05, 0.034) * s, (0, 0, 1), 0.0058 * s, ne)
    elif name in ('face_jaw_wide', 'face_jaw_narrow'):
        sg = 1.0 if name == 'face_jaw_wide' else -1.0
        for sd, x in (('L', 1), ('R', -1)):
            D += op_bump(fr, P['jaw' + sd] + V3(0, -0.012, 0.0) * s, V3(0.04, 0.065, 0.042) * s, (x, 0, 0), sg * 0.0065 * s, ne)
        D += op_scale(fr, P['chin'] + V3(0, 0.01, 0) * s, V3(0.045, 0.045, 0.035) * s, (1.0 + sg * 0.11, 1, 1), pivot=V3(0, 0, 0), mask=ne)
    elif name == 'face_chin_long':
        D += op_bump(fr, P['chin'] + V3(0, 0.012, -0.004) * s, V3(0.046, 0.065, 0.042) * s, (0, -0.3, -1), 0.0072 * s, ne)
    elif name == 'face_cheek_high':
        for sd in 'LR':
            D += op_bump(fr, P['zygo' + sd], V3(0.03, 0.03, 0.021) * s, 'normal', 0.0058 * s, ne)
            D += op_bump(fr, P['zygo' + sd], V3(0.03, 0.03, 0.021) * s, (0, 0, 1), 0.0025 * s, ne)
            D += op_bump(fr, P['cheek' + sd] + V3(0, 0.004, -0.008) * s, V3(0.024, 0.03, 0.018) * s, 'normal', -0.0035 * s, ne)
    elif name == 'face_cheek_full':
        for sd in 'LR':
            D += op_bump(fr, P['cheek' + sd] + V3(0, 0.0, -0.004) * s, V3(0.036, 0.04, 0.03) * s, 'normal', 0.0085 * s, ne)
    elif name == 'face_eye_big':
        D += eye_scale(fr, 1.1)
    elif name == 'face_eye_narrow':
        D += lid_rotation(fr, 10.0, 6.0)
    elif name == 'face_nose_wide':
        D += op_scale(fr, P['noseBase'] + V3(0, -0.006, 0.006) * s, V3(0.03, 0.04, 0.026) * s, (1.38, 1, 1), pivot=V3(0, 0, 0), mask=ne)
    elif name == 'face_nose_long':
        D += op_bump(fr, P['nose'], V3(0.022, 0.032, 0.03) * s, (0, -1, -0.55), 0.0052 * s, ne)
    elif name == 'face_mouth_wide':
        for sd, x in (('L', 1), ('R', -1)):
            D += op_bump(fr, P['mouth' + sd], V3(0.024, 0.03, 0.018) * s, (x, 0.22, 0), 0.006 * s, ne)
        D += op_scale(fr, P['mouth'], V3(0.042, 0.03, 0.016) * s, (1.14, 1, 1), pivot=V3(0, 0, 0), mask=ne)
    else:
        raise KeyError(name)
    # a safety net only: nothing of the face reaches behind the ears
    return D * front_mask(fr, fr.eye['L']['c'][1] + 0.15 * s)[:, None]


# ---------------------------------------------------------------------- species keys
def flatten_ears(fr, amount, shrink=0.5):
    """Folds the round ears flat against the skull (Elf and Orc wear part ears over them; the Draconid has none)."""
    D = np.zeros_like(fr.V)
    for side in ('L', 'R'):
        e = fr.ear[side]
        idx = fr.ear_idx[side]
        P = fr.V[idx]
        sg = e['sg']
        ex = P[:, 0] * sg - e['x0']
        w = falloff(np.linalg.norm(P - e['c'], axis=1) / (0.066 * fr.s))
        out = np.clip(ex, 0.0, None)
        dx = -sg * (out * amount + 0.0025 * fr.s * smoothstep(0.0, 0.004 * fr.s, out)) * w
        k = np.clip(out / (0.01 * fr.s), 0.0, 1.0) * w * shrink * amount
        dyz = (e['c'][1:] - P[:, 1:]) * k[:, None]
        D[idx, 0] += dx
        D[idx, 1:] += dyz
    return D


def muzzle(fr, amt):
    """The Draconid's short muzzle: nose, mouth and chin pushed forward and widened, nothing from the lower lids up."""
    P, s, V = fr.P, fr.s, fr.V
    ez = fr.eye['L']['c'][2]
    # 0 at the lower lids, 1 from just above the nose tip down (edges given high → low)
    fz_top = smoothstep(ez - 0.024 * s, P['nose'][2] + 0.008 * s, V[:, 2])
    fz_bot = smoothstep(P['chinBottom'][2] - 0.018 * s, P['chin'][2], V[:, 2])
    fz = fz_top * fz_bot
    fx = 1.0 - smoothstep(0.03 * s, 0.095 * s, np.abs(V[:, 0]))
    fy = 1.0 - smoothstep(P['nose'][1] + 0.06 * s, P['nose'][1] + 0.14 * s, V[:, 1])
    w = fz * fx * fy
    D = np.zeros_like(V)
    D[:, 1] -= w * amt
    D[:, 0] += w * V[:, 0] * 0.16
    D[:, 2] -= w * amt * 0.06
    # the bridge between the eyes slopes into the snout: no human nose bridge step under the brow
    D += op_bump(fr, P['noseBridge'] + V3(0, 0.006, -0.008) * s, V3(0.016, 0.045, 0.034) * s, (0, -1, 0), amt * 0.55, not_eyes(fr))
    return D


def trunk_bump(fr, c, r, vec, amt):
    return op_bump(fr, np.asarray(c, dtype=float) * np.array([1, 1, fr.H / BROAD_H[0]]), np.asarray(r) * fr.H / BROAD_H[0], vec, amt * fr.H / BROAD_H[0])


BROAD_H = [None]


def species_key(fr, sp):
    P, s = fr.P, fr.s
    ne = not_eyes(fr)
    D = np.zeros_like(fr.V)
    if sp == 'dwarf':
        # a barrel: the ribcage deeper more than wider (wider would push into the arms in the A-pose), a thick belly,
        # heavy forearms and calves, a short thick neck
        D += op_thicken(fr, groups({
            'Hips': (1.14, 1.14), 'Spine': (1.28, 1.36), 'Chest': (1.24, 1.36), 'UpperChest': (1.2, 1.32),
            'Shoulder': 1.22, 'UpperArm': 1.27, 'LowerArm': 1.32, 'Hand': (1.1, 1.14), 'fingers': 1.12,
            'UpperLeg': 1.22, 'LowerLeg': 1.28, 'Foot': 1.08, 'Neck': (1.28, 1.22)}))
        # a round, hard belly under the barrel
        k = fr.H / BROAD_H[0]
        w = falloff(ell(fr.V, P['belly'] + V3(0, 0.03, 0.01) * k, V3(0.14, 0.12, 0.14) * k))
        fwd = fr.N + V3(0, -1.0, 0)
        fwd /= np.linalg.norm(fwd, axis=1)[:, None]
        D += w[:, None] * fwd * 0.018 * k
        D += 1.15 * face_key(fr, 'face_brow_heavy') + 1.1 * face_key(fr, 'face_jaw_wide')
        D += 0.4 * face_key(fr, 'face_cheek_full') + 0.4 * face_key(fr, 'face_nose_wide')
        D += op_scale(fr, P['nose'] + V3(0, 0.012, 0.002) * s, V3(0.03, 0.045, 0.032) * s, (1.12, 1.16, 1.12), pivot=P['noseBase'] + V3(0, 0.01, 0) * s, mask=ne)
    elif sp == 'elf':
        D += op_thicken(fr, groups({
            'Hips': (0.95, 0.95), 'Spine': (0.91, 0.92), 'Chest': (0.92, 0.93), 'UpperChest': (0.93, 0.93),
            'Shoulder': 0.94, 'UpperArm': 0.9, 'LowerArm': 0.9, 'Hand': 0.95, 'UpperLeg': 0.92, 'LowerLeg': 0.9,
            'Neck': (0.9, 0.92)}))
        D += 1.1 * face_key(fr, 'face_chin_long') + 1.0 * face_key(fr, 'face_jaw_narrow')
        D += 1.0 * face_key(fr, 'face_cheek_high') + 0.25 * face_key(fr, 'face_eye_narrow')
        D += 0.4 * face_key(fr, 'face_nose_long') + 0.25 * face_key(fr, 'face_brow_raise')
        D += flatten_ears(fr, 0.92)
    elif sp == 'orc':
        D += op_thicken(fr, groups({
            'Spine': (1.05, 1.06), 'Chest': (1.1, 1.12), 'UpperChest': (1.14, 1.16), 'Shoulder': 1.2,
            'UpperArm': 1.16, 'LowerArm': 1.16, 'Hand': (1.1, 1.12), 'fingers': 1.18, 'Neck': (1.18, 1.16),
            'UpperLeg': 1.06, 'LowerLeg': 1.06}))
        for x in (1, -1):
            D += trunk_bump(fr, (0.085 * x, 0.012, 1.425), (0.075, 0.07, 0.062), (0.3 * x, 0.45, 0.85), 0.019)
        D += 1.3 * face_key(fr, 'face_jaw_wide') + 0.4 * face_key(fr, 'face_chin_long') + 1.35 * face_key(fr, 'face_brow_heavy')
        D += op_bump(fr, P['chin'] + V3(0, 0.01, 0) * s, V3(0.042, 0.05, 0.03) * s, (0, -1, 0), 0.0055 * s, ne)
        D += op_bump(fr, P['lowerLip'] + V3(0, 0.006, 0) * s, V3(0.034, 0.03, 0.012) * s, (0, -1, 0), 0.004 * s, ne)
        D += op_scale(fr, P['noseBase'] + V3(0, -0.006, 0.007) * s, V3(0.033, 0.045, 0.03) * s, (1.36, 0.72, 0.9),
                      pivot=P['noseBase'] + V3(0, 0.004, 0.004) * s, mask=ne)
        D += flatten_ears(fr, 0.92)
    elif sp == 'halfling':
        D += op_thicken(fr, groups({
            'Hips': (1.04, 1.06), 'Spine': (1.1, 1.16), 'Chest': (1.03, 1.05), 'UpperArm': 1.06, 'LowerArm': 1.04,
            'UpperLeg': 1.06, 'LowerLeg': 1.04, 'Neck': (1.1, 1.1)}))
        bel = P['belly'] + V3(0, 0.03, -0.02) * fr.H / BROAD_H[0]
        w = falloff(ell(fr.V, bel, V3(0.13, 0.12, 0.13) * fr.H / BROAD_H[0]))
        fwd = fr.N + V3(0, -1.2, 0)
        fwd /= np.linalg.norm(fwd, axis=1)[:, None]
        D += w[:, None] * fwd * 0.026 * fr.H / BROAD_H[0]
        D += 1.2 * face_key(fr, 'face_cheek_full') + 0.5 * face_key(fr, 'face_jaw_wide') - 0.5 * face_key(fr, 'face_chin_long')
        D += op_scale(fr, P['nose'] + V3(0, 0.01, 0.002) * s, V3(0.03, 0.045, 0.032) * s, (0.84, 0.8, 0.86), pivot=P['noseBase'] + V3(0, 0.012, 0) * s, mask=ne)
        D += 0.3 * face_key(fr, 'face_eye_big') + 0.2 * face_key(fr, 'face_brow_raise')
    elif sp == 'draconid':
        D += op_thicken(fr, groups({
            'Neck': (1.24, 1.22), 'Chest': (1.04, 1.06), 'UpperChest': (1.06, 1.08), 'Shoulder': 1.05,
            'UpperArm': 1.04, 'LowerArm': 1.04}))
        D += muzzle(fr, 0.052 * s)
        # a flat snout front: the human nose pressed into it, nostrils wide
        D += op_scale(fr, P['noseBase'] + V3(0, -0.008, 0.007) * s, V3(0.03, 0.045, 0.03) * s, (1.25, 0.45, 0.82),
                      pivot=P['noseBase'] + V3(0, 0.004, 0.004) * s, mask=ne)
        D += 2.2 * face_key(fr, 'face_mouth_wide') + 1.5 * face_key(fr, 'face_brow_heavy') + 0.6 * face_key(fr, 'face_jaw_wide')
        for sd, x in (('L', 1), ('R', -1)):
            D += op_bump(fr, P['browOut' + sd] + V3(0, 0.004, 0.006) * s, V3(0.03, 0.03, 0.016) * s, (0.4 * x, -0.8, 0.2), 0.0045 * s, ne)
        D += flatten_ears(fr, 0.85)
        k = fr.H / BROAD_H[0]
        D += op_bump(fr, P['chestFront'] + V3(0, 0.02, 0) * k, V3(0.1, 0.07, 0.09) * k, (0, -1, 0), 0.008 * k)
    else:
        raise KeyError(sp)
    return D


def clean(D, eps=EPS):
    D = D.copy()
    D[np.linalg.norm(D, axis=1) < eps] = 0.0
    return D


PART_EPS = 1e-4        # a part's key deltas under 0.1 mm are zeros (most of a hair cap barely moves for a body key)


def wearers(species):
    """The species that may wear a part: its own, or every species with hair (shared hair and brows)."""
    return [species] if species else ['human', 'dwarf', 'elf', 'orc', 'halfling']


def add_keys(ob, rest, deltas):
    """Basis + one key per (name, delta) on ob (vertex order = rest's)."""
    if ob.data.shape_keys is None:
        ob.shape_key_add(name='Basis', from_mix=False)
    for name, D in deltas:
        kb = ob.shape_key_add(name=name, from_mix=False)
        kb.data.foreach_set('co', (rest + D).ravel())
        kb.slider_min = -1.0
        kb.slider_max = 1.0
        kb.value = 0.0


# ====================================================================== 3. geometry for parts
class MB:
    """A mesh under construction: vertices, faces and each face's palette slot."""

    def __init__(self):
        self.v, self.f, self.slot, self.comp = [], [], [], []
        self.cur = 0

    def vert(self, p):
        self.v.append(np.asarray(p, dtype=float))
        self.comp.append(self.cur)
        return len(self.v) - 1

    def face(self, idx, slot):
        self.f.append(tuple(idx))
        self.slot.append(slot)

    def bridge(self, a, b, slot, closed=True, slots=None):
        n = len(a)
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            self.face((a[i], a[j], b[j], b[i]), slots[i] if slots else slot)

    def fan(self, ring, c, slot, flip=False):
        n = len(ring)
        for i in range(n):
            j = (i + 1) % n
            self.face((ring[j], ring[i], c) if not flip else (ring[i], ring[j], c), slot)


def rmf(path, up):
    """Rotation-minimising frames (tangent, normal, binormal) along a polyline; the first normal leans toward `up`."""
    P = [np.asarray(p, dtype=float) for p in path]
    n = len(P)
    T = []
    for i in range(n):
        a = P[max(0, i - 1)]
        b = P[min(n - 1, i + 1)]
        T.append(unit(b - a))
    up = np.asarray(up, dtype=float)
    N = [unit(up - (up @ T[0]) * T[0])]
    for i in range(1, n):
        v = N[-1] - (N[-1] @ T[i]) * T[i]
        N.append(unit(v))
    B = [unit(np.cross(T[i], N[i])) for i in range(n)]
    return P, T, N, B


def tube(mb, path, rads, up, n=6, slot=2, tip=True, cap0=False, slots_fn=None, rot=0.0):
    """Loft rings along path: rads[i] = (width along the binormal, height along the normal). Ends in a point (tip)
    or an open/flat end. slots_fn(ring index, side index) → slot per face lets one tube carry two colours."""
    P, T, N, B = rmf(path, up)
    rings = []
    last = len(P) - 1
    for i in range(len(P)):
        if tip and i == last:
            rings.append([mb.vert(P[i])])
            continue
        rw, rh = rads[i]
        ring = []
        for k in range(n):
            a = 2 * math.pi * k / n + rot
            ring.append(mb.vert(P[i] + rw * math.cos(a) * B[i] + rh * math.sin(a) * N[i]))
        rings.append(ring)
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        if len(b) == 1:
            for k in range(n):
                sl = slots_fn(i, k) if slots_fn else slot
                mb.face((a[k], a[(k + 1) % n], b[0]), sl)
        else:
            for k in range(n):
                sl = slots_fn(i, k) if slots_fn else slot
                mb.face((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]), sl)
    if cap0:
        c = mb.vert(P[0] - T[0] * 0.001)
        mb.fan(rings[0], c, slot, flip=False)
    if not tip and len(rings[-1]) > 1:
        c = mb.vert(P[-1] + T[-1] * 0.001)
        mb.fan(rings[-1], c, slot, flip=True)
    return rings


def catmull(pts, per=3):
    """Catmull-Rom through pts, `per` samples per span (ends included)."""
    P = [np.asarray(p, dtype=float) for p in pts]
    if len(P) < 3:
        return P
    out = []
    ext = [2 * P[0] - P[1]] + P + [2 * P[-1] - P[-2]]
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for k in range(per):
            t = k / per
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-1])
    return out


def lerp(a, b, t):
    return a + (b - a) * t


class Surf:
    """The broad body's rest surface (eyeballs left out): rays and nearest points with smooth normals."""

    def __init__(self, fr, exclude=None):
        self.fr = fr
        keep = [f for f in fr.faces if not all(fr.eye_mask[i] for i in f)]
        if exclude:
            keep = [f for f in keep if not any(i in exclude for i in f)]
        self.tris = triangulate(keep)
        self.T = np.array(self.tris)
        self.bvh = BVHTree.FromPolygons([Vector(v) for v in fr.V], self.tris)
        self.VN = fr.N
        self.V = fr.V

    def _normal(self, ti, loc):
        a, b, c = self.T[ti]
        pa, pb, pc = self.V[a], self.V[b], self.V[c]
        v0, v1, v2 = pb - pa, pc - pa, np.asarray(loc) - pa
        d00, d01, d11 = v0 @ v0, v0 @ v1, v1 @ v1
        d20, d21 = v2 @ v0, v2 @ v1
        den = d00 * d11 - d01 * d01
        if abs(den) < 1e-16:
            return unit(self.VN[a])
        v = (d11 * d20 - d01 * d21) / den
        w = (d00 * d21 - d01 * d20) / den
        u = 1 - v - w
        return unit(self.VN[a] * u + self.VN[b] * v + self.VN[c] * w)

    def ray(self, o, d, maxd=2.0):
        loc, nor, ti, dist = self.bvh.ray_cast(Vector(o), Vector(unit(np.asarray(d, dtype=float))), maxd)
        if loc is None:
            return None
        return np.array(loc[:]), self._normal(ti, loc)

    def nearest(self, p):
        loc, nor, ti, dist = self.bvh.find_nearest(Vector(p))
        return np.array(loc[:]), self._normal(ti, loc), dist


HEAD_C = V3(0.0, -0.004, 1.655)    # the skull's middle on the broad frame: hair is cast from here


def hdir(u, th):
    """Head-space direction: u = degrees around the vertical from the front (−Y) toward the character's left (+X),
    th = degrees down from straight up."""
    u, th = math.radians(u), math.radians(th)
    return V3(math.sin(th) * math.sin(u), -math.sin(th) * math.cos(u), math.cos(th))


def head_point(S, u, th, off):
    r = S.ray(HEAD_C, hdir(u, th))
    if r is None:
        raise RuntimeError('no scalp at u %.0f th %.0f' % (u, th))
    p, n = r
    return p + n * off, n


def periodic(ctrl):
    """ctrl: [(u, value)] for u in 0..180 (mirrored to 360) → smooth function of u (degrees)."""
    xs = [u for u, _ in ctrl]
    ys = [v for _, v in ctrl]

    def f(u):
        u = u % 360.0
        if u > 180:
            u = 360 - u
        return float(np.interp(u, xs, ys))
    return f


def hair_cap(mb, S, thmax, thick, n_u=18, n_v=5, slot=2, bury=0.0016):
    """A shell over the scalp: a polar grid from the crown to the hairline thmax(u), pushed out by thick(u, t) along the
    scalp's normal; the hairline ring sinks under the skin so no edge shows."""
    pole_p, pole_n = head_point(S, 0, 0, thick(0, 0.0))
    pole = mb.vert(pole_p)
    rings = []
    for j in range(1, n_v + 1):
        t = j / n_v
        ring = []
        for i in range(n_u):
            u = 360.0 * i / n_u
            th = (t ** 0.85) * thmax(u)
            off = thick(u, t) if j < n_v else -bury
            p, _ = head_point(S, u, th, off)
            ring.append(mb.vert(p))
        rings.append(ring)
    mb.fan(rings[0], pole, slot, flip=True)
    for a, b in zip(rings, rings[1:]):
        mb.bridge(a, b, slot)
    return rings


def lock(mb, S, ctrl, width, thick, slot=2, n=4, per=2, free_after=None):
    """A chunky lock of hair lying on the head: ctrl = [(u, th, offset)] head-space points (projected on the scalp), or
    3-vectors (free points). Width and thickness taper (lists per control point, interpolated)."""
    pts, nrm = [], []
    for c in ctrl:
        if isinstance(c, np.ndarray):          # a free point (metres)
            p = c
            nn = unit(p - HEAD_C)
        else:                                  # (u, th, offset) on the scalp
            p, nn = head_point(S, c[0], c[1], c[2])
        pts.append(p)
        nrm.append(nn)
    path = catmull(pts, per)
    m = len(path)
    ws = np.interp(np.linspace(0, 1, m), np.linspace(0, 1, len(width)), width)
    hs = np.interp(np.linspace(0, 1, m), np.linspace(0, 1, len(thick)), thick)
    up = nrm[0]
    return tube(mb, path, list(zip(ws, hs)), up, n=n, slot=slot, tip=True, cap0=False)


def blob(mb, c, r, axis=None, flat=1.0, slot=2, sub=0):
    """A low-poly ball (icosahedron), squashed along `axis` by `flat`."""
    t = (1.0 + 5 ** 0.5) / 2.0
    vs = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t),
          (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    fs = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6),
          (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10),
          (8, 6, 7), (9, 8, 1)]
    vs = [unit(V3(*v)) for v in vs]
    axis = unit(np.asarray(axis, dtype=float)) if axis is not None else None
    idx = []
    for v in vs:
        p = v * r
        if axis is not None:
            p = p - (1.0 - flat) * (p @ axis) * axis
        idx.append(mb.vert(np.asarray(c) + p))
    for f in fs:
        mb.face((idx[f[0]], idx[f[1]], idx[f[2]]), slot)
    return idx


def ellipsoid(mb, c, rx, ry, rz, nu=8, nv=5, slot=2, R=None):
    """A UV ellipsoid (poles on local Z)."""
    R = np.eye(3) if R is None else R
    top = mb.vert(c + R @ V3(0, 0, rz))
    rings = []
    for j in range(1, nv):
        th = math.pi * j / nv
        ring = []
        for i in range(nu):
            ph = 2 * math.pi * i / nu
            ring.append(mb.vert(c + R @ V3(rx * math.sin(th) * math.cos(ph), ry * math.sin(th) * math.sin(ph), rz * math.cos(th))))
        rings.append(ring)
    bot = mb.vert(c + R @ V3(0, 0, -rz))
    mb.fan(rings[0], top, slot, flip=True)
    for a, b in zip(rings, rings[1:]):
        mb.bridge(a, b, slot)
    mb.fan(rings[-1], bot, slot)


# ====================================================================== 4. the parts
# Every builder works on the broad frame (S = its surface, fr = the broad Frame) and returns an MB. Coordinates are
# broad-frame metres (the head's middle ~ (0, 0, 1.655), eyes at x ±0.042, z 1.630; the face toward −Y).
HAIR, BONE, SKIN, SKIN2, LEATHER = toon.SLOT['hair'], toon.SLOT['bone'], toon.SLOT['skin'], toon.SLOT['skin2'], toon.SLOT['leather']

HAIRLINE = periodic([(0, 60), (25, 61), (50, 66), (75, 70), (92, 68), (108, 86), (125, 104), (150, 122), (180, 128)])


def cap_thick(top, front=0.0, edge=0.25):
    def f(u, t):
        fr_boost = front * max(0.0, math.cos(math.radians(u))) * (1.0 - t)
        return (top + fr_boost) * (1.0 - (1.0 - edge) * t ** 1.6)
    return f


def fringe_points(mb, S, us, th_in, th_out, w, h, off_in):
    for u in us:
        lock(mb, S, [(u, th_in, off_in), (u, (th_in + th_out) / 2, h * 0.9), (u * 1.03, th_out, 0.0015)], [w, w * 0.85, 0.0], [h, h * 0.8, 0.0])


def build_hair_crop(fr, S):
    mb = MB()
    hl = periodic([(0, 58), (30, 60), (60, 66), (80, 68), (95, 67), (110, 82), (130, 98), (155, 112), (180, 116)])
    hair_cap(mb, S, hl, cap_thick(0.0075, front=0.003), n_u=18, n_v=5)
    # a short, uneven fringe (a few broad points, not a zigzag) and sideburns
    for u, th_out, w in ((-30, 63, 0.03), (-6, 67, 0.034), (20, 64, 0.03), (40, 66, 0.026)):
        lock(mb, S, [(u * 0.9, 46, 0.0045), (u, 56, 0.0055), (u * 1.04, th_out, 0.0015)], [w, w * 0.8, 0.0], [0.006, 0.005, 0.0])
    for u in (-96, 96):
        lock(mb, S, [(u * 0.94, 62, 0.004), (u * 0.86, 78, 0.003), (u * 0.82, 92, 0.0012)], [0.022, 0.016, 0.0], [0.005, 0.004, 0.0])
    for u in (-160, -140, 140, 160, 180):
        lock(mb, S, [(u, 96, 0.005), (u, 108, 0.004), (u, 120, 0.0012)], [0.028, 0.022, 0.0], [0.005, 0.004, 0.0])
    return mb


def build_hair_shaggy(fr, S):
    mb = MB()
    hl = periodic([(0, 56), (30, 59), (60, 64), (80, 66), (95, 66), (110, 84), (130, 104), (155, 118), (180, 122)])
    hair_cap(mb, S, hl, cap_thick(0.015, front=0.004), n_u=18, n_v=5)
    for u, l in ((-40, 72), (-20, 76), (0, 74), (20, 77), (40, 71)):           # fringe to the brow
        lock(mb, S, [(u * 0.6, 22, 0.014), (u * 0.85, 48, 0.012), (u, l, 0.004)], [0.03, 0.032, 0.0], [0.009, 0.007, 0.0])
    for x in (1, -1):
        lock(mb, S, [(62 * x, 30, 0.014), (70 * x, 56, 0.012), (78 * x, 74, 0.004)], [0.03, 0.03, 0.0], [0.009, 0.007, 0.0])
        lock(mb, S, [(92 * x, 34, 0.014), (100 * x, 58, 0.013), (112 * x, 80, 0.005)], [0.032, 0.03, 0.0], [0.01, 0.008, 0.0])
        lock(mb, S, [(122 * x, 50, 0.014), (130 * x, 82, 0.012), (134 * x, 112, 0.004)], [0.034, 0.03, 0.0], [0.01, 0.008, 0.0])
        lock(mb, S, [(150 * x, 60, 0.014), (156 * x, 98, 0.012), (160 * x, 126, 0.004)], [0.034, 0.03, 0.0], [0.01, 0.008, 0.0])
    lock(mb, S, [(180, 62, 0.014), (180, 100, 0.012), (180, 130, 0.004)], [0.036, 0.032, 0.0], [0.01, 0.008, 0.0])
    for u in (-12, 12, 165, -165, 70, -70):                                   # tufts on top break the outline
        lock(mb, S, [(u, 10, 0.012), (u, 24, 0.022), (u * 1.05, 38, 0.016)], [0.026, 0.022, 0.0], [0.008, 0.006, 0.0])
    return mb


def build_hair_long(fr, S):
    mb = MB()
    hl = periodic([(0, 57), (30, 60), (60, 66), (80, 68), (95, 67), (110, 86), (130, 106), (155, 122), (180, 128)])
    rings = hair_cap(mb, S, hl, cap_thick(0.012), n_u=18, n_v=5)
    # a centre parting suggested by two locks swept to the sides
    for x in (1, -1):
        lock(mb, S, [(6 * x, 8, 0.012), (30 * x, 40, 0.013), (60 * x, 62, 0.006)], [0.034, 0.03, 0.0], [0.008, 0.007, 0.0])
        lock(mb, S, [(8 * x, 22, 0.012), (78 * x, 52, 0.013), (104 * x, 76, 0.007)], [0.034, 0.03, 0.0], [0.009, 0.008, 0.0])
    # the back curtain: columns from behind one ear around the back to the other, hanging to the shoulder blades
    cols = 9
    rows = 6
    outer, inner = [], []
    for ci in range(cols):
        a = 108 + 144 * ci / (cols - 1)               # azimuth around the back: 108 (behind the left ear) … 252 (right)
        oc, ic = [], []
        # top rows on the head
        for j, th in enumerate((84, 104, 122)):
            p, n = head_point(S, a, th, 0.013 - 0.002 * j)
            q, _ = head_point(S, a, th, -0.002)
            oc.append(p)
            ic.append(q)
        # hanging rows: fall from the last head point, outward and down
        base = oc[-1]
        side = math.sin(math.radians(a))
        for j, dz in enumerate((0.07, 0.15, 0.23)):
            drop = V3(side * 0.016 * (j + 1), 0.016 + 0.006 * j, -dz)
            o = base + drop
            # keep it off the back: push out from the body's surface
            near, nn, dist = S.nearest(o)
            if dist < 0.018:
                o = near + nn * 0.018
            oc.append(o)
            ic.append(o - unit(nn) * 0.012 + V3(0, 0, 0.004))
        outer.append(oc)
        inner.append(ic)
    O = [[mb.vert(outer[c][r]) for r in range(rows)] for c in range(cols)]
    I = [[mb.vert(inner[c][r]) for r in range(rows)] for c in range(cols)]
    for c in range(cols - 1):
        for r in range(rows - 1):
            mb.face((O[c][r], O[c][r + 1], O[c + 1][r + 1], O[c + 1][r]), HAIR)
            mb.face((I[c][r], I[c + 1][r], I[c + 1][r + 1], I[c][r + 1]), HAIR)
    for c in (0, cols - 1):                         # side walls
        for r in range(rows - 1):
            if c == 0:
                mb.face((O[c][r], I[c][r], I[c][r + 1], O[c][r + 1]), HAIR)
            else:
                mb.face((O[c][r], O[c][r + 1], I[c][r + 1], I[c][r]), HAIR)
    # pointed ends along the bottom: each column pair meets at a tip
    for c in range(cols - 1):
        mid = (outer[c][-1] + outer[c + 1][-1] + inner[c][-1] + inner[c + 1][-1]) / 4 + V3(0, 0.002, -0.05 - 0.012 * (c % 2))
        t = mb.vert(mid)
        mb.face((O[c][-1], O[c + 1][-1], t), HAIR)
        mb.face((I[c + 1][-1], I[c][-1], t), HAIR)
        if c == 0:
            mb.face((I[c][-1], O[c][-1], t), HAIR)
        if c == cols - 2:
            mb.face((O[c + 1][-1], I[c + 1][-1], t), HAIR)
    return mb


def build_hair_tied(fr, S):
    mb = MB()
    hl = periodic([(0, 57), (30, 60), (60, 66), (80, 68), (95, 67), (110, 84), (130, 102), (155, 118), (180, 124)])
    hair_cap(mb, S, hl, cap_thick(0.0085), n_u=18, n_v=5)
    for x in (1, -1):              # combed back toward the tie
        lock(mb, S, [(20 * x, 40, 0.009), (90 * x, 46, 0.01), (160 * x, 82, 0.006)], [0.03, 0.028, 0.0], [0.007, 0.006, 0.0])
    g, gn = head_point(S, 180, 82, 0.0)
    path = [g - gn * 0.012, g + gn * 0.018, g + gn * 0.034 + V3(0, 0.012, -0.03), g + V3(0, 0.05, -0.1),
            g + V3(0, 0.045, -0.17), g + V3(0, 0.03, -0.235)]
    rads = [(0.019, 0.016), (0.02, 0.017), (0.026, 0.022), (0.024, 0.02), (0.016, 0.014), (0.0, 0.0)]
    tube(mb, catmull(path, 2), list(zip(np.interp(np.linspace(0, 1, 11), np.linspace(0, 1, 6), [r[0] for r in rads]),
                                     np.interp(np.linspace(0, 1, 11), np.linspace(0, 1, 6), [r[1] for r in rads]))),
         V3(0, 0, 1), n=6, slot=HAIR, tip=True)
    # the tie: a short band
    tube(mb, [g + gn * 0.006, g + gn * 0.02], [(0.021, 0.018), (0.021, 0.018)], V3(0, 0, 1), n=6, slot=LEATHER, tip=False, cap0=True)
    return mb


def build_hair_swept(fr, S):
    mb = MB()
    hl = periodic([(0, 56), (30, 59), (60, 65), (80, 68), (95, 67), (110, 84), (130, 102), (155, 116), (180, 120)])
    hair_cap(mb, S, hl, cap_thick(0.013, front=0.012), n_u=18, n_v=5)
    for u in (-30, -10, 10, 30):    # strands swept back over the top
        lock(mb, S, [(u, 52, 0.018), (u * 0.8, 20, 0.024), (180 - u * 0.4, 30, 0.02), (180 - u * 0.5, 64, 0.01)],
             [0.03, 0.034, 0.03, 0.0], [0.008, 0.01, 0.008, 0.0])
    for x in (1, -1):
        lock(mb, S, [(70 * x, 48, 0.014), (120 * x, 60, 0.013), (150 * x, 92, 0.006)], [0.032, 0.03, 0.0], [0.008, 0.007, 0.0])
    return mb


def build_hair_bun(fr, S):
    mb = MB()
    hl = periodic([(0, 57), (30, 60), (60, 66), (80, 68), (95, 67), (110, 84), (130, 102), (155, 118), (180, 124)])
    hair_cap(mb, S, hl, cap_thick(0.008), n_u=18, n_v=5)
    for x in (1, -1):
        lock(mb, S, [(15 * x, 42, 0.009), (80 * x, 40, 0.01), (150 * x, 50, 0.006)], [0.03, 0.028, 0.0], [0.007, 0.006, 0.0])
    p, n = head_point(S, 180, 40, 0.0)
    ellipsoid(mb, p + n * 0.03, 0.042, 0.036, 0.034, nu=8, nv=5, slot=HAIR,
              R=np.array([unit(np.cross(n, V3(1, 0, 0))), V3(1, 0, 0), n]).T @ np.array([[0, 1, 0], [1, 0, 0], [0, 0, 1]]))
    return mb


def brow_arc(fr, S, side, pts, wid, thk, slot=HAIR):
    """A brow: an arc of (dx from the eye, dz from the eye) points projected on the brow skin from the front."""
    mb_pts, nrm = [], []
    e = fr.eye[side]['o']
    sg = 1 if side == 'L' else -1
    for (dx, dz), t in zip(pts, thk):
        o = V3(e[0] + sg * dx, e[1] - 0.2, e[2] + dz)
        r = S.ray(o, V3(0, 1, 0))
        p, n = r
        mb_pts.append(p + n * (max(t, 0.0015) * 0.35))
        nrm.append(n)
    return mb_pts, nrm


def build_brows(style):
    def build(fr, S):
        mb = MB()
        if style == 'soft':
            pts = [(-0.021, 0.024), (-0.008, 0.029), (0.008, 0.031), (0.022, 0.028), (0.034, 0.021)]
            wid, thk = [0.0058, 0.0068, 0.0064, 0.0052, 0.0], [0.0028, 0.003, 0.0028, 0.0024, 0.0]
        elif style == 'heavy':
            pts = [(-0.022, 0.022), (-0.008, 0.025), (0.008, 0.026), (0.022, 0.025), (0.035, 0.019)]
            wid, thk = [0.009, 0.0105, 0.0105, 0.009, 0.0], [0.0042, 0.0046, 0.0044, 0.0036, 0.0]
        else:   # arched
            pts = [(-0.02, 0.025), (-0.006, 0.032), (0.009, 0.036), (0.022, 0.032), (0.033, 0.022)]
            wid, thk = [0.0046, 0.0052, 0.005, 0.004, 0.0], [0.0022, 0.0024, 0.0022, 0.0018, 0.0]
        for side in ('L', 'R'):
            P, Nn = brow_arc(fr, S, side, pts, wid, thk)
            # the tube's width runs vertically on the skin: normal = skin normal, binormal = along the brow × normal
            tube(mb, P, list(zip(wid, thk)), Nn[0], n=4, slot=HAIR, tip=True, cap0=True, rot=math.pi / 4)
            mb.cur += 1
        return mb
    return build


def beard_sheet(fr, S, style):
    """The Dwarf beard: columns around the jaw from one sideburn to the other; the top rows lie on the face, the rest
    hang from the chin as a closed wedge (full = spade, forked = two points, short = ends at the jaw)."""
    mb = MB()
    P = fr.P
    cols = 13
    A = np.linspace(-76, 76, cols)
    ax_y = -0.03           # the columns fan out from an axis in front of the ears; the outermost land just before them
    # rays come from outside, inward, against the skin without the ears: from inside, the front rays met the mouth's
    # interior first and those rows vanished into the mouth (round 3)
    S_face = Surf(fr, exclude=EAR_SET)
    outer, inner = [], []
    for a in A:
        ar = math.radians(a)
        d = V3(math.sin(ar), -math.cos(ar), 0.0)
        frac = abs(a) / 76.0
        # the top edge: under the nose at the front, along the cheeks clear of the eyes, rising past the outer eye
        # corner into broad sideburns that meet the hair at the temple
        z_top = float(np.interp(frac, [0.0, 0.2, 0.38, 0.55, 0.68, 0.8, 1.0], [1.556, 1.558, 1.576, 1.592, 1.614, 1.66, 1.688]))
        z_chin = lerp(1.478, 1.512, frac ** 1.5)
        zs = list(np.linspace(z_top, z_chin, 4))
        oc, ic = [], []
        for j, z in enumerate(zs):
            o = V3(0, ax_y, z) + d * 0.35
            r = S_face.ray(o, -d) or S.ray(o, -d)
            p, n = r
            tk = lerp(0.006, 0.016, j / 3.0) * (1.0 - 0.35 * frac)
            if j == 0:
                tk = 0.004
            oc.append(p + n * tk)
            ic.append(p - n * 0.002)
        if style == 'short':
            outer.append(oc)
            inner.append(ic)
            continue
        # the hanging wedge below the chin
        last = oc[-1]
        lin = ic[-1]
        if style == 'full':
            z_end = lerp(1.30, 1.47, frac ** 1.3)
            x_scale = [0.92, 0.72, 0.4]
        else:   # forked: two points at |a| ~ 28
            fork = 1.0 - min(1.0, abs(abs(a) - 26) / 30.0)
            z_end = lerp(1.40, 1.47, frac ** 1.3) - 0.08 * fork
            x_scale = [0.95, 0.85, 0.7]
        for j, t in enumerate((0.35, 0.7, 1.0)):
            z = lerp(last[2], z_end, t)
            x = last[0] * x_scale[j]
            y = last[1] - 0.008 * t
            o = V3(x, y, z)
            near, nn, dist = S.nearest(o)
            if dist < 0.02 and (o - near) @ nn < 0.02:
                o = near + nn * 0.02
            oc.append(o)
            depth = lerp(0.03, 0.012, t) * (1.0 - 0.5 * frac)
            ic.append(o + V3(0, depth, 0.004))
        outer.append(oc)
        inner.append(ic)
    rows = len(outer[0])
    O = [[mb.vert(outer[c][r]) for r in range(rows)] for c in range(cols)]
    I = [[mb.vert(inner[c][r]) for r in range(rows)] for c in range(cols)]
    for c in range(cols - 1):
        for r in range(rows - 1):
            mb.face((O[c][r], O[c + 1][r], O[c + 1][r + 1], O[c][r + 1]), HAIR)
            mb.face((I[c][r], I[c][r + 1], I[c + 1][r + 1], I[c + 1][r]), HAIR)
    for c in range(cols - 1):        # top edge and bottom edge
        mb.face((O[c][0], I[c][0], I[c + 1][0], O[c + 1][0]), HAIR)
        mb.face((O[c][-1], O[c + 1][-1], I[c + 1][-1], I[c][-1]), HAIR)
    for c in (0, cols - 1):
        for r in range(rows - 1):
            if c == 0:
                mb.face((O[c][r], O[c][r + 1], I[c][r + 1], I[c][r]), HAIR)
            else:
                mb.face((O[c][r], I[c][r], I[c][r + 1], O[c][r + 1]), HAIR)
    # the moustache: a thick lock over the upper lip, drooping past the mouth corners
    for x in (1, -1):
        m0 = P['upperLip'] + V3(0, -0.006, 0.006)
        path = [m0 + V3(-0.004 * x, 0.004, 0.002), m0 + V3(0.016 * x, -0.002, 0.0), P['mouthL' if x > 0 else 'mouthR'] + V3(0.012 * x, -0.012, -0.004),
                P['mouthL' if x > 0 else 'mouthR'] + V3(0.02 * x, -0.012, -0.03)]
        tube(mb, catmull(path, 2), list(zip(np.interp(np.linspace(0, 1, 7), [0, 0.5, 1], [0.009, 0.011, 0.0]),
                                            np.interp(np.linspace(0, 1, 7), [0, 0.5, 1], [0.007, 0.008, 0.0]))),
             V3(0, -1, 0.3), n=5, slot=HAIR, tip=True, cap0=True)
    return mb


def build_beard(style):
    if style == 'braided':
        return build_beard_braided
    return lambda fr, S: beard_sheet(fr, S, style)


def build_beard_braided(fr, S):
    """The short beard with one thick braid hanging from the chin to the chest, bound with a ring."""
    mb = beard_sheet(fr, S, 'short')
    P = fr.P
    top = P['chin'] + V3(0, -0.014, 0.004)
    path = [top + V3(0, 0.006, 0.012), top, top + V3(0, -0.006, -0.05), top + V3(0, -0.004, -0.1), top + V3(0, 0.004, -0.145)]
    pts = catmull(path, 3)
    m = len(pts)
    for i in range(1, m):                     # clear of the throat and the chest
        near, nn, dist = S.nearest(pts[i])
        if (pts[i] - near) @ nn < 0.018:
            pts[i] = near + nn * 0.018
    rads = []
    for i in range(m):
        t = i / (m - 1)
        r = 0.016 * (1.0 - 0.45 * t) * (1.0 + 0.2 * abs(math.sin(t * math.pi * 5)))
        rads.append((r, r * 0.8))
    rads[-1] = (0.0, 0.0)
    tube(mb, pts, rads, V3(0, -1, 0), n=6, slot=HAIR, tip=True)
    k = int(m * 0.78)
    tube(mb, [pts[k - 1], pts[k]], [(0.013, 0.011), (0.013, 0.011)], V3(0, -1, 0), n=6, slot=toon.SLOT['metal'], tip=False, cap0=True)
    return mb


def beard_tuck(fr, S, P):
    """`beard_tuck` (05 §3.2): the beard pressed against the cheeks and jaw where a helm's cheek guards sit — every
    vertex above the chin pulled down to 3 mm over the skin; the part below the chin left alone."""
    D = np.zeros_like(P)
    cz = fr.P['chin'][2]
    for i, p in enumerate(P):
        near, nn, dist = S.nearest(p)
        h = float((p - near) @ nn)
        w = float(smoothstep(cz - 0.01 * fr.s, cz + 0.025 * fr.s, p[2]))
        if h > 0.003 and w > 0:
            D[i] = -nn * (h - 0.003) * w
    return D


def build_braids(fr, S):
    mb = MB()
    for x in (1, -1):
        p0, n0 = head_point(S, 128 * x, 96, -0.004)
        path = [p0, p0 + V3(0.008 * x, 0.012, -0.05), p0 + V3(0.014 * x, 0.022, -0.11), p0 + V3(0.016 * x, 0.024, -0.17),
                p0 + V3(0.016 * x, 0.02, -0.23)]
        pts = catmull(path, 3)
        m = len(pts)
        rads = []
        for i in range(m):
            t = i / (m - 1)
            bump = 1.0 + 0.22 * abs(math.sin(t * math.pi * 6))
            r = 0.0105 * (1.0 - 0.35 * t) * bump
            rads.append((r, r * 0.85))
        rads[-1] = (0.0, 0.0)
        # keep clear of the neck and back
        for i in range(1, m):
            near, nn, dist = S.nearest(pts[i])
            if dist < 0.016 and (pts[i] - near) @ nn < 0.016:
                pts[i] = near + nn * 0.016
        tube(mb, pts, rads, V3(0, -1, 0), n=6, slot=HAIR, tip=True)
        k = int(m * 0.8)
        tube(mb, [pts[k - 1], pts[k]], [(0.0125, 0.011), (0.0125, 0.011)], V3(0, -1, 0), n=6, slot=LEATHER, tip=False, cap0=True)
        mb.cur += 1
    return mb


def ear_part(fr, S, length, lift, back, width, slot_inner=SKIN2):
    """A pointed ear on each side (Elf, Orc): a flattened tapered loft from the flattened round ear outward."""
    mb = MB()
    for side, x in (('L', 1), ('R', -1)):
        e = fr.ear[side]
        root = V3(x * (e['x0'] - 0.006), e['c'][1] + 0.002, e['c'][2] - 0.004)
        d = unit(V3(x * 0.62, back, lift))
        pts = [root + d * length * t + V3(0, 0, -0.004) * math.sin(t * math.pi) for t in (0.0, 0.18, 0.42, 0.7, 1.0)]
        rads = [(width * 0.9, 0.007), (width, 0.0068), (width * 0.82, 0.0058), (width * 0.48, 0.0045), (0.0, 0.0)]
        # flat face of the ear faces outward-forward: the loft's normal axis is the ear's thickness
        up = unit(np.cross(d, V3(0, 0, 1)) * x)
        def slots_fn(i, k, x=x):
            return slot_inner if k in (0, 1) and 0 < i < 3 else SKIN
        tube(mb, pts, rads, up, n=6, slot=SKIN, tip=True, cap0=True, slots_fn=slots_fn)
        mb.cur += 1
    return mb


def build_elf_ears(kind):
    if kind == 'swept':
        return lambda fr, S: ear_part(fr, S, 0.088, 0.62, 0.42, 0.024)
    return lambda fr, S: ear_part(fr, S, 0.118, 0.32, 0.48, 0.026)


def build_orc_ears(fr, S):
    return ear_part(fr, S, 0.056, 0.28, 0.38, 0.024)


def build_tusks(size):
    L = {'small': 0.026, 'medium': 0.036, 'big': 0.05}[size]
    R = {'small': 0.0065, 'medium': 0.008, 'big': 0.0098}[size]

    def build(fr, S):
        mb = MB()
        P = fr.P
        for x in (1, -1):
            base = P['lowerLip'] + V3(0.022 * x, 0.009, -0.004)
            path = [base + V3(0, 0.004, -0.006), base + V3(0.002 * x, -0.010, L * 0.3), base + V3(0.006 * x, -0.018, L * 0.7),
                    base + V3(0.011 * x, -0.020, L)]
            tube(mb, path, [(R, R), (R * 0.95, R * 0.95), (R * 0.6, R * 0.6), (0.0, 0.0)], V3(0, -1, 0), n=6, slot=BONE, tip=True, cap0=True)
            mb.cur += 1
        return mb
    return build


def build_topknot(fr, S):
    mb = MB()
    hl = periodic([(0, 34), (90, 36), (180, 40)])
    hair_cap(mb, S, hl, cap_thick(0.006), n_u=12, n_v=3)
    p, n = head_point(S, 160, 14, 0.0)
    path = [p - n * 0.01, p + n * 0.02, p + n * 0.045 + V3(0, 0.01, 0), p + n * 0.05 + V3(0, 0.05, -0.01),
            p + V3(0, 0.1, -0.06), p + V3(0, 0.115, -0.13)]
    pts = catmull(path, 2)
    m = len(pts)
    rr = np.interp(np.linspace(0, 1, m), [0, 0.15, 0.35, 0.6, 1.0], [0.016, 0.02, 0.018, 0.014, 0.0])
    tube(mb, pts, [(r, r * 0.9) for r in rr], V3(0, -1, 0), n=6, slot=HAIR, tip=True)
    tube(mb, [p + n * 0.016, p + n * 0.028], [(0.0175, 0.0175), (0.0175, 0.0175)], V3(0, -1, 0), n=6, slot=LEATHER, tip=False, cap0=True)
    return mb


def build_curls(fr, S):
    """A mop of curls: a full cap with volume, covered in short hooked locks — each rises off the cap and curls back
    down at its tip — overhanging the brow and the nape, so the outline is bumpy and the shading stays smooth."""
    mb = MB()
    hl = periodic([(0, 56), (30, 59), (60, 65), (80, 69), (95, 71), (110, 88), (130, 106), (155, 120), (180, 124)])
    hair_cap(mb, S, hl, cap_thick(0.02, front=0.004, edge=0.4), n_u=16, n_v=4)
    rng = np.random.default_rng(5)
    k = 0
    for th, n, off in ((12, 5, 0.019), (36, 8, 0.018), (60, 9, 0.015), (84, 6, 0.011)):
        for i in range(n):
            u = 360.0 * (i + (0.5 if k % 2 else 0.0)) / n + rng.uniform(-9, 9)
            uu = ((u + 180) % 360) - 180
            if th >= 84 and abs(uu) < 100:          # the lowest row only behind the ears
                continue
            sg = 1 if (i + k) % 2 else -1
            tl = th + rng.uniform(-3, 3)
            ctrl = [(u, tl - 7, off * 0.55), (u + 6 * sg, tl + 3, off + 0.012), (u + 12 * sg, tl + 11, off * 0.45)]
            lock(mb, S, ctrl, [0.019, 0.021, 0.0], [0.009, 0.0105, 0.0])
        k += 1
    return mb


def decimate_mb(mb, ratio, slot):
    """The MB's surface through Blender's collapse decimator (X-symmetric) → a new MB (all faces `slot`)."""
    me = bpy.data.meshes.new('_dec')
    me.from_pydata([tuple(v) for v in mb.v], [], mb.f)
    me.update()
    ob = bpy.data.objects.new('_dec', me)
    bpy.context.scene.collection.objects.link(ob)
    mod = ob.modifiers.new('D', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = ratio
    mod.use_symmetry = True
    mod.symmetry_axis = 'X'
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    m2 = ev.to_mesh()
    out = MB()
    for v in m2.vertices:
        out.vert(v.co[:])
    for p in m2.polygons:
        out.face(tuple(p.vertices), slot)
    ev.to_mesh_clear()
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    return out


def build_halfling_feet(fr, S):
    """Big bare feet: the body's own feet (region 'feet' plus the lowest shin ring, tucked under the shin) scaled
    broad and long, decimated, with tufts of hair on top."""
    skin = MB()
    tufts = []
    feet = toon.REGION['feet']
    shins = toon.REGION['shins']
    V = fr.V
    for x in (1, -1):
        sel = set(i for i in range(fr.n) if fr.region[i] == feet and V[i][0] * x > 0)
        ring = set()
        for f in fr.faces:
            if any(i in sel for i in f):
                for i in f:
                    if i not in sel and fr.region[i] == shins:
                        ring.add(i)
        use = sel | ring
        fidx = [f for f in fr.faces if all(i in use for i in f)]
        ankle = fr.bones['LeftFoot' if x > 0 else 'RightFoot']['head']
        toe = fr.bones['LeftToes' if x > 0 else 'RightToes']['tail']
        fwd = unit(V3(toe[0] - ankle[0], toe[1] - ankle[1], 0))
        side = unit(np.cross(fwd, V3(0, 0, 1)))
        remap = {}
        for i in sorted(use):
            p = V[i].copy()
            if i in ring:
                q = p - fr.N[i] * 0.0025
            else:
                rel = p - ankle
                a = rel @ fwd
                s_ = rel @ side
                h = p[2]
                k = smoothstep(0.0, 0.03, ankle[2] - h + 0.01)          # full effect below the ankle
                a2 = a * (1.0 + 0.12 * k) + 0.008 * k
                s2 = s_ * (1.0 + 0.3 * k * smoothstep(-0.06, 0.05, a))
                h2 = h * (1.0 - 0.08 * k) if h > 0.01 else h
                q = ankle + fwd * a2 + side * s2
                q[2] = h2
                q = q + fr.N[i] * 0.003 * k
            remap[i] = skin.vert(q)
        for f in fidx:
            skin.face([remap[i] for i in f], SKIN)
        # two tufts on the top of the foot (placed on the enlarged foot below): the instep and the toes' root
        top = ankle + fwd * 0.07 + V3(0, 0, -0.035)
        for da in (0.0, 0.05):
            tufts.append((top + fwd * da, fwd, side))
    mb = decimate_mb(skin, 0.27, SKIN)
    # each tuft is a little fan of three locks lying forward on the foot
    tmp_bvh = BVHTree.FromPolygons([Vector(v) for v in mb.v], [tuple(f) for f in mb.f])
    for c, fwd, side in tufts:
        for k, (ang, ln) in enumerate(((-0.5, 0.032), (0.0, 0.04), (0.5, 0.032))):
            d = unit(fwd * math.cos(ang) + side * math.sin(ang))
            o = c + side * (0.012 * math.sin(ang) * 2)
            loc, nor, ti, dist = tmp_bvh.ray_cast(Vector(o + V3(0, 0, 0.12)), Vector((0, 0, -1)), 0.3)
            if loc is None:
                continue
            p = np.array(loc[:])
            n = unit(np.array(nor[:]))
            if n[2] < 0:
                n = -n
            lockp = [p - n * 0.004 - d * 0.004, p + n * 0.006 + d * ln * 0.45, p + n * 0.004 + d * ln]
            tube(mb, lockp, [(0.012, 0.0045), (0.0105, 0.004), (0.0, 0.0)], n, n=4, slot=HAIR, tip=True)
    return mb


def build_tail(fr, S):
    mb = MB()
    B = fr.bones
    pts = [B['Tail_01']['head'] + V3(0, -0.07, 0.025)] + [B['Tail_0%d' % i]['head'] for i in (1, 2, 3, 4)] + [B['Tail_04']['tail']]
    t4 = B['Tail_04']['tail']
    pts += [t4 + V3(0, 0.13, -0.035), t4 + V3(0, 0.25, -0.11), t4 + V3(0, 0.33, -0.22), t4 + V3(0, 0.37, -0.33)]
    path = catmull(pts, 2)
    m = len(path)
    t = np.linspace(0, 1, m)
    r = 0.074 * (1 - t) ** 1.25 + 0.006
    r[-1] = 0.0
    rads = [(ri * 1.05, ri * 0.92) for ri in r]

    def slots_fn(i, k):
        return SKIN2 if k in (3, 4) else SKIN
    rings = tube(mb, path, rads, V3(0, 0, 1), n=8, slot=SKIN, tip=True, cap0=True, slots_fn=slots_fn)
    # dorsal spikes in bone along the top
    P, T, N, Bn = rmf(path, V3(0, 0, 1))
    for i in range(2, m - 3, 2):
        c = P[i] + N[i] * rads[i][1] * 0.85
        h = 0.03 * (1 - t[i]) + 0.008
        tube(mb, [c - N[i] * 0.006, c + N[i] * h * 0.5, c + N[i] * h - T[i] * 0.01], [(0.012 * (1 - t[i] * 0.6), 0.006), (0.008, 0.004), (0, 0)],
             T[i], n=4, slot=BONE, tip=True)
    return mb


def horn(mb, root, path_rel, r0, up, n=7, slot=BONE):
    pts = [root + np.asarray(p) for p in path_rel]
    pts = catmull(pts, 2)
    m = len(pts)
    rr = np.interp(np.linspace(0, 1, m), [0, 0.3, 0.7, 1], [r0, r0 * 0.78, r0 * 0.42, 0.0])
    tube(mb, pts, [(r, r) for r in rr], up, n=n, slot=slot, tip=True, cap0=True)


def build_horns(kind):
    def build(fr, S):
        mb = MB()
        for x in (1, -1):
            if kind == 'swept':
                # long horns lying back along the line of the skull, rising a little at the tips
                p, n = head_point(S, 40 * x, 40, -0.006)
                horn(mb, p, [(0, 0, 0), (0.008 * x, 0.035, 0.026), (0.018 * x, 0.095, 0.036), (0.026 * x, 0.16, 0.026),
                             (0.03 * x, 0.215, 0.034)], 0.021, n)
                mb.cur += 1
            elif kind == 'ram':
                # back from the temples, then curling down and forward beside the ear
                p, n = head_point(S, 58 * x, 44, -0.006)
                horn(mb, p, [(0, 0, 0), (0.016 * x, 0.04, 0.014), (0.036 * x, 0.08, -0.008), (0.05 * x, 0.088, -0.05),
                             (0.054 * x, 0.052, -0.085), (0.05 * x, 0.012, -0.078), (0.046 * x, -0.008, -0.056)], 0.022, n)
                mb.cur += 1
            else:   # crown: short spikes around the back of the head
                for u, th, ln in ((48, 40, 0.06), (82, 50, 0.07), (118, 58, 0.065), (150, 64, 0.05)):
                    p, n = head_point(S, u * x, th, -0.005)
                    d = unit(n + V3(0, 0.6, 0.35))
                    horn(mb, p, [(0, 0, 0), tuple(d * ln * 0.5 + n * 0.004), tuple(d * ln)], 0.011, n, n=6)
                    mb.cur += 1
        return mb
    return build


def build_crest(fr, S):
    mb = MB()
    for i, (th, h) in enumerate(((58, 0.03), (84, 0.032), (108, 0.03), (130, 0.026))):
        p, n = head_point(S, 180, th, -0.004)
        back = unit(np.cross(V3(1, 0, 0), n))
        tube(mb, [p - n * 0.004, p + n * h * 0.55 + back * 0.006, p + n * h + back * 0.016],
             [(0.0045, 0.016), (0.0035, 0.01), (0.0, 0.0)], back, n=4, slot=BONE, tip=True, rot=math.pi / 4)
    # down the back of the neck to between the shoulders
    for z, h in ((1.49, 0.024), (1.44, 0.021), (1.39, 0.017), (1.345, 0.013)):
        r = S.ray(V3(0, -0.02, z), V3(0, 1, 0.05))
        if r is None:
            continue
        p, n = r
        back = unit(np.cross(V3(1, 0, 0), n))
        tube(mb, [p - n * 0.004, p + n * h * 0.55 - back * 0.004, p + n * h - back * 0.012],
             [(0.004, 0.014), (0.003, 0.009), (0.0, 0.0)], back, n=4, slot=BONE, tip=True, rot=math.pi / 4)
    return mb


def build_claws_hand(fr, S):
    mb = MB()
    B = fr.bones
    for side in ('Left', 'Right'):
        for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Little'):
            b = B[side + f + 'Distal']
            h, t = b['head'], b['tail']
            y = unit(t - h)
            z = b['M'][:, 2]        # out of the palm
            nail = -z
            ln = 0.022 if f != 'Little' else 0.018
            r = 0.0052 if f != 'Little' else 0.0045
            near, nn, _ = S.nearest(lerp(h, t, 0.65) + nail * 0.01)
            base = near - nn * 0.0015
            path = [base, base + y * ln * 0.45 + nail * 0.001, base + y * ln * 0.85 + z * 0.004, base + y * ln + z * 0.009]
            tube(mb, path, [(r, r * 0.8), (r * 0.8, r * 0.65), (r * 0.4, r * 0.35), (0, 0)], nail, n=5, slot=BONE, tip=True, cap0=True)
            mb.cur += 1
    return mb


def build_claws_foot(fr, S):
    mb = MB()
    V = fr.V
    for x, side in ((1, 'Left'), (-1, 'Right')):
        toes = fr.bones[side + 'Toes']
        foot = (fr.region == toon.REGION['feet']) & (V[:, 0] * x > 0) & (V[:, 2] < 0.045)
        FV = V[foot]
        xs = np.abs(FV[:, 0])
        lo, hi = xs.min(), xs.max()
        for k, frac in enumerate((0.12, 0.38, 0.62, 0.86)):
            xc = lo + (hi - lo) * frac
            band = np.abs(xs - xc) < (hi - lo) * 0.1
            if not band.any():
                continue
            tip = FV[band][np.argmin(FV[band][:, 1])]
            near, nn, _ = S.nearest(tip + V3(0, 0.012, 0.012))
            base = near - nn * 0.0015
            ln = 0.022 if k < 2 else 0.017
            r = 0.0062 if k < 2 else 0.005
            fwd = V3(0, -1, 0)
            path = [base, base + fwd * ln * 0.5 + V3(0, 0, 0.002), base + fwd * ln * 0.9 + V3(0, 0, -0.004), base + fwd * ln + V3(0, 0, -0.012)]
            tube(mb, path, [(r, r * 0.7), (r * 0.8, r * 0.6), (r * 0.4, r * 0.3), (0, 0)], V3(0, 0, 1), n=5, slot=BONE, tip=True, cap0=True)
            mb.cur += 1
    return mb


# name: (builder, family, variant, species, head part, transfer mode, hides, weights)
PARTS = [
    ('hair_crop', build_hair_crop, 'hair', 'crop', None, True, 'surface', [], 'head'),
    ('hair_shaggy', build_hair_shaggy, 'hair', 'shaggy', None, True, 'surface', [], 'head'),
    ('hair_long', build_hair_long, 'hair', 'long', None, True, 'surface', [], 'hairchain'),
    ('hair_tied', build_hair_tied, 'hair', 'tied', None, True, 'surface', [], 'hairchain'),
    ('hair_swept', build_hair_swept, 'hair', 'swept', None, True, 'surface', [], 'head'),
    ('hair_bun', build_hair_bun, 'hair', 'bun', None, True, 'surface', [], 'head'),
    ('brows_soft', build_brows('soft'), 'brows', 'soft', None, True, 'surface', [], 'surface'),
    ('brows_heavy', build_brows('heavy'), 'brows', 'heavy', None, True, 'surface', [], 'surface'),
    ('brows_arched', build_brows('arched'), 'brows', 'arched', None, True, 'surface', [], 'surface'),
    ('spc_dwarf_beard', build_beard('full'), 'spc_dwarf_beard', 'full', 'dwarf', True, 'surface', [], 'beard'),
    ('spc_dwarf_beard_forked', build_beard('forked'), 'spc_dwarf_beard', 'forked', 'dwarf', True, 'surface', [], 'beard'),
    ('spc_dwarf_beard_short', build_beard('short'), 'spc_dwarf_beard', 'short', 'dwarf', True, 'surface', [], 'beard'),
    ('spc_dwarf_beard_braided', build_beard('braided'), 'spc_dwarf_beard', 'braided', 'dwarf', True, 'surface', [], 'beard'),
    ('spc_dwarf_braids', build_braids, 'spc_dwarf_braids', 'twin', 'dwarf', True, 'surface', [], 'hairchain'),
    ('spc_elf_ears', build_elf_ears('swept'), 'spc_elf_ears', 'swept', 'elf', True, 'rigid', [], 'ears'),
    ('spc_elf_ears_long', build_elf_ears('long'), 'spc_elf_ears', 'long', 'elf', True, 'rigid', [], 'ears'),
    ('spc_orc_tusks', build_tusks('medium'), 'spc_orc_tusks', 'medium', 'orc', True, 'rigid', [], 'Head'),
    ('spc_orc_tusks_big', build_tusks('big'), 'spc_orc_tusks', 'big', 'orc', True, 'rigid', [], 'Head'),
    ('spc_orc_tusks_small', build_tusks('small'), 'spc_orc_tusks', 'small', 'orc', True, 'rigid', [], 'Head'),
    ('spc_orc_ears', build_orc_ears, 'spc_orc_ears', 'short', 'orc', True, 'rigid', [], 'ears'),
    ('spc_orc_topknot', build_topknot, 'spc_orc_topknot', 'topknot', 'orc', True, 'surface', [], 'hairchain'),
    ('spc_halfling_feet', build_halfling_feet, 'spc_halfling_feet', 'bare', 'halfling', False, 'surface', ['feet'], 'surface'),
    ('spc_halfling_curls', build_curls, 'spc_halfling_curls', 'curls', 'halfling', True, 'surface', [], 'head'),
    ('spc_draconid_tail', build_tail, 'spc_draconid_tail', 'tail', 'draconid', False, 'chain', [], 'tail'),
    ('spc_draconid_horns', build_horns('swept'), 'spc_draconid_horns', 'swept', 'draconid', True, 'rigid', [], 'Head'),
    ('spc_draconid_horns_ram', build_horns('ram'), 'spc_draconid_horns', 'ram', 'draconid', True, 'rigid', [], 'Head'),
    ('spc_draconid_horns_crown', build_horns('crown'), 'spc_draconid_horns', 'crown', 'draconid', True, 'rigid', [], 'Head'),
    ('spc_draconid_crest', build_crest, 'spc_draconid_crest', 'ridge', 'draconid', True, 'surface', [], 'surface'),
    ('spc_draconid_claws_hand', build_claws_hand, 'spc_draconid_claws_hand', 'claws', 'draconid', False, 'surface', [], 'claws'),
    ('spc_draconid_claws_foot', build_claws_foot, 'spc_draconid_claws_foot', 'claws', 'draconid', False, 'surface', [], 'Toes'),
]


# ====================================================================== 5. weights, transfer, part objects
def tri_normal_area(A, B, C):
    cr = np.cross(B - A, C - A)
    a2 = np.linalg.norm(cr, axis=1)
    a2 = np.maximum(a2, 1e-14)
    return cr / a2[:, None], a2 * 0.5


class NSMap:
    """fit.SurfaceMap's binding (each point → its nearest triangle at rest) with a numpy evaluate: the same transform
    as mathutils' barycentric_transform (barycentric weights in the triangle's plane, the height above it scaled by
    √area), done for all points at once — fast enough to carry 17 keys onto 29 parts on two frames."""

    def __init__(self, V, faces):
        self.tris = np.array(triangulate(faces))
        self.V0 = np.asarray(V, dtype=float)
        self.bvh = BVHTree.FromPolygons([Vector(v) for v in self.V0], [tuple(int(i) for i in t) for t in self.tris])

    def bind(self, P):
        P = np.asarray(P, dtype=float)
        ti = np.array([self.bvh.find_nearest(Vector(p))[2] for p in P])
        T = self.tris[ti]
        A, B, C = self.V0[T[:, 0]], self.V0[T[:, 1]], self.V0[T[:, 2]]
        n, area = tri_normal_area(A, B, C)
        z = ((P - A) * n).sum(axis=1)
        Q = P - z[:, None] * n
        v0, v1, v2 = B - A, C - A, Q - A
        d00 = (v0 * v0).sum(1)
        d01 = (v0 * v1).sum(1)
        d11 = (v1 * v1).sum(1)
        d20 = (v2 * v0).sum(1)
        d21 = (v2 * v1).sum(1)
        den = np.where(np.abs(d00 * d11 - d01 * d01) < 1e-20, 1e-20, d00 * d11 - d01 * d01)
        wv = (d11 * d20 - d01 * d21) / den
        ww = (d00 * d21 - d01 * d20) / den
        wu = 1.0 - wv - ww
        return dict(T=T, w=np.stack([wu, wv, ww], axis=1), z=z / np.sqrt(area))

    def evaluate(self, b, V):
        V = np.asarray(V, dtype=float)
        T = b['T']
        A, B, C = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
        n, area = tri_normal_area(A, B, C)
        w = b['w']
        return w[:, 0:1] * A + w[:, 1:2] * B + w[:, 2:3] * C + n * (b['z'] * np.sqrt(area))[:, None]


class Body:
    """The broad body's surface maps: everything that binds parts to the skin (eyeballs left out; the skull map also
    leaves out the round ears, which the Elf, Orc and Draconid keys fold away)."""

    def __init__(self, frb, frs):
        self.frb, self.frs = frb, frs
        skin = [f for f in frb.faces if not all(frb.eye_mask[i] for i in f)]
        self.smap = NSMap(frb.V, skin)
        skull = [f for f in frb.faces if not any(i in EAR_SET or frb.eye_mask[i] for i in f)]
        self.skull = NSMap(frb.V, skull)

    def eval(self, smap, bindings, V):
        return smap.evaluate(bindings, V)


EAR_SET = set()


def weights_surface(fr, S, P):
    """Body weights interpolated from the nearest point of the skin (4 strongest, normalised)."""
    out = []
    for p in P:
        loc, nor, ti, dist = S.bvh.find_nearest(Vector(p))
        a, b, c = S.T[ti]
        pa, pb, pc = fr.V[a], fr.V[b], fr.V[c]
        v0, v1, v2 = pb - pa, pc - pa, np.array(loc[:]) - pa
        d00, d01, d11 = v0 @ v0, v0 @ v1, v1 @ v1
        d20, d21 = v2 @ v0, v2 @ v1
        den = d00 * d11 - d01 * d01
        if abs(den) < 1e-16:
            bw = (1.0, 0.0, 0.0)
        else:
            v = (d11 * d20 - d01 * d21) / den
            w = (d00 * d21 - d01 * d20) / den
            bw = (max(0.0, 1 - v - w), max(0.0, v), max(0.0, w))
        acc = {}
        for vi, wv in zip((a, b, c), bw):
            for g, gw in fr.Wd[vi].items():
                acc[g] = acc.get(g, 0.0) + gw * wv
        out.append(norm4(acc))
    return out


def norm4(acc):
    items = sorted(((g, w) for g, w in acc.items() if w > 1e-4), key=lambda t: -t[1])[:4]
    s = sum(w for _, w in items) or 1.0
    return {g: w / s for g, w in items}


def chain_param(fr, P, chain):
    """For each point: its position along the chain of bones (0 at the first bone's head, len(chain) at the last
    bone's tail) and its distance from it."""
    segs = [(fr.bones[b]['head'], fr.bones[b]['tail']) for b in chain]
    out = []
    for p in P:
        best = None
        for i, (h, t) in enumerate(segs):
            ax = t - h
            tt = float(np.clip((p - h) @ ax / (ax @ ax), 0.0 if i > 0 else -1.0, 1.0 if i < len(segs) - 1 else 3.0))
            q = h + tt * ax
            d = float(np.linalg.norm(p - q))
            if best is None or d < best[1]:
                best = (i + tt, d)
        out.append(best)
    return out


def chain_weights(s, chain, root):
    """Hat weights along a chain: s < 0 → the root bone; between bone centres → the two neighbours."""
    n = len(chain)
    if s <= 0.0:
        return {root: 1.0}
    if s < 0.5:
        t = s / 0.5
        return {root: 1.0 - t, chain[0]: t} if t < 1 else {chain[0]: 1.0}
    c = s - 0.5
    i = int(math.floor(c))
    if i >= n - 1:
        return {chain[-1]: 1.0}
    t = c - i
    return {chain[i]: 1.0 - t, chain[i + 1]: t}


def mix_weights(a, b, t):
    acc = {}
    for g, w in a.items():
        acc[g] = acc.get(g, 0.0) + w * (1 - t)
    for g, w in b.items():
        acc[g] = acc.get(g, 0.0) + w * t
    return norm4(acc)


def part_weights(fr, S, P, kind):
    if kind == 'surface':
        return weights_surface(fr, S, P)
    if kind in ('Head', 'Toes'):
        if kind == 'Toes':
            return [{('LeftToes' if p[0] > 0 else 'RightToes'): 1.0} for p in P]
        return [{'Head': 1.0} for _ in P]
    if kind == 'head':
        # hair on the scalp: the body's weights where it touches the skin (Head, a little Neck at the nape)
        return weights_surface(fr, S, P)
    if kind == 'ears':
        out = []
        for p in P:
            side = 'L' if p[0] > 0 else 'R'
            e = fr.ear[side]
            t = smoothstep(e['x0'] - 0.004, e['x0'] + 0.03, abs(p[0]))
            out.append(norm4({'Head': 1.0 - t, 'Ear_' + side: t}))
        return out
    if kind == 'claws':
        out = []
        for p in P:
            side = 'Left' if p[0] > 0 else 'Right'
            best = min((float(np.linalg.norm(p - lerp(fr.bones[side + f + 'Distal']['head'], fr.bones[side + f + 'Distal']['tail'], 0.6))), side + f + 'Distal')
                       for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Little'))
            out.append({best[1]: 1.0})
        return out
    if kind in ('hairchain', 'beard'):
        chain = ['Hair_01', 'Hair_02', 'Hair_03'] if kind == 'hairchain' else ['Beard_01', 'Beard_02']
        base = weights_surface(fr, S, P)
        cp = chain_param(fr, P, chain)
        out = []
        for p, w0, (s, d) in zip(P, base, cp):
            if kind == 'hairchain':
                # only what hangs below the nape swings on the chain; the cap stays on the head
                hang = smoothstep(0.0, 0.06, fr.P['nape'][2] + 0.02 - p[2]) * float(p[1] > -0.03)
            else:
                hang = smoothstep(0.0, 0.03, fr.P['chin'][2] - p[2])
            cw = chain_weights(max(s, 0.25), chain, 'Head')
            out.append(mix_weights(w0, cw, hang))
        return out
    if kind == 'tail':
        chain = ['Tail_01', 'Tail_02', 'Tail_03', 'Tail_04']
        base = weights_surface(fr, S, P)
        cp = chain_param(fr, P, chain)
        out = []
        for w0, (s, d) in zip(base, cp):
            t = smoothstep(0.05, 0.45, s)
            out.append(mix_weights(w0, chain_weights(max(s, 0.5), chain, 'Hips'), t))
        return out
    raise KeyError(kind)


def make_object(name, mb, rig, coll):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in mb.v], [], mb.f)
    me.update()
    # consistent, outward winding on every island (the outline shell and the toon ramp both read the normals)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    toon.ensure_attr(me, slot=0, region=0)
    toon.split_by_face_slots(ob, list(mb.slot))
    me.validate()
    return ob


def set_weights(ob, W, rig):
    for vg in list(ob.vertex_groups):
        ob.vertex_groups.remove(vg)
    for b in rig.data.bones:
        ob.vertex_groups.new(name=b.name)
    for i, d in enumerate(W):
        for g, w in d.items():
            ob.vertex_groups[g].add([i], w, 'REPLACE')
    ob.parent = rig
    mod = ob.modifiers.get('Armature') or ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig


def vert_array(ob):
    n = len(ob.data.vertices)
    co = np.zeros(n * 3)
    ob.data.vertices.foreach_get('co', co)
    return co.reshape(n, 3)


def set_verts(ob, P):
    ob.data.vertices.foreach_set('co', np.asarray(P).ravel())
    ob.data.update()


def components(ob, mb_comp_of_vert):
    return mb_comp_of_vert


def bone_similarity(frb, frs, bone):
    """Rotation, scale and the two heads that carry a point from a broad bone to the same slight bone."""
    bb, bs = frb.bones[bone], frs.bones[bone]
    R = bs['M'] @ bb['M'].T
    k = bs['length'] / bb['length']
    return R, k, bb['head'], bs['head']


def build_parts(frb, frs, body, keys):
    """All parts on both frames, with weights, keys and properties. Returns {name: {frame: object}} and stats."""
    S = Surf(frb)
    coll = collection('Parts')
    made = {}
    stats = {}
    for (name, builder, family, variant, species, head, mode, hides, wkind) in PARTS:
        mb = builder(frb, S)
        ob = make_object(name + '.broad', mb, frb.rig, coll)
        P = vert_array(ob)
        # components (for rigid parts) follow the vertices through the palette split by nearest original vertex
        comp_src = np.array(mb.comp)
        src = np.array(mb.v)
        kd = KDTree(len(src))
        for i, p in enumerate(src):
            kd.insert(Vector(p), i)
        kd.balance()
        comp = np.array([comp_src[kd.find(Vector(p))[1]] for p in P])
        W = part_weights(frb, S, P, wkind)
        set_weights(ob, W, frb.rig)
        # the slight frame: carried from the broad one
        if mode == 'surface':
            bind = body.smap.bind(P)
            Ps = body.eval(body.smap, bind, frs.V)
        elif mode == 'rigid':
            anchors = {}
            Ps = np.zeros_like(P)
            for c in np.unique(comp):
                sel = comp == c
                a = P[sel].mean(axis=0)
                # the anchor sits on the skull under the part's root (the end nearest the head)
                near, nn, dist = S.nearest(a)
                root_i = np.argmin([np.linalg.norm(p - near) for p in P[sel]])
                rootp = P[sel][root_i]
                near, nn, dist = S.nearest(rootp)
                ab = body.skull.bind([near])
                R, k, hb, hs = bone_similarity(frb, frs, 'Head')
                a_s = body.eval(body.skull, ab, frs.V)[0]
                Ps[sel] = a_s + k * (P[sel] - near) @ R.T
                anchors[int(c)] = ab
        else:   # chain (the tail): through the tail bones, the root on the skin
            Ps = np.zeros_like(P)
            for i, (p, w) in enumerate(zip(P, W)):
                acc = np.zeros(3)
                tot = 0.0
                for g, wv in w.items():
                    R, k, hb, hs = bone_similarity(frb, frs, g)
                    acc += wv * (hs + k * R @ (p - hb))
                    tot += wv
                Ps[i] = acc / (tot or 1.0)
            root = frb.bones['Tail_01']['head'] + V3(0, -0.06, 0.02)
            near, nn, dist = S.nearest(root)
            anchors = {0: body.smap.bind([near])}
        obs = ob.copy()
        obs.data = ob.data.copy()
        obs.name = name + '.slight'
        obs.data.name = name + '.slight'
        coll.objects.link(obs)
        set_verts(obs, Ps)
        set_weights(obs, W, frs.rig)
        # keys: the body's deformation carried onto the part — the species keys of the species that may wear it (the
        # manifest's `parts` lists), and the face keys on head parts
        knames = [SPECIES_KEY[sp] for sp in wearers(species) if sp in SPECIES_KEY] + (FACE_KEYS if head else [])
        for fr, o, rest in ((frb, ob, P), (frs, obs, Ps)):
            deltas = []
            base = body.eval(body.smap, bind, fr.V) if mode == 'surface' else None
            for kn in knames:
                Vk = fr.V + keys[fr.name][kn]
                if mode == 'surface':
                    Dk = body.eval(body.smap, bind, Vk) - base
                elif mode == 'rigid':
                    Dk = np.zeros_like(rest)
                    for c, ab in anchors.items():
                        sel = comp == c
                        d = body.eval(body.skull, ab, Vk)[0] - body.eval(body.skull, ab, fr.V)[0]
                        Dk[sel] = d
                else:
                    d = body.eval(body.smap, anchors[0], Vk)[0] - body.eval(body.smap, anchors[0], fr.V)[0]
                    Dk = np.broadcast_to(d, rest.shape).copy()
                deltas.append((kn, clean(Dk, PART_EPS)))
            if family == 'spc_dwarf_beard':
                deltas.append(('beard_tuck', clean(beard_tuck(fr, S if fr is frb else Surf(fr), rest), PART_EPS)))
            add_keys(o, rest, deltas)
        for o in (ob, obs):
            o['family'] = family
            o['variant'] = variant
            o['species'] = species or 'any'
            o['hides'] = list(hides)
            o['kind'] = 'part'
            toon.apply_look(o, outline=0.0022 if family == 'brows' else 0.0035)
        made[name] = {'broad': ob, 'slight': obs}
        stats[name] = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        log('part %-26s %4d tris  %4d verts  (%s)' % (name, stats[name], len(ob.data.vertices), mode))
    return made, stats


# ====================================================================== 6. presets and the manifest
PRESETS = {
    'human': [
        ('hum_a', 'Weathered', {'face_brow_heavy': 0.75, 'face_jaw_wide': 0.35, 'face_eye_narrow': 0.35, 'face_cheek_high': 0.25},
         ['hair_crop', 'brows_heavy'], 1, 1),
        ('hum_b', 'Open', {'face_cheek_full': 0.6, 'face_eye_big': 0.55, 'face_jaw_narrow': 0.3, 'face_brow_raise': 0.35},
         ['hair_shaggy', 'brows_soft'], 0, 4),
        ('hum_c', 'Sharp', {'face_jaw_narrow': 0.75, 'face_cheek_high': 0.75, 'face_nose_long': 0.4, 'face_chin_long': 0.3},
         ['hair_tied', 'brows_arched'], 2, 0),
    ],
    'dwarf': [
        ('dwf_a', 'Anvil', {'face_jaw_wide': 0.8, 'face_brow_heavy': 0.8, 'face_nose_wide': 0.4},
         ['spc_dwarf_beard', 'spc_dwarf_braids', 'hair_crop', 'brows_heavy'], 1, 3),
        ('dwf_b', 'Hearth', {'face_cheek_full': 0.8, 'face_nose_wide': 0.5, 'face_eye_big': 0.2},
         ['spc_dwarf_beard_short', 'hair_shaggy', 'brows_soft'], 0, 2),
        ('dwf_c', 'Flint', {'face_eye_narrow': 0.7, 'face_brow_heavy': 0.5, 'face_nose_long': 0.4, 'face_jaw_narrow': 0.2},
         ['spc_dwarf_beard_forked', 'hair_tied', 'brows_heavy'], 2, 5),
    ],
    'elf': [
        ('elf_a', 'Still', {'face_chin_long': 0.6, 'face_nose_long': 0.3, 'face_jaw_narrow': 0.4},
         ['spc_elf_ears', 'hair_long', 'brows_soft'], 0, 0),
        ('elf_b', 'Wry', {'face_brow_raise': 0.6, 'face_mouth_wide': 0.45, 'face_cheek_high': 0.4},
         ['spc_elf_ears_long', 'hair_tied', 'brows_arched'], 1, 4),
        ('elf_c', 'Hollow', {'face_cheek_high': 0.85, 'face_brow_heavy': 0.4, 'face_eye_narrow': 0.3, 'face_jaw_narrow': 0.6},
         ['spc_elf_ears', 'hair_swept', 'brows_arched'], 2, 7),
    ],
    'orc': [
        ('orc_a', 'Brute', {'face_jaw_wide': 0.8, 'face_chin_long': 0.3, 'face_brow_heavy': 0.6},
         ['spc_orc_tusks_big', 'spc_orc_ears', 'spc_orc_topknot', 'brows_heavy'], 0, 0),
        ('orc_b', 'Grim', {'face_eye_narrow': 0.6, 'face_brow_heavy': 0.45, 'face_jaw_narrow': 0.2},
         ['spc_orc_tusks_small', 'spc_orc_ears', 'hair_crop', 'brows_heavy'], 1, 5),
        ('orc_c', 'Clan', {'face_nose_wide': 0.8, 'face_cheek_high': 0.4, 'face_brow_raise': 0.2},
         ['spc_orc_tusks', 'spc_orc_ears', 'hair_tied', 'brows_soft'], 2, 3),
    ],
    'halfling': [
        ('hlf_a', 'Bright', {'face_eye_big': 0.7, 'face_cheek_full': 0.4, 'face_brow_raise': 0.4},
         ['spc_halfling_curls', 'spc_halfling_feet', 'brows_soft'], 0, 2),
        ('hlf_b', 'Shrewd', {'face_eye_narrow': 0.6, 'face_mouth_wide': 0.45, 'face_chin_long': 0.2},
         ['spc_halfling_curls', 'spc_halfling_feet', 'brows_arched'], 1, 1),
        ('hlf_c', 'Weathered', {'face_brow_heavy': 0.45, 'face_cheek_high': 0.3, 'face_nose_long': 0.35},
         ['spc_halfling_curls', 'spc_halfling_feet', 'brows_heavy'], 2, 5),
    ],
    'draconid': [
        ('drc_a', 'Ember', {'face_jaw_wide': 0.5, 'face_mouth_wide': 0.4, 'face_brow_heavy': 0.3},
         ['spc_draconid_horns_ram', 'spc_draconid_crest', 'spc_draconid_tail', 'spc_draconid_claws_hand', 'spc_draconid_claws_foot'], 0, 0),
        ('drc_b', 'Spire', {'face_nose_long': 1.0, 'face_chin_long': 0.6, 'face_jaw_narrow': 0.4},
         ['spc_draconid_horns', 'spc_draconid_crest', 'spc_draconid_tail', 'spc_draconid_claws_hand', 'spc_draconid_claws_foot'], 1, 2),
        ('drc_c', 'Old', {'face_brow_heavy': 0.7, 'face_eye_narrow': 0.4, 'face_cheek_high': 0.3},
         ['spc_draconid_horns_crown', 'spc_draconid_crest', 'spc_draconid_tail', 'spc_draconid_claws_hand', 'spc_draconid_claws_foot'], 2, 1),
    ],
}
# per preset: (id, name, face weights, parts, skin tone index, hair colour index — bone colour index for Draconids)


def species_parts(sp):
    own = [p[0] for p in PARTS if p[4] == sp]
    if sp == 'draconid':
        return own
    shared = [p[0] for p in PARTS if p[4] is None]
    return own + shared


def write_manifest(content, stats):
    path = os.path.join(MODELS, 'hero', 'manifest.json')
    data = read_json(path) if os.path.exists(path) else {}
    out = {}
    for sp in SPECIES:
        body = content[sp]['body']
        presets = []
        for i, (pid, pname, face, parts, skin, hair) in enumerate(PRESETS[sp]):
            tint = {'skin': skin}
            if sp == 'draconid':
                tint['bone'] = hair
            else:
                tint['hair'] = hair
            tint['eye'] = i % len(EYE_COLORS[sp])
            presets.append({'id': pid, 'name': pname, 'face': {k: round(v, 3) for k, v in face.items()}, 'parts': parts,
                            'tint': tint, 'partTris': sum(stats[p] for p in parts)})
        out[sp] = {
            'key': SPECIES_KEY.get(sp),
            'boneScales': body['boneScales'],
            'skinTones': body['skinTones'],
            'hairColors': [] if sp == 'draconid' else HAIR_COLORS,
            'eyeColors': EYE_COLORS[sp],
            'boneColors': BONE_COLORS,
            'parts': species_parts(sp),
            'presets': presets,
        }
    data['species'] = out
    write_json(path, data)
    log('manifest: species written to', os.path.relpath(path, REPO))


# ====================================================================== 7. review renders
SCALE_GROUP = {'UpperLeg': 'upperLeg', 'LowerLeg': 'lowerLeg', 'Shoulder': 'shoulder', 'UpperArm': 'upperArm',
               'LowerArm': 'lowerArm', 'Hand': 'hand', 'Foot': 'foot', 'Toes': 'toes'}
INHERIT = ('LeftEye', 'RightEye')


def bone_group(name):
    if name == 'Chest':
        return 'chest'
    if name == 'UpperChest':
        return 'upperChest'
    if name == 'Head':
        return 'head'
    if name == 'Neck':
        return 'neck'
    for k, g in SCALE_GROUP.items():
        if name in ('Left' + k, 'Right' + k):
            return g
    if name in FINGERS:
        return 'fingers'
    return None


def apply_bone_scales(rig, scales):
    """Pose-bone scales so every body bone's absolute scale is root × its group factor (no compounding down the
    chain); the eyes and the chain bones inherit their parent's. The root scale goes on the armature object."""
    from rig import CHAIN_BONES
    chain = {b for b, _ in CHAIN_BONES} | set(INHERIT)
    absol = {}

    def ab(name):
        if name in absol:
            return absol[name]
        b = rig.data.bones[name]
        if name in chain:
            v = ab(b.parent.name) if b.parent else 1.0
        else:
            g = bone_group(name)
            v = float(scales.get(g, 1.0)) if g else 1.0
        absol[name] = v
        return v
    for pb in rig.pose.bones:
        par = rig.data.bones[pb.name].parent
        local = ab(pb.name) / (ab(par.name) if par else 1.0)
        pb.scale = (local, local, local)
    r = float(scales.get('root', 1.0))
    rig.scale = (r, r, r)


TEST_POSE_SPEC = {
    'Spine': (8, 0, 0), 'Chest': (6, 8, 0), 'Neck': (-6, 0, 0), 'Head': (6, 15, 0),
    'LeftUpperArm': (70, 0, 20), 'LeftLowerArm': (95, 0, 0), 'LeftHand': (30, 0, 0),
    'LeftUpperLeg': (45, 0, 4), 'LeftLowerLeg': (-80, 0, 0), 'LeftFoot': (25, 0, 0),
}


def test_pose():
    """build_body.py's test pose (a stride, one fist raised, the head turned)."""
    from rig import mirrored
    p = mirrored(TEST_POSE_SPEC)
    p['RightUpperArm'] = (-25, 0, -12)
    p['RightLowerArm'] = (40, 0, 0)
    p['RightUpperLeg'] = (-10, 0, -3)
    p['RightLowerLeg'] = (-15, 0, 0)
    for f in ('Index', 'Middle', 'Ring', 'Little'):
        for ph, a in (('Proximal', 70), ('Intermediate', 90), ('Distal', 55)):
            p['Left' + f + ph] = (a, 0, 0)
    for ph, a in (('Proximal', 20), ('Intermediate', 35), ('Distal', 30)):
        p['LeftThumb' + ph] = (a, 0, 0)
    return p


def set_rotations(rig, pose):
    for pb in rig.pose.bones:
        rot = pose.get(pb.name, (0, 0, 0)) if pose else (0, 0, 0)
        pb.rotation_euler = [math.radians(a) for a in rot]
        pb.location = (0, 0, 0)


class Review:
    def __init__(self, frames, parts, content):
        from render import Stage
        self.frames = frames
        self.parts = parts
        self.content = content
        # the body build left its stage in the file: clear it, or every light would shine twice
        old = bpy.data.collections.get('GV_Stage')
        if old:
            for o in list(old.objects):
                bpy.data.objects.remove(o)
        self.st = Stage(OUT, size=700 if QUICK else 1000, quick=QUICK)
        self.st.sc.render.film_transparent = False
        for o in bpy.data.objects:
            if o.type == 'MESH' and o.name not in ('GV_Platform', 'GV_PlatformRing'):
                o.hide_render = True
        for nm in ('Sticks_broad', 'Sticks_slight'):
            if nm in bpy.data.objects:
                bpy.data.objects[nm].hide_render = True
        self.shown = []

    def show(self, frame, sp, preset=None, pose=None, face_override=None, species_on=True, parts_on=True, parts=None):
        """Puts one hero on stage: frame + species (+ preset) with its bone scales, keys, parts and colours."""
        for o in self.shown:
            o.hide_render = True
        fr = self.frames[frame]
        body, rig = fr.body, fr.rig
        pr = None
        if preset is not None:
            pr = [p for p in PRESETS[sp] if p[0] == preset][0]
        face = dict(pr[2]) if pr else {}
        if face_override is not None:
            face = face_override
        names = list(pr[3]) if (pr and parts_on) else []
        if parts is not None:
            names = list(parts)
        obs = [body] + [self.parts[n][frame] for n in names]
        for o in obs:
            o.hide_render = False
            kb = o.data.shape_keys.key_blocks if o.data.shape_keys else None
            if kb is None:
                continue
            for k in kb[1:]:
                k.value = 0.0
            if species_on and sp in SPECIES_KEY and SPECIES_KEY[sp] in kb:
                kb[SPECIES_KEY[sp]].value = 1.0
            for k, w in face.items():
                if k in kb:
                    kb[k].value = w
        self.shown = obs
        scales = self.content[sp]['body']['boneScales'] if species_on else {'root': 1.0}
        rig.location = (0, 0, 0)
        apply_bone_scales(rig, scales)
        set_rotations(rig, pose)
        bpy.context.view_layer.update()
        # feet on the floor
        dg = bpy.context.evaluated_depsgraph_get()
        zmin = 1e9
        for o in obs:
            ev = o.evaluated_get(dg)
            me = ev.to_mesh()
            mw = ev.matrix_world
            for v in me.vertices:
                z = (mw @ v.co).z
                if z < zmin:
                    zmin = z
            ev.to_mesh_clear()
        rig.location = (0, 0, -zmin + 0.004)
        bpy.context.view_layer.update()
        # colours
        tones = self.content[sp]['body']['skinTones']
        skin = tones[pr[4]] if pr else tones[0]
        eyes = EYE_COLORS[sp]
        ei = [p[0] for p in PRESETS[sp]].index(pr[0]) % len(eyes) if pr else 0
        prev = {'skin': skin, 'skin2': shade(skin, 0.82), 'hair': HAIR_COLORS[pr[5]] if (pr and sp != 'draconid') else HAIR_COLORS[1],
                'bone': BONE_COLORS[pr[5]] if (pr and sp == 'draconid') else BONE_COLORS[0], 'iris': eyes[ei]}
        if sp == 'draconid':
            prev['skin2'] = shade(skin, 1.28)
        toon.palette_material(prev)
        return self.height(sp, frame)

    def height(self, sp, frame):
        dg = bpy.context.evaluated_depsgraph_get()
        ev = self.frames[frame].body.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world
        h = max((mw @ v.co).z for v in me.vertices)
        ev.to_mesh_clear()
        return h

    def head_center(self, frame):
        rig = self.frames[frame].rig
        pb = rig.pose.bones['Head']
        m = rig.matrix_world @ pb.matrix
        h = m.translation
        top = m @ Vector((0, pb.bone.length, 0))
        return np.array(h[:]), np.array(top[:])


def shade(hexs, k):
    h = hexs.lstrip('#')
    rgb = [min(255, int(int(h[i:i + 2], 16) * k)) for i in (0, 2, 4)]
    return '#%02x%02x%02x' % tuple(rgb)


def render_all(frames, parts, content, which):
    from render import grid_sheet, load_pixels, save_pixels
    rv = Review(frames, parts, content)
    st = rv.st
    os.makedirs(OUT, exist_ok=True)
    files = []
    default = {sp: PRESETS[sp][0][0] for sp in SPECIES}

    if 'lineup' in which:
        for frame in FRAMES:
            for view in ('front', 'q'):
                cols = []
                for sp in SPECIES:
                    rv.show(frame, sp, default[sp])
                    st.show_platform(False)
                    st.sc.render.film_transparent = True
                    if view == 'front':
                        st.camera((0, -8, 1.05), (0, 0, 1.05), ortho=2.3)
                    else:
                        st.camera((-2.05, -2.6, 1.3), (0, 0, 0.98), lens=50)
                    p = st.shot('_col.png', size=None)
                    px = load_pixels(p)
                    h, w, _ = px.shape
                    cols.append(px[:, int(w * (0.25 if view == "front" else 0.12)):int(w * (0.75 if view == "front" else 0.88))])
                    os.remove(p)
                    st.sc.render.film_transparent = False
                    st.show_platform(True)
                sheet = np.concatenate(cols, axis=1)
                bgc = np.array([0.012, 0.013, 0.02, 1.0], dtype=np.float32)
                a = sheet[..., 3:4]
                sheet = sheet * a + bgc * (1 - a)
                sheet[..., 3] = 1.0
                out = os.path.join(OUT, 'lineup_%s_%s.png' % (frame, view))
                save_pixels(out, sheet)
                files.append(out)
                # the 200-px-tall read of the whole lineup
                img = bpy.data.images.load(out)
                w0, h0 = img.size
                img.scale(int(w0 * 200 / h0), 200)
                img.filepath_raw = out.replace('.png', '_200.png')
                img.file_format = 'PNG'
                img.save()
                bpy.data.images.remove(img)
    if 'cards' in which:
        cards = []
        for frame in FRAMES:
            for sp in SPECIES:
                h = rv.show(frame, sp, default[sp])
                full = st.card(max(h, 1.25), name='card_%s_%s.png' % (sp, frame))
                os.remove(full)           # the 200-px read is what this set is for; the lineups show the full size
                cards.append(os.path.join(OUT, 'card_%s_%s_200.png' % (sp, frame)))
        grid_sheet(cards, os.path.join(OUT, 'reads_200.png'), cols=6)
        files.append(os.path.join(OUT, 'reads_200.png'))
    if 'heads' in which:
        for frame in FRAMES:
            heads = []
            for sp in SPECIES:
                for pid, *_ in PRESETS[sp]:
                    rv.show(frame, sp, pid)
                    hc, top = rv.head_center(frame)
                    hh = top[2] - hc[2]
                    tgt = hc + V3(0, 0, hh * 0.42)
                    d = V3(-0.62, -1.0, 0.1)
                    st.camera(tuple(tgt + unit(d) * hh * 4.4), tuple(tgt), lens=85)
                    heads.append(st.shot('_head_%s_%s.png' % (pid, frame)))
            grid_sheet(heads, os.path.join(OUT, 'heads_%s.png' % frame), cols=3, cell=380)
            for p in heads:
                os.remove(p)
            files.append(os.path.join(OUT, 'heads_%s.png' % frame))
    if 'gallery' in which:
        # every hair style on a Human and every beard on a Dwarf (some are in no preset), broad frame
        cells = []
        sets = [('human', ['hair_' + h, 'brows_soft']) for h in ('crop', 'shaggy', 'long', 'tied', 'swept', 'bun')]
        sets += [('dwarf', [b, 'hair_crop', 'brows_heavy']) for b in ('spc_dwarf_beard', 'spc_dwarf_beard_forked',
                                                                    'spc_dwarf_beard_short', 'spc_dwarf_beard_braided')]
        for sp, pp in sets:
            rv.show('broad', sp, PRESETS[sp][0][0], parts=pp, face_override={})
            hc, top = rv.head_center('broad')
            hh = top[2] - hc[2]
            tgt = hc + V3(0, 0, hh * 0.2)
            st.camera(tuple(tgt + unit(V3(-0.75, -1.0, 0.12)) * hh * 5.2), tuple(tgt), lens=85)
            cells.append(st.shot('_g_%d.png' % len(cells)))
        grid_sheet(cells, os.path.join(OUT, 'gallery_parts.png'), cols=5, cell=360)
        for p in cells:
            os.remove(p)
        files.append(os.path.join(OUT, 'gallery_parts.png'))
    if 'profiles' in which:
        for frame in FRAMES:
            profs = []
            for sp in SPECIES:
                rv.show(frame, sp, default[sp])
                hc, top = rv.head_center(frame)
                hh = top[2] - hc[2]
                tgt = hc + V3(0, 0, hh * 0.35)
                for nm, d in (('front', V3(0, -1, 0)), ('side', V3(-1, 0, 0)), ('back', V3(0.5, 1, 0.2))):
                    st.camera(tuple(tgt + unit(d) * hh * 4.8), tuple(tgt), lens=85)
                    profs.append(st.shot('_prof_%s_%s_%s.png' % (sp, frame, nm)))
            grid_sheet(profs, os.path.join(OUT, 'profiles_%s.png' % frame), cols=3, cell=360)
            for p in profs:
                os.remove(p)
            files.append(os.path.join(OUT, 'profiles_%s.png' % frame))
    if 'poses' in which:
        poses = []
        for frame in FRAMES:
            for sp in SPECIES:
                h = rv.show(frame, sp, default[sp], pose=test_pose())
                poses.append(st.card(max(h, 1.25), name='_pose_%s_%s.png' % (sp, frame)))
                os.remove(os.path.join(OUT, '_pose_%s_%s_200.png' % (sp, frame)))
        grid_sheet(poses, os.path.join(OUT, 'poses.png'), cols=6, cell=400)
        # the heads in the test pose: hair, ears, horns and beards must stay put when the head turns
        for p in poses:
            os.remove(p)
        files.append(os.path.join(OUT, 'poses.png'))
        heads = []
        for frame in FRAMES:
            for sp in SPECIES:
                rv.show(frame, sp, default[sp], pose=test_pose())
                hc, top = rv.head_center(frame)
                hh = float(np.linalg.norm(top - hc))
                tgt = hc + (top - hc) * 0.4
                st.camera(tuple(tgt + unit(V3(0.9, -1.0, 0.15)) * hh * 5.0), tuple(tgt), lens=85)
                heads.append(st.shot('_ph_%s_%s.png' % (sp, frame)))
        grid_sheet(heads, os.path.join(OUT, 'poses_heads.png'), cols=6, cell=300)
        for p in heads:
            os.remove(p)
        files.append(os.path.join(OUT, 'poses_heads.png'))
    if 'keys' in which:
        for frame in FRAMES:
            shots = []
            for sp in SPECIES:
                rv.show(frame, sp, None, parts_on=False)
                hc, top = rv.head_center(frame)
                hh = top[2] - hc[2]
                tgt = hc + V3(0, 0, hh * 0.35)
                for d in (V3(0, -1, 0), V3(-1, 0, 0)):
                    st.camera(tuple(tgt + unit(d) * hh * 4.8), tuple(tgt), lens=85)
                    shots.append(st.shot('_k_%d.png' % len(shots)))
            grid_sheet(shots, os.path.join(OUT, 'keys_species_%s.png' % frame), cols=4, cell=360)
            for p in shots:
                os.remove(p)
            files.append(os.path.join(OUT, 'keys_species_%s.png' % frame))
            shots = []
            for kname in [None] + FACE_KEYS:
                rv.show(frame, 'human', None, parts_on=False, face_override={kname: 1.0} if kname else {})
                hc, top = rv.head_center(frame)
                hh = top[2] - hc[2]
                tgt = hc + V3(0, 0, hh * 0.3)
                st.camera(tuple(tgt + unit(V3(-0.5, -1, 0.05)) * hh * 3.1), tuple(tgt), lens=85)
                shots.append(st.shot('_f_%d.png' % len(shots)))
            grid_sheet(shots, os.path.join(OUT, 'keys_face_%s.png' % frame), cols=5, cell=380)
            for p in shots:
                os.remove(p)
            files.append(os.path.join(OUT, 'keys_face_%s.png' % frame))
    # leave the scene at rest
    for fr in frames.values():
        apply_bone_scales(fr.rig, {'root': 1.0})
        set_rotations(fr.rig, None)
        fr.rig.location = (0, 0, 0)
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.data.shape_keys:
            for k in o.data.shape_keys.key_blocks[1:]:
                k.value = 0.0
        if o.type == 'MESH' and not o.name.startswith('GV_') and not o.name.startswith('Sticks'):
            o.hide_render = False
    toon.palette_material()
    return files


# ====================================================================== main
def main():
    content = {sp: read_json(os.path.join(CONTENT, 'species', sp + '.json')) for sp in SPECIES}
    for sp in SPECIES:
        want = content[sp]['body']['shapeKeys']
        assert want == ([SPECIES_KEY[sp]] if sp in SPECIES_KEY else []), (sp, want)
    want_parts = sorted(p for sp in SPECIES for p in content[sp]['body']['parts'])
    have = sorted(p[0] for p in PARTS if p[0] in want_parts)
    assert have == want_parts, (have, want_parts)
    frames = {f: Frame(f) for f in FRAMES}
    frb, frs = frames['broad'], frames['slight']
    BROAD_HH[0] = frb.hh
    BROAD_H[0] = frb.H
    lm = find_landmarks(frb)
    ears = find_ears(frb)
    EAR_SET.update(int(i) for i in ears['L'])
    EAR_SET.update(int(i) for i in ears['R'])
    for fr in frames.values():
        setup_frame(fr, lm, ears)
        log('%s: H %.3f  head %.3f (s %.3f)  eyeball r %.4f c %s iris %s  ear verts %d/%d  x0 %.4f' % (
            fr.name, fr.H, fr.hh, fr.s, fr.eye['L']['r'], fr.eye['L']['c'].round(4), fr.eye['L']['o'].round(4),
            len(ears['L']), len(ears['R']), fr.ear['L']['x0']))
    # body keys
    keys = {}
    for fr in frames.values():
        ks = {}
        for sp, kn in SPECIES_KEY.items():
            ks[kn] = clean(species_key(fr, sp))
        for kn in FACE_KEYS:
            ks[kn] = clean(face_key(fr, kn))
        keys[fr.name] = ks
        add_keys(fr.body, fr.V, [(k, ks[k]) for k in SPC_KEYS + FACE_KEYS])
        for k in SPC_KEYS + FACE_KEYS:
            D = ks[k]
            m = np.linalg.norm(D, axis=1)
            log('  %s %-20s moves %4d verts, max %.1f mm' % (fr.name, k, int((m > 0).sum()), 1000 * m.max()))
    body = Body(frb, frs)
    parts, stats = build_parts(frb, frs, body, keys)
    for sp in SPECIES:
        for pid, pname, face, pp, *_ in PRESETS[sp]:
            log('preset %s %-10s parts %4d tris' % (pid, pname, sum(stats[p] for p in pp)))
    write_manifest(content, stats)
    if not ARGS.get('norender'):
        which = (ARGS.get('renders') or 'lineup,cards,heads,gallery,profiles,poses,keys').split(',')
        files = render_all(frames, parts, content, which)
        for f in files:
            log('render', os.path.relpath(f, REPO))
    if not ARGS.get('no_save'):
        # the review outline is a Solidify: strip it so the gear passes evaluate the real body and parts
        toon.remove_outlines()
        save_blend(os.path.join(BUILD, 'hero_species.blend'))


main()

"""build_clips.py — the shared hero clip set, authored once on Rig_broad (tools/blender/README.md §Clips, 11 §3).

Run:  blender -b art/build/hero_body.blend -P tools/blender/hero/build_clips.py -- [--quick] [--only Idle,Walk]
                                                                              [--no-renders] [--no-export]

Every clip is a pose table: a list of (seconds, pose) where a pose is {bone: (x, y, z) degrees, 'Hips.loc': (x, y, z)}
keyed with rig.make_action (Bezier, 30 fps). Most angles are written by hand; where a hand or a foot must land on
something (a planted foot, the off hand on a two-handed grip, a bowstring at the jaw, a palm on the floor) the angles
are *solved* at build time by a small damped-least-squares IK over this rig's own forward kinematics, and the solved
angles are what gets keyed — the output is still a plain pose table, and a re-run gives the same keys.

Conventions (rig.py): +X bends forward / curls; +Y twists (spine and head: + turns to the character's left); +Z on a
bone pointing up leans it to the character's right, on a bone pointing down (legs, the A-pose arms) swings it toward
the character's LEFT (left arm/leg: + = out, away from the body); the right side is mirrored (Y and Z negated).
Feet: +X = toes up. Knees bend with -X, elbows with +X. World: +X = the character's left, -Y = forward, +Z up.

Outputs
- art/build/hero_clips.blend (the body file + the 19 actions, stashed on muted NLA tracks)
- client/public/models/hero/hero_clips.glb (the armature `Rig` and the clips; no mesh) and clips.json (event times)
- art/renders/hero/clips/<Clip>.png (key frames, broad row over slight row, placeholder sword / dagger / bow / tail),
  hit_<Attack>.png (the hit frames up close), joints_elbow.png / joints_knee.png (most bent), poses_200.png (the
  200-px read of every clip's key frame)

Event frames per clip are in CLIP definitions below (`events=`) and go to clips.json.
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))
from common import BUILD, MODELS, RENDERS, REPO, args, log, save_blend, write_json  # noqa: E402
import rig as R  # noqa: E402
import toon  # noqa: E402
from export import export_glb, reimport_report, stash_actions  # noqa: E402

ARGS = args()
QUICK = bool(ARGS.get('quick'))
ONLY = set(ARGS['only'].split(',')) if isinstance(ARGS.get('only'), str) else None
FPS = 30
OUT = os.path.join(RENDERS, 'hero', 'clips')
HERO = os.path.join(MODELS, 'hero')
FRAMES = ('broad', 'slight')
IK_LOG = []          # (clip, t, what, error) for the build log


def f(n):
    """Frame number → seconds (keys are authored on whole frames)."""
    return n / FPS


def W(left, fwd, up):
    """A world point in the character's terms (left, forward, up) → Blender (x, y, z)."""
    return Vector((left, -fwd, up))


def D(left, fwd, up):
    return W(left, fwd, up).normalized()


# ====================================================================== forward kinematics and the solver
class Skel:
    """Blender's pose formula (no constraints) on a rig's rest matrices — exact to 1e-6 against pose_bone.matrix."""

    def __init__(self, frame):
        self.frame = frame
        self.ob = bpy.data.objects['Rig_' + frame]
        bones = self.ob.data.bones
        self.rest = {b.name: b.matrix_local.copy() for b in bones}
        self.parent = {b.name: (b.parent.name if b.parent else None) for b in bones}
        self.rel = {n: (self.rest[p].inverted() @ self.rest[n]) if p else self.rest[n].copy() for n, p in self.parent.items()}
        self.mode = {pb.name: pb.rotation_mode for pb in self.ob.pose.bones}
        self.length = {b.name: b.length for b in bones}
        self.head0 = {n: m.translation.copy() for n, m in self.rest.items()}
        self.sockets = {}
        for o in bpy.data.objects:
            if o.type == 'EMPTY' and o.parent == self.ob and o.parent_type == 'BONE':
                self.sockets[o.name.rsplit('.', 1)[0]] = (o.parent_bone, o.matrix_parent_inverse @ o.matrix_basis)
        self.height = max(v.co.z for v in bpy.data.objects['Body_' + frame].data.vertices)
        self.children = {}
        for n, p in self.parent.items():
            self.children.setdefault(p, []).append(n)

    def subtree(self, root):
        out, stack = set(), [root]
        while stack:
            n = stack.pop()
            out.add(n)
            stack += self.children.get(n, [])
        return out

    def fixed(self, pose, root):
        """Every bone's matrix except `root` and its descendants (they are what a solver moves)."""
        moving = self.subtree(root)
        return {n: m for n, m in self.mats(pose).items() if n not in moving}

    def basis(self, name, pose):
        r = pose.get(name)
        m = Euler([math.radians(a) for a in r], self.mode[name]).to_matrix().to_4x4() if r else Matrix.Identity(4)
        if name == 'Hips':
            loc = pose.get('Hips.loc')
            if loc:
                m = Matrix.Translation(loc) @ m
        return m

    def mats(self, pose, names=None, cache=None):
        out = {} if cache is None else cache

        def get(n):
            m = out.get(n)
            if m is None:
                p = self.parent[n]
                m = (get(p) @ self.rel[n] if p else self.rel[n]) @ self.basis(n, pose)
                out[n] = m
            return m
        for n in (names if names is not None else self.rest):
            get(n)
        return out

    def socket(self, name, mats):
        bone, off = self.sockets[name]
        return mats[bone] @ Matrix.Translation((0, self.length[bone], 0)) @ off


def lm(fun, x0, lo, hi, iters=80, h=0.1):
    """Levenberg-Marquardt with box limits (projected); x in degrees."""
    x = np.clip(np.asarray(x0, dtype=float), lo, hi)
    r = fun(x)
    cost = float(r @ r)
    mu = 1e-2
    n = x.size
    for _ in range(iters):
        J = np.empty((r.size, n))
        for i in range(n):
            xp = x.copy()
            if xp[i] + h > hi[i]:
                xp[i] -= h
                J[:, i] = (r - fun(xp)) / h
            else:
                xp[i] += h
                J[:, i] = (fun(xp) - r) / h
        A = J.T @ J
        g = J.T @ r
        done = True
        for _try in range(10):
            dx = -np.linalg.solve(A + mu * (np.diag(np.diag(A)) + 1e-3 * np.eye(n)), g)
            big = np.abs(dx).max()
            if big > 20:
                dx *= 20 / big
            xn = np.clip(x + dx, lo, hi)
            rn = fun(xn)
            cn = float(rn @ rn)
            if cn < cost:
                done = np.abs(xn - x).max() < 2e-3
                x, r, cost = xn, rn, cn
                mu = max(mu / 3, 1e-7)
                break
            mu *= 4
        else:
            break
        if done:
            break
    return x


def mirror_limits(table, side):
    out = {}
    for (b, a), (lo, hi) in table.items():
        if side == 'R' and a in (1, 2):
            lo, hi = -hi, -lo
        out[(b, a)] = (lo, hi)
    return out


def side_pre(side):
    return 'Left' if side == 'L' else 'Right'


def mir(side, v):
    return tuple(v) if side == 'L' else (v[0], -v[1], -v[2])


def setp(p, bone, axis, value):
    r = list(p.get(bone, (0.0, 0.0, 0.0)))
    r[axis] = float(value)
    p[bone] = tuple(r)


# ---------------------------------------------------------------------- arms
ARM_KEYS = [('UpperArm', 0), ('UpperArm', 1), ('UpperArm', 2), ('LowerArm', 0), ('LowerArm', 1), ('Hand', 0), ('Hand', 1), ('Hand', 2)]
ARM_LIMITS_L = {('UpperArm', 0): (-80, 178), ('UpperArm', 1): (-95, 95), ('UpperArm', 2): (-65, 135),
                ('LowerArm', 0): (2, 135), ('LowerArm', 1): (-70, 70),
                ('Hand', 0): (-75, 75), ('Hand', 1): (-20, 20), ('Hand', 2): (-38, 24)}
# fallback starts for the solver (left side; mirrored for the right): forward, up, out, across the body, back
ARM_STARTS_L = [((70, 0, 0), (30, 0, 0), (0, 0, 0)), ((150, 0, 20), (40, 0, 0), (0, 0, 0)), ((20, 0, 60), (30, 0, 0), (0, 0, 0)),
                ((60, 50, -10), (90, 0, 0), (0, 0, 0)), ((-30, 0, 10), (60, 0, 0), (0, 0, 0)), ((100, -40, 50), (100, 0, 0), (0, 0, 0))]


def reach(p, side, pos=None, blade=None, edge=None, rel=None, skels=None, seed=None, prefer=None, reg=0.012,
          w_pos=120.0, w_dir=30.0, w_edge=8.0, tag=''):
    """
    Solves one arm (UpperArm xyz, LowerArm xy, Hand xyz) so its hand socket reaches `pos` (world, broad frame) with its
    +Y (where a held blade points) along `blade` and its +Z (wrist → knuckles) along `edge`. `rel(sk, mats, S)` returns
    extra residuals measured on each frame in `skels` (e.g. the off hand on the grip line of the main hand). The angles
    start from `seed` (or what p holds) and are pulled lightly toward `prefer` (or the start) so the elbow keeps its
    swivel. Writes the angles into p; logs the broad frame's remaining error.
    """
    pre = side_pre(side)
    sock = 'Socket_Hand' + side
    lim = mirror_limits(ARM_LIMITS_L, side)
    names = [(pre + b, a) for b, a in ARM_KEYS]
    lo = np.array([lim[k][0] for k in ARM_KEYS], dtype=float)
    hi = np.array([lim[k][1] for k in ARM_KEYS], dtype=float)
    start = dict(p)
    if seed:
        start.update(seed)
    x0 = np.array([start.get(b, (0, 0, 0))[a] for b, a in names], dtype=float)
    pref = dict(start)
    if prefer:
        pref.update(prefer)
    xp = np.array([pref.get(b, (0, 0, 0))[a] for b, a in names], dtype=float)
    skels = skels or (BROAD,)
    fixed = {sk.frame: sk.fixed(p, pre + 'UpperArm') for sk in set(skels) | {BROAD}}
    blade = blade.normalized() if blade is not None else None
    edge = edge.normalized() if edge is not None else None

    def solve_pose(x):
        q = dict(p)
        for (b, a), v in zip(names, x):
            setp(q, b, a, v)
        return q

    def fun(x):
        q = solve_pose(x)
        res = []
        M = BROAD.mats(q, [pre + 'Hand'], dict(fixed['broad']))
        S = BROAD.socket(sock, M)
        if pos is not None:
            res += list((S.translation - pos) * w_pos)
        if blade is not None:
            res += list((S.col[1].xyz - blade) * w_dir)
        if edge is not None:
            res += list((S.col[2].xyz - edge) * w_edge)
        if rel:
            for sk in skels:
                Ms = M if sk is BROAD else sk.mats(q, [pre + 'Hand'], dict(fixed[sk.frame]))
                Ss = S if sk is BROAD else sk.socket(sock, Ms)
                res += list(rel(sk, Ms, Ss))
        res += list((x - xp) * reg)
        return np.array(res, dtype=float)

    def errors(x):
        q = solve_pose(x)
        M = BROAD.mats(q)
        S = BROAD.socket(sock, M)
        ep = (S.translation - pos).length * 100 if pos is not None else 0.0
        if rel is not None and pos is None:
            ep = float(np.linalg.norm(np.array(rel(BROAD, M, S)[:3]))) / 1.0
        ed = math.degrees(S.col[1].xyz.angle(blade)) if blade is not None else 0.0
        return ep, ed
    x = lm(fun, x0, lo, hi)
    best = (float(fun(x) @ fun(x)), x)
    ep, ed = errors(x)
    if ep > 1.5 or ed > 6.0:
        for ua, la, hd in ARM_STARTS_L:
            xs = np.array(list(mir(side, ua)) + [la[0], 0.0] + list(mir(side, hd)), dtype=float)
            xs = lm(fun, xs, lo, hi)
            c = float(fun(xs) @ fun(xs))
            if c < best[0]:
                best = (c, xs)
        x = best[1]
        ep, ed = errors(x)
    if blade is not None and ed > 10.0:
        # the blade leaves the fist at 52-114 deg from the forearm (wrist deviation): aim at the nearest direction on
        # that cone around the solved forearm instead of the unreachable one, and solve again from here
        intent = blade
        for _ in range(2):
            F = BROAD.mats(solve_pose(x), [pre + 'LowerArm'])[pre + 'LowerArm'].col[1].xyz.normalized()
            ang = math.degrees(F.angle(intent))
            lo_c, hi_c = 56.0, 110.0
            if lo_c <= ang <= hi_c:
                break
            axis = F.cross(intent)
            if axis.length < 1e-6:
                break
            blade = (Matrix.Rotation(math.radians(min(max(ang, lo_c), hi_c)), 3, axis.normalized()) @ F).normalized()
            x = lm(fun, x, lo, hi)
        blade = intent
        ep, ed = errors(x)
    for (b, a), v in zip(names, x):
        setp(p, b, a, round(float(v), 3))
    IK_LOG.append((CURRENT[0], tag or ('arm ' + side), ep, ed))
    return p


def grip_rel(dist=0.10, w=100.0, w_dir=30.0):
    """The off (left) hand on the main hand's grip, `dist` below it along the blade, both thumbs toward the blade."""
    def rel(sk, M, S):
        Sr = sk.socket('Socket_HandR', M)
        y = Sr.col[1].xyz
        target = Sr.translation - y * dist
        wk = 1.0 if sk is BROAD else 0.45
        return list((S.translation - target) * w * wk) + list((S.col[1].xyz - y) * w_dir * wk) + \
            list((S.col[2].xyz - Sr.col[2].xyz) * 8 * wk)
    return rel


def head_rel(local, w=100.0, edge=None):
    """The hand socket at a point given in the Head bone's frame (x left, y up the head, z forward), per frame."""
    def rel(sk, M, S):
        k = sk.height / BROAD.height
        Hm = M['Head']
        target = Hm @ Vector((local[0] * k, local[1] * k, local[2] * k))
        wk = 1.0 if sk is BROAD else 0.8
        out = list((S.translation - target) * w * wk)
        if edge is not None:
            out += list((S.col[2].xyz - edge.normalized()) * 10 * wk)
        return out
    return rel


# ---------------------------------------------------------------------- legs
LEG_KEYS = [('UpperLeg', 0), ('UpperLeg', 1), ('UpperLeg', 2), ('LowerLeg', 0), ('Foot', 0), ('Foot', 1), ('Foot', 2)]
LEG_LIMITS_L = {('UpperLeg', 0): (-50, 140), ('UpperLeg', 1): (-50, 50), ('UpperLeg', 2): (-35, 80),
                ('LowerLeg', 0): (-160, -0.3), ('Foot', 0): (-70, 45), ('Foot', 1): (-25, 25), ('Foot', 2): (-30, 30)}


class Foot:
    """A foot placement as a displacement of the flat foot from its rest place: `out` away from the midline, `fwd`,
    `up`; `yaw` + = toes out; `pitch` + = toes up, about the heel (pivot 'heel'), the ball ('ball') or the ankle."""
    __slots__ = ('out', 'fwd', 'up', 'yaw', 'pitch', 'pivot', 'toes')

    def __init__(self, out=0.0, fwd=0.0, up=0.0, yaw=0.0, pitch=0.0, pivot='ankle', toes=None):
        self.out, self.fwd, self.up, self.yaw, self.pitch, self.pivot, self.toes = out, fwd, up, yaw, pitch, pivot, toes

    def moved(self, **kw):
        g = Foot(self.out, self.fwd, self.up, self.yaw, self.pitch, self.pivot, self.toes)
        for k, v in kw.items():
            setattr(g, k, v)
        return g


def foot_target(sk, side, ft):
    s = 1 if side == 'L' else -1
    pre = side_pre(side)
    ankle0 = sk.head0[pre + 'Foot']
    ball0 = sk.head0[pre + 'Toes']
    k = sk.height / 1.794
    heel0 = Vector((ankle0.x, ankle0.y + 0.055 * k, 0.012))
    R0 = sk.rest[pre + 'Foot'].to_3x3()
    Ry = Matrix.Rotation(math.radians(s * ft.yaw), 3, 'Z')
    lat = Ry @ Vector((1, 0, 0))
    Rp = Matrix.Rotation(math.radians(-ft.pitch), 3, lat)
    a_flat = ankle0 + Vector((s * ft.out, -ft.fwd, ft.up))
    if ft.pivot == 'ball':
        b_flat = a_flat + Ry @ (ball0 - ankle0)
        ankle = b_flat + Rp @ (a_flat - b_flat)
    elif ft.pivot == 'heel':
        h_flat = a_flat + Ry @ (heel0 - ankle0)
        ankle = h_flat + Rp @ (a_flat - h_flat)
    else:
        ankle = a_flat
    rot = Rp @ Ry @ R0
    hinge = Ry @ sk.rest[pre + 'LowerLeg'].col[0].xyz
    toes = ft.toes if ft.toes is not None else (max(0.0, -ft.pitch) if ft.pivot == 'ball' else 0.0)
    return ankle, rot, hinge, toes


def plant(p, feet, skels=None, tag=''):
    """Solves each leg in `feet` ({'L': Foot, 'R': Foot}) on both frames so the ankle and the foot's orientation match
    the placement and the knee hinge stays square to the foot (the knee over the toes)."""
    skels = skels or (BROAD, SLIGHT)
    for side, ft in feet.items():
        pre = side_pre(side)
        lim = mirror_limits(LEG_LIMITS_L, side)
        names = [(pre + b, a) for b, a in LEG_KEYS]
        lo = np.array([lim[k][0] for k in LEG_KEYS], dtype=float)
        hi = np.array([lim[k][1] for k in LEG_KEYS], dtype=float)
        x0 = np.array([p.get(b, (0, 0, 0))[a] for b, a in names], dtype=float)
        x0[3] = min(x0[3], -2.0)
        tg = {sk.frame: foot_target(sk, side, ft) for sk in skels}
        fixed = {sk.frame: sk.mats(p, ['Hips']) for sk in skels}
        regw = np.array([0.004, 0.02, 0.01, 0.002, 0.004, 0.02, 0.01])

        def fun(x):
            q = dict(p)
            for (b, a), v in zip(names, x):
                setp(q, b, a, v)
            res = []
            for sk in skels:
                M = sk.mats(q, [pre + 'Foot'], dict(fixed[sk.frame]))
                ankle, rot, hinge, _ = tg[sk.frame]
                F = M[pre + 'Foot']
                L = M[pre + 'LowerLeg']
                wk = 1.0 if sk is BROAD else 0.8
                res += list((F.translation - ankle) * 100 * wk)
                res += list((F.col[1].xyz - rot.col[1]) * 25 * wk)
                res += list((F.col[2].xyz - rot.col[2]) * 25 * wk)
                res += list((L.col[0].xyz - hinge) * 6 * wk)
            res += list((x - x0) * regw)
            return np.array(res, dtype=float)
        x = lm(fun, x0, lo, hi)
        for (b, a), v in zip(names, x):
            setp(p, b, a, round(float(v), 3))
        p[pre + 'Toes'] = (round(tg['broad'][3], 3), 0.0, 0.0)
        M = BROAD.mats(p, [pre + 'Foot'])
        err = (M[pre + 'Foot'].translation - tg['broad'][0]).length * 100
        IK_LOG.append((CURRENT[0], tag or ('foot ' + side), err, 0.0))
    return p


# ---------------------------------------------------------------------- hips, hands, chains
def hips_loc(left=0.0, up=0.0, fwd=0.0):
    """A world displacement of the pelvis (character left, up, forward) → the Hips bone's location (its rest frame)."""
    v = BROAD.rest['Hips'].to_3x3().transposed() @ Vector((left, -fwd, up))
    return (round(v.x, 5), round(v.y, 5), round(v.z, 5))


def hips_rot(yaw=0.0, pitch=0.0, roll=0.0):
    """A world orientation of the pelvis — roll about the forward axis (+ leans left), then pitch about X (+ tips
    forward), then yaw about Z (+ turns left), degrees — as the Hips bone's XYZ Euler."""
    rw = Matrix.Rotation(math.radians(yaw), 3, 'Z') @ Matrix.Rotation(math.radians(pitch), 3, 'X') @ \
        Matrix.Rotation(math.radians(roll), 3, 'Y')
    r0 = BROAD.rest['Hips'].to_3x3()
    e = (r0.transposed() @ rw @ r0).to_euler('XYZ')
    return tuple(round(math.degrees(a), 4) for a in e)


FINGERS = ('Index', 'Middle', 'Ring', 'Little')
HANDS = {
    'fist': dict(Index=(72, 95, 55), Middle=(72, 95, 55), Ring=(72, 95, 55), Little=(72, 95, 55), Thumb=(25, 40, 35)),
    'relax': dict(Index=(10, 16, 9), Middle=(15, 21, 12), Ring=(19, 25, 14), Little=(23, 29, 16), Thumb=(8, 12, 8)),
    'curl': dict(Index=(38, 50, 30), Middle=(42, 55, 32), Ring=(46, 58, 34), Little=(50, 60, 35), Thumb=(15, 22, 18)),
    'open': dict(Index=(3, 4, 3), Middle=(3, 4, 3), Ring=(4, 5, 3), Little=(5, 6, 4), Thumb=(-6, 4, 4)),
    'cup': dict(Index=(20, 26, 16), Middle=(22, 28, 18), Ring=(25, 30, 19), Little=(28, 32, 20), Thumb=(6, 12, 10)),
    'hook': dict(Index=(16, 78, 42), Middle=(18, 80, 44), Ring=(22, 82, 46), Little=(52, 90, 50), Thumb=(22, 30, 28)),
    'claw': dict(Index=(28, 52, 42), Middle=(30, 55, 44), Ring=(32, 56, 44), Little=(34, 58, 46), Thumb=(8, 22, 20)),
}
SPREAD = dict(Index=9, Middle=0, Ring=-7, Little=-14)


def hand(side, kind, spread=0.0):
    pre = side_pre(side)
    out = {}
    for fg, (a, b, c) in HANDS[kind].items():
        z = SPREAD.get(fg, 0) * spread
        out[pre + fg + 'Proximal'] = mir(side, (a, 0, z))
        out[pre + fg + 'Intermediate'] = (b, 0, 0)
        out[pre + fg + 'Distal'] = (c, 0, 0)
    return out


def hand_mix(side, a, b, t, spread=0.0):
    pa, pb = hand(side, a), hand(side, b, spread)
    return {k: tuple(x + (y - x) * t for x, y in zip(pa[k], pb[k])) for k in pa}


def tail(p, sway=0.0, lift=0.0, wave=0.0, phase=0.0):
    """Tail_01..04: `lift` raises (+X), `sway` swings to the right (+Z); `wave` adds a travelling swing."""
    for i in range(4):
        k = (0.6, 0.85, 1.05, 1.25)[i]
        w = wave * math.sin(phase - 0.9 * i) if wave else 0.0
        p['Tail_%02d' % (i + 1)] = (round(lift * k, 3), 0.0, round(sway * k + w, 3))
    return p


def mix(a, b, t):
    """Blend two poses (angles and Hips.loc) — used for in-between keys only."""
    out = {}
    for k in set(a) | set(b):
        va = a.get(k, (0.0, 0.0, 0.0))
        vb = b.get(k, (0.0, 0.0, 0.0))
        out[k] = tuple(x + (y - x) * t for x, y in zip(va, vb))
    return out


def P(*parts):
    out = {}
    for x in parts:
        out.update(x)
    return out


# ---------------------------------------------------------------------- the deformed body (floor, contact)
def apply_pose(arm_ob, pose):
    if arm_ob.animation_data:
        arm_ob.animation_data.action = None
    for pb in arm_ob.pose.bones:
        rot = pose.get(pb.name, (0, 0, 0))
        pb.rotation_euler = Euler([math.radians(a) for a in rot], pb.rotation_mode)
        pb.location = pose.get('Hips.loc', (0, 0, 0)) if pb.name == 'Hips' else (0, 0, 0)
    bpy.context.view_layer.update()


def body_coords(body):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get('co', co)
    ev.to_mesh_clear()
    return co.reshape(-1, 3)


def ground(p, clearance=0.0, regions=None, side=None):
    """Moves the hips up or down so the broad body's lowest point (among `regions`, on one `side` if given) rests on
    the floor — lying, kneeling and sitting keys."""
    apply_pose(BROAD.ob, p)
    co = body_coords(BODY['broad'])
    mask = np.ones(len(co), dtype=bool)
    if regions is not None:
        mask &= np.isin(REGIONS['broad'], list(regions))
    if side is not None:
        mask &= (REST_X > 0.01) if side == 'L' else (REST_X < -0.01)
    z = float(co[mask, 2].min())
    loc = Vector(p.get('Hips.loc', (0, 0, 0)))
    loc += BROAD.rest['Hips'].to_3x3().transposed() @ Vector((0, 0, clearance - z))
    p['Hips.loc'] = (round(loc.x, 5), round(loc.y, 5), round(loc.z, 5))
    return p


# ====================================================================== the clips
CLIPS = []
CURRENT = ['']


def clip(name, loop=False, events=None, shots=None, view=None, props=('sword',), loop_start=None, speed=None, string=None):
    def deco(fn):
        CLIPS.append(dict(name=name, fn=fn, loop=loop, events=events or {}, shots=shots, view=view or {}, props=props,
                          loop_start=loop_start, speed=speed, string=string))
        return fn
    return deco


STANCE = {'L': Foot(out=0.03, fwd=0.045, yaw=-7), 'R': Foot(out=0.035, fwd=-0.05, yaw=3)}
IDLE_R_SEED = {'RightUpperArm': (22, -12, 14), 'RightLowerArm': (58, 0, 0), 'RightHand': (0, 0, 10)}
SWORD_IDLE = (W(-0.27, 0.23, 0.96), D(0.10, 0.93, 0.35))


def idle_pose(t, solve_arm=True):
    b = math.sin(2 * math.pi * t / 2.0)
    s = math.sin(2 * math.pi * t / 4.0)
    lk = math.sin(2 * math.pi * t / 4.0 + 1.2)
    p = {}
    p['Hips.loc'] = hips_loc(0.006 * s, -0.026 + 0.004 * b, 0.0)
    p['Hips'] = hips_rot(yaw=-8, roll=0.8 * s)
    p['Spine'] = (3 + 0.5 * b, 3, -0.5 * s)
    p['Chest'] = (2 - 1.0 * b, 3, 0)
    p['UpperChest'] = (-1.2 * b, 1, 0)
    p['Neck'] = (-3 + 0.5 * b, 0, 0)
    p['Head'] = (4 - 0.6 * b, 2 + 4 * lk, 0.4 * s)
    p['LeftShoulder'] = (0, 0, 1.5 * b)
    p['RightShoulder'] = (0, 0, -1.5 * b)
    p['LeftUpperArm'] = (10 + 1.5 * b, 6, -17 - 1.0 * b)
    p['LeftLowerArm'] = (18 + 2 * b, 8, 0)
    p['LeftHand'] = (8, 0, -4)
    p.update(IDLE_R_SEED)
    p.update(hand('L', 'relax'))
    p.update(hand('R', 'fist'))
    tail(p, sway=3 * s, lift=1.5 * b)
    plant(p, {'L': STANCE['L'], 'R': STANCE['R']})
    if solve_arm:
        pos, bl = SWORD_IDLE
        reach(p, 'R', pos=pos + Vector((0, 0, 0.006 * b)), blade=bl, seed=IDLE_R_SEED, tag='sword idle')
    return p


IDLE0 = {}


def loop_keys(times, fn):
    """Keys for a loop: the last key is the first pose itself, so the loop closes exactly."""
    keys = [(t, fn(t)) for t in times[:-1]]
    return keys + [(times[-1], keys[0][1])]


@clip('Idle', loop=True, shots=[0, 0.5, 1.0, 2.0, 3.0], view=dict(az=35))
def c_idle():
    return loop_keys([0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0], idle_pose)


# ---------------------------------------------------------------------- gaits
def foot_offsets(ft):
    a, _, _, _ = foot_target(BROAD, 'L', ft)
    a0 = BROAD.head0['LeftFoot']
    return -(a.y - a0.y), a.z - a0.z


def gait_foot(ph, g, side):
    s = g['stance']
    if ph < s:
        u = ph / s
        fwd = g['front'] - (g['front'] + g['back']) * u
        if u < g['flat_in']:
            v = 1 - u / g['flat_in']
            return Foot(g['out'], fwd, 0, g['yaw'], g['hs'] * v * v, 'heel')
        if u > g['heel_off']:
            v = (u - g['heel_off']) / (1 - g['heel_off'])
            return Foot(g['out'], fwd, 0, g['yaw'], g['to'] * v ** 1.5, 'ball')
        return Foot(g['out'], fwd, 0, g['yaw'], 0.0, 'ankle')
    w = (ph - s) / (1 - s)
    wf = w ** g['fwd_pow']
    e = wf * wf * (3 - 2 * wf)
    ep = w * w * (3 - 2 * w)
    f0, u0 = foot_offsets(Foot(g['out'], -g['back'], 0, g['yaw'], g['to'], 'ball'))
    f1, u1 = foot_offsets(Foot(g['out'], g['front'], 0, g['yaw'], g['hs'], 'heel'))
    fwd = f0 + (f1 - f0) * e
    up = u0 + (u1 - u0) * ep + g['lift'] * math.sin(math.pi * w ** g['lift_pow'])
    pitch = g['to'] + (g['hs'] + g['swing_pitch'] - g['to']) * ep - g['swing_pitch'] * ep * ep
    toes = max(0.0, -g['to']) * max(0.0, 1 - 3 * w)
    return Foot(g['out'], fwd, up, g['yaw'], pitch, 'ankle', toes=toes)


WALK = dict(T=1.0, stance=0.6, front=0.27, back=0.37, lift=0.075, out=-0.024, yaw=-8, hs=16, to=-30, flat_in=0.16,
            heel_off=0.55, fwd_pow=1.0, lift_pow=1.0, swing_pitch=6, h_top=-0.026, bob=0.03, low=0.03)
RUN = dict(T=f(20), stance=0.36, front=0.18, back=0.42, lift=0.26, out=-0.034, yaw=-6, hs=6, to=-40, flat_in=0.2,
           heel_off=0.45, fwd_pow=1.3, lift_pow=0.7, swing_pitch=10, h_top=-0.022, bob=0.04, low=0.18)


def gait_hips(ph, g):
    c = math.cos(4 * math.pi * (ph - g['low']))
    return g['h_top'] - g['bob'] / 2 - g['bob'] / 2 * c


def walk_pose(ph):
    g = WALK
    c, s = math.cos(2 * math.pi * ph), math.sin(2 * math.pi * ph)
    p = {}
    p['Hips.loc'] = hips_loc(0.016 * s, gait_hips(ph, g), 0.0)
    p['Hips'] = hips_rot(yaw=-5 * c, pitch=3, roll=-3 * s)
    p['Spine'] = (4, 3 * c, 1.2 * s)
    p['Chest'] = (2, 3 * c, 0.8 * s)
    p['UpperChest'] = (0, 2 * c, 0)
    p['Neck'] = (-3, -1.5 * c, -1 * s)
    p['Head'] = (3, -1.5 * c, -0.5 * s)
    p['LeftUpperArm'] = (8 - 20 * c, 5, -16)
    p['LeftLowerArm'] = (22 - 8 * c, 8, 0)
    p['LeftHand'] = (6, 0, -4)
    p['RightUpperArm'] = (14 + 13 * c, -8, 15)
    p['RightLowerArm'] = (44 + 6 * c, -4, 0)
    p['RightHand'] = (0, 0, 24)
    p.update(hand('L', 'relax'))
    p.update(hand('R', 'fist'))
    tail(p, sway=0, lift=2, wave=7, phase=2 * math.pi * ph)
    plant(p, {'L': gait_foot(ph, g, 'L'), 'R': gait_foot((ph + 0.5) % 1.0, g, 'R')})
    return p


def run_pose(ph):
    g = RUN
    c, s = math.cos(2 * math.pi * ph), math.sin(2 * math.pi * ph)
    p = {}
    p['Hips.loc'] = hips_loc(0.012 * s, gait_hips(ph, g), 0.0)
    p['Hips'] = hips_rot(yaw=-7 * c, pitch=7, roll=-3 * s)
    p['Spine'] = (8, 5 * c, 1.5 * s)
    p['Chest'] = (5, 5 * c, 1 * s)
    p['UpperChest'] = (2, 3 * c, 0)
    p['Neck'] = (-7, -3 * c, -1 * s)
    p['Head'] = (-6, -3 * c, -0.5 * s)
    p['LeftUpperArm'] = (22 - 42 * c, 10, -12)
    p['LeftLowerArm'] = (86 - 12 * c, 12, 0)
    p['LeftHand'] = (8, 0, -6)
    p['RightUpperArm'] = (20 + 24 * c, -10, 13)
    p['RightLowerArm'] = (52 + 8 * c, -8, 0)
    p['RightHand'] = (0, 0, 16)
    p.update(hand('L', 'curl'))
    p.update(hand('R', 'fist'))
    tail(p, sway=0, lift=6 + 3 * math.cos(4 * math.pi * ph), wave=10, phase=2 * math.pi * ph)
    plant(p, {'L': gait_foot(ph, g, 'L'), 'R': gait_foot((ph + 0.5) % 1.0, g, 'R')})
    return p


@clip('Walk', loop=True, events={'footL': 0.0, 'footR': 0.5}, shots=[0, f(4), f(8), f(11), f(15)], view=dict(az=72, el=6),
      speed=round((WALK['front'] + WALK['back']) / (WALK['stance'] * WALK['T']), 3))
def c_walk():
    return loop_keys([f(n) for n in range(0, 31, 3)], lambda t: walk_pose(t / WALK['T']))


@clip('Run', loop=True, events={'footL': 0.0, 'footR': f(10)}, shots=[0, f(2), f(4), f(7), f(10)], view=dict(az=72, el=6),
      speed=round((RUN['front'] + RUN['back']) / (RUN['stance'] * RUN['T']), 3))
def c_run():
    return loop_keys([f(n) for n in range(0, 21, 2)], lambda t: run_pose(t / RUN['T']))


# ---------------------------------------------------------------------- shared upper-body helpers
NOARMS = {0, 1, 2, 3, 7, 8, 9}    # every body region but the arms and hands (what rests on the floor)
KNEES = {7, 8, 9}


def stance(p, hips=(0.0, -0.026, 0.0), yaw=-8.0, pitch=0.0, roll=0.0, feet=None):
    p['Hips.loc'] = hips_loc(*hips)
    p['Hips'] = hips_rot(yaw=yaw, pitch=pitch, roll=roll)
    plant(p, feet or {'L': STANCE['L'], 'R': STANCE['R']})
    return p


def base(**bones):
    """A pose from IDLE0's fingers, chains and legs (the legs only as a start for the foot solver) plus the given bones."""
    p = {k: v for k, v in IDLE0.items() if any(s in k for s in ('Proximal', 'Intermediate', 'Distal', 'Tail_', 'Toes', 'Leg', 'Foot'))}
    for k, v in bones.items():
        p[k.replace('_loc', '.loc')] = v
    return p


def torso(p, spine=(0, 0, 0), chest=(0, 0, 0), upper=(0, 0, 0), neck=(0, 0, 0), head=(0, 0, 0)):
    p['Spine'], p['Chest'], p['UpperChest'], p['Neck'], p['Head'] = spine, chest, upper, neck, head
    return p


def relaxed_left(p, x=10, y=6, z=-17, elbow=18, wrist=(8, 0, -4), kind='relax'):
    p['LeftUpperArm'] = (x, y, z)
    p['LeftLowerArm'] = (elbow, 8, 0)
    p['LeftHand'] = wrist
    p.update(hand('L', kind))
    return p


def between(a, b, t=0.5, feet=None, regions=None, clearance=0.0, ground_it=False):
    """An in-between key: the two poses blended, then the feet re-planted and/or the body put back on the floor."""
    p = mix(a, b, t)
    if feet:
        plant(p, feet)
    if ground_it:
        ground(p, clearance, regions=regions)
    return p


def mirror_seed(p, src):
    """The other arm's angles mirrored from side `src` — a start for the solver on a symmetric strike."""
    a, b = side_pre(src), side_pre('L' if src == 'R' else 'R')
    return {b + n: (p[a + n][0], -p[a + n][1], -p[a + n][2]) for n in ('UpperArm', 'LowerArm', 'Hand')}


def shoulder(p, side):
    return BROAD.mats(p, [side_pre(side) + 'UpperArm'])[side_pre(side) + 'UpperArm'].translation.copy()


# ---------------------------------------------------------------------- attacks
# The hand socket's +Y leaves the fist at 90 deg to the hand, so a held blade sits 52-114 deg from the forearm (wrist
# deviation 38 deg ulnar / 24 deg radial). Every blade direction below respects that cone; one that did not (round 1)
# left the solver with a compromise that read as a different move.
@clip('Attack_Light', events={'hit': f(8)}, shots=[0, f(3), f(5), f(8), f(11), f(18)], view=dict(az=62, el=18))
def c_attack_light():
    k = [(0, IDLE0)]
    # windup (anticipation): weight back, chest twisted right, blade chambered back over the right shoulder
    p = base()
    torso(p, (2, -6, 0), (0, -10, 0), (-2, -6, 0), (-2, 10, 0), (2, 14, 0))
    stance(p, hips=(-0.01, -0.04, -0.04), yaw=-16, roll=-2)
    relaxed_left(p, x=40, y=15, z=-5, elbow=45, wrist=(10, 0, 0))
    reach(p, 'R', pos=W(-0.30, -0.04, 1.60), blade=D(0.20, -0.90, -0.30), seed={'RightUpperArm': (60, -30, -60), 'RightLowerArm': (110, 0, 0)}, tag='windup')
    k.append((f(3), p))
    # mid-swing: the hand comes over the shoulder, blade up
    p = base()
    torso(p, (5, -2, 0), (3, -2, 0), (0, 0, 0), (0, 4, 0), (0, 6, 0))
    stance(p, hips=(0.0, -0.05, 0.03), yaw=-6)
    relaxed_left(p, x=15, y=5, z=-10, elbow=50)
    reach(p, 'R', pos=W(-0.28, 0.25, 1.52), blade=D(0.10, -0.25, 0.96), seed=k[-1][1], tag='mid')
    k.append((f(5), p))
    # hit: arm extended forward-left, the blade sweeping left and down, weight on the front leg
    p = base()
    torso(p, (8, 6, 0), (6, 8, 0), (2, 6, 0), (0, -8, 0), (2, -10, 0))
    stance(p, hips=(0.0, -0.07, 0.08), yaw=6, roll=2)
    relaxed_left(p, x=-25, y=0, z=-8, elbow=55)
    reach(p, 'R', pos=W(-0.07, 0.66, 1.14), blade=D(0.70, 0.30, -0.65), w_dir=40.0, seed={'RightUpperArm': (80, -60, 0), 'RightLowerArm': (20, -60, 0)}, tag='hit')
    k.append((f(8), p))
    # follow-through: the blade carries on past the left hip
    p = base()
    torso(p, (10, 8, 0), (6, 10, 0), (2, 6, 0), (0, -10, 0), (2, -12, 0))
    stance(p, hips=(0.01, -0.075, 0.09), yaw=12)
    relaxed_left(p, x=-30, y=0, z=-10, elbow=60)
    reach(p, 'R', pos=W(0.16, 0.50, 0.95), blade=D(0.30, -0.50, -0.80), seed=k[-1][1], tag='follow')
    k.append((f(11), p))
    p = base()
    torso(p, (5, 2, 0), (3, 2, 0), (0, 1, 0), (-2, 0, 0), (3, 0, 0))
    stance(p, hips=(0.0, -0.045, 0.03), yaw=-3)
    relaxed_left(p, x=0, y=5, z=-15, elbow=30)
    reach(p, 'R', pos=W(-0.22, 0.30, 1.00), blade=D(0.15, 0.85, 0.50), seed=IDLE_R_SEED, tag='recover')
    k.append((f(14), p))
    k.append((f(18), IDLE0))
    return k


def two_hand(p, pos, blade, seed_r=None, seed_l=None, tag=''):
    reach(p, 'R', pos=pos, blade=blade, seed=seed_r, tag=tag + ' R')
    reach(p, 'L', rel=grip_rel(), skels=(BROAD, SLIGHT), seed=seed_l, tag=tag + ' L grip')
    p.update(hand('L', 'fist'))
    return p


L_GRIP_SEED = {'LeftUpperArm': (40, 40, -20), 'LeftLowerArm': (80, 0, 0), 'LeftHand': (0, 0, 0)}


@clip('Attack_Heavy', events={'hit': f(17)}, shots=[0, f(4), f(10), f(14), f(17), f(21)], view=dict(az=62, el=16))
def c_attack_heavy():
    k = [(0, IDLE0)]
    # both hands on the grip, blade up in front
    p = base()
    torso(p, (4, 2, 0), (2, 2, 0), (0, 0, 0), (-2, 0, 0), (2, 0, 0))
    stance(p, hips=(0, -0.04, 0.0), yaw=-4)
    two_hand(p, W(-0.10, 0.38, 1.08), D(0.08, 0.55, 0.83), seed_r=IDLE_R_SEED, seed_l=L_GRIP_SEED, tag='guard')
    k.append((f(4), p))
    # wind-up: the hands above and behind the head, the blade hanging down the back, weight back, arched
    p = base()
    torso(p, (-4, -4, 0), (-8, -6, 0), (-4, -2, 0), (4, 6, 0), (6, 6, 0))
    stance(p, hips=(0, -0.06, -0.07), yaw=-10, pitch=-2)
    two_hand(p, W(-0.08, -0.10, 1.84), D(0.05, -0.60, -0.80), seed_r={'RightUpperArm': (150, -20, -20), 'RightLowerArm': (100, 0, 0)},
             seed_l={'LeftUpperArm': (150, 30, 20), 'LeftLowerArm': (100, 0, 0)}, tag='windup')
    k.append((f(10), p))
    wind = p
    # the step: left foot in the air, the sword rising over the head
    p = base()
    torso(p, (2, -2, 0), (-2, -4, 0), (-2, -2, 0), (2, 4, 0), (4, 4, 0))
    stance(p, hips=(0, -0.06, 0.02), yaw=-7, feet={'L': Foot(out=0.04, fwd=0.17, up=0.06, yaw=-9, pitch=8), 'R': STANCE['R']})
    two_hand(p, W(-0.10, 0.0, 1.86), D(0.08, -0.45, 0.89), seed_r=wind, seed_l=wind, tag='step')
    k.append((f(12), p))
    FRONT = Foot(out=0.05, fwd=0.28, yaw=-10)
    # foot down, the hands over the forehead
    p = base()
    torso(p, (6, 0, 0), (2, 0, 0), (0, 0, 0), (0, 0, 0), (2, 0, 0))
    stance(p, hips=(0, -0.09, 0.10), yaw=-4, feet={'L': FRONT, 'R': STANCE['R']})
    two_hand(p, W(-0.07, 0.15, 1.82), D(0.03, -0.45, 0.89), seed_r=k[-1][1], seed_l=k[-1][1], tag='over')
    k.append((f(14), p))
    # hit: bent over the front knee, the arms driven down in front, the blade forward and down at the target
    p = base()
    torso(p, (14, 2, 0), (8, 0, 0), (2, 0, 0), (-6, 0, 0), (-6, 0, 0))
    stance(p, hips=(0, -0.13, 0.15), yaw=0, pitch=6, feet={'L': FRONT, 'R': STANCE['R']})
    two_hand(p, W(-0.03, 0.42, 0.95), D(0.0, 0.90, -0.40), seed_r=k[-1][1], seed_l=k[-1][1], tag='hit')
    k.append((f(17), p))
    # follow-through toward the floor
    p = base()
    torso(p, (20, 0, 0), (10, 0, 0), (2, 0, 0), (-8, 0, 0), (-8, 0, 0))
    stance(p, hips=(0, -0.15, 0.16), yaw=0, pitch=8, feet={'L': FRONT, 'R': STANCE['R']})
    two_hand(p, W(-0.03, 0.40, 0.78), D(0.0, 0.75, -0.66), seed_r=k[-1][1], seed_l=k[-1][1], tag='follow')
    k.append((f(21), p))
    follow = p
    p = base()
    torso(p, (16, 0, 0), (8, 0, 0), (2, 0, 0), (-6, 0, 0), (-6, 0, 0))
    stance(p, hips=(0, -0.13, 0.15), yaw=0, pitch=6, feet={'L': FRONT, 'R': STANCE['R']})
    two_hand(p, W(-0.03, 0.41, 0.82), D(0.0, 0.80, -0.60), seed_r=follow, seed_l=follow, tag='settle')
    k.append((f(24), p))
    # recover: release the grip, step back
    p = base()
    torso(p, (6, 1, 0), (3, 1, 0), (0, 0, 0), (-2, 0, 0), (3, 0, 0))
    stance(p, hips=(0, -0.06, 0.06), yaw=-6, feet={'L': Foot(out=0.04, fwd=0.15, up=0.05, yaw=-8, pitch=-5), 'R': STANCE['R']})
    relaxed_left(p, x=20, y=8, z=-12, elbow=40)
    reach(p, 'R', pos=W(-0.20, 0.32, 0.98), blade=D(0.10, 0.90, 0.40), seed=IDLE_R_SEED, tag='recover')
    k.append((f(27), p))
    k.append((f(30), IDLE0))
    return k


@clip('Attack_Dual', events={'hit': f(7), 'hit2': f(14)}, shots=[0, f(3), f(7), f(10), f(14), f(17)], view=dict(az=25, el=16),
      props=('sword', 'dagger'))
def c_attack_dual():
    k = [(0, IDLE0)]
    # windup: right blade cocked at the shoulder, left fist forward
    p = base()
    torso(p, (2, -6, 0), (0, -8, 0), (0, -2, 0), (0, 8, 0), (2, 12, 0))
    stance(p, hips=(0, -0.04, -0.02), yaw=-12)
    reach(p, 'R', pos=W(-0.40, 0.05, 1.38), blade=D(0.10, -0.25, 0.96), seed={'RightUpperArm': (40, -40, -40), 'RightLowerArm': (110, 0, 0)}, tag='windup R')
    reach(p, 'L', pos=W(0.10, 0.30, 1.20), blade=D(-0.2, 0.5, 0.84), seed={'LeftUpperArm': (45, 20, -5), 'LeftLowerArm': (80, 0, 0)}, tag='windup L')
    p.update(hand('L', 'fist'))
    k.append((f(3), p))
    wind = p
    # hit 1: horizontal cut sweeping left; left fist chambered at the hip
    p = base()
    torso(p, (6, 6, 0), (4, 8, 0), (2, 4, 0), (0, -6, 0), (0, -8, 0))
    stance(p, hips=(0, -0.06, 0.06), yaw=6)
    reach(p, 'R', pos=W(-0.02, 0.63, 1.22), blade=D(0.88, 0.45, -0.12), seed=wind, tag='hit1 R')
    reach(p, 'L', pos=W(0.22, -0.02, 1.02), blade=D(0.05, 0.95, 0.30), seed={'LeftUpperArm': (-20, 10, -5), 'LeftLowerArm': (100, 0, 0)}, tag='hit1 L')
    p.update(hand('L', 'fist'))
    k.append((f(7), p))
    hit1 = p
    # the right follows through; the left cocks back at the left shoulder (the windup mirrored)
    p = base()
    torso(p, (6, 0, 0), (4, 0, 0), (0, 0, 0), (0, 0, 0), (2, 0, 0))
    stance(p, hips=(0, -0.06, 0.05), yaw=0)
    reach(p, 'R', pos=W(0.08, 0.42, 1.08), blade=D(0.75, -0.05, -0.65), seed=hit1, tag='trans R')
    reach(p, 'L', pos=W(0.40, 0.05, 1.38), blade=D(-0.10, -0.25, 0.96), seed=mirror_seed(wind, 'R'), tag='trans L')
    p.update(hand('L', 'fist'))
    k.append((f(10), p))
    trans = p
    # hit 2: the off hand sweeps right (hit 1 mirrored); the right hand back low
    p = base()
    torso(p, (6, -6, 0), (4, -8, 0), (2, -4, 0), (0, 6, 0), (0, 8, 0))
    stance(p, hips=(0, -0.06, 0.06), yaw=-8)
    reach(p, 'L', pos=W(0.02, 0.63, 1.22), blade=D(-0.88, 0.45, -0.12), seed=mirror_seed(hit1, 'R'), tag='hit2 L')
    reach(p, 'R', pos=W(-0.32, 0.03, 0.92), blade=D(0.05, 1.0, 0.0), seed={'RightUpperArm': (5, 0, 12), 'RightLowerArm': (10, 0, 0)}, tag='hit2 R')
    p.update(hand('L', 'fist'))
    k.append((f(14), p))
    # follow-through of the off hand (the right follow-through mirrored)
    p = base()
    torso(p, (7, -9, 0), (5, -10, 0), (2, -5, 0), (0, 8, 0), (0, 10, 0))
    stance(p, hips=(0, -0.065, 0.065), yaw=-12)
    reach(p, 'L', pos=W(-0.08, 0.42, 1.08), blade=D(-0.75, -0.05, -0.65), seed=mirror_seed(trans, 'R'), tag='follow L')
    reach(p, 'R', pos=W(-0.32, 0.04, 0.93), blade=D(0.05, 1.0, 0.0), seed=k[-1][1], tag='follow R')
    p.update(hand('L', 'fist'))
    k.append((f(17), p))
    k.append((f(24), IDLE0))
    return k


# ---------------------------------------------------------------------- ranged and magic
BOW_EDGE = D(0, 1, 0)


@clip('Shoot', events={'release': f(15)}, shots=[0, f(6), f(12), f(15), f(17), f(27)], view=dict(az=55, el=14),
      props=('bow',), string=(f(6), f(15)))
def c_shoot():
    """The bow is the main-hand weapon, so it sits in the right fist (Socket_HandR, like every main weapon) and the
    left hand draws: side-on with the right shoulder to the target, the string to the left jaw."""
    k = [(0, IDLE0)]
    p = base()
    torso(p, (2, 10, 0), (0, 12, 0), (0, 6, 0), (0, -20, 0), (0, -24, 0))
    stance(p, hips=(0, -0.035, 0.0), yaw=18)
    reach(p, 'R', pos=W(-0.20, 0.42, 1.30), blade=D(-0.15, 0.10, 0.98), edge=BOW_EDGE, seed={'RightUpperArm': (80, -10, 0), 'RightLowerArm': (20, 0, 0)}, tag='raise R')
    reach(p, 'L', pos=W(-0.06, 0.40, 1.32), edge=BOW_EDGE, seed={'LeftUpperArm': (70, 40, -10), 'LeftLowerArm': (90, 0, 0)}, tag='nock L')
    p.update(hand('L', 'hook'))
    k.append((f(6), p))
    draw = base()
    torso(draw, (0, 14, 1), (-2, 16, 0), (-2, 10, 0), (2, -30, 0), (0, -34, 2))
    stance(draw, hips=(0, -0.04, 0.0), yaw=28)
    reach(draw, 'R', pos=W(-0.10, 0.66, 1.40), blade=D(-0.12, 0.0, 0.99), edge=BOW_EDGE, seed={'RightUpperArm': (88, -10, 0), 'RightLowerArm': (5, 0, 0)}, tag='draw R')
    reach(draw, 'L', rel=head_rel((0.045, -0.03, 0.115), edge=BOW_EDGE), skels=(BROAD, SLIGHT),
          seed={'LeftUpperArm': (20, 60, 60), 'LeftLowerArm': (130, 0, 0)}, tag='anchor L')
    draw.update(hand('L', 'hook'))
    k.append((f(12), draw))
    p = dict(draw)
    p['Chest'] = (-2.5, 16, 0)
    k.append((f(15), p))
    # follow-through: the draw hand flies back past the ear, fingers open
    p = base()
    torso(p, (0, 14, 1), (-2.5, 16, 0), (-2, 10, 0), (2, -30, 0), (0, -34, 2))
    stance(p, hips=(0, -0.04, 0.0), yaw=28)
    reach(p, 'R', pos=W(-0.10, 0.68, 1.37), blade=D(-0.10, 0.0, 0.99), edge=BOW_EDGE, seed=draw, tag='follow R')
    reach(p, 'L', rel=head_rel((0.17, 0.02, -0.07)), skels=(BROAD, SLIGHT), seed=draw, tag='follow L')
    p.update(hand('L', 'open', spread=0.6))
    k.append((f(17), p))
    p2 = dict(p)
    p2['LeftLowerArm'] = (p['LeftLowerArm'][0] - 4, p['LeftLowerArm'][1], 0)
    k.append((f(20), p2))
    k.append((f(27), IDLE0))
    return k


@clip('Cast', events={'charge': f(12), 'release': f(24)}, shots=[0, f(5), f(12), f(21), f(24), f(28)], view=dict(az=40, el=14))
def c_cast():
    k = [(0, IDLE0)]
    p = base()
    torso(p, (1, 0, 0), (-4, 0, 0), (-3, 0, 0), (-2, 0, 0), (-6, 0, 0))
    stance(p, hips=(0, -0.02, -0.02), yaw=-6)
    p['LeftUpperArm'] = (25, -10, 45)
    p['LeftLowerArm'] = (40, 0, 0)
    p['LeftHand'] = (-10, 0, 0)
    p.update(hand('L', 'open', spread=0.5))
    reach(p, 'R', pos=W(-0.50, 0.15, 1.25), blade=D(0.10, 0.30, 0.95), seed={'RightUpperArm': (30, 0, -40), 'RightLowerArm': (50, 0, 0)}, tag='out R')
    k.append((f(5), p))

    def gather(dz=0.0, dback=0.0, chest=0.0):
        g = base()
        torso(g, (10, -4, 0), (6 + chest, -4, 0), (2, 0, 0), (6, 4, 0), (8, 4, 0))
        stance(g, hips=(0, -0.07, -0.04), yaw=-6)
        reach(g, 'L', pos=W(0.15, 0.42 - dback, 1.10 + dz), blade=D(1, 0, 0), edge=D(0, 1, 0),
              seed={'LeftUpperArm': (50, 30, 10), 'LeftLowerArm': (80, -30, 0)}, tag='gather L')
        g.update(hand('L', 'cup'))
        reach(g, 'R', pos=W(-0.17, 0.36 - dback, 1.12 + dz), blade=D(0.05, 0.25, 0.97), seed={'RightUpperArm': (50, -30, 0), 'RightLowerArm': (90, 0, 0)}, tag='gather R')
        return g
    k.append((f(12), gather()))
    k.append((f(17), gather(dz=0.01, chest=1)))
    k.append((f(21), gather(dz=0.0, dback=0.04, chest=2)))
    p = base()
    torso(p, (4, 2, 0), (0, 2, 0), (-2, 0, 0), (0, -2, 0), (-2, -2, 0))
    stance(p, hips=(0, -0.06, 0.08), yaw=4)
    reach(p, 'L', pos=W(0.10, 0.62, 1.32), blade=D(-1, 0, 0), edge=D(0, 0, 1), seed={'LeftUpperArm': (85, 20, 0), 'LeftLowerArm': (15, 0, 0), 'LeftHand': (-60, 0, 0)}, tag='release L')
    p.update(hand('L', 'open', spread=1.0))
    reach(p, 'R', pos=W(-0.16, 0.55, 1.25), blade=D(0.10, 0.75, 0.65), seed={'RightUpperArm': (70, -10, 5), 'RightLowerArm': (40, 0, 0)}, tag='release R')
    k.append((f(24), p))
    rel = p
    p = base()
    torso(p, (5, 2, 0), (0, 2, 0), (-2, 0, 0), (0, -2, 0), (-2, -2, 0))
    stance(p, hips=(0, -0.065, 0.10), yaw=4)
    reach(p, 'L', pos=W(0.10, 0.66, 1.33), blade=D(-1, 0, 0), edge=D(0, 0, 1), seed=rel, tag='follow L')
    p.update(hand('L', 'open', spread=1.3))
    reach(p, 'R', pos=W(-0.16, 0.58, 1.26), blade=D(0.10, 0.75, 0.65), seed=rel, tag='follow R')
    k.append((f(28), p))
    k.append((f(36), IDLE0))
    return k


# ---------------------------------------------------------------------- defence and reactions
def mix_foot(a, b, t):
    return Foot(*(x + (y - x) * t for x, y in zip((a.out, a.fwd, a.up, a.yaw, a.pitch), (b.out, b.fwd, b.up, b.yaw, b.pitch))), pivot='ankle')


@clip('Guard', events={'brace': f(4)}, shots=[0, f(2), f(4), f(7), f(21), f(25)], view=dict(az=40, el=14))
def c_guard():
    """A braced block: the off forearm forward like a shield, the sword up in a high guard by the head, point at the foe."""
    k = [(0, IDLE0)]
    FRONT = Foot(out=0.06, fwd=0.18, yaw=-4)
    BACK = Foot(out=0.06, fwd=-0.08, yaw=12)

    def brace(drop, chest=0.0):
        p = base()
        torso(p, (8, -4, 0), (6 + chest, -4, 0), (2, 0, 0), (2, 10, 0), (4, 10, 0))
        stance(p, hips=(0, -drop, 0.02), yaw=-14, feet={'L': FRONT, 'R': BACK})
        reach(p, 'L', pos=W(0.08, 0.45, 1.32), edge=D(-0.30, 0.20, 0.93), seed={'LeftUpperArm': (60, 50, 0), 'LeftLowerArm': (100, 0, 0)}, tag='guard L')
        p.update(hand('L', 'fist'))
        reach(p, 'R', pos=W(-0.26, 0.12, 1.55), blade=D(0.10, 1.0, 0.05), seed={'RightUpperArm': (70, 0, -50), 'RightLowerArm': (110, 0, 0)}, tag='guard R')
        return p
    b1 = brace(0.11)
    mid = mix(IDLE0, b1, 0.5)
    plant(mid, {'L': Foot(out=0.045, fwd=0.11, up=0.045, yaw=-5, pitch=5), 'R': mix_foot(STANCE['R'], BACK, 0.5)})
    k.append((f(2), mid))
    k.append((f(4), b1))
    b2 = brace(0.09)
    k.append((f(7), b2))
    k.append((f(21), brace(0.095, chest=-1)))
    back = mix(b2, IDLE0, 0.5)
    plant(back, {'L': Foot(out=0.045, fwd=0.10, up=0.045, yaw=-5, pitch=-3), 'R': mix_foot(BACK, STANCE['R'], 0.5)})
    k.append((f(25), back))
    k.append((f(30), IDLE0))
    return k


@clip('Hit', shots=[0, f(2), f(5), f(9), f(15)], view=dict(az=35, el=12))
def c_hit():
    k = [(0, IDLE0)]
    p = base()
    torso(p, (-8, 4, 3), (-10, 6, 0), (-5, 2, 0), (-8, 6, 4), (-12, 10, 4))
    stance(p, hips=(0, -0.05, -0.07), yaw=-4, pitch=-3)
    relaxed_left(p, x=35, y=0, z=10, elbow=50, kind='open')
    p.update(hand('L', 'open', spread=0.8))
    reach(p, 'R', pos=W(-0.36, 0.22, 1.20), blade=D(0.20, 0.60, 0.77), seed=IDLE_R_SEED, tag='snap R')
    tail(p, lift=8, sway=6)
    k.append((f(2), p))
    p = base()
    torso(p, (-6, 3, 2), (-6, 4, 0), (-3, 1, 0), (-4, 4, 2), (-6, 6, 2))
    stance(p, hips=(0, -0.06, -0.06), yaw=-5, pitch=-2)
    relaxed_left(p, x=28, y=0, z=4, elbow=45, kind='open')
    reach(p, 'R', pos=W(-0.34, 0.24, 1.12), blade=D(0.18, 0.70, 0.69), seed=k[-1][1], tag='recoil R')
    tail(p, lift=4, sway=-4)
    k.append((f(5), p))
    p = base()
    torso(p, (6, 2, 0), (4, 2, 0), (0, 1, 0), (-1, 0, 0), (6, 2, 0))
    stance(p, hips=(0, -0.04, 0.0), yaw=-7)
    relaxed_left(p, x=8, y=5, z=-14, elbow=24)
    reach(p, 'R', pos=W(-0.28, 0.24, 0.98), blade=D(0.10, 0.90, 0.40), seed=IDLE_R_SEED, tag='over R')
    k.append((f(9), p))
    k.append((f(15), IDLE0))
    return k


@clip('Dodge', shots=[0, f(2), f(4), f(6), f(12), f(15)], view=dict(az=12, el=16))
def c_dodge():
    k = [(0, IDLE0)]
    p = base()
    torso(p, (6, 0, 0), (3, 0, 0), (0, 0, 0), (-2, 0, 0), (2, 0, 0))
    stance(p, hips=(-0.03, -0.07, 0.0), yaw=-8, roll=-3)
    relaxed_left(p, x=12, y=5, z=-12, elbow=30)
    reach(p, 'R', pos=W(-0.25, 0.25, 0.94), blade=D(0.10, 0.90, 0.40), seed=IDLE_R_SEED, tag='load R')
    k.append((f(2), p))
    p = base()
    torso(p, (10, 0, -4), (5, 0, -3), (0, 0, 0), (-4, 0, 2), (-4, 0, 2))
    stance(p, hips=(0.14, -0.09, 0.0), yaw=-8, roll=7, feet={'L': Foot(out=0.21, fwd=0.03, up=0.07, yaw=-5), 'R': STANCE['R']})
    relaxed_left(p, x=15, y=0, z=25, elbow=35)
    reach(p, 'R', pos=W(-0.10, 0.32, 0.98), blade=D(0.15, 0.90, 0.40), seed=k[-1][1], tag='push R')
    tail(p, sway=-12)
    k.append((f(4), p))

    def extreme(dx, dz):
        q = base()
        torso(q, (16, 0, -5), (9, 0, -3), (0, 0, 0), (-7, 0, 3), (-9, 0, 3))
        stance(q, hips=(dx, dz, 0.0), yaw=-6, roll=8, feet={'L': Foot(out=0.38, fwd=0.03, yaw=-2), 'R': STANCE['R']})
        relaxed_left(q, x=20, y=0, z=40, elbow=40)
        reach(q, 'R', pos=W(dx - 0.30, 0.34, 1.0 + dz + 0.04), blade=D(0.15, 0.90, 0.40), seed=k[-1][1], tag='dodge R')
        tail(q, sway=-18)
        return q
    k.append((f(6), extreme(0.31, -0.15)))
    k.append((f(9), extreme(0.33, -0.16)))
    p = base()
    torso(p, (8, 0, -2), (4, 0, -1), (0, 0, 0), (-3, 0, 1), (-2, 0, 1))
    stance(p, hips=(0.16, -0.09, 0.0), yaw=-7, roll=3, feet={'L': Foot(out=0.21, fwd=0.04, up=0.06, yaw=-5), 'R': STANCE['R']})
    relaxed_left(p, x=14, y=3, z=10, elbow=30)
    reach(p, 'R', pos=W(-0.15, 0.30, 0.98), blade=D(0.12, 0.90, 0.40), seed=k[-1][1], tag='return R')
    tail(p, sway=8)
    k.append((f(12), p))
    p = base()
    torso(p, (4, 2, 0), (2, 2, 0), (0, 1, 0), (-3, 0, 0), (3, 0, 0))
    stance(p, hips=(0.01, -0.04, 0.0), yaw=-8)
    relaxed_left(p, x=10, y=6, z=-16, elbow=20)
    reach(p, 'R', pos=W(-0.26, 0.24, 0.96), blade=D(0.10, 0.92, 0.36), seed=IDLE_R_SEED, tag='land R')
    k.append((f(15), p))
    k.append((f(18), IDLE0))
    return k


# ---------------------------------------------------------------------- down and up
def kneel_legs(p, fwd_knee=0.0, foot_point=-55, splay=4):
    """Both knees on the floor, shins flat behind, feet pointed. `fwd_knee` flexes the thighs forward: give it the
    pelvis' forward tip so the thighs stay upright over the knees (a negative value swings them back)."""
    for side in ('L', 'R'):
        pre = side_pre(side)
        p[pre + 'UpperLeg'] = mir(side, (fwd_knee, 0, splay))
        p[pre + 'LowerLeg'] = (-92, 0, 0)
        p[pre + 'Foot'] = (foot_point, 0, 0)
        p[pre + 'Toes'] = (0, 0, 0)
    return p


def sword_on_floor(p, side_out, fwd, blade, tag):
    """The sword hand flat on the floor beside the right shoulder: the blade lying flat (its edges horizontal)."""
    sh = shoulder(p, 'R')
    tgt = Vector((sh.x - side_out, sh.y - fwd, 0.045))
    bl = blade.normalized()
    edge = Vector((0, 0, 1)).cross(bl).normalized()
    reach(p, 'R', pos=tgt, blade=bl, edge=edge, w_edge=14.0, seed={'RightUpperArm': (60, 40, -60), 'RightLowerArm': (30, 0, 0)}, tag=tag)
    return p


DOWNED_END = {}
PALMS = {}


def palms(q, at, tag):
    """Both hands planted on the floor at the points in `at`: the left palm flat, fingers forward; the right fist on
    its knuckles, the blade lying forward along the floor (9 cm up, so the cross-guard clears the floor)."""
    if 'L' in at:
        reach(q, 'L', pos=at['L'] + Vector((0, 0, 0.035)), blade=D(-1, 0, 0), edge=D(0, 1, -0.15),
              seed={'LeftUpperArm': (100, -40, 60), 'LeftLowerArm': (110, 0, 0)}, tag=tag + ' L')
        q.update(hand('L', 'open', spread=0.4))
    if 'R' in at:
        reach(q, 'R', pos=at['R'] + Vector((0, 0, 0.09)), blade=D(0.25, 1, 0), edge=D(0, 0, -1),
              seed={'RightUpperArm': (100, 40, -60), 'RightLowerArm': (110, 0, 0)}, tag=tag + ' R')
    return q


@clip('Downed', events={'down': f(24)}, shots=[0, f(3), f(9), f(13), f(18), f(24), f(39)], view=dict(az=60, el=24))
def c_downed():
    k = [(0, IDLE0)]
    p = base()
    torso(p, (4, 2, 2), (-4, 4, 0), (-2, 0, 0), (-4, 4, 2), (-6, 6, 2))
    stance(p, hips=(0, -0.08, -0.03), yaw=-6, pitch=-2)
    relaxed_left(p, x=20, y=0, z=0, elbow=35, kind='open')
    reach(p, 'R', pos=W(-0.32, 0.20, 1.05), blade=D(0.15, 0.80, 0.55), seed=IDLE_R_SEED, tag='stagger R')
    k.append((f(3), p))
    # buckling: knees forward and down, heels up, torso slumping, arms limp
    p = base()
    torso(p, (15, 0, 0), (10, 0, 0), (2, 0, 0), (8, 0, 0), (12, 4, 0))
    stance(p, hips=(0, -0.30, 0.06), yaw=-4, pitch=4, feet={'L': STANCE['L'].moved(pitch=-28, pivot='ball'), 'R': STANCE['R'].moved(pitch=-28, pivot='ball')})
    relaxed_left(p, x=8, y=0, z=-12, elbow=15)
    reach(p, 'R', pos=W(-0.30, 0.18, 0.62), blade=D(0.10, 0.95, 0.10), seed={'RightUpperArm': (10, 0, 12), 'RightLowerArm': (15, 0, 0)}, tag='buckle R')
    k.append((f(9), p))
    # on the knees
    p = base()
    torso(p, (14, 0, 0), (10, 0, 0), (2, 0, 0), (10, 0, 0), (14, 6, 0))
    p['Hips.loc'] = hips_loc(0, -0.45, 0.16)
    p['Hips'] = hips_rot(yaw=-4, pitch=4)
    kneel_legs(p, fwd_knee=4)
    relaxed_left(p, x=6, y=0, z=-14, elbow=15)
    p['RightUpperArm'] = (10, 0, 12)
    p['RightLowerArm'] = (25, 0, 0)
    p['RightHand'] = (0, 0, 10)
    ground(p, regions=KNEES)
    k.append((f(13), p))
    # toppling forward over the knees, arms reaching to break the fall
    p = base()
    torso(p, (10, 0, 0), (6, 0, 0), (0, 0, 0), (-10, 0, 0), (-10, 10, 0))
    p['Hips.loc'] = hips_loc(0, -0.50, 0.26)
    p['Hips'] = hips_rot(yaw=-3, pitch=42)
    kneel_legs(p, fwd_knee=38, foot_point=-50)
    p['LeftUpperArm'] = (75, 10, 15)
    p['LeftLowerArm'] = (25, 0, 0)
    p['LeftHand'] = (-30, 0, 0)
    p['RightUpperArm'] = (70, -10, -15)
    p['RightLowerArm'] = (30, 0, 0)
    p['RightHand'] = (-10, 0, 10)
    p.update(hand('L', 'open', spread=0.6))
    ground(p, regions=KNEES)
    k.append((f(18), p))
    topple = p

    def prone(head_turn=34, lift=0.0, arm=0.0):
        q = base()
        torso(q, (-4, 0, 0), (-4, 0, 0), (-2, 0, 0), (-18, head_turn * 0.45, 0), (-8, head_turn * 0.55, 0))
        q['Hips.loc'] = hips_loc(0, -0.70, 0.40)
        q['Hips'] = hips_rot(yaw=-2, pitch=88)
        q['LeftUpperLeg'] = (-6, -10, 8)
        q['LeftLowerLeg'] = (-14, 0, 0)
        q['LeftFoot'] = (-50, 0, 0)
        q['RightUpperLeg'] = (-2, 8, -5)
        q['RightLowerLeg'] = (-6, 0, 0)
        q['RightFoot'] = (-52, 0, 0)
        q['LeftToes'] = q['RightToes'] = (0, 0, 0)
        q['RightUpperArm'] = (140 + arm, -10, -35)
        q['RightLowerArm'] = (30, 0, 0)
        q['RightHand'] = (-10, 0, 10)
        q['LeftUpperArm'] = (-8, 10, 2)
        q['LeftLowerArm'] = (25, 20, 0)
        q['LeftHand'] = (10, 0, 0)
        q.update(hand('L', 'relax'))
        tail(q, lift=-25)
        ground(q, clearance=lift, regions=NOARMS)
        palms(q, PALMS, 'prone')
        return q
    down = prone(arm=-10)
    catch = between(topple, down, 0.55, ground_it=True, regions=NOARMS)
    PALMS.clear()
    for side in ('L', 'R'):
        sh = shoulder(catch, side)
        s = 1 if side == 'L' else -1
        PALMS[side] = Vector((sh.x + s * 0.09, sh.y - 0.20, 0.0))
    palms(catch, PALMS, 'catch')
    k.append((f(21), catch))
    down = prone(arm=-10)
    k.append((f(24), down))
    k.append((f(27), prone(lift=0.02, arm=-14)))
    end = prone(head_turn=38)
    k.append((f(39), end))
    DOWNED_END.clear()
    DOWNED_END.update(end)
    return k


@clip('Revive', events={'up': f(42)}, shots=[0, f(9), f(17), f(26), f(36), f(42), f(50)], view=dict(az=60, el=20))
def c_revive():
    k = [(0, DOWNED_END)]
    # hands under the shoulders, head up
    p = dict(DOWNED_END)
    torso(p, (-6, 0, 0), (-6, 0, 0), (-3, 0, 0), (-28, 10, 0), (-16, 8, 0))
    palms(p, PALMS, 'plant')
    k.append((f(9), p))
    # push up onto hands and knees: knees on the floor, arms straight to the floor
    p = base()
    torso(p, (-4, 0, 0), (-2, 0, 0), (0, 0, 0), (-25, 0, 0), (-15, 0, 0))
    p['Hips.loc'] = hips_loc(0, -0.42, 0.28)
    p['Hips'] = hips_rot(pitch=72)
    kneel_legs(p, fwd_knee=70, foot_point=-50)
    p['LeftUpperArm'] = (80, -20, 10)
    p['RightUpperArm'] = (80, 20, -10)
    ground(p, regions=KNEES)
    shl, shr = shoulder(p, 'L'), shoulder(p, 'R')
    reach(p, 'L', pos=Vector((shl.x + 0.06, shl.y - 0.04, 0.035)), blade=D(-1, 0, 0), edge=D(0, 1, 0),
          seed={'LeftUpperArm': (80, -20, 10), 'LeftLowerArm': (10, 0, 0), 'LeftHand': (-70, 0, 0)}, tag='push L')
    p.update(hand('L', 'open'))
    reach(p, 'R', pos=Vector((shr.x - 0.06, shr.y - 0.04, 0.09)), blade=D(0.3, 1, 0), edge=D(0, 0, -1),
          seed={'RightUpperArm': (80, 20, -10), 'RightLowerArm': (10, 0, 0)}, tag='push R')
    k.append((f(17), p))
    allfours = p
    # kneel up: right knee down, left foot planted in front, left hand on the knee, the sword hanging point-forward
    p = base()
    torso(p, (8, 0, 0), (4, 0, 0), (0, 0, 0), (-4, 0, 0), (0, 0, 0))
    p['Hips.loc'] = hips_loc(0, -0.46, 0.06)
    p['Hips'] = hips_rot(yaw=-6, pitch=4)
    kneel_legs(p, fwd_knee=2, foot_point=-35)
    plant(p, {'L': Foot(out=0.04, fwd=0.34, yaw=-8)}, tag='kneel L')
    ground(p, regions={8, 9}, side='R')
    plant(p, {'L': Foot(out=0.04, fwd=0.34, yaw=-8)}, tag='kneel L2')
    knee = BROAD.mats(p, ['LeftLowerLeg'])['LeftLowerLeg'].translation
    reach(p, 'L', pos=knee + Vector((0.02, -0.04, 0.06)), edge=D(0, 0.3, -1), seed={'LeftUpperArm': (40, 10, -10), 'LeftLowerArm': (30, 0, 0)}, tag='knee L')
    p.update(hand('L', 'cup'))
    reach(p, 'R', pos=W(-0.30, 0.10, 0.34), blade=D(0.05, 1.0, -0.10), seed={'RightUpperArm': (10, 0, 10), 'RightLowerArm': (10, 0, 0)}, tag='kneel R')
    kneel = p
    mid = mix(allfours, kneel, 0.5)
    plant(mid, {'L': Foot(out=0.06, fwd=0.12, up=0.12, yaw=-8, pitch=-25)}, tag='knee up L')
    ground(mid, regions={8, 9}, side='R')
    plant(mid, {'L': Foot(out=0.06, fwd=0.12, up=0.12, yaw=-8, pitch=-25)}, tag='knee up L2')
    k.append((f(21), mid))
    k.append((f(26), kneel))
    # rising off the front leg
    p = base()
    torso(p, (18, 0, 0), (8, 0, 0), (0, 0, 0), (-8, 0, 0), (-4, 0, 0))
    stance(p, hips=(0, -0.22, 0.12), yaw=-6, pitch=8, feet={'L': Foot(out=0.04, fwd=0.34, yaw=-8), 'R': Foot(out=0.035, fwd=-0.05, yaw=3, pitch=-35, pivot='ball')})
    relaxed_left(p, x=30, y=10, z=-10, elbow=40)
    reach(p, 'R', pos=W(-0.30, 0.25, 0.75), blade=D(0.10, 0.95, 0.10), seed=IDLE_R_SEED, tag='rise R')
    k.append((f(36), p))
    p = base()
    torso(p, (6, 2, 0), (3, 2, 0), (0, 1, 0), (-3, 0, 0), (3, 0, 0))
    stance(p, hips=(0, -0.05, 0.08), yaw=-6, feet={'L': Foot(out=0.035, fwd=0.20, yaw=-8), 'R': STANCE['R']})
    relaxed_left(p, x=12, y=5, z=-15, elbow=25)
    reach(p, 'R', pos=W(-0.27, 0.25, 0.95), blade=D(0.10, 0.92, 0.35), seed=IDLE_R_SEED, tag='up R')
    k.append((f(42), p))
    up = p
    mid = mix(up, IDLE0, 0.5)
    plant(mid, {'L': Foot(out=0.032, fwd=0.12, up=0.04, yaw=-7), 'R': STANCE['R']})
    k.append((f(46), mid))
    k.append((f(50), IDLE0))
    return k


@clip('Victory', shots=[0, f(7), f(15), f(22), f(42), f(60)], view=dict(az=30, el=12))
def c_victory():
    k = [(0, IDLE0)]
    p = base()
    torso(p, (10, -4, 0), (6, 0, 0), (0, 0, 0), (4, 0, 0), (10, 0, 0))
    stance(p, hips=(0, -0.07, -0.01), yaw=-8)
    relaxed_left(p, x=5, y=0, z=-10, elbow=60, kind='fist')
    reach(p, 'R', pos=W(-0.33, 0.12, 0.92), blade=D(0.10, 0.95, 0.10), seed=IDLE_R_SEED, tag='dip R')
    k.append((f(7), p))

    def triumph(dz=0.0):
        q = base()
        torso(q, (-6, 4, 0), (-8, 4, 0), (-4, 0, 0), (-8, -4, 0), (-14, -4, 0))
        stance(q, hips=(0, 0.0 + dz, 0.0), yaw=-6)
        reach(q, 'R', pos=W(-0.24, 0.06, 1.86 + dz), blade=D(0.08, 0.15, 0.98), seed={'RightUpperArm': (160, -10, -20), 'RightLowerArm': (20, 0, 0)}, tag='raise R')
        q['LeftUpperArm'] = (30, -10, 55)
        q['LeftLowerArm'] = (115, 0, 0)
        q['LeftHand'] = (-10, 0, 0)
        q.update(hand('L', 'fist'))
        tail(q, lift=12)
        return q
    k.append((f(15), triumph()))
    k.append((f(22), triumph(-0.015)))
    k.append((f(30), triumph(-0.005)))

    def proud(chest=-4.0):
        """The blade resting back on the right shoulder, the left fist on the hip, chin up."""
        q = base()
        torso(q, (0, 2, 0), (chest, 2, 0), (-2, 0, 0), (-4, 0, 0), (-6, 0, 0))
        stance(q, hips=(0, -0.012, 0.0), yaw=-6, feet={'L': Foot(out=0.07, fwd=0.03, yaw=-4), 'R': Foot(out=0.07, fwd=-0.02, yaw=8)})
        reach(q, 'R', pos=W(-0.24, 0.20, 1.45), blade=D(-0.10, -0.85, 0.50), seed={'RightUpperArm': (60, -20, -10), 'RightLowerArm': (120, 0, 0)}, tag='shoulder R')
        reach(q, 'L', pos=W(0.25, -0.01, 0.99), edge=D(-0.4, 0, -1), seed={'LeftUpperArm': (-15, -20, 45), 'LeftLowerArm': (100, 0, 0), 'LeftHand': (0, 0, 0)}, tag='hip L')
        q.update(hand('L', 'fist'))
        tail(q, lift=6)
        return q
    k.append((f(42), proud()))
    k.append((f(60), proud(-5)))
    return k


@clip('Defeat', events={'down': f(32)}, shots=[0, f(6), f(14), f(23), f(32), f(54)], view=dict(az=60, el=24))
def c_defeat():
    k = [(0, IDLE0)]
    p = base()
    torso(p, (-8, 0, 0), (-8, 0, 0), (-4, 0, 0), (-6, 0, 0), (-12, 0, 0))
    stance(p, hips=(0, -0.05, -0.08), yaw=-8, pitch=-4)
    relaxed_left(p, x=30, y=0, z=30, elbow=30, kind='open')
    reach(p, 'R', pos=W(-0.45, 0.10, 1.15), blade=D(0.10, 0.60, 0.79), seed={'RightUpperArm': (30, 0, -30), 'RightLowerArm': (40, 0, 0)}, tag='stagger R')
    k.append((f(6), p))
    # sagging, sitting down backward
    p = base()
    torso(p, (16, 0, 0), (10, 0, 0), (2, 0, 0), (6, 0, 0), (10, 0, 0))
    stance(p, hips=(0, -0.36, -0.16), yaw=-6, pitch=-8)
    relaxed_left(p, x=-20, y=0, z=25, elbow=20, kind='open')
    p['RightUpperArm'] = (-15, 0, -20)
    p['RightLowerArm'] = (20, 0, 0)
    p['RightHand'] = (0, 0, 15)
    k.append((f(14), p))
    sag = p
    # sat on the floor
    p = base()
    torso(p, (8, 0, 0), (4, 0, 0), (0, 0, 0), (0, 0, 0), (4, 0, 0))
    SIT_FEET = {'L': STANCE['L'].moved(fwd=0.10), 'R': STANCE['R'].moved(fwd=0.12)}
    p['Hips.loc'] = hips_loc(0, -0.72, -0.30)
    p['Hips'] = hips_rot(yaw=-6, pitch=-22)
    plant(p, SIT_FEET, tag='sit')
    relaxed_left(p, x=-30, y=0, z=30, elbow=15, kind='open')
    p['RightUpperArm'] = (-25, 0, -30)
    p['RightLowerArm'] = (15, 0, 0)
    tail(p, lift=85)
    ground(p, regions={2, 3, 7})
    plant(p, SIT_FEET, tag='sit2')
    sat = p
    k.append((f(18), between(sag, sat, 0.5, feet=SIT_FEET)))
    k.append((f(23), sat))

    def supine(bounce=0.0, head=-36):
        q = base()
        torso(q, (-2, 0, 0), (0, 0, 0), (0, 0, 0), (6, head * 0.45, 0), (6, head * 0.55, 0))
        q['Hips.loc'] = hips_loc(0, -0.76, -0.42)
        q['Hips'] = hips_rot(yaw=-8, pitch=-84, roll=-4)
        q['LeftUpperLeg'] = (38, 0, 6)
        q['LeftLowerLeg'] = (-72, 0, 0)
        q['LeftFoot'] = (14, 0, 0)
        q['RightUpperLeg'] = (6, -6, -8)
        q['RightLowerLeg'] = (-10, 0, 0)
        q['RightFoot'] = (-20, 0, 0)
        q['LeftToes'] = q['RightToes'] = (0, 0, 0)
        q['LeftUpperArm'] = (-8, 0, 62 + bounce * 200)
        q['LeftLowerArm'] = (20, 0, 0)
        q['LeftHand'] = (0, 0, 0)
        q['RightUpperArm'] = (-8, 0, -55 - bounce * 200)
        q['RightLowerArm'] = (25, 0, 0)
        q['RightHand'] = (0, 0, 10)
        q.update(hand('L', 'relax'))
        tail(q, lift=115)
        ground(q, clearance=bounce, regions=NOARMS)
        sh = shoulder(q, 'R')
        tgt = Vector((sh.x - 0.48, sh.y + 0.05, 0.045 + bounce))
        bl = D(0.0, 1.0, 0.0)
        reach(q, 'R', pos=tgt, blade=bl, edge=Vector((0, 0, 1)).cross(bl).normalized(), w_edge=14.0,
              seed={'RightUpperArm': (-8, 0, -60), 'RightLowerArm': (20, 0, 0)}, tag='supine R')
        return q
    down = supine()
    k.append((f(28), between(sat, down, 0.5, ground_it=True, regions=NOARMS)))
    k.append((f(32), down))
    k.append((f(36), supine(bounce=0.02, head=-30)))
    k.append((f(54), supine(head=-40)))
    return k


@clip('Interact', events={'grab': f(14)}, shots=[0, f(8), f(14), f(22), f(29), f(36)], view=dict(az=55, el=16))
def c_interact():
    k = [(0, IDLE0)]

    def reach_down(z, kind):
        q = base()
        torso(q, (28, 4, 0), (16, 4, 0), (6, 0, 0), (2, 0, 0), (10, -4, 0))
        stance(q, hips=(0, -0.38, -0.12), yaw=-6, pitch=22)
        reach(q, 'L', pos=W(0.14, 0.40, z), edge=D(0, 0.40, -0.92), seed={'LeftUpperArm': (60, 10, -10), 'LeftLowerArm': (15, 0, 0)}, tag='reach L')
        q.update(hand('L', kind, spread=0.4 if kind == 'open' else 0.0))
        reach(q, 'R', pos=W(-0.34, 0.12, 0.62), blade=D(0.10, 0.95, 0.20), seed={'RightUpperArm': (20, -5, 10), 'RightLowerArm': (20, 0, 0)}, tag='down R')
        return q
    first = reach_down(0.17, 'open')
    k.append((f(4), between(IDLE0, first, 0.5, feet={'L': STANCE['L'], 'R': STANCE['R']})))
    k.append((f(8), first))
    k.append((f(14), reach_down(0.10, 'fist')))
    p = base()
    torso(p, (6, 2, 0), (4, 2, 0), (0, 0, 0), (6, -4, 0), (12, -6, 0))
    stance(p, hips=(0, -0.05, -0.01), yaw=-6)
    reach(p, 'L', pos=W(0.15, 0.38, 1.16), blade=D(1, 0, 0), edge=D(0, 1, 0.2), seed={'LeftUpperArm': (50, 20, 10), 'LeftLowerArm': (90, -20, 0)}, tag='look L')
    p.update(hand('L', 'cup'))
    reach(p, 'R', pos=W(-0.27, 0.20, 0.95), blade=D(0.10, 0.92, 0.35), seed=IDLE_R_SEED, tag='look R')
    k.append((f(22), p))
    q = dict(p)
    q['Head'] = (12, -8, -6)
    q['Neck'] = (6, -5, -2)
    k.append((f(29), q))
    k.append((f(36), IDLE0))
    return k


SEAT_FEET = {'L': Foot(out=0.07, fwd=0.10, yaw=-4), 'R': Foot(out=0.09, fwd=0.06, yaw=8)}


def seated(b):
    """The resting seat: knees up, the sword across the knees under the right hand, the left hand on the left knee;
    b = breath (-1 out, +1 in)."""
    q = base()
    torso(q, (16, 0, 0), (9 - 1.5 * b, 0, 0), (4 - 1.0 * b, 0, 0), (8, 0, 0), (4 + 1.0 * b, 4, 0))
    q['Hips.loc'] = hips_loc(0, -0.74, -0.30)
    q['Hips'] = hips_rot(yaw=-4, pitch=-16)
    plant(q, SEAT_FEET, tag='seat')
    ground(q, regions={2, 3, 7})
    plant(q, SEAT_FEET, tag='seat2')
    q['LeftShoulder'] = (0, 0, 1.2 * b)
    q['RightShoulder'] = (0, 0, -1.2 * b)
    M = BROAD.mats(q, ['LeftLowerLeg', 'RightLowerLeg'])
    kl, kr = M['LeftLowerLeg'].translation, M['RightLowerLeg'].translation
    reach(q, 'R', pos=kr + Vector((0.02, -0.12, 0.03 + 0.003 * b)), blade=D(1.0, 0.15, -0.05), w_dir=45.0,
          seed={'RightUpperArm': (50, -40, 10), 'RightLowerArm': (40, -50, 0)}, tag='seat R')
    reach(q, 'L', pos=kl + Vector((0.0, -0.07, 0.07 + 0.003 * b)), edge=D(0, 0.6, -0.8),
          seed={'LeftUpperArm': (60, 10, -10), 'LeftLowerArm': (60, 0, 0)}, tag='seat L')
    q.update(hand('L', 'relax'))
    tail(q, lift=88, sway=-10)
    return q


@clip('SitRest', loop=False, loop_start=f(39), shots=[0, f(9), f(18), f(27), f(39), f(60)], view=dict(az=55, el=16))
def c_sitrest():
    k = [(0, IDLE0)]
    p = base()
    torso(p, (22, 0, 0), (10, 0, 0), (2, 0, 0), (-6, 0, 0), (-4, 0, 0))
    stance(p, hips=(0, -0.38, -0.10), yaw=-6, pitch=6)
    relaxed_left(p, x=50, y=10, z=-5, elbow=20)
    reach(p, 'R', pos=W(-0.26, 0.40, 0.70), blade=D(0.10, 0.90, 0.40), seed=IDLE_R_SEED, tag='squat R')
    k.append((f(9), p))
    SIT = {'L': STANCE['L'].moved(fwd=0.06), 'R': STANCE['R'].moved(fwd=0.10)}
    p = base()
    torso(p, (10, 0, 0), (4, 0, 0), (0, 0, 0), (-2, 0, 0), (2, 0, 0))
    p['Hips.loc'] = hips_loc(0, -0.72, -0.30)
    p['Hips'] = hips_rot(yaw=-5, pitch=-20)
    plant(p, SIT, tag='sit')
    ground(p, regions={2, 3, 7})
    plant(p, SIT, tag='sit2')
    reach(p, 'L', pos=W(0.26, -0.48, 0.035), blade=D(1, 0, 0), edge=D(0, -1, 0), seed={'LeftUpperArm': (-40, -20, 20), 'LeftLowerArm': (20, 0, 0)}, tag='prop L')
    p.update(hand('L', 'open'))
    reach(p, 'R', pos=W(-0.28, 0.22, 0.48), blade=D(0.10, 0.90, 0.20), seed=IDLE_R_SEED, tag='sit R')
    tail(p, lift=88, sway=-10)
    sat = p
    down = between(k[-1][1], sat, 0.45, feet={'L': STANCE['L'].moved(fwd=0.03), 'R': STANCE['R'].moved(fwd=0.05)})
    reach(down, 'L', pos=W(0.30, -0.30, 0.30), edge=D(0, -0.5, -0.8), seed=sat, tag='back L')
    k.append((f(13), down))
    k.append((f(18), sat))
    s1 = seated(-1)
    lean = dict(s1)
    lean['Spine'] = (12, 0, 0)
    mid = between(sat, lean, 0.5, ground_it=True, regions={2, 3, 7}, feet=SEAT_FEET)
    reach(mid, 'L', pos=W(0.30, -0.12, 0.30), edge=D(0, 0.3, -1), seed=lean, tag='hand up L')
    k.append((f(22), mid))
    k.append((f(27), lean))
    k.append((f(39), s1))
    k.append((f(60), seated(1)))
    k.append((f(81), s1))
    k.append((f(102), seated(1)))
    k.append((f(123), s1))
    return k


# ---------------------------------------------------------------------- species specials
SWORD_LOW = (W(-0.40, 0.18, 0.86), D(0.05, 0.95, -0.25))


@clip('Breath', events={'release': f(16), 'stop': f(33)}, shots=[0, f(12), f(16), f(22), f(29), f(33)], view=dict(az=62, el=12),
      props=('sword', 'tail'))
def c_breath():
    """Draconid: rear back and draw breath, then the head and neck thrust forward and the breath sweeps left and right
    (the rig has no jaw: the mouth socket aims forward; the effect is the client's). The tail chain whips through."""
    k = [(0, IDLE0)]
    p = base()
    torso(p, (-6, 0, 0), (-10, 0, 0), (-6, 0, 0), (-15, 0, 0), (-12, 0, 0))
    stance(p, hips=(0, -0.05, -0.04), yaw=-6, pitch=-3)
    p['LeftUpperArm'] = (5, -10, 30)
    p['LeftLowerArm'] = (50, 0, 0)
    p['LeftHand'] = (-10, 0, 0)
    p.update(hand('L', 'claw', spread=0.8))
    reach(p, 'R', pos=W(-0.40, 0.10, 0.95), blade=D(0.05, 0.95, 0.10), seed=IDLE_R_SEED, tag='inhale R')
    tail(p, lift=18, sway=-10)
    k.append((f(12), p))

    def breathe(yaw, sway, phase, drop=0.07):
        q = base()
        torso(q, (12, yaw * 0.2, 0), (8, yaw * 0.3, 0), (2, 0, 0), (24, yaw * 0.25, 0), (-26, yaw * 0.25, 0))
        stance(q, hips=(0, -drop, 0.06), yaw=-4, pitch=4)
        q['LeftUpperArm'] = (-20, -10, 35)
        q['LeftLowerArm'] = (40, 0, 0)
        q['LeftHand'] = (-20, 0, 0)
        q.update(hand('L', 'claw', spread=1.0))
        pos, bl = SWORD_LOW
        reach(q, 'R', pos=pos + Vector((0, 0, -drop * 0.5)), blade=bl, seed={'RightUpperArm': (-10, 0, -10), 'RightLowerArm': (20, 0, 0)}, tag='breath R')
        tail(q, lift=-6, sway=sway, wave=12, phase=phase)
        return q
    k.append((f(16), breathe(0, 14, 0.0)))
    k.append((f(22), breathe(14, -10, 1.6, drop=0.075)))
    k.append((f(29), breathe(-14, 12, 3.2, drop=0.075)))
    k.append((f(33), breathe(0, -6, 4.4, drop=0.065)))
    k.append((f(48), IDLE0))
    return k


@clip('Roar', events={'release': f(16)}, shots=[0, f(9), f(16), f(20), f(30), f(45)], view=dict(az=30, el=12))
def c_roar():
    """Orc: hunch and load, then chest out, arms flung back with fists clenched, head up; a tremble while it lasts."""
    k = [(0, IDLE0)]
    p = base()
    torso(p, (15, 0, 0), (12, 0, 0), (5, 0, 0), (10, 0, 0), (10, 0, 0))
    stance(p, hips=(0, -0.06, 0.0), yaw=-6, pitch=3)
    p['LeftShoulder'] = (8, 0, 8)
    p['RightShoulder'] = (8, 0, -8)
    p['LeftUpperArm'] = (30, 20, -10)
    p['LeftLowerArm'] = (70, 0, 0)
    p['LeftHand'] = (0, 0, 0)
    p.update(hand('L', 'fist'))
    reach(p, 'R', pos=W(-0.22, 0.30, 1.05), blade=D(0.20, 0.80, 0.55), seed=IDLE_R_SEED, tag='hunch R')
    k.append((f(9), p))

    def roar(t):
        q = base()
        torso(q, (-10 + t, 0, 0), (-12 - t, 0, 0), (-8, 0, 0), (-15 + t, 0, 0), (-20 - t, 0, 0))
        stance(q, hips=(0, -0.085, -0.01), yaw=-6, feet={'L': STANCE['L'].moved(out=0.07), 'R': STANCE['R'].moved(out=0.07)})
        q['LeftShoulder'] = (-6, 0, -2)
        q['RightShoulder'] = (-6, 0, 2)
        q['LeftUpperArm'] = (-35 + t, -10, 45)
        q['LeftLowerArm'] = (45, 0, 0)
        q['LeftHand'] = (-15, 0, 0)
        q.update(hand('L', 'fist'))
        q['RightUpperArm'] = (-35 - t, 10, -45)
        q['RightLowerArm'] = (45, 0, 0)
        q['RightHand'] = (-15, 0, 0)
        tail(q, lift=15 + t, sway=t * 2)
        return q
    k.append((f(16), roar(0)))
    k.append((f(20), roar(2)))
    k.append((f(24), roar(-2)))
    k.append((f(27), roar(1.5)))
    k.append((f(30), roar(0)))
    k.append((f(45), IDLE0))
    return k


# ---------------------------------------------------------------------- shield bearers
SHIELD_SEED = {'LeftUpperArm': (60, 80, -14), 'LeftLowerArm': (30, 0, 0), 'LeftHand': (0, 0, 0)}


@clip('Guard_Shield', events={'brace': f(4)}, shots=[0, f(2), f(4), f(7), f(21), f(25)], view=dict(az=40, el=14),
      props=('sword', 'shield'))
def c_guard_shield():
    """Guard for a shield in the left hand. The board on Socket_HandL faces +X (the back of the hand) with its point
    toward +Z (the fingers), so the shield arm braces with the elbow up in front of the chest and the forearm hanging:
    the back of the hand looks at the enemy, the fingers point down, the board covers chin to knee. The sword waits
    low at the right hip, point forward. Same stance, timing and brace frame as Guard."""
    k = [(0, IDLE0)]
    FRONT = Foot(out=0.06, fwd=0.18, yaw=-4)
    BACK = Foot(out=0.06, fwd=-0.08, yaw=12)

    def brace(drop, chest=0.0, lift=0.0):
        p = base()
        torso(p, (8, -4, 0), (6 + chest, -4, 0), (2, 0, 0), (2, 10, 0), (4, 10, 0))
        stance(p, hips=(0, -drop, 0.02), yaw=-14, feet={'L': FRONT, 'R': BACK})
        reach(p, 'L', pos=W(0.10, 0.40, 1.00 + lift), blade=D(-1, 0, 0), edge=D(0, 0, -1), w_edge=30.0, seed=SHIELD_SEED, tag='shield L')
        p.update(hand('L', 'fist'))
        # the sword arm hangs (a hanging forearm holds the blade level and straight ahead) a little out and back, so
        # the blade's line passes outside the board on the slight frame too (round 5: it crossed it at the brace)
        reach(p, 'R', pos=W(-0.35, 0.02, 0.92), blade=D(-0.15, 1.0, 0.05), seed={'RightUpperArm': (5, 0, 6), 'RightLowerArm': (12, 0, 0)}, tag='shield R')
        return p
    b1 = brace(0.11, lift=0.02)
    mid = mix(IDLE0, b1, 0.5)
    plant(mid, {'L': Foot(out=0.045, fwd=0.11, up=0.045, yaw=-5, pitch=5), 'R': mix_foot(STANCE['R'], BACK, 0.5)})
    k.append((f(2), mid))
    k.append((f(4), b1))
    b2 = brace(0.09)
    k.append((f(7), b2))
    k.append((f(21), brace(0.095, chest=-1)))
    back = mix(b2, IDLE0, 0.5)
    plant(back, {'L': Foot(out=0.045, fwd=0.10, up=0.045, yaw=-5, pitch=-3), 'R': mix_foot(BACK, STANCE['R'], 0.5)})
    k.append((f(25), back))
    k.append((f(30), IDLE0))
    return k


# ====================================================================== actions
def channelbag(act):
    from bpy_extras import anim_utils
    return anim_utils.action_get_channelbag_for_slot(act, act.slots[0])


def make_cyclic(act):
    for fc in channelbag(act).fcurves:
        if not fc.modifiers:
            fc.modifiers.new('CYCLES')
        fc.update()


def author_all():
    for c in CLIPS:
        CURRENT[0] = c['name']
        if c['name'] == 'Idle':
            pass
        keys = c['fn']()
        c['keys'] = keys
        c['seconds'] = round(keys[-1][0], 4)
        if c['name'] in bpy.data.actions:
            bpy.data.actions.remove(bpy.data.actions[c['name']])
        act = R.make_action(BROAD.ob, c['name'], keys, fps=FPS, loop=c['loop'])
        if c['loop']:
            make_cyclic(act)
        log('clip %-13s %5.2f s  %2d keys%s' % (c['name'], c['seconds'], len(keys), '  loop' if c['loop'] else ''))


# ====================================================================== checks
LIMIT_RULES = [('LowerArm', 0, -0.5, 150.0, 'elbow'), ('LowerLeg', 0, -158.0, 0.5, 'knee')]


def check_keys(c):
    out = []
    for t, p in c['keys']:
        for side in ('Left', 'Right'):
            for bone, ax, lo, hi, what in LIMIT_RULES:
                v = p.get(side + bone, (0, 0, 0))[ax]
                if v < lo or v > hi:
                    out.append('%s %s %.1f deg at %.2f s' % (side, what, v, t))
    if c['loop']:
        a, b = c['keys'][0][1], c['keys'][-1][1]
        worst = 0.0
        for kk in set(a) | set(b):
            va, vb = a.get(kk, (0, 0, 0)), b.get(kk, (0, 0, 0))
            worst = max(worst, max(abs(x - y) for x, y in zip(va, vb)))
        out.append('loop: first/last key differ by %.4f (deg or m)' % worst)
    if c.get('loop_start') is not None:
        ls = [p for t, p in c['keys'] if abs(t - c['loop_start']) < 1e-6]
        if ls:
            a, b = ls[0], c['keys'][-1][1]
            worst = max(max(abs(x - y) for x, y in zip(a.get(kk, (0, 0, 0)), b.get(kk, (0, 0, 0)))) for kk in set(a) | set(b))
            out.append('loop part: loopStart/last key differ by %.4f' % worst)
    return out


def body_regions(body):
    at = body.data.color_attributes['gv']
    reg = np.array([round(d.color[1] * 15) for d in at.data], dtype=np.int32)
    return reg


CORE = {0, 1, 2, 3}           # head, neck, chest, belly
BLADE_HITS = {0, 1, 2, 3, 7, 8, 9}


def contact_report(c):
    """Every frame of the clip on both frames: the lowest body point, the fists / forearms / blade against the head
    and torso (signed distance to the deformed surface; negative = inside), the blade and the tail against the floor."""
    act = bpy.data.actions[c['name']]
    assign(act)
    n_frames = round(c['seconds'] * FPS)
    rep = {}
    blade_pts = (0.15, 0.30, 0.45, 0.60, 0.75) if 'sword' in c['props'] else ()
    dagger_pts = (0.10, 0.20, 0.28) if 'dagger' in c['props'] else ()
    for fr in FRAMES:
        body = BODY[fr]
        polys = [tuple(pl.vertices) for pl in body.data.polygons]
        reg = REGIONS[fr]
        core = [pl for pl in polys if all(reg[v] in CORE for v in pl)]
        bl = [pl for pl in polys if all(reg[v] in BLADE_HITS for v in pl)]
        arm = bpy.data.objects['Rig_' + fr]
        socks = {s: bpy.data.objects['%s.%s' % (s, fr)] for s in ('Socket_HandR', 'Socket_HandL')}
        r = dict(floor_min=(9.0, 0), floor_max=(-9.0, 0), fist=(9.0, 0, ''), arm=(9.0, 0, ''), blade=(9.0, 0), blade_floor=(9.0, 0), tail_floor=(9.0, 0))
        for fn in range(0, n_frames + 1):
            bpy.context.scene.frame_set(fn)
            co = body_coords(body)
            zmin = float(co[:, 2].min())
            if zmin < r['floor_min'][0]:
                r['floor_min'] = (zmin, fn)
            if zmin > r['floor_max'][0]:
                r['floor_max'] = (zmin, fn)
            verts = [Vector(v) for v in co]
            bvh_core = BVHTree.FromPolygons(verts, core)
            bvh_bl = BVHTree.FromPolygons(verts, bl)

            def sd(bvh, pt):
                # the torso/head sub-mesh is open where the limbs join, so a far point can find its nearest face on a
                # rim facing away: an "inside" reading is trusted only within 6 cm of the surface
                hit = bvh.find_nearest(pt)
                if hit[0] is None:
                    return 9.0
                loc, nrm, _, dist = hit
                return -dist if (pt - loc).dot(nrm) < 0 and dist < 0.06 else dist
            for s, ob in socks.items():
                d = sd(bvh_core, ob.matrix_world.translation)
                if d < r['fist'][0]:
                    r['fist'] = (d, fn, s[-1])
            for side in ('Left', 'Right'):
                pb = arm.pose.bones[side + 'LowerArm']
                for t in (0.0, 0.5):
                    pt = arm.matrix_world @ (pb.head.lerp(pb.tail, t))
                    d = sd(bvh_core, pt)
                    if d < r['arm'][0]:
                        r['arm'] = (d, fn, side[0] + ('elbow' if t == 0 else 'forearm'))
            S = socks['Socket_HandR'].matrix_world
            for u in blade_pts:
                pt = S @ Vector((0, u, 0))
                d = sd(bvh_bl, pt)
                if d < r['blade'][0]:
                    r['blade'] = (d, fn)
                if pt.z < r['blade_floor'][0]:
                    r['blade_floor'] = (pt.z, fn)
            S = socks['Socket_HandL'].matrix_world
            for u in dagger_pts:
                pt = S @ Vector((0, u, 0))
                d = sd(bvh_bl, pt)
                if d < r['blade'][0]:
                    r['blade'] = (d, fn)
            for i in range(1, 5):
                pt = arm.matrix_world @ arm.pose.bones['Tail_%02d' % i].tail
                if pt.z < r['tail_floor'][0]:
                    r['tail_floor'] = (pt.z, fn)
        rep[fr] = r
    return rep


def assign(act):
    for fr in FRAMES:
        arm = bpy.data.objects['Rig_' + fr]
        adt = arm.animation_data or arm.animation_data_create()
        adt.action = act
        if adt.action_slot is None:
            adt.action_slot = act.slots[0]


def run_checks():
    lines = []
    for c in CLIPS:
        if ONLY and c['name'] not in ONLY:
            continue
        lines.append('### %s (%.2f s)' % (c['name'], c['seconds']))
        for s in check_keys(c):
            lines.append('- ' + s)
        rep = contact_report(c)
        for fr in FRAMES:
            r = rep[fr]
            lines.append('- %s: floor min %.1f cm (f%d) max %.1f cm (f%d) · fist %.1f cm (f%d %s) · forearm %.1f cm (f%d %s) · '
                         'blade %.1f cm (f%d) · blade-floor %.1f cm (f%d) · tail-floor %.1f cm (f%d)' % (
                             fr, r['floor_min'][0] * 100, r['floor_min'][1], r['floor_max'][0] * 100, r['floor_max'][1],
                             r['fist'][0] * 100, r['fist'][1], r['fist'][2], r['arm'][0] * 100, r['arm'][1], r['arm'][2],
                             r['blade'][0] * 100 if r['blade'][0] < 9 else 99, r['blade'][1],
                             r['blade_floor'][0] * 100 if r['blade_floor'][0] < 9 else 99, r['blade_floor'][1],
                             r['tail_floor'][0] * 100, r['tail_floor'][1]))
        c['report'] = rep
    worst = sorted(IK_LOG, key=lambda e: -e[2])[:25]
    lines.append('### IK: worst remaining errors (cm, deg)')
    for clipn, tag, ep, ed in worst:
        if ep > 1.0 or ed > 8:
            lines.append('- %s %s: %.1f cm, %.0f deg' % (clipn, tag, ep, ed))
    worst_d = sorted(IK_LOG, key=lambda e: -e[3])[:10]
    for clipn, tag, ep, ed in worst_d:
        if ed > 8:
            lines.append('- %s %s: %.1f cm, %.0f deg (blade)' % (clipn, tag, ep, ed))
    return lines


# ====================================================================== review renders
def oriented_box(center, axes, half):
    cx = Vector(center)
    out = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                out.append(cx + axes[0] * (sx * half[0]) + axes[1] * (sy * half[1]) + axes[2] * (sz * half[2]))
    return out


QUADS = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]


def box_object(name, items, collection, outline=0.0025):
    verts, faces, slots = [], [], []
    for corners, slot in items:
        b = len(verts)
        verts += [tuple(v) for v in corners]
        faces += [tuple(b + i for i in q) for q in QUADS]
        slots += [slot] * 8
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    toon.set_vertex_codes(me, slots=slots, regions=[0] * len(verts))
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    toon.apply_look(ob, outline=outline)
    return ob


def aabb(c, s):
    X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
    return oriented_box(c, (X, Y, Z), (s[0] / 2, s[1] / 2, s[2] / 2))


def beam(a, b, w, hint=Vector((1, 0, 0)), w2=None):
    a, b = Vector(a), Vector(b)
    y = (b - a)
    L = y.length
    y.normalize()
    x = hint - y * hint.dot(y)
    if x.length < 1e-6:
        x = Vector((0, 0, 1)) - y * y.z
    x.normalize()
    z = x.cross(y)
    return oriented_box((a + b) / 2, (x, y, z), (w / 2, L / 2, (w2 or w) / 2))


def attach(ob, parent):
    ob.parent = parent
    ob.matrix_parent_inverse = Matrix.Identity(4)
    ob.matrix_basis = Matrix.Identity(4)


METAL, LEATHER, TRIM, WOOD, GLOW = 9, 8, 10, 12, 11


WEAPONS_BLEND = os.path.join(BUILD, 'weapons.blend')


def load_shield(col, fr, name='shd_shieldKite_S'):
    """The weapons pass's shield (art/build/weapons.blend) on Socket_HandL with an identity transform, as the client
    attaches it; None when that file is missing."""
    if not os.path.exists(WEAPONS_BLEND):
        return None
    with bpy.data.libraries.load(WEAPONS_BLEND, link=False) as (src, dst):
        if name not in src.objects:
            return None
        dst.objects = [name]
    ob = dst.objects[0]
    ob.name = 'Prop_shield.' + fr
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    col.objects.link(ob)
    if 'Outline' not in ob.modifiers:
        toon.apply_look(ob, outline=0.003)
    attach(ob, bpy.data.objects['Socket_HandL.' + fr])
    return ob


def build_props(col):
    props = {}
    for fr in FRAMES:
        sw = box_object('Prop_sword.' + fr, [
            (aabb((0, -0.075, 0), (0.032, 0.03, 0.032)), METAL),
            (aabb((0, -0.005, 0), (0.026, 0.115, 0.026)), LEATHER),
            (aabb((0, 0.062, 0), (0.03, 0.022, 0.17)), TRIM),
            (aabb((0, 0.42, 0), (0.012, 0.70, 0.048)), METAL),
            (aabb((0, 0.785, 0), (0.010, 0.03, 0.026)), METAL)], col)
        attach(sw, bpy.data.objects['Socket_HandR.' + fr])
        dg = box_object('Prop_dagger.' + fr, [
            (aabb((0, -0.05, 0), (0.026, 0.07, 0.026)), LEATHER),
            (aabb((0, 0.0, 0), (0.026, 0.014, 0.09)), TRIM),
            (aabb((0, 0.17, 0), (0.010, 0.30, 0.036)), METAL)], col)
        attach(dg, bpy.data.objects['Socket_HandL.' + fr])
        pts = [Vector((0, -0.62 + 1.24 * i / 10, -0.16 * ((-0.62 + 1.24 * i / 10) / 0.62) ** 2)) for i in range(11)]
        items = [(beam(pts[i], pts[i + 1], 0.024, Vector((1, 0, 0)), 0.03), WOOD) for i in range(10)]
        items.append((aabb((0, 0, 0.005), (0.034, 0.11, 0.04)), LEATHER))
        bow = box_object('Prop_bow.' + fr, items, col)
        attach(bow, bpy.data.objects['Socket_HandR.' + fr])
        st = box_object('Prop_string.' + fr, [(beam((0, 0, 0), (0, 0, 1), 0.004), TRIM), (beam((0, 0, 1), (0, 0, 2), 0.004), TRIM)], col, outline=0)
        arm = bpy.data.objects['Rig_' + fr]
        tl_items = []
        tails = []
        for i in range(4):
            b = arm.data.bones['Tail_%02d' % (i + 1)]
            r0 = 0.055 - 0.011 * i
            tl = box_object('Prop_tail%d.%s' % (i + 1, fr), [(beam(b.head_local, b.tail_local + (b.tail_local - b.head_local) * 0.15, r0 * 2, Vector((1, 0, 0)), r0 * 1.6), GLOW)], col)
            tl.parent = arm
            tl.parent_type = 'BONE'
            tl.parent_bone = b.name
            tl.matrix_parent_inverse = (arm.matrix_world @ b.matrix_local @ Matrix.Translation((0, b.length, 0))).inverted()
            tails.append(tl)
        props[fr] = dict(sword=sw, dagger=dg, bow=bow, string=st, tail=tails)
        shield = load_shield(col, fr)
        if shield is not None:
            props[fr]['shield'] = shield
    return props


def update_string(props, fr, drawn):
    st = props[fr]['string']
    S = bpy.data.objects['Socket_HandR.' + fr].matrix_world
    top = S @ Vector((0, 0.62, -0.16))
    bot = S @ Vector((0, -0.62, -0.16))
    mid = bpy.data.objects['Socket_HandL.' + fr].matrix_world @ Vector((0, 0.0, 0.03)) if drawn else (top + bot) / 2
    corners = beam(top, mid, 0.004) + beam(mid, bot, 0.004)
    for v, c in zip(st.data.vertices, corners):
        v.co = c
    st.data.update()


def show(props, fr, kinds):
    for f2 in FRAMES:
        BODY[f2].hide_render = f2 != fr
        for kname, ob in props[f2].items():
            obs = ob if isinstance(ob, list) else [ob]
            on = f2 == fr and (kname in kinds or (kname == 'string' and 'bow' in kinds))
            for o in obs:
                o.hide_render = not on


def frame_bounds(fr, kinds):
    arm = bpy.data.objects['Rig_' + fr]
    pts = []
    for pb in arm.pose.bones:
        if pb.name.startswith(('Tail', 'Ear', 'Beard', 'Hair')) and 'tail' not in kinds:
            continue
        pts.append(arm.matrix_world @ pb.head)
        pts.append(arm.matrix_world @ pb.tail)
    S = bpy.data.objects['Socket_HandR.' + fr].matrix_world
    if 'sword' in kinds:
        pts.append(S @ Vector((0, 0.8, 0)))
    if 'bow' in kinds:
        pts += [S @ Vector((0, 0.62, -0.16)), S @ Vector((0, -0.62, -0.16))]
    if 'shield' in kinds:
        SL = bpy.data.objects['Socket_HandL.' + fr].matrix_world
        pts += [SL @ Vector((0, y, z)) for y in (-0.28, 0.28) for z in (-0.6, 0.4)]
    return pts


def place_camera(stage, pts, az=35.0, el=10.0, pad=0.14, tight=1.0):
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))) - Vector((pad, pad, pad))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))) + Vector((pad, pad, pad))
    lo.z = min(lo.z, 0.0)
    ctr = (lo + hi) / 2
    r = (hi - lo).length / 2 * 0.86 * tight
    d = r / math.tan(math.radians(19.8)) * 1.02
    a, e = math.radians(az), math.radians(el)
    direction = Vector((-math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    stage.camera(ctr + direction * d, ctr, lens=50)


def make_label(stage):
    cu = bpy.data.curves.new('GV_Label', 'FONT')
    cu.size = 0.032
    ob = bpy.data.objects.new('GV_Label', cu)
    stage.col.objects.link(ob)
    m = bpy.data.materials.new('GV_LabelMat')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs[0].default_value = (0.85, 0.85, 0.75, 1)
    nt.links.new(em.outputs[0], o.inputs[0])
    cu.materials.append(m)
    ob.parent = stage.cam
    ob.location = (-0.335, 0.315, -1.0)
    return ob


def event_at(c, t):
    for k, v in c['events'].items():
        if abs(v - t) < 1e-6:
            return k
    if c.get('loop_start') is not None and abs(c['loop_start'] - t) < 1e-6:
        return 'loopStart'
    return ''


def render_clips(stage, props, label):
    cell = 300 if QUICK else 400
    stage.sc.render.resolution_x = stage.sc.render.resolution_y = cell
    tmp = os.path.join(OUT, '_tmp')
    os.makedirs(tmp, exist_ok=True)
    stage.out = tmp
    made = []
    for c in CLIPS:
        if ONLY and c['name'] not in ONLY:
            continue
        act = bpy.data.actions[c['name']]
        assign(act)
        times = c['shots']
        kinds = set(c['props'])
        pts = []
        for t in times:
            bpy.context.scene.frame_set(round(t * FPS))
            for fr in FRAMES:
                pts += frame_bounds(fr, kinds)
        v = c['view']
        place_camera(stage, pts, az=v.get('az', 35), el=v.get('el', 10))
        cells = []
        for fr in FRAMES:
            show(props, fr, kinds)
            for i, t in enumerate(times):
                fn = round(t * FPS)
                bpy.context.scene.frame_set(fn)
                if 'bow' in kinds:
                    s0, s1 = c['string']
                    update_string(props, fr, s0 - 1e-6 <= t <= s1 + 1e-6)
                ev = event_at(c, t)
                label.data.body = '%s · %s\n%.2f s  f%d  %s' % (c['name'], fr, t, fn, ev)
                cells.append(stage.shot('%s_%d.png' % (fr, i)))
        out = os.path.join(OUT, '%s.png' % c['name'])
        from render import grid_sheet
        grid_sheet(cells, out, cols=len(times))
        made.append(out)
        for p in cells:
            os.remove(p)
    return made


def render_closeups(stage, props, label):
    from render import grid_sheet
    tmp = os.path.join(OUT, '_tmp')
    stage.out = tmp
    size = 420 if QUICK else 560
    stage.sc.render.resolution_x = stage.sc.render.resolution_y = size
    made = []
    for name in ('Attack_Light', 'Attack_Heavy', 'Attack_Dual'):
        if ONLY and name not in ONLY:
            continue
        c = [x for x in CLIPS if x['name'] == name][0]
        assign(bpy.data.actions[name])
        cells = []
        for ev in ('hit', 'hit2'):
            if ev not in c['events']:
                continue
            fn = round(c['events'][ev] * FPS)
            bpy.context.scene.frame_set(fn)
            for fr in FRAMES:
                show(props, fr, set(c['props']))
                S = bpy.data.objects['Socket_HandR.' + fr].matrix_world.translation
                ch = bpy.data.objects['Rig_' + fr].pose.bones['Chest'].head
                tgt = (S + ch) / 2
                stage.camera(tgt + Vector((-0.95, -1.25, 0.45)), tgt, lens=50)
                label.data.body = '%s · %s\n%s f%d' % (name, fr, ev, fn)
                cells.append(stage.shot('hit_%s_%s.png' % (ev, fr)))
        out = os.path.join(OUT, 'hit_%s.png' % name)
        grid_sheet(cells, out, cols=len(cells))
        made.append(out)
        for p in cells:
            os.remove(p)
    # the most bent elbow and knee over every key of every clip
    best = {'elbow': (-1, None), 'knee': (-1, None)}
    for c in CLIPS:
        for t, p in c['keys']:
            for side in ('Left', 'Right'):
                e = p.get(side + 'LowerArm', (0, 0, 0))[0]
                kn = -p.get(side + 'LowerLeg', (0, 0, 0))[0]
                if e > best['elbow'][0]:
                    best['elbow'] = (e, (c, t, side))
                if kn > best['knee'][0]:
                    best['knee'] = (kn, (c, t, side))
    for what, (ang, (c, t, side)) in best.items():
        assign(bpy.data.actions[c['name']])
        fn = round(t * FPS)
        bpy.context.scene.frame_set(fn)
        cells = []
        for fr in FRAMES:
            show(props, fr, set(c['props']))
            arm = bpy.data.objects['Rig_' + fr]
            bone = side + ('LowerArm' if what == 'elbow' else 'LowerLeg')
            j = arm.matrix_world @ arm.pose.bones[bone].head
            sgn = 1 if side == 'Left' else -1
            stage.camera(j + Vector((sgn * 1.05, -0.55, 0.25)), j, lens=50)
            label.data.body = '%s %s %.0f deg · %s\n%s %.2f s f%d' % (side, what, ang, fr, c['name'], t, fn)
            cells.append(stage.shot('joint_%s_%s.png' % (what, fr)))
        out = os.path.join(OUT, 'joints_%s.png' % what)
        grid_sheet(cells, out, cols=2)
        made.append(out)
        for p in cells:
            os.remove(p)
    return made


KEY_SHOT = {'Idle': 0.0, 'Walk': f(4), 'Run': f(4), 'Guard': f(7), 'Hit': f(2), 'Dodge': f(6), 'Downed': f(39), 'Revive': f(26),
            'Victory': f(15), 'Defeat': f(54), 'Interact': f(14), 'SitRest': f(39), 'Breath': f(16), 'Roar': f(16),
            'Guard_Shield': f(7)}


def render_overview(stage, props, label):
    from render import grid_sheet
    stage.out = os.path.join(OUT, '_tmp')
    stage.sc.render.resolution_x = stage.sc.render.resolution_y = 200
    label.hide_render = True
    cells = []
    for c in CLIPS:
        t = KEY_SHOT.get(c['name'])
        if t is None:
            ev = c['events']
            t = ev.get('hit', ev.get('release', 0.0))
        assign(bpy.data.actions[c['name']])
        bpy.context.scene.frame_set(round(t * FPS))
        kinds = set(c['props'])
        show(props, 'broad', kinds)
        place_camera(stage, frame_bounds('broad', kinds), az=35, el=14, pad=0.10)
        if 'bow' in kinds:
            s0, s1 = c['string']
            update_string(props, 'broad', s0 - 1e-6 <= t <= s1 + 1e-6)
        cells.append(stage.shot('ov_%s.png' % c['name']))
    out = os.path.join(OUT, 'poses_200.png')
    grid_sheet(cells, out, cols=5)
    for p in cells:
        os.remove(p)
    label.hide_render = False
    return [out]


# ====================================================================== export
def export_clips():
    names = [c['name'] for c in CLIPS]
    arm = BROAD.ob
    for fr in FRAMES:
        a = bpy.data.objects['Rig_' + fr]
        if a.animation_data:
            a.animation_data.action = None
    stash_actions(arm, names)
    for tr in arm.animation_data.nla_tracks:
        for st in tr.strips:
            if st.action_slot is None:
                st.action_slot = st.action.slots[0]
    R.rest_pose(arm)
    save_blend(os.path.join(BUILD, 'hero_clips.blend'))
    others = [o for o in bpy.data.objects if o.name == 'Rig']
    for o in others:
        o.name = 'Rig.tmp'
    old = arm.name
    arm.name = 'Rig'
    try:
        kb = export_glb(os.path.join(HERO, 'hero_clips.glb'), [arm], animations=True, animation_mode='ACTIONS',
                        extra={'export_optimize_animation_size': True, 'export_optimize_animation_keep_anim_armature': True})
    finally:
        arm.name = old
        for o in others:
            o.name = 'Rig'
    return kb


def write_clips_json():
    data = {'fps': FPS, 'hipsHeight': round(BROAD.head0['Hips'].z, 4), 'clips': []}
    for c in CLIPS:
        e = {'name': c['name'], 'seconds': round(c['seconds'], 4), 'loop': bool(c['loop'] or c.get('loop_start') is not None),
             'events': {k: round(v, 4) for k, v in c['events'].items()}}
        if c.get('loop_start') is not None:
            e['loopStart'] = round(c['loop_start'], 4)
        if c.get('speed'):
            e['speed'] = c['speed']
        data['clips'].append(e)
    write_json(os.path.join(HERO, 'clips.json'), data)
    return data


# ====================================================================== main
BROAD = SLIGHT = None
BODY = {}
REGIONS = {}
REST_X = None


def main():
    global BROAD, SLIGHT, REST_X
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.render.fps_base = 1.0
    BROAD, SLIGHT = Skel('broad'), Skel('slight')
    for fr in FRAMES:
        BODY[fr] = bpy.data.objects['Body_' + fr]
        REGIONS[fr] = body_regions(BODY[fr])
        if 'Outline' in BODY[fr].modifiers:
            BODY[fr].modifiers['Outline'].show_viewport = False
        R.rest_pose(bpy.data.objects['Rig_' + fr])
    REST_X = np.array([v.co.x for v in BODY['broad'].data.vertices], dtype=np.float32)
    log('rigs: broad H %.3f, slight H %.3f, hips %.3f / %.3f' % (BROAD.height, SLIGHT.height, BROAD.head0['Hips'].z, SLIGHT.head0['Hips'].z))
    CURRENT[0] = 'Idle0'
    IDLE0.update(idle_pose(0.0))
    author_all()
    lines = run_checks()
    with open(os.path.join(BUILD, 'clips_checks.txt'), 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(lines) + '\n')
    for line in lines:
        log(line)
    if not ARGS.get('no_renders'):
        from render import Stage
        old = bpy.data.collections.get('GV_Stage')
        if old:
            for o in list(old.objects):
                bpy.data.objects.remove(o)
        stage = Stage(OUT, size=400, quick=QUICK)
        col = bpy.data.collections.get('GV_Props') or bpy.data.collections.new('GV_Props')
        if col.name not in sc.collection.children:
            sc.collection.children.link(col)
        props = build_props(col)
        label = make_label(stage)
        made = render_clips(stage, props, label)
        made += render_closeups(stage, props, label)
        made += render_overview(stage, props, label)
        for p in made:
            log('render', os.path.relpath(p, REPO))
        for o in list(col.objects):
            bpy.data.objects.remove(o)
        bpy.data.collections.remove(col)
        bpy.data.objects.remove(label)
        tmp = os.path.join(OUT, '_tmp')
        if os.path.isdir(tmp) and not os.listdir(tmp):
            os.rmdir(tmp)
    for fr in FRAMES:
        BODY[fr].hide_render = False
        if 'Outline' in BODY[fr].modifiers:
            BODY[fr].modifiers['Outline'].show_viewport = True
    data = write_clips_json()
    log('clips.json: %d clips' % len(data['clips']))
    if not ARGS.get('no_export'):
        kb = export_clips()
        path = os.path.join(HERO, 'hero_clips.glb')
        for line in reimport_report(path):
            log(line)
        log('hero_clips.glb %.1f KB' % kb)


if __name__ == '__main__':
    main()

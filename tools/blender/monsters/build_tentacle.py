"""build_tentacle.py — the tentacle base (06 §3.5): the Deep Tentacle, the Deep Maw and Sister Naesa's arms.

Run:  blender -b -P tools/blender/monsters/build_tentacle.py -- [--quick] [--no-renders]

One bone chain (`Root` + `T_01`..`T_10`, segments shrinking ×0.9 toward the tip) skins a suckered, slick tentacle
2.5 m out of the water (`tentacle_body`). The same rig carries the Deep Maw's plate bones (`Maw` + five `Lip_*`): the
plate is the part `tentacle_maw`, a toothed throat with a raised rim, and the client draws `tentacle_body` five times
round it at the offsets written into the manifest (`instances`). Naesa's arms are `tentacle_body` at 0.6× with the
shape key `var_arm` (a slimmer root that can join a shoulder). Clips (skeletal, 30 fps): Idle, Move, Attack1 (lash /
slam), Attack2 (grab-wrap and drag), Hit, Death (retract under the water) and Rise (the reverse, for tentacles that
surface mid-fight). Palette slots: 0 flesh, 1 suckers / the maw's gums, 2 the tip, 5 ink (sucker cups, the throat),
13 bone (teeth).

Outputs: client/public/models/monsters/tentacle.glb, the manifest and clips.json entries, art/build/tentacle.blend,
review renders in art/renders/monsters/tentacle/.
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import spirit_lib as S  # noqa: E402
from spirit_lib import MB, smoothstep  # noqa: E402

import common  # noqa: E402
from common import BUILD, RENDERS, log  # noqa: E402

A = S.args()
QUICK = bool(A.get('quick'))
RENDER = not A.get('no_renders')
BASE = 'tentacle'
OUT = os.path.join(RENDERS, 'monsters', BASE)

# ---------------------------------------------------------------- the chain
L = 2.5
NB = 10
RATIO = 0.9
L1 = L * (1 - RATIO) / (1 - RATIO ** NB)
KN = [0.0]
for _i in range(NB):
    KN.append(KN[-1] + L1 * RATIO ** _i)
CHAIN = ['T_%02d' % (i + 1) for i in range(NB)]
ROOT_Z = -0.30
NAMES = ['Root'] + CHAIN
KNOTS = [ROOT_Z] + KN

NS = 12              # sides round the tube
U_TIP = 0.985
TIP_FROM = 0.84      # the black tip starts here (fraction of the length)

# ---------------------------------------------------------------- the maw (plate) — tentacles stand at these angles
TENT_ANGLES = [-126.0, -54.0, 18.0, 90.0, 162.0]      # degrees round the plate; −90° = the front (toward the party)
LIP_ANGLES = [-90.0, -18.0, 54.0, 126.0, 198.0]
LIPS = ['Lip_%d' % (i + 1) for i in range(5)]
R_TENT = 1.42        # tentacle roots round the throat (the Maw is ~4 m across with the tentacles' sway)
LIP_R0, LIP_R1 = 1.15, 0.42

VARIANTS = {
    'deep-tentacle': dict(scale=1.0, parts=[], shapes={}, palette=['#4b6e52', '#e9e4d4', '#16181b'], clipSpeed=1.0),
    'deep-maw': dict(scale=1.0, parts=['tentacle_maw'], shapes={}, palette=['#4b6e52', '#e3a3ad', '#16181b'],
                     clipSpeed=0.85),
    'naesa-arm': dict(scale=0.6, parts=[], shapes={'var_arm': 1.0}, palette=['#4f7258', '#efe8dc', '#2e4a6b'],
                      clipSpeed=1.15),
}


def radius(z):
    u = z / L
    if u < 0:
        return 0.242 + 0.05 * min(1.0, -u / 0.12)
    return 0.012 + 0.23 * (1 - min(u, 1.0)) ** 1.5


def arm_factor(z):
    """var_arm: the root slims to 45 % and blends back to the full tentacle by 60 % of its length."""
    u = z / L
    return 0.45 + 0.55 * smoothstep(0.0, 0.6, u)


def body_weights(z):
    return S.chain_weights(z, KNOTS, NAMES, blend=0.45)


# ================================================================ meshes
def build_body(col):
    mb = MB()
    ring_z = [ROOT_Z, -0.12]
    n_vis = 30
    for k in range(n_vis):
        u = U_TIP * (1 - (1 - k / (n_vis - 1)) ** 1.35)
        ring_z.append(u * L)
    rings = []
    for z in ring_z:
        r = radius(z)
        ring = []
        for i in range(NS):
            th = math.radians(-90 + i * 360 / NS)
            rr = r * (1 - 0.12 * max(0.0, -math.sin(th)) ** 3)      # a flatter front (the sucker side)
            ring.append(mb.v((rr * math.cos(th), rr * math.sin(th), z), w=body_weights(z), z=z, axis=True))
        rings.append(ring)
    mb.begin('tube')
    for k in range(len(rings) - 1):
        z0 = ring_z[k]

        def slot(i, z0=z0):
            zig = 0.022 * (i % 2)
            return 2 if z0 / L >= TIP_FROM - zig else 0
        mb.bridge(rings[k], rings[k + 1], slot)
    tip = mb.v((0, 0, L), w=body_weights(L), z=L, axis=True)
    mb.fan(rings[-1], tip, 2)
    bottom = mb.v((0, 0, ROOT_Z - 0.04), w=body_weights(ROOT_Z), z=ROOT_Z, axis=True)
    mb.fan(rings[0], bottom, 0, flip=True)
    tube = mb.end()
    mb.orient(tube, lambda c: Vector((0, 0, max(ROOT_Z, min(L, c.z)))))
    # suckers: two staggered rows on the front, evenly spaced in ∫ dz / r so they shrink with the tentacle
    zs = [0.08 + i * 0.005 for i in range(int((2.05 - 0.08) / 0.005))]
    F = [0.0]
    for a, b in zip(zs, zs[1:]):
        F.append(F[-1] + (b - a) / radius(a))
    n_s = 8
    for row, th_deg in enumerate((-90 - 27, -90 + 27)):
        for j in range(n_s):
            target = F[-1] * (j + 0.25 + 0.5 * row) / (n_s + 0.25)
            m = min(range(len(F)), key=lambda q: abs(F[q] - target))
            sucker(mb, zs[m], math.radians(th_deg))
    log('tentacle_body: %d tris' % mb.tris())
    ob = mb.build('tentacle_body', col)
    return mb, ob


def sucker(mb, z, th):
    r = radius(z) * (1 - 0.12 * max(0.0, -math.sin(th)) ** 3)
    rs = 0.40 * radius(z)
    n = Vector((math.cos(th), math.sin(th), 0.0))
    t1 = Vector((-math.sin(th), math.cos(th), 0.0))
    t2 = Vector((0, 0, 1))
    p = Vector((r * math.cos(th), r * math.sin(th), z))
    w = body_weights(z)
    m = 8

    def ring(rad, h):
        out = []
        for i in range(m):
            a = 2 * math.pi * i / m + math.pi / 8
            out.append(mb.v(p + t1 * (rad * math.cos(a)) + t2 * (rad * math.sin(a)) + n * h, w=w, z=z))
        return out
    base = ring(rs, -0.012)
    top = ring(0.92 * rs, 0.32 * rs)
    inner = ring(0.46 * rs, 0.16 * rs)
    centre = mb.v(p + n * (-0.10 * rs), w=w, z=z)
    mb.begin('sucker')
    mb.bridge(base, top, 1)
    side = mb.end()
    mb.orient(side, lambda c, p=p, n=n: p + n * (c - p).dot(n))
    mb.begin('sucker_top')
    mb.bridge(top, inner, 1)
    mb.fan(inner, centre, 5)
    cap = mb.end()
    mb.orient(cap, p - n * 0.5)


def maw_weights(x, y):
    r = math.hypot(x, y)
    a = math.degrees(math.atan2(y, x))
    # the two lips either side of this angle
    best = []
    for k, la in enumerate(LIP_ANGLES):
        d = (a - la + 540) % 360 - 180
        best.append((abs(d), k))
    best.sort()
    (d0, k0), (d1, k1) = best[0], best[1]
    w0 = 1 - d0 / (d0 + d1) if d0 + d1 > 0 else 1.0
    f = smoothstep(0.22, 0.40, r) * (1 - smoothstep(0.95, 1.28, r))
    w = {'Maw': 1 - f}
    w[LIPS[k0]] = f * w0
    w[LIPS[k1]] = w.get(LIPS[k1], 0) + f * (1 - w0)
    return w


def build_maw(col):
    mb = MB()
    nseg = 30
    prof = [  # (r, z, slot of the band from this ring outward)
        (0.10, -0.62, 5), (0.22, -0.45, 5), (0.34, -0.18, 5), (0.42, 0.02, 1), (0.56, 0.08, 1), (0.72, 0.12, 1),
        (0.86, 0.20, 1), (1.00, 0.27, 0), (1.16, 0.22, 0), (1.40, 0.08, 0), (1.72, -0.10, 0)]

    def lobe(a_deg, r):
        # the rim rises between the tentacles (at the lips) and dips where a tentacle stands
        if r < 0.8:
            return 0.0
        k = min(1.0, (r - 0.8) / 0.2) * (1 - smoothstep(1.2, 1.5, r))
        return 0.07 * k * math.cos(math.radians(5 * (a_deg - LIP_ANGLES[0])))
    rings = []
    for r, z, _s in prof:
        ring = []
        for i in range(nseg):
            a = -90 + i * 360 / nseg
            x, y = r * math.cos(math.radians(a)), r * math.sin(math.radians(a))
            ring.append(mb.v((x, y, z + lobe(a, r)), w=maw_weights(x, y)))
        rings.append(ring)
    mb.begin('plate')
    centre = mb.v((0, 0, -0.66), w={'Maw': 1.0})
    mb.fan(rings[0], centre, 5)
    for k in range(len(rings) - 1):
        mb.bridge(rings[k], rings[k + 1], prof[k][2])
    plate = mb.end()
    # every band faces up / into the throat: the plate's material is below it
    mb.orient(plate, lambda c: Vector((c.x * 1.08, c.y * 1.08, c.z - 0.3)) if math.hypot(c.x, c.y) > 0.45 else Vector((c.x * 1.6, c.y * 1.6, c.z - 0.1)))
    # teeth: three rings, pointing in and up (13 bone)
    for count, r, z, h, inward, width in ((14, 0.47, 0.06, 0.15, 0.78, 0.075), (16, 0.68, 0.12, 0.19, 0.62, 0.085),
                                          (20, 0.97, 0.26, 0.11, 0.25, 0.06)):
        for i in range(count):
            a = math.radians(-90 + (i + 0.5) * 360 / count)
            radial = Vector((math.cos(a), math.sin(a), 0))
            tang = Vector((-math.sin(a), math.cos(a), 0))
            base = Vector((r * math.cos(a), r * math.sin(a), z + lobe(math.degrees(a), r) - 0.015))
            d = (-radial * inward + Vector((0, 0, 1)) * (1 - inward * 0.6)).normalized()
            side = d.cross(tang).normalized()
            q = [mb.v(base + tang * sx * width / 2 + side * sy * width / 2, w=maw_weights(base.x, base.y))
                 for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            tip = mb.v(base + d * h, w=maw_weights(base.x, base.y))
            mb.begin('tooth')
            mb.fan(q, tip, 13)
            tf = mb.end()
            mb.orient(tf, lambda c, base=base, d=d: base + d * (c - base).dot(d))
    log('tentacle_maw: %d tris' % mb.tris())
    ob = mb.build('tentacle_maw', col)
    return mb, ob


# ================================================================ rig
def build_rig(col):
    bones = [('Root', (0, 0, ROOT_Z), (0, 0, 0.0), None, (0, -1, 0))]
    prev = 'Root'
    for i, nm in enumerate(CHAIN):
        bones.append((nm, (0, 0, KN[i]), (0, 0, KN[i + 1]), prev, (0, -1, 0)))
        prev = nm
    bones.append(('Maw', (0, 0, -0.05), (0, 0, 0.25), None, (0, -1, 0)))
    for nm, a in zip(LIPS, LIP_ANGLES):
        ar = math.radians(a)
        h = (LIP_R0 * math.cos(ar), LIP_R0 * math.sin(ar), 0.12)
        t = (LIP_R1 * math.cos(ar), LIP_R1 * math.sin(ar), 0.12)
        bones.append((nm, h, t, 'Maw', (0, 0, 1)))
    return S.make_rig('Rig', bones, col)


# ================================================================ clips
def lips(t, T, open_=0.0, close=0.0, breathe=1.0):
    """Lip bones: −X dips the inner edge into the throat (opening), +X lifts it (closing); Y-scale < 1 widens."""
    p = {}
    for j, nm in enumerate(LIPS):
        b = breathe * math.sin(2 * math.pi * t / T + j * 1.3)
        rx = 5 * b - 26 * open_ + 22 * close
        sy = 1 - 0.04 * (1 + b) / 2 - 0.30 * open_ + 0.04 * close
        p[nm] = (rx, 0, 0)
        p[nm + '.scl'] = (1, sy, 1)
    return p


def wave(t, T, ax, az, phase, bias, twist=0.0, root=(0, 0, 0), bob=0.0, side=None):
    p = {'Root': root}
    if bob:
        p['Root.loc'] = (0, bob * math.sin(4 * math.pi * t / T), 0)
    for i, nm in enumerate(CHAIN):
        k = i / (NB - 1)
        ang = 2 * math.pi * t / T - phase * i
        p[nm] = (bias(k) + ax(k) * math.sin(ang), twist * k * math.sin(ang + 0.7), (side(k) if side else 0) + az(k) * math.cos(ang))
    return p


IDLE_BIAS = [10, 8, 2, -6, -10, -8, 4, 22, 34, 40]       # an S: the base leans in, the middle back, the top curls over
IDLE_SIDE = [3, 4, 4, 2, -1, -4, -6, -6, -4, -2]


def bias_of(table):
    return lambda k: table[min(NB - 1, round(k * (NB - 1)))]


def idle_pose(t, T=2.4):
    p = wave(t, T, lambda k: 4 + 6 * k, lambda k: 5 + 8 * k, 0.55, bias_of(IDLE_BIAS), twist=8, side=bias_of(IDLE_SIDE))
    p.update(lips(t, T))
    return p


def move_pose(t, T=1.2):
    p = wave(t, T, lambda k: 6 + 8 * k, lambda k: 3 + 6 * k, 0.8, bias_of([14, 10, 4, -4, -6, -2, 8, 20, 28, 30]), twist=8,
             root=(6, 0, 0), bob=0.03, side=bias_of(IDLE_SIDE))
    p.update(lips(t, T, breathe=1.4))
    return p


def rel(angles, root=(0, 0, 0), z=None, y=None, extra=None):
    p = {'Root': root}
    for i, nm in enumerate(CHAIN):
        p[nm] = (angles[i], (y[i] if y else 0), (z[i] if z else 0))
    p.update(extra or {})
    return p


def mix(a, b, t):
    out = {}
    for k in set(a) | set(b):
        va = a.get(k, (1, 1, 1) if k.endswith('.scl') else (0, 0, 0))
        vb = b.get(k, (1, 1, 1) if k.endswith('.scl') else (0, 0, 0))
        out[k] = tuple(x + (y - x) * t for x, y in zip(va, vb))
    return out


def sampled(T, fn, step=3):
    n = round(T * S.FPS)
    keys = [(f / S.FPS, fn(f / S.FPS)) for f in range(0, n, step)]
    keys.append((T, fn(0.0)))
    return keys


CLIPS = []


def clip(name, seconds, loop=False, events=None, shots=None):
    def deco(fn):
        CLIPS.append(dict(name=name, seconds=seconds, loop=loop, events=events or {}, fn=fn, shots=shots))
        return fn
    return deco


@clip('Idle', 2.4, loop=True, shots=[0, 0.4, 0.8, 1.2, 1.6, 2.0])
def c_idle():
    return sampled(2.4, idle_pose)


@clip('Move', 1.2, loop=True, shots=[0, 0.2, 0.4, 0.6, 0.8, 1.0])
def c_move():
    return sampled(1.2, move_pose)


@clip('Attack1', 1.1, events={'hit': 0.5}, shots=[0, 0.3, 0.43, 0.5, 0.63, 0.9])
def c_attack1():
    i0 = idle_pose(0)
    wind = rel([-6, -8, -9, -10, -11, -12, -12, -12, -10, -8], root=(-6, 0, 0), extra=lips(0, 1, close=0.4, breathe=0))
    whip = rel([14, 12, 6, -2, -8, -12, -14, -14, -12, -10], root=(2, 0, 0), extra=lips(0, 1, open_=0.3, breathe=0))
    strike = rel([28, 23, 19, 15, 12, 7, 5, 5, 4, 3], root=(6, 0, 0), extra=lips(0, 1, open_=0.6, breathe=0))
    follow = rel([28, 22, 18, 15, 13, 12, 14, 16, 16, 14], root=(6, 0, 0), extra=lips(0, 1, open_=0.4, breathe=0))
    recover = rel([8, 6, 5, 4, 4, 6, 8, 10, 10, 9], root=(2, 0, 0), extra=lips(0, 1, breathe=0))
    return [(0.0, i0), (0.3, wind), (0.43, whip), (0.5, strike), (0.63, follow), (0.85, recover), (1.1, i0)]


@clip('Attack2', 1.5, events={'hit': 0.55}, shots=[0, 0.3, 0.55, 0.75, 1.05, 1.3])
def c_attack2():
    i0 = idle_pose(0)
    reach = rel([20, 18, 16, 14, 12, 8, 4, 0, -2, -4], root=(4, 0, 0), extra=lips(0, 1, open_=0.5, breathe=0))
    wrap = rel([20, 17, 15, 13, 10, 8, 62, 66, 70, 70], root=(4, 0, 0), y=[0, 0, 0, 0, 0, 0, 12, 16, 20, 20],
               extra=lips(0, 1, open_=0.9, breathe=0))
    squeeze = rel([19, 16, 14, 12, 10, 9, 66, 70, 72, 72], root=(4, 0, 0), y=[0, 0, 0, 0, 0, 0, 16, 20, 24, 24],
                  z=[0, 0, 0, 0, 2, 4, 6, 4, 2, 0], extra=lips(0, 1, open_=1.0, breathe=0))
    drag = rel([-4, 2, 6, 8, 10, 12, 64, 68, 70, 70], root=(-3, 0, 0), y=[0, 0, 0, 0, 0, 0, 14, 18, 22, 22],
               extra=lips(0, 1, close=1.0, breathe=0))
    return [(0.0, i0), (0.3, reach), (0.55, wrap), (0.75, squeeze), (1.05, drag), (1.5, i0)]


@clip('Hit', 0.45, shots=[0, 0.07, 0.15, 0.25, 0.35, 0.45])
def c_hit():
    i0 = idle_pose(0)
    jolt = mix(i0, rel([-5, -7, -9, -11, -12, -13, -14, -14, -12, -10], root=(-4, 0, 0), z=[3, 4, 5, 6, 7, 8, 8, 8, 8, 8],
                       extra=lips(0, 1, close=1.0, breathe=0)), 0.85)
    over = mix(i0, rel([3, 4, 4, 5, 5, 5, 6, 6, 6, 6], z=[-2, -2, -3, -3, -4, -4, -4, -4, -4, -4]), 0.7)
    return [(0.0, i0), (0.07, jolt), (0.2, over), (0.45, i0)]


@clip('Death', 1.8, events={'down': 1.5}, shots=[0, 0.2, 0.4, 0.7, 1.1, 1.5])
def c_death():
    i0 = idle_pose(0)
    thr1 = rel([10, 10, 10, 10, 10, 10, 10, 10, 8, 6], z=[12, 12, 12, 12, 12, 12, 10, 8, 6, 4],
               extra=lips(0, 1, open_=1.0, breathe=0))
    thr2 = rel([-6, -8, -8, -8, -8, -8, -6, -4, -2, 0], z=[-12, -14, -14, -14, -14, -12, -10, -8, -6, -4],
               extra=lips(0, 1, open_=0.6, breathe=0))
    sag = rel([12, 16, 20, 20, 20, 20, 22, 22, 22, 22], extra=lips(0, 1, close=0.6, breathe=0))
    sag['Root.loc'] = (0, -0.3, 0)
    sag['Maw.loc'] = (0, -0.1, 0)
    sink = rel([16, 20, 24, 24, 26, 26, 28, 28, 28, 28], extra=lips(0, 1, close=1.0, breathe=0))
    sink['Root.loc'] = (0, -1.6, 0)
    sink['Maw.loc'] = (0, -0.5, 0)
    gone = dict(sink)
    gone['Root.loc'] = (0, -2.95, 0)
    gone['Maw.loc'] = (0, -0.95, 0)
    return [(0.0, i0), (0.2, thr1), (0.4, thr2), (0.7, sag), (1.1, sink), (1.5, gone), (1.8, gone)]


@clip('Rise', 1.0, events={'up': 0.7}, shots=[0, 0.2, 0.4, 0.55, 0.7, 1.0])
def c_rise():
    i0 = idle_pose(0)
    under = rel([16, 20, 24, 24, 26, 26, 28, 28, 28, 28], extra=lips(0, 1, close=1.0, breathe=0))
    under['Root.loc'] = (0, -2.95, 0)
    under['Maw.loc'] = (0, -0.95, 0)
    up = rel([-4, -6, -6, -4, -2, 0, 4, 8, 10, 10], extra=lips(0, 1, open_=0.5, breathe=0))
    up['Root.loc'] = (0, -0.5, 0)
    up['Maw.loc'] = (0, -0.1, 0)
    rear = rel([-6, -8, -8, -6, -4, -2, 6, 14, 18, 18], extra=lips(0, 1, open_=0.8, breathe=0))
    return [(0.0, under), (0.45, up), (0.7, rear), (1.0, i0)]


def author(arm):
    acts = []
    for c in CLIPS:
        keys = c['fn']()
        act = S.make_action(arm, c['name'], keys, loop=c['loop'])
        acts.append(act)
    S.rest(arm)
    return acts


# ================================================================ the Deep Maw's instances
def instance_tf(k):
    a = math.radians(TENT_ANGLES[k])
    pos = Vector((R_TENT * math.cos(a), R_TENT * math.sin(a), 0.0))
    target = Vector((0.0, -3.0, 0.0))
    d = (target - pos)
    d.z = 0
    d.normalize()
    yaw = math.atan2(d.x, -d.y)
    tilt_axis = Vector((-math.sin(a), math.cos(a), 0.0))
    m = Matrix.Rotation(math.radians(9.0), 3, tilt_axis) @ Matrix.Rotation(yaw, 3, 'Z')
    offset = [0.0, 0.45, 0.9, 1.35, 1.8][k]
    return pos, m, offset


def gltf_tf(pos, m):
    q = m.to_quaternion()
    return [round(pos.x, 4), round(pos.z, 4), round(-pos.y, 4)], [round(q.x, 5), round(q.z, 5), round(-q.y, 5), round(q.w, 5)]


# ================================================================ review
def variant_objects(col, arm, body, maw, name, at=(0, 0, 0), rot=0.0, act=None, offset=0):
    """A copy of the rig (+ body or the Maw's plate and five instances) for one variant, placed and playing `act`."""
    v = VARIANTS[name]
    objs = []
    s = v['scale']

    def copy_rig(tag):
        a2 = arm.copy()
        a2.data = arm.data
        a2.name = 'Rig.%s' % tag
        col.objects.link(a2)
        return a2

    def copy_mesh(src, a2, tag, shapes=None):
        o2 = src.copy()
        o2.data = src.data.copy()
        o2.name = '%s.%s' % (src.name, tag)
        col.objects.link(o2)
        o2.parent = a2
        o2.modifiers['Armature'].object = a2
        S.set_material(o2, v['palette'], name='GV_%s' % name)
        if o2.data.shape_keys:
            for kb in o2.data.shape_keys.key_blocks[1:]:
                kb.value = (shapes or {}).get(kb.name, 0.0)
        o2.hide_render = False
        return o2
    root = bpy.data.objects.new('V.%s' % name, None)
    col.objects.link(root)
    root.location = at
    root.rotation_euler = (0, 0, math.radians(rot))
    root.scale = (s, s, s)
    if name == 'deep-maw':
        a2 = copy_rig(name + '.plate')
        a2.parent = root
        objs += [a2, copy_mesh(maw, a2, name + '.plate')]
        if act:
            S.assign(a2, act, slot_src=arm)
        for k in range(5):
            pos, m, off = instance_tf(k)
            ak = copy_rig('%s.%d' % (name, k))
            ak.parent = root
            ak.matrix_basis = Matrix.Translation(pos) @ m.to_4x4()
            objs += [ak, copy_mesh(body, ak, '%s.%d' % (name, k))]
            if act:
                S.assign(ak, act, slot_src=arm, offset_frames=round(off * S.FPS) if act.use_cyclic else 0)
    else:
        a2 = copy_rig(name)
        a2.parent = root
        objs += [a2, copy_mesh(body, a2, name, v['shapes'])]
        if act:
            S.assign(a2, act, slot_src=arm, offset_frames=offset)
    return root, objs


def remove(objs):
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)


def review(arm, body, maw, acts, tris):
    rv = S.Review(OUT, quick=QUICK, floor_color=(0.03, 0.045, 0.05))
    col = bpy.data.collections.new('Review')
    bpy.context.scene.collection.children.link(col)
    body.hide_render = True
    maw.hide_render = True
    made = []
    idle = bpy.data.actions['Idle']
    # ---- lineup: hero, deep-tentacle, naesa-arm, deep-maw (at scale; Idle at 0.6 s)
    bpy.context.scene.frame_set(18)
    rv.hero.hide_render = False
    rv.hero.location = (-1.6, 0, 0)
    placed = []
    for name, x in (('deep-tentacle', 0.0), ('naesa-arm', 1.9), ('deep-maw', 5.6)):
        root, objs = variant_objects(col, arm, body, maw, name, at=(x, 0, 0), act=idle)
        placed.append((name, root, objs, x))
    bpy.context.scene.frame_set(18)
    pts = [Vector(p) for p in ((-2.0, -0.5, 0), (-1.2, 0.5, 1.8))]
    for _n, _r, objs, _x in placed:
        pts += S.world_points(objs, step=7)
    rv.label3d('hero 1.8 m', (-1.6, -0.9, 0.02), size=0.16)
    for name, root, objs, x in placed:
        t = tris['maw_total'] if name == 'deep-maw' else tris['body']
        rv.label3d('%s\n%.1fx  %s tris' % (name, VARIANTS[name]['scale'], format(t, ',')),
                   (x, -2.6 if name == 'deep-maw' else -0.9, 0.02), size=0.14)
    rv.fit(pts + [Vector((x, -2.6, 0)) for x in (4.0, 6.0)], az=12, el=16, lens=40, aspect=1.0)
    made.append(rv.shot('lineup.png', w=1600 if not QUICK else 1200, h=800 if not QUICK else 600))
    rv.clear_labels()
    rv.hero.hide_render = True
    for _n, root, objs, _x in placed:
        remove(objs + [root])
    # ---- Naesa's arms: two naesa-arm variants hung from the hero rig's upper-arm joints (a check for the humanoid pass)
    made.append(naesa_attach(rv, col, arm, body, maw))
    # ---- 200-px card reads, one per variant
    reads = []
    for name in VARIANTS:
        root, objs = variant_objects(col, arm, body, maw, name, act=idle)
        bpy.context.scene.frame_set(18)
        rv.fit(S.world_points(objs, step=5), az=32, el=20, lens=50)
        big = rv.shot('_card_%s.png' % name, size=512 if QUICK else 1024)
        reads.append(rv.downscale(big, os.path.join(OUT, 'read200_%s.png' % name), 200))
        remove(objs + [root])
    made.append(rv.sheet(reads, os.path.join(OUT, 'read200_sheet.png'), cols=len(reads)))
    # ---- clip strips: the Deep Tentacle and the Deep Maw as two rows of each clip
    for act in acts:
        c = next(c for c in CLIPS if c['name'] == act.name)
        frames = [round(t * S.FPS) for t in c['shots']]
        state = {}

        def place(row, act=act):
            for o in state.get('objs', []) + ([state['root']] if 'root' in state else []):
                bpy.data.objects.remove(o, do_unlink=True)
            state['root'], state['objs'] = variant_objects(col, arm, body, maw, row, act=act)

        def bounds(row):
            return S.world_points(state['objs'], step=6)

        def label(row, fr, c=c):
            t = fr / S.FPS
            ev = [k for k, v in c['events'].items() if abs(v - t) < 0.02]
            return '%s · %s\n%.2f s  f%d  %s' % (c['name'], row, t, fr, ' '.join(ev))
        made.append(rv.strip('clip_%s' % act.name, frames, bounds, place, label, rows=['deep-tentacle', 'deep-maw'],
                              az=58, el=12, lens=45))
        remove(state['objs'] + [state['root']])
    # ---- the fight read: four heroes on the left, the encounters on the right
    for enc, members in (('fight_from_the_deep', [('deep-tentacle', 1.25, -0.5, 0), ('deep-tentacle', 1.25, 0.6, 20)]),
                         ('fight_the_maw', [('deep-maw', 3.0, 0.4, 0), ('deep-tentacle', 1.1, -1.2, 10)])):
        made.append(fight(rv, col, arm, body, maw, enc, members))
    return made


def naesa_attach(rv, col, arm, body, maw):
    from mathutils import Quaternion
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(S.MODELS, 'hero', 'hero_broad.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    hero_rig = next(o for o in new if o.type == 'ARMATURE')
    joints = {}
    for side in ('Left', 'Right'):
        b = hero_rig.data.bones[side + 'UpperArm']
        joints[side] = (hero_rig.matrix_world @ b.head_local, hero_rig.matrix_world @ b.tail_local)
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    rv.hero.hide_render = False
    rv.hero.location = (0, 0, 0)
    placed = []
    idle = bpy.data.actions['Idle']
    for k, (side, (h, t)) in enumerate(joints.items()):
        root, objs = variant_objects(col, arm, body, maw, 'naesa-arm', at=tuple(h), act=idle, offset=k * 20)
        root.rotation_mode = 'QUATERNION'
        root.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((t - h).normalized())
        placed.append((root, objs))
    bpy.context.scene.frame_set(24)
    pts = S.world_points([rv.hero], step=10)
    for _r, objs in placed:
        pts += S.world_points(objs, step=4)
    rv.fit(pts, az=20, el=8, lens=50)
    path = rv.shot('naesa_attach.png', size=512 if QUICK else 900)
    rv.hero.hide_render = True
    for r, objs in placed:
        remove(objs + [r])
    return path


def fight(rv, col, arm, body, maw, name, members):
    import bpy_extras
    sc = bpy.context.scene
    heroes = []
    for x, y in ((-1.35, -0.48), (-1.35, 0.48), (-2.55, -0.48), (-2.55, 0.48)):
        h = rv.hero.copy()
        col.objects.link(h)
        h.hide_render = False
        h.location = (x, y, 0)
        h.rotation_euler = (0, 0, math.radians(S.fight_rot('party')))
        heroes.append(h)
    placed = []
    idle = bpy.data.actions['Idle']
    for (vn, x, y, off) in members:
        root, objs = variant_objects(col, arm, body, maw, vn, at=(x, y, 0), rot=S.fight_rot('enemy'), act=idle, offset=off)
        placed.append((root, objs))
    sc.frame_set(20)
    S.set_outline([o for _r, objs in placed for o in objs], 0.016)
    pts = S.world_points(heroes, step=9)
    for _r, objs in placed:
        pts += S.world_points(objs, step=5)
    xs = [p.x for p in pts]
    centre = Vector(((min(xs) + max(xs)) / 2, 0.0, 0.9))
    sc.render.resolution_x, sc.render.resolution_y = S.FIGHT_W, S.FIGHT_H
    d = S.fight_distance()
    for _i in range(40):
        S.fight_camera(rv.stage, centre, d)
        bpy.context.view_layer.update()
        ok = True
        for p in pts:
            co = bpy_extras.object_utils.world_to_camera_view(sc, rv.stage.cam, p)
            if not (0.03 <= co.x <= 0.97 and 0.03 <= co.y <= 0.97):
                ok = False
                break
        if ok:
            break
        d *= 1.05
    path = rv.shot(name + '.png', w=S.FIGHT_W, h=S.FIGHT_H)
    rv.camera_ortho_off()
    for h in heroes:
        bpy.data.objects.remove(h, do_unlink=True)
    for root, objs in placed:
        remove(objs + [root])
    log('fight read %s: camera %.2f m (hero-share distance %.2f m)' % (name, d, S.fight_distance()))
    return path


# ================================================================ export
def export(arm, body, maw, acts):
    from export import export_glb, reimport_report
    S.strip_rest([arm, body, maw])
    for ob in (body, maw):
        S.finish(ob)
        toon_remove = [m for m in ob.modifiers if m.name == 'Outline']
        for m in toon_remove:
            ob.modifiers.remove(m)
    S.stash(arm, acts)
    body['kind'] = 'monster'
    body['base'] = BASE
    maw['kind'] = 'part'
    maw['base'] = BASE
    maw['part'] = 'tentacle_maw'
    bpy.context.view_layer.update()
    path = os.path.join(S.MON, BASE + '.glb')
    kb = export_glb(path, [arm, body, maw], animations=True, animation_mode='ACTIONS',
                    extra={'export_optimize_animation_size': True, 'export_optimize_animation_keep_anim_armature': True,
                           'export_merge_animation': 'ACTION'})
    return path, kb


def main():
    common.clear_scene()
    sc = bpy.context.scene
    sc.render.fps = S.FPS
    col = common.collection('Tentacle')
    arm = build_rig(col)
    mb_body, body = build_body(col)
    mb_maw, maw = build_maw(col)
    S.apply_weights(body, mb_body, arm)
    S.apply_weights(maw, mb_maw, arm)
    # var_arm: the slimmer root of Naesa's arms
    arm_pos = []
    for co, d in zip(mb_body.co, mb_body.data):
        k = arm_factor(max(0.0, co.z))
        # below the root (the part that stays under the water) folds into the joint, so an arm starts at the shoulder
        z = co.z if co.z >= 0 else co.z * 0.12
        if co.z < 0:
            k *= 0.75
        arm_pos.append(Vector((co.x * k, co.y * k, z)))
    S.add_keys(body, [('var_arm', arm_pos)])
    for ob in (body, maw):
        S.look(ob, VARIANTS['deep-maw']['palette'])
    acts = author(arm)
    tris = {'body': common.tri_count(body), 'maw': common.tri_count(maw)}
    for ob in (body, maw):
        if 'Outline' in ob.modifiers:
            ob.modifiers['Outline'].show_viewport = False
    tris = {'body': S.tri_count([body]), 'maw': S.tri_count([maw])}
    tris['maw_total'] = tris['maw'] + 5 * tris['body']
    for ob in (body, maw):
        if 'Outline' in ob.modifiers:
            ob.modifiers['Outline'].show_viewport = True
    log('tris', tris)
    # where the slam lands (the tip at Attack1's hit frame) — logged for the round notes
    act = bpy.data.actions['Attack1']
    S.assign(arm, act)
    sc.frame_set(15)
    tip = arm.matrix_world @ arm.pose.bones['T_10'].tail
    log('Attack1 hit: tip at y %.2f z %.2f' % (tip.y, tip.z))
    act = bpy.data.actions['Attack2']
    S.assign(arm, act)
    sc.frame_set(round(0.55 * S.FPS))
    tip = arm.matrix_world @ arm.pose.bones['T_07'].head
    log('Attack2 wrap: coil at y %.2f z %.2f' % (tip.y, tip.z))
    S.unassign(arm)
    S.rest(arm)
    if RENDER:
        made = review(arm, body, maw, acts, tris)
        log('renders:', ', '.join(os.path.basename(p) for p in made))
    # back to the base objects for export
    for o in list(bpy.data.objects):
        if '.' in o.name and (o.name.startswith('Rig.') or o.name.startswith('tentacle_')) or o.name.startswith('V.'):
            bpy.data.objects.remove(o, do_unlink=True)
    common.save_blend(os.path.join(BUILD, 'tentacle.blend'))
    path, kb = export(arm, body, maw, acts)
    # manifest + clips
    entries = {}
    for name, v in VARIANTS.items():
        e = dict(base=BASE, scale=v['scale'], parts=v['parts'], shapes=v['shapes'], palette=v['palette'],
                 clipSpeed=v['clipSpeed'])
        if name == 'deep-maw':
            inst = []
            for k in range(5):
                pos, m, off = instance_tf(k)
                p, q = gltf_tf(pos, m)
                inst.append({'mesh': 'tentacle_body', 'position': p, 'rotation': q, 'scale': 1.0, 'clipOffset': off})
            e['instances'] = inst
            e['note'] = 'tentacle_body is drawn only at the five instances (glTF axes, the plate origin); the plate is tentacle_maw'
            e['tris'] = tris['maw_total']
        elif name == 'naesa-arm':
            e['attach'] = {'sockets': ['LeftUpperArm', 'RightUpperArm'], 'rootBone': 'T_01', 'tipBone': 'T_10',
                           'note': ('put the tentacle Rig node at the hero upper-arm bone head, rotated so the Rig +Y (glTF up, '
                                    'the chain) runs along the bone +Y (down the arm); scale 0.6 x the wearer; drop the arm regions '
                                    '(upperArms, forearms, hands); var_arm folds the under-water root into the joint; the arm '
                                    'plays the tentacle clips on its own Rig (render: art/renders/monsters/tentacle/naesa_attach.png)')}
            e['tris'] = tris['body']
        else:
            e['tris'] = tris['body']
        entries[name] = e
    S.write_manifest(entries)
    S.write_clips(BASE, 'skeletal', [dict(name=c['name'], seconds=c['seconds'], loop=c['loop'], events=c['events'])
                                     for c in CLIPS], extra={'rig': 'Rig', 'bones': len(arm.data.bones)})
    S.inspect(path)
    lines = reimport(path)
    for ln in lines:
        log(ln)


def reimport(path):
    from export import reimport_report
    lines = reimport_report(path, os.path.join(OUT, 'reimport_check.png') if RENDER else None)
    # play a clip on the re-imported rig: the tip must move
    arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    if arm and 'Attack1' in bpy.data.actions:
        act = bpy.data.actions['Attack1']
        adt = arm.animation_data or arm.animation_data_create()
        adt.action = act
        adt.action_slot = act.slots[0]
        sc = bpy.context.scene
        sc.frame_set(0)
        a = (arm.matrix_world @ arm.pose.bones['T_10'].tail).copy()
        fps = sc.render.fps
        sc.frame_set(round(0.5 * fps))
        b = (arm.matrix_world @ arm.pose.bones['T_10'].tail).copy()
        lines.append('  - re-imported Attack1 moves the tip %.2f m (frame 0 → hit)' % (a - b).length)
    return lines


main()

"""build_leech.py — the leech base (06 §3.5): the Vault Leech, the hunter that answers the Leech Jar and the Hollow King.

Run:  blender -b -P tools/blender/monsters/build_leech.py -- [--quick] [--no-renders]

A segmented leech ~4 m long lying in the water with its front third reared up, ending in a round sucker-mouth as wide as
a hero: rings of round teeth (slot 13) on pink gums (1) round a black throat (5); a bloated sack behind the middle with
swallowed lantern-light glowing through it (11, emissive — the manifest's `slots` colours it); a pale belly (2).
Rig: `Root` (on the floor, pointing forward) → `L_01` (tail) … `L_12` (neck) → `Head` (the mouth disc) with six
radial `Lip_*` bones that open (−X peels the rim back, Y-scale > 1 widens it) and clamp (+X), and a leaf bone `Sack`
whose scale puffs the sack (leaf bones only are scaled: three.js inherits scale down a chain). Clips (skeletal):
Idle (searching sway), Move (inchworm), Attack1 (latch), Attack2 (bloat slam), Hit, Death.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import spirit_lib as S  # noqa: E402
from spirit_lib import MB, smoothstep  # noqa: E402

import common  # noqa: E402
from common import BUILD, RENDERS, log  # noqa: E402

A = S.args()
QUICK = bool(A.get('quick'))
RENDER = not A.get('no_renders')
BASE = 'leech'
OUT = os.path.join(RENDERS, 'monsters', BASE)

VARIANTS = {
    'vault-leech': dict(scale=1.0, parts=[], shapes={}, palette=['#5b3f6e', '#d9788c', '#c9d98f'],
                        slots={'11': '#c8f08a'}, clipSpeed=1.0),
}

CTRL = [(0, 2.20, 0.105), (0, 1.72, 0.245), (0, 1.05, 0.29), (0, 0.38, 0.25), (0, -0.22, 0.215), (0, -0.62, 0.36),
        (0, -0.90, 0.78), (0, -1.05, 1.20), (0, -1.22, 1.48), (0, -1.46, 1.60)]
DENSE, LTOT = S.catmull(CTRL, 600)
NSEG = 20
NCH = 12
CHAIN = ['L_%02d' % (i + 1) for i in range(NCH)]
LIPS = ['Lip_%d' % (i + 1) for i in range(6)]
S_HEAD = LTOT - 0.32         # where the Head bone starts (the neck)
R_PROF = [(0.0, 0.07), (0.06, 0.17), (0.18, 0.36), (0.30, 0.43), (0.42, 0.38), (0.55, 0.31), (0.68, 0.28), (0.80, 0.25),
          (0.90, 0.235), (0.95, 0.28), (0.985, 0.40), (1.0, 0.46)]
SACK_S = (0.18, 0.44)        # the sack spans these fractions of the length


def rprof(u):
    u = max(0.0, min(1.0, u))
    for (u0, r0), (u1, r1) in zip(R_PROF, R_PROF[1:]):
        if u <= u1:
            t = (u - u0) / (u1 - u0)
            t = t * t * (3 - 2 * t)
            return r0 + (r1 - r0) * t
    return R_PROF[-1][1]


def at(s):
    """Centre, tangent, lateral u and dorsal v at arc length s (u × v = tangent)."""
    pts, _ = S.resample(DENSE, [max(0.0, s - 0.02), s, min(LTOT, s + 0.02)])
    t = (pts[2] - pts[0]).normalized()
    d = Vector((0.0, t.z, -t.y)).normalized()     # dorsal: up on the flat part, back on the reared part
    u = d.cross(t).normalized()
    return pts[1], t, u, d


# the chain: knots evenly spaced in arc length from the tail to the neck, then the head
KN = [S_HEAD * (k / NCH) ** 0.92 for k in range(NCH + 1)] + [LTOT]
NAMES = CHAIN + ['Head']


def weights_at(s):
    return S.chain_weights(s, KN, NAMES, blend=0.5)


def sack_amount(s):
    u = s / LTOT
    a, b = SACK_S
    m = (a + b) / 2
    h = (b - a) / 2
    return max(0.0, 1 - ((u - m) / h) ** 2) if a <= u <= b else 0.0


# ================================================================ the mesh
# swallowed lantern-light glowing through the sack: (fraction of the length, angle round the body, radius)
LIGHTS = [(0.235, 62, 0.085), (0.265, 128, 0.07), (0.30, 40, 0.06), (0.315, 98, 0.095), (0.35, 150, 0.065),
          (0.365, 28, 0.07), (0.395, 112, 0.075), (0.28, 172, 0.05), (0.33, 8, 0.05)]
ANNULUS = 0.13               # one ring segment of the body; three mesh rings each (round 1's two made a saw-tooth)


def body_slot(s, th_deg, ring_k):
    # the pale belly (the reared front shows it to the party)
    if abs(((th_deg + 90 + 180) % 360) - 180) < 46:
        return 2
    return 0


def surface_at(s, th_deg):
    """A point on the body's surface and its outward normal (for the lights)."""
    c, t, u, d = at(s)
    r = rprof(s / LTOT) * (1 + 0.12 * sack_amount(s))
    th = math.radians(th_deg)
    rx, ry = 1.15 * r, 0.9 * r * (1 - 0.25 * max(0.0, -math.sin(th)) ** 2)
    p = c + u * (rx * math.cos(th)) + d * (ry * math.sin(th))
    n = (u * (math.cos(th) / rx) + d * (math.sin(th) / ry)).normalized()
    return p, n, t


def light(mb, s_frac, th_deg, rad):
    s = s_frac * LTOT
    p, n, t = surface_at(s, th_deg)
    b = n.cross(t).normalized()
    w = weights_at(s)
    sk = sack_amount(s)
    if sk > 0:
        w = {k2: x * (1 - 0.55 * sk) for k2, x in w.items()}
        w['Sack'] = 0.55 * sk
    m = 8

    def ring(r_, h):
        return [mb.v(p + t * (r_ * math.cos(2 * math.pi * i / m)) + b * (r_ * math.sin(2 * math.pi * i / m)) + n * h, w=w)
                for i in range(m)]
    skirt = ring(rad * 1.55, -0.02)
    halo = ring(rad * 1.45, 0.012)
    lens = ring(rad, 0.022)
    top = mb.v(p + n * 0.034, w=w)
    mb.begin('light')
    mb.bridge(skirt, halo, 2)
    mb.bridge(halo, lens, 2)
    mb.fan(lens, top, 11)
    f = mb.end()
    mb.orient(f, p - n * 0.3)


def build_body(col):
    mb = MB()
    # ring positions: the tail cap, annuli every 6.5 cm, finer rings into the mouth flare
    ss = [0.0, 0.025, 0.06]
    s = 0.10
    while s < LTOT - 0.30:
        ss.append(s)
        s += ANNULUS / 3
    for f in (0.28, 0.2, 0.13, 0.07, 0.03, 0.0):
        ss.append(LTOT - f)
    rings, ring_s = [], []
    for k, s in enumerate(ss):
        c, t, u, d = at(s)
        r = rprof(s / LTOT)
        if s < 0.07:
            r = rprof(0.07 / LTOT) * math.sqrt(max(0.0, 1 - ((0.07 - s) / 0.075) ** 2)) + 0.015
        if 0.08 < s < LTOT - 0.35:
            r *= 1 + 0.04 * math.cos(2 * math.pi * (s - 0.10) / ANNULUS)
        r *= 1 + 0.12 * sack_amount(s)
        ring = []
        w = weights_at(s)
        sk = sack_amount(s)
        if sk > 0:
            w = {k2: x * (1 - 0.55 * sk) for k2, x in w.items()}
            w['Sack'] = 0.55 * sk
        for i in range(NSEG):
            th = math.radians(-90 + i * 360 / NSEG)
            rx = 1.15 * r
            ry = 0.9 * r * (1 - 0.25 * max(0.0, -math.sin(th)) ** 2) if s < LTOT - 0.4 else r
            p = c + u * (rx * math.cos(th)) + d * (ry * math.sin(th))
            ring.append(mb.v(p, w=w, s=s))
        rings.append(ring)
        ring_s.append(s)
    mb.begin('body')
    tail = mb.v(at(0.0)[0] - at(0.0)[1] * 0.03, w=weights_at(0.0), s=0.0)
    mb.fan(rings[0], tail, 0, flip=True)
    for k in range(len(rings) - 1):
        s0 = ring_s[k]
        mb.bridge(rings[k], rings[k + 1], lambda i, s0=s0, k=k: body_slot(s0, -90 + (i + 0.5) * 360 / NSEG, k))
    body = mb.end()
    mb.orient(body, lambda c: nearest_axis(c))
    for sf, th_deg, rad in LIGHTS:
        light(mb, sf, th_deg, rad)
    # the mouth: the rim lip, gum rings with three rings of round teeth, the throat
    c, t, u, d = at(LTOT)
    rim = rings[-1]
    prof = [(0.47, 0.035, 1), (0.40, 0.06, 1), (0.30, 0.03, 1), (0.20, -0.01, 1), (0.11, -0.06, 5), (0.06, -0.22, 5)]
    prev = rim
    mb.begin('mouth')
    for rad, fwd, slot in prof:
        ring = []
        for i in range(NSEG):
            th = math.radians(-90 + i * 360 / NSEG)
            p = c + t * fwd + u * (rad * math.cos(th)) + d * (rad * math.sin(th))
            ring.append(mb.v(p, w=mouth_weights(rad, th), s=LTOT))
        mb.bridge(prev, ring, slot)
        prev = ring
    throat = mb.v(c - t * 0.34, w={'Head': 1.0}, s=LTOT)
    mb.fan(prev, throat, 5)
    mouth = mb.end()
    mb.orient(mouth, c - t * 0.6)
    for count, rad, fwd, h, inward in ((18, 0.355, 0.05, 0.075, 0.35), (14, 0.25, 0.02, 0.07, 0.45), (10, 0.155, -0.03, 0.06, 0.55)):
        for i in range(count):
            th = math.radians(-90 + (i + 0.5) * 360 / count)
            radial = u * math.cos(th) + d * math.sin(th)
            base = c + t * fwd + radial * rad
            dirn = (t * (1 - inward) - radial * inward).normalized()
            tooth(mb, base, dirn, radial, h, 0.034, mouth_weights(rad, th))
    log('leech_body: %d tris' % mb.tris())
    return mb, mb.build('leech_body', col)


def tooth(mb, base, dirn, radial, h, width, w):
    side = dirn.cross(radial).normalized()
    up = side.cross(dirn).normalized()
    n = 5
    ring = []
    for i in range(n):
        a = 2 * math.pi * i / n
        ring.append(mb.v(base - dirn * 0.01 + side * (width * math.cos(a)) + up * (width * math.sin(a)), w=w))
    mid = []
    for i in range(n):
        a = 2 * math.pi * i / n
        mid.append(mb.v(base + dirn * (h * 0.55) + side * (width * 0.75 * math.cos(a)) + up * (width * 0.75 * math.sin(a)), w=w))
    tip = mb.v(base + dirn * h, w=w)
    mb.begin('tooth')
    mb.bridge(ring, mid, 13)
    mb.fan(mid, tip, 13)
    f = mb.end()
    mb.orient(f, lambda c, base=base, dirn=dirn: base + dirn * (c - base).dot(dirn))


def nearest_axis(c):
    best = None
    for p in DENSE[::4]:
        dd = (p - c).length_squared
        if best is None or dd < best[0]:
            best = (dd, p)
    return best[1]


def mouth_weights(rad, th):
    a = (math.degrees(th) - 90) % 360           # Lip_1 points up (dorsal), then every 60°
    k0 = int(a // 60) % 6
    k1 = (k0 + 1) % 6
    f1 = (a - k0 * 60) / 60
    lip = smoothstep(0.10, 0.30, rad)
    w = {'Head': 1 - lip}
    w[LIPS[k0]] = lip * (1 - f1)
    w[LIPS[k1]] = w.get(LIPS[k1], 0) + lip * f1
    return w


# ================================================================ rig
def build_rig(col):
    bones = [('Root', (0, 0, 0), (0, -0.3, 0), None, (0, 0, 1))]
    prev = 'Root'
    for k, nm in enumerate(NAMES):
        h = at(KN[k])
        tl = at(KN[k + 1])
        mid = at((KN[k] + KN[k + 1]) / 2)
        bones.append((nm, tuple(h[0]), tuple(tl[0]), prev, tuple(mid[3])))
        prev = nm
    c, t, u, d = at(LTOT)
    for j, nm in enumerate(LIPS):
        a = math.radians(90 + 60 * j)
        radial = u * math.cos(a) + d * math.sin(a)
        bones.append((nm, tuple(c), tuple(c + radial * 0.46), 'Head', tuple(t)))
    sc, st, su, sd = at(LTOT * (SACK_S[0] + SACK_S[1]) / 2)
    bones.append(('Sack', tuple(sc), tuple(sc + sd * 0.35), CHAIN[3], tuple(-st)))
    return S.make_rig('Rig', bones, col)


def rest_bends():
    """Each chain bone's rest bend from its parent (degrees, + toward the back): flattening the front undoes them."""
    out = []
    prev = None
    for k in range(len(NAMES)):
        _c, t, _u, _d = at((KN[k] + KN[k + 1]) / 2)
        ph = math.degrees(math.atan2(t.z, -t.y))
        out.append(0.0 if prev is None else ph - prev)
        prev = ph
    return out


BENDS = None


# ================================================================ clips
def mouth(open_=0.0, clamp=0.0, t=0.0, T=1.0, breathe=0.0):
    p = {}
    for j, nm in enumerate(LIPS):
        b = breathe * math.sin(2 * math.pi * t / T + j * 1.05)
        p[nm] = (-34 * open_ + 26 * clamp + 4 * b, 0, 0)
        p[nm + '.scl'] = (1, 1 + 0.25 * open_ - 0.12 * clamp + 0.03 * b, 1)
    return p


def pose(x=None, z=None, y=None, root=(0, 0, 0), root_loc=None, sack=1.0, extra=None):
    p = {'Root': root}
    if root_loc:
        p['Root.loc'] = root_loc
    for i, nm in enumerate(NAMES):
        p[nm] = ((x[i] if x else 0), (y[i] if y else 0), (z[i] if z else 0))
    p['Sack.scl'] = sack
    p.update(extra or {})
    return p


def front(f):
    """Weights 0..1 over the chain: 0 on the flat body, rising toward the head (the reared part)."""
    return [smoothstep(5, 11, i) for i in range(len(NAMES))] if f is None else [f(i) for i in range(len(NAMES))]


def idle_pose(t, T=2.8):
    n = len(NAMES)
    x = [0.0] * n
    z = [0.0] * n
    for i in range(n):
        k = i / (n - 1)
        ang = 2 * math.pi * t / T - 0.45 * i
        z[i] = (1.0 + 5.0 * smoothstep(0.45, 1.0, k)) * math.sin(ang)
        x[i] = 2.5 * smoothstep(0.55, 1.0, k) * math.sin(2 * ang + 0.6)
    sack = 1 + 0.06 * math.sin(2 * math.pi * t / T)
    return pose(x, z, sack=sack, extra=mouth(t=t, T=T, breathe=1.0))


def move_pose(t, T=1.6):
    # inchworm: the middle humps up while the front reaches, then flattens while the front plants
    ph = 2 * math.pi * t / T
    hump = 0.5 - 0.5 * math.cos(ph)            # 0 → flat, 1 → arched
    n = len(NAMES)
    x = [0.0] * n
    # relative bends that rise, fall and level out again (they sum to zero over the flat body: the front stays down)
    shape = [0, 16, 16, -16, -32, -16, 16, 16, 0, 0, 0, 0, 0]
    for i in range(n):
        x[i] = shape[i] * hump
    x[9] += -6 * hump + 4 * (1 - hump)
    x[10] += 6 * hump - 4 * (1 - hump)
    x[12] += -6 * hump
    z = [2.0 * math.sin(ph - 0.4 * i) * (i / n) for i in range(n)]
    p = pose(x, z, root_loc=(0, 0.12 * math.sin(ph), 0), sack=1 + 0.05 * hump,
             extra=mouth(open_=0.25 * (1 - hump), clamp=0.3 * hump))
    return p


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


@clip('Idle', 2.8, loop=True, shots=[0, 0.47, 0.93, 1.4, 1.87, 2.33])
def c_idle():
    return sampled(2.8, idle_pose)


@clip('Move', 1.6, loop=True, shots=[0, 0.27, 0.53, 0.8, 1.07, 1.33])
def c_move():
    return sampled(1.6, move_pose)


def flat_front(f, lift=0.0):
    """x angles that lay the reared front down by fraction f (and lift the head by `lift` degrees at the neck)."""
    return [-BENDS[i] * f * smoothstep(4, 9, i) for i in range(len(NAMES))]


def add(a, b):
    return [x + y for x, y in zip(a, b)]


@clip('Attack1', 1.2, events={'hit': 0.55}, shots=[0, 0.3, 0.45, 0.55, 0.75, 1.0])
def c_attack1():
    i0 = idle_pose(0)
    n = len(NAMES)
    rear = [0, 0, 0, 0, 0, 0, 0, 4, 8, 10, 10, 8, 6]
    wind = pose([0, 0, 0, 0, 0, 0, 0, 4, 8, 8, -4, -14, -20], sack=1.04, extra=mouth(open_=0.6))
    lunge_x = add(flat_front(0.40), [0, 0, 0, 0, 0, 0, 0, 0, -6, -8, 4, 14, 20])
    lunge = pose(lunge_x, root_loc=(0, 0.35, 0), sack=0.97, extra=mouth(open_=1.0))
    clamp_ = pose(lunge_x, root_loc=(0, 0.38, 0), y=[0] * 10 + [4, 6, 8], sack=0.95, extra=mouth(clamp=1.0))
    grind = pose(lunge_x, root_loc=(0, 0.36, 0), y=[0] * 10 + [-4, -6, -8], sack=0.96, extra=mouth(clamp=0.9))
    back = pose([0, 0, 0, 0, 0, 0, 0, 2, 3, 3, 2, 1, 0], sack=1.0, extra=mouth(open_=0.2))
    return [(0.0, i0), (0.3, wind), (0.45, lunge), (0.55, clamp_), (0.75, grind), (1.0, back), (1.2, i0)]


@clip('Attack2', 1.4, events={'hit': 0.7}, shots=[0, 0.3, 0.45, 0.62, 0.7, 0.95])
def c_attack2():
    i0 = idle_pose(0)
    up = pose([0, 0, 0, 0, 0, 2, 6, 12, 14, 8, -12, -26, -32], sack=1.28, extra=mouth(open_=0.8))
    peak = pose([0, 0, 0, 0, 2, 4, 9, 16, 16, 8, -14, -28, -36], sack=1.32, extra=mouth(open_=1.0))
    slam_x = add(flat_front(0.82), [0, 0, 0, 0, 0, 0, 0, -2, -4, -4, -4, -2, 0])
    slam = pose(slam_x, root_loc=(0, 0.2, 0), sack=0.92, extra=mouth(clamp=0.7))
    bounce = pose(add(flat_front(0.8), [0] * 13), root_loc=(0, 0.15, 0), sack=1.02, extra=mouth(open_=0.3))
    return [(0.0, i0), (0.3, up), (0.45, peak), (0.62, mix_pose(peak, slam, 0.7)), (0.7, slam), (0.95, bounce), (1.4, i0)]


def mix_pose(a, b, t):
    out = {}
    for k in set(a) | set(b):
        dv = 1.0 if k.endswith('.scl') else 0.0
        va = a.get(k, (dv, dv, dv) if not k.endswith('.scl') else 1.0)
        vb = b.get(k, (dv, dv, dv) if not k.endswith('.scl') else 1.0)
        if isinstance(va, (int, float)) and isinstance(vb, (int, float)):
            out[k] = va + (vb - va) * t
        else:
            va = (va, va, va) if isinstance(va, (int, float)) else va
            vb = (vb, vb, vb) if isinstance(vb, (int, float)) else vb
            out[k] = tuple(x + (y - x) * t for x, y in zip(va, vb))
    return out


@clip('Hit', 0.5, shots=[0, 0.08, 0.16, 0.25, 0.36, 0.5])
def c_hit():
    i0 = idle_pose(0)
    jolt = pose([0, 0, 0, 0, 0, 0, 0, 3, 6, 8, 10, 10, 8], z=[0, 2, -3, 4, -4, 4, -3, 3, 4, 5, 6, 6, 4], sack=1.08,
                extra=mouth(clamp=1.0))
    over = pose([0, 0, 0, 0, 0, 0, 0, -1, -2, -3, -3, -2, -1], z=[0, -1, 2, -2, 2, -2, 2, -2, -2, -3, -3, -3, -2],
                extra=mouth(open_=0.2))
    return [(0.0, i0), (0.08, jolt), (0.22, over), (0.5, i0)]


@clip('Death', 2.0, events={'down': 1.4}, shots=[0, 0.3, 0.6, 1.0, 1.4, 1.9])
def c_death():
    i0 = idle_pose(0)
    writhe = pose([0, 0, 0, 0, 0, 2, 5, 10, 12, 10, 6, 2, -2], z=[0, 3, 6, 8, 8, 8, 6, 6, 6, 6, 6, 4, 2],
                  y=[0, 0, 0, 0, 0, 0, 0, 0, 10, 14, 16, 18, 18], sack=1.15, extra=mouth(open_=1.0))
    thrash = pose([0, 0, 0, 0, 0, 0, 2, 4, 6, 4, 2, 0, -2], z=[0, -4, -8, -10, -10, -8, -8, -10, -10, -8, -6, -4, -2],
                  y=[0, 0, 0, 0, 0, 0, 0, 0, -10, -14, -16, -18, -18], sack=1.05, extra=mouth(open_=0.7))
    fall = pose(add(flat_front(0.9), [0] * 13), z=[0, 2, 4, 6, 6, 6, 6, 4, 2, 0, 0, 0, 0], sack=0.95, extra=mouth(open_=0.3))
    curl = pose(add(flat_front(1.0), [0] * 13), z=[0, 6, 10, 12, 12, 12, 12, 12, 12, 10, 8, 6, 4],
                y=[0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 20, 30, 40], sack=0.82, extra=mouth(clamp=0.6))
    return [(0.0, i0), (0.3, writhe), (0.6, thrash), (1.0, fall), (1.4, curl), (2.0, curl)]


def author(arm):
    acts = []
    for c in CLIPS:
        acts.append(S.make_action(arm, c['name'], c['fn'](), loop=c['loop']))
    S.rest(arm)
    return acts


# ================================================================ review
def variant(col, arm, body, name, at_=(0, 0, 0), rot=0.0, act=None, offset=0, outline=None):
    v = VARIANTS[name]
    root = bpy.data.objects.new('V.%s' % name, None)
    col.objects.link(root)
    root.location = at_
    root.rotation_euler = (0, 0, math.radians(rot))
    root.scale = (v['scale'],) * 3
    a2 = arm.copy()
    a2.name = 'Rig.%s' % name
    col.objects.link(a2)
    a2.parent = root
    o2 = body.copy()
    o2.data = body.data.copy()
    o2.name = 'leech_body.%s' % name
    col.objects.link(o2)
    o2.parent = a2
    o2.modifiers['Armature'].object = a2
    S.set_material(o2, v['palette'], v.get('slots'), name='GV_%s' % name)
    o2.hide_render = False
    if outline:
        S.set_outline([o2], outline)
    if act:
        S.assign(a2, act, slot_src=arm, offset_frames=offset)
    return root, [a2, o2]


def remove(objs):
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)


def review(arm, body, acts, tris):
    rv = S.Review(OUT, quick=QUICK, floor_color=(0.03, 0.045, 0.05))
    col = bpy.data.collections.new('Review')
    bpy.context.scene.collection.children.link(col)
    body.hide_render = True
    made = []
    idle = bpy.data.actions['Idle']
    # lineup
    bpy.context.scene.frame_set(0)
    rv.hero.hide_render = False
    rv.hero.location = (-1.6, -0.6, 0)
    root, objs = variant(col, arm, body, 'vault-leech', act=idle)
    bpy.context.scene.frame_set(0)
    pts = S.world_points(objs, step=5) + [Vector((-2.0, -1.0, 0)), Vector((-1.2, 0, 1.8))]
    rv.label3d('hero 1.8 m', (-1.6, -1.6, 0.02), size=0.16)
    rv.label3d('vault-leech  1.0x  %s tris' % format(tris, ','), (1.2, -1.2, 0.02), size=0.16)
    rv.fit(pts + [Vector((1.2, -1.6, 0)), Vector((2.6, -1.4, 0))], az=40, el=16, lens=40)
    made.append(rv.shot('lineup.png', w=1600 if not QUICK else 1200, h=800 if not QUICK else 600))
    rv.fit(pts + [Vector((0.3, -2.4, 0))], az=90, el=8, lens=40)
    made.append(rv.shot('lineup_side.png', w=1600 if not QUICK else 1200, h=800 if not QUICK else 600))
    rv.clear_labels()
    rv.hero.hide_render = True
    # 200-px card read
    rv.fit(S.world_points(objs, step=5), az=32, el=20, lens=50)
    big = rv.shot('_card.png', size=512 if QUICK else 1024)
    made.append(rv.downscale(big, os.path.join(OUT, 'read200_vault-leech.png'), 200))
    remove(objs + [root])
    # strips
    for act in acts:
        c = next(c for c in CLIPS if c['name'] == act.name)
        frames = [round(t * S.FPS) for t in c['shots']]
        state = {}

        def place(row, act=act):
            for o in state.get('objs', []) + ([state['root']] if 'root' in state else []):
                bpy.data.objects.remove(o, do_unlink=True)
            state['root'], state['objs'] = variant(col, arm, body, 'vault-leech', act=act)

        def bounds(row):
            return S.world_points(state['objs'], step=7)

        def label(row, fr, c=c):
            t = fr / S.FPS
            ev = [k for k, v in c['events'].items() if abs(v - t) < 0.02]
            return '%s · vault-leech\n%.2f s  f%d  %s' % (c['name'], t, fr, ' '.join(ev))
        made.append(rv.strip('clip_%s' % act.name, frames, bounds, place, label, az=62, el=14, lens=45))
        remove(state['objs'] + [state['root']])
    made.append(fight(rv, col, arm, body))
    return made


def fight(rv, col, arm, body):
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
    root, objs = variant(col, arm, body, 'vault-leech', at_=(2.2, 0.2, 0), rot=S.fight_rot('enemy'),
                         act=bpy.data.actions['Idle'], outline=0.016)
    sc.frame_set(20)
    pts = S.world_points(heroes, step=9) + S.world_points(objs, step=5)
    xs = [p.x for p in pts]
    centre = Vector(((min(xs) + max(xs)) / 2, 0.0, 0.9))
    d = S.fight_distance()
    for _i in range(40):
        S.fight_camera(rv.stage, centre, d)
        sc.render.resolution_x, sc.render.resolution_y = S.FIGHT_W, S.FIGHT_H
        bpy.context.view_layer.update()
        if all(0.03 <= c.x <= 0.97 and 0.03 <= c.y <= 0.97 for c in
               (bpy_extras.object_utils.world_to_camera_view(sc, rv.stage.cam, p) for p in pts)):
            break
        d *= 1.05
    path = rv.shot('fight_leech_jar.png', w=S.FIGHT_W, h=S.FIGHT_H)
    rv.camera_ortho_off()
    for h in heroes:
        bpy.data.objects.remove(h, do_unlink=True)
    remove(objs + [root])
    log('fight read: camera %.2f m (hero-share distance %.2f m)' % (d, S.fight_distance()))
    return path


# ================================================================ export
def export(arm, body, acts):
    from export import export_glb
    S.strip_rest([arm, body])
    S.finish(body)
    if 'Outline' in body.modifiers:
        body.modifiers.remove(body.modifiers['Outline'])
    S.stash(arm, acts)
    body['kind'] = 'monster'
    body['base'] = BASE
    bpy.context.view_layer.update()
    path = os.path.join(S.MON, BASE + '.glb')
    export_glb(path, [arm, body], animations=True, animation_mode='ACTIONS',
               extra={'export_optimize_animation_size': True, 'export_optimize_animation_keep_anim_armature': True,
                      'export_merge_animation': 'ACTION'})
    return path


def main():
    global BENDS
    common.clear_scene()
    sc = bpy.context.scene
    sc.render.fps = S.FPS
    col = common.collection('Leech')
    log('leech length %.2f m (arc)' % LTOT)
    arm = build_rig(col)
    BENDS = rest_bends()
    log('rest bends', [round(b, 1) for b in BENDS])
    mb, body = build_body(col)
    S.apply_weights(body, mb, arm)
    v = VARIANTS['vault-leech']
    S.look(body, v['palette'], v['slots'])
    acts = author(arm)
    body.modifiers['Outline'].show_viewport = False
    tris = S.tri_count([body])
    body.modifiers['Outline'].show_viewport = True
    log('tris', tris)
    for nm, t in (('Attack1', 0.55), ('Attack2', 0.7)):
        S.assign(arm, bpy.data.actions[nm])
        sc.frame_set(round(t * S.FPS))
        hd = arm.matrix_world @ arm.pose.bones['Head'].tail
        log('%s hit: mouth at y %.2f z %.2f' % (nm, hd.y, hd.z))
    S.unassign(arm)
    S.rest(arm)
    if RENDER:
        made = review(arm, body, acts, tris)
        log('renders:', ', '.join(os.path.basename(p) for p in made))
    for o in list(bpy.data.objects):
        if (o.name.startswith('Rig.') or o.name.startswith('leech_body.')) or o.name.startswith('V.'):
            bpy.data.objects.remove(o, do_unlink=True)
    common.save_blend(os.path.join(BUILD, 'leech.blend'))
    path = export(arm, body, acts)
    entries = {}
    for name, vv in VARIANTS.items():
        entries[name] = dict(base=BASE, scale=vv['scale'], parts=vv['parts'], shapes=vv['shapes'], palette=vv['palette'],
                             slots=vv['slots'], clipSpeed=vv['clipSpeed'], tris=tris)
    S.write_manifest(entries)
    S.write_clips(BASE, 'skeletal', [dict(name=c['name'], seconds=c['seconds'], loop=c['loop'], events=c['events'])
                                     for c in CLIPS], extra={'rig': 'Rig', 'bones': len(arm.data.bones)})
    S.inspect(path)
    from export import reimport_report
    lines = reimport_report(path, os.path.join(OUT, 'reimport_check.png') if RENDER else None)
    a = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    if a and 'Attack1' in bpy.data.actions:
        act = bpy.data.actions['Attack1']
        adt = a.animation_data or a.animation_data_create()
        adt.action = act
        adt.action_slot = act.slots[0]
        sc = bpy.context.scene
        sc.frame_set(0)
        p0 = (a.matrix_world @ a.pose.bones['Head'].tail).copy()
        sc.frame_set(round(0.55 * sc.render.fps))
        p1 = (a.matrix_world @ a.pose.bones['Head'].tail).copy()
        lines.append('  - re-imported Attack1 moves the mouth %.2f m (frame 0 → hit)' % (p0 - p1).length)
    for ln in lines:
        log(ln)


main()

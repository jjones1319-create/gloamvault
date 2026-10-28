"""build_ooze.py — the ooze base (06 §3.5): the Brine Ooze and the Pearl Ooze.

Run:  blender -b -P tools/blender/monsters/build_ooze.py -- [--quick] [--no-renders]

A waist-high mound of brine (1.4 m across, 0.96 m tall at 1.0×) with no skeleton: lumps, drips running down its sides,
a spreading foot, painted toon highlights (slot 1) that make it read wet, and things caught in it — half out of the
surface, because the client draws it opaque. Parts: `ooze_junk` (the Brine Ooze: a rusted helmet, a sword, a chain,
a skull and a bone — slots 2, 5, 13) and `ooze_pearls` (the Pearl Ooze at 0.8×: pearls in slot 2 and one glowing in 14).

Every clip is a shape-key animation. The keys are deformation fields of position (squash, stretch, four leans, two
ripples, lunge, splash up / down, melt), applied the same way to the body and to both parts, so whatever is caught in
the jelly moves with it; one action per clip keys all three meshes (one KEY slot each), so each clip exports as one glTF
animation with a `weights` channel per mesh. Clips: Idle (wobble), Move (squash-stretch), Attack1 (lunge — Engulf),
Attack2 (splash — Spit), Hit (jiggle), Death (melt), Flee (fast hops, the Pearl Ooze), Split (a shudder — the client
spawns the second ooze on `split`). The variants are a scale, a part and a palette only: no `var_*` keys, because a
glTF `weights` track drives every morph target of its mesh.
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
BASE = 'ooze'
OUT = os.path.join(RENDERS, 'monsters', BASE)
H = 0.96
R = 0.73

VARIANTS = {
    'brine-ooze': dict(scale=1.0, parts=['ooze_junk'], shapes={}, palette=['#6f9e8c', '#e8f2ea', '#8a4a26'], slots={},
                       clipSpeed=1.0),
    'pearl-ooze': dict(scale=0.8, parts=['ooze_pearls'], shapes={}, palette=['#a9d8cf', '#e6c8f2', '#fbf6ec'],
                       slots={'14': '#fff3e4'}, clipSpeed=1.3),
}
MESHES = ('ooze_body', 'ooze_junk', 'ooze_pearls')
PROFILE = [(0.60, 0.0), (0.90, 0.0), (0.86, 0.022), (0.78, 0.07), (0.775, 0.17), (0.71, 0.35), (0.58, 0.55),
           (0.43, 0.72), (0.27, 0.86), (0.11, 0.95), (0.0, 0.97)]
LOBES = [(-110, 0.55, 0.13, 0.75, 0.22), (40, 0.36, 0.11, 0.8, 0.2), (-80, 0.80, 0.10, 0.6, 0.14), (150, 0.70, 0.08, 0.7, 0.16)]
SHINES = [(-70, 0.72, 0.085, 0.048), (-52, 0.80, 0.03, 0.02), (-98, 0.56, 0.035, 0.022)]   # θ, z, half-width, half-height
CREST = (-80, 0.74)          # a lobe swelling up and forward on the crown
NSEG = 28


# ================================================================ deformation fields (the clip keys)
def polar(p):
    return math.hypot(p.x, p.y), math.atan2(p.y, p.x)


def k_squash(p):
    return Vector((p.x * 1.16, p.y * 1.16, p.z * 0.74))


def k_stretch(p):
    return Vector((p.x * 0.88, p.y * 0.88, p.z * 1.28))


def lean(dx, dy):
    def f(p):
        s = max(0.0, p.z / H) ** 1.6
        return Vector((p.x + dx * s, p.y + dy * s, p.z - 0.03 * (p.z / H) ** 2))
    return f


def ripple(phase):
    def f(p):
        r, th = polar(p)
        if r < 1e-6:
            return p.copy()
        d = 0.065 * math.sin(3 * th + phase) * math.sin(math.pi * max(0.0, min(1.0, p.z / H))) * min(1.0, r / R)
        return Vector((p.x + d * p.x / r, p.y + d * p.y / r, p.z + 0.02 * math.sin(3 * th + phase) * (p.z / H)))
    return f


def k_lunge(p):
    c = Vector((0.0, -0.40, 0.45))
    w = math.exp(-(p - c).length_squared / 0.22)
    return Vector((p.x * (1 - 0.18 * w), p.y - 0.95 * w - 0.22 * (p.z / H), p.z + 0.10 * w - 0.06 * (p.z / H)))


def k_splash_up(p):
    s = max(0.0, (p.z - 0.3) / (H - 0.3)) ** 1.5
    return Vector((p.x * (1 - 0.35 * s), p.y * (1 - 0.35 * s) - 0.14 * s, p.z + 0.55 * s))


def k_splash_down(p):
    s = max(0.0, p.z / H) ** 1.5
    spread = 0.16 * (1 - min(1.0, p.z / H)) * smoothstep(0.0, -0.5, p.y)
    return Vector((p.x * (1 + 0.12 * (1 - s)), p.y - 0.62 * s - spread, p.z * (1 - 0.38 * s)))


def k_melt(p):
    r, th = polar(p)
    k = 1.6 * (1 + 0.07 * math.sin(7 * th + 0.5))
    return Vector((p.x * k, p.y * k, p.z * 0.16))


KEYS = [('clip_squash', k_squash), ('clip_stretch', k_stretch), ('clip_lean_f', lean(0, -0.24)),
        ('clip_lean_b', lean(0, 0.24)), ('clip_lean_l', lean(0.22, 0)), ('clip_lean_r', lean(-0.22, 0)),
        ('clip_ripple_a', ripple(0.0)), ('clip_ripple_b', ripple(math.pi / 2)), ('clip_lunge', k_lunge),
        ('clip_splash_up', k_splash_up), ('clip_splash_down', k_splash_down), ('clip_melt', k_melt)]


def keyed(ob, mb):
    S.add_keys(ob, [(name, [fn(c) for c in mb.co]) for name, fn in KEYS])


# ================================================================ the blob
def lumps(th, z):
    """Radial displacement of the rest blob: two big low lobes, smaller ones, a crest, drips, a scalloped foot."""
    s1 = math.sin(math.pi * min(1.0, max(0.0, z) / H)) ** 0.8
    d = 0.10 * math.sin(2 * th + 0.7) * s1 + 0.06 * math.sin(3 * th + 2.3 + 3 * z) * s1 + 0.025 * math.sin(7 * th + 1.0 + 6 * z)
    for a, zc, amp, wa, wz in LOBES:            # big lobes break the dome's outline
        dc = math.atan2(math.sin(th - math.radians(a)), math.cos(th - math.radians(a)))
        d += amp * math.exp(-(dc / wa) ** 2) * math.exp(-((z - zc) / wz) ** 2)
    for a, k in ((-150, 1.0), (-60, 0.8), (20, 1.1), (95, 0.9), (160, 1.0)):           # drips down the lower half
        dth = math.atan2(math.sin(th - math.radians(a)), math.cos(th - math.radians(a)))
        d += 0.08 * k * math.exp(-(dth / 0.13) ** 2) * smoothstep(0.66, 0.10, z) * smoothstep(0.0, 0.06, z)
    d += (0.05 * math.sin(9 * th) + 0.03 * math.sin(5 * th + 1.3)) * smoothstep(0.06, 0.0, z)   # the puddle's scalloped edge
    return d


def rest_lean(p):
    """The crown leans forward a little (applied to every mesh, so what is caught in it leans too)."""
    k = (max(0.0, p.z) / H) ** 2
    return Vector((p.x, p.y - 0.10 * k, p.z))


def lean_all(mb):
    mb.transform(0, len(mb.co), rest_lean)


def surface_r(th, z):
    """The blob's radius at angle th and height z (for placing what is caught in it)."""
    prof = sorted(PROFILE[1:-1], key=lambda q: q[1])
    r = prof[-1][0]
    for (r0, z0), (r1, z1) in zip(prof, prof[1:]):
        if z0 <= z <= z1:
            r = r0 + (r1 - r0) * (z - z0) / max(1e-6, z1 - z0)
            break
    return r + lumps(th, z)


def shine(mb, th_deg, z, a, b):
    """A painted toon highlight as geometry: an oval lifted off the surface (round, not the faces' squares)."""
    c, n = place_on(th_deg, z, -0.004)
    t1 = Vector((-n.y, n.x, 0)).normalized()
    t2 = n.cross(t1).normalized()
    m = 10
    skirt = [mb.v(c + t1 * (a * 1.08 * math.cos(2 * math.pi * i / m)) + t2 * (b * 1.08 * math.sin(2 * math.pi * i / m)) - n * 0.02)
             for i in range(m)]
    rim = [mb.v(c + t1 * (a * math.cos(2 * math.pi * i / m)) + t2 * (b * math.sin(2 * math.pi * i / m))) for i in range(m)]
    mb.begin('shine')
    mb.bridge(skirt, rim, 1)
    mb.fan(rim, mb.v(c + n * 0.006), 1)
    f = mb.end()
    mb.orient(f, c - n * 0.3)


def build_body(col):
    mb = MB()
    curve, Lc = S.catmull(PROFILE, 200)
    n_r = 18
    pts, _ = S.resample(curve, [Lc * (k / (n_r - 1)) ** 0.95 for k in range(n_r)])
    rings, ring_z = [], []
    for k, q in enumerate(pts[:-1]):
        r0, z = q.x, q.y
        ring = []
        for i in range(NSEG):
            th = math.radians(-90 + i * 360 / NSEG)
            r = r0 + lumps(th, z) * min(1.0, r0 / 0.2)
            ring.append(mb.v((r * math.cos(th), r * math.sin(th), z)))
        rings.append(ring)
        ring_z.append(z)
    mb.begin('blob')
    bottom = mb.v((0, 0, 0.0))
    mb.fan(rings[0], bottom, 0, flip=True)
    for k in range(len(rings) - 1):
        z0 = (ring_z[k] + ring_z[k + 1]) / 2
        mb.bridge(rings[k], rings[k + 1], 0)
    top = mb.v((0, 0, H))
    mb.fan(rings[-1], top, 0)
    f = mb.end()
    mb.orient(f, (0, 0, 0.4))
    for th, z, a, b in SHINES:
        shine(mb, th, z, a, b)
    lean_all(mb)
    log('ooze_body: %d tris' % mb.tris())
    return mb, mb.build('ooze_body', col)


# ================================================================ what is caught in it
def place_on(th_deg, z, sink):
    """A point on the blob's surface at angle / height, pulled in by `sink` metres, and the outward normal there."""
    th = math.radians(th_deg)
    r = surface_r(th, z)
    n = Vector((math.cos(th), math.sin(th), 0.35 + 0.9 * max(0.0, (z - 0.5)))).normalized()
    return Vector((r * math.cos(th), r * math.sin(th), z)) - n * sink, n


def sphere(mb, c, r, slot, nseg=8, nring=5, squash=(1, 1, 1)):
    rings = []
    for j in range(1, nring):
        ph = -math.pi / 2 + math.pi * j / nring
        rings.append([mb.v(c + Vector((r * squash[0] * math.cos(ph) * math.cos(2 * math.pi * i / nseg),
                                         r * squash[1] * math.cos(ph) * math.sin(2 * math.pi * i / nseg),
                                         r * squash[2] * math.sin(ph)))) for i in range(nseg)])
    mb.begin('sphere')
    mb.fan(rings[0], mb.v(c - Vector((0, 0, r * squash[2]))), slot, flip=True)
    for k in range(len(rings) - 1):
        mb.bridge(rings[k], rings[k + 1], slot)
    mb.fan(rings[-1], mb.v(c + Vector((0, 0, r * squash[2]))), slot)
    f = mb.end()
    mb.orient(f, c)


def box(mb, c, ax, ay, az, hx, hy, hz, slot):
    vs = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                vs.append(mb.v(c + ax * (sx * hx) + ay * (sy * hy) + az * (sz * hz)))
    mb.begin('box')
    for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        mb.f([vs[i] for i in f], slot)
    fr = mb.end()
    mb.orient(fr, c)


def torus(mb, c, axis, R_, r, slot, nu=10, nv=6):
    axis = axis.normalized()
    u, v = S.frame_from(axis, Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0)))
    rings = []
    for i in range(nu):
        a = 2 * math.pi * i / nu
        cc = c + (u * math.cos(a) + v * math.sin(a)) * R_
        out = (cc - c).normalized()
        rings.append([mb.v(cc + out * (r * math.cos(2 * math.pi * j / nv)) + axis * (r * math.sin(2 * math.pi * j / nv)))
                      for j in range(nv)])
    mb.begin('torus')
    for i in range(nu):
        mb.bridge(rings[i], rings[(i + 1) % nu], slot)
    f = mb.end()
    mb.orient(f, lambda p, c=c, u=u, v=v, R_=R_: c + ((p - c) - axis * (p - c).dot(axis)).normalized() * R_)


def build_junk(col):
    """The Brine Ooze's catch, half out of the jelly: a pot helm, a sword hilt, a chain, a skull, a bone, and froth."""
    mb = MB()
    # a pot helm on the top-right, tilted, with a rim band and a nasal bar (no slit: round 1's slit read as an eye)
    hc, hn = place_on(-30, 0.60, 0.07)
    up = (hn * 0.7 + Vector((0, 0, 0.7))).normalized()
    side = up.cross(Vector((0.3, -1, 0)).normalized()).normalized()
    fwd = side.cross(up).normalized()
    rings = []
    for rr, hh in ((0.15, -0.03), (0.152, 0.03), (0.135, 0.09), (0.095, 0.14), (0.04, 0.165)):
        rings.append([mb.v(hc + side * (rr * math.cos(2 * math.pi * i / 10)) + fwd * (rr * math.sin(2 * math.pi * i / 10)) + up * hh)
                      for i in range(10)])
    mb.begin('helm')
    for j in range(len(rings) - 1):
        mb.bridge(rings[j], rings[j + 1], 2)
    mb.fan(rings[-1], mb.v(hc + up * 0.172), 2)
    f = mb.end()
    mb.orient(f, hc)
    torus(mb, hc + up * 0.0, up, 0.158, 0.016, 2, nu=12, nv=5)
    box(mb, hc + fwd * 0.155 + up * 0.05, fwd, side, up, 0.012, 0.016, 0.075, 2)
    # a sword: the blade in the jelly, the hilt out of the top-left — crossguard, grip, pommel
    sc, sn = place_on(150, 0.48, -0.02)
    d = (sn * 1.0 + Vector((0, 0, 0.12))).normalized()
    wv = d.cross(Vector((0, 0, 1)))
    wv = wv.normalized() if wv.length > 1e-3 else Vector((1, 0, 0))
    tv = d.cross(wv).normalized()
    box(mb, sc - d * 0.12, d, wv, tv, 0.14, 0.03, 0.008, 2)
    box(mb, sc + d * 0.03, d, wv, tv, 0.02, 0.11, 0.022, 2)
    box(mb, sc + d * 0.13, d, wv, tv, 0.08, 0.018, 0.018, 8)
    sphere(mb, sc + d * 0.23, 0.032, 2, nseg=8, nring=4)
    # a chain draped over the front-right
    for k in range(4):
        cc, cn = place_on(-75 + k * 13, 0.50 - k * 0.07, 0.016)
        ax = (Vector((-cn.y, cn.x, 0)) if k % 2 == 0 else cn).normalized()
        torus(mb, cc, ax, 0.055, 0.016, 2)
    # a skull low on the front-left, staring out, and a bone out of the right flank
    kc, kn = place_on(-128, 0.30, 0.055)
    sphere(mb, kc, 0.10, 13, nseg=10, nring=6, squash=(0.92, 1.0, 0.95))
    lat = Vector((-kn.y, kn.x, 0)).normalized()
    for sx in (-1, 1):
        sphere(mb, kc + kn * 0.082 + lat * (0.035 * sx) + Vector((0, 0, 0.018)), 0.026, 5, nseg=6, nring=3)
    sphere(mb, kc + kn * 0.09 - Vector((0, 0, 0.03)), 0.012, 5, nseg=5, nring=3)
    box(mb, kc + kn * 0.05 - Vector((0, 0, 0.075)), kn, lat, kn.cross(lat).normalized(), 0.035, 0.055, 0.02, 13)
    bc, bn = place_on(5, 0.24, 0.03)
    bd = (bn + Vector((0.2, -0.3, 0.5))).normalized()
    blat = Vector((-bd.y, bd.x, 0)).normalized()
    for p in (bc - bd * 0.05, bc + bd * 0.24):
        sphere(mb, p, 0.032, 13, nseg=6, nring=3)
    box(mb, bc + bd * 0.095, bd, blat, bd.cross(blat).normalized(), 0.13, 0.019, 0.019, 13)
    # froth on the crown (foam white)
    for th, z, r in ((70, 0.90, 0.05), (110, 0.88, 0.04), (150, 0.86, 0.055), (200, 0.88, 0.04), (35, 0.93, 0.035),
                     (240, 0.84, 0.045), (-160, 0.86, 0.035)):
        c, n = place_on(th, z, 0.02)
        sphere(mb, c, r, 1, nseg=8, nring=4, squash=(1, 1, 0.7))
    lean_all(mb)
    log('ooze_junk: %d tris' % mb.tris())
    return mb, mb.build('ooze_junk', col)


def build_pearls(col):
    mb = MB()
    for th, z, r, sink in ((-100, 0.66, 0.08, 0.03), (-60, 0.48, 0.065, 0.025), (-140, 0.45, 0.07, 0.03),
                           (-20, 0.75, 0.06, 0.02), (40, 0.62, 0.075, 0.03), (90, 0.80, 0.065, 0.025), (150, 0.55, 0.07, 0.03),
                           (-165, 0.78, 0.055, 0.02), (210, 0.30, 0.065, 0.03), (-75, 0.28, 0.06, 0.025), (5, 0.35, 0.065, 0.03),
                           (-112, 0.20, 0.055, 0.02), (60, 0.25, 0.06, 0.025)):
        c, n = place_on(th, z, sink)
        sphere(mb, c, r, 2, nseg=8, nring=5)
    c, n = place_on(-88, 0.84, 0.035)
    sphere(mb, c, 0.095, 14, nseg=10, nring=6)
    lean_all(mb)
    log('ooze_pearls: %d tris' % mb.tris())
    return mb, mb.build('ooze_pearls', col)


# ================================================================ clips
CLIPS = []


def clip(name, seconds, loop=False, events=None, shots=None):
    def deco(fn):
        CLIPS.append(dict(name=name, seconds=seconds, loop=loop, events=events or {}, fn=fn, shots=shots))
        return fn
    return deco


def pos(d, a, b, x):
    """Writes a signed amount as two one-sided keys (a for +, b for −)."""
    if x >= 0:
        d[a] = d.get(a, 0) + x
    else:
        d[b] = d.get(b, 0) - x
    return d


def idle_w(t, T=2.4):
    ph = 2 * math.pi * t / T
    d = {}
    pos(d, 'clip_squash', 'clip_stretch', 0.30 * math.sin(ph))
    pos(d, 'clip_lean_l', 'clip_lean_r', 0.22 * math.sin(ph + 1.0))
    pos(d, 'clip_lean_b', 'clip_lean_f', 0.12 * math.sin(ph + 2.2))
    d['clip_ripple_a'] = 0.45 * max(0.0, math.sin(2 * ph + 0.4))
    d['clip_ripple_b'] = 0.45 * max(0.0, math.cos(2 * ph + 0.4))
    return d


def move_w(t, T=1.0, back=False):
    ph = 2 * math.pi * t / T
    s = math.sin(ph)
    d = {}
    pos(d, 'clip_stretch', 'clip_squash', 0.75 * s)
    d['clip_lean_b' if back else 'clip_lean_f'] = 0.45 + 0.3 * math.sin(ph + 0.6)
    d['clip_ripple_a'] = 0.3 * max(0.0, math.sin(2 * ph))
    return d


def sampled(T, fn, step=2):
    n = round(T * S.FPS)
    keys = [(f / S.FPS, fn(f / S.FPS)) for f in range(0, n, step)]
    keys.append((T, fn(0.0)))
    return keys


def plus(*ds):
    out = {}
    for d in ds:
        for k, v in d.items():
            out[k] = out.get(k, 0) + v
    return out


@clip('Idle', 2.4, loop=True, shots=[0, 0.4, 0.8, 1.2, 1.6, 2.0])
def c_idle():
    return sampled(2.4, idle_w)


@clip('Move', 1.0, loop=True, shots=[0, 0.17, 0.33, 0.5, 0.67, 0.83])
def c_move():
    return sampled(1.0, move_w)


@clip('Flee', 0.7, loop=True, shots=[0, 0.12, 0.23, 0.35, 0.47, 0.58])
def c_flee():
    return sampled(0.7, lambda t: move_w(t, 0.7, back=True))


@clip('Attack1', 1.0, events={'hit': 0.45}, shots=[0, 0.2, 0.3, 0.45, 0.6, 0.8])
def c_attack1():
    i0 = idle_w(0)
    return [(0.0, i0), (0.3, {'clip_squash': 0.8, 'clip_lean_b': 0.5}),
            (0.45, {'clip_lunge': 1.0, 'clip_stretch': 0.25, 'clip_lean_f': 0.3}),
            (0.6, {'clip_lunge': 0.6, 'clip_ripple_a': 0.5, 'clip_lean_f': 0.2}),
            (0.8, {'clip_lunge': 0.15, 'clip_ripple_b': 0.35, 'clip_squash': 0.15}), (1.0, i0)]


@clip('Attack2', 1.2, events={'release': 0.55}, shots=[0, 0.2, 0.35, 0.55, 0.75, 1.0])
def c_attack2():
    i0 = idle_w(0)
    return [(0.0, i0), (0.2, {'clip_squash': 0.5}), (0.35, {'clip_splash_up': 1.0}),
            (0.55, {'clip_splash_down': 1.0, 'clip_squash': 0.3}),
            (0.75, {'clip_splash_down': 0.45, 'clip_ripple_a': 0.6}), (1.0, {'clip_ripple_b': 0.3, 'clip_stretch': 0.15}),
            (1.2, i0)]


@clip('Hit', 0.5, shots=[0, 0.05, 0.12, 0.2, 0.3, 0.42])
def c_hit():
    i0 = idle_w(0)
    return [(0.0, i0), (0.05, {'clip_squash': 0.6, 'clip_lean_b': 0.55}),
            (0.12, {'clip_stretch': 0.5, 'clip_lean_f': 0.3}), (0.2, {'clip_squash': 0.35, 'clip_ripple_a': 0.5}),
            (0.3, {'clip_stretch': 0.2, 'clip_ripple_b': 0.4}), (0.5, i0)]


@clip('Death', 1.6, events={'down': 1.1}, shots=[0, 0.2, 0.4, 0.7, 1.1, 1.5])
def c_death():
    i0 = idle_w(0)
    return [(0.0, i0), (0.2, {'clip_stretch': 0.6, 'clip_ripple_a': 0.3}), (0.4, {'clip_squash': 0.5, 'clip_ripple_b': 0.5}),
            (0.7, {'clip_melt': 0.55, 'clip_ripple_a': 0.4}), (1.1, {'clip_melt': 1.0}), (1.6, {'clip_melt': 1.0})]


@clip('Split', 0.7, events={'split': 0.45}, shots=[0, 0.12, 0.25, 0.35, 0.45, 0.6])
def c_split():
    i0 = idle_w(0)
    return [(0.0, i0), (0.12, {'clip_squash': 0.6, 'clip_ripple_a': 0.7}), (0.25, {'clip_stretch': 0.5, 'clip_ripple_b': 0.8}),
            (0.35, {'clip_lean_l': 0.6, 'clip_squash': 0.3}), (0.45, {'clip_lean_r': 0.6, 'clip_ripple_a': 0.6}),
            (0.7, i0)]


# ================================================================ review
def variant(col, name, at_=(0, 0, 0), rot=0.0, act=None, offset=0, outline=None):
    v = VARIANTS[name]
    root = bpy.data.objects.new('V.%s' % name, None)
    col.objects.link(root)
    root.location = at_
    root.rotation_euler = (0, 0, math.radians(rot))
    root.scale = (v['scale'],) * 3
    objs = []
    for nm in MESHES:
        if nm != 'ooze_body' and nm not in v['parts']:
            continue
        src = bpy.data.objects[nm]
        o = src.copy()
        o.data = src.data.copy()
        o.name = '%s.%s' % (nm, name)
        col.objects.link(o)
        o.parent = root
        S.set_material(o, v['palette'], v['slots'], name='GV_%s' % name)
        o.hide_render = False
        if outline:
            S.set_outline([o], outline)
        if act:
            S.assign(o.data.shape_keys, act, slot_src=src.data.shape_keys, offset_frames=offset)
        objs.append(o)
    return root, objs


def remove(objs):
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)


def review(acts, tris):
    rv = S.Review(OUT, quick=QUICK, floor_color=(0.03, 0.045, 0.05))
    col = bpy.data.collections.new('Review')
    bpy.context.scene.collection.children.link(col)
    for nm in MESHES:
        bpy.data.objects[nm].hide_render = True
    made = []
    idle = bpy.data.actions['Idle']
    rv.hero.hide_render = False
    rv.hero.location = (-1.2, 0, 0)
    placed = [variant(col, 'brine-ooze', at_=(0.4, 0, 0), act=idle), variant(col, 'pearl-ooze', at_=(2.1, 0, 0), act=idle)]
    bpy.context.scene.frame_set(6)
    pts = S.world_points([rv.hero], step=20)
    for _r, objs in placed:
        pts += S.world_points(objs, step=3)
    rv.label3d('hero 1.8 m', (-1.2, -0.95, 0.02), size=0.11)
    rv.label3d('brine-ooze\n1.0x  %s tris' % format(tris['brine'], ','), (0.4, -0.95, 0.02), size=0.11)
    rv.label3d('pearl-ooze\n0.8x  %s tris' % format(tris['pearl'], ','), (2.1, -0.95, 0.02), size=0.11)
    rv.fit(pts + [Vector((0.4, -1.0, 0))], az=14, el=14, lens=45)
    made.append(rv.shot('lineup.png', w=1200 if QUICK else 1600, h=800 if QUICK else 1067))
    rv.clear_labels()
    rv.hero.hide_render = True
    for r, objs in placed:
        remove(objs + [r])
    reads = []
    for name in VARIANTS:
        r, objs = variant(col, name, act=idle)
        bpy.context.scene.frame_set(6)
        rv.fit(S.world_points(objs, step=2), az=32, el=20, lens=50)
        big = rv.shot('_card_%s.png' % name, size=512 if QUICK else 1024)
        reads.append(rv.downscale(big, os.path.join(OUT, 'read200_%s.png' % name), 200))
        remove(objs + [r])
    made.append(rv.sheet(reads, os.path.join(OUT, 'read200_sheet.png'), cols=len(reads)))
    for act in acts:
        c = next(c for c in CLIPS if c['name'] == act.name)
        frames = [round(t * S.FPS) for t in c['shots']]
        st = {}
        rows = ['pearl-ooze'] if act.name == 'Flee' else ['brine-ooze', 'pearl-ooze']

        def place(row, act=act):
            for o in st.get('objs', []) + ([st['root']] if 'root' in st else []):
                bpy.data.objects.remove(o, do_unlink=True)
            st['root'], st['objs'] = variant(col, row, act=act)

        def bounds(row):
            return S.world_points(st['objs'], step=3) + [Vector((0, 0, 0))]

        def label(row, fr, c=c):
            t = fr / S.FPS
            ev = [k for k, v in c['events'].items() if abs(v - t) < 0.02]
            return '%s · %s\n%.2f s  f%d  %s' % (c['name'], row, t, fr, ' '.join(ev))
        made.append(rv.strip('clip_%s' % act.name, frames, bounds, place, label, rows=rows, az=40, el=16, lens=50))
        remove(st['objs'] + [st['root']])
    made.append(fight(rv, col))
    return made


def fight(rv, col):
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
    idle = bpy.data.actions['Idle']
    placed = [variant(col, 'brine-ooze', at_=(1.3, -0.55, 0), rot=S.fight_rot('enemy'), act=idle, outline=0.016),
              variant(col, 'brine-ooze', at_=(1.3, 0.65, 0), rot=S.fight_rot('enemy'), act=idle, offset=25, outline=0.016),
              variant(col, 'pearl-ooze', at_=(2.7, 0.1, 0), rot=S.fight_rot('enemy'), act=idle, offset=12, outline=0.016)]
    sc.frame_set(20)
    pts = S.world_points(heroes, step=9)
    for _r, objs in placed:
        pts += S.world_points(objs, step=3)
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
    path = rv.shot('fight_salt_circle.png', w=S.FIGHT_W, h=S.FIGHT_H)
    rv.camera_ortho_off()
    for h in heroes:
        bpy.data.objects.remove(h, do_unlink=True)
    for r, objs in placed:
        remove(objs + [r])
    return path


# ================================================================ main
def main():
    common.clear_scene()
    sc = bpy.context.scene
    sc.render.fps = S.FPS
    col = common.collection('Ooze')
    root = bpy.data.objects.new('Ooze', None)
    col.objects.link(root)
    built = {}
    for nm, fn in (('ooze_body', build_body), ('ooze_junk', build_junk), ('ooze_pearls', build_pearls)):
        mb, ob = fn(col)
        keyed(ob, mb)
        ob.parent = root
        built[nm] = ob
    v = VARIANTS['brine-ooze']
    for ob in built.values():
        S.look(ob, v['palette'], v['slots'])
    acts = [S.make_key_action(c['name'], list(built.values()), c['fn'](), loop=c['loop']) for c in CLIPS]
    for ob in built.values():
        ob.modifiers['Outline'].show_viewport = False
    tris = {'body': S.tri_count([built['ooze_body']]),
            'brine': S.tri_count([built['ooze_body'], built['ooze_junk']]),
            'pearl': S.tri_count([built['ooze_body'], built['ooze_pearls']])}
    for ob in built.values():
        ob.modifiers['Outline'].show_viewport = True
    log('tris', tris)
    if RENDER:
        made = review(acts, tris)
        log('renders:', ', '.join(os.path.basename(p) for p in made))
    for o in list(bpy.data.objects):
        if ('.' in o.name and o.name.split('.')[0] in MESHES) or o.name.startswith('V.'):
            bpy.data.objects.remove(o, do_unlink=True)
    common.save_blend(os.path.join(BUILD, 'ooze.blend'))
    from export import export_glb
    for ob in built.values():
        S.finish(ob)
        if 'Outline' in ob.modifiers:
            ob.modifiers.remove(ob.modifiers['Outline'])
        ob['kind'] = 'monster' if ob.name == 'ooze_body' else 'part'
        ob['base'] = BASE
        for kb in ob.data.shape_keys.key_blocks[1:]:
            kb.value = 0.0
        S.stash(ob.data.shape_keys, acts)
    root['kind'] = 'monster-root'
    root['base'] = BASE
    bpy.context.view_layer.update()
    path = os.path.join(S.MON, BASE + '.glb')
    export_glb(path, [root] + list(built.values()), animations=True, animation_mode='ACTIONS',
               extra={'export_optimize_animation_size': False, 'export_merge_animation': 'ACTION',
                      'export_morph_animation': True})
    entries = {}
    for name, vv in VARIANTS.items():
        entries[name] = dict(base=BASE, scale=vv['scale'], parts=vv['parts'], shapes=vv['shapes'], palette=vv['palette'],
                             slots=vv['slots'], clipSpeed=vv['clipSpeed'],
                             tris=tris['brine' if name == 'brine-ooze' else 'pearl'])
    S.write_manifest(entries)
    S.write_clips(BASE, 'morph', [dict(name=c['name'], seconds=c['seconds'], loop=c['loop'], events=c['events'])
                                  for c in CLIPS],
                  extra={'root': 'Ooze', 'meshes': list(MESHES), 'morphs': [k for k, _ in KEYS],
                         'note': 'every mesh carries the same clip_* morph targets in the same order; keep them live'})
    reimport(path)


def reimport(path):
    from export import reimport_report
    lines = reimport_report(path, os.path.join(OUT, 'reimport_check.png') if RENDER else None)
    sc = bpy.context.scene
    act = bpy.data.actions.get('Attack1')
    body = bpy.data.objects.get('ooze_body')
    if act and body and body.data.shape_keys:
        for o in bpy.data.objects:
            if o.type == 'MESH' and o.data.shape_keys:
                s = next((s for s in act.slots if s.identifier == 'KE' + o.name), None)
                if s:
                    adt = o.data.shape_keys.animation_data or o.data.shape_keys.animation_data_create()
                    adt.action = act
                    adt.action_slot = s
        reach = []
        for fr in (0, round(0.45 * sc.render.fps)):
            sc.frame_set(fr)
            dg = bpy.context.evaluated_depsgraph_get()
            ev = body.evaluated_get(dg)
            me = ev.to_mesh()
            reach.append(-min((ev.matrix_world @ v.co).y for v in me.vertices))
            ev.to_mesh_clear()
        lines.append('  - re-imported Attack1: the body reaches %.2f m forward at frame 0, %.2f m at the hit; slots %s' %
                     (reach[0], reach[1], ', '.join(s.identifier for s in act.slots)))
        lines.append('  - morph targets on the re-imported meshes: %s' %
                     ', '.join('%s %d' % (o.name, len(o.data.shape_keys.key_blocks) - 1) for o in bpy.data.objects
                               if o.type == 'MESH' and o.data.shape_keys))
    for ln in lines:
        log(ln)


main()

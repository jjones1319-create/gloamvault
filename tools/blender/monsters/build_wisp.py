"""build_wisp.py — the wisp base (06 §3.5): the Vault Lantern (a wisp in a drowned iron cage) and the pet Wisp.

Run:  blender -b -P tools/blender/monsters/build_wisp.py -- [--quick] [--no-renders]

A sphere of light with no skeleton: a white core (`wisp_body`, slot 14 gem, emissive), five flame tongues curling round
it with gaps that show the core (`wisp_glow`, slot 11 glow, emissive), a ring of motes (`wisp_motes`, 11) and — for the
Vault Lantern — a rusted hexagonal cage with a roof, a hanging ring and kelp (`wisp_cage`, slots 1 and 0). Nodes:
`Wisp` (the floor origin, never animated) → `wisp_float` (the hover point, 1.2 m up) → the four meshes. The clips are
object-level animations, one glTF animation per clip with every node's channels: Idle (bob, pulse, the tongues swirl,
the motes orbit, the cage sways), Move (leans in, streams), Attack1 (gathers and flares — Drowned Light), Attack2
(darts forward and back), Hit (flicker), Death (gutters out; the cage drops and tips over). The manifest's `slots`
colour the glow (11) and the core (14) per variant.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import spirit_lib as S  # noqa: E402
from spirit_lib import MB  # noqa: E402

import common  # noqa: E402
from common import BUILD, RENDERS, log  # noqa: E402

A = S.args()
QUICK = bool(A.get('quick'))
RENDER = not A.get('no_renders')
BASE = 'wisp'
OUT = os.path.join(RENDERS, 'monsters', BASE)
FLOAT_Z = 1.2

VARIANTS = {
    'vault-lantern': dict(scale=1.0, parts=['wisp_glow', 'wisp_motes', 'wisp_cage'], shapes={},
                          palette=['#4f9e86', '#7b4a2c', '#f2fff8'], slots={'11': '#6fe3c2', '14': '#f4fffa'},
                          clipSpeed=1.0),
    'wisp': dict(scale=0.65, parts=['wisp_glow', 'wisp_motes'], shapes={}, palette=['#f2e3a6', '#ffd166', '#fff8e1'],
                 slots={'11': '#ffd166', '14': '#fff8e1'}, clipSpeed=1.1, pet=True),
}
# the pet's colours come from its content record (content/pets/wisp.json → visual.palette): glow = its 2nd, core = its 3rd
try:
    _pal = common.read_json(os.path.join(common.CONTENT, 'pets', 'wisp.json'))['visual']['palette']
    VARIANTS['wisp'].update(palette=list(_pal[:3]), slots={'11': _pal[1], '14': _pal[2]})
except Exception as _e:  # noqa: F841 — keep the defaults above
    pass
NODES = ('wisp_float', 'wisp_body', 'wisp_glow', 'wisp_motes', 'wisp_cage')


# ================================================================ meshes (each in its node's local space)
def build_core(col):
    mb = MB()
    nseg, nring, r = 12, 7, CORE_R
    rings = []
    for j in range(1, nring):
        ph = -math.pi / 2 + math.pi * j / nring
        rings.append([mb.v((r * math.cos(ph) * math.cos(2 * math.pi * i / nseg), r * math.cos(ph) * math.sin(2 * math.pi * i / nseg),
                            r * math.sin(ph))) for i in range(nseg)])
    bot = mb.v((0, 0, -r))
    top = mb.v((0, 0, r))
    mb.begin('core')
    mb.fan(rings[0], bot, 14, flip=True)
    for k in range(len(rings) - 1):
        mb.bridge(rings[k], rings[k + 1], 14)
    mb.fan(rings[-1], top, 14)
    f = mb.end()
    mb.orient(f, (0, 0, 0))
    return mb, mb.build('wisp_body', col)


CORE_R = 0.088


def tongue(mb, pts, width, thick, slot=11):
    """A flame tongue: a diamond-section loft along pts, `width(t)` across, `thick(t)` deep, pointed at the tip."""
    n_t = len(pts)
    rings = []
    for j, p in enumerate(pts):
        t = j / (n_t - 1)
        tang = (pts[min(n_t - 1, j + 1)] - pts[max(0, j - 1)]).normalized()
        radial = Vector((p.x, p.y, 0))
        radial = radial.normalized() if radial.length > 1e-4 else Vector((0, 1, 0))
        side = tang.cross(radial)
        side = side.normalized() if side.length > 1e-4 else Vector((1, 0, 0))
        out = side.cross(tang).normalized()
        w, th = width(t), thick(t)
        rings.append([mb.v(p + side * w), mb.v(p + out * th), mb.v(p - side * w), mb.v(p - out * th)])
    mb.begin('tongue')
    base = mb.v(pts[0] - (pts[1] - pts[0]).normalized() * 0.01)
    mb.fan(rings[0], base, slot, flip=True)
    for j in range(n_t - 1):
        mb.bridge(rings[j], rings[j + 1], slot)
    tip = mb.v(pts[-1] + (pts[-1] - pts[-2]).normalized() * 0.04)
    mb.fan(rings[-1], tip, slot)
    f = mb.end()
    mb.orient(f, lambda c, pts=pts: nearest(c, pts))


def build_glow(col):
    """A corona of narrow flames licking up round the core (the core shows between them from every side) and a tail
    of flame rising from its crown, swept back a little."""
    mb = MB()
    n_t = 8
    for k, (lat, reach, rise, sweep) in enumerate(((-35, 0.13, 0.20, 34), (-10, 0.14, 0.24, 30), (-28, 0.12, 0.17, 40),
                                                   (-5, 0.15, 0.26, 26), (-30, 0.13, 0.21, 36), (-12, 0.14, 0.22, 32))):
        a0 = math.radians(k * 60 + 15)
        la = math.radians(lat)
        pts = []
        for j in range(n_t):
            t = j / (n_t - 1)
            r = CORE_R * 0.85 * math.cos(la) + (reach - CORE_R * 0.85 * math.cos(la)) * math.sin(math.pi * min(1.0, t * 1.3) / 2) \
                - 0.05 * t ** 2
            z = CORE_R * 0.85 * math.sin(la) + (rise - CORE_R * 0.85 * math.sin(la)) * t ** 1.15
            a = a0 + math.radians(sweep) * t                      # the flames swirl
            pts.append(Vector((r * math.cos(a), r * math.sin(a), z)))
        tongue(mb, pts, lambda t: 0.030 * math.sin(math.pi * min(1.0, 0.15 + t)) ** 0.6 + 0.004,
               lambda t: 0.012 * math.sin(math.pi * min(1.0, 0.1 + t)) + 0.003)
    # the tail: from the crown, up and a little back
    pts = [Vector((0, 0.01 + 0.06 * t ** 2, CORE_R * 0.8 + 0.24 * t)) for t in [j / 7 for j in range(8)]]
    tongue(mb, pts, lambda t: 0.050 * math.sin(math.pi * min(1.0, 0.25 + t * 0.8)) ** 0.7 + 0.004,
           lambda t: 0.030 * math.sin(math.pi * min(1.0, 0.2 + t * 0.85)) + 0.004)
    return mb, mb.build('wisp_glow', col)


def nearest(c, pts):
    best = None
    for p, q in zip(pts, pts[1:]):
        ab = q - p
        t = max(0.0, min(1.0, (c - p).dot(ab) / max(1e-9, ab.length_squared)))
        x = p + ab * t
        if best is None or (x - c).length < (best - c).length:
            best = x
    return best


def octa(mb, c, s, slot):
    vs = [mb.v(c + Vector(d) * s) for d in ((1, 0, 0), (0, 1, 0), (-1, 0, 0), (0, -1, 0), (0, 0, 1.4), (0, 0, -1.4))]
    mb.begin('mote')
    ring = vs[:4]
    mb.fan(ring, vs[4], slot)
    mb.fan(ring, vs[5], slot, flip=True)
    f = mb.end()
    mb.orient(f, c)


def build_motes(col):
    mb = MB()
    for (r, a, z, s) in ((0.22, 10, 0.05, 0.022), (0.25, 75, -0.07, 0.018), (0.20, 140, 0.16, 0.02), (0.26, 205, 0.0, 0.025),
                         (0.23, 260, 0.12, 0.017), (0.21, 320, -0.10, 0.021)):
        c = Vector((r * math.cos(math.radians(a)), r * math.sin(math.radians(a)), z))
        octa(mb, c, s, 11)
    return mb, mb.build('wisp_motes', col)


def tube(mb, pts, rad, n, slot, cap0=True, cap1=True):
    rings = []
    for j, p in enumerate(pts):
        tang = (pts[min(len(pts) - 1, j + 1)] - pts[max(0, j - 1)]).normalized()
        u, v = S.frame_from(tang, Vector((0, -1, 0)) if abs(tang.y) < 0.9 else Vector((1, 0, 0)))
        r = rad(j / (len(pts) - 1)) if callable(rad) else rad
        rings.append([mb.v(p + u * (r * math.cos(2 * math.pi * i / n)) + v * (r * math.sin(2 * math.pi * i / n)))
                      for i in range(n)])
    mb.begin('tube')
    for j in range(len(rings) - 1):
        mb.bridge(rings[j], rings[j + 1], slot)
    if cap0:
        mb.fan(rings[0], mb.v(pts[0] - (pts[1] - pts[0]).normalized() * 0.003), slot, flip=True)
    if cap1:
        mb.fan(rings[-1], mb.v(pts[-1] + (pts[-1] - pts[-2]).normalized() * 0.003), slot)
    f = mb.end()
    mb.orient(f, lambda c, pts=pts: nearest(c, pts))


def hex_band(mb, z, r, w, h, slot):
    """A hexagonal frame ring: a w × h rectangle swept round a hexagon of circumradius r at height z."""
    secs = []
    for i in range(6):
        a = math.radians(i * 60)
        c = Vector((r * math.cos(a), r * math.sin(a), z))
        out = Vector((math.cos(a), math.sin(a), 0)) / math.cos(math.radians(30)) * 0.5
        secs.append([mb.v(c + out * w + Vector((0, 0, -h / 2))), mb.v(c + out * w + Vector((0, 0, h / 2))),
                     mb.v(c - out * w + Vector((0, 0, h / 2))), mb.v(c - out * w + Vector((0, 0, -h / 2)))])
    mb.begin('band')
    for i in range(6):
        a, b = secs[i], secs[(i + 1) % 6]
        for q in range(4):
            mb.f((a[q], b[q], b[(q + 1) % 4], a[(q + 1) % 4]), slot)
    f = mb.end()
    mb.orient(f, lambda c, z=z, r=r: Vector((c.x, c.y, 0)).normalized() * r + Vector((0, 0, z)))


def build_cage(col):
    mb = MB()
    R = 0.158
    zb, zt = -0.165, 0.172
    for i in range(6):
        a = math.radians(i * 60)
        tube(mb, [Vector((R * math.cos(a), R * math.sin(a), z)) for z in (zb, (zb + zt) / 2, zt)], 0.012, 6, 1, False, False)
    hex_band(mb, zt, R, 0.024, 0.026, 1)
    hex_band(mb, zb, R, 0.024, 0.026, 1)
    # bottom plate: a shallow hexagonal dish with a finial
    mb.begin('plate')
    rim_top = [mb.v((0.165 * math.cos(math.radians(i * 60)), 0.165 * math.sin(math.radians(i * 60)), zb - 0.006)) for i in range(6)]
    rim_bot = [mb.v((0.13 * math.cos(math.radians(i * 60)), 0.13 * math.sin(math.radians(i * 60)), zb - 0.03)) for i in range(6)]
    ctop = mb.v((0, 0, zb - 0.004))
    mb.fan(rim_top, ctop, 1)
    mb.bridge(rim_bot, rim_top, 1)
    fin = mb.v((0, 0, zb - 0.075))
    mb.fan(rim_bot, fin, 1, flip=True)
    f = mb.end()
    mb.orient(f, (0, 0, zb - 0.015))
    # an open crown instead of a roof (the wisp must show from the fight camera above): six ribs from the top band
    # to a small cap that carries the hanging ring
    cap_z = zt + 0.105
    for i in range(6):
        a = math.radians(i * 60)
        p0 = Vector((R * math.cos(a), R * math.sin(a), zt + 0.01))
        p2 = Vector((0.04 * math.cos(a), 0.04 * math.sin(a), cap_z))
        p1 = p0.lerp(p2, 0.5) + Vector((0.02 * math.cos(a), 0.02 * math.sin(a), 0.025))
        tube(mb, [p0, p1, p2], 0.0105, 5, 1, False, False)
    mb.begin('cap')
    cap_lo = [mb.v((0.05 * math.cos(math.radians(i * 60)), 0.05 * math.sin(math.radians(i * 60)), cap_z - 0.012)) for i in range(6)]
    cap_hi = [mb.v((0.042 * math.cos(math.radians(i * 60)), 0.042 * math.sin(math.radians(i * 60)), cap_z + 0.022)) for i in range(6)]
    mb.bridge(cap_lo, cap_hi, 1)
    mb.fan(cap_hi, mb.v((0, 0, cap_z + 0.03)), 1)
    mb.fan(cap_lo, mb.v((0, 0, cap_z - 0.02)), 1, flip=True)
    f = mb.end()
    mb.orient(f, (0, 0, cap_z + 0.005))
    ring_c = Vector((0, 0, cap_z + 0.072))
    pts = [ring_c + Vector((0.042 * math.cos(2 * math.pi * i / 10), 0, 0.042 * math.sin(2 * math.pi * i / 10))) for i in range(11)]
    tube(mb, pts, 0.011, 5, 1, False, False)
    # kelp caught on the bars, hanging down the outside to the bottom band (strands under the cage read as legs)
    for k, (a, L, ph) in enumerate(((30, 0.24, 0.0), (150, 0.19, 1.3), (270, 0.26, 2.1))):
        ar = math.radians(a)
        p0 = Vector((0.172 * math.cos(ar), 0.172 * math.sin(ar), zb + L - 0.03))
        pts = [p0 + Vector((0.012 * math.sin(4 * t + ph) * math.cos(ar + 1.5) + 0.02 * t * math.cos(ar),
                            0.012 * math.sin(4 * t + ph) * math.sin(ar + 1.5) + 0.02 * t * math.sin(ar), -L * t))
               for t in [j / 4 for j in range(5)]]
        tube(mb, pts, lambda t: 0.013 * (1 - 0.6 * t) + 0.004, 4, 0, False, True)
    return mb, mb.build('wisp_cage', col)


# ================================================================ clips (node animations)
CLIPS = []


def clip(name, seconds, loop=False, events=None, shots=None):
    def deco(fn):
        CLIPS.append(dict(name=name, seconds=seconds, loop=loop, events=events or {}, fn=fn, shots=shots))
        return fn
    return deco


def state(fl=(0, 0, 0), tilt=(0, 0, 0), spin=0.0, glow=1.0, core=1.0, motes_rot=0.0, motes=1.0, cage=(0, 0, 0),
          cage_loc=(0, 0, 0)):
    g = glow if isinstance(glow, tuple) else (glow, glow, glow)
    m = motes if isinstance(motes, tuple) else (motes, motes, motes)
    return {'wisp_float': {'loc': (fl[0], fl[1], FLOAT_Z + fl[2]), 'rot': tilt, 'scl': 1.0},
            'wisp_body': {'loc': (0, 0, 0), 'rot': (0, 0, 0), 'scl': core},
            'wisp_glow': {'loc': (0, 0, 0), 'rot': (0, 0, spin), 'scl': g},
            'wisp_motes': {'loc': (0, 0, 0), 'rot': (0, 0, motes_rot), 'scl': m},
            'wisp_cage': {'loc': cage_loc, 'rot': cage, 'scl': 1.0}}


def idle_state(t, T=2.0):
    ph = 2 * math.pi * t / T
    return state(fl=(0, 0, 0.035 * math.sin(ph)), tilt=(3 * math.sin(ph + 0.6), 2 * math.cos(ph), 0), spin=360 * t / T,
                 glow=1 + 0.07 * math.sin(2 * ph), core=1 - 0.06 * math.sin(2 * ph), motes_rot=-360 * t / T,
                 cage=(4 * math.sin(ph + 0.9), 3 * math.cos(ph + 0.4), 0))


def move_state(t, T=1.0):
    ph = 2 * math.pi * t / T
    return state(fl=(0, 0, 0.03 * math.sin(2 * ph)), tilt=(14, 3 * math.sin(ph), 0), spin=720 * t / T,
                 glow=(1.0, 1.15 + 0.05 * math.sin(2 * ph), 0.95), core=1.0, motes_rot=-720 * t / T,
                 motes=(1.0, 1.25, 1.0), cage=(-10 + 3 * math.sin(2 * ph), 0, 0))


def sampled(T, fn, step=2):
    n = round(T * S.FPS)
    keys = [(f / S.FPS, fn(f / S.FPS)) for f in range(0, n, step)]
    end = fn(0.0)
    # the spin angles must end a whole number of turns on, not back at 0 (the Cycles modifier repeats the curve)
    last = fn(T - 1e-9)
    for nm in ('wisp_glow', 'wisp_motes'):
        end[nm] = dict(end[nm])
        end[nm]['rot'] = last[nm]['rot']
    keys.append((T, end))
    return keys


def objects_keys(keys):
    obs = {nm: bpy.data.objects[nm] for nm in NODES}
    return [(t, {obs[nm]: tf for nm, tf in d.items()}) for t, d in keys]


@clip('Idle', 2.0, loop=True, shots=[0, 0.33, 0.67, 1.0, 1.33, 1.67])
def c_idle():
    return sampled(2.0, idle_state)


@clip('Move', 1.0, loop=True, shots=[0, 0.17, 0.33, 0.5, 0.67, 0.83])
def c_move():
    return sampled(1.0, move_state)


@clip('Attack1', 0.9, events={'hit': 0.45}, shots=[0, 0.2, 0.33, 0.45, 0.6, 0.8])
def c_attack1():
    i0 = idle_state(0)
    gather = state(fl=(0, 0.08, 0.02), tilt=(-6, 0, 0), spin=80, glow=0.72, core=0.78, motes_rot=-60, motes=0.7,
                   cage=(-6, 0, 0))
    flare = state(fl=(0, -0.15, 0.0), tilt=(10, 0, 0), spin=200, glow=1.75, core=1.55, motes_rot=-150, motes=1.9,
                  cage=(8, 0, 0))
    after = state(fl=(0, -0.08, 0.0), tilt=(4, 0, 0), spin=280, glow=1.2, core=1.15, motes_rot=-230, motes=1.3,
                  cage=(4, 0, 0))
    end = dict(i0)
    end['wisp_glow'] = dict(i0['wisp_glow'], rot=(0, 0, 360))
    end['wisp_motes'] = dict(i0['wisp_motes'], rot=(0, 0, -360))
    return [(0.0, i0), (0.3, gather), (0.45, flare), (0.6, after), (0.9, end)]


@clip('Attack2', 0.8, events={'hit': 0.35}, shots=[0, 0.18, 0.28, 0.35, 0.5, 0.7])
def c_attack2():
    i0 = idle_state(0)
    back = state(fl=(0, 0.12, 0.05), tilt=(-10, 0, 0), spin=60, glow=0.9, core=0.95, motes_rot=-40, cage=(-8, 0, 0))
    dart = state(fl=(0, -0.72, -0.16), tilt=(22, 0, 0), spin=160, glow=(0.85, 1.4, 0.85), core=1.1, motes_rot=-120,
                 motes=(0.9, 1.5, 0.9), cage=(-16, 0, 0))
    ret = state(fl=(0, -0.22, -0.04), tilt=(6, 0, 0), spin=260, glow=1.05, core=1.0, motes_rot=-220, cage=(10, 0, 0))
    end = dict(i0)
    end['wisp_glow'] = dict(i0['wisp_glow'], rot=(0, 0, 360))
    end['wisp_motes'] = dict(i0['wisp_motes'], rot=(0, 0, -360))
    return [(0.0, i0), (0.18, back), (0.35, dart), (0.55, ret), (0.8, end)]


@clip('Hit', 0.4, shots=[0, 0.04, 0.08, 0.13, 0.2, 0.3])
def c_hit():
    i0 = idle_state(0)
    seq = [(0.04, 0.5, 0.7, (0, 0.10, 0.02), (-16, 0, 6)), (0.08, 1.28, 1.2, (0, 0.13, 0.03), (-12, 0, -4)),
           (0.13, 0.62, 0.8, (0, 0.10, 0.02), (6, 0, 4)), (0.2, 1.12, 1.08, (0, 0.05, 0.01), (-4, 0, -2)),
           (0.28, 0.88, 0.94, (0, 0.02, 0.0), (2, 0, 0))]
    keys = [(0.0, i0)]
    for t, g, c, fl, cg in seq:
        keys.append((t, state(fl=fl, spin=20 * t / 0.4, glow=g, core=c, motes_rot=-10 * t / 0.4, cage=cg)))
    keys.append((0.4, i0))
    return keys


@clip('Death', 1.4, events={'down': 1.15}, shots=[0, 0.2, 0.45, 0.7, 0.95, 1.2])
def c_death():
    i0 = idle_state(0)
    keys = [(0.0, i0)]
    for t, g, fz, m, cage, cl in ((0.2, 1.3, 0.04, 1.3, (6, 0, 0), (0, 0, 0)), (0.4, 0.6, 0.0, 1.6, (-6, 4, 0), (0, 0, 0)),
                                  (0.5, 1.05, -0.05, 1.5, (4, -4, 0), (0, 0, 0)), (0.65, 0.4, -0.25, 1.0, (8, 10, 0), (0, 0, 0)),
                                  (0.9, 0.12, -0.6, 0.4, (14, 30, 0), (0, 0, 0)), (1.05, 0.001, -0.88, 0.001, (10, 70, 0), (0, 0, 0)),
                                  (1.15, 0.001, -0.95, 0.001, (4, 88, 0), (0, 0, 0)), (1.4, 0.001, -0.95, 0.001, (4, 88, 0), (0, 0, 0))):
        keys.append((t, state(fl=(0, 0, fz), spin=90 * t, glow=g, core=g, motes_rot=-120 * t, motes=m, cage=cage, cage_loc=cl)))
    return keys


def author():
    acts = []
    for c in CLIPS:
        acts.append(S.make_node_action(c['name'], objects_keys(c['fn']()), loop=c['loop']))
    return acts


# ================================================================ review
def variant(col, name, at_=(0, 0, 0), rot=0.0, act=None, offset=0, outline=None):
    v = VARIANTS[name]
    root = bpy.data.objects.new('V.%s' % name, None)
    col.objects.link(root)
    root.location = at_
    root.rotation_euler = (0, 0, math.radians(rot))
    root.scale = (v['scale'],) * 3
    src = {nm: bpy.data.objects[nm] for nm in NODES}
    fl = src['wisp_float'].copy()
    fl.name = 'wisp_float.%s' % name
    col.objects.link(fl)
    fl.parent = root
    objs = [fl]
    for nm in NODES[1:]:
        if nm != 'wisp_body' and nm not in v['parts']:
            continue
        o = src[nm].copy()
        o.data = src[nm].data.copy()
        o.name = '%s.%s' % (nm, name)
        col.objects.link(o)
        o.parent = fl
        S.set_material(o, v['palette'], v['slots'], name='GV_%s' % name)
        o.hide_render = False
        if outline:
            S.set_outline([o], outline)
        objs.append(o)
    if act:
        for o in objs:
            S.assign(o, act, slot_src=src[o.name.split('.')[0]], offset_frames=offset)
    return root, objs


def remove(objs):
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)


def review(acts, tris):
    rv = S.Review(OUT, quick=QUICK, floor_color=(0.03, 0.045, 0.05))
    col = bpy.data.collections.new('Review')
    bpy.context.scene.collection.children.link(col)
    for nm in NODES:
        bpy.data.objects[nm].hide_render = True
    made = []
    idle = bpy.data.actions['Idle']
    rv.hero.hide_render = False
    rv.hero.location = (-0.9, 0, 0)
    placed = [variant(col, 'vault-lantern', at_=(0.15, 0, 0), act=idle), variant(col, 'wisp', at_=(0.95, 0, 0), act=idle)]
    bpy.context.scene.frame_set(8)
    pts = S.world_points([rv.hero], step=20)
    for _r, objs in placed:
        pts += S.world_points(objs, step=2)
    rv.label3d('hero 1.8 m', (-0.9, -0.55, 0.02), size=0.08)
    rv.label3d('vault-lantern\n1.0x  %s tris' % format(tris['lantern'], ','), (0.15, -0.55, 0.02), size=0.08)
    rv.label3d('wisp (pet)\n0.65x  %s tris' % format(tris['pet'], ','), (0.95, -0.55, 0.02), size=0.08)
    rv.fit(pts + [Vector((0, -0.6, 0))], az=14, el=10, lens=50)
    made.append(rv.shot('lineup.png', w=1200 if QUICK else 1600, h=900 if QUICK else 1200))
    rv.clear_labels()
    rv.hero.hide_render = True
    for r, objs in placed:
        remove(objs + [r])
    reads = []
    for name in VARIANTS:
        r, objs = variant(col, name, act=idle)
        bpy.context.scene.frame_set(8)
        rv.fit(S.world_points(objs, step=2), az=32, el=20, lens=50)
        big = rv.shot('_card_%s.png' % name, size=512 if QUICK else 1024)
        reads.append(rv.downscale(big, os.path.join(OUT, 'read200_%s.png' % name), 200))
        remove(objs + [r])
    made.append(rv.sheet(reads, os.path.join(OUT, 'read200_sheet.png'), cols=len(reads)))
    for act in acts:
        c = next(c for c in CLIPS if c['name'] == act.name)
        frames = [round(t * S.FPS) for t in c['shots']]
        st = {}

        def place(row, act=act):
            for o in st.get('objs', []) + ([st['root']] if 'root' in st else []):
                bpy.data.objects.remove(o, do_unlink=True)
            st['root'], st['objs'] = variant(col, row, act=act)

        def bounds(row):
            return S.world_points(st['objs'], step=2) + [Vector((0, 0, 0))]

        def label(row, fr, c=c):
            t = fr / S.FPS
            ev = [k for k, v in c['events'].items() if abs(v - t) < 0.02]
            return '%s · %s\n%.2f s  f%d  %s' % (c['name'], row, t, fr, ' '.join(ev))
        made.append(rv.strip('clip_%s' % act.name, frames, bounds, place, label, rows=['vault-lantern', 'wisp'],
                              az=50, el=10, lens=50))
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
    placed = [variant(col, 'vault-lantern', at_=(1.2, -0.4, 0), rot=S.fight_rot('enemy'), act=bpy.data.actions['Idle'],
                      outline=0.016),
              variant(col, 'vault-lantern', at_=(2.4, 0.5, 0), rot=S.fight_rot('enemy'), act=bpy.data.actions['Idle'],
                      offset=20, outline=0.016),
              variant(col, 'wisp', at_=(-3.3, 0.0, 0), rot=S.fight_rot('party'), act=bpy.data.actions['Idle'], offset=10,
                      outline=0.016)]
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
    path = rv.shot('fight_drowned_choir.png', w=S.FIGHT_W, h=S.FIGHT_H)
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
    col = common.collection('Wisp')
    root = bpy.data.objects.new('Wisp', None)
    col.objects.link(root)
    fl = bpy.data.objects.new('wisp_float', None)
    col.objects.link(fl)
    fl.parent = root
    fl.location = (0, 0, FLOAT_Z)
    built = {}
    for nm, fn in (('wisp_body', build_core), ('wisp_glow', build_glow), ('wisp_motes', build_motes), ('wisp_cage', build_cage)):
        mb, ob = fn(col)
        ob.parent = fl
        built[nm] = ob
        log('%s: %d tris' % (nm, mb.tris()))
    v = VARIANTS['vault-lantern']
    for ob in built.values():
        S.look(ob, v['palette'], v['slots'])
    acts = author()
    for ob in built.values():
        ob.modifiers['Outline'].show_viewport = False
    tris = {'lantern': S.tri_count(built.values()),
            'pet': S.tri_count([built[n] for n in ('wisp_body', 'wisp_glow', 'wisp_motes')])}
    for ob in built.values():
        ob.modifiers['Outline'].show_viewport = True
    log('tris', tris)
    if RENDER:
        made = review(acts, tris)
        log('renders:', ', '.join(os.path.basename(p) for p in made))
    for o in list(bpy.data.objects):
        if '.' in o.name and o.name.split('.')[0] in NODES or o.name.startswith('V.'):
            bpy.data.objects.remove(o, do_unlink=True)
    common.save_blend(os.path.join(BUILD, 'wisp.blend'))
    # export: the five nodes and the root, every clip stashed on each animated node
    from export import export_glb
    for ob in built.values():
        S.finish(ob)
        if 'Outline' in ob.modifiers:
            ob.modifiers.remove(ob.modifiers['Outline'])
        ob['kind'] = 'monster' if ob.name == 'wisp_body' else 'part'
        ob['base'] = BASE
    for nm in NODES:
        S.stash(bpy.data.objects[nm], acts)
    fl.location = (0, 0, FLOAT_Z)
    fl.rotation_euler = (0, 0, 0)
    for ob in built.values():
        ob.location = (0, 0, 0)
        ob.rotation_euler = (0, 0, 0)
        ob.scale = (1, 1, 1)
    root['kind'] = 'monster-root'
    root['base'] = BASE
    bpy.context.view_layer.update()
    path = os.path.join(S.MON, BASE + '.glb')
    export_glb(path, [root, fl] + list(built.values()), animations=True, animation_mode='ACTIONS',
               extra={'export_optimize_animation_size': False, 'export_merge_animation': 'ACTION'})
    entries = {}
    for name, vv in VARIANTS.items():
        e = dict(base=BASE, scale=vv['scale'], parts=vv['parts'], shapes=vv['shapes'], palette=vv['palette'],
                 slots=vv['slots'], clipSpeed=vv['clipSpeed'], tris=tris['lantern' if name == 'vault-lantern' else 'pet'])
        if vv.get('pet'):
            e['pet'] = name
            entries['pet-' + name] = dict(e)     # the other passes key pets as pet-<id>; the brief asked for <id>: both
        entries[name] = e
    S.write_manifest(entries)
    S.write_clips(BASE, 'node', [dict(name=c['name'], seconds=c['seconds'], loop=c['loop'], events=c['events'])
                                 for c in CLIPS], extra={'root': 'Wisp', 'nodes': list(NODES)})
    reimport(path)


def reimport(path):
    from export import reimport_report
    lines = reimport_report(path, os.path.join(OUT, 'reimport_check.png') if RENDER else None)
    sc = bpy.context.scene
    act = bpy.data.actions.get('Attack1')
    glow = bpy.data.objects.get('wisp_glow')
    if act and glow:
        for o in bpy.data.objects:
            s = next((s for s in act.slots if s.identifier == 'OB' + o.name), None)
            if s:
                adt = o.animation_data or o.animation_data_create()
                adt.action = act
                adt.action_slot = s
        sc.frame_set(0)
        a = glow.matrix_world.to_scale().x
        sc.frame_set(round(0.45 * sc.render.fps))
        b = glow.matrix_world.to_scale().x
        lines.append('  - re-imported Attack1: wisp_glow scale %.2f → %.2f at the hit; slots %s' %
                     (a, b, ', '.join(s.identifier for s in act.slots)))
    for ln in lines:
        log(ln)


main()

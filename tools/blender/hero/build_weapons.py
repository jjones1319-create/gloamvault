"""build_weapons.py — every weapon, shield and focus mesh, and the Ranger's quiver (tools/blender/README.md §Gear).

Run:  blender -b art/build/hero_body.blend -P tools/blender/hero/build_weapons.py -- [--quick] [--only sword,bow]
                                                                         [--no-renders] [--no-export] [--check]

One mesh family per `weaponType` in content/items, in two tiers — **F** (crude: metal, wood and leather slots only)
and **S** (fine: a shaped guard or head, `trim` fittings, a `glow` fuller or rune, a `gem` where it fits) — plus the
three shield types, a second focus (the Mender's holy symbol beside the Arcanist's orb; both are weaponType `focus`)
and the quiver from the Ranger sheet with two fill states (full / half; empty = no arrows mesh).

Conventions (the contract): rigid meshes modelled with the **grip at the origin**, the blade or shaft along **+Y**,
edges in the YZ plane (+Z = the knuckle side of the fist: a sword's edges face ±Z, an axe's edge faces +Z), real
sizes at the broad frame's scale but chunky. The hand socket's measured fist spans y −0.078…+0.055 around its origin
(guards start above +0.058, pommels below −0.085) and the forearm stays below z −0.086, so nothing along Y can reach
it. Two-handers: the main hand at the origin, the off hand at `offhandY` (negative = lower on the handle; the crossbow's
is its fore-stock, ahead of the main hand). Bows: limbs along ±Y, the string toward −Z (`stringZ`). Shields (left hand):
the board stands in the socket's YZ plane with its face toward **+X = the back of the left hand** (outward in the
A-pose, forward in a guard with the forearm across the body); the long axis runs along the forearm (Z), the kite's
point toward +Z (the fingers), its top toward the elbow, a grip bar through the fist and a strap round the forearm.
Quiver: Socket_Back space (+Y up, +Z away from the back, +X = the character's right), mouth over the draw shoulder.

Palette slots per face (`toon.split_by_face_slots`); hard edges are kept as per-corner custom normals by angle, per part
(blades crisp, grips round). Outputs: art/build/weapons.blend, client/public/models/hero/weapons.glb (outlines removed,
custom properties as extras), review renders in art/renders/hero/weapons/.
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'lib'))
from common import BUILD, CONTENT, MODELS, RENDERS, REPO, args, collection, log, read_json, save_blend  # noqa: E402
import toon  # noqa: E402

ARGS = args()
QUICK = bool(ARGS.get('quick'))
ONLY = [t for t in str(ARGS.get('only', '')).split(',') if t] if ARGS.get('only') else []
OUT = os.path.join(RENDERS, 'hero', 'weapons')
GLB = os.path.join(MODELS, 'hero', 'weapons.glb')
FRAME = 'broad'
OUTLINE = 0.004
BOW_SOCKET = 'Socket_HandR'  # the contract's default; the conventional archer holds the bow in the left hand

SL = toon.SLOT
LEATHER, METAL, TRIM, GLOW, WOOD, BONE, GEM = (SL[k] for k in ('leather', 'metal', 'trim', 'glow', 'wood', 'bone', 'gem'))
CLOTH1, CLOTH2, CLOTH3 = SL['cloth1'], SL['cloth2'], SL['cloth3']
HR, HL, BACK = 'Socket_HandR', 'Socket_HandL', 'Socket_Back'

FIST = {}
for _side in ('Left', 'Right'):
    for _f in ('Index', 'Middle', 'Ring', 'Little'):
        for _ph, _a in (('Proximal', 72), ('Intermediate', 95), ('Distal', 55)):
            FIST[_side + _f + _ph] = (_a, 0, 0)
    for _ph, _a in (('Proximal', 25), ('Intermediate', 40), ('Distal', 35)):
        FIST[_side + 'Thumb' + _ph] = (_a, 0, 0)


# ============================================================================ modelling kit
class Geo:
    """Vertices and faces with one palette slot and one smoothing angle (degrees) per face."""

    def __init__(self):
        self.V, self.F, self.S, self.A = [], [], [], []
        self.props = {}

    def vert(self, p):
        self.V.append(Vector(p))
        return len(self.V) - 1

    def face(self, idx, slot, smooth):
        self.F.append(tuple(idx))
        self.S.append(slot)
        self.A.append(smooth)

    def mark(self):
        return len(self.V)

    def xform(self, mat, start):
        for i in range(start, len(self.V)):
            self.V[i] = mat @ self.V[i]

    def tris(self):
        return sum(len(f) - 2 for f in self.F)


def _p(axis, t, u, v):
    """A point from a coordinate t along the axis and (u, v) across it: Y → (x, z), Z → (x, y), X → (y, z)."""
    if axis == 'Y':
        return Vector((u, t, v))
    if axis == 'Z':
        return Vector((u, v, t))
    return Vector((t, u, v))


def _skin(g, rings, slot, smooth, closed=True, cap0=True, cap1=True, cap_slots=(None, None)):
    sf = slot if callable(slot) else (lambda i, j, s=slot: s)
    n = max(len(r) for r in rings)
    m = n if closed else n - 1
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for j in range(m):
            j2 = (j + 1) % n
            if len(a) == 1 and len(b) == 1:
                continue
            s = sf(i, j)
            if len(a) == 1:
                g.face((a[0], b[j2], b[j]), s, smooth)
            elif len(b) == 1:
                g.face((a[j], a[j2], b[0]), s, smooth)
            else:
                g.face((a[j], a[j2], b[j2], b[j]), s, smooth)
    if cap0 and len(rings[0]) > 2:
        g.face(tuple(reversed(rings[0])), cap_slots[0] if cap_slots[0] is not None else sf(0, 0), smooth)
    if cap1 and len(rings[-1]) > 2 and rings[-1] is not rings[0]:
        g.face(tuple(rings[-1]), cap_slots[1] if cap_slots[1] is not None else sf(len(rings) - 2, 0), smooth)


def _is_tip(pts):
    p0 = Vector(pts[0])
    return all((Vector(p) - p0).length < 1e-7 for p in pts)


def loft(g, sections, slot, smooth=30, axis='Y', closed=True, cap0=True, cap1=True, cap_slots=(None, None)):
    """sections: [(t, [(u, v), ...])], the same point count each; a section whose points coincide is a tip.
    slot: an int or f(i, j) → slot of the side between section i and i+1 at edge j."""
    rings = []
    for t, pts in sections:
        if _is_tip(pts):
            rings.append([g.vert(_p(axis, t, *pts[0]))])
        else:
            rings.append([g.vert(_p(axis, t, u, v)) for u, v in pts])
    _skin(g, rings, slot, smooth, closed, cap0, cap1, cap_slots)
    return rings


def circle(r, n, phase=None, c=(0.0, 0.0), su=1.0, sv=1.0):
    ph = math.pi / n if phase is None else phase
    return [(c[0] + r * su * math.cos(ph + 2 * math.pi * k / n), c[1] + r * sv * math.sin(ph + 2 * math.pi * k / n)) for k in range(n)]


def revolve(g, profile, n, slot, smooth=55, axis='Y', c=(0.0, 0.0), closed_profile=False, phase=None, su=1.0, sv=1.0,
            cap0=True, cap1=True):
    """Revolves [(t, r)] around the axis (centre c in the (u, v) plane). r = 0 is a pole. closed_profile joins the
    last point back to the first (rings, tori)."""
    rings = []
    for t, r in profile:
        if r <= 1e-9 and not closed_profile:
            rings.append([g.vert(_p(axis, t, *c))])
        else:
            rings.append([g.vert(_p(axis, t, u, v)) for u, v in circle(r, n, phase, c, su, sv)])
    if closed_profile:
        rings.append(rings[0])
        _skin(g, rings, slot, smooth, True, False, False)
    else:
        _skin(g, rings, slot, smooth, True, cap0, cap1)
    return rings


def lathe(g, profile, n, slot, smooth=55, **kw):
    return revolve(g, profile, n, slot, smooth, **kw)


def segs(*slots):
    """Slot per profile segment (the last repeats)."""
    return lambda i, j: slots[min(i, len(slots) - 1)]


def sphere(g, c, r, n=8, rings=5, slot=METAL, smooth=70, sy=1.0):
    prof = [(c[1] - r * sy * math.cos(math.pi * k / rings), r * math.sin(math.pi * k / rings)) for k in range(rings + 1)]
    return revolve(g, prof, n, slot, smooth, 'Y', c=(c[0], c[2]))


def torus(g, R, r, n_major, n_minor, slot, axis='Y', c3=(0.0, 0.0, 0.0), smooth=100, tilt=None):
    prof = [(r * math.sin(2 * math.pi * k / n_minor), R + r * math.cos(2 * math.pi * k / n_minor)) for k in range(n_minor)]
    start = g.mark()
    revolve(g, prof, n_major, slot, smooth, 'Y', closed_profile=True)
    rot = {'Y': Matrix.Identity(4), 'X': Matrix.Rotation(math.radians(-90), 4, 'Z'),
           'Z': Matrix.Rotation(math.radians(90), 4, 'X')}[axis]
    if tilt is not None:
        rot = tilt @ rot
    g.xform(Matrix.Translation(Vector(c3)) @ rot, start)


def rod(g, p0, p1, r0, r1=None, n=6, slot=METAL, smooth=100, cap0=True, cap1=True, phase=None):
    """A prism (or frustum) from p0 to p1."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    q = Vector((0, 1, 0)).rotation_difference(d.normalized())
    start = g.mark()
    revolve(g, [(0.0, r0), (d.length, r0 if r1 is None else r1)], n, slot, smooth, 'Y', phase=phase, cap0=cap0, cap1=cap1)
    g.xform(Matrix.Translation(p0) @ q.to_matrix().to_4x4(), start)


def gem(g, c, d, r, h, n=6, slot=GEM):
    """A faceted bipyramid sitting on a surface at c, pointing along d (sunk 20% of h into the surface)."""
    start = g.mark()
    revolve(g, [(-0.2 * h, 0.0), (0.3 * h, r), (h, 0.0)], n, slot, 0, 'Y')
    q = Vector((0, 1, 0)).rotation_difference(Vector(d).normalized())
    g.xform(Matrix.Translation(Vector(c)) @ q.to_matrix().to_4x4(), start)


def offset_poly(pts, d):
    """Moves a polygon's vertices d along their mitred normals (d < 0 shrinks it)."""
    n = len(pts)
    area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n)) / 2
    sgn = 1.0 if area > 0 else -1.0
    out = []
    for i in range(n):
        p0, p1, p2 = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % n])
        e1 = (p1 - p0).normalized()
        e2 = (p2 - p1).normalized()
        n1 = Vector((e1.y, -e1.x)) * sgn
        n2 = Vector((e2.y, -e2.x)) * sgn
        m = n1 + n2
        m = n1 if m.length < 1e-6 else m.normalized()
        k = max(m.dot(n1), 0.35)
        q = p1 + m * (d / k)
        out.append((q.x, q.y))
    return out


def slab(g, outline, half, slot, smooth=30, plane='YZ', mid=0.0, chamfer=0.0, face_slot=None):
    """A flat piece: a 2D outline extruded ± half along the plane's normal (YZ → along X with (y, z) outline points,
    XY → along Z with (x, y), XZ → along Y with (x, z)). The chamfer bevels the rim."""
    axis = {'YZ': 'X', 'XY': 'Z', 'XZ': 'Y'}[plane]
    if chamfer > 0:
        inner = offset_poly(outline, -chamfer)
        secs = [(mid - half, inner), (mid - half + chamfer, outline), (mid + half - chamfer, outline), (mid + half, inner)]
    else:
        secs = [(mid - half, outline), (mid + half, outline)]
    fs = slot if face_slot is None else face_slot
    return loft(g, secs, slot, smooth, axis, True, True, True, (fs, fs))


def rect2(a0, a1, b0, b1):
    return [(a0, b0), (a1, b0), (a1, b1), (a0, b1)]


def box(g, lo, hi, slot, smooth=30, chamfer=0.0):
    """An axis-aligned box lofted along Y (chamfer bevels its edges)."""
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    if chamfer <= 0:
        r = [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]
        return loft(g, [(y0, r), (y1, r)], slot, smooth, 'Y')
    c = chamfer
    o = [(x0 + c, z0), (x1 - c, z0), (x1, z0 + c), (x1, z1 - c), (x1 - c, z1), (x0 + c, z1), (x0, z1 - c), (x0, z0 + c)]
    inner = offset_poly(o, -c * 0.7)
    return loft(g, [(y0, inner), (y0 + c, o), (y1 - c, o), (y1, inner)], slot, smooth, 'Y')


def curve_loft(g, path, sections, slot, smooth=30, up=(1, 0, 0), closed=True, cap0=True, cap1=True):
    """path: 3D points; sections[k]: [(u, v)] in the plane at path[k] spanned by `up` and up × tangent."""
    upv = Vector(up).normalized()
    P = [Vector(p) for p in path]
    rings = []
    for k, p in enumerate(P):
        a, b = P[max(k - 1, 0)], P[min(k + 1, len(P) - 1)]
        nrm = upv.cross((b - a).normalized()).normalized()
        pts = sections[k]
        if _is_tip(pts):
            u, v = pts[0]
            rings.append([g.vert(p + upv * u + nrm * v)])
        else:
            rings.append([g.vert(p + upv * u + nrm * v) for u, v in pts])
    _skin(g, rings, slot, smooth, closed, cap0, cap1)
    return rings


def rect(hu, hv):
    return [(-hu, -hv), (hu, -hv), (hu, hv), (-hu, hv)]


def hexa(hu, hv):
    return [(-hu, 0.0), (-hu * 0.55, -hv), (hu * 0.55, -hv), (hu, 0.0), (hu * 0.55, hv), (-hu * 0.55, hv)]


def blade(g, stations, slot=METAL, fuller_slot=None, smooth=12):
    """A blade lofted along +Y. stations: [(y, z_top, z_bot, t, b, f)]: the +Z and −Z edge positions, the half
    thickness of the flat, the bevel width and the half width of a central band on both flats (the fuller, coloured
    fuller_slot where both its stations have f > 0). A station with z_top == z_bot is the tip."""
    use_f = any(st[5] > 0 for st in stations)
    n = 10 if use_f else 6
    secs = []
    for (y, zt, zb, t, b, f) in stations:
        if abs(zt - zb) < 1e-7:
            secs.append((y, [(0.0, zt)] * n))
            continue
        b = min(b, (zt - zb) * 0.45)
        zc = (zt + zb) / 2
        if use_f:
            f = max(min(f, (zt - zb) / 2 - b - 0.0012), 0.0005)
            pts = [(0, zt), (t, zt - b), (t, zc + f), (t, zc - f), (t, zb + b), (0, zb), (-t, zb + b), (-t, zc - f), (-t, zc + f), (-t, zt - b)]
        else:
            pts = [(0, zt), (t, zt - b), (t, zb + b), (0, zb), (-t, zb + b), (-t, zt - b)]
        secs.append((y, pts))
    on = [st[5] > 0 for st in stations]

    def sf(i, j):
        if fuller_slot is not None and use_f and j in (2, 7) and on[i] and on[i + 1]:
            return fuller_slot
        return slot
    return loft(g, secs, sf, smooth, 'Y')


def axe_head(g, secs, slot, smooth=20):
    """An axe head lofted along Z from the poll to the edge: secs [(z, y_lo, y_hi, t)]. Sides: j 0 = the +X cheek,
    1 = the top, 2 = the −X cheek, 3 = the bottom."""
    return loft(g, [(z, [(t, y0), (t, y1), (-t, y1), (-t, y0)]) for (z, y0, y1, t) in secs], slot, smooth, 'Z')


def grip(g, y0, y1, r, slot=LEATHER, n=8, bulge=1.08):
    """A slightly barrel-shaped grip along Y."""
    lathe(g, [(y0, r), ((y0 + y1) / 2, r * bulge), (y1, r)], n, slot, 60)


# ============================================================================ the weapons
FIST_TOP, FIST_BOT = 0.058, -0.085


def wpn_sword(tier):
    g = Geo()
    if tier == 'F':
        grip(g, -0.090, 0.062, 0.0138)
        lathe(g, [(-0.128, 0.0), (-0.126, 0.019), (-0.112, 0.026), (-0.097, 0.021), (-0.088, 0.0)], 8, METAL, 45)
        slab(g, rect2(0.060, 0.086, -0.105, 0.105), 0.014, METAL, chamfer=0.004)
        blade(g, [(0.086, 0.034, -0.034, 0.009, 0.013, 0), (0.42, 0.032, -0.032, 0.0085, 0.013, 0),
                  (0.45, 0.024, -0.032, 0.0085, 0.009, 0), (0.48, 0.031, -0.031, 0.0085, 0.012, 0),
                  (0.66, 0.027, -0.028, 0.0075, 0.011, 0), (0.74, 0.013, -0.015, 0.0055, 0.007, 0), (0.79, 0, 0, 0, 0, 0)])
    else:
        grip(g, -0.088, 0.058, 0.0138)
        lathe(g, [(-0.094, 0.0172), (-0.080, 0.0172)], 8, TRIM)
        lathe(g, [(0.050, 0.0172), (0.062, 0.0172)], 8, TRIM)
        lathe(g, [(-0.090, 0.0135), (-0.098, 0.017), (-0.106, 0.023), (-0.108, 0.0)], 8, TRIM)
        sphere(g, (0, -0.121, 0), 0.0185, 8, 5, GEM)
        lathe(g, [(-0.134, 0.010), (-0.140, 0.010), (-0.153, 0.0)], 8, TRIM)
        half = [(0.058, 0.030), (0.066, 0.060), (0.086, 0.098), (0.116, 0.128), (0.126, 0.116), (0.100, 0.076), (0.092, 0.034)]
        slab(g, [(0.058, 0.0)] + half + [(0.096, 0.0)] + [(y, -z) for (y, z) in reversed(half)], 0.016, TRIM, chamfer=0.004)
        gem(g, (0.016, 0.077, 0.0), (1, 0, 0), 0.011, 0.012)
        gem(g, (-0.016, 0.077, 0.0), (-1, 0, 0), 0.011, 0.012)
        blade(g, [(0.094, 0.040, -0.040, 0.010, 0.014, 0.0075), (0.14, 0.036, -0.036, 0.0095, 0.014, 0.0075),
                  (0.58, 0.033, -0.033, 0.0085, 0.013, 0.0065), (0.80, 0.022, -0.022, 0.0065, 0.010, 0.0),
                  (0.88, 0.009, -0.009, 0.004, 0.005, 0.0), (0.92, 0, 0, 0, 0, 0)], METAL, GLOW)
    return g


def wpn_greatsword(tier):
    g = Geo()
    if tier == 'F':
        grip(g, -0.232, 0.064, 0.0150)
        lathe(g, [(-0.300, 0.0), (-0.296, 0.022), (-0.272, 0.032), (-0.246, 0.026), (-0.230, 0.0)], 8, METAL, 45)
        slab(g, rect2(0.062, 0.094, -0.170, 0.170), 0.018, METAL, chamfer=0.005)
        blade(g, [(0.094, 0.046, -0.046, 0.012, 0.016, 0), (0.22, 0.045, -0.045, 0.012, 0.016, 0),
                  (0.98, 0.040, -0.040, 0.011, 0.015, 0), (1.19, 0.025, -0.026, 0.008, 0.011, 0), (1.27, 0, 0, 0, 0, 0)])
    else:
        grip(g, -0.236, 0.060, 0.0148)
        lathe(g, [(0.050, 0.019), (0.064, 0.019)], 8, TRIM)
        lathe(g, [(-0.244, 0.019), (-0.232, 0.019)], 8, TRIM)
        lathe(g, [(-0.242, 0.015), (-0.254, 0.022), (-0.264, 0.029), (-0.266, 0.0)], 8, TRIM)
        sphere(g, (0, -0.283, 0), 0.025, 8, 5, GEM)
        lathe(g, [(-0.302, 0.012), (-0.310, 0.012), (-0.326, 0.0)], 8, TRIM)
        half = [(0.060, 0.035), (0.070, 0.080), (0.094, 0.140), (0.132, 0.195), (0.146, 0.182), (0.114, 0.120), (0.100, 0.040)]
        slab(g, [(0.060, 0.0)] + half + [(0.104, 0.0)] + [(y, -z) for (y, z) in reversed(half)], 0.019, TRIM, chamfer=0.005)
        gem(g, (0.019, 0.082, 0), (1, 0, 0), 0.014, 0.014)
        gem(g, (-0.019, 0.082, 0), (-1, 0, 0), 0.014, 0.014)
        lug = [(0.226, 0.036), (0.258, 0.036), (0.278, 0.106), (0.258, 0.112)]
        slab(g, lug, 0.010, TRIM)
        slab(g, [(y, -z) for (y, z) in lug], 0.010, TRIM)
        blade(g, [(0.100, 0.044, -0.044, 0.012, 0.010, 0.009), (0.245, 0.042, -0.042, 0.012, 0.010, 0.009),
                  (0.300, 0.054, -0.054, 0.0125, 0.018, 0.009), (1.02, 0.047, -0.047, 0.011, 0.017, 0.008),
                  (1.27, 0.028, -0.028, 0.008, 0.012, 0.0), (1.37, 0, 0, 0, 0, 0)], METAL, GLOW)
    g.props['offhandY'] = -0.145
    return g


def _head(secs, yc, s, ts=1.0):
    """Scales axe-head sections about the eye (y = yc, z = 0): positions by s, thickness by ts."""
    return [(z * s, yc + (y0 - yc) * s, yc + (y1 - yc) * s, t * ts) for (z, y0, y1, t) in secs]


def wpn_axe(tier):
    g = Geo()
    yc, s = 0.44, 1.25                    # the head oversized 25% so it reads at 200 px
    if tier == 'F':
        lathe(g, [(-0.135, 0.0), (-0.132, 0.017), (-0.118, 0.0165), (0.30, 0.0155), (0.53, 0.0165), (0.535, 0.0)], 8, WOOD)
        axe_head(g, _head([(-0.036, 0.412, 0.468, 0.016), (0.024, 0.404, 0.476, 0.020), (0.058, 0.414, 0.470, 0.012),
                           (0.108, 0.384, 0.486, 0.006), (0.130, 0.372, 0.492, 0.0035), (0.140, 0.368, 0.494, 0.0012)],
                          yc, s, 1.1), METAL)
    else:
        lathe(g, [(-0.142, 0.0), (-0.138, 0.0185), (-0.124, 0.0185), (-0.118, 0.0)], 8, TRIM)
        lathe(g, [(-0.122, 0.0158), (0.33, 0.0155), (0.55, 0.0165), (0.555, 0.0)], 8, WOOD)
        lathe(g, [(-0.088, 0.0168), (0.062, 0.0168)], 8, LEATHER)
        lathe(g, [(0.322, 0.0178), (0.360, 0.0178)], 8, TRIM)

        def sf(i, j):
            if i == 0:
                return TRIM
            if i == 3 and j in (0, 2):
                return GLOW
            return METAL
        axe_head(g, _head([(-0.095, 0.452, 0.462, 0.003), (-0.030, 0.428, 0.482, 0.014), (0.024, 0.412, 0.494, 0.021),
                           (0.056, 0.424, 0.486, 0.013), (0.094, 0.362, 0.500, 0.0075), (0.134, 0.326, 0.516, 0.0045),
                           (0.150, 0.320, 0.520, 0.0012)], yc, s, 1.1), sf)
        gem(g, (0.0225, yc + 0.013 * s, 0.024 * s), (1, 0, 0), 0.012, 0.013)
        gem(g, (-0.0225, yc + 0.013 * s, 0.024 * s), (-1, 0, 0), 0.012, 0.013)
    return g


def wpn_greataxe(tier):
    g = Geo()
    yc, s = 0.60, 1.3                     # a battleaxe's head must dwarf the one-hander's
    if tier == 'F':
        lathe(g, [(-0.62, 0.0185), (0.78, 0.0175), (0.79, 0.0)], 8, WOOD)
        lathe(g, [(-0.645, 0.0), (-0.64, 0.020), (-0.60, 0.020), (-0.595, 0.0)], 8, METAL)
        axe_head(g, _head([(-0.05, 0.570, 0.630, 0.020), (0.03, 0.555, 0.645, 0.024), (0.08, 0.560, 0.640, 0.014),
                           (0.16, 0.470, 0.700, 0.008), (0.22, 0.430, 0.720, 0.0045), (0.235, 0.425, 0.725, 0.0015)],
                          yc, s, 1.1), METAL)
        lathe(g, [(0.78, 0.013), (0.87, 0.0)], 8, METAL)
    else:
        lathe(g, [(-0.62, 0.0185), (0.80, 0.0175), (0.81, 0.0)], 8, WOOD)
        lathe(g, [(-0.70, 0.0), (-0.64, 0.016), (-0.61, 0.021), (-0.595, 0.0)], 8, TRIM)
        lathe(g, [(-0.088, 0.0195), (0.062, 0.0195)], 8, LEATHER)
        lathe(g, [(-0.545, 0.0195), (-0.405, 0.0195)], 8, LEATHER)
        for yy in (0.40, 0.46):
            lathe(g, [(yy, 0.021), (yy + 0.022, 0.021)], 8, TRIM)

        def sf(i, j):
            if i in (2, 3):
                return TRIM
            if i in (1, 4) and j in (0, 2):
                return GLOW
            return METAL
        axe_head(g, _head([(-0.235, 0.405, 0.735, 0.0015), (-0.215, 0.410, 0.730, 0.0045), (-0.15, 0.480, 0.670, 0.009),
                           (-0.06, 0.550, 0.630, 0.014), (0.0, 0.540, 0.640, 0.026), (0.06, 0.550, 0.630, 0.014),
                           (0.15, 0.480, 0.670, 0.009), (0.215, 0.410, 0.730, 0.0045), (0.235, 0.405, 0.735, 0.0015)],
                          yc, s, 1.1), sf)
        gem(g, (0.0286, yc - 0.01 * s, 0.0), (1, 0, 0), 0.018, 0.018)
        gem(g, (-0.0286, yc - 0.01 * s, 0.0), (-1, 0, 0), 0.018, 0.018)
        lathe(g, [(0.80, 0.015), (0.94, 0.0)], 8, TRIM)
    g.props['offhandY'] = -0.47
    return g


def wpn_mace(tier):
    g = Geo()
    if tier == 'F':
        lathe(g, [(-0.118, 0.0), (-0.114, 0.020), (-0.100, 0.020), (-0.094, 0.0155), (0.47, 0.0155), (0.48, 0.0)], 8, WOOD)
        lathe(g, [(-0.088, 0.0168), (0.062, 0.0168)], 8, LEATHER)
        c = Vector((0, 0.515, 0))
        sphere(g, c, 0.067, 8, 6, METAL)
        dirs = [(1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1), (0, 1, 0), (0.7, 0.7, 0), (-0.7, 0.7, 0), (0, 0.7, 0.7), (0, 0.7, -0.7)]
        for d in dirs:
            d = Vector(d).normalized()
            gem(g, c + d * 0.062, d, 0.020, 0.031, 4, METAL)
    else:
        lathe(g, [(-0.100, 0.0158), (0.40, 0.0155), (0.41, 0.0)], 8, METAL)
        lathe(g, [(-0.088, 0.0168), (0.062, 0.0168)], 8, LEATHER)
        lathe(g, [(-0.100, 0.0185), (-0.090, 0.0185)], 8, TRIM)
        lathe(g, [(-0.098, 0.014), (-0.110, 0.021), (-0.114, 0.0)], 8, TRIM)
        sphere(g, (0, -0.126, 0), 0.016, 8, 4, GEM)
        lathe(g, [(0.375, 0.022), (0.395, 0.030), (0.575, 0.030), (0.595, 0.020), (0.605, 0.0)], 8, TRIM)
        lathe(g, [(0.470, 0.037), (0.488, 0.037)], 12, GLOW)
        flange = [(0.024, 0.385), (0.048, 0.402), (0.089, 0.458), (0.089, 0.530), (0.062, 0.590), (0.024, 0.600)]
        for k in range(6):
            start = g.mark()
            slab(g, flange, 0.0075, METAL, plane='XY')
            g.xform(Matrix.Rotation(math.radians(30 + 60 * k), 4, 'Y'), start)
        lathe(g, [(0.595, 0.014), (0.675, 0.0)], 8, TRIM)
    return g


def wpn_maul(tier):
    g = Geo()
    hy = 0.70
    if tier == 'F':
        lathe(g, [(-0.565, 0.019), (0.66, 0.0175), (0.665, 0.0)], 8, WOOD)
        lathe(g, [(-0.585, 0.0), (-0.580, 0.021), (-0.555, 0.021), (-0.550, 0.0)], 8, METAL)
        box(g, (-0.075, hy - 0.085, -0.155), (0.075, hy + 0.085, 0.155), METAL, chamfer=0.016)
        lathe(g, [(hy - 0.13, 0.0205), (hy - 0.085, 0.0205)], 8, METAL)
    else:
        lathe(g, [(-0.57, 0.0185), (0.66, 0.0175), (0.665, 0.0)], 8, WOOD)
        lathe(g, [(-0.62, 0.0), (-0.585, 0.019), (-0.562, 0.021), (-0.552, 0.0)], 8, TRIM)
        lathe(g, [(-0.088, 0.0190), (0.062, 0.0190)], 8, LEATHER)
        lathe(g, [(-0.505, 0.0190), (-0.355, 0.0190)], 8, LEATHER)
        lathe(g, [(hy - 0.14, 0.0215), (hy - 0.085, 0.0215)], 8, TRIM)
        box(g, (-0.074, hy - 0.084, -0.142), (0.074, hy + 0.084, 0.142), METAL, chamfer=0.016)
        box(g, (-0.068, hy - 0.078, 0.132), (0.068, hy + 0.078, 0.166), TRIM, chamfer=0.010)
        box(g, (-0.068, hy - 0.078, -0.166), (0.068, hy + 0.078, -0.132), TRIM, chamfer=0.010)
        dia = [(hy - 0.062, 0.0), (hy, -0.075), (hy + 0.062, 0.0), (hy, 0.075)]
        slab(g, dia, 0.004, GLOW, plane='YZ', mid=0.0755)
        slab(g, dia, 0.004, GLOW, plane='YZ', mid=-0.0755)
        gem(g, (0.079, hy, 0.0), (1, 0, 0), 0.017, 0.018)
        gem(g, (-0.079, hy, 0.0), (-1, 0, 0), 0.017, 0.018)
        lathe(g, [(hy + 0.08, 0.020), (hy + 0.18, 0.0)], 8, TRIM)
    g.props['offhandY'] = -0.43
    return g


def wpn_spear(tier):
    g = Geo()
    if tier == 'F':
        lathe(g, [(-0.56, 0.0155), (1.26, 0.0145)], 8, WOOD)
        lathe(g, [(-0.585, 0.0), (-0.578, 0.0175), (-0.548, 0.0175), (-0.540, 0.0)], 8, METAL)
        lathe(g, [(1.22, 0.0200), (1.31, 0.0160), (1.32, 0.0)], 8, METAL)
        blade(g, [(1.30, 0.028, -0.028, 0.0095, 0.011, 0), (1.42, 0.064, -0.064, 0.011, 0.019, 0),
                  (1.56, 0.040, -0.040, 0.009, 0.014, 0), (1.71, 0, 0, 0, 0, 0)])
    else:
        lathe(g, [(-0.56, 0.0155), (1.26, 0.0145)], 8, WOOD)
        lathe(g, [(-0.088, 0.0165), (0.062, 0.0165)], 8, LEATHER)
        lathe(g, [(-0.475, 0.0165), (-0.330, 0.0165)], 8, LEATHER)
        for yy in (0.40, 0.85):
            lathe(g, [(yy, 0.0176), (yy + 0.025, 0.0176)], 8, TRIM)
        lathe(g, [(-0.645, 0.0), (-0.585, 0.0155), (-0.555, 0.0178), (-0.545, 0.0)], 8, TRIM)
        lathe(g, [(1.215, 0.0205), (1.25, 0.024), (1.33, 0.017), (1.34, 0.0)], 8, TRIM)
        gem(g, (0.0235, 1.27, 0), (1, 0, 0), 0.010, 0.011)
        gem(g, (-0.0235, 1.27, 0), (-1, 0, 0), 0.010, 0.011)
        slab(g, rect2(1.252, 1.276, -0.088, 0.088), 0.0095, TRIM, chamfer=0.003)
        blade(g, [(1.32, 0.028, -0.028, 0.0095, 0.011, 0.0065), (1.43, 0.064, -0.064, 0.011, 0.019, 0.007),
                  (1.62, 0.040, -0.040, 0.009, 0.014, 0.0), (1.78, 0, 0, 0, 0, 0)], METAL, GLOW)
    g.props['offhandY'] = -0.40
    return g


def wpn_dagger(tier):
    g = Geo()
    if tier == 'F':
        grip(g, -0.088, 0.058, 0.0125, WOOD)
        lathe(g, [(-0.110, 0.0), (-0.106, 0.016), (-0.092, 0.017), (-0.086, 0.0)], 8, METAL)
        slab(g, rect2(0.058, 0.078, -0.058, 0.058), 0.012, METAL, chamfer=0.003)
        blade(g, [(0.078, 0.026, -0.026, 0.0072, 0.010, 0), (0.225, 0.021, -0.021, 0.006, 0.009, 0), (0.315, 0, 0, 0, 0, 0)])
    else:
        grip(g, -0.086, 0.056, 0.0125)
        lathe(g, [(0.050, 0.016), (0.060, 0.016)], 8, TRIM)
        lathe(g, [(-0.084, 0.012), (-0.096, 0.018), (-0.100, 0.0)], 8, TRIM)
        sphere(g, (0, -0.112, 0), 0.0145, 8, 4, GEM)
        slab(g, [(0.058, -0.046), (0.058, 0.071), (0.073, 0.085), (0.089, 0.069), (0.082, 0.0), (0.075, -0.046)], 0.013, TRIM,
             chamfer=0.003)
        blade(g, [(0.080, 0.032, -0.030, 0.0075, 0.010, 0.0056), (0.126, 0.0437, -0.0184, 0.0072, 0.010, 0.0056),
                  (0.172, 0.0207, -0.0414, 0.0068, 0.010, 0.005), (0.218, 0.0368, -0.0161, 0.0064, 0.009, 0.0045),
                  (0.264, 0.0115, -0.0345, 0.0055, 0.008, 0.0), (0.2985, 0.0161, -0.0115, 0.0045, 0.007, 0.0),
                  (0.3465, 0, 0, 0, 0, 0)], METAL, GLOW)
    return g


def _knife(g, tier):
    if tier == 'F':
        lathe(g, [(-0.072, 0.0095), (0.028, 0.0095)], 6, LEATHER)
        blade(g, [(0.026, 0.019, -0.019, 0.0052, 0.007, 0), (0.125, 0.016, -0.016, 0.0045, 0.0065, 0), (0.186, 0, 0, 0, 0, 0)])
    else:
        lathe(g, [(-0.066, 0.0095), (0.028, 0.0095)], 6, LEATHER)
        torus(g, 0.016, 0.0068, 8, 4, TRIM, 'X', (0, -0.088, 0))     # tube ≥ 7 mm: a thinner torus is all outline
        lathe(g, [(0.020, 0.012), (0.030, 0.012)], 6, TRIM)
        blade(g, [(0.028, 0.020, -0.020, 0.0052, 0.007, 0.005), (0.13, 0.017, -0.017, 0.0047, 0.0065, 0.0042),
                  (0.20, 0, 0, 0, 0, 0)], METAL, GLOW)


def wpn_throwingKnife(tier):
    g = Geo()
    for ang in (-22, 0, 22):
        start = g.mark()
        _knife(g, tier)
        g.xform(Matrix.Rotation(math.radians(ang), 4, 'X'), start)
    return g


BOW_CANT = math.radians(-22 if BOW_SOCKET == 'Socket_HandR' else 22)   # string to the palm side, clear of the wrist


def _bow(g, limb, widths, nock, grip_slot, limb_slot, string_slot, tip_slot=None, band_slot=None, rune=None):
    """Limbs lofted along a centreline mirrored about y = 0 (limb: [(y, z)] from the grip to the top tip), hexagonal
    sections [(half width along X, half thickness)], the string straight between the nock points (index into limb).
    The bow is built in the YZ plane; _cant() tilts it about the grip axis at the end."""
    pts = [(-y, z) for (y, z) in reversed(limb[1:])] + list(limb)
    ws = list(reversed(widths[1:])) + list(widths)
    n = len(limb)
    last = len(pts) - 2

    def sf(i, j):
        k = min(i, last - i)                  # segment distance from a tip (0 = the tip segment)
        c = abs(i - (n - 1.5))               # distance from the centre (0.5 = the two grip segments)
        if c < 1:
            return grip_slot
        if band_slot is not None and c < 2:
            return band_slot
        if tip_slot is not None and k == 0:
            return tip_slot
        if rune is not None and j == 4 and rune[0] <= k <= rune[1]:
            return GLOW
        return limb_slot
    curve_loft(g, [(0.0, y, z) for (y, z) in pts], [hexa(hu, hv) for (hu, hv) in ws], sf, 35, up=(1, 0, 0))
    ny, nz = limb[nock]
    rod(g, (0, -ny, nz), (0, ny, nz), 0.0052, n=4, slot=string_slot, smooth=100)
    g.props['nockY'] = round(ny, 4)
    g.props['stringX'] = round(nz * math.sin(BOW_CANT), 4)      # where the braced string runs, after the cant
    g.props['stringZ'] = round(nz * math.cos(BOW_CANT), 4)
    g.props['offhandY'] = 0.02                                   # the draw hand takes the string just above the grip


def _cant(g):
    g.xform(Matrix.Rotation(BOW_CANT, 4, 'Y'), 0)


def wpn_shortbow(tier):
    g = Geo()
    if tier == 'F':
        limb = [(0.0, 0.0), (0.065, -0.002), (0.15, -0.012), (0.27, -0.038), (0.39, -0.068), (0.49, -0.097), (0.56, -0.118)]
        ws = [(0.024, 0.021), (0.024, 0.020), (0.022, 0.0135), (0.020, 0.012), (0.017, 0.011), (0.014, 0.0098), (0.011, 0.008)]
        _bow(g, limb, ws, 6, LEATHER, WOOD, BONE)
    else:
        limb = [(0.0, 0.0), (0.062, -0.002), (0.078, -0.003), (0.15, -0.014), (0.27, -0.046), (0.38, -0.085),
                (0.46, -0.112), (0.52, -0.120), (0.57, -0.102), (0.605, -0.072)]
        ws = [(0.025, 0.022), (0.025, 0.021), (0.024, 0.019), (0.022, 0.014), (0.020, 0.0128), (0.017, 0.0114),
              (0.015, 0.0102), (0.013, 0.0095), (0.012, 0.009), (0.009, 0.007)]
        _bow(g, limb, ws, 7, LEATHER, WOOD, GLOW, tip_slot=TRIM, band_slot=TRIM, rune=(3, 5))
        gem(g, (0.024, 0.10, -0.006), (1, 0, 0), 0.010, 0.011)
        gem(g, (-0.024, 0.10, -0.006), (-1, 0, 0), 0.010, 0.011)
        for s in (1, -1):                      # horn caps on the recurved tips
            rod(g, (0, s * 0.585, -0.090), (0, s * 0.614, -0.060), 0.0105, 0.005, 6, TRIM)
    _cant(g)
    return g


def wpn_longbow(tier):
    g = Geo()
    if tier == 'F':
        limb = [(0.0, 0.0), (0.065, -0.001), (0.18, -0.010), (0.36, -0.040), (0.54, -0.080), (0.70, -0.118), (0.86, -0.152)]
        ws = [(0.026, 0.022), (0.026, 0.021), (0.024, 0.0155), (0.022, 0.014), (0.019, 0.0128), (0.0155, 0.011), (0.011, 0.0088)]
        _bow(g, limb, ws, 6, LEATHER, WOOD, BONE)
    else:
        limb = [(0.0, 0.0), (0.062, -0.001), (0.078, -0.0015), (0.18, -0.010), (0.36, -0.042), (0.54, -0.084),
                (0.70, -0.122), (0.82, -0.148), (0.885, -0.138)]
        ws = [(0.027, 0.023), (0.027, 0.022), (0.026, 0.020), (0.024, 0.0155), (0.022, 0.014), (0.019, 0.0128),
              (0.0155, 0.011), (0.012, 0.0092), (0.009, 0.0072)]
        _bow(g, limb, ws, 7, LEATHER, WOOD, GLOW, tip_slot=TRIM, band_slot=TRIM, rune=(2, 5))
        gem(g, (0.026, 0.11, -0.006), (1, 0, 0), 0.011, 0.012)
        gem(g, (-0.026, 0.11, -0.006), (-1, 0, 0), 0.011, 0.012)
        for s in (1, -1):
            rod(g, (0, s * 0.86, -0.143), (0, s * 0.908, -0.129), 0.0105, 0.0045, 6, TRIM)
    _cant(g)
    return g


def wpn_crossbow(tier):
    g = Geo()
    st = [(-0.34, 0.022, -0.028, 0.080), (-0.24, 0.021, -0.026, 0.062), (-0.12, 0.019, -0.022, 0.040),
          (-0.03, 0.016, -0.019, 0.022), (0.07, 0.017, -0.020, 0.024), (0.42, 0.017, -0.020, 0.022)]
    loft(g, [(y, [(hx, zt), (hx, zb), (-hx, zb), (-hx, zt)]) for (y, hx, zt, zb) in st], WOOD, 30, 'Y')
    py = 0.37
    xs = [-0.31, -0.24, -0.16, -0.08, 0.0, 0.08, 0.16, 0.24, 0.31]
    path = [(x, py - 0.075 * (abs(x) / 0.31) ** 1.8, -0.006) for x in xs]
    secs = [rect(0.017 - 0.008 * abs(x) / 0.31, 0.0088 - 0.0028 * abs(x) / 0.31) for x in xs]
    prod_slot = WOOD if tier == 'F' else (lambda i, j: TRIM if i in (0, 7) else METAL)
    curve_loft(g, path, secs, prod_slot, 30, up=(0, 0, 1))
    tip_y = py - 0.075
    string = BONE if tier == 'F' else GLOW        # a pale string reads on dark rooms (as on the bows)
    for s in (1, -1):
        rod(g, (s * 0.30, tip_y + 0.002, -0.006), (0, 0.050, -0.025), 0.0046, n=4, slot=string)
    box(g, (-0.013, 0.034, -0.034), (0.013, 0.066, -0.018), METAL, chamfer=0.003)
    rod(g, (0, 0.060, -0.030), (0, 0.40, -0.030), 0.0045, n=4, slot=WOOD)
    lathe(g, [(0.40, 0.0075), (0.445, 0.0)], 4, METAL if tier == 'F' else GLOW, 0, c=(0.0, -0.030))
    rod(g, (0, 0.074, 0.020), (0, 0.052, 0.066), 0.0042, n=4, slot=METAL)
    if tier == 'S':
        box(g, (-0.022, py - 0.04, -0.026), (0.022, py + 0.035, 0.028), TRIM, chamfer=0.004)
        box(g, (-0.025, -0.355, -0.032), (0.025, -0.330, 0.085), TRIM, chamfer=0.004)
        curve_loft(g, [(-0.030, 0.415, -0.002), (-0.040, 0.465, -0.002), (0.0, 0.505, -0.002), (0.040, 0.465, -0.002),
                       (0.030, 0.415, -0.002)], [rect(0.006, 0.006)] * 5, TRIM, 40, up=(0, 0, 1))
        gem(g, (0.020, -0.18, 0.012), (1, 0, 0), 0.011, 0.012)
        gem(g, (-0.020, -0.18, 0.012), (-1, 0, 0), 0.011, 0.012)
    g.props['offhandY'] = 0.21
    return g


def wpn_staff(tier):
    g = Geo()
    if tier == 'F':
        prof = [(-0.78, 0.0175, 0.000, 0.000), (-0.50, 0.0180, 0.006, -0.004), (-0.20, 0.0185, 0.000, 0.004),
                (-0.09, 0.0172, 0.0, 0.0), (0.07, 0.0172, 0.0, 0.0), (0.25, 0.0205, -0.005, 0.003),
                (0.32, 0.0180, -0.004, 0.002), (0.60, 0.0185, 0.006, -0.003), (0.86, 0.0215, 0.002, 0.0)]
        loft(g, [(y, circle(r, 8, c=(cx, cz))) for (y, r, cx, cz) in prof], WOOD, 55, 'Y')
        # a knotted head under the copper cap (the Metal rung of the grade shows as the cap: 08 §1 naming)
        lathe(g, [(0.84, 0.021), (0.88, 0.040), (0.94, 0.047), (0.99, 0.034), (1.005, 0.0)], 8, WOOD, c=(0.002, 0.0))
        lathe(g, [(0.980, 0.036), (1.004, 0.039), (1.040, 0.019), (1.056, 0.0)], 8, METAL, c=(0.002, 0.0))
        lathe(g, [(-0.80, 0.0), (-0.795, 0.016), (-0.76, 0.0195), (-0.74, 0.0)], 8, METAL)
    else:
        lathe(g, [(-0.78, 0.0165), (0.88, 0.0175)], 8, WOOD)
        lathe(g, [(-0.088, 0.0185), (0.062, 0.0185)], 8, LEATHER)
        lathe(g, [(-0.438, 0.0185), (-0.300, 0.0185)], 8, LEATHER)
        for yy in (0.40, -0.60):
            lathe(g, [(yy, 0.0195), (yy + 0.03, 0.0195)], 8, TRIM)
        lathe(g, [(-0.86, 0.0), (-0.80, 0.014), (-0.77, 0.0195), (-0.76, 0.0)], 8, TRIM)
        lathe(g, [(0.84, 0.0215), (0.88, 0.032), (0.905, 0.028), (0.91, 0.0)], 8, TRIM)
        lathe(g, [(0.795, 0.022), (0.822, 0.022)], 10, GLOW)
        sphere(g, (0, 1.005, 0), 0.060, 10, 6, GEM)
        path = [(0.020, 0.885, 0), (0.062, 0.919, 0), (0.084, 0.980, 0), (0.081, 1.047, 0), (0.054, 1.101, 0), (0.020, 1.120, 0)]
        sec = [rect(0.010, 0.009), rect(0.010, 0.009), rect(0.0095, 0.0085), rect(0.0085, 0.0078), rect(0.007, 0.0065), [(0.0, 0.0)] * 4]
        for k in range(3):
            start = g.mark()
            curve_loft(g, path, sec, TRIM, 40, up=(0, 0, 1))
            g.xform(Matrix.Rotation(math.radians(30 + 120 * k), 4, 'Y'), start)
    g.props['offhandY'] = -0.36
    return g


def wpn_wand(tier):
    g = Geo()
    if tier == 'F':
        lathe(g, [(-0.086, 0.0130), (0.06, 0.0120), (0.30, 0.0075), (0.31, 0.0)], 8, WOOD)
        lathe(g, [(-0.114, 0.0), (-0.108, 0.018), (-0.090, 0.017), (-0.084, 0.0)], 8, WOOD)
        lathe(g, [(0.284, 0.0098), (0.316, 0.0098), (0.338, 0.0)], 8, METAL)
    else:
        lathe(g, [(-0.086, 0.0128), (0.06, 0.0122), (0.30, 0.0082)], 8, WOOD)
        lathe(g, [(-0.088, 0.0140), (0.062, 0.0140)], 8, LEATHER)
        for yy in (0.10, 0.19):
            lathe(g, [(yy, 0.0132), (yy + 0.014, 0.0132)], 8, TRIM)
        lathe(g, [(0.290, 0.0095), (0.312, 0.0165), (0.326, 0.0170), (0.330, 0.0)], 8, TRIM)
        lathe(g, [(0.316, 0.0), (0.352, 0.0190), (0.430, 0.0)], 6, GLOW, 0)
        lathe(g, [(-0.086, 0.012), (-0.098, 0.017), (-0.102, 0.0)], 8, TRIM)
        sphere(g, (0, -0.113, 0), 0.0145, 8, 4, GEM)
    return g


def wpn_censer(tier):
    g = Geo()
    lathe(g, [(-0.100, 0.0), (-0.096, 0.0165), (-0.090, 0.0150), (0.30, 0.0150)], 8, WOOD)
    lathe(g, [(-0.088, 0.0163), (0.062, 0.0163)], 8, LEATHER)
    lathe(g, [(0.295, 0.0185), (0.330, 0.0170), (0.332, 0.0)], 8, METAL if tier == 'F' else TRIM)
    link = METAL if tier == 'F' else TRIM
    torus(g, 0.016, 0.0068, 6, 4, link, 'X', (0, 0.350, 0))        # two interlocked links (each through the other)
    torus(g, 0.016, 0.0068, 6, 4, link, 'Z', (0, 0.366, 0))
    prof = [(0.392, 0.0), (0.398, 0.024), (0.418, 0.046), (0.445, 0.053), (0.468, 0.047), (0.472, 0.051), (0.478, 0.045),
            (0.500, 0.039), (0.522, 0.023), (0.535, 0.011), (0.545, 0.0)]
    if tier == 'F':
        lathe(g, prof, 10, METAL, 50)
        sphere(g, (0, 0.553, 0), 0.0105, 6, 4, METAL)
    else:
        lathe(g, prof, 10, segs(TRIM, TRIM, METAL, METAL, TRIM, TRIM, GLOW, GLOW, METAL, TRIM), 50)
        sphere(g, (0, 0.557, 0), 0.0135, 8, 4, GEM)
    return g


def wpn_focus(tier):
    g = Geo()
    c = 0.152
    if tier == 'F':
        lathe(g, [(-0.100, 0.0), (-0.096, 0.016), (-0.086, 0.0145), (0.062, 0.0135), (0.075, 0.0)], 8, WOOD)
        lathe(g, [(0.058, 0.016), (0.078, 0.031), (0.098, 0.041), (0.102, 0.0)], 8, WOOD)
        sphere(g, (0, c, 0), 0.056, 10, 6, WOOD)
        torus(g, 0.0565, 0.0072, 12, 4, METAL, 'X', (0, c, 0))
        torus(g, 0.0565, 0.0072, 12, 4, METAL, 'Z', (0, c, 0))
    else:
        lathe(g, [(-0.088, 0.0138), (0.062, 0.0138)], 8, LEATHER)
        lathe(g, [(-0.098, 0.0), (-0.094, 0.017), (-0.084, 0.016), (-0.080, 0.0)], 8, TRIM)
        lathe(g, [(0.058, 0.016), (0.070, 0.022), (0.082, 0.020), (0.086, 0.0)], 8, TRIM)
        sphere(g, (0, c, 0), 0.058, 10, 7, GEM)
        path = [(0.016, 0.075, 0), (0.045, 0.096, 0), (0.066, 0.132, 0), (0.064, 0.172, 0), (0.040, 0.204, 0)]
        sec = [rect(0.0075, 0.0065), rect(0.0075, 0.0065), rect(0.0068, 0.006), rect(0.006, 0.005), [(0.0, 0.0)] * 4]
        for k in range(3):
            start = g.mark()
            curve_loft(g, path, sec, TRIM, 40, up=(0, 0, 1))
            g.xform(Matrix.Rotation(math.radians(30 + 120 * k), 4, 'Y'), start)
        torus(g, 0.086, 0.0075, 16, 4, GLOW, 'Y', (0, c, 0), tilt=Matrix.Rotation(math.radians(22), 4, 'Z'))
    return g


def wpn_focusHoly(tier):
    g = Geo()
    c = 0.168
    if tier == 'F':
        lathe(g, [(-0.100, 0.0), (-0.096, 0.016), (-0.086, 0.0145), (0.075, 0.0135), (0.092, 0.0)], 8, WOOD)
        lathe(g, [(0.072, 0.0165), (0.094, 0.0165)], 8, METAL)
        lathe(g, [(-0.010, 0.0), (-0.010, 0.060), (-0.007, 0.075), (0.007, 0.075), (0.010, 0.060), (0.010, 0.0)], 16, METAL, 40,
              axis='X', c=(c, 0.0))
        for s in (1, -1):
            lathe(g, [(s * 0.0095, 0.024), (s * 0.016, 0.019), (s * 0.019, 0.0)], 10, METAL, 50, axis='X', c=(c, 0.0))
    else:
        lathe(g, [(-0.088, 0.0138), (0.075, 0.0138)], 8, LEATHER)
        lathe(g, [(-0.098, 0.0), (-0.094, 0.017), (-0.084, 0.016), (-0.080, 0.0)], 8, TRIM)
        lathe(g, [(0.070, 0.0165), (0.096, 0.0165)], 8, TRIM)
        star = []
        for k in range(16):
            a = 2 * math.pi * k / 16 + math.pi / 2
            r = 0.092 if k % 2 == 0 else 0.062
            star.append((c + r * math.sin(a), r * math.cos(a)))
        slab(g, star, 0.009, TRIM, 25, chamfer=0.003)
        for s in (1, -1):
            lathe(g, [(s * 0.0085, 0.026), (s * 0.017, 0.021), (s * 0.023, 0.0)], 10, GEM, 50, axis='X', c=(c, 0.0))
            revolve(g, [(s * 0.0086, 0.040), (s * 0.0112, 0.0455), (s * 0.0086, 0.051)], 14, GLOW, 30,
                    axis='X', c=(c, 0.0), closed_profile=True)
    g.props['variant'] = 'holySymbol'
    return g


# ------------------------------------------------------------------ shields
# Authored in the left hand socket's frame: the face toward +X (the back of the left hand), the long axis along Z
# (the forearm: −Z toward the elbow, +Z toward the fingers), the across axis along Y (the grip line).
def _board(g, stations, front, thick, slots, n_mid=4, rim_w=0.022, rim_h=0.0, top_rim=True, smooth=32, stripe=None,
           bands=()):
    """A curved board lofted along Z. stations: [(z, y0, y1)] — at z the board spans y0…y1; front(y) is the front
    surface's x, the back is front − thick. slots: face / rim / back (+ stripe, band). A raised rim (rim_h) runs along
    both long edges and, with top_rim, across the first station band. stripe: the half width of a stripe down the
    middle (slot 'stripe'); bands: station segment indices whose face is slot 'band'."""
    secs = []
    for si, (z, a0, a1) in enumerate(stations):
        w = a1 - a0
        rw = min(rim_w, w * 0.3)
        dl = min(0.005, w * 0.05)
        i0, i1 = a0 + rw + dl, a1 - rw - dl
        mids = [i0 + (i1 - i0) * (k + 1) / (n_mid + 1) for k in range(n_mid)]
        if stripe is not None:
            cen = (a0 + a1) / 2
            hw = min(stripe, 0.4 * (i1 - i0) / 2)
            mids = sorted(mids + [cen - hw, cen + hw])
        a_s = [a0, a0 + rw, i0] + mids + [i1, a1 - rw, a1]
        K = len(a_s)
        raised = [True] * K if (top_rim and si == 0) else ([True, True] + [False] * (K - 4) + [True, True])
        fr = [(front(a) + (rim_h if r else 0.0), a) for a, r in zip(a_s, raised)]
        bk = [(front(a) - thick, a) for a in reversed(a_s)]
        secs.append((z, fr + bk, a_s))
    K = len(secs[0][2])
    assert all(len(s[2]) == K for s in secs), 'board stations must have the same point count'

    def sf(i, j):
        if j <= K - 2:                                   # front faces
            if j in (0, K - 2) or (top_rim and i == 0) or (rim_h > 0 and j in (1, K - 3)):
                return slots['rim']
            a_mid = (secs[i][2][j] + secs[i][2][j + 1]) / 2
            cen = (secs[i][2][0] + secs[i][2][-1]) / 2
            if stripe is not None and abs(a_mid - cen) < stripe:
                return slots.get('stripe', slots['face'])
            if i in bands:
                return slots.get('band', slots['face'])
            return slots['face']
        if j in (K - 1, 2 * K - 1):                      # the two thickness sides
            return slots['rim']
        return slots['back']
    loft(g, [(z, pts) for (z, pts, _) in secs], sf, smooth, 'Z', True, True, True, (slots['rim'], slots['rim']))


def _shield_grip(g, front, thick, strap_z=None):
    """The grip bar through the fist (along Y), two posts out to the board's back, and a strap round the forearm."""
    rod(g, (0, -0.105, 0), (0, 0.082, 0), 0.0125, n=6, slot=WOOD)
    for y in (-0.105, 0.082):
        bx = front(y) - thick + 0.004
        box(g, (0.0, y - 0.012, -0.012), (bx, y + 0.012, 0.012), METAL)
    if strap_z is not None:
        z = strap_z
        bx = min(front(-0.099), front(0.009)) - thick + 0.004
        box(g, (-0.056, -0.104, z - 0.016), (bx, -0.094, z + 0.016), LEATHER)
        box(g, (-0.056, 0.004, z - 0.016), (bx, 0.014, z + 0.016), LEATHER)
        box(g, (-0.064, -0.104, z - 0.016), (-0.056, 0.014, z + 0.016), LEATHER)


def shd_shieldBuckler(tier):
    g = Geo()
    yc, zc, R = -0.010, -0.040, 0.180
    if tier == 'F':
        prof = [(0.058, 0.0), (0.058, R - 0.006), (0.078, R + 0.004), (0.090, R - 0.004), (0.092, R - 0.026), (0.101, 0.10),
                (0.106, 0.052), (0.108, 0.046), (0.125, 0.037), (0.137, 0.016), (0.139, 0.0)]
        lathe(g, prof, 16, segs(WOOD, METAL, METAL, METAL, WOOD, WOOD, WOOD, METAL, METAL, METAL), 40, axis='X', c=(yc, zc))
    else:
        prof = [(0.058, 0.0), (0.058, R - 0.006), (0.080, R + 0.006), (0.096, R - 0.004), (0.097, R - 0.030), (0.103, 0.118),
                (0.104, 0.104), (0.106, 0.090), (0.108, 0.052), (0.110, 0.046), (0.128, 0.038), (0.140, 0.018), (0.142, 0.0)]
        lathe(g, prof, 16, segs(LEATHER, TRIM, TRIM, TRIM, METAL, GLOW, METAL, METAL, TRIM, TRIM, TRIM, TRIM), 40,
              axis='X', c=(yc, zc))
        gem(g, (0.140, yc, zc), (1, 0, 0), 0.016, 0.050, 6, GEM)
    _shield_grip(g, lambda y: 0.058, 0.0)
    return g


def _with_bands(prof, bands):
    """Inserts stations so each band (z0, z1) is its own narrow segment; returns (profile, band segment indices)."""
    zs = sorted(set([z for z, _ in prof] + [z for b in bands for z in b]))

    def w_at(z):
        for (za, wa), (zb, wb) in zip(prof, prof[1:]):
            if za <= z <= zb:
                return wa + (wb - wa) * (z - za) / (zb - za) if zb > za else wa
        return prof[-1][1]
    out = [(z, w_at(z)) for z in zs]
    idx = tuple(i for i in range(len(out) - 1)
                if any(abs(out[i][0] - b0) < 1e-9 and abs(out[i + 1][0] - b1) < 1e-9 for b0, b1 in bands))
    return out, idx


def _kite_front(a, yc=-0.010, hw=0.25):
    return 0.052 + 0.040 * max(0.0, 1.0 - ((a - yc) / hw) ** 2)


def shd_shieldKite(tier):
    g = Geo()
    yc, thick = -0.010, 0.022
    # along the forearm: the top (toward the elbow) at z −0.62, the point at +0.33 beyond the fingers
    prof = [(-0.62, 0.17), (-0.595, 0.215), (-0.55, 0.24), (-0.38, 0.24), (-0.18, 0.215), (0.0, 0.17), (0.15, 0.115),
            (0.26, 0.060), (0.33, 0.004)]
    x0 = _kite_front(yc)
    if tier == 'F':
        prof, bands = _with_bands(prof, [(-0.44, -0.41), (0.05, 0.08)])      # two iron straps across the planks
        st = [(z, yc - w, yc + w) for (z, w) in prof]
        _board(g, st, _kite_front, thick, {'face': WOOD, 'rim': LEATHER, 'back': WOOD, 'band': METAL},
               rim_w=0.018, top_rim=True, bands=bands)
        lathe(g, [(x0 - 0.006, 0.040), (x0 + 0.012, 0.032), (x0 + 0.020, 0.012), (x0 + 0.021, 0.0)], 10, METAL, 45,
              axis='X', c=(yc, -0.04))
    else:
        st = [(z, yc - w, yc + w) for (z, w) in prof]
        _board(g, st, _kite_front, thick, {'face': CLOTH1, 'rim': TRIM, 'back': LEATHER, 'stripe': GLOW},
               rim_w=0.024, rim_h=0.007, top_rim=True, stripe=0.016)
        lathe(g, [(x0 - 0.006, 0.048), (x0 + 0.014, 0.040), (x0 + 0.026, 0.016), (x0 + 0.028, 0.0)], 12, TRIM, 45,
              axis='X', c=(yc, -0.04))
        gem(g, (x0 + 0.026, yc, -0.04), (1, 0, 0), 0.015, 0.024, 6, GEM)
    _shield_grip(g, _kite_front, thick, strap_z=-0.19)
    return g


def _tower_front(a, yc=-0.010, hw=0.30):
    return 0.030 + 0.065 * max(0.0, 1.0 - ((a - yc) / hw) ** 2)


def _rib(g, x0, yc, z0, z1, slot):
    """A raised rib down the middle of a board (along Z)."""
    r = [(x0 - 0.006, yc - 0.020), (x0 + 0.012, yc - 0.012), (x0 + 0.012, yc + 0.012), (x0 - 0.006, yc + 0.020)]
    loft(g, [(z0, r), (z1, r)], slot, 30, 'Z')


def shd_shieldTower(tier):
    g = Geo()
    yc, hw, thick = -0.010, 0.29, 0.024
    prof = [(-0.64, hw - 0.03), (-0.62, hw), (-0.30, hw), (0.0, hw), (0.20, hw), (0.40, hw), (0.42, hw - 0.03)]
    prof, bands = _with_bands(prof, [(-0.47, -0.43), (0.20, 0.24)])          # two straps across the face
    st = [(z, yc - w, yc + w) for (z, w) in prof]
    x0 = _tower_front(yc)
    if tier == 'F':
        _board(g, st, _tower_front, thick, {'face': METAL, 'rim': WOOD, 'back': WOOD, 'band': LEATHER},
               rim_w=0.022, top_rim=True, bands=bands)
        _rib(g, x0, yc, -0.60, 0.38, METAL)
        lathe(g, [(x0 - 0.004, 0.052), (x0 + 0.016, 0.045), (x0 + 0.030, 0.018), (x0 + 0.032, 0.0)], 12, METAL, 45,
              axis='X', c=(yc, -0.04))
    else:
        _board(g, st, _tower_front, thick, {'face': METAL, 'rim': TRIM, 'back': LEATHER, 'stripe': GLOW, 'band': TRIM},
               rim_w=0.026, rim_h=0.008, top_rim=True, stripe=0.018, bands=bands)
        lathe(g, [(x0 - 0.004, 0.060), (x0 + 0.018, 0.052), (x0 + 0.034, 0.022), (x0 + 0.036, 0.0)], 14, TRIM, 45,
              axis='X', c=(yc, -0.04))
        gem(g, (x0 + 0.034, yc, -0.04), (1, 0, 0), 0.018, 0.028, 6, GEM)
    _shield_grip(g, _tower_front, thick, strap_z=-0.20)
    return g


# ------------------------------------------------------------------ the quiver (Socket_Back space)
QUIVER_TILT = math.radians(25 if BOW_SOCKET == 'Socket_HandR' else -25)   # mouth over the draw hand's shoulder
QUIVER_LEAN = math.radians(8)            # the bottom tucked toward the small of the back (the back slopes in below)
QUIVER_AT = Vector((0.0, 0.0, 0.040))    # Socket_Back sits ~4 cm off the shoulder blades; +Z is back: the 6.6 cm tube clears the back and a mantle (was −0.010: it cut into the back)


def _quiver_xform(g, start=0):
    g.xform(Matrix.Translation(QUIVER_AT) @ Matrix.Rotation(QUIVER_TILT, 4, 'Z') @ Matrix.Rotation(QUIVER_LEAN, 4, 'X'), start)


def qvr_quiver(tier):
    g = Geo()
    prof = [(-0.270, 0.0), (-0.268, 0.050), (-0.255, 0.060), (0.225, 0.066), (0.250, 0.068), (0.252, 0.0)]
    if tier == 'F':
        lathe(g, prof, 8, segs(LEATHER, LEATHER, CLOTH2, LEATHER, LEATHER), 50)
        for yy in (-0.13, 0.11):
            lathe(g, [(yy, 0.0645), (yy + 0.030, 0.0655)], 8, LEATHER)
    else:
        prof = [(-0.290, 0.0), (-0.286, 0.030), (-0.270, 0.052), (-0.255, 0.061), (-0.060, 0.063), (-0.040, 0.064),
                (0.225, 0.067), (0.252, 0.070), (0.255, 0.0)]
        lathe(g, prof, 8, segs(TRIM, TRIM, TRIM, LEATHER, GLOW, LEATHER, TRIM, TRIM), 50)
        for yy in (-0.15, 0.12):
            lathe(g, [(yy, 0.0665), (yy + 0.026, 0.0672)], 8, TRIM)
        gem(g, (0.0, 0.133, 0.067), (0, 0, 1), 0.012, 0.014)
    _quiver_xform(g)
    return g


ARROWS = [(0.000, 0.000, 0.36), (0.030, 0.012, 0.35), (-0.028, 0.014, 0.37), (0.012, 0.034, 0.34), (-0.010, -0.030, 0.36),
          (0.032, -0.020, 0.345), (-0.034, -0.012, 0.355)]


def _arrows(tier, count):
    g = Geo()
    fl = BONE if tier == 'F' else CLOTH3
    for k, (x, z, top) in enumerate(ARROWS[:count]):
        start = g.mark()
        rod(g, (0, 0.10, 0), (0, top, 0), 0.0045, n=4, slot=WOOD)
        fin = [(0.003, top - 0.075), (0.016, top - 0.062), (0.016, top - 0.012), (0.003, top - 0.002)]
        for f in range(3):
            s2 = g.mark()
            slab(g, fin, 0.0016, fl, 20, plane='XY')
            g.xform(Matrix.Rotation(math.radians(f * 120 + k * 37), 4, 'Y'), s2)
        g.xform(Matrix.Translation((x, 0, z)), start)
    _quiver_xform(g)
    return g


def qvr_arrowsFull(tier):
    g = _arrows(tier, 7)
    g.props['fill'] = 'full'
    return g


def qvr_arrowsHalf(tier):
    g = _arrows(tier, 4)
    g.props['fill'] = 'half'
    return g


# ============================================================================ the catalogue
# (object base name, weaponType, kind, hands, socket, builder, triangle budget, sheet view yaw)
SPECS = [
    ('wpn_sword', 'sword', 'weapon', 1, HR, wpn_sword, 500, 22),
    ('wpn_greatsword', 'greatsword', 'weapon', 2, HR, wpn_greatsword, 800, 22),
    ('wpn_axe', 'axe', 'weapon', 1, HR, wpn_axe, 500, 22),
    ('wpn_greataxe', 'greataxe', 'weapon', 2, HR, wpn_greataxe, 800, 22),
    ('wpn_mace', 'mace', 'weapon', 1, HR, wpn_mace, 500, 22),
    ('wpn_maul', 'maul', 'weapon', 2, HR, wpn_maul, 800, 30),
    ('wpn_spear', 'spear', 'weapon', 2, HR, wpn_spear, 800, 22),
    ('wpn_dagger', 'dagger', 'weapon', 1, HR, wpn_dagger, 500, 22),
    ('wpn_throwingKnife', 'throwingKnife', 'weapon', 1, HR, wpn_throwingKnife, 500, 15),
    ('wpn_shortbow', 'shortbow', 'weapon', 2, BOW_SOCKET, wpn_shortbow, 600, 12),
    ('wpn_longbow', 'longbow', 'weapon', 2, BOW_SOCKET, wpn_longbow, 600, 12),
    ('wpn_crossbow', 'crossbow', 'weapon', 2, HR, wpn_crossbow, 800, 50),
    ('wpn_staff', 'staff', 'weapon', 2, HR, wpn_staff, 800, 22),
    ('wpn_wand', 'wand', 'weapon', 1, HR, wpn_wand, 500, 22),
    ('wpn_censer', 'censer', 'weapon', 1, HR, wpn_censer, 500, 22),
    ('wpn_focus', 'focus', 'focus', 1, HL, wpn_focus, 500, 22),
    ('wpn_focusHoly', 'focus', 'focus', 1, HL, wpn_focusHoly, 500, 30),
    ('shd_shieldBuckler', 'shieldBuckler', 'shield', 1, HL, shd_shieldBuckler, 800, 30),
    ('shd_shieldKite', 'shieldKite', 'shield', 1, HL, shd_shieldKite, 800, 30),
    ('shd_shieldTower', 'shieldTower', 'shield', 1, HL, shd_shieldTower, 800, 30),
    ('qvr_quiver', None, 'quiver', 0, BACK, qvr_quiver, 400, 30),
    ('qvr_arrowsFull', None, 'quiverFill', 0, BACK, qvr_arrowsFull, 400, 30),
    ('qvr_arrowsHalf', None, 'quiverFill', 0, BACK, qvr_arrowsHalf, 400, 30),
]


def content_mesh_ids():
    """weaponType → the item meshIds it serves (content/items/*/<id>.json → visual.meshId)."""
    out = {}
    for kind in ('weapon', 'shield', 'focus'):
        d = os.path.join(CONTENT, 'items', kind)
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if fn.endswith('.json'):
                it = read_json(os.path.join(d, fn))
                wt, mid = it.get('weaponType'), (it.get('visual') or {}).get('meshId')
                if wt and mid:
                    out.setdefault(wt, set()).add(mid)
    return {k: sorted(v) for k, v in out.items()}


# ============================================================================ objects
def corner_normals(me, angles):
    """Per face corner: the angle-weighted normal of the faces around the corner's vertex that are reachable through
    edges flatter than the faces' smoothing angle. Returns [[(co, normal)] per corner] per face."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.normal_update()
    bm.faces.ensure_lookup_table()
    bm.edges.ensure_lookup_table()
    bm.verts.index_update()
    smooth_edge = []
    for e in bm.edges:
        lf = e.link_faces
        ok = False
        if len(lf) == 2:
            lim = min(angles[lf[0].index], angles[lf[1].index])
            if lim > 0 and lf[0].normal.length > 0.5 and lf[1].normal.length > 0.5:
                ok = lf[0].normal.angle(lf[1].normal) < math.radians(lim)
        smooth_edge.append(ok)
    out = []
    for f in bm.faces:
        row = []
        for loop in f.loops:
            v = loop.vert
            vi = v.index
            group = {f.index}
            stack = [f]
            while stack:
                cf = stack.pop()
                for e in cf.edges:
                    if smooth_edge[e.index] and vi in (e.verts[0].index, e.verts[1].index):
                        for of in e.link_faces:
                            if of.index not in group:
                                group.add(of.index)
                                stack.append(of)
            n = Vector()
            for fi in group:
                ff = bm.faces[fi]
                for lp in ff.loops:
                    if lp.vert.index == vi:
                        n += ff.normal * lp.calc_angle()
                        break
            row.append((v.co.copy(), n.normalized() if n.length > 1e-9 else f.normal.copy()))
        out.append(row)
    bm.free()
    return out


def make_object(name, g, props):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in g.V], [], g.F)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(me)
    bm.free()
    me.update()
    ob = bpy.data.objects.new(name, me)
    collection('Weapons').objects.link(ob)
    corners = corner_normals(me, g.A)
    toon.split_by_face_slots(ob, list(g.S))
    if len(me.polygons) != len(corners):
        raise RuntimeError('%s: face count changed in the palette split' % name)
    for p in me.polygons:
        p.use_smooth = True
    ln = [None] * len(me.loops)
    for p in me.polygons:
        row = corners[p.index]
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            best = min(row, key=lambda t: (t[0] - co).length)
            if (best[0] - co).length > 1e-5:
                raise RuntimeError('%s: corner %d not matched after the split' % (name, li))
            ln[li] = best[1]
    me.normals_split_custom_set(ln)
    for k, v in props.items():
        ob[k] = v
    toon.apply_look(ob, outline=OUTLINE)
    return ob


META = {}      # per mesh: triangle budget and sheet view (kept off the objects so they stay out of the glTF extras)


def build_all():
    mids = content_mesh_ids()
    covered = set()
    objs, rows = [], []
    for base, wtype, kind, hands, socket, fn, budget, yaw in SPECS:
        if wtype:
            covered.add(wtype)
        for tier in ('F', 'S'):
            name = '%s_%s' % (base, tier)
            g = fn(tier)
            props = {'kind': kind, 'tier': tier, 'socket': socket}
            if wtype:
                props['weaponType'] = wtype
                ids = mids.get(wtype, [])
                if wtype == 'focus':
                    ids = [m for m in ids if ('holy' in m) == (base == 'wpn_focusHoly')]
                props['meshIds'] = ','.join(ids)
            if hands:
                props['hands'] = hands
            props.update({k: (round(v, 4) if isinstance(v, float) else v) for k, v in g.props.items()})
            ob = make_object(name, g, props)
            META[name] = {'budget': budget, 'yaw': yaw, 'roll': -90 if kind == 'shield' else None}
            lo = Vector([min(v.co[i] for v in ob.data.vertices) for i in range(3)])
            hi = Vector([max(v.co[i] for v in ob.data.vertices) for i in range(3)])
            tris = g.tris()
            rows.append((name, tris, len(ob.data.vertices), budget, max(hi - lo)))
            objs.append(ob)
    missing = sorted(set(mids) - covered)
    if missing:
        log('WARNING weaponTypes in content without a mesh:', ', '.join(missing))
    for name, tris, nv, budget, size in rows:
        log('%-24s %4d tris (budget %d)%s  %4d verts  %.2f m' % (name, tris, budget, '  OVER' if tris > budget else '', nv, size))
    return objs, rows


# ============================================================================ review renders
R_DISP = Matrix(((0, 0, -1), (-1, 0, 0), (0, 1, 0))).to_4x4()   # weapon +X → toward a camera at −Y, +Y → up


def load_px(path):
    from render import load_pixels
    return load_pixels(path)


def save_px(path, px):
    from render import save_pixels
    save_pixels(path, px)


def shrink(path, size, out):
    img = bpy.data.images.load(path)
    img.scale(size, size)
    img.filepath_raw = out
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)
    return out


class Labels:
    """Text strips rendered in their own Workbench scene, for labelling contact-sheet cells."""

    def __init__(self):
        sc = bpy.data.scenes.get('GV_Labels') or bpy.data.scenes.new('GV_Labels')
        sc.render.engine = 'BLENDER_WORKBENCH'
        sc.display.shading.light = 'FLAT'
        sc.display.shading.color_type = 'SINGLE'
        sc.display.shading.single_color = (0.93, 0.90, 0.82)
        w = bpy.data.worlds.get('GV_LabelWorld') or bpy.data.worlds.new('GV_LabelWorld')
        w.color = (0.03, 0.032, 0.045)
        sc.world = w
        sc.view_settings.view_transform = 'Standard'
        sc.render.image_settings.file_format = 'PNG'
        sc.render.image_settings.color_mode = 'RGBA'
        sc.render.resolution_percentage = 100
        sc.render.film_transparent = False
        cu = bpy.data.curves.new('GV_Label', 'FONT')
        cu.align_x = 'LEFT'
        cu.align_y = 'CENTER'
        self.txt = bpy.data.objects.new('GV_Label', cu)
        sc.collection.objects.link(self.txt)
        cam = bpy.data.objects.new('GV_LabelCam', bpy.data.cameras.new('GV_LabelCam'))
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = 10.0
        cam.location = (0, 0, 10)
        sc.collection.objects.link(cam)
        sc.camera = cam
        self.sc = sc

    def image(self, text, w, h):
        sc = self.sc
        sc.render.resolution_x, sc.render.resolution_y = w, h
        hm = 10.0 * h / w
        lines = text.count('\n') + 1
        self.txt.data.body = text
        self.txt.data.size = hm * (0.62 if lines == 1 else 0.40)
        self.txt.location = (-5.0 + 0.25, 0.0 + (hm * 0.06 if lines > 1 else 0.0), 0)
        path = os.path.join(OUT, '_label.png')
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True, scene=sc.name)
        px = load_px(path)
        os.remove(path)
        return px


def compose(cells, labels, cols, out_path, bg=(0.112, 0.118, 0.152)):
    """Cells (pixel arrays, same size) each above its label strip, row-major, first row at the top."""
    blocks = [np.concatenate([lab, img], axis=0) for img, lab in zip(cells, labels)]
    h, w, _ = blocks[0].shape
    rows = (len(blocks) + cols - 1) // cols
    sheet = np.zeros((rows * h, cols * w, 4), dtype=np.float32)
    sheet[..., :3] = bg
    sheet[..., 3] = 1.0
    for i, b in enumerate(blocks):
        r, c = divmod(i, cols)
        y0 = (rows - 1 - r) * h
        sheet[y0:y0 + h, c * w:(c + 1) * w] = b
    save_px(out_path, sheet)
    return out_path


def hstack(paths, out_path):
    px = [load_px(p) for p in paths]
    save_px(out_path, np.concatenate(px, axis=1))
    return out_path


class Reviewer:
    def __init__(self, objs):
        from render import Stage
        for ob in list(bpy.data.objects):
            if any(c.name == 'GV_Stage' for c in ob.users_collection):
                bpy.data.objects.remove(ob, do_unlink=True)
        self.st = Stage(OUT, size=600, quick=QUICK)
        self.sc = bpy.context.scene
        self.objs = objs
        self.body = bpy.data.objects['Body_' + FRAME]
        self.rig = bpy.data.objects['Rig_' + FRAME]
        for o in bpy.data.objects:
            if o.type == 'MESH' and (o.name.startswith('Body_') or o.name.startswith('Sticks')):
                o.hide_render = True
        self.labels = Labels()
        self.tmp = []

    def only(self, show):
        for o in self.objs:
            o.hide_render = o not in show
        self.body.hide_render = True

    def pose(self, extra=None):
        from rig import key_pose
        p = dict(FIST)
        p.update(extra or {})
        key_pose(self.rig, 1, p)
        self.sc.frame_set(1)
        bpy.context.view_layer.update()

    def clear_pose(self):
        from rig import rest_pose
        self.rig.animation_data_clear()
        for act in [a for a in bpy.data.actions if not a.use_fake_user]:
            bpy.data.actions.remove(act)
        rest_pose(self.rig)
        bpy.context.view_layer.update()

    def size(self, n):
        self.sc.render.resolution_x = self.sc.render.resolution_y = n

    # ---------------------------------------------------------------- the weapon sheet
    def sheet_cell(self, ob, px=300):
        yaw = META.get(ob.name, {}).get('yaw', 22)
        M = R_DISP @ Matrix.Rotation(math.radians(yaw), 4, 'Y')
        pts = [M @ v.co for v in ob.data.vertices]
        dx = max(p.x for p in pts) - min(p.x for p in pts)
        dz = max(p.z for p in pts) - min(p.z for p in pts)
        roll = META.get(ob.name, {}).get('roll')
        if roll is not None:
            M = Matrix.Rotation(math.radians(roll), 4, 'Y') @ M
            pts = [M @ v.co for v in ob.data.vertices]
        elif dz > 2.2 * dx:
            M = Matrix.Rotation(math.radians(45), 4, 'Y') @ M
            pts = [M @ v.co for v in ob.data.vertices]
        lo = Vector([min(p[i] for p in pts) for i in range(3)])
        hi = Vector([max(p[i] for p in pts) for i in range(3)])
        c = (lo + hi) / 2
        ext = max(hi.x - lo.x, hi.z - lo.z) * 1.12
        ob.matrix_world = Matrix.Translation(-c) @ M
        self.only([ob])
        self.st.show_platform(False)
        self.size(px)
        self.st.camera((0, -4, 0), (0, 0, 0), ortho=ext)
        path = self.st.shot('_cell_%s.png' % ob.name)
        ob.matrix_world = Matrix.Identity(4)
        self.tmp.append(path)
        return path, max(hi - lo)

    def weapon_sheet(self, objs, rows):
        info = {r[0]: r for r in rows}
        cells, labels = [], []
        for ob in objs:
            p, size = self.sheet_cell(ob)
            cells.append(load_px(p))
            labels.append(self.labels.image('%s\n%.2f m   %d tris' % (ob.name, info[ob.name][4], info[ob.name][1]), 300, 44))
        out = compose(cells, labels, 8, os.path.join(OUT, 'weapon_sheet.png'))
        log('rendered', os.path.relpath(out, REPO))

    # ---------------------------------------------------------------- held: fit checks and the 200-px read
    def companions(self, ob):
        """Meshes shown with ob when it is held: the quiver with its arrows and the arrows in their quiver."""
        tier = ob['tier']
        by = {o.name: o for o in self.objs}
        if ob.name.startswith('qvr_quiver'):
            return [by['qvr_arrowsFull_' + tier]]
        if ob.name.startswith('qvr_arrows'):
            return [by['qvr_quiver_' + tier]]
        return []

    def hold(self, ob):
        sock = bpy.data.objects['%s.%s' % (ob['socket'], FRAME)]
        held = []
        for o in [ob] + self.companions(ob):
            c = o.copy()
            c.name = o.name + '.held'
            self.sc.collection.objects.link(c)
            c.parent = sock
            c.matrix_parent_inverse = Matrix.Identity(4)
            c.matrix_basis = Matrix.Identity(4)
            held.append(c)
        bpy.context.view_layer.update()
        for o in self.objs:
            o.hide_render = True
        for c in held:
            c.hide_render = False      # copies inherit the original's flag (hidden by the sheet pass)
        self.body.hide_render = False
        return held, sock

    def drop(self, held):
        for c in held:
            bpy.data.objects.remove(c, do_unlink=True)

    def fit(self, ob, tag='apose', extra_pose=None, px=420):
        self.pose(extra_pose)
        held, sock = self.hold(ob)
        self.st.show_platform(False)
        self.size(px)
        hand = sock.matrix_world.translation.copy()
        pts = [c.matrix_world @ v.co for c in held for v in c.data.vertices]
        lo = Vector([min(min(p[i] for p in pts), hand[i] - 0.25) for i in range(3)])
        hi = Vector([max(max(p[i] for p in pts), hand[i] + 0.25) for i in range(3)])
        cen = (lo + hi) / 2
        side = -1 if ob['socket'] == HR else 1
        if ob['socket'] == BACK:
            views = [('back', (cen.x, cen.y + 4, cen.z), max(hi.x - lo.x, hi.z - lo.z)),
                     ('side', (cen.x - 4, cen.y, cen.z), max(hi.y - lo.y, hi.z - lo.z))]
        else:
            views = [('front', (cen.x, cen.y - 4, cen.z), max(hi.x - lo.x, hi.z - lo.z)),
                     ('side', (cen.x + side * 4, cen.y, cen.z), max(hi.y - lo.y, hi.z - lo.z))]
        paths = []
        for vname, loc, ext in views:
            self.st.camera(loc, (cen.x, cen.y, cen.z), ortho=max(ext * 1.12, 0.55))
            paths.append(self.st.shot('_fit_%s_%s.png' % (ob.name, vname)))
        # close-up: three-quarter from outside the hand (from behind for the quiver)
        if ob['socket'] == BACK:
            self.st.camera(hand + Vector((0.55, 0.85, 0.15)), hand + Vector((0, 0, 0.02)), lens=40)
        else:
            self.st.camera(hand + Vector((side * 0.46, -0.42, 0.20)), hand + Vector((0, -0.02, 0.0)), lens=50)
        paths.append(self.st.shot('_fit_%s_close.png' % ob.name))
        out = hstack(paths, os.path.join(OUT, 'fit_%s_%s.png' % (ob.name, tag)))
        for p in paths:
            os.remove(p)
        self.drop(held)
        self.clear_pose()
        log('rendered', os.path.relpath(out, REPO))
        return out

    def read200(self, objs):
        """The hero holding each mesh, whole body, from the weapon's side, at 200 px (rendered at 400, shrunk)."""
        cells, labels = [], []
        self.pose()
        self.st.show_platform(True)
        for ob in objs:
            if ob.name.startswith('qvr_arrowsFull'):
                continue                       # shown in its quiver
            held, sock = self.hold(ob)
            self.size(400)
            side = -1 if ob['socket'] == HR else 1
            if ob['socket'] == BACK:
                self.st.camera((1.3, 2.9, 1.45), (0.0, 0.0, 0.95), lens=50)
            else:
                self.st.camera((side * 2.55, -1.75, 1.40), (side * 0.10, -0.05, 0.92), lens=50)
            p = self.st.shot('_read_%s.png' % ob.name)
            small = shrink(p, 200, p.replace('.png', '_200.png'))
            cells.append(load_px(small))
            labels.append(self.labels.image(ob.name, 200, 22))
            os.remove(p)
            os.remove(small)
            self.drop(held)
        self.clear_pose()
        out = compose(cells, labels, 8, os.path.join(OUT, 'read200_sheet.png'))
        log('rendered', os.path.relpath(out, REPO))

    def cleanup(self):
        for p in self.tmp:
            if os.path.exists(p):
                os.remove(p)
        bpy.data.scenes.remove(self.labels.sc)
        for o in self.objs:
            o.hide_render = False


# A shield guard for this orientation: the left arm hangs forward and in, turned inward (+Y on the left upper arm is
# internal rotation) so the back of the hand — the shield's face — looks at the enemy and the fingers point down.
GUARD_L = {'LeftUpperArm': (32, 80, -14), 'LeftLowerArm': (22, 0, 0), 'LeftHand': (0, 0, 0)}


def review(objs, rows):
    rv = Reviewer(objs)
    sel = [o for o in objs if not ONLY or any(t in o.name for t in ONLY)]
    if sel:
        rv.weapon_sheet(sel, rows)
        rv.read200(sel)
        always_f = ('wpn_sword', 'wpn_greatsword', 'wpn_shortbow', 'wpn_longbow', 'shd_shieldBuckler', 'shd_shieldKite',
                    'shd_shieldTower', 'qvr_quiver')
        for ob in sel:
            base = ob.name.rsplit('_', 1)[0]
            if ob.name.startswith('qvr_arrows'):
                continue
            if ob['tier'] == 'S' or base in always_f:
                rv.fit(ob)
            if ob['kind'] == 'shield' and ob['tier'] == 'S':
                rv.fit(ob, 'guard', GUARD_L)
    rv.cleanup()


# ============================================================================ export
def export(objs):
    from export import export_glb, prepare_for_export
    prepare_for_export(objs)
    for o in objs:
        o.matrix_world = Matrix.Identity(4)
        o.parent = None
    kb = export_glb(GLB, objs)
    return kb


def main():
    if 'Body_' + FRAME not in bpy.data.objects:
        raise RuntimeError('open art/build/hero_body.blend first')
    for ob in list(collection('Weapons').objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    objs, rows = build_all()
    if not ARGS.get('no_renders'):
        review(objs, rows)
    save_blend(os.path.join(BUILD, 'weapons.blend'))
    if not ARGS.get('no_export'):
        kb = export(objs)
        log('weapons.glb %.1f KB, %d meshes, %d tris' % (kb, len(objs), sum(r[1] for r in rows)))
    if ARGS.get('check'):
        from export import reimport_report
        for line in reimport_report(GLB):
            log(line)


main()

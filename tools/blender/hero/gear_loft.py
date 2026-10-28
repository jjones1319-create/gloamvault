"""gear_loft.py — lofted plates, bound free geometry and the gear review loop, on top of gear_lib (README §Gear).

gear_lib builds a piece from body faces pushed out (`shell`, `cut`, `add_rim`) or from free geometry bound to the broad
body (`bind_mesh`), and `realize()` makes it an object for a frame. Chunky stylised armour needs simpler shapes than the
anatomy (a breastplate is a barrel, not a copy of the pecs), so this module adds:

- **sections** — the body's outer envelope in a plane (triangle/plane cuts, rays in the plane, an optional convex hull),
  so a plate is a loft of clean convex rings around a limb or the torso (`Forge.ring`, `Forge.tube`);
- **far hits** — rays from a centre to the body's farthest surface (helmets, pauldrons, coifs: `Forge.far`);
- **binding with a face filter** — a thigh plate binds to the thigh, never to the other leg (`Forge.bind`);
- **parts** — every part of a piece is realized with `gear_lib.realize`, its skin weights shaped by a rule (allowed
  bones, rigid, smoothed), pushed clear of the body and of the parts under it in every shape (both frames, every species
  key), and the parts are joined into the slot's object (`Forge.make`);
- **the review loop** — a palette per class and tier, the body with the hidden regions removed and drawn single-sided
  (as the client draws it), card / 200-px / ortho / gear sheet / test poses / species renders (`Review`).

Written by the Warden + Blade gear pass; any gear pass may use it. Coordinates are the broad frame's rest (A-pose)
space: metres, Z up, the character faces -Y, +X is the character's left.
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))
sys.path.insert(0, HERE)
import gear_lib as GL  # noqa: E402
import toon  # noqa: E402
from common import BUILD, CONTENT, RENDERS, collection, log, read_json, save_blend  # noqa: E402
from fit import SurfaceMap  # noqa: E402

SL = toon.SLOT
RG = toon.REGION
FRAMES = GL.FRAMES
FRONT = Vector((0, -1, 0))
UP = Vector((0, 0, 1))


def vec(p):
    return Vector((float(p[0]), float(p[1]), float(p[2])))


def unit(v):
    v = Vector(v)
    return v.normalized() if v.length > 1e-12 else v


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))) if b != a else (1.0 if x >= a else 0.0)
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ free geometry in broad-basis space
class Grid:
    """Vertices, faces and per-face palette slots, built row by row; patches remember how to face outward."""

    def __init__(self):
        self.verts, self.faces, self.slots = [], [], []
        self.patches = []          # (first face, end face, orient) — orient: 'body' or a Vector (an inside point)

    def tris(self):
        return sum(len(f) - 2 for f in self.faces)

    def rows(self, rows, slot, closed=False, orient='body'):
        """Quads between consecutive rows (equal-length point lists). `slot` is an int or fn(band, column)."""
        m = len(rows[0])
        base = len(self.verts)
        for r in rows:
            assert len(r) == m, (len(r), m)
            self.verts += [Vector(p) for p in r]
        f0 = len(self.faces)
        cols = m if closed else m - 1
        for i in range(len(rows) - 1):
            for j in range(cols):
                a = base + i * m + j
                b = base + i * m + (j + 1) % m
                c = base + (i + 1) * m + (j + 1) % m
                d = base + (i + 1) * m + j
                self.faces.append((a, b, c, d))
                self.slots.append(slot(i, j) if callable(slot) else slot)
        self.patches.append((f0, len(self.faces), orient))
        return base

    def fan(self, ring, apex, slot, closed=True, orient='body'):
        """Triangles from a ring of points to an apex (dome tops, finger tips, toe caps)."""
        base = len(self.verts)
        self.verts += [Vector(p) for p in ring]
        ai = len(self.verts)
        self.verts.append(Vector(apex))
        f0 = len(self.faces)
        m = len(ring)
        for j in range(m if closed else m - 1):
            self.faces.append((base + j, base + (j + 1) % m, ai))
            self.slots.append(slot(j) if callable(slot) else slot)
        self.patches.append((f0, len(self.faces), orient))

    def poly(self, verts, faces, slots, orient):
        base = len(self.verts)
        self.verts += [Vector(p) for p in verts]
        f0 = len(self.faces)
        for f, s in zip(faces, slots if isinstance(slots, (list, tuple)) else [slots] * len(faces)):
            self.faces.append(tuple(base + i for i in f))
            self.slots.append(s)
        self.patches.append((f0, len(self.faces), orient))

    def box(self, center, x, y, z, slot, orient=None):
        """A box from a centre and three half-axis vectors (buckles, studs, crest fins)."""
        c = Vector(center)
        x, y, z = Vector(x), Vector(y), Vector(z)
        vs = [c + sx * x + sy * y + sz * z for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)]
        fs = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
        self.poly(vs, fs, slot, orient if orient is not None else c)

    def stud(self, center, normal, size, slot):
        """A four-sided pyramid stud (a rivet) standing on `normal`."""
        n = unit(normal)
        t = unit(n.cross(UP) if abs(n.dot(UP)) < 0.9 else n.cross(FRONT))
        b = n.cross(t)
        c = Vector(center)
        base = [c + (t * math.cos(a) + b * math.sin(a)) * size for a in (0, math.pi / 2, math.pi, 1.5 * math.pi)]
        top = c + n * size * 0.9
        self.poly(base + [top], [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], slot, c - n * 0.05)

    def extend(self, other):
        base = len(self.verts)
        f0 = len(self.faces)
        self.verts += [v.copy() for v in other.verts]
        self.faces += [tuple(base + i for i in f) for f in other.faces]
        self.slots += list(other.slots)
        self.patches += [(a + f0, b + f0, o) for a, b, o in other.patches]
        return self

    def mirrored(self):
        """The same geometry on the other side (x → −x), faces turned so they still look outward."""
        g = Grid()
        g.verts = [Vector((-p.x, p.y, p.z)) for p in self.verts]
        g.faces = [tuple(reversed(f)) for f in self.faces]
        g.slots = list(self.slots)
        g.patches = [(a, b, Vector((-o.x, o.y, o.z)) if isinstance(o, Vector) else o) for a, b, o in self.patches]
        return g

    def weld(self, eps=1e-6):
        """Merges coincident vertices (rows shared by two patches) so normals run smoothly across the seam."""
        key, remap, verts = {}, [], []
        for p in self.verts:
            k = (round(p.x / eps), round(p.y / eps), round(p.z / eps))
            if k not in key:
                key[k] = len(verts)
                verts.append(p)
            remap.append(key[k])
        owner = [None] * len(self.faces)
        for pi, (a, b, _) in enumerate(self.patches):
            for fi in range(a, b):
                owner[fi] = pi
        faces, slots, owners = [], [], []
        for fi, (f, s) in enumerate(zip(self.faces, self.slots)):
            g = []
            for i in f:
                j = remap[i]
                if not g or g[-1] != j:
                    g.append(j)
            if len(g) > 1 and g[0] == g[-1]:
                g.pop()
            if len(set(g)) >= 3:
                faces.append(tuple(g))
                slots.append(s)
                owners.append(owner[fi])
        patches = []
        for fi, pi in enumerate(owners):
            if patches and patches[-1][3] == pi:
                patches[-1][1] = fi + 1
            else:
                patches.append([fi, fi + 1, self.patches[pi][2] if pi is not None else 'body', pi])
        self.patches = [(a, b, o) for a, b, o, _ in patches]
        self.verts, self.faces, self.slots = verts, faces, slots
        return self

    def orient(self, forge):
        """Turns each patch so its faces look away from the body (or away from the patch's inside point)."""
        tree = forge.body_tree('broad', 'Basis')
        for f0, f1, how in self.patches:
            vote = 0.0
            for fi in range(f0, f1):
                pts = [self.verts[i] for i in self.faces[fi]]
                n = _newell(pts)
                c = sum(pts, Vector((0, 0, 0))) / len(pts)
                if isinstance(how, Vector):
                    ref = c - how
                else:
                    loc, nrm, _, _ = tree.find_nearest(c)
                    ref = nrm if loc is not None else c
                vote += n.dot(unit(ref)) * n.length
            if vote < 0:
                for fi in range(f0, f1):
                    self.faces[fi] = tuple(reversed(self.faces[fi]))


def _newell(pts):
    n = Vector((0, 0, 0))
    for k in range(len(pts)):
        a, b = pts[k], pts[(k + 1) % len(pts)]
        n.x += (a.y - b.y) * (a.z + b.z)
        n.y += (a.z - b.z) * (a.x + b.x)
        n.z += (a.x - b.x) * (a.y + b.y)
    return n


def _hull2d(P):
    """Convex hull (counter-clockwise) of 2-D points (Andrew's monotone chain)."""
    pts = sorted(set((round(float(x), 7), round(float(y), 7)) for x, y in P))
    if len(pts) < 3:
        return np.array(pts)

    def cr(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cr(hi[-2], hi[-1], p) <= 0:
            hi.pop()
        hi.append(p)
    return np.array(lo[:-1] + hi[:-1])


def _ray_segments(D, A2, B2, far=True):
    """Distance along each 2-D ray direction D (n,2) from the origin to the segments A2→B2 (k,2): the farthest (or
    nearest) hit, NaN where a ray hits nothing."""
    if len(A2) == 0:
        return np.full(len(D), np.nan)
    E = B2 - A2
    den = D[:, None, 0] * E[None, :, 1] - D[:, None, 1] * E[None, :, 0]
    num_t = A2[None, :, 0] * E[None, :, 1] - A2[None, :, 1] * E[None, :, 0]
    num_s = A2[None, :, 0] * D[:, None, 1] - A2[None, :, 1] * D[:, None, 0]
    ok = np.abs(den) > 1e-12
    safe = np.where(ok, den, 1.0)
    t = np.where(ok, num_t / safe, -1.0)
    s = np.where(ok, num_s / safe, -1.0)
    valid = ok & (t > 0) & (s >= -1e-9) & (s <= 1 + 1e-9)
    if far:
        r = np.where(valid, t, -np.inf).max(1)
        r[~np.isfinite(r)] = np.nan
    else:
        r = np.where(valid, t, np.inf).min(1)
        r[~np.isfinite(r)] = np.nan
    return r


def _fill(r, closed):
    """Fills NaN radii by interpolating between valid neighbours (circularly for closed rings)."""
    r = np.array(r, dtype=float)
    ok = np.isfinite(r)
    if ok.all():
        return r
    if not ok.any():
        return r
    n = len(r)
    idx = np.arange(n)
    if closed:
        xs = np.concatenate([idx[ok] - n, idx[ok], idx[ok] + n])
        ys = np.concatenate([r[ok]] * 3)
    else:
        xs, ys = idx[ok], r[ok]
    r[~ok] = np.interp(idx[~ok], xs, ys)
    return r


# ------------------------------------------------------------------ envelope fields
class Field:
    """r(t, θ): the body's outer envelope around the straight axis p0→p1, sampled at `stations` (fractions of the
    axis, may run past 0 and 1) × n directions, so any patch over (t, θ) can be sampled: a cuirass whose top follows
    the armholes, a tabard panel, a tasset arc, a cuff. θ = 0 along `ref` projected; θ grows toward axis × ref (for an
    upward axis with ref = front, θ = 90° is the character's left; `theta_of()` turns a world direction into θ)."""

    def __init__(self, fg, p0, p1, stations, n, fidx, ref=FRONT, rmax=0.3, convex=1.0, recenter=True, smooth=1):
        self.p0, self.p1 = Vector(p0), Vector(p1)
        self.axis = unit(self.p1 - self.p0)
        self.len = (self.p1 - self.p0).length
        self.n = n
        a = self.axis
        r0 = Vector(ref)
        self.u = unit(r0 - a * r0.dot(a))
        self.v = a.cross(self.u)
        T, C, R = [], [], []
        for t in stations:
            c = self.p0 + (self.p1 - self.p0) * t
            if recenter:
                c = fg.centre(c, a, ref, fidx, rmax)
            sec = fg.section(c, a, ref, n, fidx, rmax=rmax, convex=convex)
            T.append(float(t))
            C.append(c)
            R.append(None if sec is None else np.array(sec[0]))
        good = [i for i, r in enumerate(R) if r is not None]
        if not good:
            raise RuntimeError('Field: no station hit the body')
        for i in range(len(R)):
            if R[i] is None:
                j = min(good, key=lambda g: abs(g - i))
                R[i] = R[j].copy()
                C[i] = C[j] + a * (T[i] - T[j]) * self.len
        R = np.array(R)
        for _ in range(smooth):
            R2 = R.copy()
            R2[1:-1] = 0.25 * R[:-2] + 0.5 * R[1:-1] + 0.25 * R[2:]
            R = R2
        self.T, self.C, self.R = np.array(T), C, R

    def _ti(self, t):
        T = self.T
        if t <= T[0]:
            return 0, 0, 0.0
        if t >= T[-1]:
            return len(T) - 1, len(T) - 1, 0.0
        i = int(np.searchsorted(T, t)) - 1
        return i, i + 1, (t - T[i]) / (T[i + 1] - T[i])

    def radius(self, t, th):
        i, j, f = self._ti(t)
        x = (th % (2 * math.pi)) / (2 * math.pi) * self.n
        k0 = int(math.floor(x)) % self.n
        k1 = (k0 + 1) % self.n
        g = x - math.floor(x)
        ri = self.R[i, k0] * (1 - g) + self.R[i, k1] * g
        rj = self.R[j, k0] * (1 - g) + self.R[j, k1] * g
        return float(ri * (1 - f) + rj * f)

    def centre(self, t):
        T = self.T
        if t < T[0]:
            return self.C[0] + self.axis * (t - T[0]) * self.len
        if t > T[-1]:
            return self.C[-1] + self.axis * (t - T[-1]) * self.len
        i, j, f = self._ti(t)
        return self.C[i].lerp(self.C[j], f)

    def dir(self, th):
        return self.u * math.cos(th) + self.v * math.sin(th)

    def theta_of(self, d):
        d = Vector(d)
        return math.atan2(d.dot(self.v), d.dot(self.u))

    def t_at(self, p):
        """The station of a world point (its projection on the axis)."""
        return (Vector(p) - self.p0).dot(self.axis) / self.len

    def pt(self, t, th, off=0.0, scale=1.0):
        return self.centre(t) + self.dir(th) * (self.radius(t, th) * scale + off)

    def rows(self, ts, ths, off=0.0, scale=1.0):
        """A grid of points: one row per t (a number, or fn(θ) for rows that follow a curve), one column per θ;
        `off` a number or fn(t, θ)."""
        out = []
        for t in ts:
            row = []
            for th in ths:
                tt = t(th) if callable(t) else t
                o = off(tt, th) if callable(off) else off
                row.append(self.pt(tt, th, o, scale))
            out.append(row)
        return out


class Sphere:
    """r(e, β): the farthest body surface along rays from a centre, over elevations e (radians, from the plane normal
    to `up`) and azimuths β (β = 0 along `fwd`, growing toward up × fwd). Helmets, coifs and pauldrons are patches
    over it; `dilate` widens bumps (ears) before `smooth` rounds them off."""

    def __init__(self, fg, center, fwd, up, fidx, elev, n_azim, smooth=1, dilate=0, maxd=0.5, floor=None, first=False,
                 convex_cols=False):
        self.c = Vector(center)
        self.w = unit(up)
        f = Vector(fwd)
        self.u = unit(f - self.w * f.dot(self.w))
        self.v = self.w.cross(self.u)
        self.E = np.array(elev, dtype=float)
        self.nb = n_azim
        R = np.full((len(self.E), n_azim), np.nan)
        for i, e in enumerate(self.E):
            for j in range(n_azim):
                b = 2 * math.pi * j / n_azim
                r = fg.far(self.c, self.dir(e, b), fidx, maxd, first=first)
                if r is not None:
                    R[i, j] = r
        for i in range(len(self.E)):
            R[i] = _fill(R[i], True)
        for j in range(n_azim):
            R[:, j] = _fill(R[:, j], False)
        if np.isnan(R).any():
            R = np.where(np.isnan(R), np.nanmean(R) if not np.isnan(R).all() else (floor or 0.1), R)
        if floor is not None:
            R = np.maximum(R, floor)
        for _ in range(dilate):
            R2 = R.copy()
            for di in (-1, 0, 1):
                for dj in (-1, 0, 1):
                    sh = np.roll(R, dj, axis=1)
                    if di:
                        sh = np.roll(sh, di, axis=0)
                        if di > 0:
                            sh[0] = R[0]
                        else:
                            sh[-1] = R[-1]
                    R2 = np.maximum(R2, sh)
            R = R2
        if convex_cols:
            # each column's profile made (partly) convex: a hood hangs from the jaw toward the shoulders over the neck;
            # `convex_cols` (True = 1.0) is how far toward the hull the profile goes
            k = 1.0 if convex_cols is True else float(convex_cols)
            D = np.stack([np.cos(self.E), np.sin(self.E)], 1)
            for j in range(n_azim):
                P = D * R[:, j:j + 1]
                H = _hull2d(np.vstack([P, [[0.0, 0.0]]]))
                if len(H) >= 3:
                    rh = _ray_segments(D, H, np.roll(H, -1, axis=0), far=True)
                    full = np.where(np.isfinite(rh), np.maximum(R[:, j], rh), R[:, j])
                    R[:, j] = R[:, j] + k * (full - R[:, j])
        for _ in range(smooth):
            R2 = 0.5 * R + 0.125 * (np.roll(R, 1, axis=1) + np.roll(R, -1, axis=1))
            up_ = np.vstack([R[1:], R[-1:]])
            dn_ = np.vstack([R[:1], R[:-1]])
            R = R2 + 0.125 * (up_ + dn_)
        self.R = R

    def dir(self, e, b):
        return (self.u * math.cos(b) + self.v * math.sin(b)) * math.cos(e) + self.w * math.sin(e)

    def radius(self, e, b):
        E = self.E
        if e <= E[0]:
            i = j = 0
            f = 0.0
        elif e >= E[-1]:
            i = j = len(E) - 1
            f = 0.0
        else:
            i = int(np.searchsorted(E, e)) - 1
            j = i + 1
            f = (e - E[i]) / (E[j] - E[i])
        x = (b % (2 * math.pi)) / (2 * math.pi) * self.nb
        k0 = int(math.floor(x)) % self.nb
        k1 = (k0 + 1) % self.nb
        g = x - math.floor(x)
        ri = self.R[i, k0] * (1 - g) + self.R[i, k1] * g
        rj = self.R[j, k0] * (1 - g) + self.R[j, k1] * g
        return float(ri * (1 - f) + rj * f)

    def pt(self, e, b, off=0.0, scale=1.0):
        return self.c + self.dir(e, b) * (self.radius(e, b) * scale + off)

    def rows(self, es, bs, off=0.0, scale=1.0):
        """One row per elevation (a number or fn(β)), one column per β; `off` a number or fn(e, β)."""
        out = []
        for e in es:
            row = []
            for b in bs:
                ee = e(b) if callable(e) else e
                o = off(ee, b) if callable(off) else off
                row.append(self.pt(ee, b, o, scale))
            out.append(row)
        return out


class Fields:
    """The envelope fields a humanoid gear set samples, built once per run (left limbs only — right-side parts are
    built on the left and mirrored): torso (z 0.50→1.56, both thighs included below the crotch so skirts and tabards
    hang over the gap), upper arm, forearm, hand, the four fingers (a mitten), thumb, thigh, shin, foot (θ = 0 up),
    head (a sphere from the skull's centre) and the left shoulder (a sphere for pauldrons)."""

    def __init__(self, fg, head_center=(0, -0.012, 1.64)):
        self.fg = fg
        j = fg.joint
        D = math.radians
        Z0, Z1 = 0.50, 1.56
        self.Z0, self.Z1 = Z0, Z1
        left = lambda c: c[:, 0] > 0.0  # noqa: E731
        self.f_torso = fg.fsel(['chest', 'belly', 'thighs', 'neck'], where=lambda c: np.abs(c[:, 0]) < 0.26)
        self.torso = Field(fg, (0, -0.015, Z0), (0, -0.015, Z1), np.arange(0, 1.00001, 0.0125), 48, self.f_torso,
                           rmax=0.34, smooth=1)
        self.f_uarm = fg.fsel(['upperArms', 'forearms', 'chest'], where=lambda c: c[:, 0] > 0.13)
        self.uarm = Field(fg, j('LeftUpperArm'), j('LeftUpperArm', 'tail'), np.linspace(-0.1, 1.25, 28), 24,
                          self.f_uarm, rmax=0.12)
        self.f_farm = fg.fsel(['forearms', 'upperArms', 'hands'], where=lambda c: c[:, 0] > 0.2)
        self.farm = Field(fg, j('LeftLowerArm'), j('LeftLowerArm', 'tail'), np.linspace(-0.2, 1.15, 28), 24,
                          self.f_farm, rmax=0.10)
        hb = ['LeftHand', 'LeftThumbProximal']
        self.hand = Field(fg, j('LeftHand'), j('LeftHand', 'tail'), np.linspace(-0.1, 1.05, 16), 20,
                          fg.fsel(['hands'], bones=hb, where=left), rmax=0.09)
        fb = ['Left%s%s' % (f, p) for f in ('Index', 'Middle', 'Ring', 'Little') for p in ('Proximal', 'Intermediate', 'Distal')]
        self.fing = Field(fg, j('LeftMiddleProximal'), j('LeftMiddleDistal', 'tail'), np.linspace(-0.1, 1.0, 14), 20,
                          fg.fsel(['hands'], bones=fb, where=left), rmax=0.07)
        tb = ['LeftThumbProximal', 'LeftThumbIntermediate', 'LeftThumbDistal']
        self.thumb = Field(fg, j('LeftThumbIntermediate'), j('LeftThumbDistal', 'tail'), np.linspace(-0.3, 1.0, 12), 16,
                           fg.fsel(['hands'], bones=tb, where=left), rmax=0.05)
        self.thigh = Field(fg, j('LeftUpperLeg'), j('LeftUpperLeg', 'tail'), np.linspace(0.0, 1.2, 28), 24,
                           fg.fsel(['thighs', 'shins'], where=left), rmax=0.16)
        self.shin = Field(fg, j('LeftLowerLeg'), j('LeftLowerLeg', 'tail'), np.linspace(-0.15, 1.08, 26), 24,
                          fg.fsel(['shins', 'thighs', 'feet'], where=left), rmax=0.12)
        f_foot = fg.fsel(['feet'], where=left)
        fv = np.array([fg.V[i] for f in f_foot for i in fg.F[f]])
        heel = Vector((float(np.mean(fv[:, 0])), float(fv[:, 1].max()) - 0.005, 0.045))
        toe = Vector((float(fv[fv[:, 1].argmin(), 0]), float(fv[:, 1].min()) + 0.003, 0.035))
        self.foot = Field(fg, heel, toe, np.linspace(0.0, 1.0, 22), 20, f_foot, ref=UP, rmax=0.10)
        self.f_head = fg.fsel(['head'])
        self.head = Sphere(fg, head_center, FRONT, UP, fg.fsel(['head', 'neck']), [D(e) for e in range(-70, 91, 5)], 36,
                           smooth=2, dilate=1)
        self.f_pauld = fg.fsel(['chest', 'upperArms', 'neck'], where=lambda c: c[:, 0] > 0.03)
        self.pauld = Sphere(fg, (0.165, 0.005, 1.335), FRONT, (0.5, 0, 1.0), self.f_pauld,
                            [D(e) for e in range(-30, 91, 6)], 32, smooth=3, dilate=1, first=True, maxd=0.25)

    def tz(self, z):
        """The torso field's station at height z."""
        return (z - self.Z0) / (self.Z1 - self.Z0)

    def side(self, sign, regions, bones=None, xmin=0.0):
        """Body faces of one side (sign +1 left, −1 right) in `regions` (optionally dominated by `bones`)."""
        if sign > 0:
            return self.fg.fsel(regions, bones=bones, where=lambda c: c[:, 0] > xmin)
        return self.fg.fsel(regions, bones=bones, where=lambda c: c[:, 0] < -xmin)


def side_bones(names, sign):
    """['LeftHand', …] → the same bones on the side `sign` (+1 left, −1 right)."""
    if sign > 0:
        return list(names)
    return ['Right' + n[4:] if n.startswith('Left') else n for n in names]


def arc(a0, a1, n):
    """n angles from a0 to a1 inclusive (degrees in, radians out)."""
    return [math.radians(a0 + (a1 - a0) * k / (n - 1)) for k in range(n)]


def circle(n, start=0.0):
    return [math.radians(start) + 2 * math.pi * k / n for k in range(n)]


# ------------------------------------------------------------------ the forge
class Part:
    """One part of a piece: the gear_lib Piece and how its object is finished.
    allow: bones its weights may use (others dropped, then renormalised; `fallback` when nothing is left) ·
    rigid: one bone takes all weight · smooth: iterations of weight smoothing over the part's own mesh ·
    clear: the least distance from the body in every shape · over: keys of parts/pieces it must sit outside ·
    gap: the least distance from those."""

    def __init__(self, key, piece, allow=None, rigid=None, smooth=0, clear=0.004, over=(), gap=0.003, fallback=None,
                 reach=0.05, cap=None):
        self.key, self.piece = key, piece
        self.allow, self.rigid, self.smooth, self.clear = allow, rigid, smooth, clear
        self.over, self.gap, self.fallback, self.reach = tuple(over), gap, fallback, reach
        self.cap = cap or {}


class Forge:
    def __init__(self, bodies):
        self.bodies = bodies
        b = bodies['broad']
        self.V = [v.copy() for v in b.shapes['Basis']]
        self.Vn = np.array([tuple(v) for v in self.V])
        self.F = [tuple(f) for f in b.faces]
        self.Fn = np.array(self.F, dtype=np.int64)
        if self.Fn.ndim != 2 or self.Fn.shape[1] != 3:
            raise RuntimeError('gear_loft expects a triangulated body')
        self.N = [n.copy() for n in b.normals['Basis']]
        self.freg = np.array(b.face_regions)
        self.cent = self.Vn[self.Fn].mean(1)
        self.smap = SurfaceMap(self.V, self.F)      # all triangles: triangle index == face index
        self.vbone = [max(w, key=lambda t: t[1])[0] if w else '' for w in b.weights]
        fb = []
        for f in self.F:
            bs = [self.vbone[i] for i in f]
            fb.append(max(set(bs), key=bs.count))
        self.fbone = np.array(fb)
        self._trees = {}
        self._shape_trees = {}
        self.made = {}       # (frame, key) -> finished object (pieces) or part object (while a piece is built)
        self.tris = {}       # piece name -> triangles

    # ---- body queries
    def joint(self, bone, end='head', frame='broad'):
        return GL.joint(self.bodies, bone, end, frame)

    def fsel(self, regions=None, bones=None, where=None):
        """Body face indices: in `regions` (names), dominated by one of `bones`, and passing `where(centroids)`."""
        m = np.ones(len(self.F), bool)
        if regions is not None:
            m &= np.isin(self.freg, [RG[r] if isinstance(r, str) else r for r in regions])
        if bones is not None:
            m &= np.isin(self.fbone, list(bones))
        if where is not None:
            m &= where(self.cent)
        return np.nonzero(m)[0]

    def tree(self, fidx):
        k = hash(np.asarray(fidx, dtype=np.int64).tobytes())
        if k not in self._trees:
            self._trees[k] = BVHTree.FromPolygons(self.V, [self.F[i] for i in fidx])
        return self._trees[k]

    def body_tree(self, frame, shape):
        k = (frame, shape)
        if k not in self._shape_trees:
            b = self.bodies[frame]
            pos = b.shapes.get(shape, b.shapes['Basis'])
            self._shape_trees[k] = BVHTree.FromPolygons(pos, b.faces)
        return self._shape_trees[k]

    def nearest(self, p, fidx=None):
        """(point, normal) of the nearest body surface (broad basis), optionally among `fidx` faces."""
        t = self.tree(fidx) if fidx is not None else self.body_tree('broad', 'Basis')
        loc, nrm, _, _ = t.find_nearest(Vector(p))
        return loc, nrm

    def far(self, origin, direction, fidx, maxd=0.6, first=False):
        """The farthest body surface along a ray (through ears), or with `first` the first one it meets (from inside a
        shoulder: its own surface, never the far side of the torso): distance or None."""
        tree = self.tree(fidx)
        d = unit(direction)
        o = Vector(origin)
        last, left = None, maxd
        for _ in range(10):
            loc, nrm, _, dist = tree.ray_cast(o, d, left)
            if loc is None:
                break
            last = loc
            if first:
                break
            left -= dist + 1e-4
            o = loc + d * 1e-4
            if left <= 0:
                break
        return (last - Vector(origin)).length if last is not None else None

    # ---- sections
    def section(self, center, axis, ref, n, fidx, theta=None, rmax=0.3, convex=1.0, far=True):
        """The body's outer envelope in the plane through `center` normal to `axis`: radii along n directions
        (θ = 0 along `ref` projected into the plane, growing toward axis × ref). `theta=(θ0, θ1)` (radians) samples an
        open arc, inclusive; else a full circle. Returns (radii, unit directions, closed) or None."""
        c = np.array(tuple(center), dtype=float)
        a = np.array(tuple(unit(axis)))
        r0 = np.array(tuple(ref), dtype=float)
        u = r0 - a * r0.dot(a)
        u /= np.linalg.norm(u)
        v = np.cross(a, u)
        tri = self.Fn[np.asarray(fidx, dtype=np.int64)]
        d = (self.Vn - c) @ a
        dt = d[tri]
        cr = (dt.min(1) < 0) & (dt.max(1) > 0)
        tri, dt = tri[cr], dt[cr]
        closed = theta is None
        ths = (np.arange(n) * 2 * math.pi / n) if closed else np.linspace(theta[0], theta[1], n)
        D = np.stack([np.cos(ths), np.sin(ths)], 1)
        dirs = [Vector(tuple(math.cos(t) * u + math.sin(t) * v)) for t in ths]
        if len(tri) == 0:
            return None
        P = self.Vn[tri]
        pts, ms = [], []
        for i, j in ((0, 1), (1, 2), (2, 0)):
            di, dj = dt[:, i], dt[:, j]
            m = (di < 0) != (dj < 0)
            den = np.where(m, di - dj, 1.0)
            t = np.where(m, di / den, 0.0)
            pts.append(P[:, i] + t[:, None] * (P[:, j] - P[:, i]))
            ms.append(m)
        A = np.where(ms[0][:, None], pts[0], pts[1])
        B = np.where(ms[2][:, None], pts[2], pts[1])
        A2 = np.stack([(A - c) @ u, (A - c) @ v], 1)
        B2 = np.stack([(B - c) @ u, (B - c) @ v], 1)
        keep = (np.linalg.norm(A2, axis=1) < rmax) & (np.linalg.norm(B2, axis=1) < rmax)
        A2, B2 = A2[keep], B2[keep]
        r = _ray_segments(D, A2, B2, far=far)
        if convex > 0 and np.isfinite(r).sum() >= 3:
            Q = np.concatenate([A2, B2])
            H = _hull2d(Q)
            if len(H) >= 3:
                rh = _ray_segments(D, H, np.roll(H, -1, axis=0), far=True)
                good = np.isfinite(rh) & np.isfinite(r)
                r = np.where(good, r + convex * (rh - r), np.where(np.isfinite(rh), rh, r))
        r = _fill(r, closed)
        if not np.isfinite(r).all():
            return None
        return r, dirs, closed

    def centre(self, center, axis, ref, fidx, rmax=0.3):
        """The middle of a section's extent (re-centres rings on limbs whose bone is off the middle)."""
        sec = self.section(center, axis, ref, 16, fidx, rmax=rmax, convex=1.0)
        if sec is None:
            return Vector(center)
        r, dirs, _ = sec
        pts = [Vector(center) + d * float(x) for x, d in zip(r, dirs)]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        mid = (lo + hi) / 2
        a = unit(axis)
        return mid - a * (mid - Vector(center)).dot(a)

    def ring(self, center, axis, ref, n, fidx, offset=0.01, theta=None, rmax=0.3, convex=1.0, scale=1.0, minr=0.0,
             recenter=False):
        """Points of a section's envelope pushed out by `offset` (a number or fn(θ index) → metres)."""
        c = self.centre(center, axis, ref, fidx, rmax) if recenter else Vector(center)
        sec = self.section(c, axis, ref, n, fidx, theta=theta, rmax=rmax, convex=convex)
        if sec is None:
            return None
        r, dirs, _ = sec
        out = []
        for k, (x, d) in enumerate(zip(r, dirs)):
            off = offset(k) if callable(offset) else offset
            out.append(c + d * (max(minr, float(x) * scale) + off))
        return out

    def tube(self, p0, p1, stations, n, fidx, offsets, ref=FRONT, theta=None, rmax=0.25, convex=1.0, smooth=1,
             recenter=True, scales=None):
        """Rings along p0→p1 at the fractions `stations` (may run past 0 and 1), each pushed out by its offset (a
        number or fn(θ index)); radii smoothed along the tube `smooth` times. Rings the plane misses copy a neighbour."""
        p0, p1 = Vector(p0), Vector(p1)
        axis = unit(p1 - p0)
        raw = []
        for k, t in enumerate(stations):
            c = p0 + (p1 - p0) * t
            if recenter:
                c = self.centre(c, axis, ref, fidx, rmax)
            sec = self.section(c, axis, ref, n, fidx, theta=theta, rmax=rmax, convex=convex)
            raw.append((c, sec))
        good = [i for i, (_, s) in enumerate(raw) if s is not None]
        if not good:
            raise RuntimeError('tube: no section hit')
        R, C, Dd = [], [], None
        for i, (c, s) in enumerate(raw):
            j = i if s is not None else min(good, key=lambda g: abs(g - i))
            R.append(np.array(raw[j][1][0]))
            C.append(c)
            Dd = raw[j][1][1] if Dd is None else Dd
        R = np.array(R)
        for _ in range(smooth):
            R2 = R.copy()
            R2[1:-1] = 0.25 * R[:-2] + 0.5 * R[1:-1] + 0.25 * R[2:]
            R = R2
        dirs = raw[good[0]][1][1]
        rows = []
        for k, (c, r) in enumerate(zip(C, R)):
            off = offsets[k] if isinstance(offsets, (list, tuple)) else offsets
            sc = scales[k] if scales else 1.0
            rows.append([c + d * (float(x) * sc + (off(j) if callable(off) else off)) for j, (x, d) in enumerate(zip(r, dirs))])
        return rows, C, R, dirs

    # ---- binding into gear_lib pieces
    def bind(self, piece, grid, fidx=None):
        """Adds a Grid to a Piece, every vertex bound to its nearest body triangle among `fidx` (default: all)."""
        grid.orient(self)
        tree = self.tree(fidx) if fidx is not None else self.body_tree('broad', 'Basis')
        sel = np.asarray(fidx, dtype=np.int64) if fidx is not None else None
        base = len(piece.src)
        for p in grid.verts:
            loc, nrm, li, dist = tree.find_nearest(p)
            if loc is None:
                raise RuntimeError('bind: no surface near %s' % (tuple(p),))
            ti = int(sel[li]) if sel is not None else int(li)
            piece.src.append(('bind', ti, Vector(p), 0.0))
        for f, s in zip(grid.faces, grid.slots):
            piece.add_face([base + i for i in f], s)
        piece._smap = self.smap
        return piece

    def piece(self, name, grid, fidx=None):
        p = GL.Piece(name)
        return self.bind(p, grid, fidx)

    # ---- finishing
    def make(self, name, parts, frame, props, register=None):
        """Realizes every part for `frame`, shapes its weights, clears it, joins the parts into object `name`."""
        objs, local = [], {}
        for part in parts:
            if not part.piece.faces:
                continue
            ob = GL.realize(part.piece, self.bodies, frame, '%s~%s' % (name, part.key), {}, collection_name='Gear')
            shape_weights(ob, allow=part.allow, rigid=part.rigid, smooth=part.smooth, fallback=part.fallback,
                          cap=part.cap)
            colliders = []
            for k in part.over:
                o = local.get(k) or self.made.get((frame, k))
                if o is not None:
                    colliders.append(o)
            self.clear(ob, frame, part.clear, colliders, part.gap, part.reach)
            local[part.key] = ob
            objs.append(ob)
        final = join(objs, name)
        for k, v in props.items():
            final[k] = v
        if register:
            self.made[(frame, register)] = final
        return final

    def clear(self, ob, frame, min_off, colliders=(), gap=0.003, reach=0.05, behind=0.03, max_push=0.03, spread=3):
        """Pushes vertices out until they sit `min_off` above the body (along the nearest body normal) and `gap` above
        each collider within `reach`, in the basis and in every shape key. A collider only pushes where its face looks
        the same way as the body under the vertex (a layer, not a lip or a flange) and the vertex is less than
        `behind` under it; one push is at most `max_push`. The pushes are then spread over the mesh (`spread`
        smoothing passes of the displacement, coincident vertices together) and checked again, so a vertex pushed far
        drags its neighbours along instead of folding the faces round it (round 6: folds on the Orc's hauberk)."""
        me = ob.data
        kbs = me.shape_keys.key_blocks if me.shape_keys else None
        shapes = [kb.name for kb in kbs] if kbs else ['Basis']
        total = 0
        twin, nbr = _adjacency(me) if spread else (None, None)
        for sh in shapes:
            pos = [d.co.copy() for d in kbs[sh].data] if kbs else [v.co.copy() for v in me.vertices]
            body = self.body_tree(frame, sh)
            others = [_object_tree(c, sh) for c in colliders]

            def push(p):
                q = p
                for _ in range(2):
                    loc, nb, _, _ = body.find_nearest(q)
                    if loc is None:
                        continue
                    s = (q - loc).dot(nb)
                    if s < min_off:
                        q = q + nb * (min_off - s)
                    for tree in others:
                        hit = tree.find_nearest(q, reach)
                        if hit[0] is None or hit[1].dot(nb) < 0.35:
                            continue
                        s = (q - hit[0]).dot(hit[1])
                        if -behind < s < gap:
                            q = q + hit[1] * min(gap - s, max_push)
                return q
            first = [push(p) for p in pos]
            disp = [q - p for q, p in zip(first, pos)]
            if spread and any(d.length > 1e-7 for d in disp):
                reps = sorted(set(twin))
                D_ = {r: disp[r].copy() for r in reps}
                for _ in range(spread):
                    new = {}
                    for r in reps:
                        if nbr[r]:
                            avg = sum((D_[q] for q in nbr[r]), Vector((0, 0, 0))) / len(nbr[r])
                            new[r] = D_[r] * 0.5 + avg * 0.5
                        else:
                            new[r] = D_[r]
                    D_ = new
                first = [push(p + D_[twin[i]]) for i, p in enumerate(pos)]
            moved = 0
            for i, (p, q) in enumerate(zip(pos, first)):
                if (q - p).length > 1e-7:
                    pos[i] = q
                    moved += 1
            if moved:
                if kbs:
                    for i, p in enumerate(pos):
                        kbs[sh].data[i].co = p
                if not kbs or sh == kbs[0].name:
                    for i, p in enumerate(pos):
                        me.vertices[i].co = p
            total += moved
        me.update()
        return total


def _adjacency(me):
    """(twin, neighbours): each vertex's representative among coincident vertices (the palette split duplicates
    vertices) and each representative's edge neighbours, as representatives."""
    key, twin = {}, [0] * len(me.vertices)
    for v in me.vertices:
        k = (round(v.co.x, 6), round(v.co.y, 6), round(v.co.z, 6))
        twin[v.index] = key.setdefault(k, v.index)
    nbr = [set() for _ in me.vertices]
    for e in me.edges:
        a, b = twin[e.vertices[0]], twin[e.vertices[1]]
        if a != b:
            nbr[a].add(b)
            nbr[b].add(a)
    return twin, nbr


def _object_tree(ob, shape):
    me = ob.data
    if me.shape_keys and shape in me.shape_keys.key_blocks:
        pos = [d.co.copy() for d in me.shape_keys.key_blocks[shape].data]
    else:
        pos = [v.co.copy() for v in me.vertices]
    return BVHTree.FromPolygons(pos, [tuple(p.vertices) for p in me.polygons])


def shape_weights(ob, allow=None, rigid=None, smooth=0, fallback=None, limit=4, cap=None):
    """Rewrites an object's skin weights: keep only `allow`ed bones, or all to `rigid`, then smooth over the mesh
    (coincident vertices — the palette split — move together so no seam opens), then `cap` {bone: most share} (a
    pauldron that follows the upper arm only halfway), normalised, 4 influences."""
    if not (allow or rigid or smooth or cap):
        return
    me = ob.data
    names = [g.name for g in ob.vertex_groups]
    W = []
    for v in me.vertices:
        W.append({names[g.group]: g.weight for g in v.groups if g.weight > 1e-6})
    if rigid:
        W = [{rigid: 1.0} for _ in W]
    elif allow:
        al = set(allow)
        out = []
        for w in W:
            w2 = {k: x for k, x in w.items() if k in al}
            if not w2:
                w2 = {fallback or allow[0]: 1.0}
            out.append(w2)
        W = out
    if smooth and not rigid:
        n = len(W)
        key = {}
        twin = list(range(n))
        for v in me.vertices:
            k = (round(v.co.x, 6), round(v.co.y, 6), round(v.co.z, 6))
            twin[v.index] = key.setdefault(k, v.index)
        nbr = [set() for _ in range(n)]
        for e in me.edges:
            a, b = twin[e.vertices[0]], twin[e.vertices[1]]
            if a != b:
                nbr[a].add(b)
                nbr[b].add(a)
        reps = sorted(set(twin))
        Wr = {r: dict(W[r]) for r in reps}
        for _ in range(smooth):
            new = {}
            for r in reps:
                acc = {k: x * 0.5 for k, x in Wr[r].items()}
                if nbr[r]:
                    f = 0.5 / len(nbr[r])
                    for q in nbr[r]:
                        for k, x in Wr[q].items():
                            acc[k] = acc.get(k, 0.0) + x * f
                else:
                    acc = {k: x * 2 for k, x in acc.items()}
                new[r] = acc
            Wr = new
        W = [dict(Wr[twin[i]]) for i in range(n)]
    if cap:
        out = []
        for w in W:
            s = sum(w.values()) or 1.0
            w = {k: x / s for k, x in w.items()}
            over = {k: w[k] - c for k, c in cap.items() if w.get(k, 0.0) > c}
            if over:
                rest = sum(x for k, x in w.items() if k not in over)
                if rest > 1e-6:
                    give = sum(over.values())
                    w = {k: (cap[k] if k in over else x + give * x / rest) for k, x in w.items()}
            out.append(w)
        W = out
    for g in list(ob.vertex_groups):
        ob.vertex_groups.remove(g)
    groups = {}
    for i, w in enumerate(W):
        top = sorted(w.items(), key=lambda t: -t[1])[:limit]
        s = sum(x for _, x in top) or 1.0
        for k, x in top:
            if x / s < 1e-4:
                continue
            g = groups.get(k) or ob.vertex_groups.new(name=k)
            groups[k] = g
            g.add([i], x / s, 'REPLACE')


def join(objs, name):
    target = objs[0]
    if len(objs) > 1:
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = target
        with bpy.context.temp_override(active_object=target, object=target, selected_objects=objs,
                                       selected_editable_objects=objs):
            bpy.ops.object.join()
    target.name = name
    target.data.name = name
    return target


def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


# ------------------------------------------------------------------ poses for the fit tests
FIST = {}
for _f in ('Index', 'Middle', 'Ring', 'Little'):
    for _ph, _a in (('Proximal', 72), ('Intermediate', 95), ('Distal', 55)):
        FIST['Left' + _f + _ph] = (_a, 0, 0)
for _ph, _a in (('Proximal', 25), ('Intermediate', 40), ('Distal', 35)):
    FIST['LeftThumb' + _ph] = (_a, 0, 0)


def _mir(d):
    out = dict(d)
    for k, v in d.items():
        if k.startswith('Left'):
            out.setdefault('Right' + k[4:], (v[0], -v[1], -v[2]))
    return out


def test_poses():
    """The poses every set must survive: arms overhead (a two-hand heavy wind-up), a deep lunge, a crouch with the
    knees bent past 90°, a run stride, and a heavy swing's follow-through. Rotations in degrees (rig.py convention)."""
    fist = _mir(FIST)
    poses = {}
    p = _mir({'LeftUpperArm': (160, 0, 8), 'LeftLowerArm': (55, 0, 0), 'LeftHand': (10, 0, 0)})
    p.update({'Spine': (-8, 0, 0), 'Chest': (-8, 0, 0), 'UpperChest': (-4, 0, 0), 'Neck': (-6, 0, 0), 'Head': (-8, 0, 0)})
    p.update({'LeftUpperLeg': (8, 0, -6), 'RightUpperLeg': (-8, 0, 6), 'LeftLowerLeg': (-10, 0, 0)})
    p.update(fist)
    poses['overhead'] = p
    p = {'Hips.loc': (0, -0.24, 0.10), 'Spine': (14, 0, 0), 'Chest': (8, 0, 0), 'Neck': (-12, 0, 0), 'Head': (-8, 0, 0),
         'LeftUpperLeg': (88, 0, -4), 'LeftLowerLeg': (-92, 0, 0), 'LeftFoot': (6, 0, 0),
         'RightUpperLeg': (-38, 0, 4), 'RightLowerLeg': (-28, 0, 0), 'RightFoot': (30, 0, 0),
         'LeftUpperArm': (70, 0, 10), 'LeftLowerArm': (35, 0, 0), 'RightUpperArm': (-40, 0, 10), 'RightLowerArm': (30, 0, 0)}
    p.update(fist)
    poses['lunge'] = p
    p = _mir({'LeftUpperLeg': (95, 0, -12), 'LeftLowerLeg': (-125, 0, 0), 'LeftFoot': (38, 0, 0),
              'LeftUpperArm': (45, 0, 15), 'LeftLowerArm': (70, 0, 0)})
    p.update({'Hips.loc': (0, -0.42, 0.02), 'Spine': (24, 0, 0), 'Chest': (12, 0, 0), 'Neck': (-20, 0, 0), 'Head': (-12, 0, 0)})
    p.update(fist)
    poses['crouch'] = p
    p = {'Hips.loc': (0, -0.04, 0), 'Spine': (10, -6, 0), 'Chest': (6, -6, 0),
         'LeftUpperLeg': (55, 0, 0), 'LeftLowerLeg': (-70, 0, 0), 'LeftFoot': (10, 0, 0),
         'RightUpperLeg': (-30, 0, 0), 'RightLowerLeg': (-85, 0, 0), 'RightFoot': (-15, 0, 0),
         'LeftUpperArm': (-35, 0, -5), 'LeftLowerArm': (70, 0, 0), 'RightUpperArm': (50, 0, -5), 'RightLowerArm': (85, 0, 0)}
    p.update(fist)
    poses['run'] = p
    p = {'Hips.loc': (0, -0.10, 0.02), 'Spine': (18, 18, 0), 'Chest': (10, 14, 0), 'Neck': (-10, -12, 0),
         'LeftUpperLeg': (35, 0, -14), 'LeftLowerLeg': (-40, 0, 0), 'RightUpperLeg': (-18, 0, 14), 'RightLowerLeg': (-20, 0, 0),
         'LeftUpperArm': (75, 0, 35), 'LeftLowerArm': (25, 0, 0), 'RightUpperArm': (65, 0, -20), 'RightLowerArm': (30, 0, 0)}
    p.update(fist)
    poses['heavy'] = p
    return poses


def set_pose(rig, pose):
    """Puts a pose on the rig directly (no action, nothing left behind once `rest(rig)` runs)."""
    for pb in rig.pose.bones:
        rot = pose.get(pb.name, (0, 0, 0))
        pb.rotation_mode = 'ZYX' if 'UpperArm' in pb.name else 'XYZ'
        pb.rotation_euler = Euler([math.radians(a) for a in rot], pb.rotation_mode)
        if pb.name == 'Hips':
            pb.location = pose.get('Hips.loc', (0, 0, 0))
    bpy.context.view_layer.update()


def rest(rig):
    for pb in rig.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    rig.scale = (1, 1, 1)
    bpy.context.view_layer.update()


# ------------------------------------------------------------------ the review loop
SPECIES_BONES = {
    'upperLeg': ('LeftUpperLeg', 'RightUpperLeg'), 'lowerLeg': ('LeftLowerLeg', 'RightLowerLeg'),
    'shoulder': ('LeftShoulder', 'RightShoulder'), 'chest': ('Chest',), 'upperChest': ('UpperChest',),
    'upperArm': ('LeftUpperArm', 'RightUpperArm'), 'lowerArm': ('LeftLowerArm', 'RightLowerArm'),
    'hand': ('LeftHand', 'RightHand'), 'head': ('Head',), 'neck': ('Neck',), 'foot': ('LeftFoot', 'RightFoot'),
    'toes': ('LeftToes', 'RightToes'),
}


class Review:
    """Review renders for one class: the sets on both frames, the pieces alone, the test poses, the species."""

    def __init__(self, class_id, palettes, quick=False):
        from render import Stage
        self.class_id = class_id
        self.out = os.path.join(RENDERS, 'hero', 'gear', class_id)
        os.makedirs(self.out, exist_ok=True)
        for col in ('GV_Stage', 'Debug'):
            c = bpy.data.collections.get(col)
            if c:
                for o in list(c.objects):
                    bpy.data.objects.remove(o)
        self.quick = quick
        self.st = Stage(self.out, size=640 if quick else 1024, quick=quick)
        self.mats = {}
        for tier, pal in palettes.items():
            m = toon.palette_material(pal, name='GV_Palette_%s_%s' % (class_id, tier))
            m.use_backface_culling = True
            self.mats[tier] = m
        self.bodies = {}
        for f in FRAMES:
            src = bpy.data.objects['Body_' + f]
            src.hide_render = True
        self.paths = []

    def look(self, ob, tier, outline=0.005):
        me = ob.data
        me.materials.clear()
        me.materials.append(self.mats[tier])
        me.materials.append(toon.outline_material())
        for p in me.polygons:
            p.material_index = 0
        if outline and 'Outline' not in ob.modifiers:
            so = ob.modifiers.new('Outline', 'SOLIDIFY')
            so.thickness = -outline
            so.offset = 1.0
            so.use_flip_normals = True
            so.use_rim = False
            so.material_offset = 1
            so.use_quality_normals = True

    def body(self, frame, hides, tier):
        """A copy of Body_<frame> with the hidden regions' triangles removed (what the client draws)."""
        k = (frame, tuple(sorted(hides)), tier)
        if k in self.bodies:
            return self.bodies[k]
        src = bpy.data.objects['Body_' + frame]
        me = src.data.copy()
        ob = bpy.data.objects.new('ReviewBody_%s_%s_%d' % (frame, tier, len(self.bodies)), me)
        collection('Review').objects.link(ob)
        ob.parent = src.parent
        ob.matrix_parent_inverse = src.matrix_parent_inverse.copy()
        ob.matrix_world = src.matrix_world.copy()
        for g in src.vertex_groups:
            ob.vertex_groups.new(name=g.name)
        mod = ob.modifiers.new('Armature', 'ARMATURE')
        mod.object = src.parent
        if hides:
            want = {RG[r] for r in hides}
            codes = toon.vertex_codes(me)
            bm = bmesh.new()
            bm.from_mesh(me)
            dead = []
            for f in bm.faces:
                rs = [codes[v.index][1] for v in f.verts]
                if max(set(rs), key=rs.count) in want:
                    dead.append(f)
            bmesh.ops.delete(bm, geom=dead, context='FACES_ONLY')
            bm.to_mesh(me)
            bm.free()
        self.look(ob, tier, outline=0.004)
        ob.hide_render = True
        self.bodies[k] = ob
        return ob

    def show(self, objs):
        """Only `objs` (and the stage) render: every other mesh — other gear, the species parts, hair — is hidden."""
        keep = {o.name for o in objs}
        for o in bpy.data.objects:
            if o.type == 'MESH' and not o.name.startswith('GV_'):
                o.hide_render = o.name not in keep

    def dressed(self, frame, tier, pieces):
        hides = sorted({h for p in pieces for h in p.get('hides', [])})
        return [self.body(frame, hides, tier)] + list(pieces)

    def height(self, frame):
        return max(v.co.z for v in bpy.data.objects['Body_' + frame].data.vertices) + 0.03

    def set_views(self, sets):
        """sets: {(tier, frame): [pieces]} → card + 200-px read and an ortho front/side/back sheet per set."""
        for (tier, frame), pieces in sets.items():
            objs = self.dressed(frame, tier, pieces)
            self.show(objs)
            H = self.height(frame)
            self.paths.append(self.st.card(H, name='set_%s_%s.png' % (tier, frame)))
            self.paths.append(self.st.ortho_sheet(H, name='ortho_%s_%s.png' % (tier, frame)))
        # the readability check: every 200-px read in one strip
        from render import grid_sheet
        smalls = [os.path.join(self.out, 'set_%s_%s_200.png' % (t, f)) for (t, f) in sets]
        grid_sheet(smalls, os.path.join(self.out, 'read_200_all.png'), cols=len(smalls))

    def gear_sheet(self, frame, pieces_by_tier, slots):
        """Every piece alone, F above S, each framed on its own bounds."""
        from render import grid_sheet
        cells = []
        size = 420 if self.quick else 512
        self.st.show_platform(False)
        for tier in ('F', 'S'):
            for slot in slots:
                ob = pieces_by_tier[tier].get(slot)
                if ob is None:
                    continue
                self.show([ob])
                lo, hi = _bounds(ob)
                c = (lo + hi) / 2
                ext = max((hi - lo).x, (hi - lo).y, (hi - lo).z)
                dist = ext * 2.2 + 0.25
                d = Vector((-0.62, -0.78, 0.32)).normalized()
                self.st.camera(c + d * dist, c, lens=50)
                cells.append(self.st.shot('_cell_%s_%s_%s.png' % (frame, tier, slot), size=size))
        self.st.show_platform(True)
        path = os.path.join(self.out, 'gear_sheet_%s.png' % frame)
        grid_sheet(cells, path, cols=len(slots))
        for c in cells:
            os.remove(c)
        self.paths.append(path)

    def poses(self, frame, tier, pieces, poses, name=None):
        from render import grid_sheet
        rig = bpy.data.objects['Rig_' + frame]
        objs = self.dressed(frame, tier, pieces)
        self.show(objs)
        H = self.height(frame)
        k = H / 1.8
        cells = []
        size = 480 if self.quick else 640
        views = {'overhead': [(-1.6, -2.4, 1.5), (1.9, 1.6, 1.6)], 'lunge': [(-2.6, -1.6, 1.0), (2.2, -1.2, 1.2)],
                 'crouch': [(-1.9, -2.2, 1.2), (1.8, 1.9, 1.3)], 'run': [(-2.6, -0.9, 1.2)], 'heavy': [(-1.8, -2.3, 1.3)]}
        for pname, pose in poses.items():
            set_pose(rig, pose)
            for vi, loc in enumerate(views.get(pname, [(-1.9, -2.3, 1.3)])):
                self.st.camera(Vector(loc) * k, Vector((0, 0, 0.82 * k)), lens=48)
                cells.append(self.st.shot('_pose_%s_%d.png' % (pname, vi), size=size))
        rest(rig)
        path = os.path.join(self.out, name or 'poses_%s_%s.png' % (tier, frame))
        grid_sheet(cells, path, cols=4)
        for c in cells:
            os.remove(c)
        self.paths.append(path)
        return path

    def closeups(self, frame, tier, pieces, name, shots):
        """Named close-ups: shots = [(camera location, target, lens, pose or None)]."""
        from render import grid_sheet
        rig = bpy.data.objects['Rig_' + frame]
        objs = self.dressed(frame, tier, pieces)
        self.show(objs)
        cells = []
        for i, (loc, tgt, lens, pose) in enumerate(shots):
            if pose:
                set_pose(rig, pose)
            self.st.camera(Vector(loc), Vector(tgt), lens=lens)
            cells.append(self.st.shot('_close_%d.png' % i, size=480 if self.quick else 600))
            if pose:
                rest(rig)
        path = os.path.join(self.out, name)
        grid_sheet(cells, path, cols=min(4, len(cells)))
        for c in cells:
            os.remove(c)
        self.paths.append(path)
        return path

    def species(self, frame, sets, species_ids=('dwarf', 'orc')):
        """One render per species and tier with the species key at 1 on body and gear and its bone scales on the
        rig (when the body carries that key); returns the species shown."""
        from render import grid_sheet
        rig = bpy.data.objects['Rig_' + frame]
        shown, cells = [], []
        for sp in species_ids:
            data = read_json(os.path.join(CONTENT, 'species', sp + '.json'))['body']
            keys = data.get('shapeKeys', [])
            body = bpy.data.objects['Body_' + frame]
            if not body.data.shape_keys or not all(k in body.data.shape_keys.key_blocks for k in keys):
                continue
            for tier in ('F', 'S'):
                pieces = sets[(tier, frame)]
                objs = self.dressed(frame, tier, pieces)
                for o in objs:
                    _set_keys(o, keys, 1.0)
                sc = data.get('boneScales', {})
                apply_bone_scales(rig, sc)
                self.show(objs)
                H = self.height(frame) * sc.get('root', 1.0)
                cells.append(self.st.card(H * 1.05, name='_sp_%s_%s.png' % (sp, tier)))
                for o in objs:
                    _set_keys(o, keys, 0.0)
                rest(rig)
            shown.append(sp)
        if cells:
            path = os.path.join(self.out, 'species_%s.png' % frame)
            grid_sheet(cells, path, cols=4, cell=512)
            for c in cells:
                os.remove(c)
                small = c.replace('.png', '_200.png')
                if os.path.exists(small):
                    os.remove(small)
            self.paths.append(path)
        return shown

    def finish(self):
        """Hides the review objects again so the saved .blend opens clean."""
        for o in list(bpy.data.objects):
            if o.name.startswith('ReviewBody_'):
                me = o.data
                bpy.data.objects.remove(o)
                if me.users == 0:
                    bpy.data.meshes.remove(me)
        for f in FRAMES:
            bpy.data.objects['Body_' + f].hide_render = False
            rest(bpy.data.objects['Rig_' + f])


def apply_bone_scales(rig, scales):
    """The species pass's convention (build_species.py): every body bone's absolute scale is root × its group's
    factor (no compounding down the chain); the eyes and the chain bones inherit their parent's; root on the object."""
    group = {}
    for grp, bones in SPECIES_BONES.items():
        for bn in bones:
            group[bn] = grp
    chain = {'LeftEye', 'RightEye', 'Tail_01', 'Tail_02', 'Tail_03', 'Tail_04', 'Ear_L', 'Ear_R', 'Beard_01',
             'Beard_02', 'Hair_01', 'Hair_02', 'Hair_03'}
    absol = {}

    def ab(name):
        if name in absol:
            return absol[name]
        b = rig.data.bones[name]
        if name in chain:
            v = ab(b.parent.name) if b.parent else 1.0
        elif any(f in name for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Little')):
            v = float(scales.get('fingers', 1.0))
        else:
            g = group.get(name)
            v = float(scales.get(g, 1.0)) if g else 1.0
        absol[name] = v
        return v
    for pb in rig.pose.bones:
        par = rig.data.bones[pb.name].parent
        local = ab(pb.name) / (ab(par.name) if par else 1.0)
        pb.scale = (local, local, local)
    r = float(scales.get('root', 1.0))
    rig.scale = (r, r, r)
    bpy.context.view_layer.update()


def _set_keys(ob, keys, value):
    sk = ob.data.shape_keys
    if not sk:
        return
    for k in keys:
        kb = sk.key_blocks.get(k)
        if kb:
            kb.value = value


def _bounds(ob):
    vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return lo, hi


# ------------------------------------------------------------------ the class runner
def open_source():
    path = GL.source_blend()
    bpy.ops.wm.open_mainfile(filepath=path)
    for name in ('GV_Stage', 'Debug', 'Gear', 'Review'):
        c = bpy.data.collections.get(name)
        if c:
            for o in list(c.objects):
                bpy.data.objects.remove(o)
    for f in FRAMES:
        rest(bpy.data.objects['Rig_' + f])
        rig = bpy.data.objects['Rig_' + f]
        if rig.animation_data:
            rig.animation_data_clear()
    log('gear source:', os.path.basename(path))
    return path


def save_and_export(class_id, objects_by_frame):
    for f in FRAMES:
        rest(bpy.data.objects['Rig_' + f])
    for a in list(bpy.data.actions):
        if a.users == 0:
            bpy.data.actions.remove(a)
    save_blend(os.path.join(BUILD, 'gear_%s.blend' % class_id))
    sizes = GL.export_class(class_id, objects_by_frame)
    return sizes

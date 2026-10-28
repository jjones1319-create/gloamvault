"""crypts_geo.py — geometry, colour, AO and review-render helpers for the Crypts kit (Phase 6, `build_kit_crypts.py`).

Pieces are authored as plain vertex / face lists (`Geo`): every face carries a palette slot, a smoothing group and a
weathering hint. `realize()` turns a `Piece` into Blender objects whose `gv` colour attribute holds R = slot / 15,
G = weathering variation (0..1, 0.5 neutral), B = ambient occlusion baked with Cycles (1 open, 0 enclosed) —
tools/blender/README.md → *Phase 6 → Environments*. Hard edges are real splits (so a flat face keeps its own AO and
colour) and every face is shaded smooth, so the glTF carries exactly the normals the toon shader needs.

Coordinates are Blender's: metres, Z up, a piece's front faces −Y (game +z), the origin on the floor at the centre
of its footprint; a shell wall's origin is the centre of its base on the room-side face and its body lies behind
(+Y); a wall-mounted prop's origin is on the wall face and its body comes forward (−Y); a hanging piece's origin is
its suspension point. Game ↔ Blender: (x, y, z)_game = (x, z, −y)_blender.
"""
import math
from contextlib import contextmanager

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

ATTR = 'gv'
noise.seed_set(1729)


# ───────────────────────────────────────────── geometry ──────────────────────────────────────────────

class Geo:
    """Vertices and faces in piece space; faces = (indices, slot, smooth group, hint). sg 0 = flat."""

    def __init__(self):
        self.verts = []
        self.faces = []
        self.stack = [Matrix.Identity(4)]

    # transforms ---------------------------------------------------------------------------------------
    @contextmanager
    def at(self, loc=(0, 0, 0), rz=0.0, ry=0.0, rx=0.0, s=None):
        m = Matrix.Translation(Vector(loc)) @ Matrix.Rotation(math.radians(rz), 4, 'Z') \
            @ Matrix.Rotation(math.radians(ry), 4, 'Y') @ Matrix.Rotation(math.radians(rx), 4, 'X')
        if s is not None:
            sv = (s, s, s) if isinstance(s, (int, float)) else s
            m = m @ Matrix.Diagonal((sv[0], sv[1], sv[2], 1.0))
        self.stack.append(self.stack[-1] @ m)
        try:
            yield self
        finally:
            self.stack.pop()

    def v(self, co):
        self.verts.append(self.stack[-1] @ Vector(co))
        return len(self.verts) - 1

    def face(self, idx, slot, sg=0, hint=0.0):
        out = []
        for i in idx:                      # a cone tip repeats a vertex: drop consecutive repeats
            if not out or out[-1] != i:
                out.append(i)
        while len(out) > 1 and out[0] == out[-1]:
            out.pop()
        if len(out) < 3 or len(set(out)) != len(out):
            return
        self.faces.append((tuple(out), slot, sg, hint))

    def tris(self):
        return sum(len(f[0]) - 2 for f in self.faces)

    # primitives ---------------------------------------------------------------------------------------
    def quad(self, a, b, c, d, slot, sg=0, hint=0.0):
        """Four points, counter-clockwise seen from the side the face looks at."""
        self.face([self.v(a), self.v(b), self.v(c), self.v(d)], slot, sg, hint)

    def tri(self, a, b, c, slot, sg=0, hint=0.0):
        self.face([self.v(a), self.v(b), self.v(c)], slot, sg, hint)

    def poly(self, pts, slot, sg=0, hint=0.0):
        self.face([self.v(p) for p in pts], slot, sg, hint)

    def qf(self, pts, want, slot, sg=0, hint=0.0):
        """A face from points in any winding, turned so its normal points along `want` (piece space, before the
        current transform)."""
        P = [Vector(p) for p in pts]
        n = Vector((0, 0, 0))
        for i in range(len(P)):
            a, b = P[i], P[(i + 1) % len(P)]
            n.x += (a.y - b.y) * (a.z + b.z)
            n.y += (a.z - b.z) * (a.x + b.x)
            n.z += (a.x - b.x) * (a.y + b.y)
        if n.dot(Vector(want)) < 0:
            P.reverse()
        self.face([self.v(p) for p in P], slot, sg, hint)

    def box(self, lo, hi, slot, skip=(), slots=None, sg=0, taper=None, shift=None, hint=None):
        """An axis-aligned box from corner `lo` to `hi`. `skip` drops faces ('+x' '-x' '+y' '-y' '+z' '-z');
        `slots` overrides per face; `taper` (sx, sy) scales the top about its centre and `shift` (dx, dy) moves it
        (chunky slabs, pyramidal caps); `hint` (a number or a per-face dict) adds to the weathering variation."""
        x0, y0, z0 = lo
        x1, y1, z1 = hi
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        tx, ty = taper or (1.0, 1.0)
        dx, dy = shift or (0.0, 0.0)

        def top(x, y):
            return (cx + (x - cx) * tx + dx, cy + (y - cy) * ty + dy, z1)
        P = {
            '000': (x0, y0, z0), '100': (x1, y0, z0), '110': (x1, y1, z0), '010': (x0, y1, z0),
            '001': top(x0, y0), '101': top(x1, y0), '111': top(x1, y1), '011': top(x0, y1),
        }
        idx = {k: self.v(p) for k, p in P.items()}
        F = {
            '-z': ('000', '010', '110', '100'), '+z': ('001', '101', '111', '011'),
            '-y': ('000', '100', '101', '001'), '+y': ('010', '011', '111', '110'),
            '-x': ('000', '001', '011', '010'), '+x': ('100', '110', '111', '101'),
        }
        for name, ks in F.items():
            if name in skip:
                continue
            s = (slots or {}).get(name, slot)
            h = (hint or {}).get(name, 0.0) if isinstance(hint, dict) else (hint or 0.0)
            self.face([idx[k] for k in ks], s, sg, h)

    def prism(self, outline, z0, z1, slot, top=True, bottom=False, sg=0, top_slot=None, side_slots=None,
              top_scale=1.0, hint=0.0, top_hint=0.0):
        """Extrudes a counter-clockwise outline [(x, y)] from z0 to z1; `top_scale` shrinks the top about the
        outline's centroid (a chamfered or pyramidal block)."""
        n = len(outline)
        cx = sum(p[0] for p in outline) / n
        cy = sum(p[1] for p in outline) / n
        b = [self.v((x, y, z0)) for x, y in outline]
        t = [self.v((cx + (x - cx) * top_scale, cy + (y - cy) * top_scale, z1)) for x, y in outline]
        for i in range(n):
            j = (i + 1) % n
            s = side_slots[i] if side_slots else slot
            self.face([b[i], b[j], t[j], t[i]], s, sg, hint)
        if top:
            self.face(t, top_slot if top_slot is not None else slot, 0, top_hint)
        if bottom:
            self.face(list(reversed(b)), slot, 0, hint)

    def lathe(self, profile, sides, slot, sg=1, cap_top=True, cap_bottom=False, phase=0.0, band_slots=None,
              center=(0.0, 0.0), top_slot=None, hint=0.0, band_hints=None):
        """A surface of revolution about the vertical axis through `center`; `profile` [(r, z)] bottom → top.
        A ring with r == 0 is a single point (a cone's tip)."""
        rings = []
        for ring in profile:
            r, z = ring[0], ring[1]
            cx, cy = (ring[2], ring[3]) if len(ring) > 2 else center
            sx = ring[4] if len(ring) > 4 else 1.0
            if r <= 1e-6:
                rings.append([self.v((cx, cy, z))] * sides)
            else:
                rings.append([self.v((cx + r * sx * math.cos(phase + 2 * math.pi * j / sides),
                                      cy + r * math.sin(phase + 2 * math.pi * j / sides), z)) for j in range(sides)])
        for k in range(len(rings) - 1):
            s = band_slots[k] if band_slots else slot
            h = band_hints[k] if band_hints else hint
            a, b = rings[k], rings[k + 1]
            for j in range(sides):
                jn = (j + 1) % sides
                self.face([a[j], a[jn], b[jn], b[j]], s, sg, h)
        if cap_top and profile[-1][0] > 1e-6:
            self.face(rings[-1], top_slot if top_slot is not None else slot, 0, hint)
        if cap_bottom and profile[0][0] > 1e-6:
            self.face(list(reversed(rings[0])), slot, 0, hint)
        return rings

    def tube(self, path, r, sides, slot, sg=1, caps=True, phase=0.0, radii=None, hint=0.0):
        """A tube along a polyline [(x, y, z)] (parallel-transported frames); `radii` per point overrides r."""
        pts = [Vector(p) for p in path]
        n = len(pts)
        tans = []
        for i in range(n):
            if i == 0:
                t = pts[1] - pts[0]
            elif i == n - 1:
                t = pts[-1] - pts[-2]
            else:
                t = (pts[i + 1] - pts[i]).normalized() + (pts[i] - pts[i - 1]).normalized()
            tans.append(t.normalized())
        ref = Vector((0, 0, 1)) if abs(tans[0].z) < 0.9 else Vector((1, 0, 0))
        nrm = (ref - tans[0] * ref.dot(tans[0])).normalized()
        rings = []
        for i in range(n):
            if i > 0:
                nrm = (nrm - tans[i] * nrm.dot(tans[i])).normalized()
            bnm = tans[i].cross(nrm)
            rr = radii[i] if radii else r
            ring = []
            for j in range(sides):
                a = phase + 2 * math.pi * j / sides
                ring.append(self.v(tuple(pts[i] + (nrm * math.cos(a) + bnm * math.sin(a)) * rr)))
            rings.append(ring)
        for k in range(n - 1):
            a, b = rings[k], rings[k + 1]
            for j in range(sides):
                jn = (j + 1) % sides
                self.face([a[j], a[jn], b[jn], b[j]], slot, sg, hint)
        if caps:
            self.face(list(reversed(rings[0])), slot, 0, hint)
            self.face(rings[-1], slot, 0, hint)

    def bar(self, p0, p1, w, h, slot, up=(0, 0, 1), caps=True, sg=0, skip=(), hint=0.0):
        """A rectangular beam from p0 to p1, `w` across (horizontal) and `h` along `up`."""
        p0, p1 = Vector(p0), Vector(p1)
        t = (p1 - p0).normalized()
        u = Vector(up)
        side = t.cross(u)
        if side.length < 1e-6:
            side = t.cross(Vector((1, 0, 0)))
        side.normalize()
        uu = side.cross(t).normalized()
        hw, hh = w / 2, h / 2
        c = {}
        for a, p in (('0', p0), ('1', p1)):
            c[a + 'll'] = self.v(tuple(p - side * hw - uu * hh))
            c[a + 'rl'] = self.v(tuple(p + side * hw - uu * hh))
            c[a + 'ru'] = self.v(tuple(p + side * hw + uu * hh))
            c[a + 'lu'] = self.v(tuple(p - side * hw + uu * hh))
        faces = {
            'top': ('0lu', '0ru', '1ru', '1lu'), 'bottom': ('0ll', '1ll', '1rl', '0rl'),
            'right': ('0rl', '1rl', '1ru', '0ru'), 'left': ('0ll', '0lu', '1lu', '1ll'),
        }
        for k, ks in faces.items():
            if k not in skip:
                self.face([c[x] for x in ks], slot, sg, hint)
        if caps:
            self.face([c['0ll'], c['0rl'], c['0ru'], c['0lu']], slot, 0, hint)
            self.face([c['1ll'], c['1lu'], c['1ru'], c['1rl']], slot, 0, hint)

    def skull(self, w=0.24, slot_bone=13, slot_ink=5, sg=0, sides=True, jaw=True):
        """A chunky skull facing −Y, base at z = 0: a 3 × 2 front grid (dark eye sockets either side of a bone
        bridge, a bone jaw row), a domed crown and optional sides. 14–20 triangles."""
        h = w * 1.05
        d = w * 1.05
        xs = (-w / 2, -w / 6, w / 6, w / 2)
        zs = (0.0, h * 0.42, h * 0.78)
        pull = w * 0.10
        front = []
        for zi, z in enumerate(zs):
            row = []
            for xi, x in enumerate(xs):
                y = -d / 2 + (pull if xi in (0, 3) else 0.0) + (pull * 0.6 if zi == 0 else 0.0)
                if zi == 2:
                    y += pull * 0.4
                row.append(self.v((x * (0.86 if zi == 0 else 1.0), y, z)))
            front.append(row)
        for zi in range(2):
            for xi in range(3):
                eye = zi == 1 and xi in (0, 2)
                s = slot_ink if eye else slot_bone
                a, b = front[zi][xi], front[zi][xi + 1]
                c, e = front[zi + 1][xi + 1], front[zi + 1][xi]
                self.face([a, b, c, e], s, sg, -0.05 if (zi == 0 and xi == 1 and jaw) else 0.0)
        top_back = [self.v((x * 0.9, d / 2, h * 0.55)) for x in xs]
        crown = [self.v((x * 0.75, d * 0.1, h * 1.06)) for x in xs]
        for xi in range(3):
            self.face([front[2][xi], front[2][xi + 1], crown[xi + 1], crown[xi]], slot_bone, sg, 0.08)
            self.face([crown[xi], crown[xi + 1], top_back[xi + 1], top_back[xi]], slot_bone, sg, 0.05)
        if sides:
            for side in (0, 3):
                fl, fm, fh = front[0][side], front[1][side], front[2][side]
                cr, tb = crown[side], top_back[side]
                bb = self.v((xs[side] * 0.8, d * 0.25, 0.0))
                if side == 0:   # seen from −X the outline runs counter-clockwise in this order
                    self.face([bb, fl, fm, fh, cr, tb], slot_bone, sg)
                else:
                    self.face([bb, fl, fm, fh, cr, tb][::-1], slot_bone, sg)


    def skull_flat(self, w=0.28, slot_bone=13, slot_ink=5, sg=0, depth=0.12):
        """A relief skull for walls: the 3 × 2 front grid and one crown quad sloping back (14 triangles)."""
        h = w * 1.05
        xs = (-w / 2, -w / 6, w / 6, w / 2)
        zs = (0.0, h * 0.42, h * 0.80)
        pull = w * 0.10
        front = []
        for zi, z in enumerate(zs):
            row = []
            for xi, x in enumerate(xs):
                y = -depth + (pull if xi in (0, 3) else 0.0) + (pull * 0.5 if zi == 0 else 0.0)
                row.append(self.v((x * (0.84 if zi == 0 else 1.0), y, z)))
            front.append(row)
        for zi in range(2):
            for xi in range(3):
                eye = zi == 1 and xi in (0, 2)
                a, b = front[zi][xi], front[zi][xi + 1]
                c, e = front[zi + 1][xi + 1], front[zi + 1][xi]
                self.face([a, b, c, e], slot_ink if eye else slot_bone, sg, 0.0)
        back_l = self.v((xs[0] * 0.8, -depth * 0.1, h * 1.02))
        back_r = self.v((xs[3] * 0.8, -depth * 0.1, h * 1.02))
        self.face([front[2][0], front[2][3], back_r, back_l], slot_bone, sg, 0.08)


# ───────────────────────────────────────────── pieces ────────────────────────────────────────────────

class Piece:
    """One kit piece as authored: a main Geo, moving parts (name, Geo in piece space, hinge, axis, note), light and fx
    points. `role` is kit_lib's (shell · prop · wall-hung · hanging · decal); `bake` a kit_lib bake spec (None → the
    role's default); `hang` = authored with the wall face at y = 0, moved back by HANG_OFF when realized so the origin
    sits 0.1 m in front of the wall (kit_lib's wall-hung convention); `info` goes into the piece's crypts.json entry."""

    def __init__(self, mesh_id, role='prop', budget=None, grime=True, bake=None, hang=False):
        self.id = mesh_id
        self.role = role
        self.budget = budget
        self.grime = grime
        self.bake = bake
        self.hang = hang
        self.main = Geo()
        self.parts = []
        self.lights = []
        self.fx = []
        self.info = {}
        self.gfun = None

    def part(self, name, hinge, axis='z', note=None):
        g = Geo()
        self.parts.append((name, g, Vector(hinge), axis, note))
        return g

    def light(self, pos, kind='candle', tone='corpse'):
        self.lights.append((Vector(pos), kind, tone))

    def mote(self, pos, kind='motes', tone=None):
        self.fx.append((Vector(pos), kind, tone))

    def tris(self):
        return self.main.tris() + sum(p[1].tris() for p in self.parts)

    def shift(self, d):
        """Moves everything (geometry, hinges, points) by d — the wall-hung offset."""
        d = Vector(d)
        self.main.verts = [v + d for v in self.main.verts]
        parts = []
        for name, g, hinge, axis, note in self.parts:
            g.verts = [v + d for v in g.verts]
            parts.append((name, g, hinge + d, axis, note))
        self.parts = parts
        self.lights = [(p + d, k, t) for p, k, t in self.lights]
        self.fx = [(p + d, k, t) for p, k, t in self.fx]


def variation(p, hint=0.0, grime=True):
    n1 = noise.noise(Vector((p.x * 1.3 + 11.1, p.y * 1.3 - 7.7, p.z * 1.3 + 3.3)))
    n2 = noise.noise(Vector((p.x * 4.3 - 2.2, p.y * 4.3 + 5.5, p.z * 4.3 - 1.1)))
    g = 0.52 + 0.22 * n1 + 0.10 * n2 + hint
    if grime:
        g -= 0.18 * max(0.0, 1.0 - p.z / 0.8)
    return min(1.0, max(0.0, g))


def mesh_from_geo(name, geo, offset=Vector((0, 0, 0)), grime=True, flat_deg=6.0, smooth_deg=68.0, gfun=None):
    """Builds a mesh: edges are split where slots or smoothing groups change, where flat faces meet at an angle,
    and where smooth faces fold beyond `smooth_deg`; `gv` gets R = slot, G = variation, B = 1 (AO comes later)."""
    me = bpy.data.meshes.new(name)
    verts = [tuple(v - offset) for v in geo.verts]
    me.from_pydata(verts, [], [f[0] for f in geo.faces])
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    L_slot = bm.faces.layers.int.new('slot')
    L_sg = bm.faces.layers.int.new('sg')
    L_h = bm.faces.layers.float.new('hint')
    for f, (_, slot, sg, hint) in zip(bm.faces, geo.faces):
        f[L_slot] = slot
        f[L_sg] = sg
        f[L_h] = hint
    bm.normal_update()
    cut = []
    cf, cs = math.cos(math.radians(flat_deg)), math.cos(math.radians(smooth_deg))
    for e in bm.edges:
        lf = e.link_faces
        if len(lf) != 2:
            if len(lf) > 2:
                cut.append(e)
            continue
        a, b = lf
        dot = a.normal.dot(b.normal)
        if a[L_slot] != b[L_slot] or a[L_sg] != b[L_sg]:
            cut.append(e)
        elif a[L_sg] == 0 and dot < cf:
            cut.append(e)
        elif a[L_sg] != 0 and dot < cs:
            cut.append(e)
    if cut:
        bmesh.ops.split_edges(bm, edges=cut)
    vslot, vhint, vcount = {}, {}, {}
    for f in bm.faces:
        for v in f.verts:
            vslot[v.index] = f[L_slot]
            vhint[v.index] = vhint.get(v.index, 0.0) + f[L_h]
            vcount[v.index] = vcount.get(v.index, 0) + 1
    bm.faces.layers.int.remove(L_slot)
    bm.faces.layers.int.remove(L_sg)
    bm.faces.layers.float.remove(L_h)
    bm.to_mesh(me)
    bm.free()
    me.update()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    at = me.color_attributes.new(ATTR, 'FLOAT_COLOR', 'POINT')
    for i, v in enumerate(me.vertices):
        p = v.co + offset
        h = vhint.get(i, 0.0) / max(1, vcount.get(i, 1))
        g = gfun(p, h) if gfun else variation(p, h, grime)
        at.data[i].color = (vslot.get(i, 0) / 15.0, min(1.0, max(0.0, g)), 1.0, 1.0)
    me.color_attributes.active_color = at
    try:
        me.color_attributes.render_color_index = me.color_attributes.find(ATTR)
    except Exception:
        pass
    return me


def tri_count_mesh(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def realize(piece, col):
    """Objects for a piece: the main object (named by meshId) at the origin and its parts parented at their
    hinges (`<meshId>.<part>`, origin at the hinge). Returns (main, parts)."""
    me = mesh_from_geo(piece.id, piece.main, grime=piece.grime, gfun=piece.gfun)
    main = bpy.data.objects.new(piece.id, me)
    col.objects.link(main)
    parts = []
    for name, g, hinge, axis, note in piece.parts:
        pm = mesh_from_geo('%s.%s' % (piece.id, name), g, offset=hinge, grime=piece.grime, gfun=piece.gfun)
        po = bpy.data.objects.new('%s.%s' % (piece.id, name), pm)
        col.objects.link(po)
        po.parent = main
        po.matrix_parent_inverse = Matrix.Identity(4)
        po.location = hinge
        po['kind'] = 'part'
        po['part'] = name
        po['piece'] = piece.id
        po['axis'] = axis
        if note:
            po['note'] = note
        parts.append(po)
    return main, parts


def make_empty(name, pos, parent, col, size=0.08):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'SPHERE'
    e.empty_display_size = size
    col.objects.link(e)
    e.parent = parent
    e.location = pos
    return e


# ───────────────────────────────────────────── AO bake ───────────────────────────────────────────────

def _plane(name, corners, col):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(c) for c in corners], [], [(0, 1, 2, 3)])
    me.update()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    return ob


def bake_ao(piece, objects, scratch_col, samples=32):
    """Cycles AO into `gv`.B for each object of one piece, with temporary occluders for its mount: the floor
    (z = 0) under floor pieces, walls and corners; the wall face behind wall-mounted props; both walls at a corner."""
    sc = bpy.context.scene
    helpers = []
    S = 12.0
    if piece.mount in ('floor', 'shell', 'corner', 'wall'):
        helpers.append(_plane('ao_floor', [(-S, -S, -0.002), (S, -S, -0.002), (S, S, -0.002), (-S, S, -0.002)], scratch_col))
    if piece.mount == 'wall':
        helpers.append(_plane('ao_wall', [(-S, 0.004, -1), (-S, 0.004, S), (S, 0.004, S), (S, 0.004, -1)], scratch_col))
    if piece.mount == 'corner':
        helpers.append(_plane('ao_wall_n', [(-1, 0.004, -1), (-1, 0.004, S), (S, 0.004, S), (S, 0.004, -1)], scratch_col))
        helpers.append(_plane('ao_wall_w', [(-0.004, 1, -1), (-0.004, -S, -1), (-0.004, -S, S), (-0.004, 1, S)], scratch_col))
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.device = 'CPU'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('ao_world')
    sc.world.light_settings.distance = piece.ao_distance
    for ob in objects:
        me = ob.data
        tmp = me.color_attributes.new('ao_tmp', 'FLOAT_COLOR', 'POINT')
        me.color_attributes.active_color = tmp
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', margin=0)
        ao = [d.color[0] for d in tmp.data]
        gv = me.color_attributes[ATTR]
        for i, d in enumerate(gv.data):
            r, g, _, _ = d.color
            d.color = (r, g, max(0.0, min(1.0, ao[i])), 1.0)
        me.color_attributes.remove(me.color_attributes['ao_tmp'])
        me.color_attributes.active_color = me.color_attributes[ATTR]
        try:
            me.color_attributes.render_color_index = me.color_attributes.find(ATTR)
        except Exception:
            pass
    for h in helpers:
        m = h.data
        bpy.data.objects.remove(h, do_unlink=True)
        bpy.data.meshes.remove(m)


# ───────────────────────────────────────────── review look ───────────────────────────────────────────

def srgb_to_lin(h):
    h = h.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


RAMP = (0.42, 0.68, 0.90, 1.06)
RAMP_AT = (0.0, 0.22, 0.50, 0.82)


def env_material(palette, emissive=(11, 14), name='GV_Env', alpha=None, var_range=(0.8, 1.2), ao_range=(0.4, 1.0),
                 cull=True, light_tint=0.55):
    """The review material: `gv`.R → the zone colour, × (0.8 + 0.4 G) weathering, × (0.4 + 0.6 B) AO, through the
    light-driven 4-step toon ramp (tinted by the light's hue); emissive slots shine at 1.6× regardless of light;
    `alpha` makes it translucent."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    L = nt.links.new
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    attr = nt.nodes.new('ShaderNodeAttribute'); attr.attribute_name = ATTR
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    L(attr.outputs['Color'], sep.inputs[0])

    def ramp_of(values):
        r = nt.nodes.new('ShaderNodeValToRGB')
        r.color_ramp.interpolation = 'CONSTANT'
        els = r.color_ramp.elements
        while len(els) > 1:
            els.remove(els[-1])
        els[0].position = 0.0
        els[0].color = values[0]
        for i in range(1, 16):
            e = els.new(max(0.0, i / 15.0 - 0.02))
            e.color = values[i]
        L(sep.outputs[0], r.inputs[0])
        return r
    base = ramp_of([srgb_to_lin(h) for h in palette])
    glow = ramp_of([(1, 1, 1, 1) if i in emissive else (0, 0, 0, 1) for i in range(16)])

    def maprange(src, lo, hi):
        mr = nt.nodes.new('ShaderNodeMapRange')
        mr.inputs['From Min'].default_value = 0.0
        mr.inputs['From Max'].default_value = 1.0
        mr.inputs['To Min'].default_value = lo
        mr.inputs['To Max'].default_value = hi
        L(src, mr.inputs['Value'])
        return mr.outputs['Result']

    def mul(a, b_value=None, b_socket=None):
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'
        mx.inputs['Factor'].default_value = 1.0
        L(a, mx.inputs[6])
        if b_socket is not None:
            L(b_socket, mx.inputs[7])
        else:
            mx.inputs[7].default_value = b_value
        return mx.outputs[2]
    var = maprange(sep.outputs[1], *var_range)
    ao = maprange(sep.outputs[2], *ao_range)
    c1 = mul(base.outputs['Color'], b_socket=var)
    c2 = mul(c1, b_socket=ao)
    diff = nt.nodes.new('ShaderNodeBsdfDiffuse'); diff.inputs['Color'].default_value = (1, 1, 1, 1)
    s2r = nt.nodes.new('ShaderNodeShaderToRGB')
    bw = nt.nodes.new('ShaderNodeRGBToBW')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    els = ramp.color_ramp.elements
    els[0].position = RAMP_AT[0]; els[0].color = (RAMP[0],) * 3 + (1,)
    els[1].position = RAMP_AT[1]; els[1].color = (RAMP[1],) * 3 + (1,)
    for at, val in zip(RAMP_AT[2:], RAMP[2:]):
        e = els.new(at); e.color = (val,) * 3 + (1,)
    L(diff.outputs[0], s2r.inputs[0]); L(s2r.outputs[0], bw.inputs[0]); L(bw.outputs[0], ramp.inputs[0])
    # the light's hue tints the stepped value (green candles, a warm torch): ramp × mix(1, hue, light_tint)
    norm = nt.nodes.new('ShaderNodeVectorMath'); norm.operation = 'NORMALIZE'
    L(s2r.outputs[0], norm.inputs[0])
    tint = nt.nodes.new('ShaderNodeVectorMath'); tint.operation = 'SCALE'
    L(norm.outputs[0], tint.inputs[0]); tint.inputs['Scale'].default_value = 1.732
    hue = nt.nodes.new('ShaderNodeMix'); hue.data_type = 'RGBA'; hue.blend_type = 'MIX'
    hue.inputs['Factor'].default_value = light_tint
    hue.inputs[6].default_value = (1, 1, 1, 1)
    L(tint.outputs[0], hue.inputs[7])
    stepped = mul(ramp.outputs['Color'], b_socket=hue.outputs[2])
    lit = mul(c2, b_socket=stepped)
    bright = mul(base.outputs['Color'], b_value=(1.6, 1.6, 1.6, 1))
    lift = nt.nodes.new('ShaderNodeMix'); lift.data_type = 'RGBA'; lift.blend_type = 'MIX'
    L(glow.outputs['Color'], lift.inputs['Factor'])
    L(lit, lift.inputs[6])
    L(bright, lift.inputs[7])
    em = nt.nodes.new('ShaderNodeEmission')
    L(lift.outputs[2], em.inputs['Color'])
    if alpha is not None:
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        mix = nt.nodes.new('ShaderNodeMixShader')
        mix.inputs['Fac'].default_value = alpha
        L(tr.outputs[0], mix.inputs[1])
        L(em.outputs[0], mix.inputs[2])
        L(mix.outputs[0], out.inputs[0])
        try:
            m.surface_render_method = 'BLENDED'
        except Exception:
            pass
    else:
        L(em.outputs[0], out.inputs[0])
    m.use_backface_culling = cull
    try:
        m.use_backface_culling_shadow = True
    except Exception:
        pass
    return m


def flat_material(name, rgb, strength=1.0, alpha=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*rgb, 1)
    em.inputs['Strength'].default_value = strength
    if alpha is not None:
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        mix = nt.nodes.new('ShaderNodeMixShader')
        mix.inputs['Fac'].default_value = alpha
        nt.links.new(tr.outputs[0], mix.inputs[1])
        nt.links.new(em.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs[0])
        try:
            m.surface_render_method = 'BLENDED'
        except Exception:
            pass
    else:
        nt.links.new(em.outputs[0], out.inputs[0])
    return m


def outline_material(name='GV_EnvOutline'):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = flat_material(name, (0.008, 0.009, 0.011))
    m.use_backface_culling = True
    try:
        m.use_backface_culling_shadow = True
    except Exception:
        pass
    return m


def add_outline(ob, thickness=0.012):
    me = ob.data
    if len(me.materials) < 2:
        me.materials.append(outline_material())
    if 'Outline' not in ob.modifiers:
        so = ob.modifiers.new('Outline', 'SOLIDIFY')
        so.thickness = thickness
        so.offset = 1.0
        so.use_flip_normals = True
        so.use_rim = False
        so.material_offset = 1
        so.use_even_offset = False


def world_hemisphere(sky=(0.16, 0.20, 0.19), ground=(0.05, 0.055, 0.055), bg=(0.035, 0.045, 0.045), strength=1.0):
    """A hemisphere ambient (sky above, ground below) for diffuse rays and a flat fog colour for camera rays."""
    sc = bpy.context.scene
    w = bpy.data.worlds.get('GV_EnvWorld') or bpy.data.worlds.new('GV_EnvWorld')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sepx = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sepx.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = -1.0
    mr.inputs['From Max'].default_value = 1.0
    nt.links.new(sepx.outputs['Z'], mr.inputs['Value'])
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
    mx.inputs[6].default_value = (*ground, 1)
    mx.inputs[7].default_value = (*sky, 1)
    nt.links.new(mr.outputs['Result'], mx.inputs['Factor'])
    amb = nt.nodes.new('ShaderNodeBackground')
    nt.links.new(mx.outputs[2], amb.inputs['Color'])
    amb.inputs['Strength'].default_value = strength
    cam_bg = nt.nodes.new('ShaderNodeBackground')
    cam_bg.inputs['Color'].default_value = (*bg, 1)
    lp = nt.nodes.new('ShaderNodeLightPath')
    ms = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Camera Ray'], ms.inputs['Fac'])
    nt.links.new(amb.outputs[0], ms.inputs[1])
    nt.links.new(cam_bg.outputs[0], ms.inputs[2])
    nt.links.new(ms.outputs[0], out.inputs[0])
    return w


def eevee(quick, size):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    try:
        sc.eevee.taa_render_samples = 12 if quick else 48
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'


def game_to_blender(p):
    return Vector((p[0], -p[2], p[1]))


def text_object(name, body, col, size=0.1, rgb=(0.92, 0.92, 0.88)):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = 'LEFT'
    ob = bpy.data.objects.new(name, cu)
    col.objects.link(ob)
    mat = flat_material('GV_Label_%d%d%d' % tuple(int(c * 9) for c in rgb), rgb)
    cu.materials.append(mat)
    return ob

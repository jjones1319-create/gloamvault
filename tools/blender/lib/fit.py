"""fit.py — carrying positions from one surface shape to another (frames, species keys, gear fitting).

A `SurfaceMap` binds points to a source mesh at its rest shape: each point remembers the triangle nearest to it. Given
the same mesh in another shape (same topology), `evaluate()` moves every point with its triangle — the barycentric
transform keeps the point's place on the triangle and its height above it, scaled with the triangle. This is what a
Surface Deform modifier does, done in Python so it is deterministic and works on shape keys headless.
"""
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform


def triangulate(faces):
    """Quads and n-gons → fan triangles, in face order (the same split for every shape of one topology)."""
    tris = []
    for f in faces:
        for k in range(1, len(f) - 1):
            tris.append((f[0], f[k], f[k + 1]))
    return tris


class SurfaceMap:
    def __init__(self, rest_verts, faces):
        self.rest = [Vector(v) for v in rest_verts]
        self.tris = triangulate([tuple(f) for f in faces])
        self.tree = BVHTree.FromPolygons(self.rest, self.tris)

    def bind(self, points):
        """→ [(triangle index, point)] for each point (the point in rest space)."""
        out = []
        for p in points:
            p = Vector(p)
            hit = self.tree.find_nearest(p)
            if hit[2] is None:
                raise RuntimeError('no surface near %s' % (tuple(p),))
            out.append((hit[2], p))
        return out

    def evaluate(self, bindings, shape_verts):
        """Points moved from the rest shape to `shape_verts` (same topology as the rest)."""
        sv = [Vector(v) for v in shape_verts]
        res = []
        for ti, p in bindings:
            a, b, c = self.tris[ti]
            res.append(barycentric_transform(p, self.rest[a], self.rest[b], self.rest[c], sv[a], sv[b], sv[c]))
        return res


def mesh_verts_faces(me, shape=None):
    """(vertex positions, face index lists) of a mesh, optionally from a shape key block."""
    verts = [d.co.copy() for d in shape.data] if shape is not None else [v.co.copy() for v in me.vertices]
    faces = [tuple(p.vertices) for p in me.polygons]
    return verts, faces

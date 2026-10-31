using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gloamvault.Env
{
    /// <summary>
    /// How game space (the manifests, the templates: +x east, +z south, a piece's front +z, yaw as three.js rotation.y)
    /// maps onto Unity's left-handed space after the FBX import — settled from the data, not assumed: the first piece
    /// whose bounds are lopsided along x (and z) says whether the importer mirrored that axis. A mirrored axis also
    /// turns a yaw the other way; two mirrored axes are a half turn.
    /// </summary>
    public sealed class Axes
    {
        public float sx = 1f, sz = 1f;
        public string decidedBy = "assumed";

        public Vector3 Position(float x, float y, float z) => new Vector3(sx * x, y, sz * z);
        public Vector3 Position(float[] p) => Position(p[0], p[1], p[2]);

        /// <summary>A game-space yaw (radians, three.js rotation.y) as Unity's rotation about +y.</summary>
        public Quaternion Rotation(float yaw)
        {
            float u = sx * sz * yaw + (sx < 0 && sz < 0 ? Mathf.PI : 0f);
            return Quaternion.Euler(0f, u * Mathf.Rad2Deg, 0f);
        }

        /// <summary>A direction (no mirror of the vector's handedness issues: components only).</summary>
        public Vector3 Direction(float x, float y, float z) => new Vector3(sx * x, y, sz * z);
    }

    /// <summary>
    /// A zone's kit in Unity (Phase 11): the FBX the Blender build wrote (Resources/Env/kit_&lt;zone&gt;.fbx — one object
    /// per piece named by its meshId, parts as children) and its manifest. Loaded once per zone; pieces are looked up
    /// by name and cloned by the builder.
    /// </summary>
    public sealed class KitLibrary
    {
        public readonly string zone;
        public readonly KitManifest manifest;
        public readonly GameObject prefab;
        public readonly Axes axes;
        readonly Dictionary<string, Transform> byName = new();
        static readonly Dictionary<string, KitLibrary> cache = new();
        static KitLibrary shared;

        /// <summary>The importer's mapping is the same for every kit: decided once, by whichever kit first has a lopsided piece on each axis.</summary>
        public static readonly Axes Global = new();
        static bool xDecided, zDecided;

        public static KitLibrary Shared => shared ??= Load("shared");

        public static KitLibrary Load(string zone)
        {
            if (cache.TryGetValue(zone, out var k)) return k;
            k = new KitLibrary(zone);
            cache[zone] = k;
            return k;
        }

        KitLibrary(string zone)
        {
            this.zone = zone;
            manifest = KitManifest.Load(zone);
            prefab = Resources.Load<GameObject>("Env/kit_" + zone);
            if (prefab == null) throw new InvalidOperationException($"missing Resources/Env/kit_{zone}.fbx — run the Blender kit build (tools/blender/env/build_kit_*.py)");
            foreach (Transform t in prefab.transform) byName[t.name] = t;
            axes = DecideAxes();
        }

        public bool Has(string meshId) => byName.ContainsKey(meshId);
        public Transform Source(string meshId) => byName.TryGetValue(meshId, out var t) ? t : null;
        public IEnumerable<string> Names => byName.Keys;

        /// <summary>Compares each imported mesh's bounds with the manifest's (game space) to find the mirrored axes; the answer is <see cref="Global"/>.</summary>
        Axes DecideAxes()
        {
            var a = Global;
            foreach (var p in manifest.pieces)
            {
                if (xDecided && zDecided) break;
                var src = Source(p.id);
                var mf = src != null ? src.GetComponent<MeshFilter>() : null;
                if (mf == null || mf.sharedMesh == null || p.bounds?.min == null) continue;
                var b = mf.sharedMesh.bounds;
                if (!xDecided && Lopsided(p.bounds.min[0], p.bounds.max[0]))
                {
                    if (Near(b.min.x, p.bounds.min[0]) && Near(b.max.x, p.bounds.max[0])) { a.sx = 1f; xDecided = true; }
                    else if (Near(b.min.x, -p.bounds.max[0]) && Near(b.max.x, -p.bounds.min[0])) { a.sx = -1f; xDecided = true; }
                    if (xDecided) a.decidedBy = (a.decidedBy == "assumed" ? "" : a.decidedBy + " ") + "x:" + p.id;
                }
                if (!zDecided && Lopsided(p.bounds.min[2], p.bounds.max[2]))
                {
                    if (Near(b.min.z, p.bounds.min[2]) && Near(b.max.z, p.bounds.max[2])) { a.sz = 1f; zDecided = true; }
                    else if (Near(b.min.z, -p.bounds.max[2]) && Near(b.max.z, -p.bounds.min[2])) { a.sz = -1f; zDecided = true; }
                    if (zDecided) a.decidedBy = (a.decidedBy == "assumed" ? "" : a.decidedBy + " ") + "z:" + p.id;
                }
            }
            return a;
        }

        public static bool AxesDecided => xDecided && zDecided;

        static bool Lopsided(float min, float max) => Mathf.Abs(Mathf.Abs(min) - Mathf.Abs(max)) > 0.08f;
        static bool Near(float a, float b) => Mathf.Abs(a - b) < 0.03f;
    }
}

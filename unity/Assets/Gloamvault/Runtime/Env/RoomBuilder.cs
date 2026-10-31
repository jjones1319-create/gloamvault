using System.Collections.Generic;
using UnityEngine;

namespace Gloamvault.Env
{
    /// <summary>A built room: its root, the flames the lighting places lights at, and its counts for the budgets.</summary>
    public sealed class Room
    {
        public GameObject root;
        public Template template;
        public KitLibrary kit;
        public readonly List<Flame3> flames = new();
        public readonly List<string> missing = new();
        public int triangles;
        public int pieces;
        public Bounds bounds;

        public void Destroy()
        {
            if (root != null) Object.Destroy(root);
            root = null;
        }
    }

    /// <summary>A flame in Unity space, with its colour and kind (torch, fire, brazier, lamp, candle).</summary>
    public struct Flame3
    {
        public Vector3 position;
        public Color color;
        public string kind;
        /// <summary>The outward direction from the wall it hangs on (zero for a free-standing fire): the light sits a little off the wall.</summary>
        public Vector3 off;
    }

    /// <summary>
    /// Builds a room from its template (Phase 11): the layout's placements become clones of the kit's pieces under one
    /// root, with the zone's shared materials — solid, translucent or water by the manifest — and the shell combined
    /// into static batches. Game space becomes Unity space through the kit's <see cref="Axes"/>.
    /// </summary>
    public static class RoomBuilder
    {
        public static Room Build(Template t, int variation = 0, Transform parent = null)
        {
            var kit = KitLibrary.Load(t.kit);
            var shared = KitLibrary.Shared;
            var cam = t.camera;
            float dx = cam.position[0] - cam.lookAt[0], dz = cam.position[2] - cam.lookAt[2];
            float len = Mathf.Sqrt(dx * dx + dz * dz);
            float camX = len < 1e-6f ? 0 : dx / len, camZ = len < 1e-6f ? 1 : dz / len;

            var room = new Room { template = t, kit = kit, root = new GameObject("Room " + t.id) };
            if (parent != null) room.root.transform.SetParent(parent, false);
            var shellRoot = new GameObject("Shell");
            shellRoot.transform.SetParent(room.root.transform, false);
            var propsRoot = new GameObject("Props");
            propsRoot.transform.SetParent(room.root.transform, false);

            var placements = RoomLayout.Build(t, kit.manifest, shared.manifest, camX, camZ, variation);
            bool any = false;
            var bounds = new Bounds();
            foreach (var p in placements)
            {
                if (string.IsNullOrEmpty(p.meshId)) continue;
                var lib = kit.Has(p.meshId) ? kit : shared.Has(p.meshId) ? shared : null;
                if (lib == null)
                {
                    if (!room.missing.Contains(p.meshId)) room.missing.Add(p.meshId);
                    continue;
                }
                var piece = lib.manifest.Piece(p.meshId);
                // A wall-hung piece on the side cut away toward the camera is not drawn (nor lit).
                if (p.role == RoomLayout.Role.Prop && p.low) continue;

                var axes = kit.axes;
                var go = Object.Instantiate(lib.Source(p.meshId).gameObject, p.role == RoomLayout.Role.Prop ? propsRoot.transform : shellRoot.transform);
                go.name = p.meshId;
                go.transform.localPosition = axes.Position(p.x, p.y, p.z);
                go.transform.localRotation = axes.Rotation(p.yaw);
                go.transform.localScale = new Vector3(p.sx, p.sy, 1f);
                Dress(go, lib.manifest, piece, room);
                room.pieces++;

                // Its flames, in Unity space, for the lighting.
                if (piece?.lights != null)
                {
                    bool wallHung = piece.mount == "wall" || piece.mount == "shell" || piece.role == "wall-hung";
                    foreach (var f in piece.lights)
                    {
                        var local = axes.Position(f.at);
                        var world = go.transform.TransformPoint(local);
                        ColorUtility.TryParseHtmlString(f.color, out var c);
                        room.flames.Add(new Flame3 { position = world, color = c, kind = f.kind, off = wallHung ? go.transform.forward : Vector3.zero });
                    }
                }
                foreach (var r in go.GetComponentsInChildren<Renderer>())
                {
                    if (!any) { bounds = r.bounds; any = true; } else bounds.Encapsulate(r.bounds);
                }
            }
            room.bounds = bounds;
            StaticBatchingUtility.Combine(shellRoot);
            return room;
        }

        /// <summary>Materials by the manifest: water pieces draw twice (solid faces, then their slot-15 water); mist and webs see-through.</summary>
        static void Dress(GameObject go, KitManifest kit, Piece piece, Room room)
        {
            // The manifest's count (the meshes stay GPU-only on the phone: no Read/Write, no CPU copy).
            room.triangles += piece?.tris ?? 0;
            foreach (var mf in go.GetComponentsInChildren<MeshFilter>())
            {
                var mr = mf.GetComponent<MeshRenderer>();
                if (mr == null || mf.sharedMesh == null) continue;
                mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
                mr.receiveShadows = true;
                if (piece != null && piece.water)
                    mr.sharedMaterials = new[] { EnvMaterials.For(kit, EnvMaterials.Variant.Solid), EnvMaterials.For(kit, EnvMaterials.Variant.Water) };
                else if (piece != null && piece.translucent < 1f)
                {
                    mr.sharedMaterial = EnvMaterials.For(kit, EnvMaterials.Variant.Translucent, piece.translucent);
                    mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                }
                else
                    mr.sharedMaterial = EnvMaterials.For(kit, EnvMaterials.Variant.Solid);
                foreach (var c in mf.GetComponents<Collider>()) Object.Destroy(c);
            }
        }
    }
}

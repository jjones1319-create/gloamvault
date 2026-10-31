using System.Collections.Generic;
using UnityEngine;

namespace Gloamvault.Env
{
    /// <summary>A built room: its root, the flames the lighting places lights at, its doors, its placements and its counts.</summary>
    public sealed class Room
    {
        public GameObject root;
        public Template template;
        public KitLibrary kit;
        public readonly List<Flame3> flames = new();
        public readonly List<string> missing = new();
        public readonly List<RoomLayout.Placement> placements = new();
        public readonly List<Door> doors = new();
        public int triangles;
        public int pieces;
        public Bounds bounds;
        /// <summary>The room's floor rectangle in Unity space (x and z), for walkers and cameras.</summary>
        public Bounds floor;

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
    /// root, with the zone's shared materials — solid, translucent or water by the manifest — the shell combined into
    /// static batches. Game space becomes Unity space through the kit's <see cref="Axes"/>. Since Phase 13 the room
    /// can be walked: every clone carries a <see cref="RoomPiece"/>, doorways and other pieces with moving parts live
    /// under a Doors root outside the batch with a <see cref="Door"/> each, and walls, jambs, lintels and furniture get
    /// colliders from the manifest's bounds.
    /// </summary>
    public static class RoomBuilder
    {
        /// <summary>The layer the room's colliders live on (the walker and the camera cast against it).</summary>
        public const int RoomLayer = 0;

        /// <param name="cutAway">Cut the side facing the template's camera low (the diorama viewer); false for a room walked with the follow camera.</param>
        public static Room Build(Template t, int variation = 0, Transform parent = null, IDictionary<string, string> doorKinds = null, bool colliders = true, bool cutAway = true)
        {
            var kit = KitLibrary.Load(t.kit);
            var shared = KitLibrary.Shared;
            var cam = t.camera;
            float dx = cam.position[0] - cam.lookAt[0], dz = cam.position[2] - cam.lookAt[2];
            float len = Mathf.Sqrt(dx * dx + dz * dz);
            float camX = len < 1e-6f ? 0 : dx / len, camZ = len < 1e-6f ? 1 : dz / len;
            if (!cutAway) { camX = 0f; camZ = 0f; }

            var room = new Room { template = t, kit = kit, root = new GameObject("Room " + t.id) };
            if (parent != null) room.root.transform.SetParent(parent, false);
            var shellRoot = new GameObject("Shell");
            shellRoot.transform.SetParent(room.root.transform, false);
            var propsRoot = new GameObject("Props");
            propsRoot.transform.SetParent(room.root.transform, false);
            var doorsRoot = new GameObject("Doors");
            doorsRoot.transform.SetParent(room.root.transform, false);

            var placements = RoomLayout.Build(t, kit.manifest, shared.manifest, camX, camZ, variation, doorKinds);
            room.placements.AddRange(placements);
            bool any = false;
            var bounds = new Bounds();
            var axes = kit.axes;
            for (int index = 0; index < placements.Count; index++)
            {
                var p = placements[index];
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

                bool moving = piece?.parts != null && piece.parts.Length > 0;
                var under = p.role == RoomLayout.Role.Doorway || moving ? doorsRoot.transform : p.role == RoomLayout.Role.Prop ? propsRoot.transform : shellRoot.transform;
                var go = Object.Instantiate(lib.Source(p.meshId).gameObject, under);
                go.name = p.meshId;
                go.transform.localPosition = axes.Position(p.x, p.y, p.z);
                go.transform.localRotation = axes.Rotation(p.yaw);
                go.transform.localScale = new Vector3(p.sx, p.sy, 1f);
                var tag = go.AddComponent<RoomPiece>();
                tag.meshId = p.meshId; tag.role = p.role; tag.side = p.side; tag.low = p.low; tag.placementIndex = index;
                Dress(go, lib.manifest, piece, room);
                if (colliders) AddColliders(go, piece, p, lib.manifest, axes);
                if (moving && p.role == RoomLayout.Role.Doorway)
                {
                    var door = go.AddComponent<Door>();
                    door.Setup(piece, axes);
                    room.doors.Add(door);
                }
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
            // The floor: the footprint as a rectangle, and one flat collider under it.
            float width = t.w * RoomLayout.Cell, depth = t.h * RoomLayout.Cell;
            room.floor = new Bounds(room.root.transform.position, new Vector3(width, 0.01f, depth));
            if (colliders)
            {
                var floor = new GameObject("Floor collider");
                floor.transform.SetParent(room.root.transform, false);
                var bc = floor.AddComponent<BoxCollider>();
                bc.center = new Vector3(0, -0.5f, 0);
                bc.size = new Vector3(width + 8f, 1f, depth + 8f);
            }
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

        /// <summary>
        /// Colliders from the manifest's bounds (game space, the piece's own frame): a wall or corner one box; a
        /// doorway two jambs beside the opening and a lintel above the arch's spring; a prop a box unless it lies flat
        /// on the floor, hangs on a wall, is see-through or water; a moving part its own box, which the door turns off.
        /// </summary>
        static void AddColliders(GameObject go, Piece piece, RoomLayout.Placement p, KitManifest kit, Axes axes)
        {
            if (piece?.bounds?.min == null || piece.bounds.max == null) return;
            if (p.role == RoomLayout.Role.Floor) return;
            var min = piece.bounds.min; var max = piece.bounds.max;
            // The piece's local frame in Unity: x mirrored when the import mirrored it (the box is symmetric in that case).
            Vector3 lo = new(Mathf.Min(axes.sx * min[0], axes.sx * max[0]), min[1], Mathf.Min(axes.sz * min[2], axes.sz * max[2]));
            Vector3 hi = new(Mathf.Max(axes.sx * min[0], axes.sx * max[0]), max[1], Mathf.Max(axes.sz * min[2], axes.sz * max[2]));
            if (hi.y - lo.y < 0.05f) return;

            if (p.role == RoomLayout.Role.Doorway)
            {
                float half = (kit.shell?.opening?.width ?? 2f) / 2f;
                float spring = kit.shell?.opening?.spring ?? 2.1f;
                Box(go, new Vector3(lo.x, lo.y, lo.z), new Vector3(-half, hi.y, hi.z), "jamb L");
                Box(go, new Vector3(half, lo.y, lo.z), new Vector3(hi.x, hi.y, hi.z), "jamb R");
                Box(go, new Vector3(-half, spring, lo.z), new Vector3(half, hi.y, hi.z), "lintel");
                // The leaves: a box each, over the opening, on the part itself so it swings with it.
                foreach (var part in piece.parts ?? new Part[0])
                {
                    var t = FindDeep(go.transform, part.name) ?? FindDeep(go.transform, part.part);
                    if (t == null) continue;
                    var bc = t.gameObject.AddComponent<BoxCollider>();
                    var pr = t.GetComponent<Renderer>();
                    if (pr != null) { var lb = pr.localBounds; bc.center = lb.center; bc.size = lb.size; }
                    else { bc.center = new Vector3(0, (spring) / 2, 0); bc.size = new Vector3(half * 2, spring, 0.12f); }
                }
                return;
            }
            if (p.role == RoomLayout.Role.Prop)
            {
                bool flat = piece.mount == "tile" || piece.mount == "floor" || hi.y < 0.25f;
                bool hung = piece.mount == "wall" || piece.mount == "shell" || piece.role == "wall-hung" || (lo.y > 0.9f && hi.y - lo.y < 1.6f && p.y > 0.5f);
                if (flat || hung || piece.translucent < 1f || piece.water || piece.hasHole) return;
            }
            Box(go, lo, hi, "box");
        }

        static void Box(GameObject go, Vector3 lo, Vector3 hi, string name)
        {
            if (hi.x - lo.x < 0.01f || hi.z - lo.z < 0.01f || hi.y - lo.y < 0.01f) return;
            var bc = go.AddComponent<BoxCollider>();
            bc.center = (lo + hi) / 2f;
            bc.size = hi - lo;
        }

        static Transform FindDeep(Transform root, string name)
        {
            if (root.name == name) return root;
            foreach (Transform c in root) { var f = FindDeep(c, name); if (f != null) return f; }
            return null;
        }
    }
}

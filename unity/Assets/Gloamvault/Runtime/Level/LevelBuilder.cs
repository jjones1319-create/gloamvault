using System.Collections.Generic;
using Gloamvault.Env;
using UnityEngine;

namespace Gloamvault.Level
{
    /// <summary>
    /// Puts a level's rooms into the world (Phase 14): each room is built by <see cref="RoomBuilder"/> under a holder
    /// placed at the room's centre, the walls inset so touching rooms never share a face, the doors' kinds from the
    /// joins, the unmatched doors locked, and the flames' glows made with the room so they go with it.
    /// </summary>
    public static class LevelBuilder
    {
        public const float Inset = 0.4f;

        /// <summary>Loads the kits first: the axes (a mirrored x) are decided by the first lopsided piece, and every position below depends on them.</summary>
        public static void Preload()
        {
            KitLibrary.Load("cellars"); KitLibrary.Load("crypts"); KitLibrary.Load("vault");
            _ = KitLibrary.Shared;
        }

        public static Vector3 ToUnity(float x, float y, float z) => KitLibrary.Global.Position(x, y, z);
        /// <summary>Unity space back to game space (the axes are their own inverse: ±1 per component).</summary>
        public static (float x, float z) ToGame(Vector3 p) => (KitLibrary.Global.sx * p.x, KitLibrary.Global.sz * p.z);
        public static Vector3 RoomCentre(LevelRoom r) => ToUnity(r.CentreX, 0f, r.CentreZ);
        public static Vector3 JoinPoint(LevelJoin j) => ToUnity(j.x, 0f, j.z);

        /// <summary>The room's footprint in Unity space (x and z; 8 m tall for the camera's sake).</summary>
        public static Bounds RoomRect(LevelRoom r)
        {
            float c = RoomLayout.Cell;
            var a = ToUnity(r.gx * c, 0f, r.gy * c);
            var b = ToUnity((r.gx + r.w) * c, 0f, (r.gy + r.h) * c);
            var bb = new Bounds(a, Vector3.zero);
            bb.Encapsulate(b);
            bb.Encapsulate(new Vector3(a.x, 8f, a.z));
            return bb;
        }

        public static Room Build(Level level, LevelRoom r, Transform levelRoot, IEnumerable<FloorSpotDef> spots = null)
        {
            var t = level.TemplateOf(r);
            var holder = new GameObject($"Room {r.id} {r.templateId}");
            holder.transform.SetParent(levelRoot, false);
            holder.transform.position = RoomCentre(r);
            // A broken floor to jump: the hole is cut before the tiles are laid.
            var holes = new List<RoomLayout.Rect>();
            var traversals = new List<FloorSpotDef>();
            if (spots != null) foreach (var s in spots) if (s.IsTraversal) { traversals.Add(s); if (s.kind == "jump") holes.Add(JumpHole(r, s)); }
            var room = RoomBuilder.Build(t, r.variation, holder.transform, level.DoorKindsFor(r), colliders: true, cutAway: false, inset: Inset, extraHoles: holes.Count > 0 ? holes : null);
            foreach (var d in room.doors)
            {
                var tag = d.GetComponent<RoomPiece>();
                d.locked = tag != null && !r.joinBySide.ContainsKey(tag.side);
            }
            foreach (var f in room.flames) FlameGlow.Make(room.root.transform, f.position, f.color, f.kind);
            foreach (var s in traversals) BuildObstacle(room, r, s);
            return room;
        }

        /// <summary>The floor hole of a jump spot (room space): across the room's whole width, 0.8 m short of the move's length so the ends stand on stone.</summary>
        public static RoomLayout.Rect JumpHole(LevelRoom r, FloorSpotDef s)
        {
            float half = Mathf.Max(0.6f, (s.length - 0.8f) / 2f);
            float w = r.w * RoomLayout.Cell, h = r.h * RoomLayout.Cell;
            return s.axis == "ew"
                ? new RoomLayout.Rect { x0 = s.x - half, x1 = s.x + half, z0 = -h / 2 - 1f, z1 = h / 2 + 1f }
                : new RoomLayout.Rect { x0 = -w / 2 - 1f, x1 = w / 2 + 1f, z0 = s.z - half, z1 = s.z + half };
        }

        /// <summary>
        /// The obstacle of a traversal spot (Phase 16, D-171), from the kit's pieces, across the room perpendicular to
        /// the axis, with a collider that blocks the walker so the move is the only way past; and the spot's two ends.
        /// </summary>
        public static Traversal BuildObstacle(Room room, LevelRoom r, FloorSpotDef s)
        {
            bool ew = s.axis == "ew";
            // d: the move's direction; n: across the room. Game space, room-local.
            Vector2 d = ew ? new Vector2(1, 0) : new Vector2(0, 1);
            Vector2 n = ew ? new Vector2(0, 1) : new Vector2(1, 0);
            float across = (ew ? r.h : r.w) * RoomLayout.Cell;
            // A piece whose own x should run across the room: yaw 0 when across is x, a quarter turn when across is z.
            float yawAcrossX = ew ? Mathf.PI / 2f : 0f;
            var at = new Vector2(s.x, s.z);
            string kit = room.kit.zone;
            string crate = kit == "cellars" ? "cel_crate_stack" : kit == "crypts" ? "cry_coffin_stack" : "vlt_crate_wet";
            string lowWall = kit == "cellars" ? "cel_wall_low" : kit == "crypts" ? "cry_wall_low" : "vlt_wall_low";
            string beam = kit == "cellars" ? "cel_beam_timber" : kit == "crypts" ? "cry_beam" : "vlt_beam";
            switch (s.kind)
            {
                case "crawl":
                    // A fallen timber at 0.75 m, and a block above it the walker cannot pass.
                    if (room.kit.Has(beam)) RoomBuilder.PlacePiece(room, beam, new Vector3(at.x, 1.22f, at.y), ew ? 0f : Mathf.PI / 2f, colliders: false);
                    else Blocker(room, at, n, across, 0.78f, 1.6f, 0.4f, "beam");
                    Blocker(room, at, n, across, 0.78f, 1.8f, 0.5f, "crawl block");
                    break;
                case "squeeze":
                    // Crate stacks either side of a 0.55 m crack, more to the walls.
                    for (int side = -1; side <= 1; side += 2)
                    {
                        for (int k = 0; k < 2; k++)
                        {
                            var p = at + n * (side * (1.25f + k * 1.94f));
                            if (room.kit.Has(crate)) RoomBuilder.PlacePiece(room, crate, new Vector3(p.x, 0f, p.y), yawAcrossX, colliders: false);
                        }
                    }
                    // The crack is too narrow to walk: one unseen wall across the whole room, and the squeeze is the way through.
                    Blocker(room, at, n, across, 0f, 1.8f, 1.1f, "stack wall");
                    break;
                case "jump":
                    // A dark pit drawn on the floor, and thin walls at both edges that keep the walker out of it.
                    float edge = Mathf.Max(0.6f, (s.length - 0.8f) / 2f);
                    Pit(room, at, n, across, edge * 2f);
                    Blocker(room, at - d * edge, n, across, 0f, 1.6f, 0.08f, "pit edge");
                    Blocker(room, at + d * edge, n, across, 0f, 1.6f, 0.08f, "pit edge");
                    break;
                default:
                    // A low wall in 2 m lengths across the room.
                    for (float o = -across / 2f + 1.03f; o < across / 2f; o += 2.06f)
                    {
                        var p = at + n * o;
                        if (room.kit.Has(lowWall)) RoomBuilder.PlacePiece(room, lowWall, new Vector3(p.x, 0f, p.y), yawAcrossX);
                        else Blocker(room, p, n, 2.06f, 0f, 1.02f, 0.38f, "low wall");
                    }
                    break;
            }
            var centreU = room.root.transform.TransformPoint(room.kit.axes.Position(at.x, 0f, at.y));
            var axisU = room.kit.axes.Direction(d.x, 0f, d.y).normalized;
            var trav = Traversal.Make(room.root.transform, s, centreU, axisU, s.length);
            return trav;
        }

        /// <summary>The layer the unseen blockers sit on: the walker collides with it, the follow camera's cast does not (Ignore Raycast).</summary>
        public const int BlockerLayer = 2;

        /// <summary>An unseen box in the room (game-space centre, across the direction n, from y0 to y1, thick along the axis).</summary>
        static void Blocker(Room room, Vector2 centre, Vector2 n, float length, float y0, float y1, float thick, string name)
        {
            var go = new GameObject("Blocker " + name) { layer = BlockerLayer };
            go.transform.SetParent(room.root.transform, false);
            go.transform.localPosition = room.kit.axes.Position(centre.x, (y0 + y1) / 2f, centre.y);
            var bc = go.AddComponent<BoxCollider>();
            bool alongX = Mathf.Abs(n.x) > 0.5f;
            bc.size = alongX ? new Vector3(length, y1 - y0, thick) : new Vector3(thick, y1 - y0, length);
        }

        static Material pitMaterial;

        /// <summary>A dark pit on the floor: a black quad just above the tiles, across the room, `along` metres on the axis.</summary>
        static void Pit(Room room, Vector2 centre, Vector2 n, float across, float along)
        {
            pitMaterial ??= new Material(Shader.Find("Universal Render Pipeline/Unlit")) { name = "Pit", color = new Color(0.02f, 0.015f, 0.02f) };
            var go = GameObject.CreatePrimitive(PrimitiveType.Quad);
            go.name = "Pit";
            Object.Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(room.root.transform, false);
            go.transform.localPosition = room.kit.axes.Position(centre.x, 0.012f, centre.y);
            bool alongX = Mathf.Abs(n.x) > 0.5f;
            go.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            go.transform.localScale = alongX ? new Vector3(across, along, 1f) : new Vector3(along, across, 1f);
            var mr = go.GetComponent<MeshRenderer>();
            mr.sharedMaterial = pitMaterial;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            mr.receiveShadows = false;
        }

        public static void Release(Room room)
        {
            if (room?.root == null) return;
            var holder = room.root.transform.parent;
            room.Destroy();
            if (holder != null && holder.name.StartsWith("Room ")) Object.Destroy(holder.gameObject);
        }
    }
}

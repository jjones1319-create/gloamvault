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

        public static Room Build(Level level, LevelRoom r, Transform levelRoot)
        {
            var t = level.TemplateOf(r);
            var holder = new GameObject($"Room {r.id} {r.templateId}");
            holder.transform.SetParent(levelRoot, false);
            holder.transform.position = RoomCentre(r);
            var room = RoomBuilder.Build(t, r.variation, holder.transform, level.DoorKindsFor(r), colliders: true, cutAway: false, inset: Inset);
            foreach (var d in room.doors)
            {
                var tag = d.GetComponent<RoomPiece>();
                d.locked = tag != null && !r.joinBySide.ContainsKey(tag.side);
            }
            foreach (var f in room.flames) FlameGlow.Make(room.root.transform, f.position, f.color, f.kind);
            return room;
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

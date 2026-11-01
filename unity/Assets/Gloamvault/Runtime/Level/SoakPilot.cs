using System.Collections.Generic;
using Gloamvault.Walk;
using UnityEngine;

namespace Gloamvault.Level
{
    /// <summary>
    /// Walks the hero on its own (Phase 14): picks a far room over the joins, runs room centre → join → room centre,
    /// presses A at a closed door, re-plans when it arrives or gets stuck, and keeps the overlay's samples for the
    /// soak-done line after the given minutes (0 = walk forever). Gives the stick vector the mover wants.
    /// </summary>
    public sealed class SoakPilot
    {
        public const float WaypointReach = 0.7f, StuckSeconds = 2f, StuckDistance = 0.3f, WarmUpSeconds = 5f;

        public readonly HashSet<int> Visited = new();
        public readonly SoakStats Stats = new();
        public bool Done { get; private set; }
        public float Walked { get; private set; }
        public float Elapsed { get; private set; }
        public int Replans { get; private set; }
        public int TargetRoom { get; private set; } = -1;
        public int Waypoints => path.Count;
        public readonly float minutes;

        readonly Level level;
        readonly LevelStreamer streamer;
        readonly Interactor interactor;
        readonly Transform hero;
        readonly System.Random rng;
        readonly List<Vector3> path = new();
        Vector3 lastPos, stuckPos;
        float stuckTimer, actTimer, lineTimer;
        int lastSample;
        bool started;

        public SoakPilot(Level level, LevelStreamer streamer, Interactor interactor, Transform hero, float minutes, int seed)
        {
            this.level = level; this.streamer = streamer; this.interactor = interactor; this.hero = hero; this.minutes = minutes;
            rng = new System.Random(seed * 7919 + 13);
        }

        /// <summary>One frame: the stick vector to give the mover (camera-relative, as a thumb would).</summary>
        public Vector2 Tick(float dt, float cameraYaw, PerfOverlay overlay)
        {
            var p = hero.position;
            if (!started) { started = true; lastPos = stuckPos = p; }
            Elapsed += dt;
            var moved = p - lastPos; moved.y = 0;
            Walked += moved.magnitude;
            lastPos = p;
            if (overlay != null && overlay.SampleCount != lastSample)
            {
                lastSample = overlay.SampleCount;
                if (Elapsed > WarmUpSeconds) Stats.Add(overlay.Last);
            }
            var room = streamer.HeroRoom;
            if (room != null) Visited.Add(room.id);
            lineTimer += dt;
            if (lineTimer >= 30f)
            {
                lineTimer = 0f;
                GvLog.Line("soak", ("t", Mathf.RoundToInt(Elapsed)), ("walked", Mathf.RoundToInt(Walked)), ("visited", Visited.Count), ("target", TargetRoom), ("replans", Replans), ("built", streamer.Built.Count), ("peak", streamer.Peak));
            }
            if (minutes > 0 && Elapsed >= minutes * 60f && !Done) { Finish(); return Vector2.zero; }
            if (Done) return Vector2.zero;

            if (path.Count == 0) Plan(room);
            if (path.Count == 0) return Vector2.zero;
            var to = path[0] - p; to.y = 0;
            if (to.magnitude < WaypointReach) { path.RemoveAt(0); return Vector2.zero; }

            if ((p - stuckPos).magnitude < StuckDistance)
            {
                stuckTimer += dt;
                if (stuckTimer > StuckSeconds) { stuckTimer = 0f; stuckPos = p; path.Clear(); Replans++; return Vector2.zero; }
            }
            else { stuckTimer = 0f; stuckPos = p; }

            actTimer -= dt;
            if (actTimer <= 0f && interactor.Nearest is Env.Door near && !near.locked && !near.hidden && !near.IsOpen) { interactor.Act(); actTimer = 0.6f; }

            var dir = to.normalized;
            var local = Quaternion.Euler(0, -cameraYaw, 0) * dir;
            return new Vector2(local.x, local.z);
        }

        /// <summary>A far room by breadth-first search over the joins, unvisited rooms first; the path's waypoints are the joins' midpoints and the rooms' centres.</summary>
        public void Plan(LevelRoom from)
        {
            path.Clear();
            if (from == null)
            {
                // Between rooms: head for the nearest room's centre.
                float best = float.MaxValue; LevelRoom nearest = null;
                foreach (var r in level.rooms) { float d = (LevelBuilder.RoomCentre(r) - hero.position).sqrMagnitude; if (d < best) { best = d; nearest = r; } }
                if (nearest != null) path.Add(LevelBuilder.RoomCentre(nearest));
                return;
            }
            var dist = new Dictionary<int, int> { [from.id] = 0 };
            var parent = new Dictionary<int, (int room, int join)>();
            var queue = new Queue<LevelRoom>();
            queue.Enqueue(from);
            while (queue.Count > 0)
            {
                var r = queue.Dequeue();
                foreach (var (j, other) in level.Neighbours(r))
                {
                    if (dist.ContainsKey(other.id)) continue;
                    dist[other.id] = dist[r.id] + 1;
                    parent[other.id] = (r.id, level.joins.IndexOf(j));
                    queue.Enqueue(other);
                }
            }
            var reached = new List<(int id, int d)>();
            foreach (var kv in dist) if (kv.Key != from.id) reached.Add((kv.Key, kv.Value));
            if (reached.Count == 0) return;
            var unvisited = reached.FindAll(x => !Visited.Contains(x.id));
            var pool = unvisited.Count > 0 ? unvisited : reached;
            pool.Sort((a, b) => b.d.CompareTo(a.d));
            int span = Mathf.Max(1, pool.Count / 3);
            TargetRoom = pool[rng.Next(span)].id;
            var chain = new List<int>();
            for (int id = TargetRoom; id != from.id; id = parent[id].room) chain.Add(id);
            chain.Reverse();
            int prev = from.id;
            foreach (var id in chain)
            {
                var (_, joinIndex) = parent[id];
                path.Add(LevelBuilder.JoinPoint(level.joins[joinIndex]));
                path.Add(LevelBuilder.RoomCentre(level.rooms[id]));
                prev = id;
            }
        }

        void Finish()
        {
            Done = true;
            var fields = new List<(string, object)>(Stats.Fields())
            {
                ("minutes", minutes), ("walked", Mathf.RoundToInt(Walked)), ("visited", Visited.Count), ("rooms", level.rooms.Count),
                ("replans", Replans), ("peakBuilt", streamer.Peak), ("releases", streamer.Releases),
                ("targetFps", Boot.TargetFps), ("hz", Boot.RefreshHz),
            };
            GvLog.Line("soak-done", fields.ToArray());
        }
    }
}

using System;
using System.Collections.Generic;
using Gloamvault.Env;
using UnityEngine;

namespace Gloamvault.Level
{
    /// <summary>
    /// Streams a level around the hero (Phase 14, D-163): rooms within the build ring are built, nearest first and
    /// one a frame; rooms beyond the release ring are destroyed, two a frame; rooms past the active ring stay built
    /// but switched off (the fog hides the edge). The combined shell meshes are orphan assets after a release, so
    /// unused assets are unloaded every ten releases. Counts go to the phone log every ten seconds.
    /// </summary>
    public sealed class LevelStreamer : MonoBehaviour
    {
        public const float ActiveRadius = 32f, BuildRadius = 44f, ReleaseRadius = 60f;
        public const int UnloadEvery = 10;

        public enum Ring { Active, Built, Keep, Release }

        public static Ring Classify(float distance) =>
            distance < ActiveRadius ? Ring.Active : distance < BuildRadius ? Ring.Built : distance < ReleaseRadius ? Ring.Keep : Ring.Release;

        /// <summary>Horizontal distance from a point to a room's rectangle (0 inside it).</summary>
        public static float DistanceTo(Bounds rect, Vector3 p)
        {
            var q = rect.ClosestPoint(new Vector3(p.x, rect.center.y, p.z));
            return Vector2.Distance(new Vector2(q.x, q.z), new Vector2(p.x, p.z));
        }

        public Level Level { get; private set; }
        public Transform Root { get; private set; }
        public Transform Hero { get; set; }
        public int BuildsPerFrame = 1, ReleasesPerFrame = 2;
        public int Peak { get; private set; }
        public int Releases { get; private set; }
        public int BuildsTotal { get; private set; }
        public int ActiveCount { get; private set; }
        public IReadOnlyDictionary<int, Room> Built => built;
        public IReadOnlyList<Door> Doors => doors;
        public event Action BuiltSetChanged;
        /// <summary>The floor's spots for a room (Phase 16: the traversal obstacles are built with the room); null on the test level.</summary>
        public Func<LevelRoom, IEnumerable<FloorSpotDef>> SpotsFor;

        readonly Dictionary<int, Room> built = new();
        readonly List<Door> doors = new();
        Bounds[] rects;
        int releasesSinceUnload;
        float logTimer;

        public static LevelStreamer Attach(GameObject host, Level level, Transform root, Transform hero)
        {
            var s = host.AddComponent<LevelStreamer>();
            s.Level = level; s.Root = root; s.Hero = hero;
            s.rects = new Bounds[level.rooms.Count];
            for (int i = 0; i < level.rooms.Count; i++) s.rects[i] = LevelBuilder.RoomRect(level.rooms[i]);
            return s;
        }

        public Bounds RectOf(int roomId) => rects[roomId];
        public bool IsBuilt(int roomId) => built.ContainsKey(roomId);

        /// <summary>The room the hero stands in, or null between rooms.</summary>
        public LevelRoom HeroRoom
        {
            get
            {
                if (Hero == null) return null;
                var (x, z) = LevelBuilder.ToGame(Hero.position);
                return Level.RoomAtPoint(x, z);
            }
        }

        /// <summary>Builds everything within the build ring at once (the first frame, a teleport).</summary>
        public void Prime()
        {
            int keep = BuildsPerFrame;
            BuildsPerFrame = int.MaxValue;
            Step();
            BuildsPerFrame = keep;
        }

        void LateUpdate()
        {
            Step();
            logTimer += Time.unscaledDeltaTime;
            if (logTimer >= 10f)
            {
                logTimer = 0f;
                GvLog.Line("stream", ("built", built.Count), ("active", ActiveCount), ("peak", Peak), ("releases", Releases), ("builds", BuildsTotal), ("rooms", Level.rooms.Count));
            }
        }

        public void Step()
        {
            if (Hero == null || Level == null) return;
            var p = Hero.position;
            bool changed = false;
            int releases = 0, builds = 0;
            ActiveCount = 0;
            var toBuild = new List<(float d, int i)>();
            for (int i = 0; i < Level.rooms.Count; i++)
            {
                float d = DistanceTo(rects[i], p);
                var ring = Classify(d);
                if (!built.TryGetValue(i, out var room))
                {
                    if (ring <= Ring.Built) toBuild.Add((d, i));
                    continue;
                }
                if (ring == Ring.Release)
                {
                    if (releases < ReleasesPerFrame)
                    {
                        LevelBuilder.Release(room);
                        built.Remove(i);
                        Releases++; releases++; releasesSinceUnload++;
                        changed = true;
                    }
                    continue;
                }
                bool active = ring == Ring.Active;
                if (room.root != null && room.root.activeSelf != active) room.root.SetActive(active);
                if (active) ActiveCount++;
            }
            toBuild.Sort((a, b) => a.d.CompareTo(b.d));
            foreach (var (d, i) in toBuild)
            {
                if (builds >= BuildsPerFrame) break;
                built[i] = LevelBuilder.Build(Level, Level.rooms[i], Root, SpotsFor?.Invoke(Level.rooms[i]));
                BuildsTotal++; builds++;
                changed = true;
                if (Classify(d) == Ring.Active) ActiveCount++;
            }
            if (built.Count > Peak) Peak = built.Count;
            if (releasesSinceUnload >= UnloadEvery) { releasesSinceUnload = 0; Resources.UnloadUnusedAssets(); }
            if (changed)
            {
                doors.Clear();
                foreach (var r in built.Values) doors.AddRange(r.doors);
                BuiltSetChanged?.Invoke();
            }
        }

        public void ReleaseAll()
        {
            foreach (var r in built.Values) LevelBuilder.Release(r);
            built.Clear();
            doors.Clear();
        }
    }
}

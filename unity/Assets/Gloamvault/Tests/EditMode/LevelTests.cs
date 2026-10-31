using System.Collections.Generic;
using System.Linq;
using Gloamvault.Env;
using Gloamvault.Level;
using NUnit.Framework;
using UnityEngine;

namespace Gloamvault.Tests
{
    /// <summary>Phase 14: the test level's generator, the inset walls, the streamer's rings and the soak's maths.</summary>
    public class LevelGeneratorTests
    {
        static Level.Level Default(int seed = 1) => TestLevelGenerator.Generate(seed);

        [Test]
        public void TheSameSeedGivesTheSameLevel()
        {
            var a = Default(7); var b = Default(7);
            Assert.AreEqual(a.Hash(), b.Hash());
            Assert.AreEqual(a.rooms.Count, b.rooms.Count);
            Assert.AreNotEqual(a.Hash(), Default(8).Hash(), "another seed, another level");
        }

        [Test]
        public void NoTwoFootprintsOverlapAndAllFitTheGrid()
        {
            var l = Default();
            for (int i = 0; i < l.rooms.Count; i++)
            {
                var r = l.rooms[i];
                Assert.IsTrue(r.gx >= 0 && r.gy >= 0 && r.gx + r.w <= l.gridW && r.gy + r.h <= l.gridH, $"room {r.id} inside the grid");
                for (int j = i + 1; j < l.rooms.Count; j++)
                {
                    var o = l.rooms[j];
                    Assert.IsFalse(r.Overlaps(o.gx, o.gy, o.w, o.h), $"rooms {r.id} and {o.id} overlap");
                }
            }
        }

        [Test]
        public void EveryRoomIsReachedFromTheEntry()
        {
            var l = Default();
            var seen = new HashSet<int> { l.entryId };
            var queue = new Queue<LevelRoom>(); queue.Enqueue(l.rooms[l.entryId]);
            while (queue.Count > 0)
                foreach (var (_, other) in l.Neighbours(queue.Dequeue()))
                    if (seen.Add(other.id)) queue.Enqueue(other);
            Assert.AreEqual(l.rooms.Count, seen.Count, "unreached rooms: " + string.Join(", ", l.rooms.Where(r => !seen.Contains(r.id)).Select(r => r.id)));
        }

        [Test]
        public void JoinsMeetDoorToDoorOnOneEdge()
        {
            var l = Default();
            Assert.Greater(l.joins.Count, l.rooms.Count - 1, "joins beyond a tree: the frontier joined rooms it met");
            foreach (var j in l.joins)
            {
                var a = l.rooms[j.a]; var b = l.rooms[j.b];
                Assert.Less(j.a, j.b, "the lower id owns the leaf");
                // a's door cell and b's door cell are neighbours across a's side.
                string sideB = a.joinBySide.First(kv => kv.Value == l.joins.IndexOf(j)).Key;
                Assert.AreEqual(j.sideA, sideB);
                var beyond = TestLevelGenerator.BeyondDoor(a, j.sideA, j.offsetA);
                Assert.IsTrue(b.Contains(beyond.x, beyond.y), $"join {j.a}-{j.b}: the cell beyond a's door is b's");
                string opp = TestLevelGenerator.Opposite(j.sideA);
                Assert.IsTrue(b.joinBySide.ContainsKey(opp), $"join {j.a}-{j.b}: b's door on the {opp}");
                var bDoor = l.TemplateOf(b).doors.First(d => d.side == opp);
                Assert.AreEqual(TestLevelGenerator.DoorCell(a, j.sideA, j.offsetA), TestLevelGenerator.BeyondDoor(b, opp, bDoor.offset), "b's door faces a's");
                // The midpoint lies on the shared edge.
                float cell = RoomLayout.Cell;
                if (j.sideA == "north" || j.sideA == "south") Assert.AreEqual((j.sideA == "north" ? a.gy : a.gy + a.h) * cell, j.z, 0.001f);
                else Assert.AreEqual((j.sideA == "west" ? a.gx : a.gx + a.w) * cell, j.x, 0.001f);
            }
        }

        [Test]
        public void TheDefaultLevelIsFiveToTenTimesAFloor()
        {
            var l = Default();
            Assert.GreaterOrEqual(l.rooms.Count, 40, "rooms");
            Assert.GreaterOrEqual(l.FloorCells, 50, "floor cells (a Gravehollow floor is about 10)");
            CollectionAssert.AreEquivalent(new[] { "cellars", "crypts", "vault" }, l.rooms.Select(r => r.kit).Distinct().ToArray());
            Assert.Greater(l.Halls, 3, "halls");
            Assert.IsTrue(l.joins.Any(j => j.kind != "open"), "some joins have a leaf");
            Debug.Log($"[gv-test] level seed 1: {l.rooms.Count} rooms ({l.Halls} halls), {l.FloorCells} cells, {l.joins.Count} joins, hash {l.Hash()}");
        }

        [Test]
        public void DoorKindsFollowTheJoins()
        {
            var l = Default();
            var entry = l.rooms[l.entryId];
            var kinds = l.DoorKindsFor(entry);
            foreach (var d in l.TemplateOf(entry).doors)
            {
                Assert.IsTrue(kinds.ContainsKey(d.side));
                if (!entry.joinBySide.ContainsKey(d.side)) Assert.AreEqual("locked", kinds[d.side], "an unmatched door is locked");
                else Assert.AreNotEqual("locked", kinds[d.side] == "locked" && entry.kit != "vault" ? "locked" : "x", "a matched door is open or leafed");
            }
            var leafed = l.joins.First(j => j.kind != "open");
            Assert.AreEqual(leafed.kind, l.DoorKindsFor(l.rooms[leafed.a])[leafed.sideA]);
            string oppSide = l.rooms[leafed.b].joinBySide.First(kv => kv.Value == l.joins.IndexOf(leafed)).Key;
            Assert.AreEqual("open", l.DoorKindsFor(l.rooms[leafed.b])[oppSide], "the other room shows the open arch behind the leaf");
        }

        [Test]
        public void AHallBuildsThroughTheLayout()
        {
            var kit = KitManifest.Load("cellars");
            var shared = KitManifest.Load("shared");
            var hall = TestLevelGenerator.HallTemplate("cellars", 3, vertical: true);
            var placements = RoomLayout.Build(hall, kit, shared, 0f, 0f, 0, new Dictionary<string, string> { ["north"] = "open", ["south"] = "locked" }, LevelBuilder.Inset);
            Assert.AreEqual(2, placements.Count(p => p.role == RoomLayout.Role.Doorway));
            Assert.AreEqual(4 * 12, placements.Count(p => p.role == RoomLayout.Role.Floor), "4 × 12 tiles of 2 m");
            Assert.AreEqual(0, placements.Count(p => p.role == RoomLayout.Role.Prop));
            Assert.AreEqual(kit.shell.DoorwayOf("locked"), placements.Single(p => p.role == RoomLayout.Role.Doorway && p.side == "south").meshId);
        }

        [Test]
        public void TheInsetPullsTheWallsIn()
        {
            var kit = KitManifest.Load("cellars");
            var shared = KitManifest.Load("shared");
            var t = new Template
            {
                id = "t", kit = "cellars", w = 1, h = 1,
                doors = new[] { new TemplateDoor { side = "east", offset = 0 } },
                camera = new CameraSpec { position = new[] { 0f, 7.5f, -10.6f }, lookAt = new[] { 0f, 1f, 0f }, fov = 40 },
                props = new Prop[0],
            };
            var plain = RoomLayout.Build(t, kit, shared, 0f, 0f);
            var inset = RoomLayout.Build(t, kit, shared, 0f, 0f, 0, null, 0.4f);
            Assert.AreEqual(4f, plain.Single(p => p.role == RoomLayout.Role.Doorway).x, 0.001f);
            Assert.AreEqual(3.6f, inset.Single(p => p.role == RoomLayout.Role.Doorway).x, 0.001f);
            Assert.IsTrue(inset.Where(p => p.role == RoomLayout.Role.Wall && p.side == "north").All(p => Mathf.Abs(Mathf.Abs(p.z) - 3.6f) < 0.001f));
            Assert.IsTrue(inset.Where(p => p.role == RoomLayout.Role.Corner).All(p => Mathf.Abs(Mathf.Abs(p.x) - 3.6f) < 0.001f && Mathf.Abs(Mathf.Abs(p.z) - 3.6f) < 0.001f));
            Assert.AreEqual(plain.Count(p => p.role == RoomLayout.Role.Floor), inset.Count(p => p.role == RoomLayout.Role.Floor), "the floor still reaches the edge");
        }
    }

    public class LevelStreamerTests
    {
        [Test]
        public void TheRings()
        {
            Assert.AreEqual(LevelStreamer.Ring.Active, LevelStreamer.Classify(0f));
            Assert.AreEqual(LevelStreamer.Ring.Active, LevelStreamer.Classify(31.9f));
            Assert.AreEqual(LevelStreamer.Ring.Built, LevelStreamer.Classify(40f));
            Assert.AreEqual(LevelStreamer.Ring.Keep, LevelStreamer.Classify(50f));
            Assert.AreEqual(LevelStreamer.Ring.Release, LevelStreamer.Classify(61f));
        }

        [Test]
        public void DistanceToARectangle()
        {
            var rect = new Bounds(new Vector3(8, 4, 8), new Vector3(16, 8, 16));
            Assert.AreEqual(0f, LevelStreamer.DistanceTo(rect, new Vector3(4, 0, 4)), 0.001f, "inside");
            Assert.AreEqual(10f, LevelStreamer.DistanceTo(rect, new Vector3(26, 0, 8)), 0.001f, "east of it");
            Assert.AreEqual(5f, LevelStreamer.DistanceTo(rect, new Vector3(19, 0, 20)), 0.001f, "a corner: 3-4-5");
            Assert.AreEqual(10f, LevelStreamer.DistanceTo(rect, new Vector3(26, 30, 8)), 0.001f, "height ignored");
        }
    }

    public class SoakStatsTests
    {
        [Test]
        public void Percentiles()
        {
            var v = new List<float> { 10, 20, 30, 40, 50 };
            Assert.AreEqual(30f, SoakStats.Percentile(v, 0.5f), 0.001f);
            Assert.AreEqual(10f, SoakStats.Percentile(v, 0f), 0.001f);
            Assert.AreEqual(50f, SoakStats.Percentile(v, 1f), 0.001f);
            Assert.AreEqual(48f, SoakStats.Percentile(v, 0.95f), 0.001f, "interpolated");
            Assert.IsTrue(float.IsNaN(SoakStats.Percentile(new List<float>(), 0.5f)));
        }

        [Test]
        public void SamplesAreKeptAndSummarised()
        {
            var s = new SoakStats();
            for (int i = 0; i < 10; i++)
                s.Add(new PerfOverlay.Sample { Fps = 60 - i, AvgMs = 16 + i, CpuMs = 10, GpuMs = i % 2 == 0 ? 8 : float.NaN, DrawCalls = 100 + i, Triangles = 1000, MemMb = 200 + i, Thermal = i == 5 ? 2 : 0, Headroom = 0.5f + i * 0.01f });
            Assert.AreEqual(10, s.Samples);
            Assert.AreEqual(5, s.gpu.Count, "NaN GPU readings are not kept");
            Assert.AreEqual(2, s.WorstThermal);
            Assert.AreEqual(209, SoakStats.Max(s.mem));
            var fields = s.Fields().ToDictionary(f => f.key, f => f.value);
            Assert.AreEqual(10, fields["samples"]);
            Assert.AreEqual(55.5f, (float)fields["fpsP50"], 0.001f);
        }
    }
}

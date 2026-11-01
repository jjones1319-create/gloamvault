using System.Collections.Generic;
using System.Linq;
using Gloamvault.Level;
using NUnit.Framework;
using UnityEngine;

namespace Gloamvault.Tests
{
    /// <summary>Phase 15: Floor 1's layout loads and holds together, the map's statuses, the floor's memory round-trips.</summary>
    public class FloorTests
    {
        [Test]
        public void FloorOneLoadsAndHoldsTogether()
        {
            var floor = FloorLayout.Load("floor-1");
            var l = floor.level;
            Assert.GreaterOrEqual(l.rooms.Count, 35, "rooms");
            Assert.GreaterOrEqual(l.FloorCells, 50, "floor cells");
            Assert.AreEqual("entry", floor.RoleOf(l.entryId));
            Assert.IsNotNull(floor.StairsRoom, "a stairs room");
            Assert.GreaterOrEqual(floor.lockedJoins.Count, 1, "a locked door");
            Assert.GreaterOrEqual(floor.leverJoins.Count, 1, "a lever gate");
            Assert.GreaterOrEqual(floor.secretJoins.Count, 2, "secret panels");
            CollectionAssert.AreEquivalent(new[] { "entrance", "stairs", "side", "side" }, floor.def.exits.Select(e => e.kind).ToArray());
            // Every room reached from the entry.
            var seen = new HashSet<int> { l.entryId };
            var queue = new Queue<LevelRoom>(); queue.Enqueue(l.rooms[l.entryId]);
            while (queue.Count > 0) foreach (var (_, other) in l.Neighbours(queue.Dequeue())) if (seen.Add(other.id)) queue.Enqueue(other);
            Assert.AreEqual(l.rooms.Count, seen.Count, "every room reached");
            // The entry's doors: east joined (open), west the gate (open arch), north and south walled.
            var kinds = l.DoorKindsFor(l.rooms[l.entryId]);
            Assert.AreEqual("open", kinds["east"]);
            Assert.AreEqual("open", kinds["west"], "the entrance sits in the west door");
            Assert.AreEqual("wall", kinds["north"]); Assert.AreEqual("wall", kinds["south"]);
            // A lever gate reads as the kit's barred door on its owner, the open arch on the other side.
            int lj = floor.leverJoins.First();
            var j = l.joins[lj];
            Assert.AreEqual("locked", l.DoorKindsFor(l.rooms[j.a])[j.sideA]);
            Assert.AreEqual("open", l.DoorKindsFor(l.rooms[j.b])[TestLevelGenerator.Opposite(j.sideA)]);
            Debug.Log($"[gv-test] floor-1: {l.rooms.Count} rooms ({l.Halls} halls), {l.FloorCells} cells, {l.joins.Count} joins ({floor.lockedJoins.Count} locked, {floor.leverJoins.Count} lever, {floor.secretJoins.Count} secret), {floor.def.exits.Length} exits, {floor.def.spots.Length} spots");
        }

        [Test]
        public void FloorStateRoundTripsAndSurvivesBadData()
        {
            var s = new FloorState("floor-1");
            s.visited.Add(0); s.visited.Add(7); s.secretsFound.Add(17); s.joinsUnlocked.Add(21); s.leversPulled.Add("hearth-lever"); s.exitsFound.Add("rope-shaft"); s.keysHeld = 1; s.keyTaken = true;
            var back = FloorState.FromJson("floor-1", s.ToJson());
            CollectionAssert.AreEquivalent(new[] { 0, 7 }, back.visited);
            CollectionAssert.AreEquivalent(new[] { 17 }, back.secretsFound);
            CollectionAssert.AreEquivalent(new[] { 21 }, back.joinsUnlocked);
            CollectionAssert.AreEquivalent(new[] { "hearth-lever" }, back.leversPulled);
            CollectionAssert.AreEquivalent(new[] { "rope-shaft" }, back.exitsFound);
            Assert.AreEqual(1, back.keysHeld); Assert.IsTrue(back.keyTaken);
            Assert.AreEqual(0, FloorState.FromJson("floor-1", "not json").visited.Count, "bad data leaves an empty state");
            Assert.AreEqual(0, FloorState.FromJson("floor-1", "{\"visited\":[-3],\"keysHeld\":99}").visited.Count);
            Assert.AreEqual(9, FloorState.FromJson("floor-1", "{\"keysHeld\":99}").keysHeld, "clamped");
        }

        [Test]
        public void TheMapShowsWhereYouHaveBeenAndWhatYouHaveSeen()
        {
            var floor = FloorLayout.Load("floor-1");
            var l = floor.level;
            var state = new FloorState("floor-1");
            int entry = l.entryId;
            state.visited.Add(entry);
            var next = l.Neighbours(l.rooms[entry]).First().other;
            Assert.AreEqual(FloorMapLayout.Status.Current, FloorMapLayout.StatusOf(floor, state, entry, entry));
            Assert.AreEqual(FloorMapLayout.Status.Glimpsed, FloorMapLayout.StatusOf(floor, state, next.id, entry), "the room behind a known door");
            Assert.AreEqual(FloorMapLayout.Status.Unknown, FloorMapLayout.StatusOf(floor, state, floor.StairsRoom.id, entry), "far rooms stay dark");
            // A secret room stays dark until its panel is found, even with its neighbour visited.
            int sj = floor.secretJoins.First();
            var j = l.joins[sj];
            state.visited.Add(j.a);
            Assert.AreEqual(FloorMapLayout.Status.Unknown, FloorMapLayout.StatusOf(floor, state, j.b, j.a));
            Assert.IsFalse(FloorMapLayout.JoinKnown(floor, state, sj));
            state.secretsFound.Add(sj);
            Assert.AreEqual(FloorMapLayout.Status.Glimpsed, FloorMapLayout.StatusOf(floor, state, j.b, j.a));
            Assert.IsTrue(FloorMapLayout.JoinKnown(floor, state, sj));
            // Pixels: a 2 × 1 room at (3, 4) with 10 px cells from an origin.
            var rect = FloorMapLayout.RoomRect(new LevelRoom { gx = 3, gy = 4, w = 2, h = 1 }, 10f, new Vector2(5f, 5f));
            Assert.AreEqual(new Rect(35f, 45f, 20f, 10f), rect);
            Assert.AreEqual(new Vector2(5f + 16f / 8f * 10f, 5f + 4f / 8f * 10f), FloorMapLayout.Point(16f, 4f, 10f, new Vector2(5f, 5f)));
        }
    }
}

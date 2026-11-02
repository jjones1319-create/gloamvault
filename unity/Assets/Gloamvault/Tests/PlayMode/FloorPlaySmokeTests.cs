using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Gloamvault.Level;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using UnityEngine.UIElements;

namespace Gloamvault.Tests
{
    /// <summary>
    /// Phase 17: Floor 1 plays by the rules — opening it makes a delve, walking brings a fight and its card, the monsters
    /// wait at their spot until reached, a chest opens with A, the stair ends the floor on a card.
    /// </summary>
    public class FloorPlaySmokeTests
    {
        LevelScreen screen;

        IEnumerator OpenFloor(int seed)
        {
            FloorState.Forget("floor-1");
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(0.5f);
            var doc = Object.FindFirstObjectByType<UIDocument>();
            screen = LevelScreen.Open(doc, seed: seed, floorId: "floor-1");
            yield return null;
            yield return null;
            Assert.IsNotNull(screen.Play, "the floor has its rules");
            Assert.IsTrue(screen.Play.Ok, "the delve was made: " + screen.Play.Error);
            // These test the rules, not the stage (Phase 19 stages fights): a fight plays out at once.
            screen.Play.StageFights = false;
        }

        /// <summary>The rooms from the gate to the target over walkable joins (no locked or secret door), for teleporting room by room.</summary>
        public static List<int> PathTo(Floor floor, int target)
        {
            var prev = new Dictionary<int, int> { [0] = -1 };
            var queue = new Queue<int>();
            queue.Enqueue(0);
            while (queue.Count > 0)
            {
                int r = queue.Dequeue();
                if (r == target) break;
                foreach (var j in floor.def.joins)
                {
                    if (j.kind == "locked" || j.kind == "secret") continue;
                    int other = j.a == r ? j.b : j.b == r ? j.a : -1;
                    if (other < 0 || prev.ContainsKey(other)) continue;
                    prev[other] = r;
                    queue.Enqueue(other);
                }
            }
            if (!prev.ContainsKey(target)) return null;
            var path = new List<int>();
            for (int r = target; r >= 0; r = prev[r]) path.Add(r);
            path.Reverse();
            return path;
        }

        /// <summary>A point 1.6 m inside a room from the join it shares with the previous room, else its centre.</summary>
        public static Vector3 DoorsideOf(Floor floor, int room, int from, float inside = 1.6f)
        {
            var lr = floor.level.rooms[room];
            var centre = LevelBuilder.RoomCentre(lr);
            foreach (var ji in lr.joins)
            {
                var j = floor.level.joins[ji];
                if ((j.a == room && j.b == from) || (j.b == room && j.a == from))
                {
                    var at = LevelBuilder.JoinPoint(j);
                    var inward = centre - at; inward.y = 0;
                    return inward.sqrMagnitude > 0.01f ? at + inward.normalized * inside : centre;
                }
            }
            return centre;
        }

        IEnumerator WalkTo(int target, float insideAtTarget = 1.6f)
        {
            var path = PathTo(screen.Floor, target);
            Assert.IsNotNull(path, $"room {target} is reachable without a key");
            int prev = 0;
            foreach (var r in path)
            {
                // Through the rooms on the way at their doors (the monsters wait at the spots in the middle), the target likewise.
                screen.Teleport(DoorsideOf(screen.Floor, r, prev, r == target ? insideAtTarget : 1.6f));
                prev = r;
                yield return null;
                yield return null;
                if (screen.Play.CardOpen) screen.Play.Card.PressFirst();
                yield return null;
            }
        }

        [UnityTest]
        public IEnumerator OpeningTheFloorMakesADelveAndWalkingBringsAFightOnACard()
        {
            yield return OpenFloor(11);
            var play = screen.Play;
            Assert.AreEqual("room", play.Snap.phase);
            Assert.AreEqual("r0", play.Snap.roomId);
            StringAssert.Contains("light", play.StatsSuffix());
            play.Walk(400);
            yield return null;
            Assert.IsTrue(play.CardOpen, "a card tells the fight");
            Assert.IsFalse(string.IsNullOrEmpty(play.Card.Title));
            Assert.Greater(play.Card.ButtonCount, 0);
            Assert.AreEqual(1, play.Snap.fights);
            Assert.AreEqual(1, play.Snap.randomFights);
            if (play.Snap.phase == "result")
            {
                play.Card.PressFirst();
                yield return null;
                Assert.IsFalse(play.CardOpen);
                Assert.AreEqual("room", play.Snap.phase);
            }
            FloorState.Forget("floor-1");
        }

        [UnityTest]
        public IEnumerator TheMonstersWaitAtTheirSpotUntilReached()
        {
            yield return OpenFloor(11);
            var play = screen.Play;
            yield return WalkTo(2, 0.6f);
            Assert.AreEqual("r2", play.Snap.roomId);
            Assert.AreEqual("room", play.Snap.phase, "entering the room starts nothing");
            var info = play.RoomInfo(2);
            Assert.IsFalse(info.cleared);
            var rect = LevelBuilder.RoomRect(screen.Floor.level.rooms[2]);
            var monsters = play.Things.OfType<MonsterThing>().Where(m => rect.Contains(m.Position)).ToList();
            Assert.AreEqual(1, monsters.Count, "the monsters' thing is in the room");
            // Walk up to them: the fight starts and its card shows.
            screen.Teleport(monsters[0].Position + new Vector3(0.5f, 0f, 0.5f));
            yield return null;
            yield return null;
            Assert.IsTrue(play.CardOpen, "reaching the monsters starts the fight");
            Assert.AreEqual(1, play.Snap.fights);
            if (play.Snap.phase == "result")
            {
                play.Card.PressFirst();
                yield return null;
                Assert.IsTrue(play.RoomInfo(2).cleared, "the room is cleared after the fight");
                Assert.AreEqual(0, play.Things.OfType<MonsterThing>().Count(m => rect.Contains(m.Position)), "the monsters are gone");
            }
            FloorState.Forget("floor-1");
        }

        [UnityTest]
        public IEnumerator AChestOpensWithAAndTheStairEndsTheFloor()
        {
            yield return OpenFloor(11);
            var play = screen.Play;
            // The treasure room (role treasure, room 22 in gen-floor-1.ts): its chests appear on entering.
            int treasure = screen.Floor.def.rooms.First(r => r.role == "treasure").id;
            yield return WalkTo(treasure);
            if (play.Snap.phase != "room") { play.Card.PressFirst(); yield return null; }
            Assert.AreEqual("r" + treasure, play.Snap.roomId);
            var chests = play.Things.OfType<ChestThing>().ToList();
            Assert.Greater(chests.Count, 0, "a chest stands in the treasure room");
            var chest = chests.First(c => !c.locked);
            screen.Teleport(chest.Position + new Vector3(0f, 0f, 1.0f));
            screen.Face(chest.Position);
            yield return null;
            yield return null;
            for (int i = 0; i < 3 && screen.Interactor.Nearest is GoldThing; i++) { screen.Act(); yield return null; if (play.CardOpen) { play.Card.PressFirst(); yield return null; } yield return null; }
            Assert.IsTrue(screen.Interactor.Nearest is ChestThing, "A offers the chest: " + screen.Interactor.Prompt);
            screen.Act();
            yield return null;
            Assert.IsTrue(play.RoomInfo(treasure).chests[chest.index].opened, "the chest is open in the rules");
            if (play.CardOpen) { play.Card.PressFirst(); yield return null; }
            // The stair: a card ends the floor.
            var stairs = screen.Floor.StairsRoom;
            yield return WalkTo(stairs.id);
            var exit = screen.Exits.First(e => e.def.kind == "stairs");
            screen.Teleport(exit.Position + new Vector3(0f, 0f, 1.2f));
            screen.Face(exit.Position);
            yield return null;
            yield return null;
            Assert.IsTrue(screen.Interactor.Nearest is ExitSpot, "A offers the stair: " + screen.Interactor.Prompt);
            screen.Act();
            yield return null;
            Assert.AreEqual("over", play.Snap.phase);
            Assert.AreEqual("cleared", play.Snap.outcome);
            Assert.IsTrue(play.CardOpen);
            StringAssert.Contains("cleared", play.Card.Title.ToLowerInvariant());
            FloorState.Forget("floor-1");
        }
    }
}

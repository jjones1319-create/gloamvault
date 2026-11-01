using System.Collections;
using System.Linq;
using Gloamvault.Env;
using Gloamvault.Level;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using UnityEngine.UIElements;

namespace Gloamvault.Tests
{
    /// <summary>Phase 15: Floor 1 fills its map in, the lever lifts its gate, the panel is found with A, the key opens the lock, and it all stays remembered.</summary>
    public class FloorSmokeTests
    {
        [UnityTest]
        public IEnumerator TheFloorFillsInAndItsThingsWork()
        {
            FloorState.Forget("floor-1");
            yield return Scenes.Load(Scenes.Boot);
            yield return null;
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = LevelScreen.Open(doc, floorId: "floor-1");
            yield return null; yield return null;
            Assert.IsNotNull(screen.Floor, "the floor loaded");
            var floor = screen.Floor;
            var l = floor.level;
            Assert.IsTrue(screen.State.visited.Contains(l.entryId), "the entry is visited on arrival");
            var next = l.Neighbours(l.rooms[l.entryId]).First().other;
            Assert.AreEqual(FloorMapLayout.Status.Glimpsed, FloorMapLayout.StatusOf(floor, screen.State, next.id, l.entryId));
            Assert.IsNotNull(screen.Minimap, "the minimap");

            // The gate: the entrance exit sits in the entry's west door.
            var gate = screen.Exits.First(e => e.def.kind == "entrance");
            var entryCentre = LevelBuilder.RoomCentre(l.rooms[l.entryId]);
            screen.Teleport(gate.Position + (entryCentre - gate.Position).normalized * 1.2f);
            screen.Face(gate.Position);
            yield return null;
            Assert.AreEqual("Leave the keep", screen.Interactor.Prompt);

            // The lever lifts its gate.
            var lever = screen.Levers[0];
            var leverRoom = l.rooms[floor.def.levers[0].room];
            screen.Teleport(lever.Position + (LevelBuilder.RoomCentre(leverRoom) - lever.Position).normalized * 1.2f);
            screen.Face(lever.Position);
            yield return null;
            Assert.IsTrue(screen.Interactor.Nearest is Lever, "the lever is in reach: " + screen.Interactor.Prompt);
            Assert.AreEqual("Pull", screen.Interactor.Prompt);
            Assert.IsTrue(screen.Act());
            Assert.IsTrue(lever.Pulled);
            Assert.IsTrue(screen.State.leversPulled.Contains(lever.id));
            var gateJoin = l.joins[lever.opensJoin];
            Assert.IsTrue(screen.Streamer.IsBuilt(gateJoin.a), "the gate's room is built near the lever");
            var gateDoor = screen.Streamer.Built[gateJoin.a].doors.First(d => d.GetComponent<RoomPiece>().side == gateJoin.sideA);
            yield return null;
            Assert.IsFalse(gateDoor.locked, "the gate is unlocked");
            Assert.IsTrue(gateDoor.IsOpen, "and lifting");

            // The secret panel: wall until searched.
            int sj = floor.secretJoins.First(j => l.joins[j].a == floor.def.levers[0].room);
            var panelJoin = l.joins[sj];
            var panel = screen.Streamer.Built[panelJoin.a].doors.First(d => d.GetComponent<RoomPiece>().side == panelJoin.sideA);
            Assert.IsTrue(panel.hidden, "the panel reads as wall");
            screen.Teleport(LevelBuilder.RoomCentre(l.rooms[panelJoin.a]));
            screen.Face(panel.transform.position);
            yield return null;
            Assert.IsNull(screen.Interactor.Nearest as Door, "no prompt from the room's middle");
            screen.Teleport(panel.transform.position + (LevelBuilder.RoomCentre(l.rooms[panelJoin.a]) - panel.transform.position).normalized * 1.0f);
            screen.Face(panel.transform.position);
            yield return null;
            Assert.AreEqual("Search", screen.Interactor.Prompt);
            Assert.IsTrue(screen.Act());
            Assert.IsFalse(panel.hidden);
            Assert.IsTrue(screen.State.secretsFound.Contains(sj));
            Assert.AreEqual(FloorMapLayout.Status.Glimpsed, FloorMapLayout.StatusOf(floor, screen.State, panelJoin.b, panelJoin.a), "the secret room shows on the map now");

            // The key, then the locked door.
            var key = screen.Key;
            Assert.IsNotNull(key, "the key lies in its room");
            var keyRoom = l.rooms[floor.def.spots.First(s => s.kind == "key").room];
            screen.Teleport(key.Position + (LevelBuilder.RoomCentre(keyRoom) - key.Position).normalized * 1.2f);
            screen.Face(key.Position);
            yield return null;
            Assert.AreEqual("Take the key", screen.Interactor.Prompt);
            Assert.IsTrue(screen.Act());
            Assert.AreEqual(1, screen.State.keysHeld);
            int lj = floor.lockedJoins.First();
            var lockJoin = l.joins[lj];
            screen.Teleport(LevelBuilder.RoomCentre(l.rooms[lockJoin.a]));
            yield return null;
            var locked = screen.Streamer.Built[lockJoin.a].doors.First(d => d.GetComponent<RoomPiece>().side == lockJoin.sideA);
            Assert.IsTrue(locked.locked, "locked until the key");
            screen.Teleport(locked.transform.position + (LevelBuilder.RoomCentre(l.rooms[lockJoin.a]) - locked.transform.position).normalized * 1.3f);
            screen.Face(locked.transform.position);
            yield return null;
            Assert.AreEqual("Locked", screen.Interactor.Prompt);
            Assert.IsTrue(screen.Act(), "the key turns");
            Assert.IsFalse(locked.locked);
            Assert.AreEqual(0, screen.State.keysHeld);
            Assert.IsTrue(screen.State.joinsUnlocked.Contains(lj));

            // Remembered.
            var again = FloorState.Load("floor-1");
            Assert.IsTrue(again.visited.Contains(l.entryId));
            Assert.IsTrue(again.leversPulled.Contains(lever.id));
            Assert.IsTrue(again.secretsFound.Contains(sj));
            Assert.IsTrue(again.joinsUnlocked.Contains(lj));
            Assert.IsTrue(again.keyTaken);
            FloorState.Forget("floor-1");
        }
    }
}

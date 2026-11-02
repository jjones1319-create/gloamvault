using Gloamvault.Level;
using Gloamvault.Sim;
using NUnit.Framework;
using UnityEngine;

namespace Gloamvault.Tests
{
    /// <summary>
    /// Phase 17: the bridge plays a laid-out floor through Jint — a walked delve, the walk seconds, the fight that
    /// comes, the flat snapshot and room report JsonUtility reads, the actions for the card.
    /// </summary>
    public class FloorPlayBridgeTests
    {
        static JintSim engine;

        [OneTimeSetUp]
        public void Load()
        {
            var assets = JintSim.Assets.Load();
            engine = new JintSim(assets.script, assets.content, assets.loadMs);
        }

        [OneTimeTearDown]
        public void Unload() => engine?.Dispose();

        const string Request = "{\"dungeonId\":\"gravehollow-keep\",\"floor\":1,\"lastFloor\":1,\"floorLayoutId\":\"floor-1\",\"seed\":11,\"party\":[{\"classId\":\"warden\",\"speciesId\":\"dwarf\"}]}";

        [Test]
        public void AWalkedDelveStartsAtTheGateWithTheWalkClock()
        {
            int h = engine.CreateDelve(Request);
            var s = JsonUtility.FromJson<SimSnapshot>(engine.Snapshot(h));
            Assert.AreEqual("room", s.phase);
            Assert.AreEqual("r0", s.roomId);
            Assert.GreaterOrEqual(s.walkBudget, 45);
            Assert.LessOrEqual(s.walkBudget, 90);
            Assert.AreEqual(1, s.heroes.Length);
            Assert.AreEqual("warden", s.heroes[0].classId);
            Assert.IsFalse(string.IsNullOrEmpty(s.band));
            engine.DisposeDelve(h);
        }

        [Test]
        public void WalkingLongEnoughBringsAFightThatAutoPlaysToAResult()
        {
            int h = engine.CreateDelve(Request);
            engine.Step(h, "{\"kind\":\"walk\",\"seconds\":400}");
            var s = JsonUtility.FromJson<SimSnapshot>(engine.Snapshot(h));
            Assert.AreEqual("fight", s.phase);
            Assert.Greater(s.enemies.Length, 0);
            Assert.IsFalse(string.IsNullOrEmpty(s.enemies[0].name));
            int guard = 0;
            while (s.phase == "fight" && guard++ < 600) { engine.Step(h, "{\"kind\":\"auto\"}"); s = JsonUtility.FromJson<SimSnapshot>(engine.Snapshot(h)); }
            Assert.IsTrue(s.phase == "result" || s.phase == "over", s.phase);
            Assert.AreEqual(1, s.fights);
            Assert.AreEqual(1, s.randomFights);
            var acts = JsonUtility.FromJson<SimActions>(engine.Actions(h));
            Assert.Greater(acts.items.Length, 0);
            Assert.IsFalse(string.IsNullOrEmpty(acts.items[0].command));
            var ev = JsonUtility.FromJson<SimEvents>("{\"items\":" + engine.LogSince(h, 0) + "}");
            Assert.Greater(ev.items.Length, 0);
            engine.DisposeDelve(h);
        }

        [Test]
        public void ARoomReportNamesWhatWaitsThere()
        {
            int h = engine.CreateDelve(Request);
            var gate = JsonUtility.FromJson<SimRoom>(engine.Room(h, "r0"));
            Assert.AreEqual("entry", gate.kind);
            Assert.IsTrue(gate.cleared);
            // Room 2 holds Floor 1's first encounter spot (gen-floor-1.ts): monsters wait there until engaged.
            var r2 = JsonUtility.FromJson<SimRoom>(engine.Room(h, "r2"));
            Assert.AreEqual("fight", r2.kind);
            Assert.IsFalse(r2.cleared);
            Assert.IsFalse(string.IsNullOrEmpty(r2.encounterId));
            Assert.IsFalse(string.IsNullOrEmpty(r2.monsterId));
            Assert.Greater(r2.monsterCount, 0);
            // Entering it does not start the fight; reaching the monsters does.
            engine.Step(h, "{\"kind\":\"move\",\"toRoomId\":\"r1\"}");
            engine.Step(h, "{\"kind\":\"move\",\"toRoomId\":\"r2\"}");
            Assert.AreEqual("room", JsonUtility.FromJson<SimSnapshot>(engine.Snapshot(h)).phase);
            engine.Step(h, "{\"kind\":\"engage\"}");
            Assert.AreEqual("fight", JsonUtility.FromJson<SimSnapshot>(engine.Snapshot(h)).phase);
            engine.DisposeDelve(h);
        }
    }
}

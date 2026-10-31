using System.Collections;
using System.Linq;
using Gloamvault.Level;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using UnityEngine.UIElements;

namespace Gloamvault.Tests
{
    /// <summary>Phase 14: the level streams around the hero, the pilot walks it on its own, the frame-rate choice sticks.</summary>
    public class LevelSmokeTests
    {
        [UnityTest]
        public IEnumerator RoomsStreamInAndOutAroundTheHero()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return null;
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = LevelScreen.Open(doc, seed: 1);
            yield return null;
            Assert.IsNotNull(screen.Level, "the level generated");
            Assert.IsNotNull(screen.Hero, "the hero built");
            var level = screen.Level;
            var entry = level.rooms[level.entryId];
            Assert.IsTrue(screen.Streamer.IsBuilt(entry.id), "the entry room is built at once");
            foreach (var (_, other) in level.Neighbours(entry)) Assert.IsTrue(screen.Streamer.IsBuilt(other.id), $"the entry's neighbour {other.id} is built");
            Assert.AreEqual(entry.id, screen.Streamer.HeroRoom?.id, "the hero stands in the entry");

            // A far room is not built yet.
            var far = level.rooms.OrderByDescending(r => (LevelBuilder.RoomCentre(r) - screen.Hero.root.transform.position).sqrMagnitude).First();
            Assert.Greater(LevelStreamer.DistanceTo(screen.Streamer.RectOf(far.id), screen.Hero.root.transform.position), LevelStreamer.BuildRadius, "the test needs a room beyond the ring");
            Assert.IsFalse(screen.Streamer.IsBuilt(far.id), "a far room waits");
            int builtBefore = screen.Streamer.Built.Count;
            Assert.Greater(builtBefore, 1);

            // Teleport there: it builds and the entry is released within a few frames.
            screen.Teleport(LevelBuilder.RoomCentre(far));
            for (int i = 0; i < 120 && screen.Streamer.IsBuilt(entry.id); i++) yield return null;
            yield return null; yield return null;
            Assert.IsTrue(screen.Streamer.IsBuilt(far.id), "the far room built on arrival");
            Assert.IsFalse(screen.Streamer.IsBuilt(entry.id), "the entry was released");
            Assert.Greater(screen.Streamer.Releases, 0);
            Assert.AreEqual(far.id, screen.Streamer.HeroRoom?.id);
            Assert.AreEqual(far.kit, screen.Lighting.Zone, "the lighting follows the hero's kit");
        }

        [UnityTest]
        public IEnumerator ThePilotWalksTheLevelOnItsOwn()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return null;
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = LevelScreen.Open(doc, seed: 2, autoWalk: true);
            yield return null;
            var start = screen.Hero.root.transform.position;
            float until = Time.time + 8f;
            while (Time.time < until) yield return null;
            Assert.Greater(screen.Pilot.Walked, 6f, $"the pilot walked ({screen.Pilot.Walked:0.0} m)");
            Assert.Greater((screen.Hero.root.transform.position - start).magnitude, 3f, "and got somewhere");
            Assert.GreaterOrEqual(screen.Pilot.TargetRoom, 0, "it has a target room");
            Assert.IsTrue(screen.Mover.Clip == "Run" || screen.Mover.Clip == "Walk" || screen.Mover.Clip == "Idle");
        }

        [UnityTest]
        public IEnumerator TheFrameRateChoiceSticks()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return null;
            int before = Boot.TargetFps;
            Boot.ApplyFrameRate(120);
            Assert.AreEqual(120, Application.targetFrameRate);
            Assert.AreEqual(120, PlayerPrefs.GetInt(Boot.FpsPref));
            Boot.ApplyFrameRate(60);
            Assert.AreEqual(60, Application.targetFrameRate);
            Boot.ApplyFrameRate(before);
            yield return null;
        }
    }
}

using System.Collections;
using System.Linq;
using Gloamvault.Level;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using UnityEngine.UIElements;

namespace Gloamvault.Tests
{
    /// <summary>Phase 16: at each of Floor 1's four spots the prompt shows, A carries the hero to the far side, and the obstacle blocks the walker.</summary>
    public class TraversalSmokeTests
    {
        [UnityTest]
        public IEnumerator CrawlSqueezeJumpAndClimbCarryTheHeroAcross()
        {
            FloorState.Forget("floor-1");
            yield return Scenes.Load(Scenes.Boot);
            yield return null;
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = LevelScreen.Open(doc, floorId: "floor-1", rules: false);
            yield return null;
            var floor = screen.Floor;
            Assert.IsTrue(screen.Hero.animator.Has("Crawl") && screen.Hero.animator.Has("Jump") && screen.Hero.animator.Has("Climb") && screen.Hero.animator.Has("Squeeze"), "the four clips imported");
            foreach (var spot in floor.def.spots.Where(s => s.IsTraversal))
            {
                var room = floor.level.rooms[spot.room];
                screen.Teleport(LevelBuilder.RoomCentre(room) + Vector3.up * 0.1f);
                yield return null; yield return null;
                var ends = screen.TraversalEnds.Where(e => e.traversal.def == spot).ToList();
                Assert.AreEqual(2, ends.Count, spot.kind + ": two ends built with the room");
                var a = ends[0];
                // Walking straight at the obstacle gets nowhere: stand at end A, push toward B for two seconds.
                screen.Teleport(a.from); screen.Face(a.to);
                yield return null;
                float camYaw = screen.Follow.Yaw;
                var dir = (a.to - a.from).normalized;
                var local = Quaternion.Euler(0, -camYaw, 0) * dir;
                screen.Stick.Set(new Vector2(local.x, local.z).normalized);
                float until = Time.time + 2f;
                while (Time.time < until) yield return null;
                screen.Stick.Set(Vector2.zero);
                float got = Vector3.Dot(screen.Hero.root.transform.position - a.from, dir);
                Assert.Less(got, Vector3.Distance(a.from, a.to) - 0.4f, $"{spot.kind}: the obstacle blocks the walker (walked {got:0.00} m of {Vector3.Distance(a.from, a.to):0.00})");
                // Back at end A, the prompt shows and A carries the hero to end B.
                screen.Teleport(a.from); screen.Face(a.to);
                yield return null; yield return null;
                Assert.AreEqual(TraversalPath.Prompt(spot.kind), screen.Interactor.Prompt, spot.kind + ": the prompt");
                Assert.IsTrue(screen.Act(), spot.kind + ": A starts the move");
                Assert.IsTrue(screen.Mover.Scripted);
                Assert.AreEqual(TraversalPath.Clip(spot.kind), screen.Mover.Clip, spot.kind + ": the clip plays");
                float seconds = TraversalPath.Seconds(spot.kind, Vector3.Distance(a.from, a.to));
                yield return new WaitForSecondsRealtime(seconds + 0.4f);
                Assert.IsFalse(screen.Mover.Scripted, spot.kind + ": the move ended");
                Assert.Less(Vector3.Distance(screen.Hero.root.transform.position, a.to), 0.35f, spot.kind + ": the hero stands at the far end");
                Assert.AreEqual("Idle", screen.Mover.Clip);
            }
            FloorState.Forget("floor-1");
        }
    }
}

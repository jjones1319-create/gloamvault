using System.Linq;
using Gloamvault.Env;
using Gloamvault.Level;
using NUnit.Framework;
using UnityEngine;

namespace Gloamvault.Tests
{
    /// <summary>Phase 16: the traversal paths, Floor 1's four spots, the jump's hole, the clips in the bundle.</summary>
    public class TraversalTests
    {
        [Test]
        public void ThePathsStartAndEndWhereTheyShould()
        {
            var a = new Vector3(0, 0, 0); var b = new Vector3(0, 0, 2.4f);
            foreach (var kind in new[] { "crawl", "squeeze", "jump", "climb" })
            {
                Assert.Less(Vector3.Distance(a, TraversalPath.Position(kind, a, b, 0f)), 0.001f, kind + " starts at A");
                Assert.Less(Vector3.Distance(b, TraversalPath.Position(kind, a, b, 1f)), 0.001f, kind + " ends at B");
                var mid = TraversalPath.Position(kind, a, b, 0.5f);
                Assert.AreEqual(1.2f, mid.z, 0.01f, kind + " halfway along");
            }
            Assert.AreEqual(TraversalPath.JumpHeight, TraversalPath.Position("jump", a, b, 0.5f).y, 0.001f, "a jump peaks at its height");
            Assert.AreEqual(TraversalPath.ClimbHeight, TraversalPath.Position("climb", a, b, 0.5f).y, 0.001f, "a climb humps over");
            Assert.AreEqual(0f, TraversalPath.Position("crawl", a, b, 0.5f).y, 0.001f, "a crawl stays on the floor");
            Assert.AreEqual(2.6f / TraversalPath.CrawlMps, TraversalPath.Seconds("crawl", 2.6f), 0.001f);
            Assert.AreEqual(TraversalPath.JumpSeconds, TraversalPath.Seconds("jump", 2.4f));
            Assert.AreEqual("Crawl under", TraversalPath.Prompt("crawl")); Assert.AreEqual("Climb", TraversalPath.Prompt("climb"));
            Assert.AreEqual("Squeeze", TraversalPath.Clip("squeeze")); Assert.AreEqual("Jump", TraversalPath.Clip("jump"));
        }

        [Test]
        public void FloorOneHasOneSpotOfEachKind()
        {
            var floor = FloorLayout.Load("floor-1");
            var t = floor.def.spots.Where(s => s.IsTraversal).ToList();
            CollectionAssert.AreEquivalent(new[] { "crawl", "squeeze", "jump", "climb" }, t.Select(s => s.kind).ToArray());
            foreach (var s in t)
            {
                Assert.IsTrue(s.axis == "ns" || s.axis == "ew", s.kind + " axis");
                Assert.Greater(s.length, 0.5f, s.kind + " length");
                var room = floor.level.rooms[s.room];
                Assert.IsTrue(room.hall || room.w + room.h > 2, s.kind + " stands in a hall or a long room");
            }
            var jump = t.First(s => s.kind == "jump");
            var hole = LevelBuilder.JumpHole(floor.level.rooms[jump.room], jump);
            float across = jump.axis == "ns" ? hole.x1 - hole.x0 : hole.z1 - hole.z0;
            float along = jump.axis == "ns" ? hole.z1 - hole.z0 : hole.x1 - hole.x0;
            Assert.Greater(across, 8f, "the hole spans the room");
            Assert.AreEqual(jump.length - 0.8f, along, 0.01f, "the hole is shorter than the move, so the ends stand on stone");
        }

        [Test]
        public void TheFourClipsAreInTheBundle()
        {
            var text = Resources.Load<TextAsset>("Hero/clips").text;
            foreach (var name in new[] { "Crawl", "Squeeze", "Jump", "Climb" }) StringAssert.Contains("\"" + name + "\"", text, name);
            StringAssert.Contains("\"speed\":0.8", text.Replace(" ", ""), "the crawl's metres per second");
        }
    }
}

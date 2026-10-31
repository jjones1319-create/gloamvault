using System.Linq;
using Gloamvault.Env;
using Gloamvault.Walk;
using NUnit.Framework;
using UnityEngine;

namespace Gloamvault.Tests
{
    /// <summary>Phase 13: the door motions read from each zone's parts, and the stick's speed band.</summary>
    public class WalkTests
    {
        [Test]
        public void DoorMotionsByZone()
        {
            var axes = new Axes { sx = 1, sz = 1 };
            Door.Moving M(string zone, string id, int i = 0) => Door.Describe(KitManifest.Load(zone).Piece(id).parts[i], axes);
            Assert.AreEqual(Door.Motion.Swing, M("cellars", "cel_door_wood").motion);
            Assert.AreEqual(1.75f, Mathf.Abs(M("cellars", "cel_door_wood").amount), 0.01f);
            Assert.AreEqual(Door.Motion.Lift, M("cellars", "cel_door_portcullis").motion);
            Assert.AreEqual(2.2f, M("cellars", "cel_door_portcullis").amount, 0.01f);
            Assert.AreEqual(Door.Motion.Slide, M("cellars", "cel_door_secret").motion);
            var iron = KitManifest.Load("crypts").Piece("cry_door_iron");
            Assert.AreEqual(2, iron.parts.Length, "two leaves");
            var l = Door.Describe(iron.parts[0], axes); var r = Door.Describe(iron.parts[1], axes);
            Assert.AreEqual(Door.Motion.Swing, l.motion);
            Assert.AreEqual(100f * Mathf.Deg2Rad, Mathf.Abs(l.amount), 0.02f);
            Assert.AreNotEqual(Mathf.Sign(l.amount), Mathf.Sign(r.amount), "the leaves swing opposite ways");
            Assert.AreEqual(Door.Motion.Lift, M("crypts", "cry_door_portcullis").motion);
            Assert.AreEqual(Door.Motion.Swing, M("vault", "vlt_door_vault").motion);
            Assert.AreEqual(1.9f, Mathf.Abs(M("vault", "vlt_door_vault").amount), 0.01f);
            Assert.AreEqual(Door.Motion.Lift, M("vault", "vlt_door_sluice").motion);
            Assert.AreEqual(2.6f, M("vault", "vlt_door_sluice").amount, 0.01f);
            Assert.AreEqual(Door.Motion.Swing, M("vault", "vlt_door_secret").motion);
        }

        [Test]
        public void TheOpeningIsInTheData()
        {
            foreach (var zone in new[] { "cellars", "crypts", "vault" })
            {
                var m = KitManifest.Load(zone);
                Assert.AreEqual(2f, m.shell.opening.width, zone + " opening");
                Assert.AreEqual(2.1f, m.shell.opening.spring, 0.01f);
                Assert.IsTrue(m.shell.doorways.Any(d => d.kind == "locked"), zone + " has a locked door kind");
            }
        }

        [Test]
        public void TheStickBands()
        {
            Assert.AreEqual(0f, HeroMover.SpeedFor(0.02f));
            Assert.Less(HeroMover.SpeedFor(0.3f), HeroMover.WalkMps + 0.01f);
            Assert.Greater(HeroMover.SpeedFor(0.3f), 0.5f);
            Assert.AreEqual(HeroMover.WalkMps, HeroMover.SpeedFor(0.55f), 0.05f);
            Assert.AreEqual(HeroMover.RunMps, HeroMover.SpeedFor(1f), 0.001f);
            var d = HeroMover.DirectionFor(new Vector2(0, 1), 90f);
            Assert.AreEqual(1f, d.x, 0.001f, "pushing up with the camera turned east walks east");
            Assert.AreEqual(0f, d.z, 0.001f);
        }
    }
}

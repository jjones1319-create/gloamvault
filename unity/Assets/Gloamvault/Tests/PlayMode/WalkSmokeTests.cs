using System.Collections;
using System.Linq;
using Gloamvault.Env;
using Gloamvault.Walk;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using UnityEngine.UIElements;

namespace Gloamvault.Tests
{
    /// <summary>Phase 13: the stick walks the hero, walls block, a door opens with A and lets the hero through, the camera cycles.</summary>
    public class WalkSmokeTests
    {
        [UnityTest]
        public IEnumerator WallsBlockAndADoorOpens()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return null;
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = WalkScreen.Open(doc, "cel-t-guardpost");
            yield return null;
            Assert.IsNotNull(screen.Room, "the room built");
            Assert.IsNotNull(screen.Hero, "the hero built");
            Assert.AreEqual(4, screen.Room.doors.Count, "four doors with leaves (the wood kind on every side)");
            Assert.IsTrue(screen.Room.root.GetComponentsInChildren<BoxCollider>().Length > 20, "colliders on the walls and jambs");

            // Push north for three seconds: the hero moves, then the wall stops it inside the room (the north wall is at z = -4 or +4 by the mirror).
            float maxSpeed = 0f;
            screen.Stick.Set(new Vector2(0, 1f));
            float until = Time.time + 3f;
            while (Time.time < until) { maxSpeed = Mathf.Max(maxSpeed, screen.Mover.Speed); yield return null; }
            screen.Stick.Set(Vector2.zero);
            var p = screen.Hero.root.transform.position;
            Assert.Greater(maxSpeed, 1.0f, "the hero ran");
            Assert.LessOrEqual(Mathf.Abs(p.x), 4.2f, "inside the room (x)");
            Assert.LessOrEqual(Mathf.Abs(p.z), 4.2f, "inside the room (z)");
            Assert.IsTrue(screen.Mover.Clip == "Run" || screen.Mover.Clip == "Walk" || screen.Mover.Clip == "Idle");

            // A door: stand before it, facing it, press A; its leaf turns and its collider is off; then walk through.
            var door = screen.Room.doors[0];
            var centre = screen.Room.root.transform.position;
            var inward = (centre - door.transform.position); inward.y = 0; inward.Normalize();
            var hero = screen.Hero.root.transform;
            screen.Mover.controller.enabled = false;
            hero.position = door.transform.position + inward * 1.2f;
            hero.rotation = Quaternion.LookRotation(-inward, Vector3.up);
            screen.Mover.controller.enabled = true;
            yield return null;
            screen.Interactor.Update(hero, screen.Room.doors);
            Assert.AreEqual(door, screen.Interactor.Nearest, "the door in front is the prompt's");
            Assert.AreEqual("Open", screen.Interactor.Prompt);
            Assert.IsTrue(screen.Act(), "A opens it");
            yield return new WaitForSecondsRealtime(0.9f);
            Assert.IsTrue(door.IsOpen);
            Assert.Greater(door.Openness, 0.9f, "the door eased open");
            var leaf = door.parts.First();
            Assert.Greater(Quaternion.Angle(leaf.part.localRotation, leaf.restRotation) + (leaf.part.localPosition - leaf.restPosition).magnitude, 0.5f, "the leaf moved");
            Assert.IsTrue(leaf.collider == null || !leaf.collider.enabled, "the leaf no longer blocks");

            // Through the doorway: push toward it for two seconds and end up past the wall line.
            var outward = -inward;
            float camYaw = screen.Follow.Yaw;
            var local = Quaternion.Euler(0, -camYaw, 0) * outward;
            screen.Stick.Set(new Vector2(local.x, local.z).normalized);
            until = Time.time + 2.5f;
            while (Time.time < until) yield return null;
            screen.Stick.Set(Vector2.zero);
            float along = Vector3.Dot(hero.position - centre, outward);
            Assert.Greater(along, 4.2f, $"through the open door (went {along:0.00} m outward)");

            // The camera's three distances.
            Assert.AreEqual(FollowCamera.Distance.Normal, screen.Follow.distance);
            screen.CycleCamera(); Assert.AreEqual(FollowCamera.Distance.Far, screen.Follow.distance);
            screen.CycleCamera(); Assert.AreEqual(FollowCamera.Distance.Close, screen.Follow.distance);
            screen.CycleCamera(); Assert.AreEqual(FollowCamera.Distance.Normal, screen.Follow.distance);
        }

        [UnityTest]
        public IEnumerator EveryZonesDoorKindOpens()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return null;
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = WalkScreen.Open(doc, "cel-t-guardpost");
            foreach (var id in new[] { "cry-t-wardens-vigil", "vlt-t-throne" })
            {
                screen.ShowById(id);
                yield return null;
                Assert.Greater(screen.Room.doors.Count, 0, id + " has a door with a leaf");
                var d = screen.Room.doors[0];
                Assert.Greater(d.parts.Count, 0, id + ": " + d.meshId + " parts");
                d.Open();
                yield return new WaitForSecondsRealtime(0.8f);
                Assert.Greater(d.Openness, 0.9f, id + " opened");
            }
        }
    }
}

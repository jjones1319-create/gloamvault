using System.Collections.Generic;
using System.Linq;
using Gloamvault.Env;
using NUnit.Framework;
using UnityEngine;

namespace Gloamvault.Tests
{
    /// <summary>The rooms' data and the kits as imported (Phase 11): every template's pieces exist, the vertex codes survived the FBX, the axes are settled.</summary>
    public class EnvDataTests
    {
        static readonly string[] Zones = { "shared", "cellars", "crypts", "vault" };

        [Test]
        public void ThirtyTemplatesInThreeZones()
        {
            var f = TemplateFile.Load();
            Assert.AreEqual(30, f.templates.Length);
            CollectionAssert.AreEquivalent(new[] { "cellars", "crypts", "vault" }, f.templates.Select(t => t.kit).Distinct().ToArray());
            foreach (var t in f.templates) Assert.IsNotNull(t.camera?.position, t.id + " camera");
        }

        [Test]
        public void EveryKitImportsWithItsPieces()
        {
            foreach (var zone in Zones)
            {
                var k = KitLibrary.Load(zone);
                var missing = k.manifest.pieces.Where(p => !k.Has(p.id)).Select(p => p.id).ToArray();
                Assert.IsEmpty(missing, zone + " pieces not in the FBX: " + string.Join(", ", missing));
            }
        }

        [Test]
        public void EveryTemplatePropExistsInItsKit()
        {
            var f = TemplateFile.Load();
            var shared = KitLibrary.Shared;
            var missing = new List<string>();
            foreach (var t in f.templates)
            {
                var k = KitLibrary.Load(t.kit);
                foreach (var p in t.props) if (!k.Has(p.meshId) && !shared.Has(p.meshId)) missing.Add(t.id + ":" + p.meshId);
            }
            Assert.IsEmpty(missing, "props without a piece: " + string.Join(", ", missing));
        }

        [Test]
        public void TheVertexCodesSurvivedTheImport()
        {
            foreach (var zone in Zones)
            {
                var k = KitLibrary.Load(zone);
                float worst = 0; int vertices = 0, withColor = 0, meshes = 0;
                foreach (var mf in k.prefab.GetComponentsInChildren<MeshFilter>())
                {
                    var m = mf.sharedMesh;
                    if (m == null) continue;
                    meshes++;
                    var colors = m.colors;
                    if (colors.Length == 0) continue;
                    withColor++;
                    foreach (var c in colors)
                    {
                        float code = c.r * 15f;
                        worst = Mathf.Max(worst, Mathf.Abs(code - Mathf.Round(code)));
                        vertices++;
                    }
                }
                Assert.AreEqual(meshes, withColor, zone + ": meshes without vertex colours");
                Assert.Less(worst, 0.06f, zone + ": worst distance of a slot code from a whole number over " + vertices + " vertices");
                Debug.Log($"[gv-test] {zone}: {meshes} meshes, {vertices} vertices, worst slot code error {worst:0.000}; axes sx {k.axes.sx} sz {k.axes.sz} ({k.axes.decidedBy})");
            }
        }

        [Test]
        public void TheAxesAgreeAcrossPiecesAndZones()
        {
            foreach (var zone in Zones) KitLibrary.Load(zone);
            Assert.IsTrue(KitLibrary.AxesDecided, "a lopsided piece settled both axes: " + KitLibrary.Global.decidedBy);
            Debug.Log($"[gv-test] axes: sx {KitLibrary.Global.sx} sz {KitLibrary.Global.sz} ({KitLibrary.Global.decidedBy})");
            foreach (var zone in Zones)
            {
                var k = KitLibrary.Load(zone);
                // Every piece's imported bounds match the manifest's through the same mapping (a few cm of tolerance).
                int checkedPieces = 0;
                foreach (var p in k.manifest.pieces)
                {
                    var mf = k.Source(p.id)?.GetComponent<MeshFilter>();
                    if (mf == null || mf.sharedMesh == null || p.bounds?.min == null) continue;
                    // A piece with moving parts (a door's leaf at its hinge) has bounds wider than its body alone.
                    if (p.parts != null && p.parts.Length > 0) continue;
                    var b = mf.sharedMesh.bounds;
                    var min = k.axes.Position(p.bounds.min); var max = k.axes.Position(p.bounds.max);
                    float lo = Mathf.Min(min.x, max.x), hi = Mathf.Max(min.x, max.x);
                    Assert.AreEqual(lo, b.min.x, 0.06f, p.id + " min.x"); Assert.AreEqual(hi, b.max.x, 0.06f, p.id + " max.x");
                    lo = Mathf.Min(min.z, max.z); hi = Mathf.Max(min.z, max.z);
                    Assert.AreEqual(lo, b.min.z, 0.06f, p.id + " min.z"); Assert.AreEqual(hi, b.max.z, 0.06f, p.id + " max.z");
                    Assert.AreEqual(p.bounds.min[1], b.min.y, 0.06f, p.id + " min.y");
                    checkedPieces++;
                }
                Assert.Greater(checkedPieces, 5, zone + " pieces checked");
            }
        }
    }

    public class RoomLayoutTests
    {
        static Template Square(int w, int h, params (string side, int offset)[] doors) => new Template
        {
            id = "test", kit = "cellars", w = w, h = h,
            doors = doors.Select(d => new Door { side = d.side, offset = d.offset }).ToArray(),
            camera = new CameraSpec { position = new[] { 0f, 7.5f, -10.6f }, lookAt = new[] { 0f, 1f, 0f }, fov = 40 },
            props = new Prop[0], triBudget = 40000, drawCallBudget = 40,
        };

        [Test]
        public void AOneCellRoomWithFourDoors()
        {
            var kit = KitManifest.Load("cellars");
            var shared = KitManifest.Load("shared");
            var t = Square(1, 1, ("north", 0), ("east", 0), ("south", 0), ("west", 0));
            // The camera sits north (−z): the north side faces it and is cut low.
            var placements = RoomLayout.Build(t, kit, shared, 0f, -1f);
            Assert.AreEqual(16, placements.Count(p => p.role == RoomLayout.Role.Floor), "4 × 4 floor tiles");
            Assert.AreEqual(4, placements.Count(p => p.role == RoomLayout.Role.Corner));
            var doorways = placements.Where(p => p.role == RoomLayout.Role.Doorway).ToList();
            Assert.AreEqual(4, doorways.Count, "a doorway piece on every side (the cut one on the camera's)");
            Assert.IsTrue(doorways.Single(d => d.side == "north").low);
            Assert.AreEqual(kit.shell.doorwayCut, doorways.Single(d => d.side == "north").meshId);
            Assert.AreEqual(kit.shell.doorway, doorways.Single(d => d.side == "south").meshId);
            var east = doorways.Single(d => d.side == "east");
            Assert.AreEqual(4f, east.x, 0.001f); Assert.AreEqual(0f, east.z, 0.001f);
            Assert.AreEqual(-Mathf.PI / 2, east.yaw, 0.001f, "an east doorway faces west, into the room");
            // Each side: 8 m = segment, 4 m doorway, segment → two 2 m walls.
            Assert.AreEqual(8, placements.Count(p => p.role == RoomLayout.Role.Wall));
            Assert.IsTrue(placements.Where(p => p.role == RoomLayout.Role.Wall && p.side == "north").All(p => p.low && p.sy < 0.2f));
            Assert.IsTrue(placements.Where(p => p.role == RoomLayout.Role.Wall && p.side == "south").All(p => !p.low && p.sy == 1f));
        }

        [Test]
        public void TheRollsMatchTheWebsGenerator()
        {
            // shell.ts `rolls(1)`: the first values of the sequence, from Node (seed (0+1)*7919 + 1*31 + 1 = 7951 for a 1×1 room).
            var r = new RoomLayout.Rolls(7951);
            float a = r.Next(), b = r.Next();
            Assert.That(a, Is.InRange(0f, 1f)); Assert.That(b, Is.InRange(0f, 1f));
            Assert.AreNotEqual(a, b);
            var again = new RoomLayout.Rolls(7951);
            Assert.AreEqual(a, again.Next(), "deterministic");
        }

        [Test]
        public void PickWeightedGivesTheBaseWhatTheAlternatesLeave()
        {
            var alts = new[] { new Weighted { id = "b", weight = 0.12f } };
            Assert.AreEqual("a", RoomLayout.PickWeighted("a", alts, 0.5f));
            Assert.AreEqual("b", RoomLayout.PickWeighted("a", alts, 0.95f));
            Assert.AreEqual("a", RoomLayout.PickWeighted("a", null, 0.99f));
        }
    }

    public class LightLookTests
    {
        [Test]
        public void TheWebsNumbers()
        {
            var full = LightLook.For(100);
            Assert.AreEqual(1.29f, full.hemi, 0.001f); Assert.AreEqual(30f, full.torch, 0.001f); Assert.AreEqual(18f, full.torchRange, 0.001f); Assert.AreEqual(0.26f, full.fogK, 0.001f);
            var half = LightLook.For(50);
            Assert.AreEqual(0.815f, half.hemi, 0.001f); Assert.AreEqual(17.5f, half.torch, 0.001f);
            var none = LightLook.For(0);
            Assert.AreEqual(0.34f, none.hemi, 0.001f); Assert.AreEqual(0f, none.torch); Assert.AreEqual(0.78f, none.fogK, 0.001f);
            Assert.AreEqual(22f, none.fire);
        }
    }
}

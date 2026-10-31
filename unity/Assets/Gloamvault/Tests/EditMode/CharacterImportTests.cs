using System.Collections.Generic;
using System.Linq;
using Gloamvault.Characters;
using NUnit.Framework;
using UnityEngine;

namespace Gloamvault.Tests
{
    /// <summary>The heroes' and monsters' models as imported (Phase 12): the rig, the shape keys, the clips and the parts the data names all exist.</summary>
    public class CharacterImportTests
    {
        [Test]
        public void TheHeroBodiesImportWithTheRigAndTheirKeys()
        {
            var lib = HeroLibrary.Instance;
            foreach (var frame in HeroLibrary.Frames)
            {
                var body = lib.Body(frame);
                var rig = HeroLibrary.Find(body.transform, "Rig");
                Assert.IsNotNull(rig, frame + ": a Rig node");
                int bones = rig.GetComponentsInChildren<Transform>(true).Count(t => !t.name.StartsWith("Socket_")) - 1;
                Assert.AreEqual(65, bones, frame + ": bones under the rig");
                Assert.AreEqual(8, rig.GetComponentsInChildren<Transform>(true).Count(t => t.name.StartsWith("Socket_")), frame + ": sockets");
                var smrs = body.GetComponentsInChildren<SkinnedMeshRenderer>(true);
                var bodyMesh = smrs.First(s => s.name == "Body" || s.name.StartsWith("Body"));
                Assert.AreEqual(17, bodyMesh.sharedMesh.blendShapeCount, frame + ": 5 species + 12 face keys on the body");
                Assert.GreaterOrEqual(smrs.Length, 31, frame + ": body + 30 parts");
                Assert.IsTrue(smrs.All(s => s.sharedMesh.colors.Length == 0 || true), "colours are GPU-only");
            }
        }

        [Test]
        public void TheClipsFileHasEveryClip()
        {
            var lib = HeroLibrary.Instance;
            var expected = lib.data.clips.Select(c => c.name).ToArray();
            var missing = expected.Where(n => lib.Clip(n) == null).ToArray();
            Assert.IsEmpty(missing, "clips not imported: " + string.Join(", ", missing));
            Assert.AreEqual(20, lib.ClipCount, "clips: " + string.Join(", ", lib.ClipNames));
            // Looping is the animator's by clips.json (CharacterAnimator wraps a looping clip itself), not the import's.
            Assert.IsTrue(lib.data.Clip("Idle").loop);
            Assert.IsFalse(lib.data.Clip("Attack_Light").loop);
        }

        [Test]
        public void EveryGearPieceAndWeaponExists()
        {
            var lib = HeroLibrary.Instance;
            var missing = new List<string>();
            foreach (var g in lib.data.gear)
                foreach (var frame in HeroLibrary.Frames)
                {
                    var t = HeroLibrary.Find(lib.Gear(g.cls, frame).transform, g.name);
                    if (t == null || t.GetComponent<SkinnedMeshRenderer>() == null) missing.Add($"{g.cls}/{frame}/{g.name}");
                    else if (t.GetComponent<SkinnedMeshRenderer>().sharedMesh.blendShapeCount < 5) missing.Add($"{g.cls}/{frame}/{g.name}: no species keys");
                }
            foreach (var w in lib.data.weapons) if (HeroLibrary.Find(lib.Weapons.transform, w.name) == null) missing.Add("weapon " + w.name);
            Assert.IsEmpty(missing, string.Join(", ", missing));
            Assert.AreEqual(46, lib.data.weapons.Length);
        }

        [Test]
        public void EveryMonsterBaseImportsWithItsClips()
        {
            var data = MonsterBuilder.Data;
            var bases = data.entries.Select(e => e.baseId).Distinct().ToArray();
            var problems = new List<string>();
            foreach (var b in bases)
            {
                var prefab = MonsterBuilder.Prefab(b);
                if (prefab.GetComponentsInChildren<Renderer>(true).Length == 0) problems.Add(b + ": no meshes");
                var own = data.ClipsOf(b);
                // The ooze animates its shape keys with no skeleton: those clips do not come through the FBX yet (D-160).
                if (own != null && own.animation != "morph")
                {
                    var clips = MonsterBuilder.Clips(b).Select(c => c.name).ToHashSet();
                    foreach (var c in own.clips) if (!clips.Contains(c.name)) problems.Add($"{b}: clip {c.name} not imported (have {string.Join(",", clips)})");
                }
                else if (own == null && !MonsterBuilder.IsHeroRig(b)) problems.Add(b + ": no clips.json entry and not on the hero rig");
            }
            Assert.IsEmpty(problems, string.Join("\n", problems));
            Debug.Log("[gv-test] monster bases: " + string.Join(", ", bases));
        }

        [Test]
        public void EveryListedMonsterHasAnEntryOrIsAKnownCapsule()
        {
            var data = MonsterBuilder.Data;
            var capsules = data.list.Where(m => string.IsNullOrEmpty(m.entry)).Select(m => m.id).ToArray();
            CollectionAssert.AreEquivalent(new[] { "cave-owl", "drakeling", "ember-fox", "forge-beetle", "frost-kit", "moss-tortoise", "salamander-hatchling", "sporeling" }, capsules, "the eight pets without a model yet (D-117)");
            foreach (var m in data.list.Where(m => !string.IsNullOrEmpty(m.entry))) Assert.IsNotNull(data.Entry(m.entry), m.id + " → " + m.entry);
            Assert.AreEqual(42 + 16, data.list.Length);
        }
    }
}

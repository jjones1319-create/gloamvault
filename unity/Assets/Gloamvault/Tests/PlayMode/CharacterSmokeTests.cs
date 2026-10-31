using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Gloamvault.Characters;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

namespace Gloamvault.Tests
{
    /// <summary>Phase 12: every species × class assembles whole, every monster entry builds, and a clip moves a bone.</summary>
    public class CharacterSmokeTests
    {
        [UnityTest]
        public IEnumerator EverySpeciesAndClassAssembles()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return null;
            var problems = new List<string>();
            int built = 0;
            foreach (var species in HeroLibrary.SpeciesIds)
                foreach (var cls in HeroLibrary.Classes)
                {
                    var c = HeroAssembler.Build(new HeroSpec { speciesId = species, classId = cls, tier = "S" });
                    built++;
                    if (c.missing.Count > 0) problems.Add($"{species} {cls}: missing {string.Join(", ", c.missing)}");
                    var gear = c.renderers.OfType<SkinnedMeshRenderer>().Where(s => s.name.StartsWith("gear_")).ToList();
                    if (gear.Count < 5) problems.Add($"{species} {cls}: {gear.Count} gear pieces");
                    foreach (var g in gear) if (g.bones.Any(b => b == null)) problems.Add($"{species} {cls}: {g.name} has an unbound bone");
                    if (c.bodyMaterial.GetFloat("_HiddenRegions") <= 0) problems.Add($"{species} {cls}: no body region hidden under armour");
                    bool hair = c.renderers.Any(r => r.name.StartsWith("hair_") && r.gameObject.activeSelf);
                    if (hair) problems.Add($"{species} {cls}: hair shows under the helmet");
                    if (c.renderers.Count(r => r.name.StartsWith("wpn_") || r.name.StartsWith("shd_")) == 0) problems.Add($"{species} {cls}: no weapon");
                    c.Destroy();
                }
            Assert.AreEqual(36, built);
            Assert.IsEmpty(problems, string.Join("\n", problems));
        }

        [UnityTest]
        public IEnumerator EveryMonsterEntryBuilds()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return null;
            var problems = new List<string>();
            foreach (var e in MonsterBuilder.Data.entries)
            {
                Character c = null;
                try { c = MonsterBuilder.Build(e); }
                catch (System.Exception ex) { problems.Add($"{e.key}: {ex.Message}"); continue; }
                if (c.renderers.Count == 0) problems.Add(e.key + ": nothing to draw");
                if (c.missing.Count > 0) problems.Add($"{e.key}: missing {string.Join(", ", c.missing)}");
                bool morph = MonsterBuilder.Data.ClipsOf(e.baseId)?.animation == "morph";
                if (!morph && !c.animator.Has("Idle")) problems.Add(e.key + ": no Idle");
                c.Destroy();
            }
            Assert.IsEmpty(problems, string.Join("\n", problems));
        }

        [UnityTest]
        public IEnumerator AClipMovesABone()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return null;
            var c = HeroAssembler.Build(new HeroSpec { speciesId = "dwarf", classId = "warden", tier = "S" });
            var hand = c.bones["RightHand"];
            Assert.IsTrue(c.animator.Play("Attack_Heavy"), "Attack_Heavy plays");
            yield return null;
            var before = hand.position;
            yield return new WaitForSecondsRealtime(0.4f);
            Assert.Greater((hand.position - before).magnitude, 0.01f, "the hand moved");
            Assert.IsTrue(c.animator.Play("Idle"));
            c.Destroy();
        }
    }
}

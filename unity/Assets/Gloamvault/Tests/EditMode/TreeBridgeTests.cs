using Gloamvault.Sim;
using NUnit.Framework;
using UnityEngine;

namespace Gloamvault.Tests
{
    /// <summary>Phase 18 (D-153, D-154): the bridge's tree and test hero through Jint — the Arcanist's four branches, points spent, the reset.</summary>
    public class TreeBridgeTests
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

        [Test]
        public void TheArcanistHasFourBranchesOfFifteenWithSixSummons()
        {
            var tree = JsonUtility.FromJson<TreeFile>(engine.Tree("arcanist"));
            Assert.AreEqual(4, tree.branches.Length);
            int summons = 0;
            foreach (var b in tree.branches)
            {
                Assert.AreEqual(5, b.tiers.Length, b.name);
                int n = 0;
                foreach (var t in b.tiers) { Assert.AreEqual(3, t.skills.Length, b.name + " tier " + t.tier); n += t.skills.Length; foreach (var s in t.skills) if (s.summon != "") summons++; }
                Assert.AreEqual(15, n, b.name);
            }
            Assert.AreEqual(6, summons);
            var warden = JsonUtility.FromJson<TreeFile>(engine.Tree("warden"));
            Assert.AreEqual(3, warden.branches.Length);
        }

        [Test]
        public void ATestHeroSpendsItsPointsAndResets()
        {
            int h = engine.HeroMake("{\"classId\":\"arcanist\",\"speciesId\":\"elf\",\"level\":6}");
            var v = JsonUtility.FromJson<HeroView>(engine.HeroView(h));
            Assert.AreEqual(6, v.level);
            Assert.AreEqual(5, v.points);
            Assert.AreEqual(8, v.earned);
            HeroStanding cinder = null;
            foreach (var s in v.standings) if (s.skillId == "arcanist-cinder-snap") cinder = s;
            Assert.IsNotNull(cinder);
            Assert.IsTrue(cinder.open);
            v = JsonUtility.FromJson<HeroView>(engine.HeroSpend(h, "arcanist-cinder-snap"));
            Assert.AreEqual(4, v.points);
            Assert.Throws<SimException>(() => engine.HeroSpend(h, "arcanist-sunflare"));
            v = JsonUtility.FromJson<HeroView>(engine.HeroEquip(h, 3, "arcanist-cinder-snap"));
            Assert.AreEqual("arcanist-cinder-snap", v.actives[3]);
            v = JsonUtility.FromJson<HeroView>(engine.HeroReset(h));
            Assert.AreEqual(8, v.points);
            Assert.AreEqual("", v.actives[0]);
            v = JsonUtility.FromJson<HeroView>(engine.HeroLevel(h, 20));
            Assert.AreEqual(20, v.level);
            Assert.AreEqual(4, v.tierOpen);
            engine.HeroDispose(h);
        }
    }
}

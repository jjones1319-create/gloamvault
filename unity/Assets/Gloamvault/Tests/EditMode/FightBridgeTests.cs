using Gloamvault.Level;
using Gloamvault.Sim;
using NUnit.Framework;
using UnityEngine;

namespace Gloamvault.Tests
{
    /// <summary>Phase 19 (D-179): the fight's actors and events through the bridge — rows and sides, an action's skill id, the events kept after the end.</summary>
    public class FightBridgeTests
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
        public void AFightHasSidesRowsAndEventsWithSkillIds()
        {
            int h = engine.CreateDelve("{\"dungeonId\":\"gravehollow-keep\",\"floor\":1,\"lastFloor\":1,\"floorLayoutId\":\"floor-1\",\"seed\":11,\"party\":[{\"classId\":\"arcanist\",\"speciesId\":\"elf\",\"skillIds\":[\"arcanist-call-ember-imp\"],\"onlyActives\":[\"arcanist-call-ember-imp\"],\"aiRule\":\"ELSE call: ember imp on weakest enemy\"},{\"classId\":\"mender\"}]}");
            engine.Step(h, "{\"kind\":\"walk\",\"seconds\":400}");
            var view = JsonUtility.FromJson<FightView>(engine.FightView(h));
            Assert.IsTrue(view.active);
            Assert.Greater(view.actors.Length, 2);
            bool party = false, enemy = false;
            foreach (var a in view.actors) { if (a.side == "party") party = true; if (a.side == "enemy") { enemy = true; Assert.IsFalse(string.IsNullOrEmpty(a.monsterId)); } }
            Assert.IsTrue(party && enemy);
            int guard = 0, seen = 0, actions = 0;
            bool summon = false;
            while (guard++ < 400)
            {
                var snap = JsonUtility.FromJson<SimSnapshot>(engine.Snapshot(h));
                if (snap.phase != "fight") break;
                engine.Step(h, "{\"kind\":\"auto\"}");
                var ev = JsonUtility.FromJson<FightEvents>(engine.FightEvents(h, seen));
                seen = ev.total;
                foreach (var e in ev.items) { if (e.kind == "action") actions++; if (e.skillId == "arcanist-call-ember-imp") summon = true; }
            }
            Assert.Greater(actions, 0);
            Assert.IsTrue(summon, "the Arcanist with only Call: Ember Imp in its slots called it");
            // After the end the last fight still answers: its outcome and its full log.
            var after = JsonUtility.FromJson<FightView>(engine.FightView(h));
            Assert.IsFalse(after.active);
            Assert.IsFalse(string.IsNullOrEmpty(after.over));
            var all = JsonUtility.FromJson<FightEvents>(engine.FightEvents(h, 0));
            Assert.AreEqual(seen, all.total);
            engine.DisposeDelve(h);
        }
    }
}

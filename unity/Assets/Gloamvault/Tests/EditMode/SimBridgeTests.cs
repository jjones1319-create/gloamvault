using System;
using System.Linq;
using Gloamvault.Sim;
using NUnit.Framework;
using UnityEngine;

namespace Gloamvault.Tests
{
    /// <summary>
    /// The sim inside Jint, in the Editor (Phase 10, D-139): the bundle runs, the bridge answers, and every golden
    /// delve reaches the same hashes Node reached. The phone's timings are the real test (npm run unity:rules);
    /// these log the Editor's for comparison.
    /// </summary>
    public class SimBridgeTests
    {
        static JintSim.Assets assets;
        static JintSim engine;

        [OneTimeSetUp]
        public void Load()
        {
            assets = JintSim.Assets.Load();
            engine = new JintSim(assets.script, assets.content, assets.loadMs);
            var s = engine.Startup;
            Debug.Log($"[gv-test] {engine.Name} start-up in the Editor: read {s.loadMs:0} ms, run {s.runMs:0} ms, content {s.initMs:0} ms");
        }

        [OneTimeTearDown]
        public void Unload() => engine?.Dispose();

        [Serializable]
        class Info { public int bridge; public int files; public int @class; public int dungeon; public int skill; }

        [Test]
        public void TheBundleRunsAndTheContentIndexes()
        {
            var info = JsonUtility.FromJson<Info>(engine.Init(assets.content));
            Assert.GreaterOrEqual(info.bridge, 1);
            Assert.Greater(info.files, 1000, "the content's files");
            Assert.GreaterOrEqual(info.@class, 6);
            Assert.GreaterOrEqual(info.dungeon, 1);
            Assert.Greater(info.skill, 300);
        }

        [Test]
        public void BadInputGivesTheSimsOwnMessage()
        {
            var e = Assert.Throws<SimException>(() => engine.CreateDelve("{\"dungeonId\":\"nowhere\",\"seed\":1,\"party\":[{\"classId\":\"warden\"}]}"));
            StringAssert.Contains("no dungeon \"nowhere\"", e.Message);
            Assert.Throws<SimException>(() => engine.Step(999, "{\"kind\":\"auto\"}"));
        }

        [Test]
        public void EveryGoldenDelveMatchesNode()
        {
            var golden = RulesCheck.GoldenFile.Parse(assets.golden);
            var results = RulesCheck.Run(engine, golden);
            Assert.AreEqual(golden.cases.Length, results.Count);
            foreach (var r in results)
            {
                Debug.Log($"[gv-test] case {r.golden.id}: {(r.same ? "same" : "DIFFERS at " + r.differsAt)} · {r.steps} steps in {r.totalMs:0} ms · step p50 {r.stepP50:0.00} p95 {r.stepP95:0.00} max {r.stepMax:0.0} ms · legal p95 {r.legalP95:0.00} ms" + (r.error != null ? " · " + r.error : ""));
                Assert.IsNull(r.error, $"case {r.golden.id}");
                Assert.IsTrue(r.same, $"case {r.golden.id} differs at step {r.differsAt}");
                Assert.AreEqual(r.golden.steps, r.steps, $"case {r.golden.id} steps");
            }
            Assert.IsTrue(results.All(r => r.same));
        }
    }
}

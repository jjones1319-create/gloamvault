using System;
using System.Diagnostics;
using Jint;
using Jint.Native;
using Jint.Runtime;
using UnityEngine;

namespace Gloamvault.Sim
{
    /// <summary>
    /// The TypeScript sim inside Jint (D-139, Phase 10). <c>npm run unity:bundle</c> writes the sim as one script
    /// (<c>Resources/Sim/sim.js.txt</c>, a global <c>GV</c> with the bridge's calls) and the content as one JSON file;
    /// this class runs the script once, keeps the bridge's functions, and forwards each call. Not thread-safe: use one
    /// engine from one thread (the rules check runs on a worker thread of its own).
    /// </summary>
    public sealed class JintSim : ISimEngine
    {
        public const string Version = "Jint 4.17.0";
        public string Name => Version;
        public StartupTiming Startup => startup;

        /// <summary>The bundle's files, read on the main thread (<c>Resources.Load</c> is main-thread only).</summary>
        public sealed class Assets
        {
            public string script;
            public string content;
            public string golden;
            public double loadMs;

            public static Assets Load()
            {
                var sw = Stopwatch.StartNew();
                var a = new Assets
                {
                    script = Text("Sim/sim.js"),
                    content = Text("Sim/content"),
                    golden = Text("Sim/golden"),
                };
                a.loadMs = sw.Elapsed.TotalMilliseconds;
                return a;
            }

            static string Text(string path)
            {
                var asset = Resources.Load<TextAsset>(path);
                if (asset == null) throw new SimException($"missing Resources/{path} — run npm run unity:bundle");
                return asset.text;
            }
        }

        readonly Engine engine;
        readonly JsValue fnInit, fnCreateDelve, fnStep, fnLegal, fnHash, fnSummary, fnPhase, fnLogSince, fnDispose;
        readonly JsValue fnSnapshot, fnRoom, fnActions;
        readonly JsValue fnFightView, fnFightEvents;
        readonly JsValue fnTree, fnHeroMake, fnHeroView, fnHeroSpend, fnHeroEquip, fnHeroReset, fnHeroLevel, fnHeroDispose;
        StartupTiming startup;

        /// <summary>Runs the script and indexes the content. <paramref name="loadMs"/> is how long reading the files took.</summary>
        public JintSim(string script, string contentJson, double loadMs = 0)
        {
            startup.loadMs = loadMs;
            var sw = Stopwatch.StartNew();
            try
            {
                engine = new Engine(options => { options.Strict(false); });
                engine.Execute(Engine.PrepareScript(script, "sim.js"));
                var gv = engine.GetValue("GV").AsObject();
                fnInit = Fn(gv, "init");
                fnCreateDelve = Fn(gv, "createDelve");
                fnStep = Fn(gv, "step");
                fnLegal = Fn(gv, "legal");
                fnHash = Fn(gv, "hash");
                fnSummary = Fn(gv, "summary");
                fnPhase = Fn(gv, "phase");
                fnLogSince = Fn(gv, "logSince");
                fnDispose = Fn(gv, "dispose");
                fnSnapshot = Fn(gv, "snapshot");
                fnRoom = Fn(gv, "room");
                fnActions = Fn(gv, "actions");
                fnFightView = Fn(gv, "fightView"); fnFightEvents = Fn(gv, "fightEvents");
                fnTree = Fn(gv, "tree"); fnHeroMake = Fn(gv, "heroMake"); fnHeroView = Fn(gv, "heroView"); fnHeroSpend = Fn(gv, "heroSpend");
                fnHeroEquip = Fn(gv, "heroEquip"); fnHeroReset = Fn(gv, "heroReset"); fnHeroLevel = Fn(gv, "heroLevel"); fnHeroDispose = Fn(gv, "heroDispose");
            }
            catch (JintException e)
            {
                throw new SimException("the sim script failed to run: " + e.Message, e);
            }
            startup.runMs = sw.Elapsed.TotalMilliseconds;
            sw.Restart();
            Init(contentJson);
            startup.initMs = sw.Elapsed.TotalMilliseconds;
        }

        static JsValue Fn(Jint.Native.Object.ObjectInstance gv, string name)
        {
            var v = gv.Get(name);
            if (v.IsUndefined() || !v.IsObject()) throw new SimException($"the sim script has no GV.{name}");
            return v;
        }

        public string Init(string contentJson) => Call(fnInit, contentJson).AsString();
        public int CreateDelve(string requestJson) => (int)Call(fnCreateDelve, requestJson).AsNumber();
        public string Step(int handle, string commandJson) => Call(fnStep, handle, commandJson).AsString();
        public string Legal(int handle) => Call(fnLegal, handle).AsString();
        public string Hash(int handle) => Call(fnHash, handle).AsString();
        public string Summary(int handle) => Call(fnSummary, handle).AsString();
        public string Phase(int handle) => Call(fnPhase, handle).AsString();
        public string LogSince(int handle, int from) => Call(fnLogSince, handle, from).AsString();
        public void DisposeDelve(int handle) => Call(fnDispose, handle);
        public string Snapshot(int handle) => Call(fnSnapshot, handle).AsString();
        public string Room(int handle, string roomId) => Call(fnRoom, handle, roomId).AsString();
        public string Actions(int handle) => Call(fnActions, handle).AsString();
        // Phase 19 (D-179): the fight on the stage — its actors and its events.
        public string FightView(int handle) => Call(fnFightView, handle).AsString();
        public string FightEvents(int handle, int from) => Call(fnFightEvents, handle, from).AsString();
        // Phase 18 (D-153): the skill tree and a test hero to spend on.
        public string Tree(string classId) => Call(fnTree, classId).AsString();
        public int HeroMake(string requestJson) => (int)Call(fnHeroMake, requestJson).AsNumber();
        public string HeroView(int handle) => Call(fnHeroView, handle).AsString();
        public string HeroSpend(int handle, string skillId) => Call(fnHeroSpend, handle, skillId).AsString();
        public string HeroEquip(int handle, int slot, string skillId) => Call(fnHeroEquip, handle, slot, skillId).AsString();
        public string HeroReset(int handle) => Call(fnHeroReset, handle).AsString();
        public string HeroLevel(int handle, int level) => Call(fnHeroLevel, handle, level).AsString();
        public void HeroDispose(int handle) => Call(fnHeroDispose, handle);

        JsValue Call(JsValue fn, params object[] args)
        {
            try
            {
                return engine.Invoke(fn, args);
            }
            catch (JavaScriptException e)
            {
                // The sim's own throw: its message is the one to show ("no dungeon \"nowhere\"").
                throw new SimException(e.Message, e);
            }
            catch (JintException e)
            {
                throw new SimException("the engine failed: " + e.Message, e);
            }
        }

        public void Dispose()
        {
            // Jint has nothing unmanaged; dropping the engine is enough.
        }
    }
}

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

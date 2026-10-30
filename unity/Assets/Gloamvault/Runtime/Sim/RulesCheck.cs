using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using UnityEngine;

namespace Gloamvault.Sim
{
    /// <summary>
    /// The rules check (Phase 10, D-139): plays the golden cases — the delves <c>npm run unity:bundle</c> played in Node
    /// — through an <see cref="ISimEngine"/> and compares the state hash at every checkpoint. Equal hashes mean the
    /// rules give the same answers on the phone as on the computer; the timings say whether they are fast enough
    /// (a step's p95 under 30 ms, 12 §3). Plain C#, no Unity objects: it runs on a worker thread and in EditMode tests.
    /// </summary>
    public static class RulesCheck
    {
        [Serializable]
        public sealed class GoldenFile
        {
            public int bridge;
            public int every;
            public int cap;
            public NodeStartup node;
            public GoldenCase[] cases;

            public static GoldenFile Parse(string json)
            {
                var g = JsonUtility.FromJson<GoldenFile>(json);
                if (g == null || g.cases == null || g.cases.Length == 0) throw new SimException("golden.json has no cases");
                return g;
            }
        }

        [Serializable]
        public sealed class NodeStartup
        {
            public double runMs;
            public double initMs;
        }

        [Serializable]
        public sealed class GoldenCase
        {
            public string id;
            public string title;
            /// <summary>The bridge's DelveRequest, as a JSON string.</summary>
            public string requestJson;
            public int steps;
            public int commands;
            public string phase;
            public string[] checkpoints;
            public string final;
            public NodeTiming node;

            /// <summary>Auto mode plays a whole fight in one step (the balance runner's path), so its step times are not a player's wait.</summary>
            public bool Auto => requestJson != null && requestJson.Contains("\"auto\":true");
        }

        [Serializable]
        public sealed class NodeTiming
        {
            public double stepP50;
            public double stepP95;
            public double stepMax;
            public double legalP95;
        }

        [Serializable]
        sealed class StepResult
        {
            public string phase;
            public int commands;
            public bool over;
        }

        /// <summary>What one case gave: the same hashes or the first step that differed, and the times.</summary>
        public sealed class CaseResult
        {
            public GoldenCase golden;
            public bool same;
            public int steps;
            /// <summary>The step (1-based) whose checkpoint first differed, or 0 when none did.</summary>
            public int differsAt;
            public string error;
            public double stepP50, stepP95, stepMax, legalP95, totalMs;
            public bool Done => error != null || steps > 0;
        }

        /// <summary>Progress for a screen: the case, how far along (0–1), and the result when it is done.</summary>
        public delegate void Progress(GoldenCase golden, float fraction, CaseResult result);

        /// <summary>Plays every case (or the one named) and logs a <c>[gv] rules</c> line each, then <c>rules-done</c>.</summary>
        public static List<CaseResult> Run(ISimEngine engine, GoldenFile golden, Progress progress = null, Func<bool> cancelled = null, string onlyCaseId = null)
        {
            var results = new List<CaseResult>();
            foreach (var c in golden.cases)
            {
                if (onlyCaseId != null && c.id != onlyCaseId) continue;
                if (cancelled != null && cancelled()) break;
                var r = Play(engine, golden, c, progress, cancelled);
                results.Add(r);
                GvLog.Line("rules",
                    ("case", c.id), ("same", r.same ? 1 : 0), ("steps", r.steps), ("differsAt", r.differsAt),
                    ("stepP50", Round(r.stepP50)), ("stepP95", Round(r.stepP95)), ("stepMax", Round(r.stepMax)),
                    ("legalP95", Round(r.legalP95)), ("ms", Round(r.totalMs)), ("error", r.error ?? ""));
            }
            var s = engine.Startup;
            GvLog.Line("rules-done",
                ("engine", engine.Name), ("cases", results.Count), ("same", results.Count(x => x.same)),
                ("loadMs", Round(s.loadMs)), ("runMs", Round(s.runMs)), ("initMs", Round(s.initMs)),
                ("stepP95", Round(results.Count > 0 ? results.Max(x => x.stepP95) : 0)));
            return results;
        }

        /// <summary>
        /// One case, exactly as tools/unity/bundle.ts played it: ask for the legal commands, step <c>auto</c>, compare
        /// the hash every <c>every</c> steps, stop when the delve is over, when a step changes nothing, or at the cap.
        /// </summary>
        public static CaseResult Play(ISimEngine engine, GoldenFile golden, GoldenCase c, Progress progress = null, Func<bool> cancelled = null)
        {
            var r = new CaseResult { golden = c };
            var stepMs = new List<double>(c.steps + 8);
            var legalMs = new List<double>(c.steps + 8);
            var total = Stopwatch.StartNew();
            int handle = -1;
            try
            {
                handle = engine.CreateDelve(c.requestJson);
                int steps = 0, commands = 0, checkpoint = 0;
                var sw = new Stopwatch();
                while (steps < golden.cap)
                {
                    if (cancelled != null && cancelled()) { r.error = "stopped"; break; }
                    sw.Restart();
                    engine.Legal(handle);
                    legalMs.Add(sw.Elapsed.TotalMilliseconds);
                    sw.Restart();
                    var step = JsonUtility.FromJson<StepResult>(engine.Step(handle, "{\"kind\":\"auto\"}"));
                    stepMs.Add(sw.Elapsed.TotalMilliseconds);
                    steps++;
                    bool moved = step.commands != commands;
                    commands = step.commands;
                    if (steps % golden.every == 0)
                    {
                        string hash = engine.Hash(handle);
                        if (checkpoint >= c.checkpoints.Length || hash != c.checkpoints[checkpoint])
                        {
                            r.differsAt = steps;
                            break;
                        }
                        checkpoint++;
                    }
                    progress?.Invoke(c, Mathf.Clamp01(steps / (float)Math.Max(1, c.steps)), null);
                    if (step.over || !moved) break;
                }
                r.steps = steps;
                if (r.differsAt == 0 && r.error == null)
                {
                    string final = engine.Hash(handle);
                    if (steps != c.steps || final != c.final) r.differsAt = steps;
                }
                r.same = r.differsAt == 0 && r.error == null;
            }
            catch (SimException e)
            {
                r.error = e.Message;
                r.same = false;
            }
            finally
            {
                if (handle >= 0) { try { engine.DisposeDelve(handle); } catch (SimException) { } }
            }
            r.totalMs = total.Elapsed.TotalMilliseconds;
            r.stepP50 = Percentile(stepMs, 50);
            r.stepP95 = Percentile(stepMs, 95);
            r.stepMax = stepMs.Count > 0 ? stepMs.Max() : 0;
            r.legalP95 = Percentile(legalMs, 95);
            progress?.Invoke(c, 1f, r);
            return r;
        }

        public static double Percentile(List<double> xs, int p)
        {
            if (xs.Count == 0) return 0;
            var s = xs.OrderBy(x => x).ToList();
            int i = Math.Min(s.Count - 1, (int)Math.Ceiling(p / 100.0 * s.Count) - 1);
            return s[Math.Max(0, i)];
        }

        static double Round(double x) => Math.Round(x, 2);
    }
}

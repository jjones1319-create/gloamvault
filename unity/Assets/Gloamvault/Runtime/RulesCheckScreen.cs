using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;
using Gloamvault.Sim;
using UnityEngine;
using UnityEngine.UIElements;

namespace Gloamvault
{
    /// <summary>
    /// The Rules check screen (Phase 10): the golden delves played by the rules engine inside the app, one row a case —
    /// waiting, running, "same as the computer" or where it differed — with the times, and the start-up at the top.
    /// The check runs on a worker thread with a deep stack (an interpreter recurses), so the title's torches and the
    /// speed overlay keep drawing; the thread hands its progress to <see cref="Update"/> through a queue.
    /// </summary>
    public sealed class RulesCheckScreen : MonoBehaviour
    {
        const int StackBytes = 16 * 1024 * 1024;

        /// <summary>True once a run has finished (every case done, or stopped).</summary>
        public bool Done { get; private set; }
        public IReadOnlyList<RulesCheck.CaseResult> Results => results;

        UIDocument document;
        VisualElement title, container, rules;
        readonly List<VisualElement> hidden = new();
        readonly Dictionary<string, (Label status, Label time)> rows = new();
        Label startupLabel, verdictLabel;
        Button againButton;
        readonly ConcurrentQueue<Action> toMain = new();
        readonly List<RulesCheck.CaseResult> results = new();
        RulesCheck.GoldenFile golden;
        JintSim.Assets assets;
        Thread worker;
        volatile bool cancel;
        string onlyCase;

        /// <summary>Opens the screen over the title; starts the check at once when <paramref name="run"/>.</summary>
        public static RulesCheckScreen Open(UIDocument document, bool run, string onlyCaseId = null)
        {
            var existing = document.GetComponent<RulesCheckScreen>();
            if (existing != null) return existing;
            var screen = document.gameObject.AddComponent<RulesCheckScreen>();
            screen.document = document;
            screen.onlyCase = onlyCaseId;
            screen.Build();
            if (run) screen.Run();
            return screen;
        }

        void Build()
        {
            var tree = Resources.Load<VisualTreeAsset>("UI/RulesCheck");
            if (tree == null) throw new InvalidOperationException("missing Resources/UI/RulesCheck.uxml");
            var root = document.rootVisualElement;
            title = root.Q("title");
            foreach (var name in new[] { "title__left", "menu" })
            {
                var e = title.Q(className: name);
                if (e == null) continue;
                hidden.Add(e);
                e.style.display = DisplayStyle.None;
            }
            var version = root.Q("version");
            if (version != null) { hidden.Add(version); version.style.display = DisplayStyle.None; }

            // The UXML's <Style> is carried by the container Instantiate returns, so the container stays in the tree
            // (pulling "rules" out of it loses the sheet); the sheet is added again by hand in case the path fails.
            container = tree.Instantiate();
            container.style.flexGrow = 1;
            container.style.alignSelf = Align.Stretch;
            container.style.flexDirection = FlexDirection.Column;
            title.Add(container);
            rules = container.Q("rules");
            var sheet = Resources.Load<StyleSheet>("UI/RulesCheck");
            if (sheet != null && !rules.styleSheets.Contains(sheet)) rules.styleSheets.Add(sheet);
            startupLabel = rules.Q<Label>("startup");
            verdictLabel = rules.Q<Label>("verdict");
            againButton = rules.Q<Button>("again");
            againButton.clicked += Run;
            rules.Q<Button>("back").clicked += Close;

            // The rows come from the golden file, so the screen and the check always list the same cases.
            assets = JintSim.Assets.Load();
            golden = RulesCheck.GoldenFile.Parse(assets.golden);
            var list = rules.Q("cases");
            foreach (var c in golden.cases)
            {
                if (onlyCase != null && c.id != onlyCase) continue;
                var row = new VisualElement();
                row.AddToClassList("case");
                var name = new Label($"{c.id} · {c.title}");
                name.AddToClassList("case__name");
                var status = new Label("waiting");
                status.AddToClassList("case__status");
                var time = new Label($"{c.steps} steps on the computer · {c.node.stepP95:0.0} ms a step");
                time.AddToClassList("case__time");
                row.Add(name);
                row.Add(status);
                row.Add(time);
                list.Add(row);
                rows[c.id] = (status, time);
            }
        }

        /// <summary>Starts (or restarts) the check: a fresh engine each time, so the start-up is measured again.</summary>
        public void Run()
        {
            if (worker != null && worker.IsAlive) return;
            Done = false;
            cancel = false;
            results.Clear();
            verdictLabel.text = "";
            againButton.SetEnabled(false);
            startupLabel.text = "Starting the rules engine…";
            foreach (var r in rows.Values) { r.status.text = "waiting"; r.status.ClearClassList(); r.status.AddToClassList("case__status"); }

            var script = assets.script;
            var content = assets.content;
            double loadMs = assets.loadMs;
            worker = new Thread(() => Work(script, content, loadMs), StackBytes) { IsBackground = true, Name = "gv-rules" };
            worker.Start();
        }

        void Work(string script, string content, double loadMs)
        {
            ISimEngine engine = null;
            try
            {
                engine = new JintSim(script, content, loadMs);
                var s = engine.Startup;
                toMain.Enqueue(() => startupLabel.text =
                    $"{engine.Name} ready in {s.TotalMs / 1000:0.0} s — read {s.loadMs:0} ms · run {s.runMs:0} ms · content {s.initMs:0} ms " +
                    $"(the computer: {golden.node.runMs:0} + {golden.node.initMs:0} ms)");
                var list = RulesCheck.Run(engine, golden, OnProgress, () => cancel, onlyCase);
                toMain.Enqueue(() => Finish(list, null));
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                toMain.Enqueue(() => Finish(new List<RulesCheck.CaseResult>(), e.Message));
            }
            finally
            {
                engine?.Dispose();
            }
        }

        void OnProgress(RulesCheck.GoldenCase c, float fraction, RulesCheck.CaseResult result)
        {
            toMain.Enqueue(() =>
            {
                if (!rows.TryGetValue(c.id, out var row)) return;
                if (result == null)
                {
                    row.status.text = $"running · {fraction * 100:0}%";
                    return;
                }
                row.status.ClearClassList();
                row.status.AddToClassList("case__status");
                if (result.same)
                {
                    row.status.text = "✓ same as the computer";
                    row.status.AddToClassList("case__status--same");
                }
                else if (result.error != null)
                {
                    row.status.text = "✗ " + result.error;
                    row.status.AddToClassList("case__status--differs");
                }
                else
                {
                    row.status.text = $"✗ differs at step {result.differsAt}";
                    row.status.AddToClassList("case__status--differs");
                }
                row.time.text = $"{result.steps} steps in {result.totalMs / 1000:0.0} s · a step {result.stepP50:0.0} ms, slowest 5% {result.stepP95:0.0} ms, worst {result.stepMax:0} ms " +
                                $"(the computer: {c.node.stepP95:0.0} ms)";
            });
        }

        void Finish(List<RulesCheck.CaseResult> list, string error)
        {
            results.AddRange(list);
            Done = true;
            againButton.SetEnabled(true);
            if (error != null)
            {
                startupLabel.text = "The rules engine failed: " + error;
                verdictLabel.text = "✗ the rules could not run";
                return;
            }
            // The speed verdict is about a hero's turn (hand mode); auto mode plays whole fights in one step by design.
            int same = 0;
            double worst = 0;
            foreach (var r in list) { if (r.same) same++; if (!r.golden.Auto && r.stepP95 > worst) worst = r.stepP95; }
            bool allSame = same == list.Count && list.Count > 0;
            verdictLabel.text = allSame
                ? (worst < 30 ? $"✓ every delve the same as the computer, and fast: a turn's slowest 5% at {worst:0} ms (the bar is 30)"
                              : $"✓ every delve the same as the computer; a turn's slowest 5% at {worst:0} ms, a little over the bar of 30")
                : $"✗ {list.Count - same} of {list.Count} delves differ from the computer";
        }

        void Update()
        {
            while (toMain.TryDequeue(out var action)) action();
        }

        void Close()
        {
            cancel = true;
            container?.RemoveFromHierarchy();
            foreach (var e in hidden) e.style.display = DisplayStyle.Flex;
            Destroy(this);
        }

        void OnDestroy()
        {
            cancel = true;
        }
    }
}

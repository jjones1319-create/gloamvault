using System;
using System.Collections.Generic;
using Gloamvault.Env;
using Gloamvault.Walk;
using UnityEngine;

namespace Gloamvault.Level
{
    /// <summary>
    /// The path of a traversal move (Phase 16, D-171), pure: where the hero is at t (0..1) between two points.
    /// A crawl and a squeeze go straight; a jump arcs; a climb humps up and over. The clip plays meanwhile.
    /// </summary>
    public static class TraversalPath
    {
        public const float CrawlMps = 0.8f;
        public const float SqueezeSeconds = 1.2f, JumpSeconds = 0.9f, ClimbSeconds = 1.2f;
        public const float JumpHeight = 0.7f, ClimbHeight = 1.3f;

        public static float Seconds(string kind, float distance) => kind switch
        {
            "crawl" => Mathf.Max(0.5f, distance / CrawlMps),
            "squeeze" => SqueezeSeconds,
            "jump" => JumpSeconds,
            _ => ClimbSeconds,
        };

        public static string Clip(string kind) => kind switch { "crawl" => "Crawl", "squeeze" => "Squeeze", "jump" => "Jump", _ => "Climb" };

        public static string Prompt(string kind) => kind switch { "crawl" => "Crawl under", "squeeze" => "Squeeze through", "jump" => "Jump", _ => "Climb" };

        static float Smooth(float t) => t * t * (3f - 2f * t);

        public static Vector3 Position(string kind, Vector3 from, Vector3 to, float t)
        {
            t = Mathf.Clamp01(t);
            switch (kind)
            {
                case "jump":
                    return Vector3.Lerp(from, to, t) + Vector3.up * (4f * JumpHeight * t * (1f - t));
                case "climb":
                    return Vector3.Lerp(from, to, Smooth(t)) + Vector3.up * (ClimbHeight * Mathf.Sin(Mathf.PI * t));
                case "squeeze":
                    return Vector3.Lerp(from, to, Smooth(t));
                default:
                    return Vector3.Lerp(from, to, t);
            }
        }
    }

    /// <summary>A traversal spot in the world: the obstacle, and an end on each side the hero presses A at.</summary>
    public sealed class Traversal
    {
        public FloorSpotDef def;
        public Vector3 endA, endB;
        public readonly List<TraversalEnd> ends = new();
        public bool Busy { get; private set; }
        public event Action<Traversal> OnDone;

        /// <summary>Builds the two ends under the room: A on the axis' negative side, B on its positive side (Unity space).</summary>
        public static Traversal Make(Transform parent, FloorSpotDef def, Vector3 centre, Vector3 axisDir, float length)
        {
            var t = new Traversal { def = def };
            t.endA = centre - axisDir * (length / 2f);
            t.endB = centre + axisDir * (length / 2f);
            foreach (var (name, at, other) in new[] { ("A", t.endA, t.endB), ("B", t.endB, t.endA) })
            {
                var go = new GameObject($"Traverse {def.kind} {name}");
                go.transform.SetParent(parent, false);
                go.transform.position = at;
                var e = go.AddComponent<TraversalEnd>();
                e.traversal = t; e.from = at; e.to = other;
                t.ends.Add(e);
            }
            return t;
        }

        public bool Start(HeroMover mover, Vector3 from, Vector3 to)
        {
            if (Busy || mover == null || mover.Scripted) return false;
            Busy = true;
            float seconds = TraversalPath.Seconds(def.kind, Vector3.Distance(from, to));
            string kind = def.kind;
            mover.BeginScripted(t => TraversalPath.Position(kind, from, to, t), seconds, TraversalPath.Clip(kind), (to - from).normalized, () => { Busy = false; OnDone?.Invoke(this); });
            GvLog.Line("traverse", ("kind", kind), ("seconds", seconds));
            return true;
        }
    }

    /// <summary>One end of a traversal: stand here, press A, the hero goes to the other end.</summary>
    public sealed class TraversalEnd : MonoBehaviour, IInteractable
    {
        public Traversal traversal;
        public Vector3 from, to;
        /// <summary>The hero's mover, set by the screen when the end is listed.</summary>
        public HeroMover mover;

        public Vector3 Position => from;
        public string Prompt => traversal != null ? TraversalPath.Prompt(traversal.def.kind) : "";
        public bool Available => traversal != null && !traversal.Busy;
        public bool Act() => traversal != null && traversal.Start(mover, from, to);
    }
}

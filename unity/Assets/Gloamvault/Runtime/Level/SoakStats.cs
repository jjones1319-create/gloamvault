using System;
using System.Collections.Generic;

namespace Gloamvault.Level
{
    /// <summary>The soak's numbers (Phase 14): the overlay's one-a-second samples kept, and their p50 / p95 / peaks for the soak-done line.</summary>
    public sealed class SoakStats
    {
        public readonly List<float> fps = new(), ms = new(), cpu = new(), gpu = new();
        public readonly List<long> draws = new(), tris = new(), mem = new();
        public int WorstThermal = -1;
        public float LowestHeadroom = float.NaN;
        public int Samples => fps.Count;

        public void Add(PerfOverlay.Sample s)
        {
            fps.Add(s.Fps); ms.Add(s.AvgMs);
            if (!float.IsNaN(s.CpuMs)) cpu.Add(s.CpuMs);
            if (!float.IsNaN(s.GpuMs)) gpu.Add(s.GpuMs);
            if (s.DrawCalls >= 0) draws.Add(s.DrawCalls);
            if (s.Triangles >= 0) tris.Add(s.Triangles);
            if (s.MemMb >= 0) mem.Add(s.MemMb);
            if (s.Thermal > WorstThermal) WorstThermal = s.Thermal;
            if (!float.IsNaN(s.Headroom) && (float.IsNaN(LowestHeadroom) || s.Headroom > LowestHeadroom)) LowestHeadroom = s.Headroom;
        }

        /// <summary>A quantile by linear interpolation between the sorted values (q in 0..1); NaN when empty.</summary>
        public static float Percentile(IReadOnlyList<float> values, float q)
        {
            if (values.Count == 0) return float.NaN;
            var a = new float[values.Count];
            for (int i = 0; i < a.Length; i++) a[i] = values[i];
            Array.Sort(a);
            float idx = Math.Clamp(q, 0f, 1f) * (a.Length - 1);
            int lo = (int)Math.Floor(idx), hi = (int)Math.Ceiling(idx);
            return a[lo] + (a[hi] - a[lo]) * (idx - lo);
        }

        public static float Percentile(IReadOnlyList<long> values, float q)
        {
            var f = new List<float>(values.Count);
            foreach (var v in values) f.Add(v);
            return Percentile(f, q);
        }

        public static long Max(IReadOnlyList<long> values)
        {
            long m = -1;
            foreach (var v in values) if (v > m) m = v;
            return m;
        }

        public (string key, object value)[] Fields() => new (string, object)[]
        {
            ("samples", Samples),
            ("fpsP50", Percentile(fps, 0.5f)), ("fpsLow5", Percentile(fps, 0.05f)),
            ("msP50", Percentile(ms, 0.5f)), ("msP95", Percentile(ms, 0.95f)),
            ("cpuP95", Percentile(cpu, 0.95f)),
            ("gpuP50", Percentile(gpu, 0.5f)), ("gpuP95", Percentile(gpu, 0.95f)),
            ("drawsP95", Percentile(draws, 0.95f)), ("trisP95", Percentile(tris, 0.95f)),
            ("memPeakMb", Max(mem)),
            ("worstThermal", WorstThermal), ("highestHeadroom", LowestHeadroom),
        };
    }
}

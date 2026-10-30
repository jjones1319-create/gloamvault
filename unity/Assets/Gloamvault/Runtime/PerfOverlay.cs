using Unity.Profiling;
using UnityEngine;
using UnityEngine.UIElements;

namespace Gloamvault
{
    /// <summary>
    /// The speed overlay (10-TECH-PLAN §4; a Settings toggle on the web, a title button here until Settings arrive in
    /// Phase 22): fps, frame time and its p95, CPU and GPU time where the phone reports them, draw calls and
    /// triangles where the build reports them, memory, and the thermal state. Whether it shows or not, it writes one
    /// <c>[gv] {"k":"perf",…}</c> line a second to the phone log, which is how Claude reads the phone (D-138).
    /// </summary>
    public sealed class PerfOverlay : MonoBehaviour
    {
        const string PrefKey = "gv.overlay";
        const int Window = 240;

        public UIDocument document;

        public struct Sample
        {
            public float Fps, AvgMs, P95Ms, CpuMs, GpuMs;
            public long DrawCalls, Triangles, MemMb;
            public int Thermal;
            public float Headroom;
        }

        public Sample Last { get; private set; }
        public int SampleCount { get; private set; }
        public bool Visible { get; private set; }

        readonly float[] frames = new float[Window];
        readonly FrameTiming[] timings = new FrameTiming[1];
        readonly ThermalProbe thermal = new();
        int frameCount, head;
        float secondTimer, thermalTimer = 4f, startTime;
        ProfilerRecorder drawCalls, triangles, totalMemory;
        Label label;

        void OnEnable()
        {
            drawCalls = ProfilerRecorder.StartNew(ProfilerCategory.Render, "Draw Calls Count");
            triangles = ProfilerRecorder.StartNew(ProfilerCategory.Render, "Triangles Count");
            totalMemory = ProfilerRecorder.StartNew(ProfilerCategory.Memory, "Total Used Memory");
            startTime = Time.realtimeSinceStartup;
        }

        void Start()
        {
            if (document != null) label = document.rootVisualElement.Q<Label>("perf");
            SetVisible(PlayerPrefs.GetInt(PrefKey, 0) == 1);
        }

        void OnDisable()
        {
            drawCalls.Dispose();
            triangles.Dispose();
            totalMemory.Dispose();
        }

        /// <summary>Raised when the overlay is shown or hidden (the title's button shows the state).</summary>
        public event System.Action<bool> VisibleChanged;

        public void SetVisible(bool visible)
        {
            Visible = visible;
            VisibleChanged?.Invoke(visible);
            PlayerPrefs.SetInt(PrefKey, visible ? 1 : 0);
            if (label != null) label.style.display = visible ? DisplayStyle.Flex : DisplayStyle.None;
        }

        public void Toggle() => SetVisible(!Visible);

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            frames[head] = dt;
            head = (head + 1) % Window;
            if (frameCount < Window) frameCount++;
            FrameTimingManager.CaptureFrameTimings();

            thermalTimer += dt;
            if (thermalTimer >= 5f)
            {
                thermalTimer = 0;
                thermal.Sample();
            }

            secondTimer += dt;
            if (secondTimer < 1f) return;
            secondTimer = 0;

            // The last second's frames (or fewer at start-up).
            int n = 0;
            float covered = 0;
            var recent = new float[frameCount];
            for (int i = 1; i <= frameCount && covered < 1f; i++)
            {
                float f = frames[(head - i + Window) % Window];
                recent[n++] = f;
                covered += f;
            }
            var span = new System.ReadOnlySpan<float>(recent, 0, n);

            var s = new Sample
            {
                Fps = PerfMath.Fps(span),
                AvgMs = covered / Mathf.Max(1, n) * 1000f,
                P95Ms = PerfMath.QuantileMs(span, 0.95f),
                CpuMs = float.NaN,
                GpuMs = float.NaN,
                DrawCalls = drawCalls.Valid ? drawCalls.LastValue : -1,
                Triangles = triangles.Valid ? triangles.LastValue : -1,
                MemMb = totalMemory.Valid ? totalMemory.LastValue / (1024 * 1024) : -1,
                Thermal = thermal.Status,
                Headroom = thermal.Headroom,
            };
            if (FrameTimingManager.GetLatestTimings(1, timings) > 0)
            {
                s.CpuMs = (float)timings[0].cpuFrameTime;
                s.GpuMs = timings[0].gpuFrameTime > 0 ? (float)timings[0].gpuFrameTime : float.NaN;
            }
            Last = s;
            SampleCount++;

            GvLog.Line("perf",
                ("t", Mathf.RoundToInt(Time.realtimeSinceStartup - startTime)),
                ("fps", s.Fps), ("ms", s.AvgMs), ("p95", s.P95Ms), ("cpu", s.CpuMs), ("gpu", s.GpuMs),
                ("draws", s.DrawCalls), ("tris", s.Triangles), ("memMb", s.MemMb),
                ("thermal", s.Thermal), ("headroom", s.Headroom));

            if (label != null && Visible) label.text = Describe(s);
        }

        static string Describe(Sample s)
        {
            string ms(float v) => float.IsNaN(v) ? "—" : v.ToString("0.0");
            string count(long v) => v < 0 ? "—" : PerfMath.Short(v);
            string mem(long mb) => mb < 0 ? "—" : mb >= 1024 ? (mb / 1024f).ToString("0.0") + " GB" : mb + " MB";
            return $"{s.Fps:0} fps · {s.AvgMs:0.0} ms (p95 {s.P95Ms:0.0}) · CPU {ms(s.CpuMs)} · GPU {ms(s.GpuMs)}\n" +
                   $"{count(s.DrawCalls)} draws · {count(s.Triangles)} tris · {mem(s.MemMb)} · {ThermalProbe.StatusName(s.Thermal)}";
        }
    }
}

using System;

namespace Gloamvault
{
    /// <summary>The speed overlay's arithmetic, kept pure so EditMode tests can check it.</summary>
    public static class PerfMath
    {
        /// <summary>Frames per second over a window of frame times (seconds).</summary>
        public static float Fps(ReadOnlySpan<float> frameSeconds)
        {
            float total = 0;
            foreach (var s in frameSeconds) total += s;
            return total > 0 ? frameSeconds.Length / total : 0;
        }

        /// <summary>
        /// The q-quantile (0–1) of frame times in milliseconds, nearest-rank: the frame time that q of the frames are
        /// at or under. The p95 shows a stutter the average hides.
        /// </summary>
        public static float QuantileMs(ReadOnlySpan<float> frameSeconds, float q)
        {
            if (frameSeconds.Length == 0) return 0;
            var sorted = frameSeconds.ToArray();
            Array.Sort(sorted);
            int rank = (int)MathF.Ceiling(q * sorted.Length) - 1;
            rank = Math.Clamp(rank, 0, sorted.Length - 1);
            return sorted[rank] * 1000f;
        }

        /// <summary>A short count for the overlay: 950, 12.4k, 1.2M.</summary>
        public static string Short(long n)
        {
            if (n < 1000) return n.ToString();
            if (n < 1_000_000) return (n / 1000f).ToString(n < 10_000 ? "0.0" : "0") + "k";
            return (n / 1_000_000f).ToString("0.0") + "M";
        }
    }
}

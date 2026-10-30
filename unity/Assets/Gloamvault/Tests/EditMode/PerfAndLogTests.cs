using System.Linq;
using NUnit.Framework;

namespace Gloamvault.Tests
{
    public class PerfMathTests
    {
        [Test]
        public void SixtyEvenFramesAreSixtyFps()
        {
            var frames = Enumerable.Repeat(1f / 60f, 60).ToArray();
            Assert.AreEqual(60f, PerfMath.Fps(frames), 0.01f);
        }

        [Test]
        public void P95IgnoresTheRareSlowFrameButP99SeesIt()
        {
            var frames = Enumerable.Repeat(0.016f, 95).Concat(Enumerable.Repeat(0.050f, 5)).ToArray();
            Assert.AreEqual(16f, PerfMath.QuantileMs(frames, 0.95f), 0.01f);
            Assert.AreEqual(50f, PerfMath.QuantileMs(frames, 0.99f), 0.01f);
        }

        [Test]
        public void EmptyWindowsAreZero()
        {
            Assert.AreEqual(0f, PerfMath.Fps(new float[0]));
            Assert.AreEqual(0f, PerfMath.QuantileMs(new float[0], 0.95f));
        }

        [Test]
        public void ShortCounts()
        {
            Assert.AreEqual("950", PerfMath.Short(950));
            Assert.AreEqual("1.2k", PerfMath.Short(1234));
            Assert.AreEqual("138k", PerfMath.Short(138_400));
            Assert.AreEqual("1.5M", PerfMath.Short(1_500_000));
        }
    }

    public class GvLogTests
    {
        [Test]
        public void FormatsOneJsonLine()
        {
            string line = GvLog.Format("perf", ("fps", 59.94f), ("draws", 42L), ("ok", true), ("name", "a\"b"));
            Assert.AreEqual("[gv] {\"k\":\"perf\",\"fps\":59.94,\"draws\":42,\"ok\":true,\"name\":\"a\\\"b\"}", line);
        }

        [Test]
        public void NotANumberIsNull()
        {
            Assert.AreEqual("[gv] {\"k\":\"perf\",\"gpu\":null}", GvLog.Format("perf", ("gpu", float.NaN)));
        }
    }
}

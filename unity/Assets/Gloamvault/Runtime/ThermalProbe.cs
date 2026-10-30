using UnityEngine;

namespace Gloamvault
{
    /// <summary>
    /// How hot the phone is, from Android's PowerManager: the thermal status (0 none … 6 shutdown) and the thermal
    /// headroom (1.0 = about to throttle; NaN where the phone does not say). The S25 Ultra throttles to about half its
    /// GPU within minutes (02-RESEARCH), so the soak in Phase 14 reads these next to the frame times. Elsewhere: -1/NaN.
    /// </summary>
    public sealed class ThermalProbe
    {
        public int Status { get; private set; } = -1;
        public float Headroom { get; private set; } = float.NaN;

#if UNITY_ANDROID && !UNITY_EDITOR
        AndroidJavaObject powerManager;
        bool failed;

        public void Sample()
        {
            if (failed) return;
            try
            {
                if (powerManager == null)
                {
                    using var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                    using var activity = player.GetStatic<AndroidJavaObject>("currentActivity");
                    powerManager = activity.Call<AndroidJavaObject>("getSystemService", "power");
                }
                Status = powerManager.Call<int>("getCurrentThermalStatus");
                Headroom = powerManager.Call<float>("getThermalHeadroom", 10);
            }
            catch (System.Exception e)
            {
                failed = true;
                Debug.LogWarning("[gv] thermal probe unavailable: " + e.Message);
            }
        }
#else
        public void Sample() { }
#endif

        public static string StatusName(int status) => status switch
        {
            0 => "cool",
            1 => "warm",
            2 => "hot",
            3 => "very hot",
            4 => "critical",
            5 => "emergency",
            6 => "shutdown",
            _ => "—",
        };
    }
}

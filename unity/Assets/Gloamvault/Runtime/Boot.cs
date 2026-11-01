using UnityEngine;

namespace Gloamvault
{
    /// <summary>
    /// The app's start (Phase 9): 60 fps (D-003), landscape only, the screen kept awake while the game is open, and a
    /// boot line in the phone log naming the device, its graphics and the resolution the game runs at.
    /// </summary>
    public sealed class Boot : MonoBehaviour
    {
        public const string PhaseLabel = "Phase 15";
        public const string FpsPref = "gv.fps";

        /// <summary>
        /// The launch extra <c>gv</c> the app was started with, or "": <c>adb shell am start … --es gv rules</c> opens
        /// the Rules check and runs it, so Claude can run the check over USB (tools/unity/rules.ps1).
        /// </summary>
        public static string LaunchMode { get; private set; } = "";
        /// <summary>The frame rate asked for (D-156): 60 by default, 120 when chosen on the title or by the extra <c>--ei fps 120</c>.</summary>
        public static int TargetFps { get; private set; } = 60;
        /// <summary>The display's refresh rate in force (a 120 Hz screen may still hold a game at 60).</summary>
        public static double RefreshHz => Screen.currentResolution.refreshRateRatio.value;
        /// <summary>The soak's extras (Phase 14): <c>--ei minutes 10 --ei rooms 60 --ei seed 1</c>.</summary>
        public static int LaunchMinutes { get; private set; } = 10;
        public static int LaunchRooms { get; private set; } = 60;
        public static int LaunchSeed { get; private set; } = 1;

        void Awake()
        {
            LaunchMode = ReadExtra("gv") ?? "";
            LaunchMinutes = ReadExtraInt("minutes", 10);
            LaunchRooms = ReadExtraInt("rooms", 60);
            LaunchSeed = ReadExtraInt("seed", 1);
            // The default is the screen's own rate (D-156, measured at the Phase 13–15 install: a 60 target on the
            // 120 Hz S25 Edge clocks the GPU down and the frame pacing falls to 30; at 120 the level runs at 119.8).
            int fps = ReadExtraInt("fps", PlayerPrefs.GetInt(FpsPref, RefreshHz >= 119 ? 120 : 60));
            ApplyFrameRate(fps, remember: false);
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
            Screen.autorotateToPortrait = false;
            Screen.autorotateToPortraitUpsideDown = false;
            Screen.autorotateToLandscapeLeft = true;
            Screen.autorotateToLandscapeRight = true;
            Screen.orientation = ScreenOrientation.AutoRotation;

            GvLog.Line("boot",
                ("version", Application.version),
                ("phase", PhaseLabel),
                ("device", SystemInfo.deviceModel),
                ("gpu", SystemInfo.graphicsDeviceName),
                ("api", SystemInfo.graphicsDeviceType.ToString()),
                ("screen", $"{Screen.width}x{Screen.height}"),
                ("hz", RefreshHz),
                ("targetFps", TargetFps),
                ("memMb", SystemInfo.systemMemorySize),
                ("mode", LaunchMode));
        }

        /// <summary>
        /// 30, 60 or 120 (D-156). Swappy (Optimized Frame Pacing) paces at multiples of the display's current refresh
        /// period, so 120 also asks the display for its 120 Hz mode when it is not already in force; a phone that holds
        /// games at 60 simply stays there (the log's hz says which).
        /// </summary>
        public static void ApplyFrameRate(int fps, bool remember = true)
        {
            fps = fps >= 120 ? 120 : fps <= 30 ? 30 : 60;
            TargetFps = fps;
            Application.targetFrameRate = fps;
            QualitySettings.vSyncCount = 0;
            if (remember) { PlayerPrefs.SetInt(FpsPref, fps); PlayerPrefs.Save(); }
#if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                if (fps >= 120 && RefreshHz < 119)
                {
                    foreach (var r in Screen.resolutions)
                    {
                        if (r.refreshRateRatio.value < 119) continue;
                        Screen.SetResolution(Screen.width, Screen.height, FullScreenMode.FullScreenWindow, r.refreshRateRatio);
                        break;
                    }
                }
            }
            catch (System.Exception e) { Debug.LogWarning("120 Hz mode: " + e.Message); }
#endif
            GvLog.Line("fps", ("target", fps), ("hz", RefreshHz));
        }

        static string ReadExtra(string key)
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                using var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                using var activity = player.GetStatic<AndroidJavaObject>("currentActivity");
                using var intent = activity.Call<AndroidJavaObject>("getIntent");
                return intent.Call<string>("getStringExtra", key);
            }
            catch (System.Exception)
            {
                return null;
            }
#else
            return null;
#endif
        }

        static int ReadExtraInt(string key, int fallback)
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                using var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                using var activity = player.GetStatic<AndroidJavaObject>("currentActivity");
                using var intent = activity.Call<AndroidJavaObject>("getIntent");
                return intent.Call<int>("getIntExtra", key, fallback);
            }
            catch (System.Exception)
            {
                return fallback;
            }
#else
            return fallback;
#endif
        }
    }
}

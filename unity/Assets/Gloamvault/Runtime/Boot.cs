using UnityEngine;

namespace Gloamvault
{
    /// <summary>
    /// The app's start (Phase 9): 60 fps (D-003), landscape only, the screen kept awake while the game is open, and a
    /// boot line in the phone log naming the device, its graphics and the resolution the game runs at.
    /// </summary>
    public sealed class Boot : MonoBehaviour
    {
        public const string PhaseLabel = "Phase 13";

        /// <summary>
        /// The launch extra <c>gv</c> the app was started with, or "": <c>adb shell am start … --es gv rules</c> opens
        /// the Rules check and runs it, so Claude can run the check over USB (tools/unity/rules.ps1).
        /// </summary>
        public static string LaunchMode { get; private set; } = "";

        void Awake()
        {
            LaunchMode = ReadLaunchMode();
            Application.targetFrameRate = 60;
            QualitySettings.vSyncCount = 0;
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
                ("hz", Screen.currentResolution.refreshRateRatio.value),
                ("memMb", SystemInfo.systemMemorySize),
                ("mode", LaunchMode));
        }

        static string ReadLaunchMode()
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                using var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                using var activity = player.GetStatic<AndroidJavaObject>("currentActivity");
                using var intent = activity.Call<AndroidJavaObject>("getIntent");
                return intent.Call<string>("getStringExtra", "gv") ?? "";
            }
            catch (System.Exception)
            {
                return "";
            }
#else
            return "";
#endif
        }
    }
}

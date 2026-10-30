using UnityEngine;

namespace Gloamvault
{
    /// <summary>
    /// The app's start (Phase 9): 60 fps (D-003), landscape only, the screen kept awake while the game is open, and a
    /// boot line in the phone log naming the device, its graphics and the resolution the game runs at.
    /// </summary>
    public sealed class Boot : MonoBehaviour
    {
        public const string PhaseLabel = "Phase 9";

        void Awake()
        {
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
                ("memMb", SystemInfo.systemMemorySize));
        }
    }
}

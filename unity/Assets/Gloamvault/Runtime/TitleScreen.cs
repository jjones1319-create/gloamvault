using UnityEngine;
using UnityEngine.UIElements;

namespace Gloamvault
{
    /// <summary>
    /// The title (Phase 9): the wordmark, the menu — New game and Settings arrive with saves in Phase 22 — the speed
    /// overlay's button, and the version line. Keeps the menu inside the phone's safe area (the camera hole).
    /// </summary>
    public sealed class TitleScreen : MonoBehaviour
    {
        public UIDocument document;
        public PerfOverlay overlay;

        VisualElement root;
        Rect lastSafeArea;

        // Start, not OnEnable: the UIDocument builds its tree in its own OnEnable.
        void Start()
        {
            root = document.rootVisualElement.Q("title");
            document.rootVisualElement.Q<Label>("version").text =
                $"v{Application.version} · {Boot.PhaseLabel} · Unity";
            var overlayButton = document.rootVisualElement.Q<Button>("overlay");
            overlayButton.clicked += () => overlay.Toggle();
            overlay.VisibleChanged += _ => SetOverlayLabel(overlayButton);
            SetOverlayLabel(overlayButton);
            // Phase 10: the Rules check — the golden delves played by the rules engine inside the app (D-139).
            document.rootVisualElement.Q<Button>("rules").clicked += () => RulesCheckScreen.Open(document, run: true);
            if (Boot.LaunchMode == "rules") RulesCheckScreen.Open(document, run: true);
            lastSafeArea = Rect.zero;
        }

        void SetOverlayLabel(Button b) => b.text = overlay != null && overlay.Visible ? "Speed overlay: on" : "Speed overlay: off";

        void Update()
        {
            var safe = Screen.safeArea;
            if (safe == lastSafeArea || root?.panel == null) return;
            lastSafeArea = safe;
            // Screen pixels → panel units; the inset is padding on top of the layout's own.
            float scale = root.panel.visualTree.layout.width / Mathf.Max(1, Screen.width);
            if (float.IsNaN(scale) || scale <= 0) return;
            root.style.paddingLeft = 28 + safe.xMin * scale;
            root.style.paddingRight = 28 + (Screen.width - safe.xMax) * scale;
            root.style.paddingTop = 16 + (Screen.height - safe.yMax) * scale;
            root.style.paddingBottom = 12 + safe.yMin * scale;
        }
    }
}

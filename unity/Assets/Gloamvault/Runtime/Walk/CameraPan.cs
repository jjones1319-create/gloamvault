using System;
using UnityEngine;
using UnityEngine.UIElements;

namespace Gloamvault.Walk
{
    /// <summary>
    /// The second finger (D-168): a drag anywhere on the right half of the screen — under the buttons, around A —
    /// turns the follow camera, so you look where you want while the left thumb walks. UI Toolkit, like the stick.
    /// </summary>
    public sealed class CameraPan
    {
        public const float DegreesPerPixel = 0.22f;

        public bool Held { get; private set; }
        public float Panned { get; private set; }
        readonly VisualElement zone;
        readonly Func<FollowCamera> camera;
        int pointer = -1;
        float lastX;

        public CameraPan(VisualElement zone, Func<FollowCamera> camera)
        {
            this.zone = zone; this.camera = camera;
            if (zone == null) return;
            zone.RegisterCallback<PointerDownEvent>(OnDown);
            zone.RegisterCallback<PointerMoveEvent>(OnMove);
            zone.RegisterCallback<PointerUpEvent>(OnUp);
            zone.RegisterCallback<PointerCancelEvent>(_ => Release());
            zone.RegisterCallback<PointerCaptureOutEvent>(_ => Release());
        }

        void OnDown(PointerDownEvent e)
        {
            if (pointer >= 0) return;
            pointer = e.pointerId;
            zone.CapturePointer(pointer);
            lastX = e.position.x;
            Held = true;
            e.StopPropagation();
        }

        void OnMove(PointerMoveEvent e)
        {
            if (e.pointerId != pointer) return;
            float dx = e.position.x - lastX;
            lastX = e.position.x;
            Drag(dx);
            e.StopPropagation();
        }

        void OnUp(PointerUpEvent e)
        {
            if (e.pointerId != pointer) return;
            zone.ReleasePointer(pointer);
            Release();
            e.StopPropagation();
        }

        void Release() { pointer = -1; Held = false; }

        /// <summary>Pixels of drag → degrees of camera; also the tests' and the keyboard's way in.</summary>
        public void Drag(float pixels)
        {
            var cam = camera();
            if (cam == null || Mathf.Abs(pixels) < 0.01f) return;
            float deg = pixels * DegreesPerPixel;
            cam.Nudge(deg);
            Panned += Mathf.Abs(deg);
        }
    }
}

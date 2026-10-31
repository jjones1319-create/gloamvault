using UnityEngine;
using UnityEngine.UIElements;

namespace Gloamvault.Walk
{
    /// <summary>
    /// The on-screen stick (Phase 13, D-136): a ring at the bottom-left with a knob. A pointer down anywhere in its
    /// zone puts the ring under the thumb; the knob follows within the ring's radius and gives a vector in −1..1;
    /// the pointer's release returns it to the centre. Pure UI Toolkit, so it works in the Editor's shots and tests
    /// (which push it by code) and on the phone's touch screen alike.
    /// </summary>
    public sealed class VirtualStick
    {
        public Vector2 Value { get; private set; }
        public bool Held { get; private set; }
        readonly VisualElement zone, ring, knob;
        readonly float radius;
        int pointer = -1;
        Vector2 centre;

        public VirtualStick(VisualElement zone, VisualElement ring, VisualElement knob, float radiusPx = 70f)
        {
            this.zone = zone; this.ring = ring; this.knob = knob; radius = radiusPx;
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
            centre = (Vector2)e.localPosition;
            // The ring goes where the thumb landed, inside the zone.
            ring.style.left = centre.x - ring.resolvedStyle.width / 2f;
            ring.style.top = centre.y - ring.resolvedStyle.height / 2f;
            Held = true;
            Set(Vector2.zero);
            e.StopPropagation();
        }

        void OnMove(PointerMoveEvent e)
        {
            if (e.pointerId != pointer) return;
            var d = (Vector2)e.localPosition - centre;
            if (d.magnitude > radius) d = d.normalized * radius;
            Set(new Vector2(d.x / radius, -d.y / radius));
            e.StopPropagation();
        }

        void OnUp(PointerUpEvent e)
        {
            if (e.pointerId != pointer) return;
            zone.ReleasePointer(pointer);
            Release();
            e.StopPropagation();
        }

        void Release()
        {
            pointer = -1;
            Held = false;
            Set(Vector2.zero);
        }

        /// <summary>Also the tests' and the keyboard's way in.</summary>
        public void Set(Vector2 v)
        {
            Value = Vector2.ClampMagnitude(v, 1f);
            knob.style.translate = new Translate(Value.x * radius, -Value.y * radius);
        }
    }
}

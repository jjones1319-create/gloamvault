using Gloamvault.Characters;
using UnityEngine;

namespace Gloamvault.Walk
{
    /// <summary>
    /// Walks a character (Phase 13, D-136): a CharacterController driven by the stick, camera-relative; a walk band
    /// below 0.55 of the stick and a run above it (the web's 1.7 and 3.2 m/s); the hero turns toward its motion; the
    /// walk and run cycles are timed to the metres covered, as the web did (clip speed = metres per loop at 1×).
    /// </summary>
    public sealed class HeroMover : MonoBehaviour
    {
        public const float WalkMps = 1.7f;
        public const float RunMps = 3.2f;
        public const float WalkBand = 0.55f;
        public const float TurnDegPerSec = 540f;

        public Character character;
        public CharacterController controller;
        public Vector2 stick;
        public float cameraYaw;
        public float Speed { get; private set; }
        public string Clip { get; private set; } = "Idle";
        Vector3 velocity;

        public static HeroMover Attach(Character c)
        {
            var m = c.root.AddComponent<HeroMover>();
            m.character = c;
            var cc = c.root.AddComponent<CharacterController>();
            float s = Mathf.Max(0.3f, c.rootScale);
            cc.radius = 0.32f;
            cc.height = Mathf.Max(1.0f, c.height / s);
            cc.center = new Vector3(0, cc.height / 2f, 0);
            cc.slopeLimit = 50f;
            cc.stepOffset = 0.3f;
            cc.skinWidth = 0.04f;
            m.controller = cc;
            return m;
        }

        /// <summary>The wanted ground speed for a stick deflection (the web's bands).</summary>
        public static float SpeedFor(float magnitude)
        {
            float m = Mathf.Clamp01(magnitude);
            if (m < 0.08f) return 0f;
            if (m < WalkBand) return WalkMps * Mathf.Clamp01(m / WalkBand * 1.2f);
            return Mathf.Lerp(WalkMps, RunMps, (m - WalkBand) / (1f - WalkBand));
        }

        /// <summary>The world direction of a stick push relative to a camera yaw (degrees about +y).</summary>
        public static Vector3 DirectionFor(Vector2 stick, float cameraYawDeg)
        {
            var rot = Quaternion.Euler(0, cameraYawDeg, 0);
            var d = rot * new Vector3(stick.x, 0, stick.y);
            return d.sqrMagnitude > 1e-6f ? d.normalized : Vector3.zero;
        }

        void Update()
        {
            if (controller == null) return;
            float dt = Time.deltaTime;
            float wanted = SpeedFor(stick.magnitude);
            var dir = DirectionFor(stick, cameraYaw);
            if (wanted > 0f && dir != Vector3.zero)
            {
                var face = Quaternion.LookRotation(dir, Vector3.up);
                transform.rotation = Quaternion.RotateTowards(transform.rotation, face, TurnDegPerSec * dt);
            }
            var planar = dir * wanted;
            velocity.x = planar.x; velocity.z = planar.z;
            velocity.y = controller.isGrounded ? -1f : velocity.y - 9.81f * dt;
            controller.Move(velocity * dt);
            var moved = controller.velocity; moved.y = 0;
            Speed = moved.magnitude;
            Animate();
        }

        void Animate()
        {
            var a = character?.animator;
            if (a == null) return;
            string want = Speed < 0.05f ? "Idle" : Speed < 2.2f ? "Walk" : "Run";
            if (want != Clip) { a.Play(want); Clip = want; }
            if (want != "Idle")
            {
                float mps = a.MetresPerSecond(want);
                float stride = Mathf.Max(0.3f, character.rootScale);
                if (mps > 0) a.SetTimeScale(Mathf.Clamp(Speed / (mps * stride), 0.6f, 2f));
            }
        }
    }
}

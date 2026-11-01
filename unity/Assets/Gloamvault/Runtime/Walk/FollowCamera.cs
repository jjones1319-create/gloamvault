using UnityEngine;

namespace Gloamvault.Walk
{
    /// <summary>
    /// The exploring camera (Phase 13, D-159): third person, behind and above the hero, with three distances you cycle
    /// — close (over the shoulder), normal, far (pulled back and higher, to read a cave). Its yaw follows the hero's
    /// heading with a lag, so a turn swings the view round; it looks at the hero's chest; a sphere-cast from there
    /// toward the wanted spot pulls it in before a wall, so the hero is never hidden. A second finger pans it
    /// (D-168): a nudge turns it and holds it until the hero walks on, when it eases back behind him.
    /// </summary>
    public sealed class FollowCamera : MonoBehaviour
    {
        public enum Distance { Close, Normal, Far }

        public struct Setting { public float back, up, pitch; }
        public static readonly Setting[] Settings =
        {
            new() { back = 2.4f, up = 1.3f, pitch = 8f },
            new() { back = 4.6f, up = 2.6f, pitch = 18f },
            new() { back = 7.8f, up = 4.8f, pitch = 32f },
        };

        /// <summary>After a pan the camera holds for this long, then follows again once the hero is walking.</summary>
        public const float HoldSeconds = 1.5f;
        public const float MovingSpeed = 0.15f;

        public Transform target;
        public float targetHeight = 1.2f;
        public Distance distance = Distance.Normal;
        public float yawLagSeconds = 0.6f;
        public float moveLagSeconds = 0.12f;
        public LayerMask blockers = ~0;
        /// <summary>The hero's ground speed, set by the screen each frame: a held pan releases only once he walks.</summary>
        public float heroSpeed;
        public float Yaw { get; private set; }
        public bool Holding { get; private set; }
        Camera cam;
        bool snapped;
        float manualUntil;

        public static FollowCamera Attach(Camera camera, Transform target, float height)
        {
            var f = camera.gameObject.GetComponent<FollowCamera>() ?? camera.gameObject.AddComponent<FollowCamera>();
            f.cam = camera;
            f.target = target;
            f.targetHeight = Mathf.Clamp(height * 0.62f, 0.6f, 2.5f);
            f.Yaw = target.eulerAngles.y;
            f.snapped = false;
            f.Holding = false;
            camera.fieldOfView = 40f;
            camera.nearClipPlane = 0.1f;
            return f;
        }

        public void Cycle() => distance = (Distance)(((int)distance + 1) % 3);
        public string Label => distance switch { Distance.Close => "close", Distance.Far => "far", _ => "normal" };

        /// <summary>A pan (D-168): turns the camera by the degrees and holds it there.</summary>
        public void Nudge(float degrees)
        {
            Yaw = Mathf.Repeat(Yaw + degrees, 360f);
            manualUntil = Time.time + HoldSeconds;
            Holding = true;
        }

        /// <summary>Jump straight behind the hero on the next frame (a teleport, the tests).</summary>
        public void Snap() { snapped = false; Holding = false; manualUntil = 0f; }

        void LateUpdate()
        {
            if (target == null || cam == null) return;
            var s = Settings[(int)distance];
            if (Holding && Time.time >= manualUntil && heroSpeed > MovingSpeed) Holding = false;
            if (!Holding)
            {
                float wantedYaw = target.eulerAngles.y;
                float k = snapped ? 1f - Mathf.Exp(-Time.deltaTime / yawLagSeconds) : 1f;
                Yaw = Mathf.LerpAngle(Yaw, wantedYaw, k);
            }
            var look = target.position + Vector3.up * targetHeight;
            var back = Quaternion.Euler(0, Yaw, 0) * Vector3.back;
            var wanted = look + back * s.back + Vector3.up * s.up;
            // Pull in before a wall: a sphere from the look point toward the wanted spot.
            var dir = wanted - look;
            float dist = dir.magnitude;
            if (dist > 0.01f && Physics.SphereCast(look, 0.25f, dir / dist, out var hit, dist, blockers, QueryTriggerInteraction.Ignore))
            {
                if (hit.transform != target && !hit.transform.IsChildOf(target)) wanted = look + dir / dist * Mathf.Max(0.5f, hit.distance - 0.1f);
            }
            float m = snapped ? 1f - Mathf.Exp(-Time.deltaTime / moveLagSeconds) : 1f;
            cam.transform.position = Vector3.Lerp(cam.transform.position, wanted, m);
            cam.transform.rotation = Quaternion.LookRotation(look - cam.transform.position, Vector3.up);
            snapped = true;
        }
    }
}

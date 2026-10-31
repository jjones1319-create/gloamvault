using UnityEngine;

namespace Gloamvault.Walk
{
    /// <summary>
    /// The exploring camera (Phase 13, D-159): third person, behind and above the hero, with three distances you cycle
    /// — close (over the shoulder), normal, far (pulled back and higher, to read a cave). Its yaw follows the hero's
    /// heading with a lag, so a turn swings the view round; it looks at the hero's chest; a sphere-cast from there
    /// toward the wanted spot pulls it in before a wall, so the hero is never hidden.
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

        public Transform target;
        public float targetHeight = 1.2f;
        public Distance distance = Distance.Normal;
        public float yawLagSeconds = 0.6f;
        public float moveLagSeconds = 0.12f;
        public LayerMask blockers = ~0;
        public float Yaw { get; private set; }
        Camera cam;
        bool snapped;

        public static FollowCamera Attach(Camera camera, Transform target, float height)
        {
            var f = camera.gameObject.GetComponent<FollowCamera>() ?? camera.gameObject.AddComponent<FollowCamera>();
            f.cam = camera;
            f.target = target;
            f.targetHeight = Mathf.Clamp(height * 0.62f, 0.6f, 2.5f);
            f.Yaw = target.eulerAngles.y;
            f.snapped = false;
            camera.fieldOfView = 40f;
            camera.nearClipPlane = 0.1f;
            return f;
        }

        public void Cycle() => distance = (Distance)(((int)distance + 1) % 3);
        public string Label => distance switch { Distance.Close => "close", Distance.Far => "far", _ => "normal" };

        void LateUpdate()
        {
            if (target == null || cam == null) return;
            var s = Settings[(int)distance];
            float wantedYaw = target.eulerAngles.y;
            float k = snapped ? 1f - Mathf.Exp(-Time.deltaTime / yawLagSeconds) : 1f;
            Yaw = Mathf.LerpAngle(Yaw, wantedYaw, k);
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
            var aim = Quaternion.LookRotation(look - cam.transform.position, Vector3.up) * Quaternion.Euler(0, 0, 0);
            cam.transform.rotation = aim;
            snapped = true;
        }
    }
}

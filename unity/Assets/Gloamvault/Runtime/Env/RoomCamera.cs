using UnityEngine;

namespace Gloamvault.Env
{
    /// <summary>The template's fixed camera (position, look-at, vertical fov) in Unity space; the delve's refit comes with the fight (Phase 19).</summary>
    public static class RoomCamera
    {
        public static void Apply(Camera cam, Template t, Axes axes, Color background)
        {
            var c = t.camera;
            var pos = axes.Position(c.position);
            var at = axes.Position(c.lookAt);
            cam.transform.position = pos;
            cam.transform.LookAt(at, Vector3.up);
            cam.fieldOfView = c.fov > 0 ? c.fov : 40f;
            cam.nearClipPlane = 0.5f;
            cam.farClipPlane = 120f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = background;
        }

        public static Vector3 Focus(Template t, Axes axes) => axes.Position(t.camera.lookAt);
    }
}

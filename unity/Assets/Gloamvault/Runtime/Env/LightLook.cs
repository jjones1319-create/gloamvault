using UnityEngine;

namespace Gloamvault.Env
{
    /// <summary>
    /// The party's light meter (0–100) as the room's lighting (03 §4.2) — the web's client/src/scene/room/look.ts,
    /// number for number: Radiant is bright with a thin haze, Pitch a dim room with the torch out and the fog closing in.
    /// </summary>
    public struct LightLook
    {
        /// <summary>Hemisphere (ambient) strength.</summary>
        public float hemi;
        /// <summary>The party's own torch (0 when the light is out); the room's fires are steady.</summary>
        public float torch;
        public float torchRange;
        /// <summary>Fog density × the camera's distance.</summary>
        public float fogK;
        public float fire;

        public static LightLook For(int light)
        {
            float t = Mathf.Clamp01(light / 100f);
            return new LightLook
            {
                hemi = 0.34f + 0.95f * t,
                torch = light <= 0 ? 0f : 5f + 25f * t,
                torchRange = 7f + 11f * t,
                fogK = 0.78f - 0.52f * t,
                fire = 22f,
            };
        }

        public static LightLook Lerp(LightLook a, LightLook b, float t) => new LightLook
        {
            hemi = Mathf.Lerp(a.hemi, b.hemi, t),
            torch = Mathf.Lerp(a.torch, b.torch, t),
            torchRange = Mathf.Lerp(a.torchRange, b.torchRange, t),
            fogK = Mathf.Lerp(a.fogK, b.fogK, t),
            fire = Mathf.Lerp(a.fire, b.fire, t),
        };
    }
}

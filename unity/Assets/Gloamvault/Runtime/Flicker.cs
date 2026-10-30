using UnityEngine;

namespace Gloamvault
{
    /// <summary>A torch's light breathing and flickering (presentation only — the rules' randomness is the sim's).</summary>
    [RequireComponent(typeof(Light))]
    public sealed class Flicker : MonoBehaviour
    {
        public float baseIntensity = 6f;
        public float amount = 0.18f;
        public float speed = 7f;
        public float seed;

        Light torch;

        void Awake() => torch = GetComponent<Light>();

        void Update()
        {
            float t = Time.time * speed + seed * 13.7f;
            float n = Mathf.PerlinNoise(t, seed) * 0.7f + Mathf.PerlinNoise(t * 2.3f, seed + 5f) * 0.3f;
            torch.intensity = baseIntensity * (1f - amount + 2f * amount * n);
        }
    }
}

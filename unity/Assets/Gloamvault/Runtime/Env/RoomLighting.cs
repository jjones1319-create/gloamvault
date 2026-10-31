using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Gloamvault.Env
{
    /// <summary>
    /// A room's light (Phase 11; 10 §4, D-116, D-158): the zone's hemisphere as the ambient, its fog scaled by the
    /// light meter, and real torches — the two flames nearest the focus carry point lights (the nearest casts soft
    /// shadows, the other none), every other flame an unlit glow. A room with fewer than two flames lends the party
    /// its torch over the focus. The look eases toward the light meter's value over about 400 ms.
    /// </summary>
    public sealed class RoomLighting
    {
        /// <summary>The web's light tint (0.6 of the flame's colour, the rest warm white) and the torch's base colour.</summary>
        public const float LightTint = 0.6f;
        static readonly Color WarmWhite = new(1f, 0.949f, 0.902f);
        /// <summary>The web's point intensity 22 ↔ URP's units: the title torch was 4.2 at range 10 (Phase 9). Tuned by the shots.</summary>
        public const float IntensityPerWebUnit = 0.19f;
        public const float RangeExtra = 3f;
        /// <summary>The hemisphere against real torches: the web's values lit a room with no shadows; here 0.6 of them keeps the bricks their colour.</summary>
        public const float HemiScale = 0.6f;

        /// <summary>A flame's strength by its kind: a candle is not a torch.</summary>
        public static float StrengthOf(string kind) => kind switch
        {
            "candle" => 0.22f,
            "lamp" => 0.6f,
            "fire" => 1.1f,
            "brazier" => 1.1f,
            _ => 1f,
        };

        public readonly List<Light> lights = new();
        public readonly List<GameObject> glows = new();
        readonly List<Flicker> flickers = new();
        readonly KitManifest kit;
        readonly Color fogColor;
        readonly GameObject root;
        LightLook current, target;
        float camDistance = 12f;
        Material glowMaterial;

        public RoomLighting(Room room, Vector3 focus, Camera camera, int light = 100)
        {
            kit = room.kit.manifest;
            ColorUtility.TryParseHtmlString(kit.look.fog, out fogColor);
            root = new GameObject("Lighting");
            root.transform.SetParent(room.root.transform, false);
            current = target = LightLook.For(light);
            if (camera != null) camDistance = Vector3.Distance(camera.transform.position, focus);

            var flames = new List<Flame3>(room.flames);
            flames.Sort((a, b) => (a.position - focus).sqrMagnitude.CompareTo((b.position - focus).sqrMagnitude));
            for (int i = 0; i < flames.Count; i++)
            {
                var f = flames[i];
                if (i < 2)
                {
                    var l = MakeLight(f.position + f.off * 0.7f, Tint(f.color), i == 0);
                    l.name += " " + f.kind;
                    lights.Add(l);
                }
                glows.Add(MakeGlow(f.position, f.color, f.kind));
            }
            if (lights.Count < 2)
            {
                // The party's torch, over the focus.
                var torch = MakeLight(focus + Vector3.up * 1.6f, Tint(new Color(1f, 0.627f, 0.251f)), lights.Count == 0);
                torch.name = "Party torch";
                lights.Add(torch);
            }
            Apply(current, 1f);
        }

        static Color Tint(Color flame) => Color.Lerp(WarmWhite, flame, LightTint);

        Light MakeLight(Vector3 at, Color color, bool shadows)
        {
            var go = new GameObject(shadows ? "Torch (shadows)" : "Torch");
            go.transform.SetParent(root.transform, false);
            go.transform.position = at;
            var l = go.AddComponent<Light>();
            l.type = LightType.Point;
            l.color = color;
            l.shadows = shadows ? LightShadows.Soft : LightShadows.None;
            l.shadowStrength = 0.85f;
            l.shadowBias = 0.03f;
            l.shadowNormalBias = 0.4f;
            var fl = go.AddComponent<Flicker>();
            flickers.Add(fl);
            return l;
        }

        GameObject MakeGlow(Vector3 at, Color color, string kind)
        {
            glowMaterial ??= new Material(Shader.Find("Universal Render Pipeline/Unlit")) { name = "Flame glow" };
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = "Flame " + kind;
            go.transform.SetParent(root.transform, false);
            go.transform.position = at;
            float size = kind == "candle" ? 0.08f : kind == "brazier" || kind == "fire" ? 0.34f : 0.16f;
            go.transform.localScale = new Vector3(size * 0.8f, size * 1.4f, size * 0.8f);
            Object.Destroy(go.GetComponent<Collider>());
            var mr = go.GetComponent<MeshRenderer>();
            var m = new Material(glowMaterial) { color = Color.Lerp(color, Color.white, 0.35f) };
            mr.sharedMaterial = m;
            mr.shadowCastingMode = ShadowCastingMode.Off;
            mr.receiveShadows = false;
            return go;
        }

        /// <summary>Sets the light meter's target; <see cref="Tick"/> eases toward it.</summary>
        public void SetLight(int light) => target = LightLook.For(light);

        public void Tick(float dt)
        {
            float k = 1f - Mathf.Exp(-dt / 0.4f);
            current = LightLook.Lerp(current, target, k);
            Apply(current, 1f);
        }

        void Apply(LightLook look, float _)
        {
            RenderSettings.ambientMode = AmbientMode.Trilight;
            ColorUtility.TryParseHtmlString(kit.look.sky, out var sky);
            ColorUtility.TryParseHtmlString(kit.look.ground, out var ground);
            float hemi = look.hemi * HemiScale;
            RenderSettings.ambientSkyColor = sky * hemi;
            RenderSettings.ambientEquatorColor = Color.Lerp(ground, sky, 0.5f) * hemi;
            RenderSettings.ambientGroundColor = ground * hemi;
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogColor = fogColor;
            RenderSettings.fogDensity = look.fogK * kit.look.fogScale / Mathf.Max(4f, camDistance);
            EnvMaterials.ApplyLookToAll(kit, hemi);
            foreach (var l in lights)
            {
                bool party = l.name == "Party torch";
                string kind = party ? "torch" : l.name.Substring(l.name.LastIndexOf(' ') + 1);
                float web = (party ? look.torch : look.fire) * StrengthOf(kind);
                l.range = (party ? look.torchRange : 12f * Mathf.Sqrt(StrengthOf(kind))) + RangeExtra;
                var fl = l.GetComponent<Flicker>();
                if (fl != null) fl.baseIntensity = web * IntensityPerWebUnit;
                else l.intensity = web * IntensityPerWebUnit;
                l.enabled = web > 0.01f;
            }
        }
    }
}

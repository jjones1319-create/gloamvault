using System.Collections.Generic;
using Gloamvault.Env;
using UnityEngine;
using UnityEngine.Rendering;

namespace Gloamvault.Level
{
    /// <summary>
    /// A level's light (Phase 14): the ambient and fog of the kit the hero stands in (eased when the kit changes),
    /// two point lights that move to the two flames nearest the hero across every active room — the nearest with
    /// soft shadows — and the party's torch over the hero when no flame is near; every flame has its glow from the
    /// builder. The same light meter as <see cref="RoomLighting"/> (10 §4, D-116).
    /// </summary>
    public sealed class LevelLighting
    {
        /// <summary>The fog is thinned as if the camera sat this far back (the diorama's density would wall the follow camera in).</summary>
        public const float FogReference = 8f;
        public const float PartyTorchReach = 14f;
        static readonly Color TorchColor = new(1f, 0.627f, 0.251f);

        public readonly GameObject root;
        public readonly Light[] lights = new Light[2];
        readonly Flicker[] flickers = new Flicker[2];
        readonly string[] kinds = { "torch", "torch" };
        readonly bool[] party = { true, false };
        KitManifest kit;
        string zone;
        Color fogColor;
        LightLook current, target;
        float retimer;

        public string Zone => zone;
        public int FlamesLit { get; private set; }

        public LevelLighting(Transform parent, string zone, int light = 100)
        {
            root = new GameObject("Level lighting");
            root.transform.SetParent(parent, false);
            for (int i = 0; i < 2; i++)
            {
                var go = new GameObject(i == 0 ? "Torch (shadows)" : "Torch");
                go.transform.SetParent(root.transform, false);
                var l = go.AddComponent<Light>();
                l.type = LightType.Point;
                l.shadows = i == 0 ? LightShadows.Soft : LightShadows.None;
                l.shadowStrength = 0.85f; l.shadowBias = 0.03f; l.shadowNormalBias = 0.4f;
                flickers[i] = go.AddComponent<Flicker>();
                lights[i] = l;
            }
            current = target = LightLook.For(light);
            SetZone(zone);
            Apply(current);
        }

        public void SetLight(int light) => target = LightLook.For(light);

        public void SetZone(string z)
        {
            if (z == null || z == zone) return;
            zone = z;
            kit = KitLibrary.Load(z).manifest;
            ColorUtility.TryParseHtmlString(kit.look.fog, out fogColor);
        }

        public void Tick(float dt, Vector3 heroPos, IEnumerable<Room> rooms)
        {
            current = LightLook.Lerp(current, target, 1f - Mathf.Exp(-dt / 0.4f));
            retimer -= dt;
            if (retimer <= 0f) { retimer = 0.25f; Repick(heroPos, rooms); }
            Apply(current);
        }

        void Repick(Vector3 heroPos, IEnumerable<Room> rooms)
        {
            Flame3 best = default, second = default;
            float bd = float.MaxValue, sd = float.MaxValue;
            foreach (var r in rooms)
            {
                if (r?.root == null || !r.root.activeSelf) continue;
                foreach (var f in r.flames)
                {
                    float d = (f.position - heroPos).sqrMagnitude;
                    if (d < bd) { second = best; sd = bd; best = f; bd = d; }
                    else if (d < sd) { second = f; sd = d; }
                }
            }
            FlamesLit = 0;
            if (bd < PartyTorchReach * PartyTorchReach) { Place(0, best, false); FlamesLit++; }
            else { lights[0].transform.position = heroPos + Vector3.up * 1.6f; lights[0].color = Tint(TorchColor); kinds[0] = "torch"; party[0] = true; }
            if (sd < PartyTorchReach * PartyTorchReach * 4f) { Place(1, second, false); FlamesLit++; lights[1].enabled = true; }
            else lights[1].enabled = false;
        }

        void Place(int i, Flame3 f, bool isParty)
        {
            lights[i].transform.position = f.position + f.off * 0.7f;
            lights[i].color = Tint(f.color);
            kinds[i] = f.kind ?? "torch";
            party[i] = isParty;
        }

        static Color Tint(Color flame) => Color.Lerp(new Color(1f, 0.949f, 0.902f), flame, RoomLighting.LightTint);

        void Apply(LightLook look)
        {
            if (kit == null) return;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            ColorUtility.TryParseHtmlString(kit.look.sky, out var sky);
            ColorUtility.TryParseHtmlString(kit.look.ground, out var ground);
            float hemi = look.hemi * RoomLighting.HemiScale;
            RenderSettings.ambientSkyColor = sky * hemi;
            RenderSettings.ambientEquatorColor = Color.Lerp(ground, sky, 0.5f) * hemi;
            RenderSettings.ambientGroundColor = ground * hemi;
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogColor = fogColor;
            RenderSettings.fogDensity = look.fogK * kit.look.fogScale / FogReference;
            EnvMaterials.ApplyHemiToEveryKit(hemi);
            for (int i = 0; i < 2; i++)
            {
                float strength = RoomLighting.StrengthOf(kinds[i]);
                float web = (party[i] ? look.torch : look.fire) * strength;
                lights[i].range = (party[i] ? look.torchRange : 12f * Mathf.Sqrt(strength)) + RoomLighting.RangeExtra;
                flickers[i].baseIntensity = web * RoomLighting.IntensityPerWebUnit;
                if (i == 0) lights[0].enabled = web > 0.01f;
            }
        }

        public void Destroy()
        {
            if (root != null) Object.Destroy(root);
        }
    }
}

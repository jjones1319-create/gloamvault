using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Gloamvault.Env
{
    /// <summary>
    /// The room materials (Phase 11): one shader, Gloamvault/Env, in three variants per zone — solid, translucent
    /// (mist, webs) and water — with the zone's palette and hemisphere colours set from its manifest. Made in code,
    /// shared by every piece of the zone, so the SRP Batcher draws a room in few calls.
    /// </summary>
    public static class EnvMaterials
    {
        public enum Variant { Solid, Translucent, Water }

        static readonly Dictionary<string, Material> cache = new();
        static Shader shader;

        public static Shader EnvShader => shader ??= Resources.Load<Shader>("Shaders/GvEnv");

        public static Material For(KitManifest kit, Variant variant, float alpha = 1f)
        {
            string key = $"{kit.zone}/{variant}/{alpha:0.00}";
            if (cache.TryGetValue(key, out var m) && m != null) return m;
            var sh = EnvShader;
            if (sh == null) throw new System.InvalidOperationException("missing Resources/Shaders/GvEnv.shader");
            m = new Material(sh) { name = key, enableInstancing = false };
            var palette = new Vector4[16];
            // The palette is painted in sRGB; the shader works in linear colour (a vector array gets no conversion of its own).
            for (int i = 0; i < 16 && i < kit.palette.Length; i++) { var c = kit.PaletteColor(i).linear; palette[i] = new Vector4(c.r, c.g, c.b, 1); }
            m.SetVectorArray("_Palette", palette);
            ApplyLook(m, kit, 1f);
            switch (variant)
            {
                case Variant.Solid:
                    m.SetFloat("_Alpha", 1f);
                    m.SetFloat("_Water", 0f);
                    m.SetFloat("_SrcBlend", (float)BlendMode.One);
                    m.SetFloat("_DstBlend", (float)BlendMode.Zero);
                    m.SetFloat("_ZWrite", 1f);
                    m.SetFloat("_Cull", (float)CullMode.Back);
                    m.renderQueue = (int)RenderQueue.Geometry;
                    break;
                case Variant.Translucent:
                    m.SetFloat("_Alpha", alpha);
                    m.SetFloat("_Water", 0f);
                    m.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
                    m.SetFloat("_DstBlend", (float)BlendMode.OneMinusSrcAlpha);
                    m.SetFloat("_ZWrite", 0f);
                    m.SetFloat("_Cull", (float)CullMode.Off);
                    m.renderQueue = (int)RenderQueue.Transparent;
                    m.SetShaderPassEnabled("ShadowCaster", false);
                    break;
                case Variant.Water:
                    m.SetFloat("_Alpha", 1f);
                    m.SetFloat("_Water", 1f);
                    m.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
                    m.SetFloat("_DstBlend", (float)BlendMode.OneMinusSrcAlpha);
                    m.SetFloat("_ZWrite", 0f);
                    m.SetFloat("_Cull", (float)CullMode.Back);
                    m.renderQueue = (int)RenderQueue.Transparent + 1;
                    m.SetShaderPassEnabled("ShadowCaster", false);
                    break;
            }
            cache[key] = m;
            return m;
        }

        /// <summary>The hemisphere the shader lights with, scaled by the light meter's `hemi`.</summary>
        public static void ApplyLook(Material m, KitManifest kit, float hemi)
        {
            ColorUtility.TryParseHtmlString(kit.look.sky, out var sky);
            ColorUtility.TryParseHtmlString(kit.look.ground, out var ground);
            m.SetColor("_SkyColor", sky);
            m.SetColor("_GroundColor", ground);
            m.SetFloat("_Hemi", hemi);
        }

        public static void ApplyLookToAll(KitManifest kit, float hemi)
        {
            foreach (var kv in cache) if (kv.Key.StartsWith(kit.zone + "/") && kv.Value != null) ApplyLook(kv.Value, kit, hemi);
        }
    }
}

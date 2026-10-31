using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Gloamvault.Characters
{
    /// <summary>
    /// A character's palette and material (Phase 12): the web's palette.ts / outfit.ts / monsters' manifest.ts rules —
    /// sixteen colours by slot (skin, skin2, hair, iris, sclera, ink, cloth1–3, leather, metal, trim, glow, wood, bone,
    /// gem) from the species, the class, the grade worn and the weapon's element; a monster's three colours into slots
    /// 0–2 with fixed companions, or its full sixteen. One material per character on the Gloamvault/Body shader.
    /// </summary>
    public static class CharacterMaterials
    {
        public const int Skin = 0, Skin2 = 1, Hair = 2, Iris = 3, Sclera = 4, Ink = 5, Cloth1 = 6, Cloth2 = 7, Leather = 8, Metal = 9, Trim = 10, Glow = 11, Wood = 12, Bone = 13, Gem = 14, Cloth3 = 15;

        public static readonly Dictionary<string, string> GradeTrim = new()
        {
            ["F"] = "#9b9488", ["E"] = "#7bd389", ["D"] = "#5fa8ff", ["C"] = "#c58cff", ["B"] = "#ffb347", ["A"] = "#ff7a59", ["S"] = "#ffd84d", ["SS"] = "#ff5ea8", ["God"] = "#fff4d6",
        };
        public static readonly Dictionary<string, string> Metals = new()
        {
            ["copper"] = "#b87333", ["bronze"] = "#b08d57", ["brass"] = "#c9a44c", ["iron"] = "#8a8f98", ["steel"] = "#a8b0ba", ["silver"] = "#c8ccd4", ["gold"] = "#e2b84a",
        };
        public static readonly Dictionary<string, string> ElementGlow = new()
        {
            ["fire"] = "#ff8a3d", ["frost"] = "#8fe3ff", ["lightning"] = "#fff07a", ["poison"] = "#8dff6a", ["holy"] = "#ffe9a8", ["shadow"] = "#b98cff",
        };
        public static readonly Dictionary<string, string[]> IrisFallback = new()
        {
            ["human"] = new[] { "#5a3a22", "#3f7fb8", "#5a7a3a" }, ["dwarf"] = new[] { "#4a2e1a", "#6a7a8a", "#3a5a3a" }, ["elf"] = new[] { "#5aa0b4", "#7ab45a", "#b48a3a" },
            ["orc"] = new[] { "#c8a020", "#a03a1e", "#6a4a22" }, ["halfling"] = new[] { "#5a3a22", "#6a8a3a", "#3f6fa0" }, ["draconid"] = new[] { "#ffb020", "#e05a1e", "#9adf4a" },
        };
        public const string DefaultMetal = "#8a8f98";
        public const string DefaultLeather = "#5e3d26";
        const string FineMetal = "#e2e7f0";
        static readonly string[] DefaultBones = { "#e6dcc2", "#2b2a30", "#a8874a" };

        static Shader shader;
        public static Shader BodyShader => shader ??= Resources.Load<Shader>("Shaders/GvBody");

        public static Color Hex(string hex, Color fallback = default) => ColorUtility.TryParseHtmlString(hex ?? "", out var c) ? c : fallback;
        static string ToHex(Color c) => "#" + ColorUtility.ToHtmlStringRGB(c).ToLowerInvariant();

        /// <summary>The web's mixHex: a toward b by t, in sRGB.</summary>
        public static string Mix(string a, string b, float t) => ToHex(Color.Lerp(Hex(a), Hex(b), t));
        public static string Scale(string a, float k) { var c = Hex(a); return ToHex(new Color(c.r * k, c.g * k, c.b * k)); }
        static float Luminance(string hex) { var c = Hex(hex).linear; return 0.2126f * c.r + 0.7152f * c.g + 0.0722f * c.b; }
        /// <summary>A cloth too dark to read lifts toward a dusty violet.</summary>
        public static string ReadableCloth(string hex) => Luminance(hex) < 0.016f ? Mix(hex, "#6a6878", 0.32f) : hex;
        public static string Pick(string[] list, int index, string fallback)
        {
            if (list == null || list.Length == 0) return fallback;
            int i = ((index % list.length()) + list.Length) % list.Length;
            return list[i] ?? fallback;
        }
        static int length(this string[] xs) => xs.Length;

        /// <summary>The sixteen colours, in slot order (palette.ts paletteHexes).</summary>
        public static string[] Palette(string skin, string hair, string iris, string cloth1, string cloth2, string cloth3, string leather, string metal, string trim, string glow, string bone)
        {
            var o = new string[16];
            for (int i = 0; i < 16; i++) o[i] = "#808080";
            o[Skin] = skin;
            o[Skin2] = Mix(Scale(skin, 0.86f), "#a0403c", 0.18f);
            o[Hair] = hair;
            o[Iris] = iris;
            o[Sclera] = "#f2ece2";
            o[Ink] = "#1a1218";
            o[Cloth1] = ReadableCloth(cloth1);
            o[Cloth2] = ReadableCloth(cloth2);
            o[Leather] = leather;
            o[Metal] = metal;
            o[Trim] = trim;
            o[Glow] = glow;
            o[Wood] = "#7a5432";
            o[Bone] = bone ?? "#e8dcc0";
            o[Gem] = glow;
            o[Cloth3] = ReadableCloth(cloth3);
            return o;
        }

        /// <summary>A hero's palette (outfit.ts paletteFor): the species' tones by the look's indices, the class's cloth, the kit's metal and trim.</summary>
        public static string[] HeroPalette(SpeciesInfo species, ClassInfo cls, int skin, int hair, int face, string tier, string trimGrade, string metalHex, string leatherHex, string element)
        {
            var pal = cls?.palette ?? Array.Empty<string>();
            string accent = pal.Length > 2 ? pal[2] : "#7fe3ff";
            var preset = species?.presets != null && species.presets.Length > 0 ? species.presets[((face % species.presets.Length) + species.presets.Length) % species.presets.Length] : null;
            int eye = preset != null ? preset.tintEye : face;
            bool horn = species != null && (species.hairColors == null || species.hairColors.Length == 0) && species.boneColors != null && species.boneColors.Length > 0;
            var bones = species?.boneColors != null && species.boneColors.Length > 0 ? species.boneColors : DefaultBones;
            var irisList = species?.eyeColors != null && species.eyeColors.Length > 0 ? species.eyeColors : (IrisFallback.TryGetValue(species?.id ?? "", out var fb) ? fb : IrisFallback["human"]);
            string classMetal = pal.Length > 3 ? pal[3] : (metalHex ?? DefaultMetal);
            string metal = tier == "S" ? Mix(classMetal, FineMetal, 0.6f) : classMetal;
            return Palette(
                skin: Pick(species?.skinTones, skin, "#e8c4a8"),
                hair: Pick(species?.hairColors, hair, "#3b2618"),
                iris: Pick(irisList, eye, "#5a3a22"),
                cloth1: pal.Length > 0 ? pal[0] : "#6b7280",
                cloth2: pal.Length > 1 ? pal[1] : "#8a4b2a",
                cloth3: pal.Length > 2 ? pal[2] : "#e7dfc8",
                leather: leatherHex ?? DefaultLeather,
                metal: metal,
                trim: GradeTrim.TryGetValue(trimGrade ?? "F", out var t) ? t : GradeTrim["F"],
                glow: !string.IsNullOrEmpty(element) && ElementGlow.TryGetValue(element, out var g) ? g : accent,
                bone: horn ? Pick(bones, hair, "#e6dcc2") : bones[0]);
        }

        /// <summary>A monster's palette (manifest.ts monsterPaletteHexes): three colours and their fixed companions, then the entry's slot overrides.</summary>
        public static string[] MonsterPalette(MonsterEntry e)
        {
            if (e.colors != null && e.colors.Length == 16) return (string[])e.colors.Clone();
            var three = e.palette ?? Array.Empty<string>();
            string p0 = three.Length > 0 ? three[0] : "#8a8a8a", p1 = three.Length > 1 ? three[1] : p0, p2 = three.Length > 2 ? three[2] : p0;
            var o = new[] { p0, p1, p2, "#ffd24a", "#f2ece2", "#1a1218", "#5a4636", "#7a6a52", "#5e3d26", "#8a8f98", p2, "#ffe08a", "#7a5432", "#e8dcc0", p2, "#3a3440" };
            if (e.slots != null) foreach (var s in e.slots) if (s.slot >= 0 && s.slot < 16 && !string.IsNullOrEmpty(s.color)) o[s.slot] = s.color;
            return o;
        }

        /// <summary>One material per character: its palette in linear colour, its hidden regions, its alpha.</summary>
        public static Material Make(string[] palette, int hiddenRegions = 0, float alpha = 1f, string name = "Character")
        {
            var sh = BodyShader;
            if (sh == null) throw new InvalidOperationException("missing Resources/Shaders/GvBody.shader");
            var m = new Material(sh) { name = name };
            var arr = new Vector4[16];
            for (int i = 0; i < 16; i++) { var c = Hex(i < palette.Length ? palette[i] : "#808080", Color.magenta).linear; arr[i] = new Vector4(c.r, c.g, c.b, 1); }
            m.SetVectorArray("_Palette", arr);
            m.SetFloat("_HiddenRegions", hiddenRegions);
            SetAlpha(m, alpha);
            return m;
        }

        public static void SetAlpha(Material m, float alpha)
        {
            m.SetFloat("_Alpha", alpha);
            bool opaque = alpha >= 0.999f;
            m.SetFloat("_SrcBlend", (float)(opaque ? BlendMode.One : BlendMode.SrcAlpha));
            m.SetFloat("_DstBlend", (float)(opaque ? BlendMode.Zero : BlendMode.OneMinusSrcAlpha));
            m.SetFloat("_ZWrite", opaque ? 1f : 0f);
            m.renderQueue = opaque ? (int)RenderQueue.Geometry : (int)RenderQueue.Transparent;
            m.SetShaderPassEnabled("ShadowCaster", opaque);
        }

        public static void SetHemisphere(Material m, Color sky, Color ground, float hemi)
        {
            m.SetColor("_SkyColor", sky);
            m.SetColor("_GroundColor", ground);
            m.SetFloat("_Hemi", hemi);
        }
    }
}

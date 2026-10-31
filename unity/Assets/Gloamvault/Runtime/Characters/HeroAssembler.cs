using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;

namespace Gloamvault.Characters
{
    /// <summary>A built character: its root, skeleton, renderers, materials and animator, plus what the build could not find.</summary>
    public sealed class Character
    {
        public GameObject root;
        public Transform rig;
        public readonly Dictionary<string, Transform> bones = new();
        public readonly Dictionary<string, Transform> sockets = new();
        public SkinnedMeshRenderer body;
        public readonly List<Renderer> renderers = new();
        public readonly List<string> missing = new();
        public Material bodyMaterial, partsMaterial;
        public CharacterAnimator animator;
        public float rootScale = 1f;
        public float height = 1.8f;
        public string label = "";

        public void Destroy()
        {
            if (root != null) UnityEngine.Object.Destroy(root);
            root = null;
        }

        /// <summary>Every bone and socket under the rig, by name.</summary>
        public void IndexRig(Transform rigRoot)
        {
            rig = rigRoot;
            bones.Clear();
            sockets.Clear();
            foreach (var t in rigRoot.GetComponentsInChildren<Transform>(true))
            {
                if (t.name.StartsWith("Socket_")) sockets[t.name] = t;
                else bones[t.name] = t;
            }
        }
    }

    /// <summary>What a hero looks like: the web's CharacterSpec, as the viewer and (later) the save give it.</summary>
    public sealed class HeroSpec
    {
        public string speciesId = "human";
        public string classId = "warden";
        public string frame = "broad";
        /// <summary>Indices into the species' tone lists and presets (the save's look, D-105).</summary>
        public int skin, hair, face;
        /// <summary>F (grades F–C) or S (B and up).</summary>
        public string tier = "F";
        public bool gear = true;
    }

    /// <summary>
    /// Builds a hero from the library (Phase 12, D-160) — the web's assembler.ts, Unity's way: the frame's body with
    /// its parts as separate skinned meshes on the one skeleton, the species key and the preset's face as live blend
    /// shapes, the body regions under armour cut by the shader's mask, the class's gear pieces rebound to the hero's
    /// bones by name, bone scales absolute (a child's local scale undoes its parent's), the kit's weapons rigid on
    /// their sockets at true size, one palette material for the body and one for everything else.
    /// </summary>
    public static class HeroAssembler
    {
        public static readonly string[] Regions = { "head", "neck", "chest", "belly", "upperArms", "forearms", "hands", "thighs", "shins", "feet" };
        static readonly Regex UnderHelmet = new(@"^hair_|^spc_orc_topknot|^spc_draconid_(horns|crest)|^spc_(elf|orc)_ears|_curls$");
        const float ScaleMin = 0.5f, ScaleMax = 2f;
        /// <summary>The web's HELD_SCALE: a Halfling's shield and great weapons, a Dwarf's bows, held a little smaller.</summary>
        static readonly Dictionary<string, Dictionary<string, float>> HeldScale = new()
        {
            ["halfling"] = new() { ["shield"] = 0.7f, ["greatsword"] = 0.85f, ["greataxe"] = 0.85f, ["maul"] = 0.85f, ["longbow"] = 0.8f, ["crossbow"] = 0.8f },
            ["dwarf"] = new() { ["shortbow"] = 0.9f, ["longbow"] = 0.9f },
        };
        static readonly Dictionary<string, string[]> WeaponFallback = new()
        {
            ["greataxe"] = new[] { "greataxe", "axe" }, ["greatsword"] = new[] { "greatsword", "sword" }, ["maul"] = new[] { "maul", "mace" }, ["censer"] = new[] { "censer", "mace" },
            ["longbow"] = new[] { "longbow", "shortbow" }, ["shortbow"] = new[] { "shortbow", "longbow" }, ["bow"] = new[] { "shortbow", "longbow" }, ["crossbow"] = new[] { "crossbow", "shortbow" },
        };

        public static int RegionMask(IEnumerable<string> regions)
        {
            int mask = 0;
            if (regions == null) return 0;
            foreach (var r in regions) { int i = Array.IndexOf(Regions, r); if (i >= 0) mask |= 1 << i; }
            return mask;
        }

        public static Character Build(HeroSpec spec, Transform parent = null)
        {
            var lib = HeroLibrary.Instance;
            var data = lib.data;
            var species = data.Species(spec.speciesId) ?? data.Species("human");
            var cls = data.Class(spec.classId) ?? data.classes[0];
            var c = new Character { label = $"{spec.speciesId} {spec.classId} {spec.tier}" };

            // The body frame: the rig, the body mesh, every part (off until chosen), the sockets.
            c.root = UnityEngine.Object.Instantiate(lib.Body(spec.frame), parent, false);
            c.root.name = $"Hero {spec.speciesId} {spec.classId}";
            var rig = HeroLibrary.Find(c.root.transform, "Rig");
            if (rig == null) throw new InvalidOperationException("the hero prefab has no Rig");
            c.IndexRig(rig);
            var smrs = new Dictionary<string, SkinnedMeshRenderer>();
            foreach (var smr in c.root.GetComponentsInChildren<SkinnedMeshRenderer>(true)) { smrs[smr.name] = smr; smr.gameObject.SetActive(false); }
            if (!smrs.TryGetValue("Body", out c.body)) { foreach (var kv in smrs) if (kv.Key.StartsWith("Body")) { c.body = kv.Value; break; } }
            if (c.body == null) throw new InvalidOperationException("the hero prefab has no Body mesh");
            c.body.gameObject.SetActive(true);

            // The preset: the face, the parts, the suggested tints.
            var preset = species.presets != null && species.presets.Length > 0 ? species.presets[Mod(spec.face, species.presets.Length)] : null;
            var hidden = new HashSet<string>();
            bool helmet = false, helmetHidesNeck = false;
            var worn = new List<GearInfo>();
            if (spec.gear)
            {
                foreach (var slot in new[] { "helmet", "chest", "legs", "boots", "gloves", "cloak", "knives" })
                {
                    var g = data.Gear(cls.id, slot, spec.tier) ?? data.Gear(cls.id, slot, "F");
                    if (g == null) continue;
                    worn.Add(g);
                    if (g.hides != null) foreach (var h in g.hides) hidden.Add(h);
                    if (slot == "helmet") { helmet = true; helmetHidesNeck = g.hides != null && Array.IndexOf(g.hides, "neck") >= 0; }
                }
            }

            // Blend shapes: the species key on the body and every gear piece; the preset's face on the body and the head parts.
            var shapes = new Dictionary<string, float>();
            if (!string.IsNullOrEmpty(species.key)) shapes[species.key] = 1f;
            if (preset?.face != null) foreach (var f in preset.face) shapes[f.key] = f.weight;
            ApplyShapes(c.body, shapes);

            // Parts: the preset's, unless a helmet covers them; a part's own hides join the mask.
            var partNames = new List<string>(preset?.parts ?? Array.Empty<string>());
            foreach (var name in partNames)
            {
                if (!smrs.TryGetValue(name, out var part)) { c.missing.Add(name); continue; }
                var info = data.Part(name);
                if (helmet && (info?.family == "hair" || UnderHelmet.IsMatch(name))) continue;
                part.gameObject.SetActive(true);
                ApplyShapes(part, shapes);
                if (helmetHidesNeck && name.Contains("beard")) SetShape(part, "beard_tuck", 1f);
                if (info?.hides != null) foreach (var h in info.hides) hidden.Add(h);
                c.renderers.Add(part);
            }

            // Gear: each piece cloned from the class's file for this frame and rebound to this skeleton.
            foreach (var g in worn)
            {
                var src = HeroLibrary.Find(lib.Gear(cls.id, spec.frame).transform, g.name);
                var srcSmr = src != null ? src.GetComponent<SkinnedMeshRenderer>() : null;
                if (srcSmr == null) { c.missing.Add(g.name); continue; }
                var piece = UnityEngine.Object.Instantiate(src.gameObject, c.root.transform, false);
                piece.name = g.name;
                piece.SetActive(true);
                var smr = piece.GetComponent<SkinnedMeshRenderer>();
                Rebind(smr, c);
                ApplyShapes(smr, shapes);
                c.renderers.Add(smr);
            }

            // The palette: the body gets the region mask; parts and gear share the other material.
            string trimGrade = spec.tier == "S" ? "B" : "F";
            string metal = null, leather = null, element = null;
            foreach (var h in cls.held ?? Array.Empty<HeldInfo>())
            {
                if (metal == null && !string.IsNullOrEmpty(h.trimMetal) && CharacterMaterials.Metals.TryGetValue(h.trimMetal, out var m)) metal = m;
                if (element == null && !string.IsNullOrEmpty(h.element)) element = h.element;
            }
            var palette = CharacterMaterials.HeroPalette(species, cls, spec.skin, spec.hair, spec.face, spec.tier, trimGrade, metal, leather, element);
            c.bodyMaterial = CharacterMaterials.Make(palette, RegionMask(hidden), 1f, c.label + " body");
            c.partsMaterial = CharacterMaterials.Make(palette, 0, 1f, c.label + " parts");
            c.body.sharedMaterial = c.bodyMaterial;
            c.renderers.Insert(0, c.body);
            foreach (var r in c.renderers) if (r != c.body) r.sharedMaterial = c.partsMaterial;

            // Bone scales: absolute per group (a Dwarf's lower leg is 0.85 like its thigh, not 0.85²), the root on the whole.
            c.rootScale = Clamp(species.Scale("root"));
            c.root.transform.localScale = Vector3.one * c.rootScale;
            ApplyBoneScales(c, species);

            // Weapons: the kit's held things, rigid on their sockets at true size.
            if (spec.gear) foreach (var h in cls.held ?? Array.Empty<HeldInfo>()) PlaceHeld(c, lib, spec, h);

            // Height for the camera: the head's top after scaling.
            c.height = (c.bones.TryGetValue("Head", out var head) ? c.root.transform.InverseTransformPoint(head.position).y + 0.25f : 1.8f) * c.rootScale;

            // Animation: the hero clips through the character's own Animator.
            var animator = c.root.GetComponent<Animator>() ?? c.root.AddComponent<Animator>();
            animator.applyRootMotion = false;
            animator.cullingMode = AnimatorCullingMode.AlwaysAnimate;
            c.animator = c.root.AddComponent<CharacterAnimator>();
            var clips = new List<AnimationClip>();
            foreach (var n in lib.ClipNames) clips.Add(lib.Clip(n));
            c.animator.Setup(animator, clips, data.clips, new Dictionary<string, string> { ["Move"] = "Walk", ["Attack1"] = "Attack_Light", ["Attack2"] = "Attack_Heavy", ["Death"] = "Defeat" });
            foreach (var r in c.renderers) if (r is SkinnedMeshRenderer s) s.updateWhenOffscreen = true;
            return c;
        }

        static int Mod(int i, int n) => n <= 0 ? 0 : ((i % n) + n) % n;
        static float Clamp(float v) => float.IsNaN(v) ? 1f : Mathf.Clamp(v, ScaleMin, ScaleMax);

        /// <summary>Blend shape weights by key name (Unity may prefix a key with its mesh's name, so a suffix match).</summary>
        public static void ApplyShapes(SkinnedMeshRenderer smr, Dictionary<string, float> shapes)
        {
            foreach (var kv in shapes) SetShape(smr, kv.Key, kv.Value);
        }

        public static bool SetShape(SkinnedMeshRenderer smr, string key, float weight)
        {
            var mesh = smr.sharedMesh;
            if (mesh == null) return false;
            for (int i = 0; i < mesh.blendShapeCount; i++)
            {
                string n = mesh.GetBlendShapeName(i);
                if (n == key || n.EndsWith("." + key)) { smr.SetBlendShapeWeight(i, weight * 100f); return true; }
            }
            return false;
        }

        /// <summary>A gear piece skinned to its own copy of the rig takes the hero's bones by name (the bind poses are the same rig's).</summary>
        public static void Rebind(SkinnedMeshRenderer smr, Character c)
        {
            var bones = smr.bones;
            var mapped = new Transform[bones.Length];
            for (int i = 0; i < bones.Length; i++)
            {
                if (bones[i] == null) continue;
                if (!c.bones.TryGetValue(bones[i].name, out mapped[i])) c.missing.Add("bone:" + bones[i].name);
            }
            smr.bones = mapped;
            if (smr.rootBone != null && c.bones.TryGetValue(smr.rootBone.name, out var rb)) smr.rootBone = rb;
            smr.updateWhenOffscreen = true;
        }

        /// <summary>The web's boneGroup: which species scale group a bone belongs to, and whether an ungrouped bone follows its parent.</summary>
        public static (string group, bool inherit) BoneGroup(string name)
        {
            if (Regex.IsMatch(name, "^(Left|Right)(Thumb|Index|Middle|Ring|Little)(Proximal|Intermediate|Distal)$")) return ("fingers", false);
            if (Regex.IsMatch(name, "^(Left|Right)Toes$")) return ("toes", false);
            var limb = Regex.Match(name, "^(?:Left|Right)(Shoulder|UpperArm|LowerArm|Hand|UpperLeg|LowerLeg|Foot)$");
            if (limb.Success) { string g = limb.Groups[1].Value; return (char.ToLowerInvariant(g[0]) + g.Substring(1), false); }
            if (name == "Chest") return ("chest", false);
            if (name == "UpperChest") return ("upperChest", false);
            if (name == "Neck") return ("neck", false);
            if (name == "Head") return ("head", false);
            if (Regex.IsMatch(name, "^(Left|Right)Eye$|^(Tail|Ear|Beard|Hair)_")) return (null, true);
            return (null, false);
        }

        static void ApplyBoneScales(Character c, SpeciesInfo species)
        {
            var own = new Dictionary<Transform, float>();
            float OwnOf(Transform t, int depth = 0)
            {
                if (own.TryGetValue(t, out var v)) return v;
                var (group, inherit) = BoneGroup(t.name);
                float factor = group != null ? species.Scale(group) : float.NaN;
                if (!float.IsNaN(factor)) v = Mathf.Clamp(factor, ScaleMin, ScaleMax);
                else if (inherit && t.parent != null && c.bones.ContainsKey(t.parent.name) && depth < 80) v = OwnOf(t.parent, depth + 1);
                else v = 1f;
                own[t] = v;
                return v;
            }
            foreach (var kv in c.bones)
            {
                var t = kv.Value;
                if (t == c.rig) continue;
                float parentOwn = t.parent != null && c.bones.ContainsKey(t.parent.name) ? OwnOf(t.parent) : 1f;
                float s = OwnOf(t) / parentOwn;
                t.localScale = Vector3.one * s;
            }
        }

        /// <summary>A held thing on its socket: the weapon mesh for the item's meshId at the tier, true size (the hand's scale undone), the species' held factor.</summary>
        static void PlaceHeld(Character c, HeroLibrary lib, HeroSpec spec, HeldInfo h)
        {
            var data = lib.data;
            var w = data.Weapon(h.meshId, h.weaponType, spec.tier) ?? data.Weapon(h.meshId, h.weaponType, "F");
            if (w == null && WeaponFallback.TryGetValue(h.weaponType ?? "", out var alts))
                foreach (var alt in alts) { w = data.Weapon("", alt, spec.tier) ?? data.Weapon("", alt, "F"); if (w != null) break; }
            if (w == null) { c.missing.Add("weapon:" + h.meshId); return; }
            string socketName = h.kind == "shield" || h.kind == "focus" ? "Socket_HandL" : (w.socket ?? "Socket_HandR");
            Attach(c, lib, w.name, socketName, spec, h.kind == "shield" ? "shield" : h.weaponType);
            if (h.weaponType == "longbow" || h.weaponType == "shortbow" || h.weaponType == "crossbow")
            {
                foreach (var q in data.weapons) if (q.kind == "quiver" && q.tier == w.tier) { Attach(c, lib, q.name, "Socket_Back", spec, "quiver"); break; }
                foreach (var q in data.weapons) if (q.kind == "quiverFill" && q.tier == w.tier && q.fill == "full") { Attach(c, lib, q.name, "Socket_Back", spec, "quiver"); break; }
            }
        }

        static void Attach(Character c, HeroLibrary lib, string meshName, string socketName, HeroSpec spec, string kindForScale)
        {
            if (!c.sockets.TryGetValue(socketName, out var socket)) { c.missing.Add("socket:" + socketName); return; }
            var src = HeroLibrary.Find(lib.Weapons.transform, meshName);
            if (src == null) { c.missing.Add(meshName); return; }
            var go = UnityEngine.Object.Instantiate(src.gameObject, socket, false);
            go.name = meshName;
            go.SetActive(true);
            go.transform.localPosition = Vector3.zero;
            go.transform.localRotation = Quaternion.identity;
            float held = 1f;
            if (HeldScale.TryGetValue(spec.speciesId, out var table) && table.TryGetValue(kindForScale ?? "", out var f)) held = f;
            var ls = socket.lossyScale;
            go.transform.localScale = new Vector3(held / Mathf.Max(0.01f, ls.x), held / Mathf.Max(0.01f, ls.y), held / Mathf.Max(0.01f, ls.z));
            foreach (var r in go.GetComponentsInChildren<Renderer>()) { r.sharedMaterial = c.partsMaterial; c.renderers.Add(r); }
        }
    }
}

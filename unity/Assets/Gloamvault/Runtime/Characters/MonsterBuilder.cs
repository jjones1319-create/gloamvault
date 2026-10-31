using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gloamvault.Characters
{
    /// <summary>
    /// Builds a monster from its manifest entry (Phase 12, D-160) — the web's monsters/model.ts: a base file per body
    /// plan, a variant per monster. A base with its own rig is cloned whole: the listed parts shown (and the body
    /// always), the variant's shape keys set, its three colours into the palette, its scale on a holder, its own
    /// clips through the heroes' names as aliases. A base on the hero rig (humanoid, skeleton, zombie, sentinel, the
    /// Hollow King) is the hero skeleton with the monster's meshes rebound to it, playing the hero clips through the
    /// entry's clip map. Ghosts and oozes are see-through.
    /// </summary>
    public static class MonsterBuilder
    {
        public static readonly Dictionary<string, string> OwnAliases = new()
        {
            ["Walk"] = "Move", ["Run"] = "Move", ["Attack_Light"] = "Attack1", ["Attack_Heavy"] = "Attack2", ["Attack_Dual"] = "Attack2", ["Shoot"] = "Attack2", ["Cast"] = "Attack2",
            ["Defeat"] = "Death", ["Downed"] = "Death", ["Guard"] = "Idle", ["Victory"] = "Idle", ["Dodge"] = "Hit",
        };
        public static readonly Dictionary<string, string> HeroClipFor = new()
        {
            ["Idle"] = "Idle", ["Move"] = "Walk", ["Attack1"] = "Attack_Light", ["Attack2"] = "Attack_Heavy", ["Hit"] = "Hit", ["Death"] = "Defeat", ["Flee"] = "Run", ["Downed"] = "Defeat",
        };
        static readonly string[] HeroRigBases = { "humanoid", "skeleton", "zombie", "sentinel", "hollow-king" };

        static MonsterFile data;
        public static MonsterFile Data => data ??= MonsterFile.Load();
        static readonly Dictionary<string, GameObject> prefabs = new();
        static readonly Dictionary<string, AnimationClip[]> baseClips = new();

        public static GameObject Prefab(string baseId)
        {
            if (prefabs.TryGetValue(baseId, out var p)) return p;
            p = Resources.Load<GameObject>("Monsters/" + baseId);
            if (p == null) throw new InvalidOperationException($"missing Resources/Monsters/{baseId}.fbx — run npm run unity:models");
            prefabs[baseId] = p;
            return p;
        }

        public static AnimationClip[] Clips(string baseId)
        {
            if (baseClips.TryGetValue(baseId, out var c)) return c;
            c = Resources.LoadAll<AnimationClip>("Monsters/" + baseId);
            baseClips[baseId] = c;
            return c;
        }

        public static bool IsHeroRig(string baseId) => Array.IndexOf(HeroRigBases, baseId) >= 0;

        public static Character Build(MonsterEntry e, Transform parent = null)
        {
            if (e == null) throw new ArgumentNullException(nameof(e));
            return IsHeroRig(e.baseId) ? BuildHeroRig(e, parent) : BuildOwnRig(e, parent);
        }

        static Character BuildOwnRig(MonsterEntry e, Transform parent)
        {
            var c = new Character { label = e.name };
            var holder = new GameObject("Monster " + e.key);
            if (parent != null) holder.transform.SetParent(parent, false);
            c.root = holder;
            var model = UnityEngine.Object.Instantiate(Prefab(e.baseId), holder.transform, false);
            model.name = e.baseId;
            var rig = HeroLibrary.Find(model.transform, "Rig");
            if (rig != null) c.IndexRig(rig);

            var shapes = new Dictionary<string, float>();
            if (e.shapes != null) foreach (var s in e.shapes) shapes[s.key] = s.weight;
            var shown = new HashSet<string>(e.parts ?? Array.Empty<string>()) { e.baseId + "_body" };
            foreach (var r in model.GetComponentsInChildren<Renderer>(true))
            {
                bool body = r.name == e.baseId + "_body" || r.name.StartsWith(e.baseId + "_body");
                bool on = body || shown.Contains(r.name) || (e.parts == null || e.parts.Length == 0) && !r.name.Contains("_");
                // A part not listed is hidden, not removed (its clips still bind); bases with no parts list show everything.
                if (e.parts != null && e.parts.Length > 0) r.gameObject.SetActive(on);
                if (r is SkinnedMeshRenderer smr) { HeroAssembler.ApplyShapes(smr, shapes); smr.updateWhenOffscreen = true; }
                if (r.gameObject.activeSelf) c.renderers.Add(r);
            }
            foreach (var name in e.parts ?? Array.Empty<string>()) if (HeroLibrary.Find(model.transform, name) == null) c.missing.Add(name);

            float alpha = e.ghost ? 0.55f : e.baseId == "ooze" ? 0.75f : 1f;
            c.partsMaterial = CharacterMaterials.Make(CharacterMaterials.MonsterPalette(e), 0, alpha, e.key);
            c.bodyMaterial = c.partsMaterial;
            foreach (var r in c.renderers) r.sharedMaterial = c.partsMaterial;
            c.rootScale = Mathf.Clamp(e.scale <= 0 ? 1f : e.scale, 0.05f, 10f);
            holder.transform.localScale = Vector3.one * c.rootScale;
            c.height = Height(model) * c.rootScale;

            var animator = model.GetComponent<Animator>() ?? model.AddComponent<Animator>();
            animator.applyRootMotion = false;
            animator.cullingMode = AnimatorCullingMode.AlwaysAnimate;
            c.animator = model.AddComponent<CharacterAnimator>();
            var infos = Data.ClipsOf(e.baseId)?.clips ?? Array.Empty<ClipInfo>();
            var aliases = new Dictionary<string, string>(OwnAliases);
            if (e.clipMap != null) foreach (var p in e.clipMap) aliases[p.from] = p.to;
            c.animator.Setup(animator, Clips(e.baseId), infos, aliases);
            c.animator.speed = e.clipSpeed > 0 ? e.clipSpeed : 1f;
            return c;
        }

        static Character BuildHeroRig(MonsterEntry e, Transform parent)
        {
            var lib = HeroLibrary.Instance;
            var c = new Character { label = e.name };
            var holder = new GameObject("Monster " + e.key);
            if (parent != null) holder.transform.SetParent(parent, false);
            c.root = holder;
            // The hero skeleton, with nothing of the hero shown.
            var skeleton = UnityEngine.Object.Instantiate(lib.Body("broad"), holder.transform, false);
            skeleton.name = "skeleton";
            var rig = HeroLibrary.Find(skeleton.transform, "Rig");
            if (rig == null) throw new InvalidOperationException("the hero prefab has no Rig");
            c.IndexRig(rig);
            foreach (var r in skeleton.GetComponentsInChildren<Renderer>(true)) r.gameObject.SetActive(false);

            var shapes = new Dictionary<string, float>();
            if (e.shapes != null) foreach (var s in e.shapes) shapes[s.key] = s.weight;
            var src = Prefab(e.baseId).transform;
            var names = new List<string>(e.parts ?? Array.Empty<string>());
            if (names.Count == 0) foreach (var r in src.GetComponentsInChildren<SkinnedMeshRenderer>(true)) names.Add(r.name);
            foreach (var name in names)
            {
                var part = HeroLibrary.Find(src, name);
                var srcSmr = part != null ? part.GetComponent<SkinnedMeshRenderer>() : null;
                if (srcSmr == null) { c.missing.Add(name); continue; }
                var go = UnityEngine.Object.Instantiate(part.gameObject, skeleton.transform, false);
                go.name = name;
                go.SetActive(true);
                var smr = go.GetComponent<SkinnedMeshRenderer>();
                HeroAssembler.Rebind(smr, c);
                HeroAssembler.ApplyShapes(smr, shapes);
                c.renderers.Add(smr);
            }
            float alpha = e.ghost ? 0.55f : 1f;
            c.partsMaterial = CharacterMaterials.Make(CharacterMaterials.MonsterPalette(e), 0, alpha, e.key);
            c.bodyMaterial = c.partsMaterial;
            foreach (var r in c.renderers) r.sharedMaterial = c.partsMaterial;
            c.rootScale = Mathf.Clamp(e.scale <= 0 ? 1f : e.scale, 0.05f, 10f);
            holder.transform.localScale = Vector3.one * c.rootScale;
            c.height = Height(skeleton) * c.rootScale;

            var animator = skeleton.GetComponent<Animator>() ?? skeleton.AddComponent<Animator>();
            animator.applyRootMotion = false;
            animator.cullingMode = AnimatorCullingMode.AlwaysAnimate;
            c.animator = skeleton.AddComponent<CharacterAnimator>();
            var clips = new List<AnimationClip>();
            foreach (var n in lib.ClipNames) clips.Add(lib.Clip(n));
            var aliases = new Dictionary<string, string>(HeroClipFor);
            if (e.clipMap != null) foreach (var p in e.clipMap) aliases[p.from] = p.to;
            c.animator.Setup(animator, clips, lib.data.clips, aliases);
            c.animator.speed = e.clipSpeed > 0 ? e.clipSpeed : 1f;
            return c;
        }

        /// <summary>The model's height from its meshes' own bounds (the bind pose at the origin): a renderer's world bounds are not settled before the first frame.</summary>
        static float Height(GameObject model)
        {
            float top = 0f;
            bool any = false;
            foreach (var r in model.GetComponentsInChildren<Renderer>())
            {
                if (!r.gameObject.activeInHierarchy) continue;
                Mesh mesh = r is SkinnedMeshRenderer s ? s.sharedMesh : r.GetComponent<MeshFilter>()?.sharedMesh;
                if (mesh == null) continue;
                float y = mesh.bounds.max.y * r.transform.lossyScale.y / Mathf.Max(0.001f, model.transform.lossyScale.y);
                top = any ? Mathf.Max(top, y) : y;
                any = true;
            }
            return any ? Mathf.Max(0.3f, top) : 1f;
        }
    }
}

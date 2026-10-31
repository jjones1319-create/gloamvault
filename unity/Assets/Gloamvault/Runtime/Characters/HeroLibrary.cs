using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gloamvault.Characters
{
    /// <summary>
    /// The heroes' models in Unity (Phase 12): the two body frames (`Resources/Hero/hero_broad|slight.fbx` — the rig,
    /// the body, the parts, the sockets), the six classes' gear files per frame, the weapons, the clips file, and
    /// `hero.json`. Loaded once; the assembler clones what it needs.
    /// </summary>
    public sealed class HeroLibrary
    {
        public static readonly string[] Classes = { "warden", "blade", "ranger", "shade", "arcanist", "mender" };
        public static readonly string[] SpeciesIds = { "human", "dwarf", "elf", "orc", "halfling", "draconid" };
        public static readonly string[] Frames = { "broad", "slight" };

        public readonly HeroFile data;
        readonly Dictionary<string, GameObject> prefabs = new();
        readonly Dictionary<string, AnimationClip> clips = new();
        static HeroLibrary instance;

        public static HeroLibrary Instance => instance ??= new HeroLibrary();

        HeroLibrary()
        {
            data = HeroFile.Load();
            foreach (var clip in Resources.LoadAll<AnimationClip>("Hero/hero_clips"))
            {
                string name = clip.name;
                int bar = name.LastIndexOf('|');
                if (bar >= 0) name = name.Substring(bar + 1);
                if (name.StartsWith("__")) continue;
                clips[name] = clip;
            }
        }

        public GameObject Prefab(string name)
        {
            if (prefabs.TryGetValue(name, out var p)) return p;
            p = Resources.Load<GameObject>("Hero/" + name);
            if (p == null) throw new InvalidOperationException($"missing Resources/Hero/{name}.fbx — run npm run unity:models");
            prefabs[name] = p;
            return p;
        }

        public GameObject Body(string frame) => Prefab("hero_" + frame);
        public GameObject Gear(string cls, string frame) => Prefab($"gear_{cls}_{frame}");
        public GameObject Weapons => Prefab("weapons");

        public AnimationClip Clip(string name) => clips.TryGetValue(name, out var c) ? c : null;
        public IEnumerable<string> ClipNames => clips.Keys;
        public int ClipCount => clips.Count;

        /// <summary>A named child anywhere under a prefab (a part, a gear piece, a weapon mesh).</summary>
        public static Transform Find(Transform root, string name)
        {
            if (root.name == name) return root;
            foreach (Transform t in root)
            {
                var f = Find(t, name);
                if (f != null) return f;
            }
            return null;
        }
    }
}

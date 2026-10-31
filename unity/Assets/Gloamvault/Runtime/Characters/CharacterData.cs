using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gloamvault.Characters
{
    /// <summary>
    /// The characters' data as tools/unity/env.ts writes it (Phase 12, D-160): the hero manifest, the clips, the GLB
    /// node extras (parts, gear, weapons — Unity keeps no custom properties at runtime), the classes' looks, and the
    /// monster manifest with its clips and the content's list. Fixed shapes for JsonUtility.
    /// </summary>
    [Serializable]
    public sealed class HeroFile
    {
        public int fps;
        public float hipsHeight;
        public ClipInfo[] clips;
        public SpeciesInfo[] species;
        public PartInfo[] parts;
        public GearInfo[] gear;
        public WeaponInfo[] weapons;
        public ClassInfo[] classes;

        Dictionary<string, SpeciesInfo> speciesById;
        Dictionary<string, PartInfo> partsByName;
        Dictionary<string, ClassInfo> classesById;
        Dictionary<string, ClipInfo> clipsByName;

        public static HeroFile Load()
        {
            var asset = Resources.Load<TextAsset>("Hero/hero");
            if (asset == null) throw new InvalidOperationException("missing Resources/Hero/hero.json — run npm run unity:bundle");
            var f = JsonUtility.FromJson<HeroFile>(asset.text);
            if (f?.species == null || f.species.Length == 0) throw new InvalidOperationException("hero.json has no species");
            return f;
        }

        public SpeciesInfo Species(string id)
        {
            speciesById ??= Index(species, s => s.id);
            return speciesById.TryGetValue(id, out var s) ? s : null;
        }
        public PartInfo Part(string name)
        {
            partsByName ??= Index(parts, p => p.name);
            return partsByName.TryGetValue(name, out var p) ? p : null;
        }
        public ClassInfo Class(string id)
        {
            classesById ??= Index(classes, c => c.id);
            return classesById.TryGetValue(id, out var c) ? c : null;
        }
        public ClipInfo Clip(string name)
        {
            clipsByName ??= Index(clips, c => c.name);
            return clipsByName.TryGetValue(name, out var c) ? c : null;
        }
        public GearInfo Gear(string cls, string slot, string tier)
        {
            foreach (var g in gear) if (g.cls == cls && g.slot == slot && g.tier == tier) return g;
            return null;
        }
        /// <summary>The weapon mesh for an item's meshId at a tier, by the GLB's meshIds list; else by weapon type; else null.</summary>
        public WeaponInfo Weapon(string meshId, string weaponType, string tier)
        {
            foreach (var w in weapons) if (w.tier == tier && Array.IndexOf(w.meshIds, meshId) >= 0) return w;
            foreach (var w in weapons) if (w.tier == tier && w.weaponType == weaponType && w.weaponType != "") return w;
            return null;
        }

        static Dictionary<string, T> Index<T>(T[] xs, Func<T, string> key)
        {
            var d = new Dictionary<string, T>();
            if (xs != null) foreach (var x in xs) d[key(x)] = x;
            return d;
        }
    }

    [Serializable] public sealed class ClipEvent { public string name; public float seconds; }
    [Serializable] public sealed class ClipInfo { public string name; public float seconds; public bool loop; public float speed = 1f; public float loopStart; public ClipEvent[] events; }
    [Serializable] public sealed class GroupScale { public string group; public float scale; }
    [Serializable] public sealed class KeyWeight { public string key; public float weight; }
    [Serializable]
    public sealed class PresetInfo { public string id; public string name; public KeyWeight[] face; public string[] parts; public int tintSkin; public int tintHair; public int tintEye; }
    [Serializable]
    public sealed class SpeciesInfo
    {
        public string id;
        public string key;
        public GroupScale[] boneScales;
        public string[] skinTones;
        public string[] hairColors;
        public string[] eyeColors;
        public string[] boneColors;
        public string[] parts;
        public PresetInfo[] presets;

        public float Scale(string group)
        {
            if (boneScales != null) foreach (var b in boneScales) if (b.group == group) return b.scale;
            return float.NaN;
        }
    }
    [Serializable] public sealed class PartInfo { public string name; public string family; public string variant; public string species; public string[] hides; }
    [Serializable] public sealed class GearInfo { public string name; public string cls; public string slot; public string tier; public string[] hides; }
    [Serializable] public sealed class WeaponInfo { public string name; public string kind; public string tier; public string socket; public string weaponType; public string[] meshIds; public int hands; public float offhandY; public string fill; }
    [Serializable] public sealed class HeldInfo { public string itemId; public string kind; public string weaponType; public int hands; public string meshId; public string trimMetal; public string element; public string grade; }
    [Serializable] public sealed class ClassInfo { public string id; public string name; public string gearSetId; public string[] palette; public string armorFamily; public HeldInfo[] held; }

    [Serializable]
    public sealed class MonsterFile
    {
        public BaseClips[] clips;
        public MonsterEntry[] entries;
        public ListedMonster[] list;

        Dictionary<string, MonsterEntry> byKey;
        Dictionary<string, BaseClips> clipsByBase;

        public static MonsterFile Load()
        {
            var asset = Resources.Load<TextAsset>("Monsters/monsters");
            if (asset == null) throw new InvalidOperationException("missing Resources/Monsters/monsters.json — run npm run unity:bundle");
            var f = JsonUtility.FromJson<MonsterFile>(asset.text);
            if (f?.entries == null || f.entries.Length == 0) throw new InvalidOperationException("monsters.json has no entries");
            return f;
        }

        public MonsterEntry Entry(string key)
        {
            if (byKey == null) { byKey = new Dictionary<string, MonsterEntry>(); foreach (var e in entries) byKey[e.key] = e; }
            return byKey.TryGetValue(key, out var m) ? m : null;
        }
        public BaseClips ClipsOf(string baseId)
        {
            if (clipsByBase == null) { clipsByBase = new Dictionary<string, BaseClips>(); foreach (var b in clips) clipsByBase[b.baseId] = b; }
            return clipsByBase.TryGetValue(baseId, out var found) ? found : null;
        }
    }

    [Serializable] public sealed class BaseClips { [SerializeField] string @base; public string baseId => @base; public string animation; public int fps; public ClipInfo[] clips; }
    [Serializable] public sealed class SlotColor { public int slot; public string color; }
    [Serializable] public sealed class ClipPair { public string from; public string to; }
    [Serializable]
    public sealed class MonsterEntry
    {
        public string key;
        [SerializeField] string @base;
        public string baseId => @base;
        public string name;
        public float scale = 1f;
        public string[] parts;
        public KeyWeight[] shapes;
        public string[] palette;
        public string[] colors;
        public SlotColor[] slots;
        public float clipSpeed = 1f;
        public ClipPair[] clipMap;
        public bool heroClips;
        public GroupScale[] boneScales;
        public float[] hipsOffset;
        public bool ghost;
        public string pet;
        public float height;
        public int tris;

        public string MapClip(string from)
        {
            if (clipMap != null) foreach (var p in clipMap) if (p.from == from) return p.to;
            return null;
        }
    }
    [Serializable] public sealed class ListedMonster { public string id; public string name; public string zone; public string entry; public string role; [SerializeField] string @base; public string baseId => @base; public string[] palette; public float scale = 1f; }
}

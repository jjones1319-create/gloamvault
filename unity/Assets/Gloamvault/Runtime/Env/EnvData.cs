using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gloamvault.Env
{
    /// <summary>
    /// The rooms' data as tools/unity/env.ts writes it (Phase 11): the room templates and the four kit manifests,
    /// field for field, in the fixed shape JsonUtility reads. Coordinates are game space (+x east, +z south, metres).
    /// </summary>
    [Serializable]
    public sealed class TemplateFile
    {
        public Template[] templates;

        public static TemplateFile Load()
        {
            var asset = Resources.Load<TextAsset>("Env/templates");
            if (asset == null) throw new InvalidOperationException("missing Resources/Env/templates.json — run npm run unity:bundle");
            var f = JsonUtility.FromJson<TemplateFile>(asset.text);
            if (f?.templates == null || f.templates.Length == 0) throw new InvalidOperationException("templates.json has no templates");
            return f;
        }

        public Template Find(string id)
        {
            foreach (var t in templates) if (t.id == id) return t;
            return null;
        }
    }

    [Serializable]
    public sealed class Template
    {
        public string id;
        public string zoneId;
        /// <summary>cellars · crypts · vault — which kit builds it.</summary>
        public string kit;
        public int w;
        public int h;
        public Door[] doors;
        public CameraSpec camera;
        public Prop[] props;
        public int triBudget;
        public int drawCallBudget;
    }

    [Serializable] public sealed class Door { public string side; public int offset; }
    [Serializable] public sealed class CameraSpec { public float[] position; public float[] lookAt; public float fov; }
    [Serializable] public sealed class Prop { public string meshId; public float[] position; public float rotationY; public bool lightSource; }

    [Serializable]
    public sealed class KitManifest
    {
        public string zone;
        public string[] palette;
        public ZoneLook look;
        public Shell shell;
        public Piece[] pieces;
        public FloorMix[] floorMix;
        public Substitute[] substitute;
        public DoorSkins[] doorSkins;
        public Water water;

        Dictionary<string, Piece> byId;

        public static KitManifest Load(string zone)
        {
            var asset = Resources.Load<TextAsset>("Env/" + zone);
            if (asset == null) throw new InvalidOperationException($"missing Resources/Env/{zone}.json — run npm run unity:bundle");
            var m = JsonUtility.FromJson<KitManifest>(asset.text);
            if (m?.pieces == null) throw new InvalidOperationException($"{zone}.json has no pieces");
            return m;
        }

        public Piece Piece(string meshId)
        {
            if (byId == null)
            {
                byId = new Dictionary<string, Piece>();
                foreach (var p in pieces) byId[p.id] = p;
            }
            return byId.TryGetValue(meshId, out var piece) ? piece : null;
        }

        public Color PaletteColor(int slot) => ColorUtility.TryParseHtmlString(palette[slot], out var c) ? c : Color.magenta;
    }

    [Serializable] public sealed class ZoneLook { public string fog; public string sky; public string ground; public float fogScale; }
    [Serializable] public sealed class Weighted { public string id; public float weight; }
    [Serializable] public sealed class Doorway { public string kind; public string id; }

    [Serializable]
    public sealed class Shell
    {
        public string floor, wall, doorway, corner, wallCut, doorwayCut, cornerCut, floorDirt;
        public Weighted[] floorAlt;
        public Weighted[] wallAlt;
        public string[] floorWhole;
        public Doorway[] doorways;
        public float tile, segment, doorwayWidth, wallHeight, wallThickness, cutHeight;

        public string DoorwayOf(string kind)
        {
            if (doorways != null) foreach (var d in doorways) if (d.kind == kind) return d.id;
            return null;
        }
    }

    [Serializable]
    public sealed class Piece
    {
        public string id;
        public int tris;
        public string role;
        public Bounds3 bounds;
        public Part[] parts;
        public Flame[] lights;
        public Fx[] fx;
        public string mount;
        public bool water;
        /// <summary>1 = opaque; mist 0.22, webs 0.5.</summary>
        public float translucent = 1f;
        public bool doubleSided;
        public bool hasHole;
        /// <summary>x0, z0, x1, z1 in the piece's own space: floor tiles under it are not drawn.</summary>
        public float[] hole;
        public bool extra;
    }

    [Serializable] public sealed class Bounds3 { public float[] min; public float[] max; }
    [Serializable] public sealed class Part { public string name; public string part; public float[] pivot; public string axis; }
    [Serializable] public sealed class Flame { public string name; public string kind; public float[] at; public string color; }
    [Serializable] public sealed class Fx { public string name; public string kind; public float[] at; }
    [Serializable] public sealed class FloorMix { public string templateId; public Weighted[] mix; }
    [Serializable] public sealed class Pair { public string from; public string to; }
    [Serializable] public sealed class Substitute { public string templateId; public Pair[] pairs; }
    [Serializable] public sealed class Skin { public string side; public string id; }
    [Serializable] public sealed class DoorSkins { public string templateId; public Skin[] skins; }
    [Serializable] public sealed class Water { public float knee; public float deep; public float kneeOpacity; }
}

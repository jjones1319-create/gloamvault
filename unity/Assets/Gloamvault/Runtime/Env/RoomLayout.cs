using System;
using System.Collections.Generic;

namespace Gloamvault.Env
{
    /// <summary>
    /// Where a room's pieces go (Phase 11): the port of the web's shell layout (client/src/scene/env/shell.ts and
    /// room/dress.ts), in game space — +x east, +z south, the room centred on the origin, a piece's front +z, yaw as
    /// three.js rotation.y in radians. Floor tiles with a quarter turn each, 2 m wall segments facing in (north 0,
    /// east −π/2, south π, west π/2), doorways at their cell's mid-edge with the walls they cut trimmed, four corner
    /// posts, the camera-facing sides cut low; then the template's props. Plain C#: tested in EditMode, and the
    /// builder turns the placements into pieces.
    /// </summary>
    public static class RoomLayout
    {
        public const float Cell = 8f;
        public const float DoorWidth = 2f;
        public const float WallHeight = 3.5f;
        public const float CutHeight = 0.55f;

        public enum Role { Floor, Wall, Doorway, Corner, Prop }

        public sealed class Placement
        {
            public Role role;
            public string meshId;
            public float x, y, z;
            /// <summary>three.js rotation.y, radians.</summary>
            public float yaw;
            /// <summary>Scale along the piece's length (a trimmed wall) and its height (a cut-away wall).</summary>
            public float sx = 1f, sy = 1f;
            /// <summary>On the side cut away toward the camera (a wall-hung prop there is not drawn).</summary>
            public bool low;
            public string side;
            public bool lightSource;
        }

        public struct Rect { public float x0, z0, x1, z1; }

        static readonly string[] Sides = { "north", "east", "south", "west" };

        public static (float x, float z) SideNormal(string side) => side switch
        {
            "north" => (0, -1),
            "south" => (0, 1),
            "east" => (1, 0),
            "west" => (-1, 0),
            _ => (0, 1),
        };

        /// <summary>The yaw that turns a piece's +z front into the room from a side.</summary>
        public static float InwardYaw(string side)
        {
            var (nx, nz) = SideNormal(side);
            return (float)Math.Atan2(0 - nx, 0 - nz);
        }

        /// <summary>A side whose outward normal points toward the camera (the horizontal direction from the look-at to the camera).</summary>
        public static bool FacesCamera(string side, float camX, float camZ)
        {
            var (nx, nz) = SideNormal(side);
            return nx * camX + nz * camZ > 0.5f;
        }

        /// <summary>The web's `rolls` (shell.ts): a small deterministic roll generator, never the sim's RNG.</summary>
        public sealed class Rolls
        {
            int a;
            public Rolls(int seed) { a = seed ^ 0x2545f491; }
            public float Next()
            {
                unchecked
                {
                    a = a + 0x6d2b79f5;
                    int t = (a ^ (int)((uint)a >> 15)) * (1 | a);
                    t = (t + (t ^ (int)((uint)t >> 7)) * (61 | t)) ^ t;
                    return (uint)(t ^ (int)((uint)t >> 14)) / 4294967296f;
                }
            }
        }

        /// <summary>The web's `scenicRandom` (layout.ts): a mulberry32 for the room-wide rolls.</summary>
        public static Func<float> ScenicRandom(int seed)
        {
            uint s = (uint)seed ^ 0x9e3779b9u;
            return () =>
            {
                unchecked
                {
                    s += 0x6D2B79F5u;
                    uint t = s;
                    t = (t ^ (t >> 15)) * (t | 1u);
                    t ^= t + (t ^ (t >> 7)) * (t | 61u);
                    return ((t ^ (t >> 14)) >> 0) / 4294967296f;
                }
            };
        }

        /// <summary>[a, b] minus the holes, as intervals at least `min` long.</summary>
        public static List<(float, float)> SubtractIntervals(float a, float b, List<(float, float)> holes, float min = 0.05f)
        {
            var parts = new List<(float, float)> { (a, b) };
            foreach (var (h0, h1) in holes)
            {
                var next = new List<(float, float)>();
                foreach (var (p, q) in parts)
                {
                    if (h1 <= p || h0 >= q) { next.Add((p, q)); continue; }
                    if (h0 > p) next.Add((p, h0));
                    if (h1 < q) next.Add((h1, q));
                }
                parts = next;
            }
            return parts.FindAll(pq => pq.Item2 - pq.Item1 >= min);
        }

        public static List<(float x, float z)> FloorTiles(float width, float depth, List<Rect> holes, float tile = 2f)
        {
            var o = new List<(float, float)>();
            for (float x = -width / 2 + tile / 2; x < width / 2; x += tile)
                for (float z = -depth / 2 + tile / 2; z < depth / 2; z += tile)
                {
                    bool inHole = false;
                    foreach (var r in holes) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) { inHole = true; break; }
                    if (!inHole) o.Add((x, z));
                }
            return o;
        }

        /// <summary>A piece's own hole rectangle placed in the room (the web's placedRect).</summary>
        public static Rect PlacedRect(float x0, float z0, float x1, float z1, float px, float pz, float yaw)
        {
            float c = (float)Math.Cos(yaw), s = (float)Math.Sin(yaw);
            var xs = new float[4]; var zs = new float[4];
            int i = 0;
            foreach (var (lx, lz) in new[] { (x0, z0), (x1, z0), (x0, z1), (x1, z1) })
            {
                // three.js rotation.y: x' = x cos + z sin, z' = −x sin + z cos
                xs[i] = px + lx * c + lz * s;
                zs[i] = pz - lx * s + lz * c;
                i++;
            }
            return new Rect { x0 = Math.Min(Math.Min(xs[0], xs[1]), Math.Min(xs[2], xs[3])), x1 = Math.Max(Math.Max(xs[0], xs[1]), Math.Max(xs[2], xs[3])), z0 = Math.Min(Math.Min(zs[0], zs[1]), Math.Min(zs[2], zs[3])), z1 = Math.Max(Math.Max(zs[0], zs[1]), Math.Max(zs[2], zs[3])) };
        }

        /// <summary>Picks by cumulative weight: the base piece carries what the alternates leave (1 − Σ their weights).</summary>
        public static string PickWeighted(string baseId, Weighted[] alts, float roll)
        {
            float sum = 0;
            if (alts != null) foreach (var a in alts) sum += a.weight;
            float r = roll * Math.Max(1f, sum);
            float acc = Math.Max(0f, 1f - sum);
            if (r < acc || alts == null) return baseId;
            foreach (var a in alts)
            {
                acc += a.weight;
                if (r < acc) return a.id;
            }
            return baseId;
        }

        /// <summary>
        /// The shell and the props of a template, in game space. `camX, camZ` is the horizontal direction from the
        /// look-at point to the camera; `variation` is the room's variant seed (0 in the viewer).
        /// </summary>
        public static List<Placement> Build(Template t, KitManifest kit, KitManifest shared, float camX, float camZ, int variation = 0, IDictionary<string, string> doorKinds = null)
        {
            var o = new List<Placement>();
            var shell = kit.shell;
            float width = t.w * Cell, depth = t.h * Cell;
            Piece pieceOf(string id) => kit.Piece(id) ?? shared?.Piece(id);

            // Holes in the floor: every prop whose piece opens its own (deep water, a bone grate, a sluice channel).
            var holes = new List<Rect>();
            var propYaws = new float[t.props.Length];
            for (int i = 0; i < t.props.Length; i++)
            {
                var p = t.props[i];
                propYaws[i] = p.rotationY * (float)Math.PI / 180f;
                var piece = pieceOf(p.meshId);
                if (piece != null && piece.hasHole) holes.Add(PlacedRect(piece.hole[0], piece.hole[1], piece.hole[2], piece.hole[3], p.position[0], p.position[2], propYaws[i]));
            }

            // The doorway piece's width along x (what it covers), clamped as the web does.
            var doorwayPiece = pieceOf(shell.doorway);
            float doorwayWidth = doorwayPiece != null ? Math.Min(6f, Math.Max(DoorWidth, doorwayPiece.bounds.max[0] - doorwayPiece.bounds.min[0])) : DoorWidth;
            bool cutDoorways = !string.IsNullOrEmpty(shell.doorway) && !string.IsNullOrEmpty(shell.doorwayCut);

            var roll = new Rolls((variation + 1) * 7919 + t.w * 31 + t.h);

            // Floors: an earth floor covers the whole room or none of it; else the flagstones' variants tile by tile.
            string floorBase = shell.floor;
            Weighted[] floorAlts = shell.floorAlt;
            foreach (var fm in kit.floorMix ?? Array.Empty<FloorMix>())
                if (fm.templateId == t.id && fm.mix != null && fm.mix.Length > 0) { floorBase = fm.mix[0].id; floorAlts = fm.mix.Length > 1 ? fm.mix[1..] : Array.Empty<Weighted>(); }
            var whole = new HashSet<string>(shell.floorWhole ?? Array.Empty<string>());
            string everywhere = null;
            if (whole.Count > 0)
            {
                float roomRoll = ScenicRandom(variation * 131 + 7)();
                var pick = PickWeighted(floorBase, floorAlts, roomRoll);
                if (whole.Contains(pick)) everywhere = pick;
            }
            foreach (var (x, z) in FloorTiles(width, depth, holes, shell.tile > 0 ? shell.tile : 2f))
            {
                int turn = (int)Math.Floor(roll.Next() * 4);
                float r = roll.Next();
                string id = everywhere ?? PickWeighted(floorBase, floorAlts, r);
                if (everywhere == null && whole.Contains(id)) id = floorBase;
                o.Add(new Placement { role = Role.Floor, meshId = id, x = x, z = z, yaw = turn * (float)Math.PI / 2 });
            }

            // Walls and doorways, side by side.
            var skins = new List<Skin>();
            foreach (var ds in kit.doorSkins ?? Array.Empty<DoorSkins>()) if (ds.templateId == t.id && ds.skins != null) skins.AddRange(ds.skins);
            string skinFor(string side)
            {
                foreach (var s in skins) if (s.side == "*" || s.side == side) return pieceOf(s.id) != null ? s.id : null;
                return null;
            }
            float wallLength = shell.segment > 0 ? shell.segment : 2f;
            float cutaway = (shell.cutHeight > 0 ? shell.cutHeight : CutHeight) / (shell.wallHeight > 0 ? shell.wallHeight : WallHeight);
            foreach (var side in Sides)
            {
                var (nx, nz) = SideNormal(side);
                bool low = FacesCamera(side, camX, camZ);
                bool alongX = side == "north" || side == "south";
                float length = alongX ? width : depth;
                float edge = alongX ? nz * depth / 2 : nx * width / 2;
                float yaw = InwardYaw(side);
                (float x, float z) at(float along) => alongX ? (along, edge) : (edge, along);
                var gaps = new List<(float, float)>();
                foreach (var d in t.doors)
                {
                    if (d.side != side) continue;
                    float c = -length / 2 + (d.offset + 0.5f) * Cell;
                    bool piece = !low || cutDoorways;
                    float half = (piece ? Math.Max(0.5f, doorwayWidth) : DoorWidth) / 2;
                    gaps.Add((c - half, c + half));
                    if (piece)
                    {
                        var (px, pz) = at(c);
                        // The door's kind for this side (a floor's data, or the walk viewer's choice), else the template's skin, else the open arch.
                        string kindId = doorKinds != null && doorKinds.TryGetValue(side, out var kind) && !string.IsNullOrEmpty(kind) ? shell.DoorwayOf(kind) : null;
                        string id = low ? shell.doorwayCut : (kindId ?? skinFor(side) ?? shell.doorway);
                        if (string.IsNullOrEmpty(id)) id = shell.doorway;
                        o.Add(new Placement { role = Role.Doorway, meshId = id, x = px, z = pz, yaw = yaw, low = low, side = side });
                        roll.Next();
                    }
                }
                int segments = Math.Max(1, (int)Math.Round(length / wallLength));
                float seg = length / segments;
                for (int i = 0; i < segments; i++)
                {
                    float a = -length / 2 + i * seg;
                    foreach (var (p, q) in SubtractIntervals(a, a + seg, gaps))
                    {
                        float mid = (p + q) / 2;
                        var (px, pz) = at(mid);
                        float r = roll.Next();
                        string id = low ? shell.wallCut : PickWeighted(shell.wall, shell.wallAlt, r);
                        if (string.IsNullOrEmpty(id)) id = shell.wall;
                        o.Add(new Placement { role = Role.Wall, meshId = id, x = px, z = pz, yaw = yaw, sx = (q - p) / wallLength, sy = low ? cutaway : 1f, low = low, side = side });
                    }
                }
            }

            // The corner posts turn with the walls they start: NW 0, NE −π/2, SE π, SW π/2.
            var corners = new (int sx, int sz, string a, string b, float yaw)[]
            {
                (-1, -1, "north", "west", 0f),
                (1, -1, "north", "east", -(float)Math.PI / 2),
                (1, 1, "south", "east", (float)Math.PI),
                (-1, 1, "south", "west", (float)Math.PI / 2),
            };
            foreach (var (sx, sz, a, b, yaw) in corners)
            {
                bool low = FacesCamera(a, camX, camZ) || FacesCamera(b, camX, camZ);
                string id = low && !string.IsNullOrEmpty(shell.cornerCut) ? shell.cornerCut : shell.corner;
                o.Add(new Placement { role = Role.Corner, meshId = id, x = sx * width / 2, z = sz * depth / 2, yaw = yaw, sy = low ? cutaway : 1f, low = low });
                roll.Next();
            }

            // The props: a substitute where the kit says so; a wall-hung piece on the cut-away side is not drawn.
            var subs = new Dictionary<string, string>();
            foreach (var s in kit.substitute ?? Array.Empty<Substitute>()) if (s.templateId == t.id && s.pairs != null) foreach (var pr in s.pairs) subs[pr.from] = pr.to;
            for (int i = 0; i < t.props.Length; i++)
            {
                var p = t.props[i];
                string id = subs.TryGetValue(p.meshId, out var to) ? to : p.meshId;
                var piece = pieceOf(id);
                bool wallHung = piece != null && (piece.mount == "wall" || piece.mount == "shell" || piece.role == "wall-hung");
                bool low = false;
                if (wallHung)
                {
                    // Which side it hangs on: the nearest edge.
                    float dx = width / 2 - Math.Abs(p.position[0]), dz = depth / 2 - Math.Abs(p.position[2]);
                    string side = dx < dz ? (p.position[0] > 0 ? "east" : "west") : (p.position[2] > 0 ? "south" : "north");
                    low = FacesCamera(side, camX, camZ);
                }
                o.Add(new Placement { role = Role.Prop, meshId = id, x = p.position[0], y = p.position[1], z = p.position[2], yaw = propYaws[i], low = low, lightSource = p.lightSource });
            }
            return o;
        }
    }
}

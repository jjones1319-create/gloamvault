using System;
using System.Collections.Generic;
using Gloamvault.Env;

namespace Gloamvault.Level
{
    /// <summary>
    /// A level: many rooms on one grid of 8 m cells, joined door to door (Phase 14, D-163). Coordinates are game
    /// space (+x east, +z south; a cell is <see cref="RoomLayout.Cell"/> metres); the builder turns them into Unity's
    /// through the kits' axes. Phase 15 lays Floor 1 out as data of this shape; the test level generates it.
    /// </summary>
    public sealed class Level
    {
        public int seed;
        public int gridW, gridH;
        public int entryId;
        public readonly List<LevelRoom> rooms = new();
        public readonly List<LevelJoin> joins = new();
        /// <summary>Every template the level uses, the halls made in code included.</summary>
        public readonly Dictionary<string, Template> templates = new();
        /// <summary>The kind a door with no neighbour gets: the kit's barred door in the test level, a wall on a laid-out floor (Phase 15).</summary>
        public string unmatchedKind = "locked";
        /// <summary>A door kind set by name for one room's side (a floor's exits are open arches): (room id, side) → kind.</summary>
        public readonly Dictionary<(int room, string side), string> sideKinds = new();
        int[] cells;

        public int FloorCells { get { int n = 0; foreach (var r in rooms) n += r.w * r.h; return n; } }
        public int Halls { get { int n = 0; foreach (var r in rooms) if (r.hall) n++; return n; } }

        public Template TemplateOf(LevelRoom r) => templates[r.templateId];

        public void IndexCells()
        {
            cells = new int[gridW * gridH];
            Array.Fill(cells, -1);
            foreach (var r in rooms)
                for (int y = r.gy; y < r.gy + r.h; y++)
                    for (int x = r.gx; x < r.gx + r.w; x++)
                        cells[y * gridW + x] = r.id;
        }

        public LevelRoom RoomAt(int cx, int cy)
        {
            if (cells == null) IndexCells();
            if (cx < 0 || cy < 0 || cx >= gridW || cy >= gridH) return null;
            int id = cells[cy * gridW + cx];
            return id < 0 ? null : rooms[id];
        }

        /// <summary>The room under a game-space point (metres), or null between rooms.</summary>
        public LevelRoom RoomAtPoint(float x, float z) => RoomAt((int)Math.Floor(x / RoomLayout.Cell), (int)Math.Floor(z / RoomLayout.Cell));

        public IEnumerable<(LevelJoin join, LevelRoom other)> Neighbours(LevelRoom r)
        {
            foreach (var ji in r.joins)
            {
                var j = joins[ji];
                yield return (j, rooms[j.a == r.id ? j.b : j.a]);
            }
        }

        /// <summary>The door kind per side the builder gets: a join's kind on its owner (the lower id), the open arch on the other, the kit's locked kind where no neighbour is.</summary>
        public Dictionary<string, string> DoorKindsFor(LevelRoom r)
        {
            var kinds = new Dictionary<string, string>();
            foreach (var d in TemplateOf(r).doors)
            {
                if (sideKinds.TryGetValue((r.id, d.side), out var set)) kinds[d.side] = set;
                else if (r.joinBySide.TryGetValue(d.side, out int ji)) kinds[d.side] = joins[ji].a == r.id ? joins[ji].kind : "open";
                else kinds[d.side] = unmatchedKind;
            }
            return kinds;
        }

        /// <summary>FNV-1a over the rooms and joins: the same seed must give the same level.</summary>
        public uint Hash()
        {
            uint h = 2166136261;
            void Mix(int v) { unchecked { h ^= (uint)v; h *= 16777619; } }
            void MixS(string s) { foreach (var c in s) Mix(c); }
            Mix(rooms.Count); Mix(joins.Count);
            foreach (var r in rooms) { Mix(r.id); MixS(r.templateId); Mix(r.gx); Mix(r.gy); Mix(r.variation); }
            foreach (var j in joins) { Mix(j.a); Mix(j.b); MixS(j.sideA); Mix(j.offsetA); MixS(j.kind); }
            return h;
        }
    }

    public sealed class LevelRoom
    {
        public int id;
        public string templateId;
        public string kit;
        public int gx, gy, w, h;
        public int variation;
        public bool hall;
        public readonly List<int> joins = new();
        /// <summary>side → index into the level's joins, for every door that met a neighbour.</summary>
        public readonly Dictionary<string, int> joinBySide = new();

        public float CentreX => (gx + w / 2f) * RoomLayout.Cell;
        public float CentreZ => (gy + h / 2f) * RoomLayout.Cell;
        public bool Contains(int cx, int cy) => cx >= gx && cx < gx + w && cy >= gy && cy < gy + h;
        public bool Overlaps(int ox, int oy, int ow, int oh) => ox < gx + w && ox + ow > gx && oy < gy + h && oy + oh > gy;
    }

    /// <summary>Where two rooms' doors meet: the shared cell edge. The lower id (a) owns the leaf.</summary>
    public sealed class LevelJoin
    {
        public int a, b;
        public string sideA;
        public int offsetA;
        /// <summary>The door kind on a's side: open, wood, gate, locked (the kit's leafed kinds; "locked" is the Vault's leaf and the kit's barred door elsewhere).</summary>
        public string kind = "open";
        /// <summary>The edge's midpoint in game space (metres).</summary>
        public float x, z;
    }
}

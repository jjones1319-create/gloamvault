using System;
using System.Collections.Generic;
using Gloamvault.Env;

namespace Gloamvault.Level
{
    /// <summary>
    /// The test level (Phase 14, D-163): a seeded frontier walk over the 30 templates — start at an entry room, keep
    /// the open doors as a frontier, and behind each put a template of the region's kit that has a door facing it,
    /// door to door, when its footprint is free. Halls (1 × 1–3 cells of the kit's walls, a door at each end) stand in
    /// for tunnels (D-164). Regions by x-thirds: Cellars west, Crypts middle, Vault east. Deterministic by seed;
    /// a full grid simply ends the walk early.
    /// </summary>
    public static class TestLevelGenerator
    {
        public const int DefaultGridW = 28, DefaultGridH = 20, DefaultRooms = 60;
        public const int HallChance = 35, LeafChance = 30, EastDrift = 50;
        public static readonly string[] Sides = { "north", "east", "south", "west" };

        public static string Opposite(string side) => side switch { "north" => "south", "south" => "north", "east" => "west", _ => "east" };
        public static string KitAt(int cx, int gridW) => cx < gridW / 3 ? "cellars" : cx < 2 * gridW / 3 ? "crypts" : "vault";
        public static string LeafKind(string kit) => kit == "crypts" ? "gate" : kit == "vault" ? "locked" : "wood";

        /// <summary>The cell beyond a door, outside the room.</summary>
        public static (int x, int y) BeyondDoor(LevelRoom r, string side, int offset) => side switch
        {
            "north" => (r.gx + offset, r.gy - 1),
            "south" => (r.gx + offset, r.gy + r.h),
            "east" => (r.gx + r.w, r.gy + offset),
            _ => (r.gx - 1, r.gy + offset),
        };

        /// <summary>The room's own cell a door sits on.</summary>
        public static (int x, int y) DoorCell(LevelRoom r, string side, int offset) => side switch
        {
            "north" => (r.gx + offset, r.gy),
            "south" => (r.gx + offset, r.gy + r.h - 1),
            "east" => (r.gx + r.w - 1, r.gy + offset),
            _ => (r.gx, r.gy + offset),
        };

        /// <summary>Where a template goes so that its door (side, offset) sits on cell (tx, ty).</summary>
        public static (int gx, int gy) OriginFor(Template t, string side, int offset, int tx, int ty) => side switch
        {
            "north" => (tx - offset, ty),
            "south" => (tx - offset, ty - t.h + 1),
            "west" => (tx, ty - offset),
            _ => (tx - t.w + 1, ty - offset),
        };

        public static Template HallTemplate(string kit, int n, bool vertical)
        {
            var t = new Template
            {
                id = $"hall-{kit}-{(vertical ? "v" : "h")}{n}",
                zoneId = kit, kit = kit,
                w = vertical ? 1 : n, h = vertical ? n : 1,
                doors = vertical
                    ? new[] { new TemplateDoor { side = "north", offset = 0 }, new TemplateDoor { side = "south", offset = 0 } }
                    : new[] { new TemplateDoor { side = "west", offset = 0 }, new TemplateDoor { side = "east", offset = 0 } },
                camera = new CameraSpec { position = new[] { 0f, 7.5f, -10.6f }, lookAt = new[] { 0f, 1f, 0f }, fov = 40 },
                props = Array.Empty<Prop>(),
                triBudget = 20000, drawCallBudget = 20,
            };
            return t;
        }

        public static Level Generate(int seed, int roomTarget = DefaultRooms, int gridW = DefaultGridW, int gridH = DefaultGridH, Template[] templates = null)
        {
            templates ??= TemplateFile.Load().templates;
            var rng = new System.Random(seed);
            var level = new Level { seed = seed, gridW = gridW, gridH = gridH };
            var occ = new int[gridW * gridH];
            Array.Fill(occ, -1);
            var byKit = new Dictionary<string, List<Template>>();
            foreach (var t in templates)
            {
                if (!byKit.TryGetValue(t.kit, out var list)) byKit[t.kit] = list = new List<Template>();
                list.Add(t);
            }

            // The entry: the Cellars' one-cell room with a door on every side, in the Cellars region's middle.
            Template entry = null;
            foreach (var t in byKit["cellars"]) if (t.w == 1 && t.h == 1 && t.doors.Length == 4) { entry = t; break; }
            entry ??= byKit["cellars"][0];
            var first = Place(level, occ, entry, Math.Max(0, gridW / 6), Math.Max(0, gridH / 2 - entry.h / 2), "cellars", false, rng);
            level.entryId = first.id;
            var frontier = new List<(int room, string side, int offset)>();
            foreach (var d in entry.doors) frontier.Add((first.id, d.side, d.offset));

            while (level.rooms.Count < roomTarget && frontier.Count > 0)
            {
                // Half the steps take the eastmost open door, so the walk drifts across the three regions (a long level to cross).
                int pick = rng.Next(frontier.Count);
                if (rng.Next(100) < EastDrift)
                {
                    int bestX = int.MinValue;
                    for (int k = 0; k < frontier.Count; k++)
                    {
                        var (bx, _) = BeyondDoor(level.rooms[frontier[k].room], frontier[k].side, frontier[k].offset);
                        if (bx > bestX) { bestX = bx; pick = k; }
                    }
                }
                var f = frontier[pick];
                frontier.RemoveAt(pick);
                var room = level.rooms[f.room];
                if (room.joinBySide.ContainsKey(f.side)) continue;
                var (tx, ty) = BeyondDoor(room, f.side, f.offset);
                if (tx < 0 || ty < 0 || tx >= gridW || ty >= gridH) continue;
                if (occ[ty * gridW + tx] >= 0) { TryJoinExisting(level, room, f.side, f.offset, level.rooms[occ[ty * gridW + tx]], rng); continue; }

                string kit = KitAt(tx, gridW);
                string opp = Opposite(f.side);
                var cands = new List<Template>();
                if (rng.Next(100) < HallChance) cands.Add(HallTemplate(kit, 1 + rng.Next(3), f.side == "north" || f.side == "south"));
                var pool = new List<Template>();
                foreach (var t in byKit[kit]) foreach (var d in t.doors) if (d.side == opp) { pool.Add(t); break; }
                for (int i = pool.Count - 1; i > 0; i--) { int j = rng.Next(i + 1); (pool[i], pool[j]) = (pool[j], pool[i]); }
                cands.AddRange(pool);

                foreach (var t in cands)
                {
                    TemplateDoor door = null;
                    foreach (var d in t.doors) if (d.side == opp) { door = d; break; }
                    var (gx, gy) = OriginFor(t, opp, door.offset, tx, ty);
                    if (!Fits(occ, gridW, gridH, gx, gy, t.w, t.h)) continue;
                    var nr = Place(level, occ, t, gx, gy, kit, t.id.StartsWith("hall-"), rng);
                    string kind = rng.Next(100) < LeafChance ? LeafKind(room.kit) : "open";
                    Join(level, room, f.side, f.offset, nr, opp, door.offset, kind);
                    foreach (var od in t.doors)
                    {
                        if (od.side == opp && od.offset == door.offset) continue;
                        var (ox, oy) = BeyondDoor(nr, od.side, od.offset);
                        if (ox < 0 || oy < 0 || ox >= gridW || oy >= gridH) continue;
                        int other = occ[oy * gridW + ox];
                        if (other >= 0) TryJoinExisting(level, nr, od.side, od.offset, level.rooms[other], rng);
                        else frontier.Add((nr.id, od.side, od.offset));
                    }
                    break;
                }
            }
            level.IndexCells();
            return level;
        }

        static bool Fits(int[] occ, int gridW, int gridH, int gx, int gy, int w, int h)
        {
            if (gx < 0 || gy < 0 || gx + w > gridW || gy + h > gridH) return false;
            for (int y = gy; y < gy + h; y++) for (int x = gx; x < gx + w; x++) if (occ[y * gridW + x] >= 0) return false;
            return true;
        }

        static LevelRoom Place(Level level, int[] occ, Template t, int gx, int gy, string kit, bool hall, System.Random rng)
        {
            var r = new LevelRoom { id = level.rooms.Count, templateId = t.id, kit = kit, gx = gx, gy = gy, w = t.w, h = t.h, variation = rng.Next(100), hall = hall };
            level.rooms.Add(r);
            level.templates[t.id] = t;
            for (int y = gy; y < gy + t.h; y++) for (int x = gx; x < gx + t.w; x++) occ[y * level.gridW + x] = r.id;
            return r;
        }

        /// <summary>A door that meets an already placed room: joined when that room has a door facing back on the same edge.</summary>
        static void TryJoinExisting(Level level, LevelRoom room, string side, int offset, LevelRoom other, System.Random rng)
        {
            if (other.id == room.id || room.joinBySide.ContainsKey(side)) return;
            string opp = Opposite(side);
            var mine = DoorCell(room, side, offset);
            foreach (var d in level.TemplateOf(other).doors)
            {
                if (d.side != opp || other.joinBySide.ContainsKey(opp)) continue;
                if (BeyondDoor(other, opp, d.offset) != mine) continue;
                string kind = rng.Next(100) < LeafChance ? LeafKind(room.id < other.id ? room.kit : other.kit) : "open";
                Join(level, room, side, offset, other, opp, d.offset, kind);
                return;
            }
        }

        static void Join(Level level, LevelRoom r1, string side1, int off1, LevelRoom r2, string side2, int off2, string kind)
        {
            bool firstOwns = r1.id < r2.id;
            var a = firstOwns ? r1 : r2; var sideA = firstOwns ? side1 : side2; int offsetA = firstOwns ? off1 : off2;
            var b = firstOwns ? r2 : r1;
            var j = new LevelJoin { a = a.id, b = b.id, sideA = sideA, offsetA = offsetA, kind = kind };
            float cell = RoomLayout.Cell;
            switch (sideA)
            {
                case "north": j.x = (a.gx + offsetA + 0.5f) * cell; j.z = a.gy * cell; break;
                case "south": j.x = (a.gx + offsetA + 0.5f) * cell; j.z = (a.gy + a.h) * cell; break;
                case "east": j.x = (a.gx + a.w) * cell; j.z = (a.gy + offsetA + 0.5f) * cell; break;
                default: j.x = a.gx * cell; j.z = (a.gy + offsetA + 0.5f) * cell; break;
            }
            int index = level.joins.Count;
            level.joins.Add(j);
            r1.joins.Add(index); r2.joins.Add(index);
            r1.joinBySide[side1] = index; r2.joinBySide[side2] = index;
        }
    }
}

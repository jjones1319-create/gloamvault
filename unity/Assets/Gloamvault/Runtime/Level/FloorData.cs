using System;
using System.Collections.Generic;
using Gloamvault.Env;
using UnityEngine;

namespace Gloamvault.Level
{
    /// <summary>
    /// A hand-laid floor as tools/unity/env.ts writes it from content/dungeons/*/floors/*.json (Phase 15, D-150):
    /// the fixed shape JsonUtility reads. Coordinates are game space; a spot's x,z are metres from its room's centre.
    /// </summary>
    [Serializable]
    public sealed class FloorFile
    {
        public FloorDef[] floors;

        public static FloorFile Load()
        {
            var asset = Resources.Load<TextAsset>("Env/floors");
            if (asset == null) throw new InvalidOperationException("missing Resources/Env/floors.json — run npm run unity:bundle");
            var f = JsonUtility.FromJson<FloorFile>(asset.text);
            if (f?.floors == null) throw new InvalidOperationException("floors.json has no floors");
            return f;
        }

        public FloorDef Find(string id)
        {
            foreach (var d in floors) if (d.id == id) return d;
            return null;
        }
    }

    [Serializable]
    public sealed class FloorDef
    {
        public string id, dungeonId, zoneId, kit;
        public int floor, gridW, gridH;
        public FloorRoomDef[] rooms;
        public FloorJoinDef[] joins;
        public FloorLeverDef[] levers;
        public FloorExitDef[] exits;
        public FloorSpotDef[] spots;
    }

    [Serializable] public sealed class FloorRoomDef { public int id, gx, gy, variation; public string templateId, role, name; }
    [Serializable] public sealed class FloorJoinDef { public int a, b, offsetA; public string sideA, kind; }
    [Serializable] public sealed class FloorLeverDef { public string id; public int room, opens; public float x, z; }
    [Serializable] public sealed class FloorExitDef { public string id, kind, side, name; public int room; }
    [Serializable] public sealed class FloorSpotDef { public string kind, id; public int room; public float x, z; }

    /// <summary>
    /// A floor in play: its <see cref="Level"/> (the rooms and joins the builder and streamer take) plus what the
    /// level alone does not carry — which joins are secret panels or lever gates, the levers, the exits, the spots.
    /// </summary>
    public sealed class Floor
    {
        public FloorDef def;
        public Level level;
        /// <summary>Join indices that are secret panels (the kit's secret piece on the owner's side, found with A).</summary>
        public readonly HashSet<int> secretJoins = new();
        /// <summary>Join indices that are lever gates (the kit's barred door, lifted by a lever).</summary>
        public readonly HashSet<int> leverJoins = new();
        /// <summary>Join indices locked until the floor's key.</summary>
        public readonly HashSet<int> lockedJoins = new();
        public readonly Dictionary<int, FloorRoomDef> roomDefs = new();

        public string Id => def.id;
        public LevelRoom Entry => level.rooms[level.entryId];
        public LevelRoom StairsRoom { get { foreach (var e in def.exits) if (e.kind == "stairs") return level.rooms[e.room]; return null; } }
        public string RoleOf(int roomId) => roomDefs.TryGetValue(roomId, out var r) && !string.IsNullOrEmpty(r.role) ? r.role : "plain";
        public string NameOf(int roomId) => roomDefs.TryGetValue(roomId, out var r) && !string.IsNullOrEmpty(r.name) ? r.name : level.rooms[roomId].templateId;

        /// <summary>The exit sitting in a room's unjoined door, if any.</summary>
        public FloorExitDef ExitAt(int roomId, string side)
        {
            foreach (var e in def.exits) if (e.room == roomId && e.side == side && e.kind != "stairs") return e;
            return null;
        }
    }

    /// <summary>Turns a <see cref="FloorDef"/> into a <see cref="Floor"/>: the templates looked up (halls made in code), the joins' midpoints computed, the kinds sorted.</summary>
    public static class FloorLayout
    {
        public static Floor Load(string floorId) => Build(FloorFile.Load().Find(floorId) ?? throw new InvalidOperationException("no floor " + floorId), TemplateFile.Load().templates);

        public static Floor Build(FloorDef def, Template[] templates)
        {
            var byId = new Dictionary<string, Template>();
            foreach (var t in templates) byId[t.id] = t;
            var floor = new Floor { def = def, level = new Level { seed = 0, gridW = def.gridW, gridH = def.gridH } };
            var level = floor.level;
            foreach (var r in def.rooms)
            {
                var t = TemplateFor(r.templateId, byId, def.kit);
                level.templates[t.id] = t;
                level.rooms.Add(new LevelRoom { id = r.id, templateId = t.id, kit = def.kit, gx = r.gx, gy = r.gy, w = t.w, h = t.h, variation = r.variation, hall = r.templateId.StartsWith("hall-") });
                floor.roomDefs[r.id] = r;
                if (r.role == "entry") level.entryId = r.id;
            }
            for (int i = 0; i < def.joins.Length; i++)
            {
                var j = def.joins[i];
                var a = level.rooms[j.a];
                var lj = new LevelJoin { a = j.a, b = j.b, sideA = j.sideA, offsetA = j.offsetA, kind = KitKind(j.kind) };
                float cell = RoomLayout.Cell;
                switch (j.sideA)
                {
                    case "north": lj.x = (a.gx + j.offsetA + 0.5f) * cell; lj.z = a.gy * cell; break;
                    case "south": lj.x = (a.gx + j.offsetA + 0.5f) * cell; lj.z = (a.gy + a.h) * cell; break;
                    case "east": lj.x = (a.gx + a.w) * cell; lj.z = (a.gy + j.offsetA + 0.5f) * cell; break;
                    default: lj.x = a.gx * cell; lj.z = (a.gy + j.offsetA + 0.5f) * cell; break;
                }
                level.joins.Add(lj);
                level.rooms[j.a].joins.Add(i); level.rooms[j.b].joins.Add(i);
                level.rooms[j.a].joinBySide[j.sideA] = i;
                level.rooms[j.b].joinBySide[TestLevelGenerator.Opposite(j.sideA)] = i;
                if (j.kind == "secret") floor.secretJoins.Add(i);
                else if (j.kind == "lever") floor.leverJoins.Add(i);
                else if (j.kind == "locked") floor.lockedJoins.Add(i);
            }
            // A door with no neighbour is walled, unless an exit sits in it (the open arch, the way out beyond).
            level.unmatchedKind = "wall";
            foreach (var e in def.exits) if (e.kind != "stairs" && !string.IsNullOrEmpty(e.side)) level.sideKinds[(e.room, e.side)] = "open";
            level.IndexCells();
            return floor;
        }

        /// <summary>The kit's door kind for a floor join: a lever gate is the kit's barred door ("locked" in the manifests); the rest are named the same.</summary>
        public static string KitKind(string kind) => kind == "lever" ? "locked" : kind;

        static Template TemplateFor(string id, Dictionary<string, Template> byId, string kit)
        {
            if (byId.TryGetValue(id, out var t)) return t;
            var m = System.Text.RegularExpressions.Regex.Match(id, @"^hall-([a-z]+)-([hv])(\d)$");
            if (!m.Success) throw new InvalidOperationException("no template " + id);
            var hall = TestLevelGenerator.HallTemplate(m.Groups[1].Value, int.Parse(m.Groups[3].Value), m.Groups[2].Value == "v");
            byId[id] = hall;
            return hall;
        }
    }
}

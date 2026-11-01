using System.Collections.Generic;
using Gloamvault.Env;
using UnityEngine;
using UnityEngine.UIElements;

namespace Gloamvault.Level
{
    /// <summary>
    /// The map that fills in as you explore (Phase 15, D-149): rooms you have stood in drawn, rooms behind a door you
    /// know outlined with "?", the rest dark; doors as bars on the shared edge (locked and lever gates marked, secret
    /// panels only once found); the entrance, the stairs and the exits found as glyphs; you as a dot with a heading.
    /// The web's rules (mapLayout.ts): visited · glimpsed · unknown, per room. Pure, so the tests can read it.
    /// </summary>
    public static class FloorMapLayout
    {
        public enum Status { Unknown, Glimpsed, Visited, Current }

        public static Status StatusOf(Floor floor, FloorState state, int roomId, int currentRoom)
        {
            if (roomId == currentRoom) return Status.Current;
            if (state.visited.Contains(roomId)) return Status.Visited;
            // Glimpsed: a visited neighbour through a join you know (not an unfound secret).
            var room = floor.level.rooms[roomId];
            foreach (var ji in room.joins)
            {
                if (!JoinKnown(floor, state, ji)) continue;
                var j = floor.level.joins[ji];
                int other = j.a == roomId ? j.b : j.a;
                if (state.visited.Contains(other)) return Status.Glimpsed;
            }
            return Status.Unknown;
        }

        /// <summary>A join shows once a room on either side has been stood in, unless it is a secret panel not yet found.</summary>
        public static bool JoinKnown(Floor floor, FloorState state, int joinIndex)
        {
            if (floor.secretJoins.Contains(joinIndex) && !state.secretsFound.Contains(joinIndex)) return false;
            var j = floor.level.joins[joinIndex];
            return state.visited.Contains(j.a) || state.visited.Contains(j.b);
        }

        /// <summary>A room's rectangle in map pixels: the grid cell (gx, gy) at cellPx per cell, from an origin in pixels.</summary>
        public static Rect RoomRect(LevelRoom r, float cellPx, Vector2 origin) =>
            new Rect(origin.x + r.gx * cellPx, origin.y + r.gy * cellPx, r.w * cellPx, r.h * cellPx);

        /// <summary>A game-space point (metres) in map pixels.</summary>
        public static Vector2 Point(float gameX, float gameZ, float cellPx, Vector2 origin) =>
            new Vector2(origin.x + gameX / RoomLayout.Cell * cellPx, origin.y + gameZ / RoomLayout.Cell * cellPx);
    }

    /// <summary>The UI Toolkit element that draws the map: the minimap (a window centred on the hero) or the whole floor.</summary>
    public sealed class FloorMapElement : VisualElement
    {
        public Floor floor;
        public FloorState state;
        public int currentRoom = -1;
        /// <summary>The hero in game space (metres) and heading (degrees, game yaw: 0 faces south, 90 east).</summary>
        public Vector2 heroGame;
        public float heroHeadingDeg;
        public bool full;
        /// <summary>The minimap's window in cells.</summary>
        public float windowCellsW = 5f, windowCellsH = 3f;
        public float minimapCellPx = 44f;

        static readonly Color Visited = new(0.55f, 0.48f, 0.40f, 0.95f);
        static readonly Color Current = new(0.78f, 0.62f, 0.38f, 1f);
        static readonly Color Glimpsed = new(0.45f, 0.40f, 0.36f, 0.9f);
        static readonly Color Door = new(0.90f, 0.86f, 0.78f, 1f);
        static readonly Color Locked = new(0.95f, 0.55f, 0.30f, 1f);
        static readonly Color Secret = new(0.65f, 0.85f, 0.95f, 1f);
        static readonly Color Hero = new(1f, 0.70f, 0.28f, 1f);
        static readonly Color Exit = new(0.55f, 0.95f, 0.65f, 1f);

        public FloorMapElement()
        {
            generateVisualContent += OnGenerate;
            style.overflow = Overflow.Hidden;
        }

        public void Redraw() => MarkDirtyRepaint();

        /// <summary>The cell size and origin for this draw: the whole floor fitted, or the window centred on the hero.</summary>
        public (float cellPx, Vector2 origin) Frame(Rect area)
        {
            if (floor == null) return (minimapCellPx, Vector2.zero);
            if (full)
            {
                float cell = Mathf.Max(4f, Mathf.Min(area.width / floor.level.gridW, area.height / floor.level.gridH));
                var origin = new Vector2((area.width - floor.level.gridW * cell) / 2f, (area.height - floor.level.gridH * cell) / 2f);
                return (cell, origin);
            }
            var heroCell = new Vector2(heroGame.x / RoomLayout.Cell, heroGame.y / RoomLayout.Cell);
            var org = new Vector2(area.width / 2f - heroCell.x * minimapCellPx, area.height / 2f - heroCell.y * minimapCellPx);
            return (minimapCellPx, org);
        }

        void OnGenerate(MeshGenerationContext ctx)
        {
            if (floor == null || state == null) return;
            var area = contentRect;
            var (cell, origin) = Frame(area);
            var p = ctx.painter2D;
            var level = floor.level;
            // Rooms.
            for (int i = 0; i < level.rooms.Count; i++)
            {
                var r = level.rooms[i];
                var status = FloorMapLayout.StatusOf(floor, state, i, currentRoom);
                if (status == FloorMapLayout.Status.Unknown) continue;
                var rect = FloorMapLayout.RoomRect(r, cell, origin);
                rect = new Rect(rect.x + 1.5f, rect.y + 1.5f, rect.width - 3f, rect.height - 3f);
                if (!full && !rect.Overlaps(new Rect(-cell, -cell, area.width + 2 * cell, area.height + 2 * cell))) continue;
                p.BeginPath();
                p.MoveTo(new Vector2(rect.xMin, rect.yMin)); p.LineTo(new Vector2(rect.xMax, rect.yMin)); p.LineTo(new Vector2(rect.xMax, rect.yMax)); p.LineTo(new Vector2(rect.xMin, rect.yMax));
                p.ClosePath();
                if (status == FloorMapLayout.Status.Glimpsed)
                {
                    p.strokeColor = Glimpsed; p.lineWidth = 1.5f; p.Stroke();
                    QuestionMark(p, rect.center, Mathf.Clamp(cell * 0.18f, 3f, 7f), Glimpsed);
                }
                else
                {
                    p.fillColor = status == FloorMapLayout.Status.Current ? Current : Visited; p.Fill();
                }
            }
            // Joins (doors).
            for (int ji = 0; ji < level.joins.Count; ji++)
            {
                if (!FloorMapLayout.JoinKnown(floor, state, ji)) continue;
                var j = level.joins[ji];
                var at = FloorMapLayout.Point(j.x, j.z, cell, origin);
                bool alongX = j.sideA == "north" || j.sideA == "south";
                float half = cell * 0.22f, thick = Mathf.Max(2f, cell * 0.12f);
                var color = floor.lockedJoins.Contains(ji) || (floor.leverJoins.Contains(ji) && !LeverOpen(ji)) ? Locked : floor.secretJoins.Contains(ji) ? Secret : Door;
                p.fillColor = color;
                p.BeginPath();
                if (alongX) { p.MoveTo(new Vector2(at.x - half, at.y - thick)); p.LineTo(new Vector2(at.x + half, at.y - thick)); p.LineTo(new Vector2(at.x + half, at.y + thick)); p.LineTo(new Vector2(at.x - half, at.y + thick)); }
                else { p.MoveTo(new Vector2(at.x - thick, at.y - half)); p.LineTo(new Vector2(at.x + thick, at.y - half)); p.LineTo(new Vector2(at.x + thick, at.y + half)); p.LineTo(new Vector2(at.x - thick, at.y + half)); }
                p.ClosePath(); p.Fill();
            }
            // Exits: the entrance always, the stairs and side exits once their room is known.
            foreach (var e in floor.def.exits)
            {
                bool known = e.kind == "entrance" || state.visited.Contains(e.room) || state.exitsFound.Contains(e.id);
                if (!known) continue;
                var room = level.rooms[e.room];
                var rect = FloorMapLayout.RoomRect(room, cell, origin);
                var c = rect.center;
                if (e.kind != "stairs" && !string.IsNullOrEmpty(e.side))
                {
                    var (nx, nz) = RoomLayout.SideNormal(e.side);
                    c += new Vector2(nx, nz) * (alongSide(e.side, rect) / 2f - cell * 0.12f);
                }
                float r = Mathf.Max(3f, cell * 0.16f);
                p.fillColor = Exit; p.strokeColor = Exit; p.lineWidth = 2f;
                if (e.kind == "stairs")
                {
                    // A triangle pointing down.
                    p.BeginPath(); p.MoveTo(c + new Vector2(-r, -r * 0.8f)); p.LineTo(c + new Vector2(r, -r * 0.8f)); p.LineTo(c + new Vector2(0, r)); p.ClosePath(); p.Fill();
                }
                else if (e.kind == "entrance")
                {
                    // A ring: the way in and out.
                    p.BeginPath(); p.Arc(c, r, 0f, 360f); p.ClosePath(); p.Stroke();
                    p.BeginPath(); p.Arc(c, r * 0.4f, 0f, 360f); p.ClosePath(); p.Fill();
                }
                else
                {
                    // An arrow up and out.
                    p.BeginPath(); p.MoveTo(c + new Vector2(-r, r)); p.LineTo(c + new Vector2(r, -r)); p.Stroke();
                    p.BeginPath(); p.MoveTo(c + new Vector2(r, -r)); p.LineTo(c + new Vector2(0, -r)); p.LineTo(c + new Vector2(r, 0)); p.ClosePath(); p.Fill();
                }
            }
            // The hero: a dot and a heading tick.
            var h = FloorMapLayout.Point(heroGame.x, heroGame.y, cell, origin);
            float rad = heroHeadingDeg * Mathf.Deg2Rad;
            var dir = new Vector2(Mathf.Sin(rad), Mathf.Cos(rad));
            p.fillColor = Hero;
            p.BeginPath(); p.Arc(h, Mathf.Max(3f, cell * 0.16f), 0f, 360f); p.ClosePath(); p.Fill();
            p.strokeColor = Hero; p.lineWidth = 2f;
            p.BeginPath(); p.MoveTo(h); p.LineTo(h + dir * Mathf.Max(6f, cell * 0.3f)); p.Stroke();

            static float alongSide(string side, Rect rect) => side == "north" || side == "south" ? rect.height : rect.width;
        }

        /// <summary>A "?" from strokes (text does not draw inside a generated mesh): a three-quarter arc, a stem, a dot.</summary>
        static void QuestionMark(Painter2D p, Vector2 c, float r, Color color)
        {
            p.strokeColor = color; p.fillColor = color; p.lineWidth = Mathf.Max(1.5f, r * 0.35f);
            var top = c + new Vector2(0, -r * 0.9f);
            p.BeginPath(); p.Arc(top, r * 0.7f, 190f, 90f); p.Stroke();
            p.BeginPath(); p.MoveTo(c + new Vector2(0, -r * 0.2f)); p.LineTo(c + new Vector2(0, r * 0.5f)); p.Stroke();
            p.BeginPath(); p.Arc(c + new Vector2(0, r * 1.2f), Mathf.Max(1f, r * 0.22f), 0f, 360f); p.ClosePath(); p.Fill();
        }

        bool LeverOpen(int joinIndex)
        {
            foreach (var l in floor.def.levers) if (l.opens == joinIndex && state.leversPulled.Contains(l.id)) return true;
            return false;
        }
    }
}

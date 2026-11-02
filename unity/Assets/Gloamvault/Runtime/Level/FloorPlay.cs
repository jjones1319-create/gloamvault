using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using Gloamvault.Characters;
using Gloamvault.Env;
using Gloamvault.Sim;
using UnityEngine;
using UnityEngine.UIElements;

namespace Gloamvault.Level
{
    // ---- what the bridge sends (bridge.ts snapshot / room / actions / logSince), shaped for JsonUtility: flat, never null ----

    [Serializable] public sealed class SimHero { public string name, classId; public int level; public float hpPercent, poolPercent; public bool fallen, downed; public int battleXp; }
    [Serializable] public sealed class SimEnemy { public string id, name; public int level, hp, maxHp; public bool alive; }
    [Serializable] public sealed class SimSnapshot
    {
        public string phase, outcome, summary, resultTitle;
        public string[] resultLines;
        public string curioId, curioName;
        public int light;
        public string band;
        public int clock;
        public bool hunterEntered, hunterKilled;
        public string hunterRoomId, hunterName, roomId;
        public bool hasKey;
        public int monsterLevel, walkSeconds, walkBudget, walkGrace;
        public string smokeKind;
        public int smokeSecondsLeft, randomFights, gold, fights, rooms;
        public SimHero[] heroes;
        public bool fightOver;
        public int fightRound;
        public SimEnemy[] enemies;
        public int log;
    }
    [Serializable] public sealed class SimChest { public int index; public string size; public bool locked, opened; }
    [Serializable] public sealed class SimTrap { public int index; public string trapId, name; public bool revealed, disarmed, triggered; public int chance; public bool blocks; public string blocksTo; }
    [Serializable] public sealed class SimRoom
    {
        public string roomId, kind;
        public bool visited, cleared;
        public string encounterId, encounterName, monsterId, monsterName;
        public int monsterCount;
        public string curioId, curioName;
        public bool curioUsed, restUsed, keyHere;
        public int goldPiles;
        public SimChest[] chests;
        public SimTrap[] traps;
    }
    [Serializable] public sealed class SimAction { public string kind, label; public bool enabled; public string reason, command; }
    [Serializable] public sealed class SimActions { public SimAction[] items; }
    [Serializable] public sealed class SimStep { public string phase; public int commands; public bool over; }
    [Serializable] public sealed class SimEvent { public int floor; public string roomId, kind, text; }
    [Serializable] public sealed class SimEvents { public SimEvent[] items; }

    /// <summary>
    /// The walked floor's rules (Phase 17, D-149–D-152): one delve in the sim (through Jint) that the walk feeds —
    /// seconds walked, each room entered, the monsters reached, A at a chest, a curio, a trap, the hearth, the stairs —
    /// and that answers with the fight (played on auto, told on a card), the light, the clock, the hunter, what a room
    /// holds. The sim never crashes the walk: a refused command is logged and the walk goes on.
    /// </summary>
    public sealed class FloorPlay
    {
        /// <summary>One engine for the app: the bundle runs once (about a second on the phone) and every delve shares it.</summary>
        public static JintSim Engine { get; private set; }
        public static double EngineMs { get; private set; }

        /// <summary>D-174 (Proposed): until Phase 22 seats a party, a Mender walks with the hero in the rules (unseen on the floor; the card names both) — a fresh hero alone cannot clear Floor 1 (docs/balance/2026-11-02-walk-solo.md).</summary>
        public const string Companion = ",{\"classId\":\"mender\",\"speciesId\":\"human\"}";
        /// <summary>The tests and the shots: JSON fields appended to the hero's party member (extra skills, the active slots).</summary>
        public static string HeroExtras = "";
        public const float EngageReach = 1.6f;
        public const float AutoCardSeconds = 2.5f;

        readonly LevelScreen screen;
        readonly Floor floor;
        public int Handle { get; private set; } = -1;
        public bool Ok => Handle >= 0;
        public string Error { get; private set; } = "";
        public SimSnapshot Snap { get; private set; }
        public PlayCard Card { get; }
        public bool CardOpen => Card != null && Card.Open;
        public int Steps { get; private set; }
        public int Refused { get; private set; }
        public string LastRefusal { get; private set; } = "";
        /// <summary>The things the rules put in the built rooms (chests, curios, trap plates, the hearth, the monsters' figures).</summary>
        public IReadOnlyList<IInteractable> Things => things;
        public event Action ThingsChanged;

        readonly List<IInteractable> things = new();
        readonly Dictionary<int, RoomDressing> dressed = new();
        float walkAccum;
        int logSeen;
        float cardOpenedAt;

        sealed class RoomDressing
        {
            public int levelRoomId;
            public Room room;
            public readonly List<GameObject> objects = new();
            public readonly List<Character> figures = new();
            public readonly List<IInteractable> things = new();
            public string stamp;
        }

        public FloorPlay(LevelScreen screen, Floor floor, int seed, HeroSpec hero, PlayCard card)
        {
            this.screen = screen;
            this.floor = floor;
            Card = card;
            try
            {
                EnsureEngine();
                var def = floor.def;
                string request = "{\"dungeonId\":\"" + def.dungeonId + "\",\"floor\":" + def.floor + ",\"lastFloor\":" + def.floor + ",\"floorLayoutId\":\"" + def.id +
                    "\",\"seed\":" + seed + ",\"party\":[{\"classId\":\"" + (hero?.classId ?? "warden") + "\",\"speciesId\":\"" + (hero?.speciesId ?? "dwarf") + "\"" + HeroExtras + "}" + Companion + "]}";
                Handle = Engine.CreateDelve(request);
                Refresh();
                GvLog.Line("play", ("floor", def.id), ("seed", seed), ("room", Snap.roomId), ("light", Snap.light), ("band", Snap.band), ("monsterLevel", Snap.monsterLevel), ("budget", Snap.walkBudget));
            }
            catch (Exception e)
            {
                Error = e.Message;
                Handle = -1;
                Debug.LogException(e);
            }
        }

        /// <summary>The app's one engine, built on first use (about a second on the phone): the walked floor, the tree screen, the fight share it.</summary>
        public static void EnsureEngine()
        {
            if (Engine != null) return;
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var assets = JintSim.Assets.Load();
            Engine = new JintSim(assets.script, assets.content, assets.loadMs);
            EngineMs = sw.Elapsed.TotalMilliseconds;
            GvLog.Line("play-engine", ("ms", EngineMs), ("engine", Engine.Name));
        }

        public void Dispose()
        {
            Stage?.Dispose(); Stage = null;
            foreach (var d in dressed.Values) Undress(d);
            dressed.Clear();
            if (Handle >= 0) { try { Engine?.DisposeDelve(Handle); } catch (Exception e) { Debug.LogException(e); } }
            Handle = -1;
        }

        // ---- the walk feeds the rules ----

        /// <summary>Each frame: the stage while a fight plays; else the seconds walked (whole ones go to the sim), the monsters reached, the card's auto-press on auto walk.</summary>
        public void Tick(float dt, bool moving, Vector3 heroAt, bool autoWalk)
        {
            if (!Ok) return;
            if (Stage != null && Stage.Active)
            {
                if (!Stage.Tick(dt))
                {
                    // The fight is over in the rules: the card.
                    Refresh();
                    Resolve();
                }
                return;
            }
            if (CardOpen)
            {
                if (autoWalk && Time.unscaledTime - cardOpenedAt > AutoCardSeconds) Card.PressFirst();
                return;
            }
            if (moving) walkAccum += dt;
            if (walkAccum >= 1f)
            {
                int sec = Mathf.FloorToInt(walkAccum);
                walkAccum -= sec;
                Step("{\"kind\":\"walk\",\"seconds\":" + sec + "}");
                if (CardOpen) return;
            }
            // The monsters waiting in this room: reached, the fight starts (D-150).
            var here = CurrentDressing();
            if (here != null && here.figures.Count > 0)
            {
                foreach (var f in here.figures)
                {
                    if (f?.root == null) continue;
                    var to = f.root.transform.position - heroAt; to.y = 0;
                    if (to.sqrMagnitude < EngageReach * EngageReach) { Engage(); break; }
                }
            }
        }

        /// <summary>The hero crossed into a room: the rules follow (light, the clock, the hunter, what springs).</summary>
        public void EnteredRoom(int levelRoomId)
        {
            if (!Ok) return;
            string id = "r" + levelRoomId;
            if (Snap.roomId == id) return;
            if (MoveTo(levelRoomId)) return;
            // Not next door (a room crossed in one frame, a teleport): the floor's joins give the way, room by room.
            int from = SimRoomIndex();
            var path = JoinPath(from, levelRoomId);
            if (path == null) { GvLog.Line("play-lost", ("sim", Snap.roomId), ("hero", id)); return; }
            foreach (var r in path)
            {
                if (CardOpen) return;
                if (!MoveTo(r)) { GvLog.Line("play-lost", ("sim", Snap.roomId), ("hero", id), ("at", "r" + r), ("why", LastRefusal)); return; }
            }
        }

        /// <summary>One move into a neighbouring room; a door barred by a spotted trap is set off first (walking through is walking over it).</summary>
        bool MoveTo(int levelRoomId)
        {
            string id = "r" + levelRoomId;
            if (Snap.roomId == id) return true;
            int from = SimRoomIndex();
            var info = RoomInfo(from);
            // Every spotted trap barring this door is set off in turn (a gauntlet can bar one door with three).
            if (info?.traps != null)
                foreach (var t in info.traps)
                    if (t.revealed && !t.disarmed && !t.triggered && t.blocksTo == id) { Step("{\"kind\":\"walkAround\",\"trapIndex\":" + t.index + "}"); if (CardOpen || Snap.phase != "room") return Snap.roomId == id; }
            return Step("{\"kind\":\"move\",\"toRoomId\":\"" + id + "\"}") && Snap.roomId == id;
        }

        int SimRoomIndex()
        {
            if (Snap == null || string.IsNullOrEmpty(Snap.roomId) || Snap.roomId[0] != 'r') return -1;
            return int.TryParse(Snap.roomId.Substring(1), NumberStyles.Integer, CultureInfo.InvariantCulture, out int id) ? id : -1;
        }

        /// <summary>The rooms from one to another over the floor's joins (every kind: the rules refuse what is shut), the start left out.</summary>
        List<int> JoinPath(int from, int to)
        {
            if (from < 0) return null;
            var prev = new Dictionary<int, int> { [from] = -1 };
            var queue = new Queue<int>();
            queue.Enqueue(from);
            while (queue.Count > 0)
            {
                int r = queue.Dequeue();
                if (r == to) break;
                foreach (var j in floor.def.joins)
                {
                    int other = j.a == r ? j.b : j.b == r ? j.a : -1;
                    if (other < 0 || prev.ContainsKey(other)) continue;
                    prev[other] = r;
                    queue.Enqueue(other);
                }
            }
            if (!prev.ContainsKey(to)) return null;
            var path = new List<int>();
            for (int r = to; r != from; r = prev[r]) path.Add(r);
            path.Reverse();
            return path;
        }

        /// <summary>A secret panel found with A (D-146): known from both sides from now on.</summary>
        public void Reveal(int fromLevelRoomId, int toLevelRoomId)
        {
            if (!Ok) return;
            if (Snap.roomId != "r" + fromLevelRoomId) EnteredRoom(fromLevelRoomId);
            Step("{\"kind\":\"reveal\",\"toRoomId\":\"r" + toLevelRoomId + "\"}");
        }

        public void Engage() => Step("{\"kind\":\"engage\"}");
        public void Examine() => Step("{\"kind\":\"examine\"}");
        public void OpenChest(int index) => Step("{\"kind\":\"openChest\",\"chestIndex\":" + index + ",\"useKey\":false,\"heroIndex\":0}");
        public void Disarm(int index) => Step("{\"kind\":\"disarm\",\"trapIndex\":" + index + ",\"heroIndex\":0}");
        public void TakeGold() => Step("{\"kind\":\"takeGold\"}");
        public void Rest() => Step("{\"kind\":\"rest\"}");
        public void Descend() => Step("{\"kind\":\"descend\"}");
        public void Retreat() => Step("{\"kind\":\"retreat\"}");
        /// <summary>The tests: seconds walked in one go.</summary>
        public void Walk(int seconds) => Step("{\"kind\":\"walk\",\"seconds\":" + seconds + "}");

        /// <summary>One command to the sim; the state read back; the phase resolved (a fight played, a card shown).</summary>
        public bool Step(string commandJson)
        {
            if (!Ok) return false;
            try
            {
                Engine.Step(Handle, commandJson);
                Steps++;
            }
            catch (SimException e)
            {
                Refused++;
                LastRefusal = e.Message;
                GvLog.Line("play-refused", ("command", commandJson), ("why", e.Message));
                return false;
            }
            catch (Exception e)
            {
                Refused++;
                LastRefusal = e.Message;
                Debug.LogException(e);
                return false;
            }
            Refresh();
            Resolve();
            return true;
        }

        void Refresh()
        {
            Snap = JsonUtility.FromJson<SimSnapshot>(Engine.Snapshot(Handle));
        }

        /// <summary>The fight on the stage (Phase 19): the figures, the camera, the events acted out; null until a fight starts.</summary>
        public FightStage Stage { get; private set; }
        /// <summary>The tests: a fight plays out at once, no stage.</summary>
        public bool StageFights { get; set; } = true;
        public bool Staging => Stage != null && Stage.Active;

        /// <summary>A fight goes to the stage, which plays it one action at a time (Phase 19); its result, a curio's choices and the delve's end are cards.</summary>
        void Resolve()
        {
            if (Snap.phase == "fight")
            {
                if (StageFights && screen.Hero != null)
                {
                    Stage ??= new FightStage(this, screen, screen.WalkRoot);
                    if (!Stage.Active) Stage.Begin();
                    return;
                }
                int guard = 0;
                while (Snap.phase == "fight" && guard++ < 600)
                {
                    try { Engine.Step(Handle, "{\"kind\":\"auto\"}"); Steps++; }
                    catch (Exception e) { Debug.LogException(e); break; }
                    Refresh();
                }
            }
            switch (Snap.phase)
            {
                case "result":
                    ShowCard(string.IsNullOrEmpty(Snap.resultTitle) ? "What happened" : Snap.resultTitle, BodyOf(Snap.resultLines), ButtonsFromActions("Continue"));
                    break;
                case "curio":
                    ShowCard(string.IsNullOrEmpty(Snap.curioName) ? "A curio" : Snap.curioName, BodyOf(null), ButtonsFromActions(null));
                    break;
                case "over":
                    ShowCard(OutcomeTitle(Snap.outcome), BodyOf(new[] { Snap.summary }), new List<PlayCard.ButtonSpec> { new() { label = "Leave the floor", enabled = true, action = () => screen.EndDelve(Snap.outcome) } });
                    break;
                default:
                    if (CardOpen) Card.Hide();
                    var said = Tell();
                    if (said.Length > 0) screen.Toast(said);
                    break;
            }
            RedressCurrent();
        }

        static string OutcomeTitle(string outcome) => outcome switch
        {
            "cleared" => "The floor is cleared",
            "retreated" => "Out of the keep",
            "wiped" => "The party has fallen",
            "capped" => "The delve ends",
            "chosenDied" => "Your hero has fallen",
            _ => "The delve ends",
        };

        /// <summary>The card's body: the given lines, then what the log said since the last card (a fight's blows, a chest's loot).</summary>
        string BodyOf(string[] lines)
        {
            var sb = new StringBuilder();
            if (lines != null) foreach (var l in lines) if (!string.IsNullOrEmpty(l)) sb.AppendLine(l);
            try
            {
                var ev = JsonUtility.FromJson<SimEvents>("{\"items\":" + Engine.LogSince(Handle, logSeen) + "}");
                logSeen = Snap.log;
                if (ev?.items != null && ev.items.Length > 0)
                {
                    if (sb.Length > 0) sb.AppendLine();
                    int shown = 0;
                    foreach (var e in ev.items)
                    {
                        if (string.IsNullOrEmpty(e.text) || !Telling(e.kind)) continue;
                        sb.AppendLine("· " + e.text);
                        if (++shown >= 40) { sb.AppendLine("…"); break; }
                    }
                }
            }
            catch (Exception e) { Debug.LogException(e); }
            if (Snap.heroes != null)
            {
                sb.AppendLine();
                foreach (var h in Snap.heroes) sb.AppendLine($"{h.name} · level {h.level} · {Mathf.RoundToInt(h.hpPercent)}% HP{(h.downed ? " · down" : "")}{(h.fallen ? " · fallen" : "")}");
                sb.Append($"Gold {Snap.gold} · light {Snap.light} ({Snap.band}) · clock {Snap.clock}");
            }
            return sb.ToString().TrimEnd();
        }

        /// <summary>The log kinds worth a line on a card or a toast (the room-by-room bookkeeping is not).</summary>
        static bool Telling(string kind) => kind != "room" && kind != "codex" && kind != "floor" && kind != "waystone" && kind != "stream";

        /// <summary>What the rules said since the last card, for a toast (a chest's loot, a disarmed trap, the rest).</summary>
        string Tell()
        {
            try
            {
                var ev = JsonUtility.FromJson<SimEvents>("{\"items\":" + Engine.LogSince(Handle, logSeen) + "}");
                logSeen = Snap.log;
                if (ev?.items == null) return "";
                var sb = new StringBuilder();
                int n = 0;
                for (int i = ev.items.Length - 1; i >= 0 && n < 2; i--)
                {
                    var e = ev.items[i];
                    if (string.IsNullOrEmpty(e.text) || !Telling(e.kind)) continue;
                    sb.Insert(0, (sb.Length > 0 ? " · " : "") + e.text);
                    n++;
                }
                return sb.ToString();
            }
            catch (Exception e) { Debug.LogException(e); return ""; }
        }

        /// <summary>The legal commands as buttons (a curio's choices, Continue); the disabled ones greyed with their reason.</summary>
        List<PlayCard.ButtonSpec> ButtonsFromActions(string onlyKindLabel)
        {
            var list = new List<PlayCard.ButtonSpec>();
            try
            {
                var acts = JsonUtility.FromJson<SimActions>(Engine.Actions(Handle));
                if (acts?.items != null)
                {
                    foreach (var a in acts.items)
                    {
                        if (a.kind == "auto") continue;
                        string cmd = a.command;
                        string label = a.kind == "continue" ? (onlyKindLabel ?? "Continue") : a.label;
                        list.Add(new PlayCard.ButtonSpec { label = label, enabled = a.enabled, reason = a.reason, action = () => Step(cmd) });
                    }
                }
            }
            catch (Exception e) { Debug.LogException(e); }
            if (list.Count == 0) list.Add(new PlayCard.ButtonSpec { label = onlyKindLabel ?? "Continue", enabled = true, action = () => Step("{\"kind\":\"continue\"}") });
            return list;
        }

        void ShowCard(string title, string body, List<PlayCard.ButtonSpec> buttons)
        {
            if (Card == null) return;
            cardOpenedAt = Time.unscaledTime;
            Card.Show(title, body, buttons);
            GvLog.Line("play-card", ("title", title), ("phase", Snap.phase), ("buttons", buttons.Count));
        }

        // ---- the rooms' things ----

        /// <summary>A built room gets the rules' things; a released one loses them. Called when the streamer's built set changes.</summary>
        public void OnBuilt(IReadOnlyDictionary<int, Room> built)
        {
            if (!Ok) return;
            var gone = new List<int>();
            foreach (var kv in dressed) if (!built.ContainsKey(kv.Key) || built[kv.Key] != kv.Value.room) gone.Add(kv.Key);
            foreach (var id in gone) { Undress(dressed[id]); dressed.Remove(id); }
            foreach (var kv in built) if (!dressed.ContainsKey(kv.Key)) Dress(kv.Key, kv.Value);
            RebuildThings();
        }

        void RedressCurrent()
        {
            var d = CurrentDressing();
            if (d == null) return;
            var info = RoomInfo(d.levelRoomId);
            if (info == null) return;
            string stamp = Stamp(info);
            if (stamp == d.stamp) return;
            Undress(d);
            dressed.Remove(d.levelRoomId);
            Dress(d.levelRoomId, d.room, info);
            RebuildThings();
        }

        RoomDressing CurrentDressing()
        {
            if (Snap == null || string.IsNullOrEmpty(Snap.roomId) || Snap.roomId[0] != 'r') return null;
            if (!int.TryParse(Snap.roomId.Substring(1), NumberStyles.Integer, CultureInfo.InvariantCulture, out int id)) return null;
            return dressed.TryGetValue(id, out var d) ? d : null;
        }

        public SimRoom RoomInfo(int levelRoomId)
        {
            if (!Ok) return null;
            try { return JsonUtility.FromJson<SimRoom>(Engine.Room(Handle, "r" + levelRoomId)); }
            catch (Exception e) { Debug.LogException(e); return null; }
        }

        static string Stamp(SimRoom r)
        {
            var sb = new StringBuilder();
            sb.Append(r.cleared ? 'c' : '-').Append(r.curioUsed ? 'u' : '-').Append(r.restUsed ? 'r' : '-').Append(r.goldPiles).Append('|');
            if (r.chests != null) foreach (var c in r.chests) sb.Append(c.opened ? 'o' : c.locked ? 'l' : 'x');
            sb.Append('|');
            if (r.traps != null) foreach (var t in r.traps) sb.Append(t.triggered ? 't' : t.disarmed ? 'd' : t.revealed ? 'r' : '-');
            return sb.ToString();
        }

        void Dress(int levelRoomId, Room room, SimRoom info = null)
        {
            info ??= RoomInfo(levelRoomId);
            if (info == null || room?.root == null) return;
            var d = new RoomDressing { levelRoomId = levelRoomId, room = room, stamp = Stamp(info) };
            dressed[levelRoomId] = d;
            var lr = floor.level.rooms[levelRoomId];
            var spots = new List<FloorSpotDef>();
            foreach (var s in floor.def.spots) if (s.room == levelRoomId) spots.Add(s);
            Vector2 SpotOf(string kind, int nth, Vector2 fallback)
            {
                int seen = 0;
                foreach (var s in spots) if (s.kind == kind) { if (seen++ == nth) return new Vector2(s.x, s.z); }
                return fallback;
            }
            float cell = RoomLayout.Cell;
            var centre = Vector2.zero;
            // The monsters, waiting at their spot (D-150): the encounter's first monster, up to three figures.
            if (!info.cleared && !string.IsNullOrEmpty(info.encounterId))
            {
                var at = SpotOf("encounter", 0, centre);
                int n = Mathf.Clamp(info.monsterCount, 1, 3);
                for (int i = 0; i < n; i++)
                {
                    var p = at + new Vector2((i - (n - 1) / 2f) * 1.1f, (i % 2) * 0.6f);
                    var fig = Figure(info.monsterId, room, p);
                    if (fig != null) d.figures.Add(fig);
                }
                var thing = Host(room, null, at, 0f, d, "Monsters " + info.encounterName).AddComponent<MonsterThing>();
                thing.play = this; thing.monsterName = string.IsNullOrEmpty(info.monsterName) ? "the monsters" : info.monsterName;
                d.things.Add(thing);
            }
            // Chests: the chest spots in order, the rest beside the first.
            if (info.chests != null)
            {
                for (int i = 0; i < info.chests.Length; i++)
                {
                    var c = info.chests[i];
                    var at = SpotOf("chest", i, SpotOf("chest", 0, centre) + new Vector2(1.2f * i, 0f));
                    string mesh = c.size == "large" ? "shr_chest_large" : "shr_chest_small";
                    var thing = Host(room, mesh, at, 0f, d, "Chest").AddComponent<ChestThing>();
                    thing.play = this; thing.index = c.index; thing.opened = c.opened; thing.locked = c.locked; thing.size = c.size;
                    if (c.opened) thing.OpenLid();
                    d.things.Add(thing);
                }
            }
            // Gold piles.
            if (info.goldPiles > 0)
            {
                var at = SpotOf("chest", 0, centre) + new Vector2(-1.3f, -0.6f);
                var thing = Host(room, "shr_gold_pile", at, 0.4f, d, "Gold").AddComponent<GoldThing>();
                thing.play = this; thing.piles = info.goldPiles;
                d.things.Add(thing);
            }
            // The curio: the cask or the lantern by the spot's id, else the lore tablet.
            if (!string.IsNullOrEmpty(info.curioId) && !info.curioUsed)
            {
                var at = SpotOf("curio", 0, centre + new Vector2(0f, -1.5f));
                string spotId = null;
                foreach (var s in spots) if (s.kind == "curio") { spotId = s.id; break; }
                string mesh = spotId != null && spotId.Contains("cask") && room.kit.Has("cel_cask_large") ? "cel_cask_large" : spotId != null && spotId.Contains("lantern") && room.kit.Has("cel_lantern") ? "cel_lantern" : "shr_lore_tablet";
                var thing = Host(room, mesh, at, 0f, d, "Curio").AddComponent<CurioThing>();
                thing.play = this; thing.curioName = info.curioName;
                d.things.Add(thing);
            }
            // Trap plates: the spotted traps, at the trap spots (the rest about the centre).
            if (info.traps != null)
            {
                int nth = 0;
                foreach (var t in info.traps)
                {
                    if (!t.revealed || t.disarmed || t.triggered) { nth++; continue; }
                    // A trap with no spot of its own (the rules roll one in any room) lies off the centre, clear of the stair and the hearth.
                    var at = SpotOf("trap", nth, centre + new Vector2(2.2f + 0.9f * nth, -1.8f));
                    nth++;
                    var thing = Host(room, "shr_trap_plate", at, 0f, d, "Trap").AddComponent<TrapThing>();
                    thing.play = this; thing.index = t.index; thing.trapName = t.name; thing.chance = t.chance;
                    d.things.Add(thing);
                }
            }
            // The hearth of the rest room.
            if (info.kind == "rest" && !info.restUsed)
            {
                var at = centre;
                var thing = Host(room, "shr_campfire", at, 0f, d, "Hearth").AddComponent<HearthThing>();
                thing.play = this;
                d.things.Add(thing);
            }
        }

        /// <summary>
        /// The thing's host in the room: the kit's piece at the room-local game position when it has one, else a small
        /// stone marker (so the prompt still has a place); with no mesh asked for, an unseen point.
        /// </summary>
        GameObject Host(Room room, string meshId, Vector2 at, float yaw, RoomDressing d, string name)
        {
            GameObject go = meshId != null ? RoomBuilder.PlacePiece(room, meshId, new Vector3(at.x, 0f, at.y), yaw, colliders: false) : null;
            if (go == null)
            {
                var world = room.root.transform.TransformPoint(room.kit.axes.Position(at.x, 0f, at.y));
                if (meshId != null) go = FloorThingLook.Box(room.root.transform, name, world + Vector3.up * 0.2f, new Vector3(0.5f, 0.4f, 0.5f), FloorThingLook.Stone);
                else
                {
                    go = new GameObject(name);
                    go.transform.SetParent(room.root.transform, false);
                    go.transform.position = world;
                }
            }
            d.objects.Add(go);
            return go;
        }

        Character Figure(string monsterId, Room room, Vector2 at)
        {
            try
            {
                var entry = string.IsNullOrEmpty(monsterId) ? null : MonsterBuilder.Data.Entry(monsterId);
                if (entry == null) return null;
                var c = MonsterBuilder.Build(entry, room.root.transform);
                var world = room.root.transform.TransformPoint(room.kit.axes.Position(at.x, 0f, at.y));
                c.root.transform.position = world;
                c.root.transform.rotation = Quaternion.Euler(0f, UnityEngine.Random.Range(0f, 360f), 0f);
                if (c.animator != null && c.animator.Has("Idle")) c.animator.Play("Idle");
                return c;
            }
            catch (Exception e) { Debug.LogException(e); return null; }
        }

        void Undress(RoomDressing d)
        {
            foreach (var f in d.figures) f?.Destroy();
            foreach (var go in d.objects) if (go != null) UnityEngine.Object.Destroy(go);
            d.figures.Clear(); d.objects.Clear(); d.things.Clear();
        }

        void RebuildThings()
        {
            things.Clear();
            foreach (var d in dressed.Values) things.AddRange(d.things);
            ThingsChanged?.Invoke();
        }

        /// <summary>What the stats line adds: the light and its band, the floor clock, the hunter, the smoke.</summary>
        public string StatsSuffix()
        {
            if (!Ok) return " · rules: " + Error;
            var s = Snap;
            var sb = new StringBuilder();
            sb.Append(" · light ").Append(s.light).Append(" (").Append(s.band).Append(") · clock ").Append(s.clock);
            if (s.hunterEntered && !s.hunterKilled) sb.Append(" · ").Append(string.IsNullOrEmpty(s.hunterName) ? "the hunter" : s.hunterName).Append(" is on the floor");
            if (!string.IsNullOrEmpty(s.smokeKind)) sb.Append(" · ").Append(s.smokeKind == "hush" ? "Hushsmoke" : "Callsmoke").Append(' ').Append(s.smokeSecondsLeft).Append(" s");
            if (s.fights > 0) sb.Append(" · fights ").Append(s.fights);
            return sb.ToString();
        }
    }

    // ---- the things ----

    /// <summary>The monsters waiting at their spot: A fights them (walking up to them does too).</summary>
    public sealed class MonsterThing : MonoBehaviour, IInteractable
    {
        public FloorPlay play;
        public string monsterName = "the monsters";
        public Vector3 Position => transform.position;
        public string Prompt => "Fight " + monsterName;
        public bool Available => play != null && play.Ok && !play.CardOpen;
        public bool Act() { play?.Engage(); return true; }
    }

    public sealed class ChestThing : MonoBehaviour, IInteractable
    {
        public FloorPlay play;
        public int index;
        public bool opened, locked;
        public string size = "small";
        public Vector3 Position => transform.position;
        public string Prompt => opened ? "Opened" : locked ? "Locked chest · force it" : "Open the chest";
        public bool Available => !opened && play != null && play.Ok;
        public bool Act() { play?.OpenChest(index); return true; }
        /// <summary>The lid up (the kit's part, when the piece has one).</summary>
        public void OpenLid()
        {
            var lid = transform.Find(size == "large" ? "shr_chest_large.lid" : "shr_chest_small.lid");
            if (lid == null) foreach (Transform t in transform) if (t.name.EndsWith(".lid")) { lid = t; break; }
            if (lid != null) lid.localRotation = Quaternion.Euler(-100f, 0f, 0f) * lid.localRotation;
        }
    }

    public sealed class GoldThing : MonoBehaviour, IInteractable
    {
        public FloorPlay play;
        public int piles;
        public Vector3 Position => transform.position;
        public string Prompt => "Take the gold";
        public bool Available => play != null && play.Ok;
        public bool Act() { play?.TakeGold(); return true; }
    }

    public sealed class CurioThing : MonoBehaviour, IInteractable
    {
        public FloorPlay play;
        public string curioName = "";
        public Vector3 Position => transform.position;
        public string Prompt => "Look at " + (string.IsNullOrEmpty(curioName) ? "it" : curioName);
        public bool Available => play != null && play.Ok;
        public bool Act() { play?.Examine(); return true; }
    }

    public sealed class TrapThing : MonoBehaviour, IInteractable
    {
        public FloorPlay play;
        public int index;
        public string trapName = "";
        public Vector3 Position => transform.position;
        public int chance;
        public string Prompt => "Disarm " + (string.IsNullOrEmpty(trapName) ? "the trap" : trapName) + (chance > 0 ? $" ({chance}%)" : "");
        public bool Available => play != null && play.Ok;
        public bool Act() { play?.Disarm(index); return true; }
    }

    public sealed class HearthThing : MonoBehaviour, IInteractable
    {
        public FloorPlay play;
        public Vector3 Position => transform.position;
        public string Prompt => "Rest";
        public bool Available => play != null && play.Ok;
        public bool Act() { play?.Rest(); return true; }
    }

    /// <summary>The card: a title, a body that scrolls, a row of buttons (UI Toolkit, Level.uxml's `card`).</summary>
    public sealed class PlayCard
    {
        public sealed class ButtonSpec { public string label; public bool enabled = true; public string reason; public Action action; }

        readonly VisualElement root, buttons;
        readonly Label title, body;
        readonly ScrollView scroll;
        public bool Open => root != null && root.style.display == DisplayStyle.Flex;
        public string Title => title?.text ?? "";
        public string Body => body?.text ?? "";
        public int ButtonCount => buttons?.childCount ?? 0;
        readonly List<Button> made = new();
        readonly List<ButtonSpec> shown = new();

        public PlayCard(VisualElement walk)
        {
            root = walk.Q("card");
            title = walk.Q<Label>("cardTitle");
            body = walk.Q<Label>("cardBody");
            scroll = walk.Q<ScrollView>("cardScroll");
            buttons = walk.Q("cardButtons");
            if (root != null) root.style.display = DisplayStyle.None;
        }

        public void Show(string titleText, string bodyText, List<ButtonSpec> specs)
        {
            if (root == null) return;
            title.text = titleText;
            body.text = bodyText;
            buttons.Clear();
            made.Clear();
            shown.Clear();
            shown.AddRange(specs);
            foreach (var s in specs)
            {
                var b = new Button { text = s.label };
                b.AddToClassList("walk__btn");
                b.AddToClassList("walk__cardButton");
                if (!s.enabled) { b.AddToClassList("walk__cardButton--off"); b.SetEnabled(false); if (!string.IsNullOrEmpty(s.reason)) b.tooltip = s.reason; }
                else b.AddToClassList("walk__btn--primary");
                var act = s.action;
                b.clicked += () => { Hide(); act?.Invoke(); };
                buttons.Add(b);
                made.Add(b);
            }
            if (scroll != null) scroll.scrollOffset = Vector2.zero;
            root.style.display = DisplayStyle.Flex;
        }

        public void Hide()
        {
            if (root != null) root.style.display = DisplayStyle.None;
        }

        /// <summary>Presses the first enabled button (auto walk, the tests).</summary>
        public bool PressFirst()
        {
            for (int i = 0; i < shown.Count; i++) if (shown[i].enabled) return Press(i);
            return false;
        }

        public bool Press(int index)
        {
            if (index < 0 || index >= shown.Count || !shown[index].enabled) return false;
            var act = shown[index].action;
            Hide();
            act?.Invoke();
            return true;
        }
    }
}

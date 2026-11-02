using System;
using System.Collections.Generic;
using Gloamvault.Characters;
using Gloamvault.Env;
using Gloamvault.Sim;
using Gloamvault.Walk;
using UnityEngine;
using UnityEngine.UIElements;

namespace Gloamvault.Level
{
    // ---- what the bridge sends (bridge.ts fightView / fightEvents), shaped for JsonUtility ----
    [Serializable] public sealed class FightActorView { public string id, name, side, kind, row; public int level, hp, maxHp, pool, poolMax; public bool downed, fallen, fled, gone; public string monsterId; public bool boss; public string[] statuses; }
    [Serializable] public sealed class FightView { public bool active; public int round; public string over; public FightActorView[] actors; public int log; }
    [Serializable] public sealed class FightEventView { public int tick, round; public string kind, actorId, targetId; public int amount; public string text, skillId, status; }
    [Serializable] public sealed class FightEvents { public FightEventView[] items; public int total; }

    /// <summary>
    /// The fight, staged where you stand (Phase 19, D-179): the party's figures and the monsters' face each other in
    /// rows on the floor, the camera swings to a side view, and the rules play one action at a time (the sim's own
    /// auto player until Phase 20 gives James the buttons) while each event is acted out — the attacker's swing or
    /// cast, the target's flinch, the number that floats, a fall, a summon's creature called for its one strike. A tap
    /// of A hurries it; the card comes after, as before. The stage leaves nothing behind.
    /// </summary>
    public sealed class FightStage
    {
        public const float ActionSeconds = 0.9f;
        public const float HurrySeconds = 0.08f;
        public const float EnemyDistance = 4.2f;
        public const float RowGap = 1.4f;
        public const float Spacing = 1.3f;

        readonly FloorPlay play;
        readonly LevelScreen screen;
        readonly Transform root;
        readonly Dictionary<string, Character> figures = new();
        readonly Dictionary<string, Vector3> homes = new();
        readonly List<Label> numbers = new();
        readonly VisualElement overlay;
        Character summonFigure;
        public bool Active { get; private set; }
        public bool Hurry { get; set; }
        public int Actions { get; private set; }
        public int Summons { get; private set; }
        public string LastText { get; private set; } = "";
        public FightView View { get; private set; }
        int seen;
        float wait;
        Vector3 camFrom; Quaternion camRotFrom;
        Vector3 camTo; Quaternion camRotTo;
        float camBlend;
        bool cameraParked;
        readonly Camera cam;
        readonly FollowCamera follow;
        Vector3 centre;
        Vector3 forward;
        Vector3 right;

        public FightStage(FloorPlay play, LevelScreen screen, VisualElement walkRoot)
        {
            this.play = play;
            this.screen = screen;
            cam = Camera.main;
            follow = screen.Follow;
            root = new GameObject("Fight stage").transform;
            overlay = new VisualElement { pickingMode = PickingMode.Ignore };
            overlay.style.position = Position.Absolute;
            overlay.style.left = 0; overlay.style.top = 0; overlay.style.right = 0; overlay.style.bottom = 0;
            walkRoot?.Add(overlay);
        }

        /// <summary>The fight has begun in the rules: the figures take their places, the camera its view.</summary>
        public void Begin()
        {
            Active = true;
            Hurry = false;
            Actions = 0; Summons = 0; seen = 0; wait = 0.35f;
            Read();
            var hero = screen.Hero.root.transform;
            forward = hero.forward; forward.y = 0; forward = forward.sqrMagnitude > 0.01f ? forward.normalized : Vector3.forward;
            // The monsters stand ahead of the hero, but never through a wall: pulled in before one.
            float dist = EnemyDistance;
            if (Physics.Raycast(hero.position + Vector3.up * 0.8f, forward, out var hit, EnemyDistance + 0.6f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore)) dist = Mathf.Max(1.8f, hit.distance - 0.8f);
            centre = hero.position + forward * (dist * 0.5f);
            right = Vector3.Cross(Vector3.up, forward).normalized;
            Place(dist);
            // The camera: beside the lines, looking across them — on whichever side has room, pulled in before a wall.
            camFrom = cam.transform.position; camRotFrom = cam.transform.rotation;
            var eye = centre + Vector3.up * 1.0f;
            float clearRight = Clear(eye, right, 5.6f), clearLeft = Clear(eye, -right, 5.6f);
            var sideDir = clearRight >= clearLeft ? right : -right;
            float across = Mathf.Max(2.4f, Mathf.Min(5.2f, Mathf.Max(clearRight, clearLeft) - 0.6f));
            float up = across < 3.5f ? 1.9f : 2.6f;
            var side = centre + sideDir * across + Vector3.up * up - forward * 0.4f;
            camTo = side; camRotTo = Quaternion.LookRotation((centre + Vector3.up * 0.9f) - side, Vector3.up);
            camBlend = 0f;
            if (follow != null) follow.enabled = false;
            cameraParked = true;
            if (screen.Mover != null) screen.Mover.stick = Vector2.zero;
            GvLog.Line("stage", ("actors", View?.actors?.Length ?? 0), ("round", View?.round ?? 0));
        }

        /// <summary>How far from a point a direction is clear of the room's walls and furniture (the unseen blockers aside).</summary>
        static float Clear(Vector3 from, Vector3 dir, float max)
        {
            return Physics.SphereCast(from, 0.3f, dir, out var hit, max, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore) ? hit.distance : max;
        }

        void Read()
        {
            try { View = JsonUtility.FromJson<FightView>(FloorPlay.Engine.FightView(play.Handle)); }
            catch (Exception e) { Debug.LogException(e); View = new FightView { active = false, actors = Array.Empty<FightActorView>() }; }
        }

        /// <summary>The hero keeps its place; the rest of the party beside it; the monsters in two rows ahead, facing.</summary>
        void Place(float dist)
        {
            var hero = screen.Hero.root.transform;
            var partyFront = new List<FightActorView>(); var partyBack = new List<FightActorView>();
            var enemyFront = new List<FightActorView>(); var enemyBack = new List<FightActorView>();
            foreach (var a in View.actors)
            {
                if (a.gone || a.kind == "summon") continue;
                (a.side == "party" ? (a.row == "back" ? partyBack : partyFront) : (a.row == "back" ? enemyBack : enemyFront)).Add(a);
            }
            // The hero's own actor is hero-0; it stands where it stands and faces the monsters.
            hero.rotation = Quaternion.LookRotation(forward, Vector3.up);
            var partyLine = hero.position;
            PlaceRow(partyFront, partyLine, forward, true);
            PlaceRow(partyBack, partyLine - forward * RowGap, forward, true);
            var enemyLine = hero.position + forward * dist;
            PlaceRow(enemyFront, enemyLine, -forward, false);
            PlaceRow(enemyBack, enemyLine + forward * RowGap, -forward, false);
        }

        void PlaceRow(List<FightActorView> row, Vector3 line, Vector3 facing, bool party)
        {
            for (int i = 0; i < row.Count; i++)
            {
                var a = row[i];
                float offset = (i - (row.Count - 1) / 2f) * Spacing;
                var at = line + right * offset;
                if (party && a.id == "hero-0") { at = screen.Hero.root.transform.position; homes[a.id] = at; continue; }
                var fig = Figure(a);
                if (fig == null) continue;
                at = Reachable(screen.Hero.root.transform.position, at);
                fig.root.transform.position = at;
                fig.root.transform.rotation = Quaternion.LookRotation(facing, Vector3.up);
                homes[a.id] = at;
                if (fig.animator != null && fig.animator.Has("Idle")) fig.animator.Play("Idle");
            }
        }

        /// <summary>A spot pulled back toward the hero until the way to it is clear of walls.</summary>
        static Vector3 Reachable(Vector3 from, Vector3 to)
        {
            var d = to - from; d.y = 0;
            float len = d.magnitude;
            if (len < 0.1f) return to;
            float clear = Clear(from + Vector3.up * 0.8f, d / len, len + 0.4f);
            return clear >= len + 0.4f ? to : from + d / len * Mathf.Max(1.2f, clear - 0.5f);
        }

        Character Figure(FightActorView a)
        {
            if (figures.TryGetValue(a.id, out var f)) return f;
            Character c = null;
            try
            {
                if (a.side == "party" && a.kind == "hero")
                {
                    // The unseen companion (D-174) shows for the fight: a human of its class.
                    c = HeroAssembler.Build(new HeroSpec { speciesId = "human", classId = a.id == "hero-1" ? "mender" : "warden", tier = "F" }, root);
                }
                else if (a.kind == "pet")
                {
                    var entry = MonsterBuilder.Data.Entry(a.monsterId);
                    if (entry != null) c = MonsterBuilder.Build(entry, root);
                }
                else
                {
                    var entry = MonsterBuilder.Data.Entry(a.monsterId);
                    if (entry != null) c = MonsterBuilder.Build(entry, root);
                }
            }
            catch (Exception e) { Debug.LogException(e); }
            if (c == null)
            {
                var go = FloorThingLook.Box(root, "Stand-in " + a.name, Vector3.zero, new Vector3(0.6f, 1.4f, 0.6f), FloorThingLook.Iron);
                c = new Character { root = go, height = 1.4f };
            }
            figures[a.id] = c;
            return c;
        }

        Transform TransformOf(string id)
        {
            if (id == "hero-0") return screen.Hero.root.transform;
            return figures.TryGetValue(id, out var f) && f?.root != null ? f.root.transform : null;
        }

        CharacterAnimator AnimatorOf(string id)
        {
            if (id == "hero-0") return screen.Hero.animator;
            return figures.TryGetValue(id, out var f) ? f?.animator : null;
        }

        readonly Queue<FightEventView> queue = new();

        /// <summary>Each frame: the camera's swing, the events acted out one at a time, a rules step when the queue is empty; true while the fight goes on.</summary>
        public bool Tick(float dt)
        {
            if (!Active) return false;
            if (cameraParked)
            {
                camBlend = Mathf.Min(1f, camBlend + dt / 0.5f);
                float k = Mathf.SmoothStep(0f, 1f, camBlend);
                cam.transform.position = Vector3.Lerp(camFrom, camTo, k);
                cam.transform.rotation = Quaternion.Slerp(camRotFrom, camRotTo, k);
            }
            FloatNumbers(dt);
            wait -= dt;
            if (wait > 0f) return true;
            if (queue.Count == 0)
            {
                if (View != null && View.over != "") { End(); return false; }
                // One action of the rules (the sim's own player chooses until Phase 20), then its events.
                try { FloorPlay.Engine.Step(play.Handle, "{\"kind\":\"auto\"}"); Actions++; }
                catch (Exception e) { Debug.LogException(e); End(); return false; }
                Read();
                try
                {
                    var ev = JsonUtility.FromJson<FightEvents>(FloorPlay.Engine.FightEvents(play.Handle, seen));
                    seen = ev.total;
                    foreach (var e in ev.items) queue.Enqueue(e);
                }
                catch (Exception e) { Debug.LogException(e); }
                if (Actions > 900) { End(); return false; }
                if (queue.Count == 0) { wait = 0.05f; return true; }
            }
            var next = queue.Dequeue();
            float seconds = Act(next);
            wait = Hurry ? Mathf.Min(HurrySeconds, seconds) : seconds;
            return true;
        }

        /// <summary>One event acted out; the seconds it wants on the stage.</summary>
        float Act(FightEventView e)
        {
            LastText = e.text;
            switch (e.kind)
            {
                case "action":
                {
                    var anim = AnimatorOf(e.actorId);
                    string clip = ClipFor(e);
                    if (anim != null && anim.Has(clip)) anim.Play(clip);
                    Face(e.actorId, e.targetId);
                    if (e.skillId != "") Summon(e);
                    return e.skillId != "" && summonFigure != null ? 1.4f : 0.9f;
                }
                case "damage":
                case "dot":
                {
                    var anim = AnimatorOf(e.targetId != "" ? e.targetId : e.actorId);
                    if (anim != null && anim.Has("Hit")) anim.Play("Hit");
                    Number(e.targetId != "" ? e.targetId : e.actorId, e.amount.ToString(), e.text.Contains("crit") ? new Color(1f, 0.82f, 0.3f) : new Color(1f, 0.95f, 0.9f));
                    return 0.6f;
                }
                case "miss": Number(e.targetId, "miss", new Color(0.7f, 0.7f, 0.75f)); return 0.5f;
                case "heal": case "hot": Number(e.targetId != "" ? e.targetId : e.actorId, "+" + e.amount, new Color(0.55f, 1f, 0.6f)); return 0.5f;
                case "fallen":
                {
                    var anim = AnimatorOf(e.actorId);
                    if (anim != null && anim.Has("Defeat")) anim.Play("Defeat");
                    return 1.0f;
                }
                case "guard": { var anim = AnimatorOf(e.actorId); if (anim != null && anim.Has("Guard")) anim.Play("Guard"); return 0.5f; }
                case "flee": return 0.6f;
                case "end": return 0.8f;
                default: return 0.2f;
            }
        }

        static string ClipFor(FightEventView e)
        {
            if (e.skillId != "") return e.skillId.Contains("shoot") || e.skillId.Contains("shot") || e.skillId.Contains("arrow") ? "Shoot" : e.skillId.StartsWith("arcanist-") || e.skillId.StartsWith("mender-") ? "Cast" : "Attack_Heavy";
            return e.text.Contains("attacks") ? "Attack_Light" : "Attack_Light";
        }

        void Face(string actorId, string targetId)
        {
            var a = TransformOf(actorId); var t = TransformOf(targetId);
            if (a == null || t == null || actorId == targetId) return;
            var to = t.position - a.position; to.y = 0;
            if (to.sqrMagnitude > 0.01f) a.rotation = Quaternion.LookRotation(to.normalized, Vector3.up);
        }

        /// <summary>A summon's call (D-154, D-179): its creature appears before the caster, strikes toward the target, and is gone when the next action comes.</summary>
        void Summon(FightEventView e)
        {
            var look = SummonLook.Of(e.skillId);
            if (look == null) return;
            ClearSummon();
            try
            {
                var entry = look.Entry();
                summonFigure = MonsterBuilder.Build(entry, root);
                var caster = TransformOf(e.actorId);
                var target = TransformOf(e.targetId);
                var at = caster != null ? caster.position + caster.forward * 1.3f + Vector3.up * 0.05f : centre;
                summonFigure.root.transform.position = at;
                var facing = target != null ? target.position - at : (caster != null ? caster.forward : forward);
                facing.y = 0;
                if (facing.sqrMagnitude > 0.01f) summonFigure.root.transform.rotation = Quaternion.LookRotation(facing.normalized, Vector3.up);
                if (summonFigure.animator != null && summonFigure.animator.Has("Attack1")) summonFigure.animator.Play("Attack1");
                Summons++;
                GvLog.Line("summon", ("skill", e.skillId), ("creature", look.creature));
            }
            catch (Exception ex) { Debug.LogException(ex); summonFigure = null; }
        }

        void ClearSummon()
        {
            summonFigure?.Destroy();
            summonFigure = null;
        }

        void Number(string actorId, string text, Color color)
        {
            var t = TransformOf(actorId);
            if (t == null || overlay == null || cam == null) return;
            var l = new Label(text) { pickingMode = PickingMode.Ignore };
            l.style.position = Position.Absolute;
            l.style.fontSize = 26;
            l.style.color = color;
            l.style.unityFontStyleAndWeight = FontStyle.Bold;
            l.userData = new NumberRide { at = t.position + Vector3.up * (HeightOf(actorId) + 0.2f), age = 0f };
            overlay.Add(l);
            numbers.Add(l);
        }

        sealed class NumberRide { public Vector3 at; public float age; }

        float HeightOf(string id)
        {
            if (id == "hero-0") return screen.Hero.height;
            return figures.TryGetValue(id, out var f) ? f.height : 1.4f;
        }

        void FloatNumbers(float dt)
        {
            if (overlay == null || cam == null) return;
            var panel = overlay.panel;
            for (int i = numbers.Count - 1; i >= 0; i--)
            {
                var l = numbers[i];
                var ride = l.userData as NumberRide;
                if (ride == null) { numbers.RemoveAt(i); l.RemoveFromHierarchy(); continue; }
                ride.age += dt;
                if (ride.age > 1.2f) { numbers.RemoveAt(i); l.RemoveFromHierarchy(); continue; }
                var world = ride.at + Vector3.up * (ride.age * 0.8f);
                var sp = cam.WorldToScreenPoint(world);
                if (sp.z < 0f || panel == null) { l.style.display = DisplayStyle.None; continue; }
                var pp = RuntimePanelUtils.ScreenToPanel(panel, new Vector2(sp.x, Screen.height - sp.y));
                l.style.display = DisplayStyle.Flex;
                l.style.left = pp.x - 20f;
                l.style.top = pp.y - 14f;
                l.style.opacity = 1f - Mathf.Clamp01((ride.age - 0.7f) / 0.5f);
            }
        }

        /// <summary>Hurries the rest of the fight (A while it plays).</summary>
        public void HurryUp() => Hurry = true;

        /// <summary>The fight is over in the rules: the figures go, the camera returns; the card follows from FloorPlay.</summary>
        public void End()
        {
            if (!Active) return;
            Active = false;
            ClearSummon();
            foreach (var f in figures.Values) f?.Destroy();
            figures.Clear(); homes.Clear();
            foreach (var l in numbers) l.RemoveFromHierarchy();
            numbers.Clear();
            if (follow != null) { follow.enabled = true; follow.Snap(); }
            cameraParked = false;
            GvLog.Line("stage-end", ("actions", Actions), ("summons", Summons), ("outcome", View?.over ?? ""));
        }

        public void Dispose()
        {
            End();
            overlay?.RemoveFromHierarchy();
            if (root != null) UnityEngine.Object.Destroy(root.gameObject);
        }
    }

    /// <summary>
    /// The six summons' creatures (D-154, D-179 Proposed): until their own Blender builds come, each is a monster base
    /// re-dressed — its own palette and size, an original name — so the call reads on the floor today.
    /// </summary>
    public sealed class SummonLook
    {
        public string creature, baseId, name;
        public float scale;
        public string[] palette;

        static readonly Dictionary<string, SummonLook> ByCreature = new()
        {
            ["ember-imp"] = new SummonLook { creature = "ember-imp", baseId = "imp", name = "Ember Imp", scale = 0.95f, palette = new[] { "#e8742a", "#ffd24a", "#3a1208" } },
            ["rime-stag"] = new SummonLook { creature = "rime-stag", baseId = "hound", name = "Rime Stag", scale = 1.35f, palette = new[] { "#dfefff", "#7fd4ff", "#2a4a66" } },
            ["storm-hawk"] = new SummonLook { creature = "storm-hawk", baseId = "bat", name = "Storm Hawk", scale = 1.5f, palette = new[] { "#c9b8ff", "#ffffff", "#4b2e8a" } },
            ["bog-serpent"] = new SummonLook { creature = "bog-serpent", baseId = "tentacle", name = "Bog Serpent", scale = 1.4f, palette = new[] { "#2f5a2a", "#9adf5a", "#101a0c" } },
            ["dawn-warden"] = new SummonLook { creature = "dawn-warden", baseId = "sentinel", name = "Dawn Warden", scale = 1.2f, palette = new[] { "#f6e6b0", "#ffd24a", "#8a6a2a" } },
            ["night-maw"] = new SummonLook { creature = "night-maw", baseId = "wraith", name = "Night Maw", scale = 1.6f, palette = new[] { "#1a1020", "#7a2e8a", "#3a2a44" } },
        };

        public static SummonLook Of(string skillId)
        {
            if (string.IsNullOrEmpty(skillId) || !skillId.StartsWith("arcanist-call-")) return null;
            return ByCreature.TryGetValue(skillId.Substring("arcanist-call-".Length), out var l) ? l : null;
        }

        public MonsterEntry Entry()
        {
            var e = JsonUtility.FromJson<MonsterEntry>("{\"key\":\"" + creature + "\",\"base\":\"" + baseId + "\",\"name\":\"" + name + "\",\"scale\":" + scale.ToString(System.Globalization.CultureInfo.InvariantCulture) + ",\"palette\":[\"" + string.Join("\",\"", palette) + "\"],\"clipMap\":[{\"from\":\"Idle\",\"to\":\"Idle\"},{\"from\":\"Attack1\",\"to\":\"Attack1\"},{\"from\":\"Attack2\",\"to\":\"Attack2\"},{\"from\":\"Hit\",\"to\":\"Hit\"},{\"from\":\"Death\",\"to\":\"Death\"},{\"from\":\"Move\",\"to\":\"Move\"}],\"ghost\":" + (creature == "night-maw" || creature == "dawn-warden" ? "true" : "false") + "}");
            return e;
        }
    }
}

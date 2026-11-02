using System;
using System.Collections.Generic;
using Gloamvault.Level;
using Gloamvault.Sim;
using UnityEngine;
using UnityEngine.UIElements;

namespace Gloamvault
{
    // ---- what the bridge sends (bridge.ts tree / heroView), shaped for JsonUtility ----
    [Serializable] public sealed class TreeSkill { public string id, name; public int tier; public string type; public int cost, weight; public string target, description, prerequisiteId; public bool technique; public string summon, mastery; }
    [Serializable] public sealed class TreeTier { public int tier; public TreeSkill[] skills; }
    [Serializable] public sealed class TreeBranch { public string school, name, philosophy; public TreeTier[] tiers; }
    [Serializable] public sealed class TreeFile { public string classId, name, role; public TreeBranch[] branches; }
    [Serializable] public sealed class HeroStanding { public string skillId; public bool known; public int rank, cost; public bool open; public string reason, equipped; }
    [Serializable] public sealed class HeroView { public string id, name, classId, speciesId; public int level, battleXp, points, earned, tierOpen; public string[] actives, passives; public string ultimate; public HeroStanding[] standings; }

    /// <summary>
    /// The skill tree screen (Phase 18, D-153, D-154): a class's branches as columns, five tiers down each, every skill
    /// a button that says known · open · why not; a test hero of the class spends its points (the rules decide through
    /// the bridge), equips what it knows, is raised a few levels, or resets. Phase 22 seats the saved roster here.
    /// </summary>
    public sealed class TreeScreen : MonoBehaviour
    {
        public static readonly string[] Classes = { "warden", "blade", "mender", "ranger", "shade", "arcanist" };
        public string ClassId { get; private set; } = "arcanist";
        public int Handle { get; private set; } = -1;
        public TreeFile Tree { get; private set; }
        public HeroView Hero { get; private set; }
        public string Picked { get; private set; } = "";
        public string Error { get; private set; } = "";
        public int SkillButtons => buttons.Count;

        UIDocument document;
        VisualElement title, container, branchesHost, detailButtons, columns;
        readonly List<VisualElement> hidden = new();
        Label className, points, detailName, detailMeta, detailText, detailState, loadout;
        readonly Dictionary<string, Button> buttons = new();
        readonly Dictionary<string, TreeSkill> skills = new();

        public static TreeScreen Open(UIDocument document, string classId = "arcanist", int level = 1)
        {
            var existing = document.GetComponent<TreeScreen>();
            if (existing != null) return existing;
            var s = document.gameObject.AddComponent<TreeScreen>();
            s.document = document;
            s.ClassId = Array.IndexOf(Classes, classId) >= 0 ? classId : "arcanist";
            s.Build();
            s.Load(level);
            return s;
        }

        void Build()
        {
            var tree = Resources.Load<VisualTreeAsset>("UI/Tree");
            if (tree == null) throw new InvalidOperationException("missing Resources/UI/Tree.uxml");
            var root = document.rootVisualElement;
            title = root.Q("title");
            foreach (var name in new[] { "title__left", "menu" })
            {
                var e = title.Q(className: name);
                if (e == null) continue;
                hidden.Add(e);
                e.style.display = DisplayStyle.None;
            }
            var version = root.Q("version");
            if (version != null) { hidden.Add(version); version.style.display = DisplayStyle.None; }
            container = tree.Instantiate();
            container.style.flexGrow = 1;
            container.style.alignSelf = Align.Stretch;
            container.style.flexDirection = FlexDirection.Column;
            title.Add(container);
            var t = container.Q("tree");
            var sheet = Resources.Load<StyleSheet>("UI/Tree");
            if (sheet != null && !t.styleSheets.Contains(sheet)) t.styleSheets.Add(sheet);
            className = t.Q<Label>("className"); points = t.Q<Label>("points");
            detailName = t.Q<Label>("detailName"); detailMeta = t.Q<Label>("detailMeta"); detailText = t.Q<Label>("detailText"); detailState = t.Q<Label>("detailState"); loadout = t.Q<Label>("loadout");
            detailButtons = t.Q("detailButtons");
            branchesHost = t.Q("branches");
            t.Q<Button>("classPrev").clicked += () => { Step(-1); };
            t.Q<Button>("classNext").clicked += () => { Step(1); };
            t.Q<Button>("levelUp").clicked += () => { if (Hero != null) Call(() => FloorPlay.Engine.HeroLevel(Handle, Math.Min(40, Hero.level + 5))); };
            t.Q<Button>("reset").clicked += () => { Call(() => FloorPlay.Engine.HeroReset(Handle)); };
            t.Q<Button>("back").clicked += Close;
        }

        public void Step(int by)
        {
            int i = Array.IndexOf(Classes, ClassId);
            ClassId = Classes[(i + by + Classes.Length) % Classes.Length];
            Load(Hero?.level ?? 1);
        }

        /// <summary>A fresh test hero of the class at the level; the tree drawn.</summary>
        public void Load(int level)
        {
            try
            {
                FloorPlay.EnsureEngine();
                if (Handle >= 0) { try { FloorPlay.Engine.HeroDispose(Handle); } catch (Exception) { } }
                Tree = JsonUtility.FromJson<TreeFile>(FloorPlay.Engine.Tree(ClassId));
                Handle = FloorPlay.Engine.HeroMake("{\"classId\":\"" + ClassId + "\",\"speciesId\":\"" + (ClassId == "arcanist" ? "elf" : "human") + "\",\"level\":" + level + "}");
                Hero = JsonUtility.FromJson<HeroView>(FloorPlay.Engine.HeroView(Handle));
                Picked = "";
                Error = "";
                Draw();
                GvLog.Line("tree", ("class", ClassId), ("level", Hero.level), ("points", Hero.points), ("branches", Tree.branches.Length));
            }
            catch (Exception e)
            {
                Error = e.Message;
                Debug.LogException(e);
                if (points != null) points.text = "✗ " + e.Message;
            }
        }

        /// <summary>One bridge call that returns the hero's new view; a refusal shows on the detail pane, never throws at the screen.</summary>
        void Call(Func<string> call)
        {
            if (Handle < 0) return;
            try
            {
                Hero = JsonUtility.FromJson<HeroView>(call());
                Refresh();
            }
            catch (SimException e)
            {
                if (detailState != null) detailState.text = e.Message;
                GvLog.Line("tree-refused", ("why", e.Message));
            }
            catch (Exception e) { Debug.LogException(e); }
        }

        /// <summary>Spends points on a skill (the tests, the detail pane's button).</summary>
        public bool Spend(string skillId)
        {
            int before = Hero?.points ?? 0;
            Call(() => FloorPlay.Engine.HeroSpend(Handle, skillId));
            return Hero != null && Hero.points < before;
        }

        public void Equip(int slot, string skillId) => Call(() => FloorPlay.Engine.HeroEquip(Handle, slot, skillId));

        public HeroStanding StandingOf(string skillId)
        {
            if (Hero?.standings == null) return null;
            foreach (var s in Hero.standings) if (s.skillId == skillId) return s;
            return null;
        }

        void Draw()
        {
            buttons.Clear(); skills.Clear();
            branchesHost.Clear();
            columns = new VisualElement();
            columns.AddToClassList("tree__columns");
            branchesHost.Add(columns);
            className.text = Tree.name;
            foreach (var b in Tree.branches)
            {
                var col = new VisualElement();
                col.AddToClassList("tree__branch");
                var head = new Label(b.name); head.AddToClassList("tree__branchName"); col.Add(head);
                var text = new Label(b.philosophy); text.AddToClassList("tree__branchText"); col.Add(text);
                foreach (var tier in b.tiers)
                {
                    var row = new VisualElement();
                    row.AddToClassList("tree__tier");
                    var lab = new Label(Roman(tier.tier)); lab.AddToClassList("tree__tierLabel"); row.Add(lab);
                    foreach (var s in tier.skills)
                    {
                        skills[s.id] = s;
                        var btn = new Button { text = s.name };
                        btn.AddToClassList("tree__skill");
                        var id = s.id;
                        btn.clicked += () => Pick(id);
                        buttons[s.id] = btn;
                        row.Add(btn);
                    }
                    col.Add(row);
                }
                columns.Add(col);
            }
            Refresh();
        }

        static string Roman(int n) => n switch { 1 => "I", 2 => "II", 3 => "III", 4 => "IV", 5 => "V", _ => n.ToString() };

        void Refresh()
        {
            if (Hero == null) return;
            points.text = $"{Hero.name} · level {Hero.level} · {Hero.points} point{(Hero.points == 1 ? "" : "s")} to spend (of {Hero.earned}) · {(Hero.tierOpen <= 1 ? "Tier I open" : $"Tiers I–{Roman(Hero.tierOpen)} open")}";
            foreach (var kv in buttons)
            {
                var st = StandingOf(kv.Key);
                var b = kv.Value;
                b.RemoveFromClassList("tree__skill--known"); b.RemoveFromClassList("tree__skill--open"); b.RemoveFromClassList("tree__skill--equipped"); b.RemoveFromClassList("tree__skill--picked");
                if (st != null && st.known) b.AddToClassList("tree__skill--known");
                else if (st != null && st.open) b.AddToClassList("tree__skill--open");
                if (st != null && !string.IsNullOrEmpty(st.equipped)) b.AddToClassList("tree__skill--equipped");
                if (kv.Key == Picked) b.AddToClassList("tree__skill--picked");
                var s = skills[kv.Key];
                b.text = st != null && st.known ? $"{s.name}\nrank {st.rank}" : $"{s.name}\n{st?.cost ?? 0} pt";
            }
            var sb = new System.Text.StringBuilder("In the fight: ");
            for (int i = 0; i < 4; i++) sb.Append(i > 0 ? " · " : "").Append(Hero.actives != null && i < Hero.actives.Length && Hero.actives[i] != "" ? NameOf(Hero.actives[i]) : "—");
            sb.Append("  |  passives: ");
            for (int i = 0; i < 2; i++) sb.Append(i > 0 ? " · " : "").Append(Hero.passives != null && i < Hero.passives.Length && Hero.passives[i] != "" ? NameOf(Hero.passives[i]) : "—");
            loadout.text = sb.ToString();
            if (Picked != "") ShowDetail(Picked);
            else { detailName.text = "Tap a skill"; detailMeta.text = ""; detailText.text = ""; detailState.text = ""; detailButtons.Clear(); }
        }

        string NameOf(string id) => skills.TryGetValue(id, out var s) ? s.name : id;

        public void Pick(string skillId)
        {
            Picked = skillId;
            Refresh();
        }

        void ShowDetail(string skillId)
        {
            if (!skills.TryGetValue(skillId, out var s)) return;
            var st = StandingOf(skillId);
            detailName.text = s.name;
            string kind = s.type == "passive" ? "Passive" : $"Active · {s.cost} {(ClassId == "arcanist" || ClassId == "mender" ? "Mana" : "Stamina")} · {(s.weight >= 1400 ? "heavy" : s.weight <= 800 ? "light" : "normal")} · {s.target}";
            detailMeta.text = $"Tier {Roman(s.tier)} · {kind}{(s.summon != "" ? " · a summon: " + s.summon : "")}{(s.technique ? " · a monster technique" : "")}";
            detailText.text = s.description + (s.mastery != "" ? "\n\nMastery (rank 10): " + s.mastery : "") + (s.prerequisiteId != "" ? "\nNeeds: " + NameOf(s.prerequisiteId) : "");
            detailState.text = st == null ? "" : st.known ? $"Known · rank {st.rank}{(st.equipped != "" ? " · equipped as " + st.equipped : "")}" : st.open ? $"Open: costs {st.cost} point{(st.cost == 1 ? "" : "s")}" : st.reason;
            detailButtons.Clear();
            if (st == null) return;
            if (st.open)
            {
                var buy = new Button { text = $"Learn ({st.cost} pt)" };
                buy.AddToClassList("tree__btn"); buy.AddToClassList("tree__btn--primary");
                buy.clicked += () => Spend(skillId);
                detailButtons.Add(buy);
            }
            else if (st.known && s.type == "passive")
            {
                for (int i = 0; i < 2; i++) { int slot = 4 + i; var b = new Button { text = $"Passive slot {i + 1}" }; b.AddToClassList("tree__btn"); b.clicked += () => Equip(slot, skillId); detailButtons.Add(b); }
            }
            else if (st.known)
            {
                for (int i = 0; i < 4; i++) { int slot = i; var b = new Button { text = $"Slot {i + 1}" }; b.AddToClassList("tree__btn"); b.clicked += () => Equip(slot, skillId); detailButtons.Add(b); }
            }
        }

        void Close()
        {
            if (Handle >= 0) { try { FloorPlay.Engine?.HeroDispose(Handle); } catch (Exception) { } Handle = -1; }
            container?.RemoveFromHierarchy();
            foreach (var e in hidden) e.style.display = DisplayStyle.Flex;
            Destroy(this);
        }
    }
}

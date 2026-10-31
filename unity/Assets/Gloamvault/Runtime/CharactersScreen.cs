using System;
using System.Collections.Generic;
using Gloamvault.Characters;
using UnityEngine;
using UnityEngine.UIElements;

namespace Gloamvault
{
    /// <summary>
    /// The Characters viewer (Phase 12): a hero of any species and class — tier, frame and face to choose, every clip a
    /// button, drag to turn — or a monster of any zone (and the pets), tap to cycle its moves. The title's hall is the
    /// stage; the character stands on a plinth under its torches.
    /// </summary>
    public sealed class CharactersScreen : MonoBehaviour
    {
        public Character Current { get; private set; }
        public bool Heroes { get; private set; } = true;
        public HeroSpec Spec { get; } = new HeroSpec();
        public int Zone { get; private set; }
        public int MonsterIndex { get; private set; }
        public static readonly string[] Zones = { "cellars", "crypts", "vault", "pets" };

        UIDocument document;
        VisualElement title, container, stage;
        readonly List<VisualElement> hidden = new();
        Label speciesLabel, classLabel, faceLabel, zoneLabel, monsterLabel, statsLabel;
        Button tierButton, frameButton, tabHeroes, tabMonsters;
        VisualElement heroPickers, monsterPickers, clipRow;
        Camera cam;
        Vector3 camPos; Quaternion camRot; float camFov;
        GameObject plinth;
        public GameObject stageLight;
        /// <summary>A character's front is +z after the import; the camera sits at −z, so a character turns to face it.</summary>
        public const float FaceCamera = 180f;
        float yaw = FaceCamera;

        /// <summary>
        /// The viewer's light: one warm key from the front-top (the main light, with soft shadows) above the hall's dim
        /// moon. No second directional light: a second one, as an additional light, scrambles the body shader's colours
        /// (D-160, open) — the rooms' torches are point lights and never met the case.
        /// </summary>
        public static GameObject StageLight(Vector3 at)
        {
            var root = new GameObject("Stage light");
            root.transform.position = at;
            var key = new GameObject("Key").AddComponent<Light>();
            key.transform.SetParent(root.transform, false);
            key.type = LightType.Directional;
            key.color = new Color(1f, 0.93f, 0.84f);
            key.intensity = 1.35f;
            key.shadows = LightShadows.Soft;
            key.shadowStrength = 0.6f;
            key.transform.rotation = Quaternion.Euler(38f, 200f, 0f);
            return root;
        }
        List<ListedMonster> zoneList = new();
        int clipCycle;

        public static CharactersScreen Open(UIDocument document, string hero = null, string monster = null)
        {
            var existing = document.GetComponent<CharactersScreen>();
            if (existing != null) return existing;
            var s = document.gameObject.AddComponent<CharactersScreen>();
            s.document = document;
            s.Build();
            if (monster != null) s.ShowMonster(monster);
            else { if (hero != null) s.ParseHero(hero); s.ShowHero(); }
            return s;
        }

        void ParseHero(string spec)
        {
            var p = spec.Split(',');
            if (p.Length > 0 && p[0] != "") Spec.speciesId = p[0];
            if (p.Length > 1 && p[1] != "") Spec.classId = p[1];
            if (p.Length > 2 && p[2] != "") Spec.tier = p[2].ToUpperInvariant() == "S" ? "S" : "F";
            if (p.Length > 3 && p[3] != "") Spec.frame = p[3];
        }

        void Build()
        {
            var tree = Resources.Load<VisualTreeAsset>("UI/Characters");
            if (tree == null) throw new InvalidOperationException("missing Resources/UI/Characters.uxml");
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
            container.pickingMode = PickingMode.Ignore;
            title.Add(container);
            var chars = container.Q("chars");
            var sheet = Resources.Load<StyleSheet>("UI/Characters");
            if (sheet != null && !chars.styleSheets.Contains(sheet)) chars.styleSheets.Add(sheet);

            speciesLabel = chars.Q<Label>("species"); classLabel = chars.Q<Label>("class"); faceLabel = chars.Q<Label>("face");
            zoneLabel = chars.Q<Label>("zone"); monsterLabel = chars.Q<Label>("monster"); statsLabel = chars.Q<Label>("stats");
            tierButton = chars.Q<Button>("tier"); frameButton = chars.Q<Button>("frame");
            tabHeroes = chars.Q<Button>("tabHeroes"); tabMonsters = chars.Q<Button>("tabMonsters");
            heroPickers = chars.Q("heroPickers"); monsterPickers = chars.Q("monsterPickers"); clipRow = chars.Q("clips");
            stage = chars.Q("stage");

            chars.Q<Button>("speciesPrev").clicked += () => { Spec.speciesId = Step(HeroLibrary.SpeciesIds, Spec.speciesId, -1); ShowHero(); };
            chars.Q<Button>("speciesNext").clicked += () => { Spec.speciesId = Step(HeroLibrary.SpeciesIds, Spec.speciesId, 1); ShowHero(); };
            chars.Q<Button>("classPrev").clicked += () => { Spec.classId = Step(HeroLibrary.Classes, Spec.classId, -1); ShowHero(); };
            chars.Q<Button>("classNext").clicked += () => { Spec.classId = Step(HeroLibrary.Classes, Spec.classId, 1); ShowHero(); };
            chars.Q<Button>("facePrev").clicked += () => { Spec.face = (Spec.face + 2) % 3; SyncLookToPreset(); ShowHero(); };
            chars.Q<Button>("faceNext").clicked += () => { Spec.face = (Spec.face + 1) % 3; SyncLookToPreset(); ShowHero(); };
            tierButton.clicked += () => { Spec.tier = Spec.tier == "S" ? "F" : "S"; ShowHero(); };
            frameButton.clicked += () => { Spec.frame = Spec.frame == "broad" ? "slight" : "broad"; ShowHero(); };
            chars.Q<Button>("zonePrev").clicked += () => { Zone = (Zone + Zones.Length - 1) % Zones.Length; MonsterIndex = 0; ShowMonsterAt(); };
            chars.Q<Button>("zoneNext").clicked += () => { Zone = (Zone + 1) % Zones.Length; MonsterIndex = 0; ShowMonsterAt(); };
            chars.Q<Button>("monsterPrev").clicked += () => { if (zoneList.Count > 0) { MonsterIndex = (MonsterIndex + zoneList.Count - 1) % zoneList.Count; ShowMonsterAt(); } };
            chars.Q<Button>("monsterNext").clicked += () => { if (zoneList.Count > 0) { MonsterIndex = (MonsterIndex + 1) % zoneList.Count; ShowMonsterAt(); } };
            tabHeroes.clicked += () => { Heroes = true; ShowHero(); };
            tabMonsters.clicked += () => { Heroes = false; ShowMonsterAt(); };
            chars.Q<Button>("back").clicked += Close;
            // Drag on the stage turns the character; a tap cycles a monster's moves.
            stage.RegisterCallback<PointerMoveEvent>(e => { if (e.pressedButtons != 0 && Current?.root != null) { yaw += e.deltaPosition.x * 0.5f; Current.root.transform.rotation = Quaternion.Euler(0, yaw, 0); } });
            stage.RegisterCallback<ClickEvent>(_ => { if (!Heroes) CycleMonsterClip(); });

            cam = Camera.main;
            camPos = cam.transform.position; camRot = cam.transform.rotation; camFov = cam.fieldOfView;
            stageLight = StageLight(new Vector3(0, 0, 0));
            plinth = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            plinth.name = "Plinth";
            plinth.transform.position = new Vector3(0, -0.1f, 0);
            plinth.transform.localScale = new Vector3(1.6f, 0.1f, 1.6f);
            Destroy(plinth.GetComponent<Collider>());
            var pm = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = new Color(0.16f, 0.14f, 0.17f) };
            plinth.GetComponent<MeshRenderer>().sharedMaterial = pm;
            SyncLookToPreset();
        }

        static string Step(string[] list, string current, int by)
        {
            int i = Array.IndexOf(list, current);
            if (i < 0) i = 0;
            return list[((i + by) % list.Length + list.Length) % list.Length];
        }

        void SyncLookToPreset()
        {
            var sp = HeroLibrary.Instance.data.Species(Spec.speciesId);
            if (sp?.presets == null || sp.presets.Length == 0) return;
            var p = sp.presets[((Spec.face % sp.presets.Length) + sp.presets.Length) % sp.presets.Length];
            Spec.skin = p.tintSkin;
            Spec.hair = p.tintHair;
        }

        public void ShowHero()
        {
            Heroes = true;
            SetTabs();
            Replace(() => HeroAssembler.Build(Spec));
            var sp = HeroLibrary.Instance.data.Species(Spec.speciesId);
            speciesLabel.text = Cap(Spec.speciesId);
            classLabel.text = Cap(Spec.classId);
            faceLabel.text = sp?.presets != null && sp.presets.Length > 0 ? sp.presets[((Spec.face % sp.presets.Length) + sp.presets.Length) % sp.presets.Length].name : "Face";
            tierButton.text = Spec.tier == "S" ? "Fine (S)" : "Crude (F)";
            frameButton.text = Cap(Spec.frame);
            BuildClipRow(new[] { "Idle", "Walk", "Run", "Attack_Light", "Attack_Heavy", "Attack_Dual", "Shoot", "Cast", "Guard", "Guard_Shield", "Hit", "Dodge", "Downed", "Revive", "Victory", "Defeat", "Interact", "SitRest", "Breath", "Roar" });
            Play("Idle");
        }

        public void ShowMonster(string entryKey)
        {
            Heroes = false;
            // Find it in the zone lists so the pickers agree.
            for (int z = 0; z < Zones.Length; z++)
            {
                var list = ListFor(z);
                for (int i = 0; i < list.Count; i++) if (list[i].entry == entryKey || list[i].id == entryKey) { Zone = z; MonsterIndex = i; ShowMonsterAt(); return; }
            }
            MonsterIndex = 0;
            ShowMonsterAt();
        }

        List<ListedMonster> ListFor(int zone)
        {
            var o = new List<ListedMonster>();
            foreach (var m in MonsterBuilder.Data.list) if (m.zone == Zones[zone] && !string.IsNullOrEmpty(m.entry)) o.Add(m);
            return o;
        }

        void ShowMonsterAt()
        {
            Heroes = false;
            SetTabs();
            zoneList = ListFor(Zone);
            zoneLabel.text = Cap(Zones[Zone]);
            if (zoneList.Count == 0) { monsterLabel.text = "—"; statsLabel.text = "no models in this zone"; return; }
            var m = zoneList[MonsterIndex % zoneList.Count];
            var entry = MonsterBuilder.Data.Entry(m.entry);
            monsterLabel.text = $"{m.name}";
            clipCycle = 0;
            Replace(() => MonsterBuilder.Build(entry));
            var names = new List<string> { "Idle", "Move", "Attack1", "Attack2", "Hit", "Death", "Flee" };
            if (Current?.animator != null) foreach (var n in Current.animator.ClipNames) if (!names.Contains(n) && !IsHeroClip(n)) names.Add(n);
            BuildClipRow(names.ToArray());
            Play("Idle");
        }

        static bool IsHeroClip(string n) => Array.IndexOf(new[] { "Walk", "Run", "Attack_Light", "Attack_Heavy", "Attack_Dual", "Shoot", "Cast", "Guard", "Guard_Shield", "Dodge", "Downed", "Revive", "Victory", "Defeat", "Interact", "SitRest", "Breath", "Roar" }, n) >= 0;

        void CycleMonsterClip()
        {
            var cycle = new[] { "Idle", "Move", "Attack1", "Attack2", "Hit", "Death", "Flee" };
            clipCycle = (clipCycle + 1) % cycle.Length;
            Play(cycle[clipCycle]);
        }

        void Replace(Func<Character> build)
        {
            Current?.Destroy();
            Current = null;
            try
            {
                Current = build();
                Current.root.transform.position = Vector3.zero;
                Current.root.transform.rotation = Quaternion.Euler(0, yaw, 0);
                FrameCamera(Current.height);
                statsLabel.text = $"{Current.label} · {Current.renderers.Count} meshes · {Current.height:0.00} m" + (Current.missing.Count > 0 ? " · missing: " + string.Join(", ", Current.missing) : "");
                GvLog.Line("character", ("label", Current.label), ("meshes", Current.renderers.Count), ("height", Current.height), ("missing", string.Join(",", Current.missing)));
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                statsLabel.text = "✗ " + e.Message;
            }
        }

        void FrameCamera(float height)
        {
            float h = Mathf.Max(0.6f, height);
            cam.transform.position = new Vector3(0, h * 0.55f, -h * 1.75f - 0.6f);
            cam.transform.LookAt(new Vector3(0, h * 0.5f, 0), Vector3.up);
            cam.fieldOfView = 32f;
        }

        void BuildClipRow(string[] names)
        {
            clipRow.Clear();
            if (Current?.animator == null) return;
            foreach (var n in names)
            {
                if (!Current.animator.Has(n)) continue;
                var b = new Button { text = n.Replace('_', ' ') };
                b.AddToClassList("chars__clip");
                string clip = n;
                b.clicked += () => Play(clip);
                clipRow.Add(b);
            }
        }

        public void Play(string name)
        {
            if (Current?.animator == null) return;
            Current.animator.Play(name);
            foreach (var child in clipRow.Children())
                if (child is Button b) { if (b.text == name.Replace('_', ' ')) b.AddToClassList("chars__clip--on"); else b.RemoveFromClassList("chars__clip--on"); }
        }

        void SetTabs()
        {
            heroPickers.style.display = Heroes ? DisplayStyle.Flex : DisplayStyle.None;
            monsterPickers.style.display = Heroes ? DisplayStyle.None : DisplayStyle.Flex;
            if (Heroes) { tabHeroes.AddToClassList("chars__tab--on"); tabMonsters.RemoveFromClassList("chars__tab--on"); }
            else { tabMonsters.AddToClassList("chars__tab--on"); tabHeroes.RemoveFromClassList("chars__tab--on"); }
        }

        static string Cap(string s) => string.IsNullOrEmpty(s) ? "" : char.ToUpperInvariant(s[0]) + s.Substring(1);

        void Close()
        {
            Current?.Destroy();
            Current = null;
            if (plinth != null) Destroy(plinth);
            if (stageLight != null) Destroy(stageLight);
            container?.RemoveFromHierarchy();
            foreach (var e in hidden) e.style.display = DisplayStyle.Flex;
            if (cam != null) { cam.transform.position = camPos; cam.transform.rotation = camRot; cam.fieldOfView = camFov; }
            Destroy(this);
        }
    }
}

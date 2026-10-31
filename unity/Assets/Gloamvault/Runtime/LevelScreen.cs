using System;
using System.Collections.Generic;
using Gloamvault.Characters;
using Gloamvault.Env;
using Gloamvault.Level;
using Gloamvault.Walk;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using UnityEngine.UIElements;

namespace Gloamvault
{
    /// <summary>
    /// The test level (Phase 14, D-163): a generated level of dozens of rooms streamed around the hero, walked with
    /// Phase 13's stick, camera and A, or by the pilot (Auto walk) — which is also the soak: started with the launch
    /// extra <c>gv=soak</c> it walks for the given minutes and writes the soak-done line for tools/unity/soak.ps1.
    /// </summary>
    public sealed class LevelScreen : MonoBehaviour
    {
        public Level.Level Level { get; private set; }
        public LevelStreamer Streamer { get; private set; }
        public LevelLighting Lighting { get; private set; }
        public Character Hero { get; private set; }
        public HeroMover Mover { get; private set; }
        public FollowCamera Follow { get; private set; }
        public VirtualStick Stick { get; private set; }
        public Interactor Interactor { get; } = new();
        public SoakPilot Pilot { get; private set; }
        public bool AutoWalk { get; private set; }
        public int Seed { get; private set; } = 1;
        public int RoomTarget { get; private set; } = TestLevelGenerator.DefaultRooms;
        public float SoakMinutes { get; private set; }

        UIDocument document;
        VisualElement title, container;
        readonly List<VisualElement> hidden = new();
        readonly List<GameObject> hiddenObjects = new();
        Label roomLabel, statsLabel, promptLabel;
        Button cameraButton, autoButton;
        GameObject levelRoot;
        Camera cam;
        PerfOverlay overlay;
        Vector3 camPos; Quaternion camRot; float camFov; Color camBg; CameraClearFlags camClear; float camNear;
        AmbientMode ambientMode; Color ambientSky, ambientEquator, ambientGround, fogColor; bool fog; FogMode fogMode; float fogDensity;
        HeroSpec spec = new() { speciesId = "dwarf", classId = "warden", tier = "S" };
        float lastStats;
        bool soakReported;

        public static LevelScreen Open(UIDocument document, int seed = 1, int rooms = TestLevelGenerator.DefaultRooms, float soakMinutes = 0f, bool autoWalk = false, HeroSpec hero = null)
        {
            var existing = document.GetComponent<LevelScreen>();
            if (existing != null) return existing;
            var s = document.gameObject.AddComponent<LevelScreen>();
            s.document = document;
            s.Seed = seed; s.RoomTarget = Mathf.Clamp(rooms, 2, 400); s.SoakMinutes = soakMinutes;
            s.AutoWalk = autoWalk || soakMinutes > 0f;
            if (hero != null) s.spec = hero;
            s.Build();
            s.Start();
            return s;
        }

        void Build()
        {
            var tree = Resources.Load<VisualTreeAsset>("UI/Level");
            if (tree == null) throw new InvalidOperationException("missing Resources/UI/Level.uxml");
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
            var walk = container.Q("walk");
            var sheet = Resources.Load<StyleSheet>("UI/Walk");
            if (sheet != null && !walk.styleSheets.Contains(sheet)) walk.styleSheets.Add(sheet);
            roomLabel = walk.Q<Label>("room");
            statsLabel = walk.Q<Label>("stats");
            promptLabel = walk.Q<Label>("prompt");
            cameraButton = walk.Q<Button>("camera");
            autoButton = walk.Q<Button>("auto");
            walk.Q<Button>("back").clicked += Close;
            cameraButton.clicked += CycleCamera;
            autoButton.clicked += () => SetAutoWalk(!AutoWalk);
            walk.Q<Button>("a").clicked += () => Act();
            Stick = new VirtualStick(walk.Q("stickZone"), walk.Q("ring"), walk.Q("knob"));
            overlay = UnityEngine.Object.FindFirstObjectByType<PerfOverlay>();

            cam = Camera.main;
            camPos = cam.transform.position; camRot = cam.transform.rotation; camFov = cam.fieldOfView; camBg = cam.backgroundColor; camClear = cam.clearFlags; camNear = cam.nearClipPlane;
            ambientMode = RenderSettings.ambientMode; ambientSky = RenderSettings.ambientSkyColor; ambientEquator = RenderSettings.ambientEquatorColor; ambientGround = RenderSettings.ambientGroundColor;
            fog = RenderSettings.fog; fogMode = RenderSettings.fogMode; fogColor = RenderSettings.fogColor; fogDensity = RenderSettings.fogDensity;
            foreach (var name in new[] { "Hall", "Moonlight" })
            {
                var go = GameObject.Find(name);
                if (go != null) { hiddenObjects.Add(go); go.SetActive(false); }
            }
        }

        void Start()
        {
            if (Level != null) return;
            try
            {
                LevelBuilder.Preload();
                Level = TestLevelGenerator.Generate(Seed, RoomTarget);
                levelRoot = new GameObject("Level");
                var entry = Level.rooms[Level.entryId];
                Hero = HeroAssembler.Build(spec);
                Hero.root.transform.position = LevelBuilder.RoomCentre(entry);
                Hero.root.transform.rotation = Quaternion.Euler(0, 180f, 0);
                Mover = HeroMover.Attach(Hero);
                Follow = FollowCamera.Attach(cam, Hero.root.transform, Hero.height);
                Streamer = LevelStreamer.Attach(levelRoot, Level, levelRoot.transform, Hero.root.transform);
                Streamer.Prime();
                Lighting = new LevelLighting(levelRoot.transform, entry.kit);
                cam.clearFlags = CameraClearFlags.SolidColor;
                ColorUtility.TryParseHtmlString(KitLibrary.Load(entry.kit).manifest.look.fog, out var bg);
                cam.backgroundColor = bg;
                Pilot = new SoakPilot(Level, Streamer, Interactor, Hero.root.transform, SoakMinutes, Seed);
                roomLabel.text = $"Test level · seed {Seed} · {Level.rooms.Count} rooms";
                cameraButton.text = "Camera: " + Follow.Label;
                SetAutoWalk(AutoWalk);
                GvLog.Line("level", ("seed", Seed), ("rooms", Level.rooms.Count), ("halls", Level.Halls), ("cells", Level.FloorCells), ("joins", Level.joins.Count), ("hash", Level.Hash()), ("soakMinutes", SoakMinutes), ("targetFps", Boot.TargetFps), ("hz", Boot.RefreshHz));
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                roomLabel.text = "Test level";
                statsLabel.text = "✗ " + e.Message;
            }
        }

        public void SetAutoWalk(bool on)
        {
            AutoWalk = on;
            autoButton.text = "Auto walk: " + (on ? "on" : "off");
        }

        public void CycleCamera()
        {
            if (Follow == null) return;
            Follow.Cycle();
            cameraButton.text = "Camera: " + Follow.Label;
        }

        public bool Act() => Interactor.Act();

        /// <summary>Moves the hero (the tests, the shots): the controller is told, the streamer primed around the new spot.</summary>
        public void Teleport(Vector3 at)
        {
            if (Mover == null) return;
            Mover.controller.enabled = false;
            Hero.root.transform.position = at;
            Mover.controller.enabled = true;
            Streamer.Prime();
            var room = Streamer.HeroRoom;
            if (room != null) Lighting?.SetZone(room.kit);
        }

        void Update()
        {
            if (Mover == null || Hero == null || Level == null) return;
            var v = Stick.Value;
            var kb = Keyboard.current;
            if (kb != null && !Stick.Held)
            {
                var k = Vector2.zero;
                if (kb.wKey.isPressed || kb.upArrowKey.isPressed) k.y += 1;
                if (kb.sKey.isPressed || kb.downArrowKey.isPressed) k.y -= 1;
                if (kb.dKey.isPressed || kb.rightArrowKey.isPressed) k.x += 1;
                if (kb.aKey.isPressed || kb.leftArrowKey.isPressed) k.x -= 1;
                if (k != Vector2.zero) v = k.normalized * (kb.leftShiftKey.isPressed ? 1f : 0.5f);
                if (kb.eKey.wasPressedThisFrame) Act();
                if (kb.cKey.wasPressedThisFrame) CycleCamera();
            }
            float yaw = Follow != null ? Follow.Yaw : 0f;
            Interactor.Update(Hero.root.transform, Streamer.Doors);
            if (AutoWalk && v == Vector2.zero && !Stick.Held) v = Pilot.Tick(Time.deltaTime, yaw, overlay);
            else if (AutoWalk) Pilot.Tick(0f, yaw, overlay);
            Mover.stick = v;
            Mover.cameraYaw = yaw;
            promptLabel.text = Interactor.Nearest != null ? "A · " + Interactor.Prompt : "";
            promptLabel.style.visibility = Interactor.Nearest != null ? Visibility.Visible : Visibility.Hidden;
            var room = Streamer.HeroRoom;
            if (room != null) Lighting.SetZone(room.kit);
            Lighting.Tick(Time.deltaTime, Hero.root.transform.position + Vector3.up * 1.2f, Streamer.Built.Values);
            if (Pilot.Done && !soakReported)
            {
                soakReported = true;
                SetAutoWalk(false);
                roomLabel.text = $"Soak done · {Pilot.minutes:0} min · seed {Seed}";
            }
            if (Time.unscaledTime - lastStats > 0.25f)
            {
                lastStats = Time.unscaledTime;
                statsLabel.text = $"{Streamer.Built.Count} built · {Streamer.ActiveCount} lit · {Level.rooms.Count} rooms · {Pilot.Walked:0} m · {Mover.Clip} · {(room != null ? room.kit : "between")} · camera {Follow?.Label}";
            }
        }

        void Close()
        {
            Hero?.Destroy(); Hero = null; Mover = null;
            Streamer?.ReleaseAll();
            Lighting?.Destroy(); Lighting = null;
            if (levelRoot != null) Destroy(levelRoot);
            Level = null;
            if (Follow != null) Destroy(Follow);
            container?.RemoveFromHierarchy();
            foreach (var e in hidden) e.style.display = DisplayStyle.Flex;
            foreach (var go in hiddenObjects) if (go != null) go.SetActive(true);
            if (cam != null)
            {
                cam.transform.position = camPos; cam.transform.rotation = camRot; cam.fieldOfView = camFov; cam.backgroundColor = camBg; cam.clearFlags = camClear; cam.nearClipPlane = camNear;
            }
            RenderSettings.ambientMode = ambientMode; RenderSettings.ambientSkyColor = ambientSky; RenderSettings.ambientEquatorColor = ambientEquator; RenderSettings.ambientGroundColor = ambientGround;
            RenderSettings.fog = fog; RenderSettings.fogMode = fogMode; RenderSettings.fogColor = fogColor; RenderSettings.fogDensity = fogDensity;
            Destroy(this);
        }
    }
}

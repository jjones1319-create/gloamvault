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
    /// A level walked (Phase 14, D-163; Phase 15, D-165): the test level generated from a seed, or a floor laid out
    /// by hand — streamed around the hero, walked with Phase 13's stick, camera and A, or by the pilot (Auto walk),
    /// which is also the soak (the launch extra <c>gv=soak</c>). A floor adds the map that fills in, the levers, the
    /// key, the secret panels and the exits, and remembers what you found (<see cref="FloorState"/>).
    /// </summary>
    public sealed class LevelScreen : MonoBehaviour
    {
        public Level.Level Level { get; private set; }
        public Floor Floor { get; private set; }
        public FloorState State { get; private set; }
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
        public string FloorId { get; private set; }
        public IReadOnlyList<Lever> Levers => levers;
        public IReadOnlyList<ExitSpot> Exits => exits;
        public KeyPickup Key { get; private set; }
        public FloorMapElement Minimap { get; private set; }
        public FloorMapElement FullMap { get; private set; }
        public bool MapOpen => mapPanel != null && mapPanel.style.display == DisplayStyle.Flex;
        public string LastToast { get; private set; } = "";

        UIDocument document;
        VisualElement title, container, mapPanel, minimapBox;
        readonly List<VisualElement> hidden = new();
        readonly List<GameObject> hiddenObjects = new();
        Label roomLabel, statsLabel, promptLabel, toastLabel;
        Button cameraButton, autoButton, mapButton;
        GameObject levelRoot;
        Camera cam;
        PerfOverlay overlay;
        Vector3 camPos; Quaternion camRot; float camFov; Color camBg; CameraClearFlags camClear; float camNear;
        AmbientMode ambientMode; Color ambientSky, ambientEquator, ambientGround, fogColor; bool fog; FogMode fogMode; float fogDensity;
        HeroSpec spec = new() { speciesId = "dwarf", classId = "warden", tier = "S" };
        float lastStats, toastUntil, mapTimer;
        bool soakReported;
        readonly List<IInteractable> things = new();
        readonly List<Lever> levers = new();
        readonly List<ExitSpot> exits = new();
        readonly Dictionary<Door, int> doorJoin = new();
        readonly HashSet<Door> wired = new();

        public static LevelScreen Open(UIDocument document, int seed = 1, int rooms = TestLevelGenerator.DefaultRooms, float soakMinutes = 0f, bool autoWalk = false, HeroSpec hero = null, string floorId = null)
        {
            var existing = document.GetComponent<LevelScreen>();
            if (existing != null) return existing;
            var s = document.gameObject.AddComponent<LevelScreen>();
            s.document = document;
            s.Seed = seed; s.RoomTarget = Mathf.Clamp(rooms, 2, 400); s.SoakMinutes = soakMinutes; s.FloorId = floorId;
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
            toastLabel = walk.Q<Label>("toast");
            cameraButton = walk.Q<Button>("camera");
            autoButton = walk.Q<Button>("auto");
            mapButton = walk.Q<Button>("map");
            mapPanel = walk.Q("mapPanel");
            minimapBox = walk.Q("minimap");
            walk.Q<Button>("back").clicked += Close;
            cameraButton.clicked += CycleCamera;
            autoButton.clicked += () => SetAutoWalk(!AutoWalk);
            walk.Q<Button>("a").clicked += () => Act();
            if (mapButton != null) mapButton.clicked += () => ShowMap(!MapOpen);
            var close = walk.Q<Button>("mapClose");
            if (close != null) close.clicked += () => ShowMap(false);
            if (mapPanel != null) mapPanel.style.display = DisplayStyle.None;
            if (minimapBox != null) minimapBox.style.display = DisplayStyle.None;
            if (mapButton != null) mapButton.style.display = DisplayStyle.None;
            if (toastLabel != null) toastLabel.style.visibility = Visibility.Hidden;
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
                if (FloorId != null)
                {
                    Floor = FloorLayout.Load(FloorId);
                    Level = Floor.level;
                    State = FloorState.Load(FloorId);
                }
                else Level = TestLevelGenerator.Generate(Seed, RoomTarget);
                levelRoot = new GameObject("Level");
                var entry = Level.rooms[Level.entryId];
                Hero = HeroAssembler.Build(spec);
                Hero.root.transform.position = LevelBuilder.RoomCentre(entry);
                Hero.root.transform.rotation = Quaternion.Euler(0, 180f, 0);
                Mover = HeroMover.Attach(Hero);
                Follow = FollowCamera.Attach(cam, Hero.root.transform, Hero.height);
                Streamer = LevelStreamer.Attach(levelRoot, Level, levelRoot.transform, Hero.root.transform);
                Streamer.BuiltSetChanged += OnBuiltChanged;
                Streamer.Prime();
                Lighting = new LevelLighting(levelRoot.transform, entry.kit);
                cam.clearFlags = CameraClearFlags.SolidColor;
                ColorUtility.TryParseHtmlString(KitLibrary.Load(entry.kit).manifest.look.fog, out var bg);
                cam.backgroundColor = bg;
                Pilot = new SoakPilot(Level, Streamer, Interactor, Hero.root.transform, SoakMinutes, Seed);
                if (Floor != null) PlaceFloorThings();
                OnBuiltChanged();
                roomLabel.text = Floor != null ? $"Floor {Floor.def.floor} · {Level.rooms.Count} rooms" : $"Test level · seed {Seed}";
                cameraButton.text = "Camera: " + Follow.Label;
                SetAutoWalk(AutoWalk);
                GvLog.Line("level", ("floor", FloorId ?? ""), ("seed", Seed), ("rooms", Level.rooms.Count), ("halls", Level.Halls), ("cells", Level.FloorCells), ("joins", Level.joins.Count), ("hash", Level.Hash()), ("soakMinutes", SoakMinutes), ("targetFps", Boot.TargetFps), ("hz", Boot.RefreshHz));
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                roomLabel.text = FloorId ?? "Test level";
                statsLabel.text = "✗ " + e.Message;
            }
        }

        // ---- the floor's things (Phase 15) ----

        void PlaceFloorThings()
        {
            var def = Floor.def;
            foreach (var l in def.levers)
            {
                var room = Level.rooms[l.room];
                var lever = Lever.Place(levelRoot.transform, LevelBuilder.ToUnity(room.CentreX + l.x, 0f, room.CentreZ + l.z), l.id, l.opens, State.leversPulled.Contains(l.id));
                lever.OnPulled += OnLeverPulled;
                levers.Add(lever);
            }
            foreach (var s in def.spots)
            {
                if (s.kind != "key" || State.keyTaken) continue;
                var room = Level.rooms[s.room];
                Key = KeyPickup.Place(levelRoot.transform, LevelBuilder.ToUnity(room.CentreX + s.x, 0f, room.CentreZ + s.z));
                Key.OnTaken += _ => { State.keysHeld++; State.keyTaken = true; State.Save(); Toast("You take an iron key."); Key = null; RebuildThings(); };
            }
            foreach (var e in def.exits)
            {
                var room = Level.rooms[e.room];
                Vector3 at;
                if (e.kind == "stairs" || string.IsNullOrEmpty(e.side)) at = LevelBuilder.RoomCentre(room);
                else
                {
                    var t = Level.TemplateOf(room);
                    int offset = 0;
                    foreach (var d in t.doors) if (d.side == e.side) { offset = d.offset; break; }
                    float cell = RoomLayout.Cell, inset = 0.9f;
                    float x, z;
                    switch (e.side)
                    {
                        case "north": x = (room.gx + offset + 0.5f) * cell; z = room.gy * cell + inset; break;
                        case "south": x = (room.gx + offset + 0.5f) * cell; z = (room.gy + room.h) * cell - inset; break;
                        case "east": x = (room.gx + room.w) * cell - inset; z = (room.gy + offset + 0.5f) * cell; break;
                        default: x = room.gx * cell + inset; z = (room.gy + offset + 0.5f) * cell; break;
                    }
                    at = LevelBuilder.ToUnity(x, 0f, z);
                }
                var spot = ExitSpot.Place(levelRoot.transform, at, e, State.exitsFound.Contains(e.id));
                spot.OnUsed += OnExitUsed;
                exits.Add(spot);
            }
            // The map, in the corner and in full.
            Minimap = new FloorMapElement { floor = Floor, state = State, full = false };
            Minimap.style.flexGrow = 1;
            if (minimapBox != null) { minimapBox.Add(Minimap); minimapBox.style.display = DisplayStyle.Flex; }
            FullMap = new FloorMapElement { floor = Floor, state = State, full = true };
            FullMap.style.flexGrow = 1;
            var fullBox = container.Q("fullMap");
            if (fullBox != null) fullBox.Add(FullMap);
            if (mapButton != null) mapButton.style.display = DisplayStyle.Flex;
        }

        /// <summary>Every built door gets the floor's word: a secret panel hidden until found, a lever gate or a locked door shut until opened.</summary>
        void OnBuiltChanged()
        {
            foreach (var kv in Streamer.Built)
            {
                var lr = Level.rooms[kv.Key];
                foreach (var door in kv.Value.doors)
                {
                    if (door == null) continue;
                    var tag = door.GetComponent<RoomPiece>();
                    if (tag == null || !lr.joinBySide.TryGetValue(tag.side, out int ji)) continue;
                    doorJoin[door] = ji;
                    if (Floor == null) continue;
                    if (Floor.secretJoins.Contains(ji))
                    {
                        door.hidden = !State.secretsFound.Contains(ji);
                        if (!door.hidden && !door.IsOpen) door.Open();
                        if (wired.Add(door)) door.OnFound += OnSecretFound;
                    }
                    else if (Floor.leverJoins.Contains(ji)) { door.locked = !LeverPulled(ji); if (!door.locked && !door.IsOpen) door.Open(); }
                    else if (Floor.lockedJoins.Contains(ji)) { door.locked = !State.joinsUnlocked.Contains(ji); if (!door.locked && !door.IsOpen) door.Open(); }
                }
            }
            RebuildThings();
        }

        void RebuildThings()
        {
            things.Clear();
            things.AddRange(Streamer.Doors);
            things.AddRange(levers);
            if (Key != null && !Key.Taken) things.Add(Key);
            things.AddRange(exits);
        }

        bool LeverPulled(int joinIndex)
        {
            foreach (var l in Floor.def.levers) if (l.opens == joinIndex && State.leversPulled.Contains(l.id)) return true;
            return false;
        }

        void OnLeverPulled(Lever lever)
        {
            State.leversPulled.Add(lever.id);
            foreach (var kv in doorJoin) if (kv.Value == lever.opensJoin && kv.Key != null) { kv.Key.locked = false; kv.Key.Open(); }
            State.Save();
            Toast("Somewhere near, a gate grinds up.");
            RedrawMaps();
        }

        void OnSecretFound(Door door)
        {
            if (doorJoin.TryGetValue(door, out int ji)) State.secretsFound.Add(ji);
            State.Save();
            Toast("A panel slides aside.");
            RedrawMaps();
        }

        void OnExitUsed(ExitSpot spot)
        {
            State.exitsFound.Add(spot.def.id);
            State.Save();
            Toast(spot.def.kind == "entrance" ? "The way out. Leaving the keep arrives with the delve's rules (Phase 21)." :
                  spot.def.kind == "stairs" ? "The stair down. Floor 2 arrives with the floors after this one (Phase 26)." :
                  $"{spot.def.name} — found. From now on it is a way out too.");
            RedrawMaps();
        }

        public void Toast(string text)
        {
            LastToast = text;
            if (toastLabel == null) return;
            toastLabel.text = text;
            toastLabel.style.visibility = Visibility.Visible;
            toastUntil = Time.unscaledTime + 3.5f;
        }

        public void ShowMap(bool open)
        {
            if (mapPanel == null) return;
            mapPanel.style.display = open ? DisplayStyle.Flex : DisplayStyle.None;
            if (mapButton != null) mapButton.text = open ? "Close map" : "Map";
            if (open) RedrawMaps();
        }

        void RedrawMaps()
        {
            if (Floor == null || Hero == null) return;
            var (gx, gz) = LevelBuilder.ToGame(Hero.root.transform.position);
            var fwd = Hero.root.transform.forward;
            var (fx, fz) = LevelBuilder.ToGame(fwd);
            float heading = Mathf.Atan2(fx, fz) * Mathf.Rad2Deg;
            var room = Streamer.HeroRoom;
            foreach (var m in new[] { Minimap, FullMap })
            {
                if (m == null) continue;
                m.heroGame = new Vector2(gx, gz);
                m.heroHeadingDeg = heading;
                m.currentRoom = room?.id ?? -1;
                m.Redraw();
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

        /// <summary>A: the key on a locked door of the floor, else whatever is nearest.</summary>
        public bool Act()
        {
            if (Floor != null && Interactor.Nearest is Door d && d.locked && !d.hidden && doorJoin.TryGetValue(d, out int ji) && Floor.lockedJoins.Contains(ji))
            {
                if (State.keysHeld <= 0) { Toast("Locked. The key is somewhere on this floor."); return false; }
                State.keysHeld--;
                State.joinsUnlocked.Add(ji);
                d.locked = false;
                d.Open();
                State.Save();
                Toast("The key turns.");
                RedrawMaps();
                return true;
            }
            return Interactor.Act();
        }

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

        /// <summary>Turns the hero to face a point (the tests, the shots).</summary>
        public void Face(Vector3 at)
        {
            if (Hero == null) return;
            var to = at - Hero.root.transform.position; to.y = 0;
            if (to.sqrMagnitude > 1e-4f) Hero.root.transform.rotation = Quaternion.LookRotation(to.normalized, Vector3.up);
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
                if (kb.mKey.wasPressedThisFrame) ShowMap(!MapOpen);
            }
            float yaw = Follow != null ? Follow.Yaw : 0f;
            Interactor.Update(Hero.root.transform, things);
            if (AutoWalk && v == Vector2.zero && !Stick.Held) v = Pilot.Tick(Time.deltaTime, yaw, overlay);
            else if (AutoWalk) Pilot.Tick(0f, yaw, overlay);
            Mover.stick = MapOpen ? Vector2.zero : v;
            Mover.cameraYaw = yaw;
            promptLabel.text = Interactor.Nearest != null ? "A · " + Interactor.Prompt : "";
            promptLabel.style.visibility = Interactor.Nearest != null ? Visibility.Visible : Visibility.Hidden;
            var room = Streamer.HeroRoom;
            if (room != null) Lighting.SetZone(room.kit);
            Lighting.Tick(Time.deltaTime, Hero.root.transform.position + Vector3.up * 1.2f, Streamer.Built.Values);
            if (Floor != null)
            {
                if (room != null && State.visited.Add(room.id)) { State.Save(); RedrawMaps(); }
                mapTimer += Time.unscaledDeltaTime;
                if (mapTimer > 0.2f) { mapTimer = 0f; RedrawMaps(); }
                if (toastLabel != null && toastUntil > 0f && Time.unscaledTime > toastUntil) { toastUntil = 0f; toastLabel.style.visibility = Visibility.Hidden; }
            }
            if (Pilot.Done && !soakReported)
            {
                soakReported = true;
                SetAutoWalk(false);
                roomLabel.text = $"Soak done · {Pilot.minutes:0} min · seed {Seed}";
            }
            if (Time.unscaledTime - lastStats > 0.25f)
            {
                lastStats = Time.unscaledTime;
                string where = room == null ? "between rooms" : Floor != null ? Floor.NameOf(room.id) : room.kit;
                string keys = Floor != null && State.keysHeld > 0 ? $" · key ×{State.keysHeld}" : "";
                statsLabel.text = $"{Streamer.Built.Count} built · {Streamer.ActiveCount} lit · {Level.rooms.Count} rooms · {Pilot.Walked:0} m · {Mover.Clip} · {where}{keys} · camera {Follow?.Label}";
            }
        }

        void Close()
        {
            State?.Save();
            Hero?.Destroy(); Hero = null; Mover = null;
            Streamer?.ReleaseAll();
            Lighting?.Destroy(); Lighting = null;
            if (levelRoot != null) Destroy(levelRoot);
            Level = null; Floor = null;
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

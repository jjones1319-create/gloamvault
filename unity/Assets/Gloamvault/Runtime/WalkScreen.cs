using System;
using System.Collections.Generic;
using Gloamvault.Characters;
using Gloamvault.Env;
using Gloamvault.Walk;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using UnityEngine.UIElements;

namespace Gloamvault
{
    /// <summary>
    /// The Walk screen (Phase 13): a built room, your hero in it, the stick to walk, A to open the door you face,
    /// the follow camera with its three distances (D-159). Only the controlled hero is shown (D-144). The keyboard
    /// works too (WASD, E, C) for the Editor's tests and shots. The rules' walking commands join in Phase 17.
    /// </summary>
    public sealed class WalkScreen : MonoBehaviour
    {
        public Room Room { get; private set; }
        public Character Hero { get; private set; }
        public HeroMover Mover { get; private set; }
        public FollowCamera Follow { get; private set; }
        public VirtualStick Stick { get; private set; }
        public Interactor Interactor { get; } = new();
        public RoomLighting Lighting { get; private set; }
        public int Index { get; private set; }
        public IReadOnlyList<Template> Templates => templates;

        UIDocument document;
        VisualElement title, container;
        readonly List<VisualElement> hidden = new();
        readonly List<GameObject> hiddenObjects = new();
        Label roomLabel, statsLabel, promptLabel;
        Button cameraButton;
        Template[] templates;
        Camera cam;
        Vector3 camPos; Quaternion camRot; float camFov; Color camBg; CameraClearFlags camClear; float camNear;
        AmbientMode ambientMode; Color ambientSky, ambientEquator, ambientGround, fogColor; bool fog; FogMode fogMode; float fogDensity;
        HeroSpec spec = new() { speciesId = "dwarf", classId = "warden", tier = "S" };
        float lastStats;

        public static WalkScreen Open(UIDocument document, string templateId = null, HeroSpec hero = null)
        {
            var existing = document.GetComponent<WalkScreen>();
            if (existing != null) { if (templateId != null) existing.ShowById(templateId); return existing; }
            var s = document.gameObject.AddComponent<WalkScreen>();
            s.document = document;
            if (hero != null) s.spec = hero;
            s.Build();
            s.ShowById(templateId);
            return s;
        }

        /// <summary>The door kind each zone shows in the viewer: a door with a leaf that opens (Phase 15 passes the floor's).</summary>
        public static Dictionary<string, string> DoorKindsFor(string kit)
        {
            string kind = kit == "crypts" ? "gate" : kit == "vault" ? "locked" : "wood";
            return new Dictionary<string, string> { ["north"] = kind, ["east"] = kind, ["south"] = kind, ["west"] = kind };
        }

        void Build()
        {
            templates = TemplateFile.Load().templates;
            var tree = Resources.Load<VisualTreeAsset>("UI/Walk");
            if (tree == null) throw new InvalidOperationException("missing Resources/UI/Walk.uxml");
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
            walk.Q<Button>("prev").clicked += () => Show((Index + templates.Length - 1) % templates.Length);
            walk.Q<Button>("next").clicked += () => Show((Index + 1) % templates.Length);
            walk.Q<Button>("back").clicked += Close;
            cameraButton.clicked += CycleCamera;
            walk.Q<Button>("a").clicked += () => Act();
            Stick = new VirtualStick(walk.Q("stickZone"), walk.Q("ring"), walk.Q("knob"));

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

        public void ShowById(string id)
        {
            int i = 0;
            if (id != null) for (int k = 0; k < templates.Length; k++) if (templates[k].id == id) { i = k; break; }
            Show(i);
        }

        public void Show(int index)
        {
            Index = index;
            var t = templates[index];
            Hero?.Destroy(); Hero = null; Mover = null;
            Room?.Destroy(); Room = null; Lighting = null;
            try
            {
                // A whole room (no side cut away): the follow camera goes everywhere.
                Room = RoomBuilder.Build(t, 0, null, DoorKindsFor(t.kit), colliders: true, cutAway: false);
                foreach (var d in Room.doors) d.locked = false;
                Hero = HeroAssembler.Build(spec);
                Hero.root.transform.position = Vector3.zero;
                Hero.root.transform.rotation = Quaternion.Euler(0, 180f, 0);
                Mover = HeroMover.Attach(Hero);
                Follow = FollowCamera.Attach(cam, Hero.root.transform, Hero.height);
                cam.clearFlags = CameraClearFlags.SolidColor;
                ColorUtility.TryParseHtmlString(Room.kit.manifest.look.fog, out var bg);
                cam.backgroundColor = bg;
                Lighting = new RoomLighting(Room, Vector3.zero, cam, 100);
                roomLabel.text = $"{index + 1}/{templates.Length} · {t.id}";
                cameraButton.text = "Camera: " + Follow.Label;
                GvLog.Line("walk", ("room", t.id), ("doors", Room.doors.Count), ("pieces", Room.pieces), ("hero", Hero.label));
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                roomLabel.text = t.id;
                statsLabel.text = "✗ " + e.Message;
            }
        }

        public void CycleCamera()
        {
            if (Follow == null) return;
            Follow.Cycle();
            cameraButton.text = "Camera: " + Follow.Label;
        }

        public bool Act() => Interactor.Act();

        void Update()
        {
            if (Mover == null || Hero == null) return;
            var v = Stick.Value;
            // The keyboard, for the Editor: WASD or the arrows walk, E acts, C cycles the camera.
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
            Mover.stick = v;
            Mover.cameraYaw = Follow != null ? Follow.Yaw : 0f;
            Interactor.Update(Hero.root.transform, Room.doors);
            promptLabel.text = Interactor.Nearest != null ? "A · " + Interactor.Prompt : "";
            promptLabel.style.visibility = Interactor.Nearest != null ? Visibility.Visible : Visibility.Hidden;
            if (Time.unscaledTime - lastStats > 0.25f)
            {
                lastStats = Time.unscaledTime;
                var p = Hero.root.transform.position;
                statsLabel.text = $"{Mover.Clip} · {Mover.Speed:0.0} m/s · at {p.x:0.0}, {p.z:0.0} · camera {Follow?.Label}";
            }
            Lighting?.Tick(Time.deltaTime);
        }

        void Close()
        {
            Hero?.Destroy(); Hero = null; Mover = null;
            Room?.Destroy(); Room = null; Lighting = null;
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

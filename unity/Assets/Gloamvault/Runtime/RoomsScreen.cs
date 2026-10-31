using System;
using System.Collections.Generic;
using Gloamvault.Env;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.UIElements;

namespace Gloamvault
{
    /// <summary>
    /// The Rooms viewer (Phase 11): the thirty templates built from the kits, one at a time — ◀ ▶ step through them
    /// by zone, a light slider plays the light meter (the room darkens and the fog closes in), Back returns to the title.
    /// The title's own hall and moonlight are hidden while a room shows, and the render settings they used come back.
    /// </summary>
    public sealed class RoomsScreen : MonoBehaviour
    {
        public Room Current { get; private set; }
        public RoomLighting Lighting { get; private set; }
        public int Index { get; private set; }
        public int Light { get; private set; } = 100;
        public IReadOnlyList<Template> Templates => templates;

        UIDocument document;
        VisualElement title, container;
        readonly List<VisualElement> hidden = new();
        readonly List<GameObject> hiddenObjects = new();
        Label nameLabel, zoneLabel, statsLabel, lightLabel;
        Slider slider;
        Template[] templates;
        Camera cam;
        Vector3 camPos; Quaternion camRot; float camFov; Color camBg; CameraClearFlags camClear;
        AmbientMode ambientMode; Color ambientSky, ambientEquator, ambientGround, fogColor; bool fog; FogMode fogMode; float fogDensity;

        public static RoomsScreen Open(UIDocument document, string templateId = null)
        {
            var existing = document.GetComponent<RoomsScreen>();
            if (existing != null) { if (templateId != null) existing.ShowById(templateId); return existing; }
            var s = document.gameObject.AddComponent<RoomsScreen>();
            s.document = document;
            s.Build();
            s.ShowById(templateId);
            return s;
        }

        void Build()
        {
            templates = TemplateFile.Load().templates;
            var tree = Resources.Load<VisualTreeAsset>("UI/Rooms");
            if (tree == null) throw new InvalidOperationException("missing Resources/UI/Rooms.uxml");
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
            var rooms = container.Q("rooms");
            var sheet = Resources.Load<StyleSheet>("UI/Rooms");
            if (sheet != null && !rooms.styleSheets.Contains(sheet)) rooms.styleSheets.Add(sheet);
            nameLabel = rooms.Q<Label>("name");
            zoneLabel = rooms.Q<Label>("zone");
            statsLabel = rooms.Q<Label>("stats");
            lightLabel = rooms.Q<Label>("lightLabel");
            slider = rooms.Q<Slider>("light");
            slider.RegisterValueChangedCallback(e => SetLight(Mathf.RoundToInt(e.newValue)));
            rooms.Q<Button>("prev").clicked += () => Show((Index + templates.Length - 1) % templates.Length);
            rooms.Q<Button>("next").clicked += () => Show((Index + 1) % templates.Length);
            rooms.Q<Button>("back").clicked += Close;

            // The title's hall and moonlight step aside; what they set comes back on Close.
            cam = Camera.main;
            camPos = cam.transform.position; camRot = cam.transform.rotation; camFov = cam.fieldOfView; camBg = cam.backgroundColor; camClear = cam.clearFlags;
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
            Current?.Destroy();
            Current = null;
            Lighting = null;
            try
            {
                Current = RoomBuilder.Build(t, 0);
                var axes = Current.kit.axes;
                ColorUtility.TryParseHtmlString(Current.kit.manifest.look.fog, out var bg);
                RoomCamera.Apply(cam, t, axes, bg);
                Lighting = new RoomLighting(Current, RoomCamera.Focus(t, axes), cam, Light);
                nameLabel.text = $"{index + 1}/{templates.Length} · {t.id}";
                zoneLabel.text = $"{t.zoneId} · {t.w}×{t.h} cells · {t.doors.Length} doors";
                statsLabel.text = $"{Current.pieces} pieces · {PerfMath.Short(Current.triangles)} tris (budget {PerfMath.Short(t.triBudget)}) · {Current.flames.Count} flames · {Lighting.lights.Count} lights"
                                  + (Current.missing.Count > 0 ? " · missing: " + string.Join(", ", Current.missing) : "");
                GvLog.Line("room", ("id", t.id), ("kit", t.kit), ("pieces", Current.pieces), ("tris", Current.triangles), ("flames", Current.flames.Count), ("missing", string.Join(",", Current.missing)), ("axes", $"{axes.sx},{axes.sz}"));
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                nameLabel.text = t.id;
                statsLabel.text = "✗ " + e.Message;
            }
        }

        public void SetLight(int light)
        {
            Light = Mathf.Clamp(light, 0, 100);
            lightLabel.text = "Light " + Light;
            if (slider != null && Mathf.RoundToInt(slider.value) != Light) slider.SetValueWithoutNotify(Light);
            Lighting?.SetLight(Light);
        }

        void Update() => Lighting?.Tick(Time.deltaTime);

        void Close()
        {
            Current?.Destroy();
            Current = null;
            Lighting = null;
            container?.RemoveFromHierarchy();
            foreach (var e in hidden) e.style.display = DisplayStyle.Flex;
            foreach (var go in hiddenObjects) if (go != null) go.SetActive(true);
            if (cam != null)
            {
                cam.transform.position = camPos; cam.transform.rotation = camRot; cam.fieldOfView = camFov; cam.backgroundColor = camBg; cam.clearFlags = camClear;
            }
            RenderSettings.ambientMode = ambientMode; RenderSettings.ambientSkyColor = ambientSky; RenderSettings.ambientEquatorColor = ambientEquator; RenderSettings.ambientGroundColor = ambientGround;
            RenderSettings.fog = fog; RenderSettings.fogMode = fogMode; RenderSettings.fogColor = fogColor; RenderSettings.fogDensity = fogDensity;
            Destroy(this);
        }
    }
}

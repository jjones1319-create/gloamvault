using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;
using UnityEngine.UIElements;

namespace Gloamvault.EditorTools
{
    /// <summary>
    /// <c>npm run unity:setup</c> (batchmode, <c>-executeMethod Gloamvault.EditorTools.ProjectSetup.Run</c>): the
    /// player settings (D-140), the mobile URP asset, the UI panel and the Boot scene. Everything here is re-runnable —
    /// the project is rebuilt from this script, never edited by hand in the editor (James never opens it).
    /// </summary>
    public static class ProjectSetup
    {
        public const string Root = "Assets/Gloamvault";
        public const string SettingsDir = Root + "/Settings";
        public const string UiDir = Root + "/UI";
        public const string BootScene = Root + "/Scenes/Boot.unity";
        public const string PackageId = "com.gloamvault.game";
        /// <summary>The app's version: 0.&lt;phase&gt;.&lt;fix&gt;; the version code must rise with every build James installs.</summary>
        public const string Version = "0.11.0";
        public const int VersionCode = 11;

        public static void Run()
        {
            try
            {
                Player();
                Pipeline();
                var panel = Ui();
                Scene(panel);
                AssetDatabase.SaveAssets();
                Log("done");
            }
            catch (Exception e)
            {
                Debug.LogError("[gv-setup] FAILED " + e);
                EditorApplication.Exit(1);
            }
        }

        static void Log(string message) => Debug.Log("[gv-setup] " + message);

        // ---------------------------------------------------------------- player settings

        static void Player()
        {
            EditorSettings.serializationMode = SerializationMode.ForceText;
            PlayerSettings.companyName = "Gloamvault";
            PlayerSettings.productName = "Gloamvault";
            PlayerSettings.bundleVersion = Version;
            PlayerSettings.Android.bundleVersionCode = VersionCode;
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, PackageId);
            PlayerSettings.colorSpace = ColorSpace.Linear;

            // Landscape only (D-003): either way round, never portrait.
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.AutoRotation;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;

            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel29;
            // API 36: Google Play's rule for new apps from 31 Aug 2026 (02-RESEARCH §2.6); the SDK also carries 37.
            PlayerSettings.Android.targetSdkVersion = (AndroidSdkVersions)36;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { GraphicsDeviceType.Vulkan, GraphicsDeviceType.OpenGLES3 });
            PlayerSettings.Android.androidIsGame = true;
            PlayerSettings.Android.startInFullscreen = true;
            PlayerSettings.Android.renderOutsideSafeArea = true;
            PlayerSettings.Android.optimizedFramePacing = true;
            PlayerSettings.enableFrameTimingStats = true;

            PlayerSettings.SplashScreen.show = false;
            PlayerSettings.SplashScreen.showUnityLogo = false;

            var icon = AssetDatabase.LoadAssetAtPath<Texture2D>(Root + "/Art/Icon/icon-512.png");
            if (icon != null) PlayerSettings.SetIcons(NamedBuildTarget.Unknown, new[] { icon }, IconKind.Any);
            else Log("no icon at Art/Icon/icon-512.png (tools/unity/setup.ps1 copies it)");

            // The Input System only (0 = the old Input Manager, 1 = the Input System, 2 = both — unsupported on Android).
            var playerSettings = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset").FirstOrDefault();
            if (playerSettings != null)
            {
                var so = new SerializedObject(playerSettings);
                var input = so.FindProperty("activeInputHandler");
                if (input != null) { input.intValue = 1; so.ApplyModifiedPropertiesWithoutUndo(); }
            }
            Log($"player: {PackageId} {Version} ({VersionCode}), IL2CPP ARM64, Vulkan+GLES3, landscape");
        }

        // ---------------------------------------------------------------- render pipeline

        static void Pipeline()
        {
            Directory.CreateDirectory(SettingsDir);
            string rendererPath = SettingsDir + "/URP-Mobile_Renderer.asset";
            string assetPath = SettingsDir + "/URP-Mobile.asset";

            var renderer = AssetDatabase.LoadAssetAtPath<UniversalRendererData>(rendererPath);
            if (renderer == null)
            {
                renderer = ScriptableObject.CreateInstance<UniversalRendererData>();
                AssetDatabase.CreateAsset(renderer, rendererPath);
            }
            var urp = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(assetPath);
            if (urp == null)
            {
                urp = UniversalRenderPipelineAsset.Create(renderer);
                AssetDatabase.CreateAsset(urp, assetPath);
            }

            // Starting points for the phone; Phase 14 sets them from measurements (10 §4).
            var so = new SerializedObject(urp);
            Set(so, "m_RenderScale", 1f);
            Set(so, "m_MSAA", 4);
            Set(so, "m_SupportsHDR", false);
            Set(so, "m_MainLightShadowsSupported", true);
            Set(so, "m_MainLightShadowmapResolution", 1024);
            Set(so, "m_AdditionalLightsRenderingMode", 1); // per pixel
            Set(so, "m_AdditionalLightsPerObjectLimit", 4);
            Set(so, "m_AdditionalLightShadowsSupported", true);
            Set(so, "m_AdditionalLightsShadowmapResolution", 1024);
            Set(so, "m_ShadowDistance", 25f);
            Set(so, "m_SoftShadowsSupported", true);
            so.ApplyModifiedPropertiesWithoutUndo();
            EditorUtility.SetDirty(urp);

            GraphicsSettings.defaultRenderPipeline = urp;
            int current = QualitySettings.GetQualityLevel();
            for (int i = 0; i < QualitySettings.names.Length; i++)
            {
                QualitySettings.SetQualityLevel(i, false);
                QualitySettings.renderPipeline = urp;
            }
            QualitySettings.SetQualityLevel(current, false);
            Log("pipeline: URP mobile asset assigned to every quality level");
        }

        static void Set(SerializedObject so, string name, object value)
        {
            var p = so.FindProperty(name);
            if (p == null) { Log($"URP setting {name} not found (skipped)"); return; }
            switch (value)
            {
                // intValue sets an enum by its value (MSAA 4, shadow map 1024), not by its position in the list.
                case int i: p.intValue = i; break;
                case float f: p.floatValue = f; break;
                case bool b: p.boolValue = b; break;
            }
        }

        // ---------------------------------------------------------------- UI panel

        static PanelSettings Ui()
        {
            string panelPath = UiDir + "/PanelSettings.asset";
            var panel = AssetDatabase.LoadAssetAtPath<PanelSettings>(panelPath);
            if (panel == null)
            {
                panel = ScriptableObject.CreateInstance<PanelSettings>();
                AssetDatabase.CreateAsset(panel, panelPath);
            }
            panel.themeStyleSheet = AssetDatabase.LoadAssetAtPath<ThemeStyleSheet>(UiDir + "/GloamTheme.tss");
            // The web's CSS px carry over 1:1: the reference is the phone's landscape viewport, matched on height.
            panel.scaleMode = PanelScaleMode.ScaleWithScreenSize;
            panel.referenceResolution = new Vector2Int(892, 412);
            panel.screenMatchMode = PanelScreenMatchMode.MatchWidthOrHeight;
            panel.match = 1f;
            panel.clearColor = false;
            EditorUtility.SetDirty(panel);
            Log("ui: PanelSettings at 892×412, matched on height");
            return panel;
        }

        // ---------------------------------------------------------------- the Boot scene (title)

        static void Scene(PanelSettings panel)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(BootScene)!);
            Directory.CreateDirectory(SettingsDir + "/Materials");
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var cameraGo = new GameObject("Main Camera") { tag = "MainCamera" };
            var camera = cameraGo.AddComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = Hex("#120f14");
            camera.fieldOfView = 50f;
            camera.nearClipPlane = 0.1f;
            camera.farClipPlane = 60f;
            cameraGo.AddComponent<UniversalAdditionalCameraData>();
            cameraGo.AddComponent<AudioListener>();
            cameraGo.transform.position = new Vector3(0.4f, 2.1f, -5.2f);
            cameraGo.transform.LookAt(new Vector3(0.4f, 2.3f, 4f));

            RenderSettings.skybox = null;
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = Hex("#1c1520");
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogDensity = 0.055f;
            RenderSettings.fogColor = Hex("#120f14");

            var moon = new GameObject("Moonlight").AddComponent<Light>();
            moon.type = LightType.Directional;
            moon.color = Hex("#7a74b0");
            moon.intensity = 0.12f;
            moon.shadows = LightShadows.None;
            moon.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

            var stone = Lit("Stone", "#4a3d36", 0.12f);
            var floorStone = Lit("FloorStone", "#2a2220", 0.2f);
            var iron = Lit("Iron", "#2b2a2e", 0.45f);
            var flame = Unlit("Flame", "#ffc46b");

            var set = new GameObject("Hall").transform;
            Block("Floor", set, new Vector3(0f, -0.05f, 4f), new Vector3(30f, 0.1f, 22f), floorStone);
            Block("Back wall", set, new Vector3(0f, 4f, 10f), new Vector3(30f, 8f, 0.6f), stone);
            var pillars = new[]
            {
                new Vector3(-3.6f, 0, 2.4f), new Vector3(-1.2f, 0, 6.2f), new Vector3(3.4f, 0, 3.2f),
                new Vector3(6.2f, 0, 6.6f), new Vector3(-6.4f, 0, 7.0f),
            };
            foreach (var p in pillars)
            {
                Block("Pillar", set, p + new Vector3(0, 3.5f, 0), new Vector3(1.0f, 7f, 1.0f), stone);
                Block("Pillar base", set, p + new Vector3(0, 0.2f, 0), new Vector3(1.4f, 0.4f, 1.4f), stone);
            }
            Torch(set, pillars[0] + new Vector3(0.0f, 2.3f, -0.62f), iron, flame, 4.2f, 1f, true);
            Torch(set, pillars[2] + new Vector3(0.0f, 2.5f, -0.62f), iron, flame, 3.6f, 2f, false);

            var ui = new GameObject("UI");
            var doc = ui.AddComponent<UIDocument>();
            doc.panelSettings = panel;
            doc.visualTreeAsset = AssetDatabase.LoadAssetAtPath<VisualTreeAsset>(UiDir + "/Title.uxml");
            var overlay = ui.AddComponent<PerfOverlay>();
            overlay.document = doc;
            var title = ui.AddComponent<TitleScreen>();
            title.document = doc;
            title.overlay = overlay;
            new GameObject("Boot").AddComponent<Boot>();

            EditorSceneManager.SaveScene(scene, BootScene);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(BootScene, true) };
            Log("scene: " + BootScene);
        }

        static void Torch(Transform parent, Vector3 at, Material iron, Material flame, float intensity, float seed, bool shadows)
        {
            var torch = new GameObject("Torch").transform;
            torch.SetParent(parent, false);
            torch.position = at;
            Block("Bracket", torch, at + new Vector3(0, -0.22f, 0.08f), new Vector3(0.12f, 0.36f, 0.12f), iron);
            var f = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            f.name = "Flame";
            UnityEngine.Object.DestroyImmediate(f.GetComponent<Collider>());
            f.transform.SetParent(torch, false);
            f.transform.position = at + new Vector3(0, 0.05f, 0);
            f.transform.localScale = new Vector3(0.16f, 0.28f, 0.16f);
            var r = f.GetComponent<Renderer>();
            r.sharedMaterial = flame;
            r.shadowCastingMode = ShadowCastingMode.Off;

            var light = new GameObject("Light").AddComponent<Light>();
            light.transform.SetParent(torch, false);
            light.transform.position = at + new Vector3(0, 0.15f, -0.85f); // too close to the face burns a flat stripe
            light.type = LightType.Point;
            light.color = Hex("#ffb347");
            light.intensity = intensity;
            light.range = 10f;
            light.shadows = shadows ? LightShadows.Soft : LightShadows.None;
            var flicker = light.gameObject.AddComponent<Flicker>();
            flicker.baseIntensity = intensity;
            flicker.seed = seed;
        }

        static GameObject Block(string name, Transform parent, Vector3 position, Vector3 size, Material material)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            UnityEngine.Object.DestroyImmediate(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.position = position;
            go.transform.localScale = size;
            go.GetComponent<Renderer>().sharedMaterial = material;
            return go;
        }

        static Material Lit(string name, string hex, float smoothness)
        {
            var m = MaterialAsset(name, "Universal Render Pipeline/Lit");
            m.SetColor("_BaseColor", Hex(hex));
            m.SetFloat("_Smoothness", smoothness);
            m.SetFloat("_Metallic", 0f);
            return m;
        }

        static Material Unlit(string name, string hex)
        {
            var m = MaterialAsset(name, "Universal Render Pipeline/Unlit");
            m.SetColor("_BaseColor", Hex(hex));
            return m;
        }

        static Material MaterialAsset(string name, string shaderName)
        {
            string path = $"{SettingsDir}/Materials/{name}.mat";
            var shader = Shader.Find(shaderName) ?? throw new Exception("shader not found: " + shaderName);
            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (m == null)
            {
                m = new Material(shader);
                AssetDatabase.CreateAsset(m, path);
            }
            m.shader = shader;
            EditorUtility.SetDirty(m);
            return m;
        }

        static Color Hex(string hex) => ColorUtility.TryParseHtmlString(hex, out var c) ? c : Color.magenta;
    }
}

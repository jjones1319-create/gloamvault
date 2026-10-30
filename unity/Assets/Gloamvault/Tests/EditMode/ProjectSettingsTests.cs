using System.Linq;
using Gloamvault.EditorTools;
using NUnit.Framework;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Gloamvault.Tests
{
    /// <summary>The player settings D-140 fixes (written by ProjectSetup) — a guard against a setting drifting.</summary>
    public class ProjectSettingsTests
    {
        [Test]
        public void TheAppIsGloamvault()
        {
            Assert.AreEqual(ProjectSetup.PackageId, PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android));
            Assert.AreEqual("Gloamvault", PlayerSettings.productName);
            Assert.AreEqual(ProjectSetup.Version, PlayerSettings.bundleVersion);
            Assert.AreEqual(ProjectSetup.VersionCode, PlayerSettings.Android.bundleVersionCode);
        }

        [Test]
        public void LandscapeOnly()
        {
            Assert.IsFalse(PlayerSettings.allowedAutorotateToPortrait);
            Assert.IsFalse(PlayerSettings.allowedAutorotateToPortraitUpsideDown);
            Assert.IsTrue(PlayerSettings.allowedAutorotateToLandscapeLeft);
            Assert.IsTrue(PlayerSettings.allowedAutorotateToLandscapeRight);
        }

        [Test]
        public void Il2cppArm64Vulkan()
        {
            Assert.AreEqual(ScriptingImplementation.IL2CPP, PlayerSettings.GetScriptingBackend(NamedBuildTarget.Android));
            Assert.AreEqual(AndroidArchitecture.ARM64, PlayerSettings.Android.targetArchitectures);
            var apis = PlayerSettings.GetGraphicsAPIs(BuildTarget.Android);
            Assert.AreEqual(GraphicsDeviceType.Vulkan, apis[0]);
            Assert.Contains(GraphicsDeviceType.OpenGLES3, apis);
        }

        [Test]
        public void TheInputSystemOnly()
        {
            // 1 = the Input System; 2 (both) is unsupported on Android and the build warns.
            var player = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset").First();
            Assert.AreEqual(1, new SerializedObject(player).FindProperty("activeInputHandler").intValue);
        }

        [Test]
        public void UrpIsTheRenderPipeline()
        {
            Assert.IsInstanceOf<UniversalRenderPipelineAsset>(GraphicsSettings.defaultRenderPipeline);
        }

        [Test]
        public void TheBootSceneIsTheFirstScene()
        {
            var scenes = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray();
            Assert.AreEqual(ProjectSetup.BootScene, scenes.FirstOrDefault());
        }

        [Test]
        public void NoKeyIsSavedInTheProject()
        {
            Assert.IsTrue(string.IsNullOrEmpty(PlayerSettings.Android.keystorePass));
            Assert.IsTrue(string.IsNullOrEmpty(PlayerSettings.Android.keyaliasPass));
        }
    }
}

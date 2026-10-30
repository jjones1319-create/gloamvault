using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UIElements;

namespace Gloamvault.Tests
{
    public static class Scenes
    {
        // Scenes in the build list load by name in a PlayMode test (ProjectSetup puts Boot first).
        public const string Boot = "Boot";

        public static IEnumerator Load(string name)
        {
            yield return SceneManager.LoadSceneAsync(name, LoadSceneMode.Single);
            yield return null;
        }
    }

    public class TitleSmokeTests
    {
        [UnityTest]
        public IEnumerator TheTitleShowsAndTheOverlaySamples()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(2.5f);

            var doc = Object.FindFirstObjectByType<UIDocument>();
            Assert.IsNotNull(doc, "the title's UIDocument");
            var wordmark = doc.rootVisualElement.Q<Label>(className: "wordmark");
            Assert.AreEqual("GLOAMVAULT", wordmark?.text);
            StringAssert.StartsWith("v" + Application.version, doc.rootVisualElement.Q<Label>("version").text);

            var overlay = Object.FindFirstObjectByType<PerfOverlay>();
            Assert.Greater(overlay.SampleCount, 0, "the overlay samples once a second");
            Assert.Greater(overlay.Last.Fps, 0f);
        }
    }
}

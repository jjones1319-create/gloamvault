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

        /// <summary>Phase 10: the Rules check opens from the title and plays case A to Node's hash on its worker thread.</summary>
        [UnityTest]
        public IEnumerator TheRulesCheckPlaysCaseAAsNodeDid()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(1f);
            var doc = Object.FindFirstObjectByType<UIDocument>();
            Assert.IsNotNull(doc.rootVisualElement.Q<Button>("rules"), "the title's Rules check button");

            var screen = RulesCheckScreen.Open(doc, run: true, onlyCaseId: "A");
            float started = Time.realtimeSinceStartup;
            while (!screen.Done && Time.realtimeSinceStartup - started < 170f) yield return null;
            Assert.IsTrue(screen.Done, "the check finished");
            Assert.AreEqual(1, screen.Results.Count);
            var r = screen.Results[0];
            Assert.IsNull(r.error, "case A ran");
            Assert.IsTrue(r.same, $"case A matches Node (differs at {r.differsAt})");
            StringAssert.Contains("same as the computer", doc.rootVisualElement.Q<Label>(className: "case__status").text);
        }
    }
}

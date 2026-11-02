using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using UnityEngine.UIElements;

namespace Gloamvault.Tests
{
    /// <summary>Phase 18: the tree screen opens on the Arcanist, draws sixty skills, spends a point on a tap, steps to another class.</summary>
    public class TreeSmokeTests
    {
        [UnityTest]
        public IEnumerator TheTreeScreenDrawsTheArcanistAndSpendsAPoint()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(0.5f);
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = TreeScreen.Open(doc, "arcanist", 6);
            yield return null;
            Assert.AreEqual("", screen.Error, "the tree loaded: " + screen.Error);
            Assert.AreEqual(60, screen.SkillButtons);
            Assert.AreEqual(5, screen.Hero.points);
            screen.Pick("arcanist-cinder-snap");
            yield return null;
            Assert.IsTrue(screen.Spend("arcanist-cinder-snap"), "a point bought Cinder Snap");
            Assert.AreEqual(4, screen.Hero.points);
            Assert.IsTrue(screen.StandingOf("arcanist-cinder-snap").known);
            Assert.IsFalse(screen.Spend("arcanist-sunflare"), "Tier V stays shut");
            // The next class draws its three branches.
            var next = doc.rootVisualElement.Q<Button>("classNext");
            Assert.IsNotNull(next);
            screen.Load(1);
            Assert.AreEqual("", screen.Error);
        }
    }
}

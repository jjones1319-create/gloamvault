using System.Collections;
using Gloamvault.Level;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using UnityEngine.UIElements;

namespace Gloamvault.Tests
{
    /// <summary>Phase 19: a fight on Floor 1 goes to the stage — figures appear, the camera swings, actions play out, A hurries it, the card comes after.</summary>
    public class FightStageSmokeTests
    {
        [UnityTest]
        public IEnumerator AFightIsStagedThenToldOnTheCard()
        {
            FloorState.Forget("floor-1");
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(0.5f);
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = LevelScreen.Open(doc, seed: 11, floorId: "floor-1");
            yield return null;
            yield return null;
            var play = screen.Play;
            Assert.IsTrue(play.Ok, play.Error);
            var camBefore = Camera.main.transform.position;
            play.Walk(400);
            yield return null;
            Assert.IsTrue(play.Staging, "the fight went to the stage, not straight to the card");
            Assert.IsFalse(play.CardOpen);
            Assert.Greater(play.Stage.View.actors.Length, 2);
            yield return new WaitForSecondsRealtime(1.2f);
            Assert.Greater(Vector3.Distance(Camera.main.transform.position, camBefore), 1f, "the camera swung to the side");
            Assert.Greater(play.Stage.Actions, 0, "the rules stepped");
            // A hurries the rest.
            screen.Act();
            float t = 0f;
            while (play.Staging && t < 20f) { yield return null; t += Time.deltaTime; }
            Assert.IsFalse(play.Staging, "the fight ended on the stage");
            Assert.IsTrue(play.CardOpen, "the card tells it after");
            Assert.AreEqual(1, play.Snap.fights);
            play.Card.PressFirst();
            yield return null;
            FloorState.Forget("floor-1");
        }
    }
}

using System.Collections;
using Gloamvault.Env;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using UnityEngine.UIElements;

namespace Gloamvault.Tests
{
    /// <summary>Phase 11: a room of each zone builds from its template within its budget, with its torches lit.</summary>
    public class RoomSmokeTests
    {
        [UnityTest]
        public IEnumerator ARoomOfEachZoneBuildsWithinBudget()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(0.5f);
            var doc = Object.FindFirstObjectByType<UIDocument>();
            Assert.IsNotNull(doc.rootVisualElement.Q<Button>("rooms"), "the title's Rooms button");
            var screen = RoomsScreen.Open(doc, "cel-t-guardpost");
            foreach (var id in new[] { "cel-t-guardpost", "cry-t-wardens-vigil", "vlt-t-throne" })
            {
                screen.ShowById(id);
                yield return null;
                var room = screen.Current;
                Assert.IsNotNull(room, id + " built");
                Assert.IsEmpty(room.missing, id + " missing pieces: " + string.Join(", ", room.missing));
                Assert.Greater(room.pieces, 20, id + " pieces");
                Assert.LessOrEqual(room.triangles, room.template.triBudget, id + " triangles within the template's budget");
                Assert.GreaterOrEqual(screen.Lighting.lights.Count, 2, id + " two point lights");
                Assert.IsTrue(screen.Lighting.lights[0].shadows != LightShadows.None, id + " the nearest torch casts shadows");
                Debug.Log($"[gv-test] {id}: {room.pieces} pieces, {room.triangles} tris, {room.flames.Count} flames, axes {room.kit.axes.sx},{room.kit.axes.sz}");
            }
            screen.SetLight(20);
            yield return new WaitForSecondsRealtime(0.6f);
            Assert.Less(RenderSettings.ambientSkyColor.grayscale, 0.5f, "a dark room has a dim ambient");
        }
    }
}

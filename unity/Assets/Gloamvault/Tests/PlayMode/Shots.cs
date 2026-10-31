using System.Collections;
using System.IO;
using System.Linq;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.TestTools;
using UnityEngine.UIElements;

namespace Gloamvault.Tests
{
    /// <summary>
    /// <c>npm run unity:shots</c>: the screen set rendered at the phone's 2,340 × 1,080 (D-052) to <c>unity/shots/</c>.
    /// Batchmode has no game view, so the camera is rendered to a texture by request and the UI panel to a second
    /// texture, and the two are put together — the UI over the scene — before the PNG is written.
    /// </summary>
    [Category("Shots")]
    public class Shots
    {
        [UnityTest]
        public IEnumerator Title()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(1.5f);
            yield return ShotCapture.Capture("title");

            var overlay = Object.FindFirstObjectByType<PerfOverlay>();
            bool was = overlay.Visible;
            overlay.SetVisible(true);
            yield return new WaitForSecondsRealtime(1.2f);
            yield return ShotCapture.Capture("title-perf");
            overlay.SetVisible(was);
        }

        [UnityTest]
        public IEnumerator Rules()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(1f);
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = RulesCheckScreen.Open(doc, run: true, onlyCaseId: "A");
            float started = Time.realtimeSinceStartup;
            while (!screen.Done && Time.realtimeSinceStartup - started < 170f) yield return null;
            yield return new WaitForSecondsRealtime(0.5f);
            yield return ShotCapture.Capture("rules");
        }

        [UnityTest]
        public IEnumerator Rooms()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(1f);
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = RoomsScreen.Open(doc, "cel-t-guardpost");
            foreach (var (id, name) in new[] { ("cel-t-guardpost", "room-cellars"), ("cry-t-wardens-vigil", "room-crypts"), ("vlt-t-throne", "room-vault") })
            {
                screen.ShowById(id);
                yield return new WaitForSecondsRealtime(1.2f);
                yield return ShotCapture.Capture(name);
            }
            screen.ShowById("cel-t-guardpost");
            screen.SetLight(20);
            yield return new WaitForSecondsRealtime(2.5f);
            yield return ShotCapture.Capture("room-dark");
        }

        [UnityTest]
        public IEnumerator Characters()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(1f);
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = CharactersScreen.Open(doc, "dwarf,warden,S");
            yield return new WaitForSecondsRealtime(1f);
            yield return ShotCapture.Capture("hero-card");
            screen.Play("Attack_Heavy");
            yield return new WaitForSecondsRealtime(0.45f);
            yield return ShotCapture.Capture("hero-swing");
            screen.ShowMonster("old-gnaw");
            yield return new WaitForSecondsRealtime(1f);
            yield return ShotCapture.Capture("monster-old-gnaw");
            screen.ShowMonster("hollow-king");
            yield return new WaitForSecondsRealtime(1f);
            yield return ShotCapture.Capture("monster-king");
        }

        /// <summary>Every species × class at once, and every monster of a zone in a line — the web's matrix and lineups.</summary>
        [UnityTest]
        public IEnumerator Lineups()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(0.5f);
            var cam = Camera.main;
            var stage = Gloamvault.CharactersScreen.StageLight(Vector3.zero);
            var built = new System.Collections.Generic.List<Gloamvault.Characters.Character>();
            int i = 0;
            foreach (var species in Gloamvault.Characters.HeroLibrary.SpeciesIds)
            {
                int j = 0;
                foreach (var cls in Gloamvault.Characters.HeroLibrary.Classes)
                {
                    var c = Gloamvault.Characters.HeroAssembler.Build(new Gloamvault.Characters.HeroSpec { speciesId = species, classId = cls, tier = "S" });
                    c.root.transform.position = new Vector3((j - 2.5f) * 1.5f, 0, (i - 2.5f) * 1.6f);
                    c.root.transform.rotation = Quaternion.Euler(0, Gloamvault.CharactersScreen.FaceCamera, 0);
                    c.animator.Play("Idle");
                    built.Add(c);
                    j++;
                }
                i++;
            }
            cam.transform.position = new Vector3(0, 6.5f, -9.5f);
            cam.transform.LookAt(new Vector3(0, 0.8f, 0.5f));
            cam.fieldOfView = 50f;
            yield return new WaitForSecondsRealtime(1f);
            yield return ShotCapture.Capture("heroes-matrix");
            foreach (var c in built) c.Destroy();
            built.Clear();

            foreach (var zone in Gloamvault.CharactersScreen.Zones)
            {
                var list = Gloamvault.Characters.MonsterBuilder.Data.list.Where(m => m.zone == zone && !string.IsNullOrEmpty(m.entry)).ToList();
                float x = -(list.Count - 1) * 0.5f * 1.4f;
                foreach (var m in list)
                {
                    var c = Gloamvault.Characters.MonsterBuilder.Build(Gloamvault.Characters.MonsterBuilder.Data.Entry(m.entry));
                    c.root.transform.position = new Vector3(x, 0, 0);
                    c.root.transform.rotation = Quaternion.Euler(0, Gloamvault.CharactersScreen.FaceCamera, 0);
                    c.animator.Play("Idle");
                    built.Add(c);
                    x += 1.4f;
                }
                float width = Mathf.Max(6f, list.Count * 1.4f);
                cam.transform.position = new Vector3(0, 2.2f, -width * 0.62f - 2f);
                cam.transform.LookAt(new Vector3(0, 1.0f, 0));
                cam.fieldOfView = 50f;
                yield return new WaitForSecondsRealtime(1f);
                yield return ShotCapture.Capture("monsters-" + zone);
                foreach (var c in built) c.Destroy();
                built.Clear();
            }
            Object.Destroy(stage);
        }
    }

    public static class ShotCapture
    {
        public const int Width = 2340;
        public const int Height = 1080;

        public static string OutDir => Path.GetFullPath(Path.Combine(Application.dataPath, "..", "shots"));

        public static IEnumerator Capture(string name)
        {
            var camera = Camera.main;
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var sceneRt = new RenderTexture(Width, Height, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB) { antiAliasing = 4 };
            var uiRt = new RenderTexture(Width, Height, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);

            // The UI goes to its own texture through a copy of the panel settings (the asset itself stays untouched).
            PanelSettings original = null, shotPanel = null;
            if (doc != null)
            {
                original = doc.panelSettings;
                shotPanel = Object.Instantiate(original);
                shotPanel.targetTexture = uiRt;
                shotPanel.clearColor = true;
                shotPanel.colorClearValue = Color.clear;
                doc.panelSettings = shotPanel;
            }
            for (int i = 0; i < 4; i++) yield return null;

            var request = new RenderPipeline.StandardRequest { destination = sceneRt };
            if (camera != null && RenderPipeline.SupportsRenderRequest(camera, request))
                RenderPipeline.SubmitRenderRequest(camera, request);
            yield return null;

            var scene = Read(sceneRt);
            var ui = doc != null ? Read(uiRt) : null;
            var outPixels = scene.GetPixels32();
            if (ui != null)
            {
                var uiPixels = ui.GetPixels32();
                for (int i = 0; i < outPixels.Length; i++)
                {
                    // The panel draws premultiplied over a clear texture: out = ui + (1 − ui.a) × scene.
                    var u = uiPixels[i];
                    var s = outPixels[i];
                    int inv = 255 - u.a;
                    outPixels[i] = new Color32(
                        (byte)Mathf.Min(255, u.r + s.r * inv / 255),
                        (byte)Mathf.Min(255, u.g + s.g * inv / 255),
                        (byte)Mathf.Min(255, u.b + s.b * inv / 255),
                        255);
                }
            }
            var result = new Texture2D(Width, Height, TextureFormat.RGBA32, false);
            result.SetPixels32(outPixels);
            result.Apply();
            Directory.CreateDirectory(OutDir);
            string path = Path.Combine(OutDir, name + ".png");
            File.WriteAllBytes(path, result.EncodeToPNG());
            Debug.Log("[gv-shot] " + path);

            if (doc != null) doc.panelSettings = original;
            Object.Destroy(shotPanel);
            Object.Destroy(scene);
            if (ui != null) Object.Destroy(ui);
            Object.Destroy(result);
            sceneRt.Release();
            uiRt.Release();
        }

        static Texture2D Read(RenderTexture rt)
        {
            var previous = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(rt.width, rt.height, TextureFormat.RGBA32, false);
            tex.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
            tex.Apply();
            RenderTexture.active = previous;
            return tex;
        }
    }
}

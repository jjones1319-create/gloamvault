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

        [UnityTest]
        public IEnumerator Walk()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(0.5f);
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = WalkScreen.Open(doc, "cel-t-guardpost");
            screen.Stick.Set(new Vector2(0.4f, 0.6f));
            yield return new WaitForSecondsRealtime(0.8f);
            screen.Stick.Set(Vector2.zero);
            yield return new WaitForSecondsRealtime(0.4f);
            yield return ShotCapture.Capture("walk-room");

            // Beside a door, opened.
            var door = screen.Room.doors[0];
            var centre = screen.Room.root.transform.position;
            var inward = centre - door.transform.position; inward.y = 0; inward.Normalize();
            var hero = screen.Hero.root.transform;
            screen.Mover.controller.enabled = false;
            hero.position = door.transform.position + inward * 1.4f;
            hero.rotation = Quaternion.LookRotation(-inward, Vector3.up);
            screen.Mover.controller.enabled = true;
            yield return null;
            screen.Interactor.Update(hero, screen.Room.doors);
            screen.Act();
            yield return new WaitForSecondsRealtime(1.2f);
            yield return ShotCapture.Capture("walk-door");

            screen.CycleCamera();
            yield return new WaitForSecondsRealtime(1.0f);
            yield return ShotCapture.Capture("walk-far");

            screen.ShowById("cry-t-wardens-vigil");
            yield return null;
            var gate = screen.Room.doors[0];
            var inward2 = screen.Room.root.transform.position - gate.transform.position; inward2.y = 0; inward2.Normalize();
            var hero2 = screen.Hero.root.transform;
            screen.Mover.controller.enabled = false;
            hero2.position = gate.transform.position + inward2 * 1.6f;
            hero2.rotation = Quaternion.LookRotation(-inward2, Vector3.up);
            screen.Mover.controller.enabled = true;
            gate.Open();
            yield return new WaitForSecondsRealtime(1.2f);
            yield return ShotCapture.Capture("walk-crypts");
        }

        /// <summary>Phase 14: the test level — the entry, a hall from the far camera, the Crypts region, the overlay over the stream.</summary>
        [UnityTest]
        public IEnumerator Level()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(0.5f);
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = LevelScreen.Open(doc, seed: 1);
            yield return null;
            var level = screen.Level;
            var entry = level.rooms[level.entryId];
            // Face the first join so the doorway into the next room is in the picture.
            var hero = screen.Hero.root.transform;
            var first = level.Neighbours(entry).First();
            var look = Gloamvault.Level.LevelBuilder.JoinPoint(first.join) - hero.position; look.y = 0;
            hero.rotation = Quaternion.LookRotation(look.normalized, Vector3.up);
            yield return new WaitForSecondsRealtime(1.2f);
            yield return ShotCapture.Capture("level-entry");

            // A hall, from the far camera.
            var hall = level.rooms.FirstOrDefault(r => r.hall && r.kit == "cellars") ?? first.other;
            screen.Teleport(Gloamvault.Level.LevelBuilder.RoomCentre(hall));
            var next = level.Neighbours(hall).FirstOrDefault();
            if (next.join != null) { var l2 = Gloamvault.Level.LevelBuilder.JoinPoint(next.join) - hero.position; l2.y = 0; hero.rotation = Quaternion.LookRotation(l2.normalized, Vector3.up); }
            screen.CycleCamera();
            yield return new WaitForSecondsRealtime(1.2f);
            yield return ShotCapture.Capture("level-far");
            screen.CycleCamera(); screen.CycleCamera();

            // The Crypts region.
            var crypt = level.rooms.FirstOrDefault(r => r.kit == "crypts" && !r.hall) ?? level.rooms.First(r => r.kit == "crypts");
            screen.Teleport(Gloamvault.Level.LevelBuilder.RoomCentre(crypt));
            yield return new WaitForSecondsRealtime(1.2f);
            yield return ShotCapture.Capture("level-crypts");

            // The overlay on, the pilot walking.
            var overlay = Object.FindFirstObjectByType<PerfOverlay>();
            bool was = overlay.Visible;
            overlay.SetVisible(true);
            screen.SetAutoWalk(true);
            yield return new WaitForSecondsRealtime(2.5f);
            yield return ShotCapture.Capture("level-overlay");
            overlay.SetVisible(was);
            screen.SetAutoWalk(false);
        }

        /// <summary>Phase 15: Floor 1 — the gate with the minimap, the lever pulled, a panel found, the map part-explored, the stair down.</summary>
        [UnityTest]
        public IEnumerator Floor()
        {
            Gloamvault.Level.FloorState.Forget("floor-1");
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(0.5f);
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = LevelScreen.Open(doc, floorId: "floor-1", rules: false);
            yield return null;
            var floor = screen.Floor;
            var l = floor.level;
            var first = l.Neighbours(l.rooms[l.entryId]).First();
            screen.Face(Gloamvault.Level.LevelBuilder.JoinPoint(first.join));
            yield return new WaitForSecondsRealtime(1.2f);
            yield return ShotCapture.Capture("floor-entry");

            // The lever in the cold hearth, pulled.
            var lever = screen.Levers[0];
            var hearth = l.rooms[floor.def.levers[0].room];
            screen.Teleport(lever.Position + (Gloamvault.Level.LevelBuilder.RoomCentre(hearth) - lever.Position).normalized * 1.3f);
            screen.Face(lever.Position);
            yield return null;
            screen.Act();
            yield return new WaitForSecondsRealtime(1.0f);
            yield return ShotCapture.Capture("floor-lever");

            // The panel beside the hearth, found.
            int sj = floor.secretJoins.First(j => l.joins[j].a == hearth.id);
            var pj = l.joins[sj];
            var panel = screen.Streamer.Built[pj.a].doors.First(d => d.GetComponent<Gloamvault.Env.RoomPiece>().side == pj.sideA);
            screen.Teleport(panel.transform.position + (Gloamvault.Level.LevelBuilder.RoomCentre(hearth) - panel.transform.position).normalized * 1.1f);
            screen.Face(panel.transform.position);
            yield return null;
            screen.Act();
            yield return new WaitForSecondsRealtime(1.0f);
            yield return ShotCapture.Capture("floor-secret");

            // The map after a few rooms.
            foreach (var id in new[] { 2, 3, 4, 13, 19 }) if (id < l.rooms.Count) screen.State.visited.Add(id);
            screen.Teleport(Gloamvault.Level.LevelBuilder.RoomCentre(l.rooms[2]));
            yield return null;
            screen.ShowMap(true);
            yield return new WaitForSecondsRealtime(0.8f);
            yield return ShotCapture.Capture("floor-map");
            screen.ShowMap(false);

            // The stair down.
            var stairs = screen.Exits.First(e => e.def.kind == "stairs");
            screen.Teleport(stairs.Position + new Vector3(0, 0, 1.6f));
            screen.Face(stairs.Position);
            yield return new WaitForSecondsRealtime(1.0f);
            yield return ShotCapture.Capture("floor-stairs");
            Gloamvault.Level.FloorState.Forget("floor-1");
        }

        /// <summary>Phase 16: each traversal mid-move — the crawl under the timber, the squeeze between the stacks, the jump over the pit, the climb over the wall.</summary>
        [UnityTest]
        public IEnumerator Traverse()
        {
            Gloamvault.Level.FloorState.Forget("floor-1");
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(0.5f);
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = LevelScreen.Open(doc, floorId: "floor-1", rules: false);
            yield return null;
            var floor = screen.Floor;
            foreach (var spot in floor.def.spots.Where(s => s.IsTraversal))
            {
                var room = floor.level.rooms[spot.room];
                screen.Teleport(Gloamvault.Level.LevelBuilder.RoomCentre(room));
                yield return null;
                var a = screen.TraversalEnds.First(e => e.traversal.def == spot);
                screen.Teleport(a.from); screen.Face(a.to);
                yield return new WaitForSecondsRealtime(0.6f);
                yield return ShotCapture.Capture("traverse-" + spot.kind + "-prompt");
                screen.Act();
                float seconds = Gloamvault.Level.TraversalPath.Seconds(spot.kind, Vector3.Distance(a.from, a.to));
                yield return new WaitForSecondsRealtime(seconds * 0.5f);
                yield return ShotCapture.Capture("traverse-" + spot.kind);
                yield return new WaitForSecondsRealtime(seconds * 0.6f);
            }
            Gloamvault.Level.FloorState.Forget("floor-1");
        }

        /// <summary>Every species × class at once, and every monster of a zone in a line — the web's matrix and lineups.</summary>
        /// <summary>Phase 17: the monsters waiting at their spot, the fight's card, a chest's prompt, the delve's end.</summary>
        [UnityTest]
        public IEnumerator Play()
        {
            Gloamvault.Level.FloorState.Forget("floor-1");
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(0.5f);
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = LevelScreen.Open(doc, seed: 11, floorId: "floor-1");
            yield return null;
            yield return null;
            var play = screen.Play;
            var floor = screen.Floor;
            IEnumerator WalkTo(int target)
            {
                int prev = 0;
                foreach (var r in FloorPlaySmokeTests.PathTo(floor, target))
                {
                    screen.Teleport(FloorPlaySmokeTests.DoorsideOf(floor, r, prev));
                    prev = r;
                    yield return null;
                    yield return null;
                    if (play.CardOpen) play.Card.PressFirst();
                    yield return null;
                }
            }
            // The monsters in room 2, seen from the door side.
            yield return WalkTo(2);
            var monster = play.Things.OfType<Gloamvault.Level.MonsterThing>().FirstOrDefault();
            if (monster != null)
            {
                var room = floor.level.rooms[2];
                var centre = Gloamvault.Level.LevelBuilder.RoomCentre(room);
                var back = monster.Position + (centre - monster.Position).normalized * 0.01f;
                screen.Teleport(monster.Position + new Vector3(-3.2f, 0f, -0.8f));
                screen.Face(monster.Position);
                yield return new WaitForSecondsRealtime(0.8f);
                yield return ShotCapture.Capture("play-monsters");
                screen.Teleport(monster.Position + new Vector3(0.4f, 0f, 0.4f));
                yield return null;
                yield return null;
                yield return new WaitForSecondsRealtime(0.3f);
                yield return ShotCapture.Capture("play-card");
                if (play.CardOpen) play.Card.PressFirst();
                yield return null;
            }
            // A chest in the treasure room.
            int treasure = floor.def.rooms.First(r => r.role == "treasure").id;
            yield return WalkTo(treasure);
            var chest = play.Things.OfType<Gloamvault.Level.ChestThing>().FirstOrDefault();
            if (chest != null)
            {
                screen.Teleport(chest.Position + new Vector3(0f, 0f, 1.1f));
                screen.Face(chest.Position);
                yield return new WaitForSecondsRealtime(0.6f);
                yield return ShotCapture.Capture("play-chest");
                screen.Act();
                yield return null;
                yield return new WaitForSecondsRealtime(0.3f);
                yield return ShotCapture.Capture("play-loot");
                if (play.CardOpen) play.Card.PressFirst();
                yield return null;
            }
            // The stair: the floor's end.
            yield return WalkTo(floor.StairsRoom.id);
            var exit = screen.Exits.First(e => e.def.kind == "stairs");
            screen.Teleport(exit.Position + new Vector3(0f, 0f, 1.2f));
            screen.Face(exit.Position);
            yield return null;
            yield return null;
            screen.Act();
            yield return null;
            yield return new WaitForSecondsRealtime(0.3f);
            yield return ShotCapture.Capture("play-end");
            Gloamvault.Level.FloorState.Forget("floor-1");
        }

        /// <summary>Phase 18: the Arcanist's four branches with a few points spent, and the Warden's three.</summary>
        [UnityTest]
        public IEnumerator Trees()
        {
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(0.5f);
            var doc = Object.FindFirstObjectByType<UIDocument>();
            var screen = TreeScreen.Open(doc, "arcanist", 12);
            yield return null;
            screen.Spend("arcanist-cinder-snap"); screen.Spend("arcanist-call-rime-stag"); screen.Spend("arcanist-flame-ward");
            screen.Pick("arcanist-call-storm-hawk");
            yield return new WaitForSecondsRealtime(0.4f);
            yield return ShotCapture.Capture("tree-arcanist");
            screen.Step(-1);
            yield return null;
            screen.Pick("");
            yield return new WaitForSecondsRealtime(0.4f);
            yield return ShotCapture.Capture("tree-" + screen.ClassId);
        }

        /// <summary>Phase 19: the fight on the stage — the lines facing, a swing mid-fight; an Arcanist's summon called.</summary>
        [UnityTest]
        public IEnumerator Fight()
        {
            Gloamvault.Level.FloorState.Forget("floor-1");
            yield return Scenes.Load(Scenes.Boot);
            yield return new WaitForSecondsRealtime(0.5f);
            var doc = Object.FindFirstObjectByType<UIDocument>();
            Gloamvault.Level.FloorPlay.HeroExtras = ",\"skillIds\":[\"arcanist-call-ember-imp\"],\"onlyActives\":[\"arcanist-call-ember-imp\"],\"aiRule\":\"ELSE call: ember imp on weakest enemy\"";
            var screen = LevelScreen.Open(doc, seed: 11, floorId: "floor-1", hero: new Gloamvault.Characters.HeroSpec { speciesId = "elf", classId = "arcanist", tier = "S" });
            yield return null;
            yield return null;
            var play = screen.Play;
            play.Walk(400);
            yield return null;
            yield return new WaitForSecondsRealtime(1.6f);
            yield return ShotCapture.Capture("fight-stage");
            float t = 0f;
            while (play.Staging && play.Stage.Summons == 0 && t < 25f) { yield return null; t += Time.deltaTime; }
            if (play.Staging && play.Stage.Summons > 0)
            {
                yield return new WaitForSecondsRealtime(0.5f);
                yield return ShotCapture.Capture("fight-summon");
            }
            Gloamvault.Level.FloorPlay.HeroExtras = "";
            Gloamvault.Level.FloorState.Forget("floor-1");
        }

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

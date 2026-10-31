using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Gloamvault.EditorTools
{
    /// <summary>
    /// Import settings for the generated models (Phase 12, D-160). Resources/Env, Hero and Monsters are written by the
    /// Blender tools and git-ignored, so their .meta files are not committed: every setting that matters is applied
    /// here, deterministically, on import. Heroes and monsters: a Generic rig with its bones kept as transforms, blend
    /// shapes, every take a clip (named after the action: "Rig|Idle" → "Idle") with its loop from clips.json, no CPU
    /// copy of the mesh. Kits: as before, plus no CPU copy.
    /// </summary>
    public sealed class ModelImportSettings : AssetPostprocessor
    {
        const string Hero = "Assets/Gloamvault/Resources/Hero/";
        const string Monsters = "Assets/Gloamvault/Resources/Monsters/";
        const string Env = "Assets/Gloamvault/Resources/Env/";

        bool Rigged => assetPath.StartsWith(Hero) || assetPath.StartsWith(Monsters);
        bool Ours => Rigged || assetPath.StartsWith(Env);

        /// <summary>Bumped when these rules change: Unity re-imports every model they touch.</summary>
        public override uint GetVersion() => 3;

        void OnPreprocessModel()
        {
            if (!Ours) return;
            var m = (ModelImporter)assetImporter;
            m.isReadable = false;
            m.importNormals = ModelImporterNormals.Import;
            m.importTangents = ModelImporterTangents.None;
            m.materialImportMode = ModelImporterMaterialImportMode.None;
            m.meshCompression = ModelImporterMeshCompression.Off;
            m.importVisibility = false;
            m.importCameras = false;
            m.importLights = false;
            m.useFileScale = true;
            m.globalScale = 1f;
            if (!Rigged)
            {
                m.animationType = ModelImporterAnimationType.None;
                m.importAnimation = false;
                m.importBlendShapes = false;
                return;
            }
            m.animationType = ModelImporterAnimationType.Generic;
            m.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
            m.optimizeGameObjects = false;
            m.importBlendShapes = true;
            m.importBlendShapeNormals = ModelImporterNormals.None;
            m.preserveHierarchy = true;
            m.resampleCurves = true;
            m.animationCompression = ModelImporterAnimationCompression.Optimal;
            m.importAnimation = HasTakes();
        }

        // The takes are known only once the file is read: the clips are named and looped here, not in the model step.
        void OnPreprocessAnimation()
        {
            if (!Rigged) return;
            ApplyClips((ModelImporter)assetImporter);
        }

        /// <summary>Only the files with actions carry takes: the hero clips file and the monsters with their own rigs.</summary>
        bool HasTakes()
        {
            string name = Path.GetFileNameWithoutExtension(assetPath);
            if (assetPath.StartsWith(Hero)) return name == "hero_clips";
            return true;
        }

        /// <summary>Each take as a clip named after its action, looping as clips.json says.</summary>
        void ApplyClips(ModelImporter m)
        {
            var loops = LoopsFor();
            var takes = m.defaultClipAnimations;
            if (takes == null || takes.Length == 0) return;
            var clips = new List<ModelImporterClipAnimation>();
            foreach (var t in takes)
            {
                string name = t.name;
                int bar = name.LastIndexOf('|');
                if (bar >= 0) name = name.Substring(bar + 1);
                t.name = name;
                t.loopTime = loops.TryGetValue(name, out var loop) && loop;
                t.loopPose = false;
                t.keepOriginalPositionY = true;
                t.keepOriginalPositionXZ = true;
                t.keepOriginalOrientation = true;
                t.lockRootHeightY = true;
                t.lockRootPositionXZ = true;
                t.lockRootRotation = true;
                clips.Add(t);
            }
            m.clipAnimations = clips.ToArray();
        }

        /// <summary>The loop flags from the sibling clips.json (the hero file, or the monster base's entry).</summary>
        Dictionary<string, bool> LoopsFor()
        {
            var o = new Dictionary<string, bool>();
            try
            {
                string dir = Path.GetDirectoryName(assetPath);
                string json = Path.Combine(dir, "clips.json");
                if (!File.Exists(json)) return o;
                string text = File.ReadAllText(json);
                string baseName = Path.GetFileNameWithoutExtension(assetPath);
                // A cheap scan rather than a JSON reader: `"name":"Idle"` … `"loop":true` pairs, within the base's section for monsters.
                int from = 0;
                if (assetPath.StartsWith(Monsters))
                {
                    int at = text.IndexOf("\"" + baseName + "\"", StringComparison.Ordinal);
                    if (at < 0) return o;
                    from = at;
                }
                int i = from;
                while (true)
                {
                    int n = text.IndexOf("\"name\":\"", i, StringComparison.Ordinal);
                    if (n < 0) break;
                    int e = text.IndexOf('"', n + 8);
                    string name = text.Substring(n + 8, e - n - 8);
                    int l = text.IndexOf("\"loop\":", e, StringComparison.Ordinal);
                    if (l < 0) break;
                    bool loop = text.Substring(l + 7, 4) == "true";
                    if (!o.ContainsKey(name)) o[name] = loop;
                    i = l;
                    if (assetPath.StartsWith(Monsters) && text.IndexOf("\"clips\":[", l, StringComparison.Ordinal) is int next && next >= 0 && next < text.IndexOf("\"name\":\"", l, StringComparison.Ordinal)) break;
                }
            }
            catch (Exception e)
            {
                Debug.LogWarning("[gv-import] clips.json: " + e.Message);
            }
            return o;
        }
    }
}

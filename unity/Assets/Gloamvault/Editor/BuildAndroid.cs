using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Gloamvault.EditorTools
{
    /// <summary>
    /// <c>npm run unity:build</c> (batchmode, <c>-executeMethod Gloamvault.EditorTools.BuildAndroid.Run -gvKeys path</c>):
    /// the release-signed APK at <c>unity/Build/gloamvault.apk</c>. The key's passwords come from the keys file outside
    /// the repo and are put back afterwards, so nothing about the key is saved into ProjectSettings (D-138).
    /// </summary>
    public static class BuildAndroid
    {
        [Serializable]
        class Keys
        {
            public string keystore;
            public string storePass;
            public string alias;
            public string keyPass;
        }

        public static void Run()
        {
            int exit = 1;
            bool custom = PlayerSettings.Android.useCustomKeystore;
            string keystore = PlayerSettings.Android.keystoreName;
            string alias = PlayerSettings.Android.keyaliasName;
            try
            {
                string keysPath = Arg("-gvKeys") ?? throw new Exception("pass -gvKeys <keystore.json>");
                var keys = JsonUtility.FromJson<Keys>(File.ReadAllText(keysPath));
                if (string.IsNullOrEmpty(keys?.keystore) || !File.Exists(keys.keystore))
                    throw new Exception("the keystore named in " + keysPath + " is missing");

                PlayerSettings.Android.useCustomKeystore = true;
                PlayerSettings.Android.keystoreName = keys.keystore;
                PlayerSettings.Android.keystorePass = keys.storePass;
                PlayerSettings.Android.keyaliasName = keys.alias;
                PlayerSettings.Android.keyaliasPass = keys.keyPass;
                EditorUserBuildSettings.buildAppBundle = false;
                EditorUserBuildSettings.development = false;
                // The version lives in ProjectSetup; applied here too, so a bump needs no setup re-run.
                PlayerSettings.bundleVersion = ProjectSetup.Version;
                PlayerSettings.Android.bundleVersionCode = ProjectSetup.VersionCode;

                var options = new BuildPlayerOptions
                {
                    scenes = new[] { ProjectSetup.BootScene },
                    locationPathName = "Build/gloamvault.apk",
                    target = BuildTarget.Android,
                    targetGroup = BuildTargetGroup.Android,
                    options = BuildOptions.None,
                };
                var report = BuildPipeline.BuildPlayer(options);
                var s = report.summary;
                // The APK's own size (the report's totalSize counts what went in, before compression).
                long bytes = File.Exists(s.outputPath) ? new FileInfo(s.outputPath).Length : 0;
                Debug.Log($"[gv-build] {s.result}: {s.outputPath} {bytes / (1024f * 1024f):0.0} MB in " +
                          $"{s.totalTime.TotalSeconds:0} s, {s.totalErrors} errors, {s.totalWarnings} warnings; " +
                          $"version {PlayerSettings.bundleVersion} ({PlayerSettings.Android.bundleVersionCode})");
                exit = s.result == BuildResult.Succeeded ? 0 : 1;
            }
            catch (Exception e)
            {
                Debug.LogError("[gv-build] FAILED " + e);
            }
            finally
            {
                PlayerSettings.Android.useCustomKeystore = custom;
                PlayerSettings.Android.keystoreName = keystore;
                PlayerSettings.Android.keyaliasName = alias;
                PlayerSettings.Android.keystorePass = "";
                PlayerSettings.Android.keyaliasPass = "";
            }
            EditorApplication.Exit(exit);
        }

        static string Arg(string name)
        {
            var args = Environment.GetCommandLineArgs();
            int i = Array.IndexOf(args, name);
            return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
        }
    }
}

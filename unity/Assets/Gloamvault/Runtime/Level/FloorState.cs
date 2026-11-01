using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gloamvault.Level
{
    /// <summary>
    /// What a floor remembers between delves (D-151, Phase 15): the rooms you have stood in, the secret panels found,
    /// the levers pulled, the exits found, the key in hand. Kept per floor in PlayerPrefs as JSON until Phase 22 moves
    /// it into the save file (D-165). Encounters, chests, curios and traps are never kept — they are drawn afresh.
    /// </summary>
    public sealed class FloorState
    {
        public const string PrefPrefix = "gv.floor.";

        public readonly string floorId;
        public readonly HashSet<int> visited = new();
        public readonly HashSet<int> secretsFound = new();
        /// <summary>Locked joins opened with the key (a shortcut opened stays open, D-151).</summary>
        public readonly HashSet<int> joinsUnlocked = new();
        public readonly HashSet<string> leversPulled = new();
        public readonly HashSet<string> exitsFound = new();
        public int keysHeld;
        public bool keyTaken;

        public FloorState(string floorId) { this.floorId = floorId; }

        [Serializable]
        sealed class Saved { public int[] visited; public int[] secretsFound; public int[] joinsUnlocked; public string[] leversPulled; public string[] exitsFound; public int keysHeld; public bool keyTaken; }

        public string ToJson()
        {
            var s = new Saved { visited = ToArray(visited), secretsFound = ToArray(secretsFound), joinsUnlocked = ToArray(joinsUnlocked), leversPulled = ToArray(leversPulled), exitsFound = ToArray(exitsFound), keysHeld = keysHeld, keyTaken = keyTaken };
            return JsonUtility.ToJson(s);
        }

        /// <summary>Reads a JSON state; anything malformed leaves the state empty (never crash on bad data).</summary>
        public static FloorState FromJson(string floorId, string json)
        {
            var st = new FloorState(floorId);
            if (string.IsNullOrEmpty(json)) return st;
            try
            {
                var s = JsonUtility.FromJson<Saved>(json);
                if (s == null) return st;
                if (s.visited != null) foreach (var v in s.visited) if (v >= 0) st.visited.Add(v);
                if (s.secretsFound != null) foreach (var v in s.secretsFound) if (v >= 0) st.secretsFound.Add(v);
                if (s.joinsUnlocked != null) foreach (var v in s.joinsUnlocked) if (v >= 0) st.joinsUnlocked.Add(v);
                if (s.leversPulled != null) foreach (var v in s.leversPulled) if (!string.IsNullOrEmpty(v)) st.leversPulled.Add(v);
                if (s.exitsFound != null) foreach (var v in s.exitsFound) if (!string.IsNullOrEmpty(v)) st.exitsFound.Add(v);
                st.keysHeld = Mathf.Clamp(s.keysHeld, 0, 9);
                st.keyTaken = s.keyTaken;
            }
            catch (Exception) { return new FloorState(floorId); }
            return st;
        }

        public static FloorState Load(string floorId) => FromJson(floorId, PlayerPrefs.GetString(PrefPrefix + floorId, ""));

        public void Save()
        {
            PlayerPrefs.SetString(PrefPrefix + floorId, ToJson());
            PlayerPrefs.Save();
        }

        public static void Forget(string floorId) { PlayerPrefs.DeleteKey(PrefPrefix + floorId); PlayerPrefs.Save(); }

        static int[] ToArray(HashSet<int> s) { var a = new int[s.Count]; s.CopyTo(a); Array.Sort(a); return a; }
        static string[] ToArray(HashSet<string> s) { var a = new string[s.Count]; s.CopyTo(a); Array.Sort(a, StringComparer.Ordinal); return a; }
    }
}

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Gloamvault.Env
{
    /// <summary>
    /// A door that opens (Phase 13, D-146): a doorway piece's moving parts — a leaf that swings about its hinge, a
    /// gate that lifts, a secret panel that pushes back and slides — read from the part's name and the manifest's
    /// note (07 §2.2: wood "hinge animated", portcullis "lift animated", secret "slides aside", iron "swing", sluice
    /// "lifts", the Vault's secret "pivots"). Eased open over about half a second with the chest lid's curve; an open
    /// leaf's collider is off so the hero walks through.
    /// </summary>
    public sealed class Door : MonoBehaviour
    {
        public enum Motion { Swing, Lift, Slide }

        [Serializable]
        public sealed class Moving
        {
            public Transform part;
            public Motion motion;
            /// <summary>Radians for a swing (about the part's local y), metres for a lift (local y) or a slide (local x).</summary>
            public float amount;
            /// <summary>A secret panel pushes back this far (local −z) before it slides.</summary>
            public float push;
            public Quaternion restRotation;
            public Vector3 restPosition;
            public Collider collider;
        }

        public readonly List<Moving> parts = new();
        public bool IsOpen { get; private set; }
        public string meshId;
        /// <summary>A locked door needs its key (Phase 15 wires the key; the walk viewer leaves it unlocked).</summary>
        public bool locked;
        public const float EaseSeconds = 0.16f;
        float openness, target;

        /// <summary>Reads the piece's parts under this clone and decides each one's motion.</summary>
        public void Setup(Piece piece, Axes axes)
        {
            meshId = piece.id;
            parts.Clear();
            foreach (var p in piece.parts ?? Array.Empty<Part>())
            {
                var t = FindDeep(transform, p.name) ?? FindDeep(transform, p.part);
                if (t == null) continue;
                var m = Describe(p, axes);
                m.part = t;
                m.restRotation = t.localRotation;
                m.restPosition = t.localPosition;
                m.collider = t.GetComponent<Collider>();
                parts.Add(m);
            }
        }

        /// <summary>The motion by the part's name and note: gates lift, a Cellars secret panel slides, the rest swing.</summary>
        public static Moving Describe(Part p, Axes axes)
        {
            string name = (p.part ?? p.name ?? "").ToLowerInvariant();
            string note = (p.note ?? "").ToLowerInvariant();
            var m = new Moving();
            if (name.Contains("gate") || note.Contains("moves up") || note.Contains("rises") || note.Contains("position.y"))
            {
                m.motion = Motion.Lift;
                m.amount = note.Contains("2.6") ? 2.6f : 2.2f;
                return m;
            }
            if (note.Contains("slides") && note.Contains("along x"))
            {
                m.motion = Motion.Slide;
                m.push = 0.1f;
                m.amount = 2f;
                return m;
            }
            m.motion = Motion.Swing;
            // The angle from the note: "±1.75 rad", "−1.9 rad", "±100°", "−95°", "±1.57"; a mirrored x axis turns it the other way.
            float a = 1.6f;
            var rad = System.Text.RegularExpressions.Regex.Match(note, @"([−\-+±]?)\s*(\d+(?:\.\d+)?)\s*rad");
            var deg = System.Text.RegularExpressions.Regex.Match(note, @"([−\-+±]?)\s*(\d+(?:\.\d+)?)\s*°");
            if (rad.Success) a = float.Parse(rad.Groups[2].Value, System.Globalization.CultureInfo.InvariantCulture);
            else if (deg.Success) a = float.Parse(deg.Groups[2].Value, System.Globalization.CultureInfo.InvariantCulture) * Mathf.Deg2Rad;
            else { var any = System.Text.RegularExpressions.Regex.Match(note, @"[−\-+±]\s*(\d+(?:\.\d+)?)"); if (any.Success) a = float.Parse(any.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture); }
            bool negative = (rad.Success && (rad.Groups[1].Value == "−" || rad.Groups[1].Value == "-")) || (deg.Success && (deg.Groups[1].Value == "−" || deg.Groups[1].Value == "-")) || note.Contains("down to −") || note.Contains("down to -");
            // A right leaf swings the other way from its left twin.
            if (name.EndsWith("_r")) negative = !negative;
            m.amount = (negative ? -1f : 1f) * a * (axes != null ? axes.sx * axes.sz : 1f);
            return m;
        }

        static Transform FindDeep(Transform root, string name)
        {
            if (root.name == name) return root;
            foreach (Transform c in root) { var f = FindDeep(c, name); if (f != null) return f; }
            return null;
        }

        public void Open() { target = 1f; IsOpen = true; foreach (var m in parts) if (m.collider != null) m.collider.enabled = false; }
        public void Close() { target = 0f; IsOpen = false; }
        public void Toggle() { if (IsOpen) Close(); else Open(); }
        public string Prompt => locked ? "Locked" : IsOpen ? "Close" : "Open";
        public float Openness => openness;

        void Update()
        {
            if (Mathf.Abs(openness - target) < 0.0005f) { if (!IsOpen && openness <= 0.0005f) foreach (var m in parts) if (m.collider != null) m.collider.enabled = true; return; }
            openness = Mathf.Lerp(openness, target, 1f - Mathf.Exp(-Time.deltaTime / EaseSeconds));
            if (Mathf.Abs(openness - target) < 0.0005f) openness = target;
            Apply();
        }

        void Apply()
        {
            foreach (var m in parts)
            {
                switch (m.motion)
                {
                    case Motion.Swing:
                        m.part.localRotation = m.restRotation * Quaternion.AngleAxis(m.amount * Mathf.Rad2Deg * openness, Vector3.up);
                        break;
                    case Motion.Lift:
                        m.part.localPosition = m.restPosition + Vector3.up * (m.amount * openness);
                        break;
                    case Motion.Slide:
                        float back = Mathf.Clamp01(openness * 3f);
                        float along = Mathf.Clamp01((openness - 0.2f) / 0.8f);
                        m.part.localPosition = m.restPosition + Vector3.back * (m.push * back) + Vector3.right * (m.amount * along);
                        break;
                }
            }
        }
    }
}

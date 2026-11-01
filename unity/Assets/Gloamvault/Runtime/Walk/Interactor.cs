using System.Collections.Generic;
using Gloamvault.Env;
using Gloamvault.Level;
using UnityEngine;

namespace Gloamvault.Walk
{
    /// <summary>
    /// What A would do here (Phase 13, D-146): the nearest thing within its reach and roughly in front of the hero
    /// carries the prompt ("Open", "Pull", "Take the key", "Go down"); <see cref="Act"/> does it. Doors since
    /// Phase 13; levers, the key, secret panels and the exits since Phase 15 (<see cref="IInteractable"/>); chests,
    /// curios and the stairs' command join in Phase 17.
    /// </summary>
    public sealed class Interactor
    {
        public const float Reach = 1.6f;
        public const float FacingDot = 0.1f;
        /// <summary>A hidden panel wants the hero facing it squarely.</summary>
        public const float HiddenFacingDot = 0.6f;

        public IInteractable Nearest { get; private set; }
        public string Prompt => Nearest != null ? Nearest.Prompt : "";

        public void Update<T>(Transform hero, IReadOnlyList<T> things) where T : IInteractable
        {
            IInteractable best = null;
            float bestD = float.MaxValue;
            var at = hero.position;
            var fwd = hero.forward;
            foreach (var t in things)
            {
                if (t == null || (t is Object o && o == null) || !t.Available) continue;
                var to = t.Position - at; to.y = 0;
                float dist = to.magnitude;
                float reach = t is Door d ? d.Reach : t is Lever ? 2.0f : t is KeyPickup ? 2.0f : Reach + 1.2f;
                if (dist > reach) continue;
                float facing = t is Door dd && dd.hidden ? HiddenFacingDot : FacingDot;
                if (dist > 0.3f && Vector3.Dot(to / dist, fwd) < facing) continue;
                if (dist < bestD) { bestD = dist; best = t; }
            }
            Nearest = best;
        }

        public bool Act()
        {
            if (Nearest == null) return false;
            return Nearest.Act();
        }
    }
}

using System.Collections.Generic;
using Gloamvault.Env;
using UnityEngine;

namespace Gloamvault.Walk
{
    /// <summary>
    /// What A would do here (Phase 13, D-146): the nearest door within reach and roughly in front of the hero carries
    /// the prompt ("Open", "Close", "Locked"); <see cref="Act"/> does it. Chests, curios, levers and the stairs join
    /// through the same prompt in Phases 15–17.
    /// </summary>
    public sealed class Interactor
    {
        public const float Reach = 1.6f;
        public const float FacingDot = 0.1f;

        public Door Nearest { get; private set; }
        public string Prompt => Nearest != null ? Nearest.Prompt : "";

        public void Update(Transform hero, IReadOnlyList<Door> doors)
        {
            Door best = null;
            float bestD = float.MaxValue;
            var at = hero.position;
            var fwd = hero.forward;
            foreach (var d in doors)
            {
                if (d == null) continue;
                var to = d.transform.position - at; to.y = 0;
                float dist = to.magnitude;
                if (dist > Reach + 1.2f) continue;
                if (dist > 0.3f && Vector3.Dot(to / dist, fwd) < FacingDot) continue;
                if (dist < bestD) { bestD = dist; best = d; }
            }
            Nearest = best;
        }

        public bool Act()
        {
            if (Nearest == null || Nearest.locked) return false;
            Nearest.Toggle();
            return true;
        }
    }
}

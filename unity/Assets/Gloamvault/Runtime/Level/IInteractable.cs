using UnityEngine;

namespace Gloamvault.Level
{
    /// <summary>Anything A does something to (Phase 15, D-146): a door, a lever, the key, an exit; chests, curios and the stairs' command join in Phase 17.</summary>
    public interface IInteractable
    {
        /// <summary>Where it is, for reach and facing.</summary>
        Vector3 Position { get; }
        /// <summary>The word after "A ·" ("Open", "Pull", "Take the key", "Go down"); null or empty when it is hidden.</summary>
        string Prompt { get; }
        /// <summary>False while it cannot be seen or used from here (a secret panel not yet found, a lever already pulled).</summary>
        bool Available { get; }
        /// <summary>Does it; true when something happened.</summary>
        bool Act();
    }
}

using UnityEngine;

namespace Gloamvault.Env
{
    /// <summary>What a placed piece is (Phase 13): its meshId, its role in the layout, the side it stands on, so a walker can find doors and walls by name.</summary>
    public sealed class RoomPiece : MonoBehaviour
    {
        public string meshId;
        public RoomLayout.Role role;
        public string side;
        public bool low;
        public int placementIndex;
    }
}

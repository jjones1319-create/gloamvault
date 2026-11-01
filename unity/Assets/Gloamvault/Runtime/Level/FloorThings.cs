using System;
using Gloamvault.Env;
using UnityEngine;

namespace Gloamvault.Level
{
    /// <summary>The placeholder look of the things no kit has a piece for yet (D-166): one lit material each, built from primitives.</summary>
    static class FloorThingLook
    {
        static Material stone, iron, brass;
        public static Material Stone => stone ??= Make("Floor thing stone", new Color(0.36f, 0.33f, 0.30f));
        public static Material Iron => iron ??= Make("Floor thing iron", new Color(0.22f, 0.22f, 0.25f));
        public static Material Brass => brass ??= Make("Floor thing brass", new Color(0.85f, 0.65f, 0.25f));

        static Material Make(string name, Color c)
        {
            var sh = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Universal Render Pipeline/Unlit");
            var m = new Material(sh) { name = name };
            m.SetColor("_BaseColor", c);
            m.SetFloat("_Smoothness", 0.2f);
            return m;
        }

        public static GameObject Box(Transform parent, string name, Vector3 centre, Vector3 size, Material m)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = centre;
            go.transform.localScale = size;
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
            UnityEngine.Object.Destroy(go.GetComponent<Collider>());
            return go;
        }
    }

    /// <summary>A lever that lifts a portcullis (Phase 15, D-146): a stone post with an iron handle; A pulls it once.</summary>
    public sealed class Lever : MonoBehaviour, IInteractable
    {
        public string id;
        public int opensJoin;
        public bool Pulled { get; private set; }
        public event Action<Lever> OnPulled;
        Transform handle;
        float swing;

        public Vector3 Position => transform.position;
        public string Prompt => Pulled ? "Pulled" : "Pull";
        public bool Available => !Pulled;

        public static Lever Place(Transform parent, Vector3 at, string id, int opensJoin, bool alreadyPulled)
        {
            var go = new GameObject("Lever " + id);
            go.transform.SetParent(parent, false);
            go.transform.position = at;
            FloorThingLook.Box(go.transform, "post", new Vector3(0, 0.45f, 0), new Vector3(0.36f, 0.9f, 0.36f), FloorThingLook.Stone);
            FloorThingLook.Box(go.transform, "cap", new Vector3(0, 0.93f, 0), new Vector3(0.44f, 0.06f, 0.44f), FloorThingLook.Stone);
            var pivot = new GameObject("pivot").transform;
            pivot.SetParent(go.transform, false);
            pivot.localPosition = new Vector3(0, 0.96f, 0);
            FloorThingLook.Box(pivot, "handle", new Vector3(0, 0.35f, 0), new Vector3(0.06f, 0.7f, 0.06f), FloorThingLook.Iron);
            FloorThingLook.Box(pivot, "knob", new Vector3(0, 0.72f, 0), new Vector3(0.12f, 0.12f, 0.12f), FloorThingLook.Brass);
            var bc = go.AddComponent<BoxCollider>();
            bc.center = new Vector3(0, 0.5f, 0); bc.size = new Vector3(0.5f, 1.0f, 0.5f);
            var l = go.AddComponent<Lever>();
            l.id = id; l.opensJoin = opensJoin; l.handle = pivot;
            l.Pulled = alreadyPulled;
            l.swing = alreadyPulled ? 1f : 0f;
            l.Apply();
            return l;
        }

        public bool Act()
        {
            if (Pulled) return false;
            Pulled = true;
            GvLog.Line("lever", ("id", id), ("opens", opensJoin));
            OnPulled?.Invoke(this);
            return true;
        }

        void Update()
        {
            float target = Pulled ? 1f : 0f;
            if (Mathf.Abs(swing - target) < 0.001f) return;
            swing = Mathf.Lerp(swing, target, 1f - Mathf.Exp(-Time.deltaTime / 0.14f));
            Apply();
        }

        void Apply() { if (handle != null) handle.localRotation = Quaternion.Euler(Mathf.Lerp(-40f, 40f, swing), 0, 0); }
    }

    /// <summary>The floor's key where the layout says it lies (Phase 15): A takes it; the locked doors open to it.</summary>
    public sealed class KeyPickup : MonoBehaviour, IInteractable
    {
        public bool Taken { get; private set; }
        public event Action<KeyPickup> OnTaken;
        float bob;

        public Vector3 Position => transform.position;
        public string Prompt => "Take the key";
        public bool Available => !Taken;

        public static KeyPickup Place(Transform parent, Vector3 at)
        {
            var go = new GameObject("Key");
            go.transform.SetParent(parent, false);
            go.transform.position = at;
            FloorThingLook.Box(go.transform, "bow", new Vector3(0, 0.6f, 0), new Vector3(0.16f, 0.16f, 0.04f), FloorThingLook.Brass);
            FloorThingLook.Box(go.transform, "shaft", new Vector3(0.14f, 0.6f, 0), new Vector3(0.22f, 0.05f, 0.04f), FloorThingLook.Brass);
            FloorThingLook.Box(go.transform, "bit", new Vector3(0.22f, 0.54f, 0), new Vector3(0.06f, 0.1f, 0.04f), FloorThingLook.Brass);
            var k = go.AddComponent<KeyPickup>();
            return k;
        }

        public bool Act()
        {
            if (Taken) return false;
            Taken = true;
            GvLog.Line("key", ("taken", true));
            OnTaken?.Invoke(this);
            Destroy(gameObject);
            return true;
        }

        void Update()
        {
            bob += Time.deltaTime;
            transform.localRotation = Quaternion.Euler(0, bob * 60f, 0);
            var p = transform.localPosition; p.y = Mathf.Sin(bob * 2f) * 0.05f; transform.localPosition = p;
        }
    }

    /// <summary>
    /// A way in or out (Phase 15, D-151): the entrance arch, the stairs down, a side exit found from inside. A gives the
    /// prompt its verb; what using it means (leaving the delve, the next floor) arrives with the delve's rules and the
    /// saves (Phases 21–22) — here it is logged, marked found and told in a line.
    /// </summary>
    public sealed class ExitSpot : MonoBehaviour, IInteractable
    {
        public FloorExitDef def;
        public bool Found { get; private set; }
        public event Action<ExitSpot> OnUsed;

        public Vector3 Position => transform.position;
        public string Prompt => def.kind == "stairs" ? "Go down" : def.kind == "entrance" ? "Leave the keep" : def.name.Contains("rope") ? "Climb out" : "Squeeze through";
        public bool Available => true;

        public static ExitSpot Place(Transform parent, Vector3 at, FloorExitDef def, bool found)
        {
            var go = new GameObject("Exit " + def.id);
            go.transform.SetParent(parent, false);
            go.transform.position = at;
            var e = go.AddComponent<ExitSpot>();
            e.def = def; e.Found = found;
            return e;
        }

        public bool Act()
        {
            Found = true;
            GvLog.Line("exit", ("id", def.id), ("kind", def.kind), ("name", def.name));
            OnUsed?.Invoke(this);
            return true;
        }
    }
}

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Playables;

namespace Gloamvault.Characters
{
    /// <summary>
    /// Plays a character's clips (Phase 12): a PlayableGraph with a two-slot mixer on the character's Animator, so a
    /// clip can be started by name — through the character's aliases (a monster's Walk → Move, Attack_Light →
    /// Attack1 …) — with a short crossfade, at a speed, and started early so an event (hit, release) lands on a cue
    /// (the web's 0.12 s lead). Clips come from the hero clips file or the monster base's own.
    /// </summary>
    public sealed class CharacterAnimator : MonoBehaviour
    {
        public const float StrikeLeadSeconds = 0.12f;

        readonly Dictionary<string, AnimationClip> clips = new();
        readonly Dictionary<string, string> aliases = new();
        readonly Dictionary<string, ClipInfo> infos = new();
        PlayableGraph graph;
        AnimationMixerPlayable mixer;
        AnimationClipPlayable[] slots = new AnimationClipPlayable[2];
        int current = -1;
        float fade, fadeTime = 0.12f;
        public float speed = 1f;
        public string Current { get; private set; }
        public bool Ready => graph.IsValid();

        public void Setup(Animator animator, IEnumerable<AnimationClip> available, IEnumerable<ClipInfo> clipInfos, IDictionary<string, string> clipAliases = null)
        {
            // A take imported as "Rig|Idle" is the clip Idle.
            foreach (var c in available)
            {
                if (c == null) continue;
                string n = c.name;
                int bar = n.LastIndexOf('|');
                clips[bar >= 0 ? n.Substring(bar + 1) : n] = c;
            }
            if (clipInfos != null) foreach (var i in clipInfos) infos[i.name] = i;
            if (clipAliases != null) foreach (var kv in clipAliases) aliases[kv.Key] = kv.Value;
            graph = PlayableGraph.Create(gameObject.name + " clips");
            graph.SetTimeUpdateMode(DirectorUpdateMode.GameTime);
            var output = AnimationPlayableOutput.Create(graph, "Animation", animator);
            mixer = AnimationMixerPlayable.Create(graph, 2);
            output.SetSourcePlayable(mixer);
            graph.Play();
        }

        public bool Has(string name) => Resolve(name) != null;
        public IEnumerable<string> ClipNames => clips.Keys;

        AnimationClip Resolve(string name)
        {
            if (name == null) return null;
            if (clips.TryGetValue(name, out var c)) return c;
            if (aliases.TryGetValue(name, out var alias) && clips.TryGetValue(alias, out c)) return c;
            return null;
        }

        /// <summary>Starts a clip; `leadToEvent` names an event (hit, release) the clip is wound to, minus the lead.</summary>
        public bool Play(string name, string leadToEvent = null, float crossfade = 0.12f)
        {
            var clip = Resolve(name);
            if (clip == null || !graph.IsValid()) return false;
            string resolved = clip.name;
            int rbar = resolved.LastIndexOf('|');
            if (rbar >= 0) resolved = resolved.Substring(rbar + 1);
            infos.TryGetValue(resolved, out var info);
            float start = 0f;
            if (leadToEvent != null && info?.events != null)
                foreach (var e in info.events) if (e.name == leadToEvent) { start = Mathf.Max(0f, e.seconds - StrikeLeadSeconds * (info.speed > 0 ? info.speed : 1f)); break; }
            int next = (current + 1) % 2;
            if (slots[next].IsValid()) { mixer.DisconnectInput(next); slots[next].Destroy(); }
            slots[next] = AnimationClipPlayable.Create(graph, clip);
            slots[next].SetApplyFootIK(false);
            slots[next].SetTime(start);
            slots[next].SetSpeed((info?.speed > 0 ? info.speed : 1f) * speed);
            if (!clip.isLooping && !(info?.loop ?? false)) slots[next].SetDuration(clip.length);
            mixer.ConnectInput(next, slots[next], 0, current < 0 ? 1f : 0f);
            if (current >= 0) mixer.SetInputWeight(current, 1f);
            current = next;
            Current = resolved;
            fadeTime = Mathf.Max(0.01f, crossfade);
            fade = current >= 0 && slots[(current + 1) % 2].IsValid() ? 0f : 1f;
            return true;
        }

        void Update()
        {
            if (!graph.IsValid() || current < 0) return;
            // A clip that clips.json loops wraps by hand when the import left it one-shot.
            if (slots[current].IsValid() && infos.TryGetValue(Current ?? "", out var info) && info.loop)
            {
                var clip = slots[current].GetAnimationClip();
                if (!clip.isLooping && clip.length > 0 && slots[current].GetTime() >= clip.length - 0.001f)
                    slots[current].SetTime(info.loopStart);
            }
            if (fade < 1f)
            {
                fade = Mathf.Min(1f, fade + Time.deltaTime / fadeTime);
                mixer.SetInputWeight(current, fade);
                int other = (current + 1) % 2;
                if (slots[other].IsValid()) mixer.SetInputWeight(other, 1f - fade);
            }
        }

        public double Time01()
        {
            if (current < 0 || !slots[current].IsValid()) return 0;
            var clip = slots[current].GetAnimationClip();
            return clip.length > 0 ? (slots[current].GetTime() % clip.length) / clip.length : 0;
        }

        void OnDestroy()
        {
            if (graph.IsValid()) graph.Destroy();
        }
    }
}

# 01 — Vision

*Last updated 2026-10-27 · rev. 2 (checkpoint 1: open questions answered by delegation — D-099) · rev. 1 2026-10-26 (Claude, from James's brief). Working title **Gloamvault** (D-001).*

## The pitch

Four friends, one phone each, a torch, and a keep that sank into its own catacombs. **Gloamvault** is a party dungeon crawler for Android where every number on your sheet does what it says: a faster hero acts more often, a perceptive one sees the trap first, and a sword you have carried for forty floors remembers the ghouls it has killed. You delve, you fight on a speed timeline, you come back to Emberfall to repair, upgrade, learn and open chests — and everything you used on the way down is a little better than it was.

## Pillars

1. **Stats you can feel.** Speed is turns on the timeline strip. Perception is the trap that lights up before you step on it, the ambush that doesn't happen. Strength is the greatsword you can swing without slowing down. If a stat's effect can't be seen on screen within a floor, it is the wrong stat.
2. **Everything grows by use.** Skills, attributes, weapons, armor, pets, field skills. No point-placing after creation, no grinding on walls — only meaningful actions against things that can hurt you.
3. **Care for your things.** Gear wears; neglected gear breaks; repaired, upgraded, promoted gear outlasts fresh finds. The blacksmith is the most visited door in town.
4. **Better together, fine alone.** One to four players; grouped decision windows so nobody waits; a pet beside every hero; solo is a complete game, not a demo.
5. **Readable on a phone.** Landscape, one thumb for a fight, fixed cameras, big silhouettes, a floor in a coffee break, a delve in an evening.

## Audience

James and his friends first; then anyone who liked Darkest Dungeon's expeditions, Shattered Pixel Dungeon's floors, Diablo's loot and the LitRPG status screen, and wants that with friends on a phone. No stamina timers, no purchases, no ads.

## References (what we take, not what we copy)

- **Darkest Dungeon** — the light meter, curios, the hamlet loop. **Shattered Pixel Dungeon** — five-floor zones, secrets that reward never gate, perception as a radius. **Slay the Spire** — the deterministic floor generator. **Hades** — door previews and the Pact menu. **Baldur's Gate 3 / Wildermyth** — grouped allied turns. **Tales of Maj'Eyal / Caves of Qud / DCSS** — speed as an energy queue. **Diablo 2/3** — durability, elite affixes, revive budgets. **Dark Cloud / Vagrant Story** — weapons that grow. **RuneScape / Terraria** — material ladders. **Romancing SaGa** — sparking skills in battle. **Monster Hunter** — one buddy per player, materials from parts. **Project Ascend** (ours) — the eight attributes, the eleven slots, the shared-rig Blender build, the deterministic sim pattern. **Wildsong Ranch** (ours) — the PWA-on-GitHub-Pages path to the phone, content as data, the audio engine, the pet lineage that will cross over.

## Tone

Grim places, warm people. The dungeon is wet stone, bone and brass under torchlight; the town is lamplight, a forge and a bar. Humour comes from the party and the town's cast, never from the monsters. Text is short, plain and in the second person. No gore close-ups; death is a fall and a fade.

## Art direction (summary; `11-ART-PIPELINE.md` has the pipeline)

**Chunky stylized 3D** on a shared humanoid rig: toon-ramped flat colours, thin outlines, bright separated palettes per species, class and monster family, emissive element and tier trims. Species are bodies (shape keys, bone scales, parts); classes are gear sets with every one of the eleven slots visible on the body; tiers F → God are the same meshes with richer trims and, at the top, light. Rooms are modular kits with baked light and two live torches. Cameras are fixed and cinematic; the viewer never zooms past the duel close-up.

## What this game is not

Not an action RPG (no joystick), not a gacha for money (chests cost dungeon gold only), not consequence-free (under the default **Mortal** rule a hero who dies stays dead unless raised — D-088; **Sheltered** is the gentle choice and **Nightmare** the one where your chosen hero's death ends the save — D-095), not a live-service (no server state), not realistic (stylized, readable).

## Names (D-001; James can rename at checkpoint 1)

Game: **Gloamvault**. Town: **Emberfall**. Dungeons: **Gravehollow Keep**, **The Fungal Deep**, **Emberforge**, **Frostmarch Citadel**. Classes: Warden, Blade, Ranger, Shade, Arcanist, Mender, Beast Tamer. Species: Human, Dwarf, Elf, Orc, Halfling, Draconid.

**Open questions**
1. ~~Names — keep, or James's own?~~ *Checkpoint 1 (D-098): keep them — every name above stays.*
2. ~~Tone: how dark is too dark for the friends' table? (Proposed: PEGI 12 / Teen — fantasy violence, no gore.)~~ *Checkpoint 1 (D-099): PEGI 12 / Teen, as proposed — fantasy violence, no gore, death a fall and a fade.*

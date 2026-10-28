# 14 — Ideas backlog

*Last updated 2026-10-27 · rev. 2 (checkpoint 1: a seventh species waits here, Revenant first — D-099) · rev. 1. Things not in the design yet. Each has a one-line why and the phase it could join. Promote an idea by writing it into the owning doc and logging a decision.*

## A. Wildsong Ranch crossover (James's stated future; Phase 11 does the first half)

- **Ranch Shrine at the Stables (Phase 11).** Paste a Wildsong Ranch share code (its `src/save/shareCode.ts` format; QR too) → the monster becomes a Gloamvault pet: map `LIF→HP, POW→Attack, DEF→Defense, SPD→Speed, INT→spell Attack/Mend strength, SKI→Accuracy/Crit`, normalised onto the nearest grade's budget (**never above A** on import; SS/God stay dungeon-only), keep its name and breed look as a palette on the nearest pet base mesh, tag **Ranch-raised** with a unique trait slot filled from its Wildsong techniques (one active mapped by family: Fire → Fierce burst, Water → Mend, Earth → Guard, Wind → Forage/Speed). One-way; the ranch owns breeding and lifespan.
- **Two-way sync (later).** A Gloamvault pet's level and bond export back as a Wildsong "Journey" result; a Gloamvault boss kill as a Wildsong title. Needs an agreed envelope format in both repos.
- **Shared origin shortcut.** Both games sit on `jjones1319-create.github.io`; an "Import from Wildsong Ranch on this phone" button could read `wildsong/` keys directly (same origin). Only if the share-code route proves clunky.

## B. Classes and species

- **Oracle** (support: buffs, pool drain/restore, timeline control) — Ascend's seventh Path; a natural eighth class after the Beast Tamer.
- **Monk / Brawler** (unarmed, Stamina-heavy, light-weight everything) — the most distinct weapon profile left.
- **Revenant** (undead species: potions do nothing, Shadow heals, immune Bleed/Poison, Holy weakness) and **Beastkin** (claws, scent = Detection, Fear-prone) — `05-SPECIES.md` open question 8; at checkpoint 1 a seventh species went to this post-launch backlog, **Revenant first** if one is made (D-099).
- **Species sub-variants** by palette and parts (hill/mountain Dwarf; wood/high Elf) — cheap once the shape-key pipeline exists.

## C. Dungeon and systems

- **Frostmarch Citadel** built (designed in Phase 11; build after launch) — Dragon Scale at SS, the Pale Dragon, the Cold mechanic.
- **Secret Realms / weekly challenge seeds** — one shared seed per week, a leaderboard of clear time kept locally and shared by code (no server).
- **Asynchronous help** — Shiren-style: a wiped party leaves a "ghost" marker in a friend's run (shared by code) that a friend can rescue for a reward.
- **Hired companions** (Phase 11): an AI hero from a short roster for solo players, paid per delve.
- **Town upgrades** — spend gold on the Blacksmith (cheaper repairs), the Inn (a fourth loadout preset), the Stables (bond faster): Darkest Dungeon's hamlet permanence.
- **Cosmetics from titles** — a cloak or a trim per title; purely visual, earned, never bought.
- **Beast Arena** — pets fight pets at the Stables for bond stars (Ascend `08` C4).
- **Pact ladder seasons** — monthly rotating Pacts with a badge.
- **Crafting mini-game** for Masterwork-quality promotions (Ascend §7.3's 10–20-second forge sequence) — only if promotion feels too flat.

## D. Tech

- **WebGPU renderer** behind a flag once three.js's WebGPU path is stable on Chrome Android — more headroom for Frostmarch's particles.
- **KTX2/Basis textures** and Draco meshes if load times on the phone exceed 3 s per zone.
- **Cloud backup** — a tiny Cloudflare Worker KV store keyed by a code the player keeps (no accounts). Only if local backups prove insufficient.
- **Play Store listing** (TWA/PWA or Capacitor) — the odds screen and privacy note already satisfy the policies.
- **Steam Deck / desktop** — the same web build runs in a browser; a keyboard map is a day's work.

## E. Art

- **Commissioned heads** for the six species once the pipeline is proven (`11` §10) — the one step a script will not reach.
- **Animated portraits** in dialogue (the base-mesh heads have mouths and eyes; a few shape keys).
- **Monster part-break visuals** — the limb actually falls off (the part-break mechanic exists; the mesh split is art work).

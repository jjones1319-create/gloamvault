# 11 — Art Pipeline (Blender → glTF → three.js)

*Last updated 2026-10-29 · rev. 5 (Phase 8, pass C: the emblem and splash, shaders compiled before showing, bosses framed at phone size, the Vigil's doors, pets' Attack2 — §13) · rev. 4 (Phase 6: the rooms, monsters and effects as built — §12; kits with baked AO replace §5's lightmaps, effects generated in code replace §6's flipbooks — D-110–D-117) · rev. 3 (Phase 5: the hero pipeline as built — §11; the palette replaces the mask textures of §2, D-100–D-109) · rev. 2 (checkpoint 1: open questions answered by delegation — D-099) · rev. 1 2026-10-26 (Claude). Decision D-019. The sister project's `prototype/blender/shade/` (ProjectAscend) is the proven ancestor of this pipeline: scripted, headless, re-runnable, reviewed by looking at renders; its `LOG.md` lists honestly what a script can and cannot reach. This document keeps what worked and fixes what didn't.*

## 1. The look (style guide)

James asked for good quality. A script cannot sculpt like an artist, so the style is chosen to be **reachable by a script and good on a phone**:

- **Chunky stylized**: simplified anatomy, strong silhouettes, slightly oversized hands, feet, weapons and helmets (they must read at 200 px); no realism.
- **Flat-ramped toon shading** (4-step ramp from a white diffuse, base colour multiplied in — the Shade round-2 fix) with a **thin dark outline** (inverted hull, ~5 mm at 1.8 m scale), emissive **element and tier trims** (F grey → God white-gold), and painted **tint masks** so one mesh serves every palette.
- **Bright, separated palettes.** Ascend's Shade ended "dark on dark"; here every character has three readable colours plus a metal, and every monster family has a signature hue (Cellars warm browns and rust, Crypts bone-white and sickly green, Vault teal and brass). Skin tones never share a value with armor.
- **Fixed cinematic cameras** in rooms and a minimum distance in the viewer (Ascend D-068): the face budget is the duel close-up, never a screen-filling portrait.
- **Environments** are kit-based: ~10 shared pieces + ~22 per zone (`07-DUNGEONS.md` §2), low-poly with baked lighting, fog and two dynamic torches.

## 2. One rig, many bodies, modular gear

- **The rig** is a plain deform skeleton with **Unity-Humanoid / Mixamo bone names** (`Hips, Spine, Chest, UpperChest, Neck, Head, Left/RightShoulder, UpperArm, LowerArm, Hand`, 15 finger bones per hand, `UpperLeg, LowerLeg, Foot, Toes`) plus optional chains the species add (`Tail_01..04`, `Ear_L/R`, `Beard_01..02`, `Hair_*`, cape panels). ≤ 70 deform bones, A-pose rest, +Y up on export, every bone's local Z forward (the Shade's convention, so its pose dictionaries port). Built by script from a table of joint positions — no Rigify in the runtime rig (Rigify's control rig can be used while *authoring* clips; only deform bones export).
- **Bodies.** Start from Blender's official **Human Base Meshes** bundle (CC0 — stylized male/female with real eye sockets, mouths, ears, quad topology; the Shade's LOG called it "the safer licence" and the cleaner head). One shared topology; the six species are **shape keys + bone scales + species parts** (`05-SPECIES.md` §4 names them: `spc_dwarf_broad`, `spc_elf_lean`, tail/ear/tusk/beard/horn meshes, per-bone scale within ±15%). A procedural fallback body (the Shade's loft builder, `shade_lib.py`) stays available for silhouette tests.
- **Gear** is one mesh per slot, skinned to the same skeleton (Chest, Legs, Gloves, Boots, Helmet, Robes) or bone-parented rigid props (weapons, shields, rings, talisman, relic, quiver, lantern). Each piece carries the **same shape keys** as the body for the species it must fit, or a species variant where the brief says so (Draconid tail cut-out, Halfling scale 0.8, Dwarf helmet width). Body polygons under armor are hidden by per-slot body masks (vertex groups) so nothing clips.
- **Tiers** reuse meshes: F → S is the same gear set with material/trim changes and, from A up, one extra silhouette piece (a pauldron, a crest). God sets get a unique glow and a particle.
- **Tints** are instance parameters in three.js (`tint_primary`, `tint_secondary`, `metal`, `element`) read through an RGB mask texture — one material per family, no material duplication.

## 3. Animation

Authored once on the shared rig, retargeted by name (three.js `SkeletonUtils.retarget` or simply shared clips because the bone names and rests are identical). The shared set, 30 fps:

`Idle` (loop) · `Walk` (loop) · `Run` (loop) · `Attack_Light` · `Attack_Heavy` · `Attack_Dual` · `Shoot` · `Cast` (charge + release markers) · `Guard` · `Hit` · `Dodge` · `Downed` · `Revive` · `Victory` · `Defeat` · `Interact` · `SitRest` · species specials `Breath` (Draconid), `Roar` (Orc) · class flourishes per Ultimate (7).

Event frames (hit, vanish, release) are listed in each clip's docstring and exported as a sidecar `clips.json` the client reads. Mixamo clips may be used as **motion reference** only (retargeted onto our rig by script; never redistributed raw).

## 4. Monsters

`06-MONSTERS.md` §3.5 maps Dungeon 1's 35 monsters, 3 hunters and 4 bosses onto **14 base meshes** — `rat`, `spider`, `humanoid` (the hero rig with bandit, cult and crone costume sets), `hound`, `skeleton`, `zombie`, `bat`, `wraith`, `wisp`, `tentacle`, `sentinel`, `ooze`, `leech`, `hollow-king` (unique: humanoid rig + throne + chain rig) — with the Barrow Warden and the other bosses as scaled, re-dressed variants with unique parts. Each base is a `build_<base>.py` with a `VARIANTS` table (scale, parts on/off, palette, extra bones) so a variant is a re-run, not a new model. Budgets: fodder 2–4k tris, elite 4–6k, monster 6–8k, boss 8–12k; quadruped and non-humanoid rigs are small custom chains (the Shade's fox rig is the pattern). *As built: §12 (D-111, D-115).*

## 5. Environments

Per zone: a **kit** of pieces (`07-DUNGEONS.md` §2 lists them with tri budgets), a **palette**, **lighting** baked in Blender (Cycles bake of AO + a lightmap atlas per room template, 2048², headless), fog and torch sprites added in the client. Room **templates** (`07` §2) are `.glb` assemblies built from the kit by script from a JSON description (so the generator's template ids and the Blender builds share a source). Props that repeat (torches, chains, rubble, bones) are separate `.glb`s instanced in three.js. *As built: §12 — kit pieces with ambient occlusion baked into the vertex colours, no lightmaps (D-110, D-114).*

## 6. VFX

Element marks, hits, heals and Ultimates: **sprite flipbooks baked in Blender** (Mantaflow fire/smoke/water, or shader-animated planes rendered to PNG sheets — Wildsong Ranch's bake pattern) plus client-side additive planes and a cheap bloom. ≤ 1 MB per flipbook, lazy-loaded. *Superseded: the effects are generated in code (§12, D-112).*

## 7. Scripts, folders, commands

```
tools/blender/
  lib/            rig.py (bone table, humanoid names), mesh.py (lofts, mirrors, masks — port of shade_lib.py),
                  toon.py (materials, ramp, outline), export.py (glb per slot, validation), render.py (review set)
  hero/           build_body.py (species shape keys + parts), build_gear_<class>.py (one per class set),
                  build_clips.py (the shared animation set), run.ps1
  monsters/       build_<base>.py (VARIANTS table), run.ps1
  env/            build_kit_<zone>.py, build_templates.py (from content/dungeons/<dungeon>/templates/<id>.json), bake.py
  vfx/            bake_<effect>.py
art/              renders/ (review PNGs, history/), ref/ (CC0 base meshes, palettes), LOG.md
client/public/models/   the exported .glb (+ clips.json, masks), by asset id
```

Windows, headless (`run.ps1` wraps these):

```powershell
$B = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
& $B -b -P tools/blender/hero/build_body.py -- --species dwarf --out art/build/body_dwarf.blend
& $B -b art/build/body_dwarf.blend -P tools/blender/lib/render.py -- --set card,turntable,ortho,gear,poses --out art/renders/dwarf
& $B -b art/build/body_dwarf.blend -P tools/blender/lib/export.py -- --out client/public/models/hero
```

Blender 5.2 LTS notes (research §5): slotted actions — assign a slot when assigning an action; stash every clip on a muted NLA track before export (`ACTIONS` mode exports only active or stashed actions); `export_def_bones=True`, 4 influences, `export_yup=True`, apply modifiers, remove the outline hull on export; `.vrm` heads need the VRM add-on — the CC0 bundle head needs nothing.

## 8. The review loop (the rule that makes quality possible)

Every build round ends with renders **and Claude Code looks at them** before calling anything done:

1. `card_view.png` (the phone card at 1024) **and** `card_view_200.png` (the 200-px read) — does the silhouette say what the brief says it must?
2. `turntable_000..023.png` — proportions from every side; `ortho_sheet.png` — against the species ratios in `05-SPECIES.md`.
3. `head.png`, `hands.png`, `face_measure.png` — the nine face ratios (Ascend's `face_measure.py`: eye width ≈ ⅕ face, one eye-width between eyes, eyes at ½ crown→chin …) printed as numbers, fixed as numbers.
4. `gear_sheet.png` — every slot shown and hidden; `pose_*.png` — one frame per clip at its hit frame; `joints_*.png` — elbows and knees at 90°, no collapse.
5. `reimport_check.png` — the exported `.glb` re-imported into a clean scene and rendered: all clips present, all slots skinned.
6. In the client: `npm run shots` renders the same character in the viewer and in a room at phone resolution.

Defects go in `art/LOG.md` as a numbered list with the fix, round by round (the Shade's LOG format). Lessons already paid for: drive the toon ramp from light, not the lit colour · hoods and capes need rows that hug and gather, not slabs · hair roots under the cap, no end caps · eyes are layered almonds whose white shows only as slivers, not rings · when James says "the eye", ask for a marked-up image before touching anything · dark palettes vanish at 200 px.

## 9. Acceptance bar per asset

| Asset | Must pass |
|---|---|
| Species body | reads as its species at 200 px with no gear; ortho ratios within 5% of the brief; all 17 clips re-import; ≤ 12k tris naked |
| Class gear set | every slot reads at 200 px; F and S variants distinguishable at 200 px; fits all six bodies without clipping in Idle/Run/Attack_Heavy; ≤ 15k tris hero + gear |
| Monster | role readable (fodder small and many, elite armored, special with its disabler visible, monster big) at the room camera; palette within the family hue; ≤ budget; Idle/Move/Attack1/Attack2/Hit/Death present |
| Room template | doors meet on the grid; lightmap baked; camera framing shows hero marks and enemy marks; ≤ 40k tris, ≤ 40 draw calls (the same bar as `07` §2.2) |
| VFX | ≤ 1 MB, reads at 1× speed, no white flash |

## 10. What a script will not reach (say it early)

Faces with character, folds in cloth, hair that is not clumps, and anything that must look *drawn* rather than *built*. The plan reaches "good stylized game art that reads on a phone"; the step beyond is an artist's pass on the same rig and slot split — the pipeline is designed so that pass replaces meshes without touching code. `art/LOG.md` keeps the honest list, as Ascend's does.

## 11. As built in Phase 5 (2026-10-28)

The heroes are built, reviewed and exported; `tools/blender/README.md` is the contract the scripts follow and
`art/LOG.md` the round-by-round history (round 1 plus every pass's rounds). What changed from the plan above:

- **Two body frames on one topology** (D-100): the CC0 bundle's stylized male and female bodies share one mesh, so they
  are the **broad** (1.794 m) and **slight** (1.613 m) frames — decimated once to 10.5k triangles with the eyes, the slight
  shape bound to the full mesh's triangles. Both carry the five species keys and twelve face keys (`build_species.py`).
- **The rig** (D-102): 65 bones placed by plane cuts on the full mesh (each joint the centre of the loop a cut makes around
  a limb; fingers walked to their webs; the thumb found as the loop in front of them), the same loops on both frames;
  bone-heat weights; 8 sockets. Bone scales are absolute (each bone = root × its group factor).
- **The palette** (D-101) replaces §2's RGB mask textures and `10` §4's "~12 calls per hero": one COLOR_0 attribute
  (16 palette slots, 10 body regions); the client bakes the species and face morphs at assembly, drops body triangles the
  gear covers and merges body, parts, gear and weapons into **one skinned mesh = 1 draw call + 1 for the outline**.
- **Parts**: 30 per frame — six hair styles, three brows, four beards (`beard_tuck` for cheek-guard helms), braids, two
  Elf ears, Orc ears, three tusk sizes, a topknot, Halfling feet and curls, the Draconid tail, three horn sets, crest and
  claws; 18 face presets in `client/public/models/hero/manifest.json`. Ears that a species does not have are folded flat by
  its key, so no body region has to be hidden for them.
- **Gear** (D-103): six class sets (Warden, Blade, Ranger, Shade, Arcanist, Mender), five pieces each in tier **F** and
  **S** (+ the Shade's half-cloak and knife handles), built from the body (pushed faces, plane-cut hems, bound free
  geometry) so they fit both frames and every species key; each set ≤ 4.5k triangles; `hides` per piece.
- **Weapons**: 46 rigid meshes (every `weaponType` in F and S, three shield types, a quiver with two fills), grip at the
  origin, blade along +Y (`weapons.glb`, 632 KB).
- **Clips**: the 17 + 2 of §3 plus **`Guard_Shield`** (20 in `hero_clips.glb`, 1.1 MB; events in `clips.json`). The
  client keeps only the rotation tracks and the Hips position (scaled by the hero's hips height).
- **Budgets met**: a dressed hero is 9.1k–11.0k triangles; a four-hero fight 25 draw calls and ~81k triangles (desktop
  Chrome; the phone numbers are on James's checklist). Exports: `hero_{broad,slight}.glb` 1.3 MB each, gear 0.6–0.8 MB
  per class and frame — runtime-cached with a content hash in the URL (D-108).
- **Review renders** are written full size to `art/renders/` (local) and curated to `art/review/` as JPEGs (D-109).
- **What a script did not reach** (§10, honest list in `art/LOG.md`): faces are 2–8 mm keys without freckles, scars or
  painted brows; the Draconid has no slit pupils or scale texture; hair is shells and chunky locks; cloth has no sway
  (no cape bones yet); poses are keyframed tables without secondary motion; the shoulders pinch when an arm rises above
  the head; a few species variants the class sheets ask for (Draconid hood-down, Orc wider mask, Dwarf short hem, tail
  splits in coats) are not built — the client hides horns and ears under helmets instead.

## 12. As built in Phase 6 (2026-10-28)

The rooms, the monsters and the effects are built; `art/LOG.md` has every pass's rounds and the lead's review in the
game, `tools/blender/README.md` → *Phase 6* the contract. What changed from §4–§6:

- **Rooms are kit pieces with ambient occlusion in the vertex colours, not per-room lightmaps** (D-110, D-114).
  `tools/blender/env/` builds four kits from `07` §2.2 — shared (12 pieces), Cellars (40), Crypts (41), Vault (35) —
  each one rigid `.glb` (`kit_shared` 187 KB, `kit_cellars` 623 KB, `kit_crypts` 432 KB, `kit_vault` 493 KB) with a
  manifest (`client/public/models/env/<zone>.json`: the palette, the shell pieces by state, mounts, lights, fx points,
  moving parts with pivots, floor holes, door skins). COLOR_0 is R = the zone's palette slot, G = weathering, B = Cycles
  AO baked per piece; slot 15 is water, translucent by its vertex alpha. There are no textures, so joints, flagstones and
  bricks are geometry. The client builds a room's floor, walls and doorways from the template's footprint and doors (the
  camera side from cut-away pieces), places the props by the template, merges the statics and instances the repeats.
- **Lighting** is the baked AO + a hemisphere + two point lights at the flames nearest the party + the zone's fog,
  scaled by the light meter; no shadows and no lightmaps (D-116).
- **Monsters** (D-111, D-115): fourteen bases in `client/public/models/monsters/` (8.9 MB in all, fetched per fight and
  runtime-cached) and one `manifest.json` of 50 entries — §4's `VARIANTS` tables became data there (scale, parts,
  shapes, palette, bone scales, pose offsets, clip map). The creatures (rat, hound, spider, bat) have their own rigs
  (23–41 bones) and clips; the dead, the bandits, the cult, the Sentinel and the Hollow King wear the hero rig and play
  the hero clips through a clip map, with pose offsets for the hunched and the seated; the spirits, tentacles, oozes and
  the leech are small chains or shape keys. Fodder 2.0–3.4k triangles, elites 3.5–4.7k, bosses 4.7–6.8k (the King's
  throne 3.1k more) — inside §4's budgets.
- **Effects are generated in code** (D-112, replacing §6's flipbooks): one atlas drawn on a canvas at start-up, twenty
  effects (sparks for the three physical types, marks for the six elements, heal, buff and debuff rings, the death
  puff, the six Ultimates), one draw call for all of them; Reduce motion turns them off.
- **Measured** (desktop Chrome, an Intel Iris Xe, the phone's viewport — the phone's own numbers come from James's
  checklist; `10` §4): a room with 4 heroes and 4 pets 40 draw calls and 101k triangles at 59 fps; the largest Cellars
  fight (4 heroes, 4 pets, 6 monsters) 54 calls, 138k triangles, 59 fps (lowest 56); a 30-minute autoplay soak held
  57–60 fps with nothing growing.
- **What a script did not reach** (§10, the honest list): the hero-rig monsters' faces are the decimated hero face with
  ink eyes; the creatures are smooth "clay" with a few fur clumps; chains, lanterns, nets, kelp and tentacle tips are
  rigid on their bones; the Crypts' pointed arch reads round-headed at phone size; webs read as gauze fans; water is a
  translucent tint, not a water shader; the hunched poses and the Bursting Corpse's swell need the client's offsets;
  ten of the sixteen pets are still capsules (D-117).

## 13. As built in Phase 8 (2026-10-29, pass C: accessibility, performance, assets)

- **The emblem.** `client/public/logo.svg` is drawn for this game: a lantern hanging in the gate arch of a keep — four
  merlons, a ring of arch stones with a keystone, the lantern's light pooling in the doorway — in the title's dusk
  (#120f14), stone greys and ember amber. It reads at 48 and 32 px. `npm run icons` renders the PWA set from it (64,
  192, 512, the maskable 512 on a full-bleed background at 80%, the 180 Apple icon, the 48 favicon). `index.html`
  paints the title's colour from the first frame and shows the emblem and the wordmark while the code arrives; the
  installed app's launch screen is the manifest's background (the same colour) with the icon.
- **Shaders before showing.** The soak's dips were not the GPU drawing the mist (timer queries: a Crypts or Vault room
  takes the Iris Xe 1–2.5 ms a frame; the mist 0.3 ms of it, the water 0.1 ms). They were render calls stalled on
  shader compiles (90–420 ms each) whenever a new monster or a death fade met a program three.js had freed with the
  last fight's models. Now a model is compiled in parallel (KHR_parallel_shader_compile) before it replaces its
  capsule, its fade's see-through variant too; the room kit's six variants compile when the delve opens and a new
  room's on its build; and the stage keeps every program it has compiled (up to 128) for its life (`scene/stage.ts`
  `warm`, `pinPrograms`).
- **Smaller stalls.** A skinned mesh takes its rest pose's bounds (three.js skinned every vertex on the CPU to sort it,
  10–55 ms a monster); a monster's or hero's assembly runs on a frame of its own (`scene/turns.ts`), so four monsters
  arriving together no longer freeze 120 ms; see-through double-sided materials (mist, webs, water) draw in one pass.
- **Bosses read at phone size.** A boss on an arena mark at the back of the room (Vexa's dais, Naesa's altar) has the
  fight come to him: the formation advances along the camera's depth until its middle stands 2.2 m in front of him
  (2.5 m more per metre his mark is raised, so the King's dais keeps the party off its steps). The arena's chips and
  tells moved from under the turn banner, where they covered the boss's head, to the enemies' column. A model's reach
  (the Hollow King's raised blade, 1.2 m above his height) is measured when it arrives and framed. Measured at the
  phone's viewport: Vexa 28 → 51 px, Sister Naesa 39 → 46 px, the Hollow King 49 px half hidden → 45 px (body; about
  60 px with his blade) fully in view, the Barrow Warden 83 px as before.
- **The Vigil's secret doors** swing open (95° about the left jamb, into the next room) when the sim opens them — the
  Warden's phase 2 or the candles — the panel its own mesh beside the batched frame (`room/dress.ts` `doorPanels`,
  `room/arena.ts`).
- **Pets** swing Attack2 for their second active (and Attack1 for their first and their plain attack, which played no
  clip at all); a model without Attack2 falls back to Attack1. The 0.12 s lead puts the clip's hit event just after the
  number on every pet base (their clips carry hit or release events).
- **Lineups**: rows stand far enough apart that a back row's names clear the front row's heads on screen (the Vault's
  sixteen in two rows of eight).
- **Colour-blind palettes** (Settings → Colours; `client/src/ui/styles/a11y.css`) remap friend and foe, good and bad,
  health and the pools, the threat pill, grades and the map's locked doors, and reach the 3D HP bars (`BAR_COLOURS`:
  amber friends and violet foes red–green safe, teal and red blue–yellow safe). Every value was chosen with a
  protanopia, deuteranopia and tritanopia simulation (Machado et al. 2009); `ui/styles/palettes.node.test.ts` keeps
  every pair that must read apart at least 20 CIE76 units apart for the vision its palette serves and for normal
  vision. The standard palette's green and red read 12 apart to deuteranopia.
- **What is left** (the honest list): the Hollow King stays the smallest boss — the fight HUD leaves a band 166 px tall
  between its strip and its feed, his throne is far back and raised, and he is dark on dark (his boss lamp is dimmed
  with the room's light, a rule of the arena); a camera made for the throne fight would do more than framing can. On
  the desktop's Direct3D path a brand-new monster's first draw can still stall about 60 ms (ANGLE finishes a shader
  for each vertex layout at its first draw); the phone's path differs, and its numbers come from James's checklist.

**Open questions**
1. ~~Base meshes from the CC0 bundle (recommended) vs. the procedural loft body for everything (faster, worse faces)?~~ *Checkpoint 1 (D-019): the CC0 base meshes, as recommended; the procedural loft body stays for silhouette tests only.*
2. ~~Outline pass: inverted hull (cheap, Ascend-proven) vs. a screen-space edge pass (cleaner, costs a post pass on the phone)?~~ *Checkpoint 1 (D-099): inverted hull, as §1 and `10` §2 already plan; a screen-space pass only if Phase 5's renders show hull defects and the phone budget allows it.*
3. ~~Commission an artist for the six heads once the pipeline is proven — budget question for James.~~ *Checkpoint 1 (D-099): not now — decided at checkpoint 2, after James sees the Phase 5 renders; nothing is paid without his yes.*

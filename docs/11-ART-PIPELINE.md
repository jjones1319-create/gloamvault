# 11 — Art Pipeline (Blender → glTF → three.js)

*Last updated 2026-10-26 · rev. 1 (Claude). Decision D-019. The sister project's `prototype/blender/shade/` (ProjectAscend) is the proven ancestor of this pipeline: scripted, headless, re-runnable, reviewed by looking at renders; its `LOG.md` lists honestly what a script can and cannot reach. This document keeps what worked and fixes what didn't.*

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

`06-MONSTERS.md` §3.5 maps Dungeon 1's 35 monsters, 3 hunters and 4 bosses onto **14 base meshes** — `rat`, `spider`, `humanoid` (the hero rig with bandit, cult and crone costume sets), `hound`, `skeleton`, `zombie`, `bat`, `wraith`, `wisp`, `tentacle`, `sentinel`, `ooze`, `leech`, `hollow-king` (unique: humanoid rig + throne + chain rig) — with the Barrow Warden and the other bosses as scaled, re-dressed variants with unique parts. Each base is a `build_<base>.py` with a `VARIANTS` table (scale, parts on/off, palette, extra bones) so a variant is a re-run, not a new model. Budgets: fodder 2–4k tris, elite 4–6k, monster 6–8k, boss 8–12k; quadruped and non-humanoid rigs are small custom chains (the Shade's fox rig is the pattern).

## 5. Environments

Per zone: a **kit** of pieces (`07-DUNGEONS.md` §2 lists them with tri budgets), a **palette**, **lighting** baked in Blender (Cycles bake of AO + a lightmap atlas per room template, 2048², headless), fog and torch sprites added in the client. Room **templates** (`07` §2) are `.glb` assemblies built from the kit by script from a JSON description (so the generator's template ids and the Blender builds share a source). Props that repeat (torches, chains, rubble, bones) are separate `.glb`s instanced in three.js.

## 6. VFX

Element marks, hits, heals and Ultimates: **sprite flipbooks baked in Blender** (Mantaflow fire/smoke/water, or shader-animated planes rendered to PNG sheets — Wildsong Ranch's bake pattern) plus client-side additive planes and a cheap bloom. ≤ 1 MB per flipbook, lazy-loaded.

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

**Open questions**
1. Base meshes from the CC0 bundle (recommended) vs. the procedural loft body for everything (faster, worse faces)?
2. Outline pass: inverted hull (cheap, Ascend-proven) vs. a screen-space edge pass (cleaner, costs a post pass on the phone)?
3. Commission an artist for the six heads once the pipeline is proven — budget question for James.

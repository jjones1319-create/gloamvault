# tools/blender — the hero pipeline (Phase 5)

Everything visual about a hero is built here by scripts, headless, and re-run end to end: nothing is hand-edited in
Blender's UI. `docs/11-ART-PIPELINE.md` is the plan and `docs/05-SPECIES.md` §5 the species rules; this file is the
**contract** every build script follows, so the species, clips, gear and client passes fit together without talking.
Look at your renders before you call anything done (CLAUDE.md rule 7) and log each round in `art/LOG.md`.

## Running

```powershell
$B = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
& $B -b -P tools/blender/hero/build_body.py -- [--quick]                       # → art/build/hero_body.blend + renders
& $B -b art/build/hero_body.blend -P tools/blender/hero/export_hero.py -- --check   # → client/public/models/hero/*.glb
node tools/blender/inspect-glb.ts client/public/models/hero/hero_broad.glb    # what a .glb holds, decoded
```

From Bash: `"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b …`. Scripts put `tools/blender/lib` on
`sys.path` and import `common`, `toon`, `rig`, `fit`, `render`, `export`. Arguments after `--` are read by
`common.args()`. Builds take 1–5 minutes; use `--quick` (fewer render samples, smaller images) while iterating.

**Input:** the CC0 Human Base Meshes bundle at `art/ref/human-base-meshes/human_base_meshes_bundle.blend` (48 MB,
git-ignored; `CREDITS.md` says where it comes from — the copy on this machine came from `../ProjectAscend/art/ref/`).
**Outputs:** `.blend` files in `art/build/` (git-ignored), review PNGs in `art/renders/hero/<area>/` (git-ignored, ~300 MB;
`blender -b -P tools/blender/curate_renders.py` copies the key sheets and 200-px reads to `art/review/` as JPEGs, which
are committed), game files in `client/public/models/hero/` (committed). The body build is not bit-for-bit deterministic (Blender's
decimator), so **rebuilding the body means rebuilding everything that depends on it** (species, gear, exports).

## Units, axes, frames

- Metres; Blender Z up; the character faces **−Y**; the origin between the feet on the floor. Exports are +Y up.
- Two **body frames**, one topology to the last vertex: **broad** (from the bundle's stylized male, 1.794 m) and
  **slight** (from its stylized female, 1.613 m). `art/build/hero_body.blend` holds `Body_broad`, `Body_slight`,
  `Rig_broad`, `Rig_slight` and the sockets `Socket_<name>.<frame>`. A hero is one frame + one species + one face
  preset + tints (the client chooses). Anything you build for the body (gear, parts, keys) you build **once on the
  broad frame** and carry to the slight frame with `fit.SurfaceMap` (bind to `Body_broad`'s vertices, evaluate on
  `Body_slight`'s — same triangles, same indices).
- The body is 10,498 triangles with its eyes (5,289 vertices after the palette split). Regions covered by gear are
  dropped by the client at assembly, so a dressed hero shows far less of it.

## The rig (`lib/rig.py`)

65 bones, Unity-Humanoid names: `Hips Spine Chest UpperChest Neck Head LeftEye RightEye`, per side
`Shoulder UpperArm LowerArm Hand`, `Thumb|Index|Middle|Ring|Little` × `Proximal Intermediate Distal`,
`UpperLeg LowerLeg Foot Toes`, and the optional chains every file carries: `Tail_01..04 Ear_L Ear_R Beard_01..02
Hair_01..03`. A-pose rest. Local Y runs head → tail; local Z faces the character's front (fingers: out of the palm,
so curling is +X; feet and toes: up). In pose space **+X bends forward / curls, +Y twists, +Z swings the bone's tip toward the character's right for
bones pointing up (spine, neck, head) and toward the character's left for bones pointing down (legs, the A-pose arms)**
— the local X axis flips with the bone's direction; `rig.mirrored()` copies Left → Right with Y and Z negated.
The Hips bone is tilted ~12°, so `Hips.loc` "up" also moves the hips forward (`build_clips.py` → `hips_loc` converts a
world offset). Loops: `build_clips.py` makes looping F-curves cyclic. A second rig given the same action needs its
`animation_data.action_slot` set (Blender 5.x). Upper arms rotate ZYX, the rest XYZ.
Poses are dicts `{bone: (x, y, z) degrees, 'Hips.loc': (left, up, forward) metres}`; `rig.key_pose`,
`rig.make_action`, `rig.rest_pose`. The fist that works on this rig: fingers Proximal 72 · Intermediate 95 · Distal
55, thumb 25 · 40 · 35 (`art/LOG.md` round 1).

**Sockets** (empties under bones; `Socket_<name>` in the exports): `HandR`, `HandL` (in the palm where a fist closes;
+Y out of the thumb side = where a held blade points, +Z along the hand toward the knuckles), `Head` (crown, +Y up),
`Mouth` (+Y forward), `Neck` (front of the neck base, +Y down), `Back` (behind the upper chest, +Y up, +Z back),
`Belt` (left hip, a sheathed blade's line), `Pet` (on the floor at the hero's right).

## The palette (`palette.json`, `lib/toon.py`)

Every mesh carries one colour attribute **`gv`** (FLOAT_COLOR, POINT domain → glTF COLOR_0, exported as normalised
16-bit): **R = slot / 15, G = region / 15**, B = 0, A = 1. Slots: 0 skin · 1 skin2 (lips, Draconid belly) · 2 hair ·
3 iris · 4 sclera · 5 ink · 6 cloth1 · 7 cloth2 · 8 leather · 9 metal · 10 trim (the grade colour) · 11 glow
(emissive: element lines, runes) · 12 wood · 13 bone (horns, claws, tusks, nails) · 14 gem (emissive) · 15 cloth3.
Regions (body only; give everything else region 0): 0 head · 1 neck · 2 chest · 3 belly · 4 upperArms · 5 forearms ·
6 hands · 7 thighs · 8 shins · 9 feet. Assign slots per face and call `toon.split_by_face_slots(ob, face_slots,
normals=…)`: faces of different slots get their own vertices, smooth normals are kept as custom normals, so colours
change crisply while shading stays smooth. `node tools/blender/inspect-glb.ts` must report "worst distance from a
whole code 0.0000". The client never reads glTF materials: it builds one palette toon material per character, so
**the whole assembled hero is one draw call** (+ one for the outline).

Review renders: `toon.apply_look(ob)` gives a mesh the palette toon material and an inverted-hull outline (a
Solidify named `Outline`; its material casts no shadow — round-1 lesson: an enclosing hull shadows the surface and
the ramp reads one flat step). `lib/render.py`'s `Stage` renders card + 200-px read, turntable, ortho sheet and any
shot; `grid_sheet()` tiles PNGs into one contact sheet.

## Morph targets (shape keys)

- **Species** (on the body, every part and every skinned gear piece, so gear fits every species): `spc_dwarf_broad`,
  `spc_elf_lean`, `spc_orc_bulk`, `spc_halfling_round`, `spc_draconid_ridge` — the names in
  `content/species/<id>.json` → `body.shapeKeys`. Human is the basis. A species key changes shape, not joint
  positions: proportions come from the bone scales in `body.boneScales` (groups `root upperLeg lowerLeg shoulder chest
  upperChest upperArm lowerArm hand fingers head neck foot toes`, each within ±15%; `root` is the uniform scale), which
  the client applies to the skeleton — **as absolute scales**: each body bone's world scale = `root` × its group factor
  (bones without a group: 1 × root), not compounded down the chain, which is the only reading that gives `05` §3's
  numbers (an Orc's hands 1.12 × 1.15 = 1.29); a bone's local scale is therefore its absolute scale ÷ its parent's; the
  eyes and the chain bones inherit their parent's. Keep keys local (a broad Dwarf torso, a lean Elf, a Draconid muzzle and brow
  ridge): if a key moves a joint more than ~1 cm, it fights the skeleton.
- **Face** (on the body and on head parts: hair, brows, beards): twelve shared keys `face_brow_heavy face_brow_raise
  face_jaw_wide face_jaw_narrow face_chin_long face_cheek_high face_cheek_full face_eye_big face_eye_narrow
  face_nose_wide face_nose_long face_mouth_wide`; beards also carry `beard_tuck` (05 §3.2: tucks the beard for
  cheek-guard helmets — the client sets it when a closed helmet is worn). Each species has three presets (weights over these keys plus part
  choices), written by the species build into `client/public/models/hero/manifest.json`.
- The client **bakes** the weights at assembly (species 1.0, the preset's face weights), recomputes nothing else, and
  drops the morph data, so morphs cost nothing per frame.

## Parts

Separate meshes skinned to the rig, named exactly as `content/species/<id>.json` → `body.parts`
(`spc_dwarf_beard spc_dwarf_braids spc_elf_ears spc_orc_tusks spc_orc_ears spc_orc_topknot spc_halfling_feet
spc_halfling_curls spc_draconid_tail spc_draconid_horns spc_draconid_crest spc_draconid_claws_hand
spc_draconid_claws_foot`) plus shared hair and brow styles `hair_<style>` and `brows_<style>` that any preset may pick.
Chains hang on their bones (`Tail_*`, `Ear_*`, `Beard_*`, `Hair_*`). Node extras on every part: `kind: "part"`,
`family` (`hair`, `brows`, `spc_dwarf_beard` …), `variant`, `species` (who may wear it), `hides`. A part carries
only the species keys of the species allowed to wear it. A part that replaces body geometry (Elf ears over
the round ears, Halfling feet) lists the regions it hides in its custom property `hides`. Budget: a species' parts ≤
1.5k triangles together.

## Gear

One mesh per **slot** per **tier**, skinned to the rig, built around `Body_broad` and carried to `Body_slight`:
objects `gear_<class>_<slot>_<tier>` with tier `F` (crude) and `S` (fine; the in-between grades are tints of the
same meshes, and from A up one extra piece may be added later). Slots follow `docs/classes/<class>.md` → *Modular
meshes*: `helmet chest legs gloves boots` (+ `robe`, `cloak` where a sheet calls for them). Each piece: palette slots
(cloth1/cloth2/cloth3/leather/metal/trim/glow), every species key (transfer the body's keys with `fit.SurfaceMap`
from the body surface), custom properties `slot`, `tier`, `class`, `hides` (the body regions it fully covers, so the
client drops them), weights copied from the body surface (nearest-face interpolation, 4 influences). Sit 4–12 mm off
the skin (more under plates) so nothing pokes through in Idle / Run / Attack_Heavy. Budget: a full set of five pieces ≤
4.5k triangles, so a dressed hero (visible body + gear + weapons) stays ≤ 15k.

**Weapons and shields** are rigid: modelled with the grip at the origin, the blade or shaft along **+Y**, its edges in
the YZ plane; objects `wpn_<weaponType>_<tier>` / `shd_<type>_<tier>` (types from `content/items` →
`weaponType`, e.g. sword, greatsword, axe, mace, spear, bow, crossbow, dagger, staff, wand, focus), custom properties
`socket` (`Socket_HandR`, or `Socket_HandL` for shields, foci and off-hand daggers), `hands`. The client attaches them
to the socket with an identity transform and multiplies by 1 / the species' scale so a Halfling holds a full-size
blade.

## Clips

Authored once on `Rig_broad` as pose tables (`rig.make_action`), 30 fps, rotations only plus `Hips.loc`. The set
(`11` §3): `Idle` (loop), `Walk` (loop), `Run` (loop), `Attack_Light`, `Attack_Heavy`, `Attack_Dual`, `Shoot`, `Cast`,
`Guard`, `Hit`, `Dodge`, `Downed`, `Revive`, `Victory`, `Defeat`, `Interact`, `SitRest`, and the species specials
`Breath` (Draconid) and `Roar` (Orc). Weapons are held in fists (the fist above). Event frames (hit, release,
footfalls) go in `client/public/models/hero/clips.json` (`{name, seconds, loop, events: {hit: 0.42, …}}`).

## Exports (`hero/export_hero.py` and each pass's exporter)

`client/public/models/hero/`: `hero_broad.glb`, `hero_slight.glb` (the rig `Rig`, the body `Body` with its morphs,
the parts, the sockets — frame suffixes stripped), `hero_clips.glb` (the armature and the clips, every action stashed
on a muted NLA track), `gear_<class>_<frame>.glb` (every slot and tier of one class on one frame, each skinned to a
copy of the rig), `weapons.glb`, `clips.json`, `manifest.json` (files, clip names, regions, slots, species presets). `manifest.json → species.<id>`:
`key`, `boneScales`, `skinTones`, `hairColors` (8), `eyeColors`, `boneColors` (horns, tusks, claws), `parts`, and
`presets[]` = `{ id, name, face: {key: weight}, parts: [...], tint: {skin, hair | bone, eye}, partTris }`.
Settings in `lib/export.py` (no glTF materials, COLOR_0 kept, morph normals off, extras on). Check every file with
`inspect-glb.ts` and a `--check` re-import.

## Who owns what while the passes run in parallel

- **Lead:** `lib/*`, `palette.json`, `hero/build_body.py`, `hero/export_hero.py`, this README. Others may *read* them;
  ask the lead (in your report) for a change instead of editing them.
- **Species pass:** `hero/build_species.py`, the species and face keys on `Body_*` and the parts, `manifest.json` →
  `species`; renders `art/renders/hero/species/`.
- **Clips pass:** `hero/build_clips.py`, `clips.json`, `hero_clips.glb`; renders `art/renders/hero/clips/`.
- **Gear passes:** `hero/build_gear_<class>.py` (+ a shared `hero/gear_lib.py` the first gear pass writes; later ones
  extend it carefully), `gear_<class>_<frame>.glb`, weapons in `hero/build_weapons.py`; renders
  `art/renders/hero/gear/<class>/`.
- **Client pass:** `client/src/scene/characters/*`, the viewer screen; reads whatever exports exist.

---

# Phase 6 — environments and monsters

## Environments (room kits)

- **Grid and pivots** (`07` §2.2 owns them): cell 8 × 8 m, floor tile 2 × 2 m, wall segment 2 m long × 3.5 m high,
  doorway 2 m wide at a cell's mid-edge; a piece's origin is at floor level in the centre of its footprint (a wall piece:
  the centre of its base on the room-side face). A piece's **front faces −Y in Blender** (+z in the game, the same as the
  heroes). Templates (`content/dungeons/<dungeon>/templates/*.json`) place pieces by `meshId` in game space (+x east,
  +z south, y up; `rotationY` in degrees); the client builds the floor and walls of each room from its footprint and doors
  with the zone's floor, wall, doorway and corner pieces, then places the props.
- **Kits**: one file per zone, `client/public/models/env/kit_<zone>.glb` (`shared`, `cellars`, `crypts`, `vault`), one
  object per piece named exactly by its `meshId`, rigid (no rig), with extras `kind: "kit"`, `zone`, `tris`. A piece that
  moves (a chest lid, a portcullis) is a second object `<meshId>.<part>` with its origin at the hinge; a flame, glow or
  light point is an empty `light_<n>` (a torch's fire, a brazier) or `fx_<n>` (drips, motes) under the piece — the client
  draws flames and lights there. Budgets: `07` §2.2's per-piece triangle numbers; a room ≤ 40k triangles and ≤ 40 draw
  calls (`11` §9) — repeated pieces are instanced by the client.
- **Colour and light**: the same `gv` attribute as the heroes, read differently: **R = slot / 15** in the zone palette,
  **G = variation** (0–1, grime and weathering the client turns into a slight light/dark shift), **B = baked ambient
  occlusion** (1 open, 0 enclosed — bake with Cycles to a colour attribute, then copy into B). Environment slots:
  0 stone · 1 dark stone / mortar · 2 wood · 3 dark wood · 4 iron · 5 ink (deep recesses) · 6 cloth1 (banners) · 7 cloth2 ·
  8 leather / rope · 9 bright metal · 10 brass / trim · 11 glow (fire, runes, lit spirals; emissive) · 12 moss / plants /
  slime · 13 bone · 14 crystal / gem (emissive) · 15 water / liquid. Each zone's 16 colours live in
  `tools/blender/palettes/<zone>.json` (one file per zone, owned by that zone's build; the Cellars warm browns and rust,
  the Crypts bone-white and sickly green, the Vault teal and brass — `11` §1); the kit export copies it with the piece
  list to `client/public/models/env/<zone>.json` (`{ zone, palette: [16 hex], pieces: { meshId: { tris, parts, lights } } }`),
  which the client reads. No textures, no lightmaps: toon shading, the
  baked AO and two dynamic torches light a room (`10` §4).
- **Reviews**: a kit sheet (every piece, labelled), and every template assembled in Blender from its JSON with its floor,
  walls and props, rendered from the template's own `camera` (position, lookAt, fov) with two torch-coloured point lights —
  the view the player gets. Renders under `art/renders/env/<zone>/`; logs merged into `art/LOG.md`.

## Monsters

- **Bases** (`06` §3.5): fourteen builds cover Gravehollow's 35 monsters, 3 hunters and 4 bosses. A **variant** is a scale,
  a shape key, a part on or off, a palette or a prop on its base's rig and clips — never a new rig. Each base exports
  `client/public/models/monsters/<base>.glb`: its rig `Rig` (for its own clips) or no rig of its own (see the humanoid
  bases), the meshes `<base>_body` and `<base>_<part>` (skinned), shape keys `var_<name>`, the clips `Idle`, `Move`,
  `Attack1`, `Attack2`, `Hit`, `Death` (+ `Flee` where `content/monsters/*.json → visual.animations` lists it), 30 fps,
  events in `client/public/models/monsters/clips.json` (`hit`, `release`, `down`). Budgets: `06`/`visual.triBudget`
  (fodder 2–4k, elite 4–6k, monster 6–8k, boss 8–12k).
- **Humanoid bases** (`humanoid` costumes, `skeleton`, `zombie`, `sentinel`, `hollow-king`) are built on the hero rig and
  body and **reuse the hero clips** (`hero_clips.glb`): their files hold only meshes skinned to the hero `Rig` (like gear)
  and the extra `clips: "hero"`; the client maps Idle → Idle, Move → Walk, Attack1 → Attack_Light, Attack2 →
  Attack_Heavy, Hit → Hit, Death → Defeat, Flee → Run. Costumes are gear built with `gear_lib`.
- **Colour**: the hero palette slots, with `content/monsters/<id>.json → visual.palette` (three colours) filling slots
  0, 1, 2 (main, secondary, accent); fixed slots for the rest (5 ink, 8 leather, 9 metal, 11 glow — eyes, runes —,
  12 wood, 13 bone — teeth, claws —, 6/7 cloth for costumes).
- **The variant table** → `client/public/models/monsters/manifest.json`: per monster id (the content id, or the `06` name
  in kebab case for the Crypts and Vault monsters whose JSON arrives in Phase 7) → `{ base, scale, parts: [...],
  shapes: {var_x: w}, palette: [...3], clipSpeed }`, plus the pets that use these bases (`06` §9: Rat Prince, Spiderling,
  Cellar Hound, Bone Pup, Crypt Bat, Wisp …).
- **Reviews**: a lineup per base (every variant side by side, at their scales, against a 1.8 m hero silhouette), each
  clip as a strip at its key frames, the 200-px read at the fight camera's distance.

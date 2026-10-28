# Art build log

*One entry per build round (CLAUDE.md rule 7, `docs/11-ART-PIPELINE.md` §8): what was built, what the renders showed,
the defects as a numbered list with their fixes, and what is left. Full-size renders are written to `art/renders/` (local,
git-ignored); `tools/blender/curate_renders.py` copies the key sheets and 200-px reads to `art/review/` as JPEGs, which
are committed. The scripts are in `tools/blender/` (conventions in its README).*

## Phase 5 · Round 1 — 2026-10-28 — the body frames and the rig (lead)

**Built.** `tools/blender/lib/` (`common`, `toon`, `rig`, `fit`, `render`, `export`), `hero/build_body.py`,
`hero/export_hero.py`, `inspect-glb.ts`. The CC0 bundle's stylized male and female bodies turned out to share one
topology (12,502 vertices, 12,500 quads, UVs), so they became the **broad** and **slight** frames of one mesh: merged
with their eyes in a fixed order, decimated once (25,000 → 9,800 body triangles + 700 eye triangles, X-symmetric), the
slight shape carried onto the decimated mesh by binding each vertex to the full mesh's nearest triangle. The rig is
fitted on the full-resolution mesh by plane cuts: each joint is the centre of the loop a cut makes around a limb, and
because the frames share topology, the same loops place the slight frame's joints. Bone-heat weights on the broad frame,
copied by index to the slight one; the eyes rigid on their bones; regions by strongest bone; iris, pupil and sclera by
angle on the broad eyes, the same faces on both. Normals come from the full-resolution mesh (interpolated at each bound
point), so the toon bands follow the sculpt, not the decimation. Exports: `hero_broad.glb`, `hero_slight.glb` (455 KB
each, 65 joints, 8 sockets, COLOR_0 codes exact).

**Renders read** (`art/renders/hero/body/`): `card_*`, `ortho_*`, `head_*`, `skeleton_*_front/side`, `pose_test_*`,
`pose_test_hand_*`.

**Defects found and fixed this round:**
1. The slight frame rendered as the broad one: a Surface Deform modifier applied as a shape key did not pick up the
   target's shape key headless. → `lib/fit.py`'s `SurfaceMap` does the same binding in Python (barycentric transform).
2. The toon ramp read one flat step on everything: the inverted-hull outline encloses the surface and cast a shadow over
   it. → the outline material culls its back faces for shadows (`use_backface_culling_shadow`). Also: the light
   energies were lowered so a white diffuse facing the key lands on the third step.
3. Bands were blotchy on the decimated mesh. → custom normals interpolated from the full-resolution mesh.
4. The finger finder found nothing: on the decimated mesh a thin slab holds a handful of vertices per finger. → fit on
   the full mesh, and cut with planes (edges crossing the plane, chained through shared faces into loops) instead of
   collecting vertices in a slab.
5. Three fingers instead of four: the little finger is the shortest and finger loops measure 1.5–1.9 cm, above the
   1.6 cm limit. → step the cut back from the tips until it crosses four loops; the limit is 2.4 cm (the thigh, also
   cut, measures 8 cm).
6. The thumb chain ran down the index finger (the "farthest vertex in front" was the index tip). → the thumb is the
   small loop in front of the four finger chains on a cut through the palm, flood-filled to its tip and walked back to
   its web.
7. The index and middle chains started mid-finger, so a fist left their bases straight: the walk to the web stopped at
   the knuckle bulge (a loop growing ~1.5×). → stop only when a loop passes 1.8× the finger's running median or its
   centre jumps (a merge).
8. The eye pattern was read per frame and split the two frames differently (5,289 vs 5,293 vertices). → read once on
   the broad frame; the same faces on both (one topology to the end).
9. The test pose was saved into the .blend as an action, so later renders showed it. → the action is removed and the
   bones reset before saving.

**Still open (next rounds):** the shoulder pinches when the arm rises above the shoulder (bone heat; a corrective key
or hand-tuned deltoid weights in a later round); the finger knuckle joints sit ~1 cm low (fine at game size); the
slight frame's iris sits a little low in its eye; the bodies are bald and browless until the species pass adds hair,
brows and face presets.

## Phase 5 · Rounds 2+ — the parallel passes (2026-10-28)

After round 1 (above) six passes ran at once, each logging its own rounds; they are merged here unchanged, pass by pass. The renders are in `art/renders/hero/<pass>/`.

### The species pass

#### Phase 5 · Species round 1 — 2026-10-28 — keys, parts, presets, first renders

**Built.** `hero/build_species.py` opens `art/build/hero_body.blend` and saves `art/build/hero_species.blend`:

- **Species keys** on `Body_broad` and `Body_slight` (`spc_dwarf_broad`, `spc_elf_lean`, `spc_orc_bulk`,
  `spc_halfling_round`, `spc_draconid_ridge`), the same code on both frames: limbs and torso scaled about each bone's
  axis with the skin weight as the falloff (`op_thicken` — joints stay put), bumps and local scales placed from face
  landmarks. Landmarks are vertex indices searched once on the broad frame and read on both (one topology). Ears that
  part ears replace (Elf, Orc) or that the species lacks (Draconid) are folded flat by the key itself, so no body
  region has to be hidden.
- **Twelve face keys**, local (23–780 vertices each, 2–8 mm).
- **29 part meshes per frame**: 6 hair styles (`crop shaggy long tied swept bun`), 3 brows (`soft heavy arched`), and
  every `body.parts` name plus variants (`spc_dwarf_beard` full/`_forked`/`_short`, `spc_elf_ears` swept/`_long`,
  `spc_orc_tusks` medium/`_big`/`_small`, `spc_draconid_horns` swept/`_ram`/`_crown`). Built on the broad frame; carried
  to the slight frame by surface binding (hair, brows, beards, crest, claws, feet), rigidly by an anchor on the skull
  (ears, tusks, horns) or through the tail bones (tail). Every part carries the 5 species keys, head parts the 12 face
  keys, each transferred from the body's key the same three ways. Custom properties `family`, `variant`, `species`,
  `hides` (`spc_halfling_feet` → `["feet"]`).
- **18 presets** and the species block of `client/public/models/hero/manifest.json`.

**Renders read:** `lineup_*`, `reads_200.png`, `heads_*`, `profiles_*`, `poses.png`, `keys_species_*`, `keys_face_*`.

**Defects found (fixed in round 2):**
1. `hair_long` hung its curtain over the face like a mask: the curtain's azimuths were measured from the front, not the
   back.
2. The default Elf (Moonpale skin, white hair) read as a ghost: white on white.
3. Dwarf sideburns floated as patches on the cheekbone beside the eye (the beard's side rays left from too far forward
   and landed on the cheek).
4. The Dwarf did not read as wide at 200 px — a small human, not "a barrel on short legs".
5. Halfling curls read as hexagon tiles (faceted icosahedra, each outlined).
6. The tufts on the Halfling feet read as dark spots.
7. The Draconid read as a red devil: ram horns curling *up*, and the muzzle a pouting lip, not a snout.
8. Orc tusks thin as fangs; the small ones vanished.
9. `hair_crop`'s fringe read as a regular zigzag.
10. The 3/4 lineup left the figures small in a wide frame.
11. Six face keys too faint to see in the close-ups (brow heavy/raise, cheek high/full, nose wide, mouth wide).
12. Halfling presets 1,604 triangles of parts (budget 1,500): the curls cost 932.

**Held:** the parts stay on the body in the A-pose and in the test pose on both frames (hair, beards, tail at the hips,
feet, claws); every species key keeps the joints still.

#### Phase 5 · Species round 2 — 2026-10-28 — the round-1 fixes

**Changed.** `hair_long`'s curtain spans 108°–252° around the back; Elf `elf_a` hair raven; the beard's side rays
leave from just in front of the ears and its top edge stays low across the cheeks before rising; Dwarf barrel
(ribcage deeper more than wider, so the A-pose arms stay clear); the curls as one lumpy shell; two tuft fans per
Halfling foot; Draconid ram horns sweep back and curl down beside the ears, swept horns lie along the skull, the snout
pushed 4.6 cm with a stronger bridge and a flatter nose; tusks 1.4× thicker; an uneven crop fringe; a closer 3/4
camera; six face keys ×1.3–1.4. Parts now carry only the species keys of the species that may wear them (the
manifest's `parts` lists) and drop deltas under 0.1 mm — the export stays small.

**Renders read:** all sets again. Fixed: 1, 2, 7 (the horns no longer read as a devil's), 8, 9, 11 (verified in larger
close-ups in round 3).

**Defects found (fixed in round 3):**
13. The lumpy-shell curls read as a smooth cap with a row of beads along the hairline: the shell's grid (10–12° steps)
    is too coarse to show 14° lumps.
14. Dwarf sideburns came out as one thin sliver (only the outermost beard column rose to the temple).
15. The Dwarf still too slim for "wider than it looks tall".
16. The 3/4 lineup camera still too far; the face-key sheet's cells too small to judge 2–6 mm keys.
17. Every species rendered with the palette's blue iris; 05 §3 lists eye colours per species (the Draconid's gold).

#### Phase 5 · Species round 3 — 2026-10-28 — curls, bulk, eyes, the first export

**Changed.** The curls: a cap with volume under 28 hooked locks (each rises off the cap and curls back at its tip);
the beard 13 columns wide so the sideburns are two columns; a stronger Dwarf barrel plus a hard belly; eye colours per
species in the renders and in the manifest (`eyeColors`, preset `tint.eye`); the 3/4 lineup camera at 3.3 m; the
face-key sheet in close-up; a test-pose head sheet (`poses_heads.png`); only sheets and 200-px reads are kept
(per-preset heads and full-size cards are composited, then deleted: ~20 MB → ~15 MB of PNGs).

**Renders read:** all sets. Fixed: 13 (the curls read as a curly mop at 200 px and up close), 15 (the Dwarf reads
wide), 16, 17 (gold Draconid eyes help the reptile read a lot). In the test pose every head part stays on: hair,
beards, braids, ears, tusks, horns, crest. **First export** from `hero_species.blend`: `hero_broad.glb` 1,288 KB,
`hero_slight.glb` 1,289 KB; `inspect-glb`: 17 morph targets on `Body` (16 of them sparse), each part's own list,
COLOR_0 worst distance 0.0000, 65 joints, 8 sockets, node extras `family/variant/species/hides`.

**Defects found (fixed in round 4):**
18. A new sheet, `gallery_parts.png` (every hair style, every beard), showed the beards' cheek and jaw rows missing:
    cast from inside the head, the front rays met the mouth's interior first and those rows sat inside the mouth.
    What showed was a moustache, a bib under the chin and a detached sideburn — I had read it as a style in rounds 1–3.
19. The sideburns still read as straps.
20. 05 §3.2 names four beard styles and a `beard_tuck` key; `braided` and the key were missing.
21. Parts carried `slot: "part"` as a custom property, which collides with gear's `slot`.

#### Phase 5 · Species round 4 — 2026-10-28 — beards, the last export (final)

**Changed.** The beard is cast from outside inward against the skin without the ears (columns within ±76°, so the
sideburns land just before the ears); its top edge follows control points — under the nose, along the cheeks clear of
the eyes, up past the outer eye corner into broad sideburns that meet the hair; `spc_dwarf_beard_braided` (the short
beard and a braid with a metal ring); a `beard_tuck` key on all four beards (cheeks and sideburns pressed to 3 mm, for
cheek-guard helms, 05 §3.2); `kind: "part"` replaces `slot`; the body's glTF mesh name is stripped of the frame too.
The build was cut off by the machine at 01:00 and re-run with `--quick` renders (seven passes share the laptop).

**Renders read** (`lineup_*`, `reads_200.png`, `heads_*`, `gallery_parts.png`, `profiles_*`, `poses.png`,
`poses_heads.png`, `keys_*`): fixed 18–21. Every species reads at 200 px with no gear — the Dwarf short, wide and
bearded; the Elf the tallest narrow line with ears past the hair; the Orc the widest, green, tusked; the Halfling the
smallest with a curly mop and big feet; the Draconid by tail, horns and gold eyes. In the test pose nothing floats or
sinks on either frame.

**Exports** (`export_hero.py --check`, `inspect-glb.ts`): `hero_broad.glb` 1,326 KB, `hero_slight.glb` 1,330 KB; each
holds `Rig` (65 joints), 8 sockets, `Body` (17 morph targets: 5 species + 12 face) and 30 parts, each part with the
species keys of the species that may wear it, the face keys on head parts, `beard_tuck` on beards; COLOR_0 worst
distance 0.0000 on all 62 meshes; weights sum to 1 everywhere; the re-import finds 31 meshes per file, all skinned,
morphs present. Parts per preset 420–1,392 triangles (budget 1,500). Checked in passing: with only Armature modifiers
left, the exporter's default `export_apply=True` keeps shape keys (Blender 5.2), so gear can use the same settings.

**What a script did not reach (11 §10), for the artist pass or later rounds:**
- Faces with character: presets are 2–8 mm keys plus part choices. "Freckles", "scarred brow", "painted brow", "sun
  lines", "dimples", "ruddy" (05 §3 preset notes) need decals or texture, which the palette-only material has not got;
  grey temples are a hair-colour choice.
- Draconid: no slit pupils (the pupil is five ink vertices on the body), no scales (05 says a normal + mask texture),
  no lighter belly plates (skin2 on the body would re-split its vertices and break the one-topology contract the gear
  passes bind to — a tint mask or a body rebuild by the lead), no 2 cm heel raise (a key would lift the heel off the
  floor; a foot pose in the clips is the better place). From straight ahead, Ember red with ram horns still edges
  toward "devil"; the snout reads from 3/4 and in profile.
- Hair is shells and chunky locks; `hair_long`'s back is one flat curtain; the Halfling's foot tufts are 2–3 px at
  200 px.
- The round ears are folded flat by the Elf, Orc and Draconid keys (no region to hide): a small ridge stays under the
  part ears and reads as an ear hole on the Draconid.

**Notes for the lead and the client pass:**
- Bone scales are previewed as absolute: every body bone = root × its group factor (unlisted 1.0), not compounding down
  the chain — the only reading that reproduces 05 §3's absolute proportions (Orc hands 1.12 × 1.15 = 1.29) — while the
  eyes and the chain bones inherit their parent's scale. The client should apply them the same way
  (`apply_bone_scales` in `build_species.py`).
- The client bakes the morphs and recomputes nothing: the Draconid snout (5 cm) and the Dwarf barrel keep the human
  normals. If they shade wrong in the viewer, recompute normals after the bake, or export morph normals for the five
  species keys only.
- A part only carries the species keys of its wearers (`manifest.json` → `species.<id>.parts`); a beard on a Human
  would not follow the Human's shape (it has none) but would not follow an Orc's either.

### The clips pass

#### Phase 5 · Clips round 1 — 2026-10-28 — the clip set as pose tables, first renders

**Built.** `hero/build_clips.py` opens `art/build/hero_body.blend`, authors the 19 clips on `Rig_broad`, renders,
saves `art/build/hero_clips.blend` and exports `hero_clips.glb` + `clips.json`. Each clip is a list of
`(seconds, pose)` keyed with `rig.make_action` (Bézier, 30 fps; the scene was at 24 fps and is set to 30 so the
exporter's seconds are right). Body angles are written by hand; wherever a hand or a foot must land on something the
angles are **solved at build time** by a small damped-least-squares IK over the rig's own forward kinematics (checked
against Blender's `pose_bone.matrix` to 5e-7) and the solved angles are what gets keyed:

- **Feet** (`plant`): every standing key plants both feet on the floor (ankle position, sole orientation, knee hinge
  square to the foot), solved on both frames at once; walk and run are generated from a gait (stance / swing phases,
  heel strike → flat → heel-off about the ball → swing arc), so the planted foot slides back in a straight line at
  the speed written to `clips.json` (`speed`) and the client can match its move speed to it.
- **Hands** (`reach`): the sword hand to a point with its blade (`Socket_HandR` +Y) along a direction; the off hand on
  a two-handed grip line measured *on each frame* (broad and slight solved together); the draw hand at a point in the
  head's frame (the jaw) for the bow.
- **Hips** (`hips_loc` / `hips_rot`): world-space intent (left/up/forward, yaw/pitch/roll) converted into the Hips
  bone's tilted rest frame; `ground()` drops lying, kneeling and sitting keys onto the floor by the deformed mesh.
- **Loops**: the last key is the first pose object itself, and every F-curve gets a Cycles modifier so Blender's auto
  handles are cyclic — no velocity hitch at the seam (checked: equal steps across frame 60 → 0).
- **Checks** on every frame of every clip on both frames: lowest body point, fists / elbows / forearms against the
  deformed head-and-torso surface, the blade against torso and legs, blade and tail chain against the floor, elbow
  and knee limits on every key, loop closure.

**Renders read** (`art/renders/hero/clips/`): `<Clip>.png` for all 19 (broad row over slight row, 5–7 key frames
labelled with time, frame and event), `hit_Attack_*.png`, `joints_elbow.png`, `joints_knee.png`, `poses_200.png`.

**What read well:** Idle, Walk, Hit, Victory's raise, Roar, SitRest's seat, Shoot's draw (side-on, bow arm out,
string to the jaw), the two-handed grip in Attack_Heavy (both hands on the grip on both frames), the sword socket
(blade out of the thumb side, pommel under the little finger — the box blade sits right in every fist).

**Defects found** (fixed in round 2 unless noted):
1. The attack hit frames did not read as cuts, and the solver left 20–35° blade errors. Cause: the hand socket's +Y
   leaves the fist at 90° to the hand, so a held blade can only sit **52–114° from the forearm** (wrist deviation
   38° ulnar / 24° radial); several targets asked for a blade in line with the arm. → every blade target re-designed
   inside that cone (round 2), then an automatic projection onto the cone (round 3, defect 2.1).
2. Attack_Dual's off-hand strike solved into a bad local minimum (left arm folded across the chest). → the solver
   runs from six fallback starts when an error stays high, and mirrored strikes start from the other arm's solution
   mirrored (`mirror_seed`).
3. Falls floated on their hands or dipped up to 30 cm through the floor between keys (Downed f21, Revive f23, Defeat
   f18): `ground()` used the lowest point, which was a reaching hand. → `ground()` takes body regions (knees for
   kneeling, seat for sitting, everything but the arms for lying) and the transitions got grounded in-between keys.
4. The sword stuck straight up from the floor at the end of Downed and Defeat, and went through the floor in
   Revive's kneel and SitRest. → the sword hand is solved flat onto the floor (blade and edges horizontal); Revive
   kneels with the sword hanging point-forward; SitRest rests the blade across the knees.
5. Interact's hand stopped 30–36 cm above the item. → a deeper squat with the hips pitched 22° and the spine bent.
6. Breath's blade crossed the head when the body hunched forward. → the sword is held low at the side.
7. Shoot's follow-through fist touched the side of the head; Cast's and Shoot's left elbows dug 5–8 cm into the ribs.
   → the hands moved out and forward.
8. Guard read as a boxer's guard with the sword across the belly (a blade cannot point forward from a hand at the hip
   with this grip). → a high guard: the sword hand by the temple, point at the foe, the off forearm forward like a
   shield.
9. The run sat too low (support knee ~70° at mid-stance). → hips 2.3 cm higher, contact 4 cm closer.
10. The most bent elbow was 145° (Attack_Dual) and pinched. → elbow limit 135°.
11. The check's "inside" readings for points far from the torso were sign errors at the open edges of the head-and-
    torso sub-mesh (the limbs join there). → an inside reading is trusted only within 6 cm of the surface.

#### Phase 5 · Clips round 2 — 2026-10-28 — position-first solver, grounded falls, redesigned keys

**Changed.** The solver keeps the hand where it is asked first (position weight 150, blade 16), retries from six
fallback starts when an error stays high, and mirrored strikes start from the other arm's solution mirrored. Falls and
get-ups gained grounded in-between keys (`between()` + `ground(regions=…)`: knees for kneeling, the seat for sitting,
everything but the arms for lying) and an explicit palms-on-the-floor catch in Downed. Every blade target was moved
inside the 52–114° cone. New poses: Guard is a high guard (sword hand by the temple, point at the foe, the off forearm
forward like a shield); Victory ends with the blade resting back on the right shoulder and the left fist on the hip;
Downed and Defeat end with the sword lying flat on the floor; Revive kneels with the sword hanging point-forward;
SitRest lays the blade across the knees; Breath holds the sword low at the side.

**Renders read** (quick, all 19 strips, the three hit close-ups, joints): Attack_Heavy now reads from the side —
two-handed guard, hands above and behind the head, the chop driving forward over a bent front knee, the blade
following through toward the floor; Attack_Light's windup (blade chambered back over the shoulder) and overhead read;
Shoot no longer touches the head or crosses the chest; Guard, Hit, Dodge, Victory, Defeat, Interact (the hand now
reaches the floor), Breath (blade clear of the head, tail chain swinging) and Roar read; Downed ends prone with the
blade flat beside the head.

**Defects found** (fixed for round 3):
1. Attack_Light's hit blade pointed away from a side camera; the solver still missed it by 49°. A probe of that one
   pose showed why: the hit target sat 11 cm closer than a straight-armed reach, so the solver folded the elbow across
   the body to hold the hand there, and from a folded elbow the blade cannot point left-down. With the hand at a
   straight-arm reach and the blade weighted 40 the miss is 3–13°. → hit targets at full reach; the blade weighs 30
   by default (a few cm of hand position are invisible, the blade line is not); and a blade still outside the cone is
   re-aimed at the nearest direction on it around the solved forearm and solved again.
2. Downed's topple and Revive's all-fours flung the legs up behind: when the pelvis tips forward the thighs must flex
   forward by the same angle to stay upright over the knees, and `kneel_legs` extended them instead (my sign error).
3. SitRest held the blade straight up in front of the face: the knuckle constraint fought the pronation the blade
   needed. → constraint dropped; the blade laid across, left of the right knee.
4. Attack_Dual's resting sword hand crossed the chest at the off-hand strike. → held low at the side, point forward.
5. Cast's weapon covered the face during the gather. → the weapon hand beside the face.
6. Breath's face aimed ~35° below level at the release. → the head lifted 14°.
7. The run was still a little crouched at mid-stance; kept (it reads as a run at 200 px; see open items).

#### Phase 5 · Clips round 3 — 2026-10-28 — blades inside the wrist's cone, kneeling fixed, first export

**Changed.** Blade weight 30 / position 120; a blade still outside the 52–114° cone after solving is re-aimed at the
nearest direction on the cone around the solved forearm and solved again. Attack_Light's hit at a straight-arm reach;
`kneel_legs` flexes the thighs by the pelvis' tip; SitRest's blade across the knees; Attack_Dual's idle sword hand
low at the side; Cast's weapon beside the face; Breath's head lifted. First full export.

**Renders read** (quick: 19 strips, close-ups, joints, `poses_200.png`): **Attack_Light now reads as a cut** —
blade chambered over the shoulder, over the head, a straight-armed hit with the blade sweeping down-left, the follow-
through past the left hip; Attack_Heavy reads from guard to chop; Downed's topple goes onto the knees and over the
hands; Revive has a real all-fours; SitRest rests the blade across the knees; Cast charges with the weapon beside
the face; Breath aims the face level. Guard's blade now hangs diagonally across the body from the hand by the temple
(a hanging guard) rather than pointing forward — kept: it reads as a block and stays 7 cm (broad) / 1.3 cm (slight)
clear. **All 19 read at 200 px**, including the three hit frames. The 135° elbow folds without collapsing.

**Export.** `hero_clips.glb` 1,073 KB; re-import: 0 meshes, 1 armature `Rig` (65 bones), 19 animations;
`inspect-glb.ts`: 19 animations × 195 channels (translation, rotation and scale on all 65 joints); every duration
matches `clips.json` at 30 fps.

**Defects found** (fixed in round 4):
1. Downed's arms swept through the floor between the catch and the final pose (26 cm under at f22; blade 9 cm into
   the floor). → the palms stay planted from the catch to the end: prone, palms beside the head, the sword fist on its
   knuckles with the blade along the floor.
2. Revive's planted fist pushed the cross-guard 9 cm into the floor, and its lift key swung the left arm through the
   floor. → fists 9 cm up (the guard clears), lift key dropped (Revive starts from the planted palms).
3. The off hand slid 8–9 cm off the two-handed grip at Attack_Heavy's windup and follow-through: the broad and slight
   frames pulled the shared solve apart. → the broad frame leads (slight weight 0.45).
4. The tail chain dipped 6–9 cm into the floor when sitting or lying on the back. → lifted further.
5. SitRest's left hand passed through the floor between the hand behind the hips and the knee. → an in-between key
   lifts it at the side.
6. The run's blade grazed the slight frame's thigh (−3 cm at f8). → less ulnar deviation.

#### Phase 5 · Clips round 4 — 2026-10-28 — planted palms, guards off the floor

**Changed** (round 3's defects 1–6): Downed keeps both palms planted from the catch to the end (`palms()`: left palm
flat, the sword fist on its knuckles 9 cm up with the blade along the floor); Revive starts from those palms (lift key
dropped); the broad frame leads the two-handed grip; tails lifted further when sitting or lying; SitRest's left hand
lifts at the side between the floor and the knee; the run's sword hand less ulnar. Renders: only the changed clips.

**Renders read:** Downed now ends prone with both palms beside the head and the blade along the floor — no arm sweep;
Revive pushes up from the same palms to a real all-fours, kneels, rises. Run, SitRest, Defeat and Attack_Heavy
unchanged to the eye.

**Numbers** (`art/build/clips_checks.txt`): Downed's worst dip went from 26 cm (arm sweep, f22) to 18 cm at f11 —
the knees reach the floor a frame early on the way from the crouch to the kneel; the broad frame's guard now clears
the floor (2.4 cm) but the slight frame's still dips 8 cm (shorter arms, same angles). Revive dips 15 cm at f31
(rising off the back knee). Tails still 3–7 cm under the floor when lying on the back. The two-handed grip still slips
7–9 cm at the windup and follow-through; the broad-leads weighting did not move it — it is the reach of the left arm
around the overhead blade, not the two frames.

**Left as is** (the brief's round limit; listed in the report): the four dips above, the grip slip, Interact's hand
10–17 cm above a floor item, Attack_Dual's weaker second strike.

*Lead check of round 4: `inspect-glb` 65 joints, 19 animations × 195 channels; the build log ends `exit 0`; the Downed and Revive strips read on both frames.*

#### Phase 5 · Clips round 5 — 2026-10-28 — Guard_Shield (coordinator's request)

**Why.** The weapons pass found that `Guard` holds the left fist at the chin, knuckles up, so a shield on
`Socket_HandL` (board facing +X = the back of the hand, point toward +Z = the fingers) shows edge-on and upside down.

**Built.** `Guard_Shield` (1.0 s, `brace` 0.133 — Guard's stance, timing and brace frame): the shield hand solved to
"back of the hand at the enemy, fingers down" (`reach(blade=D(-1,0,0), edge=D(0,0,-1))`, started from the weapons
pass's test pose), elbow up in front of the chest, forearm hanging, hand 43 cm out at belly height. The other 19 clip
definitions are untouched; the new clip is appended last. Renders show the S kite shield from `art/build/weapons.blend`
on `Socket_HandL` (identity transform, as the client attaches it).

**Read** (`Guard_Shield.png`, both frames): board face to the enemy within 9°, point down, top at chin height (1.55 m
broad, 1.48 m slight), point at the knee; at idle the shield hangs at the side, face out.

**Defect found and fixed:** on the slight frame the sword's line ran through the board at the brace (f4–f5, found by
ray-casting the blade against the shield mesh on every frame). → the sword hand hangs lower and further back, blade
straight ahead and slightly out: nearest blade-to-board 36 cm (broad) / 25 cm (slight); blade 26/20 cm clear of the body.

**Export.** `hero_clips.glb` 1,105 KB: 20 animations × 195 channels, re-import 0 meshes / 1 armature (65 bones) /
20 animations; every duration matches `clips.json` (20 clips).

### The weapons pass

#### Phase 5 · Weapons round 1 — 2026-10-28 — every family in F and S, first sheet, first fits

**Built.** `hero/build_weapons.py` opens `art/build/hero_body.blend`, builds every mesh procedurally (a small bmesh kit in
the script: lofts along an axis or a curve, lathes, tori, blade and axe-head lofts, extruded outlines, a curved shield
board), saves `art/build/weapons.blend` and exports `weapons.glb`. One family per `weaponType` in `content/items`
(16: sword greatsword axe greataxe mace maul spear dagger throwingKnife shortbow longbow crossbow staff wand censer
focus) plus `wpn_focusHoly` (the Mender's holy symbol: also weaponType `focus`, told apart by `meshIds`), the three
shields `shd_shieldBuckler/Kite/Tower` (names carry the content `weaponType` verbatim) and the Ranger sheet's quiver
(`qvr_quiver` + `qvr_arrowsFull` / `qvr_arrowsHalf`; empty = no arrows mesh) — 23 families × F/S = 46 meshes. Palette
slots per face through `toon.split_by_face_slots`; hard edges kept as per-corner custom normals by angle, per part
(blades 12°, guards 30°, round parts 55°+), re-applied after the split by matching corners. Custom properties (glTF
extras): `kind tier socket weaponType hands meshIds` (+ `offhandY` on two-handers, `stringX stringZ nockY` on bows,
`variant` on the holy symbol, `fill` on the arrows).

**Measured before modelling** (fist pose on `Rig_broad`, vertices in socket space): the fist spans y −0.078…+0.055
around `Socket_HandR/L`'s origin and closes onto the socket's Y axis (2 mm at y = 0), so a 1.4–1.9 cm grip is buried in
the fingers as a held grip should be; guards start above y +0.058 and pommels below −0.085. The forearm stays below
z −0.086 and never comes nearer than 8.9 cm to the Y axis, so nothing along Y can reach it. `Socket_Back` sits 4–5 cm
off the shoulder blades and 11–13 cm off the small of the back.

**Renders read:** `weapon_sheet.png` (all 46, true lengths and tris), `read200_sheet.png` (the hero holding each at
200 px), `fit_*_apose.png` (front · side · close-up, fist pose; every S and the F sword, greatsword, bows, shields,
quiver), `fit_shd_*_S_guard.png`. The sockets are right: a held blade points forward out of the thumb side with its
edges vertical and the axe edge on the knuckle side, grips sit in the fist, pommels and two-handed grips run out past
the little finger, nothing enters the forearm.

**Defects found and fixed for round 2:**
1. The fit renders showed the body without the weapon: the held copies inherited `hide_render` from the sheet pass.
   → copies are un-hidden when held.
2. Every torus rendered black (the orb's straps and glow ring, the censer chain, the knives' ring pommels). An isolated
   test: a 4 mm tube under the 4 mm inverted-hull outline is all outline; 8 mm and up are fine; straight rods are not
   affected. → every torus tube ≥ 7 mm (the client's outline will do the same to thinner ones).
3. Bowstrings ran through the bow hand's wrist (the brace line sits at z ≈ −0.12, the forearm starts at −0.086).
   → both bows canted 22° about the grip axis so the string passes the palm side, as an archer cants; the string line
   and nock are exported (`stringX`, `stringZ`, `nockY`) so the client can draw a pulled string to the draw hand.
4. Bow limbs and the F leather string vanished at 200 px. → limbs ×1.25–1.3; the F string is `bone` (pale sinew) at
   5 mm — a deliberate exception to "F = metal / wood / leather" (a leather string is invisible on dark rooms).
5. Heads too small for their hafts at 200 px: greataxe ×1.3, axe ×1.25, mace ×1.2, spear blade 27 → 36 (F) / 46 cm
   (S), dagger ×1.15, throwing knives ×1.2, a bigger wand tip, staff heads (F: a knotted 9 cm knob under the copper
   cap; S: a 12 cm gem in larger prongs).
6. The kite's and tower's "bands" were whole board sections. → dedicated 3–4 cm stations for the straps.
7. The greatsword S's parrying lugs were invisible. → 7 cm hooks.
8. The quiver stood ~6 cm off the back in the side view. → 5 cm closer and leaned 8° to follow the back's slope.
9. The sheet labels printed the diagonal extent (0.66 m for a 0.92 m sword). → the true length.
10. Mace S (548) and holy symbol S (608) were over the 500 budget. → unchamfered flanges, a triangular glow ring.

**Decisions taken (report to the lead):** shields face +X (the back of the left hand) with the long axis along the
forearm, point toward the fingers — right in the A-pose and the hanging-arm Idle / Walk / Run; the clips pass's Guard
(fist up at the chin, knuckles up) shows it edge-on and upside down, a guard with the arm hanging forward and turned in
(the test pose here, `LeftUpperArm (32, 80, −14)`, `LeftLowerArm 22`) faces it at the enemy. Bows stay on
`Socket_HandR` (the contract; the clips pass draws with the left hand), so the quiver's mouth is over the left
shoulder. `content/items` has no `whip` weaponType yet (the Beast Tamer's), so no whip mesh.

#### Phase 5 · Weapons round 2 — 2026-10-28 — the round-1 fixes

**Built.** The ten round-1 fixes above; thin rods (strings, shafts) and tori now shade fully smooth (fewer split
vertices, rounder tubes). 46 meshes, 14,312 tris; every mesh inside its budget (one-handers ≤ 500, two-handers and
shields ≤ 800, bows ≤ 600; the largest: kite F 654, tower S 650).

**Renders read:** `weapon_sheet.png`, `read200_sheet.png`, every `fit_*_apose.png` and `fit_shd_*_S_guard.png`.
Confirmed: the tori read in colour (knife ring pommels, the orb's straps and glow ring, the censer chain); the canted
bowstrings pass the palm side, behind the wrist from outside, never through it; the bigger heads read at 200 px
(greataxe, axe, mace, spear, staff); the kite's iron and the tower's leather / trim straps are narrow bands; the
greatsword's lugs show; the quiver touches the shoulder blades and its mouth sits over the left (draw) shoulder. The
export: COLOR_0 exact on all 46 meshes, identity node transforms, extras on every node.

**Defects found and fixed for round 3:**
1. The F crossbow's leather string still vanished (the bows' fix had not reached it). → `bone`, 4.6 mm.
2. The F spear's 36 cm leaf still read as a stick end at 200 px beside the S's 46 cm. → 41 cm long, 13 cm wide.
3. `weapons.glb` is 632 KB: 17k exported vertices for 14.3k tris, because hard edges split vertices. Accepted —
   models are runtime-cached, not precached (`10` §4); what remains is the faceted look itself.

**Left as is:** the dagger, the throwing knives and the wand read as small glints at 200 px — their size is their type
(already oversized 10–20%); the S glow and gem still tell S from F at that size.

#### Phase 5 · Weapons round 3 — 2026-10-28 — final

**Built.** The two round-2 fixes. Final: 46 meshes, 14,312 tris, `weapons.glb` 632 KB (no rig, no materials, outlines
removed, every node at the origin with an identity transform).

**Renders read:** `weapon_sheet.png`, `read200_sheet.png`, the fits. The F crossbow's string now reads; the F spear's
leaf reads at 200 px. Every family reads in F and S at 200 px, and F (grey iron, brown wood and leather, plain shapes)
is told from S (trim fittings, a glow fuller or rune, a gem, a shaped guard or head) at a glance.

**Export checked:** `inspect-glb.ts` — 46 meshes, attributes POSITION NORMAL COLOR_0, COLOR_0 worst distance from a
whole code 0.0000 on all 46; every node carries its extras; `--check` re-import: 46 meshes, colour attribute present,
none skinned. Renders are `--quick` (8 samples; the laptop is shared).

**Still open (for the lead):**
1. Shields vs the clips pass's `Guard`: its left fist is up at the chin with the knuckles up, which shows a shield
   edge-on and upside down. For shield bearers the Guard wants the back of the left hand toward the enemy and the
   fingers down (`reach(... blade=D(-1, 0, 0), edge=D(0, 0, -1))`, or this file's test pose `GUARD_L`). Turning the
   boards 90° (long axis along the grip) would suit a forearm-across-the-chest guard instead, but then a hanging arm in
   Idle / Walk / Run shows the shield lying flat.
2. The braced bowstring is part of each bow mesh. For `Shoot`, the client should draw a pulled string from the nocks
   (`±nockY`, `stringX`, `stringZ`) to the draw hand; hiding the braced one needs it split into its own mesh.
3. One mesh per `weaponType`: the crook, reliquary and greatstaff share the staff; the hand crossbow and the arbalest
   share the crossbow (`hands: 2`); the holy symbol is the second focus (`wpn_focusHoly_*`, matched by `meshIds`). No
   whip: `content/items` has no `whip` weaponType yet.
4. The dagger, throwing knives and wand read as small glints at 200 px (see round 2).
5. The fist closes onto the hand socket's axis, so every grip is hidden inside the fingers. It reads as held, so no
   socket change is needed.

### The gear pass — Warden and Blade

#### How the sets are built (both classes)

`gear_lib` makes a piece from body faces pushed out or from free geometry bound to the broad body. A shell of the body
copies the anatomy (a breastplate with pecs) and costs the body's triangle density (a hand shell alone is 770 tris),
so both sets are built from **envelope fields** instead (`gear_loft.Field`: the body's convex outer section around an
axis — the torso, a limb — sampled as radius over station × angle; `gear_loft.Sphere`: radius over elevation × azimuth
from a centre — the skull, the shoulder). A plate is a patch over a field (a cuirass whose top follows the armholes, a
tabard panel, a tasset arc, a bell cuff), pushed out by its stand-off, bound vertex by vertex to the nearest body
triangle of its own limb (`Forge.bind` with a face filter: a thigh plate never binds to the other leg), so it follows
both frames and every species key like any bound point. Each part is then realized with `gear_lib.realize`, its skin
weights shaped by a rule (allowed bones — the cuirass ignores the arms; rigid — the helmet rides the head; smoothed;
capped — a pauldron follows the upper arm at most halfway), pushed clear of the body in the basis **and every species
key**, and clear of the layers under it (only where the collider's face looks the same way as the body under the
vertex: lips and flanges never push), then the parts are joined into the slot's object. Left-side parts are built once
and mirrored. Openings over hidden regions get a **flange** (a row on the skin), so a dropped region never shows
through, and the review renders draw the body with the hidden regions removed and single-sided, as the client will.

**Palette use (for the client pass).** F wears raw metal (`metal`) with rivets, no crest and no glow; S wears the class
finish (`cloth1`: slate blue for the Warden, charcoal mail for the Blade) with `trim` rims and bands (the grade
colour), extra lames/pieces and `glow` lines. Tabards, under-tunics `cloth2`/`cloth3`; straps, belts, boots `leather`.
Review palettes: F trim grey `#a3a3a3`, S trim red `#d24a3c` (S = Legendary, red, `03` §6.2).

#### Phase 5 · Gear round 1 — 2026-10-28 — Warden: first full set

**Built.** `gear_loft.py` (fields, spheres, binding with a face filter, weight rules, clearance, joins, the review
loop) and `build_gear_warden.py`: helmet (sallet), chest (cuirass, collar, pauldrons, rerebraces, couters, tabard,
belt), legs (skirt lames, tassets, cuisses, poleyns), boots (greaves, sabatons), gloves (vambraces, bell cuffs, mitten
gauntlets), F and S, both frames. Source: `hero_species.blend` had landed during the run, so the species keys carried.

**Renders read:** `set_*`, `ortho_*`, `gear_sheet_*`, `poses_*`, `species_broad.png`.

**Defects found and fixed:**
1. Every species part (beards, horns, tail, Halfling feet…) showed in the renders: the review hid only gear and body
   objects by name. → `Review.show` hides every mesh it is not asked to draw.
2. The pauldrons shattered into spikes: their rays kept the *farthest* hit, which ran through the torso to the far
   side. → `Sphere(first=True)`: the first surface out of the shoulder.
3. Species renders had gorilla arms: bone scales compounded down the chain. → the species pass's convention (absolute
   scale = root × group factor, eyes and chain bones inherit), `gear_loft.apply_bone_scales`.
4. F 5,452 / S 6,254 triangles, far over 4.5k. → (round 2)

#### Phase 5 · Gear round 2 — 2026-10-28 — Warden: budget, pauldrons, knees

**Defects found and fixed:**
1. The pauldrons still splintered: the clearance against the layers underneath pushed vertices along the normals of
   lips and flanges (thin open shells face every way). → a collider pushes only where its face looks the same way as
   the body under the vertex and the vertex is less than 3 cm under it; one push ≤ 3 cm.
2. Over budget. → fewer columns and rows everywhere (cuirass 18/20, limbs 8–10, a 3-row sabaton lame), the knee and
   lame lips without inner returns: F 3,674 / S 4,166.
3. Dark see-through bands at the knees: the cuisse ended above the greave and both regions were hidden. → the cuisse
   runs to the knee joint and the greave starts above it, both closed by flanges.
4. The collar stood up over the chin like a funnel. → a low gorget: 1.405 → 1.47 m in front, 1.49 m behind.
5. Glow squares on the cuffs read as noise. → a thin glow ring.

#### Phase 5 · Gear round 3 — 2026-10-28 — Warden: silhouette, tabard, overhead

**Renders read:** `set_*`, `ortho_*`, `read_200_all.png`, `joints_*`, `poses_*`, `species_broad.png`, and a scratch
close-up of the upper back.

**Defects found and fixed:**
1. A dark patch on the lower tabard: its inward-facing back layer showed its outline hull through the front. → one
   single-sided panel, like every cloth panel here (from behind it reads dark through the outline, which is fine).
2. The pauldrons were no wider than the arms: no trapezoid. → the dome a size up (×1.1), thicker over the crown, the
   outer edge flared away from the arm.
3. With the arms overhead the pauldrons swallowed the head. → they follow the upper arm at most halfway
   (`Part(cap={UpperArm: 0.5})`); the face now stays clear.
4. The ears poked out through the sallet's sides. → the sides come down to −34°.
5. Glow squares on the pauldrons. → a glow line across each dome's outer face.
6. The collar's lower edge cut into the tabard's top. → the tabard is built before the collar, which sits over it.
7. (seen in the close-up) The cuirass showed through the back tabard panel across the shoulder blades (one flat facet
   from 1.40 to 1.25 m over a curved plate), and the shoulder blades were uncovered between the cuirass's back
   armholes and the pauldrons — see-through holes once `chest` is hidden. → (round 4)

#### Phase 5 · Gear round 4 — 2026-10-28 — Warden: the upper back

**Defects found and fixed:**
1. Plate through the back tabard. → rows every 5 cm over the shoulder blades, 4 mm more stand-off there.
2. Holes over the shoulder blades. → the cuirass's top stays high further round the back (1.30 + 0.144 · (1 − |sin θ|^2.5));
   the pauldrons' back edges come 7° lower.
3. Added to the review: a fist close-up (the mitten curls with the fingers; the bell cuff's glow ring reads) and the
   upper back.

**Result.** F 3,686 / S 4,234 triangles (helmet 282/322 · chest 1,580/1,812 · legs 628/744 · boots 600/680 · gloves
596/676). Reads at 200 px as the broad plate trapezoid with the two-tone tabard; F (raw grey, rivets) and S (slate
finish, red rims, crest, haute-pieces, glow) are told apart at a glance. Fits both frames; the Dwarf and Orc renders
carry the species keys. `gear_warden_<frame>.glb` 729 KB each.

**Still open:** the pauldrons crowd the head in a full overhead raise (the face stays visible; the clips may lift
the shoulder bones too) · the sallet's lower back edge reads a little jagged close up · the gauntlets are slender
next to the pauldrons · no species variants yet (Orc/Draconid open-face helm, Draconid tail split in the skirt and
tabard, horn sockets) · the ear lobes show under the sallet's side edge.

#### Phase 5 · Gear round 1 — 2026-10-28 — Blade: first full set

**Built.** `build_gear_blade.py`: helmet (open mail coif from a convex-profile sphere with the face opening as a
hole, brow band and nasal bar; S adds a spangenhelm cap with trim ribs and a glow lozenge), chest (hauberk to
mid-thigh, cinched waist, skirt split front and back below 0.73 m with the linen under-tunic showing at the hem, mail
sleeves to the elbow over linen to just past it — bare forearms —, high collar, a leather baldric shoulder to hip,
one spaulder on the lead (left) shoulder, belt), legs (mail trunks hoop and chausses, two leather thigh straps a leg,
S knee cops), boots (buckled riding boots with a turned-down cuff, S steel toe caps), gloves (fingerless leather
half-gauntlets with a back plate and a short cuff). F 3,288 / S 3,498 triangles. (The machine stopped during this
round's pose renders; the run was repeated in round 2.)

**Renders read:** `set_*`, `ortho_*`, `gear_sheet_*`.

**Defects found:**
1. The coif hung a bib from the nose to the chest: the face opening stopped at the mouth and the fully convex profile
   filled everything under the jaw. → (round 2) the opening runs to under the chin, the profile is 45 % convex, the
   drape stops at −53°.
2. The single spaulder read as a small flap at 200 px. → (round 2) a size larger (×1.08), thicker, the outer edge
   flared.
3. The upper thigh strap's buckle poked through the hauberk's skirt. → (round 2) both straps below the hem.

#### Phase 5 · Gear round 2 — 2026-10-28 — Blade: coif, spaulder, straps (and the poses)

**Renders read:** `set_*`, `ortho_*`, `read_200_all.png`, `poses_*`, `joints_*`, `species_broad.png`.

**Fixed from round 1:** the face opening now runs to under the chin, the spaulder reads (×1.08, flared outer edge, an
etched glow line at S), both thigh straps sit below the hem. The poses hold: the skirt halves part at the slits in
the lunge and the run, sleeves and boots bend cleanly, the species keys carry (Dwarf, Orc).

**Defects found:**
1. The coif still hung a bib under the chin with a zigzag hem. → (round 3) a quarter-convex profile, more smoothing,
   the drape stops at −50°.
2. The nasal bar floated 2 cm in front of the nose (a wire seen side-on). → (round 3) 4 mm over the hood.

#### Phase 5 · Gear round 3 — 2026-10-28 — Blade: the hood and the fist

**Renders read:** as round 2, plus the new fist and face close-ups in `joints_*`.

**Defects found:**
1. The brow band and the coif's front jutted forward like a visor: the nose's long rays, dilated and smoothed, raised
   the hood's envelope over the whole forehead. → (round 4) the envelope ignores the face from the brow to the chin
   and is no longer dilated; the rigid helm is still pushed clear of the nose by the clearance pass.
2. A leather spike out of the fist: knuckle-edge glove vertices bound to triangles carrying finger weights were
   dragged into the fist. → (round 4) glove weights on the hand and forearm bones only.

#### Phase 5 · Gear round 4 — 2026-10-28 — Blade: the hood's face, the glove's end

**Renders read:** `joints_*`, `ortho_*`, `read_200_all.png`, and a scratch close-up of the left hand (body alone,
glove alone, both).

**Defects found:**
1. The visor was gone, but with the whole lower face out of the envelope the hood's chin rows sank into the chin and
   the clearance pass pushed them up over the mouth. → (round 5) only the eyes and nose (1.585–1.665 m) are left out.
2. The spike was still there — and in the rest pose too, so not the weights: the glove's inward flange (a row on the
   skin, there to hide dropped regions — but the Blade's hands are not dropped) closed the open end to a dark point,
   and with three rows the palm and the thumb's root poked through the leather. → (round 5) an outward lip instead
   of a flange, five rows of ten, 7–9 mm stand-off.

#### Phase 5 · Gear round 5 — 2026-10-28 — Blade: glove fixed, the nasal bar

**Fixed from round 4:** the fist is clean (leather over the back and palm, open at the knuckles, no spike); the hood's
opening sits under the chin with the mouth clear.

**Defect found:** with the eyes and nose out of the hood's envelope, the nasal bar's path ran inside the nose and the
clearance pass threw it sideways into a flap over the eye. → (round 6) the nasal is placed by its own rays to the
farthest head surface (brow, bridge, tip) plus 6 mm, independent of the hood's envelope.

#### Phase 5 · Gear rounds 6–8 — 2026-10-28 — Blade: finishing (and one change for both sets)

**Renders read:** all of `blade/`, the re-import sheets of both classes (`reimport_check.png`: F and S on both frames
rendered from the exported `.glb` alone), and scratch close-ups of the shoulders on the slight frame and on the Orc.

**Defects found and fixed:**
1. (round 6) The nasal bar now runs down the middle of the face over the nose. The F hood's crown let the scalp show
   through between vertices (smoothing lowers a convex envelope's peak). → 13 mm over the skull.
2. (round 7) A thin dark thorn at the left shoulder in several poses: the baldric's ribbon ends reached the collar
   and were pushed up by it. → both ends start lower, under the spaulder, and clear only the hauberk.
3. (round 7) Black folds on the Orc's hauberk at the upper chest: under the Orc key the deltoids bulge and the
   clearance pushed single vertices far past their neighbours. → `Forge.clear` now spreads every push over the
   mesh (three smoothing passes of the displacement, coincident vertices together) and checks again, so a pushed
   vertex drags its neighbours instead of folding the faces round it. This changes every piece of both classes, so
   the Warden was rebuilt too (Warden round 5: no visible change, the Dwarf and Orc renders stay clean).

**Result.** F 3,432 / S 3,666 triangles (helmet 500/626 · chest 1,164/1,216 · legs 584/656 · boots 688/688 · gloves
496/480). Reads at 200 px as the lean metal class with no shield — hood, short sleeves over bare forearms, the
baldric's diagonal, one spaulder, riding boots; F (raw grey mail) and S (charcoal mail, red hem bands, spangenhelm
cap, glow) are told apart at a glance. Fits both frames; the Dwarf and Orc renders carry the species keys.
`gear_blade_<frame>.glb` 622 KB each.

**Still open:** the coif reads as a chunky cowl, and its hem is still a little uneven where low rays land on the
collar or the trapezius · the spaulder is on the left (the lead shoulder of a right-handed stance); flip it if the
clips lead with the right · no species variants yet (Draconid hoodless helm with horn sockets and chausses split for
the tail, Orc coif opened for the tusks, Dwarf `hem_short`).

#### Both sets — exports, hides, notes for the lead

- **Exports** (`client/public/models/hero/gear_<class>_<frame>.glb`, via `gear_lib.export_class`): 10 meshes (5 slots
  × F/S), each skinned to the 65-joint `Rig`, COLOR_0 codes exact (`inspect-glb.ts`: worst distance 0.0000 on all 40
  meshes), the five species morph targets on every mesh, extras `slot tier class hides`. `reimport_check.png` in each
  class folder renders F and S on both frames from the `.glb` alone.
- **`hides`** (only regions a piece covers by itself, worn alone): Warden helmet — none (open face) · chest —
  `chest upperArms` (not `belly`: the cuirass stops at the waist and the plate skirt belongs to the legs) · legs —
  `thighs` · boots — `shins feet` · gloves — `hands forearms`. Blade helmet — `neck` · chest — `chest upperArms
  belly` · legs — `thighs` · boots — `shins feet` · gloves — none (bare fingers and forearms).
- **For the client:** species hair, beards, Orc ears/topknot and Draconid horns are separate parts that the helmets do
  not make room for — hide hair parts under a helmet (a rule, or a `hidesParts` prop the lead may want). Cloth panels
  are single-sided; from behind they read dark through the outline, as intended.
- **Library:** `gear_lib.py` untouched. Everything new is in `hero/gear_loft.py` (fields, spheres, filtered binding,
  weight rules incl. `cap`, layered clearance with spread pushes, joins, the review loop with hidden regions removed).
  Wanted from the lead: sparse morph targets in `lib/export.py` (the five species deltas are about half of each file);
  mesh data names keep the `.broad`/`.slight` suffix in the `.glb` (node names are stripped) — harmless, but
  `export_class` could strip both.

### The gear pass — Ranger and Shade

#### Round 1 — 2026-10-27/28 — the library and the first Ranger set

**Built.** `gear_rs_lib.py`: a piece is an ordinary mesh in broad-basis space (`MB`) whose every vertex is bound to a
body triangle (gear_lib "bind" sources), so `gear_lib.realize()` carries it to the slight frame and through every
species key, with skin weights blended from that triangle. Building blocks: `garment()` (a gear_lib shell with exact
plane-cut hems, smoothed so the anatomy softens into leather and cloth while staying a set clearance off the skin, then
simplified), `tube()`/`cuff()` (rings fitted to the body's cross-sections round a limb or the torso), `hood_shell()` (rows
fitted to the head from its centre, the face opening a clean curve, gathered at the neck, a drape), `face_mask()`,
`drape()` (cloth hung from a line under gravity, kept off the body), `ribbon()`/`edge_band()` (straps, seams, trim bands,
glow lines), `tiles()` (scales), `box()`/`blob()` (buckles, studs, pouches), `thicken()` (closed thin cloth with a lining),
`covered_regions()` (what a piece may list in `hides`), `poke_count()`, and the review harness (`review_class`,
`run_class`). The Ranger set v1 in `build_gear_ranger.py`.

**Renders read** (`art/renders/hero/gear/ranger/`): `read200_all.png`, `ortho_F_broad.png`, `ortho_S_broad.png`,
`gear_sheet.png`. The 200-px read already works: the hood point and the green mantle over cream sleeves and a brown
jerkin; F (all brown below the belt) and S (green leggings, red placket, glow seams) are told apart at 200 px.

**Defects found and fixed:**
1. The hood rendered black, its ink lining showing outside. Measured: `toon.apply_look`'s outline (Solidify thickness
   −4 mm, offset +1) leaves the hull where the surface was and moves the visible surface 4 mm in along its own
   normals — a lining closer than 8 mm swaps places with the outer cloth, and every gear-to-skin gap reads 4 mm wider
   than it is. → The review renders set the outline to thickness +4 mm, offset +1 (the hull outside, the surface
   where it is) on the bodies and the gear; cloth linings sit 10 mm inside (reported to the lead).
2. The hood came out inside out: the orientation check sampled a drape face, where "away from the head" is not
   "outward". → A majority vote over the upper rows (`orient_from`).
3. Blender's collapse decimator kept the dense plane-cut hems (≈120 vertices each) and stripped the torso to a few huge
   triangles (16 vertices per 10 cm band) — bad to look at and bad to bend. → `simplify_uniform()`: shortest edges
   first in independent sets, open-edge vertices slide only along the open edge (a cut hem stays on its plane),
   fold-overs refused; now 30–50 vertices per 10 cm band.
4. The poke count measured gear against the borders of the trimmed body. → Measured against the whole posed body,
   skipping skin in hidden regions; the species blend saves `Body_*` with an `Outline` modifier, so the body is
   evaluated with the armature only.
5. Limb rings caught the other limb in their slab (a thigh strap would circle both thighs) and the belt caught the
   sleeves at the same height. → Sections keep to the limb's own side; the belt fits only torso points.
6. Coverage misses: the collar plane sat under the chest region's top at the sides, the armpit crease (rays run into
   the torso), one belly vertex at the hem. → The collar plane raised 1.7 cm, a ray blocked by the body counts as
   covered, the hem at 0.806 m (above the crotch at 0.802).
7. Over budget: F 4,772 / S 5,775 triangles for the five pieces. → Simplification ratios cut (jerkin 0.21, leggings
   0.22, mantle 0.3, glove 0.32), the hood 12 segments, bigger mantle scales.
8. Toes showed through the boots (a smoothed shell still follows each toe tip). → `boot_tube()`: one tube bent at the
   ankle, rings fitted to the shin and foot sections (the polar maximum fills between the toes), a flat sole, a toe cap.
9. The knee patches were flat tiles sticking out at the sides like flaps. → `patch()`: a conforming shell on the kneecap.

**Decided on the way:** the bow is in the right hand (`build_weapons.py` BOW_SOCKET = Socket_HandR; `build_clips.py`
draws with the left), so the bracer is on the right forearm and the three-finger glove on the left hand. The quiver is
the weapons pass's (`qvr_quiver` on Socket_Back); not built here.

#### Round 2 — 2026-10-28 — Ranger: budget, boots, patches, the first full review set

**Changed.** The fixes above; the review outline fixed; uniform simplification; tube boots; conforming knee patches.
The interrupted round-1 run had crashed in the poke count (the species blend's `Body_*` carries an `Outline` Solidify,
so its evaluated vertex count no longer matched its codes) — the body is now evaluated with the armature only.

**Renders read:** `sets_sheet.png`, `poses_sheet.png`, `pose_run_S_broad.png`, `gear_sheet.png`, `read200_all.png`.
Export checked with `inspect-glb.ts`: every piece skinned to the 65-joint rig, COLOR_0 exact (0.0000), the 5 species
morph targets on every piece. Triangles: F five-piece 3,926; S 4,806 (chest S 1,796).

**Defects found (fixed in round 3):**
1. The toe tips and heels poked through the boot ends (the last ring stopped 1.2 cm short of the toes; the bend
   rings' slabs missed the heel). → The last ring past the toe tips; a slab 1.7× wider round the bend.
2. A strap in the S stride stretched from one ankle to the other knee: the S ankle straps were fitted to the boot's
   own sparse ring vertices and caught a ring from the bend (a flat collar standing off the instep in Idle). → Straps
   are now bands lifted off the boot's own rings (`ring_band`), so they follow the boot.
3. The hood's flared drape ring (z 1.43, radius 0.24) was bound to *neck* triangles 17 cm away — its edge would swing
   with the head. → Drape vertices more than 10 cm from the neck axis bind to the shoulders.
4. Dark lining specks through the hood where the 10 mm inward copy crossed concave rows. → 7 mm lining (the review
   outline no longer moves surfaces, so a thin lining is safe).
5. F read as one brown mass from the belt down (rawhide jerkin over rawhide leggings). → F leggings dark bark with
   leather knee patches, F boots leather with a bark fold — alternating values at 200 px.
6. S over budget. → Jerkin 0.19, mantle 0.25, larger and fewer scales, one trim band on the mantle hem.
7. The test poses were wrong: on this rig a positive Z on the left upper arm *raises* it (measured: Z −40 drives the
   hand into the hip), so "idle" rendered a T-pose and "reach" was not overhead. → Poses rewritten from measured
   signs (left arm +Z up, left leg +Z out, knees −X, the right side mirrored).
8. The coverage test failed the throat under the jaw (normals point steeply down, rays run down the gap): the closed
   hood front hides it from every camera. → `covered_regions` now asks whether a viewer can see the vertex: a fan of
   rays over its hemisphere (no views from steeply below) must all hit the piece or the body outside the region.

#### Round 3 — 2026-10-28 — Ranger: correct poses, the first species renders

**Changed.** Round 2's fixes (boots to the toe tips and round the heel, straps along the boot's rings, drape bound by
radius, 7 mm lining, F value contrast, S budget, measured pose signs, the visibility-fan coverage test).

**Renders read:** `poses_sheet.png` (the poses now read: arms down, a stride, the overhead windup, lunge, crouch, arms
up), `pose_heavy_S_broad.png`, `pose_crouch_F_broad.png`, `species_sheet.png`, `species_elf_F_slight.png`. Toes and
heels no longer show; the S straps follow the boots.

**Defects found (fixed in round 4):**
1. The species renders showed skin through the leggings, the sleeves and the jerkin — and a debug render showed the
   same holes on the slight frame with no species key at all. Measured: every legging *vertex* sat outside the skin,
   but the simplified *faces* between them sagged into it (a 5 cm chord over a thigh sags ~6 mm, the whole offset;
   on the slight frame's wider thighs more). → `inflate_faces()`: every face sampled at its centre and edge midpoints
   and pushed out until the face itself keeps the clearance. After it: 0 legging faces under the skin at rest on the
   broad frame, 1 on the slight, ≤ 7 under the strongest key (Dwarf), each < 9 mm.
2. The simplifier collapsed the cut hems first (their plane cuts leave many tiny boundary edges): ankle hems became
   8-gons, the waist an 11-gon. → Boundary edges count as 2.5× their length.
3. The new coverage fan was too strict the other way: grazing rays slipping out through a hem gap counted as
   "visible". → Rays only within 55° of the skin normal and not from below (game cameras sit level or above).
4. In the overhead windup (the clips pass's `Attack_Heavy` raises both hands above the head, upper arms 150°, like the
   test pose) the hood's drape folds over the rising shoulders and its black lining flashes. → The drape is lined in
   its own green; the dark lining stays round the face, where it reads as the hood's depth.
5. The jerkin's minimum clearance (6.5 mm) sat too close to the leggings' 5–6 mm where they overlap at the waist. →
   8.5 mm.
6. Idle brought the hands together in front of the groin. → Arms relaxed at the sides.
7. Species renders only showed the body and gear. → They now include the species' own visible parts (Elf ears, Orc
   tusks…; a part replacing a region the set hides — Halfling feet under boots — is left out, as the client should)
   and a head close-up, so a hood against Elf ears is seen, not assumed.

#### Round 4 — 2026-10-28 — Ranger: faces kept off the skin; Shade round 1

**Ranger renders read:** `sets_sheet.png`, `set_S_broad_back.png`, `poses_sheet.png`. No skin through the leggings on
either frame; the boots end past the toes; the S scale mantle reads; F alternates warm leather and dark bark. Hides
now: chest piece belly + upperArms, legs thighs + shins. Triangles F 3,793, S 4,561 (trimmed below).

**Ranger defects found (fixed in round 5):**
1. Inflated independently, the leggings now pushed through the boot shafts (green patches on the S calves) and the
   jerkin's lower back; the inflated sleeve pushed through the right bracer. → Layering by reference: the leggings'
   shell and the jerkin are built once per run and shared by both tiers; the jerkin's and the boots' faces are inflated
   to clear the leggings' shell by 4.5 mm, and the bracer and wrist cuff are fitted round the sleeve's own surface.
2. Black squares on the hood near its opening: the review outline's hull pushed the lining out through the 7 mm gap
   at the rims (no lining vertex is outside the hood — checked). → The hull is kept off surfaces that face the body
   (`hull_off_linings`); a review-render matter only.
3. S over budget by ~60. → Scales with 6-point outlines, one boot ring fewer: S 4,473.
4. Gaps a camera could look down: the collar (chest region), the wrist cuff (forearm), the boot soles 1 mm above the
   body's sole. → Collar and cuffs turned in toward the skin, soles at −6 mm.

**Shade round 1 built and read** (`art/renders/hero/gear/shade/`: `sets_sheet.png`, `read200_all.png`,
`gear_sheet.png`). It reads as intended at 200 px: a black hood with a grey (F) or violet (S) half-mask, a black
jerkin broken by the violet/red diagonal closure, grey wrapped forearms and legs, black split-toe boots, the knife
belt; from behind, the grey cloak falls from the left shoulder to the right hip. F/S distinct (violet mask, red trim,
glow lines). F five-piece 3,422, S 4,132 tris; cloak and knives extra.

**Shade defects found (fixed in round 2):**
1. The half-mask was a boxy visor standing far off the face, with "wings" poking out of the hood at the sides (a
   dilated profile, widened ±24° over the ears). → `half_mask()`: a tight profile, no side widening, columns only to
   ±60° (under the hood's edges), and a hanging rule — going down a column the cloth never moves back toward the face
   until the chin, so it falls from the nose like cloth, then wraps under the chin.
2. The cloak read as a flat board; its front part a flat bib; the diagonal invisible from the card angle. → The front
   hem rises from the sternum to the shoulder (a diagonal seen from the front), the cap over the shoulder stays short
   (the arm moves under it), the back falls to a corner that swings out past the right hip (seen from the front-right
   card camera), soft vertical folds deepen toward the hem. `drape()`'s flare was being added at every row (a 9 cm
   billow instead of 3.5) — now applied as a total.
3. Grey teeth at the jerkin's hips: the leggings through the jerkin (as on the Ranger). → The same layering by
   reference (leggings and the wraps under the jerkin).
4. Wrap lines and boot wraps looked broken: the spiral strips dipped under the surface between samples, the boot bands
   z-fought with the inflated boot. → 14 samples a turn at 2.5 mm; boot bands lifted off the boot's own rings.
5. The knife handles were too small and dark to read. → Longer light-grey grips, a steel guard, a trim pommel.
6. The boots let the outer toes through (the toe ring was centred on the big-toe side) and the feet showed down the
   ankle boot's shaft from above. → The toe ring centred on the toe box; the boot top taller (0.33 m), snugger and
   turned in.
7. The gloves did not reach high enough above the elbow to hide the forearms. → Wraps from above the elbow (the cut
   trims upper-arm faces), the elbow end turned in.
8. S over budget after these. → Flat steel bands on the mask, lighter spirals: S 4,396.

#### Round 5 — 2026-10-28 — Ranger: layered by reference; Shade round 2

**Ranger renders read:** `sets_sheet.png`, `poses_sheet.png`, `species_sheet.png` (round 4's: Elf and Halfling now
clean, the Elf ears inside the hood — `species_elf_S_slight_head.png`). Clean in every view: the bracer sits on the
sleeve, no leggings show through the boots or the jerkin. Hides now: chest piece chest + belly + upperArms + forearms,
legs thighs + shins, boots feet; the helmet nothing (the open hood shows the throat under the chin — by design).
Pokes in the poses 11–20 (the collar's turned-in lip at the neck, the finger stalls in a fist), F 3,798, S 4,526.

**Shade round 2 read:** `sets_sheet.png`, `read200_all.png`. The half-mask is now cloth on the face (grey F, violet S
with steel bands, trim and glow); no leggings at the hips; continuous wrap lines; clean boot bands; the cloak's
diagonal reads from behind (S with a red edge) and, from the card angle, as the violet lining behind the left arm.
Hides: helmet S neck, chest piece chest + belly + upperArms, legs thighs + shins, gloves forearms. F 3,727, S 4,419 (+
cloak 524/620, knives 216).

**Defects found (fixed in round 6 / Shade round 3):**
1. Small black squares on the Ranger hood survived every outline and lining fix. Traced by ray-picking the render
   camera's pixel and by recolouring: with back faces culled they show the *background* — holes — and without, the
   lining behind. Cause: *folded quads* (a quad twisted so one diagonal splits it into two triangles facing opposite
   ways; 19 in the hood, 9 in the S chest, 4 in the leggings): whichever diagonal the renderer picks, half the quad
   faces backward. In the game, drawn single-sided, they would be real holes. → `triangulate_safe()` splits every quad
   along the diagonal whose triangles agree, before binding (all exports are triangles anyway). This was also the
   cause of the round-2 "lining specks".
2. The hood's lining was offset toward the head's centre, which on the surface bulging over the ears is only ~2.4 mm
   along the normal. → Offset along the surface normal (9 mm), toward the centre only round the crown and point.
3. Ranger S over budget by 26 (the turned-in lips added edges). → Fewer, larger scales, a lighter placket, two clasps.
4. Shade: the steady "helmet 14" pokes — the mask's inner surface sat inside the cheeks at its sides (5.5 mm off, 6 mm
   thick). → 7 mm at the sides, 4 mm thick.
5. Shade: the cloak's front still read as a flat bib on the left chest. → It starts over the collarbone, not the
   sternum.
6. Shade: the knife handles are specks at 200 px. → Grips 8.4 × 1.8 cm, a wider guard and pommel.

#### Round 6 — 2026-10-28 — Ranger clean; Shade round 3

**Ranger renders read:** `sets_sheet.png` (no holes in the hood any more — the folded quads were the cause),
`poses_sheet.png` (idle, run, the overhead windup, lunge, crouch, arms up: no skin through, the drape stays green
in the windup), `read200_all.png`, a close-up of the gloved left fist in the stride (the stalls follow the fist; the
counted pokes are the stalls pressing into the palm inside it). F 3,798, S 4,482 tris (budget 4,500).

**Shade round 3 read:** `sets_sheet.png`, `read200_all.png`, `poses_sheet.png`, `species_sheet.png`. The knife grips now
read at the belt (S pommels red); the cloak runs from the left shoulder to the right hip from behind and shows as the
violet lining behind the left arm from the card angle; every pose clean.

**Defects found (fixed in the final build):**
1. On the slight frame (and the Elf) the grey mask showed a dark "o" at the mouth: that body's lips are parted, and
   mask vertices bound to lip triangles followed them in. → The mask binds to the head away from the mouth.
2. The Halfling's toes poked out of the Shade boots: the boots missed `hides: feet` by four instep vertices visible
   only straight down the shaft, so the Halfling's big-foot part stayed on. → No game camera looks straight down a
   boot: views steeper than ~70° are left out of the coverage test; and the boot's bend rings (wide enough for the
   heel) left a 4 cm gap at the ankle front, now pulled in to at most 2.2 cm. The Shade boots now hide the feet.
3. Hides, final: Ranger — chest piece chest/belly/upperArms/forearms, legs thighs/shins, boots feet, hood none (its
   open face shows the throat); Shade — S helmet neck (F misses by one vertex), chest piece chest/belly/upperArms,
   legs thighs/shins, gloves forearms, boots feet.

#### Final build — 2026-10-28 — both classes at full render quality

**Run:** `build_gear_ranger.py` and `build_gear_shade.py` without `--quick` (1,024-px cards, 32 samples), from
`hero_species.blend` (the body carries all five species keys, so every piece carries them as morph targets).
`inspect-glb.ts` on all four files: skinned to the 65-joint rig, COLOR_0 exact (0.0000), 5 species morph targets on
every mesh. Ranger 662 KB per frame, Shade 778 KB per frame.

| piece | Ranger F / S tris | Shade F / S tris |
|---|---|---|
| helmet | 690 / 772 | 896 / 1,006 |
| chest | 1,222 / 1,544 | 807 / 873 |
| legs | 836 / 898 | 918 / 1,074 |
| gloves | 450 / 488 | 554 / 774 |
| boots | 600 / 780 | 552 / 692 |
| **five pieces** | **3,798 / 4,482** | **3,727 / 4,419** |
| extras | — | cloak 524 / 620 · knives 216 / 216 |

**Renders read:** `set_S_broad.png` of each (the card at 1,024), `read200_all.png`, `sets_sheet.png`, `gear_sheet.png`,
`poses_sheet.png`, `species_sheet.png` of each. The slight-frame mask is clean; the Halfling's toes are gone from the
Shade boots.

**Still open (honest list):**
1. An Elf's ear tips can show at the side of the Shade's close hood (2 cm clearance; the swept Elf ears are longer) —
   the sheet's planned Elf hood variant (`hood_narrow`) or an ear notch is the fix. The Ranger's deep hood holds them.
2. The Ranger's open hood hides no region (the throat shows under the chin); the Shade's F helmet misses `neck` by
   one vertex (the S's mask bands close it).
3. In the overhead windup the Ranger's hood drape folds over the rising shoulders (lined green, no holes) — a cape
   problem a skinned mesh cannot solve; cloth sway needs bones or the client.
4. In fists the three-finger glove's stalls press into the palm inside the fist (counted as pokes, not visible).
5. Static edge contacts: the turned-in collar and cuff lips sit 1–3 mm from the neck and wrist skin (≤ 16 vertices).
6. The Shade's cloak is skinned to the torso only — the rig has no cape bones, so it cannot sway; its back corner is
   a thin point.
7. Not built: the species variants the sheets ask for (Draconid hood-down/mask-only and tail splits, Elf narrowed
   hood, Dwarf shortened cloak, Orc widened mask); the quiver is the weapons pass's.

### The gear pass — Arcanist and Mender

#### How the Robes sets are built (both classes)

- **Body-hugging parts** (the robe's body and sleeves, leggings, gloves) are `gear_lib.shell`s with clean cuts, then
  **decimated with every vertex snapped back to one of the shell's own sources** (`robe_lib.low_shell`): Blender's
  decimator places merged vertices freely, so each is snapped to the nearest push/lerp source (boundary vertices only to
  boundary sources), and the piece stays exact on both frames and every species key. Colour fields that need straight
  edges (the Mender's tabard, the Arcanist's placket) are sliced along seam planes first and kept through the decimation.
  The neckline follows the chest region's measured top edge (`robe_lib.neckline`), so `chest` is always fully covered.
- **Loose cloth** (skirts, flaps, hoods, mantles, collars, bell sleeves, sashes, shoes) is built as row × column grids
  and every point is bound to the body triangle a ray from it toward a chosen target meets first — a leg's bone line
  for a skirt half, the body's centre above the crotch, the head centre for a hood — so it carries the weights of the
  body it hangs over. The **skirt is two halves** that share their rows above the slits and ride their own leg below:
  a stride opens the front and back slits instead of tearing the cloth, and a Draconid tail leaves through the back slit
  (a 16 mm notch at its top).
- **Other shapes of loose cloth** (the slight frame, the species keys) come from the body's displacement averaged over a
  smooth neighbourhood (`robe_lib.refit_loose`, Gaussian weights over the 24 nearest body vertices of the part's
  regions), blended in from 8 mm to 35 mm off the body; nearer points keep gear_lib's exact triangle transfer. Skin
  weights are untouched.
- **Rows over the shoulders** (mantles, the hood's drape) are laid by rays from inside the upper chest, evenly in
  angle (`robe_lib.cap_rows`), so they follow the shoulder's curve.
- **Single-sided client.** `client/src/scene/characters/material.ts` draws front faces only, so the review renders do
  too, and open cloth gets an inside where it can be seen (`robe_lib.inner_layer`: the hood beside the face, the collar,
  the bell sleeves' mouths, the skirt halves below the slit tops).
- **Test poses** (`robe_lib.test_poses`): idle (arms lowered), stride, run, lunge, both arms overhead, a heavy two-hand
  wind-up, a deep crouch — keyed on both rigs with `rig.key_pose`, cleared before saving.

Review palettes: Arcanist indigo `#4448a8` / ash `#a29d95` / ember `#a2452a` / straps `#605852` / brass `#cfa64e` /
glow `#ff9a3c`; Mender ivory `#e8dfc6` / oxblood `#7d2633` / pale gold `#e3c26a` / leather `#7a5636` / silver
`#cfd5de` / glow `#fff0b0`. Trim F grey `#8d8a84`, S red `#d8363e` (S = Legendary).

#### Phase 5 · Gear round 1 — 2026-10-28 — Arcanist: first full set

**Built.** `robe_lib.py` (context queries, low shells, binding toward targets, the split skirt, the hood, rings,
tubes, the review set) and `build_gear_arcanist.py`: helmet F (pointed hood) / S (brass circlet with a floating
shard), chest F (robe, patched, tied sash) / S (robe with placket, feathered overskirt, feathered mantle, stand-up
collar, bell sleeves, belt with a buckle), legs (leggings), gloves F (wraps) / S (rune gauntlets), boots F (slippers) /
S (pointed wrapped boots). `hero_species.blend` had landed, so the species keys carried.

**Renders read:** `set_*`, `ortho_*`, `back_*`, `read_200_F_S.png`, `gear_sheet.png`, `closeups.png`,
`mixed_tiers.png`, `poses_*`, `species.png`.

**Defects found and fixed:**
1. The S robe's body barely decimated (2,904 → 2,652 tris): Blender's decimate *keeps* weight-0 vertices
   (`2 − w1 − w2` × factor), so protecting the seam vertices froze everything else. → `invert_vertex_group`.
2. 16 chest faces uncovered: a planar neckline cannot follow the chest region's saddle-shaped top (low at the front,
   high over the trapezius). → `robe_lib.neckline` measures the top edge around the neck and cuts along it.
3. The hood's front stood up as a turtleneck over the mouth: the rings under the head fell straight down at the front
   too, and the face opening stopped at the chin. → the sill is measured under the chin; below the equator the rings
   hug the chin and throat at the front and fall only at the sides and back.
4. On the slight frame the skirt hem waved and the inner skirt poked through the overskirt: points 10–15 cm off the
   body took their slight position from the tilt of one small triangle. → `refit_loose` (smooth displacement).
5. Torso patches came out as spiky shards (re-slotted decimated triangles). → crisp rectangles laid on the robe
   (`surface_shape`, 5 mm proud, with a lip).
6. Slippers read as bare grey feet with toes. → lofted shoes (`robe_lib.shoe`: rounded boxes fitted to the foot's slabs,
   toes merged into one cap; the S boot adds a pointed, curled toe and a wrapped shaft).
7. Glove cuffs zig-zagged (boundary vertices snapped onto interior sources). → boundary-to-boundary snapping.
8. The overskirt made the S robe read ember, not indigo. → open at the front (±36°), so the indigo shows between its
   edges; the collar taller, the shard bigger.

#### Phase 5 · Gear round 2 — 2026-10-28 — Arcanist: slight frame, hood, shoes

**Renders read:** as round 1.

**Defects found and fixed:**
1. The slight frame's skirt is now smooth and layered right; the hood frames the whole face with the throat covered.
2. Indigo still showed on the S mantle's shoulder tops: horizontal rings leave the nearly flat shoulder top between two
   rows, so the robe under it pokes through. → `cap_rows` (rays from inside the upper chest, evenly in angle).
3. The F wrap stripes never appeared, and the F sleeves stopped at the elbow: each arm's cut plane runs forever and
   deleted the *other* forearm (a region filter does not separate sides). → side-limited cuts (`clip(face_filter=…)`).
4. 2 chest faces still uncovered: the neckline was evaluated on pushed positions (11 mm out moves points up and
   forward). → `clip(at_body=True)` evaluates cuts on the skin.

#### Phase 5 · Gear round 3 — 2026-10-28 — Arcanist: drape, coverage, mixed grades

**Built.** The hood's drape on cap rows; the chest piece now hides `chest, belly, upperArms`.

**Defects found and fixed:**
1. The F hood's drape now follows the shoulders; sleeves reach mid-forearm and the wraps show their cuffs and stripes.
   What looked like poke-through on the S mantle is the robe between the feather points (by design).
2. Mixed grades (F hood over the S robe): the collar's front ends stood out through the hood's throat. → the collar's
   flare tapers from 50 mm at the back to 27 mm at its open front; the hood gathers at 122 mm.
3. The client draws front faces only (`material.ts`), so the hood beside the face, the collar's inside, the bell
   sleeves' mouths and the far skirt half seen through an open slit would show the background. → reviews render
   single-sided; `inner_layer` adds those insides (paid for by fewer skirt columns and lower ratios on hidden parts).

#### Phase 5 · Gear round 4 — 2026-10-28 — Mender: first full set

**Built.** `build_gear_mender.py`: helmet F (round cowl with a cape-let) / S (low mitre: silver band, ivory panels to a
ridge, gold orphrey, a sun), chest F (robe with the tabard painted between two straight seams, an embroidered sun, a
column skirt, four tabard flaps, a rope belt with a knot and cords) / S (raised silver sun with a glowing heart, a
feathered and glowing hem, pointed flaps with gold tips and red trim, a leather belt with a silver buckle, a feathered
oxblood mantle), legs (leggings), gloves F (wraps) / S (gloves with a palm glow under silver bracers), boots F
(sandals: a sole band and ankle, instep, toe and T straps; the toes show, no hides) / S (wrapped boots, silver toes).
The flaps ride the leg on their side like the skirt halves, so a stride opens them with the slits.

**Renders read:** `set_*`, `ortho_*`, `back_*`, `read_200_F_S.png`, `gear_sheet.png`, `closeups.png`,
`mixed_tiers.png`, `poses_*`, `species.png` (Draconid: the tail leaves between the split back flaps).

**Defects found and fixed:**
1. Sandals 2,172 tris: straps cut from the dense foot shell. → each strap decimated (`low_shell`, no symmetry); then
   still 1,012, because a lip doubles a ragged edge → no strap lips (they sit 5.5 mm off the skin).
2. S over budget (4,504). → torso ratios 0.23 / 0.26, a 20-column mitre without its hidden top lip.
3. Gold patches on the F skirt read as decoration, not burlap repairs. → removed (the brief does not ask for them).
4. The F sun was small and half under the cape-let. → 38 mm, lowered to the breastbone, under the cape-let's point.
5. On the slight frame the raised silver sun folded with the chest (each vertex followed its own neighbourhood). →
   `mark_loose(rigid=True)`: an ornament moves by the one displacement at its centre (also the buckles, the mitre's
   sun, the Arcanist's shard and setting).
6. Ivory showed through the S mantle near the neck, and with an F cowl over the S robe the mantle's top edge peeked out
   at the nape. → the mantle sits 27–35 mm off the body and starts 18 mm under the neckline; the cowl drapes in 4 rows.
7. The leggings' ankle lip spiked along the ragged shins/feet region edge (visible over the F sandals). → no lip there.
8. Elf ears (4–5 cm off the head) would pierce every helmet. → `ear_pockets`: on `spc_elf_lean` (and `spc_orc_bulk`)
   the helmet's vertices near each ear's direction are pushed out until the ear sits 12 mm inside — the sheets' hood
   cut-out, as a pocket; an Elf is added to `species.png`.

#### Phase 5 · Gear round 5 — 2026-10-28 — both: single-sided linings, budgets, the review outline

**Renders read:** every sheet of both classes, plus probe renders of the skirt, collar and hood with back-face culling
and the review outline switched on and off one at a time.

**Defects found and fixed:**
1. Black vertical streaks over both robes' lower skirts once the reviews went single-sided. Probes: only with culling
   *and* the Solidify outline together — the outline shell of the reversed lining (5 mm in) landed in front of the
   cloth. → linings 12 mm deep, and none under lips (a hem or slit lip doubled for nothing).
2. Linings were offset along the bound triangle's normal; hood points bound to an *ear* triangle sent theirs sideways.
   → `inner_layer` offsets along the cloth's own normal (averaged over the lined faces).
3. A black band inside the S collar and a flap at both hoods' temples: Blender's Solidify outline treats reversed
   linings and folded lips differently from the client's outline pass (which draws back faces of the mesh pushed along
   its normals: a lining's push goes behind it). → the review outline is now built the client's way
   (`outline_copy`: reversed faces pushed along the normals after skinning, culled outline material).
4. S Arcanist over budget (4,769) after the linings. → robe ratio 0.23, overskirt 4 rows, leggings ratio 0.13 (they
   show only through the slits); linings skip lip faces. Now F 3,650 / S 4,276; Mender F 3,876 / S 4,348.

**Held:** the stride, run, lunge, overhead, heavy wind-up and crouch poses on both classes and frames — the skirt halves
and flaps open with the legs, nothing pierces the cloth; the slight frame's skirts are smooth and layered right; the
Draconid's tail leaves through the back slit and between the back flaps; the Elf ears sit in the hood's pockets.

#### Phase 5 · Gear round 6 — 2026-10-28 — both: the species keys were on in every review

**Found.** A flap at both F hoods' temples survived every outline fix and was absent from the saved file. Tracing the
evaluated mesh: 10 cm off its basis with the armature off — the shape-key mix. **Blender 5.2 adds shape keys at value
1.0**, so every piece `gear_lib.realize` made carried all five species keys at full weight in every review render
before the species sheet (which sets its own values and resets them to 0, which is also why my exports read 0). The
"flap" was the Elf and Orc ear pockets plus the Draconid muzzle on a human head. The exports were never affected
(default weights 0; the client builds its own weights), but the Warden/Blade exports carry default weights `0,1,0,1,1`.

**Fixed:**
1. `gear_lib.realize`: `kb.value = 0.0` on each species key it adds (one line, backward compatible); `robe_lib`
   zeroes them after realize as well.
2. With the true human fit, the body's ear tip came through the back of the Arcanist hood (the ear falls between two
   hood samples). → `ear_pockets` also pockets the body's own ears (head vertices beyond 82% of the widest at ear
   height) in the basis and every key, before the Elf/Orc part ears on their keys; also on the circlet and mitre.
3. A speck of the Mender cowl's lining at the nape. → the lining stops 5 mm in front of the head centre.

**Held (human fit, single-sided, client-style outline):** both sets on both frames in the card, ortho and back views;
all seven test poses; mixed grades (F helmet over S robe and the reverse); the slight frame; the Draconid (tail through
the back slit, horns through the hood — see open items), the Elf (ears in pockets) and the Human-slight.

#### Phase 5 · Gear round 7 — 2026-10-28 — both: holes in decimated sleeves, final renders

**Found.** The Mender S forearms showed skin between sleeve and bracer: snapping a decimated vertex back to its source
can fold a triangle over, and a folded triangle faces the skin, so the single-sided client culls it — a hole. The S
robe has four protected seam lines (the tabard and its trim band), so its arms were decimated hardest.

**Fixed:** `low_shell` re-winds any snapped triangle that faces against the skin (no holes; at worst a small overlap);
the Mender S robe ratio 0.28; the Mender's robe body 13.5 mm off the skin (its sleeves reach the wrist over forearms that stay drawn, and two or three skin specks still showed where the decimated sleeve's chords dip), its emblems lifted with it. Full-size renders (1024, both frames' poses) for both classes; exports re-checked with
`inspect-glb.ts`.

**Still open:**
1. Draconid horns pierce the F hood, the F cowl and the S mitre. The sheets swap the hood for a circlet on Draconids
   (a client rule); horn pockets like the ear pockets would be the alternative.
2. The client hides every hair part under any helmet (`UNDER_HELMET` in `assembler.ts`), so the S Arcanist's circlet
   sits on a bare scalp; a circlet that keeps hair needs a client rule and a band lifted over the hair volumes.
3. Facets show at 1024 on the hood drapes and the decimated robes (fine at 200 px).
4. Below the knee the skirt halves ride the shins: in the run the back hem lifts with the heel and the crouch bunches
   the robe — nothing pierces it, but it reads like loose trousers in deep bends.
5. Specks of 1–3 px at 1024 (invisible at 200 px): the Mender cowl's lining at the nape, and skin just above the Mender S bracers where the decimated sleeve dips.
6. Dwarf, Halfling and Orc carry their keys (and the Orc its ear pockets) but are not on my sheets; only the Draconid,
   the Elf and the Human-slight are rendered.

**Final numbers** (broad, F / S tris): Arcanist helmet 824 / 212 · chest 1,708 / 2,698 · legs 462 / 414 · gloves 336 / 432 · boots 320 / 520 · **set 3,650 / 4,276**. Mender helmet 850 / 360 · chest 1,870 / 2,588 · legs 338 / 404 · gloves 322 / 612 · boots 446 / 480 · **set 3,826 / 4,444**. Exports: `gear_arcanist_broad.glb` 715 KB, `gear_arcanist_slight.glb` 731 KB, `gear_mender_broad.glb` 773 KB,
`gear_mender_slight.glb` 786 KB — 10 pieces each, skinned to the 65-joint rig, the five species morph targets (default
weights 0), COLOR_0 exact (`inspect-glb.ts`: worst distance 0.0000), `hides` as lists.

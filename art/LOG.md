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

## Phase 6 · Rounds — the parallel passes (2026-10-28)

Phase 6 ran six Blender passes at once — the shared + Cellars kit, the Drowned Vault kit, the Crypts kit and three monster passes (A: the creatures on their own rigs; B: the bases on the hero rig; C: the spirits, tentacles, oozes and the leech) — beside a client pass that built the rooms, monsters and effects in the game. Each pass logged its own rounds; they are merged here unchanged, pass by pass (headings levelled). The renders are in `art/renders/env/<zone>/` and `art/renders/monsters/<base>/`; the curated set in `art/review/`. What the lead saw in the game is at the end of this section.

### The shared + Cellars kit pass

*Scripts: `tools/blender/env/kit_lib.py` (the shared kit toolkit — conventions in its docstring; the Crypts and Vault
passes build on it) and `tools/blender/env/build_kit_cellars.py`. Renders: `art/renders/env/shared/`,
`art/renders/env/cellars/` (`kit_sheet.png`, `room_<template>.png` from each template's own camera, `_phone.png` at
phone size). Exports: `client/public/models/env/kit_shared.glb` + `shared.json`, `kit_cellars.glb` + `cellars.json`;
palettes `tools/blender/palettes/cellars.json`, `shared.json`.*

#### Phase 6 · Cellars kit round 1 — 2026-10-28 — every piece, the bake, the export, the ten rooms

**Built.** `kit_lib.py`: a `Geo` (one palette slot, one variation value and one smoothing angle per face), primitives
(box, bevel_box, chamfered box, convex hull, rock, lathe, tube, prism, slab, torus, surface, disc, ribbon, chain, a
running-bond brick face that tiles across 2 m segments, flagstones), `realize` (hard edges split by angle, faces of
different slot or G split apart with the smooth normals kept as custom normals, `gv` = slot / 15, variation, AO = 1),
moving parts `<meshId>.<part>` with their origin at the hinge, light / fx empties, the Cycles AO bake into `gv`.B with
stand-in occluders (floor plane, wall plane, the tiling neighbours), the review material (palette × toon ramp × AO ×
variation, emissive glow and gem), labelled contact sheets, room assembly from a template exactly as `layout.ts`
builds it (walls cut to 0.55 m on the camera's side, wall-hung props on those walls hidden), the template camera
(vertical fov), the export (`.glb` + the `<zone>.json` piece list). `build_kit_cellars.py`: 12 shared pieces (07's ten +
`shr_brazier`, `shr_stairs_up`) and 40 Cellars pieces — 07's 24, the cut-away shell (`cel_wall_brick_cut`,
`cel_door_arch_cut`, `cel_wall_corner_cut`), the props 07's template table names (stool, sack pile, bone pile, hanging
chain, lantern, lantern hook, tripwire rail, dais, captain's chair) and four curio looks (dice table, larder, toll
shrine, gallows beam). Build + bake + export in 14 s; `kit_shared.glb` 175 KB, `kit_cellars.glb` 621 KB.

Decisions taken inside the round (to log as Proposed): floors and walls carry their detail as geometry (raised
flagstones, bricks with a lit top bevel) because the Phase 6 contract has no textures — 07's 2- and 24-triangle tile and
wall figures assumed a 2k atlas; a doorway piece is **4 m wide** (the 2 m opening + 1 m of wall each side) because a 2 m
opening centred on an 8 m edge cannot sit on the 2 m segment grid; slot 0 is the zone's wall masonry and slot 1 the floor
stone and mortar (so the shared trap plate always matches the floor); the earth floor borrows dark wood's brown.

**Renders read:** `shared/kit_sheet.png`, `cellars/kit_sheet.png`, all ten `room_cel-t-*.png` (915 × 412, the phone's
CSS size).

**Defects found (fixed in round 2):**
1. Sconces sit inside door sockets in six templates — the storeroom's E/W sconces at z 0, the gallery's at z 0, the
   strongroom's on the north door, the tap room's E/W pair at z −4, and at the very jamb of the cold hearth's W and the
   stairwell's E/W doorways; the torches float in the open arches. A content defect: the sconces move clear of the sockets.
2. The review background showed the ambient colour (warm grey) instead of the game's dark fog, and the torches made no
   visible pool of light: every room looked evenly lit.
3. `shr_brazier`: the glowing coal bed filled the bowl edge to edge — it read as a yellow table top, not a fire bowl.
4. `shr_gold_pile`: the heaps were faceted lumps (gold ore), not piles of coins.
5. `cel_wall_brick_dmg`: the little caps on its two end columns stuck out of the broken top like flaps (seen in the
   stairwell); the 6% random swap put three broken segments in one small room.
6. Random dirt / flagstone tiles in the cistern and kennels read as a checkerboard of 2 m squares.
7. `cel_floor_puddle` read as dark slime: the water colour too dark, the sheen too faint.
8. The kennels' four low walls in a row do not read as *pens* (no dividers) — a template matter, noted for the lead.

**Held:** every room reads at phone size from its own camera: brick walls, arched doorways with their stone surround
and dark void, the cut-away wall on the camera side, corner piers, crates and barrels standing on the floor, the cask
row and wine racks, the grate, banners, beams and the hanging cage. Rooms are 3.4k–10.2k triangles (template budget
30k) and 10–14 unique meshes (≈ draw calls with instancing).

#### Phase 6 · Cellars kit round 2 — 2026-10-28 — the templates' sconces, the review light, five pieces

**Changed.** Content (defect 1 — the only template edits, all minimal moves, `npm run lint` green): sconces out of the
door sockets — storeroom (−3.9, 2, −2.4) and (3.9, 2, 2.4); gallery (±11.9, 2, 2.4), and its third sconce, which sat on
the camera-side wall the client always hides, to the far wall (0, 2, 3.9) facing north; strongroom (2.4, 2, −3.9); tap
room (±7.9, 2, −6.2); cold hearth (−3.9, 2, −2.4); stairwell (±3.9, 2, −2.4); guardpost (3.9, 2, 2.3) and its banner,
which hung half over the west doorway, to (−3.9, 2.5, −2.6). Props standing in a doorway's mouth: the storeroom's
barrels to (3.3, 0, 1.6), (−3.4, 0, 1.55), (3.2, 0, −1.45); the wine vault's third cask, which blocked its north door,
to (6.3, 0, −3). Kit: the review rooms see the game's fog colour (#17110e) while lit by a warm ambient (a Light Path
world); `shr_brazier` a bowl with a raised rim, its glowing bed under lumps of coal; `shr_gold_pile` low smooth heaps
with coins on and around them; `cel_wall_brick_dmg` without the end caps and a shallower break, 4% in the reviews; earth
floors as whole rooms (kennels, cistern), never mixed tile by tile; the puddle lighter with a sheen; bricks ± 0.18 and
flagstones ± 0.21 of G; the copings darker.

**Renders read:** both sheets, all ten rooms.

**Defects found (fixed in round 3):**
9. The rooms still read flat: at 380 W two torches lift every surface of an 8 m room into the toon ramp's top two steps
   (0.90 / 1.06), so there is no pool of light — the ambient alone should sit on step 2 and the flames add steps 3–4
   within ~3 m.
10. `shr_brazier`: seven small coals on a bright bed read as a pie seen from above.
11. `cel_wall_brick_dmg`: with the end caps gone, the neighbouring segment's coping end now juts above the broken
    column (stairwell, right).
12. `cel_floor_puddle` still reads as a flat teal stone: no reflection.
13. The kennels' pens (round 1, 8): 07 asks for "4 pens of low walls"; the template has only the four pen fronts. Content:
    three dividers (`cel_wall_low`, rotationY 90, at x −4, 0, 4, z −3) make four 4 m pens, each with its front wall and
    a gate either side.

**Held:** the moved sconces sit on solid wall in every room; the fog background reads like the game; the guardpost's
brazier, the cask row and the storeroom read clearly; the cistern's earth floor reads as one floor.

#### Phase 6 · Cellars kit round 3 — 2026-10-28 — the light, the pens, five fixes

**Changed.** The review light model (ambient on the toon ramp's second step, torches 130 W / fires 220 W); the brazier's
coal bed under eleven bigger coals; the damaged wall's break kept off its two end columns, which keep their coping;
two glints on the puddle; content: the kennels' three pen dividers (round 2, 13).

**Renders read:** all ten rooms (sheets unchanged).

**Defects found:**
14. **The rooms looked the same in rounds 1–3 whatever the ambient and the torch power** — measured, not guessed
    (`t_light.py`, a scratch test: a floor patch under a 600 W lamp read 0.184 with the lamp inside the review's flame
    stand-in and 0.320 without it): the emissive flame mesh drawn at each light enclosed the point light and cast
    shadows, so no torch ever lit a room; every round-1–3 room was lit by the ambient alone. Fixed (the stand-in casts
    no shadow) and re-rendered: the cold hearth's fire now throws its bands of light on the floor, the sconces warm the
    walls round them. A review bug only — the game's flames are sprites.
15. Where a full-height wall meets the cut-down corner on the camera's side, its end is open (segments had no end faces;
    neighbours normally hide them): the hollow end and the coping read as a flap (stairwell right, every room's near
    corners). Fixed in round 4: end caps (the dark cross-section) on `cel_wall_brick_2m` and `cel_wall_brick_dmg`; the
    rule added to kit_lib's docstring for the other zones.
16. The gallery's third sconce, moved to the far wall in round 2, hides behind the middle beam from the camera → content:
    (2, 2, 3.9).

**Held:** brazier coals read as a burning bed in an iron bowl; the puddles read as water; the kennels read as four
pens with the cage between them; every room under working torches: the walls warm near the flames, floors stay readable.

#### Phase 6 · Cellars kit round 4 — 2026-10-28 — end caps, the final renders

**Changed.** End caps on the wall segments (defect 15); the gallery's far sconce to (2, 2, 3.9) (defect 16); the full
build (AO at 160 samples, sheets at 400 px, rooms at 1830 × 824 plus a `_phone.png` at 915 × 412).

**Renders read:** both sheets, all ten rooms (full size and phone size).

**Held:** every template reads from its own camera at phone size: walls close at the camera-side corners, every sconce
sits on solid wall and lights it, doorways stay clear, props stand on the floor and against the walls. Exports checked
(a scratch reader of the .glb as the client sees it): slot codes exact (worst 0.00000), AO 0–1, every piece at the
origin with its parts and points as children, the .json triangle counts equal to the .glb's. Totals: `kit_shared.glb`
12 pieces, 2,588 triangles, 188 KB; `kit_cellars.glb` 40 pieces, 8,803 triangles, 623 KB. Rooms 3.6k (cistern) –
10.3k (tap room) triangles against the templates' 30k, 9–14 unique meshes (draw calls with instancing).

**Still open (for the lead / the next round):**
- 07 puts Vexa "in her chair on the dais" in the tap room; the template has neither. `cel_dais` and `cel_chair_captain`
  exist, but the client stands actors at y 0, so adding them needs the client to lift a mark onto the dais — not done.
- 07's other named template props (stools, sack and bone piles, hanging chains, the entry lantern, lantern hooks,
  tripwire rails) and the four curio looks are built but placed by no template yet.
- Floors and walls carry their detail as geometry, so 07's texture-era numbers are exceeded (floor tile 52 vs 2, wall
  154 vs 24, door arch 304 vs 220); several props too (cage 578 vs 420, crate stack 150 vs 36, pillar 198 vs 48, shelf
  419 vs 320, gold pile 157 vs 60). The rooms stay at a third of their budget.
- Hanging pieces end in the air: the gallery's beams cross over the cut-down camera-side wall, the cage's chain stops
  above the cage (there is no ceiling).
- The stairs' fade to black hides all but the top three treads (as asked: "into a black fade"; may read too dark).
- The review light is a stand-in for the client's (a hemisphere-like ambient + two 2,700 K torches); the client's
  `npm run shots` is the real judge.

### The Drowned Vault kit pass

*One entry per round (`art/LOG.md`'s format): what was built, what the renders showed, the defects as a numbered list with
their fixes. Script: `tools/blender/env/build_kit_vault.py` (re-runnable: pieces, AO bake, export, renders). Renders in
`art/renders/env/vault/` (git-ignored): `kit_sheet.png`, `piece_<meshId>.png`, `tpl_<template>.png` (the template's own
camera), `plan_<template>.png` (straight down), `report.md` (triangles per piece and per assembled room).*

#### Phase 6 · Vault round 1 — 2026-10-28 — every piece, the ten templates, the first renders

**Built.** The 23 `vlt_` pieces of 07 §2.2 and eleven extras the Vault templates need (the shell's cut-away wall and
doorway, a wet floor tile, a brass-pipe wall variant, the soft water edge, the quay edge, the rope ladder, the flooded
stair-well, the chapel pew, the cult banner, the throne room's brazier), each a vertex/face list with one palette slot
per face; Cycles AO baked into COLOR_0.B; `kit_vault.glb` (483 KB) and `vault.json` exported; the ten Vault templates
written as `vlt-t-*.json.later` (schema + rule 17 checked with ajv; `npm run lint` green) and assembled from their JSON —
floor tiles, walls, doorways, corners and props — under each template's own camera with two torches at the party and
the lamps' `light_<n>` points. Rooms: 1.5k–5.9k triangles, 9–16 meshes (draw calls before instancing).

**Renders read:** `kit_sheet.png`, all ten `tpl_*.png` and `plan_*.png`.

**What works:** every piece reads on the sheet (the round vault door, the sluice gate under its winch, the kneeling brass
sentinel, the Tide Altar's shell basin and lamps, the raft under its coral awning, the throne's gallery of six lamps);
the rooms compose from their cameras (the throne at the end of its hall, the chapel's altar behind the pews, the raft in
the dock's basin, the anemone grotto's cyan clusters by the breach); doorways are clear in every room; teal walls, brass
trims and cyan lamps say *Vault* at a glance.

**Defects found:**
1. All water reads as a pale, opaque grey-blue sheet (knee-deep, deep, channel, pools, waterfalls, puddles): the review
   water material added a grey grazing-angle rim and a strong glossy term. → darker teal through the toon ramp, no grey
   rim, soft lamp glints, caustic lines (07's "caustic-scrolling" water) on the translucent water.
2. The torch highlights on the water are big white glare discs (flooded cell, throne). → glossy roughness up, strength
   down (part of 1).
3. Floors bake almost black: the AO bake's ground plane lay exactly in the floor tiles' plane. → occluder planes 1 cm
   below the floor; tiles bake with copies of their neighbours (so the joints match); AO distance 0.8 m (kit_lib's).
4. The salt tide-line is a stark 14 cm white stripe on every wall and pillar. → a verdigris algae band with a thin pale
   salt line above it.
5. The brass-pipe wall variant reads as yellow brackets or ladders at room distance (a short run that turns back into
   the wall at both ends). → vertical pipes rising from the floor into the cornice, a valve wheel, a branch between.
6. The wet floor tile's puddle reads as a grey triangle. → a rounder puddle, and the water material fix.
7. The 4-triangle floor slab is a flat field at phone size (no joints). → a chamfered 2 m slab with ink joints (10
   triangles: over 07's 4, as the Cellars' floors are, D-110 — no textures carry the joints).
8. Formats differ from the shared kit library (`kit_lib.py`, published during this round): palette file layout, `hole`
   (not `replacesFloor`), part / point custom properties, globally numbered `light_<n>`, roles, the JSON layout, the cut
   corner post. → converted in round 2.

#### Phase 6 · Vault round 2 — 2026-10-28 — water that reads as water, lit floors, the shared conventions

**Built.** The round-1 fixes: the review water material rebuilt (the palette water through kit_lib's toon ramp, caustic
lines on the translucent water, soft lamp glints, no grey rim); AO occluder planes 1 cm under the floor and floor
tiles baked among copies of their neighbours, AO distance 0.8 m (`kit_lib.AO_DIST`); the floor slab chamfered (10
triangles) with darker joints; the salt tide-line now a 12 cm verdigris band under a 5 cm salt line (walls, doorways,
pillars); the pipe-wall variant rebuilt as two vertical brass pipes from floor flanges into the cornice, a branch and a
valve wheel; the wet tile's puddle an 8-sided pool fading to nothing. Converted to `kit_lib`: the palette file
(`{zone, about, names, colours}`, written by the build; slot 1 now carries floors and paving, so the Vault's floor is
07's wet basalt lifted to #34444e and the walls #4d6372), `role` per piece (shell, prop, wall-hung, decal + `water`),
`hole` for the pieces that take the floor tile away, parts with `kind: part, part, piece, axis, note` (the vault door's
`leaf`, the sluice `gate`, the secret `panel`, the wheel, the sentinel's `construct`, the cage's `prisoner`, the throne's
`seat`), points numbered across the session (`light_<n>`, `fx_<n>`, `userData.light` / `fx` / `piece` / `color`), the
`vault.json` layout of `kit_lib.export_kit` (+ `water`), the cut corner post (`vlt_wall_corner_cut`), and the review
material is now `kit_lib.env_material` (the shading the client is asked for). Wall-hung props on the walls cut for the
camera are left out, as the client does.

**Renders read:** `kit_sheet.png`, all ten `tpl_*.png`, `plan_vlt-t-throne.png`.

**What improved:** the flooded rooms read at once — the chapel's nave and the throne hall are dark teal water with the
pews and the dais standing in it and the dry step at the door; the dock's basin and the ledge's pool are black water
under their quays; floors show their 2 m slabs; the brass pipes read as pipes.

**Defects found:**
1. The caustic network is a regular, unbroken Voronoi web: in the close rooms (flooded cell, stair well) it reads as
   glowing grout or cracked ice, and it also lands on the waterfall sheets (stained glass). → warp the cells with
   noise, break the lines up, thinner and dimmer, and only on water that faces up.
2. The torch glints on the knee-deep water are still large soft discs near the camera. → glossy strength halved.
3. The slab joints in ink draw a hard black grid at close cameras (dock, stair well, grotto: a tiled-bathroom look). →
   joints in the floor's own dark stone, darkened by G, their slope and the baked AO.
4. Props have no outline while the Cellars' review outlines them (kit_lib.build_room: 0.012 m on every role but shell
   and decal). → outlines on props and wall-hung props (water faces keep zero thickness so pools keep their soft edge).
5. The lit braziers of the throne room show cold coals. → a warm flame stand-in at each brazier and fire light (the
   client draws the real flame there).
6. Client compatibility, found reading `client/src/scene/env/` and `room/dress.ts`: the client reads `mount` (tile,
   shell, corner, floor, wall), not `role`; a `_wall_` piece on the room edge without `mount: 'wall'` replaces the wall
   segment behind it (the shelf wall and the breach would have left holes in the wall); any stairs-kind prop whose
   bounds go below -0.2 m cuts a floor hole. → `mount` written as userData and in `vault.json`; the cage's bars and
   the tipped chest lifted so neither reaches -0.2 m.

#### Phase 6 · Vault round 3 — 2026-10-28 — caustics, joints, outlines, flames

**Built.** The round-2 fixes: caustic lines on warped Voronoi cells, broken up by noise, thinner and dimmer, only where
the water faces up (falling sheets show their streaks); the glints halved; slab joints in the floor's own dark stone
(G 0.05 at the joint bottom, plus their slope and the baked AO); outlines (0.012 m in rooms, 0.008 m on the sheet) on
props and wall-hung props, with water vertices held at zero thickness; a warm flame stand-in at every lit brazier and
fire; `mount` written for the client; the cage's bars and the tipped chest kept above -0.2 m.

**Renders read:** `kit_sheet.png`, all ten `tpl_*.png`.

**What it shows:** every Vault room reads from its own camera at phone size. The throne hall: the dais rising out of
dark water toward the throne, the gallery's six blue lamps and the sigil above, four lit braziers, chained pillars,
pipes, the dry strip at the door. The chapel: the flooded nave with its pews, the altar's three lamps at the far end,
the wheel on the west wall, the dry step. The flooded cell's water reads as a pool (caustic light on its floor, the
chest half under it, the breach pouring in); the dock's basin and the ledge's pool are black water under their quays;
the grotto's anemones glow by the breach; the sentinel hall's four brass constructs kneel on their plinths among the
treasury shelves. Floors show their 2 m slabs without a hard grid; the salt line is a thin pale line over verdigris.

**Defects found (minor; carried to the final round or the honest list):**
1. The torchlight pools (the toon ramp's steps under a point light) draw large pale ellipses on the floor in front of
   the camera in every room. → kept: that is how the client's two torches light a room through the toon ramp; the
   client's fog will soften it.
2. The pillar's chain reads as a faint dotted band at room distance. → kept (it reads on the sheet; at 20 m it is
   texture, not a silhouette).
3. The renders so far are `--quick` (half resolution, few samples). → the final round renders at full quality with a
   half-size phone read per room.

#### Phase 6 · Vault round 4 — 2026-10-28 — final: full-quality renders (final)

**Built.** No geometry changes after round 3 (the dead round-1 review code removed); the whole build re-run at full
quality: AO at 96 samples, the sheet at 420 px cells, every room at 1560 × 720 with a half-size phone read
(`tpl_<id>_phone.png`), 642 s. `kit_vault.glb` 493 KB (35 pieces, 42 meshes, 6,584 triangles, 7 parts, 12 lights,
14 fx; every COLOR_0.R an exact slot code, 275 water vertices with A < 1), `vault.json` 27 KB. Ten templates validate
(ajv strict + rule 17, `npm run lint` green with the `.later` files in place). Rooms: 1.5k–6.4k triangles, 10–17
meshes before instancing.

**Renders read:** `kit_sheet.png`, `tpl_vlt-t-throne.png`, the phone reads of the chapel, the sentinel hall and the dry
ledge. Every room reads from its camera at phone size; no new defects.

**What a script did not reach (the honest list, 11 §10):**
1. Water is a review approximation: the client needs its own water material — translucent with COLOR_0.A as opacity
   (the soft shore, the pools' fading rims), caustics on the knee-deep tiles, a fog volume over the deep. Its current
   per-meshId rule makes the `vlt_floor_water_*` tiles translucent but draws the water faces inside mixed props opaque
   (the breach's waterfall and pool, the cage's and chest's pools, the stair-well's pool, the channel, the altar's basin,
   the leech jar): they read as dark-teal stains, not water, until it splits slot 15.
2. The deep water and the channel need their floor tiles taken away (`hole` in vault.json; their bounds also reach
   below -0.2 m); the client cuts holes for stairs only today, so it would lay basalt over them.
3. The shared campfire's embers take the Vault palette's glow slot: cyan coals under the client's warm flame (the palette
   rule; a Vault rest fire reads cold).
4. The toon ramp under two point lights draws large pale ellipses on the floor in front of the camera in every room.
5. The pillar's chain is a faint dotted band at room distance; the thrall in the cage, the leeches and the dormant
   construct are blocky stand-ins (the bestiary meshes take over in fights); anemones are star fans.
6. The floor slab is 10 triangles against 07's 4 (its joints are geometry: no textures, D-110 — the Cellars' floors are
   52); every other 07 piece is at or under its number.

### The Crypts kit pass

*One entry per round (`art/LOG.md`'s format): what was built, what the renders showed, the defects as a numbered list
with their fixes, what is left. Script: `tools/blender/env/build_kit_crypts.py` (+ `crypts_geo.py`, `crypts_pieces.py`,
`crypts_rooms.py`); renders in `art/renders/env/crypts/` (`kit_sheet.png`, `room_<template>.png`, `rooms_sheet.png`).
Run: `blender -b -P tools/blender/env/build_kit_crypts.py -- --quick [--write-templates]`.*

#### Phase 6 · Crypts round 1 — 2026-10-28 — the 22 pieces of 07, the template props, first rooms

**Built.** My own small geometry kit (`crypts_geo.py`: a vertex/face list with a palette slot, smoothing group and
weathering hint per face; edges split where slots or smoothing change or flat faces fold, so every face keeps its own
colour and AO; `gv` = R slot · G weathering from value noise and per-face hints, darker near the floor · B Cycles AO baked
per piece with a floor plane and, for wall-hung props, a wall plane), because `kit_lib.py` had not landed yet. All 22
`cry_` pieces of 07 §2.2 plus 15 the templates and the Warden's arena name (candle bracket, hanging candle crown, altar
step, hearth, cot, the sexton's tools, shuttered window, stone shelf, the Bone Reliquary niche, spiral stair, cocoon,
bone pile, Dunmore Quist's barrow, the Embalmer's Table, the Warden's Ledger): 37 pieces, 5,968 triangles, every one
inside its budget (07's for the 22; my own for the extras). Moving parts: sarcophagus `lid` + `chains`, iron gate
`leaf_l`/`leaf_r`, portcullis `gate`, secret door `door`, five `urn_<n>`, the bell. Light points at every wick (the
candle ring's twelve each its own), fx points for motes, drips and the vent. The ten Crypts templates written as
`content/dungeons/gravehollow-keep/templates/cry-t-*.json.later` (they validate against the template schema with the
linter's ajv options; rule 17 holds). Export: `kit_crypts.glb` 405 KB + `crypts.json`.

**Renders read:** `kit_sheet.png`, the ten `room_*.png` from their own cameras.

**What read well:** the niche walls (catacomb loculi with shrouds and skulls) and the bone walls (rows of skulls between
bands of long bones, a skull-and-crossed-bones crest) read at phone size; the sarcophagi (effigy, chains, skull boss),
the bier, the urn row, the weeping statue (hooded, green tears, basin), the reliquary niche (skull in a fan of finger
bones), the bone grate over its pit, the spiral stair round its newel, the barrow; the cut-away front walls frame every
room like a diorama; the rooms are not too dark (pale walls, a slate floor, bone and candle accents).

**Defects found:**
1. `kit_lib.py` (the shared pass's toolkit) landed during the round with conventions mine differ from: the doorway
   opening is shared by every zone (straight jambs to 2.1 m, a round arch to 3.1 m, so the lit-door marker fits) — mine
   was a pointed opening springing at 1.9 m; each zone builds **cut** versions of its wall, doorway and corner; wall-hung
   props sit 0.1 m in front of the wall face (`HANG_OFF`, templates at ±3.9); light points are `light` = candle / lamp …
   and fx `glow / drip / motes / smoke / embers`; parts carry `part`, `piece`, `axis`; palettes are
   `{zone, about, names, colours}` and the manifest is `export_kit`'s; holes in the floor are `info.hole`.
   → round 2 builds on `kit_lib` (Kit, bake specs with tiling neighbours, `export_kit`, `room_placements`,
   `build_room`, the shared `env_material`).
2. My templates put niche walls, bone walls, portcullis frames and the Vigil's secret doors **on** the room edge lines,
   relying on a "an edge prop replaces the shell segment" rule; `kit_lib.room_placements` (and so, probably, the client)
   has no such rule, so they would overlap the shell walls. → niche and bone walls become wall-hung facings (0.1 m in
   front of the wall, their depth coming into the room); door skins (iron gate, portcullis, secret door) leave the
   templates and become a note for the client (which door gets which skin).
3. The floor reads as one flat grey sheet: the slab's weathering pattern is too faint. → stronger G (joints dark,
   worn centre light).
4. Too little green: the rooms read grey and bone. → a greener stone and slate, brighter moss.
5. The web sheet reads as a paper sign with a hole. → a strand web (radials and two rings) in 20 triangles.
6. Vault ribs over a cut-away wall float (their near foot rests on a wall the camera cuts to 0.55 m) and, seen end-on
   (the spider gallery), read as a pole. → a half rib (`cry_vault_rib_half`, the far half of a rib with a boss) for the
   cut-away rooms.
7. The spiral stair's floor collar leaves four triangular holes where the square's corners fall inside a segment.
8. The candle ring's iron hoop is too thin to see at room distance.
9. The hanging crown and the pits were hidden under the kit sheet's ground plane.
10. Review harness: the hero stand-ins all rendered bone-pale (a shared mesh's material list cleared per object); the
    window's moonlight drew a candle flame; marks stood in rooms without fights; single-door templates rendered all four
    sockets as doorways; the sexton's cot and tools sat under the bottom edge of its close camera.
11. The chapel's nave is a bare 16 × 16 m floor; the Vigil's twenty identical niche bays repeat.

#### Phase 6 · Crypts round 2 — 2026-10-28 — on kit_lib's conventions

**Changed.** The build now hands the authored pieces to `kit_lib` (Kit / Piece, bake specs with tiling neighbours,
`export_kit`, `room_placements` / `build_room`, the shared `env_material` and label strips), so the Crypts kit agrees
with the shared, Cellars and Vault kits: the doorway carries kit_lib's opening (jambs to 2.1 m, a round arch to 3.1 m)
and the Crypts' pointed arch is now a proud pointed archivolt over a dark tympanum; three cut-away shell pieces
(`cry_wall_cut_2m`, `cry_door_arch_cut`, `cry_wall_corner_cut`); wall-hung pieces sit 0.1 m off the wall (templates at
±3.9); light points are `candle` (tone corpse) and `lamp`, fx `motes / smoke / drip / glow`; parts carry
`part / piece / axis / note`; holes are `info.hole`; the palette file and `crypts.json` are kit_lib's formats (the shell
block names the cut pieces). Niche and bone walls became 1.6 m facings in front of the shell wall; door skins left the
templates; every template carries one `cry_floor_mist` per cell (07: floor mist everywhere); the crossing and the spider
gallery use a new `cry_vault_rib_half` from their far walls. Palette greener (stone #8c9b93, slate #46555a, moss
#3f8573). Fixed round 1's 7–10: the stair collar fills the square's corners, a chunkier candle-ring hoop, the sheet's
ground plane is dropped for pits and hanging pieces, coloured hero stand-ins, no flame for moonlight, marks only in
fight rooms, single-door templates draw their far socket open, the sexton's cot moved under the window and the tools to
the west wall. 41 pieces; `kit_crypts.glb` 425 KB; COLOR_0 R exact on all 10,686 vertices.

**Renders read:** `kit_sheet.png` (now with kit_lib label strips, part names), the ten rooms, `rooms_sheet.png` (half
size: the phone read), and a Cellars room for comparison.

**What read well:** every room reads as the Crypts at half size and clearly not the Cellars (teal-misted floors,
grey-green stone, bone, green candle flames vs warm brick, grey flags and torches); the Vigil (niche bays all round,
bone walls behind the bier, four pillars, bone piles) and the catacomb run read strongly; the crossing's half ribs
converge on the crown; the well's portcullis skins, the reliquary's iron gate and the corner mourners show.

**Defects found:**
1. Walls and floors are flat planes — the weakest surfaces on screen, where the Cellars carry brick and flagstone joints
   as geometry (that pass exceeded 07's 2- and 24-triangle tile and wall numbers on purpose: they assumed a textured
   atlas, and D-110 has no textures). → round 3 makes the same call: a tile of two bevelled grave slabs with worn
   inscription panels and moss in the joints (38 triangles), ashlar walls in five courses (66).
2. The spider gallery's half ribs float as hooks above the far wall: from a 26° camera anything above ~4.3 m at the
   room's middle projects over the wall's top line. → the ribs spring from corbels at 2.6 m and rise 1.6 m (the apex in
   front of the far wall; the Tomb Spiders' ceiling marks at 2.5 m hang under them).
3. The strand web reads as a scribble from an angle. → a translucent fan of silk behind four strands and a ring.
4. `cry_door_secret` 182 / 180. → the panel's top face goes (hidden in the wall while shut).

#### Phase 6 · Crypts round 3 — 2026-10-28 — grave slabs, ashlar, ribs, the manifest's shell block

**Changed.** Round 2's 1–4: `cry_floor_slab` is two bevelled grave slabs with worn inscription panels and grave-moss in
the joints (38 triangles), `cry_floor_slab_open` keeps one slab and opens the other's grave (62), `cry_wall_plain_2m`
carries five courses of ashlar with lit top bevels over its mossy plinth (66) — 07's 4 / 40 / 24 were written for a
textured atlas; like the Cellars pass, the detail is geometry here (D-110: no textures) and the room budgets hold.
The half rib springs from a corbel; the web is a translucent fan of silk behind its strands; the secret door is 180.
`crypts.json` gains the Cellars' shell block (doorways by state: open `cry_door_arch`, locked `cry_door_portcullis`,
secret `cry_door_secret`, gate `cry_door_iron`; opening, tile, segment, heights, notes) and a machine-readable
`doorSkins` map per template, plus empty `floorMix` / `substitute`.

**Checked:** the templates validate against the template schema with the linter's ajv options; and on a scratch copy of
`content/` with the ten-floor dungeon file and the ten templates renamed to `.json`, the real linter reports nothing
about the templates (only that the Crypts zone's monsters do not exist yet — Phase 7 content). `npm run lint` green.

**Renders read:** `kit_sheet.png`, the ten rooms, `rooms_sheet.png`.

**What read well:** the ashlar and the slab grid (green joints under the mist) make every room read as built stone at
half size; nothing else regressed.

**Defects found:**
1. The ribs bulged above their own apex: my "pointed" halves were arcs of a circle centred between the foot and the
   axis, so each half humped higher than the apex — the full rib read as an "M" from round 1 on, the half rib as a hook.
   → an elliptical half-arc that leaves the foot vertically and still climbs at the apex (two halves meet in a gentle
   point), never above it.
2. The spider gallery's ribs, seen end-on from a north camera, read as a post and two hooks however low they spring.
   → the gallery's vault ribs become three wall arches (`cry_vault_rib` against the far wall, on its top line).
3. The walls now read too pale (lit ashlar faces), so the bone accents lose contrast. → stone #8c9b93 → #77867f.
4. The mist (0.3 opacity) washes the floor a light teal that the bone-pale foes stand on. → 0.22.
5. The web's teal fill reads as a kite or a pane. → whitish silk (cloth2), 0.5 opacity.

#### Phase 6 · Crypts round 4 — 2026-10-28 — ribs that arch, wall arches, darker stone

**Changed.** Round 3's 1–5: the ribs follow an elliptical half-arc (vertical at the foot, still climbing at the apex,
never above it), so the full rib is a gently pointed arch and the half rib rises cleanly to its boss; the spider gallery's
vault ribs are three `cry_vault_rib` wall arches on its far wall's top line; stone #77867f; mist 0.22; whitish web silk
at 0.5.

**Renders read:** the kit sheet, the ten rooms at full size and the half-size sheet.

**What read well:** the gallery's far wall is crowned by three pointed arches over its webs and cocoons — a clean gothic
silhouette with nothing floating; the crossing's half ribs climb from the far walls to the crown's boss; the darker
stone gives the bone walls, mourners, effigies and shrouds their contrast back; the slab grid with green joints and the
ashlar read in every room at half size; the chests sit on the reliquary's shelves; the well's grates show the bones
below.

**Defects found:**
1. The sexton's window showed no moonlight: its pane was authored "recessed" behind the wall face, which a wall-hung
   piece cannot be (the shell wall has no hole). → the pane and bars in front of the face.
2. The lanterns (the sexton's, Dunmore Quist's) had glass in the glow slot, which is the Crypts' corpse green, while
   their light is a warm `lamp`. → neutral glass; the client lights it.

#### Phase 6 · Crypts round 5 — 2026-10-28 — the window, the lanterns, the full-quality build (final)

**Changed.** Round 4's 1–2 (the window's pane and bars in front of the wall face; neutral lantern glass) and the final
build without `--quick` (AO at 96 samples, rooms at 2080 × 960).

**Renders read:** all ten rooms at full size, the kit sheet, the half-size sheet. The sexton's window now shows its
moonlit pane behind the bars; nothing regressed.

**Result.** 41 pieces (07's 22, three cut-away shell pieces, 16 props the templates and the arena name), 6,271
triangles, every piece inside its budget — 07's numbers except the floor tile (38 vs 4), the open slab (62 vs 40) and the
plain wall (66 vs 24), whose detail is geometry because D-110 has no textures (the Cellars pass's reading). 12 moving
parts, 38 light points (`candle` tone corpse, `lamp`), 8 fx. `kit_crypts.glb` 433 KB (53 meshes, 99 nodes, extras on
every node, COLOR_0 R exact), `crypts.json` 30 KB (kit_lib's format + the shell block, `doorSkins`, notes). The ten
templates validate; the real linter on a scratch copy with the Crypts zone enabled finds nothing in them; `npm run lint`
green. Assembled rooms: 2.2k–9.1k triangles, 9–17 unique meshes (≤ 30k, ≤ 40).

**Readings to log as Proposed (for 13):** facings and wall-hung props at ±(edge − 0.1); nothing in a template replaces
a shell piece — door skins per template live in `crypts.json → doorSkins`; one `cry_floor_mist` per cell in every
template; single-door templates list all four sockets; `cry_vault_rib_half` and the gallery's wall arches for vaults
over a cut-away side; the shell tile and wall exceed 07's triangle numbers; triBudget 30000 / drawCallBudget 40; the 16
extra pieces and their budgets; curio ids in `info.curio` are kebab-case guesses for Phase 7.

**What a script did not reach (honest list):**
1. The doorway reads round-headed at phone size: kit_lib's shared opening is round, and the Crypts' pointed arch is only
   a proud archivolt over a dark tympanum.
2. Webs are a gauze fan with four strands (20 triangles) — they read as cobweb gauze, a little like sails up close.
3. Cocoons read as pale spindles; the corner mourners are small at room distance.
4. The review material is kit_lib's: light hue does not tint surfaces, so the Crypts' green comes from the palette, the
   mist, the moss joints and the candle flames, not from candlelight on stone (the client may do better).
5. The chapel's nave is left open for fights; the Vigil's bier is modest from its 21 m camera.
6. Shared props render with the Crypts palette (as the client will draw them in a Crypts room).

### The monsters pass A — rat, hound, spider, bat

*Round by round, in `art/LOG.md`'s format: what was built, which renders were read, the defects as a numbered list with
their fixes, what is left. Scripts: `tools/blender/monsters/creature_lib.py` (shared) and `build_rat.py`,
`build_hound.py`, `build_spider.py`, `build_bat.py`. Renders: `art/renders/monsters/<base>/` (`lineup.png`,
`cards.png`, `cards_200.png`, `clip_<Clip>.png`, `fight_view.png`, `fight_read.png`); numeric checks per clip in
`art/build/monsters_<base>_checks.txt`.*

#### How the bases are built (all four)

- **Bodies are implicit surfaces.** Each base's body is a list of metaball elements (ellipsoids, balls, capsules), each
  bound to a bone and carrying a palette slot. Blender polygonizes them; a numpy copy of Blender's field function
  (checked: the field at every vertex of Blender's own output is 0.6000 ± 0.0002) projects the final vertices back onto
  the surface and gives the normals (the field's gradient, set as custom normals) — so the toon bands follow the smooth
  surface. Skin weights are each bone's share of the field at the vertex (power 2), so limbs blend into the body the way
  the surface does; a face takes the palette slot of the element that dominates it, then rules paint the mouth and masks.
- **Variants are fields too.** A `var_*` shape key is the same vertices projected onto a changed element list (a swollen
  belly, a longer abdomen, a pup's big head), so topology and weights stay; attachments get the same transform or the
  nearest body vertex's delta.
- **Attachments** (tails, ears, eyes, teeth, claws, spider legs, wing membranes, the parts) are numpy geometry: lofts,
  spheres, cones, closed rings, torus links; weights explicit, by chain, or copied from the nearest body vertices.
- **Rigs** follow the hero rig's rules (`lib/rig.py`): local Y head → tail; Z = the front for bones that hang (legs), up
  for bones that lie along the body (spine, neck, head, tail, feet, wings); +X swings a tip toward its Z, +Z toward its −X;
  `_L` / `_R`, mirrored poses negate Y and Z. The creature faces −Y with its origin on the floor; `Root` carries the only
  location keys (lunges, rolls, the bat's hover bob).
- **Clips** are pose tables sampled on every frame (30 fps, linear keys, loops cyclic and closing exactly): keyed poses
  blended with per-segment easing (anticipation, `in` into strikes, `out` after them), or periodic functions for Idle /
  Move / Flee. Every leg is an analytic two-bone IK in its own plane (spider legs: a yawing coxa aims the plane) with the
  end bones (paws, feet, tarsi) aimed separately, so planted feet stay on their marks; a gait generator moves stance feet
  straight back at the clip's `speed` and swings them forward on an arc. Lying poses (Death) are grounded on the torso.
- **Checks** every build: per clip the lowest point of the deformed body on every frame (and which bone it belongs to),
  the worst IK residual, loop closure; written to `art/build/monsters_<base>_checks.txt`.

#### Phase 6 · Monsters A · Rat round 1 — 2026-10-28 — the library and the first rat

**Built.** `creature_lib.py` (implicit bodies, geometry kit, `CRig` with FK/IK and the keyer, `Clip`, the review harness:
lineup with a 1.79 m hero silhouette from `hero_body.blend`, cards at Idle and at Attack1's hit, clip strips, the fight
camera at the phone's canvas, checks, export, the shared JSON merge with a lock file) and `build_rat.py`: 27 bones, a
metaball body with a separate lower jaw, a bare tail, ears, eyes, incisors, fur tufts; parts `rat_ridge`, `rat_boils`,
`rat_scars`, `rat_crown`; keys `var_belly`, `var_bald`, `var_one_eye`; the seven clips; export, manifest, clips.json.

**Renders read:** `lineup.png`, `cards.png`, `clip_Move.png`, `clip_Attack2.png`, `clip_Death.png`.

**Defects found and fixed:**
1. The lineup showed only the middle of the row: Blender's AUTO sensor fit spreads the 36 mm sensor over the *wider*
   side of the image, and the fit assumed the vertical. → `place_camera` fits per point with the right half-angles.
2. The rat read lanky — an opossum or hairless dog: legs long and thin, the body high and narrow. → hips 0.27 → 0.22 m,
   shoulders 0.25 → 0.20, legs shorter and thicker (shin r 0.034 → 0.040), the body fuller (a fat hunch, the belly at
   8.5 cm), a bigger head.
3. Tufts read as hedgehog spines (too many, too thin).
4. Old Gnaw's black scars read as tiger stripes. → pale (bone) seams, zig-zag, thinner.
5. The ears were thin flags seen edge-on. → bigger, rounder, cupped, opening forward-out.
6. The Plague Rat's belly did not read as glowing (only small boils). → `rat_boils` is now a glowing, blotchy skin over
   the swollen belly (`var_belly` surface + 4 mm) with the pustules on it.
7. The tail dipped 6.7 cm into the floor in Idle (its pitch wave went negative) and 56 cm in Attack2's rear (`Tail_01`
   counter-rotated the wrong way: on a tail +X lifts). → the pitch wave is biased up; `Tail_01` +34° against `Hips` +30°.
8. Attack1 and Attack2 drove the head into the floor (−3.4 / −15 cm). → the bite now springs forward and *up* (knee
   height on a hero), the pounce bites forward, not down.
9. Death floated 14 cm above its shadow: grounding used the lowest vertex, and once rolled the legs propped the body.
   → `Monster.ground(mask=torso)` grounds a lying body on its torso vertices.
10. IK residuals were logged while blending between solved and given leg angles, where they mean nothing. → only pure IK
    states record a residual.

#### Phase 6 · Monsters A · Rat round 2 — 2026-10-28 — proportions, the live rat in the shots, faceting

**Renders read:** all sets. The rats now read as fat, hunched rats; the bite shows a dark open mouth with yellow incisors;
the lineup places the Giant Rat at a hero's knee and Old Gnaw pony-sized; the fight-camera crops read by role (three
small brown rats; green rats with a yellow belly; the dark spiked elite; the huge bald pink hunter).

**Defects found and fixed:**
1. The live (un-snapshotted) rat rendered at the origin in the lineup, cards and fight views (an extra rat by the hero; a
   cyan sliver = the boils in the live material's default glow). → the live meshes are hidden once snapshotted.
2. The bodies looked crumpled — dark cracks along long thin triangles. A side-by-side test (`implicit_mesh` decimated vs.
   remeshed) showed the cause: a straight decimation of the metaball mesh leaves slivers, the 4-step toon bands kink
   along them and the outline hull pokes through their creases. QuadriFlow refuses the metaball mesh (pinch vertices).
   → a **voxel remesh sized to the budget** (`voxel = 0.92·√(2·area/tris)`), then a light decimation, then the projection:
   the same triangle count shades like a clean sculpt.
3. Death dipped 31 cm: the dead pose's tail "droop" swung it into the floor (once rolled onto the right side, +Z on the
   tail points down). → the tail drops 30° at the root and runs flat; the checks now name the lowest bone.
4. The flattened fur leaves lay on the back like plates. → five upright clumps along the hunch (`clump(lift=0.8)`), two
   per cheek, two at the throat.

#### Phase 6 · Monsters A · Rat round 3 — 2026-10-28 — the remesh, the last floor dips

**Renders read:** all sets. Clean toon shading everywhere; every variant reads at the fight camera.

**Defects found and fixed (for round 4):**
1. The claws floated in front of the toes (the remesh softens the toe balls). → claws grow out of the toe surface.
2. The Plague belly's edge ruffled like a skirt. → a calmer edge.
3. Death's buckle drove the jaw 7 cm into the floor. → the head stays up while the legs fold.
4. The back clumps nearly vanished at 1.0×. → a little longer and broader.

#### Phase 6 · Monsters A · Hound round 1 — 2026-10-28 — the first hound

**Built.** `build_hound.py`: 29 bones (scapulae, digitigrade hind legs: Upper / Lower / Meta / Paw), a lean ribby body
(deep ribcage, a hard tuck-up, three ribs a side, hip bones), a heavy brow, a dark muzzle mask (slot 1), a jaw with
canines and incisors, rose ears, a whip tail, four claws a paw; parts `hound_collar` (rust band + iron spikes),
`hound_chain` (12 links + a hanging length), `hound_ribs` (five glowing ribs a side, carries `var_pup`), `hound_rope`;
key `var_pup` (the head 1.22× about the skull, a short muzzle, big paws, the tuck-up filled).

**Renders read:** `cards.png`, `lineup.png`, `fight_read.png`, `clip_Move.png`, `clip_Attack2.png`, `clip_Death.png`.
The hound reads as a lean mastiff with an open, toothy mouth; the Warden's Hound as a ghost-blue dog with a black chain
and an ember-lit ribcage; the pets small with big heads; every variant reads in the fight crops.

**Defects found (fixed in round 2):**
1. The chest "bib" (slot 1) came out as an X-shaped emblem where the slot boundary crossed the arm elements. → removed.
2. The jaw looked oversized and hung open in Idle. → slimmer (r 0.045 → 0.038), Idle opens −6° ± 2.
3. Attack2's dart stretched the hind legs (IK residual 6.8 cm). → a shorter dart; the hind feet step with it.
4. Attack1's front paws lagged the lunge (3 cm). → they step as far as the body moves.
5. Move's front paw dipped 1.8 cm at push-off. → push-off pitch 40° → 25°.
6. The lineup's labels clipped at the image edge. → the labels are inside the framing.

#### Phase 6 · Monsters A · Spider round 1 — 2026-10-28 — the first spider

**Built.** `build_spider.py`: 41 bones (Body, Abdomen, Fang and Palp chains, per leg Coxa / Femur / Tibia / Tarsus); a low
cephalothorax with a raised eye mound, an abdomen with a pale central stripe and chevrons (slot 1), chelicerae with
curved fangs, two-segment palps, eight legs as lofts with a knuckle at every joint; eight eyes on the mound, oversized so
the cluster reads (slot 2). Legs are a yawing coxa plus a two-bone IK with the knee up; the tarsus keeps its slant as the
coxa turns (the library carries the end bones' rest directions with the yaw bone). Parts `spider_eggsac` (a lumpy lit
sac under the rear, silk threads; follows `var_abdomen`) and `spider_plates` (bone shells over the carapace and three
abdominal plates, a skull on the hindmost). Keys `var_abdomen` (the Weaver's long swollen abdomen), `var_baby` (big eyes,
a rounder body). Clips: an alternating-tetrapod scuttle, rear-and-strike, leap-and-pin, a jolt, death on its back.

**Renders read:** `cards.png`, `lineup.png`, `fight_read.png`, `clip_Move.png`, `clip_Death.png`. Eight legs with the
knees high, eye clusters in each variant's accent, the Weaver's swollen white abdomen, the Broodmother's lit sac; the
death reads as the classic dead spider on its back, legs curled.

**Defects found (fixed in round 2):**
1. The feet hovered 1.2 cm (the tarsus tip sat at 12 mm). → 4 mm.
2. Attack1 dipped the abdomen 3 cm into the floor: as the body rears, the abdomen (pointing back; +X lifts it) was
   counter-rotated the wrong way — in Hit and Death too. → the abdomen follows about 0.7 of the body's pitch.
3. The Broodmother read as a giant wasp: the leg bands and the abdomen pattern share slot 1, her sac amber. → the leg
   bands are ink (dark bands on the pale spiders, invisible on the black Broodmother); the pattern is a broad stripe and
   three wide chevrons (it was blotchy at the remesh's face size).
4. Six-sided legs looked like faceted pencils. → seven sides, fewer rings.
5. The Tomb Spider's skull did not show. → big raised sockets, a nose and a row of teeth on the hindmost plate; plates
   raised 9 mm.
6. Legs swept 7.6–9.7 cm through the floor mid-flip in Death. → the body rises higher while it rolls.
7. The lineup's labels collided (narrow spiders). → labels alternate between two rows when they would overlap.

#### Phase 6 · Monsters A · Bat round 1 — 2026-10-28 — the first bat

**Built.** `build_bat.py`: 23 bones (Root on the floor, Body hovering at 1.25 m, Head, Jaw, ears, Tail, per side
Wing_Upper / Wing_Lower / Wing_F2..F5, Leg, Foot); a furry body and a big head whose face is a skull mask (slot 1) with
red eyes in dark sockets, a jaw dropping on a red mouth (slot 2) and fangs; wings as thin closed slabs (4 mm) stretched
between the finger bones — a fan from the wrist, scalloped between the tips, and the arm-wing back to the ankle —
weighted by distance to the two nearest wing bones; pale finger bones (slot 1) over the slate membrane. Key
`var_round_ears` (the Crypt Bat). A wingbeat generator: a fast full downstroke, a slower upstroke with the hand-wing
folding, the body rising on the downstroke.

**Renders read:** `cards.png`, `clip_Idle.png`, `fight_read.png`. A grave bat with a skull face and skeletal fingers;
the flap cycle reads.

**Defects found (fixed in round 2):**
1. Two duplicate faces in the body mesh (`validate()` repaired them at build). → `make_object` drops duplicate and
   degenerate faces and names the piece.
2. The ears' inner sides were slot 1, the face's colour, so from the front the head read as a white rabbit. → slate ears
   with dark insides, narrower.
3. Death drove a wing 40–55 cm through the floor: rolling the body over sends one wing straight down. → a face-down splat:
   it drops with the wings flailing half-folded and lands spread flat on the floor.
4. Manifest: the glow colour moves from my `glow` field to the other passes' convention, `slots: {"11": "#hex"}`.

#### Phase 6 · Monsters A · Round 2 of hound, spider, bat; round 4 of the rat — 2026-10-28 — specials, clip maps

**Built (all four).** The special clips the content's `visual.animations` names, where a base pose could not stand in:
rat `Howl` (rears on its haunches, head thrown back, a long squeal — `release`) and `Retch` (two heaves, then a spew —
`release`); spider `Web` (abdomen raised, a flick — `release`) and `Brood` (the abdomen pumps, then heaves — `release`);
hound `Howl` (sits back, muzzle to the ceiling — `release`). Every manifest entry now carries a `clipMap` from each name
the client may ask for to a clip in the file (Pin, Lunge, Sweep, Drop → Attack2; BoltHole → Flee; Reel, Rear, Shroud →
Web; Cocoon → Attack1; Pulse → Brood; Harry → Attack2 …), and `slots: {"11": glow}` instead of my round-1 `glow`.

**Renders read:** every set of all four bases (the special clips' strips too). Rat: Howl reads as a rearing squeal,
Retch as a heave and spew. Hound: the bib is gone, the slimmer jaw reads, Attack1 crouches, lunges and snaps, Howl
throws the muzzle up. Spider: the Broodmother reads as an oil-black spider with amber chevrons and a lit sac (no longer
a wasp), the dark joint bands read on the pale spiders, Web lifts and flicks the abdomen. Bat: the skull face reads
without the white ears; the shriek flings the wings wide with the red mouth open; Death jolts, tumbles and lands
face-down with the wings spread.

**Defects found (fixed in the final round):**
1. Rat: the claws still floated as specks in front of the paws (the voxel remesh cannot hold a 1.4 cm toe bulge). →
   removed; they never read at 200 px.
2. Rat: Death's buckle folded a front leg 3.3 cm into the floor. → a softer fold.
3. Hound: Move dipped a front paw 1.8 cm at lift-off — the stance now ended at 25° but the swing still began at 40°. →
   the swing starts where the stance ends.
4. Hound: Attack2's dart still stretched the hind legs (5.6 cm). → the hind feet travel with the dart.
5. Spider: on its back the curled legs folded toward the floor (−7 cm): the curl lifted the femurs, which once flipped
   points them down. → the femurs curl toward the belly (−X), so they rise when it lies on its back.
6. Spider: the Tomb Spider's skull still read as one dark spot. → bigger sockets set wider, a nose and four teeth,
   centred on the top of the abdomen and raised clear of the plates.
7. Bat: the claws dipped 6 cm into the floor in the splat. → the legs trail up and back.

#### Phase 6 · Monsters A · Final round — 2026-10-28 — abduction, the last floor dips (rat 5, hound 4, spider 4, bat 4)

**Changed.**
- **Legs abduct** (`Leg(abduct=30)`, rat and hound): before the two-bone solve, the upper bone turns about its own Z (its
  forward axis when it hangs) so the leg's plane holds the target. Planar legs could not reach a foot the body had
  shifted, rolled or yawed away from — the hound's dart left 5.6 cm residuals, the trots 2–3 cm. After: Move and
  Attack2 solve to 0.0 cm.
- Death fixes: the hound folds its front legs (FK) and drops its chest before it rolls, so no IK solve is blended while
  the body turns over; the rat's buckle is grounded on the whole mesh (a transitional crouch), not the torso; the
  spider's dead curl, worked out in the leg plane (on its back every leg point must stay under the abdomen's top),
  is femur −40° / tibia −60° / tarsus −40°; the bat's jaw stays nearly shut face-down.
- Library tidied (three unused helpers removed).

**Two runs died silently** while rendering (no traceback, no "Blender quit": the spider during its cards, a hound test
during its geometry) — six or more Blender processes were sharing the laptop's GPU and memory. The final run retries a
base whose log does not end cleanly; the `.glb` timestamps confirm every export.

**Final checks** (`art/build/monsters_<base>_checks.txt`; lowest point of the deformed body on any frame / worst IK
residual): rat — every clip ≥ −0.6 cm, IK ≤ 0.3 cm (Retch 2.5 cm); hound — Idle/Attack/Hit/Howl clean, Move −1.2 cm (a
front paw at lift-off), Death −2.9 cm on one transition frame, IK 0.0 except Attack1 2.1 cm; spider — all clips +0.4 cm
(feet on the floor), Death −2.3 cm on one frame of the flip; bat — Death lands at 0.0 cm, the rest fly. All loops close
exactly (0.000°). `inspect-glb`: 14 meshes, all skinned, COLOR_0 worst distance 0.0000 everywhere; re-import finds every
mesh, the rig and every clip.

**Result** (triangles per variant = body + its parts; budgets from `visual.triBudget` / 06):
- `rat.glb` 422 KB, 27 bones, 9 clips — Giant Rat 2,468 (2,500) · Plague Rat 3,391 (2,500 — over by the glowing belly
  skin) · Warren Alpha 3,248 (5,000) · Old Gnaw 2,798 (7,000) · Rat Prince pet 2,604.
- `hound.glb` 398 KB, 29 bones, 7 clips — Cellar Hound 2,932 (3,000) · Warden's Hound 4,174 (7,000) · pets 2,946 / 3,150.
- `spider.glb` 537 KB, 41 bones, 8 clips — Cellar Spider 2,968 (3,000) · Cellar Weaver 2,968 (4,000) · Broodmother 3,692
  (7,000) · Tomb Spider 3,478 (5,000) · Spiderling pet 2,968.
- `bat.glb` 214 KB, 23 bones, 6 clips — Grave Bat 1,980 (2,000) · Crypt Bat pet 1,980.

**What a script did not reach / left as is (honest list):**
1. Fur is a handful of clumps on smooth "clay" bodies; no fur, scales or chitin texture (palette-only material).
2. The Plague Rat is 891 triangles over its 2,500 budget: the glowing belly is a shell over the swollen belly plus nine
   pustules (it reads; a cheaper shell is possible). `rat_boils` assumes `var_belly` = 1 (it carries no key).
3. The Warden's Hound's translucency is not in the asset: the entry says `ghost: true`; the client draws it.
4. The pups are the adult skeleton at 0.7× with a big-head / big-paw key — legs stay adult-long.
5. Eyes take slot 2 (the accent names the eyes for most variants), so the Giant Rat's "yellow teeth" accent paints its
   eyes yellow and the Cellar Hound's "white teeth" accent paints its eyes white; their teeth use the bone slot.
6. The Tomb Spider's skull reads from above (pale plate, two sockets, teeth); from a low 3/4 view it is mostly two dark
   sockets. The Spiderling (0.3×) and the Rat Prince's crown are a few pixels at the fight camera.
7. Small residual floor dips on transition frames: hound Death −2.9 cm, spider Death −2.3 cm, hound Move −1.2 cm.
8. No web, thread, spit or shriek effects — the `release` events are where the client's VFX go.
9. All review renders are `--quick` (8 samples): the laptop was shared by six or more Blender passes.

### The monsters pass B — the bases on the hero rig

*Phase 6, monsters pass B (2026-10-28): `humanoid`, `skeleton`, `zombie`, `sentinel`, `hollow-king`
(`docs/06-MONSTERS.md` §3.5). Scripts in `tools/blender/monsters/` (`humanoid_lib.py` — session, low-poly body,
re-used hero gear, rigid kits, the cull, shape-key fields, reviews, export and manifest; `costume_lib.py` — hoods,
masks, grins, jerkins, coats, sashes, boots and the props; one `build_<base>.py` per base). Renders in
`art/renders/monsters/<base>/` (`--quick`: 8 samples, 560-px cards; six passes share the laptop). Exports
`client/public/models/monsters/<base>.glb` + this pass's entries in `manifest.json`.*

#### How the bases are built (all five)

- **No rig and no clips of their own** (README → Monsters → Humanoid bases): every file holds the hero `Rig` (65
  joints) and meshes skinned to it, extras `kind: "monster"`, `base`, `variant`, `piece`, `clips: "hero"`,
  `monsters` (the ids that show the piece), `tris`; the client plays the hero clips through each entry's `clipMap`.
- **The low-poly body** (`Session.body_copy`): the broad hero body with every key cleared (a monster is broad and
  human-shaped; the face keys can be baked in first — Vexa, the Brine Hag, Naesa), decimated uniformly to 20–36 %
  (2.1–3.8k triangles with the eyes), every vertex snapped back onto the full body, slots and regions read back from
  it, normals interpolated from the full body's custom normals. A calibration render (scratch) compared protected and
  uniform decimation: protecting the head and hands starved the limbs and left specks at the mouth, so it is uniform.
- **Culling** (`cull_hidden`): a body face goes when no game camera can see it under the costume — camera
  directions all round at 5°, 22° and 40° above level; a face must escape in at least two directions to stay, faces
  seen from one direction only stay next to seen ones; regions a re-used hero piece hides by itself (its own `hides`)
  go outright.
- **Costumes** are gear built over the body with `gear_loft` (fields, grids, parts with clearance and weight rules) in
  `costume_lib.py`, or **re-used hero gear** from `art/build/gear_<class>.blend` (`Session.reuse`: re-parented, keys
  and outlines removed, slots re-mapped, faces dropped by rule, optionally decimated with welded seams). Re-used:
  the Warden's plate F (Bone Knight, Barrow Warden, Drowner) and S (Sentinel, Hollow King), the Blade's mail F
  (Bruiser), the Mender's robe and cowl F (Acolyte, Blade, Naesa), the Arcanist's robe and hood F (Crypt Sexton,
  Brine Hag); hero weapons from `art/build/weapons.blend` (sword, greatsword, longbow, quiver, crossbow, dagger,
  throwing knife). Everything else is new.
- **Props** are rigid kits (`Kit`: lathes, tubes, boxes, slabs, cones, tori, chains) placed at a socket's rest
  matrix or in world space and skinned 100 % to one bone — so the client needs no attachment code, a prop is one
  more skinned mesh.
- **Shape keys** `var_*` come from one field (`RadialField`: away from or toward each bone's axis, blended by the
  weights), applied to the body *and* the costume pieces over it, so nothing pokes through when a key is on.
- **Colour**: slots 0/1/2 the monster's palette (content `visual.palette` for the Cellars, the `06` Visual line
  otherwise), 4 human skin where the skin is not one of the three, 3 eye-whites and pale details, 5 ink, 6/7/15 cloth,
  8 leather, 9 metal, 10 trim, 11 glow, 12 wood, 13 bone, 14 gem. Every manifest entry carries all 16 (`colors`).

#### Phase 6 · Monsters B · Skeleton round 1 — 2026-10-28 — every bone, five variants

**Built.** `build_skeleton.py`: one kit per rig bone, each piece skinned 100 % to its bone in one mesh
(`Session.multi`): the skull (an egg-shaped grid narrowing to a square jaw, eye sockets and the nasal hole recessed in
ink, an ink mouth band under sawtooth teeth, glowing points in the sockets), neck, lumbar and thoracic vertebrae a
little behind the bone line, four pairs of flat ribs on the torso envelope at 80 % and a sternum, clavicles and
shoulder blades, an iliac-wing pelvis with sacrum and pubic arch, knobbed long bones (humerus, radius and ulna,
femur, tibia and fibula), kneecaps, carpals, metacarpals, one piece per finger bone, foot and toe blocks. Variants:
Footman (rotted tabard bound over the ribs, round wooden shield on Socket_HandL facing out of the back of the hand,
the hero sword F), Archer (hero longbow F, hero quiver F + arrows on Socket_Back, a strap), Bone Knight (1.25; the
Warden's F chest, legs and boots re-slotted to tarnished iron, a closed great helm with a glowing slit, bone forearms
and hands, the hero greatsword F), Crypt Sexton (the Arcanist's F robe and pointed hood in grave black, skull, bone
hands, shins and feet, a hand-bell, a lantern pole with a green lantern), Barrow Warden (1.75; the Warden's F plate
in iron black, skull with a spiked iron circlet, a bell-hung mantle cleared over the pauldrons, a lantern on a chain in
the left fist, a slab-sword, a great bell at the hip).

**Renders read:** `lineup.png`, `read200_all.png`, `card_*.png`, `clips_*.png`.

**Defects found:**
1. The skull read as a plain ball: sockets small, glow dots lost in them. → (round 2) sockets 20° × 23°, deeper,
   their corners rounded in; the skull a size up (×1.14 from the top of the neck).
2. The Footman's tabard was a narrow strip with a rust square at the top (the trim row). → (round 2) ±40° wide,
   cloth only.
3. The Crypt Sexton's hand-bell — its must-read — was invisible (small, dull iron, behind the robe). → (round 2) ×1.7,
   brass, hung from the fist.
4. The Barrow Warden was one dark mass (iron-black plate under a near-black mantle) — `11` §8's "dark palettes vanish
   at 200 px". → (round 2) an ash-grey mantle with a brass collar, bigger brass bells.
5. The Bone Knight read as a Warden in grey; its tabard ended square. → (round 2) darker plate, the tabard torn to a
   ragged hem (faces dropped below a wavy line on the re-used chest piece).
6. Clip cells framed the figure at a third of their height. → `cell_camera` 20 % closer.

#### Phase 6 · Monsters B · Skeleton round 2 — 2026-10-28

**Renders read:** as round 1 plus a new `heads.png` (every variant's head at rest).

**Defects found:**
1. The Barrow Warden's skull and arms rendered black: the bone pieces use slot 0, the Warden's main colour is iron
   black (bone is its second). → (round 3) the bone kits are re-slotted per variant (`pick(..., bone_slot)`): slot 1
   for the Knight, the Sexton and the Warden.
2. The Archer's quiver on Socket_Back showed through the ribcage as a grey block in the chest (a skeleton has no flesh
   to hide what hangs behind it). → (round 3) the hero quiver hangs at the left hip, mouth up and leaning out, from the
   strap.
3. The Bone Knight's two "breaths" under the slit read as a second pair of eyes, and the face ridge as a stray block.
   → (round 3) dropped; the slit taller.
4. The glowing points filled the sockets, so the ink of the sockets never showed. → (round 3) smaller, set deeper.

#### Phase 6 · Monsters B · Skeleton round 3 — 2026-10-28

**Renders read:** all of `art/renders/monsters/skeleton/`. Every variant reads at 200 px and in the fight-size
lineup: the Footman by the round shield and the green tabard, the Archer by the bow and the hip quiver, the Bone
Knight by the closed helm's blue slit, the Crypt Sexton by the skull in the hood, the green lantern and the brass
bell, the Barrow Warden by size, the ash mantle with brass bells, the skull with the spiked circlet and the lantern
hanging at his knee. In the hero clips (Idle, Walk, Attack_Light, Attack_Heavy windup and hit, Hit, Defeat, plus
Shoot / Cast / Guard_Shield / Guard / Roar where the clip map sends them) the rigid bones turn on their joints with
nothing flying off; the Footman's shield faces the camera in Guard_Shield; the Archer's bow stands upright in Shoot.

#### Phase 6 · Monsters B · Zombie round 1 — 2026-10-28 — five corpses on the hero body

**Built.** `build_zombie.py`: per variant a low-poly body (22 %, 2.3k triangles), culled under its rags, skin in slot 0,
milky eyes (slot 3), wounds and rot painted into its faces, rags lofted with gear_loft (a torn tunic with short
ragged sleeves, ragged breeches, a loincloth, a harness), and keys from `RadialField` on the body and the rags alike.
Shambling Corpse (`var_swollen`, black-blood wounds, the left arm held hanging — `poseHold`), Bursting Corpse
(`var_belly` and `var_cheeks`, the belly kept dense in the decimation and lit with gas-green cracks), Ghoul (0.95,
`var_gaunt`, long arms by bone scales, a hunch by `poseAdd`, black gums, bared teeth, red claws on the distal finger
bones, a loincloth, Move → the hero Run), Drowned Thrall (`var_bloat`, barnacle clusters bound to the skin, a cheek
crust, kelp hanging from the scalp, grey rags), Charnel Hulk (2.2, `var_bulk`, a second torso — head, neck, chest and
upper arms of a body copy, shrunk, tilted out of the right shoulder and fused on, painted stitch seams, bruises, a
loincloth and a cross harness).

**Renders read:** `lineup.png`, `read200_all.png`, `card_*`, `heads.png`, `clips_*`.

**Defects found:**
1. Skin showed through the Shambling Corpse's tunic in green patches at the shoulders and chest. Two causes: the
   collapse decimator puts merged points up to ~1.5 cm *outside* convex skin (the tunic sits 11 mm off the full
   body), and the cull kept chest faces whose rays escaped up through the collar. → (round 2) a cull by game-camera
   directions; (round 3) every decimated vertex snapped back onto the full body.
2. The Ghoul's teeth sat inside the lips (the mouth guessed at y −0.142; the lips' front is at −0.164, the mouth line
   at z 1.561 — measured on the body's midline). → (round 2) moved; claws 1.4× longer.
3. The Drowned Thrall's barnacles were specks and its kelp stiff bars beside the head. → (round 2) bigger cones in
   larger clusters; kelp starting on the crown and hanging past the ears to the shoulders.
4. The Hulk's stitches, painted into the decimated body's big faces, read as jagged black spikes, and one seam plane
   ran across its face. → (round 3) raised seam bands with cross-stitches, lofted on the limb fields (waist,
   breastbone, left upper arm, right forearm, left thigh).
5. The hunch of the Ghoul and the Hulk was too slight to read. → stronger `poseAdd`.

#### Phase 6 · Monsters B · Zombie round 2 — 2026-10-28

**Defects found:**
1. Still skin through the tunic (cause 1 above, the decimator) → (round 3) the snap.
2. The Drowned Thrall was 3,980 triangles against a 3,000 budget (rags, breeches and lathed barnacles). → (round 3)
   no breeches (the rags hang to mid-thigh), five-sided barnacles: 2,988.
3. The Charnel Hulk stood 3.95 m at 2.2 — taller than the Barrow Warden, the zone's boss. **Proposed:** scale 2.0
   (3.6 m upright, ~3.3 m hunched — the `06` Visual line says 3.2 m; the §3.5 table's 2.2 is the outlier). Logged
   here for the lead to carry into `13` / `06`.
4. The cull kept ~85 % of a covered body (a fan of rays round every normal, and every kept face grew a ring). →
   (round 3) visible only when two camera directions escape; one-direction faces only beside seen ones; the
   regions a re-used hero piece hides by itself are dropped outright.

#### Phase 6 · Monsters B · Zombie round 3 — 2026-10-28

**Renders read:** all of `art/renders/monsters/zombie/`. At rest the Shambling Corpse's tunic is clean; the Bursting
Corpse's lit belly, the Ghoul's long arms, hunch, gums and red claws, the Thrall's barnacle crusts and kelp, the
Hulk's second torso and stitched seams read at 200 px. Triangles: 2,453 · 2,308 · 2,449 · 2,988 · 4,168.

**Defects found:**
1. In raised-arm frames (Attack_Heavy's windup, Hit) skin still pushed through the Shambling Corpse's tunic at the
   shoulders: faces kept because a few grazing rays leave between a sleeve and the armhole. → (round 4) in regions
   the rags cover by design (`strict_regions`) skin stays only where five camera directions see it.
2. The Bursting Corpse's belly reads from the side but not from the front at 0.75. → (round 4) `var_belly` 1.0; the
   Swell tell takes it to 1.35.

#### Phase 6 · Monsters B · Humanoid round 1 — 2026-10-28 — the Grinning Company and the Tidebound

**Built.** `build_humanoid.py` with `costume_lib.py`: twelve monsters and Sister Naesa's second phase. Bandit A
(Cutpurse, Crossbowman, Netter, Hexer): a crude hood on the head's envelope with a pointed capelet, a jerkin over
dirty shirt sleeves, bracers, trousers, rough boots, a belt and (Cutpurse) a red sash with a knot and tails; a white
half-mask on the face's own envelope (nose included) and a painted grin over it — a black crescent curving up at the
corners, sawtooth teeth, red lips on the Cutpurse. Props: dagger + purse; crossbow + red bolt quiver; gaff hook +
coiled net; bone fetishes at belt and throat, a cracked bone full mask with one green eye (Hexer). Bandit B (Bruiser
1.25, brute bone scales): the Blade's F mail rusted, a mail hood, a full grin-mask with eye holes, a studded club.
Bandit C (Vexa): scarlet frock coat open at the front over a white shirt, brass buttons, trim and cuffs, skirt halves
riding the thighs, dark breeches, tall boots, the hero `hair_long` dark auburn, a softer face (face keys baked:
narrow jaw, high cheeks, larger eyes), the grin-mask turned up on her brow, a cutlass and the hero throwing knife S.
Cult A (Acolyte, Blade): the Mender's F robe and cowl re-dyed (wet grey, sea-green stole), barefoot; a great conch at
the Acolyte's belt; the Blade's sewn mouth (blue thread crosses) and two boat-hooks. Cult B (Flagellant): raw skin,
a grey penitent's hood and breeches, barbed chain bands wound round torso and arms, a hooked chain trailing from the
right fist. Cult C (Drowner 1.3): the Warden's F plate in lead grey, a riveted verdigris diving-bell helm with three
glowing glass ports and a lead collar, lead weights, an anchor maul. Crone (Brine Hag): salt-white skin with
`var_crone` (gaunt field), long limbs (bone scales), a hunch, face keys for a long chin and nose, the Arcanist's
robe torn to a ragged hem, glowing pink eyes, a pearl crown, claws, a salt pouch. Cult D (Naesa): phase 1 the
Mender's robe in pearl white with a drowned-blue stole sewn with pearls and a conch staff; phase 2 the robe torn
(sleeves and hem dropped), two tentacle arms along the arm bones curling past the hands, 1.28.

**Renders read:** `lineup_1.png` (bandits), `lineup_2.png` (cult), `read200_all.png`, `heads_*.png`, `card_*`,
`clips_*`.

**Defects found:**
1. Over budget: bandits A 4.2–4.3k (3.5k), Acolyte and Blade 4.2–4.4k (3.5k); `humanoid.glb` 3.2 MB. The bodies were
   barely culled (2,098 of 2,516 kept under a full robe). → (round 2) the new cull (game-camera directions, two
   escapes, region drops from the hero pieces' own `hides`), bodies at 20 %, lighter hoods, masks, boots, legs,
   bracers.
2. Coloured stripes down the cult robes' fronts: the Mender's rope-belt cords hanging to the hem and its tabard
   flaps in other slots. → (round 2) the cords dropped below the knot, the flaps dyed with the stole.
3. The Netter's net read as a thin dark sash. → (round 2) a fat coil checkered net-grey and ink with cork floats.
4. The boots' turned-down cuffs flared like bells. → no cuffs on the bandits.

#### Phase 6 · Monsters B · Humanoid round 2 — 2026-10-28

**Renders read:** as round 1. Every bandit's grin reads from across the room; the cult robes are clean; triangles:
Cutpurse 2,940 · Crossbowman 2,902 · Netter 3,028 · Hexer 2,905 · Bruiser 3,447 · Vexa 4,689 · Acolyte 3,239 ·
Blade 3,369 · Flagellant 2,914 · Drowner 4,310 · Brine Hag 3,649 · Naesa 4,966 (phase 2: 4,139).

**Defects found:**
1. Vexa's mask, turned 118° up, stood behind her head like a plume, its painted face hidden. → (round 3) 78°: it lies
   on her brow face-up.
2. The Hexer's green eye — its must-read — was a painted cell that hid at 3/4 views. → (round 3) a glowing gem
   standing proud of the mask's left eye.
3. The Brine Hag's grey hair vanished against salt-white skin, and her dress opened on bare thighs with holes where
   the cull had removed skin. → (round 3) dark wet hair; thighs dropped (the robe's own linings fill the slit).
4. Naesa's tentacle arms read as long green sleeves. → (round 3) thicker at the shoulder, an S-wave along the arm,
   tapering to a tip that curls forward and in, suckers down the inner face.

#### Phase 6 · Monsters B · Sentinel round 1 — 2026-10-28

**Built.** `build_sentinel.py`: the Warden's S chest (tabard left off), legs, boots and gloves re-slotted to verdigris
with bronze rims and blue glow lines; a tall bucket helm with a glowing T-visor and a bronze crest; a blue crystal core
in a bronze mount on the cuirass; the hero body in ink, culled to the gaps (a dark core between the plates); water
running from elbows and knees (pale-blue tapering streams); a halberd (Socket_HandR). 1.3 → 2.48 m; 4,646 triangles.

**Renders read:** `lineup.png`, `card_vault-sentinel.png`, `heads.png`, `clips_vault-sentinel.png`. It reads as a
statue-knight; the chest crystal and the T-visor glow carry at 200 px; the halberd swings clear in Attack_Heavy.

**Defects found:** 1. The crest — a tube — read as a carrying handle on the helm. → (round 2) a flat bronze fin.

#### Phase 6 · Monsters B · Hollow King round 1 — 2026-10-28

**Built.** `build_hollow_king.py`: the Warden's S plate re-slotted barnacle black with dark iron rims and
drowned-blue glow lines, its tabard royal purple and torn; a closed helm with a lit visor and water running from it; a
crown of iron and coral; a tattered royal cape bound to the back; a chain across the chest and shackles with hanging
chain at both wrists; barnacle crusts; the hero greatsword S re-forged dark with a coral guard and a blue fuller; the
ink body in the gaps. The throne (rigid, unskinned, at the King's unscaled size): plinth and step, seat, a tall
spiked back with a glowing rune, armrests on posts, chains run to floor rings, coral and barnacles; the column it rises
on. Phase 1 holds a seated pose over the hero Idle (`poseHold` on legs and arms, a Hips offset). King 6,776
triangles (budget 8–12k), throne 3,057 + column 130 (budget 4k); 2.0 → 3.68 m standing.

**Renders read:** `lineup.png` (seated on the throne, standing), `card_seated.png`, `card_risen.png`, `heads.png`,
`clips_hollow-king.png`, `throne.png`, `throne_risen.png`. Seated, he holds the Hollow Blade upright before him with
both fists — a better throne pose than planned; the coral crown and the lit visor read at 200 px; standing, the
clips move him cleanly.

**Defects found:**
1. Four even drips under the visor read as the bars of a portcullis. → (round 2) three, uneven, thinner.
2. The risen-throne render cut the throne off. → framed for 6 m.

#### Phase 6 · Monsters B · Zombie round 4 — 2026-10-28

**Renders read:** all of `art/renders/monsters/zombie/`. The Shambling Corpse's tunic now holds through every clip
frame (no skin at the shoulders in Attack_Heavy's windup or in Hit); the Bursting Corpse's belly shows from the front.
Triangles: 2,385 · 2,301 · 2,449 · 2,931 · 4,168; `zombie.glb` 876 KB.

#### Phase 6 · Monsters B · Humanoid round 3 — 2026-10-28

**Renders read:** all of `art/renders/monsters/humanoid/`. Vexa's mask lies on her brow face-up with its grin and red
lips showing; the Hexer's green eye stands proud of the mask; Naesa's arms read as suckered tentacles curling at the
tips; every variant reads at 200 px (`read200_all.png`): the bandits by their grins and props (dagger and red sash,
crossbow, the checkered net coil and gaff, the bone mask and fetishes), the Bruiser by size, mail and club, Vexa by the
scarlet coat, the Acolyte by the green stole and the conch, the Blade by the hooks and sewn mouth, the Flagellant by
raw skin and trailing chain, the Drowner by the bell helm, the Brine Hag by the pearl crown and glowing eyes on salt-
white skin, Naesa by the pearl-sewn robe and conch staff (phase 2: the tentacles).

**Defects found:**
1. Colour gradients down the Brine Hag's front: decimating the Arcanist robe welded its slit linings onto the cloth
   (welding was meant for slot seams), leaving vertices shared across slots. → (final) that robe is not decimated
   (4.3k, inside its 4.5k budget); the other re-used robes are clean at their ratios.

#### Phase 6 · Monsters B · Sentinel round 2, Hollow King round 2 — 2026-10-28

**Renders read:** `heads.png`, `card_*`, `clips_*` of each. The Sentinel's crest is a fin; the King's drips are three
and uneven. A numeric check joined the review (`poke_lines`: body vertices more than 2 mm outside their costume at
every strip frame): the inner core bodies of both read 68–96 of ~300 vertices in every frame including Idle — the gap
skin they are there to show (neck, waist, joints), no growth in motion.

#### Phase 6 · Monsters B · Final round — 2026-10-28 — all five bases rebuilt and exported

**Run:** every `build_<base>.py -- --quick` again with the final library (the snap, the camera-direction cull with
strict regions, smoother bone normals, the poke check, the re-import check). Rounds per base: skeleton 4, zombie 5,
humanoid 4, sentinel 3, hollow-king 3.

| base | variant (triangles, height) | file |
|---|---|---|
| skeleton | Footman 2,963 (1.79 m) · Archer 3,109 · Bone Knight 3,850 (1.25 → 2.27 m) · Crypt Sexton 4,551 · Barrow Warden 6,109 (1.75 → 3.13 m) | `skeleton.glb` 1,307 KB, 29 meshes |
| zombie | Shambling 2,385 · Bursting 2,301 · Ghoul 2,449 (0.95) · Drowned Thrall 2,931 · Charnel Hulk 4,168 (2.0 → 3.59 m upright) | `zombie.glb` 876 KB, 18 meshes |
| humanoid | Cutpurse 2,940 · Crossbowman 2,902 · Netter 3,028 · Hexer 2,969 · Bruiser 3,447 (1.25) · Vexa 4,689 · Acolyte 3,239 · Blade 3,369 · Flagellant 2,914 · Drowner 4,310 (1.3) · Brine Hag 4,071 · Naesa 4,966 / phase 2 4,267 (1.28) | `humanoid.glb` 2,596 KB, 60 meshes |
| sentinel | Vault Sentinel 4,642 (1.3 → 2.48 m) | `sentinel.glb` 291 KB, 8 meshes |
| hollow-king | the King 6,760 (2.0 → 3.68 m) + throne 3,057 + column 130 | `hollow-king.glb` 677 KB, 12 meshes |

Every variant is inside its `06` / `visual.triBudget` number. **Checks:** `inspect-glb.ts` — every mesh skinned to the
65-joint `Rig`, COLOR_0 worst distance 0.0000 on all 127 meshes, the `var_*` morph targets where the manifest's
`shapes` use them; the re-import (`lib/export.py`, `art/build/monsters_<base>_check.txt`, `reimport_check.png` in each
render folder) finds every mesh with its colour attribute and one armature; a cross-check of `manifest.json` finds
every part (and phase part) as a node of its base file and every shape as a morph target of one of its parts.
**Pokes** (`art/build/monsters_<base>_pokes.txt`; body vertices more than 2 mm outside the nearest costume face within
3 cm, per strip frame): steady from Idle through the clips for the zombies (the Shambling Corpse 29–58), the
Bruiser (33–76) and the Drowner (0–14); the counter's baseline is skin that is meant to show beside cuffs, hems and
cowl openings, and its peaks (Vexa and Naesa in Attack_Heavy's overhead windup, the Thrall at its hit) were looked at in
close-ups: faces and hands beside raised cloth, forearms crossing in front of rags — no skin through cloth.

**Renders read (final):** in each `art/renders/monsters/<base>/` — `lineup*.png` (every variant at its scale beside a
1.8 m hero) and `lineup*_fight.png` (the same at the fight camera's size: a hero ≈ 110 px), `read200_all.png`,
`card_*.png`, `heads*.png`, `clips_*.png` (Idle, Move, Attack1 hit, Attack2 windup and hit, Hit, Death end, plus the
clips the variant's `clipMap` sends its specials to); the King also `card_seated.png`, `throne.png`,
`throne_risen.png`.

**Still open (honest list):**
1. Faces are the decimated hero face (20–36 %) with dark ink eyes: fine at fight size, plain up close; Vexa reads as
   a young man more than a rakish woman (the broad frame only; her face keys soften it a little).
2. The Cutpurse, Crossbowman and Netter share one silhouette (bandit set A by design); props and palette tell them
   apart (dagger and red sash, crossbow and red quiver, net coil and gaff with a black coat).
3. Re-used hero gear: the Bone Knight, Barrow Warden and Drowner wear the Warden's F plate, the Sentinel and the King
   its S plate, the Bruiser the Blade's mail, the cult the Mender's robe and cowl, the Sexton and the Hag the
   Arcanist's robe (and hood). Helmets, colours, props and scale set them apart, but a player who knows the Warden
   will see his plate; an artist pass could give each its own shell. These builds read `art/build/gear_<class>.blend`:
   if a hero gear pass rebuilds a piece, re-run the base.
4. Everything rigid stays rigid: chains, lanterns, the net coil, kelp, tentacle tips and the trailing chain swing only
   with their bone (no secondary motion); the Flagellant's chain hangs from his fist rather than dragging.
5. Needs the client: `poseAdd` / `poseHold` (hunches, the Shambling Corpse's broken arm, the King's seat) and
   `boneScales` (the Ghoul's and the Hag's long arms, the Bruiser's bulk). Without them those monsters stand upright
   with hero proportions — still readable, less themselves. The Ghoul has no quadruped move (hero Run instead).
6. Sister Naesa's tentacles here are tubes skinned along the arm bones; the monsters C pass also exported a
   `naesa-arm` on the tentacle base — the client should use one or the other for phase 2.
7. A small dark speck inside the Sentinel's visor at 360 px (the helm's inner lip through the recessed slit);
   invisible at 200 px.
8. **Proposed** (for `13` / `06`): the Charnel Hulk at scale 2.0, not §3.5's 2.2 (see zombie round 2).

### The monsters pass C — wraith, wisp, tentacle, ooze, leech

*`art/LOG.md`'s format: one entry per round — what was built, the renders read, the defects as a numbered list with
their fixes, what is left. Scripts: `tools/blender/monsters/build_{wraith,wisp,tentacle,ooze,leech}.py` and the shared
`spirit_lib.py` (mesh builder with slot split and a map back for weights and keys, small rigs with analytic chain weights,
one action per clip with one slot per animated ID, the review set). Renders: `art/renders/monsters/<base>/`. Build logs:
`art/build/monsters_c_<base>_r<n>.log`. All rounds rendered with `--quick` (8 samples; six passes share the laptop).*

**Conventions this pass settled (read by the client pass):**

- Clips are one glTF animation each, whatever moves: skeletal (`Rig`), node (the wisp's empties and meshes) or morph
  (`weights` on each ooze mesh). Blender 5.x slotted actions make it one action per clip with a slot per animated ID; the
  exporter (ACTIONS mode, merge by action) writes them as one animation — checked by re-importing every file and
  playing a clip on it.
- `clips.json` → `<base>` (top level, like the rat pass) = `{ animation: skeletal | node | morph, fps, clips: [{ name,
  seconds, loop, events }] }` (+ `rig` / `bones`, or `root` / `nodes` / `meshes` / `morphs`).
- `manifest.json` → `<monster id>` = `{ base, scale, parts, shapes, palette, slots, clipSpeed, tris }`; `slots` overrides
  fixed palette slots per monster (11 glow, 14 gem: the wraith's blue eyes, the lantern's sea-green, the pet wisp's
  gold, the leech's swallowed light). Deep Maw adds `instances`; `naesa-arm` adds `attach`; the pet adds `pet: true`.
- Bone scale is keyed only on leaf bones (the leech's `Sack`, the `Lip_*` bones): three.js inherits scale down a chain.

#### Round 1 — 2026-10-28 — tentacle

**Built.** `build_tentacle.py`: the chain `Root` + `T_01..T_10` (segments ×0.9 toward the tip, 2.5 m), a 12-sided
tube with a flatter sucker side, two staggered rows of raised suckers (white rim, ink cup) spaced by ∫dz/r so they
shrink with the tentacle, a black tip; the Deep Maw's plate (`tentacle_maw`: a throat funnel, pink gums, three rings
of teeth, a rim lobed between the tentacles) skinned to `Maw` + five `Lip_*` bones on the same rig; `var_arm` (the root
slimmed to 45 % for Naesa's shoulders). Clips Idle, Move, Attack1 (slam), Attack2 (grab-wrap, drag), Hit, Death (retract
under the water), Rise. Body 1,428 tris, plate 830, Deep Maw (plate + 5 instances) 7,970.

**Renders read:** `lineup.png`, `read200_sheet.png`, every `clip_*.png` (Deep Tentacle and Deep Maw rows),
`fight_from_the_deep.png`, `fight_the_maw.png`, `reimport_check.png`.

**Defects found:**
1. The Deep Tentacle stood almost straight with a small hook: a suckered horn, not a tentacle (worst at the fight camera).
2. Suckers looked like hex nuts up close (six-sided, a big ink hole).
3. The Maw's suckers took the throat pink (slot 1) and read as red eyes all over its tentacles.
4. Attack1's tip landed 12 cm under the floor; Attack2's wrap was a hook, not a coil.
5. Lineup labels overlapped; strips were framed loosely.

**Held:** the Maw reads at once as "a ring of tentacles round a toothed throat" from the fight camera; the slam and the
retract read; the re-import plays Attack1 (tip moves 3.4 m).

#### Round 2 — 2026-10-28 — tentacle

**Changed:** an idle bias (a '?' — base back, top hooked), lighter Maw pink, the slam 4 cm higher, a tighter coil, labels
spaced, strips framed per row. **Read:** the same set. **Defects:** 1 not fixed — the base leaning back and the top
hooking forward made one arc: a curved horn (a tusk) from the side; the taper (radius 0.28 → linear) is still a cone.
2 the same; labels' second lines fell under the floor.

#### Round 1 — 2026-10-28 — wraith

**Built.** `build_wraith.py`: a hood whose rows gather round an arched face opening (open rows between −30° and 38°
elevation, closed rows round them), a rim rolled 4 cm inward, a black void dish behind it with two slanted almond eyes
(slot 11) floating in it; a mantle over the shoulders with its own underside; a robe narrowing at the waist with folds,
trailing back, ending in twelve tatters; the inside of the robe in void colour up to a ceiling; bell sleeves with
tattered cuffs and void linings; long four-fingered spectral claws (slot 2). Rig of 23 bones (`Root`, `Spine_01..03`,
`Head`, arm chains, six two-bone hem chains with local Z outward). 2,586 tris.

**Renders read:** `lineup.png`, `views_sheet.png`, `closeup_hood.png`, `read200_wraith.png`, every `clip_*.png`,
`fight_belfry.png`.

**Defects found:**
1. **The tall pointed light hood with a slit for a face reads as a hooded-robe costume with a sinister real-world
   association** — the single biggest problem of the round. → round 2: a rounded, slouched cowl whose crown falls back
   (no point), darker blue-grey cloth, a wide round void, a hunched posture.
2. The robe was a straight sheet almost to the floor: "a person under a sheet", not a floating thing.
3. Six black rectangles ("rips") read as patches.
4. 2,586 tris, a little over 06's 2.5k.

**Held:** the eyes read as two blue lights at 200 px and from the fight camera; the claws read; every clip plays
(Wail flares the hem, Chill Touch lunges with the right claw, the death collapses and sinks).

#### Round 1 — 2026-10-28 — wisp

**Built.** `build_wisp.py`: `Wisp` (floor) → `wisp_float` (1.2 m) → `wisp_body` (core, 14), `wisp_glow` (five flame
tongues, 11), `wisp_motes` (six diamonds, 11), `wisp_cage` (a rusted hexagonal lantern: bars, bands, a roof, a hanging
ring, kelp). Node clips (bob, pulse, swirl, flare, dart, flicker, gutter-out with the cage dropping and tipping over).
Lantern 1,168 tris, pet 552. Re-import: Attack1 scales `wisp_glow` 1.00 → 1.72 at the hit.

**Renders read:** `lineup.png`, `read200_sheet.png`, every `clip_*.png`, `fight_drowned_choir.png`.

**Defects found:**
1. From the fight camera the solid roof hid the glow: a brown box with a cyan fleck.
2. The five closed tongues round the core made a bulb: the gold pet wisp read as a garlic bulb.
3. The 20–30 cm kelp strands under the cage read as legs.

#### Round 3 — 2026-10-28 — tentacle

**Changed.** An S-curve under every pose (`IDLE_BIAS`: the base leans in, the middle back, the top curls over; a side
S too), a bigger sway; a whippier taper (r = 0.012 + 0.23 (1 − u)^1.5, base 0.24 m); suckers round (8 sides, 8 a
row, a smaller ink cup); labels grow upward (`align_y = BOTTOM`).

**Renders read:** all sets. Fixed 1–5. The single tentacle now reads as a tentacle from the fight camera (two of them
side by side: sinuous, suckered, black tips); the Maw's fight read is the strongest of the pass — a ring of tentacles
round a toothed throat whose hole shows from above. Grab-wrap coils and drags; Rise surfaces; Death retracts under
the floor. Body 1,408 tris; Deep Maw 7,870 (plate 830 + 5 × 1,408). Re-import: Attack1 moves the tip 2.7 m.

**Still open:** the tentacle's base is a wide stump on a dry floor (the Vault's water hides it in the game); seen from
the side the Maw's gums are a pink shelf (fine from the fight camera).

#### Round 2 — 2026-10-28 — wraith

**Changed** (round 1's 1–4): a slouched cowl (rounder, its crown falls back, no point), a wider round void (±50°), eyes
×1.2, cloth darkened to blue-grey `#707a87`; a hunch under every pose (shoulders forward, head up so the void still
faces the party); the robe narrows and ends at 0.74 m with tatters 0.27–0.45 m long trailing back (tips 0.29–0.47 m off
the floor: a clear gap); no rips; hem chains moved down with it. 2,250 tris.

**Renders read:** all sets. Fixed 1–4: it reads as a floating hooded wraith — a dark void with two blue eyes, ragged
sleeves, spectral claws, a shadow detached from the hem; from the fight camera two of them read at once. Wail flares
the hem and flings the arms; Chill Touch lunges 0.55 m with the right claw; Move leans and streams.

**Defects found:**
1. A pale speck under the eyes: the robe's top cap (cloth grey) showed through a gap in the void at the chin.
2. Death's heap: the hem chains flared 58° and the tatters stood up like spikes round the fallen robe.

#### Round 2 — 2026-10-28 — wisp

**Changed** (round 1's 1–3): an open crown (six ribs to a small cap) instead of the solid roof; a bigger core
(r 8.8 cm); the glow is a corona of six narrow flame tongues licking up round the core plus a flame tail from its crown
(the core shows between them from every side); kelp shortened to 7–12 cm rags. Lantern 1,256 tris, pet 640.

**Renders read:** all sets. Fixed 1–3: from the fight camera the lantern reads as a rusted cage round a sea-green
flame; the gold pet reads as a small flame spirit at the party's heels. Attack1 bursts the flame out of the cage;
Death gutters out, the cage drops and tips onto its side; the pet fades to nothing.

**Defect found:** 4. The short kelp rags under the bottom plate still look a little like feet.

#### Round 1 — 2026-10-28 — leech

**Built.** `build_leech.py`: a 4.4 m (arc) body lying on the floor with the front third reared, oval in section,
annuli every 6.5 cm, a bloated sack, a pale belly; a round sucker-mouth (pink gums, three rings of round teeth, a black
throat) as wide as a hero; rig `Root` → `L_01..L_12` → `Head` + six `Lip_*` + a leaf `Sack` (21 bones); clips Idle,
Move (inchworm), Attack1 (latch), Attack2 (bloat slam), Hit, Death. 3,750 tris.

**Found before rendering:** the `Root` bone points forward, so its local Y (not Z) is forward — the first latch and
slam pushed the whole leech 35 cm *into the floor*. Fixed; the hit frames now put the mouth 2.4 m out at 0.7 m (latch)
and 0.4 m (slam).

**Renders read:** `lineup.png`, `lineup_side.png`, `read200_vault-leech.png`, every `clip_*.png`, `fight_leech_jar.png`.
The ringed mouth reads at once from the fight camera; the size is right.

**Defects found:**
1. The swallowed light (slot 11 faces) read as big flat yellow tiles; the dorsal dashes as a black checkerboard.
2. Two rings per annulus made the outline a saw-tooth.
3. The latch plunged the mouth into the floor (the head pitched down with the neck); rearing (Attack1 wind-up,
   Attack2) turned the mouth to the sky.
4. The inchworm hump was too small to read.

#### Round 1 — 2026-10-28 — ooze

**Built.** `build_ooze.py`: a blob (28 × 17 rings, lumps, drips) with face-painted highlights and foam; `ooze_junk`
(helmet, sword, chain, skull, bone) and `ooze_pearls` (11 pearls + one glowing); twelve deformation-field keys on all
three meshes; clips Idle, Move, Flee, Attack1 (lunge), Attack2 (splash), Hit, Death (melt), Split. Re-import: 12 morph
targets on each mesh, 8 animations × 3 `weights` channels, Attack1 pushes the body from 0.77 to 1.17 m forward.

**Renders read:** all sets. The pearls read; the splash rears into a crest and splats; the melt flattens everything
(junk included) into a puddle.

**Defects found:**
1. A smooth dome: from the fight camera the Brine Ooze read as a green pumpkin with a stalk (the upright sword).
2. Highlights painted on faces read as square tiles.
3. The helmet with a dark slit read as one big eye; the chain as two "0"s.
4. The lunge reached only 0.4 m.

#### Round 3 — 2026-10-28 — wraith

**Changed:** the robe's top cap in void colour; Death's heap flares the hem 34° / 12° (was 58° / 30°).
**Read:** `clip_Death.png` (rise, crumple, a heap with no spikes, sinks into the floor), `read200_wraith.png` (a hooded
ghost with two blue eyes and claws at 200 px), `fight_belfry.png`, `closeup_hood.png`.
**Defect found:** 1 again — the speck was not the cap: it is the hood's rolled rim at the chin, a small grey wedge
standing up inside the void. → round 4: the rim below the eyes takes the void colour.

#### Round 3 — 2026-10-28 — wisp (final)

**Changed:** the kelp hangs down the outside of the bars from mid-height to the bottom band (caught on the cage, not
dangling under it); the pet's palette comes from `content/pets/wisp.json` (`#f2e3a6 / #ffd166 / #fff8e1`, glow = the
gold, core = the cream).
**Read:** `lineup.png`, `read200_sheet.png`, every `clip_*.png`, `fight_drowned_choir.png`. Fixed 4. Every variant reads
and every clip plays clean. Lantern 1,256 tris (06: 1.5k), pet 640.

#### Round 2 — 2026-10-28 — ooze

**Changed** (round 1's 1–4): bigger lumps and drips, a scalloped foot; highlights as geometry (`shine`: lifted ovals,
slot 1 — foam white on the Brine, lilac sheen on the Pearl); the junk rebuilt — a pot helm with a rim band and a nasal
(no slit), a sword hilt (crossguard, grip, pommel), four bigger chain links, a skull with sockets and a jaw, a bone,
froth on the crown; 13 pearls; the lunge reaches 1.5 m (was 1.17). Brine 2,404 tris, Pearl 1,974.
**Read:** all sets. Fixed 2–4: the skull reads, the chain reads as links, the lunge lurches. **Still:** 1 — a smooth
dome; from the fight camera the hilt (pointing up) and the helm still gave a pumpkin-and-stalk read.

#### Round 3 — 2026-10-28 — ooze

**Changed:** the crown leans forward 10 cm (applied to every mesh, so the catch leans with it); the hilt juts sideways
low on the flank; the helm moved to the front-left shoulder; the main shine moved to the front (the side the fight
camera sees).
**Read:** all sets. The stalk is gone; the oozes read as blobs with things caught in them. **Still:** 1 — the outline
is a dome from every side (the lumps are under 6 cm against a 0.78 m radius); the big front shine reads like a sticker.
→ round 4: four big lobes (8–13 cm), a puddle lip spreading 12 cm past the body with a scalloped edge, a smaller shine.

#### Round 2 — 2026-10-28 — leech

**Changed** (round 1's 1–4): the swallowed light is nine round domed lenses (slot 11) with pale halos (slot 2) on the
sack; no dorsal pattern; three mesh rings per 13 cm annulus at ±4 % (soft segments); the latch keeps the mouth facing
the hero (the neck dips, the head tilts back up: mouth 2.25 m out at 1.2 m); the inchworm hump ×1.6. 5,350 tris.
**Read:** all sets. Fixed 1, 2 and the latch; the lights read as lantern-light under the skin, the segments as soft
rings. **Still:** rearing (Attack1's wind-up, Attack2's lift) tips the mouth to the sky; the tail end is blunt; the
lineup label falls outside the frame. → round 3: stronger head counter-bend, a tapered tail, the label in frame.

#### Round 3 — 2026-10-28 — leech

**Changed:** the head counter-bends harder while rearing (Attack1's wind-up, Attack2's lift and peak); the tail tapers
to 7 cm with a cap that follows the profile; the lineup frames its label.
**Read:** all sets. Fixed: the mouth faces the party through every attack frame; the tail reads as a tail; the fight
read is the leech at its best — the pink ringed mouth turned to the party, the segmented purple body, the swallowed
lights glowing in the sack.
**Defect found:** the round-2 inchworm, scaled ×1.6, lifted the whole front off the floor: its bends only ever rose
(cumulative +72°), so nothing brought the body back down. → round 4: bends that rise, fall and level out
(`[0, 16, 16, −16, −32, −16, 16, 16, 0…]`, summing to zero over the flat body: a 0.33 m hump, the front stays down).

#### Round 4 — 2026-10-28 — tentacle

**Changed:** a new review render, `naesa_attach.png`: two `naesa-arm` variants hung from the hero rig's upper-arm joints
(read from `hero_broad.glb`), each turned so the chain runs down the arm, playing Idle with an offset.
**Read:** the arms hang from the shoulders to the floor, suckers forward, drowned-blue tips — the attach works with no
special bones. **Defect found:** the tentacle's under-water root (0.3 m below `T_01`) stuck out behind each shoulder as a
flap. → round 5: `var_arm` folds that part into the joint (z × 0.12, radius × 0.75), and the manifest's `attach` says
how to mount it (bone, axis, scale, regions to drop).

#### Round 4 — 2026-10-28 — wraith

**Changed:** the rolled rim below the eyes in void colour. **Read:** `closeup_hood.png` — the void now runs down to the
chin, but the speck stayed, so it was neither the cap nor the rim. **Traced:** the robe's neck ring (z 1.66, its front at
y −0.105) lies on the void dish's lower slope at the chin (the dish passes y ≈ −0.106 at z 1.66): the cloth pokes
through the dish. → round 5: the neck ring tucked lower and narrower (z 1.61, 0.115 × 0.075 m), behind the dish.

#### Round 5 — 2026-10-28 — wraith (final)

**Changed:** the robe's neck ring tucked to z 1.61, 0.115 × 0.075 m, its cap at 1.63 (behind the void dish).
**Read:** `closeup_hood.png` — the speck is gone: a clean black hollow with two lit eyes; `lineup.png`, `views_sheet.png`,
`read200_wraith.png`, every `clip_*.png`, `fight_belfry.png` unchanged otherwise. Every clip plays clean. 2,250 tris
(06: 2.5k).

#### Round 4 — 2026-10-28 — ooze (final)

**Changed:** four big lobes (8–13 cm) in the rest shape, a puddle lip spreading 12 cm past the body with a scalloped edge,
a smaller front shine (8.5 × 4.8 cm) with two dots.
**Read:** `lineup.png` (it settles on the floor like slime now: the lip spreads, the outline is lumpy), every `clip_*.png`
(the lunge drags the lip forward with it; the splash, jiggle, melt and split hold), `fight_salt_circle.png` (two Brine
Oozes and a Pearl Ooze read as slime with their catch; no stalk, no pumpkin). Brine 2,404 tris, Pearl 1,974 (06: 2.5k).
**Left as is:** see the honest list at the end (opaque body, mound more than drip from some sides).

#### Round 4 — 2026-10-28 — leech (final)

**Changed:** the inchworm's bends rise, fall and level out (a 0.33 m hump over the flat body).
**Read:** `clip_Move.png` — the middle arches and flattens while the front stays down and reaches; the other strips,
the lineups and `fight_leech_jar.png` as round 3. Every clip plays clean. 5,350 tris (06: 8k).

#### Round 5 — 2026-10-28 — tentacle (final)

**Changed:** `var_arm` folds the under-water root into the joint; the manifest's `attach` names the mount (the hero's
`LeftUpperArm` / `RightUpperArm` head, the tentacle Rig +Y along the bone, 0.6 × the wearer, the arm regions dropped).
**Read:** `naesa_attach.png` — the arms now start cleanly at the shoulders; the other sets as round 3. Every variant
reads and every clip plays clean.

#### Final state — 2026-10-28

| base · file | animation | variants (tris; 06 budget) | clips (s; events) |
|---|---|---|---|
| wraith · `wraith.glb` 255 KB | skeletal, 23 bones | wraith 2,250 (2.5k) | Idle 3.0 loop · Move 1.2 loop · Attack1 Wail 1.3 (hit .6) · Attack2 Chill Touch 1.0 (hit .5) · Hit .5 · Death 1.8 (down 1.3) |
| wisp · `wisp.glb` 85 KB | node (5 nodes × TRS) | vault-lantern 1,256 (1.5k) · wisp pet 0.65× 640 | Idle 2.0 loop · Move 1.0 loop · Attack1 .9 (hit .45) · Attack2 .8 (hit .35) · Hit .4 · Death 1.4 (down 1.15) |
| tentacle · `tentacle.glb` 262 KB | skeletal, 17 bones | deep-tentacle 1,408 (3.5k) · deep-maw 7,870 (8k: plate 830 + 5 instances) · naesa-arm 0.6× + `var_arm` | Idle 2.4 loop · Move 1.2 loop · Attack1 slam 1.1 (hit .5) · Attack2 grab-wrap 1.5 (hit .55) · Hit .45 · Death 1.8 (down 1.5) · Rise 1.0 (up .7) |
| ooze · `ooze.glb` 352 KB | morph, 12 targets × 3 meshes | brine-ooze 2,404 (2.5k) · pearl-ooze 0.8× 1,974 (2.5k) | Idle 2.4 loop · Move 1.0 loop · Flee .7 loop · Attack1 lunge 1.0 (hit .45) · Attack2 splash 1.2 (release .55) · Hit .5 · Death melt 1.6 (down 1.1) · Split .7 (split .45) |
| leech · `leech.glb` 380 KB | skeletal, 21 bones | vault-leech 5,350 (8k) | Idle 2.8 loop · Move 1.6 loop · Attack1 latch 1.2 (hit .55) · Attack2 bloat slam 1.4 (hit .7) · Hit .5 · Death 2.0 (down 1.4) |

Every file: COLOR_0 codes exact (`inspect-glb.ts`: worst distance 0.0000), re-imported and played (a clip moves what it
should: the tentacle tip 2.7 m, the wraith's claw 1.2 m, the leech's mouth 1.3 m, the wisp's glow ×1.72, the ooze's
front 0.78 → 1.5 m).

**What the renders show (look here):** `fight_*.png` in each folder are the phone's view — the fight camera at the
phone's internal size (1338 × 618; a 1.8 m hero is 167 px tall), heroes left, monsters right; `lineup.png` (variants at
scale beside the 1.8 m hero), `read200_*.png` (the 200-px card read), `clip_*.png` (each clip at six frames, every
variant a row), `tentacle/naesa_attach.png`, `wraith/closeup_hood.png`, `reimport_check.png`.

**Still open (honest list):**
1. Everything is drawn opaque. The ooze's catch can only sit half out of its surface; it is modelled whole inside, so a
   semi-transparent ooze body (≈ 0.75) in the client would show it suspended, as 06 asks. The wraith would also take a
   little transparency well.
2. The Vault Lantern is 0.5 m (06) and its cage hides part of the flame from the fight camera; a client glow (a halo or
   a point light at `wisp_float`) would carry it further. Emissive strength is the client's `uGlow`.
3. The single tentacle's base is a wide stump on a dry floor (the Vault's water should hide it); from a low side view the
   Maw's gums are a pink shelf (from the fight camera they read as a throat).
4. The ooze is still more mound than drip from some sides; Split is only a shudder (the client spawns the second ooze);
   toon shading flattens the jelly — the shines are painted geometry.
5. 06's extra clips are not built: Wraith Drift, Lantern Flicker (Hit flickers), Tentacle Submerge / Grab-hold (Death
   and Rise cover leaving and arriving), Deep Maw Undertow / Swallow / Spawn (Attack2 opens the maw; a tentacle can play
   Rise), Ooze Split is a shudder, Leech Latch-hold / Bloat (Attack1 / Attack2).
6. Cloth has only the hem chains for secondary motion (the wraith's sleeves bend at two joints, no sway of their own).

**Notes for the client pass and the lead:**
- Three kinds of clip, all ordinary glTF animations played on the cloned scene: **skeletal** (`Rig`: rotation on every
  bone, translation on `Root` / `Maw` — the hover, lunges, the retract under the floor — and scale on the leaf bones
  `Lip_*` and `Sack`), **node** (`Wisp` → `wisp_float` → `wisp_body` / `wisp_glow` / `wisp_motes` / `wisp_cage`, TRS on
  the five), **morph** (`Ooze` → three meshes, a `weights` track each). The hero `keepTrack` (bone quaternions + Hips
  position only) would drop all three of the extras — a monster animator must keep them.
- Oozes: keep the morph targets live (do not bake / drop them as for heroes); the three meshes carry the same twelve
  `clip_*` targets in the same order and every clip drives all three, so merging them means merging the morph arrays.
- `manifest.json`: `parts` = the nodes shown besides `<base>_body`; `slots` overrides fixed palette slots (11 glow,
  14 gem); `pet` = the content pet id; `instances` (Deep Maw: `tentacle_body` ×5, glTF axes at scale 1 — multiply by the
  variant's scale — loops offset by `clipOffset`, one-shots in sync; the body is not drawn at the origin); `attach`
  (`naesa-arm`).
- `clips.json`: one key per base at the top level (the rat pass's layout; this pass's earlier `bases` block was moved
  up and removed). Extra events: `release` (ooze spit), `up` (tentacle Rise), `split` (ooze).
- Every clip is in place (no travel). Hold the last frame of Death: the tentacles and the Maw end 2.95 m / 0.95 m under
  the floor, the wraith 1 m sunk, the wisp at scale 0.001 with its cage on its side, the ooze a puddle, the leech curled.
- `curate_renders.py` keeps `read200_*`, `*sheet*`, `lineup*` and `reimport_check`; this pass's `fight_*.png` and
  `clip_*.png` need patterns added if the lead wants them in `art/review/`.

### The lead's review in the game (Phase 6 · 2026-10-28)

**Seen.** The client's shots at the phone's landscape viewport (`client/shots/`): every Cellars template from its camera
(plus the kennels fight and the guardpost crew), the Crypts chapel, ossuary and reliquary, the Vault sluice hall and the
throne room with the King, the three kit sheets (52 / 53 / 47 pieces), the four monster lineups (Cellars 14, Crypts 13,
Vault 16, pets 6), the effects sheet, and the fights with the performance overlay (the six-monster crew: 60 fps, 54
draw calls, 138k triangles on desktop Chrome with an Intel Iris Xe). Every room reads from its camera at phone size;
the monsters read as their roles beside the heroes; the effects read at fight distance.

**Defects found:**
1. The Holy mark, the heal motes and the Mender's Ultimate used a Latin cross — a real-world religious sign the game's
   own faiths never use. → (this round) an equal-armed glint of four tapered rays round a bright core
   (`client/src/scene/vfx/atlas.ts`, sprite `glint`); the effects sheet re-shot and read.
2. The King on his throne is small and dark from the throne room's 21 m template camera. The fight framing brings him
   closer; checked again when the throne fight is playable (Phase 7).
3. The viewer's Vault lineup (16 monsters in one row) overlaps its labels at phone size — a viewer-only defect, left
   for Phase 8's polish (two rows).
4. The six-monster crew in the narrow wine vault crowds the middle of the room; the bars and the turn ring keep it
   readable. Left as is.

**Left for Phase 7 (with the content that needs them):** Sister Naesa's phase 2 wears the B pass's built-in tentacle
arms — the C pass's skeletal `naesa-arm` attachment (06's design) is not wired; the Bursting Corpse's swell, the candle
ring going out, the Vault's tides, the chapel's raised EB2 mark and the arena marks; the throne fight's framing.
Ten of the sixteen pets (the eggs of the later dungeons, and the Vault's Brine Crab and Vault Imp) are still capsules:
the two Vault pets are modelled with the Vault content in Phase 7, the rest with their dungeons.

## Phase 7 · Rounds — the passes (2026-10-28)

Phase 7 is mostly sim and content; its one Blender pass built the two Drowned Vault pets that Phase 6 left as capsules (D-117). The pass log is merged here unchanged.

### The pets pass E — the Brine Crab and the Vault Imp (Phase 7)

*Phase 7, pets pass E (2026-10-28): the two Drowned Vault pets that still showed as capsules (D-117), `06` §9. Round by
round in `art/LOG.md`'s format: what was built, which renders were read, the defects as a numbered list with their
fixes, what is left. Scripts: `tools/blender/monsters/build_crab.py`, `build_imp.py` and `pet_lib.py` (new, this pass's
own: what a pet base needs on top of pass A's `creature_lib.py`, which is unchanged). Renders:
`art/renders/monsters/{crab,imp}/` (`cards.png` — Idle from 3/4, front, side and behind, Attack1 and Attack2 at their
events; `card.png` and `card_200.png`, the 3/4 card and its 200-px read; `cards_200.png`; `clip_<Clip>.png`;
`lineup.png`; `fight_view.png` / `fight_read.png`, the fight camera at the phone's canvas and its 240-px crop;
`reimport.png`). Checks per clip and the re-import report: `art/build/monsters_{crab,imp}_checks.txt`; build logs
`art/build/monsters_{crab,imp}_r<n>.log` and `_final.log`. All rounds rendered with `--quick` (8 samples).*

#### How the two bases are built

- **On pass A's kit.** Bodies are `creature_lib` implicit surfaces (metaball elements bound to bones, voxel-remeshed to
  the budget, projected back onto the field, normals from its gradient, weights from each bone's share of the field);
  attachments are lofts, cones, spheres and rings; each base has its own small rig (`CRig`) with the hero rig's axis
  rules, legs solved by the two-bone IK, clips as pose tables sampled on every frame, `Root` the only bone with location
  keys, loops closing exactly.
- **The game's colours in the reviews.** `pet_lib.game_colors()` fills the 16 slots exactly as the client does
  (`client/src/scene/monsters/manifest.ts → monsterPaletteHexes`: the content's three colours in 0–2, the accent again
  in 10 and 14, the fixed ink / leather / metal / glow / bone …), so a pearl in the gem slot (14) glows in the render as
  it glows in the game. Both pets put their pearls in slot 14 — the crab's pearl, the imp's eyes — which the client fills
  with the content's accent and draws emissive; neither entry needs a `slots` override.
- **The lineup is the shipped files.** Every other pet is read from its `.glb` and its manifest entry (parts, shapes,
  scale, colours), posed at Idle frame 0, beside the 1.8 m hero silhouette — the sizes the game will show.
- **The re-import check** imports the exported file into an empty scene (meshes, rig, every clip and its length, the
  decoded slots), shows the pet from it at Idle, Attack1's event and Death's last frame (`reimport.png`); `inspect-glb.ts`
  checks the COLOR_0 codes in the file itself.
- **Floor clearance by measurement.** Lying poses are grounded on the torso; a claw, ear or tail that still dips is turned
  (`pet_lib.clear_floor`, the crab's `clear_claws`, the imp's `clear_tail`) until its vertices clear the floor, and the
  imp's feet get a "sole snap" after meshing (the remesh rounds thin feet off unpredictably).
- **Sizes.** `06` §9's "crab base (new, 0.5 m)" and "imp base (new, 0.6 m)" are read as the pets' sizes, with each base
  built at 1.0 (a 1.0 m-shell giant crab; a 1.0 m imp) and the pets at x0.5 and x0.6 — the same numbers as the client's
  fallback `PET_SCALE` (`crab: 0.5, imp: 0.6`), so the pet is the right size even without its manifest entry.

#### Phase 7 · Pets E · Crab round 1 — 2026-10-28 — the library and the first crab

**Built.** `pet_lib.py` (the game palette, `PetBase(Monster)`: card sheet, lineup from the shipped files, clip checks over
the body *and* the pet's parts, the `clips.json` / `manifest.json` entries merged under `creature_lib.merge_json`'s lock,
the re-import check) and `build_crab.py`: 44 bones (Root · Body · Eye_L/R · per claw Claw_Arm / Fore / Hand / Finger ·
per leg Coxa / Femur / Tibia / Tarsus — the spider's legs: a yawing coxa, a two-bone IK with the knee up, the dactyl to
the floor); a metaball carapace with a thin flared rim, four teeth a side, two horns, eyes on stalks, an implicit
arm-forearm-palm per claw with tube fingers (the left a crusher, x1.12), eight tube legs with pale knuckles; the part
`crab_pearl` (a gem-slot pearl in a scalloped nacre collar); the six clips; export, tables, re-import.

**Renders read:** all. It reads as a teal crab with a glowing pearl; the lineup puts it beside the Bone Pup in size; the
GLB re-imports and poses as built.

**Defects found and fixed (round 2):**
1. The claws read as sausages — one long tube, the fingers fused into a club. → shorter arm and forearm, a big round palm,
   a resting gape between the fingers.
2. The legs were long and thin: a spider, not a crab. → stouter (radii x1.35), shorter, the knee lower (16°).
3. The thin rim (a 4.5 cm disc) remeshed into a jagged fringe that read as fur. → removed; the shell is a domed ellipsoid
   with front lobes.
4. Death drove a claw 15 cm into the floor. → `clear_claws` raises each claw until it clears.
5. Attack1's crusher swung down onto the floor at the hit. → it strikes forward at mid-height.
6. The re-import report gave the clips' lengths at the wrong rate (the importer converts at the empty scene's 24 fps) and
   its colour test tripped on the importer's own byte storage (504 values). → seconds at the import's rate; a histogram of
   decoded slots, exactness left to `inspect-glb.ts`.

#### Phase 7 · Pets E · Crab rounds 2–3 — 2026-10-28 — claws, legs, the shell's edge

**Renders read:** all (round 2), the cards and Death (round 3). The shell and legs now read as a crab's.

**Defects found and fixed:**
1. (Round 2) The claws still did not read: the fingers short and seen end-on, the ink tips small dark boxes. → (round 3)
   longer fingers, the claws raised and pointed inward.
2. (Round 2) A plain teal blob of a shell. → (round 3) a two-tone shell (teal top, pale sides) — whose boundary, painted
   face by face on the remeshed surface, came out ragged like torn paint. → (round 4) a clean pale lip (a flattened ring
   tube) round the shell's widest edge instead, the pale paint only underneath; the teeth (three a side) pale and larger.
3. (Round 3) More splay and roll in Death left the low side's legs 8 cm short of their marks (IK residual). → gentler
   splay and roll.

#### Phase 7 · Pets E · Crab rounds 4–5 — 2026-10-28 — the pincer

**Renders read:** all. Round 4's claws opened in Idle but read as sock puppets: arm, forearm and palm blended into one
tube and the gap between thick fingers closed under the outline.

**Fixed in round 5:**
1. A thin arm and wrist, then a distinctly swollen round palm.
2. Thinner fingers bowed into a wide C, as long as the palm, **pale** (slot 1) with **dark tips** (the last 30 %, ink).
3. The pincer's plane tilted 30° from the vertical toward outward-forward (the claw bones' Z follows it), so the C faces a
   camera in front and above (the fight camera looks down about 30°).
4. The pale palm-underside patches trimmed (n.z < −0.62).
5. Death grounded on the whole mesh — a front femur had dipped 2.6 cm.

Round 5's cards: the crusher reads as a pincer at the hit, both claws as raised pincers in Attack2, the C shows from
the front.

#### Phase 7 · Pets E · Crab final — 2026-10-28

**Defects found and fixed:**
1. Measured (`probe`: the torso's lowest point at Death's last frame): the whole-mesh grounding had left the dead
   crab's shell 8 cm (4 cm at pet scale) up, propped on its legs — the 9° roll pushed the low side's femurs under the
   floor. → a level body (pitch 0.5°, no roll), the dead feet pulled in (the knees ride higher) and the pose grounded on
   the shell: the shell lies at 0.4 cm, nothing below 0.1 cm.
2. The lineup's second label line (scale, triangles) fell below the floor. → one line.

#### Phase 7 · Pets E · Imp round 1 — 2026-10-28 — the first imp

**Built.** `build_imp.py`: 34 bones (Root · Hips · Spine · Chest · Neck · Head · Jaw · Ear_L/R · Tail_01..05 · per arm
UpperArm / LowerArm / Hand / Fingers1 / Fingers2 / Thumb, the hand bones' Z toward the palm so +X curls on both sides ·
per leg UpperLeg / LowerLeg / Foot / Toes, digitigrade, a two-bone IK with the knee forward); a metaball head and body
(cranium, crown, cheeks, muzzle, slanted brows, pot belly, thin legs), a separate jaw resting a little open, arms as
their own implicit meshes (so the hands cannot melt into the thighs), tube fingers and thumbs, big gem-slot eyes with
ink sockets, fangs on both lips, fin-ears and a crest (spines and a scalloped membrane as thin closed slabs), an S-tail
with a fin; the part `imp_satchel` (a leather pouch with a metal clasp on a strap round the chest); the six clips.

**Before the first render (the checks):**
1. The legs had a 2.3 cm IK residual even at rest: the hip lay at x 0.085, the other joints at 0.10, so the foot bones'
   directions could not lie in the leg's plane. → every leg joint in one plane: residual 0.0.
2. Death drove the tail 41 cm into the floor (on its back the S-tail points down) and then an ear fin 17 cm. → `clear_tail`
   lifts the tail bone by bone; `pet_lib.clear_floor` turns each ear whichever way clears with the smaller turn.
3. The feet hovered 2 cm, then (raised elements) sank 1.4 cm: the remesh rounds the thin feet off by a centimetre or two
   either way. → element heights reset (final fix in round 2).

**Renders read:** all. A white imp with glowing pearl eyes, a toothy grin, spiky fin-ears, a finned tail and a satchel;
every clip reads (the hand-rub Idle, the scamper, the snatch, the hex, the flinch, the fall onto its back); it stands a
third of a hero in the lineup. (A 32-minute gap between two strip renders in this run coincided with the session's
usage-limit stop — the machine, not the build; every other render took about a second.)

**Defects found and fixed (round 2):**
1. The ink sockets were big patches — a skull or a panda, not an imp. → thin dark rims (1.22 x the eye's radius, facing
   out).
2. White pillar legs and paddle feet. → slimmer legs.
3. The white hands vanished against the white belly. → hands, fingers, thumbs and feet in slot 1 (grey-beige "points",
   like the fins).
4. The brows did not read. → slot 1: a grey slanted brow over each eye.
5. The fangs were long. → shorter.

#### Phase 7 · Pets E · Imp rounds 2–3 — 2026-10-28 — the feet

**Built (round 2):** the sole snap — after meshing, the vertices weighted to Foot / Toes move down by their weight share
so the lowest sole point sits 4 mm above the floor (18.6–21.8 mm each build): every clip's feet at 0.3–0.4 cm.

**Renders read:** all. The face now reads at 200 px (glowing eyes, dark rims, grey brows, the grin).

**Defects found and fixed:**
1. (Round 2) The feet read as tiny grey hooves on stilt shins. → (round 3) three longer, wider-spread toes with a grey web
   between them (a newt-like Tidebound foot, a slab on the floor), thicker shins.
2. (Round 3) In Death the arms stuck straight up — a white tangle. → (final) the arms laid out to the sides, one leg flat.

#### Final state — 2026-10-28

**Checks** (`art/build/monsters_{crab,imp}_checks.txt`; lowest point of the deformed body and the pet's part on any frame /
worst IK residual / loop closure): crab — every clip ≥ 0.1 cm (Death's last frame: the shell at 0.4 cm), IK 0.0 cm, Idle
and Move close at 0.000°, 0.0000 m; imp — every clip ≥ 0.3 cm (Death: the torso on the floor at 0.4 cm), IK 0.0 cm,
loops close exactly. Location keys on `Root` only, both. `inspect-glb.ts`: both files, every mesh skinned, COLOR_0
worst distance from a whole code 0.0000. Re-import: both meshes, the rig, six clips at their built lengths, the pet shown
from the file at Idle, Attack1 and Death. `manifest.json` and `clips.json`: only `pet-brine-crab`, `pet-vault-imp`,
`crab` and `imp` added (checked against `HEAD`: no other key changed).

**Result:**
- `crab.glb` 433 KB, 44 bones, 6 clips — Brine Crab pet x0.5: 3,518 triangles (`crab_body` 3,130 + `crab_pearl` 388);
  a 0.5 m shell, 0.40 m to the top of the pearl, 0.76 m across the legs.
- `imp.glb` 331 KB, 34 bones, 6 clips — Vault Imp pet x0.6: 3,276 triangles (`imp_body` 2,990 + `imp_satchel` 286);
  0.56 m to the crown, 0.62 m to the crest, 0.44 m across the ears.

**What a script did not reach / left as is (honest list):**
1. The crab's shell top is plain teal (no pattern); its fingers are six-sided tubes, faceted at card size; the smaller
   claw's pincer is partly behind the crusher from the 3/4 view.
2. The crab dies belly-down with its legs splayed, not on its back — the pearl sits on top. It reads as collapsed.
3. The pale patches under the crab's palms and the slot boundaries on remeshed surfaces are a little ragged up close
   (per-face slots).
4. At the fight camera both pets are small (as the Rat Prince is): the crab reads as a teal crab with a white light, the
   imp as a white figure with two glowing eyes and fin-ears; the claws' pincers and the imp's grin are card-size reads.
5. The dead imp, seen from low down, is a tangle of white limbs; from the fight camera it reads as fallen.
6. The client plays Attack1 for every pet move (`fightAnims.ts`) and starts an attack 0.12 s before its event, so the
   wind-ups (the crusher cocked open, the imp's crouch) mostly will not show in the game; Attack2 (Tide Shell, Hex) plays
   only if the client asks for it (the entries' `clipMap` carries `Pinch`, `TideShell`, `Pilfer`, `Hex`).
7. No Flee clip (`06` §9's pets do not flee).
8. All review renders are `--quick` (8 samples).

#### Phase 11 · Rooms in Unity — 2026-10-30 — the kits as FBX, the first Unity shots

The four kits (shared 12, Cellars 40, Crypts 41, Vault 35 pieces) exported as FBX by the kit builds (`export_fbx`, D-158) and read in Unity: every mesh with its vertex colours, every slot code a whole number (worst error 0.000 over 45,000 vertices), custom normals kept; the import mirrors x, measured from `cel_wall_corner_in` and `shr_stairs_down`. The web's GLBs unchanged. Unity shots `unity/shots/room-cellars.png` (cel-t-guardpost), `room-crypts.png` (cry-t-wardens-vigil), `room-vault.png` (vlt-t-throne) and `room-dark.png` (the guardpost at light 20) read beside the Blender renders:

1. The layouts match the renders piece for piece — doors on the right walls, the table, the brazier for the campfire, the banner, the bone shelves and the bier, the throne and its water — so the mirror and the camera agree.
2. Round 1: the Cellars' bricks pale and washed out at full light. Two causes: the web's hemisphere (meant for a room with no shadows) on top of real torches, and the palette passed to the shader as sRGB numbers in a linear pipeline. → The hemisphere at 0.6, a light's strength capped at the ramp's top, the palette converted to linear.
3. Round 1: the Crypts' bier candle ring lit the floor like a floodlight (a candle's flame carried a torch's strength). → A strength by kind: candle 0.22, lamp 0.6, torch 1, fire and brazier 1.1.
4. The brazier and the sconces throw real soft shadows; the Vault's lamps pool light on the water; the caustic shimmers; the fog and the background colour are the zone's.
5. Left for later: the flames are unlit blobs (the sprite VFX come with the fight's effects); the mist and web pieces are drawn but not yet checked in a shot; door leaves do not open (Phase 13); no outline on rooms (as on the web, D-099).

# Segment 3 review — 2026-10-31 (Phases 9–14: Gloamvault in Unity)

*Written by Claude Code at the end of Phase 14 (`12` §3 asks for a review file here), **drafted before the block's phone install** (D-161: Phases 13–15 install together). The parts marked *at the install* are filled in when the build goes on James's phone. James: play the checklist, then answer the questions by pasting the Feedback prompt from `PROMPT.md` (or edit this file under "James's answers"). Every answer gets logged in `docs/13-DECISIONS.md` before the next block starts.*

## 1. What was built (one paragraph per phase)

- **Phase 9 — Unity on your phone.** The game moved from the web (frozen at v0.8.0, still live) to a Unity app (D-135): the project, the batchmode wrappers (`npm run unity:*`), a title screen with the speed overlay that writes one line a second to the phone log, the release key, and the first install over USB on your Galaxy S25 Edge — a steady 60 fps (D-155 found it is the Edge, not the Ultra).
- **Phase 10 — The rules inside Unity.** The TypeScript rulebook runs *inside* the app through Jint (D-157): the five golden delves give the same hashes on the phone as on the computer, start-up 0.6 s, a hero's turn 3–9 ms. A Rules check screen and `npm run unity:rules` run it over USB.
- **Phase 11 — Rooms.** The four Blender kits export FBX, the toon shader lives in URP with real torch light and soft shadows, every one of the thirty templates builds in a Rooms viewer (D-158).
- **Phase 12 — Heroes and monsters.** The 32 shipped models converted to FBX, every species × class hero assembled as skinned parts on one skeleton with the body shader and outline, every monster entry built, a Characters viewer (D-160). The phone showed three of them at 30 fps from the CPU — a Phase 14 item.
- **Phase 13 — Walking.** The on-screen stick walks your hero, walls and furniture block, the follow camera has its three distances (D-159), doors swing, lift and slide open with A (D-162).
- **Phase 14 — The test level.** A generated level of about 60 rooms and halls across the three kits, streamed around the hero (built ahead, released behind), the light following you, a pilot that walks it on its own and writes the soak numbers, `npm run unity:soak`, and the 60 / 120 frame-rate choice (D-163, D-164).

## 2. Screenshots

`unity/shots/` — `title.png` (the title and its buttons) · `rules.png` (the Rules check's table) · `room-cellars.png`, `room-crypts.png`, `room-vault.png`, `room-dark.png` (a room of each zone; the light meter down) · `hero-card.png`, `hero-swing.png`, `monster-old-gnaw.png`, `monster-king.png` · `heroes-matrix.png`, `monsters-cellars.png` (every hero at once; a zone's lineup) · `walk-room.png`, `walk-door.png`, `walk-far.png`, `walk-crypts.png` (the stick and A; a door opened; the far camera; the Crypts' gate) · `level-entry.png`, `level-far.png`, `level-crypts.png`, `level-overlay.png` (the test level: the entry, a hall from the far camera, the Crypts region, the overlay over the stream). Phone screenshots (`phone-*.png`) from the installs.

## 3. Try this on your phone (10–15 minutes)

*At the install: the three phone checklists in STATUS.md (Phases 13, 14 and 15) are the steps; they are copied here then.*

## 4. Numbers from the runner (so you can judge, not guess)

| Measure | Target | Now |
|---|---|---|
| Rules on the phone (Phase 10) | the same hashes as Node; a turn p95 < 30 ms; start-up < 3 s | 5 of 5 the same; 8–32 ms; 0.6 s |
| A room on the phone (Phase 11) | 60 fps | 60 fps; 107–522 draws; GPU 7–11 ms |
| A hero on the phone (Phase 12) | 60 fps | the Dwarf Warden 60; three others 30 (CPU 33 ms) — measured again at the install |
| The test level, 10 min at 60 fps | low 5 % ≥ 54 fps; thermal ≤ light | *at the install* |
| The test level, 10 min at 120 fps | low 5 % ≥ 108 fps; thermal ≤ light | *at the install* |
| Memory on the level | under 600 MB | *at the install* |
| Battery over the 10 minutes | noted, not judged | *at the install* |

## 5. Decisions I made this segment (Proposed — please accept, change, or say "you decide")

- **Tech:** D-157 Jint kept for the rules (the numbers were well inside the bar) · D-158 rooms as built (FBX from the kit builds, the toon shader in URP) · D-160 characters as built (parts on one skeleton; the outline by depth) · D-162 walking as built (the stick's bands, the camera's three distances and numbers, colliders from the bounds) · D-163 the test level as built (the generator, the rings, the light over a level, the pilot, the soak script, the 60/120 plumbing) · D-164 halls stand in for tunnels and caves (a cave kit is later Blender work). My recommendation: accept all; the numbers inside them are starting points the install moves.
- **Design, from your own words this segment (already Accepted, the readings Proposed):** D-141–D-154 — harder monsters, Hushsmoke and Callsmoke, only your hero seen, co-op explores apart, climb/crawl/jump, large explorable floors with a map, Floor 1 first, in and out by entrances only with the map kept, grinding pays less, skill trees with skill points, the Arcanist's elements and one-attack summons. D-156 the 120 fps choice (decided by the soak). D-159 third person with three distances.

## 6. Questions for you (from the docs' Open questions)

1. **120 fps** — if the soak holds, do you want 120 to be the default on your phone, or 60 with 120 as the choice in Settings (my recommendation: 60 default, 120 offered — cooler, and the fights are turn-based)?
2. **Level size** — the test level is about 60 rooms; does Floor 1 want to feel that large, or nearer the 5× end (my recommendation: Floor 1 at about 40 spaces, growing floor by floor)?
3. **Caves and tunnels** (D-164) — happy for Floor 1 to be built from the rooms and halls we have, with a cave kit later, or should the cave kit come before Floor 1?
4. **The camera** — after walking the level: close, normal or far as the default (D-159)?

## 7. Known issues and what the next segment does

- Known issues: three characters ran at 30 fps on the phone in Phase 12 (a CPU cost; measured again on the level at the install); the body shader scrambles under a second directional light (D-160, stages use one key light); the ooze has no clips (shape keys; Phase 19); a locked door at the level's edge is a dead end by design.
- Next (Phases 15–18): Floor 1 as a place with the map that fills in (15), climb/crawl/jump (16), Floor 1's rules — random battles, the smokes, the slower levels (17), the skill trees (18).

## James's answers

(leave blank; James fills in here or in chat)

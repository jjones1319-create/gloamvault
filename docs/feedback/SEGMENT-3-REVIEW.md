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

Installed 2026-11-01 (v0.15.0). Open the installed app; the title says **v0.15.0 · Phase 15 · Unity**.

**Walking (Phase 13)**

1. Open **Gloamvault** and tap **Walk**. *Your Dwarf Warden stands in a Cellars room.* Put your left thumb on the ring at the bottom-left and push: *he walks; push further, he runs; he turns the way you push and stops at the walls and the table.*
2. Walk up to a door until **A · Open** appears, then tap **A**: *the door swings open; walk through it.* (Tap ▶ at the top for other rooms: the Crypts' iron gate, the Vault's door.)
3. Tap **Camera** a few times: *close over the shoulder, normal, far and high.* Turn while walking: *the view swings round behind you.*

**The test level (Phase 14)**

1. Open **Gloamvault**, tap **Test level**. *Your Dwarf Warden stands in a Cellars guardpost; the stats line at the top says how many rooms are built.* Walk through any doorway: *the next room is already there, and more appear ahead as you go — no loading, no pause.* Keep walking into the middle third: *the Crypts, green and dim; then the Vault.* Doors with "A · Locked" lead nowhere yet (the level's edge).
2. Tap **Auto walk**: *he walks off on his own, opens doors, crosses halls.* Turn the **Speed overlay** on (Back → Speed overlay → Test level): *watch the fps and "draws" while he walks for a minute.* Tap Auto walk again to take over.
3. Tap **Back**, tap **Frame rate: 60** so it reads **120**, then **Test level** again and walk: *does it feel smoother? does the phone warm?* (Claude's 10-minute soaks at both rates are in STATUS and `docs/10-TECH-PLAN.md` §4 — tell Claude what you felt.)

**Floor 1 (Phase 15)**

1. Open **Gloamvault**, tap **Floor 1**. *You stand at the keep's gate (walk back to the archway behind you: "A · Leave the keep"); the little map at the top right shows your room and a "?" beyond its door.* Walk east through the hall and the crossing: *rooms draw themselves on the map as you enter them.* Tap **Map**: *the whole floor, dark except where you have been.*
2. At the crossing take the north hall to **the cold hearth**: pull the **lever** (A · Pull) — *a gate grinds up somewhere.* Walk to the room's **west wall**, right up to the middle of it, facing it: *"A · Search" — press it and a panel slides aside: the Hearth Shrine.* Go east along the hall: *the kennels' portcullis is up.*
3. Back at the crossing take the south hall; in **the storeroom** on the spine (east of the long gallery) pick up the **key** (A · Take the key), then in the south wing walk to the **wine vault's door** ("A · Locked"): *press A — the key turns.* Then tap **Back**, tap **Floor 1** again: *the map remembers everything you found.*

## 4. Numbers from the runner (so you can judge, not guess)

| Measure | Target | Now |
|---|---|---|
| Rules on the phone (Phase 10) | the same hashes as Node; a turn p95 < 30 ms; start-up < 3 s | 5 of 5 the same; 8–32 ms; 0.6 s |
| A room on the phone (Phase 11) | 60 fps | 60 fps; 107–522 draws; GPU 7–11 ms |
| A hero on the phone (Phase 12) | 60 fps | the Dwarf Warden 60; three others 30 — the same 60-target pacing trap as the level (D-167); at 120 the one-room walk reads 119.8 |
| The test level, 10 min at 60 fps | low 5 % ≥ 54 fps; thermal ≤ light | **60 p50, low 5 % 60** over five minutes walking, but with GPU 11–13 ms and CPU p95 18 ms (half the headroom of 120) and 30 fps stalls when standing at the start — see D-167 |
| The test level, 10 min at 120 fps | low 5 % ≥ 108 fps; thermal ≤ light | **120 p50, low 5 % 120; frame p95 8.3 ms; thermal 0** — holds |
| Memory on the level | under 600 MB | 134 MB at the peak |
| Battery over the 10 minutes | noted, not judged | at 120: 71% → 75%, 36.0 → 36.4 °C · at 60: 80% → 82%, 36.6 → 36.2 °C |

## 5. Decisions I made this segment (Proposed — please accept, change, or say "you decide")

- **Tech:** D-157 Jint kept for the rules (the numbers were well inside the bar) · D-158 rooms as built (FBX from the kit builds, the toon shader in URP) · D-160 characters as built (parts on one skeleton; the outline by depth) · D-162 walking as built (the stick's bands, the camera's three distances and numbers, colliders from the bounds) · D-163 the test level as built (the generator, the rings, the light over a level, the pilot, the soak script, the 60/120 plumbing) · D-164 halls stand in for tunnels and caves (a cave kit is later Blender work). My recommendation: accept all; the numbers inside them are starting points the install moves.
- **Design, from your own words this segment (already Accepted, the readings Proposed):** D-141–D-154 — harder monsters, Hushsmoke and Callsmoke, only your hero seen, co-op explores apart, climb/crawl/jump, large explorable floors with a map, Floor 1 first, in and out by entrances only with the map kept, grinding pays less, skill trees with skill points, the Arcanist's elements and one-attack summons. D-156 the 120 fps choice (decided by the soak). D-159 third person with three distances.

## 6. Questions for you (from the docs' Open questions)

1. **120 fps** — the soak settled it the other way round: on your phone 60 misbehaves (it drops to 30) and 120 runs clean, so **120 is now the default** (D-167). Keep it so? (My recommendation: yes; a battery mode comes with Settings.)
2. **Level size** — the test level is about 60 rooms; does Floor 1 want to feel that large, or nearer the 5× end (my recommendation: Floor 1 at about 40 spaces, growing floor by floor)?
3. **Caves and tunnels** (D-164) — happy for Floor 1 to be built from the rooms and halls we have, with a cave kit later, or should the cave kit come before Floor 1?
4. **The camera** — after walking the level: close, normal or far as the default (D-159)?

## 7. Known issues and what the next segment does

- Known issues: three characters ran at 30 fps on the phone in Phase 12 (a CPU cost; measured again on the level at the install); the body shader scrambles under a second directional light (D-160, stages use one key light); the ooze has no clips (shape keys; Phase 19); a locked door at the level's edge is a dead end by design.
- Next (Phases 15–18): Floor 1 as a place with the map that fills in (15), climb/crawl/jump (16), Floor 1's rules — random battles, the smokes, the slower levels (17), the skill trees (18).

## James's answers

(leave blank; James fills in here or in chat)

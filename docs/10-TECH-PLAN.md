# 10 — Tech Plan

*Last updated 2026-10-29 · rev. 9 (checkpoint 2: §1 the Unity decision — D-135; §2.1 the Unity stack — D-140; §3, §4, §5, §7 marked for Unity; the web plan kept as the record of Segments 1–2) · rev. 8c (Phase 8, pass C: §4 measured — the dips were shader compiles, not the mist; programs kept and compiled before showing) · rev. 8a (Phase 8, pass A: §2's audio and §3's `src/audio/` as built) · rev. 8b (Phase 8, pass B: §6 the backup reminder as built) · rev. 7 (Phase 6: §4 measured; the room, monster and effects modules and the gallery in the client map — D-110–D-117) · rev. 6 (Phase 5: the character modules, the viewer, looks in the save — profile version 3, the model index) · rev. 5 (checkpoint 1: open questions answered by delegation — D-099; save version 2 and the Hall of Nightmares key — D-095) · rev. 4 (Phase 4: the town, the save, the screens and the client map as built; James's death and party rules, D-087–D-094) · rev. 3 (Claude; rev. 2 after Phase 1 built the skeleton: the §3 layout notes on the Vite root, the three TypeScript projects and Node-direct tools, and the §7 screenshot viewport — D-048, D-052; rev. 3 after Phase 2 built the sim: the §3 module map). The engine decision is D-002 in `13-DECISIONS.md`; the research behind it is `docs/research/2026-10-26-tech-engine-android-coop.md` (which recommended Godot + APK under an "APK on GitHub" framing — §1 below says why the web path wins for James specifically).*

## 1. The decision (checkpoint 2, D-135): a Unity app for Android

**From Phase 9, Gloamvault is rebuilt as a Unity 6.3 LTS app** (6000.3.27f1) for Android, installed on James's Galaxy S25 Ultra over a USB cable to this PC (D-138), and later published on Google Play. James chose it at checkpoint 2: *"I think I would like to attempt unity. I believe we can upgrade everything pretty substantially if we do that."* It comes with free-roam exploration (D-136) and small phases (D-137).

Why it is worth the rebuild: a native app reaches the phone's full graphics power (Vulkan rather than WebGL in Chrome), can be as large as it needs to be (James: *"I am okay with it being much larger"*), and is the road to the Play Store. What it costs: the web version's link-and-install, its automatic updates and its WebRTC-in-the-browser co-op plan (co-op's networking is re-decided before it is built, §5); about sixteen small phases before the Unity version does everything the web version does.

What carries over unchanged: the design docs; the content JSON, its schemas and linter; the Blender build scripts (they gain FBX exports); and — if Phase 10's test passes — the TypeScript sim, its tests, replays and balance runner, run inside Unity by Jint (D-139). **The web version stays live at its link, frozen at v0.8.0 (fixes only), until the Unity version has all of Gravehollow (D-150).**

### 1.1 Segments 1–2: a web app installed from GitHub Pages (D-002, superseded by D-135)

**Gloamvault is a TypeScript + three.js web app (an installable PWA) hosted on GitHub Pages**, exactly the way Wildsong Ranch already reaches James's phone: open the link in Chrome on the S25 Ultra → *Install app* → it runs full-screen and offline, and every push to `main` updates it within minutes.

Why this and not a native Android APK (the tech report's recommendation):

| | Web app on GitHub Pages | Godot APK on GitHub Releases |
|---|---|---|
| Getting it on the phone | the link + "Install app"; James has done this twice (Wildsong Ranch, Project Ascend prototypes) | JDK + Android SDK + keystore on the PC; on the phone turn off Samsung Auto Blocker, allow "unknown apps", reinstall every update by hand |
| Updates | automatic ("Update ready → Restart") | download and reinstall each APK |
| Google's 2027 sideloading rules | unaffected | unverified APKs need a developer account or ADB from 2027 (research §2.4) |
| Friends joining | they open the same link | each friend sideloads |
| Co-op transport | WebRTC is built into the browser; a relay is a free Cloudflare Worker | ENet needs port-forwarding; internet play needs a VPS (Nakama) |
| Wildsong Ranch pets | same GitHub Pages origin and the same language: import is a share code or a direct read | a bridge between two apps |
| What Claude Code can verify | Vitest, Playwright screenshots in the installed Chrome, the same harness Wildsong has | Godot headless + adb, all new on this machine |
| 3D quality on an S25 Ultra | WebGL2 on Adreno 830 runs this scene (≤ 8 skinned characters, baked rooms) at 60 fps; WebGPU is available in Chrome Android as a later upgrade | Vulkan: more headroom, which this game does not need |

The one real cost is rendering headroom; §4 budgets for it. If Phase 6 cannot hold 60 fps on the S25 Ultra within the budgets, the fallback is **Godot 4.7 with the research report's plan** — the content (JSON) and the design carry over unchanged; the sim would be ported (D-002 records this).

## 2. Stack (keep it; ask before adding a dependency)

### 2.1 The Unity stack (from Phase 9; D-140, Proposed)

- **Unity 6.3 LTS** (6000.3.27f1) with Android Build Support (its own SDK, NDK and OpenJDK), the free **Personal** licence (James signs in to Unity Hub once). Editors live in `C:Usersjjones1UnityHubEditor`; the Hub is an MSIX app and its command line runs headless (`tools/unity/`).
- **URP** (the mobile pipeline asset) · **UI Toolkit** for every screen and the HUD (UXML + USS: text files, flexbox and CSS-like styles, so the Preact screens port) · **Input System** (on-screen stick and buttons) · **Unity Test Framework** (EditMode and PlayMode tests in batchmode).
- Android: **IL2CPP, ARM64 only, Vulkan with a GLES3 fallback, landscape only**, minimum API 29, target API 36 (Play's rule for new apps), package id `com.gloamvault.game`, one release key from the first build (kept in `DocumentsGloamvaultkeys`, never in the repo).
- **The sim** stays TypeScript, bundled into one JS file and run by **Jint** behind a JSON bridge (D-139; Phase 10 decides). **Models** arrive as FBX from the Blender scripts; **sound** as audio files rendered from the web engine; **saves** as JSON files in the app's storage.
- Everything Claude Code writes is text (C#, UXML, USS, shader code, scene-building scripts); Unity runs in **batchmode** only. Unity cannot open a project in batchmode while the editor has it open.

### 2.2 The web stack (Segments 1–2; frozen at v0.8.0)

- **Vite** (current major) + **TypeScript** `strict` + **Preact 10** + `@preact/signals` for every 2D screen and the in-fight HUD (the pattern Wildsong Ranch uses; Claude Code knows it).
- **three.js** (current release, pinned) for the dungeon, town and character viewer: `GLTFLoader` (+ `KTX2Loader`/Draco optional), `AnimationMixer`, `SkinnedMesh`, custom toon `ShaderMaterial`, inverted-hull outlines, `EffectComposer` only for a cheap bloom on element glows.
- **Sim**: a pure TypeScript package `sim/` — no DOM, no `Math.random`, no `Date.now`, integer math, seeded PCG32/xoshiro RNG, `createDelve / legalActions / step / runAuto / replay / hashState`. Policies for tests and auto-play in `sim/src/policies.ts`. (Project Ascend's `@ascend/sim` is the pattern.)
- **Content**: `content/<kind>/<id>.json` validated by `content/schemas/*.schema.json` with **ajv** (strict) in `npm run lint`; the linter also checks the cross-file rules in `content/README.md`.
- **Saves**: `idb-keyval`, keys prefixed `gloamvault/` (all GitHub Pages sites on an account share one origin), **valibot** validation, versioned migrations, export/import as `.txt`/`.json`, `navigator.storage.persist()` asked once.
- **PWA**: `vite-plugin-pwa` (`registerType: 'prompt'`, update toast only in town), manifest `orientation: "landscape"`, `display: "fullscreen"`, 3D assets runtime-cached (CacheFirst) rather than precached so the install stays small.
- **Audio**: Web Audio; port Wildsong Ranch's `src/audio/engine` (our own sequencer over CC0 samples; original music written for this game) in Phase 8. *As built (Phase 8, pass A):* the engine is ported to `client/src/audio/engine` (context, transport, scheduler, sampler, synth, voices, sfx, reverb, ambience, meters) and arrives by dynamic `import()` on the first tap, when the AudioContext is made inside that gesture (Android Chrome starts audio only then); the main bundle holds only a small facade (`client/src/audio/index.ts`). The music is eleven pieces and six stingers written in ABC for this game (`client/src/audio/music/`, one lazy chunk per piece); the director (`director.ts`, tables in `places.json`) picks the piece, its layers, the ambience bed and the reverb by place; effects follow the fight's beats and the delve's log (`sounds.ts`). 235 CC0 Opus samples (2.2 MB, 245 s; VCSL, VSCO 2 CE, Kenney) are copied from Wildsong by `tools/audio/copy-samples.ts`, runtime-cached and fetched per piece on first use, never precached. Every audio number — volumes, fades, speed thinning, the calibration trims — lives in `client/src/audio/tuning.json`; `node tools/audio/check-audio.ts --port <dev port> [--effects]` renders every piece, effect and bed in headless Chrome and measures them. An audio failure is a console warning and silence, never an error.
- **Networking**: `client/src/net/` with one `Transport` interface and three implementations — `LocalTransport` (loopback), `WebRtcTransport` (**Trystero**: serverless WebRTC signalling over public trackers/Nostr/MQTT; STUN from Google), `RelayTransport` (a **Cloudflare Worker + Durable Object** room relay over WebSockets; free tier; `wrangler deploy` from `tools/relay/`).
- **Tests**: **Vitest** (sim, content, save, formulas), **Playwright** with the installed Chrome (smoke + screenshots), the balance runner (`tools/balance`), Blender render checks (`11-ART-PIPELINE.md`).
- **Tooling on the PC**: Node 24 LTS, npm ≥ 11, Git, GitHub CLI, VS Code + Claude Code, Blender 5.2 (headless only), Google Chrome.

## 3. Architecture

**Unity (from Phase 9).** `unity/` is the Unity project (`Assets/Gloamvault/` — Scripts by area with assembly definitions, UI as UXML/USS, Shaders, Scenes built by editor scripts; `Packages/`; `ProjectSettings/`); `Library/`, `Temp/`, `Logs/`, `obj/`, `Build/` and `UserSettings/` are never committed. `tools/unity/` holds the PowerShell wrappers behind `npm run unity:*`. The sim reaches Unity as a bundle built from `sim/` (Phase 10) and the content as one JSON bundle built from `content/`, both generated, never edited. The web layout below stays the reference until the Unity version has all of Gravehollow (D-150).

```
gloamvault/
  sim/            pure rules (TypeScript, deterministic): rng, stats, timeline, combat, statuses,
                  skills (effect DSL interpreter), items (durability, xp, promotion), loot, chests,
                  exploration (floor generator, light, detection, ambush, hunter), pets, party,
                  policies (scripted players), replay/hash
  content/        JSON + schemas (the design as data) · README.md lists the linter rules
  client/
    src/scene/    three.js: room stage, characters (rig + modular gear), monsters, camera rigs,
                  vfx, toon shader, lights; asset loader & budget overlay
    src/ui/       Preact: screens (title, creation, town, waystone, delve map, fight HUD, inventory,
                  skills, pet, chests, settings), components, signals
    src/net/      Transport, Lobby (invite codes), host sequencing, reconnect, host migration
    src/save/     db, schema, migrate, exportImport
    src/audio/    index (the facade), engine/ (ported), director, sounds, runtime, music/ (ABC pieces, stingers),
                  recipes/ (instruments, effects, ambience beds), tuning.json, places.json
    public/       models/ (glb), textures/, audio/, icons, manifest
  tools/
    lint/         ajv + cross-file rules → `npm run lint`
    balance/      batch runner → tools/balance/out + docs/balance/<date>.md → `npm run balance`
    shots/        Playwright screenshot set → client/shots/ → `npm run shots`
    blender/      build_*.py, render.py, export.py, run.ps1 (see 11-ART-PIPELINE.md)
    relay/        the Cloudflare Worker (Phase 9)
  docs/           this folder · STATUS.md at the root is the checkpoint
  .github/workflows/deploy.yml   build + verify + deploy to GitHub Pages on push to main
```

Rules: `sim/` never imports `client/`; `client/` reads sim state and sends commands; every tuning number lives in `content/tuning.json` or the content files, never in code; screens are chosen by app state and mirrored to the URL hash (`#delve=gravehollow&zone=1&seed=17`), never path routing (GitHub Pages cannot serve it); asset URLs come from `import.meta.env.BASE_URL`.

**The sim as built in Phase 2** (`sim/src/`, pure, DOM-less, every number from `content/tuning.json`):

| Module | Owns |
|---|---|
| `rng.ts`, `hash.ts` | xoshiro128** on four u32 words (the state lives in the save), `seedFor`, FNV-1a state hashes |
| `types/enums.ts`, `types/content.ts`, `content.ts` | every closed set, the record types mirroring `content/schemas/`, the `Content` bundle (`buildContent` from `{kind, path, json}` files; split templates merged) |
| `stats.ts`, `xp.ts`, `insight.ts`, `economy.ts`, `grades.ts`, `durability.ts` | 03 §2.2 derived stats, §5 curves (gate, D curve, budgets, ranks, points, item levels), §7.5 Insight, §7.4/§7.6/§8 prices in R, drop shapes with the folds and Luck, wear bands, +N, promotion and salvage arithmetic |
| `light.ts`, `detection.ts` | the light bands, Detection, traps, secrets, scouting, the surprise roll both ways |
| `timeline.ts`, `statuses.ts`, `effects.ts`, `hooks.ts`, `skill-lines.ts`, `skills/custom/*`, `fight.ts`, `ai.ts`, `monsters.ts`, `pets.ts`, `hero.ts` | the energy timeline with jitter and charged casts; the 27 statuses; the effect-DSL interpreter and damage pipeline; persistent hooks (passives, affixes, traits, gear lines, stances, broken limbs — D-071); Mastery merging; one hook file per `customId` in five group registries (`skills/custom/README.md` is the handler contract); the fight loop with commands, auto heroes, rounds, flee, boss phases, summons, part breaks; the gambit parser; monster, pet and hero actors (`createHero`, `buildHeroActor` through the item module) |
| `items.ts`, `loot.ts`, `chests.ts` | instances and affixes, effective stats through +N and the durability band, wear and care, promotion, salvage, item XP; fight and room loot, dungeon chests; the Curio Merchant's chests with pity and the Tome bag |
| `generator.ts`, `generator-ascii.ts` | the 07 §2.10 grammar, layout, decoration and the floor hash; the `#gen` ASCII map |
| `explore.ts`, `progress.ts`, `policies.ts`, `delve-types.ts`, `delve.ts` | room dressing, encounters, champions, traps, curios, merchants, the hunter's path; XP and wear applied after a fight; the four scripted players; `createDelve / legalDelveActions / stepDelve / runDelveAuto / replayDelve / hashDelve` |

Tools: `tools/sim/run.ts` (`npm run sim`), `tools/balance/run.ts` (`npm run balance` → `tools/balance/out/` + `docs/balance/`), `tools/sim/loadContent.ts` (the fs loader); the Phase 2 fixture content and its assembler live in `sim/test/fixtures/`.

**Phase 4 adds** (the playable slice; D-087–D-094): in `sim/src/`, `town.ts` (the profile and every town action: the purse and the bank, the roster with the chosen hero and wayfarers, the party, the dead at the Shrine, legacies and the Memorial, start and settle a delve, the Blacksmith, the Skill Hall, the Curio Merchant, the Stables, the Quest Board), `wayfarers.ts` (the Wayfarer Chest's cast, odds and draw), `threat.ts` (the threat read), `armory.ts` (auto-equip and the gear verdict); `fight.ts` gains `turnForecast` and `fleeChance`, `delve.ts` the Mortal rule and the raise, `hero.ts` `loseLevels` and `addBattleXp`. The client as built:

| Where | What |
|---|---|
| `client/src/game/session.ts` | the one door the screens go through: the profile, the delve and its version as signals; `act` / `actWith` for town actions (a TownError becomes a toast); delve stepping with the command log and replay on reload; deep links (`#delve=…&seed=…&party=…&level=…&learn=…&death=…&auto=1`) and the demo town (`#town&demo=1`), both ephemeral |
| `client/src/save/` | `db.ts` (idb-keyval under `gloamvault/`, the erase marker), `profile.ts` (valibot envelope, repair against the loaded content, three rotating backups, export and import), `settings.ts` |
| `client/src/ui/app.tsx`, `router.ts`, `main.tsx` | hash routes (title, settings, phone, new-hero, town, hero, delve), the ready flag the shots wait for, the boot (deep link, demo or save) |
| `client/src/ui/kit/` | the shared kit: Page, Btn, Meter, WearPips, Grade, Tabs, Modal, Tile, Section, Chip, Stat, the gold badge, toasts |
| `client/src/ui/screens/Title.tsx` | New game (the death rule first, D-088) or Continue |
| `client/src/ui/screens/NewHero.tsx`, `newhero/` | the selection: species, class, three skills, the egg (first hero only), points and name, review (D-090) |
| `client/src/ui/screens/Hero.tsx`, `hero/` | status with the XP bar, gear with eleven slots and auto-equip, skills in three school columns with the loadout and the AI-rule editor, the pet |
| `client/src/ui/screens/Town.tsx`, `town/` | Emberfall's hub and its nine places: Waystone (floors with their threat), Blacksmith, Skill Hall, Curio Merchant (odds, pity, the Wayfarer Chest), Stables, Bank, Quest Board, Lantern Inn (roster and party), Ember Shrine (raise, lay to rest, legacies, the Memorial) |
| `client/src/ui/screens/Delve.tsx`, `delve/` | the delve overlay: header (floor, light, clock, threat), party strip, minimap and the big map, room panel with grouped actions, curio, result and end cards |
| `client/src/ui/screens/delve/FightHud.tsx`, `delve/fight/` | the turn-based fight HUD: whose turn, the strip of 8, cards with statuses, skills, Guard / Item / Row / Ultimate / Flee (with its chance), target taps, pet stance, Auto and the rule editor, 1× / 2× / 3× playback cued into the scene, the threat chip |
| `client/src/game/fightView.ts` | pure helpers the HUD reads (beats, presence, strip chips, targets) |
| `client/src/scene/room.ts`, `scene/room/`, `ui/components/RoomStage.tsx`, `scene/sceneBus.ts` | the grey-box 3D room from its template, the heroes as assembled characters (capsules while they load, and for pets and monsters until Phase 6), the light rig driven by the light meter, the fight's cues (incl. `anim` cues → hero clips) |
| `client/src/scene/characters/` (Phase 5) | the hero pipeline's client half: pure helpers with tests (`palette`, `geometry` — morph baking, region filtering, bone-name remap, merge, absolute bone scales, the Hips track — `manifest`, `outfit`), the palette toon material and outline (`material`), model loading with content-hashed URLs (`assets`, `modelIndex.json` written by a Vite plugin from `tools/build/model-index.ts`), `assembler` (look + equipment → one skinned mesh), `animator` (one AnimationMixer per character), `factory`, `viewerScene` |
| `client/src/ui/screens/Viewer.tsx`, `ui/components/CharacterCanvas.tsx`, `ui/screens/newhero/LookStep.tsx`, `game/fightAnims.ts` | the character viewer (`#viewer=dwarf,warden,S`), the canvas any screen can embed, the New hero Look step with its live preview, the fight log → clip cues |
| `client/src/scene/env/`, `scene/room/` (Phase 6) | the room kits: the zone manifests read tolerantly (`envData`), the kit loader and palette material with baked AO (`envKit`, `envMaterial`), the shell from footprint and doors (`shell`, `kitRoom`), the kit sheet (`kitLineup`); the room builder dresses templates from the kit, merges statics and instances repeats |
| `client/src/scene/monsters/`, `scene/vfx/`, `game/fightFx.ts` (Phase 6) | monsters from `models/monsters/manifest.json` (`manifest`, `model`: base + parts + shapes + palette + bone scales + pose offsets, the clip map; the lineups), the effects atlas drawn in code and its one-draw-call layer (`atlas`, `layer`, `recipes`, `fxSheet`), the fight log → effect cues |
| `client/src/ui/screens/RoomView.tsx`, `ui/screens/viewer/{Lineups.tsx,gallery.ts}`, `ui/screens/delve/autoplay.ts`, `tools/shots/soak.ts` (Phase 6) | `#room=<template>` (every template from its camera, with monsters and heroes on their marks), the monster and kit lineups and the effects sheet, the phone's gallery (title → Monsters & rooms), the `#autoplay` driver and the 30-minute soak |

`tools/shots/dev-shot.ts` shoots one deep link from a running dev server (the passes used it); `tools/content/gen-wayfarers.ts` writes the cast; `tools/balance/debug-seed.ts` replays one runner seed step by step.

As built in Phase 1 (D-048): one `package.json` at the root (no workspaces); the **Vite root is `client/`** (`client/index.html`, `client/src`, `client/public`; `dist/` at the repo root); `sim/` and `content/` are imported by relative path. **Three TypeScript projects** under one `tsc -b`: `tsconfig.sim.json` compiles `sim/src` with `lib: ["ES2023"]` and no DOM types, so a browser call in the sim is a type error; `tsconfig.client.json` (DOM, Preact JSX); `tsconfig.tools.json` (`tools/**`, `sim/test`, `e2e`, the configs). Tools run on **Node 24 directly** (`node tools/lint/index.ts`; type stripping, so imports carry `.ts` and the code uses only erasable syntax), no `tsx`. The sim's `Tuning` type is derived from `content/tuning.json` itself (`typeof` on a type-only import) so a renamed key fails the typecheck; the sim never reads the file at runtime — the client (`import.meta.glob`) and the tools (`readFileSync`) load content and pass it in.

## 4. Rendering budgets for the Galaxy S25 Ultra (WebGL2 in Chrome)

*Unity (D-135): these budgets are the web version's. The Unity budgets are **measured on the phone itself in Phase 14** (a 10-minute soak of a large seamless floor over USB: frame time, draw calls, triangles, memory, battery temperature) and written here then; until then the Unity build starts from the numbers below, which the web version already holds at 60 fps. James (checkpoint 2): the phone can take far more than these numbers ask of it — Phase 14 finds out how much.*

The S25 Ultra's Adreno 830 throttles to ~50% of peak GPU within 3–4 minutes (research §4). Design for the **sustained** budget:

| Knob | Budget (starting point) |
|---|---|
| Frame rate | cap **60 fps**; a "battery" mode at 30 |
| Render resolution | `renderer.setPixelRatio(min(devicePixelRatio, 2) × 0.75)` ≈ 1,170 × 2,340 internal on the 1440 × 3120 panel; UI at native |
| Characters on screen | ≤ 8 skinned (4 heroes + 4 pets) + ≤ 6 monsters; each hero ≤ 15k tris *with* gear, pets 2–4k, monsters 3–8k, bosses ≤ 12k |
| Bones | ≤ 70 per rig, 4 influences per vertex |
| Draw calls | ≤ 200 per frame (modular gear is ~12 calls per hero; rooms are merged kit meshes, props instanced with `InstancedMesh`) |
| Textures | 1024² per character atlas (2048² for the player's own hero), 2048² per room kit; KTX2/Basis when the loader is in, PNG until then; total GPU memory ≤ 500 MB |
| Lights | baked lightmaps or vertex AO on rooms; **2 dynamic point lights** (torches) + 1 hemisphere; **1 shadow-casting light** at 1024² or none (toon style hides it) |
| Post | bloom on emissive only, no SSAO, MSAA off at 0.75 scale |
| Memory | keep the tab under 1.2 GB; unload the previous room's kit on transition |

An in-game **performance overlay** (fps, frame ms, draw calls, triangles, GPU memory estimate) is a Settings toggle so James can read numbers off the phone; a **soak test** (`#autoplay=1&minutes=30`) lets Claude Code measure sustained frame time via the overlay's log export.

**Measured in Phase 6 (2026-10-28; desktop Chrome on an Intel Iris Xe at the phone's 892 × 412 viewport — the phone's
own numbers come from James's checklist):** a room with 4 heroes and 4 pets — 40 draw calls, 101k triangles, 59 fps,
3.0 ms CPU per frame; the largest Cellars fight (4 heroes, 4 pets and 6 monsters, the most any of 600 seeded first
fights rolled) — 54 calls, 138k triangles, 59 fps (lowest 56), 4.3 ms; a 30-minute soak (`#autoplay`: 15 delves, 361
rooms, 82 fights) — 57–60 fps throughout, the JS heap 77 → 68 MB (peak 82), geometries 49 → 50, the overlay's GPU
estimate steady. Draw calls stay near a quarter of the budget: a hero is 2 calls (D-101), a room's statics merge and
its props instance (D-110). Models are runtime-cached, not precached: heroes ~6 MB, room kits 1.7 MB, monsters 8.9 MB,
each fetched the first time it is needed.

**Measured in Phase 7 (2026-10-28, the same desktop and viewport):** a Crypts fight 60 fps, 55 draw calls, 128k triangles; a Vault fight 60 fps, 57 calls, 139k; the Barrow Warden, Sister Naesa and the Hollow King in their arenas 60 fps at 54–64 calls and 122–143k triangles. Soaks walking the floors in turn: the Cellars 54–60 fps (12 min), the Crypts 50–60 (12 min), the Drowned Vault 47–60 (8 min) — the CPU stays under 6 ms a frame and nothing grows (geometries ~50, heap 60–95 MB), so the dips are the integrated GPU drawing the Crypts' mist and the Vault's water over the whole screen; Phase 8's performance pass takes them. The phone's own numbers come from James's checklist. A soak that freezes for a minute is the laptop going to standby on its idle timer — hold a keep-awake request while one runs. `node tools/shots/soak.ts --floor N` starts the soak on any floor. **After Phase 8's fix (D-132; the built app, the same desktop):** soaks from the Crypts 56–60 fps and from the Vault 58–60 fps (8 minutes each), the CPU under 5.3 ms a frame, no errors.

**Measured in Phase 8 (2026-10-29, the same desktop and viewport; pass C):** the Phase 7 dips were not the GPU drawing the mist and the water. GPU timer queries over autoplay put a Crypts or Vault frame at 2.1–2.5 ms median and 3–4.5 ms at the 99th percentile on the Iris Xe, before and after this phase alike (the Crypts' mist is 0.3 ms of it, the Vault's water 0.1 ms; both now draw in one pass). The soak's minute samples had caught render calls stalled on shader compiles: three.js frees a program with the last material that used it, so each fight recompiled the programs the fight before had freed — a monster's, its death fade's see-through variant — at 115–387 ms a render; the soak's sample is the half-second around each minute, and one such stall in it reads as 47–56 fps. Now every model compiles in parallel before it replaces its capsule (KHR_parallel_shader_compile; its fade variant too), a room before it shows, the kit's six variants and the hidden HUD meshes when the delve opens, and the stage keeps every program it has compiled (up to 128; `scene/stage.ts` `warm`, `pinPrograms`). A skinned mesh takes its rest bounds (three.js skinned every vertex on the CPU to sort it, 10–55 ms a monster) and each model's assembly runs on a frame of its own (`scene/turns.ts`). Autoplay on the dev server, 150–190 s a run with the boot skipped: before, the Crypts created 6 programs mid-play with renders of 387 and 231 ms (Phase 7's code: 195 and 163 ms) and the Vault 3 with 149 and 115 ms; after, no program was created mid-play in either, the longest render was 75–136 ms and long tasks over 100 ms fell from 2–7 to 0–2 a run. What is left on this desktop is ANGLE's Direct3D path finishing a shader at its first draw (about 60 ms, now and then), garbage collection (20–40 ms) and pauses from outside the page (a 1.8 s gap with no work in it while other soaks ran on the machine). Ten minutes of autoplay from floor 3 through the zones: geometries 41–74 and textures 16–26 rise and fall with the rooms and fights, programs stay at 22, the JS heap 108–168 MB with no upward trend — kits and models are let go. Battery mode renders 29 frames a second against the display's 58. The phone's own numbers come from James's checklist; a soak of the built app (`node tools/shots/soak.ts --floor 4`, `--floor 7`) is the next measurement.

## 5. Multiplayer

*Unity (D-135): the **model** below — a deterministic sim, a host that sequences commands, seed + command log, hashes, late join, host migration — carries over unchanged. The **transports** (Trystero WebRTC and the Cloudflare relay) were chosen for a browser and are re-decided, with James, before co-op is built (Phases 25+).*

**Model (D-014):** the sim is deterministic; one phone is the **host**; clients send *intents*, the host validates against `legalActions`, assigns a sequence number and broadcasts `{seq, command}`; everyone applies commands in order. A match is **seed + command log** → replays, desync detection (state hash every 20 commands), save-and-resume, late join (snapshot + log tail), **host migration** (lowest remaining peer re-hosts from its log; same invite code).

| Phase | Transport | What it needs | Notes |
|---|---|---|---|
| A (Segment 1) | `LocalTransport` | nothing | all heroes on one phone; the replay/hash tooling is also the test harness |
| B (Phase 9) | `WebRtcTransport` via **Trystero** | nothing to host; Google STUN | works on the same Wi-Fi and most home networks; invite code = the room id (6 Crockford-base32 chars, read out loud) |
| C (Phase 9) | `RelayTransport` — Cloudflare Worker + Durable Object | a free Cloudflare account (James; one-time), `wrangler deploy` | the "always works" path for cellular/CGNAT; same code path as B above the Transport |

Pacing rules live in the rulebook §10.2 (grouped decision windows, 20 s timer, AI rule fallback, 90 s reconnect grace, door proposals, loot pick order). Cheating: host-trust is acceptable for friends-only PvE; intents are validated, state hashes compared, loot derives from the seed + log. No accounts, no server state; the relay keeps nothing after the room closes.

## 6. Saves and data

- Profile (the death rule, the roster with the chosen hero and wayfarers, the party, the purse and the bank, the armory, materials, eggs and stabled pets, chest pity and Tome bags, the dead at the Shrine, legacies, the Memorial, the tower's progress, the town's RNG) in IndexedDB under `gloamvault/profile`, three rotating backups (`gloamvault/profile-backup-0..2`), an erase marker; a delve in progress as its options, the party's starting records and the command log (tiny, replayed on reload). Settings live apart under `gloamvault/settings`. The **Hall of Nightmares** (D-095) lives apart too, under `gloamvault/hall` (validated, newest first, at most 50 lines), because an ended Nightmare erases the profile and its backups.
- `SAVE_VERSION` bumped on every schema change with a migration and a fixture test (version 2 at checkpoint 1: the Nightmare death rule, D-095); everything loaded is validated and clamped; never crash on bad data.
- Backup: Settings → *Share save…* / *Download save (.json)* / *Import a save…*; a reminder every ~7 days of play. A hero can be shared by code/QR later (Wildsong's `shareCode` pattern). *As built (Phase 8, pass B):*
  - **The count.** A day of play is a local calendar day on which the town hub is opened, counted by the client's clock (`profile.backup`: `playDays`, `lastPlayDay`, `lastBackupAt`).
  - **The note.** After `tuning.json` → `onboarding.backupReminderPlayDays` (7) such days since the last download or share, the hub shows a gentle note: *Download save*, *Share save* where the phone can share files, and *Not now*.
  - **Share save** sends the same JSON as plain text named `.txt`, because Android Chrome does not share `.json` files; Import reads either.
  - **Starting again.** A download from anywhere (the note, the Inn, Settings), a share, or *Not now* starts the count again.
  - **Never during a delve**, and never for a demo or deep-link session.
- **Wildsong Ranch import** (Segment 3, `14-IDEAS.md`): read a Wildsong share code (its `src/save/shareCode.ts` format) → map LIF/POW/INT/SKI/SPD/DEF onto a pet of grade ≤ A → tag *Ranch-raised*. One-way.

## 7. Build, deploy, verify

**Unity (from Phase 9).** `npm run unity:test` (EditMode tests in batchmode) · `npm run unity:shots` (renders the screen set to `unity/shots/` at the phone's 2,340 × 1,080 — Claude Code reads the PNGs) · `npm run unity:build` (the release-signed APK in `unity/Build/`) · `npm run unity:install` (`adb install -r` and launch on the phone over USB) · `npm run unity:log` (the game's lines from the phone log — the speed overlay writes one a second). Each wrapper prints the errors from Unity's log. `npm run verify` keeps covering the sim, the content and the web version; GitHub Actions keeps deploying the web version; Unity builds run on this PC (a Unity licence on CI would need James's account in a secret — not planned).

- `npm run dev` (http://localhost:5173/gloamvault/; `-- --host` to play on the phone over Wi-Fi), `npm run build`, `npm run preview`.
- `npm run verify` = `typecheck` + `test` (Vitest) + `lint` (content) + `build` + `check:build` (bundle budgets: app code ≤ 600 KB gz and the content data ≤ 300 KB gz on its own line — D-129 — precache ≤ 8 MB, models runtime-cached). **Run before every commit.**
- `npm run balance` (≈ 10–30 s): batch runs over seeds × party compositions × floors → `tools/balance/out/*.json` + `docs/balance/<date>-<tag>.md` with judgement lines (fight length, win rates, gold per delve, wear per delve, Insight rate, ambush rate).
- `npm run shots`: Playwright drives the installed Chrome headless at the S25 Ultra's landscape viewport — 892 × 412 CSS px at device pixel ratio 2.625, i.e. the phone's default FHD+ 2,340 × 1,080 physical pixels (D-052) — through a scripted set of deep links and writes PNGs to `client/shots/` (plus one portrait shot for the rotate hint; `--only a,b` and `--skip-build` for quick re-runs; the run fails on any page error or horizontal scroll) — **Claude Code reads the PNGs before calling any visual change done.**
- `npm run e2e`: Playwright smoke (new hero → first delve → town → chest) on the built app.
- **Deploy**: `.github/workflows/deploy.yml` runs `verify` and publishes `dist/` to GitHub Pages on every push to `main` (Pages source = GitHub Actions). Repo `gloamvault` (public, MIT), Vite `base: '/gloamvault/'`, manifest `id`/`scope`/`start_url` to match.
- **Phone loop**: James installs once; Claude Code ends every phase with a "Try this on your phone" checklist. Optional: Chrome remote debugging (`chrome://inspect` over USB) for console logs.

## 8. Compliance and privacy

- No real money, no ads, no accounts, no analytics. Gold is earned only in the dungeon; chest odds and pity counters are shown anyway (Google Play's loot-box disclosure rule would apply only to purchased randomness; showing odds costs nothing and is the player-friendly default).
- Originality: all names, art, music and text are ours; CC0 samples and the Blender human base meshes (CC0) are logged in `CREDITS.md`. Mixamo clips are allowed as motion reference (commercial use, no redistribution of raw files); generative-3D output only as block-out reference, never shipped (D-019).
- If Google Play ever happens: a TWA/PWA listing or a Capacitor wrap; target API 36+; the odds screen already exists; a privacy policy page in the repo.

## 9. Risks

| Risk | Signal | Mitigation |
|---|---|---|
| WebGL frame time on the phone | overlay > 16.7 ms sustained | lower render scale (0.67 → 0.6), fewer dynamic lights, merge gear meshes at equip time; WebGPU renderer behind a flag; last resort D-002's Godot fallback |
| P2P fails on cellular | Trystero room never connects | the relay transport (Phase 9 ships both) |
| Storage eviction on the phone | lost save | installed PWA + `persist()` + backups + weekly reminder |
| Blender quality bar | renders read badly at 200 px | the style guide and the review loop in `11-ART-PIPELINE.md`; the CC0 base-mesh heads; a commissioned artist pass is the honest ceiling (Ascend's LOG says the same) |
| Content scale (45 skills × 7, 35+ monsters) | linter red, balance report flags | content is data; the runner and the linter are built in Phase 2 before the content lands |
| Session-length autonomy in Claude Code | context runs out mid-phase | `STATUS.md` checkpoints + commits at every milestone; the *Continue* prompt in `PROMPT.md` |

**Open questions**
1. ~~Preact for the HUD (recommended, Wildsong's pattern) or render the HUD in three.js/canvas too?~~ *Checkpoint 1 (D-099): Preact, as recommended and as built in Phase 4.*
2. ~~KTX2/Basis textures from day one (smaller, faster uploads) or PNG until Phase 8?~~ *Checkpoint 1 (D-099): PNG until Phase 8's asset-loading pass (as §4 already says: PNG until the loader is in); sooner only if Phase 6's phone pass shows texture memory or uploads over budget.*
3. ~~Cloudflare relay (free account needed) vs. a $5 VPS with a tiny Node relay — the Worker needs no server maintenance; is the account acceptable?~~ *Checkpoint 1 (D-099): the Cloudflare Worker on the free tier — not a $5 VPS, which costs money; James still creates the free account himself when Phase 9 reaches it (his one-time approval, CLAUDE.md).*

# 10 — Tech Plan

*Last updated 2026-10-27 · rev. 3 (Claude; rev. 2 after Phase 1 built the skeleton: the §3 layout notes on the Vite root, the three TypeScript projects and Node-direct tools, and the §7 screenshot viewport — D-048, D-052; rev. 3 after Phase 2 built the sim: the §3 module map). The engine decision is D-002 in `13-DECISIONS.md`; the research behind it is `docs/research/2026-10-26-tech-engine-android-coop.md` (which recommended Godot + APK under an "APK on GitHub" framing — §1 below says why the web path wins for James specifically).*

## 1. The decision: a web app installed from GitHub Pages

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

- **Vite** (current major) + **TypeScript** `strict` + **Preact 10** + `@preact/signals` for every 2D screen and the in-fight HUD (the pattern Wildsong Ranch uses; Claude Code knows it).
- **three.js** (current release, pinned) for the dungeon, town and character viewer: `GLTFLoader` (+ `KTX2Loader`/Draco optional), `AnimationMixer`, `SkinnedMesh`, custom toon `ShaderMaterial`, inverted-hull outlines, `EffectComposer` only for a cheap bloom on element glows.
- **Sim**: a pure TypeScript package `sim/` — no DOM, no `Math.random`, no `Date.now`, integer math, seeded PCG32/xoshiro RNG, `createDelve / legalActions / step / runAuto / replay / hashState`. Policies for tests and auto-play in `sim/src/policies.ts`. (Project Ascend's `@ascend/sim` is the pattern.)
- **Content**: `content/<kind>/<id>.json` validated by `content/schemas/*.schema.json` with **ajv** (strict) in `npm run lint`; the linter also checks the cross-file rules in `content/README.md`.
- **Saves**: `idb-keyval`, keys prefixed `gloamvault/` (all GitHub Pages sites on an account share one origin), **valibot** validation, versioned migrations, export/import as `.txt`/`.json`, `navigator.storage.persist()` asked once.
- **PWA**: `vite-plugin-pwa` (`registerType: 'prompt'`, update toast only in town), manifest `orientation: "landscape"`, `display: "fullscreen"`, 3D assets runtime-cached (CacheFirst) rather than precached so the install stays small.
- **Audio**: Web Audio; port Wildsong Ranch's `src/audio/engine` (our own sequencer over CC0 samples; original music written for this game) in Phase 8.
- **Networking**: `client/src/net/` with one `Transport` interface and three implementations — `LocalTransport` (loopback), `WebRtcTransport` (**Trystero**: serverless WebRTC signalling over public trackers/Nostr/MQTT; STUN from Google), `RelayTransport` (a **Cloudflare Worker + Durable Object** room relay over WebSockets; free tier; `wrangler deploy` from `tools/relay/`).
- **Tests**: **Vitest** (sim, content, save, formulas), **Playwright** with the installed Chrome (smoke + screenshots), the balance runner (`tools/balance`), Blender render checks (`11-ART-PIPELINE.md`).
- **Tooling on the PC**: Node 24 LTS, npm ≥ 11, Git, GitHub CLI, VS Code + Claude Code, Blender 5.2 (headless only), Google Chrome.

## 3. Architecture

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
    src/audio/    engine (ported), director, music/, recipes/
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
| `timeline.ts`, `statuses.ts`, `effects.ts`, `skills/custom/*`, `fight.ts`, `ai.ts`, `monsters.ts`, `pets.ts`, `hero.ts` | the energy timeline with jitter and charged casts; the 27 statuses; the effect-DSL interpreter and damage pipeline; one hook file per `customId`; the fight loop with commands, auto heroes, rounds, flee, boss phases, summons; the gambit parser; monster, pet and hero actors (`createHero`, `buildHeroActor` through the item module) |
| `items.ts`, `loot.ts`, `chests.ts` | instances and affixes, effective stats through +N and the durability band, wear and care, promotion, salvage, item XP; fight and room loot, dungeon chests; the Curio Merchant's chests with pity and the Tome bag |
| `generator.ts`, `generator-ascii.ts` | the 07 §2.10 grammar, layout, decoration and the floor hash; the `#gen` ASCII map |
| `explore.ts`, `progress.ts`, `policies.ts`, `delve-types.ts`, `delve.ts` | room dressing, encounters, champions, traps, curios, merchants, the hunter's path; XP and wear applied after a fight; the four scripted players; `createDelve / legalDelveActions / stepDelve / runDelveAuto / replayDelve / hashDelve` |

Tools: `tools/sim/run.ts` (`npm run sim`), `tools/balance/run.ts` (`npm run balance` → `tools/balance/out/` + `docs/balance/`), `tools/sim/loadContent.ts` (the fs loader); the Phase 2 fixture content and its assembler live in `sim/test/fixtures/`.

As built in Phase 1 (D-048): one `package.json` at the root (no workspaces); the **Vite root is `client/`** (`client/index.html`, `client/src`, `client/public`; `dist/` at the repo root); `sim/` and `content/` are imported by relative path. **Three TypeScript projects** under one `tsc -b`: `tsconfig.sim.json` compiles `sim/src` with `lib: ["ES2023"]` and no DOM types, so a browser call in the sim is a type error; `tsconfig.client.json` (DOM, Preact JSX); `tsconfig.tools.json` (`tools/**`, `sim/test`, `e2e`, the configs). Tools run on **Node 24 directly** (`node tools/lint/index.ts`; type stripping, so imports carry `.ts` and the code uses only erasable syntax), no `tsx`. The sim's `Tuning` type is derived from `content/tuning.json` itself (`typeof` on a type-only import) so a renamed key fails the typecheck; the sim never reads the file at runtime — the client (`import.meta.glob`) and the tools (`readFileSync`) load content and pass it in.

## 4. Rendering budgets for the Galaxy S25 Ultra (WebGL2 in Chrome)

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

## 5. Multiplayer

**Model (D-014):** the sim is deterministic; one phone is the **host**; clients send *intents*, the host validates against `legalActions`, assigns a sequence number and broadcasts `{seq, command}`; everyone applies commands in order. A match is **seed + command log** → replays, desync detection (state hash every 20 commands), save-and-resume, late join (snapshot + log tail), **host migration** (lowest remaining peer re-hosts from its log; same invite code).

| Phase | Transport | What it needs | Notes |
|---|---|---|---|
| A (Segment 1) | `LocalTransport` | nothing | all heroes on one phone; the replay/hash tooling is also the test harness |
| B (Phase 9) | `WebRtcTransport` via **Trystero** | nothing to host; Google STUN | works on the same Wi-Fi and most home networks; invite code = the room id (6 Crockford-base32 chars, read out loud) |
| C (Phase 9) | `RelayTransport` — Cloudflare Worker + Durable Object | a free Cloudflare account (James; one-time), `wrangler deploy` | the "always works" path for cellular/CGNAT; same code path as B above the Transport |

Pacing rules live in the rulebook §10.2 (grouped decision windows, 20 s timer, AI rule fallback, 90 s reconnect grace, door proposals, loot pick order). Cheating: host-trust is acceptable for friends-only PvE; intents are validated, state hashes compared, loot derives from the seed + log. No accounts, no server state; the relay keeps nothing after the room closes.

## 6. Saves and data

- Profile (banked gold, armory, heroes, pets, settings, unlocked Waystones) in IndexedDB under `gloamvault/profile`; a delve in progress as `seed + command log + content version` (tiny, replayable).
- `SAVE_VERSION` bumped on every schema change with a migration and a fixture test; everything loaded is validated and clamped; never crash on bad data.
- Backup: Settings → *Share save…* / *Download save (.json)* / *Import a save…*; a reminder every ~7 days of play. A hero can be shared by code/QR later (Wildsong's `shareCode` pattern).
- **Wildsong Ranch import** (Segment 3, `14-IDEAS.md`): read a Wildsong share code (its `src/save/shareCode.ts` format) → map LIF/POW/INT/SKI/SPD/DEF onto a pet of grade ≤ A → tag *Ranch-raised*. One-way.

## 7. Build, deploy, verify

- `npm run dev` (http://localhost:5173/gloamvault/; `-- --host` to play on the phone over Wi-Fi), `npm run build`, `npm run preview`.
- `npm run verify` = `typecheck` + `test` (Vitest) + `lint` (content) + `build` + `check:build` (bundle budgets: app JS ≤ 600 KB gz, precache ≤ 8 MB, models runtime-cached). **Run before every commit.**
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
1. Preact for the HUD (recommended, Wildsong's pattern) or render the HUD in three.js/canvas too?
2. KTX2/Basis textures from day one (smaller, faster uploads) or PNG until Phase 8?
3. Cloudflare relay (free account needed) vs. a $5 VPS with a tiny Node relay — the Worker needs no server maintenance; is the account acceptable?

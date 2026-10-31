# Gloamvault (Dungeon Crawler) — orientation for Claude Code

A 1–4 player co-op party dungeon crawler for Android phones (James's Galaxy S25 Edge; S25-class or better): 3D characters from Blender on a shared rig, a deterministic speed-timeline combat sim, everything levels by use, gear from F to God that wears and is upgraded with materials, dungeon gold → chests → gear and pets. Segments 1–2 built it as an installable web app (PWA) on GitHub Pages (v0.8.0, still live, frozen); **from Phase 9 it is being rebuilt as a Unity app for Android** (D-135), installed on James's phone over USB, with free-roam exploration — a joystick, much larger floors, random encounters, press A to interact (D-136) — in small phases with a stop after each (D-137). James designs and directs; Claude researches, designs and builds. **This file is read automatically by Claude Code when the folder is open in VS Code. Read it first, then `README.md` → *Where we are*, then `STATUS.md`.**

## The owner

- James is **not a programmer**. Explain in plain words, give exact click-by-click steps when he must do something, and never ask him to edit code or open Blender's UI.
- He tests on his phone after every phase. End every phase with a short **"Try this on your phone"** checklist (2–3 items) and **stop** until he says go (D-137); write a review file in `docs/feedback/` (template there) at Phases 14, 20 and 25.
- He has delegated the design choices ("make all of the choices for me; I trust your decisions"). Decide, build, log — and collect his feedback at each phase's stop.
- Ask before anything that **costs money, publishes something new outside this repo, or deletes his data**. Those, plus his one-time steps (the Unity Hub sign-in, USB debugging on the phone, backing up the signing key), are the only reasons to stop inside a phase.

## How this folder works (the rules that matter most)

1. **The docs are the source of truth.** `docs/03-GAME-DESIGN.md` is the rulebook and its **ownership table** (top of the file) says which doc wins when two disagree — fix the non-owner; `04`–`09` are the content; `10`–`11` the tech and art plans; `12-ROADMAP.md` the phases; `13-DECISIONS.md` the log. Anything decided is written into the owning doc **in the same turn** — a decision into `13` with a date, a status (Proposed / Accepted / Superseded) and a reason; design into the section that owns it. Never leave a decision only in chat.
2. **When the docs are silent or ambiguous, choose** the reading closest to the pillars (`01-VISION.md`) and the nearest explicit rule, implement it, and log it in `13` as **Proposed** with the quote and the reason — never stop to ask inside a phase, never silently invent, never change an **Accepted** decision (supersede it at a checkpoint with James's yes).
3. **Numbers are tuning starting points**, never commitments. Every number lives in `content/tuning.json` or the content JSON, not in code. Tune numbers freely when the balance runner says so; change a *formula* only with a logged decision.
4. Every design section ends with **Open questions**. Keep the lists complete; when James answers one, strike it through and log the answer.
5. **Content is data** (D-020): JSON under `content/` validated by `content/schemas/` with ajv (strict) and the cross-file rules in `content/README.md`. `npm run lint` must be green before any commit that touches content.
6. **Small phases, a stop after each** (`12-ROADMAP.md` §3, D-137). Work a phase autonomously; keep `STATUS.md` current (how to run · done · in progress · next · decisions logged · open for James); commit at every milestone as `P<n>: <summary>` and push `main` (the web site redeploys; it is frozen at v0.8.0). If a session ends mid-phase, the next one resumes from `STATUS.md`.
7. **Look at what you made.** A client change is not done until `npm run unity:shots` (Unity) or `npm run shots` (web) has produced PNGs and you have read them, and a Unity phase is not done until it runs on the phone and you have read its log (`npm run unity:log`); a Blender build is not done until its renders (card view, 200-px read, turntable, gear sheet, pose sheet, re-import check) have been looked at and the defects logged in `art/LOG.md`.
8. **Originality.** No names, characters, monsters, art, sprites, music, UI text or data from existing games or franchises (generic fantasy words — orc, elf, skeleton, ghoul — are fine). Art is built in Blender by our scripts from CC0 bases or generated in code; samples are CC0; everything external is logged in `CREDITS.md`. Generative-3D output is reference only, never shipped (D-019).

## Tech stack (keep it; ask before adding a dependency — `docs/10-TECH-PLAN.md`)

- **Unity (from Phase 9; `10` §2.1, D-140):** Unity **6.3 LTS** (6000.3.27f1) in `unity/`, **URP** (mobile), **UI Toolkit** (UXML/USS) for screens and the HUD, **Input System** (on-screen stick, A button), Unity Test Framework; Android **IL2CPP ARM64, Vulkan + GLES3, landscape, target API 36**, package `com.gloamvault.game`, one release key in `Documents\Gloamvault\keys\` (never in the repo). The sim stays TypeScript and runs in Unity through **Jint** behind `sim/src/bridge.ts` (D-139, Phase 10 decides). Models come as FBX from the Blender scripts; sound as audio files rendered from the web engine.
- **Web (Segments 1–2, frozen at v0.8.0):** - **Vite + TypeScript (strict) + Preact 10 + @preact/signals** for screens and the HUD; **three.js** (pinned current release) for the 3D scene; **vite-plugin-pwa** (`registerType: 'prompt'`, landscape manifest); **idb-keyval** + **valibot** for saves; **ajv** for the content linter; **Vitest**; **Playwright** with the installed Chrome; **Trystero** (WebRTC) and a Cloudflare Worker relay in Phase 9; Web Audio engine ported from Wildsong Ranch in Phase 8.
- **Deterministic, pure sim.** `sim/` has no DOM, no `Math.random`, no `Date.now`, integer math, a seeded RNG whose state is in the save. `createDelve / legalActions / step / runAuto / replay / hashState`; scripted players in `sim/src/policies.ts`. The client reads sim state and sends commands; the sim never imports the client.
- **Saves are sacred.** Any schema change bumps `SAVE_VERSION` and adds a migration plus a fixture test. Validate and clamp everything loaded; never crash on bad data. Web storage keys are prefixed `gloamvault/` (all GitHub Pages sites on the account share one origin). In Unity, never install a build signed with a different key (Android would make James uninstall, which erases the save).
- **Phone first, landscape.** 60 fps sustained on James's S25 Edge within the budgets in `10` §4; tap targets ≥ 44 px; every animation skippable; the performance overlay is a Settings toggle; works installed and offline.
- Node 24 LTS or newer; npm ≥ 11 (so the lockfile works on GitHub's Linux runners).

## Tools on this machine (Windows)

- **Blender 5.2** is installed; drive it **headless only**: `& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b -P script.py -- args` (check `blender --version` first; pin scripts to the API; slotted actions — the legacy action API is gone in 5.x). Scripts live in `tools/blender/`; outputs under `art/` and `client/public/models/`. Prefer **re-runnable builds** over hand edits: a character or monster is a `build_*.py` that regenerates the whole `.blend`, so changes are a re-run. Render PNGs and read them before calling anything done. Ascend's `prototype/blender/shade/` (`../ProjectAscend`) is the ancestor of these scripts; port `shade_lib.py`, `render.py`, `export.py` and its LOG's lessons.
- **Unity** (D-135): Unity Hub 3.22 is an MSIX app — its command line is `"C:\Program Files\WindowsApps\UnityTechnologies.UnityHub_<version>_x64__2vrhnee42bhxm\app\Unity Hub.exe" -- --headless <command>` and **must run with `ELECTRON_RUN_AS_NODE` unset** (VS Code sets it; with it the Hub runs as plain Node) — from Bash: `env -u ELECTRON_RUN_AS_NODE "$HUB" -- --headless editors -i`. Editors install to `C:\Users\jjones1\Unity\Hub\Editor\<version>\Editor\Unity.exe`; drive the editor in **batchmode only** through `tools/unity/` (`npm run unity:*`). Batchmode cannot open a project the editor has open. The licence is James's free Personal one (he signed in to the Hub once); if a build says the licence is missing, ask him to open Unity Hub once.
- **adb** (Android platform-tools) is at `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`; James's phone is reached over USB (`adb devices`). `npm run unity:install` installs and launches; `npm run unity:log` reads the game's lines; `adb shell dumpsys battery` gives the temperature.
- **Google Chrome** is installed; Playwright drives it for `npm run shots` and `npm run e2e` (kill a leftover preview on port 4173 first).
- No Python on PATH outside Blender; scripted edits are Node (`node script.mjs`) or PowerShell.
- `gh` (GitHub CLI) for the repo and Actions status (`gh run list`).

## Commands

- **Unity:** `npm run unity:bundle` (the sim, the content and the golden cases → `unity/Assets/Gloamvault/Resources/Sim/`, generated; run by the three below) · `npm run unity:test` (EditMode + PlayMode tests; `-- -EditOnly`) · `npm run unity:shots` (→ `unity/shots/`, read them) · `npm run unity:build` (release APK → `unity/Build/`) · `npm run unity:install` (adb install + launch on the phone) · `npm run unity:log` (the game's phone log lines) · `npm run unity:rules` (the Rules check on the phone: the golden delves through Jint, hashes against Node, step times) · `tools/unity/screencap.ps1 -Room <templateId>` (a phone screenshot of that room with the overlay's last line). The Blender kit builds (`tools/blender/env/build_kit_*.py -- --no-renders`) write the Unity FBX files into `unity/Assets/Gloamvault/Resources/Env/` (git-ignored) as they export the GLBs · `npm run unity:models` (the heroes' and monsters' shipped GLBs converted to FBX under `Resources/Hero|Monsters/`, git-ignored; a fresh clone runs it once).
- `npm run dev` — http://localhost:5173/gloamvault/ (add `-- --host` to play on the phone over Wi-Fi; service workers need https or localhost).
- `npm test` · `npm run typecheck` · `npm run lint` (content) · `npm run build` · `npm run preview`
- `npm run verify` = typecheck + test + lint + build + check:build (bundle and precache budgets). **Run before every commit.**
- `npm run balance` — the batch runner → `tools/balance/out/` and `docs/balance/<date>-<tag>.md`. Run after any stage, kit, monster or tuning change and read the judgement lines.
- `npm run shots` — Playwright screenshots of the deep-link set → `client/shots/`. `npm run e2e` — the smoke suite on the built app.
- `npm run sim -- --delve gravehollow --zone 1 --seed 17 --party warden,mender --auto` — one delve in the terminal (created in Phase 2).
- Deep links the client honours (created in Phase 4; the list is `docs/07-DUNGEONS.md` §8 plus these): `#delve=gravehollow&zone=1&seed=17&party=warden,mender&auto=1`, `#viewer=dwarf,warden,S`, `#town`, `#autoplay=1&minutes=30`.

## Map

| Where | What |
|---|---|
| `README.md` | pitch, folder map, **Where we are**, open questions for James, glossary |
| `PROMPT.md` | the prompts James pastes: Next phase, Continue, Feedback, and follow-ups (the segment prompts are history) |
| `STATUS.md` | the checkpoint (keep it current) |
| `docs/01-VISION.md` | pillars, audience, tone, names, art direction summary |
| `docs/02-RESEARCH.md`, `docs/research/` | the digest and the three full reports |
| `docs/03-GAME-DESIGN.md` | **the rulebook**: loop, stats, timeline combat, exploration, level-by-use, equipment/grades/durability/materials, skills, economy/chests, pets, co-op, dungeons rules, death, first 30 minutes |
| `docs/04-CLASSES.md`, `docs/classes/*.md` | the seven classes, 45 skills each |
| `docs/05-SPECIES.md` | the six species, traits, Blender briefs |
| `docs/06-MONSTERS.md` | families, elite affixes, Gravehollow's 35 monsters + hunters + bosses, Dungeons 2–4 outlined, 16 pets |
| `docs/07-DUNGEONS.md` | overworld, Gravehollow floor by floor, kits, templates, curios, traps, arenas, the generator grammar, Dungeons 2–4, presets and Pacts, contracts |
| `docs/08-ITEMS.md` | weapons, armor, trinkets, relics, consumables, affixes, sets, uniques, God items, materials, durability reference, chest odds, loot tables, starter kits |
| `docs/09-SKILLS.md` | skill rules index, field skills, learning paths |
| `docs/10-TECH-PLAN.md` | the Unity decision (§1) and the web app before it, stack, architecture, budgets, multiplayer, saves, build/verify, compliance, risks |
| `docs/11-ART-PIPELINE.md` | style guide, rig, bodies, gear, animation, monsters, environments, VFX, scripts, the review loop, acceptance bar |
| `docs/12-ROADMAP.md` | Segments 1–2 (Phases 1–8) and the Unity rebuild in small phases (9–24, then 25+), done-when criteria |
| `docs/13-DECISIONS.md` | the decision log and the consolidated open questions |
| `docs/14-IDEAS.md` | backlog incl. the Wildsong Ranch crossover |
| `docs/feedback/` | the segment review template and the written reviews |
| `docs/balance/` | dated balance reports (from Phase 2) |
| `content/` | schemas, examples, README (linter rules); the game's JSON from Phase 3 |
| `sim/`, `client/`, `tools/`, `art/` | created in Phase 1–2 per `10` §3 (`client/` is the web version) |
| `unity/`, `tools/unity/` | the Unity project and its batchmode wrappers (from Phase 9) |

## Workflow per phase

1. **Start**: plan mode; re-read the phase in `12-ROADMAP.md` and every doc section it touches; write the detailed task list under the phase in `STATUS.md`.
2. **Build** in small steps with tests. Use subagents for broad searches, reviews and parallel content conversion to keep context lean. Keep `STATUS.md` current as you go.
3. `npm run verify` (and `npm run lint`, `npm run balance`, `npm run shots` as relevant) until green; update the docs the phase changed (rev. lines, open questions, `13`).
4. **Commit** `P<n>: <summary>`, push `main`, confirm the deploy (`gh run list`).
5. Install the build on the phone and read its log; write the phase's "Try this on your phone" checklist into `STATUS.md` (at Phases 14, 20 and 25 also a review file in `docs/feedback/`) and **stop** until James says go.
6. **Design changes** inside a phase: log as Proposed (rule 2). At a stop, James's answers become Accepted/Superseded and the docs are updated before the next phase starts.

## Gotchas

- Vite `base` must be `'/gloamvault/'` and match the repo name; the PWA manifest `id`, `scope`, `start_url` too. Never use path routing (hash only). Build asset URLs from `import.meta.env.BASE_URL`.
- Landscape: set `orientation: "landscape"` in the manifest and request `screen.orientation.lock('landscape')` after the first tap inside fullscreen; handle rotation gracefully in the browser tab.
- Android Chrome: audio starts on a user gesture; `navigator.vibrate` works; ask `navigator.storage.persist()` once; show our own install card if `beforeinstallprompt` is unavailable.
- Three.js on the phone: cap pixel ratio (`10` §4); dispose geometries/textures on room transitions; one `AnimationMixer` per character; merge static kit meshes per room; `InstancedMesh` for props.
- Unity: never commit `Library/`, `Temp/`, `Logs/`, `obj/`, `Build/`, `UserSettings/`; keep `.meta` files; scenes and settings as text (Force Text). Batchmode runs take minutes — batch changes before a build. The phone's default resolution is FHD+ 2,340 × 1,080 (D-052). A Unity folder without `ProjectSettings/` is opened as a *new* project and gets Unity's default packages (purchasing, analytics, …) written into `Packages/manifest.json` — keep `ProjectSettings/` committed and the manifest lean. A PlayMode test assembly must not be Editor-only (Editor-only = EditMode); load scenes by name from the build list. Set enum settings through `SerializedProperty.intValue` (the value), not `enumValueIndex`. The Hub's headless `install` does not exit when it finishes — check `modules.json` and the editor folder. Unity's FBX import **mirrors x** (right- to left-handed): `KitLibrary` measures it from a lopsided piece; never hard-code the mapping. A shader used only from code must live under `Resources/` or the build strips it. `Material.SetVectorArray` gets no sRGB→linear conversion — convert palette colours with `.linear`. A UXML's `<Style>` rides on the container `Instantiate` returns; keep the container in the tree. Imported meshes are not CPU-readable on the phone — take triangle counts from the manifests. Unity keeps no FBX custom properties at runtime — `env.ts` carries the GLB node extras into the JSON. Never derive a world size from `_ScreenParams` in a shader (the render-to-texture path lies); an inverted-hull width goes by depth, capped. A second directional light as an additional light scrambles the body shader (D-160, open) — one key light on a stage. Blend-shape names may carry a mesh prefix: match by suffix.
- PowerShell wrappers (`tools/unity/`, Windows PowerShell 5.1): keep `.ps1` files **ASCII-only** (5.1 reads BOM-less files as ANSI, and an em-dash breaks the parse), and quote arguments yourself for `Start-Process` (it joins them unquoted; the repo path has a space).
- Windows: `.gitattributes` with `eol=lf`; npm ≥ 11 when regenerating `package-lock.json`; PowerShell for Blender wrappers.
- Updates: never auto-reload mid-fight; the update toast only in town.
- When compacting context, keep: the current phase and its task list, changed files, failing tests, Proposed decisions not yet logged, and the open questions for James.

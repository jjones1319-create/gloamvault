# STATUS — Gloamvault checkpoint

*Claude Code keeps this file current while it works (CLAUDE.md rule 6). A fresh chat resumes from here.*

## How to run

- `npm install` once (Node 24+, npm 11+), then `npm run dev` → http://localhost:5173/gloamvault/ (add `-- --host` to open it on the phone over Wi-Fi).
- `npm run verify` before every commit (typecheck · test · lint · build · check:build). `npm run shots` writes the screenshot set to `client/shots/` (read the PNGs). `npm run e2e` runs the Playwright smoke on the built app. `npm run icons` re-renders the PWA icons from `client/public/logo.svg`.
- Live link: **https://jjones1319-create.github.io/gloamvault/** (deployed by GitHub Actions on every push to `main`; `gh run list` shows the status).

## Where we are

- **Segment:** 1 (Phases 1–4) — **in progress**, started 2026-10-26.
- **Phase:** 1 — Repo, skeleton, the link on the phone — **built, verifying and publishing** (this file is updated with the commit once pushed).
- **Last commit:** pending (`P1: repo, skeleton, PWA shell, linter, tuning, statuses`).
- **Tools checked 2026-10-26:** Node 24.18.0 ✓ · npm 11.16.0 ✓ · git 2.51 ✓ · gh 2.102 signed in as `jjones1319-create` ✓ · Blender 5.2.2 LTS ✓ (needed from Segment 2) · Google Chrome ✓.

## Phase 1 task list

1. [x] `package.json` (name `gloamvault`, 0.1.0, MIT), pinned stack: Vite 8 · TypeScript 6 (strict) · Preact 10 + @preact/signals · three.js 0.186 · vite-plugin-pwa 2 · idb-keyval · valibot · ajv 8 · Vitest 5 · Playwright 1.64 (installed Chrome). `LICENSE` (MIT).
2. [x] Layout per `10` §3 (as built, D-048): `sim/` (its own tsconfig, **no DOM lib**) · `client/` (Vite root) · `tools/lint`, `tools/build`, `tools/shots`, `tools/icons` · `.github/workflows/deploy.yml` (runs `npm run verify`, deploys `dist/`).
3. [x] `tools/lint`: ajv 2020-12 strict over the 18 schemas, every content file and example, then the cross-file rules of `content/README.md` (completeness rules gated per kind, D-049) with Vitest tests on deliberately broken variants.
4. [x] `content/tuning.json` (every number of `03` §2–§12, by section, with sources) + `tuning.schema.json` + example; `content/statuses/` (the 27 rows of `03` §3.5).
5. [x] Client shell (D-053): hash router with tests · title screen (version chip, live three.js torch-lit hall, menu) · Settings (performance overlay, Smooth 60 / Battery 30, text size, reduce motion, haptics, full screen, install, check for updates, reset) · the "Try this on your phone" card · install card · update toast (quiet screens only) · rotate hint · settings saved under `gloamvault/settings` with field-by-field validation.
6. [x] PWA: landscape + fullscreen manifest with `id`/`scope`/`start_url` = `/gloamvault/`, `registerType: 'prompt'`, models runtime-cached, icons rendered from the SVG logo (D-054).
7. [x] `check:build` (app JS 148 KB gz of 600; precache 0.8 MB of 8; manifest checks) · `npm run shots` (7 PNGs at the S25 Ultra viewport, D-052) — looked at; four layout defects found and fixed (tagline hidden by the install card, deep-link chip pushing the version off-screen, wordmark overflow in portrait, square dust motes) · `npm run e2e` smoke passes.
8. [x] Docs: `10` rev. 2 (§3 as-built, §7 viewport), `13` §E D-048–D-055, `README.md` link, this file. `content/README.md` lint notes.
9. [ ] `npm run verify` green → `git init` → first commit → `gh repo create gloamvault --public` → push `main` → Pages (Actions) → `gh run watch` → open the link.
10. [ ] Phone checklist below confirmed live; install steps given to James; on to Phase 2.

## Done

- 2026-10-26 — The design package: research (`docs/research/`), the rulebook (`03`), classes (`04`, `docs/classes/`), species (`05`), monsters (`06`), dungeons (`07`), items (`08`), skills index (`09`), tech plan (`10`), art pipeline (`11`), roadmap (`12`), decision log (`13`), ideas (`14`), the seventeen content schemas with validated examples (`content/`), `CLAUDE.md`, `README.md`, `PROMPT.md`, this file.
- 2026-10-26 — Phase 1 build (see the task list): the installable title screen, the toolchain (verify · lint · shots · e2e · icons), tuning and statuses as content.

## In progress

- Phase 1, tasks 9–10: verify, publish, confirm the deploy.

## Next

- **Phase 2 — the rulebook as code** (`12` §1): plan mode → task list here → `sim/` (rng, stats, timeline, combat, statuses, effect DSL, items, loot, exploration, pets, party, XP, Insight, field skills; `legalActions/step/runAuto/replay/hashState`; `policies.ts`) with tests on every formula and the rulebook's reference tables; `tools/balance` and the first balance report on a fixture content set; `npm run sim`. Create `sim/src/skills/custom/<id>.ts` for every hook named in D-050 (the linter's rule 31 switches on when the folder exists).

## Decisions logged this phase

- D-048 repo shape (Vite root `client/`, three TS projects, DOM-less sim, Node-direct tools) · D-049 Phase 1 content (statuses, tuning + schema; gated completeness rules; rule 31) · D-050 effect-DSL sign convention and the status hook names · D-051 item level curve 40 × 1.3^(N−1) · D-052 screenshot viewport · D-053 the Phase 1 client shell · D-054 icons via Playwright · D-055 tuning.json carries the rulebook's proposed readings. All **Proposed**, in `docs/13-DECISIONS.md` §E.

## Open for James (collected for the segment review)

- The consolidated list is `docs/13-DECISIONS.md` §D; D-048–D-055 above are added to it at the review.
- Preact 11 and TypeScript 7 are out; the build pins Preact 10 / TypeScript 6 (what `10` §2 and Wildsong Ranch use). Upgrade is a later, separate decision.

## Phone checklist (current phase)

Open **https://jjones1319-create.github.io/gloamvault/** in Chrome on the S25 Ultra.

1. The title screen shows **v0.1.0 · Phase 1**, two torches flicker on stone pillars, embers drift. Turn the phone upright: an orange "Turn your phone sideways" bar appears; turn it back.
2. Tap **⋮ → Add to Home screen → Install**. Open Gloamvault from the new icon: it is full-screen, sideways, and the version line now says **installed**.
3. **Settings → Performance overlay** on. Back on the title you should read about **60 fps** (the installed app may say 120 Hz panel but the game caps at 60).
4. Switch **Frame rate** to **Battery 30**: the fps number drops to about 30. Switch back to Smooth 60.
5. **Text size → Large**: everything grows, nothing is cut off. Set it back.
6. **Try this on your phone** opens the card with these same steps.
7. Turn Wi-Fi and mobile data off, close the app and reopen it from the icon: it still opens (offline).
8. Turn data back on. When a later phase ships, the title shows **Update ready → Restart**.

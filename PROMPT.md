# How to build Gloamvault with Claude Code

This folder already contains everything Claude needs: the rulebook (`docs/03-GAME-DESIGN.md`), the content (`docs/04`–`09`), the tech and art plans (`docs/10`–`11`), the build order (`docs/12-ROADMAP.md`), the decision log (`docs/13-DECISIONS.md`) and Claude's standing instructions (`CLAUDE.md`, which Claude Code reads automatically). Your job: paste a prompt, play on your phone when asked, answer the questions at the end of each segment, and repeat.

**Since checkpoint 2 (2026-10-29) the game is being rebuilt in Unity in small phases** (`docs/12-ROADMAP.md` §3). Claude builds one phase, installs it on your phone over the USB cable, gives you a 2–3 item checklist in `STATUS.md` — and **stops** until you paste the **Next phase prompt**. At Phases 14, 19 and 24 it also writes a review file in `docs/feedback/` with its questions. (Segments 1 and 2 ran as four phases at a time; their prompts are kept below as history.)

**Before your first run:** you already did this for Wildsong Ranch — Node.js (24+), Git, the GitHub CLI signed in (`gh auth login`), VS Code with Claude Code, Google Chrome, Blender 5.2. If anything is missing, `..\Monster Rancher\docs\PHONE_AND_GITHUB_SETUP.md` Part A has the plain-English steps, or just tell Claude Code "help me install [thing]".

**Steps**
1. Open VS Code → **File → Open Folder…** → pick this folder (`Dungeon Crawler`).
2. Open Claude Code (the Claude icon in the sidebar, or Command Palette → "Claude Code").
3. Paste the **Segment 1 prompt** below and press Enter. Approve its commands (allow `npm`, `git`, `gh`, `node`, `blender` in this folder).
4. When it says a phase is done, open the link on your phone and follow the checklist in `STATUS.md`. Keep going — it continues into the next phase on its own.
5. When it says **Segment 1 is complete**, read `docs/feedback/SEGMENT-1-REVIEW.md`, play, then paste the **Feedback prompt** with your answers. After Claude has logged them, paste the **Segment 2 prompt**.
6. If a chat ever ends, gets stuck, or you want a fresh one (recommended at the start of each phase: type `/clear`), paste the **Continue prompt**.

---

## Next phase prompt (paste after each phase, once you have tried it on your phone)

```
Next phase. My phone check: [what worked / what didn't — "all good" is fine]. Re-read CLAUDE.md, STATUS.md and the next phase in docs/12-ROADMAP.md §3; log anything I said in docs/13-DECISIONS.md and the docs first. Plan the phase, build it, run the checks, install it on my phone over USB (it is plugged in), read its log, commit and push, write the phone checklist in STATUS.md, and stop.
```

## Segment 1 prompt (history — Segment 1 is done)

```
You're building Gloamvault, an original co-op dungeon-crawler game I want to play on my Galaxy S25 Ultra with friends. Everything you need is in this folder: CLAUDE.md (your standing rules), README.md (the map and where we are), docs/03-GAME-DESIGN.md (the rulebook), docs/04–09 (classes, species, monsters, dungeons, items, skills), docs/10-TECH-PLAN.md, docs/11-ART-PIPELINE.md, docs/12-ROADMAP.md (the phases), docs/13-DECISIONS.md and content/ (the schemas). I'm not a programmer, so explain things simply and tell me exactly what to click whenever you need me.

I have delegated the design decisions to you: make the calls, log each one in docs/13-DECISIONS.md as Proposed with the reason, and collect my feedback at the end of the segment — do not stop to ask me questions mid-segment. The only reasons to stop and wait for me are: something that costs money, publishing outside this repo, deleting my data, or a one-time approval you literally cannot do without me (like the first GitHub push if it needs my sign-in).

Do this:
1. Read CLAUDE.md, README.md, STATUS.md, docs/12-ROADMAP.md in full, then docs/03-GAME-DESIGN.md in full, then skim docs/01, 02, 04–11, 13, 14 and content/README.md so you know where everything is. Note the research in docs/research/ exists; read it only when a design question re-opens.
2. Check my tools: node -v (24+), npm -v (11+), git --version, gh --version and gh auth status, "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --version, and that Google Chrome is installed. If something is missing, give me step-by-step Windows instructions and wait (tool setup is the one allowed stop before the build starts; Blender is only needed from Segment 2, so don't stop for it now — just note it in STATUS.md).
3. Use these choices unless something blocks them: game title "Gloamvault", a PUBLIC GitHub repo named gloamvault, MIT license, GitHub Pages deployed by GitHub Actions. Find my GitHub username yourself (gh api user); if you truly can't, that is a one-time approval — ask me once.
4. Run SEGMENT 1 = Phases 1, 2, 3 and 4 exactly as docs/12-ROADMAP.md describes, in order. For each phase: plan mode first and write the task list into STATUS.md; build in small steps with tests; npm run verify (and lint / balance / shots where the phase says) until green; update the docs you changed and the decision log; commit "P<n>: <summary>" and push main; confirm the deploy; put a short "Try this on your phone" checklist in STATUS.md; continue to the next phase. Keep STATUS.md current the whole time so a fresh chat can resume from it.
5. When Phase 1 is live, give me the link and the steps to install it on my phone (Chrome → Install app), then keep going — don't wait for me.
6. After Phase 4, write docs/feedback/SEGMENT-1-REVIEW.md from the template in docs/feedback/: what was built, screenshots, a 10–15 minute phone checklist, every Proposed decision you logged (grouped, with your recommendation), and the design questions the docs flag for me (docs/13-DECISIONS.md §D). Then tell me "Segment 1 is complete" and stop.

For the whole project follow CLAUDE.md — especially: the docs are the source of truth, decide-and-log instead of asking, numbers are tuning starting points that live in content, look at your screenshots and renders before calling anything done, originality, phone-first landscape, and the deterministic pure sim.
```

## Segment 2 prompt (history — Segment 2 is done)

```
Let's run SEGMENT 2 = Phases 5, 6, 7 and 8 of docs/12-ROADMAP.md. First re-read CLAUDE.md, STATUS.md, docs/12-ROADMAP.md and docs/feedback/SEGMENT-1-REVIEW.md with my answers, and make sure every answer is logged in docs/13-DECISIONS.md (Accepted / Superseded) and reflected in the docs before you start. Then work the four phases the same way as Segment 1: plan mode and a task list in STATUS.md per phase, small steps with tests, verify/lint/balance/shots green, docs and decisions updated, commit "P<n>: …" and push, a phone checklist per phase, no mid-segment questions except the money/publish/delete/one-time-approval cases. Phase 5 and 6 are Blender work: drive Blender headless from tools/blender, render the review set every round, look at the renders, and log each round in art/LOG.md. After Phase 8, write docs/feedback/SEGMENT-2-REVIEW.md (template in docs/feedback/) and stop.
```

## Segment 3 prompt (history — replaced at checkpoint 2 by the Next phase prompt, D-137)

```
Let's run SEGMENT 3 = Phases 9, 10, 11 and 12 of docs/12-ROADMAP.md. Re-read CLAUDE.md, STATUS.md, docs/12-ROADMAP.md and docs/feedback/SEGMENT-2-REVIEW.md with my answers; log every answer in docs/13-DECISIONS.md and update the docs first. Phase 9 is co-op: when you reach the relay, tell me exactly how to create the free Cloudflare account and what to paste back to you, then continue. For the Wildsong Ranch import in Phase 11, the other game's code is in ..\Monster Rancher (read its src/save/shareCode.ts and docs/GAME_DESIGN.md §4–5 for the monster format) and the mapping is in docs/14-IDEAS.md §A. Same working rules as before. After Phase 12, tag v1.0.0, write docs/feedback/SEGMENT-3-REVIEW.md with the launch checklist and the post-launch backlog, and stop.
```

## Continue prompt (paste in a fresh chat whenever a session ended or you typed /clear)

```
Continue building Gloamvault. Read CLAUDE.md, then STATUS.md (where you were), then the current phase in docs/12-ROADMAP.md and the doc sections it touches. Pick up exactly where STATUS.md says, finish the phase (verify green, docs and decision log updated, commit and push, phone checklist in STATUS.md), and stop at the end of that phase (D-137). Stop earlier only for the money/publish/delete/one-time-step cases.
```

## Feedback prompt (paste with your answers after playing)

```
Here is my feedback on docs/feedback/SEGMENT-<n>-REVIEW.md:
- Phone checklist: [what worked / what didn't, with your phone and whether it was installed or in a Chrome tab]
- Answers to your questions: [Q1: … Q2: … — "you decide" is a fine answer]
- Things that felt wrong: [e.g. "fights are too long", "I never notice speed", "repair feels like a chore"]
- Names/looks: [keep / change to …]
Please log every answer in docs/13-DECISIONS.md and the docs (Accepted / Superseded), fix what I flagged (tuning numbers first, formulas only with a logged decision), run verify, push, and tell me when it's done so I can paste the next segment prompt.
```

---

## Handy follow-up prompts

**Something's broken:**
```
Bug: [what you did] → [what happened] → [what you expected]. Phone: Galaxy S25 Ultra, Chrome, [installed / tab]. Find the cause, add a test that reproduces it, fix it, run verify, push, and tell me what to check.
```

**It doesn't feel right:**
```
Feedback from playing: [e.g. "my Warden never gets a turn" / "the Cellars boss is a wall" / "chests feel stingy"]. Suggest 2–3 fixes (tuning numbers first, not formula changes), say which you recommend and why, then do it after I pick. Run the balance runner before and after and show me the judgement lines.
```

**Add a monster / item / skill:**
```
Add a new [monster/item/skill]: [idea, e.g. "a Crypts special that steals the party's torch"]. Design it to fit the family's roles, the band's numbers and the rulebook (docs/06/08/09), show me the entry first, then add it to the docs and content with lint and balance green.
```

**Change the design:**
```
I want to change a rule: [what]. Find the Accepted decision it touches in docs/13-DECISIONS.md, propose the supersession with the consequences (sim, content, UI), and after I say yes update the docs, the code and the tests together.
```

**Rename the game:**
```
Rename the game from "Gloamvault" to "[new name]" everywhere (title, manifest, README, CREDITS, docs). Keep the repo name and URL unless I say otherwise.
```

**Check balance:**
```
Run the balance runner for [Gravehollow / all dungeons] with party sizes 1–4 and give me a plain-English summary: fight lengths, which classes and species are too strong or weak, gold per delve vs repair cost, Insight rate, ambush rate, delves-to-broken. Suggest tuning changes but don't apply them until I say so.
```

**Play with a friend:**
```
Walk me and a friend through playing together: how I create a party at the Lantern Inn, what code to send, what my friend taps, and what to do if it doesn't connect (the relay fallback).
```

**Bring a Wildsong Ranch monster over (after Phase 11):**
```
Walk me through exporting a monster's share code from Wildsong Ranch and importing it at the Ranch Shrine in Gloamvault, and tell me what grade and trait it will arrive with.
```

**I'm worried about my save:**
```
Walk me through backing up my save on my phone and restoring it on another device, step by step.
```

## Tips

- **One phase per chat** keeps Claude sharp: at the start of each phase type `/clear` and paste the Continue prompt. Long chats can also be trimmed with `/compact`.
- Claude Code asks permission before running commands. Read the one-line description; "allow" is fine for `npm`, `git`, `gh`, `node` and `blender` in this folder. If it asks to install something new, it should have told you why.
- Everything is saved to GitHub at every phase. If something goes badly wrong, Claude can roll back to the last phase's commit.
- The first time a phase ends, open the game **from the installed icon**, not a Chrome tab: the installed app keeps its own saves and gets "Update ready → Restart" when Claude pushes.

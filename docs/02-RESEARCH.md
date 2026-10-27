# 02 — Research (synthesis)

*Last updated 2026-10-26 · rev. 1. Three full reports with sources live in `docs/research/`; this file is the digest and the map from findings to decisions (`13-DECISIONS.md`). Read the reports when a design question re-opens; read this to know what we learned.*

| Report | Covers | Length |
|---|---|---|
| `research/2026-10-26-genre-coop-dungeon-crawlers.md` | 30+ crawlers and roguelikes; speed-timeline combat systems; exploration (light, traps, secrets, ambush); floor/boss structure; town loops; mobile findings | ~6,300 words, 60 sources |
| `research/2026-10-26-systems-tiers-use-durability-pets-chests-skills.md` | tier ladders; level-with-use and weapon XP; durability; material chains; pets; chests/gacha with soft currency; skill learning; "realistic" stats | ~7,900 words, 62 sources |
| `research/2026-10-26-tech-engine-android-coop.md` | engine choice for an AI-agent-driven build; Android pipeline; multiplayer options; the S25 Ultra; Blender → engine; procedural dungeons; data; testing | ~6,750 words, 55 sources |

## 1. Genre — what the field says

- **Floors and bosses converge** on a boss every 3–5 floors with a shop/rest before it (Shattered PD 5×5, Moonlighter 5×3, Slay the Spire's 17-floor acts with fixed treasure/rest/boss floors and published room weights 53/8/12/5/22). → D-017 (10 floors, three zones, bosses on 3/6/9/10, merchant before each boss), `03` §11.1 weights.
- **Speed as an energy queue** is the only model where "speed = more attacks" is literally true (ToME 1,000 energy ÷ speed; Caves of Qud 1,000-cost actions with ±10% jitter; DCSS weapon delay; Grandia/FFX charge bars). → D-004.
- **Co-op idle time** is cured by grouped allied turns (BG3, Wildermyth, DOS2 DE); For The King players asked for simultaneous turns. → D-014, `03` §10.2.
- **Darkest Dungeon's light meter** is the best single exploration dial (scouting, surprise, loot, monster accuracy all keyed to five bands); DCSS removed hunger as featuritis; Barony's Minotaur is a better clock than food. → D-016.
- **Perception as passive detection** (Shattered PD's radius, NetHack's auto-search; D&D passive perception) beats a "search" button. → `03` §4.3.
- **Vermintide's enemy taxonomy** (fodder / armored elite / disabler special / monster / boss) keeps every co-op role relevant; Dredmor's palette swaps after floor five are the cautionary tale. → `06` §1, §8.
- **Diablo 3 elite affixes** scale 1 → 4 by level, max 2–3 offensive; D4 nightmare sigils have revive budgets (12/4). → `06` §2, D-015.
- **Death in co-op**: ally revive within a budget + gold loss + 10% durability beats permadeath for a four-person evening. → D-015.
- **Mobile**: median session 5–6 minutes; reviewers praise Diablo Immortal's controls and punish small text, menu overload and stamina timers; no polished turn-based 4-player 3D co-op crawler exists on Android. → D-003 (landscape, a floor per session), D-012 (no timers, no money).

## 2. Systems — what shipped games teach

- **Two axes, always**: grade (affix budget, base band, look) and investment (+N, materials). D4 Sacred/Ancestral × rarity; MH rarity × augments (inverted on purpose); Souls +N. → D-008, D-010.
- **Letter ladders** read best with S as the practical top and one countable tier above (Solo Leveling's National Level, DQM's X). → F…S, SS, God with God boss-bound.
- **Level-with-use exploits** all come from rewarding the action rather than the challenge (Skyrim sneak, Oblivion Armorer); the shipped fixes are UO's "no gain on easy tasks", Kenshi's difficulty multiplier (0.1× … 6×), Bannerlord's learning limit, DCSS's XP pool. Valheim's 5% death loss is its most-hated rule. → D-007.
- **Weapon XP**: Dark Cloud's per-instance ABS with 60% carry-over into a successor; Vagrant Story affinities (but never decreasing, to avoid swap-grind); Fire Emblem ranks per type. → `03` §5.2.
- **Durability**: hated — vanishing items (BotW, ACNH), mid-fight breaks (DS2), no repair; accepted — D2's Broken-not-destroyed, Witcher 3's cheap kits, Fallout's condition bands. → D-009.
- **Materials**: RuneScape's legible ladder, Terraria's alternate pairs, Minecraft's "upgrade the item you have" (Netherite), MH's part rates (common 20–40%, rare 1–8%, part-break and capture as levers). → D-010.
- **Pets**: one per player (MH online), stances not menus (MH Palicoes), stamina not PP (Temtem), downed not dead, no hunger (WoW removed happiness; MapleStory's fullness is a paywall), D3's solo-only followers make co-op a downgrade. → D-013.
- **Chests with soft currency**: Hearthstone's pity (Legendary in 40, Epic in 10) and duplicate protection, Snap's bag-without-replacement, Brawl Stars' published tables, Clash Royale's deterministic cycle; Google Play's odds rule is about *purchase* — disclose anyway. → D-012.
- **Skill learning**: SaGa's spark curve (peak at matching tech level, 20% at TSI 0) makes "fight the right enemy" the strategy; GW's trainer price ramp and 8-skill bar; DD's four equipped of seven; FFV's Blue Magic for monster techniques. → D-011.
- **Stats**: SPECIAL's one-headline-per-stat; rational `cap·x/(x+k)` curves for percentages, linear for multipliers; D&D passive perception; Brogue's stealth radius. → D-006, `03` §2.2.

## 3. Tech — what we checked (versions as of 2026-10-26)

- Godot 4.7.2 (GDScript, Mobile renderer) is the best **native** path for an agent-driven build; Unity 6.3 LTS carries account/licence friction and YAML scenes; Unreal/Defold/Bevy don't fit. The report recommends Godot + APK on GitHub Releases. → We chose the **web app on GitHub Pages** instead for James's situation (D-002, `10` §1); the report remains the fallback plan.
- Android sideloading tightens: Samsung Auto Blocker; Google developer verification from 30 Sept 2026 in four countries and globally in 2027; Play requires API 36 and 16 KB pages. → one more reason for the PWA.
- **Galaxy S25 Ultra**: Snapdragon 8 Elite for Galaxy, Adreno 830, 12 GB, 1440×3120 at 120 Hz; **throttles to ~50% GPU in 3–4 minutes** → budget for sustained 60 fps at 0.67–0.75 render scale, ≤ 15k tris per hero with gear, ≤ 70 bones, 1024² atlases, ≤ 250 draw calls, ≤ 4 shadowed lights (→ `10` §4, tightened for WebGL).
- **Multiplayer**: deterministic lockstep with host-sequenced commands is the cheapest reliable co-op; Nakama (self-host), EOS (free P2P), Photon Fusion (100 CCU free), PlayFab's free tier cut to 1,000 MAU, Colyseus; relays add ~50 ms nobody notices in a turn-based game. → D-014 (browser WebRTC via Trystero, Cloudflare Worker relay).
- **Blender 5.2 LTS**: legacy action API removed in 5.0 (slotted actions), glTF Actions mode exports active or NLA-stashed actions, deform-bones-only, 4 influences; shared-armature `.glb` per gear piece; species via shape keys + bone scale ±15%; Mixamo OK commercially (no raw redistribution); Meshy/Tripo free tiers are CC BY — block-out only. → D-019, `11`.
- **Procedural dungeons**: mission-graph grammar → grid layout of room templates (Edgar-style, ≤ 15 rooms) → decoration pass; seeded by the host; integer-only. → `03` §11.1, `07` §2.
- **Testing an agent can run**: headless sim tests, balance batch, scene smoke, screenshots, device soak with a performance log. → `10` §7.

## 4. What we deliberately did not take

Real-time action combat (netcode, thumbs, untestable), hunger, permadeath by default, real-money chests, player trading (no server), free-roam 3D exploration, Unity/Godot native builds (for now), generative-3D assets in the shipped game.

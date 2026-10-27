# Balance report — 2026-10-27 — first-pass

*Written by `npm run balance` on the Phase 2 fixture set (sim/test/fixtures/content): one class, two species, seven monsters, one zone; 40 seeds × 4 recipes, zone **The Cellars** of **Gravehollow Keep** (floors 1–3), Normal, no Pacts; 5 s.*

## 1. Outcomes per recipe

| Recipe | Cleared | Retreated | Wiped | Capped | Floors reached (mean) | Rooms | Fights | Downs/delve | Commands |
|---|---|---|---|---|---|---|---|---|---|
| solo warden | 0% | 0% | 100% | 0% | 2.8 | 18.6 | 7.3 | 3.5 | 44 |
| solo warden (cautious) | 0% | 0% | 100% | 0% | 2.9 | 20.9 | 7.7 | 3.6 | 43 |
| three wardens (textbook) | 0% | 0% | 100% | 0% | 3.0 | 24.3 | 9.9 | 11.7 | 65 |
| three wardens (greedy) | 0% | 0% | 100% | 0% | 3.0 | 24.4 | 10.1 | 13.0 | 65 |

## 2. Fight length (rounds) by fight kind

| Recipe | fight | elite | boss | hunter | trap/curio |
|---|---|---|---|---|---|
| solo warden | 3.5 (n=229) | 3.8 (n=33) | 6.3 (n=7) | 2.0 (n=1) | 3.2 |
| solo warden (cautious) | 3.4 (n=259) | 4.0 (n=34) | 5.9 (n=14) | - (n=0) | - |
| three wardens (textbook) | 3.4 (n=301) | 6.9 (n=42) | 16.0 (n=32) | 8.0 (n=1) | 3.7 |
| three wardens (greedy) | 3.5 (n=296) | 7.0 (n=44) | 16.2 (n=31) | 11.0 (n=1) | 4.0 |

## 3. Economy and wear

| Recipe | Gold banked (mean) | p10 | p90 | Gold found | Repair bill (gold) | Repair % of R | Wear main hand % | Wear chest % | Chests | Torches | Light at stairs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| solo warden | 0 | 0 | 0 | 202 | 69 | 23.0% | 21.1 | 18.9 | 1.7 | 0.0 | 99 |
| solo warden (cautious) | 0 | 0 | 0 | 194 | 70 | 23.3% | 22.2 | 18.9 | 0.0 | 0.0 | 98 |
| three wardens (textbook) | 0 | 0 | 0 | 366 | 194 | 64.7% | 17.1 | 17.9 | 2.7 | 0.0 | 98 |
| three wardens (greedy) | 0 | 0 | 0 | 363 | 196 | 65.3% | 17.2 | 18.0 | 3.5 | 0.0 | 99 |

## 4. Exploration

| Recipe | Ambushed (party) / delve | Ambushed (monsters) / delve | Hunter arrivals | Traps revealed / triggered / disarmed | Curios | Insights / delve | Ticks to stairs (mean) |
|---|---|---|---|---|---|---|---|
| solo warden | 1.4 (19% of fights) | 1.8 | 5% of delves | 3.9 / 1.6 / 2.2 | 2.0 | 0.1 | 23 |
| solo warden (cautious) | 1.2 (16% of fights) | 2.1 | 5% of delves | 4.8 / 0.0 / 0.0 | 2.3 | 0.2 | 22 |
| three wardens (textbook) | 1.6 (16% of fights) | 2.6 | 10% of delves | 5.4 / 2.1 / 3.2 | 2.8 | 1.2 | 22 |
| three wardens (greedy) | 1.5 (15% of fights) | 2.6 | 3% of delves | 5.6 / 3.1 / 3.0 | 2.9 | 1.2 | 19 |

## 5. Judgement lines

- **OK** solo warden: fight rounds: 3.5 (target 3–6)
- **LOW** solo warden: elite rounds: 3.8 (target 5–7)
- **LOW** solo warden: boss rounds: 6.3 (target 10–15)
- **LOW** solo warden: hunter rounds: 2.0 (target 6–8)
- **OK** solo warden (cautious): fight rounds: 3.4 (target 3–6)
- **LOW** solo warden (cautious): elite rounds: 4.0 (target 5–7)
- **LOW** solo warden (cautious): boss rounds: 5.9 (target 10–15)
- **OK** three wardens (textbook): fight rounds: 3.4 (target 3–6)
- **OK** three wardens (textbook): elite rounds: 6.9 (target 5–7)
- **HIGH** three wardens (textbook): boss rounds: 16.0 (target 10–15)
- **OK** three wardens (textbook): hunter rounds: 8.0 (target 6–8)
- **OK** three wardens (greedy): fight rounds: 3.5 (target 3–6)
- **HIGH** three wardens (greedy): elite rounds: 7.0 (target 5–7)
- **HIGH** three wardens (greedy): boss rounds: 16.2 (target 10–15)
- **HIGH** three wardens (greedy): hunter rounds: 11.0 (target 6–8)
- **OK** solo warden: party ambushed, % of fights: 19.2% (target 10–30%)
- **OK** solo warden (cautious): party ambushed, % of fights: 15.6% (target 10–30%)
- **OK** three wardens (textbook): party ambushed, % of fights: 16.4% (target 10–30%)
- **OK** three wardens (greedy): party ambushed, % of fights: 14.9% (target 10–30%)

## 6. Reading the report

- A **fight** is 3–6 rounds for ordinary packs (03 §3.6; 06 §8.9 narrows fodder packs to 3–4), elites 5–7, bosses 10–15, hunters 6–8.
- Gold per delve should land near **R = 300** at the Cellars band (03 §8.1), with the full repair bill between 15% and 35% of it (08 §9.3 holds the Warden at ~27%).
- A fully used F weapon should lose 25–35% per delve (03 §6.4; 08 §9.4 says 30%, 3.3 delves to broken).
- The party should be surprised in roughly 10–30% of fights at full light with a Perception-10 party; Dim adds 5 pp, the Cellars family 15 pp (03 §4.2–§4.4).
- Phase 2 caveat: the fixture set has one class (the Warden with 12 of 45 skills), five of twelve elite affixes, no Ranger/Shade scouting bonuses, and several skill hooks are not yet implemented (they resolve as no-ops); numbers tune in Phase 3 on the real content.

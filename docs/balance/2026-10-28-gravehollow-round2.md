# Balance report — 2026-10-28 — gravehollow-round2

*Written by `npm run balance` (plan `gravehollow`) on content/: 204 cells, 16560 delves (seeds from 1) — **main**: main recipes × Sheltered/Mortal/Nightmare × normal × textbook, 100 seeds · **careful**: main recipes × Mortal × normal × careful, 100 seeds · **spot**: main recipes × Mortal × hard/dread × textbook, 40 seeds · **dive**: dive recipes × Mortal × normal × textbook/careful, 100 seeds · **vault-run**: vault-run recipes × Mortal × normal × textbook, 100 seeds; **Gravehollow Keep**, The Cellars · The Crypts · The Drowned Vault F7 · The Drowned Vault F8 · The Drowned Vault; Pacts none; bosses die again (repeat kills, no first-kill drops; `--kills first` pays them); command cap 3000; 514 s. Judged: the textbook player on Normal without Pacts.*

## 0. What the content provides

- **Floors present:** F1–8 of the 8 the dungeon should hold (tuning `runner.expectedFloors`); **missing:** none.
- **Zones:** 1. The Cellars (F1–3) · 2. The Crypts (F4–6) · 3. The Drowned Vault (F7–8).
- **Recipes played:** cel-solo-fresh, cel-solo-ground, cel-four-fresh, cel-three-fresh, cel-glass-fresh, cel-pair-fresh, cel-three-levelled, cel-pair-levelled, cry-solo-arriving, cry-solo-ground, cry-four-arriving, cry-three-arriving, cry-glass-arriving, cry-pair-arriving, cry-three-ready, cry-pair-ready, vlt7-solo-arriving, vlt7-solo-ground, vlt7-four-arriving, vlt7-three-arriving, vlt7-glass-arriving, vlt7-pair-arriving, vlt7-three-ready, vlt7-pair-ready, vlt8-solo-arriving, vlt8-solo-ground, vlt8-four-arriving, vlt8-three-arriving, vlt8-glass-arriving, vlt8-pair-arriving, vlt8-three-ready, vlt8-pair-ready, vlt-run-solo-arriving, vlt-run-solo-ground, vlt-run-four-arriving, vlt-run-three-arriving, vlt-run-glass-arriving, vlt-run-pair-arriving, vlt-run-three-ready, vlt-run-pair-ready, dive-four-crypts, dive-four-vault.

## 1. Outcomes per recipe

| Recipe | Floors | Cleared | Retreated | Wiped | Chosen hero died (Nightmare) | Stuck or capped | Deepest floor done (mean) | Party level start → end | Rooms | Fights | Downs / delve | Commands |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| solo warden, fresh · Sheltered · normal · textbook | The Cellars | 3% | 13% | 84% | 0% | 0% | 1.6 | 1.0 → 6.1 | 18.2 | 7.6 | 1.8 | 42 (max 81) |
| solo warden, fresh · Mortal · normal · textbook | The Cellars | 3% | 13% | 84% | 0% | 0% | 1.6 | 1.0 → 6.1 | 18.2 | 7.6 | 1.8 | 42 (max 81) |
| solo warden, fresh · Nightmare · normal · textbook | The Cellars | 3% | 13% | 84% | 0% | 0% | 1.6 | 1.0 → 6.1 | 18.2 | 7.6 | 1.8 | 42 (max 81) |
| solo warden, ground (L12, D gear) · Sheltered · normal · textbook | The Cellars | 63% | 8% | 29% | 0% | 0% | 2.6 | 12.0 → 12.0 | 24.7 | 11.1 | 1.3 | 62 (max 89) |
| solo warden, ground (L12, D gear) · Mortal · normal · textbook | The Cellars | 63% | 8% | 29% | 0% | 0% | 2.6 | 12.0 → 12.0 | 24.7 | 11.1 | 1.3 | 62 (max 89) |
| solo warden, ground (L12, D gear) · Nightmare · normal · textbook | The Cellars | 63% | 8% | 29% | 0% | 0% | 2.6 | 12.0 → 12.0 | 24.7 | 11.1 | 1.3 | 62 (max 89) |
| classic four, fresh: warden, blade, mender, arcanist · Sheltered · normal · textbook | The Cellars | 63% | 0% | 37% | 0% | 0% | 2.6 | 1.0 → 7.2 | 24.7 | 10.9 | 13.0 | 63 (max 86) |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · textbook | The Cellars | 47% | 13% | 40% | 0% | 0% | 2.4 | 1.0 → 6.8 | 23.7 | 10.3 | 10.6 | 59 (max 86) |
| classic four, fresh: warden, blade, mender, arcanist · Nightmare · normal · textbook | The Cellars | 46% | 0% | 21% | 33% | 0% | 2.4 | 1.0 → 6.8 | 23.7 | 10.0 | 10.0 | 57 (max 86) |
| crypt-breakers, fresh: mender, warden, ranger · Sheltered · normal · textbook | The Cellars | 35% | 1% | 64% | 0% | 0% | 2.4 | 1.0 → 6.6 | 24.6 | 10.5 | 9.8 | 60 (max 85) |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · textbook | The Cellars | 33% | 7% | 60% | 0% | 0% | 2.3 | 1.0 → 6.5 | 24.3 | 10.4 | 9.2 | 59 (max 85) |
| crypt-breakers, fresh: mender, warden, ranger · Nightmare · normal · textbook | The Cellars | 33% | 7% | 57% | 3% | 0% | 2.3 | 1.0 → 6.5 | 24.3 | 10.4 | 9.1 | 59 (max 85) |
| glass cannons, fresh: arcanist, shade, ranger · Sheltered · normal · textbook | The Cellars | 15% | 36% | 49% | 0% | 0% | 2.1 | 1.0 → 5.8 | 21.8 | 9.2 | 8.4 | 53 (max 77) |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · textbook | The Cellars | 12% | 42% | 46% | 0% | 0% | 2.0 | 1.0 → 5.6 | 21.2 | 8.8 | 7.3 | 51 (max 76) |
| glass cannons, fresh: arcanist, shade, ranger · Nightmare · normal · textbook | The Cellars | 12% | 39% | 37% | 12% | 0% | 2.0 | 1.0 → 5.6 | 21.2 | 8.7 | 7.1 | 51 (max 76) |
| the pair, fresh: blade, mender · Sheltered · normal · textbook | The Cellars | 28% | 7% | 65% | 0% | 0% | 2.3 | 1.0 → 7.2 | 24.0 | 10.3 | 6.7 | 59 (max 90) |
| the pair, fresh: blade, mender · Mortal · normal · textbook | The Cellars | 27% | 8% | 65% | 0% | 0% | 2.3 | 1.0 → 7.2 | 23.8 | 10.2 | 6.4 | 58 (max 89) |
| the pair, fresh: blade, mender · Nightmare · normal · textbook | The Cellars | 27% | 7% | 62% | 4% | 0% | 2.3 | 1.0 → 7.2 | 23.8 | 10.2 | 6.3 | 57 (max 89) |
| crypt-breakers, levelled (L5, E gear) · Sheltered · normal · textbook | The Cellars | 87% | 1% | 12% | 0% | 0% | 2.9 | 5.0 → 8.1 | 24.7 | 10.5 | 3.6 | 62 (max 94) |
| crypt-breakers, levelled (L5, E gear) · Mortal · normal · textbook | The Cellars | 85% | 1% | 14% | 0% | 0% | 2.9 | 5.0 → 8.1 | 24.7 | 10.5 | 3.6 | 61 (max 88) |
| crypt-breakers, levelled (L5, E gear) · Nightmare · normal · textbook | The Cellars | 85% | 1% | 12% | 2% | 0% | 2.9 | 5.0 → 8.1 | 24.7 | 10.5 | 3.6 | 61 (max 88) |
| the pair, levelled (L5, E gear) · Sheltered · normal · textbook | The Cellars | 75% | 1% | 24% | 0% | 0% | 2.8 | 5.0 → 8.6 | 24.8 | 10.7 | 3.7 | 63 (max 94) |
| the pair, levelled (L5, E gear) · Mortal · normal · textbook | The Cellars | 70% | 2% | 28% | 0% | 0% | 2.7 | 5.0 → 8.5 | 24.7 | 10.7 | 3.7 | 62 (max 94) |
| the pair, levelled (L5, E gear) · Nightmare · normal · textbook | The Cellars | 70% | 2% | 27% | 1% | 0% | 2.7 | 5.0 → 8.5 | 24.7 | 10.7 | 3.6 | 62 (max 94) |
| solo warden, arriving (L5, E gear) · Sheltered · normal · textbook | The Crypts | 8% | 4% | 88% | 0% | 0% | 3.3 | 5.0 → 8.7 | 15.5 | 6.9 | 1.6 | 36 (max 89) |
| solo warden, arriving (L5, E gear) · Mortal · normal · textbook | The Crypts | 8% | 4% | 88% | 0% | 0% | 3.3 | 5.0 → 8.7 | 15.5 | 6.9 | 1.6 | 36 (max 89) |
| solo warden, arriving (L5, E gear) · Nightmare · normal · textbook | The Crypts | 8% | 4% | 88% | 0% | 0% | 3.3 | 5.0 → 8.7 | 15.5 | 6.9 | 1.6 | 36 (max 89) |
| solo warden, ground (L16, C gear) · Sheltered · normal · textbook | The Crypts | 53% | 14% | 33% | 0% | 0% | 4.9 | 16.0 → 16.0 | 23.2 | 10.5 | 0.6 | 58 (max 114) |
| solo warden, ground (L16, C gear) · Mortal · normal · textbook | The Crypts | 53% | 14% | 33% | 0% | 0% | 4.9 | 16.0 → 16.0 | 23.2 | 10.5 | 0.6 | 58 (max 114) |
| solo warden, ground (L16, C gear) · Nightmare · normal · textbook | The Crypts | 53% | 14% | 33% | 0% | 0% | 4.9 | 16.0 → 16.0 | 23.2 | 10.5 | 0.6 | 58 (max 114) |
| classic four, arriving (L5, E gear) · Sheltered · normal · textbook | The Crypts | 67% | 3% | 30% | 0% | 0% | 5.6 | 5.0 → 10.3 | 28.0 | 12.4 | 14.2 | 72 (max 109) |
| classic four, arriving (L5, E gear) · Mortal · normal · textbook | The Crypts | 58% | 16% | 26% | 0% | 0% | 5.4 | 5.0 → 9.8 | 25.8 | 11.4 | 12.6 | 66 (max 109) |
| classic four, arriving (L5, E gear) · Nightmare · normal · textbook | The Crypts | 50% | 1% | 25% | 24% | 0% | 5.1 | 5.0 → 9.8 | 25.7 | 11.3 | 12.6 | 65 (max 109) |
| crypt-breakers, arriving (L5, E gear) · Sheltered · normal · textbook | The Crypts | 48% | 5% | 47% | 0% | 0% | 5.4 | 5.0 → 10.0 | 27.3 | 11.8 | 8.6 | 73 (max 124) |
| crypt-breakers, arriving (L5, E gear) · Mortal · normal · textbook | The Crypts | 45% | 10% | 45% | 0% | 0% | 5.4 | 5.0 → 9.9 | 26.9 | 11.6 | 8.3 | 72 (max 124) |
| crypt-breakers, arriving (L5, E gear) · Nightmare · normal · textbook | The Crypts | 45% | 8% | 44% | 3% | 0% | 5.4 | 5.0 → 9.9 | 26.9 | 11.6 | 8.3 | 72 (max 124) |
| glass cannons, arriving (L5, E gear) · Sheltered · normal · textbook | The Crypts | 0% | 77% | 23% | 0% | 0% | 4.5 | 5.0 → 8.3 | 19.3 | 8.2 | 6.0 | 53 (max 91) |
| glass cannons, arriving (L5, E gear) · Mortal · normal · textbook | The Crypts | 0% | 78% | 22% | 0% | 0% | 4.4 | 5.0 → 8.2 | 18.6 | 7.9 | 5.5 | 51 (max 91) |
| glass cannons, arriving (L5, E gear) · Nightmare · normal · textbook | The Crypts | 0% | 67% | 21% | 12% | 0% | 4.4 | 5.0 → 8.2 | 18.6 | 7.9 | 5.5 | 51 (max 91) |
| the pair, arriving (L5, E gear) · Sheltered · normal · textbook | The Crypts | 24% | 6% | 70% | 0% | 0% | 5.1 | 5.0 → 10.0 | 25.6 | 11.2 | 7.1 | 62 (max 99) |
| the pair, arriving (L5, E gear) · Mortal · normal · textbook | The Crypts | 19% | 21% | 60% | 0% | 0% | 4.9 | 5.0 → 9.8 | 24.2 | 10.4 | 6.2 | 58 (max 99) |
| the pair, arriving (L5, E gear) · Nightmare · normal · textbook | The Crypts | 19% | 5% | 60% | 16% | 0% | 4.8 | 5.0 → 9.8 | 24.2 | 10.4 | 6.2 | 58 (max 99) |
| crypt-breakers, ready (L9, D gear) · Sheltered · normal · textbook | The Crypts | 74% | 1% | 25% | 0% | 0% | 5.7 | 9.0 → 11.3 | 28.9 | 12.4 | 5.1 | 79 (max 114) |
| crypt-breakers, ready (L9, D gear) · Mortal · normal · textbook | The Crypts | 72% | 3% | 25% | 0% | 0% | 5.7 | 9.0 → 11.2 | 28.8 | 12.3 | 5.0 | 78 (max 109) |
| crypt-breakers, ready (L9, D gear) · Nightmare · normal · textbook | The Crypts | 72% | 2% | 24% | 2% | 0% | 5.7 | 9.0 → 11.2 | 28.8 | 12.3 | 5.0 | 78 (max 109) |
| the pair, ready (L9, D gear) · Sheltered · normal · textbook | The Crypts | 47% | 4% | 49% | 0% | 0% | 5.4 | 9.0 → 11.3 | 27.5 | 12.0 | 4.7 | 69 (max 107) |
| the pair, ready (L9, D gear) · Mortal · normal · textbook | The Crypts | 46% | 5% | 49% | 0% | 0% | 5.4 | 9.0 → 11.3 | 27.1 | 11.8 | 4.5 | 68 (max 107) |
| the pair, ready (L9, D gear) · Nightmare · normal · textbook | The Crypts | 43% | 4% | 47% | 6% | 0% | 5.3 | 9.0 → 11.3 | 27.1 | 11.8 | 4.5 | 68 (max 107) |
| solo warden, arriving (L11, D gear) · Sheltered · normal · textbook | The Drowned Vault F7 | 0% | 5% | 95% | 0% | 0% | 0.0 | 11.0 → 11.3 | 5.1 | 2.6 | 1.8 | 8 (max 36) |
| solo warden, arriving (L11, D gear) · Mortal · normal · textbook | The Drowned Vault F7 | 0% | 5% | 95% | 0% | 0% | 0.0 | 11.0 → 11.3 | 5.1 | 2.6 | 1.8 | 8 (max 36) |
| solo warden, arriving (L11, D gear) · Nightmare · normal · textbook | The Drowned Vault F7 | 0% | 5% | 95% | 0% | 0% | 0.0 | 11.0 → 11.3 | 5.1 | 2.6 | 1.8 | 8 (max 36) |
| solo warden, ground (L21, B gear) · Sheltered · normal · textbook | The Drowned Vault F7 | 50% | 5% | 45% | 0% | 0% | 3.5 | 21.0 → 21.0 | 8.7 | 4.5 | 0.9 | 21 (max 49) |
| solo warden, ground (L21, B gear) · Mortal · normal · textbook | The Drowned Vault F7 | 50% | 5% | 45% | 0% | 0% | 3.5 | 21.0 → 21.0 | 8.7 | 4.5 | 0.9 | 21 (max 49) |
| solo warden, ground (L21, B gear) · Nightmare · normal · textbook | The Drowned Vault F7 | 50% | 5% | 45% | 0% | 0% | 3.5 | 21.0 → 21.0 | 8.7 | 4.5 | 0.9 | 21 (max 49) |
| classic four, arriving (L11, D gear) · Sheltered · normal · textbook | The Drowned Vault F7 | 74% | 0% | 26% | 0% | 0% | 5.2 | 11.0 → 12.5 | 10.1 | 4.8 | 6.5 | 25 (max 49) |
| classic four, arriving (L11, D gear) · Mortal · normal · textbook | The Drowned Vault F7 | 64% | 11% | 25% | 0% | 0% | 4.5 | 11.0 → 12.4 | 9.5 | 4.5 | 6.0 | 23 (max 49) |
| classic four, arriving (L11, D gear) · Nightmare · normal · textbook | The Drowned Vault F7 | 63% | 1% | 23% | 13% | 0% | 4.4 | 11.0 → 12.4 | 9.5 | 4.5 | 5.9 | 22 (max 49) |
| crypt-breakers, arriving (L11, D gear) · Sheltered · normal · textbook | The Drowned Vault F7 | 39% | 2% | 59% | 0% | 0% | 2.7 | 11.0 → 12.0 | 10.0 | 4.9 | 5.5 | 24 (max 48) |
| crypt-breakers, arriving (L11, D gear) · Mortal · normal · textbook | The Drowned Vault F7 | 39% | 7% | 54% | 0% | 0% | 2.7 | 11.0 → 12.0 | 9.7 | 4.8 | 5.0 | 23 (max 48) |
| crypt-breakers, arriving (L11, D gear) · Nightmare · normal · textbook | The Drowned Vault F7 | 33% | 2% | 52% | 13% | 0% | 2.3 | 11.0 → 12.0 | 9.7 | 4.7 | 5.0 | 22 (max 48) |
| glass cannons, arriving (L11, D gear) · Sheltered · normal · textbook | The Drowned Vault F7 | 15% | 21% | 64% | 0% | 0% | 1.1 | 11.0 → 11.4 | 8.4 | 4.1 | 5.5 | 19 (max 39) |
| glass cannons, arriving (L11, D gear) · Mortal · normal · textbook | The Drowned Vault F7 | 14% | 31% | 55% | 0% | 0% | 1.0 | 11.0 → 11.4 | 7.9 | 3.9 | 4.8 | 18 (max 39) |
| glass cannons, arriving (L11, D gear) · Nightmare · normal · textbook | The Drowned Vault F7 | 14% | 23% | 55% | 8% | 0% | 1.0 | 11.0 → 11.4 | 7.9 | 3.9 | 4.8 | 18 (max 39) |
| the pair, arriving (L11, D gear) · Sheltered · normal · textbook | The Drowned Vault F7 | 33% | 3% | 64% | 0% | 0% | 2.3 | 11.0 → 12.3 | 9.2 | 4.6 | 4.0 | 21 (max 44) |
| the pair, arriving (L11, D gear) · Mortal · normal · textbook | The Drowned Vault F7 | 30% | 9% | 61% | 0% | 0% | 2.1 | 11.0 → 12.2 | 8.9 | 4.4 | 3.8 | 20 (max 44) |
| the pair, arriving (L11, D gear) · Nightmare · normal · textbook | The Drowned Vault F7 | 30% | 3% | 60% | 7% | 0% | 2.1 | 11.0 → 12.2 | 8.8 | 4.4 | 3.8 | 20 (max 44) |
| crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook | The Drowned Vault F7 | 95% | 1% | 4% | 0% | 0% | 6.7 | 14.0 → 14.1 | 10.4 | 5.0 | 1.6 | 28 (max 49) |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook | The Drowned Vault F7 | 93% | 3% | 4% | 0% | 0% | 6.5 | 14.0 → 14.1 | 10.3 | 5.0 | 1.6 | 27 (max 49) |
| crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook | The Drowned Vault F7 | 86% | 1% | 4% | 9% | 0% | 6.0 | 14.0 → 14.1 | 10.3 | 5.0 | 1.6 | 27 (max 49) |
| the pair, ready (L14, C gear) · Sheltered · normal · textbook | The Drowned Vault F7 | 77% | 0% | 23% | 0% | 0% | 5.4 | 14.0 → 14.8 | 10.3 | 5.0 | 2.1 | 26 (max 48) |
| the pair, ready (L14, C gear) · Mortal · normal · textbook | The Drowned Vault F7 | 74% | 3% | 23% | 0% | 0% | 5.2 | 14.0 → 14.7 | 10.1 | 4.9 | 2.0 | 25 (max 48) |
| the pair, ready (L14, C gear) · Nightmare · normal · textbook | The Drowned Vault F7 | 73% | 0% | 22% | 5% | 0% | 5.1 | 14.0 → 14.7 | 10.1 | 4.9 | 2.0 | 25 (max 48) |
| solo warden, arriving (L13, D gear) · Sheltered · normal · textbook | The Drowned Vault F8 | 6% | 1% | 93% | 0% | 0% | 0.5 | 13.0 → 13.2 | 3.2 | 1.6 | 1.8 | 3 (max 7) |
| solo warden, arriving (L13, D gear) · Mortal · normal · textbook | The Drowned Vault F8 | 6% | 1% | 93% | 0% | 0% | 0.5 | 13.0 → 13.2 | 3.2 | 1.6 | 1.8 | 3 (max 7) |
| solo warden, arriving (L13, D gear) · Nightmare · normal · textbook | The Drowned Vault F8 | 6% | 1% | 93% | 0% | 0% | 0.5 | 13.0 → 13.2 | 3.2 | 1.6 | 1.8 | 3 (max 7) |
| solo warden, ground (L21, B gear) · Sheltered · normal · textbook | The Drowned Vault F8 | 54% | 0% | 46% | 0% | 0% | 4.3 | 21.0 → 21.0 | 3.9 | 2.0 | 0.9 | 5 (max 10) |
| solo warden, ground (L21, B gear) · Mortal · normal · textbook | The Drowned Vault F8 | 54% | 0% | 46% | 0% | 0% | 4.3 | 21.0 → 21.0 | 3.9 | 2.0 | 0.9 | 5 (max 10) |
| solo warden, ground (L21, B gear) · Nightmare · normal · textbook | The Drowned Vault F8 | 54% | 0% | 46% | 0% | 0% | 4.3 | 21.0 → 21.0 | 3.9 | 2.0 | 0.9 | 5 (max 10) |
| classic four, arriving (L13, D gear) · Sheltered · normal · textbook | The Drowned Vault F8 | 44% | 0% | 56% | 0% | 0% | 3.5 | 13.0 → 13.4 | 4.0 | 2.0 | 6.1 | 6 (max 11) |
| classic four, arriving (L13, D gear) · Mortal · normal · textbook | The Drowned Vault F8 | 44% | 0% | 56% | 0% | 0% | 3.5 | 13.0 → 13.4 | 4.0 | 2.0 | 6.1 | 6 (max 11) |
| classic four, arriving (L13, D gear) · Nightmare · normal · textbook | The Drowned Vault F8 | 42% | 0% | 56% | 2% | 0% | 3.4 | 13.0 → 13.4 | 4.0 | 2.0 | 6.1 | 6 (max 11) |
| crypt-breakers, arriving (L13, D gear) · Sheltered · normal · textbook | The Drowned Vault F8 | 47% | 0% | 53% | 0% | 0% | 3.8 | 13.0 → 13.5 | 4.0 | 2.0 | 3.9 | 6 (max 11) |
| crypt-breakers, arriving (L13, D gear) · Mortal · normal · textbook | The Drowned Vault F8 | 47% | 0% | 53% | 0% | 0% | 3.8 | 13.0 → 13.5 | 4.0 | 2.0 | 3.9 | 6 (max 11) |
| crypt-breakers, arriving (L13, D gear) · Nightmare · normal · textbook | The Drowned Vault F8 | 47% | 0% | 53% | 0% | 0% | 3.8 | 13.0 → 13.5 | 4.0 | 2.0 | 3.9 | 6 (max 11) |
| glass cannons, arriving (L13, D gear) · Sheltered · normal · textbook | The Drowned Vault F8 | 42% | 0% | 58% | 0% | 0% | 3.4 | 13.0 → 13.4 | 4.0 | 2.0 | 4.2 | 6 (max 9) |
| glass cannons, arriving (L13, D gear) · Mortal · normal · textbook | The Drowned Vault F8 | 42% | 0% | 58% | 0% | 0% | 3.4 | 13.0 → 13.4 | 4.0 | 2.0 | 4.2 | 6 (max 9) |
| glass cannons, arriving (L13, D gear) · Nightmare · normal · textbook | The Drowned Vault F8 | 42% | 0% | 58% | 0% | 0% | 3.4 | 13.0 → 13.4 | 4.0 | 2.0 | 4.2 | 6 (max 9) |
| the pair, arriving (L13, D gear) · Sheltered · normal · textbook | The Drowned Vault F8 | 37% | 1% | 62% | 0% | 0% | 3.0 | 13.0 → 13.7 | 3.8 | 1.9 | 3.5 | 5 (max 9) |
| the pair, arriving (L13, D gear) · Mortal · normal · textbook | The Drowned Vault F8 | 37% | 3% | 60% | 0% | 0% | 3.0 | 13.0 → 13.7 | 3.8 | 1.9 | 3.4 | 5 (max 9) |
| the pair, arriving (L13, D gear) · Nightmare · normal · textbook | The Drowned Vault F8 | 37% | 0% | 60% | 3% | 0% | 3.0 | 13.0 → 13.7 | 3.8 | 1.9 | 3.4 | 5 (max 9) |
| crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook | The Drowned Vault F8 | 61% | 0% | 39% | 0% | 0% | 4.9 | 14.0 → 14.6 | 4.0 | 2.0 | 3.0 | 6 (max 10) |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook | The Drowned Vault F8 | 61% | 0% | 39% | 0% | 0% | 4.9 | 14.0 → 14.6 | 4.0 | 2.0 | 3.0 | 6 (max 10) |
| crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook | The Drowned Vault F8 | 60% | 0% | 39% | 1% | 0% | 4.8 | 14.0 → 14.6 | 4.0 | 2.0 | 3.0 | 6 (max 10) |
| the pair, ready (L15, C gear) · Sheltered · normal · textbook | The Drowned Vault F8 | 72% | 0% | 28% | 0% | 0% | 5.8 | 15.0 → 15.7 | 4.0 | 2.0 | 1.8 | 6 (max 10) |
| the pair, ready (L15, C gear) · Mortal · normal · textbook | The Drowned Vault F8 | 71% | 1% | 28% | 0% | 0% | 5.7 | 15.0 → 15.7 | 4.0 | 2.0 | 1.8 | 6 (max 10) |
| the pair, ready (L15, C gear) · Nightmare · normal · textbook | The Drowned Vault F8 | 71% | 0% | 28% | 1% | 0% | 5.7 | 15.0 → 15.7 | 4.0 | 2.0 | 1.8 | 6 (max 10) |
| solo warden, fresh · Mortal · normal · careful | The Cellars | 3% | 16% | 81% | 0% | 0% | 1.6 | 1.0 → 6.0 | 17.9 | 7.4 | 1.8 | 41 (max 81) |
| solo warden, ground (L12, D gear) · Mortal · normal · careful | The Cellars | 63% | 8% | 29% | 0% | 0% | 2.6 | 12.0 → 12.0 | 24.7 | 11.1 | 1.3 | 62 (max 89) |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · careful | The Cellars | 29% | 42% | 29% | 0% | 0% | 2.3 | 1.0 → 5.5 | 20.9 | 8.7 | 7.9 | 51 (max 86) |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · careful | The Cellars | 29% | 38% | 33% | 0% | 0% | 2.3 | 1.0 → 5.5 | 21.4 | 8.8 | 6.3 | 52 (max 82) |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · careful | The Cellars | 9% | 64% | 27% | 0% | 0% | 2.0 | 1.0 → 4.7 | 18.7 | 7.4 | 4.9 | 45 (max 76) |
| the pair, fresh: blade, mender · Mortal · normal · careful | The Cellars | 25% | 20% | 55% | 0% | 0% | 2.2 | 1.0 → 6.7 | 22.8 | 9.5 | 5.6 | 55 (max 89) |
| crypt-breakers, levelled (L5, E gear) · Mortal · normal · careful | The Cellars | 85% | 1% | 14% | 0% | 0% | 2.9 | 5.0 → 8.1 | 24.7 | 10.5 | 3.6 | 61 (max 88) |
| the pair, levelled (L5, E gear) · Mortal · normal · careful | The Cellars | 70% | 2% | 28% | 0% | 0% | 2.7 | 5.0 → 8.5 | 24.7 | 10.7 | 3.7 | 62 (max 94) |
| solo warden, arriving (L5, E gear) · Mortal · normal · careful | The Crypts | 7% | 5% | 88% | 0% | 0% | 3.3 | 5.0 → 8.7 | 15.4 | 6.8 | 1.6 | 35 (max 75) |
| solo warden, ground (L16, C gear) · Mortal · normal · careful | The Crypts | 53% | 14% | 33% | 0% | 0% | 4.9 | 16.0 → 16.0 | 23.2 | 10.5 | 0.6 | 58 (max 114) |
| classic four, arriving (L5, E gear) · Mortal · normal · careful | The Crypts | 54% | 29% | 17% | 0% | 0% | 5.3 | 5.0 → 9.4 | 24.5 | 10.8 | 11.3 | 63 (max 109) |
| crypt-breakers, arriving (L5, E gear) · Mortal · normal · careful | The Crypts | 42% | 24% | 34% | 0% | 0% | 5.3 | 5.0 → 9.6 | 25.8 | 11.0 | 7.3 | 69 (max 124) |
| glass cannons, arriving (L5, E gear) · Mortal · normal · careful | The Crypts | 0% | 86% | 14% | 0% | 0% | 4.4 | 5.0 → 8.0 | 17.9 | 7.6 | 4.7 | 49 (max 91) |
| the pair, arriving (L5, E gear) · Mortal · normal · careful | The Crypts | 18% | 28% | 54% | 0% | 0% | 4.9 | 5.0 → 9.6 | 23.6 | 10.2 | 5.8 | 57 (max 99) |
| crypt-breakers, ready (L9, D gear) · Mortal · normal · careful | The Crypts | 72% | 3% | 25% | 0% | 0% | 5.7 | 9.0 → 11.2 | 28.8 | 12.3 | 5.0 | 78 (max 109) |
| the pair, ready (L9, D gear) · Mortal · normal · careful | The Crypts | 46% | 5% | 49% | 0% | 0% | 5.4 | 9.0 → 11.3 | 27.1 | 11.8 | 4.5 | 68 (max 107) |
| solo warden, arriving (L11, D gear) · Mortal · normal · careful | The Drowned Vault F7 | 0% | 5% | 95% | 0% | 0% | 0.0 | 11.0 → 11.3 | 5.1 | 2.6 | 1.8 | 8 (max 36) |
| solo warden, ground (L21, B gear) · Mortal · normal · careful | The Drowned Vault F7 | 50% | 5% | 45% | 0% | 0% | 3.5 | 21.0 → 21.0 | 8.7 | 4.5 | 0.9 | 21 (max 49) |
| classic four, arriving (L11, D gear) · Mortal · normal · careful | The Drowned Vault F7 | 64% | 11% | 25% | 0% | 0% | 4.5 | 11.0 → 12.4 | 9.5 | 4.5 | 6.0 | 23 (max 49) |
| crypt-breakers, arriving (L11, D gear) · Mortal · normal · careful | The Drowned Vault F7 | 39% | 7% | 54% | 0% | 0% | 2.7 | 11.0 → 12.0 | 9.7 | 4.8 | 5.0 | 23 (max 48) |
| glass cannons, arriving (L11, D gear) · Mortal · normal · careful | The Drowned Vault F7 | 14% | 31% | 55% | 0% | 0% | 1.0 | 11.0 → 11.4 | 7.9 | 3.9 | 4.8 | 18 (max 39) |
| the pair, arriving (L11, D gear) · Mortal · normal · careful | The Drowned Vault F7 | 30% | 9% | 61% | 0% | 0% | 2.1 | 11.0 → 12.2 | 8.9 | 4.4 | 3.8 | 20 (max 44) |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · careful | The Drowned Vault F7 | 93% | 3% | 4% | 0% | 0% | 6.5 | 14.0 → 14.1 | 10.3 | 5.0 | 1.6 | 27 (max 49) |
| the pair, ready (L14, C gear) · Mortal · normal · careful | The Drowned Vault F7 | 74% | 3% | 23% | 0% | 0% | 5.2 | 14.0 → 14.7 | 10.1 | 4.9 | 2.0 | 25 (max 48) |
| solo warden, arriving (L13, D gear) · Mortal · normal · careful | The Drowned Vault F8 | 6% | 1% | 93% | 0% | 0% | 0.5 | 13.0 → 13.2 | 3.2 | 1.6 | 1.8 | 3 (max 7) |
| solo warden, ground (L21, B gear) · Mortal · normal · careful | The Drowned Vault F8 | 54% | 0% | 46% | 0% | 0% | 4.3 | 21.0 → 21.0 | 3.9 | 2.0 | 0.9 | 5 (max 10) |
| classic four, arriving (L13, D gear) · Mortal · normal · careful | The Drowned Vault F8 | 44% | 0% | 56% | 0% | 0% | 3.5 | 13.0 → 13.4 | 4.0 | 2.0 | 6.1 | 6 (max 11) |
| crypt-breakers, arriving (L13, D gear) · Mortal · normal · careful | The Drowned Vault F8 | 47% | 0% | 53% | 0% | 0% | 3.8 | 13.0 → 13.5 | 4.0 | 2.0 | 3.9 | 6 (max 11) |
| glass cannons, arriving (L13, D gear) · Mortal · normal · careful | The Drowned Vault F8 | 42% | 0% | 58% | 0% | 0% | 3.4 | 13.0 → 13.4 | 4.0 | 2.0 | 4.2 | 6 (max 9) |
| the pair, arriving (L13, D gear) · Mortal · normal · careful | The Drowned Vault F8 | 37% | 3% | 60% | 0% | 0% | 3.0 | 13.0 → 13.7 | 3.8 | 1.9 | 3.4 | 5 (max 9) |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · careful | The Drowned Vault F8 | 61% | 0% | 39% | 0% | 0% | 4.9 | 14.0 → 14.6 | 4.0 | 2.0 | 3.0 | 6 (max 10) |
| the pair, ready (L15, C gear) · Mortal · normal · careful | The Drowned Vault F8 | 71% | 1% | 28% | 0% | 0% | 5.7 | 15.0 → 15.7 | 4.0 | 2.0 | 1.8 | 6 (max 10) |
| solo warden, fresh · Mortal · hard · textbook | The Cellars | 0% | 5% | 95% | 0% | 0% | 1.1 | 1.0 → 4.5 | 12.3 | 4.9 | 1.9 | 25 (max 63) |
| solo warden, fresh · Mortal · dread · textbook | The Cellars | 0% | 20% | 80% | 0% | 0% | 0.6 | 1.0 → 3.5 | 7.3 | 2.8 | 1.5 | 13 (max 32) |
| solo warden, ground (L12, D gear) · Mortal · hard · textbook | The Cellars | 18% | 20% | 63% | 0% | 0% | 2.0 | 12.0 → 12.0 | 21.8 | 9.4 | 1.4 | 52 (max 79) |
| solo warden, ground (L12, D gear) · Mortal · dread · textbook | The Cellars | 0% | 30% | 70% | 0% | 0% | 1.3 | 12.0 → 12.0 | 13.6 | 5.5 | 1.3 | 28 (max 54) |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · hard · textbook | The Cellars | 0% | 70% | 30% | 0% | 0% | 1.6 | 1.0 → 4.6 | 15.9 | 6.5 | 9.2 | 38 (max 87) |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · dread · textbook | The Cellars | 0% | 68% | 33% | 0% | 0% | 0.8 | 1.0 → 3.0 | 9.1 | 3.5 | 7.3 | 20 (max 57) |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · hard · textbook | The Cellars | 3% | 23% | 75% | 0% | 0% | 1.9 | 1.0 → 5.7 | 22.0 | 9.2 | 9.8 | 53 (max 84) |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · dread · textbook | The Cellars | 0% | 43% | 58% | 0% | 0% | 1.4 | 1.0 → 4.2 | 13.7 | 5.2 | 9.2 | 31 (max 66) |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · hard · textbook | The Cellars | 0% | 75% | 25% | 0% | 0% | 1.7 | 1.0 → 4.7 | 16.5 | 6.4 | 5.4 | 41 (max 83) |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · dread · textbook | The Cellars | 0% | 75% | 25% | 0% | 0% | 1.2 | 1.0 → 3.9 | 10.9 | 4.2 | 5.7 | 25 (max 48) |
| the pair, fresh: blade, mender · Mortal · hard · textbook | The Cellars | 8% | 25% | 68% | 0% | 0% | 2.0 | 1.0 → 6.8 | 21.5 | 9.1 | 7.8 | 52 (max 88) |
| the pair, fresh: blade, mender · Mortal · dread · textbook | The Cellars | 0% | 40% | 60% | 0% | 0% | 1.3 | 1.0 → 4.7 | 13.6 | 5.4 | 5.8 | 30 (max 65) |
| crypt-breakers, levelled (L5, E gear) · Mortal · hard · textbook | The Cellars | 30% | 8% | 63% | 0% | 0% | 2.3 | 5.0 → 7.5 | 24.4 | 10.3 | 7.3 | 60 (max 85) |
| crypt-breakers, levelled (L5, E gear) · Mortal · dread · textbook | The Cellars | 0% | 43% | 58% | 0% | 0% | 1.9 | 5.0 → 6.5 | 19.0 | 7.5 | 8.7 | 46 (max 69) |
| the pair, levelled (L5, E gear) · Mortal · hard · textbook | The Cellars | 23% | 18% | 60% | 0% | 0% | 2.2 | 5.0 → 7.8 | 23.5 | 9.9 | 5.5 | 57 (max 88) |
| the pair, levelled (L5, E gear) · Mortal · dread · textbook | The Cellars | 0% | 40% | 60% | 0% | 0% | 1.7 | 5.0 → 6.9 | 18.1 | 7.5 | 5.1 | 42 (max 69) |
| solo warden, arriving (L5, E gear) · Mortal · hard · textbook | The Crypts | 0% | 13% | 88% | 0% | 0% | 1.3 | 5.0 → 7.4 | 8.8 | 4.0 | 1.7 | 18 (max 46) |
| solo warden, arriving (L5, E gear) · Mortal · dread · textbook | The Crypts | 0% | 8% | 93% | 0% | 0% | 0.4 | 5.0 → 6.8 | 5.9 | 2.7 | 1.6 | 11 (max 31) |
| solo warden, ground (L16, C gear) · Mortal · hard · textbook | The Crypts | 5% | 8% | 88% | 0% | 0% | 2.6 | 16.0 → 16.0 | 13.4 | 5.9 | 1.4 | 30 (max 71) |
| solo warden, ground (L16, C gear) · Mortal · dread · textbook | The Crypts | 0% | 3% | 98% | 0% | 0% | 1.7 | 16.0 → 16.0 | 10.1 | 4.7 | 1.5 | 22 (max 78) |
| classic four, arriving (L5, E gear) · Mortal · hard · textbook | The Crypts | 0% | 48% | 53% | 0% | 0% | 3.0 | 5.0 → 7.0 | 11.9 | 5.2 | 10.9 | 26 (max 60) |
| classic four, arriving (L5, E gear) · Mortal · dread · textbook | The Crypts | 0% | 38% | 63% | 0% | 0% | 0.3 | 5.0 → 5.7 | 5.0 | 2.1 | 7.9 | 10 (max 37) |
| crypt-breakers, arriving (L5, E gear) · Mortal · hard · textbook | The Crypts | 5% | 23% | 73% | 0% | 0% | 4.2 | 5.0 → 8.4 | 19.1 | 8.0 | 8.9 | 50 (max 99) |
| crypt-breakers, arriving (L5, E gear) · Mortal · dread · textbook | The Crypts | 0% | 30% | 70% | 0% | 0% | 1.6 | 5.0 → 6.8 | 8.8 | 4.0 | 8.1 | 20 (max 70) |
| glass cannons, arriving (L5, E gear) · Mortal · hard · textbook | The Crypts | 0% | 75% | 25% | 0% | 0% | 3.8 | 5.0 → 7.4 | 13.2 | 5.5 | 5.5 | 36 (max 66) |
| glass cannons, arriving (L5, E gear) · Mortal · dread · textbook | The Crypts | 0% | 40% | 60% | 0% | 0% | 0.2 | 5.0 → 5.9 | 5.3 | 2.5 | 6.0 | 11 (max 26) |
| the pair, arriving (L5, E gear) · Mortal · hard · textbook | The Crypts | 0% | 33% | 68% | 0% | 0% | 2.6 | 5.0 → 7.7 | 12.2 | 5.3 | 6.0 | 29 (max 86) |
| the pair, arriving (L5, E gear) · Mortal · dread · textbook | The Crypts | 0% | 18% | 83% | 0% | 0% | 0.7 | 5.0 → 6.5 | 7.1 | 3.4 | 5.3 | 15 (max 49) |
| crypt-breakers, ready (L9, D gear) · Mortal · hard · textbook | The Crypts | 35% | 20% | 45% | 0% | 0% | 5.3 | 9.0 → 10.8 | 25.5 | 10.7 | 7.7 | 69 (max 115) |
| crypt-breakers, ready (L9, D gear) · Mortal · dread · textbook | The Crypts | 0% | 30% | 70% | 0% | 0% | 3.0 | 9.0 → 9.5 | 12.8 | 5.8 | 8.3 | 32 (max 66) |
| the pair, ready (L9, D gear) · Mortal · hard · textbook | The Crypts | 10% | 38% | 53% | 0% | 0% | 4.3 | 9.0 → 10.3 | 17.5 | 7.6 | 5.6 | 41 (max 93) |
| the pair, ready (L9, D gear) · Mortal · dread · textbook | The Crypts | 0% | 40% | 60% | 0% | 0% | 2.1 | 9.0 → 9.4 | 10.3 | 4.8 | 5.1 | 24 (max 70) |
| solo warden, arriving (L11, D gear) · Mortal · hard · textbook | The Drowned Vault F7 | 0% | 5% | 95% | 0% | 0% | 0.0 | 11.0 → 11.2 | 3.3 | 1.8 | 1.8 | 4 (max 19) |
| solo warden, arriving (L11, D gear) · Mortal · dread · textbook | The Drowned Vault F7 | 0% | 0% | 100% | 0% | 0% | 0.0 | 11.0 → 11.0 | 2.6 | 1.4 | 1.9 | 3 (max 13) |
| solo warden, ground (L21, B gear) · Mortal · hard · textbook | The Drowned Vault F7 | 8% | 0% | 93% | 0% | 0% | 0.5 | 21.0 → 21.0 | 6.0 | 3.4 | 1.6 | 11 (max 29) |
| solo warden, ground (L21, B gear) · Mortal · dread · textbook | The Drowned Vault F7 | 0% | 8% | 93% | 0% | 0% | 0.0 | 21.0 → 21.0 | 4.8 | 2.6 | 1.7 | 9 (max 29) |
| classic four, arriving (L11, D gear) · Mortal · hard · textbook | The Drowned Vault F7 | 5% | 18% | 78% | 0% | 0% | 0.3 | 11.0 → 11.5 | 7.0 | 3.5 | 9.4 | 14 (max 38) |
| classic four, arriving (L11, D gear) · Mortal · dread · textbook | The Drowned Vault F7 | 0% | 3% | 98% | 0% | 0% | 0.0 | 11.0 → 11.0 | 2.8 | 1.4 | 8.3 | 3 (max 11) |
| crypt-breakers, arriving (L11, D gear) · Mortal · hard · textbook | The Drowned Vault F7 | 3% | 15% | 83% | 0% | 0% | 0.2 | 11.0 → 11.5 | 7.9 | 4.1 | 6.8 | 16 (max 35) |
| crypt-breakers, arriving (L11, D gear) · Mortal · dread · textbook | The Drowned Vault F7 | 0% | 8% | 93% | 0% | 0% | 0.0 | 11.0 → 11.1 | 4.0 | 2.1 | 6.5 | 6 (max 20) |
| glass cannons, arriving (L11, D gear) · Mortal · hard · textbook | The Drowned Vault F7 | 0% | 50% | 50% | 0% | 0% | 0.0 | 11.0 → 11.2 | 5.7 | 3.0 | 4.5 | 13 (max 32) |
| glass cannons, arriving (L11, D gear) · Mortal · dread · textbook | The Drowned Vault F7 | 0% | 23% | 78% | 0% | 0% | 0.0 | 11.0 → 11.0 | 3.5 | 1.8 | 5.7 | 6 (max 18) |
| the pair, arriving (L11, D gear) · Mortal · hard · textbook | The Drowned Vault F7 | 0% | 18% | 83% | 0% | 0% | 0.0 | 11.0 → 11.2 | 4.8 | 2.5 | 4.3 | 9 (max 29) |
| the pair, arriving (L11, D gear) · Mortal · dread · textbook | The Drowned Vault F7 | 0% | 10% | 90% | 0% | 0% | 0.0 | 11.0 → 11.1 | 3.1 | 1.6 | 3.9 | 4 (max 15) |
| crypt-breakers, ready (L14, C gear) · Mortal · hard · textbook | The Drowned Vault F7 | 28% | 10% | 63% | 0% | 0% | 1.9 | 14.0 → 14.2 | 9.4 | 4.7 | 5.0 | 21 (max 41) |
| crypt-breakers, ready (L14, C gear) · Mortal · dread · textbook | The Drowned Vault F7 | 0% | 20% | 80% | 0% | 0% | 0.0 | 14.0 → 14.0 | 5.6 | 3.0 | 6.3 | 11 (max 29) |
| the pair, ready (L14, C gear) · Mortal · hard · textbook | The Drowned Vault F7 | 13% | 18% | 70% | 0% | 0% | 0.9 | 14.0 → 14.2 | 7.2 | 3.7 | 4.1 | 15 (max 32) |
| the pair, ready (L14, C gear) · Mortal · dread · textbook | The Drowned Vault F7 | 0% | 20% | 80% | 0% | 0% | 0.0 | 14.0 → 14.0 | 4.0 | 2.2 | 4.0 | 7 (max 21) |
| solo warden, arriving (L13, D gear) · Mortal · hard · textbook | The Drowned Vault F8 | 0% | 3% | 98% | 0% | 0% | 0.0 | 13.0 → 13.0 | 2.1 | 1.1 | 1.9 | 1 (max 5) |
| solo warden, arriving (L13, D gear) · Mortal · dread · textbook | The Drowned Vault F8 | 0% | 0% | 100% | 0% | 0% | 0.0 | 13.0 → 13.0 | 2.0 | 1.0 | 1.9 | 1 (max 1) |
| solo warden, ground (L21, B gear) · Mortal · hard · textbook | The Drowned Vault F8 | 15% | 3% | 83% | 0% | 0% | 1.2 | 21.0 → 21.0 | 3.6 | 1.8 | 1.6 | 4 (max 7) |
| solo warden, ground (L21, B gear) · Mortal · dread · textbook | The Drowned Vault F8 | 3% | 0% | 98% | 0% | 0% | 0.2 | 21.0 → 21.0 | 2.2 | 1.1 | 1.9 | 1 (max 8) |
| classic four, arriving (L13, D gear) · Mortal · hard · textbook | The Drowned Vault F8 | 5% | 8% | 88% | 0% | 0% | 0.4 | 13.0 → 13.1 | 3.5 | 1.8 | 9.9 | 4 (max 9) |
| classic four, arriving (L13, D gear) · Mortal · dread · textbook | The Drowned Vault F8 | 0% | 5% | 95% | 0% | 0% | 0.0 | 13.0 → 13.0 | 2.1 | 1.1 | 8.1 | 1 (max 5) |
| crypt-breakers, arriving (L13, D gear) · Mortal · hard · textbook | The Drowned Vault F8 | 10% | 0% | 90% | 0% | 0% | 0.8 | 13.0 → 13.1 | 4.0 | 2.0 | 6.2 | 5 (max 8) |
| crypt-breakers, arriving (L13, D gear) · Mortal · dread · textbook | The Drowned Vault F8 | 0% | 0% | 100% | 0% | 0% | 0.0 | 13.0 → 13.0 | 2.1 | 1.1 | 6.2 | 1 (max 5) |
| glass cannons, arriving (L13, D gear) · Mortal · hard · textbook | The Drowned Vault F8 | 5% | 13% | 83% | 0% | 0% | 0.4 | 13.0 → 13.1 | 3.8 | 1.9 | 6.2 | 5 (max 8) |
| glass cannons, arriving (L13, D gear) · Mortal · dread · textbook | The Drowned Vault F8 | 0% | 8% | 93% | 0% | 0% | 0.0 | 13.0 → 13.0 | 2.0 | 1.0 | 5.9 | 1 (max 6) |
| the pair, arriving (L13, D gear) · Mortal · hard · textbook | The Drowned Vault F8 | 5% | 0% | 95% | 0% | 0% | 0.4 | 13.0 → 13.1 | 2.8 | 1.4 | 4.3 | 3 (max 7) |
| the pair, arriving (L13, D gear) · Mortal · dread · textbook | The Drowned Vault F8 | 0% | 0% | 100% | 0% | 0% | 0.0 | 13.0 → 13.0 | 2.0 | 1.0 | 4.0 | 1 (max 5) |
| crypt-breakers, ready (L14, C gear) · Mortal · hard · textbook | The Drowned Vault F8 | 18% | 0% | 83% | 0% | 0% | 1.4 | 14.0 → 14.2 | 4.0 | 2.0 | 5.5 | 5 (max 9) |
| crypt-breakers, ready (L14, C gear) · Mortal · dread · textbook | The Drowned Vault F8 | 0% | 0% | 100% | 0% | 0% | 0.0 | 14.0 → 14.0 | 3.0 | 1.5 | 7.2 | 3 (max 5) |
| the pair, ready (L15, C gear) · Mortal · hard · textbook | The Drowned Vault F8 | 20% | 8% | 73% | 0% | 0% | 1.6 | 15.0 → 15.2 | 3.6 | 1.8 | 4.0 | 5 (max 8) |
| the pair, ready (L15, C gear) · Mortal · dread · textbook | The Drowned Vault F8 | 3% | 3% | 95% | 0% | 0% | 0.2 | 15.0 → 15.0 | 2.9 | 1.4 | 4.3 | 3 (max 8) |
| classic four, fresh, diving into the Crypts (L1) · Mortal · normal · textbook | The Crypts | 27% | 38% | 35% | 0% | 0% | 4.3 | 1.0 → 8.2 | 20.9 | 9.5 | 17.1 | 52 (max 110) |
| classic four, fresh, diving into the Crypts (L1) · Mortal · normal · careful | The Crypts | 0% | 100% | 0% | 0% | 0% | 0.0 | 1.0 → 1.0 | 1.0 | 0.0 | 0.0 | 1 (max 1) |
| classic four, from the Cellars, diving into the Vault (L5, E gear) · Mortal · normal · textbook | The Drowned Vault | 0% | 31% | 69% | 0% | 0% | 0.7 | 5.0 → 7.9 | 6.1 | 3.0 | 9.6 | 12 (max 52) |
| classic four, from the Cellars, diving into the Vault (L5, E gear) · Mortal · normal · careful | The Drowned Vault | 0% | 100% | 0% | 0% | 0% | 0.0 | 5.0 → 5.0 | 1.0 | 0.0 | 0.0 | 1 (max 1) |
| solo warden, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | The Drowned Vault | 0% | 5% | 95% | 0% | 0% | 0.0 | 11.0 → 11.3 | 5.1 | 2.6 | 1.8 | 8 (max 36) |
| solo warden, ground (L21, B gear), F7 to F8 in one delve · Mortal · normal · textbook | The Drowned Vault | 8% | 6% | 86% | 0% | 0% | 3.6 | 21.0 → 21.0 | 10.4 | 5.4 | 1.7 | 22 (max 53) |
| classic four, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | The Drowned Vault | 12% | 20% | 68% | 0% | 0% | 4.6 | 11.0 → 12.5 | 11.8 | 5.7 | 11.3 | 26 (max 54) |
| crypt-breakers, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | The Drowned Vault | 5% | 14% | 81% | 0% | 0% | 2.8 | 11.0 → 12.0 | 11.0 | 5.4 | 7.2 | 25 (max 52) |
| glass cannons, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | The Drowned Vault | 1% | 40% | 59% | 0% | 0% | 1.0 | 11.0 → 11.5 | 8.2 | 4.0 | 5.2 | 18 (max 44) |
| the pair, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | The Drowned Vault | 9% | 10% | 81% | 0% | 0% | 2.2 | 11.0 → 12.4 | 9.8 | 4.9 | 4.9 | 21 (max 47) |
| crypt-breakers, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook | The Drowned Vault | 33% | 14% | 53% | 0% | 0% | 6.8 | 14.0 → 14.7 | 13.6 | 6.6 | 5.9 | 32 (max 55) |
| the pair, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook | The Drowned Vault | 31% | 14% | 55% | 0% | 0% | 5.5 | 14.0 → 15.1 | 12.3 | 6.0 | 4.2 | 28 (max 53) |

## 2. Deaths per delve (D-088, D-095; reported, not judged until James sets targets)

| Recipe | Deaths / delve | Delves with a death | Raised in the dungeon / delve | Carried home dead / delve | Lost for good / delve | Delves losing a hero for good | Nightmare: the save ends |
|---|---|---|---|---|---|---|---|
| solo warden, fresh · Sheltered · normal · textbook | 0.84 | 84% | 0.00 | 0.00 | 0.00 | 0% | - |
| solo warden, fresh · Mortal · normal · textbook | 0.84 | 84% | 0.00 | 0.00 | 0.84 | 84% | - |
| solo warden, fresh · Nightmare · normal · textbook | 0.84 | 84% | 0.00 | 0.00 | 0.84 | 84% | 84% |
| solo warden, ground (L12, D gear) · Sheltered · normal · textbook | 0.29 | 29% | 0.00 | 0.00 | 0.00 | 0% | - |
| solo warden, ground (L12, D gear) · Mortal · normal · textbook | 0.29 | 29% | 0.00 | 0.00 | 0.29 | 29% | - |
| solo warden, ground (L12, D gear) · Nightmare · normal · textbook | 0.29 | 29% | 0.00 | 0.00 | 0.29 | 29% | 29% |
| classic four, fresh: warden, blade, mender, arcanist · Sheltered · normal · textbook | 1.72 | 54% | 0.00 | 0.00 | 0.00 | 0% | - |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · textbook | 1.29 | 57% | 0.00 | 0.17 | 1.60 | 40% | - |
| classic four, fresh: warden, blade, mender, arcanist · Nightmare · normal · textbook | 1.03 | 40% | 0.00 | 0.64 | 0.84 | 21% | 54% |
| crypt-breakers, fresh: mender, warden, ranger · Sheltered · normal · textbook | 2.11 | 74% | 0.00 | 0.00 | 0.00 | 0% | - |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · textbook | 1.87 | 74% | 0.00 | 0.14 | 1.80 | 60% | - |
| crypt-breakers, fresh: mender, warden, ranger · Nightmare · normal · textbook | 1.84 | 72% | 0.00 | 0.20 | 1.71 | 57% | 60% |
| glass cannons, fresh: arcanist, shade, ranger · Sheltered · normal · textbook | 1.78 | 63% | 0.00 | 0.00 | 0.00 | 0% | - |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · textbook | 1.40 | 64% | 0.00 | 0.22 | 1.38 | 46% | - |
| glass cannons, fresh: arcanist, shade, ranger · Nightmare · normal · textbook | 1.31 | 56% | 0.00 | 0.40 | 1.11 | 37% | 49% |
| the pair, fresh: blade, mender · Sheltered · normal · textbook | 1.37 | 71% | 0.00 | 0.00 | 0.00 | 0% | - |
| the pair, fresh: blade, mender · Mortal · normal · textbook | 1.25 | 72% | 0.00 | 0.07 | 1.30 | 65% | - |
| the pair, fresh: blade, mender · Nightmare · normal · textbook | 1.22 | 69% | 0.00 | 0.10 | 1.24 | 62% | 66% |
| crypt-breakers, levelled (L5, E gear) · Sheltered · normal · textbook | 0.39 | 15% | 0.00 | 0.00 | 0.00 | 0% | - |
| crypt-breakers, levelled (L5, E gear) · Mortal · normal · textbook | 0.41 | 17% | 0.00 | 0.03 | 0.42 | 14% | - |
| crypt-breakers, levelled (L5, E gear) · Nightmare · normal · textbook | 0.39 | 15% | 0.00 | 0.07 | 0.36 | 12% | 14% |
| the pair, levelled (L5, E gear) · Sheltered · normal · textbook | 0.53 | 29% | 0.00 | 0.00 | 0.00 | 0% | - |
| the pair, levelled (L5, E gear) · Mortal · normal · textbook | 0.53 | 32% | 0.00 | 0.05 | 0.56 | 28% | - |
| the pair, levelled (L5, E gear) · Nightmare · normal · textbook | 0.52 | 31% | 0.00 | 0.06 | 0.54 | 27% | 28% |
| solo warden, arriving (L5, E gear) · Sheltered · normal · textbook | 0.88 | 88% | 0.00 | 0.00 | 0.00 | 0% | - |
| solo warden, arriving (L5, E gear) · Mortal · normal · textbook | 0.88 | 88% | 0.00 | 0.00 | 0.88 | 88% | - |
| solo warden, arriving (L5, E gear) · Nightmare · normal · textbook | 0.88 | 88% | 0.00 | 0.00 | 0.88 | 88% | 88% |
| solo warden, ground (L16, C gear) · Sheltered · normal · textbook | 0.33 | 33% | 0.00 | 0.00 | 0.00 | 0% | - |
| solo warden, ground (L16, C gear) · Mortal · normal · textbook | 0.33 | 33% | 0.00 | 0.00 | 0.33 | 33% | - |
| solo warden, ground (L16, C gear) · Nightmare · normal · textbook | 0.33 | 33% | 0.00 | 0.00 | 0.33 | 33% | 33% |
| classic four, arriving (L5, E gear) · Sheltered · normal · textbook | 1.50 | 50% | 0.00 | 0.00 | 0.00 | 0% | - |
| classic four, arriving (L5, E gear) · Mortal · normal · textbook | 1.31 | 50% | 0.02 | 0.26 | 1.04 | 26% | - |
| classic four, arriving (L5, E gear) · Nightmare · normal · textbook | 1.27 | 50% | 0.00 | 0.28 | 1.00 | 25% | 49% |
| crypt-breakers, arriving (L5, E gear) · Sheltered · normal · textbook | 1.50 | 53% | 0.00 | 0.00 | 0.00 | 0% | - |
| crypt-breakers, arriving (L5, E gear) · Mortal · normal · textbook | 1.43 | 53% | 0.00 | 0.08 | 1.35 | 45% | - |
| crypt-breakers, arriving (L5, E gear) · Nightmare · normal · textbook | 1.41 | 53% | 0.00 | 0.09 | 1.32 | 44% | 47% |
| glass cannons, arriving (L5, E gear) · Sheltered · normal · textbook | 1.03 | 41% | 0.00 | 0.00 | 0.00 | 0% | - |
| glass cannons, arriving (L5, E gear) · Mortal · normal · textbook | 0.89 | 41% | 0.00 | 0.26 | 0.66 | 22% | - |
| glass cannons, arriving (L5, E gear) · Nightmare · normal · textbook | 0.88 | 41% | 0.00 | 0.28 | 0.63 | 21% | 33% |
| the pair, arriving (L5, E gear) · Sheltered · normal · textbook | 1.59 | 77% | 0.00 | 0.00 | 0.00 | 0% | - |
| the pair, arriving (L5, E gear) · Mortal · normal · textbook | 1.37 | 77% | 0.00 | 0.17 | 1.20 | 60% | - |
| the pair, arriving (L5, E gear) · Nightmare · normal · textbook | 1.37 | 77% | 0.00 | 0.17 | 1.20 | 60% | 76% |
| crypt-breakers, ready (L9, D gear) · Sheltered · normal · textbook | 0.83 | 32% | 0.00 | 0.00 | 0.00 | 0% | - |
| crypt-breakers, ready (L9, D gear) · Mortal · normal · textbook | 0.82 | 32% | 0.00 | 0.07 | 0.75 | 25% | - |
| crypt-breakers, ready (L9, D gear) · Nightmare · normal · textbook | 0.80 | 32% | 0.00 | 0.08 | 0.72 | 24% | 26% |
| the pair, ready (L9, D gear) · Sheltered · normal · textbook | 1.05 | 53% | 0.00 | 0.00 | 0.00 | 0% | - |
| the pair, ready (L9, D gear) · Mortal · normal · textbook | 1.02 | 53% | 0.00 | 0.04 | 0.98 | 49% | - |
| the pair, ready (L9, D gear) · Nightmare · normal · textbook | 1.00 | 53% | 0.00 | 0.06 | 0.94 | 47% | 53% |
| solo warden, arriving (L11, D gear) · Sheltered · normal · textbook | 0.95 | 95% | 0.00 | 0.00 | 0.00 | 0% | - |
| solo warden, arriving (L11, D gear) · Mortal · normal · textbook | 0.95 | 95% | 0.00 | 0.00 | 0.95 | 95% | - |
| solo warden, arriving (L11, D gear) · Nightmare · normal · textbook | 0.95 | 95% | 0.00 | 0.00 | 0.95 | 95% | 95% |
| solo warden, ground (L21, B gear) · Sheltered · normal · textbook | 0.45 | 45% | 0.00 | 0.00 | 0.00 | 0% | - |
| solo warden, ground (L21, B gear) · Mortal · normal · textbook | 0.45 | 45% | 0.00 | 0.00 | 0.45 | 45% | - |
| solo warden, ground (L21, B gear) · Nightmare · normal · textbook | 0.45 | 45% | 0.00 | 0.00 | 0.45 | 45% | 45% |
| classic four, arriving (L11, D gear) · Sheltered · normal · textbook | 1.21 | 38% | 0.00 | 0.00 | 0.00 | 0% | - |
| classic four, arriving (L11, D gear) · Mortal · normal · textbook | 1.14 | 38% | 0.00 | 0.15 | 1.00 | 25% | - |
| classic four, arriving (L11, D gear) · Nightmare · normal · textbook | 1.08 | 37% | 0.00 | 0.17 | 0.92 | 23% | 36% |
| crypt-breakers, arriving (L11, D gear) · Sheltered · normal · textbook | 1.94 | 66% | 0.00 | 0.00 | 0.00 | 0% | - |
| crypt-breakers, arriving (L11, D gear) · Mortal · normal · textbook | 1.74 | 66% | 0.00 | 0.14 | 1.62 | 54% | - |
| crypt-breakers, arriving (L11, D gear) · Nightmare · normal · textbook | 1.72 | 65% | 0.00 | 0.18 | 1.56 | 52% | 65% |
| glass cannons, arriving (L11, D gear) · Sheltered · normal · textbook | 2.13 | 71% | 0.00 | 0.00 | 0.00 | 0% | - |
| glass cannons, arriving (L11, D gear) · Mortal · normal · textbook | 1.80 | 70% | 0.00 | 0.22 | 1.65 | 55% | - |
| glass cannons, arriving (L11, D gear) · Nightmare · normal · textbook | 1.80 | 70% | 0.00 | 0.22 | 1.65 | 55% | 63% |
| the pair, arriving (L11, D gear) · Sheltered · normal · textbook | 1.35 | 67% | 0.00 | 0.00 | 0.00 | 0% | - |
| the pair, arriving (L11, D gear) · Mortal · normal · textbook | 1.28 | 67% | 0.00 | 0.06 | 1.22 | 61% | - |
| the pair, arriving (L11, D gear) · Nightmare · normal · textbook | 1.27 | 67% | 0.00 | 0.07 | 1.20 | 60% | 67% |
| crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook | 0.23 | 13% | 0.00 | 0.00 | 0.00 | 0% | - |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook | 0.23 | 13% | 0.00 | 0.11 | 0.12 | 4% | - |
| crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook | 0.23 | 13% | 0.00 | 0.11 | 0.12 | 4% | 13% |
| the pair, ready (L14, C gear) · Sheltered · normal · textbook | 0.50 | 27% | 0.00 | 0.00 | 0.00 | 0% | - |
| the pair, ready (L14, C gear) · Mortal · normal · textbook | 0.49 | 26% | 0.00 | 0.04 | 0.46 | 23% | - |
| the pair, ready (L14, C gear) · Nightmare · normal · textbook | 0.48 | 26% | 0.00 | 0.05 | 0.44 | 22% | 27% |
| solo warden, arriving (L13, D gear) · Sheltered · normal · textbook | 0.93 | 93% | 0.00 | 0.00 | 0.00 | 0% | - |
| solo warden, arriving (L13, D gear) · Mortal · normal · textbook | 0.93 | 93% | 0.00 | 0.00 | 0.93 | 93% | - |
| solo warden, arriving (L13, D gear) · Nightmare · normal · textbook | 0.93 | 93% | 0.00 | 0.00 | 0.93 | 93% | 93% |
| solo warden, ground (L21, B gear) · Sheltered · normal · textbook | 0.46 | 46% | 0.00 | 0.00 | 0.00 | 0% | - |
| solo warden, ground (L21, B gear) · Mortal · normal · textbook | 0.46 | 46% | 0.00 | 0.00 | 0.46 | 46% | - |
| solo warden, ground (L21, B gear) · Nightmare · normal · textbook | 0.46 | 46% | 0.00 | 0.00 | 0.46 | 46% | 46% |
| classic four, arriving (L13, D gear) · Sheltered · normal · textbook | 2.26 | 58% | 0.00 | 0.00 | 0.00 | 0% | - |
| classic four, arriving (L13, D gear) · Mortal · normal · textbook | 2.26 | 58% | 0.00 | 0.02 | 2.24 | 56% | - |
| classic four, arriving (L13, D gear) · Nightmare · normal · textbook | 2.26 | 58% | 0.00 | 0.02 | 2.24 | 56% | 58% |
| crypt-breakers, arriving (L13, D gear) · Sheltered · normal · textbook | 1.59 | 53% | 0.00 | 0.00 | 0.00 | 0% | - |
| crypt-breakers, arriving (L13, D gear) · Mortal · normal · textbook | 1.59 | 53% | 0.00 | 0.00 | 1.59 | 53% | - |
| crypt-breakers, arriving (L13, D gear) · Nightmare · normal · textbook | 1.59 | 53% | 0.00 | 0.00 | 1.59 | 53% | 53% |
| glass cannons, arriving (L13, D gear) · Sheltered · normal · textbook | 1.76 | 60% | 0.00 | 0.00 | 0.00 | 0% | - |
| glass cannons, arriving (L13, D gear) · Mortal · normal · textbook | 1.76 | 60% | 0.00 | 0.02 | 1.74 | 58% | - |
| glass cannons, arriving (L13, D gear) · Nightmare · normal · textbook | 1.76 | 60% | 0.00 | 0.02 | 1.74 | 58% | 58% |
| the pair, arriving (L13, D gear) · Sheltered · normal · textbook | 1.25 | 62% | 0.00 | 0.00 | 0.00 | 0% | - |
| the pair, arriving (L13, D gear) · Mortal · normal · textbook | 1.21 | 61% | 0.00 | 0.03 | 1.20 | 60% | - |
| the pair, arriving (L13, D gear) · Nightmare · normal · textbook | 1.21 | 61% | 0.00 | 0.03 | 1.20 | 60% | 63% |
| crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook | 1.19 | 41% | 0.00 | 0.00 | 0.00 | 0% | - |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook | 1.19 | 41% | 0.00 | 0.02 | 1.17 | 39% | - |
| crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook | 1.19 | 41% | 0.00 | 0.02 | 1.17 | 39% | 40% |
| the pair, ready (L15, C gear) · Sheltered · normal · textbook | 0.57 | 29% | 0.00 | 0.00 | 0.00 | 0% | - |
| the pair, ready (L15, C gear) · Mortal · normal · textbook | 0.57 | 29% | 0.00 | 0.01 | 0.56 | 28% | - |
| the pair, ready (L15, C gear) · Nightmare · normal · textbook | 0.57 | 29% | 0.00 | 0.01 | 0.56 | 28% | 29% |
| solo warden, fresh · Mortal · normal · careful | 0.81 | 81% | 0.00 | 0.00 | 0.81 | 81% | - |
| solo warden, ground (L12, D gear) · Mortal · normal · careful | 0.29 | 29% | 0.00 | 0.00 | 0.29 | 29% | - |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · careful | 0.96 | 43% | 0.00 | 0.14 | 1.16 | 29% | - |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · careful | 1.07 | 45% | 0.00 | 0.12 | 0.99 | 33% | - |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · careful | 0.84 | 39% | 0.00 | 0.15 | 0.81 | 27% | - |
| the pair, fresh: blade, mender · Mortal · normal · careful | 1.09 | 62% | 0.00 | 0.07 | 1.10 | 55% | - |
| crypt-breakers, levelled (L5, E gear) · Mortal · normal · careful | 0.41 | 17% | 0.00 | 0.03 | 0.42 | 14% | - |
| the pair, levelled (L5, E gear) · Mortal · normal · careful | 0.53 | 32% | 0.00 | 0.05 | 0.56 | 28% | - |
| solo warden, arriving (L5, E gear) · Mortal · normal · careful | 0.88 | 88% | 0.00 | 0.00 | 0.88 | 88% | - |
| solo warden, ground (L16, C gear) · Mortal · normal · careful | 0.33 | 33% | 0.00 | 0.00 | 0.33 | 33% | - |
| classic four, arriving (L5, E gear) · Mortal · normal · careful | 0.95 | 41% | 0.02 | 0.26 | 0.68 | 17% | - |
| crypt-breakers, arriving (L5, E gear) · Mortal · normal · careful | 1.08 | 40% | 0.00 | 0.06 | 1.02 | 34% | - |
| glass cannons, arriving (L5, E gear) · Mortal · normal · careful | 0.63 | 31% | 0.00 | 0.24 | 0.42 | 14% | - |
| the pair, arriving (L5, E gear) · Mortal · normal · careful | 1.25 | 71% | 0.00 | 0.17 | 1.08 | 54% | - |
| crypt-breakers, ready (L9, D gear) · Mortal · normal · careful | 0.82 | 32% | 0.00 | 0.07 | 0.75 | 25% | - |
| the pair, ready (L9, D gear) · Mortal · normal · careful | 1.02 | 53% | 0.00 | 0.04 | 0.98 | 49% | - |
| solo warden, arriving (L11, D gear) · Mortal · normal · careful | 0.95 | 95% | 0.00 | 0.00 | 0.95 | 95% | - |
| solo warden, ground (L21, B gear) · Mortal · normal · careful | 0.45 | 45% | 0.00 | 0.00 | 0.45 | 45% | - |
| classic four, arriving (L11, D gear) · Mortal · normal · careful | 1.14 | 38% | 0.00 | 0.15 | 1.00 | 25% | - |
| crypt-breakers, arriving (L11, D gear) · Mortal · normal · careful | 1.74 | 66% | 0.00 | 0.14 | 1.62 | 54% | - |
| glass cannons, arriving (L11, D gear) · Mortal · normal · careful | 1.80 | 70% | 0.00 | 0.22 | 1.65 | 55% | - |
| the pair, arriving (L11, D gear) · Mortal · normal · careful | 1.28 | 67% | 0.00 | 0.06 | 1.22 | 61% | - |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · careful | 0.23 | 13% | 0.00 | 0.11 | 0.12 | 4% | - |
| the pair, ready (L14, C gear) · Mortal · normal · careful | 0.49 | 26% | 0.00 | 0.04 | 0.46 | 23% | - |
| solo warden, arriving (L13, D gear) · Mortal · normal · careful | 0.93 | 93% | 0.00 | 0.00 | 0.93 | 93% | - |
| solo warden, ground (L21, B gear) · Mortal · normal · careful | 0.46 | 46% | 0.00 | 0.00 | 0.46 | 46% | - |
| classic four, arriving (L13, D gear) · Mortal · normal · careful | 2.26 | 58% | 0.00 | 0.02 | 2.24 | 56% | - |
| crypt-breakers, arriving (L13, D gear) · Mortal · normal · careful | 1.59 | 53% | 0.00 | 0.00 | 1.59 | 53% | - |
| glass cannons, arriving (L13, D gear) · Mortal · normal · careful | 1.76 | 60% | 0.00 | 0.02 | 1.74 | 58% | - |
| the pair, arriving (L13, D gear) · Mortal · normal · careful | 1.21 | 61% | 0.00 | 0.03 | 1.20 | 60% | - |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · careful | 1.19 | 41% | 0.00 | 0.02 | 1.17 | 39% | - |
| the pair, ready (L15, C gear) · Mortal · normal · careful | 0.57 | 29% | 0.00 | 0.01 | 0.56 | 28% | - |
| solo warden, fresh · Mortal · hard · textbook | 0.95 | 95% | 0.00 | 0.00 | 0.95 | 95% | - |
| solo warden, fresh · Mortal · dread · textbook | 0.80 | 80% | 0.00 | 0.00 | 0.80 | 80% | - |
| solo warden, ground (L12, D gear) · Mortal · hard · textbook | 0.63 | 63% | 0.00 | 0.00 | 0.63 | 63% | - |
| solo warden, ground (L12, D gear) · Mortal · dread · textbook | 0.70 | 70% | 0.00 | 0.00 | 0.70 | 70% | - |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · hard · textbook | 1.90 | 98% | 0.00 | 0.78 | 1.20 | 30% | - |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · dread · textbook | 2.02 | 98% | 0.00 | 0.80 | 1.30 | 33% | - |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · hard · textbook | 2.17 | 88% | 0.00 | 0.23 | 2.25 | 75% | - |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · dread · textbook | 2.15 | 95% | 0.00 | 0.42 | 1.73 | 58% | - |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · hard · textbook | 0.95 | 48% | 0.00 | 0.25 | 0.75 | 25% | - |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · dread · textbook | 1.13 | 58% | 0.00 | 0.38 | 0.75 | 25% | - |
| the pair, fresh: blade, mender · Mortal · hard · textbook | 1.38 | 83% | 0.00 | 0.17 | 1.35 | 68% | - |
| the pair, fresh: blade, mender · Mortal · dread · textbook | 1.38 | 80% | 0.00 | 0.25 | 1.20 | 60% | - |
| crypt-breakers, levelled (L5, E gear) · Mortal · hard · textbook | 1.85 | 73% | 0.00 | 0.13 | 1.88 | 63% | - |
| crypt-breakers, levelled (L5, E gear) · Mortal · dread · textbook | 2.15 | 95% | 0.00 | 0.47 | 1.73 | 58% | - |
| the pair, levelled (L5, E gear) · Mortal · hard · textbook | 1.25 | 75% | 0.00 | 0.20 | 1.20 | 60% | - |
| the pair, levelled (L5, E gear) · Mortal · dread · textbook | 1.38 | 78% | 0.00 | 0.17 | 1.20 | 60% | - |
| solo warden, arriving (L5, E gear) · Mortal · hard · textbook | 0.88 | 88% | 0.00 | 0.00 | 0.88 | 88% | - |
| solo warden, arriving (L5, E gear) · Mortal · dread · textbook | 0.93 | 93% | 0.00 | 0.00 | 0.93 | 93% | - |
| solo warden, ground (L16, C gear) · Mortal · hard · textbook | 0.88 | 88% | 0.00 | 0.00 | 0.88 | 88% | - |
| solo warden, ground (L16, C gear) · Mortal · dread · textbook | 0.97 | 98% | 0.00 | 0.00 | 0.97 | 98% | - |
| classic four, arriving (L5, E gear) · Mortal · hard · textbook | 2.70 | 98% | 0.00 | 0.60 | 2.10 | 53% | - |
| classic four, arriving (L5, E gear) · Mortal · dread · textbook | 2.98 | 95% | 0.00 | 0.53 | 2.50 | 63% | - |
| crypt-breakers, arriving (L5, E gear) · Mortal · hard · textbook | 2.42 | 95% | 0.00 | 0.25 | 2.17 | 73% | - |
| crypt-breakers, arriving (L5, E gear) · Mortal · dread · textbook | 2.35 | 98% | 0.00 | 0.28 | 2.10 | 70% | - |
| glass cannons, arriving (L5, E gear) · Mortal · hard · textbook | 1.10 | 58% | 0.00 | 0.35 | 0.75 | 25% | - |
| glass cannons, arriving (L5, E gear) · Mortal · dread · textbook | 2.05 | 85% | 0.00 | 0.30 | 1.80 | 60% | - |
| the pair, arriving (L5, E gear) · Mortal · hard · textbook | 1.60 | 93% | 0.00 | 0.25 | 1.35 | 68% | - |
| the pair, arriving (L5, E gear) · Mortal · dread · textbook | 1.73 | 95% | 0.00 | 0.15 | 1.65 | 83% | - |
| crypt-breakers, ready (L9, D gear) · Mortal · hard · textbook | 1.50 | 60% | 0.00 | 0.15 | 1.35 | 45% | - |
| crypt-breakers, ready (L9, D gear) · Mortal · dread · textbook | 2.38 | 98% | 0.00 | 0.28 | 2.10 | 70% | - |
| the pair, ready (L9, D gear) · Mortal · hard · textbook | 1.32 | 83% | 0.00 | 0.35 | 1.05 | 53% | - |
| the pair, ready (L9, D gear) · Mortal · dread · textbook | 1.57 | 98% | 0.00 | 0.40 | 1.20 | 60% | - |
| solo warden, arriving (L11, D gear) · Mortal · hard · textbook | 0.95 | 95% | 0.00 | 0.00 | 0.95 | 95% | - |
| solo warden, arriving (L11, D gear) · Mortal · dread · textbook | 1.00 | 100% | 0.00 | 0.00 | 1.00 | 100% | - |
| solo warden, ground (L21, B gear) · Mortal · hard · textbook | 0.93 | 93% | 0.00 | 0.00 | 0.93 | 93% | - |
| solo warden, ground (L21, B gear) · Mortal · dread · textbook | 0.93 | 93% | 0.00 | 0.00 | 0.93 | 93% | - |
| classic four, arriving (L11, D gear) · Mortal · hard · textbook | 3.30 | 95% | 0.00 | 0.20 | 3.10 | 78% | - |
| classic four, arriving (L11, D gear) · Mortal · dread · textbook | 3.92 | 100% | 0.00 | 0.03 | 3.90 | 98% | - |
| crypt-breakers, arriving (L11, D gear) · Mortal · hard · textbook | 2.63 | 93% | 0.00 | 0.15 | 2.48 | 83% | - |
| crypt-breakers, arriving (L11, D gear) · Mortal · dread · textbook | 2.83 | 98% | 0.00 | 0.05 | 2.77 | 93% | - |
| glass cannons, arriving (L11, D gear) · Mortal · hard · textbook | 1.75 | 73% | 0.00 | 0.25 | 1.50 | 50% | - |
| glass cannons, arriving (L11, D gear) · Mortal · dread · textbook | 2.52 | 90% | 0.00 | 0.25 | 2.33 | 78% | - |
| the pair, arriving (L11, D gear) · Mortal · hard · textbook | 1.82 | 100% | 0.00 | 0.17 | 1.65 | 83% | - |
| the pair, arriving (L11, D gear) · Mortal · dread · textbook | 1.90 | 100% | 0.00 | 0.10 | 1.80 | 90% | - |
| crypt-breakers, ready (L14, C gear) · Mortal · hard · textbook | 2.02 | 78% | 0.00 | 0.15 | 1.88 | 63% | - |
| crypt-breakers, ready (L14, C gear) · Mortal · dread · textbook | 2.55 | 95% | 0.00 | 0.20 | 2.40 | 80% | - |
| the pair, ready (L14, C gear) · Mortal · hard · textbook | 1.57 | 88% | 0.00 | 0.17 | 1.40 | 70% | - |
| the pair, ready (L14, C gear) · Mortal · dread · textbook | 1.80 | 100% | 0.00 | 0.20 | 1.60 | 80% | - |
| solo warden, arriving (L13, D gear) · Mortal · hard · textbook | 0.97 | 98% | 0.00 | 0.00 | 0.97 | 98% | - |
| solo warden, arriving (L13, D gear) · Mortal · dread · textbook | 1.00 | 100% | 0.00 | 0.00 | 1.00 | 100% | - |
| solo warden, ground (L21, B gear) · Mortal · hard · textbook | 0.82 | 83% | 0.00 | 0.00 | 0.82 | 83% | - |
| solo warden, ground (L21, B gear) · Mortal · dread · textbook | 0.97 | 98% | 0.00 | 0.00 | 0.97 | 98% | - |
| classic four, arriving (L13, D gear) · Mortal · hard · textbook | 3.52 | 90% | 0.00 | 0.07 | 3.50 | 88% | - |
| classic four, arriving (L13, D gear) · Mortal · dread · textbook | 3.83 | 98% | 0.00 | 0.07 | 3.80 | 95% | - |
| crypt-breakers, arriving (L13, D gear) · Mortal · hard · textbook | 2.70 | 90% | 0.00 | 0.00 | 2.70 | 90% | - |
| crypt-breakers, arriving (L13, D gear) · Mortal · dread · textbook | 3.00 | 100% | 0.00 | 0.00 | 3.00 | 100% | - |
| glass cannons, arriving (L13, D gear) · Mortal · hard · textbook | 2.55 | 90% | 0.00 | 0.17 | 2.48 | 83% | - |
| glass cannons, arriving (L13, D gear) · Mortal · dread · textbook | 2.80 | 95% | 0.00 | 0.07 | 2.77 | 93% | - |
| the pair, arriving (L13, D gear) · Mortal · hard · textbook | 1.90 | 95% | 0.00 | 0.00 | 1.90 | 95% | - |
| the pair, arriving (L13, D gear) · Mortal · dread · textbook | 2.00 | 100% | 0.00 | 0.00 | 2.00 | 100% | - |
| crypt-breakers, ready (L14, C gear) · Mortal · hard · textbook | 2.48 | 83% | 0.00 | 0.00 | 2.48 | 83% | - |
| crypt-breakers, ready (L14, C gear) · Mortal · dread · textbook | 3.00 | 100% | 0.00 | 0.00 | 3.00 | 100% | - |
| the pair, ready (L15, C gear) · Mortal · hard · textbook | 1.50 | 78% | 0.00 | 0.07 | 1.45 | 73% | - |
| the pair, ready (L15, C gear) · Mortal · dread · textbook | 1.93 | 98% | 0.00 | 0.03 | 1.90 | 95% | - |
| classic four, fresh, diving into the Crypts (L1) · Mortal · normal · textbook | 1.90 | 74% | 0.00 | 0.50 | 1.40 | 35% | - |
| classic four, fresh, diving into the Crypts (L1) · Mortal · normal · careful | 0.00 | 0% | 0.00 | 0.00 | 0.00 | 0% | - |
| classic four, from the Cellars, diving into the Vault (L5, E gear) · Mortal · normal · textbook | 3.15 | 98% | 0.00 | 0.44 | 2.76 | 69% | - |
| classic four, from the Cellars, diving into the Vault (L5, E gear) · Mortal · normal · careful | 0.00 | 0% | 0.00 | 0.00 | 0.00 | 0% | - |
| solo warden, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 0.95 | 95% | 0.00 | 0.00 | 0.95 | 95% | - |
| solo warden, ground (L21, B gear), F7 to F8 in one delve · Mortal · normal · textbook | 0.86 | 86% | 0.00 | 0.00 | 0.86 | 86% | - |
| classic four, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 2.88 | 83% | 0.00 | 0.17 | 2.72 | 68% | - |
| crypt-breakers, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 2.56 | 94% | 0.00 | 0.15 | 2.43 | 81% | - |
| glass cannons, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 1.95 | 76% | 0.00 | 0.25 | 1.77 | 59% | - |
| the pair, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 1.68 | 87% | 0.00 | 0.07 | 1.62 | 81% | - |
| crypt-breakers, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook | 1.70 | 62% | 0.00 | 0.11 | 1.59 | 53% | - |
| the pair, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook | 1.16 | 61% | 0.00 | 0.10 | 1.10 | 55% | - |

*Under Sheltered nobody dies: its "deaths" are the falls Mortal would turn into deaths.*

## 3. Per floor (07 §8.2)

*Every arrival on a floor by every recipe of that party size, all death rules pooled; "arrivals" counts the delves that stood on the floor. The band is the floor's threat chip for the party on arrival (D-092). Gold is what was found on the floor; its target is `07` §2.3's.*

### normal · textbook

**3a. Exploration**

| Floor | Party size | Arrivals | Party level | Band on arrival (easy / even / dangerous / deadly %) | Rooms (min–max) | Visited | Straight-line hops | Fights (elites) | Ticks to the stairs | Hunter (% of arrivals, room) | Ambushed: party / monsters (% of fights) | Traps revealed / triggered / disarmed | Key and Lock (extra ticks) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F1 | 1 | 600 | 6.5 | 50 / 50 / 0 / 0 | 6.8 (5–8) | 6.6 | 4.9 | 2.5 (0.3) | 15 | 0% | 22% / 31% | 1.4 / 0.6 / 0.9 | 24% (+2 ticks) |
| F1 | 2 | 600 | 3.0 | 50 / 50 / 0 / 0 | 6.8 (5–8) | 6.7 | 4.9 | 2.5 (0.3) | 14 | 0% | 22% / 29% | 1.5 / 0.6 / 0.9 | 24% (+2 ticks) |
| F1 | 3 | 900 | 2.3 | 33 / 67 / 0 / 0 | 6.8 (5–8) | 6.7 | 4.9 | 2.5 (0.3) | 15 | 0% | 15% / 36% | 1.5 / 0.5 / 1.0 | 24% (+2 ticks) |
| F1 | 4 | 300 | 1.0 | 0 / 100 / 0 / 0 | 6.8 (5–8) | 6.7 | 4.9 | 2.5 (0.3) | 17 | 0% | 19% / 26% | 1.4 / 0.5 / 0.9 | 24% (+1 ticks) |
| F2 | 1 | 573 | 7.7 | 65 / 35 / 0 / 0 | 9.0 (8–11) | 8.4 | 5.6 | 2.8 (0.4) | 22 | 3% (room 8.0) | 26% / 21% | 2.1 / 0.8 / 1.2 | 34% (+0 ticks) |
| F2 | 2 | 600 | 3.8 | 51 / 50 / 0 / 0 | 9.0 (8–11) | 8.8 | 5.6 | 2.9 (0.4) | 23 | 1% (room 11.0) | 25% / 26% | 2.3 / 1.0 / 1.3 | 33% (+2 ticks) |
| F2 | 3 | 897 | 3.1 | 33 / 67 / 0 / 0 | 9.0 (8–11) | 8.7 | 5.6 | 2.8 (0.4) | 23 | 3% (room 9.8) | 17% / 34% | 2.2 / 0.6 / 1.5 | 33% (+1 ticks) |
| F2 | 4 | 298 | 2.1 | 0 / 100 / 0 / 0 | 9.0 (8–11) | 8.8 | 5.6 | 2.9 (0.4) | 27 | 9% (room 9.3) | 21% / 29% | 2.3 / 0.9 / 1.4 | 33% (−1 ticks) |
| F3 | 1 | 489 | 9.2 | 66 / 34 / 1 / 0 | 9.9 (8–12) | 8.4 | 6.1 | 5.1 (0.4) | 64 | 0% | 18% / 19% | 1.4 / 1.0 / 0.8 | 33% (+7 ticks) |
| F3 | 2 | 594 | 4.9 | 34 / 66 / 0 / 0 | 10.0 (8–12) | 8.9 | 6.1 | 5.1 (0.4) | 46 | 0% | 16% / 21% | 1.5 / 1.2 / 0.8 | 33% (+3 ticks) |
| F3 | 3 | 869 | 4.3 | 13 / 84 / 2 / 0 | 10.0 (8–12) | 8.4 | 6.1 | 4.8 (0.4) | 43 | 0% | 12% / 28% | 1.9 / 0.6 / 1.3 | 33% (+7 ticks) |
| F3 | 4 | 294 | 3.8 | 2 / 94 / 4 / 0 | 10.0 (8–12) | 8.8 | 6.2 | 5.1 (0.4) | 54 | 0% | 13% / 23% | 1.9 / 0.6 / 1.1 | 34% (+6 ticks) |
| F4 | 1 | 600 | 10.5 | 50 / 50 / 0 / 0 | 9.7 (9–13) | 9.3 | 6.0 | 4.2 (0.6) | 32 | 27% (room 9.6) | 6% / 25% | 0.1 / 2.2 / 0.0 | 27% (−3 ticks) |
| F4 | 2 | 600 | 7.0 | 50 / 50 / 0 / 0 | 9.7 (9–13) | 9.5 | 6.0 | 4.2 (0.5) | 30 | 20% (room 9.9) | 6% / 31% | 0.1 / 2.3 / 0.0 | 27% (+0 ticks) |
| F4 | 3 | 900 | 6.3 | 33 / 67 / 0 / 0 | 9.7 (9–13) | 9.6 | 6.0 | 4.3 (0.6) | 35 | 33% (room 9.5) | 2% / 40% | 2.4 / 0.9 / 1.5 | 27% (−3 ticks) |
| F4 | 4 | 400 | 4.0 | 0 / 75 / 0 / 25 | 9.7 (9–13) | 9.3 | 6.0 | 4.2 (0.6) | 38 | 36% (room 9.2) | 3% / 31% | 0.5 / 1.8 / 0.0 | 27% (−1 ticks) |
| F5 | 1 | 483 | 12.1 | 57 / 43 / 1 / 0 | 9.9 (9–13) | 7.8 | 6.3 | 3.2 (0.6) | 32 | 22% (room 8.7) | 6% / 22% | 0.0 / 1.0 / 0.0 | 30% (−2 ticks) |
| F5 | 2 | 586 | 7.9 | 53 / 46 / 1 / 0 | 9.9 (9–13) | 9.3 | 6.3 | 3.5 (0.6) | 34 | 25% (room 9.6) | 6% / 22% | 0.1 / 2.1 / 0.0 | 32% (+1 ticks) |
| F5 | 3 | 879 | 7.4 | 34 / 61 / 4 / 0 | 9.9 (9–13) | 9.0 | 6.3 | 3.4 (0.6) | 35 | 33% (room 9.5) | 2% / 30% | 2.2 / 0.9 / 1.3 | 32% (+0 ticks) |
| F5 | 4 | 367 | 6.4 | 0 / 90 / 10 / 0 | 9.9 (9–13) | 9.0 | 6.3 | 3.5 (0.6) | 42 | 47% (room 9.0) | 4% / 23% | 1.0 / 1.1 / 0.0 | 31% (−1 ticks) |
| F6 | 1 | 294 | 14.0 | 82 / 18 / 0 / 0 | 10.4 (9–13) | 7.8 | 6.5 | 3.9 (0.5) | 45 | 0% | 10% / 11% | 0.0 / 0.9 / 0.0 | 31% (+2 ticks) |
| F6 | 2 | 527 | 9.4 | 52 / 47 / 1 / 0 | 10.3 (9–13) | 8.4 | 6.5 | 4.1 (0.5) | 42 | 0% | 10% / 16% | 0.0 / 1.7 / 0.0 | 29% (+4 ticks) |
| F6 | 3 | 705 | 8.8 | 30 / 68 / 2 / 0 | 10.4 (9–13) | 8.2 | 6.5 | 3.9 (0.4) | 42 | 0% | 3% / 21% | 1.9 / 0.8 / 1.0 | 29% (+0 ticks) |
| F6 | 4 | 323 | 8.3 | 7 / 90 / 3 / 1 | 10.3 (9–13) | 9.3 | 6.5 | 4.6 (0.5) | 51 | 0% | 7% / 18% | 1.3 / 1.0 / 0.0 | 28% (+2 ticks) |
| F7 | 1 | 800 | 16.0 | 50 / 50 / 0 / 0 | 11.1 (10–15) | 6.9 | 6.7 | 3.5 (0.4) | 60 | 0% | 9% / 19% | 0.3 / 0.6 / 0.0 | 32% (−5 ticks) |
| F7 | 2 | 800 | 12.5 | 50 / 50 / 0 / 0 | 11.1 (10–15) | 9.6 | 6.7 | 4.7 (0.5) | 51 | 0% | 8% / 22% | 0.4 / 0.7 / 0.0 | 32% (+2 ticks) |
| F7 | 3 | 1200 | 12.0 | 33 / 67 / 0 / 0 | 11.1 (10–15) | 9.4 | 6.7 | 4.6 (0.5) | 44 | 0% | 3% / 32% | 0.5 / 0.6 / 0.0 | 32% (−0 ticks) |
| F7 | 4 | 500 | 9.8 | 0 / 80 / 0 / 20 | 11.1 (10–15) | 8.9 | 6.7 | 4.3 (0.4) | 50 | 0% | 5% / 22% | 0.4 / 0.6 / 0.0 | 32% (+1 ticks) |
| F8 | 1 | 650 | 17.3 | 54 / 46 / 0 / 0 | 4.0 (4–4) | 3.5 | 3.0 | 1.8 (0.0) | 22 | 0% | 11% / 14% | 0.0 / 0.0 / 0.0 | 0% |
| F8 | 2 | 698 | 14.1 | 53 / 47 / 0 / 0 | 4.0 (4–4) | 3.8 | 3.0 | 1.9 (0.0) | 22 | 0% | 10% / 16% | 0.0 / 0.0 / 0.0 | 0% |
| F8 | 3 | 1025 | 13.4 | 1 / 99 / 0 / 0 | 4.0 (4–4) | 4.0 | 3.0 | 2.0 (0.0) | 17 | 0% | 2% / 22% | 0.0 / 0.0 / 0.0 | 0% |
| F8 | 4 | 367 | 13.0 | 0 / 100 / 0 / 0 | 4.0 (4–4) | 4.0 | 3.0 | 2.0 (0.0) | 22 | 0% | 5% / 17% | 0.0 / 0.0 / 0.0 | 0% |

**3b. Danger and reward**

| Floor | Party size | Gold found (p10–p90) | Of it, the boss fight | Target | Damage taken per hero (% max HP) | Downs / arrival | Deaths / arrival | Wipes / 100 arrivals | Torches | Light at the stairs (% Dark or Pitch) | Items found by grade (%) | Floor completed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F1 | 1 | 60 (28–106) | - | 80 | 32 | 0.04 | 0.04 | 3.5 | 0.00 | 84 (0%) | C 1 · D 3 · E 9 · F 87 | 96% |
| F1 | 2 | 70 (39–109) | - | 80 | 13 | 0.04 | 0.00 | 0.0 | 0.00 | 85 (0%) | C 1 · D 3 · E 10 · F 86 | 100% |
| F1 | 3 | 80 (45–127) | - | 80 | 12 | 0.10 | 0.00 | 0.0 | 0.00 | 85 (0%) | C 1 · D 2 · E 11 · F 86 | 100% |
| F1 | 4 | 106 (67–160) | - | 80 | 19 | 0.37 | 0.01 | 0.0 | 0.00 | 84 (0%) | C 1 · D 3 · E 7 · F 89 | 99% |
| F2 | 1 | 86 (31–151) | - | 100 | 57 | 0.28 | 0.12 | 12.0 | 0.00 | 83 (0%) | C 0 · D 2 · E 10 · F 87 | 85% |
| F2 | 2 | 108 (54–172) | - | 100 | 29 | 0.41 | 0.00 | 0.0 | 0.00 | 83 (0%) | C 1 · D 2 · E 10 · F 88 | 99% |
| F2 | 3 | 114 (63–183) | - | 100 | 22 | 0.72 | 0.01 | 0.0 | 0.00 | 82 (0%) | C 0 · D 2 · E 11 · F 87 | 97% |
| F2 | 4 | 146 (70–220) | - | 100 | 38 | 1.80 | 0.02 | 0.0 | 0.00 | 83 (0%) | D 1 · E 8 · F 91 | 99% |
| F3 | 1 | 151 (36–272) | 73 | 120 | 234 | 1.52 | 0.51 | 50.9 | 0.00 | 74 (0%) | D 2 · E 7 · F 90 | 40% |
| F3 | 2 | 183 (77–303) | 86 | 120 | 223 | 4.67 | 0.91 | 45.6 | 0.00 | 78 (0%) | C 0 · D 3 · E 8 · F 90 | 50% |
| F3 | 3 | 182 (73–292) | 81 | 120 | 147 | 6.26 | 1.31 | 40.4 | 0.00 | 76 (0%) | C 0 · D 2 · E 9 · F 89 | 46% |
| F3 | 4 | 233 (113–342) | 86 | 120 | 226 | 9.24 | 1.34 | 33.3 | 0.00 | 77 (0%) | C 0 · D 1 · E 7 · F 92 | 53% |
| F4 | 1 | 114 (65–190) | - | 140 | 102 | 0.29 | 0.17 | 17.5 | 0.24 | 56 (2%) | B 0 · C 2 · D 13 · E 29 · F 56 | 81% |
| F4 | 2 | 132 (76–203) | - | 140 | 53 | 0.30 | 0.03 | 0.7 | 0.30 | 55 (2%) | B 0 · C 2 · D 13 · E 27 · F 58 | 98% |
| F4 | 3 | 167 (104–247) | - | 140 | 37 | 0.48 | 0.00 | 0.0 | 0.04 | 62 (0%) | B 0 · C 2 · D 12 · E 26 · F 59 | 98% |
| F4 | 4 | 192 (112–289) | - | 140 | 93 | 3.27 | 0.14 | 0.5 | 0.26 | 56 (2%) | B 0 · C 2 · D 10 · E 23 · F 65 | 92% |
| F5 | 1 | 93 (0–184) | - | 160 | 131 | 0.60 | 0.32 | 31.7 | 0.40 | 51 (2%) | B 0 · C 2 · D 11 · E 31 · F 56 | 61% |
| F5 | 2 | 135 (59–215) | - | 160 | 87 | 1.55 | 0.16 | 5.1 | 0.69 | 54 (2%) | B 1 · C 3 · D 11 · E 26 · F 59 | 90% |
| F5 | 3 | 149 (63–239) | - | 160 | 63 | 2.11 | 0.16 | 3.5 | 0.16 | 56 (0%) | A 0 · B 0 · C 2 · D 11 · E 26 · F 61 | 80% |
| F5 | 4 | 184 (75–299) | - | 160 | 103 | 4.99 | 0.19 | 1.4 | 0.62 | 54 (1%) | B 0 · C 2 · D 9 · E 22 · F 67 | 88% |
| F6 | 1 | 127 (0–235) | 52 | 180 | 148 | 0.74 | 0.36 | 35.7 | 0.84 | 55 (0%) | A 1 · B 0 · C 2 · D 10 · E 30 · F 57 | 62% |
| F6 | 2 | 141 (40–248) | 53 | 180 | 172 | 4.24 | 1.20 | 57.1 | 0.85 | 60 (0%) | A 1 · B 0 · C 2 · D 9 · E 27 · F 61 | 38% |
| F6 | 3 | 158 (42–285) | 54 | 180 | 132 | 4.89 | 1.16 | 34.8 | 0.43 | 60 (0%) | A 1 · B 1 · C 1 · D 8 · E 27 · F 62 | 50% |
| F6 | 4 | 235 (117–343) | 65 | 180 | 161 | 7.76 | 1.46 | 33.7 | 1.15 | 58 (0%) | A 0 · B 0 · C 1 · D 7 · E 19 · F 72 | 63% |
| F7 | 1 | 162 (0–378) | 111 | 370 | 197 | 1.32 | 0.70 | 70.0 | 0.01 | 73 (0%) | A 1 · B 1 · C 7 · D 26 · E 6 · F 59 | 25% |
| F7 | 2 | 288 (117–469) | 115 | 370 | 194 | 2.95 | 0.89 | 42.1 | 0.02 | 75 (0%) | A 1 · B 1 · C 8 · D 24 · E 7 · F 59 | 52% |
| F7 | 3 | 306 (118–495) | 117 | 370 | 123 | 3.90 | 1.30 | 38.7 | 0.02 | 74 (0%) | A 1 · B 2 · C 8 · D 24 · E 6 · F 60 | 46% |
| F7 | 4 | 390 (102–628) | 162 | 370 | 196 | 6.61 | 1.47 | 31.8 | 0.03 | 75 (0%) | A 0 · B 1 · C 5 · D 20 · E 5 · F 68 | 54% |
| F8 | 1 | 128 (0–354) | 280 | 400 | 143 | 1.41 | 0.70 | 70.5 | 0.00 | 100 (0%) | A 1 · B 8 · C 32 · D 13 · F 46 | 29% |
| F8 | 2 | 228 (72–405) | 285 | 400 | 128 | 2.72 | 0.92 | 45.6 | 0.00 | 99 (0%) | A 1 · B 7 · C 26 · D 11 · F 54 · S 0 | 52% |
| F8 | 3 | 227 (76–416) | 291 | 400 | 99 | 3.90 | 1.57 | 51.7 | 0.00 | 99 (0%) | A 1 · B 7 · C 24 · D 9 · F 59 · S 0 | 48% |
| F8 | 4 | 232 (98–437) | 295 | 400 | 131 | 6.67 | 2.42 | 59.9 | 0.00 | 99 (0%) | A 1 · B 5 · C 20 · D 7 · F 67 | 39% |

**3c. Curio outcomes**

| Floor | Party size | Curios used / arrival | Outcome mix |
|---|---|---|---|
| F1 | 1 | 0.67 | loot 31% · nothing 10% · ambush-encounter 9% · give-material 7% · reveal-floor 7% · status-next-fights 6% · status-for-floor 5% · applyStatus 5% · cooking-ingredient 4% · lantern-gutters 4% · tome-tier-1 3% · light 3% · drop-item-of-grade 3% · floor-gold-percent 2% |
| F1 | 2 | 0.69 | loot 33% · ambush-encounter 9% · give-material 9% · nothing 9% · status-next-fights 7% · reveal-floor 5% · lantern-gutters 5% · tome-tier-1 5% · cooking-ingredient 4% · status-for-floor 4% · floor-gold-percent 4% · light 3% · applyStatus 1% · drop-item-of-grade 1% |
| F1 | 3 | 0.68 | loot 33% · ambush-encounter 12% · nothing 10% · give-material 7% · status-for-floor 6% · cooking-ingredient 5% · lantern-gutters 5% · status-next-fights 4% · floor-gold-percent 4% · tome-tier-1 4% · applyStatus 4% · reveal-floor 3% · light 2% · drop-item-of-grade 0% |
| F1 | 4 | 0.69 | loot 29% · nothing 19% · ambush-encounter 12% · give-material 6% · status-for-floor 6% · lantern-gutters 4% · status-next-fights 4% · reveal-floor 4% · applyStatus 4% · floor-gold-percent 4% · tome-tier-1 3% · cooking-ingredient 1% · drop-item-of-grade 1% · light 1% |
| F2 | 1 | 0.94 | nothing 22% · loot 21% · light 10% · ambush-encounter 8% · reveal-floor 7% · give-material 6% · floor-gold-percent 6% · status-next-fights 5% · drop-item-of-grade 4% · applyStatus 3% · lantern-gutters 3% · cooking-ingredient 3% · tome-tier-1 2% |
| F2 | 2 | 0.95 | nothing 38% · loot 26% · ambush-encounter 8% · floor-gold-percent 6% · reveal-floor 5% · status-next-fights 5% · applyStatus 5% · light 4% · give-material 2% · cooking-ingredient 1% |
| F2 | 3 | 0.96 | nothing 35% · loot 22% · light 9% · ambush-encounter 9% · floor-gold-percent 5% · reveal-floor 5% · give-material 3% · status-next-fights 2% · applyStatus 2% · lantern-gutters 2% · drop-item-of-grade 2% · tome-tier-1 1% · cooking-ingredient 1% |
| F2 | 4 | 0.97 | nothing 62% · loot 19% · light 6% · give-material 3% · ambush-encounter 3% · applyStatus 2% · floor-gold-percent 2% · cooking-ingredient 1% · reveal-floor 1% |
| F3 | 1 | 1.02 | nothing 36% · loot 25% · ambush-encounter 8% · floor-gold-percent 7% · light 5% · reveal-floor 4% · applyStatus 4% · status-next-fights 4% · drop-item-of-grade 2% · lantern-gutters 2% · tome-tier-1 1% · cooking-ingredient 1% · give-material 1% |
| F3 | 2 | 1.07 | nothing 65% · loot 16% · light 6% · ambush-encounter 4% · reveal-floor 2% · floor-gold-percent 2% · give-material 2% · status-next-fights 1% · cooking-ingredient 1% · applyStatus 1% · lantern-gutters 0% · drop-item-of-grade 0% |
| F3 | 3 | 0.97 | nothing 63% · loot 19% · light 8% · ambush-encounter 3% · give-material 2% · reveal-floor 1% · floor-gold-percent 1% · status-next-fights 1% · lantern-gutters 1% · applyStatus 0% · tome-tier-1 0% |
| F3 | 4 | 1.03 | nothing 71% · loot 13% · light 7% · floor-gold-percent 3% · give-material 2% · cooking-ingredient 1% · ambush-encounter 1% · reveal-floor 1% · lantern-gutters 1% |
| F4 | 1 | 1.12 | nothing 21% · light 13% · smash-urns 10% · repair-durability 10% · heal 7% · reveal-secret-and-key 7% · large-chest-appears 7% · loot 4% · resist-for-floor 4% · drop-item-of-grade 4% · small-chest-appears 3% · curio-fight 3% · applyStatus 2% · status-for-floor 2% · status-next-fights 1% · cooking-ingredient 1% · insight-roll 1% · give-material 0% |
| F4 | 2 | 1.16 | nothing 27% · light 13% · repair-durability 9% · smash-urns 9% · large-chest-appears 7% · heal 6% · reveal-secret-and-key 6% · small-chest-appears 5% · resist-for-floor 5% · curio-fight 4% · loot 3% · applyStatus 2% · status-for-floor 1% · cooking-ingredient 1% · status-next-fights 1% · insight-roll 0% · drop-item-of-grade 0% |
| F4 | 3 | 1.14 | nothing 25% · light 12% · repair-durability 10% · smash-urns 8% · reveal-secret-and-key 7% · large-chest-appears 6% · small-chest-appears 6% · loot 6% · curio-fight 5% · heal 4% · applyStatus 4% · status-for-floor 2% · resist-for-floor 2% · status-next-fights 1% · insight-roll 1% · cooking-ingredient 1% · drop-item-of-grade 1% |
| F4 | 4 | 1.11 | nothing 48% · light 12% · repair-durability 7% · small-chest-appears 6% · smash-urns 5% · large-chest-appears 4% · heal 4% · reveal-secret-and-key 2% · status-next-fights 2% · status-for-floor 2% · curio-fight 2% · resist-for-floor 2% · loot 1% · applyStatus 1% · cooking-ingredient 1% · drop-item-of-grade 1% |
| F5 | 1 | 0.82 | nothing 37% · smash-urns 12% · light 11% · small-chest-appears 8% · reveal-secret-and-key 6% · repair-durability 5% · loot 5% · applyStatus 4% · heal 4% · curio-fight 3% · insight-roll 2% · drop-item-of-grade 2% · status-next-fights 1% · large-chest-appears 1% |
| F5 | 2 | 1.06 | nothing 61% · small-chest-appears 11% · light 10% · smash-urns 3% · repair-durability 3% · large-chest-appears 2% · reveal-secret-and-key 2% · status-next-fights 1% · loot 1% · resist-for-floor 1% · applyStatus 1% · heal 1% · curio-fight 1% · insight-roll 0% · drop-item-of-grade 0% |
| F5 | 3 | 0.98 | nothing 45% · light 15% · small-chest-appears 10% · loot 9% · repair-durability 6% · reveal-secret-and-key 5% · smash-urns 3% · status-for-floor 2% · heal 1% · curio-fight 1% · applyStatus 1% · resist-for-floor 0% · insight-roll 0% · drop-item-of-grade 0% · cooking-ingredient 0% · large-chest-appears 0% · status-next-fights 0% |
| F5 | 4 | 1.01 | nothing 53% · light 14% · small-chest-appears 11% · reveal-secret-and-key 4% · repair-durability 4% · smash-urns 3% · status-for-floor 2% · resist-for-floor 2% · heal 2% · applyStatus 1% · status-next-fights 1% · insight-roll 1% · curio-fight 1% · cooking-ingredient 0% · loot 0% |
| F6 | 1 | 0.82 | nothing 33% · small-chest-appears 18% · repair-durability 9% · light 6% · smash-urns 5% · resist-for-floor 5% · heal 4% · give-material 4% · loot 3% · drop-item-of-grade 3% · status-next-fights 3% · curio-fight 3% · status-for-floor 3% · applyStatus 3% · large-chest-appears 1% · reveal-secret-and-key 1% |
| F6 | 2 | 0.84 | nothing 67% · small-chest-appears 14% · light 12% · resist-for-floor 1% · cooking-ingredient 1% · smash-urns 1% · reveal-secret-and-key 1% · large-chest-appears 1% · loot 1% · insight-roll 1% |
| F6 | 3 | 0.81 | nothing 62% · light 12% · small-chest-appears 12% · loot 5% · resist-for-floor 2% · status-for-floor 1% · curio-fight 1% · smash-urns 1% · applyStatus 1% · large-chest-appears 1% · reveal-secret-and-key 1% · heal 1% · status-next-fights 1% · repair-durability 1% · cooking-ingredient 1% |
| F6 | 4 | 0.87 | nothing 74% · small-chest-appears 10% · light 9% · repair-durability 2% · large-chest-appears 1% · curio-fight 1% · applyStatus 1% · insight-roll 1% · status-for-floor 1% |
| F7 | 1 | 0.65 | nothing 30% · roll-rare-part 12% · drain-sluice 12% · status-next-fights 12% · resist-for-floor 8% · ambush-encounter 8% · applyStatus 6% · curio-fight 4% · large-chest-appears 4% · loot 4% · tome-of-tier 2% |
| F7 | 2 | 0.92 | nothing 61% · roll-rare-part 10% · status-next-fights 8% · drain-sluice 4% · applyStatus 4% · large-chest-appears 3% · ambush-encounter 3% · resist-for-floor 2% · curio-fight 2% · loot 2% · tome-of-tier 1% |
| F7 | 3 | 0.91 | nothing 58% · roll-rare-part 12% · status-next-fights 8% · drain-sluice 4% · resist-for-floor 4% · loot 3% · applyStatus 3% · ambush-encounter 2% · tome-of-tier 2% · large-chest-appears 1% · curio-fight 1% · give-material 1% |
| F7 | 4 | 0.87 | nothing 73% · roll-rare-part 10% · status-next-fights 7% · drain-sluice 4% · applyStatus 2% · resist-for-floor 1% · ambush-encounter 1% · large-chest-appears 1% · tome-of-tier 1% |

### normal · careful

**3a. Exploration**

| Floor | Party size | Arrivals | Party level | Band on arrival (easy / even / dangerous / deadly %) | Rooms (min–max) | Visited | Straight-line hops | Fights (elites) | Ticks to the stairs | Hunter (% of arrivals, room) | Ambushed: party / monsters (% of fights) | Traps revealed / triggered / disarmed | Key and Lock (extra ticks) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F1 | 1 | 200 | 6.5 | 50 / 50 / 0 / 0 | 6.8 (5–8) | 6.6 | 4.9 | 2.5 (0.3) | 15 | 0% | 22% / 31% | 1.4 / 0.6 / 0.9 | 24% (+2 ticks) |
| F1 | 2 | 200 | 3.0 | 50 / 50 / 0 / 0 | 6.8 (5–8) | 6.7 | 4.9 | 2.5 (0.3) | 14 | 0% | 22% / 29% | 1.5 / 0.6 / 0.9 | 24% (+2 ticks) |
| F1 | 3 | 300 | 2.3 | 33 / 67 / 0 / 0 | 6.8 (5–8) | 6.7 | 4.9 | 2.5 (0.3) | 15 | 0% | 15% / 36% | 1.5 / 0.5 / 1.0 | 24% (+2 ticks) |
| F1 | 4 | 100 | 1.0 | 0 / 100 / 0 / 0 | 6.8 (5–8) | 6.7 | 4.9 | 2.5 (0.3) | 17 | 0% | 19% / 26% | 1.4 / 0.5 / 0.9 | 24% (+1 ticks) |
| F2 | 1 | 191 | 7.7 | 65 / 35 / 0 / 0 | 9.0 (8–11) | 8.4 | 5.6 | 2.8 (0.4) | 22 | 3% (room 8.0) | 26% / 21% | 2.1 / 0.8 / 1.2 | 34% (+0 ticks) |
| F2 | 2 | 200 | 3.8 | 51 / 50 / 0 / 0 | 9.0 (8–11) | 8.8 | 5.6 | 2.9 (0.4) | 24 | 1% (room 11.0) | 25% / 26% | 2.3 / 1.0 / 1.3 | 33% (+2 ticks) |
| F2 | 3 | 299 | 3.1 | 33 / 67 / 0 / 0 | 9.0 (8–11) | 8.7 | 5.6 | 2.8 (0.4) | 25 | 3% (room 9.8) | 17% / 34% | 2.2 / 0.6 / 1.5 | 33% (+2 ticks) |
| F2 | 4 | 99 | 2.1 | 0 / 100 / 0 / 0 | 9.0 (8–11) | 8.8 | 5.6 | 2.9 (0.4) | 30 | 8% (room 9.4) | 21% / 29% | 2.3 / 0.9 / 1.4 | 33% (+0 ticks) |
| F3 | 1 | 160 | 9.3 | 67 / 33 / 0 / 0 | 9.9 (8–12) | 8.4 | 6.1 | 5.1 (0.4) | 64 | 0% | 18% / 19% | 1.4 / 1.0 / 0.8 | 33% (+7 ticks) |
| F3 | 2 | 186 | 5.0 | 37 / 63 / 0 / 0 | 10.0 (8–12) | 8.9 | 6.1 | 5.1 (0.4) | 45 | 0% | 17% / 20% | 1.5 / 1.2 / 0.8 | 33% (+3 ticks) |
| F3 | 3 | 221 | 4.7 | 17 / 83 / 0 / 0 | 10.0 (8–12) | 8.4 | 6.1 | 4.8 (0.4) | 42 | 0% | 11% / 28% | 1.8 / 0.5 / 1.2 | 33% (+8 ticks) |
| F3 | 4 | 66 | 4.2 | 3 / 97 / 0 / 0 | 9.9 (8–12) | 8.4 | 6.1 | 4.9 (0.3) | 51 | 0% | 11% / 22% | 1.8 / 0.6 / 1.0 | 38% (+7 ticks) |
| F4 | 1 | 200 | 10.5 | 50 / 50 / 0 / 0 | 9.7 (9–13) | 9.3 | 6.0 | 4.2 (0.6) | 32 | 27% (room 9.6) | 6% / 25% | 0.1 / 2.2 / 0.0 | 27% (−3 ticks) |
| F4 | 2 | 200 | 7.0 | 50 / 50 / 0 / 0 | 9.7 (9–13) | 9.5 | 6.0 | 4.2 (0.6) | 30 | 20% (room 9.9) | 6% / 31% | 0.1 / 2.3 / 0.0 | 27% (−0 ticks) |
| F4 | 3 | 300 | 6.3 | 33 / 67 / 0 / 0 | 9.7 (9–13) | 9.6 | 6.0 | 4.3 (0.6) | 35 | 33% (room 9.5) | 2% / 40% | 2.4 / 0.9 / 1.5 | 27% (−3 ticks) |
| F4 | 4 | 200 | 3.0 | 0 / 50 / 0 / 50 | 9.7 (9–13) | 5.2 | 6.0 | 2.1 (0.3) | 36 | 16% (room 9.5) | 3% / 32% | 0.3 / 0.9 / 0.0 | 27% (−0 ticks) |
| F5 | 1 | 161 | 12.1 | 57 / 43 / 1 / 0 | 9.9 (9–13) | 7.8 | 6.3 | 3.2 (0.6) | 32 | 22% (room 8.7) | 6% / 22% | 0.0 / 1.0 / 0.0 | 30% (−2 ticks) |
| F5 | 2 | 194 | 7.9 | 54 / 46 / 1 / 0 | 9.9 (9–13) | 9.3 | 6.3 | 3.5 (0.6) | 35 | 24% (room 9.6) | 6% / 23% | 0.1 / 2.1 / 0.0 | 32% (+2 ticks) |
| F5 | 3 | 293 | 7.4 | 34 / 61 / 4 / 0 | 9.9 (9–13) | 9.0 | 6.3 | 3.4 (0.6) | 36 | 33% (room 9.6) | 2% / 30% | 2.2 / 0.8 / 1.3 | 32% (+1 ticks) |
| F5 | 4 | 94 | 6.6 | 0 / 99 / 1 / 0 | 9.9 (9–13) | 9.0 | 6.3 | 3.5 (0.5) | 44 | 45% (room 9.1) | 4% / 24% | 1.0 / 1.1 / 0.0 | 31% (+1 ticks) |
| F6 | 1 | 97 | 14.1 | 82 / 18 / 0 / 0 | 10.4 (9–13) | 7.8 | 6.5 | 3.9 (0.5) | 44 | 0% | 10% / 11% | 0.0 / 0.9 / 0.0 | 31% (+2 ticks) |
| F6 | 2 | 165 | 9.5 | 54 / 46 / 0 / 0 | 10.3 (9–13) | 8.4 | 6.5 | 4.0 (0.5) | 42 | 0% | 9% / 16% | 0.0 / 1.7 / 0.0 | 28% (+5 ticks) |
| F6 | 3 | 205 | 9.1 | 35 / 65 / 0 / 0 | 10.3 (9–13) | 8.4 | 6.6 | 4.0 (0.4) | 42 | 0% | 3% / 21% | 1.9 / 0.9 / 1.1 | 29% (−0 ticks) |
| F6 | 4 | 71 | 8.7 | 10 / 90 / 0 / 0 | 10.3 (9–13) | 9.3 | 6.5 | 4.6 (0.5) | 49 | 0% | 7% / 19% | 1.3 / 1.0 / 0.0 | 28% (−1 ticks) |
| F7 | 1 | 200 | 16.0 | 50 / 50 / 0 / 0 | 11.1 (10–15) | 6.9 | 6.7 | 3.5 (0.4) | 60 | 0% | 9% / 19% | 0.3 / 0.6 / 0.0 | 32% (−5 ticks) |
| F7 | 2 | 200 | 12.5 | 50 / 50 / 0 / 0 | 11.1 (10–15) | 9.5 | 6.7 | 4.7 (0.5) | 51 | 0% | 8% / 22% | 0.4 / 0.7 / 0.0 | 32% (+2 ticks) |
| F7 | 3 | 300 | 12.0 | 33 / 67 / 0 / 0 | 11.1 (10–15) | 9.3 | 6.7 | 4.5 (0.5) | 44 | 0% | 3% / 32% | 0.5 / 0.6 / 0.0 | 32% (+1 ticks) |
| F7 | 4 | 200 | 8.0 | 0 / 50 / 0 / 50 | 11.1 (10–15) | 5.3 | 6.7 | 2.3 (0.2) | 49 | 0% | 5% / 22% | 0.2 / 0.3 / 0.0 | 32% (+2 ticks) |
| F8 | 1 | 200 | 17.0 | 50 / 50 / 0 / 0 | 4.0 (4–4) | 3.6 | 3.0 | 1.8 (0.0) | 22 | 0% | 11% / 15% | 0.0 / 0.0 / 0.0 | 0% |
| F8 | 2 | 200 | 14.0 | 50 / 50 / 0 / 0 | 4.0 (4–4) | 3.9 | 3.0 | 1.9 (0.0) | 22 | 0% | 10% / 16% | 0.0 / 0.0 / 0.0 | 0% |
| F8 | 3 | 300 | 13.3 | 0 / 100 / 0 / 0 | 4.0 (4–4) | 4.0 | 3.0 | 2.0 (0.0) | 17 | 0% | 2% / 23% | 0.0 / 0.0 / 0.0 | 0% |
| F8 | 4 | 100 | 13.0 | 0 / 100 / 0 / 0 | 4.0 (4–4) | 4.0 | 3.0 | 2.0 (0.0) | 22 | 0% | 5% / 18% | 0.0 / 0.0 / 0.0 | 0% |

**3b. Danger and reward**

| Floor | Party size | Gold found (p10–p90) | Of it, the boss fight | Target | Damage taken per hero (% max HP) | Downs / arrival | Deaths / arrival | Wipes / 100 arrivals | Torches | Light at the stairs (% Dark or Pitch) | Items found by grade (%) | Floor completed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F1 | 1 | 60 (28–106) | - | 80 | 32 | 0.04 | 0.04 | 3.5 | 0.00 | 84 (0%) | C 1 · D 3 · E 9 · F 87 | 96% |
| F1 | 2 | 70 (39–109) | - | 80 | 13 | 0.04 | 0.00 | 0.0 | 0.00 | 85 (0%) | C 1 · D 3 · E 10 · F 86 | 100% |
| F1 | 3 | 80 (45–127) | - | 80 | 12 | 0.10 | 0.00 | 0.0 | 0.00 | 85 (0%) | C 1 · D 2 · E 11 · F 86 | 100% |
| F1 | 4 | 106 (67–160) | - | 80 | 19 | 0.37 | 0.01 | 0.0 | 0.00 | 84 (0%) | C 1 · D 3 · E 7 · F 89 | 99% |
| F2 | 1 | 86 (31–151) | - | 100 | 57 | 0.28 | 0.12 | 12.0 | 0.00 | 82 (0%) | C 0 · D 2 · E 10 · F 87 | 84% |
| F2 | 2 | 108 (54–172) | - | 100 | 29 | 0.41 | 0.00 | 0.0 | 0.00 | 82 (0%) | C 1 · D 2 · E 10 · F 88 | 93% |
| F2 | 3 | 114 (63–183) | - | 100 | 22 | 0.72 | 0.01 | 0.0 | 0.00 | 82 (0%) | C 0 · D 2 · E 10 · F 87 | 74% |
| F2 | 4 | 145 (70–220) | - | 100 | 38 | 1.80 | 0.02 | 0.0 | 0.00 | 83 (0%) | D 1 · E 8 · F 91 | 67% |
| F3 | 1 | 152 (41–274) | 73 | 120 | 233 | 1.50 | 0.50 | 50.0 | 0.00 | 74 (0%) | D 2 · E 8 · F 90 | 41% |
| F3 | 2 | 184 (75–307) | 86 | 120 | 216 | 4.49 | 0.87 | 44.6 | 0.00 | 78 (0%) | C 0 · D 3 · E 7 · F 90 | 51% |
| F3 | 3 | 191 (74–295) | 82 | 120 | 139 | 5.58 | 1.04 | 33.5 | 0.00 | 76 (0%) | C 0 · D 1 · E 9 · F 90 | 56% |
| F3 | 4 | 216 (103–317) | 87 | 120 | 207 | 8.76 | 1.41 | 43.9 | 0.00 | 79 (0%) | D 1 · E 7 · F 91 | 44% |
| F4 | 1 | 114 (65–190) | - | 140 | 102 | 0.29 | 0.17 | 17.5 | 0.24 | 56 (2%) | B 0 · C 2 · D 13 · E 29 · F 56 | 81% |
| F4 | 2 | 132 (76–203) | - | 140 | 53 | 0.30 | 0.04 | 1.0 | 0.29 | 55 (2%) | B 0 · C 2 · D 13 · E 27 · F 58 | 97% |
| F4 | 3 | 167 (104–247) | - | 140 | 37 | 0.48 | 0.00 | 0.0 | 0.04 | 62 (0%) | B 0 · C 2 · D 12 · E 26 · F 59 | 98% |
| F4 | 4 | 96 (0–252) | - | 140 | 40 | 1.14 | 0.04 | 0.0 | 0.14 | 56 (1%) | B 1 · C 2 · D 10 · E 24 · F 64 | 47% |
| F5 | 1 | 93 (0–184) | - | 160 | 131 | 0.60 | 0.32 | 31.7 | 0.40 | 51 (2%) | B 0 · C 2 · D 11 · E 31 · F 56 | 60% |
| F5 | 2 | 134 (58–211) | - | 160 | 85 | 1.52 | 0.14 | 4.6 | 0.68 | 53 (2%) | B 1 · C 3 · D 11 · E 26 · F 60 | 85% |
| F5 | 3 | 148 (63–237) | - | 160 | 62 | 2.06 | 0.15 | 3.4 | 0.16 | 56 (0%) | A 0 · B 0 · C 2 · D 11 · E 26 · F 61 | 70% |
| F5 | 4 | 186 (79–299) | - | 160 | 95 | 4.46 | 0.11 | 0.0 | 0.65 | 54 (1%) | B 0 · C 2 · D 9 · E 22 · F 66 | 76% |
| F6 | 1 | 125 (0–235) | 52 | 180 | 148 | 0.75 | 0.36 | 36.1 | 0.82 | 54 (0%) | A 1 · B 0 · C 2 · D 11 · E 30 · F 56 | 62% |
| F6 | 2 | 141 (40–251) | 53 | 180 | 170 | 4.15 | 1.16 | 55.8 | 0.83 | 60 (0%) | A 1 · B 0 · C 2 · D 9 · E 27 · F 61 | 39% |
| F6 | 3 | 162 (42–293) | 54 | 180 | 129 | 4.64 | 1.01 | 30.7 | 0.46 | 60 (0%) | A 1 · B 0 · C 1 · D 8 · E 28 · F 62 | 56% |
| F6 | 4 | 240 (122–343) | 66 | 180 | 147 | 6.79 | 1.10 | 23.9 | 1.14 | 58 (0%) | A 0 · B 0 · C 1 · D 7 · E 18 · F 74 | 76% |
| F7 | 1 | 162 (0–378) | 111 | 370 | 197 | 1.32 | 0.70 | 70.0 | 0.01 | 73 (0%) | A 1 · B 1 · C 7 · D 26 · E 6 · F 59 | 25% |
| F7 | 2 | 286 (111–469) | 115 | 370 | 192 | 2.92 | 0.89 | 42.0 | 0.02 | 75 (0%) | A 1 · B 1 · C 8 · D 24 · E 7 · F 59 | 52% |
| F7 | 3 | 305 (118–495) | 117 | 370 | 122 | 3.81 | 1.26 | 37.7 | 0.02 | 74 (0%) | A 1 · B 2 · C 8 · D 24 · E 6 · F 60 | 49% |
| F7 | 4 | 215 (0–574) | 161 | 370 | 95 | 3.02 | 0.57 | 12.5 | 0.01 | 76 (0%) | A 0 · B 1 · C 5 · D 21 · E 5 · F 68 | 32% |
| F8 | 1 | 131 (0–357) | 280 | 400 | 144 | 1.39 | 0.69 | 69.5 | 0.00 | 100 (0%) | A 1 · B 8 · C 31 · D 13 · F 46 | 30% |
| F8 | 2 | 236 (75–408) | 283 | 400 | 126 | 2.59 | 0.89 | 44.0 | 0.00 | 100 (0%) | A 1 · B 7 · C 26 · D 11 · F 54 | 54% |
| F8 | 3 | 234 (76–416) | 290 | 400 | 98 | 3.67 | 1.51 | 50.0 | 0.00 | 100 (0%) | A 1 · B 7 · C 24 · D 8 · F 60 · S 0 | 50% |
| F8 | 4 | 248 (98–440) | 297 | 400 | 128 | 6.06 | 2.26 | 56.0 | 0.00 | 100 (0%) | A 1 · B 5 · C 21 · D 8 · F 65 | 44% |

**3c. Curio outcomes**

| Floor | Party size | Curios used / arrival | Outcome mix |
|---|---|---|---|
| F1 | 1 | 0.67 | loot 31% · nothing 10% · ambush-encounter 9% · give-material 7% · reveal-floor 7% · status-next-fights 6% · status-for-floor 5% · applyStatus 5% · cooking-ingredient 4% · lantern-gutters 4% · tome-tier-1 3% · light 3% · drop-item-of-grade 3% · floor-gold-percent 2% |
| F1 | 2 | 0.69 | loot 33% · ambush-encounter 9% · give-material 9% · nothing 9% · status-next-fights 7% · reveal-floor 5% · lantern-gutters 5% · tome-tier-1 5% · cooking-ingredient 4% · status-for-floor 4% · floor-gold-percent 4% · light 3% · applyStatus 1% · drop-item-of-grade 1% |
| F1 | 3 | 0.68 | loot 33% · ambush-encounter 12% · nothing 10% · give-material 7% · status-for-floor 6% · cooking-ingredient 5% · lantern-gutters 5% · status-next-fights 4% · floor-gold-percent 4% · tome-tier-1 4% · applyStatus 4% · reveal-floor 3% · light 2% · drop-item-of-grade 0% |
| F1 | 4 | 0.69 | loot 29% · nothing 19% · ambush-encounter 12% · give-material 6% · status-for-floor 6% · lantern-gutters 4% · status-next-fights 4% · reveal-floor 4% · applyStatus 4% · floor-gold-percent 4% · tome-tier-1 3% · cooking-ingredient 1% · drop-item-of-grade 1% · light 1% |
| F2 | 1 | 0.94 | nothing 22% · loot 21% · light 10% · ambush-encounter 8% · reveal-floor 7% · give-material 6% · floor-gold-percent 6% · status-next-fights 5% · drop-item-of-grade 4% · applyStatus 3% · lantern-gutters 3% · cooking-ingredient 3% · tome-tier-1 2% |
| F2 | 2 | 0.95 | nothing 38% · loot 26% · ambush-encounter 8% · floor-gold-percent 6% · reveal-floor 5% · status-next-fights 5% · applyStatus 5% · light 4% · give-material 2% · cooking-ingredient 1% |
| F2 | 3 | 0.96 | nothing 35% · loot 22% · light 9% · ambush-encounter 9% · floor-gold-percent 5% · reveal-floor 5% · give-material 3% · status-next-fights 2% · applyStatus 2% · lantern-gutters 2% · drop-item-of-grade 2% · tome-tier-1 1% · cooking-ingredient 1% |
| F2 | 4 | 0.97 | nothing 63% · loot 19% · light 6% · give-material 3% · ambush-encounter 3% · applyStatus 2% · floor-gold-percent 2% · cooking-ingredient 1% · reveal-floor 1% |
| F3 | 1 | 1.02 | nothing 35% · loot 25% · ambush-encounter 9% · floor-gold-percent 7% · light 5% · reveal-floor 4% · applyStatus 4% · status-next-fights 4% · drop-item-of-grade 2% · lantern-gutters 2% · tome-tier-1 1% · cooking-ingredient 1% · give-material 1% |
| F3 | 2 | 1.08 | nothing 67% · loot 15% · light 5% · ambush-encounter 4% · reveal-floor 2% · floor-gold-percent 2% · give-material 2% · status-next-fights 2% · cooking-ingredient 1% · applyStatus 1% · lantern-gutters 1% · drop-item-of-grade 1% |
| F3 | 3 | 0.96 | nothing 64% · loot 18% · light 9% · ambush-encounter 2% · give-material 2% · status-next-fights 1% · reveal-floor 1% · floor-gold-percent 1% · tome-tier-1 0% · lantern-gutters 0% |
| F3 | 4 | 0.98 | nothing 69% · light 11% · loot 8% · floor-gold-percent 5% · cooking-ingredient 2% · give-material 2% · ambush-encounter 2% · reveal-floor 2% · lantern-gutters 2% |
| F4 | 1 | 1.12 | nothing 21% · light 13% · smash-urns 10% · repair-durability 10% · heal 7% · reveal-secret-and-key 7% · large-chest-appears 7% · loot 4% · resist-for-floor 4% · drop-item-of-grade 4% · small-chest-appears 3% · curio-fight 3% · applyStatus 2% · status-for-floor 2% · status-next-fights 1% · cooking-ingredient 1% · insight-roll 1% · give-material 0% |
| F4 | 2 | 1.16 | nothing 27% · light 13% · repair-durability 9% · smash-urns 9% · large-chest-appears 7% · heal 6% · reveal-secret-and-key 6% · small-chest-appears 5% · resist-for-floor 5% · curio-fight 4% · loot 3% · applyStatus 2% · status-for-floor 1% · cooking-ingredient 1% · status-next-fights 1% · insight-roll 0% · drop-item-of-grade 0% |
| F4 | 3 | 1.14 | nothing 25% · light 12% · repair-durability 10% · smash-urns 8% · reveal-secret-and-key 7% · large-chest-appears 6% · small-chest-appears 6% · loot 6% · curio-fight 5% · heal 4% · applyStatus 4% · status-for-floor 2% · resist-for-floor 2% · status-next-fights 1% · insight-roll 1% · cooking-ingredient 1% · drop-item-of-grade 1% |
| F4 | 4 | 0.56 | nothing 47% · light 12% · repair-durability 7% · small-chest-appears 6% · smash-urns 5% · large-chest-appears 4% · heal 4% · status-next-fights 3% · reveal-secret-and-key 2% · status-for-floor 2% · resist-for-floor 2% · curio-fight 2% · applyStatus 1% · loot 1% · cooking-ingredient 1% · drop-item-of-grade 1% |
| F5 | 1 | 0.82 | nothing 37% · smash-urns 12% · light 11% · small-chest-appears 8% · reveal-secret-and-key 6% · repair-durability 5% · loot 5% · applyStatus 4% · heal 4% · curio-fight 3% · insight-roll 2% · drop-item-of-grade 2% · status-next-fights 1% · large-chest-appears 1% |
| F5 | 2 | 1.06 | nothing 61% · small-chest-appears 11% · light 10% · smash-urns 3% · repair-durability 3% · large-chest-appears 2% · reveal-secret-and-key 2% · status-next-fights 1% · loot 1% · applyStatus 1% · heal 1% · curio-fight 1% · resist-for-floor 1% · insight-roll 0% · drop-item-of-grade 0% |
| F5 | 3 | 0.97 | nothing 45% · light 15% · small-chest-appears 10% · loot 9% · repair-durability 6% · reveal-secret-and-key 5% · smash-urns 3% · status-for-floor 2% · heal 1% · curio-fight 1% · applyStatus 1% · insight-roll 0% · drop-item-of-grade 0% · resist-for-floor 0% · cooking-ingredient 0% · large-chest-appears 0% · status-next-fights 0% |
| F5 | 4 | 1.01 | nothing 52% · light 14% · small-chest-appears 12% · reveal-secret-and-key 5% · repair-durability 4% · status-for-floor 3% · smash-urns 3% · resist-for-floor 2% · insight-roll 1% · heal 1% · curio-fight 1% · applyStatus 1% · status-next-fights 1% |
| F6 | 1 | 0.81 | nothing 33% · small-chest-appears 18% · repair-durability 9% · light 6% · smash-urns 5% · resist-for-floor 5% · heal 4% · give-material 4% · drop-item-of-grade 3% · status-next-fights 3% · curio-fight 3% · status-for-floor 3% · applyStatus 3% · loot 1% · large-chest-appears 1% · reveal-secret-and-key 1% |
| F6 | 2 | 0.85 | nothing 66% · small-chest-appears 14% · light 13% · resist-for-floor 1% · cooking-ingredient 1% · reveal-secret-and-key 1% · large-chest-appears 1% · smash-urns 1% · loot 1% · insight-roll 1% |
| F6 | 3 | 0.82 | nothing 64% · small-chest-appears 13% · light 12% · loot 4% · resist-for-floor 2% · curio-fight 1% · applyStatus 1% · heal 1% · status-next-fights 1% · repair-durability 1% · smash-urns 1% · cooking-ingredient 1% |
| F6 | 4 | 0.89 | nothing 81% · light 10% · small-chest-appears 5% · repair-durability 3% · status-for-floor 2% |
| F7 | 1 | 0.65 | nothing 30% · roll-rare-part 12% · drain-sluice 12% · status-next-fights 12% · resist-for-floor 8% · ambush-encounter 8% · applyStatus 6% · curio-fight 4% · large-chest-appears 4% · loot 4% · tome-of-tier 2% |
| F7 | 2 | 0.92 | nothing 61% · roll-rare-part 10% · status-next-fights 8% · drain-sluice 4% · applyStatus 4% · large-chest-appears 3% · ambush-encounter 3% · resist-for-floor 2% · curio-fight 2% · loot 2% · tome-of-tier 1% |
| F7 | 3 | 0.90 | nothing 58% · roll-rare-part 13% · status-next-fights 8% · drain-sluice 4% · resist-for-floor 4% · loot 3% · applyStatus 3% · ambush-encounter 2% · tome-of-tier 2% · large-chest-appears 1% · curio-fight 1% · give-material 1% |
| F7 | 4 | 0.48 | nothing 72% · roll-rare-part 10% · status-next-fights 7% · drain-sluice 4% · applyStatus 2% · large-chest-appears 1% · resist-for-floor 1% · ambush-encounter 1% · tome-of-tier 1% |

### hard · textbook

**3a. Exploration**

| Floor | Party size | Arrivals | Party level | Band on arrival (easy / even / dangerous / deadly %) | Rooms (min–max) | Visited | Straight-line hops | Fights (elites) | Ticks to the stairs | Hunter (% of arrivals, room) | Ambushed: party / monsters (% of fights) | Traps revealed / triggered / disarmed | Key and Lock (extra ticks) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F1 | 1 | 80 | 6.5 | 50 / 50 / 0 / 0 | 6.8 (5–8) | 6.4 | 4.9 | 2.5 (0.4) | 16 | 3% (room 6.5) | 32% / 18% | 0.7 / 0.6 / 0.4 | 25% (+2 ticks) |
| F1 | 2 | 80 | 3.0 | 50 / 50 / 0 / 0 | 6.8 (5–8) | 6.7 | 4.9 | 2.5 (0.4) | 17 | 1% (room 7.0) | 29% / 17% | 0.8 / 0.7 / 0.4 | 25% (+2 ticks) |
| F1 | 3 | 120 | 2.3 | 33 / 67 / 0 / 0 | 6.8 (5–8) | 6.6 | 4.9 | 2.5 (0.4) | 15 | 0% | 21% / 27% | 1.4 / 0.6 / 0.8 | 25% (+2 ticks) |
| F1 | 4 | 40 | 1.0 | 0 / 100 / 0 / 0 | 6.8 (5–8) | 6.5 | 4.9 | 2.5 (0.4) | 21 | 10% (room 6.5) | 24% / 16% | 0.7 / 0.8 / 0.3 | 25% (+2 ticks) |
| F2 | 1 | 69 | 8.2 | 77 / 23 / 0 / 0 | 9.0 (8–11) | 7.6 | 5.6 | 2.7 (0.6) | 29 | 28% (room 8.5) | 19% / 26% | 1.1 / 0.8 / 0.5 | 26% (−4 ticks) |
| F2 | 2 | 80 | 3.9 | 61 / 39 / 0 / 0 | 9.0 (8–11) | 8.8 | 5.6 | 3.0 (0.6) | 29 | 34% (room 9.1) | 24% / 22% | 1.4 / 0.8 / 0.8 | 25% (−6 ticks) |
| F2 | 3 | 115 | 3.2 | 35 / 65 / 0 / 0 | 9.0 (8–11) | 8.6 | 5.6 | 2.8 (0.6) | 27 | 30% (room 9.4) | 19% / 30% | 2.2 / 0.6 / 1.5 | 26% (−6 ticks) |
| F2 | 4 | 39 | 2.4 | 8 / 92 / 0 / 0 | 9.0 (8–11) | 7.1 | 5.6 | 2.6 (0.6) | 35 | 38% (room 8.5) | 20% / 19% | 1.6 / 0.9 / 0.7 | 23% (+0 ticks) |
| F3 | 1 | 45 | 10.3 | 82 / 18 / 0 / 0 | 10.2 (8–12) | 7.2 | 6.3 | 4.2 (0.3) | 70 | 0% | 21% / 21% | 0.6 / 0.8 / 0.2 | 27% (−28 ticks) |
| F3 | 2 | 75 | 5.6 | 60 / 40 / 0 / 0 | 10.2 (8–12) | 7.5 | 6.3 | 4.2 (0.4) | 52 | 0% | 18% / 22% | 0.9 / 0.7 / 0.5 | 28% (+19 ticks) |
| F3 | 3 | 102 | 4.6 | 24 / 75 / 1 / 0 | 10.1 (8–12) | 7.2 | 6.3 | 4.0 (0.4) | 43 | 0% | 9% / 29% | 1.5 / 0.5 / 0.9 | 27% (+13 ticks) |
| F3 | 4 | 25 | 4.4 | 20 / 76 / 4 / 0 | 10.3 (8–12) | 4.0 | 6.2 | 2.3 (0.2) | - | 0% | 19% / 26% | 0.6 / 0.7 / 0.1 | 24% |
| F4 | 1 | 80 | 10.5 | 50 / 50 / 0 / 0 | 9.7 (9–13) | 8.0 | 6.2 | 3.6 (0.4) | 36 | 51% (room 8.0) | 8% / 22% | 0.0 / 2.3 / 0.0 | 28% (+1 ticks) |
| F4 | 2 | 80 | 7.0 | 50 / 50 / 0 / 0 | 9.7 (9–13) | 8.7 | 6.2 | 4.0 (0.5) | 36 | 59% (room 8.3) | 8% / 24% | 0.0 / 2.4 / 0.0 | 28% (+1 ticks) |
| F4 | 3 | 120 | 6.3 | 33 / 67 / 0 / 0 | 9.7 (9–13) | 9.4 | 6.2 | 4.0 (0.5) | 34 | 54% (room 8.6) | 1% / 27% | 1.9 / 1.5 / 1.1 | 28% (−6 ticks) |
| F4 | 4 | 40 | 5.0 | 0 / 100 / 0 / 0 | 9.7 (9–13) | 8.1 | 6.2 | 3.7 (0.4) | 43 | 78% (room 7.7) | 3% / 25% | 0.1 / 2.1 / 0.0 | 28% (+7 ticks) |
| F5 | 1 | 34 | 13.5 | 74 / 26 / 0 / 0 | 9.8 (9–12) | 6.2 | 6.4 | 2.6 (0.4) | 43 | 38% (room 7.8) | 1% / 26% | 0.1 / 1.2 / 0.0 | 26% (+7 ticks) |
| F5 | 2 | 53 | 8.5 | 64 / 36 / 0 / 0 | 9.9 (9–12) | 6.8 | 6.5 | 2.6 (0.5) | 38 | 40% (room 8.4) | 11% / 18% | 0.1 / 1.7 / 0.0 | 19% (−1 ticks) |
| F5 | 3 | 103 | 7.6 | 39 / 59 / 2 / 0 | 9.9 (9–12) | 7.8 | 6.3 | 2.9 (0.6) | 36 | 53% (room 8.4) | 2% / 27% | 1.2 / 1.2 / 0.6 | 25% (−10 ticks) |
| F5 | 4 | 22 | 6.9 | 0 / 100 / 0 / 0 | 9.5 (9–12) | 5.5 | 6.4 | 2.1 (0.3) | 40 | 41% (room 7.1) | 4% / 33% | 0.5 / 0.7 / 0.0 | 18% (+4 ticks) |
| F6 | 1 | 8 | 15.3 | 100 / 0 / 0 / 0 | 11.5 (9–13) | 5.3 | 6.0 | 2.4 (0.0) | 44 | 0% | 5% / 5% | 0.0 / 0.6 / 0.0 | 38% (−8 ticks) |
| F6 | 2 | 21 | 10.2 | 95 / 5 / 0 / 0 | 10.5 (9–13) | 5.9 | 6.2 | 2.7 (0.1) | 41 | 0% | 5% / 18% | 0.0 / 1.0 / 0.0 | 38% (+3 ticks) |
| F6 | 3 | 56 | 9.3 | 54 / 43 / 4 / 0 | 10.7 (9–13) | 6.9 | 6.4 | 3.3 (0.4) | 46 | 0% | 2% / 19% | 0.8 / 0.8 / 0.5 | 32% (−3 ticks) |
| F6 | 4 | 9 | 9.2 | 33 / 67 / 0 / 0 | 10.9 (9–13) | 3.6 | 6.1 | 1.7 (0.0) | - | 0% | 0% / 27% | 0.1 / 0.2 / 0.0 | 33% |
| F7 | 1 | 80 | 16.0 | 50 / 50 / 0 / 0 | 10.9 (10–13) | 4.6 | 7.0 | 2.6 (0.4) | 58 | 0% | 11% / 18% | 0.1 / 0.4 / 0.0 | 30% (- ticks) |
| F7 | 2 | 80 | 12.5 | 50 / 50 / 0 / 0 | 10.9 (10–13) | 6.0 | 7.0 | 3.1 (0.5) | 47 | 0% | 11% / 19% | 0.1 / 0.7 / 0.0 | 30% (−9 ticks) |
| F7 | 3 | 120 | 12.0 | 33 / 67 / 0 / 0 | 10.9 (10–13) | 7.7 | 7.0 | 3.9 (0.5) | 44 | 0% | 5% / 28% | 0.2 / 0.9 / 0.0 | 30% (−1 ticks) |
| F7 | 4 | 40 | 11.0 | 0 / 100 / 0 / 0 | 10.9 (10–13) | 7.0 | 7.0 | 3.5 (0.5) | 70 | 0% | 11% / 21% | 0.2 / 0.9 / 0.0 | 30% (−4 ticks) |
| F8 | 1 | 80 | 17.0 | 50 / 50 / 0 / 0 | 4.0 (4–4) | 2.9 | 3.0 | 1.4 (0.0) | 21 | 0% | 14% / 12% | 0.0 / 0.0 / 0.0 | 0% |
| F8 | 2 | 80 | 14.0 | 50 / 50 / 0 / 0 | 4.0 (4–4) | 3.2 | 3.0 | 1.6 (0.0) | 28 | 0% | 13% / 14% | 0.0 / 0.0 / 0.0 | 0% |
| F8 | 3 | 120 | 13.3 | 0 / 100 / 0 / 0 | 4.0 (4–4) | 3.9 | 3.0 | 2.0 (0.0) | 19 | 0% | 6% / 18% | 0.0 / 0.0 / 0.0 | 0% |
| F8 | 4 | 40 | 13.0 | 0 / 100 / 0 / 0 | 4.0 (4–4) | 3.5 | 3.0 | 1.8 (0.0) | 30 | 0% | 10% / 14% | 0.0 / 0.0 / 0.0 | 0% |

**3b. Danger and reward**

| Floor | Party size | Gold found (p10–p90) | Of it, the boss fight | Target | Damage taken per hero (% max HP) | Downs / arrival | Deaths / arrival | Wipes / 100 arrivals | Torches | Light at the stairs (% Dark or Pitch) | Items found by grade (%) | Floor completed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F1 | 1 | 73 (34–109) | - | 80 | 74 | 0.24 | 0.13 | 12.5 | 0.00 | 72 (0%) | C 0 · D 2 · E 9 · F 89 | 86% |
| F1 | 2 | 95 (51–144) | - | 80 | 34 | 0.25 | 0.00 | 0.0 | 0.00 | 72 (0%) | C 1 · D 2 · E 9 · F 89 | 100% |
| F1 | 3 | 97 (59–145) | - | 80 | 21 | 0.26 | 0.00 | 0.0 | 0.00 | 72 (0%) | C 1 · D 3 · E 9 · F 87 | 96% |
| F1 | 4 | 133 (65–186) | - | 80 | 46 | 1.40 | 0.03 | 0.0 | 0.00 | 72 (0%) | C 1 · D 1 · E 8 · F 91 | 98% |
| F2 | 1 | 100 (0–205) | - | 100 | 107 | 0.59 | 0.29 | 29.0 | 0.00 | 81 (0%) | D 2 · E 10 · F 87 | 65% |
| F2 | 2 | 153 (75–265) | - | 100 | 67 | 1.10 | 0.04 | 0.0 | 0.00 | 79 (0%) | C 0 · D 5 · E 12 · F 83 | 94% |
| F2 | 3 | 140 (72–221) | - | 100 | 37 | 1.26 | 0.08 | 0.9 | 0.00 | 80 (0%) | C 0 · D 3 · E 14 · F 83 | 89% |
| F2 | 4 | 151 (55–255) | - | 100 | 74 | 3.28 | 0.49 | 5.1 | 0.00 | 80 (0%) | D 4 · E 12 · F 84 | 64% |
| F3 | 1 | 131 (15–245) | 83 | 120 | 244 | 1.67 | 0.73 | 73.3 | 0.00 | 71 (0%) | D 5 · E 8 · F 87 | 16% |
| F3 | 2 | 157 (41–302) | 114 | 120 | 272 | 5.61 | 1.36 | 68.0 | 0.00 | 76 (0%) | D 2 · E 7 · F 91 | 16% |
| F3 | 3 | 151 (35–272) | 91 | 120 | 173 | 7.09 | 1.86 | 62.7 | 0.00 | 81 (0%) | D 2 · E 8 · F 90 | 13% |
| F3 | 4 | 105 (50–187) | - | 120 | 146 | 7.36 | 2.24 | 40.0 | 0.00 | - (-) | D 3 · E 10 · F 88 | 0% |
| F4 | 1 | 119 (44–208) | - | 140 | 182 | 0.85 | 0.50 | 50.0 | 0.47 | 54 (0%) | C 4 · D 14 · E 26 · F 56 | 43% |
| F4 | 2 | 164 (101–238) | - | 140 | 152 | 2.19 | 0.45 | 15.0 | 0.63 | 53 (0%) | C 4 · D 14 · E 23 · F 59 | 66% |
| F4 | 3 | 179 (118–277) | - | 140 | 62 | 1.29 | 0.12 | 2.5 | 0.63 | 53 (1%) | B 1 · C 2 · D 15 · E 24 · F 58 | 86% |
| F4 | 4 | 207 (112–325) | - | 140 | 183 | 5.65 | 0.80 | 10.0 | 0.45 | 56 (0%) | B 0 · C 2 · D 11 · E 18 · F 68 | 55% |
| F5 | 1 | 77 (0–160) | - | 160 | 175 | 1.29 | 0.71 | 70.6 | 0.18 | 51 (0%) | B 1 · C 1 · D 12 · E 24 · F 62 | 24% |
| F5 | 2 | 111 (0–224) | - | 160 | 177 | 3.66 | 0.98 | 43.4 | 0.21 | 58 (0%) | C 1 · D 8 · E 26 · F 64 | 40% |
| F5 | 3 | 149 (28–274) | - | 160 | 98 | 3.81 | 0.79 | 19.4 | 0.21 | 57 (0%) | B 1 · C 3 · D 14 · E 22 · F 61 | 54% |
| F5 | 4 | 103 (0–261) | - | 160 | 155 | 6.41 | 2.00 | 45.5 | 0.09 | 62 (0%) | C 3 · D 8 · E 19 · F 70 | 41% |
| F6 | 1 | 93 (0–247) | 69 | 180 | 156 | 1.38 | 0.75 | 75.0 | 0.25 | 57 (0%) | C 3 · D 10 · E 16 · F 71 | 25% |
| F6 | 2 | 109 (0–182) | 71 | 180 | 188 | 4.48 | 1.38 | 61.9 | 0.19 | 67 (0%) | C 5 · D 9 · E 25 · F 61 | 19% |
| F6 | 3 | 146 (0–284) | 65 | 180 | 170 | 6.05 | 1.89 | 60.7 | 0.32 | 57 (0%) | A 1 · B 1 · C 1 · D 10 · E 22 · F 65 | 29% |
| F6 | 4 | 65 (0–189) | - | 180 | 133 | 7.89 | 3.56 | 77.8 | 0.00 | - (-) | E 39 · F 61 | 0% |
| F7 | 1 | 102 (0–259) | 122 | 370 | 221 | 1.73 | 0.94 | 93.8 | 0.04 | 70 (0%) | B 2 · C 8 · D 20 · E 7 · F 62 | 4% |
| F7 | 2 | 184 (36–367) | 144 | 370 | 251 | 4.20 | 1.70 | 76.3 | 0.09 | 68 (0%) | A 0 · B 3 · C 6 · D 27 · E 6 · F 57 | 6% |
| F7 | 3 | 259 (79–458) | 157 | 370 | 159 | 5.47 | 2.13 | 65.0 | 0.15 | 59 (0%) | A 0 · B 2 · C 10 · D 19 · E 6 · F 62 | 10% |
| F7 | 4 | 304 (63–546) | 260 | 370 | 244 | 9.38 | 3.30 | 77.5 | 0.13 | 51 (0%) | A 0 · B 2 · C 8 · D 13 · E 6 · F 71 | 5% |
| F8 | 1 | 63 (0–92) | 360 | 400 | 156 | 1.80 | 0.90 | 90.0 | 0.00 | 95 (0%) | B 11 · C 39 · D 4 · F 46 | 8% |
| F8 | 2 | 113 (0–423) | 343 | 400 | 173 | 4.14 | 1.70 | 83.8 | 0.00 | 95 (0%) | B 8 · C 32 · D 8 · F 53 | 13% |
| F8 | 3 | 147 (93–425) | 357 | 400 | 136 | 5.96 | 2.58 | 85.0 | 0.00 | 95 (0%) | B 10 · C 30 · D 5 · F 55 | 11% |
| F8 | 4 | 157 (0–217) | 339 | 400 | 205 | 9.90 | 3.52 | 87.5 | 0.00 | 95 (0%) | B 7 · C 16 · D 4 · F 73 | 5% |

**3c. Curio outcomes**

| Floor | Party size | Curios used / arrival | Outcome mix |
|---|---|---|---|
| F1 | 1 | 0.64 | loot 45% · reveal-floor 14% · cooking-ingredient 8% · ambush-encounter 6% · give-material 6% · nothing 6% · status-for-floor 4% · lantern-gutters 4% · applyStatus 4% · drop-item-of-grade 2% · tome-tier-1 2% |
| F1 | 2 | 0.68 | loot 48% · nothing 11% · reveal-floor 11% · applyStatus 9% · ambush-encounter 6% · status-for-floor 4% · lantern-gutters 4% · cooking-ingredient 4% · give-material 4% |
| F1 | 3 | 0.65 | loot 45% · nothing 14% · ambush-encounter 13% · cooking-ingredient 6% · reveal-floor 6% · status-for-floor 4% · lantern-gutters 4% · give-material 3% · status-next-fights 3% · applyStatus 1% · tome-tier-1 1% |
| F1 | 4 | 0.68 | loot 41% · nothing 30% · reveal-floor 15% · status-for-floor 4% · lantern-gutters 4% · cooking-ingredient 4% · applyStatus 4% |
| F2 | 1 | 0.71 | loot 29% · nothing 22% · light 12% · floor-gold-percent 10% · reveal-floor 6% · ambush-encounter 6% · applyStatus 4% · status-next-fights 4% · lantern-gutters 2% · give-material 2% · cooking-ingredient 2% |
| F2 | 2 | 0.91 | nothing 49% · loot 29% · light 7% · ambush-encounter 7% · floor-gold-percent 3% · cooking-ingredient 1% · status-next-fights 1% · reveal-floor 1% · give-material 1% |
| F2 | 3 | 0.88 | nothing 46% · loot 25% · ambush-encounter 6% · light 6% · reveal-floor 4% · floor-gold-percent 3% · give-material 3% · applyStatus 2% · tome-tier-1 2% · status-next-fights 2% · cooking-ingredient 1% · drop-item-of-grade 1% |
| F2 | 4 | 0.56 | nothing 55% · loot 23% · drop-item-of-grade 5% · status-next-fights 5% · reveal-floor 5% · give-material 5% · cooking-ingredient 5% |
| F3 | 1 | 1.04 | nothing 47% · loot 23% · floor-gold-percent 9% · give-material 6% · ambush-encounter 4% · status-next-fights 4% · light 2% · lantern-gutters 2% · reveal-floor 2% |
| F3 | 2 | 1.04 | nothing 74% · loot 14% · light 6% · reveal-floor 4% · applyStatus 1% |
| F3 | 3 | 0.89 | nothing 67% · loot 15% · light 8% · ambush-encounter 5% · floor-gold-percent 3% · status-next-fights 1% |
| F3 | 4 | 0.44 | nothing 82% · cooking-ingredient 9% · loot 9% |
| F4 | 1 | 0.94 | nothing 28% · light 24% · reveal-secret-and-key 11% · large-chest-appears 8% · smash-urns 5% · applyStatus 5% · repair-durability 4% · loot 4% · small-chest-appears 4% · resist-for-floor 4% · heal 1% · insight-roll 1% |
| F4 | 2 | 1.01 | nothing 35% · light 22% · large-chest-appears 7% · small-chest-appears 5% · reveal-secret-and-key 5% · smash-urns 5% · repair-durability 4% · loot 2% · applyStatus 2% · status-next-fights 2% · drop-item-of-grade 2% · heal 2% · cooking-ingredient 2% · status-for-floor 1% · resist-for-floor 1% |
| F4 | 3 | 1.11 | nothing 32% · light 20% · small-chest-appears 8% · large-chest-appears 6% · reveal-secret-and-key 5% · heal 5% · repair-durability 5% · smash-urns 4% · resist-for-floor 4% · insight-roll 3% · status-next-fights 3% · curio-fight 2% · applyStatus 2% · loot 2% · status-for-floor 1% · cooking-ingredient 1% · drop-item-of-grade 1% |
| F4 | 4 | 0.90 | nothing 39% · light 22% · reveal-secret-and-key 6% · repair-durability 6% · large-chest-appears 6% · smash-urns 6% · small-chest-appears 6% · resist-for-floor 3% · status-next-fights 3% · drop-item-of-grade 3% · applyStatus 3% |
| F5 | 1 | 0.47 | nothing 69% · heal 13% · small-chest-appears 13% · reveal-secret-and-key 6% |
| F5 | 2 | 0.72 | nothing 68% · light 11% · smash-urns 5% · cooking-ingredient 3% · status-for-floor 3% · insight-roll 3% · curio-fight 3% · small-chest-appears 3% · repair-durability 3% |
| F5 | 3 | 0.91 | nothing 41% · light 15% · small-chest-appears 12% · loot 6% · reveal-secret-and-key 3% · status-next-fights 3% · cooking-ingredient 3% · status-for-floor 3% · repair-durability 3% · smash-urns 2% · curio-fight 2% · large-chest-appears 2% · heal 1% · resist-for-floor 1% · insight-roll 1% |
| F5 | 4 | 0.55 | nothing 58% · small-chest-appears 17% · light 17% · smash-urns 8% |
| F6 | 1 | 0.50 | resist-for-floor 25% · reveal-secret-and-key 25% · applyStatus 25% · repair-durability 25% |
| F6 | 2 | 0.67 | nothing 86% · small-chest-appears 7% · light 7% |
| F6 | 3 | 0.70 | nothing 64% · small-chest-appears 13% · light 10% · loot 8% · large-chest-appears 3% · resist-for-floor 3% |
| F6 | 4 | 0.22 | small-chest-appears 50% · status-next-fights 50% |
| F7 | 1 | 0.34 | nothing 33% · drain-sluice 22% · resist-for-floor 11% · status-next-fights 7% · ambush-encounter 7% · roll-rare-part 7% · tome-of-tier 4% · large-chest-appears 4% · loot 4% |
| F7 | 2 | 0.49 | nothing 72% · status-next-fights 8% · drain-sluice 5% · resist-for-floor 5% · roll-rare-part 5% · ambush-encounter 5% |
| F7 | 3 | 0.63 | nothing 68% · status-next-fights 8% · ambush-encounter 5% · roll-rare-part 5% · drain-sluice 4% · resist-for-floor 4% · tome-of-tier 1% · loot 1% · large-chest-appears 1% · applyStatus 1% |
| F7 | 4 | 0.63 | nothing 76% · status-next-fights 8% · drain-sluice 4% · roll-rare-part 4% · resist-for-floor 4% · ambush-encounter 4% |

### dread · textbook

**3a. Exploration**

| Floor | Party size | Arrivals | Party level | Band on arrival (easy / even / dangerous / deadly %) | Rooms (min–max) | Visited | Straight-line hops | Fights (elites) | Ticks to the stairs | Hunter (% of arrivals, room) | Ambushed: party / monsters (% of fights) | Traps revealed / triggered / disarmed | Key and Lock (extra ticks) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F1 | 1 | 80 | 6.5 | 50 / 50 / 0 / 0 | 6.8 (5–8) | 5.7 | 4.9 | 2.3 (0.5) | 18 | 13% (room 5.8) | 36% / 10% | 0.4 / 0.6 / 0.2 | 25% (+6 ticks) |
| F1 | 2 | 80 | 3.0 | 50 / 50 / 0 / 0 | 6.8 (5–8) | 6.5 | 4.9 | 2.5 (0.5) | 18 | 19% (room 6.5) | 33% / 14% | 0.5 / 0.8 / 0.2 | 25% (−0 ticks) |
| F1 | 3 | 120 | 2.3 | 33 / 67 / 0 / 0 | 6.8 (5–8) | 6.5 | 4.9 | 2.5 (0.5) | 19 | 28% (room 6.3) | 20% / 19% | 1.2 / 0.6 / 0.6 | 25% (+2 ticks) |
| F1 | 4 | 40 | 1.0 | 0 / 100 / 0 / 0 | 6.8 (5–8) | 5.4 | 4.9 | 2.0 (0.4) | 20 | 35% (room 5.6) | 33% / 12% | 0.5 / 0.7 / 0.1 | 25% (+9 ticks) |
| F2 | 1 | 53 | 9.2 | 81 / 19 / 0 / 0 | 9.0 (8–11) | 6.0 | 5.6 | 2.3 (0.5) | 27 | 47% (room 6.6) | 20% / 27% | 0.5 / 0.4 / 0.3 | 23% (+1 ticks) |
| F2 | 2 | 74 | 4.2 | 69 / 31 / 0 / 0 | 8.9 (8–11) | 7.7 | 5.6 | 2.9 (0.5) | 30 | 65% (room 7.7) | 19% / 24% | 0.9 / 0.9 / 0.4 | 23% (−2 ticks) |
| F2 | 3 | 104 | 3.6 | 47 / 53 / 0 / 0 | 9.0 (8–11) | 7.2 | 5.6 | 2.6 (0.6) | 31 | 57% (room 7.8) | 15% / 29% | 1.9 / 0.8 / 1.1 | 23% (−5 ticks) |
| F2 | 4 | 21 | 2.4 | 10 / 90 / 0 / 0 | 9.0 (8–11) | 5.9 | 5.7 | 2.1 (0.6) | 33 | 38% (room 7.8) | 20% / 23% | 0.8 / 0.5 / 0.4 | 24% (−17 ticks) |
| F3 | 1 | 13 | 10.8 | 92 / 8 / 0 / 0 | 10.4 (9–12) | 4.5 | 6.4 | 2.2 (0.3) | - | 0% | 7% / 31% | 0.5 / 0.2 / 0.5 | 23% |
| F3 | 2 | 40 | 5.9 | 68 / 33 / 0 / 0 | 10.1 (8–12) | 4.5 | 6.3 | 2.5 (0.3) | - | 0% | 18% / 21% | 0.3 / 0.6 / 0.1 | 25% |
| F3 | 3 | 55 | 5.6 | 64 / 36 / 0 / 0 | 10.1 (8–12) | 4.0 | 6.3 | 2.0 (0.3) | - | 0% | 13% / 33% | 0.9 / 0.4 / 0.3 | 25% |
| F3 | 4 | 7 | 4.6 | 14 / 86 / 0 / 0 | 10.4 (9–11) | 3.3 | 6.1 | 1.9 (0.4) | - | 0% | 15% / 46% | 0.6 / 0.7 / 0.1 | 0% |
| F4 | 1 | 80 | 10.5 | 50 / 50 / 0 / 0 | 9.7 (9–13) | 6.8 | 6.3 | 3.2 (0.5) | 36 | 70% (room 6.7) | 8% / 16% | 0.0 / 1.8 / 0.0 | 28% (−1 ticks) |
| F4 | 2 | 80 | 7.0 | 50 / 50 / 0 / 0 | 9.7 (9–13) | 7.3 | 6.3 | 3.6 (0.6) | 38 | 71% (room 6.7) | 10% / 16% | 0.0 / 2.1 / 0.0 | 28% (−2 ticks) |
| F4 | 3 | 120 | 6.3 | 33 / 67 / 0 / 0 | 9.7 (9–13) | 7.2 | 6.3 | 3.4 (0.5) | 45 | 78% (room 6.3) | 5% / 23% | 0.2 / 2.0 / 0.1 | 28% (+1 ticks) |
| F4 | 4 | 40 | 5.0 | 0 / 100 / 0 / 0 | 9.7 (9–13) | 4.8 | 6.3 | 2.0 (0.4) | 47 | 48% (room 4.7) | 7% / 21% | 0.1 / 1.3 / 0.0 | 28% (- ticks) |
| F5 | 1 | 17 | 15.1 | 94 / 6 / 0 / 0 | 9.8 (9–12) | 4.9 | 6.2 | 1.9 (0.3) | 46 | 35% (room 6.8) | 9% / 27% | 0.1 / 0.8 / 0.0 | 29% (+6 ticks) |
| F5 | 2 | 22 | 8.9 | 82 / 18 / 0 / 0 | 9.9 (9–12) | 4.7 | 6.7 | 1.7 (0.2) | 44 | 32% (room 6.3) | 3% / 21% | 0.0 / 1.3 / 0.0 | 32% (+24 ticks) |
| F5 | 3 | 41 | 8.8 | 76 / 24 / 0 / 0 | 9.7 (9–12) | 4.7 | 6.3 | 1.9 (0.4) | 37 | 27% (room 6.0) | 1% / 29% | 0.3 / 0.7 / 0.2 | 24% (−23 ticks) |
| F5 | 4 | 3 | 7.0 | 0 / 100 / 0 / 0 | 10.3 (10–11) | 3.3 | 6.0 | 1.0 (0.3) | - | 0% | 0% / 33% | 0.3 / 1.0 / 0.0 | 33% |
| F6 | 1 | 3 | 16.0 | 100 / 0 / 0 / 0 | 11.0 (10–12) | 3.3 | 6.7 | 2.0 (0.0) | - | 0% | 17% / 17% | 0.0 / 0.0 / 0.0 | 67% |
| F6 | 2 | 3 | 11.0 | 100 / 0 / 0 / 0 | 10.7 (9–12) | 2.7 | 6.0 | 1.7 (0.7) | - | 0% | 0% / 0% | 0.0 / 0.3 / 0.0 | 67% |
| F6 | 3 | 6 | 10.2 | 67 / 33 / 0 / 0 | 11.0 (9–13) | 3.0 | 6.3 | 1.5 (0.2) | - | 0% | 0% / 22% | 0.2 / 0.7 / 0.2 | 33% |
| F7 | 1 | 80 | 16.0 | 50 / 50 / 0 / 0 | 11.1 (10–13) | 3.7 | 6.9 | 2.0 (0.4) | - | 0% | 17% / 17% | 0.1 / 0.7 / 0.0 | 28% |
| F7 | 2 | 80 | 12.5 | 50 / 50 / 0 / 0 | 11.1 (10–13) | 3.6 | 6.9 | 1.9 (0.4) | - | 0% | 11% / 19% | 0.1 / 0.7 / 0.0 | 28% |
| F7 | 3 | 120 | 12.0 | 33 / 67 / 0 / 0 | 11.1 (10–13) | 4.4 | 6.9 | 2.3 (0.4) | - | 0% | 10% / 23% | 0.1 / 0.8 / 0.0 | 28% |
| F7 | 4 | 40 | 11.0 | 0 / 100 / 0 / 0 | 11.1 (10–13) | 2.8 | 6.9 | 1.4 (0.3) | - | 0% | 9% / 23% | 0.1 / 0.2 / 0.0 | 28% |
| F8 | 1 | 80 | 17.0 | 50 / 50 / 0 / 0 | 4.0 (4–4) | 2.1 | 3.0 | 1.1 (0.0) | 46 | 0% | 19% / 16% | 0.0 / 0.0 / 0.0 | 0% |
| F8 | 2 | 80 | 14.0 | 50 / 50 / 0 / 0 | 4.0 (4–4) | 2.5 | 3.0 | 1.2 (0.0) | 44 | 0% | 16% / 18% | 0.0 / 0.0 / 0.0 | 0% |
| F8 | 3 | 120 | 13.3 | 0 / 100 / 0 / 0 | 4.0 (4–4) | 2.4 | 3.0 | 1.2 (0.0) | - | 0% | 10% / 28% | 0.0 / 0.0 / 0.0 | 0% |
| F8 | 4 | 40 | 13.0 | 0 / 100 / 0 / 0 | 4.0 (4–4) | 2.1 | 3.0 | 1.1 (0.0) | - | 0% | 17% / 24% | 0.0 / 0.0 / 0.0 | 0% |

**3b. Danger and reward**

| Floor | Party size | Gold found (p10–p90) | Of it, the boss fight | Target | Damage taken per hero (% max HP) | Downs / arrival | Deaths / arrival | Wipes / 100 arrivals | Torches | Light at the stairs (% Dark or Pitch) | Items found by grade (%) | Floor completed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F1 | 1 | 79 (27–142) | - | 80 | 123 | 0.46 | 0.25 | 25.0 | 0.04 | 54 (0%) | C 1 · D 6 · E 11 · F 81 | 66% |
| F1 | 2 | 119 (67–182) | - | 80 | 55 | 0.56 | 0.05 | 0.0 | 0.09 | 55 (0%) | C 2 · D 10 · E 10 · F 78 | 93% |
| F1 | 3 | 133 (71–192) | - | 80 | 49 | 1.36 | 0.11 | 1.7 | 0.08 | 55 (0%) | C 1 · D 7 · E 13 · F 79 | 87% |
| F1 | 4 | 138 (60–230) | - | 80 | 82 | 2.88 | 0.65 | 5.0 | 0.00 | 52 (0%) | C 2 · D 8 · E 8 · F 83 | 53% |
| F2 | 1 | 85 (0–193) | - | 100 | 157 | 0.92 | 0.51 | 50.9 | 0.00 | 85 (0%) | C 2 · D 10 · E 15 · F 73 | 25% |
| F2 | 2 | 146 (56–259) | - | 100 | 146 | 2.73 | 0.59 | 27.0 | 0.00 | 82 (0%) | C 2 · D 9 · E 13 · F 76 | 54% |
| F2 | 3 | 158 (41–316) | - | 100 | 94 | 3.91 | 0.71 | 16.3 | 0.00 | 82 (0%) | C 2 · D 11 · E 13 · F 74 | 53% |
| F2 | 4 | 128 (48–258) | - | 100 | 108 | 5.14 | 1.38 | 23.8 | 0.00 | 79 (0%) | C 1 · D 5 · E 11 · F 83 | 33% |
| F3 | 1 | 62 (0–177) | - | 120 | 191 | 2.00 | 1.00 | 100.0 | 0.00 | - (-) | D 13 · E 17 · F 71 | 0% |
| F3 | 2 | 85 (0–213) | - | 120 | 194 | 4.67 | 1.55 | 70.0 | 0.00 | - (-) | D 7 · E 11 · F 82 | 0% |
| F3 | 3 | 72 (0–158) | - | 120 | 136 | 6.76 | 2.36 | 67.3 | 0.00 | - (-) | D 4 · E 13 · F 83 | 0% |
| F3 | 4 | 62 (0–174) | - | 120 | 135 | 9.57 | 3.71 | 85.7 | 0.00 | - (-) | D 7 · E 7 · F 87 | 0% |
| F4 | 1 | 109 (27–189) | - | 140 | 226 | 1.20 | 0.74 | 73.8 | 0.78 | 47 (0%) | B 2 · C 11 · D 13 · E 20 · F 54 | 21% |
| F4 | 2 | 148 (43–228) | - | 140 | 239 | 4.05 | 1.23 | 52.5 | 0.95 | 48 (0%) | B 2 · C 9 · D 9 · E 19 · F 60 | 28% |
| F4 | 3 | 177 (56–304) | - | 140 | 167 | 5.08 | 1.33 | 37.5 | 1.06 | 50 (0%) | B 1 · C 8 · D 13 · E 18 · F 61 | 34% |
| F4 | 4 | 119 (49–254) | - | 140 | 196 | 7.30 | 2.67 | 55.0 | 0.30 | 56 (0%) | B 2 · C 10 · D 7 · E 10 · F 70 | 8% |
| F5 | 1 | 62 (0–177) | - | 160 | 174 | 1.47 | 0.82 | 82.4 | 0.06 | 47 (0%) | C 14 · D 12 · E 12 · F 63 | 18% |
| F5 | 2 | 57 (0–193) | - | 160 | 157 | 3.64 | 1.27 | 54.5 | 0.09 | 46 (0%) | C 11 · D 9 · E 13 · F 67 | 14% |
| F5 | 3 | 81 (0–228) | - | 160 | 138 | 6.02 | 2.27 | 70.7 | 0.02 | 51 (0%) | B 2 · C 5 · D 13 · E 13 · F 67 | 15% |
| F5 | 4 | 0 (0–0) | - | 160 | 117 | 8.00 | 4.00 | 100.0 | 0.00 | - (-) | - | 0% |
| F6 | 1 | 55 (0–116) | - | 180 | 141 | 2.00 | 1.00 | 100.0 | 0.00 | - (-) | D 33 · E 17 · F 50 | 0% |
| F6 | 2 | 40 (0–90) | - | 180 | 230 | 4.33 | 2.00 | 100.0 | 0.00 | - (-) | E 33 · F 67 | 0% |
| F6 | 3 | 54 (0–174) | - | 180 | 121 | 6.33 | 3.00 | 100.0 | 0.17 | - (-) | C 8 · D 17 · E 8 · F 67 | 0% |
| F7 | 1 | 77 (0–233) | - | 370 | 241 | 1.81 | 0.96 | 96.3 | 0.25 | - (-) | A 1 · B 4 · C 13 · D 13 · E 7 · F 63 | 0% |
| F7 | 2 | 99 (0–242) | - | 370 | 183 | 3.99 | 1.85 | 85.0 | 0.21 | - (-) | A 1 · B 6 · C 10 · D 17 · E 7 · F 60 | 0% |
| F7 | 3 | 144 (0–324) | - | 370 | 165 | 6.16 | 2.63 | 83.3 | 0.33 | - (-) | A 1 · B 4 · C 12 · D 14 · E 5 · F 64 | 0% |
| F7 | 4 | 72 (0–252) | - | 370 | 152 | 8.30 | 3.92 | 97.5 | 0.03 | - (-) | B 11 · C 7 · D 9 · E 5 · F 67 | 0% |
| F8 | 1 | 12 (0–0) | 400 | 400 | 144 | 1.91 | 0.99 | 98.8 | 0.00 | 75 (0%) | C 20 · D 40 · F 40 | 1% |
| F8 | 2 | 39 (0–141) | 493 | 400 | 172 | 4.19 | 1.96 | 97.5 | 0.00 | 75 (0%) | B 7 · C 27 · D 7 · F 60 | 1% |
| F8 | 3 | 42 (0–182) | - | 400 | 151 | 6.44 | 2.93 | 97.5 | 0.00 | - (-) | B 3 · C 20 · D 7 · F 70 | 0% |
| F8 | 4 | 18 (0–0) | - | 400 | 184 | 8.07 | 3.83 | 95.0 | 0.00 | - (-) | C 13 · F 88 | 0% |

**3c. Curio outcomes**

| Floor | Party size | Curios used / arrival | Outcome mix |
|---|---|---|---|
| F1 | 1 | 0.57 | loot 46% · nothing 11% · reveal-floor 11% · applyStatus 9% · give-material 7% · status-for-floor 4% · lantern-gutters 4% · drop-item-of-grade 2% · floor-gold-percent 2% · status-next-fights 2% · tome-tier-1 2% |
| F1 | 2 | 0.65 | loot 42% · nothing 21% · applyStatus 13% · reveal-floor 8% · ambush-encounter 4% · status-for-floor 4% · lantern-gutters 4% · floor-gold-percent 2% · tome-tier-1 2% |
| F1 | 3 | 0.66 | loot 44% · nothing 19% · reveal-floor 10% · cooking-ingredient 6% · ambush-encounter 6% · status-for-floor 4% · lantern-gutters 4% · give-material 4% · floor-gold-percent 1% · status-next-fights 1% |
| F1 | 4 | 0.63 | loot 48% · nothing 24% · reveal-floor 12% · applyStatus 8% · status-for-floor 4% · lantern-gutters 4% |
| F2 | 1 | 0.40 | nothing 33% · floor-gold-percent 14% · loot 14% · give-material 10% · ambush-encounter 10% · applyStatus 10% · status-next-fights 10% |
| F2 | 2 | 0.76 | nothing 59% · loot 21% · give-material 7% · floor-gold-percent 4% · status-next-fights 2% · reveal-floor 2% · ambush-encounter 2% · drop-item-of-grade 2% · light 2% |
| F2 | 3 | 0.64 | nothing 58% · loot 13% · status-next-fights 6% · give-material 6% · applyStatus 4% · drop-item-of-grade 4% · light 4% · cooking-ingredient 1% · floor-gold-percent 1% |
| F2 | 4 | 0.62 | nothing 46% · loot 15% · floor-gold-percent 15% · lantern-gutters 8% · ambush-encounter 8% · light 8% |
| F3 | 1 | 0.46 | nothing 83% · loot 17% |
| F3 | 2 | 0.50 | nothing 65% · loot 20% · light 10% · lantern-gutters 5% |
| F3 | 3 | 0.47 | nothing 73% · loot 15% · light 4% · cooking-ingredient 4% · floor-gold-percent 4% |
| F4 | 1 | 0.74 | nothing 37% · light 19% · reveal-secret-and-key 12% · large-chest-appears 7% · smash-urns 7% · applyStatus 5% · small-chest-appears 3% · status-for-floor 2% · repair-durability 2% · insight-roll 2% · give-material 2% · resist-for-floor 2% · loot 2% |
| F4 | 2 | 0.78 | nothing 44% · light 26% · reveal-secret-and-key 6% · large-chest-appears 6% · repair-durability 3% · smash-urns 3% · small-chest-appears 3% · loot 2% · resist-for-floor 2% · status-for-floor 2% · insight-roll 2% · status-next-fights 2% |
| F4 | 3 | 0.78 | nothing 52% · light 23% · large-chest-appears 6% · reveal-secret-and-key 3% · smash-urns 3% · small-chest-appears 3% · curio-fight 1% · heal 1% · status-next-fights 1% · repair-durability 1% · status-for-floor 1% · insight-roll 1% · applyStatus 1% · resist-for-floor 1% |
| F4 | 4 | 0.42 | light 41% · nothing 35% · large-chest-appears 12% · reveal-secret-and-key 6% · smash-urns 6% |
| F5 | 1 | 0.29 | nothing 40% · curio-fight 20% · small-chest-appears 20% · cooking-ingredient 20% |
| F5 | 2 | 0.36 | nothing 63% · light 25% · large-chest-appears 13% |
| F5 | 3 | 0.39 | nothing 38% · light 19% · small-chest-appears 19% · reveal-secret-and-key 6% · curio-fight 6% · loot 6% · smash-urns 6% |
| F5 | 4 | 0.33 | nothing 100% |
| F6 | 3 | 0.17 | nothing 100% |
| F7 | 1 | 0.26 | nothing 24% · drain-sluice 19% · status-next-fights 19% · ambush-encounter 14% · large-chest-appears 10% · resist-for-floor 10% · roll-rare-part 5% |
| F7 | 2 | 0.33 | nothing 62% · drain-sluice 8% · status-next-fights 8% · large-chest-appears 8% · resist-for-floor 8% · ambush-encounter 8% |
| F7 | 3 | 0.39 | nothing 70% · status-next-fights 9% · resist-for-floor 6% · ambush-encounter 6% · drain-sluice 4% · large-chest-appears 4% |
| F7 | 4 | 0.17 | nothing 29% · drain-sluice 14% · status-next-fights 14% · large-chest-appears 14% · resist-for-floor 14% · ambush-encounter 14% |

## 4. Boss floors: rounds to kill and the arena (07 §8.2)

*From the delve's `stats.bossArenas` (arena.ts writes one row per boss fight); "won" is the party's victory. Lanterns out = Vexa's crew shot at least one; six candles = the Warden's doors opened; tide step 4 = Naesa's water reached step 4; third Throne hunter = the third returning hunter entered.*

| Boss | Floor | Party size | Fights | Won | Rounds to kill | Phase reached | Lanterns out | Six candles | Tide step 4 | Third Throne hunter | Braziers lit | Re-calls | Hunters returned | Parts broken | Tells shown | Lowest light |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| the Barrow Warden | F6 | 1 | 195 | 97% | 6.4 | 1.9 | 0% | 94% | 0% | 0% | 0.0 | 1.0 | 0.0 | 1.0 | 4.9 | 42 |
| the Barrow Warden | F6 | 2 | 424 | 47% | 6.4 | 1.9 | 0% | 95% | 0% | 0% | 0.0 | 1.4 | 0.0 | 1.0 | 5.1 | 48 |
| the Barrow Warden | F6 | 3 | 557 | 64% | 6.5 | 2.0 | 0% | 99% | 0% | 0% | 0.0 | 1.2 | 0.0 | 1.8 | 6.0 | 49 |
| the Barrow Warden | F6 | 4 | 309 | 68% | 7.6 | 2.0 | 0% | 100% | 0% | 0% | 0.0 | 1.2 | 0.0 | 1.7 | 6.6 | 49 |
| Captain Vexa Marrow, the Grinning Captain | F3 | 1 | 525 | 38% | 14.6 | 1.9 | 98% | 0% | 0% | 0% | 0.0 | 2.1 | 0.0 | 1.0 | 17.2 | 23 |
| Captain Vexa Marrow, the Grinning Captain | F3 | 2 | 631 | 47% | 13.3 | 1.9 | 100% | 0% | 0% | 0% | 0.0 | 2.1 | 0.0 | 0.0 | 13.0 | 34 |
| Captain Vexa Marrow, the Grinning Captain | F3 | 3 | 785 | 51% | 11.5 | 2.0 | 100% | 0% | 0% | 0% | 0.0 | 2.0 | 0.0 | 1.5 | 11.2 | 37 |
| Captain Vexa Marrow, the Grinning Captain | F3 | 4 | 321 | 49% | 18.2 | 1.9 | 100% | 0% | 0% | 0% | 0.0 | 2.8 | 0.0 | 0.0 | 17.3 | 37 |
| the Hollow King | F8 | 1 | 500 | 38% | 8.0 | 2.8 | 0% | 0% | 83% | 16% | 1.9 | 2.6 | 0.9 | 1.0 | 19.1 | 67 |
| the Hollow King | F8 | 2 | 624 | 58% | 5.9 | 3.0 | 0% | 0% | 97% | 5% | 2.8 | 3.3 | 0.6 | 1.6 | 10.2 | 70 |
| the Hollow King | F8 | 3 | 1012 | 48% | 6.3 | 3.0 | 0% | 0% | 97% | 7% | 2.9 | 3.3 | 0.9 | 0.4 | 12.9 | 70 |
| the Hollow King | F8 | 4 | 361 | 40% | 7.6 | 2.9 | 0% | 0% | 86% | 7% | 2.9 | 3.4 | 0.9 | 0.0 | 13.8 | 70 |
| Sister Naesa, the Tidebound Priestess | F7 | 1 | 428 | 50% | 14.2 | 1.6 | 0% | 0% | 7% | 0% | 0.0 | 1.3 | 0.0 | 0.9 | 16.0 | 40 |
| Sister Naesa, the Tidebound Priestess | F7 | 2 | 725 | 58% | 10.9 | 1.9 | 0% | 0% | 9% | 0% | 0.0 | 1.7 | 0.0 | 1.0 | 9.2 | 40 |
| Sister Naesa, the Tidebound Priestess | F7 | 3 | 1038 | 58% | 8.8 | 1.9 | 0% | 0% | 26% | 0% | 0.0 | 1.2 | 0.0 | 1.0 | 10.4 | 40 |
| Sister Naesa, the Tidebound Priestess | F7 | 4 | 406 | 69% | 10.9 | 1.9 | 0% | 0% | 8% | 0% | 0.0 | 3.8 | 0.0 | 0.1 | 13.4 | 40 |

**The back row** (07 §2.8: behind Vexa's barricade and around the throne only bows, spells and reach weapons hit it): the back-row adds' share of the damage the enemy side dealt, and the fights in which nobody ever hit them.

| Boss | Fights | Back-row adds' share of the enemies' damage | Fights with the back row never hit |
|---|---|---|---|
| the Barrow Warden | 1485 | 13% | 77% |
| Captain Vexa Marrow, the Grinning Captain | 2262 | 34% | 23% |
| the Hollow King | 2497 | 19% | 73% |
| Sister Naesa, the Tidebound Priestess | 2597 | 32% | 13% |

## 4b. What brings heroes down

*Judged cells only (the textbook player on Normal, every death rule): a death is a hero past the revive window when a fight ends (D-088). "Status ticks" is the share of the damage heroes took that came from Poison, Bleed, Burn and the other damage-over-time statuses.*

| Fight kind | Fights | Fights with a death | Deaths | Share of all deaths |
|---|---|---|---|---|
| boss | 8841 | 34% | 4443 | 76% |
| fight | 49641 | 1% | 606 | 10% |
| elite | 7683 | 5% | 507 | 9% |
| trap | 1450 | 11% | 166 | 3% |
| hunter | 729 | 15% | 119 | 2% |
| curio | 1065 | 0% | 0 | 0% |

**The deadliest fights** (kind, floor and the monsters met; ten with the most deaths):

| Fight | Floor | Monsters | Fights | Deaths | Deaths / fight |
|---|---|---|---|---|---|
| boss | F3 | Captain Vexa Marrow, the Grinning Captain, Grinning Crossbowman, Grinning Cutpurse, Grinning Netter | 2136 | 1252 | 0.59 |
| boss | F7 | Deep Tentacle, Sister Naesa, the Tidebound Priestess, Tidebound Acolyte, Tidebound Blade | 1050 | 954 | 0.91 |
| boss | F6 | the Barrow Warden, Skeleton Footman, The Warden's Hound, Wraith | 1103 | 675 | 0.61 |
| boss | F7 | Sister Naesa, the Tidebound Priestess, Tidebound Acolyte, Tidebound Blade | 1547 | 356 | 0.23 |
| boss | F8 | Deep Tentacle, the Hollow King, Old Gnaw, Skeleton Footman, Vault Lantern, The Warden's Hound, Wraith | 121 | 136 | 1.12 |
| boss | F8 | Deep Tentacle, Giant Rat, Grinning Crossbowman, the Hollow King, Old Gnaw, Skeleton Footman, The Warden's Hound, Wraith | 97 | 136 | 1.40 |
| trap | F3 | Plague Rat | 425 | 127 | 0.30 |
| boss | F8 | Giant Rat, Grinning Crossbowman, the Hollow King, Skeleton Footman, Wraith | 167 | 119 | 0.71 |
| boss | F8 | Deep Tentacle, Giant Rat, Grinning Crossbowman, the Hollow King, Old Gnaw, Skeleton Footman, Vault Lantern, The Warden's Hound, Wraith | 82 | 111 | 1.35 |
| boss | F8 | Deep Tentacle, Giant Rat, Grinning Crossbowman, the Hollow King, Old Gnaw, Skeleton Footman, Wraith | 141 | 106 | 0.75 |

**Status ticks** (share of the damage heroes took, by floor): F1 38% · F2 34% · F3 26% · F4 40% · F5 29% · F6 17% · F7 15% · F8 2%

## 5. Fight length (rounds) by fight kind

| Recipe | fight | elite | boss | hunter | trap/curio |
|---|---|---|---|---|---|
| solo warden, fresh · Sheltered · normal · textbook | 4.2 (n=554) | 7.4 (n=88) | 19.5 (n=48) | 11.3 (n=4) | 7.1 |
| solo warden, fresh · Mortal · normal · textbook | 4.2 (n=554) | 7.4 (n=88) | 19.5 (n=48) | 11.3 (n=4) | 7.1 |
| solo warden, fresh · Nightmare · normal · textbook | 4.2 (n=554) | 7.4 (n=88) | 19.5 (n=48) | 11.3 (n=4) | 7.1 |
| solo warden, ground (L12, D gear) · Sheltered · normal · textbook | 2.8 (n=771) | 5.0 (n=120) | 21.4 (n=127) | - (n=0) | 5.4 |
| solo warden, ground (L12, D gear) · Mortal · normal · textbook | 2.8 (n=771) | 5.0 (n=120) | 21.4 (n=127) | - (n=0) | 5.4 |
| solo warden, ground (L12, D gear) · Nightmare · normal · textbook | 2.8 (n=771) | 5.0 (n=120) | 21.4 (n=127) | - (n=0) | 5.4 |
| classic four, fresh: warden, blade, mender, arcanist · Sheltered · normal · textbook | 3.6 (n=765) | 5.3 (n=119) | 23.3 (n=130) | 6.3 (n=3) | 7.3 |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · textbook | 3.6 (n=736) | 5.3 (n=114) | 20.3 (n=106) | 6.3 (n=3) | 7.2 |
| classic four, fresh: warden, blade, mender, arcanist · Nightmare · normal · textbook | 3.6 (n=735) | 5.3 (n=114) | 22.8 (n=85) | 6.3 (n=3) | 7.2 |
| crypt-breakers, fresh: mender, warden, ranger · Sheltered · normal · textbook | 3.1 (n=767) | 4.4 (n=118) | 17.6 (n=100) | 13.0 (n=2) | 5.4 |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · textbook | 3.1 (n=755) | 4.4 (n=117) | 17.6 (n=98) | 13.0 (n=2) | 5.4 |
| crypt-breakers, fresh: mender, warden, ranger · Nightmare · normal · textbook | 3.1 (n=755) | 4.4 (n=117) | 17.9 (n=95) | 13.0 (n=2) | 5.4 |
| glass cannons, fresh: arcanist, shade, ranger · Sheltered · normal · textbook | 3.8 (n=682) | 4.8 (n=95) | 19.2 (n=70) | 14.0 (n=1) | 5.2 |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · textbook | 3.7 (n=656) | 4.7 (n=93) | 18.1 (n=65) | 14.0 (n=1) | 5.2 |
| glass cannons, fresh: arcanist, shade, ranger · Nightmare · normal · textbook | 3.7 (n=656) | 4.7 (n=93) | 19.8 (n=56) | 14.0 (n=1) | 5.2 |
| the pair, fresh: blade, mender · Sheltered · normal · textbook | 2.9 (n=740) | 4.3 (n=114) | 21.2 (n=106) | - (n=0) | 4.5 |
| the pair, fresh: blade, mender · Mortal · normal · textbook | 2.9 (n=734) | 4.3 (n=113) | 20.1 (n=106) | - (n=0) | 4.5 |
| the pair, fresh: blade, mender · Nightmare · normal · textbook | 2.9 (n=734) | 4.3 (n=113) | 19.8 (n=99) | - (n=0) | 4.5 |
| crypt-breakers, levelled (L5, E gear) · Sheltered · normal · textbook | 2.5 (n=766) | 3.3 (n=119) | 11.9 (n=101) | - (n=0) | 3.8 |
| crypt-breakers, levelled (L5, E gear) · Mortal · normal · textbook | 2.5 (n=766) | 3.3 (n=119) | 11.9 (n=101) | - (n=0) | 3.8 |
| crypt-breakers, levelled (L5, E gear) · Nightmare · normal · textbook | 2.5 (n=766) | 3.3 (n=119) | 11.9 (n=99) | - (n=0) | 3.8 |
| the pair, levelled (L5, E gear) · Sheltered · normal · textbook | 2.6 (n=766) | 3.6 (n=118) | 15.7 (n=107) | - (n=0) | 3.5 |
| the pair, levelled (L5, E gear) · Mortal · normal · textbook | 2.6 (n=764) | 3.6 (n=116) | 15.9 (n=108) | - (n=0) | 3.5 |
| the pair, levelled (L5, E gear) · Nightmare · normal · textbook | 2.6 (n=764) | 3.6 (n=116) | 15.5 (n=105) | - (n=0) | 3.5 |
| solo warden, arriving (L5, E gear) · Sheltered · normal · textbook | 5.2 (n=536) | 8.5 (n=100) | 7.5 (n=11) | 12.9 (n=25) | 2.2 |
| solo warden, arriving (L5, E gear) · Mortal · normal · textbook | 5.2 (n=536) | 8.5 (n=100) | 7.5 (n=11) | 12.9 (n=25) | 2.2 |
| solo warden, arriving (L5, E gear) · Nightmare · normal · textbook | 5.2 (n=536) | 8.5 (n=100) | 7.5 (n=11) | 12.9 (n=25) | 2.2 |
| solo warden, ground (L16, C gear) · Sheltered · normal · textbook | 4.2 (n=803) | 9.1 (n=152) | 6.3 (n=54) | 15.3 (n=23) | 2.2 |
| solo warden, ground (L16, C gear) · Mortal · normal · textbook | 4.2 (n=803) | 9.1 (n=152) | 6.3 (n=54) | 15.3 (n=23) | 2.2 |
| solo warden, ground (L16, C gear) · Nightmare · normal · textbook | 4.2 (n=803) | 9.1 (n=152) | 6.3 (n=54) | 15.3 (n=23) | 2.2 |
| classic four, arriving (L5, E gear) · Sheltered · normal · textbook | 5.2 (n=933) | 7.2 (n=165) | 9.4 (n=93) | 8.9 (n=38) | 1.6 |
| classic four, arriving (L5, E gear) · Mortal · normal · textbook | 5.1 (n=861) | 7.0 (n=152) | 9.3 (n=81) | 9.3 (n=33) | 1.6 |
| classic four, arriving (L5, E gear) · Nightmare · normal · textbook | 5.1 (n=861) | 6.9 (n=151) | 9.4 (n=80) | 9.3 (n=33) | 1.6 |
| crypt-breakers, arriving (L5, E gear) · Sheltered · normal · textbook | 4.4 (n=889) | 6.4 (n=157) | 8.7 (n=83) | 7.7 (n=38) | 1.7 |
| crypt-breakers, arriving (L5, E gear) · Mortal · normal · textbook | 4.4 (n=878) | 6.3 (n=154) | 8.6 (n=79) | 7.6 (n=36) | 1.7 |
| crypt-breakers, arriving (L5, E gear) · Nightmare · normal · textbook | 4.4 (n=877) | 6.3 (n=154) | 8.6 (n=78) | 7.6 (n=36) | 1.7 |
| glass cannons, arriving (L5, E gear) · Sheltered · normal · textbook | 6.1 (n=644) | 9.0 (n=114) | 12.9 (n=12) | 8.2 (n=36) | 2.0 |
| glass cannons, arriving (L5, E gear) · Mortal · normal · textbook | 6.0 (n=625) | 8.9 (n=110) | 12.6 (n=10) | 8.1 (n=34) | 2.0 |
| glass cannons, arriving (L5, E gear) · Nightmare · normal · textbook | 6.0 (n=624) | 8.9 (n=110) | 12.6 (n=10) | 8.1 (n=34) | 2.0 |
| the pair, arriving (L5, E gear) · Sheltered · normal · textbook | 4.3 (n=854) | 6.5 (n=154) | 7.8 (n=65) | 11.8 (n=29) | 2.0 |
| the pair, arriving (L5, E gear) · Mortal · normal · textbook | 4.2 (n=806) | 6.3 (n=144) | 7.7 (n=56) | 11.4 (n=25) | 2.0 |
| the pair, arriving (L5, E gear) · Nightmare · normal · textbook | 4.2 (n=806) | 6.3 (n=144) | 7.7 (n=56) | 11.4 (n=25) | 2.0 |
| crypt-breakers, ready (L9, D gear) · Sheltered · normal · textbook | 3.8 (n=934) | 5.1 (n=168) | 7.8 (n=97) | 5.5 (n=21) | 1.5 |
| crypt-breakers, ready (L9, D gear) · Mortal · normal · textbook | 3.8 (n=931) | 5.1 (n=168) | 7.8 (n=94) | 5.5 (n=21) | 1.5 |
| crypt-breakers, ready (L9, D gear) · Nightmare · normal · textbook | 3.8 (n=930) | 5.1 (n=168) | 7.8 (n=94) | 5.5 (n=21) | 1.5 |
| the pair, ready (L9, D gear) · Sheltered · normal · textbook | 3.6 (n=913) | 5.9 (n=166) | 7.3 (n=84) | 7.4 (n=17) | 2.1 |
| the pair, ready (L9, D gear) · Mortal · normal · textbook | 3.6 (n=896) | 5.9 (n=163) | 7.3 (n=82) | 7.4 (n=17) | 2.1 |
| the pair, ready (L9, D gear) · Nightmare · normal · textbook | 3.6 (n=896) | 5.9 (n=162) | 7.3 (n=81) | 7.4 (n=17) | 2.1 |
| solo warden, arriving (L11, D gear) · Sheltered · normal · textbook | 7.5 (n=193) | 11.9 (n=26) | 13.9 (n=27) | - (n=0) | 4.3 |
| solo warden, arriving (L11, D gear) · Mortal · normal · textbook | 7.5 (n=193) | 11.9 (n=26) | 13.9 (n=27) | - (n=0) | 4.3 |
| solo warden, arriving (L11, D gear) · Nightmare · normal · textbook | 7.5 (n=193) | 11.9 (n=26) | 13.9 (n=27) | - (n=0) | 4.3 |
| solo warden, ground (L21, B gear) · Sheltered · normal · textbook | 5.5 (n=304) | 15.2 (n=47) | 16.4 (n=80) | - (n=0) | 2.9 |
| solo warden, ground (L21, B gear) · Mortal · normal · textbook | 5.5 (n=304) | 15.2 (n=47) | 16.4 (n=80) | - (n=0) | 2.9 |
| solo warden, ground (L21, B gear) · Nightmare · normal · textbook | 5.5 (n=304) | 15.2 (n=47) | 16.4 (n=80) | - (n=0) | 2.9 |
| classic four, arriving (L11, D gear) · Sheltered · normal · textbook | 4.5 (n=325) | 8.5 (n=47) | 12.1 (n=100) | - (n=0) | 2.0 |
| classic four, arriving (L11, D gear) · Mortal · normal · textbook | 4.5 (n=315) | 8.6 (n=43) | 12.2 (n=90) | - (n=0) | 2.0 |
| classic four, arriving (L11, D gear) · Nightmare · normal · textbook | 4.5 (n=315) | 8.6 (n=43) | 12.3 (n=88) | - (n=0) | 2.0 |
| crypt-breakers, arriving (L11, D gear) · Sheltered · normal · textbook | 3.7 (n=327) | 6.2 (n=46) | 12.8 (n=99) | - (n=0) | 3.1 |
| crypt-breakers, arriving (L11, D gear) · Mortal · normal · textbook | 3.7 (n=322) | 6.3 (n=45) | 12.6 (n=94) | - (n=0) | 3.1 |
| crypt-breakers, arriving (L11, D gear) · Nightmare · normal · textbook | 3.7 (n=322) | 6.3 (n=45) | 12.8 (n=92) | - (n=0) | 3.1 |
| glass cannons, arriving (L11, D gear) · Sheltered · normal · textbook | 5.8 (n=280) | 13.3 (n=43) | 12.0 (n=74) | - (n=0) | 4.3 |
| glass cannons, arriving (L11, D gear) · Mortal · normal · textbook | 5.7 (n=272) | 13.7 (n=41) | 11.6 (n=65) | - (n=0) | 4.3 |
| glass cannons, arriving (L11, D gear) · Nightmare · normal · textbook | 5.7 (n=272) | 13.7 (n=41) | 11.6 (n=65) | - (n=0) | 4.3 |
| the pair, arriving (L11, D gear) · Sheltered · normal · textbook | 5.1 (n=304) | 14.9 (n=49) | 13.3 (n=88) | - (n=0) | 5.7 |
| the pair, arriving (L11, D gear) · Mortal · normal · textbook | 5.0 (n=296) | 15.3 (n=47) | 13.2 (n=83) | - (n=0) | 5.3 |
| the pair, arriving (L11, D gear) · Nightmare · normal · textbook | 5.0 (n=296) | 15.3 (n=47) | 13.3 (n=82) | - (n=0) | 5.3 |
| crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook | 3.1 (n=339) | 4.4 (n=51) | 8.3 (n=99) | - (n=0) | 2.7 |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook | 3.1 (n=335) | 4.4 (n=51) | 8.4 (n=97) | - (n=0) | 2.6 |
| crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook | 3.1 (n=335) | 4.4 (n=51) | 8.4 (n=97) | - (n=0) | 2.6 |
| the pair, ready (L14, C gear) · Sheltered · normal · textbook | 4.1 (n=330) | 10.8 (n=53) | 10.2 (n=99) | - (n=0) | 3.9 |
| the pair, ready (L14, C gear) · Mortal · normal · textbook | 4.1 (n=327) | 10.3 (n=51) | 10.2 (n=97) | - (n=0) | 3.9 |
| the pair, ready (L14, C gear) · Nightmare · normal · textbook | 4.1 (n=327) | 10.3 (n=51) | 10.2 (n=96) | - (n=0) | 3.9 |
| solo warden, arriving (L13, D gear) · Sheltered · normal · textbook | 14.5 (n=102) | - (n=0) | 12.7 (n=59) | - (n=0) | - |
| solo warden, arriving (L13, D gear) · Mortal · normal · textbook | 14.5 (n=102) | - (n=0) | 12.7 (n=59) | - (n=0) | - |
| solo warden, arriving (L13, D gear) · Nightmare · normal · textbook | 14.5 (n=102) | - (n=0) | 12.7 (n=59) | - (n=0) | - |
| solo warden, ground (L21, B gear) · Sheltered · normal · textbook | 11.1 (n=104) | - (n=0) | 9.9 (n=97) | - (n=0) | - |
| solo warden, ground (L21, B gear) · Mortal · normal · textbook | 11.1 (n=104) | - (n=0) | 9.9 (n=97) | - (n=0) | - |
| solo warden, ground (L21, B gear) · Nightmare · normal · textbook | 11.1 (n=104) | - (n=0) | 9.9 (n=97) | - (n=0) | - |
| classic four, arriving (L13, D gear) · Sheltered · normal · textbook | 8.7 (n=100) | - (n=0) | 9.8 (n=100) | - (n=0) | - |
| classic four, arriving (L13, D gear) · Mortal · normal · textbook | 8.7 (n=100) | - (n=0) | 9.8 (n=100) | - (n=0) | - |
| classic four, arriving (L13, D gear) · Nightmare · normal · textbook | 8.7 (n=100) | - (n=0) | 9.8 (n=100) | - (n=0) | - |
| crypt-breakers, arriving (L13, D gear) · Sheltered · normal · textbook | 6.1 (n=100) | - (n=0) | 8.3 (n=100) | - (n=0) | - |
| crypt-breakers, arriving (L13, D gear) · Mortal · normal · textbook | 6.1 (n=100) | - (n=0) | 8.3 (n=100) | - (n=0) | - |
| crypt-breakers, arriving (L13, D gear) · Nightmare · normal · textbook | 6.1 (n=100) | - (n=0) | 8.3 (n=100) | - (n=0) | - |
| glass cannons, arriving (L13, D gear) · Sheltered · normal · textbook | 10.0 (n=100) | - (n=0) | 9.2 (n=100) | - (n=0) | - |
| glass cannons, arriving (L13, D gear) · Mortal · normal · textbook | 10.0 (n=100) | - (n=0) | 9.2 (n=100) | - (n=0) | - |
| glass cannons, arriving (L13, D gear) · Nightmare · normal · textbook | 10.0 (n=100) | - (n=0) | 9.2 (n=100) | - (n=0) | - |
| the pair, arriving (L13, D gear) · Sheltered · normal · textbook | 13.4 (n=101) | - (n=0) | 7.9 (n=91) | - (n=0) | - |
| the pair, arriving (L13, D gear) · Mortal · normal · textbook | 13.3 (n=100) | - (n=0) | 7.8 (n=89) | - (n=0) | - |
| the pair, arriving (L13, D gear) · Nightmare · normal · textbook | 13.3 (n=100) | - (n=0) | 7.8 (n=89) | - (n=0) | - |
| crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook | 5.0 (n=100) | - (n=0) | 6.6 (n=100) | - (n=0) | - |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook | 5.0 (n=100) | - (n=0) | 6.6 (n=100) | - (n=0) | - |
| crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook | 5.0 (n=100) | - (n=0) | 6.6 (n=100) | - (n=0) | - |
| the pair, ready (L15, C gear) · Sheltered · normal · textbook | 10.2 (n=100) | - (n=0) | 6.5 (n=100) | - (n=0) | - |
| the pair, ready (L15, C gear) · Mortal · normal · textbook | 10.2 (n=100) | - (n=0) | 6.5 (n=99) | - (n=0) | - |
| the pair, ready (L15, C gear) · Nightmare · normal · textbook | 10.2 (n=100) | - (n=0) | 6.5 (n=99) | - (n=0) | - |
| solo warden, fresh · Mortal · normal · careful | 4.1 (n=543) | 7.4 (n=88) | 19.5 (n=44) | 11.3 (n=4) | 7.1 |
| solo warden, ground (L12, D gear) · Mortal · normal · careful | 2.8 (n=771) | 5.0 (n=120) | 21.4 (n=127) | - (n=0) | 5.4 |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · careful | 3.4 (n=635) | 4.7 (n=92) | 20.6 (n=72) | 6.3 (n=3) | 6.9 |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · careful | 3.0 (n=652) | 4.0 (n=103) | 16.9 (n=64) | 13.0 (n=2) | 5.2 |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · careful | 3.5 (n=556) | 4.2 (n=86) | 18.0 (n=39) | 14.0 (n=1) | 5.1 |
| the pair, fresh: blade, mender · Mortal · normal · careful | 2.9 (n=691) | 4.1 (n=107) | 19.5 (n=86) | - (n=0) | 4.5 |
| crypt-breakers, levelled (L5, E gear) · Mortal · normal · careful | 2.5 (n=766) | 3.3 (n=119) | 11.9 (n=101) | - (n=0) | 3.8 |
| the pair, levelled (L5, E gear) · Mortal · normal · careful | 2.6 (n=764) | 3.6 (n=116) | 15.9 (n=108) | - (n=0) | 3.5 |
| solo warden, arriving (L5, E gear) · Mortal · normal · careful | 5.2 (n=532) | 8.5 (n=100) | 7.7 (n=10) | 12.9 (n=25) | 2.2 |
| solo warden, ground (L16, C gear) · Mortal · normal · careful | 4.2 (n=803) | 9.1 (n=152) | 6.3 (n=54) | 15.3 (n=23) | 2.2 |
| classic four, arriving (L5, E gear) · Mortal · normal · careful | 5.0 (n=822) | 7.0 (n=145) | 8.4 (n=68) | 9.3 (n=33) | 1.7 |
| crypt-breakers, arriving (L5, E gear) · Mortal · normal · careful | 4.3 (n=842) | 6.2 (n=147) | 8.0 (n=68) | 7.6 (n=36) | 1.7 |
| glass cannons, arriving (L5, E gear) · Mortal · normal · careful | 5.9 (n=602) | 8.7 (n=105) | 12.5 (n=4) | 8.1 (n=34) | 2.0 |
| the pair, arriving (L5, E gear) · Mortal · normal · careful | 4.2 (n=786) | 6.3 (n=141) | 7.7 (n=50) | 11.4 (n=25) | 2.0 |
| crypt-breakers, ready (L9, D gear) · Mortal · normal · careful | 3.8 (n=931) | 5.1 (n=168) | 7.8 (n=94) | 5.5 (n=21) | 1.5 |
| the pair, ready (L9, D gear) · Mortal · normal · careful | 3.6 (n=896) | 5.9 (n=163) | 7.3 (n=82) | 7.4 (n=17) | 2.1 |
| solo warden, arriving (L11, D gear) · Mortal · normal · careful | 7.5 (n=193) | 11.9 (n=26) | 13.9 (n=27) | - (n=0) | 4.3 |
| solo warden, ground (L21, B gear) · Mortal · normal · careful | 5.5 (n=304) | 15.2 (n=47) | 16.4 (n=80) | - (n=0) | 2.9 |
| classic four, arriving (L11, D gear) · Mortal · normal · careful | 4.5 (n=315) | 8.6 (n=43) | 12.2 (n=90) | - (n=0) | 2.0 |
| crypt-breakers, arriving (L11, D gear) · Mortal · normal · careful | 3.7 (n=322) | 6.3 (n=45) | 12.6 (n=94) | - (n=0) | 3.1 |
| glass cannons, arriving (L11, D gear) · Mortal · normal · careful | 5.7 (n=272) | 13.7 (n=41) | 11.6 (n=65) | - (n=0) | 4.3 |
| the pair, arriving (L11, D gear) · Mortal · normal · careful | 5.0 (n=296) | 15.3 (n=47) | 13.2 (n=83) | - (n=0) | 5.3 |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · careful | 3.1 (n=335) | 4.4 (n=51) | 8.4 (n=97) | - (n=0) | 2.6 |
| the pair, ready (L14, C gear) · Mortal · normal · careful | 4.1 (n=327) | 10.3 (n=51) | 10.2 (n=97) | - (n=0) | 3.9 |
| solo warden, arriving (L13, D gear) · Mortal · normal · careful | 14.5 (n=102) | - (n=0) | 12.7 (n=59) | - (n=0) | - |
| solo warden, ground (L21, B gear) · Mortal · normal · careful | 11.1 (n=104) | - (n=0) | 9.9 (n=97) | - (n=0) | - |
| classic four, arriving (L13, D gear) · Mortal · normal · careful | 8.7 (n=100) | - (n=0) | 9.8 (n=100) | - (n=0) | - |
| crypt-breakers, arriving (L13, D gear) · Mortal · normal · careful | 6.1 (n=100) | - (n=0) | 8.3 (n=100) | - (n=0) | - |
| glass cannons, arriving (L13, D gear) · Mortal · normal · careful | 10.0 (n=100) | - (n=0) | 9.2 (n=100) | - (n=0) | - |
| the pair, arriving (L13, D gear) · Mortal · normal · careful | 13.3 (n=100) | - (n=0) | 7.8 (n=89) | - (n=0) | - |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · careful | 5.0 (n=100) | - (n=0) | 6.6 (n=100) | - (n=0) | - |
| the pair, ready (L15, C gear) · Mortal · normal · careful | 10.2 (n=100) | - (n=0) | 6.5 (n=99) | - (n=0) | - |
| solo warden, fresh · Mortal · hard · textbook | 4.9 (n=136) | 8.9 (n=37) | 13.5 (n=4) | 11.0 (n=3) | 6.2 |
| solo warden, fresh · Mortal · dread · textbook | 5.4 (n=78) | 7.9 (n=24) | - (n=0) | 6.0 (n=1) | 5.9 |
| solo warden, ground (L12, D gear) · Mortal · hard · textbook | 3.8 (n=249) | 6.7 (n=54) | 23.9 (n=32) | 11.7 (n=6) | 7.5 |
| solo warden, ground (L12, D gear) · Mortal · dread · textbook | 5.1 (n=151) | 10.0 (n=45) | 18.5 (n=4) | 12.6 (n=9) | 7.4 |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · hard · textbook | 5.0 (n=187) | 6.2 (n=42) | 18.4 (n=5) | 8.0 (n=6) | 10.3 |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · dread · textbook | 5.4 (n=88) | 7.3 (n=33) | - (n=0) | 11.8 (n=5) | 10.3 |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · hard · textbook | 3.5 (n=255) | 5.1 (n=53) | 18.5 (n=31) | 12.8 (n=5) | 5.9 |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · dread · textbook | 4.4 (n=143) | 5.6 (n=41) | - (n=0) | 15.8 (n=13) | 6.9 |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · hard · textbook | 4.2 (n=181) | 4.7 (n=42) | 17.3 (n=7) | 13.3 (n=4) | 6.3 |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · dread · textbook | 4.8 (n=109) | 5.9 (n=39) | - (n=0) | 15.1 (n=9) | 7.3 |
| the pair, fresh: blade, mender · Mortal · hard · textbook | 3.8 (n=242) | 5.8 (n=54) | 20.8 (n=30) | 10.7 (n=9) | 6.0 |
| the pair, fresh: blade, mender · Mortal · dread · textbook | 4.1 (n=139) | 7.5 (n=41) | 10.5 (n=2) | 13.1 (n=11) | 6.7 |
| crypt-breakers, levelled (L5, E gear) · Mortal · hard · textbook | 2.8 (n=278) | 3.9 (n=64) | 18.0 (n=40) | 10.5 (n=4) | 4.2 |
| crypt-breakers, levelled (L5, E gear) · Mortal · dread · textbook | 4.1 (n=203) | 5.0 (n=55) | 13.7 (n=9) | 11.9 (n=18) | 5.9 |
| the pair, levelled (L5, E gear) · Mortal · hard · textbook | 3.2 (n=268) | 5.1 (n=59) | 20.4 (n=37) | 9.7 (n=6) | 4.2 |
| the pair, levelled (L5, E gear) · Mortal · dread · textbook | 3.5 (n=196) | 5.8 (n=53) | 16.0 (n=6) | 14.3 (n=19) | 5.3 |
| solo warden, arriving (L5, E gear) · Mortal · hard · textbook | 6.9 (n=130) | 8.6 (n=17) | - (n=0) | 9.0 (n=10) | 3.0 |
| solo warden, arriving (L5, E gear) · Mortal · dread · textbook | 7.2 (n=79) | 8.8 (n=16) | - (n=0) | 9.6 (n=11) | 3.0 |
| solo warden, ground (L16, C gear) · Mortal · hard · textbook | 5.6 (n=186) | 9.4 (n=30) | 9.7 (n=3) | 15.1 (n=13) | 2.0 |
| solo warden, ground (L16, C gear) · Mortal · dread · textbook | 6.0 (n=141) | 11.0 (n=28) | - (n=0) | 15.7 (n=17) | 10.0 |
| classic four, arriving (L5, E gear) · Mortal · hard · textbook | 8.0 (n=171) | 10.6 (n=23) | 8.5 (n=2) | 10.9 (n=9) | 2.0 |
| classic four, arriving (L5, E gear) · Mortal · dread · textbook | 10.3 (n=64) | 9.2 (n=16) | - (n=0) | 13.5 (n=4) | 2.0 |
| crypt-breakers, arriving (L5, E gear) · Mortal · hard · textbook | 5.1 (n=236) | 7.8 (n=48) | 12.3 (n=8) | 10.9 (n=22) | 2.0 |
| crypt-breakers, arriving (L5, E gear) · Mortal · dread · textbook | 7.3 (n=118) | 10.3 (n=23) | - (n=0) | 13.4 (n=15) | 2.0 |
| glass cannons, arriving (L5, E gear) · Mortal · hard · textbook | 6.7 (n=174) | 10.2 (n=28) | - (n=0) | 11.4 (n=14) | 2.0 |
| glass cannons, arriving (L5, E gear) · Mortal · dread · textbook | 9.8 (n=74) | 10.8 (n=18) | - (n=0) | 13.7 (n=6) | 2.0 |
| the pair, arriving (L5, E gear) · Mortal · hard · textbook | 5.8 (n=162) | 8.9 (n=30) | 5.0 (n=3) | 11.5 (n=14) | 2.0 |
| the pair, arriving (L5, E gear) · Mortal · dread · textbook | 7.0 (n=97) | 12.1 (n=22) | - (n=0) | 14.4 (n=17) | 2.0 |
| crypt-breakers, ready (L9, D gear) · Mortal · hard · textbook | 4.6 (n=318) | 6.5 (n=57) | 7.9 (n=24) | 8.6 (n=25) | 2.0 |
| crypt-breakers, ready (L9, D gear) · Mortal · dread · textbook | 6.0 (n=164) | 8.4 (n=40) | - (n=0) | 11.5 (n=24) | 2.0 |
| the pair, ready (L9, D gear) · Mortal · hard · textbook | 5.3 (n=241) | 9.2 (n=38) | 8.0 (n=7) | 11.1 (n=14) | 2.0 |
| the pair, ready (L9, D gear) · Mortal · dread · textbook | 5.6 (n=143) | 10.1 (n=30) | - (n=0) | 12.8 (n=18) | 2.0 |
| solo warden, arriving (L11, D gear) · Mortal · hard · textbook | 8.1 (n=54) | 8.5 (n=13) | 6.0 (n=1) | - (n=0) | 6.3 |
| solo warden, arriving (L11, D gear) · Mortal · dread · textbook | 8.2 (n=40) | 8.9 (n=12) | - (n=0) | - (n=0) | 6.5 |
| solo warden, ground (L21, B gear) · Mortal · hard · textbook | 6.7 (n=95) | 15.2 (n=20) | 20.4 (n=14) | - (n=0) | 4.0 |
| solo warden, ground (L21, B gear) · Mortal · dread · textbook | 8.7 (n=71) | 11.8 (n=20) | 16.0 (n=6) | - (n=0) | 10.2 |
| classic four, arriving (L11, D gear) · Mortal · hard · textbook | 6.2 (n=100) | 9.2 (n=18) | 13.3 (n=19) | - (n=0) | 2.8 |
| classic four, arriving (L11, D gear) · Mortal · dread · textbook | 5.8 (n=42) | 7.0 (n=14) | - (n=0) | - (n=0) | 2.0 |
| crypt-breakers, arriving (L11, D gear) · Mortal · hard · textbook | 4.7 (n=109) | 8.0 (n=21) | 12.0 (n=27) | - (n=0) | 3.8 |
| crypt-breakers, arriving (L11, D gear) · Mortal · dread · textbook | 6.1 (n=60) | 9.0 (n=16) | 7.3 (n=3) | - (n=0) | 5.0 |
| glass cannons, arriving (L11, D gear) · Mortal · hard · textbook | 7.1 (n=89) | 11.0 (n=19) | 9.8 (n=10) | - (n=0) | 7.5 |
| glass cannons, arriving (L11, D gear) · Mortal · dread · textbook | 9.4 (n=55) | 10.4 (n=12) | 5.0 (n=3) | - (n=0) | - |
| the pair, arriving (L11, D gear) · Mortal · hard · textbook | 7.8 (n=74) | 10.8 (n=16) | 8.4 (n=8) | - (n=0) | 6.0 |
| the pair, arriving (L11, D gear) · Mortal · dread · textbook | 7.7 (n=50) | 6.6 (n=13) | - (n=0) | - (n=0) | 11.5 |
| crypt-breakers, ready (L14, C gear) · Mortal · hard · textbook | 3.6 (n=123) | 5.1 (n=23) | 11.8 (n=36) | - (n=0) | 3.1 |
| crypt-breakers, ready (L14, C gear) · Mortal · dread · textbook | 4.9 (n=82) | 8.5 (n=22) | 9.4 (n=10) | - (n=0) | 4.5 |
| the pair, ready (L14, C gear) · Mortal · hard · textbook | 6.5 (n=102) | 10.4 (n=20) | 12.5 (n=21) | - (n=0) | 5.2 |
| the pair, ready (L14, C gear) · Mortal · dread · textbook | 7.3 (n=62) | 9.5 (n=17) | 9.0 (n=3) | - (n=0) | 7.6 |
| solo warden, arriving (L13, D gear) · Mortal · hard · textbook | 15.4 (n=40) | - (n=0) | 11.7 (n=3) | - (n=0) | - |
| solo warden, arriving (L13, D gear) · Mortal · dread · textbook | 10.3 (n=40) | - (n=0) | - (n=0) | - (n=0) | - |
| solo warden, ground (L21, B gear) · Mortal · hard · textbook | 13.9 (n=40) | - (n=0) | 12.6 (n=33) | - (n=0) | - |
| solo warden, ground (L21, B gear) · Mortal · dread · textbook | 17.9 (n=41) | - (n=0) | 12.8 (n=4) | - (n=0) | - |
| classic four, arriving (L13, D gear) · Mortal · hard · textbook | 19.2 (n=40) | - (n=0) | 10.3 (n=30) | - (n=0) | - |
| classic four, arriving (L13, D gear) · Mortal · dread · textbook | 17.1 (n=40) | - (n=0) | 10.5 (n=2) | - (n=0) | - |
| crypt-breakers, arriving (L13, D gear) · Mortal · hard · textbook | 7.3 (n=40) | - (n=0) | 10.3 (n=40) | - (n=0) | - |
| crypt-breakers, arriving (L13, D gear) · Mortal · dread · textbook | 13.7 (n=40) | - (n=0) | 11.0 (n=3) | - (n=0) | - |
| glass cannons, arriving (L13, D gear) · Mortal · hard · textbook | 14.2 (n=40) | - (n=0) | 11.0 (n=35) | - (n=0) | - |
| glass cannons, arriving (L13, D gear) · Mortal · dread · textbook | 18.6 (n=40) | - (n=0) | 14.0 (n=1) | - (n=0) | - |
| the pair, arriving (L13, D gear) · Mortal · hard · textbook | 17.6 (n=40) | - (n=0) | 9.1 (n=16) | - (n=0) | - |
| the pair, arriving (L13, D gear) · Mortal · dread · textbook | 14.0 (n=40) | - (n=0) | 7.0 (n=1) | - (n=0) | - |
| crypt-breakers, ready (L14, C gear) · Mortal · hard · textbook | 5.8 (n=40) | - (n=0) | 8.6 (n=40) | - (n=0) | - |
| crypt-breakers, ready (L14, C gear) · Mortal · dread · textbook | 12.8 (n=40) | - (n=0) | 8.4 (n=21) | - (n=0) | - |
| the pair, ready (L15, C gear) · Mortal · hard · textbook | 14.9 (n=40) | - (n=0) | 8.2 (n=32) | - (n=0) | - |
| the pair, ready (L15, C gear) · Mortal · dread · textbook | 15.6 (n=40) | - (n=0) | 8.2 (n=17) | - (n=0) | - |
| classic four, fresh, diving into the Crypts (L1) · Mortal · normal · textbook | 6.2 (n=718) | 8.8 (n=124) | 10.4 (n=55) | 11.4 (n=44) | 1.8 |
| classic four, fresh, diving into the Crypts (L1) · Mortal · normal · careful | - (n=0) | - (n=0) | - (n=0) | - (n=0) | - |
| classic four, from the Cellars, diving into the Vault (L5, E gear) · Mortal · normal · textbook | 7.2 (n=218) | 11.6 (n=33) | 11.6 (n=45) | - (n=0) | 2.4 |
| classic four, from the Cellars, diving into the Vault (L5, E gear) · Mortal · normal · careful | - (n=0) | - (n=0) | - (n=0) | - (n=0) | - |
| solo warden, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 7.5 (n=193) | 11.9 (n=26) | 13.9 (n=27) | - (n=0) | 4.3 |
| solo warden, ground (L21, B gear), F7 to F8 in one delve · Mortal · normal · textbook | 7.3 (n=359) | 15.2 (n=47) | 14.5 (n=112) | - (n=0) | 2.9 |
| classic four, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 5.5 (n=372) | 8.6 (n=43) | 11.2 (n=144) | - (n=0) | 2.0 |
| crypt-breakers, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 4.3 (n=355) | 6.3 (n=45) | 11.6 (n=125) | - (n=0) | 3.1 |
| glass cannons, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 6.3 (n=282) | 13.7 (n=41) | 11.5 (n=66) | - (n=0) | 4.3 |
| the pair, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 6.2 (n=326) | 15.3 (n=47) | 12.1 (n=99) | - (n=0) | 5.3 |
| crypt-breakers, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook | 3.7 (n=417) | 4.4 (n=51) | 7.9 (n=177) | - (n=0) | 2.6 |
| the pair, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook | 6.3 (n=395) | 10.3 (n=51) | 9.0 (n=138) | - (n=0) | 3.9 |

## 6. Economy and wear (R from the sim: economy.ts rForFloor at the delve's first floor)

| Recipe | R | Gold banked (mean) | p10 | p90 | Gold found | Repair bill (gold) | Repair % of R | Most-worn main hand % | Wear chest % (mean) | Chests | Torches | Light at the stairs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| solo warden, fresh · Sheltered · normal · textbook | 300 | 33 | 0 | 193 | 189 | 63 | 20.9% | 19.5 | 17.3 | 1.4 | 0.0 | 84 |
| solo warden, fresh · Mortal · normal · textbook | 300 | 33 | 0 | 193 | 189 | 63 | 20.9% | 19.5 | 17.3 | 1.4 | 0.0 | 84 |
| solo warden, fresh · Nightmare · normal · textbook | 300 | 33 | 0 | 193 | 189 | 63 | 20.9% | 19.5 | 17.3 | 1.4 | 0.0 | 84 |
| solo warden, ground (L12, D gear) · Sheltered · normal · textbook | 300 | 246 | 0 | 467 | 342 | 97 | 32.4% | 12.3 | 12.1 | 2.1 | 0.0 | 81 |
| solo warden, ground (L12, D gear) · Mortal · normal · textbook | 300 | 246 | 0 | 467 | 342 | 97 | 32.4% | 12.3 | 12.1 | 2.1 | 0.0 | 81 |
| solo warden, ground (L12, D gear) · Nightmare · normal · textbook | 300 | 246 | 0 | 467 | 342 | 97 | 32.4% | 12.3 | 12.1 | 2.1 | 0.0 | 81 |
| classic four, fresh: warden, blade, mender, arcanist · Sheltered · normal · textbook | 300 | 317 | 0 | 608 | 502 | 201 | 67.0% | 39.7 | 13.7 | 2.1 | 0.0 | 82 |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · textbook | 300 | 276 | 0 | 573 | 467 | 195 | 64.8% | 36.2 | 13.0 | 2.0 | 0.0 | 83 |
| classic four, fresh: warden, blade, mender, arcanist · Nightmare · normal · textbook | 300 | 359 | 0 | 584 | 466 | 161 | 53.6% | 34.3 | 11.1 | 2.0 | 0.0 | 83 |
| crypt-breakers, fresh: mender, warden, ranger · Sheltered · normal · textbook | 300 | 151 | 0 | 474 | 377 | 156 | 52.0% | 18.4 | 14.9 | 2.0 | 0.0 | 82 |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · textbook | 300 | 160 | 0 | 452 | 371 | 150 | 49.9% | 17.8 | 14.5 | 1.9 | 0.0 | 82 |
| crypt-breakers, fresh: mender, warden, ranger · Nightmare · normal · textbook | 300 | 166 | 0 | 452 | 371 | 146 | 48.6% | 17.5 | 14.2 | 1.9 | 0.0 | 82 |
| glass cannons, fresh: arcanist, shade, ranger · Sheltered · normal · textbook | 300 | 153 | 0 | 413 | 309 | 99 | 33.2% | 14.6 | 8.3 | 1.7 | 0.0 | 83 |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · textbook | 300 | 151 | 0 | 390 | 296 | 93 | 31.1% | 14.2 | 7.7 | 1.7 | 0.0 | 83 |
| glass cannons, fresh: arcanist, shade, ranger · Nightmare · normal · textbook | 300 | 178 | 0 | 392 | 296 | 81 | 27.2% | 13.3 | 6.8 | 1.7 | 0.0 | 83 |
| the pair, fresh: blade, mender · Sheltered · normal · textbook | 300 | 134 | 0 | 443 | 336 | 100 | 33.5% | 24.4 | 12.6 | 2.0 | 0.0 | 83 |
| the pair, fresh: blade, mender · Mortal · normal · textbook | 300 | 132 | 0 | 443 | 331 | 100 | 33.3% | 24.1 | 12.5 | 2.0 | 0.0 | 83 |
| the pair, fresh: blade, mender · Nightmare · normal · textbook | 300 | 141 | 0 | 443 | 331 | 97 | 32.4% | 23.8 | 12.2 | 2.0 | 0.0 | 83 |
| crypt-breakers, levelled (L5, E gear) · Sheltered · normal · textbook | 300 | 382 | 0 | 550 | 438 | 101 | 33.8% | 10.8 | 6.6 | 2.0 | 0.0 | 81 |
| crypt-breakers, levelled (L5, E gear) · Mortal · normal · textbook | 300 | 372 | 0 | 544 | 436 | 105 | 35.0% | 11.0 | 6.7 | 2.0 | 0.0 | 81 |
| crypt-breakers, levelled (L5, E gear) · Nightmare · normal · textbook | 300 | 380 | 0 | 544 | 436 | 101 | 33.6% | 10.8 | 6.5 | 2.0 | 0.0 | 81 |
| the pair, levelled (L5, E gear) · Sheltered · normal · textbook | 300 | 313 | 0 | 505 | 391 | 87 | 28.9% | 17.6 | 7.2 | 2.1 | 0.0 | 82 |
| the pair, levelled (L5, E gear) · Mortal · normal · textbook | 300 | 296 | 0 | 504 | 384 | 91 | 30.3% | 17.7 | 7.5 | 2.1 | 0.0 | 82 |
| the pair, levelled (L5, E gear) · Nightmare · normal · textbook | 300 | 298 | 0 | 504 | 384 | 90 | 29.8% | 17.6 | 7.4 | 2.1 | 0.0 | 82 |
| solo warden, arriving (L5, E gear) · Sheltered · normal · textbook | 480 | 34 | 0 | 215 | 176 | 95 | 19.7% | 19.1 | 15.3 | 1.4 | 0.5 | 55 |
| solo warden, arriving (L5, E gear) · Mortal · normal · textbook | 480 | 34 | 0 | 215 | 176 | 95 | 19.7% | 19.1 | 15.3 | 1.4 | 0.5 | 55 |
| solo warden, arriving (L5, E gear) · Nightmare · normal · textbook | 480 | 34 | 0 | 215 | 176 | 95 | 19.7% | 19.1 | 15.3 | 1.4 | 0.5 | 55 |
| solo warden, ground (L16, C gear) · Sheltered · normal · textbook | 480 | 240 | 0 | 501 | 328 | 134 | 27.9% | 12.1 | 9.5 | 2.4 | 1.4 | 53 |
| solo warden, ground (L16, C gear) · Mortal · normal · textbook | 480 | 240 | 0 | 501 | 328 | 134 | 27.9% | 12.1 | 9.5 | 2.4 | 1.4 | 53 |
| solo warden, ground (L16, C gear) · Nightmare · normal · textbook | 480 | 240 | 0 | 501 | 328 | 134 | 27.9% | 12.1 | 9.5 | 2.4 | 1.4 | 53 |
| classic four, arriving (L5, E gear) · Sheltered · normal · textbook | 480 | 466 | 0 | 767 | 622 | 302 | 63.0% | 46.2 | 11.3 | 3.2 | 2.1 | 56 |
| classic four, arriving (L5, E gear) · Mortal · normal · textbook | 480 | 430 | 0 | 767 | 567 | 271 | 56.4% | 41.5 | 10.2 | 2.9 | 1.9 | 56 |
| classic four, arriving (L5, E gear) · Nightmare · normal · textbook | 480 | 434 | 0 | 767 | 566 | 268 | 55.8% | 41.3 | 10.1 | 2.9 | 1.9 | 56 |
| crypt-breakers, arriving (L5, E gear) · Sheltered · normal · textbook | 480 | 292 | 0 | 669 | 485 | 204 | 42.6% | 20.0 | 11.4 | 2.9 | 0.7 | 60 |
| crypt-breakers, arriving (L5, E gear) · Mortal · normal · textbook | 480 | 289 | 0 | 665 | 473 | 198 | 41.3% | 19.5 | 11.1 | 2.8 | 0.7 | 60 |
| crypt-breakers, arriving (L5, E gear) · Nightmare · normal · textbook | 480 | 293 | 0 | 665 | 473 | 196 | 40.8% | 19.4 | 11.0 | 2.8 | 0.7 | 60 |
| glass cannons, arriving (L5, E gear) · Sheltered · normal · textbook | 480 | 243 | 0 | 428 | 333 | 116 | 24.2% | 14.5 | 6.0 | 2.1 | 0.1 | 61 |
| glass cannons, arriving (L5, E gear) · Mortal · normal · textbook | 480 | 241 | 0 | 406 | 322 | 111 | 23.1% | 13.8 | 5.8 | 2.1 | 0.1 | 61 |
| glass cannons, arriving (L5, E gear) · Nightmare · normal · textbook | 480 | 244 | 0 | 406 | 322 | 109 | 22.6% | 13.7 | 5.7 | 2.1 | 0.1 | 61 |
| the pair, arriving (L5, E gear) · Sheltered · normal · textbook | 480 | 136 | 0 | 554 | 374 | 172 | 35.8% | 27.9 | 13.7 | 2.5 | 1.6 | 55 |
| the pair, arriving (L5, E gear) · Mortal · normal · textbook | 480 | 147 | 0 | 473 | 349 | 152 | 31.6% | 25.3 | 12.1 | 2.4 | 1.5 | 56 |
| the pair, arriving (L5, E gear) · Nightmare · normal · textbook | 480 | 147 | 0 | 473 | 349 | 152 | 31.6% | 25.3 | 12.1 | 2.4 | 1.5 | 56 |
| crypt-breakers, ready (L9, D gear) · Sheltered · normal · textbook | 480 | 395 | 0 | 684 | 511 | 204 | 42.5% | 14.5 | 7.1 | 2.9 | 0.8 | 59 |
| crypt-breakers, ready (L9, D gear) · Mortal · normal · textbook | 480 | 392 | 0 | 684 | 508 | 203 | 42.3% | 14.5 | 7.1 | 2.9 | 0.8 | 59 |
| crypt-breakers, ready (L9, D gear) · Nightmare · normal · textbook | 480 | 395 | 0 | 684 | 508 | 200 | 41.6% | 14.4 | 7.0 | 2.9 | 0.8 | 59 |
| the pair, ready (L9, D gear) · Sheltered · normal · textbook | 480 | 231 | 0 | 546 | 423 | 196 | 40.8% | 21.0 | 9.7 | 2.7 | 1.9 | 55 |
| the pair, ready (L9, D gear) · Mortal · normal · textbook | 480 | 231 | 0 | 546 | 417 | 194 | 40.4% | 20.7 | 9.6 | 2.7 | 1.9 | 55 |
| the pair, ready (L9, D gear) · Nightmare · normal · textbook | 480 | 233 | 0 | 546 | 417 | 189 | 39.5% | 20.5 | 9.4 | 2.7 | 1.9 | 55 |
| solo warden, arriving (L11, D gear) · Sheltered · normal · textbook | 370 | 5 | 0 | 0 | 81 | 114 | 30.9% | 11.5 | 10.6 | 0.4 | 0.0 | - |
| solo warden, arriving (L11, D gear) · Mortal · normal · textbook | 370 | 5 | 0 | 0 | 81 | 114 | 30.9% | 11.5 | 10.6 | 0.4 | 0.0 | - |
| solo warden, arriving (L11, D gear) · Nightmare · normal · textbook | 370 | 5 | 0 | 0 | 81 | 114 | 30.9% | 11.5 | 10.6 | 0.4 | 0.0 | - |
| solo warden, ground (L21, B gear) · Sheltered · normal · textbook | 370 | 175 | 0 | 415 | 242 | 175 | 47.2% | 7.8 | 6.8 | 0.8 | 0.0 | 73 |
| solo warden, ground (L21, B gear) · Mortal · normal · textbook | 370 | 175 | 0 | 415 | 242 | 175 | 47.2% | 7.8 | 6.8 | 0.8 | 0.0 | 73 |
| solo warden, ground (L21, B gear) · Nightmare · normal · textbook | 370 | 175 | 0 | 415 | 242 | 175 | 47.2% | 7.8 | 6.8 | 0.8 | 0.0 | 73 |
| classic four, arriving (L11, D gear) · Sheltered · normal · textbook | 370 | 383 | 0 | 665 | 460 | 262 | 70.7% | 27.1 | 5.0 | 0.9 | 0.0 | 75 |
| classic four, arriving (L11, D gear) · Mortal · normal · textbook | 370 | 359 | 0 | 633 | 430 | 248 | 66.9% | 25.5 | 4.7 | 0.9 | 0.0 | 76 |
| classic four, arriving (L11, D gear) · Nightmare · normal · textbook | 370 | 363 | 0 | 633 | 430 | 239 | 64.6% | 25.3 | 4.5 | 0.9 | 0.0 | 76 |
| crypt-breakers, arriving (L11, D gear) · Sheltered · normal · textbook | 370 | 157 | 0 | 446 | 310 | 239 | 64.5% | 11.8 | 7.3 | 0.9 | 0.0 | 73 |
| crypt-breakers, arriving (L11, D gear) · Mortal · normal · textbook | 370 | 167 | 0 | 446 | 304 | 222 | 60.0% | 11.3 | 6.8 | 0.9 | 0.0 | 73 |
| crypt-breakers, arriving (L11, D gear) · Nightmare · normal · textbook | 370 | 171 | 0 | 446 | 304 | 215 | 58.2% | 11.1 | 6.6 | 0.9 | 0.0 | 74 |
| glass cannons, arriving (L11, D gear) · Sheltered · normal · textbook | 370 | 83 | 0 | 331 | 218 | 241 | 65.1% | 11.0 | 7.3 | 0.6 | 0.0 | 80 |
| glass cannons, arriving (L11, D gear) · Mortal · normal · textbook | 370 | 98 | 0 | 331 | 213 | 210 | 56.9% | 9.9 | 6.4 | 0.6 | 0.0 | 81 |
| glass cannons, arriving (L11, D gear) · Nightmare · normal · textbook | 370 | 98 | 0 | 331 | 213 | 210 | 56.9% | 9.9 | 6.4 | 0.6 | 0.0 | 81 |
| the pair, arriving (L11, D gear) · Sheltered · normal · textbook | 370 | 120 | 0 | 402 | 251 | 182 | 49.2% | 14.1 | 8.4 | 0.8 | 0.0 | 75 |
| the pair, arriving (L11, D gear) · Mortal · normal · textbook | 370 | 118 | 0 | 402 | 243 | 174 | 46.9% | 13.5 | 8.0 | 0.8 | 0.0 | 77 |
| the pair, arriving (L11, D gear) · Nightmare · normal · textbook | 370 | 119 | 0 | 402 | 243 | 171 | 46.3% | 13.4 | 7.9 | 0.8 | 0.0 | 77 |
| crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook | 370 | 389 | 250 | 547 | 404 | 83 | 22.3% | 5.5 | 1.7 | 1.1 | 0.0 | 73 |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook | 370 | 383 | 232 | 547 | 398 | 82 | 22.0% | 5.4 | 1.6 | 1.1 | 0.0 | 73 |
| crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook | 370 | 383 | 232 | 547 | 398 | 82 | 22.0% | 5.4 | 1.6 | 1.1 | 0.0 | 73 |
| the pair, ready (L14, C gear) · Sheltered · normal · textbook | 370 | 283 | 0 | 490 | 336 | 138 | 37.4% | 9.1 | 4.1 | 0.9 | 0.0 | 74 |
| the pair, ready (L14, C gear) · Mortal · normal · textbook | 370 | 276 | 0 | 490 | 329 | 137 | 37.0% | 8.9 | 4.1 | 0.9 | 0.0 | 74 |
| the pair, ready (L14, C gear) · Nightmare · normal · textbook | 370 | 277 | 0 | 490 | 329 | 133 | 36.1% | 8.8 | 4.0 | 0.9 | 0.0 | 74 |
| solo warden, arriving (L13, D gear) · Sheltered · normal · textbook | 400 | 21 | 0 | 0 | 53 | 108 | 26.9% | 10.8 | 9.8 | 0.0 | 0.0 | 100 |
| solo warden, arriving (L13, D gear) · Mortal · normal · textbook | 400 | 21 | 0 | 0 | 53 | 108 | 26.9% | 10.8 | 9.8 | 0.0 | 0.0 | 100 |
| solo warden, arriving (L13, D gear) · Nightmare · normal · textbook | 400 | 21 | 0 | 0 | 53 | 108 | 26.9% | 10.8 | 9.8 | 0.0 | 0.0 | 100 |
| solo warden, ground (L21, B gear) · Sheltered · normal · textbook | 400 | 184 | 0 | 376 | 210 | 152 | 38.0% | 6.0 | 5.6 | 0.0 | 0.0 | 100 |
| solo warden, ground (L21, B gear) · Mortal · normal · textbook | 400 | 184 | 0 | 376 | 210 | 152 | 38.0% | 6.0 | 5.6 | 0.0 | 0.0 | 100 |
| solo warden, ground (L21, B gear) · Nightmare · normal · textbook | 400 | 184 | 0 | 376 | 210 | 152 | 38.0% | 6.0 | 5.6 | 0.0 | 0.0 | 100 |
| classic four, arriving (L13, D gear) · Sheltered · normal · textbook | 400 | 183 | 0 | 440 | 248 | 296 | 73.9% | 12.7 | 6.5 | 0.0 | 0.0 | 100 |
| classic four, arriving (L13, D gear) · Mortal · normal · textbook | 400 | 183 | 0 | 440 | 248 | 296 | 73.9% | 12.7 | 6.5 | 0.0 | 0.0 | 100 |
| classic four, arriving (L13, D gear) · Nightmare · normal · textbook | 400 | 183 | 0 | 440 | 248 | 296 | 73.9% | 12.7 | 6.5 | 0.0 | 0.0 | 100 |
| crypt-breakers, arriving (L13, D gear) · Sheltered · normal · textbook | 400 | 172 | 0 | 404 | 218 | 191 | 47.7% | 8.6 | 5.9 | 0.0 | 0.0 | 100 |
| crypt-breakers, arriving (L13, D gear) · Mortal · normal · textbook | 400 | 172 | 0 | 404 | 218 | 191 | 47.7% | 8.6 | 5.9 | 0.0 | 0.0 | 100 |
| crypt-breakers, arriving (L13, D gear) · Nightmare · normal · textbook | 400 | 172 | 0 | 404 | 218 | 191 | 47.7% | 8.6 | 5.9 | 0.0 | 0.0 | 100 |
| glass cannons, arriving (L13, D gear) · Sheltered · normal · textbook | 400 | 160 | 0 | 421 | 211 | 208 | 51.9% | 9.3 | 6.2 | 0.0 | 0.0 | 100 |
| glass cannons, arriving (L13, D gear) · Mortal · normal · textbook | 400 | 160 | 0 | 421 | 211 | 208 | 51.9% | 9.3 | 6.2 | 0.0 | 0.0 | 100 |
| glass cannons, arriving (L13, D gear) · Nightmare · normal · textbook | 400 | 160 | 0 | 421 | 211 | 208 | 51.9% | 9.3 | 6.2 | 0.0 | 0.0 | 100 |
| the pair, arriving (L13, D gear) · Sheltered · normal · textbook | 400 | 137 | 0 | 405 | 185 | 159 | 39.8% | 10.3 | 7.2 | 0.0 | 0.0 | 100 |
| the pair, arriving (L13, D gear) · Mortal · normal · textbook | 400 | 138 | 0 | 405 | 184 | 155 | 38.6% | 10.1 | 7.0 | 0.0 | 0.0 | 100 |
| the pair, arriving (L13, D gear) · Nightmare · normal · textbook | 400 | 138 | 0 | 405 | 184 | 155 | 38.6% | 10.1 | 7.0 | 0.0 | 0.0 | 100 |
| crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook | 400 | 237 | 0 | 432 | 273 | 223 | 55.7% | 6.3 | 4.4 | 0.0 | 0.0 | 100 |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook | 400 | 237 | 0 | 432 | 273 | 223 | 55.7% | 6.3 | 4.4 | 0.0 | 0.0 | 100 |
| crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook | 400 | 237 | 0 | 432 | 273 | 223 | 55.7% | 6.3 | 4.4 | 0.0 | 0.0 | 100 |
| the pair, ready (L15, C gear) · Sheltered · normal · textbook | 400 | 267 | 0 | 408 | 291 | 131 | 32.7% | 6.3 | 3.9 | 0.0 | 0.0 | 100 |
| the pair, ready (L15, C gear) · Mortal · normal · textbook | 400 | 264 | 0 | 408 | 288 | 131 | 32.7% | 6.3 | 3.9 | 0.0 | 0.0 | 100 |
| the pair, ready (L15, C gear) · Nightmare · normal · textbook | 400 | 264 | 0 | 408 | 288 | 131 | 32.7% | 6.3 | 3.9 | 0.0 | 0.0 | 100 |
| solo warden, fresh · Mortal · normal · careful | 300 | 37 | 0 | 193 | 187 | 61 | 20.4% | 19.0 | 16.9 | 1.4 | 0.0 | 83 |
| solo warden, ground (L12, D gear) · Mortal · normal · careful | 300 | 246 | 0 | 467 | 342 | 97 | 32.4% | 12.3 | 12.1 | 2.1 | 0.0 | 81 |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · careful | 300 | 249 | 0 | 566 | 392 | 147 | 49.0% | 27.4 | 9.9 | 1.8 | 0.0 | 83 |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · careful | 300 | 196 | 0 | 442 | 319 | 101 | 33.7% | 13.4 | 10.1 | 1.7 | 0.0 | 82 |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · careful | 300 | 162 | 0 | 316 | 251 | 61 | 20.4% | 10.8 | 5.1 | 1.4 | 0.0 | 83 |
| the pair, fresh: blade, mender · Mortal · normal · careful | 300 | 144 | 0 | 443 | 313 | 88 | 29.3% | 21.8 | 11.2 | 2.0 | 0.0 | 83 |
| crypt-breakers, levelled (L5, E gear) · Mortal · normal · careful | 300 | 372 | 0 | 544 | 436 | 105 | 35.0% | 11.0 | 6.7 | 2.0 | 0.0 | 81 |
| the pair, levelled (L5, E gear) · Mortal · normal · careful | 300 | 296 | 0 | 504 | 384 | 91 | 30.3% | 17.7 | 7.5 | 2.1 | 0.0 | 82 |
| solo warden, arriving (L5, E gear) · Mortal · normal · careful | 480 | 32 | 0 | 194 | 173 | 94 | 19.6% | 18.9 | 15.3 | 1.4 | 0.5 | 55 |
| solo warden, ground (L16, C gear) · Mortal · normal · careful | 480 | 240 | 0 | 501 | 328 | 134 | 27.9% | 12.1 | 9.5 | 2.4 | 1.4 | 53 |
| classic four, arriving (L5, E gear) · Mortal · normal · careful | 480 | 444 | 0 | 767 | 537 | 235 | 48.9% | 38.3 | 8.9 | 2.7 | 1.7 | 56 |
| crypt-breakers, arriving (L5, E gear) · Mortal · normal · careful | 480 | 312 | 0 | 665 | 452 | 169 | 35.2% | 17.7 | 9.6 | 2.6 | 0.6 | 60 |
| glass cannons, arriving (L5, E gear) · Mortal · normal · careful | 480 | 257 | 0 | 402 | 308 | 91 | 19.0% | 12.5 | 4.8 | 2.0 | 0.1 | 61 |
| the pair, arriving (L5, E gear) · Mortal · normal · careful | 480 | 158 | 0 | 466 | 340 | 141 | 29.4% | 24.1 | 11.2 | 2.3 | 1.4 | 55 |
| crypt-breakers, ready (L9, D gear) · Mortal · normal · careful | 480 | 392 | 0 | 684 | 508 | 203 | 42.3% | 14.5 | 7.1 | 2.9 | 0.8 | 59 |
| the pair, ready (L9, D gear) · Mortal · normal · careful | 480 | 231 | 0 | 546 | 417 | 194 | 40.4% | 20.7 | 9.6 | 2.7 | 1.9 | 55 |
| solo warden, arriving (L11, D gear) · Mortal · normal · careful | 370 | 5 | 0 | 0 | 81 | 114 | 30.9% | 11.5 | 10.6 | 0.4 | 0.0 | - |
| solo warden, ground (L21, B gear) · Mortal · normal · careful | 370 | 175 | 0 | 415 | 242 | 175 | 47.2% | 7.8 | 6.8 | 0.8 | 0.0 | 73 |
| classic four, arriving (L11, D gear) · Mortal · normal · careful | 370 | 359 | 0 | 633 | 430 | 248 | 66.9% | 25.5 | 4.7 | 0.9 | 0.0 | 76 |
| crypt-breakers, arriving (L11, D gear) · Mortal · normal · careful | 370 | 167 | 0 | 446 | 304 | 222 | 60.0% | 11.3 | 6.8 | 0.9 | 0.0 | 73 |
| glass cannons, arriving (L11, D gear) · Mortal · normal · careful | 370 | 98 | 0 | 331 | 213 | 210 | 56.9% | 9.9 | 6.4 | 0.6 | 0.0 | 81 |
| the pair, arriving (L11, D gear) · Mortal · normal · careful | 370 | 118 | 0 | 402 | 243 | 174 | 46.9% | 13.5 | 8.0 | 0.8 | 0.0 | 77 |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · careful | 370 | 383 | 232 | 547 | 398 | 82 | 22.0% | 5.4 | 1.6 | 1.1 | 0.0 | 73 |
| the pair, ready (L14, C gear) · Mortal · normal · careful | 370 | 276 | 0 | 490 | 329 | 137 | 37.0% | 8.9 | 4.1 | 0.9 | 0.0 | 74 |
| solo warden, arriving (L13, D gear) · Mortal · normal · careful | 400 | 21 | 0 | 0 | 53 | 108 | 26.9% | 10.8 | 9.8 | 0.0 | 0.0 | 100 |
| solo warden, ground (L21, B gear) · Mortal · normal · careful | 400 | 184 | 0 | 376 | 210 | 152 | 38.0% | 6.0 | 5.6 | 0.0 | 0.0 | 100 |
| classic four, arriving (L13, D gear) · Mortal · normal · careful | 400 | 183 | 0 | 440 | 248 | 296 | 73.9% | 12.7 | 6.5 | 0.0 | 0.0 | 100 |
| crypt-breakers, arriving (L13, D gear) · Mortal · normal · careful | 400 | 172 | 0 | 404 | 218 | 191 | 47.7% | 8.6 | 5.9 | 0.0 | 0.0 | 100 |
| glass cannons, arriving (L13, D gear) · Mortal · normal · careful | 400 | 160 | 0 | 421 | 211 | 208 | 51.9% | 9.3 | 6.2 | 0.0 | 0.0 | 100 |
| the pair, arriving (L13, D gear) · Mortal · normal · careful | 400 | 138 | 0 | 405 | 184 | 155 | 38.6% | 10.1 | 7.0 | 0.0 | 0.0 | 100 |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · careful | 400 | 237 | 0 | 432 | 273 | 223 | 55.7% | 6.3 | 4.4 | 0.0 | 0.0 | 100 |
| the pair, ready (L15, C gear) · Mortal · normal · careful | 400 | 264 | 0 | 408 | 288 | 131 | 32.7% | 6.3 | 3.9 | 0.0 | 0.0 | 100 |
| solo warden, fresh · Mortal · hard · textbook | 300 | 5 | 0 | 0 | 136 | 63 | 20.9% | 16.3 | 17.9 | 1.0 | 0.0 | 75 |
| solo warden, fresh · Mortal · dread · textbook | 300 | 9 | 0 | 38 | 81 | 51 | 17.0% | 11.7 | 14.2 | 0.5 | 0.0 | 57 |
| solo warden, ground (L12, D gear) · Mortal · hard · textbook | 300 | 104 | 0 | 425 | 330 | 144 | 48.0% | 15.0 | 17.9 | 1.9 | 0.0 | 76 |
| solo warden, ground (L12, D gear) · Mortal · dread · textbook | 300 | 46 | 0 | 181 | 210 | 131 | 43.7% | 12.2 | 15.9 | 1.2 | 0.1 | 61 |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · hard · textbook | 300 | 196 | 0 | 412 | 346 | 147 | 49.0% | 24.8 | 10.5 | 1.4 | 0.0 | 75 |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · dread · textbook | 300 | 95 | 0 | 207 | 216 | 112 | 37.4% | 15.6 | 8.0 | 0.7 | 0.0 | 59 |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · hard · textbook | 300 | 69 | 0 | 325 | 363 | 162 | 54.1% | 16.8 | 15.4 | 2.2 | 0.0 | 76 |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · dread · textbook | 300 | 71 | 0 | 226 | 267 | 128 | 42.7% | 11.8 | 13.1 | 1.2 | 0.1 | 62 |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · hard · textbook | 300 | 143 | 0 | 285 | 255 | 61 | 20.4% | 9.4 | 5.7 | 1.4 | 0.0 | 76 |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · dread · textbook | 300 | 120 | 0 | 235 | 217 | 59 | 19.5% | 7.4 | 5.6 | 0.8 | 0.1 | 63 |
| the pair, fresh: blade, mender · Mortal · hard · textbook | 300 | 107 | 0 | 377 | 364 | 111 | 37.1% | 25.8 | 15.1 | 2.1 | 0.0 | 75 |
| the pair, fresh: blade, mender · Mortal · dread · textbook | 300 | 57 | 0 | 181 | 238 | 87 | 28.9% | 15.8 | 12.4 | 1.3 | 0.1 | 63 |
| crypt-breakers, levelled (L5, E gear) · Mortal · hard · textbook | 300 | 171 | 0 | 550 | 462 | 205 | 68.3% | 14.8 | 12.3 | 2.4 | 0.0 | 76 |
| crypt-breakers, levelled (L5, E gear) · Mortal · dread · textbook | 300 | 128 | 0 | 367 | 425 | 204 | 68.1% | 12.8 | 12.9 | 1.9 | 0.1 | 67 |
| the pair, levelled (L5, E gear) · Mortal · hard · textbook | 300 | 162 | 0 | 557 | 427 | 142 | 47.3% | 21.6 | 11.9 | 2.4 | 0.0 | 76 |
| the pair, levelled (L5, E gear) · Mortal · dread · textbook | 300 | 105 | 0 | 369 | 356 | 129 | 43.2% | 17.9 | 11.0 | 1.9 | 0.1 | 66 |
| solo warden, arriving (L5, E gear) · Mortal · hard · textbook | 480 | 9 | 0 | 37 | 119 | 87 | 18.1% | 16.1 | 14.1 | 1.0 | 0.4 | 55 |
| solo warden, arriving (L5, E gear) · Mortal · dread · textbook | 480 | 5 | 0 | 0 | 79 | 79 | 16.5% | 13.3 | 12.6 | 0.6 | 0.5 | 55 |
| solo warden, ground (L16, C gear) · Mortal · hard · textbook | 480 | 28 | 0 | 94 | 202 | 206 | 43.0% | 14.9 | 13.0 | 1.4 | 0.7 | 53 |
| solo warden, ground (L16, C gear) · Mortal · dread · textbook | 480 | 2 | 0 | 0 | 169 | 224 | 46.6% | 14.8 | 14.6 | 1.1 | 1.1 | 47 |
| classic four, arriving (L5, E gear) · Mortal · hard · textbook | 480 | 91 | 0 | 226 | 278 | 258 | 53.7% | 27.0 | 10.8 | 1.2 | 0.5 | 57 |
| classic four, arriving (L5, E gear) · Mortal · dread · textbook | 480 | 41 | 0 | 181 | 119 | 219 | 45.7% | 14.5 | 8.9 | 0.6 | 0.3 | 56 |
| crypt-breakers, arriving (L5, E gear) · Mortal · hard · textbook | 480 | 91 | 0 | 398 | 365 | 220 | 45.8% | 17.9 | 11.6 | 2.5 | 1.3 | 54 |
| crypt-breakers, arriving (L5, E gear) · Mortal · dread · textbook | 480 | 40 | 0 | 142 | 201 | 193 | 40.2% | 12.7 | 10.7 | 1.0 | 1.1 | 50 |
| glass cannons, arriving (L5, E gear) · Mortal · hard · textbook | 480 | 158 | 0 | 319 | 247 | 101 | 21.1% | 10.7 | 5.3 | 1.4 | 0.7 | 55 |
| glass cannons, arriving (L5, E gear) · Mortal · dread · textbook | 480 | 39 | 0 | 125 | 113 | 147 | 30.6% | 9.3 | 7.8 | 0.4 | 0.2 | - |
| the pair, arriving (L5, E gear) · Mortal · hard · textbook | 480 | 53 | 0 | 187 | 214 | 142 | 29.5% | 18.1 | 12.2 | 1.4 | 0.6 | 56 |
| the pair, arriving (L5, E gear) · Mortal · dread · textbook | 480 | 24 | 0 | 124 | 124 | 144 | 29.9% | 14.6 | 12.1 | 0.6 | 0.8 | 45 |
| crypt-breakers, ready (L9, D gear) · Mortal · hard · textbook | 480 | 307 | 0 | 695 | 512 | 276 | 57.5% | 15.7 | 9.8 | 3.4 | 0.9 | 55 |
| crypt-breakers, ready (L9, D gear) · Mortal · dread · textbook | 480 | 68 | 0 | 242 | 309 | 312 | 65.1% | 13.0 | 10.9 | 1.5 | 1.9 | 50 |
| the pair, ready (L9, D gear) · Mortal · hard · textbook | 480 | 135 | 0 | 491 | 320 | 192 | 39.9% | 18.0 | 9.9 | 1.9 | 1.0 | 55 |
| the pair, ready (L9, D gear) · Mortal · dread · textbook | 480 | 55 | 0 | 158 | 206 | 182 | 38.0% | 14.0 | 9.5 | 0.9 | 1.2 | 49 |
| solo warden, arriving (L11, D gear) · Mortal · hard · textbook | 370 | 2 | 0 | 0 | 52 | 114 | 30.8% | 11.2 | 10.8 | 0.2 | 0.0 | - |
| solo warden, arriving (L11, D gear) · Mortal · dread · textbook | 370 | 0 | 0 | 0 | 27 | 116 | 31.3% | 10.8 | 10.8 | 0.1 | 0.1 | - |
| solo warden, ground (L21, B gear) · Mortal · hard · textbook | 370 | 20 | 0 | 0 | 152 | 299 | 80.9% | 11.3 | 10.7 | 0.4 | 0.1 | 70 |
| solo warden, ground (L21, B gear) · Mortal · dread · textbook | 370 | 4 | 0 | 0 | 127 | 307 | 82.9% | 10.9 | 11.4 | 0.4 | 0.5 | - |
| classic four, arriving (L11, D gear) · Mortal · hard · textbook | 370 | 71 | 0 | 243 | 304 | 437 | 118.1% | 23.9 | 9.5 | 0.5 | 0.1 | 51 |
| classic four, arriving (L11, D gear) · Mortal · dread · textbook | 370 | 2 | 0 | 0 | 72 | 440 | 119.0% | 12.4 | 10.0 | 0.2 | 0.0 | - |
| crypt-breakers, arriving (L11, D gear) · Mortal · hard · textbook | 370 | 38 | 0 | 246 | 247 | 305 | 82.5% | 13.0 | 9.5 | 0.6 | 0.1 | 53 |
| crypt-breakers, arriving (L11, D gear) · Mortal · dread · textbook | 370 | 11 | 0 | 0 | 112 | 318 | 85.8% | 11.4 | 9.9 | 0.2 | 0.3 | - |
| glass cannons, arriving (L11, D gear) · Mortal · hard · textbook | 370 | 69 | 0 | 166 | 179 | 190 | 51.4% | 8.8 | 5.6 | 0.4 | 0.1 | - |
| glass cannons, arriving (L11, D gear) · Mortal · dread · textbook | 370 | 18 | 0 | 76 | 98 | 268 | 72.4% | 10.0 | 8.3 | 0.2 | 0.1 | - |
| the pair, arriving (L11, D gear) · Mortal · hard · textbook | 370 | 28 | 0 | 103 | 133 | 208 | 56.1% | 12.2 | 9.8 | 0.4 | 0.1 | - |
| the pair, arriving (L11, D gear) · Mortal · dread · textbook | 370 | 5 | 0 | 37 | 70 | 208 | 56.3% | 10.6 | 9.8 | 0.2 | 0.1 | - |
| crypt-breakers, ready (L14, C gear) · Mortal · hard · textbook | 370 | 145 | 0 | 552 | 349 | 372 | 100.6% | 10.6 | 7.3 | 0.8 | 0.2 | 60 |
| crypt-breakers, ready (L14, C gear) · Mortal · dread · textbook | 370 | 31 | 0 | 153 | 222 | 447 | 120.8% | 10.4 | 9.1 | 0.5 | 0.6 | - |
| the pair, ready (L14, C gear) · Mortal · hard · textbook | 370 | 72 | 0 | 347 | 236 | 300 | 81.1% | 11.8 | 9.5 | 0.6 | 0.1 | 68 |
| the pair, ready (L14, C gear) · Mortal · dread · textbook | 370 | 27 | 0 | 148 | 127 | 308 | 83.2% | 10.4 | 9.3 | 0.3 | 0.3 | - |
| solo warden, arriving (L13, D gear) · Mortal · hard · textbook | 400 | 2 | 0 | 0 | 8 | 109 | 27.2% | 10.1 | 9.8 | 0.0 | 0.0 | - |
| solo warden, arriving (L13, D gear) · Mortal · dread · textbook | 400 | 0 | 0 | 0 | 0 | 110 | 27.5% | 10.0 | 10.0 | 0.0 | 0.0 | - |
| solo warden, ground (L21, B gear) · Mortal · hard · textbook | 400 | 66 | 0 | 445 | 117 | 251 | 62.8% | 9.3 | 8.8 | 0.0 | 0.0 | 95 |
| solo warden, ground (L21, B gear) · Mortal · dread · textbook | 400 | 14 | 0 | 0 | 25 | 287 | 71.8% | 10.1 | 9.9 | 0.0 | 0.0 | 75 |
| classic four, arriving (L13, D gear) · Mortal · hard · textbook | 400 | 29 | 0 | 0 | 157 | 436 | 109.0% | 16.2 | 9.8 | 0.0 | 0.0 | 95 |
| classic four, arriving (L13, D gear) · Mortal · dread · textbook | 400 | 4 | 0 | 0 | 18 | 421 | 105.4% | 10.4 | 9.7 | 0.0 | 0.0 | - |
| crypt-breakers, arriving (L13, D gear) · Mortal · hard · textbook | 400 | 49 | 0 | 444 | 147 | 306 | 76.5% | 12.6 | 9.2 | 0.0 | 0.0 | 95 |
| crypt-breakers, arriving (L13, D gear) · Mortal · dread · textbook | 400 | 0 | 0 | 0 | 13 | 324 | 80.9% | 10.4 | 10.0 | 0.0 | 0.0 | - |
| glass cannons, arriving (L13, D gear) · Mortal · hard · textbook | 400 | 28 | 0 | 82 | 119 | 286 | 71.4% | 11.7 | 8.6 | 0.0 | 0.0 | 95 |
| glass cannons, arriving (L13, D gear) · Mortal · dread · textbook | 400 | 6 | 0 | 0 | 13 | 303 | 75.8% | 9.7 | 9.3 | 0.0 | 0.0 | - |
| the pair, arriving (L13, D gear) · Mortal · hard · textbook | 400 | 21 | 0 | 0 | 61 | 219 | 54.8% | 11.5 | 10.0 | 0.0 | 0.0 | 95 |
| the pair, arriving (L13, D gear) · Mortal · dread · textbook | 400 | 0 | 0 | 0 | 4 | 221 | 55.2% | 10.2 | 10.0 | 0.0 | 0.0 | - |
| crypt-breakers, ready (L14, C gear) · Mortal · hard · textbook | 400 | 82 | 0 | 468 | 176 | 438 | 109.5% | 10.8 | 8.5 | 0.0 | 0.0 | 95 |
| crypt-breakers, ready (L14, C gear) · Mortal · dread · textbook | 400 | 0 | 0 | 0 | 100 | 526 | 131.5% | 12.1 | 10.2 | 0.0 | 0.0 | - |
| the pair, ready (L15, C gear) · Mortal · hard · textbook | 400 | 96 | 0 | 461 | 165 | 281 | 70.4% | 10.5 | 8.4 | 0.0 | 0.0 | 95 |
| the pair, ready (L15, C gear) · Mortal · dread · textbook | 400 | 18 | 0 | 0 | 75 | 347 | 86.6% | 11.3 | 10.1 | 0.0 | 0.0 | 75 |
| classic four, fresh, diving into the Crypts (L1) · Mortal · normal · textbook | 480 | 271 | 0 | 698 | 445 | 213 | 44.4% | 50.1 | 13.3 | 2.1 | 1.3 | 55 |
| classic four, fresh, diving into the Crypts (L1) · Mortal · normal · careful | 480 | 0 | 0 | 0 | 0 | 0 | 0.0% | 0.0 | 0.0 | 0.0 | 0.0 | - |
| classic four, from the Cellars, diving into the Vault (L5, E gear) · Mortal · normal · textbook | 770 | 44 | 0 | 150 | 208 | 256 | 33.3% | 23.7 | 8.8 | 0.4 | 0.0 | 77 |
| classic four, from the Cellars, diving into the Vault (L5, E gear) · Mortal · normal · careful | 770 | 0 | 0 | 0 | 0 | 0 | 0.0% | 0.0 | 0.0 | 0.0 | 0.0 | - |
| solo warden, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 770 | 5 | 0 | 0 | 81 | 114 | 14.8% | 11.5 | 10.6 | 0.4 | 0.0 | - |
| solo warden, ground (L21, B gear), F7 to F8 in one delve · Mortal · normal · textbook | 770 | 61 | 0 | 126 | 283 | 301 | 39.0% | 12.5 | 11.1 | 0.8 | 0.0 | 75 |
| classic four, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 770 | 186 | 0 | 827 | 527 | 465 | 60.4% | 33.2 | 9.6 | 0.9 | 0.0 | 79 |
| crypt-breakers, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 770 | 82 | 0 | 430 | 346 | 316 | 41.0% | 15.0 | 9.6 | 0.9 | 0.0 | 76 |
| glass cannons, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 770 | 91 | 0 | 270 | 221 | 225 | 29.2% | 10.5 | 6.8 | 0.6 | 0.0 | 80 |
| the pair, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 770 | 84 | 0 | 503 | 283 | 224 | 29.0% | 16.4 | 10.4 | 0.8 | 0.0 | 81 |
| crypt-breakers, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook | 770 | 309 | 0 | 823 | 572 | 354 | 46.0% | 12.4 | 7.0 | 1.1 | 0.0 | 78 |
| the pair, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook | 770 | 277 | 0 | 806 | 460 | 269 | 34.9% | 14.1 | 8.1 | 0.9 | 0.0 | 79 |

## 7. Exploration

| Recipe | Ambushed (party) / delve | Ambushed (monsters) / delve | Hunter arrivals | Traps revealed / triggered / disarmed | Curios | Insights / delve | Ticks to the stairs (mean) |
|---|---|---|---|---|---|---|---|
| solo warden, fresh · Sheltered · normal · textbook | 1.6 (22% of fights) | 1.9 | 5% | 4.0 / 1.7 / 2.3 | 1.9 | 0.10 | 20 |
| solo warden, fresh · Mortal · normal · textbook | 1.6 (22% of fights) | 1.9 | 5% | 4.0 / 1.7 / 2.3 | 1.9 | 0.10 | 20 |
| solo warden, fresh · Nightmare · normal · textbook | 1.6 (22% of fights) | 1.9 | 5% | 4.0 / 1.7 / 2.3 | 1.9 | 0.10 | 20 |
| solo warden, ground (L12, D gear) · Sheltered · normal · textbook | 2.3 (21% of fights) | 2.4 | 1% | 5.2 / 2.6 / 3.1 | 2.8 | 0.21 | 29 |
| solo warden, ground (L12, D gear) · Mortal · normal · textbook | 2.3 (21% of fights) | 2.4 | 1% | 5.2 / 2.6 / 3.1 | 2.8 | 0.21 | 29 |
| solo warden, ground (L12, D gear) · Nightmare · normal · textbook | 2.3 (21% of fights) | 2.4 | 1% | 5.2 / 2.6 / 3.1 | 2.8 | 0.21 | 29 |
| classic four, fresh: warden, blade, mender, arcanist · Sheltered · normal · textbook | 1.7 (16% of fights) | 2.7 | 10% | 5.8 / 2.1 / 3.4 | 2.7 | 2.38 | 30 |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · textbook | 1.7 (16% of fights) | 2.6 | 8% | 5.5 / 2.0 / 3.3 | 2.6 | 2.08 | 28 |
| classic four, fresh: warden, blade, mender, arcanist · Nightmare · normal · textbook | 1.7 (17% of fights) | 2.6 | 8% | 5.5 / 2.0 / 3.3 | 2.6 | 2.08 | 27 |
| crypt-breakers, fresh: mender, warden, ranger · Sheltered · normal · textbook | 1.6 (16% of fights) | 3.3 | 5% | 5.8 / 2.0 / 3.7 | 2.7 | 1.15 | 24 |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · textbook | 1.6 (16% of fights) | 3.2 | 5% | 5.7 / 2.0 / 3.6 | 2.6 | 1.09 | 24 |
| crypt-breakers, fresh: mender, warden, ranger · Nightmare · normal · textbook | 1.6 (16% of fights) | 3.2 | 5% | 5.7 / 2.0 / 3.6 | 2.6 | 1.09 | 24 |
| glass cannons, fresh: arcanist, shade, ranger · Sheltered · normal · textbook | 1.1 (12% of fights) | 3.0 | 4% | 5.0 / 1.5 / 3.3 | 2.4 | 0.89 | 22 |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · textbook | 1.1 (12% of fights) | 2.9 | 4% | 4.8 / 1.5 / 3.2 | 2.3 | 0.84 | 21 |
| glass cannons, fresh: arcanist, shade, ranger · Nightmare · normal · textbook | 1.1 (12% of fights) | 2.9 | 4% | 4.8 / 1.5 / 3.2 | 2.3 | 0.84 | 21 |
| the pair, fresh: blade, mender · Sheltered · normal · textbook | 2.0 (20% of fights) | 2.5 | 1% | 5.2 / 2.8 / 2.9 | 2.6 | 0.83 | 23 |
| the pair, fresh: blade, mender · Mortal · normal · textbook | 2.0 (20% of fights) | 2.5 | 1% | 5.1 / 2.8 / 2.9 | 2.6 | 0.82 | 23 |
| the pair, fresh: blade, mender · Nightmare · normal · textbook | 2.0 (20% of fights) | 2.5 | 1% | 5.1 / 2.8 / 2.9 | 2.6 | 0.82 | 23 |
| crypt-breakers, levelled (L5, E gear) · Sheltered · normal · textbook | 1.4 (14% of fights) | 3.2 | 1% | 5.9 / 1.6 / 4.2 | 2.8 | 0.92 | 24 |
| crypt-breakers, levelled (L5, E gear) · Mortal · normal · textbook | 1.4 (14% of fights) | 3.2 | 1% | 5.9 / 1.6 / 4.2 | 2.8 | 0.92 | 24 |
| crypt-breakers, levelled (L5, E gear) · Nightmare · normal · textbook | 1.4 (14% of fights) | 3.2 | 1% | 5.9 / 1.6 / 4.2 | 2.8 | 0.92 | 24 |
| the pair, levelled (L5, E gear) · Sheltered · normal · textbook | 2.2 (20% of fights) | 2.6 | 0% | 5.4 / 2.8 / 3.1 | 2.8 | 0.81 | 26 |
| the pair, levelled (L5, E gear) · Mortal · normal · textbook | 2.2 (21% of fights) | 2.5 | 0% | 5.4 / 2.8 / 3.1 | 2.8 | 0.80 | 25 |
| the pair, levelled (L5, E gear) · Nightmare · normal · textbook | 2.2 (21% of fights) | 2.5 | 0% | 5.4 / 2.8 / 3.1 | 2.8 | 0.80 | 25 |
| solo warden, arriving (L5, E gear) · Sheltered · normal · textbook | 0.5 (7% of fights) | 1.6 | 42% | 0.1 / 3.0 / 0.0 | 1.8 | 0.25 | 33 |
| solo warden, arriving (L5, E gear) · Mortal · normal · textbook | 0.5 (7% of fights) | 1.6 | 42% | 0.1 / 3.0 / 0.0 | 1.8 | 0.25 | 33 |
| solo warden, arriving (L5, E gear) · Nightmare · normal · textbook | 0.5 (7% of fights) | 1.6 | 42% | 0.1 / 3.0 / 0.0 | 1.8 | 0.25 | 33 |
| solo warden, ground (L16, C gear) · Sheltered · normal · textbook | 0.7 (7% of fights) | 2.0 | 36% | 0.1 / 4.0 / 0.0 | 2.6 | 0.45 | 35 |
| solo warden, ground (L16, C gear) · Mortal · normal · textbook | 0.7 (7% of fights) | 2.0 | 36% | 0.1 / 4.0 / 0.0 | 2.6 | 0.45 | 35 |
| solo warden, ground (L16, C gear) · Nightmare · normal · textbook | 0.7 (7% of fights) | 2.0 | 36% | 0.1 / 4.0 / 0.0 | 2.6 | 0.45 | 35 |
| classic four, arriving (L5, E gear) · Sheltered · normal · textbook | 0.6 (5% of fights) | 3.1 | 62% | 2.9 / 3.9 / 0.0 | 3.1 | 6.44 | 42 |
| classic four, arriving (L5, E gear) · Mortal · normal · textbook | 0.5 (5% of fights) | 2.9 | 57% | 2.6 / 3.7 / 0.0 | 2.8 | 5.74 | 41 |
| classic four, arriving (L5, E gear) · Nightmare · normal · textbook | 0.5 (5% of fights) | 2.9 | 55% | 2.6 / 3.7 / 0.0 | 2.8 | 5.72 | 41 |
| crypt-breakers, arriving (L5, E gear) · Sheltered · normal · textbook | 0.2 (2% of fights) | 3.6 | 51% | 6.5 / 2.7 / 3.9 | 3.0 | 2.78 | 37 |
| crypt-breakers, arriving (L5, E gear) · Mortal · normal · textbook | 0.2 (2% of fights) | 3.5 | 51% | 6.4 / 2.6 / 3.9 | 2.9 | 2.73 | 37 |
| crypt-breakers, arriving (L5, E gear) · Nightmare · normal · textbook | 0.2 (2% of fights) | 3.5 | 51% | 6.4 / 2.6 / 3.9 | 2.9 | 2.72 | 37 |
| glass cannons, arriving (L5, E gear) · Sheltered · normal · textbook | 0.1 (1% of fights) | 2.8 | 66% | 4.8 / 1.7 / 2.7 | 2.2 | 2.66 | 38 |
| glass cannons, arriving (L5, E gear) · Mortal · normal · textbook | 0.1 (1% of fights) | 2.7 | 65% | 4.6 / 1.7 / 2.6 | 2.1 | 2.45 | 38 |
| glass cannons, arriving (L5, E gear) · Nightmare · normal · textbook | 0.1 (1% of fights) | 2.7 | 63% | 4.6 / 1.7 / 2.6 | 2.1 | 2.45 | 38 |
| the pair, arriving (L5, E gear) · Sheltered · normal · textbook | 0.8 (7% of fights) | 2.6 | 42% | 0.1 / 5.7 / 0.0 | 2.9 | 1.62 | 35 |
| the pair, arriving (L5, E gear) · Mortal · normal · textbook | 0.7 (7% of fights) | 2.5 | 40% | 0.1 / 5.5 / 0.0 | 2.7 | 1.53 | 34 |
| the pair, arriving (L5, E gear) · Nightmare · normal · textbook | 0.7 (7% of fights) | 2.5 | 40% | 0.1 / 5.4 / 0.0 | 2.7 | 1.53 | 34 |
| crypt-breakers, ready (L9, D gear) · Sheltered · normal · textbook | 0.3 (3% of fights) | 3.6 | 42% | 7.0 / 2.9 / 4.2 | 3.1 | 2.42 | 35 |
| crypt-breakers, ready (L9, D gear) · Mortal · normal · textbook | 0.3 (3% of fights) | 3.6 | 42% | 6.9 / 2.8 / 4.1 | 3.1 | 2.41 | 35 |
| crypt-breakers, ready (L9, D gear) · Nightmare · normal · textbook | 0.3 (3% of fights) | 3.6 | 42% | 6.9 / 2.8 / 4.1 | 3.1 | 2.41 | 35 |
| the pair, ready (L9, D gear) · Sheltered · normal · textbook | 0.9 (8% of fights) | 2.8 | 32% | 0.1 / 6.2 / 0.0 | 3.1 | 1.36 | 33 |
| the pair, ready (L9, D gear) · Mortal · normal · textbook | 0.9 (8% of fights) | 2.7 | 31% | 0.1 / 6.2 / 0.0 | 3.1 | 1.34 | 33 |
| the pair, ready (L9, D gear) · Nightmare · normal · textbook | 0.9 (8% of fights) | 2.7 | 31% | 0.1 / 6.2 / 0.0 | 3.1 | 1.34 | 33 |
| solo warden, arriving (L11, D gear) · Sheltered · normal · textbook | 0.2 (7% of fights) | 0.5 | 0% | 0.2 / 0.5 / 0.0 | 0.5 | 0.14 | - |
| solo warden, arriving (L11, D gear) · Mortal · normal · textbook | 0.2 (7% of fights) | 0.5 | 0% | 0.2 / 0.5 / 0.0 | 0.5 | 0.14 | - |
| solo warden, arriving (L11, D gear) · Nightmare · normal · textbook | 0.2 (7% of fights) | 0.5 | 0% | 0.2 / 0.5 / 0.0 | 0.5 | 0.14 | - |
| solo warden, ground (L21, B gear) · Sheltered · normal · textbook | 0.4 (10% of fights) | 0.8 | 0% | 0.4 / 0.7 / 0.0 | 0.8 | 0.39 | 60 |
| solo warden, ground (L21, B gear) · Mortal · normal · textbook | 0.4 (10% of fights) | 0.8 | 0% | 0.4 / 0.7 / 0.0 | 0.8 | 0.39 | 60 |
| solo warden, ground (L21, B gear) · Nightmare · normal · textbook | 0.4 (10% of fights) | 0.8 | 0% | 0.4 / 0.7 / 0.0 | 0.8 | 0.39 | 60 |
| classic four, arriving (L11, D gear) · Sheltered · normal · textbook | 0.2 (5% of fights) | 1.1 | 0% | 0.5 / 0.7 / 0.0 | 1.0 | 3.73 | 50 |
| classic four, arriving (L11, D gear) · Mortal · normal · textbook | 0.2 (5% of fights) | 1.0 | 0% | 0.4 / 0.7 / 0.0 | 1.0 | 3.49 | 49 |
| classic four, arriving (L11, D gear) · Nightmare · normal · textbook | 0.2 (5% of fights) | 1.0 | 0% | 0.4 / 0.7 / 0.0 | 1.0 | 3.49 | 49 |
| crypt-breakers, arriving (L11, D gear) · Sheltered · normal · textbook | 0.2 (4% of fights) | 1.5 | 0% | 0.6 / 0.6 / 0.0 | 1.0 | 1.46 | 49 |
| crypt-breakers, arriving (L11, D gear) · Mortal · normal · textbook | 0.2 (4% of fights) | 1.5 | 0% | 0.6 / 0.6 / 0.0 | 0.9 | 1.43 | 49 |
| crypt-breakers, arriving (L11, D gear) · Nightmare · normal · textbook | 0.2 (4% of fights) | 1.5 | 0% | 0.6 / 0.6 / 0.0 | 0.9 | 1.43 | 49 |
| glass cannons, arriving (L11, D gear) · Sheltered · normal · textbook | 0.1 (2% of fights) | 1.4 | 0% | 0.3 / 0.7 / 0.0 | 0.8 | 1.48 | 45 |
| glass cannons, arriving (L11, D gear) · Mortal · normal · textbook | 0.1 (2% of fights) | 1.4 | 0% | 0.2 / 0.6 / 0.0 | 0.7 | 1.41 | 43 |
| glass cannons, arriving (L11, D gear) · Nightmare · normal · textbook | 0.1 (2% of fights) | 1.4 | 0% | 0.2 / 0.6 / 0.0 | 0.7 | 1.41 | 43 |
| the pair, arriving (L11, D gear) · Sheltered · normal · textbook | 0.4 (8% of fights) | 1.0 | 0% | 0.4 / 0.7 / 0.0 | 0.8 | 0.89 | 57 |
| the pair, arriving (L11, D gear) · Mortal · normal · textbook | 0.3 (8% of fights) | 0.9 | 0% | 0.3 / 0.7 / 0.0 | 0.8 | 0.83 | 56 |
| the pair, arriving (L11, D gear) · Nightmare · normal · textbook | 0.3 (8% of fights) | 0.9 | 0% | 0.3 / 0.7 / 0.0 | 0.8 | 0.83 | 56 |
| crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook | 0.1 (2% of fights) | 1.5 | 0% | 0.6 / 0.7 / 0.0 | 1.1 | 1.29 | 42 |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook | 0.1 (2% of fights) | 1.4 | 0% | 0.6 / 0.7 / 0.0 | 1.0 | 1.27 | 41 |
| crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook | 0.1 (2% of fights) | 1.4 | 0% | 0.6 / 0.7 / 0.0 | 1.0 | 1.27 | 42 |
| the pair, ready (L14, C gear) · Sheltered · normal · textbook | 0.4 (8% of fights) | 1.2 | 0% | 0.4 / 0.8 / 0.0 | 1.1 | 0.97 | 49 |
| the pair, ready (L14, C gear) · Mortal · normal · textbook | 0.4 (8% of fights) | 1.2 | 0% | 0.4 / 0.8 / 0.0 | 1.0 | 0.97 | 49 |
| the pair, ready (L14, C gear) · Nightmare · normal · textbook | 0.4 (8% of fights) | 1.2 | 0% | 0.4 / 0.8 / 0.0 | 1.0 | 0.97 | 50 |
| solo warden, arriving (L13, D gear) · Sheltered · normal · textbook | 0.2 (12% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.14 | 25 |
| solo warden, arriving (L13, D gear) · Mortal · normal · textbook | 0.2 (12% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.14 | 25 |
| solo warden, arriving (L13, D gear) · Nightmare · normal · textbook | 0.2 (12% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.14 | 25 |
| solo warden, ground (L21, B gear) · Sheltered · normal · textbook | 0.2 (10% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.15 | 21 |
| solo warden, ground (L21, B gear) · Mortal · normal · textbook | 0.2 (10% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.15 | 21 |
| solo warden, ground (L21, B gear) · Nightmare · normal · textbook | 0.2 (10% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.15 | 21 |
| classic four, arriving (L13, D gear) · Sheltered · normal · textbook | 0.1 (5% of fights) | 0.4 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.85 | 22 |
| classic four, arriving (L13, D gear) · Mortal · normal · textbook | 0.1 (5% of fights) | 0.4 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.85 | 22 |
| classic four, arriving (L13, D gear) · Nightmare · normal · textbook | 0.1 (5% of fights) | 0.4 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.85 | 22 |
| crypt-breakers, arriving (L13, D gear) · Sheltered · normal · textbook | 0.0 (2% of fights) | 0.4 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.57 | 17 |
| crypt-breakers, arriving (L13, D gear) · Mortal · normal · textbook | 0.0 (2% of fights) | 0.4 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.57 | 17 |
| crypt-breakers, arriving (L13, D gear) · Nightmare · normal · textbook | 0.0 (2% of fights) | 0.4 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.57 | 17 |
| glass cannons, arriving (L13, D gear) · Sheltered · normal · textbook | 0.0 (1% of fights) | 0.5 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.80 | 21 |
| glass cannons, arriving (L13, D gear) · Mortal · normal · textbook | 0.0 (1% of fights) | 0.5 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.80 | 21 |
| glass cannons, arriving (L13, D gear) · Nightmare · normal · textbook | 0.0 (1% of fights) | 0.5 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.80 | 21 |
| the pair, arriving (L13, D gear) · Sheltered · normal · textbook | 0.2 (10% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.30 | 24 |
| the pair, arriving (L13, D gear) · Mortal · normal · textbook | 0.2 (10% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.30 | 24 |
| the pair, arriving (L13, D gear) · Nightmare · normal · textbook | 0.2 (10% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.30 | 24 |
| crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook | 0.0 (2% of fights) | 0.4 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.52 | 14 |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook | 0.0 (2% of fights) | 0.4 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.52 | 14 |
| crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook | 0.0 (2% of fights) | 0.4 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.52 | 14 |
| the pair, ready (L15, C gear) · Sheltered · normal · textbook | 0.2 (10% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.34 | 21 |
| the pair, ready (L15, C gear) · Mortal · normal · textbook | 0.2 (10% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.34 | 21 |
| the pair, ready (L15, C gear) · Nightmare · normal · textbook | 0.2 (10% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.34 | 21 |
| solo warden, fresh · Mortal · normal · careful | 1.6 (22% of fights) | 1.8 | 5% | 4.0 / 1.7 / 2.3 | 1.9 | 0.10 | 20 |
| solo warden, ground (L12, D gear) · Mortal · normal · careful | 2.3 (21% of fights) | 2.4 | 1% | 5.2 / 2.6 / 3.1 | 2.8 | 0.21 | 29 |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · careful | 1.4 (17% of fights) | 2.2 | 8% | 4.9 / 1.9 / 2.9 | 2.3 | 1.57 | 26 |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · careful | 1.4 (16% of fights) | 2.8 | 5% | 4.8 / 1.7 / 3.2 | 2.3 | 0.83 | 24 |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · careful | 0.9 (12% of fights) | 2.5 | 4% | 4.2 / 1.3 / 2.8 | 2.0 | 0.62 | 21 |
| the pair, fresh: blade, mender · Mortal · normal · careful | 2.0 (21% of fights) | 2.3 | 1% | 5.0 / 2.7 / 2.7 | 2.5 | 0.74 | 23 |
| crypt-breakers, levelled (L5, E gear) · Mortal · normal · careful | 1.4 (14% of fights) | 3.2 | 1% | 5.9 / 1.6 / 4.2 | 2.8 | 0.92 | 24 |
| the pair, levelled (L5, E gear) · Mortal · normal · careful | 2.2 (21% of fights) | 2.5 | 0% | 5.4 / 2.8 / 3.1 | 2.8 | 0.80 | 25 |
| solo warden, arriving (L5, E gear) · Mortal · normal · careful | 0.5 (7% of fights) | 1.6 | 42% | 0.1 / 2.9 / 0.0 | 1.8 | 0.25 | 33 |
| solo warden, ground (L16, C gear) · Mortal · normal · careful | 0.7 (7% of fights) | 2.0 | 36% | 0.1 / 4.0 / 0.0 | 2.6 | 0.45 | 35 |
| classic four, arriving (L5, E gear) · Mortal · normal · careful | 0.5 (4% of fights) | 2.8 | 57% | 2.4 / 3.5 / 0.0 | 2.7 | 5.47 | 42 |
| crypt-breakers, arriving (L5, E gear) · Mortal · normal · careful | 0.2 (2% of fights) | 3.4 | 51% | 6.2 / 2.5 / 3.7 | 2.8 | 2.51 | 38 |
| glass cannons, arriving (L5, E gear) · Mortal · normal · careful | 0.1 (1% of fights) | 2.7 | 65% | 4.4 / 1.6 / 2.5 | 2.0 | 2.29 | 39 |
| the pair, arriving (L5, E gear) · Mortal · normal · careful | 0.7 (7% of fights) | 2.5 | 40% | 0.1 / 5.3 / 0.0 | 2.7 | 1.43 | 34 |
| crypt-breakers, ready (L9, D gear) · Mortal · normal · careful | 0.3 (3% of fights) | 3.6 | 42% | 6.9 / 2.8 / 4.1 | 3.1 | 2.41 | 35 |
| the pair, ready (L9, D gear) · Mortal · normal · careful | 0.9 (8% of fights) | 2.7 | 31% | 0.1 / 6.2 / 0.0 | 3.1 | 1.34 | 33 |
| solo warden, arriving (L11, D gear) · Mortal · normal · careful | 0.2 (7% of fights) | 0.5 | 0% | 0.2 / 0.5 / 0.0 | 0.5 | 0.14 | - |
| solo warden, ground (L21, B gear) · Mortal · normal · careful | 0.4 (10% of fights) | 0.8 | 0% | 0.4 / 0.7 / 0.0 | 0.8 | 0.39 | 60 |
| classic four, arriving (L11, D gear) · Mortal · normal · careful | 0.2 (5% of fights) | 1.0 | 0% | 0.4 / 0.7 / 0.0 | 1.0 | 3.49 | 49 |
| crypt-breakers, arriving (L11, D gear) · Mortal · normal · careful | 0.2 (4% of fights) | 1.5 | 0% | 0.6 / 0.6 / 0.0 | 0.9 | 1.43 | 49 |
| glass cannons, arriving (L11, D gear) · Mortal · normal · careful | 0.1 (2% of fights) | 1.4 | 0% | 0.2 / 0.6 / 0.0 | 0.7 | 1.41 | 43 |
| the pair, arriving (L11, D gear) · Mortal · normal · careful | 0.3 (8% of fights) | 0.9 | 0% | 0.3 / 0.7 / 0.0 | 0.8 | 0.83 | 56 |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · careful | 0.1 (2% of fights) | 1.4 | 0% | 0.6 / 0.7 / 0.0 | 1.0 | 1.27 | 41 |
| the pair, ready (L14, C gear) · Mortal · normal · careful | 0.4 (8% of fights) | 1.2 | 0% | 0.4 / 0.8 / 0.0 | 1.0 | 0.97 | 49 |
| solo warden, arriving (L13, D gear) · Mortal · normal · careful | 0.2 (12% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.14 | 25 |
| solo warden, ground (L21, B gear) · Mortal · normal · careful | 0.2 (10% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.15 | 21 |
| classic four, arriving (L13, D gear) · Mortal · normal · careful | 0.1 (5% of fights) | 0.4 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.85 | 22 |
| crypt-breakers, arriving (L13, D gear) · Mortal · normal · careful | 0.0 (2% of fights) | 0.4 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.57 | 17 |
| glass cannons, arriving (L13, D gear) · Mortal · normal · careful | 0.0 (1% of fights) | 0.5 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.80 | 21 |
| the pair, arriving (L13, D gear) · Mortal · normal · careful | 0.2 (10% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.30 | 24 |
| crypt-breakers, ready (L14, C gear) · Mortal · normal · careful | 0.0 (2% of fights) | 0.4 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.52 | 14 |
| the pair, ready (L15, C gear) · Mortal · normal · careful | 0.2 (10% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.34 | 21 |
| solo warden, fresh · Mortal · hard · textbook | 1.2 (24% of fights) | 1.1 | 20% | 1.5 / 1.3 / 0.6 | 1.2 | 0.05 | 20 |
| solo warden, fresh · Mortal · dread · textbook | 0.9 (35% of fights) | 0.3 | 20% | 0.5 / 0.7 / 0.2 | 0.7 | 0.03 | 17 |
| solo warden, ground (L12, D gear) · Mortal · hard · textbook | 2.3 (24% of fights) | 1.9 | 33% | 2.4 / 2.2 / 1.3 | 2.5 | 0.23 | 26 |
| solo warden, ground (L12, D gear) · Mortal · dread · textbook | 1.4 (25% of fights) | 1.3 | 63% | 1.2 / 1.2 / 0.7 | 1.1 | 0.03 | 21 |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · hard · textbook | 1.4 (22% of fights) | 1.3 | 43% | 2.6 / 2.1 / 1.0 | 1.5 | 1.25 | 26 |
| classic four, fresh: warden, blade, mender, arcanist · Mortal · dread · textbook | 0.9 (28% of fights) | 0.7 | 45% | 1.0 / 1.1 / 0.3 | 0.9 | 0.75 | 23 |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · hard · textbook | 1.6 (17% of fights) | 2.6 | 28% | 4.8 / 1.6 / 3.1 | 2.4 | 0.93 | 22 |
| crypt-breakers, fresh: mender, warden, ranger · Mortal · dread · textbook | 1.0 (19% of fights) | 1.3 | 60% | 3.1 / 1.4 / 1.6 | 1.3 | 0.55 | 23 |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · hard · textbook | 1.0 (16% of fights) | 1.9 | 35% | 3.9 / 1.6 / 2.3 | 1.7 | 0.82 | 22 |
| glass cannons, fresh: arcanist, shade, ranger · Mortal · dread · textbook | 0.7 (16% of fights) | 1.1 | 60% | 2.1 / 1.0 / 1.1 | 1.0 | 0.15 | 21 |
| the pair, fresh: blade, mender · Mortal · hard · textbook | 2.3 (25% of fights) | 1.7 | 40% | 2.9 / 2.1 / 1.6 | 2.5 | 0.70 | 25 |
| the pair, fresh: blade, mender · Mortal · dread · textbook | 1.4 (27% of fights) | 1.0 | 68% | 1.3 / 1.6 / 0.6 | 1.3 | 0.23 | 21 |
| crypt-breakers, levelled (L5, E gear) · Mortal · hard · textbook | 1.4 (14% of fights) | 2.9 | 23% | 5.5 / 1.9 / 3.6 | 2.7 | 0.97 | 22 |
| crypt-breakers, levelled (L5, E gear) · Mortal · dread · textbook | 1.2 (16% of fights) | 2.0 | 70% | 4.5 / 1.9 / 2.5 | 2.0 | 1.13 | 24 |
| the pair, levelled (L5, E gear) · Mortal · hard · textbook | 2.0 (21% of fights) | 2.3 | 28% | 3.0 / 2.4 / 1.7 | 2.6 | 1.02 | 24 |
| the pair, levelled (L5, E gear) · Mortal · dread · textbook | 1.6 (22% of fights) | 1.5 | 73% | 1.7 / 2.2 / 0.8 | 1.9 | 0.60 | 23 |
| solo warden, arriving (L5, E gear) · Mortal · hard · textbook | 0.2 (6% of fights) | 1.1 | 55% | 0.0 / 2.6 / 0.0 | 0.9 | 0.20 | 38 |
| solo warden, arriving (L5, E gear) · Mortal · dread · textbook | 0.3 (10% of fights) | 0.5 | 60% | 0.0 / 1.4 / 0.0 | 0.6 | 0.15 | 37 |
| solo warden, ground (L16, C gear) · Mortal · hard · textbook | 0.4 (6% of fights) | 1.1 | 65% | 0.1 / 3.1 / 0.0 | 1.5 | 0.28 | 37 |
| solo warden, ground (L16, C gear) · Mortal · dread · textbook | 0.3 (7% of fights) | 0.8 | 80% | 0.1 / 2.6 / 0.0 | 1.0 | 0.07 | 38 |
| classic four, arriving (L5, E gear) · Mortal · hard · textbook | 0.2 (3% of fights) | 1.4 | 80% | 0.4 / 2.6 / 0.0 | 1.3 | 3.00 | 42 |
| classic four, arriving (L5, E gear) · Mortal · dread · textbook | 0.1 (7% of fights) | 0.5 | 48% | 0.1 / 1.4 / 0.0 | 0.5 | 1.18 | 47 |
| crypt-breakers, arriving (L5, E gear) · Mortal · hard · textbook | 0.2 (3% of fights) | 2.1 | 85% | 2.9 / 3.2 / 1.6 | 2.1 | 2.25 | 35 |
| crypt-breakers, arriving (L5, E gear) · Mortal · dread · textbook | 0.2 (5% of fights) | 1.1 | 83% | 0.1 / 2.4 / 0.1 | 0.9 | 1.55 | 49 |
| glass cannons, arriving (L5, E gear) · Mortal · hard · textbook | 0.1 (1% of fights) | 1.5 | 75% | 2.3 / 2.3 / 1.1 | 1.6 | 2.13 | 34 |
| glass cannons, arriving (L5, E gear) · Mortal · dread · textbook | 0.1 (2% of fights) | 0.6 | 60% | 0.1 / 1.4 / 0.1 | 0.5 | 0.93 | - |
| the pair, arriving (L5, E gear) · Mortal · hard · textbook | 0.5 (9% of fights) | 1.3 | 73% | 0.1 / 3.2 / 0.0 | 1.4 | 1.40 | 38 |
| the pair, arriving (L5, E gear) · Mortal · dread · textbook | 0.5 (13% of fights) | 0.6 | 65% | 0.0 / 2.1 / 0.0 | 0.7 | 0.80 | 47 |
| crypt-breakers, ready (L9, D gear) · Mortal · hard · textbook | 0.1 (1% of fights) | 2.6 | 75% | 4.8 / 3.1 / 2.9 | 3.0 | 2.92 | 37 |
| crypt-breakers, ready (L9, D gear) · Mortal · dread · textbook | 0.3 (5% of fights) | 1.2 | 90% | 0.6 / 3.1 / 0.3 | 1.4 | 1.63 | 42 |
| the pair, ready (L9, D gear) · Mortal · hard · textbook | 0.7 (9% of fights) | 1.4 | 73% | 0.1 / 4.4 / 0.0 | 1.9 | 1.27 | 36 |
| the pair, ready (L9, D gear) · Mortal · dread · textbook | 0.3 (7% of fights) | 0.8 | 78% | 0.1 / 2.9 / 0.0 | 1.1 | 0.95 | 36 |
| solo warden, arriving (L11, D gear) · Mortal · hard · textbook | 0.2 (11% of fights) | 0.3 | 0% | 0.1 / 0.1 / 0.0 | 0.2 | 0.25 | - |
| solo warden, arriving (L11, D gear) · Mortal · dread · textbook | 0.1 (9% of fights) | 0.3 | 0% | 0.1 / 0.3 / 0.0 | 0.1 | 0.05 | - |
| solo warden, ground (L21, B gear) · Mortal · hard · textbook | 0.4 (11% of fights) | 0.6 | 0% | 0.2 / 0.7 / 0.0 | 0.5 | 0.38 | 58 |
| solo warden, ground (L21, B gear) · Mortal · dread · textbook | 0.5 (20% of fights) | 0.4 | 0% | 0.1 / 1.1 / 0.0 | 0.4 | 0.28 | - |
| classic four, arriving (L11, D gear) · Mortal · hard · textbook | 0.4 (11% of fights) | 0.8 | 0% | 0.2 / 0.9 / 0.0 | 0.6 | 2.70 | 70 |
| classic four, arriving (L11, D gear) · Mortal · dread · textbook | 0.1 (9% of fights) | 0.3 | 0% | 0.1 / 0.2 / 0.0 | 0.2 | 0.28 | - |
| crypt-breakers, arriving (L11, D gear) · Mortal · hard · textbook | 0.3 (7% of fights) | 1.0 | 0% | 0.3 / 1.0 / 0.0 | 0.6 | 1.20 | 49 |
| crypt-breakers, arriving (L11, D gear) · Mortal · dread · textbook | 0.3 (16% of fights) | 0.4 | 0% | 0.1 / 0.8 / 0.0 | 0.4 | 0.53 | - |
| glass cannons, arriving (L11, D gear) · Mortal · hard · textbook | 0.1 (3% of fights) | 1.3 | 0% | 0.1 / 0.7 / 0.0 | 0.5 | 1.05 | - |
| glass cannons, arriving (L11, D gear) · Mortal · dread · textbook | 0.1 (4% of fights) | 0.6 | 0% | 0.1 / 0.6 / 0.0 | 0.3 | 0.63 | - |
| the pair, arriving (L11, D gear) · Mortal · hard · textbook | 0.2 (9% of fights) | 0.5 | 0% | 0.1 / 0.6 / 0.0 | 0.4 | 0.35 | - |
| the pair, arriving (L11, D gear) · Mortal · dread · textbook | 0.1 (9% of fights) | 0.3 | 0% | 0.1 / 0.5 / 0.0 | 0.3 | 0.17 | - |
| crypt-breakers, ready (L14, C gear) · Mortal · hard · textbook | 0.3 (5% of fights) | 0.9 | 0% | 0.2 / 1.0 / 0.0 | 0.8 | 1.27 | 43 |
| crypt-breakers, ready (L14, C gear) · Mortal · dread · textbook | 0.3 (9% of fights) | 0.6 | 0% | 0.1 / 1.0 / 0.0 | 0.5 | 0.85 | - |
| the pair, ready (L14, C gear) · Mortal · hard · textbook | 0.5 (13% of fights) | 0.7 | 0% | 0.2 / 0.9 / 0.0 | 0.6 | 0.53 | 47 |
| the pair, ready (L14, C gear) · Mortal · dread · textbook | 0.3 (13% of fights) | 0.4 | 0% | 0.1 / 0.8 / 0.0 | 0.4 | 0.33 | - |
| solo warden, arriving (L13, D gear) · Mortal · hard · textbook | 0.2 (19% of fights) | 0.2 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.07 | - |
| solo warden, arriving (L13, D gear) · Mortal · dread · textbook | 0.2 (20% of fights) | 0.2 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.00 | - |
| solo warden, ground (L21, B gear) · Mortal · hard · textbook | 0.2 (11% of fights) | 0.2 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.10 | 21 |
| solo warden, ground (L21, B gear) · Mortal · dread · textbook | 0.2 (18% of fights) | 0.2 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.03 | 46 |
| classic four, arriving (L13, D gear) · Mortal · hard · textbook | 0.2 (10% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.95 | 30 |
| classic four, arriving (L13, D gear) · Mortal · dread · textbook | 0.2 (17% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.17 | - |
| crypt-breakers, arriving (L13, D gear) · Mortal · hard · textbook | 0.1 (6% of fights) | 0.4 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.55 | 19 |
| crypt-breakers, arriving (L13, D gear) · Mortal · dread · textbook | 0.1 (12% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.05 | - |
| glass cannons, arriving (L13, D gear) · Mortal · hard · textbook | 0.1 (4% of fights) | 0.4 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.82 | 25 |
| glass cannons, arriving (L13, D gear) · Mortal · dread · textbook | 0.1 (10% of fights) | 0.4 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.07 | - |
| the pair, arriving (L13, D gear) · Mortal · hard · textbook | 0.2 (14% of fights) | 0.2 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.15 | 27 |
| the pair, arriving (L13, D gear) · Mortal · dread · textbook | 0.2 (20% of fights) | 0.2 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.00 | - |
| crypt-breakers, ready (L14, C gear) · Mortal · hard · textbook | 0.1 (6% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.47 | 18 |
| crypt-breakers, ready (L14, C gear) · Mortal · dread · textbook | 0.1 (8% of fights) | 0.3 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.40 | - |
| the pair, ready (L15, C gear) · Mortal · hard · textbook | 0.2 (11% of fights) | 0.2 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.30 | 29 |
| the pair, ready (L15, C gear) · Mortal · dread · textbook | 0.2 (14% of fights) | 0.2 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.20 | 44 |
| classic four, fresh, diving into the Crypts (L1) · Mortal · normal · textbook | 0.5 (5% of fights) | 2.1 | 67% | 1.9 / 3.4 / 0.0 | 2.2 | 5.53 | 45 |
| classic four, fresh, diving into the Crypts (L1) · Mortal · normal · careful | 0.0 (- of fights) | 0.0 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.00 | - |
| classic four, from the Cellars, diving into the Vault (L5, E gear) · Mortal · normal · textbook | 0.1 (5% of fights) | 0.7 | 0% | 0.2 / 0.4 / 0.0 | 0.5 | 2.18 | 62 |
| classic four, from the Cellars, diving into the Vault (L5, E gear) · Mortal · normal · careful | 0.0 (- of fights) | 0.0 | 0% | 0.0 / 0.0 / 0.0 | 0.0 | 0.00 | - |
| solo warden, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 0.2 (7% of fights) | 0.5 | 0% | 0.2 / 0.5 / 0.0 | 0.5 | 0.14 | - |
| solo warden, ground (L21, B gear), F7 to F8 in one delve · Mortal · normal · textbook | 0.6 (10% of fights) | 0.9 | 0% | 0.4 / 0.7 / 0.0 | 0.8 | 0.48 | 55 |
| classic four, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 0.3 (5% of fights) | 1.2 | 0% | 0.4 / 0.7 / 0.0 | 1.0 | 4.36 | 45 |
| crypt-breakers, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 0.2 (3% of fights) | 1.6 | 0% | 0.6 / 0.6 / 0.0 | 0.9 | 1.64 | 45 |
| glass cannons, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 0.1 (2% of fights) | 1.4 | 0% | 0.2 / 0.6 / 0.0 | 0.7 | 1.48 | 40 |
| the pair, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook | 0.4 (8% of fights) | 1.0 | 0% | 0.3 / 0.7 / 0.0 | 0.8 | 0.87 | 50 |
| crypt-breakers, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook | 0.2 (3% of fights) | 1.7 | 0% | 0.6 / 0.7 / 0.0 | 1.0 | 1.65 | 35 |
| the pair, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook | 0.5 (9% of fights) | 1.3 | 0% | 0.4 / 0.8 / 0.0 | 1.0 | 1.16 | 42 |

## 8. Per-class damage

**8a. In these delves** (the party AI's own play, every preset and death rule pooled; a hero's damage includes the DoTs it applied):

| Class | Fights | Actions / fight | Damage / action | Damage / fight round | Share of its party's damage | Healing / action | Damage taken / fight |
|---|---|---|---|---|---|---|---|
| blade | 40353 | 6.3 | 59.6 | 65.3 | 45% | 1.3 | 89.5 |
| warden | 63215 | 4.5 | 45.8 | 35.7 | 41% | 2.3 | 120.2 |
| arcanist | 24356 | 6.4 | 44.0 | 43.7 | 25% | 0.7 | 37.1 |
| mender | 67999 | 5.1 | 43.2 | 41.0 | 27% | 17.3 | 46.8 |
| ranger | 38033 | 6.6 | 35.3 | 44.0 | 28% | 0.5 | 28.0 |
| shade | 10316 | 7.2 | 23.5 | 26.0 | 20% | 1.3 | 57.2 |

**8b. The class-damage measure** (pass A's `tools/balance/class-damage.ts`: a solo hero, no pet, against each zone's standard encounters; the spread is judged against `runner.targets.classDamageSpreadMax`):

Single-target damage per round (a solo hero, monsters at the hero's level; the mean over the-cellars, the-crypts, the-drowned-vault):

| Class | Role | L1 | L5 | L8 | L13 |
|---|---|---|---|---|---|
| arcanist | damage | **63.1** (53.7 · 53.9 · 81.6) | **63.8** (75.1 · 76.2 · 40.2) | **78.7** (100.3 · 87.2 · 48.6) | **100.9** (120.3 · 120.6 · 61.9) |
| blade | damage | **61.2** (65.3 · 60.1 · 58.3) | **62.7** (72.0 · 60.4 · 55.9) | **90.0** (112.1 · 76.9 · 81.0) | **120.9** (141.2 · 109.7 · 111.9) |
| blade/greatsword | damage | **56.4** (62.6 · 51.5 · 55.1) | **66.7** (75.2 · 64.4 · 60.4) | **88.6** (102.9 · 80.1 · 82.7) | **146.7** (163.8 · 139.7 · 136.6) |
| mender | support | **63.5** (58.7 · 74.3 · 57.4) | **75.5** (67.0 · 89.8 · 69.6) | **88.2** (80.4 · 104.3 · 80.0) | **139.3** (123.0 · 173.7 · 121.1) |
| ranger | damage | **45.7** (55.0 · 35.1 · 47.0) | **51.3** (61.2 · 40.6 · 52.1) | **61.6** (70.3 · 51.7 · 62.9) | **110.2** (132.3 · 78.1 · 120.1) |
| shade | damage | **47.1** (52.5 · 38.0 · 50.7) | **61.3** (66.3 · 59.0 · 58.7) | **80.3** (83.1 · 67.5 · 90.3) | **96.2** (107.2 · 82.8 · 98.7) |
| warden | tank | **54.6** (57.1 · 55.6 · 51.1) | **67.9** (69.5 · 70.5 · 63.7) | **70.9** (72.6 · 69.7 · 70.4) | **121.6** (128.4 · 122.2 · 114.2) |
| warden/spear | tank | **34.6** (43.1 · 25.2 · 35.6) | **38.5** (47.2 · 30.7 · 37.6) | **43.0** (53.6 · 33.3 · 42.1) | **77.5** (98.5 · 58.6 · 75.5) |

- Level 1: the damage dealers run 45.7 (ranger) to 63.1 (arcanist) — **1.38×** ✓ within 1.5×
- Level 5: the damage dealers run 51.3 (ranger) to 66.7 (blade/greatsword) — **1.30×** ✓ within 1.5×
- Level 8: the damage dealers run 61.6 (ranger) to 90.0 (blade) — **1.46×** ✓ within 1.5×
- Level 13: the damage dealers run 96.2 (shade) to 146.7 (blade/greatsword) — **1.52×** ✗ over 1.5×

| Class | Level | Zone | Single-target / round | Damage / round | Damage / action | Damage / pool | Rounds | Rounds to kill | Won | Loadout |
|---|---|---|---|---|---|---|---|---|---|---|
| arcanist | 1 | the-cellars | 53.7 | 54.2 | 42.9 | 5.4 | 3.6 | 3.6 | 12/12 | spark, ember-lance, frostbolt, frost-floor |
| arcanist | 1 | the-crypts | 53.9 | 34.1 | 26.2 | 5.8 | 6.7 | 4.5 | 11/12 | spark, ember-lance, frostbolt, frost-floor |
| arcanist | 1 | the-drowned-vault | 81.6 | 67.0 | 56.6 | 7.1 | 4.3 | 4.3 | 12/12 | spark, ember-lance, frostbolt, frost-floor |
| arcanist | 5 | the-cellars | 75.1 | 55.4 | 106.1 | 7.1 | 7.5 | 7.5 | 12/12 | glacier-spike, arc-chain, spark, ember-lance |
| arcanist | 5 | the-crypts | 76.2 | 62.6 | 96.8 | 6.5 | 6.8 | 7.2 | 10/12 | glacier-spike, arc-chain, spark, ember-lance |
| arcanist | 5 | the-drowned-vault | 40.2 | 30.9 | 51.3 | 3.4 | 11.3 | 10.3 | 9/12 | glacier-spike, arc-chain, spark, ember-lance |
| arcanist | 8 | the-cellars | 100.3 | 64.9 | 139.9 | 9.3 | 8.0 | 8.0 | 12/12 | glacier-spike, arc-chain, spark, ember-lance |
| arcanist | 8 | the-crypts | 87.2 | 87.2 | 125.6 | 8.4 | 6.0 | 6.4 | 10/12 | glacier-spike, arc-chain, spark, ember-lance |
| arcanist | 8 | the-drowned-vault | 48.6 | 33.5 | 61.8 | 4.1 | 10.9 | 10.3 | 9/12 | glacier-spike, arc-chain, spark, ember-lance |
| arcanist | 13 | the-cellars | 120.3 | 122.4 | 180.1 | 12.9 | 6.3 | 6.3 | 12/12 | glacier-spike, arc-chain, meteor, spark |
| arcanist | 13 | the-crypts | 120.6 | 101.7 | 156.1 | 11.2 | 6.3 | 6.6 | 8/12 | glacier-spike, arc-chain, meteor, spark |
| arcanist | 13 | the-drowned-vault | 61.9 | 52.6 | 75.3 | 5.4 | 9.7 | 12.1 | 7/12 | glacier-spike, arc-chain, meteor, spark |
| blade | 1 | the-cellars | 65.3 | 54.3 | 56.1 | 6.2 | 4.3 | 4.3 | 12/12 | reckless-swing, open-vein, twin-cut |
| blade | 1 | the-crypts | 60.1 | 61.6 | 60.4 | 6.7 | 4.1 | 4.1 | 12/12 | reckless-swing, open-vein, twin-cut |
| blade | 1 | the-drowned-vault | 58.3 | 53.8 | 51.8 | 5.8 | 4.8 | 4.8 | 12/12 | reckless-swing, open-vein, twin-cut |
| blade | 5 | the-cellars | 72.0 | 75.6 | 62.5 | 4.5 | 4.2 | 4.2 | 12/12 | hemorrhage, reckless-swing, flurry, open-vein |
| blade | 5 | the-crypts | 60.4 | 63.3 | 55.6 | 4.0 | 5.2 | 5.2 | 12/12 | hemorrhage, reckless-swing, flurry, open-vein |
| blade | 5 | the-drowned-vault | 55.9 | 59.2 | 51.4 | 3.7 | 6.3 | 6.3 | 12/12 | hemorrhage, reckless-swing, flurry, open-vein |
| blade | 8 | the-cellars | 112.1 | 103.7 | 81.7 | 5.8 | 4.3 | 4.3 | 12/12 | hemorrhage, reckless-swing, flurry, open-vein |
| blade | 8 | the-crypts | 76.9 | 87.4 | 68.8 | 4.9 | 5.0 | 5.0 | 12/12 | hemorrhage, reckless-swing, flurry, open-vein |
| blade | 8 | the-drowned-vault | 81.0 | 80.5 | 63.4 | 4.8 | 6.6 | 6.6 | 12/12 | hemorrhage, reckless-swing, flurry, open-vein |
| blade | 13 | the-cellars | 141.2 | 142.2 | 100.2 | 7.7 | 4.4 | 4.4 | 12/12 | hemorrhage, reckless-swing, flurry, open-vein |
| blade | 13 | the-crypts | 109.7 | 99.5 | 83.3 | 6.4 | 6.3 | 6.3 | 12/12 | hemorrhage, reckless-swing, flurry, open-vein |
| blade | 13 | the-drowned-vault | 111.9 | 90.1 | 67.2 | 5.5 | 8.8 | 8.8 | 12/12 | hemorrhage, reckless-swing, flurry, open-vein |
| blade/greatsword | 1 | the-cellars | 62.6 | 51.2 | 76.4 | 6.4 | 4.3 | 4.3 | 12/12 | cleaving-blow, reckless-swing, open-vein |
| blade/greatsword | 1 | the-crypts | 51.5 | 56.2 | 74.8 | 6.6 | 4.2 | 4.2 | 12/12 | cleaving-blow, reckless-swing, open-vein |
| blade/greatsword | 1 | the-drowned-vault | 55.1 | 39.3 | 65.1 | 5.7 | 5.8 | 5.3 | 11/12 | cleaving-blow, reckless-swing, open-vein |
| blade/greatsword | 5 | the-cellars | 75.2 | 54.5 | 89.3 | 6.0 | 5.0 | 5.0 | 12/12 | execute, cleaving-blow, hemorrhage, reckless-swing |
| blade/greatsword | 5 | the-crypts | 64.4 | 61.7 | 77.1 | 5.1 | 4.5 | 4.5 | 12/12 | execute, cleaving-blow, hemorrhage, reckless-swing |
| blade/greatsword | 5 | the-drowned-vault | 60.4 | 50.7 | 80.0 | 5.3 | 5.4 | 5.3 | 10/12 | execute, cleaving-blow, hemorrhage, reckless-swing |
| blade/greatsword | 8 | the-cellars | 102.9 | 92.4 | 122.6 | 8.2 | 4.4 | 4.4 | 12/12 | execute, cleaving-blow, hemorrhage, reckless-swing |
| blade/greatsword | 8 | the-crypts | 80.1 | 88.6 | 101.7 | 6.8 | 4.4 | 4.4 | 12/12 | execute, cleaving-blow, hemorrhage, reckless-swing |
| blade/greatsword | 8 | the-drowned-vault | 82.7 | 65.2 | 80.8 | 5.7 | 6.0 | 6.0 | 12/12 | execute, cleaving-blow, hemorrhage, reckless-swing |
| blade/greatsword | 13 | the-cellars | 163.8 | 228.5 | 233.5 | 11.1 | 3.8 | 3.8 | 12/12 | skull-splitter, execute, cleaving-blow, breakers-arc |
| blade/greatsword | 13 | the-crypts | 139.7 | 167.4 | 190.3 | 9.1 | 4.7 | 4.2 | 11/12 | skull-splitter, execute, cleaving-blow, breakers-arc |
| blade/greatsword | 13 | the-drowned-vault | 136.6 | 160.1 | 179.9 | 9.8 | 5.1 | 5.1 | 12/12 | skull-splitter, execute, cleaving-blow, breakers-arc |
| mender | 1 | the-cellars | 58.7 | 63.3 | 62.7 | 6.3 | 3.3 | 3.3 | 12/12 | smite, radiance |
| mender | 1 | the-crypts | 74.3 | 66.4 | 81.5 | 8.7 | 4.2 | 4.2 | 12/12 | smite, radiance |
| mender | 1 | the-drowned-vault | 57.4 | 58.0 | 61.0 | 6.1 | 3.8 | 3.8 | 12/12 | smite, radiance |
| mender | 5 | the-cellars | 67.0 | 68.1 | 94.4 | 6.3 | 6.2 | 6.2 | 12/12 | holy-lance, smite, radiance |
| mender | 5 | the-crypts | 89.8 | 76.4 | 118.0 | 7.9 | 5.7 | 5.2 | 9/12 | holy-lance, smite, radiance |
| mender | 5 | the-drowned-vault | 69.6 | 51.8 | 90.8 | 6.1 | 7.9 | 8.3 | 10/12 | holy-lance, smite, radiance |
| mender | 8 | the-cellars | 80.4 | 81.4 | 111.7 | 7.4 | 6.2 | 6.2 | 12/12 | holy-lance, smite, radiance |
| mender | 8 | the-crypts | 104.3 | 91.5 | 138.4 | 9.2 | 7.5 | 7.5 | 11/12 | holy-lance, smite, radiance |
| mender | 8 | the-drowned-vault | 80.0 | 70.8 | 112.6 | 7.5 | 7.6 | 7.9 | 11/12 | holy-lance, smite, radiance |
| mender | 13 | the-cellars | 123.0 | 83.0 | 184.4 | 8.0 | 8.2 | 6.1 | 11/12 | judgement, holy-lance, smite, radiance |
| mender | 13 | the-crypts | 173.7 | 130.1 | 204.9 | 9.2 | 6.7 | 6.7 | 9/12 | judgement, holy-lance, smite, radiance |
| mender | 13 | the-drowned-vault | 121.1 | 106.0 | 161.7 | 7.0 | 6.7 | 6.6 | 9/12 | judgement, holy-lance, smite, radiance |
| ranger | 1 | the-cellars | 55.0 | 37.6 | 44.1 | 4.9 | 7.8 | 5.7 | 11/12 | aimed-shot, snare, caltrop-toss, hunters-mark |
| ranger | 1 | the-crypts | 35.1 | 27.0 | 26.8 | 3.0 | 7.5 | 6.0 | 9/12 | aimed-shot, snare, caltrop-toss, hunters-mark |
| ranger | 1 | the-drowned-vault | 47.0 | 35.9 | 30.2 | 3.3 | 8.3 | 8.3 | 12/12 | aimed-shot, snare, caltrop-toss, hunters-mark |
| ranger | 5 | the-cellars | 61.2 | 53.0 | 53.7 | 5.0 | 7.4 | 7.4 | 12/12 | piercing-shot, aimed-shot, hamstring, hunters-mark |
| ranger | 5 | the-crypts | 40.6 | 37.1 | 29.9 | 3.1 | 8.1 | 7.8 | 10/12 | piercing-shot, aimed-shot, hamstring, hunters-mark |
| ranger | 5 | the-drowned-vault | 52.1 | 43.4 | 41.2 | 3.8 | 8.1 | 7.6 | 9/12 | piercing-shot, aimed-shot, hamstring, hunters-mark |
| ranger | 8 | the-cellars | 70.3 | 44.9 | 53.3 | 4.9 | 8.4 | 6.4 | 11/12 | piercing-shot, aimed-shot, hamstring, hunters-mark |
| ranger | 8 | the-crypts | 51.7 | 41.4 | 31.7 | 3.6 | 10.6 | 10.5 | 11/12 | piercing-shot, aimed-shot, hamstring, hunters-mark |
| ranger | 8 | the-drowned-vault | 62.9 | 40.0 | 46.3 | 4.3 | 8.1 | 6.1 | 8/12 | piercing-shot, aimed-shot, hamstring, hunters-mark |
| ranger | 13 | the-cellars | 132.3 | 104.9 | 142.9 | 10.8 | 8.3 | 6.2 | 11/12 | deadeye, piercing-shot, aimed-shot, hunters-mark |
| ranger | 13 | the-crypts | 78.1 | 89.1 | 96.2 | 7.2 | 7.1 | 6.8 | 10/12 | deadeye, piercing-shot, aimed-shot, hunters-mark |
| ranger | 13 | the-drowned-vault | 120.1 | 81.0 | 109.2 | 8.0 | 8.8 | 7.9 | 9/12 | deadeye, piercing-shot, aimed-shot, hunters-mark |
| shade | 1 | the-cellars | 52.5 | 15.9 | 15.2 | 1.5 | 17.0 | 13.6 | 9/12 | backstab, toxic-jab, pickpocket, veil |
| shade | 1 | the-crypts | 38.0 | 21.4 | 15.1 | 1.5 | 11.5 | 11.5 | 12/12 | backstab, toxic-jab, pickpocket, veil |
| shade | 1 | the-drowned-vault | 50.7 | 29.3 | 20.5 | 2.0 | 10.3 | 10.2 | 10/12 | backstab, toxic-jab, pickpocket, veil |
| shade | 5 | the-cellars | 66.3 | 23.9 | 19.3 | 1.9 | 15.1 | 13.0 | 10/12 | backstab, throat-cut, trap-trick, veil |
| shade | 5 | the-crypts | 59.0 | 28.9 | 19.4 | 1.9 | 12.8 | 12.8 | 12/12 | backstab, throat-cut, trap-trick, veil |
| shade | 5 | the-drowned-vault | 58.7 | 35.2 | 28.2 | 2.7 | 13.0 | 12.7 | 9/12 | backstab, throat-cut, trap-trick, veil |
| shade | 8 | the-cellars | 83.1 | 24.4 | 19.6 | 2.1 | 17.2 | 12.1 | 8/12 | backstab, throat-cut, trap-trick, veil |
| shade | 8 | the-crypts | 67.5 | 36.2 | 23.0 | 2.4 | 10.3 | 9.4 | 9/12 | backstab, throat-cut, trap-trick, veil |
| shade | 8 | the-drowned-vault | 90.3 | 49.6 | 32.7 | 3.5 | 11.9 | 11.3 | 10/12 | backstab, throat-cut, trap-trick, veil |
| shade | 13 | the-cellars | 107.2 | 67.5 | 39.1 | 4.1 | 11.5 | 11.5 | 12/12 | backstab, vital-point, venom-burst, veil |
| shade | 13 | the-crypts | 82.8 | 41.3 | 24.7 | 2.6 | 11.8 | 11.6 | 9/12 | backstab, vital-point, venom-burst, veil |
| shade | 13 | the-drowned-vault | 98.7 | 52.7 | 34.8 | 3.7 | 13.7 | 13.2 | 9/12 | backstab, vital-point, venom-burst, veil |
| warden | 1 | the-cellars | 57.1 | 53.3 | 63.7 | 6.4 | 3.4 | 3.4 | 12/12 | shield-slam |
| warden | 1 | the-crypts | 55.6 | 55.4 | 65.2 | 6.5 | 3.9 | 3.9 | 12/12 | shield-slam |
| warden | 1 | the-drowned-vault | 51.1 | 35.2 | 52.5 | 5.4 | 4.9 | 4.9 | 12/12 | shield-slam |
| warden | 5 | the-cellars | 69.5 | 72.5 | 83.4 | 6.4 | 3.5 | 3.5 | 12/12 | shove, shield-slam |
| warden | 5 | the-crypts | 70.5 | 71.1 | 84.4 | 6.9 | 4.3 | 4.3 | 12/12 | shove, shield-slam |
| warden | 5 | the-drowned-vault | 63.7 | 44.6 | 70.3 | 5.5 | 5.9 | 5.0 | 11/12 | shove, shield-slam |
| warden | 8 | the-cellars | 72.6 | 68.4 | 91.1 | 7.0 | 4.2 | 4.2 | 12/12 | shove, shield-slam |
| warden | 8 | the-crypts | 69.7 | 62.7 | 88.4 | 6.8 | 4.8 | 4.5 | 11/12 | shove, shield-slam |
| warden | 8 | the-drowned-vault | 70.4 | 45.7 | 86.9 | 6.8 | 6.9 | 5.2 | 10/12 | shove, shield-slam |
| warden | 13 | the-cellars | 128.4 | 126.8 | 168.7 | 8.9 | 3.9 | 3.9 | 12/12 | crushing-rebuke, shove, shield-slam |
| warden | 13 | the-crypts | 122.2 | 114.2 | 154.7 | 8.6 | 4.5 | 4.5 | 12/12 | crushing-rebuke, shove, shield-slam |
| warden | 13 | the-drowned-vault | 114.2 | 85.1 | 139.8 | 8.6 | 5.7 | 4.8 | 11/12 | crushing-rebuke, shove, shield-slam |
| warden/spear | 1 | the-cellars | 43.1 | 28.1 | 46.9 | 4.7 | 5.7 | 5.7 | 12/12 | reaching-thrust |
| warden/spear | 1 | the-crypts | 25.2 | 24.8 | 33.2 | 3.3 | 5.0 | 4.2 | 10/12 | reaching-thrust |
| warden/spear | 1 | the-drowned-vault | 35.6 | 21.9 | 37.7 | 3.9 | 7.1 | 6.2 | 11/12 | reaching-thrust |
| warden/spear | 5 | the-cellars | 47.2 | 37.9 | 57.3 | 5.7 | 5.2 | 5.2 | 12/12 | reaching-thrust, sweeping-spear |
| warden/spear | 5 | the-crypts | 30.7 | 28.4 | 36.8 | 3.8 | 5.9 | 5.7 | 10/12 | reaching-thrust, sweeping-spear |
| warden/spear | 5 | the-drowned-vault | 37.6 | 21.6 | 37.9 | 3.9 | 8.0 | 6.0 | 9/12 | reaching-thrust, sweeping-spear |
| warden/spear | 8 | the-cellars | 53.6 | 39.5 | 67.9 | 7.5 | 5.8 | 5.5 | 11/12 | reaching-thrust, sweeping-spear |
| warden/spear | 8 | the-crypts | 33.3 | 29.8 | 41.0 | 4.7 | 6.7 | 6.6 | 10/12 | reaching-thrust, sweeping-spear |
| warden/spear | 8 | the-drowned-vault | 42.1 | 26.0 | 50.2 | 5.7 | 8.1 | 6.4 | 9/12 | reaching-thrust, sweeping-spear |
| warden/spear | 13 | the-cellars | 98.5 | 97.8 | 144.5 | 8.0 | 4.3 | 4.3 | 12/12 | pinning-strike, reaching-thrust, sweeping-spear |
| warden/spear | 13 | the-crypts | 58.6 | 69.4 | 90.3 | 5.0 | 5.3 | 5.3 | 11/12 | pinning-strike, reaching-thrust, sweeping-spear |
| warden/spear | 13 | the-drowned-vault | 75.5 | 56.6 | 92.9 | 5.6 | 6.7 | 6.0 | 10/12 | pinning-strike, reaching-thrust, sweeping-spear |

## 9. Danger you can read (D-092)

*Every floor arrival pooled by the band its chip showed the party on arrival (Normal). "Too far" should be deadly: deaths per arrival should climb from Even to Dangerous to Deadly.*

| Scripted player | Band on arrival | Arrivals | Deaths / arrival | Wipes / 100 arrivals | Went down | Turned back here |
|---|---|---|---|---|---|---|
| textbook | easy | 6983 | 0.25 | 15.5 | 82% | 2% |
| textbook | even | 12387 | 0.81 | 32.3 | 61% | 6% |
| textbook | dangerous | 145 | 1.17 | 36.6 | 53% | 10% |
| textbook | deadly | 203 | 1.57 | 31.5 | 45% | 24% |
| careful | easy | 2182 | 0.23 | 14.3 | 84% | 2% |
| careful | even | 3704 | 0.70 | 29.5 | 59% | 11% |
| careful | dangerous | 16 | 0.19 | 6.3 | 44% | 50% |
| careful | deadly | 200 | 0.00 | 0.0 | 0% | 100% |

| Scripted player | Delves | Deaths / delve | Cleared | Retreated | Wiped | Deepest floor done |
|---|---|---|---|---|---|---|
| textbook | 10600 | 1.16 | 40% | 9% | 49% | 3.5 |
| careful | 3400 | 0.91 | 39% | 20% | 41% | 3.3 |

## 10. Stub hooks that fired

- none

## 11. Judgement lines

- **OK** solo warden, fresh · Sheltered · normal · textbook: The Cellars cleared, % of delves: 3.0% (target 0–10%)
- **OK** solo warden, fresh · Mortal · normal · textbook: The Cellars cleared, % of delves: 3.0% (target 0–10%)
- **OK** solo warden, fresh · Nightmare · normal · textbook: The Cellars cleared, % of delves: 3.0% (target 0–10%)
- **OK** solo warden, ground (L12, D gear) · Sheltered · normal · textbook: The Cellars cleared, % of delves: 63.0% (target 40–85%)
- **OK** solo warden, ground (L12, D gear) · Mortal · normal · textbook: The Cellars cleared, % of delves: 63.0% (target 40–85%)
- **OK** solo warden, ground (L12, D gear) · Nightmare · normal · textbook: The Cellars cleared, % of delves: 63.0% (target 40–85%)
- **OK** classic four, fresh: warden, blade, mender, arcanist · Sheltered · normal · textbook: The Cellars cleared, % of delves: 63.0% (target 40–75%)
- **OK** classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · textbook: The Cellars cleared, % of delves: 47.0% (target 40–75%)
- **OK** classic four, fresh: warden, blade, mender, arcanist · Nightmare · normal · textbook: The Cellars cleared, % of delves: 46.0% (target 40–75%)
- **OK** crypt-breakers, fresh: mender, warden, ranger · Sheltered · normal · textbook: The Cellars cleared, % of delves: 35.0% (target 15–55%)
- **OK** crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · textbook: The Cellars cleared, % of delves: 33.0% (target 15–55%)
- **OK** crypt-breakers, fresh: mender, warden, ranger · Nightmare · normal · textbook: The Cellars cleared, % of delves: 33.0% (target 15–55%)
- **OK** glass cannons, fresh: arcanist, shade, ranger · Sheltered · normal · textbook: The Cellars cleared, % of delves: 15.0% (target 0–40%)
- **OK** glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · textbook: The Cellars cleared, % of delves: 12.0% (target 0–40%)
- **OK** glass cannons, fresh: arcanist, shade, ranger · Nightmare · normal · textbook: The Cellars cleared, % of delves: 12.0% (target 0–40%)
- **OK** the pair, fresh: blade, mender · Sheltered · normal · textbook: The Cellars cleared, % of delves: 28.0% (target 5–40%)
- **OK** the pair, fresh: blade, mender · Mortal · normal · textbook: The Cellars cleared, % of delves: 27.0% (target 5–40%)
- **OK** the pair, fresh: blade, mender · Nightmare · normal · textbook: The Cellars cleared, % of delves: 27.0% (target 5–40%)
- **OK** crypt-breakers, levelled (L5, E gear) · Sheltered · normal · textbook: The Cellars cleared, % of delves: 87.0% (target 55–100%)
- **OK** crypt-breakers, levelled (L5, E gear) · Mortal · normal · textbook: The Cellars cleared, % of delves: 85.0% (target 55–100%)
- **OK** crypt-breakers, levelled (L5, E gear) · Nightmare · normal · textbook: The Cellars cleared, % of delves: 85.0% (target 55–100%)
- **OK** the pair, levelled (L5, E gear) · Sheltered · normal · textbook: The Cellars cleared, % of delves: 75.0% (target 55–100%)
- **OK** the pair, levelled (L5, E gear) · Mortal · normal · textbook: The Cellars cleared, % of delves: 70.0% (target 55–100%)
- **OK** the pair, levelled (L5, E gear) · Nightmare · normal · textbook: The Cellars cleared, % of delves: 70.0% (target 55–100%)
- **OK** solo warden, arriving (L5, E gear) · Sheltered · normal · textbook: The Crypts cleared, % of delves: 8.0% (target 0–10%)
- **OK** solo warden, arriving (L5, E gear) · Mortal · normal · textbook: The Crypts cleared, % of delves: 8.0% (target 0–10%)
- **OK** solo warden, arriving (L5, E gear) · Nightmare · normal · textbook: The Crypts cleared, % of delves: 8.0% (target 0–10%)
- **OK** solo warden, ground (L16, C gear) · Sheltered · normal · textbook: The Crypts cleared, % of delves: 53.0% (target 40–85%)
- **OK** solo warden, ground (L16, C gear) · Mortal · normal · textbook: The Crypts cleared, % of delves: 53.0% (target 40–85%)
- **OK** solo warden, ground (L16, C gear) · Nightmare · normal · textbook: The Crypts cleared, % of delves: 53.0% (target 40–85%)
- **OK** classic four, arriving (L5, E gear) · Sheltered · normal · textbook: The Crypts cleared, % of delves: 67.0% (target 40–75%)
- **OK** classic four, arriving (L5, E gear) · Mortal · normal · textbook: The Crypts cleared, % of delves: 58.0% (target 40–75%)
- **OK** classic four, arriving (L5, E gear) · Nightmare · normal · textbook: The Crypts cleared, % of delves: 50.0% (target 40–75%)
- **OK** crypt-breakers, arriving (L5, E gear) · Sheltered · normal · textbook: The Crypts cleared, % of delves: 48.0% (target 15–55%)
- **OK** crypt-breakers, arriving (L5, E gear) · Mortal · normal · textbook: The Crypts cleared, % of delves: 45.0% (target 15–55%)
- **OK** crypt-breakers, arriving (L5, E gear) · Nightmare · normal · textbook: The Crypts cleared, % of delves: 45.0% (target 15–55%)
- **OK** glass cannons, arriving (L5, E gear) · Sheltered · normal · textbook: The Crypts cleared, % of delves: 0.0% (target 0–40%)
- **OK** glass cannons, arriving (L5, E gear) · Mortal · normal · textbook: The Crypts cleared, % of delves: 0.0% (target 0–40%)
- **OK** glass cannons, arriving (L5, E gear) · Nightmare · normal · textbook: The Crypts cleared, % of delves: 0.0% (target 0–40%)
- **OK** the pair, arriving (L5, E gear) · Sheltered · normal · textbook: The Crypts cleared, % of delves: 24.0% (target 5–40%)
- **OK** the pair, arriving (L5, E gear) · Mortal · normal · textbook: The Crypts cleared, % of delves: 19.0% (target 5–40%)
- **OK** the pair, arriving (L5, E gear) · Nightmare · normal · textbook: The Crypts cleared, % of delves: 19.0% (target 5–40%)
- **OK** crypt-breakers, ready (L9, D gear) · Sheltered · normal · textbook: The Crypts cleared, % of delves: 74.0% (target 55–100%)
- **OK** crypt-breakers, ready (L9, D gear) · Mortal · normal · textbook: The Crypts cleared, % of delves: 72.0% (target 55–100%)
- **OK** crypt-breakers, ready (L9, D gear) · Nightmare · normal · textbook: The Crypts cleared, % of delves: 72.0% (target 55–100%)
- **LOW** the pair, ready (L9, D gear) · Sheltered · normal · textbook: The Crypts cleared, % of delves: 47.0% (target 55–100%)
- **LOW** the pair, ready (L9, D gear) · Mortal · normal · textbook: The Crypts cleared, % of delves: 46.0% (target 55–100%)
- **LOW** the pair, ready (L9, D gear) · Nightmare · normal · textbook: The Crypts cleared, % of delves: 43.0% (target 55–100%)
- **OK** solo warden, arriving (L11, D gear) · Sheltered · normal · textbook: The Drowned Vault F7 cleared, % of delves: 0.0% (target 0–10%)
- **OK** solo warden, arriving (L11, D gear) · Mortal · normal · textbook: The Drowned Vault F7 cleared, % of delves: 0.0% (target 0–10%)
- **OK** solo warden, arriving (L11, D gear) · Nightmare · normal · textbook: The Drowned Vault F7 cleared, % of delves: 0.0% (target 0–10%)
- **OK** solo warden, ground (L21, B gear) · Sheltered · normal · textbook: The Drowned Vault F7 cleared, % of delves: 50.0% (target 40–85%)
- **OK** solo warden, ground (L21, B gear) · Mortal · normal · textbook: The Drowned Vault F7 cleared, % of delves: 50.0% (target 40–85%)
- **OK** solo warden, ground (L21, B gear) · Nightmare · normal · textbook: The Drowned Vault F7 cleared, % of delves: 50.0% (target 40–85%)
- **OK** classic four, arriving (L11, D gear) · Sheltered · normal · textbook: The Drowned Vault F7 cleared, % of delves: 74.0% (target 40–75%)
- **OK** classic four, arriving (L11, D gear) · Mortal · normal · textbook: The Drowned Vault F7 cleared, % of delves: 64.0% (target 40–75%)
- **OK** classic four, arriving (L11, D gear) · Nightmare · normal · textbook: The Drowned Vault F7 cleared, % of delves: 63.0% (target 40–75%)
- **OK** crypt-breakers, arriving (L11, D gear) · Sheltered · normal · textbook: The Drowned Vault F7 cleared, % of delves: 39.0% (target 15–55%)
- **OK** crypt-breakers, arriving (L11, D gear) · Mortal · normal · textbook: The Drowned Vault F7 cleared, % of delves: 39.0% (target 15–55%)
- **OK** crypt-breakers, arriving (L11, D gear) · Nightmare · normal · textbook: The Drowned Vault F7 cleared, % of delves: 33.0% (target 15–55%)
- **OK** glass cannons, arriving (L11, D gear) · Sheltered · normal · textbook: The Drowned Vault F7 cleared, % of delves: 15.0% (target 0–40%)
- **OK** glass cannons, arriving (L11, D gear) · Mortal · normal · textbook: The Drowned Vault F7 cleared, % of delves: 14.0% (target 0–40%)
- **OK** glass cannons, arriving (L11, D gear) · Nightmare · normal · textbook: The Drowned Vault F7 cleared, % of delves: 14.0% (target 0–40%)
- **OK** the pair, arriving (L11, D gear) · Sheltered · normal · textbook: The Drowned Vault F7 cleared, % of delves: 33.0% (target 5–40%)
- **OK** the pair, arriving (L11, D gear) · Mortal · normal · textbook: The Drowned Vault F7 cleared, % of delves: 30.0% (target 5–40%)
- **OK** the pair, arriving (L11, D gear) · Nightmare · normal · textbook: The Drowned Vault F7 cleared, % of delves: 30.0% (target 5–40%)
- **OK** crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook: The Drowned Vault F7 cleared, % of delves: 95.0% (target 55–100%)
- **OK** crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook: The Drowned Vault F7 cleared, % of delves: 93.0% (target 55–100%)
- **OK** crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook: The Drowned Vault F7 cleared, % of delves: 86.0% (target 55–100%)
- **OK** the pair, ready (L14, C gear) · Sheltered · normal · textbook: The Drowned Vault F7 cleared, % of delves: 77.0% (target 55–100%)
- **OK** the pair, ready (L14, C gear) · Mortal · normal · textbook: The Drowned Vault F7 cleared, % of delves: 74.0% (target 55–100%)
- **OK** the pair, ready (L14, C gear) · Nightmare · normal · textbook: The Drowned Vault F7 cleared, % of delves: 73.0% (target 55–100%)
- **OK** solo warden, arriving (L13, D gear) · Sheltered · normal · textbook: The Drowned Vault F8 cleared, % of delves: 6.0% (target 0–10%)
- **OK** solo warden, arriving (L13, D gear) · Mortal · normal · textbook: The Drowned Vault F8 cleared, % of delves: 6.0% (target 0–10%)
- **OK** solo warden, arriving (L13, D gear) · Nightmare · normal · textbook: The Drowned Vault F8 cleared, % of delves: 6.0% (target 0–10%)
- **OK** solo warden, ground (L21, B gear) · Sheltered · normal · textbook: The Drowned Vault F8 cleared, % of delves: 54.0% (target 40–85%)
- **OK** solo warden, ground (L21, B gear) · Mortal · normal · textbook: The Drowned Vault F8 cleared, % of delves: 54.0% (target 40–85%)
- **OK** solo warden, ground (L21, B gear) · Nightmare · normal · textbook: The Drowned Vault F8 cleared, % of delves: 54.0% (target 40–85%)
- **OK** classic four, arriving (L13, D gear) · Sheltered · normal · textbook: The Drowned Vault F8 cleared, % of delves: 44.0% (target 40–75%)
- **OK** classic four, arriving (L13, D gear) · Mortal · normal · textbook: The Drowned Vault F8 cleared, % of delves: 44.0% (target 40–75%)
- **OK** classic four, arriving (L13, D gear) · Nightmare · normal · textbook: The Drowned Vault F8 cleared, % of delves: 42.0% (target 40–75%)
- **OK** crypt-breakers, arriving (L13, D gear) · Sheltered · normal · textbook: The Drowned Vault F8 cleared, % of delves: 47.0% (target 15–55%)
- **OK** crypt-breakers, arriving (L13, D gear) · Mortal · normal · textbook: The Drowned Vault F8 cleared, % of delves: 47.0% (target 15–55%)
- **OK** crypt-breakers, arriving (L13, D gear) · Nightmare · normal · textbook: The Drowned Vault F8 cleared, % of delves: 47.0% (target 15–55%)
- **HIGH** glass cannons, arriving (L13, D gear) · Sheltered · normal · textbook: The Drowned Vault F8 cleared, % of delves: 42.0% (target 0–40%)
- **HIGH** glass cannons, arriving (L13, D gear) · Mortal · normal · textbook: The Drowned Vault F8 cleared, % of delves: 42.0% (target 0–40%)
- **HIGH** glass cannons, arriving (L13, D gear) · Nightmare · normal · textbook: The Drowned Vault F8 cleared, % of delves: 42.0% (target 0–40%)
- **OK** the pair, arriving (L13, D gear) · Sheltered · normal · textbook: The Drowned Vault F8 cleared, % of delves: 37.0% (target 5–40%)
- **OK** the pair, arriving (L13, D gear) · Mortal · normal · textbook: The Drowned Vault F8 cleared, % of delves: 37.0% (target 5–40%)
- **OK** the pair, arriving (L13, D gear) · Nightmare · normal · textbook: The Drowned Vault F8 cleared, % of delves: 37.0% (target 5–40%)
- **OK** crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook: The Drowned Vault F8 cleared, % of delves: 61.0% (target 55–100%)
- **OK** crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook: The Drowned Vault F8 cleared, % of delves: 61.0% (target 55–100%)
- **OK** crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook: The Drowned Vault F8 cleared, % of delves: 60.0% (target 55–100%)
- **OK** the pair, ready (L15, C gear) · Sheltered · normal · textbook: The Drowned Vault F8 cleared, % of delves: 72.0% (target 55–100%)
- **OK** the pair, ready (L15, C gear) · Mortal · normal · textbook: The Drowned Vault F8 cleared, % of delves: 71.0% (target 55–100%)
- **OK** the pair, ready (L15, C gear) · Nightmare · normal · textbook: The Drowned Vault F8 cleared, % of delves: 71.0% (target 55–100%)
- **OK** delves that ended stuck or at the command cap: none of 16560 (target 0)
- **OK** F1 gold found per completed floor vs 07 §2.3's 80: 76.5 gold (target 48–112 gold)
- **OK** F2 gold found per completed floor vs 07 §2.3's 100: 112.4 gold (target 60–140 gold)
- **HIGH** F3 gold found per completed floor vs 07 §2.3's 120: 239.5 gold (target 72–168 gold)
- **OK** F4 gold found per completed floor vs 07 §2.3's 140: 151.9 gold (target 84–196 gold)
- **OK** F5 gold found per completed floor vs 07 §2.3's 160: 154.5 gold (target 96–224 gold)
- **OK** F6 gold found per completed floor vs 07 §2.3's 180: 215.6 gold (target 108–252 gold)
- **OK** F7 gold found per completed floor vs 07 §2.3's 370: 408.1 gold (target 222–518 gold)
- **OK** F8 gold found per completed floor vs 07 §2.3's 400: 375.3 gold (target 240–560 gold)
- **OK** solo warden, fresh · Sheltered · normal · textbook: fight rounds: 4.2 (target 3–6)
- **OK** solo warden, fresh · Sheltered · normal · textbook: elite rounds: 7.4 (target 6–8)
- **HIGH** solo warden, fresh · Sheltered · normal · textbook: boss rounds: 19.5 (target 10–15)
- **HIGH** solo warden, fresh · Sheltered · normal · textbook: hunter rounds: 11.3 (target 6–8)
- **OK** solo warden, fresh · Mortal · normal · textbook: fight rounds: 4.2 (target 3–6)
- **OK** solo warden, fresh · Mortal · normal · textbook: elite rounds: 7.4 (target 6–8)
- **HIGH** solo warden, fresh · Mortal · normal · textbook: boss rounds: 19.5 (target 10–15)
- **HIGH** solo warden, fresh · Mortal · normal · textbook: hunter rounds: 11.3 (target 6–8)
- **OK** solo warden, fresh · Nightmare · normal · textbook: fight rounds: 4.2 (target 3–6)
- **OK** solo warden, fresh · Nightmare · normal · textbook: elite rounds: 7.4 (target 6–8)
- **HIGH** solo warden, fresh · Nightmare · normal · textbook: boss rounds: 19.5 (target 10–15)
- **HIGH** solo warden, fresh · Nightmare · normal · textbook: hunter rounds: 11.3 (target 6–8)
- **LOW** solo warden, ground (L12, D gear) · Sheltered · normal · textbook: fight rounds: 2.8 (target 3–6)
- **LOW** solo warden, ground (L12, D gear) · Sheltered · normal · textbook: elite rounds: 5.0 (target 6–8)
- **HIGH** solo warden, ground (L12, D gear) · Sheltered · normal · textbook: boss rounds: 21.4 (target 10–15)
- **LOW** solo warden, ground (L12, D gear) · Mortal · normal · textbook: fight rounds: 2.8 (target 3–6)
- **LOW** solo warden, ground (L12, D gear) · Mortal · normal · textbook: elite rounds: 5.0 (target 6–8)
- **HIGH** solo warden, ground (L12, D gear) · Mortal · normal · textbook: boss rounds: 21.4 (target 10–15)
- **LOW** solo warden, ground (L12, D gear) · Nightmare · normal · textbook: fight rounds: 2.8 (target 3–6)
- **LOW** solo warden, ground (L12, D gear) · Nightmare · normal · textbook: elite rounds: 5.0 (target 6–8)
- **HIGH** solo warden, ground (L12, D gear) · Nightmare · normal · textbook: boss rounds: 21.4 (target 10–15)
- **OK** classic four, fresh: warden, blade, mender, arcanist · Sheltered · normal · textbook: fight rounds: 3.6 (target 3–6)
- **LOW** classic four, fresh: warden, blade, mender, arcanist · Sheltered · normal · textbook: elite rounds: 5.3 (target 6–8)
- **HIGH** classic four, fresh: warden, blade, mender, arcanist · Sheltered · normal · textbook: boss rounds: 23.3 (target 10–15)
- **OK** classic four, fresh: warden, blade, mender, arcanist · Sheltered · normal · textbook: hunter rounds: 6.3 (target 6–8)
- **OK** classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · textbook: fight rounds: 3.6 (target 3–6)
- **LOW** classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · textbook: elite rounds: 5.3 (target 6–8)
- **HIGH** classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · textbook: boss rounds: 20.3 (target 10–15)
- **OK** classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · textbook: hunter rounds: 6.3 (target 6–8)
- **OK** classic four, fresh: warden, blade, mender, arcanist · Nightmare · normal · textbook: fight rounds: 3.6 (target 3–6)
- **LOW** classic four, fresh: warden, blade, mender, arcanist · Nightmare · normal · textbook: elite rounds: 5.3 (target 6–8)
- **HIGH** classic four, fresh: warden, blade, mender, arcanist · Nightmare · normal · textbook: boss rounds: 22.8 (target 10–15)
- **OK** classic four, fresh: warden, blade, mender, arcanist · Nightmare · normal · textbook: hunter rounds: 6.3 (target 6–8)
- **OK** crypt-breakers, fresh: mender, warden, ranger · Sheltered · normal · textbook: fight rounds: 3.1 (target 3–6)
- **LOW** crypt-breakers, fresh: mender, warden, ranger · Sheltered · normal · textbook: elite rounds: 4.4 (target 6–8)
- **HIGH** crypt-breakers, fresh: mender, warden, ranger · Sheltered · normal · textbook: boss rounds: 17.6 (target 10–15)
- **HIGH** crypt-breakers, fresh: mender, warden, ranger · Sheltered · normal · textbook: hunter rounds: 13.0 (target 6–8)
- **OK** crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · textbook: fight rounds: 3.1 (target 3–6)
- **LOW** crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · textbook: elite rounds: 4.4 (target 6–8)
- **HIGH** crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · textbook: boss rounds: 17.6 (target 10–15)
- **HIGH** crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · textbook: hunter rounds: 13.0 (target 6–8)
- **OK** crypt-breakers, fresh: mender, warden, ranger · Nightmare · normal · textbook: fight rounds: 3.1 (target 3–6)
- **LOW** crypt-breakers, fresh: mender, warden, ranger · Nightmare · normal · textbook: elite rounds: 4.4 (target 6–8)
- **HIGH** crypt-breakers, fresh: mender, warden, ranger · Nightmare · normal · textbook: boss rounds: 17.9 (target 10–15)
- **HIGH** crypt-breakers, fresh: mender, warden, ranger · Nightmare · normal · textbook: hunter rounds: 13.0 (target 6–8)
- **OK** glass cannons, fresh: arcanist, shade, ranger · Sheltered · normal · textbook: fight rounds: 3.8 (target 3–6)
- **LOW** glass cannons, fresh: arcanist, shade, ranger · Sheltered · normal · textbook: elite rounds: 4.8 (target 6–8)
- **HIGH** glass cannons, fresh: arcanist, shade, ranger · Sheltered · normal · textbook: boss rounds: 19.2 (target 10–15)
- **HIGH** glass cannons, fresh: arcanist, shade, ranger · Sheltered · normal · textbook: hunter rounds: 14.0 (target 6–8)
- **OK** glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · textbook: fight rounds: 3.7 (target 3–6)
- **LOW** glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · textbook: elite rounds: 4.7 (target 6–8)
- **HIGH** glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · textbook: boss rounds: 18.1 (target 10–15)
- **HIGH** glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · textbook: hunter rounds: 14.0 (target 6–8)
- **OK** glass cannons, fresh: arcanist, shade, ranger · Nightmare · normal · textbook: fight rounds: 3.7 (target 3–6)
- **LOW** glass cannons, fresh: arcanist, shade, ranger · Nightmare · normal · textbook: elite rounds: 4.7 (target 6–8)
- **HIGH** glass cannons, fresh: arcanist, shade, ranger · Nightmare · normal · textbook: boss rounds: 19.8 (target 10–15)
- **HIGH** glass cannons, fresh: arcanist, shade, ranger · Nightmare · normal · textbook: hunter rounds: 14.0 (target 6–8)
- **LOW** the pair, fresh: blade, mender · Sheltered · normal · textbook: fight rounds: 2.9 (target 3–6)
- **LOW** the pair, fresh: blade, mender · Sheltered · normal · textbook: elite rounds: 4.3 (target 6–8)
- **HIGH** the pair, fresh: blade, mender · Sheltered · normal · textbook: boss rounds: 21.2 (target 10–15)
- **LOW** the pair, fresh: blade, mender · Mortal · normal · textbook: fight rounds: 2.9 (target 3–6)
- **LOW** the pair, fresh: blade, mender · Mortal · normal · textbook: elite rounds: 4.3 (target 6–8)
- **HIGH** the pair, fresh: blade, mender · Mortal · normal · textbook: boss rounds: 20.1 (target 10–15)
- **LOW** the pair, fresh: blade, mender · Nightmare · normal · textbook: fight rounds: 2.9 (target 3–6)
- **LOW** the pair, fresh: blade, mender · Nightmare · normal · textbook: elite rounds: 4.3 (target 6–8)
- **HIGH** the pair, fresh: blade, mender · Nightmare · normal · textbook: boss rounds: 19.8 (target 10–15)
- **LOW** crypt-breakers, levelled (L5, E gear) · Sheltered · normal · textbook: fight rounds: 2.5 (target 3–6)
- **LOW** crypt-breakers, levelled (L5, E gear) · Sheltered · normal · textbook: elite rounds: 3.3 (target 6–8)
- **OK** crypt-breakers, levelled (L5, E gear) · Sheltered · normal · textbook: boss rounds: 11.9 (target 10–15)
- **LOW** crypt-breakers, levelled (L5, E gear) · Mortal · normal · textbook: fight rounds: 2.5 (target 3–6)
- **LOW** crypt-breakers, levelled (L5, E gear) · Mortal · normal · textbook: elite rounds: 3.3 (target 6–8)
- **OK** crypt-breakers, levelled (L5, E gear) · Mortal · normal · textbook: boss rounds: 11.9 (target 10–15)
- **LOW** crypt-breakers, levelled (L5, E gear) · Nightmare · normal · textbook: fight rounds: 2.5 (target 3–6)
- **LOW** crypt-breakers, levelled (L5, E gear) · Nightmare · normal · textbook: elite rounds: 3.3 (target 6–8)
- **OK** crypt-breakers, levelled (L5, E gear) · Nightmare · normal · textbook: boss rounds: 11.9 (target 10–15)
- **LOW** the pair, levelled (L5, E gear) · Sheltered · normal · textbook: fight rounds: 2.6 (target 3–6)
- **LOW** the pair, levelled (L5, E gear) · Sheltered · normal · textbook: elite rounds: 3.6 (target 6–8)
- **HIGH** the pair, levelled (L5, E gear) · Sheltered · normal · textbook: boss rounds: 15.7 (target 10–15)
- **LOW** the pair, levelled (L5, E gear) · Mortal · normal · textbook: fight rounds: 2.6 (target 3–6)
- **LOW** the pair, levelled (L5, E gear) · Mortal · normal · textbook: elite rounds: 3.6 (target 6–8)
- **HIGH** the pair, levelled (L5, E gear) · Mortal · normal · textbook: boss rounds: 15.9 (target 10–15)
- **LOW** the pair, levelled (L5, E gear) · Nightmare · normal · textbook: fight rounds: 2.6 (target 3–6)
- **LOW** the pair, levelled (L5, E gear) · Nightmare · normal · textbook: elite rounds: 3.6 (target 6–8)
- **HIGH** the pair, levelled (L5, E gear) · Nightmare · normal · textbook: boss rounds: 15.5 (target 10–15)
- **OK** solo warden, arriving (L5, E gear) · Sheltered · normal · textbook: fight rounds: 5.2 (target 3–6)
- **HIGH** solo warden, arriving (L5, E gear) · Sheltered · normal · textbook: elite rounds: 8.5 (target 6–8)
- **LOW** solo warden, arriving (L5, E gear) · Sheltered · normal · textbook: boss rounds: 7.5 (target 10–15)
- **HIGH** solo warden, arriving (L5, E gear) · Sheltered · normal · textbook: hunter rounds: 12.9 (target 6–8)
- **OK** solo warden, arriving (L5, E gear) · Mortal · normal · textbook: fight rounds: 5.2 (target 3–6)
- **HIGH** solo warden, arriving (L5, E gear) · Mortal · normal · textbook: elite rounds: 8.5 (target 6–8)
- **LOW** solo warden, arriving (L5, E gear) · Mortal · normal · textbook: boss rounds: 7.5 (target 10–15)
- **HIGH** solo warden, arriving (L5, E gear) · Mortal · normal · textbook: hunter rounds: 12.9 (target 6–8)
- **OK** solo warden, arriving (L5, E gear) · Nightmare · normal · textbook: fight rounds: 5.2 (target 3–6)
- **HIGH** solo warden, arriving (L5, E gear) · Nightmare · normal · textbook: elite rounds: 8.5 (target 6–8)
- **LOW** solo warden, arriving (L5, E gear) · Nightmare · normal · textbook: boss rounds: 7.5 (target 10–15)
- **HIGH** solo warden, arriving (L5, E gear) · Nightmare · normal · textbook: hunter rounds: 12.9 (target 6–8)
- **OK** solo warden, ground (L16, C gear) · Sheltered · normal · textbook: fight rounds: 4.2 (target 3–6)
- **HIGH** solo warden, ground (L16, C gear) · Sheltered · normal · textbook: elite rounds: 9.1 (target 6–8)
- **LOW** solo warden, ground (L16, C gear) · Sheltered · normal · textbook: boss rounds: 6.3 (target 10–15)
- **HIGH** solo warden, ground (L16, C gear) · Sheltered · normal · textbook: hunter rounds: 15.3 (target 6–8)
- **OK** solo warden, ground (L16, C gear) · Mortal · normal · textbook: fight rounds: 4.2 (target 3–6)
- **HIGH** solo warden, ground (L16, C gear) · Mortal · normal · textbook: elite rounds: 9.1 (target 6–8)
- **LOW** solo warden, ground (L16, C gear) · Mortal · normal · textbook: boss rounds: 6.3 (target 10–15)
- **HIGH** solo warden, ground (L16, C gear) · Mortal · normal · textbook: hunter rounds: 15.3 (target 6–8)
- **OK** solo warden, ground (L16, C gear) · Nightmare · normal · textbook: fight rounds: 4.2 (target 3–6)
- **HIGH** solo warden, ground (L16, C gear) · Nightmare · normal · textbook: elite rounds: 9.1 (target 6–8)
- **LOW** solo warden, ground (L16, C gear) · Nightmare · normal · textbook: boss rounds: 6.3 (target 10–15)
- **HIGH** solo warden, ground (L16, C gear) · Nightmare · normal · textbook: hunter rounds: 15.3 (target 6–8)
- **OK** classic four, arriving (L5, E gear) · Sheltered · normal · textbook: fight rounds: 5.2 (target 3–6)
- **OK** classic four, arriving (L5, E gear) · Sheltered · normal · textbook: elite rounds: 7.2 (target 6–8)
- **LOW** classic four, arriving (L5, E gear) · Sheltered · normal · textbook: boss rounds: 9.4 (target 10–15)
- **HIGH** classic four, arriving (L5, E gear) · Sheltered · normal · textbook: hunter rounds: 8.9 (target 6–8)
- **OK** classic four, arriving (L5, E gear) · Mortal · normal · textbook: fight rounds: 5.1 (target 3–6)
- **OK** classic four, arriving (L5, E gear) · Mortal · normal · textbook: elite rounds: 7.0 (target 6–8)
- **LOW** classic four, arriving (L5, E gear) · Mortal · normal · textbook: boss rounds: 9.3 (target 10–15)
- **HIGH** classic four, arriving (L5, E gear) · Mortal · normal · textbook: hunter rounds: 9.3 (target 6–8)
- **OK** classic four, arriving (L5, E gear) · Nightmare · normal · textbook: fight rounds: 5.1 (target 3–6)
- **OK** classic four, arriving (L5, E gear) · Nightmare · normal · textbook: elite rounds: 6.9 (target 6–8)
- **LOW** classic four, arriving (L5, E gear) · Nightmare · normal · textbook: boss rounds: 9.4 (target 10–15)
- **HIGH** classic four, arriving (L5, E gear) · Nightmare · normal · textbook: hunter rounds: 9.3 (target 6–8)
- **OK** crypt-breakers, arriving (L5, E gear) · Sheltered · normal · textbook: fight rounds: 4.4 (target 3–6)
- **OK** crypt-breakers, arriving (L5, E gear) · Sheltered · normal · textbook: elite rounds: 6.4 (target 6–8)
- **LOW** crypt-breakers, arriving (L5, E gear) · Sheltered · normal · textbook: boss rounds: 8.7 (target 10–15)
- **OK** crypt-breakers, arriving (L5, E gear) · Sheltered · normal · textbook: hunter rounds: 7.7 (target 6–8)
- **OK** crypt-breakers, arriving (L5, E gear) · Mortal · normal · textbook: fight rounds: 4.4 (target 3–6)
- **OK** crypt-breakers, arriving (L5, E gear) · Mortal · normal · textbook: elite rounds: 6.3 (target 6–8)
- **LOW** crypt-breakers, arriving (L5, E gear) · Mortal · normal · textbook: boss rounds: 8.6 (target 10–15)
- **OK** crypt-breakers, arriving (L5, E gear) · Mortal · normal · textbook: hunter rounds: 7.6 (target 6–8)
- **OK** crypt-breakers, arriving (L5, E gear) · Nightmare · normal · textbook: fight rounds: 4.4 (target 3–6)
- **OK** crypt-breakers, arriving (L5, E gear) · Nightmare · normal · textbook: elite rounds: 6.3 (target 6–8)
- **LOW** crypt-breakers, arriving (L5, E gear) · Nightmare · normal · textbook: boss rounds: 8.6 (target 10–15)
- **OK** crypt-breakers, arriving (L5, E gear) · Nightmare · normal · textbook: hunter rounds: 7.6 (target 6–8)
- **HIGH** glass cannons, arriving (L5, E gear) · Sheltered · normal · textbook: fight rounds: 6.1 (target 3–6)
- **HIGH** glass cannons, arriving (L5, E gear) · Sheltered · normal · textbook: elite rounds: 9.0 (target 6–8)
- **OK** glass cannons, arriving (L5, E gear) · Sheltered · normal · textbook: boss rounds: 12.9 (target 10–15)
- **HIGH** glass cannons, arriving (L5, E gear) · Sheltered · normal · textbook: hunter rounds: 8.2 (target 6–8)
- **OK** glass cannons, arriving (L5, E gear) · Mortal · normal · textbook: fight rounds: 6.0 (target 3–6)
- **HIGH** glass cannons, arriving (L5, E gear) · Mortal · normal · textbook: elite rounds: 8.9 (target 6–8)
- **OK** glass cannons, arriving (L5, E gear) · Mortal · normal · textbook: boss rounds: 12.6 (target 10–15)
- **HIGH** glass cannons, arriving (L5, E gear) · Mortal · normal · textbook: hunter rounds: 8.1 (target 6–8)
- **OK** glass cannons, arriving (L5, E gear) · Nightmare · normal · textbook: fight rounds: 6.0 (target 3–6)
- **HIGH** glass cannons, arriving (L5, E gear) · Nightmare · normal · textbook: elite rounds: 8.9 (target 6–8)
- **OK** glass cannons, arriving (L5, E gear) · Nightmare · normal · textbook: boss rounds: 12.6 (target 10–15)
- **HIGH** glass cannons, arriving (L5, E gear) · Nightmare · normal · textbook: hunter rounds: 8.1 (target 6–8)
- **OK** the pair, arriving (L5, E gear) · Sheltered · normal · textbook: fight rounds: 4.3 (target 3–6)
- **OK** the pair, arriving (L5, E gear) · Sheltered · normal · textbook: elite rounds: 6.5 (target 6–8)
- **LOW** the pair, arriving (L5, E gear) · Sheltered · normal · textbook: boss rounds: 7.8 (target 10–15)
- **HIGH** the pair, arriving (L5, E gear) · Sheltered · normal · textbook: hunter rounds: 11.8 (target 6–8)
- **OK** the pair, arriving (L5, E gear) · Mortal · normal · textbook: fight rounds: 4.2 (target 3–6)
- **OK** the pair, arriving (L5, E gear) · Mortal · normal · textbook: elite rounds: 6.3 (target 6–8)
- **LOW** the pair, arriving (L5, E gear) · Mortal · normal · textbook: boss rounds: 7.7 (target 10–15)
- **HIGH** the pair, arriving (L5, E gear) · Mortal · normal · textbook: hunter rounds: 11.4 (target 6–8)
- **OK** the pair, arriving (L5, E gear) · Nightmare · normal · textbook: fight rounds: 4.2 (target 3–6)
- **OK** the pair, arriving (L5, E gear) · Nightmare · normal · textbook: elite rounds: 6.3 (target 6–8)
- **LOW** the pair, arriving (L5, E gear) · Nightmare · normal · textbook: boss rounds: 7.7 (target 10–15)
- **HIGH** the pair, arriving (L5, E gear) · Nightmare · normal · textbook: hunter rounds: 11.4 (target 6–8)
- **OK** crypt-breakers, ready (L9, D gear) · Sheltered · normal · textbook: fight rounds: 3.8 (target 3–6)
- **LOW** crypt-breakers, ready (L9, D gear) · Sheltered · normal · textbook: elite rounds: 5.1 (target 6–8)
- **LOW** crypt-breakers, ready (L9, D gear) · Sheltered · normal · textbook: boss rounds: 7.8 (target 10–15)
- **LOW** crypt-breakers, ready (L9, D gear) · Sheltered · normal · textbook: hunter rounds: 5.5 (target 6–8)
- **OK** crypt-breakers, ready (L9, D gear) · Mortal · normal · textbook: fight rounds: 3.8 (target 3–6)
- **LOW** crypt-breakers, ready (L9, D gear) · Mortal · normal · textbook: elite rounds: 5.1 (target 6–8)
- **LOW** crypt-breakers, ready (L9, D gear) · Mortal · normal · textbook: boss rounds: 7.8 (target 10–15)
- **LOW** crypt-breakers, ready (L9, D gear) · Mortal · normal · textbook: hunter rounds: 5.5 (target 6–8)
- **OK** crypt-breakers, ready (L9, D gear) · Nightmare · normal · textbook: fight rounds: 3.8 (target 3–6)
- **LOW** crypt-breakers, ready (L9, D gear) · Nightmare · normal · textbook: elite rounds: 5.1 (target 6–8)
- **LOW** crypt-breakers, ready (L9, D gear) · Nightmare · normal · textbook: boss rounds: 7.8 (target 10–15)
- **LOW** crypt-breakers, ready (L9, D gear) · Nightmare · normal · textbook: hunter rounds: 5.5 (target 6–8)
- **OK** the pair, ready (L9, D gear) · Sheltered · normal · textbook: fight rounds: 3.6 (target 3–6)
- **LOW** the pair, ready (L9, D gear) · Sheltered · normal · textbook: elite rounds: 5.9 (target 6–8)
- **LOW** the pair, ready (L9, D gear) · Sheltered · normal · textbook: boss rounds: 7.3 (target 10–15)
- **OK** the pair, ready (L9, D gear) · Sheltered · normal · textbook: hunter rounds: 7.4 (target 6–8)
- **OK** the pair, ready (L9, D gear) · Mortal · normal · textbook: fight rounds: 3.6 (target 3–6)
- **LOW** the pair, ready (L9, D gear) · Mortal · normal · textbook: elite rounds: 5.9 (target 6–8)
- **LOW** the pair, ready (L9, D gear) · Mortal · normal · textbook: boss rounds: 7.3 (target 10–15)
- **OK** the pair, ready (L9, D gear) · Mortal · normal · textbook: hunter rounds: 7.4 (target 6–8)
- **OK** the pair, ready (L9, D gear) · Nightmare · normal · textbook: fight rounds: 3.6 (target 3–6)
- **LOW** the pair, ready (L9, D gear) · Nightmare · normal · textbook: elite rounds: 5.9 (target 6–8)
- **LOW** the pair, ready (L9, D gear) · Nightmare · normal · textbook: boss rounds: 7.3 (target 10–15)
- **OK** the pair, ready (L9, D gear) · Nightmare · normal · textbook: hunter rounds: 7.4 (target 6–8)
- **HIGH** solo warden, arriving (L11, D gear) · Sheltered · normal · textbook: fight rounds: 7.5 (target 3–6)
- **HIGH** solo warden, arriving (L11, D gear) · Sheltered · normal · textbook: elite rounds: 11.9 (target 6–8)
- **OK** solo warden, arriving (L11, D gear) · Sheltered · normal · textbook: boss rounds: 13.9 (target 10–15)
- **HIGH** solo warden, arriving (L11, D gear) · Mortal · normal · textbook: fight rounds: 7.5 (target 3–6)
- **HIGH** solo warden, arriving (L11, D gear) · Mortal · normal · textbook: elite rounds: 11.9 (target 6–8)
- **OK** solo warden, arriving (L11, D gear) · Mortal · normal · textbook: boss rounds: 13.9 (target 10–15)
- **HIGH** solo warden, arriving (L11, D gear) · Nightmare · normal · textbook: fight rounds: 7.5 (target 3–6)
- **HIGH** solo warden, arriving (L11, D gear) · Nightmare · normal · textbook: elite rounds: 11.9 (target 6–8)
- **OK** solo warden, arriving (L11, D gear) · Nightmare · normal · textbook: boss rounds: 13.9 (target 10–15)
- **OK** solo warden, ground (L21, B gear) · Sheltered · normal · textbook: fight rounds: 5.5 (target 3–6)
- **HIGH** solo warden, ground (L21, B gear) · Sheltered · normal · textbook: elite rounds: 15.2 (target 6–8)
- **HIGH** solo warden, ground (L21, B gear) · Sheltered · normal · textbook: boss rounds: 16.4 (target 10–15)
- **OK** solo warden, ground (L21, B gear) · Mortal · normal · textbook: fight rounds: 5.5 (target 3–6)
- **HIGH** solo warden, ground (L21, B gear) · Mortal · normal · textbook: elite rounds: 15.2 (target 6–8)
- **HIGH** solo warden, ground (L21, B gear) · Mortal · normal · textbook: boss rounds: 16.4 (target 10–15)
- **OK** solo warden, ground (L21, B gear) · Nightmare · normal · textbook: fight rounds: 5.5 (target 3–6)
- **HIGH** solo warden, ground (L21, B gear) · Nightmare · normal · textbook: elite rounds: 15.2 (target 6–8)
- **HIGH** solo warden, ground (L21, B gear) · Nightmare · normal · textbook: boss rounds: 16.4 (target 10–15)
- **OK** classic four, arriving (L11, D gear) · Sheltered · normal · textbook: fight rounds: 4.5 (target 3–6)
- **HIGH** classic four, arriving (L11, D gear) · Sheltered · normal · textbook: elite rounds: 8.5 (target 6–8)
- **OK** classic four, arriving (L11, D gear) · Sheltered · normal · textbook: boss rounds: 12.1 (target 10–15)
- **OK** classic four, arriving (L11, D gear) · Mortal · normal · textbook: fight rounds: 4.5 (target 3–6)
- **HIGH** classic four, arriving (L11, D gear) · Mortal · normal · textbook: elite rounds: 8.6 (target 6–8)
- **OK** classic four, arriving (L11, D gear) · Mortal · normal · textbook: boss rounds: 12.2 (target 10–15)
- **OK** classic four, arriving (L11, D gear) · Nightmare · normal · textbook: fight rounds: 4.5 (target 3–6)
- **HIGH** classic four, arriving (L11, D gear) · Nightmare · normal · textbook: elite rounds: 8.6 (target 6–8)
- **OK** classic four, arriving (L11, D gear) · Nightmare · normal · textbook: boss rounds: 12.3 (target 10–15)
- **OK** crypt-breakers, arriving (L11, D gear) · Sheltered · normal · textbook: fight rounds: 3.7 (target 3–6)
- **OK** crypt-breakers, arriving (L11, D gear) · Sheltered · normal · textbook: elite rounds: 6.2 (target 6–8)
- **OK** crypt-breakers, arriving (L11, D gear) · Sheltered · normal · textbook: boss rounds: 12.8 (target 10–15)
- **OK** crypt-breakers, arriving (L11, D gear) · Mortal · normal · textbook: fight rounds: 3.7 (target 3–6)
- **OK** crypt-breakers, arriving (L11, D gear) · Mortal · normal · textbook: elite rounds: 6.3 (target 6–8)
- **OK** crypt-breakers, arriving (L11, D gear) · Mortal · normal · textbook: boss rounds: 12.6 (target 10–15)
- **OK** crypt-breakers, arriving (L11, D gear) · Nightmare · normal · textbook: fight rounds: 3.7 (target 3–6)
- **OK** crypt-breakers, arriving (L11, D gear) · Nightmare · normal · textbook: elite rounds: 6.3 (target 6–8)
- **OK** crypt-breakers, arriving (L11, D gear) · Nightmare · normal · textbook: boss rounds: 12.8 (target 10–15)
- **OK** glass cannons, arriving (L11, D gear) · Sheltered · normal · textbook: fight rounds: 5.8 (target 3–6)
- **HIGH** glass cannons, arriving (L11, D gear) · Sheltered · normal · textbook: elite rounds: 13.3 (target 6–8)
- **OK** glass cannons, arriving (L11, D gear) · Sheltered · normal · textbook: boss rounds: 12.0 (target 10–15)
- **OK** glass cannons, arriving (L11, D gear) · Mortal · normal · textbook: fight rounds: 5.7 (target 3–6)
- **HIGH** glass cannons, arriving (L11, D gear) · Mortal · normal · textbook: elite rounds: 13.7 (target 6–8)
- **OK** glass cannons, arriving (L11, D gear) · Mortal · normal · textbook: boss rounds: 11.6 (target 10–15)
- **OK** glass cannons, arriving (L11, D gear) · Nightmare · normal · textbook: fight rounds: 5.7 (target 3–6)
- **HIGH** glass cannons, arriving (L11, D gear) · Nightmare · normal · textbook: elite rounds: 13.7 (target 6–8)
- **OK** glass cannons, arriving (L11, D gear) · Nightmare · normal · textbook: boss rounds: 11.6 (target 10–15)
- **OK** the pair, arriving (L11, D gear) · Sheltered · normal · textbook: fight rounds: 5.1 (target 3–6)
- **HIGH** the pair, arriving (L11, D gear) · Sheltered · normal · textbook: elite rounds: 14.9 (target 6–8)
- **OK** the pair, arriving (L11, D gear) · Sheltered · normal · textbook: boss rounds: 13.3 (target 10–15)
- **OK** the pair, arriving (L11, D gear) · Mortal · normal · textbook: fight rounds: 5.0 (target 3–6)
- **HIGH** the pair, arriving (L11, D gear) · Mortal · normal · textbook: elite rounds: 15.3 (target 6–8)
- **OK** the pair, arriving (L11, D gear) · Mortal · normal · textbook: boss rounds: 13.2 (target 10–15)
- **OK** the pair, arriving (L11, D gear) · Nightmare · normal · textbook: fight rounds: 5.0 (target 3–6)
- **HIGH** the pair, arriving (L11, D gear) · Nightmare · normal · textbook: elite rounds: 15.3 (target 6–8)
- **OK** the pair, arriving (L11, D gear) · Nightmare · normal · textbook: boss rounds: 13.3 (target 10–15)
- **OK** crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook: fight rounds: 3.1 (target 3–6)
- **LOW** crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook: elite rounds: 4.4 (target 6–8)
- **LOW** crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook: boss rounds: 8.3 (target 10–15)
- **OK** crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook: fight rounds: 3.1 (target 3–6)
- **LOW** crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook: elite rounds: 4.4 (target 6–8)
- **LOW** crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook: boss rounds: 8.4 (target 10–15)
- **OK** crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook: fight rounds: 3.1 (target 3–6)
- **LOW** crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook: elite rounds: 4.4 (target 6–8)
- **LOW** crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook: boss rounds: 8.4 (target 10–15)
- **OK** the pair, ready (L14, C gear) · Sheltered · normal · textbook: fight rounds: 4.1 (target 3–6)
- **HIGH** the pair, ready (L14, C gear) · Sheltered · normal · textbook: elite rounds: 10.8 (target 6–8)
- **OK** the pair, ready (L14, C gear) · Sheltered · normal · textbook: boss rounds: 10.2 (target 10–15)
- **OK** the pair, ready (L14, C gear) · Mortal · normal · textbook: fight rounds: 4.1 (target 3–6)
- **HIGH** the pair, ready (L14, C gear) · Mortal · normal · textbook: elite rounds: 10.3 (target 6–8)
- **OK** the pair, ready (L14, C gear) · Mortal · normal · textbook: boss rounds: 10.2 (target 10–15)
- **OK** the pair, ready (L14, C gear) · Nightmare · normal · textbook: fight rounds: 4.1 (target 3–6)
- **HIGH** the pair, ready (L14, C gear) · Nightmare · normal · textbook: elite rounds: 10.3 (target 6–8)
- **OK** the pair, ready (L14, C gear) · Nightmare · normal · textbook: boss rounds: 10.2 (target 10–15)
- **HIGH** solo warden, arriving (L13, D gear) · Sheltered · normal · textbook: fight rounds: 14.5 (target 3–6)
- **OK** solo warden, arriving (L13, D gear) · Sheltered · normal · textbook: boss rounds: 12.7 (target 10–15)
- **HIGH** solo warden, arriving (L13, D gear) · Mortal · normal · textbook: fight rounds: 14.5 (target 3–6)
- **OK** solo warden, arriving (L13, D gear) · Mortal · normal · textbook: boss rounds: 12.7 (target 10–15)
- **HIGH** solo warden, arriving (L13, D gear) · Nightmare · normal · textbook: fight rounds: 14.5 (target 3–6)
- **OK** solo warden, arriving (L13, D gear) · Nightmare · normal · textbook: boss rounds: 12.7 (target 10–15)
- **HIGH** solo warden, ground (L21, B gear) · Sheltered · normal · textbook: fight rounds: 11.1 (target 3–6)
- **LOW** solo warden, ground (L21, B gear) · Sheltered · normal · textbook: boss rounds: 9.9 (target 10–15)
- **HIGH** solo warden, ground (L21, B gear) · Mortal · normal · textbook: fight rounds: 11.1 (target 3–6)
- **LOW** solo warden, ground (L21, B gear) · Mortal · normal · textbook: boss rounds: 9.9 (target 10–15)
- **HIGH** solo warden, ground (L21, B gear) · Nightmare · normal · textbook: fight rounds: 11.1 (target 3–6)
- **LOW** solo warden, ground (L21, B gear) · Nightmare · normal · textbook: boss rounds: 9.9 (target 10–15)
- **HIGH** classic four, arriving (L13, D gear) · Sheltered · normal · textbook: fight rounds: 8.7 (target 3–6)
- **LOW** classic four, arriving (L13, D gear) · Sheltered · normal · textbook: boss rounds: 9.8 (target 10–15)
- **HIGH** classic four, arriving (L13, D gear) · Mortal · normal · textbook: fight rounds: 8.7 (target 3–6)
- **LOW** classic four, arriving (L13, D gear) · Mortal · normal · textbook: boss rounds: 9.8 (target 10–15)
- **HIGH** classic four, arriving (L13, D gear) · Nightmare · normal · textbook: fight rounds: 8.7 (target 3–6)
- **LOW** classic four, arriving (L13, D gear) · Nightmare · normal · textbook: boss rounds: 9.8 (target 10–15)
- **HIGH** crypt-breakers, arriving (L13, D gear) · Sheltered · normal · textbook: fight rounds: 6.1 (target 3–6)
- **LOW** crypt-breakers, arriving (L13, D gear) · Sheltered · normal · textbook: boss rounds: 8.3 (target 10–15)
- **HIGH** crypt-breakers, arriving (L13, D gear) · Mortal · normal · textbook: fight rounds: 6.1 (target 3–6)
- **LOW** crypt-breakers, arriving (L13, D gear) · Mortal · normal · textbook: boss rounds: 8.3 (target 10–15)
- **HIGH** crypt-breakers, arriving (L13, D gear) · Nightmare · normal · textbook: fight rounds: 6.1 (target 3–6)
- **LOW** crypt-breakers, arriving (L13, D gear) · Nightmare · normal · textbook: boss rounds: 8.3 (target 10–15)
- **HIGH** glass cannons, arriving (L13, D gear) · Sheltered · normal · textbook: fight rounds: 10.0 (target 3–6)
- **LOW** glass cannons, arriving (L13, D gear) · Sheltered · normal · textbook: boss rounds: 9.2 (target 10–15)
- **HIGH** glass cannons, arriving (L13, D gear) · Mortal · normal · textbook: fight rounds: 10.0 (target 3–6)
- **LOW** glass cannons, arriving (L13, D gear) · Mortal · normal · textbook: boss rounds: 9.2 (target 10–15)
- **HIGH** glass cannons, arriving (L13, D gear) · Nightmare · normal · textbook: fight rounds: 10.0 (target 3–6)
- **LOW** glass cannons, arriving (L13, D gear) · Nightmare · normal · textbook: boss rounds: 9.2 (target 10–15)
- **HIGH** the pair, arriving (L13, D gear) · Sheltered · normal · textbook: fight rounds: 13.4 (target 3–6)
- **LOW** the pair, arriving (L13, D gear) · Sheltered · normal · textbook: boss rounds: 7.9 (target 10–15)
- **HIGH** the pair, arriving (L13, D gear) · Mortal · normal · textbook: fight rounds: 13.3 (target 3–6)
- **LOW** the pair, arriving (L13, D gear) · Mortal · normal · textbook: boss rounds: 7.8 (target 10–15)
- **HIGH** the pair, arriving (L13, D gear) · Nightmare · normal · textbook: fight rounds: 13.3 (target 3–6)
- **LOW** the pair, arriving (L13, D gear) · Nightmare · normal · textbook: boss rounds: 7.8 (target 10–15)
- **OK** crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook: fight rounds: 5.0 (target 3–6)
- **LOW** crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook: boss rounds: 6.6 (target 10–15)
- **OK** crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook: fight rounds: 5.0 (target 3–6)
- **LOW** crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook: boss rounds: 6.6 (target 10–15)
- **OK** crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook: fight rounds: 5.0 (target 3–6)
- **LOW** crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook: boss rounds: 6.6 (target 10–15)
- **HIGH** the pair, ready (L15, C gear) · Sheltered · normal · textbook: fight rounds: 10.2 (target 3–6)
- **LOW** the pair, ready (L15, C gear) · Sheltered · normal · textbook: boss rounds: 6.5 (target 10–15)
- **HIGH** the pair, ready (L15, C gear) · Mortal · normal · textbook: fight rounds: 10.2 (target 3–6)
- **LOW** the pair, ready (L15, C gear) · Mortal · normal · textbook: boss rounds: 6.5 (target 10–15)
- **HIGH** the pair, ready (L15, C gear) · Nightmare · normal · textbook: fight rounds: 10.2 (target 3–6)
- **LOW** the pair, ready (L15, C gear) · Nightmare · normal · textbook: boss rounds: 6.5 (target 10–15)
- **HIGH** classic four, fresh, diving into the Crypts (L1) · Mortal · normal · textbook: fight rounds: 6.2 (target 3–6)
- **HIGH** classic four, fresh, diving into the Crypts (L1) · Mortal · normal · textbook: elite rounds: 8.8 (target 6–8)
- **OK** classic four, fresh, diving into the Crypts (L1) · Mortal · normal · textbook: boss rounds: 10.4 (target 10–15)
- **HIGH** classic four, fresh, diving into the Crypts (L1) · Mortal · normal · textbook: hunter rounds: 11.4 (target 6–8)
- **HIGH** classic four, from the Cellars, diving into the Vault (L5, E gear) · Mortal · normal · textbook: fight rounds: 7.2 (target 3–6)
- **HIGH** classic four, from the Cellars, diving into the Vault (L5, E gear) · Mortal · normal · textbook: elite rounds: 11.6 (target 6–8)
- **OK** classic four, from the Cellars, diving into the Vault (L5, E gear) · Mortal · normal · textbook: boss rounds: 11.6 (target 10–15)
- **HIGH** solo warden, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: fight rounds: 7.5 (target 3–6)
- **HIGH** solo warden, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: elite rounds: 11.9 (target 6–8)
- **OK** solo warden, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: boss rounds: 13.9 (target 10–15)
- **HIGH** solo warden, ground (L21, B gear), F7 to F8 in one delve · Mortal · normal · textbook: fight rounds: 7.3 (target 3–6)
- **HIGH** solo warden, ground (L21, B gear), F7 to F8 in one delve · Mortal · normal · textbook: elite rounds: 15.2 (target 6–8)
- **OK** solo warden, ground (L21, B gear), F7 to F8 in one delve · Mortal · normal · textbook: boss rounds: 14.5 (target 10–15)
- **OK** classic four, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: fight rounds: 5.5 (target 3–6)
- **HIGH** classic four, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: elite rounds: 8.6 (target 6–8)
- **OK** classic four, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: boss rounds: 11.2 (target 10–15)
- **OK** crypt-breakers, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: fight rounds: 4.3 (target 3–6)
- **OK** crypt-breakers, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: elite rounds: 6.3 (target 6–8)
- **OK** crypt-breakers, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: boss rounds: 11.6 (target 10–15)
- **HIGH** glass cannons, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: fight rounds: 6.3 (target 3–6)
- **HIGH** glass cannons, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: elite rounds: 13.7 (target 6–8)
- **OK** glass cannons, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: boss rounds: 11.5 (target 10–15)
- **HIGH** the pair, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: fight rounds: 6.2 (target 3–6)
- **HIGH** the pair, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: elite rounds: 15.3 (target 6–8)
- **OK** the pair, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: boss rounds: 12.1 (target 10–15)
- **OK** crypt-breakers, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook: fight rounds: 3.7 (target 3–6)
- **LOW** crypt-breakers, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook: elite rounds: 4.4 (target 6–8)
- **LOW** crypt-breakers, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook: boss rounds: 7.9 (target 10–15)
- **HIGH** the pair, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook: fight rounds: 6.3 (target 3–6)
- **HIGH** the pair, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook: elite rounds: 10.3 (target 6–8)
- **LOW** the pair, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook: boss rounds: 9.0 (target 10–15)
- **OK** solo warden, fresh · Sheltered · normal · textbook: gold per cleared delve vs R 300: 372.3 gold (target 210–390 gold)
- **OK** solo warden, fresh · Sheltered · normal · textbook: repair bill as % of R: 17.6% (target 15–35%)
- **LOW** solo warden, fresh · Sheltered · normal · textbook: most-worn main hand, wear per delve: 23.7% (target 25–35%)
- **OK** solo warden, fresh · Mortal · normal · textbook: gold per cleared delve vs R 300: 372.3 gold (target 210–390 gold)
- **OK** solo warden, fresh · Mortal · normal · textbook: repair bill as % of R: 17.6% (target 15–35%)
- **LOW** solo warden, fresh · Mortal · normal · textbook: most-worn main hand, wear per delve: 23.7% (target 25–35%)
- **OK** solo warden, fresh · Nightmare · normal · textbook: gold per cleared delve vs R 300: 372.3 gold (target 210–390 gold)
- **OK** solo warden, fresh · Nightmare · normal · textbook: repair bill as % of R: 17.6% (target 15–35%)
- **LOW** solo warden, fresh · Nightmare · normal · textbook: most-worn main hand, wear per delve: 23.7% (target 25–35%)
- **OK** solo warden, ground (L12, D gear) · Sheltered · normal · textbook: gold per cleared delve vs R 300: 362.0 gold (target 210–390 gold)
- **OK** solo warden, ground (L12, D gear) · Sheltered · normal · textbook: repair bill as % of R: 23.5% (target 15–35%)
- **OK** solo warden, ground (L12, D gear) · Mortal · normal · textbook: gold per cleared delve vs R 300: 362.0 gold (target 210–390 gold)
- **OK** solo warden, ground (L12, D gear) · Mortal · normal · textbook: repair bill as % of R: 23.5% (target 15–35%)
- **OK** solo warden, ground (L12, D gear) · Nightmare · normal · textbook: gold per cleared delve vs R 300: 362.0 gold (target 210–390 gold)
- **OK** solo warden, ground (L12, D gear) · Nightmare · normal · textbook: repair bill as % of R: 23.5% (target 15–35%)
- **HIGH** classic four, fresh: warden, blade, mender, arcanist · Sheltered · normal · textbook: gold per cleared delve vs R 300: 502.5 gold (target 210–390 gold)
- **HIGH** classic four, fresh: warden, blade, mender, arcanist · Sheltered · normal · textbook: repair bill as % of R: 48.5% (target 15–35%)
- **HIGH** classic four, fresh: warden, blade, mender, arcanist · Sheltered · normal · textbook: most-worn main hand, wear per delve: 39.6% (target 25–35%)
- **HIGH** classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · textbook: gold per cleared delve vs R 300: 493.0 gold (target 210–390 gold)
- **HIGH** classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · textbook: repair bill as % of R: 46.6% (target 15–35%)
- **HIGH** classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · textbook: most-worn main hand, wear per delve: 38.3% (target 25–35%)
- **HIGH** classic four, fresh: warden, blade, mender, arcanist · Nightmare · normal · textbook: gold per cleared delve vs R 300: 494.7 gold (target 210–390 gold)
- **HIGH** classic four, fresh: warden, blade, mender, arcanist · Nightmare · normal · textbook: repair bill as % of R: 46.6% (target 15–35%)
- **HIGH** classic four, fresh: warden, blade, mender, arcanist · Nightmare · normal · textbook: most-worn main hand, wear per delve: 38.3% (target 25–35%)
- **HIGH** crypt-breakers, fresh: mender, warden, ranger · Sheltered · normal · textbook: gold per cleared delve vs R 300: 426.6 gold (target 210–390 gold)
- **OK** crypt-breakers, fresh: mender, warden, ranger · Sheltered · normal · textbook: repair bill as % of R: 31.1% (target 15–35%)
- **LOW** crypt-breakers, fresh: mender, warden, ranger · Sheltered · normal · textbook: most-worn main hand, wear per delve: 15.6% (target 25–35%)
- **HIGH** crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · textbook: gold per cleared delve vs R 300: 420.0 gold (target 210–390 gold)
- **OK** crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · textbook: repair bill as % of R: 30.5% (target 15–35%)
- **LOW** crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · textbook: most-worn main hand, wear per delve: 15.6% (target 25–35%)
- **HIGH** crypt-breakers, fresh: mender, warden, ranger · Nightmare · normal · textbook: gold per cleared delve vs R 300: 420.0 gold (target 210–390 gold)
- **OK** crypt-breakers, fresh: mender, warden, ranger · Nightmare · normal · textbook: repair bill as % of R: 30.5% (target 15–35%)
- **LOW** crypt-breakers, fresh: mender, warden, ranger · Nightmare · normal · textbook: most-worn main hand, wear per delve: 15.6% (target 25–35%)
- **HIGH** glass cannons, fresh: arcanist, shade, ranger · Sheltered · normal · textbook: gold per cleared delve vs R 300: 409.2 gold (target 210–390 gold)
- **OK** glass cannons, fresh: arcanist, shade, ranger · Sheltered · normal · textbook: repair bill as % of R: 15.8% (target 15–35%)
- **LOW** glass cannons, fresh: arcanist, shade, ranger · Sheltered · normal · textbook: most-worn main hand, wear per delve: 13.5% (target 25–35%)
- **HIGH** glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · textbook: gold per cleared delve vs R 300: 393.8 gold (target 210–390 gold)
- **LOW** glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · textbook: repair bill as % of R: 14.5% (target 15–35%)
- **LOW** glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · textbook: most-worn main hand, wear per delve: 13.6% (target 25–35%)
- **HIGH** glass cannons, fresh: arcanist, shade, ranger · Nightmare · normal · textbook: gold per cleared delve vs R 300: 393.8 gold (target 210–390 gold)
- **LOW** glass cannons, fresh: arcanist, shade, ranger · Nightmare · normal · textbook: repair bill as % of R: 14.5% (target 15–35%)
- **LOW** glass cannons, fresh: arcanist, shade, ranger · Nightmare · normal · textbook: most-worn main hand, wear per delve: 13.6% (target 25–35%)
- **HIGH** the pair, fresh: blade, mender · Sheltered · normal · textbook: gold per cleared delve vs R 300: 425.2 gold (target 210–390 gold)
- **OK** the pair, fresh: blade, mender · Sheltered · normal · textbook: repair bill as % of R: 20.1% (target 15–35%)
- **LOW** the pair, fresh: blade, mender · Sheltered · normal · textbook: most-worn main hand, wear per delve: 24.6% (target 25–35%)
- **HIGH** the pair, fresh: blade, mender · Mortal · normal · textbook: gold per cleared delve vs R 300: 424.5 gold (target 210–390 gold)
- **OK** the pair, fresh: blade, mender · Mortal · normal · textbook: repair bill as % of R: 20.3% (target 15–35%)
- **LOW** the pair, fresh: blade, mender · Mortal · normal · textbook: most-worn main hand, wear per delve: 24.6% (target 25–35%)
- **HIGH** the pair, fresh: blade, mender · Nightmare · normal · textbook: gold per cleared delve vs R 300: 424.5 gold (target 210–390 gold)
- **OK** the pair, fresh: blade, mender · Nightmare · normal · textbook: repair bill as % of R: 20.3% (target 15–35%)
- **LOW** the pair, fresh: blade, mender · Nightmare · normal · textbook: most-worn main hand, wear per delve: 24.6% (target 25–35%)
- **HIGH** crypt-breakers, levelled (L5, E gear) · Sheltered · normal · textbook: gold per cleared delve vs R 300: 435.7 gold (target 210–390 gold)
- **OK** crypt-breakers, levelled (L5, E gear) · Sheltered · normal · textbook: repair bill as % of R: 26.5% (target 15–35%)
- **HIGH** crypt-breakers, levelled (L5, E gear) · Mortal · normal · textbook: gold per cleared delve vs R 300: 434.0 gold (target 210–390 gold)
- **OK** crypt-breakers, levelled (L5, E gear) · Mortal · normal · textbook: repair bill as % of R: 26.7% (target 15–35%)
- **HIGH** crypt-breakers, levelled (L5, E gear) · Nightmare · normal · textbook: gold per cleared delve vs R 300: 434.0 gold (target 210–390 gold)
- **OK** crypt-breakers, levelled (L5, E gear) · Nightmare · normal · textbook: repair bill as % of R: 26.7% (target 15–35%)
- **HIGH** the pair, levelled (L5, E gear) · Sheltered · normal · textbook: gold per cleared delve vs R 300: 413.6 gold (target 210–390 gold)
- **OK** the pair, levelled (L5, E gear) · Sheltered · normal · textbook: repair bill as % of R: 19.5% (target 15–35%)
- **HIGH** the pair, levelled (L5, E gear) · Mortal · normal · textbook: gold per cleared delve vs R 300: 415.4 gold (target 210–390 gold)
- **OK** the pair, levelled (L5, E gear) · Mortal · normal · textbook: repair bill as % of R: 19.8% (target 15–35%)
- **HIGH** the pair, levelled (L5, E gear) · Nightmare · normal · textbook: gold per cleared delve vs R 300: 415.4 gold (target 210–390 gold)
- **OK** the pair, levelled (L5, E gear) · Nightmare · normal · textbook: repair bill as % of R: 19.8% (target 15–35%)
- **OK** solo warden, arriving (L5, E gear) · Sheltered · normal · textbook: gold per cleared delve vs R 480: 336.1 gold (target 336–624 gold)
- **OK** solo warden, arriving (L5, E gear) · Sheltered · normal · textbook: repair bill as % of R: 16.2% (target 15–35%)
- **OK** solo warden, arriving (L5, E gear) · Mortal · normal · textbook: gold per cleared delve vs R 480: 336.1 gold (target 336–624 gold)
- **OK** solo warden, arriving (L5, E gear) · Mortal · normal · textbook: repair bill as % of R: 16.2% (target 15–35%)
- **OK** solo warden, arriving (L5, E gear) · Nightmare · normal · textbook: gold per cleared delve vs R 480: 336.1 gold (target 336–624 gold)
- **OK** solo warden, arriving (L5, E gear) · Nightmare · normal · textbook: repair bill as % of R: 16.2% (target 15–35%)
- **OK** solo warden, ground (L16, C gear) · Sheltered · normal · textbook: gold per cleared delve vs R 480: 401.4 gold (target 336–624 gold)
- **OK** solo warden, ground (L16, C gear) · Sheltered · normal · textbook: repair bill as % of R: 21.4% (target 15–35%)
- **OK** solo warden, ground (L16, C gear) · Mortal · normal · textbook: gold per cleared delve vs R 480: 401.4 gold (target 336–624 gold)
- **OK** solo warden, ground (L16, C gear) · Mortal · normal · textbook: repair bill as % of R: 21.4% (target 15–35%)
- **OK** solo warden, ground (L16, C gear) · Nightmare · normal · textbook: gold per cleared delve vs R 480: 401.4 gold (target 336–624 gold)
- **OK** solo warden, ground (L16, C gear) · Nightmare · normal · textbook: repair bill as % of R: 21.4% (target 15–35%)
- **HIGH** classic four, arriving (L5, E gear) · Sheltered · normal · textbook: gold per cleared delve vs R 480: 681.6 gold (target 336–624 gold)
- **HIGH** classic four, arriving (L5, E gear) · Sheltered · normal · textbook: repair bill as % of R: 52.2% (target 15–35%)
- **HIGH** classic four, arriving (L5, E gear) · Mortal · normal · textbook: gold per cleared delve vs R 480: 679.0 gold (target 336–624 gold)
- **HIGH** classic four, arriving (L5, E gear) · Mortal · normal · textbook: repair bill as % of R: 51.8% (target 15–35%)
- **HIGH** classic four, arriving (L5, E gear) · Nightmare · normal · textbook: gold per cleared delve vs R 480: 686.3 gold (target 336–624 gold)
- **HIGH** classic four, arriving (L5, E gear) · Nightmare · normal · textbook: repair bill as % of R: 51.9% (target 15–35%)
- **OK** crypt-breakers, arriving (L5, E gear) · Sheltered · normal · textbook: gold per cleared delve vs R 480: 573.2 gold (target 336–624 gold)
- **OK** crypt-breakers, arriving (L5, E gear) · Sheltered · normal · textbook: repair bill as % of R: 27.6% (target 15–35%)
- **OK** crypt-breakers, arriving (L5, E gear) · Mortal · normal · textbook: gold per cleared delve vs R 480: 567.3 gold (target 336–624 gold)
- **OK** crypt-breakers, arriving (L5, E gear) · Mortal · normal · textbook: repair bill as % of R: 27.3% (target 15–35%)
- **OK** crypt-breakers, arriving (L5, E gear) · Nightmare · normal · textbook: gold per cleared delve vs R 480: 567.3 gold (target 336–624 gold)
- **OK** crypt-breakers, arriving (L5, E gear) · Nightmare · normal · textbook: repair bill as % of R: 27.3% (target 15–35%)
- **OK** the pair, arriving (L5, E gear) · Sheltered · normal · textbook: gold per cleared delve vs R 480: 485.2 gold (target 336–624 gold)
- **OK** the pair, arriving (L5, E gear) · Sheltered · normal · textbook: repair bill as % of R: 21.4% (target 15–35%)
- **OK** the pair, arriving (L5, E gear) · Mortal · normal · textbook: gold per cleared delve vs R 480: 474.2 gold (target 336–624 gold)
- **OK** the pair, arriving (L5, E gear) · Mortal · normal · textbook: repair bill as % of R: 20.7% (target 15–35%)
- **OK** the pair, arriving (L5, E gear) · Nightmare · normal · textbook: gold per cleared delve vs R 480: 474.2 gold (target 336–624 gold)
- **OK** the pair, arriving (L5, E gear) · Nightmare · normal · textbook: repair bill as % of R: 20.7% (target 15–35%)
- **OK** crypt-breakers, ready (L9, D gear) · Sheltered · normal · textbook: gold per cleared delve vs R 480: 528.5 gold (target 336–624 gold)
- **OK** crypt-breakers, ready (L9, D gear) · Sheltered · normal · textbook: repair bill as % of R: 28.5% (target 15–35%)
- **OK** crypt-breakers, ready (L9, D gear) · Mortal · normal · textbook: gold per cleared delve vs R 480: 523.3 gold (target 336–624 gold)
- **OK** crypt-breakers, ready (L9, D gear) · Mortal · normal · textbook: repair bill as % of R: 28.2% (target 15–35%)
- **OK** crypt-breakers, ready (L9, D gear) · Nightmare · normal · textbook: gold per cleared delve vs R 480: 523.3 gold (target 336–624 gold)
- **OK** crypt-breakers, ready (L9, D gear) · Nightmare · normal · textbook: repair bill as % of R: 28.2% (target 15–35%)
- **OK** the pair, ready (L9, D gear) · Sheltered · normal · textbook: gold per cleared delve vs R 480: 470.9 gold (target 336–624 gold)
- **OK** the pair, ready (L9, D gear) · Sheltered · normal · textbook: repair bill as % of R: 21.2% (target 15–35%)
- **OK** the pair, ready (L9, D gear) · Mortal · normal · textbook: gold per cleared delve vs R 480: 475.5 gold (target 336–624 gold)
- **OK** the pair, ready (L9, D gear) · Mortal · normal · textbook: repair bill as % of R: 21.2% (target 15–35%)
- **OK** the pair, ready (L9, D gear) · Nightmare · normal · textbook: gold per cleared delve vs R 480: 481.7 gold (target 336–624 gold)
- **OK** the pair, ready (L9, D gear) · Nightmare · normal · textbook: repair bill as % of R: 21.4% (target 15–35%)
- **OK** solo warden, ground (L21, B gear) · Sheltered · normal · textbook: gold per cleared delve vs R 370: 342.5 gold (target 259–481 gold)
- **OK** solo warden, ground (L21, B gear) · Sheltered · normal · textbook: repair bill as % of R: 18.4% (target 15–35%)
- **OK** solo warden, ground (L21, B gear) · Mortal · normal · textbook: gold per cleared delve vs R 370: 342.5 gold (target 259–481 gold)
- **OK** solo warden, ground (L21, B gear) · Mortal · normal · textbook: repair bill as % of R: 18.4% (target 15–35%)
- **OK** solo warden, ground (L21, B gear) · Nightmare · normal · textbook: gold per cleared delve vs R 370: 342.5 gold (target 259–481 gold)
- **OK** solo warden, ground (L21, B gear) · Nightmare · normal · textbook: repair bill as % of R: 18.4% (target 15–35%)
- **HIGH** classic four, arriving (L11, D gear) · Sheltered · normal · textbook: gold per cleared delve vs R 370: 516.9 gold (target 259–481 gold)
- **HIGH** classic four, arriving (L11, D gear) · Sheltered · normal · textbook: repair bill as % of R: 46.6% (target 15–35%)
- **HIGH** classic four, arriving (L11, D gear) · Mortal · normal · textbook: gold per cleared delve vs R 370: 515.9 gold (target 259–481 gold)
- **HIGH** classic four, arriving (L11, D gear) · Mortal · normal · textbook: repair bill as % of R: 46.8% (target 15–35%)
- **HIGH** classic four, arriving (L11, D gear) · Nightmare · normal · textbook: gold per cleared delve vs R 370: 518.8 gold (target 259–481 gold)
- **HIGH** classic four, arriving (L11, D gear) · Nightmare · normal · textbook: repair bill as % of R: 47.0% (target 15–35%)
- **OK** crypt-breakers, arriving (L11, D gear) · Sheltered · normal · textbook: gold per cleared delve vs R 370: 392.4 gold (target 259–481 gold)
- **OK** crypt-breakers, arriving (L11, D gear) · Sheltered · normal · textbook: repair bill as % of R: 19.6% (target 15–35%)
- **OK** crypt-breakers, arriving (L11, D gear) · Mortal · normal · textbook: gold per cleared delve vs R 370: 392.4 gold (target 259–481 gold)
- **OK** crypt-breakers, arriving (L11, D gear) · Mortal · normal · textbook: repair bill as % of R: 19.6% (target 15–35%)
- **OK** crypt-breakers, arriving (L11, D gear) · Nightmare · normal · textbook: gold per cleared delve vs R 370: 381.6 gold (target 259–481 gold)
- **OK** crypt-breakers, arriving (L11, D gear) · Nightmare · normal · textbook: repair bill as % of R: 19.2% (target 15–35%)
- **OK** glass cannons, arriving (L11, D gear) · Sheltered · normal · textbook: gold per cleared delve vs R 370: 346.4 gold (target 259–481 gold)
- **LOW** glass cannons, arriving (L11, D gear) · Sheltered · normal · textbook: repair bill as % of R: 14.3% (target 15–35%)
- **OK** glass cannons, arriving (L11, D gear) · Mortal · normal · textbook: gold per cleared delve vs R 370: 347.7 gold (target 259–481 gold)
- **LOW** glass cannons, arriving (L11, D gear) · Mortal · normal · textbook: repair bill as % of R: 13.9% (target 15–35%)
- **OK** glass cannons, arriving (L11, D gear) · Nightmare · normal · textbook: gold per cleared delve vs R 370: 347.7 gold (target 259–481 gold)
- **LOW** glass cannons, arriving (L11, D gear) · Nightmare · normal · textbook: repair bill as % of R: 13.9% (target 15–35%)
- **OK** the pair, arriving (L11, D gear) · Sheltered · normal · textbook: gold per cleared delve vs R 370: 347.3 gold (target 259–481 gold)
- **OK** the pair, arriving (L11, D gear) · Sheltered · normal · textbook: repair bill as % of R: 18.6% (target 15–35%)
- **OK** the pair, arriving (L11, D gear) · Mortal · normal · textbook: gold per cleared delve vs R 370: 350.7 gold (target 259–481 gold)
- **OK** the pair, arriving (L11, D gear) · Mortal · normal · textbook: repair bill as % of R: 18.7% (target 15–35%)
- **OK** the pair, arriving (L11, D gear) · Nightmare · normal · textbook: gold per cleared delve vs R 370: 350.7 gold (target 259–481 gold)
- **OK** the pair, arriving (L11, D gear) · Nightmare · normal · textbook: repair bill as % of R: 18.7% (target 15–35%)
- **OK** crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook: gold per cleared delve vs R 370: 407.2 gold (target 259–481 gold)
- **OK** crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook: repair bill as % of R: 17.3% (target 15–35%)
- **OK** crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook: gold per cleared delve vs R 370: 405.8 gold (target 259–481 gold)
- **OK** crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook: repair bill as % of R: 17.3% (target 15–35%)
- **OK** crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook: gold per cleared delve vs R 370: 407.0 gold (target 259–481 gold)
- **OK** crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook: repair bill as % of R: 17.1% (target 15–35%)
- **OK** the pair, ready (L14, C gear) · Sheltered · normal · textbook: gold per cleared delve vs R 370: 367.5 gold (target 259–481 gold)
- **OK** the pair, ready (L14, C gear) · Sheltered · normal · textbook: repair bill as % of R: 17.8% (target 15–35%)
- **OK** the pair, ready (L14, C gear) · Mortal · normal · textbook: gold per cleared delve vs R 370: 369.4 gold (target 259–481 gold)
- **OK** the pair, ready (L14, C gear) · Mortal · normal · textbook: repair bill as % of R: 17.9% (target 15–35%)
- **OK** the pair, ready (L14, C gear) · Nightmare · normal · textbook: gold per cleared delve vs R 370: 371.6 gold (target 259–481 gold)
- **OK** the pair, ready (L14, C gear) · Nightmare · normal · textbook: repair bill as % of R: 18.0% (target 15–35%)
- **OK** solo warden, arriving (L13, D gear) · Sheltered · normal · textbook: gold per cleared delve vs R 400: 344.8 gold (target 280–520 gold)
- **LOW** solo warden, arriving (L13, D gear) · Sheltered · normal · textbook: repair bill as % of R: 6.0% (target 15–35%)
- **OK** solo warden, arriving (L13, D gear) · Mortal · normal · textbook: gold per cleared delve vs R 400: 344.8 gold (target 280–520 gold)
- **LOW** solo warden, arriving (L13, D gear) · Mortal · normal · textbook: repair bill as % of R: 6.0% (target 15–35%)
- **OK** solo warden, arriving (L13, D gear) · Nightmare · normal · textbook: gold per cleared delve vs R 400: 344.8 gold (target 280–520 gold)
- **LOW** solo warden, arriving (L13, D gear) · Nightmare · normal · textbook: repair bill as % of R: 6.0% (target 15–35%)
- **OK** solo warden, ground (L21, B gear) · Sheltered · normal · textbook: gold per cleared delve vs R 400: 340.0 gold (target 280–520 gold)
- **LOW** solo warden, ground (L21, B gear) · Sheltered · normal · textbook: repair bill as % of R: 6.8% (target 15–35%)
- **OK** solo warden, ground (L21, B gear) · Mortal · normal · textbook: gold per cleared delve vs R 400: 340.0 gold (target 280–520 gold)
- **LOW** solo warden, ground (L21, B gear) · Mortal · normal · textbook: repair bill as % of R: 6.8% (target 15–35%)
- **OK** solo warden, ground (L21, B gear) · Nightmare · normal · textbook: gold per cleared delve vs R 400: 340.0 gold (target 280–520 gold)
- **LOW** solo warden, ground (L21, B gear) · Nightmare · normal · textbook: repair bill as % of R: 6.8% (target 15–35%)
- **OK** classic four, arriving (L13, D gear) · Sheltered · normal · textbook: gold per cleared delve vs R 400: 415.6 gold (target 280–520 gold)
- **OK** classic four, arriving (L13, D gear) · Sheltered · normal · textbook: repair bill as % of R: 18.5% (target 15–35%)
- **OK** classic four, arriving (L13, D gear) · Mortal · normal · textbook: gold per cleared delve vs R 400: 415.6 gold (target 280–520 gold)
- **OK** classic four, arriving (L13, D gear) · Mortal · normal · textbook: repair bill as % of R: 18.5% (target 15–35%)
- **OK** classic four, arriving (L13, D gear) · Nightmare · normal · textbook: gold per cleared delve vs R 400: 414.0 gold (target 280–520 gold)
- **OK** classic four, arriving (L13, D gear) · Nightmare · normal · textbook: repair bill as % of R: 18.4% (target 15–35%)
- **OK** crypt-breakers, arriving (L13, D gear) · Sheltered · normal · textbook: gold per cleared delve vs R 400: 365.9 gold (target 280–520 gold)
- **LOW** crypt-breakers, arriving (L13, D gear) · Sheltered · normal · textbook: repair bill as % of R: 8.2% (target 15–35%)
- **OK** crypt-breakers, arriving (L13, D gear) · Mortal · normal · textbook: gold per cleared delve vs R 400: 365.9 gold (target 280–520 gold)
- **LOW** crypt-breakers, arriving (L13, D gear) · Mortal · normal · textbook: repair bill as % of R: 8.2% (target 15–35%)
- **OK** crypt-breakers, arriving (L13, D gear) · Nightmare · normal · textbook: gold per cleared delve vs R 400: 365.9 gold (target 280–520 gold)
- **LOW** crypt-breakers, arriving (L13, D gear) · Nightmare · normal · textbook: repair bill as % of R: 8.2% (target 15–35%)
- **OK** glass cannons, arriving (L13, D gear) · Sheltered · normal · textbook: gold per cleared delve vs R 400: 381.5 gold (target 280–520 gold)
- **LOW** glass cannons, arriving (L13, D gear) · Sheltered · normal · textbook: repair bill as % of R: 7.4% (target 15–35%)
- **OK** glass cannons, arriving (L13, D gear) · Mortal · normal · textbook: gold per cleared delve vs R 400: 381.5 gold (target 280–520 gold)
- **LOW** glass cannons, arriving (L13, D gear) · Mortal · normal · textbook: repair bill as % of R: 7.4% (target 15–35%)
- **OK** glass cannons, arriving (L13, D gear) · Nightmare · normal · textbook: gold per cleared delve vs R 400: 381.5 gold (target 280–520 gold)
- **LOW** glass cannons, arriving (L13, D gear) · Nightmare · normal · textbook: repair bill as % of R: 7.4% (target 15–35%)
- **OK** the pair, arriving (L13, D gear) · Sheltered · normal · textbook: gold per cleared delve vs R 400: 371.4 gold (target 280–520 gold)
- **LOW** the pair, arriving (L13, D gear) · Sheltered · normal · textbook: repair bill as % of R: 8.5% (target 15–35%)
- **OK** the pair, arriving (L13, D gear) · Mortal · normal · textbook: gold per cleared delve vs R 400: 371.4 gold (target 280–520 gold)
- **LOW** the pair, arriving (L13, D gear) · Mortal · normal · textbook: repair bill as % of R: 8.5% (target 15–35%)
- **OK** the pair, arriving (L13, D gear) · Nightmare · normal · textbook: gold per cleared delve vs R 400: 371.4 gold (target 280–520 gold)
- **LOW** the pair, arriving (L13, D gear) · Nightmare · normal · textbook: repair bill as % of R: 8.5% (target 15–35%)
- **OK** crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook: gold per cleared delve vs R 400: 388.3 gold (target 280–520 gold)
- **LOW** crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook: repair bill as % of R: 8.8% (target 15–35%)
- **OK** crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook: gold per cleared delve vs R 400: 388.3 gold (target 280–520 gold)
- **LOW** crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook: repair bill as % of R: 8.8% (target 15–35%)
- **OK** crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook: gold per cleared delve vs R 400: 388.5 gold (target 280–520 gold)
- **LOW** crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook: repair bill as % of R: 8.7% (target 15–35%)
- **OK** the pair, ready (L15, C gear) · Sheltered · normal · textbook: gold per cleared delve vs R 400: 370.7 gold (target 280–520 gold)
- **LOW** the pair, ready (L15, C gear) · Sheltered · normal · textbook: repair bill as % of R: 9.5% (target 15–35%)
- **OK** the pair, ready (L15, C gear) · Mortal · normal · textbook: gold per cleared delve vs R 400: 370.9 gold (target 280–520 gold)
- **LOW** the pair, ready (L15, C gear) · Mortal · normal · textbook: repair bill as % of R: 9.5% (target 15–35%)
- **OK** the pair, ready (L15, C gear) · Nightmare · normal · textbook: gold per cleared delve vs R 400: 370.9 gold (target 280–520 gold)
- **LOW** the pair, ready (L15, C gear) · Nightmare · normal · textbook: repair bill as % of R: 9.5% (target 15–35%)
- **HIGH** classic four, fresh, diving into the Crypts (L1) · Mortal · normal · textbook: gold per cleared delve vs R 480: 666.4 gold (target 336–624 gold)
- **HIGH** classic four, fresh, diving into the Crypts (L1) · Mortal · normal · textbook: repair bill as % of R: 47.3% (target 15–35%)
- **HIGH** classic four, fresh, diving into the Crypts (L1) · Mortal · normal · textbook: most-worn main hand, wear per delve: 70.8% (target 25–35%)
- **OK** solo warden, ground (L21, B gear), F7 to F8 in one delve · Mortal · normal · textbook: gold per cleared delve vs R 770: 666.3 gold (target 539–1001 gold)
- **LOW** solo warden, ground (L21, B gear), F7 to F8 in one delve · Mortal · normal · textbook: repair bill as % of R: 10.8% (target 15–35%)
- **OK** classic four, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: gold per cleared delve vs R 770: 899.0 gold (target 539–1001 gold)
- **OK** classic four, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: repair bill as % of R: 33.9% (target 15–35%)
- **OK** crypt-breakers, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: gold per cleared delve vs R 770: 734.4 gold (target 539–1001 gold)
- **LOW** crypt-breakers, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: repair bill as % of R: 13.9% (target 15–35%)
- **OK** glass cannons, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: gold per cleared delve vs R 770: 707.0 gold (target 539–1001 gold)
- **LOW** glass cannons, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: repair bill as % of R: 8.2% (target 15–35%)
- **OK** the pair, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: gold per cleared delve vs R 770: 739.3 gold (target 539–1001 gold)
- **OK** the pair, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: repair bill as % of R: 15.4% (target 15–35%)
- **OK** crypt-breakers, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook: gold per cleared delve vs R 770: 807.3 gold (target 539–1001 gold)
- **LOW** crypt-breakers, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook: repair bill as % of R: 14.1% (target 15–35%)
- **OK** the pair, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook: gold per cleared delve vs R 770: 751.3 gold (target 539–1001 gold)
- **LOW** the pair, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook: repair bill as % of R: 15.0% (target 15–35%)
- **OK** solo warden, fresh · Sheltered · normal · textbook: party ambushed, % of fights: 21.7% (target 10–30%)
- **OK** solo warden, fresh · Mortal · normal · textbook: party ambushed, % of fights: 21.7% (target 10–30%)
- **OK** solo warden, fresh · Nightmare · normal · textbook: party ambushed, % of fights: 21.7% (target 10–30%)
- **OK** solo warden, ground (L12, D gear) · Sheltered · normal · textbook: party ambushed, % of fights: 20.5% (target 10–30%)
- **OK** solo warden, ground (L12, D gear) · Mortal · normal · textbook: party ambushed, % of fights: 20.5% (target 10–30%)
- **OK** solo warden, ground (L12, D gear) · Nightmare · normal · textbook: party ambushed, % of fights: 20.5% (target 10–30%)
- **OK** classic four, fresh: warden, blade, mender, arcanist · Sheltered · normal · textbook: party ambushed, % of fights: 16.0% (target 10–30%)
- **OK** classic four, fresh: warden, blade, mender, arcanist · Mortal · normal · textbook: party ambushed, % of fights: 16.5% (target 10–30%)
- **OK** classic four, fresh: warden, blade, mender, arcanist · Nightmare · normal · textbook: party ambushed, % of fights: 16.8% (target 10–30%)
- **OK** crypt-breakers, fresh: mender, warden, ranger · Sheltered · normal · textbook: party ambushed, % of fights: 15.7% (target 10–30%)
- **OK** crypt-breakers, fresh: mender, warden, ranger · Mortal · normal · textbook: party ambushed, % of fights: 15.8% (target 10–30%)
- **OK** crypt-breakers, fresh: mender, warden, ranger · Nightmare · normal · textbook: party ambushed, % of fights: 15.8% (target 10–30%)
- **OK** glass cannons, fresh: arcanist, shade, ranger · Sheltered · normal · textbook: party ambushed, % of fights: 11.7% (target 10–30%)
- **OK** glass cannons, fresh: arcanist, shade, ranger · Mortal · normal · textbook: party ambushed, % of fights: 12.1% (target 10–30%)
- **OK** glass cannons, fresh: arcanist, shade, ranger · Nightmare · normal · textbook: party ambushed, % of fights: 12.3% (target 10–30%)
- **OK** the pair, fresh: blade, mender · Sheltered · normal · textbook: party ambushed, % of fights: 19.6% (target 10–30%)
- **OK** the pair, fresh: blade, mender · Mortal · normal · textbook: party ambushed, % of fights: 19.6% (target 10–30%)
- **OK** the pair, fresh: blade, mender · Nightmare · normal · textbook: party ambushed, % of fights: 19.8% (target 10–30%)
- **OK** crypt-breakers, levelled (L5, E gear) · Sheltered · normal · textbook: party ambushed, % of fights: 13.5% (target 10–30%)
- **OK** crypt-breakers, levelled (L5, E gear) · Mortal · normal · textbook: party ambushed, % of fights: 13.5% (target 10–30%)
- **OK** crypt-breakers, levelled (L5, E gear) · Nightmare · normal · textbook: party ambushed, % of fights: 13.5% (target 10–30%)
- **OK** the pair, levelled (L5, E gear) · Sheltered · normal · textbook: party ambushed, % of fights: 20.5% (target 10–30%)
- **OK** the pair, levelled (L5, E gear) · Mortal · normal · textbook: party ambushed, % of fights: 20.5% (target 10–30%)
- **OK** the pair, levelled (L5, E gear) · Nightmare · normal · textbook: party ambushed, % of fights: 20.6% (target 10–30%)
- **LOW** solo warden, arriving (L5, E gear) · Sheltered · normal · textbook: party ambushed, % of fights: 6.7% (target 10–30%)
- **LOW** solo warden, arriving (L5, E gear) · Mortal · normal · textbook: party ambushed, % of fights: 6.7% (target 10–30%)
- **LOW** solo warden, arriving (L5, E gear) · Nightmare · normal · textbook: party ambushed, % of fights: 6.7% (target 10–30%)
- **LOW** solo warden, ground (L16, C gear) · Sheltered · normal · textbook: party ambushed, % of fights: 6.9% (target 10–30%)
- **LOW** solo warden, ground (L16, C gear) · Mortal · normal · textbook: party ambushed, % of fights: 6.9% (target 10–30%)
- **LOW** solo warden, ground (L16, C gear) · Nightmare · normal · textbook: party ambushed, % of fights: 6.9% (target 10–30%)
- **LOW** classic four, arriving (L5, E gear) · Sheltered · normal · textbook: party ambushed, % of fights: 4.6% (target 10–30%)
- **LOW** classic four, arriving (L5, E gear) · Mortal · normal · textbook: party ambushed, % of fights: 4.6% (target 10–30%)
- **LOW** classic four, arriving (L5, E gear) · Nightmare · normal · textbook: party ambushed, % of fights: 4.6% (target 10–30%)
- **LOW** crypt-breakers, arriving (L5, E gear) · Sheltered · normal · textbook: party ambushed, % of fights: 2.0% (target 10–30%)
- **LOW** crypt-breakers, arriving (L5, E gear) · Mortal · normal · textbook: party ambushed, % of fights: 2.1% (target 10–30%)
- **LOW** crypt-breakers, arriving (L5, E gear) · Nightmare · normal · textbook: party ambushed, % of fights: 2.1% (target 10–30%)
- **LOW** glass cannons, arriving (L5, E gear) · Sheltered · normal · textbook: party ambushed, % of fights: 1.0% (target 10–30%)
- **LOW** glass cannons, arriving (L5, E gear) · Mortal · normal · textbook: party ambushed, % of fights: 1.0% (target 10–30%)
- **LOW** glass cannons, arriving (L5, E gear) · Nightmare · normal · textbook: party ambushed, % of fights: 1.0% (target 10–30%)
- **LOW** the pair, arriving (L5, E gear) · Sheltered · normal · textbook: party ambushed, % of fights: 6.8% (target 10–30%)
- **LOW** the pair, arriving (L5, E gear) · Mortal · normal · textbook: party ambushed, % of fights: 6.8% (target 10–30%)
- **LOW** the pair, arriving (L5, E gear) · Nightmare · normal · textbook: party ambushed, % of fights: 6.8% (target 10–30%)
- **LOW** crypt-breakers, ready (L9, D gear) · Sheltered · normal · textbook: party ambushed, % of fights: 2.8% (target 10–30%)
- **LOW** crypt-breakers, ready (L9, D gear) · Mortal · normal · textbook: party ambushed, % of fights: 2.8% (target 10–30%)
- **LOW** crypt-breakers, ready (L9, D gear) · Nightmare · normal · textbook: party ambushed, % of fights: 2.8% (target 10–30%)
- **LOW** the pair, ready (L9, D gear) · Sheltered · normal · textbook: party ambushed, % of fights: 7.7% (target 10–30%)
- **LOW** the pair, ready (L9, D gear) · Mortal · normal · textbook: party ambushed, % of fights: 7.6% (target 10–30%)
- **LOW** the pair, ready (L9, D gear) · Nightmare · normal · textbook: party ambushed, % of fights: 7.7% (target 10–30%)
- **LOW** solo warden, arriving (L11, D gear) · Sheltered · normal · textbook: party ambushed, % of fights: 7.0% (target 10–30%)
- **LOW** solo warden, arriving (L11, D gear) · Mortal · normal · textbook: party ambushed, % of fights: 7.0% (target 10–30%)
- **LOW** solo warden, arriving (L11, D gear) · Nightmare · normal · textbook: party ambushed, % of fights: 7.0% (target 10–30%)
- **LOW** solo warden, ground (L21, B gear) · Sheltered · normal · textbook: party ambushed, % of fights: 9.7% (target 10–30%)
- **LOW** solo warden, ground (L21, B gear) · Mortal · normal · textbook: party ambushed, % of fights: 9.7% (target 10–30%)
- **LOW** solo warden, ground (L21, B gear) · Nightmare · normal · textbook: party ambushed, % of fights: 9.7% (target 10–30%)
- **LOW** classic four, arriving (L11, D gear) · Sheltered · normal · textbook: party ambushed, % of fights: 4.6% (target 10–30%)
- **LOW** classic four, arriving (L11, D gear) · Mortal · normal · textbook: party ambushed, % of fights: 4.6% (target 10–30%)
- **LOW** classic four, arriving (L11, D gear) · Nightmare · normal · textbook: party ambushed, % of fights: 4.6% (target 10–30%)
- **LOW** crypt-breakers, arriving (L11, D gear) · Sheltered · normal · textbook: party ambushed, % of fights: 3.9% (target 10–30%)
- **LOW** crypt-breakers, arriving (L11, D gear) · Mortal · normal · textbook: party ambushed, % of fights: 3.8% (target 10–30%)
- **LOW** crypt-breakers, arriving (L11, D gear) · Nightmare · normal · textbook: party ambushed, % of fights: 3.8% (target 10–30%)
- **LOW** glass cannons, arriving (L11, D gear) · Sheltered · normal · textbook: party ambushed, % of fights: 2.2% (target 10–30%)
- **LOW** glass cannons, arriving (L11, D gear) · Mortal · normal · textbook: party ambushed, % of fights: 2.3% (target 10–30%)
- **LOW** glass cannons, arriving (L11, D gear) · Nightmare · normal · textbook: party ambushed, % of fights: 2.3% (target 10–30%)
- **LOW** the pair, arriving (L11, D gear) · Sheltered · normal · textbook: party ambushed, % of fights: 7.9% (target 10–30%)
- **LOW** the pair, arriving (L11, D gear) · Mortal · normal · textbook: party ambushed, % of fights: 8.0% (target 10–30%)
- **LOW** the pair, arriving (L11, D gear) · Nightmare · normal · textbook: party ambushed, % of fights: 8.0% (target 10–30%)
- **LOW** crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook: party ambushed, % of fights: 2.4% (target 10–30%)
- **LOW** crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook: party ambushed, % of fights: 2.4% (target 10–30%)
- **LOW** crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook: party ambushed, % of fights: 2.4% (target 10–30%)
- **LOW** the pair, ready (L14, C gear) · Sheltered · normal · textbook: party ambushed, % of fights: 7.6% (target 10–30%)
- **LOW** the pair, ready (L14, C gear) · Mortal · normal · textbook: party ambushed, % of fights: 7.5% (target 10–30%)
- **LOW** the pair, ready (L14, C gear) · Nightmare · normal · textbook: party ambushed, % of fights: 7.5% (target 10–30%)
- **OK** solo warden, arriving (L13, D gear) · Sheltered · normal · textbook: party ambushed, % of fights: 11.8% (target 10–30%)
- **OK** solo warden, arriving (L13, D gear) · Mortal · normal · textbook: party ambushed, % of fights: 11.8% (target 10–30%)
- **OK** solo warden, arriving (L13, D gear) · Nightmare · normal · textbook: party ambushed, % of fights: 11.8% (target 10–30%)
- **LOW** solo warden, ground (L21, B gear) · Sheltered · normal · textbook: party ambushed, % of fights: 10.0% (target 10–30%)
- **LOW** solo warden, ground (L21, B gear) · Mortal · normal · textbook: party ambushed, % of fights: 10.0% (target 10–30%)
- **LOW** solo warden, ground (L21, B gear) · Nightmare · normal · textbook: party ambushed, % of fights: 10.0% (target 10–30%)
- **LOW** classic four, arriving (L13, D gear) · Sheltered · normal · textbook: party ambushed, % of fights: 4.5% (target 10–30%)
- **LOW** classic four, arriving (L13, D gear) · Mortal · normal · textbook: party ambushed, % of fights: 4.5% (target 10–30%)
- **LOW** classic four, arriving (L13, D gear) · Nightmare · normal · textbook: party ambushed, % of fights: 4.5% (target 10–30%)
- **LOW** crypt-breakers, arriving (L13, D gear) · Sheltered · normal · textbook: party ambushed, % of fights: 2.0% (target 10–30%)
- **LOW** crypt-breakers, arriving (L13, D gear) · Mortal · normal · textbook: party ambushed, % of fights: 2.0% (target 10–30%)
- **LOW** crypt-breakers, arriving (L13, D gear) · Nightmare · normal · textbook: party ambushed, % of fights: 2.0% (target 10–30%)
- **LOW** glass cannons, arriving (L13, D gear) · Sheltered · normal · textbook: party ambushed, % of fights: 0.5% (target 10–30%)
- **LOW** glass cannons, arriving (L13, D gear) · Mortal · normal · textbook: party ambushed, % of fights: 0.5% (target 10–30%)
- **LOW** glass cannons, arriving (L13, D gear) · Nightmare · normal · textbook: party ambushed, % of fights: 0.5% (target 10–30%)
- **LOW** the pair, arriving (L13, D gear) · Sheltered · normal · textbook: party ambushed, % of fights: 9.9% (target 10–30%)
- **OK** the pair, arriving (L13, D gear) · Mortal · normal · textbook: party ambushed, % of fights: 10.1% (target 10–30%)
- **OK** the pair, arriving (L13, D gear) · Nightmare · normal · textbook: party ambushed, % of fights: 10.1% (target 10–30%)
- **LOW** crypt-breakers, ready (L14, C gear) · Sheltered · normal · textbook: party ambushed, % of fights: 2.0% (target 10–30%)
- **LOW** crypt-breakers, ready (L14, C gear) · Mortal · normal · textbook: party ambushed, % of fights: 2.0% (target 10–30%)
- **LOW** crypt-breakers, ready (L14, C gear) · Nightmare · normal · textbook: party ambushed, % of fights: 2.0% (target 10–30%)
- **LOW** the pair, ready (L15, C gear) · Sheltered · normal · textbook: party ambushed, % of fights: 9.5% (target 10–30%)
- **LOW** the pair, ready (L15, C gear) · Mortal · normal · textbook: party ambushed, % of fights: 9.5% (target 10–30%)
- **LOW** the pair, ready (L15, C gear) · Nightmare · normal · textbook: party ambushed, % of fights: 9.5% (target 10–30%)
- **LOW** classic four, fresh, diving into the Crypts (L1) · Mortal · normal · textbook: party ambushed, % of fights: 4.9% (target 10–30%)
- **LOW** classic four, from the Cellars, diving into the Vault (L5, E gear) · Mortal · normal · textbook: party ambushed, % of fights: 5.0% (target 10–30%)
- **LOW** solo warden, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: party ambushed, % of fights: 7.0% (target 10–30%)
- **OK** solo warden, ground (L21, B gear), F7 to F8 in one delve · Mortal · normal · textbook: party ambushed, % of fights: 10.4% (target 10–30%)
- **LOW** classic four, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: party ambushed, % of fights: 4.6% (target 10–30%)
- **LOW** crypt-breakers, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: party ambushed, % of fights: 3.3% (target 10–30%)
- **LOW** glass cannons, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: party ambushed, % of fights: 2.3% (target 10–30%)
- **LOW** the pair, arriving (L11, D gear), F7 to F8 in one delve · Mortal · normal · textbook: party ambushed, % of fights: 7.8% (target 10–30%)
- **LOW** crypt-breakers, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook: party ambushed, % of fights: 3.0% (target 10–30%)
- **LOW** the pair, ready (L14, C gear), F7 to F8 in one delve · Mortal · normal · textbook: party ambushed, % of fights: 8.6% (target 10–30%)
- **OK** class damage spread at L1 (arcanist ÷ ranger, single-target damage per round, damage dealers): 1.4× (target 1–1.5×)
- **OK** class damage spread at L5 (blade/greatsword ÷ ranger, single-target damage per round, damage dealers): 1.3× (target 1–1.5×)
- **OK** class damage spread at L8 (blade ÷ ranger, single-target damage per round, damage dealers): 1.5× (target 1–1.5×)
- **HIGH** class damage spread at L13 (blade/greatsword ÷ shade, single-target damage per round, damage dealers): 1.5× (target 1–1.5×)
- **OK** deaths per floor arrival climb with the threat band (D-092): even 0.81 → dangerous 1.17 → deadly 1.57
- **OK** the careful player dies less than the others (it turns back from Deadly floors): 0.91 vs 1.16 deaths / delve

## 12. Reading the report

- Targets are data: tuning.json → `runner.targets` and each recipe's `clearTarget` (D-084's for the Cellars; the Crypts' and the Vault's carried over, Proposed). Only Normal without Pacts is judged; Hard, Dread and Pacts are reported.
- A **fight** is 3–6 rounds for ordinary packs (03 §3.6), elites 6–8, bosses 10–15, hunters 6–8.
- Gold per cleared delve should land near **R** at the delve's band (03 §8.1; 0.7–1.3 R), with the full repair bill 15–35% of R; a fully used weapon should lose 25–35% per delve (08 §9.4); the party should be surprised in 10–30% of fights (03 §4.4).
- **Deaths** are falls past the revive window: under Mortal and Nightmare each is a dead hero (D-088); they are reported until James sets targets.
- **Stuck** means the scripted player found no legal way on (sim/src/policies.ts never wanders); with **capped** (the command cap) it should never happen.
- A hook the sim has no joint for logs `hookStub` (sim/src/skills/custom/README.md) and §10 lists the ones that fired.

## 13. What changed, why, and what is left (round 2; hand-written by pass F after the run)

### 13.0 The verdict

*The textbook player, Normal, Mortal (the game James asked for), 100 seeds a recipe; bosses meet the party for the second time (repeat kills). The Drowned Vault is judged as two delves (D-083), F7 and a start on F8.*

| Floors | Inside its target | Outside |
|---|---|---|
| **The Cellars** (F1–3, D-084's eight) | all eight: fresh solo 3% (0–10) · ground solo 63% (40–85) · classic four 47% (40–75) · crypt-breakers 33% (15–55) · glass cannons 12% (0–40) · the pair 27% (5–40) · levelled crypt-breakers 85% and levelled pair 70% (55–100) | — |
| **The Crypts** (F4–6) | arriving solo 8% · ground solo 53% · classic four 58% · crypt-breakers 45% · glass cannons 0% · the pair 19% · ready crypt-breakers 72% | **low:** the ready pair 46% (55–100) |
| **The Drowned Vault F7** (Sister Naesa) | all eight: arriving solo 0% · ground solo 50% · classic four 64% · crypt-breakers 39% · glass cannons 14% · the pair 30% · ready crypt-breakers 93% · ready pair 74% | — |
| **The Drowned Vault F8** (a start on F8; the Hollow King) | arriving solo 6% · ground solo 54% · classic four 44% · crypt-breakers 47% · the pair 37% · ready crypt-breakers 61% · ready pair 71% | **high:** glass cannons 42% (0–40) |
| *F7 to F8 in one delve* (reported, not judged) | classic four 12% · crypt-breakers 5% · glass cannons 1% · the pair 9% · ready crypt-breakers 33% · ready pair 31% · ground solo 8% · arriving solo 0% | |

- **The done-when** (`12` Phase 7: "a solo hero and a 4-hero party can clear floors 1–8 on Normal … the runner's judgement lines inside targets"): the classic four clears every stretch of the tower as the game plays it (47% · 58% · 64% · 44%), and so does the ground solo (63% · 53% · 50% · 54%). **Clear rates: 90 of 96 lines inside** (32 recipes × three death rules); the six misses are the Crypts' ready pair and the F8 glass cannons (two points over), each under all three rules.
- **All judgement lines:** 385 OK · 215 LOW · 160 HIGH (more lines than round 1's 551: the Vault is two recipes and the one-delve run adds its own). By kind — clear rates 90 / 3 / 3; gold per floor 7 / 0 / 1 (F3); gold per cleared delve 73 / 0 / 25; rounds: fights 62 / 12 / 32, elites 16 / 31 / 35, bosses 35 / 47 / 24, hunters 9 / 3 / 25; repair 57 / 31 / 10; main-hand wear 0 / 12 / 4; ambush 30 / 76 / 0; class spread 3 / 0 / 1; the threat climb, the careful player and stuck-or-capped (none of 16,560) OK.
- **What holds** (§1, §4, §9): deaths per floor arrival climb with the threat chip — Easy 0.25, Even 0.81, Dangerous 1.17, Deadly 1.57 (D-092); the careful player loses 0.91 heroes a delve against the textbook player's 1.16 and walks out of both dives at once. Boss fights still hold 76% of all deaths, but a boss fight costs a hero 34% of the time (42% in round 1). **The back row is hit now:** nobody touched it in 86% of Vexa's fights and 91% of Naesa's in round 1; now 23% and 13% (the Warden's and the King's back rows seldom out-damage them, so their rows stay at 77% and 73%).
- **The dive set and the presets:** a fresh four sent into the Crypts clears 27% (1.90 deaths a delve); a level-5 four sent into the Vault clears nothing and wipes 69%. Hard: the levelled Cellars parties 30% and 23%, the ready Crypts crypt-breakers 35%; Dread clears nothing at these levels (§13.4).

### 13.1 What changed since round 1 (`2026-10-28-gravehollow.md`)

- **The Vault as the game plays it** (D-083, Accepted: "Reaching a floor's way down records it, and the next delve may start on the floor below — the tower remembers"). A party that kills Sister Naesa can teleport out and start its next delve on F8, so the Vault is judged as two delves: **F7** (Naesa) and **a start on F8** (the Hollow King). The F8 recipes start at the level the F7 parties reached on arriving at F8 in round 1 (arriving L13 — F8's own monster level, 07 §1.2 — ready crypt-breakers L14, the ready pair L15, the ground solo L21). The one-delve F7 → F8 run is still played (`vault-run`, Mortal, 100 seeds) and reported, not judged against a clear target. The runner reads a recipe's `floors`, and a part-zone delve's R is its floors' share of 07 §2.3's per-floor gold (F7 370 of the D band's 770, F8 400), so gold per cleared delve is judged against the right R.
- **D-128, bosses scale on their own row** (Proposed; the lead's). `dungeon.partyScaling.boss` holds HP and damage for 1–4 heroes; a boss and every add of its arena read it (`monsters.ts` `partyScale(…, boss)`: the boss and its first adds in `explore.ts` `spawnBossFight`, the arena's adds in `arena.ts`, the fight's damage in `delve.ts`); the count rule stays the fights' (06 §8.1). A later phase's adds (Vexa's Netter, the King's Footmen, Wraith and Tentacles; `fight.ts` `bossPhases`) had come at full count and HP for any party; they now follow the count rule, the boss row and the difficulty's HP knob, as the first phase's adds always did.
- **The hero AI turns on the back row** (a behaviour fix, not a formula). In a boss fight a hero turns on a back-row add, among the enemies it can reach, that has dealt more damage this fight than the boss: bows, spells and reach weapons at once, melee once the front is clear (`fight.ts` `selectTarget`, through the target words `nearest`, `weakest`, `strongest`, `back enemy`, and `front enemy` once no front enemy stands; `ai.ts` only parses the rules). The scripted players inherit it.
- **The levelled targets are D-084's** (Accepted: "levelled parties (L5, E gear) 55–100%"): the runner had carried 70–100 for the levelled crypt-breakers and 55–95 for the levelled pair from content pass 1; both are 55–100 now, and so are the Crypts' and the Vault's mirrored ready recipes.
- **Gold:** the Crypts', the Vault's and the throne's loot-table `goldRange` cut by a third (`tools/content/gen-items.ts`, regenerated; only the three loot tables changed).

### 13.2 Every number moved in round 2 (each measured with `--set` what-ifs before it went into content)

| What | Where | Before | Now | The runner's evidence |
|---|---|---|---|---|
| **The boss row** (D-128, new) | `tuning.json` → `dungeon.partyScaling.boss` | the fights' rows: HP 0.5 / 0.85 / 1.0 / 1.6, damage 0.8 / 1.0 / 1.0 / 1.0 | **HP 0.4 / 0.8 / 1.2 / 2.0, damage 0.7 / 1.2 / 1.3 / 1.3** | Six rows tried on the Cellars (800 delves each): on the fights' rows the four cleared 84%, the crypt-breakers 76%, the pair 45% (all high) and the ground solo 40%; heavier HP landed all but the levelled pair and stretched the fights; heavier damage sank the fours (27–39%); this row lands all eight. |
| the Barrow Warden | `monsters/barrow-warden.json` multipliers | Attack ×1.2, HP ×10 | **×0.75, ×5** | With the boss row the Crypts' four cleared 17% and ready crypt-breakers 20%; at ×1.0/×7: 33% and 47%; ×0.85/×6: 43% and 56%; ×0.75/×5: 58% and 72%. |
| Sister Naesa | `monsters/sister-naesa.json` multipliers | ×1.4, ×12 | **×1.05, ×8** | With the boss row F7's four cleared 29% and crypt-breakers 4%; at ×1.2/×9 every line landed, three near their edges; at ×1.05/×8 every line lands with room. |
| the Hollow King (`07` Q22) | `monsters/hollow-king.json` multipliers | ×1.0, ×7 | **×0.9, ×5** | A start on F8: the four 12% and crypt-breakers 6% at ×1.0/×7; ×0.85/×5: 46% and 45% with the glass cannons and the pair at 45%; ×0.75/×4.5 with the returning hunters at 30% HP: 63% and 62%; ×0.9/×5 (hunters at 40% as before): 44% and 47%, the glass cannons 42%. |
| fight gold, the Crypts | `loot-tables/gravehollow-crypts.json` `goldRange` (via `tools/content/gen-items.ts`) | 16–32 | **11–21** | Gold per floor F4–F8 ran 1.4–1.9× `07` §2.3's (all high); now 0.9–1.2× (all inside). |
| fight gold, the Vault | `loot-tables/gravehollow-vault.json` | 25–50 | **17–33** | (as above) |
| fight gold, the throne | `loot-tables/gravehollow-throne.json` | 40–60 | **27–40** | (as above) |
| the levelled targets | `runner.recipes` clear targets | 70–100 (levelled crypt-breakers), 55–95 (levelled pair) | **55–100** | D-084 (Accepted) reads "levelled parties (L5, E gear) 55–100%"; the runner had carried content pass 1's bands. The Crypts' and the Vault's ready recipes mirror it. |
| the Vault's recipes | `runner.recipes`, `runner.plans` | eight recipes for F7–F8 in one delve | **F7 (eight), a start on F8 (eight: L13, ready L14 and L15, ground L21), F7 to F8 in one delve (eight, reported)** | D-083; the F8 levels are what the F7 parties reached on arriving at F8 in round 1. |

**Not moved, noted under D-084** (its numbers are Accepted): the pair's monster HP in ordinary fights stays at **0.85** where round 1 set it (D-084: 1.0) — with the boss row in place it could go back to 1.0, but the Crypts' pairs (the ready pair already short) would pay for it; count ×0.6 / 0.8 / 1.0 / 1.6, the rest of the HP and damage rows and champion HP ×3 are D-084's.

### 13.3 Still off, and the smallest fix

1. **The Crypts' ready pair** (blade and mender, L9, D gear) clears 46% (55–100). The Barrow Warden beats pairs (pairs win 47% of his fights, threes and fours 64–68%): a pair has no one to hold the Warden and his hound while the mender heals. The pair's boss row cannot rise without pushing the Cellars' and F8's pairs over their tops. *Smallest fix:* none by number; for James — accept it ("best taken with a party", D-084), or give the mirrored ready targets for pairs their own band.
2. **The F8 glass cannons** clear 42% (0–40). The throne fight treats every party alike (the four 44%, crypt-breakers 47%, the pair 37%, the glass cannons 42%), so one King multiplier cannot hold the four at 40% or more and the glass cannons at 40% or less. Two points is within the seeds' noise; *for James:* F8's mirrored targets.
3. **Boss fights are short in the Crypts and on the throne**: the Warden takes 6.4–7.6 rounds and the King 5.9–8.0 (03 §3.6: 10–15), while Vexa's four runs 18. The HP cuts that landed the clear targets shortened them. *Next step (a second tuning pass):* HP back up and attack down for the Warden and the King (for example ×8 HP at ×0.5 Attack), re-tuned against the same clear targets; Vexa's four the other way.
4. **Gold per cleared delve**: every Cellars party of two or more runs 1.3–1.6× R (the Cellars' table was not cut, and Vexa's purse makes F3 twice its 120), and fours run about 1.4× a solo's gold everywhere (the Crypts 679 against 624, F7 516 against 481). The cut lands the floors but not the party-size gap. *Proposed (formula, checkpoint 2):* `loot.ts` divides by the party-scaled typical size (3 × the count scale), so a four's fight pays like a trio's; and the Cellars' `goldRange` or Vexa's purse down a third.
5. **Unchanged from round 1**: fight and hunter rounds, the ambush rate (most recipes below 10% of fights ambushed), repair and main-hand wear — reported in §5–§6; elite length is §13.4.

### 13.4 Reported, not tuned (no one number fixes them)

- **Elite fight length** (03 §3.6: elites 6–8 rounds). The Cellars' elite fights still run short for every party but the fresh solo, the Vault's run long for small parties (§5). The number that sets it, champion HP ×3 (D-084's, Accepted), moves both ends the same way, so no single number fixes it. *Proposed for checkpoint 2:* champion HP by zone (for example ×4 · ×3 · ×2.5 for the Cellars, the Crypts and the Vault), or leave elites short in the Cellars as a gentle start.
- **The Dread reference party.** Dread unlocks after a final boss on Hard (07 §6.1), and at these recipes' levels it clears nothing (the spot set). The fair reference is a party that has beaten the King on Hard. *Proposed:* a `dread` recipe set — the classic four and the crypt-breakers at L16 with C gear (the F8 ready levels plus two) — judged once James sets Dread targets.
- **The level-13 class spread** (pass A's measure, §8b): the blade with a greatsword out-damages the shade by just over 1.5×. One number would close it (the greatsword's damage or the Shade's backstab), but both are pass A's and pass B's numbers and the gap is the size of the measure's noise (twelve fights a cell); reported for the class pass.

### 13.5 Proposed decisions from round 2 (for `13`)

1. **D-128, bosses scale on their own row** (the lead's, Proposed; 03 §11.2 "the monster count scales, then monster HP, then monster damage"): `dungeon.partyScaling.boss` sets HP and damage for 1–4 heroes for a boss and every add of its arena; the count rule stays the fights'. With it, a later phase's adds follow the count rule (06 §8.1, "boss adds use the count rule"), the boss row and the difficulty's HP knob, as the first phase's adds did. *Reason:* the fights' rows let fours and threes beat bosses far too often and solos far too seldom (round 1: 74% of deaths in boss fights); one row per party size fixes the boss's share without moving D-084's ordinary fights.
2. **The hero AI turns on the back row** (a behaviour reading; 07 §2.8: behind the barricade and around the throne "only bows, spells and reach weapons" hit the back row): in a boss fight a hero turns on a back-row add it can reach that has dealt more damage this fight than the boss — bows, spells and reach weapons at once, melee once the front is clear; a target word that names the front row keeps it while a front enemy stands. *Reason:* the back row went unhit in 76–91% of boss fights.
3. **The Vault as two delves** (D-083's reading for the runner): F7 and a start on F8 are judged, each against the mirrored targets, the F8 parties at the level the F7 parties reach there; a part-zone delve's R is its floors' share of `07` §2.3's per-floor gold; the one-delve run is reported. *Reason:* "the next delve may start on the floor below".
4. **The loot tables' deeper gold** (08 §11's 16–32, 25–50, 40–60 become 11–21, 17–33, 27–40): `08` §11's rows need the same numbers (pass B's doc).
5. **For checkpoint 2:** the party-scaled typical size in `loot.ts` (formula, §13.3.4); champion HP by zone (§13.4); a Dread reference party (§13.4).

### 13.6 Open questions for James (checkpoint 2)

- **The ready pair against the Barrow Warden** clears 46% where a ready trio clears 72%: keep pairs weak at the Warden, or give pairs their own band?
- **The throne treats every party alike** (a start on F8: the four 44%, a pair 37%, the glass cannons 42%): are the Cellars' targets the right ones for one boss floor?
- **Rounds or clear rates first?** The bosses that now land their clear targets fight 6–8 rounds in the Crypts and on the throne (03 §3.6: 10–15). The next pass can trade HP for damage to lengthen them; should it?
- **Gold for bigger parties:** should a four's fight pay like a trio's (the party-scaled typical size), or should bigger parties earn more?
- **07 Q22 — the Hollow King's HP:** ×5 now (×30 in the docs before Phase 7).

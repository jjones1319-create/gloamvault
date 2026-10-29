/**
 * The Hollow King (07 §2.2: "The Throne theme is a four-note leitmotif heard once in each zone's mode, then on pipe
 * organ and bass drum at 72 bpm, with the Company's trumpet, the Warden's reed organ and the cult's bell each returning
 * as that zone's hunter enters"). E Phrygian, 4/4 at 72. The intro walks the leitmotif down the tower — the Cellars'
 * Mixolydian (D E A F♯), the Crypts' Dorian (E F♯ B G), the Vault's Phrygian (E F B G) — then the pipe organ states it
 * in long notes over full organ chords, a contrabass pedal and a bass drum. `phase2` adds string tremolo and timpani;
 * `phase3` the choir and cymbal swells. In the last phase each hunter that answers the King brings back its zone's
 * voice as a layer: `company` (Old Gnaw: the Grinning Company's cracked trumpet call), `vigil` (the Warden's Hound:
 * the Warden's tetrachord on reed organ), `cult` (the Vault Leech: the cult's drowned bell and its chant). Original.
 */
import { defineSong } from '../song.ts'

export default defineSong({
  id: 'throne',
  kind: 'boss',
  brief: 'The Hollow King: the four-note leitmotif walked down through the Cellars, the Crypts and the Vault, then thundered on pipe organ and bass drum in E Phrygian; tremolo and timpani, then choir; each returning hunter brings back the trumpet, the reed organ or the bell of its zone.',
  musicSend: 0.4,
  abc: `
X:1
M:4/4
L:1/8
Q:1/4=72
K:E phr
V:chords
[P:intro] "D"z8 | "D"z8 | "Em"z8 | "Em"z8 | "Em"z8 | "Em"z8 |
[P:A] "Em"z8 | "F"z8 | "Em"z8 | "C"z8 | "Dm"z8 | "G"z8 | "Dm"z8 | "Em"z8 |
[P:B] "C"z8 | "Dm"z8 | "Em"z8 | "F"z8 | "Am"z8 | "Dm"z8 | "Dm"z8 | "Em"z8 |
[P:A2] "Em"z8 | "F"z8 | "Em"z8 | "C"z8 | "Dm"z8 | "C"z8 | "Em"z8 | "Em"z8 |
[P:C] "F"z8 | "G"z8 | "Am"z8 | "Em"z8 | "Dm"z8 | "C"z8 | "Dm"z8 | "Em"z8 |
V:organ1
[P:intro] [K:D mix] !mp! D4 E4 | A,4 F4 | [K:E dor] E4 F4 | B,4 G4 | [K:E phr] E4 F4 | B,4 G4 |
[P:A] !f! E8 | F8 | B,8 | G8 | F6 E2 | D4 B,4 | C2 D2 E2 F2 | E4 B,4 |
[P:B] !mf! G6 A2 | F6 G2 | E4 G4 | A6 G2 | c6 B2 | A4 F4 | D4 F4 | E8 |
[P:A2] !f! E8 | F8 | B,8 | G8 | F4 A4 | G6 F2 | E4 D4 | E8 |
[P:C] A4 c4 | B6 A2 | c4 B4 | A4 G4 | A4 F4 | G4 E4 | F4 D4 | E8 |
V:trumpet
[P:intro] z8 | z8 | z8 | z8 | z8 | z8 |
[P:A] z8 | z8 | !f! z2 B,2 !crack!E4 | D2 B,2 G,4 | z8 | z8 | z8 | z8 |
[P:B] z8 | z8 | z2 B,2 !crack!E4 | D2 B,2 G,4 | z8 | z8 | z8 | z8 |
[P:A2] z8 | z8 | z2 B,2 !crack!E4 | D2 B,2 G,4 | z8 | z8 | z8 | z8 |
[P:C] z8 | z8 | z2 B,2 !crack!E4 | D2 B,2 G,4 | z8 | z8 | z8 | z8 |
V:reed
[P:intro] z8 | z8 | z8 | z8 | z8 | z8 |
[P:A] z8 | z8 | z8 | z8 | !mf! e4 d4 | c4 B4 | z8 | z8 |
[P:B] z8 | z8 | z8 | z8 | e4 d4 | c4 B4 | z8 | z8 |
[P:A2] z8 | z8 | z8 | z8 | e4 d4 | c4 B4 | z8 | z8 |
[P:C] z8 | z8 | z8 | z8 | e4 d4 | c4 B4 | z8 | z8 |
V:bell
[P:intro] z8 | z8 | z8 | z8 | z8 | z8 |
[P:A] !mf! E4 z4 | z8 | B,4 z4 | z8 | E4 z4 | z8 | B,4 z4 | z8 |
[P:B] E4 z4 | z8 | B,4 z4 | z8 | E4 z4 | z8 | B,4 z4 | z8 |
[P:A2] E4 z4 | z8 | B,4 z4 | z8 | E4 z4 | z8 | B,4 z4 | z8 |
[P:C] E4 z4 | z8 | B,4 z4 | z8 | E4 z4 | z8 | B,4 z4 | z8 |
V:chant
[P:intro] z8 | z8 | z8 | z8 | z8 | z8 |
[P:A] !mp! E2 E2 F4 | E2 D2 E4 | z8 | z8 | z8 | z8 | z8 | z8 |
[P:B] E2 E2 F4 | E2 D2 E4 | z8 | z8 | z8 | z8 | z8 | z8 |
[P:A2] E2 E2 F4 | E2 D2 E4 | z8 | z8 | z8 | z8 | z8 | z8 |
[P:C] E2 E2 F4 | E2 D2 E4 | z8 | z8 | z8 | z8 | z8 | z8 |
`,
  parts: {
    organ1: { inst: 'organ', role: 'lead', layers: ['base', 'phase2', 'phase3'], gain: 0 },
    trumpet: { inst: 'trumpet', role: 'colour', layers: ['company'], gain: -3, pan: 0.35, lowpassHz: 4000 },
    reed: { inst: 'organ', role: 'colour', layers: ['vigil'], gain: -5, pan: -0.3 },
    bell: { inst: 'tubular-bells', role: 'colour', layers: ['cult'], gain: -8, pan: 0.3, lowpassHz: 1000 },
    chant: { inst: 'choir', role: 'colour', layers: ['cult'], gain: -8, pan: -0.2 },
  },
  accomp: {
    chords: { inst: 'organ', role: 'accomp', pattern: 'padSustain', layers: ['base', 'phase2', 'phase3'], octave: 2, size: 3, gain: -9 },
    pedal: { inst: 'contrabass', art: 'sus', role: 'bass', pattern: 'bassRoot', layers: ['base', 'phase2', 'phase3'], octave: 2, gain: -6 },
    strings: { inst: 'violins', art: 'trem', role: 'accomp', pattern: 'padSustain', layers: ['phase2', 'phase3'], octave: 4, gain: -16, pan: 0.2 },
    choir: { inst: 'choir', role: 'accomp', pattern: 'padSustain', layers: ['phase3'], octave: 3, gain: -11, pan: -0.15 },
  },
  perc: {
    grid: 16,
    lines: {
      drum: { inst: 'bass-drum', layers: ['base', 'phase2', 'phase3'], steps: 'X.......X.......', gain: -7 },
      timp: { inst: 'timpani', layers: ['phase2', 'phase3'], steps: 'X...........x...', gain: -11, pitch: 'root' },
      swell: { inst: 'cymbal-swell', layers: ['phase3'], steps: '................ | ............X...', gain: -16 },
    },
  },
  order: ['intro', 'A', 'B', 'A2', 'C'],
  loopFrom: 1,
  quotes: [
    { motif: 'throne', part: 'organ1', section: 'A' },
    { motif: 'company', part: 'trumpet', section: 'A' },
    { motif: 'vigil', part: 'reed', section: 'A' },
    { motif: 'chant', part: 'chant', section: 'A' },
  ],
})

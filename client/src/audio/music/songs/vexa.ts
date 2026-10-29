/**
 * Captain Vexa Marrow (07 §2.2: "the boss theme is the trumpet motif in a drunken 3/4"). D Mixolydian with the
 * Cellars' flattened sixth and a borrowed A7, a swung 3/4 at 126 that lurches: the Company's cracked trumpet states the
 * call, a clarinet staggers through the tune with slides, a strumstick and a pizzicato bass play the oom-pah-pah, a
 * frame drum, a tambourine and a hiccuping bongo. `phase2` (she throws the coin away and attacks twice a turn) adds a
 * darbuka, a snare and spiccato violins. A cello states the Throne's leitmotif in the Cellars' mode in the C section —
 * the boss theme every boss shares. Original.
 */
import { defineSong } from '../song.ts'

export default defineSong({
  id: 'vexa',
  kind: 'boss',
  brief: 'Captain Vexa: a lurching, swung 3/4 bandit waltz in D Mixolydian, the cracked trumpet call, a clarinet staggering with slides over an oom-pah-pah; in her second phase drums and spiccato strings pile on.',
  musicSend: 0.22,
  swing: 0.62,
  abc: `
X:1
M:3/4
L:1/8
Q:1/4=126
K:D mix
V:chords
[P:intro] "D"z6 | "D"z6 | "C"z6 | "D"z6 |
[P:A] "D"z6 | "G"z6 | "D"z6 | "C"z6 | "D"z6 | "Bb"z6 | "C"z6 | "D"z6 |
[P:B] "G"z6 | "D"z6 | "C"z6 | "G"z6 | "Am"z6 | "D"z6 | "Bb"z6 | "A7"z6 |
[P:A2] "D"z6 | "G"z6 | "D"z6 | "C"z6 | "D"z6 | "Bb"z6 | "C"z6 | "D"z6 |
[P:C] "D"z6 | "Em"z6 | "Am"z6 | "D"z6 | "C"z6 | "Bb"z6 | "C"z6 | "D"z6 |
[P:B2] "G"z6 | "D"z6 | "C"z6 | "G"z6 | "Am"z6 | "D"z6 | "Bb"z6 | "A7"z6 |
V:clar
[P:intro] z6 | z6 | z6 | z6 |
[P:A] !mf! A3 B A2 | d3 c B2 | F3 G A2 | G4 z2 | F3 A d2 | d4 !slide!_B2 | c3 B G2 | A4 z2 |
[P:B] z6 | z6 | G3 A G2 | B4 z2 | A3 B c2 | d3 e f2 | !slide!=f2 d2 _B2 | A2 ^c2 e2 |
[P:A2] A3 B A2 | d3 c B2 | F3 G A2 | E3 F G z | A3 d f2 | d4 c2 | B3 c d2 | A6 |
[P:C] !mp! f6 | g6 | e6 | d4 z2 | !mf! c3 d e2 | d4 !slide!_B2 | c2 G2 E2 | F6 |
[P:B2] z6 | z6 | G3 A B2 | d4 z2 | A3 B c2 | d3 c B2 | !slide!=f2 d2 _B2 | A2 ^c2 e2 |
V:trumpet
[P:intro] z6 | z6 | !f! z2 A2 !crack!d2 | c A F4 |
[P:A] z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
[P:B] !f! z2 A2 !crack!d2 | c A F2 z2 | z6 | z6 | z6 | z6 | z6 | z6 |
[P:A2] z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
[P:C] z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
[P:B2] !f! z2 A2 !crack!d2 | c A d2 z2 | z6 | z6 | z6 | z6 | z6 | z6 |
V:cello
[P:intro] z6 | z6 | z6 | z6 |
[P:A] z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
[P:B] z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
[P:A2] z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
[P:C] !mf! D,6 | E,6 | A,,6 | F,6 | z6 | z6 | z6 | z6 |
[P:B2] z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
`,
  parts: {
    clar: { inst: 'clarinet', role: 'lead', layers: ['base', 'phase2'], gain: 0, pan: -0.1 },
    trumpet: { inst: 'trumpet', role: 'colour', layers: ['base', 'phase2'], gain: -2, pan: 0.3, lowpassHz: 4200 },
    cello: { inst: 'cellos', art: 'vib', role: 'colour', layers: ['base', 'phase2'], gain: -5, pan: -0.25 },
  },
  accomp: {
    oompah: { inst: 'strumstick', role: 'accomp', pattern: 'waltz', layers: ['base', 'phase2'], octave: 3, gain: -11, pan: 0.15 },
    bass: { inst: 'contrabass', art: 'pizz', role: 'bass', pattern: 'bassRoot', layers: ['base', 'phase2'], octave: 2, gain: -6 },
    pulse: { inst: 'violins', art: 'spic', role: 'accomp', pattern: 'pulse', layers: ['phase2'], octave: 4, gain: -16, pan: 0.25 },
  },
  perc: {
    grid: 12,
    lines: {
      drum: { inst: 'frame-drum', layers: ['base', 'phase2'], steps: 'X...........', gain: -10 },
      tamb: { inst: 'tambourine', layers: ['base', 'phase2'], steps: '....x...x...', gain: -17, pan: 0.3 },
      hiccup: { inst: 'bongos', layers: ['base', 'phase2'], steps: '.......x.... | ..........x.', gain: -18, pan: -0.3 },
      darbuka: { inst: 'darbuka', layers: ['phase2'], steps: 'X.x.x.x.x.x.', gain: -16, pan: 0.2 },
      snare: { inst: 'snare', layers: ['phase2'], steps: '....X...X...', gain: -13 },
    },
  },
  order: ['intro', 'A', 'B', 'A2', 'C', 'B2'],
  loopFrom: 1,
  quotes: [
    { motif: 'throne', part: 'cello', section: 'C' },
    { motif: 'company', part: 'trumpet', section: 'intro' },
  ],
})

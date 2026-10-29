/**
 * A fight in the Cellars (07 §2.2: "fights go to 4/4 at 112 bpm with a snare roll"). D Mixolydian like the Cellars,
 * 4/4 at 112: a snare roll opens it and closes each pass; the lute drives the tune over a walking pizzicato bass, a
 * frame drum and a snare on two and four. Layers: `base` (the tune, the bass, the kit), `drive` (a darbuka, busy
 * strums and spiccato violins), `tension` (cello tremolo, a buzz roll every bar and a cymbal swell, when the party is
 * in trouble). The Company's cracked trumpet trades calls with the lute in the C section. Original.
 */
import { defineSong } from '../song.ts'

export default defineSong({
  id: 'cellars-fight',
  kind: 'fight',
  brief: 'A Cellars fight: a snare roll, then a driving 4/4 lute tune in D Mixolydian over a walking bass and hand drums; the bandits\' cracked trumpet answers; tremolo and buzz rolls when the party is in trouble.',
  musicSend: 0.2,
  abc: `
X:1
M:4/4
L:1/8
Q:1/4=112
K:D mix
V:chords
[P:intro] "D"z8 | "D"z8 |
[P:A] "D"z8 | "C"z8 | "G"z8 | "D"z8 | "D"z8 | "C"z8 | "Am"z8 | "D"z8 |
[P:B] "Am"z8 | "Em"z8 | "C"z8 | "D"z8 | "Bb"z8 | "C"z8 | "Am"z8 | "D"z8 |
[P:A2] "D"z8 | "C"z8 | "G"z8 | "D"z8 | "D"z8 | "C"z8 | "Am"z8 | "D"z8 |
[P:C] "G"z8 | "D"z8 | "C"z8 | "D"z8 | "Em"z8 | "C"z8 | "Bb"z8 | "D"z8 |
V:lute
[P:intro] z8 | z8 |
[P:A] !f! d2 d e f2 e d | e2 c d e2 d c | B2 G A B2 d2 | A3 F A2 z2 | d2 d e f2 a2 | g2 e c e2 g2 | a2 g e c2 B2 | A6 z2 |
[P:B] c2 B A B2 c2 | B2 A G A2 B2 | c2 d e g2 e2 | f2 e d A2 d2 | d2 c !slide!_B A2 _B2 | c2 e g e2 c2 | e2 d c B2 A2 | A6 z2 |
[P:A2] d2 d e f2 e d | e2 c d e2 d c | B2 G A B2 d2 | A3 B c2 B2 | d2 f a f2 d2 | g2 e c e2 g2 | a2 g e d2 c2 | d6 z2 |
[P:C] z8 | z8 | e2 d c d2 e2 | f2 e d A4 | z8 | z8 | d2 c !slide!_B A2 G2 | A6 z2 |
V:trumpet
[P:intro] z8 | z8 |
[P:A] z8 | z8 | z8 | z8 | z8 | z8 | z8 | z8 |
[P:B] z8 | z8 | z8 | z8 | z8 | z8 | z8 | z8 |
[P:A2] z8 | z8 | z8 | z8 | z8 | z8 | z8 | z8 |
[P:C] !f! z2 A2 !crack!d4 | c2 A2 F4 | z8 | z8 | z2 B2 !crack!e4 | d2 B2 G4 | z8 | z8 |
V:roll
[P:intro] z8 | !mf! C8 |
[P:A] z8 | z8 | z8 | z8 | z8 | z8 | z8 | z8 |
[P:B] z8 | z8 | z8 | z8 | z8 | z8 | z8 | z6 C2 |
[P:A2] z8 | z8 | z8 | z8 | z8 | z8 | z8 | z8 |
[P:C] z8 | z8 | z8 | z8 | z8 | z8 | z8 | z4 C4 |
`,
  parts: {
    lute: { inst: 'strumstick', role: 'lead', layers: ['base', 'drive', 'tension'], gain: 0, pan: 0.1 },
    trumpet: { inst: 'trumpet', role: 'colour', layers: ['base', 'drive', 'tension'], gain: -3, pan: 0.35, lowpassHz: 4000 },
    roll: { inst: 'snare', art: 'roll', role: 'perc', layers: ['base', 'drive', 'tension'], gain: -8 },
  },
  accomp: {
    bass: { inst: 'contrabass', art: 'pizz', role: 'bass', pattern: 'pizzWalk', layers: ['base', 'drive', 'tension'], octave: 2, gain: -6 },
    strum: { inst: 'strumstick', role: 'accomp', pattern: 'strum', layers: ['drive', 'tension'], octave: 3, size: 2, density: 'busy', gain: -14, pan: -0.25 },
    pulse: { inst: 'violins', art: 'spic', role: 'accomp', pattern: 'pulse', layers: ['drive', 'tension'], octave: 4, gain: -16, pan: 0.2 },
    trem: { inst: 'cellos', art: 'trem', role: 'accomp', pattern: 'tremolo', layers: ['tension'], octave: 3, gain: -15, pan: -0.15 },
  },
  perc: {
    grid: 16,
    lines: {
      kick: { inst: 'frame-drum', layers: ['base', 'drive', 'tension'], steps: 'X.......X.......', gain: -9 },
      snare: { inst: 'snare', layers: ['base', 'drive', 'tension'], steps: '....X.......X...', gain: -11 },
      darbuka: { inst: 'darbuka', layers: ['drive', 'tension'], steps: '..x.x..x..x.x..x', gain: -17, pan: 0.2 },
      buzz: { inst: 'snare', art: 'roll', layers: ['tension'], steps: '............XXXX', gain: -16 },
      swell: { inst: 'cymbal-swell', layers: ['tension'], steps: 'X............... | ................', gain: -19 },
    },
  },
  order: ['intro', 'A', 'B', 'A2', 'C'],
  loopFrom: 1,
})

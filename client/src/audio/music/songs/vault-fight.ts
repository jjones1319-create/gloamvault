/**
 * A fight in the Drowned Vault (derived from 07 §2.2's Vault: Phrygian, tremolo strings, the bell, the chant in fifths,
 * "a sub-bass boom when the tide rises"): E Phrygian, 6/8 at ♩. = 72 — the explore piece's 3/4 at 54 doubled into a
 * rolling compound pulse. A violin section carries the tune over a viola pad, a pizzicato bass and a frame drum.
 * Layers: `base` (the tune, the pad, the bass, the drum), `drive` (the choir's fifths stabbing each bar, the submerged
 * bell, a darbuka), `tension` (cello tremolo, timpani strokes and a bass-drum boom, when the party is in trouble).
 * Original.
 */
import { defineSong } from '../song.ts'

export default defineSong({
  id: 'vault-fight',
  kind: 'fight',
  brief: 'A Vault fight: a rolling E Phrygian 6/8, a violin tune over a pizzicato bass and a frame drum, the chant\'s fifths stabbing and the drowned bell tolling; tremolo, timpani and booms when the party is in trouble.',
  musicSend: 0.3,
  abc: `
X:1
M:6/8
L:1/8
Q:3/8=72
K:E phr
V:chords
[P:intro] "Em"z6 | "F"z6 |
[P:A] "Em"z6 | "F"z6 | "Em"z6 | "Dm"z6 | "Em"z6 | "F"z6 | "G"z6 | "Em"z6 |
[P:B] "Am"z6 | "G"z6 | "F"z6 | "Em"z6 | "Am"z6 | "Dm"z6 | "F"z6 | "Em"z6 |
[P:A2] "Em"z6 | "F"z6 | "Em"z6 | "Dm"z6 | "Em"z6 | "F"z6 | "G"z6 | "Em"z6 |
[P:C] "C"z6 | "Dm"z6 | "Em"z6 | "F"z6 | "Dm"z6 | "G"z6 | "F"z6 | "Em"z6 |
[P:B2] "Am"z6 | "G"z6 | "F"z6 | "Em"z6 | "Am"z6 | "Dm"z6 | "F"z6 | "Em"z6 |
V:violin
[P:intro] z6 | z6 |
[P:A] !f! e2 f g2 f | f3 c3 | B2 c d2 e | f3 d3 | e2 g b2 g | a2 g f2 e | d2 e f2 d | e6 |
[P:B] c2 B A2 c | B2 d g2 d | c2 d f2 a | g2 f e3 | e2 d c2 B | A2 B c2 d | f2 e d2 c | B6 |
[P:A2] e2 f g2 f | f3 c3 | B2 c d2 e | f3 d3 | e2 f g2 e | c2 d f2 c | B2 c d2 B | e6 |
[P:C] e3 d3 | f3 e3 | e2 d B2 c | c3 A3 | d2 e f2 e | d2 c B2 d | c2 d f2 e | e6 |
[P:B2] c2 B A2 c | B2 d g2 d | c2 d f2 a | g2 f e3 | e2 c A2 B | d2 c A2 F | A2 B c2 e | e6 |
V:stab
[P:intro] !f! [E,B,]3 z3 | [F,C]3 z3 |
[P:A] [E,B,]3 z3 | [F,C]3 z3 | [E,B,]3 z3 | [D,A,]3 z3 | [E,B,]3 z3 | [F,C]3 z3 | [G,D]3 z3 | [E,B,]3 z3 |
[P:B] [A,E]3 z3 | [G,D]3 z3 | [F,C]3 z3 | [E,B,]3 z3 | [A,E]3 z3 | [D,A,]3 z3 | [F,C]3 z3 | [E,B,]3 z3 |
[P:A2] [E,B,]3 z3 | [F,C]3 z3 | [E,B,]3 z3 | [D,A,]3 z3 | [E,B,]3 z3 | [F,C]3 z3 | [G,D]3 z3 | [E,B,]3 z3 |
[P:C] [C,G,]3 z3 | [D,A,]3 z3 | [E,B,]3 z3 | [F,C]3 z3 | [D,A,]3 z3 | [G,D]3 z3 | [F,C]3 z3 | [E,B,]3 z3 |
[P:B2] [A,E]3 z3 | [G,D]3 z3 | [F,C]3 z3 | [E,B,]3 z3 | [A,E]3 z3 | [D,A,]3 z3 | [F,C]3 z3 | [E,B,]3 z3 |
V:bell
[P:intro] !mf! E6 | z6 |
[P:A] E3 z3 | z6 | E3 z3 | z6 | E3 z3 | z6 | B,3 z3 | z6 |
[P:B] A,3 z3 | z6 | C3 z3 | z6 | A,3 z3 | z6 | C3 z3 | B,3 z3 |
[P:A2] E3 z3 | z6 | E3 z3 | z6 | E3 z3 | z6 | B,3 z3 | z6 |
[P:C] C3 z3 | z6 | E3 z3 | z6 | A,3 z3 | z6 | C3 z3 | E3 z3 |
[P:B2] A,3 z3 | z6 | C3 z3 | z6 | A,3 z3 | z6 | C3 z3 | B,3 z3 |
`,
  parts: {
    violin: { inst: 'violins', art: 'vib', role: 'lead', layers: ['base', 'drive', 'tension'], gain: 0, pan: 0.1 },
    stab: { inst: 'choir', role: 'accomp', layers: ['drive', 'tension'], gain: -9, pan: -0.15 },
    bell: { inst: 'tubular-bells', role: 'colour', layers: ['drive', 'tension'], gain: -11, pan: 0.3, lowpassHz: 1100 },
  },
  accomp: {
    pad: { inst: 'violas', art: 'vib', role: 'accomp', pattern: 'padSustain', layers: ['base', 'drive', 'tension'], octave: 3, gain: -17, pan: -0.2 },
    bass: { inst: 'contrabass', art: 'pizz', role: 'bass', pattern: 'pizzWalk', layers: ['base', 'drive', 'tension'], octave: 2, gain: -6 },
    trem: { inst: 'cellos', art: 'trem', role: 'accomp', pattern: 'tremolo', layers: ['tension'], octave: 3, gain: -15, pan: 0.2 },
  },
  perc: {
    grid: 12,
    lines: {
      frame: { inst: 'frame-drum', layers: ['base', 'drive', 'tension'], steps: 'X.....x.....', gain: -9 },
      darbuka: { inst: 'darbuka', layers: ['drive', 'tension'], steps: '..x.x...x.x.', gain: -15, pan: 0.25 },
      timp: { inst: 'timpani', layers: ['tension'], steps: 'X.....x..... | X...........', gain: -12, pitch: 'root' },
      boom: { inst: 'bass-drum', layers: ['tension'], steps: 'X........... | ............', gain: -9 },
    },
  },
  order: ['intro', 'A', 'B', 'A2', 'C', 'B2'],
  loopFrom: 1,
})

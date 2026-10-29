/**
 * A fight in the Crypts (07 §2.2 gives the Crypts' mood, not its fights; derived from it): E Dorian, 4/4 at 104 — the
 * explore piece's bone rattle and frame drum turned into a drive, a viola section with the tune over a walking
 * pizzicato bass. Layers: `base` (the tune, the bass, the frame drum and the rattle), `drive` (the choir's whole-tone
 * clusters stabbing on every downbeat, pizzicato cello eighths, muted frame-drum eighths), `tension` (cello tremolo and a
 * timpani stroke, when the party is in trouble). Original.
 */
import { defineSong } from '../song.ts'

export default defineSong({
  id: 'crypts-fight',
  kind: 'fight',
  brief: 'A Crypts fight: an urgent E Dorian viola tune over a walking bass, bone rattles and a frame drum, the wordless choir stabbing whole-tone clusters on the downbeats; tremolo and timpani when the party is in trouble.',
  musicSend: 0.26,
  abc: `
X:1
M:4/4
L:1/8
Q:1/4=104
K:E dor
V:chords
[P:intro] "Em"z8 | "Em"z8 |
[P:A] "Em"z8 | "D"z8 | "Em"z8 | "A"z8 | "Em"z8 | "G"z8 | "A"z8 | "Em"z8 |
[P:B] "G"z8 | "D"z8 | "Em"z8 | "Bm"z8 | "G"z8 | "D"z8 | "A"z8 | "D"z8 |
[P:A2] "Em"z8 | "D"z8 | "Em"z8 | "A"z8 | "Em"z8 | "G"z8 | "A"z8 | "Em"z8 |
[P:C] "G"z8 | "A"z8 | "Bm"z8 | "Em"z8 | "G"z8 | "D"z8 | "Em"z8 | "Em"z8 |
V:viola
[P:intro] z8 | z8 |
[P:A] !f! e2 f2 g2 f e | f2 e d A4 | B2 c2 d2 e2 | e2 d c A4 | e2 f2 g2 f2 | d2 B2 G4 | A2 B c e2 c2 | B2 A G E4 |
[P:B] d2 e2 g2 d2 | f2 e2 d4 | e2 d B G4 | F2 G2 A2 B2 | d2 B2 G2 B2 | A2 d2 f4 | e2 c2 A2 c2 | d6 z2 |
[P:A2] e2 f2 g2 f e | f2 e d A4 | B2 c2 d2 e2 | e2 f e c4 | B2 e2 g2 e2 | d2 B2 G4 | c2 B A E4 | e6 z2 |
[P:C] B2 c2 d2 B2 | c2 B2 A4 | B2 A2 F4 | G2 A2 B4 | B2 c2 d2 e2 | f2 e2 d2 A2 | B2 e2 g2 f2 | e6 z2 |
V:stab
[P:intro] !f! [DEF]2 z6 | z8 |
[P:A] [DEF]2 z6 | [DEF]2 z6 | [DEF]2 z6 | [A,B,C]2 z6 | [DEF]2 z6 | [G,A,B,]2 z6 | [A,B,C]2 z6 | [DEF]2 z6 |
[P:B] [G,A,B,]2 z6 | [DEF]2 z6 | [DEF]2 z6 | [A,B,C]2 z6 | [G,A,B,]2 z6 | [DEF]2 z6 | [A,B,C]2 z6 | [DEF]2 z6 |
[P:A2] [DEF]2 z6 | [DEF]2 z6 | [DEF]2 z6 | [A,B,C]2 z6 | [DEF]2 z6 | [G,A,B,]2 z6 | [A,B,C]2 z6 | [DEF]2 z6 |
[P:C] [G,A,B,]2 z6 | [A,B,C]2 z6 | [A,B,C]2 z6 | [DEF]2 z6 | [G,A,B,]2 z6 | [DEF]2 z6 | [DEF]2 z6 | [DEF]2 z6 |
`,
  parts: {
    viola: { inst: 'violas', art: 'vib', role: 'lead', layers: ['base', 'drive', 'tension'], gain: 0, pan: 0.1 },
    stab: { inst: 'choir', role: 'accomp', layers: ['drive', 'tension'], gain: -9, pan: -0.2 },
  },
  accomp: {
    bass: { inst: 'contrabass', art: 'pizz', role: 'bass', pattern: 'pizzWalk', layers: ['base', 'drive', 'tension'], octave: 2, gain: -6 },
    pulse: { inst: 'cellos', art: 'pizz', role: 'accomp', pattern: 'pulse', layers: ['drive', 'tension'], octave: 3, gain: -15, pan: 0.25 },
    trem: { inst: 'cellos', art: 'trem', role: 'accomp', pattern: 'tremolo', layers: ['tension'], octave: 3, gain: -15, pan: -0.25 },
  },
  perc: {
    grid: 16,
    lines: {
      kick: { inst: 'frame-drum', layers: ['base', 'drive', 'tension'], steps: 'X.....x.X.......', gain: -9 },
      rattle: { inst: 'rattle', layers: ['base', 'drive', 'tension'], steps: '..x...x...x...x.', gain: -12, pan: 0.3 },
      ticks: { inst: 'frame-drum', art: 'muted', layers: ['drive', 'tension'], steps: 'x.x.x.x.x.x.x.x.', gain: -18, pan: -0.25 },
      timp: { inst: 'timpani', layers: ['tension'], steps: 'X............... | ................', gain: -11, pitch: 'root' },
    },
  },
  order: ['intro', 'A', 'B', 'A2', 'C'],
  loopFrom: 1,
})

/**
 * The Cellars (07 §2.2: "lute and bowed bass in a loping 6/8, Mixolydian with a sliding flattened sixth over a
 * dropped-tuning drone; hand drums and a cracked trumpet motif for the Company"). D Mixolydian, 6/8 at ♩. = 66. The
 * strumstick plays the lute's tune over a second strumstick's chords; a contrabass bows long tones over a cello drone
 * on low D; the flattened sixth (B♭) is slid into in the B and C sections; frame drum, darbuka and bongos keep the
 * lope; the Company's cracked trumpet calls once a pass. The bowed bass states the Throne's leitmotif in the Cellars'
 * mode in the C section (D E A F♯). In a rest room only the lute, the bass and the drone play. Original.
 */
import { defineSong } from '../song.ts'

export default defineSong({
  id: 'cellars',
  kind: 'explore',
  brief: 'The Cellars: a loping 6/8 lute tune in D Mixolydian over a low cello drone and a bowed bass, hand drums under it; the tune leans into a flattened sixth with a slide; the bandits\' cracked trumpet calls once a pass.',
  musicSend: 0.3,
  abc: `
X:1
M:6/8
L:1/8
Q:3/8=66
K:D mix
V:chords
[P:intro] "D"z6 | "D"z6 |
[P:A] "D"z6 | "C"z6 | "D"z6 | "G"z6 | "D"z6 | "C"z6 | "Am"z6 | "D"z6 |
[P:B] "G"z6 | "D"z6 | "C"z6 | "D"z6 | "Bb"z6 | "C"z6 | "D"z6 | "D"z6 |
[P:A2] "D"z6 | "C"z6 | "D"z6 | "G"z6 | "D"z6 | "C"z6 | "Am"z6 | "D"z6 |
[P:C] "D"z6 | "Em"z6 | "Am"z6 | "D"z6 | "C"z6 | "G"z6 | "Bb"z6 | "D"z6 |
[P:B2] "G"z6 | "D"z6 | "C"z6 | "D"z6 | "Bb"z6 | "C"z6 | "D"z6 | "D"z6 |
V:lute
[P:intro] z6 | z6 |
[P:A] !mf! A2 B d2 e | e2 d c2 B | A2 F A2 d | B3 G3 | A2 B d2 f | g2 f e2 c | e2 d c2 B | A6 |
[P:B] z6 | z6 | G2 A B2 c | d3 c3 | d2 c !slide!_B3 | A2 G G2 E | F2 A d2 c | A6 |
[P:A2] A2 B d2 e | e2 d c2 B | A2 F A2 d | B3 d3 | f2 e d2 B | c2 e g2 e | e2 c A2 B | A6 |
[P:C] !mp! d3 e3 | g3 f3 | e3 d3 | f6 | !mf! e2 d c2 d | B2 A G2 B | d2 c !slide!_B3 | A6 |
[P:B2] z6 | z6 | G2 A B2 c | d3 B3 | d2 c !slide!_B3 | A2 G E2 G | F2 A d2 e | d6 |
V:trumpet
[P:intro] z6 | z6 |
[P:A] z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
[P:B] !mf! z2 A !crack!d3 | c A F3 z | z6 | z6 | z6 | z6 | z6 | z6 |
[P:A2] z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
[P:C] z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
[P:B2] !mf! z2 A !crack!d3 | c A d3 z | z6 | z6 | z6 | z6 | z6 | z6 |
V:bass
[P:intro] !mp! D,6 | D,6 |
[P:A] D,6 | C,6 | D,6 | B,,6 | D,6 | C,6 | A,,6 | D,6 |
[P:B] G,,6 | D,6 | C,6 | D,6 | _B,,6 | C,6 | D,6 | D,6 |
[P:A2] D,6 | C,6 | D,6 | B,,6 | D,6 | C,6 | A,,6 | D,6 |
[P:C] !mf! D,6 | E,6 | A,,6 | F,6 | !mp! C,6 | G,,6 | _B,,6 | D,6 |
[P:B2] G,,6 | D,6 | C,6 | D,6 | _B,,6 | C,6 | D,6 | D,6 |
V:drone
[P:intro] !p! D,,6- | D,,6 |
[P:A] D,,6- | D,,6- | D,,6- | D,,6- | D,,6- | D,,6- | D,,6- | D,,6 |
[P:B] D,,6- | D,,6- | D,,6- | D,,6- | D,,6- | D,,6- | D,,6- | D,,6 |
[P:A2] D,,6- | D,,6- | D,,6- | D,,6- | D,,6- | D,,6- | D,,6- | D,,6 |
[P:C] D,,6- | D,,6- | D,,6- | D,,6- | D,,6- | D,,6- | D,,6- | D,,6 |
[P:B2] D,,6- | D,,6- | D,,6- | D,,6- | D,,6- | D,,6- | D,,6- | D,,6 |
`,
  parts: {
    lute: { inst: 'strumstick', role: 'lead', layers: ['main', 'rest'], gain: 0, pan: 0.1 },
    trumpet: { inst: 'trumpet', role: 'colour', layers: ['main'], gain: -4, pan: 0.35, lowpassHz: 3800 },
    bass: { inst: 'contrabass', art: 'sus', role: 'bass', layers: ['main', 'rest'], gain: -6, pan: -0.1 },
    drone: { inst: 'cellos', art: 'vib', role: 'bass', layers: ['main', 'rest'], gain: -12 },
  },
  accomp: {
    strum: { inst: 'strumstick', role: 'accomp', pattern: 'strum', layers: ['main'], octave: 3, size: 2, gain: -13, pan: -0.25 },
  },
  perc: {
    grid: 12,
    lines: {
      frame: { inst: 'frame-drum', layers: ['main'], steps: 'X.....x.....', gain: -12 },
      darbuka: { inst: 'darbuka', layers: ['main'], steps: '....x...x.x.', gain: -16, pan: 0.25 },
      bongo: { inst: 'bongos', layers: ['main'], steps: '..x.......x. | ..x.....o.x.', gain: -21, pan: -0.3 },
    },
  },
  order: ['intro', 'A', 'B', 'A2', 'C', 'B2'],
  loopFrom: 1,
  quotes: [
    { motif: 'throne', part: 'bass', section: 'C' },
    { motif: 'company', part: 'trumpet', section: 'B' },
  ],
})

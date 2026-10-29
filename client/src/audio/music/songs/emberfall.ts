/**
 * Emberfall (Phase 8; the town and the title). 07 §1 and 03 §8.2 give the town no music brief, so this one is written
 * in the Cellars' spirit from 01's tone ("the town is lamplight, a forge and a bar") and 03 §13 ("Emberfall at dusk"):
 * a warm tavern waltz in G major, 3/4 at 100 — an alto recorder over a strummed strumstick and a cello pizzicato on
 * one, a frame drum and a light tambourine; a cello countermelody in the B and C sections; the C section borrows a
 * Mixolydian F natural, the bar's own song. Each place hears its own slice of the same tune so the music never
 * restarts between doors: the square (everything), the smithy (strum, bass, the cello and the anvil ringing every other
 * bar), the Skill Hall and the curio stall (harp under the recorder), the Lantern Inn (the square plus a woodblock),
 * the Ember Shrine (organ and harp, no tune). The title plays the tune on recorder, harp, organ and cello, no drums.
 * Original.
 */
import { defineSong } from '../song.ts'

export default defineSong({
  id: 'emberfall',
  kind: 'town',
  brief: 'Emberfall at dusk: a warm tavern waltz in G, a recorder tune over a strummed lute-like strumstick and a pizzicato bass on one; the forge rings an anvil every other bar at the smithy, the inn knocks on wood, the shrine keeps only organ and harp.',
  musicSend: 0.22,
  abc: `
X:1
M:3/4
L:1/8
Q:1/4=100
K:G
V:chords
[P:intro] "G"z6 | "C/G"z6 | "G"z6 | "D"z6 |
[P:A] "G"z6 | "C"z6 | "G"z6 | "D"z6 | "Em"z6 | "C"z6 | "D"z6 | "G"z6 |
[P:B] "C"z6 | "G"z6 | "Am"z6 | "D"z6 | "C"z6 | "G/B"z6 | "Am"z6 | "D"z6 |
[P:A2] "G"z6 | "C"z6 | "G"z6 | "D"z6 | "Em"z6 | "C"z6 | "D"z6 | "G"z6 |
[P:C] "Em"z6 | "Bm"z6 | "C"z6 | "G"z6 | "Am"z6 | "Em"z6 | "F"z6 | "D"z6 |
[P:B2] "C"z6 | "G"z6 | "Am"z6 | "D"z6 | "C"z6 | "G/B"z6 | "Am"z6 | "D"z6 |
V:lead
[P:intro] z6 | z6 | z6 | z6 |
[P:A] !mp! B3 c d2 | e2 c2 G2 | B2 d2 g2 | f4 z2 | g3 f e2 | e2 c2 d2 | d3 c A2 | B4 z2 |
[P:B] g3 a g2 | d4 B2 | c3 d e2 | a4 z2 | g3 e c2 | d2 B2 G2 | A2 B2 c2 | d4 z2 |
[P:A2] B3 c d2 | e2 c2 G2 | B2 d2 g2 | a4 z2 | g2 e2 B2 | e2 c2 d2 | f2 d2 A2 | G4 z2 |
[P:C] e3 f g2 | f2 d2 B2 | c2 e2 g2 | g4 z2 | e3 d c2 | B2 G2 B2 | =f3 e d2 | A4 z2 |
[P:B2] g3 a g2 | d4 B2 | c3 d e2 | f4 z2 | e3 d c2 | d2 B2 G2 | A2 B2 c2 | A4 z2 |
V:counter
[P:intro] z6 | z6 | z6 | z6 |
[P:A] z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
[P:B] !p! E6 | D6 | C6 | A,6 | G,6 | B,6 | C6 | D6 |
[P:A2] z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
[P:C] !p! G,6 | F,6 | E,6 | D,6 | E,6 | G,6 | A,6 | F,6 |
[P:B2] !p! E6 | D6 | C6 | A,6 | G,6 | B,6 | C6 | D6 |
`,
  parts: {
    lead: { inst: 'recorder-alto', role: 'lead', layers: ['main'], gain: 0, pan: 0.1 },
    counter: { inst: 'cellos', art: 'vib', role: 'counter', layers: ['main'], gain: -9, pan: -0.25 },
  },
  accomp: {
    strum: { inst: 'strumstick', role: 'accomp', pattern: 'strum', layers: ['main'], octave: 3, gain: -10, pan: -0.2, density: 'normal' },
    pizz: { inst: 'cellos', art: 'pizz', role: 'bass', pattern: 'waltz', layers: ['main'], octave: 2, gain: -9 },
    harp: { inst: 'harp', role: 'accomp', pattern: 'harpArp', layers: ['main'], octave: 3, gain: -11, pan: 0.2 },
    organ: { inst: 'organ', role: 'accomp', pattern: 'padSustain', layers: ['main'], octave: 3, gain: -17 },
  },
  perc: {
    grid: 12,
    lines: {
      drum: { inst: 'frame-drum', layers: ['main'], steps: 'X...o...o...', gain: -12 },
      tamb: { inst: 'tambourine', layers: ['main'], steps: '....x...x...', gain: -19, pan: 0.3 },
      anvil: { inst: 'anvil', layers: ['main'], steps: 'X........... | ............', gain: -16, pan: 0.4 },
      wood: { inst: 'woodblock', layers: ['main'], steps: '........x.x.', gain: -17, pan: -0.3 },
    },
  },
  order: ['intro', 'A', 'B', 'A2', 'C', 'B2'],
  loopFrom: 1,
  stems: {
    square: ['lead', 'strum', 'pizz', 'drum', 'tamb'],
    forge: ['strum', 'pizz', 'counter', 'drum', 'anvil'],
    hall: ['lead', 'counter', 'harp'],
    stall: ['lead', 'harp', 'pizz', 'tamb'],
    inn: ['lead', 'strum', 'pizz', 'drum', 'tamb', 'wood'],
    shrine: ['organ', 'harp', 'counter'],
  },
  arrangements: {
    title: { lines: ['lead', 'harp', 'organ', 'counter'], gainDb: 1 },
  },
})

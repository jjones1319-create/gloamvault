/**
 * The Barrow Warden (07 §2.2: "the Warden's theme a slow descending tetrachord on reed organ, in canon with itself at 72
 * bpm for the Vigil"). E Dorian, 4/4 at 72. The reed organ begins the tetrachord (E D C♯ B) and walks the scale down,
 * then climbs back by fourths; two bars later a second organ voice an octave below follows it note for note — written so
 * the two land on fourths, fifths, thirds, sixths and octaves — over a held low E at each verse's start. A contrabass,
 * a timpani heartbeat and the Warden's own bell at each phrase's end. `phase2` (the secret doors grind open and the dead
 * come in) adds the choir, a cello tremolo, the bone rattle and a frame drum. A cello states the Throne's leitmotif in
 * the Crypts' mode in the C section — the boss theme every boss shares. Original.
 */
import { defineSong } from '../song.ts'

export default defineSong({
  id: 'warden',
  kind: 'boss',
  brief: 'The Barrow Warden: a slow, solemn reed-organ line walking down from a four-note tetrachord in E Dorian, answered in canon an octave below, a heartbeat on timpani and a tolling bell; when the doors open, choir, tremolo and bone rattles join.',
  musicSend: 0.42,
  abc: `
X:1
M:4/4
L:1/8
Q:1/4=72
K:E dor
V:chords
[P:intro] "Em"z8 | "Em"z8 |
[P:A] "Em"z8 | "A"z8 | "A"z4 "G"z4 | "F#m"z4 "Em"z4 | "D"z4 "G"z4 | "Bm"z4 "Em"z4 | "D"z4 "G"z4 | "F#m"z4 "Bm"z4 |
[P:B] "Em"z8 | "A"z8 | "A"z4 "G"z4 | "F#m"z4 "Em"z4 | "A"z4 "G"z4 | "D"z4 "Em"z4 | "A"z4 "Bm"z4 | "Bm"z4 "G"z4 |
[P:A2] "Em"z8 | "A"z8 | "A"z4 "G"z4 | "F#m"z4 "Em"z4 | "D"z4 "G"z4 | "D"z4 "Em"z4 | "D"z4 "G"z4 | "A"z4 "G"z4 |
[P:C] "Em"z8 | "D"z8 | "Em"z8 | "G"z8 | "D"z8 | "A"z8 | "Em"z8 | "Em"z8 |
V:organ1
[P:intro] z8 | z8 |
[P:A] !mp! e4 d4 | c4 B4 | A4 G4 | F4 E4 | D4 G4 | F4 B4 | A4 d4 | c4 B4 |
[P:B] e4 d4 | c4 B4 | A4 G4 | F4 E4 | c4 B4 | F4 G4 | E4 F4 | F4 B,4 |
[P:A2] e4 d4 | c4 B4 | A4 G4 | F4 E4 | D4 B4 | A4 G4 | A4 B4 | e4 B4 |
[P:C] B6 A2 | A8 | G6 F2 | G8 | F4 d4 | c4 A4 | G4 E4 | E8 |
V:organ2
[P:intro] !p! E,8 | E,8 |
[P:A] E,8 | E,8 | E4 D4 | C4 B,4 | A,4 G,4 | F,4 E,4 | D,4 G,4 | F,4 B,4 |
[P:B] E,8 | E,8 | E4 D4 | C4 B,4 | A,4 G,4 | F,4 E,4 | C4 B,4 | F,4 G,4 |
[P:A2] E,8 | E,8 | E4 D4 | C4 B,4 | A,4 G,4 | F,4 E,4 | D,4 B,4 | A,4 G,4 |
[P:C] E,8 | D,8 | E,8 | G,8 | D,8 | A,8 | E,8 | E,8 |
V:cello
[P:intro] z8 | z8 |
[P:A] z8 | z8 | z8 | z8 | z8 | z8 | z8 | z8 |
[P:B] z8 | z8 | z8 | z8 | z8 | z8 | z8 | z8 |
[P:A2] z8 | z8 | z8 | z8 | z8 | z8 | z8 | z8 |
[P:C] !mf! E8 | F8 | B,8 | G8 | F4 E4 | E8 | E8 | E8 |
V:bell
[P:intro] z8 | z8 |
[P:A] z8 | z8 | z8 | B,8 | z8 | z8 | z8 | E8 |
[P:B] z8 | z8 | z8 | B,8 | z8 | z8 | z8 | B,8 |
[P:A2] z8 | z8 | z8 | B,8 | z8 | z8 | z8 | E8 |
[P:C] z8 | z8 | z8 | z8 | z8 | z8 | z8 | E8 |
`,
  parts: {
    organ1: { inst: 'organ', role: 'lead', layers: ['base', 'phase2'], gain: -1, pan: 0.15 },
    organ2: { inst: 'organ', role: 'counter', layers: ['base', 'phase2'], gain: -4, pan: -0.2 },
    cello: { inst: 'cellos', art: 'vib', role: 'colour', layers: ['base', 'phase2'], gain: -4, pan: 0.05 },
    bell: { inst: 'tubular-bells', role: 'colour', layers: ['base', 'phase2'], gain: -10, pan: 0.35, lowpassHz: 2600 },
  },
  accomp: {
    bass: { inst: 'contrabass', art: 'sus', role: 'bass', pattern: 'bassRoot', layers: ['base', 'phase2'], octave: 2, gain: -7 },
    choir: { inst: 'choir', role: 'accomp', pattern: 'padSustain', layers: ['phase2'], octave: 3, gain: -11, pan: -0.1 },
    trem: { inst: 'cellos', art: 'trem', role: 'accomp', pattern: 'tremolo', layers: ['phase2'], octave: 3, gain: -16, pan: 0.2 },
  },
  perc: {
    grid: 16,
    lines: {
      heart: { inst: 'timpani', layers: ['base', 'phase2'], steps: 'X.......x.......', gain: -14, pitch: 'root' },
      rattle: { inst: 'rattle', layers: ['phase2'], steps: '..x...x...x...x.', gain: -13, pan: 0.3 },
      frame: { inst: 'frame-drum', layers: ['phase2'], steps: 'X.....x.X.....x.', gain: -12 },
    },
  },
  order: ['intro', 'A', 'B', 'A2', 'C'],
  loopFrom: 1,
  quotes: [
    { motif: 'vigil', part: 'organ1', section: 'A' },
    { motif: 'throne', part: 'cello', section: 'C' },
  ],
})

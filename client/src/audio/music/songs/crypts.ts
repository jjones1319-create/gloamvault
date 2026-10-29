/**
 * The Crypts (07 §2.2: "Dorian at 60 bpm; bowed double bass on long tones, bone-rattle and frame drum on the off-beats,
 * a wordless choir in whole-tone clusters that resolves only at rest rooms … tremolo harp in spider rooms"). E Dorian,
 * 4/4 at 60. A cello section sings a slow, sparse tune over a contrabass bowing one long tone a bar; the bone rattle
 * and a muted frame drum tick on the off-beats; the choir holds whole-tone clusters (D E F♯, G A B, A B C♯); no chord leaves the mode. In a rest
 * room the drums stop and the choir resolves into plain triads; in a spider room a harp tremolo shivers over it. The
 * cello states the Throne's leitmotif in the Crypts' mode in the C section (E F♯ B G). Original.
 */
import { defineSong } from '../song.ts'

export default defineSong({
  id: 'crypts',
  kind: 'explore',
  brief: 'The Crypts: very slow E Dorian, a cello tune over a bowed double bass, bone rattles and a muted drum on the off-beats, a wordless choir holding whole-tone clusters that only resolve in a rest room; a harp tremolo in spider rooms.',
  musicSend: 0.4,
  abc: `
X:1
M:4/4
L:1/8
Q:1/4=60
K:E dor
V:chords
[P:intro] "Em"z8 | "Em"z8 |
[P:A] "Em"z8 | "D"z8 | "A"z8 | "Bm"z8 | "Em"z8 | "G"z8 | "F#m"z8 | "Em"z8 |
[P:B] "G"z8 | "G"z8 | "D"z8 | "Em"z8 | "A"z8 | "A"z8 | "Bm"z8 | "Em"z8 |
[P:A2] "Em"z8 | "D"z8 | "A"z8 | "Bm"z8 | "Em"z8 | "G"z8 | "F#m"z8 | "Em"z8 |
[P:C] "Em"z8 | "D"z8 | "Em"z8 | "G"z8 | "D"z8 | "A"z8 | "Bm"z8 | "Em"z8 |
V:cello
[P:intro] z8 | z8 |
[P:A] !mp! B,4 E4 | F6 E2 | E4 G4 | F8 | G4 F2 E2 | D6 B,2 | C6 E2 | E8 |
[P:B] G4 A2 G2 | D6 E2 | A,4 D4 | E6 F2 | E4 C4 | A6 G2 | F4 D4 | E8 |
[P:A2] B,4 E4 | F6 E2 | E4 G4 | F8 | E2 F2 G4 | D8 | C4 B,4 | E4 B,4 |
[P:C] !mf! E8 | F8 | B,8 | G8 | !mp! F4 G4 | A6 G2 | D6 F2 | E8 |
V:bass
[P:intro] !mp! E,8 | E,8 |
[P:A] E,8 | D,8 | A,,8 | B,,8 | E,8 | G,,8 | F,,8 | E,8 |
[P:B] G,,8 | G,,8 | D,8 | E,8 | A,,8 | A,,8 | B,,8 | E,8 |
[P:A2] E,8 | D,8 | A,,8 | B,,8 | E,8 | G,,8 | F,,8 | E,8 |
[P:C] E,8 | D,8 | E,8 | G,,8 | D,8 | A,,8 | B,,8 | E,8 |
V:choir
[P:intro] !pp! [DEF]8 | [DEF]8 |
[P:A] [DEF]8 | [DEF]8 | [A,B,C]8 | [A,B,C]8 | [DEF]8 | [G,A,B,]8 | [A,B,C]8 | [DEF]8 |
[P:B] [G,A,B,]8 | [G,A,B,]8 | [DEF]8 | [DEF]8 | [A,B,C]8 | [A,B,C]8 | [A,B,C]8 | [DEF]8 |
[P:A2] [DEF]8 | [DEF]8 | [A,B,C]8 | [A,B,C]8 | [DEF]8 | [G,A,B,]8 | [A,B,C]8 | [DEF]8 |
[P:C] [DEF]8 | [DEF]8 | [DEF]8 | [G,A,B,]8 | [DEF]8 | [A,B,C]8 | [A,B,C]8 | [DEF]8 |
V:rest
[P:intro] !pp! [EGB]8 | [EGB]8 |
[P:A] [EGB]8 | [DFA]8 | [CEA]8 | [DFB]8 | [EGB]8 | [DGB]8 | [FAc]8 | [EGB]8 |
[P:B] [DGB]8 | [DGB]8 | [DFA]8 | [EGB]8 | [CEA]8 | [CEA]8 | [DFB]8 | [EGB]8 |
[P:A2] [EGB]8 | [DFA]8 | [CEA]8 | [DFB]8 | [EGB]8 | [DGB]8 | [FAc]8 | [EGB]8 |
[P:C] [EGB]8 | [DFA]8 | [EGB]8 | [DGB]8 | [DFA]8 | [CEA]8 | [DFB]8 | [EGB]8 |
`,
  parts: {
    cello: { inst: 'cellos', art: 'vib', role: 'lead', layers: ['main', 'rest'], gain: 0, pan: 0.05 },
    bass: { inst: 'contrabass', art: 'sus', role: 'bass', layers: ['main', 'rest'], gain: -5 },
    choir: { inst: 'choir', role: 'accomp', layers: ['main'], gain: -10, pan: -0.15 },
    rest: { inst: 'choir', role: 'accomp', layers: ['rest'], gain: -9, pan: -0.15 },
  },
  accomp: {
    shimmer: { inst: 'harp', role: 'accomp', pattern: 'shimmer', layers: ['spider'], octave: 4, gain: -15, pan: 0.35 },
  },
  perc: {
    grid: 16,
    lines: {
      rattle: { inst: 'rattle', layers: ['main'], steps: '..x.......x.....', gain: -13, pan: 0.3 },
      frame: { inst: 'frame-drum', art: 'muted', layers: ['main'], steps: '......x.......x.', gain: -13, pan: -0.2 },
    },
  },
  order: ['intro', 'A', 'B', 'A2', 'C'],
  loopFrom: 1,
  quotes: [{ motif: 'throne', part: 'cello', section: 'C' }],
})

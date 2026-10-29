/**
 * The Drowned Vault (07 §2.2: "Phrygian; tremolo strings under a submerged bell and a waterphone; the cult chant in
 * parallel fifths, wordless; 3/4 at 54 bpm"). E Phrygian, 3/4 at 54. Violin and cello tremolo hold the harmony over a
 * contrabass; a tubular bell rings through a lowpass as if from under the water; a waterphone drifts; the Tidebound's
 * wordless chant (E E F E D E) is sung by the choir with a second line a perfect fifth below, note for note. A cello
 * states the Throne's leitmotif in the Vault's own mode in the C section (E F B G: the half step and the tritone).
 * In a rest room the chant falls silent and the water, the bell and the strings remain. Original.
 */
import { defineSong } from '../song.ts'

export default defineSong({
  id: 'vault',
  kind: 'explore',
  brief: 'The Drowned Vault: a very slow E Phrygian 3/4, string tremolo under a bell heard through water and a drifting waterphone, a wordless chant sung in parallel fifths.',
  musicSend: 0.45,
  abc: `
X:1
M:3/4
L:1/8
Q:1/4=54
K:E phr
V:chords
[P:intro] "Em"z6 | "Em"z6 |
[P:A] "Em"z6 | "Dm"z6 | "Em"z6 | "F"z6 | "Em"z6 | "Dm"z6 | "F"z6 | "Em"z6 |
[P:B] "C"z6 | "Dm"z6 | "Em"z6 | "F"z6 | "Am"z6 | "Dm"z6 | "F"z6 | "Em"z6 |
[P:A2] "Em"z6 | "Dm"z6 | "Em"z6 | "F"z6 | "Em"z6 | "Dm"z6 | "F"z6 | "Em"z6 |
[P:C] "Em"z6 | "F"z6 | "Em"z6 | "C"z6 | "Am"z6 | "Dm"z6 | "F"z6 | "Em"z6 |
V:chant
[P:intro] z6 | z6 |
[P:A] !mp! E2 E2 F2 | E4 D2 | E2 B,4 | C4 F2 | G2 F2 E2 | D4 A,2 | C3 D E2 | E6 |
[P:B] G2 A2 G2 | F4 D2 | E2 F2 G2 | A4 G2 | E2 D2 C2 | D4 F2 | A3 G F2 | E6 |
[P:A2] E2 E2 F2 | E4 D2 | E2 B,4 | C4 F2 | E2 G2 B2 | A4 F2 | F3 E D2 | B,6 |
[P:C] z6 | z6 | z6 | z6 | E2 C2 A,2 | D4 F2 | F3 G A2 | G2 F2 E2 |
V:fifth
[P:intro] z6 | z6 |
[P:A] !mp! A,2 A,2 _B,2 | A,4 G,2 | A,2 E,4 | F,4 _B,2 | C2 _B,2 A,2 | G,4 D,2 | F,3 G, A,2 | A,6 |
[P:B] C2 D2 C2 | _B,4 G,2 | A,2 _B,2 C2 | D4 C2 | A,2 G,2 F,2 | G,4 _B,2 | D3 C _B,2 | A,6 |
[P:A2] A,2 A,2 _B,2 | A,4 G,2 | A,2 E,4 | F,4 _B,2 | A,2 C2 E2 | D4 _B,2 | _B,3 A, G,2 | E,6 |
[P:C] z6 | z6 | z6 | z6 | A,2 F,2 D,2 | G,4 _B,2 | _B,3 C D2 | C2 _B,2 A,2 |
V:cello
[P:intro] z6 | z6 |
[P:A] z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
[P:B] z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
[P:A2] z6 | z6 | z6 | z6 | z6 | z6 | z6 | z6 |
[P:C] !mf! E6 | F6 | B,6 | G6 | z6 | z6 | z6 | z6 |
V:bell
[P:intro] !mp! E6 | z6 |
[P:A] z6 | z6 | z6 | z6 | B,6 | z6 | z6 | z6 |
[P:B] z6 | z6 | E6 | z6 | z6 | z6 | z6 | z6 |
[P:A2] z6 | z6 | z6 | z6 | B,6 | z6 | z6 | z6 |
[P:C] E6 | z6 | B,6 | z6 | z6 | z6 | z6 | E6 |
V:water
[P:intro] z6 | !p! B6 |
[P:A] z6 | z6 | z6 | e6 | z6 | z6 | B6 | z6 |
[P:B] z6 | f6 | z6 | z6 | z6 | c6 | z6 | z6 |
[P:A2] z6 | z6 | z6 | e6 | z6 | z6 | B6 | z6 |
[P:C] z6 | z6 | z6 | z6 | z6 | f6 | z6 | B6 |
`,
  parts: {
    chant: { inst: 'choir', role: 'lead', layers: ['main'], gain: -2, pan: -0.1 },
    fifth: { inst: 'choir', role: 'colour', layers: ['main'], gain: -5, pan: 0.15 },
    cello: { inst: 'cellos', art: 'vib', role: 'colour', layers: ['main'], gain: -3, pan: 0.05 },
    bell: { inst: 'tubular-bells', role: 'colour', layers: ['main', 'rest'], gain: -9, pan: 0.3, lowpassHz: 900 },
    water: { inst: 'waterphone', role: 'colour', layers: ['main', 'rest'], gain: -12, pan: -0.35 },
  },
  accomp: {
    strings: { inst: 'violins', art: 'trem', role: 'accomp', pattern: 'padSustain', layers: ['main', 'rest'], octave: 4, gain: -18, pan: 0.2 },
    low: { inst: 'cellos', art: 'trem', role: 'accomp', pattern: 'drone', layers: ['main', 'rest'], octave: 2, gain: -15, pan: -0.2 },
    bass: { inst: 'contrabass', art: 'sus', role: 'bass', pattern: 'bassRoot', layers: ['main', 'rest'], octave: 2, gain: -9 },
  },
  order: ['intro', 'A', 'B', 'A2', 'C'],
  loopFrom: 1,
  quotes: [
    { motif: 'chant', part: 'chant', section: 'A' },
    { motif: 'throne', part: 'cello', section: 'C' },
  ],
})

/**
 * Sister Naesa (07 §2.2: the Vault's "3/4 at 54 bpm that turns 7/8 under Naesa"; the cult chant in parallel fifths,
 * wordless; tremolo strings under a submerged bell and a waterphone). E Phrygian, 7/8 grouped 2+2+3 on the Vault's
 * own eighth-note pulse (♪ = 108). The chant (E E F E D E) leads, sung in fifths; a frame drum and a timpani mark the
 * limping bar; tremolo strings, the drowned bell and the waterphone hang over it. `phase2` (her arms rise from the
 * water) adds a bass drum, a darbuka and spiccato violins. A cello states the Throne's leitmotif in the Vault's mode
 * in the C section — the boss theme every boss shares. Original.
 */
import { defineSong } from '../song.ts'

export default defineSong({
  id: 'naesa',
  kind: 'boss',
  brief: 'Sister Naesa: the Vault\'s wordless chant in parallel fifths, now limping in 7/8 (2+2+3) over a frame drum and timpani, tremolo strings, a bell under water and a waterphone; her second phase adds booming drums and driving strings.',
  musicSend: 0.42,
  abc: `
X:1
M:7/8
L:1/8
Q:1/8=108
K:E phr
V:chords
[P:intro] "Em"z7 | "Em"z7 |
[P:A] "Em"z7 | "Dm"z7 | "Em"z7 | "F"z7 | "Em"z7 | "Dm"z7 | "C"z7 | "Em"z7 |
[P:B] "F"z7 | "Em"z7 | "Dm"z7 | "Em"z7 | "C"z7 | "Dm"z7 | "F"z7 | "Em"z7 |
[P:A2] "Em"z7 | "Dm"z7 | "Em"z7 | "F"z7 | "Em"z7 | "Dm"z7 | "C"z7 | "Em"z7 |
[P:C] "Em"z7 | "F"z7 | "Em"z7 | "C"z7 | "Dm"z7 | "F"z7 | "Dm"z7 | "Em"z7 |
V:chant
[P:intro] z7 | z7 |
[P:A] !mf! E2 E2 F3 | E2 D2 E3 | G2 F2 E3 | F2 A2 c3 | B2 A2 G3 | F2 E2 D3 | E2 G2 c3 | B2 E5 |
[P:B] c2 c2 d3 | B2 A2 G3 | A2 G2 F3 | G2 A2 B3 | c2 B2 G3 | A2 F2 D3 | F2 G2 A3 | G2 E5 |
[P:A2] E2 E2 F3 | E2 D2 E3 | G2 F2 E3 | F2 A2 c3 | e2 d2 B3 | A2 F2 D3 | G2 E2 c3 | B2 E5 |
[P:C] z7 | z7 | z7 | z7 | D2 F2 A3 | A2 G2 F3 | F2 E2 D3 | E7 |
V:fifth
[P:intro] z7 | z7 |
[P:A] !mf! A,2 A,2 _B,3 | A,2 G,2 A,3 | C2 _B,2 A,3 | _B,2 D2 F3 | E2 D2 C3 | _B,2 A,2 G,3 | A,2 C2 F3 | E2 A,5 |
[P:B] F2 F2 G3 | E2 D2 C3 | D2 C2 _B,3 | C2 D2 E3 | F2 E2 C3 | D2 _B,2 G,3 | _B,2 C2 D3 | C2 A,5 |
[P:A2] A,2 A,2 _B,3 | A,2 G,2 A,3 | C2 _B,2 A,3 | _B,2 D2 F3 | A2 G2 E3 | D2 _B,2 G,3 | C2 A,2 F3 | E2 A,5 |
[P:C] z7 | z7 | z7 | z7 | G,2 _B,2 D3 | D2 C2 _B,3 | _B,2 A,2 G,3 | A,7 |
V:cello
[P:intro] z7 | z7 |
[P:A] z7 | z7 | z7 | z7 | z7 | z7 | z7 | z7 |
[P:B] z7 | z7 | z7 | z7 | z7 | z7 | z7 | z7 |
[P:A2] z7 | z7 | z7 | z7 | z7 | z7 | z7 | z7 |
[P:C] !mf! E7 | F7 | B,7 | G7 | z7 | z7 | z7 | z7 |
V:bell
[P:intro] !mp! E2 z5 | z7 |
[P:A] E2 z5 | z7 | z7 | z7 | B,2 z5 | z7 | z7 | z7 |
[P:B] z7 | z7 | E2 z5 | z7 | z7 | z7 | B,2 z5 | z7 |
[P:A2] E2 z5 | z7 | z7 | z7 | B,2 z5 | z7 | z7 | z7 |
[P:C] E2 z5 | z7 | B,2 z5 | z7 | z7 | z7 | z7 | E2 z5 |
V:water
[P:intro] z7 | !p! B7 |
[P:A] z7 | z7 | e7 | z7 | z7 | c7 | z7 | z7 |
[P:B] z7 | f7 | z7 | z7 | z7 | z7 | B7 | z7 |
[P:A2] z7 | z7 | e7 | z7 | z7 | c7 | z7 | z7 |
[P:C] z7 | z7 | z7 | z7 | z7 | f7 | z7 | B7 |
`,
  parts: {
    chant: { inst: 'choir', role: 'lead', layers: ['base', 'phase2'], gain: 0, pan: -0.1 },
    fifth: { inst: 'choir', role: 'colour', layers: ['base', 'phase2'], gain: -4, pan: 0.15 },
    cello: { inst: 'cellos', art: 'vib', role: 'colour', layers: ['base', 'phase2'], gain: -3 },
    bell: { inst: 'tubular-bells', role: 'colour', layers: ['base', 'phase2'], gain: -9, pan: 0.3, lowpassHz: 900 },
    water: { inst: 'waterphone', role: 'colour', layers: ['base', 'phase2'], gain: -12, pan: -0.35 },
  },
  accomp: {
    strings: { inst: 'violins', art: 'trem', role: 'accomp', pattern: 'padSustain', layers: ['base', 'phase2'], octave: 4, gain: -18, pan: 0.2 },
    low: { inst: 'cellos', art: 'trem', role: 'accomp', pattern: 'drone', layers: ['base', 'phase2'], octave: 2, gain: -15, pan: -0.2 },
    bass: { inst: 'contrabass', art: 'sus', role: 'bass', pattern: 'bassRoot', layers: ['base', 'phase2'], octave: 2, gain: -9 },
    pulse: { inst: 'violins', art: 'spic', role: 'accomp', pattern: 'pulse', layers: ['phase2'], octave: 4, gain: -17, pan: 0.25 },
  },
  perc: {
    grid: 14,
    lines: {
      frame: { inst: 'frame-drum', layers: ['base', 'phase2'], steps: 'X...x...x.....', gain: -11 },
      timp: { inst: 'timpani', layers: ['base', 'phase2'], steps: 'X.............', gain: -14, pitch: 'root' },
      boom: { inst: 'bass-drum', layers: ['phase2'], steps: 'X.......x.....', gain: -11 },
      darbuka: { inst: 'darbuka', layers: ['phase2'], steps: 'x.x.x.x.x.x.x.', gain: -17, pan: 0.25 },
    },
  },
  order: ['intro', 'A', 'B', 'A2', 'C'],
  loopFrom: 1,
  quotes: [
    { motif: 'chant', part: 'chant', section: 'A' },
    { motif: 'throne', part: 'cello', section: 'C' },
  ],
})

/**
 * The interrupting stingers (Phase 8; the mechanism is Wildsong Ranch's, SOUND_UPGRADE §4.7 there). Each is 1.5–10 s,
 * written in C and moved to the area piece's tonic when it plays; the area music fades out over 150 ms before it and
 * comes back at its next section after it (several play as a chain: a victory, then a level-up). All original.
 */
import { defineSong, type Song } from './song.ts'

export const STINGER_IDS = ['victory', 'bossVictory', 'defeat', 'levelUp', 'rareDrop', 'bossPhase'] as const
export type StingerId = (typeof STINGER_IDS)[number]

/** A won fight: four seconds of relief — violins rise over a harp, a frame drum and a timpani stroke. */
const victory = defineSong({
  id: 'victory',
  kind: 'stinger',
  brief: 'A fight won: a short, warm rising phrase on violins over a harp, one drum and a timpani stroke. Relief, not triumph.',
  musicSend: 0.3,
  abc: `
X:1
M:4/4
L:1/8
Q:1/4=104
K:C
V:chords
[P:A] "C"z4 "F"z4 | "G"z4 "C"z4 |
V:lead
[P:A] !mf! G2 c2 e3 d | e2 d2 c4 |
`,
  parts: { lead: { inst: 'violins', art: 'vib', role: 'lead', layers: ['main'], gain: 0, pan: 0.1 } },
  accomp: {
    harp: { inst: 'harp', role: 'accomp', pattern: 'harpArp', layers: ['main'], octave: 3, gain: -9, pan: -0.2 },
    pad: { inst: 'violas', art: 'vib', role: 'accomp', pattern: 'padSustain', layers: ['main'], octave: 3, gain: -15 },
  },
  perc: { grid: 16, lines: { drum: { inst: 'frame-drum', layers: ['main'], steps: 'X.......x....... | X...............', gain: -8 }, timp: { inst: 'timpani', layers: ['main'], steps: 'X............... | ................', gain: -10, pitch: 'root' } } },
  order: ['A'],
  loopFrom: 0,
})

/** A boss beaten: nine seconds — violins climb to a high C over the horn, a choir, timpani and a cymbal swell. */
const bossVictory = defineSong({
  id: 'bossVictory',
  kind: 'stinger',
  brief: 'A boss beaten: a broad nine-second anthem, violins climbing to a high C over a horn line, the choir and harp, timpani strokes and one cymbal swell into the last chord.',
  musicSend: 0.35,
  abc: `
X:1
M:4/4
L:1/8
Q:1/4=108
K:C
V:chords
[P:A] "C"z8 | "F"z4 "G"z4 | "Am"z4 "F"z4 | "C"z8 |
V:lead
[P:A] !f! e2 g2 c'4 | b2 a2 g2 f2 | e2 f2 a2 b2 | c'8 |
V:horn
[P:A] !mf! C4 E4 | A,4 B,2 z2 | C4 A,4 | C8 |
`,
  parts: {
    lead: { inst: 'violins', art: 'vib', role: 'lead', layers: ['main'], gain: 0, pan: 0.1 },
    horn: { inst: 'horn', role: 'counter', layers: ['main'], gain: -4, pan: -0.2 },
  },
  accomp: {
    choir: { inst: 'choir', role: 'accomp', pattern: 'padSustain', layers: ['main'], octave: 3, gain: -11 },
    harp: { inst: 'harp', role: 'accomp', pattern: 'harpArp', layers: ['main'], octave: 3, gain: -10, pan: -0.25 },
  },
  perc: {
    grid: 16,
    lines: {
      timp: { inst: 'timpani', layers: ['main'], steps: 'X.......X....... | X...X...X...X... | X.......X....... | X...............', gain: -9, pitch: 'root' },
      swell: { inst: 'cymbal-swell', layers: ['main'], steps: '................ | ................ | X............... | ................', gain: -15 },
    },
  },
  order: ['A'],
  loopFrom: 0,
})

/** The party has fallen: eight slow seconds in C minor — the cellos sink under an organ, a timpani tolls twice. */
const defeat = defineSong({
  id: 'defeat',
  kind: 'stinger',
  brief: 'The party has fallen: a slow sinking phrase on cellos in C minor over an organ and a low bass, two timpani tolls. A fall and a fade, no gloating.',
  musicSend: 0.45,
  abc: `
X:1
M:4/4
L:1/8
Q:1/4=60
K:C min
V:chords
[P:A] "Cm"z8 | "Fm"z4 "Cm"z4 |
V:lead
[P:A] !mp! G,4 E,4 | F,4 C,4 |
`,
  parts: { lead: { inst: 'cellos', art: 'vib', role: 'lead', layers: ['main'], gain: 0 } },
  accomp: {
    organ: { inst: 'organ', role: 'accomp', pattern: 'padSustain', layers: ['main'], octave: 3, gain: -12 },
    bass: { inst: 'contrabass', art: 'sus', role: 'bass', pattern: 'bassRoot', layers: ['main'], octave: 2, gain: -9 },
  },
  perc: { grid: 16, lines: { timp: { inst: 'timpani', layers: ['main'], steps: 'X............... | X...............', gain: -11, pitch: 'root' } } },
  order: ['A'],
  loopFrom: 0,
})

/** A level up: three seconds — the harp runs up the chord, a bell answers. */
const levelUp = defineSong({
  id: 'levelUp',
  kind: 'stinger',
  brief: 'A level up: the harp runs up the chord to a high note and a bell answers, over a soft string chord. Bright and short.',
  musicSend: 0.3,
  abc: `
X:1
M:3/4
L:1/8
Q:1/4=132
K:C
V:chords
[P:A] "C"z6 | "C"z6 |
V:lead
[P:A] !mf! c2 e2 g2 | c'4 z2 |
V:bell
[P:A] !mp! z6 | c4 z2 |
`,
  parts: {
    lead: { inst: 'harp', role: 'lead', layers: ['main'], gain: 2, pan: 0.1 },
    bell: { inst: 'tubular-bells', role: 'colour', layers: ['main'], gain: -8, pan: -0.25 },
  },
  accomp: { pad: { inst: 'violins', art: 'vib', role: 'accomp', pattern: 'padSustain', layers: ['main'], octave: 4, gain: -16 } },
  order: ['A'],
  loopFrom: 0,
})

/** A rare find (an A-grade item or better, a Divine Shard): a falling harp sparkle and a held glass note. */
const rareDrop = defineSong({
  id: 'rareDrop',
  kind: 'stinger',
  brief: 'A rare find: a harp sparkle falling from high up, a wine glass ringing over it and a soft bell. Wonder, quietly.',
  musicSend: 0.4,
  abc: `
X:1
M:3/4
L:1/8
Q:1/4=100
K:C
V:chords
[P:A] "C"z6 | "C"z6 |
V:lead
[P:A] !mf! e'2 c'2 g2 | c'4 z2 |
V:glass
[P:A] !p! z2 c'4 | c'4 z2 |
V:bell
[P:A] !mp! c6 | z6 |
`,
  parts: {
    lead: { inst: 'harp', role: 'lead', layers: ['main'], gain: 1, pan: 0.15 },
    glass: { inst: 'wine-glasses', role: 'colour', layers: ['main'], gain: -10, pan: -0.25 },
    bell: { inst: 'tubular-bells', role: 'colour', layers: ['main'], gain: -12 },
  },
  order: ['A'],
  loopFrom: 0,
})

/** A boss's new phase: three seconds of dread — a low organ chord, a timpani roll, a bass drum and a cymbal swell. */
const bossPhase = defineSong({
  id: 'bossPhase',
  kind: 'stinger',
  brief: 'A boss changes: one bar of dread, a low organ chord swelling over a timpani roll, a bass-drum hit and a cymbal swell, before the boss music comes back harder.',
  musicSend: 0.35,
  abc: `
X:1
M:4/4
L:1/8
Q:1/4=80
K:C min
V:chords
[P:A] "Cm"z8 |
V:organ
[P:A] !f! [C,G,C]8 |
V:horn
[P:A] !mf! C,8 |
`,
  parts: {
    organ: { inst: 'organ', role: 'accomp', layers: ['main'], gain: -4 },
    horn: { inst: 'horn', role: 'colour', layers: ['main'], gain: -6 },
  },
  perc: {
    grid: 16,
    lines: {
      roll: { inst: 'timpani', layers: ['main'], steps: 'ooooxxxxxxxxXXXX', gain: -10, pitch: 'root' },
      drum: { inst: 'bass-drum', layers: ['main'], steps: 'X...............', gain: -6 },
      swell: { inst: 'cymbal-swell', layers: ['main'], steps: 'X...............', gain: -12 },
    },
  },
  order: ['A'],
  loopFrom: 0,
})

export const STINGERS: Record<StingerId, Song> = { victory, bossVictory, defeat, levelUp, rareDrop, bossPhase }

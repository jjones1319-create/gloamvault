/**
 * `node tools/content/gen-wayfarers.ts` — writes content/wayfarers/<id>.json from the cast table below, the
 * transcription of docs/04-CLASSES.md §7 (the owner, D-091). Re-runnable and idempotent: edit the table (or the doc
 * and then the table), never the generated JSON.
 *
 * The Segment 1 cast: eighteen named wayfarers, three per class across the six species (each species three times),
 * graded D (6) · C (6) · B (4) · A (2). Creation points are 6 + 1 per grade above D, at most 3 on one attribute
 * (03 §2.3). An AI rule of null means the class's default rule; a wayfarer whose three skills differ from the
 * class's starter picks carries a rule that uses them (the grammar is sim/src/ai.ts). Each carries a look fitted to their
 * bio (Phase 5): the frame by the name (broad for the men, slight for the women), a skin tone and face preset of the
 * species, and a hair colour from the species' palette, ordered dark to light (the last is grey or silver).
 */
import fs from 'node:fs'
import path from 'node:path'
import { isMain, REPO_ROOT } from './gen-class-lib.ts'

type Attribute = 'strength' | 'agility' | 'vitality' | 'endurance' | 'wisdom' | 'perception' | 'willpower' | 'luck'

interface Row {
  id: string
  name: string
  speciesId: string
  classId: string
  grade: 'D' | 'C' | 'B' | 'A'
  freePoints: Partial<Record<Attribute, number>>
  starterSkillIds: [string, string, string]
  aiRule: string | null
  bio: string
  /** How they look, fitted to the bio (Phase 5): frame, skin tone and face preset of the species, hair colour. */
  look: { frame: 'broad' | 'slight'; skin: number; face: number; hair: number }
}

const POTION = 'IF self HP < 30% THEN item small hp potion on self'

export const CAST: readonly Row[] = [
  // Warden
  {
    id: 'bram-ostler',
    name: 'Bram Ostler',
    speciesId: 'human',
    classId: 'warden',
    grade: 'D',
    freePoints: { endurance: 3, vitality: 2, strength: 1 },
    starterSkillIds: ['warden-shield-slam', 'warden-provoke', 'warden-brace'],
    aiRule: null,
    bio: 'A stablehand who once held a gate against wolves and never quite stopped standing in doorways.',
    look: { frame: 'broad', skin: 1, face: 0, hair: 2 },
  },
  {
    id: 'murza-kettlebrand',
    name: 'Murza Kettlebrand',
    speciesId: 'orc',
    classId: 'warden',
    grade: 'C',
    freePoints: { strength: 3, vitality: 2, endurance: 2 },
    starterSkillIds: ['warden-shield-slam', 'warden-provoke', 'warden-rallying-shout'],
    aiRule: `${POTION}; IF ally HP < 40% THEN rallying shout; IF allies count > 1 AND ally HP < 60% THEN provoke; ELSE shield slam front enemy`,
    bio: 'Carries a grandmother\'s dented shield and every grudge it ever earned.',
    look: { frame: 'slight', skin: 0, face: 1, hair: 0 },
  },
  {
    id: 'hilde-stonevow',
    name: 'Hilde Stonevow',
    speciesId: 'dwarf',
    classId: 'warden',
    grade: 'A',
    freePoints: { endurance: 3, vitality: 3, willpower: 3 },
    starterSkillIds: ['warden-shield-slam', 'warden-counter-stance', 'warden-wall-stance'],
    aiRule: `${POTION}; IF self HP < 70% THEN counter stance; ELSE shield slam front enemy`,
    bio: 'Swore to hold the Keep\'s lower gate. The Keep fell; the vow did not.',
    look: { frame: 'slight', skin: 0, face: 2, hair: 5 },
  },
  // Blade
  {
    id: 'rokk-halfmoon',
    name: 'Rokk Halfmoon',
    speciesId: 'orc',
    classId: 'blade',
    grade: 'D',
    freePoints: { strength: 3, vitality: 2, agility: 1 },
    starterSkillIds: ['blade-twin-cut', 'blade-reckless-swing', 'blade-red-thirst'],
    aiRule: `${POTION}; IF self HP > 60% THEN reckless swing on front enemy; ELSE twin cut on weakest enemy`,
    bio: 'Fights with two blades because the first one kept getting stuck in things.',
    look: { frame: 'broad', skin: 2, face: 0, hair: 0 },
  },
  {
    id: 'saphrel-vey',
    name: 'Saphrel Vey',
    speciesId: 'draconid',
    classId: 'blade',
    grade: 'C',
    freePoints: { agility: 3, strength: 2, perception: 2 },
    starterSkillIds: ['blade-twin-cut', 'blade-open-vein', 'blade-flowing-guard'],
    aiRule: null,
    bio: 'A duelist from the ash-coasts who counts scars the way merchants count coins.',
    look: { frame: 'slight', skin: 0, face: 1, hair: 1 },
  },
  {
    id: 'ilvane-thorne',
    name: 'Ilvane Thorne',
    speciesId: 'elf',
    classId: 'blade',
    grade: 'B',
    freePoints: { agility: 3, perception: 3, strength: 2 },
    starterSkillIds: ['blade-twin-cut', 'blade-quickstep', 'blade-headsmans-eye'],
    aiRule: `${POTION}; IF enemies count > 2 THEN quickstep; ELSE twin cut on weakest enemy`,
    bio: 'Moves like a falling leaf and cuts like the wind that drops it.',
    look: { frame: 'slight', skin: 1, face: 0, hair: 4 },
  },
  // Ranger
  {
    id: 'pip-marrowby',
    name: 'Pip Marrowby',
    speciesId: 'halfling',
    classId: 'ranger',
    grade: 'D',
    freePoints: { perception: 3, agility: 2, luck: 1 },
    starterSkillIds: ['ranger-aimed-shot', 'ranger-hunters-mark', 'ranger-keen-eyes'],
    aiRule: null,
    bio: 'Can hit a rat at forty paces, and will tell you about it all the way home.',
    look: { frame: 'broad', skin: 1, face: 2, hair: 2 },
  },
  {
    id: 'sereth-moss',
    name: 'Sereth Moss',
    speciesId: 'elf',
    classId: 'ranger',
    grade: 'C',
    freePoints: { perception: 3, agility: 3, wisdom: 1 },
    starterSkillIds: ['ranger-aimed-shot', 'ranger-snare', 'ranger-steady-draw'],
    aiRule: `${POTION}; IF self HP < 60% THEN snare on front enemy; ELSE aimed shot on weakest enemy`,
    bio: 'Reads tracks the way scholars read books, and trusts them more.',
    look: { frame: 'broad', skin: 2, face: 1, hair: 1 },
  },
  {
    id: 'edric-ashdown',
    name: 'Edric Ashdown',
    speciesId: 'human',
    classId: 'ranger',
    grade: 'B',
    freePoints: { perception: 3, agility: 2, endurance: 2, wisdom: 1 },
    starterSkillIds: ['ranger-aimed-shot', 'ranger-caltrop-toss', 'ranger-hunters-mark'],
    aiRule: `${POTION}; IF enemies count > 2 THEN caltrop toss; IF enemy status mark THEN aimed shot on marked enemy; ELSE hunters mark on strongest enemy`,
    bio: 'A poacher turned bounty-tracker: the Keep\'s rats pay better than the lord\'s deer ever did.',
    look: { frame: 'broad', skin: 0, face: 2, hair: 3 },
  },
  // Shade
  {
    id: 'lirien-quill',
    name: 'Lirien Quill',
    speciesId: 'elf',
    classId: 'shade',
    grade: 'D',
    freePoints: { agility: 3, luck: 2, perception: 1 },
    starterSkillIds: ['shade-backstab', 'shade-pickpocket', 'shade-light-fingers'],
    aiRule: `${POTION}; IF enemies count > 1 THEN pickpocket on strongest enemy; ELSE backstab on weakest enemy`,
    bio: 'Picks locks to stay in practice and pockets to stay in bread.',
    look: { frame: 'slight', skin: 0, face: 2, hair: 0 },
  },
  {
    id: 'tansy-brightfinger',
    name: 'Tansy Brightfinger',
    speciesId: 'halfling',
    classId: 'shade',
    grade: 'C',
    freePoints: { agility: 3, luck: 2, perception: 2 },
    starterSkillIds: ['shade-veil', 'shade-backstab', 'shade-toxic-jab'],
    aiRule: null,
    bio: 'Nobody watches the halfling. That is the whole trick.',
    look: { frame: 'slight', skin: 0, face: 0, hair: 4 },
  },
  {
    id: 'vesk-umber',
    name: 'Vesk Umber',
    speciesId: 'draconid',
    classId: 'shade',
    grade: 'B',
    freePoints: { agility: 3, endurance: 2, perception: 2, willpower: 1 },
    starterSkillIds: ['shade-toxic-jab', 'shade-crippling-dust', 'shade-steeped-blades'],
    aiRule: `${POTION}; IF enemies count > 2 THEN crippling dust; ELSE toxic jab on strongest enemy`,
    bio: 'Smoke-scaled and silent; a cult in the deep Vault still keeps a price on that head.',
    look: { frame: 'broad', skin: 2, face: 0, hair: 2 },
  },
  // Arcanist
  {
    id: 'orla-cinderhelm',
    name: 'Orla Cinderhelm',
    speciesId: 'dwarf',
    classId: 'arcanist',
    grade: 'D',
    freePoints: { wisdom: 3, willpower: 2, vitality: 1 },
    starterSkillIds: ['arcanist-ember-lance', 'arcanist-spark', 'arcanist-kindling'],
    aiRule: `${POTION}; IF enemies count > 2 THEN spark on weakest enemy; ELSE ember lance on weakest enemy`,
    bio: 'Learned fire at the forge before learning it from books, and still prefers the forge.',
    look: { frame: 'slight', skin: 1, face: 1, hair: 3 },
  },
  {
    id: 'aldous-fenwick',
    name: 'Aldous Fenwick',
    speciesId: 'human',
    classId: 'arcanist',
    grade: 'C',
    freePoints: { wisdom: 3, perception: 2, willpower: 2 },
    starterSkillIds: ['arcanist-frostbolt', 'arcanist-frost-floor', 'arcanist-shatter'],
    aiRule: `${POTION}; IF enemies count > 2 THEN frost floor; ELSE frostbolt on strongest enemy`,
    bio: 'A failed tutor with three unpaid debts and one very good frost spell.',
    look: { frame: 'broad', skin: 0, face: 1, hair: 5 },
  },
  {
    id: 'wrenna-mapple',
    name: 'Wrenna Mapple',
    speciesId: 'halfling',
    classId: 'arcanist',
    grade: 'A',
    freePoints: { wisdom: 3, willpower: 3, luck: 3 },
    starterSkillIds: ['arcanist-ember-lance', 'arcanist-arcane-ward', 'arcanist-quicken'],
    aiRule: null,
    bio: 'The smallest scholar of the Ember Academy, and the only one who came back from the Crypts.',
    look: { frame: 'slight', skin: 2, face: 1, hair: 1 },
  },
  // Mender
  {
    id: 'varra-dawnscale',
    name: 'Varra Dawnscale',
    speciesId: 'draconid',
    classId: 'mender',
    grade: 'D',
    freePoints: { wisdom: 3, willpower: 2, vitality: 1 },
    starterSkillIds: ['mender-mend', 'mender-smite', 'mender-gentle-hands'],
    aiRule: null,
    bio: 'Keeps a candle lit for every patient lost, and has not run out of candles yet.',
    look: { frame: 'slight', skin: 1, face: 2, hair: 4 },
  },
  {
    id: 'bruni-hearthward',
    name: 'Bruni Hearthward',
    speciesId: 'dwarf',
    classId: 'mender',
    grade: 'C',
    freePoints: { wisdom: 3, vitality: 2, willpower: 2 },
    starterSkillIds: ['mender-mend', 'mender-soothing-word', 'mender-blessing'],
    aiRule: `${POTION}; IF ally HP < 50% THEN mend on lowest ally; IF ally HP < 75% THEN soothing word on lowest ally; ELSE attack front enemy`,
    bio: 'Sets bones, patches heads and makes a stew that has raised at least one man from the dead, he says.',
    look: { frame: 'broad', skin: 0, face: 0, hair: 2 },
  },
  {
    id: 'uldra-greythorn',
    name: 'Uldra Greythorn',
    speciesId: 'orc',
    classId: 'mender',
    grade: 'B',
    freePoints: { wisdom: 3, strength: 2, willpower: 2, vitality: 1 },
    starterSkillIds: ['mender-smite', 'mender-radiance', 'mender-mend'],
    aiRule: `${POTION}; IF ally HP < 50% THEN mend on lowest ally; IF enemies count > 2 THEN radiance; ELSE smite front enemy`,
    bio: 'Traded the war-drum for the prayer-bell, and hits just as hard with either.',
    look: { frame: 'slight', skin: 1, face: 2, hair: 4 },
  },
]

if (isMain(import.meta.url)) {
  const dir = path.join(REPO_ROOT, 'content', 'wayfarers')
  fs.mkdirSync(dir, { recursive: true })
  const keep = new Set(CAST.map((r) => `${r.id}.json`))
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.json') && !keep.has(f)) fs.rmSync(path.join(dir, f))
  for (const r of CAST) fs.writeFileSync(path.join(dir, `${r.id}.json`), JSON.stringify(r, null, 2) + '\n')
  console.log(`wrote ${CAST.length} wayfarers to content/wayfarers/`)
}

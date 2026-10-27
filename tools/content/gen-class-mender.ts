/**
 * tools/content/gen-class-mender.ts — writes content/classes/mender.json and content/skills/mender/*.json
 * from docs/classes/mender.md (§2 numbers, §3 the Ultimate, §4.1–§4.3 the three school tables, §5 affinities).
 *
 * Phase 3 (12-ROADMAP): Tiers I–III of every school (27 skills) plus the Ultimate. Tiers IV–V are not written yet.
 * Every number is the sheet's; where a line cannot be said in the effect DSL it is a `custom` line whose `note`
 * states the hook's contract (content/README.md rule 31 wants a handler per customId in sim/src/skills/custom/).
 * Heals are `heal` by percent of the target's max HP with `scalesWith: wisdom` — D-062's +2% per point above 10 is
 * exactly the sheet's healing power (1 + 2% × (Wisdom − 10)). Cleanses are `dispel` on allies with `amount` as the
 * count; a named status is `removeStatus`. Holy spells hit either row (03 §3.3), so they carry the `reach` tag.
 *
 * Re-runnable: the same tables write the same files. Run: node tools/content/gen-class-mender.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CLASS_ID = 'mender'
const RANK_SCALING = { effectPerRank: 4, costPerRank: -2 }

type Json = Record<string, unknown>
type Effect = Json & { kind: string }

interface SkillSpec {
  id: string
  school: 'benediction' | 'sanctity' | 'vigil'
  tier: 1 | 2 | 3
  name: string
  description: string
  type?: 'active' | 'passive'
  cost?: number
  weight?: 800 | 1000 | 1400
  target?: string
  effects: Effect[]
  prerequisiteId: string | null
  isUltimate?: boolean
  requirements?: Json
  mastery: { text: string; effects: Effect[] }
  tags: string[]
  xpTags: string[]
  ai: { role: string; priority: number }
}

const NO_MASTERY_TEXT = 'No Mastery line beyond rank scaling: the sheet names none for the Ultimate.'

/** A heal by percent of the target's max HP × healing power (+2% per Wisdom point above 10, via scalesWith). */
function heal(percent: number, extra: Json = {}): Effect {
  return { kind: 'heal', percent, scalesWith: 'wisdom', ...extra }
}

// ---------------------------------------------------------------------------------------------------------------
// The class record (§1, §2, §5, §9)

const classRecord: Json = {
  id: CLASS_ID,
  name: 'Mender',
  role: 'healer / priest: sustain, cleanses, the earliest in-combat revive',
  description:
    'A censer, a holy symbol and the party’s second chance. The Mender heals by the target’s size, cleanses anything, revives mid-fight from level 5, and in the Crypts is a striker, because Holy is what the Restless Dead fear.',
  attributeMods: { wisdom: 2, willpower: 1, vitality: 1 },
  pool: 'mana',
  armorFamily: 'robes',
  weaponTypes: ['censer', 'mace', 'focus', 'staff'],
  schools: [
    { id: 'benediction', name: 'Benediction', philosophy: 'Keep them standing. Heals that scale with the target, a Regen that outlasts the fight, a Shield for the one about to be hit, and the revive.' },
    { id: 'sanctity', name: 'Sanctity', philosophy: 'Holy damage, Smite, wards and Fear. Holy hits either row and hits Undead and Shadow twice as hard; the wards make the front row safe.' },
    { id: 'vigil', name: 'Vigil', philosophy: 'Cleanse, steady, gift. The school that makes the other six classes better: debuffs come off, Fortify goes on, Momentum changes hands, and the lantern keeps the Dark away.' },
  ],
  ultimateSkillId: 'mender-dawnbreak',
  starterKit: [
    'copper-censer',
    'copper-holy-symbol',
    'burlap-cowl',
    'burlap-robe',
    'burlap-leggings',
    'burlap-slippers',
    'burlap-wraps',
    'ring-of-the-well',
    'small-hp-potion',
    'torch',
    'repair-kit',
    'bandage',
  ],
  starterSkillIds: ['mender-mend', 'mender-smite', 'mender-cleanse'],
  fieldSkillAffinities: [
    { fieldSkill: 'firstAid', rankBonus: 2 },
    { fieldSkill: 'cooking', rankBonus: 2 },
  ],
  monsterTechniqueIds: [],
  aiRuleDefault: 'IF self HP < 30% THEN item small hp potion on self; IF ally HP < 50% THEN mend on lowest ally; ELSE smite front enemy',
  visual: {
    gearSetId: 'mender-burlap-robes',
    palette: ['#f1ead8', '#6b1f24', '#e3c46a', '#b8bcc4'],
    notes:
      'A broad, grounded column: a long robe under a knee-length tabard carrying the sunburst, the censer swung low on its chain or the holy symbol raised to put a point of light at shoulder height. The tabard and the low mace keep it apart from the Arcanist at 200px.',
  },
  pros: [
    'Sustain: Mend heals 18% of max HP for 10 Mana at light weight; Circle of Mending heals the whole party',
    'The earliest in-combat revive: Breath of Life at Tier II, level 5',
    'Cleanses everything and hands out Momentum; Holy does about 2× against Undead',
  ],
  cons: [
    'Low damage outside Holy targets: Smite on a living bandit is 1.4× of a healer’s spell Attack',
    'Mana-hungry: a full-party emergency is most of a level-7 pool in three turns',
    'Robes and Blunt only: the healer is the target the moment the front row falls',
  ],
}

// ---------------------------------------------------------------------------------------------------------------
// §4.1 Benediction — keep them standing

const benediction: SkillSpec[] = [
  {
    id: 'mender-mend',
    school: 'benediction',
    tier: 1,
    name: 'Mend',
    description: 'Heal one ally for 18% of their max HP (× your healing power).',
    cost: 10,
    weight: 800,
    target: 'ally',
    effects: [heal(18)],
    prerequisiteId: null,
    mastery: { text: 'Heal 22%.', effects: [heal(22)] },
    tags: ['singleTarget', 'heal'],
    xpTags: ['wisdom'],
    ai: { role: 'heal', priority: 70 },
  },
  {
    id: 'mender-soothing-word',
    school: 'benediction',
    tier: 1,
    name: 'Soothing Word',
    description: 'One ally gains Regen for 3 turns (5% of max HP per turn).',
    cost: 12,
    weight: 1000,
    target: 'ally',
    effects: [{ kind: 'applyStatus', status: 'regen', duration: 3, percent: 5, note: 'the Tier I Regen magnitude (03 §3.5)' }],
    prerequisiteId: null,
    mastery: { text: 'Regen 4 turns.', effects: [{ kind: 'applyStatus', status: 'regen', duration: 4, percent: 5 }] },
    tags: ['singleTarget', 'heal'],
    xpTags: ['wisdom'],
    ai: { role: 'heal', priority: 50 },
  },
  {
    id: 'mender-gentle-hands',
    school: 'benediction',
    tier: 1,
    name: 'Gentle Hands',
    description: 'Your heals are +8%; a heal on an ally below 30% HP costs half.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'healing-done-percent', percent: 8, target: 'self', note: 'the holder’s heals are +percent%' },
      { kind: 'custom', customId: 'heal-cost-half-below-hp', percent: 30, target: 'self', note: 'a heal the holder casts on an ally below percent% HP costs half' },
    ],
    prerequisiteId: null,
    mastery: { text: 'Heals +12%.', effects: [{ kind: 'custom', customId: 'healing-done-percent', percent: 12, target: 'self' }] },
    tags: ['heal', 'buff'],
    xpTags: ['wisdom'],
    ai: { role: 'heal', priority: 0 },
  },
  {
    id: 'mender-circle-of-mending',
    school: 'benediction',
    tier: 2,
    name: 'Circle of Mending',
    description: 'Heal every ally and pet for 14% of their max HP. Heavy cast: declared at 1,000 energy, resolves 400 later, and a hit in the window can cancel it.',
    cost: 20,
    weight: 1400,
    target: 'allAllies',
    effects: [heal(14)],
    prerequisiteId: 'mender-mend',
    mastery: { text: 'Heal 17% each.', effects: [heal(17)] },
    tags: ['aoe', 'heal'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'heal', priority: 65 },
  },
  {
    id: 'mender-breath-of-life',
    school: 'benediction',
    tier: 2,
    name: 'Breath of Life',
    description: 'Revive a downed ally at 30% HP within the 3-turn window; the floor’s revive budget is not spent. Heavy cast.',
    cost: 20,
    weight: 1400,
    target: 'downedAlly',
    effects: [{ kind: 'revive', percent: 30, note: 'in-fight revive within the window (03 §12.1); spends no floor revive budget' }],
    prerequisiteId: 'mender-soothing-word',
    mastery: { text: 'Revive at 40% HP.', effects: [{ kind: 'revive', percent: 40 }] },
    tags: ['singleTarget', 'revive'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'heal', priority: 90 },
  },
  {
    id: 'mender-overflow',
    school: 'benediction',
    tier: 2,
    name: 'Overflow',
    description: 'Healing beyond max HP becomes a Shield on the target, up to 15% of their max HP, lasting 2 turns.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'overheal-to-shield', percent: 15, duration: 2, target: 'self', note: 'healing by the holder beyond the target’s max HP becomes a Shield on the target, capped at percent% of its max HP, for `duration` turns' },
    ],
    prerequisiteId: 'mender-gentle-hands',
    mastery: { text: 'Up to 25%.', effects: [{ kind: 'custom', customId: 'overheal-to-shield', percent: 25, duration: 2, target: 'self' }] },
    tags: ['heal', 'shield'],
    xpTags: ['wisdom'],
    ai: { role: 'heal', priority: 0 },
  },
  {
    id: 'mender-blessed-rain',
    school: 'benediction',
    tier: 3,
    name: 'Blessed Rain',
    description: 'Heal every ally and pet for 30% of their max HP and cleanse 1 debuff from each. Heavy cast.',
    cost: 28,
    weight: 1400,
    target: 'allAllies',
    effects: [heal(30), { kind: 'dispel', amount: 1, note: 'on allies: cleanse `amount` debuff(s) each' }],
    prerequisiteId: 'mender-circle-of-mending',
    mastery: { text: 'Cleanse 2 each.', effects: [{ kind: 'dispel', amount: 2 }] },
    tags: ['aoe', 'heal', 'cleanse'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'heal', priority: 75 },
  },
  {
    id: 'mender-sanctuary',
    school: 'benediction',
    tier: 3,
    name: 'Sanctuary',
    description: 'Every ally gains a Shield of 15% max HP for 2 turns; while a Sanctuary Shield holds, its holder cannot be Grabbed, Rooted or Webbed.',
    cost: 24,
    weight: 1000,
    target: 'allAllies',
    effects: [
      { kind: 'shield', percent: 15, duration: 2 },
      { kind: 'custom', customId: 'sanctuary-shield-immunities', duration: 2, note: 'while this skill’s Shield holds on the target, it cannot be Grabbed, Rooted or Webbed' },
    ],
    prerequisiteId: 'mender-breath-of-life',
    mastery: { text: 'Shield 20%.', effects: [{ kind: 'shield', percent: 20, duration: 2 }] },
    tags: ['aoe', 'shield', 'buff'],
    xpTags: ['wisdom'],
    ai: { role: 'defend', priority: 60 },
  },
  {
    id: 'mender-martyrs-grace',
    school: 'benediction',
    tier: 3,
    name: 'Martyr’s Grace',
    description: 'Once per fight, the first ally who would be downed survives at 1 HP instead.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'survive-lethal-once', amount: 1, target: 'self', note: 'once per fight, the first ally who would be downed instead survives at `amount` HP (or at percent% of max HP when `percent` is given)' },
    ],
    prerequisiteId: 'mender-overflow',
    mastery: { text: 'Survives at 10% HP.', effects: [{ kind: 'custom', customId: 'survive-lethal-once', percent: 10, target: 'self' }] },
    tags: ['buff', 'heal'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'heal', priority: 0 },
  },
  {
    id: 'mender-dawnbreak',
    school: 'benediction',
    tier: 3,
    name: 'Dawnbreak',
    description:
      'Every ally and pet heals 40% of max HP, loses every debuff and gains Regen 3 turns; every downed ally stands at 30% HP (no floor revive budget spent); every enemy takes 1.0× spell Attack as Holy with the Smite mark, and Undead and Shadow enemies also get Fear 1 turn. 100 Momentum; weight 1,000; never misses; cannot be interrupted.',
    cost: 0,
    weight: 1000,
    target: 'allAllies',
    isUltimate: true,
    effects: [
      heal(40),
      { kind: 'dispel', note: 'every debuff' },
      { kind: 'applyStatus', status: 'regen', duration: 3, percent: 5 },
      { kind: 'revive', percent: 30, target: 'allDowned', note: 'spends no floor revive budget' },
      { kind: 'damage', multiplier: 1.0, damageType: 'holy', target: 'allEnemies' },
      { kind: 'applyStatus', status: 'smite', target: 'allEnemies' },
      { kind: 'custom', customId: 'apply-if-undead-or-shadow', status: 'fear', duration: 1, target: 'allEnemies', note: 'applies `status` for `duration` only to Undead- or Shadow-family targets' },
    ],
    prerequisiteId: 'mender-circle-of-mending',
    mastery: { text: NO_MASTERY_TEXT, effects: [] },
    tags: ['aoe', 'heal', 'cleanse', 'revive', 'debuff'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'heal', priority: 95 },
  },
]

// ---------------------------------------------------------------------------------------------------------------
// §4.2 Sanctity — Holy damage, Smite, wards and Fear

const sanctity: SkillSpec[] = [
  {
    id: 'mender-smite',
    school: 'sanctity',
    tier: 1,
    name: 'Smite',
    description: '1.4× Holy to one enemy in either row; applies the Smite mark (+20% damage taken, +40% if Undead or Shadow, 2 turns).',
    cost: 10,
    weight: 1000,
    target: 'enemy',
    effects: [
      { kind: 'damage', multiplier: 1.4, damageType: 'holy' },
      { kind: 'applyStatus', status: 'smite' },
    ],
    prerequisiteId: null,
    mastery: { text: '1.6×.', effects: [{ kind: 'damage', multiplier: 1.6, damageType: 'holy' }] },
    tags: ['singleTarget', 'reach', 'debuff'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'attack', priority: 60 },
  },
  {
    id: 'mender-radiance',
    school: 'sanctity',
    tier: 1,
    name: 'Radiance',
    description: '0.7× Holy to every front-row enemy; each gets the Smite mark.',
    cost: 12,
    weight: 1000,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 0.7, damageType: 'holy', target: 'enemyRow', note: 'the whole front row' },
      { kind: 'applyStatus', status: 'smite', target: 'enemyRow' },
    ],
    prerequisiteId: null,
    mastery: { text: '0.8× each.', effects: [{ kind: 'damage', multiplier: 0.8, damageType: 'holy', target: 'enemyRow' }] },
    tags: ['aoe', 'debuff'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'attack', priority: 55 },
  },
  {
    id: 'mender-consecration',
    school: 'sanctity',
    tier: 1,
    name: 'Consecration',
    description: 'Holy skills +8%; your mace or censer basic attack deals an extra 0.3× spell Attack as Holy.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'school-damage-percent', percent: 8, target: 'self', note: 'skills of this skill’s school (Sanctity: Holy) deal +percent%' },
      { kind: 'custom', customId: 'basic-attack-extra-spell-damage', multiplier: 0.3, damageType: 'holy', target: 'self', note: 'the holder’s basic attack deals an extra multiplier × spell Attack as damageType' },
    ],
    prerequisiteId: null,
    mastery: { text: 'Extra 0.5×.', effects: [{ kind: 'custom', customId: 'basic-attack-extra-spell-damage', multiplier: 0.5, damageType: 'holy', target: 'self' }] },
    tags: ['buff'],
    xpTags: ['wisdom', 'strength'],
    ai: { role: 'buff', priority: 0 },
  },
  {
    id: 'mender-holy-lance',
    school: 'sanctity',
    tier: 2,
    name: 'Holy Lance',
    description: '1.9× Holy to one enemy in either row; a target carrying the Smite mark is also Stunned 1 turn. Heavy cast.',
    cost: 16,
    weight: 1400,
    target: 'enemy',
    effects: [
      { kind: 'damage', multiplier: 1.9, damageType: 'holy' },
      { kind: 'custom', customId: 'apply-if-smite', status: 'stun', duration: 1, note: 'applies `status` for `duration` only to a target holding the Smite mark' },
    ],
    prerequisiteId: 'mender-smite',
    mastery: { text: '2.1×.', effects: [{ kind: 'damage', multiplier: 2.1, damageType: 'holy' }] },
    tags: ['singleTarget', 'reach', 'control'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'attack', priority: 65 },
  },
  {
    id: 'mender-censure',
    school: 'sanctity',
    tier: 2,
    name: 'Censure',
    description: 'Fear 2 turns on one enemy in either row; Undead and Shadow targets are also Weakened 2 turns.',
    cost: 14,
    weight: 1000,
    target: 'enemy',
    effects: [
      { kind: 'applyStatus', status: 'fear', duration: 2 },
      { kind: 'custom', customId: 'apply-if-undead-or-shadow', status: 'weaken', duration: 2, note: 'applies `status` for `duration` only to Undead- or Shadow-family targets' },
    ],
    prerequisiteId: 'mender-radiance',
    mastery: { text: 'Fear 3 turns.', effects: [{ kind: 'applyStatus', status: 'fear', duration: 3 }] },
    tags: ['singleTarget', 'reach', 'control', 'debuff'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'control', priority: 50 },
  },
  {
    id: 'mender-ward-of-faith',
    school: 'sanctity',
    tier: 2,
    name: 'Ward of Faith',
    description: 'Every ally gains Fortify 2 turns and immunity to Fear for 2 turns.',
    cost: 15,
    weight: 1000,
    target: 'allAllies',
    effects: [
      { kind: 'applyStatus', status: 'fortify', duration: 2 },
      { kind: 'custom', customId: 'immune-to-status', status: 'fear', duration: 2, note: 'the target cannot receive `status` for `duration` turns' },
    ],
    prerequisiteId: 'mender-consecration',
    mastery: { text: 'Fortify 3 turns.', effects: [{ kind: 'applyStatus', status: 'fortify', duration: 3 }] },
    tags: ['aoe', 'buff'],
    xpTags: ['wisdom'],
    ai: { role: 'buff', priority: 50 },
  },
  {
    id: 'mender-judgement',
    school: 'sanctity',
    tier: 3,
    name: 'Judgement',
    description: '2.3× Holy to one enemy in either row, +1% damage per 1% of the target’s missing HP (up to +50%). Heavy cast.',
    cost: 26,
    weight: 1400,
    target: 'enemy',
    effects: [
      { kind: 'damage', multiplier: 2.3, damageType: 'holy' },
      { kind: 'custom', customId: 'bonus-per-missing-hp', percent: 50, note: 'this skill’s damage is +1% per 1% of the target’s missing HP, capped at +percent%' },
    ],
    prerequisiteId: 'mender-holy-lance',
    mastery: { text: 'Max +75%.', effects: [{ kind: 'custom', customId: 'bonus-per-missing-hp', percent: 75 }] },
    tags: ['singleTarget', 'reach'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'attack', priority: 70 },
  },
  {
    id: 'mender-wraiths-lament',
    school: 'sanctity',
    tier: 3,
    name: 'Wraith’s Lament',
    description:
      '1.0× Shadow to every enemy in both rows; living targets get Fear 1 turn; Undead and Shadow targets are immune to the Fear and take Mark 2 turns instead. Monster technique: Insights only while a wraith uses it (the wraith arrives with the Crypts in Phase 7).',
    cost: 22,
    weight: 1000,
    target: 'allEnemies',
    effects: [
      { kind: 'damage', multiplier: 1.0, damageType: 'shadow' },
      { kind: 'custom', customId: 'apply-if-living', status: 'fear', duration: 1, note: 'applies `status` for `duration` only to targets that are neither Undead nor Shadow family' },
      { kind: 'custom', customId: 'apply-if-undead-or-shadow', status: 'mark', duration: 2 },
    ],
    prerequisiteId: 'mender-censure',
    mastery: { text: '1.2× each.', effects: [{ kind: 'damage', multiplier: 1.2, damageType: 'shadow' }] },
    tags: ['aoe', 'control', 'debuff'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'attack', priority: 60 },
  },
  {
    id: 'mender-hallowed-ground',
    school: 'sanctity',
    tier: 3,
    name: 'Hallowed Ground',
    description: 'For 3 turns: any enemy that attacks the party’s front row takes 0.5× Holy; Undead cannot be raised or revived while it holds; every ally has +10% Resistance.',
    cost: 24,
    weight: 1000,
    target: 'allAllies',
    effects: [
      { kind: 'custom', customId: 'hallowed-ground', multiplier: 0.5, damageType: 'holy', duration: 3, target: 'self', note: 'for `duration` turns any enemy that attacks the party’s front row takes multiplier × the caster’s spell Attack as damageType; Undead cannot be raised or revived while it holds' },
      { kind: 'buffStat', stat: 'resistance', amount: 10, duration: 3 },
    ],
    prerequisiteId: 'mender-ward-of-faith',
    mastery: {
      text: '4 turns.',
      effects: [
        { kind: 'custom', customId: 'hallowed-ground', multiplier: 0.5, damageType: 'holy', duration: 4, target: 'self' },
        { kind: 'buffStat', stat: 'resistance', amount: 10, duration: 4 },
      ],
    },
    tags: ['aoe', 'buff', 'control'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'buff', priority: 50 },
  },
]

// ---------------------------------------------------------------------------------------------------------------
// §4.3 Vigil — cleanse, steady, gift

const vigil: SkillSpec[] = [
  {
    id: 'mender-cleanse',
    school: 'vigil',
    tier: 1,
    name: 'Cleanse',
    description: 'Remove 1 debuff from one ally (the player picks) and heal them 5% of max HP.',
    cost: 8,
    weight: 800,
    target: 'ally',
    effects: [{ kind: 'dispel', amount: 1, note: 'on an ally: cleanse `amount` debuff(s); the player picks which' }, heal(5)],
    prerequisiteId: null,
    mastery: { text: 'Remove 2.', effects: [{ kind: 'dispel', amount: 2 }] },
    tags: ['singleTarget', 'cleanse', 'heal'],
    xpTags: ['wisdom'],
    ai: { role: 'heal', priority: 55 },
  },
  {
    id: 'mender-blessing',
    school: 'vigil',
    tier: 1,
    name: 'Blessing',
    description: 'One ally gains Fortify 3 turns and +10 Momentum.',
    cost: 12,
    weight: 1000,
    target: 'ally',
    effects: [
      { kind: 'applyStatus', status: 'fortify', duration: 3 },
      { kind: 'momentum', amount: 10 },
    ],
    prerequisiteId: null,
    mastery: { text: '+15 Momentum.', effects: [{ kind: 'momentum', amount: 15 }] },
    tags: ['singleTarget', 'buff', 'momentum'],
    xpTags: ['wisdom'],
    ai: { role: 'buff', priority: 45 },
  },
  {
    id: 'mender-vigil-lantern',
    school: 'vigil',
    tier: 1,
    name: 'Vigil Lantern',
    description: 'The party’s Light falls 1 less per new room; every ally has +5% Resistance.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'light-decay-reduction', amount: 1, target: 'self', note: 'the party’s Light falls `amount` less per new room' },
      { kind: 'buffStat', stat: 'resistance', amount: 5, target: 'allAllies', note: 'an aura: every ally while the passive is equipped' },
    ],
    prerequisiteId: null,
    mastery: { text: '+8% Resistance.', effects: [{ kind: 'buffStat', stat: 'resistance', amount: 8, target: 'allAllies' }] },
    tags: ['buff', 'light'],
    xpTags: ['wisdom'],
    ai: { role: 'buff', priority: 0 },
  },
  {
    id: 'mender-purify',
    school: 'vigil',
    tier: 2,
    name: 'Purify',
    description: 'Remove 1 debuff from every ally; Poison, Bleed and Curse go first.',
    cost: 14,
    weight: 1000,
    target: 'allAllies',
    effects: [{ kind: 'dispel', amount: 1, note: 'on allies: cleanse `amount` debuff(s) each; Poison, Bleed and Curse are removed first' }],
    prerequisiteId: 'mender-cleanse',
    mastery: { text: 'Remove 2 each.', effects: [{ kind: 'dispel', amount: 2 }] },
    tags: ['aoe', 'cleanse'],
    xpTags: ['wisdom'],
    ai: { role: 'heal', priority: 60 },
  },
  {
    id: 'mender-rally',
    school: 'vigil',
    tier: 2,
    name: 'Rally',
    description: 'Every ally gains +10 Momentum and loses Fear.',
    cost: 16,
    weight: 1000,
    target: 'allAllies',
    effects: [
      { kind: 'momentum', amount: 10 },
      { kind: 'removeStatus', status: 'fear' },
    ],
    prerequisiteId: 'mender-blessing',
    mastery: { text: '+15 each.', effects: [{ kind: 'momentum', amount: 15 }] },
    tags: ['aoe', 'buff', 'momentum', 'cleanse'],
    xpTags: ['wisdom'],
    ai: { role: 'buff', priority: 50 },
  },
  {
    id: 'mender-steadfast',
    school: 'vigil',
    tier: 2,
    name: 'Steadfast',
    description: 'Allies with Fortify also have +10% Resistance; Fortify from your skills lasts +1 turn.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'resistance-bonus-while-fortified', amount: 10, target: 'self', note: 'while the holder is in the fight, allies holding Fortify have +amount pp Resistance' },
      { kind: 'custom', customId: 'fortify-duration-bonus', amount: 1, target: 'self', note: 'Fortify the holder applies lasts +amount turns' },
    ],
    prerequisiteId: 'mender-vigil-lantern',
    mastery: { text: '+15% Resistance.', effects: [{ kind: 'custom', customId: 'resistance-bonus-while-fortified', amount: 15, target: 'self' }] },
    tags: ['buff'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'buff', priority: 0 },
  },
  {
    id: 'mender-absolution',
    school: 'vigil',
    tier: 3,
    name: 'Absolution',
    description: 'Remove every debuff from one ally, Petrify, Curse and Silence included; they are immune to debuffs for 1 turn.',
    cost: 22,
    weight: 1000,
    target: 'ally',
    effects: [
      { kind: 'dispel', note: 'on an ally: every debuff, Petrify, Curse and Silence included' },
      { kind: 'custom', customId: 'immune-to-debuffs', duration: 1, note: 'the target cannot receive any debuff for `duration` turns' },
    ],
    prerequisiteId: 'mender-purify',
    mastery: { text: 'Immune 2 turns.', effects: [{ kind: 'custom', customId: 'immune-to-debuffs', duration: 2 }] },
    tags: ['singleTarget', 'cleanse', 'buff'],
    xpTags: ['wisdom'],
    ai: { role: 'heal', priority: 60 },
  },
  {
    id: 'mender-hymn-of-momentum',
    school: 'vigil',
    tier: 3,
    name: 'Hymn of Momentum',
    description: 'Every ally gains +20 Momentum; you lose 20. Heavy cast.',
    cost: 26,
    weight: 1400,
    target: 'allAllies',
    effects: [
      { kind: 'momentum', amount: 20, note: 'every ally (the sheet’s wording excludes the Mender; allAllies includes the caster, so the self line below nets the Mender’s loss)' },
      { kind: 'momentum', amount: -20, target: 'self', note: 'the Mender loses 20' },
    ],
    prerequisiteId: 'mender-rally',
    mastery: { text: 'You lose nothing.', effects: [{ kind: 'momentum', amount: 0, target: 'self' }] },
    tags: ['aoe', 'buff', 'momentum'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'buff', priority: 55 },
  },
  {
    id: 'mender-beacon',
    school: 'vigil',
    tier: 3,
    name: 'Beacon',
    description: 'Out of combat: +20 Light, once per room. In combat: Mark 2 turns on every enemy.',
    cost: 18,
    weight: 800,
    target: 'allEnemies',
    effects: [
      { kind: 'light', amount: 20, note: 'out of combat, once per room' },
      { kind: 'applyStatus', status: 'mark', duration: 2 },
    ],
    prerequisiteId: 'mender-steadfast',
    mastery: { text: 'Mark 3 turns.', effects: [{ kind: 'applyStatus', status: 'mark', duration: 3 }] },
    tags: ['aoe', 'light', 'debuff', 'utility'],
    xpTags: ['wisdom'],
    ai: { role: 'debuff', priority: 50 },
  },
]

// ---------------------------------------------------------------------------------------------------------------
// Writing

function toRecord(s: SkillSpec): Json {
  const passive = s.type === 'passive'
  const rec: Json = {
    id: s.id,
    classId: CLASS_ID,
    school: s.school,
    tier: s.tier,
    name: s.name,
    description: s.description,
    type: passive ? 'passive' : 'active',
    cost: passive ? 0 : (s.cost ?? 0),
    weight: passive ? null : s.weight,
    target: passive ? 'self' : s.target,
    effects: s.effects,
    prerequisiteId: s.prerequisiteId,
    isUltimate: s.isUltimate === true,
    monsterTechniqueOf: null,
  }
  if (s.requirements) rec.requirements = s.requirements
  rec.rankScaling = RANK_SCALING
  rec.mastery = s.mastery
  rec.tags = s.tags
  rec.xpTags = s.xpTags
  rec.aiHints = s.ai
  return rec
}

function writeJson(file: string, value: Json): boolean {
  const text = `${JSON.stringify(value, null, 2)}\n`
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  if (before === text) return false
  fs.writeFileSync(file, text, 'utf8')
  return true
}

const skills = [...benediction, ...sanctity, ...vigil]
const skillDir = path.join(ROOT, 'content', 'skills', CLASS_ID)
fs.mkdirSync(skillDir, { recursive: true })
fs.mkdirSync(path.join(ROOT, 'content', 'classes'), { recursive: true })

let changed = 0
if (writeJson(path.join(ROOT, 'content', 'classes', `${CLASS_ID}.json`), classRecord)) changed++
const written = new Set<string>()
for (const s of skills) {
  if (!s.id.startsWith(`${CLASS_ID}-`)) throw new Error(`skill id ${s.id} is not prefixed with ${CLASS_ID}-`)
  if (written.has(s.id)) throw new Error(`duplicate skill id ${s.id}`)
  written.add(s.id)
  if (writeJson(path.join(skillDir, `${s.id}.json`), toRecord(s))) changed++
}
const stale = fs.readdirSync(skillDir).filter((f) => f.endsWith('.json') && !written.has(f.slice(0, -5)))
process.stdout.write(`${CLASS_ID}: 1 class + ${skills.length} skills (${skills.filter((s) => s.isUltimate).length} Ultimate), ${changed} file(s) changed${stale.length ? `; stale files not written by this script: ${stale.join(', ')}` : ''}\n`)

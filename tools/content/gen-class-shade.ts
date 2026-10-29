/**
 * tools/content/gen-class-shade.ts — writes content/classes/shade.json and content/skills/shade/*.json
 * from docs/classes/shade.md (§2 numbers, §3 the Ultimate, §4.1–§4.3 the three school tables, §5 affinities).
 *
 * Phase 3 (12-ROADMAP): Tiers I–III of every school (27 skills) plus the Ultimate. Phase 7 adds Tiers IV–V (Tier V is
 * written but locked until Segment 3, D-099) with D-099's execute cap: Severance below 35% HP is 6.0× with a sure
 * crit, not 9.0×. Readings (sheet rev. 3 "As built"): "from Veil" is read from the log or the turn start (attacking ends
 * Veil before a line resolves); "ignores N% of Defense" is ignore-defense-percent before the damage line; a crit's
 * follow-up (Death's Whisper) settles once the action resolved; Toxicologist, Phantom Thief's chest rules and Vault
 * Cracker's corridor half are stubs until statuses.ts and the delve have their joints.
 * Every number is the sheet's; where a line cannot be said in the effect DSL it is a `custom` line whose `note`
 * states the hook's contract (content/README.md rule 31 wants a handler per customId in sim/src/skills/custom/).
 *
 * Re-runnable: the same tables write the same files. Run: node tools/content/gen-class-shade.ts
 */
import { writeClassRecords } from './gen-class-lib.ts'

const CLASS_ID = 'shade'
const RANK_SCALING = { effectPerRank: 4, costPerRank: -2 }

type Json = Record<string, unknown>
type Effect = Json & { kind: string }

interface SkillSpec {
  id: string
  school: 'shadow' | 'venom' | 'larceny'
  tier: 1 | 2 | 3 | 4 | 5
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

/** A dagger in the main hand: the sheet's "Shadow skills require a dagger in the main hand" (§2 weapon handling). */
const DAGGER = { weaponTypes: ['dagger'] }

// ---------------------------------------------------------------------------------------------------------------
// The class record (§1, §2, §5, §9)

const classRecord: Json = {
  id: CLASS_ID,
  name: 'Shade',
  role: 'assassin / rogue: fastest on the strip, burst from Veil, the party’s locksmith',
  description:
    'Dual daggers, a half-cloak and a two-beat rhythm: disappear, then appear exactly where it hurts. The Shade flanks the back row from the front, poisons what it cannot cut, and opens every lock and purse on the way.',
  attributeMods: { agility: 2, perception: 1, luck: 1 },
  pool: 'stamina',
  armorFamily: 'leather',
  weaponTypes: ['dagger', 'sword', 'throwingKnife'],
  schools: [
    { id: 'shadow', name: 'Shadow', philosophy: 'Be elsewhere, then be exactly there. Stealth, crits and the backstab from the front row; everything that says "from Veil" doubles while hidden.' },
    { id: 'venom', name: 'Venom', philosophy: 'The fight is already won; the enemy has not noticed. Poison that ticks on their turn and ignores armor, debuffs, and the Shadow element.' },
    { id: 'larceny', name: 'Larceny', philosophy: 'The dungeon pays those who ask impolitely. Locks, mid-fight steals, pocketed traps and more gold for the party.' },
  ],
  ultimateSkillId: 'shade-last-light-out',
  starterKit: [
    'copper-dagger',
    'copper-throwing-knives',
    'rawhide-hood',
    'rawhide-jerkin',
    'rawhide-breeches',
    'rawhide-boots',
    'rawhide-gloves',
    'ring-of-shadows',
    'small-hp-potion',
    'torch',
    'repair-kit',
    'bandage',
  ],
  starterSkillIds: ['shade-veil', 'shade-backstab', 'shade-toxic-jab'],
  fieldSkillAffinities: [
    { fieldSkill: 'lockpicking', rankBonus: 2 },
    { fieldSkill: 'haggling', rankBonus: 2 },
  ],
  monsterTechniqueIds: [],
  // Phase 8: the relics that suit the class, each where its trigger holds (08 §3; a relic not worn is skipped).
  aiRuleDefault: 'IF self HP < 30% THEN item small hp potion on self; IF round = 1 THEN item hourglass shard; IF enemies count > 2 THEN item moth charm; IF self not status veil THEN veil; ELSE backstab on weakest enemy',
  visual: {
    gearSetId: 'shade-rawhide-leather',
    palette: ['#15151c', '#5b3b8a', '#8a8a8f', '#2e3036'],
    notes:
      'A narrow vertical blade of a figure broken by one diagonal, the half-cloak over the left shoulder; the half-mask and the knife handles at the belt must read at 200px. Veiled, the set drops to 40% opacity with a violet rim light.',
  },
  pros: [
    'Highest burst: Veil then Backstab is 3.0× with +30% Crit Rate at Tier I',
    'Flanks the back row from the front row; Poison keeps ticking while it hides',
    'Lockpicking +2, gold stolen mid-fight, locked chests that roll a grade up',
  ],
  cons: [
    '103 HP and Defense 20 at creation; Dodge is the only defence and caps at 30%',
    'Pierce versus Plate: bone knights take its daggers at ×0.67 until Tier IV',
    'Needs a setup turn: an ambushed Shade spends its first turn surviving, not Veiling',
  ],
}

// ---------------------------------------------------------------------------------------------------------------
// §4.1 Shadow — stealth, execute, crit, backstab from the front row

const shadow: SkillSpec[] = [
  {
    id: 'shade-veil',
    school: 'shadow',
    tier: 1,
    name: 'Veil',
    description: 'Enter Veil: single-target attacks cannot pick you for up to 2 turns, and it ends when you attack. +10 Momentum.',
    cost: 10,
    weight: 800,
    target: 'self',
    effects: [
      { kind: 'applyStatus', status: 'veil', duration: 2, note: 'max 2 turns; ends when you attack (the status owns the rule)' },
      { kind: 'momentum', amount: 10 },
    ],
    prerequisiteId: null,
    mastery: {
      text: 'Costs 0 on your first action of a fight.',
      effects: [{ kind: 'custom', customId: 'free-on-first-action', target: 'self', note: 'this skill costs 0 pool when it is your first action of the fight' }],
    },
    tags: ['buff', 'momentum'],
    xpTags: ['agility'],
    ai: { role: 'buff', priority: 60 },
  },
  {
    id: 'shade-backstab',
    school: 'shadow',
    tier: 1,
    name: 'Backstab',
    description: '2.05× Pierce to one enemy in any row (flank: the back row from the front). From Veil the hit is doubled and gets +30% Crit Rate.',
    cost: 12,
    weight: 800,
    target: 'enemy',
    effects: [
      { kind: 'damage', multiplier: 2.05, damageType: 'pierce' },
      { kind: 'custom', customId: 'veil-strike-bonus', percent: 100, amount: 30, note: 'while Veiled: this skill’s damage +100% (×2) and Crit Rate +30 pp; the attack ends Veil as usual' },
    ],
    prerequisiteId: null,
    requirements: DAGGER,
    mastery: {
      text: 'From Veil ×2.5.',
      effects: [{ kind: 'custom', customId: 'veil-strike-bonus', percent: 150, amount: 30 }],
    },
    tags: ['singleTarget', 'reach'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'attack', priority: 70 },
  },
  {
    id: 'shade-cold-read',
    school: 'shadow',
    tier: 1,
    name: 'Cold Read',
    description: 'Crit Rate +5%; each crit you land gives +5 Momentum.',
    type: 'passive',
    effects: [
      { kind: 'buffStat', stat: 'critRate', amount: 5 },
      { kind: 'custom', customId: 'momentum-on-crit', amount: 5, target: 'self', note: 'each crit the holder lands grants +amount Momentum' },
    ],
    prerequisiteId: null,
    mastery: {
      text: '+10% Crit Rate.',
      effects: [{ kind: 'buffStat', stat: 'critRate', amount: 10 }],
    },
    tags: ['buff', 'momentum'],
    xpTags: ['perception'],
    ai: { role: 'buff', priority: 0 },
  },
  {
    id: 'shade-shadowstep',
    school: 'shadow',
    tier: 2,
    name: 'Shadowstep',
    description: 'Swap rows as part of the action and enter Veil for 1 turn.',
    cost: 12,
    weight: 800,
    target: 'self',
    effects: [
      { kind: 'rowSwap', target: 'self' },
      { kind: 'applyStatus', status: 'veil', duration: 1 },
    ],
    prerequisiteId: 'shade-veil',
    mastery: {
      text: 'Veil 2 turns.',
      effects: [{ kind: 'applyStatus', status: 'veil', duration: 2 }],
    },
    tags: ['mobility', 'buff'],
    xpTags: ['agility'],
    ai: { role: 'defend', priority: 45 },
  },
  {
    id: 'shade-throat-cut',
    school: 'shadow',
    tier: 2,
    name: 'Throat Cut',
    description: '1.75× Pierce to a front-row enemy; Silence 2 turns (no skills); +50% damage against a Dazed target.',
    cost: 15,
    weight: 800,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 1.75, damageType: 'pierce' },
      { kind: 'applyStatus', status: 'silence', duration: 2 },
      { kind: 'custom', customId: 'damage-bonus-vs-status', status: 'daze', percent: 50, note: 'this skill’s damage is +percent% against a target under `status`' },
    ],
    prerequisiteId: 'shade-backstab',
    requirements: DAGGER,
    mastery: {
      text: 'Silence 3 turns.',
      effects: [{ kind: 'applyStatus', status: 'silence', duration: 3 }],
    },
    tags: ['singleTarget', 'control'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'attack', priority: 60 },
  },
  {
    id: 'shade-opportunist',
    school: 'shadow',
    tier: 2,
    name: 'Opportunist',
    description: '+15% damage against enemies under any status; your crits against such enemies Daze them 20% of the time.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'damage-bonus-vs-status', percent: 15, target: 'self', note: 'no `status` named: +percent% damage against any target holding at least one status' },
      { kind: 'custom', customId: 'daze-on-crit-vs-status', chance: 20, target: 'self', note: 'a crit by the holder on a target already under any status Dazes it at chance%' },
    ],
    prerequisiteId: 'shade-cold-read',
    mastery: {
      text: '+25% damage; Daze 35%.',
      effects: [
        { kind: 'custom', customId: 'damage-bonus-vs-status', percent: 25, target: 'self' },
        { kind: 'custom', customId: 'daze-on-crit-vs-status', chance: 35, target: 'self' },
      ],
    },
    tags: ['buff', 'control'],
    xpTags: ['perception'],
    ai: { role: 'buff', priority: 0 },
  },
  {
    id: 'shade-wraith-step',
    school: 'shadow',
    tier: 3,
    name: 'Wraith-step',
    description:
      'Veil 2 turns that your own Poison ticks do not break; your next attack is Shadow element and applies Wither (−50% healing) for 2 turns. Monster technique: learned only by witnessing a Wraith use it.',
    cost: 22,
    weight: 800,
    target: 'self',
    effects: [
      { kind: 'applyStatus', status: 'veil', duration: 2 },
      { kind: 'custom', customId: 'veil-survives-own-dots', target: 'self', note: 'the Veil this skill applies is not ended by the holder’s own DoT ticks' },
      { kind: 'custom', customId: 'next-attacks-element', damageType: 'shadow', status: 'wither', duration: 2, amount: 1, target: 'self', note: 'the holder’s next `amount` attack(s) deal `damageType` and apply `status` for `duration` turns' },
    ],
    prerequisiteId: 'shade-shadowstep',
    mastery: {
      text: 'Also +15 Momentum.',
      effects: [{ kind: 'momentum', amount: 15 }],
    },
    tags: ['buff', 'debuff'],
    xpTags: ['agility', 'willpower'],
    ai: { role: 'buff', priority: 50 },
  },
  {
    id: 'shade-vital-point',
    school: 'shadow',
    tier: 3,
    name: 'Vital Point',
    description: '2.55× Pierce to a front-row enemy; against a target below 25% HP, 5.15×.',
    cost: 20,
    weight: 800,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 2.55, damageType: 'pierce' },
      { kind: 'custom', customId: 'execute-multiplier', multiplier: 5.15, percent: 25, note: 'when the target’s HP is below percent% of max, this skill’s damage multiplier becomes `multiplier` instead' },
    ],
    prerequisiteId: 'shade-throat-cut',
    requirements: DAGGER,
    mastery: {
      text: 'Threshold 30%.',
      effects: [{ kind: 'custom', customId: 'execute-multiplier', multiplier: 5.15, percent: 30 }],
    },
    tags: ['singleTarget'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'attack', priority: 65 },
  },
  {
    id: 'shade-killers-calm',
    school: 'shadow',
    tier: 3,
    name: 'Killer’s Calm',
    description: 'Crit Damage +25%; your first crit each fight gives +20 Momentum.',
    type: 'passive',
    effects: [
      { kind: 'buffStat', stat: 'critDamage', amount: 25 },
      { kind: 'custom', customId: 'momentum-on-first-crit', amount: 20, target: 'self', note: 'once per fight, the holder’s first crit grants +amount Momentum' },
    ],
    prerequisiteId: 'shade-opportunist',
    mastery: {
      text: '+40% Crit Damage.',
      effects: [{ kind: 'buffStat', stat: 'critDamage', amount: 40 }],
    },
    tags: ['buff', 'momentum'],
    xpTags: ['perception'],
    ai: { role: 'buff', priority: 0 },
  },
  {
    id: 'shade-last-light-out',
    school: 'shadow',
    tier: 3,
    name: 'Last Light Out',
    description:
      'Five hits of 0.9× Pierce on one enemy in any row; the first hit is a guaranteed crit; Poison 3 turns and Blind 1 turn; you re-enter Veil at no cost. 100 Momentum, no Stamina; weight 800; never misses.',
    cost: 0,
    weight: 800,
    target: 'enemy',
    isUltimate: true,
    effects: [
      { kind: 'custom', customId: 'guaranteed-crits', amount: 1, note: 'the first `amount` damage lines of this skill crit' },
      { kind: 'damage', multiplier: 0.9, damageType: 'pierce' },
      { kind: 'damage', multiplier: 0.9, damageType: 'pierce' },
      { kind: 'damage', multiplier: 0.9, damageType: 'pierce' },
      { kind: 'damage', multiplier: 0.9, damageType: 'pierce' },
      { kind: 'damage', multiplier: 0.9, damageType: 'pierce' },
      { kind: 'applyStatus', status: 'poison', duration: 3 },
      { kind: 'applyStatus', status: 'blind', duration: 1 },
      { kind: 'applyStatus', status: 'veil', duration: 2, target: 'self', note: 're-enter Veil afterwards at no cost' },
    ],
    prerequisiteId: 'shade-throat-cut',
    mastery: {
      text: 'Six hits; the first two crit.',
      effects: [
        { kind: 'custom', customId: 'guaranteed-crits', amount: 2 },
        { kind: 'damage', multiplier: 0.9, damageType: 'pierce', note: 'a sixth hit, added to the five' },
      ],
    },
    tags: ['singleTarget', 'reach', 'dot', 'debuff', 'buff'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'attack', priority: 95 },
  },
  {
    id: 'shade-phantom-twin',
    school: 'shadow',
    tier: 4,
    name: 'Phantom Twin',
    description: 'For 2 turns, the first single-target attack aimed at you each turn hits a decoy and misses; +15 Momentum.',
    cost: 30,
    weight: 800,
    target: 'self',
    effects: [
      { kind: 'custom', customId: 'decoy-each-turn', duration: 2, target: 'self', note: 'for `duration` turns the first single-target attack on the holder each turn misses (a decoy)' },
      { kind: 'momentum', amount: 15 },
    ],
    prerequisiteId: 'shade-wraith-step',
    mastery: {
      text: '3 turns.',
      effects: [{ kind: 'custom', customId: 'decoy-each-turn', duration: 3, target: 'self' }],
    },
    tags: ['buff', 'momentum'],
    xpTags: ['agility'],
    ai: { role: 'defend', priority: 50 },
  },
  {
    id: 'shade-assassinate',
    school: 'shadow',
    tier: 4,
    name: 'Assassinate',
    description: '2.8× Pierce to one enemy in any row; from Veil, a guaranteed crit that ignores 50% of the target’s Defense (the anti-Plate strike).',
    cost: 35,
    weight: 1000,
    target: 'enemy',
    effects: [
      { kind: 'custom', customId: 'guaranteed-crit-from-status', status: 'veil', target: 'self', note: 'this action crits if the holder was in `status` as it began' },
      { kind: 'custom', customId: 'ignore-defense-percent', percent: 50, status: 'veil', target: 'self', note: 'from `status`: this action ignores percent% of the target’s Defense' },
      { kind: 'damage', multiplier: 2.8, damageType: 'pierce' },
    ],
    prerequisiteId: 'shade-vital-point',
    requirements: DAGGER,
    mastery: {
      text: 'Ignores 75%.',
      effects: [{ kind: 'custom', customId: 'ignore-defense-percent', percent: 75, status: 'veil', target: 'self' }],
    },
    tags: ['singleTarget', 'reach'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'attack', priority: 75 },
  },
  {
    id: 'shade-second-shadow',
    school: 'shadow',
    tier: 4,
    name: 'Second Shadow',
    description: 'Whenever an attack on you misses or is dodged, you gain Veil until your next action.',
    type: 'passive',
    effects: [{ kind: 'custom', customId: 'veil-on-evade', target: 'self', note: 'a failed hit roll against the holder gives it Veil 1 turn' }],
    prerequisiteId: 'shade-killers-calm',
    mastery: {
      text: 'Also +10 Momentum each time.',
      effects: [{ kind: 'custom', customId: 'momentum-on-dodge', amount: 10, target: 'self' }],
    },
    tags: ['buff'],
    xpTags: ['agility'],
    ai: { role: 'defend', priority: 0 },
  },
  {
    id: 'shade-unseen-hand',
    school: 'shadow',
    tier: 5,
    name: 'Unseen Hand',
    description: 'Every ally is untargetable by single-target attacks for 1 turn (an AoE still lands); Taunts and Marks on allies are stripped.',
    cost: 40,
    weight: 800,
    target: 'allAllies',
    effects: [
      { kind: 'custom', customId: 'single-target-misses-turns', duration: 1, note: 'for `duration` turns single-target attacks on the holder miss' },
      { kind: 'removeStatus', status: 'taunt' },
      { kind: 'removeStatus', status: 'mark' },
    ],
    prerequisiteId: 'shade-phantom-twin',
    mastery: {
      text: '2 turns.',
      effects: [{ kind: 'custom', customId: 'single-target-misses-turns', duration: 2 }],
    },
    tags: ['aoe', 'buff', 'cleanse'],
    xpTags: ['agility'],
    ai: { role: 'defend', priority: 60 },
  },
  {
    id: 'shade-severance',
    school: 'shadow',
    tier: 5,
    name: 'Severance',
    description: '4.5× Pierce to one enemy in any row; below 35% HP, 6.0× with a guaranteed crit; if it kills, re-enter Veil for free.',
    cost: 50,
    weight: 1000,
    target: 'enemy',
    effects: [
      { kind: 'custom', customId: 'guaranteed-crit-below-hp', percent: 35, target: 'self', note: 'D-099: against a target below percent% HP this action crits' },
      { kind: 'damage', multiplier: 4.5, damageType: 'pierce' },
      { kind: 'custom', customId: 'execute-multiplier', multiplier: 6.0, percent: 35, note: 'D-099: below percent% HP the multiplier becomes 6.0 (no execute above 6.0×)' },
      { kind: 'custom', customId: 'veil-on-kill', duration: 2, target: 'self', note: 'a kill re-enters Veil for `duration` turns at no cost' },
    ],
    prerequisiteId: 'shade-assassinate',
    requirements: DAGGER,
    mastery: {
      text: 'Threshold 40%.',
      effects: [
        { kind: 'custom', customId: 'guaranteed-crit-below-hp', percent: 40, target: 'self' },
        { kind: 'custom', customId: 'execute-multiplier', multiplier: 6.0, percent: 40 },
      ],
    },
    tags: ['singleTarget', 'reach'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'attack', priority: 80 },
  },
  {
    id: 'shade-deaths-whisper',
    school: 'shadow',
    tier: 5,
    name: 'Death’s Whisper',
    description: 'Your Crit Rate cap is 55%; a crit from Veil applies Fear 1 turn to every other enemy.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'crit-cap-raise', amount: 55, target: 'self', note: 'the Crit Rate cap becomes amount% (stub: a stats.ts joint)' },
      { kind: 'custom', customId: 'fear-others-on-veil-crit', duration: 1, target: 'self', note: 'a crit from Veil Fears every other enemy for `duration` turns' },
    ],
    prerequisiteId: 'shade-second-shadow',
    mastery: {
      text: 'Fear 2 turns.',
      effects: [{ kind: 'custom', customId: 'fear-others-on-veil-crit', duration: 2, target: 'self' }],
    },
    tags: ['buff', 'control'],
    xpTags: ['perception'],
    ai: { role: 'attack', priority: 0 },
  },
]

// ---------------------------------------------------------------------------------------------------------------
// §4.2 Venom — poison, debuffs, Shadow element

const venom: SkillSpec[] = [
  {
    id: 'shade-toxic-jab',
    school: 'venom',
    tier: 1,
    name: 'Toxic Jab',
    description: '1.35× Pierce to a front-row enemy; Poison 3 turns (re-applying refreshes the duration).',
    cost: 10,
    weight: 800,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 1.35, damageType: 'pierce' },
      { kind: 'applyStatus', status: 'poison', duration: 3 },
    ],
    prerequisiteId: null,
    mastery: {
      text: 'Poison 4 turns.',
      effects: [{ kind: 'applyStatus', status: 'poison', duration: 4 }],
    },
    tags: ['singleTarget', 'dot'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'attack', priority: 60 },
  },
  {
    id: 'shade-crippling-dust',
    school: 'venom',
    tier: 1,
    name: 'Crippling Dust',
    description: 'Blind one enemy in any row for 2 turns (−30% Accuracy).',
    cost: 11,
    weight: 800,
    target: 'enemy',
    effects: [{ kind: 'applyStatus', status: 'blind', duration: 2 }],
    prerequisiteId: null,
    mastery: {
      text: 'Two targets.',
      effects: [{ kind: 'custom', customId: 'additional-targets', amount: 1, note: 'the skill’s lines also land on `amount` more distinct enemies (nearest first)' }],
    },
    tags: ['control', 'debuff', 'reach'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'debuff', priority: 50 },
  },
  {
    id: 'shade-steeped-blades',
    school: 'venom',
    tier: 1,
    name: 'Steeped Blades',
    description: 'Poison you apply lasts +1 turn and ticks +15% harder.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'poison-duration-bonus', amount: 1, target: 'self', note: 'Poison the holder applies lasts +amount turns' },
      { kind: 'custom', customId: 'poison-tick-percent', percent: 15, target: 'self', note: 'Poison the holder applies ticks +percent%' },
    ],
    prerequisiteId: null,
    mastery: {
      text: 'Ticks +30%.',
      effects: [{ kind: 'custom', customId: 'poison-tick-percent', percent: 30, target: 'self' }],
    },
    tags: ['buff', 'dot'],
    xpTags: ['perception'],
    ai: { role: 'buff', priority: 0 },
  },
  {
    id: 'shade-festering-wound',
    school: 'venom',
    tier: 2,
    name: 'Festering Wound',
    description: '1.6× Pierce to a front-row enemy; if the target is Poisoned, also Weaken 2 turns.',
    cost: 15,
    weight: 800,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 1.6, damageType: 'pierce' },
      { kind: 'custom', customId: 'apply-if-poison', status: 'weaken', duration: 2, note: 'applies `status` for `duration` only if the target holds Poison' },
    ],
    prerequisiteId: 'shade-toxic-jab',
    mastery: {
      text: 'Weaken 3 turns.',
      effects: [{ kind: 'custom', customId: 'apply-if-poison', status: 'weaken', duration: 3 }],
    },
    tags: ['singleTarget', 'dot', 'debuff'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'attack', priority: 60 },
  },
  {
    id: 'shade-choking-cloud',
    school: 'venom',
    tier: 2,
    name: 'Choking Cloud',
    description: 'Poison 2 turns and Silence 1 turn on every back-row enemy.',
    cost: 16,
    weight: 1000,
    target: 'enemyBack',
    effects: [
      { kind: 'applyStatus', status: 'poison', duration: 2, target: 'enemyRow', note: 'the whole row of the chosen back-row enemy' },
      { kind: 'applyStatus', status: 'silence', duration: 1, target: 'enemyRow' },
    ],
    prerequisiteId: 'shade-crippling-dust',
    mastery: {
      text: 'Also Blind 1 turn.',
      effects: [{ kind: 'applyStatus', status: 'blind', duration: 1, target: 'enemyRow' }],
    },
    tags: ['aoe', 'dot', 'control', 'reach'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'debuff', priority: 55 },
  },
  {
    id: 'shade-envenom',
    school: 'venom',
    tier: 2,
    name: 'Envenom',
    description: 'Your next 3 hits apply Poison for 3 turns; +5 Momentum.',
    cost: 12,
    weight: 800,
    target: 'self',
    effects: [
      { kind: 'custom', customId: 'next-hits-apply-status', status: 'poison', duration: 3, amount: 3, target: 'self', note: 'the holder’s next `amount` hits apply `status` for `duration` turns' },
      { kind: 'momentum', amount: 5 },
    ],
    prerequisiteId: 'shade-steeped-blades',
    mastery: {
      text: '5 hits.',
      effects: [{ kind: 'custom', customId: 'next-hits-apply-status', status: 'poison', duration: 3, amount: 5, target: 'self' }],
    },
    tags: ['buff', 'dot'],
    xpTags: ['agility'],
    ai: { role: 'buff', priority: 45 },
  },
  {
    id: 'shade-venom-burst',
    school: 'venom',
    tier: 3,
    name: 'Venom Burst',
    description: '2.15× Shadow to one enemy in any row; consumes the target’s Poison and deals its remaining ticks ×1.5 at once.',
    cost: 24,
    weight: 1000,
    target: 'enemy',
    effects: [
      { kind: 'damage', multiplier: 2.15, damageType: 'shadow' },
      { kind: 'custom', customId: 'consume-dot-burst', status: 'poison', multiplier: 1.5, note: 'removes the target’s `status` DoT and deals its remaining ticks × multiplier at once (ignores Defense like the DoT)' },
    ],
    prerequisiteId: 'shade-festering-wound',
    mastery: {
      text: 'Remaining ticks ×2.0.',
      effects: [{ kind: 'custom', customId: 'consume-dot-burst', status: 'poison', multiplier: 2.0 }],
    },
    tags: ['singleTarget', 'reach', 'dot'],
    xpTags: ['agility', 'willpower'],
    ai: { role: 'attack', priority: 65 },
  },
  {
    id: 'shade-hags-hex',
    school: 'venom',
    tier: 3,
    name: 'Hag’s Hex',
    description:
      'Curse 3 turns (−10% all attributes) and Slow 2 turns on one enemy in any row. Monster technique: learned only by witnessing a Brine Hag use it.',
    cost: 22,
    weight: 1000,
    target: 'enemy',
    effects: [
      { kind: 'applyStatus', status: 'curse', duration: 3 },
      { kind: 'applyStatus', status: 'slow', duration: 2 },
    ],
    prerequisiteId: 'shade-choking-cloud',
    mastery: {
      text: 'Curse −15%.',
      effects: [{ kind: 'applyStatus', status: 'curse', duration: 3, percent: -15, note: 'the Curse this skill applies is −15% all attributes instead of the status’s −10%' }],
    },
    tags: ['control', 'debuff', 'reach'],
    xpTags: ['agility', 'willpower'],
    ai: { role: 'debuff', priority: 55 },
  },
  {
    id: 'shade-shadow-oil',
    school: 'venom',
    tier: 3,
    name: 'Shadow Oil',
    description: 'For 3 turns your attacks deal Shadow element (applying Wither: −50% healing) and +15% damage.',
    cost: 18,
    weight: 800,
    target: 'self',
    effects: [
      { kind: 'custom', customId: 'attacks-become-element', damageType: 'shadow', duration: 3, percent: 15, target: 'self', note: 'for `duration` turns the holder’s attacks deal `damageType` (and apply its mark) and +percent% damage' },
    ],
    prerequisiteId: 'shade-envenom',
    mastery: {
      text: '4 turns, +20%.',
      effects: [{ kind: 'custom', customId: 'attacks-become-element', damageType: 'shadow', duration: 4, percent: 20, target: 'self' }],
    },
    tags: ['buff', 'debuff'],
    xpTags: ['agility', 'willpower'],
    ai: { role: 'buff', priority: 50 },
  },
  {
    id: 'shade-plague-knife',
    school: 'venom',
    tier: 4,
    name: 'Plague Knife',
    description: '2.0× Pierce to one enemy in any row; Poison 4 turns; when a Poisoned target dies, its Poison spreads to every enemy in its row.',
    cost: 30,
    weight: 800,
    target: 'enemy',
    effects: [
      { kind: 'damage', multiplier: 2.0, damageType: 'pierce' },
      { kind: 'applyStatus', status: 'poison', duration: 4 },
      { kind: 'custom', customId: 'poison-spreads-on-death', amount: 1, note: 'when the target dies Poisoned, its Poison spreads to its row (`amount` 2: both rows)' },
    ],
    prerequisiteId: 'shade-venom-burst',
    mastery: {
      text: 'Spreads to both rows.',
      effects: [{ kind: 'custom', customId: 'poison-spreads-on-death', amount: 2 }],
    },
    tags: ['singleTarget', 'reach', 'dot'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'attack', priority: 65 },
  },
  {
    id: 'shade-black-mirror',
    school: 'venom',
    tier: 4,
    name: 'Black Mirror',
    description: 'Strip every buff from one enemy in any row (Fortify, Haste, Shield, Regen) and Curse it for 2 turns.',
    cost: 28,
    weight: 800,
    target: 'enemy',
    effects: [
      { kind: 'custom', customId: 'strip-all-buffs', status: 'shield', amount: 0, note: 'strips every buff; with `amount` 1 the target’s `status` goes to the holder' },
      { kind: 'applyStatus', status: 'curse', duration: 2 },
    ],
    prerequisiteId: 'shade-hags-hex',
    mastery: {
      text: 'Stolen Shield goes to you.',
      effects: [{ kind: 'custom', customId: 'strip-all-buffs', status: 'shield', amount: 1 }],
    },
    tags: ['singleTarget', 'reach', 'debuff'],
    xpTags: ['agility', 'willpower'],
    ai: { role: 'debuff', priority: 55 },
  },
  {
    id: 'shade-nightshade-veins',
    school: 'venom',
    tier: 4,
    name: 'Nightshade Veins',
    description: 'Each tick of your Poison on an enemy restores 3% of your Stamina; Poison on a target below 20% HP ticks double.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'nightshade-veins', percent: 3, amount: 20, target: 'self', note: 'percent% of the pool per tick of your Poison; below `amount`% HP the tick lands twice' },
    ],
    prerequisiteId: 'shade-shadow-oil',
    mastery: {
      text: '5% Stamina.',
      effects: [{ kind: 'custom', customId: 'nightshade-veins', percent: 5, amount: 20, target: 'self' }],
    },
    tags: ['buff', 'dot'],
    xpTags: ['perception'],
    ai: { role: 'attack', priority: 0 },
  },
  {
    id: 'shade-miasma',
    school: 'venom',
    tier: 5,
    name: 'Miasma',
    description: '1.2× Shadow to every enemy in both rows; Poison 4 turns; Blind 1 turn.',
    cost: 45,
    weight: 1400,
    target: 'allEnemies',
    effects: [
      { kind: 'damage', multiplier: 1.2, damageType: 'shadow' },
      { kind: 'applyStatus', status: 'poison', duration: 4 },
      { kind: 'applyStatus', status: 'blind', duration: 1 },
    ],
    prerequisiteId: 'shade-plague-knife',
    mastery: {
      text: '1.5×.',
      effects: [{ kind: 'damage', multiplier: 1.5, damageType: 'shadow' }],
    },
    tags: ['aoe', 'dot', 'debuff'],
    xpTags: ['agility', 'willpower'],
    ai: { role: 'attack', priority: 65 },
  },
  {
    id: 'shade-widows-kiss',
    school: 'venom',
    tier: 5,
    name: 'Widow’s Kiss',
    description: '3.0× Shadow to a front-row enemy; Petrify 1 turn (−1,000 energy) if the target is Poisoned; bosses: Stun 1 turn instead.',
    cost: 40,
    weight: 800,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 3.0, damageType: 'shadow' },
      { kind: 'custom', customId: 'petrify-poisoned-stun-boss', status: 'petrify', duration: 1, note: '`status` for `duration` on a Poisoned target (`amount` 1: any target); a boss is Stunned 1 turn instead' },
    ],
    prerequisiteId: 'shade-black-mirror',
    mastery: {
      text: 'Petrify on any target.',
      effects: [{ kind: 'custom', customId: 'petrify-poisoned-stun-boss', status: 'petrify', duration: 1, amount: 1 }],
    },
    tags: ['singleTarget', 'control'],
    xpTags: ['agility', 'willpower'],
    ai: { role: 'attack', priority: 70 },
  },
  {
    id: 'shade-toxicologist',
    school: 'venom',
    tier: 5,
    name: 'Toxicologist',
    description: 'Your Poison can hold two separate lines on one target (two tick lines, two durations); your DoTs ignore Resistance.',
    type: 'passive',
    effects: [{ kind: 'custom', customId: 'toxicologist', amount: 2, target: 'self', note: '`amount` separate Poison lines per target; your DoTs skip the Resistance roll (stub: a statuses.ts joint)' }],
    prerequisiteId: 'shade-nightshade-veins',
    mastery: {
      text: 'Three lines.',
      effects: [{ kind: 'custom', customId: 'toxicologist', amount: 3, target: 'self' }],
    },
    tags: ['buff', 'dot'],
    xpTags: ['perception'],
    ai: { role: 'attack', priority: 0 },
  },
]

// ---------------------------------------------------------------------------------------------------------------
// §4.3 Larceny — lockpicking, stealing mid-fight, trap tricks, +loot

const larceny: SkillSpec[] = [
  {
    id: 'shade-pickpocket',
    school: 'larceny',
    tier: 1,
    name: 'Pickpocket',
    description: '0.8× Pierce to a front-row enemy and steal gold equal to 5 × its level (once per enemy).',
    cost: 8,
    weight: 800,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 0.8, damageType: 'pierce' },
      { kind: 'custom', customId: 'steal-gold-per-level', amount: 5, note: 'steals gold = amount × the target’s level, once per enemy per fight; a steal over the room’s gold cap pays the cap' },
    ],
    prerequisiteId: null,
    mastery: {
      text: 'Steal 10 × level.',
      effects: [{ kind: 'custom', customId: 'steal-gold-per-level', amount: 10 }],
    },
    tags: ['singleTarget', 'utility'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'attack', priority: 40 },
  },
  {
    id: 'shade-light-fingers',
    school: 'larceny',
    tier: 1,
    name: 'Light Fingers',
    description: 'Lockpicking +2; a locked chest you open rolls one grade up 10% of the time.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'lockpicking-rank-bonus', amount: 2, target: 'self', note: '+amount Lockpicking rank for checks, on top of the class affinity' },
      { kind: 'custom', customId: 'locked-chest-grade-up-chance', percent: 10, target: 'self', note: 'a locked chest the holder opens rolls one grade up percent% of the time' },
    ],
    prerequisiteId: null,
    mastery: {
      text: 'Lockpicking +4; 20%.',
      effects: [
        { kind: 'custom', customId: 'lockpicking-rank-bonus', amount: 4, target: 'self' },
        { kind: 'custom', customId: 'locked-chest-grade-up-chance', percent: 20, target: 'self' },
      ],
    },
    tags: ['utility', 'field'],
    xpTags: ['perception'],
    ai: { role: 'utility', priority: 0 },
  },
  {
    id: 'shade-smoke-pellet',
    school: 'larceny',
    tier: 1,
    name: 'Smoke Pellet',
    description: 'Every ally gains +15% Dodge for 1 turn; the party’s Flee chance is +25% this turn.',
    cost: 10,
    weight: 800,
    target: 'allAllies',
    effects: [
      { kind: 'buffStat', stat: 'dodge', amount: 15, duration: 1 },
      { kind: 'custom', customId: 'flee-chance-bonus', amount: 25, duration: 1, note: 'the party’s Flee chance is +amount pp for `duration` turns' },
    ],
    prerequisiteId: null,
    mastery: {
      text: '2 turns.',
      effects: [
        { kind: 'buffStat', stat: 'dodge', amount: 15, duration: 2 },
        { kind: 'custom', customId: 'flee-chance-bonus', amount: 25, duration: 2 },
      ],
    },
    tags: ['aoe', 'buff', 'mobility'],
    xpTags: ['agility'],
    ai: { role: 'defend', priority: 35 },
  },
  {
    id: 'shade-filch',
    school: 'larceny',
    tier: 2,
    name: 'Filch',
    description: '1.1× Pierce to a front-row enemy; steal a common part from a monster, or a potion from a Grinning Company bandit (once per enemy).',
    cost: 14,
    weight: 800,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 1.1, damageType: 'pierce' },
      { kind: 'custom', customId: 'steal-part', chance: 0, note: 'steals one common part from a monster (a potion from a bandit), once per enemy per fight; chance% of the time the part is a rare one instead' },
    ],
    prerequisiteId: 'shade-pickpocket',
    mastery: {
      text: '25% chance of a rare part instead.',
      effects: [{ kind: 'custom', customId: 'steal-part', chance: 25 }],
    },
    tags: ['singleTarget', 'utility'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'attack', priority: 40 },
  },
  {
    id: 'shade-trap-trick',
    school: 'larceny',
    tier: 2,
    name: 'Trap Trick',
    description: 'In a corridor: pocket a trap you have disarmed (hold up to 2). In combat: throw a pocketed trap at any row for 2.15× Pierce and Root 1 turn.',
    cost: 12,
    weight: 800,
    target: 'enemy',
    effects: [
      { kind: 'custom', customId: 'pocket-trap', amount: 2, target: 'self', note: 'out of combat: pockets a trap the party disarmed, holding up to `amount`; in combat the skill throws one, and the lines below need a pocketed trap' },
      { kind: 'damage', multiplier: 1.6, damageType: 'pierce' },
      { kind: 'applyStatus', status: 'root', duration: 1 },
    ],
    prerequisiteId: 'shade-light-fingers',
    mastery: {
      text: 'Hold 3; thrown traps 2.15×.',
      effects: [
        { kind: 'custom', customId: 'pocket-trap', amount: 3, target: 'self' },
        { kind: 'damage', multiplier: 2.15, damageType: 'pierce' },
      ],
    },
    tags: ['singleTarget', 'reach', 'control', 'utility', 'field'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'attack', priority: 45 },
  },
  {
    id: 'shade-vanish',
    school: 'larceny',
    tier: 2,
    name: 'Vanish',
    description: 'Enter Veil and move to the back row; your next Larceny skill costs 0.',
    cost: 15,
    weight: 800,
    target: 'self',
    effects: [
      { kind: 'applyStatus', status: 'veil', duration: 2 },
      { kind: 'custom', customId: 'move-to-back-row', target: 'self', note: 'moves the holder to the back row; a holder already there stays (a directional move, not a swap)' },
      { kind: 'custom', customId: 'next-school-skill-free', amount: 1, target: 'self', note: 'the holder’s next `amount` skill(s) of this skill’s school cost 0' },
    ],
    prerequisiteId: 'shade-smoke-pellet',
    mastery: {
      text: 'Also +10 Momentum.',
      effects: [{ kind: 'momentum', amount: 10 }],
    },
    tags: ['buff', 'mobility', 'utility'],
    xpTags: ['agility'],
    ai: { role: 'defend', priority: 40 },
  },
  {
    id: 'shade-mug',
    school: 'larceny',
    tier: 3,
    name: 'Mug',
    description: '2.45× Pierce to a front-row enemy; steal gold equal to 15 × its level; against a boss, steal a guaranteed common part.',
    cost: 20,
    weight: 800,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 2.45, damageType: 'pierce' },
      { kind: 'custom', customId: 'steal-gold-per-level', amount: 15 },
      { kind: 'custom', customId: 'steal-boss-part', note: 'against a boss: a guaranteed common part, once per fight' },
    ],
    prerequisiteId: 'shade-filch',
    mastery: {
      text: 'Steal 25 × level.',
      effects: [{ kind: 'custom', customId: 'steal-gold-per-level', amount: 25 }],
    },
    tags: ['singleTarget', 'utility'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'attack', priority: 55 },
  },
  {
    id: 'shade-saboteur',
    school: 'larceny',
    tier: 3,
    name: 'Saboteur',
    description: 'Trap Disarm +2; every successful disarm pockets the trap (for Trap Trick); pocketed traps deal +50%.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'trap-disarm-rank-bonus', amount: 2, target: 'self', note: '+amount Trap Disarm rank for checks' },
      { kind: 'custom', customId: 'pocket-trap-on-disarm', target: 'self', note: 'every successful disarm by the holder pockets the trap (Trap Trick’s pocket, up to its hold)' },
      { kind: 'custom', customId: 'pocketed-trap-damage-percent', percent: 50, target: 'self', note: 'thrown pocketed traps deal +percent%' },
    ],
    prerequisiteId: 'shade-trap-trick',
    mastery: {
      text: 'Disarm failures never trigger on you.',
      effects: [{ kind: 'custom', customId: 'disarm-failure-safe', target: 'self', note: 'a failed disarm by the holder never triggers the trap on the holder' }],
    },
    tags: ['utility', 'field', 'buff'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'utility', priority: 0 },
  },
  {
    id: 'shade-sleight',
    school: 'larceny',
    tier: 3,
    name: 'Sleight',
    description: 'Steal one buff (Fortify, Haste, Shield or Regen) from an enemy in any row and give it to an ally of your choice.',
    cost: 18,
    weight: 800,
    target: 'enemy',
    effects: [
      { kind: 'custom', customId: 'steal-buff', amount: 1, note: 'moves `amount` strippable buff(s) from the target to the chosen ally (the lowest-HP ally on auto)' },
    ],
    prerequisiteId: 'shade-vanish',
    mastery: {
      text: 'Steal two.',
      effects: [{ kind: 'custom', customId: 'steal-buff', amount: 2 }],
    },
    tags: ['singleTarget', 'reach', 'debuff', 'buff', 'utility'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'debuff', priority: 50 },
  },
  {
    id: 'shade-heist',
    school: 'larceny',
    tier: 4,
    name: 'Heist',
    description: '2.4× Pierce to a front-row enemy; its next part roll is made at ×2 (as a part-break); against a bandit, steals its held item.',
    cost: 30,
    weight: 1000,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 2.4, damageType: 'pierce' },
      { kind: 'custom', customId: 'part-break', multiplier: 2, note: 'the target’s rare-part roll is multiplied by multiplier (03 §6.5)' },
      { kind: 'custom', customId: 'steal-bandit-item', note: 'a bandit’s held item (a Small HP Potion), once per enemy' },
    ],
    prerequisiteId: 'shade-mug',
    mastery: {
      text: 'Part roll ×3.',
      effects: [{ kind: 'custom', customId: 'part-break', multiplier: 3 }],
    },
    tags: ['singleTarget', 'utility'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'attack', priority: 55 },
  },
  {
    id: 'shade-treasure-sense',
    school: 'larceny',
    tier: 4,
    name: 'Treasure Sense',
    description: 'Detection +4 for secrets and hidden treasure; the party finds +10% gold.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'treasure-detection-bonus', amount: 4, target: 'self', note: '+amount Detection for secrets and hidden treasure (delve side)' },
      { kind: 'custom', customId: 'gold-found-percent', percent: 10, target: 'self', note: 'the party finds +percent% gold (delve.ts reads it)' },
    ],
    prerequisiteId: 'shade-saboteur',
    mastery: {
      text: '+6 / +20%.',
      effects: [
        { kind: 'custom', customId: 'treasure-detection-bonus', amount: 6, target: 'self' },
        { kind: 'custom', customId: 'gold-found-percent', percent: 20, target: 'self' },
      ],
    },
    tags: ['utility', 'scouting', 'field'],
    xpTags: ['perception'],
    ai: { role: 'utility', priority: 0 },
  },
  {
    id: 'shade-grand-larceny',
    school: 'larceny',
    tier: 4,
    name: 'Grand Larceny',
    description: 'Strip every buff from every enemy; each ally gains Shield = 5% of its max HP per buff stripped.',
    cost: 28,
    weight: 800,
    target: 'allEnemies',
    effects: [
      { kind: 'custom', customId: 'strip-buffs-shield-allies', percent: 5, status: 'haste', amount: 0, target: 'self', note: 'strips every enemy buff; each ally gains Shield = percent% of its max HP per buff (`amount` 1: a stripped `status` becomes Slow)' },
    ],
    prerequisiteId: 'shade-sleight',
    mastery: {
      text: 'Stripped Haste becomes Slow.',
      effects: [{ kind: 'custom', customId: 'strip-buffs-shield-allies', percent: 5, status: 'haste', amount: 1, target: 'self' }],
    },
    tags: ['aoe', 'debuff', 'shield'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'debuff', priority: 55 },
  },
  {
    id: 'shade-kings-ransom',
    school: 'larceny',
    tier: 5,
    name: 'King’s Ransom',
    description: '3.5× Pierce to a front-row enemy; steal gold equal to 50 × its level; against a boss, steal a guaranteed rare part.',
    cost: 45,
    weight: 1000,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 3.5, damageType: 'pierce' },
      { kind: 'custom', customId: 'steal-gold-per-level', amount: 50 },
      { kind: 'custom', customId: 'steal-boss-rare-part', note: 'against a boss: a guaranteed rare part, once per fight' },
    ],
    prerequisiteId: 'shade-heist',
    mastery: {
      text: 'Steal 80 × level.',
      effects: [{ kind: 'custom', customId: 'steal-gold-per-level', amount: 80 }],
    },
    tags: ['singleTarget', 'utility'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'attack', priority: 60 },
  },
  {
    id: 'shade-phantom-thief',
    school: 'larceny',
    tier: 5,
    name: 'Phantom Thief',
    description: 'Locked chests open without a check and their traps are disarmed; your Fortune cap is 35%; in-dungeon chests roll a grade up twice as often for you.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'phantom-thief-chests', percent: 200, target: 'self', note: 'locked chests open with no check and no trap; chests roll a grade up percent% as often (delve side)' },
      { kind: 'custom', customId: 'fortune-cap-raise', amount: 35, target: 'self', note: 'the Fortune cap becomes amount% (stub: a stats.ts joint)' },
    ],
    prerequisiteId: 'shade-treasure-sense',
    mastery: {
      text: 'Also Skeleton Keys are never consumed.',
      effects: [{ kind: 'custom', customId: 'keys-never-consumed', target: 'self', note: 'Skeleton Keys are never used up (delve side)' }],
    },
    tags: ['utility', 'field'],
    xpTags: ['perception'],
    ai: { role: 'utility', priority: 0 },
  },
  {
    id: 'shade-vault-cracker',
    school: 'larceny',
    tier: 5,
    name: 'Vault Cracker',
    description: 'Corridor: open any locked door or chest with no check and no trap. Combat: 2.0× Pierce that ignores all Defense against constructs and armored elites (vault sentinels, bone knights, forge-golems).',
    cost: 40,
    weight: 1400,
    target: 'enemy',
    effects: [
      { kind: 'custom', customId: 'corridor-open-locks', target: 'room', note: 'corridor use: any locked door or chest opens with no check and no trap (delve side)' },
      { kind: 'custom', customId: 'ignore-defense-vs-armored', percent: 100, target: 'self', note: 'this action ignores percent% of the Defense of constructs and elite-role monsters' },
      { kind: 'damage', multiplier: 2.0, damageType: 'pierce' },
    ],
    prerequisiteId: 'shade-grand-larceny',
    mastery: {
      text: '2.6×.',
      effects: [{ kind: 'damage', multiplier: 2.6, damageType: 'pierce' }],
    },
    tags: ['singleTarget', 'reach', 'utility'],
    xpTags: ['agility', 'perception'],
    ai: { role: 'attack', priority: 55 },
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

const skills = [...shadow, ...venom, ...larceny]
const r = writeClassRecords(CLASS_ID, classRecord, skills.map(toRecord))
process.stdout.write(
  `${CLASS_ID}: 1 class + ${skills.length} skills (${skills.filter((s) => s.isUltimate).length} Ultimate) — ${r.written} written, ${r.unchanged} unchanged${r.removed.length ? `, removed ${r.removed.join(', ')}` : ''}\n`,
)

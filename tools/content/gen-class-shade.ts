/**
 * tools/content/gen-class-shade.ts — writes content/classes/shade.json and content/skills/shade/*.json
 * from docs/classes/shade.md (§2 numbers, §3 the Ultimate, §4.1–§4.3 the three school tables, §5 affinities).
 *
 * Phase 3 (12-ROADMAP): Tiers I–III of every school (27 skills) plus the Ultimate. Tiers IV–V are not written yet.
 * Every number is the sheet's; where a line cannot be said in the effect DSL it is a `custom` line whose `note`
 * states the hook's contract (content/README.md rule 31 wants a handler per customId in sim/src/skills/custom/).
 *
 * Re-runnable: the same tables write the same files. Run: node tools/content/gen-class-shade.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CLASS_ID = 'shade'
const RANK_SCALING = { effectPerRank: 4, costPerRank: -2 }

type Json = Record<string, unknown>
type Effect = Json & { kind: string }

interface SkillSpec {
  id: string
  school: 'shadow' | 'venom' | 'larceny'
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
  aiRuleDefault: 'IF self HP < 30% THEN item small hp potion on self; IF self not status veil THEN veil; ELSE backstab on weakest enemy',
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
    description: '1.5× Pierce to one enemy in any row (flank: the back row from the front). From Veil the hit is doubled and gets +30% Crit Rate.',
    cost: 12,
    weight: 800,
    target: 'enemy',
    effects: [
      { kind: 'damage', multiplier: 1.5, damageType: 'pierce' },
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
    description: '1.3× Pierce to a front-row enemy; Silence 2 turns (no skills); +50% damage against a Dazed target.',
    cost: 15,
    weight: 800,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 1.3, damageType: 'pierce' },
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
      'Veil 2 turns that your own Poison ticks do not break; your next attack is Shadow element and applies Wither (−50% healing) for 2 turns. Monster technique: Insights only while a wraith uses the move (the wraith arrives with the Crypts in Phase 7).',
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
    description: '1.9× Pierce to a front-row enemy; against a target below 25% HP, 3.8×.',
    cost: 20,
    weight: 800,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 1.9, damageType: 'pierce' },
      { kind: 'custom', customId: 'execute-multiplier', multiplier: 3.8, percent: 25, note: 'when the target’s HP is below percent% of max, this skill’s damage multiplier becomes `multiplier` instead' },
    ],
    prerequisiteId: 'shade-throat-cut',
    requirements: DAGGER,
    mastery: {
      text: 'Threshold 30%.',
      effects: [{ kind: 'custom', customId: 'execute-multiplier', multiplier: 3.8, percent: 30 }],
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
]

// ---------------------------------------------------------------------------------------------------------------
// §4.2 Venom — poison, debuffs, Shadow element

const venom: SkillSpec[] = [
  {
    id: 'shade-toxic-jab',
    school: 'venom',
    tier: 1,
    name: 'Toxic Jab',
    description: '1.0× Pierce to a front-row enemy; Poison 3 turns (re-applying refreshes the duration).',
    cost: 10,
    weight: 800,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 1.0, damageType: 'pierce' },
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
    description: '1.2× Pierce to a front-row enemy; if the target is Poisoned, also Weaken 2 turns.',
    cost: 15,
    weight: 800,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 1.2, damageType: 'pierce' },
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
    description: '1.6× Shadow to one enemy in any row; consumes the target’s Poison and deals its remaining ticks ×1.5 at once.',
    cost: 24,
    weight: 1000,
    target: 'enemy',
    effects: [
      { kind: 'damage', multiplier: 1.6, damageType: 'shadow' },
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
      'Curse 3 turns (−10% all attributes) and Slow 2 turns on one enemy in any row. Monster technique: Insights only while a brine hag uses it (the brine hag arrives with the Drowned Vault in Phase 7).',
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
]

// ---------------------------------------------------------------------------------------------------------------
// §4.3 Larceny — lockpicking, stealing mid-fight, trap tricks, +loot

const larceny: SkillSpec[] = [
  {
    id: 'shade-pickpocket',
    school: 'larceny',
    tier: 1,
    name: 'Pickpocket',
    description: '0.6× Pierce to a front-row enemy and steal gold equal to 5 × its level (once per enemy).',
    cost: 8,
    weight: 800,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 0.6, damageType: 'pierce' },
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
    description: '0.8× Pierce to a front-row enemy; steal a common part from a monster, or a potion from a Grinning Company bandit (once per enemy).',
    cost: 14,
    weight: 800,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 0.8, damageType: 'pierce' },
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
    description: 'In a corridor: pocket a trap you have disarmed (hold up to 2). In combat: throw a pocketed trap at any row for 1.2× Pierce and Root 1 turn.',
    cost: 12,
    weight: 800,
    target: 'enemy',
    effects: [
      { kind: 'custom', customId: 'pocket-trap', amount: 2, target: 'self', note: 'out of combat: pockets a trap the party disarmed, holding up to `amount`; in combat the skill throws one, and the lines below need a pocketed trap' },
      { kind: 'damage', multiplier: 1.2, damageType: 'pierce' },
      { kind: 'applyStatus', status: 'root', duration: 1 },
    ],
    prerequisiteId: 'shade-light-fingers',
    mastery: {
      text: 'Hold 3; thrown traps 1.6×.',
      effects: [
        { kind: 'custom', customId: 'pocket-trap', amount: 3, target: 'self' },
        { kind: 'damage', multiplier: 1.6, damageType: 'pierce' },
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
    description: '1.8× Pierce to a front-row enemy; steal gold equal to 15 × its level; against a boss, steal a guaranteed common part.',
    cost: 20,
    weight: 800,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 1.8, damageType: 'pierce' },
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

const skills = [...shadow, ...venom, ...larceny]
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

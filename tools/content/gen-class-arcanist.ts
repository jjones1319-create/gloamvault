/**
 * tools/content/gen-class-arcanist.ts — writes content/classes/arcanist.json and content/skills/arcanist/*.json
 * from docs/classes/arcanist.md (§2 numbers, §3 the Ultimate, §4.1–§4.3 the three school tables, §5 affinities).
 *
 * Phase 3 (12-ROADMAP): Tiers I–III of every school (27 skills) plus the Ultimate. Tiers IV–V are not written yet.
 * Every number is the sheet's; where a line cannot be said in the effect DSL it is a `custom` line whose `note`
 * states the hook's contract (content/README.md rule 31 wants a handler per customId in sim/src/skills/custom/).
 * Spells hit either row (03 §3.3), so every enemy-targeting spell carries the `reach` tag; a row-wide spell targets
 * `enemyFront`/`enemyBack` and its lines hit `enemyRow`. Heavy (1,400) casts are charged per D-029 and train Willpower.
 *
 * Re-runnable: the same tables write the same files. Run: node tools/content/gen-class-arcanist.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CLASS_ID = 'arcanist'
const RANK_SCALING = { effectPerRank: 4, costPerRank: -2 }

type Json = Record<string, unknown>
type Effect = Json & { kind: string }

interface SkillSpec {
  id: string
  school: 'evocation' | 'rime' | 'arcana'
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

// ---------------------------------------------------------------------------------------------------------------
// The class record (§1, §2, §5, §9)

const classRecord: Json = {
  id: CLASS_ID,
  name: 'Arcanist',
  role: 'caster: the party’s artillery and its clock',
  description:
    'Robes, a wand or a staff, and the biggest spells in the game. The Arcanist clears rows with Fire and Frost, hands out Haste and pushes bosses back down the timeline, and pays for it in cloth: every heavy cast has a window in which a hit can knock it away.',
  attributeMods: { wisdom: 2, perception: 1, willpower: 1 },
  pool: 'mana',
  armorFamily: 'robes',
  weaponTypes: ['staff', 'wand', 'focus'],
  schools: [
    { id: 'evocation', name: 'Evocation', philosophy: 'Fire and Lightning: the room is the target. Damage first, status second, Mana third; every skill hits more than one thing or makes the next hit bigger.' },
    { id: 'rime', name: 'Rime', philosophy: 'Frost: slow them, stop them, break them. Chill costs enemies turns, a second Chill is a Freeze, and a Frozen enemy is glass for the whole party.' },
    { id: 'arcana', name: 'Arcana', philosophy: 'The timeline, the Shield, the lantern. Arcana never kills anything; it decides who acts when, who gets hit, and whether the party can see.' },
  ],
  ultimateSkillId: 'arcanist-prismatic-ruin',
  starterKit: [
    'pine-wand',
    'pine-orb',
    'burlap-cowl',
    'burlap-robe',
    'burlap-leggings',
    'burlap-slippers',
    'burlap-wraps',
    'ring-of-the-mind',
    'small-hp-potion',
    'torch',
    'repair-kit',
    'bandage',
  ],
  starterSkillIds: ['arcanist-ember-lance', 'arcanist-frostbolt', 'arcanist-arcane-ward'],
  fieldSkillAffinities: [
    { fieldSkill: 'cartography', rankBonus: 2 },
    { fieldSkill: 'haggling', rankBonus: 2 },
  ],
  monsterTechniqueIds: [],
  aiRuleDefault: 'IF self HP < 30% THEN item small hp potion on self; IF ally HP < 50% THEN arcane ward on lowest ally; ELSE ember lance on weakest enemy',
  visual: {
    gearSetId: 'arcanist-burlap-robes',
    palette: ['#2a2f6e', '#8a8a8f', '#e8742a', '#b5853a'],
    notes:
      'A tall narrow wedge: a long robe flaring at the hem, a high hood or collar, the staff or wand held out from the body so its light reads across the room. The off-hand tome glows while a heavy cast charges, so the interrupt window is visible.',
  },
  pros: [
    'Biggest AoE in the game: Firewave at Tier II, Meteor and Avalanche at Tier III',
    'Controls the timeline: Haste, Chill and Freeze, Daze and push-back',
    'Utility nobody else has: Dispel, identify on pickup, light from the back row',
  ],
  cons: [
    'Robes add 0 Defense: the most fragile class in the game',
    'Heavy (1,400) casts can be interrupted unless the Willpower check holds',
    'Mana runs dry if spammed: three Tier II casts spend most of a level-7 pool',
  ],
}

// ---------------------------------------------------------------------------------------------------------------
// §4.1 Evocation — Fire and Lightning: the room is the target

const evocation: SkillSpec[] = [
  {
    id: 'arcanist-ember-lance',
    school: 'evocation',
    tier: 1,
    name: 'Ember Lance',
    description: '1.4× Fire to one enemy in either row; Burn 3 turns.',
    cost: 10,
    weight: 1000,
    target: 'enemy',
    effects: [
      { kind: 'damage', multiplier: 1.4, damageType: 'fire' },
      { kind: 'applyStatus', status: 'burn', duration: 3 },
    ],
    prerequisiteId: null,
    mastery: { text: 'Burn 4 turns.', effects: [{ kind: 'applyStatus', status: 'burn', duration: 4 }] },
    tags: ['singleTarget', 'dot', 'reach'],
    xpTags: ['wisdom'],
    ai: { role: 'attack', priority: 65 },
  },
  {
    id: 'arcanist-spark',
    school: 'evocation',
    tier: 1,
    name: 'Spark',
    description: '1.2× Lightning to one enemy in either row; Shock 2 turns. If the target was already Shocked, the bolt chains 0.5× to one adjacent enemy.',
    cost: 8,
    weight: 800,
    target: 'enemy',
    effects: [
      { kind: 'damage', multiplier: 1.2, damageType: 'lightning' },
      { kind: 'applyStatus', status: 'shock', duration: 2 },
      { kind: 'custom', customId: 'chain-if-shocked', multiplier: 0.5, damageType: 'lightning', amount: 1, note: 'if the target held Shock before this hit, the hit chains multiplier× as damageType to `amount` adjacent enemies' },
    ],
    prerequisiteId: null,
    mastery: { text: 'Chains to two.', effects: [{ kind: 'custom', customId: 'chain-if-shocked', multiplier: 0.5, damageType: 'lightning', amount: 2 }] },
    tags: ['singleTarget', 'debuff', 'reach'],
    xpTags: ['wisdom'],
    ai: { role: 'attack', priority: 55 },
  },
  {
    id: 'arcanist-kindling',
    school: 'evocation',
    tier: 1,
    name: 'Kindling',
    description: 'Fire and Lightning skills +8%; the first Evocation cast of each fight costs 0 Mana.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'school-damage-percent', percent: 8, target: 'self', note: 'skills of this skill’s school (Evocation: Fire and Lightning) deal +percent%' },
      { kind: 'custom', customId: 'first-school-cast-free', target: 'self', note: 'the holder’s first cast of this skill’s school each fight costs 0 pool' },
    ],
    prerequisiteId: null,
    mastery: { text: '+12%.', effects: [{ kind: 'custom', customId: 'school-damage-percent', percent: 12, target: 'self' }] },
    tags: ['buff'],
    xpTags: ['wisdom'],
    ai: { role: 'buff', priority: 0 },
  },
  {
    id: 'arcanist-firewave',
    school: 'evocation',
    tier: 2,
    name: 'Firewave',
    description: '0.9× Fire to every front-row enemy; Burn 2 turns. Heavy cast: declared at 1,000 energy, resolves 400 later, and a hit in the window can cancel it.',
    cost: 16,
    weight: 1400,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 0.9, damageType: 'fire', target: 'enemyRow', note: 'the whole front row' },
      { kind: 'applyStatus', status: 'burn', duration: 2, target: 'enemyRow' },
    ],
    prerequisiteId: 'arcanist-ember-lance',
    mastery: { text: '1.0× each.', effects: [{ kind: 'damage', multiplier: 1.0, damageType: 'fire', target: 'enemyRow' }] },
    tags: ['aoe', 'dot'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'attack', priority: 70 },
  },
  {
    id: 'arcanist-arc-chain',
    school: 'evocation',
    tier: 2,
    name: 'Arc Chain',
    description: '1.5× Lightning to one enemy in either row, then 0.7× to up to 2 other enemies; all of them Shock 2 turns; Shocked targets take +15% from this skill.',
    cost: 15,
    weight: 1000,
    target: 'enemy',
    effects: [
      { kind: 'custom', customId: 'damage-bonus-vs-status', status: 'shock', percent: 15, note: 'this skill’s damage is +percent% against a target under `status`' },
      { kind: 'damage', multiplier: 1.5, damageType: 'lightning' },
      { kind: 'applyStatus', status: 'shock', duration: 2 },
      { kind: 'custom', customId: 'chain-damage', multiplier: 0.7, damageType: 'lightning', amount: 2, status: 'shock', duration: 2, note: 'after the main hit, deals multiplier× as damageType to up to `amount` other enemies and applies `status` for `duration` to each' },
    ],
    prerequisiteId: 'arcanist-spark',
    mastery: { text: 'Chains to 3 others.', effects: [{ kind: 'custom', customId: 'chain-damage', multiplier: 0.7, damageType: 'lightning', amount: 3, status: 'shock', duration: 2 }] },
    tags: ['singleTarget', 'aoe', 'debuff', 'reach'],
    xpTags: ['wisdom'],
    ai: { role: 'attack', priority: 65 },
  },
  {
    id: 'arcanist-backdraft',
    school: 'evocation',
    tier: 2,
    name: 'Backdraft',
    description: 'When a Burning enemy dies, its Burn jumps to a random living enemy and you gain +10 Momentum.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'burn-jumps-on-death', amount: 10, target: 'self', note: 'when a Burning enemy dies its Burn moves to a random living enemy and the holder gains +amount Momentum' },
    ],
    prerequisiteId: 'arcanist-kindling',
    mastery: { text: '+15 Momentum.', effects: [{ kind: 'custom', customId: 'burn-jumps-on-death', amount: 15, target: 'self' }] },
    tags: ['buff', 'dot', 'momentum'],
    xpTags: ['wisdom'],
    ai: { role: 'buff', priority: 0 },
  },
  {
    id: 'arcanist-meteor',
    school: 'evocation',
    tier: 3,
    name: 'Meteor',
    description: '1.2× Fire to every enemy in both rows; Burn 3 turns; any target already Burning is also Dazed (−500 energy). Heavy cast.',
    cost: 26,
    weight: 1400,
    target: 'allEnemies',
    effects: [
      { kind: 'custom', customId: 'apply-if-burn', status: 'daze', note: 'applies `status` only to a target holding Burn before this cast (resolved before the new Burn below)' },
      { kind: 'damage', multiplier: 1.2, damageType: 'fire' },
      { kind: 'applyStatus', status: 'burn', duration: 3 },
    ],
    prerequisiteId: 'arcanist-firewave',
    mastery: { text: '1.35× each.', effects: [{ kind: 'damage', multiplier: 1.35, damageType: 'fire' }] },
    tags: ['aoe', 'dot', 'control'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'attack', priority: 75 },
  },
  {
    id: 'arcanist-thunderhead',
    school: 'evocation',
    tier: 3,
    name: 'Thunderhead',
    description: '1.0× Lightning to every enemy in both rows; every target already Shocked has a 30% chance of Stun 1 turn.',
    cost: 22,
    weight: 1000,
    target: 'allEnemies',
    effects: [
      { kind: 'damage', multiplier: 1.0, damageType: 'lightning' },
      { kind: 'custom', customId: 'apply-if-shock', status: 'stun', chance: 30, duration: 1, note: 'applies `status` for `duration` at chance% only to a target holding Shock' },
    ],
    prerequisiteId: 'arcanist-arc-chain',
    mastery: { text: 'Stun chance 45%.', effects: [{ kind: 'custom', customId: 'apply-if-shock', status: 'stun', chance: 45, duration: 1 }] },
    tags: ['aoe', 'control'],
    xpTags: ['wisdom'],
    ai: { role: 'attack', priority: 70 },
  },
  {
    id: 'arcanist-overcharge',
    school: 'evocation',
    tier: 3,
    name: 'Overcharge',
    description: 'Evocation crits deal +30% Crit Damage and refund 10% of the skill’s Mana cost.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'school-crit-damage-bonus', amount: 30, target: 'self', note: 'crits by skills of this skill’s school deal +amount pp Crit Damage' },
      { kind: 'custom', customId: 'school-crit-refund-percent', percent: 10, target: 'self', note: 'a crit by a skill of this skill’s school refunds percent% of its pool cost' },
    ],
    prerequisiteId: 'arcanist-backdraft',
    mastery: { text: 'Refund 20%.', effects: [{ kind: 'custom', customId: 'school-crit-refund-percent', percent: 20, target: 'self' }] },
    tags: ['buff'],
    xpTags: ['perception', 'wisdom'],
    ai: { role: 'buff', priority: 0 },
  },
  {
    id: 'arcanist-prismatic-ruin',
    school: 'evocation',
    tier: 3,
    name: 'Prismatic Ruin',
    description:
      'Every enemy in both rows takes 2.4× spell Attack as the element it is weakest to among Fire, Frost and Lightning (Fire if none; immunities respected), then Burn 2, Chill 1 and Shock 2. You refund 30% of max Mana. 100 Momentum; weight 1,400 but cannot be interrupted; never misses.',
    cost: 0,
    weight: 1400,
    target: 'allEnemies',
    isUltimate: true,
    effects: [
      { kind: 'custom', customId: 'damage-weakest-of-fire-frost-lightning', multiplier: 2.4, note: 'deals multiplier × spell Attack as whichever of Fire, Frost and Lightning the target is weakest to; Fire when none; an immune element is never chosen' },
      { kind: 'applyStatus', status: 'burn', duration: 2 },
      { kind: 'applyStatus', status: 'chill', duration: 1 },
      { kind: 'applyStatus', status: 'shock', duration: 2 },
      { kind: 'pool', percent: 30, target: 'self', note: 'refund 30% of max Mana on resolution' },
    ],
    prerequisiteId: 'arcanist-firewave',
    mastery: { text: NO_MASTERY_TEXT, effects: [] },
    tags: ['aoe', 'dot', 'debuff'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'attack', priority: 95 },
  },
]

// ---------------------------------------------------------------------------------------------------------------
// §4.2 Rime — Frost: slow them, stop them, break them

const rime: SkillSpec[] = [
  {
    id: 'arcanist-frostbolt',
    school: 'rime',
    tier: 1,
    name: 'Frostbolt',
    description: '1.3× Frost to one enemy in either row; Chill 2 turns.',
    cost: 10,
    weight: 1000,
    target: 'enemy',
    effects: [
      { kind: 'damage', multiplier: 1.3, damageType: 'frost' },
      { kind: 'applyStatus', status: 'chill', duration: 2 },
    ],
    prerequisiteId: null,
    mastery: { text: 'Chill 3 turns.', effects: [{ kind: 'applyStatus', status: 'chill', duration: 3 }] },
    tags: ['singleTarget', 'control', 'debuff', 'reach'],
    xpTags: ['wisdom'],
    ai: { role: 'attack', priority: 60 },
  },
  {
    id: 'arcanist-frost-floor',
    school: 'rime',
    tier: 1,
    name: 'Frost Floor',
    description: '0.7× Frost to every front-row enemy; Chill 1 turn.',
    cost: 12,
    weight: 1000,
    target: 'enemyFront',
    effects: [
      { kind: 'damage', multiplier: 0.7, damageType: 'frost', target: 'enemyRow', note: 'the whole front row' },
      { kind: 'applyStatus', status: 'chill', duration: 1, target: 'enemyRow' },
    ],
    prerequisiteId: null,
    mastery: { text: '0.8× each.', effects: [{ kind: 'damage', multiplier: 0.8, damageType: 'frost', target: 'enemyRow' }] },
    tags: ['aoe', 'debuff'],
    xpTags: ['wisdom'],
    ai: { role: 'attack', priority: 55 },
  },
  {
    id: 'arcanist-shatter',
    school: 'rime',
    tier: 1,
    name: 'Shatter',
    description: 'Any hit from any ally on a Frozen enemy deals +30% and crits; the Freeze ends and the enemy is pushed back 300 energy as it breaks free.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'party-shatter-bonus', percent: 30, energy: -300, target: 'self', note: 'while the holder is in the fight, any ally’s hit on a Frozen enemy deals +percent% and crits; the Freeze ends and the target’s accumulator moves by `energy`' },
    ],
    prerequisiteId: null,
    mastery: { text: '+40%.', effects: [{ kind: 'custom', customId: 'party-shatter-bonus', percent: 40, energy: -300, target: 'self' }] },
    tags: ['buff', 'control'],
    xpTags: ['wisdom'],
    ai: { role: 'buff', priority: 0 },
  },
  {
    id: 'arcanist-glacier-spike',
    school: 'rime',
    tier: 2,
    name: 'Glacier Spike',
    description: '1.9× Frost to one enemy in either row; Chill 2 turns, and a target already Chilled is Frozen at once. Heavy cast.',
    cost: 16,
    weight: 1400,
    target: 'enemy',
    effects: [
      { kind: 'damage', multiplier: 1.9, damageType: 'frost' },
      { kind: 'applyStatus', status: 'chill', duration: 2, note: 'a second Chill becomes Freeze 1 by the status rule (chill.upgradesTo); bosses take Chill only (03 §3.5)' },
    ],
    prerequisiteId: 'arcanist-frostbolt',
    mastery: { text: '2.1×.', effects: [{ kind: 'damage', multiplier: 2.1, damageType: 'frost' }] },
    tags: ['singleTarget', 'control', 'reach'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'attack', priority: 70 },
  },
  {
    id: 'arcanist-ice-wall',
    school: 'rime',
    tier: 2,
    name: 'Ice Wall',
    description: 'A wall with HP equal to 25% of your max HP absorbs melee hits aimed at the party’s front row until it breaks or 2 turns pass; an enemy that strikes it is Chilled 1 turn.',
    cost: 18,
    weight: 1000,
    target: 'partyFront',
    effects: [
      { kind: 'custom', customId: 'ice-wall', percent: 25, duration: 2, status: 'chill', note: 'a wall with HP = percent% of the caster’s max HP absorbs melee hits aimed at the party’s front row for `duration` turns or until broken; a melee attacker that strikes it gets `status` 1' },
    ],
    prerequisiteId: 'arcanist-frost-floor',
    mastery: { text: 'Wall HP 35%.', effects: [{ kind: 'custom', customId: 'ice-wall', percent: 35, duration: 2, status: 'chill' }] },
    tags: ['shield', 'aoe', 'control'],
    xpTags: ['wisdom'],
    ai: { role: 'defend', priority: 55 },
  },
  {
    id: 'arcanist-permafrost',
    school: 'rime',
    tier: 2,
    name: 'Permafrost',
    description: 'Chill you apply lasts +1 turn and takes a further −10% Speed; Frost skills +8%.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'chill-duration-bonus', amount: 1, target: 'self', note: 'Chill the holder applies lasts +amount turns' },
      { kind: 'custom', customId: 'chill-speed-percent-bonus', percent: -10, target: 'self', note: 'Chill the holder applies moves Speed a further percent% (on top of the status’s ×0.75)' },
      { kind: 'custom', customId: 'school-damage-percent', percent: 8, target: 'self', note: 'skills of this skill’s school (Rime: Frost) deal +percent%' },
    ],
    prerequisiteId: 'arcanist-shatter',
    mastery: { text: 'Frost skills +12%.', effects: [{ kind: 'custom', customId: 'school-damage-percent', percent: 12, target: 'self' }] },
    tags: ['buff', 'debuff'],
    xpTags: ['wisdom'],
    ai: { role: 'buff', priority: 0 },
  },
  {
    id: 'arcanist-avalanche',
    school: 'rime',
    tier: 3,
    name: 'Avalanche',
    description: '1.2× Frost to every enemy in both rows; Chill 2 turns; Frozen targets are shattered by this hit even without the Shatter passive. Heavy cast.',
    cost: 26,
    weight: 1400,
    target: 'allEnemies',
    effects: [
      { kind: 'custom', customId: 'shatter-frozen', note: 'this skill’s damage shatters Frozen targets as Shatter does (+30%, crit, Freeze ends, −300 energy) even when no ally holds the passive' },
      { kind: 'damage', multiplier: 1.2, damageType: 'frost' },
      { kind: 'applyStatus', status: 'chill', duration: 2 },
    ],
    prerequisiteId: 'arcanist-glacier-spike',
    mastery: { text: '1.35× each.', effects: [{ kind: 'damage', multiplier: 1.35, damageType: 'frost' }] },
    tags: ['aoe', 'control'],
    xpTags: ['wisdom', 'willpower'],
    ai: { role: 'attack', priority: 75 },
  },
  {
    id: 'arcanist-frozen-tomb',
    school: 'rime',
    tier: 3,
    name: 'Frozen Tomb',
    description: 'On an enemy in either row: Freeze 2 turns, no damage (bosses take Chill, as the status rules say). On an ally instead: encased, immune to all damage until their next turn, then Chill 1 turn.',
    cost: 22,
    weight: 1000,
    target: 'enemy',
    effects: [
      { kind: 'applyStatus', status: 'freeze', duration: 2, note: 'the sheet says bosses Freeze 1; the rulebook’s status table (03 §3.5, the owner) makes a boss take Chill instead, so the status’s bossBecomes rules' },
      { kind: 'custom', customId: 'ally-mode-encase', duration: 1, status: 'chill', note: 'when the chosen target is an ally the skill’s other lines are skipped; the ally is immune to all damage until its next turn, then gets `status` 1 (no status when omitted)' },
    ],
    prerequisiteId: 'arcanist-ice-wall',
    mastery: { text: 'An encased ally keeps no Chill.', effects: [{ kind: 'custom', customId: 'ally-mode-encase', duration: 1 }] },
    tags: ['control', 'reach', 'shield'],
    xpTags: ['wisdom'],
    ai: { role: 'control', priority: 60 },
  },
  {
    id: 'arcanist-hoarfrost',
    school: 'rime',
    tier: 3,
    name: 'Hoarfrost',
    description: 'At fight start every enemy in the front row is Chilled 1 turn; Chilled enemies also lose 10% Accuracy.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'fight-start-apply-status', status: 'chill', duration: 1, target: 'enemyFront', note: 'at fight start, applies `status` for `duration` to every enemy in the row `target` names (enemyFront = the front row; allEnemies = both)' },
      { kind: 'custom', customId: 'chill-accuracy-penalty', amount: -10, target: 'self', note: 'while the holder is in the fight, Chilled enemies have `amount` pp Accuracy' },
    ],
    prerequisiteId: 'arcanist-permafrost',
    mastery: { text: 'Both rows.', effects: [{ kind: 'custom', customId: 'fight-start-apply-status', status: 'chill', duration: 1, target: 'allEnemies' }] },
    tags: ['debuff', 'control'],
    xpTags: ['wisdom'],
    ai: { role: 'buff', priority: 0 },
  },
]

// ---------------------------------------------------------------------------------------------------------------
// §4.3 Arcana — the timeline, the Shield, the lantern

const arcana: SkillSpec[] = [
  {
    id: 'arcanist-arcane-ward',
    school: 'arcana',
    tier: 1,
    name: 'Arcane Ward',
    description: 'Shield one ally for 18% of their max HP for 3 turns.',
    cost: 10,
    weight: 800,
    target: 'ally',
    effects: [{ kind: 'shield', percent: 18, duration: 3, note: 'percent of the holder’s (the target’s) max HP, as 03 §3.5 and the sheet say' }],
    prerequisiteId: null,
    mastery: { text: 'Shield 22%.', effects: [{ kind: 'shield', percent: 22, duration: 3 }] },
    tags: ['singleTarget', 'shield'],
    xpTags: ['wisdom'],
    ai: { role: 'defend', priority: 55 },
  },
  {
    id: 'arcanist-quicken',
    school: 'arcana',
    tier: 1,
    name: 'Quicken',
    description: 'One ally gains Haste 1 turn and +200 energy at once (they jump up the strip).',
    cost: 12,
    weight: 800,
    target: 'ally',
    effects: [
      { kind: 'applyStatus', status: 'haste', duration: 1 },
      { kind: 'timeline', energy: 200 },
    ],
    prerequisiteId: null,
    mastery: { text: '+300 energy.', effects: [{ kind: 'timeline', energy: 300 }] },
    tags: ['singleTarget', 'buff'],
    xpTags: ['wisdom'],
    ai: { role: 'buff', priority: 50 },
  },
  {
    id: 'arcanist-attune',
    school: 'arcana',
    tier: 1,
    name: 'Attune',
    description: 'Mana regen 8% → 11% per own turn; items are identified on pickup; the party’s Light falls 1 less per new room.',
    type: 'passive',
    effects: [
      { kind: 'custom', customId: 'pool-regen-percent-bonus', amount: 3, target: 'self', note: 'the holder’s per-turn pool regen is +amount percentage points (8% → 11%)' },
      { kind: 'custom', customId: 'identify-on-pickup', target: 'self', note: 'items the party picks up are identified at once' },
      { kind: 'custom', customId: 'light-decay-reduction', amount: 1, target: 'self', note: 'the party’s Light falls `amount` less per new room' },
    ],
    prerequisiteId: null,
    mastery: { text: 'Regen 13%.', effects: [{ kind: 'custom', customId: 'pool-regen-percent-bonus', amount: 5, target: 'self' }] },
    tags: ['utility', 'buff', 'light'],
    xpTags: ['wisdom'],
    ai: { role: 'utility', priority: 0 },
  },
  {
    id: 'arcanist-blink-step',
    school: 'arcana',
    tier: 2,
    name: 'Blink Step',
    description: 'You or one ally swap rows at once, ignoring Root, Web and Grab, and gain +15% Dodge until the target’s next turn.',
    cost: 8,
    weight: 800,
    target: 'ally',
    effects: [
      { kind: 'custom', customId: 'row-swap-ignores-root', note: 'this skill’s row swap succeeds under Root, Web and Grab' },
      { kind: 'rowSwap', note: 'self or one ally: with no ally chosen the caster swaps' },
      { kind: 'buffStat', stat: 'dodge', amount: 15, duration: 1, note: 'until the target’s next turn' },
    ],
    prerequisiteId: 'arcanist-quicken',
    mastery: { text: 'Also breaks Taunt.', effects: [{ kind: 'removeStatus', status: 'taunt' }] },
    tags: ['mobility', 'buff'],
    xpTags: ['wisdom'],
    ai: { role: 'utility', priority: 40 },
  },
  {
    id: 'arcanist-mirror-ward',
    school: 'arcana',
    tier: 2,
    name: 'Mirror Ward',
    description: 'Every ally gains a Shield of 12% max HP for 2 turns; 20% of the damage it absorbs is returned to the attacker as Lightning.',
    cost: 16,
    weight: 1000,
    target: 'allAllies',
    effects: [
      { kind: 'shield', percent: 12, duration: 2 },
      { kind: 'custom', customId: 'shield-reflect-percent', percent: 20, damageType: 'lightning', note: 'percent% of the damage this skill’s Shield absorbs is returned to the attacker as damageType' },
    ],
    prerequisiteId: 'arcanist-arcane-ward',
    mastery: { text: 'Return 30%.', effects: [{ kind: 'custom', customId: 'shield-reflect-percent', percent: 30, damageType: 'lightning' }] },
    tags: ['aoe', 'shield'],
    xpTags: ['wisdom'],
    ai: { role: 'defend', priority: 55 },
  },
  {
    id: 'arcanist-siphon',
    school: 'arcana',
    tier: 2,
    name: 'Siphon',
    description: 'Costs no Mana. You restore 25% of max Mana from one enemy in either row; if the target is a caster it is Silenced 1 turn.',
    cost: 0,
    weight: 1000,
    target: 'enemy',
    effects: [
      { kind: 'pool', percent: 25, target: 'self' },
      { kind: 'custom', customId: 'apply-if-caster', status: 'silence', duration: 1, note: 'applies `status` for `duration` only if the target is a caster (a monster with a spell attack)' },
    ],
    prerequisiteId: 'arcanist-attune',
    mastery: { text: 'Restore 35%.', effects: [{ kind: 'pool', percent: 35, target: 'self' }] },
    tags: ['singleTarget', 'reach', 'utility', 'control'],
    xpTags: ['wisdom'],
    ai: { role: 'utility', priority: 45 },
  },
  {
    id: 'arcanist-time-slip',
    school: 'arcana',
    tier: 3,
    name: 'Time Slip',
    description: 'One enemy in either row is Slowed 2 turns and pushed back 300 energy; a charging caster loses its cast.',
    cost: 24,
    weight: 1000,
    target: 'enemy',
    effects: [
      { kind: 'applyStatus', status: 'slow', duration: 2 },
      { kind: 'timeline', energy: -300 },
      { kind: 'custom', customId: 'cancel-charge', note: 'a target that is charging a cast loses it' },
    ],
    prerequisiteId: 'arcanist-blink-step',
    mastery: { text: 'Pushback 500.', effects: [{ kind: 'timeline', energy: -500 }] },
    tags: ['singleTarget', 'reach', 'control', 'debuff'],
    xpTags: ['wisdom'],
    ai: { role: 'control', priority: 60 },
  },
  {
    id: 'arcanist-dispel',
    school: 'arcana',
    tier: 3,
    name: 'Dispel',
    description: 'On an enemy in either row: strip every buff (Fortify, Shield, Haste, Regen, Taunt). On an ally instead: cleanse 2 debuffs.',
    cost: 18,
    weight: 800,
    target: 'enemy',
    effects: [{ kind: 'dispel', note: 'side-aware: strips every buff from an enemy; on an ally, cleanses 2 debuffs (the DSL has no cleanse count — the number lives here)' }],
    prerequisiteId: 'arcanist-mirror-ward',
    mastery: { text: 'Ally: cleanse every debuff.', effects: [{ kind: 'dispel', note: 'on an ally, every debuff' }] },
    tags: ['singleTarget', 'reach', 'debuff', 'cleanse', 'utility'],
    xpTags: ['wisdom'],
    ai: { role: 'debuff', priority: 55 },
  },
  {
    id: 'arcanist-lantern-of-the-mind',
    school: 'arcana',
    tier: 3,
    name: 'Lantern of the Mind',
    description: 'Out of combat: +20 Light, once per room. In combat: every ally is immune to Blind and Fear for 3 turns and Shadow enemies take +15% damage for 3 turns.',
    cost: 14,
    weight: 800,
    target: 'allAllies',
    effects: [
      { kind: 'light', amount: 20, note: 'out of combat, once per room' },
      { kind: 'custom', customId: 'immune-to-status', status: 'blind', duration: 3, note: 'the target cannot receive `status` for `duration` turns' },
      { kind: 'custom', customId: 'immune-to-status', status: 'fear', duration: 3 },
      { kind: 'custom', customId: 'vulnerable-if-shadow', percent: 15, duration: 3, target: 'allEnemies', note: 'Shadow-family enemies take +percent% damage for `duration` turns' },
    ],
    prerequisiteId: 'arcanist-siphon',
    mastery: { text: '+30 Light.', effects: [{ kind: 'light', amount: 30 }] },
    tags: ['aoe', 'light', 'buff', 'utility'],
    xpTags: ['wisdom'],
    ai: { role: 'buff', priority: 40 },
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

const skills = [...evocation, ...rime, ...arcana]
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

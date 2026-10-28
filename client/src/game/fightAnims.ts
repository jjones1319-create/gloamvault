import type { Content } from '../../../sim/src/content.ts'
import type { Actor, FightState } from '../../../sim/src/fight-types.ts'
import type { SkillDef } from '../../../sim/src/types/content.ts'
import { monsterAttackClip } from '../scene/monsters/manifest.ts'
import type { SceneCue } from '../scene/sceneBus.ts'
import type { Beat } from './fightView.ts'

/**
 * Which clip a hero plays for a beat of the fight log (Phase 5; 11 §3's set). The sim's log says who acted and with
 * what ("Orrin uses Shield Slam on Giant Rat 1", "Orrin attacks …", "… guards", "… begins to cast …"); this reads it
 * against the content and the hero's weapon: a basic attack or a weapon skill swings Attack_Light, or Attack_Heavy
 * when its weight is heavier than a normal action (tuning combat.weights: light 800 · normal 1000 · heavy 1400), Attack_Dual
 * with two weapons; a bow skill or a bow's basic attack Shoots; a caster's skill (a Mana class) or a wand's basic
 * attack Casts; a shield or taunt skill Guards; an item is Interact. A won fight ends in Victory for everyone
 * standing, a lost one in Defeat. Hits taken, dodges, downs and revives are already scene cues; the scene plays
 * Hit, Dodge, Downed and Revive for them. Phase 6: a monster's attack swings Attack1, or Attack2 when it is heavier than
 * a normal action (or hits nothing: a howl, a web), trying its own clip of the attack's name first (Web, Howl); a pet's
 * move is its Attack1. Pure.
 */

const BOWS = new Set(['bow', 'shortbow', 'longbow', 'crossbow'])
const CASTER_WEAPONS = new Set(['wand', 'staff', 'focus'])

function heroOf(fight: FightState, id: string | undefined): Actor | null {
  if (!id) return null
  const a = fight.actors.find((x) => x.id === id)
  return a && a.kind === 'hero' && a.hero ? a : null
}

/** The clip for a hero's basic attack, by the weapon in hand. */
export function basicAttackClip(hero: Actor, normalWeight: number): string {
  const w = hero.hero?.weapon
  if (!w) return 'Attack_Light'
  if (w.ranged && (w.type === null || BOWS.has(w.type))) return 'Shoot'
  if (w.type && CASTER_WEAPONS.has(w.type)) return 'Cast'
  if (w.dual) return 'Attack_Dual'
  return w.heavy || w.weight > normalWeight ? 'Attack_Heavy' : 'Attack_Light'
}

/** The clip for a hero's skill. */
export function skillClip(content: Content, hero: Actor, skill: SkillDef): string {
  const normal = content.tuning.combat.weights.normal
  const req = skill.requirements
  if (req?.weaponTypes?.some((t) => BOWS.has(t))) return 'Shoot'
  const cls = content.classes.get(hero.hero?.classId ?? '')
  if (cls?.pool === 'mana') return 'Cast'
  const damages = skill.effects.some((e) => e.kind === 'damage')
  if (!damages) return skill.tags.includes('shield') || skill.tags.includes('taunt') || skill.tags.includes('buff') ? 'Guard' : 'Interact'
  const w = hero.hero?.weapon
  if (w?.ranged && w.type && BOWS.has(w.type)) return 'Shoot'
  if (req?.dualWield) return 'Attack_Dual'
  if ((skill.weight ?? normal) > normal) return 'Attack_Heavy'
  return w?.dual ? 'Attack_Dual' : 'Attack_Light'
}

/** The skill named in an action line ("<actor> uses <skill>[ on <target>]"), among the hero's class skills. */
export function skillInLine(content: Content, hero: Actor, text: string): SkillDef | null {
  const prefix = `${hero.name} uses `
  if (!text.startsWith(prefix)) return null
  const rest = text.slice(prefix.length)
  let best: SkillDef | null = null
  for (const s of content.skillsByClass.get(hero.hero?.classId ?? '') ?? []) {
    if ((rest === s.name || rest.startsWith(`${s.name} on `)) && (!best || s.name.length > best.name.length)) best = s
  }
  return best
}

/** A monster's or a pet's clip for its action line ("<actor> uses <attack>[ on <target>]"), or null. */
export function creatureClip(content: Content, actor: Actor, text: string, speed: number): SceneCue | null {
  const prefix = `${actor.name} uses `
  if (!text.startsWith(prefix)) return null
  const rest = text.slice(prefix.length)
  if (actor.monster) {
    const attack = actor.monster.attacks.find((a) => rest === a.name || rest.startsWith(`${a.name} on `))
    const { clip, alt } = attack ? monsterAttackClip(attack, content.tuning.combat.weights.normal) : { clip: 'Attack1', alt: [] as string[] }
    return { kind: 'anim', actorId: actor.id, clip, ...(alt.length ? { alt } : {}), speed }
  }
  if (actor.pet || actor.kind === 'summon') return { kind: 'anim', actorId: actor.id, clip: 'Attack1', speed }
  return null
}

/** The `anim` cues of a beat: the acting hero's (or monster's, or pet's) clip, or everyone's Victory / Defeat at the end. */
export function beatAnims(beat: Beat, fight: FightState, content: Content, speed = 1): SceneCue[] {
  const out: SceneCue[] = []
  const lead = beat.events.find((e) => e.kind !== 'fortune') ?? beat.events[0]
  if (!lead) return out
  const creature = lead.kind === 'action' && lead.actorId ? fight.actors.find((a) => a.id === lead.actorId && a.kind !== 'hero') : undefined
  if (creature) {
    const c = creatureClip(content, creature, lead.text, speed)
    if (c) out.push(c)
  }
  const hero = heroOf(fight, lead.actorId)
  if (hero) {
    let clip: string | null = null
    if (lead.kind === 'action') {
      if (lead.text.startsWith(`${hero.name} attacks `)) clip = basicAttackClip(hero, content.tuning.combat.weights.normal)
      else {
        const skill = skillInLine(content, hero, lead.text)
        clip = skill ? skillClip(content, hero, skill) : lead.text.startsWith(`${hero.name} uses `) ? 'Interact' : null
      }
    } else if (lead.kind === 'guard') clip = 'Guard'
    else if (lead.kind === 'charge') clip = 'Cast'
    if (clip) out.push({ kind: 'anim', actorId: hero.id, clip, speed })
  }
  const end = beat.events.find((e) => e.kind === 'end')
  const outcome = end?.data?.outcome
  if (outcome === 'victory' || outcome === 'defeat') {
    for (const a of fight.actors) {
      if (a.kind !== 'hero' || a.side !== 'party' || a.downed || a.fallen || a.gone || a.hp <= 0) continue
      out.push({ kind: 'anim', actorId: a.id, clip: outcome === 'victory' ? 'Victory' : 'Defeat', speed: 1 })
    }
  }
  return out
}

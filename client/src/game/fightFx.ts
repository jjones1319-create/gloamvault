import type { Content } from '../../../sim/src/content.ts'
import type { Actor, FightState } from '../../../sim/src/fight-types.ts'
import type { SkillDef } from '../../../sim/src/types/content.ts'
import type { SceneCue } from '../scene/sceneBus.ts'
import { CLASS_FX_COLOUR, fxForDamage, SCHOOL_SHAPE, STATUS_FX, type FxKind } from '../scene/vfx/recipes.ts'
import { skillInLine } from './fightAnims.ts'
import type { Beat } from './fightView.ts'

/**
 * The effects a beat of the fight log shows (Phase 6), cued the same way the clips are: each blow lands with sparks
 * by its damage type (Slash, Pierce, Blunt) or its element's mark (Fire, Frost, Lightning, Poison, Holy, Shadow) — the
 * hero's weapon for a basic attack, the skill's damage line for a skill, the monster's attack for a monster — heals
 * glow, a status applied rings the floor (a buff gold, a debuff in its colour), damage over time shows its element, and
 * an Ultimate opens with its class's flourish. Pure.
 */

const BIG_BEAT = 10

function actorOf(fight: FightState, id: string | undefined): Actor | null {
  return id ? (fight.actors.find((a) => a.id === id) ?? null) : null
}

/** The first damage line's type in a skill (its own, else the weapon's); a skill that hurts by its hooks, the element of its first status (Burn is fire). */
function skillDamageType(skill: SkillDef, actor: Actor): string | null {
  for (const e of skill.effects) if (e.kind === 'damage') return e.damageType ?? actor.hero?.weapon.damageType ?? null
  for (const e of skill.effects) {
    const mark = e.status ? STATUS_FX[e.status] : undefined
    if (mark && mark.fx !== 'bleed') return mark.fx
  }
  return null
}

/** What the beat's lead action struck with: a damage type, and the Ultimate it was (if one). */
function sourceOf(beat: Beat, fight: FightState, content: Content): { type: string | null; ultimate: { actor: Actor; skill: SkillDef } | null } {
  const lead = beat.events.find((e) => e.kind !== 'fortune') ?? beat.events[0]
  if (!lead || lead.kind !== 'action') return { type: null, ultimate: null }
  const actor = actorOf(fight, lead.actorId)
  if (!actor) return { type: null, ultimate: null }
  if (actor.hero) {
    if (lead.text.startsWith(`${actor.name} attacks `)) return { type: actor.hero.weapon.damageType, ultimate: null }
    const skill = skillInLine(content, actor, lead.text)
    if (skill) return { type: skillDamageType(skill, actor), ultimate: skill.isUltimate ? { actor, skill } : null }
    return { type: null, ultimate: null }
  }
  const prefix = `${actor.name} uses `
  const rest = lead.text.startsWith(prefix) ? lead.text.slice(prefix.length) : ''
  const named = (name: string) => rest === name || rest.startsWith(`${name} on `)
  if (actor.monster) {
    const attack = actor.monster.attacks.find((a) => named(a.name))
    return { type: attack?.damageType ?? null, ultimate: null }
  }
  if (actor.pet) {
    const skill = (content.skillsByClass.get('pet') ?? []).find((s) => named(s.name))
    return { type: skill ? (skill.effects.find((e) => e.kind === 'damage')?.damageType ?? 'pierce') : 'pierce', ultimate: null }
  }
  return { type: null, ultimate: null }
}

function cueFx(actorId: string, fx: FxKind, extra: Partial<SceneCue> = {}): SceneCue {
  return { kind: 'fx', actorId, fx, ...extra }
}

/** The `fx` cues of a beat, in the order they show. */
export function beatFx(beat: Beat, fight: FightState, content: Content): SceneCue[] {
  const out: SceneCue[] = []
  const { type, ultimate } = sourceOf(beat, fight, content)
  if (ultimate) {
    const cls = ultimate.actor.hero?.classId ?? ''
    out.push(cueFx(ultimate.actor.id, 'ultimate', { color: CLASS_FX_COLOUR[cls] ?? 0xffe08a, shape: SCHOOL_SHAPE[ultimate.skill.school] ?? 'burst' }))
  }
  const ringed = new Set<string>()
  for (const e of beat.events) {
    switch (e.kind) {
      case 'damage':
        if (e.targetId) out.push(cueFx(e.targetId, fxForDamage(type), e.data?.crit ? { crit: true } : {}))
        break
      case 'heal':
      case 'hot': {
        const id = e.kind === 'hot' ? e.actorId : (e.targetId ?? e.actorId)
        if (id && (e.amount ?? 0) > 0) out.push(cueFx(id, 'heal'))
        break
      }
      case 'revive':
        if (e.targetId) out.push(cueFx(e.targetId, 'heal'), cueFx(e.targetId, 'buff', { color: 0x7aff9a }))
        break
      case 'dot': {
        const s = typeof e.data?.status === 'string' ? e.data.status : ''
        const mark = STATUS_FX[s]
        if (e.actorId) out.push(cueFx(e.actorId, mark?.fx ?? 'blunt', mark ? { color: mark.color } : {}))
        break
      }
      case 'status': {
        const id = e.targetId ?? e.actorId
        const s = typeof e.data?.status === 'string' ? e.data.status : ''
        if (!id || !s || ringed.has(`${id}:${s}`)) break
        ringed.add(`${id}:${s}`)
        const def = content.statuses.get(s as never)
        const buff = def ? def.kind === 'buff' || def.kind === 'hot' || s === 'shield' || s === 'veil' : false
        out.push(cueFx(id, buff ? 'buff' : 'debuff', { color: STATUS_FX[s]?.color ?? (buff ? 0xffd36b : 0xb070ff) }))
        break
      }
      default:
        break
    }
  }
  // A blow that lands on six with a status each is still one readable moment.
  return out.slice(0, BIG_BEAT + (ultimate ? 1 : 0))
}

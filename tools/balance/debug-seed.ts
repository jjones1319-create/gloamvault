/**
 * `node tools/balance/debug-seed.ts <seed> [mortal|sheltered] [room]` — replays the balance runner's "solo warden,
 * ground (L12, D gear)" delve for one seed with the scripted player, step by step, and prints the outcome; with a room
 * id it prints the steps around the first time the party enters that room on floor 3 (a delve that ran to the
 * command cap loops somewhere).
 */
import { createDelve, legalDelveActions, stepDelve } from '../../sim/src/delve.ts'
import { createHero, heroAtLevel } from '../../sim/src/hero.ts'
import { createItemInstance } from '../../sim/src/items.ts'
import { Rng } from '../../sim/src/rng.ts'
import type { ItemInstance } from '../../sim/src/types/content.ts'
import { loadContentDir } from '../sim/loadContent.ts'

const content = loadContentDir('content')
const t = content.tuning
const seed = Number(process.argv[2] ?? 93)
const rule = process.argv[3] === 'sheltered' ? 'sheltered' : 'mortal'
const watch = process.argv[4] ?? null
const egg = [...content.pets.values()].find((p) => p.creationChoice)
let h = createHero(content, t, Rng.fromSeed(seed * 31), { id: 'h0', name: 'warden-1', speciesId: 'human', classId: 'warden', freePoints: { endurance: 2, vitality: 2, strength: 2 }, eggPetId: egg?.id ?? null })
h = heroAtLevel(content, t, h, 12)
if (h.petInstance) h = { ...h, petInstance: { ...h.petInstance, level: 12, stance: 'mend' }, loadout: { ...h.loadout, stance: 'mend' } }
const rng = Rng.fromSeed(seed * 131)
const up = (inst: ItemInstance | null): ItemInstance | null => {
  if (!inst) return inst
  const mesh = content.items.get(inst.itemId)?.visual.meshId
  const target = [...content.items.values()].find((d) => d.visual.meshId === mesh && d.grade === 'D')
  return target ? createItemInstance(content, rng, target.id) : inst
}
const e = h.equipment
h = { ...h, equipment: { ...e, mainHand: up(e.mainHand), offHand: up(e.offHand), helmet: up(e.helmet), chest: up(e.chest), legs: up(e.legs), boots: up(e.boots), gloves: up(e.gloves), ring: [up(e.ring[0]), up(e.ring[1])], talisman: up(e.talisman), relic: up(e.relic) } }
const dungeon = [...content.dungeons.values()][0]!
const state = createDelve(content, { dungeonId: dungeon.id, zone: 1, seed, difficulty: 'normal', pactIds: [], auto: true, policy: 'textbook', deathRule: rule }, [h])
const trail: string[] = []
let shown = false
for (let i = 0; i < 3000 && state.phase.kind !== 'over'; i++) {
  const before = state.floor.currentRoomId
  const n = state.commandLog.length
  stepDelve(content, state, { kind: 'auto' })
  const cmds = state.commandLog.slice(n).map((c) => (c.kind === 'fight' ? `fight:${c.command.kind}` : c.kind))
  const ph = state.phase.kind === 'result' ? `result:${state.phase.title}` : state.phase.kind
  trail.push(`${state.floor.number}/${before}->${state.floor.currentRoomId} ${ph} cmds=${JSON.stringify(cmds)} fights=${state.stats.fights} boss=${state.stats.bossFights} hp=${state.heroes[0]!.hpPercent} fallen=${state.heroes[0]!.fallen}`)
  if (watch && !shown && state.floor.number === 3 && before !== watch && state.floor.currentRoomId === watch) {
    shown = true
    console.log(trail.slice(-12).join('\n'))
    const rs = state.floor.rooms[watch]!
    console.log('room', JSON.stringify({ cleared: rs.cleared, visited: rs.visited, enc: rs.encounterId, bossDefeated: state.floor.bossDefeated, exit: state.floor.graph.exitId }))
    console.log('legal', legalDelveActions(content, state).map((a) => `${a.label}${a.enabled ? '' : ` (off: ${a.reason})`}`).join(' | '))
  }
}
console.log(rule, 'outcome', state.phase.kind === 'over' ? state.phase.outcome : state.phase.kind, 'fights', state.stats.fights, 'commands', state.commandLog.length)
if (watch && shown) console.log(trail.slice(-6).join('\n'))

import type { CodexMonsterRecord } from '../../../../../sim/src/codex.ts'
import type { Content } from '../../../../../sim/src/content.ts'
import type { Profile } from '../../../../../sim/src/town.ts'
import type { MonsterDef } from '../../../../../sim/src/types/content.ts'

/**
 * The codex's pages (12 Phase 8, pass B), read from the profile's `codex` (sim/src/codex.ts) against the content: the
 * monsters met, zone by zone, with what was seen of them — their attacks, their tells, their parts — and the
 * materials found with where they come from. A save from before the codex still shows the bosses it has beaten and the
 * materials it holds. Pure, tested in node.
 */

export interface CodexAttackView {
  id: string
  name: string
  damageType: string
  /** The two-word warning it shows the turn before, when it has one and it has been seen. */
  hint: string | null
}

export interface CodexPartView {
  id: string
  name: string
  rare: boolean
  /** Found at least once (in the codex's materials or held now). */
  found: boolean
}

export interface CodexMonsterView {
  id: string
  name: string
  family: string
  zone: string
  role: string
  size: string
  boss: boolean
  hunter: boolean
  seen: number
  killed: number
  levels: string
  speed: number
  weak: string[]
  resist: string[]
  immune: string[]
  /** The attacks seen used, in the monster's own order. */
  attacks: CodexAttackView[]
  /** Attacks it has that have not been seen yet. */
  unseenAttacks: number
  /** The tells seen (two-word hints), first seen first. */
  tells: string[]
  parts: CodexPartView[]
}

export interface CodexZoneView {
  id: string
  name: string
  seen: CodexMonsterView[]
  /** Every monster of the zone, seen or not. */
  total: number
}

export interface CodexMaterialView {
  id: string
  name: string
  grade: string
  /** "Metal, rung 2" for a material on a promotion ladder, else null. */
  ladder: string | null
  /** Units brought home from delves (the codex's count). */
  found: number
  /** Units held now. */
  held: number
  sources: string[]
}

/** "cellar-vermin" → "Cellar Vermin". */
export function words(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((w) => (w === 'and' || w === 'the' || w === 'of' ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(' ')
}

function partId(slot: { itemId?: string; materialId?: string } | undefined): string | undefined {
  return slot?.materialId ?? slot?.itemId
}

/** The monsters this profile has met: the codex's, plus every boss it has killed (saves from before the codex). */
export function metMonsters(p: Profile): Map<string, CodexMonsterRecord> {
  const out = new Map<string, CodexMonsterRecord>()
  for (const [id, m] of Object.entries(p.codex?.monsters ?? {})) if (m.seen > 0 || m.killed > 0) out.set(id, m)
  for (const [id, kills] of Object.entries(p.progress.bossKills)) {
    if (kills <= 0) continue
    const m = out.get(id)
    out.set(id, m ? { ...m, seen: Math.max(m.seen, kills), killed: Math.max(m.killed, kills) } : { seen: kills, killed: kills, attacks: [], tells: [] })
  }
  return out
}

/** Material ids this profile has found: brought home (the codex) or held now. */
export function foundMaterials(p: Profile): Map<string, { found: number; held: number }> {
  const out = new Map<string, { found: number; held: number }>()
  for (const [id, n] of Object.entries(p.codex?.materials ?? {})) if (n > 0) out.set(id, { found: n, held: 0 })
  for (const [id, n] of Object.entries(p.materials)) {
    if (n <= 0) continue
    const m = out.get(id)
    out.set(id, { found: m?.found ?? 0, held: n })
  }
  return out
}

function monsterView(c: Content, def: MonsterDef, rec: CodexMonsterRecord, found: ReadonlyMap<string, unknown>, zoneName: string): CodexMonsterView {
  const seenAttacks = new Set(rec.attacks)
  const tells = new Set(rec.tells)
  const attacks = def.attacks
    .filter((a) => seenAttacks.has(a.id))
    .map((a) => {
      const hint = a.hint ?? (a.tell ? a.name : null)
      return { id: a.id, name: a.name, damageType: a.damageType, hint: hint && tells.has(hint) ? hint : null }
    })
  // A move with no weight that never hits (a passive trigger: "the swarm turns") is not an attack to wait for.
  const usable = def.attacks.filter((a) => a.aiWeight > 0 || a.multiplier > 0)
  const parts: CodexPartView[] = []
  for (const [slot, rare] of [
    [def.parts.common, false],
    [def.parts.rare, true],
  ] as const) {
    const id = partId(slot)
    if (!id) continue
    parts.push({ id, name: c.items.get(id)?.name ?? words(id), rare, found: found.has(id) })
  }
  return {
    id: def.id,
    name: def.name,
    family: words(def.familyId),
    zone: zoneName,
    role: def.role,
    size: def.size,
    boss: def.boss !== null,
    hunter: def.hunter !== null,
    seen: rec.seen,
    killed: rec.killed,
    levels: def.levelBand.min === def.levelBand.max ? `L${def.levelBand.min}` : `L${def.levelBand.min}–${def.levelBand.max}`,
    speed: def.speed,
    weak: [...def.weak],
    resist: [...def.resist],
    immune: [...def.immune],
    attacks,
    unseenAttacks: Math.max(0, usable.filter((a) => !seenAttacks.has(a.id)).length),
    tells: [...tells],
    parts,
  }
}

/** The monster pages, zone by zone in the dungeons' order; a zone shows once anything in it has been met. */
export function codexMonsters(c: Content, p: Profile): CodexZoneView[] {
  const met = metMonsters(p)
  const found = foundMaterials(p)
  const out: CodexZoneView[] = []
  for (const dungeon of c.dungeons.values()) {
    for (const zone of dungeon.zones) {
      const all = [...c.monsters.values()].filter((m) => m.dungeonId === dungeon.id && m.zoneId === zone.id)
      const seen = all
        .filter((m) => met.has(m.id))
        .map((m) => monsterView(c, m, met.get(m.id)!, found, zone.name))
        .sort((a, b) => Number(a.boss) - Number(b.boss) || Number(a.hunter) - Number(b.hunter) || a.name.localeCompare(b.name))
      out.push({ id: zone.id, name: zone.name, seen, total: all.length })
    }
  }
  return out.filter((z, i) => z.seen.length > 0 || i === 0)
}

/** Where a material comes from, from the content: monsters' parts (named once met), traps, curios and secrets, salvage, crates. */
export function materialSources(c: Content, p: Profile, itemId: string): string[] {
  const met = metMonsters(p)
  const out: string[] = []
  const droppers = [...c.monsters.values()].filter((m) => partId(m.parts.common) === itemId || partId(m.parts.rare) === itemId)
  const known = droppers.filter((m) => met.has(m.id))
  const unknown = droppers.length - known.length
  if (droppers.length > 0) {
    const names = known.map((m) => `${m.name}${partId(m.parts.rare) === itemId ? ' (rare)' : ''}`)
    const rest = unknown > 0 ? `${unknown === 1 ? 'a monster' : `${unknown} monsters`} you have not met` : ''
    out.push(`Dropped by ${[...names, ...(rest ? [rest] : [])].join(', ')}`)
  }
  for (const dungeon of c.dungeons.values()) {
    const traps = dungeon.traps.filter((t) => t.disarmReward.some((r) => (r.kind === 'material' || r.kind === 'item') && r.id === itemId)).map((t) => t.name)
    if (traps.length) out.push(`Disarming ${traps.join(', ')}`)
    const curios = dungeon.curios.filter((cu) => JSON.stringify(cu.choices).includes(`"${itemId}"`)).map((cu) => cu.name)
    if (curios.length) out.push(`The curio${curios.length === 1 ? '' : 's'} ${curios.join(', ')}`)
    const secrets = (dungeon.secrets ?? []).filter((s) => JSON.stringify(s).includes(`"${itemId}"`)).map((s) => s.name)
    if (secrets.length) out.push(`Secret rooms: ${secrets.join(', ')}`)
  }
  const def = c.items.get(itemId)
  if (def?.materialLadder) out.push('Salvaging gear at the Blacksmith')
  if (def?.materialLadder && [...c.chests.values()].some((ch) => ch.kind === 'materialCrate')) out.push('Material crates at the Curio Merchant')
  if (def?.kind === 'stone') out.push('Fights and the floor merchant')
  return out
}

/** The material pages: everything found, by grade then name. */
export function codexMaterials(c: Content, p: Profile): CodexMaterialView[] {
  const order = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'God']
  const out: CodexMaterialView[] = []
  for (const [id, n] of foundMaterials(p)) {
    const def = c.items.get(id)
    if (!def && id !== 'divine-shard') continue
    out.push({
      id,
      name: def?.name ?? words(id),
      grade: def?.grade ?? 'S',
      ladder: def?.materialLadder ? `${words(def.materialLadder)}, rung ${def.materialRung ?? '?'}` : null,
      found: n.found,
      held: n.held,
      sources: materialSources(c, p, id),
    })
  }
  return out.sort((a, b) => order.indexOf(a.grade) - order.indexOf(b.grade) || a.name.localeCompare(b.name))
}

/** The counts on the codex's tabs. */
export function codexTotals(c: Content, p: Profile): { monstersMet: number; monstersTotal: number; materialsFound: number } {
  const met = metMonsters(p)
  const all = [...c.monsters.values()].filter((m) => m.dungeonId && c.dungeons.has(m.dungeonId))
  return { monstersMet: all.filter((m) => met.has(m.id)).length, monstersTotal: all.length, materialsFound: codexMaterials(c, p).length }
}

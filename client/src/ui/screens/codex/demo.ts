import { act, ephemeral } from '../../../game/session.ts'

/**
 * `#codex&demo=1&sample=1`: fills an EMPTY codex of an ephemeral (never saved) demo profile with what a few Cellars
 * delves would have shown — six monsters with the attacks and tells the content gives them, and their common parts —
 * so the codex can be seen on a screenshot. Does nothing to a real save.
 */
export function seedSampleCodex(): void {
  if (!ephemeral.value) return
  act((c, p) => {
    if (p.codex && Object.keys(p.codex.monsters).length > 0) return p
    const picks = [...c.monsters.values()].filter((m) => m.zoneId === 'the-cellars' && !m.boss && !m.hunter).slice(0, 6)
    const monsters: NonNullable<typeof p.codex>['monsters'] = {}
    const materials: Record<string, number> = {}
    picks.forEach((m, i) => {
      const attacks = m.attacks.filter((a) => a.aiWeight > 0).map((a) => a.id)
      const tells = m.attacks.filter((a) => a.tell).map((a) => a.hint ?? a.name)
      monsters[m.id] = { seen: 3 + i, killed: 2 + i, attacks: attacks.slice(0, i % 2 === 0 ? 2 : 1), tells }
      const part = m.parts.common.materialId ?? m.parts.common.itemId
      if (part) materials[part] = (materials[part] ?? 0) + 2 + i
    })
    return { ...p, codex: { monsters, materials } }
  })
}

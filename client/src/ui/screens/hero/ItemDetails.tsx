import type { Content } from '../../../../../sim/src/content.ts'
import { isAwakened, setProgressOf } from '../../../../../sim/src/items.ts'
import type { ItemDef, ItemInstance } from '../../../../../sim/src/types/content.ts'
import { itemLevelCost } from '../../../../../sim/src/xp.ts'
import { relicActiveText } from './labels.ts'
import './item-details.css'

/**
 * The item card's deeper lines (Phase 7, 03 §5.2, 08 §3, §6, §7): a named unique's signature, a relic's active, the
 * rolled affixes, what use has grown (item level, XP to the next, the affinities, Awakened) and the set the piece
 * belongs to — how many of it the hero wears, which bonus is on and what the next piece switches on. `worn` is what the
 * hero wears now (the set count reads it); `showActive` false leaves the relic's line to a summary that already says it.
 * Item level and XP show on the gear that grows by use (weapons, foci, shields, armor; trinkets do not, 03 §5.2).
 */
export function ItemDetails({ c, def, inst, worn, showActive = true }: { c: Content; def: ItemDef; inst: ItemInstance; worn: readonly (ItemInstance | null)[]; showActive?: boolean }) {
  const t = c.tuning
  const affixes = inst.affixes
    .map((a) => {
      const af = c.affixes.get(a.affixId)
      return af ? `${af.name} ${a.value}${a.locked ? ' (locked)' : ''}` : null
    })
    .filter((x): x is string => x !== null)
  const gear = GROWING_KINDS.has(def.kind)
  const awakened = isAwakened(t, inst)
  const nextCost = awakened ? 0 : itemLevelCost(t, inst.itemLevel + 1)
  const set = def.setId ? c.sets.get(def.setId) : undefined
  const progress = set ? setProgressOf(c, t, worn).find((p) => p.setId === set.id) : undefined
  const wears = progress?.worn ?? 0
  return (
    <span class="it-details" data-testid={`it-details-${inst.instanceId}`}>
      {def.unique && def.uniquePower && <span class="it-line it-line--unique">★ {def.uniquePower.text}</span>}
      {showActive && def.active && <span class="it-line it-line--relic">{relicActiveText(c, def)}</span>}
      {affixes.length > 0 && <span class="it-line it-line--affix">{affixes.join(' · ')}</span>}
      {gear && (
        <span class="it-line it-line--growth" data-testid={`it-growth-${inst.instanceId}`}>
          {awakened ? (
            <b class="it-awakened">Awakened</b>
          ) : (
            <>
              Item level {inst.itemLevel} · {inst.itemXp} / {nextCost} XP to {inst.itemLevel + 1}
            </>
          )}
          {inst.affinities.map((a) => (
            <span key={a.familyId} class="it-affinity">
              +{a.percent}% vs {familyName(c, a.familyId)}
            </span>
          ))}
        </span>
      )}
      {set && (
        <span class="it-line it-line--set" data-testid={`it-set-${inst.instanceId}`}>
          <b>{set.name}</b>{' '}
          <span class="it-count">
            {wears} / {progress?.next ?? Math.max(...(progress?.thresholds ?? [2]))}
          </span>
          {(['2', '4'] as const).map((k) =>
            set.bonusText[k] ? (
              <span key={k} class={`it-bonus ${progress?.active.includes(k) ? 'it-bonus--on' : ''}`}>
                {k}: {set.bonusText[k]}
              </span>
            ) : null,
          )}
        </span>
      )}
    </span>
  )
}

/** The gear that gains item XP from hits landed, absorbed or blocked (03 §5.2). */
const GROWING_KINDS: ReadonlySet<string> = new Set(['weapon', 'focus', 'shield', 'armor'])

/** A monster family's name for an affinity line: the id read as words ("restless-dead" → "Restless Dead"). */
function familyName(c: Content, familyId: string): string {
  void c
  return familyId
    .split('-')
    .filter(Boolean)
    .map((w) => (w === 'and' || w === 'the' ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(' ')
}

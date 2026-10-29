import type { Content } from '../../../../../sim/src/content.ts'
import { heroCardStats } from '../../../../../sim/src/hero.ts'
import { effectiveItemStats } from '../../../../../sim/src/items.ts'
import type { HeroRecord, ItemDef, ItemInstance } from '../../../../../sim/src/types/content.ts'
import type { Pool } from '../../../../../sim/src/types/enums.ts'
import { StatTip } from '../../components/StatTip.tsx'
import { itemStatLine } from '../../components/statLines.ts'
import { STAT_NAME, formatStat, itemLines, mainStatsFor, signed } from './labels.ts'

/**
 * An item card's stat lines as tips (12 Phase 8, pass B): each line — "Attack 12", "Dodge −2%" — taps to say what the
 * piece gives and what the stat does, with the hero's own number. What wear and +N leave of the item counts
 * (effectiveItemStats); a broken piece says so instead.
 */
export function ItemStatTips({ c, def, inst, hero, pool }: { c: Content; def: ItemDef; inst: ItemInstance; hero: HeroRecord; pool: Pool }) {
  const s = effectiveItemStats(c, c.tuning, def, inst)
  if (s.band === 'broken') return <span class="it-stats it-stats--broken">Broken: gives nothing until repaired</span>
  const lines = itemLines(s, mainStatsFor(def, pool))
  if (lines.length === 0) return null
  const stats = heroCardStats(c, c.tuning, hero)
  return (
    <span class="it-stats" data-testid={`it-stats-${inst.instanceId}`}>
      {lines.map(([stat, v], i) => (
        <StatTip key={stat} class="it-stat" testid={`it-stat-${inst.instanceId}-${stat}`} label={STAT_NAME[stat]} value={i === 0 && v > 0 ? formatStat(stat, v) : signed(stat, v)} line={itemStatLine(c.tuning, stat, v, stats, def.name)} />
      ))}
    </span>
  )
}

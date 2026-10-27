import { isMortal } from '../../../../../sim/src/delve.ts'
import { content, delve, delveVersion } from '../../../game/session.ts'
import { Meter } from '../../kit/kit.tsx'
import { heroMax } from './heroNumbers.ts'
import { Icon } from './icons.tsx'

/**
 * Bottom-left: each hero's name, level, HP and pool between fights (the sim keeps them as percentages). A hero who
 * fell is "Fallen" under the Sheltered rule; under Mortal (D-088) they are dead, and the living carry the body.
 */
export function PartyStrip() {
  void delveVersion.value
  const d = delve.value
  const c = content.value
  if (!d || !c) return null
  const mortal = isMortal(d)
  return (
    <div class="dv-party" data-testid="dv-party">
      {d.heroes.map((h, i) => {
        const max = heroMax(c, h.record)
        const hp = Math.round((h.hpPercent * max.hp) / 100)
        const pool = Math.round((h.poolPercent * max.pool) / 100)
        const dead = mortal && h.fallen
        return (
          <div key={h.record.id} class={`dv-hero ${h.fallen ? 'dv-hero--fallen' : ''} ${dead ? 'dv-hero--dead' : ''}`} data-testid={`dv-hero-${i}`}>
            <div class="dv-hero__name">
              <b>{h.record.name}</b>
              <span class="dv-hero__level">Lv {h.record.level}</span>
              {h.fallen && (
                <span class={`dv-hero__tag ${dead ? 'dv-hero__tag--dead' : ''}`} data-testid={dead ? `dv-dead-${i}` : `dv-fallen-${i}`}>
                  {dead && <Icon name="skull" size={12} />}
                  {dead ? 'Dead' : 'Fallen'}
                </span>
              )}
            </div>
            {dead ? (
              <p class="dv-hero__carried">The party carries the body.</p>
            ) : (
              <>
                <Meter tone="hp" value={h.fallen ? 0 : hp} max={max.hp} label="HP" />
                <div class={`dv-pool dv-pool--${max.poolKind}`} title={`${max.poolKind === 'mana' ? 'Mana' : 'Stamina'} ${pool}/${max.pool}`}>
                  <Meter tone="pool" value={pool} max={max.pool} compact label={max.poolKind} />
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

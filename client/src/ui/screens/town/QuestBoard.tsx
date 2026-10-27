import { questBoard, townR } from '../../../../../sim/src/town.ts'
import { content, profile } from '../../../game/session.ts'
import { Empty } from '../../kit/kit.tsx'
import { PlacePage } from './shared.tsx'
import { contractChips, contractReward, daysToNextBoard, weekIndexAt, withGold } from './text.ts'

/**
 * The Quest Board (07 §7): this week's three contracts, drawn by the sim from the week number, with what to do and
 * the reward in gold at the player's band. Progress tracking arrives in a later update.
 */
export function QuestBoard() {
  const c = content.value!
  const p = profile.value!
  const now = Date.now()
  const ids = questBoard(c, weekIndexAt(now))
  const r = townR(p)
  const days = daysToNextBoard(now)
  return (
    <PlacePage id="board">
      <div class="tw-board__head">
        <p class="tw-note">
          This week’s contracts. New ones in {days} day{days === 1 ? '' : 's'}.
        </p>
        <span class="tw-pill tw-pill--warn">Tracking arrives in a later update</span>
      </div>
      {ids.length === 0 ? (
        <Empty>The board is bare this week.</Empty>
      ) : (
        <div class="tw-board">
          {ids.map((id) => {
            const k = c.contracts.get(id)
            if (!k) return null
            return (
              <article key={id} class="tw-contract" data-testid={`qb-${id}`}>
                <div class="tw-contract__head">
                  <h2 class="tw-contract__name">{k.name}</h2>
                  <span class={`tw-pill ${k.cadence === 'weekly' ? 'tw-pill--good' : ''}`}>{k.cadence === 'weekly' ? 'Weekly' : 'Daily'}</span>
                </div>
                <p class="tw-contract__task">{withGold(k.description, r)}</p>
                <div class="tw-chips">
                  {contractChips(c, k, r).map((t) => (
                    <span key={t} class="tw-tag">
                      {t}
                    </span>
                  ))}
                </div>
                <p class="tw-contract__reward">
                  <span class="tw-dim">Reward</span> {contractReward(c, k, r).join(' · ')}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </PlacePage>
  )
}

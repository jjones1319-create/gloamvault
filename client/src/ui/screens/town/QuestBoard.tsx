import { useEffect } from 'preact/hooks'
import type { Content } from '../../../../../sim/src/content.ts'
import { boardTurnsOver, contractPayout, rForBand, type ContractBoard, type ContractSlot } from '../../../../../sim/src/contracts.ts'
import { claimContract, type Profile } from '../../../../../sim/src/town.ts'
import { actWith, content, profile, syncBoard, toast } from '../../../game/session.ts'
import { Btn, Empty } from '../../kit/kit.tsx'
import { buzz } from '../../lib/haptics.ts'
import { HeroPicker, PlacePage, pickedHero } from './shared.tsx'
import { claimWords, contractChips, contractReward, turnsOverWords, withGold } from './text.ts'

/**
 * The Quest Board (07 §7; Phase 7): three dailies (new each day at 04:00) and the week's weekly (new on Monday), drawn
 * from the contracts the party can do and written for the player's band. Each card shows its task, its progress (any
 * party, any difficulty — the delve's kills, stairs, chests, curios and sales count when it comes home), its reward in
 * gold at the band it was posted at, and Claim. Chest keys are capped at 3 Standard and 1 Grand a week; a claim past
 * the cap still pays its gold. A chest reward is opened at once for the hero picked above the board.
 */
export function QuestBoard() {
  const c = content.value!
  const p = profile.value!
  // Post today's board (and this week's weekly) as the board is opened; a no-op when nothing turned over.
  useEffect(() => syncBoard(), [])
  const board = p.contracts
  const now = new Date()
  const left = boardTurnsOver(c.tuning, now.getTime() - now.getTimezoneOffset() * 60_000)
  const cap = c.tuning.contracts.keyCapPerWeek
  const needsHero = board !== undefined && [...board.dailies, ...(board.weekly ? [board.weekly] : [])].some((s) => !s.claimed && c.contracts.get(s.contractId)?.reward.chestId)

  return (
    <PlacePage id="board">
      <div class="tw-board__head">
        <p class="tw-note" data-testid="qb-turnover">
          {turnsOverWords(left.dailyMs, left.weeklyMs)}
        </p>
        {board && (
          <span class="tw-board__keys" data-testid="qb-keys">
            Keys this week: Standard {board.keysStandard} / {cap.standard} · Grand {board.keysGrand} / {cap.grand}
          </span>
        )}
      </div>
      {needsHero && <HeroPicker c={c} label="A chest reward opens for" />}
      {!board ? (
        <Empty>The board is being posted…</Empty>
      ) : (
        <div class="tw-board">
          {board.dailies.map((slot, i) => (
            <ContractCard key={`d-${slot.contractId}`} c={c} p={p} board={board} slot={slot} which={i} />
          ))}
          {board.weekly ? (
            <ContractCard c={c} p={p} board={board} slot={board.weekly} which="weekly" />
          ) : (
            <article class="tw-contract tw-contract--claimed" data-testid="qb-no-weekly">
              <div class="tw-contract__head">
                <h2 class="tw-contract__name">The weekly</h2>
                <span class="tw-pill tw-pill--good">Weekly</span>
              </div>
              <p class="tw-contract__task">The weekly is a boss kill under a condition — Captain Vexa on Hard, Sister Naesa before the tide rises. None is within your reach yet.</p>
            </article>
          )}
          {board.dailies.length === 0 && <Empty>No contract fits your party today.</Empty>}
        </div>
      )}
    </PlacePage>
  )
}

function ContractCard({ c, p, board, slot, which }: { c: Content; p: Profile; board: ContractBoard; slot: ContractSlot; which: number | 'weekly' }) {
  const k = c.contracts.get(slot.contractId)
  if (!k) return null
  const r = rForBand(slot.band, c.tuning)
  const done = slot.progress >= slot.goal
  const pct = Math.round((Math.min(slot.progress, slot.goal) * 100) / Math.max(1, slot.goal))
  const pay = contractPayout(c, board, slot)
  const capped = pay.capped.standard + pay.capped.grand > 0
  const id = which === 'weekly' ? 'weekly' : String(which)
  return (
    <article class={`tw-contract ${done && !slot.claimed ? 'tw-contract--done' : ''} ${slot.claimed ? 'tw-contract--claimed' : ''}`} data-testid={`qb-${k.id}`}>
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
      <div class="tw-contract__progress" data-testid={`qb-progress-${k.id}`}>
        <span>
          {Math.min(slot.progress, slot.goal)} / {slot.goal}
        </span>
        <div class="tw-progress" style={{ flex: 1 }} role="progressbar" aria-valuemin={0} aria-valuemax={slot.goal} aria-valuenow={Math.min(slot.progress, slot.goal)}>
          <div class={`tw-progress__fill ${done ? 'tw-progress__fill--done' : ''}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <p class="tw-contract__reward">
        <span class="tw-dim">Reward</span> {contractReward(c, k, r).join(' · ')}
        {capped && !slot.claimed && <span class="tw-dim"> (this week's keys are all claimed: the gold still pays, the key does not)</span>}
      </p>
      {slot.claimed ? (
        <span class="tw-pill tw-pill--off" data-testid={`qb-claimed-${id}`}>
          Claimed
        </span>
      ) : (
        <Btn
          tone={done ? 'primary' : 'quiet'}
          class="tw-btn44"
          testid={`qb-claim-${id}`}
          disabled={!done}
          title={done ? undefined : 'Finish the contract in the tower first'}
          onClick={() => {
            buzz()
            const hero = pickedHero(p)
            const result = actWith((cc, pp) => claimContract(cc, pp, which, hero?.id ?? null))
            if (result) toast(claimWords(c, result), 'good')
          }}
        >
          {done ? 'Claim' : 'In progress'}
        </Btn>
      )}
    </article>
  )
}

import { deposit, withdraw } from '../../../../../sim/src/town.ts'
import { act, profile } from '../../../game/session.ts'
import { Btn, Gold } from '../../kit/kit.tsx'
import { PlacePage } from './shared.tsx'

/**
 * The Bank, Lysa Quill's counter (03 §8.1, §12.2): the purse goes into the tower and is lost on a wipe; the bank
 * never leaves town. Quick amounts: all, half, 50, 100.
 */

type Amount = 'all' | 'half' | 50 | 100

function amountOf(a: Amount, have: number): number {
  if (a === 'all') return have
  if (a === 'half') return Math.floor(have / 2)
  return a
}

function amountLabel(a: Amount, have: number): string {
  if (a === 'all') return `All · ${have}`
  if (a === 'half') return `Half · ${Math.floor(have / 2)}`
  return String(a)
}

const AMOUNTS: readonly Amount[] = ['all', 'half', 50, 100]

export function Bank() {
  const p = profile.value!
  return (
    <PlacePage id="bank">
      <div class="tw-bank">
        <section class="tw-card tw-vault">
          <h2 class="tw-vault__title">Purse</h2>
          <p class="tw-vault__sum" data-testid="bank-purse">
            <Gold amount={p.purse} />
          </p>
          <p class="tw-note">Carried. It goes into the tower with you.</p>
          <p class="tw-vault__verb">Put into the bank</p>
          <div class="tw-vault__buttons">
            {AMOUNTS.map((a) => {
              const n = amountOf(a, p.purse)
              return (
                <Btn
                  key={String(a)}
                  class="tw-btn44"
                  tone={a === 'all' ? 'primary' : 'plain'}
                  testid={`bank-deposit-${a}`}
                  disabled={n <= 0 || n > p.purse}
                  onClick={() => act((_c, pp) => deposit(pp, n), `Banked ${n} gold`)}
                >
                  {amountLabel(a, p.purse)}
                </Btn>
              )
            })}
          </div>
        </section>
        <section class="tw-card tw-vault tw-vault--bank">
          <h2 class="tw-vault__title">Bank</h2>
          <p class="tw-vault__sum" data-testid="bank-bank">
            <Gold amount={p.bank} />
          </p>
          <p class="tw-note">Safe. It never leaves Emberfall.</p>
          <p class="tw-vault__verb">Take out to the purse</p>
          <div class="tw-vault__buttons">
            {AMOUNTS.map((a) => {
              const n = amountOf(a, p.bank)
              return (
                <Btn
                  key={String(a)}
                  class="tw-btn44"
                  testid={`bank-withdraw-${a}`}
                  disabled={n <= 0 || n > p.bank}
                  onClick={() => act((_c, pp) => withdraw(pp, n), `Took out ${n} gold`)}
                >
                  {amountLabel(a, p.bank)}
                </Btn>
              )
            })}
          </div>
        </section>
      </div>
      <p class="tw-rule">Banked gold is safe. Gold you carry into the tower is lost if the party falls.</p>
      <p class="tw-note">Shops in town take the purse first, then the bank.</p>
    </PlacePage>
  )
}

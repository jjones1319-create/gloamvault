import type { Stance } from '../../../../../../sim/src/types/enums.ts'
import { buzz } from '../../../lib/haptics.ts'
import { Btn, Modal } from '../../../kit/kit.tsx'

/** The fight's small dialogs (Phase 4): the item sheet, the pet's stance, the flee check. */

export interface ItemRow {
  instanceId: string
  name: string
  count: number
  desc: string
  enabled: boolean
  reason?: string
  onPick(): void
}

export function ItemSheet({ hero, rows, onClose }: { hero: string; rows: readonly ItemRow[]; onClose(): void }) {
  return (
    <Modal title={`Items — ${hero}`} onClose={onClose} testid="fx-item-sheet" actions={<Btn onClick={onClose}>Close</Btn>}>
      {rows.length === 0 ? (
        <p class="fx-sheet__empty">Nothing in the bag can be used in a fight.</p>
      ) : (
        <div class="fx-sheet">
          {rows.map((r) => (
            <button
              key={r.instanceId}
              type="button"
              class={`fx-sheet__row ${r.enabled ? '' : 'fx-sheet__row--off'}`}
              data-testid={`fx-item-${r.instanceId}`}
              disabled={!r.enabled}
              onClick={() => {
                if (!r.enabled) return
                buzz()
                r.onPick()
              }}
            >
              <span class="fx-sheet__name">
                {r.name} <b class="fx-sheet__count">×{r.count}</b>
              </span>
              <span class="fx-sheet__desc">{r.enabled ? r.desc : (r.reason ?? r.desc)}</span>
            </button>
          ))}
        </div>
      )}
      <p class="fx-sheet__note">An item takes a quick turn: you act again sooner than after an attack.</p>
    </Modal>
  )
}

const STANCES: readonly { id: Stance; name: string; text: string }[] = [
  { id: 'fierce', name: 'Fierce', text: 'Attacks whatever its owner attacked last.' },
  { id: 'guard', name: 'Guard', text: 'Takes 30% of the single hits aimed at its owner.' },
  { id: 'mend', name: 'Mend', text: 'Heals the most hurt ally a little when someone drops below 70%.' },
  { id: 'forage', name: 'Forage', text: 'Keeps out of the fighting (it guards); between fights it finds more.' },
]

export function StanceSheet({ pet, current, onPick, onClose }: { pet: string; current: Stance; onPick(s: Stance): void; onClose(): void }) {
  return (
    <Modal title={`${pet}'s stance`} onClose={onClose} testid="fx-stance-sheet" actions={<Btn onClick={onClose}>Keep {current}</Btn>}>
      <div class="fx-sheet">
        {STANCES.map((s) => (
          <button
            key={s.id}
            type="button"
            class={`fx-sheet__row ${s.id === current ? 'fx-sheet__row--on' : ''}`}
            data-testid={`fx-stance-${s.id}`}
            disabled={s.id === current}
            onClick={() => {
              buzz()
              onPick(s.id)
            }}
          >
            <span class="fx-sheet__name">
              {s.name}
              {s.id === current && <small> (now)</small>}
            </span>
            <span class="fx-sheet__desc">{s.text}</span>
          </button>
        ))}
      </div>
      <p class="fx-sheet__note">One free change per fight — the hero still takes this turn.</p>
    </Modal>
  )
}

export function FleeConfirm({ onFlee, onClose, chance, mortal }: { onFlee(): void; onClose(): void; chance: number; mortal: boolean }) {
  return (
    <Modal
      title="Run for it?"
      onClose={onClose}
      testid="fx-flee-sheet"
      actions={
        <>
          <Btn onClick={onClose}>Stay and fight</Btn>
          <Btn tone="danger" testid="fx-flee-yes" onClick={onFlee}>
            Flee
          </Btn>
        </>
      }
    >
      <p class="fx-sheet__text" data-testid="fx-flee-chance">
        <b>{chance}% chance.</b> The whole party tries to get away; the odds are the party's speed against the enemies'. If it fails, every hero loses a turn.
      </p>
      <p class="fx-sheet__text">
        {mortal ? 'The fallen come with you: the downed get back up, the dead are carried. The monsters stay in the room.' : 'The fallen come with you. The monsters stay in the room.'}
      </p>
    </Modal>
  )
}

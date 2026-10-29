import type { Content } from '../../../../../../sim/src/content.ts'
import type { FightState } from '../../../../../../sim/src/fight-types.ts'
import { buzz } from '../../../lib/haptics.ts'
import { Btn, Modal } from '../../../kit/kit.tsx'
import { arenaChips, tellPills, type ArenaRow } from './arenaView.ts'
import './arena.css'

/**
 * The boss arena on the fight HUD (Phase 7; 07 §2.8, D-099): a row of chips under the turn banner — the phase, the
 * light, the tide, the braziers, the candles, the barricade, the bone piles — and the tells on show, each a warning
 * pill whose two-word hint shows the first time it fires (afterwards the cue alone; a tap says it again). The Arena
 * sheet lists the interactables the pending hero can work (shoot a keg, burn a pile, turn the sluice wheel).
 */
export function ArenaBar({ c, fight, onTip }: { c: Content; fight: FightState; onTip(text: string): void }) {
  const chips = arenaChips(c, fight)
  const tells = tellPills(fight)
  if (chips.length === 0 && tells.length === 0) return null
  return (
    <div class="fx-arena" data-testid="fx-arena" aria-label="The arena">
      {chips.map((ch) => (
        <button key={ch.key} type="button" class={`fx-arena__chip fx-arena__chip--${ch.tone}`} data-testid={`fx-arena-${ch.key}`} title={ch.title} onClick={() => onTip(ch.title)}>
          <span class="fx-arena__label">{ch.label}</span>
          {ch.pips ? (
            <span class="fx-arena__pips" aria-label={`${ch.pips.on} of ${ch.pips.of}`}>
              {Array.from({ length: ch.pips.of }, (_, i) => (
                <i key={i} class={i < ch.pips!.on ? 'on' : ''} />
              ))}
            </span>
          ) : null}
          <b class="fx-arena__value">{ch.value}</b>
        </button>
      ))}
      {tells.map((t) => (
        <button key={t.key} type="button" class={`fx-tell ${t.words ? 'fx-tell--words' : ''}`} data-testid={`fx-tell-${t.key}`} title={t.title} onClick={() => onTip(t.title)}>
          <span class="fx-tell__mark" aria-hidden="true">
            !
          </span>
          {t.words ? <span class="fx-tell__hint">{t.hint}</span> : <span class="fx-sr">{t.hint}</span>}
        </button>
      ))}
    </div>
  )
}

/** The Arena sheet: the pending hero's arena actions, each with why it cannot be done when it cannot. */
export function ArenaSheet({ hero, rows, onPick, onClose }: { hero: string; rows: readonly ArenaRow[]; onPick(propId: string): void; onClose(): void }) {
  return (
    <Modal title={`The arena — ${hero}`} onClose={onClose} testid="fx-arena-sheet" actions={<Btn onClick={onClose}>Close</Btn>}>
      <div class="fx-sheet">
        {rows.map((r) => (
          <button
            key={r.propId}
            type="button"
            class={`fx-sheet__row ${r.enabled ? '' : 'fx-sheet__row--off'}`}
            data-testid={`fx-arena-${r.propId}`}
            disabled={!r.enabled}
            onClick={() => {
              if (!r.enabled) return
              buzz()
              onPick(r.propId)
            }}
          >
            <span class="fx-sheet__name">{r.label}</span>
            {r.enabled ? <span class="fx-sheet__desc">{ROW_TEXT[r.propId.split('-')[0] ?? ''] ?? ''}</span> : r.reason && <span class="fx-sheet__desc">{r.reason[0]!.toUpperCase() + r.reason.slice(1)}</span>}
          </button>
        ))}
      </div>
      <p class="fx-sheet__note">The room is part of the fight: its kegs, its bone piles, its wheel.</p>
    </Modal>
  )
}

/** What each kind of interactable does (07 §2.8), for the sheet's second line. */
const ROW_TEXT: Readonly<Record<string, string>> = {
  keg: 'Three shots spill it: monsters that change rows on the wet floor slip (Slow).',
  pile: 'Holy or Fire, three times: the bell can raise no Footman from it again.',
  sluice: 'Strength 12, a quick turn: the water drops a step.',
}

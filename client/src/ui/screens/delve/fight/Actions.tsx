import type { ComponentChildren } from 'preact'
import { buzz } from '../../../lib/haptics.ts'

/**
 * The pending hero's commands (Phase 4): the bottom bar (Attack, the four skills — the largest buttons — the
 * Ultimate when it is ready, Free ally when someone is held) and the column at the right edge (Guard, Item, Row,
 * Flee, Pet stance). Every button is at least 44 px tall. A button that cannot be used now stays visible, dimmed,
 * and a tap says why.
 */
export interface ActionView {
  testid: string
  label: string
  /** The small second line: a cost and weight, a count, where the row swap goes. */
  sub?: ComponentChildren
  enabled: boolean
  /** Why it is unavailable, said on a tap. */
  reason?: string
  /** Waiting for its target (looks pressed). */
  armed?: boolean
  title?: string
  onPress(): void
}

export function ActBtn({ a, cls, busy, onBlocked }: { a: ActionView; cls: string; busy: boolean; onBlocked(reason: string): void }) {
  const off = busy || !a.enabled
  return (
    <button
      type="button"
      class={`fx-act ${cls} ${off ? 'fx-act--off' : ''} ${a.armed ? 'fx-act--armed' : ''}`}
      data-testid={a.testid}
      aria-disabled={off}
      title={!a.enabled && a.reason ? a.reason : a.title}
      onClick={() => {
        if (busy) return
        if (!a.enabled) {
          onBlocked(a.reason ?? 'Not now')
          return
        }
        buzz()
        a.onPress()
      }}
    >
      <span class="fx-act__name">{a.label}</span>
      {!a.enabled && a.reason ? <span class="fx-act__sub fx-act__sub--reason">{a.reason}</span> : a.sub !== undefined && <span class="fx-act__sub">{a.sub}</span>}
    </button>
  )
}

export function ActionBar({ attack, skills, ultimate, free, busy, onBlocked }: { attack: ActionView | null; skills: readonly ActionView[]; ultimate: ActionView | null; free: ActionView | null; busy: boolean; onBlocked(reason: string): void }) {
  return (
    <div class={`fx-bar ${busy ? 'fx-bar--busy' : ''}`} role="toolbar" aria-label="Commands">
      {attack && <ActBtn a={attack} cls="fx-act--attack" busy={busy} onBlocked={onBlocked} />}
      {skills.map((s) => (
        <ActBtn key={s.testid} a={s} cls="fx-act--skill" busy={busy} onBlocked={onBlocked} />
      ))}
      {ultimate && <ActBtn a={ultimate} cls="fx-act--ult" busy={busy} onBlocked={onBlocked} />}
      {free && <ActBtn a={free} cls="fx-act--free" busy={busy} onBlocked={onBlocked} />}
    </div>
  )
}

export function SideActions({ list, busy, onBlocked }: { list: readonly ActionView[]; busy: boolean; onBlocked(reason: string): void }) {
  return (
    <div class={`fx-side ${busy ? 'fx-bar--busy' : ''}`} role="toolbar" aria-label="More commands">
      {list.map((a) => (
        <ActBtn key={a.testid} a={a} cls="fx-act--side" busy={busy} onBlocked={onBlocked} />
      ))}
    </div>
  )
}

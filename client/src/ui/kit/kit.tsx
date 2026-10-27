import type { ComponentChildren, JSX } from 'preact'
import { useEffect } from 'preact/hooks'
import { profile, toasts } from '../../game/session.ts'
import { buzz } from '../lib/haptics.ts'
import { navigate, type Screen as ScreenName } from '../router.ts'
import './kit.css'

/**
 * The UI kit (Phase 4): the pieces every screen is built from, so the game reads as one thing on the phone —
 * landscape 892 × 412 CSS px, tap targets ≥ 44 px, text ≥ 16 px (CLAUDE.md). Screens compose these and add their
 * own CSS file for layout; they do not restyle the kit.
 */

/** A full-screen page: the top bar (back on the thumb side, the title, the gold) and a scrolling body. */
export function Page({
  name,
  title,
  back = 'title',
  backParams,
  right,
  children,
  bodyClass = '',
}: {
  name: string
  title: string
  back?: ScreenName | null
  backParams?: Record<string, string>
  right?: ComponentChildren
  children: ComponentChildren
  bodyClass?: string
}) {
  return (
    <main class="screen screen--panel page" data-screen={name}>
      <header class="topbar">
        {back !== null ? (
          <button
            class="btn btn--icon"
            aria-label="Back"
            data-testid="back"
            onClick={() => {
              buzz()
              navigate(back, backParams)
            }}
          >
            ‹
          </button>
        ) : (
          <span class="topbar__spacer" />
        )}
        <h1 class="topbar__title">{title}</h1>
        <div class="topbar__actions">
          {right}
          <GoldBadge />
        </div>
      </header>
      <div class={`page__body ${bodyClass}`}>{children}</div>
    </main>
  )
}

/** Purse and bank, from the profile. */
export function GoldBadge() {
  const p = profile.value
  if (!p) return null
  return (
    <span class="gold" data-testid="gold" title="Purse (carried) · Bank (safe)">
      <span class="gold__coin" aria-hidden="true" />
      {p.purse}
      {p.bank > 0 && <small class="gold__bank"> · bank {p.bank}</small>}
    </span>
  )
}

export function Gold({ amount, short = false }: { amount: number; short?: boolean }) {
  return (
    <span class="gold gold--inline">
      <span class="gold__coin" aria-hidden="true" />
      {short && amount >= 10_000 ? `${Math.round(amount / 1000)}k` : amount}
    </span>
  )
}

/** A big tap target. `tone` primary for the one thing the screen wants you to do. */
export function Btn({
  children,
  onClick,
  tone = 'plain',
  size = 'normal',
  disabled = false,
  title,
  testid,
  class: cls = '',
}: {
  children: ComponentChildren
  onClick?: () => void
  tone?: 'plain' | 'primary' | 'danger' | 'quiet'
  size?: 'normal' | 'big' | 'small'
  disabled?: boolean
  title?: string
  testid?: string
  class?: string
}) {
  return (
    <button
      class={`btn btn--${tone} ${size === 'big' ? 'btn--big' : size === 'small' ? 'btn--small' : ''} ${cls}`}
      disabled={disabled}
      title={title}
      data-testid={testid}
      onClick={() => {
        if (disabled) return
        buzz()
        onClick?.()
      }}
    >
      {children}
    </button>
  )
}

/** A labelled bar (HP, pool, XP, light). */
export function Meter({ value, max, label, tone = 'hp', compact = false, testid }: { value: number; max: number; label?: string; tone?: 'hp' | 'pool' | 'xp' | 'light' | 'momentum' | 'enemy'; compact?: boolean; testid?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value * 100) / max)) : 0
  return (
    <div class={`meter meter--${tone} ${compact ? 'meter--compact' : ''}`} data-testid={testid} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div class="meter__fill" style={{ width: `${pct}%` }} />
      {!compact && (
        <span class="meter__text">
          {label ? `${label} ` : ''}
          {Math.round(value)}/{Math.round(max)}
        </span>
      )}
    </div>
  )
}

/** Durability as five pips (03 §6.4: green → amber → red → broken grey). */
export function WearPips({ durability, max = 100 }: { durability: number; max?: number }) {
  const lit = durability <= 0 ? 0 : Math.max(1, Math.ceil(durability / 20))
  const tone = durability <= 0 ? 'broken' : durability < 25 ? 'bad' : durability < 50 ? 'warn' : 'good'
  return (
    <span class={`pips pips--${tone}`} title={`Durability ${durability}% (max ${max}%)`} aria-label={`Durability ${durability} percent`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} class={`pips__pip ${i < lit ? 'pips__pip--on' : ''}`} />
      ))}
    </span>
  )
}

/** A grade letter in its colour (F … God). */
export function Grade({ grade }: { grade: string }) {
  return <span class={`grade grade--${grade.toLowerCase()}`}>{grade}</span>
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div class="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === value}
          class={`tabs__tab ${t.id === value ? 'tabs__tab--on' : ''}`}
          data-testid={`tab-${t.id}`}
          onClick={() => {
            buzz()
            onChange(t.id)
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** A dialog over the screen; tapping the shade closes it when `onClose` is given. */
export function Modal({ title, children, onClose, actions, testid }: { title: string; children: ComponentChildren; onClose?: () => void; actions?: ComponentChildren; testid?: string }) {
  useEffect(() => {
    if (!onClose) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div class="modal" role="dialog" aria-label={title} data-testid={testid} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div class="modal__card">
        <h2 class="modal__title">{title}</h2>
        <div class="modal__body">{children}</div>
        {actions && <div class="modal__actions">{actions}</div>}
      </div>
    </div>
  )
}

/** A tappable tile in a grid (a town place, a species, a chest). */
export function Tile({ title, sub, icon, onClick, selected = false, disabled = false, testid, children }: { title: string; sub?: string; icon?: string; onClick?: () => void; selected?: boolean; disabled?: boolean; testid?: string; children?: ComponentChildren }) {
  return (
    <button
      class={`tile ${selected ? 'tile--on' : ''}`}
      disabled={disabled}
      data-testid={testid}
      onClick={() => {
        if (disabled) return
        buzz()
        onClick?.()
      }}
    >
      {icon && (
        <span class="tile__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span class="tile__title">{title}</span>
      {sub && <span class="tile__sub">{sub}</span>}
      {children}
    </button>
  )
}

export function Section({ title, children, right }: { title: string; children: ComponentChildren; right?: ComponentChildren }) {
  return (
    <section class="section">
      <div class="section__head">
        <h2 class="section__title">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ComponentChildren }) {
  return <p class="empty">{children}</p>
}

/**
 * A small coloured pill. `variant="label"` is the plain label (no tap height, text centred) for a status beside a
 * name or in a row of facts; the default keeps the older look for the screens already using it.
 */
export function Chip({ children, tone = 'plain', title, variant = 'chip' }: { children: ComponentChildren; tone?: 'plain' | 'good' | 'bad' | 'warn' | 'note'; title?: string; variant?: 'chip' | 'label' }) {
  return (
    <span class={`chip chip--${tone} ${variant === 'label' ? 'chip--label' : ''}`} title={title}>
      {children}
    </span>
  )
}

/** The toasts from `session.toast` (bottom-centre, never over the action buttons' row). */
export function ToastHost() {
  return (
    <div class="toasts" aria-live="polite">
      {toasts.value.map((t) => (
        <div key={t.id} class={`toasts__toast toasts__toast--${t.tone}`} data-testid="toast">
          {t.text}
        </div>
      ))}
    </div>
  )
}

/** A stat line: label left, value right. */
export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }): JSX.Element {
  return (
    <div class="stat" title={hint}>
      <span class="stat__label">{label}</span>
      <span class="stat__value">{value}</span>
    </div>
  )
}

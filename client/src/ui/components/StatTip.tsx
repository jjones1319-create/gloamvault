import { signal } from '@preact/signals'
import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { route } from '../router.ts'
import { bubblePlacement, type Box } from './tipPlace.ts'
import './statTip.css'

/**
 * A stat you can ask about (12 Phase 8, pass B): tap — or hold — a stat on the hero screen, an item card or the fight
 * HUD and a bubble says it in plain words with the hero's own numbers (statLines.ts). One bubble at a time, drawn by
 * the one TipHost in app.tsx so no scrolling panel or dialog clips it; it closes on the next tap anywhere, Escape, a
 * scroll or a new screen. The button is a 44 px tap target and its text follows the text-size setting (base.css).
 * `onShow` hands the line to a host's own tip instead (the fight HUD's, so its words sit where its other tips do).
 */

interface OpenTip {
  id: number
  line: string
  box: Box
  owner: HTMLElement
}

export const openTip = signal<OpenTip | null>(null)

let nextId = 0
const HOLD_MS = 450

export function closeTip(): void {
  if (openTip.value) openTip.value = null
}

export function StatTip({
  label,
  value,
  line,
  testid,
  class: cls = '',
  onShow,
  disabled = false,
  children,
}: {
  label?: ComponentChildren
  value?: ComponentChildren
  /** The plain-words line the bubble shows. */
  line: string
  testid?: string
  class?: string
  /** Show the line in a host's own tip instead of the bubble (the fight HUD). */
  onShow?: (line: string) => void
  /** A disabled tip lets taps through to what is under it (a fight card while a command picks its target). */
  disabled?: boolean
  /** Custom content; otherwise the label and the value. */
  children?: ComponentChildren
}) {
  const id = useRef(0)
  if (id.current === 0) id.current = ++nextId
  const timer = useRef<number | null>(null)
  const held = useRef(false)
  const open = openTip.value?.id === id.current
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      if (openTip.value?.id === id.current) openTip.value = null
    },
    [],
  )
  const show = (el: HTMLElement) => {
    if (onShow) {
      onShow(line)
      return
    }
    const r = el.getBoundingClientRect()
    openTip.value = { id: id.current, line, box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, owner: el }
  }
  const stopHold = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }
  if (disabled) {
    return <span class={`stip stip--off ${cls}`}>{children ?? <TipFace label={label} value={value} />}</span>
  }
  return (
    <button
      type="button"
      class={`stip ${open ? 'stip--open' : ''} ${cls}`}
      data-testid={testid}
      aria-expanded={onShow ? undefined : open}
      aria-describedby={open ? 'stip-bubble' : undefined}
      onPointerDown={(e) => {
        held.current = false
        stopHold()
        const el = e.currentTarget as HTMLElement
        timer.current = window.setTimeout(() => {
          held.current = true
          show(el)
        }, HOLD_MS)
      }}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation()
        if (held.current) {
          // The hold already opened it; the release's click must not close it again.
          held.current = false
          return
        }
        if (open) openTip.value = null
        else show(e.currentTarget as HTMLElement)
      }}
    >
      {children ?? <TipFace label={label} value={value} />}
    </button>
  )
}

function TipFace({ label, value }: { label?: ComponentChildren; value?: ComponentChildren }) {
  return (
    <>
      <span class="stip__label">{label}</span>
      {value !== undefined && <span class="stip__value">{value}</span>}
    </>
  )
}

/** The one bubble (mounted once in app.tsx). */
export function TipHost() {
  const tip = openTip.value
  const bubble = useRef<HTMLDivElement>(null)
  const screen = route.value.screen
  const params = route.value.params
  // A new screen (or a new tab or place) closes the bubble.
  useEffect(() => closeTip(), [screen, params])
  useEffect(() => {
    if (!tip) return
    const down = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (target && (tip.owner.contains(target) || bubble.current?.contains(target))) return
      closeTip()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTip()
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('scroll', closeTip, true)
    window.addEventListener('keydown', key)
    window.addEventListener('resize', closeTip)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('scroll', closeTip, true)
      window.removeEventListener('keydown', key)
      window.removeEventListener('resize', closeTip)
    }
  }, [tip])
  if (!tip) return null
  const place = bubblePlacement(tip.box, { width: window.innerWidth, height: window.innerHeight })
  return (
    <div
      id="stip-bubble"
      ref={bubble}
      role="tooltip"
      class={`stip-bubble stip-bubble--${place.side}`}
      data-testid="stat-tip"
      style={{ left: `${place.left}px`, width: `${place.width}px`, ...(place.side === 'below' ? { top: `${place.top}px` } : { bottom: `${place.bottom}px` }) }}
      onClick={closeTip}
    >
      {tip.line}
    </div>
  )
}

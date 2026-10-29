import { useEffect, useState } from 'preact/hooks'
import { COACH_MARKS, coachDemo, coachFor, markCoachSeen, skipCoach, type CoachHit, type CoachPlace } from '../../game/coach.ts'
import { act, delve, delveVersion, ephemeral, profile } from '../../game/session.ts'
import { route } from '../router.ts'
import { fightAuto } from '../screens/delve/fight/prefs.ts'
import './coach.css'

/**
 * The lesson's coach marks on screen (D-038; Phase 8, pass B; the rules are game/coach.ts). A short card with "Got it"
 * and "Skip the lesson", and a ring around the thing it is about. The card sits where the screen has room — over the
 * room's left side, the fight's middle, the hero screen's corner, or among the town's notices (`CoachInline`) — and
 * never over the room panel, the fight's commands or the town's places, so nothing it teaches is covered. A demo or
 * deep-link session shows none unless its link asked for the lesson (`coachDemo`).
 */

function useCoach(): CoachHit | null {
  void delveVersion.value
  const r = route.value
  const p = profile.value
  const d = delve.value
  if (!p || (ephemeral.value && !coachDemo.value)) return null
  const pending = d?.fight?.pendingActorId ? d.fight.actors.find((a) => a.id === d.fight!.pendingActorId) : undefined
  return coachFor({ screen: r.screen, params: r.params, profile: p, delve: d, heroTurn: pending?.kind === 'hero' && !fightAuto.value })
}

function CoachCard({ hit, place }: { hit: CoachHit; place: CoachPlace }) {
  const mark = COACH_MARKS[hit.id]
  return (
    <>
      <section class={`coach coach--${place}`} role="dialog" aria-modal="false" aria-labelledby={`coach-title-${mark.id}`} data-testid={`coach-${mark.id}`}>
        <h2 class="coach__title" id={`coach-title-${mark.id}`}>
          {mark.title}
        </h2>
        <p class="coach__text">{mark.text}</p>
        <div class="coach__actions">
          <button type="button" class="btn btn--small btn--primary coach__btn" data-testid="coach-ok" onClick={() => act((_c, p) => markCoachSeen(p, mark.id))}>
            Got it
          </button>
          <button type="button" class="btn btn--small btn--quiet coach__btn" data-testid="coach-skip" onClick={() => act((_c, p) => skipCoach(p), 'The lesson’s notes are off. Settings can replay them.')}>
            Skip the lesson
          </button>
        </div>
      </section>
      {hit.target && <CoachRing selector={hit.target} />}
    </>
  )
}

/** The marks that float over a screen (the room, the fight, the hero screen); mounted once in app.tsx. */
export function CoachHost() {
  const hit = useCoach()
  if (!hit) return null
  const place = COACH_MARKS[hit.id].place
  if (place === 'town') return null
  return <CoachCard key={hit.id} hit={hit} place={place} />
}

/** The town's marks, among its notices (the hub renders this in its top row). */
export function CoachInline() {
  const hit = useCoach()
  if (!hit || COACH_MARKS[hit.id].place !== 'town') return null
  return <CoachCard key={hit.id} hit={hit} place="town" />
}

interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/** A pulsing ring around the element a mark is about, following it as the screen lays out (pointer events pass through). */
function CoachRing({ selector }: { selector: string }) {
  const [rect, setRect] = useState<Rect | null>(null)
  useEffect(() => {
    let live = true
    let revealed = false
    const measure = () => {
      if (!live) return
      const el = document.querySelector(selector)
      // Once: a target below the fold of its panel (the room panel's Disarm) scrolls into that panel's view.
      if (el && !revealed) {
        revealed = true
        revealInPanel(el)
      }
      const r = el?.getBoundingClientRect()
      const next = r && r.width > 0 && r.height > 0 ? { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) } : null
      setRect((prev) => (prev && next && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height ? prev : next))
    }
    measure()
    const id = window.setInterval(measure, 250)
    window.addEventListener('resize', measure)
    return () => {
      live = false
      window.clearInterval(id)
      window.removeEventListener('resize', measure)
    }
  }, [selector])
  if (!rect) return null
  return <span class="coach-ring" aria-hidden="true" style={{ left: `${rect.left - 4}px`, top: `${rect.top - 4}px`, width: `${rect.width + 8}px`, height: `${rect.height + 8}px` }} />
}

/** Scrolls the nearest scrolling panel around `el` (never the page) so all of `el` shows. */
function revealInPanel(el: Element): void {
  let host = el.parentElement
  while (host && host !== document.body) {
    const style = getComputedStyle(host)
    if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && host.scrollHeight > host.clientHeight) break
    host = host.parentElement
  }
  if (!host || host === document.body) return
  const box = host.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  if (r.bottom > box.bottom) host.scrollTop += r.bottom - box.bottom + 8
  else if (r.top < box.top) host.scrollTop -= box.top - r.top + 8
}

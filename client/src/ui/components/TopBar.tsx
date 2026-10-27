import type { ComponentChildren } from 'preact'
import { buzz } from '../lib/haptics.ts'
import { navigate, type Screen } from '../router.ts'

/** A screen header with a back button on the left (the thumb side in landscape) and a title. */
export function TopBar({ title, back = 'title', children }: { title: string; back?: Screen; children?: ComponentChildren }) {
  return (
    <header class="topbar">
      <button
        class="btn btn--icon"
        aria-label="Back"
        onClick={() => {
          buzz()
          navigate(back)
        }}
      >
        ‹
      </button>
      <h1 class="topbar__title">{title}</h1>
      <div class="topbar__actions">{children}</div>
    </header>
  )
}

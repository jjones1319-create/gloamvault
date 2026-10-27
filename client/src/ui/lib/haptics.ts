import { settings } from '../store/settings.ts'

/** A short buzz on a tap (Android Chrome supports navigator.vibrate; CLAUDE.md gotchas). Off when the setting is off. */
export function buzz(ms = 8): void {
  if (!settings.value.haptics) return
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* ignore */
  }
}

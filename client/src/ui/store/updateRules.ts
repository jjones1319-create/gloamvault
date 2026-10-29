/**
 * When the update toast may show, and when a waiting update may reload the page (CLAUDE.md gotchas: "never auto-reload
 * mid-fight; the update toast only in town"; 12 Phase 8, pass B): on the title and in town — the hub, its places and the
 * screens opened from it (a hero, the codex) — and only while no delve is in progress, even one left on the title or in
 * Settings: a delve resumes by replaying its log, and a new build may not replay it. Pure, tested in node.
 */
export const UPDATE_SCREENS: ReadonlySet<string> = new Set(['title', 'town', 'hero', 'codex'])

export function updateQuiet(screen: string, delveInProgress: boolean): boolean {
  return !delveInProgress && UPDATE_SCREENS.has(screen)
}

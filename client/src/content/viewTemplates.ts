import type { Content } from '../../../sim/src/content.ts'
import type { ViewTemplate } from '../scene/room.ts'

/**
 * Room templates for the room viewer (Phase 6, `#room=<templateId>`): the game's own (the content bundle), and the
 * Crypts and Vault templates the kit passes write ahead of Phase 7 as `templates/*.json.later` — never loaded by the
 * game, fetched here one at a time, only when the viewer asks for one.
 */
const LATER = import.meta.glob('../../../content/dungeons/*/templates/*.json.later', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>

/** `cel_t_kennels` and `cel-t-kennels` are the same template. */
export function normaliseTemplateId(id: string): string {
  return id.trim().toLowerCase().replace(/_/g, '-')
}

/** Every `.later` template id there is (for the viewer's list). */
export function laterTemplateIds(): string[] {
  return Object.keys(LATER)
    .map((k) => /\/([^/]+)\.json\.later$/.exec(k)?.[1] ?? '')
    .filter(Boolean)
    .sort()
}

function looksLikeTemplate(j: unknown): j is ViewTemplate {
  const o = j as Partial<ViewTemplate> | null
  return !!o && typeof o.id === 'string' && !!o.footprint && Array.isArray(o.doors) && Array.isArray(o.props) && !!o.camera
}

/** The template by id: the content's, else a `.later` file's; null when there is neither. */
export async function findViewTemplate(content: Content, rawId: string): Promise<ViewTemplate | null> {
  const id = normaliseTemplateId(rawId)
  for (const d of content.dungeons.values()) {
    const t = d.templates.find((x) => x.id === id)
    if (t) return t as unknown as ViewTemplate
  }
  for (const [path, load] of Object.entries(LATER)) {
    if (!path.endsWith(`/${id}.json.later`)) continue
    try {
      const json: unknown = JSON.parse(await load())
      if (looksLikeTemplate(json)) return { ...json, kinds: Array.isArray(json.kinds) && json.kinds.length ? json.kinds : ['fight'] }
    } catch (e) {
      console.warn(`template ${id} could not be read`, e)
    }
  }
  return null
}

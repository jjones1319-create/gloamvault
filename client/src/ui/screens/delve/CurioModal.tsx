import type { DelveCommand } from '../../../../../sim/src/delve-types.ts'
import { content, delve, delveCommand, delveVersion, legalActions } from '../../../game/session.ts'
import { Btn, Modal } from '../../kit/kit.tsx'
import { groupActions } from './actions.ts'
import { requirementWords } from './words.ts'

/**
 * A curio (03 §4.6, 07 §2.4): its name, what it looks like, and its choices — the ones the party cannot take show
 * what is missing; a choice that spends an item says so. There is always a way to leave it alone.
 */
export function CurioModal() {
  void delveVersion.value
  const d = delve.value
  const c = content.value
  if (!d || !c || d.phase.kind !== 'curio') return null
  const curioId = d.phase.curioId
  const curio = c.dungeons.get(d.options.dungeonId)?.curios.find((x) => x.id === curioId)
  const groups = groupActions(legalActions.value)
  const itemName = (id: string) => c.items.get(id)?.name ?? id.replace(/-/g, ' ')
  return (
    <Modal title={curio?.name ?? 'A curio'} testid="dv-curio">
      {curio?.description && <p class="dv-curio__text">{curio.description}</p>}
      <div class="dv-curio__choices">
        {groups.curio.map((item) => {
          const choice = (item.action.command as { choice?: number }).choice ?? 0
          const reqs = curio?.choices[choice]?.requires ?? []
          // The sim tags a choice "(safe)" when its item takes the risk away and "(leave)" when nothing happens.
          const tagged = /^(.*) \((safe|leave)\)$/.exec(item.label)
          const label = tagged ? tagged[1]! : item.label
          const hints = !item.action.enabled
            ? reqs.map((r) => requirementWords(r, itemName))
            : [
                ...(tagged?.[2] === 'safe' ? ['safe'] : tagged?.[2] === 'leave' ? ['nothing happens'] : []),
                ...reqs.filter((r) => r.kind === 'item' && r.consumed !== false).map((r) => `uses ${requirementWords(r, itemName).replace(/^needs /, '')}`),
              ]
          const hint = hints.join(' · ')
          return (
            <Btn key={item.testid} class="dv-act" testid={item.testid} disabled={!item.action.enabled} onClick={() => delveCommand(item.action.command as DelveCommand)}>
              <span class="dv-act__label">{label}</span>
              {hint && <small class="dv-act__why">{hint}</small>}
            </Btn>
          )
        })}
        {groups.curio.length === 0 && groups.next && (
          <Btn class="dv-act" testid="dv-continue" onClick={() => delveCommand({ kind: 'continue' })}>
            Leave it
          </Btn>
        )}
      </div>
    </Modal>
  )
}

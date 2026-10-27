import { delve, delveCommand, delveVersion } from '../../../game/session.ts'
import { Btn } from '../../kit/kit.tsx'
import { Icon } from './icons.tsx'
import { resultLines } from './words.ts'

/**
 * After a fight (or a flight): the title and what came of it — gold, items, parts, what grew — with a death under
 * the Mortal rule first (D-088) and level-ups next in their own colour (D-082), then Continue. It sits where the room
 * panel was, so the room stays in view.
 */
export function ResultCard() {
  void delveVersion.value
  const d = delve.value
  if (!d || d.phase.kind !== 'result') return null
  const lines = resultLines(d.phase.lines)
  const deaths = lines.filter((l) => l.death)
  const ups = lines.filter((l) => l.levelUp)
  const rest = lines.filter((l) => !l.levelUp && !l.death)
  const tone = d.phase.title === 'Victory' ? 'good' : 'plain'
  return (
    <section class="dv-result" data-testid="dv-result" aria-live="polite">
      <h2 class={`dv-result__title dv-result__title--${tone}`}>{d.phase.title}</h2>
      <div class="dv-result__body">
        {deaths.map((l) => (
          <div key={l.text} class="dv-death" data-testid="dv-death">
            <Icon name="skull" size={16} />
            <span>{l.text}</span>
          </div>
        ))}
        {ups.map((l) => (
          <div key={l.text} class="dv-levelup" data-testid="dv-levelup">
            <b>Level up!</b> {l.hero} is now level {l.level}
            {l.rest && <small>{l.rest}</small>}
          </div>
        ))}
        <ul class="dv-result__lines">
          {rest.map((l, i) => (
            <li key={i} class={`dv-result__line--${l.tone}`}>
              {l.text}
            </li>
          ))}
        </ul>
      </div>
      <Btn tone="primary" class="dv-result__go" testid="dv-continue" onClick={() => delveCommand({ kind: 'continue' })}>
        Continue
      </Btn>
    </section>
  )
}

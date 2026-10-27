import { isMortal } from '../../../../../sim/src/delve.ts'
import { content, delve, delveVersion, ephemeral, finishDelve } from '../../../game/session.ts'
import { navigate } from '../../router.ts'
import { Btn, Gold, Modal, Stat } from '../../kit/kit.tsx'
import { Icon } from './icons.tsx'
import { deathLines, overWords } from './words.ts'

/**
 * The end of a delve (03 §12): cleared, walked out, teleported out or fallen — in plain words — with what comes
 * home, and the way back to Emberfall (a deep-link test delve goes back to the title). Under Mortal (D-088) it says
 * who died and lies at the Ember Shrine, or after a wipe who is lost for good and what the bearers bring home.
 */
export function OverCard() {
  void delveVersion.value
  const d = delve.value
  const c = content.value
  if (!d || !c || d.phase.kind !== 'over') return null
  const dungeon = c.dungeons.get(d.options.dungeonId)
  const zone = dungeon?.zones.find((z) => d.floor.number >= z.floors.from && d.floor.number <= z.floors.to)
  const atEnd = d.floor.currentRoomId === d.floor.graph.exitId
  const mortal = isMortal(d)
  const outcome = d.phase.outcome
  const words = overWords(outcome, atEnd, d.floor.number, zone?.name ?? dungeon?.name ?? 'The zone', mortal)
  const deaths = deathLines(
    d.heroes.map((h) => ({ name: h.record.name, fallen: h.fallen, hasPet: h.record.petInstance !== null })),
    outcome,
    mortal,
  )
  const from = d.options.floor ?? 1
  const levels = d.heroes.filter((h) => h.growth.levelsGained > 0 && !(mortal && outcome === 'wiped'))
  const home = () => {
    const toTitle = ephemeral.value
    finishDelve()
    navigate(toTitle ? 'title' : 'town')
  }
  return (
    <Modal
      title={words.title}
      testid="dv-over"
      actions={
        <Btn tone="primary" testid="dv-home" onClick={home}>
          {ephemeral.value ? 'Back to the title' : 'Back to Emberfall'}
        </Btn>
      }
    >
      <p class={`dv-over__line dv-over__line--${words.tone}`}>{words.line}</p>
      {deaths.lost.length > 0 && (
        <ul class="dv-over__deaths dv-over__deaths--lost" data-testid="dv-over-lost">
          {deaths.lost.map((line) => (
            <li key={line}>
              <Icon name="skull" size={15} /> {line}
            </li>
          ))}
        </ul>
      )}
      {deaths.died.length > 0 && (
        <ul class="dv-over__deaths" data-testid="dv-over-died">
          {deaths.died.map((line) => (
            <li key={line}>
              <Icon name="skull" size={15} /> {line}
            </li>
          ))}
        </ul>
      )}
      <div class="stat-grid dv-over__stats">
        {outcome === 'wiped' ? <Stat label="Gold lost" value={d.stats.goldLost} /> : <Stat label="Gold brought home" value={d.gold} />}
        <Stat label="Floors" value={from === d.floor.number ? `${from}` : `${from}–${d.floor.number}`} />
        <Stat label="Items found" value={d.pile.length} />
        <Stat label="Parts" value={d.stats.partsFound} />
        <Stat label="Fights" value={d.stats.fights} />
        <Stat label="Rooms" value={d.stats.rooms} />
        {d.stats.raises > 0 && <Stat label="Raised from the dead" value={d.stats.raises} />}
      </div>
      {levels.length > 0 && (
        <p class="dv-over__levels">
          {levels.map((h) => (
            <span key={h.record.id} class="dv-levelup dv-levelup--inline">
              <b>{h.record.name}</b> +{h.growth.levelsGained} level{h.growth.levelsGained > 1 ? 's' : ''} (now {h.record.level})
            </span>
          ))}
        </p>
      )}
      {outcome !== 'wiped' && d.gold > 0 && (
        <p class="dv-over__hint">
          <Gold amount={d.gold} /> goes into the purse; bank it in Emberfall to keep it safe.
        </p>
      )}
    </Modal>
  )
}

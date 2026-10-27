import { isMortal } from '../../../../../sim/src/delve.ts'
import { lightBand } from '../../../../../sim/src/light.ts'
import { delvePartyLevel, floorThreat } from '../../../../../sim/src/threat.ts'
import { BAND_NAMES, type BandId } from '../../../scene/room/look.ts'
import { content, delve, delveVersion } from '../../../game/session.ts'
import { Gold, Meter } from '../../kit/kit.tsx'
import { Icon } from './icons.tsx'
import { clockWords, THREAT_NAMES } from './words.ts'

/**
 * Top-left of the delve screen: where the party is (dungeon, floor, zone), the light meter with its band, the floor
 * clock with the hunter's warning (03 §4.5), the gold carried, how dangerous this floor (and its boss) is for the
 * party (D-092), and the save's death rule (Mortal, D-088) or the floor's revives (Sheltered).
 */
export function DelveHeader() {
  void delveVersion.value
  const d = delve.value
  const c = content.value
  if (!d || !c) return null
  const t = c.tuning
  const dungeon = c.dungeons.get(d.options.dungeonId)
  const floorNo = d.floor.number
  const zone = dungeon?.zones.find((z) => floorNo >= z.floors.from && floorNo <= z.floors.to)
  const fd = dungeon?.floors.find((f) => f.floor === floorNo)
  const band = lightBand(t, d.light).id as BandId
  const hunter = d.floor.hunter
  const enterAt = hunter ? (d.knobs.hunterClock ?? fd?.hunterClock ?? t.exploration.floorClock.hunterEntersAt) : null
  const hunterName = hunter ? (c.monsters.get(hunter.monsterId)?.name ?? 'The hunter') : ''
  const clock = clockWords(d.floor.clock, enterAt, hunter, hunterName)
  const mortal = isMortal(d)
  const partyLevel = delvePartyLevel(d)
  const threat = floorThreat(c, d.options.dungeonId, floorNo, partyLevel)
  const worst = threat?.boss && ['easy', 'even', 'dangerous', 'deadly'].indexOf(threat.boss.band) > ['easy', 'even', 'dangerous', 'deadly'].indexOf(threat.floor.band) ? threat.boss.band : threat?.floor.band
  return (
    <header class="dv-head" data-testid="dv-head">
      <div class="dv-head__title">
        <b>
          {dungeon?.name ?? 'The dungeon'} · Floor {floorNo}
        </b>
        {zone && <span class="dv-head__zone">{zone.name}</span>}
      </div>
      <div class="dv-head__row">
        <div class={`dv-light dv-light--${band}`} title="The party's light: brighter rooms are safer, darker ones pay more">
          <Meter tone="light" value={d.light} max={t.exploration.light.max} label={BAND_NAMES[band]} testid="dv-light" />
        </div>
        <span class={`dv-chip dv-chip--${clock.tone}`} data-testid="dv-clock" title="The floor clock: one tick a room, one a fight round">
          {clock.tone !== 'plain' && <Icon name="paw" size={14} />}
          {clock.text}
        </span>
        <span class="dv-chip" title="Gold the party carries (lost if the party falls)">
          <Gold amount={d.gold} />
        </span>
        {threat && worst && (
          <span
            class={`dv-chip dv-chip--threat dv-chip--threat-${worst}`}
            data-testid="dv-floor-threat"
            title={`This floor's monsters are level ${threat.floor.encounterLevel}${threat.boss ? `, its boss counts as ${threat.boss.encounterLevel}` : ''}; the party is level ${partyLevel}`}
          >
            Floor: {THREAT_NAMES[threat.floor.band]}
            {threat.boss && (
              <span data-testid="dv-boss-threat">
                {' '}
                · Boss: {THREAT_NAMES[threat.boss.band]}
              </span>
            )}
          </span>
        )}
        {mortal ? (
          <span class="dv-chip dv-chip--mortal" data-testid="dv-death-rule" title="Mortal: a hero who dies in the dungeon stays dead (a healer of level 10 or the Ember Shrine can raise them, for levels)">
            <Icon name="skull" size={14} /> Mortal
          </span>
        ) : (
          <span class="dv-chip" data-testid="dv-death-rule" title="Sheltered: the fallen get up after a fight while the floor's revives last">
            <span class="dv-chip__cross" aria-hidden="true">
              +
            </span>
            {d.floor.revivesLeft}
          </span>
        )}
        {d.floor.hasKey && (
          <span class="dv-chip dv-chip--good" title="The party has this floor's key">
            <Icon name="key" size={14} /> Key
          </span>
        )}
      </div>
    </header>
  )
}

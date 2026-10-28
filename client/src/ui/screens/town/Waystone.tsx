import { useState } from 'preact/hooks'
import type { Content } from '../../../../../sim/src/content.ts'
import { floorThreat, partyLevelOf, type ThreatRead } from '../../../../../sim/src/threat.ts'
import { nightmareBlocker, partyHeroes, waystoneFloors, type Profile } from '../../../../../sim/src/town.ts'
import type { DungeonDef } from '../../../../../sim/src/types/content.ts'
import { content, enterDelve, profile } from '../../../game/session.ts'
import { Btn, Empty, Gold, Section } from '../../kit/kit.tsx'
import { buzz } from '../../lib/haptics.ts'
import { navigate } from '../../router.ts'
import { HeroXp, PlacePage, heroKind } from './shared.tsx'
import { THREAT_NAMES, bossName, isPerilous } from './text.ts'

/**
 * The Waystone (07 §1, D-083, D-092): Gravehollow Keep, the floors the tower remembers with each one's threat for
 * the party going in, Normal difficulty, and Enter. The purse goes in with the party; the bank stays in town. Under
 * the Mortal rule a Dangerous or Deadly floor says what dying there means.
 */

/** A threat band as a chip: Easy · Even · Dangerous (amber) · Deadly (red). */
function ThreatChip({ read, label }: { read: ThreatRead; label?: string }) {
  return (
    <span class={`tw-threat tw-threat--${read.band}`} title={`Encounter level ${read.encounterLevel} against party level ${read.partyLevel}`}>
      {label ? `${label}: ` : ''}
      {THREAT_NAMES[read.band]}
    </span>
  )
}

/** Dungeons open to this player: the first from the start, each later one once the boss it names is dead (07 §1.1). */
export function openDungeons(c: Content, p: Profile): DungeonDef[] {
  return [...c.dungeons.values()].filter((d) => d.unlockedBy === null || (p.progress.bossKills[d.unlockedBy] ?? 0) > 0)
}

export function Waystone() {
  const c = content.value!
  const p = profile.value!
  const dungeons = openDungeons(c, p)
  const [dungeonId, setDungeonId] = useState(dungeons[0]?.id ?? '')
  const [picked, setPicked] = useState<number | null>(null)
  const dungeon = c.dungeons.get(dungeonId) ?? dungeons[0]
  if (!dungeon) {
    return (
      <PlacePage id="waystone">
        <Empty>The Waystone is dark: no dungeon is open.</Empty>
      </PlacePage>
    )
  }
  const floors = waystoneFloors(c, p, dungeon.id)
  const deepest = floors[floors.length - 1] ?? 1
  const floor = picked !== null && floors.includes(picked) ? picked : deepest
  const floorDef = dungeon.floors.find((f) => f.floor === floor)
  const zone = dungeon.zones.find((z) => floor >= z.floors.from && floor <= z.floors.to)
  const party = partyHeroes(p)
  const partyLevel = partyLevelOf(party.map((h) => h.level))
  const atFloor = floorThreat(c, dungeon.id, floor, partyLevel)
  const perilous = atFloor !== null && (isPerilous(atFloor.floor.band) || (atFloor.boss !== null && isPerilous(atFloor.boss.band)))
  const firstDelve = p.progress.delves === 0
  const resuming = p.activeDelve !== null
  // D-095: under Nightmare the chosen hero leads every delve.
  const nightmareBlock = nightmareBlocker(p)

  return (
    <PlacePage id="waystone">
      <div class="split split--wide-left tw-waystone">
        <div>
          {dungeons.length > 1 && (
            <div class="tw-row-buttons">
              {dungeons.map((d) => (
                <button
                  key={d.id}
                  class={`tw-seg ${d.id === dungeon.id ? 'tw-seg--on' : ''}`}
                  onClick={() => {
                    buzz()
                    setDungeonId(d.id)
                    setPicked(null)
                  }}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}
          <div class="tw-card tw-dungeon">
            <h2 class="tw-dungeon__name">{dungeon.name}</h2>
            <p class="tw-dungeon__lore">{dungeon.lore}</p>
            <div class="tw-chips">
              <span class="tw-pill">
                Levels {dungeon.levelRange.min}–{dungeon.levelRange.max}
              </span>
              {zone && (
                <span class="tw-pill">
                  {zone.name} · floors {zone.floors.from}–{zone.floors.to}
                </span>
              )}
              {zone && zone.bossIds[0] && <span class="tw-pill tw-pill--warn">Boss: {bossName(c, zone.bossIds[0])}</span>}
            </div>
          </div>
          <Section title="Start on">
            <div class="tw-floors" role="radiogroup" aria-label="Floor">
              {floors.map((f) => {
                const def = dungeon.floors.find((x) => x.floor === f)
                const threat = floorThreat(c, dungeon.id, f, partyLevel)
                return (
                  <button
                    key={f}
                    role="radio"
                    aria-checked={f === floor}
                    class={`tw-floor ${f === floor ? 'tw-floor--on' : ''}`}
                    data-testid={`waystone-floor-${f}`}
                    onClick={() => {
                      buzz()
                      setPicked(f)
                    }}
                  >
                    <span class="tw-floor__n">Floor {f}</span>
                    <span class="tw-floor__sub">{def?.bossId ? `Boss · L${def.monsterLevel}` : `Monsters L${def?.monsterLevel ?? '?'}`}</span>
                    {threat && (
                      <span class="tw-floor__threat" data-testid={`waystone-threat-${f}`}>
                        <ThreatChip read={threat.floor} />
                        {threat.boss && <ThreatChip read={threat.boss} label="Boss" />}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <p class="tw-note">
              Threat for your party (level {partyLevel}).{' '}
              {firstDelve
                ? 'Your first delve: floor 1 is a short lesson of three rooms.'
                : deepest > 1
                  ? `The tower remembers: start on floor ${deepest}.`
                  : 'Finish floor 1 and the tower remembers: next time you can start on floor 2.'}
            </p>
          </Section>
          <div class="tw-difficulty" aria-label="Difficulty">
            <span class="tw-dim tw-small">Difficulty</span>
            <span class="tw-pill tw-pill--on" aria-current="true">
              Normal
            </span>
            <span class="tw-pill tw-pill--off">Hard · later</span>
            <span class="tw-pill tw-pill--off">Dread · later</span>
          </div>
        </div>

        <div class="tw-waystone__go">
          <Section
            title="Going in"
            right={
              <Btn tone="quiet" class="tw-link" onClick={() => navigate('town', { place: 'inn' })}>
                Change at the Inn ›
              </Btn>
            }
          >
            {party.length === 0 ? (
              <Empty>No one is in the party. Choose heroes at the Lantern Inn.</Empty>
            ) : (
              <div class="list">
                {party.map((h) => (
                  <div key={h.id} class="list__row tw-goer">
                    <div class="list__main">
                      <b>{h.name}</b> <span class="tw-dim">· Lv {h.level}</span>
                      <span class="list__sub">{heroKind(c, h)}</span>
                    </div>
                    <HeroXp c={c} hero={h} />
                  </div>
                ))}
              </div>
            )}
          </Section>
          <div class="tw-stake">
            <p class="tw-note">
              You carry <Gold amount={p.purse} /> in: lost if the party falls. The bank's <Gold amount={p.bank} /> stays safe.
            </p>
            {p.purse > 0 && !resuming && (
              <Btn tone="quiet" class="tw-link" onClick={() => navigate('town', { place: 'bank' })}>
                Bank it ›
              </Btn>
            )}
          </div>
          {p.deathRule !== 'sheltered' && perilous && !resuming && (
            <p class="tw-warn-line" data-testid="waystone-mortal-warning">
              Floor {floor} is {atFloor && isPerilous(atFloor.floor.band) ? THREAT_NAMES[atFloor.floor.band] : `${THREAT_NAMES[atFloor!.boss!.band]} at its boss`} for your party.{' '}
              {p.deathRule === 'nightmare' ? 'If your chosen hero dies here, the save ends.' : 'Heroes who die here stay dead.'}
            </p>
          )}
          {nightmareBlock && !resuming && (
            <p class="tw-warn-line" data-testid="waystone-nightmare-block">
              {nightmareBlock}.
            </p>
          )}
          {resuming ? (
            <Btn tone="primary" size="big" testid="waystone-enter" class="tw-enter" onClick={() => navigate('delve')}>
              Back to the delve <small>it waits where you left it</small>
            </Btn>
          ) : (
            <Btn
              tone="primary"
              size="big"
              testid="waystone-enter"
              class="tw-enter"
              disabled={party.length === 0 || !floorDef || nightmareBlock !== null}
              onClick={() => void enterDelve({ dungeonId: dungeon.id, floor, firstDelve })}
            >
              Enter <small>floor {floor}</small>
            </Btn>
          )}
          <p class="tw-note">Leave from a floor's entrance or teleport out at its stairs.</p>
        </div>
      </div>
    </PlacePage>
  )
}

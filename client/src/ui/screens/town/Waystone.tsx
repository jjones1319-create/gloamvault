import { useState } from 'preact/hooks'
import type { Content } from '../../../../../sim/src/content.ts'
import { oathOf, oathTier, pactChoices } from '../../../../../sim/src/pacts.ts'
import { floorThreat, partyLevelOf, type ThreatRead } from '../../../../../sim/src/threat.ts'
import { difficultyChoices, nightmareBlocker, partyHeroes, waystoneFloors, type Profile } from '../../../../../sim/src/town.ts'
import type { DungeonDef, PactDef } from '../../../../../sim/src/types/content.ts'
import type { Difficulty } from '../../../../../sim/src/types/enums.ts'
import { content, enterDelve, profile } from '../../../game/session.ts'
import { Btn, Empty, Gold, Section } from '../../kit/kit.tsx'
import { buzz } from '../../lib/haptics.ts'
import { navigate } from '../../router.ts'
import { HeroXp, PlacePage, heroKind } from './shared.tsx'
import { THREAT_NAMES, bossName, isPerilous } from './text.ts'

/**
 * The Waystone (07 §1, D-083, D-092): Gravehollow Keep, the floors the tower remembers with each one's threat for
 * the party going in, the difficulty (07 §6.1: Normal, then Hard and Dread once the dungeon's final boss is dead on the
 * preset below) and the Pacts (07 §6.2: twelve toggles with their weight, effect and reward; the Oath is their weights
 * summed; a hunter Pact is greyed out where no hunter stalks), and Enter. The purse goes in with the party; the bank
 * stays in town. Under the Mortal rule a Dangerous or Deadly floor says what dying there means.
 */

const DIFFICULTY_NAMES: Record<Difficulty, string> = { normal: 'Normal', hard: 'Hard', dread: 'Dread' }

/** "+20% gold · +10% XP · chests +5" for a Pact (or a set of them). */
export function pactRewardWords(r: { goldPercent: number; xpPercent: number; chestShiftPp: number }): string {
  const bits: string[] = []
  if (r.goldPercent) bits.push(`+${r.goldPercent}% gold`)
  if (r.xpPercent) bits.push(`+${r.xpPercent}% XP`)
  if (r.chestShiftPp) bits.push(`chests +${r.chestShiftPp}`)
  return bits.join(' · ') || 'no reward'
}

/** What a preset changes, in a line (07 §6.1). */
function presetLine(d: DungeonDef, diff: Difficulty): string {
  const k = d.presets[diff] ?? {}
  if (diff === 'normal') return 'The tower as it is.'
  const revives = k.revivesPerFloor ?? 0
  const bits = [`monsters ${k.enemyHpPercent ?? 100}% HP and ${k.enemyDamagePercent ?? 100}% damage`, `${revives} revive${revives === 1 ? '' : 's'} a floor`, `light starts at ${k.lightStart ?? 100}`]
  const pays = [`gold ×${((k.goldPercent ?? 100) / 100).toFixed(2)}`, `XP ×${((k.xpPercent ?? 100) / 100).toFixed(2)}`]
  if (k.chestCentreShift) pays.push('chests a grade better')
  else if (k.chestShiftPp) pays.push(`chests +${k.chestShiftPp}`)
  return `${bits.join(', ')}; ${pays.join(', ')}.`
}

/** The Oath's line under the Pacts: what the Pacts pay, the tier the Oath reaches and the next one. */
function oathLine(reward: { goldPercent: number; xpPercent: number; chestShiftPp: number }, oath: number, tier: { at: number; shiftPp: number; centreShift: number } | null, next: { at: number; shiftPp: number; centreShift: number } | undefined): string {
  if (oath === 0) return 'Take a Pact for more gold, XP and better chests; each costs something real. Their weights add up to your Oath.'
  const now = tier ? (tier.centreShift > 0 ? ` Oath ${tier.at}+: chests in the tower are a grade better.` : ` Oath ${tier.at}+: chests in the tower lean ${tier.shiftPp} points toward a better grade.`) : ''
  const later = next ? (next.centreShift > 0 ? ` At Oath ${next.at} they are a grade better.` : ` At Oath ${next.at} they lean ${next.shiftPp} points toward a better grade.`) : ''
  return `${pactRewardWords(reward)}.${now}${later}`
}

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
  const [wantDifficulty, setDifficulty] = useState<Difficulty>('normal')
  const [wantPacts, setPacts] = useState<string[]>([])
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
  // 07 §6: the presets open in this dungeon, and the Pacts this zone can take.
  const diffs = difficultyChoices(c, p, dungeon.id)
  const difficulty: Difficulty = diffs.find((x) => x.difficulty === wantDifficulty)?.open ? wantDifficulty : 'normal'
  const shut = diffs.find((x) => !x.open)
  const pacts = pactChoices(dungeon, floor)
  const pactIds = wantPacts.filter((id) => pacts.some((x) => x.pact.id === id && x.available))
  const oath = oathOf(dungeon, pactIds)
  const tier = oathTier(c.tuning, oath)
  const nextTier = c.tuning.pacts.oathTiers.find((x) => x.at > oath)
  const reward = pacts
    .filter((x) => pactIds.includes(x.pact.id))
    .reduce((r, { pact }: { pact: PactDef }) => ({ goldPercent: r.goldPercent + pact.reward.goldPercent, xpPercent: r.xpPercent + pact.reward.xpPercent, chestShiftPp: r.chestShiftPp + pact.reward.chestShiftPp }), { goldPercent: 0, xpPercent: 0, chestShiftPp: 0 })

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
          <Section title="Difficulty">
            <div class="tw-row-buttons" role="radiogroup" aria-label="Difficulty">
              {diffs.map((x) => (
                <button
                  key={x.difficulty}
                  role="radio"
                  aria-checked={x.difficulty === difficulty}
                  aria-disabled={!x.open}
                  class={`tw-seg ${x.difficulty === difficulty ? 'tw-seg--on' : ''} ${x.open ? '' : 'tw-seg--off'}`}
                  data-testid={`waystone-difficulty-${x.difficulty}`}
                  title={x.reason ?? undefined}
                  onClick={() => {
                    if (!x.open) return
                    buzz()
                    setDifficulty(x.difficulty)
                  }}
                >
                  {DIFFICULTY_NAMES[x.difficulty]}
                  {!x.open && <span class="tw-lock">locked</span>}
                </button>
              ))}
            </div>
            <p class="tw-note" data-testid="waystone-difficulty-line">
              {presetLine(dungeon, difficulty)}
              {shut?.reason ? ` ${shut.reason}.` : ''}
            </p>
          </Section>
          <Section
            title="Pacts"
            right={
              <span class={`tw-pill ${oath > 0 ? 'tw-pill--on' : ''}`} data-testid="waystone-oath">
                Oath {oath}
              </span>
            }
          >
            <div class="tw-pacts" role="group" aria-label="Pacts">
              {pacts.map(({ pact, available, reason }) => {
                const on = pactIds.includes(pact.id)
                return (
                  <button
                    key={pact.id}
                    role="checkbox"
                    aria-checked={on}
                    aria-disabled={!available}
                    class={`tw-pact ${on ? 'tw-pact--on' : ''} ${available ? '' : 'tw-pact--off'}`}
                    data-testid={`waystone-pact-${pact.id}`}
                    title={reason ?? pact.description}
                    onClick={() => {
                      if (!available) return
                      buzz()
                      setPacts(on ? wantPacts.filter((id) => id !== pact.id) : [...wantPacts.filter((id) => id !== pact.id), pact.id])
                    }}
                  >
                    <span class="tw-pact__head">
                      <span class="tw-pact__name">{pact.name}</span>
                      <span class="tw-pact__weight" aria-label={`weight ${pact.weight}`}>
                        {'◆'.repeat(pact.weight)}
                      </span>
                    </span>
                    <span class="tw-pact__effect">{available ? pact.description : reason}</span>
                    <span class="tw-pact__reward">{pactRewardWords(pact.reward)}</span>
                  </button>
                )
              })}
            </div>
            <p class="tw-note" data-testid="waystone-pact-line">
              {oathLine(reward, oath, tier, nextTier)}
            </p>
          </Section>
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
              onClick={() => void enterDelve({ dungeonId: dungeon.id, floor, firstDelve, difficulty, pactIds })}
            >
              Enter{' '}
              <small>
                floor {floor}
                {difficulty !== 'normal' ? ` · ${DIFFICULTY_NAMES[difficulty]}` : ''}
                {oath > 0 ? ` · Oath ${oath}` : ''}
              </small>
            </Btn>
          )}
          <p class="tw-note">Leave from a floor's entrance or teleport out at its stairs.</p>
        </div>
      </div>
    </PlacePage>
  )
}

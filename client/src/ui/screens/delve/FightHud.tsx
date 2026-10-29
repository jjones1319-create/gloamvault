import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { Content } from '../../../../../sim/src/content.ts'
import { fleeChance, legalFightActions, skillCost, turnForecast } from '../../../../../sim/src/fight.ts'
import { fightThreat } from '../../../../../sim/src/threat.ts'
import type { Actor, FightCommand, FightState, LegalFightAction } from '../../../../../sim/src/fight-types.ts'
import type { Target } from '../../../../../sim/src/types/enums.ts'
import {
  beatMs,
  candidatesFor,
  capitalise,
  describeConsumable,
  downedAllies,
  firstSentence,
  hpBehind,
  itemCount,
  planTargets,
  presenceAhead,
  standingAllies,
  stripChips,
  weightHint,
  withTarget,
} from '../../../game/fightView.ts'
import { content, delve, delveVersion, fightCommand } from '../../../game/session.ts'
import { cue } from '../../../scene/sceneBus.ts'
import { settings } from '../../store/settings.ts'
import { ActionBar, SideActions, type ActionView } from './fight/Actions.tsx'
import { EnemyColumn, PartyColumn, type CardContext } from './fight/Cards.tsx'
import { Banner, Controls, Feed, Tip, TurnStrip, type BannerState } from './fight/Panels.tsx'
import { usePlayback, type FightPlayback } from './fight/playback.ts'
import { fightAuto, fightFinale, fightSpeed, held, setFightSpeed } from './fight/prefs.ts'
import { RuleEditor } from './fight/RuleEditor.tsx'
import { FleeConfirm, ItemSheet, StanceSheet, type ItemRow } from './fight/Sheets.tsx'
import { ArenaBar, ArenaSheet } from './fight/Arena.tsx'
import { arenaRows, tellingIds, torchNote } from './fight/arenaView.ts'
import { relicActiveText } from '../hero/labels.ts'
import './fight.css'

/** D-092: the encounter's threat against the party, in one word. */
const THREAT_WORD = { easy: 'Easy', even: 'Even', dangerous: 'Dangerous', deadly: 'Deadly' } as const

/**
 * The turn-based fight HUD (03 §3, D-085): rendered by the delve screen over the room's stage while the delve's
 * phase is `fight`. The fight waits on every hero's turn — the banner says whose — and plays everything that happened
 * since the last command as a short feed with floating numbers and cues for the 3D scene. Top: the strip of the next
 * turns, Auto, speed, the AI rule. Left: the party. Right: the enemies and Guard / Item / Row / Flee / Pet. Bottom:
 * Attack, the four skills, the Ultimate when it is ready.
 *
 * `fightFinale` (re-exported): true while the last moments of a fight that just ended are still playing. The sim
 * puts the delve in its result phase at once; a delve screen that keeps this HUD mounted while the flag is true shows
 * the killing blow and "Victory!" before its result panel.
 */
export { fightFinale } from './fight/prefs.ts'

export function FightHud() {
  const version = delveVersion.value
  const c = content.value
  const d = delve.value
  const live = d?.fight ?? null
  if (live) held.fight = live
  const fight = live ?? (fightFinale.value ? held.fight : null)
  const pb = usePlayback(fight, { speed: fightSpeed.value, reduceMotion: settings.value.reduceMotion, statuses: c?.statuses, content: c })

  // A new delve starts with Auto off; Auto otherwise stays on from fight to fight until it is switched off.
  useEffect(() => {
    if (d && held.delve !== d) {
      if (held.delve) fightAuto.value = false
      held.delve = d
    }
  }, [d])
  // The finale ends with its playback, and whenever the HUD goes.
  useEffect(() => {
    if (fightFinale.value && !pb.playing) fightFinale.value = false
  })
  useEffect(
    () => () => {
      fightFinale.value = false
    },
    [],
  )

  if (!c || !fight) return <div class="fx-hud fx-hud--empty" data-testid="fight-hud" />
  // `rev` changes whenever the playback does: Hud reads signals, so it only re-renders when a prop changes.
  return <Hud c={c} fight={fight} pb={pb} version={version} rev={pb.rev} />
}

interface Aim {
  command: FightCommand
  ids: string[]
  label: string
  /** The button that started it (it looks pressed until the target is picked). */
  testid: string
}

type Sheet = 'items' | 'stance' | 'flee' | 'rule' | 'arena' | null

/** The legal list's reasons are lower-case fragments ("needs 10 stamina"); the HUD says them as sentences. */
function reasonText(reason: string | undefined): string | undefined {
  return reason ? capitalise(reason) : undefined
}

const ALLY_TARGETS: ReadonlySet<Target> = new Set<Target>(['ally', 'allyLowest', 'allAllies', 'allyRow', 'partyFront', 'partyBack'])

function Hud({ c, fight, pb, version }: { c: Content; fight: FightState; pb: FightPlayback; version: number; rev: number }) {
  const t = c.tuning
  const [aim, setAim] = useState<Aim | null>(null)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [tip, setTip] = useState<{ text: string; key: number } | null>(null)
  const lastHero = useRef<string | null>(null)
  const autoSentAt = useRef(-1)
  const auto = fightAuto.value
  const speed = fightSpeed.value

  const pendingId = fight.pendingActorId
  const hero: Actor | null = pendingId ? (fight.actors.find((a) => a.id === pendingId && a.kind === 'hero') ?? null) : null
  if (hero) lastHero.current = hero.id
  const h = hero?.hero ?? null
  const myTurn = !pb.playing && !fight.over && hero !== null
  const busy = !myTurn || auto

  const legal = useMemo<LegalFightAction[]>(() => (hero && !fight.over ? legalFightActions(c, t, fight) : []), [c, fight, version, hero?.id])
  const forecast = useMemo(() => (fight.over ? [] : turnForecast(c, t, fight, t.combat.timelineStripLength)), [c, fight, version])
  const behind = useMemo(() => hpBehind(fight.log, pb.shown), [fight, version, pb.shown])
  // A monster stays on stage through the beat that kills it (that beat starts at stayFrom).
  const stayFrom = pb.playing && pb.current ? pb.current.start : pb.shown
  const presence = useMemo(() => presenceAhead(fight.log, pb.shown, stayFrom), [fight, version, pb.shown, stayFrom])

  const showTip = (text: string) => setTip({ text, key: Date.now() })
  useEffect(() => {
    if (!tip) return
    const id = window.setTimeout(() => setTip(null), 4000)
    return () => window.clearTimeout(id)
  }, [tip])

  /* ---------- sending commands ---------- */

  const send = (command: FightCommand): boolean => {
    if (fight.over || !fight.pendingActorId || pb.playing) return false
    setAim(null)
    setSheet(null)
    const ok = fightCommand(command)
    // The last blow ends the fight: the delve moves to its result at once; the HUD may still play it out.
    if (ok && fight.over) fightFinale.value = true
    return ok
  }

  const turnCue = (id: string) => {
    cue({ kind: 'clear', actorId: '' })
    cue({ kind: 'turn', actorId: id })
  }

  const startAim = (command: FightCommand, target: Target | null, candidates: readonly string[], label: string, testid: string) => {
    const fallback = 'targetId' in command ? command.targetId : null
    const plan = planTargets(target, candidates, fallback)
    if (plan.kind === 'blocked') {
      showTip(plan.reason)
      return
    }
    if (plan.kind === 'send') {
      send(withTarget(command, plan.targetId))
      return
    }
    setAim({ command, ids: plan.ids, label, testid })
    setTip(null)
    cue({ kind: 'target', actorId: plan.ids[0]! })
  }

  const cancelAim = () => {
    setAim(null)
    if (hero) turnCue(hero.id)
  }

  const pick = (id: string) => {
    if (aim && aim.ids.includes(id)) send(withTarget(aim.command, id))
  }

  const toggleAuto = () => {
    const next = !fightAuto.value
    fightAuto.value = next
    if (next) setAim(null)
  }

  // Whose turn it is, for the scene (and again after a cancelled aim).
  useEffect(() => {
    if (pb.playing || fight.over || !hero) return
    turnCue(hero.id)
  }, [pb.playing, hero?.id, fight.log.length, fight.over])

  // Auto: each hero turn is answered by the hero's AI rule once the playback has shown what happened.
  useEffect(() => {
    if (!auto || pb.playing || fight.over || !hero || sheet) return
    if (autoSentAt.current === fight.log.length) return
    const id = window.setTimeout(
      () => {
        if (fight.over || !fight.pendingActorId || autoSentAt.current === fight.log.length) return
        autoSentAt.current = fight.log.length
        send({ kind: 'auto' })
      },
      Math.round(beatMs(speed) / 2),
    )
    return () => window.clearTimeout(id)
  })

  /* ---------- the pending hero's commands ---------- */

  const find = (kind: FightCommand['kind']) => legal.find((l) => l.command.kind === kind)
  const poolWord = hero?.poolKind === 'mana' ? 'Mana' : 'Stamina'

  const basic = find('basic')
  const attack: ActionView | null =
    hero && h && basic
      ? {
          testid: 'fx-attack',
          // Arrows (08 §4, D-099): the count rides on the attack, amber at ammo.lowAt; an empty bow bashes.
          label: h.ammo && h.weapon.ranged && h.ammo.left <= 0 ? 'Bash' : 'Attack',
          // The button is narrow: a counted bow shows its arrows in place of the weight word.
          sub: h.ammo ? (
            <span class={`fx-ammo ${h.ammo.left <= t.ammo.lowAt ? 'fx-ammo--low' : ''}`} data-testid="fx-ammo">
              {h.ammo.left} {c.items.get(h.ammo.itemId)?.name.toLowerCase() ?? 'arrows'}
            </span>
          ) : (
            weightHint(h.weapon.weight, t.combat.weights.normal)
          ),
          enabled: basic.enabled,
          reason: reasonText(basic.reason),
          title: 'A basic attack with the weapon in hand; it restores some of your pool',
          onPress: () => startAim(basic.command, null, basic.targets, 'Attack', 'fx-attack'),
        }
      : null

  const skills: ActionView[] = []
  if (hero && h) {
    h.actives.forEach((id, slot) => {
      const def = id ? c.skills.get(id) : undefined
      if (!def || def.type !== 'active') return
      const l = legal.find((x) => x.command.kind === 'skill' && x.command.slot === slot)
      const cost = skillCost(t, def, h.ranks[def.id] ?? 1)
      const candidates = l ? candidatesFor(def.target, l.targets, fight, hero.id) : []
      let enabled = l?.enabled ?? false
      let reason = reasonText(l?.reason)
      if (enabled && def.target === 'downedAlly' && candidates.length === 0) {
        enabled = false
        reason = 'No one is down'
      }
      const casts = def.weight === t.combat.weights.heavy && hero.poolKind === 'mana'
      skills.push({
        testid: `fx-skill-${slot}`,
        label: def.name,
        sub: (
          <>
            <b class={`fx-cost fx-cost--${hero.poolKind ?? 'none'}`}>{cost > 0 ? `${cost} ${poolWord}` : 'free'}</b>
            <span class={`fx-weight fx-weight--${weightHint(def.weight, t.combat.weights.normal)}`}>{casts ? 'heavy · cast' : weightHint(def.weight, t.combat.weights.normal)}</span>
          </>
        ),
        enabled,
        reason,
        title: firstSentence(def.description),
        onPress: () => {
          if (l) startAim(l.command, def.target, candidates, def.name, `fx-skill-${slot}`)
        },
      })
    })
  }

  const ultL = find('ultimate')
  const ultDef = h?.ultimateId ? c.skills.get(h.ultimateId) : undefined
  const ultReady = hero ? hero.momentum >= t.derived.momentum.ultimateCost : false
  const ultimate: ActionView | null =
    hero && ultL && ultDef && ultReady
      ? {
          testid: 'fx-ultimate',
          label: ultDef.name,
          sub: 'Ultimate',
          enabled: ultL.enabled,
          reason: reasonText(ultL.reason),
          title: firstSentence(ultDef.description),
          onPress: () => {
            const kind = ultDef.target
            const ids = kind === 'downedAlly' ? downedAllies(fight, hero.id) : ALLY_TARGETS.has(kind) ? standingAllies(fight, hero.id) : ultL.targets
            startAim(ultL.command, kind, ids, ultDef.name, 'fx-ultimate')
          },
        }
      : null

  const freeL = find('freeAlly')
  const free: ActionView | null =
    hero && freeL
      ? { testid: 'fx-free', label: 'Free ally', sub: 'quick', enabled: freeL.enabled, title: 'Break a hold on an ally', onPress: () => startAim(freeL.command, null, freeL.targets, 'Free ally', 'fx-free') }
      : null

  const itemLs = legal.filter((l) => l.command.kind === 'item')
  const itemRows: ItemRow[] =
    hero && h
      ? itemLs.flatMap((l) => {
          const cmd = l.command
          if (cmd.kind !== 'item') return []
          const inst = h.bag.find((i) => i.instanceId === cmd.instanceId)
          const def = inst ? c.items.get(inst.itemId) : undefined
          const effects = def?.consumable?.effects ?? []
          const target: Target | null = def?.consumable ? (effects.length > 0 && effects.every((e) => e.kind === 'pool') ? 'self' : def.consumable.target) : null
          const candidates = candidatesFor(target, l.targets, fight, hero.id)
          const plan = planTargets(target, candidates, hero.id)
          const name = def?.name ?? l.label.replace(/ ×\d+$/, '')
          return [
            {
              instanceId: cmd.instanceId,
              name,
              count: inst?.quantity ?? itemCount(l.label),
              // In the throne a Torch goes into a brazier (06 §3.4; pass C2): its line says so.
              desc: (def?.consumable?.effects.some((e) => e.kind === 'light') ? torchNote(fight, fight.options.torchValue ?? t.exploration.light.torch) : null) ?? (def ? describeConsumable(def, (s) => c.statuses.get(s as never)?.name ?? s) : ''),
              enabled: l.enabled && plan.kind !== 'blocked',
              reason: plan.kind === 'blocked' ? plan.reason : reasonText(l.reason),
              onPick: () => {
                setSheet(null)
                startAim(cmd, target, candidates, name, 'fx-item')
              },
            },
          ]
        })
      : []
  // The worn relic's active (08 §3): a line of the item sheet with its uses left this fight (pass B, Phase 7).
  const relicL = find('relic')
  const relicDef = h?.equipment.relic?.def
  if (hero && h && relicL && relicDef) {
    const target = relicDef.active?.target ?? null
    const candidates = candidatesFor(target, relicL.targets, fight, hero.id)
    itemRows.push({ instanceId: `relic-${relicDef.id}`, name: relicDef.name, count: h.relicUsesLeft, desc: relicActiveText(c, relicDef), enabled: relicL.enabled, reason: reasonText(relicL.reason), onPick: () => { setSheet(null); startAim(relicL.command, target, candidates, relicDef.name, 'fx-item') } })
  }
  const itemTotal = itemRows.reduce((s, r) => s + r.count, 0)

  const guardL = find('guard')
  const arenaList = arenaRows(legal)
  const rowL = find('swapRow')
  const fleeL = find('flee')
  const stanceL = find('stance')
  const pet = hero ? (fight.actors.find((a) => a.pet?.ownerId === hero.id) ?? null) : null
  const bossHere = fight.actors.some((a) => a.side === 'enemy' && !a.gone && (a.monster?.isBoss || a.monster?.cannotFlee))
  const side: ActionView[] = hero
    ? [
        {
          testid: 'fx-guard',
          label: 'Guard',
          sub: 'light',
          enabled: guardL?.enabled ?? false,
          title: 'Half damage until your next turn, +10 Momentum, 10% of your pool back',
          onPress: () => {
            if (guardL) send(guardL.command)
          },
        },
        {
          testid: 'fx-item',
          label: 'Item',
          sub: itemRows.length ? `×${itemTotal}` : 'none',
          enabled: itemRows.length > 0,
          reason: 'Nothing in the bag works in a fight',
          onPress: () => setSheet('items'),
        },
        {
          testid: 'fx-row',
          label: 'Row',
          sub: hero.row === 'front' ? 'to back' : 'to front',
          enabled: rowL?.enabled ?? false,
          reason: rowL?.reason === 'rooted' ? 'Rooted: cannot move' : (reasonText(rowL?.reason) ?? 'Cannot move now'),
          title: `Move to the ${hero.row === 'front' ? 'back' : 'front'} row (a very quick action)`,
          onPress: () => {
            if (rowL) send(rowL.command)
          },
        },
        // A boss arena (07 §2.8; pass C2) cannot be fled: its place goes to the room's interactables.
        fight.arena && arenaList.length > 0
          ? {
              testid: 'fx-arena-action',
              label: 'Arena',
              sub: `${arenaList.filter((r) => r.enabled).length} ready`,
              enabled: true,
              title: 'The room itself: kegs, bone piles, the sluice wheel',
              onPress: () => setSheet('arena'),
            }
          : {
              testid: 'fx-flee',
              label: 'Flee',
              enabled: fleeL?.enabled ?? false,
              reason: bossHere ? 'No running from a boss' : (reasonText(fleeL?.reason) ?? 'Cannot flee now'),
              onPress: () => setSheet('flee'),
            },
        ...(stanceL && pet
          ? [
              {
                testid: 'fx-pet',
                label: 'Pet',
                sub: pet.pet?.stance ?? 'stance',
                enabled: stanceL.enabled,
                title: `${pet.name}'s stance: one free change per fight`,
                onPress: () => setSheet('stance'),
              },
            ]
          : []),
      ]
    : []

  if (aim) for (const v of [attack, ...skills, ultimate, free, ...side]) if (v && v.testid === aim.testid) v.armed = true

  /* ---------- keyboard (desktop testing) ---------- */

  const press = (a: ActionView | null | undefined) => {
    if (!a) return
    if (!a.enabled) {
      if (a.reason) showTip(a.reason)
      return
    }
    a.onPress()
  }
  const keys = useRef<(e: KeyboardEvent) => void>(() => {})
  keys.current = (e: KeyboardEvent) => {
    if (sheet || e.ctrlKey || e.metaKey || e.altKey) return
    const el = e.target as HTMLElement | null
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
    const k = e.key.toLowerCase()
    if (k === 'escape') {
      if (aim) cancelAim()
      return
    }
    if (k === ' ' || e.code === 'Space') {
      e.preventDefault()
      toggleAuto()
      return
    }
    if (pb.playing && k === 'enter') {
      pb.skip()
      return
    }
    if (busy) return
    if (k >= '1' && k <= '4') press(skills.find((s) => s.testid === `fx-skill-${Number(k) - 1}`))
    else if (k === 'a') press(attack)
    else if (k === 'g') press(side.find((s) => s.testid === 'fx-guard'))
    else if (k === 'u') press(ultimate)
    else if (k === 'i') press(side.find((s) => s.testid === 'fx-item'))
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ---------- what shows ---------- */

  const actingName = pb.current?.actorId ? (fight.actors.find((a) => a.id === pb.current?.actorId)?.name ?? null) : null
  let banner: BannerState = { kind: 'none' }
  if (aim) banner = { kind: 'aim', label: aim.label }
  else if (myTurn && !auto && hero) banner = { kind: 'turn', name: hero.name }
  else if (pb.playing && actingName) banner = { kind: 'acting', name: `${actingName} acts` }
  else if (auto && !fight.over) banner = { kind: 'auto' }

  const mortal = delve.value?.options.deathRule === 'mortal' || delve.value?.options.deathRule === 'nightmare'
  const threat = fightThreat(t, fight)
  const x: CardContext = {
    mortal,
    c,
    fight,
    behind,
    presence,
    floaters: pb.floaters,
    activeId: myTurn && hero ? hero.id : null,
    actingId: pb.playing ? (pb.current?.actorId ?? null) : null,
    targets: aim ? new Set(aim.ids) : null,
    onTarget: pick,
    onAim: (id) => cue({ kind: 'target', actorId: id }),
    onTip: showTip,
  }
  const round = pb.playing ? (pb.current?.events[0]?.round ?? fight.round) : fight.round
  const ruleActor = (hero ?? fight.actors.find((a) => a.id === lastHero.current) ?? fight.actors.find((a) => a.kind === 'hero')) || null

  return (
    <div
      class={`fx-hud ${aim ? 'fx-hud--aim' : ''} ${pb.playing ? 'fx-hud--playing' : ''}`}
      data-testid="fight-hud"
      data-turn={myTurn && hero ? hero.id : ''}
      data-playing={pb.playing ? '1' : '0'}
      data-over={fight.over ? fight.over.outcome : ''}
    >
      <PartyColumn x={x} />
      <div class="fx-top">
        {!fight.over && <TurnStrip chips={stripChips(fight, forecast, t.combat.timelineStripLength)} round={round} telling={tellingIds(fight)} />}
        <span class={`fx-threat fx-threat--${threat.band}`} data-testid="fx-threat" title={`Encounter level ${threat.encounterLevel} against your party's level ${threat.partyLevel}`}>
          {THREAT_WORD[threat.band]}
        </span>
        <Controls auto={auto} speed={speed} onAuto={toggleAuto} onSpeed={setFightSpeed} onRule={() => setSheet('rule')} />
      </div>
      <div class="fx-mid">
        <Banner state={banner} onCancel={cancelAim} />
        {tip && <Tip key={tip.key} text={tip.text} onClose={() => setTip(null)} />}
        <Feed lines={pb.feed} playing={pb.playing} onSkip={() => pb.skip()} />
      </div>
      {/* Phase 8: the arena's chips and tells under the enemies they belong to, so a boss on his throne is framed in
          the middle's full height (they stood over his head under the banner). */}
      <div class="fx-foes-area">
        <EnemyColumn x={x} />
        <ArenaBar c={c} fight={fight} onTip={showTip} />
      </div>
      <SideActions list={side} busy={busy} onBlocked={showTip} />
      <ActionBar attack={attack} skills={skills} ultimate={ultimate} free={free} busy={busy} onBlocked={showTip} />
      {sheet === 'items' && hero && <ItemSheet hero={hero.name} rows={itemRows} onClose={() => setSheet(null)} />}
      {sheet === 'stance' && pet?.pet && (
        <StanceSheet
          pet={pet.name}
          current={pet.pet.stance}
          onPick={(s) => {
            setSheet(null)
            send({ kind: 'stance', stance: s })
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'flee' && (
        <FleeConfirm
          chance={fleeChance(c, t, fight)}
          mortal={mortal}
          onFlee={() => {
            setSheet(null)
            if (fleeL) send(fleeL.command)
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'rule' && ruleActor && <RuleEditor c={c} hero={ruleActor} onClose={() => setSheet(null)} />}
      {sheet === 'arena' && hero && (
        <ArenaSheet
          hero={hero.name}
          rows={arenaList}
          onPick={(propId) => {
            setSheet(null)
            send({ kind: 'arena', propId })
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}

import { Fragment, type JSX } from 'preact'
import type { Content } from '../../../../../../sim/src/content.ts'
import type { Actor, FightState } from '../../../../../../sim/src/fight-types.ts'
import { onStage, shownHp, splitName, statusChips, type Presence, type StatusChipView } from '../../../../game/fightView.ts'
import { Meter } from '../../../kit/kit.tsx'
import type { Floater } from './playback.ts'

/**
 * The fight's cards (Phase 4): the party down the left (one card per hero, its pet as a smaller card inside it),
 * the enemies down the right. Every card is a tap target while a command waits for one (`fx-target-<actorId>`);
 * otherwise a tap on a card or a status chip shows its one-line detail.
 */
export interface CardContext {
  c: Content
  fight: FightState
  /** D-088: under the Mortal rule a fallen hero is dead (the card says so). */
  mortal: boolean
  behind: ReadonlyMap<string, number>
  presence: Presence
  floaters: readonly Floater[]
  /** The hero waiting for a command (when the playback is idle). */
  activeId: string | null
  /** The actor of the beat playing now. */
  actingId: string | null
  /** The valid targets while a command waits for one. */
  targets: ReadonlySet<string> | null
  onTarget(id: string): void
  onAim(id: string): void
  onTip(text: string): void
}

function cardClass(base: string, a: Actor, x: CardContext, down: boolean): string {
  const valid = x.targets?.has(a.id) ?? false
  return [
    'fx-card',
    base,
    x.activeId === a.id ? 'fx-card--active' : '',
    x.actingId === a.id ? 'fx-card--acting' : '',
    valid ? 'fx-card--valid' : '',
    x.targets && !valid ? 'fx-card--dim' : '',
    down ? 'fx-card--down' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/** The tap and hover wiring every card shares: a target while aiming, its detail line otherwise. */
function cardHandlers(a: Actor, x: CardContext, detail: () => string) {
  const valid = x.targets?.has(a.id) ?? false
  return {
    'data-testid': `fx-target-${a.id}`,
    'data-valid': valid ? '1' : undefined,
    role: 'button' as const,
    tabIndex: valid ? 0 : -1,
    'aria-label': valid ? `Target ${a.name}` : a.name,
    onClick: (e: MouseEvent) => {
      e.stopPropagation()
      if (valid) x.onTarget(a.id)
      else if (!x.targets) x.onTip(detail())
    },
    onPointerEnter: valid ? () => x.onAim(a.id) : undefined,
    onKeyDown: valid
      ? (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            x.onTarget(a.id)
          }
        }
      : undefined,
  }
}

function Floaters({ id, list }: { id: string; list: readonly Floater[] }) {
  const mine = list.filter((f) => f.actorId === id)
  if (mine.length === 0) return null
  return (
    <div class="fx-floaters" aria-hidden="true">
      {mine.map((f, i) => (
        <span key={f.key} class={`fx-float fx-float--${f.tone}`} style={{ '--i': String(i) }}>
          {f.text}
        </span>
      ))}
    </div>
  )
}

export function StatusRow({ chips, x, inline = false }: { chips: readonly StatusChipView[]; x: CardContext; inline?: boolean }) {
  if (chips.length === 0) return null
  const max = inline ? 3 : 4
  const shown = chips.slice(0, max)
  const more = chips.length - shown.length
  return (
    <div class={`fx-status ${inline ? 'fx-status--inline' : ''}`}>
      {shown.map((s) => (
        <button
          key={s.id}
          type="button"
          class={`fx-chip fx-chip--${s.tone}`}
          style={s.tint ? { '--tint': s.tint } : undefined}
          title={s.line}
          tabIndex={x.targets ? -1 : 0}
          onClick={(e) => {
            if (x.targets) return
            e.stopPropagation()
            x.onTip(s.line)
          }}
        >
          {s.label}
          {s.stacks !== null && <b class="fx-chip__stacks">×{s.stacks}</b>}
          {s.turns !== null && <i class="fx-chip__turns">{s.turns}</i>}
        </button>
      ))}
      {more > 0 && (
        <button
          type="button"
          class="fx-chip fx-chip--note"
          tabIndex={x.targets ? -1 : 0}
          onClick={(e) => {
            if (x.targets) return
            e.stopPropagation()
            x.onTip(chips.map((s) => s.line).join(' · '))
          }}
        >
          +{more}
        </button>
      )}
    </div>
  )
}

function Badge({ tone, children, title }: { tone: string; children: string; title?: string }) {
  return (
    <span class={`fx-badge fx-badge--${tone}`} title={title}>
      {children}
    </span>
  )
}

/** The small state words on a card: guarding, casting, held, down with the turns left, fallen. */
function stateBadges(a: Actor, x: CardContext, hp: number): JSX.Element[] {
  const out: JSX.Element[] = []
  const downAhead = x.presence.revivedAhead.has(a.id)
  if (a.fallen && !x.presence.fallsAhead.has(a.id)) out.push(<Badge tone="fallen">{x.mortal && a.kind === 'hero' ? 'Dead' : 'Fallen'}</Badge>)
  else if ((a.downed && hp <= 0) || downAhead || (a.fallen && x.presence.fallsAhead.has(a.id))) {
    const left = a.downed ? a.downedTurnsLeft : 0
    out.push(
      <Badge tone="down" title={x.mortal ? 'Revive in time or this hero dies for good' : 'A revive in time brings this hero back'}>
        {left > 0 ? `Down · ${left} ${left === 1 ? 'turn' : 'turns'}` : 'Down'}
      </Badge>,
    )
  }
  if (a.fled && !a.fallen) out.push(<Badge tone="fallen">Fled</Badge>)
  if (a.guarding) out.push(<Badge tone="guard">Guard</Badge>)
  if (a.charging) {
    const action = a.charging.action
    const skill = action.kind === 'skill' ? x.c.skills.get(action.skillId)?.name : undefined
    out.push(
      <Badge tone="cast" title={skill ? `Casting ${skill}` : 'Casting'}>
        Casting
      </Badge>,
    )
  }
  if (a.grabbedBy) out.push(<Badge tone="held" title={`Held by ${x.fight.actors.find((o) => o.id === a.grabbedBy)?.name ?? 'an enemy'}`}>Held</Badge>)
  return out
}

function poolName(a: Actor): string {
  return a.poolKind === 'mana' ? 'Mana' : a.poolKind === 'stamina' ? 'Stamina' : 'Pool'
}

function PetCard({ pet, x }: { pet: Actor; x: CardContext }) {
  const hp = shownHp(pet, x.behind)
  const out = pet.gone || pet.fled || ((pet.downed || pet.fallen) && hp <= 0)
  const stance = pet.pet?.stance ?? 'guard'
  const detail = () => `${pet.name} (pet) — HP ${hp}/${pet.maxHp} · ${stance[0]!.toUpperCase()}${stance.slice(1)} stance`
  return (
    <div class={cardClass('fx-card--pet', pet, x, out)} {...cardHandlers(pet, x, detail)}>
      <span class="fx-pet__name">{pet.name}</span>
      {out ? <Badge tone="fallen">Out</Badge> : <Meter compact value={hp} max={pet.maxHp} tone="hp" label={`${pet.name} HP`} />}
      <span class="fx-pet__stance">{stance}</span>
      <Floaters id={pet.id} list={x.floaters} />
    </div>
  )
}

function HeroCard({ hero, pet, x, tight }: { hero: Actor; pet: Actor | null; x: CardContext; tight: boolean }) {
  const hp = shownHp(hero, x.behind)
  const chips = statusChips(hero, x.c.statuses)
  const ultCost = x.c.tuning.derived.momentum.ultimateCost
  const ready = hero.momentum >= ultCost
  const badges = stateBadges(hero, x, hp)
  const down = (hero.downed && hp <= 0) || hero.fallen
  const detail = () => {
    const bits = [`${hero.name} — HP ${hp}/${hero.maxHp}`, `${poolName(hero)} ${hero.pool}/${hero.poolMax}`, `Momentum ${hero.momentum}/${ultCost}${ready ? ' (Ultimate ready)' : ''}`, `${hero.row} row`]
    return bits.join(' · ')
  }
  return (
    <div class={cardClass('fx-card--hero', hero, x, down)} {...cardHandlers(hero, x, detail)}>
      <div class="fx-card__head">
        <span class="fx-card__name">{hero.name}</span>
        <span class="fx-card__row" title={`${hero.row} row`}>
          {hero.row === 'front' ? 'Front' : 'Back'}
        </span>
        {badges}
      </div>
      <Meter value={hp} max={hero.maxHp} tone="hp" label="HP" />
      <div class="fx-card__bars">
        <span class={`fx-gauge fx-gauge--${hero.poolKind ?? 'none'}`} title={`${poolName(hero)} ${hero.pool}/${hero.poolMax}`}>
          <Meter compact value={hero.pool} max={hero.poolMax} tone="pool" label={poolName(hero)} />
        </span>
        <span class={`fx-gauge fx-gauge--momentum ${ready ? 'fx-gauge--ready' : ''}`} title={`Momentum ${hero.momentum}/${ultCost}`}>
          <Meter compact value={hero.momentum} max={ultCost} tone="momentum" label="Momentum" />
        </span>
        {tight && <StatusRow chips={chips} x={x} inline />}
      </div>
      {!tight && <StatusRow chips={chips} x={x} />}
      {pet && <PetCard pet={pet} x={x} />}
      <Floaters id={hero.id} list={x.floaters} />
    </div>
  )
}

export function PartyColumn({ x }: { x: CardContext }) {
  const heroes = x.fight.actors.filter((a) => a.side === 'party' && a.kind === 'hero')
  const pets = x.fight.actors.filter((a) => a.side === 'party' && a.kind !== 'hero')
  const tight = heroes.length >= 3
  const owned = new Set<string>()
  const cards = heroes.map((h) => {
    const pet = pets.find((p) => p.pet?.ownerId === h.id) ?? null
    if (pet) owned.add(pet.id)
    return <HeroCard key={h.id} hero={h} pet={pet} x={x} tight={tight} />
  })
  const strays = pets.filter((p) => !owned.has(p.id))
  return (
    <section class={`fx-party ${tight ? 'fx-party--tight' : ''}`} aria-label="Your party">
      {cards}
      {strays.map((p) => (
        <PetCard key={p.id} pet={p} x={x} />
      ))}
    </section>
  )
}

function EnemyCard({ foe, x, tight }: { foe: Actor; x: CardContext; tight: boolean }) {
  const hp = shownHp(foe, x.behind)
  const chips = statusChips(foe, x.c.statuses)
  const m = foe.monster
  const affixes = (m?.champion?.affixIds ?? []).map((id) => x.c.eliteAffixes.get(id)?.name ?? id)
  const leaving = foe.gone && hp <= 0
  const detail = () => {
    const bits = [`${foe.name} — HP ${hp}/${foe.maxHp}`, `${foe.row} row`]
    if (m?.isBoss) bits.push('boss: no fleeing')
    if (m?.weak.length) bits.push(`weak to ${m.weak.join(', ')}`)
    if (m?.resist.length) bits.push(`resists ${m.resist.join(', ')}`)
    return bits.join(' · ')
  }
  const name = splitName(foe.name)
  return (
    <div class={`${cardClass('fx-card--enemy', foe, x, leaving)} ${m?.isBoss ? 'fx-card--boss' : ''}`} {...cardHandlers(foe, x, detail)}>
      <div class="fx-card__head">
        <span class="fx-card__name">{name.base}</span>
        {name.num && <span class="fx-card__num">{name.num}</span>}
        {m?.isBoss && <Badge tone="boss">Boss</Badge>}
        {name.champion && <Badge tone="boss">Champion</Badge>}
        {foe.charging && <Badge tone="cast">Casting</Badge>}
        {foe.guarding && <Badge tone="guard">Guard</Badge>}
      </div>
      {affixes.length > 0 && (
        <div class="fx-affixes">
          {affixes.map((n) => (
            <span key={n} class="fx-affix">
              {n}
            </span>
          ))}
        </div>
      )}
      <Meter value={hp} max={foe.maxHp} tone="enemy" label="HP" />
      <StatusRow chips={chips} x={x} inline={tight} />
      <Floaters id={foe.id} list={x.floaters} />
    </div>
  )
}

/** The enemies under their row's label (melee reaches the front row first, 03 §3.3). */
export function EnemyColumn({ x }: { x: CardContext }) {
  const foes = x.fight.actors.filter((a) => a.side === 'enemy' && onStage(a, x.presence))
  const tight = foes.length >= 4
  const rows = (['front', 'back'] as const).map((row) => ({ row, list: foes.filter((f) => f.row === row) })).filter((r) => r.list.length > 0)
  return (
    <section class={`fx-foes ${tight ? 'fx-foes--tight' : ''}`} aria-label="Enemies">
      {rows.map((r) => (
        <Fragment key={r.row}>
          <span class="fx-foes__row">{r.row === 'front' ? 'Front row' : 'Back row'}</span>
          {r.list.map((f) => (
            <EnemyCard key={f.id} foe={f} x={x} tight={tight} />
          ))}
        </Fragment>
      ))}
    </section>
  )
}

import type { ComponentChildren } from 'preact'
import { isMortal } from '../../../../../sim/src/delve.ts'
import { isWaystoneFloor } from '../../../../../sim/src/explore.ts'
import type { DelveCommand, LegalDelveAction } from '../../../../../sim/src/delve-types.ts'
import { delvePartyLevel, floorThreat } from '../../../../../sim/src/threat.ts'
import { content, delve, delveCommand, delveVersion, legalActions } from '../../../game/session.ts'
import { Btn, Modal } from '../../kit/kit.tsx'
import { groupActions, splitOwner, type ActionItem } from './actions.ts'
import { Icon } from './icons.tsx'
import { KIND_SHORT, roomLine, stairsThreat, templateName, type StairsThreat } from './words.ts'

/**
 * The room panel (right side, scrolls inside itself): what is here — the room in words, revealed traps, chests,
 * gold, the pedlar's stock — and a button for every legal action that is not a move or a fight command, grouped,
 * each disabled with its reason. Items and pet stances open sheets (a party carries many of each).
 */
type Item = ActionItem<LegalDelveAction>

function ActBtn({ item, tone = 'plain', onDone, children }: { item: Item; tone?: 'plain' | 'primary' | 'quiet'; onDone?: () => void; children?: ComponentChildren }) {
  const a = item.action
  return (
    <Btn
      class="dv-act"
      tone={tone}
      testid={item.testid}
      disabled={!a.enabled}
      title={item.reason}
      onClick={() => {
        delveCommand(a.command as DelveCommand)
        onDone?.()
      }}
    >
      <span class="dv-act__label">{item.label}</span>
      {item.reason && <small class="dv-act__why">{item.reason}</small>}
      {children}
    </Btn>
  )
}

/** The stairs' word on the next floor (D-092), and under Mortal what dying there means (D-088). */
function StairsNote({ note }: { note: StairsThreat }) {
  return (
    <small class={`dv-act__threat dv-act__threat--${note.band}`} data-testid="dv-stairs-threat">
      {note.text}
      {note.warn && <b class="dv-act__warn"> {note.warn}</b>}
    </small>
  )
}

interface Fact {
  text: string
  tone?: 'warn' | 'good' | 'bad'
  icon?: string
}

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}

export function RoomPanel({ onItems, onPets }: { onItems: () => void; onPets: () => void }) {
  void delveVersion.value
  const d = delve.value
  const c = content.value
  if (!d || !c) return null
  const f = d.floor
  const g = f.graph.rooms.find((r) => r.id === f.currentRoomId)
  const rs = f.rooms[f.currentRoomId]
  if (!g || !rs) return null
  const dungeon = c.dungeons.get(d.options.dungeonId)
  const groups = groupActions(legalActions.value)
  const isExit = g.id === f.graph.exitId
  const lastFloor = f.number >= (d.options.lastFloor ?? f.number)

  const facts: Fact[] = []
  for (const t of rs.traps) {
    if (!t.revealed) continue
    const def = dungeon?.traps.find((x) => x.id === t.trapId)
    const state = t.disarmed ? 'disarmed' : t.triggered ? 'sprung' : t.blocksDoorTo ? 'armed, and it blocks a door' : 'armed'
    facts.push({ text: `${def?.name ?? 'A trap'} (difficulty ${def?.difficulty ?? '?'}): ${state}`, tone: t.disarmed || t.triggered ? undefined : 'warn', icon: 'trapGauntlet' })
  }
  for (const ch of rs.chests) {
    const bits = ch.opened ? ['opened'] : [ch.locked ? 'locked' : '', ch.trapped ? 'trapped' : ''].filter(Boolean)
    facts.push({ text: `${cap(ch.size)} chest${bits.length ? `: ${bits.join(', ')}` : ''}`, icon: 'treasure', tone: ch.opened ? undefined : 'good' })
  }
  const gold = rs.goldPiles.reduce((s, x) => s + x, 0)
  if (gold > 0) facts.push({ text: `${gold} gold on the floor`, tone: 'good', icon: 'merchant' })
  if (rs.merchant) {
    const sold = rs.merchant.filter((o) => o.soldOut).map((o) => c.items.get(o.itemId)?.name ?? o.itemId)
    if (sold.length) facts.push({ text: `Sold out: ${sold.join(', ')}` })
  }
  if (rs.curioId) {
    const curio = dungeon?.curios.find((x) => x.id === rs.curioId)
    facts.push({ text: `${curio?.name ?? 'A curio'}${rs.curioUsed ? ': used' : ''}`, icon: 'curio' })
  }
  if (g.hasKey && !f.hasKey) facts.push({ text: "The floor's key is here", tone: 'good', icon: 'key' })
  // The zone's Waystone (07 §1.1: F1, F4, F7; lit once a delve has come this far, town.ts litWaystones); Mourner's
  // Candles' quiet rooms and a turned Sluice Wheel (07 §2.4) last the floor, so the panel says so.
  if (g.kind === 'entry' && dungeon && isWaystoneFloor(dungeon, f.number)) facts.push({ text: "The zone's Waystone: a later delve can start on this floor", tone: 'good', icon: 'entry' })
  if ((f.quietRooms ?? 0) > 0) facts.push({ text: `The candles burn: no ambush in the next ${f.quietRooms} new room${f.quietRooms === 1 ? '' : 's'}`, tone: 'good', icon: 'curio' })
  if (f.sluiceDrained) facts.push({ text: 'The sluice is turned: the next flooded cell is drained', tone: 'good', icon: 'curio' })
  const secretDoor = g.doors.find((x) => x.secret)
  if (secretDoor && rs.secretRevealed && !f.rooms[secretDoor.to]?.visited) facts.push({ text: 'A secret door stands open', tone: 'good', icon: 'secret' })
  const hunter = f.hunter
  if (hunter?.entered && !hunter.killed && hunter.roomId && g.doors.some((x) => x.to === hunter.roomId)) {
    facts.push({ text: `${c.monsters.get(hunter.monsterId)?.name ?? 'The hunter'} is in the next room`, tone: 'bad', icon: 'paw' })
  }

  // The dead the party carries (Mortal, D-088), and who can raise them (D-089).
  const mortal = isMortal(d)
  const dead = mortal ? d.heroes.filter((h) => h.fallen) : []
  const deadFacts: Fact[] = dead.map((h) => ({ text: `${h.record.name} is dead. The party carries the body.`, tone: 'bad', icon: 'skull' }))
  if (dead.length > 0 && groups.raise.length === 0)
    deadFacts.push({ text: 'Only a healer of level 10 who knows a raising skill can bring them back down here; the Ember Shrine in Emberfall always can, for gold and levels.' })

  // At the stairs: the next floor's threat when the delve goes on (D-092).
  let note: StairsThreat | null = null
  const descendAction = groups.leave.find((i) => i.action.command.kind === 'descend')
  if (descendAction && f.number < (d.options.lastFloor ?? f.number)) {
    const next = floorThreat(c, d.options.dungeonId, f.number + 1, delvePartyLevel(d))
    if (next) note = stairsThreat(f.number + 1, next.floor.band, next.boss?.band ?? null, mortal, d.options.deathRule === 'nightmare' ? d.heroes.find((h) => h.record.id === d.options.leaderId)?.record.name : undefined)
  }

  const descend = groups.leave.filter((i) => i.action.command.kind === 'descend')
  const retreat = groups.leave.filter((i) => i.action.command.kind === 'retreat')
  const main = [...groups.loot, ...groups.traps, ...groups.camp, ...groups.shop, ...groups.other]
  return (
    <section class="dv-panel" data-testid="dv-room" aria-label="This room">
      <header class="dv-panel__head">
        <Icon name={g.kind} size={20} />
        <h2 class="dv-panel__title">{templateName(g.templateId)}</h2>
        <span class="dv-panel__kind">{KIND_SHORT[g.kind] ?? g.kind}</span>
      </header>
      <p class="dv-panel__line">{roomLine(g.kind, rs, isExit, lastFloor)}</p>
      {(deadFacts.length > 0 || groups.raise.length > 0) && (
        <div class="dv-dead" data-testid="dv-dead">
          <h3 class="dv-dead__title">
            <Icon name="skull" size={14} /> The dead
          </h3>
          <ul class="dv-facts">
            {deadFacts.map((x, i) => (
              <li key={i} class={x.tone ? `dv-fact--${x.tone}` : ''}>
                {x.icon && <Icon name={x.icon} size={14} />}
                <span>{x.text}</span>
              </li>
            ))}
          </ul>
          {groups.raise.map((item) => (
            <ActBtn key={item.testid} item={item} />
          ))}
        </div>
      )}
      {facts.length > 0 && (
        <ul class="dv-facts">
          {facts.map((x, i) => (
            <li key={i} class={x.tone ? `dv-fact--${x.tone}` : ''}>
              {x.icon && <Icon name={x.icon} size={14} />}
              <span>{x.text}</span>
            </li>
          ))}
        </ul>
      )}
      <div class="dv-acts">
        {descend.map((item) => (
          <ActBtn key={item.testid} item={item} tone="primary">
            {note && <StairsNote note={note} />}
          </ActBtn>
        ))}
        {main.map((item) => (
          <ActBtn key={item.testid} item={item} />
        ))}
        {retreat.map((item) => (
          <ActBtn key={item.testid} item={item} />
        ))}
        {groups.items.length > 0 && (
          <Btn class="dv-act" testid="dv-items" onClick={onItems}>
            <span class="dv-act__label">Use an item…</span>
            <small class="dv-act__why">{groups.items.length} to choose from</small>
          </Btn>
        )}
        {groups.pets.length > 0 && (
          <Btn class="dv-act" testid="dv-pets" onClick={onPets}>
            <span class="dv-act__label">Pet stances…</span>
          </Btn>
        )}
      </div>
      {groups.auto && (
        <Btn class="dv-auto" tone="quiet" testid={groups.auto.testid} title="Let the party's scripted player take one step" onClick={() => delveCommand(groups.auto!.action.command as DelveCommand)}>
          Auto-step
        </Btn>
      )}
    </section>
  )
}

/** "Use an item": the party's usable bag items, by hero. */
export function ItemsSheet({ onClose }: { onClose: () => void }) {
  void delveVersion.value
  const groups = groupActions(legalActions.value)
  const byOwner = new Map<string, Item[]>()
  for (const item of groups.items) {
    const { owner } = splitOwner(item.label)
    const k = owner ?? 'The party'
    const list = byOwner.get(k)
    if (list) list.push(item)
    else byOwner.set(k, [item])
  }
  return (
    <Modal title="Use an item" onClose={onClose} testid="dv-itemsheet" actions={<Btn onClick={onClose}>Close</Btn>}>
      {byOwner.size === 0 && <p class="empty">Nothing to use here.</p>}
      {[...byOwner.entries()].map(([owner, items]) => (
        <section key={owner} class="dv-sheet__group">
          <h3 class="dv-sheet__title">{owner}</h3>
          <div class="dv-sheet__grid">
            {items.map((item) => (
              <Btn key={item.testid} class="dv-act" testid={item.testid} disabled={!item.action.enabled} onClick={() => {
                delveCommand(item.action.command as DelveCommand)
                onClose()
              }}>
                <span class="dv-act__label">{splitOwner(item.label).text}</span>
              </Btn>
            ))}
          </div>
        </section>
      ))}
    </Modal>
  )
}

/** 03 §9's four stances, in a line each. */
const STANCE_WORDS: Readonly<Record<string, string>> = {
  fierce: "attacks its hero's target",
  guard: 'takes some hits meant for its hero',
  mend: 'heals the most hurt ally a little',
  forage: 'no attacks; finds traps, treasure and gold',
}

/** Pet stances (03 §9), per hero with a pet. */
export function PetsSheet({ onClose }: { onClose: () => void }) {
  void delveVersion.value
  const d = delve.value
  const groups = groupActions(legalActions.value)
  const byHero = new Map<number, Item[]>()
  for (const item of groups.pets) {
    const cmd = item.action.command as { heroIndex?: number }
    const k = cmd.heroIndex ?? 0
    const list = byHero.get(k)
    if (list) list.push(item)
    else byHero.set(k, [item])
  }
  return (
    <Modal title="Pet stances" onClose={onClose} testid="dv-petsheet" actions={<Btn onClick={onClose}>Close</Btn>}>
      {[...byHero.entries()].map(([hi, items]) => {
        const h = d?.heroes[hi]
        const pet = h?.record.petInstance
        return (
          <section key={hi} class="dv-sheet__group">
            <h3 class="dv-sheet__title">
              {pet?.name ?? 'Pet'} <small>({h?.record.name}'s, now {pet?.stance ?? '?'})</small>
            </h3>
            <div class="dv-sheet__grid">
              {items.map((item) => {
                const stance = (item.action.command as { stance?: string }).stance ?? ''
                return (
                  <Btn key={item.testid} class="dv-act" testid={item.testid} onClick={() => {
                    delveCommand(item.action.command as DelveCommand)
                    onClose()
                  }}>
                    <span class="dv-act__label">{cap(stance)}</span>
                    <small class="dv-act__why">{STANCE_WORDS[stance] ?? ''}</small>
                  </Btn>
                )
              })}
            </div>
          </section>
        )
      })}
    </Modal>
  )
}

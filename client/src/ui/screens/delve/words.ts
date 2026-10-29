/**
 * The delve screen's words (Phase 4): room kinds, the light bands, the floor clock and the hunter, the end of a
 * delve, the result lines — plain sentences from the sim's state. Pure, tested in Node.
 */
export const KIND_NAMES: Readonly<Record<string, string>> = {
  entry: 'The entrance',
  fight: 'A fight room',
  elite: "A champion's room",
  rest: 'A rest room',
  merchant: "A pedlar's room",
  treasure: 'A treasure room',
  curio: 'A curio',
  trapGauntlet: 'A trapped passage',
  secret: 'A secret room',
  stairs: 'The stairs down',
  boss: "The boss's room",
  keyRoom: 'The key room',
}

/** Short names for the map's legend. */
export const KIND_SHORT: Readonly<Record<string, string>> = {
  entry: 'Entrance',
  fight: 'Fight',
  elite: 'Champion',
  rest: 'Rest',
  merchant: 'Pedlar',
  treasure: 'Treasure',
  curio: 'Curio',
  trapGauntlet: 'Traps',
  secret: 'Secret',
  stairs: 'Stairs',
  boss: 'Boss',
  keyRoom: 'Key',
}

export function kindName(kind: string): string {
  return KIND_NAMES[kind] ?? 'A room'
}

/** `cel-t-wine-vault` → "Wine vault". */
export function templateName(templateId: string): string {
  const words = templateId.replace(/^[a-z]+-t-/, '').split('-').filter(Boolean)
  if (words.length === 0) return 'Room'
  const s = words.join(' ')
  return s[0]!.toUpperCase() + s.slice(1)
}

/** What the room is now, in one line (cleared, used, rested …). */
export function roomLine(kind: string, r: { cleared: boolean; restUsed: boolean; curioUsed: boolean; visited: boolean }, isExit: boolean, lastFloor: boolean): string {
  switch (kind) {
    case 'entry':
      return 'Where the party came in. You can walk out to town from here.'
    case 'fight':
    case 'elite':
    case 'keyRoom':
      return r.cleared ? 'Cleared: nothing here wants a fight now.' : 'Something lives here.'
    case 'rest':
      return r.restUsed ? 'The fire has burned down: the party has rested here.' : 'A cold hearth: rest once to mend 30% of HP and pool (the floor clock moves 5).'
    case 'merchant':
      return 'A pedlar with a cart, selling to anyone with gold.'
    case 'treasure':
      return 'Treasure, if the party can open it.'
    case 'curio':
      return r.curioUsed ? 'The curio has given what it will.' : 'Something here invites a choice.'
    case 'trapGauntlet':
      return 'A passage built to hurt whoever crosses it.'
    case 'secret':
      return 'A hidden room off the beaten way.'
    case 'stairs':
      return lastFloor ? 'The way down; this is the last floor of the zone.' : 'The way down to the next floor. You can also teleport out to town from here.'
    case 'boss':
      return r.cleared ? (isExit ? 'The boss is down. Teleport out, or finish the delve.' : 'The boss is down.') : 'The boss waits here.'
    default:
      return ''
  }
}

/* ---------- the floor clock and the hunter (03 §4.5) ---------- */

export interface ClockWords {
  text: string
  tone: 'plain' | 'warn' | 'bad'
}

/**
 * `clock` ticks, the hunter's entry tick (`enterAt`, null when the floor has none), its state and name. Close means
 * within `near` ticks of its arrival.
 */
export function clockWords(clock: number, enterAt: number | null, hunter: { entered: boolean; killed: boolean } | null, hunterName: string, near = 8): ClockWords {
  if (!hunter || enterAt === null) return { text: `Clock ${clock}`, tone: 'plain' }
  if (hunter.killed) return { text: `Clock ${clock} · ${hunterName} is dead`, tone: 'plain' }
  if (hunter.entered) return { text: `${hunterName} is on this floor`, tone: 'bad' }
  const left = Math.max(0, enterAt - clock)
  if (left <= near) return { text: `${hunterName} is coming (${left})`, tone: 'warn' }
  return { text: `Clock ${clock}/${enterAt}`, tone: 'plain' }
}

/* ---------- the end of a delve ---------- */

export interface OverWords {
  title: string
  line: string
  tone: 'good' | 'bad' | 'plain'
}

export function overWords(outcome: string, atFloorEnd: boolean, floor: number, zoneName: string, mortal = false, endedLeader?: string): OverWords {
  // D-095: under Nightmare the chosen hero's death (or a wipe, which takes them too) ends the save.
  if (endedLeader)
    return {
      title: 'Your Nightmare ends',
      line: `${endedLeader} died on floor ${floor}. Under Nightmare that ends the save: every hero, the gold, the gear and the pets are gone. ${endedLeader}'s name goes into the Hall of Nightmares.`,
      tone: 'bad',
    }
  if (outcome === 'wiped' && mortal)
    return { title: 'The party is lost', line: "Every hero in the party is lost for good. Their gear and pets come home with the Lantern Inn's bearers; the gold carried is lost.", tone: 'bad' }
  switch (outcome) {
    case 'cleared':
      return { title: `${zoneName} cleared`, line: 'The party reached the end of the zone. Everything carried comes home.', tone: 'good' }
    case 'retreated':
      return atFloorEnd
        ? { title: 'Teleported out', line: `The party teleported out from the end of floor ${floor}. Everything carried comes home, and the next delve can start below it.`, tone: 'good' }
        : { title: 'Walked out', line: `The party walked out of floor ${floor}'s entrance. Everything carried comes home.`, tone: 'plain' }
    case 'wiped':
      return { title: 'The party fell', line: 'The party fell. Unbanked gold is lost; everything else is kept.', tone: 'bad' }
    default:
      return { title: 'The delve stopped', line: 'The delve ended here.', tone: 'plain' }
  }
}

/* ---------- result lines (D-082: level-ups stand out) ---------- */

export interface ResultLine {
  text: string
  levelUp: boolean
  /** "X has died. The party carries the body." (Mortal, D-088). */
  death?: boolean
  /** For a level-up: who and to what. */
  hero?: string
  level?: number
  /** The rest of that hero's line without the level bit. */
  rest?: string
  tone: 'good' | 'bad' | 'plain'
}

/**
 * The sim's result lines: "+34 gold", "2 item(s)", "Warden: blade +1 rank, +1 strength, level 3", "Mender stays
 * down", "−5 gold stolen". A hero line with "level N" is a level-up.
 */
export function resultLines(lines: readonly string[]): ResultLine[] {
  return lines.map((text) => {
    const m = /^([^:]+): (.+)$/.exec(text)
    if (m) {
      const bits = m[2]!.split(', ')
      const lv = bits.map((b) => /^level (\d+)$/.exec(b)).find((x) => x)
      if (lv) {
        const rest = bits.filter((b) => !/^level \d+$/.test(b)).join(', ')
        return { text, levelUp: true, hero: m[1]!, level: Number(lv[1]), rest, tone: 'good' }
      }
      return { text, levelUp: false, tone: 'good' }
    }
    if (/ has died. /.test(text)) return { text, levelUp: false, death: true, tone: 'bad' }
    const bad = /^[−-]|stays down|stolen/.test(text)
    return { text, levelUp: false, tone: bad ? 'bad' : /^\+/.test(text) ? 'good' : 'plain' }
  })
}

/* ---------- curio requirements (07 §2.4) ---------- */

export interface RequirementLike {
  kind: string
  id?: string
  min?: number
  amount?: number
}

const FIELD_SKILL_NAMES: Readonly<Record<string, string>> = {
  lockpicking: 'Lockpicking',
  trapDisarm: 'Trap Disarm',
  foraging: 'Foraging',
  cooking: 'Cooking',
  firstAid: 'First Aid',
  haggling: 'Haggling',
  fieldRepair: 'Field Repair',
  scouting: 'Scouting',
}

/**
 * One of an item by name: "a Torch", "an Oilskin Cloak"; a pair, a plural or a stuff takes none ("Wax Plugs",
 * "Flint & Oil", "Loaded Dice", "Holy Water", "Grave Salt").
 */
export function oneItem(name: string): string {
  if (/ & |[^s]s$|(dice|water|salt|oil|grit)$/i.test(name)) return name
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`
}

/** "needs a Torch", "needs Foraging rank 3", "needs Detection 14" — `itemName` turns an id into a name. */
export function requirementWords(r: RequirementLike, itemName: (id: string) => string): string {
  switch (r.kind) {
    case 'item':
      return `needs ${r.amount && r.amount > 1 ? `${r.amount}× ${itemName(r.id ?? '')}` : oneItem(itemName(r.id ?? ''))}`
    case 'fieldSkillRank':
      return `needs ${FIELD_SKILL_NAMES[r.id ?? ''] ?? r.id} rank ${r.min ?? 1}`
    case 'attribute':
      return r.id ? `needs ${r.id[0]!.toUpperCase()}${r.id.slice(1)} ${r.min ?? ''}`.trim() : 'needs an attribute'
    case 'detection':
      return `needs Detection ${r.min ?? ''}`.trim()
    case 'gold':
      return 'needs gold'
    case 'light':
      return `needs light ${r.min ?? ''}`.trim()
    case 'classId':
      return `needs a ${r.id ?? 'class'} in the party`
    case 'speciesId':
      return `needs a ${r.id ?? 'species'} in the party`
    default:
      return `needs ${r.kind}`
  }
}

/* ---------- danger you can read (D-092) ---------- */

export type Band = 'easy' | 'even' | 'dangerous' | 'deadly'

export const THREAT_NAMES: Readonly<Record<Band, string>> = { easy: 'Easy', even: 'Even', dangerous: 'Dangerous', deadly: 'Deadly' }
/** The map's cells are 44 px: a short word, the full one in the legend and the tooltip. */
export const THREAT_SHORT: Readonly<Record<Band, string>> = { easy: 'EASY', even: 'EVEN', dangerous: 'DANGER', deadly: 'DEADLY' }

export interface StairsThreat {
  /** "Floor 2 below: Dangerous", with the boss when the floor has one. */
  text: string
  band: Band
  /** Under Mortal, when what waits below is Dangerous or Deadly. */
  warn: string | null
}

/** What the stairs say about the next floor (D-092), and what dying there means under the save's rule (D-088, D-095: under Nightmare, the leader's name). */
export function stairsThreat(nextFloor: number, floorBand: Band, bossBand: Band | null, mortal: boolean, nightmareLeader?: string): StairsThreat {
  const worst: Band = bossBand && rank(bossBand) > rank(floorBand) ? bossBand : floorBand
  const text = `Floor ${nextFloor} below: ${THREAT_NAMES[floorBand]}${bossBand ? ` · its boss: ${THREAT_NAMES[bossBand]}` : ''}`
  const perilous = mortal && rank(worst) >= rank('dangerous')
  const warn = !perilous ? null : nightmareLeader ? `If ${nightmareLeader} dies there, the save ends.` : 'Heroes who die there stay dead.'
  return { text, band: worst, warn }
}

function rank(b: Band): number {
  return ['easy', 'even', 'dangerous', 'deadly'].indexOf(b)
}

/* ---------- death (D-088) ---------- */

export interface DeathHero {
  name: string
  fallen: boolean
  hasPet: boolean
}

/**
 * Who the end of a delve leaves behind. Under Mortal the dead the party carried home lie at the Ember Shrine; after a
 * wipe every hero is lost for good and the Lantern Inn's bearers bring their gear and pets home. Sheltered loses
 * nobody.
 */
export function deathLines(heroes: readonly DeathHero[], outcome: string, mortal: boolean): { died: string[]; lost: string[] } {
  if (!mortal) return { died: [], lost: [] }
  if (outcome === 'wiped') {
    return {
      died: [],
      lost: heroes.map((h) => (h.hasPet ? `${h.name} is lost for good; their gear and pet come home with the Lantern Inn's bearers` : `${h.name} is lost for good; their gear comes home with the Lantern Inn's bearers`)),
    }
  }
  return { died: heroes.filter((h) => h.fallen).map((h) => `${h.name} lies at the Ember Shrine in Emberfall`), lost: [] }
}

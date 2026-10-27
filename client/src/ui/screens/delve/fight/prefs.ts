import { signal } from '@preact/signals'
import type { FightState } from '../../../../../../sim/src/fight-types.ts'

/**
 * The fight HUD's own small state that outlives one mount: the playback speed (kept in this browser), the Auto
 * toggle (kept for the rest of the delve, until it is switched off) and the finale flag.
 */
export type FightSpeed = 1 | 2 | 3

const SPEED_KEY = 'gloamvault/fight-speed'

function readSpeed(): FightSpeed {
  try {
    const n = Number(globalThis.localStorage?.getItem(SPEED_KEY))
    return n === 2 || n === 3 ? n : 1
  } catch {
    return 1
  }
}

export const fightSpeed = signal<FightSpeed>(readSpeed())

export function setFightSpeed(s: FightSpeed): void {
  fightSpeed.value = s
  try {
    globalThis.localStorage?.setItem(SPEED_KEY, String(s))
  } catch {
    /* private window or blocked storage: the speed lasts this session */
  }
}

/** Auto answers every hero turn with the hero's AI rule until it is switched off (or a new delve starts). */
export const fightAuto = signal(false)

/**
 * True while the HUD plays the last moments of a fight that has just ended (the killing blow, "Victory!"). The sim
 * moves the delve to its result phase at once; a delve screen that keeps `<FightHud />` mounted while this is true
 * lets the player see the end before the result panel. It falls back to false when the playback ends or the HUD
 * unmounts.
 */
export const fightFinale = signal(false)

/** The fight the HUD last showed (the delve drops its reference when the fight ends; the finale still needs it). */
export const held: { fight: FightState | null; delve: object | null } = { fight: null, delve: null }

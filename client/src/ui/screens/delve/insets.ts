import type { TextSize } from '../../../save/settings.ts'
import type { Insets } from '../../../scene/room/fit.ts'

/**
 * What the delve's overlay covers, for the scene to frame the room (or the fight) in the rest (CSS px at the 892 × 412
 * landscape phone; Delve.tsx hands them to RoomStage).
 *
 * The room (Phase 8): the header with its chips ends at 65 px and the party's cards start 67 px from the bottom — the
 * old 44 and 60 let a deep entry room's Waystone stand under the header. Each step of Settings → Text size grows both
 * by 3 px (the header measures 5 px taller at 130%).
 */
export const ROOM_INSETS: Insets = { top: 68, right: 252, bottom: 68, left: 0 }

/** The fight HUD: the party column, the enemies and side commands, the strip and banner on top, the feed and bar below. */
export const FIGHT_INSETS: Insets = { top: 96, right: 256, bottom: 150, left: 208 }

/** 0 at 100% text, 1 at 115%, 2 at 130%. */
function textStep(textSize: TextSize): number {
  return textSize === 'largest' ? 2 : textSize === 'large' ? 1 : 0
}

export function roomInsets(textSize: TextSize): Insets {
  const step = textStep(textSize)
  return { ...ROOM_INSETS, top: ROOM_INSETS.top + 3 * step, bottom: ROOM_INSETS.bottom + 3 * step }
}

/**
 * The fight's insets (Phase 8): grown with the banner and the feed at the larger text sizes (measured: the banner ends
 * 8 px lower at 130%, the feed starts 16 px higher, 12 of them inside the old margin). A boss arena's chips and tells
 * sit in the enemies' column (FightHud.tsx), so the middle keeps its full height for a boss on his throne or dais.
 */
export function fightInsets(textSize: TextSize): Insets {
  const step = textStep(textSize)
  return { ...FIGHT_INSETS, top: FIGHT_INSETS.top + 4 * step, bottom: FIGHT_INSETS.bottom + 2 * step }
}

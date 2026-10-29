/**
 * Where a stat's bubble goes (StatTip): under its stat when the stat sits in the top part of the screen, over it
 * otherwise, centred on it and kept inside a gutter. Pure, tested in node.
 */
export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

export interface Placement {
  side: 'below' | 'above'
  left: number
  width: number
  /** For 'below': the bubble's top edge. */
  top: number
  /** For 'above': the distance from the viewport's bottom to the bubble's bottom edge. */
  bottom: number
}

export const TIP_MAX_WIDTH = 340
export const TIP_GUTTER = 8
const GAP = 6

export function bubblePlacement(owner: Box, viewport: { width: number; height: number }): Placement {
  const width = Math.max(120, Math.min(TIP_MAX_WIDTH, viewport.width - 2 * TIP_GUTTER))
  const centre = (owner.left + owner.right) / 2
  const left = Math.round(Math.min(Math.max(TIP_GUTTER, centre - width / 2), Math.max(TIP_GUTTER, viewport.width - width - TIP_GUTTER)))
  const below = owner.bottom <= viewport.height * 0.55
  return {
    side: below ? 'below' : 'above',
    left,
    width,
    top: Math.round(owner.bottom + GAP),
    bottom: Math.round(viewport.height - owner.top + GAP),
  }
}

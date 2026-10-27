/**
 * Framing the fixed camera around the overlay (Phase 4): the template's camera never moves, but its view is zoomed
 * and shifted (`camera.zoom`, `camera.setViewOffset`) so what matters — the room, or the fight — sits in the part
 * of the screen the UI leaves free. Pure math on normalised device coordinates, tested in Node.
 */
export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

/** The projected extent of the points to frame, in NDC (−1…1, y up) at zoom 1 with no view offset. */
export interface NdcBounds {
  x0: number
  x1: number
  y0: number
  y1: number
}

export interface FitOptions {
  /** Breathing room inside the free region, in NDC units. */
  margin: number
  minZoom: number
  maxZoom: number
}

export interface Fit {
  zoom: number
  /** `setViewOffset(width, height, offsetX, offsetY, width, height)`, in CSS px. */
  offsetX: number
  offsetY: number
}

export function fitView(b: NdcBounds, width: number, height: number, insets: Insets, opts: FitOptions): Fit {
  if (!(width > 0 && height > 0) || !Number.isFinite(b.x0 + b.x1 + b.y0 + b.y1)) return { zoom: 1, offsetX: 0, offsetY: 0 }
  let rx0 = -1 + (2 * insets.left) / width + opts.margin
  let rx1 = 1 - (2 * insets.right) / width - opts.margin
  let ry0 = -1 + (2 * insets.bottom) / height + opts.margin
  let ry1 = 1 - (2 * insets.top) / height - opts.margin
  // A region squeezed to nothing (a tiny window): frame on the whole screen instead.
  if (rx1 - rx0 < 0.2) {
    rx0 = -1 + opts.margin
    rx1 = 1 - opts.margin
  }
  if (ry1 - ry0 < 0.2) {
    ry0 = -1 + opts.margin
    ry1 = 1 - opts.margin
  }
  const bw = Math.max(1e-3, b.x1 - b.x0)
  const bh = Math.max(1e-3, b.y1 - b.y0)
  const zoom = Math.max(opts.minZoom, Math.min(opts.maxZoom, Math.min((rx1 - rx0) / bw, (ry1 - ry0) / bh)))
  const sx = (rx0 + rx1) / 2 - zoom * ((b.x0 + b.x1) / 2)
  const sy = (ry0 + ry1) / 2 - zoom * ((b.y0 + b.y1) / 2)
  // Moving the view window right moves the picture left: a shift of +s in NDC is an offset of −s·w/2 px.
  return { zoom, offsetX: (-sx * width) / 2, offsetY: (sy * height) / 2 }
}

/** Eases one fit toward another (camera moves between the room and the fight). */
export function lerpFit(a: Fit, b: Fit, t: number): Fit {
  const k = Math.max(0, Math.min(1, t))
  return { zoom: a.zoom + (b.zoom - a.zoom) * k, offsetX: a.offsetX + (b.offsetX - a.offsetX) * k, offsetY: a.offsetY + (b.offsetY - a.offsetY) * k }
}

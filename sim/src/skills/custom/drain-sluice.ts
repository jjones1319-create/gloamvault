import type { CustomHandler } from './types.ts'

/**
 * Resolved by delve.ts (`resolveDelveLine`). The Rusted Sluice Wheel turned (07 §2.4): "drains the next flooded room (its
 * wading penalty gone, and 0.10 R in the silt)" — the silt's gold (`amount`, hundredths of R) at once, and
 * `FloorRun.sluiceDrained`: the next Tide Gate (`flood-room`) on this floor floods nothing and spends the flag.
 */
export const DELVE_SIDE = true

const handler: CustomHandler = {}
export default handler

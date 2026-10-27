import type { CustomHandler } from './types.ts'

/** Root and Web (03 §3.5): cannot swap rows or flee. */
const handler: CustomHandler = {
  canSwapRow: () => false,
  canFlee: () => false,
}
export default handler

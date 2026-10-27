import type { CustomHandler } from './types.ts'

/** Fear (03 §3.5): a lost action becomes a Guard. */
const handler: CustomHandler = {
  lostActionBecomesGuard: () => true,
}
export default handler

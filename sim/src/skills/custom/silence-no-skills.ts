import type { CustomHandler } from './types.ts'

/** Silence (03 §3.5): no skills or Ultimate; basic attacks, Guard and items only. */
const handler: CustomHandler = {
  canUseSkills: () => false,
}
export default handler

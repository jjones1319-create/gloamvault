import type { CustomHandler } from './types.ts'

/**
 * Dawn Vigil (Mender passive, Vigil IV; docs/classes/mender.md §4.3): "for ambush rolls the party counts its light band
 * one step brighter" — `amount` bands. Read out of combat by sim/src/delve.ts (`heroAmbushParts`: the best line among
 * the living heroes' loadout passives), which moves the band the ambush roll reads, as a species' darkvision does
 * (`darkvisionShift`; the two add, never past the brightest band). Nothing to do inside a fight; the fight half of Dawn
 * Vigil is `fight-start-momentum-allies`.
 */
const handler: CustomHandler = {}
export default handler

import type tuningJson from '../../content/tuning.json'

/**
 * The shape of content/tuning.json, derived from the file itself so a renamed key is a type error in the sim.
 * The sim never imports the JSON at runtime: the client and the tools load it and pass it in with the content bundle.
 */
export type Tuning = typeof tuningJson

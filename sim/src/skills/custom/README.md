# sim/src/skills/custom — the custom hooks

*One file per `customId` (content/README.md rule 31; 09-SKILLS §6). The effect DSL says the common things; a `custom` line names a hook here for the rest. `types.ts` is the contract; `hooks.ts` (one level up) is the carrier.*

## How a hook runs

- **`apply(ctx, target, scalePercent)`** runs when the line resolves (a skill, a monster attack, an item, a curio, a part break). `ctx.holder` is the caster, `target` each resolved target (null when the line has none), `scalePercent` the rank scaling (100 = rank 1). `ctx.sourceId` is the skill/attack/item id.
- **Rule members** (`afterHit`, `absorb`, `costPercent`, `intercept`, …) are consulted while the line is *active* on an actor — either through a **status** that carries the line (`ctx.status`) or through a **persistent hook** (`ctx.hook`, a `HookInstance`). Passives, champion affixes, pet traits and part breaks are installed as hooks for you (hero.ts, explore.ts, pets.ts, effects.ts); a skill that must outlive its cast installs its own in `apply` with `ctx.fx.installHook(actor, ctx.line, ctx.holder.id, { turnsLeft, untilTurnStart, counter, data })`.
- **State** lives in `ctx.hook.counter` / `ctx.hook.data` (plain numbers, strings, booleans — it is hashed and saved). Never keep state in module variables.
- **Verbs**: everything you may do to the fight is on `ctx.fx` (`strike`, `heal`, `applyStatus`, `attackFor`, `statOf`, `gainMomentum`, `log`, `alliesOf`, `enemiesOf`, `isActive`, `installHook`, `removeHook`). A handler imports only `./types.ts`, `../../stats.ts` helpers (`roundHalfUp`, `clamp`) and `../../types/enums.ts` — never `effects.ts`, `fight.ts` or `statuses.ts` (import cycle).
- **Determinism**: randomness only through `ctx.rng` (`pct`, `pick`, `range`, `weighted`); no `Math.random`, no `Date`.
- **Log** what the player would see with `ctx.fx.log(kind, text, { actorId, targetId, amount })`; the fight log is the HUD's source.
- Hooks fire in actor order; a `strike` from inside `afterHit` runs the whole pipeline again — pass `isMelee: false` on ripostes and thorns so they never answer each other.

## Registering

Add the import and the `[id, handler]` pair to the group file you own (`_group-core.ts`, `_group-martial.ts`, `_group-arcane.ts`, `_group-faith.ts`, `_group-cellars.ts`). `index.ts` merges the groups; `sim/test/custom-registry.test.ts` fails if a file is unregistered, registered twice, or registered under a name that is not its file name.

## Out-of-combat hooks

Curio, trap, secret and consumable lines resolve in `sim/src/delve.ts`, not in a fight. Their handler files still exist (rule 31) and document the contract; the file says `Resolved by delve.ts` and implements nothing a fight would call.

## When the sim has no joint for a line

Implement the nearest reading the hook points allow and say so in the file's doc comment with `Reading:`. If nothing can be done yet, the handler is a documented stub: `export const STUB = true` and an `apply` that logs `hookStub` once — the balance runner counts those, and `docs/13-DECISIONS.md` lists them as open work. Never silently do nothing.

/**
 * One heavy job per frame (Phase 8). A fight's monsters (or a delve's heroes) all finished loading in the same moment
 * and were assembled in one task — four 30 ms assemblies were a 120 ms freeze as the fight began. `takeTurn` queues
 * such jobs: each waits for the one before it to finish and then for the next frame, and holds the turn until it
 * calls `release`. Only the synchronous part should hold a turn (loads stay parallel).
 */
let tail: Promise<void> = Promise.resolve()

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function' && typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
      // A frame, or a timeout if frames have stopped (a backgrounded tab must not hold every model back).
      const timer = setTimeout(resolve, 100)
      requestAnimationFrame(() => {
        clearTimeout(timer)
        resolve()
      })
    } else setTimeout(resolve, 0)
  })
}

export function takeTurn(): Promise<() => void> {
  let release!: () => void
  const mine = new Promise<void>((resolve) => {
    release = resolve
  })
  const before = tail
  tail = before.then(() => mine)
  return before.then(nextFrame).then(() => release)
}

/** Runs a synchronous job on its own turn. */
export async function onItsOwnFrame<T>(job: () => T): Promise<T> {
  const release = await takeTurn()
  try {
    return job()
  } finally {
    release()
  }
}

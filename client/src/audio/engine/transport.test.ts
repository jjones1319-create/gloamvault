import { describe, expect, it } from 'vitest'
import { defineSong } from '../music/song.ts'
import { createGraph } from './context.ts'
import { fakeContext } from './fakeAudio.ts'
import { createRng } from './rng.ts'
import { SampleBank } from './samples.ts'
import { Scheduler } from './scheduler.ts'
import { MusicPlayer } from './transport.ts'
import type { Driver } from './driver.ts'

/** A piece of two 2-bar sections at 120 (2 s a bar) and a 1-bar stinger, for the music player's own tests. */
const area = defineSong({
  id: 'area',
  kind: 'explore',
  brief: 'test',
  musicSend: 0,
  abc: 'X:1\nM:4/4\nL:1/8\nQ:1/4=120\nK:C\nV:lead\n[P:A] C8 | D8 |\n[P:B] E8 | F8 |\n',
  parts: { lead: { inst: 'harp', role: 'lead', layers: ['main'] } },
  perc: { grid: 16, lines: { drum: { inst: 'snare', layers: ['main'], steps: 'X...x...X...x...' } } },
  order: ['A', 'B'],
  loopFrom: 0,
})
const other = defineSong({ id: 'other', kind: 'explore', brief: 'test', musicSend: 0, abc: 'X:1\nM:4/4\nL:1/8\nQ:1/4=120\nK:C\nV:lead\n[P:A] G8 |\n', parts: { lead: { inst: 'harp', role: 'lead', layers: ['main'] } }, order: ['A'], loopFrom: 0 })
const stinger = defineSong({ id: 'sting', kind: 'stinger', brief: 'test', musicSend: 0, abc: 'X:1\nM:4/4\nL:1/8\nQ:1/4=120\nK:C\nV:lead\n[P:A] c8 |\n', parts: { lead: { inst: 'harp', role: 'lead', layers: ['main'] } }, order: ['A'], loopFrom: 0 })

function rig() {
  const ctx = fakeContext()
  let tick: (() => void) | null = null
  const driver: Driver = { now: () => ctx.currentTime, start: (fn) => (tick = fn), stop: () => (tick = null) }
  const scheduler = new Scheduler(driver, 0.4, 0.005)
  const bank = new SampleBank(ctx, '/', () => Promise.reject(new Error('offline')))
  const music = new MusicPlayer(ctx, createGraph(ctx), bank, scheduler, createRng(7))
  scheduler.start()
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.025) {
      ctx.currentTime += 0.025
      tick?.()
    }
  }
  return { ctx, scheduler, music, run }
}

describe('the music player (ported transport)', () => {
  it('plays a piece bar by bar, with its notes and its percussion, through the code-made voices when no samples load', () => {
    const { ctx, scheduler, music, run } = rig()
    music.play(area, { fadeInSec: 0.1 })
    run(3)
    expect(music.state()?.song).toBe('area')
    expect(scheduler.played).toBeGreaterThan(4)
    expect(scheduler.lateEvents).toBe(0)
    // The harp falls back to the plucked voice (a buffer source) and the snare is made from noise and a tone.
    expect(ctx.made.sources).toBeGreaterThan(2)
    expect(ctx.made.oscillators).toBeGreaterThan(0)
  })

  it('a stinger interrupts the area piece and the piece returns at the section after the one it left', () => {
    const { music, run } = rig()
    music.play(area, { fadeInSec: 0.1 })
    run(0.5)
    expect(music.state()?.section).toBe('A')
    music.interruptChain([stinger])
    expect(music.stingerPlaying()).toBe(true)
    expect(music.state()?.song).toBe('sting')
    expect(music.interrupted?.nextIndex).toBe(1)
    run(3)
    expect(music.stingerPlaying()).toBe(false)
    expect(music.state()?.song).toBe('area')
    expect(music.state()?.section).toBe('B')
  })

  it('when the place changed during the stinger, the chain hands over to the new piece instead of resuming', () => {
    const { music, run } = rig()
    music.play(area, { fadeInSec: 0.1 })
    run(0.5)
    let done = false
    music.interruptChain([stinger, stinger], {
      beforeResume: () => false,
      onDone: () => {
        done = true
        music.play(other, { fadeInSec: 0.1 })
      },
    })
    run(2.5)
    expect(music.state()?.song).toBe('sting')
    run(3)
    expect(done).toBe(true)
    expect(music.state()?.song).toBe('other')
    expect(music.interrupted).toBeNull()
  })

  it('layers change at the next bar and stems filter lines', () => {
    const { music, run } = rig()
    const p = music.play(area, { fadeInSec: 0.1, layers: ['main'] })
    run(0.3)
    music.setLayers(['rest'])
    expect([...p.layers]).toEqual(['rest'])
    expect(music.state()?.layers).toEqual(['rest'])
  })
})

/**
 * A stand-in BaseAudioContext for the node tests (test-only: nothing the game runs imports it). Every node connects,
 * every param takes its last value, nothing makes a sound; the clock is `currentTime`, moved by the test. Enough of
 * the Web Audio surface for the graph, the sampler's fallback voices, the reverb, the ambience and the music player.
 */

class Param {
  value: number
  constructor(v = 0) {
    this.value = v
  }
  setValueAtTime(v: number): this {
    this.value = v
    return this
  }
  linearRampToValueAtTime(v: number): this {
    this.value = v
    return this
  }
  exponentialRampToValueAtTime(v: number): this {
    this.value = v
    return this
  }
  setTargetAtTime(v: number): this {
    this.value = v
    return this
  }
  cancelScheduledValues(): this {
    return this
  }
}

function node<T extends object>(extra: T): T & { connect(n: unknown): unknown; disconnect(): void } {
  return { connect: (n: unknown) => n, disconnect: () => undefined, ...extra }
}

function source<T extends object>(extra: T) {
  return node({ start: () => undefined, stop: () => undefined, onended: null as null | (() => void), ...extra })
}

export interface FakeContext {
  currentTime: number
  sampleRate: number
  state: string
  /** Nodes made, for the tests to count. */
  made: { sources: number; oscillators: number }
}

export function fakeContext(sampleRate = 8000): BaseAudioContext & FakeContext {
  const made = { sources: 0, oscillators: 0 }
  const ctx = {
    currentTime: 0,
    sampleRate,
    state: 'running',
    made,
    destination: node({}),
    createGain: () => node({ gain: new Param(1) }),
    createBiquadFilter: () => node({ type: 'lowpass', frequency: new Param(350), Q: new Param(1), gain: new Param(0) }),
    createDynamicsCompressor: () => node({ threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param(), reduction: 0 }),
    createChannelSplitter: () => node({}),
    createChannelMerger: () => node({}),
    createConvolver: () => node({ buffer: null as unknown, normalize: true }),
    createStereoPanner: () => node({ pan: new Param() }),
    createAnalyser: () => node({ fftSize: 2048, smoothingTimeConstant: 0, getFloatTimeDomainData: () => undefined }),
    createBuffer: (channels: number, length: number, rate: number) => {
      const data = Array.from({ length: channels }, () => new Float32Array(length))
      return { numberOfChannels: channels, length, sampleRate: rate, duration: length / rate, getChannelData: (c: number) => data[c]! }
    },
    createBufferSource: () => {
      made.sources++
      return source({ buffer: null as unknown, loop: false, loopStart: 0, loopEnd: 0, playbackRate: new Param(1), detune: new Param(0) })
    },
    createOscillator: () => {
      made.oscillators++
      return source({ type: 'sine', frequency: new Param(440), detune: new Param(0), setPeriodicWave: () => undefined })
    },
    createPeriodicWave: () => ({}),
    decodeAudioData: () => Promise.reject(new Error('no decoding in a fake context')),
    resume: () => Promise.resolve(),
    suspend: () => Promise.resolve(),
  }
  return ctx as unknown as BaseAudioContext & FakeContext
}

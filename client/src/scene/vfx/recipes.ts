/**
 * The fight's effects as recipes (Phase 6; 11 §6 as built: generated in code, no texture files): each effect is a
 * handful of additive sprites from one generated atlas — hit sparks by Slash / Pierce / Blunt, a mark per element
 * (Fire, Frost, Lightning, Poison, Holy, Shadow), a heal glow, a status ring on the floor for a buff or a debuff, a
 * death puff, and each class's Ultimate flourish (a burst in the class colour with its school's shape). Pure: `emit`
 * turns an effect into particles with a seeded roll, so the shapes and counts are tested in node; `vfx/layer.ts` draws
 * every live particle in one draw call.
 */

/** The atlas cells (vfx/atlas.ts draws them, 4 × 4 cells of 64 px). */
export const SPRITE = {
  glow: 0,
  spark: 1,
  ring: 2,
  star: 3,
  burst: 4,
  flame: 5,
  smoke: 6,
  crescent: 7,
  snowflake: 8,
  bolt: 9,
  bubble: 10,
  glint: 11,
  hexagon: 12,
  rune: 13,
  drop: 14,
  shard: 15,
} as const
export type SpriteName = keyof typeof SPRITE

export const FX_KINDS = ['slash', 'pierce', 'blunt', 'fire', 'frost', 'lightning', 'poison', 'holy', 'shadow', 'bleed', 'heal', 'buff', 'debuff', 'death', 'ultimate'] as const
export type FxKind = (typeof FX_KINDS)[number]

export function isFxKind(s: string | undefined): s is FxKind {
  return s !== undefined && (FX_KINDS as readonly string[]).includes(s)
}

/** One sprite of an effect. Positions in metres from the actor's feet (y up); times in seconds. */
export interface Particle {
  cell: number
  color: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  /** Downward acceleration (m/s²); negative rises. */
  gravity: number
  /** Velocity lost per second (0–1 of it). */
  drag: number
  life: number
  delay: number
  size0: number
  size1: number
  alpha0: number
  alpha1: number
  rot: number
  spin: number
  /** Lies flat on the floor instead of facing the camera. */
  flat: boolean
}

export interface EmitOptions {
  /** The actor's height (metres): the effect sits at its chest and grows with it. */
  height: number
  color?: number
  /** The Ultimate's shape (an atlas sprite). */
  shape?: SpriteName
  crit?: boolean
}

/** No effect has more particles than this (a fight with six targets stays within the layer's pool). */
export const MAX_PER_EFFECT = 24

type Roll = () => number

function p(base: Partial<Particle> & Pick<Particle, 'cell' | 'color' | 'life'>): Particle {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, gravity: 0, drag: 0, delay: 0, size0: 0.3, size1: 0.3, alpha0: 1, alpha1: 0, rot: 0, spin: 0, flat: false, ...base }
}

/** A point on a sphere of radius r (a roll in each direction). */
function around(rnd: Roll, r: number): [number, number, number] {
  const a = rnd() * Math.PI * 2
  const u = rnd() * 2 - 1
  const s = Math.sqrt(1 - u * u)
  return [Math.cos(a) * s * r, u * r, Math.sin(a) * s * r]
}

function sparks(rnd: Roll, n: number, at: number, speed: number, color: number, size: number, gravity = 5): Particle[] {
  const out: Particle[] = []
  for (let i = 0; i < n; i++) {
    const [vx, vy, vz] = around(rnd, speed * (0.6 + rnd() * 0.6))
    out.push(p({ cell: SPRITE.spark, color, y: at, vx, vy: vy + speed * 0.3, vz, gravity, drag: 2.2, life: 0.28 + rnd() * 0.16, size0: size, size1: size * 0.4, rot: Math.atan2(vy, vx), spin: 0 }))
  }
  return out
}

/** The particles of one effect (relative to the actor's feet), at most MAX_PER_EFFECT. */
export function emit(kind: FxKind, o: EmitOptions, rnd: Roll): Particle[] {
  const h = Math.max(0.4, o.height)
  const k = Math.max(0.6, Math.min(2.2, h / 1.8)) * (o.crit ? 1.35 : 1)
  const chest = h * 0.58
  const out: Particle[] = []
  switch (kind) {
    case 'slash': {
      out.push(p({ cell: SPRITE.crescent, color: o.color ?? 0xfff2c8, y: chest, life: 0.26, size0: 0.8 * k, size1: 1.15 * k, rot: -0.6 + rnd() * 1.2, spin: 2.4 }))
      out.push(...sparks(rnd, o.crit ? 9 : 6, chest, 3.2 * k, 0xffd27a, 0.16 * k))
      break
    }
    case 'pierce': {
      out.push(p({ cell: SPRITE.spark, color: o.color ?? 0xffffff, y: chest, life: 0.18, size0: 0.95 * k, size1: 0.35 * k, rot: rnd() * 0.5 - 0.25 }))
      out.push(p({ cell: SPRITE.star, color: 0xfff0c0, y: chest, life: 0.24, size0: 0.5 * k, size1: 0.12 * k, rot: rnd() * Math.PI }))
      out.push(...sparks(rnd, o.crit ? 7 : 4, chest, 2.4 * k, 0xffe6a0, 0.12 * k))
      break
    }
    case 'blunt': {
      out.push(p({ cell: SPRITE.burst, color: o.color ?? 0xffe0a0, y: chest, life: 0.28, size0: 0.45 * k, size1: 1.2 * k, rot: rnd() * Math.PI }))
      out.push(p({ cell: SPRITE.ring, color: 0xfff4d0, y: chest, life: 0.34, size0: 0.3 * k, size1: 1.4 * k, alpha0: 0.8 }))
      out.push(...sparks(rnd, o.crit ? 8 : 5, chest, 2.6 * k, 0xffc870, 0.18 * k, 7))
      break
    }
    case 'bleed': {
      out.push(p({ cell: SPRITE.crescent, color: 0xff3a3a, y: chest, life: 0.3, size0: 0.6 * k, size1: 0.9 * k, rot: rnd() * Math.PI }))
      for (let i = 0; i < 5; i++) out.push(p({ cell: SPRITE.drop, color: 0xd8343a, x: (rnd() - 0.5) * 0.4 * k, y: chest, vx: (rnd() - 0.5) * 1.2, vy: 0.8 + rnd(), gravity: 7, life: 0.5, size0: 0.16 * k, size1: 0.1 * k, alpha0: 0.9 }))
      break
    }
    case 'fire': {
      out.push(p({ cell: SPRITE.glow, color: 0xff5a1a, y: chest, life: 0.42, size0: 0.9 * k, size1: 1.4 * k, alpha0: 0.8 }))
      for (let i = 0; i < 7; i++) {
        const [x, , z] = around(rnd, 0.32 * k)
        out.push(p({ cell: SPRITE.flame, color: i % 2 ? 0xff8a3d : 0xffc04a, x, y: chest - 0.25 * k + rnd() * 0.2, z, vy: 1.3 * k, drag: 0.5, life: 0.5 + rnd() * 0.2, delay: i * 0.03, size0: 0.42 * k, size1: 0.12 * k, rot: (rnd() - 0.5) * 0.3 }))
      }
      for (let i = 0; i < 4; i++) out.push(p({ cell: SPRITE.glow, color: 0xffb050, x: (rnd() - 0.5) * 0.6, y: chest, vx: (rnd() - 0.5) * 0.8, vy: 1.6 + rnd(), life: 0.7, delay: 0.1, size0: 0.09, size1: 0.04 }))
      break
    }
    case 'frost': {
      out.push(p({ cell: SPRITE.burst, color: 0x8fe3ff, y: chest, life: 0.3, size0: 0.5 * k, size1: 1.05 * k, rot: rnd() * Math.PI }))
      for (let i = 0; i < 5; i++) {
        const [vx, vy, vz] = around(rnd, 0.9 * k)
        out.push(p({ cell: SPRITE.snowflake, color: 0xcff6ff, y: chest, vx, vy, vz, drag: 1.5, life: 0.7, size0: 0.3 * k, size1: 0.14 * k, rot: rnd() * Math.PI, spin: 2 }))
      }
      for (let i = 0; i < 4; i++) {
        const [vx, vy, vz] = around(rnd, 2 * k)
        out.push(p({ cell: SPRITE.shard, color: 0xe6fbff, y: chest, vx, vy, vz, drag: 3, life: 0.4, size0: 0.22 * k, size1: 0.08 * k, rot: Math.atan2(vy, vx) }))
      }
      break
    }
    case 'lightning': {
      out.push(p({ cell: SPRITE.glow, color: 0xfff6b0, y: chest, life: 0.2, size0: 1.2 * k, size1: 0.8 * k }))
      out.push(p({ cell: SPRITE.bolt, color: 0xfff07a, y: chest + 0.2 * k, life: 0.16, size0: 1.2 * k, size1: 1.1 * k, rot: (rnd() - 0.5) * 0.4 }))
      out.push(p({ cell: SPRITE.bolt, color: 0xffffff, y: chest + 0.1 * k, life: 0.14, delay: 0.09, size0: 1 * k, size1: 0.9 * k, rot: (rnd() - 0.5) * 0.6 + Math.PI }))
      out.push(...sparks(rnd, 6, chest, 4 * k, 0xffffaa, 0.12 * k, 2))
      break
    }
    case 'poison': {
      out.push(p({ cell: SPRITE.glow, color: 0x5ad04a, y: chest, life: 0.5, size0: 0.8 * k, size1: 1.1 * k, alpha0: 0.7 }))
      for (let i = 0; i < 7; i++) {
        const [x, , z] = around(rnd, 0.3 * k)
        out.push(p({ cell: SPRITE.bubble, color: 0x8dff6a, x, y: chest - 0.2 * k, z, vy: 0.55 + rnd() * 0.4, life: 0.75, delay: i * 0.05, size0: 0.1 * k, size1: 0.2 * k, alpha0: 0.95 }))
      }
      for (let i = 0; i < 2; i++) out.push(p({ cell: SPRITE.drop, color: 0x6ad84a, x: (rnd() - 0.5) * 0.3, y: chest, vy: 0.4, gravity: 6, life: 0.5, size0: 0.14 * k, size1: 0.1 * k }))
      break
    }
    case 'holy': {
      out.push(p({ cell: SPRITE.burst, color: 0xfff4d0, y: chest, life: 0.34, size0: 0.7 * k, size1: 1.5 * k, rot: rnd() * Math.PI }))
      out.push(p({ cell: SPRITE.glint, color: o.color ?? 0xffe9a8, y: chest + 0.1 * k, life: 0.55, size0: 0.55 * k, size1: 0.85 * k }))
      for (let i = 0; i < 6; i++) {
        const [x, y, z] = around(rnd, 0.6 * k)
        out.push(p({ cell: SPRITE.star, color: 0xfff0b0, x, y: chest + y, z, vy: 0.4, life: 0.5, delay: rnd() * 0.15, size0: 0.18 * k, size1: 0.04, rot: rnd() * Math.PI, spin: 3 }))
      }
      break
    }
    case 'shadow': {
      out.push(p({ cell: SPRITE.glow, color: 0x6a3aa8, y: chest, life: 0.5, size0: 1.0 * k, size1: 0.5 * k, alpha0: 0.9 }))
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const r = 0.7 * k
        out.push(p({ cell: SPRITE.smoke, color: 0xb98cff, x: Math.cos(a) * r, y: chest + (rnd() - 0.5) * 0.4, z: Math.sin(a) * r, vx: -Math.cos(a) * 1.3 * k, vz: -Math.sin(a) * 1.3 * k, drag: 1.2, life: 0.5, size0: 0.4 * k, size1: 0.14 * k, alpha0: 0.85, rot: a, spin: 2 }))
      }
      out.push(p({ cell: SPRITE.star, color: 0xd8b0ff, y: chest, life: 0.3, delay: 0.25, size0: 0.2 * k, size1: 0.6 * k }))
      break
    }
    case 'heal': {
      out.push(p({ cell: SPRITE.glow, color: o.color ?? 0x4ad06a, y: chest, life: 0.55, size0: 1.0 * k, size1: 1.3 * k, alpha0: 0.75 }))
      for (let i = 0; i < 6; i++) {
        const [x, , z] = around(rnd, 0.42 * k)
        out.push(p({ cell: SPRITE.glint, color: 0x7aff9a, x, y: chest - 0.3 * k + rnd() * 0.3, z, vy: 0.75 + rnd() * 0.3, life: 0.8, delay: i * 0.06, size0: 0.2 * k, size1: 0.1 * k }))
      }
      out.push(p({ cell: SPRITE.ring, color: 0x6aff8a, y: 0.04, life: 0.6, size0: 0.5 * k, size1: 1.5 * k, alpha0: 0.8, flat: true }))
      break
    }
    case 'buff':
    case 'debuff': {
      const color = o.color ?? (kind === 'buff' ? 0xffd36b : 0xb070ff)
      const grow = kind === 'buff'
      out.push(p({ cell: SPRITE.rune, color, y: 0.05, life: 0.75, size0: (grow ? 0.8 : 1.7) * k, size1: (grow ? 1.7 : 0.8) * k, alpha0: 0.95, spin: grow ? 1.6 : -1.6, flat: true }))
      out.push(p({ cell: SPRITE.ring, color, y: 0.04, life: 0.6, delay: 0.08, size0: 1.2 * k, size1: 1.9 * k, alpha0: 0.6, flat: true }))
      for (let i = 0; i < 3; i++) {
        const a = rnd() * Math.PI * 2
        out.push(p({ cell: grow ? SPRITE.star : SPRITE.drop, color, x: Math.cos(a) * 0.4 * k, y: grow ? 0.2 : h * 0.9, z: Math.sin(a) * 0.4 * k, vy: grow ? 1.1 : -0.9, life: 0.6, delay: 0.05 * i, size0: 0.16 * k, size1: 0.06 * k }))
      }
      break
    }
    case 'death': {
      for (let i = 0; i < 8; i++) {
        const [x, y, z] = around(rnd, 0.35 * k)
        out.push(p({ cell: SPRITE.smoke, color: 0x8a8078, x, y: 0.3 * k + Math.abs(y), z, vx: x * 0.8, vy: 0.45 + rnd() * 0.3, vz: z * 0.8, drag: 1, life: 0.9 + rnd() * 0.3, delay: rnd() * 0.12, size0: 0.45 * k, size1: 1.25 * k, alpha0: 0.55, rot: rnd() * Math.PI, spin: (rnd() - 0.5) * 1.5 }))
      }
      out.push(p({ cell: SPRITE.glow, color: 0x5a524c, y: 0.4 * k, life: 0.6, size0: 1.2 * k, size1: 1.8 * k, alpha0: 0.4 }))
      break
    }
    case 'ultimate': {
      const color = o.color ?? 0xffe08a
      const shape = SPRITE[o.shape ?? 'burst']
      out.push(p({ cell: SPRITE.glow, color, y: chest, life: 0.6, size0: 1.6 * k, size1: 2.6 * k, alpha0: 0.9 }))
      out.push(p({ cell: shape, color, y: chest, life: 0.8, size0: 0.5 * k, size1: 2.8 * k, alpha0: 1, spin: 0.8 }))
      out.push(p({ cell: shape, color: 0xffffff, y: chest, life: 0.5, delay: 0.1, size0: 0.3 * k, size1: 1.6 * k, alpha0: 0.7, spin: -1.2 }))
      out.push(p({ cell: SPRITE.ring, color, y: 0.05, life: 0.8, size0: 1 * k, size1: 4.2 * k, alpha0: 0.9, flat: true }))
      out.push(p({ cell: SPRITE.rune, color, y: 0.04, life: 0.9, size0: 2.2 * k, size1: 2.6 * k, alpha0: 0.7, spin: 1, flat: true }))
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        out.push(p({ cell: SPRITE.spark, color, y: chest, vx: Math.cos(a) * 4 * k, vy: Math.sin(a) * 4 * k, drag: 2.5, life: 0.5, delay: 0.05, size0: 0.4 * k, size1: 0.1 * k, rot: a }))
      }
      break
    }
  }
  return out.slice(0, MAX_PER_EFFECT)
}

/* ---------- Ultimates: the class colour and the school's shape ---------- */

export const CLASS_FX_COLOUR: Readonly<Record<string, number>> = {
  warden: 0x6aa6ff,
  blade: 0xff3a46,
  ranger: 0x8ae05a,
  shade: 0xb26aff,
  arcanist: 0xff8a2a,
  mender: 0xffdc6a,
  'beast-tamer': 0xd8a04a,
}

export const SCHOOL_SHAPE: Readonly<Record<string, SpriteName>> = {
  bulwark: 'hexagon',
  vanguard: 'shard',
  warcry: 'ring',
  'iron-dance': 'crescent',
  executioner: 'shard',
  bloodletter: 'crescent',
  marksman: 'star',
  trapper: 'rune',
  pathfinder: 'star',
  shadow: 'burst',
  venom: 'drop',
  larceny: 'star',
  evocation: 'burst',
  rime: 'snowflake',
  arcana: 'rune',
  benediction: 'glint',
  sanctity: 'glint',
  vigil: 'ring',
}

/** A damage type's effect: the physical three their sparks, the six elements their marks. */
export function fxForDamage(type: string | null | undefined): FxKind {
  switch (type) {
    case 'slash':
    case 'pierce':
    case 'blunt':
    case 'fire':
    case 'frost':
    case 'lightning':
    case 'poison':
    case 'holy':
    case 'shadow':
      return type
    default:
      return 'blunt'
  }
}

/** A status's colour for its ring (and the damage-over-time marks: Burn is fire, Bleed blood …). */
export const STATUS_FX: Readonly<Record<string, { fx: FxKind; color: number }>> = {
  burn: { fx: 'fire', color: 0xff7a2a },
  poison: { fx: 'poison', color: 0x7bd36a },
  bleed: { fx: 'bleed', color: 0xd8343a },
  shock: { fx: 'lightning', color: 0xfff06a },
  chill: { fx: 'frost', color: 0x7fc8ff },
  freeze: { fx: 'frost', color: 0x9fe0ff },
  wither: { fx: 'shadow', color: 0x9a6ad8 },
  smite: { fx: 'holy', color: 0xffe9a8 },
  curse: { fx: 'shadow', color: 0xb070ff },
}

/* ---------- a room's motes: what drifts from its `fx_*` points ---------- */

/** One mote recipe: how often a point gives one (seconds, a range) and the particle (relative to the point). */
export interface MoteRecipe {
  every: readonly [number, number]
  particle: (roll: Roll) => Particle
}

/**
 * The kits' fx kinds (motes, embers, drip, splash, flow, bubbles, glint, fog, mist, vent / smoke, glow), each a slow
 * trickle of one sprite at a time; an unknown kind is dust.
 */
export function moteFor(kind: string): MoteRecipe {
  switch (kind) {
    case 'drip':
      return { every: [0.9, 2.3], particle: (r) => p({ cell: SPRITE.drop, color: 0x9fc8d8, x: (r() - 0.5) * 0.2, z: (r() - 0.5) * 0.2, gravity: 9, life: 0.6, size0: 0.06, size1: 0.05, alpha0: 0.7, alpha1: 0.4 }) }
    case 'flow':
      return { every: [0.3, 0.6], particle: (r) => p({ cell: SPRITE.drop, color: 0xa8d8e8, x: (r() - 0.5) * 0.6, z: (r() - 0.5) * 0.3, vx: 0.5 + r() * 0.3, vy: 0.2, gravity: 2, life: 0.8, size0: 0.05, size1: 0.04, alpha0: 0.6, alpha1: 0 }) }
    case 'splash':
      return { every: [0.5, 1.1], particle: (r) => p({ cell: SPRITE.drop, color: 0xcfeaf2, x: (r() - 0.5) * 0.4, vx: (r() - 0.5) * 1.2, vy: 1 + r() * 0.8, vz: (r() - 0.5) * 1.2, gravity: 7, life: 0.7, size0: 0.07, size1: 0.05, alpha0: 0.8, alpha1: 0.2 }) }
    case 'bubbles':
      return { every: [0.4, 0.9], particle: (r) => p({ cell: SPRITE.bubble, color: 0x8ae0d8, x: (r() - 0.5) * 0.4, z: (r() - 0.5) * 0.4, vy: 0.35 + r() * 0.2, life: 1.4, size0: 0.05, size1: 0.1, alpha0: 0.8, alpha1: 0 }) }
    case 'glint':
      return { every: [0.5, 1.4], particle: (r) => p({ cell: SPRITE.star, color: 0xd8fbff, x: (r() - 0.5) * 1.6, y: 0.02, z: (r() - 0.5) * 1.6, life: 0.45, size0: 0.18, size1: 0.02, alpha0: 0.9, alpha1: 0, rot: r() * Math.PI }) }
    case 'fog':
    case 'mist':
      return { every: [1.2, 2.2], particle: (r) => p({ cell: SPRITE.smoke, color: 0x9ab8bc, x: (r() - 0.5) * 1.4, y: 0.2, z: (r() - 0.5) * 1.4, vx: (r() - 0.5) * 0.12, vz: (r() - 0.5) * 0.12, life: 4, size0: 1.3, size1: 2.1, alpha0: 0.12, alpha1: 0, rot: r() * Math.PI, spin: (r() - 0.5) * 0.2 }) }
    case 'vent':
    case 'smoke':
      return { every: [0.6, 1.1], particle: (r) => p({ cell: SPRITE.smoke, color: 0x8fb8a0, x: (r() - 0.5) * 0.4, z: (r() - 0.5) * 0.4, vy: 0.45 + r() * 0.2, life: 2.2, size0: 0.4, size1: 1.1, alpha0: 0.25, alpha1: 0, rot: r() * Math.PI, spin: (r() - 0.5) * 0.6 }) }
    case 'embers':
      return { every: [0.25, 0.5], particle: (r) => p({ cell: SPRITE.glow, color: 0xffa040, x: (r() - 0.5) * 0.4, z: (r() - 0.5) * 0.4, vx: (r() - 0.5) * 0.2, vy: 0.8 + r() * 0.4, vz: (r() - 0.5) * 0.2, life: 1.4, size0: 0.07, size1: 0.03, alpha0: 0.9, alpha1: 0 }) }
    case 'glow':
      return { every: [1.6, 1.8], particle: () => p({ cell: SPRITE.glow, color: 0x9fe8f0, life: 1.9, size0: 0.55, size1: 0.75, alpha0: 0.35, alpha1: 0 }) }
    default:
      return { every: [0.45, 1.05], particle: (r) => p({ cell: SPRITE.glow, color: 0xffe6b0, x: (r() - 0.5) * 1.6, y: (r() - 0.5) * 1.2, z: (r() - 0.5) * 1.6, vx: (r() - 0.5) * 0.12, vy: 0.05 + r() * 0.08, vz: (r() - 0.5) * 0.12, life: 3 + r() * 2, size0: 0.05, size1: 0.04, alpha0: 0.5, alpha1: 0 }) }
  }
}

/**
 * `node tools/blender/inspect-glb.ts <file.glb> [...]` — what a .glb holds, read the way the client will read it:
 * nodes (sockets), skins (joint count), meshes (vertices, attributes, morph targets, extras), animations, and the
 * COLOR_0 palette codes decoded (slot = round(R × 15), region = round(G × 15)) with a count per slot and region, so a
 * colour-space conversion in the exporter shows up as codes that are not whole numbers.
 */
import { readFileSync } from 'node:fs'

interface Accessor { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean }
interface Gltf {
  nodes?: { name?: string; mesh?: number; skin?: number; children?: number[]; extras?: unknown }[]
  meshes?: { name?: string; primitives: { attributes: Record<string, number>; targets?: Record<string, number>[]; indices?: number }[]; extras?: { targetNames?: string[] } }[]
  skins?: { joints: number[]; name?: string }[]
  animations?: { name?: string; channels: unknown[] }[]
  accessors: Accessor[]
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[]
}

const SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }

function read(file: string): { json: Gltf; bin: Buffer } {
  const buf = readFileSync(file)
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file} is not a GLB`)
  const jsonLen = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as Gltf
  const binStart = 20 + jsonLen + 8
  const binLen = buf.readUInt32LE(20 + jsonLen)
  return { json, bin: buf.subarray(binStart, binStart + binLen) }
}

function values(g: Gltf, bin: Buffer, index: number): number[][] {
  const acc = g.accessors[index]!
  const view = g.bufferViews[acc.bufferView]!
  const n = SIZE[acc.type]!
  const bytes = acc.componentType === 5126 ? 4 : acc.componentType === 5123 || acc.componentType === 5122 ? 2 : 1
  const stride = view.byteStride ?? n * bytes
  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const out: number[][] = []
  for (let i = 0; i < acc.count; i++) {
    const row: number[] = []
    for (let c = 0; c < n; c++) {
      const o = base + i * stride + c * bytes
      let v: number
      if (acc.componentType === 5126) v = bin.readFloatLE(o)
      else if (acc.componentType === 5123) v = bin.readUInt16LE(o) / (acc.normalized ? 65535 : 1)
      else if (acc.componentType === 5121) v = bin.readUInt8(o) / (acc.normalized ? 255 : 1)
      else v = NaN
      row.push(v)
    }
    out.push(row)
  }
  return out
}

for (const file of process.argv.slice(2)) {
  const { json: g, bin } = read(file)
  console.log(`\n== ${file}`)
  const names = (g.nodes ?? []).map((n) => n.name ?? '?')
  console.log(`nodes ${names.length}; sockets: ${names.filter((n) => n.startsWith('Socket_')).join(', ') || 'none'}`)
  for (const s of g.skins ?? []) console.log(`skin ${s.name ?? ''}: ${s.joints.length} joints`)
  for (const m of g.meshes ?? []) {
    for (const [pi, p] of m.primitives.entries()) {
      const attrs = Object.keys(p.attributes)
      const pos = g.accessors[p.attributes.POSITION!]!
      const tris = p.indices !== undefined ? g.accessors[p.indices]!.count / 3 : pos.count / 3
      console.log(`mesh ${m.name} [${pi}]: ${pos.count} verts, ${tris} tris, attributes ${attrs.join(' ')}, morph targets ${p.targets?.length ?? 0}${m.extras?.targetNames ? ` (${m.extras.targetNames.join(', ')})` : ''}`)
      if (p.attributes.COLOR_0 !== undefined) {
        const acc = g.accessors[p.attributes.COLOR_0]!
        const rows = values(g, bin, p.attributes.COLOR_0)
        let worst = 0
        const slots = new Map<number, number>()
        const regions = new Map<number, number>()
        for (const r of rows) {
          const s = r[0]! * 15
          const q = r[1]! * 15
          worst = Math.max(worst, Math.abs(s - Math.round(s)), Math.abs(q - Math.round(q)))
          slots.set(Math.round(s), (slots.get(Math.round(s)) ?? 0) + 1)
          regions.set(Math.round(q), (regions.get(Math.round(q)) ?? 0) + 1)
        }
        console.log(`  COLOR_0 ${acc.type} componentType ${acc.componentType}${acc.normalized ? ' normalized' : ''}; worst distance from a whole code ${worst.toFixed(4)}`)
        console.log(`  slots ${[...slots].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' ')}`)
        console.log(`  regions ${[...regions].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' ')}`)
      }
    }
  }
  for (const a of g.animations ?? []) console.log(`animation ${a.name}: ${a.channels.length} channels`)
}

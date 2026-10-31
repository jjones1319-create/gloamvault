/**
 * The rooms' data for the Unity app (Phase 11, D-158), run by `npm run unity:bundle` → unity/Assets/Gloamvault/Resources/Env/
 * (generated, git-ignored; the kit FBX files beside them come from the Blender builds):
 *
 * - `templates.json` — every room template under content/dungeons/*\/templates/ as `{templates:[…]}`.
 * - `<zone>.json` — the four kit manifests (client/public/models/env/<zone>.json) reshaped: dictionaries become arrays,
 *   each flame carries its colour, each zone its look (the web's ZONE_LOOK, client/src/scene/env/envData.ts).
 *
 * Unity reads both with JsonUtility, which has no dictionaries and no free-form values, so everything here is a fixed
 * shape of arrays, numbers, strings and booleans (unity/…/Runtime/Env/EnvData.cs mirrors it field for field).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = path.resolve('unity/Assets/Gloamvault/Resources/Env')
const ZONES = ['shared', 'cellars', 'crypts', 'vault'] as const
type Zone = (typeof ZONES)[number]

/** The web's ZONE_LOOK (client/src/scene/env/envData.ts): fog and background, hemisphere sky and ground, the fog's zone factor. */
const LOOK: Record<Zone, { fog: string; sky: string; ground: string; fogScale: number }> = {
  shared: { fog: '#17110e', sky: '#8a786a', ground: '#1e1612', fogScale: 1 },
  cellars: { fog: '#17110e', sky: '#8a786a', ground: '#1e1612', fogScale: 1 },
  crypts: { fog: '#111917', sky: '#93a29c', ground: '#1a201e', fogScale: 1.15 },
  vault: { fog: '#08161b', sky: '#7398a4', ground: '#0c1a20', fogScale: 1.45 },
}

/** The web's flameColourFor (envData.ts): corpse-candles cold green, cult lamps blue, anemones cyan, the Waystone pale, else the warm torch. */
function flameColour(meshId: string, zone: Zone): string {
  const id = meshId.toLowerCase()
  if (/candle/.test(id)) return '#8fe3a1'
  if (/anemone/.test(id)) return '#58d3e0'
  if (/waystone/.test(id)) return '#7fd4ff'
  if (/lamp/.test(id)) return zone === 'vault' ? '#6fb8ff' : '#e8a33c'
  return '#ffa040'
}

/** The web's kitZoneOf (envData.ts): a template's kit by its zone id, else its id's prefix. */
function kitOf(zoneId: string, templateId: string): Zone {
  const z = zoneId.toLowerCase()
  if (/vault|drown/.test(z)) return 'vault'
  if (/crypt/.test(z)) return 'crypts'
  if (/cellar/.test(z)) return 'cellars'
  const t = templateId.toLowerCase()
  if (/^vlt[-_]/.test(t)) return 'vault'
  if (/^cry[-_]/.test(t)) return 'crypts'
  return 'cellars'
}

type Weighted = [string, number]
const weighted = (xs: Weighted[] | undefined) => (xs ?? []).map(([id, weight]) => ({ id, weight }))
const vec = (v: number[] | undefined) => (v ?? [0, 0, 0]).slice(0, 3)
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, any>

function manifest(zone: Zone) {
  const m = readJson(path.resolve(`client/public/models/env/${zone}.json`))
  const shell = m['shell'] ?? {}
  const pieces = Object.entries(m['pieces'] as Record<string, any>).map(([id, p]) => ({
    id,
    tris: p.tris ?? 0,
    role: p.role ?? '',
    bounds: { min: vec(p.bounds?.min), max: vec(p.bounds?.max) },
    parts: ((p.parts ?? []) as any[]).map((q) => ({ name: q.name, part: q.part, pivot: vec(q.pivot), axis: q.axis ?? 'y' })),
    lights: ((p.lights ?? []) as any[]).map((l) => ({ name: l.name, kind: l.kind, at: vec(l.at), color: flameColour(id, zone) })),
    fx: ((p.fx ?? []) as any[]).map((f) => ({ name: f.name, kind: f.kind, at: vec(f.at) })),
    mount: p.mount ?? '',
    water: p.water === true,
    /** 1 = opaque; mist 0.22, webs 0.5. */
    translucent: typeof p.translucent === 'number' ? p.translucent : 1,
    doubleSided: p.doubleSided === true,
    hasHole: Array.isArray(p.hole),
    hole: Array.isArray(p.hole) ? p.hole.slice(0, 4) : [0, 0, 0, 0],
    extra: p.extra === true,
  }))
  const dict = (o: Record<string, any> | undefined) => Object.entries(o ?? {})
  return {
    zone,
    palette: (m['palette'] as string[]) ?? [],
    look: LOOK[zone],
    shell: {
      floor: shell.floor ?? '',
      wall: shell.wall ?? '',
      doorway: shell.doorway ?? '',
      corner: shell.corner ?? '',
      wallCut: shell.wallCut ?? '',
      doorwayCut: shell.doorwayCut ?? '',
      cornerCut: shell.cornerCut ?? '',
      floorDirt: shell.floorDirt ?? '',
      floorAlt: weighted(shell.floorAlt),
      wallAlt: weighted(shell.wallAlt),
      floorWhole: (shell.floorWhole ?? []) as string[],
      doorways: dict(shell.doorways).map(([kind, id]) => ({ kind, id: id as string })),
      tile: shell.tile ?? 2,
      segment: shell.segment ?? 2,
      doorwayWidth: shell.doorwayWidth ?? 2,
      wallHeight: shell.wallHeight ?? 3.5,
      wallThickness: shell.wallThickness ?? 0.4,
      cutHeight: shell.cutHeight ?? 0.55,
    },
    pieces,
    floorMix: dict(m['floorMix']).map(([templateId, mix]) => ({ templateId, mix: weighted(mix as Weighted[]) })),
    substitute: dict(m['substitute']).map(([templateId, pairs]) => ({ templateId, pairs: dict(pairs as Record<string, string>).map(([from, to]) => ({ from, to })) })),
    doorSkins: dict(m['doorSkins']).map(([templateId, skins]) => ({ templateId, skins: dict(skins as Record<string, string>).map(([side, id]) => ({ side, id })) })),
    water: { knee: m['water']?.knee ?? 0.45, deep: m['water']?.deep ?? -0.35, kneeOpacity: m['water']?.kneeOpacity ?? 0.62 },
  }
}

function templates() {
  const root = path.resolve('content/dungeons')
  const out: object[] = []
  for (const dungeon of fs.readdirSync(root).sort()) {
    const dir = path.join(root, dungeon, 'templates')
    if (!fs.existsSync(dir)) continue
    for (const file of fs.readdirSync(dir).sort()) {
      if (!file.endsWith('.json')) continue
      const t = readJson(path.join(dir, file))
      out.push({
        id: t['id'],
        zoneId: t['zoneId'],
        kit: kitOf(t['zoneId'] ?? '', t['id'] ?? ''),
        w: t['footprint']?.w ?? 1,
        h: t['footprint']?.h ?? 1,
        doors: ((t['doors'] ?? []) as any[]).map((d) => ({ side: d.side, offset: d.offset ?? 0 })),
        camera: { position: vec(t['camera']?.position), lookAt: vec(t['camera']?.lookAt), fov: t['camera']?.fov ?? 40 },
        props: ((t['props'] ?? []) as any[]).map((p) => ({ meshId: p.meshId, position: vec(p.position), rotationY: p.rotationY ?? 0, lightSource: p.lightSource === true })),
        triBudget: t['triBudget'] ?? 40000,
        drawCallBudget: t['drawCallBudget'] ?? 40,
      })
    }
  }
  return out
}

export function writeEnv(): string {
  fs.mkdirSync(OUT, { recursive: true })
  const ts = templates()
  fs.writeFileSync(path.join(OUT, 'templates.json'), JSON.stringify({ templates: ts }))
  const counts: string[] = []
  for (const zone of ZONES) {
    const m = manifest(zone)
    fs.writeFileSync(path.join(OUT, `${zone}.json`), JSON.stringify(m))
    const fbx = path.join(OUT, `kit_${zone}.fbx`)
    counts.push(`${zone} ${m.pieces.length} pieces${fs.existsSync(fbx) ? '' : ' (no kit_' + zone + '.fbx — run the Blender kit build)'}`)
  }
  return `env → ${path.relative(process.cwd(), OUT)}: ${ts.length} templates · ${counts.join(' · ')}`
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(writeEnv())

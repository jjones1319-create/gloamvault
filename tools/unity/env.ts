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

// ---------------------------------------------------------------------------------------------------------------
// The characters (Phase 12, D-160): the hero and monster manifests, the clips, the GLB node extras (Unity keeps no
// custom properties at runtime) and the content's classes and monster list, reshaped for JsonUtility.
// ---------------------------------------------------------------------------------------------------------------

/** The JSON chunk of a GLB: its nodes' names and extras are the parts', gear's and weapons' data. */
function glbJson(file: string): { nodes: { name: string; extras?: Record<string, any> }[] } {
  const b = fs.readFileSync(file)
  const len = b.readUInt32LE(12)
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8')) as { nodes: { name: string; extras?: Record<string, any> }[] }
}

const pairs = (o: Record<string, number> | undefined, k = 'key', v = 'weight') => Object.entries(o ?? {}).map(([a, b]) => ({ [k]: a, [v]: b }))
const strPairs = (o: Record<string, string> | undefined, k: string, v: string) => Object.entries(o ?? {}).map(([a, b]) => ({ [k]: a, [v]: b }))
const events = (o: Record<string, number> | undefined) => Object.entries(o ?? {}).map(([name, seconds]) => ({ name, seconds }))
const clipList = (c: any[]) => c.map((k) => ({ name: k.name, seconds: k.seconds ?? 1, loop: k.loop === true, speed: k.speed ?? 1, loopStart: k.loopStart ?? 0, events: events(k.events) }))

function heroData() {
  const dir = path.resolve('client/public/models/hero')
  const manifest = readJson(path.join(dir, 'manifest.json'))
  const clips = readJson(path.join(dir, 'clips.json'))
  const species = Object.entries(manifest['species'] as Record<string, any>).map(([id, s]) => ({
    id,
    key: s.key ?? '',
    boneScales: pairs(s.boneScales, 'group', 'scale'),
    skinTones: s.skinTones ?? [],
    hairColors: s.hairColors ?? [],
    eyeColors: s.eyeColors ?? [],
    boneColors: s.boneColors ?? [],
    parts: s.parts ?? [],
    presets: ((s.presets ?? []) as any[]).map((p) => ({ id: p.id, name: p.name, face: pairs(p.face), parts: p.parts ?? [], tintSkin: p.tint?.skin ?? 0, tintHair: p.tint?.hair ?? 0, tintEye: p.tint?.eye ?? 0 })),
  }))
  const body = glbJson(path.join(dir, 'hero_broad.glb'))
  const parts = body.nodes.filter((n) => n.extras?.kind === 'part').map((n) => ({ name: n.name, family: n.extras!.family ?? '', variant: n.extras!.variant ?? '', species: n.extras!.species ?? 'any', hides: (n.extras!.hides ?? []) as string[] }))
  const gear: object[] = []
  for (const cls of ['warden', 'blade', 'ranger', 'shade', 'arcanist', 'mender']) {
    const g = glbJson(path.join(dir, `gear_${cls}_broad.glb`))
    for (const n of g.nodes) if (n.extras?.slot || n.extras?.part) gear.push({ name: n.name, cls, slot: n.extras.slot ?? n.extras.part ?? '', tier: n.extras.tier ?? 'F', hides: (n.extras.hides ?? []) as string[] })
  }
  const w = glbJson(path.join(dir, 'weapons.glb'))
  const weapons = w.nodes.filter((n) => n.extras?.kind).map((n) => ({
    name: n.name, kind: n.extras!.kind, tier: n.extras!.tier ?? 'F', socket: n.extras!.socket ?? 'Socket_HandR', weaponType: n.extras!.weaponType ?? '',
    meshIds: String(n.extras!.meshIds ?? '').split(',').filter(Boolean), hands: n.extras!.hands ?? 1, offhandY: n.extras!.offhandY ?? 0, fill: n.extras!.fill ?? '',
  }))
  // The classes: their palette and gear set, and the starter kit's held things from the items.
  const items = new Map<string, any>()
  const itemsRoot = path.resolve('content/items')
  for (const kind of fs.readdirSync(itemsRoot)) {
    const d = path.join(itemsRoot, kind)
    if (!fs.statSync(d).isDirectory()) continue
    for (const f of fs.readdirSync(d)) if (f.endsWith('.json')) { const it = readJson(path.join(d, f)); items.set(it['id'], it) }
  }
  const classes: object[] = []
  for (const f of fs.readdirSync(path.resolve('content/classes')).sort()) {
    if (!f.endsWith('.json')) continue
    const c = readJson(path.resolve('content/classes', f))
    const held: object[] = []
    for (const id of (c['starterKit'] ?? []) as string[]) {
      const it = items.get(id)
      if (!it || !['weapon', 'shield', 'focus'].includes(it.kind)) continue
      held.push({ itemId: id, kind: it.kind, weaponType: it.weaponType ?? '', hands: it.hands ?? 1, meshId: it.visual?.meshId ?? '', trimMetal: it.visual?.trimMetal ?? '', element: it.element ?? '', grade: it.grade ?? 'F' })
    }
    classes.push({ id: c['id'], name: c['name'] ?? c['id'], gearSetId: c['visual']?.gearSetId ?? '', palette: c['visual']?.palette ?? [], armorFamily: c['armorFamily'] ?? '', held })
  }
  return { fps: clips['fps'] ?? 30, hipsHeight: clips['hipsHeight'] ?? 0.885, clips: clipList(clips['clips'] ?? []), species, parts, gear, weapons, classes }
}

function monsterData() {
  const dir = path.resolve('client/public/models/monsters')
  const manifest = readJson(path.join(dir, 'manifest.json'))
  const clipsFile = readJson(path.join(dir, 'clips.json'))
  const clips = Object.entries(clipsFile).filter(([k, v]) => k !== 'fps' && typeof v === 'object').map(([base, v]: [string, any]) => ({ base, animation: v.animation ?? 'skeletal', fps: v.fps ?? 30, clips: clipList(v.clips ?? []) }))
  const entries = Object.entries(manifest as Record<string, any>).map(([key, e]) => ({
    key, base: e.base ?? '', name: e.name ?? key, scale: e.scale ?? 1, parts: (e.parts ?? []) as string[], shapes: pairs(e.shapes), palette: (e.palette ?? []) as string[], colors: (e.colors ?? []) as string[],
    slots: strPairs(e.slots, 'slot', 'color').map((s) => ({ slot: Number(s['slot']), color: s['color'] })), clipSpeed: e.clipSpeed ?? 1, clipMap: strPairs(e.clipMap, 'from', 'to'), heroClips: e.clips === 'hero',
    boneScales: pairs(e.boneScales, 'group', 'scale'), hipsOffset: vec(e.hipsOffset), ghost: e.ghost === true, pet: e.pet ?? '', height: e.height ?? 0, tris: e.tris ?? 0,
  }))
  const zoneOf = (zoneId: string) => (/vault|drown/.test(zoneId) ? 'vault' : /crypt/.test(zoneId) ? 'crypts' : 'cellars')
  const list: object[] = []
  for (const f of fs.readdirSync(path.resolve('content/monsters')).sort()) {
    if (!f.endsWith('.json')) continue
    const m = readJson(path.resolve('content/monsters', f))
    list.push({ id: m['id'], name: m['name'] ?? m['id'], zone: zoneOf(String(m['zoneId'] ?? '')), entry: manifest[m['id']] ? m['id'] : '', role: m['role'] ?? '', base: m['visual']?.baseMesh ?? '', palette: m['visual']?.palette ?? [], scale: m['visual']?.scale ?? 1 })
  }
  for (const f of fs.readdirSync(path.resolve('content/pets')).sort()) {
    if (!f.endsWith('.json')) continue
    const p = readJson(path.resolve('content/pets', f))
    const key = manifest['pet-' + p['id']] ? 'pet-' + p['id'] : manifest[p['id']] ? p['id'] : ''
    list.push({ id: p['id'], name: p['name'] ?? p['id'], zone: 'pets', entry: key, role: 'pet', base: p['visual']?.baseMesh ?? '', palette: p['visual']?.palette ?? [], scale: 1 })
  }
  return { clips, entries, list }
}

export function writeCharacters(): string {
  const hero = heroData()
  const heroDir = path.resolve('unity/Assets/Gloamvault/Resources/Hero')
  const monDir = path.resolve('unity/Assets/Gloamvault/Resources/Monsters')
  fs.mkdirSync(heroDir, { recursive: true })
  fs.mkdirSync(monDir, { recursive: true })
  fs.writeFileSync(path.join(heroDir, 'hero.json'), JSON.stringify(hero))
  // The import settings read the loops from clips.json beside the models (ModelImportSettings.cs).
  fs.copyFileSync(path.resolve('client/public/models/hero/clips.json'), path.join(heroDir, 'clips.json'))
  fs.copyFileSync(path.resolve('client/public/models/monsters/clips.json'), path.join(monDir, 'clips.json'))
  const mon = monsterData()
  fs.writeFileSync(path.join(monDir, 'monsters.json'), JSON.stringify(mon))
  const fbx = (dir: string) => fs.readdirSync(dir).filter((f) => f.endsWith('.fbx')).length
  return `characters → Resources/Hero: ${hero.species.length} species, ${hero.parts.length} parts, ${hero.gear.length} gear pieces, ${hero.weapons.length} weapons, ${hero.clips.length} clips, ${hero.classes.length} classes (${fbx(heroDir)} FBX) · Resources/Monsters: ${mon.entries.length} entries, ${mon.clips.length} bases with clips, ${mon.list.length} listed (${fbx(monDir)} FBX)`
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
  return `env → ${path.relative(process.cwd(), OUT)}: ${ts.length} templates · ${counts.join(' · ')}\n${writeCharacters()}`
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(writeEnv())

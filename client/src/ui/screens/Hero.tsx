import { useEffect } from 'preact/hooks'
import type { Content } from '../../../../sim/src/content.ts'
import { clampLook } from '../../../../sim/src/look.ts'
import type { HeroRecord } from '../../../../sim/src/types/content.ts'
import { content, profile } from '../../game/session.ts'
import { Empty, Meter, Page, Tabs } from '../kit/kit.tsx'
import { navigate, type Route } from '../router.ts'
import { seedSampleArmory, seedSampleTomes } from './hero/demo.ts'
import { GearTab } from './hero/GearTab.tsx'
import { PetTab } from './hero/PetTab.tsx'
import { SkillsTab } from './hero/SkillsTab.tsx'
import { StatusTab } from './hero/StatusTab.tsx'
import { levelProgress } from './hero/progress.ts'
import './hero.css'

const TABS = [
  { id: 'status', label: 'Status' },
  { id: 'gear', label: 'Gear' },
  { id: 'skills', label: 'Skills' },
  { id: 'pet', label: 'Pet' },
] as const
type TabId = (typeof TABS)[number]['id']

function isTab(s: string | undefined): s is TabId {
  return TABS.some((t) => t.id === s)
}

/**
 * A hero (03 §2.4): `#hero=<id>&tab=status|gear|skills|pet`. A header strip (species · class, level, the XP bar) and
 * four tabs: status with the Final Fantasy-style XP line (D-082), gear with the eleven slots and Auto-equip best,
 * skills with the three school columns, the loadout and the AI rule, and the pet with its stance, stables and eggs.
 */
/** The viewer link for this hero: species, class, their look, and the S meshes once any worn piece is grade B or better. */
function viewerLink(c: Content, hero: HeroRecord): Record<string, string> {
  const look = clampLook(hero.look, c.species.get(hero.speciesId), hero.id)
  const e = hero.equipment
  const worn = [e.mainHand, e.offHand, e.helmet, e.chest, e.legs, e.boots, e.gloves].filter((i) => i !== null)
  const fine = worn.some((i) => ['B', 'A', 'S', 'SS', 'God'].includes(c.items.get(i!.itemId)?.grade ?? 'F'))
  return {
    viewer: `${hero.speciesId},${hero.classId},${fine ? 'S' : 'F'}`,
    frame: look.frame,
    preset: String(look.face + 1),
    skin: String(look.skin + 1),
    hair: String(look.hair + 1),
    from: `hero:${hero.id}`,
  }
}

export function HeroScreen({ route }: { route: Route }) {
  const c = content.value
  const p = profile.value
  const wanted = route.params.hero && route.params.hero !== '1' ? route.params.hero : (p?.heroes[0]?.id ?? '')
  const hero = p?.heroes.find((h) => h.id === wanted)
  const tab: TabId = isTab(route.params.tab) ? route.params.tab : 'status'
  const cls = hero && c ? c.classes.get(hero.classId) : undefined
  const species = hero && c ? c.species.get(hero.speciesId) : undefined
  const sample = route.params.armory === '1' && hero !== undefined
  useEffect(() => {
    if (sample && hero) seedSampleArmory(hero.id)
  }, [sample])
  const tomes = route.params.tomes === '1' && hero !== undefined
  useEffect(() => {
    if (tomes && hero) seedSampleTomes(hero.id)
  }, [tomes])
  if (!c || !p || !hero || !cls) {
    return (
      <Page name="hero" title="Hero" back="town">
        <Empty>That hero is not on the roster.</Empty>
      </Page>
    )
  }
  const lv = levelProgress(c.tuning, hero)
  return (
    <Page name="hero" title={hero.name} back="town" bodyClass="hr-body">
      <div class="hr-head">
        <div class="hr-id" data-testid="hr-id">
          <span class="hr-id__who">
            {species?.name ?? hero.speciesId} {cls.name}
          </span>
          <span class="hr-id__lv">Lv {lv.level}</span>
          <span class="hr-id__bar">
            <Meter compact tone="xp" value={lv.atCap ? 1 : lv.into} max={lv.atCap ? 1 : lv.need} label="XP" />
          </span>
          <span class="hr-id__xp">{lv.atCap ? 'top level' : `${lv.into}/${lv.need} XP`}</span>
        </div>
        <Tabs tabs={TABS} value={tab} onChange={(id) => navigate('hero', { ...route.params, hero: hero.id, tab: id })} />
        <button class="btn hr-view3d" data-testid="hero-view3d" onClick={() => navigate('viewer', viewerLink(c, hero))}>
          View in 3D
        </button>
      </div>
      <div class={`hr-panel hr-panel--${tab}`} data-tab={tab}>
        {tab === 'status' && <StatusTab c={c} hero={hero} cls={cls} />}
        {tab === 'gear' && <GearTab c={c} p={p} hero={hero} cls={cls} />}
        {tab === 'skills' && <SkillsTab c={c} hero={hero} cls={cls} />}
        {tab === 'pet' && <PetTab c={c} p={p} hero={hero} />}
      </div>
    </Page>
  )
}

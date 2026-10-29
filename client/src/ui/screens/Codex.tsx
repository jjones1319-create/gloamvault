import { useEffect } from 'preact/hooks'
import type { Content } from '../../../../sim/src/content.ts'
import { heroCardStats } from '../../../../sim/src/hero.ts'
import type { Profile } from '../../../../sim/src/town.ts'
import type { HeroRecord } from '../../../../sim/src/types/content.ts'
import { content, profile } from '../../game/session.ts'
import { MonsterCanvas } from '../components/MonsterCanvas.tsx'
import { StatTip } from '../components/StatTip.tsx'
import { speedCompareLine } from '../components/statLines.ts'
import { Chip, Empty, Grade, Page, Tabs } from '../kit/kit.tsx'
import { navigate, type Route } from '../router.ts'
import { codexMaterials, codexMonsters, codexTotals, type CodexMaterialView, type CodexMonsterView } from './codex/codexView.ts'
import { seedSampleCodex } from './codex/demo.ts'
import './codex.css'

/**
 * The codex (12 Phase 8, pass B): `#codex[&tab=materials][&monster=<id>][&from=hero:<id>]`, reached from the town and a
 * hero's screen. Monsters met, zone by zone — a 3D card, family, numbers, the attacks and tells seen, the parts — and
 * the materials found with where they come from. It fills by play (the profile's `codex`, folded in when a delve comes
 * home), so a page is only as full as the player has made it.
 */

const TABS = [
  { id: 'monsters', label: 'Monsters' },
  { id: 'materials', label: 'Materials' },
] as const
type TabId = (typeof TABS)[number]['id']

const ROLE_WORD: Readonly<Record<string, string>> = { fodder: 'Fodder', special: 'Special', elite: 'Elite', monster: 'Monster', boss: 'Boss' }

function backOf(route: Route): { back: 'town' | 'hero'; params?: Record<string, string> } {
  const from = route.params.from ?? ''
  return from.startsWith('hero:') ? { back: 'hero', params: { hero: from.slice(5), tab: 'status' } } : { back: 'town' }
}

export function CodexScreen({ route }: { route: Route }) {
  const c = content.value
  const p = profile.value
  const { back, params } = backOf(route)
  // `&sample=1` on a demo profile: a few delves' worth of pages for a screenshot (codex/demo.ts).
  const sample = route.params.sample === '1'
  useEffect(() => {
    if (sample) seedSampleCodex()
  }, [sample, c !== null])
  if (!c || !p) {
    return (
      <Page name="codex" title="Codex" back={back} backParams={params}>
        <Empty>Opening the codex…</Empty>
      </Page>
    )
  }
  const tab: TabId = route.params.tab === 'materials' ? 'materials' : 'monsters'
  const totals = codexTotals(c, p)
  const tabs = TABS.map((t) => ({ id: t.id, label: t.id === 'monsters' ? `Monsters ${totals.monstersMet}/${totals.monstersTotal}` : `Materials ${totals.materialsFound}` }))
  const go = (next: Record<string, string>) => navigate('codex', { ...route.params, ...next })
  return (
    <Page name="codex" title="Codex" back={back} backParams={params} bodyClass="cx-body">
      <div class="cx-head">
        <Tabs tabs={tabs} value={tab} onChange={(id) => go({ tab: id, monster: '' })} />
      </div>
      {tab === 'monsters' ? <MonstersPage c={c} p={p} selected={route.params.monster ?? ''} onPick={(id) => go({ monster: id })} /> : <MaterialsPage c={c} p={p} />}
    </Page>
  )
}

function MonstersPage({ c, p, selected, onPick }: { c: Content; p: Profile; selected: string; onPick: (id: string) => void }) {
  const zones = codexMonsters(c, p)
  const all = zones.flatMap((z) => z.seen)
  const pick = all.find((m) => m.id === selected) ?? all[0] ?? null
  if (!pick) {
    return (
      <div class="cx-empty" data-testid="cx-empty">
        <Empty>No monster met yet. Every monster you fight is written here, with the attacks you saw it use and the parts it dropped.</Empty>
      </div>
    )
  }
  return (
    <div class="cx-split">
      <nav class="cx-list" aria-label="Monsters met">
        {zones.map((z) => (
          <section key={z.id} class="cx-zone">
            <h2 class="cx-zone__title">
              {z.name} <small>{z.seen.length}/{z.total}</small>
            </h2>
            {z.seen.map((m) => (
              <button key={m.id} type="button" class={`cx-row ${m.id === pick.id ? 'cx-row--on' : ''}`} data-testid={`cx-monster-${m.id}`} aria-pressed={m.id === pick.id} onClick={() => onPick(m.id)}>
                <span class="cx-row__name">
                  {m.name}
                  {m.boss && <span class="cx-tag cx-tag--boss">Boss</span>}
                  {m.hunter && <span class="cx-tag cx-tag--hunter">Hunter</span>}
                </span>
                <span class="cx-row__sub">
                  seen {m.seen} · killed {m.killed}
                </span>
              </button>
            ))}
            {z.total > z.seen.length && <p class="cx-zone__more">{z.total - z.seen.length} more to meet</p>}
          </section>
        ))}
      </nav>
      <MonsterDetail c={c} p={p} m={pick} />
    </div>
  )
}

function MonsterDetail({ c, p, m }: { c: Content; p: Profile; m: CodexMonsterView }) {
  const lead = p.heroes.find((h) => h.id === p.partyIds[0]) ?? p.heroes[0]
  const leadSpeed = lead ? speedOf(c, lead) : null
  return (
    <article class="cx-detail" data-testid="cx-detail" aria-label={m.name}>
      <MonsterCanvas monsterId={m.id} testid="cx-card3d" />
      <div class="cx-facts">
        <h2 class="cx-detail__name">{m.name}</h2>
        <p class="cx-detail__kind">
          {m.family} · {ROLE_WORD[m.role] ?? m.role} · {m.size} · {m.levels}
        </p>
        <StatTip testid="cx-speed" label="Speed" value={m.speed} line={speedCompareLine(c.tuning, m.speed, lead && leadSpeed ? { name: lead.name, speed: leadSpeed } : undefined)} />
        {(m.weak.length > 0 || m.resist.length > 0 || m.immune.length > 0) && (
          <p class="cx-line cx-chips">
            {m.weak.length > 0 && <Chip tone="good">weak to {m.weak.join(', ')}</Chip>}
            {m.resist.length > 0 && <Chip tone="warn">resists {m.resist.join(', ')}</Chip>}
            {m.immune.length > 0 && <Chip tone="bad">immune to {m.immune.join(', ')}</Chip>}
          </p>
        )}
        <h3 class="cx-sub">Attacks seen</h3>
        {m.attacks.length === 0 ? (
          <p class="cx-line cx-dim">None seen yet.</p>
        ) : (
          <ul class="cx-attacks">
            {m.attacks.map((a) => (
              <li key={a.id}>
                <b>{a.name}</b> <span class="cx-dim">{a.damageType}</span>
                {a.hint && <span class="cx-tell">“{a.hint}”</span>}
              </li>
            ))}
          </ul>
        )}
        {m.unseenAttacks > 0 && <p class="cx-line cx-dim">{m.unseenAttacks === 1 ? 'One more attack' : `${m.unseenAttacks} more attacks`} not seen yet.</p>}
        {m.tells.length > 0 && (
          <p class="cx-line">
            <span class="cx-dim">Warnings seen:</span> {m.tells.map((t) => `“${t}”`).join(' · ')}
          </p>
        )}
        <h3 class="cx-sub">Parts</h3>
        <ul class="cx-parts">
          {m.parts.map((part) => (
            <li key={part.id} class={part.found ? 'cx-found' : 'cx-dim'}>
              {part.found ? '✓ ' : '? '}
              {part.found ? part.name : `${part.rare ? 'a rare part' : 'a part'}, not found yet`}
              {part.rare && part.found && <span class="cx-tag">rare</span>}
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

/** A hero's Speed, for the speed line's comparison (the sim's derived stats; null when they cannot be read). */
function speedOf(c: Content, h: HeroRecord): number | null {
  try {
    return heroCardStats(c, c.tuning, h).speed
  } catch {
    return null
  }
}

function MaterialsPage({ c, p }: { c: Content; p: Profile }) {
  const mats = codexMaterials(c, p)
  if (mats.length === 0) {
    return (
      <div class="cx-empty" data-testid="cx-empty">
        <Empty>No material found yet. Parts that monsters drop, and what traps and curios give, are written here with where they come from.</Empty>
      </div>
    )
  }
  return (
    <ul class="cx-mats" aria-label="Materials found">
      {mats.map((m) => (
        <MaterialRow key={m.id} m={m} />
      ))}
    </ul>
  )
}

function MaterialRow({ m }: { m: CodexMaterialView }) {
  return (
    <li class="cx-mat" data-testid={`cx-material-${m.id}`}>
      <div class="cx-mat__head">
        <b>{m.name}</b> <Grade grade={m.grade} />
        {m.ladder && <span class="cx-dim">{m.ladder}</span>}
        <span class="cx-mat__count">
          {m.found > 0 ? `found ${m.found}` : 'found before the codex'}
          {m.held > 0 ? ` · held ${m.held}` : ''}
        </span>
      </div>
      {m.sources.length > 0 && <p class="cx-mat__from">{m.sources.join(' · ')}</p>}
    </li>
  )
}

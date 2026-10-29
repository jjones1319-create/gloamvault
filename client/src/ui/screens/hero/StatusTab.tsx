import type { Content } from '../../../../../sim/src/content.ts'
import { heroCardStats } from '../../../../../sim/src/hero.ts'
import type { ClassDef, HeroRecord } from '../../../../../sim/src/types/content.ts'
import { ATTRIBUTES, FIELD_SKILLS, type DerivedStat, type Pool } from '../../../../../sim/src/types/enums.ts'
import { StatTip } from '../../components/StatTip.tsx'
import { attributeLine, derivedLine, fieldSkillLine, levelLine } from '../../components/statLines.ts'
import { Meter, Section } from '../../kit/kit.tsx'
import { buzz } from '../../lib/haptics.ts'
import { attributeGrowthLines, fieldSkillGrowthLines, growthNote, skillGrowthLines, type GrowthLine } from './growth.ts'
import { ATTRIBUTE_NAME, FIELD_SKILL_NAME, STAT_NAME, formatStat } from './labels.ts'
import { attributeGrowth, levelProgress } from './progress.ts'
import './growth.css'

/**
 * Status (03 §2.4, D-082): the level and its XP bar, the eight attributes and what grew them, the derived stats, the
 * field skills — every one a StatTip that says it in plain words with the hero's numbers (Phase 8, pass B) — and under
 * them the growth lines (03 §5): how each attribute, loadout skill and field skill grows by use and how close the
 * next point or rank is.
 */
export function StatusTab({ c, hero, cls }: { c: Content; hero: HeroRecord; cls: ClassDef }) {
  const t = c.tuning
  const lv = levelProgress(t, hero)
  // Detection with the loadout passives counted, as the traps and secrets read it (sim heroCardStats).
  const stats = heroCardStats(c, t, hero)
  const poolKind: Pool = cls.pool === 'mana' ? 'mana' : 'stamina'
  const pool: DerivedStat = poolKind
  const shown: DerivedStat[] = ['hp', pool, 'attackPhys', 'attackSpell', 'defense', 'speed', 'accuracy', 'dodge', 'critRate', 'critDamage', 'resistance', 'detection', 'momentumGain', 'fortune', 'carry']
  if (stats.block > 0) shown.splice(5, 0, 'block')
  const attrGrowth = attributeGrowthLines(c, t, hero)
  const skillGrowth = skillGrowthLines(c, t, hero)
  const fieldGrowth = fieldSkillGrowthLines(t, hero)
  const growthOf = (key: string) => attrGrowth.find((g) => g.key === key) ?? fieldGrowth.find((g) => g.key === key)
  return (
    <div class="hr-status">
      <section class="hr-xp" data-testid="hr-xp">
        <StatTip class="hr-xp__tip" testid="hr-level-tip" line={levelLine(lv.level, lv.into, lv.need, lv.atCap)}>
          <span class="hr-xp__label">
            <b>Lv {lv.level}</b> {lv.atCap ? '· the top level' : `· ${lv.into} / ${lv.need} XP to Lv ${lv.level + 1}`}
          </span>
        </StatTip>
        <Meter compact tone="xp" value={lv.atCap ? 1 : lv.into} max={lv.atCap ? 1 : lv.need} label="Battle XP" />
        <p class="hr-record">
          Kills {hero.stats.kills} · Delves {hero.stats.delves} · Falls {hero.stats.deaths}
        </p>
        <button
          type="button"
          class="btn btn--quiet hr-growth-link"
          data-testid="hr-growth-link"
          onClick={() => {
            buzz()
            // After the tap's own focus and pointer handling, so nothing undoes the scroll; no animation (Reduce motion).
            window.setTimeout(() => document.getElementById('hr-growth')?.scrollIntoView({ block: 'start' }), 0)
          }}
        >
          How they grow ↓
        </button>
      </section>
      <div class="hr-col">
        <Section title="Attributes" right={<span class="hr-legend">made · now</span>}>
          <div class="hr-attrs">
            {ATTRIBUTES.map((a) => {
              const g = attributeGrowth(c, t, hero, a)
              const grew = g.fromLevels + g.fromUse
              const why = [g.fromLevels ? `${g.fromLevels} from levels` : '', g.fromUse ? `${g.fromUse} from use` : ''].filter(Boolean).join(', ')
              const growth = growthOf(a)
              const line = `${attributeLine(t, a, g.now, stats, poolKind)} Made with ${g.start}${why ? `; ${why}` : ''}.${growth && a !== 'luck' ? ` Next point: ${growth.text}.` : ''}`
              return (
                <StatTip key={a} class="hr-attr" testid={`hr-attr-${a}`} line={line}>
                  <span class="hr-attr__name">{ATTRIBUTE_NAME[a]}</span>
                  <span class="hr-attr__start">{g.start}</span>
                  <b class="hr-attr__now">{g.now}</b>
                  <span class={`hr-attr__grow ${grew > 0 ? 'hr-good' : ''}`}>{grew > 0 ? `+${grew}` : ''}</span>
                  <span class="hr-attr__bar" aria-hidden="true">
                    {g.nextPercent !== null && <span class="hr-attr__fill" style={{ width: `${g.nextPercent}%` }} />}
                  </span>
                </StatTip>
              )
            })}
          </div>
        </Section>
      </div>
      <div class="hr-col">
        <Section title="Derived">
          <div class="stat-grid hr-derived" data-testid="hr-derived">
            {shown.map((s) => (
              <StatTip key={s} testid={`hr-stat-${s}`} label={STAT_NAME[s]} value={formatStat(s, stats[s])} line={derivedLine(t, s, stats[s], stats)} />
            ))}
          </div>
        </Section>
      </div>
      <div class="hr-col">
        <Section title="Field skills">
          <div class="hr-fields">
            {FIELD_SKILLS.map((f) => {
              const rank = hero.fieldSkills[f]?.rank ?? 1
              const growth = growthOf(f)
              return (
                <StatTip key={f} class="hr-field" testid={`hr-field-${f}`} line={`${fieldSkillLine(t, f, rank)}${growth ? ` Next rank: ${growth.text}.` : ''}`}>
                  <span class="hr-field__name">{FIELD_SKILL_NAME[f]}</span>
                  <span class="hr-field__pips" aria-hidden="true">
                    {Array.from({ length: 10 }, (_, i) => (
                      <span key={i} class={`hr-field__pip ${i < rank ? 'hr-field__pip--on' : ''}`} />
                    ))}
                  </span>
                  <b class="hr-field__rank">{rank}</b>
                </StatTip>
              )
            })}
          </div>
        </Section>
      </div>
      <section class="hr-growth" id="hr-growth" data-testid="hr-growth" aria-label="How they grow">
        <h2 class="section__title">How they grow</h2>
        <div class="hr-growth__cols">
          <GrowthList title="Attributes" lines={attrGrowth} />
          <div>
            {skillGrowth.length > 0 && <GrowthList title="Skills in the loadout" lines={skillGrowth} />}
            <GrowthList title="Field skills" lines={fieldGrowth} />
          </div>
        </div>
        <p class="hr-growth__note">{growthNote(t)}</p>
      </section>
    </div>
  )
}

function GrowthList({ title, lines }: { title: string; lines: readonly GrowthLine[] }) {
  return (
    <div class="hr-growth__list">
      <h3 class="hr-growth__title">{title}</h3>
      <ul>
        {lines.map((l) => (
          <li key={l.key} class="hr-grow" data-testid={`hr-grow-${l.key}`}>
            <span class="hr-grow__head">
              <b class="hr-grow__name">{l.name}</b>
              <span class="hr-grow__step">{l.step}</span>
            </span>
            {l.percent !== null && (
              <span class="hr-grow__bar" aria-hidden="true">
                <span class="hr-grow__fill" style={{ width: `${l.percent}%` }} />
              </span>
            )}
            <span class="hr-grow__text">{l.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

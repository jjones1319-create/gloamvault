import type { Content } from '../../../../../sim/src/content.ts'
import { heroStats } from '../../../../../sim/src/hero.ts'
import type { ClassDef, HeroRecord } from '../../../../../sim/src/types/content.ts'
import { ATTRIBUTES, FIELD_SKILLS, type DerivedStat } from '../../../../../sim/src/types/enums.ts'
import { Meter, Section, Stat } from '../../kit/kit.tsx'
import { ATTRIBUTE_HINT, ATTRIBUTE_NAME, FIELD_SKILL_NAME, STAT_NAME, formatStat } from './labels.ts'
import { attributeGrowth, levelProgress } from './progress.ts'

/** Status (03 §2.4, D-082): the level and its XP bar, the eight attributes and what grew them, the derived stats, field skills. */
export function StatusTab({ c, hero, cls }: { c: Content; hero: HeroRecord; cls: ClassDef }) {
  const t = c.tuning
  const lv = levelProgress(t, hero)
  const stats = heroStats(c, t, hero)
  const pool: DerivedStat = cls.pool === 'mana' ? 'mana' : 'stamina'
  const shown: DerivedStat[] = ['hp', pool, 'attackPhys', 'attackSpell', 'defense', 'speed', 'accuracy', 'dodge', 'critRate', 'critDamage', 'resistance', 'detection', 'momentumGain', 'fortune', 'carry']
  if (stats.block > 0) shown.splice(5, 0, 'block')
  return (
    <div class="hr-status">
      <section class="hr-xp" data-testid="hr-xp">
        <p class="hr-xp__label">
          <b>Lv {lv.level}</b> {lv.atCap ? '· the top level' : `· ${lv.into} / ${lv.need} XP to Lv ${lv.level + 1}`}
        </p>
        <Meter compact tone="xp" value={lv.atCap ? 1 : lv.into} max={lv.atCap ? 1 : lv.need} label="Battle XP" />
        <p class="hr-record">
          Kills {hero.stats.kills} · Delves {hero.stats.delves} · Falls {hero.stats.deaths}
        </p>
      </section>
      <div class="hr-col">
        <Section title="Attributes" right={<span class="hr-legend">made · now</span>}>
          <div class="hr-attrs">
            {ATTRIBUTES.map((a) => {
              const g = attributeGrowth(c, t, hero, a)
              const grew = g.fromLevels + g.fromUse
              const why = [g.fromLevels ? `${g.fromLevels} from levels` : '', g.fromUse ? `${g.fromUse} from use` : ''].filter(Boolean).join(', ')
              return (
                <div key={a} class="hr-attr" data-testid={`hr-attr-${a}`} title={`${ATTRIBUTE_HINT[a]}. Made with ${g.start}${why ? `; ${why}` : ''}.`}>
                  <span class="hr-attr__name">{ATTRIBUTE_NAME[a]}</span>
                  <span class="hr-attr__start">{g.start}</span>
                  <b class="hr-attr__now">{g.now}</b>
                  <span class={`hr-attr__grow ${grew > 0 ? 'hr-good' : ''}`}>{grew > 0 ? `+${grew}` : ''}</span>
                  <span class="hr-attr__bar" aria-hidden="true">
                    {g.nextPercent !== null && <span class="hr-attr__fill" style={{ width: `${g.nextPercent}%` }} />}
                  </span>
                </div>
              )
            })}
          </div>
        </Section>
      </div>
      <div class="hr-col">
        <Section title="Derived">
          <div class="stat-grid hr-derived">
            {shown.map((s) => (
              <Stat key={s} label={STAT_NAME[s]} value={formatStat(s, stats[s])} />
            ))}
          </div>
        </Section>
      </div>
      <div class="hr-col">
        <Section title="Field skills">
          <div class="hr-fields">
            {FIELD_SKILLS.map((f) => {
              const rank = hero.fieldSkills[f]?.rank ?? 1
              return (
                <div key={f} class="hr-field">
                  <span class="hr-field__name">{FIELD_SKILL_NAME[f]}</span>
                  <span class="hr-field__pips" aria-hidden="true">
                    {Array.from({ length: 10 }, (_, i) => (
                      <span key={i} class={`hr-field__pip ${i < rank ? 'hr-field__pip--on' : ''}`} />
                    ))}
                  </span>
                  <b class="hr-field__rank">{rank}</b>
                </div>
              )
            })}
          </div>
        </Section>
      </div>
    </div>
  )
}

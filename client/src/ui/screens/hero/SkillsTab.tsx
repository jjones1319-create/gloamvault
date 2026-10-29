import { useEffect, useState } from 'preact/hooks'
import { parseRule } from '../../../../../sim/src/ai.ts'
import type { Content } from '../../../../../sim/src/content.ts'
import { tomeReadBlocker, tomeSkill } from '../../../../../sim/src/tomes.ts'
import { readTome, setAiRule, setLoadoutSlot } from '../../../../../sim/src/town.ts'
import type { ClassDef, HeroRecord, SkillDef } from '../../../../../sim/src/types/content.ts'
import { act, actWith, profile, toast } from '../../../game/session.ts'
import { Btn, Empty, Modal, Section } from '../../kit/kit.tsx'
import { buzz } from '../../lib/haptics.ts'
import { requirementText, skillMeta, tierName } from './labels.ts'
import { clauseText, namesNotInLoadout, skillState } from './progress.ts'

/**
 * Skills (03 §7): the class's three schools as columns, Tiers I–V, known or where to get each (Phase 7: a technique by
 * watching its monster, Tier IV by Insight or a Skill Tome, Tier V locked until the endgame of later dungeons); the
 * loadout (four actives, two passives; the Ultimate has its own button); and the AI rule used on Auto (03 §3.6, §10.3).
 */
export function SkillsTab({ c, hero, cls }: { c: Content; hero: HeroRecord; cls: ClassDef }) {
  const [slot, setSlot] = useState<{ kind: 'active' | 'passive'; index: number } | null>(null)
  const [info, setInfo] = useState<SkillDef | null>(null)
  const all = c.skillsByClass.get(cls.id) ?? []
  const tiers = [...new Set(all.map((s) => s.tier))].sort((a, b) => a - b)
  const lockedTier = (tier: number) => tier > c.tuning.skills.obtainableTierMax.value
  const placedAt = (id: string): string | null => {
    const a = hero.loadout.actives.indexOf(id)
    if (a >= 0) return `Active ${a + 1}`
    const p = hero.loadout.passives.indexOf(id)
    return p >= 0 ? `Passive ${p + 1}` : null
  }
  return (
    <div class="hr-skills">
      <div class="hr-schools">
        {cls.schools.map((school) => (
          <section key={school.id} class="hr-school">
            <h3 class="hr-school__name" title={school.philosophy}>
              {school.name}
            </h3>
            {tiers.map((tier) => (
              <div key={tier} class={`hr-tier ${lockedTier(tier) ? 'hr-tier--locked' : ''}`}>
                <span class="hr-tier__name">
                  Tier {tierName(tier)}
                  {lockedTier(tier) && <span class="hr-tier__note"> · locked until the endgame of later dungeons</span>}
                </span>
                {all
                  .filter((s) => s.school === school.id && s.tier === tier)
                  .sort((a, b) => Number(a.isUltimate) - Number(b.isUltimate) || (a.type === b.type ? 0 : a.type === 'active' ? -1 : 1) || a.name.localeCompare(b.name))
                  .map((s) => (
                    <SkillButton key={s.id} c={c} hero={hero} s={s} placed={placedAt(s.id)} onOpen={() => setInfo(s)} />
                  ))}
              </div>
            ))}
          </section>
        ))}
      </div>
      <div class="hr-side">
        <Loadout c={c} hero={hero} cls={cls} onSlot={(kind, index) => setSlot({ kind, index })} />
        <TomesCard c={c} hero={hero} cls={cls} />
        <AiRuleCard c={c} hero={hero} cls={cls} />
      </div>
      {slot && <SlotPicker c={c} hero={hero} cls={cls} kind={slot.kind} index={slot.index} onClose={() => setSlot(null)} />}
      {info && <SkillInfo c={c} hero={hero} cls={cls} s={info} onClose={() => setInfo(null)} />}
    </div>
  )
}

function SkillButton({ c, hero, s, placed, onOpen }: { c: Content; hero: HeroRecord; s: SkillDef; placed: string | null; onOpen: () => void }) {
  const st = skillState(c, c.tuning, hero, s)
  return (
    <button
      class={`hr-skill ${st.known ? 'hr-skill--known' : st.open ? '' : 'hr-skill--locked'} ${!st.known && st.locked ? 'hr-skill--sealed' : ''} ${s.isUltimate ? 'hr-skill--ult' : ''}`}
      data-testid={`hr-skill-${s.id}`}
      onClick={() => {
        buzz()
        onOpen()
      }}
    >
      <span class="hr-skill__name">
        {s.name}
        {s.type === 'passive' && <span class="hr-skill__tag">passive</span>}
        {s.isUltimate && <span class="hr-skill__tag hr-skill__tag--ult">Ultimate</span>}
      </span>
      <span class="hr-skill__state">
        {st.known ? (
          <>
            Rank {st.rank}
            {st.mastery && <span class="hr-star" title="Mastery">★</span>}
            {placed && <span class="hr-skill__placed"> · {placed}</span>}
          </>
        ) : st.locked && s.tier > c.tuning.skills.obtainableTierMax.value ? (
          'Locked'
        ) : (
          st.where
        )}
      </span>
    </button>
  )
}

/* ---------- the loadout ---------- */

function Loadout({ c, hero, cls, onSlot }: { c: Content; hero: HeroRecord; cls: ClassDef; onSlot: (kind: 'active' | 'passive', index: number) => void }) {
  const ult = c.skills.get(cls.ultimateSkillId)
  const knowsUlt = hero.skills.some((s) => s.skillId === cls.ultimateSkillId)
  const cell = (kind: 'active' | 'passive', index: number, id: string | null) => {
    const s = id ? c.skills.get(id) : undefined
    const misplaced = s !== undefined && s.type !== kind
    return (
      <button
        key={`${kind}-${index}`}
        class={`hr-slot ${s ? '' : 'hr-slot--empty'} ${misplaced ? 'hr-slot--bad' : ''}`}
        data-testid={`hr-loadout-${kind}-${index + 1}`}
        onClick={() => {
          buzz()
          onSlot(kind, index)
        }}
      >
        <span class="hr-slot__n">{index + 1}</span>
        <span class="hr-slot__name">{s ? s.name : 'Empty'}</span>
        {misplaced && <span class="hr-slot__warn">passive: move it</span>}
      </button>
    )
  }
  return (
    <Section title="Loadout">
      <div class="hr-loadout">
        <span class="hr-loadout__label">Actives</span>
        <div class="hr-loadout__row hr-loadout__row--4">{hero.loadout.actives.map((id, i) => cell('active', i, id))}</div>
        <span class="hr-loadout__label">Passives</span>
        <div class="hr-loadout__row">{hero.loadout.passives.map((id, i) => cell('passive', i, id))}</div>
        <p class="hr-loadout__ult">
          <span class="hr-skill__tag hr-skill__tag--ult">Ultimate</span> {ult?.name ?? '—'}: {knowsUlt ? 'its own button at 100 Momentum.' : 'not learned yet: a Skill Tome teaches it (bosses, Skill Tome chests).'}
        </p>
      </div>
    </Section>
  )
}

/** Tap a slot, then a known skill: the slot's choices in a dialog (a skill already elsewhere moves here). */
function SlotPicker({ c, hero, cls, kind, index, onClose }: { c: Content; hero: HeroRecord; cls: ClassDef; kind: 'active' | 'passive'; index: number; onClose: () => void }) {
  const current = (kind === 'active' ? hero.loadout.actives : hero.loadout.passives)[index] ?? null
  const known = hero.skills
    .map((k) => ({ k, s: c.skills.get(k.skillId) }))
    .filter((x): x is { k: (typeof hero.skills)[number]; s: SkillDef } => x.s !== undefined && x.s.type === kind && !x.s.isUltimate)
    .sort((a, b) => a.s.tier - b.s.tier || a.s.name.localeCompare(b.s.name))
  const place = (skillId: string | null) => {
    const name = skillId ? (c.skills.get(skillId)?.name ?? skillId) : null
    if (act((cc, p) => setLoadoutSlot(cc, p, hero.id, kind, index, skillId), name ? `${name} in ${kind} slot ${index + 1}` : `${kind === 'active' ? 'Active' : 'Passive'} slot ${index + 1} emptied`)) onClose()
  }
  return (
    <Modal
      title={`${kind === 'active' ? 'Active' : 'Passive'} slot ${index + 1}`}
      onClose={onClose}
      testid="hr-slot-picker"
      actions={
        <>
          <Btn testid="hr-slot-clear" disabled={current === null} onClick={() => place(null)}>
            Empty this slot
          </Btn>
          <Btn onClick={onClose}>Close</Btn>
        </>
      }
    >
      {known.length === 0 ? (
        <Empty>No {kind} skills known yet: the Skill Hall in town sells them.</Empty>
      ) : (
        <div class="list hr-modal-scroll">
          {known.map(({ k, s }) => {
            const where = kind === 'active' ? hero.loadout.actives.indexOf(s.id) : hero.loadout.passives.indexOf(s.id)
            return (
              <button
                key={s.id}
                class={`list__row hr-pick ${s.id === current ? 'list__row--on' : ''}`}
                data-testid={`hr-pick-${s.id}`}
                onClick={() => {
                  buzz()
                  place(s.id)
                }}
              >
                <span class="list__main">
                  <span class="hr-pick__name">
                    {s.name} <span class="hr-pick__rank">Rank {k.rank}</span>
                    {where >= 0 && <span class="hr-pick__rank"> · now in slot {where + 1}</span>}
                  </span>
                  <span class="list__sub">
                    {skillMeta(c.tuning, s, cls.pool)} · {s.description}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

function SkillInfo({ c, hero, cls, s, onClose }: { c: Content; hero: HeroRecord; cls: ClassDef; s: SkillDef; onClose: () => void }) {
  const st = skillState(c, c.tuning, hero, s)
  const school = cls.schools.find((x) => x.id === s.school)
  const need = requirementText(s)
  const prereq = s.prerequisiteId ? c.skills.get(s.prerequisiteId)?.name : null
  return (
    <Modal title={s.name} onClose={onClose} testid="hr-skill-info" actions={<Btn onClick={onClose}>Close</Btn>}>
      <div class="hr-modal-scroll">
        <p class="hr-info__meta">
          {school?.name ?? s.school} · Tier {tierName(s.tier)} · {skillMeta(c.tuning, s, cls.pool)}
        </p>
        <p class="hr-info__desc">{s.description}</p>
        {need && <p class="hr-note">{need}.</p>}
        {prereq && <p class="hr-info__meta">Comes after {prereq}.</p>}
        <p class="hr-info__meta">
          {st.known ? `Known · rank ${st.rank} of ${c.tuning.xp.skill.maxRank}: it grows each time you use it on a worthy foe.` : `Not known · ${st.where}.`}
        </p>
        <p class="hr-info__meta">
          <span class="hr-star">★</span> Mastery at rank {c.tuning.xp.skill.maxRank}: {s.mastery.text}
        </p>
      </div>
    </Modal>
  )
}

/* ---------- Skill Tomes (03 §7.5, 08 §4; Phase 7) ---------- */

/**
 * The Skill Tomes this hero can read: the ones of its class in the armory (the town's store) and in its own bag. Read
 * teaches an unknown skill at rank 1, or gives a known one a rank's worth of XP; the Tome is used up. Tomes of other
 * classes wait for a hero of their class (or the Blacksmith buys them).
 */
function TomesCard({ c, hero, cls }: { c: Content; hero: HeroRecord; cls: ClassDef }) {
  const p = profile.value
  if (!p) return null
  const all = [...hero.bag.map((inst) => ({ inst, where: 'bag' as const })), ...p.armory.map((inst) => ({ inst, where: 'armory' as const }))]
    .map((x) => ({ ...x, skill: tomeSkill(c, x.inst) }))
    .filter((x): x is typeof x & { skill: SkillDef } => x.skill !== null)
  const mine = all.filter((x) => x.skill.classId === cls.id)
  const others = all.length - mine.length
  if (all.length === 0) return null
  return (
    <Section title={`Skill Tomes (${mine.length})`}>
      {mine.length === 0 ? (
        <Empty>No {cls.name} Tomes yet: Insights, bosses and Skill Tome chests bring them.</Empty>
      ) : (
        <div class="list">
          {mine.map(({ inst, where, skill }) => {
            const blocked = tomeReadBlocker(c, hero, inst)
            const known = hero.skills.some((k) => k.skillId === skill.id)
            return (
              <div key={inst.instanceId} class="list__row hr-tome">
                <span class="list__main">
                  <span class="hr-pick__name">{skill.name}</span>
                  <span class="list__sub">
                    Tier {tierName(skill.tier)} · {where === 'bag' ? 'in the bag' : 'in the armory'} · {known ? 'known: a rank of practice' : 'new to you'}
                  </span>
                </span>
                <Btn
                  class="hr-btn44"
                  tone="primary"
                  testid={`hr-read-${inst.instanceId}`}
                  disabled={blocked !== null}
                  title={blocked ?? `Read the Tome of ${skill.name}`}
                  onClick={() => {
                    buzz()
                    const out = actWith((cc, pp) => {
                      const r = readTome(cc, pp, hero.id, inst.instanceId)
                      return { profile: r.profile, result: r.outcome }
                    })
                    if (out) toast(out.kind === 'learned' ? `${hero.name} learns ${skill.name}. Put it in a slot.` : `${hero.name} studies ${skill.name}: +${out.xp} rank XP${out.ranksGained ? ' (rank up!)' : ''}`, 'good')
                  }}
                >
                  Read
                </Btn>
              </div>
            )
          })}
        </div>
      )}
      {others > 0 && <p class="hr-note">{others} Tome{others === 1 ? '' : 's'} of other classes wait for a hero of their class.</p>}
    </Section>
  )
}

/* ---------- the AI rule ---------- */

const HINT = 'IF self HP < 30% THEN item small hp potion on self; IF enemy status mark THEN aimed shot on marked enemy; ELSE basic attack'

function AiRuleCard({ c, hero, cls }: { c: Content; hero: HeroRecord; cls: ClassDef }) {
  const [text, setText] = useState(hero.aiRule)
  useEffect(() => setText(hero.aiRule), [hero.id, hero.aiRule])
  const rule = parseRule(text)
  const missing = namesNotInLoadout(c, hero, rule)
  const dirty = text.trim() !== hero.aiRule.trim()
  return (
    <Section title="AI rule (Auto)">
      <p class="hr-rule__hint">
        Clauses are tried in order; split them with “;”. For example: <code>{HINT}</code>
      </p>
      <textarea
        class="hr-rule__text"
        data-testid="hr-rule-text"
        rows={4}
        maxLength={400}
        spellcheck={false}
        autocomplete="off"
        value={text}
        onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
      />
      {rule.errors.length > 0 ? (
        <ul class="hr-rule__list hr-bad" data-testid="hr-rule-errors">
          {rule.errors.map((e, i) => (
            <li key={i}>{cap1(e.reason)}.</li>
          ))}
        </ul>
      ) : (
        <ol class="hr-rule__list" data-testid="hr-rule-read">
          {rule.clauses.map((cl, i) => (
            <li key={i}>{clauseText(cl)}</li>
          ))}
        </ol>
      )}
      {missing.length > 0 && <p class="hr-note">Not in the active loadout, so never used: {missing.join(', ')}.</p>}
      <div class="hr-rule__actions">
        <Btn tone="primary" testid="hr-rule-save" disabled={!dirty || rule.errors.length > 0} onClick={() => act((_c, p) => setAiRule(p, hero.id, text.trim()), 'AI rule saved')}>
          Save
        </Btn>
        <Btn
          testid="hr-rule-reset"
          disabled={text.trim() === cls.aiRuleDefault && hero.aiRule === cls.aiRuleDefault}
          onClick={() => {
            setText(cls.aiRuleDefault)
            act((_c, p) => setAiRule(p, hero.id, cls.aiRuleDefault), `Back to the ${cls.name}'s rule`)
          }}
        >
          Reset to the {cls.name}'s
        </Btn>
      </div>
    </Section>
  )
}

function cap1(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s
}

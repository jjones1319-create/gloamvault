import { Fragment } from 'preact'
import type { Content } from '../../../../../sim/src/content.ts'
import { heroCardStats } from '../../../../../sim/src/hero.ts'
import type { AttributeMods, ClassDef, PetDef, SkillDef, SpeciesDef } from '../../../../../sim/src/types/content.ts'
import { ATTRIBUTES, type Attribute, type DerivedStat } from '../../../../../sim/src/types/enums.ts'
import { Btn, Chip, Stat, Tile } from '../../kit/kit.tsx'
import {
  ARMOR_NAME,
  ATTRIBUTE_NAME,
  ATTRIBUTE_SHORT,
  POOL_NAME,
  STANCE_NAME,
  STAT_NAME,
  cap,
  formatStat,
  requirementText,
  skillMeta,
  stanceLine,
} from '../hero/labels.ts'
import {
  NAME_MAX,
  STARTER_PICKS,
  baseAttribute,
  canAddPoint,
  draftKit,
  eggOptions,
  kitChoices,
  firstSentence,
  modParts,
  pointsSpent,
  provisionalHero,
  roleShort,
  skillOptions,
  type Draft,
  type FreePoints,
  type KitChoice,
} from './draft.ts'

/** The six steps of the new-hero screen (03 §2.3); NewHero.tsx owns the state and the Back / Next bar. */

/** "End +2 · Vit +1 · Agi −2", ups in green and downs in red. */
export function ModLine({ mods, class: cls = '' }: { mods: AttributeMods; class?: string }) {
  const parts = modParts(mods)
  if (parts.length === 0) return <span class={`nh-mods ${cls}`}>No changes</span>
  // The separators are plain text between the no-wrap parts, so a long line (the Draconid's five) breaks between parts.
  return (
    <span class={`nh-mods ${cls}`}>
      {parts.map((m, i) => (
        <Fragment key={m.attr}>
          {i > 0 ? ' · ' : null}
          <span class={m.value > 0 ? 'nh-up' : 'nh-down'}>
            {ATTRIBUTE_SHORT[m.attr]} {m.value > 0 ? `+${m.value}` : `−${-m.value}`}
          </span>
        </Fragment>
      ))}
    </span>
  )
}

/* ---------- 1. species ---------- */

export function SpeciesStep({ c, selected, onPick, shut, legacy }: { c: Content; selected: string | null; onPick: (id: string) => void; shut: string | null; legacy: string | null }) {
  const sel = selected ? c.species.get(selected) : undefined
  const full = shut
  return (
    <>
      {shut ? (
        <p class="nh-hint nh-hint--bad" data-testid="nh-roster-full">
          {shut}
        </p>
      ) : (
        <p class="nh-hint">
          Choose a species. It sets the body and the starting attributes.
          {legacy && (
            <span class="nh-hint__legacy" data-testid="nh-legacy">
              {' '}
              {legacy}
            </span>
          )}
        </p>
      )}
      <div class="nh-pick">
        <div class="nh-pick__grid">
          {[...c.species.values()].map((s) => (
            <Tile key={s.id} title={s.name} selected={s.id === selected} disabled={full !== null} testid={`nh-species-${s.id}`} onClick={() => onPick(s.id)}>
              <ModLine mods={s.attributeMods} class="nh-tile__line" />
            </Tile>
          ))}
        </div>
        <div class="nh-detail">{sel ? <SpeciesDetail s={sel} /> : <p class="nh-detail__empty">Tap a species to read about it.</p>}</div>
      </div>
    </>
  )
}

function SpeciesDetail({ s }: { s: SpeciesDef }) {
  return (
    <>
      <div class="nh-detail__head">
        <h2 class="nh-detail__name">{s.name}</h2>
        <ModLine mods={s.attributeMods} />
      </div>
      <p class="nh-detail__blurb">{s.creationBlurb}</p>
      <p class="nh-chiprow">
        {s.chips.pros.map((x) => (
          <Chip key={x} tone="good">
            {x}
          </Chip>
        ))}
      </p>
      <p class="nh-chiprow">
        {s.chips.cons.map((x) => (
          <Chip key={x} tone="bad">
            {x}
          </Chip>
        ))}
      </p>
      <ul class="nh-traits">
        {s.traits.map((t) => (
          <li key={t.id}>
            <b>{t.name}.</b> {t.description}
          </li>
        ))}
      </ul>
    </>
  )
}

/* ---------- 2. class ---------- */

export function ClassStep({ c, selected, onPick, kit, onKit }: { c: Content; selected: string | null; onPick: (id: string) => void; kit: string | null; onKit: (kit: KitChoice) => void }) {
  const sel = selected ? c.classes.get(selected) : undefined
  return (
    <>
      <p class="nh-hint">Choose a class. It sets the gear, the skills and the job in the party.</p>
      <div class="nh-pick">
        <div class="nh-pick__grid">
          {[...c.classes.values()].map((k) => (
            <Tile key={k.id} title={k.name} sub={cap(roleShort(k.role))} selected={k.id === selected} testid={`nh-class-${k.id}`} onClick={() => onPick(k.id)}>
              <span class="nh-tile__line">
                {POOL_NAME[k.pool]} · {ARMOR_NAME[k.armorFamily]}
              </span>
            </Tile>
          ))}
        </div>
        <div class="nh-detail">
          {sel ? (
            <>
              <ClassDetail k={sel} />
              <KitPicker c={c} k={sel} kit={kit} onKit={onKit} />
            </>
          ) : (
            <p class="nh-detail__empty">Tap a class to read about it.</p>
          )}
        </div>
      </div>
    </>
  )
}

function ClassDetail({ k }: { k: ClassDef }) {
  return (
    <>
      <div class="nh-detail__head">
        <h2 class="nh-detail__name">{k.name}</h2>
        <span class="nh-detail__tag">
          {POOL_NAME[k.pool]} · {ARMOR_NAME[k.armorFamily]} armor · <ModLine mods={k.attributeMods} />
        </span>
      </div>
      <p class="nh-detail__blurb">{firstSentence(k.description)}</p>
      <div class="nh-proscons">
        <div>
          <h3 class="nh-detail__sub nh-up">Good at</h3>
          <ul class="nh-list">
            {k.pros.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 class="nh-detail__sub nh-down">Watch out</h3>
          <ul class="nh-list">
            {k.cons.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}

/**
 * The starting kit (D-099, 08 §12): the town sells no weapons, so a class with a second build offers it here — the
 * Warden's spear beside sword-and-shield, the Blade's greatsword beside the two blades. Picking a kit picks its three
 * recommended skills too (the skills step can change them).
 */
function KitPicker({ c, k, kit, onKit }: { c: Content; k: ClassDef; kit: string | null; onKit: (kit: KitChoice) => void }) {
  const kits = kitChoices(c, k.id)
  if (kits.length < 2) return null
  return (
    <div class="nh-kits">
      <h3 class="nh-detail__sub">Starting kit</h3>
      <div class="nh-kits__row">
        {kits.map((choice) => {
          const weapons = choice.itemIds
            .map((id) => c.items.get(id))
            .filter((d) => d && (d.slot === 'mainHand' || d.slot === 'offHand'))
            .map((d) => d!.name)
            .join(' + ')
          return (
            <Tile key={choice.id ?? 'default'} title={choice.name} sub={weapons} selected={(choice.id ?? null) === (kit ?? null)} testid={`nh-kit-${choice.id ?? 'default'}`} onClick={() => onKit(choice)}>
              {choice.description && <span class="nh-skill__desc">{choice.description}</span>}
            </Tile>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- 3. skills ---------- */

export function SkillsStep({ c, cls, picked, onToggle }: { c: Content; cls: ClassDef; picked: readonly string[]; onToggle: (id: string) => void }) {
  const options = skillOptions(c, cls.id)
  return (
    <>
      <p class="nh-hint">
        Pick {STARTER_PICKS} skills to start with: <b data-testid="nh-skill-count">{picked.length} of {STARTER_PICKS}</b>. The rest are sold at the Skill Hall.
      </p>
      <div class="nh-schools">
        {cls.schools.map((school) => (
          <section key={school.id} class="nh-school">
            <h3 class="nh-school__name" title={school.philosophy}>
              {school.name}
            </h3>
            {options
              .filter((s) => s.school === school.id)
              .map((s) => (
                <SkillCard key={s.id} c={c} s={s} cls={cls} order={picked.indexOf(s.id)} onToggle={onToggle} />
              ))}
          </section>
        ))}
      </div>
    </>
  )
}

function SkillCard({ c, s, cls, order, onToggle }: { c: Content; s: SkillDef; cls: ClassDef; order: number; onToggle: (id: string) => void }) {
  const need = requirementText(s)
  return (
    <Tile title={s.name} sub={skillMeta(c.tuning, s, cls.pool)} selected={order >= 0} testid={`nh-skill-${s.id}`} onClick={() => onToggle(s.id)}>
      {order >= 0 && (
        <span class="nh-badge" aria-label={`pick ${order + 1}`}>
          {order + 1}
        </span>
      )}
      <span class="nh-skill__desc">{s.description}</span>
      {need && <span class="nh-skill__need">{need}</span>}
    </Tile>
  )
}

/* ---------- 4. egg ---------- */

export function EggStep({ c, selected, petName, onPick, onName }: { c: Content; selected: string | null; petName: string; onPick: (id: string) => void; onName: (name: string) => void }) {
  const eggs = eggOptions(c)
  const sel = eggs.find((p) => p.id === selected)
  return (
    <>
      <p class="nh-hint">Choose an egg. It hatches into your first pet: it fights beside you, levels with you and is never lost.</p>
      <div class="nh-eggs">
        {eggs.map((pet) => (
          <Tile key={pet.id} title={pet.name} sub={`Leans ${STANCE_NAME[pet.roleLean]}`} selected={pet.id === selected} testid={`nh-egg-${pet.id}`} onClick={() => onPick(pet.id)}>
            <span class="nh-egg__line">
              <b>{pet.trait.name}.</b> {pet.trait.description}
            </span>
            <span class="nh-egg__line nh-egg__dim">{stanceLine(c.tuning, pet.roleLean)}</span>
            <span class="nh-egg__line nh-egg__dim">{petActivesText(c, pet)}</span>
          </Tile>
        ))}
      </div>
      <label class="nh-field nh-field--row">
        <span class="nh-field__label">Pet name</span>
        <input
          class="nh-input"
          data-testid="nh-pet-name"
          type="text"
          maxLength={NAME_MAX}
          placeholder={sel?.name ?? 'Choose an egg first'}
          disabled={!sel}
          value={petName}
          autocomplete="off"
          spellcheck={false}
          enterKeyHint="done"
          onInput={(e) => onName((e.currentTarget as HTMLInputElement).value)}
        />
        <span class="nh-field__note">Optional: it keeps its kind's name otherwise.</span>
      </label>
    </>
  )
}

/** "Learns Bite at level 5." — only the actives an F-grade egg can ever use (03 §9: 1 / 2 / 3 by grade). */
function petActivesText(c: Content, pet: PetDef): string {
  const allowed = c.tuning.pets.activesByGrade.F
  const list = pet.actives.slice(0, allowed).map((a) => `${c.skills.get(a.skillId)?.name ?? a.skillId} at level ${a.unlockLevel}`)
  return list.length ? `Learns ${list.join(', ')}.` : ''
}

/* ---------- 5. points and name ---------- */

const PREVIEW_STATS: readonly DerivedStat[] = ['hp', 'defense', 'speed', 'detection']

export function PointsStep({
  c,
  draft,
  onPoints,
  onSuggest,
  onName,
  onNewName,
}: {
  c: Content
  draft: Draft
  onPoints: (attr: Attribute, delta: 1 | -1) => void
  onSuggest: () => void
  onName: (name: string) => void
  onNewName: () => void
}) {
  const t = c.tuning
  const species = draft.speciesId ? c.species.get(draft.speciesId) : undefined
  const cls = draft.classId ? c.classes.get(draft.classId) : undefined
  const points: FreePoints = draft.points
  const left = t.attributes.creation.freePoints - pointsSpent(points)
  const hero = provisionalHero(c, draft)
  const stats = hero ? heroCardStats(c, t, hero) : null
  const offence: DerivedStat = cls?.pool === 'mana' ? 'attackSpell' : 'attackPhys'
  const pool: DerivedStat = cls?.pool === 'mana' ? 'mana' : 'stamina'
  return (
    <>
      <p class="nh-hint">
        Place {t.attributes.creation.freePoints} free points, at most {t.attributes.creation.maxFreePerAttribute} on one. After this, attributes grow only by use.
      </p>
      <div class="nh-points">
        <div class="nh-attrs">
          {ATTRIBUTES.map((a) => {
            const free = points[a] ?? 0
            return (
              <div key={a} class="nh-attr">
                <span class="nh-attr__text">
                  <span class="nh-attr__name">{ATTRIBUTE_NAME[a]}</span>
                  <span class="nh-attr__hint">{SHORT_HINT[a]}</span>
                </span>
                <Btn class="nh-attr__btn" testid={`nh-point-${a}-minus`} disabled={free === 0} onClick={() => onPoints(a, -1)} title={`Take a point off ${ATTRIBUTE_NAME[a]}`}>
                  −
                </Btn>
                <span class={`nh-attr__value ${free > 0 ? 'nh-up' : ''}`} data-testid={`nh-attr-${a}`}>
                  {baseAttribute(t, species, cls, a) + free}
                  {free > 0 && <small class="nh-attr__free">+{free}</small>}
                </span>
                <Btn class="nh-attr__btn" testid={`nh-point-${a}-plus`} disabled={!canAddPoint(t, points, a)} onClick={() => onPoints(a, 1)} title={`Add a point to ${ATTRIBUTE_NAME[a]}`}>
                  +
                </Btn>
              </div>
            )
          })}
        </div>
        <div class="nh-side">
          <div class="nh-side__row">
            <span class="nh-left" data-testid="nh-points-left">
              <b>{left}</b> point{left === 1 ? '' : 's'} left
            </span>
            <Btn onClick={onSuggest} title="Spread the points over this class's best attributes">
              Suggest
            </Btn>
          </div>
          {stats && (
            <div class="stat-grid nh-preview">
              <Stat label={STAT_NAME[pool]} value={formatStat(pool, stats[pool])} />
              <Stat label={STAT_NAME[offence]} value={formatStat(offence, stats[offence])} />
              {PREVIEW_STATS.map((s) => (
                <Stat key={s} label={STAT_NAME[s]} value={formatStat(s, stats[s])} />
              ))}
            </div>
          )}
          <label class="nh-field">
            <span class="nh-field__label">Name</span>
            <span class="nh-field__row">
              <input
                class="nh-input"
                data-testid="nh-name"
                type="text"
                maxLength={NAME_MAX}
                value={draft.name}
                autocomplete="off"
                spellcheck={false}
                enterKeyHint="done"
                onInput={(e) => onName((e.currentTarget as HTMLInputElement).value)}
              />
              <Btn class="nh-reroll" onClick={onNewName} title="Suggest another name" testid="nh-name-new">
                ↻
              </Btn>
            </span>
          </label>
        </div>
      </div>
    </>
  )
}

/** The attribute hints, short enough for a stepper row (03 §2.1's headlines). */
const SHORT_HINT: Readonly<Record<Attribute, string>> = {
  strength: 'Weapon Attack',
  agility: 'Speed: more turns',
  vitality: 'HP',
  endurance: 'Defense, Stamina',
  wisdom: 'Spells, Mana',
  perception: 'Spots traps',
  willpower: 'Resists statuses',
  luck: 'Crits and loot',
}

/* ---------- 6. review ---------- */

export function ReviewStep({ c, draft }: { c: Content; draft: Draft }) {
  const species = draft.speciesId ? c.species.get(draft.speciesId) : undefined
  const cls = draft.classId ? c.classes.get(draft.classId) : undefined
  const pet = draft.eggPetId ? c.pets.get(draft.eggPetId) : undefined
  const hero = provisionalHero(c, draft)
  if (!species || !cls || !pet || !hero) return <p class="nh-hint nh-hint--bad">Something is missing: go back a step.</p>
  const stats = heroCardStats(c, c.tuning, hero)
  const pool = cls.pool === 'mana' ? 'mana' : 'stamina'
  const offence = cls.pool === 'mana' ? 'attackSpell' : 'attackPhys'
  const petName = draft.petName.trim() || pet.name
  return (
    <>
      <p class="nh-hint">Check your hero. Tap a step above to change anything.</p>
      <div class="nh-review">
        <section class="nh-card">
          <h2 class="nh-card__name" data-testid="nh-review-name">
            {draft.name.trim()}
          </h2>
          <p class="nh-card__line">
            {species.name} {cls.name} · level 1 · {cap(roleShort(cls.role))}
          </p>
          <p class="nh-card__line">
            <span class="nh-card__key">Skills</span>
            {draft.skillIds.map((id) => c.skills.get(id)?.name ?? id).join(' · ')}
          </p>
          <p class="nh-card__line">
            <span class="nh-card__key">Pet</span>
            {petName === pet.name ? pet.name : `${petName} the ${pet.name}`} · leans {STANCE_NAME[pet.roleLean]}
          </p>
          <p class="nh-card__line">
            <span class="nh-card__key">Gear</span>
            {(draftKit(c, draft)?.itemIds ?? cls.starterKit)
              .map((id) => c.items.get(id))
              .filter((d) => d && d.slot && d.slot !== 'pet')
              .map((d) => d!.name)
              .join(', ')}
          </p>
        </section>
        <section class="nh-card">
          <div class="nh-review__attrs">
            {ATTRIBUTES.map((a) => (
              <span key={a} class="nh-review__attr">
                <span class="nh-review__attr-name">{ATTRIBUTE_SHORT[a]}</span>
                <b>{hero.attributes[a]}</b>
              </span>
            ))}
          </div>
          <div class="stat-grid">
            <Stat label="HP" value={stats.hp} />
            <Stat label={STAT_NAME[pool]} value={stats[pool]} />
            <Stat label={STAT_NAME[offence]} value={stats[offence]} />
            <Stat label="Defense" value={stats.defense} />
            <Stat label="Speed" value={stats.speed} />
            <Stat label="Detection" value={stats.detection} />
          </div>
        </section>
      </div>
    </>
  )
}

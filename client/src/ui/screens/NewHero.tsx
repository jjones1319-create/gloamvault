import { useState } from 'preact/hooks'
import { canChooseHero, chosenHero, isFirstHero, pendingChosenLegacy, type Profile } from '../../../../sim/src/town.ts'
import type { Content } from '../../../../sim/src/content.ts'
import { heroLevelForXp } from '../../../../sim/src/xp.ts'
import { content, createHero, hasSave, profile, startNewGame, toast } from '../../game/session.ts'
import { Btn, Empty, Page } from '../kit/kit.tsx'
import { buzz } from '../lib/haptics.ts'
import { navigate } from '../router.ts'
import {
  EMPTY_DRAFT,
  STEPS,
  STEP_LABEL,
  addPoint,
  cleanName,
  furthestStep,
  stepBlocker,
  suggestPoints,
  suggestedName,
  toggleSkill,
  type Draft,
} from './newhero/draft.ts'
import { ClassStep, EggStep, PointsStep, ReviewStep, SkillsStep, SpeciesStep } from './newhero/steps.tsx'
import './newhero.css'

/**
 * New hero (03 §2.3, 05 §6): a six-step stepper that fits the landscape phone — species, class, three Tier I skills,
 * the egg, six free points and a name, then a review and Create. Next opens when the step is done; the steps above
 * jump back to anything already chosen. This is the selection of D-090: it makes the player's chosen hero — the save's
 * first, or a new one once the chosen hero is gone (a legacy they left passes on at once). Only the first hero brings
 * an egg; every other party member comes from the Wayfarer Chest (D-091).
 */

/** Why the selection is shut, in words, or null when it is open (D-090). */
export function selectionShut(c: Content, p: Profile | null): string | null {
  if (!p || canChooseHero(c, p)) return null
  const chosen = chosenHero(p)
  if (chosen) return `${chosen.name} is your chosen hero and still lives. New party members come from the Wayfarer Chest at the Curio Merchant.`
  return `The Lantern Inn is full (${c.tuning.coop.rosterMax} heroes).`
}

/** The chosen hero's legacy waiting for the next one, in words, or null (D-090). */
export function legacyLine(c: Content, p: Profile | null): string | null {
  const legacy = p ? pendingChosenLegacy(p) : null
  if (!legacy) return null
  const level = heroLevelForXp(c.tuning, legacy.xp)
  return `${legacy.name}'s legacy waits: your new hero starts with ${legacy.xp} battle XP${level > 1 ? ` (level ${level})` : ''}.`
}
export function NewHeroScreen() {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  // Until the player touches them, the points follow the class's suggestion and the name the species' list.
  const [pointsTouched, setPointsTouched] = useState(false)
  const [nameTouched, setNameTouched] = useState(false)
  const [nameIndex, setNameIndex] = useState(0)

  const c = content.value
  const p = profile.value
  const back = hasSave() ? 'town' : 'title'
  if (!c) {
    return (
      <Page name="new-hero" title="New hero" back={back}>
        <Empty>Lighting the lanterns…</Empty>
      </Page>
    )
  }

  const cls = draft.classId ? c.classes.get(draft.classId) : undefined
  const effective: Draft = {
    ...draft,
    points: pointsTouched ? draft.points : suggestPoints(c.tuning, cls),
    name: nameTouched ? draft.name : suggestedName(draft.speciesId, nameIndex),
  }
  const shut = selectionShut(c, p)
  const firstHero = !p || isFirstHero(p)
  const ctx = { closed: shut !== null, firstHero }
  const stepId = STEPS[step] ?? 'species'
  const blocker = stepBlocker(c, stepId, effective, ctx)
  const furthest = furthestStep(c, effective, ctx)
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })

  const go = (i: number) => {
    if (i < 0 || i > furthest || i >= STEPS.length) return
    setStep(i)
  }

  const create = () => {
    if (stepBlocker(c, 'points', effective, ctx) !== null || !effective.speciesId || !effective.classId || (firstHero && !effective.eggPetId)) return
    if (!profile.value) startNewGame()
    // Actives first, so a recommended passive ends up last and can move to a passive slot cleanly.
    const skills = [...effective.skillIds].sort((a, b) => Number(c.skills.get(a)?.type === 'passive') - Number(c.skills.get(b)?.type === 'passive'))
    const petName = cleanName(effective.petName)
    const id = createHero({
      name: cleanName(effective.name),
      speciesId: effective.speciesId,
      classId: effective.classId,
      freePoints: effective.points,
      starterSkillIds: skills,
      eggPetId: firstHero ? effective.eggPetId : null,
      ...(petName && firstHero ? { petName } : {}),
    })
    if (!id) return
    navigate('town')
  }

  const summary = [
    effective.speciesId ? c.species.get(effective.speciesId)?.name : null,
    effective.classId ? c.classes.get(effective.classId)?.name : null,
    step >= STEPS.indexOf('points') || nameTouched ? cleanName(effective.name) : null,
  ].filter(Boolean)

  return (
    <Page
      name="new-hero"
      title="New hero"
      back={back}
      bodyClass="nh-body"
      right={
        <nav class="nh-steps" aria-label="Steps">
          {STEPS.map((s, i) => (
            <button
              key={s}
              class={`nh-steps__step ${i === step ? 'nh-steps__step--on' : i < step ? 'nh-steps__step--done' : ''}`}
              disabled={i > furthest}
              aria-current={i === step ? 'step' : undefined}
              data-testid={`nh-step-${s}`}
              onClick={() => {
                buzz()
                go(i)
              }}
            >
              <span class="nh-steps__n">{i + 1}</span>
              <span class="nh-steps__label">{STEP_LABEL[s]}</span>
            </button>
          ))}
        </nav>
      }
    >
      <div class="nh-stage" data-step={stepId} key={stepId}>
        {stepId === 'species' && (
          <SpeciesStep
            c={c}
            selected={draft.speciesId}
            shut={shut}
            legacy={legacyLine(c, p)}
            onPick={(id) => {
              set({ speciesId: id })
              setNameIndex(0)
            }}
          />
        )}
        {stepId === 'class' && (
          <ClassStep
            c={c}
            selected={draft.classId}
            onPick={(id) => {
              if (id === draft.classId) return
              set({ classId: id, skillIds: [...(c.classes.get(id)?.starterSkillIds ?? [])] })
            }}
          />
        )}
        {stepId === 'skills' && cls && (
          <SkillsStep
            c={c}
            cls={cls}
            picked={draft.skillIds}
            onToggle={(id) => {
              const next = toggleSkill(draft.skillIds, id)
              if (next) set({ skillIds: next })
              else toast('Three skills at most: tap one of yours to free a place.')
            }}
          />
        )}
        {stepId === 'egg' &&
          (firstHero ? (
            <EggStep c={c} selected={draft.eggPetId} petName={draft.petName} onPick={(id) => set({ eggPetId: id })} onName={(name) => set({ petName: name })} />
          ) : (
            <p class="nh-hint" data-testid="nh-no-egg">
              Only your first hero brings an egg. Your pets wait at the Stables: give one to this hero there.
            </p>
          ))}
        {stepId === 'points' && (
          <PointsStep
            c={c}
            draft={effective}
            onPoints={(attr, delta) => {
              setPointsTouched(true)
              set({ points: addPoint(c.tuning, effective.points, attr, delta) })
            }}
            onSuggest={() => {
              setPointsTouched(false)
              set({ points: {} })
            }}
            onName={(name) => {
              setNameTouched(true)
              set({ name })
            }}
            onNewName={() => {
              const nextIndex = nameIndex + 1
              setNameIndex(nextIndex)
              setNameTouched(true)
              set({ name: suggestedName(draft.speciesId, nextIndex) })
            }}
          />
        )}
        {stepId === 'review' && <ReviewStep c={c} draft={{ ...effective, name: cleanName(effective.name) }} />}
      </div>
      <footer class="nh-foot">
        <Btn testid="nh-back" disabled={step === 0} onClick={() => go(step - 1)}>
          ‹ Back
        </Btn>
        <p class="nh-foot__summary" data-testid="nh-summary">
          {summary.length ? summary.join(' · ') : 'Your new hero'}
          {blocker && stepId !== 'review' && <span class="nh-foot__todo"> · {blocker}</span>}
        </p>
        {stepId === 'review' ? (
          <Btn tone="primary" testid="nh-create" onClick={create}>
            Create hero
          </Btn>
        ) : (
          <Btn tone="primary" testid="nh-next" disabled={blocker !== null} onClick={() => go(step + 1)}>
            Next ›
          </Btn>
        )}
      </footer>
    </Page>
  )
}

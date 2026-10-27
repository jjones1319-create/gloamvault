import { useMemo, useState } from 'preact/hooks'
import { parseRule, type Action, type Clause, type Condition } from '../../../../../../sim/src/ai.ts'
import type { Content } from '../../../../../../sim/src/content.ts'
import type { Actor } from '../../../../../../sim/src/fight-types.ts'
import { setAiRule } from '../../../../../../sim/src/town.ts'
import { act, profile } from '../../../../game/session.ts'
import { Btn, Modal } from '../../../kit/kit.tsx'

/**
 * The AI rule editor (03 §3.6, D-060, D-079): the one line of gambits Auto plays a hero by. The text is parsed as it
 * is typed, so a clause the game cannot read shows at once with the reason; Save writes it to the hero in the save.
 * The delve in progress keeps the rule its heroes came in with (its replay depends on it), so a saved rule applies
 * from the next delve.
 */
export const RULE_SAVED_TEXT = 'Rule saved — it applies from the next delve'

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function conditionText(c: Condition): string {
  if (c.metric === 'status') return `${c.subject} ${c.cmp === '=' ? 'does not have' : 'has'} ${c.statusId ?? '?'}`
  const metric = c.metric === 'value' ? '' : `${c.metric === 'hp' ? 'HP' : c.metric} `
  return `${c.subject} ${metric}${c.cmp} ${c.value}${c.percent ? '%' : ''}`
}

function actionText(a: Action, skillName: (slot: number) => string | null): string {
  const on = a.target && a.target !== 'nearest' ? ` on ${a.target}` : ''
  switch (a.verb) {
    case 'basic':
      return `attack${on || ' the nearest enemy'}`
    case 'skill': {
      const name = skillName(Number(a.ref ?? '1') - 1)
      return `skill ${a.ref ?? '1'}${name ? ` (${name})` : ' (empty slot)'}${on}`
    }
    case 'ultimate':
      return `Ultimate${on}`
    case 'guard':
      return 'guard'
    case 'item':
      return `use ${a.ref ?? 'an item'}${on}`
    case 'swapRow':
      return 'swap row'
    case 'flee':
      return 'flee'
    case 'freeAlly':
      return 'free a held ally'
    case 'stance':
      return `pet stance ${a.ref ?? ''}`
    case 'named':
      return `${a.ref ?? ''}${on}`
  }
}

export function RuleEditor({ c, hero, onClose }: { c: Content; hero: Actor; onClose(): void }) {
  const h = hero.hero
  const classDef = h ? c.classes.get(h.classId) : undefined
  const saved = (h && profile.value?.heroes.find((r) => r.id === h.heroId)?.aiRule) ?? h?.aiRule ?? ''
  const [text, setText] = useState(saved)
  const rule = useMemo(() => parseRule(text), [text])
  const skills = (h?.actives ?? []).map((id) => (id ? (c.skills.get(id) ?? null) : null))
  const skillName = (slot: number) => skills[slot]?.name ?? null
  const unknownNames = rule.clauses
    .filter((cl) => cl.action.verb === 'named' && cl.action.ref)
    .map((cl) => cl.action.ref!)
    .filter((ref) => !skills.some((s) => s && (norm(s.name) === norm(ref) || s.id === norm(ref) || s.id.endsWith(`-${norm(ref)}`))))
  const save = () => {
    if (!h) return
    if (act((_c, p) => setAiRule(p, h.heroId, text.trim()), RULE_SAVED_TEXT)) onClose()
  }
  const lines = (cl: Clause, i: number) => (
    <li key={i}>{cl.conditions.length ? `If ${cl.conditions.map(conditionText).join(' and ')}: ${actionText(cl.action, skillName)}` : `Otherwise: ${actionText(cl.action, skillName)}`}</li>
  )
  return (
    <Modal
      title={`AI rule — ${hero.name}`}
      onClose={onClose}
      testid="fx-rule-editor"
      actions={
        <>
          <Btn tone="quiet" testid="fx-rule-reset" disabled={!classDef} onClick={() => classDef && setText(classDef.aiRuleDefault)}>
            Class default
          </Btn>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" testid="fx-rule-save" disabled={!text.trim() || text.trim() === saved.trim()} onClick={save}>
            Save
          </Btn>
        </>
      }
    >
      <p class="fx-rule__help">
        Auto plays {hero.name} by this line: the clauses are tried in order and the first that fits wins.
      </p>
      <textarea
        class="fx-rule__text"
        data-testid="fx-rule-text"
        rows={4}
        maxLength={400}
        spellcheck={false}
        autocomplete="off"
        value={text}
        onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
      />
      {rule.errors.length > 0 ? (
        <ul class="fx-rule__errors" data-testid="fx-rule-errors">
          {rule.errors.map((er, i) => (
            <li key={i}>
              “{er.text}”: {er.reason}
            </li>
          ))}
        </ul>
      ) : (
        <p class="fx-rule__ok">Reads fine.</p>
      )}
      {unknownNames.length > 0 && <p class="fx-rule__warn">Not in {hero.name}'s loadout (Auto skips these): {unknownNames.join(', ')}</p>}
      <p class="fx-rule__label">How the game reads it:</p>
      <ol class="fx-rule__read">{rule.clauses.map(lines)}</ol>
      <details class="fx-rule__words">
        <summary>The words it knows</summary>
        <p>
          <code>IF ally HP &lt; 40% THEN skill 1 on lowest ally; ELSE attack</code>
        </p>
        <p>
          Who: self, ally, lowest ally, allies, enemy, enemies, party, pet · What: HP, pool, momentum, count, level, status &lt;name&gt; · Do: attack, skill 1–4, ultimate, guard, item &lt;name&gt;, swap row, flee, free ally, stance &lt;fierce|guard|mend|forage&gt; or a skill's name · On: nearest, lowest ally, weakest / strongest / front / back / marked enemy, self, pet.
        </p>
      </details>
      <p class="fx-rule__note">This delve keeps the rule its heroes came in with; a saved rule applies from the next delve.</p>
    </Modal>
  )
}

/** `node tools/balance/check-starters.ts` — lists starter skills a class's or a wayfarer's starting kit cannot use (D-093). */
import { createHero } from '../../sim/src/hero.ts'
import { requirementProblem } from '../../sim/src/requirements.ts'
import { Rng } from '../../sim/src/rng.ts'
import { heroFromWayfarer } from '../../sim/src/wayfarers.ts'
import { loadContentDir } from '../sim/loadContent.ts'

const content = loadContentDir('content')
const t = content.tuning
let problems = 0
const check = (who: string, h: ReturnType<typeof createHero>) => {
  const main = h.equipment.mainHand ? content.items.get(h.equipment.mainHand.itemId) ?? null : null
  const off = h.equipment.offHand ? content.items.get(h.equipment.offHand.itemId) ?? null : null
  for (const k of h.skills) {
    const s = content.skills.get(k.skillId)
    if (!s) continue
    const p = requirementProblem(s, main, off)
    if (p) {
      problems++
      console.log(`${who}: ${s.name} ${p} (holds ${main?.name ?? 'nothing'} + ${off?.name ?? 'nothing'})`)
    }
  }
}
for (const cls of content.classes.values()) check(`class ${cls.id}`, createHero(content, t, Rng.fromSeed(1), { id: 'x', name: 'x', speciesId: 'human', classId: cls.id, eggPetId: null }))
for (const w of content.wayfarers.values()) check(`wayfarer ${w.id}`, heroFromWayfarer(content, t, Rng.fromSeed(1), w, 'x', 1))
console.log(problems ? `${problems} starter skill(s) the starting kit cannot use` : 'every starter skill works with its starting kit')

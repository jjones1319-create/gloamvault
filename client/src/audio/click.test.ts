import { describe, expect, it } from 'vitest'
import { clickSound } from './index.ts'

/** Phase 8 (pass A): which UI sound a click makes, read from the button the click landed on. */
describe('the UI sounds of a click', () => {
  const el = (attrs: Record<string, string>, classes: string[] = [], disabled = false) => {
    const node = {
      disabled,
      dataset: { testid: attrs['data-testid'] },
      classList: { contains: (c: string) => classes.includes(c) },
      getAttribute: (k: string) => attrs[k] ?? null,
      closest: () => node,
    }
    return node as unknown as Element
  }
  it('back, confirm, a heavy choice, a plain tap; nothing for a disabled button or a click on nothing', () => {
    expect(clickSound(el({ 'aria-label': 'Back' }, ['btn', 'btn--icon']))).toBe('ui-back')
    expect(clickSound(el({ 'data-testid': 'back' }))).toBe('ui-back')
    expect(clickSound(el({}, ['btn', 'btn--primary']))).toBe('ui-confirm')
    expect(clickSound(el({}, ['btn', 'btn--danger']))).toBe('ui-heavy')
    expect(clickSound(el({}, ['btn']))).toBe('ui-tap')
    expect(clickSound(el({}, ['btn'], true))).toBeNull()
    expect(clickSound(null)).toBeNull()
    expect(clickSound({ closest: () => null } as unknown as Element)).toBeNull()
  })
})

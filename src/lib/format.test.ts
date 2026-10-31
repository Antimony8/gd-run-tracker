import { describe, expect, it } from 'vitest'
import { countdown, daysUntil, parseQuickRun, validateRun } from './format'
import { themeVars } from './theme'

describe('daysUntil', () => {
  it('counts whole days', () => {
    expect(daysUntil('2026-11-07', '2026-10-31')).toBe(7)
    expect(daysUntil('2026-10-31', '2026-10-31')).toBe(0)
    expect(daysUntil('2026-10-30', '2026-10-31')).toBe(-1)
    // Across a daylight-saving change
    expect(daysUntil('2026-11-02', '2026-10-31')).toBe(2)
  })
})

describe('countdown', () => {
  it('reads naturally', () => {
    expect(countdown(1)).toBe('1 day left')
    expect(countdown(5)).toBe('5 days left')
    expect(countdown(0)).toBe('due today')
    expect(countdown(-1)).toBe('1 day overdue')
    expect(countdown(-3)).toBe('3 days overdue')
  })
})

describe('quick runs', () => {
  it('parses the usual shapes', () => {
    expect(parseQuickRun('25-75')).toEqual({ start: 25, end: 75 })
    expect(parseQuickRun('25.5 – 80%')).toEqual({ start: 25.5, end: 80 })
    expect(parseQuickRun('0 to 50')).toEqual({ start: 0, end: 50 })
    expect(parseQuickRun('hello')).toBeNull()
  })

  it('validates ranges', () => {
    expect(validateRun(0, 100)).toBeNull()
    expect(validateRun(50, 50)).not.toBeNull()
    expect(validateRun(-1, 20)).not.toBeNull()
  })
})

describe('themeVars', () => {
  it('builds every token, falling back on bad colors', () => {
    const vars = themeVars('#a81818')
    expect(Object.keys(vars)).toContain('--bg-2')
    expect(vars['--bg-2']).toMatch(/^hsl\(0\.0 /)
    expect(themeVars('nope')).toEqual(themeVars('#123fae'))
  })
})

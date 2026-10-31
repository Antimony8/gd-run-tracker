import { describe, expect, it } from 'vitest'
import { parseSheets, planImport, statusToImportAs } from './spreadsheetImport'
import { parseCsv, serialToISO } from './sheetReader'
import type { Level } from '../types'

// Shaped like a typical progress tracker: a title, a blurb, then headers on row 4.
const completions = {
  name: 'Completions',
  rows: [
    ['My Extreme Demon Completions'],
    ['Blue text = values you type in.'],
    [],
    ['Level', 'AREDL Rank (approx.)', 'Attempts', 'Best Before Completion', 'Playtime', 'Notes'],
    ['Bloodbath', 795, 15270, 94, '3 months', 'Learned ship here'],
    ['Acu', 1499, 29000, '96x2', '7-8 months', 'First extreme demon.'],
    [],
    ['Grind Type: New Hardest = a new personal hardest that took months.'],
    ['Add new completions in the empty rows above; Summary updates automatically.'],
  ],
}

const inProgress = {
  name: 'In Progress & Next',
  rows: [
    ['In Progress and Up Next'],
    [],
    ['Level', 'AREDL Rank', 'EDEL', 'Status', 'Best from 0', 'Best Runs', 'Attempts', 'Focus / Why'],
    ['Playing'],
    ['Yatagarasu', 392, 57.6, 'Playing', 43, '21-77, 53-100', 22000, 'Wave practice'],
    ['Next Up'],
    ['Sonic Wave', 382, 44.3, 'Next Up', null, null, null, 'Pure wave practice'],
    ['Considering Playing'],
    ['The Reaper', 435, 69.6, 'Considering'],
    ['Dropped'],
  ],
}

describe('parseSheets', () => {
  const rows = parseSheets([completions, { name: 'Summary', rows: [['Summary'], ['Total', 9]] }, inProgress])

  it('finds every level and skips titles, headings and footnotes', () => {
    expect(rows.map((r) => r.name)).toEqual(['Bloodbath', 'Acu', 'Yatagarasu', 'Sonic Wave', 'The Reaper'])
  })

  it('marks levels on a completions sheet as completed', () => {
    expect(rows[0]).toMatchObject({ as: 'completed', aredl: 795 })
    expect(rows[0].notes).toEqual(['Attempts: 15,270', 'Best Before Completion: 94%', 'Playtime: 3 months', 'Learned ship here'])
    expect(rows[1].notes).toContain('Best Before Completion: 96x2')
  })

  it('uses the status column and turns best runs into runs', () => {
    expect(rows[2]).toMatchObject({ as: 'progress', aredl: 392 })
    expect(rows[2].runs).toEqual([
      { start: 0, end: 43 },
      { start: 21, end: 77 },
      { start: 53, end: 100 },
    ])
    expect(rows[2].notes).toEqual(['EDEL: 57.6', 'Attempts: 22,000', 'Wave practice'])
    expect(rows[3].as).toBe('nextup')
    expect(rows[4]).toMatchObject({ as: 'nextup', status: 'Considering' })
    expect(rows[4].notes[0]).toBe('Status: Considering')
  })
})

describe('statusToImportAs', () => {
  it('understands common statuses', () => {
    expect(statusToImportAs('Beaten')).toBe('completed')
    expect(statusToImportAs('Plan to Play')).toBe('nextup')
    expect(statusToImportAs('Considering Playing')).toBe('nextup')
    expect(statusToImportAs('playing')).toBe('progress')
    expect(statusToImportAs('Yatagarasu')).toBeNull()
  })
})

describe('planImport', () => {
  it('matches existing levels by name and skips repeats', () => {
    const existing = [{ id: 'x', name: 'Bloodbath', creator: 'Riot' } as Level]
    const plans = planImport(parseSheets([completions, completions]), existing)
    expect(plans[0].existing?.id).toBe('x')
    expect(plans[1].existing).toBeUndefined()
    expect(plans.slice(2).every((p) => p.row.as === 'skip')).toBe(true)
  })
})

describe('sheet readers', () => {
  it('parses CSV with quotes', () => {
    expect(parseCsv('Level,Runs\n"Bloodbath","0-50, 40-100"\r\nAcu,12\n')).toEqual([
      ['Level', 'Runs'],
      ['Bloodbath', '0-50, 40-100'],
      ['Acu', 12],
    ])
  })

  it('converts Excel date serials', () => {
    expect(serialToISO(46326)).toBe('2026-10-31')
  })
})

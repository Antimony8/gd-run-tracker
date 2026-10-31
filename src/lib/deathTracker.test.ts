import { describe, expect, it } from 'vitest'
import {
  bestFromZero,
  bestRuns,
  onlineId,
  parseDTLevel,
  planDeathTrackerImport,
  readDeathTrackerFolder,
  runsToImport,
  topDeaths,
  baseName,
  combineSources,
  levelRuns,
} from './deathTracker'
import type { Level } from '../types'

// Shaped like the mod's own files (see StatsManager.cpp / DTTypes.cpp in abb2k/death-tracker).
const metadata = { levelName: 'Yatagarasu', attempts: 22000, difficulty: 6, sections: [], LinkedLevels: [] }
const general = {
  deaths: { '3': 400, '8': 1250, '12': 900, '43': 2, '100': 0 },
  runs: { '21-77': 3, '53-100': 1, '30-60': 9, '53-90': 4, bad: 1 },
  newBests: [3, 8, 12, 43],
  playtimeGeneral: { playtimeF0: 3_600_000_000_000, playtimeRuns: 1_800_000_000_000 },
  playtimePaused: { playtimeF0: 0, playtimeRuns: 0 },
  playtimeDead: { playtimeF0: 0, playtimeRuns: 0 },
}

describe('parseDTLevel', () => {
  const level = parseDTLevel('6508283', metadata, general, 12)!

  it('reads attempts, deaths, runs and playtime', () => {
    expect(level).toMatchObject({ gdLevelId: '6508283', name: 'Yatagarasu', attempts: 22000, sessions: 12, playtimeMs: 5_400_000 })
    expect(level.deaths).toEqual({ '3': 400, '8': 1250, '12': 900, '43': 2 })
    expect(level.runs).toHaveLength(4)
  })

  it('skips levels with nothing recorded', () => {
    expect(parseDTLevel('1', {}, {})).toBeNull()
  })

  it('finds the best from 0, the worst spots, and the runs worth keeping', () => {
    expect(bestFromZero(level.deaths)).toBe(43)
    expect(topDeaths(level.deaths)).toEqual([
      { percent: 8, count: 1250 },
      { percent: 12, count: 900 },
      { percent: 3, count: 400 },
    ])
    // 30-60 sits inside 21-77 and 53-90 inside 53-100, so they're dropped.
    expect(runsToImport(level).map((r) => `${r.start}-${r.end}`)).toEqual(['0-43', '21-77', '53-100'])
  })
})

describe('helpers', () => {
  it('reads online IDs from level keys', () => {
    expect(onlineId('6508283')).toBe('6508283')
    expect(onlineId('123-daily')).toBe('123')
    expect(onlineId('5-local')).toBeUndefined()
    expect(onlineId('42-editor')).toBeUndefined()
  })

  it('keeps one of identical runs', () => {
    expect(bestRuns([{ start: 10, end: 50, count: 1 }, { start: 10, end: 50, count: 2 }])).toHaveLength(1)
  })
})

describe('readDeathTrackerFolder', () => {
  const file = (path: string, body: unknown) => {
    const f = new File([JSON.stringify(body)], path.split('/').pop()!)
    Object.defineProperty(f, 'webkitRelativePath', { value: path })
    return f
  }

  it('groups files by level folder and ignores backups', async () => {
    const levels = await readDeathTrackerFolder([
      file('levels/6508283/metadata', metadata),
      file('levels/6508283/general.dt', general),
      file('levels/6508283/sessions/1730000000.dt', { lastPlayed: 1, sessionStartDate: 1, data: {} }),
      file('levels/6508283/sessions/1730100000.dt', { lastPlayed: 2, sessionStartDate: 2, data: {} }),
      file('levels/6508283/backups/1/general.dt', { deaths: { '99': 5 } }),
      file('levels/1-local/metadata', { levelName: 'Stereo Madness', attempts: 12 }),
      file('levels/1-local/general.dt', { deaths: { '100': 1 }, runs: {} }),
    ])
    expect(levels.map((l) => [l.key, l.name, l.sessions])).toEqual([
      ['6508283', 'Yatagarasu', 2],
      ['1-local', 'Stereo Madness', 0],
    ])
    expect(levels[0].deaths['99']).toBeUndefined()
  })
})

describe('planDeathTrackerImport', () => {
  const levels = [
    { id: 'yata', name: 'Yatagarasu', gdLevelId: '6508283' },
    { id: 'bb', name: 'Bloodbath' },
    { id: 'sm', name: 'Stereo Madness' },
    { id: 'linked', name: 'Tartarus', deathStats: { sources: { '777-editor': {} }, importedAt: 0 } },
  ] as unknown as Level[]
  const dt = (key: string, name: string) => parseDTLevel(key, { levelName: name, attempts: 5 }, {})!

  it('matches by ID, earlier links and names, including editor copies', () => {
    const plans = planDeathTrackerImport(
      [
        parseDTLevel('6508283', metadata, general)!,
        dt('101-editor', 'bloodbath start pos'),
        dt('102-editor', 'Bloodbath Copy 2'),
        dt('103-editor', 'BLOODBATH (SP)'),
        dt('1-local', 'Stereo Madness'),
        dt('777-editor', 'tart practice'),
        dt('999', 'Something Else'),
      ],
      levels,
    )
    const byKey = Object.fromEntries(plans.map((p) => [p.dt.key, [p.suggested?.levelId, p.suggested?.reason, p.target]]))
    expect(byKey).toEqual({
      '6508283': ['yata', 'id', 'yata'],
      '101-editor': ['bb', 'name', 'bb'],
      '102-editor': ['bb', 'name', 'bb'],
      '103-editor': ['bb', 'name', 'bb'],
      '1-local': ['sm', 'name', 'sm'],
      '777-editor': ['linked', 'linked', 'linked'],
      '999': [undefined, undefined, 'skip'],
    })
  })

  it('strips copy words from names', () => {
    expect(baseName('Bloodbath Start Pos')).toBe('bloodbath')
    expect(baseName('bloodbath startpos copy 3')).toBe('bloodbath')
    expect(baseName('Sonic Wave (verify)')).toBe('sonicwave')
    expect(baseName('Acu')).toBe('acu')
  })
})

describe('combineSources', () => {
  it('adds a level and its copies together', () => {
    const total = combineSources({
      importedAt: 0,
      sources: {
        a: { name: 'Bloodbath', editor: false, deaths: { '50': 3, '100': 1 }, attempts: 100, playtimeMs: 10, sessions: 2 },
        b: { name: 'bloodbath sp', editor: true, deaths: { '50': 2, '60': 1 }, attempts: 40, playtimeMs: 5, sessions: 1 },
      },
    })
    expect(total).toEqual({ deaths: { '50': 5, '60': 1, '100': 1 }, attempts: 140, playtimeMs: 15, sessions: 3 })
  })
})

describe('levelRuns', () => {
  it('keeps the combined best from 0 and drops copies runs it covers', () => {
    const online = parseDTLevel('1', { levelName: 'Bloodbath', attempts: 1 }, { deaths: { '94': 1, '20': 5 } })!
    const sp = parseDTLevel('2-editor', { levelName: 'bloodbath sp', attempts: 1 }, { deaths: { '45': 3 }, runs: { '40-80': 1, '75-100': 2, '45-60': 9 } })!
    const copy = parseDTLevel('3-editor', { levelName: 'bloodbath copy', attempts: 1 }, { deaths: { '60': 1 }, runs: { '10-50': 1 } })!
    const total = combineSources({ importedAt: 0, sources: { a: { ...online }, b: { ...sp }, c: { ...copy } } })
    const runs = levelRuns([online, sp, copy], total.deaths).map(({ run, from }) => `${run.start}-${run.end}@${from.name}`)
    // 40-80 and 10-50 sit inside 0-94, and 45-60 inside 40-80.
    expect(runs).toEqual(['0-94@Bloodbath', '75-100@bloodbath sp'])
  })
})

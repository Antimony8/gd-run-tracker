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
  it('matches by level ID, then by name for levels without one', () => {
    const levels = [
      { id: 'a', name: 'Yata', gdLevelId: '6508283' },
      { id: 'b', name: 'Stereo Madness' },
    ] as Level[]
    const plans = planDeathTrackerImport(
      [parseDTLevel('6508283', metadata, general)!, parseDTLevel('1-local', { levelName: 'Stereo Madness', attempts: 3 }, {})!, parseDTLevel('999', { levelName: 'Other', attempts: 5 }, {})!],
      levels,
    )
    expect(plans.map((p) => [p.dt.key, p.existing?.id, p.action])).toEqual([
      ['6508283', 'a', 'update'],
      ['1-local', 'b', 'update'],
      ['999', undefined, 'skip'],
    ])
  })
})

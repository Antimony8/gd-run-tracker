import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearListCache, difficultyFromStars, findOnAredlByName, fromGDBrowser, fromGDHistory, listRank, lookupLevel, pointercrateSection } from './levelInfo'

type Routes = Record<string, unknown | ((url: string) => Response)>

/** Stubs fetch: each route maps a URL prefix to a JSON body, a Response factory, or 'down'. */
function mockFetch(routes: Routes) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const key = Object.keys(routes).find((k) => url.startsWith(k))
      const route = key === undefined ? 'down' : routes[key]
      if (route === 'down') throw new TypeError('Failed to fetch')
      if (typeof route === 'function') return route(url)
      return new Response(JSON.stringify(route), { status: 200 })
    }),
  )
}

const notFound = () => new Response('Not found', { status: 404 })

afterEach(() => {
  vi.unstubAllGlobals()
  clearListCache()
})

describe('parsers', () => {
  it('reads GDBrowser levels', () => {
    expect(fromGDBrowser({ name: 'Bloodbath', author: 'Riot', difficulty: 'Extreme Demon' })).toEqual({
      name: 'Bloodbath',
      creator: 'Riot',
      difficulty: 'Extreme Demon',
    })
    expect(fromGDBrowser(-1)).toBeNull()
    expect(fromGDBrowser({ difficulty: 'Hard' })).toBeNull()
  })

  it('maps unknown GDBrowser difficulties to Unrated', () => {
    expect(fromGDBrowser({ name: 'x', difficulty: 'N/A' })?.difficulty).toBe('Unrated')
  })

  it('reads GDHistory records', () => {
    expect(fromGDHistory({ cache_level_name: 'Stereo Madness', cache_username: 'RobTop', cache_stars: 1 })).toEqual({
      name: 'Stereo Madness',
      creator: 'RobTop',
      difficulty: 'Auto',
    })
    expect(fromGDHistory({ cache_level_name: 'Tartarus', cache_stars: 10, cache_demon: true, cache_demon_type: 6 })?.difficulty).toBe(
      'Extreme Demon',
    )
  })

  it('turns star counts into difficulties', () => {
    expect([0, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => difficultyFromStars(s))).toEqual([
      'Unrated',
      'Easy',
      'Normal',
      'Hard',
      'Hard',
      'Harder',
      'Harder',
      'Insane',
      'Insane',
    ])
    expect(difficultyFromStars(10, 3)).toBe('Easy Demon')
    expect(difficultyFromStars(10)).toBe('Hard Demon')
  })

  it('names Pointercrate sections', () => {
    expect([1, 75, 76, 150, 151].map(pointercrateSection)).toEqual(['Main', 'Main', 'Extended', 'Extended', 'Legacy'])
  })

  it('prefers the AREDL rank', () => {
    expect(listRank({ aredl: 4, pointercrate: 3, checkedAt: 0 })).toBe(4)
    expect(listRank({ aredl: null, pointercrate: 3, checkedAt: 0 })).toBe(3)
    expect(listRank(undefined)).toBeNull()
  })
})

describe('lookupLevel', () => {
  it('uses GDBrowser and both demon lists', async () => {
    mockFetch({
      'https://gdbrowser.com/api/level/': { name: 'Tidal Wave', author: 'OniLinkGD', difficulty: 'Extreme Demon' },
      'https://gdbrowser.com/api/search/': [],
      'https://history.geometrydash.eu/': 'down',
      'https://pointercrate.com/': [{ position: 2, name: 'Tidal Wave', publisher: { name: 'OniLinkGD' } }],
      'https://api.aredl.net/v2/api/aredl/levels/': { position: 3, name: 'Tidal Wave' },
    })
    const res = await lookupLevel('86407629')
    expect(res.info).toEqual({ name: 'Tidal Wave', creator: 'OniLinkGD', difficulty: 'Extreme Demon' })
    expect(res.source).toBe('GDBrowser')
    expect(res.ranks).toMatchObject({ pointercrate: 2, aredl: 3 })
  })

  it('falls back to GDBrowser search, then GDHistory', async () => {
    mockFetch({
      'https://gdbrowser.com/api/level/': 'down',
      'https://gdbrowser.com/api/search/': [
        { id: '999', name: 'Wrong', author: 'x', difficulty: 'Easy' },
        { id: '128', name: '1st level', author: 'y', difficulty: 'Normal' },
      ],
      'https://pointercrate.com/': [],
      'https://api.aredl.net/': notFound,
    })
    const res = await lookupLevel('128')
    expect(res.info?.name).toBe('1st level')
    expect(res.ranks).toMatchObject({ pointercrate: null, aredl: null })

    mockFetch({
      'https://history.geometrydash.eu/': { cache_level_name: 'Old Level', cache_username: 'z', cache_stars: 3 },
    })
    const fromHistory = await lookupLevel('128')
    expect(fromHistory.info).toEqual({ name: 'Old Level', creator: 'z', difficulty: 'Normal' })
    expect(fromHistory.source).toBe('GDHistory')
    // Lists that couldn't be reached are left unknown, not marked "not listed".
    expect(fromHistory.ranks.pointercrate).toBeUndefined()
  })

  it('uses demon list data when the level servers are down', async () => {
    mockFetch({
      'https://api.aredl.net/v2/api/aredl/levels/': { position: 12, name: 'Slaughterhouse', publisher: { global_name: 'icedcave' } },
      'https://pointercrate.com/': [],
    })
    const res = await lookupLevel('76196976')
    expect(res.info).toEqual({ name: 'Slaughterhouse', creator: 'icedcave', difficulty: 'Extreme Demon' })
    expect(res.source).toBe('AREDL')
  })

  it('scans the full AREDL list if the single-level endpoint fails', async () => {
    mockFetch({
      'https://api.aredl.net/v2/api/aredl/levels/': () => new Response('oops', { status: 500 }),
      'https://api.aredl.net/v2/api/aredl/levels': [
        { position: 7, level_id: 555, two_player: true },
        { position: 8, level_id: 555, two_player: false },
      ],
    })
    const res = await lookupLevel('555')
    expect(res.ranks.aredl).toBe(8)
  })

  it('reports nothing found when every service is down', async () => {
    mockFetch({})
    const res = await lookupLevel('1')
    expect(res.info).toBeNull()
    expect(res.source).toBeNull()
  })
})

describe('findOnAredlByName', () => {
  it('matches names loosely and skips 2-player versions', async () => {
    mockFetch({
      'https://api.aredl.net/v2/api/aredl/levels': [
        { position: 380, name: 'Sonic Wave', level_id: 26681070, two_player: true },
        { position: 382, name: 'Sonic Wave', level_id: 26681070, two_player: false },
        { position: 392, name: 'Yatagarasu', level_id: 6508283, two_player: false },
      ],
    })
    const found = await findOnAredlByName(['sonic wave', 'YATAGARASU', 'Not A Level'])
    expect(found.get('sonic wave')).toEqual({ gdLevelId: '26681070', position: 382 })
    expect(found.get('YATAGARASU')?.position).toBe(392)
    expect(found.has('Not A Level')).toBe(false)
  })
})

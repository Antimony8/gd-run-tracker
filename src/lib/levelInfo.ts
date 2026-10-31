import { DIFFICULTIES, type Difficulty, type ListRanks } from '../types'

export interface GDLevelInfo {
  name: string
  creator: string
  difficulty: Difficulty
}

export interface LookupResult {
  info: GDLevelInfo | null
  /** Which service the info came from, for the status message. */
  source: string | null
  ranks: ListRanks
}

const TIMEOUT_MS = 8000

class NotFound extends Error {}

/** GETs JSON with a timeout. Throws NotFound on 404 so callers can tell "missing" from "down". */
async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (res.status === 404) throw new NotFound(url)
    if (!res.ok) throw new Error(`${url} returned ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

export function toDifficulty(value: unknown): Difficulty {
  const v = String(value ?? '').toLowerCase()
  return DIFFICULTIES.find((d) => d.toLowerCase() === v) ?? 'Unrated'
}

// In-game demon type codes, as the GD servers send them.
const DEMON_TYPES: Record<number, Difficulty> = {
  3: 'Easy Demon',
  4: 'Medium Demon',
  0: 'Hard Demon',
  5: 'Insane Demon',
  6: 'Extreme Demon',
}

/** Difficulty from a rated level's star count (and demon type for 10★ levels). */
export function difficultyFromStars(stars: number, demonType?: number): Difficulty {
  if (stars >= 10) return DEMON_TYPES[demonType ?? -1] ?? 'Hard Demon'
  if (stars <= 0) return 'Unrated'
  if (stars === 1) return 'Auto'
  if (stars === 2) return 'Easy'
  if (stars === 3) return 'Normal'
  if (stars <= 5) return 'Hard'
  if (stars <= 7) return 'Harder'
  return 'Insane'
}

/** Parses a GDBrowser level object. Returns null for its "-1" not-found reply. */
export function fromGDBrowser(data: unknown): GDLevelInfo | null {
  if (!isObj(data)) return null
  const name = str(data.name)
  if (!name) return null
  return { name, creator: str(data.author) ?? 'Unknown', difficulty: toDifficulty(data.difficulty) }
}

/** Parses a GDHistory level record, which caches the level's last-known details. */
export function fromGDHistory(data: unknown): GDLevelInfo | null {
  if (!isObj(data)) return null
  const name = str(data.cache_level_name)
  if (!name) return null
  const stars = Number(data.cache_stars) || 0
  const demonType = data.cache_demon_type == null ? undefined : Number(data.cache_demon_type)
  return {
    name,
    creator: str(data.cache_username) ?? 'Unknown',
    difficulty: data.cache_demon ? difficultyFromStars(10, demonType) : difficultyFromStars(stars),
  }
}

// Each source is tried at the same time; the first one in this order that answers wins.
const INFO_SOURCES: { name: string; fetch: (id: string) => Promise<GDLevelInfo | null> }[] = [
  {
    name: 'GDBrowser',
    fetch: async (id) => fromGDBrowser(await getJson(`https://gdbrowser.com/api/level/${id}`)),
  },
  {
    // The search endpoint uses a different game-server call, so it often works when the one above doesn't.
    name: 'GDBrowser',
    fetch: async (id) => {
      const data = await getJson(`https://gdbrowser.com/api/search/${id}`)
      const match = Array.isArray(data) ? data.find((l) => isObj(l) && String(l.id) === id) : null
      return fromGDBrowser(match)
    },
  },
  {
    name: 'GDHistory',
    fetch: async (id) => fromGDHistory(await getJson(`https://history.geometrydash.eu/api/v1/level/${id}/`)),
  },
]

interface ListEntry {
  position: number
  name?: string
  creator?: string
}

/** Pointercrate's demonlist. An empty list means the level isn't on it. */
async function pointercrate(id: string): Promise<ListEntry | null> {
  const data = await getJson(`https://pointercrate.com/api/v2/demons/listed/?level_id=${id}`)
  const demon = Array.isArray(data) ? data.find(isObj) : null
  if (!demon || typeof demon.position !== 'number') return null
  return {
    position: demon.position,
    name: str(demon.name),
    creator: isObj(demon.publisher) ? str(demon.publisher.name) : undefined,
  }
}

function fromAredl(level: unknown): ListEntry | null {
  if (!isObj(level) || typeof level.position !== 'number') return null
  const publisher = isObj(level.publisher) ? level.publisher : {}
  return {
    position: level.position,
    name: str(level.name),
    creator: str(publisher.global_name) ?? str(publisher.username),
  }
}

let aredlList: Promise<unknown> | null = null

/** Forgets the cached AREDL list so the next lookup fetches it again. */
export function clearListCache() {
  aredlList = null
}

/** The full AREDL list, fetched once per visit. */
function fetchAredlList(): Promise<unknown> {
  aredlList ??= getJson('https://api.aredl.net/v2/api/aredl/levels').catch((e) => {
    aredlList = null
    throw e
  })
  return aredlList
}

/** The All Rated Extreme Demons List. Falls back to scanning the full list if the single-level endpoint fails. */
async function aredl(id: string): Promise<ListEntry | null> {
  try {
    return fromAredl(await getJson(`https://api.aredl.net/v2/api/aredl/levels/${id}`))
  } catch (err) {
    if (err instanceof NotFound) return null
    const list = await fetchAredlList()
    if (!Array.isArray(list)) return null
    return fromAredl(list.find((l) => isObj(l) && String(l.level_id) === id && !l.two_player))
  }
}

/** undefined = couldn't reach the list, null = not on it. */
const settle = <T>(p: Promise<T | null>) => p.catch((err) => (err instanceof NotFound ? null : undefined))

/** Looks up a level's details and demon list positions by its in-game ID. */
export async function lookupLevel(id: string): Promise<LookupResult> {
  const [infos, pc, ar] = await Promise.all([
    Promise.all(INFO_SOURCES.map((s) => settle(s.fetch(id)))),
    settle(pointercrate(id)),
    settle(aredl(id)),
  ])

  const found = infos.findIndex((i) => i)
  let info = found >= 0 ? infos[found]! : null
  let source = found >= 0 ? INFO_SOURCES[found].name : null

  // The lists only hold extreme demons, so they can fill in when the level servers are down.
  const listed = ar ?? pc
  if (!info && listed?.name) {
    info = { name: listed.name, creator: listed.creator ?? 'Unknown', difficulty: 'Extreme Demon' }
    source = ar ? 'AREDL' : 'Pointercrate'
  }

  return { info, source, ranks: toRanks(pc, ar) }
}

function toRanks(pc: ListEntry | null | undefined, ar: ListEntry | null | undefined): ListRanks {
  const ranks: ListRanks = { checkedAt: Date.now() }
  if (pc !== undefined) ranks.pointercrate = pc?.position ?? null
  if (ar !== undefined) ranks.aredl = ar?.position ?? null
  return ranks
}

/** Fetches just the demon list positions, keeping old values for any list that can't be reached. */
export async function fetchListRanks(id: string, previous?: ListRanks): Promise<ListRanks> {
  const [pc, ar] = await Promise.all([settle(pointercrate(id)), settle(aredl(id))])
  const ranks = toRanks(pc, ar)
  return {
    pointercrate: ranks.pointercrate === undefined ? previous?.pointercrate : ranks.pointercrate,
    aredl: ranks.aredl === undefined ? previous?.aredl : ranks.aredl,
    checkedAt: ranks.checkedAt,
  }
}

/** The best known list position, preferring AREDL since it covers every rated extreme. */
export function listRank(ranks?: ListRanks): number | null {
  return ranks?.aredl ?? ranks?.pointercrate ?? null
}

/** Pointercrate's sections: 1–75 main, 76–150 extended, then legacy. */
export function pointercrateSection(position: number): string {
  if (position <= 75) return 'Main'
  if (position <= 150) return 'Extended'
  return 'Legacy'
}

const simplify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Looks levels up on the AREDL by name, for spreadsheets that don't have level IDs.
 * Returns the in-game ID and current position for each name it finds. Throws if the list can't be reached.
 */
export async function findOnAredlByName(names: string[]): Promise<Map<string, { gdLevelId: string; position: number }>> {
  const list = await fetchAredlList()
  const byName = new Map<string, { gdLevelId: string; position: number }>()
  if (Array.isArray(list)) {
    for (const l of list) {
      if (!isObj(l) || l.two_player || typeof l.position !== 'number' || l.level_id == null || !str(l.name)) continue
      const key = simplify(str(l.name)!)
      if (!byName.has(key)) byName.set(key, { gdLevelId: String(l.level_id), position: l.position })
    }
  }
  const found = new Map<string, { gdLevelId: string; position: number }>()
  for (const name of names) {
    const hit = byName.get(simplify(name))
    if (hit) found.set(name, hit)
  }
  return found
}

import { useEffect, useState, type CSSProperties } from 'react'
import type { Level } from '../types'

/**
 * Community thumbnails from the Level Thumbnails mod (levelthumbs.prevter.me). Sizes are
 * small, medium and high (1920x1080). Missing thumbnails return 404.
 */
export type ThumbSize = 'small' | 'medium' | 'high'

export const levelThumbUrl = (gdLevelId: string, size: ThumbSize = 'small') =>
  `https://levelthumbs.prevter.me/thumbnail/${encodeURIComponent(gdLevelId)}/${size}`

// url -> whether it loaded. Shared so each thumbnail is only checked once per visit.
const checked = new Map<string, Promise<boolean>>()

function canLoad(url: string): Promise<boolean> {
  let p = checked.get(url)
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = url
    })
    checked.set(url, p)
  }
  return p
}

/** The level's community thumbnail URL once it has loaded, or null if it has none (or no ID). */
export function useLevelThumb(gdLevelId: string | undefined, size: ThumbSize = 'small'): string | null {
  const url = gdLevelId ? levelThumbUrl(gdLevelId, size) : null
  const [loaded, setLoaded] = useState<string | null>(null)
  useEffect(() => {
    if (!url) return
    let live = true
    canLoad(url).then((ok) => live && ok && setLoaded(url))
    return () => {
      live = false
    }
  }, [url])
  return url && loaded === url ? url : null
}

/**
 * Class and style for a level's thumbnail background: your own color or image if you set one,
 * otherwise the community thumbnail when the level has an ID.
 */
export function useThumbBackground(level: Level, size: ThumbSize = 'small'): { className: string; style?: CSSProperties } {
  const t = level.thumbnail
  const auto = useLevelThumb(t ? undefined : level.gdLevelId, size)
  if (t?.kind === 'color') return { className: 'thumb-color', style: { '--thumb': t.color } as CSSProperties }
  if (t?.kind === 'image' && t.dataUrl) return { className: 'thumb-image', style: { '--thumb-img': `url("${t.dataUrl}")` } as CSSProperties }
  if (auto) return { className: 'thumb-image', style: { '--thumb-img': `url("${auto}")` } as CSSProperties }
  return { className: '' }
}

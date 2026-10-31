/** Uploads larger than this get a confirmation prompt. */
export const LARGE_VIDEO_BYTES = 500 * 1024 * 1024

/** Extracts a YouTube video ID from the common URL shapes, or returns null. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\.|^m\./, '')
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)
      if (m) return m[1]
    }
  } catch {
    // not a URL
  }
  return null
}

// twitter.com, x.com and the common "fix" mirrors people share to get previews in Discord.
const TWEET_HOSTS = new Set([
  'twitter.com',
  'mobile.twitter.com',
  'x.com',
  'fxtwitter.com',
  'vxtwitter.com',
  'fixupx.com',
  'fixvx.com',
])

/** Extracts the post ID from a Twitter/X link like x.com/user/status/123, or returns null. */
export function tweetId(url: string): string | null {
  try {
    const u = new URL(url)
    if (!TWEET_HOSTS.has(u.hostname.replace(/^www\./, ''))) return null
    return u.pathname.match(/^\/(?:[^/]+|i\/web)\/status(?:es)?\/(\d+)/)?.[1] ?? null
  } catch {
    return null
  }
}

/** Links that play inside the app rather than opening in a new tab. */
export const playsInApp = (url: string) => !!(youtubeId(url) || tweetId(url))

export function isValidUrl(text: string): boolean {
  try {
    const u = new URL(text)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function linkLabel(url: string): string {
  if (youtubeId(url)) return 'YouTube'
  if (tweetId(url)) return 'X'
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('medal.tv')) return 'Medal'
    return host
  } catch {
    return 'Link'
  }
}

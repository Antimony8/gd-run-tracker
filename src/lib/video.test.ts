import { describe, expect, it } from 'vitest'
import { linkLabel, playsInApp, tweetId, tweetVideoUrls, youtubeId } from './video'

describe('tweetId', () => {
  it('reads twitter.com, x.com and mirror links', () => {
    expect(tweetId('https://x.com/robtopgames/status/1234567890123456789')).toBe('1234567890123456789')
    expect(tweetId('https://twitter.com/someone/status/42?s=20')).toBe('42')
    expect(tweetId('https://mobile.twitter.com/someone/status/42/video/1')).toBe('42')
    expect(tweetId('https://fxtwitter.com/someone/status/42')).toBe('42')
    expect(tweetId('https://www.x.com/i/web/status/42')).toBe('42')
  })

  it('ignores other links', () => {
    expect(tweetId('https://x.com/someone')).toBeNull()
    expect(tweetId('https://example.com/a/status/42')).toBeNull()
    expect(tweetId('not a url')).toBeNull()
  })
})

describe('links', () => {
  it('labels and routes links', () => {
    expect(linkLabel('https://x.com/a/status/1')).toBe('X')
    expect(linkLabel('https://youtu.be/dQw4w9WgXcQ')).toBe('YouTube')
    expect(linkLabel('https://medal.tv/clips/abc')).toBe('Medal')
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(playsInApp('https://x.com/a/status/1')).toBe(true)
    expect(playsInApp('https://medal.tv/clips/abc')).toBe(false)
  })
})

describe('tweetVideoUrls', () => {
  it('reads v1 replies', () => {
    expect(
      tweetVideoUrls({ code: 200, tweet: { media: { videos: [{ url: 'https://video.twimg.com/a.mp4', type: 'video' }] } } }),
    ).toEqual(['https://video.twimg.com/a.mp4'])
  })

  it('reads v2 variants, best quality first, skipping playlists', () => {
    const reply = {
      status: {
        media: {
          videos: [
            {
              url: 'https://video.twimg.com/mid.mp4',
              variants: [
                { url: 'https://video.twimg.com/pl.m3u8', content_type: 'application/x-mpegURL' },
                { url: 'https://video.twimg.com/low.mp4', bitrate: 632000, content_type: 'video/mp4' },
                { url: 'https://video.twimg.com/high.mp4', bitrate: 2176000, content_type: 'video/mp4' },
              ],
            },
          ],
        },
      },
    }
    expect(tweetVideoUrls(reply)).toEqual([
      'https://video.twimg.com/high.mp4',
      'https://video.twimg.com/low.mp4',
      'https://video.twimg.com/mid.mp4',
    ])
  })

  it('returns nothing for posts without video', () => {
    expect(tweetVideoUrls({ tweet: { media: { photos: [{}] } } })).toEqual([])
    expect(tweetVideoUrls(null)).toEqual([])
  })
})

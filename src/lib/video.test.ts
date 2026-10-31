import { describe, expect, it } from 'vitest'
import { linkLabel, playsInApp, tweetId, youtubeId } from './video'

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

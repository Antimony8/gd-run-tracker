import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { db } from '../db'
import type { VideoRef } from '../types'
import { fetchTweetVideo, linkLabel, playsInApp, tweetId, youtubeId } from '../lib/video'
import { downloadFromDrive, driveCacheId, driveEnabled, ensureDriveAccess, hasDriveAccess, preloadDrive } from '../lib/googleDrive'

/** A button that plays an attached video: uploads, Drive videos and YouTube links in a modal, other links in a new tab. */
export function VideoButton({ video, title }: { video: VideoRef; title: string }) {
  const [open, setOpen] = useState(false)

  if (video.kind === 'link' && !playsInApp(video.url)) {
    return (
      <a className="chip" href={video.url} target="_blank" rel="noreferrer">
        ▶ {linkLabel(video.url)}
      </a>
    )
  }

  return (
    <>
      <button
        className="chip"
        onClick={() => {
          // Get Google's sign-in script ready before the Load button can be tapped.
          if (video.kind === 'drive') preloadDrive().catch(() => {})
          setOpen(true)
        }}
      >
        ▶ {video.kind === 'link' ? linkLabel(video.url) : 'Video'}
      </button>
      {open && <VideoModal video={video} title={title} onClose={() => setOpen(false)} />}
    </>
  )
}

function VideoModal({ video, title, onClose }: { video: VideoRef; title: string; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose} wide>
      {video.kind === 'upload' ? (
        <UploadedVideo videoId={video.videoId} />
      ) : video.kind === 'drive' ? (
        <DriveVideo fileId={video.fileId} name={video.name} />
      ) : tweetId(video.url) ? (
        <TweetVideo id={tweetId(video.url)!} url={video.url} title={title} />
      ) : (
        <div className="video-frame">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId(video.url)}?autoplay=1`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      )}
    </Modal>
  )
}

/**
 * A Twitter/X video. Plays the post's MP4 directly in the app when it can be found (via FxTwitter);
 * otherwise falls back to X's embedded post. A link out is always there too.
 */
function TweetVideo({ id, url, title }: { id: string; url: string; title: string }) {
  const [sources, setSources] = useState<string[] | null>(null)
  const [failed, setFailed] = useState(0)

  useEffect(() => {
    let live = true
    fetchTweetVideo(id).then((found) => live && setSources(found))
    return () => {
      live = false
    }
  }, [id])

  // If a video file won't play, try the next quality, then the embed.
  const src = sources?.[failed]
  return (
    <div className="tweet-embed">
      {sources === null ? (
        <p className="muted">Loading video…</p>
      ) : src ? (
        <div className="video-frame">
          <video key={src} src={src} controls autoPlay playsInline onError={() => setFailed((n) => n + 1)} />
        </div>
      ) : (
        <iframe
          src={`https://platform.twitter.com/embed/Tweet.html?id=${id}&theme=dark&dnt=true`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      )}
      <a className="text-link" href={url} target="_blank" rel="noreferrer">
        Open on X ↗
      </a>
    </div>
  )
}

/** Object URL for a blob in the videos table. `version` re-reads it after a download. */
function useStoredVideo(id: string, version = 0) {
  const [state, setState] = useState<{ url?: string; missing?: boolean }>({})
  useEffect(() => {
    let url: string | undefined
    let cancelled = false
    db.videos.get(id).then((v) => {
      if (cancelled) return
      if (!v) return setState({ missing: true })
      url = URL.createObjectURL(v.blob)
      setState({ url })
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [id, version])
  return state
}

function Player({ url }: { url: string }) {
  return (
    <div className="video-frame">
      <video src={url} controls autoPlay playsInline />
    </div>
  )
}

function UploadedVideo({ videoId }: { videoId: string }) {
  const state = useStoredVideo(videoId)
  if (state.missing) {
    return (
      <p className="hint warn">
        This video file isn't on this device. It was saved on the device it was added on, so watch it there, or edit the run
        and {driveEnabled ? 're-add it with "Save to my Google Drive" ticked (or use a YouTube or Medal link)' : 'use a YouTube or Medal link instead'}.
      </p>
    )
  }
  if (!state.url) return <p className="muted">Loading video…</p>
  return <Player url={state.url} />
}

/** Plays a Google Drive video from its local copy, downloading it first if this device doesn't have one. */
function DriveVideo({ fileId, name }: { fileId: string; name: string }) {
  const [version, setVersion] = useState(0)
  const state = useStoredVideo(driveCacheId(fileId), version)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const download = async () => {
    setError('')
    try {
      // Must run straight from the tap so Google's sign-in popup is allowed.
      await ensureDriveAccess()
      setStatus('Downloading from Google Drive… 0%')
      await downloadFromDrive(fileId, name, (p) => setStatus(`Downloading from Google Drive… ${Math.round(p * 100)}%`))
      setVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the video.")
    } finally {
      setStatus('')
    }
  }

  // Already signed in to Google this session? Then just fetch it.
  const autoLoad = state.missing && hasDriveAccess()
  useEffect(() => {
    if (autoLoad) download()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad])

  if (state.url) return <Player url={state.url} />
  if (!state.missing) return <p className="muted">Loading video…</p>
  return (
    <div className="drive-load">
      <p>This video is in your Google Drive. Load it to watch here; it's kept on this device afterwards.</p>
      {status ? (
        <p className="muted">{status}</p>
      ) : (
        <button className="gd-btn blue" onClick={download} onPointerEnter={() => preloadDrive().catch(() => {})}>
          ☁ Load from Google Drive
        </button>
      )}
      {error && <p className="hint warn">{error}</p>}
    </div>
  )
}

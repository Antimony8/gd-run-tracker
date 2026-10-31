import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { db } from '../db'
import type { VideoRef } from '../types'
import { linkLabel, youtubeId } from '../lib/video'

/** A button that plays an attached video: uploads and YouTube links in a modal, other links in a new tab. */
export function VideoButton({ video, title }: { video: VideoRef; title: string }) {
  const [open, setOpen] = useState(false)

  if (video.kind === 'link' && !youtubeId(video.url)) {
    return (
      <a className="chip" href={video.url} target="_blank" rel="noreferrer">
        ▶ {linkLabel(video.url)}
      </a>
    )
  }

  return (
    <>
      <button className="chip" onClick={() => setOpen(true)}>
        ▶ {video.kind === 'upload' ? 'Video' : 'YouTube'}
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

function UploadedVideo({ videoId }: { videoId: string }) {
  const [state, setState] = useState<{ url?: string; missing?: boolean }>({})

  useEffect(() => {
    let url: string | undefined
    let cancelled = false
    db.videos.get(videoId).then((v) => {
      if (cancelled) return
      if (!v) return setState({ missing: true })
      url = URL.createObjectURL(v.blob)
      setState({ url })
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [videoId])

  if (state.missing) {
    return (
      <p className="hint warn">
        This video file isn't on this device. Uploaded videos stay on the device they were added on (only links sync), so
        watch it there, or edit the run and use a YouTube or Medal link instead.
      </p>
    )
  }
  if (!state.url) return <p className="muted">Loading video…</p>
  return (
    <div className="video-frame">
      <video src={state.url} controls autoPlay />
    </div>
  )
}

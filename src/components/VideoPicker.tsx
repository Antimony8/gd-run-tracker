import { useEffect } from 'react'
import type { VideoRef } from '../types'
import { formatBytes } from '../lib/format'
import { LARGE_VIDEO_BYTES, isValidUrl } from '../lib/video'
import { driveEnabled, preloadDrive } from '../lib/googleDrive'

export type VideoChoice =
  | { mode: 'none' }
  | { mode: 'existing'; ref: VideoRef }
  | { mode: 'upload'; file: File | null; compress: boolean; drive: boolean }
  | { mode: 'link'; url: string }

export const initialChoice = (ref?: VideoRef): VideoChoice => (ref ? { mode: 'existing', ref } : { mode: 'none' })

/** Returns an error message if the choice can't be saved yet. */
export function choiceError(c: VideoChoice): string | null {
  if (c.mode === 'upload' && !c.file) return 'Pick a video file, or choose "None".'
  if (c.mode === 'link' && !isValidUrl(c.url.trim())) return 'Paste a full video link (starting with https://).'
  return null
}

interface Props {
  value: VideoChoice
  onChange: (c: VideoChoice) => void
  existing?: VideoRef
}

export function VideoPicker({ value, onChange, existing }: Props) {
  const tabs: { mode: VideoChoice['mode']; label: string }[] = [
    ...(existing ? [{ mode: 'existing' as const, label: 'Keep current' }] : []),
    { mode: 'none', label: existing ? 'Remove' : 'None' },
    { mode: 'upload', label: 'Upload' },
    { mode: 'link', label: 'Link' },
  ]

  const select = (mode: VideoChoice['mode']) => {
    if (mode === value.mode) return
    if (mode === 'existing' && existing) onChange({ mode, ref: existing })
    else if (mode === 'upload') onChange({ mode, file: null, compress: true, drive: driveEnabled })
    else if (mode === 'link') onChange({ mode, url: '' })
    else onChange({ mode: 'none' })
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (
      file.size > LARGE_VIDEO_BYTES &&
      !confirm(`This video is ${formatBytes(file.size)}. Large files fill up browser storage fast. Save it anyway?`)
    ) {
      return
    }
    if (value.mode === 'upload') onChange({ ...value, file })
  }

  // Load Google's sign-in script early, so tapping Save can open its popup straight away.
  const wantsDrive = value.mode === 'upload' && value.drive
  useEffect(() => {
    if (wantsDrive) preloadDrive().catch(() => {})
  }, [wantsDrive])

  return (
    <div className="field">
      <span className="field-label">Video</span>
      <div className="seg-tabs">
        {tabs.map((t) => (
          <button
            type="button"
            key={t.mode}
            className={value.mode === t.mode ? 'active' : ''}
            onClick={() => select(t.mode)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {value.mode === 'existing' && (
        <p className="hint">
          {value.ref.kind === 'upload'
            ? `Uploaded file (this device): ${value.ref.name}`
            : value.ref.kind === 'drive'
              ? `Google Drive: ${value.ref.name}`
              : `Link: ${value.ref.url}`}
        </p>
      )}

      {value.mode === 'upload' && (
        <label className="file-drop">
          <input type="file" accept="video/*" onChange={(e) => onFile(e.target.files?.[0])} />
          {value.file ? (
            <span>
              🎬 {value.file.name} <span className="muted">({formatBytes(value.file.size)})</span>
            </span>
          ) : (
            <span>Click to choose a video file</span>
          )}
        </label>
      )}

      {value.mode === 'upload' && (
        <div className="upload-options">
          <label className="check-row">
            <input type="checkbox" checked={value.compress} onChange={(e) => onChange({ ...value, compress: e.target.checked })} />
            <span>Compress to 720p (much smaller, faster to upload)</span>
          </label>
          {driveEnabled ? (
            <label className="check-row">
              <input type="checkbox" checked={value.drive} onChange={(e) => onChange({ ...value, drive: e.target.checked })} />
              <span>Save to my Google Drive so it plays on all my devices</span>
            </label>
          ) : (
            <p className="hint">Saved on this device only.</p>
          )}
        </div>
      )}

      {value.mode === 'link' && (
        <input
          type="url"
          placeholder="YouTube, X/Twitter or Medal link"
          value={value.url}
          onChange={(e) => onChange({ mode: 'link', url: e.target.value })}
        />
      )}
    </div>
  )
}

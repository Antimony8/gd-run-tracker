import { useState } from 'react'
import type { Thumbnail } from '../types'
import { THEME_PRESETS } from '../lib/theme'
import { imageToDataUrl } from '../lib/image'

interface SwatchProps {
  value: string | undefined
  onChange: (color: string | undefined) => void
  /** Label for the "no color" option, or omit to require a color. */
  noneLabel?: string
}

/** Preset color swatches plus a custom color input. */
export function ColorSwatches({ value, onChange, noneLabel }: SwatchProps) {
  const custom = value && !THEME_PRESETS.some((p) => p.color === value)
  return (
    <div className="swatches">
      {noneLabel && (
        <button type="button" className={`swatch none ${!value ? 'active' : ''}`} onClick={() => onChange(undefined)}>
          {noneLabel}
        </button>
      )}
      {THEME_PRESETS.map((p) => (
        <button
          type="button"
          key={p.color}
          className={`swatch ${value === p.color ? 'active' : ''}`}
          style={{ background: p.color }}
          title={p.name}
          aria-label={p.name}
          onClick={() => onChange(p.color)}
        />
      ))}
      <label className={`swatch custom ${custom ? 'active' : ''}`} title="Custom color" style={custom ? { background: value } : undefined}>
        <input type="color" value={value ?? '#123fae'} onChange={(e) => onChange(e.target.value)} />
        <span aria-hidden="true">+</span>
      </label>
    </div>
  )
}

export function ThumbnailPicker({ value, onChange }: { value?: Thumbnail; onChange: (t?: Thumbnail) => void }) {
  const [error, setError] = useState('')
  const mode = value?.kind ?? 'none'

  const onFile = async (file?: File) => {
    if (!file) return
    try {
      setError('')
      onChange({ kind: 'image', dataUrl: await imageToDataUrl(file) })
    } catch {
      setError("That image couldn't be read. Try a PNG or JPG.")
    }
  }

  return (
    <div className="field">
      <span className="field-label">Card thumbnail</span>
      <div className="seg-tabs">
        <button type="button" className={mode === 'none' ? 'active' : ''} onClick={() => onChange(undefined)}>
          None
        </button>
        <button
          type="button"
          className={mode === 'color' ? 'active' : ''}
          onClick={() => mode !== 'color' && onChange({ kind: 'color', color: THEME_PRESETS[1].color })}
        >
          Color
        </button>
        <button
          type="button"
          className={mode === 'image' ? 'active' : ''}
          onClick={() => mode !== 'image' && onChange({ kind: 'image', dataUrl: '' })}
        >
          Image
        </button>
      </div>
      {value?.kind === 'color' && (
        <ColorSwatches value={value.color} onChange={(c) => onChange({ kind: 'color', color: c ?? THEME_PRESETS[1].color })} />
      )}
      {value?.kind === 'image' && (
        <label className="file-drop thumb-drop">
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
          {value.dataUrl ? (
            <img src={value.dataUrl} alt="Thumbnail preview" />
          ) : (
            <span>Click to choose an image (a screenshot of the level works great)</span>
          )}
        </label>
      )}
      {error && <p className="hint warn">{error}</p>}
    </div>
  )
}

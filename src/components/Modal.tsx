import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

export function Modal({ title, onClose, children, wide }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('modal-open')
    }
  }, [onClose])

  // Rendered into <body> so a dialog opened from inside a panel isn't covered by the panels after it.
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal panel ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2 className="outlined">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

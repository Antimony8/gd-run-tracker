import { useEffect, useRef } from 'react'

/** True when a keypress should go to a text field or an open dialog instead of a shortcut. */
function isTyping(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true
  if (document.body.classList.contains('modal-open')) return true
  const el = e.target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

/** Runs handler when `key` is pressed outside text fields and dialogs. */
export function useShortcut(key: string, handler: () => void, enabled = true) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase() || isTyping(e)) return
      e.preventDefault()
      ref.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [key, enabled])
}

export const SHORTCUTS: { keys: string; what: string }[] = [
  { keys: '/', what: 'Search levels (on the levels page)' },
  { keys: 'A', what: 'Add a level (on the levels page)' },
  { keys: 'N', what: 'Log a new run (on a level page)' },
  { keys: 'Esc', what: 'Close a dialog' },
  { keys: '?', what: 'Show these shortcuts' },
]

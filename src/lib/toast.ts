import { useSyncExternalStore } from 'react'

export interface Toast {
  id: number
  text: string
  /** Optional button, e.g. Undo. Clicking it runs the action and closes the toast. */
  action?: { label: string; run: () => void | Promise<void> }
}

const TOAST_MS = 7000

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function showToast(text: string, action?: Toast['action']) {
  const toast = { id: nextId++, text, action }
  toasts = [...toasts.slice(-2), toast]
  emit()
  setTimeout(() => dismissToast(toast.id), TOAST_MS)
}

export function dismissToast(id: number) {
  if (!toasts.some((t) => t.id === id)) return
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => toasts,
  )
}

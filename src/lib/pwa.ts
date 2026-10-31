import { useSyncExternalStore } from 'react'

/** Chrome/Edge's install event. Not in TypeScript's DOM types yet. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

/** Registers the offline service worker (production builds only) and listens for the install prompt. */
export function setupPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // we show our own Install button in Settings
    deferred = e as InstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Offline support is a bonus; the app works fine without it.
      })
    })
  }
}

export function useInstallPrompt() {
  const canInstall = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => deferred !== null,
  )
  return {
    canInstall,
    installed: isStandalone(),
    prompt: async () => {
      if (!deferred) return
      await deferred.prompt()
      await deferred.userChoice
      deferred = null
      emit()
    },
  }
}

import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRoute, type Route } from './router'
import { db } from './db'
import { Library } from './pages/Library'
import { LevelPage } from './pages/LevelPage'
import { Settings } from './pages/Settings'
import { Toasts } from './components/Toasts'
import { Modal } from './components/Modal'
import { useSetting } from './lib/settings'
import { useShortcut, SHORTCUTS } from './lib/shortcuts'
import { DEFAULT_THEME, applyTheme } from './lib/theme'

export default function App() {
  const route = useRoute()
  const [help, setHelp] = useState(false)
  useShortcut('?', () => setHelp(true))
  useLevelTheme(route)

  return (
    <>
      <div className="bg-scene" aria-hidden="true">
        <div className="bg-tiles" />
        <div className="bg-glow" />
        <div className="bg-far" />
        <div className="bg-near" />
        <div className="bg-ground" />
      </div>
      {route.page === 'level' ? (
        <LevelPage key={route.id} id={route.id} />
      ) : route.page === 'settings' ? (
        <Settings />
      ) : (
        <Library />
      )}
      <Toasts />
      {help && (
        <Modal title="Keyboard Shortcuts" onClose={() => setHelp(false)}>
          <ul className="shortcut-list">
            {SHORTCUTS.map((s) => (
              <li key={s.keys}>
                <kbd>{s.keys}</kbd>
                <span>{s.what}</span>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  )
}

/** Uses the open level's own background color if it has one, otherwise the app theme. */
function useLevelTheme(route: Route) {
  const appTheme = useSetting('theme')
  const levelId = route.page === 'level' ? route.id : null
  const levelTheme = useLiveQuery(async () => (levelId ? (await db.levels.get(levelId))?.theme : undefined), [levelId])
  const color = levelTheme ?? appTheme ?? DEFAULT_THEME
  useEffect(() => applyTheme(color), [color])
}

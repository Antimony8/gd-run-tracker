import { useRoute } from './router'
import { Library } from './pages/Library'
import { LevelPage } from './pages/LevelPage'
import { Settings } from './pages/Settings'

export default function App() {
  const route = useRoute()
  return (
    <>
      <div className="bg-ground" aria-hidden="true" />
      {route.page === 'level' ? (
        <LevelPage key={route.id} id={route.id} />
      ) : route.page === 'settings' ? (
        <Settings />
      ) : (
        <Library />
      )}
    </>
  )
}

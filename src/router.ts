import { useEffect, useState } from 'react'

// Hash-based routing keeps the app working on GitHub Pages without server config.
export type Route = { page: 'library' } | { page: 'level'; id: string } | { page: 'settings' }

function parse(hash: string): Route {
  const path = hash.replace(/^#/, '')
  const level = path.match(/^\/level\/([^/]+)$/)
  if (level) return { page: 'level', id: decodeURIComponent(level[1]) }
  if (path === '/settings') return { page: 'settings' }
  return { page: 'library' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export const href = {
  library: '#/',
  level: (id: string) => `#/level/${encodeURIComponent(id)}`,
  settings: '#/settings',
}

export const navigate = (to: string) => {
  window.location.hash = to
}

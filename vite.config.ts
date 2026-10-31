import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

/** Emits sw.js with every built file and public file listed for offline precaching. */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = [...new Set(['./', 'index.html', ...Object.keys(bundle), ...readdirSync('public')])].filter(
        // Browsers that can run a service worker all use the .woff2 fonts, so skip the .woff copies.
        (f) => !f.endsWith('.map') && !f.endsWith('.woff'),
      )
      const name = `gd-run-tracker-${createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 10)}`
      const source = readFileSync('sw-template.js', 'utf8')
        .replace('__CACHE_NAME__', name)
        .replace('__PRECACHE__', JSON.stringify(files, null, 2))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// base: './' makes the build work from any folder, including a GitHub Pages project URL.
export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
})

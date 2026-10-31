import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base: './' makes the build work from any folder, including a GitHub Pages project URL.
export default defineConfig({
  base: './',
  plugins: [react()],
})

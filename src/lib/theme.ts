/** Background presets, named after the color triggers you'd see in a GD level. */
export const THEME_PRESETS: { name: string; color: string }[] = [
  { name: 'Classic Blue', color: '#123fae' },
  { name: 'Purple', color: '#5b21b6' },
  { name: 'Magenta', color: '#a3146f' },
  { name: 'Red', color: '#a81818' },
  { name: 'Orange', color: '#b4520c' },
  { name: 'Green', color: '#137a2a' },
  { name: 'Teal', color: '#0b7a7a' },
  { name: 'Midnight', color: '#1b1f3a' },
]

export const DEFAULT_THEME = THEME_PRESETS[0].color

function hexToHsl(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i)
  if (!m) return null
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const hsl = (h: number, s: number, l: number, a = 1) =>
  `hsl(${h.toFixed(1)} ${clamp(s, 0, 100).toFixed(1)}% ${clamp(l, 0, 100).toFixed(1)}% / ${a})`

/**
 * Builds the page's color tokens from one base color. The base becomes the middle of the
 * background gradient; everything else is lighter or darker shades of the same hue.
 */
export function themeVars(base: string): Record<string, string> {
  const [h, s, l] = hexToHsl(base) ?? hexToHsl(DEFAULT_THEME)!
  const sat = Math.max(s, 25)
  const mid = clamp(l, 14, 42)
  return {
    '--bg-1': hsl(h, sat, mid + 18),
    '--bg-2': hsl(h, sat, mid),
    '--bg-3': hsl(h, sat, mid * 0.5),
    '--ground': hsl(h, sat, mid * 0.6),
    '--ground-top': hsl(h, sat, mid + 8),
    '--panel': hsl(h, sat * 0.85, 11, 0.62),
    '--panel-solid': hsl(h, sat * 0.8, 20),
    '--modal-1': hsl(h, sat * 0.75, 28),
    '--modal-2': hsl(h, sat * 0.8, 18),
    '--muted': hsl(h, 100, 86),
    '--dim': hsl(h, 55, 72),
  }
}

export function applyTheme(base: string) {
  const root = document.documentElement
  for (const [k, v] of Object.entries(themeVars(base))) root.style.setProperty(k, v)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', base)
}

export const isHexColor = (v: string) => /^#[0-9a-f]{6}$/i.test(v)

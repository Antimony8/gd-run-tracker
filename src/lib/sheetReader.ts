import JSZip from 'jszip'

/** A cell's value. Dates come back as YYYY-MM-DD strings and percent cells as 0–100 numbers. */
export type CellValue = string | number | boolean | null

export interface Sheet {
  name: string
  rows: CellValue[][]
}

/** Reads an .xlsx workbook or a .csv file into plain rows of values. */
export async function readSpreadsheet(file: File): Promise<Sheet[]> {
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
    return [{ name: file.name.replace(/\.csv$/i, ''), rows: parseCsv(await file.text()) }]
  }
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new Error("That file isn't an Excel .xlsx or .csv file. In Excel or Google Sheets, save or download it as .xlsx.")
  }
  if (!zip.file('xl/workbook.xml')) {
    throw new Error("That doesn't look like an Excel workbook. Save it as .xlsx (not .xls or .numbers) and try again.")
  }
  return readXlsx(zip)
}

const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

async function xml(zip: JSZip, path: string): Promise<Document | null> {
  const text = await zip.file(path)?.async('string')
  return text ? new DOMParser().parseFromString(text, 'application/xml') : null
}

/** Elements by local name, ignoring XML namespace prefixes. */
const els = (root: Document | Element, name: string) => Array.from(root.getElementsByTagNameNS('*', name))

/** Text of a string item: plain <t>, or the runs of rich text. Skips phonetic hints. */
function itemText(si: Element): string {
  return els(si, 't')
    .filter((t) => t.parentElement?.localName !== 'rPh')
    .map((t) => t.textContent ?? '')
    .join('')
}

// Built-in number formats that are dates or percents.
const BUILTIN_DATES = new Set([14, 15, 16, 17, 22, 27, 30, 36, 50, 57])
const BUILTIN_PERCENTS = new Set([9, 10])

type Kind = 'date' | 'percent' | null

/** For each cell style index, whether it formats numbers as dates or percents. */
async function styleKinds(zip: JSZip): Promise<Kind[]> {
  const doc = await xml(zip, 'xl/styles.xml')
  if (!doc) return []
  const custom = new Map<number, string>()
  for (const f of els(doc, 'numFmt')) custom.set(Number(f.getAttribute('numFmtId')), f.getAttribute('formatCode') ?? '')
  const xfs = els(doc, 'cellXfs')[0]
  if (!xfs) return []
  return els(xfs, 'xf').map((xf) => {
    const id = Number(xf.getAttribute('numFmtId') ?? 0)
    if (BUILTIN_PERCENTS.has(id)) return 'percent'
    if (BUILTIN_DATES.has(id)) return 'date'
    // Drop quoted text and [color]/[locale] tags before looking at the format's characters.
    const code = (custom.get(id) ?? '').replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')
    if (code.includes('%')) return 'percent'
    if (/[dmy]/i.test(code) && !/^[#0.,\s]*$/.test(code)) return 'date'
    return null
  })
}

/** Excel's day serial (1900 date system) to YYYY-MM-DD. */
export function serialToISO(serial: number): string {
  const ms = Math.round((serial - 25569) * 86_400_000)
  return new Date(ms).toISOString().slice(0, 10)
}

/** "C12" -> 2 (zero-based column). */
function columnIndex(ref: string): number {
  let n = 0
  for (const ch of ref.replace(/\d+$/, '').toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

async function readXlsx(zip: JSZip): Promise<Sheet[]> {
  const [workbook, rels, shared, kinds] = await Promise.all([
    xml(zip, 'xl/workbook.xml'),
    xml(zip, 'xl/_rels/workbook.xml.rels'),
    xml(zip, 'xl/sharedStrings.xml'),
    styleKinds(zip),
  ])
  const strings = shared ? els(shared, 'si').map(itemText) : []
  const targets = new Map(rels ? els(rels, 'Relationship').map((r) => [r.getAttribute('Id'), r.getAttribute('Target') ?? '']) : [])

  const sheets: Sheet[] = []
  for (const s of workbook ? els(workbook, 'sheet') : []) {
    const target = targets.get(s.getAttributeNS(NS_REL, 'id') ?? s.getAttribute('r:id'))
    if (!target) continue
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`
    const doc = await xml(zip, path)
    if (!doc) continue

    const rows: CellValue[][] = []
    for (const row of els(doc, 'row')) {
      const r = Number(row.getAttribute('r') ?? rows.length + 1) - 1
      const cells: CellValue[] = []
      for (const c of els(row, 'c')) {
        const ref = c.getAttribute('r')
        const col = ref ? columnIndex(ref) : cells.length
        cells[col] = cellValue(c, strings, kinds)
      }
      rows[r] = Array.from(cells, (v) => v ?? null)
    }
    sheets.push({ name: s.getAttribute('name') ?? `Sheet ${sheets.length + 1}`, rows: Array.from(rows, (r) => r ?? []) })
  }
  return sheets
}

function cellValue(c: Element, strings: string[], kinds: Kind[]): CellValue {
  const type = c.getAttribute('t')
  const v = els(c, 'v')[0]?.textContent ?? null
  if (type === 'inlineStr') return itemText(els(c, 'is')[0] ?? c) || null
  if (v === null || v === '') return null
  if (type === 's') return strings[Number(v)] ?? null
  if (type === 'str') return v
  if (type === 'b') return v === '1'
  if (type === 'e') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  const kind = kinds[Number(c.getAttribute('s') ?? 0)]
  if (kind === 'percent') return Math.round(n * 100 * 100) / 100
  if (kind === 'date') return serialToISO(n)
  return n
}

/** Minimal CSV parser: commas, quoted fields with "" escapes, and \r\n or \n line endings. */
export function parseCsv(text: string): CellValue[][] {
  const rows: CellValue[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    pushField()
    rows.push(row.map((f) => (f.trim() === '' ? null : /^-?\d+(\.\d+)?$/.test(f.trim()) ? Number(f) : f.trim())))
    row = []
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') pushField()
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      pushRow()
    } else field += ch
  }
  if (field || row.length) pushRow()
  return rows
}

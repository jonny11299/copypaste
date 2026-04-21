/**
 * Integration tests against real Excel input files.
 * Each test loads a file exactly as the app does (XLSX.readFile + sheet_to_json),
 * then runs processRows with default opts (equivalent to user skipping the input form).
 * Snapshots lock in the full clipboard output for all items.
 */
import { describe, it, expect } from 'vitest'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import { extractDataRows, sortRows, processRows } from '../src/main/sfmessage.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const INPUTS_DIR = join(__dirname, 'test inputs')

const DEFAULT_OPTS = {
  isMagnite:     false,
  dealPrefix:    'PARA-',
  seatID:        '',
  fcaps:         '',
  hasDNR:        false,
  hasAudience:   false,
  hasRelTarget:  false,
  isSplitPayDeal: false,
  splitPrePrice:  '',
  splitPostPrice: '',
  budgetModel:   'Fixed Price',
}

function loadFile(filename) {
  const wb = XLSX.readFile(join(INPUTS_DIR, filename))
  const ws = wb.Sheets[wb.SheetNames[0]]
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
  return sortRows(extractDataRows(allRows))
}

function slot(item, cId) {
  return item.contents.find(c => c.c_id === cId)?.c_contents ?? ''
}

// ─── Per-file suites ──────────────────────────────────────────────────────────

describe('1222186 — CBS Interactive 04/13/2026 (2 rows, 15 header mismatches)', () => {
  const dataRows = loadFile('1222186_PRODUCTION_TICKET_CBSINTERACTIVE_04132026_122253EDT.xls')
  const payload = processRows(dataRows, DEFAULT_OPTS)

  it('produces 2 items', () => {
    expect(payload.items).toHaveLength(2)
  })

  it('item titles match production line names', () => {
    expect(payload.items.map(i => i.item_title)).toMatchSnapshot()
  })

  it('all items clipboard slots match snapshot', () => {
    for (const item of payload.items) {
      const slots = Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [`c_id_${i}`, slot(item, i)])
      )
      expect(slots).toMatchSnapshot()
    }
  })

  it('full payload matches snapshot', () => {
    expect(payload).toMatchSnapshot()
  })
})

describe('1222593 — CBS Interactive 04/14/2026 (2 rows, 15 header mismatches)', () => {
  const dataRows = loadFile('1222593_PRODUCTION_TICKET_CBSINTERACTIVE_04142026_121300EDT.xls')
  const payload = processRows(dataRows, DEFAULT_OPTS)

  it('produces 2 items', () => {
    expect(payload.items).toHaveLength(2)
  })

  it('item titles match production line names', () => {
    expect(payload.items.map(i => i.item_title)).toMatchSnapshot()
  })

  it('all items clipboard slots match snapshot', () => {
    for (const item of payload.items) {
      const slots = Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [`c_id_${i}`, slot(item, i)])
      )
      expect(slots).toMatchSnapshot()
    }
  })

  it('full payload matches snapshot', () => {
    expect(payload).toMatchSnapshot()
  })
})

describe('1226496 — CBS Interactive 04/16/2026 (3 rows)', () => {
  const dataRows = loadFile('1226496_PRODUCTION_TICKET_CBSINTERACTIVE_04162026_200911EDT.xls')
  const payload = processRows(dataRows, DEFAULT_OPTS)

  it('produces 3 items', () => {
    expect(payload.items).toHaveLength(3)
  })

  it('item titles match production line names', () => {
    expect(payload.items.map(i => i.item_title)).toMatchSnapshot()
  })

  it('all items clipboard slots match snapshot', () => {
    for (const item of payload.items) {
      const slots = Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [`c_id_${i}`, slot(item, i)])
      )
      expect(slots).toMatchSnapshot()
    }
  })

  it('full payload matches snapshot', () => {
    expect(payload).toMatchSnapshot()
  })
})

describe('1227715 — CBS Interactive 04/20/2026 (8 rows)', () => {
  const dataRows = loadFile('1227715_PRODUCTION_TICKET_CBSINTERACTIVE_04202026_142823EDT.xls')
  const payload = processRows(dataRows, DEFAULT_OPTS)

  it('produces 8 items', () => {
    expect(payload.items).toHaveLength(8)
  })

  it('item titles match production line names', () => {
    expect(payload.items.map(i => i.item_title)).toMatchSnapshot()
  })

  it('all items clipboard slots match snapshot', () => {
    for (const item of payload.items) {
      const slots = Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [`c_id_${i}`, slot(item, i)])
      )
      expect(slots).toMatchSnapshot()
    }
  })

  it('full payload matches snapshot', () => {
    expect(payload).toMatchSnapshot()
  })
})

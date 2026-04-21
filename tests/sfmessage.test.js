import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { processRows, parsePastedSLIs } from '../src/main/sfmessage.js'
import { rowPG, rowPMP, rowPGEarly } from './fixtures/programmatic-rows.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pasteFixture = readFileSync(join(__dirname, 'fixtures/paste-input.txt'), 'utf8')

// Helper: extract clipboard value for a given c_id from an item
function slot(item, cId) {
  return item.contents.find(c => c.c_id === cId)?.c_contents ?? ''
}

// Helper: assert all 20 slots for an item match a snapshot
function expectSlotsSnapshot(item, testCtx) {
  const slots = {}
  for (let i = 0; i <= 19; i++) {
    slots[`ctrl+${i <= 9 ? i : 'shift+' + (i - 10)}`] = slot(item, i)
  }
  expect(slots).toMatchSnapshot()
}

// ─── processRows ──────────────────────────────────────────────────────────────

describe('processRows', () => {
  describe('basic PG deal (single row)', () => {
    const payload = processRows([rowPG], {
      isMagnite: false,
      dealPrefix: 'PARA-',
      seatID: '98765',
      fcaps: '3/day',
      hasDNR: false,
      hasAudience: false,
      hasRelTarget: false,
      isSplitPayDeal: false,
      budgetModel: 'Fixed Price',
    })

    it('returns programmatic mode', () => {
      expect(payload.mode).toBe('programmatic')
    })

    it('produces exactly one item', () => {
      expect(payload.items).toHaveLength(1)
    })

    it('item_title matches production line name', () => {
      expect(payload.items[0].item_title).toBe('VCBS_FW_123456_Q1_PG_Video_:30')
    })

    it('all clipboard slots match snapshot', () => {
      expectSlotsSnapshot(payload.items[0])
    })

    it('deal ID is derived from prefix', () => {
      expect(slot(payload.items[0], 1)).toBe('PARA-VCBS-FW-0001')
    })

    it('schedule is formatted MM/DD/YY - MM/DD/YY', () => {
      expect(slot(payload.items[0], 3)).toMatch(/^\d{2}\/\d{2}\/\d{2} - \d{2}\/\d{2}\/\d{2}$/)
    })

    it('quantity does not include 1% buffer in slot 4', () => {
      expect(slot(payload.items[0], 4)).toBe('500000')
    })

    it('qty+1% in slot 14 is ceiling of 500000 * 1.01', () => {
      expect(slot(payload.items[0], 14)).toBe('505000')
    })

    it('price in slot 5 is raw decimal string', () => {
      expect(slot(payload.items[0], 5)).toBe('25.00')
    })

    it('full payload matches snapshot', () => {
      expect(payload).toMatchSnapshot()
    })
  })

  describe('PMP deal — no quantity limit', () => {
    const payload = processRows([rowPMP], {
      isMagnite: false,
      dealPrefix: 'PARA-',
      seatID: '',
      fcaps: '',
      hasDNR: false,
      hasAudience: false,
      hasRelTarget: false,
      isSplitPayDeal: false,
      budgetModel: 'Fixed Price',
    })

    it('item_title matches production line name', () => {
      expect(payload.items[0].item_title).toBe('VCBS_FW_789012_Q1_PMP_Display')
    })

    it('quantity slot shows "No Limit (PMP)"', () => {
      expect(slot(payload.items[0], 4)).toBe('No Limit (PMP)')
    })

    it('qty+1% slot shows "N/A" for PMP', () => {
      expect(slot(payload.items[0], 14)).toBe('N/A')
    })

    it('full payload matches snapshot', () => {
      expect(payload).toMatchSnapshot()
    })
  })

  describe('with DNR + audience + Magnite flags', () => {
    const payload = processRows([rowPG], {
      isMagnite: true,
      dealPrefix: 'PARA-',
      seatID: '11111',
      fcaps: 'none',
      hasDNR: true,
      hasAudience: true,
      hasRelTarget: false,
      isSplitPayDeal: false,
      budgetModel: 'Fixed Price',
    })

    it('inventory field includes DNR and audience suffixes', () => {
      expect(slot(payload.items[0], 6)).toContain('DNR Excluded')
      expect(slot(payload.items[0], 6)).toContain('Audience Segments applied')
    })

    it('salesforce message includes CM reminders for DNR, audience, and Magnite', () => {
      const sfMsg = slot(payload.items[0], 9)
      expect(sfMsg).toContain('Remember to add the DNR')
      expect(sfMsg).toContain('Remember to add the audience segments')
      expect(sfMsg).toContain('Remember to setup Magnite and SpringServe')
    })

    it('full payload matches snapshot', () => {
      expect(payload).toMatchSnapshot()
    })
  })

  describe('split-pay deal', () => {
    const payload = processRows([rowPG], {
      isMagnite: false,
      dealPrefix: 'PARA-',
      seatID: '',
      fcaps: '',
      hasDNR: false,
      hasAudience: false,
      hasRelTarget: false,
      isSplitPayDeal: true,
      splitPrePrice: '12.00',
      splitPostPrice: '8.00',
      budgetModel: '1st Price Floored',
    })

    it('price slot shows pre/post split format', () => {
      expect(slot(payload.items[0], 5)).toBe('$12.00 pre / $8.00 post')
    })

    it('full payload matches snapshot', () => {
      expect(payload).toMatchSnapshot()
    })
  })

  describe('multi-row sort order', () => {
    // rowPGEarly has an earlier start date than rowPG — but we pass them in reverse order
    // processRows does NOT sort; caller is responsible (sortRows is exported separately)
    // This test verifies the order is preserved as passed
    const payload = processRows([rowPG, rowPGEarly], {
      isMagnite: false,
      dealPrefix: 'PARA-',
      seatID: '',
      fcaps: '',
      hasDNR: false,
      hasAudience: false,
      hasRelTarget: false,
      isSplitPayDeal: false,
      budgetModel: 'Fixed Price',
    })

    it('produces two items', () => {
      expect(payload.items).toHaveLength(2)
    })

    it('item order matches input order (no internal sorting)', () => {
      expect(payload.items[0].item_title).toBe('VCBS_FW_123456_Q1_PG_Video_:30')
      expect(payload.items[1].item_title).toBe('VCBS_FW_111111_Q1_PG_Video_:15')
    })

    it('salesforce message is identical on all items (c_id 9)', () => {
      const sf0 = slot(payload.items[0], 9)
      const sf1 = slot(payload.items[1], 9)
      expect(sf0).toBe(sf1)
      expect(sf0).toContain('VCBS_FW_123456')
      expect(sf0).toContain('VCBS_FW_111111')
    })

    it('full payload matches snapshot', () => {
      expect(payload).toMatchSnapshot()
    })
  })
})

// ─── parsePastedSLIs ──────────────────────────────────────────────────────────

describe('parsePastedSLIs', () => {
  describe('standard two-item paste', () => {
    const payload = parsePastedSLIs(pasteFixture)

    it('returns programmatic mode', () => {
      expect(payload.mode).toBe('programmatic')
    })

    it('produces two items in input order', () => {
      expect(payload.items).toHaveLength(2)
      expect(payload.items[0].item_title).toBe('VCBS_FW_111111_Q1_PG_Video_:15')
      expect(payload.items[1].item_title).toBe('VCBS_FW_123456_Q1_PG_Video_:30')
    })

    it('deal IDs are preserved as-is', () => {
      expect(slot(payload.items[0], 1)).toBe('PARA-VCBS-FW-0003')
      expect(slot(payload.items[1], 1)).toBe('PARA-VCBS-FW-0001')
    })

    it('quantity strips "imps" and commas', () => {
      expect(slot(payload.items[0], 4)).toBe('250000')
      expect(slot(payload.items[1], 4)).toBe('500000')
    })

    it('qty+1% is computed from stripped quantity', () => {
      expect(slot(payload.items[0], 14)).toBe('252500')
      expect(slot(payload.items[1], 14)).toBe('505000')
    })

    it('price strips "$" and CPM label, keeps decimal', () => {
      expect(slot(payload.items[0], 5)).toBe('18.75')
      expect(slot(payload.items[1], 5)).toBe('25.00')
    })

    it('inventory is preserved as-is', () => {
      expect(slot(payload.items[0], 6)).toBe('VideoStream, DNR Excluded')
    })

    it('salesforce message is shared across all items', () => {
      const sf0 = slot(payload.items[0], 9)
      const sf1 = slot(payload.items[1], 9)
      expect(sf0).toBe(sf1)
    })

    it('full payload matches snapshot', () => {
      expect(payload).toMatchSnapshot()
    })
  })

  describe('single-item paste', () => {
    const singleItem = `Deal Name: TestDeal_:30
Deal ID: PARA-TEST-0001
Seat ID: 55555
Schedule: 01/01/26 - 01/31/26
Quantity: 1,000,000 imps
Price: $5.00 CPM (Fixed Price)
Inventory: Display
Creative Length: 30 seconds
Fcaps: none`

    const payload = parsePastedSLIs(singleItem)

    it('produces exactly one item', () => {
      expect(payload.items).toHaveLength(1)
    })

    it('item_title is the deal name', () => {
      expect(payload.items[0].item_title).toBe('TestDeal_:30')
    })

    it('all clipboard slots match snapshot', () => {
      expectSlotsSnapshot(payload.items[0])
    })

    it('full payload matches snapshot', () => {
      expect(payload).toMatchSnapshot()
    })
  })

  describe('PMP item in paste', () => {
    const pmpPaste = `Deal Name: VCBS_FW_PMP_Test
Deal ID: PARA-VCBS-PMP-001
Seat ID:
Schedule: 03/01/26 - 03/31/26
Quantity: No Limit (PMP)
Price: $10.00 CPM (Fixed Price)
Inventory: VideoStream
Creative Length: N/A
Fcaps: none`

    const payload = parsePastedSLIs(pmpPaste)

    it('qty+1% is N/A for PMP', () => {
      expect(slot(payload.items[0], 14)).toBe('N/A')
    })

    it('quantity slot preserves PMP text', () => {
      expect(slot(payload.items[0], 4)).toContain('PMP')
    })
  })
})

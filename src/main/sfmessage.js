/**
 * sfmessage.js  (shared processing module)
 * Pure functions — no readline, no CLI, no file I/O.
 * Used by both the Electron main process and scripts/sfmessage.js.
 */

// ─── Column indices (0-based) ─────────────────────────────────────────────────

const COL = {
  SLI_ID:                16,
  PREFIX:                23,
  PRODUCTION_LINE_NAME:  24,
  PRODUCT:               28,
  PUSH_QUANTITY:         33,
  UNIT_COST:             34,
  START_DATE:            35,
  END_DATE:              36,
  VIDEO_CREATIVE_LENGTH: 61,
}

// ─── Expected headers ─────────────────────────────────────────────────────────

const EXPECTED_HEADERS = [
  'Ticket ID', 'Ticket', 'Order', 'Order ID', 'Status', 'Advertiser', 'Agency',
  'Start Date', 'End Date', 'Production System TZ', 'Order Currency', 'Order Owner',
  'Primary Sales Person', 'Assignee(s)', 'Reason Pended', 'Additional Info', 'SLI ID',
  'Parent Line ID', 'Parent Line Item Name', 'Package ID', 'Package Name', 'Revision Flag',
  'Internal PLI ID', 'Prefix', 'Production Line Name', 'Line Item Status',
  'Reservation Status', 'Status', 'Product', 'Order Cost Method', 'Push Cost Method',
  'Order Quantity', 'Production Quantity', 'Push Quantity', 'Unit Cost',
  'Start Date', 'End Date', 'Billable 3P Ad Server', 'Locator 1', 'Locator 2',
  'Locator 3', 'Locator 4', 'Sold Targeting', 'Push Additional Info', 'Production System',
  'Ad Size', 'Media Property', 'PS Order ID', 'PS Line Item ID', 'Push Production Fields',
  'PS Ad Status', 'PS Ad Status Timestamp', 'PS Ad Status Icon', 'Health',
  'Third Party Order ID', 'Third Party Line Item ID', 'Unreviewed Notes', 'IO Budget Model',
  'IO Budget Amount', 'Delivery Finalized', 'Frequency Measure (VCBS FW)',
  'Video Creative Length', 'US Advanced Combination Site-Video Targeting (VCBS FW)',
  'Frequency Served (VCBS FW)', 'Buyer', 'VPaid Support', 'Pricing Model',
  'Video Position (VCBS FW)', 'Yield Optimization Inventory Prioritization',
  'Link Style (VCBS FW)', 'Country (VCBS FW)', 'US Client Required Zip Targeting (FW 520311)',
  'Deal Type', 'US Content Group Exclusion (VCBS FW)', 'US Audience Manager Segment (VCBS FW)',
  'Audience Segment', 'Ad Unit', 'Frequency Cap', 'Section Group Exclude',
  'VPaid Support', 'Content Group Exclude', 'Buyer', 'Pricing Model', 'Content Group',
  'Yield Optimization Inventory Prioritization', 'Link Style', 'Deal Type', 'Country',
  'Frequency Measure',
]

// ─── Formatting helpers ───────────────────────────────────────────────────────

function getCellValue(row, colIndex) {
  const val = row[colIndex]
  if (val === undefined || val === null || val === '') return '{blank}'
  return String(val)
}

function parseDate(val) {
  if (!val) return new Date(0)
  if (val instanceof Date) return val
  if (typeof val === 'number') return new Date(Math.round((val - 25569) * 86400 * 1000))
  const d = new Date(String(val))
  return isNaN(d) ? new Date(0) : d
}

function formatDate(val) {
  if (!val || val === '{blank}') return '{blank}'
  const d = parseDate(val)
  if (isNaN(d)) return String(val)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${mm}/${dd}/${yy}`
}

function formatQuantity(val) {
  if (val === undefined || val === null || val === '') return '{blank}'
  const n = Number(val)
  if (isNaN(n)) return String(val)
  return n.toLocaleString('en-US')
}

function formatCurrency(val) {
  if (val === undefined || val === null || val === '') return '{blank}'
  const n = Number(val)
  if (isNaN(n)) return String(val)
  return '$' + n.toFixed(2)
}

function extractInventorySubstring(product) {
  if (!product || product === '{blank}') return product
  const prefixes = ['US|PG|', 'US|PMP|', 'US||PMNT|']
  for (const prefix of prefixes) {
    if (product.startsWith(prefix)) {
      const after = product.slice(prefix.length)
      const nextPipe = after.indexOf('|')
      return nextPipe >= 0 ? after.slice(0, nextPipe) : after
    }
  }
  return product
}

function createDealID(prefix, dealPrefix = 'PARA-') {
  if (!prefix || prefix === '{blank}') return dealPrefix + '{blank}'
  const lastHyphen = prefix.lastIndexOf('-')
  const base = lastHyphen > 0 ? prefix.slice(0, lastHyphen) : prefix.slice(0, -2)
  return dealPrefix + base
}

function hasOrderID(name) {
  let inSegment = false
  let digitCount = 0
  for (let i = 0; i < name.length; i++) {
    const ch = name[i]
    const isDelim = ch === '_' || ch === ' '
    const isDigit = ch >= '0' && ch <= '9'
    if (isDelim) {
      if (!inSegment) { inSegment = true; digitCount = 0 }
      else if (digitCount === 6) return true
      else digitCount = 0
    } else if (inSegment) {
      if (isDigit) digitCount++
      else { inSegment = false; digitCount = 0 }
    }
  }
  return false
}

function calculateRawCreativeLength(creativeLength) {
  if (!creativeLength || creativeLength === '{blank}') return 'N/A'
  const numbers = creativeLength.match(/\d+/g)
  if (!numbers || numbers.length === 0) return 'N/A'
  return String(Math.max(...numbers.map(Number)) + 1)
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateHeaders(rows) {
  const headers = rows[0] || []
  const mismatches = []
  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (headers[i] !== EXPECTED_HEADERS[i]) {
      mismatches.push(`Col ${i + 1}: expected "${EXPECTED_HEADERS[i]}", got "${headers[i]}"`)
    }
  }
  return mismatches
}

function extractDataRows(rows) {
  return rows.slice(1).filter(r => r.some(c => c !== undefined && c !== ''))
}

function sortRows(dataRows) {
  return [...dataRows].sort((a, b) => {
    const diff = parseDate(a[COL.START_DATE]) - parseDate(b[COL.START_DATE])
    if (diff !== 0) return diff
    return (Number(a[COL.SLI_ID]) || 0) - (Number(b[COL.SLI_ID]) || 0)
  })
}

function getMissingOrderIDNames(dataRows) {
  return dataRows
    .map(r => getCellValue(r, COL.PRODUCTION_LINE_NAME))
    .filter(name => name !== '{blank}' && !hasOrderID(name))
}

function anyInventoryHasSplit(dataRows) {
  return dataRows.some(r =>
    extractInventorySubstring(getCellValue(r, COL.PRODUCT)).toLowerCase().includes('split')
  )
}

function getMissingMagniteLine(dataRows) {
  return dataRows.find(r => {
    const name = getCellValue(r, COL.PRODUCTION_LINE_NAME).toLowerCase()
    return !['magnite', 'mag'].some(t => name.includes(t))
  })
}

// ─── Core processor ──────────────────────────────────────────────────────────
/**
 * @param {Array[]} dataRows  - sorted raw rows from SheetJS
 * @param {Object}  opts
 *   isMagnite, dealPrefix, seatID, fcaps,
 *   hasDNR, hasAudience, hasRelTarget,
 *   isSplitPayDeal, splitPrePrice, splitPostPrice,
 *   budgetModel
 * @returns {Payload}  see src/main/payload_v2.js for full shape spec
 */
function processRows(dataRows, opts) {
  const {
    isMagnite = false,
    dealPrefix = 'PARA-',
    seatID = '',
    fcaps = '',
    hasDNR = false,
    hasAudience = false,
    hasRelTarget = false,
    isSplitPayDeal = false,
    splitPrePrice = '',
    splitPostPrice = '',
    budgetModel = 'Fixed Price',
  } = opts

  const itemsPartial = []  // contents without c_id 9 (SF message not yet complete)
  const sfLines = []

  dataRows.forEach((row, idx) => {
    const prodLineName  = getCellValue(row, COL.PRODUCTION_LINE_NAME)
    const prefix        = getCellValue(row, COL.PREFIX)
    const dealID        = createDealID(prefix, dealPrefix)
    const startDate     = formatDate(row[COL.START_DATE])
    const endDate       = formatDate(row[COL.END_DATE])
    const schedule      = `${startDate} - ${endDate}`
    const isPMP         = prodLineName.toUpperCase().includes('PMP')
    const rawQtyNum     = Number(row[COL.PUSH_QUANTITY] ?? 0)
    const rawQty        = isPMP ? 'No Limit (PMP)' : String(row[COL.PUSH_QUANTITY] ?? '')
    const quantityBuf   = isPMP ? 'N/A' : String(Math.ceil(rawQtyNum * 1.01))
    const quantityDisplay = isPMP
      ? 'No Limit (PMP)'
      : `${formatQuantity(row[COL.PUSH_QUANTITY])} imps`

    let priceRaw, priceLabeled
    if (isSplitPayDeal) {
      priceRaw     = `$${splitPrePrice} pre / $${splitPostPrice} post`
      priceLabeled = `$${splitPrePrice} pre / $${splitPostPrice} post CPM (${budgetModel})`
    } else {
      const unitCost = row[COL.UNIT_COST]
      priceRaw     = unitCost != null ? Number(unitCost).toFixed(2) : '{blank}'
      priceLabeled = `${formatCurrency(unitCost)} CPM (${budgetModel})`
    }

    const product      = getCellValue(row, COL.PRODUCT)
    let inventoryField = extractInventorySubstring(product)
    if (hasDNR)       inventoryField += ', DNR Excluded'
    if (hasAudience)  inventoryField += ', Audience Segments applied'
    if (hasRelTarget) inventoryField += ', Relationship Targeting applied'

    const creativeLength = getCellValue(row, COL.VIDEO_CREATIVE_LENGTH)
      .replace(/\s*seconds?\s*$/i, '').trim()
    const clFormatted    = creativeLength === 'N/A' ? 'N/A'
      : creativeLength.replace(/(\d+)/g, '$1s')
    const fcapsDisplay   = fcaps || 'none'
    const seatIDDisplay  = seatID || ''

    itemsPartial.push({
      item_id:    idx,
      item_title: prodLineName,
      contents: [
        { c_id:  0, c_title: 'Deal Name',         c_contents: prodLineName,   c_type: 'string' },
        { c_id:  1, c_title: 'Deal ID',            c_contents: dealID,         c_type: 'string' },
        { c_id:  2, c_title: 'Seat ID',            c_contents: seatIDDisplay,  c_type: 'string' },
        { c_id:  3, c_title: 'Schedule',           c_contents: schedule,       c_type: 'string' },
        { c_id:  4, c_title: 'Quantity',           c_contents: rawQty,         c_type: 'string' },
        { c_id:  5, c_title: 'Price',              c_contents: priceRaw,       c_type: 'string' },
        { c_id:  6, c_title: 'Inventory',          c_contents: inventoryField, c_type: 'string' },
        { c_id:  7, c_title: 'Creative Length',    c_contents: creativeLength, c_type: 'string' },
        { c_id:  8, c_title: 'fcaps',              c_contents: fcapsDisplay,   c_type: 'string' },
        // c_id 9 (Ctrl+0 / Salesforce Message) added after loop
        { c_id: 14, c_title: 'Qty + 1%',           c_contents: quantityBuf,   c_type: 'string' },
      ],
    })

    sfLines.push(`Name: ${prodLineName}`)
    sfLines.push(`Deal ID: ${dealID}`)
    sfLines.push(`Seat ID: ${seatIDDisplay || 'none'}`)
    sfLines.push(`Schedule: ${schedule}`)
    sfLines.push(`Quantity: ${quantityDisplay}`)
    sfLines.push(`Price: ${priceLabeled}`)
    sfLines.push(`Inventory: ${inventoryField}`)
    sfLines.push(`Creative Length: ${clFormatted}`)
    sfLines.push(`fcaps: ${fcapsDisplay}`)
    sfLines.push('')
  })

  if (hasDNR || hasAudience || hasRelTarget || isMagnite) {
    sfLines.push('FOR CM:')
    let n = 1
    if (hasDNR)       sfLines.push(`${n++}. Remember to add the DNR`)
    if (hasAudience)  sfLines.push(`${n++}. Remember to add the audience segments`)
    if (hasRelTarget) sfLines.push(`${n++}. Remember to add the relationship targeting`)
    if (isMagnite)    sfLines.push(`${n++}. Remember to setup Magnite and SpringServe`)
  }

  const salesforceMessage = sfLines.join('\n')

  // Distribute the full SF message identically to every item as c_id 9
  const items = itemsPartial.map(item => ({
    ...item,
    contents: [
      ...item.contents,
      { c_id: 9, c_title: 'Salesforce Message', c_contents: salesforceMessage, c_type: 'string' },
    ],
  }))

  return { mode: 'programmatic', items }
}

// ─── Programmatic paste parser ────────────────────────────────────────────────
/**
 * Parses pasted labeled SLI text (Key: Value format) into a payload.
 *
 * Expected format (one blank line between SLIs):
 *   Name: ...  or  Deal Name: ...
 *   Deal ID: ...
 *   Seat ID: ...
 *   Schedule: MM/DD/YY - MM/DD/YY
 *   Quantity: ...
 *   Price: $13.06 CPM (1st Price Floored)
 *   Inventory: ...
 *   Creative Length: ...
 *   Fcaps: ...
 *
 * @returns {Payload}  see src/main/payload_v2.js for full shape spec
 */
function parsePastedSLIs(text) {
  const blocks = text.trim().split(/\n[ \t]*\n/)
  const itemsPartial = []
  const sfLines = []

  for (const block of blocks) {
    if (!block.trim()) continue

    const fields = {}
    for (const line of block.split('\n')) {
      const colonIdx = line.indexOf(':')
      if (colonIdx < 0) continue
      const key = line.slice(0, colonIdx).trim().toLowerCase()
      const val = line.slice(colonIdx + 1).trim()
      fields[key] = val
    }

    const name           = fields['deal name'] || fields['name'] || ''
    const dealID         = fields['deal id']   || ''
    const seatID         = fields['seat id']   || ''
    const schedule       = fields['schedule']  || ''
    const quantityRaw    = (fields['quantity'] || '').replace(/,/g, '').replace(/\s*imps?\s*$/i, '').trim()
    const isPMP          = quantityRaw.toLowerCase().includes('pmp')
    const quantityNum    = Number(quantityRaw)
    const quantityBuf    = isPMP ? 'N/A'
      : (!isNaN(quantityNum) && quantityNum > 0 ? String(Math.ceil(quantityNum * 1.01)) : '')
    const priceRaw_str   = fields['price']     || ''
    const inventory      = fields['inventory'] || ''
    const creativeLength = (fields['creative length'] || '').replace(/\s*seconds?\s*$/i, '').trim()
    const clFormatted    = creativeLength === 'N/A' ? 'N/A'
      : creativeLength.replace(/(\d+)/g, '$1s')
    const fcaps          = fields['fcaps'] || fields['f caps'] || 'none'
    const priceMatch     = priceRaw_str.match(/\$?([\d.]+)/)
    const priceRaw       = priceMatch ? priceMatch[1] : priceRaw_str

    itemsPartial.push({
      item_id:    itemsPartial.length,
      item_title: name,
      contents: [
        { c_id:  0, c_title: 'Deal Name',         c_contents: name,           c_type: 'string' },
        { c_id:  1, c_title: 'Deal ID',            c_contents: dealID,         c_type: 'string' },
        { c_id:  2, c_title: 'Seat ID',            c_contents: seatID,         c_type: 'string' },
        { c_id:  3, c_title: 'Schedule',           c_contents: schedule,       c_type: 'string' },
        { c_id:  4, c_title: 'Quantity',           c_contents: quantityRaw,    c_type: 'string' },
        { c_id:  5, c_title: 'Price',              c_contents: priceRaw,       c_type: 'string' },
        { c_id:  6, c_title: 'Inventory',          c_contents: inventory,      c_type: 'string' },
        { c_id:  7, c_title: 'Creative Length',    c_contents: creativeLength, c_type: 'string' },
        { c_id:  8, c_title: 'fcaps',              c_contents: fcaps,          c_type: 'string' },
        // c_id 9 added after loop
        { c_id: 14, c_title: 'Qty + 1%',           c_contents: quantityBuf,   c_type: 'string' },
      ],
    })

    sfLines.push(`Name: ${name}`)
    sfLines.push(`Deal ID: ${dealID}`)
    sfLines.push(`Seat ID: ${seatID || 'none'}`)
    sfLines.push(`Schedule: ${schedule}`)
    sfLines.push(`Quantity: ${quantityRaw}`)
    sfLines.push(`Price: ${priceRaw_str}`)
    sfLines.push(`Inventory: ${inventory}`)
    sfLines.push(`Creative Length: ${clFormatted}`)
    sfLines.push(`fcaps: ${fcaps}`)
    sfLines.push('')
  }

  const salesforceMessage = sfLines.join('\n').trimEnd()
  const items = itemsPartial.map(item => ({
    ...item,
    contents: [
      ...item.contents,
      { c_id: 9, c_title: 'Salesforce Message', c_contents: salesforceMessage, c_type: 'string' },
    ],
  }))

  return { mode: 'programmatic', items }
}

// ─── 1x1 PLI paste parser ─────────────────────────────────────────────────────
/**
 * Parses pasted 1x1 pixel tracking text into a payload.
 *
 * Expected format:
 *   PLI = 5320037:
 *   "impression
 *   https://...
 *   start
 *   https://...
 *   ..."
 *
 * c_id mapping for 1x1:
 *   c_id  0–8  → fields[0–8].url   (Ctrl+1–9)
 *   c_id  9    → PLI number / name  (Ctrl+0)
 *   c_id 10–19 → fields[9–18].url  (Ctrl+Shift+1–0)
 *
 * @returns {Payload}  see src/main/payload_v2.js for full shape spec
 */
function parsePastedPLIs(text) {
  // Split on "PLI = NNNN" header lines; capture group preserves the ID
  const chunks = text.split(/^PLI\s*=\s*(\d+)\s*:?\s*$/m)
  // chunks layout: [preamble, id, content, id, content, ...]

  const items = []

  for (let i = 1; i < chunks.length; i += 2) {
    const pliId    = chunks[i].trim()
    const rawBlock = (chunks[i + 1] || '').trim()

    const stripped = rawBlock.replace(/^"+/, '').replace(/"+$/, '').trim()
    const lines = stripped.split('\n')
      .map(l => l.trim().replace(/^"+|"+$/g, ''))
      .filter(l => l.length > 0)

    // Pair up alternating lines as label / url
    const fields = []
    for (let j = 0; j + 1 < lines.length; j += 2) {
      fields.push({ label: lines[j], url: lines[j + 1] })
    }

    if (!fields.length) continue

    const contents = [
      // c_id 0–8: fields[0–8]
      ...fields.slice(0, 9).map((f, k) => ({ c_id: k,      c_title: f.label, c_contents: f.url, c_type: 'string' })),
      // c_id 9: PLI number
      { c_id: 9, c_title: 'PLI #', c_contents: pliId, c_type: 'string' },
      // c_id 10–19: fields[9–18]
      ...fields.slice(9, 19).map((f, k) => ({ c_id: 10 + k, c_title: f.label, c_contents: f.url, c_type: 'string' })),
    ]

    items.push({ item_id: items.length, item_title: pliId, contents })
  }

  return { mode: '1x1', items }
}

export {
  COL,
  EXPECTED_HEADERS,
  validateHeaders,
  extractDataRows,
  sortRows,
  getMissingOrderIDNames,
  anyInventoryHasSplit,
  getMissingMagniteLine,
  processRows,
  parsePastedSLIs,
  parsePastedPLIs,
  getCellValue,
}

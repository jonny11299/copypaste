/**
 * sfmessage.js  (CLI entry point)
 * Reads a production ticket XLS from data/ and outputs formatted SLI
 * deal specs to the console.
 *
 * Usage: npm run sfmessage
 */

const XLSX    = require('xlsx')
const readline = require('readline')
const fs      = require('fs')
const path    = require('path')

// Imported inside main() via dynamic import because src/main/sfmessage.js is ESM
let validateHeaders, extractDataRows, sortRows, getMissingOrderIDNames,
    anyInventoryHasSplit, getMissingMagniteLine, processRows, getCellValue, COL

// ─── Paths ────────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, '..', 'data')

// ─── Readline helpers ─────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve))
}

async function warnAndAsk(message) {
  console.warn(`\n⚠️  WARNING: ${message}`)
  const answer = await ask('   Continue, or exit? (c/e): ')
  if (answer.trim().toLowerCase().startsWith('e')) {
    console.log('\nExiting.')
    rl.close()
    process.exit(0)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Dynamic import of ESM shared module
  ;({ validateHeaders, extractDataRows, sortRows, getMissingOrderIDNames,
      anyInventoryHasSplit, getMissingMagniteLine, processRows, getCellValue, COL }
    = await import('../src/main/sfmessage.js'))

  console.log('\n📋  sfmessage — SLI Deal Spec Generator')
  console.log('─'.repeat(50))

  // 1. Find XLS/XLSX in data/
  let files
  try {
    files = fs.readdirSync(DATA_DIR).filter(f => /\.xlsx?$/i.test(f))
  } catch {
    console.error(`\n❌  Could not read data directory: ${DATA_DIR}`)
    process.exit(1)
  }
  if (files.length === 0) { console.error('\n❌  No .xls or .xlsx file found in data/.'); process.exit(1) }
  if (files.length > 1)   { console.warn(`\n⚠️  Multiple files found — using: ${files[0]}`) }

  const filePath = path.join(DATA_DIR, files[0])
  console.log(`\n📂  File: ${files[0]}`)

  // 2. Read workbook
  let wb
  try { wb = XLSX.readFile(filePath) }
  catch (err) { console.error(`\n❌  Failed to read file: ${err.message}`); process.exit(1) }

  const ws      = wb.Sheets[wb.SheetNames[0]]
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
  if (allRows.length < 2) { console.error('\n❌  File has no data rows.'); process.exit(1) }

  // 3. Validate headers
  const mismatches = validateHeaders(allRows)
  if (mismatches.length > 0) {
    console.warn('\n⚠️  Header mismatch(es):')
    mismatches.forEach(m => console.warn('  ' + m))
    await warnAndAsk(`${mismatches.length} header(s) do not match expected format.`)
  } else {
    console.log('✅  Headers validated.')
  }

  // 4. Extract, sort, validate Order IDs
  const dataRows = sortRows(extractDataRows(allRows))
  console.log(`📊  ${dataRows.length} SLI(s) found.\n`)

  const badNames = getMissingOrderIDNames(dataRows)
  if (badNames.length > 0) {
    console.warn('⚠️  Missing Order ID in line name(s) — please ask Sales:')
    badNames.forEach(n => console.warn(`    • ${n}`))
    console.log()
  }

  // ── Prompts ───────────────────────────────────────────────────────────────

  const isMagnite = (await ask('Is this a Magnite deal? (y/n): ')).trim().toLowerCase().startsWith('y')
  let dealPrefix = 'PARA-'

  if (isMagnite) {
    const bad = getMissingMagniteLine(dataRows)
    if (bad) {
      await warnAndAsk(
        `"${getCellValue(bad, COL.PRODUCTION_LINE_NAME)}" is missing "Magnite" in the name.\n` +
        `    Please ask Sales to include "Magnite" in all Magnite deal line names.`
      )
    }
    const p = (await ask('Enter deal prefix [PARA-MAG-xxx-] (default PARA-MAG-): ')).trim()
    dealPrefix = p || 'PARA-MAG-'
  }

  const seatID       = (await ask('Seat ID (leave blank if none): ')).trim()
  const fcaps        = (await ask('fcaps (leave blank if none): ')).trim()
  const hasDNR       = (await ask('Is there a DNR list? (y/n): ')).trim().toLowerCase().startsWith('y')
  const hasAudience  = (await ask('Are there audience segments to apply? (y/n): ')).trim().toLowerCase().startsWith('y')
  const hasRelTarget = (await ask('Is there relationship targeting? (y/n): ')).trim().toLowerCase().startsWith('y')

  let isSplitPayDeal = false, splitPrePrice = '', splitPostPrice = ''
  if (anyInventoryHasSplit(dataRows)) {
    isSplitPayDeal = (await ask('Is this a split pay deal? (y/n): ')).trim().toLowerCase().startsWith('y')
    if (isSplitPayDeal) {
      splitPrePrice  = (await ask('Please enter pre price: ')).trim()
      splitPostPrice = (await ask('Please enter post price: ')).trim()
    }
  }

  const budgetInput = (await ask(
    'Budget model — Fixed Price / 1st Price Floored / 2nd Price Floored\n  (blank = Fixed Price): '
  )).trim()
  const budgetModel = budgetInput || 'Fixed Price'

  // ── Process & output ──────────────────────────────────────────────────────

  const { slis, salesforceMessage } = processRows(dataRows, {
    isMagnite, dealPrefix, seatID, fcaps,
    hasDNR, hasAudience, hasRelTarget,
    isSplitPayDeal, splitPrePrice, splitPostPrice,
    budgetModel,
  })

  console.log('\n' + '═'.repeat(60))
  console.log('  OUTPUT')
  console.log('═'.repeat(60))

  slis.forEach((sli, idx) => {
    console.log(`\n┌─ SLI ${idx + 1} ${'─'.repeat(49 - String(idx + 1).length)}`)
    console.log(`│  LABELED`)
    console.log(`│  Name:             ${sli.name}`)
    console.log(`│  Deal ID:          ${sli.dealID}`)
    console.log(`│  Seat ID:          ${sli.seatID || 'none'}`)
    console.log(`│  Schedule:         ${sli.schedule}`)
    console.log(`│  Quantity:         ${sli.quantity}`)
    console.log(`│  Price:            ${sli.price}`)
    console.log(`│  Inventory:        ${sli.inventory}`)
    console.log(`│  Creative Length:  ${sli.creativeLength}`)
    console.log(`│  fcaps:            ${sli.fcaps}`)
    console.log(`└${'─'.repeat(55)}`)
  })

  console.log('\n' + '═'.repeat(60))
  console.log('  SALESFORCE MESSAGE')
  console.log('═'.repeat(60))
  console.log(salesforceMessage)

  console.log('✅  Processing complete.\n')
  rl.close()
}

main().catch(err => {
  console.error('\n❌  Unexpected error:', err.message)
  rl.close()
  process.exit(1)
})

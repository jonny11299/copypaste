/**
 * Fixture: raw Excel rows as SheetJS would produce them.
 * Indices match the COL constants in sfmessage.js.
 *
 * COL.SLI_ID:                16
 * COL.PREFIX:                23
 * COL.PRODUCTION_LINE_NAME:  24
 * COL.PRODUCT:               28
 * COL.PUSH_QUANTITY:         33
 * COL.UNIT_COST:             34
 * COL.START_DATE:            35
 * COL.END_DATE:              36
 * COL.VIDEO_CREATIVE_LENGTH: 61
 */

function makeRow(fields) {
  const row = []
  for (const [idx, val] of Object.entries(fields)) {
    row[Number(idx)] = val
  }
  return row
}

// Standard PG deal — video, with creative length
export const rowPG = makeRow({
  16: '123456',
  23: 'VCBS-FW-0001-01',
  24: 'VCBS_FW_123456_Q1_PG_Video_:30',
  28: 'US|PG|VideoStream|Desktop',
  33: 500000,
  34: 25.00,
  35: new Date('2026-05-01'),
  36: new Date('2026-05-31'),
  61: '30 seconds',
})

// PMP deal — no quantity limit, display product
export const rowPMP = makeRow({
  16: '789012',
  23: 'VCBS-FW-0002-01',
  24: 'VCBS_FW_789012_Q1_PMP_Display',
  28: 'US|PMP|Display|Mobile',
  33: 1000000,
  34: 10.50,
  35: new Date('2026-06-01'),
  36: new Date('2026-06-30'),
  61: '{blank}',
})

// Second PG row (earlier start date — used to verify sort order)
export const rowPGEarly = makeRow({
  16: '111111',
  23: 'VCBS-FW-0003-01',
  24: 'VCBS_FW_111111_Q1_PG_Video_:15',
  28: 'US|PG|VideoStream|Mobile',
  33: 250000,
  34: 18.75,
  35: new Date('2026-04-01'),
  36: new Date('2026-04-30'),
  61: '15 seconds',
})

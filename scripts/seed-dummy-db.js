import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH  = join(__dirname, '../data/DBs/dummy-2-chunk.db')

mkdirSync(join(__dirname, '../data/DBs'), { recursive: true })

const db = new Database(OUT_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS payloads (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT    NOT NULL,
    mode     TEXT    NOT NULL,
    saved_at TEXT    NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chunks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    payload_id  INTEGER NOT NULL REFERENCES payloads(id),
    chunk_index INTEGER NOT NULL,
    chunk_title TEXT    NOT NULL
  );
  CREATE TABLE IF NOT EXISTS items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    chunk_id   INTEGER NOT NULL REFERENCES chunks(id),
    item_index INTEGER NOT NULL,
    item_title TEXT    NOT NULL
  );
  CREATE TABLE IF NOT EXISTS contents (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id    INTEGER NOT NULL REFERENCES items(id),
    c_id       INTEGER NOT NULL,
    c_title    TEXT    NOT NULL,
    c_contents TEXT    NOT NULL,
    c_override TEXT,
    c_type     TEXT    NOT NULL DEFAULT 'string'
  );
`)

const insertPayload = db.prepare('INSERT INTO payloads (name, mode, saved_at) VALUES (?, ?, ?)')
const insertChunk   = db.prepare('INSERT INTO chunks (payload_id, chunk_index, chunk_title) VALUES (?, ?, ?)')
const insertItem    = db.prepare('INSERT INTO items (chunk_id, item_index, item_title) VALUES (?, ?, ?)')
const insertContent = db.prepare(
  'INSERT INTO contents (item_id, c_id, c_title, c_contents, c_override, c_type) VALUES (?, ?, ?, ?, NULL, ?)'
)

const payloadId = insertPayload.run('dummy-2-chunk', 'programmatic', new Date().toISOString()).lastInsertRowid

const chunks = [
  {
    title: 'Alpha Flight',
    items: [
      { title: 'Alpha_SLI_001', fields: [['Deal Name', 'Alpha Deal One'], ['Deal ID', 'PARA-ALPHA-001'], ['Schedule', '05/01/25 - 05/31/25'], ['Quantity', '500000'], ['Price', '12.50'], ['Inventory', 'Video'], ['Creative Length', '15s'], ['fcaps', 'none']] },
      { title: 'Alpha_SLI_002', fields: [['Deal Name', 'Alpha Deal Two'], ['Deal ID', 'PARA-ALPHA-002'], ['Schedule', '05/01/25 - 05/31/25'], ['Quantity', '750000'], ['Price', '14.00'], ['Inventory', 'Display'], ['Creative Length', 'N/A'], ['fcaps', '3/day']] },
      { title: 'Alpha_SLI_003', fields: [['Deal Name', 'Alpha Deal Three'], ['Deal ID', 'PARA-ALPHA-003'], ['Schedule', '06/01/25 - 06/30/25'], ['Quantity', '1000000'], ['Price', '10.00'], ['Inventory', 'Video, DNR Excluded'], ['Creative Length', '30s'], ['fcaps', 'none']] },
    ],
  },
  {
    title: 'Bravo Squadron',
    items: [
      { title: 'Bravo_SLI_001', fields: [['Deal Name', 'Bravo Deal One'], ['Deal ID', 'PARA-BRAVO-001'], ['Schedule', '05/15/25 - 06/15/25'], ['Quantity', '250000'], ['Price', '18.75'], ['Inventory', 'CTV'], ['Creative Length', '30s'], ['fcaps', '2/day']] },
      { title: 'Bravo_SLI_002', fields: [['Deal Name', 'Bravo Deal Two'], ['Deal ID', 'PARA-BRAVO-002'], ['Schedule', '05/15/25 - 06/15/25'], ['Quantity', 'No Limit (PMP)'], ['Price', '22.00'], ['Inventory', 'Video'], ['Creative Length', '15s'], ['fcaps', 'none']] },
    ],
  },
]

const seed = db.transaction(() => {
  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk   = chunks[ci]
    const chunkId = insertChunk.run(payloadId, ci, chunk.title).lastInsertRowid

    for (let ii = 0; ii < chunk.items.length; ii++) {
      const item   = chunk.items[ii]
      const itemId = insertItem.run(chunkId, ii, item.title).lastInsertRowid

      item.fields.forEach(([title, contents], cId) => {
        insertContent.run(itemId, cId, title, contents, 'string')
      })
    }
  }
})

seed()
db.close()

console.log(`Seeded: ${OUT_PATH}`)

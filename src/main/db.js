import Database from 'better-sqlite3'

let db = null

export function initDb() {
  db = new Database(':memory:')

  db.exec(`
    CREATE TABLE payloads (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      name     TEXT    NOT NULL,
      mode     TEXT    NOT NULL,
      saved_at TEXT    NOT NULL
    );
    CREATE TABLE chunks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      payload_id  INTEGER NOT NULL REFERENCES payloads(id),
      chunk_index INTEGER NOT NULL,
      chunk_title TEXT    NOT NULL
    );
    CREATE TABLE items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      chunk_id   INTEGER NOT NULL REFERENCES chunks(id),
      item_index INTEGER NOT NULL,
      item_title TEXT    NOT NULL
    );
    CREATE TABLE contents (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id    INTEGER NOT NULL REFERENCES items(id),
      c_id       INTEGER NOT NULL,
      c_title    TEXT    NOT NULL,
      c_contents TEXT    NOT NULL,
      c_override TEXT,
      c_type     TEXT    NOT NULL DEFAULT 'string'
    );
  `)
}

export function saveDirectPayload(name, chunks) {
  db.exec('DELETE FROM contents; DELETE FROM items; DELETE FROM chunks; DELETE FROM payloads;')
  const savedAt = new Date().toISOString()
  const insertPayload = db.prepare('INSERT INTO payloads (name, mode, saved_at) VALUES (?, ?, ?)')
  const insertChunk   = db.prepare('INSERT INTO chunks (payload_id, chunk_index, chunk_title) VALUES (?, ?, ?)')
  const insertItem    = db.prepare('INSERT INTO items (chunk_id, item_index, item_title) VALUES (?, ?, ?)')
  const insertContent = db.prepare(
    'INSERT INTO contents (item_id, c_id, c_title, c_contents, c_override, c_type) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const payloadId = insertPayload.run(name, 'direct', savedAt).lastInsertRowid
  db.transaction(() => {
    chunks.forEach((chunk, ci) => {
      const chunkId = insertChunk.run(payloadId, ci, chunk.chunk_title).lastInsertRowid
      chunk.items.forEach((item, ii) => {
        const itemId = insertItem.run(chunkId, ii, item.item_title).lastInsertRowid
        item.contents.forEach(c => insertContent.run(itemId, c.c_id, c.c_title, c.c_contents, null, 'string'))
      })
    })
  })()
}

export function savePayload(name, payload) {
  db.exec('DELETE FROM contents; DELETE FROM items; DELETE FROM chunks; DELETE FROM payloads;')

  const savedAt = new Date().toISOString()

  const insertPayload = db.prepare('INSERT INTO payloads (name, mode, saved_at) VALUES (?, ?, ?)')
  const insertChunk   = db.prepare('INSERT INTO chunks (payload_id, chunk_index, chunk_title) VALUES (?, ?, ?)')
  const insertItem    = db.prepare('INSERT INTO items (chunk_id, item_index, item_title) VALUES (?, ?, ?)')
  const insertContent = db.prepare(
    'INSERT INTO contents (item_id, c_id, c_title, c_contents, c_override, c_type) VALUES (?, ?, ?, ?, ?, ?)'
  )

  const payloadId = insertPayload.run(name, payload.mode, savedAt).lastInsertRowid
  const chunkId   = insertChunk.run(payloadId, 0, 'Programmatic Chunk').lastInsertRowid

  const saveAll = db.transaction(() => {
    for (let i = 0; i < payload.items.length; i++) {
      const item   = payload.items[i]
      const itemId = insertItem.run(chunkId, i, item.item_title).lastInsertRowid
      for (const c of item.contents) {
        insertContent.run(itemId, c.c_id, c.c_title, c.c_contents, null, c.c_type ?? 'string')
      }
    }
  })

  saveAll()
}

export function queryAllV2() {
  return db.prepare(`
    SELECT
      p.id   AS payload_id,
      p.name AS payload_name,
      p.mode,
      p.saved_at,
      k.id          AS chunk_id,
      k.chunk_index,
      k.chunk_title,
      i.id         AS item_id,
      i.item_index,
      i.item_title,
      c.id         AS content_id,
      c.c_id,
      c.c_title,
      c.c_contents,
      c.c_override,
      c.c_type
    FROM payloads p
    JOIN chunks   k ON k.payload_id = p.id
    JOIN items    i ON i.chunk_id   = k.id
    JOIN contents c ON c.item_id    = i.id
    ORDER BY k.chunk_index, i.item_index, c.c_id
  `).all()
}

export function seedDummyDb(filePath) {
  const seed = new Database(filePath)
  seed.exec(`
    CREATE TABLE payloads (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, mode TEXT NOT NULL, saved_at TEXT NOT NULL);
    CREATE TABLE chunks   (id INTEGER PRIMARY KEY AUTOINCREMENT, payload_id INTEGER NOT NULL, chunk_index INTEGER NOT NULL, chunk_title TEXT NOT NULL);
    CREATE TABLE items    (id INTEGER PRIMARY KEY AUTOINCREMENT, chunk_id INTEGER NOT NULL, item_index INTEGER NOT NULL, item_title TEXT NOT NULL);
    CREATE TABLE contents (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, c_id INTEGER NOT NULL, c_title TEXT NOT NULL, c_contents TEXT NOT NULL, c_override TEXT, c_type TEXT NOT NULL DEFAULT 'string');
  `)
  const ip = seed.prepare('INSERT INTO payloads (name, mode, saved_at) VALUES (?, ?, ?)')
  const ic = seed.prepare('INSERT INTO chunks (payload_id, chunk_index, chunk_title) VALUES (?, ?, ?)')
  const ii = seed.prepare('INSERT INTO items (chunk_id, item_index, item_title) VALUES (?, ?, ?)')
  const ct = seed.prepare('INSERT INTO contents (item_id, c_id, c_title, c_contents, c_override, c_type) VALUES (?, ?, ?, ?, NULL, ?)')

  const pid = ip.run('dummy-2-chunk', 'programmatic', new Date().toISOString()).lastInsertRowid

  const chunks = [
    { title: 'Alpha Flight', items: [
      { title: 'Alpha_SLI_001', fields: [['Deal Name','Alpha Deal One'],['Deal ID','PARA-ALPHA-001'],['Schedule','05/01/25 - 05/31/25'],['Quantity','500000'],['Price','12.50'],['Inventory','Video'],['Creative Length','15s'],['fcaps','none']] },
      { title: 'Alpha_SLI_002', fields: [['Deal Name','Alpha Deal Two'],['Deal ID','PARA-ALPHA-002'],['Schedule','05/01/25 - 05/31/25'],['Quantity','750000'],['Price','14.00'],['Inventory','Display'],['Creative Length','N/A'],['fcaps','3/day']] },
      { title: 'Alpha_SLI_003', fields: [['Deal Name','Alpha Deal Three'],['Deal ID','PARA-ALPHA-003'],['Schedule','06/01/25 - 06/30/25'],['Quantity','1000000'],['Price','10.00'],['Inventory','Video, DNR Excluded'],['Creative Length','30s'],['fcaps','none']] },
    ]},
    { title: 'Bravo Squadron', items: [
      { title: 'Bravo_SLI_001', fields: [['Deal Name','Bravo Deal One'],['Deal ID','PARA-BRAVO-001'],['Schedule','05/15/25 - 06/15/25'],['Quantity','250000'],['Price','18.75'],['Inventory','CTV'],['Creative Length','30s'],['fcaps','2/day']] },
      { title: 'Bravo_SLI_002', fields: [['Deal Name','Bravo Deal Two'],['Deal ID','PARA-BRAVO-002'],['Schedule','05/15/25 - 06/15/25'],['Quantity','No Limit (PMP)'],['Price','22.00'],['Inventory','Video'],['Creative Length','15s'],['fcaps','none']] },
    ]},
  ]

  seed.transaction(() => {
    chunks.forEach((chunk, ci) => {
      const cid = ic.run(pid, ci, chunk.title).lastInsertRowid
      chunk.items.forEach((item, ij) => {
        const iid = ii.run(cid, ij, item.title).lastInsertRowid
        item.fields.forEach(([title, contents], cId) => ct.run(iid, cId, title, contents, 'string'))
      })
    })
  })()

  seed.close()
}

export async function saveDbToFile(filePath) {
  await db.backup(filePath)
}

export function loadDbFromFile(filePath) {
  db.exec('DELETE FROM contents; DELETE FROM items; DELETE FROM chunks; DELETE FROM payloads;')
  db.exec(`ATTACH DATABASE '${filePath.replace(/'/g, "''")}' AS src`)
  db.exec('INSERT INTO payloads SELECT * FROM src.payloads')
  db.exec('INSERT INTO chunks   SELECT * FROM src.chunks')
  db.exec('INSERT INTO items    SELECT * FROM src.items')
  db.exec('INSERT INTO contents SELECT * FROM src.contents')
  db.exec('DETACH DATABASE src')
}

export function queryAll() {
  return db.prepare(`
    SELECT
      p.name        AS payload_name,
      p.mode        AS payload_mode,
      p.saved_at,
      k.chunk_title,
      i.item_index,
      i.item_title,
      c.c_id,
      c.c_title,
      c.c_contents,
      c.c_override,
      c.c_type
    FROM payloads p
    JOIN chunks   k ON k.payload_id = p.id
    JOIN items    i ON i.chunk_id   = k.id
    JOIN contents c ON c.item_id    = i.id
    ORDER BY i.item_index, c.c_id
  `).all()
}

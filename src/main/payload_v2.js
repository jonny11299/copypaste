import { queryAllV2 } from './db.js'

export function buildPayloadV2() {
  const rows = queryAllV2()
  if (!rows.length) return null

  const first = rows[0]
  const payload = {
    id:               first.payload_id,
    name:             first.payload_name,
    mode:             first.mode,
    saved_at:         first.saved_at,
    activeChunkIndex: 0,
    chunks:           [],
  }

  const chunkMap = new Map()
  const itemMap  = new Map()

  for (const row of rows) {
    if (!chunkMap.has(row.chunk_id)) {
      const chunk = {
        id:              row.chunk_id,
        payload_id:      row.payload_id,
        chunk_index:     row.chunk_index,
        chunk_title:     row.chunk_title,
        activeItemIndex: 0,
        items:           [],
      }
      chunkMap.set(row.chunk_id, chunk)
      payload.chunks.push(chunk)
    }

    if (!itemMap.has(row.item_id)) {
      const item = {
        id:         row.item_id,
        chunk_id:   row.chunk_id,
        item_index: row.item_index,
        item_title: row.item_title,
        contents:   [],
      }
      itemMap.set(row.item_id, item)
      chunkMap.get(row.chunk_id).items.push(item)
    }

    itemMap.get(row.item_id).contents.push({
      id:         row.content_id,
      item_id:    row.item_id,
      c_id:       row.c_id,
      c_title:    row.c_title,
      c_contents: row.c_contents,
      c_override: row.c_override,
      c_type:     row.c_type,
    })
  }

  return payload
}

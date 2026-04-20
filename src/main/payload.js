/**
 * payload.js — Canonical copy/paste data structure
 *
 * The payload is the single contract between setup modules (programmatic,
 * 1x1, and any future type) and the overlay. Setup modules write payloads;
 * the overlay reads them generically — no mode-specific logic required.
 *
 * ─── c_id → keyboard shortcut mapping ────────────────────────────────────────
 *
 *   c_id  0  →  Ctrl+1          c_id 10  →  Ctrl+Shift+1
 *   c_id  1  →  Ctrl+2          c_id 11  →  Ctrl+Shift+2
 *   c_id  2  →  Ctrl+3          c_id 12  →  Ctrl+Shift+3
 *   c_id  3  →  Ctrl+4          c_id 13  →  Ctrl+Shift+4
 *   c_id  4  →  Ctrl+5          c_id 14  →  Ctrl+Shift+5
 *   c_id  5  →  Ctrl+6          c_id 15  →  Ctrl+Shift+6
 *   c_id  6  →  Ctrl+7          c_id 16  →  Ctrl+Shift+7
 *   c_id  7  →  Ctrl+8          c_id 17  →  Ctrl+Shift+8
 *   c_id  8  →  Ctrl+9          c_id 18  →  Ctrl+Shift+9
 *   c_id  9  →  Ctrl+0          c_id 19  →  Ctrl+Shift+0
 *
 * c_ids not present in an item's contents array are treated as blank:
 *   { c_id, c_title: '', c_contents: '' }
 *
 * ─── Payload shape ───────────────────────────────────────────────────────────
 *
 * {
 *   mode:  string,   // metadata only — 'programmatic' | '1x1' | etc.
 *                    // the overlay copy mechanism does not branch on mode.
 *   items: [
 *     {
 *       item_id:    number,   // 0-based index
 *       item_title: string,   // displayed in the item list (e.g. SLI name, PLI ID)
 *       contents: [
 *         {
 *           c_id:       number,  // 0–19, maps to the shortcut table above
 *           c_title:    string,  // label shown in the key reference panel
 *           c_contents: string,  // text written to clipboard on keypress
 *           c_type:     string,  // data type hint — default 'string', unused for now
 *         },
 *         // ... up to 20 entries; missing c_ids are treated as blank
 *       ]
 *     },
 *     // ... one entry per row/line/PLI
 *   ]
 * }
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Look up a content entry by c_id.
 * Returns a blank entry if the c_id is not present in the item.
 * @param {{ contents: Array }} item
 * @param {number} cId
 * @returns {{ c_id: number, c_title: string, c_contents: string }}
 */
function getContent(item, cId) {
  if (!item) return { c_id: cId, c_title: '', c_contents: '', c_type: 'string' }
  return item.contents.find(c => c.c_id === cId)
    ?? { c_id: cId, c_title: '', c_contents: '', c_type: 'string' }
}

/**
 * Build a single content entry.
 * @param {number} cId
 * @param {string} title    — label for the key reference panel
 * @param {string} contents — text written to clipboard
 * @param {string} [type]   — data type hint, default 'string'
 */
function makeContent(cId, title, contents, type = 'string') {
  return { c_id: cId, c_title: title, c_contents: contents, c_type: type }
}

/**
 * Returns the blank payload shown on first launch.
 * 8 placeholder items, all slots empty — copying does nothing.
 */
function blankPayload() {
  return {
    mode: 'none',
    items: Array.from({ length: 8 }, (_, i) => ({
      item_id:    i,
      item_title: `Item ${i + 1}`,
      contents:   [],
    })),
  }
}

export { getContent, makeContent, blankPayload }

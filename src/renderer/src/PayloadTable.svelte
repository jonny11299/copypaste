<script>
  import { onMount } from 'svelte'

  let rows    = []
  let loading = true
  let error   = null

  onMount(async () => {
    try {
      rows = await window.api.queryDb()
    } catch (e) {
      error = e.message
    } finally {
      loading = false
    }
  })

  // ── Chunk tabs ─────────────────────────────────────────────────────────────
  $: chunkTitles = [...new Map(rows.map(r => [r.chunk_title, r.chunk_title])).keys()]
  let activeChunk = null
  $: if (chunkTitles.length && !activeChunk) activeChunk = chunkTitles[0]
  $: chunkRows = rows.filter(r => r.chunk_title === activeChunk)

  $: meta = rows[0] ?? null

  // ── Column definitions ─────────────────────────────────────────────────────
  const COLS = [
    { key: 'item_index', label: 'item_index', numeric: true  },
    { key: 'item_title', label: 'item_title', numeric: false },
    { key: 'c_id',       label: 'c_id',       numeric: true  },
    { key: 'c_title',    label: 'c_title',    numeric: false },
    { key: 'c_contents', label: 'c_contents', numeric: false },
    { key: 'c_override', label: 'c_override', numeric: false },
    { key: 'c_type',     label: 'c_type',     numeric: false },
  ]

  // ── Per-chunk sort+filter state ───────────────────────────────────────────
  // Keyed by chunk title; initialized lazily in event handlers.
  let chunkState = {}

  function ensureCS(chunk) {
    if (!chunkState[chunk]) chunkState[chunk] = { filters: {}, sortCol: null, sortDir: 'asc' }
  }

  // Direct references to chunkState so Svelte tracks the dependency correctly.
  $: cs      = chunkState[activeChunk] ?? { filters: {}, sortCol: null, sortDir: 'asc' }
  $: filters = cs.filters
  $: sortCol = cs.sortCol
  $: sortDir = cs.sortDir

  function toggleSort(key) {
    ensureCS(activeChunk)
    const s = chunkState[activeChunk]
    if (s.sortCol === key) s.sortDir = s.sortDir === 'asc' ? 'desc' : 'asc'
    else { s.sortCol = key; s.sortDir = 'asc' }
    chunkState = { ...chunkState }
  }

  // ── Filter ─────────────────────────────────────────────────────────────────
  // Panel owns its own checkbox state — single source of truth for what's checked
  let panelCol   = null
  let panelPos   = { x: 0, y: 0 }
  let panelState = {}   // val (string) → boolean

  $: panelAllChecked = Object.values(panelState).length > 0 && Object.values(panelState).every(Boolean)

  function uniqueVals(key) {
    const isNum = COLS.find(c => c.key === key)?.numeric
    return [...new Set(chunkRows.map(r => String(r[key] ?? 'NULL')))].sort((a, b) =>
      isNum ? Number(a) - Number(b) : a.localeCompare(b)
    )
  }

  function openFilter(key, btn) {
    if (panelCol === key) { panelCol = null; return }
    const rect = btn.getBoundingClientRect()
    panelPos   = { x: rect.left, y: rect.bottom + 4 }
    const activeSet = chunkState[activeChunk]?.filters[key]
    panelState = Object.fromEntries(
      uniqueVals(key).map(v => [v, !activeSet || activeSet.has(v)])
    )
    panelCol = key
  }

  function syncFilterFromPanel() {
    ensureCS(activeChunk)
    const s        = chunkState[activeChunk]
    const all      = uniqueVals(panelCol)
    const included = all.filter(v => panelState[v])
    if (included.length === all.length) delete s.filters[panelCol]
    else s.filters[panelCol] = new Set(included)
    chunkState = { ...chunkState }
  }

  function togglePanelAll() {
    panelState = Object.fromEntries(Object.keys(panelState).map(k => [k, !panelAllChecked]))
    syncFilterFromPanel()
  }

  $: hasFilter = key => !!(chunkState[activeChunk]?.filters[key])

  function switchChunk(title) {
    activeChunk = title
    panelCol    = null
  }

  // ── Row copy ───────────────────────────────────────────────────────────────
  let copiedRow    = null
  let copyTimeout  = null

  function copyRow(row) {
    if (!row.c_contents) return
    window.api.writeClipboard(String(row.c_contents))
    copiedRow = `${row.item_index}|${row.c_id}`
    clearTimeout(copyTimeout)
    copyTimeout = setTimeout(() => copiedRow = null, 600)
  }

  // ── Display rows pipeline ──────────────────────────────────────────────────
  let displayRows = []
  $: {
    const { filters: f, sortCol: sc, sortDir: sd } = chunkState[activeChunk] ?? { filters: {}, sortCol: null, sortDir: 'asc' }
    let r = chunkRows

    r = r.filter(row =>
      COLS.every(col => {
        const cf = f[col.key]
        if (!cf) return true
        return cf.has(String(row[col.key] ?? 'NULL'))
      })
    )

    if (sc) {
      const isNum = COLS.find(c => c.key === sc)?.numeric
      r = [...r].sort((a, b) => {
        const av = a[sc] ?? ''
        const bv = b[sc] ?? ''
        const cmp = isNum ? Number(av) - Number(bv) : String(av).localeCompare(String(bv))
        return sd === 'asc' ? cmp : -cmp
      })
    }

    let band = false, lastKey = null
    displayRows = r.map(row => {
      const k = `${row.item_index}|${row.item_title}`
      if (k !== lastKey) { band = !band; lastKey = k }
      return { ...row, _band: band }
    })
  }
</script>

<svelte:window on:click={e => {
  if (panelCol && !e.target.closest('.filter-panel') && !e.target.closest('.filter-btn'))
    panelCol = null
}} />

<div class="window">
  <div class="titlebar">
    <span class="title">SQL Table — Payload Contents</span>
    <button class="close-btn" on:click={() => window.api.closePayloadTable()}>✕</button>
  </div>

  {#if loading}
    <div class="status">Loading…</div>
  {:else if error}
    <div class="status error">Error: {error}</div>
  {:else if rows.length === 0}
    <div class="status">No data. Run setup and load an Excel file first.</div>
  {:else}
    <div class="meta">
      <span><strong>Payload:</strong> {meta.payload_name}</span>
      <span><strong>Mode:</strong> {meta.payload_mode}</span>
      <span><strong>Saved:</strong> {new Date(meta.saved_at).toLocaleString()}</span>
    </div>

    {#if chunkTitles.length > 1}
      <div class="tab-strip">
        {#each chunkTitles as title}
          <button
            class="tab"
            class:active={activeChunk === title}
            on:click={() => switchChunk(title)}
          >{title}</button>
        {/each}
      </div>
    {/if}

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            {#each COLS as col}
              <th class:sorted={sortCol === col.key}>
                <div class="th-inner">
                  <button class="sort-btn" on:click={() => toggleSort(col.key)}>
                    {col.label}
                    <span class="sort-icon">
                      {#if sortCol === col.key}{sortDir === 'asc' ? '↑' : '↓'}{:else}⇅{/if}
                    </span>
                  </button>
                  <button
                    class="filter-btn"
                    class:filter-active={hasFilter(col.key)}
                    title="Filter"
                    on:click|stopPropagation={e => openFilter(col.key, e.currentTarget)}
                  >▽</button>
                </div>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each displayRows as row}
            {@const rowKey = `${row.item_index}|${row.c_id}`}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <tr
              class:band={row._band}
              class:copied={copiedRow === rowKey}
              class:copyable={!!row.c_contents}
              on:click={() => copyRow(row)}
            >
              <td class="num">{row.item_index}</td>
              <td class="label">{row.item_title}</td>
              <td class="num">{row.c_id}</td>
              <td class="label">{row.c_title}</td>
              <td class="contents">{row.c_contents}</td>
              <td class="null">{row.c_override ?? 'NULL'}</td>
              <td>{row.c_type}</td>
            </tr>
          {/each}
          {#if displayRows.length === 0}
            <tr><td colspan="7" class="empty">No rows match the current filter.</td></tr>
          {/if}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Filter panel at root level — not clipped by table overflow -->
{#if panelCol}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    class="filter-panel"
    style="left:{panelPos.x}px; top:{panelPos.y}px"
    on:click|stopPropagation
  >
    <label class="filter-row filter-all">
      <input type="checkbox" checked={panelAllChecked} on:change={togglePanelAll} />
      <span>(Select All)</span>
    </label>
    <div class="filter-divider"></div>
    {#each Object.keys(panelState) as val}
      <label class="filter-row">
        <input type="checkbox" bind:checked={panelState[val]} on:change={syncFilterFromPanel} />
        <span class="filter-val">{val}</span>
      </label>
    {/each}
  </div>
{/if}

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body) {
    background: #0d0d12;
    font-family: system-ui, -apple-system, sans-serif;
    color: #e2e2e2;
    overflow: hidden;
  }

  .window {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── Titlebar ── */
  .titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(255,255,255,0.03);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
    -webkit-app-region: drag;
  }

  .title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #999;
  }

  .close-btn {
    -webkit-app-region: no-drag;
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 3px;
    transition: background 0.15s, color 0.15s;
  }
  .close-btn:hover { background: rgba(255,95,87,0.2); color: #ff5f57; }

  /* ── Meta ── */
  .meta {
    display: flex;
    gap: 20px;
    padding: 8px 12px;
    font-size: 11px;
    color: #888;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
  }
  .meta strong { color: #bbb; }

  /* ── Tabs ── */
  .tab-strip {
    display: flex;
    gap: 2px;
    padding: 6px 12px 0;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
    background: rgba(255,255,255,0.01);
  }

  .tab {
    padding: 5px 14px;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    color: #666;
    background: none;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    cursor: pointer;
    transition: color 0.12s, background 0.12s;
    white-space: nowrap;
    position: relative;
    bottom: -1px;
  }
  .tab:hover { color: #aaa; background: rgba(255,255,255,0.04); }
  .tab.active { color: #a5b4fc; background: #0d0d12; border-color: rgba(255,255,255,0.07); }

  /* ── Table ── */
  .table-wrap { flex: 1; overflow: auto; }

  table { width: 100%; border-collapse: collapse; font-size: 11px; }

  thead {
    position: sticky;
    top: 0;
    background: #0d0d12;
    z-index: 10;
  }

  th {
    padding: 0;
    text-align: left;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: #666;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    white-space: nowrap;
  }
  th.sorted { color: #a5b4fc; }

  .th-inner { display: flex; align-items: center; gap: 2px; }

  .sort-btn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 6px 6px 10px;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    font-weight: 600;
    letter-spacing: 0.05em;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    transition: color 0.12s;
  }
  .sort-btn:hover { color: #c4c9ff; }

  .sort-icon { font-size: 9px; opacity: 0.5; flex-shrink: 0; }
  th.sorted .sort-icon { opacity: 1; }

  .filter-btn {
    padding: 4px 6px;
    background: none;
    border: none;
    color: #444;
    font-size: 9px;
    cursor: pointer;
    border-radius: 3px;
    transition: color 0.12s, background 0.12s;
    flex-shrink: 0;
    line-height: 1;
  }
  .filter-btn:hover         { color: #888; background: rgba(255,255,255,0.06); }
  .filter-btn.filter-active { color: #6366f1; }

  /* ── Table body ── */
  td {
    padding: 5px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    vertical-align: top;
    color: #ccc;
  }

  tr.band td { background: rgba(255,255,255,0.025); }

  tr.copyable { cursor: pointer; }
  tr.copyable:hover td { background: rgba(99,102,241,0.08); }
  tr.copied td { background: rgba(99,102,241,0.22) !important; }
  tr.copied .contents { color: #a5b4fc; }

  .num      { color: #6366f1; font-variant-numeric: tabular-nums; width: 60px; }
  .label    { color: #a5b4fc; white-space: nowrap; }
  .contents { color: #e2e2e2; max-width: 320px; word-break: break-word; }
  .null     { color: #444; font-style: italic; }
  .empty    { color: #444; font-style: italic; text-align: center; padding: 20px; }

  /* ── Status ── */
  .status { flex: 1; display: flex; align-items: center; justify-content: center; color: #666; font-size: 13px; }
  .status.error { color: #ff5f57; }

  /* ── Filter panel ── */
  .filter-panel {
    position: fixed;
    z-index: 200;
    background: #1a1a28;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px;
    padding: 4px 0;
    min-width: 180px;
    max-width: 280px;
    max-height: 300px;
    overflow-y: auto;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  .filter-panel::-webkit-scrollbar { width: 4px; }
  .filter-panel::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 2px; }

  .filter-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px;
    cursor: pointer;
    transition: background 0.08s;
    user-select: none;
  }
  .filter-row:hover { background: rgba(255,255,255,0.05); }
  .filter-row input { accent-color: #6366f1; cursor: pointer; flex-shrink: 0; }

  .filter-all { font-weight: 600; color: #aaa; font-size: 11px; }

  .filter-val {
    font-size: 11px;
    color: #ccc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .filter-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 3px 0; }
</style>

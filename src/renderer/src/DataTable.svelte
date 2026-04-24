<script>
  import { onMount } from 'svelte'

  // ── Props ──────────────────────────────────────────────────────────────────
  export let rows        = []   // array of plain objects
  export let columns     = []   // { key, label, numeric }[]
  export let tabBy       = null // field name to split rows into tabs
  export let alignRowsBy = null // field name to group rows for alternating bands
  export let onRowClick  = null // (row) => void
  export let rowKey      = null // (row) => string — if omitted, auto_id is used

  // ── auto_id ingestion ──────────────────────────────────────────────────────
  // Stamped onto each row once when the rows prop is received. Travels with the
  // row through sort/filter just like any other field.
  let ingestedRows = []
  let effectiveCols = []

  $: {
    ingestedRows = rows.map((r, i) => ({ auto_id: i, ...r }))
    const autoIdCol = { key: 'auto_id', label: 'auto_id', numeric: true }
    effectiveCols = rowKey ? columns : [autoIdCol, ...columns]
  }

  $: effectiveRowKey = rowKey ?? (row => String(row.auto_id))

  // ── Tab state ──────────────────────────────────────────────────────────────
  $: tabTitles = tabBy
    ? [...new Map(ingestedRows.map(r => [r[tabBy], r[tabBy]])).keys()]
    : null

  let activeTab = null
  $: if (tabTitles?.length && !activeTab) activeTab = tabTitles[0]

  $: tabRows = tabBy && activeTab
    ? ingestedRows.filter(r => r[tabBy] === activeTab)
    : ingestedRows

  function switchTab(title) {
    activeTab = title
    panelCol  = null
  }

  // ── Per-tab sort + filter state ────────────────────────────────────────────
  let tabState = {}

  function tabKey() { return tabBy ? (activeTab ?? '__all__') : '__all__' }

  function ensureTS(k) {
    if (!tabState[k]) tabState[k] = { filters: {}, sortCol: null, sortDir: 'asc' }
  }

  $: ts      = tabState[tabKey()] ?? { filters: {}, sortCol: null, sortDir: 'asc' }
  $: filters = ts.filters
  $: sortCol = ts.sortCol
  $: sortDir = ts.sortDir

  function toggleSort(key) {
    const k = tabKey()
    ensureTS(k)
    const s = tabState[k]
    if (s.sortCol === key) s.sortDir = s.sortDir === 'asc' ? 'desc' : 'asc'
    else { s.sortCol = key; s.sortDir = 'asc' }
    tabState = { ...tabState }
  }

  // ── Filter panel ───────────────────────────────────────────────────────────
  let panelCol   = null
  let panelPos   = { x: 0, y: 0 }
  let panelState = {}

  $: panelAllChecked = Object.values(panelState).length > 0 && Object.values(panelState).every(Boolean)

  function uniqueVals(key) {
    const isNum = effectiveCols.find(c => c.key === key)?.numeric
    return [...new Set(tabRows.map(r => String(r[key] ?? 'NULL')))].sort((a, b) =>
      isNum ? Number(a) - Number(b) : a.localeCompare(b)
    )
  }

  function openFilter(key, btn) {
    if (panelCol === key) { panelCol = null; return }
    const rect = btn.getBoundingClientRect()
    panelPos   = { x: rect.left, y: rect.bottom + 4 }
    const k         = tabKey()
    const activeSet = tabState[k]?.filters[key]
    panelState = Object.fromEntries(
      uniqueVals(key).map(v => [v, !activeSet || activeSet.has(v)])
    )
    panelCol = key
  }

  function syncFilterFromPanel() {
    const k = tabKey()
    ensureTS(k)
    const s        = tabState[k]
    const all      = uniqueVals(panelCol)
    const included = all.filter(v => panelState[v])
    if (included.length === all.length) delete s.filters[panelCol]
    else s.filters[panelCol] = new Set(included)
    tabState = { ...tabState }
  }

  function togglePanelAll() {
    panelState = Object.fromEntries(Object.keys(panelState).map(k => [k, !panelAllChecked]))
    syncFilterFromPanel()
  }

  $: hasFilter = key => !!(tabState[tabKey()]?.filters[key])

  // ── Display rows pipeline ──────────────────────────────────────────────────
  let displayRows = []
  $: {
    const { filters: f, sortCol: sc, sortDir: sd } = tabState[tabKey()] ?? { filters: {}, sortCol: null, sortDir: 'asc' }
    let r = tabRows

    r = r.filter(row =>
      effectiveCols.every(col => {
        const cf = f[col.key]
        if (!cf) return true
        return cf.has(String(row[col.key] ?? 'NULL'))
      })
    )

    if (sc) {
      const isNum = effectiveCols.find(c => c.key === sc)?.numeric
      r = [...r].sort((a, b) => {
        const av = a[sc] ?? ''
        const bv = b[sc] ?? ''
        const cmp = isNum ? Number(av) - Number(bv) : String(av).localeCompare(String(bv))
        return sd === 'asc' ? cmp : -cmp
      })
    }

    let band = false, lastBandVal = null
    displayRows = r.map(row => {
      const bandVal = alignRowsBy ? String(row[alignRowsBy] ?? '') : effectiveRowKey(row)
      if (bandVal !== lastBandVal) { band = !band; lastBandVal = bandVal }
      return { ...row, _band: band }
    })
  }

  // ── Column resizing ────────────────────────────────────────────────────────
  let colWidths = {}   // { [key]: widthPx }
  let resizing  = null // { key, startX, startWidth }

  const DEFAULT_COL_WIDTH = 128  // px (~8rem)

  $: anyResized  = Object.keys(colWidths).length > 0
  $: tableWidth  = effectiveCols.reduce((s, c) => s + (colWidths[c.key] ?? DEFAULT_COL_WIDTH), 0)

  function startResize(e, key) {
    const th = e.currentTarget.closest('th')
    const startWidth = colWidths[key] ?? th.getBoundingClientRect().width
    resizing = { key, startX: e.clientX, startWidth }
    document.body.style.cursor    = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  function onMousemove(e) {
    if (!resizing) return
    const newWidth = Math.max(40, resizing.startWidth + (e.clientX - resizing.startX))
    colWidths = { ...colWidths, [resizing.key]: newWidth }
  }

  function onMouseup() {
    if (!resizing) return
    resizing = null
    document.body.style.cursor    = ''
    document.body.style.userSelect = ''
  }

  // ── Row highlight (click flash) ────────────────────────────────────────────
  let highlightedKey = null
  let highlightTimeout = null

  function handleRowClick(row) {
    if (!onRowClick) return
    onRowClick(row)
    highlightedKey = effectiveRowKey(row)
    clearTimeout(highlightTimeout)
    highlightTimeout = setTimeout(() => highlightedKey = null, 600)
  }
</script>

<svelte:window
  on:click={e => {
    if (panelCol && !e.target.closest('.filter-panel') && !e.target.closest('.filter-btn'))
      panelCol = null
  }}
  on:mousemove={onMousemove}
  on:mouseup={onMouseup}
/>

<div class="datatable-root">
  {#if tabTitles && tabTitles.length > 1}
    <div class="tab-strip">
      {#each tabTitles as title}
        <button
          class="tab"
          class:active={activeTab === title}
          on:click={() => switchTab(title)}
        >{title}</button>
      {/each}
    </div>
  {/if}

  <div class="table-wrap">
    <table style={anyResized ? `table-layout: fixed; width: ${tableWidth}px;` : ''}>
      <thead>
        <tr>
          {#each effectiveCols as col}
            <th
              class:sorted={sortCol === col.key}
              style={colWidths[col.key] ? `width: ${colWidths[col.key]}px; max-width: none;` : ''}
            >
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
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="col-resizer"
                on:mousedown|preventDefault={e => startResize(e, col.key)}
              />
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each displayRows as row}
          {@const rk = effectiveRowKey(row)}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <tr
            class:band={row._band}
            class:highlighted={highlightedKey === rk}
            class:clickable={!!onRowClick}
            on:click={() => handleRowClick(row)}
          >
            {#each effectiveCols as col}
              <td>{row[col.key] ?? ''}</td>
            {/each}
          </tr>
        {/each}
        {#if displayRows.length === 0}
          <tr>
            <td colspan={effectiveCols.length} class="empty">No rows match the current filter.</td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>

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
  .datatable-root {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

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
    position: relative;
    max-width: 8rem;
    overflow: hidden;
  }
  th.sorted { color: #a5b4fc; }

  .col-resizer {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 5px;
    cursor: ew-resize;
    z-index: 2;
  }
  .col-resizer:hover { background: rgba(99,102,241,0.45); }

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
    max-width: 8rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  tr.band td { background: rgba(255,255,255,0.025); }

  tr.clickable { cursor: pointer; }
  tr.clickable:hover td { background: rgba(99,102,241,0.08); }
  tr.highlighted td { background: rgba(99,102,241,0.22) !important; }

  .empty { color: #444; font-style: italic; text-align: center; padding: 20px; }

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

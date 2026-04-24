<script>
  import { colLabelToIndex } from './colUtils.js'

  export let rows            = []
  export let activeMode      = null
  export let tabMapping      = null
  export let activeTab       = null
  export let areaFirstCorner = null   // { rowIdx, col } | null
  export let onTabChange          = (_tab)          => {}
  export let onHeaderRowSelect    = (_rowIdx)       => {}
  export let onColumnToggle       = (_col)          => {}
  export let onAreaCornerClick    = (_rowIdx, _col) => {}

  // ── Derived ────────────────────────────────────────────────────────────────
  $: tabNames = [...new Map(rows.map(r => [r.chunk_title, true])).keys()]
  $: tabRows  = activeTab ? rows.filter(r => r.chunk_title === activeTab) : []
  $: dataCols = rows.length > 0
    ? Object.keys(rows[0]).filter(k => k !== 'chunk_title' && k !== '_row_idx')
    : []

  // ── Reactive selection state ───────────────────────────────────────────────
  $: headerRowIdx   = tabMapping?.header_row ?? -1
  $: relevantColSet = new Set(tabMapping?.relevant_columns ?? [])
  $: relevantArea   = tabMapping?.relevant_area ?? null

  // ── Hover state for area preview ───────────────────────────────────────────
  let hoveredCell = null   // { rowIdx, col } | null
  let hoveredCol  = null   // col label | null

  $: previewArea = (() => {
    if (activeMode !== 'relevant-area' || !areaFirstCorner || !hoveredCell) return null
    const r1 = areaFirstCorner.rowIdx, r2 = hoveredCell.rowIdx
    const c1 = colLabelToIndex(areaFirstCorner.col), c2 = colLabelToIndex(hoveredCell.col)
    return {
      row_start: Math.min(r1, r2), row_end: Math.max(r1, r2),
      col_start: Math.min(c1, c2), col_end: Math.max(c1, c2),
    }
  })()

  // ── Per-cell class helpers ─────────────────────────────────────────────────
  // All reactive vars are passed explicitly so Svelte tracks them as template dependencies.
  function cellClasses(rowIdx, col, _colSet, _area, _corner, _preview, _mode, _hovCol, _hovCell) {
    const ci = colLabelToIndex(col)
    const inRelevantArea = _area
      ? rowIdx >= _area.row_start && rowIdx <= _area.row_end
        && ci >= colLabelToIndex(_area.col_start) && ci <= colLabelToIndex(_area.col_end)
      : false
    const isFirstCorner = _corner?.rowIdx === rowIdx && _corner?.col === col
    const inPreview = _preview
      ? rowIdx >= _preview.row_start && rowIdx <= _preview.row_end
        && ci >= _preview.col_start && ci <= _preview.col_end
      : false
    return {
      'cell-col-relevant': _colSet.has(col),
      'cell-area':         inRelevantArea,
      'cell-first-corner': isFirstCorner,
      'cell-preview':      inPreview && !isFirstCorner,
      'cell-clickable':    _mode === 'relevant-area' || _mode === 'relevant-columns',
      'cell-col-hover':    _mode === 'relevant-columns' && _hovCol === col && !_colSet.has(col),
      'cell-hover':        _mode === 'relevant-area' && !_corner && _hovCell?.rowIdx === rowIdx && _hovCell?.col === col,
    }
  }

  // ── Click / hover handlers ─────────────────────────────────────────────────
  function handleRowClick(rowIdx) {
    if (activeMode === 'header-row') onHeaderRowSelect(rowIdx)
  }

  function handleColHeaderClick(col, e) {
    if (e.target.closest('.col-resizer')) return
    if (activeMode === 'relevant-columns') onColumnToggle(col)
    else if (activeMode === 'relevant-area') onAreaCornerClick(0, col)
  }

  function handleCellClick(rowIdx, col) {
    if (activeMode === 'relevant-area')    onAreaCornerClick(rowIdx, col)
    else if (activeMode === 'relevant-columns') onColumnToggle(col)
  }

  function handleCellEnter(rowIdx, col) {
    if (activeMode === 'relevant-area') hoveredCell = { rowIdx, col }
    if (activeMode === 'relevant-columns') hoveredCol = col
  }

  function handleCellLeave() {
    hoveredCell = null
    hoveredCol  = null
  }

  // ── Column resizing ────────────────────────────────────────────────────────
  let colWidths = {}
  let resizing  = null
  const DEFAULT_COL_WIDTH = 128

  $: anyResized = Object.keys(colWidths).length > 0
  $: tableWidth = dataCols.reduce((s, c) => s + (colWidths[c] ?? DEFAULT_COL_WIDTH), 0) + 52

  function startResize(e, col) {
    const th = e.currentTarget.closest('th')
    const startWidth = colWidths[col] ?? th.getBoundingClientRect().width
    resizing = { col, startX: e.clientX, startWidth }
    document.body.style.cursor     = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  function onMousemove(e) {
    if (!resizing) return
    colWidths = { ...colWidths, [resizing.col]: Math.max(40, resizing.startWidth + (e.clientX - resizing.startX)) }
  }

  function onMouseup() {
    if (!resizing) return
    resizing = null
    document.body.style.cursor     = ''
    document.body.style.userSelect = ''
  }

  // ── Mode hint text ─────────────────────────────────────────────────────────
  $: hintText = (() => {
    if (!activeMode) return ''
    if (activeMode === 'header-row')       return 'Click any row to mark it as the headers row'
    if (activeMode === 'relevant-columns') return 'Click any cell or column letter to toggle relevant columns on/off'
    if (activeMode === 'relevant-area')    return areaFirstCorner
      ? 'Click a second cell to complete the bounding box'
      : 'Click any cell to set the first corner of the relevant area'
    return ''
  })()
</script>

<svelte:window on:mousemove={onMousemove} on:mouseup={onMouseup} />

<div class="direct-table">

  <!-- ── Titlebar / tab strip ────────────────────────────────────────────── -->
  <div class="titlebar">
    <div class="tab-strip">
      {#each tabNames as tab}
        <button
          class="tab"
          class:active={activeTab === tab}
          on:click={() => onTabChange(tab)}
        >{tab}</button>
      {/each}
    </div>
    <button class="close-btn" on:click={() => window.api.closeDirectFileView()}>✕</button>
  </div>

  <!-- ── Mode hint banner ────────────────────────────────────────────────── -->
  {#if activeMode}
    <div
      class="mode-hint"
      class:hint-header ={activeMode === 'header-row'}
      class:hint-columns={activeMode === 'relevant-columns'}
      class:hint-area   ={activeMode === 'relevant-area'}
    >{hintText}</div>
  {/if}

  <!-- ── Table ───────────────────────────────────────────────────────────── -->
  <div class="table-wrap">
    <table style={anyResized ? `table-layout: fixed; width: ${tableWidth}px;` : ''}>
      <thead>
        <tr>
          <th class="row-num-col"></th>
          {#each dataCols as col}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <th
              class:col-relevant={relevantColSet.has(col)}
              class:col-clickable={activeMode === 'relevant-columns' || activeMode === 'relevant-area'}
              style={colWidths[col] ? `width: ${colWidths[col]}px; max-width: none;` : ''}
              on:click={e => handleColHeaderClick(col, e)}
            >
              <div class="th-inner">
                <span class="col-label">{col}</span>
              </div>
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div class="col-resizer" on:mousedown|preventDefault={e => startResize(e, col)} />
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each tabRows as row (row._row_idx)}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <tr
            class:row-header   ={row._row_idx === headerRowIdx}
            class:row-clickable={activeMode === 'header-row'}
            on:click={() => handleRowClick(row._row_idx)}
          >
            <td class="row-num">{row._row_idx}</td>
            {#each dataCols as col}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <td
                class={Object.entries(cellClasses(row._row_idx, col, relevantColSet, relevantArea, areaFirstCorner, previewArea, activeMode, hoveredCol, hoveredCell)).filter(([,v]) => v).map(([k]) => k).join(' ')}
                on:click={() => handleCellClick(row._row_idx, col)}
                on:mouseenter={() => handleCellEnter(row._row_idx, col)}
                on:mouseleave={handleCellLeave}
              >{row[col] ?? ''}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .direct-table {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
  }

  /* ── Titlebar ── */
  .titlebar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding-right: 8px;
    background: rgba(255,255,255,0.03);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
    -webkit-app-region: drag;
  }

  .tab-strip {
    display: flex;
    gap: 2px;
    padding: 6px 0 0 8px;
    -webkit-app-region: no-drag;
  }

  .tab {
    padding: 5px 14px;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    color: #555;
    background: none;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    cursor: pointer;
    transition: color 0.12s, background 0.12s;
    white-space: nowrap;
    position: relative;
    bottom: -1px;
    -webkit-app-region: no-drag;
  }
  .tab:hover { color: #999; background: rgba(255,255,255,0.04); }
  .tab.active { color: #a5b4fc; background: #0d0d12; border-color: rgba(255,255,255,0.07); }

  .close-btn {
    -webkit-app-region: no-drag;
    background: none;
    border: none;
    color: #555;
    cursor: pointer;
    font-size: 12px;
    padding: 4px 6px;
    border-radius: 3px;
    margin-bottom: 4px;
    transition: background 0.15s, color 0.15s;
  }
  .close-btn:hover { background: rgba(255,95,87,0.2); color: #ff5f57; }

  /* ── Mode hint ── */
  .mode-hint {
    padding: 6px 14px;
    font-size: 11px;
    font-weight: 500;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .hint-header  { background: rgba(0, 212, 255, 0.08);  color: #00d4ff; }
  .hint-columns { background: rgba(255, 105, 180, 0.08); color: #ff69b4; }
  .hint-area    { background: rgba(50, 205, 50, 0.08);   color: #32cd32; }

  /* ── Table ── */
  .table-wrap { flex: 1; overflow: auto; }

  table { width: 100%; border-collapse: collapse; font-size: 11px; }

  thead { position: sticky; top: 0; background: #0d0d12; z-index: 10; }

  th {
    padding: 0;
    text-align: left;
    font-weight: 600;
    color: #555;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    white-space: nowrap;
    position: relative;
    max-width: 8rem;
    overflow: hidden;
  }

  .row-num-col { width: 48px; flex-shrink: 0; }

  th.col-relevant  { background: rgba(255, 105, 180, 0.18); color: #ff69b4; }
  th.col-clickable { cursor: pointer; }
  th.col-clickable:hover:not(.col-relevant) { background: rgba(255, 105, 180, 0.07); }

  .th-inner {
    display: flex;
    align-items: center;
    padding: 6px 10px;
  }

  .col-label { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; }

  .col-resizer {
    position: absolute;
    right: 0; top: 0; bottom: 0;
    width: 5px;
    cursor: ew-resize;
    z-index: 2;
  }
  .col-resizer:hover { background: rgba(99,102,241,0.45); }

  td {
    padding: 4px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    vertical-align: top;
    color: #bbb;
    max-width: 8rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-num {
    color: #383838;
    font-size: 10px;
    text-align: right;
    padding-right: 8px;
    user-select: none;
  }

  /* ── Row states ── */
  tr.row-header td               { background: rgba(0, 212, 255, 0.10); }
  tr.row-header .row-num         { background: rgba(0, 212, 255, 0.10); color: #00d4ff; }
  tr.row-clickable               { cursor: pointer; }
  tr.row-clickable:hover td      { background: rgba(0, 212, 255, 0.05); }
  tr.row-header.row-clickable:hover td { background: rgba(0, 212, 255, 0.16); }

  /* ── Cell states ── */
  td.cell-col-relevant  { background: rgba(255, 105, 180, 0.06); }
  td.cell-area          { background: rgba(50, 205, 50, 0.10); }
  td.cell-first-corner  { background: rgba(50, 205, 50, 0.40) !important; }
  td.cell-preview       { background: rgba(50, 205, 50, 0.06); outline: 1px dashed rgba(50, 205, 50, 0.3); outline-offset: -1px; }
  td.cell-clickable     { cursor: crosshair; }
  td.cell-col-hover     { background: rgba(255, 105, 180, 0.07); }
  td.cell-hover         { background: rgba(50, 205, 50, 0.07); }
</style>

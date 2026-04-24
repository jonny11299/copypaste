<script>
  import { onMount } from 'svelte'
  import { colLabel, colLabelToIndex } from './colUtils.js'
  import Palette    from './Palette.svelte'
  import DirectTable from './DirectTable.svelte'

  // ── Data ───────────────────────────────────────────────────────────────────
  let rows     = []
  let fileName = null
  let loading  = true
  let error    = null

  // ── Selection state ────────────────────────────────────────────────────────
  let activeMode      = null   // null | 'header-row' | 'relevant-columns' | 'relevant-area'
  let activeTab       = null
  let areaFirstCorner = null   // { rowIdx, col } | null

  // ── Mappings ───────────────────────────────────────────────────────────────
  // Array of: { tab_name, tab_id, header_row, relevant_columns, relevant_area }
  let mappings = []

  $: tabNames   = [...new Map(rows.map(r => [r.chunk_title, true])).keys()]
  $: if (tabNames.length && !activeTab) activeTab = tabNames[0]
  $: activeTabId  = tabNames.indexOf(activeTab)
  $: tabMapping   = mappings.find(m => m.tab_id === activeTabId) ?? null

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(async () => {
    try {
      const data = await window.api.getDirectFileData()
      rows     = data.rows ?? []
      fileName = data.fileName

      if (fileName) {
        const existing = await window.api.getDirectMapping(fileName)
        if (existing?.tabs) mappings = existing.tabs
      }
    } catch (e) {
      error = e.message
    } finally {
      loading = false
    }
  })

  // ── Mapping helpers ────────────────────────────────────────────────────────
  function updateTabMapping(updates) {
    const exists = mappings.find(m => m.tab_id === activeTabId)
    if (exists) {
      mappings = mappings.map(m =>
        m.tab_id === activeTabId ? { ...m, ...updates } : m
      )
    } else {
      mappings = [...mappings, {
        tab_name: activeTab,
        tab_id: activeTabId,
        header_row: null,
        relevant_columns: [],
        relevant_area: null,
        ...updates,
      }]
    }
    saveMappings()
  }

  async function saveMappings() {
    if (!fileName) return
    try {
      await window.api.saveDirectMapping({ fileName, tabs: mappings })
    } catch (e) {
      console.error('Failed to save mapping:', e)
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleModeChange(mode) {
    activeMode      = mode
    areaFirstCorner = null
  }

  function handleTabChange(tab) {
    activeTab       = tab
    activeMode      = null
    areaFirstCorner = null
  }

  function handleHeaderRowSelect(rowIdx) {
    updateTabMapping({ header_row: rowIdx })
    activeMode = null
  }

  function handleColumnToggle(col) {
    const current = tabMapping?.relevant_columns ?? []
    const next = current.includes(col)
      ? current.filter(c => c !== col)
      : [...current, col]
    updateTabMapping({ relevant_columns: next })
    // mode stays active — user toggles multiple columns
  }

  function handleAreaCornerClick(rowIdx, col) {
    if (!areaFirstCorner) {
      areaFirstCorner = { rowIdx, col }
    } else {
      const row_start = Math.min(areaFirstCorner.rowIdx, rowIdx)
      const row_end   = Math.max(areaFirstCorner.rowIdx, rowIdx)
      const c1 = colLabelToIndex(areaFirstCorner.col)
      const c2 = colLabelToIndex(col)
      updateTabMapping({
        relevant_area: {
          row_start,
          row_end,
          col_start: colLabel(Math.min(c1, c2)),
          col_end:   colLabel(Math.max(c1, c2)),
        }
      })
      areaFirstCorner = null
      activeMode      = null
    }
  }
</script>

<div class="layout">
  {#if loading}
    <div class="status">Loading…</div>
  {:else if error}
    <div class="status error">Error: {error}</div>
  {:else}
    <Palette
      {activeMode}
      {tabMapping}
      onModeChange={handleModeChange}
    />
    <div class="table-pane">
      <DirectTable
        {rows}
        {activeMode}
        {tabMapping}
        {activeTab}
        {areaFirstCorner}
        onTabChange={handleTabChange}
        onHeaderRowSelect={handleHeaderRowSelect}
        onColumnToggle={handleColumnToggle}
        onAreaCornerClick={handleAreaCornerClick}
      />
    </div>
  {/if}
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body) {
    background: #0d0d12;
    font-family: system-ui, -apple-system, sans-serif;
    color: #e2e2e2;
    overflow: hidden;
  }

  .layout {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: row;
  }

  .table-pane {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .status {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #555;
    font-size: 13px;
  }
  .status.error { color: #ff5f57; }
</style>

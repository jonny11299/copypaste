<script>
  export let activeMode   = null
  export let tabMapping   = null
  export let onModeChange = (_mode) => {}

  const MODES = [
    { id: 'header-row',       label: 'Headers Row',      color: '#00d4ff' },
    { id: 'relevant-columns', label: 'Relevant Columns', color: '#ff69b4' },
    { id: 'relevant-area',    label: 'Relevant Area',    color: '#32cd32' },
  ]

  function toggle(modeId) {
    onModeChange(activeMode === modeId ? null : modeId)
  }

  // modeData is recomputed whenever tabMapping changes, giving Svelte a direct
  // reactive dependency to track in the template.
  $: modeData = MODES.map(m => {
    let display = 'Not set'
    if (m.id === 'header-row') {
      display = tabMapping?.header_row != null ? `Row ${tabMapping.header_row}` : 'Not set'
    } else if (m.id === 'relevant-columns') {
      display = (tabMapping?.relevant_columns ?? []).length
        ? tabMapping.relevant_columns.join(', ')
        : 'Not set'
    } else if (m.id === 'relevant-area') {
      const a = tabMapping?.relevant_area
      display = a ? `${a.col_start}${a.row_start} : ${a.col_end}${a.row_end}` : 'Not set'
    }
    return { ...m, display }
  })
</script>

<div class="palette">
  <div class="palette-header">Palette</div>

  {#each modeData as mode}
    <button
      class="mode-item"
      class:active={activeMode === mode.id}
      on:click={() => toggle(mode.id)}
    >
      <span class="swatch" style="background: {mode.color}" />
      <span class="mode-info">
        <span class="mode-label">{mode.label}</span>
        <span class="mode-value">{mode.display}</span>
      </span>
    </button>
  {/each}
</div>

<style>
  .palette {
    width: 172px;
    flex-shrink: 0;
    background: rgba(255,255,255,0.015);
    border-right: 1px solid rgba(255,255,255,0.08);
    display: flex;
    flex-direction: column;
    padding-top: 8px;
  }

  .palette-header {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #444;
    padding: 4px 14px 12px;
  }

  .mode-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 14px;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background 0.12s, border-color 0.12s;
  }
  .mode-item:hover { background: rgba(255,255,255,0.04); }
  .mode-item.active {
    background: rgba(255,255,255,0.06);
    border-left-color: #6366f1;
  }

  .swatch {
    width: 11px;
    height: 11px;
    border-radius: 2px;
    flex-shrink: 0;
    margin-top: 2px;
    opacity: 0.9;
  }

  .mode-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .mode-label {
    font-size: 11px;
    font-weight: 600;
    color: #bbb;
    white-space: nowrap;
  }
  .mode-item.active .mode-label { color: #e2e2e2; }

  .mode-value {
    font-size: 10px;
    color: #484848;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 118px;
  }
  .mode-item.active .mode-value { color: #666; }
</style>

<script>
  import { onMount } from 'svelte'
  import DataTable from './DataTable.svelte'

  let rows    = []
  let columns = []
  let loading = true
  let error   = null

  onMount(async () => {
    try {
      rows = await window.api.queryDb()
      if (rows.length > 0) {
        columns = Object.keys(rows[0]).map(key => ({
          key,
          label: key,
          numeric: typeof rows[0][key] === 'number',
        }))
      }
    } catch (e) {
      error = e.message
    } finally {
      loading = false
    }
  })
</script>

<div class="window">
  <div class="titlebar">
    <span class="title">Generic SQL Table — DataTable.svelte</span>
    <button class="close-btn" on:click={() => window.api.closeGenericSqlTable()}>✕</button>
  </div>

  {#if loading}
    <div class="status">Loading…</div>
  {:else if error}
    <div class="status error">Error: {error}</div>
  {:else if rows.length === 0}
    <div class="status">No data.</div>
  {:else}
    <DataTable
      {rows}
      {columns}
      tabBy="chunk_title"
      alignRowsBy="item_title"
    />
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

  .window {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

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

  .status {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    font-size: 13px;
  }
  .status.error { color: #ff5f57; }
</style>

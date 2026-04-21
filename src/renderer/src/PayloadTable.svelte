<script>
  import { onMount } from 'svelte'

  let rows = []
  let loading = true
  let error = null

  onMount(async () => {
    try {
      rows = await window.api.queryDb()
    } catch (e) {
      error = e.message
    } finally {
      loading = false
    }
  })

  // Group rows by item for display banding
  $: groupedRows = rows.map((r, i) => ({
    ...r,
    _band: rows.findIndex(x => x.item_index === r.item_index && x.item_title === r.item_title) % 2 === 0,
  }))

  $: meta = rows[0] ?? null
</script>

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
      <span><strong>Chunk:</strong> {meta.chunk_title}</span>
      <span><strong>Saved:</strong> {new Date(meta.saved_at).toLocaleString()}</span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>item_index</th>
            <th>item_title</th>
            <th>c_id</th>
            <th>c_title</th>
            <th>c_contents</th>
            <th>c_override</th>
            <th>c_type</th>
          </tr>
        </thead>
        <tbody>
          {#each groupedRows as row}
            <tr class:band={row._band}>
              <td class="num">{row.item_index}</td>
              <td class="label">{row.item_title}</td>
              <td class="num">{row.c_id}</td>
              <td class="label">{row.c_title}</td>
              <td class="contents">{row.c_contents}</td>
              <td class="null">{row.c_override ?? 'NULL'}</td>
              <td>{row.c_type}</td>
            </tr>
          {/each}
        </tbody>
      </table>
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

  .table-wrap {
    flex: 1;
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  thead {
    position: sticky;
    top: 0;
    background: #0d0d12;
    z-index: 1;
  }

  th {
    padding: 6px 10px;
    text-align: left;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: #666;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    white-space: nowrap;
  }

  td {
    padding: 5px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    vertical-align: top;
    color: #ccc;
  }

  tr.band td { background: rgba(255,255,255,0.025); }

  .num  { color: #6366f1; font-variant-numeric: tabular-nums; width: 60px; }
  .label { color: #a5b4fc; white-space: nowrap; }
  .contents { color: #e2e2e2; max-width: 320px; word-break: break-word; }
  .null { color: #444; font-style: italic; }

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

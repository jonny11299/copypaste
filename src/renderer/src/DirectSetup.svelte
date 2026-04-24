<script>
  let fileName = null
  let loading  = false
  let error    = null

  async function openFile() {
    loading = true
    error   = null
    try {
      const name = await window.api.openXlsFileDialog()
      if (name) fileName = name
    } catch (e) {
      error = e.message
    } finally {
      loading = false
    }
  }
</script>

<div class="body">
  {#if loading}
    <p class="status">Loading…</p>
  {:else if fileName}
    <p class="status loaded">Loaded: {fileName}</p>
  {:else}
    <button class="action-btn" on:click={openFile}>Open .xls file</button>
    {#if error}<p class="status error">{error}</p>{/if}
  {/if}
</div>

<style>
  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 24px;
  }

  .action-btn {
    padding: 10px 28px;
    background: rgba(99,102,241,0.15);
    border: 1px solid rgba(99,102,241,0.4);
    border-radius: 6px;
    color: #a5b4fc;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .action-btn:hover { background: rgba(99,102,241,0.25); border-color: rgba(99,102,241,0.6); }

  .status        { font-size: 12px; color: #666; }
  .status.loaded { color: #86efac; }
  .status.error  { color: #ff5f57; }
</style>

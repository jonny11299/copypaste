<script>
  import { onMount } from 'svelte'

  // ── Navigation ─────────────────────────────────────────────────────────────
  // 'home' | 'setup' | '1x1' | 'links' | 'payload'
  let page = 'home'

  // ── Setup state ────────────────────────────────────────────────────────────
  let loadSource   = null   // 'file' | 'paste'
  let filePath     = null
  let fileName     = null
  let pasteText    = ''
  let validation   = null   // { mismatches, rowCount, badOrderIDs, hasSplit, missingMagniteLine }
  let loading      = false
  let errorMsg     = null

  // Form fields
  let isMagnite      = false
  let dealPrefix     = 'PARA-'
  let seatID         = ''
  let fcaps          = ''
  let hasDNR         = false
  let hasAudience    = false
  let hasRelTarget   = false
  let isSplitPayDeal = false
  let splitPrePrice  = ''
  let splitPostPrice = ''
  let budgetModel    = 'Fixed Price'

  // ── Header mismatch modal ─────────────────────────────────────────────────
  let showMismatchModal = false
  $: badHeaders  = (validation?.headerComparison ?? []).filter(r => !r.match)
  $: goodHeaders = (validation?.headerComparison ?? []).filter(r =>  r.match)

  // ── Quick Links state ──────────────────────────────────────────────────────
  let links     = []
  let linksDirty = false

  onMount(async () => {
    links = await window.api.getQuickLinks()
  })

  // ── Setup: choose source ───────────────────────────────────────────────────
  async function chooseFile() {
    errorMsg = null
    const result = await window.api.openFileDialog()
    if (!result) return
    filePath  = result
    fileName  = result.split('/').pop()
    loadSource = 'file'
    loading   = true
    validation = await window.api.loadWorkbook(filePath)
    loading   = false

    if (validation.mismatches.length > 0) {
      errorMsg = `${validation.mismatches.length} header mismatch(es) detected. Proceed with caution.`
    }
    if (!isMagnite && validation.missingMagniteLine === null) {
      // reset split pay if reloading
      isSplitPayDeal = false
    }
  }

  async function loadFromFile() {
    loading  = true
    errorMsg = null
    const data = await window.api.processFile({
      isMagnite, dealPrefix, seatID, fcaps,
      hasDNR, hasAudience, hasRelTarget,
      isSplitPayDeal, splitPrePrice, splitPostPrice,
      budgetModel,
    })
    loading = false
    window.api.setupComplete(data)
    window.api.closeMenuWindow()
  }

  async function loadFromPaste() {
    if (!pasteText.trim()) return
    loading  = true
    errorMsg = null
    const data = await window.api.parsePastedSLIs(pasteText)
    loading  = false
    if (!data.slis.length) { errorMsg = 'No SLIs found in pasted text.'; return }
    window.api.setupComplete(data)
    window.api.closeMenuWindow()
  }

  function resetSetup() {
    loadSource = null; filePath = null; fileName = null
    pasteText  = ''; validation = null; errorMsg = null
    isMagnite  = false; dealPrefix = 'PARA-'; seatID = ''; fcaps = ''
    hasDNR     = false; hasAudience = false; hasRelTarget = false
    isSplitPayDeal = false; splitPrePrice = ''; splitPostPrice = ''
    budgetModel = 'Fixed Price'
  }

  // ── 1x1 state ──────────────────────────────────────────────────────────────
  let pliPasteText = ''
  let pliErrorMsg  = null
  let pliLoading   = false

  async function loadFrom1x1Paste() {
    if (!pliPasteText.trim()) return
    pliLoading = true
    pliErrorMsg = null
    const data = await window.api.parsePastedPLIs(pliPasteText)
    pliLoading = false
    if (!data.plis.length) { pliErrorMsg = 'No PLIs found in pasted text.'; return }
    window.api.setupComplete({ ...data, mode: '1x1' })
    window.api.closeMenuWindow()
  }

  function reset1x1() {
    pliPasteText = ''; pliErrorMsg = null
  }

  // ── Payload viewer ─────────────────────────────────────────────────────────
  let payloadData     = null
  let copiedCell      = null
  let copyCellTimeout = null
  let filteredRow     = null   // null = show all; number = show only that item index

  async function openPayloadPage() {
    payloadData  = await window.api.getPayload()
    filteredRow  = null
    page = 'payload'
  }

  // Derive which c_ids have at least one non-empty c_contents across all items
  function getActiveColumns(p) {
    if (!p) return []
    const seen = new Map()   // cId → c_title (from first item that has it)
    for (const item of p.items) {
      for (const c of item.contents) {
        if (c.c_contents && !seen.has(c.c_id)) seen.set(c.c_id, c.c_title)
      }
    }
    return [...seen.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([cId, title]) => ({ cId, title }))
  }

  // Shortcut key label for a c_id
  function keyLabel(cId) {
    if (cId < 10) return `⌃${cId === 9 ? '0' : cId + 1}`
    const s = cId - 10
    return `⌃⇧${s === 9 ? '0' : s + 1}`
  }

  // Look up c_contents for an item+cId; '' if missing
  function cellContents(item, cId) {
    return item.contents.find(c => c.c_id === cId)?.c_contents ?? ''
  }

  function copyCell(text, key) {
    if (!text) return
    window.api.writeClipboard(text)
    copiedCell = key
    clearTimeout(copyCellTimeout)
    copyCellTimeout = setTimeout(() => copiedCell = null, 700)
  }

  // ── Quick Links ────────────────────────────────────────────────────────────
  function addLink()       { links = [...links, { name: '', url: '' }]; linksDirty = true }
  function removeLink(i)   { links = links.filter((_, idx) => idx !== i); linksDirty = true }
  function markDirty()     { linksDirty = true }
  function openLink(url)   { if (url) window.api.openExternal(url) }

  async function saveLinks() {
    await window.api.saveQuickLinks(links.filter(l => l.name || l.url))
    linksDirty = false
  }
</script>

<!-- ── Window shell ─────────────────────────────────────────────────────────── -->
<div class="window">

  <!-- Title bar -->
  <div class="titlebar">
    <div class="traffic-lights">
      <button class="light red"    title="Close"    on:click={() => window.api.closeMenuWindow()}>✕</button>
      <button class="light yellow" title="Minimize" on:click={() => window.api.minimizeWindow()}>−</button>
    </div>
    <span class="title">
      {#if page === 'home'}CopyPaste
      {:else if page === 'setup'}Programmatic Setup
      {:else if page === '1x1'}1x1 Setup
      {:else if page === 'payload'}Payload Viewer
      {:else}Quick Links
      {/if}
    </span>
    {#if page !== 'home'}
      <button class="back-btn" on:click={() => { page = 'home'; resetSetup(); reset1x1() }}>← Back</button>
    {/if}
  </div>

  <!-- ── HOME ──────────────────────────────────────────────────────────────── -->
  {#if page === 'home'}
    <div class="home">
      <button class="card" on:click={() => page = 'setup'}>
        <span class="card-icon">＋</span>
        <span class="card-text">
          <span class="card-title">New Programmatic Setup</span>
          <span class="card-desc">Load SLIs from an Excel file or pasted text</span>
        </span>
      </button>
      <button class="card" on:click={() => page = '1x1'}>
        <span class="card-icon">⬛</span>
        <span class="card-text">
          <span class="card-title">New 1x1 Setup</span>
          <span class="card-desc">Load tracking pixel URLs from pasted text</span>
        </span>
      </button>
      <button class="card" on:click={openPayloadPage}>
        <span class="card-icon">⊞</span>
        <span class="card-text">
          <span class="card-title">View Payload</span>
          <span class="card-desc">Inspect the current loaded payload as a table</span>
        </span>
      </button>
      <button class="card" on:click={() => page = 'links'}>
        <span class="card-icon">🔗</span>
        <span class="card-text">
          <span class="card-title">Quick Links</span>
          <span class="card-desc">Add and manage bookmarked links</span>
        </span>
      </button>
    </div>

  <!-- ── SETUP ─────────────────────────────────────────────────────────────── -->
  {:else if page === 'setup'}
    <div class="content">

      <!-- Source chooser -->
      {#if !loadSource}
        <p class="section-label">Load from</p>
        <div class="source-btns">
          <button class="source-btn" on:click={chooseFile}>📁  Excel File</button>
          <button class="source-btn" on:click={() => { loadSource = 'paste'; errorMsg = null }}>📋  Paste Text</button>
        </div>

      <!-- Paste mode -->
      {:else if loadSource === 'paste'}
        <p class="section-label">Paste SLI text</p>
        <textarea
          bind:value={pasteText}
          placeholder="Paste labeled SLI text here (one blank line between SLIs)…"
          spellcheck="false"
          class="paste-box"
        />
        {#if errorMsg}<p class="error">{errorMsg}</p>{/if}
        <div class="row-end">
          <button class="ghost-btn" on:click={() => { loadSource = null; pasteText = ''; errorMsg = null }}>← Change source</button>
          <button class="primary-btn" on:click={loadFromPaste} disabled={loading || !pasteText.trim()}>
            {loading ? 'Loading…' : 'Load SLIs'}
          </button>
        </div>

      <!-- File mode: form -->
      {:else if loadSource === 'file'}
        <div class="file-badge">
          <span>📄 {fileName}</span>
          <button class="ghost-sm" on:click={chooseFile}>Change</button>
        </div>

        {#if loading}
          <p class="hint">Reading file…</p>
        {:else if validation}
          {#if validation.mismatches.length > 0}
            <button class="warn-btn" on:click={() => showMismatchModal = true}>
              ⚠ {validation.mismatches.length} header mismatch(es). Proceed carefully — click to review.
            </button>
          {/if}
          {#if validation.badOrderIDs.length > 0}
            <p class="warn-inline">⚠ {validation.badOrderIDs.length} line(s) missing Order ID in name.</p>
          {/if}
          <p class="hint">{validation.rowCount} SLI(s) found</p>

          <div class="form">
            <!-- Magnite -->
            <div class="field">
              <label>Magnite deal?</label>
              <div class="toggle-group">
                <button class:active={isMagnite}  on:click={() => isMagnite = true}>Yes</button>
                <button class:active={!isMagnite} on:click={() => isMagnite = false}>No</button>
              </div>
            </div>
            {#if isMagnite}
              <div class="field">
                <label>Deal prefix</label>
                <input bind:value={dealPrefix} placeholder="PARA-MAG-" />
              </div>
            {/if}

            <!-- Seat ID -->
            <div class="field">
              <label>Seat ID</label>
              <input bind:value={seatID} placeholder="(leave blank if none)" />
            </div>

            <!-- fcaps -->
            <div class="field">
              <label>fcaps</label>
              <input bind:value={fcaps} placeholder="(leave blank if none)" />
            </div>

            <!-- DNR -->
            <div class="field">
              <label>DNR list?</label>
              <div class="toggle-group">
                <button class:active={hasDNR}  on:click={() => hasDNR = true}>Yes</button>
                <button class:active={!hasDNR} on:click={() => hasDNR = false}>No</button>
              </div>
            </div>

            <!-- Audience segments -->
            <div class="field">
              <label>Audience segments?</label>
              <div class="toggle-group">
                <button class:active={hasAudience}  on:click={() => hasAudience = true}>Yes</button>
                <button class:active={!hasAudience} on:click={() => hasAudience = false}>No</button>
              </div>
            </div>

            <!-- Relationship targeting -->
            <div class="field">
              <label>Relationship targeting?</label>
              <div class="toggle-group">
                <button class:active={hasRelTarget}  on:click={() => hasRelTarget = true}>Yes</button>
                <button class:active={!hasRelTarget} on:click={() => hasRelTarget = false}>No</button>
              </div>
            </div>

            <!-- Split pay (only if detected in file) -->
            {#if validation.hasSplit}
              <div class="field">
                <label>Split pay deal?</label>
                <div class="toggle-group">
                  <button class:active={isSplitPayDeal}  on:click={() => isSplitPayDeal = true}>Yes</button>
                  <button class:active={!isSplitPayDeal} on:click={() => isSplitPayDeal = false}>No</button>
                </div>
              </div>
              {#if isSplitPayDeal}
                <div class="field">
                  <label>Pre price</label>
                  <input bind:value={splitPrePrice} placeholder="e.g. 21.62" />
                </div>
                <div class="field">
                  <label>Post price</label>
                  <input bind:value={splitPostPrice} placeholder="e.g. 17.73" />
                </div>
              {/if}
            {/if}

            <!-- Budget model -->
            <div class="field">
              <label>Budget model</label>
              <select bind:value={budgetModel}>
                <option>Fixed Price</option>
                <option>1st Price Floored</option>
                <option>2nd Price Floored</option>
              </select>
            </div>
          </div>

          {#if errorMsg}<p class="error">{errorMsg}</p>{/if}
          <div class="row-end">
            <button class="primary-btn" on:click={loadFromFile} disabled={loading}>
              {loading ? 'Loading…' : 'Load SLIs'}
            </button>
          </div>
        {/if}
      {/if}
    </div>

  <!-- ── 1x1 SETUP ────────────────────────────────────────────────────────── -->
  {:else if page === '1x1'}
    <div class="content">
      <p class="section-label">Paste 1x1 tracking URLs</p>
      <textarea
        bind:value={pliPasteText}
        placeholder={'PLI = 5320037:\n\n"impression\nhttps://...\n\nstart\nhttps://...\n"'}
        spellcheck="false"
        class="paste-box"
      />
      {#if pliErrorMsg}<p class="error">{pliErrorMsg}</p>{/if}
      <div class="row-end">
        <button class="primary-btn" on:click={loadFrom1x1Paste} disabled={pliLoading || !pliPasteText.trim()}>
          {pliLoading ? 'Loading…' : 'Load PLIs'}
        </button>
      </div>
    </div>

  <!-- ── PAYLOAD VIEWER ───────────────────────────────────────────────────── -->
  {:else if page === 'payload'}
    <div class="payload-page">
      {#if !payloadData}
        <div class="payload-empty">
          <p>No payload loaded yet.</p>
          <p class="hint">Use a setup option from the home screen to load data into the overlay.</p>
        </div>
      {:else}
        {@const cols = getActiveColumns(payloadData)}
        <div class="payload-meta">
          <span class="payload-mode">mode: <strong>{payloadData.mode}</strong></span>
          <span class="payload-counts">{payloadData.items.length} items · {cols.length} active fields</span>
        </div>
        <div class="table-scroll">
          <table class="payload-table">
            <thead>
              <!-- Row 1: shortcut key badges -->
              <tr class="key-row">
                <th class="sticky-col corner">#</th>
                <th class="sticky-col item-name-head">Item</th>
                {#each cols as col, ci}
                  {#if col.cId === 10}
                    <th class="layer-divider-head" title="Shift layer begins">⇧</th>
                  {/if}
                  <th class="key-head" title="c_id {col.cId}">
                    <kbd>{keyLabel(col.cId)}</kbd>
                  </th>
                {/each}
              </tr>
              <!-- Row 2: field title labels -->
              <tr class="title-row">
                <th class="sticky-col corner"></th>
                <th class="sticky-col item-name-head"></th>
                {#each cols as col}
                  {#if col.cId === 10}
                    <th class="layer-divider-head"></th>
                  {/if}
                  <th class="field-title-head">{col.title}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each payloadData.items as item, ri}
                {#if filteredRow === null || filteredRow === ri}
                  <tr>
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <td
                      class="sticky-col row-num"
                      class:row-num-filtered={filteredRow === ri}
                      title={filteredRow === ri ? 'Show all rows' : `Show only row ${ri + 1}`}
                      on:click={() => filteredRow = filteredRow === ri ? null : ri}
                    >{filteredRow === ri ? '+' : ri + 1}</td>
                    <td class="sticky-col item-name" title={item.item_title}>{item.item_title}</td>
                    {#each cols as col}
                      {#if col.cId === 10}
                        <td class="layer-divider-cell"></td>
                      {/if}
                      {@const val = cellContents(item, col.cId)}
                      {@const cellKey = `${ri}-${col.cId}`}
                      <!-- svelte-ignore a11y-click-events-have-key-events -->
                      <td
                        class="data-cell"
                        class:copied={copiedCell === cellKey}
                        class:empty={!val}
                        title={val || ''}
                        on:click={() => copyCell(val, cellKey)}
                      >{val || ''}</td>
                    {/each}
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

  <!-- ── QUICK LINKS ────────────────────────────────────────────────────────── -->
  {:else if page === 'links'}
    <div class="content">
      <div class="links-list">
        {#each links as link, i}
          <div class="link-row">
            <button class="link-open-btn" on:click={() => openLink(link.url)} title={link.url || 'No URL set'}>
              {link.name || '(unnamed)'}
            </button>
            <input
              bind:value={link.name}
              placeholder="Name"
              on:input={markDirty}
              class="link-name"
            />
            <input
              bind:value={link.url}
              placeholder="https://…"
              on:input={markDirty}
              class="link-url"
            />
            <button class="remove-btn" on:click={() => removeLink(i)}>✕</button>
          </div>
        {/each}
        {#if links.length === 0}
          <p class="hint">No links yet. Add one below.</p>
        {/if}
      </div>
      <div class="row-between">
        <button class="ghost-btn" on:click={addLink}>+ Add link</button>
        <button class="primary-btn" on:click={saveLinks} disabled={!linksDirty}>
          {linksDirty ? 'Save' : 'Saved ✓'}
        </button>
      </div>
    </div>
  {/if}

<!-- ── Header mismatch modal ──────────────────────────────────────────────── -->
{#if showMismatchModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-backdrop" on:click={() => showMismatchModal = false}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="modal-panel" on:click|stopPropagation>
      <div class="modal-header">
        <span class="modal-title">Header Comparison</span>
        <button class="modal-close" on:click={() => showMismatchModal = false}>✕</button>
      </div>
      <div class="modal-body">
        <p class="table-label table-label-bad">Incorrect headers ({badHeaders.length})</p>
        <table class="header-table">
          <thead>
            <tr><th>Col</th><th>Expected</th><th>Actual</th></tr>
          </thead>
          <tbody>
            {#each badHeaders as row}
              <tr class="mismatch">
                <td class="col-num">{row.col}</td>
                <td>{row.expected}</td>
                <td>{row.actual || '—'}</td>
              </tr>
            {/each}
            {#if badHeaders.length === 0}
              <tr><td colspan="3" class="empty-row">No mismatches</td></tr>
            {/if}
          </tbody>
        </table>

        <p class="table-label table-label-good">Correct headers ({goodHeaders.length})</p>
        <table class="header-table">
          <thead>
            <tr><th>Col</th><th>Expected</th><th>Actual</th></tr>
          </thead>
          <tbody>
            {#each goodHeaders as row}
              <tr>
                <td class="col-num">{row.col}</td>
                <td>{row.expected}</td>
                <td>{row.actual}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
{/if}

</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body) {
    background: #0d0d12;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    color: #d4d4d4;
    overflow: hidden;
    user-select: none;
  }

  .window {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── Title bar ── */
  .titlebar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(255,255,255,0.03);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    -webkit-app-region: drag;
    flex-shrink: 0;
  }

  .traffic-lights {
    display: flex;
    gap: 5px;
    -webkit-app-region: no-drag;
  }

  .light {
    width: 12px; height: 12px;
    border-radius: 50%; border: none; cursor: pointer;
    font-size: 8px; color: transparent;
    display: flex; align-items: center; justify-content: center;
    transition: color 0.15s;
  }
  .light:hover { color: rgba(0,0,0,0.6); }
  .light.red    { background: #ff5f57; }
  .light.yellow { background: #febc2e; }

  .title {
    flex: 1;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: #888;
    text-transform: uppercase;
  }

  .back-btn {
    background: none; border: none; cursor: pointer;
    color: #6366f1; font-size: 12px;
    -webkit-app-region: no-drag;
    padding: 2px 4px;
  }
  .back-btn:hover { color: #a5b4fc; }

  /* ── Home ── */
  .home {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px;
    justify-content: center;
  }

  .card {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 14px;
    padding: 16px 20px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, border-color 0.15s;
  }
  .card:hover {
    background: rgba(99,102,241,0.12);
    border-color: #6366f1;
  }

  .card-icon  { font-size: 22px; color: #fff; flex-shrink: 0; }
  .card-title { font-size: 14px; font-weight: 600; color: #e2e2e2; }
  .card-desc  { font-size: 11px; color: #666; line-height: 1.4; margin-top: 2px; }

  .card-text {
    display: flex;
    flex-direction: column;
  }

  .source-btn-active {
    background: rgba(99,102,241,0.1);
    border-color: rgba(99,102,241,0.4);
    color: #a5b4fc;
  }

  /* ── Content area ── */
  .content {
    flex: 1;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
  }

  .content::-webkit-scrollbar { width: 4px; }
  .content::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #666;
  }

  /* ── Source buttons ── */
  .source-btns {
    display: flex;
    gap: 12px;
  }

  .source-btn {
    flex: 1;
    padding: 20px 12px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    color: #d4d4d4;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .source-btn:hover {
    background: rgba(99,102,241,0.15);
    border-color: #6366f1;
    color: #fff;
  }

  /* ── Paste ── */
  .paste-box {
    flex: 1;
    min-height: 240px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    color: #d4d4d4;
    font-family: 'Menlo', monospace;
    font-size: 12px;
    line-height: 1.6;
    padding: 10px;
    resize: none;
    outline: none;
    user-select: text;
  }
  .paste-box:focus { border-color: #6366f1; }

  /* ── File badge ── */
  .file-badge {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(99,102,241,0.1);
    border: 1px solid rgba(99,102,241,0.3);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    color: #a5b4fc;
  }

  /* ── Form ── */
  .form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .field label {
    width: 160px;
    flex-shrink: 0;
    font-size: 12px;
    color: #888;
  }

  .field input, .field select {
    flex: 1;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    color: #d4d4d4;
    font-size: 12px;
    font-family: inherit;
    padding: 5px 8px;
    outline: none;
    user-select: text;
  }
  .field input:focus, .field select:focus { border-color: #6366f1; }
  .field select option { background: #1a1a24; }

  /* ── Toggle group ── */
  .toggle-group {
    display: flex;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    overflow: hidden;
  }
  .toggle-group button {
    flex: 1;
    padding: 4px 14px;
    background: transparent;
    border: none;
    color: #666;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }
  .toggle-group button + button { border-left: 1px solid rgba(255,255,255,0.1); }
  .toggle-group button.active { background: #6366f1; color: #fff; }

  /* ── Quick links ── */
  .links-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .link-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .link-name { width: 130px; flex-shrink: 0; }
  .link-url  { flex: 1; }

  .link-name, .link-url {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    color: #d4d4d4;
    font-size: 12px;
    font-family: inherit;
    padding: 5px 8px;
    outline: none;
    user-select: text;
  }
  .link-name:focus, .link-url:focus { border-color: #6366f1; }

  .link-open-btn {
    background: none;
    border: none;
    color: #6366f1;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    padding: 4px 6px;
    white-space: nowrap;
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
    flex-shrink: 0;
  }
  .link-open-btn:hover { color: #a5b4fc; text-decoration: underline; }

  .remove-btn {
    background: none;
    border: none;
    color: #555;
    cursor: pointer;
    font-size: 11px;
    padding: 4px;
    flex-shrink: 0;
  }
  .remove-btn:hover { color: #ff5f57; }

  /* ── Utility rows ── */
  .row-end {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
  }

  .row-between {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
  }

  /* ── Buttons ── */
  .primary-btn {
    background: #6366f1;
    border: none;
    border-radius: 5px;
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 7px 20px;
    transition: background 0.15s;
  }
  .primary-btn:hover:not(:disabled) { background: #4f46e5; }
  .primary-btn:disabled { background: #2a2a3a; color: #555; cursor: default; }

  .ghost-btn {
    background: none;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 5px;
    color: #888;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    padding: 6px 14px;
    transition: border-color 0.15s, color 0.15s;
  }
  .ghost-btn:hover { border-color: #6366f1; color: #a5b4fc; }

  .ghost-sm {
    background: none; border: none;
    color: #6366f1; font-size: 11px;
    cursor: pointer; padding: 2px 6px;
  }
  .ghost-sm:hover { color: #a5b4fc; }

  /* ── Feedback ── */
  .hint  { font-size: 11px; color: #555; }
  .error { font-size: 11px; color: #f87171; }

  .warn-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: 11px;
    color: #f59e0b;
    cursor: pointer;
    text-align: left;
    text-decoration: underline;
    text-underline-offset: 2px;
    font-family: inherit;
  }
  .warn-btn:hover { color: #fbbf24; }

  /* ── Modal ── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal-panel {
    background: #14141e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    width: 90%;
    max-width: 560px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 13px;
    font-weight: 600;
    color: #e2e2e2;
    letter-spacing: 0.04em;
  }

  .modal-close {
    background: none;
    border: none;
    color: #555;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
  }
  .modal-close:hover { color: #ff5f57; }

  .modal-body {
    overflow-y: auto;
    flex: 1;
  }
  .modal-body::-webkit-scrollbar { width: 4px; }
  .modal-body::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }

  /* ── Payload viewer ── */
  .payload-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .payload-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #555;
    font-size: 13px;
    padding: 32px;
    text-align: center;
  }

  .payload-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
    font-size: 11px;
    color: #666;
  }
  .payload-mode strong { color: #a5b4fc; }
  .payload-counts { color: #444; }

  .table-scroll {
    flex: 1;
    overflow: auto;
    min-height: 0;
  }
  .table-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
  .table-scroll::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }
  .table-scroll::-webkit-scrollbar-corner { background: transparent; }

  .payload-table {
    border-collapse: collapse;
    font-size: 11px;
    white-space: nowrap;
  }

  /* Sticky left columns */
  .sticky-col {
    position: sticky;
    z-index: 2;
    background: #14141e;  /* solid — prevents scroll bleed-through */
  }
  .row-num {
    left: 0;
    width: 28px;
    min-width: 28px;
    text-align: center;
    color: #555;
    cursor: pointer;
    user-select: none;
    transition: color 0.1s, background 0.1s;
  }
  .row-num:hover { color: #a5b4fc; background: rgba(99,102,241,0.12) !important; }
  .row-num-filtered {
    color: #6ee7b7 !important;
    background: rgba(110,231,183,0.1) !important;
    font-weight: 700;
    cursor: pointer;
  }
  .item-name {
    left: 28px;
    min-width: 120px;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #bbb;
    /* right shadow seals the gap between sticky cols and scrolling content */
    box-shadow: 2px 0 4px #14141e;
  }
  .corner         { left: 0; z-index: 3; }
  .item-name-head { left: 28px; z-index: 3; box-shadow: 2px 0 4px #1a1a28; }

  /* Header rows */
  .payload-table thead th {
    background: #1a1a28;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    padding: 5px 8px;
    text-align: left;
    font-weight: 500;
  }
  .key-row th   { padding-bottom: 3px; border-bottom: none; }
  .title-row th { padding-top: 2px; color: #555; font-size: 10px; font-weight: 400; }

  .key-head    { text-align: center; }
  .field-title-head { color: #777; min-width: 100px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }

  .key-head kbd {
    background: rgba(99,102,241,0.15);
    border: 1px solid rgba(99,102,241,0.3);
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 10px;
    font-family: monospace;
    color: #a5b4fc;
  }

  /* Layer divider between normal (0–9) and shift (10–19) */
  .layer-divider-head,
  .layer-divider-cell {
    width: 18px;
    min-width: 18px;
    background: rgba(255,255,255,0.02);
    border-left: 2px solid rgba(99,102,241,0.25);
    border-right: 2px solid rgba(99,102,241,0.25);
    padding: 0 2px;
    text-align: center;
    color: #444;
    font-size: 10px;
  }

  /* Data rows */
  .payload-table tbody tr {
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .payload-table tbody tr:hover .data-cell,
  .payload-table tbody tr:hover .item-name {
    background: rgba(255,255,255,0.03);
  }
  .payload-table tbody tr:hover .sticky-col {
    background: #1c1c2a;
  }

  .data-cell {
    padding: 5px 8px;
    color: #bbb;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition: background 0.08s, color 0.08s;
    border-right: 1px solid rgba(255,255,255,0.03);
  }
  .data-cell:hover   { background: rgba(99,102,241,0.1) !important; color: #e2e2e2; }
  .data-cell.copied  { background: rgba(99,102,241,0.28) !important; color: #a5b4fc; }
  .data-cell.empty   { color: #2a2a2a; cursor: default; }

  .table-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 10px 12px 5px;
  }
  .table-label-bad  { color: #f87171; }
  .table-label-good { color: #4ade80; }

  .empty-row { color: #444; font-style: italic; padding: 8px 12px; }

  .header-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  .header-table thead th {
    position: sticky;
    top: 0;
    background: #1a1a28;
    color: #666;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    padding: 7px 12px;
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .header-table tbody tr {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }
  .header-table tbody tr:hover { background: rgba(255, 255, 255, 0.03); }
  .header-table tbody tr.mismatch { background: rgba(239, 68, 68, 0.12); }
  .header-table tbody tr.mismatch:hover { background: rgba(239, 68, 68, 0.18); }

  .header-table td {
    padding: 5px 12px;
    color: #bbb;
    vertical-align: top;
  }
  .header-table tr.mismatch td { color: #fca5a5; }
  .col-num { color: #555; width: 40px; flex-shrink: 0; }
</style>

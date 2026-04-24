<script>
  import { onMount, onDestroy } from 'svelte'

  // ── State ──────────────────────────────────────────────────────────────────
  let active           = true
  let directFileLoaded = false
  let copiedKey        = null
  let copiedShift      = false
  let copyTimeout      = null
  let shiftHeld        = false
  let shiftHoldTimeout = null

  // ── Payload — full v2 structure with chunk navigation state
  let payload = {
    mode:             'none',
    activeChunkIndex: 0,
    chunks: [{
      chunk_title:     '',
      activeItemIndex: 0,
      items: Array.from({ length: 8 }, (_, i) => ({
        item_id: i, item_title: `Item ${i + 1}`, contents: [],
      })),
    }],
  }

  // ── Derived: active chunk and its items
  $: activeChunk = payload.chunks[payload.activeChunkIndex] ?? payload.chunks[0]
  $: activeItems = activeChunk?.items ?? []
  $: selectedIndex = activeChunk?.activeItemIndex ?? 0
  $: multiChunk = payload.chunks.length > 1

  // Look up a content entry by c_id; returns blank if not present
  function getSlot(item, cId) {
    if (!item) return { c_title: '', c_contents: '', c_type: 'string' }
    return item.contents.find(c => c.c_id === cId)
      ?? { c_title: '', c_contents: '', c_type: 'string' }
  }

  // ── Derived display ────────────────────────────────────────────────────────
  // key '1'→cId 0, '2'→1, … '9'→8, '0'→9  (shift layer adds 10)
  const DIGIT_KEYS = ['1','2','3','4','5','6','7','8','9','0']

  $: normalFields = DIGIT_KEYS.map((k, i) => ({
    key: k, label: getSlot(activeItems[selectedIndex], i).c_title, cId: i,
  }))

  $: shiftFields = DIGIT_KEYS.map((k, i) => ({
    key: k, label: getSlot(activeItems[selectedIndex], 10 + i).c_title, cId: 10 + i,
  }))

  $: displayFields = shiftHeld ? shiftFields : normalFields

  // ── Navigation helpers ─────────────────────────────────────────────────────
  function navUp() {
    payload.chunks[payload.activeChunkIndex].activeItemIndex = Math.max(selectedIndex - 1, 0)
  }
  function navDown() {
    payload.chunks[payload.activeChunkIndex].activeItemIndex = Math.min(selectedIndex + 1, activeItems.length - 1)
  }
  function navLeft() {
    payload.activeChunkIndex = Math.max(payload.activeChunkIndex - 1, 0)
  }
  function navRight() {
    payload.activeChunkIndex = Math.min(payload.activeChunkIndex + 1, payload.chunks.length - 1)
  }

  // ── Copy logic ─────────────────────────────────────────────────────────────
  function copyField(key, shift = false) {
    if (!active) return
    const keyIndex = key === '0' ? 9 : parseInt(key) - 1
    const cId      = shift ? 10 + keyIndex : keyIndex
    const text     = getSlot(activeItems[selectedIndex], cId).c_contents
    if (!text) return
    window.api.writeClipboard(String(text))
    copiedKey   = key
    copiedShift = shift
    clearTimeout(copyTimeout)
    copyTimeout = setTimeout(() => { copiedKey = null; copiedShift = false }, 700)
  }

  const ALL_DIGIT_KEYS = new Set(DIGIT_KEYS)

  function handleKeydown(e) {
    if (e.key === 'Shift') { shiftHeld = true; return }
    if (!active) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      navDown()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      navUp()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      navLeft()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      navRight()
    } else if (ALL_DIGIT_KEYS.has(e.key)) {
      copyField(e.key, e.shiftKey)
    }
  }

  function handleKeyup(e) {
    if (e.key === 'Shift') shiftHeld = false
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(() => {
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('keyup',   handleKeyup)

    window.api.onGlobalKey((key) => {
      if (active) copyField(key, false)
    })

    window.api.onGlobalShiftKey((key) => {
      if (active) {
        shiftHeld = true
        copyField(key, true)
        setTimeout(() => { shiftHeld = false }, 700)
      }
    })

    window.api.onShiftLayerOn(() => {
      shiftHeld = true
      clearTimeout(shiftHoldTimeout)
      shiftHoldTimeout = setTimeout(() => { shiftHeld = false }, 600)
    })

    window.api.onGlobalNav((dir) => {
      if (!active) return
      if (dir === 'up')    navUp()
      if (dir === 'down')  navDown()
      if (dir === 'left')  navLeft()
      if (dir === 'right') navRight()
    })

    window.api.onSLIData((data) => {
      payload = data
    })

    window.api.onDirectFileLoaded(() => { directFileLoaded = true })
  })

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('keyup',   handleKeyup)
    clearTimeout(copyTimeout)
  })
</script>

<div class="panel">
  <!-- Header -->
  <div class="header">
    <div class="traffic-lights">
      <button class="light red"    title="Close"    on:click={() => window.api.quitApp()}>✕</button>
      <button class="light yellow" title="Minimize" on:click={() => window.api.minimizeWindow()}>−</button>
      <button
        class="light green"
        class:green-on={active}
        title={active ? 'Deactivate' : 'Activate'}
        on:click={() => (active = !active)}
      />
    </div>
    <span class="app-title">CopyPaste</span>
  </div>

  <!-- Menu button -->
  <button class="menu-section-btn" on:click={() => window.api.openMenuWindow()}>
    MENU
  </button>

  <!-- Generic SQL / Direct file viewer button -->
  <button
    class="menu-section-btn"
    on:click={() => directFileLoaded ? window.api.openDirectFileView() : window.api.openGenericSqlTable()}
  >
    {directFileLoaded ? 'DIRECT' : 'GENERIC SQL'}
  </button>

  <!-- Payload table viewer button -->
  <button class="menu-section-btn" on:click={() => window.api.openPayloadTable()}>
    PAYLOAD
  </button>

  {#if active}
    <!-- Chunk indicator (hidden when only one chunk) -->
    {#if multiChunk}
      <div class="chunk-bar">← {activeChunk.chunk_title} →</div>
    {/if}

    <!-- Item list -->
    <div class="sli-list" role="listbox" aria-label="Item list">
      {#each activeItems as item, i}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div
          class="sli-row"
          class:selected={i === selectedIndex}
          role="option"
          aria-selected={i === selectedIndex}
          tabindex="-1"
          on:click={() => { payload.chunks[payload.activeChunkIndex].activeItemIndex = i }}
        >
          {item.item_title}
        </div>
      {/each}
    </div>

    <!-- Key reference -->
    <div class="key-list">
      {#each displayFields as f}
        {@const flashing = copiedKey === f.key && copiedShift === shiftHeld}
        <div class="key-row" class:flash={flashing}>
          <kbd>{shiftHeld ? '⌃⇧' : '⌃'}{f.key}</kbd>
          <span>{flashing ? 'Copied!' : f.label}</span>
        </div>
      {/each}
    </div>
  {:else}
    <div class="inactive-hint">Paused</div>
  {/if}
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(button:focus) { outline: none; }
  :global(body) {
    background: transparent;
    font-family: system-ui, -apple-system, sans-serif;
    overflow: hidden;
    user-select: none;
  }

  .panel {
    width: 100vw;
    height: 100vh;
    background: rgba(13, 13, 18, 0.95);
    color: #e2e2e2;
    display: flex;
    flex-direction: column;
    font-size: 12px;
    border-right: 1px solid rgba(255, 255, 255, 0.07);
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    -webkit-app-region: drag;
    flex-shrink: 0;
  }

  .traffic-lights {
    display: flex;
    align-items: center;
    gap: 5px;
    -webkit-app-region: no-drag;
  }

  .light {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    color: transparent;
    transition: color 0.15s;
  }

  .light:hover { color: rgba(0, 0, 0, 0.6); }
  .light.red    { background: #ff5f57; }
  .light.yellow { background: #febc2e; }
  .light.green  { background: #3a3a3a; transition: background 0.2s, box-shadow 0.2s; }
  .light.green.green-on { background: #28c840; box-shadow: 0 0 6px #28c84099; }

  .menu-section-btn {
    width: 100%;
    background: rgba(255, 255, 255, 0.04);
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    color: #666;
    cursor: pointer;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    padding: 6px 0;
    text-transform: uppercase;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }
  .menu-section-btn:hover {
    background: rgba(99, 102, 241, 0.15);
    color: #a5b4fc;
  }

  .app-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #999;
  }

  /* ── Chunk bar ── */
  .chunk-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5px 8px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: #a5b4fc;
    background: rgba(99, 102, 241, 0.1);
    border-bottom: 1px solid rgba(99, 102, 241, 0.2);
    flex-shrink: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── SLI list ── */
  .sli-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .sli-list::-webkit-scrollbar { width: 3px; }
  .sli-list::-webkit-scrollbar-track { background: transparent; }
  .sli-list::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }

  .sli-row {
    padding: 7px 10px;
    cursor: pointer;
    border-left: 2px solid transparent;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #bbb;
    transition: background 0.08s, color 0.08s;
  }

  .sli-row:hover { background: rgba(255, 255, 255, 0.04); color: #ddd; }
  .sli-row.selected {
    background: rgba(99, 102, 241, 0.18);
    border-left-color: #6366f1;
    color: #fff;
    font-weight: 500;
  }

  /* ── Key reference ── */
  .key-list {
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    padding: 4px 0;
    flex-shrink: 0;
  }

  .key-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 3px;
    transition: background 0.1s;
  }

  .key-row.flash { background: rgba(99, 102, 241, 0.22); }
  .key-row.flash span { color: #a5b4fc; }

  kbd {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 3px;
    padding: 1px 4px;
    font-size: 10px;
    font-family: monospace;
    color: #ddd;
    min-width: 16px;
    text-align: center;
    flex-shrink: 0;
  }

  .key-row span {
    color: #999;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Inactive ── */
  .inactive-hint {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
</style>

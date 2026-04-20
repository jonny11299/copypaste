<script>
  import { onMount, onDestroy } from 'svelte'

  // ── State ──────────────────────────────────────────────────────────────────
  let active        = true
  let selectedIndex = 0
  let copiedKey     = null
  let copiedShift   = false
  let copyTimeout   = null
  let shiftHeld     = false

  // ── Payload — single source of truth (shape defined in src/main/payload.js)
  let payload = {
    mode: 'none',
    items: Array.from({ length: 8 }, (_, i) => ({
      item_id: i, item_title: `Item ${i + 1}`, contents: [],
    })),
  }

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
    key: k, label: getSlot(payload.items[selectedIndex], i).c_title, cId: i,
  }))

  $: shiftFields = DIGIT_KEYS.map((k, i) => ({
    key: k, label: getSlot(payload.items[selectedIndex], 10 + i).c_title, cId: 10 + i,
  }))

  $: displayFields = shiftHeld ? shiftFields : normalFields

  // ── Copy logic ─────────────────────────────────────────────────────────────
  function copyField(key, shift = false) {
    if (!active) return
    const keyIndex = key === '0' ? 9 : parseInt(key) - 1
    const cId      = shift ? 10 + keyIndex : keyIndex
    const text     = getSlot(payload.items[selectedIndex], cId).c_contents
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
      selectedIndex = Math.min(selectedIndex + 1, payload.items.length - 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedIndex = Math.max(selectedIndex - 1, 0)
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
      if (active) copyField(key, true)
    })

    window.api.onSLIData((data) => {
      payload        = data
      selectedIndex  = 0
    })
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

  {#if active}
    <!-- Item list -->
    <div class="sli-list" role="listbox" aria-label="Item list">
      {#each payload.items as item, i}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div
          class="sli-row"
          class:selected={i === selectedIndex}
          role="option"
          aria-selected={i === selectedIndex}
          tabindex="-1"
          on:click={() => (selectedIndex = i)}
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

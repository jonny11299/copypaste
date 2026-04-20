<script>
  import { onMount, tick } from 'svelte'

  // ── State ──────────────────────────────────────────────────────────────────
  let lines    = []   // { text, type: 'output'|'input'|'warn'|'error' }
  let inputVal = ''
  let inputEl
  let logEl

  // Collected answers
  let filePath       = null
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

  // Prompt queue
  let resolveInput = null
  let inputHint    = ''   // shown as placeholder

  function print(text, type = 'output') {
    lines = [...lines, { text, type }]
  }

  async function scrollBottom() {
    await tick()
    if (logEl) logEl.scrollTop = logEl.scrollHeight
  }

  // Ask a question, wait for user to hit Enter, return the trimmed string
  async function ask(question, hint = '') {
    print(question, 'output')
    inputHint = hint
    await tick()
    if (logEl) logEl.scrollTop = logEl.scrollHeight
    inputEl?.focus()   // element is always mounted — focus is stable
    return new Promise(resolve => { resolveInput = resolve })
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!resolveInput) return
      const val = inputVal.trim()
      print(`> ${inputVal}`, 'input')
      inputVal = ''
      scrollBottom()
      const resolve = resolveInput
      resolveInput = null
      resolve(val)
    }
  }

  async function yn(question) {
    const ans = await ask(question + ' (y/n)')
    return ans.toLowerCase().startsWith('y')
  }

  async function warnAndAsk(message) {
    print('⚠  ' + message, 'warn')
    const ans = await ask('Continue, or exit? (c/e)')
    if (ans.toLowerCase().startsWith('e')) {
      print('Exiting.', 'error')
      resolveInput = null
      setTimeout(() => window.api.quitApp(), 800)
    }
  }

  // ── Paste mode ─────────────────────────────────────────────────────────────
  let pasteMode    = false
  let pasteText    = ''
  let pasteLoading = false

  async function loadFromPaste() {
    if (!pasteText.trim()) return
    pasteLoading = true
    const data = await window.api.parsePastedSLIs(pasteText)
    pasteLoading = false
    if (!data.slis.length) {
      print('No SLIs found in pasted text.', 'error')
      pasteMode = false
      return
    }
    print(`✓ Loaded ${data.slis.length} SLI(s) from pasted text.`, 'output')
    await tick()
    await new Promise(r => setTimeout(r, 400))
    window.api.setupComplete(data)
    window.api.closeSetupWindow()
  }

  // ── Main flow ──────────────────────────────────────────────────────────────
  onMount(async () => {
    inputEl?.focus()
    await run()
  })

  async function run() {
    print('CopyPaste — Setup', 'output')
    print('─'.repeat(40), 'output')

    // 1. Choose source
    const choice = await ask('Load from (file) Excel or (paste) text?', 'file')
    if (choice.toLowerCase().startsWith('p')) {
      print('Paste your SLI text below, then click Load.', 'output')
      pasteMode = true
      return   // hand off to paste UI
    }

    const result = await window.api.openFileDialog()
    if (!result) { print('No file selected.', 'warn'); return }

    filePath = result
    print(`File: ${filePath.split('/').pop()}`, 'output')

    // 2. Validate + read rows
    const validation = await window.api.loadWorkbook(filePath)

    if (validation.mismatches.length > 0) {
      print('Header mismatch(es):', 'warn')
      validation.mismatches.forEach(m => print('  ' + m, 'warn'))
      await warnAndAsk(`${validation.mismatches.length} header(s) do not match expected format.`)
    } else {
      print('✓ Headers validated.', 'output')
    }

    print(`${validation.rowCount} SLI(s) found.`, 'output')

    if (validation.badOrderIDs.length > 0) {
      print('Missing Order ID in line name(s) — please ask Sales:', 'warn')
      validation.badOrderIDs.forEach(n => print('  • ' + n, 'warn'))
    }

    // 3. Prompts
    print('', 'output')
    isMagnite = await yn('Is this a Magnite deal?')

    if (isMagnite) {
      if (validation.missingMagniteLine) {
        await warnAndAsk(
          `"${validation.missingMagniteLine}" is missing "Magnite" in the name.\n` +
          `  Please ask Sales to include "Magnite" in all Magnite deal line names.`
        )
      }
      const p = await ask('Enter deal prefix (default: PARA-MAG-)', 'PARA-MAG-')
      dealPrefix = p || 'PARA-MAG-'
    }

    seatID      = await ask('Seat ID (leave blank if none)', '')
    fcaps       = await ask('fcaps (leave blank if none)', '')
    hasDNR      = await yn('Is there a DNR list?')
    hasAudience = await yn('Are there audience segments to apply?')
    hasRelTarget= await yn('Is there relationship targeting?')

    if (validation.hasSplit) {
      isSplitPayDeal = await yn('Is this a split pay deal?')
      if (isSplitPayDeal) {
        splitPrePrice  = await ask('Please enter pre price', '')
        splitPostPrice = await ask('Please enter post price', '')
      }
    }

    const bm = await ask(
      'Budget model — Fixed Price / 1st Price Floored / 2nd Price Floored\n  (blank = Fixed Price)',
      'Fixed Price'
    )
    budgetModel = bm || 'Fixed Price'

    // 4. Process
    print('', 'output')
    print('Processing…', 'output')

    const data = await window.api.processFile({
      isMagnite, dealPrefix, seatID, fcaps,
      hasDNR, hasAudience, hasRelTarget,
      isSplitPayDeal, splitPrePrice, splitPostPrice,
      budgetModel,
    })

    print('✓ Done. Sending to overlay…', 'output')
    await tick()
    await new Promise(r => setTimeout(r, 600))

    window.api.setupComplete(data)
    window.api.closeSetupWindow()
  }
</script>

<div class="terminal" bind:this={logEl} on:click={() => inputEl?.focus()}>
  {#each lines as line}
    <div class="line {line.type}">{line.text}</div>
  {/each}

  {#if pasteMode}
    <div class="paste-area">
      <textarea
        bind:value={pasteText}
        placeholder="Paste SLI text here…"
        spellcheck="false"
        autofocus
      />
      <button class="load-btn" on:click={loadFromPaste} disabled={pasteLoading || !pasteText.trim()}>
        {pasteLoading ? 'Loading…' : 'Load SLIs'}
      </button>
    </div>
  {/if}

  <!-- Input is always mounted so focus never drops between questions -->
  <div class="input-row" class:hidden={resolveInput === null}>
    <span class="prompt-arrow">▶</span>
    <input
      bind:this={inputEl}
      bind:value={inputVal}
      on:keydown={handleKeydown}
      placeholder={inputHint}
      autocomplete="off"
      spellcheck="false"
      on:blur={() => { if (resolveInput) inputEl?.focus() }}
    />
  </div>
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body) {
    background: #0d0d12;
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
    color: #d4d4d4;
    overflow: hidden;
  }

  .terminal {
    width: 100vw;
    height: 100vh;
    padding: 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .terminal::-webkit-scrollbar { width: 4px; }
  .terminal::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }

  .line {
    white-space: pre-wrap;
    line-height: 1.6;
  }

  .line.output { color: #d4d4d4; }
  .line.input  { color: #6366f1; }
  .line.warn   { color: #f59e0b; }
  .line.error  { color: #f87171; }

  .input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .input-row.hidden { visibility: hidden; pointer-events: none; }
  .prompt-arrow { color: #6366f1; flex-shrink: 0; }

  input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #6366f1;
    font-family: inherit;
    font-size: inherit;
    caret-color: #6366f1;
  }

  input::placeholder { color: #3a3a4a; }

  .paste-area {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px 16px;
    flex-shrink: 0;
    border-top: 1px solid rgba(255,255,255,0.07);
  }

  textarea {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 4px;
    color: #d4d4d4;
    font-family: inherit;
    font-size: 12px;
    line-height: 1.6;
    padding: 10px;
    resize: vertical;
    min-height: 220px;
    outline: none;
  }

  textarea:focus { border-color: #6366f1; }

  .load-btn {
    align-self: flex-end;
    background: #6366f1;
    border: none;
    border-radius: 4px;
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 7px 20px;
    transition: background 0.15s;
  }

  .load-btn:hover:not(:disabled) { background: #4f46e5; }
  .load-btn:disabled { background: #2a2a3a; color: #555; cursor: default; }
</style>

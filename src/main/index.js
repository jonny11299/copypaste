import { app, BrowserWindow, screen, ipcMain, clipboard, globalShortcut, dialog, shell } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import XLSX from 'xlsx'
import {
  EXPECTED_HEADERS,
  validateHeaders,
  extractDataRows,
  sortRows,
  getMissingOrderIDNames,
  anyInventoryHasSplit,
  getMissingMagniteLine,
  processRows,
  parsePastedSLIs,
  parsePastedPLIs,
  getCellValue,
  COL,
} from './sfmessage.js'

const KEYS        = ['1','2','3','4','5','6','7','8','9','0']
const DATA_DIR    = join(__dirname, '../../data')
const LINKS_FILE  = join(DATA_DIR, 'quicklinks.json')

let mainWin       = null
let menuWin       = null
let cachedRows    = []
let currentPayload = null

// ─── Main overlay window ──────────────────────────────────────────────────────

function createMainWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const panelWidth = Math.floor(width * 0.1)

  mainWin = new BrowserWindow({
    width: panelWidth,
    height,
    x: 0,
    y: 0,
    alwaysOnTop: true,
    frame: false,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
    }
  })

  mainWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWin.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWin.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── Menu window ──────────────────────────────────────────────────────────────

function createMenuWindow() {
  if (menuWin) { menuWin.focus(); return }

  menuWin = new BrowserWindow({
    width: 520,
    height: 640,
    center: true,
    resizable: true,
    frame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    menuWin.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/menu.html')
  } else {
    menuWin.loadFile(join(__dirname, '../renderer/menu.html'))
  }

  menuWin.on('closed', () => { menuWin = null })
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createMainWindow()
  createMenuWindow()

  KEYS.forEach(key => {
    const ok = globalShortcut.register(`Ctrl+${key}`, () => {
      mainWin?.webContents.send('global-key', key)
    })
    if (!ok) console.error(`[shortcuts] Failed to register Ctrl+${key}`)

    const okShift = globalShortcut.register(`Ctrl+Shift+${key}`, () => {
      mainWin?.webContents.send('global-shift-key', key)
    })
    if (!okShift) console.error(`[shortcuts] Failed to register Ctrl+Shift+${key}`)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
      createMenuWindow()
    }
  })
})

app.on('will-quit', () => globalShortcut.unregisterAll())
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('write-clipboard', (_, text) => {
  clipboard.writeText(String(text))
})

ipcMain.on('window-minimize', () => {
  BrowserWindow.getFocusedWindow()?.minimize()
})

ipcMain.on('app-quit', () => app.quit())

// Open / focus menu window (called from overlay)
ipcMain.on('open-menu-window', () => createMenuWindow())

ipcMain.on('close-menu-window', () => { menuWin?.close() })

ipcMain.on('open-external', (_, url) => { shell.openExternal(url) })

// File picker
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(menuWin, {
    title: 'Select production ticket',
    defaultPath: DATA_DIR,
    filters: [{ name: 'Excel Files', extensions: ['xls', 'xlsx'] }],
    properties: ['openFile'],
  })
  return result.canceled ? null : result.filePaths[0]
})

// Read workbook, validate, cache rows
ipcMain.handle('load-workbook', (_, filePath) => {
  const wb      = XLSX.readFile(filePath)
  const ws      = wb.Sheets[wb.SheetNames[0]]
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })

  const mismatches         = validateHeaders(allRows)
  const actualHeaders      = allRows[0] || []
  const headerComparison   = EXPECTED_HEADERS.map((expected, i) => ({
    col:      i + 1,
    expected,
    actual:   String(actualHeaders[i] ?? ''),
    match:    actualHeaders[i] === expected,
  }))

  const dataRows           = sortRows(extractDataRows(allRows))
  const badOrderIDs        = getMissingOrderIDNames(dataRows)
  const hasSplit           = anyInventoryHasSplit(dataRows)
  const missingMagRow      = getMissingMagniteLine(dataRows)
  const missingMagniteLine = missingMagRow
    ? getCellValue(missingMagRow, COL.PRODUCTION_LINE_NAME)
    : null

  cachedRows = dataRows
  return { mismatches, headerComparison, rowCount: dataRows.length, badOrderIDs, hasSplit, missingMagniteLine }
})

// Process cached rows
ipcMain.handle('process-file', (_, opts) => processRows(cachedRows, opts))

// Parse pasted text
ipcMain.handle('parse-pasted-slis',  (_, text) => parsePastedSLIs(text))
ipcMain.handle('parse-pasted-plis',  (_, text) => parsePastedPLIs(text))

// Setup complete — cache payload and push to overlay
ipcMain.on('setup-complete', (_, data) => {
  currentPayload = data
  mainWin?.webContents.send('sli-data', data)
})

// Return current payload to menu window on request
ipcMain.handle('get-payload', () => currentPayload)

// Quick links — read / write
ipcMain.handle('get-quick-links', () => {
  if (!existsSync(LINKS_FILE)) return []
  try { return JSON.parse(readFileSync(LINKS_FILE, 'utf8')) }
  catch { return [] }
})

ipcMain.handle('save-quick-links', (_, links) => {
  writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2), 'utf8')
})

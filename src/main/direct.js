import { BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import XLSX from 'xlsx'

let directSetupWin    = null
let directFileViewWin = null
let directFileData    = null
let directFileName    = null

const MAPPING_DIR  = join(__dirname, '../../data/direct_mapping_profiles')
const MAPPING_FILE = join(MAPPING_DIR, 'direct-mappings.json')

export function getDirectFileViewWin() { return directFileViewWin }

function createDirectSetupWindow() {
  if (directSetupWin) { directSetupWin.focus(); return }

  directSetupWin = new BrowserWindow({
    width: 480,
    height: 280,
    center: true,
    resizable: false,
    frame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    directSetupWin.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/directsetup.html')
  } else {
    directSetupWin.loadFile(join(__dirname, '../renderer/directsetup.html'))
  }

  directSetupWin.on('closed', () => { directSetupWin = null })
}

function createDirectFileViewWindow() {
  if (directFileViewWin) { directFileViewWin.focus(); return }

  directFileViewWin = new BrowserWindow({
    width: 1280,
    height: 680,
    center: true,
    resizable: true,
    frame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    directFileViewWin.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/directfileview.html')
  } else {
    directFileViewWin.loadFile(join(__dirname, '../renderer/directfileview.html'))
  }

  directFileViewWin.on('closed', () => { directFileViewWin = null })
}

function isBlankRow(row) {
  return !row || row.every(cell => String(cell ?? '').trim() === '')
}

function colLabel(i) {
  if (i < 26) return String.fromCharCode(65 + i)
  return String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26))
}

function parseXlsxToRows(filePath) {
  const wb = XLSX.readFile(filePath)
  const allRows = []

  for (const sheetName of wb.SheetNames) {
    const ws  = wb.Sheets[sheetName]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
    if (raw.length === 0) continue

    // Truncate trailing blank rows: find last row with content, keep up to 5 more
    let lastDataIdx = raw.length - 1
    while (lastDataIdx >= 0 && isBlankRow(raw[lastDataIdx])) lastDataIdx--
    if (lastDataIdx < 0) continue
    const cutoff = Math.min(lastDataIdx + 5, raw.length - 1)

    // Column count from the widest non-blank row in range
    let numCols = 0
    for (let r = 0; r <= cutoff; r++) numCols = Math.max(numCols, (raw[r] || []).length)
    const headers = Array.from({ length: numCols }, (_, i) => colLabel(i))

    for (let r = 0; r <= cutoff; r++) {
      const row = { chunk_title: sheetName, _row_idx: r }
      headers.forEach((h, i) => { row[h] = raw[r]?.[i] ?? '' })
      allRows.push(row)
    }
  }

  return allRows
}

export function registerDirectHandlers() {
  ipcMain.on('open-direct-setup',  () => createDirectSetupWindow())
  ipcMain.on('close-direct-setup', () => { directSetupWin?.close() })
  ipcMain.on('open-direct-file-view', () => createDirectFileViewWindow())
  ipcMain.on('close-direct-file-view', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('open-xls-file-dialog', async () => {
    const result = await dialog.showOpenDialog(directSetupWin, {
      title: 'Select Excel file',
      filters: [{ name: 'Excel Files', extensions: ['xls', 'xlsx'] }],
      properties: ['openFile'],
    })
    if (result.canceled) return null

    directFileName = result.filePaths[0].split('/').pop()
    directFileData = parseXlsxToRows(result.filePaths[0])
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('direct-file-loaded'))
    createDirectFileViewWindow()
    return directFileName
  })

  ipcMain.handle('get-direct-file-data', () => ({
    rows: directFileData ?? [],
    fileName: directFileName,
  }))

  ipcMain.handle('get-direct-mapping', (_, fileName) => {
    if (!existsSync(MAPPING_FILE)) return null
    try {
      const all = JSON.parse(readFileSync(MAPPING_FILE, 'utf8'))
      return all[fileName] ?? null
    } catch { return null }
  })

  ipcMain.handle('save-direct-mapping', (_, { fileName, tabs }) => {
    mkdirSync(MAPPING_DIR, { recursive: true })
    let all = {}
    if (existsSync(MAPPING_FILE)) {
      try { all = JSON.parse(readFileSync(MAPPING_FILE, 'utf8')) } catch {}
    }
    all[fileName] = { tabs }
    writeFileSync(MAPPING_FILE, JSON.stringify(all, null, 2), 'utf8')
  })
}

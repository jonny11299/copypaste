import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Clipboard / shortcuts
  writeClipboard:   (text)  => ipcRenderer.invoke('write-clipboard', text),
  onGlobalKey:      (cb)    => ipcRenderer.on('global-key',       (_, key) => cb(key)),
  onGlobalShiftKey: (cb)    => ipcRenderer.on('global-shift-key', (_, key) => cb(key)),

  // Window controls
  minimizeWindow:   ()      => ipcRenderer.send('window-minimize'),
  openExternal:     (url)   => ipcRenderer.send('open-external', url),
  quitApp:          ()      => ipcRenderer.send('app-quit'),

  // Menu window
  openMenuWindow:   ()      => ipcRenderer.send('open-menu-window'),
  closeMenuWindow:  ()      => ipcRenderer.send('close-menu-window'),

  // Setup flow
  openFileDialog:   ()      => ipcRenderer.invoke('open-file-dialog'),
  loadWorkbook:     (path)  => ipcRenderer.invoke('load-workbook', path),
  processFile:      (opts)  => ipcRenderer.invoke('process-file', opts),
  parsePastedSLIs:  (text)  => ipcRenderer.invoke('parse-pasted-slis', text),
  parsePastedPLIs:  (text)  => ipcRenderer.invoke('parse-pasted-plis', text),
  setupComplete:    (data)  => ipcRenderer.send('setup-complete', data),

  // Payload viewer
  getPayload:       ()      => ipcRenderer.invoke('get-payload'),

  // Quick links
  getQuickLinks:    ()      => ipcRenderer.invoke('get-quick-links'),
  saveQuickLinks:   (links) => ipcRenderer.invoke('save-quick-links', links),

  // Main overlay — receive SLI data
  onSLIData:        (cb)    => ipcRenderer.on('sli-data', (_, data) => cb(data)),
})

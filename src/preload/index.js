import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Clipboard / shortcuts
  writeClipboard:   (text)  => ipcRenderer.invoke('write-clipboard', text),
  onGlobalKey:      (cb)    => ipcRenderer.on('global-key',       (_, key) => cb(key)),
  onGlobalShiftKey: (cb)    => ipcRenderer.on('global-shift-key', (_, key) => cb(key)),
  onGlobalNav:         (cb) => ipcRenderer.on('global-nav',         (_, dir) => cb(dir)),
  onShiftLayerOn:      (cb) => ipcRenderer.on('shift-layer-on',     cb),

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
  loadPayloadV2:    ()      => ipcRenderer.invoke('load-payload-v2'),

  // DB file management
  dbListFiles: ()           => ipcRenderer.invoke('db-list-files'),
  dbSave:      (name)       => ipcRenderer.invoke('db-save', name),
  dbLoad:      (filename)   => ipcRenderer.invoke('db-load', filename),
  dbDelete:    (filename)   => ipcRenderer.invoke('db-delete', filename),

  // Quick links
  getQuickLinks:    ()      => ipcRenderer.invoke('get-quick-links'),
  saveQuickLinks:   (links) => ipcRenderer.invoke('save-quick-links', links),

  // Main overlay — receive SLI data
  onSLIData:        (cb)    => ipcRenderer.on('sli-data', (_, data) => cb(data)),

  // SQL table window
  openPayloadTable:    ()   => ipcRenderer.send('open-payload-table'),
  closePayloadTable:   ()   => ipcRenderer.send('close-payload-table'),
  queryDb:             ()   => ipcRenderer.invoke('query-db'),

  // Generic SQL table window (DataTable.svelte test)
  openGenericSqlTable:  ()  => ipcRenderer.send('open-generic-sql-table'),
  closeGenericSqlTable: ()  => ipcRenderer.send('close-generic-sql-table'),

  // Direct setup window
  openDirectSetup:     ()                    => ipcRenderer.send('open-direct-setup'),
  closeDirectSetup:    ()                    => ipcRenderer.send('close-direct-setup'),
  openXlsFileDialog:   ()                    => ipcRenderer.invoke('open-xls-file-dialog'),
  openDirectFileView:  ()                    => ipcRenderer.send('open-direct-file-view'),
  closeDirectFileView: ()                    => ipcRenderer.send('close-direct-file-view'),
  onDirectFileLoaded:  (cb)                  => ipcRenderer.on('direct-file-loaded', cb),

  // Direct file view data & mapping
  getDirectFileData:   ()                    => ipcRenderer.invoke('get-direct-file-data'),
  getDirectMapping:    (fileName)            => ipcRenderer.invoke('get-direct-mapping', fileName),
  saveDirectMapping:   ({ fileName, tabs })  => ipcRenderer.invoke('save-direct-mapping', { fileName, tabs }),
  loadDirectToDb:      (tabMapping)          => ipcRenderer.invoke('load-direct-to-db', { tabMapping }),
})

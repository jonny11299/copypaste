"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  // Clipboard / shortcuts
  writeClipboard: (text) => electron.ipcRenderer.invoke("write-clipboard", text),
  onGlobalKey: (cb) => electron.ipcRenderer.on("global-key", (_, key) => cb(key)),
  onGlobalShiftKey: (cb) => electron.ipcRenderer.on("global-shift-key", (_, key) => cb(key)),
  onGlobalNav: (cb) => electron.ipcRenderer.on("global-nav", (_, dir) => cb(dir)),
  onShiftLayerOn: (cb) => electron.ipcRenderer.on("shift-layer-on", cb),
  // Window controls
  minimizeWindow: () => electron.ipcRenderer.send("window-minimize"),
  openExternal: (url) => electron.ipcRenderer.send("open-external", url),
  quitApp: () => electron.ipcRenderer.send("app-quit"),
  // Menu window
  openMenuWindow: () => electron.ipcRenderer.send("open-menu-window"),
  closeMenuWindow: () => electron.ipcRenderer.send("close-menu-window"),
  // Setup flow
  openFileDialog: () => electron.ipcRenderer.invoke("open-file-dialog"),
  loadWorkbook: (path) => electron.ipcRenderer.invoke("load-workbook", path),
  processFile: (opts) => electron.ipcRenderer.invoke("process-file", opts),
  parsePastedSLIs: (text) => electron.ipcRenderer.invoke("parse-pasted-slis", text),
  parsePastedPLIs: (text) => electron.ipcRenderer.invoke("parse-pasted-plis", text),
  setupComplete: (data) => electron.ipcRenderer.send("setup-complete", data),
  // Payload viewer
  getPayload: () => electron.ipcRenderer.invoke("get-payload"),
  loadPayloadV2: () => electron.ipcRenderer.invoke("load-payload-v2"),
  // DB file management
  dbListFiles: () => electron.ipcRenderer.invoke("db-list-files"),
  dbSave: (name) => electron.ipcRenderer.invoke("db-save", name),
  dbLoad: (filename) => electron.ipcRenderer.invoke("db-load", filename),
  dbDelete: (filename) => electron.ipcRenderer.invoke("db-delete", filename),
  // Quick links
  getQuickLinks: () => electron.ipcRenderer.invoke("get-quick-links"),
  saveQuickLinks: (links) => electron.ipcRenderer.invoke("save-quick-links", links),
  // Main overlay — receive SLI data
  onSLIData: (cb) => electron.ipcRenderer.on("sli-data", (_, data) => cb(data)),
  // SQL table window
  openPayloadTable: () => electron.ipcRenderer.send("open-payload-table"),
  closePayloadTable: () => electron.ipcRenderer.send("close-payload-table"),
  queryDb: () => electron.ipcRenderer.invoke("query-db")
});

"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  // Clipboard / shortcuts
  writeClipboard: (text) => electron.ipcRenderer.invoke("write-clipboard", text),
  onGlobalKey: (cb) => electron.ipcRenderer.on("global-key", (_, key) => cb(key)),
  onGlobalShiftKey: (cb) => electron.ipcRenderer.on("global-shift-key", (_, key) => cb(key)),
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
  // Quick links
  getQuickLinks: () => electron.ipcRenderer.invoke("get-quick-links"),
  saveQuickLinks: (links) => electron.ipcRenderer.invoke("save-quick-links", links),
  // Main overlay — receive SLI data
  onSLIData: (cb) => electron.ipcRenderer.on("sli-data", (_, data) => cb(data))
});

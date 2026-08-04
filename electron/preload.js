const { contextBridge } = require('electron');

// The renderer talks to the local Express API purely over HTTP
// (same-origin in production), so no privileged IPC bridge is required.
// This file is kept intentionally minimal / low-privilege.
contextBridge.exposeInMainWorld('appInfo', {
  isElectron: true,
});

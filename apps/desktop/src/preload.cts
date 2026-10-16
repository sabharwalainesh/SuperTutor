import { contextBridge } from 'electron';

// Deliberately tiny. Anything the renderer needs from the OS gets added here,
// one explicit function at a time — never expose ipcRenderer wholesale.
contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // 打开文件夹选择并扫描
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  
  // 读取文件内容 (Buffer)
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  
  // 在资源管理器中显示
  showItemInFolder: (path) => ipcRenderer.invoke('shell:showItemInFolder', path),
  
  // 标记这是 Electron 环境
  isElectron: true
});
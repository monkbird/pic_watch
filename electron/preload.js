const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // 打开文件夹选择并扫描
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  
  // 读取文件内容 (Buffer) - 全量
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),

  // [新增] 读取部分文件内容 (用于快速提取元数据)
  readPartialFile: (path, size) => ipcRenderer.invoke('fs:readPartialFile', { filePath: path, size }),
  
  // 在资源管理器中显示
  showItemInFolder: (path) => ipcRenderer.invoke('shell:showItemInFolder', path),

  // 复制文件路径
  copyFiles: (paths) => ipcRenderer.invoke('clipboard:copyFiles', paths),
  
  // 标记这是 Electron 环境
  isElectron: true
});
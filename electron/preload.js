const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // 打开文件夹选择并扫描
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  
  // 扫描指定路径
  scanDirectory: (path) => ipcRenderer.invoke('fs:scanDirectory', path),

  // 读取文件内容
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),

  // 读取部分文件内容
  readPartialFile: (path, size) => ipcRenderer.invoke('fs:readPartialFile', { filePath: path, size }),
  
  // [新增] 删除文件 (移至回收站)
  trashFile: (path) => ipcRenderer.invoke('fs:trashFile', path),
  deleteFilePermanent: (path) => ipcRenderer.invoke('fs:deleteFilePermanent', path),
  
  // [新增] 写入元数据
  writeMetadata: (path, data) => ipcRenderer.invoke('fs:writeMetadata', path, data),

  // 在资源管理器中显示
  showItemInFolder: (path) => ipcRenderer.invoke('shell:showItemInFolder', path),

  // 复制文件
  copyFiles: (paths) => ipcRenderer.invoke('clipboard:copyFiles', paths),
  
  // 标记这是 Electron 环境
  isElectron: true
});
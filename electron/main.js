import { app, BrowserWindow, ipcMain, dialog, shell, clipboard } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 允许扫描的图片扩展名
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.heic']);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false // 允许加载本地 file:// 图片资源
    },
    autoHideMenuBar: true
  });

  // 开发环境加载本地服务，生产环境加载打包文件
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// --- 剪贴板辅助函数 (实现文件实体复制的核心) ---

// Windows: 构建 DROPFILES 结构 (CF_HDROP)
function createWindowsDropFilesBuffer(paths) {
  // DROPFILES 结构体 (20字节头)
  const header = Buffer.alloc(20);
  header.writeInt32LE(20, 0); // pFiles offset
  header.writeInt32LE(1, 16); // fWide = 1 (Unicode)

  // 路径列表转换: UTF-16LE 编码，以 \0\0 分隔，以 \0\0\0\0 结尾
  const pathBuffers = paths.map(p => {
    // Windows 路径必须使用反斜杠
    const winPath = p.replace(/\//g, '\\');
    return Buffer.from(winPath + '\0', 'ucs2'); 
  });
  
  const pathsBuffer = Buffer.concat([...pathBuffers, Buffer.from('\0', 'ucs2')]);
  
  return Buffer.concat([header, pathsBuffer]);
}

// macOS: 构建 XML Plist (NSFilenamesPboardType)
function createMacPboardPlist(paths) {
  const xmlItems = paths.map(p => `<string>${p}</string>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
${xmlItems}
</array>
</plist>`;
  return Buffer.from(xml, 'utf8');
}

// Linux: 构建 URI List (text/uri-list)
function createLinuxUriList(paths) {
  const uris = paths.map(p => `file://${p}`).join('\r\n');
  return Buffer.from(uris, 'utf8');
}


// --- IPC Handlers (前后端通信) ---

// 1. 选择文件夹并扫描 (支持区分多文件夹导入)
ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  const rootPath = filePaths[0];
  const files = [];

  // 预先处理根目录路径，作为统一的 Group Key
  // 将反斜杠统一为正斜杠，确保跨平台一致性
  const groupKey = rootPath.split(path.sep).join('/');

  // 递归扫描文件
  async function scanDir(currentPath) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ALLOWED_EXTENSIONS.has(ext)) {
            const stats = await fs.stat(fullPath);
            
            files.push({
              name: entry.name,
              path: fullPath, // 绝对路径
              parent: groupKey, // <--- 统一使用导入根目录作为分组依据
              size: stats.size,
              lastModified: stats.mtimeMs
            });
          }
        }
      }
    } catch (e) {
      console.error(`Error scanning ${currentPath}:`, e);
    }
  }

  await scanDir(rootPath);
  return files;
});

// 2. 读取文件 Buffer (供 exifr 解析元数据)
// [优化] 增加 partial 读取接口，避免读取大文件全部内容
ipcMain.handle('fs:readPartialFile', async (event, { filePath, size }) => {
  let fh;
  try {
    fh = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(size);
    const { bytesRead } = await fh.read(buffer, 0, size, 0);
    await fh.close();
    return buffer.subarray(0, bytesRead);
  } catch (e) {
    console.error("Read partial file error:", e);
    if (fh) await fh.close();
    return null;
  }
});

// 保留全量读取接口作为后备 (虽然目前主要用 partial)
ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    return await fs.readFile(filePath);
  } catch (e) {
    console.error("Read file error:", e);
    return null;
  }
});

// 3. 打开所在文件夹
ipcMain.handle('shell:showItemInFolder', (event, filePath) => {
  shell.showItemInFolder(filePath);
});

// 4. 复制文件实体到剪贴板 (原生文件复制)
ipcMain.handle('clipboard:copyFiles', (event, filePaths) => {
  if (!filePaths || filePaths.length === 0) return;
  
  clipboard.clear();

  try {
    if (process.platform === 'win32') {
      const buffer = createWindowsDropFilesBuffer(filePaths);
      clipboard.writeBuffer('CF_HDROP', buffer);
    } else if (process.platform === 'darwin') {
      const buffer = createMacPboardPlist(filePaths);
      clipboard.writeBuffer('NSFilenamesPboardType', buffer);
    } else {
      const buffer = createLinuxUriList(filePaths);
      clipboard.writeBuffer('text/uri-list', buffer);
    }
    
    clipboard.writeText(filePaths.join('\n'));
    return true;
  } catch (error) {
    console.error('Copy files error:', error);
    return false;
  }
});
import { app, BrowserWindow, ipcMain, dialog, shell, clipboard } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
 


const __dirname = path.dirname(fileURLToPath(import.meta.url));
let clipboardEx = null;

// 允许扫描的图片扩展名
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.heic']);

// === 性能优化：强制开启 GPU 加速 ===
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('max-active-webgl-contexts', '100'); 

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // 允许加载本地 file:// 图片资源
      backgroundThrottling: false 
    },
    autoHideMenuBar: true
  });

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
  // 1. 计算所有路径的总字节数 (UTF-16LE)
  // 路径之间用 \0 分隔 (2字节)，列表结尾再加 \0 (2字节)
  let pathsSize = 0;
  const pathBuffers = paths.map(p => {
    // 必须使用反斜杠，且绝对不能有混用的斜杠
    const winPath = path.normalize(p).replace(/\//g, '\\');
    const buffer = Buffer.from(winPath + '\0', 'ucs2'); // ucs2 即 utf-16le
    pathsSize += buffer.length;
    return buffer;
  });
  // 列表结尾的双 NULL (一个属于最后一个路径，一个是列表终止符)
  // map 里已经给每个路径加了 \0，所以只需要额外加一个 \0 (2字节)
  pathsSize += 2; 

  // 2. 构建 DROPFILES 结构体 (20字节)
  const headerSize = 20;
  const totalSize = headerSize + pathsSize;
  const buffer = Buffer.alloc(totalSize);

  // DROPFILES.pFiles (偏移量，指向路径数据开始的位置)
  buffer.writeInt32LE(headerSize, 0); 
  
  // DROPFILES.pt (鼠标坐标，不需要，填0)
  buffer.writeInt32LE(0, 4); // x
  buffer.writeInt32LE(0, 8); // y
  
  // DROPFILES.fNC (非客户区，填0)
  buffer.writeInt32LE(0, 12);
  
  // DROPFILES.fWide (宽字符标志，必须为 1)
  buffer.writeInt32LE(1, 16);

  // 3. 写入路径数据
  let offset = headerSize;
  for (const pathBuf of pathBuffers) {
    pathBuf.copy(buffer, offset);
    offset += pathBuf.length;
  }
  
  // 写入列表终止符 \0 (2字节)
  buffer.write('\0', offset, 'ucs2');

  return buffer;
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

// --- 通用扫描逻辑 ---
async function scanDirectoryFiles(rootPath) {
  const files = [];
  const groupKey = rootPath.split(path.sep).join('/');

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
              path: fullPath,
              parent: groupKey,
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
}


// --- IPC Handlers ---

ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  const rootPath = filePaths[0];
  const files = await scanDirectoryFiles(rootPath);
  
  return { rootPath, files };
});

ipcMain.handle('fs:scanDirectory', async (event, rootPath) => {
  if (!rootPath) return [];
  return await scanDirectoryFiles(rootPath);
});

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

ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    return await fs.readFile(filePath);
  } catch (e) {
    console.error("Read file error:", e);
    return null;
  }
});

ipcMain.handle('fs:deleteFilePermanent', async (event, filePath) => {
  try {
    await fs.rm(filePath);
    return true;
  } catch (e) {
    console.error("Delete file error:", e);
    return false;
  }
});

// [新增] 文件删除（移至回收站）
ipcMain.handle('fs:trashFile', async (event, filePath) => {
  try {
    // shell.trashItem 是 Electron 提供的安全删除方法（移入回收站）
    // 如果希望永久删除，可用 fs.rm / fs.unlink，但通常桌面软件建议用 trash
    await shell.trashItem(filePath);
    return true;
  } catch (e) {
    console.error("Trash file error:", e);
    return false;
  }
});

ipcMain.handle('shell:showItemInFolder', (event, filePath) => {
  shell.showItemInFolder(filePath);
});

// [终极修复] 使用原生模块复制文件
ipcMain.handle('clipboard:copyFiles', async (event, filePaths) => {
  if (!filePaths || filePaths.length === 0) return false;

  try {
    if (!clipboardEx && (process.platform === 'win32' || process.platform === 'darwin')) {
      try {
        const mod = await import('electron-clipboard-ex');
        clipboardEx = mod.default || mod;
      } catch {}
    }
    if (!clipboardEx) return false;
    clipboardEx.writeFilePaths(filePaths);
    return true;
  } catch (error) {
    console.error('Copy files error:', error);
    return false;
  }
});

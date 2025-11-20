import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron';
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

// --- IPC Handlers (前后端通信) ---

// 1. 选择文件夹并扫描
ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  const rootPath = filePaths[0];
  const files = [];

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
            // 获取文件状态 (大小, 修改时间)
            const stats = await fs.stat(fullPath);
            files.push({
              name: entry.name,
              path: fullPath, // 绝对路径
              parent: path.relative(rootPath, path.dirname(fullPath)) || '根目录',
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
ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const buffer = await fs.readFile(filePath);
    return buffer;
  } catch (e) {
    console.error("Read file error:", e);
    return null;
  }
});

// 3. 打开所在文件夹 (实现您的需求)
ipcMain.handle('shell:showItemInFolder', (event, filePath) => {
  shell.showItemInFolder(filePath);
});
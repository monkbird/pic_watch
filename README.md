# PicWatch 桌面版（Electron + React + Vite）

## 功能概览
- 浏览与分组查看图片（JPG/PNG/WEBP/TIFF/HEIC 等）
- 提取并显示元数据（EXIF/IPTC/尺寸/文件信息）
- 分组：按“文件夹 / 日期 / 年份 / 备注 / 类型”
- 搜索与筛选：格式、最小宽度、关键字
- 卡片网格 + 详情面板 + 大图查看
- 导出分组为 JSON

## 环境与安装
- Node.js 18+
- 安装依赖：`npm install`

## 开发与构建
- Web 开发：
  - `npm run dev`
  - 打开 `http://localhost:5173/`
- 桌面开发（Electron）：
  - `npm run electron:dev`
  - 自动启动 Vite 与 Electron，加载开发页面
- 生产构建：
  - Web：`npm run build`
  - 桌面安装包：`npm run electron:build`（输出在 `dist-electron/`）
 - Linux（UOS）构建：
   - 在 Windows 下已生成 `linux-unpacked`，并提供压缩包下载（见下方“发布与下载”）
   - 如需标准 `AppImage`/`deb`，建议在 Linux 环境运行：
     - `npx electron-builder --linux AppImage`
     - `npx electron-builder --linux deb`

## 使用说明
- 打开文件夹后进行分组浏览与筛选；搜索支持文件名与备注字段
- 导出分组：右上“导出分组 JSON”

## 目录结构
- `src/`：React 组件与工具（按要求保持不修改：`src/components`、`src/utils`、`src/App.jsx`）
- `electron/`：主进程与预加载脚本
- `index.html`、`vite.config.js`、`tailwind.config.js`：配置
- `package.json`：依赖与脚本

## 说明
- 旧版 Python 端（PySide6 GUI / CLI 扫描）已移除；不再需要 Python 依赖与脚本

## 版本更新
- v1.0.3（2025-11-22）
  - 项目优化与修改总结（见下文），提升大数据量场景性能与体验
  - README 同步上述优化内容
- v1.0.2（2025-11-21）
  - README 发布链接改为“最新 Release”动态链接
  - 增加 Linux（UOS）构建与下载说明
  - 配置 `package.json` 的 Linux AppImage 构建目标
- v1.0.1（2025-11-21）
  - 完善文档与使用说明
  - 明确 Electron 构建输出目录 `dist-electron/`
  - 补充开发与构建脚本说明
  - 新增 UOS/Linux 压缩包发布（`PicWatch-1.0.1-linux-x64.tar.gz`）

## 发布与下载
- Release 页面：`https://github.com/monkbird/pic_watch/releases/latest`
- Windows：`PicWatch Setup 1.0.1.exe`
- UOS/Linux：`PicWatch-1.0.1-linux-x64.tar.gz`
  - 使用：解压后在目录执行 `chmod +x picwatch && ./picwatch`

## 项目优化与修改总结

### 核心架构优化（Performance & Architecture）
- UI 虚拟化（Virtualization）
  - 重写 `src/components/PhotoGrid.jsx`，仅渲染可见区域及缓冲范围
  - 基于 `scrollTop` 与容器高度计算可见行；使用绝对定位定位卡片
  - 通过 `ResizeObserver` 动态计算列数，适配容器宽度变化
- 智能预加载（Pre-fetching）
  - 优化 `src/components/ImageViewer.jsx`，按当前索引预加载前后相邻图片
  - 使用隐藏的 `link rel="preload"` 或 `img` 触发预加载，切换“瞬开”
- 主线程解放（Time-slicing）
  - 优化 `src/App.jsx` 的 `processFiles`，按批次处理（批大小约 50）
  - 每批次后 `await new Promise(r => setTimeout(r, 0))` 让出主线程
- 渲染性能优化（Memoization）
  - 优化 `src/components/PhotoCard.jsx`，使用 `React.memo`
  - 自定义比较，状态或元数据变化才重渲染；图片使用 `decoding="async"`

### 功能增强与修复（Features & Fixes）
- 复制功能增强
  - 单图：Web 端尝试写入剪贴板为 Image 数据，便于粘贴到聊天软件
  - 多图：复制文件路径文本列表
  - Electron 端：保持系统级文件复制（CF_HDROP / NSFilenamesPboardType）
  - 在 `src/App.jsx` 添加全局快捷键监听（Ctrl/Command + C）
- 多选逻辑修复
  - 简化 `handleSelection`；修正 `PhotoCard` 的 `React.memo` 比较
  - 重写 `setSelectedFiles` 更新逻辑，基于最新 `prev` 构建新集合
- 初始化 Bug 修复
  - `src/components/PhotoGrid.jsx` 将 `ref={containerRef}` 绑定到最外层容器
  - 确保 `ResizeObserver` 始终监听到尺寸，正确计算布局
- 属性编辑与复制
  - `src/components/DetailsPanel.jsx` 支持“标记/备注”编辑与复制按钮
- 日期分组逻辑修正
  - `src/utils/classifier.js` 按日期分组仅截取 `YYYY-MM-DD`，忽略时分秒

### UI/UX 改进
- 侧边栏分组图标化
  - `src/components/Sidebar.jsx` 顶部分组模式使用横向图标按钮（文件夹/日期/年份/备注等）
- 渐隐式滚动条
  - `src/index.css` 新增 `.custom-scrollbar`：默认透明，悬停显示纤细滑块并有悬停高亮

## 许可证
- 默认未设置许可证；如需开源请在仓库中添加 LICENSE 文件。

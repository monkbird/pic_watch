# PicWatch 桌面版（Electron + React + Vite）

## 功能概览
- 浏览与分组查看图片（JPG/PNG/WEBP/TIFF/HEIC 等）
- 提取并显示元数据（EXIF/IPTC/尺寸/文件信息）
- 分组：按“文件夹 / 日期 / 年份 / 备注 / 类型”
- 搜索与筛选：格式、最小宽度、关键字
- 卡片网格 + 详情面板 + 大图查看
- 导出分组为 JSON
- AI 智能辅助：支持配置多种 AI 模型（火山、智谱、通义、OpenAI 等）进行场景识别

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
- AI 识别：点击顶部设置图标配置模型（支持火山引擎、智谱 GLM-4V、阿里 Qwen-VL 等），配置后可对单图进行智能分析

## 目录结构
- `src/`：React 组件与工具（按要求保持不修改：`src/components`、`src/utils`、`src/App.jsx`）
- `electron/`：主进程与预加载脚本
- `index.html`、`vite.config.js`、`tailwind.config.js`：配置
- `package.json`：依赖与脚本

## 说明
- 旧版 Python 端（PySide6 GUI / CLI 扫描）已移除；不再需要 Python 依赖与脚本

## 版本更新
- v1.0.6（2025-11-28）
  - 分组模式选择器从下拉菜单改为横向排列的图标按钮
  - 新增软件图标
  - 修复其他bug
- v1.0.5（2025-11-27）
  - 修复文件复制功能：重写剪贴板逻辑，支持系统级文件实体复制（CF_HDROP），可直接在资源管理器中粘贴文件（不再仅复制路径文本）。
  - 修复文件删除功能：引入 `shell.trashItem`，支持将文件移入系统回收站（不再仅从软件列表中移除）。
  - 新增 AI 设置弹窗：支持可视化配置模型服务商（火山引擎、智谱 AI、阿里通义、OpenAI 等）。
  - 动态配置支持：移除硬编码 Key，配置本地持久化存储，打包后仍可灵活修改。
  - 交互优化：顶部栏增加 AI 配置状态提示，未配置时引导用户设置。
- v1.0.4（2025-11-23）
  - 网格改为类瀑布流（Masonry），图片按原始比例自适应高度
  - 照片卡片底色改为透明，去除外框线；保留悬停阴影与图片悬停缩放
  - 底部遮罩文字取备注的第二层级（如“工程项目_防火林带2025_...”显示“防火林带2025”）
  - 取消卡片内容上下空白，列表更紧凑；卡片高度随内容自然变化
  - 详情面板支持“标记/备注”编辑（保存/取消/复制），即时生效
  - 修复更新元数据时覆盖 `exif/iptc` 导致备注丢失的问题
  - 加入 AI 识别功能，加强 AI 识别逻辑，提升识别精细度（提示词收敛、结果清洗）
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

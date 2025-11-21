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
- v1.0.1（2025-11-21）
  - 完善文档与使用说明
  - 明确 Electron 构建输出目录 `dist-electron/`
  - 补充开发与构建脚本说明

## 许可证
- 默认未设置许可证；如需开源请在仓库中添加 LICENSE 文件。

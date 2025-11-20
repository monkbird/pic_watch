# PicWatch Web

## 功能概览
- 浏览与分组查看图片（JPG/PNG/WEBP/TIFF/HEIC 等）
- 提取并显示元数据（EXIF/IPTC/尺寸/文件信息）
- 分组：按“文件夹 / 日期 / 年份 / 备注 / 类型”
- 搜索与筛选：格式、最小宽度、关键字
- 卡片网格 + 详情面板 + 大图查看
- 导出分组为 JSON

## 环境与安装
- Node.js 18+
- 安装依赖：
  - `npm install`

## 开发与构建
- 启动开发：
  - `npm run dev`
  - 打开 `http://localhost:5173/`
- 生产构建：
  - `npm run build`
  - 本地预览：`npm run preview`

## 使用说明
- 点击“打开文件夹”选择图片目录（浏览器目录选择）
- 支持分组查看与筛选；右上搜索支持文件名与备注字段
- 导出分组：右上“导出分组 JSON”

## 目录结构
- `src/`：React 组件与工具（不可直接修改：`src/components`、`src/utils`、`src/App.jsx`）
- `index.html`、`vite.config.js`、`tailwind.config.js`：前端配置
- `package.json`：依赖与脚本

## 说明
- 旧版 Python 端（PySide6 GUI / CLI 扫描）已移除，不再需要 Python 运行环境与依赖

## 许可证
- 默认未设置许可证；如需开源请在仓库中添加 LICENSE 文件。

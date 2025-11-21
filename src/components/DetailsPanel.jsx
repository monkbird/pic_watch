import React from 'react';
import { Info, X, Copy } from 'lucide-react';
import { Button } from './ui/Primitives';
import { humanSize, formatDate } from '../utils/metadata';

const InfoRow = ({ label, value, copyable }) => (
  <div className="group flex flex-col py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">{label}</span>
    <div className="flex items-center justify-between min-h-[20px]">
      <span className="text-xs text-slate-700 break-all leading-relaxed select-text whitespace-pre-wrap">
        {value || <span className="text-slate-300">-</span>}
      </span>
      {copyable && value && (
        <button 
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-400 transition-opacity shrink-0"
          onClick={() => navigator.clipboard.writeText(value)}
          title="复制"
        >
          <Copy className="w-3 h-3" />
        </button>
      )}
    </div>
  </div>
);

const DetailsPanel = ({ file, onClose }) => {
  if (!file) return null;
  
  const tags = file.iptc?.Keywords?.join('; ');
  const remark = file.exif?.ImageDescription; 
  const camera = [file.exif?.Make, file.exif?.Model].filter(Boolean).join(' ');

  return (
    // 修改：移除了 w-80, border, animate 等外部布局样式，只保留内部结构样式
    // 宽度和边框现在由 App.jsx 中的容器控制
    <div className="h-full flex flex-col bg-white">
      <div className="h-12 border-b border-slate-200 flex items-center justify-between px-4 bg-slate-50/50 shrink-0">
        <span className="font-semibold text-sm text-slate-700 flex items-center gap-2"><Info className="w-4 h-4" /> 属性详情</span>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-2 flex items-center justify-center min-h-[160px]">
           {file.thumbnail ? <img src={file.thumbnail} alt="preview" className="max-w-full max-h-48 object-contain shadow-sm rounded" /> : <span className="text-slate-400 text-xs">无预览</span>}
        </div>
        <div className="space-y-6">
          <div>
            <h4 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">基本信息</h4>
            <InfoRow label="文件名" value={file.name} copyable />
            <InfoRow label="目录" value={file.parent} copyable />
            <InfoRow label="大小" value={humanSize(file.size)} />
            <InfoRow label="尺寸" value={file.dims ? `${file.dims.w} x ${file.dims.h}` : '-'} />
            <InfoRow label="修改时间" value={new Date(file.lastModified).toLocaleString()} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">内容与描述</h4>
            <InfoRow label="标记 (Tags)" value={tags} copyable />
            <InfoRow label="备注 (Remarks)" value={remark} copyable />
          </div>
          {(camera || file.exif?.FNumber) && (
            <div>
              <h4 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">拍摄参数</h4>
              <InfoRow label="相机" value={camera} />
              <InfoRow label="光圈" value={file.exif?.FNumber ? `f/${file.exif.FNumber}` : ''} />
              <InfoRow label="拍摄时间" value={formatDate(file.dateOriginal)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailsPanel;
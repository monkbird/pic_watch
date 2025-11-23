import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { formatDate } from '../utils/metadata';

const PhotoCard = ({ file, selected, onSelect, onDoubleClick, onContextMenu }) => {
  
  // 获取底部显示的标签内容
  // 修改逻辑：优先显示 AI 识别内容，取代原有的 ImageDescription 逻辑
  const getDisplayContent = () => {
    // 1. 正在处理中
    if (file.aiStatus === 'processing') {
      return "AI 识别中...";
    }

    // 2. 识别完成，显示结果
    if (file.aiData?.labels && Array.isArray(file.aiData.labels) && file.aiData.labels.length > 0) {
      return file.aiData.labels.join('，'); // 中文逗号分隔更易读
    }

    // 3. 回退：显示文件名 (原始需求)
    return file.name;
  };

  const displayContent = getDisplayContent();
  
  // 确定是否是 AI 内容 (用于样式微调)
  const isAiContent = file.aiData?.labels?.length > 0;

  const getRemarkTitle = () => {
    const remark = (file.exif && file.exif.ImageDescription) || (file.iptc && file.iptc.Caption) || '';
    if (!remark || typeof remark !== 'string') return null;
    const parts = remark.trim().split(/[_、，,;\s]+/).filter(Boolean);
    if (parts.length === 0) return null;
    if (/工程项目|项目|工程/.test(parts[0]) && parts.length >= 2) return parts[1];
    const candidate = parts.find(p => /\d{4}/.test(p)) || parts[0];
    return candidate;
  };

  const overlayLabel = getRemarkTitle() || file.parent || file.name;

  return (
    <div 
      onClick={(e) => {
        e.stopPropagation();
        onSelect(file, e.ctrlKey || e.metaKey, e.shiftKey);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(file);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, file);
      }}
      className={`
        group relative flex flex-col rounded-lg border bg-white transition-all duration-200 select-none h-auto
        ${selected 
          ? 'ring-2 ring-blue-500 border-blue-500 shadow-md z-10' 
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}
      `}
    >
      <div className="aspect-[4/3] w-full overflow-hidden rounded-t-lg bg-slate-100 relative flex items-center justify-center shrink-0">
        {file.thumbnail ? (
          <img 
            src={file.thumbnail} 
            alt={file.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <ImageIcon className="w-8 h-8 text-slate-300" />
        )}
        
        {/* 底部遮罩：悬停时显示完整内容 */}
        <div className={`absolute inset-x-0 bottom-0 bg-black/60 p-1.5 backdrop-blur-[2px] transition-opacity duration-200 flex justify-center items-center text-[10px] text-white/90 font-medium ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <span className="truncate max-w-full px-1" title={overlayLabel}>{overlayLabel}</span>
        </div>
      </div>

      {/* 内容区域：不再使用 h-16 固定高度或 truncate，允许内容撑开 */}
      <div className="p-2.5 flex flex-col gap-1.5">
        <p 
          className={`text-xs font-medium text-slate-700 break-words whitespace-normal leading-relaxed ${isAiContent ? 'text-blue-700' : ''}`} 
          title={file.name}
        >
          {displayContent}
        </p>
        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-auto pt-1">
          <span>{file.dims ? `${file.dims.w}×${file.dims.h}` : '...'}</span>
          <span>{formatDate(file.dateOriginal)}</span>
        </div>
      </div>
    </div>
  );
};

export default PhotoCard;
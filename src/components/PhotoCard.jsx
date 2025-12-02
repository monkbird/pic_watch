import React, { memo } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { formatDate } from '../utils/metadata';

// 使用 React.memo 优化渲染性能
const PhotoCard = memo(({ file, selected, onSelect, onDoubleClick, onContextMenu }) => {
  
  const getDisplayContent = () => {
    if (file.aiStatus === 'processing') return "AI 识别中...";
    if (file.aiData?.labels && Array.isArray(file.aiData.labels) && file.aiData.labels.length > 0) {
      return file.aiData.labels.join('，');
    }
    return file.name;
  };

  const displayContent = getDisplayContent();
  // const isAiContent = file.aiData?.labels?.length > 0; // 不再用于颜色判断

  const getProjectNameFromRemark = () => {
    const remark = (file.exif?.ImageDescription || file.iptc?.Caption || '').trim();
    if (!remark) return null;
    const parts = remark.split('_').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) return parts[1];
    return null;
  };

  const overlayLabel = getProjectNameFromRemark() || (file.parent || file.name);

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
        group relative flex flex-col rounded-lg bg-transparent transition-all duration-200 select-none h-auto
        ${selected 
          ? 'ring-2 ring-blue-500 shadow-md z-10' 
          : 'hover:shadow-md'}
      `}
    >
      <div className="w-full overflow-hidden rounded-t-lg bg-transparent relative">
        {file.thumbnail ? (
          <img 
            src={file.thumbnail} 
            alt={file.name}
            className="w-full h-auto object-contain transition-transform duration-500 transform-gpu group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex items-center justify-center py-12">
            <ImageIcon className="w-8 h-8 text-slate-300" />
          </div>
        )}
        
        {/* 底部遮罩 */}
        <div className={`absolute inset-x-0 bottom-0 bg-black/60 p-1 backdrop-blur-[2px] transition-opacity duration-200 flex justify-center items-center text-[10px] text-white/90 font-medium ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <span className="truncate max-w-full px-1" title={overlayLabel}>{overlayLabel}</span>
        </div>
      </div>

      {/* 调整：增加 py-1 和 gap-1 拉开一点间距 */}
      <div className="px-2 py-1 flex flex-col gap-1">
        <p 
          className="text-xs font-bold text-slate-800 break-words whitespace-normal leading-tight" 
          title={file.name}
          // 强制指定黑体 (SimHei) 优先，兼容 Mac 的黑体
          style={{ fontFamily: '"SimHei", "Heiti SC", "Microsoft YaHei", sans-serif' }}
        >
          {displayContent}
        </p>
        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0 pb-0 font-sans">
          {/* 修复：补全模板字符串中的 $ 符号，正确显示尺寸 */}
          <span>{file.dims ? `${file.dims.w}×${file.dims.h}` : '...'}</span>
          <span>{formatDate(file.dateOriginal)}</span>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.file.id === nextProps.file.id &&
    prevProps.selected === nextProps.selected &&
    prevProps.file.aiStatus === nextProps.file.aiStatus && 
    prevProps.file.name === nextProps.file.name
  );
});

export default PhotoCard;
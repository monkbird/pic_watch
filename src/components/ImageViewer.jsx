import React, { useEffect } from 'react';
import { Download, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/Primitives';
import { humanSize } from '../utils/metadata';

const ImageViewer = ({ file, onClose, onPrev, onNext, hasPrev, hasNext }) => {
  
  // 键盘事件监听 (支持左右方向键切换)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      if (e.key === 'ArrowRight' && hasNext) onNext();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, onPrev, onNext, onClose]);

  if (!file) return null;
  
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200" onClick={onClose}>
      {/* 顶部栏 */}
      <div className="h-14 flex items-center justify-between px-4 bg-black/50 backdrop-blur-md border-b border-white/10 shrink-0 absolute top-0 inset-x-0 z-50" onClick={e => e.stopPropagation()}>
        <div className="text-white font-medium truncate max-w-md flex flex-col">
          <span>{file.name}</span>
          <span className="text-white/50 text-[10px] font-normal">{file.dims?.w}×{file.dims?.h} • {humanSize(file.size)} • {file.parent}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => window.open(file.thumbnail, '_blank')}>
             <Download className="w-5 h-5" />
          </Button>
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* 主体区域 */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative w-full h-full">
        
        {/* 左切换按钮 */}
        {hasPrev && (
          <button 
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/30 hover:bg-black/60 text-white/70 hover:text-white transition-all z-20 focus:outline-none focus:ring-2 focus:ring-white/50"
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            title="上一张 (←)"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
        )}

        {/* 图片 */}
        <img 
          key={file.id} // key 变化触发重新渲染，避免图片切换时闪烁或残留
          src={file.thumbnail} 
          alt={file.name}
          className="max-w-full max-h-full object-contain shadow-2xl select-none animate-in zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()} 
        />

        {/* 右切换按钮 */}
        {hasNext && (
          <button 
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/30 hover:bg-black/60 text-white/70 hover:text-white transition-all z-20 focus:outline-none focus:ring-2 focus:ring-white/50"
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            title="下一张 (→)"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ImageViewer;
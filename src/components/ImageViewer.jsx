import React, { useEffect, useState, useRef } from 'react';
import { Download, X, ChevronLeft, ChevronRight, Info, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from './ui/Primitives';
import { humanSize } from '../utils/metadata';
import DetailsPanel from './DetailsPanel';

const ImageViewer = ({ file, onClose, onPrev, onNext, hasPrev, hasNext, onUpdateMetadata, aiConfig, onOpenSettings }) => {
  const [showInfo, setShowInfo] = useState(false);
  const [scale, setScale] = useState(1);
  
  // 新增：拖拽相关状态
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  
  const imgRef = useRef(null);
  const containerRef = useRef(null); // 用于绑定滚轮事件的容器

  // 切换图片时重置状态
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [file?.id]);

  const handleZoomIn = () => setScale(s => Math.min(s * 1.2, 5));
  const handleZoomOut = () => {
    setScale(s => {
      const newScale = Math.max(s / 1.2, 0.1); // 允许缩小到 0.1
      if (newScale <= 1) setPosition({ x: 0, y: 0 }); // 缩小回1倍以下时归位
      return newScale;
    });
  };
  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // 使用原生事件监听 wheel，以便设置 passive: false 来阻止浏览器默认缩放
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      // 1. Ctrl + 滚轮：缩放
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY * -0.005; // 缩放系数
        setScale(prevScale => {
          const newScale = Math.min(Math.max(0.1, prevScale + delta), 10);
          if (newScale <= 1 && prevScale > 1) {
             setPosition({ x: 0, y: 0 }); // 缩放回原大小时复位
          }
          return newScale;
        });
      } 
      // 2. 普通滚轮：如果未放大，则切换图片
      else {
        // 只有在没有缩放（scale 接近 1）时才允许切图
        if (Math.abs(scale - 1) < 0.05) {
          if (e.deltaY > 0 && hasNext) onNext();
          if (e.deltaY < 0 && hasPrev) onPrev();
        }
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [scale, hasNext, hasPrev, onNext, onPrev]); // 依赖项变化时重新绑定

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      if (e.key === 'ArrowRight' && hasNext) onNext();
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
      if (e.key === '0') handleResetZoom();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, onPrev, onNext, onClose]);

  // 拖拽事件处理
  const handleMouseDown = (e) => {
    // 只有放大后才允许拖拽，或者允许任意比例拖拽（此处逻辑：只有 scale > 1 才允许拖拽，更符合习惯）
    if (scale > 1) {
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      startPos.current = { ...position };
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && scale > 1) {
      e.preventDefault();
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({
        x: startPos.current.x + dx,
        y: startPos.current.y + dy
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!file) return null;
  
  return (
    // 外层容器移除 onWheel，改用 ref 绑定原生事件
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200" 
      onClick={onClose}
    >
      {/* 顶部栏 */}
      <div className="h-14 flex items-center justify-between px-4 bg-black/50 backdrop-blur-md border-b border-white/10 shrink-0 absolute top-0 inset-x-0 z-50" onClick={e => e.stopPropagation()}>
        <div className="text-white font-medium truncate max-w-md flex flex-col">
          <span>{file.name}</span>
          <span className="text-white/50 text-[10px] font-normal" title={file.path}>
            {file.dims?.w}×{file.dims?.h} • {humanSize(file.size)} • {file.path}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-white/10 rounded-lg mr-2">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={handleZoomOut} title="缩小 (-)">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-white text-xs w-8 text-center">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={handleZoomIn} title="放大 (+)">
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={handleResetZoom} title="重置 (0)">
              <RotateCcw className="w-3 h-3" />
            </Button>
          </div>

          <Button variant="ghost" className={`text-white hover:bg-white/10 ${showInfo ? 'bg-white/20' : ''}`} onClick={() => setShowInfo(!showInfo)} title="显示/隐藏属性">
             <Info className="w-5 h-5" />
          </Button>
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => window.open(file.thumbnail, '_blank')} title="在新窗口打开">
             <Download className="w-5 h-5" />
          </Button>
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={onClose} title="关闭 (Esc)">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden pt-14 w-full h-full">
        {/* 图片区域：移除 overflow-auto，改为 overflow-hidden 并自行处理拖拽 */}
        <div 
          className="flex-1 flex items-center justify-center relative overflow-hidden bg-black/20" 
          onClick={e => e.stopPropagation()}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          
          {hasPrev && (
            <button 
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/30 hover:bg-black/60 text-white/70 hover:text-white transition-all z-20 focus:outline-none focus:ring-2 focus:ring-white/50"
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              title="上一张 (← / 滚轮上)"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* 图片本身 */}
          <img 
            ref={imgRef}
            key={file.id} 
            src={file.thumbnail} 
            alt={file.name}
            className="max-w-full max-h-full object-contain shadow-2xl select-none transition-transform duration-75 ease-linear" // 拖拽时 duration 改短一点或 linear 会更跟手，这里保留一点过渡
            style={{ 
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              // 当在拖拽时，为了性能和跟手度，可以临时移除 transition
              transition: isDragging ? 'none' : 'transform 0.2s ease-out' 
            }}
            onClick={e => e.stopPropagation()} 
            draggable={false}
          />

          {hasNext && (
            <button 
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/30 hover:bg-black/60 text-white/70 hover:text-white transition-all z-20 focus:outline-none focus:ring-2 focus:ring-white/50"
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              title="下一张 (→ / 滚轮下)"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}
        </div>

        {/* 右侧属性面板 */}
        {showInfo && (
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 animate-in slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>
             <DetailsPanel 
               file={file} 
               embedded={true}
               onUpdate={(updates) => onUpdateMetadata(file.id, updates)} 
               aiConfig={aiConfig}
               onOpenSettings={onOpenSettings}
             />
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageViewer;
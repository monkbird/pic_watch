import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import PhotoCard from './PhotoCard';

const PhotoGrid = ({ files, selectedFiles, onSelect, onDoubleClick, onContextMenu }) => {
  if (files.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <ImageIcon className="w-8 h-8 opacity-40" />
        </div>
        <p className="font-medium">无图片显示</p>
        <p className="text-xs mt-1 opacity-60">请尝试选择其他分组或导入文件夹</p>
      </div>
    );
  }

  return (
    <div 
      className="flex-1 overflow-y-auto bg-slate-50/30 p-4 custom-scrollbar"
      onClick={() => onSelect(null, false, false)}
    >
      {/* 核心修改：使用 repeat(auto-fill, minmax(...)) 实现自适应布局
        - minmax(200px, 1fr): 卡片最小宽度 200px，如果有剩余空间则平分 (1fr)
        - auto-fill: 根据容器宽度自动填充尽可能多的列
        这样当右侧详情页展开导致容器变窄时，会自动减少列数，而不会挤压卡片
      */}
      <div className="pb-10" style={{ columnWidth: '220px', columnGap: '12px' }}>
        {files.map(file => (
          <div key={file.id} style={{ breakInside: 'avoid' }} className="mb-3">
            <PhotoCard 
              file={file} 
              selected={selectedFiles.has(file.id)}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              onContextMenu={onContextMenu}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PhotoGrid;
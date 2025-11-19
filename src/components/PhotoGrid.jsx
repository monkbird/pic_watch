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
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 pb-10">
        {files.map(file => (
          <PhotoCard 
            key={file.id} 
            file={file} 
            selected={selectedFiles.has(file.id)}
            onSelect={onSelect}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
    </div>
  );
};

export default PhotoGrid;
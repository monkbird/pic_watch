import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { humanSize, formatDate } from '../utils/metadata';

const PhotoCard = ({ file, selected, onSelect, onDoubleClick, onContextMenu }) => {
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
        group relative flex flex-col rounded-lg border bg-white transition-all duration-200 select-none
        ${selected 
          ? 'ring-2 ring-blue-500 border-blue-500 shadow-md z-10' 
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}
      `}
    >
      <div className="aspect-[4/3] w-full overflow-hidden rounded-t-lg bg-slate-100 relative flex items-center justify-center">
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
        
        <div className={`absolute inset-x-0 bottom-0 bg-black/60 p-1.5 backdrop-blur-[2px] transition-opacity duration-200 flex justify-between items-center text-[10px] text-white/90 font-medium ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <span>{file.extension.toUpperCase()}</span>
          <span>{humanSize(file.size)}</span>
        </div>
      </div>

      <div className="p-2.5 flex flex-col gap-0.5">
        <p className="text-xs font-medium text-slate-700 truncate" title={file.name}>{file.name}</p>
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>{file.dims ? `${file.dims.w}×${file.dims.h}` : '...'}</span>
          <span>{formatDate(file.dateOriginal)}</span>
        </div>
      </div>
    </div>
  );
};

export default PhotoCard;
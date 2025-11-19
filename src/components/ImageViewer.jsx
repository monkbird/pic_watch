import React from 'react';
import { Download, X } from 'lucide-react';
import { Button } from './ui/Primitives';
import { humanSize } from '../utils/metadata';

const ImageViewer = ({ file, onClose }) => {
  if (!file) return null;
  
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200" onClick={onClose}>
      <div className="h-14 flex items-center justify-between px-4 bg-black/50 backdrop-blur-md border-b border-white/10 shrink-0" onClick={e => e.stopPropagation()}>
        <div className="text-white font-medium truncate max-w-md flex flex-col">
          <span>{file.name}</span>
          <span className="text-white/50 text-[10px] font-normal">{file.dims?.w}×{file.dims?.h} • {humanSize(file.size)}</span>
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

      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <img 
          src={file.thumbnail} 
          alt={file.name}
          className="max-w-full max-h-full object-contain shadow-2xl"
          onClick={e => e.stopPropagation()} 
        />
      </div>
    </div>
  );
};

export default ImageViewer;
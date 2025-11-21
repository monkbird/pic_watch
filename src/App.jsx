import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Folder, Image as ImageIcon, Search, List, Info, Maximize2, Trash2, Grid, 
  RefreshCw, Download, ChevronRight, FolderOpen, Copy 
} from 'lucide-react';

import Sidebar from './components/Sidebar';
import PhotoGrid from './components/PhotoGrid';
import DetailsPanel from './components/DetailsPanel';
import ImageViewer from './components/ImageViewer';
import { Button } from './components/ui/Primitives';
import { extractMetadata, ALLOWED_EXTENSIONS } from './utils/metadata';
import { Classifier } from './utils/classifier';

export default function App() {
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [lastSelectedId, setLastSelectedId] = useState(null);
  
  const [groupMode, setGroupMode] = useState('folder');
  const [selectedGroup, setSelectedGroup] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ format: 'all', minWidth: 0 });
  
  const [showDetails, setShowDetails] = useState(true);
  const [viewerFile, setViewerFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  
  const fileInputRef = useRef(null);
  const contextMenuTimerRef = useRef(null);

  // === 通用的文件处理与导入逻辑 ===
  const processFiles = async (newFilesInput) => {
    const BATCH = 20;
    const existingPaths = new Set(files.map(f => f.path));
    let addedCount = 0;
    let newFiles = [];

    for (let i = 0; i < newFilesInput.length; i += BATCH) {
      const chunk = newFilesInput.slice(i, i + BATCH);
      
      const processed = await Promise.all(chunk.map(async (f) => {
        const metadata = await extractMetadata(f);
        return { 
          ...metadata, 
          fileObj: (f instanceof File ? f : null) 
        };
      }));
      
      const uniqueFiles = processed.filter(f => !existingPaths.has(f.path));
      
      if (uniqueFiles.length > 0) {
        uniqueFiles.forEach(f => existingPaths.add(f.path));
        newFiles = [...newFiles, ...uniqueFiles];
        addedCount += uniqueFiles.length;
      }

      setFiles(prev => [...prev, ...uniqueFiles]);
      await new Promise(r => setTimeout(r, 20));
    }
    return addedCount;
  };

  const handleElectronImport = async () => {
    setIsScanning(true);
    try {
      const rawFiles = await window.electron.selectDirectory();
      if (rawFiles && rawFiles.length > 0) {
        const added = await processFiles(rawFiles);
        if (added === 0) alert("未导入新文件（所选文件已存在）。");
      }
    } catch (error) {
      console.error("Electron import failed:", error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleWebImport = async (e) => {
    const fileList = Array.from(e.target.files);
    if (!fileList.length) return;
    setIsScanning(true);
    
    const validFiles = fileList.filter(f => ALLOWED_EXTENSIONS.has(f.name.split('.').pop().toLowerCase()));
    
    if (validFiles.length > 0) {
      const added = await processFiles(validFiles);
      if (added === 0) alert("未导入新文件（所选文件已存在）。");
    }
    
    setIsScanning(false);
    if (fileInputRef.current) fileInputRef.current.value = ''; 
  };

  const onImportClick = () => {
    if (window.electron?.selectDirectory) {
      handleElectronImport();
    } else {
      fileInputRef.current?.click();
    }
  };

  const groups = useMemo(() => {
    if (!files) return {};
    switch (groupMode) {
      case 'folder': return Classifier.groupByFolder(files);
      case 'time': return Classifier.groupByTime(files);
      case 'year': return Classifier.groupByYear(files);
      case 'remark': return Classifier.groupByRemark(files);
      case 'tags': return Classifier.groupByTags(files);
      case 'type': return Classifier.groupByType(files);
      default: return Classifier.groupByFolder(files);
    }
  }, [files, groupMode]);

  const currentGroupDisplayName = useMemo(() => {
    if (!selectedGroup) return "所有图片";
    if (groupMode === 'folder' && typeof selectedGroup === 'string') {
      const parts = selectedGroup.split(/[/\\]/);
      return parts[parts.length - 1] || selectedGroup;
    }
    return selectedGroup;
  }, [selectedGroup, groupMode]);

  useEffect(() => {
    let result = selectedGroup ? (groups[selectedGroup] || []) : files;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => {
        if (f.name.toLowerCase().includes(q)) return true;
        if (f.exif?.ImageDescription && f.exif.ImageDescription.toLowerCase().includes(q)) return true;
        if (f.iptc?.Keywords && Array.isArray(f.iptc.Keywords)) {
           if (f.iptc.Keywords.some(k => String(k).toLowerCase().includes(q))) return true;
        }
        return false;
      });
    }
    
    if (filters.format !== 'all') result = result.filter(f => f.extension === filters.format);
    if (filters.minWidth > 0) result = result.filter(f => f.dims && f.dims.w >= filters.minWidth);
    
    setFilteredFiles(result);
  }, [files, selectedGroup, searchQuery, filters, groups]);

  const activeFile = useMemo(() => {
    if (selectedFiles.size === 1) return files.find(f => f.id === Array.from(selectedFiles)[0]);
    return null;
  }, [selectedFiles, files]);

  const handleSelection = useCallback((file, multi, range) => {
    if (!file) { setSelectedFiles(new Set()); setLastSelectedId(null); return; }
    const newSet = new Set(multi ? selectedFiles : []);
    if (range && lastSelectedId) {
      const idx1 = filteredFiles.findIndex(f => f.id === lastSelectedId);
      const idx2 = filteredFiles.findIndex(f => f.id === file.id);
      if (idx1 !== -1 && idx2 !== -1) {
        const start = Math.min(idx1, idx2); const end = Math.max(idx1, idx2);
        for (let i = start; i <= end; i++) newSet.add(filteredFiles[i].id);
      }
    } else {
      if (multi && newSet.has(file.id)) newSet.delete(file.id); else newSet.add(file.id);
      setLastSelectedId(file.id);
    }
    setSelectedFiles(newSet);
  }, [selectedFiles, lastSelectedId, filteredFiles]);

  const handleContextMenu = (e, file) => {
    if (contextMenuTimerRef.current) {
      clearTimeout(contextMenuTimerRef.current);
      contextMenuTimerRef.current = null;
    }
    if (!selectedFiles.has(file.id)) {
      handleSelection(file, false, false);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  const handleMenuMouseLeave = () => {
    contextMenuTimerRef.current = setTimeout(() => {
      setContextMenu(null);
    }, 2000);
  };

  const handleMenuMouseEnter = () => {
    if (contextMenuTimerRef.current) {
      clearTimeout(contextMenuTimerRef.current);
      contextMenuTimerRef.current = null;
    }
  };

  const handleOpenFolder = () => {
    if (!window.electron?.showItemInFolder) {
      alert(`打开文件夹 (路径: ${contextMenu.file.path})\n(Web 模式不支持调用资源管理器)`);
      setContextMenu(null);
      return;
    }

    let targets = [];
    if (selectedFiles.size > 0 && selectedFiles.has(contextMenu.file.id)) {
      targets = filteredFiles.filter(f => selectedFiles.has(f.id));
    } else {
      targets = [contextMenu.file];
    }

    const visitedDirs = new Set();
    targets.forEach(file => {
      const separator = file.path.includes('\\') ? '\\' : '/';
      const dirPath = file.path.substring(0, file.path.lastIndexOf(separator));
      if (!visitedDirs.has(dirPath)) {
        visitedDirs.add(dirPath);
        window.electron.showItemInFolder(file.path);
      }
    });

    setContextMenu(null);
  };

  const handleCopy = useCallback(async () => {
    let targets = [];
    if (selectedFiles.size > 0) {
      targets = filteredFiles.filter(f => selectedFiles.has(f.id));
    } else if (contextMenu?.file) {
      targets = [contextMenu.file];
    } else if (activeFile) {
      targets = [activeFile];
    }

    if (targets.length === 0) return;

    const paths = targets.map(f => f.path);
    
    if (window.electron?.copyFiles) {
      await window.electron.copyFiles(paths);
      console.log(`已复制 ${paths.length} 个文件`);
    } else {
      navigator.clipboard.writeText(paths.join('\n'));
      alert(`Web模式：已复制 ${paths.length} 个文件路径文本`);
    }
    setContextMenu(null);
  }, [selectedFiles, filteredFiles, contextMenu, activeFile]);

  const exportGroups = () => {
    const exportData = { timestamp: new Date().toISOString(), mode: groupMode, groups: Object.entries(groups).map(([k, v]) => ({ groupName: k, count: v.length, files: v.map(f => f.name) })) };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `picwatch_groups_${groupMode}.json`; a.click();
  };

  const deleteSelected = () => {
    if (selectedFiles.size === 0) return;
    if (confirm(`确定要移除选中的 ${selectedFiles.size} 个项目吗？`)) {
      setFiles(prev => prev.filter(f => !selectedFiles.has(f.id)));
      setSelectedFiles(new Set());
    }
  };

  // === 大图浏览切换逻辑 (实现需求2) ===
  const handleNext = () => {
    if (!viewerFile) return;
    const currentIndex = filteredFiles.findIndex(f => f.id === viewerFile.id);
    if (currentIndex !== -1 && currentIndex < filteredFiles.length - 1) {
      setViewerFile(filteredFiles[currentIndex + 1]);
    }
  };

  const handlePrev = () => {
    if (!viewerFile) return;
    const currentIndex = filteredFiles.findIndex(f => f.id === viewerFile.id);
    if (currentIndex > 0) {
      setViewerFile(filteredFiles[currentIndex - 1]);
    }
  };
  // ===================================

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        handleCopy();
      }
      if (e.key === 'Delete') deleteSelected();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, deleteSelected]);

  useEffect(() => {
    const closeContext = () => setContextMenu(null);
    window.addEventListener('click', closeContext);
    return () => window.removeEventListener('click', closeContext);
  }, []);

  const handleClearAll = () => {
    if (files.length === 0) return;
    if (confirm("确定要清空所有导入的图片吗？")) {
      setFiles([]);
      setSelectedFiles(new Set());
      setSelectedGroup(null);
    }
  };

  const isMultiSelect = selectedFiles.size > 1;

  // 计算是否有上一张/下一张
  const viewerIndex = viewerFile ? filteredFiles.findIndex(f => f.id === viewerFile.id) : -1;
  const hasPrev = viewerIndex > 0;
  const hasNext = viewerIndex !== -1 && viewerIndex < filteredFiles.length - 1;

  return (
    <div className="flex flex-col h-screen w-full bg-white text-slate-900 font-sans overflow-hidden select-none">
      <input type="file" ref={fileInputRef} onChange={handleWebImport} className="hidden" webkitdirectory="" directory="" multiple />

      <header className="h-14 border-b border-slate-200 bg-white flex items-center px-4 gap-3 shrink-0 z-30 shadow-sm">
         <div className="flex items-center gap-2 mr-4">
           <div className="bg-gradient-to-br from-blue-600 to-blue-500 text-white p-1.5 rounded-lg shadow-sm"><ImageIcon className="w-5 h-5" /></div>
           <h1 className="font-bold text-lg tracking-tight text-slate-800">PicWatch</h1>
         </div>
         <div className="h-6 w-px bg-slate-200 mx-2" />
         
         <Button variant="secondary" onClick={onImportClick}>
           <Folder className="w-4 h-4 mr-2 text-blue-600" /> 导入文件夹
         </Button>
         
         <Button variant="ghost" onClick={exportGroups} disabled={files.length === 0} title="导出分组 JSON"><Download className="w-4 h-4" /></Button>
         {files.length > 0 && (
            <Button variant="ghost" onClick={handleClearAll} title="清空所有"><Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" /></Button>
         )}
         
         <div className="flex-1" />
         <div className="relative group">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input className="pl-9 pr-3 py-1.5 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 border rounded-md text-sm w-48 transition-all focus:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
              placeholder="搜索文件名、备注..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
         </div>
         <div className="flex items-center gap-2 border-l border-slate-200 pl-3 ml-2">
           <select className="text-sm border-none bg-transparent focus:ring-0 text-slate-600 font-medium cursor-pointer hover:text-slate-900"
             value={filters.format} onChange={e => setFilters(prev => ({ ...prev, format: e.target.value }))}>
             <option value="all">全部格式</option>
             <option value="jpg">JPG</option>
             <option value="png">PNG</option>
           </select>
           <Button variant={showDetails ? 'primary' : 'secondary'} size="icon" onClick={() => setShowDetails(!showDetails)}><List className="w-4 h-4" /></Button>
         </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {isScanning && (
          <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
             <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mb-4" />
             <p>正在扫描并导入...</p>
          </div>
        )}
        
        <Sidebar groups={groups} selectedGroup={selectedGroup} onSelectGroup={setSelectedGroup} groupMode={groupMode} setGroupMode={setGroupMode} stats={{ total: files.length }} />

        <main className="flex-1 flex flex-col min-w-0 bg-slate-50 relative shadow-inner">
          <div className="h-10 border-b border-slate-200 bg-white flex items-center justify-between px-4 text-xs text-slate-500 shrink-0">
             <div className="flex items-center gap-2 overflow-hidden">
               <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded whitespace-nowrap shrink-0">{currentGroupDisplayName}</span>
               
               {groupMode === 'folder' && selectedGroup && selectedGroup !== currentGroupDisplayName && (
                 <span className="text-slate-400 text-[10px] truncate max-w-[300px] hidden md:inline-block" title={selectedGroup}>
                   ({selectedGroup})
                 </span>
               )}

               <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
               <span className="shrink-0">共 {filteredFiles.length} 项</span>
             </div>
             {selectedFiles.size > 0 && (
               <div className="flex items-center gap-3 animate-in slide-in-from-top-2 duration-200 ml-4">
                 <span className="text-blue-600 font-medium whitespace-nowrap">已选中 {selectedFiles.size} 项</span>
                 <button className="hover:text-blue-600 flex items-center gap-1 transition-colors mr-2 whitespace-nowrap" onClick={handleCopy} title="复制文件实体 (可粘贴到资源管理器)"><Copy className="w-3 h-3" /> 复制文件</button>
                 <button className="hover:text-red-600 flex items-center gap-1 transition-colors whitespace-nowrap" onClick={deleteSelected}><Trash2 className="w-3 h-3" /> 移除</button>
               </div>
             )}
          </div>

          <PhotoGrid files={filteredFiles} selectedFiles={selectedFiles} onSelect={handleSelection} onDoubleClick={setViewerFile} onContextMenu={handleContextMenu} />
        </main>

        {showDetails && <DetailsPanel file={activeFile} onClose={() => setShowDetails(false)} />}
      </div>

      <footer className="h-7 bg-slate-900 text-slate-400 text-[11px] flex items-center px-4 justify-between shrink-0 z-40">
        <div>总计: {files.length}</div>
        {files.length > 0 && <div>支持 Ctrl+C 复制文件 / Ctrl+V 粘贴</div>}
      </footer>

      <ImageViewer 
        file={viewerFile} 
        onClose={() => setViewerFile(null)} 
        onNext={handleNext}
        onPrev={handlePrev}
        hasNext={hasNext}
        hasPrev={hasPrev}
      />
      
      {contextMenu && (
        <div className="fixed z-50 w-48 bg-white rounded-md shadow-xl border border-slate-200 py-1 text-sm animate-in zoom-in-95 duration-75 select-none"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 260), left: Math.min(contextMenu.x, window.innerWidth - 192) }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={handleMenuMouseEnter}
          onMouseLeave={handleMenuMouseLeave}
        >
          {!isMultiSelect && (
            <button className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2" onClick={() => { setViewerFile(contextMenu.file); setContextMenu(null); }}>
              <Maximize2 className="w-3.5 h-3.5" /> 查看大图
            </button>
          )}
          
          {!isMultiSelect && (
            <button className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2" onClick={() => { setShowDetails(true); setContextMenu(null); }}>
              <Info className="w-3.5 h-3.5" /> 查看属性
            </button>
          )}

          <button className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2" onClick={handleOpenFolder}>
            <FolderOpen className="w-3.5 h-3.5" /> {isMultiSelect ? '打开所在文件夹' : '打开所在文件夹'}
          </button>
          
          <div className="h-px bg-slate-100 my-1" />
          <button className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2" onClick={handleCopy}>
            <Copy className="w-3.5 h-3.5" /> 复制文件
          </button>
          <div className="h-px bg-slate-100 my-1" />
          <button className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2" onClick={() => { deleteSelected(); setContextMenu(null); }}>
            <Trash2 className="w-3.5 h-3.5" /> 从列表中移除
          </button>
        </div>
      )}
    </div>
  );
}
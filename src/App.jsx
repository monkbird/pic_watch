import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Folder, Image as ImageIcon, Search, List, Info, Maximize2, Trash2, Grid, 
  RefreshCw, Download, ChevronRight, FolderOpen, Copy, RotateCw, XCircle
} from 'lucide-react';

import Sidebar from './components/Sidebar.jsx';
import PhotoGrid from './components/PhotoGrid.jsx';
import DetailsPanel from './components/DetailsPanel.jsx';
import ImageViewer from './components/ImageViewer.jsx';
import { Button } from './components/ui/Primitives.jsx';
import { extractMetadata, ALLOWED_EXTENSIONS } from './utils/metadata.js';
import { Classifier } from './utils/classifier.js';

export default function App() {
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [lastSelectedId, setLastSelectedId] = useState(null);
  
  const [groupMode, setGroupMode] = useState('folder');
  const [selectedGroup, setSelectedGroup] = useState(null);
  
  const [importedPaths, setImportedPaths] = useState(new Set());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ minWidth: 0 });
  
  const [showDetails, setShowDetails] = useState(true);
  const [viewerFile, setViewerFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  
  const fileInputRef = useRef(null);
  const contextMenuTimerRef = useRef(null);

  const processFiles = async (newFilesInput, updateMode = false) => {
    const BATCH_SIZE = 50; 
    const existingFileMap = new Map(files.map(f => [f.path, f]));
    let addedCount = 0;
    let processedFiles = [];

    const total = newFilesInput.length;
    
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const chunk = newFilesInput.slice(i, i + BATCH_SIZE);
      
      const chunkProcessed = await Promise.all(chunk.map(async (f) => {
        const path = f.path || (f.webkitRelativePath || f.name);
        
        if (updateMode && existingFileMap.has(path)) {
          return existingFileMap.get(path);
        }
        
        const metadata = await extractMetadata(f);
        return { ...metadata, fileObj: (f instanceof File ? f : null) };
      }));
      
      processedFiles.push(...chunkProcessed);
      
      if (!updateMode) {
        const newUnique = chunkProcessed.filter(f => !existingFileMap.has(f.path));
        if (newUnique.length > 0) {
          newUnique.forEach(f => existingFileMap.set(f.path, f));
          setFiles(prev => [...prev, ...newUnique]);
          addedCount += newUnique.length;
        }
      }
      
      await new Promise(r => setTimeout(r, 0));
    }

    if (updateMode) {
      setFiles(processedFiles);
      addedCount = processedFiles.length - existingFileMap.size;
    }

    return addedCount;
  };

  const handleElectronImport = async () => {
    setIsScanning(true);
    try {
      const result = await window.electron.selectDirectory();
      if (result && result.files.length > 0) {
        setImportedPaths(prev => new Set(prev).add(result.rootPath));
        const added = await processFiles(result.files);
        if (added === 0) alert("未导入新文件（所选文件已存在）。");
      }
    } catch (error) {
      console.error("Electron import failed:", error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleRefresh = async () => {
    if (importedPaths.size === 0) return;
    if (!window.electron?.scanDirectory) return;

    setIsScanning(true);
    try {
      let allFiles = [];
      for (const path of importedPaths) {
        const files = await window.electron.scanDirectory(path);
        allFiles.push(...files);
      }
      await processFiles(allFiles, true);
      console.log("Refresh complete.");
    } catch (error) {
      console.error("Refresh failed:", error);
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

  const updateFileMetadata = (fileId, updates) => {
    setFiles(prevFiles => prevFiles.map(f => {
      if (f.id === fileId) {
        const updatedFile = { ...f, ...updates};
        if (updates.iptc) updatedFile.iptc = { ...updatedFile.iptc, ...updates.iptc };
        if (updates.exif) updatedFile.exif = { ...updatedFile.exif, ...updates.exif };
        return updatedFile;
      }
      return f;
    }));
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
    
    if (filters.minWidth > 0) result = result.filter(f => f.dims && f.dims.w >= filters.minWidth);
    
    setFilteredFiles(result);
  }, [files, selectedGroup, searchQuery, filters, groups]);

  const activeFile = useMemo(() => {
    if (selectedFiles.size === 1) return files.find(f => f.id === Array.from(selectedFiles)[0]);
    return null;
  }, [selectedFiles, files]);

  // [修复] 简化多选逻辑，修复"点击3次"的bug
  const handleSelection = useCallback((file, multi, range) => {
    if (!file) { setSelectedFiles(new Set()); setLastSelectedId(null); return; }
    
    setSelectedFiles(prev => {
      // 关键修复：在多选模式下，基于 prev 创建新 Set；单选模式下，创建空 Set
      const newSet = new Set(multi ? prev : []); 
      
      if (range && lastSelectedId) {
        const idx1 = filteredFiles.findIndex(f => f.id === lastSelectedId);
        const idx2 = filteredFiles.findIndex(f => f.id === file.id);
        if (idx1 !== -1 && idx2 !== -1) {
          const start = Math.min(idx1, idx2); const end = Math.max(idx1, idx2);
          for (let i = start; i <= end; i++) newSet.add(filteredFiles[i].id);
        }
      } else {
        // 关键修复：正确的切换逻辑
        if (multi) {
          if (newSet.has(file.id)) {
            newSet.delete(file.id);
          } else {
            newSet.add(file.id);
          }
        } else {
          // 单选直接覆盖
          newSet.clear();
          newSet.add(file.id);
        }
      }
      return newSet;
    });
    
    if (!range) setLastSelectedId(file.id);
  }, [lastSelectedId, filteredFiles]);

  const handleContextMenu = (e, file) => {
    if (contextMenuTimerRef.current) {
      clearTimeout(contextMenuTimerRef.current);
      contextMenuTimerRef.current = null;
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

  // 复制：统一为复制路径（多选或单选，按键或右击）
  const handleCopy = useCallback(async () => {
    let targets = [];

    if (contextMenu) {
      if (selectedFiles.has(contextMenu.file.id)) {
        targets = filteredFiles.filter(f => selectedFiles.has(f.id));
      } else {
        targets = [contextMenu.file];
      }
    } else {
      if (selectedFiles.size > 0) {
        targets = filteredFiles.filter(f => selectedFiles.has(f.id));
      } else if (activeFile) {
        targets = [activeFile];
      }
    }

    if (targets.length === 0) return;

    const paths = targets.map(f => f.path);
    await navigator.clipboard.writeText(paths.join('\n'));
    alert(`已复制 ${paths.length} 个路径`);
    setContextMenu(null);
  }, [selectedFiles, filteredFiles, contextMenu, activeFile]);

  const exportGroups = () => {
    const exportData = { timestamp: new Date().toISOString(), mode: groupMode, groups: Object.entries(groups).map(([k, v]) => ({ groupName: k, count: v.length, files: v.map(f => f.name) })) };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `picwatch_groups_${groupMode}.json`; a.click();
  };

  const handleDeleteFiles = (filesToDeleteSet) => {
    if (!filesToDeleteSet || filesToDeleteSet.size === 0) return;
    
    if (confirm(`确定要移除这 ${filesToDeleteSet.size} 个项目吗？`)) {
      setFiles(prev => prev.filter(f => !filesToDeleteSet.has(f.id)));
      const newSelected = new Set(selectedFiles);
      filesToDeleteSet.forEach(id => newSelected.delete(id));
      setSelectedFiles(newSelected);
    }
  };

  const deleteSelected = () => {
    handleDeleteFiles(selectedFiles);
  };

  const onContextMenuDelete = () => {
    let targets = new Set();
    if (selectedFiles.size > 0 && selectedFiles.has(contextMenu.file.id)) {
        targets = selectedFiles;
    } else {
        targets.add(contextMenu.file.id);
    }
    handleDeleteFiles(targets);
    setContextMenu(null);
  };

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

  // [新增] 全局键盘监听 (Ctrl+C / Delete)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+C 或 Command+C
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        // 检查是否正在编辑文本 (避免在详情页输入备注时触发复制)
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        
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
    if (confirm("确定要清空列表吗？\n(注意：这只会清空软件中的显示记录，不会删除您电脑上的文件)")) {
      setFiles([]);
      setImportedPaths(new Set());
      setSelectedFiles(new Set());
      setSelectedGroup(null);
    }
  };

  const isMultiSelect = selectedFiles.size > 1;
  const viewerIndex = viewerFile ? filteredFiles.findIndex(f => f.id === viewerFile.id) : -1;
  const hasPrev = viewerIndex > 0;
  const hasNext = viewerIndex !== -1 && viewerIndex < filteredFiles.length - 1;

  const isPanelOpen = showDetails && activeFile;
  const isContextMultiSelect = contextMenu && selectedFiles.size > 1 && selectedFiles.has(contextMenu.file.id);

  return (
    <div className="flex flex-col h-screen w-full bg-white text-slate-900 font-sans overflow-hidden select-none">
      <input type="file" ref={fileInputRef} onChange={handleWebImport} className="hidden" webkitdirectory="" directory="" multiple />

      <header className="h-14 border-b border-slate-200 bg-white flex items-center px-4 gap-3 shrink-0 z-30 shadow-sm justify-between">
         <div className="flex items-center gap-2 w-48 shrink-0">
           <div className="bg-gradient-to-br from-blue-600 to-blue-500 text-white p-1.5 rounded-lg shadow-sm"><ImageIcon className="w-5 h-5" /></div>
           <h1 className="font-bold text-lg tracking-tight text-slate-800">PicWatch</h1>
         </div>
         
         <div className="flex-1 flex justify-center max-w-lg">
            <div className="relative group w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input className="pl-9 pr-3 py-1.5 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 border rounded-md text-sm w-full transition-all focus:ring-2 focus:ring-blue-500/20" 
                  placeholder="搜索文件名、备注..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
         </div>

         <div className="flex items-center gap-1 w-auto justify-end shrink-0 ml-4">
           <Button variant="secondary" onClick={onImportClick} className="mr-1 h-8" title="导入文件夹">
             <Folder className="w-4 h-4 mr-2 text-blue-600" /> 导入
           </Button>
           
           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={exportGroups} disabled={files.length === 0} title="导出分组 JSON">
             <Download className="w-4 h-4" />
           </Button>
           
           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} disabled={importedPaths.size === 0 || isScanning} title="重新扫描已导入的文件夹">
             <RotateCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
           </Button>
           
           {files.length > 0 && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClearAll} title="清空列表 (不删除文件)">
                <XCircle className="w-4 h-4 text-slate-400 hover:text-red-500" />
              </Button>
           )}

           <div className="h-5 w-px bg-slate-200 mx-1" />
           
           <Button variant={showDetails ? 'primary' : 'secondary'} size="icon" className="h-8 w-8" onClick={() => setShowDetails(!showDetails)} title="显示/隐藏属性">
             <List className="w-4 h-4" />
           </Button>
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

        <main className="flex-1 flex flex-col min-w-0 bg-slate-50 shadow-inner transition-all duration-200">
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
                 <button className="hover:text-blue-600 flex items-center gap-1 transition-colors mr-2 whitespace-nowrap" onClick={handleCopy} title="复制所选路径到剪贴板"><Copy className="w-3 h-3" /> 复制路径</button>
                 <button className="hover:text-red-600 flex items-center gap-1 transition-colors whitespace-nowrap" onClick={deleteSelected}><Trash2 className="w-3 h-3" /> 移除</button>
               </div>
             )}
          </div>

          <PhotoGrid files={filteredFiles} selectedFiles={selectedFiles} onSelect={handleSelection} onDoubleClick={setViewerFile} onContextMenu={handleContextMenu} />
        </main>

        <div 
          className={`
            h-full bg-white shrink-0 transition-[width] duration-300 ease-in-out overflow-hidden
            ${isPanelOpen ? 'w-80 border-l border-slate-200' : 'w-0 border-l-0'}
          `}
        >
           <div className="w-80 h-full">
              {activeFile && <DetailsPanel file={activeFile} onClose={() => setShowDetails(false)} onUpdate={(updates) => updateFileMetadata(activeFile.id, updates)} />}
           </div>
        </div>
      </div>

      <footer className="h-7 bg-slate-900 text-slate-400 text-[11px] flex items-center px-4 justify-between shrink-0 z-40">
        <div>总计: {files.length}</div>
        {files.length > 0 && <div>支持 Ctrl+C 复制路径</div>}
      </footer>

      <ImageViewer 
        file={viewerFile}
        allFiles={filteredFiles}
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
          {!isContextMultiSelect && (
            <button className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2" onClick={() => { 
              handleSelection(contextMenu.file, false, false);
              setViewerFile(contextMenu.file); 
              setContextMenu(null); 
            }}>
              <Maximize2 className="w-3.5 h-3.5" /> 查看大图
            </button>
          )}
          
          {!isContextMultiSelect && (
            <button className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2" onClick={() => { 
              handleSelection(contextMenu.file, false, false);
              setShowDetails(true); 
              setContextMenu(null); 
            }}>
              <Info className="w-3.5 h-3.5" /> 查看属性
            </button>
          )}

          <button className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2" onClick={handleOpenFolder}>
            <FolderOpen className="w-3.5 h-3.5" /> 打开所在文件夹
          </button>
          
          <div className="h-px bg-slate-100 my-1" />
          <button className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2" onClick={handleCopy}>
            <Copy className="w-3.5 h-3.5" /> 复制路径
          </button>
          <div className="h-px bg-slate-100 my-1" />
          <button className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2" onClick={onContextMenuDelete}>
            <Trash2 className="w-3.5 h-3.5" /> 从列表中移除
          </button>
        </div>
      )}
    </div>
  );
}
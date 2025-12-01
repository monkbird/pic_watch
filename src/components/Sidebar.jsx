import React, { useMemo } from 'react';
import { Folder, Clock, Calendar, Tag, FileImage, Grid, Hash } from 'lucide-react';

const TreeItem = ({ label, count, level = 0, active, onClick, icon: Icon, tooltip }) => {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-md transition-colors mb-0.5 ${active ? 'bg-blue-100 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-100'}`} 
      style={{ paddingLeft: `${level * 12 + 8}px` }}
      title={tooltip || label} 
    >
      <div className="flex items-center gap-2 truncate min-w-0">
        {Icon && <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />}
        <span className="truncate">{label || '未命名'}</span>
      </div>
      {count !== undefined && <span className={`text-xs px-1.5 rounded-full ml-2 shrink-0 ${active ? 'bg-white/60' : 'bg-slate-100 text-slate-400'}`}>{count}</span>}
    </button>
  );
};

const Sidebar = ({ groups, selectedGroup, onSelectGroup, groupMode, setGroupMode, stats }) => {
  // 确保 groups 是对象
  const safeGroups = groups || {};
  const sortedKeys = useMemo(() => Object.keys(safeGroups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [safeGroups]);
  
  // 预计算显示名称，解决同名文件夹无法区分的问题
  const displayConfig = useMemo(() => {
    const nameMap = {}; // key -> displayName
    const countMap = {}; // displayName -> count

    // 1. 生成所有短名并统计频次
    sortedKeys.forEach(key => {
      if (!key) return;
      let name = key;
      if (groupMode === 'folder') {
        // 尝试提取文件夹名，兼容 Windows/Unix 路径分隔符，增加空值保护
        const parts = String(key).split(/[/\\]/);
        name = parts[parts.length - 1] || key;
      }
      nameMap[key] = name;
      countMap[name] = (countMap[name] || 0) + 1;
    });

    return { nameMap, countMap };
  }, [sortedKeys, groupMode]);

  // 定义分组模式与图标的映射
  const modes = [
    { id: 'folder', icon: Folder, label: '按文件夹' },
    { id: 'time', icon: Clock, label: '按日期' },
    { id: 'year', icon: Calendar, label: '按年份' },
    { id: 'remark', icon: Tag, label: '按备注' },
    { id: 'tags', icon: Hash, label: '按标记' },
    { id: 'type', icon: FileImage, label: '按类型' },
  ];

  return (
    <div className="w-64 flex flex-col border-r border-slate-200 bg-slate-50/50 h-full shrink-0">
      <div className="p-3 border-b border-slate-200 bg-white">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">分组模式</div>
        {/* 改为横向图标按钮组 */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          {modes.map(mode => {
            const Icon = mode.icon;
            const isActive = groupMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setGroupMode(mode.id)}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ${
                  isActive 
                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' 
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'
                }`}
                title={mode.label}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        <TreeItem label="全部图片" count={stats?.total || 0} active={!selectedGroup} onClick={() => onSelectGroup(null)} icon={Grid} />
        <div className="h-px bg-slate-200 my-2 mx-1" />
        {sortedKeys.length === 0 ? <div className="text-xs text-center text-slate-400 py-4">无数据</div> : sortedKeys.map(key => {
            const shortName = displayConfig.nameMap[key] || key;
            // 如果有重名文件夹，侧边栏直接显示完整路径以区分；否则显示短名
            const isDuplicate = displayConfig.countMap[shortName] > 1;
            const displayName = (groupMode === 'folder' && isDuplicate) ? key : shortName;
            
            let Icon = Folder;
            if (groupMode === 'time') Icon = Clock;
            if (groupMode === 'year') Icon = Calendar;
            if (groupMode === 'remark') Icon = Tag;
            if (groupMode === 'tags') Icon = Hash;
            if (groupMode === 'type') Icon = FileImage;

            return (
              <TreeItem 
                key={key} 
                label={displayName} 
                tooltip={key} // 悬停总是显示完整 Key (路径)
                count={safeGroups[key]?.length || 0} 
                active={selectedGroup === key} 
                onClick={() => onSelectGroup(key)} 
                level={0} 
                icon={Icon} 
              />
            );
        })}
      </div>
    </div>
  );
};
export default Sidebar;
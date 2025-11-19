import React, { useMemo } from 'react';
import { Folder, Clock, Calendar, Tag, FileImage, Grid, ChevronDown, Hash } from 'lucide-react';

const TreeItem = ({ label, count, level = 0, active, onClick, icon: Icon }) => {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-md transition-colors mb-0.5 ${active ? 'bg-blue-100 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-100'}`} style={{ paddingLeft: `${level * 12 + 8}px` }}>
      <div className="flex items-center gap-2 truncate">
        {Icon && <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />}
        <span className="truncate" title={label}>{label}</span>
      </div>
      {count !== undefined && <span className={`text-xs px-1.5 rounded-full ml-2 ${active ? 'bg-white/60' : 'bg-slate-100 text-slate-400'}`}>{count}</span>}
    </button>
  );
};

const Sidebar = ({ groups, selectedGroup, onSelectGroup, groupMode, setGroupMode, stats }) => {
  const sortedKeys = useMemo(() => Object.keys(groups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [groups]);
  return (
    <div className="w-64 flex flex-col border-r border-slate-200 bg-slate-50/50 h-full shrink-0">
      <div className="p-3 border-b border-slate-200 bg-white">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">分组模式</div>
        <div className="relative">
          <select value={groupMode} onChange={e => setGroupMode(e.target.value)} className="w-full appearance-none bg-white border border-slate-200 text-slate-700 text-sm rounded-md h-9 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
            <option value="folder">按文件夹</option>
            <option value="time">按日期</option>
            <option value="year">按年份</option>
            <option value="remark">按备注 (分段)</option>
            <option value="tags">按标记 (Keywords)</option>
            <option value="type">按类型</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        <TreeItem label="全部图片" count={stats.total} active={!selectedGroup} onClick={() => onSelectGroup(null)} icon={Grid} />
        <div className="h-px bg-slate-200 my-2 mx-1" />
        {sortedKeys.length === 0 ? <div className="text-xs text-center text-slate-400 py-4">无数据</div> : sortedKeys.map(key => {
            const displayName = groupMode === 'folder' ? key.split('/').pop() : key;
            let Icon = Folder;
            if (groupMode === 'time') Icon = Clock;
            if (groupMode === 'year') Icon = Calendar;
            if (groupMode === 'remark') Icon = Tag;
            if (groupMode === 'tags') Icon = Hash;
            if (groupMode === 'type') Icon = FileImage;
            return <TreeItem key={key} label={displayName || "根目录"} count={groups[key].length} active={selectedGroup === key} onClick={() => onSelectGroup(key)} level={0} icon={Icon} />;
        })}
      </div>
    </div>
  );
};
export default Sidebar;
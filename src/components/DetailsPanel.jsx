import React, { useState, useEffect } from 'react';
import { Info, X, Copy, Sparkles, Loader2, Pencil, Check, Settings } from 'lucide-react';
import { Button } from './ui/Primitives';
import { humanSize, formatDateTime } from '../utils/metadata';
import { aiInstance } from '../utils/aiService';

const InfoRow = ({ label, value, copyable }) => (
  <div className="group flex flex-col py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">{label}</span>
    <div className="flex items-center justify-between min-h-[20px]">
      <span className="text-xs text-slate-700 break-all leading-relaxed select-text whitespace-pre-wrap">
        {value || <span className="text-slate-300">-</span>}
      </span>
      {copyable && value && (
        <button 
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-transparent rounded text-slate-400 transition-opacity shrink-0"
          onClick={() => navigator.clipboard.writeText(value)}
          title="复制"
        >
          <Copy className="w-3 h-3" />
        </button>
      )}
    </div>
  </div>
);

const DetailsPanel = ({ file, onClose, onUpdate, aiConfig, onOpenSettings, embedded = false }) => {
  if (!file) return null;
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState("");
  const aiLabels = file.aiData?.labels || [];

  useEffect(() => {
    setIsAnalyzing(false);
    setAiStatusMsg("");
  }, [file.id]);

  const handleAiAnalyze = () => {
    if (!aiConfig) {
      if (confirm("AI 功能尚未配置，是否现在去配置？")) {
        onOpenSettings && onOpenSettings();
      }
      return;
    }
    setIsAnalyzing(true);
    setAiStatusMsg("准备中...");
    aiInstance.analyzeImage(file.id, file.thumbnail, aiConfig, ({ status, result, message }) => {
      if (status === 'loading' || status === 'processing') {
        setAiStatusMsg(message);
      } else if (status === 'complete') {
        setIsAnalyzing(false);
        setAiStatusMsg("");
        if (onUpdate) {
          onUpdate({ 
            aiData: { 
              labels: result,
              processedAt: new Date().toISOString()
            } 
          });
        }
      } else if (status === 'error') {
        setIsAnalyzing(false);
        setAiStatusMsg("识别失败");
        console.error(message);
      }
    });
  };

  const tags = file.iptc?.Keywords?.join('; ');
  const remark = file.exif?.ImageDescription; 
  const [editingTags, setEditingTags] = useState(false);
  const [editingRemark, setEditingRemark] = useState(false);
  const [editTagsValue, setEditTagsValue] = useState(tags || '');
  const [editRemarkValue, setEditRemarkValue] = useState(remark || '');

  useEffect(() => {
    setEditingTags(false);
    setEditingRemark(false);
    setEditTagsValue((file.iptc?.Keywords || []).join('; '));
    setEditRemarkValue(file.exif?.ImageDescription || '');
  }, [file.id]);
  
  const camera = [file.exif?.Make, file.exif?.Model].filter(Boolean).join(' ');

  return (
    <div className={`h-full flex flex-col bg-white ${embedded ? '' : 'border-l border-slate-200'}`}>
      {!embedded && (
        <div className="h-12 border-b border-slate-200 flex items-center justify-between px-4 bg-slate-50/50 shrink-0">
          <span className="font-semibold text-sm text-slate-700 flex items-center gap-2"><Info className="w-4 h-4" /> 属性详情</span>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        
        {!embedded && (
          <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-2 flex items-center justify-center min-h-[160px]">
             {file.thumbnail ? <img src={file.thumbnail} alt="preview" className="max-w-full max-h-48 object-contain shadow-sm rounded" /> : <span className="text-slate-400 text-xs">无预览</span>}
          </div>
        )}

        <div className="mb-6 border border-blue-100 bg-blue-50/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> AI 场景识别
            </h4>
            {!aiConfig && !isAnalyzing && (
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-blue-400" onClick={onOpenSettings} title="配置 AI">
                <Settings className="w-3.5 h-3.5" />
              </Button>
            )}
            {aiConfig && !aiLabels.length && !isAnalyzing && (
              <Button size="sm" variant="ghost" className="h-6 text-[10px] bg-white border border-blue-200 hover:bg-blue-50 text-blue-600" onClick={handleAiAnalyze}>
                开始识别
              </Button>
            )}
          </div>

          {isAnalyzing ? (
            <div className="flex items-center justify-center py-2 text-xs text-blue-600 gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{aiStatusMsg}</span>
            </div>
          ) : aiLabels.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {aiLabels.map((label, idx) => (
                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-blue-200 text-blue-700 shadow-sm">
                  {label}
                </span>
              ))}
              <button 
                onClick={handleAiAnalyze} 
                className="text-[10px] text-blue-400 hover:text-blue-600 underline ml-auto mt-1"
                title="重新识别"
              >
                重试
              </button>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 text-center py-1">
              {aiConfig ? "暂无识别信息" : "请先配置 AI 模型"}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">基本信息</h4>
            <InfoRow label="文件名" value={file.name} copyable />
            {/* Point 10: 显示真实路径 */}
            <InfoRow label="完整路径" value={file.path} copyable />
            <InfoRow label="分组目录" value={file.parent} copyable />
            <InfoRow label="大小" value={humanSize(file.size)} />
            <InfoRow label="尺寸" value={file.dims ? `${file.dims.w} x ${file.dims.h}` : '-'} />
            <InfoRow label="创建时间" value={formatDateTime(file.birthtime)} />
            <InfoRow label="修改时间" value={formatDateTime(file.lastModified)} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">内容与描述</h4>
            <div className="group flex flex-col py-1.5 border-b border-slate-100">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">标记 (Tags)</span>
              <div className="flex items-center justify-between min-h-[20px]">
                {editingTags ? (
                  <>
                    <input className="flex-1 text-xs text-slate-700 bg-white border border-slate-200 rounded px-2 py-1" value={editTagsValue} onChange={e => setEditTagsValue(e.target.value)} />
                    <div className="flex items-center gap-1 ml-2">
                      <button className="p-1 hover:bg-transparent rounded text-slate-600" title="保存" onClick={() => {
                        const arr = editTagsValue.split(/[;，,\s|]+/).map(s => s.trim()).filter(Boolean);
                        // Point 2: Trigger onUpdate (which calls handleSaveMetadata in App)
                        onUpdate && onUpdate({ iptc: { Keywords: arr }, exif: { XPKeywords: arr.join('; ') } });
                        setEditingTags(false);
                      }}>
                        <Check className="w-3 h-3" />
                      </button>
                      <button className="p-1 hover:bg-transparent rounded text-slate-400" title="取消" onClick={() => { setEditingTags(false); setEditTagsValue(tags || ''); }}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-slate-700 break-all leading-relaxed select-text whitespace-pre-wrap">{tags || <span className="text-slate-300">-</span>}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {tags && (
                        <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-transparent rounded text-slate-400 transition-opacity" onClick={() => navigator.clipboard.writeText(tags)} title="复制">
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                      <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-transparent rounded text-slate-400 transition-opacity" onClick={() => { setEditingTags(true); setEditTagsValue(tags || ''); }} title="编辑">
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="group flex flex-col py-1.5 border-b border-slate-100 last:border-0">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">备注 (Remarks)</span>
              <div className="flex items-center justify-between min-h-[20px]">
                {editingRemark ? (
                  <>
                    <textarea className="flex-1 text-xs text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 min-h-[60px]" value={editRemarkValue} onChange={e => setEditRemarkValue(e.target.value)} />
                    <div className="flex items-center gap-1 ml-2">
                      <button className="p-1 hover:bg-transparent rounded text-slate-600" title="保存" onClick={() => {
                        // Point 2: Trigger onUpdate
                        onUpdate && onUpdate({ exif: { ImageDescription: editRemarkValue }, iptc: { Caption: editRemarkValue } });
                        setEditingRemark(false);
                      }}>
                        <Check className="w-3 h-3" />
                      </button>
                      <button className="p-1 hover:bg-transparent rounded text-slate-400" title="取消" onClick={() => { setEditingRemark(false); setEditRemarkValue(remark || ''); }}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-slate-700 break-all leading-relaxed select-text whitespace-pre-wrap">{remark || <span className="text-slate-300">-</span>}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {remark && (
                        <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-transparent rounded text-slate-400 transition-opacity" onClick={() => navigator.clipboard.writeText(remark)} title="复制">
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                      <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-transparent rounded text-slate-400 transition-opacity" onClick={() => { setEditingRemark(true); setEditRemarkValue(remark || ''); }} title="编辑">
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">拍摄参数</h4>
            <InfoRow label="拍摄时间" value={formatDateTime(file.dateOriginal)} />
            <InfoRow label="相机" value={camera} />
            <InfoRow label="光圈" value={file.exif?.FNumber ? `f/${file.exif.FNumber}` : ''} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailsPanel;
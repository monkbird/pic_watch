import React, { useState, useEffect } from 'react';
import { Info, X, Copy, Sparkles, Loader2 } from 'lucide-react'; // 引入新图标
import { Button } from './ui/Primitives';
import { humanSize, formatDate } from '../utils/metadata';
import { aiInstance } from '../utils/aiService'; // 引入 AI 服务

const InfoRow = ({ label, value, copyable }) => (
  <div className="group flex flex-col py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">{label}</span>
    <div className="flex items-center justify-between min-h-[20px]">
      <span className="text-xs text-slate-700 break-all leading-relaxed select-text whitespace-pre-wrap">
        {value || <span className="text-slate-300">-</span>}
      </span>
      {copyable && value && (
        <button 
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-400 transition-opacity shrink-0"
          onClick={() => navigator.clipboard.writeText(value)}
          title="复制"
        >
          <Copy className="w-3 h-3" />
        </button>
      )}
    </div>
  </div>
);

const DetailsPanel = ({ file, onClose, onUpdate }) => { // 增加 onUpdate 参数
  if (!file) return null;
  
  // --- AI 相关状态与逻辑 (新增) ---
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState("");
  
  // 获取已保存的 AI 标签
  const aiLabels = file.aiData?.labels || [];

  // 当切换文件时，重置 AI 状态
  useEffect(() => {
    setIsAnalyzing(false);
    setAiStatusMsg("");
  }, [file.id]);

  const handleAiAnalyze = () => {
    setIsAnalyzing(true);
    setAiStatusMsg("准备中...");

    // 调用 AI 服务
    aiInstance.analyzeImage(file.id, file.thumbnail, ({ status, result, message }) => {
      if (status === 'loading' || status === 'processing') {
        setAiStatusMsg(message);
      } else if (status === 'complete') {
        setIsAnalyzing(false);
        setAiStatusMsg("");
        
        // 调用父组件回调更新文件数据
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
  // ---------------------------

  const tags = file.iptc?.Keywords?.join('; ');
  const remark = file.exif?.ImageDescription; 
  const camera = [file.exif?.Make, file.exif?.Model].filter(Boolean).join(' ');

  return (
    // 宽度和边框由 App.jsx 控制，此处只保留内部结构
    <div className="h-full flex flex-col bg-white">
      <div className="h-12 border-b border-slate-200 flex items-center justify-between px-4 bg-slate-50/50 shrink-0">
        <span className="font-semibold text-sm text-slate-700 flex items-center gap-2"><Info className="w-4 h-4" /> 属性详情</span>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        
        {/* 缩略图区域 */}
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-2 flex items-center justify-center min-h-[160px]">
           {file.thumbnail ? <img src={file.thumbnail} alt="preview" className="max-w-full max-h-48 object-contain shadow-sm rounded" /> : <span className="text-slate-400 text-xs">无预览</span>}
        </div>

        {/* --- 新增：AI 智能识别区域 (插入位置) --- */}
        <div className="mb-6 border border-blue-100 bg-blue-50/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> AI 场景识别
            </h4>
            {/* 如果没有标签且没在分析，显示按钮 */}
            {!aiLabels.length && !isAnalyzing && (
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
              暂无识别信息
            </div>
          )}
        </div>
        {/* ------------------------------------- */}

        <div className="space-y-6">
          <div>
            <h4 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">基本信息</h4>
            <InfoRow label="文件名" value={file.name} copyable />
            <InfoRow label="目录" value={file.parent} copyable />
            <InfoRow label="大小" value={humanSize(file.size)} />
            <InfoRow label="尺寸" value={file.dims ? `${file.dims.w} x ${file.dims.h}` : '-'} />
            <InfoRow label="修改时间" value={new Date(file.lastModified).toLocaleString()} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">内容与描述</h4>
            <InfoRow label="标记 (Tags)" value={tags} copyable />
            <InfoRow label="备注 (Remarks)" value={remark} copyable />
          </div>
          {(camera || file.exif?.FNumber) && (
            <div>
              <h4 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">拍摄参数</h4>
              <InfoRow label="相机" value={camera} />
              <InfoRow label="光圈" value={file.exif?.FNumber ? `f/${file.exif.FNumber}` : ''} />
              <InfoRow label="拍摄时间" value={formatDate(file.dateOriginal)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailsPanel;
import React, { useState, useEffect } from 'react';
import { X, Save, Settings, RotateCcw } from 'lucide-react';
import { Button } from './ui/Primitives';

// 预设配置模板
const PRESETS = {
  volcengine: {
    name: '火山引擎 (Doubao)',
    apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    modelPlaceholder: '请输入 Endpoint ID (如: ep-2024...)',
    defaultModel: '' // 火山必须手动填接入点 ID
  },
  zhipu: {
    name: '智谱AI (GLM-4V)',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    modelPlaceholder: 'glm-4v',
    defaultModel: 'glm-4v' // 智谱的视觉模型
  },
  aliyun: {
    name: '阿里通义 (Qwen-VL)',
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    modelPlaceholder: 'qwen-vl-max',
    defaultModel: 'qwen-vl-max' // 通义千问视觉模型
  },
  openai: {
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    modelPlaceholder: 'gpt-4o',
    defaultModel: 'gpt-4o' // 视觉模型
  },
  kimi: {
    name: 'Kimi (Moonshot)',
    apiUrl: 'https://api.moonshot.cn/v1/chat/completions',
    modelPlaceholder: 'moonshot-v1-8k',
    defaultModel: 'moonshot-v1-8k' // 目前官方API主要是文本
  },
  deepseek: {
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/chat/completions',
    modelPlaceholder: 'deepseek-chat',
    defaultModel: 'deepseek-chat' // 目前官方API主要是文本
  },
  custom: {
    name: '自定义 (OpenAI兼容)',
    apiUrl: '',
    modelPlaceholder: '模型名称',
    defaultModel: ''
  }
};

export default function AISettingsModal({ isOpen, onClose, onSave, initialConfig }) {
  const [provider, setProvider] = useState('volcengine');
  const [config, setConfig] = useState({
    apiKey: '',
    apiUrl: PRESETS.volcengine.apiUrl,
    model: ''
  });

  // 初始化加载
  useEffect(() => {
    if (isOpen) {
      if (initialConfig && initialConfig.apiKey) {
        setConfig(initialConfig);
        // 尝试根据 URL 反推是哪个服务商，以便高亮显示
        const foundProvider = Object.keys(PRESETS).find(k => PRESETS[k].apiUrl === initialConfig.apiUrl);
        if (foundProvider) setProvider(foundProvider);
        else setProvider('custom');
      }
    }
  }, [isOpen, initialConfig]);

  const handleProviderChange = (key) => {
    setProvider(key);
    setConfig(prev => ({
      ...prev,
      apiUrl: PRESETS[key].apiUrl, // 自动切换 URL
      // 自动填入默认模型名（除火山和自定义外）
      model: PRESETS[key].defaultModel || '' 
    }));
  };

  const handleSave = () => {
    if (!config.apiKey || !config.apiUrl || !config.model) {
      alert("请填写完整配置信息");
      return;
    }
    onSave(config);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-200">
        
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-600" /> AI 模型配置
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-5 space-y-4">
          
          {/* 模型厂商选择 */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">模型服务商 (优先推荐视觉模型)</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PRESETS).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => handleProviderChange(key)}
                  className={`text-xs py-2 px-1 rounded border transition-all truncate ${
                    provider === key 
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title={info.name}
                >
                  {info.name}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">API Key (sk-...)</label>
            <input 
              type="password"
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              placeholder="请输入您的 API Key"
              value={config.apiKey}
              onChange={e => setConfig({...config, apiKey: e.target.value})}
            />
          </div>

          {/* Model / Endpoint */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              {provider === 'volcengine' ? 'Endpoint ID (接入点)' : 'Model Name (模型名称)'}
            </label>
            <input 
              type="text"
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              placeholder={PRESETS[provider]?.modelPlaceholder}
              value={config.model}
              onChange={e => setConfig({...config, model: e.target.value})}
            />
            {provider === 'volcengine' && (
              <p className="text-[10px] text-slate-400 mt-1">火山引擎请填写推理接入点 ID (如 ep-2024...)</p>
            )}
          </div>

          {/* API URL */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">API Base URL</label>
            <input 
              type="text"
              className="w-full text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 focus:bg-white focus:border-blue-500 outline-none font-mono"
              value={config.apiUrl}
              onChange={e => setConfig({...config, apiUrl: e.target.value})}
            />
          </div>

        </div>

        {/* 底部按钮 */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <button 
            onClick={() => { localStorage.removeItem('picwatch_ai_config'); onClose(); window.location.reload(); }}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            title="清除配置并禁用 AI"
          >
            <RotateCcw className="w-3 h-3" /> 清除配置
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>取消</Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-1" /> 保存配置
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
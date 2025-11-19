import { formatDate } from './metadata';

export const Classifier = {
  groupByFolder: (files) => {
    const groups = {};
    files.forEach(f => {
      const key = f.parent && f.parent !== '.' ? f.parent : '根目录';
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return groups;
  },
  
  groupByTime: (files) => {
    const groups = {};
    files.forEach(f => {
      const key = formatDate(f.dateOriginal);
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return groups;
  },

  groupByYear: (files) => {
    const groups = {};
    files.forEach(f => {
      const d = new Date(f.dateOriginal);
      const key = isNaN(d.getFullYear()) ? '未知年份' : d.getFullYear().toString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return groups;
  },

  // 按备注分段 (正则清洗 + 停用词)
  groupByRemark: (files) => {
    const groups = {};
    const stopWords = new Set(["default", "suva", "unknown", "none", "nil", "无备注"]);

    files.forEach(f => {
      const desc = f.exif?.ImageDescription; // metadata.js 已归一化
      
      if (!desc || !desc.trim()) return;
      
      // 分隔符：空格、下划线、中文逗号、英文逗号、分号、竖线
      const parts = desc.split(/[\s_，,;|]+/).filter(Boolean);
      
      parts.forEach(p => {
        // 清洗：只保留中英文数字
        const q = p.replace(/[^A-Za-z0-9\u4e00-\u9fff]/g, "");
        if (q && q.length >= 2 && !stopWords.has(q.toLowerCase())) {
           if (!groups[q]) groups[q] = [];
           groups[q].push(f);
        }
      });
    });
    return groups;
  },

  // 按标签分组
  groupByTags: (files) => {
    const groups = {};
    files.forEach(f => {
      const keywords = f.iptc?.Keywords || [];
      
      keywords.forEach(tag => {
        if (tag && String(tag).trim()) {
          const t = String(tag).trim();
          if (!groups[t]) groups[t] = [];
          groups[t].push(f);
        }
      });
    });
    return groups;
  },
  
  groupByType: (files) => {
    const groups = {};
    files.forEach(f => {
      const key = f.extension.toUpperCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return groups;
  }
};

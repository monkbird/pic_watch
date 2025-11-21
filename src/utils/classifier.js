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

  // [修改] 按标签分组：保留复合标签，同时也拆分归类到单个标签，确保数量统计正确
  groupByTags: (files) => {
    const groups = {};
    files.forEach(f => {
      const rawKeywords = f.iptc?.Keywords || [];
      const keywords = new Set(); // 使用 Set 去重

      const processTag = (tag) => {
        if (!tag) return;
        const str = String(tag).trim();
        if (!str) return;

        // 1. 保留原始标签 (例如 "道路清理, 洒水降尘")
        // 这样侧边栏会显示 "道路清理, 洒水降尘" 这个分组，且只包含拥有该完整标签的文件
        keywords.add(str);

        // 2. 按分隔符拆分并归类到子标签 (例如 "道路清理" 和 "洒水降尘")
        // 这样 "道路清理" 分组的计数会包含这些文件 (6张单纯的 + 3张复合的 = 9张)
        const parts = str.split(/[,，;；|]+/).map(s => s.trim()).filter(Boolean);
        if (parts.length > 1) {
          parts.forEach(p => keywords.add(p));
        }
      };

      if (Array.isArray(rawKeywords)) {
        rawKeywords.forEach(processTag);
      } else {
        processTag(rawKeywords);
      }
      
      // 将文件添加到所有计算出的分组中
      keywords.forEach(t => {
        if (!groups[t]) groups[t] = [];
        groups[t].push(f);
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
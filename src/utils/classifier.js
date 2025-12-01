// src/utils/classifier.js
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
  
  // [修改] 使用 bestDate 进行日期分组
  groupByTime: (files) => {
    const groups = {};
    files.forEach(f => {
      // 使用 bestDate (最早时间)
      const key = formatDate(f.bestDate || f.dateOriginal || f.lastModified);
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return groups;
  },

  // [修改] 使用 bestDate 进行年份分组
  groupByYear: (files) => {
    const groups = {};
    files.forEach(f => {
      // 使用 bestDate (最早时间)
      const d = new Date(f.bestDate || f.dateOriginal || f.lastModified);
      const key = isNaN(d.getFullYear()) ? '未知年份' : d.getFullYear().toString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return groups;
  },

  // ... (其他分组方法 groupByRemark, groupByTags, groupByType 保持不变)
  groupByRemark: (files) => {
    const groups = {};
    const stopWords = new Set(["default", "suva", "unknown", "none", "nil", "无备注"]);

    files.forEach(f => {
      const desc = f.exif?.ImageDescription;
      if (!desc || !desc.trim()) return;
      const parts = desc.split(/[\s_，,;|]+/).filter(Boolean);
      parts.forEach(p => {
        const q = p.replace(/[^A-Za-z0-9\u4e00-\u9fff]/g, "");
        if (q && q.length >= 2 && !stopWords.has(q.toLowerCase())) {
           if (!groups[q]) groups[q] = [];
           groups[q].push(f);
        }
      });
    });
    return groups;
  },

  groupByTags: (files) => {
    const groups = {};
    files.forEach(f => {
      const rawKeywords = f.iptc?.Keywords || [];
      const keywords = new Set();
      const processTag = (tag) => {
        if (!tag) return;
        const str = String(tag).trim();
        if (!str) return;
        keywords.add(str);
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
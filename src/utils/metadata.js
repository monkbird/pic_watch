// src/utils/metadata.js
import exifr from 'exifr';

export const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic']);

export const humanSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 格式化日期：YYYY-MM-DD
export const formatDate = (timestamp) => {
  if (!timestamp) return '未知日期';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '未知日期';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 格式化完整时间：YYYY-MM-DD HH:mm:ss
export const formatDateTime = (timestamp) => {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-CN', { hour12: false });
};

// [新增] 从文件名提取日期 (支持 20230101, 2023-01-01, 2023_01_01 等格式)
const parseDateFromFilename = (filename) => {
  try {
    // 匹配 20xx 开头的 8 位数字，或者带分隔符的日期
    const match = filename.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime()) && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        return d;
      }
    }
  } catch (e) {
    return null;
  }
  return null;
};

// 解码辅助函数
const decodeWindowsXPString = (data) => {
  if (!data) return "";
  if (typeof data === 'string') return data.replace(/\0/g, '').trim();
  if (data instanceof Uint8Array || Array.isArray(data)) {
    try {
      const decoder = new TextDecoder('utf-16le');
      const str = decoder.decode(new Uint8Array(data));
      return str.replace(/\0/g, '').trim();
    } catch (e) { return ""; }
  }
  return "";
};

const decodeCSstring = (str) => {
  if (!str) return "";
  if (typeof str !== 'string') return String(str);
  try {
    const bytes = new Uint8Array(str.length);
    let isAllAscii = true;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code > 255) isAllAscii = false;
      bytes[i] = code;
    }
    if (!isAllAscii) return str; 
    const decoderGBK = new TextDecoder('gb18030', { fatal: true });
    try { return decoderGBK.decode(bytes); } catch (e) { return str; }
  } catch (e) { return str; }
};

// --- 主提取函数 ---

export const extractMetadata = async (fileOrPathObj) => {
  const isElectron = window.electron?.isElectron;
  
  let fileInput; 
  let name, pathStr, size, lastModified, parent, birthtime;
  let thumbnailSrc;

  if (isElectron) {
    name = fileOrPathObj.name;
    pathStr = fileOrPathObj.path;
    size = fileOrPathObj.size;
    lastModified = fileOrPathObj.lastModified;
    birthtime = fileOrPathObj.birthtime; // [新增]
    parent = fileOrPathObj.parent;
    thumbnailSrc = `file://${pathStr}`;
    
    try {
      const CHUNK_SIZE = 256 * 1024; 
      fileInput = await window.electron.readPartialFile(pathStr, CHUNK_SIZE);
    } catch (e) {
      console.error("Electron read partial file error:", e);
    }
  } else {
    name = fileOrPathObj.name;
    pathStr = fileOrPathObj.webkitRelativePath || fileOrPathObj.name;
    size = fileOrPathObj.size;
    lastModified = fileOrPathObj.lastModified;
    birthtime = fileOrPathObj.lastModified; // Web 环境没有 birthtime，暂用 lastModified 代替
    parent = (fileOrPathObj.webkitRelativePath || '').split('/').slice(0, -1).join('/') || '根目录';
    thumbnailSrc = URL.createObjectURL(fileOrPathObj);
    fileInput = fileOrPathObj;
  }

  const result = {
    id: `file-${name}-${lastModified}-${Math.random()}`,
    name,
    path: pathStr,
    parent,
    size,
    type: 'image',
    lastModified,
    birthtime, // [新增]
    dateOriginal: null, // 初始化为空，稍后解析
    bestDate: null,     // [新增] 用于分组的最早时间
    extension: name.split('.').pop().toLowerCase(),
    thumbnail: thumbnailSrc,
    dims: { w: 0, h: 0 },
    exif: {},
    iptc: {}
  };

  try {
    if (fileInput) {
        const output = await exifr.parse(fileInput, {
        tiff: true, ifd0: true, exif: true, iptc: true, xmp: true, jfif: true,
        mergeOutput: false, reviveValues: false 
        });

        if (output) {
            const ifd0 = output.ifd0 || {};
            const exif = output.exif || {};
            const iptc = output.iptc || {};

            // 1. 解析拍摄时间 (EXIF)
            let dt = exif.DateTimeOriginal || ifd0.DateTimeOriginal || exif.DateTime || ifd0.DateTime;
            if (dt) {
                if (typeof dt === 'string') {
                const parts = dt.split(' ');
                const datePart = parts[0].replace(/:/g, '-');
                const timePart = parts[1] || '00:00:00';
                const parsed = new Date(`${datePart}T${timePart}`);
                if (!isNaN(parsed.getTime())) result.dateOriginal = parsed;
                } else if (dt instanceof Date) {
                result.dateOriginal = dt;
                }
            }

            // 解析备注 (保持原有逻辑)
            let remark = "";
            if (ifd0.XPComment) remark = decodeWindowsXPString(ifd0.XPComment);
            if (!remark && (iptc.Caption || iptc['Caption/Abstract'])) remark = decodeCSstring(iptc.Caption || iptc['Caption/Abstract']);
            const imgDesc = ifd0.ImageDescription || exif.ImageDescription;
            if (!remark && imgDesc) remark = decodeCSstring(imgDesc);
            if (!remark && exif.UserComment && exif.UserComment instanceof Uint8Array) {
                try {
                    const u8 = new Uint8Array(exif.UserComment);
                    const offset = (u8.length > 8 && u8[5] === 0) ? 8 : 0; 
                    remark = new TextDecoder('utf-8').decode(u8.slice(offset)).replace(/\0/g, '');
                } catch(e) {}
            }
            result.exif.ImageDescription = remark; 
            result.iptc.Caption = remark;

            // 解析标记
            let tags = [];
            if (ifd0.XPKeywords) {
                const xpTags = decodeWindowsXPString(ifd0.XPKeywords);
                if (xpTags) tags.push(...xpTags.split(/[;；]/).map(s => s.trim()).filter(Boolean));
            }
            if (iptc.Keywords) {
                if (Array.isArray(iptc.Keywords)) tags.push(...iptc.Keywords);
                else tags.push(iptc.Keywords);
            }
            result.iptc.Keywords = [...new Set(tags)];
            result.exif.XPKeywords = tags.join('; ');
            
            // 解析尺寸
            const metaW = exif.ExifImageWidth || ifd0.ImageWidth || exif.PixelXDimension;
            const metaH = exif.ExifImageHeight || ifd0.ImageHeight || exif.PixelYDimension;
            if (metaW && metaH) {
                result.dims = { w: metaW, h: metaH };
            }
            
            // 基础信息
            result.exif.Make = ifd0.Make || exif.Make;
            result.exif.Model = ifd0.Model || exif.Model;
            result.exif.FNumber = exif.FNumber;
        }
    }

    // 尺寸回退
    if (result.dims.w === 0) {
      result.dims = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.width, h: img.height });
        img.onerror = () => resolve({ w: 0, h: 0 });
        img.src = thumbnailSrc;
      });
    }

  } catch (error) {
    console.error("Metadata error:", error);
  }

  // --- [核心修改] 计算最早时间 (Best Date) ---
  // 逻辑：按 读取的文件名、修改时间、拍摄时间、创建时间 4个中的最早时间
  const candidates = [];

  // 1. 文件名解析日期
  const filenameDate = parseDateFromFilename(name);
  if (filenameDate) candidates.push(filenameDate.getTime());

  // 2. 修改时间
  if (lastModified) candidates.push(lastModified);

  // 3. 拍摄时间 (EXIF)
  if (result.dateOriginal && !isNaN(result.dateOriginal.getTime())) {
    candidates.push(result.dateOriginal.getTime());
  }

  // 4. 创建时间
  if (birthtime) candidates.push(birthtime);

  if (candidates.length > 0) {
    result.bestDate = new Date(Math.min(...candidates));
  } else {
    result.bestDate = new Date(lastModified || Date.now());
  }

  // 如果没有 EXIF 拍摄时间，dateOriginal 也可以回退到 bestDate (可选，视业务需求而定)
  // 但为了保留原始语义，这里让 dateOriginal 保持为 EXIF 时间（可能为 null）
  if (!result.dateOriginal) {
      result.dateOriginal = result.bestDate;
  }

  return result;
};
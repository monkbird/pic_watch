import exifr from 'exifr';

export const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic']);

export const humanSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDate = (timestamp) => {
  if (!timestamp) return '未知日期';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '未知日期';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 解码辅助函数 (保持不变)
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

// --- 主提取函数 (兼容 Web 和 Electron) ---

export const extractMetadata = async (fileOrPathObj) => {
  // 判断是 Web File 对象还是 Electron 文件对象
  const isElectron = window.electron?.isElectron;
  
  // 标准化基础属性
  let fileInput; 
  let name, path, size, lastModified, parent;
  let thumbnailSrc;

  if (isElectron) {
    // Electron 模式: fileOrPathObj 是 main.js 返回的 { name, path, size, lastModified, parent }
    name = fileOrPathObj.name;
    path = fileOrPathObj.path; // 绝对路径
    size = fileOrPathObj.size;
    lastModified = fileOrPathObj.lastModified;
    parent = fileOrPathObj.parent;
    
    // 1. 获取缩略图 URL (直接使用 file:// 协议)
    thumbnailSrc = `file://${path}`;
    
    // 2. 读取 Buffer 用于 exifr 解析
    try {
      fileInput = await window.electron.readFile(path);
    } catch (e) {
      console.error("Electron read file error:", e);
    }
  } else {
    // Web 模式: fileOrPathObj 是 File 对象
    name = fileOrPathObj.name;
    path = fileOrPathObj.webkitRelativePath || fileOrPathObj.name;
    size = fileOrPathObj.size;
    lastModified = fileOrPathObj.lastModified;
    parent = (fileOrPathObj.webkitRelativePath || '').split('/').slice(0, -1).join('/') || '根目录';
    thumbnailSrc = URL.createObjectURL(fileOrPathObj);
    fileInput = fileOrPathObj;
  }

  const result = {
    id: `file-${name}-${lastModified}-${Math.random()}`,
    name,
    path, // 在 Electron 中这是绝对路径
    parent,
    size,
    type: 'image', // 简化
    lastModified,
    dateOriginal: new Date(lastModified),
    extension: name.split('.').pop().toLowerCase(),
    thumbnail: thumbnailSrc,
    dims: { w: 0, h: 0 },
    exif: {},
    iptc: {}
  };

  if (!fileInput) return result;

  try {
    const output = await exifr.parse(fileInput, {
      tiff: true,
      ifd0: true,    
      exif: true,
      iptc: true,
      xmp: true,
      jfif: true,
      mergeOutput: false, 
      reviveValues: false 
    });

    if (output) {
      const ifd0 = output.ifd0 || {};
      const exif = output.exif || {};
      const iptc = output.iptc || {};

      // 日期
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

      // 备注
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

      // 标记
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
      
      // 基础信息
      result.exif.Make = ifd0.Make || exif.Make;
      result.exif.Model = ifd0.Model || exif.Model;
      result.exif.FNumber = exif.FNumber;
      result.exif.ExposureTime = exif.ExposureTime;
      result.exif.ISOSpeedRatings = exif.ISOSpeedRatings;
    }

    // 获取尺寸 (Electron 和 Web 使用相同方式加载 Image 对象)
    result.dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = thumbnailSrc;
    });

  } catch (error) {
    console.error("Metadata error:", error);
  }

  return result;
};
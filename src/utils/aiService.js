export class AIService {
  constructor() {
    this.worker = new Worker(new URL('../workers/ai.worker.js', import.meta.url), {
      type: 'module'
    });
    this.callbacks = new Map();

    this.worker.onmessage = (e) => {
      const { id, status, result, message } = e.data;
      if (this.callbacks.has(id)) {
        this.callbacks.get(id)({ status, result, message });
        if (status === 'complete' || status === 'error') {
          this.callbacks.delete(id);
        }
      }
    };
  }

  // 辅助：将文件路径转为 Base64
  async fileToBase64(filePath) {
    try {
      const response = await fetch(filePath);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result); // 返回 data:image/jpeg;base64,...
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Convert base64 failed:", e);
      return null;
    }
  }

  // 修改 analyzeImage 方法
  async analyzeImage(fileId, imagePath, onUpdate) {
    if (this.callbacks.has(fileId)) return;

    // 立即通知 UI 正在转换图片
    onUpdate({ status: 'loading', message: '正在预处理图片...' });

    // 1. 转换图片 (使用传入的 path 或 thumbnail)
    // 注意：建议传入 file.thumbnail (如果是 blob url) 或者 file.path
    const base64Image = await this.fileToBase64(imagePath);

    if (!base64Image) {
      onUpdate({ status: 'error', message: '图片读取失败' });
      return;
    }

    // 2. 发送给 Worker
    this.callbacks.set(fileId, onUpdate);
    this.worker.postMessage({ 
      type: 'analyze', 
      id: fileId, 
      imageUrl: base64Image 
    });
  }
  
  terminate() {
    this.worker.terminate();
  }
}

export const aiInstance = new AIService();
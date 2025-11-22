// src/workers/ai.worker.js

// ================= 配置区域 =================
// 建议后续将这些移到设置界面，目前为了跑通先硬编码
const API_KEY = "b0c51f32-2cf6-47a3-b1b6-c30846613c5a"; // 例如：sk-xxxxxxxx
const API_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const MODEL_ENDPOINT = "doubao-seed-1-6-vision-250815"; // 关键！例如：ep-20240520010101-abcde
// ===========================================

self.addEventListener('message', async (event) => {
  const { id, imageUrl, type } = event.data;

  if (type === 'analyze') {
    try {
      self.postMessage({ id, status: 'processing', message: '正在上传至火山引擎...' });

      // 1. 构造 Prompt (提示词)
      // 针对工地场景进行深度优化
      const prompt = `
        请分析这张建筑工地的照片。
        请识别并列出画面中包含的：
        1. 施工人员（如：工人、管理人员）
        2. 施工车辆/机械（如：挖掘机、渣土车、泵车）
        3. 安全设施（如：安全帽、反光背心、脚手架、围挡）
        4. 场景文字（如：横幅内容、标语、工程牌）
        
        请直接输出一个纯 JSON 数组，不要输出 Markdown 格式，也不要包含任何解释。
        不要输出通用词汇（如“天空”、“地面”、“云”）。
        
        示例格式：["挖掘机", "未佩戴安全帽", "施工横幅", "混凝土搅拌车"]
      `;

      // 2. 构造请求体
      // 火山引擎兼容 OpenAI 格式，但在 image_url 支持上需要注意
      // 最好传入 Base64 字符串 (data:image/jpeg;base64,...)
      const payload = {
        model: MODEL_ENDPOINT, // 这里填接入点 ID，不是模型名
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl // 主线程传过来的必须是 Base64 DataURI
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1 // 降低随机性，让结果更准确
      };

      // 3. 发起请求
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // 4. 清洗数据 (防止大模型有时候还是会忍不住加 Markdown)
      const cleanContent = content.replace(/```json|```/g, '').trim();
      
      let resultLabels = [];
      try {
        resultLabels = JSON.parse(cleanContent);
      } catch (e) {
        // 万一解析失败，按换行符或逗号分割，至少能显示点东西
        resultLabels = cleanContent.split(/[\n,，]/).map(s => s.trim()).filter(s => s.length > 1);
      }

      self.postMessage({ 
        id, 
        status: 'complete', 
        result: resultLabels 
      });

    } catch (error) {
      console.error('Volcano API Error:', error);
      self.postMessage({ id, status: 'error', message: '识别失败: ' + error.message });
    }
  }
});
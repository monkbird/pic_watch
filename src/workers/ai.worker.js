// src/workers/ai.worker.js

self.addEventListener('message', async (event) => {
  const { id, imageUrl, type, config } = event.data; // 接收 config

  if (type === 'analyze') {
    // 1. 检查配置是否有效
    if (!config || !config.apiKey || !config.apiUrl || !config.model) {
      self.postMessage({ id, status: 'error', message: 'AI 未配置，请点击右上角设置进行配置' });
      return;
    }

    try {
      self.postMessage({ id, status: 'processing', message: '正在上传模型识别...' });

      // 2. 构造 Prompt (提示词) - 保持不变
      const prompt = `
        请分析这张建筑工地的照片。
        请识别并列出画面中包含的：
        1. 施工人员（如：工人、管理人员）
        2. 施工车辆/机械（如：挖掘机、外运车辆、泵车、地磅）
        3. 安全设施（如：安全帽、反光背心、脚手架、围挡、绿网、标牌）
        4. 场景文字（如：横幅内容、标语、工程牌）
        5. 其他物品（如：工具、设备、标志）
        6. 施工人员动作（如：检测、铲土、检查、清理道路等具有明确意义的操作）
        
        请直接输出一个纯 JSON 数组，不要输出 Markdown 格式，也不要包含任何解释。
        不要输出通用词汇（如“天空”、“地面”、“云”）。
        不要输出施工车辆的车牌，识别到卡车或其他大车辆时，输出“自卸车”或“外运车辆”。
        识别料堆边坡比对车辆高度，如果高于卡车自卸车等5倍高度以上，输出“高边坡”。
        多个工人时，只输出一个工人。
        多个施工车辆时，只输出一个施工车辆。
        多个安全设施时，只输出一个安全设施。
        多个场景文字时，不输出场景文字。      
        示例格式：["挖掘机", "未佩戴安全帽", "施工横幅", "混凝土搅拌车"]
      `;

      // 3. 构造请求体 (使用传入的 config)
      const payload = {
        model: config.model, // 使用配置中的 model 或 endpoint ID
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl 
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1 
      };

      // 4. 发起请求 (使用配置中的 URL 和 Key)
      const response = await fetch(config.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      const cleanContent = content.replace(/```json|```/g, '').trim();
      
      let resultLabels = [];
      try {
        resultLabels = JSON.parse(cleanContent);
      } catch (e) {
        resultLabels = cleanContent.split(/[\n,，]/).map(s => s.trim()).filter(s => s.length > 1);
      }

      self.postMessage({ 
        id, 
        status: 'complete', 
        result: resultLabels 
      });

    } catch (error) {
      console.error('API Error:', error);
      self.postMessage({ id, status: 'error', message: '识别失败: ' + error.message });
    }
  }
});
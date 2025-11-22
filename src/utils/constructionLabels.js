// 工地场景自定义搜索词库
// 键(Key): 发送给模型的英文提示词 (Prompt)
// 值(Value): 界面显示的中文
export const CONSTRUCTION_TARGETS = {
  "excavator": "挖掘机",
  "bulldozer": "推土机",
  "dump truck": "外运车辆",
  "scaffolding": "脚手架",
  "safety helmet": "安全帽",
  "safety vest": "反光背心",
  "construction worker": "施工人员",
  "banner": "横幅/标语",
  "pile of dirt": "土堆/渣土",
  "truck": "卡车"
};

export const getCandidateLabels = () => Object.keys(CONSTRUCTION_TARGETS);

export const getLabelCN = (label) => CONSTRUCTION_TARGETS[label] || label;
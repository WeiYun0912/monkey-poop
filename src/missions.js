// 任務模式：達成所有條件就過關；reward = 第一次過關拿到的星星
// goalCm 目標高度、timeLimit 限時秒數、noBanana 不能吃香蕉、rockets 要點火幾次、birds 要趕走幾隻鳥
export const MISSIONS = [
  { id: 1, title: '第一座塔', desc: '蓋到 30 cm', goalCm: 30, reward: 2 },
  { id: 2, title: '餓肚子挑戰', desc: '不吃香蕉，蓋到 35 cm', goalCm: 35, noBanana: true, reward: 3 },
  { id: 3, title: '限時快擠', desc: '40 秒內蓋到 50 cm', goalCm: 50, timeLimit: 40, reward: 3 },
  { id: 4, title: '趕鳥人', desc: '趕走 2 隻鳥，並蓋到 45 cm', goalCm: 45, birds: 2, reward: 3 },
  { id: 5, title: '辣椒狂人', desc: '點火 2 次辣椒火箭，並蓋到 70 cm', goalCm: 70, rockets: 2, reward: 4 },
  { id: 6, title: '通天便便塔', desc: '蓋到 120 cm', goalCm: 120, reward: 5 },
]

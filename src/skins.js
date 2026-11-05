// 造型定義：stars = 累積幾顆星解鎖
export const HATS = [
  { id: 'none', name: '不戴', icon: '🐒', stars: 0 },
  { id: 'party', name: '派對帽', icon: '🥳', stars: 3 },
  { id: 'shades', name: '墨鏡', icon: '🕶️', stars: 8 },
  { id: 'crown', name: '皇冠', icon: '👑', stars: 18 },
  { id: 'straw', name: '草帽', icon: '👒', stars: 30 },
]

// col(l, y)：l 是隨機亮度、y 是高度，回傳 HSL
export const POOPS = [
  { id: 'classic', name: '經典', icon: '💩', stars: 0, col: (l) => [0.07, 0.55, l] },
  { id: 'berry', name: '草莓', icon: '🍓', stars: 5, col: (l) => [0.95, 0.65, l + 0.38] },
  { id: 'matcha', name: '抹茶', icon: '🍵', stars: 12, col: (l) => [0.27, 0.45, l + 0.15] },
  { id: 'rainbow', name: '彩虹', icon: '🌈', stars: 22, col: (l, y) => [(y * 0.12) % 1, 0.75, 0.55] },
  { id: 'gold', name: '黃金', icon: '🏆', stars: 35, col: (l) => [0.12, 0.9, l + 0.25] },
]

// 本機進度：最佳紀錄、累積星星、任務過關、造型、靜音
// localStorage 讀寫失敗（無痕、被封鎖）時照常能玩，只是不保存
import { MISSIONS } from './missions.js'

const KEY = 'monkey-poop-progress'
const DEFAULT = { best: 0, stars: 0, cleared: [], hat: 'none', poop: 'classic', muted: false }

export function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    // 舊版只存最佳紀錄
    const oldBest = Number(localStorage.getItem('monkey-poop-best') || 0)
    return { ...DEFAULT, best: oldBest, ...raw }
  } catch {
    return { ...DEFAULT }
  }
}

export function saveProgress(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* 存不了就不存 */
  }
}

// 一局結束後更新進度，回傳要顯示在結算面板的資訊
export function recordRun(p, result, missionId) {
  const next = { ...p, cleared: [...p.cleared] }
  let gained = 0
  let newBest = false
  if (missionId) {
    const m = MISSIONS.find((x) => x.id === missionId)
    if (result.success && !next.cleared.includes(missionId)) {
      next.cleared.push(missionId)
      gained = m.reward
    }
  } else if (result.success) {
    gained = result.stars
    if (result.cm > next.best) {
      next.best = result.cm
      newBest = true
    }
  }
  next.stars += gained
  return { progress: next, gained, newBest }
}

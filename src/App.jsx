import { useEffect, useRef, useState } from 'react'
import { Game, STAR_CM, COMBO_FOR_FEVER } from './game/engine.js'
import './App.css'

export default function App() {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const [s, setS] = useState({ phase: 'ready', cm: 0, belly: 100, hold: 0, wind: 0, combo: 0, fever: 0, chiliWarn: 0, diarrhea: 0, result: null })
  const [showRules, setShowRules] = useState(true)
  const rulesRef = useRef(true)
  rulesRef.current = showRules

  useEffect(() => {
    const game = new Game(canvasRef.current, setS)
    gameRef.current = game
    window.__game = game // 方便除錯
    const keys = {}
    const down = (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        if (!rulesRef.current) game.setSqueeze(true)
      }
      keys[e.code] = true
    }
    const up = (e) => {
      if (e.code === 'Space') game.setSqueeze(false)
      keys[e.code] = false
    }
    let raf
    const tick = () => {
      if (keys.ArrowLeft || keys.KeyA) game.nudgeX(-0.06)
      if (keys.ArrowRight || keys.KeyD) game.nudgeX(0.06)
      raf = requestAnimationFrame(tick)
    }
    tick()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      game.dispose()
    }
  }, [])

  const pointerX = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    gameRef.current.setPointerX(((e.clientX - rect.left) / rect.width) * 2 - 1)
  }
  const onDown = (e) => {
    if (showRules) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerX(e)
    gameRef.current.setSqueeze(true)
  }
  const onUp = () => gameRef.current?.setSqueeze(false)

  const r = s.result
  const playing = s.phase === 'playing' || s.phase === 'dumping'

  return (
    <div className="app">
      <canvas ref={canvasRef} className="scene" />
      <div
        className="touch"
        onPointerDown={onDown}
        onPointerMove={pointerX}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />

      <div className="hud">
        <div className="height">{s.cm.toFixed(1)} <small>cm</small></div>
        <div className="meters">
          <Meter label="🍌 肚子" value={s.belly / 100} color={s.belly < 25 ? '#e74c3c' : '#c98b2b'} />
          <Meter label="😣 憋氣" value={s.hold} color="#e74c3c" />
        </div>
        {s.wind !== 0 && playing && <div className="toast">{s.wind > 0 ? '💨 → 右風來了！' : '← 💨 左風來了！'}</div>}
        {s.phase === 'dumping' && <div className="toast danger">💥 憋不住了！</div>}
        {playing && s.combo > 0 && !s.fever && <div className="toast">🍌 連吃 ×{s.combo}（再 {COMBO_FOR_FEVER - s.combo} 根進狂熱）</div>}
        {playing && s.fever > 0 && <div className="toast fever">🔥 便便狂熱！{s.fever.toFixed(1)}s</div>}
        {playing && s.chiliWarn > 0 && <div className="toast danger">🌶️ 肚子咕嚕咕嚕…快回盤子上！</div>}
        {playing && s.diarrhea > 0 && <div className="toast danger">🌶️ 狂噴中！{s.diarrhea.toFixed(1)}s</div>}
      </div>

      {playing && (
        <button className="finish" onClick={() => gameRef.current.finish()}>
          收工 ✋
        </button>
      )}

      {s.phase === 'ready' && !showRules && <div className="hint">按住開始擠 · 左右移動猴子</div>}

      {showRules && (
        <div className="panel">
          <h1>🐒 猴子擠便便塔</h1>
          <ul>
            <li><b>按住</b>（或空白鍵）猴子就開始擠；<b>左右拖曳</b>（或 ← →）讓猴子在樹枝上移動。</li>
            <li>盤子會自己轉，猴子離中心越遠，便便圈就越大。<b>貼近中心但別正中間</b>，拉成小圈才立得住；停在正中間會原地糊成一攤，圈太大又浪費。</li>
            <li>每擠一段都會消耗<b>肚子</b>；樹枝旁會冒出 🍌，移過去就能吃掉補充（金香蕉補更多）。</li>
            <li><b>連吃 {COMBO_FOR_FEVER} 根香蕉</b>（每根間隔 3.5 秒內）進入 🔥 <b>便便狂熱</b> 5 秒：金色便便、怎麼擠都立得住、肚子不會消耗。</li>
            <li>小心 🌶️ <b>辣椒</b>（常常躲在香蕉旁邊）！碰到後 0.5 秒會開始<b>強制狂噴 3 秒</b>，又稀又亂、立不住。人在盤外就完蛋，快衝回來！</li>
            <li>放開後只能<b>憋 2 秒</b>，憋不住就會在當下位置噴一坨。去吃香蕉時要抓好時機！</li>
            <li>堆太陡會<b>坍塌</b>往下滾。越高轉得越快，還會<b>颳側風</b>把便便吹歪。</li>
            <li>擠到<b>盤子外面</b>就失敗。</li>
            <li>覺得夠高就按<b>「收工」</b>結算；肚子擠空也會自動結算。⭐ {STAR_CM.join(' / ')} cm</li>
          </ul>
          <button onClick={() => setShowRules(false)}>開始！</button>
        </div>
      )}

      {s.phase === 'over' && r && (
        <div className="panel result">
          <h2>{r.success ? r.reason : `💩 ${r.reason}`}</h2>
          <div className="big">{r.cm.toFixed(1)} cm</div>
          {r.success ? (
            <div className="stars">{'⭐'.repeat(r.stars)}{'☆'.repeat(3 - r.stars)}</div>
          ) : (
            <p className="muted">失敗不計入紀錄</p>
          )}
          <p>{r.newBest ? '🎉 刷新個人最佳！' : `個人最佳 ${r.best ? r.best.toFixed(1) + ' cm' : '—'}`}</p>
          <button onClick={() => gameRef.current.reset()}>再擠一次</button>
        </div>
      )}
    </div>
  )
}

function Meter({ label, value, color }) {
  return (
    <div className="meter">
      <span>{label}</span>
      <div className="bar">
        <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Game, COMBO_FOR_FEVER } from './game/engine.js'
import { setMuted } from './game/audio.js'
import { loadProgress, saveProgress, recordRun } from './progress.js'
import { MISSIONS } from './missions.js'
import { Home, Rules, Missions, Skins } from './ui/Menus.jsx'
import { ShareCard } from './ui/ShareCard.jsx'
import './App.css'

export default function App() {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const [s, setS] = useState({ phase: 'ready', cm: 0, belly: 100, hold: 0, wind: 0, combo: 0, fever: 0, chiliWarn: 0, rocket: 0, magnet: 0, mushroom: 0, net: 0, boom: 0, birdPeck: 0, peckMsg: 0, stats: null, mission: null, result: null })
  const [progress, setProgress] = useState(loadProgress)
  const [screen, setScreen] = useState('home') // home | rules | missions | skins | null（遊戲中）
  const [runInfo, setRunInfo] = useState(null) // 結算時拿到幾顆星、是否破紀錄
  const [shot, setShot] = useState(null) // 分享卡用的截圖
  const screenRef = useRef(screen)
  screenRef.current = screen

  useEffect(() => {
    const game = new Game(canvasRef.current, setS)
    gameRef.current = game
    window.__game = game // 方便除錯
    const keys = {}
    const down = (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        if (!screenRef.current) game.setSqueeze(true)
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

  // 進度變動：存檔、套用造型與靜音
  useEffect(() => {
    saveProgress(progress)
    gameRef.current?.setSkin(progress.hat, progress.poop)
    setMuted(progress.muted)
  }, [progress])

  // 一局結束時記錄一次成績
  const recorded = useRef(null)
  useEffect(() => {
    const r = s.result
    if (!r || recorded.current === r) return
    recorded.current = r
    setProgress((p) => {
      const { progress: next, gained, newBest } = recordRun(p, r, r.missionId)
      setRunInfo({ gained, newBest, best: next.best })
      return next
    })
  }, [s.result])

  const start = (mission = null) => {
    setRunInfo(null)
    setShot(null)
    gameRef.current.start(mission)
    setScreen(null)
  }

  const pointerX = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    gameRef.current.setPointerX(((e.clientX - rect.left) / rect.width) * 2 - 1)
  }
  const onDown = (e) => {
    if (screen) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerX(e)
    gameRef.current.setSqueeze(true)
  }
  const onUp = () => gameRef.current?.setSqueeze(false)

  const r = s.result
  const m = s.mission
  const playing = s.phase === 'playing' || s.phase === 'dumping'
  const nextMission = m && MISSIONS.find((x) => x.id === m.id + 1)

  return (
    <div className="app">
      <canvas ref={canvasRef} className="scene" />
      <div
        className="touch"
        onPointerDown={onDown}
        onPointerMove={pointerX}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      />

      <button
        className="icon-btn mute"
        aria-label={progress.muted ? '開啟聲音' : '靜音'}
        onClick={() => setProgress((p) => ({ ...p, muted: !p.muted }))}
      >
        {progress.muted ? '🔇' : '🔊'}
      </button>

      {!screen && (
        <div className="hud">
          <div className="height">
            {s.cm.toFixed(1)} <small>cm</small>
          </div>
          {m && <MissionBar m={m} st={s.stats} cm={s.cm} />}
          <div className="meters">
            <Meter label="🍌 肚子" value={s.belly / 100} color={s.belly < 25 ? '#e74c3c' : '#c98b2b'} />
            <Meter label="😣 憋氣" value={s.hold} color="#e74c3c" />
          </div>
          {s.wind !== 0 && playing && <div className="toast">{s.wind > 0 ? '💨 → 右風來了！' : '← 💨 左風來了！'}</div>}
          {s.phase === 'dumping' && <div className="toast danger">💥 憋不住了！</div>}
          {s.offDish && <div className="toast">🙊 在盤子外面，先憋著！</div>}
          {playing && s.birdPeck > 0 && (
            <div className="toast danger">🐦 鳥在啄塔頂！移到牠上面擠便便砸牠 {s.birdPeck.toFixed(1)}s</div>
          )}
          {playing && s.peckMsg > 0 && <div className="toast danger">🐦 塔頂被啄掉一截！</div>}
          {playing && s.combo > 0 && !s.fever && (
            <div className="toast">🍌 連吃 ×{s.combo}（再 {COMBO_FOR_FEVER - s.combo} 根進狂熱）</div>
          )}
          {playing && s.fever > 0 && <div className="toast fever">🔥 便便狂熱！{s.fever.toFixed(1)}s</div>}
          {playing && s.chiliWarn > 0 && <div className="toast danger">🌶️ 肚子咕嚕咕嚕…要點火了，快回塔上！</div>}
          {playing && s.rocket > 0 && <div className="toast rocket">🚀 辣椒火箭！{s.rocket.toFixed(1)}s</div>}
          {playing && s.boom > 0 && <div className="toast danger">💣 轟！塔頂被炸掉一截</div>}
          {playing && (s.magnet > 0 || s.mushroom > 0 || s.net > 0) && (
            <div className="buffs">
              {s.magnet > 0 && <span>🧲 {s.magnet.toFixed(1)}</span>}
              {s.mushroom > 0 && <span>🍄 {s.mushroom.toFixed(1)}</span>}
              {s.net > 0 && <span>🛟 {s.net.toFixed(1)}</span>}
            </div>
          )}
        </div>
      )}

      {playing && !screen && (
        <button className="finish" onClick={() => gameRef.current.finish()}>
          {m ? '放棄' : '收工 ✋'}
        </button>
      )}

      {s.phase === 'ready' && !screen && (
        <div className="hint">{m ? `🎯 ${m.desc}｜` : ''}按住開始擠 · 左右移動猴子</div>
      )}

      {screen === 'home' && (
        <Home
          progress={progress}
          onFree={() => start(null)}
          onMissions={() => setScreen('missions')}
          onSkins={() => setScreen('skins')}
          onRules={() => setScreen('rules')}
        />
      )}
      {screen === 'rules' && <Rules onBack={() => setScreen('home')} />}
      {screen === 'missions' && <Missions progress={progress} onPick={(mi) => start(mi)} onBack={() => setScreen('home')} />}
      {screen === 'skins' && <Skins progress={progress} onChange={setProgress} onBack={() => setScreen('home')} />}

      {!screen && s.phase === 'over' && r && !shot && (
        <div className="panel result">
          <h2>{r.success ? r.reason : `💩 ${r.reason}`}</h2>
          {m && <p className="muted">🎯 {m.title}：{m.desc}</p>}
          <div className="big">{r.cm.toFixed(1)} cm</div>
          {!m && r.success && (
            <div className="stars">
              {'⭐'.repeat(r.stars)}
              {'☆'.repeat(3 - r.stars)}
            </div>
          )}
          {!m && !r.success && <p className="muted">失敗不計入紀錄</p>}
          {runInfo && (
            <p>
              {runInfo.gained > 0 && <b className="gain">+{runInfo.gained} ⭐</b>}
              {!m && (runInfo.newBest ? '🎉 刷新個人最佳！' : `個人最佳 ${runInfo.best ? runInfo.best.toFixed(1) + ' cm' : '—'}`)}
            </p>
          )}
          <div className="row-btns">
            {m && r.success && nextMission ? (
              <button onClick={() => start(nextMission)}>下一關 ▶</button>
            ) : (
              <button onClick={() => start(m)}>{m ? '再挑戰' : '再擠一次'}</button>
            )}
            <button className="ghost" onClick={() => setShot(gameRef.current.snapshot())}>
              📸 分享
            </button>
            <button className="ghost" onClick={() => setScreen('home')}>
              主選單
            </button>
          </div>
        </div>
      )}

      {shot && r && <ShareCard shot={shot} result={r} mission={m} onClose={() => setShot(null)} />}
    </div>
  )
}

function MissionBar({ m, st, cm }) {
  if (!st) return null
  return (
    <div className="mission">
      <span>🎯 {Math.min(cm, m.goalCm).toFixed(0)}/{m.goalCm} cm</span>
      {m.timeLimit && <span>⏱ {Math.max(0, m.timeLimit - st.playTime).toFixed(0)}s</span>}
      {m.birds && <span>🐦 {st.birds}/{m.birds}</span>}
      {m.rockets && <span>🚀 {st.rockets}/{m.rockets}</span>}
      {m.noBanana && <span>🚫🍌</span>}
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

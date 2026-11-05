import { STAR_CM, COMBO_FOR_FEVER } from '../game/engine.js'
import { MISSIONS } from '../missions.js'
import { HATS, POOPS } from '../skins.js'

export function Home({ progress, onFree, onMissions, onSkins, onRules }) {
  return (
    <div className="panel home">
      <h1>🐒 猴子擠便便塔</h1>
      <p className="muted">
        個人最佳 {progress.best ? progress.best.toFixed(1) + ' cm' : '—'} · 累積 ⭐ {progress.stars}
      </p>
      <div className="menu">
        <button onClick={onFree}>💩 自由模式</button>
        <button onClick={onMissions}>
          🎯 任務模式 <small>{progress.cleared.length}/{MISSIONS.length}</small>
        </button>
        <button onClick={onSkins}>🎩 造型</button>
        <button className="ghost" onClick={onRules}>
          📖 玩法說明
        </button>
      </div>
    </div>
  )
}

export function Rules({ onBack }) {
  return (
    <div className="panel">
      <h1>📖 玩法說明</h1>
      <ul>
        <li><b>按住</b>（或空白鍵）猴子就開始擠；<b>左右拖曳</b>（或 ← →）讓猴子在樹枝上移動。</li>
        <li>盤子會自己轉，猴子離中心越遠，便便圈就越大。<b>貼近中心但別正中間</b>，拉成小圈才立得住；停在正中間會原地糊成一攤，圈太大又浪費。</li>
        <li>每擠一段都會消耗<b>肚子</b>；樹枝旁會冒出 🍌，移過去就能吃掉補充（金香蕉補更多）。</li>
        <li><b>連吃 {COMBO_FOR_FEVER} 根香蕉</b>（每根間隔 3.5 秒內）進入 🔥 <b>便便狂熱</b> 5 秒：金色便便、怎麼擠都立得住、肚子不會消耗。</li>
        <li>🌶️ <b>辣椒火箭</b>（常常躲在香蕉旁邊）：吃到後 0.5 秒點火，猴子會<b>往上衝</b>，強力噴射 3 秒把塔<b>一口氣往上頂</b>！但點火時人在盤外就完蛋，吃完要立刻衝回塔上。</li>
        <li>
          隨機道具：🧲 <b>磁鐵</b>（6 秒，香蕉自己飛過來）、🍄 <b>巨大菇</b>（5 秒，便便變大）、🛟 <b>救生網</b>（8
          秒，在盤外也能照擠、噴到盤外不算輸）；小心 💣 <b>炸彈</b>，碰到塔頂會被炸掉一截！
        </li>
        <li>🐦 <b>鳥</b>會飛來停在塔頂啄便便：把猴子移到牠<b>正上方擠便便砸牠</b>就會飛走，3 秒內沒趕走會被啄掉一截。</li>
        <li>放開，或猴子移到<b>盤子外面</b>（會自動憋住）時，只能<b>憋 2 秒</b>，憋不住就會在當下位置噴一坨。去盤外吃東西要在 2 秒內回來！</li>
        <li>堆太陡會<b>坍塌</b>往下滾。越高轉得越快，還會<b>颳側風</b>把便便吹歪。</li>
        <li>憋不住噴出來、或辣椒點火時人在<b>盤子外面</b>就失敗（有 🛟 救生網時例外）。</li>
        <li>自由模式：覺得夠高就按<b>「收工」</b>結算，肚子擠空也會自動結算。⭐ {STAR_CM.join(' / ')} cm，星星可以拿去解鎖造型。</li>
      </ul>
      <button onClick={onBack}>知道了</button>
    </div>
  )
}

export function Missions({ progress, onPick, onBack }) {
  return (
    <div className="panel">
      <h1>🎯 任務模式</h1>
      <p className="muted">過關解鎖下一關，第一次過關拿星星</p>
      <div className="list">
        {MISSIONS.map((m, i) => {
          const cleared = progress.cleared.includes(m.id)
          const locked = i > 0 && !progress.cleared.includes(MISSIONS[i - 1].id)
          return (
            <button key={m.id} className={`row ${cleared ? 'done' : ''}`} disabled={locked} onClick={() => onPick(m)}>
              <span className="num">{locked ? '🔒' : cleared ? '✅' : m.id}</span>
              <span className="txt">
                <b>{m.title}</b>
                <small>{m.desc}</small>
              </span>
              <span className="reward">{cleared ? '已過關' : `+${m.reward}⭐`}</span>
            </button>
          )
        })}
      </div>
      <button className="ghost" onClick={onBack}>
        返回
      </button>
    </div>
  )
}

export function Skins({ progress, onChange, onBack }) {
  const pick = (list, key) => (
    <div className="skins">
      {list.map((it) => {
        const locked = progress.stars < it.stars
        const on = progress[key] === it.id
        return (
          <button
            key={it.id}
            className={`skin ${on ? 'on' : ''}`}
            disabled={locked}
            onClick={() => onChange({ ...progress, [key]: it.id })}
          >
            <span className="ico">{locked ? '🔒' : it.icon}</span>
            <small>{locked ? `${it.stars}⭐` : it.name}</small>
          </button>
        )
      })}
    </div>
  )
  return (
    <div className="panel">
      <h1>🎩 造型</h1>
      <p className="muted">累積 ⭐ {progress.stars}，自由模式拿星、任務第一次過關拿星</p>
      <h3>猴子配件</h3>
      {pick(HATS, 'hat')}
      <h3>便便口味</h3>
      {pick(POOPS, 'poop')}
      <button onClick={onBack}>完成</button>
    </div>
  )
}

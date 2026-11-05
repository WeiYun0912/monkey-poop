import { useEffect, useState } from 'react'

const W = 720
const H = 1000

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// 把遊戲截圖 + 成績合成一張直式分享卡
function compose(shot, result, mission) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = W
      c.height = H
      const ctx = c.getContext('2d')
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#bfe6ff')
      bg.addColorStop(1, '#fff3d6')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      ctx.fillStyle = '#3b2412'
      ctx.textAlign = 'center'
      ctx.font = '900 48px system-ui, sans-serif'
      ctx.fillText('🐒 猴子擠便便塔', W / 2, 80)

      // 截圖以 cover 方式裁進圓角框
      const bx = 40, by = 120, bw = W - 80, bh = 600
      const s = Math.max(bw / img.width, bh / img.height)
      const sw = bw / s, sh = bh / s
      ctx.save()
      roundRect(ctx, bx, by, bw, bh, 28)
      ctx.clip()
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, bx, by, bw, bh)
      ctx.restore()
      ctx.lineWidth = 6
      ctx.strokeStyle = '#ffffff'
      roundRect(ctx, bx, by, bw, bh, 28)
      ctx.stroke()

      ctx.fillStyle = '#3b2412'
      ctx.font = '900 110px system-ui, sans-serif'
      ctx.fillText(`${result.cm.toFixed(1)} cm`, W / 2, 850)
      ctx.font = '700 40px system-ui, sans-serif'
      const sub = mission
        ? `🎯 ${mission.title}  ${result.success ? '✅ 過關' : '❌ 失敗'}`
        : result.success
          ? '⭐'.repeat(result.stars) + '☆'.repeat(3 - result.stars)
          : `💩 ${result.reason}`
      ctx.fillText(sub, W / 2, 920)
      ctx.font = '500 26px system-ui, sans-serif'
      ctx.fillStyle = '#8a6d55'
      ctx.fillText(new Date().toLocaleDateString('zh-TW'), W / 2, 970)
      resolve(c)
    }
    img.src = shot
  })
}

export function ShareCard({ shot, result, mission, onClose }) {
  const [card, setCard] = useState(null)

  useEffect(() => {
    compose(shot, result, mission).then(setCard)
  }, [shot, result, mission])

  const url = card?.toDataURL('image/png')
  const filename = `monkey-poop-${result.cm.toFixed(0)}cm.png`

  const share = () => {
    card.toBlob(async (blob) => {
      const file = new File([blob], filename, { type: 'image/png' })
      try {
        await navigator.share({ files: [file], title: '猴子擠便便塔', text: `我蓋了 ${result.cm.toFixed(1)} cm 的便便塔！` })
      } catch {
        /* 使用者取消分享 */
      }
    })
  }
  const canShare = card && navigator.canShare?.({ files: [new File([], 'x.png', { type: 'image/png' })] })

  return (
    <div className="panel share">
      {url ? <img src={url} alt="便便塔成績卡" /> : <p>產生中…</p>}
      <div className="row-btns">
        {url && (
          <a className="btn" href={url} download={filename}>
            ⬇️ 下載
          </a>
        )}
        {canShare && <button onClick={share}>📤 分享</button>}
        <button className="ghost" onClick={onClose}>
          關閉
        </button>
      </div>
    </div>
  )
}

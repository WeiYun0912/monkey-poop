// 全部用 WebAudio 即時合成，不需要外部音檔
let ctx = null
let master = null
let muted = false
let squeezeNode = null

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 1
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// 所有聲音都接到 master，靜音時一次關掉
function out() {
  ac()
  return master
}

let noise = null
function noiseBuffer(c) {
  if (noise) return noise
  noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return noise
}

export function unlockAudio() {
  ac()
  startBgm()
}

export function setMuted(m) {
  muted = m
  if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05)
}

// ── 背景音樂：合成的叢林小調，狂熱／火箭時加快 ──
const BASS = [130.8, 98, 110, 82.4] // C3 G2 A2 E2
const SCALE = [523.3, 587.3, 659.3, 784, 880, 1046.5] // C 大調五聲
let bgmTimer = null
let nextNote = 0
let step = 0
let intensity = 0 // 0 一般、1 狂熱／火箭

export function setBgmIntensity(level) {
  intensity = level
}

function note(type, f, t, dur, vol) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.value = f
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function shaker(t, vol) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 6000
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
  src.connect(hp).connect(g).connect(master)
  src.start(t, Math.random())
  src.stop(t + 0.06)
}

function startBgm() {
  if (bgmTimer) return
  nextNote = ctx.currentTime + 0.1
  bgmTimer = setInterval(() => {
    // 提前 0.2 秒排程，避免卡頓
    while (nextNote < ctx.currentTime + 0.2) {
      const bpm = intensity ? 150 : 108
      const eighth = 30 / bpm
      const bar = Math.floor(step / 8) % 4
      if (step % 4 === 0) note('triangle', BASS[bar], nextNote, eighth * 3, 0.16)
      if (step % 2 === 1 || intensity) shaker(nextNote, 0.05)
      // 木琴旋律：固定節奏型 + 隨機音高
      if ([0, 3, 5, 6].includes(step % 8) && Math.random() < 0.8) {
        note('sine', SCALE[(bar + Math.floor(Math.random() * 4)) % SCALE.length], nextNote, eighth * 1.5, 0.07)
      }
      nextNote += eighth
      step++
    }
  }, 50)
}

export function playTweet() {
  tone('sine', 2200, 2800, 0.08, 0.12)
  tone('sine', 2400, 3000, 0.08, 0.12, 0.12)
}

export function playSquawk() {
  tone('sawtooth', 1400, 600, 0.25, 0.15)
}

// 擠壓中的「噗啾」聲：濾波噪音 + 低頻顫動
export function setSqueezing(on) {
  const c = ac()
  if (on && !squeezeNode) {
    const src = c.createBufferSource()
    src.buffer = noiseBuffer(c)
    src.loop = true
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 380
    lp.Q.value = 8
    const gain = c.createGain()
    gain.gain.value = 0
    gain.gain.setTargetAtTime(0.35, c.currentTime, 0.05)
    const lfo = c.createOscillator()
    lfo.frequency.value = 9
    const lfoGain = c.createGain()
    lfoGain.gain.value = 160
    lfo.connect(lfoGain).connect(lp.frequency)
    src.connect(lp).connect(gain).connect(out())
    src.start()
    lfo.start()
    squeezeNode = { src, lfo, gain }
  } else if (!on && squeezeNode) {
    const n = squeezeNode
    squeezeNode = null
    n.gain.gain.setTargetAtTime(0, c.currentTime, 0.04)
    setTimeout(() => {
      n.src.stop()
      n.lfo.stop()
    }, 200)
  }
}

function tone(type, f0, f1, dur, vol = 0.25, delay = 0) {
  const c = ac()
  const t = c.currentTime + delay
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  o.connect(g).connect(out())
  o.start(t)
  o.stop(t + dur + 0.05)
}

export function playBanana(golden) {
  tone('sine', 600, 1200, 0.12, 0.25)
  tone('sine', 900, 1800, 0.15, 0.2, 0.08)
  if (golden) tone('triangle', 1200, 2400, 0.2, 0.2, 0.16)
}

export function playFart() {
  const c = ac()
  const t = c.currentTime
  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(110, t)
  o.frequency.exponentialRampToValueAtTime(55, t + 0.7)
  const vib = c.createOscillator()
  vib.frequency.value = 28
  const vibG = c.createGain()
  vibG.gain.value = 30
  vib.connect(vibG).connect(o.frequency)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 600
  const g = c.createGain()
  g.gain.setValueAtTime(0.4, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.8)
  o.connect(lp).connect(g).connect(out())
  o.start(t)
  vib.start(t)
  o.stop(t + 0.85)
  vib.stop(t + 0.85)
}

export function playFever() {
  ;[523, 659, 784, 1046, 1318].forEach((f, i) => tone('square', f, f * 1.02, 0.12, 0.12, i * 0.06))
}

// 吃到辣椒：肚子咕嚕咕嚕
export function playRumble() {
  tone('sawtooth', 70, 40, 0.8, 0.3)
  tone('sine', 120, 60, 0.6, 0.2, 0.2)
}

// 辣椒火箭點火：轟的一聲往上衝
export function playRocket() {
  playFart()
  const c = ac()
  const t = c.currentTime
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.5
  bp.frequency.setValueAtTime(300, t)
  bp.frequency.exponentialRampToValueAtTime(2500, t + 0.6)
  const g = c.createGain()
  g.gain.setValueAtTime(0.5, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.2)
  src.connect(bp).connect(g).connect(out())
  src.start(t)
  src.stop(t + 1.3)
  tone('sawtooth', 90, 500, 0.6, 0.12)
}

export function playPowerup() {
  ;[392, 523, 659, 784].forEach((f, i) => tone('triangle', f, f * 1.5, 0.15, 0.15, i * 0.05))
}

export function playBomb() {
  const c = ac()
  const t = c.currentTime
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(1200, t)
  lp.frequency.exponentialRampToValueAtTime(80, t + 0.8)
  const g = c.createGain()
  g.gain.setValueAtTime(0.8, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 1)
  src.connect(lp).connect(g).connect(out())
  src.start(t)
  src.stop(t + 1.1)
  tone('sine', 120, 30, 0.6, 0.4)
}

export function playFail() {
  tone('square', 400, 90, 0.7, 0.15)
}

export function playWin(stars) {
  const notes = [523, 659, 784, 1046]
  for (let i = 0; i <= stars; i++) tone('triangle', notes[i], notes[i] * 1.01, 0.25, 0.2, i * 0.12)
}

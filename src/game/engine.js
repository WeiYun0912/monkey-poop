import * as THREE from 'three'
import { createMonkey, createBanana, createScenery, createDish } from './models.js'
import * as sfx from './audio.js'

const DISH_R = 1.7
const MAX_BLOBS = 5000
const BLOB_INTERVAL = 0.035 // 秒／顆
const BELLY_PER_BLOB = 100 / 520
const HOLD_LIMIT = 2 // 放開後最多憋幾秒
const MONKEY_X_RANGE = 2.8
const CM_PER_UNIT = 10
export const STAR_CM = [20, 35, 50]

export class Game {
  constructor(canvas, onState) {
    this.onState = onState
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const scene = (this.scene = new THREE.Scene())
    scene.background = new THREE.Color('#bfe6ff')
    scene.fog = new THREE.Fog('#bfe6ff', 18, 50)
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)

    scene.add(new THREE.HemisphereLight('#ffffff', '#6a8f4a', 1.4))
    const sun = (this.sun = new THREE.DirectionalLight('#fff3dd', 2.2))
    sun.position.set(4, 10, 6)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 40 })
    scene.add(sun, sun.target)

    createScenery(scene)
    this.dish = createDish(DISH_R)
    scene.add(this.dish)

    // 便便：InstancedMesh 掛在盤子底下，跟著盤子轉
    this.stack = new THREE.Group()
    this.dish.add(this.stack)
    const poopMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.05 })
    this.blobMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), poopMat, MAX_BLOBS)
    this.blobMesh.castShadow = true
    this.blobMesh.receiveShadow = true
    this.blobMesh.frustumCulled = false
    this.stack.add(this.blobMesh)

    this.monkey = createMonkey()
    scene.add(this.monkey.root)
    this.branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.16, 14, 12),
      new THREE.MeshStandardMaterial({ color: '#6b4423', roughness: 0.9 }),
    )
    this.branch.rotation.z = Math.PI / 2
    this.branch.castShadow = true
    scene.add(this.branch)

    this.stream = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1, 10), poopMat.clone())
    this.stream.material.color.set('#6b3e1f')
    scene.add(this.stream)

    this.flies = []
    const flyMat = new THREE.MeshBasicMaterial({ color: '#111' })
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), flyMat)
      f.visible = false
      scene.add(f)
      this.flies.push(f)
    }

    this.windArrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.25, 0.6, 12),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }),
    )
    this.windArrow.visible = false
    scene.add(this.windArrow)

    this.tmpM = new THREE.Matrix4()
    this.tmpQ = new THREE.Quaternion()
    this.tmpC = new THREE.Color()
    this.clock = new THREE.Clock()
    this.input = { squeeze: false, targetX: 0.8 }
    this.repose = [0.7, 2.4] // 坡度上限（tan 安息角）：[原地噴, 拉成條]
    this.rollIters = 6
    this.reset()

    this.resize = this.resize.bind(this)
    window.addEventListener('resize', this.resize)
    this.resize()
    this.loop = this.loop.bind(this)
    this.raf = requestAnimationFrame(this.loop)
  }

  reset() {
    this.phase = 'ready' // ready | playing | dumping | over
    this.blobs = []
    this.blobMesh.count = 0
    this.blobAcc = 0
    this.belly = 100
    this.holdTime = 0
    this.dumpTime = 0
    this.dishAngle = 0
    this.monkeyX = this.input.targetX
    this.spin = 1.5
    this.top = 0
    for (const b of this.bananas || []) this.scene.remove(b.mesh)
    this.bananas = []
    this.bananaTimer = 4
    this.wind = 0
    this.windTimer = 8
    this.windLeft = 0
    this.time = 0
    this.result = null
    this.fallAnim = null
    this.stack.rotation.set(0, 0, 0)
    this.stack.position.set(0, 0, 0)
    this.camY = 1.2
    this.emit(true)
  }

  setPointerX(nx) {
    // nx: -1 ~ 1
    this.input.targetX = THREE.MathUtils.clamp(nx, -1, 1) * MONKEY_X_RANGE
  }
  nudgeX(dx) {
    this.input.targetX = THREE.MathUtils.clamp(this.input.targetX + dx, -MONKEY_X_RANGE, MONKEY_X_RANGE)
  }

  setSqueeze(on) {
    sfx.unlockAudio()
    this.input.squeeze = on
    if (on && this.phase === 'ready') {
      this.phase = 'playing'
      this.monkeyX = this.input.targetX // 開局直接跳到手指位置，避免滑行途中掉出盤子
    }
  }

  finish() {
    if (this.phase !== 'playing') return
    this.end(true, '收工！')
  }

  end(success, reason) {
    this.phase = 'over'
    sfx.setSqueezing(false)
    const cm = this.top * CM_PER_UNIT
    const stars = success ? STAR_CM.filter((t) => cm >= t).length : 0
    let best = 0
    try {
      best = Number(localStorage.getItem('monkey-poop-best') || 0)
    } catch {
      /* 無痕模式等情況讀不到就算了 */
    }
    const newBest = success && cm > best
    if (newBest) {
      try {
        localStorage.setItem('monkey-poop-best', cm.toFixed(1))
      } catch {
        /* 寫不進去就不記錄 */
      }
    }
    this.result = { success, reason, cm, stars, best: newBest ? cm : best, newBest }
    if (success) sfx.playWin(stars)
    else {
      sfx.playFail()
      const a = Math.random() * Math.PI * 2
      this.fallAnim = { t: 0, dir: new THREE.Vector2(Math.cos(a), Math.sin(a)) }
    }
    this.emit(true)
  }

  // 計算新便便在盤子座標系 (x,z) 落下後的高度
  landingY(x, z, r) {
    let y = r * 0.75
    let top = false
    const skip = 6 // 剛擠出的同一條便便不算支撐
    const n = this.blobs.length - skip
    for (let i = 0; i < n; i++) {
      const b = this.blobs[i]
      const dx = b.x - x
      const dz = b.z - z
      const c = (b.r + r) * 0.72
      const d2 = dx * dx + dz * dz
      if (d2 < c * c) {
        const yy = b.y + Math.sqrt(c * c - d2)
        if (yy > y) {
          y = yy
          top = true
        }
      }
    }
    return { y, supported: top }
  }

  dropBlob(worldX) {
    if (this.blobs.length >= MAX_BLOBS) return
    const r = 0.19 + Math.random() * 0.04
    // 世界座標 → 盤子座標（盤子繞 y 軸旋轉）
    const jitter = 0.03
    const wx = worldX + (Math.random() - 0.5) * jitter + this.wind * 0.35
    const wz = (Math.random() - 0.5) * jitter
    const a = -this.dishAngle
    const lx = wx * Math.cos(a) + wz * Math.sin(a)
    const lz = -wx * Math.sin(a) + wz * Math.cos(a)
    let x = lx, z = lz
    let l = this.landingY(x, z, r)
    // 坍塌：周圍落差超過安息角就往低處滾。落點在盤面上移動越快（拉成條）越立得住，原地噴會糊成一攤
    const v = this.spin * Math.hypot(lx, lz)
    const repose = THREE.MathUtils.lerp(this.repose[0], this.repose[1], THREE.MathUtils.clamp(v / 0.6, 0, 1))
    const step = r * 1.5
    for (let iter = 0; iter < this.rollIters && l.supported; iter++) {
      let best = null
      const a0 = Math.random() * Math.PI * 2
      for (let k = 0; k < 6; k++) {
        const a = a0 + (k / 6) * Math.PI * 2
        const nx = x + Math.cos(a) * step, nz = z + Math.sin(a) * step
        if (Math.hypot(nx, nz) > DISH_R - r * 0.5) continue // 盤緣擋住，滾不出去
        const s = this.landingY(nx, nz, r)
        if (!best || s.y < best.y) best = { ...s, x: nx, z: nz }
      }
      if (!best || l.y - best.y < step * repose) break
      x = best.x
      z = best.z
      l = best
    }
    const { y, supported } = l
    const dist = Math.hypot(x, z)
    const b = { x, z, y, r, born: this.time }
    if (!supported && dist > DISH_R - r * 0.3) {
      // 掉出盤子
      this.addBlobInstance(b, this.blobs.length)
      this.blobs.push(b)
      b.y = -0.1
      this.end(false, '便便掉出盤子了！')
      return
    }
    this.addBlobInstance(b, this.blobs.length)
    this.blobs.push(b)
    this.top = Math.max(this.top, y + r * 0.8)
    this.lastLandY = y
  }

  addBlobInstance(b, i) {
    this.tmpQ.setFromEuler(new THREE.Euler(Math.random(), Math.random(), Math.random()))
    this.tmpM.compose(new THREE.Vector3(b.x, b.y, b.z), this.tmpQ, new THREE.Vector3(b.r, b.r * 0.8, b.r))
    this.blobMesh.setMatrixAt(i, this.tmpM)
    const l = 0.24 + Math.random() * 0.07
    this.tmpC.setHSL(0.07, 0.55, l)
    this.blobMesh.setColorAt(i, this.tmpC)
    this.blobMesh.count = i + 1
    this.blobMesh.instanceMatrix.needsUpdate = true
    if (this.blobMesh.instanceColor) this.blobMesh.instanceColor.needsUpdate = true
  }

  spawnBanana() {
    const golden = Math.random() < 0.18
    const mesh = createBanana(golden)
    let x
    do x = (Math.random() * 2 - 1) * (MONKEY_X_RANGE - 0.2)
    while (Math.abs(x - this.monkeyX) < 1.0)
    this.scene.add(mesh)
    this.bananas.push({ mesh, x, life: 5, golden })
  }

  update(dt) {
    this.time += dt
    const playing = this.phase === 'playing' || this.phase === 'ready'
    this.spin = 1.5 + Math.min(this.top * 0.25, 1.6)
    if (this.phase !== 'over') this.dishAngle += this.spin * dt
    this.dish.rotation.y = this.dishAngle

    // 猴子移動
    const prevX = this.monkeyX
    this.monkeyX += (this.input.targetX - this.monkeyX) * Math.min(1, dt * 6)
    const monkeyY = Math.max(this.top + 1.4, 2.0)
    const m = this.monkey
    m.root.position.x = this.monkeyX
    m.root.position.y += (monkeyY - m.root.position.y) * Math.min(1, dt * 3)
    m.root.rotation.z = THREE.MathUtils.clamp((this.monkeyX - prevX) * -3, -0.3, 0.3)
    this.branch.position.set(0, m.root.position.y + 2.0, 0)

    let squeezing = false
    if (this.phase === 'playing') {
      // 憋不住機制
      if (this.input.squeeze && this.belly > 0) {
        this.holdTime = Math.max(0, this.holdTime - dt * 3)
        squeezing = true
      } else if (!this.input.squeeze) {
        this.holdTime += dt
        if (this.holdTime >= HOLD_LIMIT) {
          this.phase = 'dumping'
          this.dumpTime = 0.6
          this.holdTime = 0
          sfx.playFart()
        }
      }
    }
    if (this.phase === 'dumping') {
      squeezing = this.belly > 0
      this.dumpTime -= dt
      if (this.dumpTime <= 0) this.phase = 'playing'
    }

    if (squeezing) {
      this.blobAcc += dt
      while (this.blobAcc >= BLOB_INTERVAL && this.phase !== 'over') {
        this.blobAcc -= BLOB_INTERVAL
        this.dropBlob(this.monkeyX)
        this.belly = Math.max(0, this.belly - BELLY_PER_BLOB)
      }
      if (this.belly <= 0 && this.phase !== 'over') this.end(true, '肚子清空了！')
    }
    sfx.setSqueezing(squeezing && this.phase !== 'over')

    // 側風事件
    if (this.phase === 'playing' && this.top > 1.2) {
      if (this.windLeft > 0) {
        this.windLeft -= dt
        if (this.windLeft <= 0) this.wind = 0
      } else {
        this.windTimer -= dt
        if (this.windTimer <= 0) {
          this.wind = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5)
          this.windLeft = 2.5
          this.windTimer = 7 + Math.random() * 6
        }
      }
    }
    this.windArrow.visible = this.wind !== 0 && this.phase !== 'over'
    if (this.windArrow.visible) {
      this.windArrow.position.set(-this.wind * 2.2 + Math.sin(this.time * 8) * 0.1, m.root.position.y - 0.5, 0.5)
      this.windArrow.rotation.z = this.wind > 0 ? -Math.PI / 2 : Math.PI / 2
    }

    // 香蕉
    if (this.phase === 'playing') {
      this.bananaTimer -= dt
      if (this.bananaTimer <= 0) {
        this.spawnBanana()
        this.bananaTimer = 6 + Math.random() * 4
      }
    }
    for (const b of [...this.bananas]) {
      b.life -= dt
      b.mesh.position.set(b.x, m.root.position.y + 0.9 + Math.sin(this.time * 3 + b.x) * 0.1, 0.2)
      b.mesh.rotation.y += dt * 3
      const s = Math.min(1, b.life * 2, (5 - b.life) * 4)
      b.mesh.scale.setScalar(Math.max(0.01, s) * (b.golden ? 1.3 : 1))
      const eaten = this.phase !== 'over' && Math.abs(b.x - this.monkeyX) < 0.4
      if (eaten) {
        this.belly = Math.min(100, this.belly + (b.golden ? 35 : 15))
        sfx.playBanana(b.golden)
        this.chew = 0.5
      }
      if (eaten || b.life <= 0) {
        this.scene.remove(b.mesh)
        this.bananas.splice(this.bananas.indexOf(b), 1)
      }
    }

    // 猴子表情 & 擠壓動作
    const strain = this.holdTime / HOLD_LIMIT
    const sq = squeezing ? 1 : 0
    m.body.scale.set(1 + sq * 0.04 * Math.sin(this.time * 30), 1 - sq * 0.06, 1)
    m.body.position.x = strain > 0.5 ? Math.sin(this.time * 60) * 0.03 * strain : 0
    for (const e of m.eyes) e.scale.y = squeezing ? 0.25 : 1
    m.cheeks.opacity = Math.max(sq * 0.6, strain * 0.9)
    this.chew = Math.max(0, (this.chew || 0) - dt)
    m.mouth.scale.y = this.chew > 0 ? 0.4 + Math.abs(Math.sin(this.time * 25)) * 0.8 : squeezing ? 0.2 : 0.4

    // 便便流
    this.stream.visible = squeezing && this.phase !== 'over'
    if (this.stream.visible) {
      const from = m.root.position.y
      const to = (this.lastLandY ?? 0) + 0.1
      const h = Math.max(0.05, from - to)
      this.stream.position.set(this.monkeyX + this.wind * 0.17, to + h / 2, 0)
      this.stream.scale.set(1, h, 1)
      this.stream.rotation.z = this.wind * 0.15
    }

    // 失敗時整坨倒下
    if (this.fallAnim) {
      const f = this.fallAnim
      f.t = Math.min(1, f.t + dt * 1.2)
      const e = f.t * f.t
      this.stack.rotation.z = -f.dir.x * e * 1.5
      this.stack.rotation.x = f.dir.y * e * 1.5
    }

    // 蒼蠅
    const flyCount = Math.min(6, Math.floor(this.top / 0.7))
    this.flies.forEach((f, i) => {
      f.visible = i < flyCount
      const a = this.time * (2 + i * 0.4) + i * 1.7
      f.position.set(Math.cos(a) * (0.6 + i * 0.12), this.top + 0.3 + Math.sin(a * 2.3) * 0.25, Math.sin(a) * (0.6 + i * 0.12))
    })

    // 相機跟隨
    const targetCam = Math.max(1.2, this.top * 0.7 + 0.8)
    this.camY += (targetCam - this.camY) * Math.min(1, dt * 2)
    const portrait = this.camera.aspect < 1
    const dist = (portrait ? 11 : 8) + this.top * 0.6
    this.camera.position.set(0, this.camY + 2.2, dist)
    this.camera.lookAt(0, this.camY, 0)
    this.sun.position.set(4, this.camY + 10, 6)
    this.sun.target.position.set(0, this.camY, 0)

    if (playing || this.phase === 'dumping') this.emitThrottled(dt)
  }

  emitThrottled(dt) {
    this.emitAcc = (this.emitAcc || 0) + dt
    if (this.emitAcc > 0.08) {
      this.emitAcc = 0
      this.emit()
    }
  }

  emit() {
    this.onState({
      phase: this.phase,
      cm: this.top * CM_PER_UNIT,
      belly: this.belly,
      hold: this.phase === 'playing' && !this.input.squeeze ? this.holdTime / HOLD_LIMIT : 0,
      wind: this.wind,
      result: this.result,
    })
  }

  resize() {
    const c = this.renderer.domElement
    const w = c.clientWidth, h = c.clientHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  loop() {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.update(dt)
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.resize)
    sfx.setSqueezing(false)
    this.renderer.dispose()
  }
}

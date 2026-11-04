import * as THREE from 'three'
import {
  createMonkey,
  createBanana,
  createChili,
  createMagnet,
  createMushroom,
  createLifebuoy,
  createBomb,
  createScenery,
  createDish,
} from './models.js'
import * as sfx from './audio.js'
import { FxPool } from './fx.js'

const DISH_R = 1.7
const MAX_BLOBS = 5000
const BLOB_INTERVAL = 0.035 // 秒／顆
const BELLY_PER_BLOB = 100 / 520
const HOLD_LIMIT = 2 // 放開後最多憋幾秒
const MONKEY_X_RANGE = 2.8
const COMBO_WINDOW = 3.5 // 幾秒內連吃算連擊
export const COMBO_FOR_FEVER = 4
const FEVER_TIME = 5
const CHILI_WARN = 0.5 // 吃到辣椒後幾秒開始狂噴
const CHILI_TIME = 3
const ROCKET_H = 3 // 辣椒火箭往上衝多高
const PARTICLES = 400
const MAGNET_TIME = 6
const MUSHROOM_TIME = 5
const NET_TIME = 8
const BOMB_CUT = 1.2 // 炸彈炸掉塔頂多高
const isFood = (k) => k === 'banana' || k === 'golden'
// 道具出現權重：[種類, 權重, 塔至少要多高才出現]
const ITEM_TABLE = [
  ['banana', 45, 0],
  ['golden', 10, 0],
  ['chili', 18, 0.8],
  ['magnet', 7, 0],
  ['mushroom', 7, 0],
  ['net', 6, 0.8],
  ['bomb', 7, 1.5],
]
const ITEM_MESH = {
  banana: () => createBanana(false),
  golden: () => createBanana(true),
  chili: createChili,
  magnet: createMagnet,
  mushroom: createMushroom,
  net: createLifebuoy,
  bomb: createBomb,
}
const CM_PER_UNIT = 10
export const STAR_CM = [25, 55, 100]

const rnd = (k) => (Math.random() - 0.5) * k

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

    // 辣椒火箭的噴濺粒子
    this.parts = []
    this.partMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#7a4a22', roughness: 0.4 }),
      PARTICLES,
    )
    this.partMesh.count = 0
    this.partMesh.frustumCulled = false
    scene.add(this.partMesh)

    // 火箭火焰（疊加發光）與煙霧尾跡
    this.flame = new FxPool(scene, {
      max: 300,
      material: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      gravity: 3,
      drag: 2,
      colors: [new THREE.Color('#fff3a0'), new THREE.Color('#ff3a00')],
    })
    this.smoke = new FxPool(scene, {
      max: 200,
      material: new THREE.MeshStandardMaterial({ color: '#9b9b9b', transparent: true, opacity: 0.45, depthWrite: false, roughness: 1 }),
      gravity: 1.2,
      drag: 1.5,
      grow: 3,
    })
    this.fireLight = new THREE.PointLight('#ff7a1a', 0, 6)
    scene.add(this.fireLight)

    // 救生網：盤子外圍的一圈網
    this.netMesh = new THREE.Mesh(
      new THREE.TorusGeometry(DISH_R + 0.9, 0.9, 6, 48),
      new THREE.MeshBasicMaterial({ color: '#7fd3ff', transparent: true, opacity: 0.35, wireframe: true }),
    )
    this.netMesh.rotation.x = Math.PI / 2
    this.netMesh.scale.z = 0.08
    this.netMesh.visible = false
    scene.add(this.netMesh)

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
    this.bananaTimer = 2.5
    this.combo = 0
    this.lastEat = -99
    this.fever = 0
    this.chiliWarn = 0
    this.rocket = 0
    this.lift = 0
    this.parts = []
    this.partMesh.count = 0
    this.flame.clear()
    this.smoke.clear()
    this.magnet = 0
    this.mushroom = 0
    this.net = 0
    this.boom = 0
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
    const r = (0.19 + Math.random() * 0.04) * (this.mushroom > 0 ? 1.6 : 1)
    // 世界座標 → 盤子座標（盤子繞 y 軸旋轉）
    const jitter = this.rocket > 0 ? 0.08 : 0.03
    const wx = worldX + (Math.random() - 0.5) * jitter + this.wind * 0.35
    const wz = (Math.random() - 0.5) * jitter
    const a = -this.dishAngle
    const lx = wx * Math.cos(a) + wz * Math.sin(a)
    const lz = -wx * Math.sin(a) + wz * Math.cos(a)
    let x = lx, z = lz
    let l = this.landingY(x, z, r)
    // 坍塌：周圍落差超過安息角就往低處滾。落點在盤面上移動越快（拉成條）越立得住，原地噴會糊成一攤
    const v = this.spin * Math.hypot(lx, lz)
    let repose = THREE.MathUtils.lerp(this.repose[0], this.repose[1], THREE.MathUtils.clamp(v / 0.6, 0, 1))
    if (this.fever > 0) repose = this.repose[1] // 狂熱：怎麼擠都立得住
    if (this.rocket > 0) repose = this.repose[1] * 1.3 // 火箭噴射流又急又硬，直接把塔往上頂
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
    if (!supported && dist > DISH_R - r * 0.3 && this.net > 0) {
      // 救生網接住：不算失敗，便便直接被網子收走
      this.spawnPart(worldX, 0.1, 0, rnd(2), 1 + Math.random() * 2, rnd(2))
      return
    }
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
    if (!b.col) {
      // 記下顏色，炸彈重建塔時沿用
      const l = 0.24 + Math.random() * 0.07
      if (this.fever > 0) b.col = [0.13, 0.9, l + 0.25]
      else if (this.rocket > 0) b.col = [0.04, 0.6, l + 0.05]
      else b.col = [0.07, 0.55, l]
    }
    this.tmpC.setHSL(...b.col)
    this.blobMesh.setColorAt(i, this.tmpC)
    this.blobMesh.count = i + 1
    this.blobMesh.instanceMatrix.needsUpdate = true
    if (this.blobMesh.instanceColor) this.blobMesh.instanceColor.needsUpdate = true
  }

  spawnItem() {
    // 依權重抽道具；辣椒、救生網、炸彈要塔有一點高度才會出現
    const table = ITEM_TABLE.filter(([, , minTop]) => this.top >= minTop)
    let roll = Math.random() * table.reduce((s, [, w]) => s + w, 0)
    const kind = table.find(([, w]) => (roll -= w) < 0)[0]
    const mesh = ITEM_MESH[kind]()
    let x, tries = 0
    const guard = this.bananas.find((b) => isFood(b.kind))
    if (kind === 'chili' && guard && Math.random() < 0.5) {
      // 一半機率貼在香蕉旁邊，要從另一側繞過去吃
      x = guard.x + (Math.random() < 0.5 ? -0.55 : 0.55)
      if (Math.abs(x) > MONKEY_X_RANGE - 0.1) x = guard.x - Math.sign(x) * 0.55
    } else {
      do x = (Math.random() * 2 - 1) * (MONKEY_X_RANGE - 0.2)
      while (tries++ < 20 && (Math.abs(x - this.monkeyX) < 1.0 || this.bananas.some((b) => Math.abs(b.x - x) < 0.6)))
    }
    this.scene.add(mesh)
    this.bananas.push({ mesh, x, life: 5, kind, golden: kind === 'golden' })
  }

  eat(b) {
    this.chew = 0.5
    if (b.kind === 'chili') {
      this.combo = 0
      this.chiliWarn = CHILI_WARN
      sfx.playRumble()
      return
    }
    if (b.kind === 'bomb') {
      this.explode()
      return
    }
    if (!isFood(b.kind)) {
      if (b.kind === 'magnet') this.magnet = MAGNET_TIME
      if (b.kind === 'mushroom') this.mushroom = MUSHROOM_TIME
      if (b.kind === 'net') this.net = NET_TIME
      sfx.playPowerup()
      return
    }
    this.belly = Math.min(100, this.belly + (b.golden ? 20 : 8))
    sfx.playBanana(b.golden)
    this.combo = this.time - this.lastEat < COMBO_WINDOW ? this.combo + 1 : 1
    this.lastEat = this.time
    if (this.combo >= COMBO_FOR_FEVER) {
      this.combo = 0
      this.fever = FEVER_TIME
      sfx.playFever()
    }
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
    this.monkeyBaseY = (this.monkeyBaseY ?? monkeyY) + (monkeyY - (this.monkeyBaseY ?? monkeyY)) * Math.min(1, dt * 3)
    // 辣椒火箭：前 20% 衝上去、中間懸停、最後 30% 滑回樹枝
    if (this.rocket > 0) {
      const t = 1 - this.rocket / CHILI_TIME
      const up = 1 - Math.pow(1 - Math.min(1, t / 0.2), 3)
      const down = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1
      this.lift = ROCKET_H * up * down
    } else {
      this.lift = Math.max(0, this.lift - dt * 4)
    }
    m.root.position.x = this.monkeyX
    m.root.position.y = this.monkeyBaseY + this.lift
    m.root.rotation.z =
      THREE.MathUtils.clamp((this.monkeyX - prevX) * -3, -0.3, 0.3) + (this.rocket > 0 ? Math.sin(this.time * 40) * 0.12 : 0)
    this.branch.position.set(0, this.monkeyBaseY + 2.0, 0)

    // 狂熱 / 辣椒計時
    const active = this.phase === 'playing' || this.phase === 'dumping'
    if (active) {
      this.fever = Math.max(0, this.fever - dt)
      this.rocket = Math.max(0, this.rocket - dt)
      this.magnet = Math.max(0, this.magnet - dt)
      this.mushroom = Math.max(0, this.mushroom - dt)
      this.net = Math.max(0, this.net - dt)
      if (this.chiliWarn > 0) {
        this.chiliWarn -= dt
        if (this.chiliWarn <= 0) {
          this.chiliWarn = 0
          this.rocket = CHILI_TIME
          this.holdTime = 0
          sfx.playRocket()
          this.burst(60)
        }
      }
    }

    let squeezing = false
    if (this.phase === 'playing' && this.rocket > 0) {
      squeezing = this.belly > 0 // 火箭：不管有沒有按都在噴
    } else if (this.phase === 'playing') {
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
      const interval = this.rocket > 0 ? BLOB_INTERVAL / 2.5 : BLOB_INTERVAL
      while (this.blobAcc >= interval && this.phase !== 'over') {
        this.blobAcc -= interval
        this.dropBlob(this.monkeyX)
        const cost = this.rocket > 0 ? BELLY_PER_BLOB * 0.5 : BELLY_PER_BLOB
        if (this.fever <= 0) this.belly = Math.max(0, this.belly - cost)
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
      this.windArrow.position.set(-this.wind * 2.2 + Math.sin(this.time * 8) * 0.1, this.monkeyBaseY - 0.5, 0.5)
      this.windArrow.rotation.z = this.wind > 0 ? -Math.PI / 2 : Math.PI / 2
    }

    // 香蕉
    if (this.phase === 'playing') {
      this.bananaTimer -= dt
      if (this.bananaTimer <= 0) {
        this.spawnItem()
        this.bananaTimer = 1.8 + Math.random() * 1.2
      }
    }
    for (const b of [...this.bananas]) {
      b.life -= dt
      // 磁鐵：香蕉自己飛過來
      if (this.magnet > 0 && isFood(b.kind)) b.x += (this.monkeyX - b.x) * Math.min(1, dt * 3)
      b.mesh.position.set(b.x, this.monkeyBaseY + 0.9 + Math.sin(this.time * 3 + b.x) * 0.1, 0.2)
      b.mesh.rotation.y += dt * 3
      const s = Math.min(1, b.life * 2, (5 - b.life) * 4)
      b.mesh.scale.setScalar(Math.max(0.01, s) * (b.golden ? 1.3 : 1))
      const eaten = this.phase !== 'over' && Math.abs(b.x - this.monkeyX) < 0.4
      if (eaten) this.eat(b)
      if (eaten || b.life <= 0) {
        this.scene.remove(b.mesh)
        this.bananas.splice(this.bananas.indexOf(b), 1)
      }
    }

    // 猴子表情 & 擠壓動作
    const strain = this.chiliWarn > 0 || this.rocket > 0 ? 1 : this.holdTime / HOLD_LIMIT
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
      this.stream.material.color.set(this.fever > 0 ? '#f5c518' : this.rocket > 0 ? '#8a3c14' : '#6b3e1f')
      const from = m.root.position.y
      const to = (this.lastLandY ?? 0) + 0.1
      const h = Math.max(0.05, from - to)
      const thick = this.rocket > 0 ? 2 + Math.sin(this.time * 50) * 0.3 : 1
      this.stream.position.set(this.monkeyX + this.wind * 0.17, to + h / 2, 0)
      this.stream.scale.set(thick, h, thick)
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

    // 火箭噴濺：屁股往下噴、塔頂往上濺
    if (this.rocket > 0 && this.phase !== 'over') {
      const bx = this.monkeyX, by = m.root.position.y, ty = this.lastLandY ?? 0
      for (let i = 0; i < 5; i++) this.spawnPart(bx, by, 0, rnd(1.2), -4 - Math.random() * 3, rnd(1.2))
      for (let i = 0; i < 4; i++) this.spawnPart(bx, ty + 0.2, 0, rnd(3), 2 + Math.random() * 4, rnd(3))
      // 火焰從屁股往下噴，煙霧拖在後面慢慢飄散
      for (let i = 0; i < 7; i++)
        this.flame.spawn(bx + rnd(0.15), by - 0.05, rnd(0.15), rnd(1.2), -3 - Math.random() * 3, rnd(1.2), 0.2 + Math.random() * 0.2, 0.1 + Math.random() * 0.12)
      for (let i = 0; i < 2; i++)
        this.smoke.spawn(bx + rnd(0.2), by - 0.2, rnd(0.2) - 0.2, rnd(0.8), -1.5 - Math.random(), rnd(0.8) - 0.3, 1.2 + Math.random() * 0.6, 0.12 + Math.random() * 0.08)
    } else if (this.chiliWarn > 0 && this.phase !== 'over' && Math.random() < 0.4) {
      // 快點火了：屁股冒煙
      const mp = m.root.position
      this.smoke.spawn(mp.x + rnd(0.1), mp.y, -0.1, rnd(0.5), -0.5, rnd(0.3), 0.8, 0.08)
    }
    this.updateParts(dt)
    this.flame.update(dt)
    this.smoke.update(dt)
    // 救生網：最後 1.5 秒閃爍提醒快沒了
    this.netMesh.visible = this.net > 0 && this.phase !== 'over' && (this.net > 1.5 || Math.sin(this.time * 20) > 0)
    this.netMesh.rotation.z += dt * 0.5
    this.boom = Math.max(0, this.boom - dt)
    // 火光照亮猴子跟塔
    const fire = this.rocket > 0 && this.phase !== 'over'
    this.fireLight.intensity = fire ? 8 + Math.random() * 6 : 0
    if (fire) this.fireLight.position.set(this.monkeyX, m.root.position.y - 0.4, 0.4)

    // 相機跟隨（火箭時往上帶一點）
    const targetCam = Math.max(1.2, this.top * 0.7 + 0.8) + this.lift * 0.9
    this.camY += (targetCam - this.camY) * Math.min(1, dt * 2)
    const portrait = this.camera.aspect < 1
    const dist = (portrait ? 11 : 8) + this.top * 0.6 + this.lift * 0.8
    const shake = this.boom > 1 ? 0.5 * (this.boom - 1) * 2 : this.rocket > 0 ? 0.15 : this.chiliWarn > 0 ? 0.05 : 0
    this.camera.position.set((Math.random() - 0.5) * shake, this.camY + 2.2 + (Math.random() - 0.5) * shake, dist)
    this.camera.lookAt(0, this.camY, 0)
    this.sun.position.set(4, this.camY + 10, 6)
    this.sun.target.position.set(0, this.camY, 0)

    if (playing || this.phase === 'dumping') this.emitThrottled(dt)
  }

  spawnPart(x, y, z, vx, vy, vz) {
    if (this.parts.length >= PARTICLES) this.parts.shift()
    this.parts.push({ x, y, z, vx, vy, vz, life: 1, r: 0.05 + Math.random() * 0.07 })
  }

  burst(n) {
    const m = this.monkey.root.position
    for (let i = 0; i < n; i++) this.spawnPart(m.x, m.y, 0, rnd(5), -1 - Math.random() * 5, rnd(5))
    // 點火瞬間的火球 + 煙圈
    for (let i = 0; i < 40; i++) this.flame.spawn(m.x, m.y, 0, rnd(6), -Math.random() * 4, rnd(6), 0.3 + Math.random() * 0.2, 0.15 + Math.random() * 0.15)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      this.smoke.spawn(m.x, m.y - 0.1, 0, Math.cos(a) * 3, -0.5, Math.sin(a) * 3, 1.4, 0.15)
    }
  }

  // 炸彈：塔頂炸掉一截
  explode() {
    const oldTop = this.top
    const cut = Math.max(0, oldTop - BOMB_CUT)
    this.blobs = this.blobs.filter((b) => b.y < cut)
    this.blobs.forEach((b, i) => this.addBlobInstance(b, i))
    this.blobMesh.count = this.blobs.length
    this.top = this.blobs.reduce((t, b) => Math.max(t, b.y + b.r * 0.8), 0)
    this.lastLandY = this.top
    for (let i = 0; i < 60; i++) this.spawnPart(rnd(0.6), oldTop - 0.5, rnd(0.6), rnd(8), 1 + Math.random() * 6, rnd(8))
    for (let i = 0; i < 50; i++) this.flame.spawn(rnd(0.5), oldTop - 0.5, rnd(0.5), rnd(7), rnd(7), rnd(7), 0.3 + Math.random() * 0.3, 0.2 + Math.random() * 0.2)
    for (let i = 0; i < 25; i++) this.smoke.spawn(rnd(0.8), oldTop - 0.5, rnd(0.8), rnd(3), Math.random() * 2, rnd(3), 1.5, 0.2)
    this.boom = 1.5 // 前 0.5 秒震動，提示顯示 1.5 秒
    sfx.playBomb()
  }

  updateParts(dt) {
    const floor = -0.1
    this.parts = this.parts.filter((p) => (p.life -= dt * 0.9) > 0)
    this.parts.forEach((p, i) => {
      p.vy -= 12 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      if (p.y < floor) {
        p.y = floor
        p.vy *= -0.3
        p.vx *= 0.6
        p.vz *= 0.6
      }
      const s = p.r * Math.min(1, p.life * 3)
      this.tmpM.compose(new THREE.Vector3(p.x, p.y, p.z), this.tmpQ.identity(), new THREE.Vector3(s, s, s))
      this.partMesh.setMatrixAt(i, this.tmpM)
    })
    this.partMesh.count = this.parts.length
    this.partMesh.instanceMatrix.needsUpdate = true
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
      combo: this.time - this.lastEat < COMBO_WINDOW ? this.combo : 0,
      fever: this.fever,
      chiliWarn: this.chiliWarn,
      rocket: this.rocket,
      magnet: this.magnet,
      mushroom: this.mushroom,
      net: this.net,
      boom: this.boom,
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

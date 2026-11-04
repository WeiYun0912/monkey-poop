import * as THREE from 'three'

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts })

function ball(r, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), material)
  m.position.set(x, y, z)
  m.scale.set(sx, sy, sz)
  m.castShadow = true
  return m
}

// 猴子：原點在屁股（出口），手抓在上方 y≈2 的樹枝
export function createMonkey() {
  const fur = mat('#8b5a2b')
  const skin = mat('#f1c99a')
  const pink = mat('#f08a9a')
  const black = mat('#1a1a1a', { roughness: 0.2 })
  const white = mat('#ffffff', { roughness: 0.2 })

  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)

  body.add(ball(0.45, fur, 0, 0.45, 0, 1, 1.15, 0.9))
  body.add(ball(0.3, skin, 0, 0.42, 0.26, 1, 1.1, 0.6))
  body.add(ball(0.1, pink, -0.12, 0.05, -0.05))
  body.add(ball(0.1, pink, 0.12, 0.05, -0.05))
  // 腿
  body.add(ball(0.16, fur, -0.32, 0.12, 0.18, 1, 0.8, 1.2))
  body.add(ball(0.16, fur, 0.32, 0.12, 0.18, 1, 0.8, 1.2))

  const head = new THREE.Group()
  head.position.set(0, 1.15, 0)
  body.add(head)
  head.add(ball(0.38, fur))
  head.add(ball(0.28, skin, 0, -0.05, 0.22, 1.15, 0.85, 0.7))
  head.add(ball(0.13, fur, -0.38, 0.05, 0))
  head.add(ball(0.13, fur, 0.38, 0.05, 0))
  head.add(ball(0.08, skin, -0.4, 0.05, 0.05))
  head.add(ball(0.08, skin, 0.4, 0.05, 0.05))
  const eyes = []
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group()
    eye.position.set(sx * 0.11, 0.06, 0.38)
    eye.add(ball(0.06, white))
    eye.add(ball(0.035, black, 0, 0, 0.035))
    head.add(eye)
    eyes.push(eye)
  }
  head.add(ball(0.03, black, -0.04, -0.06, 0.45))
  head.add(ball(0.03, black, 0.04, -0.06, 0.45))
  const mouth = ball(0.07, mat('#6b1f1f'), 0, -0.17, 0.4, 1.4, 0.4, 0.5)
  head.add(mouth)
  const cheeks = mat('#ff6b6b', { transparent: true, opacity: 0 })
  head.add(ball(0.07, cheeks, -0.2, -0.08, 0.36, 1, 0.6, 0.5))
  head.add(ball(0.07, cheeks, 0.2, -0.08, 0.36, 1, 0.6, 0.5))

  // 手臂往上抓樹枝
  const armGeo = new THREE.CylinderGeometry(0.08, 0.09, 1.2, 12)
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, fur)
    arm.position.set(sx * 0.42, 1.45, 0)
    arm.rotation.z = sx * 0.15
    arm.castShadow = true
    body.add(arm)
    body.add(ball(0.11, skin, sx * 0.5, 2.03, 0))
  }

  // 捲尾巴
  const pts = []
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    const a = t * Math.PI * 3
    const r = 0.5 * (1 - t * 0.7)
    pts.push(new THREE.Vector3(Math.sin(a) * r * 0.6 + t * 0.5, 0.3 + t * 0.8 + Math.cos(a) * r * 0.4, -0.4 - t * 0.3))
  }
  const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.05, 8), fur)
  body.add(tail)

  return { root, body, head, eyes, mouth, cheeks }
}

export function createBanana(golden) {
  const pts = []
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20 - 0.5) * 1.6
    pts.push(new THREE.Vector3(Math.sin(a) * 0.35, -Math.cos(a) * 0.35 + 0.35, 0))
  }
  const color = golden ? '#ffcc00' : '#f7e04a'
  const m = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.08, 10),
    mat(color, golden ? { emissive: '#aa7700', emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.3 } : {}),
  )
  m.castShadow = true
  const g = new THREE.Group()
  g.add(m)
  return g
}

export function createScenery(scene) {
  // 桌子 + 盤子
  const table = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.3, 48), mat('#b07a4a'))
  table.position.y = -0.25
  table.receiveShadow = true
  scene.add(table)
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 6, 16), mat('#8a5a33'))
  leg.position.y = -3.4
  scene.add(leg)

  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), mat('#7bb661'))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -6.4
  ground.receiveShadow = true
  scene.add(ground)

  // 叢林背景的簡單樹
  const trunkMat = mat('#6b4423')
  const leafMats = [mat('#3e8e41'), mat('#2f7a36'), mat('#56a548')]
  const rand = mulberry(7)
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI - Math.PI
    const d = 12 + rand() * 18
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d - 4
    const h = 6 + rand() * 8
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, h, 8), trunkMat)
    trunk.position.set(x, -6.4 + h / 2, z)
    scene.add(trunk)
    for (let k = 0; k < 3; k++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + rand() * 1.4, 0), leafMats[k % 3])
      leaf.position.set(x + (rand() - 0.5) * 2, -6.4 + h + (rand() - 0.3) * 1.5, z + (rand() - 0.5) * 2)
      scene.add(leaf)
    }
  }
}

export function createDish(radius) {
  const g = new THREE.Group()
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.8, 0.1, 64),
    mat('#ffffff', { roughness: 0.25 }),
  )
  plate.position.y = -0.05
  plate.receiveShadow = true
  plate.castShadow = true
  g.add(plate)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.05, 8, 64), mat('#4fa3d9', { roughness: 0.3 }))
  rim.rotation.x = Math.PI / 2
  g.add(rim)
  // 盤面花紋讓旋轉看得出來
  for (let i = 0; i < 8; i++) {
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), mat('#4fa3d9'))
    const a = (i / 8) * Math.PI * 2
    dot.rotation.x = -Math.PI / 2
    dot.position.set(Math.cos(a) * radius * 0.88, 0.005, Math.sin(a) * radius * 0.88)
    g.add(dot)
  }
  return g
}

export function mulberry(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

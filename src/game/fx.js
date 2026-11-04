import * as THREE from 'three'

// 火焰、煙霧用的簡單粒子池（InstancedMesh，一個 draw call）
export class FxPool {
  constructor(scene, { max, material, gravity = 0, drag = 0, grow = 0, colors = null }) {
    this.max = max
    this.gravity = gravity
    this.drag = drag
    this.grow = grow
    this.colors = colors // [起始色, 結束色]，依壽命漸變
    this.list = []
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), material, max)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    scene.add(this.mesh)
    this.m = new THREE.Matrix4()
    this.q = new THREE.Quaternion()
    this.v = new THREE.Vector3()
    this.s = new THREE.Vector3()
    this.c = new THREE.Color()
  }

  spawn(x, y, z, vx, vy, vz, life, size) {
    if (this.list.length >= this.max) this.list.shift()
    this.list.push({ x, y, z, vx, vy, vz, life, maxLife: life, size })
  }

  update(dt) {
    this.list = this.list.filter((p) => (p.life -= dt) > 0)
    const k = Math.max(0, 1 - this.drag * dt)
    this.list.forEach((p, i) => {
      p.vy += this.gravity * dt
      p.vx *= k
      p.vy *= k
      p.vz *= k
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      const age = 1 - p.life / p.maxLife // 0 → 1
      // 先長大，最後 25% 縮小消失
      const s = p.size * (1 + this.grow * age) * Math.min(1, (1 - age) * 4)
      this.m.compose(this.v.set(p.x, p.y, p.z), this.q, this.s.set(s, s, s))
      this.mesh.setMatrixAt(i, this.m)
      if (this.colors) this.mesh.setColorAt(i, this.c.lerpColors(this.colors[0], this.colors[1], age))
    })
    this.mesh.count = this.list.length
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  clear() {
    this.list = []
    this.mesh.count = 0
  }
}

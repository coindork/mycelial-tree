import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { PositionedNode, GraphEdge, ConstellationConfig } from './types'

interface EdgeParticle {
  mesh: THREE.Mesh
  edgeData: { srcX: number; srcY: number; srcZ: number; tgtX: number; tgtY: number; tgtZ: number }
  progress: number
  speed: number
  active: boolean
}

export class MoleculeRenderer {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private webglRenderer: THREE.WebGLRenderer
  private css2dRenderer: CSS2DRenderer
  private composer: EffectComposer
  private controls: OrbitControls
  private clock: THREE.Clock

  // Text labels ARE the nodes — no spheres
  private labelElements: Map<string, HTMLDivElement> = new Map()
  private nodeHands: Map<string, string> = new Map()
  private connectedMap: Map<string, Set<string>> = new Map()

  // Emissive dots — tracked for breathing + dimming
  private dotMeshes: Map<string, THREE.Mesh> = new Map()
  private dotBaseScales: Map<string, number> = new Map()
  private nodePositions: Map<string, THREE.Vector3> = new Map()

  // Edge tracing
  private edgeGroups: Map<string, THREE.Line[]> = new Map() // nodeId → its edges
  private edgeTraceProgress: Map<string, number> = new Map() // nodeId → 0..1
  private allEdgeLines: THREE.Line[] = []

  // Edge particles
  private particles: EdgeParticle[] = []
  private particleMaterial: THREE.MeshBasicMaterial | null = null
  private particleGeo: THREE.SphereGeometry | null = null
  private lastParticleSpawn: number = 0
  private particleSpawnInterval: number = 0.4 // seconds between idle spawns

  // Cluster navigation
  private clusterCenters: Record<string, THREE.Vector3> = {}
  private activeCluster: string = ''
  private travelStart: THREE.Vector3 | null = null
  private travelEnd: THREE.Vector3 | null = null
  private travelTargetStart: THREE.Vector3 | null = null
  private travelTargetEnd: THREE.Vector3 | null = null
  private travelProgress: number = 1 // 1 = not traveling
  private travelDuration: number = 2.0 // seconds
  private travelStartTime: number = 0

  // Cluster membership per node (for bridge edge detection)
  private nodeClusterMap: Map<string, string> = new Map()

  // Ghost node tracking
  private ghostNodeIds: Set<string> = new Set()
  private ghostColor: number = 0
  private ghostColorBoth: number = 0
  private ghostSiteUrl: string = ''

  highlightedNodeId: string | null = null

  // Expose pulse value for sidebar sync
  currentPulse: number = 0

  // Callback when a node is clicked
  onNodeClick: ((nodeId: string) => void) | null = null

  private animationId: number | null = null

  constructor(private container: HTMLElement, private config: ConstellationConfig) {
    const rect = container.getBoundingClientRect()
    const w = rect.width
    const h = rect.height

    this.activeCluster = config.name

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a0a)

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 2000)
    this.camera.position.set(0, 0, 280)

    this.webglRenderer = new THREE.WebGLRenderer({ antialias: true })
    this.webglRenderer.setSize(w, h)
    this.webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.webglRenderer.toneMapping = THREE.ReinhardToneMapping
    container.appendChild(this.webglRenderer.domElement)

    this.css2dRenderer = new CSS2DRenderer()
    this.css2dRenderer.setSize(w, h)
    this.css2dRenderer.domElement.style.position = 'absolute'
    this.css2dRenderer.domElement.style.top = '0'
    this.css2dRenderer.domElement.style.left = '0'
    this.css2dRenderer.domElement.style.pointerEvents = 'none'
    container.appendChild(this.css2dRenderer.domElement)

    const renderPass = new RenderPass(this.scene, this.camera)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      config.bloom.strength,
      config.bloom.threshold,
      config.bloom.radius
    )

    // Guard against missing half-float support (iOS Safari, older Android)
    const hasHalfFloat = this.webglRenderer.extensions.has('EXT_color_buffer_half_float') ||
                         this.webglRenderer.extensions.has('EXT_color_buffer_float')
    if (!hasHalfFloat) {
      const fallbackType = THREE.UnsignedByteType
      bloomPass.renderTargetBright.texture.type = fallbackType
      bloomPass.renderTargetsHorizontal.forEach(rt => { rt.texture.type = fallbackType })
      bloomPass.renderTargetsVertical.forEach(rt => { rt.texture.type = fallbackType })
    }

    this.composer = new EffectComposer(this.webglRenderer)
    this.composer.addPass(renderPass)
    this.composer.addPass(bloomPass)
    this.composer.addPass(new OutputPass())

    this.controls = new OrbitControls(this.camera, this.webglRenderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.autoRotate = true
    this.controls.autoRotateSpeed = 0.5
    this.controls.enableZoom = false
    this.controls.enablePan = false

    this.scene.add(new THREE.AmbientLight(0x404040, 0.3))

    this.clock = new THREE.Clock()
    window.addEventListener('resize', () => this.resize())

    // Handle WebGL context loss (common on mobile)
    this.webglRenderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      console.warn('WebGL context lost')
      if (this.animationId !== null) {
        cancelAnimationFrame(this.animationId)
        this.animationId = null
      }
    })
    this.webglRenderer.domElement.addEventListener('webglcontextrestored', () => {
      console.info('WebGL context restored')
      this.start()
    })

    // Shared particle geometry + material
    this.particleGeo = new THREE.SphereGeometry(0.6, 8, 8)
    this.particleMaterial = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    })
  }

  private handColor(hand: string): number {
    if (hand === 'both') return this.config.colorBoth
    return this.config.color
  }

  private nodeColorForId(id: string): number {
    if (this.ghostNodeIds.has(id)) return this.ghostColor
    return this.config.color
  }

  private nodeColorBothForId(id: string): number {
    if (this.ghostNodeIds.has(id)) return this.ghostColorBoth
    return this.config.colorBoth
  }

  resize(): void {
    const rect = this.container.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.webglRenderer.setSize(w, h)
    this.css2dRenderer.setSize(w, h)
    this.composer.setSize(w, h)
  }

  private buildNodeVisuals(
    node: PositionedNode,
    isFeatured: boolean,
    color: number,
    colorHex: string
  ): void {
    // Emissive dot — larger for better bloom pickup
    const dotSize = isFeatured ? 3.5 : 2
    const dotGeo = new THREE.SphereGeometry(dotSize, 16, 16)
    const dotMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: isFeatured ? 1.2 : 0.8,
      roughness: 0.3,
      metalness: 0.1,
    })
    const dot = new THREE.Mesh(dotGeo, dotMat)
    dot.position.set(node.x, node.y, node.z)
    this.scene.add(dot)
    this.dotMeshes.set(node.id, dot)
    this.dotBaseScales.set(node.id, 1)
    this.nodePositions.set(node.id, new THREE.Vector3(node.x, node.y, node.z))

    // Text label — scaled by connectionCount
    const div = document.createElement('div')
    div.className = 'node-text'
    div.textContent = node.title
    div.dataset.nodeId = node.id

    const fontSize = isFeatured
      ? 20
      : Math.min(16, Math.max(9, 7 + node.connectionCount * 1.2))
    div.style.fontSize = `${fontSize}px`
    div.style.color = colorHex
    div.style.opacity = isFeatured ? '0.9' : '0.45'
    div.style.fontWeight = isFeatured ? '500' : '300'

    // Click opens essay, hover highlights connections
    div.addEventListener('click', () => {
      if (this.onNodeClick) this.onNodeClick(node.id)
    })
    div.addEventListener('mouseenter', () => {
      this.resetTrace(node.id)
      this.highlightedNodeId = node.id
    })
    div.addEventListener('mouseleave', () => {
      this.highlightedNodeId = null
    })

    const label = new CSS2DObject(div)
    label.position.set(node.x, node.y, node.z)
    this.scene.add(label)

    this.labelElements.set(node.id, div)
  }

  private buildEdgeVisuals(edges: GraphEdge[], nodes: PositionedNode[], getColor: (src: PositionedNode, tgt: PositionedNode) => { color: number; opacity: number }): void {
    for (const edge of edges) {
      const src = nodes.find(n => n.id === edge.source)
      const tgt = nodes.find(n => n.id === edge.target)
      if (!src || !tgt) continue

      const { color: edgeColor, opacity: edgeOpacity } = getColor(src, tgt)

      const geo = new THREE.BufferGeometry()
      const positions = new Float32Array(6)
      positions[0] = src.x; positions[1] = src.y; positions[2] = src.z
      positions[3] = src.x; positions[4] = src.y; positions[5] = src.z
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

      const mat = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: edgeOpacity,
      })
      const line = new THREE.Line(geo, mat)
      line.userData = {
        srcX: src.x, srcY: src.y, srcZ: src.z,
        tgtX: tgt.x, tgtY: tgt.y, tgtZ: tgt.z,
        sourceId: edge.source,
        targetId: edge.target,
      }
      this.scene.add(line)
      this.allEdgeLines.push(line)

      if (!this.edgeGroups.has(edge.source)) this.edgeGroups.set(edge.source, [])
      if (!this.edgeGroups.has(edge.target)) this.edgeGroups.set(edge.target, [])
      this.edgeGroups.get(edge.source)!.push(line)
      this.edgeGroups.get(edge.target)!.push(line)
    }

    // Set all edges to fully drawn by default
    for (const line of this.allEdgeLines) {
      const d = line.userData
      const pos = (line.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
      pos[3] = d.tgtX; pos[4] = d.tgtY; pos[5] = d.tgtZ
      ;(line.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    }
  }

  private computeClusterCentroids(nodes: PositionedNode[]): void {
    const clusterSums: Record<string, { x: number; y: number; z: number; count: number }> = {}
    for (const node of nodes) {
      if (!clusterSums[node.cluster]) {
        clusterSums[node.cluster] = { x: 0, y: 0, z: 0, count: 0 }
      }
      clusterSums[node.cluster].x += node.x
      clusterSums[node.cluster].y += node.y
      clusterSums[node.cluster].z += node.z
      clusterSums[node.cluster].count++
    }
    for (const [name, sum] of Object.entries(clusterSums)) {
      this.clusterCenters[name] = new THREE.Vector3(
        sum.x / sum.count,
        sum.y / sum.count,
        sum.z / sum.count,
      )
    }
  }

  buildScene(nodes: PositionedNode[], edges: GraphEdge[]): void {
    // Build adjacency map + cluster membership
    for (const node of nodes) {
      this.connectedMap.set(node.id, new Set())
      this.nodeHands.set(node.id, node.hand)
      this.nodeClusterMap.set(node.id, node.cluster)
    }
    for (const edge of edges) {
      this.connectedMap.get(edge.source)?.add(edge.target)
      this.connectedMap.get(edge.target)?.add(edge.source)
    }

    // Build node visuals
    for (const node of nodes) {
      const isFeatured = node.id === this.config.featuredNode
      const color = this.handColor(node.hand)
      const colorHex = '#' + color.toString(16).padStart(6, '0')
      this.buildNodeVisuals(node, isFeatured, color, colorHex)
    }

    // Build edge visuals
    this.buildEdgeVisuals(edges, nodes, (src) => ({
      color: this.handColor(src.hand),
      opacity: 0.08,
    }))

    this.computeClusterCentroids(nodes)
  }

  start(): void {
    const loop = () => {
      this.updateHighlight()
      this.updateBreathing()
      this.updatePulse()
      this.updateEdgeTrace()
      this.updateParticles()
      this.updateCameraTravel()
      this.controls.update()
      this.composer.render()
      this.css2dRenderer.render(this.scene, this.camera)
      this.animationId = requestAnimationFrame(loop)
    }
    this.animationId = requestAnimationFrame(loop)
  }

  private updateHighlight(): void {
    const hid = this.highlightedNodeId
    const connected = hid ? this.connectedMap.get(hid) : null

    // Label highlight
    for (const [id, div] of this.labelElements) {
      const isFeatured = id === this.config.featuredNode
      const isGhost = this.ghostNodeIds.has(id)

      if (!hid) {
        if (isGhost) {
          div.style.opacity = '0.20'
        } else {
          div.style.opacity = isFeatured ? '0.9' : '0.45'
        }
        div.classList.remove('highlighted', 'connected', 'dimmed')
      } else if (id === hid) {
        div.style.opacity = isGhost ? '0.5' : '1'
        div.classList.add('highlighted')
        div.classList.remove('connected', 'dimmed')
      } else if (connected?.has(id)) {
        div.style.opacity = isGhost ? '0.35' : '0.7'
        div.classList.add('connected')
        div.classList.remove('highlighted', 'dimmed')
      } else {
        div.style.opacity = '0.04'
        div.classList.add('dimmed')
        div.classList.remove('highlighted', 'connected')
      }
    }

    // Dot highlight — dim unrelated dots, brighten highlighted + connected
    for (const [id, dot] of this.dotMeshes) {
      const mat = dot.material as THREE.MeshStandardMaterial
      if (!hid) {
        mat.emissiveIntensity = id === this.config.featuredNode ? 1.2 : 0.8
        mat.opacity = 1
      } else if (id === hid) {
        mat.emissiveIntensity = 1.8
      } else if (connected?.has(id)) {
        mat.emissiveIntensity = 1.0
      } else {
        mat.emissiveIntensity = 0.1
      }
    }

    // Edge visibility
    const isBridgeNode = hid ? this.isBridgeNode(hid) : false

    for (const line of this.allEdgeLines) {
      const mat = line.material as THREE.LineBasicMaterial
      const d = line.userData

      if (!hid) {
        mat.opacity = 0.08
      } else if (d.sourceId === hid || d.targetId === hid) {
        const srcCluster = this.nodeClusterMap.get(d.sourceId)
        const tgtCluster = this.nodeClusterMap.get(d.targetId)
        const isCrossCluster = srcCluster !== tgtCluster
        mat.opacity = (isBridgeNode && isCrossCluster) ? 0.7 : 0.5
      } else {
        if (isBridgeNode) {
          const srcCluster = this.nodeClusterMap.get(d.sourceId)
          const tgtCluster = this.nodeClusterMap.get(d.targetId)
          mat.opacity = (srcCluster !== tgtCluster) ? 0.3 : 0.01
        } else {
          mat.opacity = 0.01
        }
      }
    }
  }

  /** Breathing — each dot and label pulses at its own phase */
  private updateBreathing(): void {
    const time = this.clock.getElapsedTime()

    for (const [id, dot] of this.dotMeshes) {
      if (this.ghostNodeIds.has(id)) continue
      // Each node breathes at its own phase, seeded by id hash
      const phase = this.hashId(id) * 6.28
      const breath = 1 + 0.15 * Math.sin(time * 0.8 + phase)
      const base = this.dotBaseScales.get(id) ?? 1
      dot.scale.setScalar(base * breath)
    }

    // Subtle label opacity breathing when not highlighted
    if (!this.highlightedNodeId) {
      for (const [id, div] of this.labelElements) {
        if (this.ghostNodeIds.has(id)) continue
        const isFeatured = id === this.config.featuredNode
        const phase = this.hashId(id) * 6.28
        const breath = Math.sin(time * 0.8 + phase)
        if (isFeatured) {
          div.style.opacity = String(0.85 + 0.1 * breath)
        } else {
          div.style.opacity = String(0.40 + 0.08 * breath)
        }
      }
    }
  }

  /** Simple deterministic hash of node id → 0..1 */
  private hashId(id: string): number {
    let h = 0
    for (let i = 0; i < id.length; i++) {
      h = ((h << 5) - h + id.charCodeAt(i)) | 0
    }
    return (Math.abs(h) % 1000) / 1000
  }

  private updatePulse(): void {
    const time = this.clock.getElapsedTime()
    this.currentPulse = 0.5 + 0.5 * Math.sin(time * 1.5)

    if (this.highlightedNodeId) return

    for (const [id, div] of this.labelElements) {
      const hand = this.nodeHands.get(id) || 'left'
      if (hand === 'both') {
        const t = 0.5 + 0.5 * Math.sin(time * 0.8 + id.length)
        const primary = this.nodeColorForId(id)
        const both = this.nodeColorBothForId(id)
        const r = Math.round(((primary >> 16) & 0xFF) + (((both >> 16) & 0xFF) - ((primary >> 16) & 0xFF)) * t * 0.4)
        const g = Math.round(((primary >> 8) & 0xFF) + (((both >> 8) & 0xFF) - ((primary >> 8) & 0xFF)) * t * 0.4)
        const b = Math.round((primary & 0xFF) + ((both & 0xFF) - (primary & 0xFF)) * t * 0.4)
        div.style.color = `rgb(${r}, ${g}, ${b})`
      }

      // Ghost shimmer
      if (this.ghostNodeIds.has(id)) {
        if (!this.highlightedNodeId) {
          const shimmer = 0.15 + 0.08 * Math.sin(time * 0.7 + id.length * 0.5)
          div.style.opacity = String(shimmer)
        }
      }
    }
  }

  /** Spawn and animate particles traveling along edges */
  private updateParticles(): void {
    const time = this.clock.getElapsedTime()

    // Spawn new particles
    if (time - this.lastParticleSpawn > this.particleSpawnInterval && this.allEdgeLines.length > 0) {
      this.lastParticleSpawn = time

      const hid = this.highlightedNodeId
      let targetEdges: THREE.Line[]

      if (hid) {
        // Spawn on highlighted node's edges
        targetEdges = this.edgeGroups.get(hid) || []
        // Spawn multiple particles at once on hover
        const count = Math.min(3, targetEdges.length)
        for (let i = 0; i < count; i++) {
          const edge = targetEdges[Math.floor(Math.random() * targetEdges.length)]
          this.spawnParticle(edge.userData, 0.015 + Math.random() * 0.01)
        }
      } else {
        // Idle: spawn on random edge
        const edge = this.allEdgeLines[Math.floor(Math.random() * this.allEdgeLines.length)]
        if (!edge.userData.isGhostEdge) {
          this.spawnParticle(edge.userData, 0.006 + Math.random() * 0.006)
        }
      }
    }

    // Update active particles
    for (const p of this.particles) {
      if (!p.active) continue
      p.progress += p.speed
      if (p.progress >= 1) {
        p.active = false
        p.mesh.visible = false
        continue
      }
      const d = p.edgeData
      p.mesh.position.set(
        d.srcX + (d.tgtX - d.srcX) * p.progress,
        d.srcY + (d.tgtY - d.srcY) * p.progress,
        d.srcZ + (d.tgtZ - d.srcZ) * p.progress,
      )
      // Fade in/out at edges
      const fade = Math.min(p.progress * 5, (1 - p.progress) * 5, 1)
      ;(p.mesh.material as THREE.MeshBasicMaterial).opacity = fade * 0.7
    }
  }

  private spawnParticle(edgeData: any, speed: number): void {
    // Find an inactive particle or create a new one
    let particle = this.particles.find(p => !p.active)
    if (!particle) {
      if (this.particles.length >= 40) return // cap
      const mesh = new THREE.Mesh(this.particleGeo!, this.particleMaterial!.clone())
      mesh.visible = false
      this.scene.add(mesh)
      particle = { mesh, edgeData, progress: 0, speed, active: false }
      this.particles.push(particle)
    }

    // Randomly pick direction
    const reverse = Math.random() > 0.5
    particle.edgeData = reverse
      ? { srcX: edgeData.tgtX, srcY: edgeData.tgtY, srcZ: edgeData.tgtZ, tgtX: edgeData.srcX, tgtY: edgeData.srcY, tgtZ: edgeData.srcZ }
      : { srcX: edgeData.srcX, srcY: edgeData.srcY, srcZ: edgeData.srcZ, tgtX: edgeData.tgtX, tgtY: edgeData.tgtY, tgtZ: edgeData.tgtZ }
    particle.progress = 0
    particle.speed = speed
    particle.active = true
    particle.mesh.visible = true
    particle.mesh.position.set(particle.edgeData.srcX, particle.edgeData.srcY, particle.edgeData.srcZ)
  }

  private updateEdgeTrace(): void {
    const hid = this.highlightedNodeId

    if (!hid) {
      for (const [nodeId, progress] of this.edgeTraceProgress) {
        if (progress < 1) {
          this.edgeTraceProgress.set(nodeId, Math.min(progress + 0.05, 1))
        }
      }
      return
    }

    const current = this.edgeTraceProgress.get(hid) ?? 0
    if (current < 1) {
      this.edgeTraceProgress.set(hid, Math.min(current + 0.04, 1))

      const progress = this.edgeTraceProgress.get(hid)!
      const nodeEdges = this.edgeGroups.get(hid) || []

      for (const line of nodeEdges) {
        const d = line.userData
        if (d.sourceId !== hid && d.targetId !== hid) continue

        const pos = (line.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array

        const isSource = d.sourceId === hid
        const fromX = isSource ? d.srcX : d.tgtX
        const fromY = isSource ? d.srcY : d.tgtY
        const fromZ = isSource ? d.srcZ : d.tgtZ
        const toX = isSource ? d.tgtX : d.srcX
        const toY = isSource ? d.tgtY : d.srcY
        const toZ = isSource ? d.tgtZ : d.srcZ

        pos[0] = fromX; pos[1] = fromY; pos[2] = fromZ
        pos[3] = fromX + (toX - fromX) * progress
        pos[4] = fromY + (toY - fromY) * progress
        pos[5] = fromZ + (toZ - fromZ) * progress

        ;(line.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
      }
    }
  }

  /** Check if a node has edges crossing to the other cluster */
  private isBridgeNode(nodeId: string): boolean {
    const nodeCluster = this.nodeClusterMap.get(nodeId)
    const edges = this.edgeGroups.get(nodeId) || []
    for (const line of edges) {
      const d = line.userData
      const otherId = d.sourceId === nodeId ? d.targetId : d.sourceId
      if (this.nodeClusterMap.get(otherId) !== nodeCluster) return true
    }
    return false
  }

  /** Smooth easing: ease-in-out cubic */
  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  /** Animate camera travel each frame */
  private updateCameraTravel(): void {
    if (this.travelProgress >= 1) return
    if (!this.travelStart || !this.travelEnd || !this.travelTargetStart || !this.travelTargetEnd) return

    const elapsed = this.clock.getElapsedTime() - this.travelStartTime
    this.travelProgress = Math.min(elapsed / this.travelDuration, 1)
    const t = this.easeInOutCubic(this.travelProgress)

    this.camera.position.lerpVectors(this.travelStart, this.travelEnd, t)
    this.controls.target.lerpVectors(this.travelTargetStart, this.travelTargetEnd, t)

    if (this.travelProgress >= 1) {
      this.travelStart = null
      this.travelEnd = null
      this.travelTargetStart = null
      this.travelTargetEnd = null
    }
  }

  /** Smoothly fly camera to focus on a specific node */
  focusNode(nodeId: string): void {
    const pos = this.nodePositions.get(nodeId)
    if (!pos) return

    // Maintain current viewing distance but re-center on node
    const offset = this.camera.position.clone().sub(this.controls.target)
    // Bring camera closer for focus (80% of current distance)
    offset.multiplyScalar(0.8)

    this.travelStart = this.camera.position.clone()
    this.travelEnd = pos.clone().add(offset)
    this.travelTargetStart = this.controls.target.clone()
    this.travelTargetEnd = pos.clone()
    this.travelProgress = 0
    this.travelDuration = 1.5
    this.travelStartTime = this.clock.getElapsedTime()
  }

  /** Smoothly travel camera to the center of a named cluster (~2s animation) */
  travelToCluster(clusterName: string): void {
    const center = this.clusterCenters[clusterName]
    if (!center) {
      console.warn(`Unknown cluster: ${clusterName}`)
      return
    }

    const offset = this.camera.position.clone().sub(this.controls.target)

    this.travelStart = this.camera.position.clone()
    this.travelEnd = center.clone().add(offset)
    this.travelTargetStart = this.controls.target.clone()
    this.travelTargetEnd = center.clone()
    this.travelProgress = 0
    this.travelDuration = 2.0
    this.travelStartTime = this.clock.getElapsedTime()
    this.activeCluster = clusterName
  }

  /** Return which cluster the camera is currently viewing */
  getActiveCluster(): string {
    return this.activeCluster
  }

  private getNodePosition(nodeId: string): { x: number; y: number; z: number } | null {
    const pos = this.nodePositions.get(nodeId)
    if (pos) return { x: pos.x, y: pos.y, z: pos.z }
    for (const child of this.scene.children) {
      if (child instanceof CSS2DObject) {
        const div = child.element as HTMLDivElement
        if (div.dataset?.nodeId === nodeId) {
          return { x: child.position.x, y: child.position.y, z: child.position.z }
        }
      }
    }
    return null
  }

  addGhostNodes(
    ghostNodes: PositionedNode[],
    ghostEdges: GraphEdge[],
    ghostColor: number,
    ghostColorBoth: number,
    ghostSiteUrl: string
  ): void {
    this.ghostColor = ghostColor
    this.ghostColorBoth = ghostColorBoth
    this.ghostSiteUrl = ghostSiteUrl

    for (const node of ghostNodes) {
      this.ghostNodeIds.add(node.id)
      this.connectedMap.set(node.id, new Set())
      this.nodeHands.set(node.id, node.hand)
      this.nodeClusterMap.set(node.id, node.cluster)
    }

    for (const edge of ghostEdges) {
      if (!this.connectedMap.has(edge.source)) this.connectedMap.set(edge.source, new Set())
      if (!this.connectedMap.has(edge.target)) this.connectedMap.set(edge.target, new Set())
      this.connectedMap.get(edge.source)?.add(edge.target)
      this.connectedMap.get(edge.target)?.add(edge.source)
    }

    const colorHex = '#' + ghostColor.toString(16).padStart(6, '0')

    for (const node of ghostNodes) {
      const fontSize = Math.min(12, Math.max(9, 7 + node.connectionCount * 1.2))
      const div = document.createElement('div')
      div.className = 'node-text ghost-node'
      div.textContent = node.title
      div.dataset.nodeId = node.id
      div.dataset.ghostSite = ghostSiteUrl
      div.style.fontSize = `${fontSize}px`
      div.style.color = colorHex
      div.style.opacity = '0.20'
      div.style.fontWeight = '300'
      div.style.pointerEvents = 'auto'
      div.style.cursor = 'pointer'

      div.addEventListener('click', () => {
        window.location.href = `${ghostSiteUrl}#${node.id}`
      })

      const label = new CSS2DObject(div)
      label.position.set(node.x, node.y, node.z)
      this.scene.add(label)
      this.labelElements.set(node.id, div)
    }

    for (const edge of ghostEdges) {
      const srcNode = ghostNodes.find(n => n.id === edge.source)
      const tgtNode = ghostNodes.find(n => n.id === edge.target)
      const srcPos = srcNode ? { x: srcNode.x, y: srcNode.y, z: srcNode.z } : this.getNodePosition(edge.source)
      const tgtPos = tgtNode ? { x: tgtNode.x, y: tgtNode.y, z: tgtNode.z } : this.getNodePosition(edge.target)
      if (!srcPos || !tgtPos) continue

      const geo = new THREE.BufferGeometry()
      const positions = new Float32Array(6)
      positions[0] = srcPos.x; positions[1] = srcPos.y; positions[2] = srcPos.z
      positions[3] = tgtPos.x; positions[4] = tgtPos.y; positions[5] = tgtPos.z
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

      const mat = new THREE.LineBasicMaterial({
        color: ghostColor,
        transparent: true,
        opacity: 0.05,
      })
      const line = new THREE.Line(geo, mat)
      line.userData = {
        srcX: srcPos.x, srcY: srcPos.y, srcZ: srcPos.z,
        tgtX: tgtPos.x, tgtY: tgtPos.y, tgtZ: tgtPos.z,
        sourceId: edge.source, targetId: edge.target,
        isGhostEdge: true,
      }
      this.scene.add(line)
      this.allEdgeLines.push(line)

      if (!this.edgeGroups.has(edge.source)) this.edgeGroups.set(edge.source, [])
      if (!this.edgeGroups.has(edge.target)) this.edgeGroups.set(edge.target, [])
      this.edgeGroups.get(edge.source)!.push(line)
      this.edgeGroups.get(edge.target)!.push(line)
    }
  }

  clearScene(): void {
    const toRemove: THREE.Object3D[] = []
    for (const child of this.scene.children) {
      if (!(child instanceof THREE.AmbientLight)) {
        toRemove.push(child)
      }
    }
    for (const obj of toRemove) {
      this.scene.remove(obj)
      if ((obj as any).geometry) (obj as any).geometry.dispose()
      if ((obj as any).material) (obj as any).material.dispose()
    }

    this.labelElements.clear()
    this.nodeHands.clear()
    this.connectedMap.clear()
    this.edgeGroups.clear()
    this.edgeTraceProgress.clear()
    this.allEdgeLines = []
    this.nodeClusterMap.clear()
    this.clusterCenters = {}
    this.ghostNodeIds.clear()
    this.dotMeshes.clear()
    this.dotBaseScales.clear()
    this.nodePositions.clear()
    this.particles = []
  }

  buildAtlasScene(
    nodes: PositionedNode[],
    edges: GraphEdge[],
    configs: ConstellationConfig[]
  ): void {
    const configMap = new Map<string, ConstellationConfig>()
    for (const c of configs) configMap.set(c.name, c)

    for (const node of nodes) {
      this.connectedMap.set(node.id, new Set())
      this.nodeHands.set(node.id, node.hand)
      this.nodeClusterMap.set(node.id, node.cluster)
    }
    for (const edge of edges) {
      this.connectedMap.get(edge.source)?.add(edge.target)
      this.connectedMap.get(edge.target)?.add(edge.source)
    }

    for (const node of nodes) {
      const nodeConfig = configMap.get(node.cluster) || this.config
      const isFeatured = configs.some(c => c.featuredNode === node.id)
      const color = node.hand === 'both' ? nodeConfig.colorBoth : nodeConfig.color
      const colorHex = '#' + color.toString(16).padStart(6, '0')
      this.buildNodeVisuals(node, isFeatured, color, colorHex)
    }

    // Edges with bridge detection
    this.buildEdgeVisuals(edges, nodes, (src, tgt) => {
      const srcConfig = configMap.get(src.cluster) || this.config
      const tgtConfig = configMap.get(tgt.cluster) || this.config
      const isBridge = src.cluster !== tgt.cluster

      if (isBridge) {
        const r = (((srcConfig.color >> 16) & 0xFF) + ((tgtConfig.color >> 16) & 0xFF)) >> 1
        const g = (((srcConfig.color >> 8) & 0xFF) + ((tgtConfig.color >> 8) & 0xFF)) >> 1
        const b = ((srcConfig.color & 0xFF) + (tgtConfig.color & 0xFF)) >> 1
        return { color: (r << 16) | (g << 8) | b, opacity: 0.15 }
      }
      return { color: srcConfig.color, opacity: 0.08 }
    })

    this.computeClusterCentroids(nodes)
  }

  pullBackCamera(): void {
    const offset = this.camera.position.clone().sub(this.controls.target)
    const direction = offset.normalize()

    this.travelStart = this.camera.position.clone()
    this.travelEnd = direction.multiplyScalar(400)
    this.travelTargetStart = this.controls.target.clone()
    this.travelTargetEnd = new THREE.Vector3(0, 0, 0)
    this.travelProgress = 0
    this.travelStartTime = this.clock.getElapsedTime()
  }

  resetTrace(nodeId: string | null): void {
    if (nodeId) {
      this.edgeTraceProgress.set(nodeId, 0)

      const nodeEdges = this.edgeGroups.get(nodeId) || []
      for (const line of nodeEdges) {
        const d = line.userData
        if (d.sourceId !== nodeId && d.targetId !== nodeId) continue

        const pos = (line.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
        const isSource = d.sourceId === nodeId
        const fromX = isSource ? d.srcX : d.tgtX
        const fromY = isSource ? d.srcY : d.tgtY
        const fromZ = isSource ? d.srcZ : d.tgtZ

        pos[0] = fromX; pos[1] = fromY; pos[2] = fromZ
        pos[3] = fromX; pos[4] = fromY; pos[5] = fromZ
        ;(line.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
      }
    }
  }
}

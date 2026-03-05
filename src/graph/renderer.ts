import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { PositionedNode } from './force'
import type { GraphEdge } from '../data/types'

const FEATURED_NODE_ID = 'the-constellation'

// Hand → color mapping
const HAND_COLORS: Record<string, number> = {
  left: 0xF7931A,   // amber
  right: 0x4A9EF7,  // cool blue
  both: 0xD4A853,   // warm gold (split)
}

function handColor(hand: string): number {
  return HAND_COLORS[hand] || HAND_COLORS.left
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

  // Edge tracing
  private edgeGroups: Map<string, THREE.Line[]> = new Map() // nodeId → its edges
  private edgeTraceProgress: Map<string, number> = new Map() // nodeId → 0..1
  private allEdgeLines: THREE.Line[] = []

  highlightedNodeId: string | null = null

  // Expose pulse value for sidebar sync
  currentPulse: number = 0

  private animationId: number | null = null

  constructor(private container: HTMLElement) {
    const rect = container.getBoundingClientRect()
    const w = rect.width
    const h = rect.height

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a0a)

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 2000)
    this.camera.position.set(0, 0, 280)

    this.webglRenderer = new THREE.WebGLRenderer({ antialias: true })
    this.webglRenderer.setSize(w, h)
    this.webglRenderer.setPixelRatio(window.devicePixelRatio)
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
      new THREE.Vector2(w, h), 1.2, 0.5, 0.8
    )
    this.composer = new EffectComposer(this.webglRenderer)
    this.composer.addPass(renderPass)
    this.composer.addPass(bloomPass)

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

  buildScene(nodes: PositionedNode[], edges: GraphEdge[]): void {
    // Build adjacency map
    for (const node of nodes) {
      this.connectedMap.set(node.id, new Set())
      this.nodeHands.set(node.id, node.hand)
    }
    for (const edge of edges) {
      this.connectedMap.get(edge.source)?.add(edge.target)
      this.connectedMap.get(edge.target)?.add(edge.source)
    }

    // Text nodes — CSS2D labels as the primary visual
    for (const node of nodes) {
      const isFeatured = node.id === FEATURED_NODE_ID
      const color = handColor(node.hand)
      const colorHex = '#' + color.toString(16).padStart(6, '0')

      // Small emissive dot at the position (for bloom to pick up)
      const dotGeo = new THREE.SphereGeometry(isFeatured ? 3 : 1.5, 16, 16)
      const dotMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: isFeatured ? 1.0 : 0.6,
        roughness: 0.3,
        metalness: 0.1,
      })
      const dot = new THREE.Mesh(dotGeo, dotMat)
      dot.position.set(node.x, node.y, node.z)
      this.scene.add(dot)

      // Text label — scaled by connectionCount
      const div = document.createElement('div')
      div.className = 'node-text'
      div.textContent = node.title
      div.dataset.nodeId = node.id

      const fontSize = isFeatured
        ? 18
        : Math.max(9, 7 + node.connectionCount * 1.2)
      div.style.fontSize = `${fontSize}px`
      div.style.color = colorHex
      div.style.opacity = isFeatured ? '0.9' : '0.45'
      div.style.fontWeight = isFeatured ? '500' : '300'

      const label = new CSS2DObject(div)
      label.position.set(node.x, node.y, node.z)
      this.scene.add(label)

      this.labelElements.set(node.id, div)
    }

    // Edges — one Line per edge for individual trace animation
    for (const edge of edges) {
      const src = nodes.find(n => n.id === edge.source)
      const tgt = nodes.find(n => n.id === edge.target)
      if (!src || !tgt) continue

      // Determine edge color from source hand
      const edgeColor = handColor(src.hand)

      const geo = new THREE.BufferGeometry()
      const positions = new Float32Array(6)
      positions[0] = src.x; positions[1] = src.y; positions[2] = src.z
      // Start with target = source (line length 0, will animate)
      positions[3] = src.x; positions[4] = src.y; positions[5] = src.z
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

      const mat = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: 0.08,
      })
      const line = new THREE.Line(geo, mat)
      // Store full target position as userData
      line.userData = {
        srcX: src.x, srcY: src.y, srcZ: src.z,
        tgtX: tgt.x, tgtY: tgt.y, tgtZ: tgt.z,
        sourceId: edge.source,
        targetId: edge.target,
      }
      this.scene.add(line)
      this.allEdgeLines.push(line)

      // Map edges to both nodes
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

  start(): void {
    const loop = () => {
      this.updateHighlight()
      this.updatePulse()
      this.updateEdgeTrace()
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

    for (const [id, div] of this.labelElements) {
      const isFeatured = id === FEATURED_NODE_ID

      if (!hid) {
        // Default state
        div.style.opacity = isFeatured ? '0.9' : '0.45'
        div.classList.remove('highlighted', 'connected', 'dimmed')
      } else if (id === hid) {
        div.style.opacity = '1'
        div.classList.add('highlighted')
        div.classList.remove('connected', 'dimmed')
      } else if (connected?.has(id)) {
        div.style.opacity = '0.7'
        div.classList.add('connected')
        div.classList.remove('highlighted', 'dimmed')
      } else {
        div.style.opacity = '0.06'
        div.classList.add('dimmed')
        div.classList.remove('highlighted', 'connected')
      }
    }

    // Edge visibility
    for (const line of this.allEdgeLines) {
      const mat = line.material as THREE.LineBasicMaterial
      const d = line.userData

      if (!hid) {
        mat.opacity = 0.08
      } else if (d.sourceId === hid || d.targetId === hid) {
        mat.opacity = 0.5
      } else {
        mat.opacity = 0.02
      }
    }
  }

  private updatePulse(): void {
    const time = this.clock.getElapsedTime()
    this.currentPulse = 0.5 + 0.5 * Math.sin(time * 1.5)

    if (this.highlightedNodeId) return

    // "Both" hand nodes flicker between amber and blue
    for (const [id, div] of this.labelElements) {
      const hand = this.nodeHands.get(id) || 'left'
      if (hand === 'both') {
        const t = 0.5 + 0.5 * Math.sin(time * 0.8 + id.length)
        // Interpolate between amber and blue
        const r = Math.round(247 * (1 - t * 0.3) + 74 * t * 0.3)
        const g = Math.round(147 * (1 - t * 0.3) + 158 * t * 0.3)
        const b = Math.round(26 * (1 - t * 0.3) + 247 * t * 0.3)
        div.style.color = `rgb(${r}, ${g}, ${b})`
      }
    }
  }

  private updateEdgeTrace(): void {
    const hid = this.highlightedNodeId

    if (!hid) {
      // Reset all edges to fully drawn
      for (const [nodeId, progress] of this.edgeTraceProgress) {
        if (progress < 1) {
          this.edgeTraceProgress.set(nodeId, Math.min(progress + 0.05, 1))
        }
      }
      return
    }

    // Get or init trace progress for highlighted node
    const current = this.edgeTraceProgress.get(hid) ?? 0
    if (current < 1) {
      this.edgeTraceProgress.set(hid, Math.min(current + 0.04, 1)) // ~400ms to trace

      const progress = this.edgeTraceProgress.get(hid)!
      const nodeEdges = this.edgeGroups.get(hid) || []

      for (const line of nodeEdges) {
        const d = line.userData
        if (d.sourceId !== hid && d.targetId !== hid) continue

        const pos = (line.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array

        // Determine which end is the highlighted node
        const isSource = d.sourceId === hid
        const fromX = isSource ? d.srcX : d.tgtX
        const fromY = isSource ? d.srcY : d.tgtY
        const fromZ = isSource ? d.srcZ : d.tgtZ
        const toX = isSource ? d.tgtX : d.srcX
        const toY = isSource ? d.tgtY : d.srcY
        const toZ = isSource ? d.tgtZ : d.srcZ

        // Set start point
        pos[0] = fromX; pos[1] = fromY; pos[2] = fromZ
        // Lerp end point
        pos[3] = fromX + (toX - fromX) * progress
        pos[4] = fromY + (toY - fromY) * progress
        pos[5] = fromZ + (toZ - fromZ) * progress

        ;(line.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
      }
    }
  }

  // Called when highlight changes — reset trace for new node
  resetTrace(nodeId: string | null): void {
    if (nodeId) {
      this.edgeTraceProgress.set(nodeId, 0)

      // Reset the edge geometry for this node's edges
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

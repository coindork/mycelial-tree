import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { SimulationNode, SimulationEdge } from './force'

const FEATURED_NODE_ID = 'the-handedness-of-being'

export interface RenderState {
  nodes: SimulationNode[]
  edges: SimulationEdge[]
}

export class GraphRenderer {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private webglRenderer: THREE.WebGLRenderer
  private css2dRenderer: CSS2DRenderer
  private composer: EffectComposer
  private controls: OrbitControls
  private clock: THREE.Clock

  private nodeMeshes: Map<string, THREE.Mesh> = new Map()
  private nodeMaterials: Map<string, THREE.MeshStandardMaterial> = new Map()
  private labelObjects: Map<string, CSS2DObject> = new Map()
  private edgeLines: THREE.LineSegments | null = null
  private edgePositions: Float32Array | null = null

  private _width: number
  private _height: number
  private initialized = false
  private animationId: number | null = null

  constructor(private container: HTMLElement) {
    const rect = container.getBoundingClientRect()
    this._width = rect.width
    this._height = rect.height

    // Scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a0a)

    // Camera
    this.camera = new THREE.PerspectiveCamera(50, this._width / this._height, 0.1, 2000)
    this.camera.position.set(0, 0, 300)

    // WebGL Renderer
    this.webglRenderer = new THREE.WebGLRenderer({ antialias: true })
    this.webglRenderer.setSize(this._width, this._height)
    this.webglRenderer.setPixelRatio(window.devicePixelRatio)
    this.webglRenderer.toneMapping = THREE.ReinhardToneMapping
    container.appendChild(this.webglRenderer.domElement)

    // CSS2D Renderer for labels
    this.css2dRenderer = new CSS2DRenderer()
    this.css2dRenderer.setSize(this._width, this._height)
    this.css2dRenderer.domElement.style.position = 'absolute'
    this.css2dRenderer.domElement.style.top = '0'
    this.css2dRenderer.domElement.style.left = '0'
    this.css2dRenderer.domElement.style.pointerEvents = 'none'
    container.appendChild(this.css2dRenderer.domElement)

    // Bloom post-processing
    const renderPass = new RenderPass(this.scene, this.camera)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this._width, this._height),
      1.5,  // strength
      0.4,  // radius
      0.85  // threshold
    )
    this.composer = new EffectComposer(this.webglRenderer)
    this.composer.addPass(renderPass)
    this.composer.addPass(bloomPass)

    // OrbitControls — auto-rotate, no zoom/pan
    this.controls = new OrbitControls(this.camera, this.webglRenderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.autoRotate = true
    this.controls.autoRotateSpeed = 0.5
    this.controls.enableZoom = false
    this.controls.enablePan = false

    // Lighting
    const ambient = new THREE.AmbientLight(0x404040, 0.5)
    this.scene.add(ambient)

    const point = new THREE.PointLight(0xF7931A, 0.3, 500)
    point.position.set(0, 0, 0)
    this.scene.add(point)

    this.clock = new THREE.Clock()

    // Resize listener
    window.addEventListener('resize', () => this.resize())
  }

  get width(): number { return this._width }
  get height(): number { return this._height }
  get element(): HTMLElement { return this.webglRenderer.domElement }

  resize(): void {
    const rect = this.container.getBoundingClientRect()
    this._width = rect.width
    this._height = rect.height

    this.camera.aspect = this._width / this._height
    this.camera.updateProjectionMatrix()

    this.webglRenderer.setSize(this._width, this._height)
    this.css2dRenderer.setSize(this._width, this._height)
    this.composer.setSize(this._width, this._height)
  }

  private initScene(state: RenderState): void {
    if (this.initialized) return
    this.initialized = true

    const { nodes, edges } = state

    // Create node spheres
    for (const node of nodes) {
      const baseRadius = 2 + node.connectionCount * 0.8
      const radius = node.id === FEATURED_NODE_ID ? baseRadius * 1.5 : baseRadius
      const isFeatured = node.id === FEATURED_NODE_ID

      const geometry = new THREE.SphereGeometry(radius, 32, 32)
      const material = new THREE.MeshStandardMaterial({
        color: 0xF7931A,
        emissive: 0xF7931A,
        emissiveIntensity: isFeatured ? 0.9 : 0.5,
        roughness: 0.3,
        metalness: 0.1,
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(node.x, node.y, node.z)
      this.scene.add(mesh)

      this.nodeMeshes.set(node.id, mesh)
      this.nodeMaterials.set(node.id, material)

      // Label
      const div = document.createElement('div')
      div.className = 'node-label'
      div.textContent = node.title
      div.style.opacity = isFeatured ? '0.85' : '0.35'
      div.style.fontSize = isFeatured ? '13px' : '10px'

      const label = new CSS2DObject(div)
      label.position.set(0, radius + 3, 0)
      mesh.add(label)
      this.labelObjects.set(node.id, label)
    }

    // Create edge lines
    const edgeCount = edges.length
    this.edgePositions = new Float32Array(edgeCount * 6)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.edgePositions, 3))

    const material = new THREE.LineBasicMaterial({
      color: 0xF7931A,
      transparent: true,
      opacity: 0.15,
    })

    this.edgeLines = new THREE.LineSegments(geometry, material)
    this.scene.add(this.edgeLines)
  }

  private updatePositions(state: RenderState): void {
    const { nodes, edges } = state

    // Update node mesh positions
    for (const node of nodes) {
      const mesh = this.nodeMeshes.get(node.id)
      if (mesh) {
        mesh.position.set(node.x, node.y, node.z)
      }
    }

    // Update edge line positions
    if (this.edgePositions && this.edgeLines) {
      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i]
        const source = typeof edge.source === 'object' ? (edge.source as SimulationNode) : null
        const target = typeof edge.target === 'object' ? (edge.target as SimulationNode) : null
        if (!source || !target) continue

        const offset = i * 6
        this.edgePositions[offset] = source.x
        this.edgePositions[offset + 1] = source.y
        this.edgePositions[offset + 2] = source.z
        this.edgePositions[offset + 3] = target.x
        this.edgePositions[offset + 4] = target.y
        this.edgePositions[offset + 5] = target.z
      }

      const attr = this.edgeLines.geometry.getAttribute('position') as THREE.BufferAttribute
      attr.needsUpdate = true
    }
  }

  private updatePulse(): void {
    const time = this.clock.getElapsedTime()
    for (const [id, material] of this.nodeMaterials) {
      const isFeatured = id === FEATURED_NODE_ID
      const baseIntensity = isFeatured ? 0.9 : 0.5
      const pulse = 0.15 * Math.sin(time * 2 + (isFeatured ? 0 : id.length * 0.7))
      material.emissiveIntensity = baseIntensity + pulse
    }
  }

  startAnimation(getState: () => RenderState): void {
    const loop = () => {
      const state = getState()
      this.initScene(state)
      this.updatePositions(state)
      this.updatePulse()
      this.controls.update()
      this.composer.render()
      this.css2dRenderer.render(this.scene, this.camera)
      this.animationId = requestAnimationFrame(loop)
    }
    this.animationId = requestAnimationFrame(loop)
  }

  stopAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }
}

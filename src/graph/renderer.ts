import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { PositionedNode } from './force'
import type { GraphEdge } from '../data/types'

const FEATURED_NODE_ID = 'the-handedness-of-being'

export class MoleculeRenderer {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private webglRenderer: THREE.WebGLRenderer
  private css2dRenderer: CSS2DRenderer
  private composer: EffectComposer
  private controls: OrbitControls
  private clock: THREE.Clock

  private nodeMaterials: Map<string, THREE.MeshStandardMaterial> = new Map()
  private edgeMaterial: THREE.LineBasicMaterial | null = null
  private connectedMap: Map<string, Set<string>> = new Map()

  highlightedNodeId: string | null = null

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
      new THREE.Vector2(w, h), 1.5, 0.4, 0.85
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

    this.scene.add(new THREE.AmbientLight(0x404040, 0.5))
    const point = new THREE.PointLight(0xF7931A, 0.3, 500)
    point.position.set(0, 0, 0)
    this.scene.add(point)

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
    }
    for (const edge of edges) {
      this.connectedMap.get(edge.source)?.add(edge.target)
      this.connectedMap.get(edge.target)?.add(edge.source)
    }

    // Spheres
    for (const node of nodes) {
      const isFeatured = node.id === FEATURED_NODE_ID
      const geometry = new THREE.SphereGeometry(node.radius, 32, 32)
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
      this.nodeMaterials.set(node.id, material)

      // Label
      const div = document.createElement('div')
      div.className = 'node-label'
      div.textContent = node.title
      div.style.opacity = isFeatured ? '0.85' : '0.35'
      div.style.fontSize = isFeatured ? '12px' : '9px'
      const label = new CSS2DObject(div)
      label.position.set(0, node.radius + 3, 0)
      mesh.add(label)
    }

    // Edge lines
    const positions = new Float32Array(edges.length * 6)
    for (let i = 0; i < edges.length; i++) {
      const src = nodes.find(n => n.id === edges[i].source)
      const tgt = nodes.find(n => n.id === edges[i].target)
      if (!src || !tgt) continue
      const o = i * 6
      positions[o] = src.x; positions[o+1] = src.y; positions[o+2] = src.z
      positions[o+3] = tgt.x; positions[o+4] = tgt.y; positions[o+5] = tgt.z
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xF7931A, transparent: true, opacity: 0.12,
    })
    this.scene.add(new THREE.LineSegments(geo, this.edgeMaterial))
  }

  start(): void {
    const loop = () => {
      this.updateHighlight()
      this.updatePulse()
      this.controls.update()
      this.composer.render()
      this.css2dRenderer.render(this.scene, this.camera)
      this.animationId = requestAnimationFrame(loop)
    }
    this.animationId = requestAnimationFrame(loop)
  }

  private updateHighlight(): void {
    const hid = this.highlightedNodeId
    if (!hid) return // pulse handles default state
    const connected = this.connectedMap.get(hid)

    for (const [id, material] of this.nodeMaterials) {
      if (id === hid) {
        material.emissiveIntensity = 0.95
      } else if (connected?.has(id)) {
        material.emissiveIntensity = 0.5
      } else {
        material.emissiveIntensity = 0.06
      }
    }

    if (this.edgeMaterial) {
      this.edgeMaterial.opacity = 0.04
    }
  }

  private updatePulse(): void {
    if (this.highlightedNodeId) return
    const time = this.clock.getElapsedTime()

    // Restore default edge opacity
    if (this.edgeMaterial) {
      this.edgeMaterial.opacity = 0.12
    }

    for (const [id, material] of this.nodeMaterials) {
      const isFeatured = id === FEATURED_NODE_ID
      const base = isFeatured ? 0.9 : 0.5
      const pulse = 0.12 * Math.sin(time * 1.5 + id.length * 0.7)
      material.emissiveIntensity = base + pulse
    }
  }
}

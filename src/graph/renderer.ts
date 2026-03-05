import type { SimulationNode, SimulationEdge } from './force'

export interface RenderTransform {
  x: number
  y: number
  k: number
}

export interface RenderState {
  nodes: SimulationNode[]
  edges: SimulationEdge[]
  hoveredNode: SimulationNode | null
  transform: RenderTransform
}

export class GraphRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private _width: number = 0
  private _height: number = 0
  private animationId: number | null = null
  private startTime: number = 0

  constructor(private container: HTMLElement) {
    this.canvas = document.createElement('canvas')
    this.canvas.style.display = 'block'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.container.appendChild(this.canvas)

    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2d context')
    this.ctx = ctx

    this.resize()
  }

  get element(): HTMLCanvasElement {
    return this.canvas
  }

  get width(): number {
    return this._width
  }

  get height(): number {
    return this._height
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1
    const rect = this.container.getBoundingClientRect()
    this._width = rect.width
    this._height = rect.height
    this.canvas.width = rect.width * dpr
    this.canvas.height = rect.height * dpr
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  startAnimation(getState: () => RenderState): void {
    this.startTime = performance.now()
    const loop = () => {
      const state = getState()
      this.render(state)
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

  private render(state: RenderState): void {
    const { nodes, edges, hoveredNode, transform } = state
    const ctx = this.ctx
    const time = (performance.now() - this.startTime) / 1000

    // Background
    ctx.save()
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0)
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, this._width, this._height)
    ctx.restore()

    // Apply transform
    ctx.save()
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr * transform.k, 0, 0, dpr * transform.k, dpr * transform.x, dpr * transform.y)

    // Build connected set for hovered node
    const connectedIds = new Set<string>()
    if (hoveredNode) {
      connectedIds.add(hoveredNode.id)
      for (const edge of edges) {
        const sourceId = typeof edge.source === 'object' ? (edge.source as SimulationNode).id : edge.source
        const targetId = typeof edge.target === 'object' ? (edge.target as SimulationNode).id : edge.target
        if (sourceId === hoveredNode.id) connectedIds.add(targetId)
        if (targetId === hoveredNode.id) connectedIds.add(sourceId)
      }
    }

    // Draw edges
    for (const edge of edges) {
      const source = typeof edge.source === 'object' ? (edge.source as SimulationNode) : null
      const target = typeof edge.target === 'object' ? (edge.target as SimulationNode) : null
      if (!source || !target) continue

      const sourceId = source.id
      const targetId = target.id
      const isHoveredEdge = hoveredNode && (sourceId === hoveredNode.id || targetId === hoveredNode.id)

      ctx.beginPath()
      ctx.moveTo(source.x, source.y)
      ctx.lineTo(target.x, target.y)

      if (isHoveredEdge) {
        ctx.strokeStyle = 'rgba(247, 147, 26, 0.6)'
        ctx.lineWidth = 1.5
        ctx.shadowColor = 'rgba(247, 147, 26, 0.4)'
        ctx.shadowBlur = 8
      } else {
        ctx.strokeStyle = 'rgba(247, 147, 26, 0.08)'
        ctx.lineWidth = 0.5
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
      }

      ctx.stroke()
    }

    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0

    // Draw nodes
    for (const node of nodes) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 2 + node.x * 0.01)
      const baseRadius = Math.max(4, Math.min(12, 3 + node.connectionCount * 1.5))

      let glowAlpha: number
      let radius: number

      if (hoveredNode) {
        if (node.id === hoveredNode.id) {
          glowAlpha = 0.9
          radius = baseRadius * 1.3
        } else if (connectedIds.has(node.id)) {
          glowAlpha = 0.5 + pulse * 0.2
          radius = baseRadius
        } else {
          glowAlpha = 0.08 + pulse * 0.04
          radius = baseRadius * 0.8
        }
      } else {
        glowAlpha = 0.3 + pulse * 0.2
        radius = baseRadius
      }

      // Radial gradient glow
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 3)
      gradient.addColorStop(0, `rgba(247, 147, 26, ${glowAlpha})`)
      gradient.addColorStop(0.4, `rgba(247, 147, 26, ${glowAlpha * 0.5})`)
      gradient.addColorStop(1, 'rgba(247, 147, 26, 0)')

      ctx.beginPath()
      ctx.arc(node.x, node.y, radius * 3, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // Core dot
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(247, 147, 26, ${glowAlpha})`
      ctx.fill()
    }

    // Draw labels for hovered + connected
    if (hoveredNode) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'

      for (const node of nodes) {
        if (!connectedIds.has(node.id)) continue

        const isHovered = node.id === hoveredNode.id
        const baseRadius = Math.max(4, Math.min(12, 3 + node.connectionCount * 1.5))
        const labelY = node.y - baseRadius - 8

        ctx.font = isHovered ? 'bold 13px system-ui, sans-serif' : '11px system-ui, sans-serif'
        ctx.fillStyle = isHovered ? '#e0e0e0' : '#888888'
        ctx.fillText(node.title, node.x, labelY)
      }
    }

    ctx.restore()
  }
}

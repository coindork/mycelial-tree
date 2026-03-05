import type { GraphNode, GraphEdge } from '../data/types'

export interface StaticNode extends GraphNode {
  x: number
  y: number
  radius: number
  bookOrder: number
}

export class GraphRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private _width: number = 0
  private _height: number = 0
  private nodes: StaticNode[] = []
  private edges: GraphEdge[] = []
  private hoveredNode: StaticNode | null = null
  private animationId: number | null = null
  private startTime: number = 0
  private onHover: ((node: StaticNode | null) => void) | null = null

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
    window.addEventListener('resize', () => this.resize())

    // Hover detection
    this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      let closest: StaticNode | null = null
      let closestDist = 30

      for (const node of this.nodes) {
        const dx = node.x - mx
        const dy = node.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < closestDist) {
          closest = node
          closestDist = dist
        }
      }

      if (closest !== this.hoveredNode) {
        this.hoveredNode = closest
        this.canvas.style.cursor = closest ? 'pointer' : 'default'
        if (this.onHover) this.onHover(closest)
      }
    })

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredNode = null
      this.canvas.style.cursor = 'default'
      if (this.onHover) this.onHover(null)
    })
  }

  get width(): number { return this._width }
  get height(): number { return this._height }

  setHoverHandler(handler: (node: StaticNode | null) => void): void {
    this.onHover = handler
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

  setData(nodes: StaticNode[], edges: GraphEdge[]): void {
    this.nodes = nodes
    this.edges = edges
  }

  start(): void {
    this.startTime = performance.now()
    const loop = () => {
      this.render()
      this.animationId = requestAnimationFrame(loop)
    }
    this.animationId = requestAnimationFrame(loop)
  }

  private render(): void {
    const ctx = this.ctx
    const time = (performance.now() - this.startTime) / 1000
    const hovered = this.hoveredNode

    // Background
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, this._width, this._height)

    // Build connected set for hovered node
    const connectedIds = new Set<string>()
    if (hovered) {
      connectedIds.add(hovered.id)
      for (const edge of this.edges) {
        if (edge.source === hovered.id) connectedIds.add(edge.target)
        if (edge.target === hovered.id) connectedIds.add(edge.source)
      }
    }

    // Draw edges
    for (const edge of this.edges) {
      const source = this.nodes.find(n => n.id === edge.source)
      const target = this.nodes.find(n => n.id === edge.target)
      if (!source || !target) continue

      const isHighlighted = hovered && (edge.source === hovered.id || edge.target === hovered.id)

      ctx.beginPath()
      ctx.moveTo(source.x, source.y)
      ctx.lineTo(target.x, target.y)

      if (isHighlighted) {
        ctx.strokeStyle = 'rgba(247, 147, 26, 0.5)'
        ctx.lineWidth = 1.5
      } else if (hovered) {
        ctx.strokeStyle = 'rgba(247, 147, 26, 0.04)'
        ctx.lineWidth = 0.5
      } else {
        ctx.strokeStyle = 'rgba(247, 147, 26, 0.12)'
        ctx.lineWidth = 0.5
      }

      ctx.stroke()
    }

    // Draw nodes
    for (const node of this.nodes) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 1.5 + node.bookOrder * 0.5)
      const r = node.radius

      let alpha: number
      let drawRadius: number

      if (hovered) {
        if (node.id === hovered.id) {
          alpha = 0.95
          drawRadius = r * 1.2
        } else if (connectedIds.has(node.id)) {
          alpha = 0.5 + pulse * 0.15
          drawRadius = r
        } else {
          alpha = 0.08
          drawRadius = r * 0.7
        }
      } else {
        alpha = 0.3 + pulse * 0.2
        drawRadius = r
      }

      // Glow
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, drawRadius * 3)
      gradient.addColorStop(0, `rgba(247, 147, 26, ${alpha})`)
      gradient.addColorStop(0.4, `rgba(247, 147, 26, ${alpha * 0.4})`)
      gradient.addColorStop(1, 'rgba(247, 147, 26, 0)')

      ctx.beginPath()
      ctx.arc(node.x, node.y, drawRadius * 3, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // Core
      ctx.beginPath()
      ctx.arc(node.x, node.y, drawRadius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(247, 147, 26, ${alpha})`
      ctx.fill()
    }

    // Draw all labels (faint) — brighter for hovered/connected
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    for (const node of this.nodes) {
      const labelY = node.y + node.radius + 6

      if (hovered && node.id === hovered.id) {
        ctx.font = 'bold 12px system-ui, sans-serif'
        ctx.fillStyle = '#e0e0e0'
      } else if (hovered && connectedIds.has(node.id)) {
        ctx.font = '10px system-ui, sans-serif'
        ctx.fillStyle = 'rgba(224, 224, 224, 0.5)'
      } else if (hovered) {
        ctx.font = '10px system-ui, sans-serif'
        ctx.fillStyle = 'rgba(224, 224, 224, 0.08)'
      } else {
        ctx.font = '10px system-ui, sans-serif'
        ctx.fillStyle = 'rgba(224, 224, 224, 0.3)'
      }

      ctx.fillText(node.title, node.x, labelY)
    }
  }
}

import type { GraphNode, GraphEdge } from '../data/types'

export class ReadingPane {
  private el: HTMLElement
  private _isOpen = false
  private navigateHandler: ((nodeId: string) => void) | null = null

  constructor() {
    this.el = document.getElementById('reading-pane')!
    this.el.classList.remove('hidden')

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._isOpen) {
        this.close()
      }
    })
  }

  setNavigateHandler(handler: (nodeId: string) => void): void {
    this.navigateHandler = handler
  }

  async open(node: GraphNode, edges: GraphEdge[], allNodes: GraphNode[]): Promise<void> {
    // Fetch essay HTML
    let essayHtml = ''
    try {
      const base = import.meta.env.BASE_URL
      const resp = await fetch(`${base}essays/${node.id}.html`)
      if (resp.ok) {
        essayHtml = await resp.text()
      } else {
        essayHtml = `<h1>${node.title}</h1><p><em>Essay not yet written.</em></p>`
      }
    } catch {
      essayHtml = `<h1>${node.title}</h1><p><em>Essay not yet written.</em></p>`
    }

    // Find connected nodes — handle both string and object source/target (D3 mutates them)
    const connectedIds = new Set<string>()
    for (const edge of edges) {
      const sourceId = typeof edge.source === 'object' ? (edge.source as GraphNode).id : edge.source
      const targetId = typeof edge.target === 'object' ? (edge.target as GraphNode).id : edge.target

      if (sourceId === node.id) connectedIds.add(targetId)
      if (targetId === node.id) connectedIds.add(sourceId)
    }

    const connectedNodes = allNodes.filter((n) => connectedIds.has(n.id))

    // Build connected section
    let connectedHtml = ''
    if (connectedNodes.length > 0) {
      const links = connectedNodes
        .map((n) => `<a href="#" data-node-id="${n.id}">${n.title}</a>`)
        .join('\n')
      connectedHtml = `
        <div class="connected-nodes">
          <h3>Connected to</h3>
          ${links}
        </div>`
    }

    // Render
    this.el.innerHTML = `
      <button class="close-btn" aria-label="Close">&times;</button>
      ${essayHtml}
      ${connectedHtml}`

    // Attach close handler
    this.el.querySelector('.close-btn')!.addEventListener('click', () => this.close())

    // Attach navigate handlers
    this.el.querySelectorAll('[data-node-id]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        const nodeId = (link as HTMLElement).dataset.nodeId!
        if (this.navigateHandler) {
          this.navigateHandler(nodeId)
        }
      })
    })

    // Scroll to top and open
    this.el.scrollTop = 0
    this.el.classList.add('open')
    this._isOpen = true
  }

  close(): void {
    this.el.classList.remove('open')
    this._isOpen = false
  }

  get isOpen(): boolean {
    return this._isOpen
  }
}

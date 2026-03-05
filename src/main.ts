import { createSimulation } from './graph/force'
import { GraphRenderer } from './graph/renderer'
import { ReadingPane } from './reading/pane'
import type { GraphData } from './data/types'
import type { SimulationNode, SimulationEdge } from './graph/force'
import type { ForceLink, ForceCenter } from 'd3-force'

async function init(): Promise<void> {
  // Fetch graph data
  const resp = await fetch('/graph.json')
  const data: GraphData = await resp.json()

  // Set up renderer
  const container = document.getElementById('graph-container')!
  const renderer = new GraphRenderer(container)

  // Create simulation
  const width = renderer.width
  const height = renderer.height
  const simulation = createSimulation(data, width, height)

  // Get edges from the link force (D3 mutates source/target to objects)
  const linkForce = simulation.force('link') as ForceLink<SimulationNode, SimulationEdge>
  const edges = linkForce.links()

  // State
  let hoveredNode: SimulationNode | null = null
  const transform = { x: 0, y: 0, k: 1 }

  // Animation loop
  renderer.startAnimation(() => ({
    nodes: simulation.nodes(),
    edges,
    hoveredNode,
    transform,
  }))

  // Reading pane
  const pane = new ReadingPane()

  // Canvas element for interactions
  const canvas = renderer.element as HTMLCanvasElement

  // --- Hover ---
  canvas.addEventListener('mousemove', (e: MouseEvent) => {
    if (isPanning) return
    const rect = canvas.getBoundingClientRect()
    const gx = (e.clientX - rect.left - transform.x) / transform.k
    const gy = (e.clientY - rect.top - transform.y) / transform.k

    const nodes = simulation.nodes()
    let closest: SimulationNode | null = null
    let closestDist = 20

    for (const node of nodes) {
      const dx = node.x - gx
      const dy = node.y - gy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < closestDist) {
        closest = node
        closestDist = dist
      }
    }

    hoveredNode = closest
    canvas.style.cursor = closest ? 'pointer' : 'default'
  })

  // --- Zoom ---
  canvas.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const factor = e.deltaY < 0 ? 1.05 : 0.95
    const newK = transform.k * factor

    // Zoom toward mouse position
    transform.x = mouseX - (mouseX - transform.x) * (newK / transform.k)
    transform.y = mouseY - (mouseY - transform.y) * (newK / transform.k)
    transform.k = newK
  }, { passive: false })

  // --- Pan ---
  let isPanning = false
  let panStart = { x: 0, y: 0 }

  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    isPanning = true
    panStart = { x: e.clientX - transform.x, y: e.clientY - transform.y }
  })

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isPanning) return
    transform.x = e.clientX - panStart.x
    transform.y = e.clientY - panStart.y
  })

  window.addEventListener('mouseup', () => {
    isPanning = false
  })

  // --- Click ---
  canvas.addEventListener('click', (e: MouseEvent) => {
    if (hoveredNode) {
      openNode(hoveredNode)
    } else if (pane.isOpen) {
      closePane()
    }
  })

  // --- Reading pane navigation ---
  pane.setNavigateHandler((nodeId: string) => {
    const node = simulation.nodes().find((n) => n.id === nodeId)
    if (node) {
      openNode(node)
    }
  })

  // --- Open / Close helpers ---
  function openNode(node: SimulationNode): void {
    container.style.width = '55%'
    pane.open(node, data.edges, data.nodes)
    // Recenter simulation on visible area
    const newWidth = renderer.width
    const centerForce = simulation.force('center') as ForceCenter<SimulationNode>
    if (centerForce) {
      centerForce.x(newWidth / 2).y(height / 2)
    }
    simulation.alpha(0.3).restart()

    // Update URL hash
    window.location.hash = node.id
  }

  function closePane(): void {
    pane.close()
    container.style.width = '100%'
    // Restore center force
    const centerForce = simulation.force('center') as ForceCenter<SimulationNode>
    if (centerForce) {
      centerForce.x(width / 2).y(height / 2)
    }
    simulation.alpha(0.3).restart()

    window.location.hash = ''
  }

  // --- Hash-based routing ---
  function openFromHash(): void {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const node = simulation.nodes().find((n) => n.id === hash)
    if (node) {
      openNode(node)
    }
  }

  // Check hash on init (with delay for simulation to settle)
  if (window.location.hash.length > 1) {
    setTimeout(openFromHash, 500)
  }

  window.addEventListener('hashchange', openFromHash)
}

init()

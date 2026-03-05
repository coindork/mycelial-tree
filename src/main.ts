import { createSimulation } from './graph/force'
import { GraphRenderer } from './graph/renderer'
import { ReadingPane } from './reading/pane'
import type { GraphData } from './data/types'
import type { SimulationNode, SimulationEdge } from './graph/force'
import type { ForceLink, ForceCenter } from 'd3-force'

// --- Intro scroll handling ---
function setupIntro(onComplete: () => void): void {
  const intro = document.getElementById('intro')!
  const sections = document.querySelectorAll('.intro-section')
  const scrollHint = document.querySelector('.intro-scroll-hint')
  const graphContainer = document.getElementById('graph-container')!

  // Initially hide graph
  graphContainer.style.opacity = '0'
  graphContainer.style.transition = 'opacity 1.5s ease'

  // Intersection observer for scroll-triggered text reveals
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
        }
      })
    },
    { threshold: 0.3 }
  )

  sections.forEach((section) => observer.observe(section))

  // Watch scroll position for transition
  let transitioned = false

  function checkScroll(): void {
    if (transitioned) return

    const scrollProgress = window.scrollY / (intro.scrollHeight - window.innerHeight)

    // Hide scroll hint after first scroll
    if (window.scrollY > 100 && scrollHint) {
      scrollHint.classList.add('hidden')
    }

    // Show graph faintly as you scroll deeper
    if (scrollProgress > 0.3) {
      graphContainer.style.opacity = String(Math.min((scrollProgress - 0.3) * 2, 0.4))
    }

    // Full transition when near bottom
    if (scrollProgress > 0.85) {
      transitioned = true
      observer.disconnect()

      // Fade out intro
      intro.style.transition = 'opacity 1s ease'
      intro.style.opacity = '0'
      intro.style.pointerEvents = 'none'

      // Reveal graph fully
      graphContainer.style.opacity = '1'

      // Lock scroll
      setTimeout(() => {
        document.body.classList.add('graph-active')
        intro.style.display = 'none'
        window.scrollTo(0, 0)
        onComplete()
      }, 1000)
    }
  }

  window.addEventListener('scroll', checkScroll, { passive: true })

  // Skip intro if hash is present (direct link to essay)
  if (window.location.hash.length > 1) {
    transitioned = true
    intro.style.display = 'none'
    graphContainer.style.opacity = '1'
    document.body.classList.add('graph-active')
    onComplete()
  }
}

async function init(): Promise<void> {
  // Fetch graph data
  const base = import.meta.env.BASE_URL
  const resp = await fetch(`${base}graph.json`)
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

  // --- Intro ---
  setupIntro(() => {
    // Re-center simulation after intro completes (viewport may have changed)
    const centerForce = simulation.force('center') as ForceCenter<SimulationNode>
    if (centerForce) {
      centerForce.x(renderer.width / 2).y(renderer.height / 2)
    }
    simulation.alpha(0.5).restart()
  })

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

  // --- Clamp transform to keep graph visible ---
  const MIN_ZOOM = 0.6
  const MAX_ZOOM = 2.5

  function clampTransform(): void {
    // Clamp zoom
    transform.k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, transform.k))

    // Find bounding box of all nodes
    const nodes = simulation.nodes()
    if (nodes.length === 0) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of nodes) {
      if (n.x < minX) minX = n.x
      if (n.y < minY) minY = n.y
      if (n.x > maxX) maxX = n.x
      if (n.y > maxY) maxY = n.y
    }

    // Add padding around the graph bounds
    const pad = 200
    const graphW = (maxX - minX) + pad * 2
    const graphH = (maxY - minY) + pad * 2
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    const vw = renderer.width
    const vh = renderer.height

    // Don't let the graph's center go more than half a viewport away from screen center
    const maxPanX = vw * 0.5
    const maxPanY = vh * 0.5

    const idealX = vw / 2 - centerX * transform.k
    const idealY = vh / 2 - centerY * transform.k

    transform.x = Math.max(idealX - maxPanX, Math.min(idealX + maxPanX, transform.x))
    transform.y = Math.max(idealY - maxPanY, Math.min(idealY + maxPanY, transform.y))
  }

  // --- Zoom ---
  canvas.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const factor = e.deltaY < 0 ? 1.02 : 0.98
    const newK = transform.k * factor

    // Zoom toward mouse position
    transform.x = mouseX - (mouseX - transform.x) * (newK / transform.k)
    transform.y = mouseY - (mouseY - transform.y) * (newK / transform.k)
    transform.k = newK
    clampTransform()
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
    clampTransform()
  })

  window.addEventListener('mouseup', () => {
    isPanning = false
  })

  // --- Click ---
  canvas.addEventListener('click', () => {
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

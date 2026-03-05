import { createSimulation } from './graph/force'
import { GraphRenderer } from './graph/renderer'
import type { GraphData } from './data/types'
import type { SimulationNode, SimulationEdge } from './graph/force'
import type { ForceLink, ForceCenter } from 'd3-force'

const FEATURED_NODE_ID = 'the-handedness-of-being'
const FEATURED_QUOTE = 'Infinity is chirality. Wu proved it with cobalt-60. Levinas proved it with the face. Same theorem.'

// --- Intro scroll handling ---
function setupIntro(onComplete: () => void): void {
  const intro = document.getElementById('intro')!
  const sections = document.querySelectorAll('.intro-section')
  const scrollHint = document.querySelector('.intro-scroll-hint')
  const graphContainer = document.getElementById('graph-container')!

  // Initially hide graph
  graphContainer.style.opacity = '0'
  graphContainer.style.transition = 'opacity 1.5s ease'

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

  let transitioned = false

  function checkScroll(): void {
    if (transitioned) return

    const scrollProgress = window.scrollY / (intro.scrollHeight - window.innerHeight)

    if (window.scrollY > 100 && scrollHint) {
      scrollHint.classList.add('hidden')
    }

    if (scrollProgress > 0.3) {
      graphContainer.style.opacity = String(Math.min((scrollProgress - 0.3) * 2, 0.4))
    }

    if (scrollProgress > 0.85) {
      transitioned = true
      observer.disconnect()

      intro.style.transition = 'opacity 1s ease'
      intro.style.opacity = '0'
      intro.style.pointerEvents = 'none'

      graphContainer.style.opacity = '1'

      setTimeout(() => {
        document.body.classList.add('graph-active')
        intro.style.display = 'none'
        window.scrollTo(0, 0)
        onComplete()
      }, 1000)
    }
  }

  window.addEventListener('scroll', checkScroll, { passive: true })

  // Skip intro if hash is present
  if (window.location.hash.length > 1) {
    transitioned = true
    intro.style.display = 'none'
    graphContainer.style.opacity = '1'
    document.body.classList.add('graph-active')
    onComplete()
  }
}

function showQuoteOverlay(): void {
  const overlay = document.getElementById('quote-overlay')
  if (overlay) {
    setTimeout(() => overlay.classList.add('visible'), 800)
  }
}

async function init(): Promise<void> {
  const base = import.meta.env.BASE_URL
  const resp = await fetch(`${base}graph.json`)
  const data: GraphData = await resp.json()

  const container = document.getElementById('graph-container')!
  const renderer = new GraphRenderer(container)

  const width = renderer.width
  const height = renderer.height
  const simulation = createSimulation(data, width, height)

  const linkForce = simulation.force('link') as ForceLink<SimulationNode, SimulationEdge>
  const edges = linkForce.links()

  // Static transform — will be set once simulation settles
  const transform = { x: 0, y: 0, k: 3 }

  // No hover, no interaction — static display
  renderer.startAnimation(() => ({
    nodes: simulation.nodes(),
    edges,
    hoveredNode: null,
    transform,
  }))

  // Wait for simulation to settle, then lock on featured node
  simulation.on('end', () => {
    const featured = simulation.nodes().find((n) => n.id === FEATURED_NODE_ID)
    if (featured) {
      // Center the featured node at 300% zoom
      transform.k = 3
      transform.x = width / 2 - featured.x * transform.k
      transform.y = height / 2 - featured.y * transform.k
    }
  })

  // Also set transform periodically as simulation runs (so it converges visually)
  let ticks = 0
  simulation.on('tick', () => {
    ticks++
    if (ticks % 10 === 0) {
      const featured = simulation.nodes().find((n) => n.id === FEATURED_NODE_ID)
      if (featured) {
        transform.k = 3
        transform.x = width / 2 - featured.x * transform.k
        transform.y = height / 2 - featured.y * transform.k
      }
    }
  })

  // Build the quote overlay
  const quoteEl = document.getElementById('quote-overlay')!
  quoteEl.innerHTML = `<p class="quote-text">${FEATURED_QUOTE}</p><p class="quote-source">— The Handedness of Being</p>`

  setupIntro(() => {
    const centerForce = simulation.force('center') as ForceCenter<SimulationNode>
    if (centerForce) {
      centerForce.x(renderer.width / 2).y(renderer.height / 2)
    }
    simulation.alpha(0.5).restart()
    showQuoteOverlay()
  })

  // If skipping intro (hash link), show quote immediately
  if (window.location.hash.length > 1) {
    showQuoteOverlay()
  }
}

init()

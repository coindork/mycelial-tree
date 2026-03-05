import { computeLayout, BOOK_ORDER } from './graph/force'
import { GraphRenderer } from './graph/renderer'
import type { StaticNode } from './graph/renderer'
import type { GraphData } from './data/types'

// --- Intro scroll handling ---
function setupIntro(onComplete: () => void): void {
  const intro = document.getElementById('intro')!
  const sections = document.querySelectorAll('.intro-section')
  const scrollHint = document.querySelector('.intro-scroll-hint')
  const graphContainer = document.getElementById('graph-container')!

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

  if (window.location.hash.length > 1) {
    transitioned = true
    intro.style.display = 'none'
    graphContainer.style.opacity = '1'
    document.body.classList.add('graph-active')
    onComplete()
  }
}

function buildReadingOrder(allNodes: StaticNode[]): HTMLElement {
  const panel = document.getElementById('reading-order')!
  const list = panel.querySelector('.order-list')!

  // Sort by book order
  const ordered = [...allNodes].sort((a, b) => a.bookOrder - b.bookOrder)

  for (const node of ordered) {
    const item = document.createElement('div')
    item.className = 'order-item'
    item.dataset.nodeId = node.id
    item.innerHTML = `<span class="order-num">${node.bookOrder}.</span><span class="order-title">${node.title}</span>`
    list.appendChild(item)
  }

  return panel
}

function updateReadingOrder(hoveredNode: StaticNode | null, allNodes: StaticNode[]): void {
  const panel = document.getElementById('reading-order')!
  const items = panel.querySelectorAll('.order-item')

  if (!hoveredNode) {
    panel.classList.remove('active')
    return
  }

  panel.classList.add('active')

  // Find connected node IDs
  const connectedIds = new Set<string>()
  connectedIds.add(hoveredNode.id)

  items.forEach((item) => {
    const el = item as HTMLElement
    const nodeId = el.dataset.nodeId!

    if (nodeId === hoveredNode.id) {
      el.className = 'order-item current'
    } else {
      el.className = 'order-item'
    }
  })

  // Scroll the current item into view
  const currentItem = panel.querySelector('.order-item.current')
  if (currentItem) {
    currentItem.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
}

async function init(): Promise<void> {
  const base = import.meta.env.BASE_URL
  const resp = await fetch(`${base}graph.json`)
  const data: GraphData = await resp.json()

  const container = document.getElementById('graph-container')!
  const renderer = new GraphRenderer(container)

  // Compute static layout
  const nodes = computeLayout(data, renderer.width, renderer.height)
  renderer.setData(nodes, data.edges)

  // Build reading order panel
  buildReadingOrder(nodes)

  // Hover handler — show reading order
  renderer.setHoverHandler((node) => {
    updateReadingOrder(node, nodes)
  })

  setupIntro(() => {
    renderer.start()
  })

  // If skipping intro, start immediately
  if (window.location.hash.length > 1) {
    renderer.start()
  }
}

init()

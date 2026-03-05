import { computeLayout } from './graph/force'
import { MoleculeRenderer } from './graph/renderer'
import type { PositionedNode } from './graph/force'
import type { GraphData } from './data/types'

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
        if (entry.isIntersecting) entry.target.classList.add('visible')
      })
    },
    { threshold: 0.3 }
  )
  sections.forEach((section) => observer.observe(section))

  let completed = false

  function checkScroll(): void {
    if (completed) return
    const scrollProgress = window.scrollY / (intro.scrollHeight - window.innerHeight)

    if (window.scrollY > 100 && scrollHint) scrollHint.classList.add('hidden')
    if (window.scrollY <= 100 && scrollHint) scrollHint.classList.remove('hidden')

    // Graph only starts appearing very late
    if (scrollProgress > 0.8) {
      graphContainer.style.opacity = String(Math.min((scrollProgress - 0.8) * 3, 0.4))
    } else {
      graphContainer.style.opacity = '0'
    }

    // Intro text stays fully visible until 90%, then fades
    if (scrollProgress > 0.9) {
      const fade = 1 - (scrollProgress - 0.9) / 0.08
      intro.style.opacity = String(Math.max(fade, 0))
    } else {
      intro.style.opacity = '1'
    }

    // Only transition at the absolute bottom
    if (scrollProgress > 0.98) {
      completed = true
      observer.disconnect()
      intro.style.pointerEvents = 'none'
      graphContainer.style.opacity = '1'

      setTimeout(() => {
        document.body.classList.add('graph-active')
        intro.style.display = 'none'
        window.scrollTo(0, 0)
        onComplete()
      }, 800)
    }
  }

  window.addEventListener('scroll', checkScroll, { passive: true })

  if (window.location.hash.length > 1) {
    completed = true
    intro.style.display = 'none'
    graphContainer.style.opacity = '1'
    document.body.classList.add('graph-active')
    onComplete()
  }
}

function buildSidebar(nodes: PositionedNode[], renderer: MoleculeRenderer): void {
  const list = document.querySelector('.sidebar-list')!
  const ordered = [...nodes].sort((a, b) => a.bookOrder - b.bookOrder)

  for (const node of ordered) {
    const item = document.createElement('div')
    item.className = 'sidebar-item'
    item.dataset.nodeId = node.id
    item.innerHTML = `<span class="item-num">${node.bookOrder}.</span><span class="item-title">${node.title}</span>`

    item.addEventListener('mouseenter', () => {
      renderer.resetTrace(node.id)
      renderer.highlightedNodeId = node.id
      list.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'))
      item.classList.add('active')
    })

    item.addEventListener('mouseleave', () => {
      renderer.highlightedNodeId = null
      item.classList.remove('active')
    })

    list.appendChild(item)
  }
}

function showSidebar(): void {
  setTimeout(() => {
    document.getElementById('sidebar')!.classList.add('visible')
  }, 2000)
}

async function init(): Promise<void> {
  const base = import.meta.env.BASE_URL
  const resp = await fetch(`${base}graph.json`)
  const data: GraphData = await resp.json()

  const container = document.getElementById('graph-container')!
  const renderer = new MoleculeRenderer(container)

  const nodes = computeLayout(data)
  renderer.buildScene(nodes, data.edges)
  buildSidebar(nodes, renderer)

  // Sidebar pulse sync — update active item glow in sync with renderer
  function syncSidebarPulse(): void {
    const activeItem = document.querySelector('.sidebar-item.active .item-num') as HTMLElement | null
    if (activeItem) {
      const p = renderer.currentPulse
      activeItem.style.textShadow = `0 0 ${4 + p * 8}px var(--orange)`
    }
    requestAnimationFrame(syncSidebarPulse)
  }
  requestAnimationFrame(syncSidebarPulse)

  setupIntro(() => {
    renderer.start()
    showSidebar()
  })

  if (window.location.hash.length > 1) {
    renderer.start()
    showSidebar()
  }
}

init()

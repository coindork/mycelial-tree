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

  let transitioned = false

  function checkScroll(): void {
    if (transitioned) return
    const scrollProgress = window.scrollY / (intro.scrollHeight - window.innerHeight)

    if (window.scrollY > 100 && scrollHint) scrollHint.classList.add('hidden')

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

function buildSidebar(nodes: PositionedNode[], renderer: MoleculeRenderer): void {
  const list = document.querySelector('.sidebar-list')!
  const ordered = [...nodes].sort((a, b) => a.bookOrder - b.bookOrder)

  for (const node of ordered) {
    const item = document.createElement('div')
    item.className = 'sidebar-item'
    item.dataset.nodeId = node.id
    item.innerHTML = `<span class="item-num">${node.bookOrder}.</span><span class="item-title">${node.title}</span>`

    item.addEventListener('mouseenter', () => {
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

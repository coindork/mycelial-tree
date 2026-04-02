import { computeLayout, MoleculeRenderer, fetchRemoteGraph, identifyGhosts, mergeForAtlas } from '@vora/mycelial-engine'
import type { PositionedNode, GraphData } from '@vora/mycelial-engine'
import { CHIRALITY_CONFIG, GHOST_CONFIG, CRYPTO_REMOTE_CONFIG } from './config'

// Philosophical terms: essay link + glossary definition
interface TermData { essay?: string; gloss?: string; external?: string }
const TERM_DATA: Record<string, TermData> = {
  // Core Heideggerian vocabulary
  'chirality': { essay: 'chirality', gloss: 'Handedness — the property of an object that cannot be superimposed on its mirror image' },
  'ereignis': { essay: 'the-handedness-of-being', gloss: 'The Event of Appropriation — the happening through which Being and beings are brought into their own' },
  'mitsein': { essay: 'the-handedness-of-being', gloss: 'Being-with — Heidegger\'s term for the structure of encountering others' },
  'dasein': { essay: 'the-handedness-of-being', gloss: 'Being-there — the human being as the entity that questions its own Being' },
  'da-sein': { essay: 'the-handedness-of-being', gloss: 'Being-there — the human being as the entity that questions its own Being' },
  'das man': { essay: 'the-handedness-of-being', gloss: 'The They — the anonymous social mass that levels every distinction' },
  'sorge': { essay: 'care-can-now-be-proved', gloss: 'Care — the ontological ground of human existence in Heidegger' },
  'gestell': { essay: '05-the-filter', gloss: 'Enframing — the essence of modern technology that reduces everything to standing-reserve' },
  'spiegel-spiel': { essay: 'the-five-completions', gloss: 'Mirror-play — the dynamic interplay of the fourfold' },
  'geviert': { essay: 'the-five-completions', gloss: 'The Fourfold — earth, sky, divinities, mortals gathered in the thing' },
  'the fourfold': { essay: 'the-five-completions', gloss: 'Earth, sky, divinities, mortals — the four gathered in every genuine thing' },
  'lichtung': { essay: '06-dwelling-in-the-digital-age', gloss: 'The Clearing — the open space where beings can appear and truth can happen' },
  'being and time': { essay: 'the-handedness-of-being', gloss: 'Heidegger\'s 1927 masterwork on the meaning of Being through temporality' },
  'sein und zeit': { essay: 'the-handedness-of-being', gloss: 'Being and Time — Heidegger\'s 1927 masterwork' },
  'beiträge': { essay: 'the-five-completions', gloss: 'Contributions to Philosophy — Heidegger\'s secret second masterwork (1936-38)' },
  'beiträge zur philosophie': { essay: 'the-five-completions', gloss: 'Contributions to Philosophy (Of the Event) — Heidegger\'s secret second masterwork' },
  'beiträge zur philosophie (vom ereignis)': { essay: 'the-five-completions', gloss: 'Contributions to Philosophy (Of the Event)' },
  'contributions to philosophy': { essay: 'the-five-completions', gloss: 'Heidegger\'s secret second masterwork, written 1936-38' },
  'gegenschwung': { essay: 'the-five-completions', gloss: 'Counter-resonance — the reciprocal swing between Being\'s call and Da-sein\'s response' },
  'cete': { essay: 'the-cete', gloss: 'A gathering of badgers — here, a federation of sovereign nodes' },
  'poiesis': { essay: '06-dwelling-in-the-digital-age', gloss: 'Bringing-forth — the mode of revealing that lets things come into presence, opposite of Gestell' },
  'letter on humanism': { essay: 'the-handedness-of-being', gloss: 'Heidegger\'s 1947 response to Sartre, redefining humanism through Being' },
  'er-eignen': { essay: 'the-handedness-of-being', gloss: 'To bring into one\'s own — the root verb of Ereignis' },
  'kehre': { essay: 'the-chiral-completion', gloss: 'The Turn — Heidegger\'s shift from Dasein-centered to Being-centered thinking' },
  'aletheia': { essay: '06-dwelling-in-the-digital-age', gloss: 'Un-concealment — truth as the process of bringing into the open' },
  'a-letheia': { essay: '06-dwelling-in-the-digital-age', gloss: 'Un-concealment — truth as emerging from hiddenness' },
  'angst': { essay: 'the-handedness-of-being', gloss: 'Anxiety — the fundamental mood that reveals Dasein\'s being-toward-death' },
  'gelassenheit': { essay: '06-dwelling-in-the-digital-age', gloss: 'Releasement — letting-be, an openness to the mystery of Being' },
  'wink': { essay: 'the-five-completions', gloss: 'The hint or beckoning of the Last God — a signal, not a revelation' },
  'der vorbeigang': { essay: 'the-five-completions', gloss: 'The passing-by — how the Last God passes without arriving' },
  'der letzte gott': { essay: 'the-five-completions', gloss: 'The Last God — not a deity but the ultimate encounter that hints without disclosing' },
  'der riss': { essay: 'the-five-completions', gloss: 'The rift — the creative tension between earth and world' },
  'bauen': { essay: '06-dwelling-in-the-digital-age', gloss: 'Building — from the Old High German buan, to dwell' },
  'bauen wohnen denken': { essay: '06-dwelling-in-the-digital-age', gloss: 'Building Dwelling Thinking — Heidegger\'s 1951 lecture' },
  'bauen, wohnen, denken': { essay: '06-dwelling-in-the-digital-age', gloss: 'Building Dwelling Thinking — Heidegger\'s 1951 lecture' },
  'the question concerning technology': { essay: '05-the-filter', gloss: 'Heidegger\'s 1953 lecture on technology as a mode of revealing' },
  'seinsfrage': { essay: 'the-handedness-of-being', gloss: 'The question of Being — the fundamental question of philosophy' },
  'gerede': { essay: 'the-handedness-of-being', gloss: 'Idle talk — inauthentic discourse that circulates without ground' },
  'die sage': { essay: '05-the-filter', gloss: 'The Saying — language as the event of address, prior to any said content' },
  'staunen': { essay: 'the-handedness-of-being', gloss: 'Wonder — the ground mood of philosophy' },
  // Levinas
  'totality and infinity': { essay: 'the-handedness-of-being', gloss: 'Levinas\'s 1961 masterwork on the ethical relation to the Other' },
  // Agamben
  'homo sacer': { essay: 'chirality-agamben', gloss: 'Sacred man — the figure who can be killed but not sacrificed, stripped of political life' },
  'forma-di-vita': { essay: 'chirality-agamben', gloss: 'Form-of-life — a life inseparable from its form, where living and its mode are one' },
  // Latin/general philosophical
  'veritas, non auctoritas, facit legem.': { essay: '11-the-event-of-logic', gloss: 'Truth, not authority, makes law — Hobbes inverted' },
  'veritas, non auctoritas, facit legem': { essay: '11-the-event-of-logic', gloss: 'Truth, not authority, makes law' },
  'veritas non auctoritas facit legem.': { essay: '11-the-event-of-logic', gloss: 'Truth, not authority, makes law' },
  'veritas, non auctoritas.': { essay: '11-the-event-of-logic', gloss: 'Truth, not authority' },
  'sapere aude': { gloss: 'Dare to know — Kant\'s motto for Enlightenment' },
  'sapere aude.': { gloss: 'Dare to know — Kant\'s motto for Enlightenment' },
  'cogito ergo sum.': { gloss: 'I think therefore I am — Descartes\' foundational certainty' },
  'foedus pacificum': { essay: 'the-cete', gloss: 'Kant\'s pacific federation — sovereignty preserved through voluntary cooperation' },
  'cheir': { gloss: 'Greek: hand — the root of chirality' },
  // Essay titles (current and former)
  'the handedness of being': { essay: 'the-handedness-of-being' },
  'the five completions': { essay: 'the-five-completions' },
  'the beiträge completed': { essay: 'the-five-completions' },
  'the chiral completion': { essay: 'the-chiral-completion' },
  'the mycorrhizal turn': { essay: 'the-chiral-completion' },
  'the filter': { essay: '05-the-filter' },
  'the question concerning the filter': { essay: '05-the-filter' },
  'the proof of love': { essay: 'the-proof-of-love' },
  'the passage': { essay: 'the-passage' },
  'der übergang': { essay: 'the-passage', gloss: 'The passage — the crossing between worlds' },
  'tuesday in the clearing': { essay: 'tuesday-in-the-clearing' },
  'the cete': { essay: 'the-cete' },
  'mitsein at last': { essay: 'the-cete' },
  'chirality and agamben': { essay: 'chirality-agamben' },
  'the sovereign hand': { essay: 'chirality-agamben' },
  'the chiral pedagogy': { essay: 'chiral-pedagogy' },
  'dwelling with the other hand': { essay: 'chiral-pedagogy' },
  'dwelling in the digital age': { essay: '06-dwelling-in-the-digital-age' },
  'building dwelling thinking again': { essay: '06-dwelling-in-the-digital-age' },
  'the event of logic': { essay: '11-the-event-of-logic' },
  'the question concerning care': { essay: 'care-can-now-be-proved' },
  'theses on chirality': { essay: 'theses-on-chirality' },
  'the constellation': { essay: 'the-constellation' },
  'the encounter': { essay: 'chirality' },
  'theses on feuerbach': { gloss: 'Marx\'s eleven theses (1845) — "Philosophers have only interpreted the world..."' },
  'remnants of auschwitz': { essay: 'chirality-agamben', gloss: 'Agamben\'s meditation on testimony, the witness, and the Muselmann' },
  // Cryptosovereignty vocabulary — cross-site links
  'cryptosovereignty': { essay: '01-cryptosovereignty', gloss: 'The sovereign power of cryptography — legitimacy grounded in mathematical truth', external: 'https://coindork.github.io/cryptosovereignty/' },
  'veritas non auctoritas': { essay: '01-cryptosovereignty', gloss: 'Truth, not authority, makes law — the inversion of Hobbes', external: 'https://coindork.github.io/cryptosovereignty/' },
  'leviathan': { essay: '07-the-sovereign-the-subject', gloss: 'Hobbes\' absolute sovereign — the political form Bitcoin replaces', external: 'https://coindork.github.io/cryptosovereignty/' },
  'partisan': { essay: '16-theory-of-the-crypto-partisan', gloss: 'The irregular fighter — the crypto-partisan operates in deterritorialized digital space', external: 'https://coindork.github.io/cryptosovereignty/' },
  'messianic': { essay: '12-messianic-bitcoin', gloss: 'Benjamin\'s weak messianic power — the redemptive force hidden in Bitcoin', external: 'https://coindork.github.io/cryptosovereignty/' },
  'eidgenossenschaft': { essay: 'ext-the-solitary-sovereign', gloss: 'Oath-fellowship — sovereign beings swearing mutual aid without surrendering sovereignty', external: 'https://coindork.github.io/cryptosovereignty/' },
  'sovereign mutualism': { essay: 'ext-sovereign-mutualism', gloss: 'Federation of sovereign clearings, each strengthened by every other', external: 'https://coindork.github.io/cryptosovereignty/' },
  'the clearing': { essay: '06-dwelling-in-the-digital-age', gloss: 'Heidegger\'s Lichtung — the space where truth presences, kept open by refusal to fill it' },
  'sovereign stack': { essay: 'ext-first-philosophy', gloss: 'Value \u2192 Communication \u2192 Cognition \u2192 Peoplehood — the four clearings', external: 'https://coindork.github.io/cryptosovereignty/' },
}

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
  const heading = document.querySelector('.sidebar-heading')!
  list.innerHTML = ''

  const order = CHIRALITY_CONFIG.readingOrder
  heading.textContent = 'Reading Order'

  // Filter nodes to this cluster's order and sort by position in that order
  const orderMap = new Map(order.map((id, i) => [id, i + 1]))
  const clusterNodes = nodes
    .filter(n => orderMap.has(n.id))
    .sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99))

  for (const node of clusterNodes) {
    const num = orderMap.get(node.id) ?? 99
    const item = document.createElement('div')
    item.className = 'sidebar-item'
    item.dataset.nodeId = node.id
    item.innerHTML = `<span class="item-num">${num}.</span><span class="item-title">${node.title}</span>`

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

    item.addEventListener('click', () => {
      openEssay(node.id)
    })

    list.appendChild(item)
  }
}

let currentRenderer: MoleculeRenderer | null = null

async function openEssay(id: string): Promise<void> {
  const reader = document.getElementById('essay-reader')!
  const content = reader.querySelector('.reader-content')!

  content.innerHTML = '<p style="color: var(--text-dim);">Loading…</p>'
  reader.classList.add('open')

  const base = import.meta.env.BASE_URL
  const resp = await fetch(`${base}essays/${id}.html`)
  if (resp.ok) {
    content.innerHTML = await resp.text()
    content.scrollTop = 0
    linkifyTerms(content)
  } else {
    content.innerHTML = '<p style="color: var(--text-dim);">Essay not found.</p>'
  }
}

function linkifyTerms(container: Element): void {
  const emElements = container.querySelectorAll('em')

  for (const em of emElements) {
    const text = em.textContent?.trim() || ''
    const lower = text.toLowerCase().replace(/[""]/g, '"').replace(/['']/g, "'")

    // Try exact match, then without trailing punctuation
    let data = TERM_DATA[lower]
    if (!data) {
      const stripped = lower.replace(/[.,;:!?]$/, '').trim()
      data = TERM_DATA[stripped]
    }

    if (!data) continue

    const essayId = data.essay

    if (essayId) {
      // Clickable link to essay
      const link = document.createElement('a')
      link.className = 'term-link'
      link.textContent = text
      link.href = '#'
      link.dataset.essayId = essayId
      if (data.gloss) link.title = data.gloss

      link.addEventListener('mouseenter', () => {
        if (currentRenderer) {
          currentRenderer.resetTrace(essayId)
          currentRenderer.highlightedNodeId = essayId
        }
      })

      link.addEventListener('mouseleave', () => {
        if (currentRenderer) {
          currentRenderer.highlightedNodeId = null
        }
      })

      link.addEventListener('click', (e) => {
        e.preventDefault()
        if (data.external) {
          window.location.href = data.external + '#' + essayId
        } else {
          openEssay(essayId)
        }
      })

      em.replaceWith(link)
    } else if (data.gloss) {
      // Glossary-only term — tooltip but no link
      const span = document.createElement('span')
      span.className = 'term-gloss'
      span.textContent = text
      span.title = data.gloss
      em.replaceWith(span)
    }
  }
}

function setupReader(): void {
  const reader = document.getElementById('essay-reader')!
  const closeBtn = reader.querySelector('.reader-close')!

  closeBtn.addEventListener('click', () => {
    reader.classList.remove('open')
  })

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') reader.classList.remove('open')
  })
}

function showSidebar(): void {
  setTimeout(() => {
    document.getElementById('sidebar')!.classList.add('visible')
    document.getElementById('cluster-nav')?.classList.add('visible')
  }, 2000)
}

function setupClusterNav(nodes: PositionedNode[], renderer: MoleculeRenderer, data: GraphData): void {
  let activeMode: 'chirality' | 'atlas' = 'chirality'
  const nav = document.getElementById('cluster-nav')!
  const labels = nav.querySelectorAll('.cluster-label[data-cluster]')

  labels.forEach(label => {
    label.addEventListener('click', async () => {
      const mode = (label as HTMLElement).dataset.cluster as 'chirality' | 'atlas'
      if (mode === activeMode) return

      activeMode = mode

      if (mode === 'chirality') {
        // Rebuild single constellation scene
        const singleNodes = computeLayout(data, [CHIRALITY_CONFIG])
        renderer.clearScene()
        renderer.buildScene(singleNodes, data.edges)
        renderer.travelToCluster('chirality')
        buildSidebar(singleNodes, renderer)
      } else if (mode === 'atlas') {
        const remoteData = await fetchRemoteGraph(GHOST_CONFIG.remoteGraphUrl)
        if (!remoteData) {
          console.warn('Could not load remote graph for atlas mode')
          return
        }
        const merged = mergeForAtlas(data, remoteData)
        const atlasConfigs = [
          { ...CHIRALITY_CONFIG, clusterCenter: { x: 200, y: 0 } },
          { ...CRYPTO_REMOTE_CONFIG, clusterCenter: { x: -200, y: 0 } },
        ]
        const atlasNodes = computeLayout(merged, atlasConfigs)
        renderer.clearScene()
        renderer.buildAtlasScene(atlasNodes, merged.edges, atlasConfigs)
        renderer.pullBackCamera()
        // Update sidebar to show chirality reading order in atlas view
        buildSidebar(atlasNodes, renderer)
      }

      // Update active label
      labels.forEach(l => l.classList.remove('active'))
      label.classList.add('active')
    })
  })
}

async function init(): Promise<void> {
  const base = import.meta.env.BASE_URL
  const resp = await fetch(`${base}graph.json`)
  const data: GraphData = await resp.json()

  const container = document.getElementById('graph-container')!
  const renderer = new MoleculeRenderer(container, CHIRALITY_CONFIG)
  currentRenderer = renderer

  const nodes = computeLayout(data, [CHIRALITY_CONFIG])
  renderer.buildScene(nodes, data.edges)
  renderer.onNodeClick = (nodeId) => {
    if (ghostIds.has(nodeId)) {
      window.location.href = `${GHOST_CONFIG.remoteSiteUrl}#${nodeId}`
      return
    }
    renderer.focusNode(nodeId)
    openEssay(nodeId)
  }
  buildSidebar(nodes, renderer)
  setupReader()
  setupClusterNav(nodes, renderer, data)

  // Track ghost node IDs so click handler can route to remote site
  const ghostIds = new Set<string>()

  // Fetch ghost nodes from the remote constellation (non-blocking)
  fetchRemoteGraph(GHOST_CONFIG.remoteGraphUrl).then(remoteData => {
    if (!remoteData) return
    const { ghostNodes, ghostEdges } = identifyGhosts(data, remoteData, GHOST_CONFIG)
    if (ghostNodes.length === 0) return
    for (const g of ghostNodes) ghostIds.add(g.id)
    // Position ghost nodes: run layout with both sets, extract ghost positions
    const allNodes = [...data.nodes, ...ghostNodes]
    const allEdges = [...data.edges, ...ghostEdges]
    const allPositioned = computeLayout({ nodes: allNodes, edges: allEdges }, [CHIRALITY_CONFIG])
    const ghostPositioned = allPositioned.filter(n => ghostNodes.some(g => g.id === n.id))
    // Push ghosts back in z
    for (const g of ghostPositioned) g.z -= 40
    renderer.addGhostNodes(ghostPositioned, ghostEdges, GHOST_CONFIG.remoteColor, 0xD4A853, GHOST_CONFIG.remoteSiteUrl)
  })

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
    const essayId = window.location.hash.slice(1)
    renderer.start()
    showSidebar()
    renderer.highlightedNodeId = essayId
    openEssay(essayId)
  }
}

init().catch(err => {
  console.error('Initialization failed:', err)
  const container = document.getElementById('graph-container')
  if (container) {
    container.innerHTML = '<p style="color:#888;padding:2rem;font-family:system-ui;">Could not load visualization. Please try refreshing the page.</p>'
  }
})

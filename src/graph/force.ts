import * as d3 from 'd3'
import type { GraphData, GraphNode, GraphEdge } from '../data/types'

const FEATURED_NODE_ID = 'the-handedness-of-being'

export const BOOK_ORDER: string[] = [
  'the-handedness-of-being',
  'theses-on-chirality',
  'the-five-completions',
  '05-the-filter',
  'chirality-agamben',
  'care-can-now-be-proved',
  'chirality',
  'the-chiral-completion',
  'chiral-pedagogy',
  '06-dwelling-in-the-digital-age',
  'the-proof-of-love',
  '11-the-event-of-logic',
  'the-passage',
  'tuesday-in-the-clearing',
  'the-cete',
]

export interface PositionedNode extends GraphNode {
  x: number
  y: number
  z: number
  radius: number
  bookOrder: number
}

interface ForceNode extends GraphNode {
  x: number
  y: number
  vx: number
  vy: number
}

type ForceEdge = d3.SimulationLinkDatum<ForceNode> & GraphEdge

/**
 * Word-cloud / association layout:
 * - Connected nodes pull close together (short link distance)
 * - Node size proportional to connectionCount (word cloud effect)
 * - Gentle charge keeps things from overlapping
 * - Z-axis adds depth based on hand property
 * - Featured node pinned at center
 */
export function computeLayout(data: GraphData): PositionedNode[] {
  const nodes: ForceNode[] = data.nodes.map((n) => ({
    ...n,
    x: (Math.random() - 0.5) * 100,
    y: (Math.random() - 0.5) * 100,
    vx: 0,
    vy: 0,
  }))

  // Pin featured node at center
  const featured = nodes.find(n => n.id === FEATURED_NODE_ID)
  if (featured) {
    featured.x = 0
    featured.y = 0
    ;(featured as any).fx = 0
    ;(featured as any).fy = 0
  }

  const edges: ForceEdge[] = data.edges.map((e) => ({ ...e }))

  const simulation = d3
    .forceSimulation<ForceNode, ForceEdge>(nodes)
    .force(
      'link',
      d3.forceLink<ForceNode, ForceEdge>(edges)
        .id((d) => d.id)
        .distance((d) => {
          // Strongly connected nodes cluster tight
          const weight = (d as ForceEdge).weight
          return weight >= 3 ? 25 : 45
        })
        .strength(0.6)
    )
    .force(
      'charge',
      d3.forceManyBody<ForceNode>().strength(-80)
    )
    .force('center', d3.forceCenter(0, 0).strength(0.03))
    .force(
      'collision',
      d3.forceCollide<ForceNode>().radius((d) => {
        // Bigger collision radius for bigger nodes — word cloud spacing
        const r = 2 + d.connectionCount * 0.8
        return r * 3 + 8
      }).strength(0.9)
    )
    .stop()

  // Run to completion
  for (let i = 0; i < 400; i++) simulation.tick()

  // Release pin
  if (featured) {
    ;(featured as any).fx = null
    ;(featured as any).fy = null
  }

  // Recenter
  if (featured) {
    const dx = featured.x, dy = featured.y
    for (const node of nodes) { node.x -= dx; node.y -= dy }
  }

  return nodes.map((n): PositionedNode => {
    const orderIndex = BOOK_ORDER.indexOf(n.id)
    const baseRadius = 2 + n.connectionCount * 0.8
    const radius = n.id === FEATURED_NODE_ID ? baseRadius * 1.5 : baseRadius

    // Z from hand property — gives depth
    let z = (Math.random() - 0.5) * 20
    if (n.id !== FEATURED_NODE_ID) {
      if (n.hand === 'left') z -= 25
      else if (n.hand === 'right') z += 25
    }

    return {
      ...n,
      z,
      radius,
      bookOrder: orderIndex >= 0 ? orderIndex + 1 : 99,
    }
  })
}

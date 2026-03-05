import * as d3 from 'd3'
import type { GraphData, GraphNode, GraphEdge } from '../data/types'

const FEATURED_NODE_ID = 'the-handedness-of-being'

// Reading order — the essays as a book
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

function initZ(node: GraphNode): number {
  if (node.id === FEATURED_NODE_ID) return 0
  if (node.hand === 'left') return -40 + (Math.random() - 0.5) * 60
  if (node.hand === 'right') return 40 + (Math.random() - 0.5) * 60
  return (Math.random() - 0.5) * 30
}

export function computeLayout(data: GraphData): PositionedNode[] {
  const nodes: ForceNode[] = data.nodes.map((n) => ({
    ...n,
    x: (Math.random() - 0.5) * 200,
    y: (Math.random() - 0.5) * 200,
    vx: 0,
    vy: 0,
  }))

  const edges: ForceEdge[] = data.edges.map((e) => ({ ...e }))

  const connectedIds = new Set<string>()
  for (const edge of data.edges) {
    connectedIds.add(edge.source)
    connectedIds.add(edge.target)
  }

  const simulation = d3
    .forceSimulation<ForceNode, ForceEdge>(nodes)
    .force(
      'link',
      d3.forceLink<ForceNode, ForceEdge>(edges)
        .id((d) => d.id)
        .distance((d) => Math.max(30, 120 / Math.max((d as ForceEdge).weight, 0.1)))
        .strength(0.4)
    )
    .force('charge', d3.forceManyBody<ForceNode>().strength((d) =>
      connectedIds.has(d.id) ? -200 : -80
    ))
    .force('center', d3.forceCenter(0, 0).strength(0.05))
    .force('collision', d3.forceCollide<ForceNode>().radius(20).strength(0.7))
    .stop()

  for (let i = 0; i < 300; i++) simulation.tick()

  // Recenter on featured node
  const featured = nodes.find((n) => n.id === FEATURED_NODE_ID)
  if (featured) {
    const dx = featured.x, dy = featured.y
    for (const node of nodes) { node.x -= dx; node.y -= dy }
  }

  return nodes.map((n): PositionedNode => {
    const orderIndex = BOOK_ORDER.indexOf(n.id)
    const baseRadius = 2 + n.connectionCount * 0.8
    const radius = n.id === FEATURED_NODE_ID ? baseRadius * 1.5 : baseRadius

    return {
      ...n,
      z: initZ(n),
      radius,
      bookOrder: orderIndex >= 0 ? orderIndex + 1 : 99,
    }
  })
}

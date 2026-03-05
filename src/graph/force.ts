import * as d3 from 'd3'
import type { GraphData, GraphNode, GraphEdge } from '../data/types'
import type { StaticNode } from './renderer'

// Reading order — the essays as a book
const BOOK_ORDER: string[] = [
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

interface ForceNode extends GraphNode {
  x: number
  y: number
  vx: number
  vy: number
}

type ForceEdge = d3.SimulationLinkDatum<ForceNode> & GraphEdge

/**
 * Run force simulation to completion and return static positioned nodes.
 */
export function computeLayout(data: GraphData, width: number, height: number): StaticNode[] {
  const nodes: ForceNode[] = data.nodes.map((n) => ({
    ...n,
    x: width / 2 + (Math.random() - 0.5) * width * 0.4,
    y: height / 2 + (Math.random() - 0.5) * height * 0.4,
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
      d3
        .forceLink<ForceNode, ForceEdge>(edges)
        .id((d) => d.id)
        .distance((d) => {
          const weight = (d as ForceEdge).weight
          return Math.max(50, 180 / Math.max(weight, 0.1))
        })
        .strength(0.3)
    )
    .force(
      'charge',
      d3.forceManyBody<ForceNode>().strength((d) =>
        connectedIds.has(d.id) ? -400 : -150
      )
    )
    .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
    .force(
      'collision',
      d3.forceCollide<ForceNode>().radius(40).strength(0.8)
    )
    .stop()

  // Run to completion
  for (let i = 0; i < 300; i++) {
    simulation.tick()
  }

  // Convert to static nodes with book order and radius
  return nodes.map((n): StaticNode => {
    const orderIndex = BOOK_ORDER.indexOf(n.id)
    const baseRadius = Math.max(5, Math.min(14, 3 + n.connectionCount * 1.5))

    return {
      ...n,
      radius: baseRadius,
      bookOrder: orderIndex >= 0 ? orderIndex + 1 : 99,
    }
  })
}

export { BOOK_ORDER }

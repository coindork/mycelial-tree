import * as d3 from 'd3'
import type { GraphData, GraphNode, GraphEdge } from '../data/types'

const FEATURED_NODE_ID = 'the-handedness-of-being'

export interface SimulationNode extends GraphNode {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
}

export type SimulationEdge = d3.SimulationLinkDatum<SimulationNode> & GraphEdge

function initZ(node: GraphNode): number {
  if (node.id === FEATURED_NODE_ID) return 0
  if (node.hand === 'left') return -40 + (Math.random() - 0.5) * 60
  if (node.hand === 'right') return 40 + (Math.random() - 0.5) * 60
  return (Math.random() - 0.5) * 30
}

export function createSimulation(
  data: GraphData
): d3.Simulation<SimulationNode, SimulationEdge> {
  const nodes: SimulationNode[] = data.nodes.map((n) => ({
    ...n,
    x: (Math.random() - 0.5) * 200,
    y: (Math.random() - 0.5) * 200,
    z: initZ(n),
    vx: 0,
    vy: 0,
    vz: 0,
  }))

  const edges: SimulationEdge[] = data.edges.map((e) => ({ ...e }))

  const connectedIds = new Set<string>()
  for (const edge of data.edges) {
    connectedIds.add(edge.source)
    connectedIds.add(edge.target)
  }

  const simulation = d3
    .forceSimulation<SimulationNode, SimulationEdge>(nodes)
    .force(
      'link',
      d3
        .forceLink<SimulationNode, SimulationEdge>(edges)
        .id((d) => d.id)
        .distance((d) => {
          const weight = (d as SimulationEdge).weight
          return Math.max(30, 120 / Math.max(weight, 0.1))
        })
        .strength(0.4)
    )
    .force(
      'charge',
      d3.forceManyBody<SimulationNode>().strength((d) =>
        connectedIds.has(d.id) ? -200 : -80
      )
    )
    .force('center', d3.forceCenter(0, 0).strength(0.05))
    .force(
      'collision',
      d3.forceCollide<SimulationNode>().radius(20).strength(0.7)
    )

  // Manual z-forces on each tick
  simulation.on('tick.z', () => {
    for (const node of nodes) {
      // Weak centering toward z=0
      node.vz -= node.z * 0.003

      // Z-repulsion between nodes close in x/y
      for (const other of nodes) {
        if (node === other) continue
        const dx = node.x - other.x
        const dy = node.y - other.y
        const dz = node.z - other.z
        const dist2d = Math.sqrt(dx * dx + dy * dy)
        if (dist2d < 60 && Math.abs(dz) < 20) {
          const push = dz === 0 ? (Math.random() - 0.5) * 2 : (dz > 0 ? 1 : -1) * 0.3
          node.vz += push
        }
      }

      node.z += node.vz
      node.vz *= 0.85 // damping
    }
  })

  // After simulation settles, apply helical twist and recenter on featured node
  simulation.on('end', () => {
    // Helical twist based on angular position
    for (const node of nodes) {
      if (node.id === FEATURED_NODE_ID) continue
      const angle = Math.atan2(node.y, node.x)
      if (node.hand === 'left') {
        node.z += Math.sin(angle) * 20
      } else if (node.hand === 'right') {
        node.z += Math.cos(angle) * 20
      }
    }

    // Recenter so featured node is at origin
    const featured = nodes.find((n) => n.id === FEATURED_NODE_ID)
    if (featured) {
      const dx = featured.x
      const dy = featured.y
      const dz = featured.z
      for (const node of nodes) {
        node.x -= dx
        node.y -= dy
        node.z -= dz
      }
    }
  })

  return simulation
}

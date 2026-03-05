import * as d3 from 'd3'
import type { GraphData, GraphNode, GraphEdge } from '../data/types'

export interface SimulationNode extends GraphNode {
  x: number
  y: number
  vx: number
  vy: number
}

export type SimulationEdge = d3.SimulationLinkDatum<SimulationNode> & GraphEdge

export function createSimulation(
  data: GraphData,
  width: number,
  height: number
): d3.Simulation<SimulationNode, SimulationEdge> {
  const nodes: SimulationNode[] = data.nodes.map((n) => ({
    ...n,
    x: n.x ?? width / 2 + (Math.random() - 0.5) * width * 0.5,
    y: n.y ?? height / 2 + (Math.random() - 0.5) * height * 0.5,
    vx: n.vx ?? 0,
    vy: n.vy ?? 0,
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
          return Math.max(40, 200 / Math.max(weight, 0.1))
        })
        .strength(0.3)
    )
    .force(
      'charge',
      d3.forceManyBody<SimulationNode>().strength((d) =>
        connectedIds.has(d.id) ? -300 : -100
      )
    )
    .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
    .force(
      'collision',
      d3.forceCollide<SimulationNode>().radius(30).strength(0.7)
    )

  return simulation
}

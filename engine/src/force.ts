import * as d3 from 'd3'
import type { GraphData, GraphNode, GraphEdge, PositionedNode, ConstellationConfig } from './types'

interface ForceNode extends GraphNode {
  x: number
  y: number
  vx: number
  vy: number
  cluster: string
}

type ForceEdge = d3.SimulationLinkDatum<ForceNode> & GraphEdge

/**
 * Word-cloud / association layout:
 * - Connected nodes pull close together (short link distance)
 * - Node size proportional to connectionCount (word cloud effect)
 * - Gentle charge keeps things from overlapping
 * - Z-axis adds depth based on hand property
 * - Clusters with separate centers, driven by ConstellationConfig[]
 * - Featured nodes pinned at their cluster centers
 * - When nodes have `hint` positions, the layout preserves intentional structure
 *   with a gentle force simulation for organic refinement
 */
export function computeLayout(data: GraphData, configs: ConstellationConfig[]): PositionedNode[] {
  // Build lookup maps from configs
  const clusterCenters: Record<string, { x: number; y: number }> = {}
  const featuredNodes = new Set<string>()
  const readingOrders: Record<string, string[]> = {}

  for (const config of configs) {
    clusterCenters[config.name] = config.clusterCenter
    featuredNodes.add(config.featuredNode)
    readingOrders[config.name] = config.readingOrder
  }

  // Check if any nodes have hints — if so, use seeded layout mode
  const hasHints = data.nodes.some(n => n.hint != null)

  // Deterministic seeded random for consistent layout across loads
  let seed = 42
  function seededRandom(): number {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  const nodes: ForceNode[] = data.nodes.map((n) => {
    const center = clusterCenters[n.cluster] ?? { x: 0, y: 0 }

    let x: number, y: number
    if (n.hint) {
      // Use hint position with tiny jitter for organic feel
      x = center.x + n.hint.x + (seededRandom() - 0.5) * 4
      y = center.y + n.hint.y + (seededRandom() - 0.5) * 4
    } else {
      x = center.x + (seededRandom() - 0.5) * 100
      y = center.y + (seededRandom() - 0.5) * 100
    }

    return {
      ...n,
      x,
      y,
      vx: 0,
      vy: 0,
    }
  })

  // Pin featured nodes at their cluster centers
  for (const node of nodes) {
    if (featuredNodes.has(node.id)) {
      const center = clusterCenters[node.cluster] ?? { x: 0, y: 0 }
      node.x = center.x
      node.y = center.y
      ;(node as any).fx = center.x
      ;(node as any).fy = center.y
    }
  }

  const edges: ForceEdge[] = data.edges.map((e) => ({ ...e }))

  // Build a node-id-to-cluster lookup for bridge detection
  const clusterOf = new Map<string, string>()
  for (const n of nodes) clusterOf.set(n.id, n.cluster)

  // Build hint lookup for anchor force
  const hintMap = new Map<string, { x: number; y: number }>()
  if (hasHints) {
    for (const n of data.nodes) {
      if (n.hint) {
        const center = clusterCenters[n.cluster] ?? { x: 0, y: 0 }
        hintMap.set(n.id, { x: center.x + n.hint.x, y: center.y + n.hint.y })
      }
    }
  }

  // Adjust simulation parameters based on whether hints are present
  const chargeStrength = hasHints ? -120 : -180
  const iterations = hasHints ? 180 : 400
  const anchorStrength = 0.08 // How strongly hinted nodes pull back to their intended position

  const simulation = d3
    .forceSimulation<ForceNode, ForceEdge>(nodes)
    .force(
      'link',
      d3.forceLink<ForceNode, ForceEdge>(edges)
        .id((d) => d.id)
        .distance((d) => {
          const fe = d as ForceEdge
          const srcCluster = clusterOf.get(fe.source as string)
          const tgtCluster = clusterOf.get(fe.target as string)
          // Bridge edges get longer distance to maintain separation
          if (srcCluster !== tgtCluster) return 150
          const weight = fe.weight
          return weight >= 3 ? 35 : 55
        })
        // Let d3 auto-weaken links for high-degree nodes
    )
    .force(
      'charge',
      d3.forceManyBody<ForceNode>().strength(chargeStrength)
    )
    .force('center', d3.forceCenter(0, 0).strength(0.02))
    .force(
      'collision',
      d3.forceCollide<ForceNode>().radius((d) => {
        const r = 2 + d.connectionCount * 0.8
        return r * 3 + 12
      }).strength(0.8)
    )
    .force('cluster', () => {
      // Gentle attractor pulling each node toward its cluster center
      for (const node of nodes) {
        const center = clusterCenters[node.cluster]
        if (!center) continue
        // Skip pinned nodes
        if ((node as any).fx != null) continue
        node.vx += (center.x - node.x) * 0.03
        node.vy += (center.y - node.y) * 0.03
      }
    })

  // Add anchor force when hints are present — pulls nodes back toward intended positions
  if (hasHints) {
    simulation.force('anchor', () => {
      for (const node of nodes) {
        if ((node as any).fx != null) continue
        const hint = hintMap.get(node.id)
        if (!hint) continue
        node.vx += (hint.x - node.x) * anchorStrength
        node.vy += (hint.y - node.y) * anchorStrength
      }
    })
  }

  simulation.stop()

  // Run to completion
  for (let i = 0; i < iterations; i++) simulation.tick()

  // Release pins
  for (const node of nodes) {
    if (featuredNodes.has(node.id)) {
      ;(node as any).fx = null
      ;(node as any).fy = null
    }
  }

  return nodes.map((n): PositionedNode => {
    const isFeatured = featuredNodes.has(n.id)
    const order = readingOrders[n.cluster] ?? []
    const orderIndex = order.indexOf(n.id)
    const baseRadius = 2 + n.connectionCount * 0.8
    const radius = isFeatured ? baseRadius * 1.5 : baseRadius

    // Z from hand property — gives depth within each cluster independently
    // Use seeded random for deterministic z jitter
    let z = (seededRandom() - 0.5) * 20
    if (!isFeatured) {
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

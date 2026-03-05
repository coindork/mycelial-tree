import * as d3 from 'd3'
import type { GraphData, GraphNode, GraphEdge } from '../data/types'

const CHIRALITY_FEATURED = 'the-constellation'
const CRYPTO_FEATURED = 'ext-the-event-and-the-clearing'

const CLUSTER_CENTERS: Record<string, { x: number; y: number }> = {
  chirality: { x: 200, y: 0 },
  cryptosovereignty: { x: -200, y: 0 },
}

export const BOOK_ORDER: string[] = [
  'the-constellation',
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

export const CRYPTO_ORDER: string[] = [
  'ext-the-event-and-the-clearing',
  '01-cryptosovereignty',
  '02-the-encrypted-meaning-of-crypto',
  '03-the-new-form-of-power',
  '04-crypto-truth-and-power',
  '05-the-political-theology-of-crypto',
  '06-crypto-without-criticisms',
  '07-the-sovereign-the-subject',
  '08-the-theological-conquest-of-money',
  '09-the-legend-of-satoshi-nakamoto',
  '10-the-concept-of-the-political',
  '11-the-oath-of-machines',
  '12-messianic-bitcoin',
  '13-the-pedagogy-of-bitcoin',
  '14-the-political-theology-of-bitcoin',
  '15-bitcoin-and-the-state-of-emergency',
  '16-theory-of-the-crypto-partisan',
  '17-to-my-crypto-comrades',
  '18-the-hope-of-bitcoin',
  '19-bitcoin-and-the-conquest-of-privacy',
  '20-the-question-concerning-bitcoin',
  'ext-first-philosophy',
  'ext-sovereign-mutualism',
  'ext-the-solitary-sovereign',
]

export interface PositionedNode extends GraphNode {
  x: number
  y: number
  z: number
  radius: number
  bookOrder: number
  cluster: string
}

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
 * - Two clusters (chirality / cryptosovereignty) with separate centers
 * - Featured nodes pinned at their cluster centers
 */
export function computeLayout(data: GraphData): PositionedNode[] {
  const nodes: ForceNode[] = data.nodes.map((n) => {
    const center = CLUSTER_CENTERS[n.cluster] ?? { x: 0, y: 0 }
    return {
      ...n,
      x: center.x + (Math.random() - 0.5) * 100,
      y: center.y + (Math.random() - 0.5) * 100,
      vx: 0,
      vy: 0,
    }
  })

  // Pin both featured nodes at their cluster centers
  const featuredIds = [CHIRALITY_FEATURED, CRYPTO_FEATURED]
  for (const fid of featuredIds) {
    const node = nodes.find(n => n.id === fid)
    if (node) {
      const center = CLUSTER_CENTERS[node.cluster] ?? { x: 0, y: 0 }
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
      d3.forceManyBody<ForceNode>().strength(-180)
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
        const center = CLUSTER_CENTERS[node.cluster]
        if (!center) continue
        // Skip pinned nodes
        if ((node as any).fx != null) continue
        node.vx += (center.x - node.x) * 0.03
        node.vy += (center.y - node.y) * 0.03
      }
    })
    .stop()

  // Run to completion
  for (let i = 0; i < 400; i++) simulation.tick()

  // Release pins
  for (const fid of featuredIds) {
    const node = nodes.find(n => n.id === fid)
    if (node) {
      ;(node as any).fx = null
      ;(node as any).fy = null
    }
  }

  return nodes.map((n): PositionedNode => {
    const isFeatured = n.id === CHIRALITY_FEATURED || n.id === CRYPTO_FEATURED
    const orderList = n.cluster === 'cryptosovereignty' ? CRYPTO_ORDER : BOOK_ORDER
    const orderIndex = orderList.indexOf(n.id)
    const baseRadius = 2 + n.connectionCount * 0.8
    const radius = isFeatured ? baseRadius * 1.5 : baseRadius

    // Z from hand property — gives depth within each cluster independently
    let z = (Math.random() - 0.5) * 20
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

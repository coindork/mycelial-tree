import type { GraphData, GraphEdge } from './types'

/**
 * Merge two constellation graphs into a single atlas graph.
 * All nodes at full fidelity (no ghosts). Edges deduplicated.
 */
export function mergeForAtlas(local: GraphData, remote: GraphData): GraphData {
  const localIds = new Set(local.nodes.map(n => n.id))

  const nodes = [
    ...local.nodes.map(n => ({ ...n, ghost: false })),
    ...remote.nodes.filter(n => !localIds.has(n.id)).map(n => ({ ...n, ghost: false })),
  ]

  const seen = new Set<string>()
  const edges: GraphEdge[] = []
  const key = (a: string, b: string) => [a, b].sort().join('::')

  for (const edge of [...local.edges, ...remote.edges]) {
    const k = key(edge.source, edge.target)
    if (!seen.has(k)) {
      seen.add(k)
      edges.push(edge)
    }
  }

  return { nodes, edges }
}

import type { GraphData, GraphNode, GraphEdge, GhostConfig } from './types'

export interface GhostResult {
  ghostNodes: GraphNode[]
  ghostEdges: GraphEdge[]
}

/**
 * Given a local graph and a remote graph, identify bridge nodes:
 * remote nodes that share edges with local nodes.
 */
export function identifyGhosts(
  local: GraphData,
  remote: GraphData,
  ghostConfig: GhostConfig
): GhostResult {
  const localIds = new Set(local.nodes.map(n => n.id))
  const remoteNodeIds = new Set(remote.nodes.map(n => n.id))

  const bridgeEdges: GraphEdge[] = []
  const ghostNodeIds = new Set<string>()
  const seenEdges = new Set<string>()
  const edgeKey = (a: string, b: string) => [a, b].sort().join('::')

  // Check remote edges for cross-constellation connections
  for (const edge of remote.edges) {
    const srcLocal = localIds.has(edge.source)
    const tgtLocal = localIds.has(edge.target)
    const srcRemote = remoteNodeIds.has(edge.source) && !srcLocal
    const tgtRemote = remoteNodeIds.has(edge.target) && !tgtLocal

    if (srcLocal && tgtRemote) {
      ghostNodeIds.add(edge.target)
      const k = edgeKey(edge.source, edge.target)
      if (!seenEdges.has(k)) { seenEdges.add(k); bridgeEdges.push(edge) }
    } else if (tgtLocal && srcRemote) {
      ghostNodeIds.add(edge.source)
      const k = edgeKey(edge.source, edge.target)
      if (!seenEdges.has(k)) { seenEdges.add(k); bridgeEdges.push(edge) }
    }
  }

  // Also check local edges referencing remote nodes
  for (const edge of local.edges) {
    const srcRemote = !localIds.has(edge.source) && remoteNodeIds.has(edge.source)
    const tgtRemote = !localIds.has(edge.target) && remoteNodeIds.has(edge.target)

    if (srcRemote) {
      ghostNodeIds.add(edge.source)
      const k = edgeKey(edge.source, edge.target)
      if (!seenEdges.has(k)) { seenEdges.add(k); bridgeEdges.push(edge) }
    }
    if (tgtRemote) {
      ghostNodeIds.add(edge.target)
      const k = edgeKey(edge.source, edge.target)
      if (!seenEdges.has(k)) { seenEdges.add(k); bridgeEdges.push(edge) }
    }
  }

  const ghostNodes: GraphNode[] = remote.nodes
    .filter(n => ghostNodeIds.has(n.id))
    .map(n => ({ ...n, ghost: true, cluster: ghostConfig.remoteName }))

  return { ghostNodes, ghostEdges: bridgeEdges }
}

/**
 * Fetch remote graph.json. Returns null on failure (graceful degradation).
 */
export async function fetchRemoteGraph(url: string): Promise<GraphData | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

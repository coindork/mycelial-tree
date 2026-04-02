import { describe, it, expect } from 'vitest'
import { identifyGhosts } from './ghost'
import type { GraphData, GhostConfig } from './types'

const ghostConfig: GhostConfig = {
  remoteGraphUrl: 'https://example.com/graph.json',
  remoteColor: 0x00B4D8,
  remoteColorCSS: '#00B4D8',
  remoteName: 'cryptosovereignty',
  remoteSiteUrl: 'https://example.com/',
}

describe('identifyGhosts', () => {
  it('finds bridge nodes from remote graph edges', () => {
    const local: GraphData = {
      nodes: [
        { id: 'local-a', title: 'A', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'chirality', connectionCount: 1 },
      ],
      edges: [],
    }
    const remote: GraphData = {
      nodes: [
        { id: 'remote-b', title: 'B', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'crypto', connectionCount: 1 },
        { id: 'remote-c', title: 'C', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'crypto', connectionCount: 0 },
      ],
      edges: [
        { source: 'local-a', target: 'remote-b', weight: 3, type: 'explicit' },
      ],
    }
    const result = identifyGhosts(local, remote, ghostConfig)
    expect(result.ghostNodes).toHaveLength(1)
    expect(result.ghostNodes[0].id).toBe('remote-b')
    expect(result.ghostNodes[0].ghost).toBe(true)
    expect(result.ghostNodes[0].cluster).toBe('cryptosovereignty')
    expect(result.ghostEdges).toHaveLength(1)
  })

  it('finds bridge nodes from local graph edges referencing remote', () => {
    const local: GraphData = {
      nodes: [
        { id: 'local-a', title: 'A', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'chirality', connectionCount: 1 },
      ],
      edges: [
        { source: 'local-a', target: 'remote-b', weight: 3, type: 'explicit' },
      ],
    }
    const remote: GraphData = {
      nodes: [
        { id: 'remote-b', title: 'B', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'crypto', connectionCount: 1 },
      ],
      edges: [],
    }
    const result = identifyGhosts(local, remote, ghostConfig)
    expect(result.ghostNodes).toHaveLength(1)
    expect(result.ghostNodes[0].id).toBe('remote-b')
    expect(result.ghostEdges).toHaveLength(1)
  })

  it('returns empty when no bridges exist', () => {
    const local: GraphData = {
      nodes: [{ id: 'a', title: 'A', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'chirality', connectionCount: 0 }],
      edges: [],
    }
    const remote: GraphData = {
      nodes: [{ id: 'b', title: 'B', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'crypto', connectionCount: 0 }],
      edges: [],
    }
    const result = identifyGhosts(local, remote, ghostConfig)
    expect(result.ghostNodes).toHaveLength(0)
    expect(result.ghostEdges).toHaveLength(0)
  })

  it('deduplicates edges found in both local and remote', () => {
    const local: GraphData = {
      nodes: [{ id: 'a', title: 'A', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'chirality', connectionCount: 1 }],
      edges: [{ source: 'a', target: 'b', weight: 3, type: 'explicit' }],
    }
    const remote: GraphData = {
      nodes: [{ id: 'b', title: 'B', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'crypto', connectionCount: 1 }],
      edges: [{ source: 'a', target: 'b', weight: 3, type: 'explicit' }],
    }
    const result = identifyGhosts(local, remote, ghostConfig)
    expect(result.ghostNodes).toHaveLength(1)
    expect(result.ghostEdges).toHaveLength(1) // deduplicated
  })
})

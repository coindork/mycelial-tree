import { describe, it, expect } from 'vitest'
import { mergeForAtlas } from './atlas'
import type { GraphData } from './types'

describe('mergeForAtlas', () => {
  it('merges nodes from both graphs', () => {
    const local: GraphData = {
      nodes: [
        { id: 'a', title: 'A', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'chirality', connectionCount: 0 },
      ],
      edges: [],
    }
    const remote: GraphData = {
      nodes: [
        { id: 'b', title: 'B', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'crypto', connectionCount: 0 },
      ],
      edges: [],
    }
    const result = mergeForAtlas(local, remote)
    expect(result.nodes).toHaveLength(2)
    expect(result.nodes.every(n => n.ghost === false)).toBe(true)
  })

  it('deduplicates nodes present in both graphs', () => {
    const local: GraphData = {
      nodes: [
        { id: 'shared', title: 'S', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'chirality', connectionCount: 0 },
      ],
      edges: [],
    }
    const remote: GraphData = {
      nodes: [
        { id: 'shared', title: 'S', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'crypto', connectionCount: 0 },
        { id: 'b', title: 'B', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'crypto', connectionCount: 0 },
      ],
      edges: [],
    }
    const result = mergeForAtlas(local, remote)
    expect(result.nodes).toHaveLength(2)
  })

  it('deduplicates edges', () => {
    const local: GraphData = {
      nodes: [{ id: 'a', title: 'A', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'chirality', connectionCount: 1 }],
      edges: [{ source: 'a', target: 'b', weight: 3, type: 'explicit' }],
    }
    const remote: GraphData = {
      nodes: [{ id: 'b', title: 'B', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'crypto', connectionCount: 1 }],
      edges: [{ source: 'a', target: 'b', weight: 3, type: 'explicit' }],
    }
    const result = mergeForAtlas(local, remote)
    expect(result.edges).toHaveLength(1)
  })

  it('sets all nodes to ghost: false', () => {
    const local: GraphData = {
      nodes: [{ id: 'a', title: 'A', concepts: [], layer: 'surface', hand: 'left', ghost: true, cluster: 'chirality', connectionCount: 0 }],
      edges: [],
    }
    const remote: GraphData = { nodes: [], edges: [] }
    const result = mergeForAtlas(local, remote)
    expect(result.nodes[0].ghost).toBe(false)
  })
})

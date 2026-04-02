import { describe, it, expect } from 'vitest'
import { computeLayout } from './force'
import type { GraphData, ConstellationConfig } from './types'

const TEST_CONFIG: ConstellationConfig = {
  name: 'test-cluster',
  color: 0xF7931A,
  colorDim: 0xc47515,
  colorCSS: '#F7931A',
  colorBoth: 0xD4A853,
  colorBothCSS: '#D4A853',
  featuredNode: 'featured-node',
  readingOrder: ['featured-node', 'essay-a'],
  clusterCenter: { x: 200, y: 0 },
  bloom: { strength: 1.2, threshold: 0.5, radius: 0.8 },
}

describe('computeLayout', () => {
  it('positions nodes near their cluster center', () => {
    const data: GraphData = {
      nodes: [
        { id: 'featured-node', title: 'F', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'test-cluster', connectionCount: 1 },
        { id: 'essay-a', title: 'A', concepts: [], layer: 'surface', hand: 'right', ghost: false, cluster: 'test-cluster', connectionCount: 1 },
      ],
      edges: [{ source: 'featured-node', target: 'essay-a', weight: 3, type: 'explicit' }],
    }
    const nodes = computeLayout(data, [TEST_CONFIG])
    expect(nodes).toHaveLength(2)
    for (const n of nodes) {
      expect(n.x).toBeGreaterThan(100)
      expect(n.x).toBeLessThan(300)
    }
  })

  it('assigns bookOrder from config readingOrder', () => {
    const data: GraphData = {
      nodes: [
        { id: 'featured-node', title: 'F', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'test-cluster', connectionCount: 0 },
        { id: 'essay-a', title: 'A', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'test-cluster', connectionCount: 0 },
      ],
      edges: [],
    }
    const nodes = computeLayout(data, [TEST_CONFIG])
    const f = nodes.find(n => n.id === 'featured-node')!
    const a = nodes.find(n => n.id === 'essay-a')!
    expect(f.bookOrder).toBe(1)
    expect(a.bookOrder).toBe(2)
  })

  it('gives featured node larger radius', () => {
    const data: GraphData = {
      nodes: [
        { id: 'featured-node', title: 'F', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'test-cluster', connectionCount: 2 },
        { id: 'essay-a', title: 'A', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'test-cluster', connectionCount: 2 },
      ],
      edges: [],
    }
    const nodes = computeLayout(data, [TEST_CONFIG])
    const f = nodes.find(n => n.id === 'featured-node')!
    const a = nodes.find(n => n.id === 'essay-a')!
    expect(f.radius).toBeGreaterThan(a.radius)
  })

  it('assigns z based on hand property', () => {
    const data: GraphData = {
      nodes: [
        { id: 'essay-a', title: 'A', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'test-cluster', connectionCount: 0 },
        { id: 'essay-b', title: 'B', concepts: [], layer: 'surface', hand: 'right', ghost: false, cluster: 'test-cluster', connectionCount: 0 },
      ],
      edges: [],
    }
    const nodes = computeLayout(data, [TEST_CONFIG])
    const a = nodes.find(n => n.id === 'essay-a')!
    const b = nodes.find(n => n.id === 'essay-b')!
    // Left hand should be further back (more negative z)
    expect(a.z).toBeLessThan(b.z)
  })

  it('returns bookOrder 99 for nodes not in readingOrder', () => {
    const data: GraphData = {
      nodes: [
        { id: 'unknown', title: 'U', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'test-cluster', connectionCount: 0 },
      ],
      edges: [],
    }
    const nodes = computeLayout(data, [TEST_CONFIG])
    expect(nodes[0].bookOrder).toBe(99)
  })
})

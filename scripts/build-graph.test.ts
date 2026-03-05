import { describe, it, expect } from 'vitest'
import { parseFrontmatter, discoverConnections, buildGraph } from './build-graph'

// --- parseFrontmatter ---

describe('parseFrontmatter', () => {
  it('parses standard frontmatter', () => {
    const raw = `---
title: "Test Essay"
subtitle: "A subtitle"
date: 2026-01-01
concepts: [alpha, beta, gamma]
connects_to:
  - other-essay.md
layer: surface
hand: left
---
# Body here

Some content.
`
    const { frontmatter, body } = parseFrontmatter('test-essay.md', raw)
    expect(frontmatter.title).toBe('Test Essay')
    expect(frontmatter.subtitle).toBe('A subtitle')
    expect(frontmatter.concepts).toEqual(['alpha', 'beta', 'gamma'])
    expect(frontmatter.connects_to).toEqual(['other-essay.md'])
    expect(frontmatter.layer).toBe('surface')
    expect(frontmatter.hand).toBe('left')
    expect(frontmatter.ghost).toBe(false)
    expect(body).toContain('# Body here')
    expect(body).toContain('Some content.')
  })

  it('defaults missing optional fields', () => {
    const raw = `---
title: "Minimal"
layer: soil
hand: right
---
Body.
`
    const { frontmatter } = parseFrontmatter('minimal.md', raw)
    expect(frontmatter.concepts).toEqual([])
    expect(frontmatter.connects_to).toEqual([])
    expect(frontmatter.ghost).toBe(false)
  })

  it('preserves ghost: true', () => {
    const raw = `---
title: "Ghost"
concepts: []
connects_to: []
layer: soil
hand: both
ghost: true
---
Boo.
`
    const { frontmatter } = parseFrontmatter('ghost.md', raw)
    expect(frontmatter.ghost).toBe(true)
  })
})

// --- discoverConnections ---

describe('discoverConnections', () => {
  it('creates explicit edges from connects_to', () => {
    const nodes = [
      {
        id: 'a',
        frontmatter: {
          title: 'A',
          concepts: [],
          connects_to: ['b.md'],
          layer: 'surface' as const,
          hand: 'left' as const,
        },
      },
      {
        id: 'b',
        frontmatter: {
          title: 'B',
          concepts: [],
          connects_to: [],
          layer: 'surface' as const,
          hand: 'right' as const,
        },
      },
    ]
    const edges = discoverConnections(nodes)
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({
      source: 'a',
      target: 'b',
      weight: 3,
      type: 'explicit',
    })
  })

  it('does not create explicit edge to non-existent target', () => {
    const nodes = [
      {
        id: 'a',
        frontmatter: {
          title: 'A',
          concepts: [],
          connects_to: ['z.md'],
          layer: 'surface' as const,
          hand: 'left' as const,
        },
      },
    ]
    const edges = discoverConnections(nodes)
    expect(edges).toHaveLength(0)
  })

  it('creates conceptual edges for 3+ shared concepts', () => {
    const nodes = [
      {
        id: 'a',
        frontmatter: {
          title: 'A',
          concepts: ['x', 'y', 'z', 'w'],
          connects_to: [],
          layer: 'surface' as const,
          hand: 'left' as const,
        },
      },
      {
        id: 'b',
        frontmatter: {
          title: 'B',
          concepts: ['x', 'y', 'z'],
          connects_to: [],
          layer: 'soil' as const,
          hand: 'right' as const,
        },
      },
    ]
    const edges = discoverConnections(nodes)
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({
      weight: 2,
      type: 'conceptual',
    })
  })

  it('does not create conceptual edge for fewer than 3 shared concepts', () => {
    const nodes = [
      {
        id: 'a',
        frontmatter: {
          title: 'A',
          concepts: ['x', 'y'],
          connects_to: [],
          layer: 'surface' as const,
          hand: 'left' as const,
        },
      },
      {
        id: 'b',
        frontmatter: {
          title: 'B',
          concepts: ['x', 'y'],
          connects_to: [],
          layer: 'soil' as const,
          hand: 'right' as const,
        },
      },
    ]
    const edges = discoverConnections(nodes)
    expect(edges).toHaveLength(0)
  })

  it('does not duplicate edges (explicit wins over conceptual)', () => {
    const nodes = [
      {
        id: 'a',
        frontmatter: {
          title: 'A',
          concepts: ['x', 'y', 'z'],
          connects_to: ['b.md'],
          layer: 'surface' as const,
          hand: 'left' as const,
        },
      },
      {
        id: 'b',
        frontmatter: {
          title: 'B',
          concepts: ['x', 'y', 'z'],
          connects_to: [],
          layer: 'soil' as const,
          hand: 'right' as const,
        },
      },
    ]
    const edges = discoverConnections(nodes)
    // Should only have the explicit edge, not both
    expect(edges).toHaveLength(1)
    expect(edges[0].type).toBe('explicit')
  })

  it('deduplicates bidirectional explicit references', () => {
    const nodes = [
      {
        id: 'a',
        frontmatter: {
          title: 'A',
          concepts: [],
          connects_to: ['b.md'],
          layer: 'surface' as const,
          hand: 'left' as const,
        },
      },
      {
        id: 'b',
        frontmatter: {
          title: 'B',
          concepts: [],
          connects_to: ['a.md'],
          layer: 'soil' as const,
          hand: 'right' as const,
        },
      },
    ]
    const edges = discoverConnections(nodes)
    expect(edges).toHaveLength(1)
  })
})

// --- buildGraph ---

describe('buildGraph', () => {
  const files: { filename: string; raw: string; cluster: string }[] = [
    {
      filename: 'essay-a.md',
      cluster: 'chirality',
      raw: `---
title: "Essay A"
subtitle: "Subtitle A"
concepts: [care, dwelling, clearing]
connects_to:
  - essay-b.md
layer: surface
hand: left
---
# Essay A

Content of A.
`,
    },
    {
      filename: 'essay-b.md',
      cluster: 'chirality',
      raw: `---
title: "Essay B"
concepts: [care, dwelling, clearing, Heidegger]
connects_to: []
layer: soil
hand: right
---
# Essay B

Content of B.
`,
    },
    {
      filename: 'essay-c.md',
      cluster: 'chirality',
      raw: `---
title: "Essay C"
concepts: [network, federation]
connects_to: []
layer: surface
hand: both
ghost: true
---
# Essay C

Content of C.
`,
    },
  ]

  it('builds correct number of nodes and edges', () => {
    const { graph } = buildGraph(files)
    expect(graph.nodes).toHaveLength(3)
    expect(graph.edges.length).toBeGreaterThanOrEqual(1)
  })

  it('nodes have correct ids stripped of .md', () => {
    const { graph } = buildGraph(files)
    const ids = graph.nodes.map((n) => n.id)
    expect(ids).toContain('essay-a')
    expect(ids).toContain('essay-b')
    expect(ids).toContain('essay-c')
  })

  it('connectionCount reflects edges', () => {
    const { graph } = buildGraph(files)
    const nodeA = graph.nodes.find((n) => n.id === 'essay-a')!
    const nodeB = graph.nodes.find((n) => n.id === 'essay-b')!
    const nodeC = graph.nodes.find((n) => n.id === 'essay-c')!
    // A->B explicit edge exists; A and B share 3 concepts but explicit wins (dedup)
    expect(nodeA.connectionCount).toBeGreaterThanOrEqual(1)
    expect(nodeB.connectionCount).toBeGreaterThanOrEqual(1)
    expect(nodeC.connectionCount).toBe(0)
  })

  it('preserves ghost flag', () => {
    const { graph } = buildGraph(files)
    const nodeC = graph.nodes.find((n) => n.id === 'essay-c')!
    expect(nodeC.ghost).toBe(true)
    const nodeA = graph.nodes.find((n) => n.id === 'essay-a')!
    expect(nodeA.ghost).toBe(false)
  })

  it('renders essay bodies to HTML', () => {
    const { essays } = buildGraph(files)
    expect(essays).toHaveLength(3)
    const essayA = essays.find((e) => e.id === 'essay-a')!
    expect(essayA.html).toContain('<h1>Essay A</h1>')
    expect(essayA.html).toContain('Content of A.')
  })

  it('returns valid GraphData shape', () => {
    const { graph } = buildGraph(files)
    for (const node of graph.nodes) {
      expect(node).toHaveProperty('id')
      expect(node).toHaveProperty('title')
      expect(node).toHaveProperty('concepts')
      expect(node).toHaveProperty('layer')
      expect(node).toHaveProperty('hand')
      expect(typeof node.ghost).toBe('boolean')
      expect(typeof node.connectionCount).toBe('number')
    }
    for (const edge of graph.edges) {
      expect(edge).toHaveProperty('source')
      expect(edge).toHaveProperty('target')
      expect(edge).toHaveProperty('weight')
      expect(['explicit', 'conceptual', 'thematic']).toContain(edge.type)
    }
  })
})

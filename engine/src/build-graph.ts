import matter from 'gray-matter'
import { marked } from 'marked'
import type { EssayFrontmatter, GraphNode, GraphEdge, GraphData } from './types'

// --- Exported functions ---

export function parseFrontmatter(
  filename: string,
  raw: string
): { frontmatter: EssayFrontmatter; body: string } {
  const { data, content } = matter(raw)
  const fm = data as EssayFrontmatter
  // Ensure defaults
  if (!fm.concepts) fm.concepts = []
  if (!fm.connects_to) fm.connects_to = []
  if (fm.ghost === undefined) fm.ghost = false
  return { frontmatter: fm, body: content }
}

export function discoverConnections(
  nodes: { id: string; frontmatter: EssayFrontmatter }[]
): GraphEdge[] {
  const edges: GraphEdge[] = []
  const seen = new Set<string>()

  const key = (a: string, b: string) => [a, b].sort().join('::')

  // 1. Explicit connections from connects_to
  for (const node of nodes) {
    for (const ref of node.frontmatter.connects_to) {
      const targetId = ref.replace(/\.md$/, '')
      // Only add if target exists in our node set
      if (nodes.some((n) => n.id === targetId)) {
        const k = key(node.id, targetId)
        if (!seen.has(k)) {
          seen.add(k)
          edges.push({
            source: node.id,
            target: targetId,
            weight: 3,
            type: 'explicit',
          })
        }
      }
    }
  }

  // 2. Shared concepts (3+ matches) -> conceptual edge
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      const k = key(a.id, b.id)
      if (seen.has(k)) continue

      const shared = a.frontmatter.concepts.filter((c) =>
        b.frontmatter.concepts.includes(c)
      )
      if (shared.length >= 3) {
        seen.add(k)
        edges.push({
          source: a.id,
          target: b.id,
          weight: 2,
          type: 'conceptual',
        })
      }
    }
  }

  return edges
}

export function buildGraph(
  files: { filename: string; raw: string; cluster: string }[]
): { graph: GraphData; essays: { id: string; html: string }[] } {
  // Parse all files
  const parsed = files.map((f) => {
    const id = f.filename.replace(/\.md$/, '')
    const { frontmatter, body } = parseFrontmatter(f.filename, f.raw)
    return { id, frontmatter, body, cluster: f.cluster }
  })

  // Discover edges
  const edges = discoverConnections(
    parsed.map((p) => ({ id: p.id, frontmatter: p.frontmatter }))
  )

  // Count connections per node
  const counts = new Map<string, number>()
  for (const p of parsed) counts.set(p.id, 0)
  for (const e of edges) {
    counts.set(e.source, (counts.get(e.source) ?? 0) + 1)
    counts.set(e.target, (counts.get(e.target) ?? 0) + 1)
  }

  // Build nodes
  const nodes: GraphNode[] = parsed.map((p) => ({
    id: p.id,
    title: p.frontmatter.title,
    subtitle: p.frontmatter.subtitle,
    concepts: p.frontmatter.concepts,
    layer: p.frontmatter.layer,
    hand: p.frontmatter.hand,
    ghost: p.frontmatter.ghost ?? false,
    cluster: p.cluster,
    connectionCount: counts.get(p.id) ?? 0,
  }))

  // Render HTML
  const essays = parsed.map((p) => ({
    id: p.id,
    html: marked.parse(p.body, { async: false }) as string,
  }))

  return { graph: { nodes, edges }, essays }
}

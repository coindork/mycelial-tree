import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { marked } from 'marked'
import type { EssayFrontmatter, GraphNode, GraphEdge, GraphData } from '../src/data/types'

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

  // 2. Shared concepts (3+ matches) → conceptual edge
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

// --- CLI entry ---

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('build-graph.ts') ||
    process.argv[1].endsWith('build-graph'))

if (isMain) {
  const contentDir = path.resolve(__dirname, '..', 'content')
  const publicDir = path.resolve(__dirname, '..', 'public')
  const essaysOutDir = path.join(publicDir, 'essays')

  // Content directories and their cluster names
  const contentSources: { dir: string; cluster: string }[] = [
    { dir: path.join(contentDir, 'essays'), cluster: 'chirality' },
    { dir: path.join(contentDir, 'cryptosovereignty'), cluster: 'cryptosovereignty' },
  ]

  // Ensure output dirs exist
  fs.mkdirSync(publicDir, { recursive: true })
  fs.mkdirSync(essaysOutDir, { recursive: true })

  // Read .md files from all content directories
  const files: { filename: string; raw: string; cluster: string }[] = []
  for (const source of contentSources) {
    if (!fs.existsSync(source.dir)) {
      console.warn(`Content directory not found, skipping: ${source.dir}`)
      continue
    }
    const filenames = fs.readdirSync(source.dir).filter((f) => f.endsWith('.md'))
    for (const filename of filenames) {
      files.push({
        filename,
        raw: fs.readFileSync(path.join(source.dir, filename), 'utf-8'),
        cluster: source.cluster,
      })
    }
  }

  const { graph, essays } = buildGraph(files)

  // Write graph.json
  fs.writeFileSync(
    path.join(publicDir, 'graph.json'),
    JSON.stringify(graph, null, 2)
  )

  // Write essay HTML files
  for (const essay of essays) {
    fs.writeFileSync(path.join(essaysOutDir, `${essay.id}.html`), essay.html)
  }

  console.log(
    `Built graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`
  )
  console.log(`Wrote ${essays.length} essay HTML files`)
}

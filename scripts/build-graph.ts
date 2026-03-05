import fs from 'fs'
import path from 'path'
import { buildGraph } from '@vora/mycelial-engine'

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

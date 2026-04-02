// Runtime (browser)
export { MoleculeRenderer } from './renderer'
export { computeLayout } from './force'
export { identifyGhosts, fetchRemoteGraph } from './ghost'
export type { GhostResult } from './ghost'
export { mergeForAtlas } from './atlas'

// Build-time (node) — re-exported for convenience, also available via @vora/mycelial-engine/build
export { parseFrontmatter, discoverConnections, buildGraph } from './build-graph'

// Types
export type {
  ConstellationConfig,
  GhostConfig,
  SiteConfig,
  GraphData,
  GraphNode,
  GraphEdge,
  EssayFrontmatter,
  PositionedNode,
} from './types'

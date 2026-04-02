export interface EssayFrontmatter {
  title: string
  subtitle?: string
  date?: string
  concepts: string[]
  connects_to: string[]
  layer: 'surface' | 'soil'
  hand: 'left' | 'right' | 'both'
  ghost?: boolean
}

export interface GraphNode {
  id: string
  title: string
  subtitle?: string
  concepts: string[]
  layer: 'surface' | 'soil'
  hand: 'left' | 'right' | 'both'
  ghost: boolean
  cluster: string
  connectionCount: number
  hint?: { x: number; y: number }
  x?: number
  y?: number
  z?: number
  vx?: number
  vy?: number
  vz?: number
  fx?: number | null
  fy?: number | null
  fz?: number | null
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
  type: 'explicit' | 'conceptual' | 'thematic'
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface PositionedNode extends GraphNode {
  x: number
  y: number
  z: number
  radius: number
  bookOrder: number
  cluster: string
}

export interface ConstellationConfig {
  name: string
  color: number
  colorDim: number
  colorCSS: string
  colorBoth: number
  colorBothCSS: string
  featuredNode: string
  readingOrder: string[]
  clusterCenter: { x: number; y: number }
  bloom: { strength: number; threshold: number; radius: number }
}

export interface GhostConfig {
  remoteGraphUrl: string
  remoteColor: number
  remoteColorCSS: string
  remoteName: string
  remoteSiteUrl: string
}

export interface SiteConfig {
  local: ConstellationConfig
  ghost?: GhostConfig
  atlas?: {
    remote: ConstellationConfig
    remoteGraphUrl: string
    remoteSiteUrl: string
  }
}

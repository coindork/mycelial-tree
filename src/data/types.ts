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
  connectionCount: number
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

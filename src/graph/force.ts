import type { GraphData, GraphNode } from '../data/types'

const FEATURED_NODE_ID = 'the-handedness-of-being'

export const BOOK_ORDER: string[] = [
  'the-handedness-of-being',
  'theses-on-chirality',
  'the-five-completions',
  '05-the-filter',
  'chirality-agamben',
  'care-can-now-be-proved',
  'chirality',
  'the-chiral-completion',
  'chiral-pedagogy',
  '06-dwelling-in-the-digital-age',
  'the-proof-of-love',
  '11-the-event-of-logic',
  'the-passage',
  'tuesday-in-the-clearing',
  'the-cete',
]

export interface PositionedNode extends GraphNode {
  x: number
  y: number
  z: number
  radius: number
  bookOrder: number
}

/**
 * Crystal geometry: center node + two shells.
 *
 * Shell 1 (inner, 6 nodes): octahedron vertices — the most connected essays
 * Shell 2 (outer, 8 nodes): cube vertices — the remaining essays
 *
 * This creates a cuboctahedral crystal: an octahedron nested inside a cube,
 * with the central thesis at the origin.
 */
function crystalPositions(): { x: number; y: number; z: number }[] {
  const R1 = 55  // inner shell radius (octahedron)
  const R2 = 85  // outer shell radius (cube)

  // Position 0: center
  const center = { x: 0, y: 0, z: 0 }

  // Positions 1-6: octahedron vertices (inner shell)
  const octahedron = [
    { x: R1, y: 0, z: 0 },
    { x: -R1, y: 0, z: 0 },
    { x: 0, y: R1, z: 0 },
    { x: 0, y: -R1, z: 0 },
    { x: 0, y: 0, z: R1 },
    { x: 0, y: 0, z: -R1 },
  ]

  // Positions 7-14: cube vertices (outer shell)
  const d = R2 / Math.sqrt(3) // distance so vertex is at R2 from origin
  const cube = [
    { x: d, y: d, z: d },
    { x: d, y: d, z: -d },
    { x: d, y: -d, z: d },
    { x: d, y: -d, z: -d },
    { x: -d, y: d, z: d },
    { x: -d, y: d, z: -d },
    { x: -d, y: -d, z: d },
    { x: -d, y: -d, z: -d },
  ]

  return [center, ...octahedron, ...cube]
}

/**
 * Sort nodes so the most-connected go to the center and inner shell,
 * and the least-connected go to the outer shell.
 */
export function computeLayout(data: GraphData): PositionedNode[] {
  // Sort by connection count descending (featured node forced to index 0)
  const sorted = [...data.nodes].sort((a, b) => {
    if (a.id === FEATURED_NODE_ID) return -1
    if (b.id === FEATURED_NODE_ID) return 1
    return b.connectionCount - a.connectionCount
  })

  const positions = crystalPositions()

  return sorted.map((node, i): PositionedNode => {
    const pos = positions[i] || { x: 0, y: 0, z: 0 }
    const orderIndex = BOOK_ORDER.indexOf(node.id)
    const baseRadius = 2 + node.connectionCount * 0.8
    const radius = node.id === FEATURED_NODE_ID ? baseRadius * 1.5 : baseRadius

    return {
      ...node,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      radius,
      bookOrder: orderIndex >= 0 ? orderIndex + 1 : 99,
    }
  })
}

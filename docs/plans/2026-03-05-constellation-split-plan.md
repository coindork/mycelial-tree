# Constellation Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the mycelial-tree monolith into a shared engine + two independent constellation sites with ghost nodes and atlas mode.

**Architecture:** Three repos — `mycelial-engine` (shared renderer/force/build), `mycelial-tree` (chirality, amber), `cryptosovereignty` (crypto, cerulean). Engine is an npm package both sites depend on. Ghost nodes fetch the other site's graph.json at runtime. Atlas mode renders both constellations together.

**Tech Stack:** Three.js, D3, TypeScript, Vite, npm workspaces (local dev), GitHub Packages (publish)

**Current codebase:** `/Users/vora/Desktop/mycelial-tree` — one repo, ~800 lines of source across 6 files.

---

### Task 1: Initialize mycelial-engine package

**Files:**
- Create: `/Users/vora/Desktop/mycelial-engine/package.json`
- Create: `/Users/vora/Desktop/mycelial-engine/tsconfig.json`
- Create: `/Users/vora/Desktop/mycelial-engine/tsconfig.build.json`
- Create: `/Users/vora/Desktop/mycelial-engine/.gitignore`

**Step 1: Create repo and package structure**

```bash
cd ~/Desktop
mkdir mycelial-engine && cd mycelial-engine
git init
```

**Step 2: Write package.json**

```json
{
  "name": "@vora/mycelial-engine",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./build": {
      "import": "./dist/build-graph.js",
      "types": "./dist/build-graph.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "tsc -p tsconfig.build.json --watch",
    "test": "vitest run",
    "prepublishOnly": "npm run build"
  },
  "peerDependencies": {
    "three": ">=0.160.0",
    "d3": ">=7.0.0"
  },
  "dependencies": {
    "gray-matter": "^4.0.3",
    "marked": "^17.0.4"
  },
  "devDependencies": {
    "@types/d3": "^7.4.3",
    "@types/node": "^25.3.3",
    "@types/three": "^0.183.1",
    "d3": "^7.9.0",
    "three": "^0.183.2",
    "typescript": "^5.9.3",
    "vitest": "^4.0.18"
  }
}
```

**Step 3: Write tsconfig.json (dev)**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

**Step 4: Write tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["src/**/*.test.ts"]
}
```

**Step 5: Write .gitignore**

```
node_modules/
dist/
```

**Step 6: Install dependencies**

```bash
cd ~/Desktop/mycelial-engine && npm install
```

**Step 7: Commit**

```bash
git add -A && git commit -m "chore: initialize mycelial-engine package"
```

---

### Task 2: Extract types into engine

**Files:**
- Create: `/Users/vora/Desktop/mycelial-engine/src/types.ts`

**Step 1: Write types with ConstellationConfig**

```typescript
// === Frontmatter (parsed from markdown YAML) ===

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

// === Graph data ===

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

// === Positioned node (after force layout) ===

export interface PositionedNode extends GraphNode {
  x: number
  y: number
  z: number
  radius: number
  bookOrder: number
  cluster: string
}

// === Configuration ===

export interface ConstellationConfig {
  name: string
  color: number             // Three.js hex — primary glow (e.g. 0xF7931A)
  colorDim: number          // dimmed variant
  colorCSS: string          // CSS string (e.g. '#F7931A')
  colorBoth: number         // "both" hand color
  colorBothCSS: string      // CSS "both" hand color
  featuredNode: string      // ID of central node
  readingOrder: string[]    // essay IDs in chapter sequence
  clusterCenter: { x: number; y: number }
  bloom: { strength: number; threshold: number; radius: number }
}

// Ghost nodes from the remote constellation
export interface GhostConfig {
  remoteGraphUrl: string    // URL to other site's graph.json
  remoteColor: number       // The other constellation's primary color
  remoteColorCSS: string    // CSS version
  remoteName: string        // 'chirality' or 'cryptosovereignty'
  remoteSiteUrl: string     // Base URL for cross-site navigation
}

// Full site config combining local + ghost + atlas
export interface SiteConfig {
  local: ConstellationConfig
  ghost?: GhostConfig
  atlas?: {
    remote: ConstellationConfig
    remoteGraphUrl: string
    remoteSiteUrl: string
  }
}
```

**Step 2: Commit**

```bash
cd ~/Desktop/mycelial-engine && git add -A && git commit -m "feat: add type definitions with ConstellationConfig"
```

---

### Task 3: Extract build-graph into engine

**Files:**
- Create: `/Users/vora/Desktop/mycelial-engine/src/build-graph.ts`
- Create: `/Users/vora/Desktop/mycelial-engine/src/build-graph.test.ts`

**Step 1: Copy build-graph.ts from mycelial-tree**

Copy `/Users/vora/Desktop/mycelial-tree/scripts/build-graph.ts` to engine. Change the import path for types:

```typescript
import type { EssayFrontmatter, GraphNode, GraphEdge, GraphData } from './types'
```

Remove the CLI entry block (lines 122-177). The CLI will live in each site, not the engine. Keep only the three exported functions: `parseFrontmatter`, `discoverConnections`, `buildGraph`.

**Step 2: Copy tests**

Copy `/Users/vora/Desktop/mycelial-tree/scripts/build-graph.test.ts`. Update import:

```typescript
import { parseFrontmatter, discoverConnections, buildGraph } from './build-graph'
```

**Step 3: Run tests**

```bash
cd ~/Desktop/mycelial-engine && npx vitest run
```

Expected: All 9 tests pass.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: extract build-graph with tests"
```

---

### Task 4: Extract force layout into engine (configurable)

**Files:**
- Create: `/Users/vora/Desktop/mycelial-engine/src/force.ts`
- Create: `/Users/vora/Desktop/mycelial-engine/src/force.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { computeLayout } from './force'
import type { GraphData, ConstellationConfig } from './types'

const CHIRALITY_CONFIG: ConstellationConfig = {
  name: 'chirality',
  color: 0xF7931A,
  colorDim: 0xc47515,
  colorCSS: '#F7931A',
  colorBoth: 0xD4A853,
  colorBothCSS: '#D4A853',
  featuredNode: 'the-constellation',
  readingOrder: ['the-constellation', 'essay-a'],
  clusterCenter: { x: 200, y: 0 },
  bloom: { strength: 1.2, threshold: 0.5, radius: 0.8 },
}

describe('computeLayout', () => {
  it('positions nodes near their cluster center', () => {
    const data: GraphData = {
      nodes: [
        { id: 'the-constellation', title: 'T', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'chirality', connectionCount: 1 },
        { id: 'essay-a', title: 'A', concepts: [], layer: 'surface', hand: 'right', ghost: false, cluster: 'chirality', connectionCount: 1 },
      ],
      edges: [{ source: 'the-constellation', target: 'essay-a', weight: 3, type: 'explicit' }],
    }
    const configs = [CHIRALITY_CONFIG]
    const nodes = computeLayout(data, configs)
    expect(nodes).toHaveLength(2)
    // All nodes should be near x=200 (chirality center)
    for (const n of nodes) {
      expect(n.x).toBeGreaterThan(100)
      expect(n.x).toBeLessThan(300)
    }
  })

  it('assigns bookOrder from config readingOrder', () => {
    const data: GraphData = {
      nodes: [
        { id: 'the-constellation', title: 'T', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'chirality', connectionCount: 0 },
        { id: 'essay-a', title: 'A', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'chirality', connectionCount: 0 },
      ],
      edges: [],
    }
    const nodes = computeLayout(data, [CHIRALITY_CONFIG])
    const t = nodes.find(n => n.id === 'the-constellation')!
    const a = nodes.find(n => n.id === 'essay-a')!
    expect(t.bookOrder).toBe(1)
    expect(a.bookOrder).toBe(2)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd ~/Desktop/mycelial-engine && npx vitest run src/force.test.ts
```

Expected: FAIL — `computeLayout` not found.

**Step 3: Write configurable force layout**

Adapt `/Users/vora/Desktop/mycelial-tree/src/graph/force.ts`. Key changes:

- Remove hardcoded `CHIRALITY_FEATURED`, `CRYPTO_FEATURED`, `CLUSTER_CENTERS`, `BOOK_ORDER`, `CRYPTO_ORDER`
- `computeLayout` takes `(data: GraphData, configs: ConstellationConfig[])` instead of `(data: GraphData)`
- Build cluster centers, featured nodes, and reading orders from configs
- All other force logic stays identical

```typescript
import * as d3 from 'd3'
import type { GraphData, GraphNode, GraphEdge, PositionedNode, ConstellationConfig } from './types'

interface ForceNode extends GraphNode {
  x: number
  y: number
  vx: number
  vy: number
  cluster: string
}

type ForceEdge = d3.SimulationLinkDatum<ForceNode> & GraphEdge

export function computeLayout(data: GraphData, configs: ConstellationConfig[]): PositionedNode[] {
  // Build lookup maps from configs
  const clusterCenters: Record<string, { x: number; y: number }> = {}
  const featuredNodes: Set<string> = new Set()
  const readingOrders: Record<string, string[]> = {}

  for (const config of configs) {
    clusterCenters[config.name] = config.clusterCenter
    featuredNodes.add(config.featuredNode)
    readingOrders[config.name] = config.readingOrder
  }

  const nodes: ForceNode[] = data.nodes.map((n) => {
    const center = clusterCenters[n.cluster] ?? { x: 0, y: 0 }
    return {
      ...n,
      x: center.x + (Math.random() - 0.5) * 100,
      y: center.y + (Math.random() - 0.5) * 100,
      vx: 0,
      vy: 0,
    }
  })

  // Pin featured nodes at their cluster centers
  for (const node of nodes) {
    if (featuredNodes.has(node.id)) {
      const center = clusterCenters[node.cluster] ?? { x: 0, y: 0 }
      node.x = center.x
      node.y = center.y
      ;(node as any).fx = center.x
      ;(node as any).fy = center.y
    }
  }

  const edges: ForceEdge[] = data.edges.map((e) => ({ ...e }))

  const clusterOf = new Map<string, string>()
  for (const n of nodes) clusterOf.set(n.id, n.cluster)

  const simulation = d3
    .forceSimulation<ForceNode, ForceEdge>(nodes)
    .force(
      'link',
      d3.forceLink<ForceNode, ForceEdge>(edges)
        .id((d) => d.id)
        .distance((d) => {
          const fe = d as ForceEdge
          const srcCluster = clusterOf.get(fe.source as string)
          const tgtCluster = clusterOf.get(fe.target as string)
          if (srcCluster !== tgtCluster) return 150
          return fe.weight >= 3 ? 35 : 55
        })
    )
    .force('charge', d3.forceManyBody<ForceNode>().strength(-180))
    .force('center', d3.forceCenter(0, 0).strength(0.02))
    .force(
      'collision',
      d3.forceCollide<ForceNode>().radius((d) => {
        return (2 + d.connectionCount * 0.8) * 3 + 12
      }).strength(0.8)
    )
    .force('cluster', () => {
      for (const node of nodes) {
        const center = clusterCenters[node.cluster]
        if (!center) continue
        if ((node as any).fx != null) continue
        node.vx += (center.x - node.x) * 0.03
        node.vy += (center.y - node.y) * 0.03
      }
    })
    .stop()

  for (let i = 0; i < 400; i++) simulation.tick()

  // Release pins
  for (const node of nodes) {
    if (featuredNodes.has(node.id)) {
      ;(node as any).fx = null
      ;(node as any).fy = null
    }
  }

  return nodes.map((n): PositionedNode => {
    const isFeatured = featuredNodes.has(n.id)
    const order = readingOrders[n.cluster] ?? []
    const orderIndex = order.indexOf(n.id)
    const baseRadius = 2 + n.connectionCount * 0.8
    const radius = isFeatured ? baseRadius * 1.5 : baseRadius

    let z = (Math.random() - 0.5) * 20
    if (!isFeatured) {
      if (n.hand === 'left') z -= 25
      else if (n.hand === 'right') z += 25
    }

    return { ...n, z, radius, bookOrder: orderIndex >= 0 ? orderIndex + 1 : 99 }
  })
}
```

**Step 4: Run tests**

```bash
cd ~/Desktop/mycelial-engine && npx vitest run src/force.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: configurable force layout"
```

---

### Task 5: Extract renderer into engine (configurable)

**Files:**
- Create: `/Users/vora/Desktop/mycelial-engine/src/renderer.ts`

This is the largest refactor. The renderer must accept `ConstellationConfig` and use it for:
- Colors (instead of hardcoded HAND_COLORS)
- Featured node ID
- Bloom parameters

**Step 1: Write configurable renderer**

Key changes from current renderer.ts:

1. Constructor takes `(container: HTMLElement, config: ConstellationConfig)`
2. Replace `FEATURED_NODE_ID` with `this.config.featuredNode`
3. Replace `HAND_COLORS` with config-derived colors:
   ```typescript
   private handColor(hand: string): number {
     if (hand === 'both') return this.config.colorBoth
     return this.config.color
   }
   ```
4. Bloom params from `this.config.bloom`
5. Add new public fields for ghost/atlas support (added in later tasks)
6. Store config as `private config: ConstellationConfig`

The full file is a copy of `/Users/vora/Desktop/mycelial-tree/src/graph/renderer.ts` with these substitutions:

- Line 10: `const FEATURED_NODE_ID = 'the-constellation'` → removed, use `this.config.featuredNode`
- Lines 13-17: `HAND_COLORS` → removed, replaced by `this.handColor()` method using config
- Line 19-21: `handColor` free function → private method on class
- Line 63: `constructor(private container: HTMLElement)` → `constructor(private container: HTMLElement, private config: ConstellationConfig)`
- Lines 89-91: bloom params `1.2, 0.5, 0.8` → `config.bloom.strength, config.bloom.threshold, config.bloom.radius`
- Lines 135, 259: `FEATURED_NODE_ID` → `this.config.featuredNode`

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: configurable renderer accepting ConstellationConfig"
```

---

### Task 6: Add ghost node support to engine

**Files:**
- Create: `/Users/vora/Desktop/mycelial-engine/src/ghost.ts`
- Modify: `/Users/vora/Desktop/mycelial-engine/src/renderer.ts` (add ghost rendering)
- Modify: `/Users/vora/Desktop/mycelial-engine/src/force.ts` (ghost force params)

**Step 1: Write ghost.ts — bridge node identification**

```typescript
import type { GraphData, GraphNode, GraphEdge, GhostConfig } from './types'

export interface GhostResult {
  ghostNodes: GraphNode[]
  ghostEdges: GraphEdge[]
}

/**
 * Given a local graph and a remote graph, identify bridge nodes:
 * remote nodes that share edges with local nodes.
 * Returns ghost nodes + the bridge edges connecting them.
 */
export function identifyGhosts(
  local: GraphData,
  remote: GraphData,
  ghostConfig: GhostConfig
): GhostResult {
  const localIds = new Set(local.nodes.map(n => n.id))

  // Find all edges in remote graph that connect to local nodes
  const bridgeEdges: GraphEdge[] = []
  const ghostNodeIds = new Set<string>()

  for (const edge of remote.edges) {
    const srcLocal = localIds.has(edge.source)
    const tgtLocal = localIds.has(edge.target)
    const srcRemote = !srcLocal && remote.nodes.some(n => n.id === edge.source)
    const tgtRemote = !tgtLocal && remote.nodes.some(n => n.id === edge.target)

    // Bridge: one end is local, other end is remote
    if (srcLocal && tgtRemote) {
      ghostNodeIds.add(edge.target)
      bridgeEdges.push(edge)
    } else if (tgtLocal && srcRemote) {
      ghostNodeIds.add(edge.source)
      bridgeEdges.push(edge)
    }
  }

  // Also check local edges that reference remote nodes
  for (const edge of local.edges) {
    const srcRemote = !localIds.has(edge.source) && remote.nodes.some(n => n.id === edge.source)
    const tgtRemote = !localIds.has(edge.target) && remote.nodes.some(n => n.id === edge.target)

    if (srcRemote) {
      ghostNodeIds.add(edge.source)
      if (!bridgeEdges.some(e => (e.source === edge.source && e.target === edge.target) || (e.source === edge.target && e.target === edge.source))) {
        bridgeEdges.push(edge)
      }
    }
    if (tgtRemote) {
      ghostNodeIds.add(edge.target)
      if (!bridgeEdges.some(e => (e.source === edge.source && e.target === edge.target) || (e.source === edge.target && e.target === edge.source))) {
        bridgeEdges.push(edge)
      }
    }
  }

  // Build ghost nodes from remote graph
  const ghostNodes: GraphNode[] = remote.nodes
    .filter(n => ghostNodeIds.has(n.id))
    .map(n => ({
      ...n,
      ghost: true,
      cluster: ghostConfig.remoteName,
    }))

  return { ghostNodes, ghostEdges: bridgeEdges }
}

/**
 * Fetch remote graph.json. Returns null on failure (graceful degradation).
 */
export async function fetchRemoteGraph(url: string): Promise<GraphData | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}
```

**Step 2: Write ghost.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import { identifyGhosts } from './ghost'
import type { GraphData, GhostConfig } from './types'

const ghostConfig: GhostConfig = {
  remoteGraphUrl: 'https://example.com/graph.json',
  remoteColor: 0x00B4D8,
  remoteColorCSS: '#00B4D8',
  remoteName: 'cryptosovereignty',
  remoteSiteUrl: 'https://example.com/',
}

describe('identifyGhosts', () => {
  it('finds bridge nodes from remote graph', () => {
    const local: GraphData = {
      nodes: [
        { id: 'a', title: 'A', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'chirality', connectionCount: 1 },
      ],
      edges: [],
    }
    const remote: GraphData = {
      nodes: [
        { id: 'b', title: 'B', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'crypto', connectionCount: 1 },
        { id: 'c', title: 'C', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'crypto', connectionCount: 0 },
      ],
      edges: [
        { source: 'a', target: 'b', weight: 3, type: 'explicit' },
      ],
    }

    const result = identifyGhosts(local, remote, ghostConfig)
    expect(result.ghostNodes).toHaveLength(1)
    expect(result.ghostNodes[0].id).toBe('b')
    expect(result.ghostNodes[0].ghost).toBe(true)
    expect(result.ghostEdges).toHaveLength(1)
  })

  it('returns empty when no bridges exist', () => {
    const local: GraphData = {
      nodes: [{ id: 'a', title: 'A', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'chirality', connectionCount: 0 }],
      edges: [],
    }
    const remote: GraphData = {
      nodes: [{ id: 'b', title: 'B', concepts: [], layer: 'surface', hand: 'left', ghost: false, cluster: 'crypto', connectionCount: 0 }],
      edges: [],
    }

    const result = identifyGhosts(local, remote, ghostConfig)
    expect(result.ghostNodes).toHaveLength(0)
    expect(result.ghostEdges).toHaveLength(0)
  })
})
```

**Step 3: Run tests**

```bash
cd ~/Desktop/mycelial-engine && npx vitest run
```

Expected: All pass.

**Step 4: Add ghost rendering to renderer**

Add to `MoleculeRenderer`:

```typescript
// New private fields
private ghostNodeIds: Set<string> = new Set()
private ghostColor: number = 0
private ghostColorCSS: string = ''
private ghostSiteUrl: string = ''

/**
 * Add ghost nodes to an already-built scene.
 * Called after buildScene() with the ghost identification results.
 */
addGhostNodes(ghostNodes: PositionedNode[], ghostEdges: GraphEdge[], ghostColor: number, ghostColorCSS: string, ghostSiteUrl: string): void {
  this.ghostColor = ghostColor
  this.ghostColorCSS = ghostColorCSS
  this.ghostSiteUrl = ghostSiteUrl

  for (const node of ghostNodes) {
    this.ghostNodeIds.add(node.id)
    this.connectedMap.set(node.id, new Set())
    this.nodeHands.set(node.id, node.hand)
    this.nodeClusterMap.set(node.id, node.cluster)
  }

  // Update adjacency for ghost edges
  for (const edge of ghostEdges) {
    this.connectedMap.get(edge.source)?.add(edge.target)
    this.connectedMap.get(edge.target)?.add(edge.source)
  }

  // Render ghost text labels
  const colorHex = '#' + ghostColor.toString(16).padStart(6, '0')
  for (const node of ghostNodes) {
    const fontSize = Math.min(12, Math.max(9, 7 + node.connectionCount * 1.2))
    const div = document.createElement('div')
    div.className = 'node-text ghost-node'
    div.textContent = node.title
    div.dataset.nodeId = node.id
    div.dataset.ghostSite = ghostSiteUrl
    div.style.fontSize = `${fontSize}px`
    div.style.color = colorHex
    div.style.opacity = '0.20'
    div.style.fontWeight = '300'
    div.style.pointerEvents = 'auto'
    div.style.cursor = 'pointer'

    const label = new CSS2DObject(div)
    label.position.set(node.x, node.y, node.z)
    this.scene.add(label)
    this.labelElements.set(node.id, div)
  }

  // Render ghost edges with gradient-like appearance
  for (const edge of ghostEdges) {
    const src = ghostNodes.find(n => n.id === edge.source) || this.findNodePosition(edge.source)
    const tgt = ghostNodes.find(n => n.id === edge.target) || this.findNodePosition(edge.target)
    if (!src || !tgt) continue

    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(6)
    positions[0] = src.x; positions[1] = src.y; positions[2] = src.z
    positions[3] = tgt.x; positions[4] = tgt.y; positions[5] = tgt.z
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const mat = new THREE.LineBasicMaterial({
      color: ghostColor,
      transparent: true,
      opacity: 0.05,
    })
    const line = new THREE.Line(geo, mat)
    line.userData = {
      srcX: src.x, srcY: src.y, srcZ: src.z,
      tgtX: tgt.x, tgtY: tgt.y, tgtZ: tgt.z,
      sourceId: edge.source, targetId: edge.target,
      isGhostEdge: true,
    }
    this.scene.add(line)
    this.allEdgeLines.push(line)

    if (!this.edgeGroups.has(edge.source)) this.edgeGroups.set(edge.source, [])
    if (!this.edgeGroups.has(edge.target)) this.edgeGroups.set(edge.target, [])
    this.edgeGroups.get(edge.source)!.push(line)
    this.edgeGroups.get(edge.target)!.push(line)
  }
}
```

Also modify `updateHighlight` to handle ghost nodes: when a ghost node is highlighted, brighten to 0.5; when a local bridge node is highlighted, its connected ghosts brighten to 0.35.

Modify `updatePulse` to add ghost shimmer: ghost nodes get a slower, phase-shifted sine wave.

**Step 5: Add ghost positioning to force layout**

In `computeLayout`, when ghost nodes are present in the data, apply weaker cluster force (0.01 instead of 0.03) and push z further back (z -= 40).

Add a `isGhost` check: if `node.ghost === true`, apply ghost-specific force params.

**Step 6: Run all tests**

```bash
cd ~/Desktop/mycelial-engine && npx vitest run
```

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: ghost node identification, rendering, and force params"
```

---

### Task 7: Add atlas mode to engine

**Files:**
- Create: `/Users/vora/Desktop/mycelial-engine/src/atlas.ts`
- Modify: `/Users/vora/Desktop/mycelial-engine/src/renderer.ts` (atlas rendering methods)

**Step 1: Write atlas.ts — merging two graphs**

```typescript
import type { GraphData, GraphEdge } from './types'

/**
 * Merge two constellation graphs into a single atlas graph.
 * All nodes from both, plus bridge edges connecting them.
 */
export function mergeForAtlas(local: GraphData, remote: GraphData): GraphData {
  const localIds = new Set(local.nodes.map(n => n.id))
  const remoteIds = new Set(remote.nodes.map(n => n.id))

  // All nodes, no ghost flag — everyone is real in atlas
  const nodes = [
    ...local.nodes.map(n => ({ ...n, ghost: false })),
    ...remote.nodes.filter(n => !localIds.has(n.id)).map(n => ({ ...n, ghost: false })),
  ]

  // All edges from both, deduplicated
  const seen = new Set<string>()
  const edges: GraphEdge[] = []
  const key = (a: string, b: string) => [a, b].sort().join('::')

  for (const edge of [...local.edges, ...remote.edges]) {
    const k = key(edge.source, edge.target)
    if (!seen.has(k)) {
      seen.add(k)
      edges.push(edge)
    }
  }

  return { nodes, edges }
}
```

**Step 2: Add atlas rendering to MoleculeRenderer**

Add method `enterAtlasMode(remoteNodes, remoteEdges, remoteConfig)`:
- Renders all remote nodes at full fidelity with remote config's color
- Bridge edges get a gradient effect (use two overlapping lines: one in local color fading out, one in remote color fading in)
- Camera pulls back to z=400 to frame both clusters
- Entry animation: remote cluster fades in over 1.5s, bridge edges trace in after 0.8s delay

Add method `exitAtlasMode()`:
- Remove remote nodes and bridge gradient edges
- Camera travels back to active cluster

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: atlas mode — graph merging and dual rendering"
```

---

### Task 8: Create engine index and build

**Files:**
- Create: `/Users/vora/Desktop/mycelial-engine/src/index.ts`

**Step 1: Write public API**

```typescript
// Runtime (browser)
export { MoleculeRenderer } from './renderer'
export { computeLayout } from './force'
export { identifyGhosts, fetchRemoteGraph } from './ghost'
export { mergeForAtlas } from './atlas'

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
```

**Step 2: Build**

```bash
cd ~/Desktop/mycelial-engine && npm run build
```

Expected: `dist/` created with .js and .d.ts files.

**Step 3: Run all tests**

```bash
npx vitest run
```

**Step 4: Commit and tag**

```bash
git add -A && git commit -m "feat: public API and build"
git tag v0.1.0
```

---

### Task 9: Refactor mycelial-tree to use engine (chirality only)

**Files:**
- Modify: `/Users/vora/Desktop/mycelial-tree/package.json`
- Modify: `/Users/vora/Desktop/mycelial-tree/src/main.ts`
- Modify: `/Users/vora/Desktop/mycelial-tree/src/style.css` (minor — add ghost node CSS)
- Modify: `/Users/vora/Desktop/mycelial-tree/index.html` (add Atlas to cluster nav)
- Delete: `/Users/vora/Desktop/mycelial-tree/src/graph/renderer.ts`
- Delete: `/Users/vora/Desktop/mycelial-tree/src/graph/force.ts`
- Delete: `/Users/vora/Desktop/mycelial-tree/src/data/types.ts`
- Delete: `/Users/vora/Desktop/mycelial-tree/content/cryptosovereignty/` (move to crypto repo)
- Modify: `/Users/vora/Desktop/mycelial-tree/scripts/build-graph.ts` (use engine's buildGraph, keep CLI)

**Step 1: Link engine locally**

```bash
cd ~/Desktop/mycelial-engine && npm link
cd ~/Desktop/mycelial-tree && npm link @vora/mycelial-engine
```

**Step 2: Create chirality config**

Create `/Users/vora/Desktop/mycelial-tree/src/config.ts`:

```typescript
import type { ConstellationConfig, GhostConfig } from '@vora/mycelial-engine'

export const CHIRALITY_CONFIG: ConstellationConfig = {
  name: 'chirality',
  color: 0xF7931A,
  colorDim: 0xc47515,
  colorCSS: '#F7931A',
  colorBoth: 0xD4A853,
  colorBothCSS: '#D4A853',
  featuredNode: 'the-constellation',
  readingOrder: [
    'the-constellation',
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
  ],
  clusterCenter: { x: 0, y: 0 },  // Single cluster — centered
  bloom: { strength: 1.2, threshold: 0.5, radius: 0.8 },
}

export const GHOST_CONFIG: GhostConfig = {
  remoteGraphUrl: 'https://coindork.github.io/cryptosovereignty/graph.json',
  remoteColor: 0x00B4D8,
  remoteColorCSS: '#00B4D8',
  remoteName: 'cryptosovereignty',
  remoteSiteUrl: 'https://coindork.github.io/cryptosovereignty/',
}
```

Note: `clusterCenter` is `{ x: 0, y: 0 }` because when this site is standalone, chirality is the only cluster and should be centered. In atlas mode, the engine repositions it.

**Step 3: Rewrite main.ts to use engine imports**

Replace:
```typescript
import { computeLayout, BOOK_ORDER, CRYPTO_ORDER } from './graph/force'
import { MoleculeRenderer } from './graph/renderer'
import type { PositionedNode } from './graph/force'
import type { GraphData } from './data/types'
```

With:
```typescript
import { computeLayout, MoleculeRenderer, fetchRemoteGraph, identifyGhosts } from '@vora/mycelial-engine'
import type { PositionedNode, GraphData } from '@vora/mycelial-engine'
import { CHIRALITY_CONFIG, GHOST_CONFIG } from './config'
```

Update `init()`:
```typescript
async function init(): Promise<void> {
  const base = import.meta.env.BASE_URL
  const resp = await fetch(`${base}graph.json`)
  const data: GraphData = await resp.json()

  const container = document.getElementById('graph-container')!
  const renderer = new MoleculeRenderer(container, CHIRALITY_CONFIG)
  currentRenderer = renderer

  const nodes = computeLayout(data, [CHIRALITY_CONFIG])
  renderer.buildScene(nodes, data.edges)
  buildSidebar(nodes, renderer)
  setupReader()
  setupClusterNav(nodes, renderer)

  // Ghost nodes — fetch remote, non-blocking
  fetchRemoteGraph(GHOST_CONFIG.remoteGraphUrl).then(remoteData => {
    if (!remoteData) return
    const { ghostNodes, ghostEdges } = identifyGhosts(data, remoteData, GHOST_CONFIG)
    if (ghostNodes.length === 0) return
    // Position ghost nodes with force layout
    const ghostPositioned = computeLayout(
      { nodes: [...data.nodes, ...ghostNodes], edges: [...data.edges, ...ghostEdges] },
      [CHIRALITY_CONFIG]
    ).filter(n => ghostNodes.some(g => g.id === n.id))
    // Push ghosts back in z
    for (const g of ghostPositioned) g.z -= 40
    renderer.addGhostNodes(ghostPositioned, ghostEdges, GHOST_CONFIG.remoteColor, GHOST_CONFIG.remoteColorCSS, GHOST_CONFIG.remoteSiteUrl)
  })

  // ... rest of init unchanged ...
}
```

Update `buildSidebar` to use `CHIRALITY_CONFIG.readingOrder` instead of imported `BOOK_ORDER`.

Remove the `CRYPTO_ORDER` import and the cryptosovereignty cluster nav click handler.

**Step 4: Update cluster nav in index.html**

Replace the cluster-nav section:
```html
<div id="cluster-nav">
  <span class="cluster-label active" data-cluster="chirality">Chirality</span>
  <span class="cluster-label" data-cluster="atlas">Atlas</span>
  <a class="cluster-label" href="https://coindork.github.io/cryptosovereignty/" data-cluster="cryptosovereignty">Cryptosovereignty</a>
</div>
```

**Step 5: Add ghost CSS to style.css**

```css
/* Ghost nodes */
.ghost-node {
  transition: opacity 0.4s ease;
}
.ghost-node:hover {
  opacity: 0.5 !important;
}
```

**Step 6: Update build-graph.ts CLI to only read chirality**

Remove the cryptosovereignty content source:
```typescript
const contentSources: { dir: string; cluster: string }[] = [
  { dir: path.join(contentDir, 'essays'), cluster: 'chirality' },
]
```

**Step 7: Delete old source files**

```bash
rm -rf ~/Desktop/mycelial-tree/src/graph/
rm -rf ~/Desktop/mycelial-tree/src/data/
```

**Step 8: Move crypto content to staging (for Task 10)**

```bash
mkdir -p /tmp/cryptosovereignty-content
cp -r ~/Desktop/mycelial-tree/content/cryptosovereignty/* /tmp/cryptosovereignty-content/
rm -rf ~/Desktop/mycelial-tree/content/cryptosovereignty/
```

**Step 9: Build and test**

```bash
cd ~/Desktop/mycelial-tree && npm run build:graph && npm run dev
```

Verify: chirality site loads, 16 nodes, amber palette, no crypto cluster.

**Step 10: Commit**

```bash
git add -A && git commit -m "refactor: use mycelial-engine, chirality-only site"
```

---

### Task 10: Create cryptosovereignty site

**Files:**
- Create: `/Users/vora/Desktop/cryptosovereignty/` (full site)

**Step 1: Initialize repo**

```bash
cd ~/Desktop
mkdir cryptosovereignty && cd cryptosovereignty
git init
npm init -y
```

**Step 2: Write package.json**

```json
{
  "name": "cryptosovereignty",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "dev": "npm run build:graph && vite",
    "build": "npm run build:graph && vite build",
    "preview": "vite preview",
    "build:graph": "npx tsx scripts/build-graph.ts"
  },
  "devDependencies": {
    "@types/d3": "^7.4.3",
    "@types/node": "^25.3.3",
    "@types/three": "^0.183.1",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3",
    "vite": "^7.3.1",
    "vitest": "^4.0.18"
  },
  "dependencies": {
    "@vora/mycelial-engine": "file:../mycelial-engine",
    "d3": "^7.9.0",
    "gray-matter": "^4.0.3",
    "marked": "^17.0.4",
    "three": "^0.183.2"
  }
}
```

**Step 3: Move content**

```bash
mkdir -p ~/Desktop/cryptosovereignty/content/essays
cp /tmp/cryptosovereignty-content/* ~/Desktop/cryptosovereignty/content/essays/
```

**Step 4: Create config.ts with cerulean palette**

```typescript
import type { ConstellationConfig, GhostConfig } from '@vora/mycelial-engine'

export const CRYPTO_CONFIG: ConstellationConfig = {
  name: 'cryptosovereignty',
  color: 0x00B4D8,
  colorDim: 0x0096C7,
  colorCSS: '#00B4D8',
  colorBoth: 0x4ECDC4,
  colorBothCSS: '#4ECDC4',
  featuredNode: 'ext-the-event-and-the-clearing',
  readingOrder: [
    'ext-the-event-and-the-clearing',
    '01-cryptosovereignty',
    '02-the-encrypted-meaning-of-crypto',
    '03-the-new-form-of-power',
    '04-crypto-truth-and-power',
    '05-the-political-theology-of-crypto',
    '06-crypto-without-criticisms',
    '07-the-sovereign-the-subject',
    '08-the-theological-conquest-of-money',
    '09-the-legend-of-satoshi-nakamoto',
    '10-the-concept-of-the-political',
    '11-the-oath-of-machines',
    '12-messianic-bitcoin',
    '13-the-pedagogy-of-bitcoin',
    '14-the-political-theology-of-bitcoin',
    '15-bitcoin-and-the-state-of-emergency',
    '16-theory-of-the-crypto-partisan',
    '17-to-my-crypto-comrades',
    '18-the-hope-of-bitcoin',
    '19-bitcoin-and-the-conquest-of-privacy',
    '20-the-question-concerning-bitcoin',
    'ext-first-philosophy',
    'ext-sovereign-mutualism',
    'ext-the-solitary-sovereign',
  ],
  clusterCenter: { x: 0, y: 0 },
  bloom: { strength: 1.2, threshold: 0.5, radius: 0.8 },
}

export const GHOST_CONFIG: GhostConfig = {
  remoteGraphUrl: 'https://coindork.github.io/mycelial-tree/graph.json',
  remoteColor: 0xF7931A,
  remoteColorCSS: '#F7931A',
  remoteName: 'chirality',
  remoteSiteUrl: 'https://coindork.github.io/mycelial-tree/',
}
```

**Step 5: Write style.css with cerulean palette**

Copy chirality's style.css. Replace all color references:
- `--orange: #00B4D8` (cerulean replaces amber)
- `--orange-dim: #0096C7`
- `--filament: rgba(0, 180, 216, 0.3)`

**Step 6: Write index.html with crypto intro**

Same structure as chirality's index.html. Change:
- Title: "Cryptosovereignty — Vora"
- OG tags: crypto-specific description
- Intro content: 3 sections on sovereignty, proof, the clearing in economic domain
- Cluster nav: `Cryptosovereignty` (active) | `Atlas` | `Chirality` (link to mycelial-tree)

Intro text (draft):

Section 1:
> Auctoritas, non veritas, facit legem. Authority, not truth, makes law. For four hundred years this was the ground of political order. Then in 2009, a pseudonymous cryptographer inverted it.

Section 2:
> These twenty-four essays trace what happened when truth replaced authority as the ground of economic sovereignty. Not a technology review. Not a manifesto. A philosophical investigation into the structure of freedom that cryptography makes possible.

Section 3:
> Heidegger asked what technology reveals. Bitcoin answered. Hover any title to see its connections. Click to read. The reading order on the right traces the argument — but every path through the constellation is valid.

**Step 7: Write main.ts**

Mirror chirality's main.ts with:
- `CRYPTO_CONFIG` and `GHOST_CONFIG` imports
- Crypto-specific `TERM_DATA` (subset of terms relevant to crypto essays)
- Ghost nodes in amber (from chirality)
- Atlas mode toggle

**Step 8: Write vite.config.ts**

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: '/cryptosovereignty/',
  publicDir: 'public',
  build: { outDir: 'dist' },
  server: { open: true },
})
```

**Step 9: Write build-graph.ts CLI**

Minimal CLI that imports `buildGraph` from engine:

```typescript
import fs from 'fs'
import path from 'path'
import { buildGraph } from '@vora/mycelial-engine/build'

const contentDir = path.resolve(__dirname, '..', 'content', 'essays')
const publicDir = path.resolve(__dirname, '..', 'public')
const essaysOutDir = path.join(publicDir, 'essays')

fs.mkdirSync(publicDir, { recursive: true })
fs.mkdirSync(essaysOutDir, { recursive: true })

const filenames = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'))
const files = filenames.map(filename => ({
  filename,
  raw: fs.readFileSync(path.join(contentDir, filename), 'utf-8'),
  cluster: 'cryptosovereignty',
}))

const { graph, essays } = buildGraph(files)

fs.writeFileSync(path.join(publicDir, 'graph.json'), JSON.stringify(graph, null, 2))
for (const essay of essays) {
  fs.writeFileSync(path.join(essaysOutDir, `${essay.id}.html`), essay.html)
}

console.log(`Built graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`)
```

**Step 10: Install, build, test**

```bash
cd ~/Desktop/cryptosovereignty && npm install && npm run build:graph && npm run dev
```

Verify: crypto site loads, 24 nodes, cerulean palette, ghost amber nodes from chirality appear.

**Step 11: Commit**

```bash
git add -A && git commit -m "feat: cryptosovereignty site with cerulean palette and ghost nodes"
```

---

### Task 11: Atlas mode integration in both sites

**Files:**
- Modify: `/Users/vora/Desktop/mycelial-tree/src/main.ts` (atlas toggle handler)
- Modify: `/Users/vora/Desktop/cryptosovereignty/src/main.ts` (atlas toggle handler)

**Step 1: Wire atlas toggle in chirality site**

In `setupClusterNav`, add handler for `data-cluster="atlas"`:

```typescript
if (cluster === 'atlas') {
  // Fetch remote graph and enter atlas mode
  const remoteData = await fetchRemoteGraph(GHOST_CONFIG.remoteGraphUrl)
  if (!remoteData) return
  const merged = mergeForAtlas(data, remoteData)
  const atlasConfigs = [
    { ...CHIRALITY_CONFIG, clusterCenter: { x: 200, y: 0 } },
    { ...CRYPTO_REMOTE_CONFIG, clusterCenter: { x: -200, y: 0 } },
  ]
  const atlasNodes = computeLayout(merged, atlasConfigs)
  renderer.enterAtlasMode(atlasNodes, merged.edges, atlasConfigs)
  return
}
```

Where `CRYPTO_REMOTE_CONFIG` is the crypto constellation's config (needed for atlas rendering with cerulean color).

**Step 2: Same for crypto site (mirrored)**

**Step 3: Test both sites — toggle to atlas, verify both clusters render**

**Step 4: Commit both repos**

```bash
cd ~/Desktop/mycelial-tree && git add -A && git commit -m "feat: atlas mode toggle"
cd ~/Desktop/cryptosovereignty && git add -A && git commit -m "feat: atlas mode toggle"
```

---

### Task 12: Polish — gradient edges, shimmer, animations

**Files:**
- Modify: `/Users/vora/Desktop/mycelial-engine/src/renderer.ts`

**Step 1: Gradient bridge edges in atlas mode**

Bridge edges (crossing clusters) get two overlapping lines:
- Line 1: local constellation color, opacity fading from 0.3 → 0.0 across the midpoint
- Line 2: remote constellation color, opacity fading from 0.0 → 0.3 across the midpoint

Implementation: use two Line objects per bridge edge, each with half the vertices.

**Step 2: Ghost shimmer animation**

In `updatePulse`, add:
```typescript
// Ghost shimmer — slower, phase-shifted
for (const [id, div] of this.labelElements) {
  if (!this.ghostNodeIds.has(id)) continue
  const shimmer = 0.15 + 0.08 * Math.sin(time * 0.7 + id.length * 0.5)
  div.style.opacity = String(shimmer)
}
```

**Step 3: Atlas entry animation**

When entering atlas mode:
1. Current cluster slides to its side position (camera travel 2s)
2. Remote cluster nodes added with opacity 0, fade to full over 1.5s
3. Bridge edges added with delay — trace in after 0.8s

**Step 4: Test visually — verify shimmer, gradients, smooth transitions**

**Step 5: Commit**

```bash
cd ~/Desktop/mycelial-engine && git add -A && git commit -m "polish: gradient bridge edges, ghost shimmer, atlas animations"
```

---

### Task 13: Cross-site navigation and hash routing

**Files:**
- Modify: both sites' `main.ts`

**Step 1: Ghost node click → cross-site navigation**

Add click handler to ghost node labels:
```typescript
div.addEventListener('click', () => {
  window.location.href = `${ghostSiteUrl}#${node.id}`
})
```

**Step 2: Hash-based essay opening**

Both sites already handle `window.location.hash` to skip intro. Extend to also open the essay reader:
```typescript
if (window.location.hash.length > 1) {
  const essayId = window.location.hash.slice(1)
  renderer.start()
  showSidebar()
  // Highlight and open the essay
  renderer.highlightedNodeId = essayId
  openEssay(essayId)
}
```

**Step 3: Test cross-site navigation — click ghost node, verify other site opens to that essay**

**Step 4: Commit both repos**

---

### Task 14: Deploy both sites

**Step 1: Create GitHub repo for cryptosovereignty**

```bash
cd ~/Desktop/cryptosovereignty
gh repo create coindork/cryptosovereignty --public --source=. --push
```

**Step 2: Set up GitHub Pages for both repos**

Both repos use Vite build → `dist/` directory. Configure GitHub Pages to serve from `gh-pages` branch or Actions.

**Step 3: Publish engine to GitHub Packages (or use npm link for now)**

```bash
cd ~/Desktop/mycelial-engine
# Update package.json with publishConfig for GitHub Packages
npm publish
```

**Step 4: Update both sites to depend on published engine**

Replace `"file:../mycelial-engine"` with `"@vora/mycelial-engine": "^0.1.0"` in both package.json files.

**Step 5: Build and deploy both**

```bash
cd ~/Desktop/mycelial-tree && npm run build
cd ~/Desktop/cryptosovereignty && npm run build
```

**Step 6: Verify live — both sites load, ghost nodes appear, atlas mode works, cross-site links work**

**Step 7: Final commit on both repos**

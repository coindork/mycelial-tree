# Constellation Split: Design Document

Two constellations, two sites, one mycelial network.

## Architecture

Three git repos. One shared engine, two independent sites.

### Repos

| Repo | Contents | Deploys to |
|------|----------|------------|
| `mycelial-engine` | Configurable renderer, force layout, types, build-graph | npm package (GitHub Packages) |
| `mycelial-tree` | Chirality site: 16 essays, amber palette, intro | GitHub Pages `/mycelial-tree/` |
| `cryptosovereignty` | Crypto site: 24 essays, cerulean palette, intro | GitHub Pages `/cryptosovereignty/` |

### Engine Config Interface

```typescript
interface ConstellationConfig {
  name: string
  color: number             // Three.js hex primary
  colorDim: number          // dimmed variant
  colorCSS: string          // CSS color string
  featuredNode: string      // central node ID
  readingOrder: string[]    // essay IDs in chapter order
  remoteGraphUrl: string    // other site's published graph.json
  bloom: { strength: number; threshold: number; radius: number }
}
```

Each site provides: content markdown, intro HTML, TERM_DATA glossary, and its config. The engine handles rendering, force layout, ghost nodes, atlas mode, and all interactions.

## Color System

### Chirality (warm)
- Primary: `#F7931A` / `0xF7931A` (amber)
- Dim: `#c47515` / `0xc47515`
- Character: organic, pulsing, alive

### Cryptosovereignty (cold)
- Primary: `#00B4D8` / `0x00B4D8` (cerulean)
- Dim: `#0096C7` / `0x0096C7`
- Character: electric, austere, structural

### Shared foundation
- Background: `#0a0a0a`
- Body text: `#e0e0e0`
- Muted: `#888888`
- Dim: `#555555`

### "Both" hand nodes
- Chirality site: interpolate amber <-> gold (existing)
- Crypto site: interpolate cerulean <-> white
- Atlas: interpolate amber <-> cerulean (they belong to both worlds)

## Ghost Nodes

Nodes from the other constellation that share a direct edge with a local node.

### Selection
Any remote node with an explicit or conceptual edge to a local node. ~6-8 bridge nodes per side based on current frontmatter connections.

### Visual treatment
- Rendered in the OTHER constellation's color (cerulean ghosts on chirality, amber ghosts on crypto)
- Base opacity: 0.20 (vs 0.45 for local nodes)
- Slower shimmer animation: phase-shifted sine wave, separate from main pulse
- Font size capped at 12px regardless of connection count
- No emissive dot. Text only, floating.
- Ghost edges: gradient fading toward the ghost. Base opacity 0.05.

### Positioning
- Participate in force layout with weaker cluster attraction (0.01 vs 0.03)
- Orbit the periphery, near their bridge partners
- Deeper z-plane (z -= 40) — they exist behind the main constellation

### Interaction
- Hover ghost: brightens to 0.5 opacity, bridge edges light up, label shows title + external indicator
- Click ghost: navigates to other site with hash anchor, skipping intro
- Hover local bridge node: connected ghosts brighten automatically, revealing the corridor outward

### Degradation
If remote graph.json fetch fails, site renders without ghosts. No error state.

## Atlas Mode

The full mycelial network. Both constellations rendered together at full fidelity.

### Entry points
- Each site's cluster nav extends: "Chirality" / "Atlas" / "Cryptosovereignty"
- Toggling to Atlas fetches the remote graph.json and renders both constellations
- Toggling to the other constellation's name navigates to that site
- Also deployable standalone via a thin wrapper if a dedicated URL is wanted later

### Visual design
- Both constellations at full color: amber cluster left, cerulean cluster right
- All nodes at full fidelity (no ghosts — everyone's real in atlas)
- Bridge edges are the stars: rendered with an amber-to-cerulean gradient
- Bridge edges at higher base opacity (0.15 vs 0.08 for within-cluster)
- Camera starts pulled back (z: 400) to frame both clusters, slow auto-rotation
- Cluster centers: chirality at x=200, cryptosovereignty at x=-200 (existing layout)

### Atlas entry animation
- From single constellation: current cluster slides to its side position
- Other constellation fades in on the opposite side (opacity 0 -> 1 over 1.5s)
- Bridge edges trace in last (0.8s delay), connecting the two forests
- Camera pulls back smoothly to frame the full network

### Atlas interactions
- Sidebar shows active cluster's reading order (click cluster nav to switch)
- Hovering a bridge node highlights connections in BOTH constellations
- Hovering any node dims the other constellation to 0.15 opacity (focus)
- Essay reader works for either constellation's essays (fetched from respective site)

## Data Architecture

### Build-time
Each site runs `build-graph` on its own content directory, producing:
- `graph.json` — nodes and edges for its constellation
- `essays/*.html` — rendered essay HTML

The build-graph script is part of the engine. Each site calls it with its content path and cluster name.

### Runtime: ghost nodes
1. Site loads its own `graph.json` (local, bundled)
2. Site fetches the other site's `graph.json` from `remoteGraphUrl`
3. Engine identifies bridge nodes: remote nodes with edges to local nodes
4. Bridge nodes are injected into the force layout with ghost config
5. Force layout runs with both sets (ghosts have weaker forces)
6. Renderer tags ghost nodes with the remote constellation's palette

### Runtime: atlas mode
1. Both graphs loaded (local already present, remote fetched)
2. All nodes rendered at full fidelity, no ghost treatment
3. Each cluster uses its own palette
4. Bridge edges get gradient material (color A -> color B)
5. Force layout runs with full parameters for both clusters

### graph.json schema (unchanged)
```json
{
  "nodes": [
    { "id": "string", "title": "string", "concepts": ["..."], "hand": "left|right|both", "cluster": "string", "connectionCount": 0, "ghost": false }
  ],
  "edges": [
    { "source": "string", "target": "string", "weight": 2, "type": "explicit|conceptual" }
  ]
}
```

## Interaction Design

### Navigation model
- Each site defaults to its own constellation
- Cluster nav: own name (active) | Atlas | other name (outbound link)
- Ghost node clicks = cross-site navigation
- Atlas mode = in-page expansion, not a separate page load

### URL structure
- Chirality: `coindork.github.io/mycelial-tree/`
- Chirality essay: `coindork.github.io/mycelial-tree/#the-handedness-of-being`
- Crypto: `coindork.github.io/cryptosovereignty/`
- Crypto essay: `coindork.github.io/cryptosovereignty/#ext-first-philosophy`
- Hash links skip intro and open the essay reader directly

### Cross-site essay reading
In atlas mode, clicking a crypto essay from the chirality site fetches the HTML from the crypto site's published `essays/` directory. CORS headers required on GitHub Pages (or essays bundled at build time from both sources).

Alternative: atlas mode bundles both essay sets at build time. Simpler, no CORS, but requires rebuild when either site's content changes. Recommend this approach — atlas rebuild is cheap.

## Engine Module Structure

```
mycelial-engine/
  src/
    renderer.ts       — Three.js scene, bloom, CSS2D labels, highlight, edge trace
    force.ts          — D3 force layout, cluster positioning, ghost force params
    ghost.ts          — ghost node identification, merging, visual config
    atlas.ts          — atlas mode: dual rendering, gradient edges, entry animation
    types.ts          — GraphNode, GraphEdge, GraphData, ConstellationConfig
    build-graph.ts    — markdown parsing, edge discovery, graph.json generation
    config.ts         — default bloom/force/visual constants, overridable
  index.ts            — public API exports
  package.json
```

## Site Template Structure

```
[site-name]/
  content/
    essays/           — markdown with YAML frontmatter
  public/
    graph.json        — generated
    essays/           — generated HTML
  src/
    main.ts           — app shell, intro, sidebar, term data, atlas toggle
    config.ts         — ConstellationConfig for this site
    style.css         — CSS variables set to this site's palette
  index.html          — intro sections, graph container, sidebar, reader
  vite.config.ts
  package.json        — depends on mycelial-engine
```

## Implementation Order

1. Extract engine from mycelial-tree into mycelial-engine repo
2. Refactor renderer/force to accept ConstellationConfig
3. Make mycelial-tree depend on engine, verify chirality site works unchanged
4. Create cryptosovereignty repo from template, move crypto essays, configure cerulean palette
5. Implement ghost node system in engine (ghost.ts)
6. Implement atlas mode in engine (atlas.ts)
7. Wire atlas toggle into both sites
8. Build crypto site intro sequence
9. Deploy both sites, verify cross-site ghost nodes and atlas mode
10. Polish: gradient edges, entry animations, shimmer effects, mobile fallbacks

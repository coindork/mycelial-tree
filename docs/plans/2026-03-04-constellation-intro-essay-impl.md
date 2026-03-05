# Constellation Intro Essay — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Write "The Constellation" intro essay and integrate it as essay #0 in the mycelial tree site — new node in the 3D molecule, first item in sidebar, clickable to read.

**Architecture:** Create a new markdown essay in `content/essays/`, add it to `BOOK_ORDER` in `force.ts`, clean up sidebar display titles. The build script (`scripts/build-graph.ts`) already handles markdown → HTML compilation and graph.json generation from frontmatter, so adding a new essay file with proper `connects_to` references will automatically create the node and edges.

**Tech Stack:** Markdown (gray-matter frontmatter), TypeScript, three.js, d3, Vite

---

### Task 1: Write the essay

**Files:**
- Create: `content/essays/the-constellation.md`

**Step 1: Create the essay file with frontmatter and full content**

The essay follows the Five Wounds → Five Healings structure from the design doc. Frontmatter must include `connects_to` references to every essay it cites (which creates edges in the graph). Hand is `both` (it bridges left and right). Layer is `surface`.

```markdown
---
title: "The Constellation"
subtitle: "Fifteen essays, five wounds, one completion"
date: 2026-03-04
concepts: [chirality, Heidegger, Ereignis, Mitsein, fourfold, Gestell, Levinas, Wu, dwelling, completion]
connects_to:
  - the-handedness-of-being.md
  - the-five-completions.md
  - the-chiral-completion.md
  - chirality.md
  - the-proof-of-love.md
  - care-can-now-be-proved.md
  - 11-the-event-of-logic.md
  - tuesday-in-the-clearing.md
  - the-cete.md
  - chirality-agamben.md
  - chiral-pedagogy.md
  - 05-the-filter.md
  - 06-dwelling-in-the-digital-age.md
  - the-passage.md
  - theses-on-chirality.md
layer: surface
hand: both
---
```

Body: ~3000-4000 words across five sections (I–V) plus a brief coda. Written in Erik's voice — direct, precise, alternating between philosophical argument and physical metaphor. No hedging. Declarative. The philosophical peer is the reader.

Full essay content to be drafted drawing on all 15 essays. See design doc at `docs/plans/2026-03-04-constellation-intro-essay-design.md` for the section breakdown.

**Step 2: Verify frontmatter parses**

Run: `npx tsx -e "const m = require('gray-matter'); const fs = require('fs'); const r = m(fs.readFileSync('content/essays/the-constellation.md','utf-8')); console.log(r.data.title, r.data.connects_to.length + ' connections')"`
Expected: `The Constellation 15 connections`

**Step 3: Commit**

```bash
git add content/essays/the-constellation.md
git commit -m "feat: add The Constellation intro essay"
```

---

### Task 2: Add to BOOK_ORDER and clean sidebar titles

**Files:**
- Modify: `src/graph/force.ts:6-22` — add `'the-constellation'` as first entry in `BOOK_ORDER`

**Step 1: Update BOOK_ORDER**

In `src/graph/force.ts`, add `'the-constellation'` as the first element of the `BOOK_ORDER` array:

```typescript
export const BOOK_ORDER: string[] = [
  'the-constellation',        // NEW — intro essay
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
```

**Step 2: Clean up sidebar display titles**

The sidebar currently shows whatever `node.title` is from graph.json. The titles come from each essay's frontmatter `title` field. Check that these are clean:

- `05-the-filter.md` → frontmatter title is "The Filter" ✓
- `06-dwelling-in-the-digital-age.md` → frontmatter title is "Dwelling in the Digital Age" ✓
- `11-the-event-of-logic.md` → frontmatter title is "The Event of Logic" ✓
- `care-can-now-be-proved.md` → frontmatter title is "The Question Concerning Care" ✓

Titles are already clean in frontmatter — the `05-`, `06-`, `11-` prefixes are only in filenames, not titles. No changes needed.

**Step 3: Commit**

```bash
git add src/graph/force.ts
git commit -m "feat: add The Constellation to BOOK_ORDER as first entry"
```

---

### Task 3: Update FEATURED_NODE_ID

**Files:**
- Modify: `src/graph/force.ts:4` — change `FEATURED_NODE_ID` to `'the-constellation'`
- Modify: `src/graph/renderer.ts:10` — change `FEATURED_NODE_ID` to `'the-constellation'`

**Step 1: Update force.ts**

Change line 4:
```typescript
const FEATURED_NODE_ID = 'the-constellation'
```

**Step 2: Update renderer.ts**

Change line 10:
```typescript
const FEATURED_NODE_ID = 'the-constellation'
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds, "Built graph: 16 nodes, NN edges" (more edges than before due to 15 new connections)

**Step 4: Commit**

```bash
git add src/graph/force.ts src/graph/renderer.ts
git commit -m "feat: center molecule on The Constellation node"
```

---

### Task 4: Build, verify, and push

**Step 1: Full build**

Run: `npm run build`
Expected:
- "Built graph: 16 nodes" (was 15)
- "Wrote 16 essay HTML files" (was 15)
- Vite build succeeds

**Step 2: Verify essay HTML exists**

Run: `cat dist/essays/the-constellation.html | head -5`
Expected: HTML content starting with `<h2>` tags from the essay

**Step 3: Verify graph.json has new node**

Run: `node -e "const g=require('./public/graph.json'); const n=g.nodes.find(n=>n.id==='the-constellation'); console.log(n.title, n.connectionCount)"`
Expected: `The Constellation 15` (connected to all other essays)

**Step 4: Push**

```bash
git push origin main
```

Expected: Deploys to coindork.github.io/mycelial-tree/

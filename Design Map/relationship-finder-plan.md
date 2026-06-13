# Relationship Finder — Algorithm + Cache Plan

## What This Feature Does

When a user selects two people in the tree, the app computes and displays the exact genealogical relationship between them:

> "John Smith is Alex's **second cousin once removed.**"

Three CS concepts stack together to make this work:
1. **BFS + Lowest Common Ancestor (LCA)** — the graph algorithm that finds the relationship
2. **djb2 hashing** — detects when the tree topology has changed
3. **Memoization cache** — avoids recomputing relationships already calculated

---

## Layer 1: BFS + LCA Algorithm

Family tree relationships are determined by:
- Finding the most recent common ancestor (LCA) of two people
- Measuring how many generations each person is from that ancestor
- Mapping those distances to relationship terminology

### Step 1 — Build a parent graph from edges

The existing edge data already encodes direction via `edge.data.relationship`:
- `'parent'`: `target` is the parent of `source`
- `'child'`: `target` is the child of `source`
- `'partner'` / `'sibling'`: not used for ancestor traversal

Build a `Map<nodeId, { parents: Set<nodeId>, children: Set<nodeId> }>` from `tree.edges`.

### Step 2 — BFS upward to find all ancestors

From a given node, walk upward through parents via BFS. Track how many generations up each ancestor is.

```
getAncestors("person-5") → Map { "person-3" → 1, "person-1" → 2, ... }
```

### Step 3 — Find the LCA

Run `getAncestors` on both Person A and Person B (include self at distance 0). The LCA is the ancestor present in both maps with the lowest combined distance.

```
LCA = { id: "person-1", distFromA: 2, distFromB: 2 }
```

### Step 4 — Map distances to relationship label

| distA | distB | Relationship (from A's perspective) |
|---|---|---|
| 1 | 0 | Child |
| 0 | 1 | Parent |
| 2 | 0 | Grandchild |
| 0 | 2 | Grandparent |
| 0 | n | Great×(n−2) Grandparent |
| 1 | 1 | Sibling |
| 2 | 2 | First Cousin |
| 3 | 3 | Second Cousin |
| n | n | (n−1)th Cousin |
| 2 | 3 | First Cousin Once Removed |
| 2 | 4 | First Cousin Twice Removed |

**General formula for cousins:**
- `degree = min(distA, distB) − 1`
- `removed = |distA − distB|`

If no common ancestor exists → `"No known relationship"`

---

## Layer 2: djb2 Hash for Cache Invalidation

When a user adds or removes an edge, all cached relationship results could be stale. Instead of clearing the cache on every render, hash the tree **topology** and only invalidate when the hash changes.

Only edges matter for relationships — node positions and visual styles are excluded from the hash.

```js
function hashTopology(edges) {
  const fingerprint = edges
    .map(e => `${e.source}>${e.target}:${e.data.relationship}`)
    .sort()
    .join('|');

  let hash = 5381;
  for (let i = 0; i < fingerprint.length; i++) {
    hash = ((hash << 5) + hash) ^ fingerprint.charCodeAt(i);
    hash = hash >>> 0; // unsigned 32-bit
  }
  return hash;
}
```

djb2 is the same hash family used in C standard library hash table implementations. It's fast, simple, and produces good distribution for string keys.

---

## Layer 3: Memoization Cache

```js
const cache = new Map();  // "person-1::person-3" → RelationshipResult
let lastHash = null;

function getRelationship(idA, idB, tree) {
  const hash = hashTopology(tree.edges);
  if (hash !== lastHash) {
    cache.clear();         // topology changed — invalidate all cached results
    lastHash = hash;
  }

  const key = [idA, idB].sort().join('::');  // canonical, order-independent key
  if (!cache.has(key)) {
    cache.set(key, computeRelationship(idA, idB, tree));
  }
  return cache.get(key);
}
```

After the first lookup for any pair, subsequent calls are O(1). The cache lives in memory for the session — no backend needed.

---

## Files

### New: `src/utils/relationships.js`
All graph logic:
- `buildGraph(nodes, edges)` → adjacency map
- `getAncestors(nodeId, graph)` → BFS ancestor map with distances
- `findLCA(idA, idB, graph)` → LCA node + distFromA + distFromB
- `describeRelationship(distA, distB)` → human-readable string
- `computeRelationship(idA, idB, tree)` → full result object `{ label, path, lcaId }`

### New: `src/utils/relationshipCache.js`
Cache layer:
- `hashTopology(edges)` → djb2 hash number
- `getRelationship(idA, idB, tree)` → memoized result

### Modify: `src/App.jsx`
When exactly two PersonNodes are selected, pass their IDs to the display component.

### Modify: `src/components/TreeController.jsx`
Show the relationship result in the controller panel when two nodes are selected. Keeps it non-intrusive — result appears where the user is already looking.

---

## UI Behavior

**Auto-display on two-node selection (recommended)**

When exactly two PersonNodes are selected, the controller panel shows:

```
─────────────────────────
  Relationship
  John is Alex's
  Second Cousin Once Removed
─────────────────────────
```

If no common ancestor: `"No known relationship found."`
If only one node selected: section stays hidden.

This requires no extra clicks and fits naturally into the existing edit flow.

---

## Resource Intensity Analysis — Session vs. Persistence

### Actual computation cost for family trees

Each relationship lookup runs two BFS traversals on the graph. For a tree with N nodes and E edges, one pair costs O(N + E). In JavaScript on a modern browser:

| Tree size | Time per pair | All pairs upfront | Lazy (10 pairs/session) |
|---|---|---|---|
| 20 nodes | ~0.01ms | < 1ms | < 0.1ms |
| 100 nodes | ~0.02ms | ~100ms | ~0.2ms |
| 500 nodes | ~0.1ms | ~12 seconds | ~1ms |
| 5,000 nodes (max) | ~1ms | impractical | ~10ms |

The key insight: the plan already uses **lazy memoization** — nothing is computed until a user actually selects a pair. In a typical session, a user checks maybe 5–15 pairs. That's 0.1ms–1ms of total computation for trees up to 500 nodes. Imperceptible.

### Why NOT to persist to the database

Your instinct is right that persisting would take up space, but the deeper problem is correctness:

- Relationships are **fully derivable** from the tree structure, which is already stored in `tree_data` in Postgres
- Storing derived data creates a synchronization problem — if the tree updates and the cache doesn't, results are wrong
- The topology hash in this plan already solves staleness detection in memory
- A DB query itself takes 10–100ms in practice — more expensive than just recomputing the pair

Storing derived, recomputable data in the DB is the wrong move here.

### Why NOT localStorage either

- Same sync problem: `tree_data` lives on the server, cache would live in the browser
- If a tree is edited in another tab or by another user, the localStorage cache is silently stale
- Added complexity for zero practical benefit given the actual computation cost

### The right answer: lazy in-session memoization (current plan)

Recomputing from scratch each session is not a resource problem for this domain. Family trees are small graphs. The computation is cheap, the lazy pattern means you only pay for pairs actually accessed, and the hash-based invalidation handles topology changes correctly.

### If trees ever grow very large (500+ nodes)

At that scale, the lazy approach is still fine per-pair. If you ever needed to precompute all pairs on load (for a search feature, for example), the right move is a **Web Worker** — offload the computation to a background thread so the UI stays responsive. That's a future optimization, not a current need.

---

## Verification

1. Build a tree: grandparent → parent → self, + a cousin branch off grandparent
2. Select self + first cousin → `"First Cousin"`
3. Select self + grandparent → `"Grandparent"`
4. Select self + great-grandparent → `"Great Grandparent"`
5. Select self + first cousin's child → `"First Cousin Once Removed"`
6. Add or remove an edge → cache invalidates, result updates correctly
7. Select two disconnected nodes → `"No known relationship found."`
8. Select same pair twice → second call returns instantly from cache

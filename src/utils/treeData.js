const TREE_FILE_VERSION = 1;
// Each tree gets its own draft slot so opening one tree never overwrites another
// tree's unsaved edits. A pre-existing single-key draft is migrated on first load.
const LEGACY_DRAFT_KEY = 'familytrees.localDraft.v1';
const DRAFT_SLOT_PREFIX = 'familytrees.localDraft.v1.'; // + <treeId> | "new"
const DRAFT_POINTER_KEY = 'familytrees.localDraftPointer.v1'; // most-recently-edited slot
const NEW_TREE_SLOT = 'new';
const MAX_DRAFTS = 25;
const sideHandles = ['left', 'right'];

export const getRelationshipFromHandles = (sourceHandle, targetHandle) => {
  if (sideHandles.includes(sourceHandle) || sideHandles.includes(targetHandle)) {
    return 'sibling';
  }

  if (sourceHandle === 'top' || targetHandle === 'bottom') {
    return 'parent';
  }

  return 'child';
};

export const getEdgeClassName = (relationship) => `relationship-edge ${relationship}-edge`;

export const createRelationshipEdge = ({
  source,
  target,
  sourceHandle,
  targetHandle,
  relationship,
}) => ({
  id: `${source}-${sourceHandle}-${target}-${targetHandle}-${Date.now()}`,
  source,
  sourceHandle,
  target,
  targetHandle,
  type: 'relationship',
  data: { relationship },
  className: getEdgeClassName(relationship),
});

const createDownloadFileName = () => {
  const today = new Date().toISOString().slice(0, 10);
  return `family-tree-${today}.json`;
};

const normalizeNode = (node, index) => ({
  id: node.id || `person-${Date.now()}-${index}`,
  type: 'person',
  position: node.position || { x: index * 40, y: index * 40 },
  data: {
    label: node.data?.label || `Person ${index + 1}`,
    ...(node.data || {}),
  },
});

const normalizeEdge = (edge, index) => {
  const relationship = edge.data?.relationship
    || getRelationshipFromHandles(edge.sourceHandle, edge.targetHandle);
  const color = edge.data?.color;

  return {
    id: edge.id || `${edge.source}-${edge.sourceHandle}-${edge.target}-${edge.targetHandle}-${index}`,
    source: edge.source,
    sourceHandle: edge.sourceHandle,
    target: edge.target,
    targetHandle: edge.targetHandle,
    type: 'relationship',
    data: {
      ...edge.data,
      relationship,
    },
    className: getEdgeClassName(relationship),
    ...(color ? { style: { ...(edge.style || {}), stroke: color } } : {}),
  };
};

export const parseImportedTree = (rawData) => {
  const parsed = JSON.parse(rawData);
  const treeData = parsed?.tree || parsed;

  if (!Array.isArray(treeData?.nodes) || !Array.isArray(treeData?.edges)) {
    throw new Error('Invalid tree file format.');
  }

  return {
    version: parsed?.version || TREE_FILE_VERSION,
    viewport: parsed?.viewport || null,
    tree: {
      nodes: treeData.nodes.map(normalizeNode),
      edges: treeData.edges.map(normalizeEdge),
    },
  };
};

export const exportTreeToFile = (tree, viewport) => {
  const payload = {
    version: TREE_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    tree,
    viewport: viewport || null,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = createDownloadFileName();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const draftSlotKey = (treeId) => `${DRAFT_SLOT_PREFIX}${treeId || NEW_TREE_SLOT}`;

// Move a pre-existing single-key draft into the per-tree scheme (runs once).
const migrateLegacyDraft = () => {
  const legacy = window.localStorage.getItem(LEGACY_DRAFT_KEY);

  if (!legacy) return;

  try {
    const stored = JSON.parse(legacy);
    const treeId = typeof stored?.treeId === 'string' ? stored.treeId : null;
    const slotKey = draftSlotKey(treeId);

    if (!window.localStorage.getItem(slotKey)) {
      window.localStorage.setItem(slotKey, legacy);
      window.localStorage.setItem(DRAFT_POINTER_KEY, slotKey);
    }
  } catch {
    // discard a malformed legacy draft
  }

  window.localStorage.removeItem(LEGACY_DRAFT_KEY);
};

// Keep only the most recent MAX_DRAFTS slots so storage can't grow without bound.
const enforceDraftCap = () => {
  const slots = [];

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);

    if (!key || !key.startsWith(DRAFT_SLOT_PREFIX)) continue;

    let savedAt = '';

    try {
      savedAt = JSON.parse(window.localStorage.getItem(key))?.savedAt || '';
    } catch {
      savedAt = '';
    }

    slots.push({ key, savedAt });
  }

  if (slots.length <= MAX_DRAFTS) return;

  slots.sort((a, b) => a.savedAt.localeCompare(b.savedAt));

  for (let i = 0; i < slots.length - MAX_DRAFTS; i += 1) {
    window.localStorage.removeItem(slots[i].key);
  }
};

export const saveTreeToLocalDraft = (tree, viewport, meta = {}) => {
  if (typeof window === 'undefined') return null;

  // Identity of the backend record this draft belongs to (null for an unsaved
  // new tree). The draft lives in that tree's own slot so it stays isolated from
  // other trees' drafts.
  const treeId = typeof meta.treeId === 'string' ? meta.treeId : null;
  const slotKey = draftSlotKey(treeId);

  const payload = {
    version: TREE_FILE_VERSION,
    savedAt: new Date().toISOString(),
    treeId,
    title: typeof meta.title === 'string' ? meta.title : null,
    tree,
    viewport: viewport || null,
  };

  window.localStorage.setItem(slotKey, JSON.stringify(payload));
  window.localStorage.setItem(DRAFT_POINTER_KEY, slotKey);
  enforceDraftCap();

  return payload;
};

// Load a specific tree's draft, or (with no id) the most recently edited one.
export const loadTreeFromLocalDraft = (treeId) => {
  if (typeof window === 'undefined') return null;

  migrateLegacyDraft();

  const slotKey = treeId
    ? draftSlotKey(treeId)
    : window.localStorage.getItem(DRAFT_POINTER_KEY);

  if (!slotKey) return null;

  const rawDraft = window.localStorage.getItem(slotKey);

  if (!rawDraft) return null;

  try {
    const parsed = parseImportedTree(rawDraft);
    const stored = JSON.parse(rawDraft);

    return {
      ...parsed,
      treeId: typeof stored?.treeId === 'string' ? stored.treeId : null,
      title: typeof stored?.title === 'string' ? stored.title : null,
    };
  } catch {
    window.localStorage.removeItem(slotKey);
    return null;
  }
};

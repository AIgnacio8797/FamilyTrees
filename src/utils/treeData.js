const TREE_FILE_VERSION = 1;
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

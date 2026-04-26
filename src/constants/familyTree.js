export const initialNodes = [
  { id: 'person-1', type: 'person', position: { x: 0, y: 0 }, data: { label: 'Person 1' } },
  { id: 'person-2', type: 'person', position: { x: 0, y: 120 }, data: { label: 'Person 2' } },
  {
    id: 'relationship-person-1-person-2-child',
    type: 'relationship',
    position: { x: 15, y: 60 },
    data: { label: 'child', attachable: false },
    className: 'locked-relationship-node',
  },
];

export const initialEdges = [
  {
    id: 'person-1-relationship-person-1-person-2-child',
    source: 'person-1',
    sourceHandle: 'bottom',
    target: 'relationship-person-1-person-2-child',
    targetHandle: 'top',
    className: 'relationship-connector-edge',
    selectable: false,
  },
  {
    id: 'relationship-person-1-person-2-child-person-2',
    source: 'relationship-person-1-person-2-child',
    sourceHandle: 'bottom',
    target: 'person-2',
    targetHandle: 'top',
    className: 'relationship-connector-edge',
    selectable: false,
  },
];

export const relativePositions = {
  parent: { x: 0, y: -140 },
  child: { x: 0, y: 140 },
  partner: { x: 220, y: 0 },
  sibling: { x: 220, y: 100 },
};

export const relationships = ['parent', 'child', 'partner', 'sibling'];

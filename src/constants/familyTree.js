export const initialNodes = [
  { id: 'person-1', type: 'person', position: { x: 0, y: 0 }, data: { label: 'Person 1' } },
  { id: 'person-2', type: 'person', position: { x: 0, y: 140 }, data: { label: 'Person 2' } },
];

export const initialEdges = [
  {
    id: 'person-1-bottom-person-2-top',
    source: 'person-1',
    sourceHandle: 'bottom',
    target: 'person-2',
    targetHandle: 'top',
    type: 'relationship',
    data: { relationship: 'child' },
    className: 'relationship-edge child-edge',
  },
];

export const relativePositions = {
  parent: { x: 0, y: -140 },
  child: { x: 0, y: 140 },
  partner: { x: 220, y: 0 },
  sibling: { x: 220, y: 100 },
};

export const relationships = ['parent', 'child', 'partner', 'sibling'];

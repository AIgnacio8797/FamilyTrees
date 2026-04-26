import { useState, useCallback } from 'react';
import { ReactFlow, applyNodeChanges, applyEdgeChanges, addEdge, Background, Controls } from '@xyflow/react';
import './index.css';
import '@xyflow/react/dist/style.css';
 
const initialNodes = [
  { id: 'person-1', position: { x: 0, y: 0 }, data: { label: 'Person 1' } },
  { id: 'person-2', position: { x: 0, y: 120 }, data: { label: 'Person 2' } },
];
const initialEdges = [{ id: 'person-1-person-2', source: 'person-1', target: 'person-2' }];

const relativePositions = {
  parent: { x: 0, y: -140 },
  child: { x: 0, y: 140 },
  partner: { x: 220, y: 0 },
  sibling: { x: 220, y: 100 },
};
 
export default function App() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
 
  const onNodesChange = useCallback(
    (changes) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );
  const onConnect = useCallback(
    (params) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [],
  );

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  const addRelative = useCallback((relationship) => {
    if (!selectedNode) return;

    const offset = relativePositions[relationship];
    const newNodeId = `person-${Date.now()}`;
    const newNode = {
      id: newNodeId,
      position: {
        x: selectedNode.position.x + offset.x,
        y: selectedNode.position.y + offset.y,
      },
      data: {
        label: `New ${relationship}`,
      },
    };

    setNodes((nodesSnapshot) => [...nodesSnapshot, newNode]);
    setEdges((edgesSnapshot) => {
      const source = relationship === 'parent' ? newNodeId : selectedNode.id;
      const target = relationship === 'parent' ? selectedNode.id : newNodeId;

      return [
        ...edgesSnapshot,
        {
          id: `${source}-${target}`,
          source,
          target,
          label: relationship,
        },
      ];
    });
    setSelectedNodeId(newNodeId);
  }, [selectedNode]);
 
  return (
    <div className="app-shell">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        fitView
      >
        <Background
          variant="dots"
          gap={12}
          size={1}
        />

        <Controls/>
        
      </ReactFlow>

      {selectedNode && (
        <aside className="relative-panel">
          <div>
            <p className="panel-label">Selected person</p>
            <h2>{selectedNode.data.label}</h2>
          </div>

          <div className="relative-actions">
            <button type="button" onClick={() => addRelative('parent')}>Add Parent</button>
            <button type="button" onClick={() => addRelative('child')}>Add Child</button>
            <button type="button" onClick={() => addRelative('partner')}>Add Partner</button>
            <button type="button" onClick={() => addRelative('sibling')}>Add Sibling</button>
          </div>
        </aside>
      )}
      
    </div>
  );
}

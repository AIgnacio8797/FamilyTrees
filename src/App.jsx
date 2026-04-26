import { useCallback, useState } from 'react';
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Background,
  ConnectionMode,
  Controls,
} from '@xyflow/react';
import { PersonNode } from './components/PersonNode';
import { RelationshipPanel } from './components/RelationshipPanel';
import { initialEdges, initialNodes, relativePositions } from './constants/familyTree';
import './index.css';
import '@xyflow/react/dist/style.css';

const nodeTypes = {
  person: PersonNode,
};
 
export default function App() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
 
  const onNodesChange = useCallback(
    (changes) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );
  const onConnect = useCallback(
    (params) => setEdges((edgesSnapshot) => addEdge({
      ...params,
      id: `${params.source}-${params.sourceHandle}-${params.target}-${params.targetHandle}-${Date.now()}`,
      label: 'relationship',
    }, edgesSnapshot)),
    [],
  );

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);

  const addRelative = useCallback((relationship) => {
    if (!selectedNode) return;

    const offset = relativePositions[relationship];
    const newNodeId = `person-${Date.now()}`;
    const newNode = {
      id: newNodeId,
      type: 'person',
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
      const sourceHandle = 'bottom';
      const targetHandle = 'top';

      return [
        ...edgesSnapshot,
        {
          id: `${source}-${target}`,
          source,
          sourceHandle,
          target,
          targetHandle,
          label: relationship,
        },
      ];
    });
    setSelectedNodeId(newNodeId);
  }, [selectedNode]);

  const startEditingNode = useCallback((nodeId) => {
    setSelectedNodeId(nodeId);
    setEditingNodeId(nodeId);
  }, []);

  const updateNodeLabel = useCallback((nodeId, label) => {
    const nextLabel = label.trim() || 'Unnamed person';

    setNodes((nodesSnapshot) => nodesSnapshot.map((node) => {
      if (node.id !== nodeId) return node;

      return {
        ...node,
        data: {
          ...node.data,
          label: nextLabel,
        },
      };
    }));
    setEditingNodeId(null);
  }, []);

  const cancelEditingNode = useCallback(() => {
    setEditingNodeId(null);
  }, []);

  const updateEdgeRelationship = useCallback((edgeId, relationship) => {
    setEdges((edgesSnapshot) => edgesSnapshot.map((edge) => {
      if (edge.id !== edgeId) return edge;

      return {
        ...edge,
        label: relationship,
      };
    }));
  }, []);

  const flowNodes = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      isEditing: node.id === editingNodeId,
      onStartEditing: startEditingNode,
      onLabelChange: updateNodeLabel,
      onCancelEditing: cancelEditingNode,
    },
  }));
 
  return (
    <div className="app-shell">
      <ReactFlow
        nodes={flowNodes}
        edges={edges.map((edge) => ({
          ...edge,
          className: edge.id === selectedEdgeId ? 'selected-relationship-edge' : edge.className,
        }))}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => {
          setSelectedNodeId(node.id);
          setSelectedEdgeId(null);
        }}
        onEdgeClick={(_, edge) => {
          setSelectedEdgeId(edge.id);
          setSelectedNodeId(null);
        }}
        onPaneClick={() => {
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
        }}
        fitView
      >
        <Background
          variant="dots"
          gap={12}
          size={1}
        />

        <Controls/>
        
      </ReactFlow>

      <RelationshipPanel
        selectedNode={selectedEdge ? null : selectedNode}
        selectedEdge={selectedEdge}
        onAddRelative={addRelative}
        onUpdateEdgeRelationship={updateEdgeRelationship}
      />
      
    </div>
  );
}

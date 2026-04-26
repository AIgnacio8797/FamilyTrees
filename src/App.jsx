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
import { RelationshipNode } from './components/RelationshipNode';
import { RelationshipPanel } from './components/RelationshipPanel';
import { initialEdges, initialNodes, relationships, relativePositions } from './constants/familyTree';
import './index.css';
import '@xyflow/react/dist/style.css';

const nodeTypes = {
  person: PersonNode,
  relationship: RelationshipNode,
};

const getRelationshipNodeId = (firstId, secondId, relationship) => (
  `relationship-${[firstId, secondId].sort().join('-')}-${relationship}`
);
 
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
      label: params.source?.startsWith('relationship-') || params.target?.startsWith('relationship-')
        ? 'child'
        : 'relationship',
    }, edgesSnapshot)),
    [],
  );

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);
  const selectedEdgeUsesRelationshipNode = selectedEdge
    ? selectedEdge.source.startsWith('relationship-') || selectedEdge.target.startsWith('relationship-')
    : false;

  const addRelative = useCallback((relationship) => {
    if (!selectedNode) return;

    const offset = relativePositions[relationship];
    const partnerRelationshipNode = relationship === 'child'
      ? nodes.find((node) => (
        node.type === 'relationship'
        && node.data.label === 'partner'
        && edges.some((edge) => (
          (edge.source === selectedNode.id && edge.target === node.id)
          || (edge.source === node.id && edge.target === selectedNode.id)
        ))
      ))
      : null;
    const newNodeId = `person-${Date.now()}`;
    const newNode = {
      id: newNodeId,
      type: 'person',
      position: {
        x: partnerRelationshipNode ? partnerRelationshipNode.position.x : selectedNode.position.x + offset.x,
        y: partnerRelationshipNode ? partnerRelationshipNode.position.y + 160 : selectedNode.position.y + offset.y,
      },
      data: {
        label: `New ${relationship}`,
      },
    };
    const source = relationship === 'parent' ? newNode : selectedNode;
    const target = relationship === 'parent' ? selectedNode : newNode;
    const relationshipNodeId = partnerRelationshipNode
      ? getRelationshipNodeId(partnerRelationshipNode.id, newNodeId, 'child')
      : getRelationshipNodeId(source.id, target.id, relationship);
    const relationshipNode = {
      id: relationshipNodeId,
      type: 'relationship',
      position: partnerRelationshipNode
        ? {
          x: (partnerRelationshipNode.position.x + newNode.position.x) / 2,
          y: (partnerRelationshipNode.position.y + newNode.position.y) / 2,
        }
        : {
          x: (source.position.x + target.position.x) / 2,
          y: (source.position.y + target.position.y) / 2,
        },
      data: {
        label: relationship,
        attachable: relationship === 'partner',
      },
      className: relationship === 'partner' ? 'attachable-relationship-node' : 'locked-relationship-node',
    };

    setNodes((nodesSnapshot) => {
      const nextNodes = [...nodesSnapshot, newNode];
      const hasRelationshipNode = nodesSnapshot.some((node) => node.id === relationshipNodeId);

      return hasRelationshipNode ? nextNodes : [...nextNodes, relationshipNode];
    });
    setEdges((edgesSnapshot) => {
      const firstSource = partnerRelationshipNode ? partnerRelationshipNode.id : source.id;
      const finalTarget = target.id;
      const connectorEdges = [
        {
          id: `${firstSource}-${relationshipNodeId}`,
          source: firstSource,
          sourceHandle: 'bottom',
          target: relationshipNodeId,
          targetHandle: 'top',
          className: 'relationship-connector-edge',
          selectable: false,
        },
        {
          id: `${relationshipNodeId}-${finalTarget}`,
          source: relationshipNodeId,
          sourceHandle: 'bottom',
          target: finalTarget,
          targetHandle: 'top',
          className: 'relationship-connector-edge',
          selectable: false,
        },
      ];

      return [
        ...edgesSnapshot,
        ...connectorEdges.filter((edge) => !edgesSnapshot.some((existingEdge) => existingEdge.id === edge.id)),
      ];
    });
    setSelectedNodeId(newNodeId);
  }, [edges, nodes, selectedNode]);

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
      if ((edge.source.startsWith('relationship-') || edge.target.startsWith('relationship-')) && relationship !== 'child') {
        return edge;
      }

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
          if (node.type === 'relationship') {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            return;
          }

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
        relationshipOptions={selectedEdgeUsesRelationshipNode ? ['child'] : relationships}
        onAddRelative={addRelative}
        onUpdateEdgeRelationship={updateEdgeRelationship}
      />
      
    </div>
  );
}

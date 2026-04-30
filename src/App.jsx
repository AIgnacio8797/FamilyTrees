import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Background,
  ConnectionMode,
  Controls,
} from '@xyflow/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faPenToSquare, faUpload } from '@fortawesome/free-solid-svg-icons';
import { PersonNode } from './components/PersonNode';
import { initialEdges, initialNodes, relativePositions } from './constants/familyTree';
import './index.css';
import '@xyflow/react/dist/style.css';

const nodeTypes = {
  person: PersonNode,
};

const sideHandles = ['left', 'right'];

const getRelationshipFromHandles = (sourceHandle, targetHandle) => {
  if (sideHandles.includes(sourceHandle) || sideHandles.includes(targetHandle)) {
    return 'partner';
  }

  if (sourceHandle === 'top' || targetHandle === 'bottom') {
    return 'parent';
  }

  return 'child';
};

const getEdgeClassName = (relationship) => `relationship-edge ${relationship}-edge`;

const createRelationshipEdge = ({
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
  type: relationship === 'partner' ? 'straight' : 'smoothstep',
  data: { relationship },
  className: getEdgeClassName(relationship),
});

export default function App() {
  const [tree, setTree] = useState({ nodes: initialNodes, edges: initialEdges });
  const [history, setHistory] = useState({ past: [], future: [] });
  const [controllerMode, setControllerMode] = useState('edit');
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const isDraggingNodeRef = useRef(false);
  const treeRef = useRef(tree);
  const { nodes, edges } = tree;

  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  const rememberTree = useCallback((snapshot) => {
    setHistory((historySnapshot) => ({
      past: [...historySnapshot.past, snapshot].slice(-80),
      future: [],
    }));
  }, []);

  const updateTree = useCallback((updater, { record = true } = {}) => {
    setTree((treeSnapshot) => {
      const nextTree = updater(treeSnapshot);

      if (record) {
        rememberTree(treeSnapshot);
      }

      treeRef.current = nextTree;
      return nextTree;
    });
  }, [rememberTree]);

  const undo = useCallback(() => {
    setHistory((historySnapshot) => {
      if (historySnapshot.past.length === 0) return historySnapshot;

      const previousTree = historySnapshot.past.at(-1);
      const currentTree = treeRef.current;

      setTree(() => {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setEditingNodeId(null);
        setIsNodeEditorOpen(false);
        treeRef.current = previousTree;

        return previousTree;
      });

      return {
        past: historySnapshot.past.slice(0, -1),
        future: [currentTree, ...historySnapshot.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((historySnapshot) => {
      if (historySnapshot.future.length === 0) return historySnapshot;

      const nextTree = historySnapshot.future[0];
      const currentTree = treeRef.current;

      setTree(() => {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setEditingNodeId(null);
        setIsNodeEditorOpen(false);
        treeRef.current = nextTree;

        return nextTree;
      });

      return {
        past: [...historySnapshot.past, currentTree],
        future: historySnapshot.future.slice(1),
      };
    });
  }, []);
 
  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const isTyping = ['INPUT', 'TEXTAREA'].includes(target?.tagName) || target?.isContentEditable;

      if (isTyping || !event.ctrlKey) return;

      const key = event.key.toLowerCase();

      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  const onNodesChange = useCallback((changes) => {
    if (changes.every((change) => change.type === 'select')) return;

    const hasPositionChange = changes.some((change) => change.type === 'position');
    const isDragging = changes.some((change) => change.type === 'position' && change.dragging);
    const shouldRecordDragStart = isDragging && !isDraggingNodeRef.current;
    const shouldRecordNonDragChange = changes.some((change) => (
      change.type !== 'select'
      && change.type !== 'dimensions'
      && change.type !== 'position'
    ));

    if (isDragging) {
      isDraggingNodeRef.current = true;
    } else if (hasPositionChange) {
      isDraggingNodeRef.current = false;
    }

    updateTree((treeSnapshot) => ({
      ...treeSnapshot,
      nodes: applyNodeChanges(changes, treeSnapshot.nodes),
    }), { record: shouldRecordDragStart || shouldRecordNonDragChange });
  }, [updateTree]);

  const onEdgesChange = useCallback((changes) => {
    if (changes.every((change) => change.type === 'select')) return;

    const shouldRecord = changes.some((change) => change.type !== 'select');

    updateTree((treeSnapshot) => ({
      ...treeSnapshot,
      edges: applyEdgeChanges(changes, treeSnapshot.edges),
    }), { record: shouldRecord });
  }, [updateTree]);

  const onConnect = useCallback(
    (params) => {
      const relationship = getRelationshipFromHandles(params.sourceHandle, params.targetHandle);

      updateTree((treeSnapshot) => ({
        ...treeSnapshot,
        edges: addEdge({
          ...params,
          id: `${params.source}-${params.sourceHandle}-${params.target}-${params.targetHandle}-${Date.now()}`,
          type: relationship === 'partner' ? 'straight' : 'smoothstep',
          data: { relationship },
          className: getEdgeClassName(relationship),
        }, treeSnapshot.edges),
      }));
    },
    [updateTree],
  );

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

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

    const edgeByRelationship = {
      parent: createRelationshipEdge({
        source: newNode.id,
        sourceHandle: 'bottom',
        target: selectedNode.id,
        targetHandle: 'top',
        relationship: 'parent',
      }),
      child: createRelationshipEdge({
        source: selectedNode.id,
        sourceHandle: 'bottom',
        target: newNode.id,
        targetHandle: 'top',
        relationship: 'child',
      }),
      sibling: createRelationshipEdge({
        source: selectedNode.id,
        sourceHandle: 'right',
        target: newNode.id,
        targetHandle: 'left',
        relationship: 'sibling',
      }),
    };

    updateTree((treeSnapshot) => ({
      nodes: [...treeSnapshot.nodes, newNode],
      edges: [...treeSnapshot.edges, edgeByRelationship[relationship]],
    }));
    setSelectedNodeId(newNodeId);
    setSelectedEdgeId(null);
  }, [selectedNode, updateTree]);

  const addNode = useCallback(() => {
    const newNodeId = `person-${Date.now()}`;
    const centerPosition = reactFlowInstance
      ? reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
      : { x: 120, y: 120 };
    const newNode = {
      id: newNodeId,
      type: 'person',
      position: {
        x: centerPosition.x - 60,
        y: centerPosition.y - 24,
      },
      data: {
        label: `Person ${nodes.length}`,
      },
    };

    updateTree((treeSnapshot) => ({
      ...treeSnapshot,
      nodes: [...treeSnapshot.nodes, newNode],
    }));
    setSelectedNodeId(newNodeId);
    setSelectedEdgeId(null);
  }, [nodes.length, reactFlowInstance, updateTree]);

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return;

    updateTree((treeSnapshot) => ({
      nodes: treeSnapshot.nodes.filter((node) => node.id !== selectedNodeId),
      edges: treeSnapshot.edges.filter((edge) => (
        edge.source !== selectedNodeId && edge.target !== selectedNodeId
      )),
    }));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setEditingNodeId(null);
    setIsNodeEditorOpen(false);
  }, [selectedNodeId, updateTree]);

  const updateSelectedNodeColor = useCallback((color) => {
    if (!selectedNodeId) return;

    updateTree((treeSnapshot) => ({
      ...treeSnapshot,
      nodes: treeSnapshot.nodes.map((node) => {
        if (node.id !== selectedNodeId) return node;

        return {
          ...node,
          data: {
            ...node.data,
            color,
          },
        };
      }),
    }));
  }, [selectedNodeId, updateTree]);

  const startEditingNode = useCallback((nodeId) => {
    setSelectedNodeId(nodeId);
    setEditingNodeId(nodeId);
  }, []);

  const updateNodeLabel = useCallback((nodeId, label) => {
    const nextLabel = label.trim() || 'Unnamed person';

    updateTree((treeSnapshot) => ({
      ...treeSnapshot,
      nodes: treeSnapshot.nodes.map((node) => {
        if (node.id !== nodeId) return node;

        return {
          ...node,
          data: {
            ...node.data,
            label: nextLabel,
          },
        };
      }),
    }));
    setEditingNodeId(null);
  }, [updateTree]);

  const cancelEditingNode = useCallback(() => {
    setEditingNodeId(null);
  }, []);

  const flowNodes = nodes.map((node) => ({
    ...node,
    selected: node.id === selectedNodeId,
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
          selected: edge.id === selectedEdgeId,
          className: edge.id === selectedEdgeId
            ? `${edge.className || 'relationship-edge'} selected-relationship-edge`
            : edge.className,
        }))}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onNodeClick={(_, node) => {
          setSelectedNodeId(node.id);
          setSelectedEdgeId(null);
        }}
        onEdgeClick={(_, edge) => {
          setSelectedEdgeId(edge.id);
          setSelectedNodeId(null);
          setIsNodeEditorOpen(false);
        }}
        onPaneClick={() => {
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setIsNodeEditorOpen(false);
        }}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <Background
          variant="dots"
          gap={12}
          size={1}
        />

        <Controls/>
        
      </ReactFlow>

      <aside className={`tree-controller ${isNodeEditorOpen ? 'expanded-node-editor' : ''}`} aria-label="Tree controller">
        <div className="controller-tabs">
          <button
            type="button"
            className={controllerMode === 'edit' ? 'active-controller-tab' : 'muted-controller-tab'}
            aria-label="Edit"
            onClick={() => setControllerMode('edit')}
          >
            <FontAwesomeIcon icon={faPenToSquare} />
          </button>
          <button
            type="button"
            className={controllerMode === 'view' ? 'active-controller-tab' : 'muted-controller-tab'}
            aria-label="View"
            onClick={() => {
              setControllerMode('view');
              setIsNodeEditorOpen(false);
            }}
          >
            <FontAwesomeIcon icon={faEye} />
          </button>
          <button
            type="button"
            className={controllerMode === 'import-export' ? 'active-controller-tab' : 'muted-controller-tab'}
            aria-label="Import or export"
            onClick={() => {
              setControllerMode('import-export');
              setIsNodeEditorOpen(false);
            }}
          >
            <FontAwesomeIcon icon={faUpload} />
          </button>
        </div>

        {controllerMode === 'edit' && (
          <div className="controller-panel">
            {!isNodeEditorOpen && (
              <>
                <button type="button" className="controller-action" onClick={addNode}>
                  Add node
                </button>
                <button
                  type="button"
                  className="controller-action"
                  onClick={() => setIsNodeEditorOpen(true)}
                  disabled={!selectedNode}
                >
                  Edit node
                </button>
                <button
                  type="button"
                  className="controller-action"
                  onClick={deleteSelectedNode}
                  disabled={!selectedNode}
                >
                  Delete node
                </button>
              </>
            )}

            {isNodeEditorOpen && selectedNode && (
              <div className="node-editor-panel">
                <label className="controller-action color-picker-action">
                  Add color
                  <input
                    type="color"
                    value={selectedNode.data.color || '#ffffff'}
                    onChange={(event) => updateSelectedNodeColor(event.target.value)}
                  />
                </label>
                <button type="button" className="controller-action" onClick={() => addRelative('parent')}>
                  Add parent
                </button>
                <button type="button" className="controller-action" onClick={() => addRelative('child')}>
                  Add child
                </button>
                <button type="button" className="controller-action" onClick={() => addRelative('sibling')}>
                  Add sibling
                </button>
              </div>
            )}

            <div className="controller-history-actions">
              <button type="button" onClick={undo} disabled={history.past.length === 0}>
                Undo
              </button>
              <button type="button" onClick={redo} disabled={history.future.length === 0}>
                Redo
              </button>
            </div>
          </div>
        )}
      
        {controllerMode !== 'edit' && (
          <div className="controller-panel muted-controller-panel">
            Coming soon
          </div>
        )}
      </aside>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Background,
  ConnectionMode,
  Controls,
  SelectionMode,
} from '@xyflow/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faPenToSquare, faUpload, faUser } from '@fortawesome/free-solid-svg-icons';
import { PersonNode } from './components/PersonNode';
import { RelationshipEdge } from './components/RelationshipEdge';
import { initialEdges, initialNodes, relativePositions } from './constants/familyTree';
import { getLineDasharray } from './constants/lineStyles';
import './index.css';
import '@xyflow/react/dist/style.css';

const nodeTypes = {
  person: PersonNode,
};

const edgeTypes = {
  relationship: RelationshipEdge,
};

const sideHandles = ['left', 'right'];

const getRelationshipFromHandles = (sourceHandle, targetHandle) => {
  if (sideHandles.includes(sourceHandle) || sideHandles.includes(targetHandle)) {
    return 'sibling';
  }

  if (sourceHandle === 'top' || targetHandle === 'bottom') {
    return 'parent';
  }

  return 'child';
};

const getEdgeClassName = (relationship) => `relationship-edge ${relationship}-edge`;

const lineStyleOptions = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'semi-dashed', label: 'Semi dashed' },
  { id: 'dotted', label: 'Dotted' },
];

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
  type: 'relationship',
  data: { relationship },
  className: getEdgeClassName(relationship),
});

export default function App() {
  const [tree, setTree] = useState({ nodes: initialNodes, edges: initialEdges });
  const [history, setHistory] = useState({ past: [], future: [] });
  const [controllerMode, setControllerMode] = useState('edit');
  const [editTarget, setEditTarget] = useState('people');
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [isLassoMode, setIsLassoMode] = useState(false);
  const [isLineStyleMenuOpen, setIsLineStyleMenuOpen] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const isDraggingNodeRef = useRef(false);
  const treeRef = useRef(tree);
  const historyRef = useRef(history);
  const controllerRef = useRef(null);
  const { nodes, edges } = tree;

  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const clearInteractionState = useCallback(() => {
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setSelectedEdgeId(null);
    setEditingNodeId(null);
    setIsNodeEditorOpen(false);
    setIsLineStyleMenuOpen(false);
  }, []);

  const commitTree = useCallback((nextTree, { record = true } = {}) => {
    const currentTree = treeRef.current;

    if (record) {
      const nextHistory = {
        past: [...historyRef.current.past, currentTree].slice(-80),
        future: [],
      };

      historyRef.current = nextHistory;
      setHistory(nextHistory);
    }

    treeRef.current = nextTree;
    setTree(nextTree);
  }, []);

  const updateTree = useCallback((updater, { record = true } = {}) => {
    const nextTree = updater(treeRef.current);

    commitTree(nextTree, { record });
  }, [commitTree]);

  const undo = useCallback(() => {
    const historySnapshot = historyRef.current;

    if (historySnapshot.past.length === 0) return;

    const previousTree = historySnapshot.past.at(-1);
    const nextHistory = {
      past: historySnapshot.past.slice(0, -1),
      future: [treeRef.current, ...historySnapshot.future],
    };

    historyRef.current = nextHistory;
    treeRef.current = previousTree;
    setHistory(nextHistory);
    setTree(previousTree);
    clearInteractionState();
  }, [clearInteractionState]);

  const redo = useCallback(() => {
    const historySnapshot = historyRef.current;

    if (historySnapshot.future.length === 0) return;

    const nextTree = historySnapshot.future[0];
    const nextHistory = {
      past: [...historySnapshot.past, treeRef.current].slice(-80),
      future: historySnapshot.future.slice(1),
    };

    historyRef.current = nextHistory;
    treeRef.current = nextTree;
    setHistory(nextHistory);
    setTree(nextTree);
    clearInteractionState();
  }, [clearInteractionState]);
 
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

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!isLineStyleMenuOpen) return;
      if (controllerRef.current?.contains(event.target)) return;

      setIsLineStyleMenuOpen(false);
    };

    window.addEventListener('pointerdown', onPointerDown);

    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [isLineStyleMenuOpen]);

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
          type: 'relationship',
          data: { relationship },
          className: getEdgeClassName(relationship),
        }, treeSnapshot.edges),
      }));
    },
    [updateTree],
  );

  const toggleLassoMode = useCallback(() => {
    setIsLassoMode((isActive) => !isActive);
    setSelectedEdgeIds([]);
    setSelectedEdgeId(null);
    setIsNodeEditorOpen(false);
    setIsLineStyleMenuOpen(false);
  }, []);

  const selectedNodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
  const selectedNode = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) : null;
  const selectedEdge = selectedEdgeId ? edges.find((edge) => edge.id === selectedEdgeId) : null;
  const hasSelectedNodes = selectedNodeIds.length > 0;
  const hasSelectedEdges = selectedEdgeIds.length > 0;

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
    setSelectedNodeIds([newNodeId]);
    setSelectedEdgeIds([]);
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
    setSelectedNodeIds([newNodeId]);
    setSelectedEdgeIds([]);
    setSelectedEdgeId(null);
  }, [nodes.length, reactFlowInstance, updateTree]);

  const deleteSelectedNode = useCallback(() => {
    if (!hasSelectedNodes) return;

    updateTree((treeSnapshot) => ({
      nodes: treeSnapshot.nodes.filter((node) => !selectedNodeIds.includes(node.id)),
      edges: treeSnapshot.edges.filter((edge) => (
        !selectedNodeIds.includes(edge.source) && !selectedNodeIds.includes(edge.target)
      )),
    }));
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setSelectedEdgeId(null);
    setEditingNodeId(null);
    setIsNodeEditorOpen(false);
  }, [hasSelectedNodes, selectedNodeIds, updateTree]);

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

  const updateSelectedEdgeColor = useCallback((color) => {
    if (!selectedEdgeId) return;

    updateTree((treeSnapshot) => ({
      ...treeSnapshot,
      edges: treeSnapshot.edges.map((edge) => {
        if (edge.id !== selectedEdgeId) return edge;

        return {
          ...edge,
          data: {
            ...edge.data,
            color,
          },
          style: {
            ...edge.style,
            stroke: color,
          },
        };
      }),
    }));
  }, [selectedEdgeId, updateTree]);

  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId && !hasSelectedEdges) return;

    updateTree((treeSnapshot) => ({
      ...treeSnapshot,
      edges: treeSnapshot.edges.filter((edge) => (
        selectedEdgeId ? edge.id !== selectedEdgeId : !selectedEdgeIds.includes(edge.id)
      )),
    }));
    setSelectedEdgeIds([]);
    setSelectedEdgeId(null);
    setIsLineStyleMenuOpen(false);
  }, [hasSelectedEdges, selectedEdgeId, selectedEdgeIds, updateTree]);

  const updateSelectedEdgeLineStyle = useCallback((lineStyle) => {
    if (!selectedEdgeId) return;

    updateTree((treeSnapshot) => ({
      ...treeSnapshot,
      edges: treeSnapshot.edges.map((edge) => {
        if (edge.id !== selectedEdgeId) return edge;

        return {
          ...edge,
          data: {
            ...edge.data,
            lineStyle,
          },
        };
      }),
    }));
  }, [selectedEdgeId, updateTree]);

  const showPeopleTools = controllerMode === 'edit' && editTarget === 'people';
  const showLineTools = controllerMode === 'edit' && editTarget === 'line';

  const startEditingNode = useCallback((nodeId) => {
    setSelectedNodeIds([nodeId]);
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
    selected: selectedNodeIds.includes(node.id),
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
          type: 'relationship',
          selected: edge.id === selectedEdgeId || selectedEdgeIds.includes(edge.id),
          style: {
            ...edge.style,
            stroke: edge.data?.color || edge.style?.stroke,
            strokeDasharray: getLineDasharray(edge.data?.lineStyle)
              || edge.style?.strokeDasharray,
          },
          className: edge.id === selectedEdgeId
            ? `${edge.className || 'relationship-edge'} selected-relationship-edge`
            : edge.className,
        }))}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onSelectionChange={({ nodes: selectedNodes }) => {
          if (!isLassoMode) return;

          const nextSelectedNodeIds = selectedNodes.map((node) => node.id);
          const nextSelectedEdgeIds = edges
            .filter((edge) => (
              nextSelectedNodeIds.includes(edge.source) && nextSelectedNodeIds.includes(edge.target)
            ))
            .map((edge) => edge.id);

          setSelectedNodeIds(nextSelectedNodeIds);
          setSelectedEdgeIds(nextSelectedEdgeIds);
          setSelectedEdgeId(null);
          setIsNodeEditorOpen(false);
        }}
        onNodeClick={(event, node) => {
          setIsLassoMode(false);
          if (event.shiftKey) {
            setSelectedNodeIds((currentIds) => (
              currentIds.includes(node.id)
                ? currentIds.filter((nodeId) => nodeId !== node.id)
                : [...currentIds, node.id]
            ));
            setIsNodeEditorOpen(false);
          } else {
            setSelectedNodeIds([node.id]);
          }

          setSelectedEdgeIds([]);
          setSelectedEdgeId(null);
          setEditTarget('people');
          setIsLineStyleMenuOpen(false);
        }}
        onEdgeClick={(_, edge) => {
          setIsLassoMode(false);
          setSelectedEdgeIds([]);
          setSelectedEdgeId(edge.id);
          setSelectedNodeIds([]);
          setIsNodeEditorOpen(false);
          setIsLineStyleMenuOpen(false);
          setControllerMode('edit');
          setEditTarget('line');
        }}
        onPaneClick={() => {
          setSelectedNodeIds([]);
          setSelectedEdgeIds([]);
          setSelectedEdgeId(null);
          setIsNodeEditorOpen(false);
          setIsLineStyleMenuOpen(false);
        }}
        selectionMode={SelectionMode.Partial}
        selectionOnDrag={isLassoMode}
        panOnDrag={!isLassoMode}
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

      <aside
        ref={controllerRef}
        className={`tree-controller ${isNodeEditorOpen ? 'expanded-node-editor' : ''}`}
        aria-label="Tree controller"
      >
        <div className="controller-tabs">
          <button
            type="button"
            className={controllerMode === 'edit' ? 'active-controller-tab' : 'muted-controller-tab'}
            aria-label="Edit"
            onClick={() => {
              setControllerMode('edit');
            }}
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
              setIsLineStyleMenuOpen(false);
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
              setIsLineStyleMenuOpen(false);
            }}
          >
            <FontAwesomeIcon icon={faUpload} />
          </button>
        </div>

        {controllerMode === 'edit' && (
          <>
            <div className="edit-target-tabs" aria-label="Edit target">
              <button
                type="button"
                className={editTarget === 'people' ? 'active-edit-target' : ''}
                aria-label="People"
                onClick={() => {
                  setEditTarget('people');
                  setIsLineStyleMenuOpen(false);
                }}
              >
                <FontAwesomeIcon icon={faUser} />
              </button>
              <button
                type="button"
                className={editTarget === 'line' ? 'active-edit-target' : ''}
                aria-label="Line"
                onClick={() => {
                  setEditTarget('line');
                  setIsNodeEditorOpen(false);
                }}
              >
                <span className="horizontal-line-icon" aria-hidden="true" />
              </button>
            </div>

            <div className="controller-panel">
            {showLineTools && (
                <div className="controller-tool-stack relationship-editor-panel">
                  <label className={`controller-action color-picker-action ${!selectedEdge ? 'disabled-controller-action' : ''}`}>
                  Edit line color
                  <input
                    type="color"
                    value={selectedEdge?.data?.color || '#9da19a'}
                    disabled={!selectedEdge}
                    onChange={(event) => updateSelectedEdgeColor(event.target.value)}
                  />
                </label>
                <div className="line-style-picker">
                  <button
                    type="button"
                    className="controller-action"
                    disabled={!selectedEdge}
                    onClick={() => setIsLineStyleMenuOpen((isOpen) => !isOpen)}
                  >
                    Line style
                  </button>
                </div>
                <button
                  type="button"
                  className="controller-action"
                  onClick={deleteSelectedEdge}
                  disabled={!selectedEdge && !hasSelectedEdges}
                >
                  Delete line
                </button>
                <button
                  type="button"
                  className={`controller-action controller-toggle-action ${isLassoMode ? 'active-toggle-action' : ''}`}
                  onClick={toggleLassoMode}
                >
                  Lasso
                </button>
              </div>
            )}

            {showPeopleTools && !isNodeEditorOpen && (
              <div className="controller-tool-stack people-editor-panel">
                <button type="button" className="controller-action" onClick={addNode}>
                  Add person
                </button>
                <button
                  type="button"
                  className="controller-action"
                  onClick={() => setIsNodeEditorOpen(true)}
                  disabled={!selectedNode}
                >
                  Edit person
                </button>
                <button
                  type="button"
                  className="controller-action"
                  onClick={deleteSelectedNode}
                  disabled={!hasSelectedNodes}
                >
                  Delete person
                </button>
                <button
                  type="button"
                  className={`controller-action controller-toggle-action ${isLassoMode ? 'active-toggle-action' : ''}`}
                  onClick={toggleLassoMode}
                >
                  Lasso
                </button>
              </div>
            )}

            {showPeopleTools && isNodeEditorOpen && selectedNode && (
              <div className="controller-tool-stack node-editor-panel">
                <label className="controller-action color-picker-action">
                  Edit color
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
          </>
        )}

        {showLineTools && selectedEdge && isLineStyleMenuOpen && (
          <div className="line-style-menu" aria-label="Line style options">
            {lineStyleOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={(selectedEdge.data?.lineStyle || 'solid') === option.id ? 'active-line-style' : ''}
                aria-label={option.label}
                title={option.label}
                onClick={() => updateSelectedEdgeLineStyle(option.id)}
              >
                <svg
                  className="line-style-preview"
                  viewBox="0 0 120 12"
                  aria-hidden="true"
                >
                  <line
                    x1="4"
                    y1="6"
                    x2="116"
                    y2="6"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={getLineDasharray(option.id)}
                  />
                </svg>
              </button>
            ))}
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

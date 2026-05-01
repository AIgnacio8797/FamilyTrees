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
import { PersonNode } from './components/PersonNode';
import { RelationshipEdge } from './components/RelationshipEdge';
import { TreeController } from './components/TreeController';
import { initialEdges, initialNodes, relativePositions } from './constants/familyTree';
import { getLineDasharray } from './constants/lineStyles';
import {
  createRelationshipEdge,
  exportTreeToFile,
  getEdgeClassName,
  getRelationshipFromHandles,
  loadTreeFromLocalDraft,
  parseImportedTree,
  saveTreeToLocalDraft,
} from './utils/treeData';
import './index.css';
import '@xyflow/react/dist/style.css';

const nodeTypes = {
  person: PersonNode,
};

const edgeTypes = {
  relationship: RelationshipEdge,
};

export default function App() {
  const [initialLocalDraft] = useState(() => loadTreeFromLocalDraft());
  const [tree, setTree] = useState(() => (
    initialLocalDraft?.tree || { nodes: initialNodes, edges: initialEdges }
  ));
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
  const fileInputRef = useRef(null);
  const treeRef = useRef(tree);
  const historyRef = useRef(history);
  const controllerRef = useRef(null);
  const autosaveTimeoutRef = useRef(null);
  const viewportRef = useRef(initialLocalDraft?.viewport || null);
  const hasAppliedInitialViewportRef = useRef(false);
  const { nodes, edges } = tree;

  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const flushAutosave = useCallback(() => {
    const viewport = reactFlowInstance?.getViewport() || viewportRef.current || null;
    const savedDraft = saveTreeToLocalDraft(treeRef.current, viewport);

    if (savedDraft?.viewport) {
      viewportRef.current = savedDraft.viewport;
    }
  }, [reactFlowInstance]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimeoutRef.current) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      flushAutosave();
      autosaveTimeoutRef.current = null;
    }, 450);
  }, [flushAutosave]);

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

  const exportTree = useCallback(() => {
    exportTreeToFile(treeRef.current, reactFlowInstance?.getViewport() || null);
  }, [reactFlowInstance]);

  const loadTreeFromFile = useCallback((event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const imported = parseImportedTree(String(reader.result || ''));

        commitTree(imported.tree);
        clearInteractionState();
        setControllerMode('import-export');
        setEditTarget('people');
        setIsLassoMode(false);

        requestAnimationFrame(() => {
          if (imported.viewport && reactFlowInstance) {
            reactFlowInstance.setViewport(imported.viewport, { duration: 0 });
          } else if (reactFlowInstance) {
            reactFlowInstance.fitView({ duration: 250, padding: 0.18 });
          }
        });
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Unable to load this tree file.');
      } finally {
        event.target.value = '';
      }
    };

    reader.onerror = () => {
      window.alert('Unable to read the selected file.');
      event.target.value = '';
    };

    reader.readAsText(file);
  }, [clearInteractionState, commitTree, reactFlowInstance]);

  const openImportPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  useEffect(() => {
    scheduleAutosave();
  }, [scheduleAutosave, tree]);

  useEffect(() => () => {
    if (autosaveTimeoutRef.current) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (autosaveTimeoutRef.current) {
        window.clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }

      flushAutosave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushAutosave]);

  useEffect(() => {
    if (!reactFlowInstance || hasAppliedInitialViewportRef.current) return;

    const initialViewport = initialLocalDraft?.viewport;

    if (initialViewport) {
      requestAnimationFrame(() => {
        reactFlowInstance.setViewport(initialViewport, { duration: 0 });
      });
    }

    hasAppliedInitialViewportRef.current = true;
  }, [initialLocalDraft, reactFlowInstance]);
 
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
  const activeEdgeIds = selectedEdgeIds.length > 0
    ? selectedEdgeIds
    : (selectedEdgeId ? [selectedEdgeId] : []);
  const activeLineStyle = activeEdgeIds.length > 0
    ? edges.find((edge) => edge.id === activeEdgeIds[0])?.data?.lineStyle || 'solid'
    : 'solid';

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
    const targetEdgeIds = selectedEdgeIds.length > 0
      ? selectedEdgeIds
      : (selectedEdgeId ? [selectedEdgeId] : []);

    if (targetEdgeIds.length === 0) return;

    updateTree((treeSnapshot) => ({
      ...treeSnapshot,
      edges: treeSnapshot.edges.map((edge) => {
        if (!targetEdgeIds.includes(edge.id)) return edge;

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
  }, [selectedEdgeId, selectedEdgeIds, updateTree]);

  const deleteSelectedEdge = useCallback(() => {
    const targetEdgeIds = selectedEdgeIds.length > 0
      ? selectedEdgeIds
      : (selectedEdgeId ? [selectedEdgeId] : []);

    if (targetEdgeIds.length === 0) return;

    updateTree((treeSnapshot) => ({
      ...treeSnapshot,
      edges: treeSnapshot.edges.filter((edge) => !targetEdgeIds.includes(edge.id)),
    }));
    setSelectedEdgeIds([]);
    setSelectedEdgeId(null);
    setIsLineStyleMenuOpen(false);
  }, [selectedEdgeId, selectedEdgeIds, updateTree]);

  const updateSelectedEdgeLineStyle = useCallback((lineStyle) => {
    const targetEdgeIds = selectedEdgeIds.length > 0
      ? selectedEdgeIds
      : (selectedEdgeId ? [selectedEdgeId] : []);

    if (targetEdgeIds.length === 0) return;

    updateTree((treeSnapshot) => ({
      ...treeSnapshot,
      edges: treeSnapshot.edges.map((edge) => {
        if (!targetEdgeIds.includes(edge.id)) return edge;

        return {
          ...edge,
          data: {
            ...edge.data,
            lineStyle,
          },
        };
      }),
    }));
  }, [selectedEdgeId, selectedEdgeIds, updateTree]);

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
        onMoveEnd={(event, viewport) => {
          viewportRef.current = viewport;
          scheduleAutosave();
        }}
        onSelectionChange={({ nodes: selectedNodes, edges: selectedEdgesFromLasso = [] }) => {
          if (!isLassoMode) return;

          const nextSelectedNodeIds = selectedNodes.map((node) => node.id);
          const connectedEdgeIds = edges
            .filter((edge) => (
              nextSelectedNodeIds.includes(edge.source) && nextSelectedNodeIds.includes(edge.target)
            ))
            .map((edge) => edge.id);
          const nextSelectedEdgeIds = [...new Set([
            ...connectedEdgeIds,
            ...selectedEdgesFromLasso.map((edge) => edge.id),
          ])];

          setSelectedNodeIds(nextSelectedNodeIds);
          setSelectedEdgeIds(nextSelectedEdgeIds);
          setSelectedEdgeId(nextSelectedEdgeIds[0] || null);
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
        onEdgeClick={(event, edge) => {
          setIsLassoMode(false);
          setSelectedNodeIds([]);
          if (event.shiftKey) {
            setSelectedEdgeIds((currentIds) => {
              const nextIds = currentIds.includes(edge.id)
                ? currentIds.filter((edgeId) => edgeId !== edge.id)
                : [...currentIds, edge.id];

              setSelectedEdgeId(nextIds[0] || null);
              return nextIds;
            });
          } else {
            setSelectedEdgeIds([edge.id]);
            setSelectedEdgeId(edge.id);
          }
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
        fitView={!initialLocalDraft?.viewport}
      >
        <Background
          variant="dots"
          gap={12}
          size={1}
        />

        <Controls/>
        
      </ReactFlow>

      <TreeController
        controllerRef={controllerRef}
        fileInputRef={fileInputRef}
        controllerMode={controllerMode}
        setControllerMode={setControllerMode}
        editTarget={editTarget}
        setEditTarget={setEditTarget}
        isNodeEditorOpen={isNodeEditorOpen}
        setIsNodeEditorOpen={setIsNodeEditorOpen}
        isLineStyleMenuOpen={isLineStyleMenuOpen}
        setIsLineStyleMenuOpen={setIsLineStyleMenuOpen}
        selectedNode={selectedNode}
        selectedEdge={selectedEdge}
        hasSelectedNodes={hasSelectedNodes}
        activeEdgeIds={activeEdgeIds}
        activeLineStyle={activeLineStyle}
        isLassoMode={isLassoMode}
        history={history}
        onLoadTreeFromFile={loadTreeFromFile}
        onExportTree={exportTree}
        onOpenImportPicker={openImportPicker}
        onAddNode={addNode}
        onDeleteSelectedNode={deleteSelectedNode}
        onUpdateSelectedNodeColor={updateSelectedNodeColor}
        onAddRelative={addRelative}
        onUpdateSelectedEdgeColor={updateSelectedEdgeColor}
        onUpdateSelectedEdgeLineStyle={updateSelectedEdgeLineStyle}
        onDeleteSelectedEdge={deleteSelectedEdge}
        onToggleLassoMode={toggleLassoMode}
        onUndo={undo}
        onRedo={redo}
      />
    </div>
  );
}

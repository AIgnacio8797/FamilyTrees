import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft,
  faCircleCheck,
  faCircleExclamation,
  faSliders,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
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
import treeApi from './api/trees.js';

const nodeTypes = {
  person: PersonNode,
};

const edgeTypes = {
  relationship: RelationshipEdge,
};

export default function App() {
  const { treeId: routeTreeId } = useParams();
  const navigate = useNavigate();
  const [initialLocalDraft] = useState(() => loadTreeFromLocalDraft(routeTreeId));
  const [tree, setTree] = useState(() => (
    initialLocalDraft?.tree || { nodes: initialNodes, edges: initialEdges }
  ));
  // The local draft belongs to a saved tree when it carries a treeId. We "adopt"
  // that draft — keeping any unsaved edits as a safety net — when reopening the
  // tree it belongs to: the blank route (redirected to its URL) or a matching
  // /tree/:id (e.g. a refresh). Opening a different/shared tree fetches instead.
  const draftTreeId = initialLocalDraft?.treeId ?? null;
  const willAdoptDraft = Boolean(draftTreeId) && (!routeTreeId || routeTreeId === draftTreeId);
  const adoptedDraftTreeId = willAdoptDraft ? draftTreeId : null;
  const [treeTitle, setTreeTitle] = useState(() => (
    willAdoptDraft ? (initialLocalDraft.title || 'Untitled Tree') : 'Untitled Tree'
  ));
  const [treeTitleDraft, setTreeTitleDraft] = useState(() => (
    willAdoptDraft ? (initialLocalDraft.title || 'Untitled Tree') : 'Untitled Tree'
  ));
  const [treeId, setTreeId] = useState(adoptedDraftTreeId);
  const [loadStatus, setLoadStatus] = useState(() => {
    if (willAdoptDraft) return 'loaded'; // draft already in state; no fetch needed
    if (routeTreeId) return 'loading'; // fetching a different / shared tree
    return 'idle'; // blank new editor
  });
  const [loadError, setLoadError] = useState('');
  const [history, setHistory] = useState({ past: [], future: [] });
  const [controllerMode, setControllerMode] = useState('edit');
  const [isControllerHidden, setIsControllerHidden] = useState(false);
  const [viewPositions, setViewPositions] = useState({}); // ephemeral view-mode drags
  const [editTarget, setEditTarget] = useState('people');
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [isEditingTreeTitle, setIsEditingTreeTitle] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [isLassoMode, setIsLassoMode] = useState(false);
  const [isLineStyleMenuOpen, setIsLineStyleMenuOpen] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [saveFeedback, setSaveFeedback] = useState({
    status: 'idle',
    message: '',
  });
  const isDraggingNodeRef = useRef(false);
  const fileInputRef = useRef(null);
  const treeTitleInputRef = useRef(null);
  const treeRef = useRef(tree);
  const historyRef = useRef(history);
  const controllerRef = useRef(null);
  const autosaveTimeoutRef = useRef(null);
  const saveFeedbackTimeoutRef = useRef(null);
  const viewportRef = useRef(initialLocalDraft?.viewport || null);
  // When adopting the draft, its viewport is applied via pendingLoadViewportRef
  // (below), and loadedTreeIdRef is pre-seeded so the fetch effect skips.
  const hasAppliedInitialViewportRef = useRef(willAdoptDraft);
  const loadedTreeIdRef = useRef(adoptedDraftTreeId);
  const pendingLoadViewportRef = useRef(willAdoptDraft ? (initialLocalDraft.viewport ?? null) : undefined);
  const treeIdRef = useRef(treeId);
  const treeTitleRef = useRef(treeTitle);
  const hasHandledInitialResumeRef = useRef(false);
  const isDirtyRef = useRef(false); // edits not yet saved to the backend
  const { nodes, edges } = tree;
  const isViewMode = controllerMode === 'view';

  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    treeIdRef.current = treeId;
  }, [treeId]);

  useEffect(() => {
    treeTitleRef.current = treeTitle;
  }, [treeTitle]);

  // On the initial blank route, if the local draft belongs to a saved tree,
  // resume it under its real /tree/:id URL. Runs once, before paint, so the
  // backend load takes over cleanly without a flash of the detached draft.
  useLayoutEffect(() => {
    if (hasHandledInitialResumeRef.current) return;
    hasHandledInitialResumeRef.current = true;

    if (!routeTreeId && draftTreeId) {
      navigate(`/tree/${draftTreeId}`, { replace: true });
    }
  }, [routeTreeId, draftTreeId, navigate]);

  useEffect(() => {
    if (!isEditingTreeTitle) return;

    treeTitleInputRef.current?.focus();
    treeTitleInputRef.current?.select();
  }, [isEditingTreeTitle]);

  const flushAutosave = useCallback(() => {
    const viewport = reactFlowInstance?.getViewport() || viewportRef.current || null;
    const savedDraft = saveTreeToLocalDraft(treeRef.current, viewport, {
      treeId: treeIdRef.current,
      title: treeTitleRef.current,
    });

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

  const enterViewMode = useCallback(() => {
    setControllerMode('view');
    setIsLassoMode(false);
    setViewPositions({});
    clearInteractionState();
  }, [clearInteractionState]);

  const commitTree = useCallback((nextTree, { record = true } = {}) => {
    isDirtyRef.current = true;
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

  const showSaveFeedback = useCallback((status, message, duration = 0) => {
    if (saveFeedbackTimeoutRef.current) {
      window.clearTimeout(saveFeedbackTimeoutRef.current);
      saveFeedbackTimeoutRef.current = null;
    }

    setSaveFeedback({ status, message });

    if (duration > 0) {
      saveFeedbackTimeoutRef.current = window.setTimeout(() => {
        setSaveFeedback({ status: 'idle', message: '' });
        saveFeedbackTimeoutRef.current = null;
      }, duration);
    }
  }, []);

  const saveTree = async () => {
    try {
      showSaveFeedback('saving', 'Saving tree to server...');

      const treeData = {
        version: 1,
        tree: {
          nodes,
          edges,
        },
        viewport: reactFlowInstance?.getViewport() || viewportRef.current || null,
      };

      if (treeId === null) {
        const createdTree = await treeApi.createTree(treeTitle, treeData);
        setTreeId(createdTree.id);
        // Mark as loaded so the route change below doesn't refetch what we just
        // created, then reflect the new tree's stable URL in the address bar.
        loadedTreeIdRef.current = createdTree.id;
        navigate(`/tree/${createdTree.id}`);
        showSaveFeedback('saved', 'Tree saved to server.', 2600);
      } else {
        await treeApi.updateTree(treeId, treeTitle, treeData);
        showSaveFeedback('saved', 'Changes saved to server.', 2600);
      }

      isDirtyRef.current = false;
    } catch (error) {
      console.error('Error saving data:', error);
      showSaveFeedback(
        'error',
        error instanceof Error ? error.message : 'Unable to save tree right now.',
        4200,
      );
    }
  };

  // Persist a view-mode rearrangement as a separate new tree, leaving the
  // original untouched. Applies the ephemeral positions, then creates a copy.
  const saveAsNewLayout = async () => {
    try {
      showSaveFeedback('saving', 'Saving layout as a new tree...');

      const layoutNodes = treeRef.current.nodes.map((node) => ({
        ...node,
        position: viewPositions[node.id] || node.position,
      }));
      const nextTree = { nodes: layoutNodes, edges: treeRef.current.edges };
      const newTitle = `${treeTitle} (new layout)`;
      const treeData = {
        version: 1,
        tree: nextTree,
        viewport: reactFlowInstance?.getViewport() || viewportRef.current || null,
      };

      const created = await treeApi.createTree(newTitle, treeData);

      commitTree(nextTree, { record: false });
      setTreeId(created.id);
      setTreeTitle(newTitle);
      setTreeTitleDraft(newTitle);
      loadedTreeIdRef.current = created.id;
      setViewPositions({});
      isDirtyRef.current = false;
      navigate(`/tree/${created.id}`);
      showSaveFeedback('saved', 'Saved as a new tree.', 2600);
    } catch (error) {
      console.error('Error saving layout:', error);
      showSaveFeedback(
        'error',
        error instanceof Error ? error.message : 'Unable to save this layout.',
        4200,
      );
    }
  };

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

  const commitTreeTitle = useCallback((nextTitle) => {
    const trimmedTitle = nextTitle.trim();

    setTreeTitle(trimmedTitle || 'Untitled Tree');
    setTreeTitleDraft(trimmedTitle || 'Untitled Tree');
    setIsEditingTreeTitle(false);
  }, []);

  const cancelTreeTitleEditing = useCallback(() => {
    setTreeTitleDraft(treeTitle);
    setIsEditingTreeTitle(false);
  }, [treeTitle]);

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

    if (saveFeedbackTimeoutRef.current) {
      window.clearTimeout(saveFeedbackTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (autosaveTimeoutRef.current) {
        window.clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }

      flushAutosave();

      // Warn before closing/refreshing if there are edits not saved to the server.
      // (Work is still kept in the local draft, but the durable copy isn't updated.)
      if (isDirtyRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushAutosave]);

  useEffect(() => {
    if (!reactFlowInstance || hasAppliedInitialViewportRef.current) return;

    // A tree opened from a URL manages its own viewport; skip the local draft's.
    if (routeTreeId) {
      hasAppliedInitialViewportRef.current = true;
      return;
    }

    const initialViewport = initialLocalDraft?.viewport;

    if (initialViewport) {
      requestAnimationFrame(() => {
        reactFlowInstance.setViewport(initialViewport, { duration: 0 });
      });
    }

    hasAppliedInitialViewportRef.current = true;
  }, [initialLocalDraft, reactFlowInstance, routeTreeId]);

  // Load a saved tree from the backend when the URL carries a tree id.
  useEffect(() => {
    if (!routeTreeId || loadedTreeIdRef.current === routeTreeId) return;

    let cancelled = false;
    setLoadStatus('loading');
    setLoadError('');

    (async () => {
      try {
        const row = await treeApi.getTreeById(routeTreeId);

        if (cancelled) return;

        const restoredTree = row?.tree_data?.tree;

        if (!restoredTree || !Array.isArray(restoredTree.nodes) || !Array.isArray(restoredTree.edges)) {
          throw new Error('This tree could not be opened (unexpected data format).');
        }

        // Restore the graph with a clean undo history.
        treeRef.current = restoredTree;
        historyRef.current = { past: [], future: [] };
        setHistory({ past: [], future: [] });
        setTree(restoredTree);
        setTreeId(row.id);
        setTreeTitle(row.title || 'Untitled Tree');
        setTreeTitleDraft(row.title || 'Untitled Tree');
        clearInteractionState();

        const loadedViewport = row.tree_data.viewport ?? null;
        viewportRef.current = loadedViewport;
        pendingLoadViewportRef.current = loadedViewport; // object -> setViewport, null -> fitView
        hasAppliedInitialViewportRef.current = true;

        loadedTreeIdRef.current = routeTreeId;
        isDirtyRef.current = false;
        setLoadStatus('loaded');
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : 'Unable to open this tree.');
        setLoadStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [routeTreeId, clearInteractionState]);

  // Apply a loaded tree's viewport once the React Flow instance is ready.
  useEffect(() => {
    if (!reactFlowInstance || pendingLoadViewportRef.current === undefined) return;

    const viewport = pendingLoadViewportRef.current;
    pendingLoadViewportRef.current = undefined;

    requestAnimationFrame(() => {
      if (viewport) {
        reactFlowInstance.setViewport(viewport, { duration: 0 });
      } else {
        reactFlowInstance.fitView({ duration: 250, padding: 0.18 });
      }
    });
  }, [reactFlowInstance, loadStatus]);
 
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

    if (isViewMode) {
      // View mode: move nodes only on screen. Never touch the saved tree,
      // history, dirty state, or autosave — so viewing can't overwrite a save.
      setViewPositions((current) => {
        let changed = false;
        const next = { ...current };

        for (const change of changes) {
          if (change.type === 'position' && change.position) {
            next[change.id] = change.position;
            changed = true;
          }
        }

        return changed ? next : current;
      });
      return;
    }

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
  }, [updateTree, isViewMode]);

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

  const controllerHidden = isControllerHidden;
  const hasViewLayoutChanges = isViewMode && Object.keys(viewPositions).length > 0;

  const flowNodes = nodes.map((node) => ({
    ...node,
    position: isViewMode && viewPositions[node.id] ? viewPositions[node.id] : node.position,
    selected: selectedNodeIds.includes(node.id),
    data: {
      ...node.data,
      isInteractive: !isViewMode,
      isEditing: node.id === editingNodeId,
      onStartEditing: startEditingNode,
      onLabelChange: updateNodeLabel,
      onCancelEditing: cancelEditingNode,
    },
  }));

  const saveFeedbackMeta = {
    saving: {
      icon: faSpinner,
      label: 'Saving',
      iconClassName: 'save-feedback-icon saving',
      spin: true,
    },
    saved: {
      icon: faCircleCheck,
      label: 'Saved',
      iconClassName: 'save-feedback-icon saved',
      spin: false,
    },
    error: {
      icon: faCircleExclamation,
      label: 'Error',
      iconClassName: 'save-feedback-icon error',
      spin: false,
    },
  };

  const activeSaveFeedback = saveFeedback.status !== 'idle'
    ? saveFeedbackMeta[saveFeedback.status]
    : null;
 
  return (
    <div className={`app-shell ${isViewMode ? 'view-mode' : ''}`}>
      <div className="tree-title-banner">
        {isEditingTreeTitle ? (
          <input
            ref={treeTitleInputRef}
            type="text"
            className="tree-title-input"
            value={treeTitleDraft}
            maxLength={120}
            aria-label="Tree title"
            onChange={(event) => setTreeTitleDraft(event.target.value)}
            onBlur={(event) => commitTreeTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitTreeTitle(event.currentTarget.value);
              }

              if (event.key === 'Escape') {
                event.preventDefault();
                cancelTreeTitleEditing();
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="tree-title-display"
            title="Double-click to edit tree title"
            onDoubleClick={() => {
              setTreeTitleDraft(treeTitle);
              setIsEditingTreeTitle(true);
            }}
          >
            {treeTitle}
          </button>
        )}
      </div>

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
          if (isViewMode) return;
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
          if (isViewMode) return;
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
        nodesConnectable={!isViewMode}
        elementsSelectable={!isViewMode}
        selectionOnDrag={isLassoMode && !isViewMode}
        panOnDrag={isViewMode || !isLassoMode}
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
        onEnterViewMode={enterViewMode}
        controllerHidden={controllerHidden}
        onHideController={() => setIsControllerHidden(true)}
        onSaveAsNewLayout={saveAsNewLayout}
        canSaveLayout={hasViewLayoutChanges}
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
        onSaveTree={saveTree}
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

      {controllerHidden && (
        <button
          type="button"
          className="controller-reveal"
          aria-label="Show controller"
          title="Show controller"
          onClick={() => setIsControllerHidden(false)}
        >
          <FontAwesomeIcon icon={faSliders} className="controller-reveal-icon" />
          <FontAwesomeIcon icon={faChevronLeft} className="controller-reveal-arrow" />
        </button>
      )}

      {activeSaveFeedback && (
        <div className={`save-feedback-toast ${saveFeedback.status}`} role="status" aria-live="polite">
          <div className={activeSaveFeedback.iconClassName}>
            <FontAwesomeIcon icon={activeSaveFeedback.icon} spin={activeSaveFeedback.spin} />
          </div>
          <div className="save-feedback-copy">
            <div className="save-feedback-title">{activeSaveFeedback.label}</div>
            <div className="save-feedback-message">{saveFeedback.message}</div>
          </div>
        </div>
      )}

      {routeTreeId && (loadStatus === 'loading' || loadStatus === 'error') && (
        <div
          className={`tree-load-overlay ${loadStatus}`}
          role={loadStatus === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <div className="tree-load-card">
            {loadStatus === 'loading' ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin className="tree-load-icon" />
                <p className="tree-load-message">Loading tree…</p>
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faCircleExclamation} className="tree-load-icon error" />
                <p className="tree-load-message">{loadError}</p>
                <button type="button" className="tree-load-button" onClick={() => navigate('/')}>
                  Start a new tree
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

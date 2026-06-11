import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronRight,
  faEye,
  faPenToSquare,
  faUpload,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import { getLineDasharray, lineStyleOptions } from '../constants/lineStyles';

export function TreeController({
  controllerRef,
  fileInputRef,
  controllerMode,
  setControllerMode,
  onEnterViewMode,
  controllerHidden,
  onHideController,
  onSaveAsNewLayout,
  canSaveLayout,
  editTarget,
  setEditTarget,
  isNodeEditorOpen,
  setIsNodeEditorOpen,
  isLineStyleMenuOpen,
  setIsLineStyleMenuOpen,
  selectedNode,
  selectedEdge,
  hasSelectedNodes,
  activeEdgeIds,
  activeLineStyle,
  isLassoMode,
  history,
  onLoadTreeFromFile,
  onExportTree,
  onOpenImportPicker,
  onSaveTree,
  onAddNode,
  onDeleteSelectedNode,
  onUpdateSelectedNodeColor,
  onAddRelative,
  onUpdateSelectedEdgeColor,
  onUpdateSelectedEdgeLineStyle,
  onDeleteSelectedEdge,
  onToggleLassoMode,
  onUndo,
  onRedo,
}) {
  const showPeopleTools = controllerMode === 'edit' && editTarget === 'people';
  const showLineTools = controllerMode === 'edit' && editTarget === 'line';

  return (
    <aside
      ref={controllerRef}
      className={`tree-controller ${isNodeEditorOpen ? 'expanded-node-editor' : ''} ${controllerHidden ? 'controller-hidden' : ''}`}
      aria-label="Tree controller"
    >
      <button
        type="button"
        className="controller-hide-toggle"
        aria-label="Hide controller"
        title="Hide controller"
        onClick={onHideController}
      >
        <FontAwesomeIcon icon={faChevronRight} />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden-file-input"
        onChange={onLoadTreeFromFile}
      />
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
          onClick={onEnterViewMode}
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
                <label className={`controller-action color-picker-action ${activeEdgeIds.length === 0 ? 'disabled-controller-action' : ''}`}>
                  Edit line color
                  <input
                    type="color"
                    value={selectedEdge?.data?.color || '#9da19a'}
                    disabled={activeEdgeIds.length === 0}
                    onChange={(event) => onUpdateSelectedEdgeColor(event.target.value)}
                  />
                </label>
                <div className="line-style-picker">
                  <button
                    type="button"
                    className="controller-action"
                    disabled={activeEdgeIds.length === 0}
                    onClick={() => setIsLineStyleMenuOpen((isOpen) => !isOpen)}
                  >
                    Line style
                  </button>
                </div>
                <button
                  type="button"
                  className="controller-action"
                  onClick={onDeleteSelectedEdge}
                  disabled={activeEdgeIds.length === 0}
                >
                  Delete line
                </button>
                <button
                  type="button"
                  className={`controller-action controller-toggle-action ${isLassoMode ? 'active-toggle-action' : ''}`}
                  onClick={onToggleLassoMode}
                >
                  Lasso
                </button>
              </div>
            )}

            {showPeopleTools && !isNodeEditorOpen && (
              <div className="controller-tool-stack people-editor-panel">
                <button type="button" className="controller-action" onClick={onAddNode}>
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
                  onClick={onDeleteSelectedNode}
                  disabled={!hasSelectedNodes}
                >
                  Delete person
                </button>
                <button
                  type="button"
                  className={`controller-action controller-toggle-action ${isLassoMode ? 'active-toggle-action' : ''}`}
                  onClick={onToggleLassoMode}
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
                    onChange={(event) => onUpdateSelectedNodeColor(event.target.value)}
                  />
                </label>
                <button type="button" className="controller-action" onClick={() => onAddRelative('parent')}>
                  Add parent
                </button>
                <button type="button" className="controller-action" onClick={() => onAddRelative('child')}>
                  Add child
                </button>
                <button type="button" className="controller-action" onClick={() => onAddRelative('sibling')}>
                  Add sibling
                </button>
              </div>
            )}

            <div className="controller-history-actions">
              <button type="button" onClick={onUndo} disabled={history.past.length === 0}>
                Undo
              </button>
              <button type="button" onClick={onRedo} disabled={history.future.length === 0}>
                Redo
              </button>
            </div>
          </div>
        </>
      )}

      {showLineTools && activeEdgeIds.length > 0 && isLineStyleMenuOpen && (
        <div className="line-style-menu" aria-label="Line style options">
          {lineStyleOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={activeLineStyle === option.id ? 'active-line-style' : ''}
              aria-label={option.label}
              title={option.label}
              onClick={() => onUpdateSelectedEdgeLineStyle(option.id)}
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
          {controllerMode === 'import-export' ? (
            <div className="controller-tool-stack import-export-panel">
              <button
                type="button"
                className="controller-action"
                onClick={onSaveTree}
              >
                Save tree
              </button>
              <button
                type="button"
                className="controller-action"
                onClick={onExportTree}
              >
                Export JSON
              </button>
              <button
                type="button"
                className="controller-action"
                onClick={onOpenImportPicker}
              >
                Load tree
              </button>
              <div className="controller-panel-note">
                Save stores the current tree in the backend. Export downloads a JSON backup.
                Load restores a saved tree file.
              </div>
            </div>
          ) : (
            <div className="controller-tool-stack view-mode-panel">
              <button
                type="button"
                className="controller-action"
                onClick={onSaveAsNewLayout}
                disabled={!canSaveLayout}
              >
                Save as new layout
              </button>
              <div className="controller-panel-note">
                Drag nodes to explore — rearranging here won't change the saved tree.
                Save as new layout keeps your arrangement as a separate copy.
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

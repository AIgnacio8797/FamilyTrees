import { relationships } from '../constants/familyTree';

export function RelationshipPanel({
  selectedNode,
  selectedEdge,
  onAddRelative,
  onUpdateEdgeRelationship,
}) {
  if (selectedNode) {
    return (
      <aside className="relative-panel">
        <div>
          <p className="panel-label">Selected person</p>
          <h2>{selectedNode.data.label}</h2>
        </div>

        <div className="relative-actions">
          {relationships.map((relationship) => (
            <button key={relationship} type="button" onClick={() => onAddRelative(relationship)}>
              Add {relationship}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  if (selectedEdge) {
    return (
      <aside className="relative-panel">
        <div>
          <p className="panel-label">Selected wire</p>
          <h2>{selectedEdge.label || 'relationship'}</h2>
        </div>

        <div className="relative-actions">
          {relationships.map((relationship) => (
            <button
              key={relationship}
              type="button"
              className={selectedEdge.label === relationship ? 'active-action' : ''}
              onClick={() => onUpdateEdgeRelationship(selectedEdge.id, relationship)}
            >
              {relationship}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return null;
}

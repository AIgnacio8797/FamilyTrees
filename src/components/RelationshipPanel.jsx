import { relationships } from '../constants/familyTree';

export function RelationshipPanel({
  selectedNode,
  selectedEdge,
  relationshipOptions = relationships,
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
    const relationship = selectedEdge.data?.relationship || 'relationship';

    return (
      <aside className="relative-panel">
        <div>
          <p className="panel-label">Selected wire</p>
          <h2>{relationship}</h2>
        </div>

        <div className="relative-actions">
          {relationshipOptions.map((relationship) => (
            <button
              key={relationship}
              type="button"
              className={selectedEdge.data?.relationship === relationship ? 'active-action' : ''}
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

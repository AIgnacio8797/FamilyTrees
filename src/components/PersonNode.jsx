import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position } from '@xyflow/react';

export const PersonNode = memo(function PersonNode({ id, data }) {
  const inputRef = useRef(null);
  const [draftLabel, setDraftLabel] = useState(data.label);

  useEffect(() => {
    if (data.isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [data.isEditing]);

  const saveLabel = useCallback(() => {
    data.onLabelChange(id, draftLabel);
  }, [data, draftLabel, id]);

  const onKeyDown = useCallback((event) => {
    if (event.key === 'Enter') {
      saveLabel();
    }

    if (event.key === 'Escape') {
      setDraftLabel(data.label);
      data.onCancelEditing();
    }
  }, [data, saveLabel]);

  return (
    <div className="person-node">
      <Handle id="top" type="source" position={Position.Top} />

      {data.isEditing ? (
        <input
          ref={inputRef}
          className="person-node-input nodrag nopan"
          value={draftLabel}
          onChange={(event) => setDraftLabel(event.target.value)}
          onBlur={saveLabel}
          onKeyDown={onKeyDown}
        />
      ) : (
        <button
          type="button"
          className="person-node-label"
          onDoubleClick={() => data.onStartEditing(id)}
        >
          {data.label}
        </button>
      )}

      <Handle id="bottom" type="source" position={Position.Bottom} />
    </div>
  );
});

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export const RelationshipNode = memo(function RelationshipNode({ data }) {
  return (
    <div className={`relationship-node ${data.attachable ? 'attachable' : ''}`}>
      <Handle id="top" type="source" position={Position.Top} />
      <span>{data.label}</span>
      <Handle id="bottom" type="source" position={Position.Bottom} />
    </div>
  );
});

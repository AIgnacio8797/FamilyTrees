import { BaseEdge, getSmoothStepPath, getStraightPath } from '@xyflow/react';
import { getLineDasharray } from '../constants/lineStyles';

export function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}) {
  const isPartner = data?.relationship === 'partner';
  const [edgePath] = isPartner
    ? getStraightPath({ sourceX, sourceY, targetX, targetY })
    : getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: selected ? '#3a7d6b' : data?.color,
        strokeWidth: selected ? 3 : 2,
        strokeDasharray: getLineDasharray(data?.lineStyle),
      }}
    />
  );
}

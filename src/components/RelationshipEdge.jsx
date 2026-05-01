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
  const strokeDasharray = getLineDasharray(data?.lineStyle);
  const strokeColor = data?.color || '#9da19a';

  return (
    <>
      {selected && (
        <BaseEdge
          id={`${id}-selection`}
          path={edgePath}
          style={{
            stroke: '#3a7d6b',
            strokeWidth: 6,
            strokeOpacity: 0.45,
          }}
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: 2,
          strokeDasharray,
        }}
      />
    </>
  );
}

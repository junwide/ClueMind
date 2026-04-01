// src/components/Canvas/EdgeRenderer.tsx
import { FrameworkEdge } from '../../types/framework';

interface EdgeRendererProps {
  edge: FrameworkEdge;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  isSelected: boolean;
  onEdgeClick: (edgeId: string) => void;
}

const NODE_HEIGHT = 80;

function getArrowPoints(
  tipX: number, tipY: number,
  fromX: number, fromY: number,
): string {
  const angle = Math.atan2(tipY - fromY, tipX - fromX);
  const arrowSize = 8;
  const x1 = tipX - arrowSize * Math.cos(angle - Math.PI / 6);
  const y1 = tipY - arrowSize * Math.sin(angle - Math.PI / 6);
  const x2 = tipX - arrowSize * Math.cos(angle + Math.PI / 6);
  const y2 = tipY - arrowSize * Math.sin(angle + Math.PI / 6);
  return `${tipX},${tipY} ${x1},${y1} ${x2},${y2}`;
}

export function EdgeRenderer({
  edge,
  sourceX,
  sourceY,
  targetX,
  targetY,
  isSelected,
  onEdgeClick,
}: EdgeRendererProps) {
  const getEdgeStyle = () => {
    switch (edge.state) {
      case 'virtual':
        return {
          stroke: '#2196f3',
          strokeDasharray: '6,4',
          strokeWidth: isSelected ? 3 : 2,
          opacity: 0.6,
        };
      case 'confirmed':
        return {
          stroke: '#4caf50',
          strokeDasharray: 'none',
          strokeWidth: isSelected ? 3 : 2,
          opacity: 0.8,
        };
      case 'locked':
        return {
          stroke: '#ff9800',
          strokeDasharray: 'none',
          strokeWidth: isSelected ? 4 : 3,
          opacity: 1,
        };
    }
  };

  const style = getEdgeStyle();

  // Source: bottom center of source node
  const sx = sourceX;
  const sy = sourceY + NODE_HEIGHT;
  // Target: top center of target node
  const tx = targetX;
  const ty = targetY;

  // Bezier control points
  const dy = ty - sy;
  const cpOffset = Math.abs(dy) * 0.3 + 20;
  const path = `M ${sx} ${sy} C ${sx} ${sy + cpOffset}, ${tx} ${ty - cpOffset}, ${tx} ${ty}`;

  // Label position at midpoint
  const labelX = (sx + tx) / 2;
  const labelY = (sy + ty) / 2;
  const showLabel = isSelected || edge.state === 'locked';
  const labelLen = Math.min(edge.relationship.length * 7 + 12, 100);

  return (
    <g className="pointer-events-auto" style={{ cursor: 'pointer' }}>
      {/* Clickable invisible hit area */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onClick={() => onEdgeClick(edge.id)}
      />

      {/* Visible edge line */}
      <path
        d={path}
        fill="none"
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        strokeDasharray={style.strokeDasharray}
        opacity={style.opacity}
        onClick={() => onEdgeClick(edge.id)}
        style={{ transition: 'all 0.2s ease' }}
      />

      {/* Arrow at target */}
      <polygon
        points={getArrowPoints(tx, ty, sx, sy)}
        fill={style.stroke}
        opacity={style.opacity}
      />

      {/* Relationship label */}
      {showLabel && (
        <g>
          <rect
            x={labelX - labelLen / 2}
            y={labelY - 10}
            width={labelLen}
            height={20}
            rx={4}
            fill="white"
            stroke={style.stroke}
            strokeWidth={1}
          />
          <text
            x={labelX}
            y={labelY + 4}
            textAnchor="middle"
            fontSize={10}
            fill={style.stroke}
          >
            {edge.relationship}
          </text>
        </g>
      )}
    </g>
  );
}

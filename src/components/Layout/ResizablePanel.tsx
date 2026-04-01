// src/components/Layout/ResizablePanel.tsx
import { useState, useCallback, useRef, useEffect } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  /** Side where the drag handle appears: 'right' = handle on right edge, 'left' = handle on left edge */
  handleSide?: 'right' | 'left';
}

export function ResizablePanel({
  children,
  initialWidth = 384,
  minWidth = 280,
  maxWidth = 600,
  className = '',
  handleSide = 'right',
}: ResizablePanelProps) {
  const [width, setWidth] = useState(initialWidth);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = handleSide === 'right'
        ? e.clientX - startX.current
        : startX.current - e.clientX;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minWidth, maxWidth, handleSide]);

  const handlePosition = handleSide === 'right' ? 'right-0' : 'left-0';

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width }}
    >
      {children}
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute top-0 ${handlePosition} w-1.5 h-full cursor-col-resize hover:bg-blue-400 active:bg-blue-500 transition-colors z-10 group`}
        title="Drag to resize"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-gray-300 group-hover:bg-blue-500 rounded-full" />
      </div>
    </div>
  );
}

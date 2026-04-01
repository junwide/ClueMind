import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../../i18n';

interface DropInfo {
  id: string;
  content: { type: string; text?: string; url?: string; [key: string]: unknown };
}

interface DropThumbnailProps {
  dropIds: string[];
}

function getPreview(drop: DropInfo): string {
  const c = drop.content;
  if (c.type === 'text') return c.text || '';
  if (c.type === 'url') return c.url || '';
  return '';
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    text: '📝',
    url: '🔗',
    image: '🖼️',
    file: '📁',
    voice: '🎤',
  };
  return icons[type] || '📄';
}

export function DropThumbnail({ dropIds }: DropThumbnailProps) {
  const { t } = useTranslation();
  const [drops, setDrops] = useState<DropInfo[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all(
      dropIds.map(id => invoke<DropInfo | null>('get_drop', { id }).catch(() => null))
    ).then(results => {
      setDrops(results.filter((d): d is DropInfo => d !== null));
    });
  }, [dropIds]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setIsDragging(true);

    // Set initial position if not already set
    if (!position) {
      setPosition({ x: rect.left, y: rect.top });
    }
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (drops.length === 0) return null;

  const visible = expanded ? drops : drops.slice(0, 3);

  const containerStyle: React.CSSProperties = position
    ? { position: 'fixed', left: position.x, top: position.y, zIndex: 50 }
    : {};

  if (minimized) {
    return (
      <div
        ref={containerRef}
        style={containerStyle}
        className={`bg-white rounded-lg shadow-md border border-gray-200 p-2 ${position ? '' : 'inline-block'}`}
      >
        <div className="flex items-center gap-1">
          <button
            onMouseDown={handleMouseDown}
            className="cursor-move text-gray-300 hover:text-gray-500"
            title={t('canvas.drops.dragToMove')}
          >
            ⠿
          </button>
          <span className="text-xs">📎 {drops.length}</span>
          <button
            onClick={() => setMinimized(false)}
            className="text-xs text-blue-500 hover:text-blue-700 ml-1"
          >
            {t('canvas.drops.expand')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className={`bg-white rounded-lg shadow-md border border-gray-200 p-2 max-w-xs ${isDragging ? 'opacity-80' : ''}`}
    >
      <div className="flex items-center gap-1 mb-1">
        <button
          onMouseDown={handleMouseDown}
          className="cursor-move text-gray-300 hover:text-gray-500"
          title={t('canvas.drops.dragToMove')}
        >
          ⠿
        </button>
        <span className="text-xs font-medium text-gray-600">{t('canvas.drops.sourceMaterials', { count: String(drops.length) })}</span>
        <button
          onClick={() => setMinimized(true)}
          className="text-xs text-gray-300 hover:text-gray-500 ml-auto"
          title={t('canvas.drops.minimize')}
        >
          ─
        </button>
      </div>
      <div className="space-y-1">
        {visible.map(drop => (
          <div key={drop.id} className="flex items-center gap-1.5 text-xs text-gray-500 truncate">
            <span>{getTypeIcon(drop.content?.type || '')}</span>
            <span className="truncate">{getPreview(drop).slice(0, 50)}</span>
          </div>
        ))}
      </div>
      {drops.length > 3 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-blue-500 hover:text-blue-700 mt-1"
        >
          {t('canvas.drops.moreCount', { count: String(drops.length - 3) })}
        </button>
      )}
      {expanded && drops.length > 3 && (
        <button
          onClick={() => setExpanded(false)}
          className="text-xs text-gray-400 hover:text-gray-600 mt-1"
        >
          {t('canvas.drops.collapse')}
        </button>
      )}
    </div>
  );
}

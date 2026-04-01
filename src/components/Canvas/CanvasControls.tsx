// src/components/Canvas/CanvasControls.tsx
import { useTranslation } from '../../i18n';

interface CanvasControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  scale: number;
}

export function CanvasControls({ onZoomIn, onZoomOut, onReset, scale }: CanvasControlsProps) {
  const { t } = useTranslation();

  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
      <button
        className="w-8 h-8 bg-white rounded shadow hover:bg-gray-100 flex items-center justify-center text-lg font-bold"
        onClick={onZoomIn}
        title={t('canvas.controls.zoomIn')}
      >
        +
      </button>
      <div className="text-xs text-center text-gray-500 bg-white rounded shadow px-1">
        {Math.round(scale * 100)}%
      </div>
      <button
        className="w-8 h-8 bg-white rounded shadow hover:bg-gray-100 flex items-center justify-center text-lg font-bold"
        onClick={onZoomOut}
        title={t('canvas.controls.zoomOut')}
      >
        -
      </button>
      <button
        className="px-2 h-8 bg-white rounded shadow hover:bg-gray-100 text-xs"
        onClick={onReset}
        title={t('canvas.controls.resetView')}
      >
        {t('canvas.controls.reset')}
      </button>
    </div>
  );
}

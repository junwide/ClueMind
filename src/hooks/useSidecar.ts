// src/hooks/useSidecar.ts
import { useState } from 'react';

export type SidecarStatus = 'idle' | 'starting' | 'ready' | 'error';

export function useSidecar() {
  const [status, setStatus] = useState<SidecarStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const startSidecar = async () => {
    setStatus('starting');
    setError(null);

    try {
      // TODO: 调用 Tauri IPC 启动 Sidecar
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 模拟启动
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : '启动失败');
    }
  };

  return {
    status,
    error,
    startSidecar,
  };
}

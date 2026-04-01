// src/hooks/useDrops.ts
import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Drop } from '../types/drop';

export function useDrops() {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDrops = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<Drop[]>('list_drops');
      setDrops(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch drops';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const createTextDrop = useCallback(async (text: string): Promise<Drop> => {
    try {
      const drop = await invoke<Drop>('create_text_drop', { text });
      setDrops(prev => [drop, ...prev]);
      return drop;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create text drop';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const createUrlDrop = useCallback(async (url: string, title?: string): Promise<Drop> => {
    try {
      const drop = await invoke<Drop>('create_url_drop', { url, title });
      setDrops(prev => [drop, ...prev]);
      return drop;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create URL drop';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const createImageDrop = useCallback(async (path: string, ocrText?: string): Promise<Drop> => {
    try {
      const drop = await invoke<Drop>('create_image_drop', { path, ocrText });
      setDrops(prev => [drop, ...prev]);
      return drop;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create image drop';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const deleteDrop = useCallback(async (id: string): Promise<void> => {
    try {
      await invoke('delete_drop', { id });
      setDrops(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete drop';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch drops on mount
  useEffect(() => {
    fetchDrops();
  }, [fetchDrops]);

  return {
    drops,
    loading,
    error,
    fetchDrops,
    createTextDrop,
    createUrlDrop,
    createImageDrop,
    deleteDrop,
    clearError,
  };
}

// src/hooks/useAIChat.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { KnowledgeFramework } from '../types/framework';
import { useAPIKeys } from './useAPIKeys';

export type AIChatStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseAIChatOptions {
  provider?: string;
}

interface AIFramework {
  id: string;
  title: string;
  description?: string;
  structure_type: string;
  nodes: Array<{
    id: string;
    label: string;
    content: string;
    level: number;
    state: string;
    source?: string;
    reasoning?: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    relationship: string;
  }>;
}

interface GenerateResponse {
  frameworks: AIFramework[];
  recommended_drops: string[];
}

// Get active provider from localStorage
function getActiveProvider(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeProvider') || 'openai';
  }
  return 'openai';
}

export function useAIChat(options: UseAIChatOptions = {}) {
  const [status, setStatus] = useState<AIChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const { keys, configs, loading: keysLoading } = useAPIKeys();

  // --- Streaming helpers (defined before use) ---

  const startStreamingListener = useCallback(async () => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    setStreamingText('');

    const unlisten = await listen<{ chunk: string; done: boolean }>('ai-stream-chunk', (event) => {
      if (event.payload.done) return;
      setStreamingText(prev => prev + event.payload.chunk);
    });
    unlistenRef.current = unlisten;
  }, []);

  const stopStreamingListener = useCallback(() => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
  }, []);

  // --- AI operations ---

  // Generate frameworks from drops
  const generateFrameworks = useCallback(async (
    userInput: string,
    drops: Array<{ id: string; content: string }>,
  ): Promise<GenerateResponse> => {
    setStatus('loading');
    setError(null);

    const provider = options.provider || getActiveProvider();
    const apiKey = keys[provider];

    if (!apiKey) {
      const errorMsg = `请先在设置中配置 ${provider} 的 API Key`;
      setError(errorMsg);
      setStatus('error');
      throw new Error(errorMsg);
    }

    const config = configs[provider];
    const model = config?.model || 'gpt-4';
    const baseUrl = config?.base_url || null;

    try {
      await startStreamingListener();

      const response = await invoke<GenerateResponse>('generate_frameworks', {
        provider,
        apiKey,
        model,
        baseUrl,
        userInput,
        drops: drops.map(d => d.content),
      });

      setStatus('success');
      return response;
    } catch (err) {
      let errorMessage: string;
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err === 'object') {
        const tauriErr = err as any;
        errorMessage = tauriErr.message || tauriErr.error || JSON.stringify(err);
      } else {
        errorMessage = String(err);
      }

      console.error('[useAIChat] Error:', err);
      console.error('[useAIChat] Error message:', errorMessage);

      setError(errorMessage);
      setStatus('error');
      throw new Error(errorMessage);
    } finally {
      stopStreamingListener();
    }
  }, [options.provider, keys, configs, startStreamingListener, stopStreamingListener]);

  // Refine framework based on instruction
  const refineFramework = useCallback(async (
    framework: KnowledgeFramework,
    instruction: string,
  ): Promise<GenerateResponse> => {
    setStatus('loading');
    setError(null);

    const provider = options.provider || getActiveProvider();
    const apiKey = keys[provider];

    if (!apiKey) {
      const errorMsg = `请先在设置中配置 ${provider} 的 API Key`;
      setError(errorMsg);
      setStatus('error');
      throw new Error(errorMsg);
    }

    const config = configs[provider];
    const model = config?.model || 'gpt-4';
    const baseUrl = config?.base_url || null;

    const frameworkForAI = {
      id: framework.id,
      title: framework.title,
      description: framework.description,
      structure_type: framework.structureType,
      nodes: framework.nodes.map(n => ({
        id: n.id,
        label: n.label,
        content: n.content,
        level: n.level,
        state: n.state,
        source: n.metadata?.source || '',
        reasoning: n.metadata?.reasoning || '',
      })),
      edges: framework.edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        relationship: e.relationship,
        state: e.state,
      })),
    };

    try {
      await startStreamingListener();

      const response = await invoke<GenerateResponse>('refine_framework', {
        provider,
        apiKey,
        model,
        baseUrl,
        framework: frameworkForAI,
        instruction,
      });

      setStatus('success');
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setStatus('error');
      throw new Error(errorMessage);
    } finally {
      stopStreamingListener();
    }
  }, [options.provider, keys, configs, startStreamingListener, stopStreamingListener]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setStreamingText('');
  }, []);

  const summarizeConversation = useCallback(async (
    messages: Array<{ role: string; content: string }>,
    frameworkSummary: string,
  ): Promise<string> => {
    const provider = options.provider || getActiveProvider();
    const apiKey = keys[provider];
    if (!apiKey) return '';

    const config = configs[provider];
    const model = config?.model || 'gpt-4';
    const baseUrl = config?.base_url || null;

    try {
      const result = await invoke<string>('summarize_conversation', {
        provider,
        apiKey,
        model,
        baseUrl,
        messages,
        frameworkSummary,
      });
      return result;
    } catch (err) {
      console.error('Failed to generate summary:', err);
      return '';
    }
  }, [options.provider, keys, configs]);

  // Cleanup listener on unmount
  useEffect(() => {
    return () => { stopStreamingListener(); };
  }, [stopStreamingListener]);

  return {
    status,
    error,
    streamingText,
    keysLoading,
    generateFrameworks,
    refineFramework,
    summarizeConversation,
    reset,
  };
}

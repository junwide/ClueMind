// src/hooks/useAIChat.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { KnowledgeFramework } from '../types/framework';
import type { GenerateResponse } from '../types/reactFlow';
import { useAPIKeys } from './useAPIKeys';

export type AIChatStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseAIChatOptions {
  provider?: string;
}

// Re-export GenerateResponse for consumers
export type { GenerateResponse } from '../types/reactFlow';

// Get active provider from localStorage
function getActiveProvider(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeProvider') || 'openai';
  }
  return 'openai';
}

/// Format a Tauri/backend error into a user-friendly message.
function formatUserError(err: unknown): string {
  // Extract the raw error string from Tauri error objects
  let raw: string;
  if (err instanceof Error) {
    raw = err.message;
  } else if (typeof err === 'string') {
    raw = err;
  } else if (err && typeof err === 'object') {
    const objErr = err as Record<string, unknown>;
    raw = (typeof objErr.message === 'string' ? objErr.message : '')
      || (typeof objErr.error === 'string' ? objErr.error : '')
      || JSON.stringify(err);
  } else {
    raw = String(err);
  }

  // Translate known backend error patterns into friendly messages
  if (raw.includes('Stream error') || raw.includes('unexpected EOF') || raw.includes('connection reset')) {
    return '网络连接中断，请重试';
  }
  if (raw.includes('API error 401') || raw.includes('Incorrect API key') || raw.includes('invalid x-api-key')) {
    return 'API Key 无效，请检查设置';
  }
  if (raw.includes('API error 429') || raw.includes('rate limit') || raw.includes('quota')) {
    return 'API 调用频率超限，请稍后重试';
  }
  if (raw.includes('API error 402') || raw.includes('Insufficient balance') || raw.includes('insufficient_quota')) {
    return 'API 余额不足，请检查账户';
  }
  if (/API error 5\d\d/.test(raw)) {
    return 'AI 服务暂时不可用，请稍后重试';
  }
  if (raw.includes('timed out') || raw.includes('Timeout') || raw.includes('deadline')) {
    return '请求超时，请检查网络连接后重试';
  }
  if (raw.includes('Failed to parse AI response') || raw.includes('Failed to parse response')) {
    return 'AI 返回格式异常，请重试或减少素材数量';
  }

  // Strip raw JSON wrapper if present: {"Api":"..."} or {"error":"..."}
  const jsonMatch = raw.match(/^\{["'](?:Api|error)["']:\s*["'](.+)["']\}$/);
  if (jsonMatch) {
    return jsonMatch[1];
  }

  return raw;
}

// Find where JSON framework data starts in streaming text.
// Looks for a line that begins with '{"frameworks"' or contains '"frameworks":'.
function findJsonStart(text: string): number {
  // Strategy: find the first '{' on its own line that starts a frameworks object
  const lines = text.split('\n');
  let charPos = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{"frameworks') || trimmed.startsWith('{"recommended_drops') || trimmed.startsWith('{" ')) {
      return charPos + line.indexOf(trimmed);
    }
    // Also check for lines that look like the start of a JSON object with frameworks
    if (trimmed === '{' || trimmed.startsWith('{')) {
      // Peek ahead: if we're near the end of text, this might just be inline text
      const afterBracket = text.slice(charPos + line.indexOf('{'));
      if (afterBracket.includes('"frameworks"')) {
        return charPos + line.indexOf('{');
      }
    }
    charPos += line.length + 1; // +1 for the \n
  }
  return -1;
}

export function useAIChat(options: UseAIChatOptions = {}) {
  const [status, setStatus] = useState<AIChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');
  const [displayText, setDisplayText] = useState<string>('');
  const [lastResponseText, setLastResponseText] = useState<string>('');
  const lastResponseTextRef = useRef('');
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const { keys, configs, loading: keysLoading } = useAPIKeys();

  // --- Streaming helpers (defined before use) ---

  const startStreamingListener = useCallback(async () => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    setStreamingText('');
    setDisplayText('');
    setLastResponseText('');
    lastResponseTextRef.current = '';

    const unlisten = await listen<{ chunk: string; done: boolean }>('ai-stream-chunk', (event) => {
      if (event.payload.done) {
        setStreamingText(prev => {
          if (prev) {
            lastResponseTextRef.current = prev;
            setLastResponseText(prev);
          }
          return '';
        });
        // Don't clear displayText here — let it persist until status changes
        // hide the streaming display. Clearing causes a flash of "AI is thinking..."
        return;
      }
      setStreamingText(prev => {
        const updated = prev + event.payload.chunk;
        const jsonStart = findJsonStart(updated);
        const display = jsonStart >= 0 ? updated.slice(0, jsonStart).trimEnd() : updated;
        setDisplayText(display);
        return updated;
      });
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
      let errorMessage = formatUserError(err);

      console.error('[useAIChat] Error:', err);

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
      const errorMessage = formatUserError(err);
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
    setDisplayText('');
    setLastResponseText('');
    lastResponseTextRef.current = '';
  }, []);

  const generateGuidanceQuestions = useCallback(async (
    frameworkJson: string,
    dropsJson: string,
    questionType: 'initial' | 'followup',
  ): Promise<string[]> => {
    const provider = options.provider || getActiveProvider();
    const apiKey = keys[provider];
    if (!apiKey) return [];

    const config = configs[provider];
    const model = config?.model || 'gpt-4';
    const baseUrl = config?.base_url || null;

    try {
      const result = await invoke<string[]>('generate_guidance_questions', {
        provider,
        apiKey,
        model,
        baseUrl,
        frameworkJson,
        dropsJson,
        questionType,
      });
      return result;
    } catch (err) {
      console.error('Failed to generate guidance questions:', err);
      return [];
    }
  }, [options.provider, keys, configs]);

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
    displayText,
    lastResponseText,
    lastResponseTextRef,
    keysLoading,
    generateFrameworks,
    refineFramework,
    summarizeConversation,
    generateGuidanceQuestions,
    reset,
  };
}

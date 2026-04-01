// src/hooks/useConversation.ts
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Message, ConversationStatus } from '../types/conversation';

interface SendMessageOptions {
  provider: string;
  model: string;
  drops?: Array<{ id: string; content: string }>;
  type: 'generate_framework' | 'refine_framework' | 'refine_node';
  framework?: unknown;
  node?: unknown;
}

interface SidecarResponse {
  type: string;
  frameworks?: unknown[];
  node?: unknown;
}

export function useConversation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ConversationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    content: string,
    options: SendMessageOptions
  ) => {
    setStatus('generating');
    setError(null);

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      metadata: {
        dropIds: options.drops?.map(d => d.id),
      },
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await invoke<SidecarResponse>('send_to_sidecar', {
        message: {
          type: options.type,
          user_input: content,
          drops: options.drops || [],
          provider: options.provider,
          model: options.model,
          framework: options.framework,
          node: options.node,
          request_id: `req-${Date.now()}`,
          conversation_id: currentConversationId,
        },
      });

      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: response.type === 'framework_result'
          ? '已生成框架方案'
          : response.type === 'node_result'
            ? '已更新节点'
            : '处理完成',
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStatus('idle');

      return response;
    } catch (err) {
      setStatus('error');
      const errorMessage = err instanceof Error ? err.message : '请求失败';
      setError(errorMessage);
      throw err;
    }
  }, [currentConversationId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setStatus('idle');
  }, []);

  return {
    messages,
    status,
    error,
    sendMessage,
    clearMessages,
    currentConversationId,
    setCurrentConversationId,
  };
}

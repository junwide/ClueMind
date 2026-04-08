// src/utils/conversationMapper.ts
// Bidirectional conversion between Panel Message and Backend Message types.
import { KnowledgeFramework } from '../types/framework';
import type { Message as BackendMessage, Conversation } from '../types/conversation';
import type { BackendMessageMetadata } from '../types/reactFlow';

// Panel-local message type (mirrors AIConversationPanel's internal Message)
export interface PanelMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: Date;
  pendingFramework?: KnowledgeFramework;
}

export function panelToBackend(msg: PanelMessage): BackendMessage {
  return {
    id: msg.id,
    role: msg.role === 'ai' ? 'assistant' : 'user',
    content: msg.content,
    timestamp: msg.timestamp.toISOString(),
    metadata: msg.pendingFramework
      ? { pendingFrameworkData: JSON.stringify(msg.pendingFramework) }
      : undefined,
  };
}

export function backendToPanel(msg: BackendMessage): PanelMessage {
  let pendingFramework: KnowledgeFramework | undefined;
  if (msg.metadata && 'pendingFrameworkData' in msg.metadata) {
    try {
      pendingFramework = JSON.parse(
        (msg.metadata as BackendMessageMetadata).pendingFrameworkData ?? ''
      );
    } catch {}
  }

  return {
    id: msg.id,
    role: msg.role === 'assistant' ? 'ai' : 'user',
    content: msg.content,
    timestamp: new Date(msg.timestamp),
    pendingFramework,
  };
}

export function buildConversation(
  id: string,
  frameworkId: string | null,
  panelMessages: PanelMessage[],
  provider: string,
  model: string,
  summary: string = '',
): Conversation {
  return {
    id,
    framework_id: frameworkId,
    created_at: panelMessages.length > 0
      ? panelMessages[0].timestamp.toISOString()
      : new Date().toISOString(),
    updated_at: new Date().toISOString(),
    provider,
    model,
    messages: panelMessages.map(panelToBackend),
    summary,
  };
}

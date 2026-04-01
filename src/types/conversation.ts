// src/types/conversation.ts
export interface MessageMetadata {
  frameworkId?: string;
  nodeId?: string;
  dropIds?: string[];
  pendingFrameworkData?: string;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: MessageMetadata;
}

export interface Conversation {
  id: string;
  framework_id: string | null;
  created_at: string;
  updated_at: string;
  provider: string;
  model: string;
  messages: Message[];
  summary: string;
}

export interface ConversationSummary {
  id: string;
  framework_id: string | null;
  summary: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export type ConversationStatus = 'idle' | 'generating' | 'refining' | 'error';

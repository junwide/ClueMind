// src/types/events.ts

// Drop 相关事件
export interface DropCreatedEvent {
  id: string;
  content: string;
  created_at: string;
}

export interface DropDeletedEvent {
  id: string;
}

// Framework 相关事件
export interface FrameworkUpdatedEvent {
  id: string;
  title: string;
  updated_at: string;
}

// AI 相关事件
export interface AIResponseEvent {
  type: 'framework_result' | 'node_result' | 'error';
  request_id: string;
  data?: unknown;
  error?: string;
}

// 快捷键触发事件
export interface QuickDropTriggeredEvent {
  timestamp: string;
}

// 事件名称常量
export const EventNames = {
  DROP_CREATED: 'drop-created',
  DROP_DELETED: 'drop-deleted',
  FRAMEWORK_UPDATED: 'framework-updated',
  AI_RESPONSE: 'ai-response',
  QUICK_DROP_TRIGGERED: 'quick-drop-triggered',
} as const;

// 事件映射类型
export interface EventMap {
  'drop-created': DropCreatedEvent;
  'drop-deleted': DropDeletedEvent;
  'framework-updated': FrameworkUpdatedEvent;
  'ai-response': AIResponseEvent;
  'quick-drop-triggered': QuickDropTriggeredEvent;
}

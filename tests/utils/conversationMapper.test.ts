// tests/utils/conversationMapper.test.ts
import { panelToBackend, backendToPanel, buildConversation } from '../../src/utils/conversationMapper';
import type { PanelMessage } from '../../src/utils/conversationMapper';
import type { Message as BackendMessage } from '../../src/types/conversation';

describe('panelToBackend', () => {
  it('converts role "ai" to "assistant"', () => {
    const msg: PanelMessage = {
      id: 'm1',
      role: 'ai',
      content: 'Hello',
      timestamp: new Date('2026-01-01T12:00:00Z'),
    };
    const result = panelToBackend(msg);
    expect(result.role).toBe('assistant');
  });

  it('preserves "user" role', () => {
    const msg: PanelMessage = {
      id: 'm2',
      role: 'user',
      content: 'Hi',
      timestamp: new Date('2026-01-01T12:00:00Z'),
    };
    const result = panelToBackend(msg);
    expect(result.role).toBe('user');
  });

  it('preserves content and id', () => {
    const msg: PanelMessage = {
      id: 'm3',
      role: 'user',
      content: 'My message content',
      timestamp: new Date('2026-01-01T12:00:00Z'),
    };
    const result = panelToBackend(msg);
    expect(result.id).toBe('m3');
    expect(result.content).toBe('My message content');
  });

  it('serializes timestamp to ISO string', () => {
    const date = new Date('2026-03-15T08:30:00Z');
    const msg: PanelMessage = {
      id: 'm4',
      role: 'user',
      content: 'Test',
      timestamp: date,
    };
    const result = panelToBackend(msg);
    expect(result.timestamp).toBe(date.toISOString());
  });

  it('handles pendingFramework in metadata', () => {
    const framework = {
      id: 'fw-1',
      title: 'Test Framework',
      description: '',
      structureType: 'pyramid' as const,
      nodes: [],
      edges: [],
      createdFromDrops: [],
      lifecycle: 'draft' as const,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    const msg: PanelMessage = {
      id: 'm5',
      role: 'ai',
      content: 'Created framework',
      timestamp: new Date('2026-01-01T12:00:00Z'),
      pendingFramework: framework,
    };
    const result = panelToBackend(msg);
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.pendingFrameworkData).toBeDefined();
    const parsed = JSON.parse(result.metadata!.pendingFrameworkData!);
    expect(parsed.id).toBe('fw-1');
    expect(parsed.title).toBe('Test Framework');
  });

  it('sets metadata to undefined when no pendingFramework', () => {
    const msg: PanelMessage = {
      id: 'm6',
      role: 'user',
      content: 'No framework',
      timestamp: new Date('2026-01-01T12:00:00Z'),
    };
    const result = panelToBackend(msg);
    expect(result.metadata).toBeUndefined();
  });
});

describe('backendToPanel', () => {
  it('converts role "assistant" to "ai"', () => {
    const msg: BackendMessage = {
      id: 'm1',
      role: 'assistant',
      content: 'Response',
      timestamp: '2026-01-01T12:00:00Z',
    };
    const result = backendToPanel(msg);
    expect(result.role).toBe('ai');
  });

  it('preserves "user" role', () => {
    const msg: BackendMessage = {
      id: 'm2',
      role: 'user',
      content: 'Question',
      timestamp: '2026-01-01T12:00:00Z',
    };
    const result = backendToPanel(msg);
    expect(result.role).toBe('user');
  });

  it('parses pendingFramework from metadata', () => {
    const framework = {
      id: 'fw-2',
      title: 'Parsed Framework',
      description: '',
      structureType: 'pyramid',
      nodes: [],
      edges: [],
      createdFromDrops: [],
      lifecycle: 'draft',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    const msg: BackendMessage = {
      id: 'm3',
      role: 'assistant',
      content: 'Framework created',
      timestamp: '2026-01-01T12:00:00Z',
      metadata: { pendingFrameworkData: JSON.stringify(framework) },
    };
    const result = backendToPanel(msg);
    expect(result.pendingFramework).toBeDefined();
    expect(result.pendingFramework!.id).toBe('fw-2');
    expect(result.pendingFramework!.title).toBe('Parsed Framework');
  });

  it('handles missing metadata gracefully', () => {
    const msg: BackendMessage = {
      id: 'm4',
      role: 'user',
      content: 'No metadata',
      timestamp: '2026-01-01T12:00:00Z',
    };
    const result = backendToPanel(msg);
    expect(result.pendingFramework).toBeUndefined();
    expect(result.id).toBe('m4');
    expect(result.content).toBe('No metadata');
  });

  it('handles invalid JSON in pendingFrameworkData gracefully', () => {
    const msg: BackendMessage = {
      id: 'm5',
      role: 'assistant',
      content: 'Bad JSON',
      timestamp: '2026-01-01T12:00:00Z',
      metadata: { pendingFrameworkData: '{invalid json}' },
    };
    const result = backendToPanel(msg);
    // Should not throw; pendingFramework stays undefined
    expect(result.pendingFramework).toBeUndefined();
  });

  it('parses timestamp into Date object', () => {
    const msg: BackendMessage = {
      id: 'm6',
      role: 'user',
      content: 'Time test',
      timestamp: '2026-03-15T08:30:00Z',
    };
    const result = backendToPanel(msg);
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(result.timestamp.toISOString()).toBe('2026-03-15T08:30:00.000Z');
  });
});

describe('buildConversation', () => {
  it('constructs proper Conversation object with correct field mapping', () => {
    const messages: PanelMessage[] = [
      {
        id: 'm1',
        role: 'user',
        content: 'First',
        timestamp: new Date('2026-01-01T10:00:00Z'),
      },
      {
        id: 'm2',
        role: 'ai',
        content: 'Second',
        timestamp: new Date('2026-01-01T10:01:00Z'),
      },
    ];
    const result = buildConversation('conv-1', 'fw-1', messages, 'openai', 'gpt-4o', 'Test summary');
    expect(result.id).toBe('conv-1');
    expect(result.framework_id).toBe('fw-1');
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o');
    expect(result.summary).toBe('Test summary');
    expect(result.messages).toHaveLength(2);
    // Messages should be converted via panelToBackend
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[1].role).toBe('assistant');
    expect(result.messages[0].content).toBe('First');
    expect(result.messages[1].content).toBe('Second');
  });

  it('uses first message timestamp as created_at', () => {
    const messages: PanelMessage[] = [
      {
        id: 'm1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date('2026-05-10T09:00:00Z'),
      },
    ];
    const result = buildConversation('conv-2', null, messages, 'claude', 'claude-3');
    expect(result.created_at).toBe('2026-05-10T09:00:00.000Z');
  });

  it('uses current time as created_at for empty messages', () => {
    const before = new Date().toISOString();
    const result = buildConversation('conv-3', null, [], 'glm', 'glm-4');
    const after = new Date().toISOString();
    expect(result.created_at >= before).toBe(true);
    expect(result.created_at <= after).toBe(true);
  });

  it('sets null framework_id correctly', () => {
    const result = buildConversation('conv-4', null, [], 'openai', 'gpt-4o');
    expect(result.framework_id).toBeNull();
  });

  it('defaults summary to empty string', () => {
    const result = buildConversation('conv-5', 'fw-1', [], 'openai', 'gpt-4o');
    expect(result.summary).toBe('');
  });
});

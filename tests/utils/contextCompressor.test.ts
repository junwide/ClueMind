// tests/utils/contextCompressor.test.ts
import {
  compressContext,
  buildCompressionPrompt,
  needsLLMCompression,
} from '../../src/utils/contextCompressor';

function makeMessages(count: number, contentPrefix = 'Hello'): Array<{ role: 'user' | 'ai'; content: string }> {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' as const : 'ai' as const,
    content: `${contentPrefix} ${i}`,
  }));
}

describe('compressContext', () => {
  it('returns empty compressed, method "full" for empty messages', () => {
    const result = compressContext([]);
    expect(result.compressed).toBe('');
    expect(result.method).toBe('full');
    expect(result.originalMessageCount).toBe(0);
    expect(result.estimatedTokens).toBe(0);
  });

  it('returns method "full" for short messages (<= 6)', () => {
    const msgs = makeMessages(6);
    const result = compressContext(msgs);
    expect(result.method).toBe('full');
    expect(result.originalMessageCount).toBe(6);
    expect(result.estimatedTokens).toBeGreaterThan(0);
    // Full context should contain the actual messages
    expect(result.compressed).toContain('Hello 0');
    expect(result.compressed).toContain('Hello 5');
  });

  it('returns method "extractive" for medium messages (7-12)', () => {
    const msgs = makeMessages(8);
    const result = compressContext(msgs);
    expect(result.method).toBe('extractive');
    expect(result.originalMessageCount).toBe(8);
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });

  it('returns method "llm" for long messages (> 12)', () => {
    const msgs = makeMessages(15);
    const result = compressContext(msgs);
    expect(result.method).toBe('llm');
    expect(result.originalMessageCount).toBe(15);
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });

  it('extractive compression includes recent dialogue markers', () => {
    const msgs = makeMessages(8);
    const result = compressContext(msgs);
    expect(result.compressed).toContain('最近对话');
  });

  it('extractive compression includes decision markers when present', () => {
    const msgs = [
      { role: 'ai' as const, content: 'Here is a decision ✅ approved' },
      { role: 'user' as const, content: 'OK' },
      { role: 'ai' as const, content: 'More content' },
      { role: 'user' as const, content: 'Go on' },
      { role: 'ai' as const, content: 'pendingFramework result' },
      { role: 'user' as const, content: 'Sure' },
      { role: 'ai' as const, content: 'Final' },
      { role: 'user' as const, content: 'Done' },
    ];
    const result = compressContext(msgs);
    expect(result.method).toBe('extractive');
    expect(result.compressed).toContain('历史决策');
    expect(result.compressed).toContain('decision');
  });

  it('full compression includes user/AI role labels', () => {
    const msgs = makeMessages(2);
    const result = compressContext(msgs);
    expect(result.method).toBe('full');
    expect(result.compressed).toContain('用户');
    expect(result.compressed).toContain('AI');
  });
});

describe('needsLLMCompression', () => {
  it('returns false for <= 12 messages', () => {
    expect(needsLLMCompression([])).toBe(false);
    expect(needsLLMCompression(makeMessages(1))).toBe(false);
    expect(needsLLMCompression(makeMessages(6))).toBe(false);
    expect(needsLLMCompression(makeMessages(12))).toBe(false);
  });

  it('returns true for > 12 messages', () => {
    expect(needsLLMCompression(makeMessages(13))).toBe(true);
    expect(needsLLMCompression(makeMessages(20))).toBe(true);
  });
});

describe('buildCompressionPrompt', () => {
  it('includes conversation content', () => {
    const msgs = makeMessages(5);
    const prompt = buildCompressionPrompt(msgs);
    expect(prompt).toContain('Hello 0');
    expect(prompt).toContain('Hello 4');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('includes known decisions when present', () => {
    const msgs = [
      { role: 'ai' as const, content: 'Decision ✅' },
      { role: 'user' as const, content: 'OK' },
    ];
    const prompt = buildCompressionPrompt(msgs);
    expect(prompt).toContain('已知决策');
    expect(prompt).toContain('Decision');
  });

  it('omits decisions section when no decisions exist', () => {
    const msgs = makeMessages(3);
    const prompt = buildCompressionPrompt(msgs);
    expect(prompt).not.toContain('已知决策');
  });

  it('includes compression instruction', () => {
    const msgs = makeMessages(3);
    const prompt = buildCompressionPrompt(msgs);
    expect(prompt).toContain('压缩');
    expect(prompt).toContain('对话内容');
  });
});

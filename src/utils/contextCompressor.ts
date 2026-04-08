// src/utils/contextCompressor.ts
// Intelligent context compression for long AI conversations.
// - Short conversations: keep full text
// - Medium conversations: extractive compression (decisions + recent turns)
// - Long conversations: LLM-assisted summarization

interface ConversationMessage {
  role: 'ai' | 'user' | 'assistant';
  content: string;
}

const MAX_SHORT_MESSAGES = 6; // ≤ 3 rounds: keep full
const MAX_MEDIUM_MESSAGES = 12; // 4-6 rounds: extractive
// > 12 messages: LLM compression

const MAX_CONTEXT_TOKENS = 6000;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

function extractDecisions(msgs: ConversationMessage[]): string[] {
  return msgs
    .filter(m => m.content.includes('\u2705') || m.content.includes('pendingFramework'))
    .map(m => m.content.slice(0, 150).replace(/\n/g, ' '));
}

function extractiveCompress(msgs: ConversationMessage[]): string {
  const decisions = extractDecisions(msgs);
  const recent = msgs.slice(-6);

  const parts: string[] = [];

  if (decisions.length > 0) {
    parts.push(`\u5386\u53F2\u51B3\u7B56:`);
    parts.push(...decisions.map((d, i) => `${i + 1}. ${d}`));
  }

  parts.push(`\n\u6700\u8FD1\u5BF9\u8BDD:`);
  parts.push(...recent.map(m =>
    `${m.role === 'user' ? '\u7528\u6237' : 'AI'}: ${m.content.slice(0, 300)}`
  ));

  return parts.join('\n');
}

function fullContext(msgs: ConversationMessage[]): string {
  return msgs.map(m =>
    `${m.role === 'user' ? '\u7528\u6237' : 'AI'}: ${m.content.slice(0, 200)}`
  ).join('\n');
}

export interface CompressionResult {
  compressed: string;
  method: 'full' | 'extractive' | 'llm';
  originalMessageCount: number;
  estimatedTokens: number;
}

/**
 * Compress conversation context based on length.
 * Returns the compressed text and metadata about the compression method.
 */
export function compressContext(msgs: ConversationMessage[]): CompressionResult {
  if (msgs.length === 0) {
    return { compressed: '', method: 'full', originalMessageCount: 0, estimatedTokens: 0 };
  }

  // Short: keep full context
  const full = fullContext(msgs);
  if (msgs.length <= MAX_SHORT_MESSAGES && estimateTokens(full) <= MAX_CONTEXT_TOKENS) {
    return {
      compressed: full,
      method: 'full',
      originalMessageCount: msgs.length,
      estimatedTokens: estimateTokens(full),
    };
  }

  // Medium: extractive compression
  const extracted = extractiveCompress(msgs);
  if (msgs.length <= MAX_MEDIUM_MESSAGES) {
    return {
      compressed: extracted,
      method: 'extractive',
      originalMessageCount: msgs.length,
      estimatedTokens: estimateTokens(extracted),
    };
  }

  // Long: mark for LLM compression (caller must handle the async part)
  // We return extractive as a fallback; the caller should replace with LLM result
  return {
    compressed: extracted,
    method: 'llm', // signals that LLM compression should be used
    originalMessageCount: msgs.length,
    estimatedTokens: estimateTokens(extracted),
  };
}

/**
 * Build the LLM instruction for context summarization.
 * The caller passes this to the AI, which returns a compressed summary.
 */
export function buildCompressionPrompt(msgs: ConversationMessage[]): string {
  const decisions = extractDecisions(msgs);
  const conversation = msgs.map(m =>
    `${m.role === 'user' ? '\u7528\u6237' : 'AI'}: ${m.content.slice(0, 200)}`
  ).join('\n');

  return `\u8BF7\u5C06\u4EE5\u4E0B\u5BF9\u8BDD\u5386\u53F2\u538B\u7F29\u4E3A 200 \u5B57\u4EE5\u5185\u7684\u6458\u8981\uFF0C\u4FDD\u7559\u5173\u952E\u51B3\u7B56\u548C\u6846\u67B6\u53D8\u66F4\uFF0C\u53BB\u9664\u95F2\u804A\u5185\u5BB9\uFF1A\n\n${decisions.length > 0 ? `\u5DF2\u77E5\u51B3\u7B56:\n${decisions.join('\n')}\n\n` : ''}\u5BF9\u8BDD\u5185\u5BB9:\n${conversation}`;
}

/**
 * Check if LLM compression is needed for the given messages.
 */
export function needsLLMCompression(msgs: ConversationMessage[]): boolean {
  return msgs.length > MAX_MEDIUM_MESSAGES;
}

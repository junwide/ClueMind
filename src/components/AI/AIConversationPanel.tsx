// src/components/AI/AIConversationPanel.tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { KnowledgeFramework } from '../../types/framework';
import { useAIChat } from '../../hooks/useAIChat';
import { formatProposalSummary } from '../../utils/frameworkFormatters';
import { backendToPanel, buildConversation } from '../../utils/conversationMapper';
import type { Conversation } from '../../types/conversation';
import { useTranslation } from '../../i18n';

interface Message {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: Date;
  pendingFramework?: KnowledgeFramework;
}

interface AIConversationPanelProps {
  framework: KnowledgeFramework | null;
  onFrameworkUpdate: (framework: KnowledgeFramework) => void;
  onClose?: () => void;
  onAddDrops?: () => void;
  conversationId?: string | null;
  onConversationCreated?: (id: string) => void;
  pendingReanalysis?: { newDrops: Array<{ id: string; content: string }> } | null;
}

// --- Context compression helpers ---

const MAX_CONTEXT_TOKENS = 6000; // Leave room for AI response within typical 8k context

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2); // Chinese ~2 chars/token, English ~4 chars/token
}

function compressContext(msgs: Message[]): string {
  if (msgs.length === 0) return '';

  // Preserve decision log: messages that were applied (contain checkmark or pendingFramework)
  const decisions = msgs
    .filter(m => m.content.includes('\u2705') || m.pendingFramework)
    .map(m => `\u51B3\u7B56: ${m.content.slice(0, 150).replace(/\n/g, ' ')}`)
    .join('\n');

  // Keep last 6 messages (3 rounds)
  const recent = msgs.slice(-6);
  const recentStr = recent.map(m =>
    `${m.role === 'user' ? '\u7528\u6237' : 'AI'}: ${m.content.slice(0, 300)}`
  ).join('\n');

  // Full context for short conversations
  const fullContext = msgs.map(m =>
    `${m.role === 'user' ? '\u7528\u6237' : 'AI'}: ${m.content.slice(0, 200)}`
  ).join('\n');

  if (estimateTokens(fullContext) <= MAX_CONTEXT_TOKENS) {
    return fullContext;
  }

  // Compressed format: decisions + recent
  const parts: string[] = [];
  if (decisions) parts.push(`\u5386\u53F2\u51B3\u7B56:\n${decisions}`);
  parts.push(`\u6700\u8FD1\u5BF9\u8BDD:\n${recentStr}`);
  return parts.join('\n\n');
}

export function AIConversationPanel({
  framework,
  onFrameworkUpdate,
  onClose,
  onAddDrops,
  conversationId: externalConversationId,
  onConversationCreated,
  pendingReanalysis,
}: AIConversationPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [convId, setConvId] = useState<string | null>(externalConversationId || null);
  const [summary, setSummary] = useState<string>('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);
  const nextId = () => {
    // Use timestamp + counter to guarantee uniqueness even across async boundaries
    return `msg-${Date.now()}-${++idCounter.current}`;
  };
  const initializedFrameworkId = useRef<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const { status, displayText, lastResponseTextRef, keysLoading, refineFramework, summarizeConversation, generateGuidanceQuestions } = useAIChat({});
  const { t } = useTranslation();

  // --- Merge helpers (reused across the component) ---

  const buildMergedNodes = useCallback((aiFramework: any, currentFramework: KnowledgeFramework): KnowledgeFramework['nodes'] => {
    const aiNodeIds = new Set(aiFramework.nodes.map((n: any) => n.id));
    const mergedNodes: KnowledgeFramework['nodes'] = aiFramework.nodes.map((n: any) => {
      const existingNode = currentFramework.nodes.find(fn => fn.id === n.id);
      return {
        id: n.id,
        label: n.label,
        content: n.content,
        level: n.level,
        state: existingNode?.state || (n.state || 'virtual') as 'virtual' | 'confirmed' | 'locked',
        metadata: {
          createdBy: existingNode?.metadata?.createdBy || 'ai',
          source: (n as any).source || existingNode?.metadata?.source || '',
          reasoning: (n as any).reasoning || existingNode?.metadata?.reasoning || '',
          aiExplanation: existingNode?.metadata?.aiExplanation,
        },
      };
    });
    // Restore locked nodes that AI removed
    for (const lockedNode of currentFramework.nodes.filter(n => n.state === 'locked')) {
      if (!aiNodeIds.has(lockedNode.id)) {
        mergedNodes.push(lockedNode);
      }
    }
    return mergedNodes;
  }, []);

  const buildMergedEdges = useCallback((aiFramework: any, currentFramework: KnowledgeFramework): KnowledgeFramework['edges'] => {
    const aiEdgeIds = new Set(aiFramework.edges.map((e: any) => e.id));
    const mergedEdges: KnowledgeFramework['edges'] = aiFramework.edges.map((e: any) => {
      const existingEdge = currentFramework.edges.find(fe => fe.id === e.id);
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        relationship: e.relationship,
        state: existingEdge?.state || ((e as any).state || 'virtual') as 'virtual' | 'confirmed' | 'locked',
      };
    });
    // Restore locked edges that AI removed
    for (const lockedEdge of currentFramework.edges.filter(e => e.state === 'locked')) {
      if (!aiEdgeIds.has(lockedEdge.id)) {
        mergedEdges.push(lockedEdge);
      }
    }
    return mergedEdges;
  }, []);

  // --- Persist conversation to backend ---

  const persistConversation = useCallback(async (msgs: Message[]) => {
    if (!framework || msgs.length === 0) return;
    try {
      let id = convId;
      if (!id) {
        id = `conv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setConvId(id);
        onConversationCreated?.(id);
      }
      const conv = buildConversation(id, framework.id, msgs, '', '', summary);
      await invoke('save_conversation', { conversation: conv });
    } catch (err) {
      console.error('Failed to persist conversation:', err);
    }
  }, [framework, convId, summary, onConversationCreated]);

  // Auto-save messages when they change
  useEffect(() => {
    if (messages.length > 0) {
      persistConversation(messages);
    }
  }, [messages, persistConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- Auto-continue after Apply: trigger next discussion point ---

  const autoContinueDiscussion = useCallback(async (currentFramework: KnowledgeFramework) => {
    try {
      const instruction = `用户已接受上次的框架变更。请基于当前框架状态，继续分析并指出下一个值得讨论的方向。如果框架已经足够完善，请说明并建议结束复盘。`;
      const response = await refineFramework(currentFramework, instruction);
      if (response?.frameworks?.[0]) {
        const aiFramework = response.frameworks[0];
        const nodeCountDiff = Math.abs(aiFramework.nodes.length - currentFramework.nodes.length);
        const hasRealChanges = nodeCountDiff > 0 || aiFramework.title !== currentFramework.title;
        if (hasRealChanges) {
          const mergedNodes = buildMergedNodes(aiFramework, currentFramework);
          const mergedEdges = buildMergedEdges(aiFramework, currentFramework);
          const proposedFramework: KnowledgeFramework = {
            ...currentFramework,
            title: aiFramework.title || currentFramework.title,
            description: aiFramework.description || currentFramework.description,
            nodes: mergedNodes,
            edges: mergedEdges,
            updatedAt: new Date().toISOString(),
          };
          const summaryText = formatProposalSummary(currentFramework, proposedFramework);
          const reasoningText = (response as any)?.raw_text || lastResponseTextRef.current || '';
          const displayContent = reasoningText
            ? `${reasoningText}\n\n---\n\n${summaryText}\n\n${t('conversation.applyChangesOrContinue')}`
            : `${summaryText}\n\n${t('conversation.applyChangesOrContinue')}`;
          setMessages(prev => [...prev, {
            id: nextId(),
            role: 'ai',
            content: displayContent,
            timestamp: new Date(),
            pendingFramework: proposedFramework,
          }]);
        } else {
          const discussionText = (response as any)?.raw_text || lastResponseTextRef.current || t('conversation.requestProcessed');
          setMessages(prev => [...prev, {
            id: nextId(),
            role: 'ai',
            content: discussionText,
            timestamp: new Date(),
          }]);
        }
      } else {
        const discussionText = (response as any)?.raw_text || lastResponseTextRef.current || t('conversation.requestProcessed');
        setMessages(prev => [...prev, {
          id: nextId(),
          role: 'ai',
          content: discussionText,
          timestamp: new Date(),
        }]);
      }
    } catch {
      // Silently fail — user can still continue manually
    }
  }, [refineFramework, buildMergedNodes, buildMergedEdges]);

  // --- Apply a pending framework proposal ---

  const handleApplyFramework = useCallback((msg: Message) => {
    if (!msg.pendingFramework) return;
    const frameworkWithExplanations = {
      ...msg.pendingFramework,
      nodes: msg.pendingFramework.nodes.map(node => ({
        ...node,
        metadata: {
          ...node.metadata,
          aiExplanation: node.content,
          source: node.metadata?.source || '',
          reasoning: node.metadata?.reasoning || '',
        },
      })),
    };
    onFrameworkUpdate(frameworkWithExplanations);
    setMessages(prev => prev.map(m =>
      m.id === msg.id
        ? { ...m, pendingFramework: undefined, content: m.content + '\n\n\u2705 Changes applied!' }
        : m
    ));
    // Auto-continue: trigger next discussion point
    autoContinueDiscussion(frameworkWithExplanations);
  }, [onFrameworkUpdate, autoContinueDiscussion]);

  // --- Initialize conversation — load history or start fresh ---

  useEffect(() => {
    if (!framework || keysLoading) return;

    // Skip if already initialized for this framework
    if (initializedFrameworkId.current === framework.id) return;
    initializedFrameworkId.current = framework.id;
    setInitializing(true);

    // If we have an external conversation ID, try loading history
    if (externalConversationId && !historyLoaded) {
      setHistoryLoaded(true);
      invoke<Conversation>('load_conversation', { id: externalConversationId })
        .then((conv) => {
          if (conv.messages && conv.messages.length > 0) {
            const loaded = conv.messages.map(backendToPanel);
            setMessages(loaded);
            // Advance ID counter past loaded message IDs to prevent collisions
            const maxIdNum = loaded.reduce((max, m) => {
              const num = parseInt(m.id.replace('msg-', ''), 10);
              return !isNaN(num) && num > max ? num : max;
            }, 0);
            idCounter.current = Math.max(idCounter.current, maxIdNum);
            if (conv.summary) setSummary(conv.summary);
          }
        })
        .catch((err) => {
          console.error('Failed to load conversation history:', err);
        })
        .finally(() => setInitializing(false));
      return;
    }

    // Only initialize if no external ID
    if (!externalConversationId) {
      (async () => {
        try {
          // Load source drops for context
          let drops: Array<{ id: string; content: string }> | undefined;
          if (framework.createdFromDrops.length > 0) {
            const dropResults = await Promise.all(
              framework.createdFromDrops.map(id =>
                invoke<{ id: string; content: { type: string; text?: string; url?: string } } | null>('get_drop', { id })
                  .then(d => d ? { id: d.id, content: d.content?.text || d.content?.url || '' } : null)
                  .catch(() => null)
              )
            );
            drops = dropResults.filter((d): d is { id: string; content: string } => d !== null && d.content.length > 0);
          }

          // Build context for AI initial analysis
          const dropsInfo = drops ? drops.map(d => `[${d.id}] ${d.content}`).join('\n') : '';
          const frameworkInfo = JSON.stringify({
            title: framework.title,
            description: framework.description,
            structureType: framework.structureType,
            nodeCount: framework.nodes.length,
            edgeCount: framework.edges.length,
            nodeLabels: framework.nodes.map(n => n.label),
          });

          const instruction = `\u8BF7\u5206\u6790\u4EE5\u4E0B\u7D20\u6750\u548C\u5F53\u524D\u6846\u67B6\uFF0C\u7ED9\u6211\u4E00\u4E2A\u7B80\u6D01\u7684\u5206\u6790\u6982\u89C8\uFF0C\u5E76\u63D0\u51FA 2 \u4E2A\u503C\u5F97\u6DF1\u5165\u8BA8\u8BBA\u7684\u65B9\u5411\u3002\u6682\u65F6\u4E0D\u8981\u4FEE\u6539\u6846\u67B6\uFF0C\u53EA\u505A\u5206\u6790\u3002\n\n\u5F53\u524D\u6846\u67B6\uFF1A${frameworkInfo}\n\n\u76F8\u5173\u7D20\u6750\uFF1A\n${dropsInfo || '\uFF08\u65E0\u76F4\u63A5\u7D20\u6750\uFF09'}`;

          // Call AI for initial analysis (discussion-type, no framework changes)
          const response = await refineFramework(framework, instruction);
          if (response && response.frameworks && response.frameworks[0]) {
            const aiFramework = response.frameworks[0];
            // Check if AI actually proposed changes (execution-type)
            const nodeCountDiff = Math.abs(aiFramework.nodes.length - framework.nodes.length);
            const hasRealChanges = nodeCountDiff > 0 || aiFramework.title !== framework.title;

            if (hasRealChanges) {
              // Execution-type: AI wants to make changes
              const mergedNodes = buildMergedNodes(aiFramework, framework);
              const mergedEdges = buildMergedEdges(aiFramework, framework);
              const proposedFramework: KnowledgeFramework = {
                ...framework,
                title: aiFramework.title || framework.title,
                description: aiFramework.description || framework.description,
                nodes: mergedNodes,
                edges: mergedEdges,
                updatedAt: new Date().toISOString(),
              };
              const summaryText = formatProposalSummary(framework, proposedFramework);
              setMessages(prev => [...prev, {
                id: nextId(),
                role: 'ai',
                content: `${summaryText}\n\n${t('conversation.applyChangesOrContinue')}`,
                timestamp: new Date(),
                pendingFramework: proposedFramework,
              }]);
            } else {
              // Discussion-type: just analysis text from the AI
              // Try to get discussion points via guidance questions as a fallback
              const dropsJson = JSON.stringify(drops || []);
              let discussionPoints: string[] = [];
              try {
                discussionPoints = await generateGuidanceQuestions(frameworkInfo, dropsJson, 'initial');
              } catch {
                // Use fallback
              }

              if (discussionPoints.length > 0) {
                setMessages(prev => [...prev, {
                  id: nextId(),
                  role: 'ai',
                  content: discussionPoints.join('\n\n'),
                  timestamp: new Date(),
                }]);
              }
            }
          } else {
            // Discussion-type: no frameworks returned (AI responded with natural language only)
            const discussionText = (response as any)?.raw_text || lastResponseTextRef.current || t('conversation.requestProcessed');
            setMessages(prev => [...prev, {
              id: nextId(),
              role: 'ai',
              content: discussionText,
              timestamp: new Date(),
            }]);
          }
        } catch (err) {
          console.error('Failed to initialize conversation:', err);
          setMessages(prev => prev.length === 0 ? [{
            id: nextId(),
            role: 'ai',
            content: t('conversation.requestFailed', { error: err instanceof Error ? err.message : String(err) }),
            timestamp: new Date(),
          }] : prev);
        } finally {
          setInitializing(false);
        }
      })();
    }
  }, [framework, keysLoading]);

  // --- Trigger reanalysis when pendingReanalysis is set ---

  useEffect(() => {
    if (!pendingReanalysis || !framework) return;
    const { newDrops } = pendingReanalysis;
    if (newDrops.length === 0) return;

    const dropsInfo = newDrops.map(d => `[${d.id}] ${d.content}`).join('\n');

    // Build context about existing locked/confirmed nodes and edges
    const lockedNodes = framework.nodes.filter(n => n.state === 'locked');
    const confirmedNodes = framework.nodes.filter(n => n.state === 'confirmed');
    const lockedEdges = framework.edges.filter(e => e.state === 'locked');
    const confirmedEdges = framework.edges.filter(e => e.state === 'confirmed');

    let contextInfo = '';
    if (lockedNodes.length > 0 || confirmedNodes.length > 0) {
      contextInfo += `\n\n\u5F53\u524D\u6846\u67B6\u72B6\u6001\uFF1A\n`;
      if (lockedNodes.length > 0) {
        contextInfo += `- \u9501\u5B9A\u8282\u70B9\uFF08\u4E0D\u53EF\u4FEE\u6539\uFF09: ${lockedNodes.map(n => `"${n.label}"`).join(', ')}\n`;
      }
      if (confirmedNodes.length > 0) {
        contextInfo += `- \u5DF2\u786E\u8BA4\u8282\u70B9: ${confirmedNodes.map(n => `"${n.label}"`).join(', ')}\n`;
      }
      if (lockedEdges.length > 0) {
        contextInfo += `- \u9501\u5B9A\u5173\u8054\uFF08\u4E0D\u53EF\u4FEE\u6539\uFF09: ${lockedEdges.length} \u6761\n`;
      }
      if (confirmedEdges.length > 0) {
        contextInfo += `- \u5DF2\u786E\u8BA4\u5173\u8054: ${confirmedEdges.length} \u6761\n`;
      }
      contextInfo += `\n\u8BF7\u4FDD\u7559\u6240\u6709\u9501\u5B9A\u8282\u70B9\u548C\u5173\u8054\uFF0C\u65B0\u589E\u8282\u70B9\u5E94\u5C1D\u8BD5\u4E0E\u5DF2\u6709\u8282\u70B9\u5EFA\u7ACB\u5173\u8054\u3002`;
    }

    const instruction = `\u8BF7\u7ED3\u5408\u4EE5\u4E0B\u65B0\u589E\u7D20\u6750\u91CD\u65B0\u5BA1\u89C6\u5F53\u524D\u6846\u67B6\uFF0C\u770B\u662F\u5426\u9700\u8981\u6DFB\u52A0\u65B0\u8282\u70B9\u6216\u4FEE\u6539\u5173\u8054\uFF1A\n\n${dropsInfo}${contextInfo}`;

    // Add a system message about new drops
    setMessages(prev => [...prev, {
      id: nextId(),
      role: 'ai' as const,
      content: t('conversation.newDropsAdded', { count: String(newDrops.length) }),
      timestamp: new Date(),
    }]);

    // Send as a synthetic user message to trigger AI refinement
    (async () => {
      try {
        const response = await refineFramework(framework, instruction);
        if (response && response.frameworks && response.frameworks[0]) {
          const aiFramework = response.frameworks[0];
          const mergedNodes = buildMergedNodes(aiFramework, framework);
          const mergedEdges = buildMergedEdges(aiFramework, framework);

          const proposedFramework: KnowledgeFramework = {
            ...framework,
            title: aiFramework.title || framework.title,
            description: aiFramework.description || framework.description,
            nodes: mergedNodes,
            edges: mergedEdges,
            updatedAt: new Date().toISOString(),
          };

          const summaryText = formatProposalSummary(framework, proposedFramework);
          setMessages(prev => [...prev, {
            id: nextId(),
            role: 'ai',
            content: `${t('conversation.reanalysisComplete')}\n\n${summaryText}\n\n${t('conversation.applyChanges')}`,
            timestamp: new Date(),
            pendingFramework: proposedFramework,
          }]);
        }
      } catch (err) {
        setMessages(prev => [...prev, {
          id: nextId(),
          role: 'ai',
          content: t('conversation.reanalysisFailed', { error: err instanceof Error ? err.message : String(err) }),
          timestamp: new Date(),
        }]);
      }
    })();
  }, [pendingReanalysis, framework, refineFramework, buildMergedNodes, buildMergedEdges]);

  // --- Send message: all messages go through AI ---

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || !framework) return;

    const userMessage: Message = {
      id: nextId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue.trim();
    setInputValue('');

    try {
      // Build context with compression for long conversations
      const allMessages = messages;
      const contextStr = compressContext(allMessages);
      const instruction = `${contextStr ? `\u5BF9\u8BDD\u5386\u53F2:\n${contextStr}\n\n` : ''}\u7528\u6237\u6700\u65B0\u56DE\u590D: ${currentInput}`;

      const response = await refineFramework(framework, instruction);

      if (response && response.frameworks && response.frameworks[0]) {
        const aiFramework = response.frameworks[0];

        // Check if there are real changes (execution-type)
        const nodeCountDiff = Math.abs(aiFramework.nodes.length - framework.nodes.length);
        const hasRealChanges = nodeCountDiff > 0 || aiFramework.title !== framework.title;

        if (hasRealChanges) {
          // Execution-type: show AI reasoning + structured summary + Apply button
          const mergedNodes = buildMergedNodes(aiFramework, framework);
          const mergedEdges = buildMergedEdges(aiFramework, framework);
          const proposedFramework: KnowledgeFramework = {
            ...framework,
            title: aiFramework.title || framework.title,
            description: aiFramework.description || framework.description,
            nodes: mergedNodes,
            edges: mergedEdges,
            updatedAt: new Date().toISOString(),
          };
          const summaryText = formatProposalSummary(framework, proposedFramework);
          const reasoningText = (response as any)?.raw_text || lastResponseTextRef.current || '';
          const displayContent = reasoningText
            ? `${reasoningText}\n\n---\n\n${summaryText}\n\n${t('conversation.applyChangesOrContinue')}`
            : `${summaryText}\n\n${t('conversation.applyChangesOrContinue')}`;
          setMessages(prev => [...prev, {
            id: nextId(),
            role: 'ai',
            content: displayContent,
            timestamp: new Date(),
            pendingFramework: proposedFramework,
          }]);
        } else {
          // Discussion-type: no framework changes needed, use raw_text from response
          const discussionText = (response as any)?.raw_text || lastResponseTextRef.current || t('conversation.requestProcessed');
          setMessages(prev => [...prev, {
            id: nextId(),
            role: 'ai',
            content: discussionText,
            timestamp: new Date(),
          }]);
        }
      } else {
        // Discussion-type: no frameworks in response, use raw_text from response
        const discussionText = (response as any)?.raw_text || lastResponseTextRef.current || t('conversation.requestProcessed');
        setMessages(prev => [...prev, {
          id: nextId(),
          role: 'ai',
          content: discussionText,
          timestamp: new Date(),
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: nextId(),
        role: 'ai',
        content: t('conversation.requestFailed', { error: err instanceof Error ? err.message : String(err) || t('conversation.requestFailedDefault') }),
        timestamp: new Date(),
      }]);
    }
  }, [inputValue, framework, messages, refineFramework, buildMergedNodes, buildMergedEdges]);

  // --- Finish and save framework ---

  const handleFinish = useCallback(async () => {
    if (!framework || isFinishing) return;

    setIsFinishing(true);

    // Show immediate feedback
    setMessages(prev => [...prev, {
      id: nextId(),
      role: 'ai',
      content: t('conversation.savingSummary'),
      timestamp: new Date(),
    }]);

    const finalizedFramework: KnowledgeFramework = {
      ...framework,
      lifecycle: 'confirmed',
      nodes: framework.nodes.map(node => ({
        ...node,
        state: (node.state === 'confirmed' ? 'locked' : node.state) as 'virtual' | 'confirmed' | 'locked',
      })),
      updatedAt: new Date().toISOString(),
    };

    try {
      await invoke('save_framework', { framework: finalizedFramework });
      onFrameworkUpdate(finalizedFramework);

      // Generate summary
      const frameworkSummary = `\u6846\u67B6: ${finalizedFramework.title}\n\u8282\u70B9(${finalizedFramework.nodes.length}): ${finalizedFramework.nodes.map(n => n.label).join(', ')}\n\u5173\u8054(${finalizedFramework.edges.length})`;
      const convMessages = messages.map(m => ({ role: m.role === 'ai' ? 'assistant' as const : m.role as 'user', content: m.content }));
      let summaryText = '';
      try {
        summaryText = await summarizeConversation(convMessages, frameworkSummary);
        if (summaryText) {
          setSummary(summaryText);
        }
      } catch {}

      // Parse title and summary from AI response
      let aiTitle = finalizedFramework.title;
      let displaySummary = summaryText;

      if (summaryText) {
        const separatorIndex = summaryText.indexOf('\n---\n');
        if (separatorIndex !== -1) {
          const titleLine = summaryText.slice(0, separatorIndex).trim();
          const rest = summaryText.slice(separatorIndex + 5).trim();
          const titleMatch = titleLine.match(/^TITLE:\s*(.+)$/i);
          aiTitle = titleMatch ? titleMatch[1].trim().slice(0, 20) : titleLine.slice(0, 20);
          displaySummary = rest;
          setSummary(rest);
        } else {
          aiTitle = summaryText.replace(/\n/g, ' ').trim().slice(0, 20);
        }
      }

      const titledFramework = { ...finalizedFramework, title: aiTitle };
      if (summaryText) {
        onFrameworkUpdate(titledFramework);
        await invoke('save_framework', { framework: titledFramework });
      }

      setMessages(prev => [...prev, {
        id: nextId(),
        role: 'ai',
        content: `${t('conversation.frameworkSaved')}\n\n${t('conversation.frameworkSavedDetail', { nodes: String(finalizedFramework.nodes.length), edges: String(finalizedFramework.edges.length) })}\n\n${t('conversation.dropsSource', { count: String(framework.createdFromDrops.length) })}\n\n${displaySummary ? `${t('conversation.summaryLabel.short', { summary: displaySummary })}\n\n` : ''}${t('conversation.postSaveOptions')}`,
        timestamp: new Date(),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: nextId(),
        role: 'ai',
        content: t('conversation.saveFailed', { error: String(err) }),
        timestamp: new Date(),
      }]);
    } finally {
      setIsFinishing(false);
    }
  }, [framework, onFrameworkUpdate, messages, summarizeConversation, isFinishing]);

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl">{'\uD83E\uDD16'}</span>
          <h2 className="font-medium">{t('conversation.headerTitle')}</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            {'\u2715'}
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Show conversation summary if available */}
        {summary && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-sm">{'\uD83D\uDCCB'}</span>
              <span className="text-xs font-medium text-yellow-700">{t('conversation.summaryLabel')}</span>
            </div>
            <p className="text-sm text-yellow-800">{summary}</p>
          </div>
        )}
        {messages.length === 0 && status !== 'loading' ? (
          <div className="text-center text-gray-400 py-8">
            {initializing ? (t('conversation.loadingFramework') || 'Loading...') : (t('conversation.noMessages') || 'No messages yet')}
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                <span className="text-xs opacity-60 mt-1 block">
                  {msg.timestamp.toLocaleTimeString()}
                </span>
                {msg.pendingFramework && (
                  <button
                    onClick={() => handleApplyFramework(msg)}
                    className="mt-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                  >
                    {'\u2713'} Apply Changes
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        {status === 'loading' && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3 max-w-[85%]">
              {displayText ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{displayText}</p>
              ) : (
                <span className="animate-pulse">AI is thinking...</span>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions — simplified: only Add Drops */}
      <div className="px-4 py-2 border-t border-gray-100">
        <div className="flex gap-2 flex-wrap">
          {onAddDrops && (
            <button
              onClick={onAddDrops}
              className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200"
              disabled={status === 'loading' || isFinishing}
            >
              {t('conversation.addDropsBtn')}
            </button>
          )}
        </div>
      </div>

      {/* Finish & Save area */}
      {framework && (
        <div className="px-4 py-3 border-t border-gray-200 bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">{t('conversation.finishReview')}</p>
              <p className="text-xs text-green-600">
                {t('conversation.nodesConfirmedCount', {
                  confirmed: String(framework.nodes.filter(n => n.state === 'confirmed' || n.state === 'locked').length),
                  total: String(framework.nodes.length),
                })}
                {framework.createdFromDrops.length > 0 && ` \u00B7 ${t('conversation.dropsCount', { count: String(framework.createdFromDrops.length) })}`}
              </p>
            </div>
            <button
              onClick={handleFinish}
              disabled={isFinishing}
              className={`px-4 py-2 text-white rounded-lg text-sm font-medium ${
                isFinishing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isFinishing ? t('conversation.processing') : t('conversation.finishBtn')}
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={t('conversation.placeholder.refining')}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={status === 'loading' || isFinishing}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || status === 'loading'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {t('conversation.send')}
          </button>
        </div>
      </div>
    </div>
  );
}

// src/components/AI/AIConversationPanel.tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { KnowledgeFramework, FrameworkNode } from '../../types/framework';
import { useAIChat } from '../../hooks/useAIChat';
import { formatProposalSummary } from '../../utils/frameworkFormatters';
import { generateInitialGuidance, generateFollowUpQuestions } from '../../utils/guidedQuestions';
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

interface ConversationRound {
  questions: string[];
  answerCount: number;
}

interface ConversationState {
  phase: 'guiding' | 'refining';
  currentRound: ConversationRound | null;
  allRounds: ConversationRound[];
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
  const [conversationState, setConversationState] = useState<ConversationState>({
    phase: 'guiding',
    currentRound: null,
    allRounds: [],
  });
  const [convId, setConvId] = useState<string | null>(externalConversationId || null);
  const [summary, setSummary] = useState<string>('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);
  const nextId = () => `msg-${++idCounter.current}`;
  const thinkingIdRef = useRef<string | null>(null);
  const initDone = useRef(false);

  const { status, error, refineFramework, summarizeConversation } = useAIChat({});
  const { t } = useTranslation();

  // Persist conversation to backend
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

  // Trigger reanalysis when pendingReanalysis is set
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
      contextInfo += `\n\n当前框架状态：\n`;
      if (lockedNodes.length > 0) {
        contextInfo += `- 锁定节点（不可修改）: ${lockedNodes.map(n => `"${n.label}"`).join(', ')}\n`;
      }
      if (confirmedNodes.length > 0) {
        contextInfo += `- 已确认节点: ${confirmedNodes.map(n => `"${n.label}"`).join(', ')}\n`;
      }
      if (lockedEdges.length > 0) {
        contextInfo += `- 锁定关联（不可修改）: ${lockedEdges.length} 条\n`;
      }
      if (confirmedEdges.length > 0) {
        contextInfo += `- 已确认关联: ${confirmedEdges.length} 条\n`;
      }
      contextInfo += `\n请保留所有锁定节点和关联，新增节点应尝试与已有节点建立关联。`;
    }

    const instruction = `请结合以下新增素材重新审视当前框架，看是否需要添加新节点或修改关联：\n\n${dropsInfo}${contextInfo}`;

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

          // Build proposed framework with merge logic to protect locked nodes/edges
          const aiNodeIds = new Set(aiFramework.nodes.map(n => n.id));
          const aiEdgeIds = new Set(aiFramework.edges.map(e => e.id));

          // Start with AI-proposed nodes
          const mergedNodes: KnowledgeFramework['nodes'] = aiFramework.nodes.map(n => {
            const existingNode = framework.nodes.find(fn => fn.id === n.id);
            return {
              id: n.id,
              label: n.label,
              content: n.content,
              level: n.level,
              // Preserve locked/confirmed state for existing nodes; new nodes get 'virtual'
              state: existingNode?.state || (n.state || 'virtual') as 'virtual' | 'confirmed' | 'locked',
              metadata: {
                createdBy: existingNode?.metadata?.createdBy || 'ai',
                source: (n as any).source || existingNode?.metadata?.source || '',
                reasoning: (n as any).reasoning || existingNode?.metadata?.reasoning || '',
              },
            };
          });

          // Restore any locked nodes that AI removed
          for (const lockedNode of framework.nodes.filter(n => n.state === 'locked')) {
            if (!aiNodeIds.has(lockedNode.id)) {
              mergedNodes.push(lockedNode);
            }
          }

          // Start with AI-proposed edges
          const mergedEdges: KnowledgeFramework['edges'] = aiFramework.edges.map(e => {
            const existingEdge = framework.edges.find(fe => fe.id === e.id);
            return {
              id: e.id,
              source: e.source,
              target: e.target,
              relationship: e.relationship,
              // Preserve locked/confirmed state for existing edges
              state: existingEdge?.state || ((e as any).state || 'virtual') as 'virtual' | 'confirmed' | 'locked',
            };
          });

          // Restore any locked edges that AI removed
          for (const lockedEdge of framework.edges.filter(e => e.state === 'locked')) {
            if (!aiEdgeIds.has(lockedEdge.id)) {
              mergedEdges.push(lockedEdge);
            }
          }

          const proposedFramework: KnowledgeFramework = {
            ...framework,
            title: aiFramework.title || framework.title,
            description: aiFramework.description || framework.description,
            nodes: mergedNodes,
            edges: mergedEdges,
            updatedAt: new Date().toISOString(),
          };

          const summary = formatProposalSummary(framework, proposedFramework);
          setMessages(prev => [...prev, {
            id: nextId(),
            role: 'ai',
            content: `${t('conversation.reanalysisComplete')}\n\n${summary}\n\n${t('conversation.applyChanges')}`,
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
  }, [pendingReanalysis, framework, refineFramework]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize conversation — load history or start fresh
  useEffect(() => {
    if (!framework) return;

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
            // Skip guiding phase for restored conversations
            setConversationState(prev => ({ ...prev, phase: 'refining', currentRound: null }));
          }
        })
        .catch((err) => {
          console.error('Failed to load conversation history:', err);
        });
      return;
    }

    // Only initialize if no external ID and no messages yet
    if (!externalConversationId && !initDone.current) {
      initDone.current = true;
      const timer = setTimeout(() => {
        // Fetch drop content for material-oriented guidance
        (async () => {
          let drops: Array<{ id: string; content: string }> | undefined;
          if (framework.createdFromDrops.length > 0) {
            try {
              const dropResults = await Promise.all(
                framework.createdFromDrops.map(id =>
                  invoke<{ id: string; content: { type: string; text?: string; url?: string } } | null>('get_drop', { id })
                    .then(d => d ? { id: d.id, content: d.content?.text || d.content?.url || '' } : null)
                    .catch(() => null)
                )
              );
              drops = dropResults.filter((d): d is { id: string; content: string } => d !== null && d.content.length > 0);
            } catch {}
          }

          const { structureDescription, guidingQuestions } = generateInitialGuidance(framework, 3, drops);
          const firstQuestion = guidingQuestions[0];

          const round: ConversationRound = {
            questions: guidingQuestions,
            answerCount: 0,
          };

          setConversationState({
            phase: 'guiding',
            currentRound: round,
            allRounds: [round],
          });

          setMessages([{
            id: nextId(),
            role: 'ai',
            content: `${t('conversation.greeting')} ${t('conversation.greetingWithFramework', { title: framework.title })}\n\n${structureDescription}\n\n${t('conversation.guidingIntro')}\n\n${firstQuestion}\n\n${t('conversation.questionProgress', { current: '1', total: String(guidingQuestions.length) })}`,
            timestamp: new Date(),
          }]);
        })();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [framework]);

  // Advance to next question or next round
  const advanceGuiding = useCallback((currentFramework: KnowledgeFramework) => {
    setConversationState(prev => {
      if (!prev.currentRound) return prev;

      const newAnswerCount = prev.currentRound.answerCount + 1;
      const allAnswered = newAnswerCount >= prev.currentRound.questions.length;

      if (!allAnswered) {
        // Show next question in this round
        const nextQ = prev.currentRound.questions[newAnswerCount];
        setTimeout(() => {
          setMessages(msgs => [...msgs, {
            id: nextId(),
            role: 'ai' as const,
            content: `${t('conversation.nextQuestion')}\n\n${nextQ}\n\n${t('conversation.questionProgress', { current: String(newAnswerCount + 1), total: String(prev.currentRound!.questions.length) })}`,
            timestamp: new Date(),
          }]);
        }, 300);

        return {
          ...prev,
          currentRound: { ...prev.currentRound, answerCount: newAnswerCount },
        };
      }

      // All questions in this round answered — generate follow-up or transition to refining
      // Note: we can't async-fetch drops here, so we pass undefined (follow-ups still work with structure-based fallback)
      const followUps = generateFollowUpQuestions(currentFramework);

      if (followUps.length === 0 || prev.allRounds.length >= 3) {
        // Reached consensus
        setTimeout(() => {
          setMessages(msgs => [...msgs, {
            id: nextId(),
            role: 'ai' as const,
            content: `${t('conversation.consensusReached')}\n\n${t('conversation.continueOrConfirm')}`,
            timestamp: new Date(),
          }]);
        }, 300);
        return { ...prev, phase: 'refining' as const, currentRound: null };
      }

      // Start new round
      const newRound: ConversationRound = { questions: followUps, answerCount: 0 };
      setTimeout(() => {
        setMessages(msgs => [...msgs, {
          id: nextId(),
          role: 'ai' as const,
          content: `${t('conversation.nextRoundIntro')}\n\n${followUps[0]}\n\n${t('conversation.questionProgress', { current: '1', total: String(followUps.length) })}`,
          timestamp: new Date(),
        }]);
      }, 300);

      return {
        ...prev,
        currentRound: newRound,
        allRounds: [...prev.allRounds, newRound],
      };
    });
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || !framework) return;

    const userMessage: Message = {
      id: nextId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // In guiding phase, treat user message as answer to current question
    if (conversationState.phase === 'guiding') {
      advanceGuiding(framework);
      return;
    }

    // In refining phase — existing AI interaction logic
    const input = inputValue.toLowerCase().trim();

    if (input.includes('confirm') || input === 'ok' || input === 'yes') {
      handleConfirmFramework();
      return;
    }

    if (input.includes('add') || input.includes('detail')) {
      handleAddNode(userMessage.content);
      return;
    }

    if (input.includes('reorganize') || input.includes('restructure')) {
      handleReorganize();
      return;
    }

    // Use AI for other inputs
    const thinkingId = nextId();
    thinkingIdRef.current = thinkingId;
    setMessages(prev => [...prev, {
      id: thinkingId,
      role: 'ai',
      content: '...',
      timestamp: new Date(),
    }]);

    try {
      const response = await refineFramework(framework, userMessage.content);
      const tid = thinkingIdRef.current;
      if (tid) setMessages(prev => prev.filter(m => m.id !== tid));

      if (response && response.frameworks && response.frameworks[0]) {
        const aiFramework = response.frameworks[0];

        // Merge logic: protect locked nodes/edges
        const aiNodeIds = new Set(aiFramework.nodes.map(n => n.id));
        const aiEdgeIds = new Set(aiFramework.edges.map(e => e.id));

        const mergedNodes: KnowledgeFramework['nodes'] = aiFramework.nodes.map(n => {
          const existingNode = framework.nodes.find(fn => fn.id === n.id);
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
        for (const lockedNode of framework.nodes.filter(n => n.state === 'locked')) {
          if (!aiNodeIds.has(lockedNode.id)) {
            mergedNodes.push(lockedNode);
          }
        }

        const mergedEdges: KnowledgeFramework['edges'] = aiFramework.edges.map(e => {
          const existingEdge = framework.edges.find(fe => fe.id === e.id);
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            relationship: e.relationship,
            state: existingEdge?.state || ((e as any).state || 'virtual') as 'virtual' | 'confirmed' | 'locked',
          };
        });

        // Restore locked edges that AI removed
        for (const lockedEdge of framework.edges.filter(e => e.state === 'locked')) {
          if (!aiEdgeIds.has(lockedEdge.id)) {
            mergedEdges.push(lockedEdge);
          }
        }

        const proposedFramework: KnowledgeFramework = {
          ...framework,
          title: aiFramework.title || framework.title,
          description: aiFramework.description || framework.description,
          nodes: mergedNodes,
          edges: mergedEdges,
          updatedAt: new Date().toISOString(),
        };

        const summary = formatProposalSummary(framework, proposedFramework);
        setMessages(prev => [...prev, {
          id: nextId(),
          role: 'ai',
          content: `${summary}\n\n${t('conversation.applyChangesOrContinue')}`,
          timestamp: new Date(),
          pendingFramework: proposedFramework,
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: nextId(),
          role: 'ai',
          content: t('conversation.requestProcessed'),
          timestamp: new Date(),
        }]);
      }
    } catch (err) {
      const tid = thinkingIdRef.current;
      if (tid) setMessages(prev => prev.filter(m => m.id !== tid));
      setMessages(prev => [...prev, {
        id: nextId(),
        role: 'ai',
        content: t('conversation.requestFailed', { error: error || t('conversation.requestFailedDefault') }),
        timestamp: new Date(),
      }]);
    }
  }, [inputValue, framework, refineFramework, onFrameworkUpdate, error, conversationState.phase, advanceGuiding]);

  // Skip current question
  const handleSkipQuestion = useCallback(() => {
    if (!framework) return;
    advanceGuiding(framework);
  }, [framework, advanceGuiding]);

  // Skip all remaining questions, go to refining
  const handleSkipAll = useCallback(() => {
    setConversationState(prev => ({ ...prev, phase: 'refining', currentRound: null }));
    setMessages(prev => [...prev, {
      id: nextId(),
      role: 'ai',
      content: `${t('conversation.skippedAll')}\n\n${t('conversation.refiningInstructions')}`,
      timestamp: new Date(),
    }]);
  }, []);

  const handleConfirmFramework = useCallback(() => {
    if (!framework) return;
    const updatedFramework: KnowledgeFramework = {
      ...framework,
      nodes: framework.nodes.map(node => ({
        ...node,
        state: 'confirmed' as const,
      })),
      updatedAt: new Date().toISOString(),
    };
    onFrameworkUpdate(updatedFramework);
    setMessages(prev => [...prev, {
      id: nextId(),
      role: 'ai',
      content: `${t('conversation.allNodesConfirmed', { count: String(framework.nodes.length) })}\n\n${t('conversation.lockOrAdjust')}`,
      timestamp: new Date(),
    }]);
  }, [framework, onFrameworkUpdate]);

  const handleAddNode = useCallback((userContent: string) => {
    if (!framework) return;
    const newNode: FrameworkNode = {
      id: `node-${nextId()}`,
      label: `New Node ${framework.nodes.length + 1}`,
      content: userContent.length > 30 ? userContent : 'Click to edit this node',
      level: 1,
      state: 'virtual',
      metadata: { createdBy: 'ai', source: '', reasoning: '' },
    };
    const updatedFramework: KnowledgeFramework = {
      ...framework,
      nodes: [...framework.nodes, newNode],
      updatedAt: new Date().toISOString(),
    };
    onFrameworkUpdate(updatedFramework);
    setMessages(prev => [...prev, {
      id: nextId(),
      role: 'ai',
      content: `${t('conversation.nodeAdded', { label: newNode.label })}\n\n${t('conversation.nodeEditHint')}`,
      timestamp: new Date(),
    }]);
  }, [framework, onFrameworkUpdate]);

  const handleReorganize = useCallback(() => {
    if (!framework) return;
    const updatedNodes = framework.nodes.map((node) => ({
      ...node,
      level: (node.level + 1) % 2,
    }));
    const updatedFramework: KnowledgeFramework = {
      ...framework,
      nodes: updatedNodes,
      updatedAt: new Date().toISOString(),
    };
    onFrameworkUpdate(updatedFramework);
    setMessages(prev => [...prev, {
      id: nextId(),
      role: 'ai',
      content: `${t('conversation.reorganized')}\n\n${t('conversation.levelSwapHint')}`,
      timestamp: new Date(),
    }]);
  }, [framework, onFrameworkUpdate]);

  // Finish and save framework
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
      const frameworkSummary = `框架: ${finalizedFramework.title}\n节点(${finalizedFramework.nodes.length}): ${finalizedFramework.nodes.map(n => n.label).join(', ')}\n关联(${finalizedFramework.edges.length})`;
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
          // Extract title from "TITLE: xxx" format
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

  const isGuiding = conversationState.phase === 'guiding';

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h2 className="font-medium">{t('conversation.headerTitle')}</h2>
          {isGuiding && conversationState.currentRound && (
            <span className="text-xs text-gray-400 ml-2">
              {t('conversation.roundLabel', { round: String(conversationState.allRounds.length) })}
            </span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Show conversation summary if available */}
        {summary && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-sm">📋</span>
              <span className="text-xs font-medium text-yellow-700">{t('conversation.summaryLabel')}</span>
            </div>
            <p className="text-sm text-yellow-800">{summary}</p>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            Loading framework...
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
                    onClick={() => {
                      const frameworkWithExplanations = {
                        ...msg.pendingFramework!,
                        nodes: msg.pendingFramework!.nodes.map(node => ({
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
                          ? { ...m, pendingFramework: undefined, content: m.content + '\n\n✅ Changes applied!' }
                          : m
                      ));
                    }}
                    className="mt-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                  >
                    ✓ Apply Changes
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        {status === 'loading' && messages[messages.length - 1]?.role !== 'ai' && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <span className="animate-pulse">AI is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-t border-gray-100">
        <div className="flex gap-2 flex-wrap">
          {isGuiding ? (
            <>
              <button
                onClick={handleSkipQuestion}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                disabled={status === 'loading' || isFinishing}
              >
                {t('conversation.skipQuestion')}
              </button>
              <button
                onClick={handleSkipAll}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                disabled={status === 'loading' || isFinishing}
              >
                {t('conversation.skipAll')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setInputValue(t('conversation.confirmFrameworkHint'));
                  setTimeout(() => handleSendMessage(), 100);
                }}
                className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full hover:bg-green-200"
                disabled={status === 'loading' || isFinishing}
              >
                {t('conversation.confirmBtn')}
              </button>
              <button
                onClick={() => {
                  setInputValue(t('conversation.addMoreDetails'));
                  setTimeout(() => handleSendMessage(), 100);
                }}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"
                disabled={status === 'loading' || isFinishing}
              >
                {t('conversation.addBtn')}
              </button>
              <button
                onClick={() => {
                  setInputValue(t('conversation.reorganizeStructure'));
                  setTimeout(() => handleSendMessage(), 100);
                }}
                className="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200"
                disabled={status === 'loading' || isFinishing}
              >
                {t('conversation.reorganizeBtn')}
              </button>
              {onAddDrops && (
                <button
                  onClick={onAddDrops}
                  className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200"
                >
                  {t('conversation.addDropsBtn')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Finish & Save area */}
      {!isGuiding && framework && (
        <div className="px-4 py-3 border-t border-gray-200 bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">{t('conversation.finishReview')}</p>
              <p className="text-xs text-green-600">
                {t('conversation.nodesConfirmedCount', {
                  confirmed: String(framework.nodes.filter(n => n.state === 'confirmed' || n.state === 'locked').length),
                  total: String(framework.nodes.length),
                })}
                {framework.createdFromDrops.length > 0 && ` · ${t('conversation.dropsCount', { count: String(framework.createdFromDrops.length) })}`}
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
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={isGuiding ? t('conversation.placeholder.guiding') : t('conversation.placeholder.refining')}
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

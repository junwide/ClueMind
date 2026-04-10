// src/components/AI/AIDialog.tsx
import { useState, useCallback } from 'react';
import { useDropStore } from '../../stores/dropStore';
import { useAIChat } from '../../hooks/useAIChat';
import { LoadingIndicator } from './LoadingIndicator';
import { FrameworkSelector } from './FrameworkSelector';
import type { FrameworkProposal } from '../../types/ai';
import { KnowledgeFramework, FrameworkNode, FrameworkEdge } from '../../types/framework';
import { useTranslation } from '../../i18n';

import { generateFrameworkDescription } from '../../utils/frameworkDescriptions';
import { groupByType, getTypeLabel, getTypeColor, getPreview, type DropCategory } from '../../utils/dropHelpers';

type DialogStep = 'select-drops' | 'generating' | 'select-framework';

interface AIDialogProps {
  onFrameworkSelect?: (framework: KnowledgeFramework) => void;
  onClose?: () => void;
  /** When true, show all drops including processed ones (for adding to existing framework) */
  showAllDrops?: boolean;
}

interface PreviewModalProps {
  proposal: FrameworkProposal | null;
  onClose: () => void;
}

function PreviewModal({ proposal, onClose }: PreviewModalProps) {
  const { t } = useTranslation();
  if (!proposal) return null;

  const { thinkingPattern, organizingLogic } = generateFrameworkDescription(proposal);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">{proposal.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* Thinking pattern */}
        <div className="mb-3 p-3 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-1">{t('dialog.thinkingPattern')}</h4>
          <p className="text-sm text-blue-800">{thinkingPattern}</p>
        </div>

        {/* Organizing logic */}
        <div className="mb-3 p-3 bg-green-50 rounded-lg">
          <h4 className="text-sm font-medium text-green-900 mb-1">{t('dialog.organizingLogic')}</h4>
          <p className="text-sm text-green-800">{organizingLogic}</p>
        </div>

        {proposal.description && (
          <p className="text-gray-600 mb-4 text-sm">{proposal.description}</p>
        )}

        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">{t('dialog.nodePreview')}</h4>
          <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-auto">
            {proposal.nodes.map((node, index) => (
              <div key={node.id} className="flex items-center gap-2 py-1">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="font-medium text-sm">{node.label}</span>
                {node.content && (
                  <span className="text-xs text-gray-400 truncate">- {node.content}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">{t('dialog.edgeConnections')}</h4>
          <div className="text-sm text-gray-600">
            {t('dialog.edgeCount', { count: String(proposal.edges.length) })}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          {t('dialog.closePreview')}
        </button>
      </div>
    </div>
  );
}

export function AIDialog({ onFrameworkSelect, onClose, showAllDrops = false }: AIDialogProps) {
  const { t } = useTranslation();
  const { drops } = useDropStore();
  // When showAllDrops is true, show all drops; otherwise only show raw (unused) drops
  const rawDrops = showAllDrops
    ? drops
    : drops.filter(d => d.status === 'raw' || !d.status);
  const { generateFrameworks, keysLoading, streamingText } = useAIChat();
  const [step, setStep] = useState<DialogStep>('select-drops');
  const [selectedDropIds, setSelectedDropIds] = useState<string[]>([]);
  const [proposals, setProposals] = useState<FrameworkProposal[]>([]);
  const [previewProposal, setPreviewProposal] = useState<FrameworkProposal | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);

  // Wait for keys to load before allowing generation
  const canGenerate = !keysLoading && selectedDropIds.length > 0;

  const toggleDrop = useCallback((id: string) => {
    setSelectedDropIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    if (selectedDropIds.length === 0 || keysLoading) return;

    setStep('generating');
    setAiErrorMessage(null);

    const selectedDrops = drops.filter(d => selectedDropIds.includes(d.id));

    // Prepare drops content for AI — include multimodal info
    const dropsForAI = selectedDrops.map(d => {
      const base = { id: d.id };
      if (!d.content || typeof d.content !== 'object') {
        return { ...base, content: getPreview(d.content) };
      }
      const c = d.content;
      if (c.type === 'image' && c.ocrText) {
        return { ...base, content: `[Image] ${c.ocrText}`, contentType: 'image' };
      }
      if (c.type === 'image') {
        return { ...base, content: '[Image attached — no OCR text yet]', contentType: 'image' };
      }
      if (c.type === 'voice' && c.transcription) {
        return { ...base, content: `[Voice] ${c.transcription}`, contentType: 'voice' };
      }
      if (c.type === 'voice') {
        return { ...base, content: '[Voice recording — no transcription yet]', contentType: 'voice' };
      }
      if (c.type === 'file') {
        return { ...base, content: `[File] ${c.path || 'attachment'}`, contentType: 'file' };
      }
      return { ...base, content: getPreview(c) };
    });

    try {
      const response = await generateFrameworks('', dropsForAI);

      if (response.frameworks && response.frameworks.length > 0) {
        // Convert AI response to FrameworkProposal format
        const frameworks: FrameworkProposal[] = response.frameworks.map((f: any) => ({
          id: f.id || `framework-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          title: f.title || 'Unnamed Framework',
          description: f.description || '',
          structure_type: f.structure_type || 'custom',
          nodes: f.nodes || [],
          edges: f.edges || [],
        }));
        setProposals(frameworks);
        setStep('select-framework');
      } else {
        setAiErrorMessage(t('dialog.aiGenerateFailed'));
        setStep('select-drops');
      }
    } catch (error) {
      console.error('Failed to generate frameworks:', error);
      setAiErrorMessage(error instanceof Error ? error.message : String(error));
      setStep('select-drops');
    }
  }, [selectedDropIds, drops, generateFrameworks]);

  const convertToFramework = useCallback((proposal: FrameworkProposal): KnowledgeFramework => {
    const nodes: FrameworkNode[] = proposal.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      content: node.content,
      level: node.level,
      state: node.state as 'virtual' | 'confirmed' | 'locked',
      position: undefined,
      metadata: {
        createdBy: 'ai',
        source: node.source || '',
        reasoning: node.reasoning || '',
      },
    }));

    const edges: FrameworkEdge[] = proposal.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      relationship: edge.relationship,
      state: 'virtual' as const,
    }));

    // Map structure_type to valid structureType
    const structureType = (proposal.structure_type === 'pyramid' || proposal.structure_type === 'pillars' || proposal.structure_type === 'custom')
      ? proposal.structure_type
      : 'custom';

    return {
      id: proposal.id,
      title: proposal.title,
      description: proposal.description || '',
      structureType,
      nodes,
      edges,
      createdFromDrops: selectedDropIds,
      lifecycle: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [selectedDropIds]);

  const handleFrameworkSelect = useCallback((id: string) => {
    const selected = proposals.find(p => p.id === id);
    if (selected && onFrameworkSelect) {
      const framework = convertToFramework(selected);
      onFrameworkSelect(framework);
    }
  }, [proposals, onFrameworkSelect, convertToFramework]);

  // Step 1: Select Drops
  if (step === 'select-drops') {
    return (
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-auto max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-medium">{t('dialog.selectDropsTitle')}</h2>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          )}
        </div>

        <div className="p-4 flex-1 overflow-auto">
          <p className="text-gray-600 mb-4">
            {t('dialog.selectDropsDescription')}
          </p>

          {/* Error message */}
          {aiErrorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {aiErrorMessage}
              <button
                onClick={() => setAiErrorMessage(null)}
                className="ml-2 text-red-500 hover:text-red-700"
              >
                ✕
              </button>
            </div>
          )}

          {rawDrops.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {t('dialog.noDropsEmpty')}
            </div>
          ) : (
            <div className="space-y-4">
              {(['text', 'url', 'other'] as DropCategory[]).map(cat => {
                const grouped = groupByType(rawDrops);
                const catDrops = grouped[cat];
                if (catDrops.length === 0) return null;
                const catLabel = cat === 'text' ? t('helpers.category.text') : cat === 'url' ? t('helpers.category.url') : t('helpers.category.other');
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-500">{catLabel}</span>
                      <span className="text-xs text-gray-300">({catDrops.length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {catDrops.map(drop => {
                        const isSelected = selectedDropIds.includes(drop.id);
                        return (
                          <div
                            key={drop.id}
                            onClick={() => toggleDrop(drop.id)}
                            className={`p-2.5 rounded-lg cursor-pointer border transition-colors ${
                              isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <input type="checkbox" checked={isSelected} onChange={() => toggleDrop(drop.id)} className="mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-800 truncate">{getPreview(drop.content)}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${getTypeColor(drop.content?.type || '')}`}>{getTypeLabel(drop.content?.type || '')}</span>
                                  {showAllDrops && drop.status === 'processed' && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{t('dialog.dropUsed')}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {keysLoading ? t('dialog.loadingConfig') : t('dialog.selectedCount', { count: String(selectedDropIds.length) })}
            </span>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('dialog.generateFramework')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Generating
  if (step === 'generating') {
    return (
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-auto p-8">
        {onClose && (
          <div className="flex justify-end mb-4">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>
        )}
        <LoadingIndicator progress={60} />
        <p className="text-center text-gray-600 mt-4">{t('dialog.aiAnalyzing')}</p>
        {streamingText && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg max-h-40 overflow-auto">
            <p className="text-xs text-gray-500 whitespace-pre-wrap font-mono">{streamingText}</p>
          </div>
        )}
      </div>
    );
  }

  // Step 3: Select Framework
  if (step === 'select-framework') {
    return (
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-auto max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-medium">{t('dialog.selectFrameworkTitle')}</h2>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          )}
        </div>

        <div className="p-4 flex-1 overflow-auto">
          {proposals.length > 0 ? (
            <FrameworkSelector
              proposals={proposals}
              onSelect={handleFrameworkSelect}
              onPreview={(id) => {
                const proposal = proposals.find(p => p.id === id);
                setPreviewProposal(proposal || null);
              }}
            />
          ) : (
            <div className="text-center py-8 text-gray-400">
              {t('dialog.noFrameworkGenerated')}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={() => setStep('select-drops')}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            {t('dialog.backToSelection')}
          </button>
        </div>

        {/* Preview Modal */}
        <PreviewModal
          proposal={previewProposal}
          onClose={() => setPreviewProposal(null)}
        />
      </div>
    );
  }

  return null;
}

// src/pages/CanvasPage.tsx
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Canvas } from '../components/Canvas/Canvas';
import { AIDialog } from '../components/AI/AIDialog';
import { AIConversationPanel } from '../components/AI/AIConversationPanel';
import { ResizablePanel } from '../components/Layout/ResizablePanel';
import { DropThumbnail } from '../components/Canvas/DropThumbnail';
import { useFrameworkStore } from '../stores/frameworkStore';
import { KnowledgeFramework, FrameworkEdge } from '../types/framework';
import { useTranslation } from '../i18n';

interface CanvasPageProps {
  loadFrameworkId?: string | null;
  onFrameworkLoaded?: () => void;
  startNewReview?: boolean;
  onNewReviewConsumed?: () => void;
}

export default function CanvasPage({
  loadFrameworkId,
  onFrameworkLoaded,
  startNewReview,
  onNewReviewConsumed,
}: CanvasPageProps) {
  const { t } = useTranslation();
  const {
    framework, setFramework, clearFramework,
    confirmNode, lockNode, unlockNode, deleteNode,
    confirmEdge, lockEdge, unlockEdge, updateEdgeRelationship,
    updateNodePosition, updateNode, updateNodeMetadata,
    restoredFromSession, markRestored,
  } = useFrameworkStore();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<FrameworkEdge | null>(null);
  const [editRelationship, setEditRelationship] = useState('');
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showDropSelector, setShowDropSelector] = useState(false);
  const [pendingReanalysis, setPendingReanalysis] = useState<{ newDrops: Array<{ id: string; content: string }> } | null>(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const loadedFrameworkIdRef = useRef<string | null>(null);

  // Editable fields for selected node
  const [editLabel, setEditLabel] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editReasoning, setEditReasoning] = useState('');

  // Derive selectedNode from framework + selectedNodeId
  const selectedNode = useMemo(() => {
    if (!framework || !selectedNodeId) return null;
    return framework.nodes.find(n => n.id === selectedNodeId) || null;
  }, [framework, selectedNodeId]);

  // Sync editable fields when selectedNode changes
  useEffect(() => {
    if (selectedNode) {
      setEditLabel(selectedNode.label);
      setEditContent(selectedNode.content || '');
      setEditSource(selectedNode.metadata?.source || '');
      setEditReasoning(selectedNode.metadata?.reasoning || '');
    }
  }, [selectedNode]);

  // Auto-save on unmount
  useEffect(() => {
    return () => {
      const fw = useFrameworkStore.getState().framework;
      if (fw) {
        invoke('save_framework', { framework: fw }).catch((err) =>
          console.error('Auto-save on unmount failed:', err)
        );
      }
    };
  }, []);

  // Load a saved framework when navigating from Home, or restore from store
  useEffect(() => {
    if (loadFrameworkId && loadedFrameworkIdRef.current !== loadFrameworkId) {
      // Branch A: Explicit navigation from Home — always load from backend
      loadedFrameworkIdRef.current = loadFrameworkId;
      invoke<KnowledgeFramework | null>('load_framework', { id: loadFrameworkId })
        .then(async (loaded) => {
          if (loaded) {
            setFramework(loaded);
            markRestored();
            try {
              type ConvSummary = { id: string; framework_id: string | null };
              const conversations = await invoke<ConvSummary[]>('list_conversations');
              const match = conversations.find((c: ConvSummary) => c.framework_id === loaded.id);
              if (match) {
                setConversationId(match.id);
              }
            } catch {}
            setShowConversation(true);
          }
        })
        .catch((err) => {
          console.error('Failed to load framework:', err);
        })
        .finally(() => {
          onFrameworkLoaded?.();
        });
    } else if (!loadFrameworkId && framework && !restoredFromSession) {
      // Branch B: Stale session — show restore prompt
      setShowRestorePrompt(true);
      markRestored();
    } else if (!loadFrameworkId && framework && restoredFromSession) {
      // Branch C: Returning to Canvas with existing framework — restore UI
      setShowConversation(true);
      (async () => {
        try {
          type ConvSummary = { id: string; framework_id: string | null };
          const conversations = await invoke<ConvSummary[]>('list_conversations');
          const match = conversations.find((c: ConvSummary) => c.framework_id === framework.id);
          if (match) {
            setConversationId(match.id);
          }
        } catch {}
      })();
    }
  }, [loadFrameworkId, framework, setFramework, onFrameworkLoaded, restoredFromSession, markRestored]);

  // Handle "Start New Review" from Home page
  useEffect(() => {
    if (startNewReview) {
      clearFramework();
      setShowAIDialog(true);
      onNewReviewConsumed?.();
    }
  }, [startNewReview, clearFramework, onNewReviewConsumed]);

  const handleRestoreConfirm = useCallback(() => {
    setShowRestorePrompt(false);
    setShowConversation(true);
  }, []);

  const handleRestoreDecline = useCallback(() => {
    clearFramework();
    setShowRestorePrompt(false);
    setShowConversation(false);
  }, [clearFramework]);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (framework) {
      setSelectedNodeId(nodeId);
      setSelectedEdge(null);
    }
  }, [framework]);

  const handleEdgeClick = useCallback((edgeId: string) => {
    if (framework) {
      const edge = framework.edges.find(e => e.id === edgeId);
      if (edge) {
        setSelectedEdge(edge);
        setSelectedNodeId(null);
        setEditRelationship(edge.relationship);
      }
    }
  }, [framework]);

  const handleNodeContextMenu = useCallback((nodeId: string, _event: React.MouseEvent) => {
    if (framework) {
      const node = framework.nodes.find(n => n.id === nodeId);
      if (node && node.state === 'virtual') {
        if (window.confirm(t('canvas.deleteNodeConfirm'))) {
          deleteNode(nodeId);
          if (selectedNodeId === nodeId) setSelectedNodeId(null);
        }
      }
    }
  }, [framework, deleteNode, selectedNodeId]);

  const handleConfirmNode = useCallback(() => {
    if (selectedNodeId) {
      confirmNode(selectedNodeId);
    }
  }, [selectedNodeId, confirmNode]);

  const handleLockNode = useCallback(() => {
    if (selectedNodeId) {
      lockNode(selectedNodeId);
    }
  }, [selectedNodeId, lockNode]);

  const handleUnlockNode = useCallback(() => {
    if (selectedNodeId) {
      unlockNode(selectedNodeId);
    }
  }, [selectedNodeId, unlockNode]);

  const handleSaveNodeEdits = useCallback(() => {
    if (!selectedNodeId) return;
    if (editLabel.trim() !== selectedNode?.label || editContent !== selectedNode?.content) {
      updateNode(selectedNodeId, { label: editLabel.trim(), content: editContent });
    }
    if (editSource !== (selectedNode?.metadata?.source || '') || editReasoning !== (selectedNode?.metadata?.reasoning || '')) {
      updateNodeMetadata(selectedNodeId, { source: editSource, reasoning: editReasoning });
    }
  }, [selectedNodeId, selectedNode, editLabel, editContent, editSource, editReasoning, updateNode, updateNodeMetadata]);

  const handleUpdateRelationship = useCallback(() => {
    if (selectedEdge && editRelationship.trim()) {
      updateEdgeRelationship(selectedEdge.id, editRelationship.trim());
      setSelectedEdge(prev => prev ? { ...prev, relationship: editRelationship.trim() } : null);
    }
  }, [selectedEdge, editRelationship, updateEdgeRelationship]);

  const handleConfirmEdge = useCallback(() => {
    if (selectedEdge) {
      confirmEdge(selectedEdge.id);
      setSelectedEdge(prev => prev ? { ...prev, state: 'confirmed' } : null);
    }
  }, [selectedEdge, confirmEdge]);

  const handleLockEdge = useCallback(() => {
    if (selectedEdge) {
      lockEdge(selectedEdge.id);
      setSelectedEdge(prev => prev ? { ...prev, state: 'locked' } : null);
    }
  }, [selectedEdge, lockEdge]);

  const handleUnlockEdge = useCallback(() => {
    if (selectedEdge) {
      unlockEdge(selectedEdge.id);
      setSelectedEdge(prev => prev ? { ...prev, state: 'confirmed' } : null);
    }
  }, [selectedEdge, unlockEdge]);

  const handleFrameworkSelect = useCallback((newFramework: KnowledgeFramework) => {
    setFramework(newFramework);
    markRestored();  // Prevent spurious restore prompt after new framework
    setShowAIDialog(false);
    setShowConversation(true);
    setSelectedNodeId(null);
    setSelectedEdge(null);
  }, [setFramework, markRestored]);

  const handleFrameworkUpdate = useCallback((updatedFramework: KnowledgeFramework) => {
    setFramework(updatedFramework);
  }, [setFramework]);

  // Shared sidebar component for node details
  const renderNodeSidebar = () => {
    if (!selectedNode) return null;
    return (
      <div className="absolute top-0 right-0 w-80 max-w-[40%] h-full bg-white border-l border-gray-200 p-6 overflow-auto z-10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              onBlur={handleSaveNodeEdits}
              className="w-full border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-0.5"
            />
          </h3>
          <button
            onClick={() => setSelectedNodeId(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <span className={`inline-block px-2 py-1 text-xs rounded ${
            selectedNode.state === 'virtual' ? 'bg-blue-100 text-blue-700' :
            selectedNode.state === 'confirmed' ? 'bg-green-100 text-green-700' :
            'bg-orange-100 text-orange-700'
          }`}>
            {selectedNode.state === 'virtual' ? t('canvas.nodeState.virtual') :
             selectedNode.state === 'confirmed' ? t('canvas.nodeState.confirmed') : t('canvas.nodeState.locked')}
          </span>
        </div>

        {/* Content - editable */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('canvas.node.contentLabel')}</label>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onBlur={handleSaveNodeEdits}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
          />
        </div>

        {/* Source - editable */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('canvas.node.sourceLabel')}</label>
          <textarea
            value={editSource}
            onChange={(e) => setEditSource(e.target.value)}
            onBlur={handleSaveNodeEdits}
            placeholder={t('canvas.node.sourcePlaceholder')}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
          />
        </div>

        {/* Reasoning - editable */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('canvas.node.reasoningLabel')}</label>
          <textarea
            value={editReasoning}
            onChange={(e) => setEditReasoning(e.target.value)}
            onBlur={handleSaveNodeEdits}
            placeholder={t('canvas.node.reasoningPlaceholder')}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
          />
        </div>

        {/* AI Explanation */}
        {selectedNode.metadata?.aiExplanation && (
          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-sm">🤖</span>
              <span className="text-xs font-medium text-purple-700">{t('canvas.node.aiExplanation')}</span>
            </div>
            <p className="text-sm text-purple-800 whitespace-pre-wrap">
              {selectedNode.metadata.aiExplanation}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {selectedNode.state === 'virtual' && (
            <button
              onClick={handleConfirmNode}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              {t('canvas.confirmNode')}
            </button>
          )}
          {selectedNode.state === 'confirmed' && (
            <button
              onClick={handleLockNode}
              className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              {t('canvas.lockNode')}
            </button>
          )}
          {selectedNode.state === 'locked' && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 text-center">
                {t('canvas.nodeLocked')}
              </p>
              <button
                onClick={handleUnlockNode}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                {t('canvas.unlockNode')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Shared sidebar component for edge details
  const renderEdgeSidebar = () => {
    if (!selectedEdge || !framework) return null;
    const sourceNode = framework.nodes.find(n => n.id === selectedEdge.source);
    const targetNode = framework.nodes.find(n => n.id === selectedEdge.target);

    return (
      <div className="absolute top-0 right-0 w-80 max-w-[40%] h-full bg-white border-l border-gray-200 p-6 overflow-auto z-10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{t('canvas.edgeDetails')}</h3>
          <button
            onClick={() => setSelectedEdge(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <span className={`inline-block px-2 py-1 text-xs rounded ${
            selectedEdge.state === 'virtual' ? 'bg-blue-100 text-blue-700' :
            selectedEdge.state === 'confirmed' ? 'bg-green-100 text-green-700' :
            'bg-orange-100 text-orange-700'
          }`}>
            {selectedEdge.state === 'virtual' ? t('canvas.edgeState.virtual') :
             selectedEdge.state === 'confirmed' ? t('canvas.edgeState.confirmed') : t('canvas.edgeState.locked')}
          </span>
        </div>

        {/* Connection info */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500 mb-1">{t('canvas.edge.connection')}</p>
          <p className="font-medium text-sm">
            {sourceNode?.label || '?'} → {targetNode?.label || '?'}
          </p>
        </div>

        {/* Relationship */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500 mb-1">{t('canvas.edge.relationship')}</p>
          <p className="font-medium">{selectedEdge.relationship}</p>
        </div>

        {/* Edit relationship */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('canvas.edge.editReason')}
          </label>
          <input
            type="text"
            value={editRelationship}
            onChange={(e) => setEditRelationship(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleUpdateRelationship}
            disabled={!editRelationship.trim() || editRelationship === selectedEdge.relationship}
            className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {t('canvas.edge.update')}
          </button>
        </div>

        {/* State actions */}
        <div className="space-y-2">
          {selectedEdge.state === 'virtual' && (
            <button
              onClick={handleConfirmEdge}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              {t('canvas.confirmEdge')}
            </button>
          )}
          {selectedEdge.state === 'confirmed' && (
            <button
              onClick={handleLockEdge}
              className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              {t('canvas.lockEdge')}
            </button>
          )}
          {selectedEdge.state === 'locked' && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 text-center">
                {t('canvas.edgeLocked')}
              </p>
              <button
                onClick={handleUnlockEdge}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                {t('canvas.unlockEdge')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Shared canvas area
  const renderCanvas = () => (
    <Canvas
      framework={framework}
      onNodeClick={handleNodeClick}
      onNodeContextMenu={handleNodeContextMenu}
      onEdgeClick={handleEdgeClick}
      selectedEdgeId={selectedEdge?.id || null}
      onNodeDrag={updateNodePosition}
    />
  );

  // Restore prompt modal
  if (showRestorePrompt) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
          <h2 className="text-xl font-semibold mb-3">{t('canvas.restoreTitle')}</h2>
          <p className="text-gray-600 mb-6">
            {t('canvas.restoreDescription', { title: framework?.title || t('canvas.untitled') })}
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleRestoreConfirm}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t('canvas.restoreConfirm')}
            </button>
            <button
              onClick={handleRestoreDecline}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              {t('canvas.restoreDecline')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Split view: AI Conversation + Canvas */}
      {showConversation && framework ? (
        <div className="flex h-full">
          {/* Left: AI Conversation Panel (resizable) */}
          <ResizablePanel initialWidth={384} minWidth={280} maxWidth={600} className="border-r border-gray-200">
            <AIConversationPanel
              framework={framework}
              onFrameworkUpdate={handleFrameworkUpdate}
              onClose={() => setShowConversation(false)}
              conversationId={conversationId}
              onConversationCreated={(id) => setConversationId(id)}
              onAddDrops={() => setShowDropSelector(true)}
              pendingReanalysis={pendingReanalysis ? { newDrops: pendingReanalysis.newDrops } : null}
            />
          </ResizablePanel>

          {/* Right: Canvas */}
          <div className="flex-1 min-w-0 relative">
            {renderCanvas()}
            {/* Drop thumbnail */}
            {framework.createdFromDrops.length > 0 && (
              <div className="absolute top-4 right-4 z-20">
                <DropThumbnail dropIds={framework.createdFromDrops} />
              </div>
            )}
            {renderNodeSidebar()}
            {renderEdgeSidebar()}
          </div>
        </div>
      ) : (
        /* Default view: Canvas with AI dialog button */
        <div className="flex h-full">
          <div className="flex-1 min-w-0 relative">
            {renderCanvas()}

            {!showAIDialog && !showConversation && (
              <button
                onClick={() => setShowAIDialog(true)}
                className="absolute bottom-6 right-6 px-6 py-3 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors z-10"
              >
                {t('canvas.startAIChat')}
              </button>
            )}

            {renderNodeSidebar()}
            {renderEdgeSidebar()}
          </div>

          {showAIDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <AIDialog
                onFrameworkSelect={handleFrameworkSelect}
                onClose={() => setShowAIDialog(false)}
              />
            </div>
          )}
        </div>
      )}

      {/* Drop selector modal — always rendered at top level */}
      {showDropSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <AIDialog
            showAllDrops={true}
            onFrameworkSelect={(fw) => {
              if (framework) {
                const newDropIds = fw.createdFromDrops.filter(id => !framework.createdFromDrops.includes(id));
                const newDrops = fw.nodes
                  .filter(n => n.metadata?.source)
                  .map(n => ({ id: n.id, content: n.content || n.label }));

                const merged: KnowledgeFramework = {
                  ...framework,
                  createdFromDrops: [...framework.createdFromDrops, ...newDropIds],
                  updatedAt: new Date().toISOString(),
                };
                setFramework(merged);

                if (newDrops.length > 0) {
                  setPendingReanalysis({ newDrops });
                }
              }
              setShowDropSelector(false);
            }}
            onClose={() => setShowDropSelector(false)}
          />
        </div>
      )}
    </>
  );
}

// src/types/ai.ts
export interface AIFrameworkProposal {
  type: 'framework_proposal';
  frameworks: FrameworkProposal[];
  conversation_context: ConversationContext;
}

export interface FrameworkProposal {
  id: string;
  title: string;
  description?: string;
  structure_type: string; // 'hierarchy' | 'mindmap' | 'flow' | 'pyramid' | 'pillars' | 'custom'
  nodes: ProposalNode[];
  edges: ProposalEdge[];
}

export interface ProposalNode {
  id: string;
  label: string;
  content: string;
  level: number;
  state: 'virtual';
  source?: string;
  reasoning?: string;
}

export interface ProposalEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
}

export interface ConversationContext {
  turn_number: number;
  user_intent: string;
  confidence: number;
}

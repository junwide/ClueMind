// src-tauri/src/ai/schema.rs
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::models::{NodeState, StructureType};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIFrameworkProposal {
    #[serde(rename = "type")]
    pub message_type: String,
    pub frameworks: Vec<FrameworkProposal>,
    pub conversation_context: ConversationContext,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkProposal {
    pub id: Uuid,
    pub title: String,
    pub structure_type: StructureType,
    pub nodes: Vec<ProposalNode>,
    pub edges: Vec<ProposalEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalNode {
    pub id: Uuid,
    pub label: String,
    pub content: String,
    pub level: u32,
    pub state: NodeState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalEdge {
    pub id: Uuid,
    pub source: Uuid,
    pub target: Uuid,
    pub relationship: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationContext {
    pub turn_number: u32,
    pub user_intent: String,
    pub confidence: f32,
}

impl AIFrameworkProposal {
    pub fn validate(&self) -> crate::Result<()> {
        // Validate message type
        if self.message_type != "framework_proposal" {
            return Err(crate::AppError::SidecarError("Invalid message type".to_string()));
        }

        // Validate framework count (max 3)
        if self.frameworks.len() > 3 {
            return Err(crate::AppError::SidecarError("Too many frameworks".to_string()));
        }

        // Validate confidence range
        if self.conversation_context.confidence < 0.0 || self.conversation_context.confidence > 1.0 {
            return Err(crate::AppError::SidecarError("Invalid confidence value".to_string()));
        }

        Ok(())
    }
}

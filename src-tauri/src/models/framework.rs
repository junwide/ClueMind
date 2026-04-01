use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeFramework {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub structure_type: StructureType,
    pub nodes: Vec<FrameworkNode>,
    pub edges: Vec<FrameworkEdge>,
    pub created_from_drops: Vec<Uuid>,
    pub lifecycle: FrameworkLifecycle,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkNode {
    pub id: Uuid,
    pub label: String,
    pub content: String,
    pub level: u32,
    pub state: NodeState,
    pub position: Option<Position>,
    pub metadata: NodeMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkEdge {
    pub id: Uuid,
    pub source: Uuid,
    pub target: Uuid,
    pub relationship: String,
    pub state: EdgeState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StructureType {
    Pyramid,
    Pillars,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NodeState {
    Virtual,
    Confirmed,
    Locked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EdgeState {
    Virtual,
    Confirmed,
    Locked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeMetadata {
    pub created_by: String,
    pub confidence: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_explanation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub reasoning: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FrameworkLifecycle {
    Draft,
    Building,
    Confirmed,
    Locked,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_framework_creation() {
        let framework = KnowledgeFramework {
            id: Uuid::new_v4(),
            title: "Test Framework".to_string(),
            description: "A test framework".to_string(),
            structure_type: StructureType::Pyramid,
            nodes: vec![],
            edges: vec![],
            created_from_drops: vec![],
            lifecycle: FrameworkLifecycle::Draft,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        assert!(!framework.id.to_string().is_empty());
        assert_eq!(framework.title, "Test Framework");
        assert_eq!(framework.lifecycle, FrameworkLifecycle::Draft);
    }

    #[test]
    fn test_framework_node_creation() {
        let node = FrameworkNode {
            id: Uuid::new_v4(),
            label: "Test Node".to_string(),
            content: "Node content".to_string(),
            level: 1,
            state: NodeState::Virtual,
            position: Some(Position { x: 100.0, y: 200.0 }),
            metadata: NodeMetadata {
                created_by: "ai".to_string(),
                confidence: Some(0.95),
                ai_explanation: None,
                source: None,
                reasoning: None,
            },
        };

        assert_eq!(node.label, "Test Node");
        assert_eq!(node.state, NodeState::Virtual);
        assert!(node.position.is_some());
    }

    #[test]
    fn test_framework_edge_creation() {
        let source_id = Uuid::new_v4();
        let target_id = Uuid::new_v4();

        let edge = FrameworkEdge {
            id: Uuid::new_v4(),
            source: source_id,
            target: target_id,
            relationship: "supports".to_string(),
            state: EdgeState::Confirmed,
        };

        assert_eq!(edge.source, source_id);
        assert_eq!(edge.target, target_id);
        assert_eq!(edge.relationship, "supports");
    }

    #[test]
    fn test_node_state_equality() {
        assert_eq!(NodeState::Virtual, NodeState::Virtual);
        assert_ne!(NodeState::Virtual, NodeState::Confirmed);
    }

    #[test]
    fn test_structure_type_serialization() {
        let structure = StructureType::Pyramid;
        let json = serde_json::to_string(&structure).unwrap();
        assert!(json.contains("Pyramid"));
    }
}

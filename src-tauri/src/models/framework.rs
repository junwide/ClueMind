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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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

    #[test]
    fn test_all_node_state_transitions() {
        // Virtual -> Confirmed (valid)
        let mut node = FrameworkNode {
            id: Uuid::new_v4(),
            label: "N".to_string(),
            content: "C".to_string(),
            level: 0,
            state: NodeState::Virtual,
            position: None,
            metadata: NodeMetadata {
                created_by: "ai".to_string(),
                confidence: None,
                ai_explanation: None,
                source: None,
                reasoning: None,
            },
        };
        assert_eq!(node.state, NodeState::Virtual);
        node.state = NodeState::Confirmed;
        assert_eq!(node.state, NodeState::Confirmed);
        node.state = NodeState::Locked;
        assert_eq!(node.state, NodeState::Locked);
    }

    #[test]
    fn test_node_state_serde_roundtrip() {
        for state in [NodeState::Virtual, NodeState::Confirmed, NodeState::Locked] {
            let json = serde_json::to_string(&state).unwrap();
            let parsed: NodeState = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, state);
        }
    }

    #[test]
    fn test_edge_state_serde_roundtrip() {
        for state in [EdgeState::Virtual, EdgeState::Confirmed, EdgeState::Locked] {
            let json = serde_json::to_string(&state).unwrap();
            let parsed: EdgeState = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, state);
        }
    }

    #[test]
    fn test_lifecycle_serde_roundtrip() {
        for lifecycle in [
            FrameworkLifecycle::Draft,
            FrameworkLifecycle::Building,
            FrameworkLifecycle::Confirmed,
            FrameworkLifecycle::Locked,
        ] {
            let json = serde_json::to_string(&lifecycle).unwrap();
            let parsed: FrameworkLifecycle = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, lifecycle);
        }
    }

    #[test]
    fn test_lifecycle_equality() {
        assert_eq!(FrameworkLifecycle::Draft, FrameworkLifecycle::Draft);
        assert_ne!(FrameworkLifecycle::Draft, FrameworkLifecycle::Building);
        assert_ne!(FrameworkLifecycle::Confirmed, FrameworkLifecycle::Locked);
    }

    #[test]
    fn test_structure_type_all_variants() {
        for st in [StructureType::Pyramid, StructureType::Pillars, StructureType::Custom] {
            let json = serde_json::to_string(&st).unwrap();
            let parsed: StructureType = serde_json::from_str(&json).unwrap();
            assert!(matches!(parsed, _st) );
        }
    }

    #[test]
    fn test_position_serialization() {
        let pos = Position { x: 10.5, y: -3.2 };
        let json = serde_json::to_string(&pos).unwrap();
        let parsed: Position = serde_json::from_str(&json).unwrap();
        assert!((parsed.x - 10.5).abs() < f32::EPSILON);
        assert!((parsed.y - (-3.2)).abs() < f32::EPSILON);
    }

    #[test]
    fn test_node_metadata_skip_serializing_if_none() {
        let metadata = NodeMetadata {
            created_by: "user".to_string(),
            confidence: None,
            ai_explanation: None,
            source: None,
            reasoning: None,
        };
        let json = serde_json::to_string(&metadata).unwrap();
        assert!(!json.contains("ai_explanation"));
        assert!(!json.contains("source"));
        assert!(!json.contains("reasoning"));
        assert!(json.contains("created_by"));
    }

    #[test]
    fn test_node_metadata_with_all_fields() {
        let metadata = NodeMetadata {
            created_by: "ai".to_string(),
            confidence: Some(0.85),
            ai_explanation: Some("reason".to_string()),
            source: Some("gpt-4".to_string()),
            reasoning: Some("because".to_string()),
        };
        let json = serde_json::to_string(&metadata).unwrap();
        assert!(json.contains("confidence"));
        assert!(json.contains("ai_explanation"));
        assert!(json.contains("source"));
        assert!(json.contains("reasoning"));

        let parsed: NodeMetadata = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.confidence.unwrap(), 0.85);
        assert_eq!(parsed.ai_explanation.unwrap(), "reason");
    }

    #[test]
    fn test_framework_full_serde_roundtrip() {
        let node_id = Uuid::new_v4();
        let source_id = Uuid::new_v4();
        let target_id = Uuid::new_v4();
        let drop_id = Uuid::new_v4();

        let framework = KnowledgeFramework {
            id: Uuid::new_v4(),
            title: "Full Framework".to_string(),
            description: "With all fields".to_string(),
            structure_type: StructureType::Pillars,
            nodes: vec![FrameworkNode {
                id: node_id,
                label: "Node1".to_string(),
                content: "Content".to_string(),
                level: 2,
                state: NodeState::Confirmed,
                position: Some(Position { x: 1.0, y: 2.0 }),
                metadata: NodeMetadata {
                    created_by: "ai".to_string(),
                    confidence: Some(0.9),
                    ai_explanation: None,
                    source: None,
                    reasoning: None,
                },
            }],
            edges: vec![FrameworkEdge {
                id: Uuid::new_v4(),
                source: source_id,
                target: target_id,
                relationship: "depends_on".to_string(),
                state: EdgeState::Virtual,
            }],
            created_from_drops: vec![drop_id],
            lifecycle: FrameworkLifecycle::Building,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&framework).unwrap();
        let parsed: KnowledgeFramework = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.id, framework.id);
        assert_eq!(parsed.title, "Full Framework");
        assert_eq!(parsed.structure_type, StructureType::Pillars);
        assert_eq!(parsed.nodes.len(), 1);
        assert_eq!(parsed.nodes[0].id, node_id);
        assert_eq!(parsed.edges.len(), 1);
        assert_eq!(parsed.edges[0].source, source_id);
        assert_eq!(parsed.edges[0].target, target_id);
        assert_eq!(parsed.created_from_drops, vec![drop_id]);
        assert_eq!(parsed.lifecycle, FrameworkLifecycle::Building);
    }

    #[test]
    fn test_framework_node_no_position() {
        let node = FrameworkNode {
            id: Uuid::new_v4(),
            label: "NoPos".to_string(),
            content: "C".to_string(),
            level: 0,
            state: NodeState::Virtual,
            position: None,
            metadata: NodeMetadata {
                created_by: "user".to_string(),
                confidence: None,
                ai_explanation: None,
                source: None,
                reasoning: None,
            },
        };
        let json = serde_json::to_string(&node).unwrap();
        let parsed: FrameworkNode = serde_json::from_str(&json).unwrap();
        assert!(parsed.position.is_none());
    }

    #[test]
    fn test_edge_relationship_field() {
        let edge = FrameworkEdge {
            id: Uuid::new_v4(),
            source: Uuid::new_v4(),
            target: Uuid::new_v4(),
            relationship: "supports".to_string(),
            state: EdgeState::Locked,
        };
        let json = serde_json::to_string(&edge).unwrap();
        let parsed: FrameworkEdge = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.relationship, "supports");
        assert!(matches!(parsed.state, EdgeState::Locked));
    }
}

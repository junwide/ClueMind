// tests/rust/framework_state_test.rs
use cluemind::*;
use uuid::Uuid;
use chrono::Utc;

#[test]
fn test_confirm_virtual_node() {
    let mut node = FrameworkNode {
        id: Uuid::new_v4(),
        label: "Test".to_string(),
        content: "Content".to_string(),
        level: 1,
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

    assert!(NodeStateMachine::confirm_node(&mut node).is_ok());
    assert_eq!(node.state, NodeState::Confirmed);
}

#[test]
fn test_cannot_confirm_non_virtual() {
    let mut node = FrameworkNode {
        id: Uuid::new_v4(),
        label: "Test".to_string(),
        content: "Content".to_string(),
        level: 1,
        state: NodeState::Confirmed,
        position: None,
        metadata: NodeMetadata {
            created_by: "ai".to_string(),
            confidence: None,
        ai_explanation: None,
        source: None,
        reasoning: None,
        },
    };

    assert!(NodeStateMachine::confirm_node(&mut node).is_err());
}

#[test]
fn test_lock_confirmed_node() {
    let mut node = FrameworkNode {
        id: Uuid::new_v4(),
        label: "Test".to_string(),
        content: "Content".to_string(),
        level: 1,
        state: NodeState::Confirmed,
        position: None,
        metadata: NodeMetadata {
            created_by: "ai".to_string(),
            confidence: None,
        ai_explanation: None,
        source: None,
        reasoning: None,
        },
    };

    assert!(NodeStateMachine::lock_node(&mut node).is_ok());
    assert_eq!(node.state, NodeState::Locked);
}

#[test]
fn test_concurrency_manager() {
    let mut manager = ConcurrencyManager::new();
    let node_id = Uuid::new_v4();

    assert!(!manager.is_editing(node_id));
    assert!(manager.can_apply_ai_update(node_id));

    manager.start_editing(node_id);
    assert!(manager.is_editing(node_id));
    assert!(!manager.can_apply_ai_update(node_id));

    manager.finish_editing(node_id);
    assert!(!manager.is_editing(node_id));
}

#[test]
fn test_delete_virtual_node() {
    let mut node = FrameworkNode {
        id: Uuid::new_v4(),
        label: "Test".to_string(),
        content: "Content".to_string(),
        level: 1,
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

    assert!(NodeStateMachine::delete_node(&mut node).is_ok());
}

#[test]
fn test_cannot_delete_confirmed_node() {
    let mut node = FrameworkNode {
        id: Uuid::new_v4(),
        label: "Test".to_string(),
        content: "Content".to_string(),
        level: 1,
        state: NodeState::Confirmed,
        position: None,
        metadata: NodeMetadata {
            created_by: "ai".to_string(),
            confidence: None,
        ai_explanation: None,
        source: None,
        reasoning: None,
        },
    };

    assert!(NodeStateMachine::delete_node(&mut node).is_err());
}

#[test]
fn test_is_editable() {
    let virtual_node = FrameworkNode {
        id: Uuid::new_v4(),
        label: "Test".to_string(),
        content: "Content".to_string(),
        level: 1,
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

    let confirmed_node = FrameworkNode {
        id: Uuid::new_v4(),
        label: "Test".to_string(),
        content: "Content".to_string(),
        level: 1,
        state: NodeState::Confirmed,
        position: None,
        metadata: NodeMetadata {
            created_by: "ai".to_string(),
            confidence: None,
        ai_explanation: None,
        source: None,
        reasoning: None,
        },
    };

    let locked_node = FrameworkNode {
        id: Uuid::new_v4(),
        label: "Test".to_string(),
        content: "Content".to_string(),
        level: 1,
        state: NodeState::Locked,
        position: None,
        metadata: NodeMetadata {
            created_by: "ai".to_string(),
            confidence: None,
        ai_explanation: None,
        source: None,
        reasoning: None,
        },
    };

    assert!(NodeStateMachine::is_ai_editable(&virtual_node));
    assert!(NodeStateMachine::is_ai_editable(&confirmed_node));
    assert!(!NodeStateMachine::is_ai_editable(&locked_node));

    assert!(NodeStateMachine::is_user_editable(&virtual_node));
    assert!(NodeStateMachine::is_user_editable(&confirmed_node));
    assert!(!NodeStateMachine::is_user_editable(&locked_node));
}

#[test]
fn test_should_persist() {
    let virtual_node = FrameworkNode {
        id: Uuid::new_v4(),
        label: "Test".to_string(),
        content: "Content".to_string(),
        level: 1,
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

    let confirmed_node = FrameworkNode {
        id: Uuid::new_v4(),
        label: "Test".to_string(),
        content: "Content".to_string(),
        level: 1,
        state: NodeState::Confirmed,
        position: None,
        metadata: NodeMetadata {
            created_by: "ai".to_string(),
            confidence: None,
        ai_explanation: None,
        source: None,
        reasoning: None,
        },
    };

    let locked_node = FrameworkNode {
        id: Uuid::new_v4(),
        label: "Test".to_string(),
        content: "Content".to_string(),
        level: 1,
        state: NodeState::Locked,
        position: None,
        metadata: NodeMetadata {
            created_by: "ai".to_string(),
            confidence: None,
        ai_explanation: None,
        source: None,
        reasoning: None,
        },
    };

    assert!(!NodeStateMachine::should_persist(&virtual_node));
    assert!(NodeStateMachine::should_persist(&confirmed_node));
    assert!(NodeStateMachine::should_persist(&locked_node));
}

#[test]
fn test_cleanup_virtual_nodes() {
    let virtual_id = Uuid::new_v4();
    let confirmed_id = Uuid::new_v4();

    let mut framework = KnowledgeFramework {
        id: Uuid::new_v4(),
        title: "Test".to_string(),
        description: "Test framework".to_string(),
        structure_type: StructureType::Pyramid,
        nodes: vec![
            FrameworkNode {
                id: virtual_id,
                label: "Virtual Node".to_string(),
                content: "Should be removed".to_string(),
                level: 1,
                state: NodeState::Virtual,
                position: None,
                metadata: NodeMetadata {
                    created_by: "ai".to_string(),
                    confidence: None,
                ai_explanation: None,
                source: None,
                reasoning: None,
                },
            },
            FrameworkNode {
                id: confirmed_id,
                label: "Confirmed Node".to_string(),
                content: "Should remain".to_string(),
                level: 1,
                state: NodeState::Confirmed,
                position: None,
                metadata: NodeMetadata {
                    created_by: "ai".to_string(),
                    confidence: None,
                ai_explanation: None,
                source: None,
                reasoning: None,
                },
            },
        ],
        edges: vec![],
        created_from_drops: vec![],
        lifecycle: FrameworkLifecycle::Draft,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let removed = CleanupManager::cleanup_virtual_nodes(&mut framework);
    assert_eq!(removed, 1);
    assert_eq!(framework.nodes.len(), 1);
    assert_eq!(framework.nodes[0].id, confirmed_id);
}

#[test]
fn test_confirm_all_virtual_nodes() {
    let mut framework = KnowledgeFramework {
        id: Uuid::new_v4(),
        title: "Test".to_string(),
        description: "Test framework".to_string(),
        structure_type: StructureType::Pyramid,
        nodes: vec![
            FrameworkNode {
                id: Uuid::new_v4(),
                label: "Node 1".to_string(),
                content: "Content 1".to_string(),
                level: 1,
                state: NodeState::Virtual,
                position: None,
                metadata: NodeMetadata {
                    created_by: "ai".to_string(),
                    confidence: None,
                ai_explanation: None,
                source: None,
                reasoning: None,
                },
            },
            FrameworkNode {
                id: Uuid::new_v4(),
                label: "Node 2".to_string(),
                content: "Content 2".to_string(),
                level: 1,
                state: NodeState::Virtual,
                position: None,
                metadata: NodeMetadata {
                    created_by: "ai".to_string(),
                    confidence: None,
                ai_explanation: None,
                source: None,
                reasoning: None,
                },
            },
            FrameworkNode {
                id: Uuid::new_v4(),
                label: "Node 3".to_string(),
                content: "Content 3".to_string(),
                level: 1,
                state: NodeState::Confirmed,
                position: None,
                metadata: NodeMetadata {
                    created_by: "ai".to_string(),
                    confidence: None,
                ai_explanation: None,
                source: None,
                reasoning: None,
                },
            },
        ],
        edges: vec![],
        created_from_drops: vec![],
        lifecycle: FrameworkLifecycle::Draft,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let confirmed = CleanupManager::confirm_all_virtual_nodes(&mut framework);
    assert_eq!(confirmed, 2);
    assert_eq!(framework.nodes[0].state, NodeState::Confirmed);
    assert_eq!(framework.nodes[1].state, NodeState::Confirmed);
    assert_eq!(framework.nodes[2].state, NodeState::Confirmed);
}

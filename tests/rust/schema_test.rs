// tests/rust/schema_test.rs
use reviewyourmind::{
    AIFrameworkProposal,
    ConversationContext,
    FrameworkProposal,
    ProposalNode,
    ProposalEdge,
    NodeState,
    StructureType,
};
use uuid::Uuid;

#[test]
fn test_framework_proposal_validation() {
    let proposal = AIFrameworkProposal {
        message_type: "framework_proposal".to_string(),
        frameworks: vec![],
        conversation_context: ConversationContext {
            turn_number: 1,
            user_intent: "organize".to_string(),
            confidence: 0.85,
        },
    };

    assert!(proposal.validate().is_ok());
}

#[test]
fn test_invalid_confidence() {
    let proposal = AIFrameworkProposal {
        message_type: "framework_proposal".to_string(),
        frameworks: vec![],
        conversation_context: ConversationContext {
            turn_number: 1,
            user_intent: "organize".to_string(),
            confidence: 1.5,  // Invalid value
        },
    };

    assert!(proposal.validate().is_err());
}

#[test]
fn test_invalid_message_type() {
    let proposal = AIFrameworkProposal {
        message_type: "invalid_type".to_string(),
        frameworks: vec![],
        conversation_context: ConversationContext {
            turn_number: 1,
            user_intent: "organize".to_string(),
            confidence: 0.5,
        },
    };

    assert!(proposal.validate().is_err());
}

#[test]
fn test_too_many_frameworks() {
    let frameworks: Vec<FrameworkProposal> = (0..4)
        .map(|i| FrameworkProposal {
            id: Uuid::new_v4(),
            title: format!("Framework {}", i),
            structure_type: StructureType::Pyramid,
            nodes: vec![],
            edges: vec![],
        })
        .collect();

    let proposal = AIFrameworkProposal {
        message_type: "framework_proposal".to_string(),
        frameworks,
        conversation_context: ConversationContext {
            turn_number: 1,
            user_intent: "organize".to_string(),
            confidence: 0.5,
        },
    };

    assert!(proposal.validate().is_err());
}

#[test]
fn test_framework_proposal_with_nodes_and_edges() {
    let node1 = ProposalNode {
        id: Uuid::new_v4(),
        label: "Core Concept".to_string(),
        content: "The main idea".to_string(),
        level: 1,
        state: NodeState::Virtual,
    };

    let node2 = ProposalNode {
        id: Uuid::new_v4(),
        label: "Supporting Idea".to_string(),
        content: "Supporting content".to_string(),
        level: 2,
        state: NodeState::Virtual,
    };

    let edge = ProposalEdge {
        id: Uuid::new_v4(),
        source: node1.id,
        target: node2.id,
        relationship: "supports".to_string(),
    };

    let framework = FrameworkProposal {
        id: Uuid::new_v4(),
        title: "Test Framework".to_string(),
        structure_type: StructureType::Pyramid,
        nodes: vec![node1, node2],
        edges: vec![edge],
    };

    let proposal = AIFrameworkProposal {
        message_type: "framework_proposal".to_string(),
        frameworks: vec![framework],
        conversation_context: ConversationContext {
            turn_number: 1,
            user_intent: "organize".to_string(),
            confidence: 0.9,
        },
    };

    assert!(proposal.validate().is_ok());
}

#[test]
fn test_confidence_boundary_values() {
    // Test confidence = 0.0 (valid)
    let proposal_min = AIFrameworkProposal {
        message_type: "framework_proposal".to_string(),
        frameworks: vec![],
        conversation_context: ConversationContext {
            turn_number: 1,
            user_intent: "organize".to_string(),
            confidence: 0.0,
        },
    };
    assert!(proposal_min.validate().is_ok());

    // Test confidence = 1.0 (valid)
    let proposal_max = AIFrameworkProposal {
        message_type: "framework_proposal".to_string(),
        frameworks: vec![],
        conversation_context: ConversationContext {
            turn_number: 1,
            user_intent: "organize".to_string(),
            confidence: 1.0,
        },
    };
    assert!(proposal_max.validate().is_ok());

    // Test confidence < 0.0 (invalid)
    let proposal_negative = AIFrameworkProposal {
        message_type: "framework_proposal".to_string(),
        frameworks: vec![],
        conversation_context: ConversationContext {
            turn_number: 1,
            user_intent: "organize".to_string(),
            confidence: -0.1,
        },
    };
    assert!(proposal_negative.validate().is_err());
}

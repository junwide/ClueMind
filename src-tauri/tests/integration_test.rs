//! Integration tests for config and storage modules
//!
//! This test module verifies that the ConfigManager and MarkdownStorage
//! modules work correctly together in an integrated environment.

use cluemind::{ConfigManager, MarkdownStorage, NodeStateMachine, KnowledgeFramework, FrameworkNode, NodeState, NodeMetadata, StructureType, FrameworkLifecycle};
use tempfile::TempDir;
use uuid::Uuid;
use chrono::Utc;

/// Tests the integration between ConfigManager and MarkdownStorage.
///
/// This test:
/// 1. Creates a temporary directory for isolated testing
/// 2. Tests ConfigManager - load default, modify, save, and reload
/// 3. Tests MarkdownStorage - save, load, and verify content
#[test]
fn test_config_and_storage_integration() {
    let temp_dir = TempDir::new().unwrap();

    // Test ConfigManager
    let config_manager = ConfigManager::new(temp_dir.path().to_path_buf());

    // Load default config
    let mut config = config_manager.load().unwrap();
    assert_eq!(config.ui.theme, "light");

    // Modify and save config
    config.ui.theme = "dark".to_string();
    config.ui.font_size = 16;
    config_manager.save(&config).unwrap();

    // Reload and verify changes persisted
    let loaded_config = config_manager.load().unwrap();
    assert_eq!(loaded_config.ui.theme, "dark");
    assert_eq!(loaded_config.ui.font_size, 16);

    // Test MarkdownStorage
    let md_storage = MarkdownStorage::new(temp_dir.path().to_path_buf());

    // Save markdown content
    let test_content = "# Test Framework\n\nThis is a test markdown file.";
    md_storage.save("test.md", test_content).unwrap();

    // Load and verify content
    let content = md_storage.load("test.md").unwrap();
    assert_eq!(content, test_content);

    // Verify file appears in list
    let files = md_storage.list().unwrap();
    assert!(files.contains(&"test.md".to_string()));
}

/// Tests that multiple config saves and loads work correctly.
#[test]
fn test_config_multiple_saves() {
    let temp_dir = TempDir::new().unwrap();
    let config_manager = ConfigManager::new(temp_dir.path().to_path_buf());

    // First save
    let mut config = config_manager.load().unwrap();
    config.ui.theme = "dark".to_string();
    config_manager.save(&config).unwrap();

    // Second save with different values
    let mut config = config_manager.load().unwrap();
    assert_eq!(config.ui.theme, "dark");
    config.ui.theme = "light".to_string();
    config_manager.save(&config).unwrap();

    // Verify final state
    let final_config = config_manager.load().unwrap();
    assert_eq!(final_config.ui.theme, "light");
}

/// Tests that multiple markdown files can be managed.
#[test]
fn test_storage_multiple_files() {
    let temp_dir = TempDir::new().unwrap();
    let md_storage = MarkdownStorage::new(temp_dir.path().to_path_buf());

    // Save multiple files
    md_storage.save("file1.md", "# File 1").unwrap();
    md_storage.save("file2.md", "# File 2").unwrap();
    md_storage.save("file3.md", "# File 3").unwrap();

    // Verify all files exist
    let files = md_storage.list().unwrap();
    assert_eq!(files.len(), 3);

    // Verify content of each file
    assert_eq!(md_storage.load("file1.md").unwrap(), "# File 1");
    assert_eq!(md_storage.load("file2.md").unwrap(), "# File 2");
    assert_eq!(md_storage.load("file3.md").unwrap(), "# File 3");
}

/// Tests that config and storage can coexist in the same directory.
#[test]
fn test_config_and_storage_coexistence() {
    let temp_dir = TempDir::new().unwrap();
    let base_path = temp_dir.path().to_path_buf();

    // Initialize both managers with the same base path
    let config_manager = ConfigManager::new(base_path.clone());
    let md_storage = MarkdownStorage::new(base_path);

    // Save config
    let mut config = config_manager.load().unwrap();
    config.ui.theme = "dark".to_string();
    config_manager.save(&config).unwrap();

    // Save markdown
    md_storage.save("notes.md", "# My Notes").unwrap();

    // Verify both exist and work
    let loaded_config = config_manager.load().unwrap();
    assert_eq!(loaded_config.ui.theme, "dark");

    let loaded_md = md_storage.load("notes.md").unwrap();
    assert_eq!(loaded_md, "# My Notes");

    // Config file should not appear in markdown list
    let md_files = md_storage.list().unwrap();
    assert_eq!(md_files.len(), 1);
    assert!(md_files.contains(&"notes.md".to_string()));
}

/// Tests the framework state machine workflow.
///
/// This test verifies the complete workflow:
/// 1. Create a framework with a virtual node
/// 2. Confirm the node (Virtual -> Confirmed)
/// 3. Lock the node (Confirmed -> Locked)
#[test]
fn test_framework_state_workflow() {
    let mut framework = KnowledgeFramework {
        id: Uuid::new_v4(),
        title: "Test Framework".to_string(),
        description: "Test framework for state workflow".to_string(),
        structure_type: StructureType::Pyramid,
        nodes: vec![FrameworkNode {
            id: Uuid::new_v4(),
            label: "Node 1".to_string(),
            content: "Content for node 1".to_string(),
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
        }],
        edges: vec![],
        created_from_drops: vec![],
        lifecycle: FrameworkLifecycle::Building,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    // Verify initial state
    assert_eq!(framework.nodes[0].state, NodeState::Virtual);
    assert_eq!(framework.lifecycle, FrameworkLifecycle::Building);

    // Confirm node: Virtual -> Confirmed
    let confirm_result = NodeStateMachine::confirm_node(&mut framework.nodes[0]);
    assert!(confirm_result.is_ok(), "Should be able to confirm a virtual node");
    assert_eq!(framework.nodes[0].state, NodeState::Confirmed);

    // Lock node: Confirmed -> Locked
    let lock_result = NodeStateMachine::lock_node(&mut framework.nodes[0]);
    assert!(lock_result.is_ok(), "Should be able to lock a confirmed node");
    assert_eq!(framework.nodes[0].state, NodeState::Locked);

    // Verify the node is no longer editable
    assert!(!NodeStateMachine::is_ai_editable(&framework.nodes[0]));
    assert!(!NodeStateMachine::is_user_editable(&framework.nodes[0]));
    assert!(NodeStateMachine::should_persist(&framework.nodes[0]));
}

/// Tests that invalid state transitions are rejected.
#[test]
fn test_framework_invalid_state_transitions() {
    // Create a node in Locked state
    let mut locked_node = FrameworkNode {
        id: Uuid::new_v4(),
        label: "Locked Node".to_string(),
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

    // Should not be able to confirm a locked node
    let confirm_result = NodeStateMachine::confirm_node(&mut locked_node);
    assert!(confirm_result.is_err(), "Should not be able to confirm a locked node");
    assert_eq!(locked_node.state, NodeState::Locked);

    // Should not be able to delete a locked node
    let delete_result = NodeStateMachine::delete_node(&mut locked_node);
    assert!(delete_result.is_err(), "Should not be able to delete a locked node");
}

/// Tests multi-node framework state management.
#[test]
fn test_multi_node_framework_workflow() {
    let mut framework = KnowledgeFramework {
        id: Uuid::new_v4(),
        title: "Multi-Node Framework".to_string(),
        description: "Framework with multiple nodes".to_string(),
        structure_type: StructureType::Pillars,
        nodes: vec![
            FrameworkNode {
                id: Uuid::new_v4(),
                label: "Root Node".to_string(),
                content: "Root content".to_string(),
                level: 0,
                state: NodeState::Confirmed,
                position: None,
                metadata: NodeMetadata {
                    created_by: "user".to_string(),
                    confidence: Some(1.0),
                    ai_explanation: None,
                    source: None,
                    reasoning: None,
                },
            },
            FrameworkNode {
                id: Uuid::new_v4(),
                label: "Virtual Child 1".to_string(),
                content: "Child 1 content".to_string(),
                level: 1,
                state: NodeState::Virtual,
                position: None,
                metadata: NodeMetadata {
                    created_by: "ai".to_string(),
                    confidence: Some(0.9),
                    ai_explanation: None,
                    source: None,
                    reasoning: None,
                },
            },
            FrameworkNode {
                id: Uuid::new_v4(),
                label: "Virtual Child 2".to_string(),
                content: "Child 2 content".to_string(),
                level: 1,
                state: NodeState::Virtual,
                position: None,
                metadata: NodeMetadata {
                    created_by: "ai".to_string(),
                    confidence: Some(0.85),
                    ai_explanation: None,
                    source: None,
                    reasoning: None,
                },
            },
        ],
        edges: vec![],
        created_from_drops: vec![],
        lifecycle: FrameworkLifecycle::Building,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    // Verify initial state
    assert_eq!(framework.nodes.len(), 3);
    assert_eq!(framework.nodes[0].state, NodeState::Confirmed);
    assert_eq!(framework.nodes[1].state, NodeState::Virtual);
    assert_eq!(framework.nodes[2].state, NodeState::Virtual);

    // Confirm virtual nodes
    NodeStateMachine::confirm_node(&mut framework.nodes[1]).unwrap();
    NodeStateMachine::confirm_node(&mut framework.nodes[2]).unwrap();

    assert_eq!(framework.nodes[1].state, NodeState::Confirmed);
    assert_eq!(framework.nodes[2].state, NodeState::Confirmed);

    // Lock root node
    NodeStateMachine::lock_node(&mut framework.nodes[0]).unwrap();
    assert_eq!(framework.nodes[0].state, NodeState::Locked);

    // Other nodes should still be editable
    assert!(NodeStateMachine::is_ai_editable(&framework.nodes[1]));
    assert!(NodeStateMachine::is_user_editable(&framework.nodes[2]));
}

mod shortcuts_test {
    use cluemind::ShortcutManager;

    #[test]
    fn test_shortcut_manager_has_fallbacks() {
        let manager = ShortcutManager::new();
        // 验证至少有 2 个备选快捷键
        assert!(manager.fallback_shortcuts().len() >= 2);
    }

    #[test]
    fn test_default_shortcut_format() {
        let manager = ShortcutManager::new();
        let default = manager.default_shortcut();
        // 验证默认快捷键包含 D 键
        let shortcut_str = format!("{:?}", default);
        assert!(shortcut_str.contains("D"));
    }
}

mod drop_test {
    use cluemind::{DropStorage, DropContent};
    use tempfile::TempDir;

    #[test]
    fn test_drop_crud_flow() {
        let temp_dir = TempDir::new().unwrap();
        let storage = DropStorage::new(temp_dir.path().to_path_buf());

        // Create
        let drop = storage.create(DropContent::Text {
            text: "Integration test".to_string(),
        }).unwrap();

        // Read
        let loaded = storage.get(drop.id).unwrap().unwrap();
        assert_eq!(loaded.id, drop.id);

        // List
        let list = storage.list().unwrap();
        assert_eq!(list.len(), 1);

        // Delete
        storage.delete(drop.id).unwrap();
        let loaded = storage.get(drop.id).unwrap();
        assert!(loaded.is_none());
    }
}

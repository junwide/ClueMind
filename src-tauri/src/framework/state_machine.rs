// src-tauri/src/framework/state_machine.rs
use crate::models::{FrameworkNode, NodeState};
use crate::Result;

pub struct NodeStateMachine;

impl NodeStateMachine {
    /// 确认虚拟节点
    pub fn confirm_node(node: &mut FrameworkNode) -> Result<()> {
        match node.state {
            NodeState::Virtual => {
                node.state = NodeState::Confirmed;
                Ok(())
            }
            NodeState::Confirmed | NodeState::Locked => {
                Err(crate::AppError::Validation("只能确认虚拟节点".to_string()))
            }
        }
    }

    /// 锁定已确认节点
    pub fn lock_node(node: &mut FrameworkNode) -> Result<()> {
        match node.state {
            NodeState::Confirmed => {
                node.state = NodeState::Locked;
                Ok(())
            }
            NodeState::Virtual => {
                Err(crate::AppError::Validation("请先确认节点".to_string()))
            }
            NodeState::Locked => {
                Err(crate::AppError::Validation("节点已锁定".to_string()))
            }
        }
    }

    /// 删除虚拟节点（标记为删除）
    pub fn delete_node(node: &mut FrameworkNode) -> Result<()> {
        match node.state {
            NodeState::Virtual => {
                // 在实际实现中，会从框架中移除
                Ok(())
            }
            _ => {
                Err(crate::AppError::Validation("只能删除虚拟节点".to_string()))
            }
        }
    }

    /// 检查节点是否可被 AI 修改
    pub fn is_ai_editable(node: &FrameworkNode) -> bool {
        matches!(node.state, NodeState::Virtual | NodeState::Confirmed)
    }

    /// 检查节点是否可被用户编辑
    pub fn is_user_editable(node: &FrameworkNode) -> bool {
        matches!(node.state, NodeState::Virtual | NodeState::Confirmed)
    }

    /// 检查节点是否需要持久化
    pub fn should_persist(node: &FrameworkNode) -> bool {
        matches!(node.state, NodeState::Confirmed | NodeState::Locked)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::NodeMetadata;
    use uuid::Uuid;

    fn make_node(state: NodeState) -> FrameworkNode {
        FrameworkNode {
            id: Uuid::new_v4(),
            label: "Test".to_string(),
            content: "Content".to_string(),
            level: 0,
            state,
            position: None,
            metadata: NodeMetadata {
                created_by: "test".to_string(),
                confidence: None,
                ai_explanation: None,
                source: None,
                reasoning: None,
            },
        }
    }

    #[test]
    fn test_confirm_virtual_node() {
        let mut node = make_node(NodeState::Virtual);
        assert!(NodeStateMachine::confirm_node(&mut node).is_ok());
        assert_eq!(node.state, NodeState::Confirmed);
    }

    #[test]
    fn test_confirm_confirmed_node_fails() {
        let mut node = make_node(NodeState::Confirmed);
        let result = NodeStateMachine::confirm_node(&mut node);
        assert!(result.is_err());
        assert_eq!(node.state, NodeState::Confirmed); // state unchanged
    }

    #[test]
    fn test_confirm_locked_node_fails() {
        let mut node = make_node(NodeState::Locked);
        let result = NodeStateMachine::confirm_node(&mut node);
        assert!(result.is_err());
        assert_eq!(node.state, NodeState::Locked); // state unchanged
    }

    #[test]
    fn test_lock_confirmed_node() {
        let mut node = make_node(NodeState::Confirmed);
        assert!(NodeStateMachine::lock_node(&mut node).is_ok());
        assert_eq!(node.state, NodeState::Locked);
    }

    #[test]
    fn test_lock_virtual_node_fails() {
        let mut node = make_node(NodeState::Virtual);
        let result = NodeStateMachine::lock_node(&mut node);
        assert!(result.is_err());
        assert_eq!(node.state, NodeState::Virtual); // state unchanged
    }

    #[test]
    fn test_lock_locked_node_fails() {
        let mut node = make_node(NodeState::Locked);
        let result = NodeStateMachine::lock_node(&mut node);
        assert!(result.is_err());
        assert_eq!(node.state, NodeState::Locked); // state unchanged
    }

    #[test]
    fn test_delete_virtual_node() {
        let mut node = make_node(NodeState::Virtual);
        assert!(NodeStateMachine::delete_node(&mut node).is_ok());
    }

    #[test]
    fn test_delete_confirmed_node_fails() {
        let mut node = make_node(NodeState::Confirmed);
        assert!(NodeStateMachine::delete_node(&mut node).is_err());
    }

    #[test]
    fn test_delete_locked_node_fails() {
        let mut node = make_node(NodeState::Locked);
        assert!(NodeStateMachine::delete_node(&mut node).is_err());
    }

    #[test]
    fn test_is_ai_editable() {
        assert!(NodeStateMachine::is_ai_editable(&make_node(NodeState::Virtual)));
        assert!(NodeStateMachine::is_ai_editable(&make_node(NodeState::Confirmed)));
        assert!(!NodeStateMachine::is_ai_editable(&make_node(NodeState::Locked)));
    }

    #[test]
    fn test_is_user_editable() {
        assert!(NodeStateMachine::is_user_editable(&make_node(NodeState::Virtual)));
        assert!(NodeStateMachine::is_user_editable(&make_node(NodeState::Confirmed)));
        assert!(!NodeStateMachine::is_user_editable(&make_node(NodeState::Locked)));
    }

    #[test]
    fn test_should_persist() {
        assert!(!NodeStateMachine::should_persist(&make_node(NodeState::Virtual)));
        assert!(NodeStateMachine::should_persist(&make_node(NodeState::Confirmed)));
        assert!(NodeStateMachine::should_persist(&make_node(NodeState::Locked)));
    }

    #[test]
    fn test_full_lifecycle_virtual_to_locked() {
        let mut node = make_node(NodeState::Virtual);

        // Virtual -> Confirmed
        assert!(NodeStateMachine::confirm_node(&mut node).is_ok());
        assert_eq!(node.state, NodeState::Confirmed);

        // Confirmed -> Locked
        assert!(NodeStateMachine::lock_node(&mut node).is_ok());
        assert_eq!(node.state, NodeState::Locked);

        // Locked node should not be editable or deletable
        assert!(!NodeStateMachine::is_ai_editable(&node));
        assert!(!NodeStateMachine::is_user_editable(&node));
        assert!(NodeStateMachine::should_persist(&node));
        assert!(NodeStateMachine::confirm_node(&mut node).is_err());
        assert!(NodeStateMachine::lock_node(&mut node).is_err());
        assert!(NodeStateMachine::delete_node(&mut node).is_err());
    }
}

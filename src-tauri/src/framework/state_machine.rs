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

// src-tauri/src/framework/cleanup.rs
use crate::models::{KnowledgeFramework, NodeState};
use std::collections::HashSet;
use uuid::Uuid;

pub struct CleanupManager;

impl CleanupManager {
    /// 清理所有虚拟节点及其关联的边
    ///
    /// # Business Decision
    ///
    /// Virtual nodes are AI-generated suggestions that not yet confirmed by the user.
    /// When cleaning up:
    /// 1. Remove all Virtual nodes
    /// 2. Remove edges connected to Virtual nodes (orphans)
    /// 3. This prevents "ghost" edges from persisting
    pub fn cleanup_virtual_nodes(framework: &mut KnowledgeFramework) -> usize {
        let initial_count = framework.nodes.len();

        // Remove virtual nodes
        framework.nodes.retain(|node| {
            node.state != NodeState::Virtual
        });

        // Remove edges connected to virtual nodes (orphans)
        let remaining_node_ids: HashSet<Uuid> = framework.nodes.iter()
            .map(|n| n.id)
            .collect();

        framework.edges.retain(|edge| {
                remaining_node_ids.contains(&edge.source)
                    && remaining_node_ids.contains(&edge.target)
            });

        initial_count - framework.nodes.len()
    }

    /// 将所有虚拟节点转换为已确认节点（保存时）
    pub fn confirm_all_virtual_nodes(framework: &mut KnowledgeFramework) -> usize {
        let mut count = 0;

        for node in &mut framework.nodes {
            if node.state == NodeState::Virtual {
                node.state = NodeState::Confirmed;
                count += 1;
            }
        }

        count
    }
}

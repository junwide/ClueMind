// src-tauri/src/framework/concurrency.rs
use std::collections::HashSet;
use uuid::Uuid;

#[derive(Default)]
pub struct ConcurrencyManager {
    editing_nodes: HashSet<Uuid>,
}

impl ConcurrencyManager {
    pub fn new() -> Self {
        Self {
            editing_nodes: HashSet::new(),
        }
    }

    /// 用户开始编辑节点
    pub fn start_editing(&mut self, node_id: Uuid) {
        self.editing_nodes.insert(node_id);
    }

    /// 用户完成编辑节点
    pub fn finish_editing(&mut self, node_id: Uuid) {
        self.editing_nodes.remove(&node_id);
    }

    /// 检查节点是否正在被编辑
    pub fn is_editing(&self, node_id: Uuid) -> bool {
        self.editing_nodes.contains(&node_id)
    }

    /// 检查是否可以应用 AI 更新
    pub fn can_apply_ai_update(&self, node_id: Uuid) -> bool {
        !self.is_editing(node_id)
    }
}

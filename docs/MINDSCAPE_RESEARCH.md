# Mindscape 可视化深度研究

> Phase B.5 研究文档 — 仅研究，不开发

## 1. 当前实现分析

### 数据模型 (`src/types/mindscape.ts`)

```ts
FrameworkGraphNode {
  id, title, description, lifecycle,
  nodeCount, edgeCount, dropCount,
  createdAt, updatedAt
}

SharedDropEdge {
  sourceId, targetId, sharedDropCount, sharedDropIds
}
```

### 布局算法 (`src/utils/mindscapeLayout.ts`)

当前使用 **Circle Layout**：
- 1 节点：居中
- 2 节点：水平排列
- 3+ 节点：圆形分布，半径 = `min(600, max(250, 250 + (n-3)*80))`
- 起始角度从顶部 (-π/2) 开始

### 视觉组件

- **FrameworkNode**：280×160 卡片，lifecycle 色彩编码（draft/building/confirmed/locked），stats 显示
- **SharedDropEdge**：虚线 Bezier 曲线，strokeWidth 按 sharedDropCount 缩放，标签显示共享素材数
- **MindscapePage**：React Flow canvas + Background(Dots) + Controls + MiniMap

---

## 2. Timeline View（时间线视图）

### 设计

X 轴 = `createdAt`，Y 轴 = `lifecycle`（有序：draft → building → confirmed → locked）。

**数据可用性**：`FrameworkGraphNode` 已包含 `createdAt` 和 `lifecycle`，无需后端变更。

### 实现要点

| 项 | 方案 |
|----|------|
| X 轴 | 解析 `createdAt` → 时间戳，线性映射到像素坐标 |
| Y 轴 | lifecycle 枚举映射为 4 行：`{ draft: 0, building: 1, confirmed: 2, locked: 3 }` |
| 布局 | 自定义 `computeTimelineLayout()` 替代 `computeCircleLayout()` |
| 交互 | 拖拽仅允许水平方向（`dragHandle`/`onNodeDrag` 约束），或完全禁止拖拽 |
| 时间标尺 | React Flow `Panel` 组件 + 自定义刻度 |

### 数据增强

`FrameworkGraphNode` 可选增加 `completedAt`（lifecycle 进入 locked 的时间），用于显示时间跨度。当前无此字段，可从 `updated_at` 近似。

### 适合场景

用户想要看"知识框架随时间的演化"：哪些被快速确认，哪些长期停留在 draft。

---

## 3. Material-Based View（素材中心视图）

### 设计

以 Drop 为中心节点，连接到引用它的所有 Framework。

### 后端需求

需要新 IPC 命令 `list_material_graph`：

```rust
struct MaterialGraphData {
    drops: Vec<MaterialDrop>,       // 所有被引用的 drop
    links: Vec<MaterialLink>,       // drop ↔ framework 连接
}

struct MaterialDrop {
    id: String,
    preview: String,                // 前 100 字
    content_type: String,           // text/url/image/file/voice
    created_at: String,
}

struct MaterialLink {
    drop_id: String,
    framework_id: String,
}
```

当前 `SharedDropEdge.sharedDropIds` 已包含 drop IDs，但前端缺少 drop 详情。可在 `list_framework_graph` 中扩展，或新增独立命令。

### 前端实现

| 项 | 方案 |
|----|------|
| Drop 节点 | 小圆形/方形，按 contentType 用不同图标 |
| Framework 节点 | 复用现有 FrameworkNode，但简化（标题 + lifecycle badge） |
| 连接线 | 细实线，drop → framework |
| 布局 | Force-directed（见第 5 节）最合适，drop 自然聚集在被引用最多的 framework 周围 |
| 筛选 | 可按 contentType 筛选 drop 节点 |

### 适合场景

回答"这个素材被哪些框架引用了？""哪些素材是孤立的？"

---

## 4. Structure-Based View（结构分类视图）

### 设计

按 `structureType` 分组显示框架。

### 数据增强

`FrameworkGraphNode` 当前缺少 `structureType`。需添加：

```ts
// mindscape.ts
interface FrameworkGraphNode {
  // ...existing fields
  structureType: 'Pyramid' | 'Pillars' | 'Custom';  // 新增
}
```

后端 `list_framework_graph` 对应增加此字段（`KnowledgeFramework.structure_type` 已有）。

### 前端实现

| 项 | 方案 |
|----|------|
| 分组 | 3 个区域：Pyramid / Pillars / Custom |
| 布局 | 自定义 `computeGroupedLayout()`，每组内用 sub-circle 或 grid |
| 视觉 | 每组不同背景色/边框，React Flow `Panel` 做组标题 |
| 筛选 | 可折叠/展开单个分组 |

### 适合场景

回答"我有多少金字塔结构？哪些是自定义的？"

---

## 5. React Flow 特性推荐

### 推荐引入的特性

| 特性 | 用途 | 优先级 |
|------|------|--------|
| `Panel` | 视图切换（Circle/Timeline/Material/Structure）控件 | P0 |
| `NodeToolbar` | 悬浮工具栏：查看详情、跳转 Canvas、导出框架 | P1 |
| `useViewport` | 记住用户缩放/平移状态，下次打开恢复 | P1 |
| `animated` edges | 共享 drop 连接线动画（CSS `animated: true`） | P2 |
| `useConnection` | 未来支持用户手动连接框架 | P3 |
| `NodeResizer` | 允许调整框架节点大小 | P3 |

### Panel 示例

```tsx
<ReactFlow ...>
  <Panel position="top-left">
    <div className="flex gap-1">
      <button onClick={() => setView('circle')}>Circle</button>
      <button onClick={() => setView('timeline')}>Timeline</button>
      <button onClick={() => setView('material')}>Material</button>
      <button onClick={() => setView('structure')}>Structure</button>
    </div>
  </Panel>
</ReactFlow>
```

### NodeToolbar 示例

```tsx
// FrameworkNode.tsx 内部
<NodeToolbar>
  <button onClick={() => navigate(id)}>Open Canvas</button>
  <button onClick={() => exportFramework(id)}>Export</button>
</NodeToolbar>
```

---

## 6. 布局算法对比

| 算法 | 库 | 优点 | 缺点 | 推荐场景 |
|------|-----|------|------|---------|
| **Circle** | 自定义（当前） | 简单、O(n)、等距分布 | 大量节点时拥挤、无语义分组 | ≤15 个框架的默认视图 |
| **Force-directed** | `@reactflow/elk` 或 d3-force | 自然聚类、交互感好 | O(n²) 慢、不稳定（每次不同） | Material-Based View |
| **Dagre** | `@dagrejs/dagre` | 层次清晰、稳定 | 需要方向定义、不适合环形关系 | Timeline View（有向图） |
| **ELK** | `elkjs` / `@reactflow/elk` | 最灵活、专业图布局 | 包大(~200KB)、配置复杂 | Structure-Based View |

### 推荐

| 视图 | 首选算法 | 备选 |
|------|---------|------|
| Circle（默认） | 自定义 circle | — |
| Timeline | 自定义（时间轴映射） | Dagre |
| Material | Force-directed (d3-force) | ELK |
| Structure | 自定义分组 | Dagre |

### 新增依赖

```bash
# 如选 d3-force（轻量）
npm install d3-force @types/d3-force

# 如选 ELK（全功能）
npm install elkjs
```

建议 **仅引入 d3-force**（~15KB gzipped），覆盖 Material View 需求。其他视图用自定义布局足够。

---

## 7. 实施路线图建议

| 阶段 | 内容 | 依赖 |
|------|------|------|
| **V1** | Panel 视图切换 + NodeToolbar + useViewport 持久化 | 无新依赖 |
| **V2** | Timeline View（自定义布局） | FrameworkGraphNode.createdAt 已有 |
| **V3** | Structure-Based View | 后端添加 structureType 字段 |
| **V4** | Material-Based View | 新增 `list_material_graph` IPC + d3-force |

V1 可立即开始，不依赖任何后端变更。

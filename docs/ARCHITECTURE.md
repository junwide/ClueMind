# 架构设计

本文档详细说明 ClueMind 的技术架构、核心模块和设计决策。

## 整体架构

ClueMind 采用 **Tauri 混合架构**，结合 Web 技术和原生性能优势。

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (UI)                      │
│          Components + Pages + State (Zustand)              │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Home    │  │RawInbox  │  │Settings  │  │ Framework│   │
│  │  Page    │  │  Page    │  │  Page    │  │   Page   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Layout Components (MainLayout, Sidebar)      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↕ Tauri IPC (JSON-RPC)
┌─────────────────────────────────────────────────────────────┐
│                    Rust Backend (Tauri)                     │
│          Config + Storage + Models + Commands               │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Config   │  │ Storage  │  │ Models   │  │ Commands │   │
│  │ Manager  │  │  Layer   │  │  Layer   │  │  (IPC)   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Logging & Error Handling                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↕ File System
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│         Markdown + JSON + Keyring (Secure Storage)          │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Markdown │  │   JSON   │  │ Keyring  │                  │
│  │  Files   │  │ Metadata │  │ (Secrets)│                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

## 核心模块

### 1. 前端模块 (Frontend)

#### Components (组件)
- **MainLayout**: 主布局容器，包含侧边栏和内容区域
- **Sidebar**: 导航侧边栏，提供页面切换功能

#### Pages (页面)
- **Home**: 首页，展示概览和快速访问
- **RawInbox**: 快速捕获页面，用于收集碎片化信息
- **Settings**: 设置页面，配置应用参数

#### State Management (状态管理)
- **Zustand**: 轻量级状态管理库
- 全局状态: 用户配置、当前视图、UI 状态

#### Types (类型定义)
```typescript
// src/types/drop.ts
interface Drop {
  id: string;
  content: string;
  created_at: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

// src/types/framework.ts
interface KnowledgeFramework {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  drops: string[];  // Drop IDs
}

// src/types/config.ts
interface AppConfig {
  theme: 'light' | 'dark';
  ai_provider?: string;
  data_directory: string;
}
```

### 2. 后端模块 (Backend - Rust)

#### Models (数据模型)

**Drop** (`src-tauri/src/models/drop.rs`)
- 快速捕获的信息单元
- 字段: id, content, created_at, tags, metadata
- 序列化: JSON 格式

**KnowledgeFramework** (`src-tauri/src/models/framework.rs`)
- 知识框架结构
- 字段: id, title, content, created_at, updated_at, drops
- 关联: 多个 Drop 实例

**AppConfig** (`src-tauri/src/models/config.rs`)
- 应用配置模型
- 字段: theme, ai_provider, data_directory, api_keys

#### Storage (存储层)

**Markdown Storage** (`src-tauri/src/storage/markdown.rs`)
- 功能: 将知识框架存储为 Markdown 文件
- 格式:
  ```markdown
  # [Framework Title]

  Created: 2024-01-01
  Updated: 2024-01-02

  [Content]

  ## Related Drops
  - drop-id-1
  - drop-id-2
  ```
- 优势: 人类可读，版本控制友好

**JSON Metadata** (`src-tauri/src/storage/json_metadata.rs`)
- 功能: 存储元数据和索引
- 内容: ID 映射、标签索引、关系图
- 优势: 快速查询和搜索

#### Config Management (配置管理)

**Config Manager** (`src-tauri/src/config/manager.rs`)
- 功能: 加载、保存、验证配置
- 存储: TOML 格式
- 位置: `~/.config/cluemind/config.toml`

**Keyring Integration** (`src-tauri/src/config/keyring.rs`)
- 功能: 安全存储敏感信息 (API keys)
- 实现: 使用操作系统密钥链
  - macOS: Keychain
  - Windows: Credential Manager
  - Linux: Secret Service API

#### Error Handling (错误处理)

**Error Types** (`src-tauri/src/error.rs`)
```rust
pub enum AppError {
    IoError(io::Error),
    SerializationError(serde_json::Error),
    ConfigError(String),
    StorageError(String),
    KeyringError(String),
    // ...
}
```

#### Logging (日志系统)

**Tracing Integration** (`src-tauri/src/lib.rs`)
- 框架: `tracing` + `tracing-subscriber`
- 级别: TRACE, DEBUG, INFO, WARN, ERROR
- 输出: 控制台 + 文件 (可选)

### 3. 数据层 (Data Layer)

#### 存储结构

```
~/.local/share/cluemind/
├── frameworks/           # Markdown 知识框架
│   ├── framework-001.md
│   └── framework-002.md
├── drops/               # Drop 数据
│   ├── drop-001.json
│   └── drop-002.json
└── metadata/            # 索引和元数据
    ├── index.json       # 全局索引
    └── tags.json        # 标签索引

~/.config/cluemind/
└── config.toml          # 应用配置

[OS Keyring]             # API Keys (安全存储)
```

## 数据流

### 用户捕获信息流程

```
1. 用户输入 → RawInbox Page (React)
2. 调用 Tauri Command → save_drop(content)
3. Rust 处理:
   a. 生成 Drop 模型 (id, timestamp)
   b. 序列化为 JSON
   c. 写入 drops/drop-{id}.json
   d. 更新 metadata/index.json
   e. 记录日志 (tracing)
4. 返回结果 → React 前端
5. 更新 UI → 显示成功消息
```

### 加载知识框架流程

```
1. 用户导航 → Framework Page (React)
2. 调用 Tauri Command → load_framework(id)
3. Rust 处理:
   a. 读取 frameworks/framework-{id}.md
   b. 解析 Markdown 内容
   c. 读取 metadata/index.json (获取关联 Drops)
   d. 组装完整数据结构
   e. 记录日志
4. 返回 Framework 数据 → React 前端
5. 渲染 UI → 显示框架内容
```

### 配置更新流程

```
1. 用户修改设置 → Settings Page (React)
2. 调用 Tauri Command → update_config(key, value)
3. Rust 处理:
   a. 验证配置项
   b. 如果是敏感信息 (API key):
      - 存储到 Keyring
   c. 否则:
      - 更新 config.toml
   d. 记录日志
4. 返回成功 → React 前端
5. 更新全局状态 → Zustand store
```

## IPC 通信

### Tauri Commands (Rust → React)

```rust
// Drop 管理
#[tauri::command]
fn save_drop(content: String) -> Result<Drop, AppError>;

#[tauri::command]
fn load_drop(id: String) -> Result<Drop, AppError>;

// Framework 管理
#[tauri::command]
fn create_framework(title: String, content: String) -> Result<KnowledgeFramework, AppError>;

#[tauri::command]
fn load_framework(id: String) -> Result<KnowledgeFramework, AppError>;

// Config 管理
#[tauri::command]
fn get_config() -> Result<AppConfig, AppError>;

#[tauri::command]
fn update_config(key: String, value: String) -> Result<(), AppError>;
```

### 前端调用示例

```typescript
import { invoke } from '@tauri-apps/api/tauri';

// 保存 Drop
const drop = await invoke('save_drop', { content: '我的想法...' });

// 加载 Framework
const framework = await invoke('load_framework', { id: 'framework-001' });

// 获取配置
const config = await invoke('get_config');
```

## 测试策略

### 1. 单元测试 (Unit Tests)

**Rust 测试**
- 位置: 各模块内的 `#[cfg(test)] mod tests`
- 覆盖:
  - Models: 序列化/反序列化测试
  - Storage: 文件读写测试
  - Config: 配置加载/保存测试
  - Error: 错误转换测试

```bash
# 运行所有 Rust 测试
cargo test

# 运行特定模块测试
cargo test --lib storage
```

**TypeScript 测试**
- 工具: Vitest (推荐) / Jest
- 覆盖:
  - Components: UI 渲染测试
  - State: Zustand store 测试
  - Utils: 工具函数测试

### 2. 集成测试 (Integration Tests)

**Rust 集成测试**
- 位置: `src-tauri/tests/`
- 覆盖:
  - Config + Storage 集成
  - 完整工作流测试
  - 文件系统交互测试

```bash
# 运行集成测试
cargo test --test '*'
```

**Tauri 集成测试**
- 工具: Tauri 测试工具
- 覆盖:
  - IPC 通信测试
  - 前后端集成测试

### 3. E2E 测试 (End-to-End Tests)

**工具**: Playwright / WebdriverIO

**测试场景**:
1. 应用启动 → 检查窗口打开
2. 用户捕获信息 → 验证存储
3. 加载框架 → 验证显示
4. 配置更改 → 验证持久化

### 4. 测试覆盖率

**Rust 覆盖率**
```bash
cargo tarpaulin --out Html
```

**前端覆盖率**
```bash
npm run test:coverage
```

目标: 80%+ 代码覆盖率

## 性能优化

### 前端优化
- **代码分割**: React.lazy + Suspense
- **虚拟滚动**: 大列表优化
- **Memoization**: React.memo + useMemo

### 后端优化
- **异步 I/O**: 使用 tokio (Tauri 内置)
- **缓存**: 内存缓存频繁访问的数据
- **批量操作**: 批量读写减少 I/O

### 存储优化
- **索引**: JSON 元数据索引加速查询
- **压缩**: Markdown 文件压缩存储 (可选)
- **清理**: 自动清理过期数据

## 安全考虑

### 1. 敏感信息存储
- **API Keys**: 使用操作系统 Keyring
- **不存储**: 明文密码或密钥

### 2. 文件系统权限
- **最小权限**: 仅访问应用数据目录
- **沙箱化**: Tauri 提供的沙箱环境

### 3. IPC 安全
- **命令验证**: 所有 Tauri Command 验证输入
- **错误处理**: 不泄露敏感错误信息

## 扩展性

### 1. AI 集成 (未来)
- 模块: `src-tauri/src/ai/`
- 支持: GLM / Qwen / OpenAI / Claude API
- 抽象: 统一 AI Provider trait

### 2. 插件系统 (未来)
- Tauri 插件机制
- 自定义命令和 UI 扩展

### 3. 同步功能 (未来)
- 云端同步
- 多设备支持

## 开发工具

### 调试

**前端调试**
- React DevTools
- 浏览器开发者工具

**后端调试**
```bash
RUST_LOG=debug npm run tauri dev
```

### 日志查看

**Rust 日志**
```bash
# 实时查看日志
tail -f ~/.local/share/cluemind/logs/app.log
```

### 性能分析

**Rust 性能**
```bash
cargo flamegraph
```

**前端性能**
- Chrome DevTools Performance Tab

## 部署

### 构建生产版本

```bash
npm run tauri build
```

输出:
- **macOS**: `.dmg` / `.app`
- **Windows**: `.msi` / `.exe`
- **Linux**: `.deb` / `.AppImage`

### 自动更新 (未来)
- Tauri 内置更新机制
- 版本检查和自动下载

## 参考资源

- [Tauri 文档](https://tauri.app)
- [React 文档](https://react.dev)
- [Rust 文档](https://doc.rust-lang.org)
- [Zustand 文档](https://github.com/pmndrs/zustand)

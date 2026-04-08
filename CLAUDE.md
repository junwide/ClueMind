# DropMind (ClueMind)

AI 驱动的知识架构引擎，基于 Tauri 2.0 的跨平台桌面应用。

## 项目概述

**核心功能**：
- 快速信息捕获 (Drop)
- 知识框架构建
- AI 驱动的知识关联
- 本地优先数据存储

## 技术栈

### 前端
| 技术 | 用途 |
|------|------|
| React 18 | UI 框架 |
| TypeScript (strict) | 类型安全 |
| Vite 5 | 构建工具 |
| TailwindCSS | 样式 |
| Zustand | 状态管理 |
| Radix UI | 无障碍组件 |
| Vitest + Testing Library | 测试框架 |

### 后端 (Rust/Tauri)
| Crate | 用途 |
|-------|------|
| tauri 2.0 | 桌面应用框架 |
| tauri-plugin-global-shortcut | 全局快捷键 |
| keyring | API Key 安全存储 |
| reqwest | HTTP 客户端 (AI API 调用) |
| serde / serde_json | 序列化 |
| tokio | 异步运行时 |

## 项目结构

```
src/                    # React 前端
├── components/         # UI 组件
│   ├── AI/            # AI 对话组件
│   ├── Canvas/        # 知识画布
│   ├── Drop/          # Drop 捕获
│   ├── Layout/        # 布局 (含 ErrorBoundary)
│   ├── Mindscape/     # 全景视图组件
│   └── Settings/      # 设置组件
├── pages/             # 页面 (Home, RawInbox, CanvasPage, MindscapePage, Settings)
├── hooks/             # 自定义 Hooks
├── types/             # TypeScript 类型定义 (含 reactFlow.ts)
├── prompts/           # AI Prompt 集中管理
├── utils/             # 工具函数
└── i18n/              # 国际化 (中/英)

src-tauri/             # Rust 后端
├── src/
│   ├── commands/      # Tauri IPC 命令
│   ├── models/        # 数据模型 (Drop, Framework, Config)
│   ├── storage/       # 存储层 (JSON 文件)
│   ├── config/        # 配置管理 + keyring
│   ├── shortcuts/     # 全局快捷键
│   ├── framework/     # 框架工具
│   └── error/         # 错误处理
└── tauri.conf.json    # Tauri 配置

tests/                 # 测试目录
├── react/             # React 组件测试
├── utils/             # 工具函数测试
├── e2e/               # E2E 流程测试
└── rust/              # Rust 集成测试 (项目根目录 tests/rust/)

.github/workflows/     # CI/CD
└── ci.yml             # GitHub Actions 流水线
```

## 开发命令

```bash
# 开发
npm run tauri dev          # 启动 Tauri 开发模式
npm run dev                # 仅前端

# 测试
npm test                   # Vitest (watch)
npm run test:run           # Vitest (单次)
cd src-tauri && cargo test # Rust 测试

# 构建
npm run build              # 构建前端
npm run tauri build        # 构建生产应用

# 代码质量
npx tsc --noEmit           # TypeScript 类型检查
cd src-tauri && cargo clippy # Rust lint
cd src-tauri && cargo fmt  # Rust 格式化
```

## 支持的 LLM Provider

| Provider | ID | 默认模型 | API 格式 |
|----------|-----|---------|---------|
| OpenAI | `openai` | gpt-4o, gpt-4-turbo | OpenAI |
| Claude | `claude` | claude-3-5-sonnet | Anthropic |
| GLM (智谱) | `glm` | glm-4-plus | OpenAI |
| MiniMax | `minimax` | abab6.5s-chat | OpenAI |

---

## 开发流程 (强制)

每个特性或修复必须严格遵循以下流程。未通过验证的代码不得提交。

### 流程步骤

```
1. Plan (规划)
   ↓
2. Implement (实现)
   ↓
3. Write Tests (编写测试)        ← 与实现同步或紧随其后
   ↓
4. Verify (验证)                 ← 必须全部通过才能继续
   ↓
5. Code Review (代码审查)
   ↓
6. Commit (本地提交)             ← 仅本地，不推送
   ↓
7. User Testing (用户测试)       ← 用户确认功能正常
   ↓
8. Push (推送远端)               ← 仅当用户明确要求时
```

### Step 4: Verify — 强制验证清单

每次代码变更后，**必须**执行以下 5 项验证，全部通过才算完成：

```bash
# 1. TypeScript 类型检查 (零错误)
npx tsc --noEmit

# 2. 前端单元测试 (全部通过)
npm run test:run

# 3. Rust 编译检查 (零错误)
cd src-tauri && cargo check

# 4. Rust 测试 (全部通过)
cd src-tauri && cargo test

# 5. Rust lint (零 warning)
cd src-tauri && cargo clippy
```

**验证标准**：
- TypeScript: 0 errors
- Vitest: 所有测试通过，0 failures
- Cargo check: 编译成功
- Cargo test: 0 failures (ignored 不算)
- Cargo clippy: 0 warnings

### Step 3: Write Tests — 测试要求

每个新特性或修复**必须**附带对应测试，不允许提交 TODO 占位测试。

#### 按变更类型的测试要求

| 变更类型 | 必须的测试 |
|---------|-----------|
| 新/改工具函数 | `tests/utils/*.test.ts` — 每个公开函数 ≥1 测试 |
| 新/改 React 组件 | `tests/react/*.test.tsx` — 渲染测试 + 关键交互 |
| 新/改 Rust 模块 | `#[cfg(test)] mod tests` — 在文件底部，覆盖公开接口 |
| 新/改 Tauri IPC 命令 | `tests/e2e/workflow.test.ts` — 数据流验证 |
| Bug 修复 | 回归测试 — 必须覆盖修复的 bug 场景 |
| 类型定义变更 | 确认 `tsc --noEmit` 通过 |

#### 测试文件组织

```
tests/
├── utils/                        # 工具函数单元测试
│   ├── mindscapeLayout.test.ts   # 布局算法
│   ├── dropHelpers.test.ts       # Drop 辅助函数
│   ├── frameworkFormatters.test.ts # 框架格式化
│   ├── contextCompressor.test.ts # 上下文压缩
│   ├── conversationMapper.test.ts # 对话映射
│   └── reactFlowAdapter.test.ts  # React Flow 适配
├── react/                        # 组件测试
│   ├── AIDialog.test.tsx         # AI 对话
│   ├── Canvas.test.tsx           # 画布
│   └── FrameworkNode.test.tsx    # 框架节点
├── e2e/                          # E2E 流程测试
│   └── workflow.test.ts          # 核心工作流
└── setup.ts                      # 测试 setup

src-tauri/src/                    # Rust 内联测试
├── models/drop.rs                # #[cfg(test)] mod tests
├── models/framework.rs           # #[cfg(test)] mod tests
├── storage/drop.rs               # #[cfg(test)] mod tests
├── storage/conversation.rs       # #[cfg(test)] mod tests
├── config/manager.rs             # #[cfg(test)] mod tests
├── commands/ai_commands.rs       # #[cfg(test)] mod tests
└── framework/state_machine.rs    # #[cfg(test)] mod tests
```

#### 测试编写规范

**前端测试**：
- 使用 `@testing-library/react` 的 `render` / `screen` / `fireEvent`
- Mock Tauri API: `vi.mock('@tauri-apps/api/core', ...)`
- Mock React Flow: `vi.mock('@xyflow/react', ...)`
- 每个测试必须有实际断言，禁止 `expect(true).toBe(true)`

**Rust 测试**：
- 使用 `tempfile::tempdir()` 创建临时测试目录
- 序列化/反序列化往返测试
- 状态转换边界测试
- 错误路径测试

---

## 编码规范

### TypeScript/React
- 函数组件 + Hooks
- `strict: true` — 禁止 `any` 类型，禁止 `as` 强制断言（类型守卫优先）
- 路径别名 `@/` 导入
- TailwindCSS 样式
- 用户可见文字必须走 i18n (`useTranslation` / `t()`)
- AI prompt 内容集中在 `src/prompts/`

### Rust
- Result 类型 + 自定义 AppError
- Serde 序列化使用 `camelCase`
- Uuid 作为唯一标识符
- Arc<Mutex<T>> 共享状态
- 模块化组织
- 每个模块底部 `#[cfg(test)] mod tests`

### IPC 通信
- Tauri invoke 调用命令
- Tauri events 异步通知
- 所有数据 JSON 序列化

---

## CI/CD

GitHub Actions 自动运行（`.github/workflows/ci.yml`）：

| Job | 步骤 |
|-----|------|
| frontend | `npm ci` → `tsc --noEmit` → `npm run test:run` |
| backend | `cargo check` → `cargo test` → `cargo clippy -- -D warnings` |

触发条件：push/PR 到 master 分支。

---

## 存储架构

```
~/.local/share/cluemind/
├── drops/               # Drop JSON 文件
├── frameworks/          # 框架 JSON 文件
└── conversations/       # 对话历史

~/.config/ClueMind/
└── provider_configs.json # Provider 配置

[系统密钥环]             # API Keys (安全存储)
```

## 全局快捷键

- **默认**: `Ctrl+Shift+D` (Win/Linux) / `Cmd+Shift+D` (macOS)
- **备选**: `Ctrl/Cmd + Shift + N`, `Ctrl/Cmd + Alt + D`

## 关键文件

| 文件 | 用途 |
|------|------|
| `src/prompts/index.ts` | AI Prompt 集中管理 |
| `src/types/reactFlow.ts` | React Flow 类型定义 |
| `src/utils/contextCompressor.ts` | 对话上下文压缩 |
| `src/components/Layout/ErrorBoundary.tsx` | 全局错误边界 |
| `src/hooks/useAIChat.ts` | AI 对话功能 |
| `src-tauri/src/commands/direct_ai.rs` | 直接 LLM API 调用 |
| `src-tauri/src/models/drop.rs` | Drop 数据模型 |
| `src-tauri/src/models/framework.rs` | 框架数据模型 |

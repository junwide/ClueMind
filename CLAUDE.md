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
| TypeScript | 类型安全 |
| Vite 5 | 构建工具 |
| TailwindCSS | 样式 |
| Zustand | 状态管理 |
| Radix UI | 无障碍组件 |
| Vitest | 测试框架 |

### 后端 (Rust/Tauri)
| Crate | 用途 |
|-------|------|
| tauri 2.0 | 桌面应用框架 |
| tauri-plugin-global-shortcut | 全局快捷键 |
| keyring | API Key 安全存储 |
| reqwest | HTTP 客户端 (AI API 调用) |
| serde / serde_json | 序列化 |
| tokio | 异步运行时 |

### Python Sidecar (可选)
- LangChain / LangGraph 用于 AI 处理
- JSON over stdio 通信

## 项目结构

```
src/                    # React 前端
├── components/         # UI 组件
│   ├── AI/            # AI 对话组件
│   ├── Canvas/        # 知识画布
│   ├── Drop/          # Drop 捕获
│   ├── Layout/        # 布局
│   └── Settings/      # 设置组件
├── pages/             # 页面 (Home, RawInbox, CanvasPage, Settings)
├── hooks/             # 自定义 Hooks
├── types/             # TypeScript 类型定义
└── utils/             # 工具函数

src-tauri/             # Rust 后端
├── src/
│   ├── commands/      # Tauri IPC 命令
│   ├── models/        # 数据模型 (Drop, Framework, Config)
│   ├── storage/       # 存储层 (JSON 文件)
│   ├── config/        # 配置管理 + keyring
│   ├── sidecar/       # Python sidecar 管理
│   ├── shortcuts/     # 全局快捷键
│   ├── framework/     # 框架工具
│   └── error/         # 错误处理
└── tauri.conf.json    # Tauri 配置

sidecar/               # Python AI 处理
├── sidecar/
│   ├── agent/         # LangChain agents
│   ├── models/        # 请求/响应模型
│   └── prompts/       # Prompt 模板
└── requirements.txt
```

## 开发命令

```bash
# 开发
npm run tauri dev          # 启动 Tauri 开发模式
npm run dev                # 仅前端

# 测试
npm test                   # Vitest (watch)
npm run test:run           # Vitest (单次)
cargo test                 # Rust 测试

# 构建
npm run build              # 构建前端
npm run tauri build        # 构建生产应用

# 代码质量
cargo clippy               # Rust lint
cargo fmt                  # Rust 格式化
```

## 支持的 LLM Provider

| Provider | ID | 默认模型 | API 格式 |
|----------|-----|---------|---------|
| OpenAI | `openai` | gpt-4o, gpt-4-turbo | OpenAI |
| Claude | `claude` | claude-3-5-sonnet | Anthropic |
| GLM (智谱) | `glm` | glm-4-plus | OpenAI |
| MiniMax | `minimax` | abab6.5s-chat | OpenAI |

## 编码规范

### TypeScript/React
- 函数组件 + Hooks
- 类型安全的 props 接口
- 路径别名 `@/` 导入
- TailwindCSS 样式

### Rust
- Result 类型 + 自定义 AppError
- Serde 序列化使用 `camelCase`
- Uuid 作为唯一标识符
- Arc<Mutex<T>> 共享状态
- 模块化组织

### IPC 通信
- Tauri invoke 调用命令
- Tauri events 异步通知
- 所有数据 JSON 序列化

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
| `src/pages/Settings.tsx` | API 配置页面 |
| `src/hooks/useAPIKeys.ts` | API Key 管理 |
| `src/hooks/useAIChat.ts` | AI 对话功能 |
| `src-tauri/src/commands/direct_ai.rs` | 直接 LLM API 调用 |
| `src-tauri/src/models/drop.rs` | Drop 数据模型 |
| `src-tauri/src/models/framework.rs` | 框架数据模型 |

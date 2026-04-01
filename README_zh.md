<div align="center">

# ClueMind

### AI 驱动的知识架构升维引擎

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Version](https://img.shields.io/badge/version-0.1.0-orange.svg)](https://github.com/junwide/ClueMind)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8D8.svg)](https://tauri.app)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS-green.svg)](https://github.com/junwide/ClueMind)

**将每日零散信息转化为结构化知识建筑 —— AI 是你的思维伙伴，一起共建思想升维。**

[中文文档](#cluemind-是什么) | [English](README.md)

</div>

---

## ClueMind 是什么？
![Homoe](image/home.png)

AI在飞速发展，迭代的越来越快，而我们还在线性的接受着世界的讯息，应该让AI协助我们完成信息到脉络的构建，那些过去你需要花钱才能获取的知识和认知架构

你每天都会接触大量文章、灵感、聊天记录和阅读笔记，它们零散而好像互不关联？ 而 ClueMind 就是来解决**原始信息**和**深度理解**之间的鸿沟。





| 传统笔记工具 | ClueMind |
|-------------|----------|
|  手动连线、容易杂乱  | AI 协助共建结构化架构 |
| 静态节点图、线性的笔记 | 实时对话驱动的虚实同步生长画布  |
| 割裂的碎片化想法 | AI 发现隐含的关联关系 |
| 被动记录  |  主动升维：AI 先思考 + 用户共同打磨   |


![Homoe](image/en_case.png)
![Homoe](image/zh_case.png)

**核心体验闭环**：一念 Drop → AI 伙伴式复盘 → 知识建筑实时生长 → Mindscape View 全局回顾 → 持续升维

---
## 功能特性
### v0.1（当前版本）

**捕获与录入**
- 全局快捷键 (`Ctrl+Shift+D`) 随时捕获文本/URL —— 系统全局可用
- 轻量级快速输入浮层
- 原始收件箱管理未处理的素材

**AI 伙伴式复盘 Agent**
- AI 先基于当前 Drop + 历史笔记进行内部思考，主动提出 1-3 个可靠框架建议
- 以合作语气对话：“我先帮你搭了一个初步框架，你觉得这个方向如何？我们一起看看能不能更好？”
- 像与资深思维伙伴头脑风暴，而非审问式提问
- 自由对话模式，支持迭代调整
- 多 LLM 提供商支持：OpenAI (GPT-4o)、Claude (Sonnet)、GLM、MiniMax


**交互式知识画布**
- 可视化图编辑器，支持节点和边的操作
- 三态生命周期：虚拟 → 已确认 → 已锁定
- 内联编辑：标签、内容、来源、思考过程
- 拖拽式节点布局
- 关联关系编辑

**隐私与体验**
- 本地优先：所有数据存储在你的设备上
- 双语界面：中文 & English
- 系统密钥环集成，安全存储 API Key
- 会话持久化：从上次中断处继续

**Mindscape View（2D 基础版）**
- 全局思维星图，一览所有知识架构分区
- 重叠知识用**虚线连线 + 半透明副本 + 发光标签**直观展示
- 点击任意结构或重叠区域，可直接进入上下文 AI 深度对话，继续升维

## 开发路线图

### Phase 1 — 核心 MVP (v0.1) ✅
- [x] Drop 捕获系统
- [x] 知识框架数据模型
- [x] AI 框架生成（多提供商）
- [x] 交互式画布，支持节点/边编辑
- [x] 引导式对话流程
- [x] 本地存储与持久化

### Phase 2 — 功能增强 (v0.2+)
- [ ] 框架模板（预置常用领域的知识结构）
- [ ] 富媒体 Drop（图片、文件、语音备忘录）
- [ ] 框架版本历史与差异对比
- [ ] 导出为 Markdown、PNG、PDF
- [ ] 跨框架搜索与关联
- [ ] Windows 平台支持

### Phase 3 — 生态扩展
- [ ] 移动端伴侣应用（随时捕获灵感）
- [ ] 浏览器扩展（一键网页剪藏）
- [ ] 插件系统（自定义 AI 提供商）
- [ ] 协作式框架（多人共建）
- [ ] 知识图谱分析与洞察
- [ ] 命令行工具（批量操作）

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端 | React 18 + TypeScript | UI 框架 |
| | TailwindCSS | 原子化 CSS 样式 |
| | Zustand | 状态管理 |
| | Radix UI | 无障碍组件 |
| 后端 | Tauri 2.0 | 桌面应用框架 |
| | Rust | 核心业务逻辑 |
| | reqwest | HTTP 客户端 (AI API 调用) |
| | keyring | 安全凭证存储 |
| AI | 多提供商 | OpenAI / Claude / GLM / MiniMax |
| 构建 | Vite 5 | 前端打包工具 |
| | Vitest | 前端测试 |

## 快速开始

### 前置要求

- **Node.js** 18+ 和 npm
- **Rust** 1.70+（[安装指南](https://rustup.rs)）
- **Tauri 2.0 CLI**：`npm install -g @tauri-apps/cli`
- **系统依赖**：参考 [Tauri 前置条件](https://v2.tauri.app/start/prerequisites/)

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/junwide/ClueMind.git
cd ClueMind

# 安装前端依赖
npm install

# 启动开发模式
npm run tauri dev
```

### 首次配置

1. 启动应用 —— 你会看到首页
2. 进入**设置**（侧边栏齿轮图标）
3. 配置至少一个 LLM 提供商（如 OpenAI API Key）
4. 点击**测试**验证连接

### 使用流程

1. **捕获**：在任何地方按 `Ctrl+Shift+D` 快速输入文本或 URL
2. **构建**：在首页点击 **新建复盘**，选择你的素材
3. **精炼**：AI 生成知识框架 —— 通过对话确认、编辑或重组
4. **锁定**：锁定重要节点，防止 AI 误修改

## 生产构建

```bash
npm run tauri build
# 输出目录: src-tauri/target/release/bundle/
```

## 开发

```bash
npm run dev           # 仅前端 (Vite 开发服务器)
npm run tauri dev     # 完整 Tauri 开发模式
npm run test:run      # 运行测试（单次）
npm test              # 运行测试（监听模式）
cargo test            # Rust 测试
cargo clippy          # Rust 代码检查
cargo fmt             # 格式化 Rust 代码
```

## 项目结构

```
src/                        # React 前端
├── components/
│   ├── AI/                # AI 对话与交互
│   ├── Canvas/            # 知识图谱画布
│   ├── Drop/              # 快速捕获组件
│   ├── Layout/            # 应用布局与侧边栏
│   └── Settings/          # 设置与配置
├── pages/                 # 页面路由 (Home, Canvas, Inbox, Settings)
├── hooks/                 # 自定义 React Hooks
├── stores/                # Zustand 状态仓库
├── types/                 # TypeScript 类型定义
├── i18n/                  # 国际化 (中文, English)
└── utils/                 # 工具函数

src-tauri/                 # Rust 后端
├── src/
│   ├── commands/          # Tauri IPC 命令处理器
│   ├── models/            # 数据模型 (Drop, Framework, Config)
│   ├── storage/           # JSON 文件存储层
│   ├── config/            # 提供商配置 + 密钥环
│   ├── framework/         # 框架工具函数
│   ├── sidecar/           # Python sidecar 管理
│   └── error/             # 错误处理
└── tauri.conf.json        # Tauri 应用配置
```

## 架构

```
┌─────────────────────────────────────────────┐
│                 React 前端                    │
│  ┌──────────┐ ┌───────────┐ ┌────────────┐  │
│  │   首页   │ │   画布    │ │    设置    │  │
│  └────┬─────┘ └─────┬─────┘ └─────┬──────┘  │
│       │             │              │          │
│  ┌────┴─────────────┴──────────────┴──────┐  │
│  │          Tauri IPC (invoke)             │  │
│  └─────────────────┬──────────────────────┘  │
├────────────────────┼─────────────────────────┤
│               Rust 后端                       │
│  ┌─────────────────┴──────────────────────┐  │
│  │            命令处理器                    │  │
│  └───┬─────────┬──────────┬───────────────┘  │
│  ┌───┴───┐ ┌───┴────┐ ┌───┴────────┐         │
│  │ 存储  │ │ 配置   │ │  直接 AI   │         │
│  │(JSON) │ │+密钥环 │ │ (reqwest)  │         │
│  └───────┘ └────────┘ └────────────┘         │
└──────────────────────────────────────────────┘
         │                    │
    ~/.local/share/      LLM APIs
    cluemind/   (OpenAI/Claude/
    drops/             GLM/MiniMax)
    frameworks/
    conversations/
```

## 数据隐私

ClueMind 采用**本地优先**设计：

- 所有知识框架、素材和对话历史仅存储在你的本地设备
- API Key 安全保存在系统密钥环中（不存入配置文件）
- AI API 调用直接从你的设备发出 —— 无中间服务器
- 无遥测、无分析、无数据收集

## 支持的 LLM 提供商

| 提供商 | 默认模型 | API 格式 |
|--------|---------|---------|
| OpenAI | gpt-4o | OpenAI |
| Claude | claude-3-5-sonnet | Anthropic |
| GLM（智谱）| glm-4.7 | OpenAI |
| MiniMax | minimax 2.7 | OpenAI |

## 贡献

欢迎贡献！无论是 Bug 报告、功能建议还是代码贡献。

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/my-feature`
3. 提交更改：`git commit -m 'Add some feature'`
4. 推送到分支：`git push origin feature/my-feature`
5. 发起 Pull Request

## 开源许可

本项目采用 [Apache License 2.0](LICENSE) 开源协议。

```
Copyright 2024-2026 junwide

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## 作者

**junwide** — [GitHub](https://github.com/junwide)

项目地址：[https://github.com/junwide/ClueMind](https://github.com/junwide/ClueMind)

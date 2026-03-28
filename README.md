# ReviewYourMind

AI 驱动的知识架构升维引擎 - AI-driven Knowledge Architecture Engine

## 项目简介

ReviewYourMind 是一个基于 Tauri + React + Rust 构建的桌面应用，旨在帮助用户通过 AI 技术将碎片化信息转化为结构化知识体系。

核心功能：
- 快速捕获信息 (Drop)
- 知识框架构建
- AI 驱动的知识关联
- 本地优先的数据存储

## 开发环境设置

### 前置要求

- Node.js 18+
- Rust 1.70+
- Python 3.10+ (可选，用于 AI 功能)

### 安装

```bash
# 克隆仓库
git clone https://github.com/junwide/ReviewYourMind.git
cd ReviewYourMind

# 安装前端依赖
npm install

# 安装 Rust 依赖（自动）
npm run tauri dev
```

### 开发

```bash
# 开发模式
npm run tauri dev

# 运行测试
cargo test          # Rust 测试
npm test           # 前端测试（如果已配置）

# 构建
npm run tauri build
```

## 技术栈

### 前端 (Frontend)
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Zustand** - 状态管理
- **TailwindCSS** - 样式框架
- **Radix UI** - 无障碍 UI 组件

### 后端 (Backend)
- **Tauri 2.0** - 桌面应用框架
- **Rust** - 核心业务逻辑
- **serde/serde_json** - 序列化
- **keyring** - 安全存储
- **toml** - 配置管理
- **chrono** - 时间处理
- **tracing** - 日志系统

### 存储 (Storage)
- **Markdown** - 知识框架存储
- **JSON** - 元数据索引
- **Keyring** - 敏感信息安全存储

### AI (可选)
- GLM / Qwen / OpenAI / Claude API 支持

## 项目结构

```
reviewyourmind/
├── src/                    # React 前端源码
│   ├── components/        # 可复用组件
│   │   └── Layout/       # 布局组件
│   ├── pages/            # 页面组件
│   │   ├── Home.tsx      # 首页
│   │   ├── RawInbox.tsx  # 快速捕获
│   │   └── Settings.tsx  # 设置页面
│   ├── types/            # TypeScript 类型定义
│   │   ├── drop.ts       # Drop 数据类型
│   │   ├── framework.ts  # 知识框架类型
│   │   └── config.ts     # 配置类型
│   ├── App.tsx           # 主应用组件
│   ├── main.tsx          # 应用入口
│   └── index.css         # 全局样式
├── src-tauri/            # Rust 后端
│   ├── src/
│   │   ├── models/       # 数据模型
│   │   │   ├── drop.rs   # Drop 模型
│   │   │   ├── framework.rs # 知识框架模型
│   │   │   └── config.rs # 配置模型
│   │   ├── storage/      # 存储层
│   │   │   ├── markdown.rs # Markdown 存储
│   │   │   └── json_metadata.rs # JSON 元数据
│   │   ├── config/       # 配置管理
│   │   │   ├── manager.rs # 配置管理器
│   │   │   └── keyring.rs # 密钥链集成
│   │   ├── error.rs      # 错误类型定义
│   │   ├── lib.rs        # Tauri 应用设置
│   │   └── main.rs       # Rust 入口
│   ├── Cargo.toml        # Rust 依赖
│   └── tauri.conf.json   # Tauri 配置
├── docs/                 # 文档
│   ├── SETUP.md         # 详细设置指南
│   └── ARCHITECTURE.md  # 架构文档
├── public/              # 静态资源
├── data/                # 本地数据存储
├── package.json         # Node.js 依赖
├── vite.config.ts       # Vite 配置
├── tsconfig.json        # TypeScript 配置
├── tailwind.config.js   # TailwindCSS 配置
└── postcss.config.js    # PostCSS 配置
```

## 开发命令

```bash
# 开发
npm run tauri dev          # 启动开发服务器
npm run dev                # 仅启动前端开发服务器

# 测试
cargo test                 # 运行 Rust 测试
cargo test --all-features  # 运行所有测试（包括集成测试）

# 构建
npm run build              # 构建前端
npm run tauri build        # 构建生产应用

# 代码质量
cargo clippy               # Rust lint 检查
cargo fmt                  # Rust 代码格式化
```

## 文档

- [详细设置指南](docs/SETUP.md) - 系统要求和安装步骤
- [架构文档](docs/ARCHITECTURE.md) - 技术架构和设计说明

## 开发路线

### Week 1-2 (当前) - 基础设施
- ✅ Tauri 项目初始化
- ✅ React UI 骨架
- ✅ Rust 数据模型
- ✅ 存储层实现
- ✅ 配置管理
- ✅ 日志系统
- ✅ 测试覆盖

## 贡献

欢迎贡献！请查看 GitHub Issues 了解待办事项。

## 许可证

MIT

## 联系方式

- GitHub: [@junwide](https://github.com/junwide)
- 项目链接: [https://github.com/junwide/ReviewYourMind](https://github.com/junwide/ReviewYourMind)

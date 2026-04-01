# 开发环境设置指南

本文档提供 ClueMind 开发环境的详细设置说明。

## 系统要求

### 通用要求

- **Node.js**: 18.0 或更高版本
- **Rust**: 1.70 或更高版本
- **包管理器**: npm (随 Node.js 安装)
- **Git**: 用于版本控制

### 操作系统特定要求

#### macOS

1. **Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```

2. **Rust 安装**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

3. **Node.js 安装**
   - 方式 1: 从 [nodejs.org](https://nodejs.org) 下载安装包
   - 方式 2: 使用 nvm (推荐)
     ```bash
     curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
     nvm install 18
     nvm use 18
     ```

#### Windows

1. **Visual Studio Build Tools**
   - 下载并安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)
   - 选择 "Desktop development with C++" 工作负载

2. **Rust 安装**
   - 访问 [rustup.rs](https://rustup.rs)
   - 下载并运行 `rustup-init.exe`

3. **Node.js 安装**
   - 从 [nodejs.org](https://nodejs.org) 下载 Windows 安装包
   - 或使用 [nvm-windows](https://github.com/coreybutler/nvm-windows)

4. **WebView2** (Windows 10/11 通常已预装)
   - 如果缺失，从 [Microsoft Edge WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) 下载

#### Linux (Ubuntu/Debian)

1. **Build Essentials**
   ```bash
   sudo apt update
   sudo apt install build-essential libgtk-3-dev libwebkit2gtk-4.0-dev \
       libappindicator3-dev librsvg2-dev patchelf
   ```

2. **Rust 安装**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source $HOME/.cargo/env
   ```

3. **Node.js 安装**
   - 使用 nvm (推荐):
     ```bash
     curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
     source ~/.bashrc
     nvm install 18
     nvm use 18
     ```
   - 或使用包管理器:
     ```bash
     curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
     sudo apt install -y nodejs
     ```

## 安装步骤

### 1. 克隆仓库

```bash
git clone https://github.com/junwide/ClueMind.git
cd ClueMind
```

### 2. 安装前端依赖

```bash
npm install
```

这将安装以下核心依赖：
- React 18
- Vite
- TypeScript
- TailwindCSS
- Zustand
- Radix UI

### 3. 安装 Rust 依赖

Rust 依赖会在首次运行时自动安装。你也可以手动构建：

```bash
cd src-tauri
cargo build
cd ..
```

核心 Rust 依赖包括：
- tauri 2.0
- serde / serde_json
- uuid
- chrono
- keyring
- toml
- tracing / tracing-subscriber

### 4. 配置开发环境 (可选)

#### 设置 Git Hooks

```bash
# 安装 husky (如果项目使用)
npm run prepare
```

#### IDE 推荐

- **VS Code** (推荐)
  - 安装扩展:
    - rust-analyzer
    - Tauri
    - TypeScript and JavaScript Language Features
    - Tailwind CSS IntelliSense

- **IntelliJ IDEA / WebStorm**
  - 安装 Rust 插件

## 开发服务器

### 启动完整开发环境

```bash
npm run tauri dev
```

这将同时启动：
- Vite 开发服务器 (前端热重载)
- Tauri 应用窗口 (Rust 后端)

### 仅启动前端开发服务器

```bash
npm run dev
```

前端将在 `http://localhost:5173` 运行。

### 仅编译 Rust 后端

```bash
cd src-tauri
cargo build          # Debug 模式
cargo build --release  # Release 模式
```

## 常见问题

### 问题: `cargo: not found`

**解决方案**: 确保 Rust 已正确安装并添加到 PATH。
```bash
source $HOME/.cargo/env  # Linux/macOS
# 或重启终端
```

### 问题: Tauri 构建失败

**解决方案**: 检查是否安装了所有系统依赖。

- **Linux**: 确保安装了 `libgtk-3-dev` 和 `libwebkit2gtk-4.0-dev`
- **Windows**: 确保 Visual Studio Build Tools 已正确安装
- **macOS**: 确保 Xcode Command Line Tools 已安装

### 问题: Node 版本不兼容

**解决方案**: 使用 nvm 切换到正确的 Node 版本。
```bash
nvm install 18
nvm use 18
```

### 问题: keyring 权限错误

**解决方案**:
- **Linux**: 确保有一个可用的密钥环服务 (如 GNOME Keyring)
- **macOS**: 确保 Keychain Access 正常工作
- **Windows**: 确保 Windows Credential Manager 可用

## 下一步

环境设置完成后：

1. 查看 [ARCHITECTURE.md](./ARCHITECTURE.md) 了解项目架构
2. 运行 `npm run tauri dev` 启动开发环境
3. 查看 `src/` 和 `src-tauri/src/` 了解代码结构
4. 开始开发！

## 获取帮助

- **GitHub Issues**: [项目 Issues](https://github.com/junwide/ClueMind/issues)
- **Tauri 文档**: [https://tauri.app](https://tauri.app)
- **Rust 文档**: [https://doc.rust-lang.org](https://doc.rust-lang.org)

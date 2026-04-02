# ClueMind

### AI That Thinks Before You Do

<p align="center">

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8D8.svg)](https://tauri.app)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-green.svg)](https://github.com/junwide/ClueMind)
[![Stars](https://img.shields.io/github/stars/junwide/ClueMind?style=social)](https://github.com/junwide/ClueMind/stargazers)
[![Forks](https://img.shields.io/github/forks/junwide/ClueMind?style=social)](https://github.com/junwide/ClueMind/network/members)

</p>

<div align="center">

**[Product Landing Page](https://junwide.github.io/ClueMind/)** · **[中文介绍页](https://junwide.github.io/ClueMind/)** · [Report Bug](https://github.com/junwide/ClueMind/issues) · [Request Feature](https://github.com/junwide/ClueMind/issues)

</div>

---

> **Most AI tools answer questions. ClueMind thinks before you do.**

ClueMind is an open-source AI knowledge architecture engine that transforms your daily scattered information — articles, ideas, notes, chat logs — into structured cognitive frameworks. It's not a Q&A tool or a storage app. It's a **thinking partner** that proposes structure first, then refines with you.

---

## Why ClueMind

You consume information linearly. But knowledge only becomes valuable when it's structured.

| The Old Way | ClueMind |
|---|---|
| Passive capture, forgotten later | Active elevation: AI thinks first |
| Manual linking, easily gets messy | AI discovers hidden relationships |
| Static nodes, linear notes | Real-time conversation-driven canvas |
| Scattered thoughts, no overview | Mindscape — see all your frameworks at once |

---

## How It Works

```
One-Thought Drop → AI Partner Review → Knowledge Architecture Growth
                                                         ↓
                                     Mindscape Overview ← Continuous Elevation
```

1. **Drop** — Press `Ctrl+Shift+D` anywhere to capture text, URLs, or ideas. Works system-wide.
2. **AI Review** — AI reads your drops + history, proposes 1-3 framework structures. Not Q&A — it's a thinking partner.
3. **Refine** — Chat with AI to confirm, reorganize, or expand the framework.
4. **Lock** — Lock important nodes to protect them from AI modifications.
5. **Mindscape** — Step back and see all your frameworks at once. Discover overlaps you never noticed.

---

## Screenshots

### Home Dashboard
![Home](image/home.png)

### AI Partner Review + Knowledge Canvas
![Case EN](image/en_case.png)
![Case ZH](image/zh_case.png)

---

## Features

### Core Loop
- **Global Shortcut** (`Ctrl+Shift+D`) — capture anywhere, anytime
- **AI Partner Review** — AI proposes frameworks proactively, not just answers questions
- **Interactive Knowledge Canvas** — drag, connect, edit nodes and edges
- **Three-state Lifecycle** — Virtual → Confirmed → Locked
- **Mindscape View** — global overview of all your knowledge frameworks

### Privacy & Freedom
- **Local-first** — all data stays on your device
- **No cloud** — no data collection, no telemetry
- **API keys in system keyring** — never stored in config files
- **Bilingual UI** — English & Chinese built-in

### Multi-AI Support
OpenAI GPT-4o · Anthropic Claude (Sonnet) · Zhipu GLM · MiniMax — use whichever you prefer.

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Rust** 1.70+ ([install via rustup](https://rustup.rs))
- **Tauri CLI**: `npm install -g @tauri-apps/cli`

### Run from Source

```bash
git clone https://github.com/junwide/ClueMind.git
cd ClueMind
npm install
npm run tauri dev
```

Then open the app, go to **Settings**, configure your LLM provider API key, and you're ready.

### Build

```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + TailwindCSS |
| State | Zustand |
| Desktop | Tauri 2.0 |
| Core | Rust |
| AI | OpenAI / Claude / GLM / MiniMax |
| Storage | Local JSON + System Keyring |

---

## Roadmap

| Status | Feature |
|---|---|
| ✅ Available | macOS + Windows |
| ✅ Available | Local-first, no cloud |
| ✅ Available | Bilingual UI (EN/ZH) |
| ✅ Available | Multi-AI provider |
| ⏳ Coming Soon | Mobile companion app |
| ⏳ Coming Soon | Browser extension (one-click web clip) |
| ⏳ Coming Soon | Plugin system |
| ⏳ Coming Soon | Collaborative frameworks |
| ⏳ Coming Soon | Knowledge graph analytics |

---

## Contributing

Contributions are welcome! Open an issue to discuss bugs, features, or UX improvements.

- 🐛 [Bug Reports](https://github.com/junwide/ClueMind/issues)
- 💡 [Feature Requests](https://github.com/junwide/ClueMind/issues)
- 📖 [Documentation](https://github.com/junwide/ClueMind/blob/master/README.md)

---

## License

Apache License 2.0 — free to use, modify, and distribute.

---

## Stay Updated

Want to follow the development? Leave your email on the [landing page](https://junwide.github.io/ClueMind/) — no spam, only meaningful updates.

---

<div align="center">

⭐ Star on GitHub if ClueMind resonates with you.

</div>

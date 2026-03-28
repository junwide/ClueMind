# ReviewYourMind

AI-driven knowledge architecture engine built with Tauri, React, and Rust.

## Project Structure

```
reviewyourmind/
├── src/                    # React frontend source
│   ├── App.tsx            # Main application component
│   ├── main.tsx           # Application entry point
│   └── index.css          # Global styles with TailwindCSS
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs        # Rust entry point
│   │   └── lib.rs         # Tauri application setup
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── public/                # Static assets
├── package.json           # Node.js dependencies
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript configuration
├── tailwind.config.js     # TailwindCSS configuration
└── postcss.config.js      # PostCSS configuration
```

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Zustand for state management
- Radix UI components

### Backend
- Tauri 2.0 for desktop application framework
- Rust with key dependencies:
  - serde/serde_json for serialization
  - uuid for unique identifiers
  - chrono for date/time handling
  - tracing for logging
  - keyring for secure storage
  - toml for configuration
  - dirs for system directories

## Development

### Prerequisites
- Node.js 18+
- Rust 1.70+
- Tauri CLI

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run tauri dev
```

### Build

```bash
# Build for production
npm run tauri build
```

## License

MIT

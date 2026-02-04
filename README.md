# 🍇 Grapes IDE - Desktop Only

A modern, powerful **visual full-stack builder** as a native desktop application. Build, design, and deploy web applications entirely from your desktop without managing separate backend/frontend services.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-desktop-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## ✨ Features

### 🎨 Visual Editor
- **Drag & Drop Interface** – Intuitive block-based page building
- **Real-time Preview** – Live updates as you build
- **Responsive Design** – Mobile, tablet, and desktop previews
- **Tailwind CSS Integration** – Built-in Tailwind support
- **Code Preview** – View generated HTML, CSS, and React JSX

### 🛠️ Full-Stack Development
- **Embedded Rust Backend** – RESTful API server built-in
- **SQLite Database** – Local data persistence
- **Frontend Code Generation** – Export React/HTML/CSS
- **Backend Code Generation** – Generate backend logic and database schemas
- **Project Management** – Create, save, import, and export projects

### 📦 Advanced Features
- **Virtual File System** – Organized project file management
- **Schema Management** – Data models, API endpoints, logic flows
- **Code Generation** – Full-stack code from visual designs
- **Local Storage** – All projects stored locally in SQLite
- **Export/Import** – Share projects across devices

---

## 🚀 Quick Start

### Prerequisites

- **Rust** >= 1.75 (for building from source)
- **Node.js** >= 18.0.0
- **npm** or **yarn**

### Installation

#### Option 1: Use Pre-built Binary
```bash
# Download the latest release for your platform
# https://github.com/MohaMedTArEk912/grapes-editor/releases
```

#### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/MohaMedTArEk912/grapes-editor.git
cd grapes-editor

# Install dependencies
npm run install:all

# Build the desktop application
npm run build
```

#### Option 3: Development Mode
```bash
# Install dependencies
npm run install:all

# Run in development mode with hot reload
npm run dev
```

---

## 📁 Project Structure

```
grapes-editor/
├── desktop/                  # Main Tauri Desktop App
│   ├── src/
│   │   ├── lib.rs           # Core Rust library
│   │   ├── main.rs          # Entry point
│   │   ├── backend/         # Embedded API server
│   │   │   ├── mod.rs       # Backend module
│   │   │   ├── routes/      # API route handlers
│   │   │   ├── schema/      # Data schemas
│   │   │   ├── db.rs        # SQLite database layer
│   │   │   ├── state.rs     # App state
│   │   │   └── error.rs     # Error types
│   │   ├── frontend/        # React/TypeScript UI
│   │   │   ├── src/
│   │   │   │   ├── components/  # React components
│   │   │   │   ├── context/     # Context providers
│   │   │   │   ├── hooks/       # Custom hooks
│   │   │   │   └── stores/      # State management
│   │   │   └── package.json
│   │   ├── commands/        # Tauri IPC commands
│   │   ├── generator/       # Code generation
│   │   ├── schema/          # Unified schemas
│   │   ├── storage/         # Storage layer
│   │   └── vfs/             # Virtual file system
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── package.json
│
├── docker-compose.yml       # Docker development setup
├── Dockerfile              # Multi-stage build for containerization
├── package.json            # Root scripts
└── README.md
```

---

## 📡 API Endpoints

The embedded backend provides RESTful APIs for all operations:

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server health check |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/project` | Get current project |
| `POST` | `/api/project` | Create new project |
| `POST` | `/api/project/import` | Import project from JSON |
| `GET` | `/api/project/export` | Export project as JSON |

### Blocks (UI Components)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/blocks` | Add block to project |
| `PUT` | `/api/blocks/:id` | Update block |
| `DELETE` | `/api/blocks/:id` | Delete block |

### Pages
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/pages` | Add page to project |

### Data Models
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/models` | Add data model |

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/endpoints` | Add API endpoint |

### Code Generation
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/generate/frontend` | Generate frontend code |
| `POST` | `/api/generate/backend` | Generate backend code |
| `POST` | `/api/generate/database` | Generate database schema |
| `GET` | `/api/generate/zip` | Download all generated code as ZIP |

---

## 🧪 Development Scripts

### Root Level
```bash
npm run dev              # Start desktop app in development mode
npm run build           # Build production desktop app
npm run tauri          # Direct tauri command access
npm run install:all    # Install all dependencies
```

### Desktop/Tauri Specific
```bash
cd desktop
npm run tauri dev      # Run in dev mode
npm run tauri build    # Build for release
npm run tauri info     # Show system information
```

---

## 🔧 Configuration

### Tauri Configuration (`desktop/tauri.conf.json`)
- **App Title** – "Grapes IDE - Visual Full-Stack Builder"
- **Window Size** – 1400x900 (resizable)
- **Minimum Size** – 1024x768
- **Frontend URL** – Built-in React app

### Backend Configuration (`desktop/Cargo.toml`)
- **Web Framework** – Axum
- **Runtime** – Tokio
- **Database** – rusqlite (SQLite)
- **Serialization** – serde/serde_json

---

## 🐳 Docker Deployment

### Development with Docker
```bash
docker-compose up -d
```

This will build and run the complete desktop application in a container with:
- Frontend: Built from source
- Backend: Embedded Rust API server
- Database: SQLite (persisted to volume)
- API Port: 3001

---

## 📊 Technology Stack

| Layer | Technology |
|-------|-----------|
| **Desktop** | Tauri 2.0, Rust 1.75+ |
| **Frontend** | React, TypeScript, Tailwind CSS, Vite |
| **Backend** | Axum, Tokio, SQLite |
| **Data** | serde (JSON serialization) |
| **Build** | Cargo, npm |

---

## 🔒 Security

- **Local Storage** – All data stored locally in SQLite
- **Tauri Sandboxing** – Desktop app security through Tauri's sandbox
- **IPC Communication** – Type-safe Rust-to-JavaScript bridge
- **API CORS** – Configured for local development

---

## 🚀 Production Deployment

### Build for Production
```bash
npm run build
```

This creates:
- macOS: `.app` bundle
- Windows: `.exe` installer
- Linux: `.AppImage` or `.deb`

### System Requirements
- **macOS** – 10.13+
- **Windows** – 7+ (64-bit)
- **Linux** – Ubuntu 18.04+ equivalent

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- **Rust** – Use `rustfmt` and `clippy`
- **TypeScript** – ESLint + strict mode
- **Commit Messages** – Clear, descriptive messages

---

## 📝 License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) – Desktop framework
- [Axum](https://github.com/tokio-rs/axum) – Web framework
- [React](https://react.dev/) – UI library
- [Tailwind CSS](https://tailwindcss.com/) – Styling
- [SQLite](https://www.sqlite.org/) – Database

---

<p align="center">
  ✨ Build beautiful full-stack web applications with Grapes IDE ✨
</p>

<p align="center">
  Made with ❤️ by Mohamed Tarek
</p>

# 🚀 Akasha

**From zero to deployed SaaS — visually build & export production-ready full-stack applications.**

A native desktop IDE that lets you design pages, model data, define APIs, author logic flows, and generate a complete, deployable codebase — all without leaving the app.

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Rust](https://img.shields.io/badge/Rust-2021-orange.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)

---

## ✨ Features

### 🎨 Visual Editor
- **Drag & Drop Canvas** – Block-based page building with a nestable component tree
- **Responsive Viewport** – Switch between Desktop (1280 px), Tablet (768 px), and Mobile (375 px) with a live dimension readout
- **Style Inspector** – Per-block editing of layout, spacing, typography, backgrounds, borders, and effects
- **Tailwind CSS Integration** – Classes mapped to visual controls; raw class editing available
- **Live Code Preview** – Side-by-side Monaco editor showing generated React/JSX with syntax highlighting

### 🧩 Block System
- **30+ Built-in Blocks** – Container, Text, Image, Button, Input, Form, Link, Video, List, Table, Card, Hero, Navbar, Footer, Sidebar, Modal, Accordion, Tabs, Badge, Avatar, Progress, Select, Checkbox, Radio, Textarea, Divider, Spacer, Icon, Code, Custom HTML
- **Data Bindings** – Bind any block property to variables, API responses, component state, or props
- **Event Handlers** – Attach logic flows to DOM events (onClick, onChange, onSubmit, onFocus, onBlur, onMouseEnter, onMouseLeave, onKeyDown, onKeyUp, onScroll, onLoad)
- **Read-Only Regions** – Generated `@akasha-block` markers in the code editor are visually highlighted and protected

### 🛠️ Full-Stack Code Generation

Akasha generates a **complete, production-grade codebase** you can `npm install && npm start`:

| Layer | Output |
|-------|--------|
| **Frontend** | React 18 + TypeScript + Tailwind CSS, per-page components, auth context & guards, API hooks, client-side routing |
| **Backend** | NestJS + TypeScript, per-model CRUD modules (controller → service → DTO), JWT authentication (register/login/profile), RBAC with `RolesGuard` + `@Roles()` decorator |
| **Database** | Prisma schema with models, fields, relations, enums; migration-ready |
| **Seed Data** | `prisma/seed.ts` with bcrypt-hashed admin user + sample records per model |
| **Tests** | Per-model end-to-end specs (supertest), auth e2e spec, Jest config |
| **API Spec** | OpenAPI 3.0 JSON (Swagger-compatible) |
| **Export** | Download everything as a single `.zip` |

### 🔀 Logic Flow Engine
- **Visual Node Graph** – 22 node types: Start, End, SetVariable, ApiCall, Condition, Loop, MapArray, FilterArray, Navigate, ShowToast, SetState, Emit, Log, Try/Catch, Delay, Parallel, Switch, Transform, Validate, Assign, FunctionCall, Return
- **Logic Compiler** – Compiles node graphs into executable TypeScript functions
- **Flow ↔ Event Binding** – Attach any flow to a block's DOM event from the inspector

### 📊 Data Modeling (ERD)
- **Visual ERD Tab** – Create models, add typed fields (String, Int, Float, Boolean, DateTime, Json, Enum), define relations (OneToOne, OneToMany, ManyToMany)
- **Field Constraints** – Required, unique, default values
- **Relation Management** – Automatic foreign-key inference in generated Prisma schema

### 🌐 API Designer
- **Endpoint Builder** – Define REST endpoints with method, path, auth requirement, RBAC roles
- **Request/Response Body Editor** – Interactive schema editor for request and response shapes (field name, type, required flag, nested objects/arrays)
- **Query & Path Parameters** – Full parameter schema support
- **OpenAPI Export** – One-click OpenAPI 3.0 spec generation

### 📁 Project Management
- **Workspace System** – Global workspace folder; multiple projects per workspace
- **Disk Sync** – Bi-directional sync between in-memory state and the filesystem
- **Virtual File System** – IDE-quality file tree with create/rename/delete for files and folders
- **Import / Export** – Save and load projects as JSON snapshots
- **Project Settings** – Theme, build options, SEO metadata

### ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Save / sync project to disk |
| `Ctrl + G` | Generate all code (frontend + backend + database) |
| `Ctrl + \` | Toggle sidebar |
| `Ctrl + 1–5` | Switch tab — Canvas, Logic, API, ERD, Variables |
| `Escape` | Deselect current block |
| `Delete` | Archive selected block |

---

## 🚀 Quick Start

### Prerequisites

- **Rust** ≥ 1.75
- **Node.js** ≥ 18
- **npm**

### Install & Run

```bash
# Clone
git clone https://github.com/MohaMedTArEk912/akasha.git
cd akasha

# Install JS dependencies
npm run install:all

# Development mode (hot-reload frontend + Rust rebuild)
npm run dev

# — or — production build
npm run build
```

---

## 📁 Project Structure

```
akasha/
├── desktop/                      # Tauri desktop application
│   ├── src/
│   │   ├── main.rs              # Rust entry point
│   │   ├── lib.rs               # Tauri plugin setup + Axum server boot
│   │   │
│   │   ├── backend/             # Embedded REST API (Axum)
│   │   │   ├── mod.rs           # Router composition (46 routes)
│   │   │   ├── db.rs            # SQLite layer (7 tables)
│   │   │   ├── state.rs         # Shared app state (Arc<Mutex>)
│   │   │   ├── error.rs         # AppError → HTTP mapping
│   │   │   └── routes/
│   │   │       ├── workspace.rs # Workspace CRUD + folder picker
│   │   │       ├── project.rs   # Project lifecycle + sync + settings
│   │   │       ├── blocks.rs    # Block CRUD + move + bindings + events
│   │   │       ├── pages.rs     # Page CRUD + disk content read
│   │   │       ├── models.rs    # Data model + field + relation CRUD
│   │   │       ├── endpoints.rs # API endpoint CRUD
│   │   │       ├── logic.rs     # Logic flow CRUD
│   │   │       ├── variables.rs # Variable CRUD
│   │   │       ├── generate.rs  # Code-gen triggers + ZIP + OpenAPI
│   │   │       └── files.rs     # VFS file/folder operations
│   │   │
│   │   ├── schema/              # Rust type definitions
│   │   │   ├── project.rs       # ProjectSchema, ProjectSettings
│   │   │   ├── block.rs         # BlockSchema, DataBinding
│   │   │   ├── data_model.rs    # DataModel, Field, Relation
│   │   │   ├── api.rs           # ApiSchema, DataShape
│   │   │   ├── logic_flow.rs    # LogicFlow, LogicNode
│   │   │   ├── variable.rs      # Variable
│   │   │   └── common.rs        # FieldType, HttpMethod enums
│   │   │
│   │   ├── generator/           # Code generation engines
│   │   │   ├── frontend.rs      # React + Tailwind + Auth + Hooks
│   │   │   ├── backend.rs       # NestJS + Prisma + JWT + RBAC + Tests
│   │   │   ├── database.rs      # Prisma schema from data models
│   │   │   ├── logic_compiler.rs# Logic-flow → TypeScript compiler
│   │   │   ├── openapi.rs       # OpenAPI 3.0 spec generator
│   │   │   └── sync_engine.rs   # Memory ↔ disk synchronization
│   │   │
│   │   ├── commands/            # Tauri IPC commands
│   │   ├── storage/             # Persistence helpers
│   │   └── vfs/                 # Virtual file system
│   │
│   ├── src/frontend/            # React / TypeScript UI
│   │   ├── App.tsx              # Root component + keyboard shortcuts
│   │   ├── components/
│   │   │   ├── Canvas/          # Visual editor, code editor, API list
│   │   │   ├── Dashboard/       # Project dashboard
│   │   │   ├── Editors/         # Property & style editors
│   │   │   ├── FileTree/        # IDE-quality file explorer
│   │   │   ├── Inspector/       # Block inspector + events + bindings
│   │   │   ├── Layout/          # IDE layout shell + sidebar
│   │   │   ├── Modals/          # Dialog windows
│   │   │   ├── Terminal/        # Embedded terminal
│   │   │   ├── Toolbar/         # Top toolbar
│   │   │   ├── UI/              # Shared primitives
│   │   │   └── Visual/          # Visual design panels
│   │   ├── context/             # ThemeContext, ToastContext
│   │   ├── hooks/               # useTauri, useProjectStore,
│   │   │                        #   useEditorSettings, useKeyboardShortcuts
│   │   └── stores/              # projectStore, editorSettingsStore
│   │
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── docker-compose.yml           # Headless API mode
├── Dockerfile                   # Multi-stage build
├── package.json                 # Root dev/build scripts
└── README.md
```

---

## 📡 API Reference

The embedded Axum server exposes **46 RESTful endpoints** on `localhost:3001`.

<details>
<summary><strong>Health</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server health check |

</details>

<details>
<summary><strong>Workspace</strong> (5 routes)</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/workspace` | Get workspace status + project list |
| `POST` | `/api/workspace` | Set global workspace path |
| `GET` | `/api/workspace/pick-folder` | Open native folder picker |
| `GET` | `/api/workspace/projects/:id` | Load a project by ID |
| `DELETE` | `/api/workspace/projects/:id` | Delete a project |

</details>

<details>
<summary><strong>Project</strong> (11 routes)</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/project` | Get current project |
| `POST` | `/api/project` | Create new project |
| `PATCH` | `/api/project` | Rename project |
| `POST` | `/api/project/import` | Import from JSON |
| `GET` | `/api/project/export` | Export as JSON |
| `POST` | `/api/project/reset` | Reset project |
| `POST` | `/api/project/install` | Run `npm install` (client + server) |
| `POST` | `/api/project/sync/root` | Set sync root + initial sync |
| `POST` | `/api/project/sync/now` | Manual sync to disk |
| `POST` | `/api/project/sync/from_disk` | Pull disk changes into memory |
| `PUT` | `/api/project/settings` | Update project settings |

</details>

<details>
<summary><strong>Blocks</strong> (4 routes)</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/blocks` | Add a block |
| `PUT` | `/api/blocks/:id` | Update block property / binding / event |
| `DELETE` | `/api/blocks/:id` | Archive a block |
| `PUT` | `/api/blocks/:id/move` | Move / reorder a block |

</details>

<details>
<summary><strong>Pages</strong> (4 routes)</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/pages` | Add a page |
| `PUT` | `/api/pages/:id` | Update a page |
| `DELETE` | `/api/pages/:id` | Archive a page |
| `GET` | `/api/pages/:id/content` | Read page `.tsx` from disk |

</details>

<details>
<summary><strong>Data Models</strong> (9 routes)</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/models` | List all models |
| `POST` | `/api/models` | Create a model |
| `PUT` | `/api/models/:id` | Update a model |
| `DELETE` | `/api/models/:id` | Archive a model |
| `POST` | `/api/models/:id/fields` | Add a field |
| `PUT` | `/api/models/:id/fields/:fid` | Update a field |
| `DELETE` | `/api/models/:id/fields/:fid` | Delete a field |
| `POST` | `/api/models/:id/relations` | Add a relation |
| `DELETE` | `/api/models/:id/relations/:rid` | Delete a relation |

</details>

<details>
<summary><strong>API Endpoints</strong> (4 routes)</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/endpoints` | List all endpoints |
| `POST` | `/api/endpoints` | Create an endpoint |
| `PUT` | `/api/endpoints/:id` | Update an endpoint |
| `DELETE` | `/api/endpoints/:id` | Archive an endpoint |

</details>

<details>
<summary><strong>Logic Flows</strong> (4 routes)</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/logic` | List all logic flows |
| `POST` | `/api/logic` | Create a flow |
| `PUT` | `/api/logic/:id` | Update a flow |
| `DELETE` | `/api/logic/:id` | Archive a flow |

</details>

<details>
<summary><strong>Variables</strong> (4 routes)</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/variables` | List all variables |
| `POST` | `/api/variables` | Create a variable |
| `PUT` | `/api/variables/:id` | Update a variable |
| `DELETE` | `/api/variables/:id` | Archive a variable |

</details>

<details>
<summary><strong>Code Generation</strong> (5 routes)</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/generate/frontend` | Generate React + Auth + Hooks |
| `POST` | `/api/generate/backend` | Generate NestJS + Prisma + JWT + RBAC + Tests |
| `POST` | `/api/generate/database` | Generate Prisma schema |
| `GET` | `/api/generate/zip` | Download project as ZIP |
| `GET` | `/api/generate/openapi` | Generate OpenAPI 3.0 spec |

</details>

<details>
<summary><strong>File System</strong> (7 routes)</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/files` | List directory (`?path=`) |
| `POST` | `/api/files` | Create a file |
| `POST` | `/api/files/folder` | Create a folder |
| `PUT` | `/api/files/rename` | Rename file / folder |
| `DELETE` | `/api/files/delete` | Delete file / folder |
| `GET` | `/api/files/content` | Read file content (`?path=`) |
| `PUT` | `/api/files/content` | Write file content |

</details>

---

## 🧪 Development

### Scripts

```bash
# Root
npm run dev            # Tauri dev mode (hot-reload)
npm run build          # Production build
npm run install:all    # Install all JS dependencies
npm run dev:log        # Dev mode with RUST_LOG=info

# Desktop
cd desktop
npm run build:frontend # Vite-only build (no Tauri)
npm run preview        # Vite preview server
```

### Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `RUST_LOG` | `warn` | Tracing level (`info`, `debug`, `trace`) |

---

## 📊 Technology Stack

### IDE (what you run)

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop shell | Tauri | 2.0 |
| Backend API | Axum + Tokio | 0.7 / 1 |
| Database | rusqlite (bundled SQLite) | 0.32 |
| Frontend | React + TypeScript | 18 / 5.3 |
| Styling | Tailwind CSS | 3.3 |
| Bundler | Vite | 5 |
| Code editor | Monaco Editor | 4.7 |

### Generated output (what you export)

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Backend | NestJS + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT (passport-jwt) + bcrypt |
| RBAC | Custom `RolesGuard` + `@Roles()` decorator |
| Tests | Jest + supertest (e2e) |
| API docs | OpenAPI 3.0 / Swagger |

---

## 🔧 Configuration

### Tauri (`desktop/tauri.conf.json`)
- **Window** – 1400 × 900, min 1024 × 768, resizable
- **Title** – "Akasha — Visual Full-Stack SaaS Builder"

### Rust Backend (`desktop/Cargo.toml`)
- Axum 0.7, Tokio (full), rusqlite 0.32 (bundled), serde/serde_json, uuid, chrono, zip, regex, rfd (native dialogs), notify (file watcher)

---

## 🐳 Docker (Headless Mode)

```bash
docker-compose up -d
```

Runs the Axum API server without the desktop UI:
- **Port:** `3001` → `http://localhost:3001/health`
- **Database:** SQLite persisted to a Docker volume

---

## 🔒 Security

- **Local-first** – All data stored in a local SQLite file; nothing leaves your machine
- **Tauri sandbox** – Native webview security boundary
- **IPC bridge** – Type-safe Rust ↔ JavaScript communication
- **CORS** – Restricted to `localhost` origins in development

---

## 🚀 Production Build

```bash
npm run build
```

Produces platform-specific installers:

| Platform | Output |
|----------|--------|
| Windows | `.exe` (NSIS) / `.msi` (WiX) |
| macOS | `.app` / `.dmg` |
| Linux | `.AppImage` / `.deb` |

### System Requirements
- **Windows** 10+ (64-bit)
- **macOS** 10.15+
- **Linux** Ubuntu 20.04+ or equivalent

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Guidelines
- **Rust** – `cargo fmt` + `cargo clippy`
- **TypeScript** – Strict mode, no `any`
- **Commits** – Clear, descriptive messages

---

## 📝 License

MIT — see [LICENSE](LICENSE).

---

## 🙏 Acknowledgments

[Tauri](https://tauri.app/) · [Axum](https://github.com/tokio-rs/axum) · [React](https://react.dev/) · [Tailwind CSS](https://tailwindcss.com/) · [Monaco Editor](https://microsoft.github.io/monaco-editor/) · [SQLite](https://www.sqlite.org/) · [NestJS](https://nestjs.com/) · [Prisma](https://www.prisma.io/)

---

<p align="center">
  <strong>Build & export production-ready full-stack SaaS applications — visually.</strong>
</p>

<p align="center">
  Made with ❤️ by Mohamed Tarek
</p>

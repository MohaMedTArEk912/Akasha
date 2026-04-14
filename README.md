<div align="center">
  <img src="https://raw.githubusercontent.com/MohaMedTArEk912/akasha/main/public/logo.png" alt="Akasha Logo" width="120" />

  # 🚀 Akasha

  **Build, Visualize, and Export Production-Ready Full-Stack SaaS Applications with AI-Powered Precision.**

  [![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=for-the-badge)](https://github.com/MohaMedTArEk912/akasha)
  [![Platform](https://img.shields.io/badge/platform-Web-brightgreen.svg?style=for-the-badge)](https://github.com/MohaMedTArEk912/akasha)
  [![License](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)](LICENSE)
  [![React](https://img.shields.io/badge/React-18-61dafb.svg?style=for-the-badge&logo=react)](https://react.dev/)
  [![Node](https://img.shields.io/badge/Node-18+-green.svg?style=for-the-badge&logo=node.js)](https://nodejs.org/)
  [![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748.svg?style=for-the-badge&logo=prisma)](https://www.prisma.io/)

  [View Demo](https://akasha-demo.vercel.app) • [Read Docs](docs/) • [Report Bug](https://github.com/MohaMedTArEk912/akasha/issues) • [Request Feature](https://github.com/MohaMedTArEk912/akasha/issues)

</div>

---

## 🌟 Overview

**Akasha** is a revolutionary web-based platform designed to bridge the gap between design and production. It empowers developers and architects to build complete, full-stack applications visually. From designing responsive UI components to modeling complex database relationships and authoring business logic via interactive flowcharts, Akasha handles the heavy lifting of boilerplate generation.

> "From zero to a deployable, production-ready codebase — without leaving your browser."

---

## 📖 Table of Contents

- [✨ Key Features](#-key-features)
- [🛠️ Core Modules](#️-core-modules)
- [🏗️ Technology Stack](#️-technology-stack)
- [🚀 Quick Start](#-quick-start)
- [📁 Project Structure](#-project-structure)
- [📡 API Reference](#-api-reference)
- [🛡️ Security & RBAC](#️-security--rbac)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)
- [📝 License](#-license)
- [🙏 Acknowledgments](#-acknowledgments)

---

## ✨ Key Features

- 🎨 **Visual UI Builder**: Drag-and-drop React components with real-time Tailwind CSS styling and live code preview.
- 🔀 **Visual Logic Engine**: Author complex business logic using a graph-based node system (Low-code/No-code).
- 📊 **ERD & Data Modeling**: Design the database schema visually with support for relations, enums, and constraints.
- ⚡ **Full-Stack Export**: Generate a complete project (React, NestJS, Prisma) in a single ZIP file.
- 🔐 **Built-in Auth & RBAC**: Automated generation of JWT-based authentication and Role-Based Access Control.
- 🐳 **Docker Ready**: One-click generation of Docker settings for seamless deployment.
- 📄 **OpenAPI Integration**: Automatic Swagger/OpenAPI 3.0 documentation generation.

---

## 🛠️ Core Modules

### 1. Visual Editor (Canvas)
- **Nestable Component Tree**: Manage complex UI hierarchies with ease.
- **Responsive Controls**: Test designs across Desktop, Tablet, and Mobile viewports.
- **State & Props Management**: Bind UI properties to variables or API responses.

### 2. Logic Flow Engine
- **Node Library**: 22+ node types including `ApiCall`, `Condition`, `Loop`, `Navigate`, and `SetVariable`.
- **Compiler**: Transforms visual graphs into executable TypeScript functions.

### 3. API Designer
- **Endpoint Builder**: Define RESTful routes with custom methods and path parameters.
- **Schema Editor**: Interactive editing for request and response body shapes.

### 4. Database (ERD) Designer
- **Prisma Integration**: Generates a clean `schema.prisma` from the visual ERD.
- **Relation Mapping**: Handles One-to-One, One-to-Many, and Many-to-Many relations automatically.

---

## 🏗️ Technology Stack

### The Platform (Internal)
Built with stability and speed in mind to provide a seamless designer experience.

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Zustand, Vite |
| **Backend** | Node.js, Express, Prisma, fs-extra |
| **Database** | SQLite (Prototyping) |
| **Editors** | Monaco Editor, React-Flow |

### The Generated Output (Production)
The code you export is structured for high-scale production environments.

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 18, TypeScript, Tailwind, AuthContext |
| **Backend** | NestJS (Modular Architecture) |
| **Database** | Prisma + PostgreSQL / MySQL |
| **Security** | JWT, Passport, Bcrypt, RBAC Guards |
| **Testing** | Jest, Supertest (E2E) |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Git**

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/MohaMedTArEk912/akasha.git
   cd akasha
   ```

2. **Install all dependencies (Root, Client, and Server):**
   ```bash
   npm run install:all
   ```

3. **Start in Development mode:**
   ```bash
   npm run dev
   ```
   *This starts the Client (Vite) on port `5173` and the Server (Express) on port `3001` concurrently.*

### Building for Production
```bash
npm run build
```

---

## 📁 Project Structure

```bash
akasha/
├── 📂 client/              # React Frontend (Vite)
│   ├── 📂 src/
│   │   ├── 📂 components/  # UI Elements & Visual Editor Panels
│   │   ├── 📂 stores/      # Zustand Global State
│   │   └── 📄 App.tsx      # Main Layout & Routing
│   └── 📄 tailwind.config.ts
├── 📂 server/              # Express Backend API
│   ├── 📂 src/
│   │   ├── 📂 routes/      # Control Tower for API Endpoints
│   │   ├── 📂 services/    # Business Logic & Code Generation
│   │   └── 📄 server.ts    # Server Entry Point
│   └── 📂 prisma/          # Database Schema
├── 📄 docker-compose.yml   # Container Configuration
├── 📄 package.json         # Root Scripts & Dependencies
└── 📄 README.md            # You are here!
```

---

## 📡 API Reference

The Akasha bridge exposes a set of management APIs to interact with the project state.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/project` | Fetch current project state and workspace details. |
| `POST` | `/api/project/sync/now` | Manually sync in-memory changes to the local disk. |
| `POST` | `/api/generate/zip` | Compile the project and initiate a ZIP download. |
| `POST` | `/api/models` | Create a new data model in the ERD. |
| `GET`  | `/api/files/content` | Read the raw generated code for a specific file. |

*Full documentation available in the [API spec](docs/API.md).*

---

## 🛡️ Security & RBAC

Akasha takes security seriously both for the platform and your generated apps:
- **JWT Protection**: All exported production APIs include built-in JWT validation.
- **RBAC (Role-Based Access Control)**: Define roles (e.g., `Admin`, `User`, `Guest`) visually and apply them to endpoints.
- **Prisma Guards**: Automated data validation at the ORM level.
- **Sanitization**: Code generation includes auto-sanitization to prevent injection attacks.

---

## 🗺️ Roadmap

- [x] **v1.0** — Visual Canvas, ERD Designer, and NestJS Generator.
- [ ] **v1.1** — Live Deployment to Vercel/DigitalOcean.
- [ ] **v1.2** — Python (FastAPI) Backend support.
- [ ] **v1.5** — AI-Assistant for UI Ideation and Auto-Logic.
- [ ] **v2.0** — Native Mobile App (React Native) export support.

---

## 🤝 Contributing

We welcome contributions of all kinds!

1. **Fork** the repository.
2. **Create** your feature branch (`git checkout -b feature/CoolFeature`).
3. **Commit** your changes (`git commit -m 'feat: add some cool feature'`).
4. **Push** to the branch (`git push origin feature/CoolFeature`).
5. **Open** a Pull Request.

Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **React Flow** for the logic engine visualization.
- **Monaco Editor** for the high-fidelity code preview.
- **Prisma** for the incredible ORM experience.
- Special thanks to the **Open-Source Community** for inspiring this vision.

---

<div align="center">
  <sub>Made with ❤️ by <b>Mohamed Tarek</b></sub><br/>
  <sup>© 2026 Akasha Platform. All rights reserved.</sup>
</div>

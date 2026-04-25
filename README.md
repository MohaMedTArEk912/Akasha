# Akasha

<div align="center">
   <img src="https://raw.githubusercontent.com/MohaMedTArEk912/akasha/main/public/logo.png" alt="Akasha Logo" width="120" />

   **Akasha is a browser-based AI workspace for designing, organizing, and generating web applications.**

   [![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=for-the-badge)](https://github.com/MohaMedTArEk912/akasha)
   [![Platform](https://img.shields.io/badge/platform-Web-brightgreen.svg?style=for-the-badge)](https://github.com/MohaMedTArEk912/akasha)
   [![License](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)](LICENSE)
   [![React](https://img.shields.io/badge/React-18-61dafb.svg?style=for-the-badge&logo=react)](https://react.dev/)
   [![Node](https://img.shields.io/badge/Node-18+-green.svg?style=for-the-badge&logo=node.js)](https://nodejs.org/)
   [![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
</div>

## Overview

Akasha is a full-stack web app for planning and generating product ideas inside one browser workspace. It combines a visual UI builder, a project ideation flow, API and data-model editors, diagramming, and source-code views so you can move from concept to implementation without switching tools.

The repository is web-first. There is no native desktop runtime here, and the remaining responsive viewport labels such as desktop, tablet, and mobile are design-preview modes inside the app.

## What the app does

- Shapes product ideas into structured pages, use cases, and implementation notes.
- Builds UI layouts visually with responsive preview modes.
- Models APIs, data structures, and logic flows.
- Tracks generated source code and project state.
- Talks to the backend over HTTP from the browser.
- Supports AI-assisted workflows through the server layer.

## Tech Stack

| Area | Stack |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand |
| UI/Editor Tooling | Craft.js, DnD Kit, Monaco Editor, Radix UI |
| Backend | Node.js, Express, TypeScript |
| Data / Storage | MongoDB, filesystem-backed project data |
| AI / Integrations | OpenRouter (OpenAI-compatible client), Git/GitHub integrations |

## Local Setup

### Requirements

- Node.js 18 or newer
- npm
- Git

### Install

```bash
npm run install:all
```

### Run in development

```bash
npm run dev
```

This starts the web client on `http://localhost:5173` and the API server on `http://localhost:3001`.

### Build

```bash
npm run build
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Starts the client and server together in development mode. |
| `npm run install:all` | Installs dependencies for the root, client, and server packages. |

## Project Structure

```text
WorkSpace/
├── client/              # Web client (Vite + React)
│   └── src/frontend/     # App UI, pages, components, stores, hooks
├── server/               # HTTP API and project services
│   └── src/              # Routes, controllers, services, server entry
├── docs/                 # Product and UI documentation
├── public/               # Static assets served by the app
├── docker-compose.yml    # Local container setup
└── README.md             # Project overview and setup
```

## Main Areas

- Dashboard and project setup.
- UI ideation and visual builder workflow.
- Use case, API, database, and diagram editors.
- Source-code inspection and generated project output.
- Project sync, Git, and GitHub workflows.

## Configuration

Copy `.env.example` to `.env` and configure the values needed by the server. The codebase already expects browser-based access to the API, so keep the client and server origins aligned with your local or deployed web URL.

## Notes

- The app is designed to run in the browser.
- Responsive preview modes are part of the product UI, not a desktop app target.
- Desktop-specific references have been removed from the repo where they were only historical leftovers.

## License

MIT. See [LICENSE](LICENSE).

<div align="center">
   <sub>Made with care by Mohamed Tarek</sub>
</div>

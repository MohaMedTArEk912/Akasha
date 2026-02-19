# Akasha Client

The frontend for the Akasha platform, built with **React**, **Vite**, and **Tailwind CSS**.

## 🛠️ Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite 5
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Editor**: Monaco Editor (via `@monaco-editor/react`)
- **Drag & Drop**: `@dnd-kit/core`
- **Component System**: Custom block-based architecture

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- npm

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

### Production Build

Build the application for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## 📁 Project Structure

- `src/components/`: Reusable UI components and visual editors.
- `src/stores/`: Global state management (Project, UI, Settings).
- `src/hooks/`: Custom React hooks.
- `src/context/`: React Context providers.
- `src/utils/`: Helper functions.

# Copilot instructions for grapes-editor

## Big picture architecture
- Monorepo with React/Vite frontend in [frontend](frontend) and Express/TS backend in [backend](backend).
- Backend uses MongoDB for editor state (projects, pages, VFS) via Mongoose; PostgreSQL is optional and configured in [backend/src/config/postgres.ts](backend/src/config/postgres.ts) but not wired in [backend/src/server.ts](backend/src/server.ts).
- Editor UX is GrapesJS headless with custom UI; initialization lives in [frontend/src/hooks/useGrapes.ts](frontend/src/hooks/useGrapes.ts) and blocks in [frontend/src/utils/blocks.ts](frontend/src/utils/blocks.ts).
- Tailwind-only styling is enforced via `grapesjs-tailwind` plugin and CDN in the GrapesJS canvas (see [frontend/src/hooks/useGrapes.ts](frontend/src/hooks/useGrapes.ts)).

## Key flows & boundaries
- Projects CRUD (Mongo): REST routes in [backend/src/routes/project.routes.ts](backend/src/routes/project.routes.ts), models in [backend/src/models/Project.ts](backend/src/models/Project.ts), client in [frontend/src/services/projectService.ts](frontend/src/services/projectService.ts).
- Pages CRUD (Mongo): routes in [backend/src/routes/page.routes.ts](backend/src/routes/page.routes.ts), model in [backend/src/models/Page.ts](backend/src/models/Page.ts), UI in [frontend/src/components/PageManager/index.tsx](frontend/src/components/PageManager/index.tsx).
- VFS (Virtual File System): routes in [backend/src/routes/vfs.routes.ts](backend/src/routes/vfs.routes.ts), controller in [backend/src/controllers/vfs.controller.ts](backend/src/controllers/vfs.controller.ts), models in [backend/src/models/VFSFile.ts](backend/src/models/VFSFile.ts) and [backend/src/models/VFSBlock.ts](backend/src/models/VFSBlock.ts). Deletion is restricted by protection level; use archive/restore for protected files.
- VFS API responses are wrapped `{ success, data }` (see [backend/src/controllers/vfs.controller.ts](backend/src/controllers/vfs.controller.ts)), unlike other controllers that return raw objects.

## Auth & tokens
- Auth middleware is JWT-based in [backend/src/middleware/auth.middleware.ts](backend/src/middleware/auth.middleware.ts).
- Most frontend services read token from `localStorage.grapes_user.token` (see [frontend/src/services/pageService.ts](frontend/src/services/pageService.ts) and [frontend/src/services/projectService.ts](frontend/src/services/projectService.ts)).
- VFS client uses `localStorage.token` instead (see [frontend/src/services/vfsService.ts](frontend/src/services/vfsService.ts)); keep this in mind when wiring new calls.

## Developer workflows
- Root dev: `npm run dev` (runs frontend + backend concurrently) from [package.json](package.json).
- Frontend: `npm run dev` in [frontend](frontend); Backend: `npm run dev` in [backend](backend).
- MongoDB can be started via [docker-compose.yml](docker-compose.yml). No tests are configured.

## Conventions & patterns
- Schema-first: pages store `content` (HTML/CSS bundle) and `styles` strings; editor loads/saves from [frontend/src/components/Editor/Editor.tsx](frontend/src/components/Editor/Editor.tsx).
- VFS file schema uses `schema`/`dataSchema` alias (see [backend/src/models/VFSFile.ts](backend/src/models/VFSFile.ts)); blocks must always reference a valid file ID (see pre-save guard in [backend/src/models/VFSBlock.ts](backend/src/models/VFSBlock.ts)).
- UI layout is custom (no GrapesJS default panels), so use the app containers (`#blocks-container`, `#layers-container`, `#styles-container`) in [frontend/src/components/Editor/Editor.tsx](frontend/src/components/Editor/Editor.tsx) when adding panels.
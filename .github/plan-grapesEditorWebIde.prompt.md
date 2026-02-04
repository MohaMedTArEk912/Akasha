Prompt instructions file:
Below is the **UPDATED FULL‑STACK VISUAL IDE PLAN (WEB EDITION)** for Grapes Editor. This is a **build specification + task breakdown**, not documentation.

---

# 🚀 Grapes Editor — Full‑Stack Visual IDE (Web Edition)

**Target:** Visual Full‑Stack IDE on the web (SaaS‑ready)
**Stack:** React + TypeScript + Tailwind + GrapesJS (headless) + Node/Nest + Prisma + SQL

---

# 0) CORE PRINCIPLE (LOCK THIS)

- **Blocks are a visual DSL only (design‑time).**
- **Runtime is real generated code** (React + Backend + Database).
- **Nothing executes as blocks at runtime.**

---

# 1) HIGH‑LEVEL ARCHITECTURE

Visual Blocks (UI)
	↓
Unified Schema (AST)
	↓
Code Generator (Compiler)
	↓
Frontend Code (React + Tailwind)
Backend Code (Node/Nest + Prisma)
Database Schema (SQL)
	↓
Normal Runtime (Docker / Cloud)

---

# 2) PROJECT FOUNDATION (WEB)

**Structure**
- frontend/ → Grapes Editor UI (React + GrapesJS headless)
- backend/ → API for projects, schema storage, and export
- generated/ → Output apps (frontend + backend)

**Setup**
- GrapesJS stays headless and optional (UI shell owns the layout)
- Tailwind‑only UI
- MongoDB for editor state (current backend)
- REST APIs remain stable unless required by generator

---

# 3) UNIFIED SCHEMA LAYER (SOURCE OF TRUTH)

**Schemas**
- BlockSchema (UI blocks)
- ApiSchema (backend endpoints)
- DataModelSchema (database models)
- LogicFlowSchema (visual logic)
- ProjectSchema (ties everything together)

**Rules**
- Serializable JSON
- Versionable
- Command‑driven updates

---

# 4) COMMAND SYSTEM (MVP)

**Minimum Commands**
- AddBlock
- MoveBlock
- UpdateProperty
- ArchiveEntity
- AddApiEndpoint
- AddDataModelField

**Notes**
- Store command log for Undo/Redo
- UI never mutates schemas directly

---

# 5) FRONTEND BLOCKS (UI = CODE VIEW)

**User Sees**
- Page blocks, layout blocks, buttons, forms

**Reality**
- React components with props, state, and handlers

**Generator Output**
- React + Tailwind
- Clean JSX

📌 Frontend blocks are a visual representation of React code.

---

# 6) BACKEND BLOCKS (APP‑INVENTOR STYLE)

**User Sees**
[ POST /users ] → Validate Email → Save User → Return 201

**Reality**
- API schemas
- Logic graphs
- Permissions

**Generator Output**
- Express / NestJS backend
- Prisma ORM
- Validation middleware

📌 Backend blocks compile into real server code.

---

# 7) DATABASE BLOCKS (VISUAL ERD)

**User Sees**
- Model blocks, fields, relations

**Reality**
- SQL schema
- Prisma schema
- Migrations

**Generator Output**
- PostgreSQL schema
- Migration files
- ORM models

📌 Database blocks = schema designer, not a runtime DB.

---

# 8) VIRTUAL FILE SYSTEM (VFS)

**Rules**
- Typed virtual files: .page, .component, .api, .model
- Archive‑only deletion
- File tree derived from schema

**UI**
- VS‑Code‑style FileTree
- Open entities visually (not raw files)

---

# 9) UI/UX SHELL (WEB)

**Panels**
- FileTree
- Canvas (UI blocks)
- Logic Canvas (Backend logic)
- ERD Canvas (Database)
- Inspector (properties)

**Rules**
- UI never mutates state directly
- All changes → command → schema update

---

# 10) CODE GENERATION LAYER (COMPILER)

**Generates**
- /frontend → React + Tailwind app
- /backend → Node/Nest + Prisma API
- /db → SQL migrations

**MVP Strategy**
- Template‑based generation first
- AST manipulation later (optional)

---

# 11) SaaS‑READY FLOW (WEB)

Desktop/Web IDE
   ↓ Publish
Generated Code
   ↓ Deploy
Cloud Runtime (Docker / Serverless)

**SaaS platform responsibility**
- Hosts generated apps
- Manages users, projects, billing
- Does NOT execute user logic directly

---

# 12) EXPLICITLY DEFERRED (NOT FOR GP)

- Live collaboration
- Plugin marketplace
- Multi‑tenant runtime execution
- AI features

---

# 13) GP MVP (WHAT YOU MUST DELIVER)

✔ Web IDE (GrapesJS headless)
✔ Frontend blocks → React code
✔ Backend blocks → API code
✔ Database blocks → SQL schema
✔ VFS
✔ Export runnable app

That alone = excellent graduation project.

---

# 14) FINAL COPILOT PROMPT (USE THIS)

Paste into Copilot Chat:

> “Refactor Grapes Editor into a web‑based full‑stack visual IDE. Keep GrapesJS headless, Tailwind‑only, schema‑first, and command‑driven. Blocks are design‑time DSL only, runtime is generated React + Node/Nest + Prisma + SQL. Implement VFS with archive‑only deletion, and export runnable projects. No breaking API changes.”

---

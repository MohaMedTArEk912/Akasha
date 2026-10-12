---
name: akasha-squad
description: Multi-agent squad orchestration skill for Antigravity. Guides Antigravity to organize and execute specialized agent teams in Series (linear pipeline) or Parallel (concurrent frontend/backend with QA verification) topologies, streaming live telemetry back to the Akasha Mission Control dashboard.
---

# Akasha Multi-Agent Squad Orchestration Skill

This skill defines how Antigravity organizes and dispatches specialized autonomous agent squads to build full-stack web applications collaboratively with the user.

---

## 1. Squad Roles & Responsibilities

| Role | Agent Identity | Core Responsibility | Primary Tools |
| :--- | :--- | :--- | :--- |
| **Lead Architect** | Aria | Decomposes specs, enforces contracts, verifies boundaries, and manages task queue. | `akasha_get_structured_blueprint`, `view_file`, `write_to_file` |
| **Frontend Engineer** | Leo | Synthesizes modern React 18 + Vite components, glassmorphism styling, and responsive viewports. | `write_to_file`, `replace_file_content`, `multi_replace_file_content` |
| **Backend Engineer** | Rex | Implements Express 5 REST controllers, Prisma schemas, and MongoDB GridFS persistence. | `write_to_file`, `replace_file_content`, `run_command` |
| **QA / Self-Healer** | Vera | Executes `npm run build`, resolves compiler diagnostics, and triggers browser preview testing. | `run_command`, `browser_subagent`, `akasha_sync_cloud` |

---

## 2. Squad Execution Topologies

### Topology A: Series Pipeline (Sequential Execution)
Use for complex, tightly-coupled features or foundational refactors:
```
[1. Aria: Architect Spec] ➔ [2. Leo: Frontend UI] ➔ [3. Rex: Backend APIs] ➔ [4. Vera: QA Self-Healer]
```
1. **Phase 1**: Aria creates or verifies `.akasha/mission_contract.json`.
2. **Phase 2**: Leo implements UI components based on the contract.
3. **Phase 3**: Rex implements REST routes and database models matching the UI contracts.
4. **Phase 4**: Vera compiles, resolves any TypeScript errors, and tests the UI live.

### Topology B: Parallel Squad (Concurrent Fan-Out)
Use for high-velocity feature additions and maximum throughput:
```
                       ┌──> [Leo: Frontend UI Components] ──┐
[1. Aria: Contract] ───┤                                    ├───> [Vera: QA & Browser Check]
                       └──> [Rex: Backend REST APIs] ───────┘
```
1. **Contract Phase**: Aria locks the API endpoints, data models, and component props via `akasha_get_structured_blueprint`.
2. **Parallel Fan-Out**:
   - Spawn subagent for **Leo** to build React views and state stores.
   - Spawn subagent for **Rex** to build Express controllers and database queries simultaneously.
3. **Join & Verification**:
   - Vera executes the build verification (`npm run build`). If any compiler mismatches occurred between frontend and backend contracts, Vera surgically fixes them.

---

## 3. Real-Time Telemetry & Observability Protocol

At every significant step, the executing agent must report telemetry to the Akasha Mission Control dashboard via `akasha_stream_agent_telemetry`:

```json
{
  "projectId": "<active-project-id>",
  "agentRole": "frontend",
  "stepName": "Synthesizing Analytics Dashboard Component",
  "thought": "Generating reactive React 18 component <AnalyticsDashboard /> with dark glassmorphism styling and responsive flex grid.",
  "activeTool": "write_to_file",
  "toolArgsSnippet": "path: client/src/frontend/components/AnalyticsDashboard.tsx",
  "fileCreatedOrModified": "client/src/frontend/components/AnalyticsDashboard.tsx",
  "progress": 60
}
```

---

## 4. Completion & Task Reconciliation
1. When all tasks in the mission are finished:
   - Call `akasha_update_task_status` with `status: "done"` for each completed task.
   - Call `akasha_sync_cloud` to persist files to MongoDB GridFS.
   - Call `akasha_stream_agent_telemetry` with `progress: 100` and `type: "success"`.

---
name: akasha-builder
description: Comprehensive workflow skill for Antigravity to architect, build, test, and deploy full-stack applications in the Akasha ecosystem. Enforces collaborative planning, structure-first token-optimized blueprint retrieval, live telemetry streaming, MongoDB GridFS cloud persistence, automated build self-healing, and visual browser verification.
---

# Akasha Application Builder Skill for Antigravity

This skill guides Antigravity to deliver end-to-end, production-ready web applications within the Akasha IDE ecosystem.

---

## The 7-Step Antigravity Loop for the "Perfect Project"

```
[0. Structured Blueprint & Quota] ➔ [1. Collaborative Artifact Plan] ➔ [2. Multi-Agent Surgical Coding]
                                                                                      │
[6. Cloud Sync & Task Update] 🠔 [5. Browser Visual Verification] 🠔 [4. Self-Healing Build] 🠔 [3. Live Telemetry Stream]
```

---

### Step 0: Structure-First Blueprint Retrieval & Quota (Token Saver)
**CRITICAL FOR TOKEN OPTIMIZATION**: Do NOT spend 50,000+ tokens blindly exploring files or guessing schemas.
1. Call the `akasha_get_structured_blueprint` MCP tool or read `.akasha/blueprint.json`.
2. Inspect the pre-compiled Data Models, REST API contracts, UI page routes, and pending Kanban tasks.
3. Call `akasha_check_quota` to assess current user token budget.

### Step 1: Collaborative Planning Artifact
Align on the exact tasks before implementing:
1. Create a markdown artifact (`<appDataDir>/brain/<conversation-id>/project_plan.md`).
2. Include:
   - **Ground Truth Entities**: Exactly matching the models in the Akasha blueprint.
   - **API Routes**: Matching blueprint endpoint paths and methods.
   - **Task Checklist**: Checkbox list of exact files to create or modify.
3. Set `RequestFeedback: true` in the artifact metadata.

### Step 2: Surgical Autonomous Code Implementation
When implementing features:
1. **Frontend**:
   - Use React 18 + Vite with clean TypeScript.
   - Apply vibrant modern aesthetics: curated color tokens, dark glassmorphism, responsive flex/grid layouts.
   - Strictly avoid placeholder "TODO" or mock templates.
2. **Backend & Cloud Persistence**:
   - Express 5 REST routes with typed controllers.
   - Connect directly to MongoDB via Prisma and GridFS for file persistence.
3. **Editing Pattern**:
   - Use `replace_file_content` or `multi_replace_file_content` for existing files.
   - Use `write_to_file` only for brand-new modules.

### Step 3: Stream Live Telemetry to Akasha Mission Control
Keep the user updated in real-time on the Akasha Mission Control dashboard:
1. At each major step or tool invocation, call `akasha_stream_agent_telemetry`:
   - `agentRole`: `architect` | `frontend` | `backend` | `qa_verifier`
   - `stepName`: Short title of the operation
   - `thought`: Natural language explanation of current reasoning
   - `activeTool`: Name of the tool being executed
   - `progress`: 0 to 100 percentage

### Step 4: Automated Self-Healing Build Verification
Before concluding any implementation turn:
1. Run `run_command` with `npm run build` or `npx tsc --noEmit`.
2. If any TypeScript errors or lint issues occur:
   - DO NOT stop and ask the user to fix it.
   - Analyze the line number and error code (e.g. `TS2322`, `TS2339`, `TS1484`).
   - Surgically edit the offending code.
   - Re-run the build until exit code is **0**.

### Step 5: Visual Verification via Browser Subagent
Ensure the user gets a working, polished project:
1. Start or verify the dev server is active (`http://localhost:5173`).
2. Invoke `browser_subagent` to:
   - Open the web application URL.
   - Click navigation links and test core buttons/forms.
   - Capture a screenshot or inspect console logs for runtime JavaScript crashes.
3. If visual defects or errors are found, self-correct immediately.

### Step 6: Cloud GridFS Persistence & Task Board Update
1. Call `akasha_sync_cloud` with the active `projectId` to version code in MongoDB GridFS.
2. Call `akasha_update_task_status` for completed tasks so the Akasha Kanban board updates automatically.
3. Call `akasha_consume_quota` with the calculated tokens expended.

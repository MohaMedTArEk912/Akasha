---
name: akasha-builder
description: Comprehensive workflow skill for Antigravity to architect, build, test, and deploy full-stack applications in the Akasha ecosystem. Enforces collaborative planning, quota budgeting, MongoDB GridFS cloud persistence, automated build self-healing, and visual browser verification.
---

# Akasha Application Builder Skill for Antigravity

This skill guides Antigravity to deliver end-to-end, production-ready web applications within the Akasha IDE ecosystem.

---

## The 6-Step Antigravity Loop for the "Perfect Project"

```
[1. Quota & Scope Discovery] ➔ [2. Interactive Artifact Plan] ➔ [3. Surgical Autonomous Coding]
                                                                        │
[6. Cloud GridFS Sync] 🠔 [5. Browser Visual Verification] 🠔 [4. Self-Healing Build]
```

---

### Step 1: Check Quota & Assess Scope
Before embarking on large code changes or new project generation:
1. Call the `akasha_check_quota` MCP tool or verify current user tokens.
2. If remaining quota is low (< 5,000 tokens), warn the user and suggest high-efficiency surgical edits.
3. If quota is healthy, estimate the token expenditure for the requested task.

### Step 2: Generate Collaborative Planning Artifact
Never dump uncoordinated code into files without architectural alignment:
1. Create a markdown artifact (`<appDataDir>/brain/<conversation-id>/project_plan.md`).
2. Include:
   - **User Flow & Requirements**: What problem are we solving?
   - **Mermaid Architecture Diagram**: Component hierarchy, state flow, API endpoints.
   - **Data Models**: MongoDB collections, schemas, and Prisma definitions.
   - **Task Checklist**: Checkbox list of exact files to create or modify.
3. Set `RequestFeedback: true` in the artifact metadata to let the user review and confirm.

### Step 3: Surgical Autonomous Code Implementation
When implementing features:
1. **Frontend**:
   - Use React + Vite with clean TypeScript.
   - Apply vibrant modern aesthetics: curated color tokens, dark glassmorphism, responsive flex/grid layouts.
   - Strictly avoid placeholder "TODO" or mock templates.
2. **Backend & Cloud Persistence**:
   - Express 5 REST routes with typed controllers.
   - Connect directly to MongoDB via Prisma and GridFS for file uploads/downloads.
   - Always normalize paths using `normalizeStoragePath()`.
3. **Editing Pattern**:
   - Always use `replace_file_content` or `multi_replace_file_content` for existing files to maintain line history.
   - Use `write_to_file` only for brand-new modules.

### Step 4: Automated Self-Healing Build Verification
Before concluding any implementation turn:
1. Run `run_command` with `npm run build` or `npx tsc --noEmit`.
2. If any TypeScript errors or lint issues occur:
   - DO NOT stop and ask the user to fix it.
   - Analyze the line number and error code (e.g. `TS2322`, `TS2339`).
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

### Step 6: Synchronize to MongoDB Cloud Storage & Debit Quota
1. Call the `akasha_sync_cloud` tool with the active `projectId`.
   - All components, pages, and metadata will be uploaded and versioned in MongoDB GridFS.
2. Call `akasha_consume_quota` with the calculated tokens expended.
3. Report the completion summary to the user with the live preview link and remaining quota balance.

# Akasha Project Standards & Engineering Guidelines for Antigravity

When designing, refactoring, or generating code for the Akasha / WorkSpace ecosystem, Antigravity **MUST** adhere to the following rules:

---

## 1. Cloud-Native Storage Architecture (MongoDB GridFS)
- Never rely exclusively on local ephemeral disk for persistent user assets.
- All media (images, videos, audio, PDF documents, zip archives) and generated projects MUST be routed through the MongoDB GridFS storage system (`StorageService` / `GridFSService`).
- Large files (>2MB) are chunked in MongoDB GridFS (`cloud_files.chunks`). Text and code files cache inline content for fast sub-millisecond retrieval.
- When serving binary streaming media (audio/video), always support RFC 7233 HTTP 206 Partial Content range requests.

---

## 2. Design Aesthetics & Visual Quality
- Any frontend UI created for Akasha must look visually stunning and premium ("WOW" factor).
- Use tailored HSL color palettes, dark glassmorphism, subtle glowing borders, and smooth micro-animations.
- Avoid generic solid red/green/blue or default browser elements.
- Use modern typography (Inter, Outfit, Fira Code) with clear hierarchy and generous whitespace.

---

## 3. Quota Management & Token Budgeting
- Antigravity must check the user's available quota before launching extensive architectural synthesis.
- Prefer surgical multi-line edits (`replace_file_content` / `multi_replace_file_content`) over dumping full file rewrites. This conserves 80%+ tokens and maintains exact file history.
- After substantial code generation, notify the user of quota balance and debit tokens accordingly.

---

## 4. Self-Healing & Verification Loop
- Never declare a coding task complete without verifying TypeScript compilation (`npm run build` or `tsc -p tsconfig.json`).
- If a compiler error occurs, Antigravity MUST read the compiler diagnostics, trace the exact file and line, and fix it automatically before presenting the solution to the user.
- Utilize the Browser Subagent to navigate to local preview servers, inspect the live DOM, and verify that interactive components work without runtime console errors.

---

## 5. Artifacts for Collaborative Planning
- For complex feature implementations, Antigravity must create an interactive Markdown Artifact containing:
  1. Mermaid Architecture Diagram
  2. Database Models & Schema
  3. API Route Contracts
  4. Step-by-Step Task Checklist
- Allow the user to review the plan and approve before writing code.

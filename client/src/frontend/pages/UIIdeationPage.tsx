import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { useProjectStore } from "../hooks/useProjectStore";
import { useApi } from "../hooks/useApi";
import {
    loadSandbox,
    saveSandbox,
    hasSandboxChanges,
} from "../stores/projectStore";
import type { SandboxData } from "../stores/projectStore";
import { useToast } from "../context/ToastContext";
import { generateStructuredIdea, setProject } from "../stores/projectStore";
import { useBackgroundLoading } from "../context/BackgroundLoadingContext";

function buildClientFallbackPages(idea: string, projectData?: any): PageDefinition[] {
  const projectName = projectData?.name || "System";
  const rawModels = ((projectData?.data_models || []) as Array<{ name?: string; fields?: any }>);
  const models = rawModels.map((m) => m.name).filter(Boolean) as string[];

  const pages: PageDefinition[] = [];

  // Core Overview / Command Center
  pages.push({
    name: `${projectName} Operations`,
    path: "/dashboard",
    type: "dashboard",
    description: `Executive command center displaying active telemetry, KPI health, and activity feeds for ${projectName}.`,
  });

  // Model-driven dynamic views (if models exist from repo search or database)
  if (models.length > 0) {
    for (const mName of models.slice(0, 4)) {
      const slug = mName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      pages.push({
        name: `${mName} Registry`,
        path: `/${slug}s`,
        type: "list",
        description: `Filterable data registry and search interface for ${mName} records.`,
      });
      pages.push({
        name: `${mName} Inspector`,
        path: `/${slug}/details`,
        type: "detail",
        description: `Detailed record editor, attribute inspector, and status transitions for ${mName}.`,
      });
    }
  } else {
    // If no models yet, extract key nouns from idea/description
    const text = ((idea || "") + " " + (projectData?.description || "")).trim();
    const words = text
      .split(/[\s,.-]+/)
      .filter((w) => w.length > 3 && !["this", "with", "that", "from", "have", "make", "will", "your"].includes(w.toLowerCase()));
    const primaryConcept = words[0] ? (words[0].charAt(0).toUpperCase() + words[0].slice(1)) : "Record";

    pages.push({
      name: `${primaryConcept} Management`,
      path: "/records",
      type: "list",
      description: `Structured data table with full-text search, status filters, and batch operations for ${primaryConcept}.`,
    });
    pages.push({
      name: `${primaryConcept} Editor`,
      path: "/records/details",
      type: "detail",
      description: `Deep-dive configuration, metadata editor, and operational parameters for ${primaryConcept}.`,
    });
    pages.push({
      name: "Discovery & Search",
      path: "/explore",
      type: "search",
      description: `Faceted query interface with search filters, tag suggestions, and telemetry exports.`,
    });
  }

  // System Settings
  pages.push({
    name: "System Settings",
    path: "/settings",
    type: "settings",
    description: `Platform parameters, security access controls, and runtime sync preferences.`,
  });

  // Dynamically synthesize initial clean markup for each page
  return pages.map((p) => ({
    ...p,
    _html: generateGroundedPageMarkup(p, projectData),
    _accepted: false,
  }));
}


const client = axios.create({
  baseURL: "/api/akasha",
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("akasha_token")?.trim();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  const apiKey = localStorage.getItem("akasha_api_key")?.trim();
  if (apiKey) config.headers["x-ai-api-key"] = apiKey;
  const model = localStorage.getItem("akasha_model")?.trim();
  if (model) config.headers["x-ai-model"] = model;
  const apiBaseUrl = localStorage.getItem("akasha_api_base_url")?.trim();
  if (apiBaseUrl) config.headers["x-ai-api-base-url"] = apiBaseUrl;
  return config;
});

interface PageDefinition {
  name: string;
  path: string;
  type: string;
  description: string;
  _html?: string;
  _accepted?: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "agent" | "typing";
  text: string;
  html?: string;
}

function ensureDocumentHead(doc: Document): HTMLHeadElement | null {
  if (doc.head) return doc.head;

  const existingHead = doc.getElementsByTagName("head")[0];
  if (existingHead) return existingHead as HTMLHeadElement;

  const root = doc.documentElement || doc.getElementsByTagName("html")[0];
  if (!root) return null;

  const head = doc.createElement("head");
  if (root.firstChild) {
    root.insertBefore(head, root.firstChild);
  } else {
    root.appendChild(head);
  }

  return head;
}

const PAGE_BADGES: Record<string, string> = {
  dashboard: "DASH",
  auth: "AUTH",
  settings: "SETT",
  list: "LIST",
  detail: "PLAY",
  landing: "GATE",
  search: "FIND",
  profile: "RANK",
};

const SITEMAP_LANES = [
  { id: "gateways", label: "Gateways", types: ["landing", "auth"], tag: "GATE" },
  { id: "hubs", label: "Core Hubs", types: ["dashboard", "profile"], tag: "HUBS" },
  { id: "views", label: "Data Views", types: ["list", "search", "detail"], tag: "VIEWS" },
  { id: "utilities", label: "Utilities", types: ["settings"], tag: "UTILS" },
];

/**
 * Dynamic, clean production markup synthesizer for ideation wireframes.
 * Grounded in project domain, data models, and API endpoints.
 * ZERO canned mock templates, ZERO "John Doe", ZERO "#INV-0248".
 */
export function generateGroundedPageMarkup(
  page: { name: string; path?: string; type?: string; description?: string },
  projectData?: any,
  themeConfig?: { accent?: string; font?: string; radius?: number }
): string {
  const projName = projectData?.name || "System Workspace";
  const title = page.name || "Overview";
  const type = (page.type || "dashboard").toLowerCase();
  const desc = page.description || `Operational interface for ${title} within ${projName}.`;

  // Extract real project data models and fields
  const rawModels = ((projectData?.data_models || []) as Array<{ name?: string; fields?: any }>);
  const models = rawModels.map((m) => {
    let fieldNames: string[] = [];
    if (Array.isArray(m.fields)) {
      fieldNames = m.fields.map((f) => (typeof f === "string" ? f.split(":")[0] : (f?.name || "field")));
    }
    return { name: m.name || "Entity", fields: fieldNames };
  });

  const matchingModel = models.find((m) => title.toLowerCase().includes(m.name.toLowerCase())) || models[0];
  const modelName = matchingModel ? matchingModel.name : title.replace(/page|view|screen|hub/gi, "").trim() || "Record";
  const fields = (matchingModel?.fields?.length ? matchingModel.fields : ["id", "title", "status", "updatedAt"]).slice(0, 5);

  const accentColor = themeConfig?.accent || "#6366f1";
  const fontFam = themeConfig?.font ? `'${themeConfig.font}', sans-serif` : "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
  const radius = themeConfig?.radius ?? 8;

  let bodyContent = "";

  if (type === "dashboard") {
    bodyContent = `
      <header class="app-header">
        <div>
          <span class="badge">${escapeHtml(projName)}</span>
          <h1 class="page-title">${escapeHtml(title)}</h1>
          <p class="page-desc">${escapeHtml(desc)}</p>
        </div>
        <div class="actions">
          <button class="btn btn-primary" onclick="alert('Synchronizing ${escapeHtml(projName)} telemetry...')">Sync Telemetry</button>
        </div>
      </header>

      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">Active ${escapeHtml(modelName)}s</span>
          <div class="kpi-val">128</div>
          <span class="kpi-trend positive">+14% this cycle</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">System Health</span>
          <div class="kpi-val">99.8%</div>
          <span class="kpi-trend positive">All services operational</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Processed Events</span>
          <div class="kpi-val">14.2k</div>
          <span class="kpi-trend neutral">Steady baseline</span>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h2>Recent ${escapeHtml(modelName)} Activity</h2>
          <span class="panel-meta">Live pipeline stream</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              ${fields.map((f) => `<th>${escapeHtml(f.toUpperCase())}</th>`).join("")}
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              ${fields.map((_f, i) => `<td>${i === 0 ? "REC-101" : i === 1 ? `Primary ${escapeHtml(modelName)} Entry` : "Active"}</td>`).join("")}
              <td><button class="table-btn" onclick="alert('Viewing record...')">Inspect</button></td>
            </tr>
            <tr>
              ${fields.map((_f, i) => `<td>${i === 0 ? "REC-102" : i === 1 ? `Secondary ${escapeHtml(modelName)} Cluster` : "Pending"}</td>`).join("")}
              <td><button class="table-btn" onclick="alert('Viewing record...')">Inspect</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  } else if (type === "list" || type === "search") {
    bodyContent = `
      <header class="app-header">
        <div>
          <span class="badge">${escapeHtml(projName)} Registry</span>
          <h1 class="page-title">${escapeHtml(title)}</h1>
          <p class="page-desc">${escapeHtml(desc)}</p>
        </div>
        <div class="actions">
          <button class="btn btn-primary" onclick="alert('Create new ${escapeHtml(modelName)}')">+ New ${escapeHtml(modelName)}</button>
        </div>
      </header>

      <div class="toolbar">
        <input type="text" class="search-input" placeholder="Search ${escapeHtml(modelName)} records by ${fields.slice(0, 2).join(' or ')}..." />
        <div class="filter-group">
          <span class="chip active">All Status</span>
          <span class="chip">Active</span>
          <span class="chip">Archived</span>
        </div>
      </div>

      <div class="panel">
        <table class="data-table">
          <thead>
            <tr>
              ${fields.map((f) => `<th>${escapeHtml(f.toUpperCase())}</th>`).join("")}
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              ${fields.map((_f, i) => `<td>${i === 0 ? "ID-001" : i === 1 ? `${escapeHtml(modelName)} Record Alpha` : "Active"}</td>`).join("")}
              <td><button class="table-btn" onclick="alert('Edit record')">Edit</button></td>
            </tr>
            <tr>
              ${fields.map((_f, i) => `<td>${i === 0 ? "ID-002" : i === 1 ? `${escapeHtml(modelName)} Record Beta` : "Verified"}</td>`).join("")}
              <td><button class="table-btn" onclick="alert('Edit record')">Edit</button></td>
            </tr>
            <tr>
              ${fields.map((_f, i) => `<td>${i === 0 ? "ID-003" : i === 1 ? `${escapeHtml(modelName)} Record Gamma` : "In Review"}</td>`).join("")}
              <td><button class="table-btn" onclick="alert('Edit record')">Edit</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  } else if (type === "detail") {
    bodyContent = `
      <header class="app-header">
        <div>
          <span class="badge">${escapeHtml(projName)} &rsaquo; ${escapeHtml(modelName)} Inspector</span>
          <h1 class="page-title">${escapeHtml(title)}</h1>
          <p class="page-desc">${escapeHtml(desc)}</p>
        </div>
        <div class="actions">
          <button class="btn btn-secondary" onclick="alert('Discarding edits...')">Cancel</button>
          <button class="btn btn-primary" onclick="alert('Saving changes...')">Save Changes</button>
        </div>
      </header>

      <div class="detail-grid">
        <div class="panel form-panel">
          <h2>${escapeHtml(modelName)} Configuration</h2>
          <form class="editor-form" onsubmit="event.preventDefault(); alert('Saved!');">
            ${fields.map((f) => `
              <div class="form-group">
                <label>${escapeHtml(f.charAt(0).toUpperCase() + f.slice(1))}</label>
                <input type="text" value="${escapeHtml(f === 'id' ? 'REC-0941' : f === 'status' ? 'Active' : `${modelName} ${f}`)}" />
              </div>
            `).join("")}
          </form>
        </div>

        <div class="panel audit-panel">
          <h2>Audit & Telemetry</h2>
          <ul class="activity-feed">
            <li><strong>Created:</strong> Initial record entry committed by system</li>
            <li><strong>Verified:</strong> Integrity check passed</li>
            <li><strong>Updated:</strong> Parameter thresholds synced</li>
          </ul>
        </div>
      </div>
    `;
  } else if (type === "auth") {
    bodyContent = `
      <div class="auth-wrap">
        <div class="auth-card">
          <span class="badge">${escapeHtml(projName)} Secure Access</span>
          <h1 class="page-title">${escapeHtml(title)}</h1>
          <p class="page-desc">${escapeHtml(desc)}</p>
          <form class="auth-form" onsubmit="event.preventDefault(); alert('Authenticating...');">
            <div class="form-group">
              <label>Work Email</label>
              <input type="email" placeholder="name@company.com" required />
            </div>
            <div class="form-group">
              <label>Access Key / Password</label>
              <input type="password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" required />
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;margin-top:12px;">Sign In</button>
          </form>
        </div>
      </div>
    `;
  } else if (type === "settings") {
    bodyContent = `
      <header class="app-header">
        <div>
          <span class="badge">${escapeHtml(projName)} Preferences</span>
          <h1 class="page-title">${escapeHtml(title)}</h1>
          <p class="page-desc">${escapeHtml(desc)}</p>
        </div>
      </header>

      <div class="panel">
        <h2>Environment & Security Parameters</h2>
        <div class="setting-row">
          <div>
            <div class="setting-title">Auto-Sync on Git Commit</div>
            <div class="setting-desc">Automatically trigger pipeline synthesis when repository pushes occur.</div>
          </div>
          <input type="checkbox" checked />
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-title">Enforce Schema Validation</div>
            <div class="setting-desc">Validate all entity operations against generated data models.</div>
          </div>
          <input type="checkbox" checked />
        </div>
      </div>
    `;
  } else {
    // Landing or general view
    bodyContent = `
      <header class="app-header">
        <div>
          <span class="badge">${escapeHtml(projName)} Platform</span>
          <h1 class="page-title">${escapeHtml(title)}</h1>
          <p class="page-desc">${escapeHtml(desc)}</p>
        </div>
      </header>

      <div class="panel hero-panel">
        <h2>Intelligent Architecture for ${escapeHtml(projName)}</h2>
        <p>Real-time synthesized interface connected directly to project data models and runtime services.</p>
        <div class="hero-actions">
          <button class="btn btn-primary" onclick="alert('Exploring ${escapeHtml(projName)}...')">Get Started</button>
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - ${escapeHtml(projName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    :root {
      --accent: ${accentColor};
      --bg: #090d16;
      --surface: #111827;
      --surface-border: rgba(255, 255, 255, 0.08);
      --text: #f9fafb;
      --text-muted: #9ca3af;
      --radius: ${radius}px;
      --font: ${fontFam};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      padding: 32px;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .app-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
      gap: 16px;
    }
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--accent);
      margin-bottom: 6px;
    }
    .page-title {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .page-desc {
      font-size: 13.5px;
      color: var(--text-muted);
      margin-top: 4px;
      max-width: 600px;
    }
    .actions { display: flex; gap: 10px; align-items: center; }
    .btn {
      padding: 9px 18px;
      border-radius: var(--radius);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.15s ease;
    }
    .btn-primary {
      background: var(--accent);
      color: white;
    }
    .btn-secondary {
      background: rgba(255,255,255,0.06);
      color: var(--text);
      border: 1px solid var(--surface-border);
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius);
      padding: 20px;
    }
    .kpi-label { font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; }
    .kpi-val { font-size: 28px; font-weight: 800; margin: 8px 0 4px; }
    .kpi-trend { font-size: 12px; }
    .kpi-trend.positive { color: #10b981; }
    .kpi-trend.neutral { color: var(--text-muted); }
    .panel {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 24px;
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }
    .panel-header h2 { font-size: 16px; font-weight: 700; }
    .panel-meta { font-size: 12px; color: var(--text-muted); }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .data-table th {
      text-align: left;
      padding: 10px 14px;
      font-size: 11px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--surface-border);
      font-weight: 700;
    }
    .data-table td {
      padding: 14px;
      border-bottom: 1px solid var(--surface-border);
    }
    .table-btn {
      padding: 5px 12px;
      border-radius: 6px;
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--surface-border);
      color: var(--text);
      font-size: 11.5px;
      cursor: pointer;
    }
    .toolbar {
      display: flex;
      gap: 14px;
      align-items: center;
      margin-bottom: 18px;
    }
    .search-input {
      flex: 1;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius);
      padding: 10px 14px;
      color: var(--text);
      font-size: 13px;
    }
    .filter-group { display: flex; gap: 8px; }
    .chip {
      padding: 6px 12px;
      border-radius: 20px;
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--surface-border);
      font-size: 11.5px;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
    }
    .chip.active {
      background: rgba(99, 102, 241, 0.15);
      border-color: var(--accent);
      color: #c7d2fe;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
    }
    .form-group {
      margin-bottom: 16px;
    }
    .form-group label {
      display: block;
      font-size: 11.5px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .form-group input {
      width: 100%;
      background: rgba(0,0,0,0.3);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius);
      padding: 10px 14px;
      color: var(--text);
      font-size: 13px;
    }
    .activity-feed { list-style: none; font-size: 12.5px; line-height: 1.8; color: var(--text-muted); }
    .activity-feed strong { color: var(--text); }
    .auth-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 70vh;
    }
    .auth-card {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius);
      padding: 36px;
      width: 100%;
      max-width: 400px;
    }
    .setting-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      border-bottom: 1px solid var(--surface-border);
    }
    .setting-title { font-size: 13.5px; font-weight: 700; }
    .setting-desc { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
};

const UIIdeationPage: React.FC = () => {
  const api = useApi();
  const toast = useToast();
  const { project } = useProjectStore();
  const { task: bgTask, startTask, updateTask, completeTask, failTask } = useBackgroundLoading();

  // Step state (1: Theme & Sitemap, 2: Live Editor)
  const [step, setStep] = useState<1 | 2>(1);

  // Sitemap & Product State
  const [idea, setIdea] = useState("");
  const [pages, setPages] = useState<PageDefinition[]>([]);
  const [activePageIdx, setActivePageIdx] = useState<number>(0);
  const [isGeneratingSitemap, setIsGeneratingSitemap] = useState(false);
  const hasAutoAnalyzedRef = useRef(false);

  // Theme Studio State
  const [theme] = useState({
    accent: "#6366F1",
    accentDark: "#4F46E5",
    font: "Space Grotesk",
    radius: 8,
    mode: "light" as "light" | "dark",
  });

  // Editor Viewport & Details
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [fullscreen, setFullscreen] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [isGeneratingHTML, setIsGeneratingHTML] = useState(false);
  const [editorCode, setEditorCode] = useState("");
  
  // Chat Agent State
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "agent",
      text: "Hi! I'm your AI page agent. Select a page tab, then tell me what to change (e.g. 'Make the header sticky' or 'Apply dark mode') and I'll update the code live.",
    },
  ]);
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Persistence State
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [hasLoaded, setHasLoaded] = useState(false);
  const persistRef = useRef({ idea, pages, theme, chatMessages });
  persistRef.current = { idea, pages, theme, chatMessages };

  // Review Workflow State
  const [reviewActive, setReviewActive] = useState(false);
  const [pendingHtml, setPendingHtml] = useState("");
  const [previousHtml, setPreviousHtml] = useState("");
  const [reviewSource, setReviewSource] = useState<"generate" | "chat">("generate");

  // Manual Page Dialog State
  const [showAddPageModal, setShowAddPageModal] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [newPageType, setNewPageType] = useState<"dashboard" | "list" | "detail" | "landing" | "auth" | "settings">("list");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const themeCssVars = useMemo(() => `
    :root {
      --primary: ${theme.accent} !important;
      --primary-dark: ${theme.accentDark} !important;
      --radius: ${theme.radius}px !important;
      --font: '${theme.font}', sans-serif !important;
    }
    body {
      font-family: '${theme.font}', sans-serif !important;
    }
  `, [theme]);

  const wrapWithTheme = useCallback((html: string): string => {
    if (!html) return html;
    const guardScript = `<script>document.addEventListener('click',function(e){let t=e.target;while(t){if(t.tagName==='A'&&t.href){e.preventDefault();e.stopPropagation();return}if(t.tagName==='IFRAME')return;t=t.parentElement}},true)</script>`;
    const styleHtml = `<style id="sandbox-injected-theme">${themeCssVars}</style>${guardScript}`;
    if (html.includes('</head>')) return html.replace('</head>', `${styleHtml}</head>`);
    if (html.includes('<head>')) return html.replace('<head>', `<head>${styleHtml}`);
    return `<!DOCTYPE html><html><head>${styleHtml}</head><body>${html}</body></html>`;
  }, [themeCssVars]);

  const injectThemeToIframe = () => {
    const iframe = document.getElementById("live-iframe") as HTMLIFrameElement | null;
    if (!iframe || !iframe.contentWindow) return;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (!doc) return;
    const head = ensureDocumentHead(doc);
    if (!head) return;

    let styleEl = doc.getElementById("sandbox-injected-theme") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = "sandbox-injected-theme";
      head.appendChild(styleEl);
    }
    styleEl.textContent = themeCssVars;
  };

  // Sync injected styles when theme or step changes
  useEffect(() => {
    injectThemeToIframe();
    const timer = setTimeout(injectThemeToIframe, 200);
    return () => clearTimeout(timer);
  }, [theme, step]);

  // Pre-populate product description on project load
  useEffect(() => {
    const parsedSettings = typeof project?.settings === "string"
      ? (() => { try { return JSON.parse(project.settings); } catch { return {}; } })()
      : (project?.settings || {});
    const ideaSummary = (
      parsedSettings?.ideaDetails?.ideaMetadata?.summary ||
      parsedSettings?.ideaDetails?.solution?.productDescription ||
      parsedSettings?.ideaDetails?.ideaMetadata?.tagline ||
      ""
    ).trim();
    const coreFeatures = Array.isArray(parsedSettings?.ideaDetails?.product?.coreFeatures)
      ? parsedSettings.ideaDetails.product.coreFeatures.join(". ")
      : "";
    const repoInfo = parsedSettings?.github_repo?.full_name ? `GitHub Repository: ${parsedSettings.github_repo.full_name}` : "";

    const resolvedIdea = [
      ideaSummary,
      coreFeatures ? `Features: ${coreFeatures}` : "",
      repoInfo,
      project?.description || ""
    ].filter(Boolean).join(" ").trim();

    if (resolvedIdea) {
      setIdea((current) => current.trim() ? current : resolvedIdea);
    }
  }, [project]);

  // Dynamic Google Font Injection
  useEffect(() => {
    const mainHead = ensureDocumentHead(document);
    if (!mainHead) return;

    const linkId = "google-fonts-sandbox";
    let linkElement = document.getElementById(linkId) as HTMLLinkElement;
    if (!linkElement) {
      linkElement = document.createElement("link");
      linkElement.id = linkId;
      linkElement.rel = "stylesheet";
      linkElement.href =
        "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=DM+Sans:wght@400;500;600&family=Syne:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";
      mainHead.appendChild(linkElement);
    }

    const iconLinkId = "tabler-icons-sandbox";
    let iconLinkElement = document.getElementById(iconLinkId) as HTMLLinkElement;
    if (!iconLinkElement) {
      iconLinkElement = document.createElement("link");
      iconLinkElement.id = iconLinkId;
      iconLinkElement.rel = "stylesheet";
      iconLinkElement.href = "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css";
      mainHead.appendChild(iconLinkElement);
    }
  }, []);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Auto-load active page HTML when entering Step 2 with empty editor
  useEffect(() => {
    if (step === 2 && pages.length > 0 && !editorCode && !isGeneratingHTML) {
      const activePage = pages[activePageIdx];
      if (activePage?._html) {
        setEditorCode(activePage._html);
      } else if (activePage) {
        // Trigger generation
        selectPage(activePageIdx);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pages.length]);

  // ── Load sandbox from MongoDB on mount & seed from project data ──
  useEffect(() => {
    if (!project?.id || hasLoaded) return;
    (async () => {
      try {
        const result = await loadSandbox(project.id);
        let loadedPages: PageDefinition[] = [];
        if (result?.sandbox) {
          const s = result.sandbox;
          if (s.idea?.trim()) {
            setIdea(s.idea);
          } else {
            const parsedSettings = typeof project.settings === "string"
              ? (() => { try { return JSON.parse(project.settings); } catch { return {}; } })()
              : (project.settings || {});
            const fallback = (
              project.description ||
              parsedSettings?.ideaDetails?.ideaMetadata?.summary ||
              parsedSettings?.ideaDetails?.solution?.productDescription ||
              ""
            ).trim();
            if (fallback) setIdea(fallback);
          }
          if (s.pages?.length) {
            loadedPages = s.pages as PageDefinition[];
            setPages(loadedPages);
          }
          if (s.chatMessages?.length) {
            setChatMessages(s.chatMessages as ChatMessage[]);
          }
        }

        // If sandbox has no pages, immediately analyze / initialize from project data
        if (loadedPages.length === 0 && !hasAutoAnalyzedRef.current) {
          hasAutoAnalyzedRef.current = true;
          if (project.pages && project.pages.length > 0) {
            const mapped: PageDefinition[] = project.pages.map((p) => {
              const pathLower = (p.path || "").toLowerCase();
              let type = "detail";
              if (pathLower === "/" || pathLower.includes("home") || pathLower.includes("land")) type = "landing";
              else if (pathLower.includes("dash")) type = "dashboard";
              else if (pathLower.includes("auth") || pathLower.includes("login") || pathLower.includes("sign")) type = "auth";
              else if (pathLower.includes("sett") || pathLower.includes("config")) type = "settings";
              else if (pathLower.includes("list") || pathLower.includes("catalog") || pathLower.includes("table")) type = "list";
              else if (pathLower.includes("search") || pathLower.includes("find")) type = "search";
              else if (pathLower.includes("profile") || pathLower.includes("user")) type = "profile";

              return {
                name: p.name || "Page",
                path: p.path || "/",
                type,
                description: p.meta?.description || `${p.name} interface for ${project.name}`,
                _html: p.meta?.custom_html,
                _accepted: true,
              };
            });
            if (mapped.length > 0) {
              setPages(mapped);
            }
          } else {
            // Synthesize from project description & models
            const parsedSettings = typeof project.settings === "string"
              ? (() => { try { return JSON.parse(project.settings); } catch { return {}; } })()
              : (project.settings || {});
            const candidateIdea = (
              project.description ||
              parsedSettings?.ideaDetails?.ideaMetadata?.summary ||
              parsedSettings?.ideaDetails?.solution?.productDescription ||
              `${project.name} platform`
            ).trim();
            if (candidateIdea) {
              setIdea(candidateIdea);
              const synthesized = buildClientFallbackPages(candidateIdea, project);
              setPages(synthesized);
            }
          }
        }

        // Always ensure idea is populated if still empty
        setIdea((curr) => {
          if (curr.trim()) return curr;
          const parsedSettings = typeof project.settings === "string"
            ? (() => { try { return JSON.parse(project.settings); } catch { return {}; } })()
            : (project.settings || {});
          return (
            project.description ||
            parsedSettings?.ideaDetails?.ideaMetadata?.summary ||
            parsedSettings?.ideaDetails?.solution?.productDescription ||
            ""
          ).trim();
        });
      } catch (err) {
        console.error("[UIIdeation] Load sandbox error:", err);
      } finally {
        setHasLoaded(true);
      }
    })();
  }, [project?.id]);

  // ── Auto-save on state changes (debounced) ──
  useEffect(() => {
    if (!hasLoaded || !project?.id) return;
    const data: SandboxData = {
      idea,
      pages,
      theme,
      chatMessages,
    };
    if (!hasSandboxChanges(data)) return;

    setSaveStatus("saving");

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const success = await saveSandbox(project.id, data);
        setSaveStatus(success ? "saved" : "error");
        if (success) {
          setTimeout(() => setSaveStatus((prev) => prev === "saved" ? "idle" : prev), 2000);
        }
      } catch {
        setSaveStatus("error");
      }
    }, 1500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLoaded, project?.id, idea, pages, theme, chatMessages]);

  if (!project) return null;

  // Helpers
  const getThemeDesc = () => {
    return `Primary color: ${theme.accent}. Font: ${theme.font}. Border radius: ${theme.radius}px. Mode: ${theme.mode}.`;
  };

  const forceSave = useCallback(async () => {
    if (!project?.id) return;
    setSaveStatus("saving");
    try {
      const success = await saveSandbox(project.id, {
        idea,
        pages,
        theme,
        chatMessages,
      });
      setSaveStatus(success ? "saved" : "error");
      if (success) setTimeout(() => setSaveStatus((prev) => prev === "saved" ? "idle" : prev), 2000);
    } catch {
      setSaveStatus("error");
    }
  }, [project?.id, idea, pages, theme, chatMessages]);

  // Step 1: Sitemap Generator (Runs Asynchronously in Background)
  const generatePages = async (overrideIdea?: string) => {
    const trimmedIdea = (overrideIdea ?? idea).trim();
    if (!trimmedIdea) return;

    setIsGeneratingSitemap(true);

    // Initiate background task state — this immediately activates the living 3D bubbles
    startTask({
      id: "sitemap-gen",
      title: "Synthesizing Sitemap",
      step: "Analyzing product requirements & domain entities…",
      progress: 25,
    });

    const timer1 = setTimeout(() => {
      updateTask({ step: "Architecting navigation hierarchy & routing…", progress: 52 });
    }, 450);

    const timer2 = setTimeout(() => {
      updateTask({ step: "Synthesizing page schemas & UI sections…", progress: 78 });
    }, 950);

    const timer3 = setTimeout(() => {
      updateTask({ step: "Finalizing production sitemap…", progress: 92 });
    }, 1450);

    try {
      if ((project.description || "").trim() !== trimmedIdea) {
        try {
          const updatedProject = await api.updateProjectDescription(trimmedIdea, project.id);
          setProject(updatedProject);
        } catch (descErr) {
          console.warn("Could not update project description:", descErr);
        }
      }

      const [pagesResult, structuredPlanResult] = await Promise.allSettled([
        client.post("/ai/sandbox/generate-pages", {
          idea: trimmedIdea,
          projectId: project.id,
          projectName: project.name,
          dataModels: (project.data_models || []).map((m) => m.name),
          apis: (project.apis || []).map((a) => `${a.method} ${a.path}`),
          settings: project.settings,
        }),
        generateStructuredIdea(trimmedIdea),
      ]);

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      let extractedPages: PageDefinition[] | null = null;
      if (pagesResult.status === "fulfilled" && pagesResult.value?.data) {
        const d = pagesResult.value.data;
        if (Array.isArray(d)) {
          extractedPages = d;
        } else if (d && typeof d === "object") {
          if (Array.isArray(d.pages)) extractedPages = d.pages;
          else if (Array.isArray(d.sitemap)) extractedPages = d.sitemap;
          else if (Array.isArray(d.routes)) extractedPages = d.routes;
          else if (Array.isArray(d.screens)) extractedPages = d.screens;
          else if (Array.isArray(d.data)) extractedPages = d.data;
        }
      }

      // If server or network was unavailable or empty, fall back seamlessly
      if (!extractedPages || extractedPages.length === 0) {
        extractedPages = buildClientFallbackPages(trimmedIdea, project);
      }

      setPages(extractedPages);
      setActivePageIdx(0);

      // Complete background task: bubbles bloom with celebratory "Done ✓" state
      completeTask({
        step: "Sitemap created",
        resultSummary: `${extractedPages.length} Pages Created`,
      });

      toast.success(`✨ Sitemap generated (${extractedPages.length} pages ready!)`);

      // Force immediate save after generation
      setTimeout(() => forceSave(), 100);

      if (structuredPlanResult.status === "rejected") {
        console.warn("Structured plan sync skipped:", structuredPlanResult.reason);
      }
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      console.warn("Sitemap generation warning, falling back to local heuristic synthesis:", err);

      const fallbackPages = buildClientFallbackPages(trimmedIdea, project);
      setPages(fallbackPages);
      setActivePageIdx(0);
      completeTask({
        step: "Sitemap created",
        resultSummary: `${fallbackPages.length} Pages Created`,
      });
      toast.success(`✨ Sitemap generated (${fallbackPages.length} pages ready!)`);
      setTimeout(() => forceSave(), 100);
    } finally {
      setIsGeneratingSitemap(false);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const name = file.name.replace(/\.[^/.]+$/, ""); // strip extension
        const isCss = file.name.endsWith(".css");
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

        const newPage: PageDefinition = {
          name: name + (isCss ? " (CSS)" : ""),
          path: `/${slug}`,
          type: isCss ? "settings" : "list",
          description: `Uploaded from file: ${file.name}`,
          _html: isCss ? `<style>${text}</style><div style="padding:40px;font-family:sans-serif;"><h2>CSS File Preview</h2><p>This is a raw stylesheet preview.</p><pre>${text}</pre></div>` : text,
        };

        setPages((prev) => [...prev, newPage]);
      };
      reader.readAsText(file);
    });

    // Reset value
    e.target.value = "";
  };

  const handleCreatePage = () => {
    if (!newPageName.trim()) return;
    const slug = newPageName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const initialHtml = generateGroundedPageMarkup({ name: newPageName, path: `/${slug}`, type: newPageType }, project, theme);
    
    const newPage: PageDefinition = {
      name: newPageName,
      path: `/${slug}`,
      type: newPageType,
      description: `Operational view for ${newPageName}`,
      _html: initialHtml,
      _accepted: true,
    };

    setPages((prev) => [...prev, newPage]);
    setNewPageName("");
    setNewPageType("list");
    setShowAddPageModal(false);
  };

  const removePage = (index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
    if (activePageIdx >= pages.length - 1 && activePageIdx > 0) {
      setActivePageIdx(activePageIdx - 1);
    }
  };

  // Step 2: Live HTML Generator & Sync
  const selectPage = async (index: number) => {
    // Cancel any pending review when switching pages
    if (reviewActive) {
      setReviewActive(false);
      setPendingHtml("");
      setPreviousHtml("");
    }
    setActivePageIdx(index);
    const targetPage = pages[index];
    if (!targetPage) return;

    if (targetPage._html) {
      setEditorCode(targetPage._html);
    } else {
      setIsGeneratingHTML(true);
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      try {
        const res = await client.post("/ai/sandbox/generate-page-html", {
          pageName: targetPage.name,
          pageType: targetPage.type,
          pageDescription: targetPage.description,
          idea,
          themeDesc: getThemeDesc(),
        }, { signal });
        let generatedHtml = res.data.html || "";
        if (!generatedHtml.trim()) {
          generatedHtml = generateGroundedPageMarkup(targetPage, project, theme);
          toast.info("Synthesized dynamic page layout for \"" + targetPage.name + "\".");
        }
        setPages((prev) => {
          const updated = [...prev];
          if (updated[index]) updated[index]._html = generatedHtml;
          return updated;
        });
        setEditorCode(generatedHtml);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("HTML Generation error", err);
        toast.error("Failed to generate \"" + targetPage.name + "\". Check your AI configuration.");
        const fallbackHtml = generateGroundedPageMarkup(targetPage, project, theme);
        setPages((prev) => {
          const updated = [...prev];
          if (updated[index]) updated[index]._html = fallbackHtml;
          return updated;
        });
        setEditorCode(fallbackHtml);
      } finally {
        setIsGeneratingHTML(false);
      }
    }
  };

  // Force regenerate the current page via AI (activates review mode)
  const forceGeneratePage = async () => {
    const targetPage = pages[activePageIdx];
    if (!targetPage) return;

    setIsGeneratingHTML(true);

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // If editing a draft that hasn't been accepted yet, skip the review flow
    if (reviewActive) {
      setReviewActive(false);
      setPendingHtml("");
      setPreviousHtml("");
    }

    try {
      const res = await client.post("/ai/sandbox/generate-page-html", {
        pageName: targetPage.name,
        pageType: targetPage.type,
        pageDescription: targetPage.description,
        idea,
        themeDesc: getThemeDesc(),
      }, { signal });
      let generatedHtml = res.data.html || "";
      if (!generatedHtml.trim()) {
        generatedHtml = generateGroundedPageMarkup(targetPage, project, theme);
        toast.info("Synthesized dynamic page layout for \"" + targetPage.name + "\".");
        setPages((prev) => {
          const updated = [...prev];
          if (updated[activePageIdx]) updated[activePageIdx]._html = generatedHtml;
          return updated;
        });
        setEditorCode(generatedHtml);
      } else {
        toast.success("AI generated \"" + targetPage.name + "\"! Review your changes.");
        const prev = editorCode || targetPage._html || "";
        setPreviousHtml(prev);
        setPendingHtml(generatedHtml);
        setReviewSource("generate");
        setReviewActive(true);
        setEditorCode(generatedHtml);
      }
    } catch (err) {
      if (axios.isCancel(err)) return;
      console.error("Force generation error", err);
      toast.error("Failed to generate the page. Check your AI configuration.");
      const fallbackHtml: string = generateGroundedPageMarkup(targetPage, project, theme);
      setPages((prev) => {
        const updated = [...prev];
        if (updated[activePageIdx]) updated[activePageIdx]._html = fallbackHtml;
        return updated;
      });
      setEditorCode(fallbackHtml);
    } finally {
      setIsGeneratingHTML(false);
    }
  };

  // Batch compile all pages in the background
  const [isBatchCompiling, setIsBatchCompiling] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const batchCompileAllPages = async () => {
    if (pages.length === 0 || isBatchCompiling) return;
    setIsBatchCompiling(true);
    startTask({
      title: "UI Batch Compiler",
      step: `Compiling 0/${pages.length} pages in background...`,
      progress: 5,
    });
    toast.info("Starting background compilation for all pages...");

    try {
      const updatedPages = [...pages];
      for (let i = 0; i < updatedPages.length; i++) {
        const p = updatedPages[i];
        setBatchProgress({ current: i + 1, total: updatedPages.length });
        updateTask({
          title: "UI Batch Compiler",
          step: `Compiling "${p.name}" (${i + 1}/${updatedPages.length})...`,
          progress: Math.round(((i + 1) / updatedPages.length) * 100),
        });

        try {
          const res = await client.post("/ai/sandbox/generate-page-html", {
            pageName: p.name,
            pageType: p.type,
            pageDescription: p.description,
            idea,
            themeDesc: getThemeDesc(),
          });
          if (res.data?.html) {
            updatedPages[i] = { ...p, _html: res.data.html, _accepted: true };
            setPages([...updatedPages]);
            if (i === activePageIdx) {
              setEditorCode(res.data.html);
            }
          }
        } catch (pageErr) {
          console.warn(`Failed to compile ${p.name}:`, pageErr);
        }
      }

      completeTask({
        resultSummary: `${pages.length} Pages Ready ✓`,
        step: "Batch compilation complete",
      });
      toast.success(`Successfully compiled ${pages.length} UI pages in the background!`);

      if (project?.id) {
        await saveSandbox(project.id, { idea, pages: updatedPages, theme, chatMessages });
      }
    } catch (err: any) {
      failTask({ error: err.message });
      toast.error(`Batch compile failed: ${err.message}`);
    } finally {
      setIsBatchCompiling(false);
    }
  };

  const applyDomainPreset = useCallback(async () => {
    const dynamicPages = buildClientFallbackPages(idea, project);
    setPages(dynamicPages);
    setActivePageIdx(0);
    toast.success(`Synthesized ${dynamicPages.length} structured pages for ${project?.name || "Project"}!`);
    if (project?.id) {
      await saveSandbox(project.id, { idea: idea || project?.name || "Platform", pages: dynamicPages, theme, chatMessages });
    }
  }, [idea, project, theme, chatMessages, toast]);

  // Direct page agency listener from Autonomous Copilot Bot
  useEffect(() => {
    const handlePageAction = (e: any) => {
      const { action, payload } = e.detail || {};
      if (!action) return;

      if (action === "ADD_PAGE" && payload) {
        const pageCode = payload.html || generateGroundedPageMarkup(payload, project, theme);
        const newPage: PageDefinition = {
          name: payload.name || "New Page",
          path: payload.path || `/${(payload.name || "page").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          type: payload.type || "detail",
          description: payload.description || "Generated page for project workflow",
          _html: pageCode,
          _accepted: true,
        };
        setPages((prev) => {
          const next = [...prev, newPage];
          if (project?.id) {
            void saveSandbox(project.id, { idea, pages: next, theme, chatMessages });
          }
          return next;
        });
        toast.success(`Added page "${newPage.name}" to sitemap!`);
      } else if (action === "REMOVE_PAGE" && payload) {
        setPages((prev) => {
          let next = prev;
          if (typeof payload.index === "number") {
            const item = prev[payload.index];
            if (item) toast.info(`Removed page "${item.name}"`);
            next = prev.filter((_, i) => i !== payload.index);
          } else if (payload.name) {
            const lower = payload.name.toLowerCase();
            next = prev.filter((p) => !p.name.toLowerCase().includes(lower) && !p.path.toLowerCase().includes(lower));
            toast.info(`Removed page matching "${payload.name}"`);
          }
          if (project?.id) {
            void saveSandbox(project.id, { idea, pages: next, theme, chatMessages });
          }
          return next;
        });
      } else if (action === "GENERATE_PAGES") {
        void generatePages(payload?.idea);
      } else if (action === "APPLY_QUIZ_PRESET") {
        void applyDomainPreset();
      } else if (action === "COMPILE_ALL") {
        void batchCompileAllPages();
      } else if (action === "SET_STEP") {
        if (payload === 1 || payload === 2) {
          setStep(payload);
          if (payload === 2) selectPage(activePageIdx);
        }
      } else if (action === "SELECT_PAGE" && typeof payload?.index === "number") {
        setActivePageIdx(payload.index);
        selectPage(payload.index);
        if (payload.openEditor) setStep(2);
      }
    };

    window.addEventListener("akasha:page-action", handlePageAction);
    return () => window.removeEventListener("akasha:page-action", handlePageAction);
  }, [generatePages, applyDomainPreset, batchCompileAllPages, project, idea, theme, chatMessages, toast, activePageIdx, selectPage]);

  const handleNavCta = () => {
    if (pages.length === 0) {
      alert("Please generate or add at least one page first.");
      return;
    }
    setStep(2);
    selectPage(activePageIdx);
  };

  const syncPreview = (newCode: string) => {
    setEditorCode(newCode);
    if (reviewActive) {
      // During review, update pendingHtml instead of committed pages
      setPendingHtml(newCode);
    } else {
      setPages((prev) => {
        const updated = [...prev];
        if (updated[activePageIdx]) updated[activePageIdx]._html = newCode;
        return updated;
      });
    }
  };

  // Step 2: Chat Agent Actions
  const sendChat = async (directMessage?: string) => {
    const msg = (directMessage || chatInput).trim();
    if (!msg) return;
    setChatInput("");

    // Add user message
    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: "user", text: msg };
    setChatMessages((prev) => [...prev, userMsg]);

    const activePage = pages[activePageIdx];
    if (!activePage) return;

    setIsSendingChat(true);
    // Add typing loader
    const typingId = `typing-${Date.now()}`;
    setChatMessages((prev) => [...prev, { id: typingId, role: "typing", text: "Working..." }]);

    try {
      const res = await client.post("/ai/sandbox/edit-page", {
        pageName: activePage.name,
        pageType: activePage.type,
        currentHTML: editorCode,
        message: msg,
        themeDesc: getThemeDesc(),
      });

      const responseText = res.data.response || "";
      // Remove typing
      setChatMessages((prev) => prev.filter((m) => m.id !== typingId));

      const splitIdx = responseText.indexOf("|||HTML_START|||");
      if (splitIdx !== -1) {
        const explanation = responseText.slice(0, splitIdx).trim();
        let newHTML = responseText.slice(splitIdx + 16).trim();
        newHTML = newHTML.replace(/```html|```/g, "").trim();

        // Enter review mode — show changes in preview, wait for accept/discard
        const prev = editorCode || pages[activePageIdx]?._html || "";
        setPreviousHtml(prev);
        setPendingHtml(newHTML);
        setReviewSource("chat");
        setReviewActive(true);
        // Show in preview immediately
        setEditorCode(newHTML);

        setChatMessages((prev) => [
          ...prev,
          { id: `agent-${Date.now()}`, role: "agent", text: explanation, html: newHTML },
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { id: `agent-${Date.now()}`, role: "agent", text: responseText },
        ]);
      }
    } catch (err) {
      console.error("Edit page chat error", err);
      setChatMessages((prev) => prev.filter((m) => m.id !== typingId));
      setChatMessages((prev) => [
        ...prev,
        { id: `agent-error-${Date.now()}`, role: "agent", text: "Sorry, I ran into an error trying to apply that change. Please try again." },
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };
  void sendChat;

  // Review Workflow: Accept / Discard
  const acceptReview = useCallback(() => {
    if (!pendingHtml) return;
        setEditorCode(pendingHtml);
    setReviewActive(false);
    const updatedPages = pages.map((p, i) =>
      i === activePageIdx ? { ...p, _html: pendingHtml, _accepted: true } : p
    );
    setPages(updatedPages);
    setPendingHtml("");
    setPreviousHtml("");
    setChatMessages((prev) => [
      ...prev,
      {
        id: `agent-${Date.now()}`,
        role: "agent",
        text: reviewSource === "generate"
          ? "Changes accepted. The page has been updated with the new design."
          : "Edit accepted. Your feedback has been applied to the page.",
      },
    ]);
    // Immediately save to MongoDB using the computed pages
    if (project?.id) {
      saveSandbox(project.id, { idea, pages: updatedPages, theme, chatMessages }).then((ok) => {
        if (!ok) toast.error("Failed to save accepted changes. Reload and try again.");
      });
    }
  }, [pendingHtml, activePageIdx, idea, pages, theme, chatMessages, project?.id, reviewSource]);

  const discardReview = useCallback(() => {
    const prev = previousHtml || "";
    const updatedPages = pages.map((p, i) =>
      i === activePageIdx ? { ...p, _html: prev, _accepted: true } : p
    );
    setPages(updatedPages);
    setReviewActive(false);
    setPendingHtml("");
    setPreviousHtml("");
    setChatMessages((prev) => [
      ...prev,
      {
        id: `agent-${Date.now()}`,
        role: "agent",
        text: "Changes discarded. The page has been restored to its previous state.",
      },
    ]);
    // Immediately save to MongoDB using the computed pages
    if (project?.id) {
      saveSandbox(project.id, { idea, pages: updatedPages, theme, chatMessages }).then((ok) => {
        if (!ok) toast.error("Failed to save discarded changes. Reload and try again.");
      });
    }
  }, [previousHtml, activePageIdx, idea, pages, theme, chatMessages, project?.id]);

  // Export Tools
  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCurrentPage = () => {
    if (!editorCode) return;
    const page = pages[activePageIdx];
    const filename = (page?.path.replace(/\//g, "_").replace(/^_/, "") || "page") + ".html";
    downloadFile(editorCode, filename);
  };

  const exportAllPages = () => {
    const generated = pages.filter((p) => p._html);
    if (!generated.length) {
      alert("No pages generated yet.");
      return;
    }
    generated.forEach((p) => {
      downloadFile(p._html || "", (p.path.replace(/\//g, "_").replace(/^_/, "") || "index") + ".html");
    });
  };

  return (
    <div className="ux-sandbox-root" style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {/* Scoped Styles */}
      <style>{`
        .ux-sandbox-root {
          font-family: 'Space Grotesk', var(--ide-font, sans-serif);
          background: transparent;
          color: var(--ide-text);
        }

        /* -- Nav -- */
        .ux-nav {
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          background: color-mix(in srgb, var(--ide-bg-elevated) 65%, transparent);
          border-bottom: 1px solid var(--ide-border);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          flex-shrink: 0;
          z-index: 20;
          position: relative;
        }
        .ux-nav-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${theme.accent};
          margin-right: 20px;
        }
        .ux-step {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 14px;
          font-size: 12px;
          font-weight: 600;
          color: var(--ide-text-muted);
          cursor: pointer;
          border-radius: 9999px;
          transition: color 0.15s, background 0.15s, transform 0.15s, border-color 0.15s;
          border: 1px solid transparent;
          background: transparent;
        }
        .ux-step:hover { color: var(--ide-text); background: var(--ide-accent-subtle); transform: translateY(-1px); }
        .ux-step.active {
          color: ${theme.accent};
          background: ${theme.accent}12;
          border-color: ${theme.accent}26;
        }
        .ux-step-num {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          background: var(--ide-accent-subtle);
          color: var(--ide-text-muted);
        }
        .ux-step.active .ux-step-num {
          background: ${theme.accent};
          color: #fff;
        }

        /* -- Buttons -- */
        .ux-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid var(--ide-border);
          background: linear-gradient(180deg, color-mix(in srgb, var(--ide-bg-elevated) 92%, transparent) 0%, var(--ide-bg-elevated) 100%);
          color: var(--ide-text-secondary);
          font-family: inherit;
          box-shadow: var(--ide-shadow-sm);
          transition: background 0.12s, border-color 0.12s, transform 0.12s, box-shadow 0.12s;
        }
        .ux-btn:hover { background: var(--ide-accent-subtle); transform: translateY(-1px); box-shadow: var(--ide-shadow); }
        .ux-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ux-btn.primary {
          background: linear-gradient(135deg, ${theme.accent} 0%, ${theme.accentDark} 100%);
          color: #fff;
          border-color: ${theme.accent};
          box-shadow: 0 12px 28px ${theme.accent}26;
        }
        .ux-btn.primary:hover:not(:disabled) {
          background: linear-gradient(135deg, ${theme.accentDark} 0%, ${theme.accent} 100%);
        }
        .ux-btn.sm { padding: 6px 12px; font-size: 11.5px; }

        /* -- Thinking Dots -- */
        .ux-dots { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ide-text-muted); }
        .ux-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: ${theme.accent};
          animation: ux-dot-anim 0.8s infinite;
        }
        .ux-dot:nth-child(2) { animation-delay: 0.15s; }
        .ux-dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes ux-dot-anim {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }

        /* -- Section Headers -- */
        /* -- Step 1 Layout -- */
        .ux-p1 {
          display: flex;
          flex: 1;
          overflow: hidden;
          min-height: 0;
          height: 100%;
          padding: 16px;
        }
        .ux-p1-main {
          flex: 1;
          width: 100%;
          border: 1px solid var(--ide-border);
          border-radius: 24px;
          box-shadow: var(--ide-shadow);
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background:
            radial-gradient(circle at top right, rgba(99, 102, 241, 0.08), transparent 30%),
            color-mix(in srgb, var(--ide-bg) 55%, transparent);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          height: 100%;
        }

        /* -- Idea Box -- */
        .ux-idea-box {
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--ide-bg-panel) 92%, transparent) 0%, var(--ide-bg-panel) 100%);
          border: 1px solid var(--ide-border);
          border-radius: 16px;
          padding: 14px;
          position: relative;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 320px;
        }
        .ux-idea-box textarea {
          width: 100%;
          min-height: 240px;
          padding: 12px 12px 10px;
          background: transparent;
          border: none;
          outline: none;
          font-size: 13.5px;
          color: var(--ide-text);
          font-family: inherit;
          resize: none;
          line-height: 1.7;
          border-radius: 12px;
          caret-color: ${theme.accent};
          flex: 1;
        }
        .ux-idea-box textarea::placeholder { color: var(--ide-text-muted); }

        /* -- Card General -- */
        .ux-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          border: 1px solid var(--ide-border);
          border-radius: 18px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .ux-card-head {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 13px 16px;
          border-bottom: 1px solid var(--ide-border);
          font-size: 12.5px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: var(--ide-text);
          background: rgba(255, 255, 255, 0.02);
        }
        .ux-card-head i { color: var(--ide-text-muted); font-size: 15px; }

        /* -- Sitemap Canvas & visualizer -- */
        .ux-sitemap-canvas {
          background: rgba(0, 0, 0, 0.06);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 16px;
          border: 1px solid var(--ide-border);
          padding: 18px;
          display: flex;
          gap: 12px;
          overflow-x: auto;
          flex: 1;
          min-height: 480px;
        }
        .ux-sitemap-lane {
          flex: 1;
          min-width: 220px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .ux-sitemap-lane-head {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 12px;
          background: var(--ide-bg-sidebar);
          border: 1px solid var(--ide-border);
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          color: var(--ide-text-secondary);
        }
        .ux-sitemap-lane-head i {
          color: ${theme.accent};
          font-size: 12px;
        }
        .ux-sitemap-lane-cards {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
        }
        .ux-sitemap-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ide-text-muted);
          font-size: 13px;
          opacity: 0.5;
        }
        .ux-sitemap-lane-empty {
          border: 0.5px dashed var(--ide-border);
          border-radius: 8px;
          padding: 16px;
          text-align: center;
          color: var(--ide-text-muted);
          font-size: 10.5px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          background: rgba(0,0,0,0.01);
        }

        /* -- Page Cards -- */
        .ux-page-card {
          border: 1px solid var(--ide-border);
          border-radius: 14px;
          cursor: pointer;
          transition: border-color 0.12s, box-shadow 0.12s, transform 0.12s, background 0.12s;
          position: relative;
          background: linear-gradient(180deg, color-mix(in srgb, var(--ide-bg-elevated) 96%, transparent) 0%, var(--ide-bg-elevated) 100%);
          box-shadow: var(--ide-shadow-sm);
        }
        .ux-page-card:hover {
          border-color: ${theme.accent};
          transform: translateY(-1px);
          box-shadow: 0 8px 20px ${theme.accent}14;
        }
        .ux-page-card.selected {
          border-color: ${theme.accent};
          box-shadow: 0 0 0 3px ${theme.accent}15;
          background: ${theme.accent}06;
        }
        .ux-page-card .pc-remove {
          opacity: 0;
          transition: opacity 0.12s;
        }
        .ux-page-card:hover .pc-remove { opacity: 1; }

        .ux-add-card {
          border: 0.5px dashed var(--ide-border);
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 16px;
          min-height: 100px;
          color: var(--ide-text-muted);
          font-size: 11.5px;
          transition: border-color 0.12s, color 0.12s;
          background: transparent;
        }
        .ux-add-card:hover {
          border-color: ${theme.accent};
          color: ${theme.accent};
        }

        /* -- Page Skeleton Generation Screen (theme-aware) -- */
        .ux-skeleton-screen {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          background: linear-gradient(180deg, color-mix(in srgb, ${theme.accent}06, var(--ide-bg-panel) 100%) 0%, var(--ide-bg-panel) 100%);
          color: var(--ide-text-muted);
          font-family: 'JetBrains Mono', monospace;
          padding: 24px;
          overflow: hidden;
        }
        .ux-skeleton-bar {
          height: 8px;
          background: color-mix(in srgb, ${theme.accent}10, var(--ide-border) 80%);
          border-radius: 4px;
          margin-bottom: 8px;
          position: relative;
          overflow: hidden;
        }
        .ux-skeleton-bar::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent, color-mix(in srgb, ${theme.accent}12, transparent 50%), transparent);
          animation: skeleton-shimmer 1.8s ease-in-out infinite;
        }
        @keyframes skeleton-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        /* -- Sitemap skeleton (Step 1 generating) -- */
        .ux-sitemap-skeleton {
          display: flex;
          gap: 12px;
          flex: 1;
          min-height: 480px;
          padding: 18px;
          background-color: var(--ide-bg-elevated);
          background-image: radial-gradient(var(--ide-border) 1px, transparent 1px);
          background-size: 18px 18px;
          border-radius: 16px;
          border: 1px solid var(--ide-border);
        }
        .ux-sitemap-skeleton-lane {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 220px;
        }
        .ux-sitemap-skeleton-lane-head {
          height: 42px;
          border-radius: 12px;
          background: color-mix(in srgb, ${theme.accent}08, var(--ide-bg-sidebar) 100%);
          border: 1px solid var(--ide-border);
          position: relative;
          overflow: hidden;
        }
        .ux-sitemap-skeleton-lane-head::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, color-mix(in srgb, ${theme.accent}10, transparent 50%), transparent);
          animation: skeleton-shimmer 1.8s ease-in-out infinite;
        }
        .ux-sitemap-skeleton-card {
          height: 110px;
          border-radius: 14px;
          background: color-mix(in srgb, ${theme.accent}04, var(--ide-bg-elevated) 100%);
          border: 1px solid var(--ide-border);
          position: relative;
          overflow: hidden;
        }
        .ux-sitemap-skeleton-card::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, color-mix(in srgb, ${theme.accent}08, transparent 50%), transparent);
          animation: skeleton-shimmer 1.8s ease-in-out infinite 0.3s;
        }

        /* -- Progress bar animation -- */
        @keyframes ux-progress-pulse {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
        .ux-progress-bar {
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: transparent;
          overflow: hidden;
        }
        .ux-progress-bar::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 40%;
          height: 100%;
          background: linear-gradient(90deg, transparent, ${theme.accent}, transparent);
          animation: ux-progress-pulse 1.4s ease-in-out infinite;
          border-radius: 2px;
          box-shadow: 0 0 8px ${theme.accent}40;
        }

        /* -- Step 2 Layout -- */
        .ux-p2 {
          display: grid;
          grid-template-columns: 1fr;
          flex: 1;
          overflow: hidden;
          min-height: 0;
          gap: 16px;
          padding: 16px;
        }
        .ux-p2.has-review {
          grid-template-columns: minmax(0, 1fr) 420px;
        }
        .ux-p2-preview {
          display: flex;
          flex-direction: column;
          border: 1px solid var(--ide-border);
          border-radius: 24px;
          background: color-mix(in srgb, var(--ide-bg-elevated) 65%, transparent);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          overflow: hidden;
        }
        .ux-p2-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-bottom: 1px solid var(--ide-border);
          background: color-mix(in srgb, var(--ide-bg-elevated) 70%, transparent);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          flex-shrink: 0;
        }

        /* Page Tabs */
        .ux-p2-tab {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: 5px;
          font-size: 12px;
          color: var(--ide-text-muted);
          cursor: pointer;
          white-space: nowrap;
          border: none;
          background: transparent;
          font-family: inherit;
          transition: all 0.12s;
        }
        .ux-p2-tab:hover:not(.active) {
          color: var(--ide-text-secondary);
          background: var(--ide-accent-subtle);
        }
        .ux-p2-tab.active {
          background: ${theme.accent}14;
          color: ${theme.accent};
          font-weight: 500;
        }

        /* Viewport buttons */
        .ux-vp-btn {
          padding: 5px 7px;
          border-radius: 5px;
          font-size: 13px;
          cursor: pointer;
          border: 0.5px solid var(--ide-border);
          background: transparent;
          color: var(--ide-text-muted);
          font-family: inherit;
          transition: all 0.12s;
        }
        .ux-vp-btn.active {
          background: ${theme.accent}14;
          color: ${theme.accent};
          border-color: transparent;
        }

        /* Preview frame */
        .ux-frame-area {
          flex: 1;
          overflow: auto;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 16px;
          background: var(--ide-canvas-bg);
        }
        .ux-frame-area.desktop { padding: 0; background: #fff; }

        .ux-iframe-desktop { border: none; width: 100%; height: 100%; min-height: 550px; display: block; }
        .ux-iframe-tablet {
          width: 768px; height: 1024px;
          border-radius: 14px;
          box-shadow: var(--ide-shadow);
          border: 8px solid var(--ide-bg-panel);
          background: #fff;
        }
        .ux-iframe-mobile {
          width: 390px; height: 844px;
          border-radius: 24px;
          box-shadow: var(--ide-shadow);
          border: 8px solid var(--ide-bg-panel);
          background: #fff;
        }

        /* Code toggle */
        .ux-code-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-top: 0.5px solid var(--ide-border);
          background: var(--ide-accent-subtle);
          flex-shrink: 0;
        }
        .ux-code-bar span {
          flex: 1;
          font-size: 11px;
          color: var(--ide-text-muted);
          font-family: 'JetBrains Mono', monospace;
        }
        .ux-code-area {
          border-top: 0.5px solid var(--ide-border);
          max-height: 200px;
          flex-shrink: 0;
        }
        .ux-code-area textarea {
          width: 100%;
          height: 160px;
          background: #1e1e2e;
          border: none;
          outline: none;
          padding: 10px 14px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #cdd6f4;
          resize: none;
          line-height: 1.7;
        }

        /* -- Chat Panel -- */
        .ux-chat {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--ide-bg-elevated);
          border: 1px solid var(--ide-border);
          border-radius: 24px;
        }
        .ux-chat-head {
          padding: 10px 14px;
          border-bottom: 0.5px solid var(--ide-border);
          flex-shrink: 0;
        }
        .ux-agent-badge {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 10px;
          background: #E1F5EE;
          color: #0F6E56;
          font-weight: 500;
        }
        .ux-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Messages */
        .ux-msg { display: flex; flex-direction: column; gap: 3px; }
        .ux-msg.user { align-items: flex-end; }
        .ux-msg.agent { align-items: flex-start; }
        .ux-msg-bubble {
          max-width: 88%;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 12.5px;
          line-height: 1.55;
        }
        .ux-msg.user .ux-msg-bubble {
          background: ${theme.accent};
          color: #fff;
          border-radius: 10px 10px 2px 10px;
        }
        .ux-msg.agent .ux-msg-bubble {
          background: var(--ide-accent-subtle);
          color: var(--ide-text);
          border: 0.5px solid var(--ide-border);
          border-radius: 10px 10px 10px 2px;
        }
        .ux-msg.typing .ux-msg-bubble {
          background: var(--ide-accent-subtle);
          border: 0.5px solid var(--ide-border);
          border-radius: 10px 10px 10px 2px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--ide-text-muted);
        }
        .ux-msg-meta {
          font-size: 9.5px;
          color: var(--ide-text-muted);
          padding: 0 4px;
        }
        .ux-msg-applied {
          font-size: 10.5px;
          padding: 3px 8px;
          border-radius: 5px;
          background: ${theme.accent}12;
          color: ${theme.accent};
          border: 0.5px solid ${theme.accent}30;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        /* Chips */
        .ux-chip {
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 20px;
          border: 0.5px solid var(--ide-border);
          color: var(--ide-text-secondary);
          background: var(--ide-accent-subtle);
          cursor: pointer;
          white-space: nowrap;
          font-family: inherit;
          transition: border-color 0.12s, color 0.12s;
        }
        .ux-chip:hover {
          border-color: ${theme.accent};
          color: ${theme.accent};
        }
        .ux-chip:disabled { opacity: 0.5; cursor: not-allowed; }

        /* -- Review Panel -- */
        .ux-review-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: color-mix(in srgb, var(--ide-bg-elevated) 70%, transparent); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--ide-border); border-radius: 24px; }
        .ux-review-head { padding: 12px 14px; border-bottom: 0.5px solid var(--ide-border); flex-shrink: 0; display: flex; align-items: center; gap: 8px; }
        .ux-review-badge { font-size: 9px; padding: 2px 8px; border-radius: 10px; background: #fef3c7; color: #92400e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .ux-review-head h4 { font-size: 12px; font-weight: 600; color: var(--ide-text); flex: 1; }
        .ux-review-desc { font-size: 11px; color: var(--ide-text-secondary); padding: 8px 14px; line-height: 1.5; border-bottom: 0.5px solid var(--ide-border); flex-shrink: 0; }
        .ux-review-textarea { flex: 1; overflow: hidden; padding: 10px; display: flex; flex-direction: column; }
        .ux-review-textarea label { font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ide-text-muted); margin-bottom: 6px; }
        .ux-review-textarea textarea {
          flex: 1; width: 100%; background: #1a1b26; border: 0.5px solid rgba(255,255,255,0.06); border-radius: 10px;
          padding: 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #a9b1d6; resize: none;
          outline: none; line-height: 1.6; tab-size: 2;
        }
        .ux-review-textarea textarea:focus { border-color: ${theme.accent}; }
        .ux-review-actions { display: flex; gap: 8px; padding: 10px 14px; border-top: 0.5px solid var(--ide-border); flex-shrink: 0; }
        .ux-review-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; transition: all 0.12s; }
        .ux-review-btn.accept { background: linear-gradient(135deg, #10b981, #059669); color: white; box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
        .ux-review-btn.accept:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(16,185,129,0.4); }
        .ux-review-btn.discard { background: var(--ide-accent-subtle); color: var(--ide-text-secondary); border: 0.5px solid var(--ide-border); }
        .ux-review-btn.discard:hover { background: #fee2e2; color: #dc2626; border-color: #fecaca; }

        /* Review banner on the preview frame */
        .ux-review-banner {
          position: absolute; top: 0; left: 0; right: 0; z-index: 15;
          background: linear-gradient(135deg, #fef3c7, #fde68a); color: #92400e; padding: 8px 16px;
          display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 500;
          border-bottom: 1px solid rgba(146,64,14,0.1);
        }

        /* Chat Input */
        .ux-chat-input-box {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          background: var(--ide-accent-subtle);
          border: 0.5px solid var(--ide-border);
          border-radius: 10px;
          padding: 7px 10px;
          transition: border-color 0.15s;
        }
        .ux-chat-input-box:focus-within { border-color: ${theme.accent}; }
        .ux-chat-input-box textarea {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-size: 12.5px;
          color: var(--ide-text);
          font-family: inherit;
          resize: vertical;
          line-height: 1.55;
          min-height: 44px;
          max-height: 380px;
          overflow-y: auto;
        }
        .ux-chat-input-box textarea::placeholder { color: var(--ide-text-muted); }
        .ux-chat-send {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          background: ${theme.accent};
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
          transition: background 0.12s;
        }
        .ux-chat-send:hover:not(:disabled) { background: ${theme.accentDark}; }
        .ux-chat-send:disabled { opacity: 0.4; cursor: not-allowed; }

        /* -- Modal -- */
        .ux-modal-bg {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
        }
        .ux-modal-box {
          background: var(--ide-bg-elevated);
          border-radius: 14px;
          padding: 24px;
          width: 400px;
          border: 0.5px solid var(--ide-border);
          box-shadow: var(--ide-shadow);
        }
        .ux-modal-box h3 { font-size: 15px; font-weight: 600; margin-bottom: 6px; color: var(--ide-text); }
        .ux-modal-box p { font-size: 12.5px; color: var(--ide-text-secondary); margin-bottom: 16px; line-height: 1.65; }
        .ux-modal-box input,
        .ux-modal-box select {
          width: 100%;
          border: 0.5px solid var(--ide-border);
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 12.5px;
          font-family: inherit;
          outline: none;
          background: var(--ide-accent-subtle);
          color: var(--ide-text);
        }
        .ux-modal-box input:focus,
        .ux-modal-box select:focus { border-color: ${theme.accent}; }
        .ux-modal-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ide-text-muted);
          margin-bottom: 5px;
          display: block;
        }

        /* -- Scrollbar -- */
        .ux-sandbox-root ::-webkit-scrollbar { width: 5px; height: 5px; }
        .ux-sandbox-root ::-webkit-scrollbar-track { background: transparent; }
        .ux-sandbox-root ::-webkit-scrollbar-thumb { background: var(--ide-scrollbar); border-radius: 3px; }
        .ux-sandbox-root ::-webkit-scrollbar-thumb:hover { background: var(--ide-scrollbar-hover); }
      `}</style>

      {/* Hidden File Input for uploading */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".html,.css"
        multiple
        style={{ display: "none" }}
      />

      {/* ── TOP NAV ── */}
      <nav className="ux-nav" style={{ position: "relative" }}>
        {/* Animated progress bar when any operation is running */}
        {(isGeneratingSitemap || isGeneratingHTML || isSendingChat) && (
          <div className="ux-progress-bar" />
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <div className="ux-nav-brand">
            <span>UX SANDBOX</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <button onClick={() => setStep(1)} className={`ux-step ${step === 1 ? "active" : ""}`}>
              <div className="ux-step-num">1</div>
              <span>Idea & pages</span>
            </button>
            <span style={{ color: "var(--ide-text-muted)", fontSize: 11, margin: "0 4px" }}>→</span>
            <button
              onClick={handleNavCta}
              disabled={pages.length === 0}
              className={`ux-step ${step === 2 ? "active" : ""}`}
            >
              <div className="ux-step-num">2</div>
              <span>Live editor</span>
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Save Status Indicator */}
          {saveStatus !== "idle" && !isGeneratingSitemap && !isGeneratingHTML && !isSendingChat && (
            <span style={{
              fontSize: 10.5,
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: saveStatus === "saving" ? "var(--ide-text-muted)"
                : saveStatus === "saved" ? "#10b981"
                : "#ef4444",
              fontWeight: 600,
              transition: "color 0.2s",
            }}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Save failed"}
            </span>
          )}
          {isGeneratingSitemap && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "3px 10px",
                borderRadius: 999,
                background: "rgba(56, 189, 248, 0.12)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                color: "#38bdf8",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>Synthesizing in background ({Math.round(bgTask.progress || 25)}%)</span>
            </div>
          )}
          {!isGeneratingSitemap && bgTask.status === "done" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 10px",
                borderRadius: 999,
                background: "rgba(16, 185, 129, 0.14)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                color: "#10b981",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              <span>✓ Done ({bgTask.resultSummary || "Ready"})</span>
            </div>
          )}
          {!isGeneratingSitemap && (isGeneratingHTML || isSendingChat) && (
            <div className="ux-dots">
              <div className="ux-dot" />
              <div className="ux-dot" />
              <div className="ux-dot" />
              <span style={{ fontWeight: 500 }}>Working…</span>
            </div>
          )}

          {step === 1 ? (
            <button
              onClick={handleNavCta}
              disabled={pages.length === 0}
              className="ux-btn primary"
            >
              <span>Continue to Editor</span>
            </button>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={exportCurrentPage} className="ux-btn sm">
                <span>Export</span>
              </button>
              <button onClick={exportAllPages} className="ux-btn sm">
                <span>All</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ══════ STEP 1: SITEMAP & ARCHITECTURE ══════ */}
      {step === 1 && (
        <div className="ux-p1">
          {/* Visual Sitemap Canvas */}
          <div className="ux-p1-main">
            <div className="ux-card" style={{ flex: 1 }}>
              <div className="ux-card-head">
                <span className="font-bold text-[10px] tracking-wider px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-500">MAP</span>
                <span style={{ flex: 1 }}>
                  Sitemap Architecture <span style={{ fontWeight: 400, color: "var(--ide-text-muted)", fontSize: 11.5 }}>({pages.length} pages structured)</span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    onClick={() => generatePages()}
                    disabled={isGeneratingSitemap}
                    className="ux-btn sm"
                    title="Generate sitemap from project specification with AI"
                  >
                    <span>{isGeneratingSitemap ? "Synthesizing…" : "Generate Sitemap"}</span>
                  </button>
                  <button
                    onClick={() => applyDomainPreset()}
                    className="ux-btn sm"
                    style={{ borderColor: "rgba(6, 182, 212, 0.4)", color: "#22d3ee" }}
                    title="Apply tailored Quiz Platform sitemap blueprint"
                  >
                    <span>Quiz Blueprint</span>
                  </button>
                  <button onClick={() => setShowAddPageModal(true)} className="ux-btn sm primary">
                    <span>Add Page</span>
                  </button>
                  <button
                    onClick={() => batchCompileAllPages()}
                    disabled={isBatchCompiling || pages.length === 0}
                    className="ux-btn sm"
                    title="Batch compile interactive wireframes for all pages"
                  >
                    <span>{isBatchCompiling ? `Compiling (${batchProgress.current}/${batchProgress.total})…` : "Compile Wireframes"}</span>
                  </button>
                  <button onClick={triggerFileUpload} className="ux-btn sm">
                    <span>Upload HTML</span>
                  </button>
                </div>
              </div>

              <div style={{ padding: 16, display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
                {pages.length === 0 && isGeneratingSitemap ? (
                  <div style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 18,
                    borderRadius: 12,
                    border: "1px dashed rgba(56, 189, 248, 0.35)",
                    background: "radial-gradient(ellipse at 50% 30%, rgba(56, 189, 248, 0.08) 0%, rgba(0, 0, 0, 0.02) 80%)",
                    padding: 40,
                    textAlign: "center",
                  }}>
                    <div className="bubble-spinner-ring" style={{ width: 38, height: 38 }} />
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ide-text)" }}>
                        Synthesizing Sitemap Architecture
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--ide-text-muted)", marginTop: 6, maxWidth: 360, lineHeight: 1.5 }}>
                        {bgTask.step || "Analyzing product requirements & domain entities…"}
                      </div>
                    </div>
                    <div style={{ width: 280, height: 6, borderRadius: 999, background: "rgba(255, 255, 255, 0.1)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${Math.round(bgTask.progress || 30)}%`,
                        background: "linear-gradient(90deg, #38bdf8, #a855f7)",
                        transition: "width 0.4s ease",
                        borderRadius: 999,
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ide-text-muted)", opacity: 0.85, display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span>Running in background — watch the 3D bubbles or continue configuring!</span>
                    </div>
                  </div>
                ) : pages.length === 0 ? (
                  <div style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    border: "0.5px dashed var(--ide-border)",
                    borderRadius: 10,
                    padding: 40,
                    color: "var(--ide-text-muted)",
                    textAlign: "center",
                    background: "rgba(0,0,0,0.01)"
                  }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "var(--ide-text-muted)", letterSpacing: "0.1em" }}>EMPTY</span>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ide-text)" }}>No pages in sitemap</div>
                    <div style={{ fontSize: 12, maxWidth: 300, lineHeight: 1.5 }}>
                      Synthesize pages from your project architecture or add pages manually.
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button onClick={() => generatePages()} disabled={isGeneratingSitemap} className="ux-btn sm">
                        <span>{isGeneratingSitemap ? "Synthesizing…" : "Generate Pages"}</span>
                      </button>
                      <button onClick={() => applyDomainPreset()} className="ux-btn sm" style={{ color: "#22d3ee" }}>
                        <span>Quiz Blueprint</span>
                      </button>
                      <button onClick={() => setShowAddPageModal(true)} className="ux-btn sm primary">
                        <span>Add Page</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ux-sitemap-canvas">
                    {SITEMAP_LANES.map((lane, laneIdx) => {
                      // Filter pages belonging to this lane
                      const lanePages = pages
                        .map((p, idx) => ({ ...p, originalIdx: idx }))
                        .filter((p) => {
                          if (lane.id === "utilities") {
                            // Catch-all for utility types or types not covered by other lanes
                            return !SITEMAP_LANES.some(l => l.id !== "utilities" && l.types.includes(p.type)) || lane.types.includes(p.type);
                          }
                          return lane.types.includes(p.type);
                        });

                      return (
                        <React.Fragment key={lane.id}>
                          <div className="ux-sitemap-lane">
                            <div className="ux-sitemap-lane-head">
                              <span style={{ fontSize: 9, fontWeight: 800, color: theme.accent, marginRight: 6 }}>{lane.tag}</span>
                              <span>{lane.label}</span>
                              <span style={{ marginLeft: "auto", fontSize: 9.5, opacity: 0.6, background: "var(--ide-border)", padding: "1px 5px", borderRadius: 10 }}>
                                {lanePages.length}
                              </span>
                            </div>

                            <div className="ux-sitemap-lane-cards">
                              {lanePages.map((p) => (
                                <div
                                  key={p.originalIdx}
                                  className={`ux-page-card ${activePageIdx === p.originalIdx ? "selected" : ""}`}
                                  onClick={() => setActivePageIdx(p.originalIdx)}
                                  style={{ position: "relative", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}
                                >
                                  {/* Card Header */}
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{
                                      width: 24, height: 24, borderRadius: 6,
                                      background: `${theme.accent}12`,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      color: theme.accent, fontSize: 9, fontWeight: 800, flexShrink: 0
                                    }}>
                                      <span>{PAGE_BADGES[p.type] || "PAGE"}</span>
                                    </div>
                                    <div style={{ flex: 1, overflow: "hidden" }}>
                                      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ide-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {p.name}
                                      </div>
                                      <div style={{ fontSize: 9.5, color: theme.accent, fontFamily: "monospace", marginTop: 1 }}>
                                        {p.path}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Card Description */}
                                  {p.description && (
                                    <div style={{
                                      fontSize: 10,
                                      color: "var(--ide-text-secondary)",
                                      lineHeight: 1.4,
                                      opacity: 0.8,
                                      display: "-webkit-box",
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis"
                                    }}>
                                      {p.description}
                                    </div>
                                  )}

                                  {/* Status indicator & preview CTAs */}
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, borderTop: "0.5px solid var(--ide-border)", paddingTop: 8 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      <span style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: "50%",
                                        background: p._html && p._accepted ? "#10b981" : "#3b82f6"
                                      }} />
                                      <span style={{ fontSize: 9.5, color: "var(--ide-text-muted)" }}>
                                        {p._html && p._accepted ? "AI Compiled" : "Dynamic Layout"}
                                      </span>
                                    </div>

                                    {p._html && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setStep(2);
                                          selectPage(p.originalIdx);
                                        }}
                                        className="ux-btn sm"
                                        style={{ padding: "2px 6px", fontSize: 9.5, borderRadius: 4, background: "var(--ide-accent-subtle)" }}
                                        title="Preview and Edit Page"
                                      >
                                        <span>Preview</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* Hover Delete */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removePage(p.originalIdx);
                                    }}
                                    className="pc-remove"
                                    style={{
                                      position: "absolute",
                                      top: 4,
                                      right: 4,
                                      padding: "1px 6px",
                                      height: 18,
                                      background: "var(--ide-bg-elevated)",
                                      border: "0.5px solid var(--ide-border)",
                                      borderRadius: 4,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: 9,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      color: "var(--ide-text-secondary)",
                                    }}
                                  >
                                    <span>Delete</span>
                                  </button>
                                </div>
                              ))}

                              {/* Lane specific add placeholder */}
                              {lanePages.length === 0 && (
                                <div className="ux-sitemap-lane-empty">
                                  No {lane.label.toLowerCase()}
                                </div>
                              )}
                            </div>
                          </div>

                          {laneIdx < SITEMAP_LANES.length - 1 && (
                            <div className="ux-sitemap-arrow">
                              <span>→</span>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Standard add page card at sitemap level */}
                    <div className="ux-sitemap-lane" style={{ minWidth: 100, justifyContent: "center" }}>
                      <button onClick={() => setShowAddPageModal(true)} className="ux-add-card">
                        <span>Add Page</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ STEP 2: LIVE EDITOR + CHAT ══════ */}
      {step === 2 && (
        <div className={`ux-p2 ${reviewActive ? "has-review" : ""}`}>
          {/* LEFT: Preview */}
          <div className="ux-p2-preview">
            <div className="ux-p2-toolbar">
              <div style={{ display: "flex", gap: 1, overflow: "auto", flex: 1, scrollbarWidth: "none" }}>
                {pages.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => selectPage(i)}
                    className={`ux-p2-tab ${activePageIdx === i ? "active" : ""}`}
                  >
                    <span style={{ fontSize: 9, fontWeight: 800, marginRight: 6 }}>{PAGE_BADGES[p.type] || "DOC"}</span>
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 3, flexShrink: 0, alignItems: "center" }}>
                <button
                  onClick={batchCompileAllPages}
                  disabled={isBatchCompiling}
                  className="ux-btn sm primary"
                  style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", marginRight: 4 }}
                  title="Compile all pages in background"
                >
                  <span>{isBatchCompiling ? `Compiling (${batchProgress.current}/${batchProgress.total})…` : "Compile All"}</span>
                </button>
                {[
                  { id: "desktop" as const, label: "DESK" },
                  { id: "tablet" as const, label: "TAB" },
                  { id: "mobile" as const, label: "MOB" },
                ].map((vp) => (
                  <button
                    key={vp.id}
                    onClick={() => setViewport(vp.id)}
                    className={`ux-vp-btn ${viewport === vp.id ? "active" : ""}`}
                    title={vp.id}
                    style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px" }}
                  >
                    <span>{vp.label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setFullscreen(v => !v)}
                className="ux-btn sm"
                title="Toggle fullscreen preview"
              >
                <span>{fullscreen ? "Minimize" : "Fullscreen"}</span>
              </button>

              <button
                onClick={forceGeneratePage}
                disabled={isGeneratingHTML}
                className="ux-btn sm"
                title="Regenerate page wireframe"
              >
                <span>Regenerate</span>
              </button>

              <button onClick={exportCurrentPage} className="ux-btn sm">
                <span>Export</span>
              </button>
            </div>

            {/* Iframe Preview */}
            <div className={`ux-frame-area ${viewport === "desktop" ? "desktop" : ""}`} style={{ position: "relative" }}>
              {isGeneratingHTML ? (
                <div className="ux-skeleton-screen" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Mock Navbar (theme-aware) */}
                  <div style={{
                    height: 48,
                    background: "color-mix(in srgb, var(--ide-border) 40%, transparent)",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 16px",
                    border: "0.5px solid var(--ide-border)"
                  }}>
                    <div className="ux-skeleton-bar" style={{ width: 80, height: 10, margin: 0 }} />
                    <div style={{ display: "flex", gap: 12, marginLeft: "auto" }}>
                      <div className="ux-skeleton-bar" style={{ width: 40, height: 8, margin: 0 }} />
                      <div className="ux-skeleton-bar" style={{ width: 40, height: 8, margin: 0 }} />
                    </div>
                  </div>

                  {/* Mock Workspace Content (theme-aware) */}
                  <div style={{ flex: 1, display: "flex", gap: 16 }}>
                    {/* Mock Sidebar */}
                    <div style={{
                      width: 140,
                      background: "color-mix(in srgb, var(--ide-border) 20%, transparent)",
                      borderRadius: 8,
                      padding: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      border: "0.5px solid var(--ide-border)"
                    }}>
                      <div className="ux-skeleton-bar" style={{ width: "70%", height: 8 }} />
                      <div className="ux-skeleton-bar" style={{ width: "50%", height: 8 }} />
                      <div className="ux-skeleton-bar" style={{ width: "60%", height: 8 }} />
                      <div className="ux-skeleton-bar" style={{ width: "40%", height: 8 }} />
                    </div>

                    {/* Mock Main Area */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
                      {/* Metric widgets skeleton (theme-aware) */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                        {[40, 30, 50].map((w, i) => (
                          <div key={i} style={{
                            height: 64,
                            background: "color-mix(in srgb, var(--ide-border) 20%, transparent)",
                            border: "0.5px solid var(--ide-border)",
                            borderRadius: 8,
                            padding: 12
                          }}>
                            <div className="ux-skeleton-bar" style={{ width: `${w}%`, height: 6 }} />
                            <div className="ux-skeleton-bar" style={{ width: `${w + 20}%`, height: 12, marginTop: 8 }} />
                          </div>
                        ))}
                      </div>

                      {/* Main Table skeleton (theme-aware) */}
                      <div style={{
                        flex: 1,
                        background: "color-mix(in srgb, var(--ide-border) 15%, transparent)",
                        border: "0.5px solid var(--ide-border)",
                        borderRadius: 8,
                        padding: 16,
                        display: "flex",
                        flexDirection: "column",
                        gap: 12
                      }}>
                        <div className="ux-skeleton-bar" style={{ width: "20%", height: 10 }} />
                        <div style={{ borderBottom: "0.5px solid var(--ide-border)", paddingBottom: 8 }} />
                        <div className="ux-skeleton-bar" style={{ width: "100%", height: 8 }} />
                        <div className="ux-skeleton-bar" style={{ width: "95%", height: 8 }} />
                        <div className="ux-skeleton-bar" style={{ width: "98%", height: 8 }} />
                        <div className="ux-skeleton-bar" style={{ width: "92%", height: 8 }} />
                        <div className="ux-skeleton-bar" style={{ width: "88%", height: 8 }} />
                      </div>
                    </div>
                  </div>

                  {/* AI Status Banner overlay — based on theme */}
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "color-mix(in srgb, var(--ide-bg) 80%, transparent)",
                    backdropFilter: "blur(6px)"
                  }}>
                    <div style={{
                      background: "var(--ide-bg-elevated)",
                      border: "1px solid var(--ide-border)",
                      borderRadius: 16,
                      padding: "24px 36px",
                      textAlign: "center",
                      boxShadow: "var(--ide-shadow-premium, var(--ide-shadow))",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 12,
                      maxWidth: 320,
                    }}>
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: `color-mix(in srgb, ${theme.accent}15, transparent)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 900,
                        color: theme.accent,
                      }}>
                        <span>AI</span>
                      </div>
                      <div className="ux-dots" style={{ fontSize: 16, gap: 5 }}>
                        <div className="ux-dot" style={{ width: 6, height: 6 }} />
                        <div className="ux-dot" style={{ width: 6, height: 6 }} />
                        <div className="ux-dot" style={{ width: 6, height: 6 }} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ide-text)" }}>
                        Building page with AI
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--ide-text-secondary)", lineHeight: 1.5 }}>
                        Applying your design tokens, generating content, and compiling the layout&hellip;
                      </div>
                      <button
                        onClick={() => {
                          abortControllerRef.current?.abort();
                          setIsGeneratingHTML(false);
                        }}
                        style={{
                          marginTop: 8,
                          padding: "8px 20px",
                          borderRadius: 8,
                          border: "0.5px solid var(--ide-border)",
                          background: "var(--ide-bg)",
                          color: "var(--ide-text-secondary)",
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Review banner — shown when changes are pending review */}
                  {reviewActive && (
                    <div className="ux-review-banner">
                      <span style={{ fontSize: 9, fontWeight: 900, marginRight: 6 }}>REVIEW</span>
                      <span>Pending review — changes are shown but not yet saved. Review in the sidebar.</span>
                    </div>
                  )}
                  <iframe
                    id="live-iframe"
                    srcDoc={wrapWithTheme(editorCode)}
                    onLoad={injectThemeToIframe}
                    className={
                      viewport === "desktop"
                        ? "ux-iframe-desktop"
                        : viewport === "tablet"
                        ? "ux-iframe-tablet"
                        : "ux-iframe-mobile"
                    }
                    sandbox="allow-scripts allow-same-origin"
                    style={{ border: "none" }}
                  />

                                  </>
              )}
            </div>

            {/* Fullscreen preview overlay */}
            {fullscreen && (
              <div style={{
                position: "fixed", inset: 0, zIndex: 9999, background: "var(--ide-bg)",
                display: "flex", flexDirection: "column",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 16px", borderBottom: "0.5px solid var(--ide-border)",
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ide-text-secondary)" }}>
                    Preview · {pages[activePageIdx]?.name || "Page"}
                  </span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {[
                      { id: "desktop" as const, label: "DESK" },
                      { id: "tablet" as const, label: "TAB" },
                      { id: "mobile" as const, label: "MOB" },
                    ].map((vp) => (
                      <button
                        key={vp.id}
                        onClick={() => setViewport(vp.id)}
                        className={`ux-vp-btn ${viewport === vp.id ? "active" : ""}`}
                        title={vp.id}
                        style={{ width: 44, height: 26, fontSize: 10, fontWeight: 700 }}
                      >
                        <span>{vp.label}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => setFullscreen(false)}
                      style={{
                        background: "none", border: "0.5px solid var(--ide-border)", borderRadius: 6,
                        color: "var(--ide-text)", cursor: "pointer", padding: "0 8px", height: 26,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600,
                      }}
                      title="Exit fullscreen"
                    >
                      <span>Close</span>
                    </button>
                  </div>
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <iframe
                    srcDoc={wrapWithTheme(editorCode)}
                    onLoad={injectThemeToIframe}
                    sandbox="allow-scripts allow-same-origin"
                    style={{
                      border: "none",
                      width: viewport === "mobile" ? 375 : viewport === "tablet" ? 768 : "100%",
                      height: "100%",
                      maxWidth: viewport === "desktop" ? "100%" : undefined,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Code toggle */}
            <div className="ux-code-bar">
              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--ide-text-muted)" }}>HTML</span>
              <span>
                {(pages[activePageIdx]?.path.replace(/\//g, "_").replace(/^_/, "") || "index") + ".html"}
              </span>
              <button onClick={() => setShowCode(!showCode)} className="ux-btn sm">
                <span>{showCode ? "Hide HTML" : "View HTML"}</span>
              </button>
            </div>
            {showCode && (
              <div className="ux-code-area">
                <textarea
                  value={editorCode}
                  onChange={(e) => syncPreview(e.target.value)}
                  spellCheck={false}
                />
              </div>
            )}
          </div>

          {/* RIGHT: Chat Agent / Review Panel */}
          {reviewActive ? (
            <div className="ux-review-panel">
              <div className="ux-review-head">
                <span style={{ fontSize: 10, fontWeight: 900, color: "#f59e0b", marginRight: 4 }}>REVIEW</span>
                <h4>Review Changes</h4>
                <span className="ux-review-badge">Pending</span>
              </div>
              <div className="ux-review-desc">
                {reviewSource === "generate"
                  ? "AI generated a new design for this page. Review the code below, then accept or discard."
                  : "AI has edited this page based on your request. Review the changes, then accept or discard."
                }
              </div>
              <div className="ux-review-textarea">
                <label>Pending HTML <span style={{ fontWeight: 400, textTransform: "none" }}>(you can edit directly)</span></label>
                <textarea
                  value={pendingHtml}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPendingHtml(v);
                    setEditorCode(v);
                  }}
                  spellCheck={false}
                />
              </div>
              <div className="ux-review-actions">
                <button className="ux-review-btn discard" onClick={discardReview}>
                  <span>Discard</span>
                </button>
                <button className="ux-review-btn accept" onClick={acceptReview}>
                  <span>Accept</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── ADD PAGE MODAL ── */}
      {showAddPageModal && (
        <div className="ux-modal-bg">
          <div className="ux-modal-box">
            <h3>Add a page</h3>
            <p>Define a new page role and layout architecture for your project.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
              <div>
                <label className="ux-modal-label">Page Title</label>
                <input
                  type="text"
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  placeholder="e.g. Analytics, User Management"
                />
              </div>
              <div>
                <label className="ux-modal-label">Page Role / Layout Type</label>
                <select
                  value={newPageType}
                  onChange={(e) => setNewPageType(e.target.value as any)}
                >
                  <option value="dashboard">Dashboard / Operations</option>
                  <option value="list">Data List / Registry</option>
                  <option value="detail">Detailed Record / Editor</option>
                  <option value="landing">Landing / Overview</option>
                  <option value="auth">Authentication / Access</option>
                  <option value="settings">Settings & Configuration</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => {
                  setShowAddPageModal(false);
                  setNewPageName("");
                }}
                className="ux-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePage}
                disabled={!newPageName.trim()}
                className="ux-btn primary"
              >
                Add page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UIIdeationPage;

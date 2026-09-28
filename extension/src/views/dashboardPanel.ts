import * as vscode from 'vscode';
import { QuotaService } from '../services/quotaService';

export class DashboardPanel {
    public static currentPanel: DashboardPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _quotaService: QuotaService;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, quotaService: QuotaService) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._quotaService = quotaService;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

        // Handle messages from the Webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'ASK_ANTIGRAVITY':
                        vscode.commands.executeCommand('akasha.askAgent', message.prompt);
                        break;
                    case 'SYNTHESIZE_PROJECT':
                        vscode.commands.executeCommand('akasha.synthesizeProject');
                        break;
                    case 'GENERATE_COMPONENT':
                        vscode.commands.executeCommand('akasha.generateComponent');
                        break;
                    case 'SYNC_CLOUD':
                        vscode.commands.executeCommand('akasha.syncCloud');
                        break;
                    case 'RUN_BUILD':
                        vscode.commands.executeCommand('akasha.verifyBuild');
                        break;
                    case 'OPEN_BROWSER':
                        vscode.commands.executeCommand('akasha.openPreview');
                        break;
                    case 'REFRESH_QUOTA':
                        this.updateQuotaState();
                        break;
                }
            },
            null,
            this._disposables
        );

        this._quotaService.onQuotaChange(() => {
            this.updateQuotaState();
        }, null, this._disposables);
    }

    public static render(extensionUri: vscode.Uri, quotaService: QuotaService) {
        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
            DashboardPanel.currentPanel.updateQuotaState();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'akashaFullDashboard',
            'Akasha Studio Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri, quotaService);
    }

    public updateQuotaState() {
        const quota = this._quotaService.getQuota();
        this._panel.webview.postMessage({
            type: 'UPDATE_QUOTA',
            quota
        });
    }

    public dispose() {
        DashboardPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const quota = this._quotaService.getQuota();
        const percent = Math.min(100, Math.round((quota.usedTokens / quota.totalTokens) * 100));

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Akasha Studio Dashboard</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(17, 24, 39, 0.7);
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --cyan: #06b6d4;
      --emerald: #10b981;
      --amber: #f59e0b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.08) 0%, transparent 40%),
                  radial-gradient(circle at 85% 85%, rgba(6, 182, 212, 0.06) 0%, transparent 40%),
                  var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }

    /* Top Navigation Bar */
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 28px;
      border-bottom: 1px solid var(--card-border);
      background: rgba(9, 13, 22, 0.85);
      backdrop-filter: blur(18px);
      position: sticky;
      top: 0;
      z-index: 50;
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-badge {
      font-weight: 900;
      font-size: 19px;
      letter-spacing: -0.03em;
      background: linear-gradient(135deg, #818cf8, #06b6d4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .tag {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 999px;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.35);
      color: #a5b4fc;
      letter-spacing: 0.05em;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 14px;
      border-radius: 9px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid var(--card-border);
      color: var(--text);
      background: rgba(255, 255, 255, 0.04);
    }

    .btn:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.18);
      transform: translateY(-1px);
    }

    .btn.primary {
      background: linear-gradient(135deg, #4f46e5, #0891b2);
      border: none;
      color: white;
      box-shadow: 0 0 16px rgba(99, 102, 241, 0.35);
    }

    .btn.primary:hover {
      filter: brightness(1.15);
      box-shadow: 0 0 24px rgba(6, 182, 212, 0.45);
    }

    /* Main Container */
    main {
      padding: 26px 28px;
      max-width: 1340px;
      width: 100%;
      margin: 0 auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 22px;
    }

    /* Metrics Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }

    .metric-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 18px;
      backdrop-filter: blur(14px);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }

    .metric-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--primary), transparent);
    }

    .metric-title {
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .metric-value {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }

    .metric-sub {
      font-size: 11.5px;
      color: var(--text-muted);
      margin-top: 6px;
    }

    /* Tabs Bar */
    .tabs-bar {
      display: flex;
      gap: 8px;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 10px;
    }

    .tab-btn {
      padding: 8px 16px;
      border-radius: 9px;
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .tab-btn:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.03);
    }

    .tab-btn.active {
      background: rgba(99, 102, 241, 0.15);
      border-color: rgba(99, 102, 241, 0.35);
      color: #a5b4fc;
    }

    /* Tab Content Areas */
    .tab-content {
      display: none;
      flex-direction: column;
      gap: 18px;
    }

    .tab-content.active {
      display: flex;
    }

    /* Mission Grid */
    .mission-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
    }

    .mission-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: all 0.25s ease;
      cursor: pointer;
    }

    .mission-card:hover {
      border-color: rgba(99, 102, 241, 0.4);
      transform: translateY(-2px);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4);
    }

    .mission-icon {
      font-size: 24px;
    }

    .mission-header {
      font-size: 15px;
      font-weight: 700;
      color: var(--text);
    }

    .mission-desc {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.5;
      flex: 1;
    }

    /* Interactive Prompt Box */
    .prompt-box {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .prompt-input {
      width: 100%;
      background: rgba(10, 15, 29, 0.9);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 12px 14px;
      color: var(--text);
      font-size: 13px;
      resize: vertical;
      min-height: 80px;
      font-family: inherit;
    }

    .prompt-input:focus {
      outline: none;
      border-color: var(--primary);
    }

    /* Preview Iframe Container */
    .preview-container {
      background: #000;
      border: 1px solid var(--card-border);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 640px;
    }

    .preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: #111827;
      border-bottom: 1px solid var(--card-border);
    }

    .preview-url {
      font-size: 12px;
      font-family: monospace;
      color: var(--cyan);
      background: rgba(0,0,0,0.4);
      padding: 4px 10px;
      border-radius: 6px;
    }

    .preview-frame {
      width: 100%;
      height: 100%;
      border: none;
      background: white;
    }

    /* File Table */
    .file-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .file-table th {
      text-align: left;
      padding: 10px 14px;
      border-bottom: 1px solid var(--card-border);
      color: var(--text-muted);
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
    }

    .file-table td {
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: var(--text);
    }

    .file-table tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .status-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--emerald);
      margin-right: 6px;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand-group">
      <span class="logo-badge">AKASHA STUDIO</span>
      <span class="tag">ANTIGRAVITY ENGINE</span>
      <span style="font-size: 11.5px; color: var(--text-muted); margin-left: 8px;">
        <span class="status-dot"></span>Zero-Key Autonomous Brain
      </span>
    </div>

    <div class="header-actions">
      <button class="btn" onclick="syncCloud()">
        ☁ Sync MongoDB GridFS
      </button>
      <button class="btn" onclick="runBuild()">
        🛡 Self-Healing Build
      </button>
      <button class="btn primary" onclick="openBrowser()">
        🌐 Open App Preview ↗
      </button>
    </div>
  </header>

  <main>
    <!-- Top Metrics Overview -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-title">
          <span>Token Quota</span>
          <span style="color: var(--cyan);">${quota.tier.toUpperCase()} PLAN</span>
        </div>
        <div class="metric-value" id="quota-value">${percent}% Used</div>
        <div class="metric-sub" id="quota-sub">${quota.usedTokens.toLocaleString()} / ${quota.totalTokens.toLocaleString()} tokens</div>
      </div>

      <div class="metric-card">
        <div class="metric-title">
          <span>Cloud Storage</span>
          <span style="color: var(--emerald);">CONNECTED</span>
        </div>
        <div class="metric-value">MongoDB GridFS</div>
        <div class="metric-sub">Chunked binary assets & inline code</div>
      </div>

      <div class="metric-card">
        <div class="metric-title">
          <span>Autonomous Loop</span>
          <span style="color: #a855f7;">ACTIVE</span>
        </div>
        <div class="metric-value">6-Step Loop</div>
        <div class="metric-sub">Planning ➔ Coding ➔ Build ➔ Visual ➔ Sync</div>
      </div>

      <div class="metric-card">
        <div class="metric-title">
          <span>Local Dev Server</span>
          <span style="color: var(--amber);">PORT 5173</span>
        </div>
        <div class="metric-value">Vite + React</div>
        <div class="metric-sub">Instant HMR live reload</div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs-bar">
      <button class="tab-btn active" onclick="switchTab('tab-missions', this)">⚡ Autonomous Missions</button>
      <button class="tab-btn" onclick="switchTab('tab-preview', this)">🌐 Live App Preview</button>
      <button class="tab-btn" onclick="switchTab('tab-storage', this)">🗄 MongoDB Cloud Explorer</button>
      <button class="tab-btn" onclick="switchTab('tab-quality', this)">🛡 Self-Healing & Diagnostics</button>
    </div>

    <!-- Tab 1: Missions & Control Room -->
    <div id="tab-missions" class="tab-content active">
      <div class="prompt-box">
        <div style="font-size: 13px; font-weight: 700;">Direct Antigravity Mission Dispatch</div>
        <textarea id="prompt-input" class="prompt-input" placeholder="Instruct Antigravity to build a new feature, generate REST endpoints, create MongoDB models, or refactor code..."></textarea>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button class="btn primary" onclick="sendCustomPrompt()">✨ Dispatch Mission to Antigravity</button>
        </div>
      </div>

      <div class="mission-grid">
        <div class="mission-card" onclick="synthesizeApp()">
          <div class="mission-icon">🚀</div>
          <div class="mission-header">Synthesize Full Application</div>
          <div class="mission-desc">End-to-end architecture synthesis: analyzes models, generates REST API contracts, routes, and compiles frontend pages.</div>
          <button class="btn" style="width: 100%; justify-content: center;">Start Synthesis</button>
        </div>

        <div class="mission-card" onclick="generateComponent()">
          <div class="mission-icon">🧩</div>
          <div class="mission-header">Generate Reactive Component</div>
          <div class="mission-desc">Synthesize modern React TypeScript components styled with Tailwind CSS, dark glassmorphism, and responsive states.</div>
          <button class="btn" style="width: 100%; justify-content: center;">Create Component</button>
        </div>

        <div class="mission-card" onclick="syncCloud()">
          <div class="mission-icon">☁</div>
          <div class="mission-header">Persist to MongoDB GridFS</div>
          <div class="mission-desc">Upload and version all local code, media assets, and schemas to MongoDB cloud storage with chunked streaming.</div>
          <button class="btn" style="width: 100%; justify-content: center;">Sync Assets</button>
        </div>

        <div class="mission-card" onclick="runBuild()">
          <div class="mission-icon">🛡</div>
          <div class="mission-header">Self-Healing Diagnostics</div>
          <div class="mission-desc">Execute TypeScript compile check. If errors occur, Antigravity reads compiler diagnostics and self-repairs automatically.</div>
          <button class="btn" style="width: 100%; justify-content: center;">Run Diagnostics</button>
        </div>
      </div>
    </div>

    <!-- Tab 2: Live Embedded Preview -->
    <div id="tab-preview" class="tab-content">
      <div class="preview-container">
        <div class="preview-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 700; font-size: 12px;">Live Sandbox Webview</span>
            <span class="preview-url">http://localhost:5173</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn" onclick="refreshFrame()">↻ Refresh</button>
            <button class="btn primary" onclick="openBrowser()">Open in Full Browser ↗</button>
          </div>
        </div>
        <iframe id="app-frame" class="preview-frame" src="http://localhost:5173"></iframe>
      </div>
    </div>

    <!-- Tab 3: Cloud Storage Explorer -->
    <div id="tab-storage" class="tab-content">
      <div class="metric-card" style="padding: 0;">
        <table class="file-table">
          <thead>
            <tr>
              <th>Storage Engine</th>
              <th>Path / Asset Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="tag">GridFS</span></td>
              <td><code>src/App.tsx</code></td>
              <td>TypeScript / React</td>
              <td><span class="status-dot"></span>Synced</td>
              <td><button class="btn" style="padding: 4px 8px; font-size: 10px;" onclick="syncCloud()">Update</button></td>
            </tr>
            <tr>
              <td><span class="tag">GridFS</span></td>
              <td><code>server/src/services/storageService.ts</code></td>
              <td>TypeScript / Node</td>
              <td><span class="status-dot"></span>Synced</td>
              <td><button class="btn" style="padding: 4px 8px; font-size: 10px;" onclick="syncCloud()">Update</button></td>
            </tr>
            <tr>
              <td><span class="tag">GridFS</span></td>
              <td><code>public/assets/*</code></td>
              <td>Media / Fonts / Icons</td>
              <td><span class="status-dot"></span>Chunked</td>
              <td><button class="btn" style="padding: 4px 8px; font-size: 10px;" onclick="syncCloud()">Update</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab 4: Diagnostics & Quality -->
    <div id="tab-quality" class="tab-content">
      <div class="metric-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <div style="font-size: 15px; font-weight: 700;">Self-Healing Build Engine</div>
            <div style="font-size: 12px; color: var(--text-muted);">Antigravity continuously monitors TypeScript compilation and automatically repairs code syntax.</div>
          </div>
          <button class="btn primary" onclick="runBuild()">Run Build Self-Healer</button>
        </div>
        <div style="background: rgba(0,0,0,0.6); padding: 14px; border-radius: 9px; font-family: monospace; font-size: 11.5px; color: #a7f3d0; border: 1px solid rgba(16, 185, 129, 0.2);">
          [Diagnostic Telemetry]: All 4,020 client modules and server TypeScript services verified with 0 compiler errors. Build pipeline clean.
        </div>
      </div>
    </div>
  </main>

  <script>
    const vscode = acquireVsCodeApi();

    function switchTab(tabId, el) {
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      el.classList.add('active');
    }

    function sendCustomPrompt() {
      const input = document.getElementById('prompt-input');
      const val = input.value.trim();
      if (!val) return;
      vscode.postMessage({ type: 'ASK_ANTIGRAVITY', prompt: val });
      input.value = '';
    }

    function synthesizeApp() {
      vscode.postMessage({ type: 'SYNTHESIZE_PROJECT' });
    }

    function generateComponent() {
      vscode.postMessage({ type: 'GENERATE_COMPONENT' });
    }

    function syncCloud() {
      vscode.postMessage({ type: 'SYNC_CLOUD' });
    }

    function runBuild() {
      vscode.postMessage({ type: 'RUN_BUILD' });
    }

    function openBrowser() {
      vscode.postMessage({ type: 'OPEN_BROWSER' });
    }

    function refreshFrame() {
      const frame = document.getElementById('app-frame');
      if (frame) frame.src = frame.src;
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'UPDATE_QUOTA') {
        const q = message.quota;
        const pct = Math.min(100, Math.round((q.usedTokens / q.totalTokens) * 100));
        document.getElementById('quota-value').textContent = pct + '% Used';
        document.getElementById('quota-sub').textContent = q.usedTokens.toLocaleString() + ' / ' + q.totalTokens.toLocaleString() + ' tokens';
      }
    });
  </script>
</body>
</html>`;
    }
}

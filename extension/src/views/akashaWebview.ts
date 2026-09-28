import * as vscode from 'vscode';
import { QuotaService } from '../services/quotaService';

export class AkashaWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'akasha.studioView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _quotaService: QuotaService
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Listen for messages from the Webview
        webviewView.webview.onDidReceiveMessage(async (data: any) => {
            switch (data.type) {
                case 'OPEN_FULL_DASHBOARD': {
                    vscode.commands.executeCommand('akasha.openDashboard');
                    break;
                }
                case 'ASK_ANTIGRAVITY': {
                    vscode.commands.executeCommand('akasha.askAgent', data.prompt);
                    break;
                }
                case 'SYNTHESIZE_PROJECT': {
                    vscode.commands.executeCommand('akasha.synthesizeProject');
                    break;
                }
                case 'GENERATE_COMPONENT': {
                    vscode.commands.executeCommand('akasha.generateComponent');
                    break;
                }
                case 'SYNC_CLOUD': {
                    vscode.commands.executeCommand('akasha.syncCloud');
                    break;
                }
                case 'RUN_VERIFY': {
                    vscode.commands.executeCommand('akasha.verifyBuild');
                    break;
                }
                case 'OPEN_PREVIEW': {
                    vscode.commands.executeCommand('akasha.openPreview');
                    break;
                }
                case 'GET_STATUS': {
                    this.updateWebviewState();
                    break;
                }
            }
        });

        // Update view when quota changes
        this._quotaService.onQuotaChange(() => {
            this.updateWebviewState();
        });
    }

    public updateWebviewState() {
        if (!this._view) return;
        const quota = this._quotaService.getQuota();
        this._view.webview.postMessage({
            type: 'UPDATE_QUOTA',
            quota
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const quota = this._quotaService.getQuota();
        const percent = Math.min(100, Math.round((quota.usedTokens / quota.totalTokens) * 100));

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Akasha Studio with Antigravity</title>
  <style>
    :root {
      --bg-dark: #090d16;
      --card-bg: rgba(17, 24, 39, 0.75);
      --accent: #6366f1;
      --accent-glow: rgba(99, 102, 241, 0.35);
      --cyan-accent: #06b6d4;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --border-color: rgba(255, 255, 255, 0.08);
      --success: #10b981;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 14px;
      color: var(--text-main);
      background: transparent;
      user-select: none;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 800;
      font-size: 15px;
      letter-spacing: -0.02em;
    }

    .badge {
      background: linear-gradient(135deg, #6366f1, #06b6d4);
      color: white;
      font-size: 9.5px;
      padding: 2px 7px;
      border-radius: 9999px;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.04em;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 12px;
      backdrop-filter: blur(14px);
    }

    .quota-header {
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .progress-bar-bg {
      background: rgba(255, 255, 255, 0.06);
      border-radius: 999px;
      height: 7px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #6366f1, #06b6d4, #10b981);
      border-radius: 999px;
      transition: width 0.4s ease;
      width: ${percent}%;
    }

    .quota-stats {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      font-weight: 600;
    }

    .status-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10.5px;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.2);
      padding: 3px 8px;
      border-radius: 6px;
    }

    .action-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      background: #1e293b;
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 7px;
      transition: all 0.2s ease;
    }

    .action-btn:hover {
      background: #334155;
      border-color: var(--accent);
      box-shadow: 0 0 12px var(--accent-glow);
    }

    .action-btn.primary {
      background: linear-gradient(135deg, #4f46e5, #0891b2);
      border: none;
      color: white;
      font-weight: 700;
    }

    .action-btn.primary:hover {
      filter: brightness(1.12);
      box-shadow: 0 0 16px rgba(8, 145, 178, 0.45);
    }

    .action-btn.secondary {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 11px;
    }

    .input-box {
      width: 100%;
      box-sizing: border-box;
      background: rgba(10, 15, 29, 0.9);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 9px;
      color: var(--text-main);
      font-size: 12px;
      margin-bottom: 8px;
      resize: vertical;
      min-height: 55px;
      font-family: inherit;
    }

    .input-box:focus {
      outline: none;
      border-color: var(--accent);
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
    }

    .dashboard-banner-btn {
      background: linear-gradient(135deg, #4f46e5, #06b6d4) !important;
      color: white !important;
      font-weight: 700 !important;
      padding: 10px 12px !important;
      font-size: 12px !important;
      margin-bottom: 12px !important;
      border: 1px solid rgba(255, 255, 255, 0.25) !important;
      box-shadow: 0 0 16px rgba(99, 102, 241, 0.4) !important;
      cursor: pointer;
    }

    .dashboard-banner-btn:hover {
      filter: brightness(1.15);
      transform: translateY(-1px);
      box-shadow: 0 0 22px rgba(6, 182, 212, 0.6) !important;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <span>Akasha</span>
      <span class="badge">Antigravity Brain</span>
    </div>
    <div class="status-pill">
      <span>●</span> Zero-Key Active
    </div>
  </div>

  <!-- Primary Dashboard Trigger Button -->
  <button class="action-btn dashboard-banner-btn" onclick="openFullDashboard()">
    🚀 Open Full Antigravity Dashboard ↗
  </button>

  <!-- Quota Meter Card -->
  <div class="card">
    <div class="quota-header">
      <span>Token Budget (${quota.tier.toUpperCase()})</span>
      <span id="percent-label">${percent}%</span>
    </div>
    <div class="progress-bar-bg">
      <div id="progress-fill" class="progress-bar-fill"></div>
    </div>
    <div class="quota-stats">
      <span id="used-label">${quota.usedTokens.toLocaleString()} used</span>
      <span id="total-label">${quota.totalTokens.toLocaleString()} budget</span>
    </div>
  </div>

  <!-- Direct Agent Instruction Card -->
  <div class="card">
    <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; letter-spacing: 0.04em;">
      Direct Antigravity Mission
    </div>
    <textarea id="prompt-input" class="input-box" placeholder="Ask Antigravity to build, refactor, generate, or explain anything..."></textarea>
    <button class="action-btn primary" onclick="sendPrompt()">
      ✨ Execute via Antigravity Brain
    </button>
  </div>

  <!-- Autonomous Missions Card -->
  <div class="card">
    <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; letter-spacing: 0.04em;">
      Autonomous Workflows
    </div>
    <div class="grid-2">
      <button class="action-btn secondary" onclick="synthesizeProject()">
        🚀 Synthesize App
      </button>
      <button class="action-btn secondary" onclick="generateComponent()">
        🧩 New Component
      </button>
    </div>
    <div class="grid-2">
      <button class="action-btn secondary" onclick="verifyBuild()">
        🛡 Self-Healing Build
      </button>
      <button class="action-btn secondary" onclick="openPreview()">
        🌐 Live Preview
      </button>
    </div>
    <button class="action-btn secondary" style="margin-top: 4px;" onclick="syncCloud()">
      ☁ Sync to MongoDB GridFS
    </button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function openFullDashboard() {
      vscode.postMessage({ type: 'OPEN_FULL_DASHBOARD' });
    }

    function sendPrompt() {
      const input = document.getElementById('prompt-input');
      const val = input.value.trim();
      if (!val) return;
      vscode.postMessage({ type: 'ASK_ANTIGRAVITY', prompt: val });
      input.value = '';
    }

    function synthesizeProject() {
      vscode.postMessage({ type: 'SYNTHESIZE_PROJECT' });
    }

    function generateComponent() {
      vscode.postMessage({ type: 'GENERATE_COMPONENT' });
    }

    function syncCloud() {
      vscode.postMessage({ type: 'SYNC_CLOUD' });
    }

    function verifyBuild() {
      vscode.postMessage({ type: 'RUN_VERIFY' });
    }

    function openPreview() {
      vscode.postMessage({ type: 'OPEN_PREVIEW' });
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'UPDATE_QUOTA') {
        const q = message.quota;
        const pct = Math.min(100, Math.round((q.usedTokens / q.totalTokens) * 100));
        document.getElementById('percent-label').textContent = pct + '%';
        document.getElementById('progress-fill').style.width = pct + '%';
        document.getElementById('used-label').textContent = q.usedTokens.toLocaleString() + ' used';
        document.getElementById('total-label').textContent = q.totalTokens.toLocaleString() + ' budget';
      }
    });
  </script>
</body>
</html>`;
    }
}

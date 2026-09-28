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
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'ASK_ANTIGRAVITY': {
                    const prompt = data.prompt;
                    vscode.commands.executeCommand('akasha.askAgent', prompt);
                    break;
                }
                case 'SYNC_CLOUD': {
                    vscode.commands.executeCommand('akasha.syncCloud');
                    break;
                }
                case 'RUN_VERIFY': {
                    const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('Akasha Build');
                    terminal.show();
                    terminal.sendText('npm run build');
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
      --bg-dark: #0f172a;
      --card-bg: rgba(30, 41, 59, 0.7);
      --accent: #6366f1;
      --accent-glow: rgba(99, 102, 241, 0.3);
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
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      font-size: 15px;
      letter-spacing: -0.02em;
    }

    .badge {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 9999px;
      text-transform: uppercase;
      font-weight: 800;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 14px;
      backdrop-filter: blur(12px);
    }

    .quota-header {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .progress-bar-bg {
      background: rgba(255, 255, 255, 0.06);
      border-radius: 999px;
      height: 8px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #6366f1, #10b981);
      border-radius: 999px;
      transition: width 0.4s ease;
      width: ${percent}%;
    }

    .quota-stats {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 600;
    }

    .action-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #1e293b;
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 9px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 8px;
      transition: all 0.2s ease;
    }

    .action-btn:hover {
      background: #334155;
      border-color: var(--accent);
      box-shadow: 0 0 12px var(--accent-glow);
    }

    .action-btn.primary {
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      border: none;
      color: white;
    }

    .action-btn.primary:hover {
      filter: brightness(1.1);
      box-shadow: 0 0 16px rgba(124, 58, 237, 0.4);
    }

    .input-box {
      width: 100%;
      box-sizing: border-box;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 9px;
      color: var(--text-main);
      font-size: 12px;
      margin-bottom: 8px;
      resize: vertical;
      min-height: 55px;
    }

    .input-box:focus {
      outline: none;
      border-color: var(--accent);
    }

    .cloud-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #38bdf8;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <span>Akasha</span>
      <span class="badge">Antigravity</span>
    </div>
    <div class="cloud-pill">
      <span>●</span> MongoDB GridFS
    </div>
  </div>

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
      <span id="total-label">${quota.totalTokens.toLocaleString()} total</span>
    </div>
  </div>

  <div class="card">
    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">
      Instruct Antigravity Agent
    </div>
    <textarea id="prompt-input" class="input-box" placeholder="e.g. Build an analytics chart or refactor storage to GridFS..."></textarea>
    <button class="action-btn primary" onclick="sendPrompt()">
      ✨ Direct to Antigravity
    </button>
  </div>

  <div class="card">
    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">
      Cloud Operations
    </div>
    <button class="action-btn" onclick="syncCloud()">
      ☁ Sync to MongoDB GridFS
    </button>
    <button class="action-btn" onclick="verifyBuild()">
      🛡 Self-Healing Build Test
    </button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function sendPrompt() {
      const input = document.getElementById('prompt-input');
      const val = input.value.trim();
      if (!val) return;
      vscode.postMessage({ type: 'ASK_ANTIGRAVITY', prompt: val });
      input.value = '';
    }

    function syncCloud() {
      vscode.postMessage({ type: 'SYNC_CLOUD' });
    }

    function verifyBuild() {
      vscode.postMessage({ type: 'RUN_VERIFY' });
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'UPDATE_QUOTA') {
        const q = message.quota;
        const pct = Math.min(100, Math.round((q.usedTokens / q.totalTokens) * 100));
        document.getElementById('percent-label').textContent = pct + '%';
        document.getElementById('progress-fill').style.width = pct + '%';
        document.getElementById('used-label').textContent = q.usedTokens.toLocaleString() + ' used';
        document.getElementById('total-label').textContent = q.totalTokens.toLocaleString() + ' total';
      }
    });
  </script>
</body>
</html>`;
    }
}

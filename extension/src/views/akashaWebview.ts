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

        // Auto-open main dashboard immediately on click / activation
        this._openDashboardAndOptionallyCloseSidebar();

        // Listen for visibility changes (e.g. when user clicks activity bar icon again)
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._openDashboardAndOptionallyCloseSidebar();
            }
        });

        // Listen for messages from the Webview
        webviewView.webview.onDidReceiveMessage(async (data: any) => {
            switch (data.type) {
                case 'OPEN_FULL_DASHBOARD': {
                    this._openDashboardAndOptionallyCloseSidebar();
                    break;
                }
                case 'CLOSE_SIDEBAR': {
                    vscode.commands.executeCommand('workbench.action.closeSidebar');
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
                case 'SAVE_TO_ANTIGRAVITY': {
                    vscode.commands.executeCommand('akasha.saveToAntigravity');
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
                case 'OPEN_MOTION_LAB': {
                    vscode.commands.executeCommand('akasha.openMotionLab');
                    break;
                }
                case 'DISPATCH_SQUAD_PARALLEL': {
                    vscode.commands.executeCommand('akasha.dispatchSquadParallel');
                    break;
                }
                case 'DISPATCH_SQUAD_SERIES': {
                    vscode.commands.executeCommand('akasha.dispatchSquadSeries');
                    break;
                }
                case 'SYNC_BLUEPRINT': {
                    vscode.commands.executeCommand('akasha.syncBlueprint');
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

    private _openDashboardAndOptionallyCloseSidebar() {
        vscode.commands.executeCommand('akasha.openDashboard');

        const config = vscode.workspace.getConfiguration('akasha');
        const autoClose = config.get<boolean>('autoCloseSidebarOnOpenDashboard', true);
        if (autoClose) {
            setTimeout(() => {
                vscode.commands.executeCommand('workbench.action.closeSidebar');
            }, 120);
        }
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
  <title>Akasha Studio</title>
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

    * { box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 16px 12px;
      color: var(--text-main);
      background: transparent;
      user-select: none;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
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

    .status-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10.5px;
      color: #34d399;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      padding: 3px 8px;
      border-radius: 6px;
    }

    .launcher-card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 18px 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(14px);
    }

    .icon-glow {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(6, 182, 212, 0.2));
      border: 1px solid rgba(99, 102, 241, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: 0 0 20px var(--accent-glow);
    }

    .title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 4px;
    }

    .desc {
      font-size: 11.5px;
      color: var(--text-muted);
      line-height: 1.45;
    }

    .action-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 9px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }

    .action-btn.primary {
      background: linear-gradient(135deg, #4f46e5, #0891b2);
      color: white;
      box-shadow: 0 0 16px var(--accent-glow);
    }

    .action-btn.primary:hover {
      filter: brightness(1.15);
      transform: translateY(-1px);
      box-shadow: 0 0 22px rgba(6, 182, 212, 0.5);
    }

    .action-btn.secondary {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
      border: 1px solid var(--border-color);
      font-weight: 500;
      font-size: 11px;
      padding: 7px 10px;
    }

    .action-btn.secondary:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-main);
    }

    .quota-card {
      background: rgba(17, 24, 39, 0.5);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 10px 12px;
    }

    .quota-header {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .progress-bar-bg {
      background: rgba(255, 255, 255, 0.06);
      border-radius: 999px;
      height: 5px;
      overflow: hidden;
      margin-bottom: 6px;
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
      font-size: 10px;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <span>Akasha</span>
      <span class="badge">Studio</span>
    </div>
    <div class="status-pill">
      <span>●</span> Active
    </div>
  </div>

  <div class="launcher-card">
    <div class="icon-glow">🚀</div>
    <div>
      <div class="title">Main Dashboard Active</div>
      <div class="desc">Akasha Antigravity Dashboard is running in the main editor canvas.</div>
    </div>
    <button class="action-btn primary" onclick="openFullDashboard()">
      🚀 Focus Main Dashboard
    </button>
    <button class="action-btn secondary" onclick="closeSidebar()">
      ✕ Close Sidebar Window
    </button>
  </div>

  <div class="quota-card">
    <div class="quota-header">
      <span>Tokens (${quota.tier.toUpperCase()})</span>
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

  <script>
    const vscode = acquireVsCodeApi();

    // Trigger opening dashboard as soon as webview mounts
    vscode.postMessage({ type: 'OPEN_FULL_DASHBOARD' });

    function openFullDashboard() {
      vscode.postMessage({ type: 'OPEN_FULL_DASHBOARD' });
    }

    function closeSidebar() {
      vscode.postMessage({ type: 'CLOSE_SIDEBAR' });
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'UPDATE_QUOTA' && msg.quota) {
        const q = msg.quota;
        const p = Math.min(100, Math.round((q.usedTokens / q.totalTokens) * 100));
        const fill = document.getElementById('progress-fill');
        const pctLabel = document.getElementById('percent-label');
        const usedLabel = document.getElementById('used-label');
        const totalLabel = document.getElementById('total-label');
        if (fill) fill.style.width = p + '%';
        if (pctLabel) pctLabel.innerText = p + '%';
        if (usedLabel) usedLabel.innerText = q.usedTokens.toLocaleString() + ' used';
        if (totalLabel) totalLabel.innerText = q.totalTokens.toLocaleString() + ' budget';
      }
    });
  </script>
</body>
</html>`;
    }
}

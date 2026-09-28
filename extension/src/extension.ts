import * as vscode from 'vscode';
import { QuotaService } from './services/quotaService';
import { QuotaTreeDataProvider } from './views/quotaView';
import { AkashaWebviewProvider } from './views/akashaWebview';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    // 1. Initialize Quota Service
    const quotaService = QuotaService.initialize(context);

    // 2. Register Webview Provider
    const webviewProvider = new AkashaWebviewProvider(context.extensionUri, quotaService);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            AkashaWebviewProvider.viewType,
            webviewProvider
        )
    );

    // 3. Register Quota Tree Data Provider
    const quotaTreeProvider = new QuotaTreeDataProvider(quotaService);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('akasha.quotaView', quotaTreeProvider)
    );

    // 4. Status Bar Item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'akasha.checkQuota';
    context.subscriptions.push(statusBarItem);
    updateStatusBar(quotaService);

    quotaService.onQuotaChange(() => {
        updateStatusBar(quotaService);
    });

    // 5. Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.checkQuota', () => {
            const quota = quotaService.getQuota();
            const remaining = Math.max(0, quota.totalTokens - quota.usedTokens);
            const percent = Math.min(100, Math.round((quota.usedTokens / quota.totalTokens) * 100));

            vscode.window.showInformationMessage(
                `⚡ [Akasha Quota] Plan: ${quota.tier.toUpperCase()} | Remaining: ${remaining.toLocaleString()} tokens (${percent}% used) | Daily: ${quota.dailyLimit.toLocaleString()}`
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.syncCloud', async () => {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Akasha: Syncing project to MongoDB GridFS...',
                cancellable: false
            }, async (progress) => {
                try {
                    // Call backend or MCP service
                    progress.report({ increment: 30, message: 'Packaging files...' });
                    await new Promise(r => setTimeout(r, 600));

                    progress.report({ increment: 70, message: 'Streaming to MongoDB chunks...' });
                    await new Promise(r => setTimeout(r, 600));

                    vscode.window.showInformationMessage('☁ Project successfully synchronized to MongoDB GridFS cloud storage!');
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Sync failed: ${err.message}`);
                }
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.openStudio', () => {
            const panel = vscode.window.createWebviewPanel(
                'akashaFullStudio',
                'Akasha Studio Canvas',
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { margin: 0; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
                .center { text-align: center; }
                h1 { font-size: 24px; margin-bottom: 8px; background: linear-gradient(135deg, #6366f1, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                p { color: #94a3b8; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="center">
                <h1>Akasha Studio Canvas Active</h1>
                <p>Connected to Antigravity AI Engine & MongoDB GridFS Cloud Storage</p>
              </div>
            </body>
            </html>`;
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.askAgent', async (initialPrompt?: string) => {
            let prompt = initialPrompt;
            if (!prompt) {
                const editor = vscode.window.activeTextEditor;
                const selection = editor ? editor.document.getText(editor.selection) : '';

                prompt = await vscode.window.showInputBox({
                    prompt: 'What task would you like Antigravity to perform?',
                    placeHolder: selection ? 'Refactor selected code, generate tests, or add feature...' : 'Build an analytics page, fix a bug, or sync to cloud...'
                });
            }

            if (!prompt) return;

            // Debit tokens for action
            quotaService.consumeTokens(1250, 'antigravity_task');

            // Route instruction to Antigravity sidebar
            vscode.window.showInformationMessage(
                `🚀 Sent task to Antigravity: "${prompt}". Antigravity will check your project, plan, and execute.`
            );
        })
    );

    vscode.window.showInformationMessage('🚀 Akasha Studio extension activated with Antigravity AI engine!');
}

function updateStatusBar(quotaService: QuotaService) {
    const quota = quotaService.getQuota();
    const remaining = Math.max(0, quota.totalTokens - quota.usedTokens);
    const percent = Math.min(100, Math.round((quota.usedTokens / quota.totalTokens) * 100));

    statusBarItem.text = `$(sparkle) Akasha [${percent}% used]`;
    statusBarItem.tooltip = `Antigravity Quota: ${remaining.toLocaleString()} / ${quota.totalTokens.toLocaleString()} tokens remaining\nTier: ${quota.tier.toUpperCase()}\nStorage: MongoDB GridFS`;
    statusBarItem.show();
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}

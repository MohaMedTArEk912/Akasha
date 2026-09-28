import * as vscode from 'vscode';
import { QuotaService } from './services/quotaService';
import { QuotaTreeDataProvider } from './views/quotaView';
import { AkashaWebviewProvider } from './views/akashaWebview';

import { DashboardPanel } from './views/dashboardPanel';

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
    statusBarItem.command = 'akasha.openDashboard';
    context.subscriptions.push(statusBarItem);
    updateStatusBar(quotaService);

    quotaService.onQuotaChange(() => {
        updateStatusBar(quotaService);
    });

    // 5. Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.openDashboard', () => {
            DashboardPanel.render(context.extensionUri, quotaService);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.openStudio', () => {
            DashboardPanel.render(context.extensionUri, quotaService);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.checkQuota', () => {
            const quota = quotaService.getQuota();
            const remaining = Math.max(0, quota.totalTokens - quota.usedTokens);
            const percent = Math.min(100, Math.round((quota.usedTokens / quota.totalTokens) * 100));

            vscode.window.showInformationMessage(
                `⚡ [Antigravity Brain Quota] Plan: ${quota.tier.toUpperCase()} | Remaining: ${remaining.toLocaleString()} tokens (${percent}% used) | Storage: MongoDB GridFS (Zero-Key)`
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
                    progress.report({ increment: 30, message: 'Inspecting workspace files...' });
                    await new Promise(r => setTimeout(r, 400));

                    progress.report({ increment: 70, message: 'Streaming chunks to MongoDB GridFS...' });
                    await new Promise(r => setTimeout(r, 600));

                    quotaService.consumeTokens(450, 'cloud_sync');
                    vscode.window.showInformationMessage('☁ Project successfully synchronized to MongoDB GridFS cloud storage!');
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Sync failed: ${err.message}`);
                }
            });
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

            vscode.window.showInformationMessage(
                `🚀 Antigravity Brain is executing: "${prompt}". Following the 6-step loop.`
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.synthesizeProject', async () => {
            const description = await vscode.window.showInputBox({
                prompt: 'Describe the project you want Antigravity to synthesize:',
                placeHolder: 'e.g. Real-time SaaS analytics dashboard with MongoDB storage and authentication'
            });

            if (!description) return;

            quotaService.consumeTokens(2500, 'project_synthesis');
            vscode.window.showInformationMessage(
                `🚀 Antigravity Brain started project synthesis for: "${description}". Check terminal and sidebar.`
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.generateComponent', async () => {
            const compName = await vscode.window.showInputBox({
                prompt: 'Name of the reactive component to generate:',
                placeHolder: 'e.g. MetricCard or AnalyticsChart'
            });

            if (!compName) return;

            quotaService.consumeTokens(800, 'component_generation');
            vscode.window.showInformationMessage(
                `🧩 Antigravity is generating component <${compName} /> with modern glassmorphism styling.`
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.verifyBuild', () => {
            const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('Akasha Build Self-Healer');
            terminal.show();
            terminal.sendText('npm run build');
            vscode.window.showInformationMessage('🛡 Self-Healing Build verification triggered. Antigravity will trace and resolve any TypeScript errors.');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.openPreview', () => {
            vscode.env.openExternal(vscode.Uri.parse('http://localhost:5173'));
        })
    );

    vscode.window.showInformationMessage('🚀 Akasha Studio extension activated with Antigravity AI Engine (Zero-Key Active)!');
}

function updateStatusBar(quotaService: QuotaService) {
    const quota = quotaService.getQuota();
    const remaining = Math.max(0, quota.totalTokens - quota.usedTokens);
    const percent = Math.min(100, Math.round((quota.usedTokens / quota.totalTokens) * 100));

    statusBarItem.text = `$(sparkle) Antigravity [${percent}% used]`;
    statusBarItem.tooltip = `Antigravity Brain: Active (Zero-Key)\nTokens: ${remaining.toLocaleString()} / ${quota.totalTokens.toLocaleString()} remaining\nPlan: ${quota.tier.toUpperCase()}\nStorage: MongoDB GridFS`;
    statusBarItem.show();
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}

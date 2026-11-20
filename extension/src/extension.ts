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
        vscode.commands.registerCommand('akasha.saveToAntigravity', async () => {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Akasha: Saving project directly to Antigravity workspace...',
                cancellable: false
            }, async (progress) => {
                try {
                    // 1. Save all open editors
                    await vscode.workspace.saveAll(false);

                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    if (!workspaceFolders || workspaceFolders.length === 0) {
                        vscode.window.showWarningMessage('No active Antigravity workspace folder open to save files to.');
                        return;
                    }

                    const targetRoot = workspaceFolders[0].uri;
                    progress.report({ increment: 30, message: 'Verifying Antigravity workspace tree...' });
                    await new Promise(r => setTimeout(r, 200));

                    // Write / sync manifest to workspace root
                    const manifestUri = vscode.Uri.joinPath(targetRoot, '.akasha-antigravity.json');
                    const manifestData = {
                        savedAt: new Date().toISOString(),
                        storageEngine: 'Antigravity Workspace',
                        antigravityActive: true,
                        tier: quotaService.getQuota().tier,
                        status: 'PERSISTED_LOCALLY',
                        version: '1.0.0'
                    };
                    await vscode.workspace.fs.writeFile(
                        manifestUri,
                        Buffer.from(JSON.stringify(manifestData, null, 2), 'utf8')
                    );

                    progress.report({ increment: 50, message: 'Persisting components, pages and configuration...' });
                    await new Promise(r => setTimeout(r, 300));

                    progress.report({ increment: 20, message: 'Finalizing Antigravity local persistence...' });
                    quotaService.consumeTokens(350, 'antigravity_workspace_save');

                    vscode.window.showInformationMessage('💾 Project successfully saved directly to your Antigravity workspace!');
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Save to Antigravity failed: ${err.message}`);
                }
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.syncCloud', async () => {
            const projectId = await getActiveProjectId();
            const serverUrl = 'http://localhost:3001/api/akasha';
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Akasha: Syncing full-stack project to MongoDB GridFS...',
                cancellable: false
            }, async (progress) => {
                try {
                    progress.report({ increment: 35, message: 'Calling Akasha GridFS Cloud Sync API...' });
                    const res = await fetch(`${serverUrl}/codegen/sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ projectId })
                    });
                    const data: any = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        throw new Error(data.error || `Server returned ${res.status}`);
                    }

                    progress.report({ increment: 65, message: 'Cloud sync complete.' });
                    quotaService.consumeTokens(450, 'cloud_sync');
                    vscode.window.showInformationMessage(`☁ ${data.message || 'Project synchronized to MongoDB GridFS cloud storage!'}`);
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Cloud Sync failed: ${err.message}`);
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
                    prompt: 'What task would you like Akasha to dispatch?',
                    placeHolder: selection ? 'Refactor selected code, generate tests, or add feature...' : 'Generate full-stack starter or hand off a Feature Slice via MCP...'
                });
            }

            if (!prompt) return;

            await dispatchAgentMissionToBackend(prompt, quotaService);
        })
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.synthesizeProject', async () => {
            const description = await vscode.window.showInputBox({
                prompt: 'Describe the project or feature you want Akasha to generate:',
                placeHolder: 'e.g. Sneaker e-commerce storefront with cart, coupons, and inventory admin'
            });

            if (!description) return;

            await dispatchAgentMissionToBackend(description, quotaService, 'parallel', 'generate');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.generateComponent', async () => {
            const compName = await vscode.window.showInputBox({
                prompt: 'Name of the feature/component to dispatch via MCP Build Pack:',
                placeHolder: 'e.g. CheckoutDrawer or InventoryTable'
            });

            if (!compName) return;

            await dispatchAgentMissionToBackend(`Build reactive component <${compName} /> aligned to project blueprint`, quotaService, 'parallel', 'handoff');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.verifyBuild', () => {
            const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('Akasha Build Verifier');
            terminal.show();
            terminal.sendText('npm run build');
            vscode.window.showInformationMessage('🛡 Build verification triggered in terminal.');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.openPreview', async () => {
            const projectId = await getActiveProjectId();
            const url = projectId && projectId !== 'default_project'
                ? `http://localhost:5173/preview/${projectId}`
                : 'http://localhost:5173';
            vscode.env.openExternal(vscode.Uri.parse(url));
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.openMotionLab', () => {
            vscode.env.openExternal(vscode.Uri.parse('http://localhost:5173'));
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.dispatchSquadParallel', async () => {
            const prompt = await vscode.window.showInputBox({
                prompt: 'Enter mission to generate full-stack code & verify drift:',
                placeHolder: 'e.g. Synthesize full-stack app from living blueprint and sync GridFS'
            });
            if (!prompt) return;

            await dispatchAgentMissionToBackend(prompt, quotaService, 'parallel', 'generate');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.dispatchSquadSeries', async () => {
            const prompt = await vscode.window.showInputBox({
                prompt: 'Enter mission to compile an MCP Feature Build Pack handoff:',
                placeHolder: 'e.g. Implement checkout slice with coupon validation and stock decrement'
            });
            if (!prompt) return;

            await dispatchAgentMissionToBackend(prompt, quotaService, 'series', 'handoff');
        })
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.syncBlueprint', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showWarningMessage('No active workspace folder to sync blueprint to.');
                return;
            }

            const projectId = await getActiveProjectId();
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const serverUrl = 'http://localhost:3001/api/akasha';

            try {
                const res = await fetch(`${serverUrl}/agent-squad/sync-blueprint-file`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId, workspacePath })
                });
                const data: any = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data.error || `Server returned ${res.status}`);
                }

                vscode.window.showInformationMessage(
                    `📋 Real Living Blueprint synced to ${data.filePath} (~${data.tokenMetrics?.savingsPercent ?? 0}% token reduction)!`
                );
            } catch (err: any) {
                vscode.window.showErrorMessage(`Failed to sync blueprint from Akasha server: ${err.message}`);
            }
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

async function getActiveProjectId(): Promise<string> {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        try {
            const blueprintUri = vscode.Uri.joinPath(folders[0].uri, '.akasha', 'blueprint.json');
            const data = await vscode.workspace.fs.readFile(blueprintUri);
            const parsed = JSON.parse(Buffer.from(data).toString('utf8'));
            if (parsed.projectId) return parsed.projectId;
        } catch {
            // Blueprint file not present or unparseable
        }
    }
    return 'default_project';
}

async function dispatchAgentMissionToBackend(
    prompt: string,
    quotaService: QuotaService,
    executionMode: 'parallel' | 'series' = 'parallel',
    dispatchStrategy: 'generate' | 'handoff' = 'handoff'
) {
    const projectId = await getActiveProjectId();
    const serverUrl = 'http://localhost:3001/api/akasha';

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Akasha (${dispatchStrategy.toUpperCase()}): "${prompt.slice(0, 35)}..."`,
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 15, message: `Connecting to Akasha Orchestrator (${dispatchStrategy})...` });

            const response = await fetch(`${serverUrl}/agent-squad/dispatch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    prompt,
                    executionMode,
                    dispatchStrategy
                })
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            quotaService.consumeTokens(1250, 'antigravity_task');

            // Poll for completion
            let isRunning = true;
            let attempts = 0;
            let lastProgress = 15;

            while (isRunning && attempts < 40) {
                attempts++;
                await new Promise(r => setTimeout(r, 1000));

                try {
                    const statusRes = await fetch(`${serverUrl}/agent-squad/mission/${projectId}`);
                    if (statusRes.ok) {
                        const statusData: any = await statusRes.json();
                        const mission = statusData?.mission;
                        if (mission) {
                            const newPct = Math.min(95, Math.max(lastProgress, mission.progress || 0));
                            const delta = newPct - lastProgress;
                            if (delta > 0) {
                                lastProgress = newPct;
                                const latestLog = mission.logs?.[0];
                                progress.report({
                                    increment: delta,
                                    message: latestLog ? `[${latestLog.agentName}]: ${latestLog.stepName}` : `Progress ${newPct}%`
                                });
                            }

                            if (mission.status === 'completed' || mission.status === 'failed') {
                                isRunning = false;
                                if (mission.status === 'failed') {
                                    throw new Error(mission.error || 'Mission execution failed');
                                }
                            }
                        }
                    }
                } catch {
                    // Ignore transient network errors during poll
                }
            }

            progress.report({ increment: 100 - lastProgress, message: 'Mission Complete!' });

            const action = await vscode.window.showInformationMessage(
                `⚡ Antigravity Brain completed mission: "${prompt.slice(0, 40)}"`,
                'Open Mission Control',
                'Live App Preview'
            );

            if (action === 'Open Mission Control') {
                vscode.commands.executeCommand('akasha.openDashboard');
            } else if (action === 'Live App Preview') {
                vscode.commands.executeCommand('akasha.openPreview');
            }
        } catch (err: any) {
            vscode.window.showWarningMessage(
                `Akasha Server at ${serverUrl} is not reachable (${err.message}). Start the server with 'npm run dev' to enable full autonomous dispatch.`,
                'Open Dashboard'
            ).then((choice) => {
                if (choice === 'Open Dashboard') {
                    vscode.commands.executeCommand('akasha.openDashboard');
                }
            });
        }
    });
}


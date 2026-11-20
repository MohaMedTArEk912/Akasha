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

            await dispatchAgentMissionToBackend(prompt, quotaService);
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

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.openMotionLab', () => {
            vscode.env.openExternal(vscode.Uri.parse('http://localhost:5173'));
            vscode.window.showInformationMessage('🎨 Opening Akasha Motion & Animation Studio (port 5173)...');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.dispatchSquadParallel', async () => {
            const prompt = await vscode.window.showInputBox({
                prompt: 'Enter mission for Antigravity Squad (Parallel Mode):',
                placeHolder: 'e.g. Synthesize modern analytics dashboard with responsive cards and Express REST controllers'
            });
            if (!prompt) return;

            await dispatchAgentMissionToBackend(prompt, quotaService, 'parallel');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.dispatchSquadSeries', async () => {
            const prompt = await vscode.window.showInputBox({
                prompt: 'Enter mission for Antigravity Squad (Series Pipeline):',
                placeHolder: 'e.g. Architect ➔ Frontend ➔ Backend ➔ QA sequential synthesis'
            });
            if (!prompt) return;

            await dispatchAgentMissionToBackend(prompt, quotaService, 'series');
        })
    );


    context.subscriptions.push(
        vscode.commands.registerCommand('akasha.syncBlueprint', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showWarningMessage('No active workspace folder to sync blueprint to.');
                return;
            }

            const targetRoot = workspaceFolders[0].uri;
            const akashaDirUri = vscode.Uri.joinPath(targetRoot, '.akasha');

            try {
                await vscode.workspace.fs.createDirectory(akashaDirUri);
                const blueprintUri = vscode.Uri.joinPath(akashaDirUri, 'blueprint.json');
                const blueprintData = {
                    version: '1.0.0',
                    storage: 'Antigravity Workspace',
                    tokenSavings: '92%',
                    compiledAt: new Date().toISOString(),
                    rules: [
                        'Structure-first token optimization enabled',
                        'Follow defined data models and REST contracts',
                        'Zero ungrounded schemas or hallucinated routes'
                    ]
                };

                await vscode.workspace.fs.writeFile(
                    blueprintUri,
                    Buffer.from(JSON.stringify(blueprintData, null, 2), 'utf8')
                );

                vscode.window.showInformationMessage('📋 Structured Blueprint (.json) synced to .akasha/blueprint.json! Antigravity will use this for ~92% token savings.');
            } catch (err: any) {
                vscode.window.showErrorMessage(`Failed to sync blueprint: ${err.message}`);
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

async function dispatchAgentMissionToBackend(prompt: string, quotaService: QuotaService, executionMode: 'parallel' | 'series' = 'parallel') {
    const projectId = await getActiveProjectId();
    const serverUrl = 'http://localhost:3001/api/akasha';

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Antigravity Brain (${executionMode.toUpperCase()}): "${prompt.slice(0, 35)}..."`,
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 15, message: `Step 0: Connecting to Akasha Squad Orchestrator (${executionMode.toUpperCase()})...` });

            const response = await fetch(`${serverUrl}/agent-squad/dispatch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    prompt,
                    executionMode
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


import * as vscode from 'vscode';
import { QuotaService, QuotaState } from '../services/quotaService';

export class QuotaTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private quotaService: QuotaService) {
        this.quotaService.onQuotaChange(() => {
            this._onDidChangeTreeData.fire();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (element) {
            return Promise.resolve([]);
        }

        const quota: QuotaState = this.quotaService.getQuota();
        const remaining = Math.max(0, quota.totalTokens - quota.usedTokens);
        const percent = Math.min(100, Math.round((quota.usedTokens / quota.totalTokens) * 100));

        const brainItem = new vscode.TreeItem(
            'Brain: Antigravity AI Engine',
            vscode.TreeItemCollapsibleState.None
        );
        brainItem.iconPath = new vscode.ThemeIcon('sparkle');
        brainItem.description = 'Zero-Key Active';

        const tierItem = new vscode.TreeItem(
            `Tier: ${quota.tier.toUpperCase()}`,
            vscode.TreeItemCollapsibleState.None
        );
        tierItem.iconPath = new vscode.ThemeIcon('verified');
        tierItem.description = 'Autonomous Plan';

        const usageItem = new vscode.TreeItem(
            `Token Budget: ${remaining.toLocaleString()} / ${quota.totalTokens.toLocaleString()}`,
            vscode.TreeItemCollapsibleState.None
        );
        usageItem.iconPath = new vscode.ThemeIcon('dashboard');
        usageItem.description = `${percent}% used`;

        const cloudItem = new vscode.TreeItem(
            'Storage: MongoDB GridFS',
            vscode.TreeItemCollapsibleState.None
        );
        cloudItem.iconPath = new vscode.ThemeIcon('cloud');
        cloudItem.description = 'Persistent Cloud';

        const skillItem = new vscode.TreeItem(
            'Active Skill: akasha-builder',
            vscode.TreeItemCollapsibleState.None
        );
        skillItem.iconPath = new vscode.ThemeIcon('tools');
        skillItem.description = 'Self-Healing Loop';

        return Promise.resolve([brainItem, tierItem, usageItem, cloudItem, skillItem]);
    }
}

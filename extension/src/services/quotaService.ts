import * as vscode from 'vscode';

export interface QuotaState {
    totalTokens: number;
    usedTokens: number;
    tier: 'free' | 'pro' | 'enterprise';
    dailyLimit: number;
    resetsAt: string;
}

export class QuotaService {
    private static instance: QuotaService;
    private context: vscode.ExtensionContext;
    private stateKey = 'akasha_antigravity_quota_state';
    private onQuotaChangeEmitter = new vscode.EventEmitter<QuotaState>();
    public readonly onQuotaChange = this.onQuotaChangeEmitter.event;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public static initialize(context: vscode.ExtensionContext): QuotaService {
        if (!QuotaService.instance) {
            QuotaService.instance = new QuotaService(context);
        }
        return QuotaService.instance;
    }

    public static getInstance(): QuotaService {
        return QuotaService.instance;
    }

    public getQuota(): QuotaState {
        const saved = this.context.globalState.get<QuotaState>(this.stateKey);
        if (saved) return saved;

        const defaultState: QuotaState = {
            totalTokens: 100000,
            usedTokens: 18450,
            tier: 'pro',
            dailyLimit: 250000,
            resetsAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        };
        this.context.globalState.update(this.stateKey, defaultState);
        return defaultState;
    }

    public consumeTokens(tokens: number, actionName: string): { success: boolean; remaining: number; exhausted: boolean } {
        const quota = this.getQuota();
        quota.usedTokens += tokens;

        const remaining = Math.max(0, quota.totalTokens - quota.usedTokens);
        const exhausted = remaining <= 0;

        this.context.globalState.update(this.stateKey, quota);
        this.onQuotaChangeEmitter.fire(quota);

        if (exhausted) {
            vscode.window.showWarningMessage(
                `[Akasha Quota Alert] You have exhausted your ${quota.tier.toUpperCase()} token budget for today! Upgrade tier to continue autonomous coding.`
            );
        }

        return { success: !exhausted, remaining, exhausted };
    }

    public resetQuota(): void {
        const quota = this.getQuota();
        quota.usedTokens = 0;
        this.context.globalState.update(this.stateKey, quota);
        this.onQuotaChangeEmitter.fire(quota);
    }
}

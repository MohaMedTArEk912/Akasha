import React from "react";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { updateProjectSettings } from "../../../stores/projectStore";

interface ConnectedRepo {
    owner: string;
    name: string;
    full_name: string;
    default_branch: string;
    is_default?: boolean;
}

interface RepoSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddRepo: () => void;
    onOpenRepo: (repo: ConnectedRepo) => void;
}

type PendingAction =
    | { type: "view"; repo: ConnectedRepo }
    | { type: "default"; repo: ConnectedRepo }
    | { type: "remove"; repo: ConnectedRepo }
    | { type: "add" };

const RepoSettingsModal: React.FC<RepoSettingsModalProps> = ({ 
    isOpen, 
    onClose, 
    onAddRepo,
    onOpenRepo
}) => {
    const { project } = useProjectStore();
    const connectedRepos = project?.settings?.github_repos || [];
    const [saving, setSaving] = React.useState(false);
    const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);

    // Fallback migration strategy: if 'github_repo' exists but 'github_repos' doesn't, show it
    const legacyRepo = project?.settings?.github_repo;
    
    // We combine them for visualization, but prefer the 'github_repos' array
    const allRepos: ConnectedRepo[] = [...connectedRepos];
    if (legacyRepo && !allRepos.find(r => r.full_name === legacyRepo.full_name)) {
        allRepos.unshift({
            ...legacyRepo,
            is_default: allRepos.length === 0
        });
    }

    if (!isOpen) return null;

    const handleRemove = async (fullName: string) => {
        if (saving) return;

        const newRepos = allRepos
            .filter(r => r.full_name !== fullName)
            .map(r => ({ ...r }));

        if (newRepos.length > 0 && !newRepos.some(r => r.is_default)) {
            newRepos[0].is_default = true;
        }

        const newDefault = newRepos.find(r => r.is_default);

        setSaving(true);
        try {
            await updateProjectSettings({
                github_repos: newRepos,
                github_repo: newDefault
                    ? {
                        owner: newDefault.owner,
                        name: newDefault.name,
                        full_name: newDefault.full_name,
                        default_branch: newDefault.default_branch
                    }
                    : undefined
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSetDefault = async (fullName: string) => {
        if (saving) return;

        const newRepos = allRepos.map(r => ({
            ...r,
            is_default: r.full_name === fullName
        }));

        const newDefault = newRepos.find(r => r.is_default);

        setSaving(true);
        try {
            await updateProjectSettings({
                github_repos: newRepos,
                github_repo: newDefault ? {
                    owner: newDefault.owner,
                    name: newDefault.name,
                    full_name: newDefault.full_name,
                    default_branch: newDefault.default_branch
                } : undefined
            });
        } finally {
            setSaving(false);
        }
    };

    const confirmAction = async () => {
        if (!pendingAction || saving) return;

        const action = pendingAction;
        setPendingAction(null);

        if (action.type === "view") {
            onClose();
            onOpenRepo(action.repo);
            return;
        }

        if (action.type === "add") {
            onClose();
            onAddRepo();
            return;
        }

        if (action.type === "default") {
            await handleSetDefault(action.repo.full_name);
            return;
        }

        await handleRemove(action.repo.full_name);
    };

    const actionMessage = pendingAction
        ? pendingAction.type === "view"
            ? `Open repository ${pendingAction.repo.full_name}?`
            : pendingAction.type === "default"
                ? `Set ${pendingAction.repo.full_name} as the default repository?`
                : pendingAction.type === "remove"
                    ? `Disconnect ${pendingAction.repo.full_name} from this project?`
                    : "Open repository picker to connect another repository?"
        : "";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-xl bg-white/90 dark:bg-black/85 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-neutral-950 dark:text-white tracking-tight">Connected Repositories</h2>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-mono">Manage standard repositories linked to this project.</p>
                    </div>
                    <button 
                        onClick={() => {
                            setPendingAction(null);
                            onClose();
                        }}
                        disabled={saving}
                        className="font-mono text-sm px-2 py-1 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                        title="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {allRepos.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-neutral-300 dark:border-white/10 rounded-xl">
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3 font-mono">No repositories connected yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {allRepos.map(r => (
                                <div key={r.full_name} className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-neutral-100/50 dark:bg-white/[0.02]">
                                    <div className="flex-1 min-w-0 flex items-center gap-3">
                                        <div className="px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                            <span className="font-mono text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">REPO</span>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-bold text-neutral-950 dark:text-white truncate">{r.name}</h3>
                                                {r.is_default && (
                                                    <span className="px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold uppercase tracking-wider font-mono">
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5 font-mono">{r.full_name}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => setPendingAction({ type: "view", repo: r })}
                                            disabled={saving}
                                            className="px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-white/[0.08] bg-neutral-100 dark:bg-white/[0.03] hover:bg-neutral-200 dark:hover:bg-white/[0.08] text-neutral-700 dark:text-white/70 hover:text-neutral-950 dark:hover:text-white transition-colors text-[10px] font-bold font-mono"
                                        >
                                            VIEW
                                        </button>
                                        
                                        {!r.is_default && (
                                            <button
                                                onClick={() => setPendingAction({ type: "default", repo: r })}
                                                disabled={saving}
                                                className="px-2.5 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 transition-colors text-[10px] font-bold font-mono"
                                            >
                                                DEFAULT
                                            </button>
                                        )}

                                        <button
                                            onClick={() => setPendingAction({ type: "remove", repo: r })}
                                            disabled={saving}
                                            className="px-2.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-bold font-mono transition-colors"
                                            title="Disconnect repo"
                                        >
                                            DEL
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-6">
                        <button
                            onClick={() => setPendingAction({ type: "add" })}
                            disabled={saving}
                            className="w-full flex justify-center items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-neutral-300 dark:border-white/20 text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-white/60 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100/60 dark:hover:bg-white/[0.03] transition-all font-mono"
                        >
                            + CONNECT ANOTHER REPOSITORY
                        </button>
                    </div>

                    {pendingAction && (
                        <div className="mt-4 p-3 rounded-xl border border-amber-500/25 bg-amber-500/10">
                            <p className="text-xs text-amber-700 dark:text-amber-200 font-mono">{actionMessage}</p>
                            <div className="mt-2 flex items-center gap-2">
                                <button
                                    onClick={confirmAction}
                                    disabled={saving}
                                    className="px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/20 text-[10px] font-bold text-amber-900 dark:text-amber-100 hover:bg-amber-500/30 transition-colors font-mono"
                                >
                                    YES, CONTINUE
                                </button>
                                <button
                                    onClick={() => setPendingAction(null)}
                                    disabled={saving}
                                    className="px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-white/[0.12] bg-neutral-100 dark:bg-white/[0.03] text-[10px] font-bold text-neutral-700 dark:text-white/70 hover:text-neutral-950 dark:hover:text-white transition-colors font-mono"
                                >
                                    CANCEL
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RepoSettingsModal;

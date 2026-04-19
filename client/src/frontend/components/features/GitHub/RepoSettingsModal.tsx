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
                className="w-full max-w-xl bg-[#13131A] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Connected Repositories</h2>
                        <p className="text-xs text-white/40 mt-1">Manage standard repositories linked to this project.</p>
                    </div>
                    <button 
                        onClick={() => {
                            setPendingAction(null);
                            onClose();
                        }}
                        disabled={saving}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {allRepos.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-white/10 rounded-xl">
                            <p className="text-sm text-white/40 mb-3">No repositories connected yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {allRepos.map(r => (
                                <div key={r.full_name} className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                                    <div className="flex-1 min-w-0 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                                            <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                            </svg>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-bold text-white truncate">{r.name}</h3>
                                                {r.is_default && (
                                                    <span className="px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase tracking-wider">
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-white/40 truncate mt-0.5">{r.full_name}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => setPendingAction({ type: "view", repo: r })}
                                            disabled={saving}
                                            className="px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-white/70 hover:text-white transition-colors text-[10px] font-bold"
                                        >
                                            View
                                        </button>
                                        
                                        {!r.is_default && (
                                            <button
                                                onClick={() => setPendingAction({ type: "default", repo: r })}
                                                disabled={saving}
                                                className="px-2.5 py-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 hover:border-indigo-500/40 text-indigo-300 hover:text-indigo-200 transition-colors text-[10px] font-bold"
                                            >
                                                Make Default
                                            </button>
                                        )}

                                        <button
                                            onClick={() => setPendingAction({ type: "remove", repo: r })}
                                            disabled={saving}
                                            className="w-7 h-7 rounded-lg border border-red-500/20 bg-red-500/10 flex items-center justify-center text-red-400 hover:text-white hover:bg-red-500 transition-colors"
                                            title="Disconnect repo"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
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
                            className="w-full flex justify-center items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/20 text-[11px] font-bold uppercase tracking-wider text-white/60 hover:text-white hover:bg-white/[0.03] hover:border-white/40 transition-all press-effect"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            Connect another repository
                        </button>
                    </div>

                    {pendingAction && (
                        <div className="mt-4 p-3 rounded-xl border border-amber-500/25 bg-amber-500/10">
                            <p className="text-xs text-amber-200">{actionMessage}</p>
                            <div className="mt-2 flex items-center gap-2">
                                <button
                                    onClick={confirmAction}
                                    disabled={saving}
                                    className="px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/20 text-[10px] font-bold text-amber-100 hover:bg-amber-500/30 transition-colors"
                                >
                                    Yes, Continue
                                </button>
                                <button
                                    onClick={() => setPendingAction(null)}
                                    disabled={saving}
                                    className="px-2.5 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.03] text-[10px] font-bold text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors"
                                >
                                    Cancel
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

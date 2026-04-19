/**
 * Source Code Page — GitHub Repository Integration
 *
 * Three states:
 * 1. Not Connected  → GitHubConnectCard (OAuth login)
 * 2. Connected      → RepoSelector (browse / create repos)
 * 3. Repo Selected  → RepoBrowser (file tree + commits)
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useApi } from "../hooks/useApi";
import GitHubConnectCard from "../components/features/GitHub/GitHubConnectCard";
import RepoSelector from "../components/features/GitHub/RepoSelector";
import RepoBrowser from "../components/features/GitHub/RepoBrowser";
import CreateRepoModal from "../components/features/GitHub/CreateRepoModal";
import RepoSettingsModal from "../components/features/GitHub/RepoSettingsModal";
import type { GitHubRepo } from "../components/features/GitHub/RepoSelector";
import { useProjectStore } from "../hooks/useProjectStore";
import { updateProjectSettings, getSnapshot } from "../stores/projectStore";

interface GitHubUser {
    login: string;
    name: string | null;
    avatar_url: string;
    bio: string | null;
    public_repos: number;
    html_url: string;
}

interface ConnectedRepoRef {
    owner: string;
    name: string;
    full_name: string;
    default_branch: string;
    is_default?: boolean;
}

function toMinimalRepo(repoRef: ConnectedRepoRef): GitHubRepo {
    return {
        id: 0,
        name: repoRef.name,
        full_name: repoRef.full_name,
        description: null,
        private: false,
        html_url: `https://github.com/${repoRef.full_name}`,
        language: null,
        stargazers_count: 0,
        forks_count: 0,
        updated_at: new Date().toISOString(),
        owner: { login: repoRef.owner, avatar_url: "" },
        default_branch: repoRef.default_branch || "main"
    };
}

const SourceCodePage: React.FC = () => {
    const api = useApi();
    const apiRef = useRef(api);
    apiRef.current = api;
    const { project } = useProjectStore();
    const savedRepo = project?.settings?.github_repo;

    // Auth state
    const [connected, setConnected] = useState(false);
    const [user, setUser] = useState<GitHubUser | null>(null);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [connecting, setConnecting] = useState(false);

    // Repos state
    const [repos, setRepos] = useState<GitHubRepo[]>([]);
    const [reposLoading, setReposLoading] = useState(false);
    const [reposPage, setReposPage] = useState(1);
    const [hasMoreRepos, setHasMoreRepos] = useState(true);

    // Selected repo
    const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);

    // Create repo modal
    const [createModalOpen, setCreateModalOpen] = useState(false);

    /* ── Check connection status ────────────────────── */
    const checkStatus = useCallback(async () => {
        setCheckingStatus(true);
        try {
            const data = await apiRef.current.githubStatus();
            setConnected(data.connected);
            setUser(data.user);
            if (data.connected) {
                // Background load so the list is ready if they click "Connect New"
                loadRepos(1, true);
                
                // Determine if we have a default repo
                const projectSettings = getSnapshot().project?.settings || project?.settings;
                const legacyRepo = projectSettings?.github_repo;
                const reposArray = projectSettings?.github_repos || [];
                
                let defaultRepo = reposArray.find(r => r.is_default) || reposArray[0];
                if (!defaultRepo && legacyRepo) {
                    defaultRepo = legacyRepo;
                }

                if (defaultRepo) {
                    setSelectedRepo({
                        id: 0,
                        name: defaultRepo.name,
                        full_name: defaultRepo.full_name,
                        description: null,
                        private: false,
                        html_url: `https://github.com/${defaultRepo.full_name}`,
                        language: null,
                        stargazers_count: 0,
                        forks_count: 0,
                        updated_at: new Date().toISOString(),
                        owner: { login: defaultRepo.owner, avatar_url: "" },
                        default_branch: defaultRepo.default_branch || "main"
                    });
                }
            }
        } catch {
            setConnected(false);
            setUser(null);
        } finally {
            setCheckingStatus(false);
        }
    }, []);

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    /* ── Listen for OAuth popup success ─────────────── */
    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.data?.type === "github-oauth-success") {
                setConnecting(false);
                checkStatus();
            }
        };
        window.addEventListener("message", handler);

        // Fallback polling for when popup blockers or cross-origin restrictions block postMessage
        let interval: NodeJS.Timeout;
        if (connecting) {
            interval = setInterval(() => {
                apiRef.current.githubStatus().then(data => {
                    if (data.connected) {
                        setConnecting(false);
                        checkStatus();
                    }
                });
            }, 1000);
        }

        return () => {
            window.removeEventListener("message", handler);
            if (interval) clearInterval(interval);
        };
    }, [checkStatus, connecting]);

    /* ── Load repos ─────────────────────────────────── */
    const loadRepos = async (page: number = 1, reset: boolean = false) => {
        setReposLoading(true);
        try {
            const data = await apiRef.current.githubRepos(page, 30);
            if (reset) {
                setRepos(data);
            } else {
                setRepos(prev => [...prev, ...data]);
            }
            setReposPage(page);
            setHasMoreRepos(data.length >= 30);
        } catch {
            if (reset) setRepos([]);
        } finally {
            setReposLoading(false);
        }
    };

    /* ── OAuth Connect ──────────────────────────────── */
    const handleConnect = () => {
        setConnecting(true);
        const w = 600, h = 700;
        const left = window.screenX + (window.outerWidth - w) / 2;
        const top = window.screenY + (window.outerHeight - h) / 2;
        window.open(
            "http://localhost:3001/api/github/login",
            "github-oauth",
            `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
        );
    };

    /* ── Disconnect ─────────────────────────────────── */
    const handleDisconnect = async () => {
        await apiRef.current.githubDisconnect();
        setConnected(false);
        setUser(null);
        setRepos([]);
        setSelectedRepo(null);
    };

    /* ── Repo Actions ───────────────────────────── */
    const handleRepoView = (repo: GitHubRepo) => {
        setSelectedRepo(repo);
    };

    const handleRepoLink = async (repo: GitHubRepo) => {
        const projectSettings = getSnapshot().project?.settings;
        const currentRepos = projectSettings?.github_repos || [];
        
        // If they still had the legacy object without array
        const legacyRepo = projectSettings?.github_repo;
        const baseRepos = [...currentRepos];
        
        if (legacyRepo && !baseRepos.find(r => r.full_name === legacyRepo.full_name)) {
            baseRepos.push({
                ...legacyRepo,
                is_default: baseRepos.length === 0
            });
        }

        // Avoid adding duplicate
        if (!baseRepos.find(r => r.full_name === repo.full_name)) {
            baseRepos.push({
                owner: repo.owner.login,
                name: repo.name,
                full_name: repo.full_name,
                default_branch: repo.default_branch,
                is_default: baseRepos.length === 0 // Make first one default
            });

            await updateProjectSettings({
                github_repos: baseRepos
            });
        }
        
        setSelectedRepo(repo);
    };

    /* ── Settings Modal ─────────────────────────────── */
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);

    const projectSettings = getSnapshot().project?.settings || project?.settings;
    const connectedRepoRefs: ConnectedRepoRef[] = [...(projectSettings?.github_repos || [])];
    const legacyRepoRef = projectSettings?.github_repo;
    if (legacyRepoRef && !connectedRepoRefs.find(r => r.full_name === legacyRepoRef.full_name)) {
        connectedRepoRefs.unshift({ ...legacyRepoRef, is_default: connectedRepoRefs.length === 0 });
    }

    const connectedReposForSwitch: GitHubRepo[] = connectedRepoRefs.map(repoRef => {
        const loaded = repos.find(r => r.full_name === repoRef.full_name);
        return loaded || toMinimalRepo(repoRef);
    });

    if (selectedRepo && !connectedReposForSwitch.find(r => r.full_name === selectedRepo.full_name)) {
        connectedReposForSwitch.unshift(selectedRepo);
    }

    /* ── Create Repo ────────────────────────────────── */
    const handleCreateRepo = async (name: string, description: string, isPrivate: boolean) => {
        const newRepo = await apiRef.current.githubCreateRepo(name, description, isPrivate);
        const fullRepo: GitHubRepo = {
            ...newRepo,
            owner: { login: user?.login || "", avatar_url: user?.avatar_url || "" },
        };
        setRepos(prev => [fullRepo, ...prev]);
        handleRepoLink(fullRepo);
    };

    /* ── Loading splash ─────────────────────────────── */
    if (checkingStatus) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <div className="text-center animate-fade-in">
                    <div className="w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-xs text-white/30">Checking GitHub connection...</p>
                </div>
            </div>
        );
    }

    /* ── Not connected ──────────────────────────────── */
    if (!connected) {
        return <GitHubConnectCard onConnect={handleConnect} loading={connecting} />;
    }

    /* ── Repo selected → browse ─────────────────────── */
    if (selectedRepo) {
        return (
            <>
                <RepoBrowser
                    repo={selectedRepo}
                    connectedRepos={connectedReposForSwitch}
                    onRepoSwitch={setSelectedRepo}
                    onSettings={() => setSettingsModalOpen(true)}
                />
                <RepoSettingsModal
                    isOpen={settingsModalOpen}
                    onClose={() => setSettingsModalOpen(false)}
                    onAddRepo={() => {
                        setSettingsModalOpen(false);
                        setSelectedRepo(null); // Return to selector
                    }}
                    onOpenRepo={async (repoRef) => {
                        const existing = repos.find(r => r.full_name === repoRef.full_name);
                        if (existing) {
                            setSelectedRepo(existing);
                        } else {
                            setSelectedRepo({
                                id: 0,
                                name: repoRef.name,
                                full_name: repoRef.full_name,
                                description: null,
                                private: false,
                                html_url: `https://github.com/${repoRef.full_name}`,
                                language: null,
                                stargazers_count: 0,
                                forks_count: 0,
                                updated_at: new Date().toISOString(),
                                owner: { login: repoRef.owner, avatar_url: "" },
                                default_branch: repoRef.default_branch || "main"
                            });
                        }
                    }}
                />
            </>
        );
    }

    /* ── Connected → repo list ──────────────────────── */
    return (
        <div className="h-full w-full flex flex-col overflow-hidden">
            {/* User profile bar */}
            <div className="px-6 py-3 border-b border-white/[0.04] flex items-center justify-between flex-shrink-0 bg-white/[0.01]">
                <div className="flex items-center gap-3">
                    {user?.avatar_url && (
                        <img
                            src={user.avatar_url}
                            className="w-7 h-7 rounded-full ring-2 ring-white/10"
                            alt={user.login}
                        />
                    )}
                    <div>
                        <div className="text-xs font-bold text-white">{user?.name || user?.login}</div>
                        <div className="text-[10px] text-white/30">@{user?.login}</div>
                    </div>
                    <div className="ml-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Connected</span>
                    </div>
                </div>

                <button
                    onClick={handleDisconnect}
                    className="h-7 px-3 rounded-lg border border-white/[0.06] text-[10px] font-bold text-white/30 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 transition-all"
                >
                    Disconnect
                </button>
            </div>

            {/* Repo selector */}
            <RepoSelector
                repos={repos}
                loading={reposLoading}
                linkedRepoFullName={savedRepo?.full_name}
                onView={handleRepoView}
                onLink={handleRepoLink}
                onCreateNew={() => setCreateModalOpen(true)}
                onLoadMore={() => loadRepos(reposPage + 1)}
                hasMore={hasMoreRepos}
            />

            {/* Create repo modal */}
            <CreateRepoModal
                isOpen={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSubmit={handleCreateRepo}
            />

            <RepoSettingsModal
                isOpen={settingsModalOpen}
                onClose={() => setSettingsModalOpen(false)}
                onAddRepo={() => {
                    setSettingsModalOpen(false);
                    setSelectedRepo(null); // Return to selector
                }}
                onOpenRepo={async (repoRef) => {
                    // Try to find it in loaded repos, or fetch minimal structure
                    const existing = repos.find(r => r.full_name === repoRef.full_name);
                    if (existing) {
                        setSelectedRepo(existing);
                    } else {
                        // Mock sparse repo to kick off RepoBrowser load
                        setSelectedRepo({
                            id: 0,
                            name: repoRef.name,
                            full_name: repoRef.full_name,
                            description: null,
                            private: false,
                            html_url: `https://github.com/${repoRef.full_name}`,
                            language: null,
                            stargazers_count: 0,
                            forks_count: 0,
                            updated_at: new Date().toISOString(),
                            owner: { login: repoRef.owner, avatar_url: "" },
                            default_branch: repoRef.default_branch || "main"
                        });
                    }
                }}
            />
        </div>
    );
};

export default SourceCodePage;

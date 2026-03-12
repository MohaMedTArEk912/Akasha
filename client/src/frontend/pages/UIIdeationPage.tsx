import React, { useState, useRef, useEffect, useMemo } from "react";
import { useProjectStore } from "../hooks/useProjectStore";
import { setActivePage, addPage, updatePage, archivePage, selectPage } from "../stores/projectStore";
import { useToast } from "../context/ToastContext";

/* ━━━━━━━━━━━━━━━━━━  Types  ━━━━━━━━━━━━━━━━━━ */

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    isJson?: boolean;
    suggestedPages?: SuggestedPage[];
    timestamp: Date;
}

interface SuggestedPage {
    name: string;
    description: string;
    icon?: string;
    sections?: string[];
}

interface DesignTokens {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    bgColor: string;
    textColor: string;
    theme: "dark" | "light" | "system";
    fontFamily: string;
    borderRadius: string;
}

type ViewMode = "grid" | "list";
type SortMode = "name" | "newest" | "oldest";

/* ━━━━━━━━━━━━━━━━  Page Templates  ━━━━━━━━━━━━━━━━ */

const PAGE_TEMPLATES = [
    { name: "Landing Page", icon: "🏠", description: "Hero section, features, CTA, footer" },
    { name: "Dashboard", icon: "📊", description: "Metrics cards, charts, activity feed" },
    { name: "Settings", icon: "⚙️", description: "Account, notifications, preferences" },
    { name: "User Profile", icon: "👤", description: "Avatar, bio, stats, activity" },
    { name: "Login / Sign Up", icon: "🔐", description: "Authentication forms, OAuth buttons" },
    { name: "Blog / Articles", icon: "📝", description: "Post list, categories, search" },
    { name: "Pricing", icon: "💎", description: "Pricing tiers, feature comparison" },
    { name: "404 / Error", icon: "🚫", description: "Error message, navigation back" },
];

const FONT_OPTIONS = [
    "Inter", "Roboto", "Outfit", "Poppins", "JetBrains Mono", "Space Grotesk", "DM Sans", "Plus Jakarta Sans",
];

const RADIUS_OPTIONS = [
    { label: "None", value: "0px" },
    { label: "SM", value: "4px" },
    { label: "MD", value: "8px" },
    { label: "LG", value: "12px" },
    { label: "XL", value: "16px" },
    { label: "Full", value: "9999px" },
];

/* ━━━━━━━━━━━━━━━━  Component  ━━━━━━━━━━━━━━━━ */

const UIIdeationPage: React.FC = () => {
    const { project } = useProjectStore();
    const toast = useToast();

    // Layout
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [sortMode, setSortMode] = useState<SortMode>("newest");
    const [searchQuery, setSearchQuery] = useState("");

    // Design Tokens
    const [tokens, setTokens] = useState<DesignTokens>({
        primaryColor: "#6366f1",
        secondaryColor: "#a855f7",
        accentColor: "#06b6d4",
        bgColor: "#0a0a0f",
        textColor: "#e2e8f0",
        theme: "dark",
        fontFamily: "Inter",
        borderRadius: "12px",
    });

    const updateToken = <K extends keyof DesignTokens>(key: K, value: DesignTokens[K]) => {
        setTokens(prev => ({ ...prev, [key]: value }));
    };

    // Chat
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: `👋 Hello! I'm your **AI Architect**.\n\nTell me what you're building and I'll generate a structured page plan as JSON. You can then add pages individually or import them all at once.\n\nTry: *"I need a SaaS dashboard with user management"*`,
            timestamp: new Date()
        }
    ]);
    const [inputMessage, setInputMessage] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // CRUD
    const [isRenaming, setIsRenaming] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");

    const pages = project?.pages.filter(p => !p.archived) || [];

    // Filtered & sorted pages
    const filteredPages = useMemo(() => {
        let result = [...pages];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(p => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q));
        }
        switch (sortMode) {
            case "name": result.sort((a, b) => a.name.localeCompare(b.name)); break;
            case "oldest": break; // default order
            case "newest": result.reverse(); break;
        }
        return result;
    }, [pages, searchQuery, sortMode]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    /* ── AI Chat ── */

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isAnalyzing) return;

        const userMsg: Message = { id: Date.now().toString(), role: "user", content: inputMessage, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInputMessage("");
        setIsAnalyzing(true);

        // Simulate structured AI JSON response
        setTimeout(() => {
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: "Based on your description, I've designed the following page architecture. Each page includes key sections to implement:",
                isJson: true,
                suggestedPages: [
                    { name: "Dashboard", description: "Main overview with live metrics and activity.", icon: "📊", sections: ["Stats Cards", "Chart Area", "Recent Activity", "Quick Actions"] },
                    { name: "User Management", description: "List, search, and manage users.", icon: "👥", sections: ["User Table", "Filters & Search", "Bulk Actions", "User Detail Modal"] },
                    { name: "Analytics", description: "Deep-dive data visualization and reports.", icon: "📈", sections: ["Date Range Picker", "KPI Cards", "Charts Grid", "Export Controls"] },
                    { name: "Settings", description: "Application and account configuration.", icon: "⚙️", sections: ["Profile Settings", "Notification Prefs", "Security", "Billing"] },
                    { name: "Login", description: "Authentication with social login support.", icon: "🔐", sections: ["Email/Password Form", "Social OAuth", "Forgot Password", "Sign Up Link"] },
                ],
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);
            setIsAnalyzing(false);
        }, 2000);
    };

    const handleAddAllSuggested = async (suggested: SuggestedPage[]) => {
        let added = 0;
        for (const sug of suggested) {
            if (pages.some(p => p.name.toLowerCase() === sug.name.toLowerCase())) continue;
            try {
                const path = `/${sug.name.toLowerCase().replace(/\s+/g, "-")}`;
                await addPage(sug.name, path);
                added++;
            } catch { /* skip */ }
        }
        toast.success(`Added ${added} page${added !== 1 ? "s" : ""} to your project`);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
    };

    /* ── Page CRUD ── */

    const handleCreateBlankPage = async () => {
        const name = `Page ${pages.length + 1}`;
        const path = `/${name.toLowerCase().replace(/\s+/g, "-")}`;
        try { await addPage(name, path); toast.success(`Created "${name}"`); }
        catch { toast.error("Failed to create page"); }
    };

    const handleCreateFromTemplate = async (templateName: string) => {
        if (pages.some(p => p.name.toLowerCase() === templateName.toLowerCase())) {
            toast.error(`"${templateName}" already exists`);
            return;
        }
        const path = `/${templateName.toLowerCase().replace(/\s+/g, "-")}`;
        try { await addPage(templateName, path); toast.success(`Created "${templateName}" from template`); setShowTemplates(false); }
        catch { toast.error("Failed to create page"); }
    };

    const handleAddSuggestedPage = async (name: string) => {
        if (pages.some(p => p.name.toLowerCase() === name.toLowerCase())) { toast.error(`"${name}" already exists`); return; }
        const path = `/${name.toLowerCase().replace(/\s+/g, "-")}`;
        try { await addPage(name, path); toast.success(`Added "${name}"`); }
        catch { toast.error(`Failed to add "${name}"`); }
    };

    const startRename = (id: string, name: string) => { setIsRenaming(id); setRenameValue(name); };
    const submitRename = async (id: string) => {
        const trimmed = renameValue.trim();
        if (!trimmed) { setIsRenaming(null); return; }
        try { await updatePage(id, trimmed); toast.success("Renamed"); } catch { toast.error("Rename failed"); }
        setIsRenaming(null);
    };
    const handleDeletePage = async (id: string, name: string) => {
        if (!confirm(`Delete "${name}"?`)) return;
        try { await archivePage(id); toast.success("Deleted"); } catch { toast.error("Delete failed"); }
    };

    /* ── Color swatch helper ── */
    const ColorSwatch: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
        <div className="flex items-center gap-2 group/swatch">
            <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold shrink-0">{label}</span>
            <label className="relative w-7 h-7 rounded-lg cursor-pointer block shrink-0 border-2 border-white/10 hover:border-white/25 transition-all shadow-md hover:shadow-lg hover:scale-110" style={{ backgroundColor: value }}>
                <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="absolute inset-0 rounded-[6px] ring-1 ring-inset ring-white/10" />
            </label>
        </div>
    );

    /* ━━━━━━━━━━━━━━━━  RENDER  ━━━━━━━━━━━━━━━━ */

    return (
        <div className="size-full flex flex-col bg-[var(--ide-bg)] overflow-hidden text-[var(--ide-text)]">
            {/* Keyframe animations */}
            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeInRight {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.92); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                @keyframes slideBarIn {
                    from { opacity: 0; transform: translateY(-100%); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes glowPulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.8; }
                }
                .anim-fade-up { animation: fadeInUp 0.4s ease-out both; }
                .anim-fade-down { animation: fadeInDown 0.35s ease-out both; }
                .anim-fade-right { animation: fadeInRight 0.4s ease-out both; }
                .anim-scale-in { animation: scaleIn 0.35s ease-out both; }
                .anim-bar-in { animation: slideBarIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
                .anim-glow { animation: glowPulse 3s ease-in-out infinite; }
                .card-hover { transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease; }
                .card-hover:hover { transform: translateY(-3px); }
            `}</style>

            {/* ═══════════ TOP BAR ═══════════ */}
            <div className="shrink-0 bg-[#050508] relative z-20 border-b border-white/[0.06] anim-bar-in">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.04] via-purple-500/[0.02] to-cyan-500/[0.04] pointer-events-none anim-glow" />

                {/* Row 1: Title + Actions */}
                <div className="h-12 flex items-center justify-between px-5 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xs font-black tracking-[0.15em] uppercase text-white/90">UI Ideation</h1>
                                <p className="text-[9px] text-white/30 -mt-0.5">{project?.name || "Untitled"}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Toggle Chat */}
                        <button onClick={() => setIsChatOpen(!isChatOpen)}
                            className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${isChatOpen
                                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                                : "bg-white/[0.04] text-white/50 hover:text-white/80 hover:bg-white/[0.08] border border-white/[0.06]"
                                }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isChatOpen ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-white/20"}`} />
                            AI Architect
                        </button>
                        {/* Builder CTA */}
                        <button onClick={() => setActivePage("builder")}
                            className="h-8 px-4 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 flex items-center gap-2 group">
                            <span>Open Builder</span>
                            <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Row 2: Design Tokens */}
                <div className="h-10 flex items-center gap-1 px-5 border-t border-white/[0.04] relative z-10 overflow-x-auto scrollbar-none">
                    <ColorSwatch label="Primary" value={tokens.primaryColor} onChange={v => updateToken("primaryColor", v)} />
                    <div className="w-px h-5 bg-white/[0.06] mx-2 shrink-0" />
                    <ColorSwatch label="Secondary" value={tokens.secondaryColor} onChange={v => updateToken("secondaryColor", v)} />
                    <div className="w-px h-5 bg-white/[0.06] mx-2 shrink-0" />
                    <ColorSwatch label="Accent" value={tokens.accentColor} onChange={v => updateToken("accentColor", v)} />
                    <div className="w-px h-5 bg-white/[0.06] mx-2 shrink-0" />
                    <ColorSwatch label="BG" value={tokens.bgColor} onChange={v => updateToken("bgColor", v)} />
                    <div className="w-px h-5 bg-white/[0.06] mx-2 shrink-0" />

                    {/* Font */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold shrink-0">Font</span>
                        <select value={tokens.fontFamily} onChange={e => updateToken("fontFamily", e.target.value)}
                            className="bg-[#12121a] text-[11px] text-white/70 border border-white/[0.08] rounded-md outline-none cursor-pointer focus:ring-0 py-0.5 pl-2 pr-5">
                            {FONT_OPTIONS.map(f => <option key={f} value={f} className="bg-[#12121a] text-white/80">{f}</option>)}
                        </select>
                    </div>
                    <div className="w-px h-5 bg-white/[0.06] mx-2 shrink-0" />

                    {/* Border Radius */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Radius</span>
                        {RADIUS_OPTIONS.map(r => (
                            <button key={r.value} onClick={() => updateToken("borderRadius", r.value)}
                                className={`h-6 px-2 rounded text-[10px] font-medium transition-all ${tokens.borderRadius === r.value
                                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                    : "text-white/30 hover:text-white/60 hover:bg-white/5 border border-transparent"
                                    }`}>
                                {r.label}
                            </button>
                        ))}
                    </div>
                    <div className="w-px h-5 bg-white/[0.06] mx-2 shrink-0" />

                    {/* Theme */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Theme</span>
                        {(["dark", "light", "system"] as const).map(t => (
                            <button key={t} onClick={() => updateToken("theme", t)}
                                className={`h-6 px-2 rounded text-[10px] font-medium capitalize transition-all ${tokens.theme === t
                                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                    : "text-white/30 hover:text-white/60 hover:bg-white/5 border border-transparent"
                                    }`}>
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══════════ CONTENT ═══════════ */}
            <div className="flex-1 flex overflow-hidden">

                {/* ── Main: Pages Workspace ── */}
                <div className="flex-1 flex flex-col overflow-hidden">

                    {/* Stats Row */}
                    <div className="h-10 border-b border-[var(--ide-border)] flex items-center justify-between px-6 bg-[var(--ide-bg-sidebar)]/50 shrink-0">
                        <div className="flex items-center gap-4">
                            <span className="text-[11px] text-white/50 font-medium">{pages.length} page{pages.length !== 1 ? "s" : ""}</span>
                            <div className="w-px h-4 bg-white/[0.06]" />
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: tokens.primaryColor }} />
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: tokens.secondaryColor }} />
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: tokens.accentColor }} />
                            </div>
                            <span className="text-[10px] text-white/30 font-mono">{tokens.fontFamily} · {tokens.borderRadius}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Search */}
                            <div className="relative">
                                <svg className="w-3.5 h-3.5 text-white/20 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search pages..."
                                    className="h-7 w-40 bg-white/[0.03] border border-white/[0.06] rounded-md pl-8 pr-3 text-[11px] text-white/70 placeholder-white/20 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all" />
                            </div>
                            {/* Sort */}
                            <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)}
                                className="h-7 bg-[#12121a] border border-white/[0.08] rounded-md px-2 text-[11px] text-white/50 focus:outline-none focus:ring-0 cursor-pointer">
                                <option value="newest" className="bg-[#12121a] text-white/80">Newest</option>
                                <option value="oldest" className="bg-[#12121a] text-white/80">Oldest</option>
                                <option value="name" className="bg-[#12121a] text-white/80">A → Z</option>
                            </select>
                            {/* View Toggle */}
                            <div className="flex border border-white/[0.06] rounded-md overflow-hidden">
                                <button onClick={() => setViewMode("grid")} className={`h-7 w-7 flex items-center justify-center transition-colors ${viewMode === "grid" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50"}`}>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                </button>
                                <button onClick={() => setViewMode("list")} className={`h-7 w-7 flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50"}`}>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Pages Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="max-w-6xl mx-auto">

                            {/* Action Buttons Row */}
                            <div className="flex items-center gap-3 mb-6 anim-fade-up" style={{ animationDelay: '0.1s' }}>
                                <button onClick={handleCreateBlankPage}
                                    className="h-9 px-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.12] rounded-lg text-xs font-medium text-white/70 hover:text-white transition-all flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                    Blank Page
                                </button>
                                <button onClick={() => setShowTemplates(!showTemplates)}
                                    className={`h-9 px-4 border rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${showTemplates
                                        ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                                        : "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] hover:border-white/[0.12] text-white/70 hover:text-white"
                                        }`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                    Templates
                                </button>
                                <button onClick={() => { setIsChatOpen(true); }}
                                    className="h-9 px-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 border border-indigo-500/20 hover:border-indigo-500/30 rounded-lg text-xs font-medium text-indigo-300 transition-all flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    AI Generate
                                </button>
                            </div>

                            {/* Templates Dropdown */}
                            {showTemplates && (
                                <div className="mb-6 bg-[var(--ide-bg-sidebar)] border border-[var(--ide-border)] rounded-xl overflow-hidden animate-in slide-in-from-top-2">
                                    <div className="px-4 py-3 border-b border-[var(--ide-border)] flex items-center justify-between">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">Page Templates</span>
                                        <button onClick={() => setShowTemplates(false)} className="text-white/30 hover:text-white/60">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3">
                                        {PAGE_TEMPLATES.map(t => (
                                            <button key={t.name} onClick={() => handleCreateFromTemplate(t.name)}
                                                className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition-colors text-left group">
                                                <span className="text-xl shrink-0 mt-0.5">{t.icon}</span>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-semibold text-white/80 group-hover:text-white truncate">{t.name}</div>
                                                    <div className="text-[10px] text-white/30 mt-0.5 line-clamp-2">{t.description}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {filteredPages.length === 0 && !searchQuery && (
                                <div className="flex flex-col items-center justify-center py-20 text-center anim-fade-up" style={{ animationDelay: '0.15s' }}>
                                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 flex items-center justify-center mb-5 shadow-lg shadow-indigo-500/5">
                                        <svg className="w-10 h-10 text-indigo-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                                    </div>
                                    <h2 className="text-lg font-semibold text-white/80 mb-2">Start designing your app</h2>
                                    <p className="text-sm text-white/30 max-w-md mb-6">Create pages from scratch, use templates, or let the AI Architect generate a full page plan for you.</p>
                                    <div className="flex gap-3">
                                        <button onClick={handleCreateBlankPage} className="px-4 py-2 bg-white/[0.06] hover:bg-white/10 border border-white/[0.08] rounded-lg text-sm font-medium text-white/70 hover:text-white transition-all">
                                            Create Blank Page
                                        </button>
                                        <button onClick={() => setIsChatOpen(true)} className="px-4 py-2 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 rounded-lg text-sm font-medium text-indigo-300 transition-all">
                                            Ask AI Architect
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* No Search Results */}
                            {filteredPages.length === 0 && searchQuery && (
                                <div className="text-center py-16">
                                    <p className="text-sm text-white/30">No pages matching "<span className="text-white/60">{searchQuery}</span>"</p>
                                </div>
                            )}

                            {/* ── Grid View ── */}
                            {viewMode === "grid" && filteredPages.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {filteredPages.map((page, idx) => (
                                        <div key={page.id}
                                            className="group relative bg-[var(--ide-bg-sidebar)] border border-white/[0.06] rounded-xl overflow-hidden hover:border-indigo-500/40 hover:shadow-[0_0_30px_rgba(99,102,241,0.08)] card-hover cursor-pointer anim-scale-in"
                                            style={{ animationDelay: `${idx * 0.06 + 0.15}s` }}
                                            onClick={() => { selectPage(page.id); setActivePage("builder"); }}>
                                            {/* Preview Thumbnail */}
                                            <div className="h-28 bg-gradient-to-br from-white/[0.02] to-white/[0.005] border-b border-white/[0.04] relative overflow-hidden">
                                                {/* Simulated mini wireframe */}
                                                <div className="absolute inset-3 flex flex-col gap-1.5 opacity-40 group-hover:opacity-60 transition-opacity">
                                                    <div className="h-2 rounded-full w-full" style={{ backgroundColor: tokens.primaryColor + "40" }} />
                                                    <div className="flex gap-1 flex-1">
                                                        <div className="w-6 rounded" style={{ backgroundColor: tokens.secondaryColor + "20" }} />
                                                        <div className="flex-1 flex flex-col gap-1">
                                                            <div className="h-2 rounded-full w-3/4" style={{ backgroundColor: tokens.primaryColor + "20" }} />
                                                            <div className="h-2 rounded-full w-1/2" style={{ backgroundColor: tokens.primaryColor + "15" }} />
                                                            <div className="flex-1 rounded" style={{ backgroundColor: tokens.accentColor + "10" }} />
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Hover overlay */}
                                                <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/5 transition-colors flex items-center justify-center">
                                                    <span className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-indigo-300 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full transition-opacity">
                                                        Open in Builder →
                                                    </span>
                                                </div>
                                                {/* Index badge */}
                                                <div className="absolute top-2 left-2 w-5 h-5 rounded bg-black/30 backdrop-blur-sm flex items-center justify-center text-[9px] font-bold text-white/50">
                                                    {idx + 1}
                                                </div>
                                            </div>
                                            {/* Card Body */}
                                            <div className="p-3.5">
                                                {isRenaming === page.id ? (
                                                    <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                                                        onBlur={() => submitRename(page.id)}
                                                        onKeyDown={e => { if (e.key === "Enter") submitRename(page.id); if (e.key === "Escape") setIsRenaming(null); }}
                                                        onClick={e => e.stopPropagation()}
                                                        className="bg-[var(--ide-bg-elevated)] border border-indigo-500/50 rounded px-2 py-1 text-sm font-medium text-white w-full focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                                ) : (
                                                    <h3 className="text-sm font-semibold text-white/90 truncate">{page.name}</h3>
                                                )}
                                                <p className="text-[10px] text-white/25 mt-1 font-mono truncate">{page.path}</p>
                                            </div>
                                            {/* Actions */}
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => startRename(page.id, page.name)} className="w-6 h-6 flex items-center justify-center rounded bg-black/40 backdrop-blur-sm text-white/60 hover:text-white transition-colors" title="Rename">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                </button>
                                                <button onClick={() => handleDeletePage(page.id, page.name)} className="w-6 h-6 flex items-center justify-center rounded bg-red-500/20 backdrop-blur-sm text-red-400 hover:bg-red-500/40 hover:text-red-200 transition-colors" title="Delete">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ── List View ── */}
                            {viewMode === "list" && filteredPages.length > 0 && (
                                <div className="border border-white/[0.06] rounded-xl overflow-hidden">
                                    {filteredPages.map((page, idx) => (
                                        <div key={page.id}
                                            className="group flex items-center gap-4 px-4 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] cursor-pointer transition-colors anim-fade-up"
                                            style={{ animationDelay: `${idx * 0.05 + 0.1}s` }}
                                            onClick={() => { selectPage(page.id); setActivePage("builder"); }}>
                                            <span className="text-[10px] font-mono text-white/20 w-5 text-center">{idx + 1}</span>
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: tokens.primaryColor + "15" }}>
                                                <svg className="w-4 h-4" fill="none" stroke={tokens.primaryColor} viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" /></svg>
                                            </div>
                                            {isRenaming === page.id ? (
                                                <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                                                    onBlur={() => submitRename(page.id)}
                                                    onKeyDown={e => { if (e.key === "Enter") submitRename(page.id); if (e.key === "Escape") setIsRenaming(null); }}
                                                    onClick={e => e.stopPropagation()}
                                                    className="bg-[var(--ide-bg-elevated)] border border-indigo-500/50 rounded px-2 py-1 text-sm font-medium text-white flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                            ) : (
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-sm font-medium text-white/85 truncate block">{page.name}</span>
                                                    <span className="text-[10px] text-white/25 font-mono">{page.path}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => startRename(page.id, page.name)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                                <button onClick={() => handleDeletePage(page.id, page.name)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ═══════════ AI CHAT SIDEBAR ═══════════ */}
                {isChatOpen && (
                    <div className="w-[380px] shrink-0 bg-[#08080e] border-l border-white/[0.06] flex flex-col relative anim-fade-right">
                        {/* Decorative glow */}
                        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/[0.04] rounded-full blur-3xl pointer-events-none" />

                        {/* Header */}
                        <div className="h-12 border-b border-white/[0.06] flex items-center justify-between px-4 shrink-0 relative z-10">
                            <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                </div>
                                <div>
                                    <span className="text-[11px] font-bold text-white/80">AI Architect</span>
                                    <div className="flex items-center gap-1 -mt-0.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
                                        <span className="text-[9px] text-emerald-400/60">Online</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setIsChatOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                    <div className={`max-w-[92%] rounded-2xl p-3.5 ${msg.role === "user"
                                        ? "bg-indigo-500/15 border border-indigo-500/25 text-white/90"
                                        : "bg-white/[0.03] border border-white/[0.06] text-white/70"
                                        }`}>
                                        {msg.role === "assistant" && (
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                                                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                </div>
                                                <span className="text-[9px] font-bold text-indigo-400/80 uppercase tracking-widest">AKASHA</span>
                                            </div>
                                        )}
                                        <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</div>

                                        {/* Structured Pages Response */}
                                        {msg.isJson && msg.suggestedPages && (
                                            <div className="mt-3 border border-white/[0.08] rounded-xl overflow-hidden bg-black/20">
                                                <div className="px-3 py-2 border-b border-white/[0.05] flex justify-between items-center bg-indigo-500/[0.06]">
                                                    <span className="text-[10px] font-bold tracking-wider text-indigo-300/80 uppercase">Page Architecture</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] bg-indigo-500/20 text-indigo-200/60 px-1.5 py-0.5 rounded font-mono">{msg.suggestedPages.length} pages</span>
                                                        <button onClick={() => handleAddAllSuggested(msg.suggestedPages!)}
                                                            className="text-[9px] bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 px-2 py-0.5 rounded font-semibold transition-colors">
                                                            Add All
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="divide-y divide-white/[0.04]">
                                                    {msg.suggestedPages.map((sug, i) => (
                                                        <div key={i} className="p-3 hover:bg-white/[0.02] transition-colors">
                                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span className="text-base shrink-0">{sug.icon || "📄"}</span>
                                                                    <div className="min-w-0">
                                                                        <div className="text-xs font-semibold text-white/80">{sug.name}</div>
                                                                        <div className="text-[10px] text-white/30 mt-0.5">{sug.description}</div>
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => handleAddSuggestedPage(sug.name)}
                                                                    className="shrink-0 w-6 h-6 rounded flex items-center justify-center bg-indigo-500/15 text-indigo-300/70 hover:bg-indigo-500/30 hover:text-white transition-colors" title="Add">
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                                                </button>
                                                            </div>
                                                            {sug.sections && sug.sections.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-1.5 ml-7">
                                                                    {sug.sections.map((sec, j) => (
                                                                        <span key={j} className="text-[9px] bg-white/[0.04] text-white/30 px-1.5 py-0.5 rounded">{sec}</span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <span className={`text-[9px] mt-1 px-1 ${msg.role === "user" ? "text-indigo-300/30" : "text-white/15"}`}>
                                        {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>
                            ))}
                            {isAnalyzing && (
                                <div className="flex justify-start">
                                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 flex items-center gap-3">
                                        <div className="flex gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                                        </div>
                                        <span className="text-[11px] text-white/30">Architecting your UI...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-3 border-t border-white/[0.06] shrink-0 relative z-10">
                            <div className="flex items-end gap-2">
                                <textarea value={inputMessage} onChange={e => setInputMessage(e.target.value)} onKeyDown={handleKeyDown}
                                    placeholder="Describe your app and I'll architect the pages..."
                                    className="flex-1 max-h-28 min-h-[40px] bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-[13px] text-white/80 placeholder-white/20 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 resize-none transition-all"
                                    rows={1} />
                                <button onClick={handleSendMessage} disabled={!inputMessage.trim() || isAnalyzing}
                                    className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:from-white/5 disabled:to-white/5 disabled:text-white/20 text-white transition-all flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20 disabled:shadow-none">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                </button>
                            </div>
                            <div className="text-center mt-1.5">
                                <span className="text-[9px] text-white/15">
                                    <kbd className="font-mono bg-white/[0.04] px-1 py-0.5 rounded">↵</kbd> send · <kbd className="font-mono bg-white/[0.04] px-1 py-0.5 rounded">⇧↵</kbd> new line
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UIIdeationPage;

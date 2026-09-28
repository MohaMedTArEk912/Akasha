import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import StructuredAiResponseCard from "../../ui/StructuredAiResponse";
import { normalizeAiResponse, type StructuredAiResponse } from "../../../utils/aiResponse";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useProjectStore } from '../../../hooks/useProjectStore';
import { setActivePage, refreshCurrentProject } from '../../../stores/projectStore';
import { useBackgroundLoading } from '../../../context/BackgroundLoadingContext';
import { useToast } from '../../../context/ToastContext';
import { useSettings } from '../../../context/SettingsContext';
import { client } from '../../../hooks/useHttpApi';
import CyberPet from './CyberPet';
import {
    Archive,
    ChevronDown,
    Maximize2,
    Minimize2,
    PanelRight,
    Pencil,
    Send,
    Settings2,
    Trash2,
    X,
} from 'lucide-react';

export const PAGE_TO_CONTEXT: Record<string, string> = {
    dashboard: "dashboard",
    idea: "idea",
    database: "database",
    apis: "api",
    usecases: "logic",
    ui: "builder",
    diagrams: "diagrams",
    code: "code",
    settings: "settings",
    team: "dashboard",
    git: "code",
};

export const CONTEXTS = [
    { id: "dashboard", label: "Mission Dashboard" },
    { id: "idea", label: "Idea & Workshop" },
    { id: "database", label: "Data Models (ERD)" },
    { id: "api", label: "API Endpoints" },
    { id: "logic", label: "Logic Flows & Use Cases" },
    { id: "builder", label: "UI Builder / Sandbox" },
    { id: "diagrams", label: "System Diagrams" },
    { id: "code", label: "Source Code" },
    { id: "settings", label: "Project Settings" },
];

export interface AgentAction {
    id: string;
    label: string;
    description: string;
    type: "synthesize-step" | "synthesize-all" | "navigate" | "prompt" | "page-action";
    pageAction?: "ADD_PAGE" | "GENERATE_PAGES" | "COMPILE_ALL" | "SET_STEP" | "REMOVE_PAGE" | "SELECT_PAGE" | "APPLY_QUIZ_PRESET";
    payload?: any;
    step?: "models" | "apis" | "usecases" | "pages" | "diagram";
    targetPage?: string;
    promptText?: string;
}

export const CONTEXT_AGENT_ACTIONS: Record<string, AgentAction[]> = {
    dashboard: [
        { id: "syn-all", label: "Synthesize Architecture", description: "Trigger full-stack autonomous pipeline", type: "synthesize-all" },
        { id: "nav-idea", label: "Idea Workshop", description: "Open Project Spec & Workshop", type: "navigate", targetPage: "idea" },
        { id: "nav-db", label: "Inspect Data", description: "Navigate to Data Models", type: "navigate", targetPage: "database" },
        { id: "prompt-audit", label: "Audit Readiness", description: "Request architectural audit", type: "prompt", promptText: "Run a full architectural audit on this project, highlighting readiness, potential bottlenecks, and next steps." },
    ],
    idea: [
        { id: "syn-all", label: "Synthesize Architecture", description: "Synthesize full architecture from idea", type: "synthesize-all" },
        { id: "prompt-features", label: "Expand MVP Features", description: "Brainstorm high-leverage features", type: "prompt", promptText: "Review our project idea and suggest high-impact MVP features with priority ratings and user value." },
        { id: "prompt-arch", label: "Technical Architecture", description: "Design stack recommendations", type: "prompt", promptText: "Recommend the ideal frontend, backend, database, and infrastructure architecture for this project." },
    ],
    database: [
        { id: "syn-models", label: "Synthesize Models", description: "Synthesize PostgreSQL/Prisma models", type: "synthesize-step", step: "models" },
        { id: "prompt-schema", label: "Optimize Relations", description: "Review 3NF & indexes", type: "prompt", promptText: "Analyze the database schema for indexing strategies, foreign key integrity, and normalization." },
        { id: "prompt-prisma", label: "Export Prisma Schema", description: "Generate schema.prisma definition", type: "prompt", promptText: "Generate a production-ready Prisma schema with relational constraints and enums for all project entities." },
    ],
    api: [
        { id: "syn-apis", label: "Derive Endpoints", description: "Synthesize REST/CRUD API endpoints", type: "synthesize-step", step: "apis" },
        { id: "prompt-auth", label: "Auth Middleware", description: "Design JWT/RBAC security layer", type: "prompt", promptText: "Design authentication & authorization middleware (JWT, role-based access control) for our API routes." },
        { id: "prompt-openapi", label: "OpenAPI 3.0 Spec", description: "Generate Swagger/OpenAPI documentation", type: "prompt", promptText: "Generate complete OpenAPI 3.0 documentation with request/response schemas for our core endpoints." },
    ],
    logic: [
        { id: "syn-usecases", label: "Synthesize Use Cases", description: "Synthesize system workflows and logic", type: "synthesize-step", step: "usecases" },
        { id: "prompt-edge", label: "Map Edge Cases", description: "Find failure modes and race conditions", type: "prompt", promptText: "Map out the critical edge cases, race conditions, and error recovery flows for our primary user journeys." },
        { id: "prompt-fsm", label: "State Machine", description: "Define state transitions", type: "prompt", promptText: "Model a formal Finite State Machine (FSM) for the core business workflow of this application." },
    ],
    builder: [
        { id: "act-sitemap-gen", label: "Synthesize Sitemap", description: "Run autonomous sitemap synthesis from project schema", type: "page-action", pageAction: "GENERATE_PAGES" },
        { id: "act-compile-all", label: "Compile Wireframes", description: "Batch compile AI wireframes for all project pages", type: "page-action", pageAction: "COMPILE_ALL" },
        { id: "act-open-editor", label: "Open Live Editor", description: "Switch to live interactive HTML wireframe editor", type: "page-action", pageAction: "SET_STEP", payload: 2 },
    ],
    diagrams: [
        { id: "syn-diagram", label: "Synthesize Diagrams", description: "Synthesize system topology & ERD", type: "synthesize-step", step: "diagram" },
        { id: "prompt-erd", label: "Mermaid ERD", description: "Generate Mermaid entity relationship diagram", type: "prompt", promptText: "Generate an accurate Mermaid.js ERD diagram representing all data models and their foreign key relations." },
        { id: "prompt-arch-diag", label: "System Topology", description: "C4 container architecture diagram", type: "prompt", promptText: "Generate a Mermaid C4 architecture diagram showing frontend, backend microservices, database, and third-party integrations." },
    ],
    code: [
        { id: "prompt-review", label: "Code Audit", description: "Review project code quality", type: "prompt", promptText: "Perform a code review of the workspace structure, identifying maintainability and security patterns." },
        { id: "prompt-tests", label: "Test Strategy", description: "Generate unit & integration test plan", type: "prompt", promptText: "Generate a complete testing strategy with sample Vitest/Jest unit tests and end-to-end test scenarios." },
    ],
    settings: [
        { id: "prompt-security", label: "Security Audit", description: "Review CORS, CSP, and environment configs", type: "prompt", promptText: "Audit our project configuration for CORS, Content Security Policy, secret management, and rate limiting." },
    ],
};

interface BotChatProps {
    onClose: () => void;
    projectId: string | null;
    projectName: string | null;
    anchorX: number;
    anchorY: number;
    initialPrompt?: string | null;
    initialContext?: string | null;
    initialOpenSettings?: boolean;
    onClearInitialPrompt?: () => void;
}

interface ChatMessage {
    role: "user" | "ai";
    content: string;
    structured?: StructuredAiResponse;
}

interface AgentProfile {
    id: string;
    name: string;
    shortName: string;
    description: string;
    instruction: string;
    accent: string;
    archived?: boolean;
}

interface AgentSession {
    messages: ChatMessage[];
    input: string;
}

const AGENT_PROFILES: AgentProfile[] = [
    {
        id: "architect",
        name: "Architect",
        shortName: "ARCH",
        description: "System design and trade-offs",
        instruction: "Act as the lead software architect. Focus on boundaries, trade-offs, scalability, and a practical implementation sequence.",
        accent: "cyan",
    },
    {
        id: "api",
        name: "API Engineer",
        shortName: "API",
        description: "Routes, contracts, and security",
        instruction: "Act as a senior API engineer. Focus on endpoint design, contracts, validation, authentication, errors, and integration details.",
        accent: "blue",
    },
    {
        id: "ui",
        name: "UI Designer",
        shortName: "UI",
        description: "Flows, layout, and interaction",
        instruction: "Act as a product UI designer and frontend engineer. Focus on hierarchy, accessibility, responsive behavior, interaction states, and polished implementation details.",
        accent: "violet",
    },
];

const EMPTY_AGENT: AgentProfile = {
    id: "empty",
    name: "New Window",
    shortName: "NEW",
    description: "Create a focused chat window",
    instruction: "Help the user define and work through the topic they want this chat window to focus on.",
    accent: "cyan",
};

const removeDataAgentStorage = () => {
    Object.keys(localStorage)
        .filter((key) => key.endsWith("_data"))
        .forEach((key) => localStorage.removeItem(key));
};

const getStoredAgentProfiles = (): AgentProfile[] => {
    try {
        const saved = localStorage.getItem("akasha_chat_agents");
        const custom = saved ? JSON.parse(saved) as AgentProfile[] : [];
        const filtered = custom.filter((agent) => agent.id !== "data");
        if (filtered.length !== custom.length) {
            localStorage.setItem("akasha_chat_agents", JSON.stringify(filtered));
        }
        removeDataAgentStorage();
        return filtered.length > 0 ? filtered : AGENT_PROFILES;
    } catch {
        removeDataAgentStorage();
        return AGENT_PROFILES;
    }
};

const createAgentSessions = (profiles: AgentProfile[] = []): Record<string, AgentSession> => Object.fromEntries(
    profiles.map((agent) => [agent.id, { messages: [], input: "" }]),
);

const API_BASE = "/api/akasha/ai";

export const QUICK_PROMPTS: Record<string, string[]> = {
    global: [
        "What should I build first?",
        "Suggest system architecture improvements",
        "Explain end-to-end data flow",
    ],
    database: [
        "Design relational entity schema",
        "Suggest indexes and performance tuning",
        "Generate PostgreSQL migration scripts",
    ],
    api: [
        "Generate OpenAPI 3.0 endpoints",
        "Design authentication middleware",
        "Create sample JSON request/response payloads",
    ],
    ui: [
        "Design responsive component layout",
        "Refine navigation and typography hierarchy",
        "Suggest interactive state transitions",
    ],
    logic: [
        "Create workflow state machine",
        "Map business logic edge cases",
        "Optimize asynchronous event pipeline",
    ],
    builder: [
        "Generate modular UI components",
        "Inspect page layout tree",
        "Add interactive micro-animations",
    ],
    settings: [
        "Configure environment variables",
        "Audit security headers and CORS policies",
        "Review runtime performance settings",
    ],
};

const copyToClipboard = async (text: string, feedback: (msg: string) => void) => {
    try {
        await navigator.clipboard.writeText(text);
        feedback("Copied!");
        setTimeout(() => feedback(""), 2000);
    } catch {
        feedback("Copy failed");
    }
};

/* ── CodeBlock with In-Place Copy Indicator ── */
const CodeBlock: React.FC<{ inline?: boolean; className?: string; children?: React.ReactNode }> = ({ inline, className, children }) => {
    const lang = className?.replace(/language-/, '') || 'text';
    const code = String(children).replace(/\n$/, '');
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fallback
        }
    };

    const isInline = Boolean(inline || (!className && !code.includes('\n')));
    if (isInline) {
        return (
            <code className="px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 font-mono text-[11.5px] border border-cyan-500/20 font-medium">
                {children}
            </code>
        );
    }

    return (
        <div className="relative my-4 overflow-hidden rounded-xl border border-cyan-400/15 bg-[#04070e] shadow-[0_12px_30px_rgba(0,0,0,0.28)] group/code">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08] bg-white/[0.035] text-[10px] font-mono select-none">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                    <span className="uppercase font-extrabold tracking-[0.16em] text-cyan-200/85">{lang}</span>
                </div>
                <button
                    type="button"
                    onClick={handleCopy}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-mono font-bold tracking-wider transition-all cursor-pointer ${
                        copied
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black"
                            : "bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10"
                    }`}
                >
                    {copied ? "COPIED" : "COPY"}
                </button>
            </div>
            <pre className="overflow-x-auto p-4 text-[12px] leading-[1.7] font-mono text-slate-200 selection:bg-cyan-500/30">
                <code>{code}</code>
            </pre>
        </div>
    );
};

/* ── Akasha Pet Avatar Badge ── */
const AkashaPetAvatar: React.FC<{ size?: number; isThinking?: boolean; isHovered?: boolean; pulse?: boolean; className?: string }> = ({
    size = 32,
    isThinking = false,
    isHovered = false,
    pulse = false,
    className = '',
}) => (
    <div
        className={`relative flex items-center justify-center flex-shrink-0 rounded-full border border-cyan-400/25 bg-[#090e18] shadow-[0_4px_14px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25)] ${className}`}
        style={{ width: size, height: size }}
    >
        <CyberPet isThinking={isThinking || pulse} isHovered={isHovered} size={Math.round(size * 0.85)} />
        {(isThinking || pulse) && (
            <span className="absolute inset-0 rounded-full border border-amber-400/40 animate-ping opacity-60 pointer-events-none" />
        )}
    </div>
);

const BotChat: React.FC<BotChatProps> = ({
    onClose,
    projectId,
    projectName: _projectName,
    anchorX,
    anchorY: _anchorY,
    initialPrompt,
    initialContext,
    initialOpenSettings,
    onClearInitialPrompt,
}) => {
    const { project, activePage } = useProjectStore();
    const { startTask, completeTask, failTask } = useBackgroundLoading();
    const toast = useToast();
    const ideaDetails = project?.settings?.ideaDetails;

    // AI Configuration Settings Integration
    const { apiKey, model, apiBaseUrl, provider, setApiKey, setModel, setApiBaseUrl, setProvider } = useSettings();
    const [showAiSettings, setShowAiSettings] = useState(initialOpenSettings || false);

    useEffect(() => {
        if (initialOpenSettings !== undefined) {
            setShowAiSettings(initialOpenSettings);
        }
    }, [initialOpenSettings]);

    const [inputApiKey, setInputApiKey] = useState(apiKey || "");
    const [inputModel, setInputModel] = useState(model || "gemini-2.0-flash");
    const [inputBaseUrl, setInputBaseUrl] = useState(apiBaseUrl || "https://generativelanguage.googleapis.com/v1beta");
    const [selectedProvider, setSelectedProvider] = useState(provider || "gemini");
    const [showApiKey, setShowApiKey] = useState(false);
    const [isTestingAi, setIsTestingAi] = useState(false);
    const [aiTestResult, setAiTestResult] = useState<{ status: "idle" | "success" | "error"; message: string }>({
        status: "idle",
        message: "",
    });

    useEffect(() => {
        if (apiKey) setInputApiKey(apiKey);
        if (model) setInputModel(model);
        if (apiBaseUrl) setInputBaseUrl(apiBaseUrl);
        if (provider) setSelectedProvider(provider);
    }, [apiKey, model, apiBaseUrl, provider]);

    const handleProviderSelect = (p: string) => {
        setSelectedProvider(p);
        if (p === "gemini") {
            setInputBaseUrl("https://generativelanguage.googleapis.com/v1beta");
            setInputModel("gemini-3.6-flash");
        } else if (p === "openrouter") {
            setInputBaseUrl("https://openrouter.ai/api/v1");
            setInputModel("openrouter/free");
        } else if (p === "openai") {
            setInputBaseUrl("https://api.openai.com/v1");
            setInputModel("gpt-4o-mini");
        }
    };

    const handleSaveAiSettings = () => {
        setApiKey(inputApiKey.trim());
        setModel(inputModel.trim());
        setApiBaseUrl(inputBaseUrl.trim());
        setProvider(selectedProvider);
        toast.showToast("AI configuration saved", "success");
        setShowAiSettings(false);
    };

    const handleTestAiConnection = async () => {
        if (!inputApiKey.trim()) {
            setAiTestResult({ status: "error", message: "API key is empty. Please enter a valid key." });
            toast.showToast("Please enter an API key", "error");
            return;
        }

        setIsTestingAi(true);
        setAiTestResult({ status: "idle", message: "Testing connection..." });

        try {
            setApiKey(inputApiKey.trim());
            setModel(inputModel.trim());
            setApiBaseUrl(inputBaseUrl.trim());
            setProvider(selectedProvider);

            const res = await fetch("/api/akasha/ai/test-connection", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-ai-api-key": inputApiKey.trim(),
                    "x-ai-model": inputModel.trim(),
                    "x-ai-api-base-url": inputBaseUrl.trim(),
                },
                body: JSON.stringify({
                    apiKey: inputApiKey.trim(),
                    model: inputModel.trim(),
                    apiBaseUrl: inputBaseUrl.trim(),
                }),
            });

            if (res.ok) {
                setAiTestResult({ status: "success", message: "Connected successfully (200 OK)" });
                toast.showToast("AI Connection Verified", "success");
            } else {
                const errorData = await res.json().catch(() => ({}));
                const msg = errorData.error || `HTTP ${res.status}: ${res.statusText}`;
                setAiTestResult({ status: "error", message: msg });
                toast.showToast(`Connection failed: ${msg}`, "error");
            }
        } catch (err: any) {
            setAiTestResult({ status: "error", message: err?.message || "Failed to reach AI endpoint" });
            toast.showToast("Connection failed", "error");
        } finally {
            setIsTestingAi(false);
        }
    };

    const [currentContext, setCurrentContext] = useState(() => {
        if (initialContext) return PAGE_TO_CONTEXT[initialContext] || initialContext;
        if (activePage) return PAGE_TO_CONTEXT[activePage] || "dashboard";
        return "dashboard";
    });
    const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>(() => {
        return getStoredAgentProfiles();
    });
    const [activeAgentId, setActiveAgentId] = useState(() => {
        return getStoredAgentProfiles()[0]?.id || EMPTY_AGENT.id;
    });
    const [agentSessions, setAgentSessions] = useState<Record<string, AgentSession>>(() => createAgentSessions(agentProfiles));
    const [showNewAgent, setShowNewAgent] = useState(false);
    const [showArchivedAgents, setShowArchivedAgents] = useState(false);
    const [agentToDelete, setAgentToDelete] = useState<AgentProfile | null>(null);
    const [draggingAgentId, setDraggingAgentId] = useState<string | null>(null);
    const [newAgentName, setNewAgentName] = useState("");
    const [newAgentFocus, setNewAgentFocus] = useState("");
    const activeAgent = agentProfiles.find((agent) => agent.id === activeAgentId) || EMPTY_AGENT;
    const activeSession = agentSessions[activeAgentId] || { messages: [], input: "" };
    const messages = activeSession.messages;
    const input = activeSession.input;
    const setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>> = (value) => {
        setAgentSessions((previous) => {
            const session = previous[activeAgentId] || { messages: [], input: "" };
            const nextMessages = typeof value === "function" ? value(session.messages) : value;
            return { ...previous, [activeAgentId]: { ...session, messages: nextMessages } };
        });
    };
    const setInput = (value: string) => {
        setAgentSessions((previous) => {
            const session = previous[activeAgentId] || { messages: [], input: "" };
            return { ...previous, [activeAgentId]: { ...session, input: value } };
        });
    };

    const handleCreateAgent = () => {
        const name = newAgentName.trim();
        const focus = newAgentFocus.trim();
        if (!name || !focus) return;
        const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now()}`;
        const customAgent: AgentProfile = {
            id,
            name,
            shortName: name.slice(0, 6).toUpperCase(),
            description: focus,
            instruction: `Act as the user's dedicated ${name} agent. Focus your responses on ${focus}. Stay within this focus unless the user asks you to change direction.`,
            accent: "cyan",
        };
        setAgentProfiles((previous) => [...previous, customAgent]);
        setAgentSessions((previous) => ({ ...previous, [id]: { messages: [], input: "" } }));
        setActiveAgentId(id);
        setNewAgentName("");
        setNewAgentFocus("");
        setShowNewAgent(false);
    };

    const handleRenameAgent = (agent: AgentProfile) => {
        const name = window.prompt("Rename chat window", agent.name)?.trim();
        if (!name) return;
        setAgentProfiles((previous) => previous.map((item) => item.id === agent.id
            ? { ...item, name, shortName: name.slice(0, 6).toUpperCase() }
            : item));
    };

    const handleArchiveAgent = (agent: AgentProfile) => {
        const archived = !agent.archived;
        setAgentProfiles((previous) => previous.map((item) => item.id === agent.id ? { ...item, archived } : item));
        if (archived && activeAgentId === agent.id) {
            const next = agentProfiles.find((item) => item.id !== agent.id && !item.archived);
            setActiveAgentId(next?.id || EMPTY_AGENT.id);
        }
    };

    const handleDeleteAgent = (agent: AgentProfile) => {
        setAgentToDelete(agent);
    };

    const confirmDeleteAgent = () => {
        if (!agentToDelete) return;
        const agent = agentToDelete;
        setAgentProfiles((previous) => previous.filter((item) => item.id !== agent.id));
        setAgentSessions((previous) => {
            const next = { ...previous };
            delete next[agent.id];
            return next;
        });
        Object.keys(localStorage)
            .filter((key) => key.includes(`_${agent.id}`))
            .forEach((key) => localStorage.removeItem(key));
        if (activeAgentId === agent.id) {
            const next = agentProfiles.find((item) => item.id !== agent.id && !item.archived);
            setActiveAgentId(next?.id || EMPTY_AGENT.id);
        }
        setAgentToDelete(null);
    };

    const handleArrangeAgent = (targetId: string) => {
        if (!draggingAgentId || draggingAgentId === targetId) return;
        setAgentProfiles((previous) => {
            const sourceIndex = previous.findIndex((agent) => agent.id === draggingAgentId);
            const targetIndex = previous.findIndex((agent) => agent.id === targetId);
            if (sourceIndex < 0 || targetIndex < 0) return previous;
            const next = [...previous];
            const [moved] = next.splice(sourceIndex, 1);
            if (!moved) return previous;
            next.splice(targetIndex, 0, moved);
            return next;
        });
        setDraggingAgentId(null);
    };

    useEffect(() => {
        localStorage.setItem("akasha_chat_agents", JSON.stringify(agentProfiles));
    }, [agentProfiles]);
    const [isTyping, setIsTyping] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [fsSize, setFsSize] = useState({ w: 820, h: 620 });
    const [fsPos, setFsPos] = useState({ x: 120, y: 80 });
    const [resizing, setResizing] = useState<string | null>(null);
    const [sideWidth, setSideWidth] = useState(() => {
        const saved = localStorage.getItem("akasha_chat_panel_width");
        return saved ? Math.max(parseInt(saved, 10), 500) : 520;
    });
    const [isResizingSide, setIsResizingSide] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState<Record<number, string>>({});
    const [reactions, setReactions] = useState<Record<number, 'up' | 'down' | null>>({});
    const [viewport, setViewport] = useState(() => ({
        width: typeof window !== "undefined" ? window.innerWidth : 1024,
        height: typeof window !== "undefined" ? window.innerHeight : 768,
    }));
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fsRef = useRef<HTMLDivElement>(null);

    // --- Dynamic Idea-Aware Quick Prompts ---
    const dynamicQuickPrompts = useMemo(() => {
        const base = QUICK_PROMPTS[currentContext] || QUICK_PROMPTS.global || [];
        if (!ideaDetails) return base;
        const extras: string[] = [];
        if (ideaDetails.product?.coreFeatures?.[0]) {
            extras.push(`How should I implement ${ideaDetails.product.coreFeatures[0]}?`);
        }
        if (ideaDetails.ideaMetadata?.ideaName) {
            extras.push(`Design data model for ${ideaDetails.ideaMetadata.ideaName}`);
        }
        if (ideaDetails.solution?.coreInnovation) {
            extras.push(`What APIs do I need for ${ideaDetails.solution.coreInnovation}?`);
        }
        return [...extras, ...base];
    }, [currentContext, ideaDetails]);

    // Load the active agent's messages when project, context, or agent changes.
    useEffect(() => {
        if (!projectId) return;
        const key = `akasha_chat_history_${projectId}_${currentContext}_${activeAgentId}`;
        const legacyKey = `akasha_chat_history_${projectId}_${currentContext}`;
        const saved = localStorage.getItem(key) || (activeAgentId === "architect" ? localStorage.getItem(legacyKey) : null);
        if (saved) {
            try {
                setMessages(JSON.parse(saved));
            } catch (e) {
                setMessages([]);
            }
        } else {
            setMessages([]);
        }
    }, [projectId, currentContext, activeAgentId]);

    // Save messages to local storage
    useEffect(() => {
        if (!projectId || messages.length === 0) return;
        const key = `akasha_chat_history_${projectId}_${currentContext}_${activeAgentId}`;
        localStorage.setItem(key, JSON.stringify(messages));

        // Save latest summary if available in the last AI message
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'ai') {
            const summaryMatch = lastMsg.content.match(/<summary>([\s\S]*?)<\/summary>/);
            const summaryText = summaryMatch?.[1];
            if (summaryText) {
                localStorage.setItem(`akasha_chat_summary_${projectId}_${currentContext}_${activeAgentId}`, summaryText.trim());
            }
        }
    }, [messages, projectId, currentContext, activeAgentId]);

    const isMobile = viewport.width < 768;
    const dockToRight = isMobile || anchorX >= viewport.width / 2;
    const panelWidth = isMobile ? viewport.width : sideWidth;

    // Handle side panel resize
    useEffect(() => {
        if (!isResizingSide) return;
        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = dockToRight
                ? viewport.width - e.clientX
                : e.clientX;
            const clampedWidth = Math.min(Math.max(newWidth, 340), viewport.width * 0.85);
            setSideWidth(clampedWidth);
        };
        const handleMouseUp = () => {
            setIsResizingSide(false);
            localStorage.setItem("akasha_chat_panel_width", sideWidth.toString());
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingSide, dockToRight, viewport.width, sideWidth]);

    // Handle detached (fullscreen) resize
    useEffect(() => {
        if (!resizing || isMaximized) return;
        const handleMouseMove = (e: MouseEvent) => {
            if (resizing === 'se') {
                setFsSize(() => ({
                    w: Math.max(450, e.clientX - fsPos.x),
                    h: Math.max(350, e.clientY - fsPos.y),
                }));
            }
        };
        const handleMouseUp = () => setResizing(null);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizing, fsPos, isMaximized]);

    const panelStyle: React.CSSProperties = isMobile
        ? {
            position: "fixed",
            inset: 0,
            zIndex: 9998,
        }
        : isMaximized
            ? {
                position: "fixed",
                inset: "20px",
                zIndex: 10000,
            }
        : isFullscreen
            ? {
                position: "fixed",
                left: fsPos.x,
                top: fsPos.y,
                width: fsSize.w,
                height: fsSize.h,
                zIndex: 10000,
            }
        : {
            position: "fixed",
            top: 0,
            bottom: 0,
            zIndex: 9998,
            width: panelWidth,
            right: dockToRight ? 0 : "auto",
            left: dockToRight ? "auto" : 0,
            transition: isResizingSide ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        };

    // Handle dragging for detached panel
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isFullscreen || isMaximized) return;
        const startX = e.clientX - fsPos.x;
        const startY = e.clientY - fsPos.y;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            setFsPos({
                x: moveEvent.clientX - startX,
                y: moveEvent.clientY - startY,
            });
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Auto scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    useEffect(() => {
        const handleResize = () => {
            setViewport({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Focus input on mount
    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    // Sync current context with activePage from projectStore
    useEffect(() => {
        if (activePage) {
            const mapped = PAGE_TO_CONTEXT[activePage] || "dashboard";
            setCurrentContext(mapped);
        }
    }, [activePage]);

    // Handle initial prompt from props or event
    useEffect(() => {
        if (initialContext) {
            const mapped = PAGE_TO_CONTEXT[initialContext] || initialContext;
            setCurrentContext(mapped);
        }
        if (initialPrompt) {
            setInput(initialPrompt);
            onClearInitialPrompt?.();
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [initialPrompt, initialContext, onClearInitialPrompt]);

    const runAgentAction = useCallback(async (action: AgentAction) => {
        if (!projectId) {
            toast.showToast("Please open a project to run autonomous actions", "warning");
            return;
        }

        if (action.type === "navigate" && action.targetPage) {
            setActivePage(action.targetPage as any);
            toast.showToast(`Navigated to ${action.targetPage.toUpperCase()}`, "info");
            return;
        }

        if (action.type === "page-action" && action.pageAction) {
            window.dispatchEvent(
                new CustomEvent("akasha:page-action", {
                    detail: {
                        action: action.pageAction,
                        payload: action.payload,
                    },
                })
            );
            toast.showToast(`Executed: ${action.label}`, "success");
            setMessages((prev) => [
                ...prev,
                {
                    role: "ai",
                    content: `**Action Executed on Page:**\n**${action.label}**\n\n${action.description || 'Command dispatched to current page.'}`,
                },
            ]);
            return;
        }

        if (action.type === "prompt" && action.promptText) {
            setInput(action.promptText);
            inputRef.current?.focus();
            return;
        }

        if (action.type === "synthesize-step" && action.step) {
            const stepName = action.step;
            const titleMap: Record<string, string> = {
                models: "Data Models (ERD)",
                apis: "API Endpoints",
                usecases: "Business Logic / Use Cases",
                pages: "UI Pages / Wireframes",
                diagram: "Architecture Diagrams",
            };
            const stepTitle = titleMap[stepName] || stepName;

            setIsTyping(true);
            setMessages(prev => [
                ...prev,
                { role: "user", content: `Execute Agent Directive: Synthesize ${stepTitle}` },
                { role: "ai", content: `**Autonomous Agent Engaged**: Synthesizing **${stepTitle}** into workspace. Generating schema, contracts, and code models...` },
            ]);

            startTask({
                id: `bot-${stepName}`,
                title: `Agent: ${stepTitle}`,
                step: `Synthesizing ${stepTitle.toLowerCase()}...`,
                progress: 30,
            });
            toast.showToast(`Agent synthesizing ${stepTitle}...`, "info");

            try {
                await client.post("/ai/agent/synthesize-step", {
                    projectId,
                    step: stepName,
                });

                await refreshCurrentProject();
                completeTask({
                    id: `bot-${stepName}`,
                    resultSummary: `Synthesized ${stepTitle}`,
                });
                toast.showToast(`✅ ${stepTitle} synthesized successfully`, "success");

                setMessages(prev => [
                    ...prev,
                    {
                        role: "ai",
                        content: `### ✅ Autonomous Synthesis Completed\n\n**Module:** ${stepTitle}\n**Status:** Synced & Active\n\nThe ${stepTitle.toLowerCase()} have been committed to the project workspace and state tree. You can inspect the updated files in the **${stepTitle}** tab.`,
                    },
                ]);
            } catch (err: any) {
                failTask({ id: `bot-${stepName}`, error: err.message });
                toast.showToast(`Failed: ${err.message}`, "error");
                setMessages(prev => [
                    ...prev,
                    { role: "ai", content: `❌ **Agent Synthesis Failed**: ${err.message || "Unknown error"}` },
                ]);
            } finally {
                setIsTyping(false);
            }
            return;
        }

        if (action.type === "synthesize-all") {
            setIsTyping(true);
            setMessages(prev => [
                ...prev,
                { role: "user", content: `Execute Agent Directive: Synthesize Full-Stack Architecture` },
                { role: "ai", content: `**Autonomous Agent Pipeline Activated**: Beginning comprehensive end-to-end synthesis across Data Models, APIs, Workflows, UI Pages, and System Diagrams.` },
            ]);

            startTask({
                title: "Agent Synthesizer",
                step: "Running full-stack autonomous synthesis...",
                progress: 15,
            });
            toast.showToast("Full-Stack Agent Synthesizer started in background", "info");

            try {
                await client.post("/ai/agent/synthesize-all", { projectId });
                await refreshCurrentProject();
                toast.showToast("Full architecture synthesis completed", "success");
                setMessages(prev => [
                    ...prev,
                    {
                        role: "ai",
                        content: `### 🚀 Full-Stack Architecture Synthesized!\n\nAll subsystem modules have been derived from the project specification:\n\n- **Data Models:** Relational schema & entities\n- **API Endpoints:** RESTful routes with contracts\n- **Logic Flows:** Core use cases & business rules\n- **UI Sandbox:** Component hierarchy & views\n- **Diagrams:** System topology & ERD maps\n\nYour workspace is fully primed for code generation!`,
                    },
                ]);
            } catch (err: any) {
                failTask({ error: err.message });
                toast.showToast(`Synthesis failed: ${err.message}`, "error");
                setMessages(prev => [
                    ...prev,
                    { role: "ai", content: `❌ **Synthesis Pipeline Failed**: ${err.message || "Unknown error"}` },
                ]);
            } finally {
                setIsTyping(false);
            }
        }
    }, [projectId, toast, startTask, completeTask, failTask]);

    const handleClearChat = () => {
        if (!projectId) return;
        const key = `akasha_chat_history_${projectId}_${currentContext}_${activeAgentId}`;
        localStorage.removeItem(key);
        localStorage.removeItem(`akasha_chat_summary_${projectId}_${currentContext}_${activeAgentId}`);
        setMessages([]);
    };

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;

        const userMsg = input.trim();
        const lower = userMsg.toLowerCase().trim();

        // 1. Autonomous Navigation Directives
        if (/^(go to|open|show|switch to|navigate to)\s+(database|models?|db|erd)/i.test(lower)) {
            setActivePage('database');
            setMessages(prev => [
                ...prev,
                { role: "user", content: userMsg },
                { role: "ai", content: "Navigating to **Data Models (ERD)** page." }
            ]);
            setInput("");
            return;
        }
        if (/^(go to|open|show|switch to|navigate to)\s+(apis?|endpoints?|routes?)/i.test(lower)) {
            setActivePage('apis');
            setMessages(prev => [
                ...prev,
                { role: "user", content: userMsg },
                { role: "ai", content: "Navigating to **API Endpoints** page." }
            ]);
            setInput("");
            return;
        }
        if (/^(go to|open|show|switch to|navigate to)\s+(diagrams?|topology)/i.test(lower)) {
            setActivePage('diagrams');
            setMessages(prev => [
                ...prev,
                { role: "user", content: userMsg },
                { role: "ai", content: "Navigating to **System Diagrams** page." }
            ]);
            setInput("");
            return;
        }
        if (/^(go to|open|show|switch to|navigate to)\s+(ui|builder|pages?|sandbox|wireframes?)/i.test(lower)) {
            setActivePage('ui');
            setMessages(prev => [
                ...prev,
                { role: "user", content: userMsg },
                { role: "ai", content: "Navigating to **UI Builder & Sandbox** page." }
            ]);
            setInput("");
            return;
        }
        if (/^(go to|open|show|switch to|navigate to)\s+(idea|workshop|plan|concept)/i.test(lower)) {
            setActivePage('idea');
            setMessages(prev => [
                ...prev,
                { role: "user", content: userMsg },
                { role: "ai", content: "Navigating to **Idea Workshop** page." }
            ]);
            setInput("");
            return;
        }
        if (/^(go to|open|show|switch to|navigate to)\s+(dashboard|home|overview)/i.test(lower)) {
            setActivePage('dashboard');
            setMessages(prev => [
                ...prev,
                { role: "user", content: userMsg },
                { role: "ai", content: "Navigating to **Mission Dashboard**." }
            ]);
            setInput("");
            return;
        }

        // 2. Direct Autonomous Synthesis Directives
        if (/^(synthesize|generate|build)\s+(all|everything|architecture|full stack|full-stack)/i.test(lower)) {
            setInput("");
            await runAgentAction({ id: "syn-all", label: "Synthesize Architecture", description: "", type: "synthesize-all" });
            return;
        }
        if (/^(synthesize|generate|build)\s+(models?|database|schema|erd)/i.test(lower)) {
            setInput("");
            await runAgentAction({ id: "syn-models", label: "Synthesize Models", description: "", type: "synthesize-step", step: "models" });
            return;
        }
        if (/^(synthesize|generate|build)\s+(apis?|endpoints?|routes?)/i.test(lower)) {
            setInput("");
            await runAgentAction({ id: "syn-apis", label: "Synthesize APIs", description: "", type: "synthesize-step", step: "apis" });
            return;
        }
        if (/^(synthesize|generate|build)\s+(usecases?|use cases?|workflows?|logic)/i.test(lower)) {
            setInput("");
            await runAgentAction({ id: "syn-usecases", label: "Synthesize Use Cases", description: "", type: "synthesize-step", step: "usecases" });
            return;
        }
        if (/^(synthesize|generate|build)\s+(pages?|ui|views?)/i.test(lower)) {
            setInput("");
            await runAgentAction({ id: "syn-pages", label: "Synthesize Pages", description: "", type: "synthesize-step", step: "pages" });
            return;
        }
        if (/^(synthesize|generate|build)\s+(diagrams?|topology)/i.test(lower)) {
            setInput("");
            await runAgentAction({ id: "syn-diagram", label: "Synthesize Diagram", description: "", type: "synthesize-step", step: "diagram" });
            return;
        }

        // 3. Direct Page Actions (UX Sandbox / Sitemap / Active Editor Agency)
        const addPageMatch = lower.match(/^(?:add|create|new|generate)\s+page\s+["']?([^"'\n]+?)["']?$/i) ||
                             lower.match(/^(?:add|create)\s+["']?([^"'\n]+?)["']?\s+page$/i);
        if (addPageMatch) {
            const pageName = addPageMatch[1].trim();
            const cleanName = pageName.charAt(0).toUpperCase() + pageName.slice(1);
            let type = "detail";
            if (/dash|metric|overview|home/i.test(pageName)) {
                type = "dashboard";
            } else if (/list|catalog|directory|browse|registry|explore/i.test(pageName)) {
                type = "list";
            } else if (/sett|config|admin|param/i.test(pageName)) {
                type = "settings";
            } else if (/login|signup|auth|register/i.test(pageName)) {
                type = "auth";
            } else if (/profile|user|account/i.test(pageName)) {
                type = "profile";
            }
            
            await runAgentAction({
                id: `act-add-${Date.now()}`,
                label: `Add ${cleanName}`,
                description: `Created page "${cleanName}" directly on sitemap`,
                type: "page-action",
                pageAction: "ADD_PAGE",
                payload: {
                    name: cleanName,
                    type,
                    description: `Interactive page for ${cleanName}`
                }
            });
            setInput("");
            return;
        }

        const removePageMatch = lower.match(/^(?:remove|delete)\s+page\s+["']?([^"'\n]+?)["']?$/i);
        if (removePageMatch) {
            const pageTarget = removePageMatch[1].trim();
            await runAgentAction({
                id: `act-rem-${Date.now()}`,
                label: `Remove ${pageTarget}`,
                description: `Removed page matching "${pageTarget}"`,
                type: "page-action",
                pageAction: "REMOVE_PAGE",
                payload: { name: pageTarget }
            });
            setInput("");
            return;
        }

        if (/quiz\s+(blueprint|preset|platform|architecture)|apply\s+quiz/i.test(lower)) {
            await runAgentAction({
                id: "act-quiz-blueprint",
                label: "Quiz Blueprint",
                description: "Applied complete 8-page Quiz Platform architecture to sitemap",
                type: "page-action",
                pageAction: "APPLY_QUIZ_PRESET"
            });
            setInput("");
            return;
        }

        if (/(compile|render)\s+(all|wireframes|pages|html)/i.test(lower)) {
            await runAgentAction({
                id: "act-compile-all",
                label: "Compile Wireframes",
                description: "Batch compiling interactive wireframes for all pages",
                type: "page-action",
                pageAction: "COMPILE_ALL"
            });
            setInput("");
            return;
        }

        if (/open\s+(live\s+)?editor|switch\s+to\s+editor|view\s+wireframe|preview\s+page/i.test(lower)) {
            await runAgentAction({
                id: "act-open-editor",
                label: "Open Live Editor",
                description: "Navigated to live interactive HTML wireframe editor",
                type: "page-action",
                pageAction: "SET_STEP",
                payload: 2
            });
            setInput("");
            return;
        }

        if (/sitemap|show\s+sitemap|back\s+to\s+sitemap|step\s+1/i.test(lower)) {
            await runAgentAction({
                id: "act-open-sitemap",
                label: "Open Sitemap",
                description: "Returned to Sitemap architecture view",
                type: "page-action",
                pageAction: "SET_STEP",
                payload: 1
            });
            setInput("");
            return;
        }

        const newMessages = [...messages, { role: "user" as const, content: userMsg }];
        setMessages(newMessages);
        setInput("");
        setIsTyping(true);

        try {
            const endpoint = projectId ? `${API_BASE}/project-chat` : `${API_BASE}/simple-chat`;

            const contextLabel = CONTEXTS.find(c => c.id === currentContext)?.label || "Project";
            let contextInstruction = "";

            let ideaContext = "";
            if (ideaDetails) {
                const parts: string[] = [];
                if (ideaDetails.ideaMetadata?.ideaName) parts.push(`This project is called "${ideaDetails.ideaMetadata.ideaName}".`);
                if (ideaDetails.ideaMetadata?.summary) parts.push(ideaDetails.ideaMetadata.summary);
                if (ideaDetails.problem?.problemStatement) parts.push(`Problem: ${ideaDetails.problem.problemStatement}.`);
                if (ideaDetails.solution?.coreInnovation) parts.push(`Solution: ${ideaDetails.solution.coreInnovation}.`);
                if (ideaDetails.product?.coreFeatures?.length) parts.push(`Core features: ${ideaDetails.product.coreFeatures.join(', ')}.`);
                if (ideaDetails.technicalArchitecture) {
                    const ta = ideaDetails.technicalArchitecture;
                    const stack = [ta.frontend, ta.backend, ta.database].filter(Boolean).join(', ');
                    if (stack) parts.push(`Tech stack: ${stack}.`);
                }
                if (parts.length) ideaContext = `\n[PROJECT CONTEXT: ${parts.join(' ')}]`;
            }

            if (newMessages.length === 1) {
                contextInstruction = `\n\n[SYSTEM INSTRUCTION: You are the ${activeAgent.name} agent. ${activeAgent.instruction} You are assisting the user on the '${contextLabel}' page. Please consider this context. Output clear, actionable solutions with syntax-highlighted code blocks where applicable. At the very end of your response, output a brief summary of the conversation so far enclosed in <summary> tags.]${ideaContext}`;
            } else {
                contextInstruction = `\n\n[SYSTEM INSTRUCTION: Continue as the ${activeAgent.name} agent. ${activeAgent.instruction} Remember we are focused on the '${contextLabel}' context. At the end of your response, update the <summary> of our conversation.]${ideaContext}`;
            }

            const payloadHistory = [...newMessages];
            payloadHistory[payloadHistory.length - 1] = {
                role: "user",
                content: userMsg + contextInstruction
            };

            let finalHistoryToSend = payloadHistory.slice(0, -1);
            if (finalHistoryToSend.length > 6) {
                const savedSummary = localStorage.getItem(`akasha_chat_summary_${projectId}_${currentContext}_${activeAgentId}`);
                if (savedSummary) {
                    finalHistoryToSend = [
                        { role: "user", content: `[SYSTEM: Previous conversation summary: ${savedSummary}]` },
                        ...finalHistoryToSend.slice(-4)
                    ];
                }
            }

            const body = projectId
                ? { message: userMsg + contextInstruction, projectId, history: finalHistoryToSend }
                : { message: userMsg + contextInstruction };

            const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
            if (typeof window !== "undefined") {
                const storedKey = localStorage.getItem("akasha_api_key")?.trim();
                const storedModel = localStorage.getItem("akasha_model")?.trim();
                const storedBase = localStorage.getItem("akasha_api_base_url")?.trim();
                const token = (localStorage.getItem("akasha_token") || localStorage.getItem("token"))?.trim();
                if (storedKey) fetchHeaders["x-ai-api-key"] = storedKey;
                if (storedModel) fetchHeaders["x-ai-model"] = storedModel;
                if (storedBase) fetchHeaders["x-ai-api-base-url"] = storedBase;
                if (token) fetchHeaders["Authorization"] = `Bearer ${token}`;
            }

            const res = await fetch(endpoint, {
                method: "POST",
                headers: fetchHeaders,
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.message || "Failed to get response");

            const structured = normalizeAiResponse(data);
            setMessages(prev => [...prev, { role: "ai", content: structured.answer_markdown, structured }]);
        } catch (err: any) {
            setMessages(prev => [...prev, { role: "ai", content: `ERR: ${err.message || "Connection failed"}` }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div
            ref={fsRef}
            style={panelStyle}
            className={isMobile ? "animate-chat-in-mobile" : dockToRight && !isFullscreen ? "animate-chat-in-right" : !isFullscreen ? "animate-chat-in-left" : ""}
        >
            {/* Resize Handle for Docked Mode */}
            {!isMobile && !isFullscreen && !isMaximized && (
                <div
                    onMouseDown={() => setIsResizingSide(true)}
                    className={`absolute top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-cyan-500/20 active:bg-cyan-500/40 transition-all z-50 flex items-center justify-center group ${dockToRight ? "left-0" : "right-0"}`}
                >
                    <div className="w-[2px] h-14 bg-white/10 group-hover:bg-cyan-400 group-active:bg-cyan-400 rounded-full transition-all" />
                </div>
            )}

            {/* ── 3D Bubble Glass Chat Shell with Luminous Glow ── */}
            <div
                className={`h-full flex flex-col bg-[#070b16] border border-cyan-500/35 ring-1 ring-cyan-500/20 text-white overflow-hidden relative shadow-[0_24px_80px_rgba(0,0,0,0.95),0_0_50px_rgba(6,182,212,0.22),inset_0_1px_1px_rgba(255,255,255,0.12)] transition-all duration-300 ${
                    isMobile
                        ? "rounded-none border-0"
                        : isMaximized
                            ? "rounded-2xl"
                            : isFullscreen
                                ? "rounded-3xl shadow-[0_40px_120px_rgba(0,0,0,0.95),0_0_0_1px_rgba(6,182,212,0.35)]"
                                : `${dockToRight ? "rounded-l-3xl border-l" : "rounded-r-3xl border-r"} border-y-0 shadow-[-24px_0_70px_rgba(0,0,0,0.95)]`
                }`}
            >
                {/* Luminous Top Accent Glow Beam */}
                <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80 pointer-events-none z-10" />
                {/* Detached Window Top Drag Handle */}
                {isFullscreen && !isMaximized && (
                    <div onMouseDown={handleMouseDown} className="flex justify-center pt-2 cursor-grab active:cursor-grabbing">
                        <div className="w-14 h-1 bg-white/20 rounded-full hover:bg-white/40 transition-colors" />
                    </div>
                )}

                {/* ── World-Class Header ── */}
                <div
                    onMouseDown={handleMouseDown}
                    className={`min-h-16 px-4 py-2.5 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-white/[0.025] select-none ${
                        isFullscreen && !isMaximized ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                    }`}
                >
                    {/* Left: CyberPet Avatar + Title & Live Telemetry */}
                    <div className="flex items-center gap-2.5 min-w-0">
                        <AkashaPetAvatar size={30} isThinking={isTyping} />
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[12px] font-black tracking-wider text-white uppercase truncate">
                                    {activeAgent.name}
                                </span>
                                <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-[7.5px] font-mono font-bold text-cyan-300 tracking-wider">
                                    COPILOT
                                </span>
                            </div>
                            <div className="flex items-center gap-1 min-w-0">
                                <span className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_#34d399] animate-pulse ${isTyping ? "bg-amber-400 shadow-[0_0_8px_#fbbf24]" : "bg-emerald-400"}`} />
                                <span className="text-[8.5px] text-white/50 font-mono font-semibold tracking-wider uppercase truncate">
                                    {isTyping ? "SYNTHESIZING..." : "ONLINE • " + (ideaDetails ? "SYNCED" : "READY")}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Context Selector & Window Controls */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* AI Model & Credentials Toggle Button */}
                        <button
                            type="button"
                            onClick={() => setShowAiSettings((prev) => !prev)}
                            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[9px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
                                showAiSettings
                                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-sm"
                                    : "bg-white/[0.05] border-white/10 hover:bg-white/[0.09] hover:border-cyan-400/40 text-white/85"
                            }`}
                            title="Configure AI Model, API Key & Provider"
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${apiKey ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-amber-400 shadow-[0_0_6px_#fbbf24]"}`} />
                            <span className="truncate max-w-[85px]">{model.split("/").pop()}</span>
                            <Settings2 className="h-3.5 w-3.5 text-white/45" />
                        </button>

                        {/* Context Dropdown Selector */}
                        <div className="relative group/ctx">
                            <button type="button" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 hover:bg-white/[0.09] hover:border-cyan-400/40 transition-all text-[9px] font-bold text-white/85 focus:outline-none whitespace-nowrap max-w-[125px] truncate flex-shrink-0 cursor-pointer">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee] flex-shrink-0" />
                                <span className="uppercase tracking-wider truncate">{CONTEXTS.find(c => c.id === currentContext)?.label || currentContext}</span>
                                <ChevronDown className="h-3 w-3 opacity-45 flex-shrink-0" />
                            </button>
                            <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-[#0d1424] border border-white/15 backdrop-blur-2xl shadow-2xl p-1.5 hidden group-focus-within/ctx:block group-hover/ctx:block z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                                {CONTEXTS.map((ctx) => (
                                    <button
                                        key={ctx.id}
                                        onClick={() => setCurrentContext(ctx.id)}
                                        className={`w-full text-left px-3 py-1.5 rounded-xl text-[10.5px] font-semibold tracking-wide transition-all flex items-center gap-2 cursor-pointer ${
                                            currentContext === ctx.id
                                                ? 'bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/25'
                                                : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
                                        }`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${currentContext === ctx.id ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]' : 'bg-transparent'}`} />
                                        {ctx.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="h-3.5 w-[1px] bg-white/10 mx-0.5" />

                        {/* Window Action Buttons */}
                        <div className="flex items-center gap-1">
                            {!isMobile && (
                                <>
                                    <button
                                        onClick={() => { setIsFullscreen(!isFullscreen); if (isMaximized) setIsMaximized(false); }}
                                        className={`px-1.5 py-1 rounded-lg text-[8.5px] font-extrabold tracking-wider transition-all cursor-pointer ${
                                            isFullscreen
                                                ? "text-cyan-300 bg-cyan-500/15 border border-cyan-500/30"
                                                : "text-white/40 hover:text-white hover:bg-white/5"
                                        }`}
                                        title={isFullscreen ? "Dock Chat to Sidebar" : "Float Chat Window"}
                                    >
                                        <PanelRight className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => { setIsMaximized(!isMaximized); if (isFullscreen) setIsFullscreen(false); }}
                                        className={`px-1.5 py-1 rounded-lg text-[8.5px] font-extrabold tracking-wider transition-all cursor-pointer ${
                                            isMaximized
                                                ? "text-cyan-300 bg-cyan-500/15 border border-cyan-500/30"
                                                : "text-white/40 hover:text-white hover:bg-white/5"
                                        }`}
                                        title={isMaximized ? "Restore Size" : "Maximize Screen"}
                                    >
                                        {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                                    </button>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-all font-bold text-xs cursor-pointer"
                                title="Close"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Multi-agent workspace ── */}
                <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 bg-[#08111f] border-b border-cyan-400/15 scrollbar-none">
                    <span className="shrink-0 px-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/35">Agents</span>
                    {agentProfiles.filter((agent) => showArchivedAgents || !agent.archived).map((agent) => {
                        const isActive = agent.id === activeAgentId;
                        const count = agentSessions[agent.id]?.messages.length || 0;
                        return (
                            <div
                                key={agent.id}
                                draggable
                                onDragStart={() => setDraggingAgentId(agent.id)}
                                onDragEnd={() => setDraggingAgentId(null)}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => handleArrangeAgent(agent.id)}
                                className={`shrink-0 inline-flex items-center gap-1 rounded-lg border transition-all ${
                                    isActive ? "border-cyan-300/45 bg-cyan-400/15 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.12)]" : "border-white/[0.08] bg-white/[0.03] text-white/45"
                                } ${agent.archived ? "opacity-55" : ""} ${draggingAgentId === agent.id ? "opacity-40" : ""}`}
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (agent.archived) return;
                                        setActiveAgentId(agent.id);
                                        setShowAiSettings(false);
                                        setTimeout(() => inputRef.current?.focus(), 0);
                                    }}
                                    title={`${agent.name}: ${agent.description}`}
                                    className="inline-flex items-center gap-1.5 rounded-l-lg px-2.5 py-1.5 text-[9px] font-bold tracking-wide transition-all cursor-pointer"
                                >
                                    <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-cyan-300 shadow-[0_0_7px_#67e8f9]" : "bg-white/25"}`} />
                                    {agent.shortName}
                                    {count > 0 && <span className="rounded-full bg-white/10 px-1.5 text-[8px] text-white/55">{count}</span>}
                                </button>
                                <button type="button" onClick={() => handleRenameAgent(agent)} title="Rename window" className="p-1 text-white/35 hover:text-cyan-200 transition-colors cursor-pointer">
                                    <Pencil className="h-3 w-3" />
                                </button>
                                <button type="button" onClick={() => handleArchiveAgent(agent)} title={agent.archived ? "Restore window" : "Archive window"} className="p-1 text-white/35 hover:text-amber-200 transition-colors cursor-pointer">
                                    <Archive className="h-3 w-3" />
                                </button>
                                <button type="button" onClick={() => handleDeleteAgent(agent)} title="Delete window" className="p-1 mr-1 text-white/35 hover:text-rose-300 transition-colors cursor-pointer">
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        );
                    })}
                    {agentProfiles.some((agent) => agent.archived) && (
                        <button type="button" onClick={() => setShowArchivedAgents((previous) => !previous)} className="shrink-0 rounded-lg px-2 py-1.5 text-[8px] font-bold tracking-wider text-white/35 hover:text-white/75 transition-colors cursor-pointer">
                            {showArchivedAgents ? "HIDE ARCHIVED" : "ARCHIVED"}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowNewAgent((previous) => !previous)}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-cyan-300/30 bg-cyan-400/[0.04] px-2.5 py-1.5 text-[9px] font-bold tracking-wide text-cyan-200/70 hover:border-cyan-300/60 hover:bg-cyan-400/10 hover:text-cyan-100 transition-all cursor-pointer"
                        title="Create a custom chat window"
                    >
                        NEW WINDOW
                    </button>
                </div>

                {showNewAgent && (
                    <div className="grid grid-cols-1 sm:grid-cols-[0.8fr_1.5fr_auto] gap-2 px-3 py-2.5 bg-cyan-950/35 border-b border-cyan-400/15">
                        <input
                            value={newAgentName}
                            onChange={(event) => setNewAgentName(event.target.value)}
                            placeholder="Window name"
                            className="h-8 rounded-lg border border-cyan-300/20 bg-[#071321] px-2.5 text-[11px] text-white placeholder:text-white/35 outline-none focus:border-cyan-300/60"
                        />
                        <input
                            value={newAgentFocus}
                            onChange={(event) => setNewAgentFocus(event.target.value)}
                            onKeyDown={(event) => { if (event.key === "Enter") handleCreateAgent(); }}
                            placeholder="What should this window focus on?"
                            className="h-8 rounded-lg border border-cyan-300/20 bg-[#071321] px-2.5 text-[11px] text-white placeholder:text-white/35 outline-none focus:border-cyan-300/60"
                        />
                        <button
                            type="button"
                            onClick={handleCreateAgent}
                            disabled={!newAgentName.trim() || !newAgentFocus.trim()}
                            className="h-8 rounded-lg bg-cyan-400 px-3 text-[10px] font-bold text-slate-950 transition-all hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                            CREATE
                        </button>
                    </div>
                )}

                {/* ── AI Configuration Modal Overlay (Icon-free, Same-line inputs) ── */}
                {showAiSettings && (
                    <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-150">
                        <div className="w-full max-w-lg bg-[#0b1728] border border-cyan-400/30 rounded-2xl p-4 shadow-[0_24px_80px_rgba(0,0,0,0.95),0_0_40px_rgba(6,182,212,0.18)] space-y-3.5 relative overflow-y-auto max-h-[90%] custom-scrollbar">
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
                            <div className="flex items-center justify-between pb-2 border-b border-cyan-300/15">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-cyan-100 uppercase tracking-[0.12em]">
                                        AI Model & Credentials
                                    </span>
                                    <span className={`text-[8.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                        inputApiKey
                                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                            : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                    }`}>
                                        {inputApiKey ? "Active Key" : "No Key"}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAiSettings(false)}
                                    className="text-[9px] font-bold uppercase tracking-wider text-white/45 hover:text-white px-2 py-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>

                            {/* Provider Selection */}
                            <div className="space-y-1">
                                <label className="text-[9.5px] font-bold text-white/50 uppercase tracking-wider">
                                    Provider
                                </label>
                                <div className="grid grid-cols-4 gap-1 rounded-lg bg-white/[0.035] p-1 border border-white/[0.06]">
                                    {[
                                        { id: "gemini", label: "Gemini" },
                                        { id: "openrouter", label: "OpenRouter" },
                                        { id: "openai", label: "OpenAI" },
                                        { id: "custom", label: "Custom" },
                                    ].map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => handleProviderSelect(p.id)}
                                            className={`py-1.5 rounded-md text-[9.5px] font-semibold text-center transition-all cursor-pointer ${
                                                selectedProvider === p.id
                                                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                                                    : "bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08] border border-transparent"
                                            }`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* API Key & Model — On the Exact Same Line */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                                {/* API Key Column */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between h-4">
                                        <label className="text-[9px] font-bold text-white/50 uppercase tracking-wider">
                                            API Key
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey(!showApiKey)}
                                            className="text-[8px] font-bold uppercase text-cyan-400 hover:underline cursor-pointer"
                                        >
                                            {showApiKey ? "HIDE" : "SHOW"}
                                        </button>
                                    </div>
                                    <input
                                        type={showApiKey ? "text" : "password"}
                                        value={inputApiKey}
                                        onChange={(e) => setInputApiKey(e.target.value)}
                                        placeholder={
                                            selectedProvider === "gemini"
                                                ? "AIzaSy..."
                                                : selectedProvider === "openrouter"
                                                ? "sk-or-v1-..."
                                                : "sk-..."
                                        }
                                        className="w-full h-8 px-2.5 rounded-lg bg-[#07090f] border border-white/12 text-[11px] font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                                    />
                                </div>

                                {/* Model Column */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between h-4">
                                        <label className="text-[9px] font-bold text-white/50 uppercase tracking-wider">
                                            Model
                                        </label>
                                        <div className="flex items-center gap-1">
                                            {[
                                                { label: "Gemini 3.6", model: "gemini-3.6-flash" },
                                                { label: "Gemini 2.5", model: "gemini-2.5-flash" },
                                                { label: "GPT-4o Mini", model: "gpt-4o-mini" },
                                                { label: "Free", model: "openrouter/free" },
                                            ].map((item) => (
                                                <button
                                                    key={item.model}
                                                    type="button"
                                                    onClick={() => setInputModel(item.model)}
                                                    className={`px-1.5 py-0.2 rounded text-[7.5px] font-semibold transition-colors cursor-pointer ${
                                                        inputModel === item.model
                                                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/35"
                                                            : "bg-white/[0.04] text-white/50 hover:text-white border border-transparent"
                                                    }`}
                                                >
                                                    {item.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        value={inputModel}
                                        onChange={(e) => setInputModel(e.target.value)}
                                        placeholder="e.g. gemini-2.0-flash"
                                        className="w-full h-8 px-2.5 rounded-lg bg-[#07090f] border border-white/12 text-[11px] font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            {/* API Base URL */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-white/50 uppercase tracking-wider">
                                    API Base URL
                                </label>
                                <input
                                    type="text"
                                    value={inputBaseUrl}
                                    onChange={(e) => setInputBaseUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full h-8 px-2.5 rounded-lg bg-[#07090f] border border-white/12 text-[11px] font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                                />
                            </div>

                            {/* Live Test Result */}
                            {aiTestResult.status !== "idle" && (
                                <div
                                    className={`p-2 rounded-lg text-[10.5px] font-medium border ${
                                        aiTestResult.status === "success"
                                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                            : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                                    }`}
                                >
                                    {aiTestResult.message}
                                </div>
                            )}

                            {/* Action Buttons (Icon-free) */}
                            <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSaveAiSettings}
                                        className="px-3.5 py-1.5 rounded-lg text-[10px] font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 active:scale-[0.97] transition-all cursor-pointer shadow-sm"
                                    >
                                        Save Configuration
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleTestAiConnection}
                                        disabled={isTestingAi}
                                        className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-white/70 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 disabled:opacity-40 transition-all cursor-pointer"
                                    >
                                        {isTestingAi ? "Testing..." : "Test Connection"}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAiSettings(false)}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-white/50 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Main Message Scroll Container ── */}
                <div className="flex-1 overflow-hidden relative flex flex-col">
                    <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5 sm:py-6 space-y-6 custom-scrollbar scroll-smooth">
                        {messages.length === 0 && !isTyping && (
                            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-6">
                                {ideaDetails ? (
                                    /* ── Idea-Aware Project Briefing ── */
                                    <>
                                        <div className="w-full p-4.5 rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.01] border border-white/12 backdrop-blur-xl mb-5 text-left space-y-2.5 shadow-2xl">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-white text-[14px] font-black tracking-wide">
                                                    {ideaDetails.ideaMetadata?.ideaName || 'Active Workspace Project'}
                                                </h2>
                                                {ideaDetails.ideaMetadata?.category && (
                                                    <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-400/30 text-[8.5px] font-mono font-bold text-cyan-300 tracking-wider uppercase">
                                                        {ideaDetails.ideaMetadata.category}
                                                    </span>
                                                )}
                                            </div>
                                            {ideaDetails.ideaMetadata?.tagline && (
                                                <p className="text-white/70 text-[11.5px] italic font-medium">
                                                    {ideaDetails.ideaMetadata.tagline}
                                                </p>
                                            )}
                                            {ideaDetails.ideaMetadata?.summary && (
                                                <p className="text-white/50 text-[11px] leading-relaxed line-clamp-3 font-normal">
                                                    {ideaDetails.ideaMetadata.summary}
                                                </p>
                                            )}
                                        </div>

                                        <p className="text-cyan-300 text-[10px] font-black tracking-widest uppercase mb-3 text-left w-full pl-1">
                                            SUGGESTED DIRECTIVES
                                        </p>

                                        {/* Suggested Prompt Chips (2-column structured grid) */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                                            {dynamicQuickPrompts.map((prompt, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                                                    className="p-3 rounded-xl text-[11px] leading-snug font-medium bg-white/[0.04] hover:bg-cyan-500/10 text-white/80 hover:text-white border border-white/10 hover:border-cyan-400/40 transition-all active:scale-[0.98] shadow-sm text-left flex items-start gap-2 cursor-pointer group"
                                                >
                                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 mt-1 flex-shrink-0 group-hover:scale-125 transition-transform" />
                                                    <span className="line-clamp-2">{prompt}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    /* ── Generic Neural Link Ready ── */
                                    <>
                                        <div className="w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center mb-3">
                                            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-ping" />
                                        </div>
                                        <h2 className="text-white text-[14px] font-black tracking-[0.2em] uppercase mb-2">
                                            Neural Copilot Active
                                        </h2>
                                        <p className="text-white/50 text-[11.5px] leading-relaxed mb-5 font-medium max-w-sm">
                                            Full workspace synchronization active. Ready to synthesize architecture, schemas, and UI components.
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                                            {dynamicQuickPrompts.map((prompt, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                                                    className="p-3 rounded-xl text-[11px] leading-snug font-medium bg-white/[0.04] hover:bg-cyan-500/10 text-white/80 hover:text-white border border-white/10 hover:border-cyan-400/40 transition-all active:scale-[0.98] shadow-sm text-left flex items-start gap-2 cursor-pointer group"
                                                >
                                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 mt-1 flex-shrink-0 group-hover:scale-125 transition-transform" />
                                                    <span className="line-clamp-2">{prompt}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ── Message Stream ── */}
                        {messages.map((msg, idx) => {
                            const displayContent = msg.content
                                .replace(/<summary>[\s\S]*?<\/summary>/g, '')
                                .replace(/\*\*Summary:\*\*[\s\S]*?$/i, '')
                                .replace(/Summary:[\s\S]*?$/i, '')
                                .trim();

                            return (
                                <div
                                    key={idx}
                                    className={`flex gap-3 group animate-in fade-in slide-in-from-bottom-3 duration-300 ease-out ${
                                        msg.role === "user" ? "flex-row-reverse" : "flex-row"
                                    }`}
                                >
                                    {/* Avatar */}
                                    {msg.role === "user" ? (
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-black tracking-wider bg-white text-neutral-950 shadow-md">
                                            YOU
                                        </div>
                                    ) : (
                                        <AkashaPetAvatar size={32} pulse={idx === messages.length - 1 && isTyping} />
                                    )}

                                    {/* Bubble + Metadata */}
                                    <div className={`flex flex-col gap-1.5 max-w-[92%] sm:max-w-[88%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                        {/* Assistant Label Header */}
                                        {msg.role === "ai" && (
                                            <div className="flex items-center gap-2 pl-1 select-none">
                                                <span className="text-[10.5px] font-black tracking-widest text-cyan-400 uppercase">
                                                    {activeAgent.name.toUpperCase()}
                                                </span>
                                                <span className="text-[8.5px] font-mono text-white/35 uppercase">
                                                    {currentContext}
                                                </span>
                                            </div>
                                        )}

                                        {/* Content Bubble */}
                                        <div
                                                className={`px-4 py-3.5 rounded-2xl text-[13px] leading-[1.7] transition-all shadow-sm ${
                                                msg.role === "user"
                                                    ? "bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-white/[0.04] border border-cyan-400/25 text-white rounded-tr-md shadow-[0_8px_24px_rgba(8,145,178,0.12)]"
                                                    : "bg-[#0b101c]/95 border border-white/[0.12] text-slate-100 rounded-tl-md prose prose-invert prose-p:leading-7 prose-headings:font-bold prose-headings:tracking-tight prose-a:text-cyan-300 prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-li:marker:text-cyan-300 max-w-full shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
                                            }`}
                                        >
                                            {msg.role === "ai" && msg.structured ? (
                                                <StructuredAiResponseCard response={msg.structured} compact />
                                            ) : msg.role === "ai" ? (
                                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
                                                    {displayContent}
                                                </ReactMarkdown>
                                            ) : (
                                                displayContent
                                            )}
                                        </div>

                                        {/* AI Response Action Toolbar */}
                                        {msg.role === "ai" && (
                                            <div className="flex items-center gap-2.5 pl-1 pt-0.5 opacity-70 sm:opacity-0 group-hover:opacity-100 transition-all duration-200 select-none">
                                                <button
                                                    type="button"
                                                    onClick={() => copyToClipboard(displayContent, (fb) => setCopyFeedback(p => ({ ...p, [idx]: fb })))}
                                                    className="inline-flex items-center text-[9px] font-mono font-bold text-white/40 hover:text-cyan-300 transition-colors uppercase tracking-widest cursor-pointer"
                                                >
                                                    {copyFeedback[idx] ? (
                                                        <span className="text-emerald-400 font-bold">COPIED</span>
                                                    ) : (
                                                        "COPY"
                                                    )}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => { setInput(displayContent); inputRef.current?.focus(); }}
                                                    className="inline-flex items-center text-[9px] font-mono font-bold text-white/40 hover:text-cyan-300 transition-colors uppercase tracking-widest cursor-pointer"
                                                >
                                                    EDIT
                                                </button>

                                                {/* Reaction Rating Buttons */}
                                                <div className="flex gap-1 items-center pl-1.5 border-l border-white/10">
                                                    <button
                                                        type="button"
                                                        onClick={() => setReactions(p => ({ ...p, [idx]: p[idx] === 'up' ? null : 'up' }))}
                                                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                                                            reactions[idx] === 'up'
                                                                ? 'bg-emerald-500/20 text-emerald-400 font-black'
                                                                : 'text-white/30 hover:text-emerald-400'
                                                        }`}
                                                        title="Helpful"
                                                    >
                                                        Helpful
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setReactions(p => ({ ...p, [idx]: p[idx] === 'down' ? null : 'down' }))}
                                                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                                                            reactions[idx] === 'down'
                                                                ? 'bg-rose-500/20 text-rose-400 font-black'
                                                                : 'text-white/30 hover:text-rose-400'
                                                        }`}
                                                        title="Needs Improvement"
                                                    >
                                                        Improve
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Direct Page Action Suggestions on Latest AI Response */}
                                        {msg.role === "ai" && idx === messages.length - 1 && currentContext === "builder" && (
                                            <div className="flex flex-wrap gap-1.5 pt-1 pl-1">
                                                <button
                                                    type="button"
                                                    onClick={() => runAgentAction({ id: "act-sitemap-gen", label: "Synthesize Sitemap", description: "Run autonomous sitemap synthesis", type: "page-action", pageAction: "GENERATE_PAGES" })}
                                                    className="px-2.5 py-1 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-[9.5px] font-semibold flex items-center transition-all cursor-pointer"
                                                >
                                                    <span>Synthesize Sitemap</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => runAgentAction({ id: "act-compile-all", label: "Compile Wireframes", description: "Batch compile AI wireframes", type: "page-action", pageAction: "COMPILE_ALL" })}
                                                    className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-400/40 text-white/80 hover:text-emerald-200 text-[9.5px] font-semibold flex items-center transition-all cursor-pointer"
                                                >
                                                    <span>Compile Wireframes</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => runAgentAction({ id: "act-open-editor", label: "Open Live Editor", description: "Switch to live editor", type: "page-action", pageAction: "SET_STEP", payload: 2 })}
                                                    className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-indigo-500/15 border border-white/10 hover:border-indigo-400/40 text-white/80 hover:text-indigo-200 text-[9.5px] font-semibold flex items-center transition-all cursor-pointer"
                                                >
                                                    <span>Open Live Editor</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Typing / Synthesizing State */}
                        {isTyping && (
                            <div className="flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <AkashaPetAvatar size={32} isThinking={true} />
                                <div className="px-4 py-3 rounded-2xl bg-[#0b101c]/90 border border-cyan-400/25 flex items-center gap-3 shadow-md">
                                    <div className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </div>
                                    <span className="text-[11px] text-cyan-300 font-mono font-bold tracking-wider uppercase">
                                        Synthesizing architecture...
                                    </span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* ── Autonomous Agent Actions Strip ── */}
                    <div className="px-4 sm:px-5 pt-3 pb-2 bg-[#060913]/95 border-t border-cyan-500/20 backdrop-blur-xl">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
                                <span className="text-[9.5px] font-mono font-black tracking-widest text-cyan-300 uppercase">
                                    AUTONOMOUS AGENT • {currentContext.toUpperCase()}
                                </span>
                            </div>
                            <span className="text-[8.5px] font-mono text-white/40">
                                Click or type to trigger
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                            {(CONTEXT_AGENT_ACTIONS[currentContext] || CONTEXT_AGENT_ACTIONS.dashboard || []).map((action) => (
                                <button
                                    key={action.id}
                                    type="button"
                                    onClick={() => runAgentAction(action)}
                                    title={action.description}
                                    className="px-2.5 py-1.5 rounded-lg bg-white/[0.045] hover:bg-cyan-500/15 border border-white/10 hover:border-cyan-400/40 text-white/80 hover:text-cyan-200 text-[10px] font-semibold tracking-tight transition-all duration-150 shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
                                >
                                    <span>{action.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── High-End Command Console (Input) ── */}
                    <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-[#070b14]/95 backdrop-blur-2xl border-t border-white/[0.08]">
                        <div className="relative group">
                            <div className="relative flex items-end gap-2 bg-white/[0.045] border border-white/10 rounded-xl p-2 pl-3.5 shadow-xl focus-within:border-cyan-400/50 focus-within:bg-[#0c1322] transition-all">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    placeholder={`Message Akasha (${CONTEXTS.find(c => c.id === currentContext)?.label})...`}
                                    rows={2}
                                    className="flex-1 min-h-[42px] max-h-56 bg-transparent border-none py-2 text-[13px] text-white placeholder:text-white/30 focus:ring-0 focus:outline-none resize-y font-sans"
                                />

                                <div className="flex items-center gap-2 pb-1 pr-1">
                                    <button
                                        type="button"
                                        onClick={handleClearChat}
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-white/35 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                                        title="Clear Memory"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleSend}
                                        disabled={!input.trim() || isTyping}
                                        className="inline-flex items-center justify-center w-9 h-8 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-[0_0_16px_rgba(6,182,212,0.35)]"
                                        title="Send message"
                                    >
                                        <Send className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {agentToDelete && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="delete-agent-title"
                            className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0d1424] p-5 text-white shadow-2xl"
                        >
                            <h2 id="delete-agent-title" className="text-sm font-bold">Delete chat window?</h2>
                            <p className="mt-2 text-xs leading-relaxed text-white/55">
                                This will delete <span className="font-semibold text-white/85">{agentToDelete.name}</span> and its chat history.
                            </p>
                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAgentToDelete(null)}
                                    className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmDeleteAgent}
                                    className="rounded-lg border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-500/25"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <style>{`
                    @keyframes chat-in-right { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
                    @keyframes chat-in-left { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
                    @keyframes chat-in-mobile { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                    .animate-chat-in-right { animation: chat-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
                    .animate-chat-in-left { animation: chat-in-left 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
                    .animate-chat-in-mobile { animation: chat-in-mobile 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
                    .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.25); }
                    ::selection { background: rgba(34, 211, 238, 0.25); color: white; }
                    .scrollbar-none::-webkit-scrollbar { display: none; }
                `}</style>
            </div>
        </div>
    );
};

export default BotChat;

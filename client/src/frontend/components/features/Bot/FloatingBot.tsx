/**
 * FloatingBot — Akasha Sacred Geometry AI Assistant Avatar
 *
 * Features:
 *  • Multi-layered SVG sacred-geometry avatar with rotating ring, orbital particles, glowing core
 *  • Context badge showing current page
 *  • Radial quick-action menu (right-click)
 *  • Edge snapping on drag end
 *  • Ctrl+Shift+A keyboard shortcut to toggle chat
 *  • Idle tip bubbles every 45s
 *  • State-based animations (idle / hover / dragging / thinking)
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import BotChat from "./BotChat";
import CyberPet from "./CyberPet";
import { useProjectStore } from "../../../hooks/useProjectStore";
import { setActivePage } from "../../../stores/projectStore";

/* ──────────────────────────── Constants ──────────────────────────── */

const PAGE_LABELS: Record<string, string> = {
    dashboard: "DASHBOARD",
    idea: "IDEA",
    ui: "UI",
    usecases: "USECASES",
    apis: "API",
    database: "DATABASE",
    diagrams: "DIAGRAMS",
    code: "CODE",
    git: "GIT",
    settings: "SETTINGS",
};

const DEFAULT_TIPS: Record<string, string> = {
    dashboard: "Need help planning your next step?",
    database: "Want me to optimize your schema?",
    apis: "I can generate API endpoints for you",
    ui: "Let me help design your UI components",
    code: "I can review your code structure",
    diagrams: "Need help with your architecture diagram?",
    idea: "Refine your idea with AI-powered analysis",
    settings: "Configure your project preferences",
    usecases: "Map out your system use cases",
};
const DEFAULT_TIP = "Ask me anything about your project!";

const SNAP_THRESHOLD = 40;
const SNAP_PADDING = 16;
const TIP_INTERVAL_MS = 45_000;
const TIP_VISIBLE_MS = 5_000;

/* ──────────────────────────── Styles ──────────────────────────── */

const INJECTED_STYLES = `
/* ── Ring rotation ─────────────────────────────── */
@keyframes akasha-ring-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* ── Breathing scale ──────────────────────────── */
@keyframes akasha-breathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.03); }
}

/* ── Core pulse ────────────────────────────────── */
@keyframes akasha-core-pulse {
  0%, 100% { opacity: 0.85; r: 6; }
  50%      { opacity: 1;    r: 7; }
}

/* ── Orbital particles ─────────────────────────── */
@keyframes akasha-orbit-1 {
  from { transform: rotate(0deg)   translateX(32px) rotate(0deg);   }
  to   { transform: rotate(360deg) translateX(32px) rotate(-360deg); }
}
@keyframes akasha-orbit-2 {
  from { transform: rotate(120deg)  translateX(36px) rotate(-120deg);  }
  to   { transform: rotate(480deg)  translateX(36px) rotate(-480deg);  }
}
@keyframes akasha-orbit-3 {
  from { transform: rotate(240deg)  translateX(30px) rotate(-240deg);  }
  to   { transform: rotate(600deg)  translateX(30px) rotate(-600deg);  }
}

/* ── Radial menu item entrance ─────────────────── */
@keyframes akasha-menu-pop {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
  70%  { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

/* ── Tip bubble ────────────────────────────────── */
@keyframes akasha-tip-in {
  from { opacity: 0; transform: translateY(6px) scale(0.92); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
@keyframes akasha-tip-out {
  from { opacity: 1; transform: translateY(0)   scale(1); }
  to   { opacity: 0; transform: translateY(6px) scale(0.92); }
}

/* ── Thinking color-shift ──────────────────────── */
@keyframes akasha-think-hue {
  0%   { filter: hue-rotate(0deg);   }
  50%  { filter: hue-rotate(55deg);  }
  100% { filter: hue-rotate(0deg);   }
}
`;

/* ──────────────────────────── Component ──────────────────────────── */

interface FloatingBotProps {
    isThinking?: boolean;
}

const FloatingBot: React.FC<FloatingBotProps> = ({ isThinking = false }) => {
    const { project, activePage } = useProjectStore();

    /* ── core state ──────────────────────────────── */
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: -1, y: -1 });
    const [isDragging, setIsDragging] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    /* ── radial menu ─────────────────────────────── */
    const [menuOpen, setMenuOpen] = useState(false);
    const [ideaPopover, setIdeaPopover] = useState(false);

    /* ── remote open / prompt triggers ──────────── */
    const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
    const [initialContext, setInitialContext] = useState<string | null>(null);
    const [openSettings, setOpenSettings] = useState(false);

    /* ── tip bubble ──────────────────────────────── */
    const [tipText, setTipText] = useState<string | null>(null);
    const [tipFading, setTipFading] = useState(false);

    /* refs */
    const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
    const botRef = useRef<HTMLDivElement>(null);
    const didDrag = useRef(false);

    /* ── Listen for global akasha:open-chat custom event ── */
    useEffect(() => {
        const handleOpenChat = (e: Event) => {
            const customEvent = e as CustomEvent<{ prompt?: string; context?: string; openSettings?: boolean }>;
            setIsOpen(true);
            setMenuOpen(false);
            setIdeaPopover(false);
            if (customEvent.detail?.prompt) {
                setInitialPrompt(customEvent.detail.prompt);
            }
            if (customEvent.detail?.context) {
                setInitialContext(customEvent.detail.context);
            }
            if (customEvent.detail?.openSettings) {
                setOpenSettings(true);
            }
        };

        window.addEventListener("akasha:open-chat", handleOpenChat);
        return () => window.removeEventListener("akasha:open-chat", handleOpenChat);
    }, []);

    /* ── Inject CSS once ─────────────────────────── */
    useEffect(() => {
        const id = "akasha-floating-bot-styles";
        if (!document.getElementById(id)) {
            const style = document.createElement("style");
            style.id = id;
            style.textContent = INJECTED_STYLES;
            document.head.appendChild(style);
        }
    }, []);

    /* ── Initialise position ─────────────────────── */
    useEffect(() => {
        setPosition({
            x: window.innerWidth - 80,
            y: window.innerHeight - 80,
        });
    }, []);

    /* ──────────────── Dragging ──────────────────── */
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (e.button === 2) return; // ignore right-click
            e.preventDefault();
            didDrag.current = false;
            setIsDragging(true);
            dragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                startPosX: position.x,
                startPosY: position.y,
            };
        },
        [position],
    );

    const snapToEdge = useCallback((pos: { x: number; y: number }) => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        let { x, y } = pos;

        if (x < SNAP_THRESHOLD + SNAP_PADDING) x = SNAP_PADDING + 28;
        else if (x > w - SNAP_THRESHOLD - SNAP_PADDING) x = w - SNAP_PADDING - 28;

        if (y < SNAP_THRESHOLD + SNAP_PADDING) y = SNAP_PADDING + 28;
        else if (y > h - SNAP_THRESHOLD - SNAP_PADDING) y = h - SNAP_PADDING - 28;

        return { x, y };
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !dragRef.current) return;
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                didDrag.current = true;
            }

            const newX = Math.max(30, Math.min(window.innerWidth - 30, dragRef.current.startPosX + dx));
            const newY = Math.max(30, Math.min(window.innerHeight - 30, dragRef.current.startPosY + dy));
            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            if (isDragging) {
                setPosition((prev) => snapToEdge(prev));
            }
            setIsDragging(false);
            dragRef.current = null;
        };

        if (isDragging) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging, snapToEdge]);

    /* ── Click → toggle chat ─────────────────────── */
    const handleClick = useCallback(() => {
        if (!didDrag.current) {
            setIsOpen((prev) => !prev);
            setMenuOpen(false);
            setIdeaPopover(false);
        }
    }, []);

    /* ── Right-click → radial menu ───────────────── */
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setMenuOpen((prev) => !prev);
        setIdeaPopover(false);
    }, []);

    /* ── Close menu on Escape or outside click ───── */
    useEffect(() => {
        if (!menuOpen && !ideaPopover) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setMenuOpen(false);
                setIdeaPopover(false);
            }
        };
        const onClick = (e: MouseEvent) => {
            if (botRef.current && !botRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
                setIdeaPopover(false);
            }
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("mousedown", onClick);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("mousedown", onClick);
        };
    }, [menuOpen, ideaPopover]);

    /* ── Ctrl+Shift+A keyboard shortcut ──────────── */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && (e.key === "a" || e.key === "A")) {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    /* ── Idea metadata ───────────────────────────── */
    const ideaMeta = project?.settings?.ideaDetails?.ideaMetadata as
        | { ideaName?: string; tagline?: string; summary?: string }
        | undefined;
    const coreFeatures = project?.settings?.ideaDetails?.product?.coreFeatures as string[] | undefined;
    const coreInnovation = project?.settings?.ideaDetails?.solution?.coreInnovation as string | undefined;

    /* ── Idle tip bubbles (idea-aware) ───────────── */
    const getTip = useCallback(() => {
        if (coreFeatures?.[0] && Math.random() > 0.6) {
            return `Try asking about ${coreFeatures[0]} implementation`;
        }
        if (coreInnovation && Math.random() > 0.5) {
            return `How should we build ${coreInnovation}?`;
        }
        return DEFAULT_TIPS[activePage] ?? DEFAULT_TIP;
    }, [activePage, coreFeatures, coreInnovation]);

    useEffect(() => {
        if (isOpen || isDragging) return;

        const interval = setInterval(() => {
            const tip = getTip();
            setTipText(tip);
            setTipFading(false);

            const fadeTimer = setTimeout(() => setTipFading(true), TIP_VISIBLE_MS - 600);
            const hideTimer = setTimeout(() => {
                setTipText(null);
                setTipFading(false);
            }, TIP_VISIBLE_MS);

            return () => {
                clearTimeout(fadeTimer);
                clearTimeout(hideTimer);
            };
        }, TIP_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [isOpen, isDragging, getTip]);

    /* ── Radial menu items ───────────────────────── */
    const menuItems = useMemo(
        () => [
            {
                label: "CHAT",
                angle: -90,
                action: () => {
                    setIsOpen(true);
                    setMenuOpen(false);
                },
            },
            {
                label: "IDEA",
                angle: -30,
                action: () => {
                    setIdeaPopover(true);
                    setMenuOpen(false);
                },
            },
            {
                label: "TASKS",
                angle: 30,
                action: () => {
                    setActivePage("team");
                    setMenuOpen(false);
                },
            },
            {
                label: "PLAN",
                angle: 90,
                action: () => {
                    setActivePage("idea");
                    setMenuOpen(false);
                },
            },
            {
                label: "DIAG",
                angle: 150,
                action: () => {
                    setActivePage("diagrams");
                    setMenuOpen(false);
                },
            },
            {
                label: "SETT",
                angle: 210,
                action: () => {
                    setActivePage("settings");
                    setMenuOpen(false);
                },
            },
        ],
        [],
    );

    /* ── Derived animation values ─────────────────── */
    const avatarScale = isDragging ? 1.05 : isHovered ? 1.08 : 1;

    /* ── Context badge text ──────────────────────── */
    const badgeText = PAGE_LABELS[activePage] ?? "GLOBAL";

    /* ── Don't render until position is initialised ─ */
    if (position.x === -1) return null;

    return (
        <>
            {/* ───── Floating Avatar (Standalone CyberPet - NO BAR) ───── */}
            {!isOpen && (
                <div
                    ref={botRef}
                    className={`fixed z-[9999] select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                    style={{
                        left: position.x - 27,
                        top: position.y - 27,
                        transition: isDragging ? "none" : "left 0.4s cubic-bezier(.34,1.56,.64,1), top 0.4s cubic-bezier(.34,1.56,.64,1)",
                    }}
                    onMouseDown={handleMouseDown}
                    onClick={handleClick}
                    onContextMenu={handleContextMenu}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    {/* ── Standalone Animated CyberPet (NO BAR) ── */}
                    <div
                        className="relative flex items-center justify-center group cursor-pointer"
                        style={{
                            transform: `scale(${avatarScale})`,
                        }}
                    >
                        {/* Ambient levitation shadow pool under pet */}
                        <div
                            className="absolute -bottom-2.5 w-10 h-2.5 rounded-full bg-cyan-500/25 blur-xs pet-shadow-pool pointer-events-none"
                            style={{
                                transform: isHovered ? "scale(1.2) translateY(2px)" : "scale(1)",
                            }}
                        />

                        {/* Ambient Ethereal Glow Aura */}
                        <div
                            className="absolute -inset-3 rounded-full bg-cyan-400/20 blur-xl transition-opacity duration-300 pointer-events-none"
                            style={{ opacity: isHovered ? 0.9 : 0.45 }}
                        />

                        {/* Standalone CyberPet Companion */}
                        <CyberPet
                            isThinking={isThinking}
                            isHovered={isHovered}
                            size={54}
                        />

                        {/* Online Status Indicator Node */}
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#090d16] shadow-[0_0_8px_#34d399] flex items-center justify-center pointer-events-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping opacity-75" />
                        </span>

                        {/* Sleek Context Micro-Badge on Hover */}
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/90 border border-white/20 text-[9px] font-black tracking-widest text-cyan-300 uppercase whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none">
                            AKASHA • {badgeText}
                        </div>
                    </div>

                    {/* ── Tip bubble ── */}
                    {tipText && (
                        <div
                            className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
                            style={{
                                bottom: 62,
                                animation: tipFading
                                    ? "akasha-tip-out 0.5s ease forwards"
                                    : "akasha-tip-in 0.4s ease forwards",
                            }}
                        >
                            <div
                                className="relative rounded-xl px-3.5 py-2 text-[11px] font-medium text-neutral-900 dark:text-white whitespace-nowrap shadow-xl backdrop-blur-xl saturate-[200%] bg-white/95 dark:bg-neutral-900/95 border border-black/[0.08] dark:border-white/15"
                                style={{
                                    maxWidth: 240,
                                    whiteSpace: "normal",
                                    textAlign: "center",
                                }}
                            >
                                {tipText}
                            </div>
                        </div>
                    )}

                    {/* ── Radial quick-action menu ── */}
                    {menuOpen && (
                        <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
                            {menuItems.map((item, idx) => {
                                const rad = (item.angle * Math.PI) / 180;
                                const dist = 65;
                                const cx = dist * Math.cos(rad);
                                const cy = dist * Math.sin(rad);
                                return (
                                    <button
                                        key={item.label}
                                        title={item.label}
                                        className="absolute flex items-center justify-center rounded-full shadow-lg hover:scale-110 active:scale-95 transition-transform duration-150 backdrop-blur-[20px] saturate-[200%] bg-white/90 dark:bg-[#0f172a]/90 border border-black/[0.08] dark:border-white/15 text-neutral-900 dark:text-white font-black text-[9px] tracking-wider cursor-pointer"
                                        style={{
                                            width: 36,
                                            height: 36,
                                            left: `calc(50% + ${cx}px)`,
                                            top: `calc(50% + ${cy}px)`,
                                            transform: "translate(-50%, -50%)",
                                            pointerEvents: "auto",
                                            animation: `akasha-menu-pop 0.35s cubic-bezier(.34,1.56,.64,1) ${idx * 0.06}s both`,
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            item.action();
                                        }}
                                    >
                                        <span>{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Idea popover ── */}
                    {ideaPopover && (
                        <div
                            className="absolute z-10 rounded-2xl shadow-2xl p-4 backdrop-blur-[24px] saturate-[200%] bg-white/95 dark:bg-neutral-900/95 border border-black/[0.08] dark:border-white/15 text-neutral-900 dark:text-white"
                            style={{
                                width: 240,
                                right: 110,
                                top: -20,
                                animation: "akasha-tip-in 0.3s ease forwards",
                                pointerEvents: "auto",
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <div className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-1.5">
                                Project Idea
                            </div>
                            {ideaMeta ? (
                                <>
                                    <div className="text-[11px] font-bold text-neutral-900 dark:text-white mb-0.5">
                                        {ideaMeta.ideaName || project?.name || "Untitled"}
                                    </div>
                                    {ideaMeta.tagline && (
                                        <div className="text-[10px] italic text-neutral-600 dark:text-neutral-400 mb-1">
                                            {ideaMeta.tagline}
                                        </div>
                                    )}
                                    {ideaMeta.summary && (
                                        <div className="text-[10px] text-neutral-700 dark:text-neutral-300 leading-snug line-clamp-4">
                                            {ideaMeta.summary}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                                    No idea details yet. Start with the Idea page!
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ───── Chat Panel ───── */}
            {isOpen && (
                <BotChat
                    onClose={() => {
                        setIsOpen(false);
                        setInitialPrompt(null);
                        setInitialContext(null);
                        setOpenSettings(false);
                    }}
                    projectId={project?.id || null}
                    projectName={project?.name || null}
                    anchorX={position.x}
                    anchorY={position.y}
                    initialPrompt={initialPrompt}
                    initialContext={initialContext}
                    initialOpenSettings={openSettings}
                    onClearInitialPrompt={() => setInitialPrompt(null)}
                />
            )}
        </>
    );
};

export default FloatingBot;

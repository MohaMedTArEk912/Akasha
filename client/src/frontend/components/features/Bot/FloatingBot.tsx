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

    /* ── tip bubble ──────────────────────────────── */
    const [tipText, setTipText] = useState<string | null>(null);
    const [tipFading, setTipFading] = useState(false);

    /* refs */
    const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
    const botRef = useRef<HTMLDivElement>(null);
    const didDrag = useRef(false);

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
                icon: "💬",
                label: "Chat",
                angle: -90,
                action: () => {
                    setIsOpen(true);
                    setMenuOpen(false);
                },
            },
            {
                icon: "💡",
                label: "Idea",
                angle: -30,
                action: () => {
                    setIdeaPopover(true);
                    setMenuOpen(false);
                },
            },
            {
                icon: "📋",
                label: "Tasks",
                angle: 30,
                action: () => {
                    setActivePage("team");
                    setMenuOpen(false);
                },
            },
            {
                icon: "🧭",
                label: "Navigate",
                angle: 90,
                action: () => {
                    setActivePage("idea");
                    setMenuOpen(false);
                },
            },
            {
                icon: "🗺️",
                label: "Diagrams",
                angle: 150,
                action: () => {
                    setActivePage("diagrams");
                    setMenuOpen(false);
                },
            },
            {
                icon: "⚙️",
                label: "Settings",
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
    const ringDuration = isThinking ? "2s" : isHovered ? "8s" : "20s";
    const breatheAnim = isDragging ? "none" : "akasha-breathe 4s ease-in-out infinite";
    const thinkAnim = isThinking ? "akasha-think-hue 2s ease-in-out infinite" : "none";
    const avatarScale = isDragging ? 1.1 : isHovered ? 1.15 : 1;

    /* ── Context badge text ──────────────────────── */
    const badgeText = PAGE_LABELS[activePage] ?? "GLOBAL";

    /* ── Don't render until position is initialised ─ */
    if (position.x === -1) return null;

    return (
        <>
            {/* ───── Floating Avatar ───── */}
            {!isOpen && (
                <div
                    ref={botRef}
                    className={`fixed z-[9999] select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                    style={{
                        left: position.x - 40,
                        top: position.y - 40,
                        width: 80,
                        height: 80,
                        transition: isDragging ? "none" : "left 0.4s cubic-bezier(.34,1.56,.64,1), top 0.4s cubic-bezier(.34,1.56,.64,1)",
                    }}
                    onMouseDown={handleMouseDown}
                    onClick={handleClick}
                    onContextMenu={handleContextMenu}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    {/* ── Ambient glow ── */}
                    <div
                        className="absolute rounded-full transition-all duration-500"
                        style={{
                            inset: -8,
                            background: isThinking
                                ? "radial-gradient(circle, rgba(251,191,36,0.35) 0%, transparent 70%)"
                                : "radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 70%)",
                            filter: `blur(${isHovered ? 14 : 10}px)`,
                        }}
                    />

                    {/* ── Main SVG avatar ── */}
                    <svg
                        viewBox="0 0 80 80"
                        width={80}
                        height={80}
                        className="relative"
                        style={{
                            animation: `${breatheAnim}, ${thinkAnim}`,
                            transform: `scale(${avatarScale})`,
                            transition: "transform 0.35s cubic-bezier(.34,1.56,.64,1)",
                        }}
                    >
                        <defs>
                            {/* Gradient for inner core */}
                            <radialGradient id="akasha-core-grad" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="#22d3ee" />
                                <stop offset="50%" stopColor="#8b5cf6" />
                                <stop offset="100%" stopColor="#6366f1" />
                            </radialGradient>
                            {/* Gradient for ring */}
                            <linearGradient id="akasha-ring-grad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#22d3ee" />
                                <stop offset="100%" stopColor="#6366f1" />
                            </linearGradient>
                            {/* Glow filter */}
                            <filter id="akasha-glow">
                                <feGaussianBlur stdDeviation="2.5" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                            <filter id="akasha-glow-strong">
                                <feGaussianBlur stdDeviation="4" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>

                        {/* ── Outer rotating ring with 6 nodes ── */}
                        <g
                            style={{
                                transformOrigin: "40px 40px",
                                animation: `akasha-ring-spin ${ringDuration} linear infinite`,
                            }}
                        >
                            <circle
                                cx={40}
                                cy={40}
                                r={34}
                                fill="none"
                                stroke="url(#akasha-ring-grad)"
                                strokeWidth={isDragging ? 1.2 : 1.5}
                                opacity={0.7}
                            />
                            {/* 6 evenly-spaced nodes */}
                            {[0, 60, 120, 180, 240, 300].map((deg) => {
                                const rad = (deg * Math.PI) / 180;
                                return (
                                    <circle
                                        key={deg}
                                        cx={40 + 34 * Math.cos(rad)}
                                        cy={40 + 34 * Math.sin(rad)}
                                        r={2}
                                        fill="#22d3ee"
                                        opacity={0.9}
                                        filter="url(#akasha-glow)"
                                    />
                                );
                            })}
                        </g>

                        {/* ── Inner glowing core ── */}
                        <circle
                            cx={40}
                            cy={40}
                            r={20}
                            fill="url(#akasha-core-grad)"
                            filter="url(#akasha-glow)"
                            opacity={0.95}
                        />

                        {/* ── Center "all-seeing" eye ── */}
                        <circle
                            cx={40}
                            cy={40}
                            r={6}
                            fill={isThinking ? "#fbbf24" : "#ffffff"}
                            opacity={0.9}
                            filter="url(#akasha-glow-strong)"
                            style={{ animation: "akasha-core-pulse 3s ease-in-out infinite" }}
                        />

                        {/* ── 3 orbital particles ── */}
                        <g style={{ transformOrigin: "40px 40px", animation: "akasha-orbit-1 7s linear infinite" }}>
                            <circle cx={40} cy={40} r={2.2} fill="#67e8f9" opacity={0.85} filter="url(#akasha-glow)" />
                        </g>
                        <g style={{ transformOrigin: "40px 40px", animation: "akasha-orbit-2 11s linear infinite" }}>
                            <circle cx={40} cy={40} r={1.8} fill="#a78bfa" opacity={0.8} filter="url(#akasha-glow)" />
                        </g>
                        <g style={{ transformOrigin: "40px 40px", animation: "akasha-orbit-3 9s linear infinite" }}>
                            <circle cx={40} cy={40} r={1.5} fill="#818cf8" opacity={0.75} filter="url(#akasha-glow)" />
                        </g>
                    </svg>

                    {/* ── Context badge ── */}
                    {!isDragging && (
                        <div
                            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5"
                            style={{ top: 78 }}
                        >
                            <span
                                className="whitespace-nowrap uppercase tracking-[0.18em] font-bold"
                                style={{
                                    fontSize: 7,
                                    color: "rgba(255,255,255,0.5)",
                                    letterSpacing: "0.18em",
                                }}
                            >
                                AKASHA
                            </span>
                            <span
                                className="whitespace-nowrap rounded-full px-2 py-[1px] uppercase tracking-[0.14em] font-semibold"
                                style={{
                                    fontSize: 7,
                                    background: "rgba(255,255,255,0.07)",
                                    backdropFilter: "blur(8px)",
                                    WebkitBackdropFilter: "blur(8px)",
                                    border: "1px solid rgba(255,255,255,0.10)",
                                    color: "rgba(255,255,255,0.45)",
                                }}
                            >
                                {badgeText}
                            </span>
                        </div>
                    )}

                    {/* ── Tip bubble ── */}
                    {tipText && (
                        <div
                            className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
                            style={{
                                bottom: 90,
                                animation: tipFading
                                    ? "akasha-tip-out 0.5s ease forwards"
                                    : "akasha-tip-in 0.4s ease forwards",
                            }}
                        >
                            <div
                                className="relative rounded-lg px-3 py-2 text-[11px] font-medium text-white/90 whitespace-nowrap shadow-lg"
                                style={{
                                    background: "rgba(15,23,42,0.85)",
                                    backdropFilter: "blur(12px)",
                                    WebkitBackdropFilter: "blur(12px)",
                                    border: "1px solid rgba(255,255,255,0.10)",
                                    maxWidth: 220,
                                    whiteSpace: "normal",
                                    textAlign: "center",
                                }}
                            >
                                {tipText}
                                {/* Caret */}
                                <div
                                    className="absolute left-1/2 -translate-x-1/2"
                                    style={{
                                        bottom: -5,
                                        width: 0,
                                        height: 0,
                                        borderLeft: "5px solid transparent",
                                        borderRight: "5px solid transparent",
                                        borderTop: "5px solid rgba(15,23,42,0.85)",
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Radial quick-action menu ── */}
                    {menuOpen && (
                        <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
                            {menuItems.map((item, idx) => {
                                const rad = (item.angle * Math.PI) / 180;
                                const dist = 60;
                                const cx = 40 + dist * Math.cos(rad);
                                const cy = 40 + dist * Math.sin(rad);
                                return (
                                    <button
                                        key={item.label}
                                        title={item.label}
                                        className="absolute flex items-center justify-center rounded-full shadow-lg hover:scale-110 transition-transform duration-150"
                                        style={{
                                            width: 32,
                                            height: 32,
                                            left: cx,
                                            top: cy,
                                            transform: "translate(-50%, -50%)",
                                            background: "rgba(15,23,42,0.88)",
                                            backdropFilter: "blur(12px)",
                                            WebkitBackdropFilter: "blur(12px)",
                                            border: "1px solid rgba(255,255,255,0.12)",
                                            cursor: "pointer",
                                            fontSize: 14,
                                            pointerEvents: "auto",
                                            animation: `akasha-menu-pop 0.35s cubic-bezier(.34,1.56,.64,1) ${idx * 0.06}s both`,
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            item.action();
                                        }}
                                    >
                                        {item.icon}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Idea popover ── */}
                    {ideaPopover && (
                        <div
                            className="absolute z-10 rounded-xl shadow-2xl p-3"
                            style={{
                                width: 220,
                                right: 86,
                                top: -10,
                                background: "rgba(15,23,42,0.92)",
                                backdropFilter: "blur(16px)",
                                WebkitBackdropFilter: "blur(16px)",
                                border: "1px solid rgba(255,255,255,0.10)",
                                animation: "akasha-tip-in 0.3s ease forwards",
                                pointerEvents: "auto",
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 mb-1.5">
                                Project Idea
                            </div>
                            {ideaMeta ? (
                                <>
                                    <div className="text-[11px] font-semibold text-white/90 mb-0.5">
                                        {ideaMeta.ideaName || project?.name || "Untitled"}
                                    </div>
                                    {ideaMeta.tagline && (
                                        <div className="text-[10px] italic text-white/50 mb-1">
                                            {ideaMeta.tagline}
                                        </div>
                                    )}
                                    {ideaMeta.summary && (
                                        <div className="text-[10px] text-white/60 leading-snug line-clamp-4">
                                            {ideaMeta.summary}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-[10px] text-white/40">
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
                    onClose={() => setIsOpen(false)}
                    projectId={project?.id || null}
                    projectName={project?.name || null}
                    anchorX={position.x}
                    anchorY={position.y}
                />
            )}
        </>
    );
};

export default FloatingBot;

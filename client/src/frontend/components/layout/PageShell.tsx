/**
 * PageShell — Unified Daylight Architectural Surface, Header & Animated Tab System
 */

import React, { useEffect, useId, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { fetchProviderStatus, type ProviderHealth } from "../../services/akashaV2Service";
import { setActivePage } from "../../stores/projectStore";

export interface PageShellTab {
  id: string;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

interface PageShellProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  tabs?: PageShellTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  showAiStatus?: boolean;
  fullBleed?: boolean;
  children: React.ReactNode;
}

export const PageShell: React.FC<PageShellProps> = ({
  title,
  subtitle,
  actions,
  tabs,
  activeTab,
  onTabChange,
  showAiStatus = true,
  fullBleed = false,
  children,
}) => {
  const [aiHealth, setAiHealth] = useState<ProviderHealth | null>(null);
  const tabGroupId = useId();

  useEffect(() => {
    if (!showAiStatus) return;
    let mounted = true;
    fetchProviderStatus()
      .then((h) => {
        if (mounted) setAiHealth(h);
      })
      .catch(() => null);
    return () => {
      mounted = false;
    };
  }, [showAiStatus]);

  const tabContentKey = tabs && activeTab ? activeTab : "main";

  return (
    <div className="h-full w-full flex flex-col overflow-hidden studio-canvas-textured text-[var(--ide-text)]">
      {/* Clean Editorial Page Header */}
      <header className="flex-shrink-0 px-6 pt-5 pb-0 border-b border-[var(--ide-border)] bg-[var(--ide-bg-elevated)] shadow-[0_1px_2px_rgba(11,18,32,0.04)]">
        <div className="max-w-7xl mx-auto">
          <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${tabs && tabs.length > 0 ? "pb-4" : "pb-5"}`}>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl md:text-[22px] font-bold tracking-[-0.025em] text-[var(--ide-text)] truncate">
                  {title}
                </h1>
                {showAiStatus && aiHealth && (
                  <button
                    type="button"
                    onClick={() => setActivePage("settings")}
                    title={aiHealth.reason || `Connected to ${aiHealth.provider} (${aiHealth.model}). Click to change in Settings.`}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                      aiHealth.mode === "live"
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100/70"
                        : "bg-[var(--ide-accent-subtle)] text-[var(--ide-text-secondary)] border-[var(--ide-border)] hover:border-[var(--ide-border-strong)]"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        aiHealth.mode === "live" ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    {aiHealth.mode === "live"
                      ? `${aiHealth.provider.charAt(0).toUpperCase() + aiHealth.provider.slice(1)} connected`
                      : "Offline mode"}
                  </button>
                )}
              </div>
              {subtitle && (
                <p className="text-sm text-[var(--ide-text-secondary)] max-w-[74ch] leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>

            {actions && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {actions}
              </div>
            )}
          </div>

          {/* Smooth Animated Tab Strip */}
          {tabs && tabs.length > 0 && onTabChange && (
            <nav
              aria-label="Section tabs"
              className="flex items-center gap-1 overflow-x-auto -mb-px"
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    className={`relative px-3.5 py-2.5 text-[13px] font-semibold transition-colors duration-150 cursor-pointer whitespace-nowrap inline-flex items-center gap-2 ${
                      isActive
                        ? "text-[#1B5BFF] dark:text-[#7AA3FF]"
                        : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span
                        className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md leading-none ${
                          isActive
                            ? "bg-[#1B5BFF]/10 text-[#1B5BFF] dark:bg-[#5B8CFF]/20 dark:text-[#93B4FF]"
                            : "bg-[var(--ide-accent-subtle)] text-[var(--ide-text-muted)]"
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                    {isActive && (
                      <motion.span
                        layoutId={`tab-underline-${tabGroupId}`}
                        transition={{ type: "spring", stiffness: 460, damping: 34 }}
                        className="absolute left-2 right-2 bottom-0 h-[2px] rounded-full bg-[#1B5BFF] dark:bg-[#5B8CFF]"
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </header>

      {/* Content Canvas with Crisp Tab Crossfade */}
      {fullBleed ? (
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tabContentKey}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="h-full w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tabContentKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-7xl mx-auto space-y-6 pb-16"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default PageShell;

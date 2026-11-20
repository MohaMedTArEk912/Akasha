/**
 * FloatingBot — Clean, Light-Friendly Copilot Launcher
 * Opens the contextual AI assistant without neon/dark clutter.
 */

import React, { useState, useEffect } from "react";
import { MessageSquare, Sparkles } from "lucide-react";
import BotChat from "./BotChat";
import { useProjectStore } from "../../../hooks/useProjectStore";

interface FloatingBotProps {
  isThinking?: boolean;
}

const FloatingBot: React.FC<FloatingBotProps> = ({ isThinking = false }) => {
  const { project } = useProjectStore();
  const [isOpen, setIsOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [initialContext, setInitialContext] = useState<string | null>(null);
  const [openSettings, setOpenSettings] = useState(false);

  useEffect(() => {
    const handleOpenChat = (e: Event) => {
      const customEvent = e as CustomEvent<{
        prompt?: string;
        context?: string;
        openSettings?: boolean;
      }>;
      setIsOpen(true);
      if (customEvent.detail?.prompt) setInitialPrompt(customEvent.detail.prompt);
      if (customEvent.detail?.context) setInitialContext(customEvent.detail.context);
      if (customEvent.detail?.openSettings) setOpenSettings(true);
    };

    window.addEventListener("akasha:open-chat", handleOpenChat);
    return () => window.removeEventListener("akasha:open-chat", handleOpenChat);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="Ask Akasha Copilot (Ctrl+Shift+A)"
          className="fixed bottom-5 right-5 z-40 h-11 px-4 rounded-full bg-[#1B5BFF] hover:bg-[#1347D6] text-white shadow-[0_10px_24px_-6px_rgba(27,91,255,0.45)] flex items-center gap-2 text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer"
        >
          {isThinking ? (
            <Sparkles className="w-4 h-4 animate-pulse" />
          ) : (
            <MessageSquare className="w-4 h-4" />
          )}
          <span>Ask Copilot</span>
        </button>
      )}

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
          anchorX={typeof window !== "undefined" ? window.innerWidth - 64 : 1000}
          anchorY={typeof window !== "undefined" ? window.innerHeight - 64 : 700}
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

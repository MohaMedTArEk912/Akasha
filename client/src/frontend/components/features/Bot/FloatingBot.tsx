/**
 * FloatingBot — Draggable AI assistant avatar that appears globally
 * 
 * Click to toggle the chat panel. Drag to reposition.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import BotChat from "./BotChat";
import { useProjectStore } from "../../../hooks/useProjectStore";

const FloatingBot: React.FC = () => {
    const { project } = useProjectStore();
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: -1, y: -1 });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
    const botRef = useRef<HTMLDivElement>(null);
    const didDrag = useRef(false);

    // Initialize position to bottom-right on mount
    useEffect(() => {
        setPosition({
            x: window.innerWidth - 80,
            y: window.innerHeight - 80
        });
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        didDrag.current = false;
        setIsDragging(true);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startPosX: position.x,
            startPosY: position.y,
        };
    }, [position]);

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
    }, [isDragging]);

    const handleClick = useCallback(() => {
        if (!didDrag.current) {
            setIsOpen(prev => !prev);
        }
    }, []);

    if (position.x === -1) return null;

    return (
        <>
            {/* Floating Bot Button */}
            <div
                ref={botRef}
                className={`fixed z-[9999] select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                    left: position.x - 28,
                    top: position.y - 28,
                    transition: isDragging ? 'none' : 'box-shadow 0.3s ease',
                }}
                onMouseDown={handleMouseDown}
                onClick={handleClick}
            >
                {/* Pulse ring */}
                <div className={`absolute inset-0 rounded-full ${isOpen ? 'bg-indigo-500/20' : 'bg-cyan-500/20'} animate-ping`}
                    style={{ animationDuration: '3s' }} />

                {/* Glow */}
                <div className={`absolute -inset-2 rounded-full blur-xl ${isOpen ? 'bg-indigo-500/30' : 'bg-cyan-500/20'} transition-colors duration-500`} />

                {/* Bot body */}
                <div className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_0_30px_rgba(99,102,241,0.5)]'
                        : 'bg-gradient-to-br from-cyan-500 to-indigo-600 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]'
                    } ${isDragging ? 'scale-110' : 'hover:scale-110'}`}>
                    {/* Robot face */}
                    <div className="relative">
                        {isOpen ? (
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <div className="flex flex-col items-center">
                                {/* Eyes */}
                                <div className="flex gap-1.5 mb-0.5">
                                    <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
                                    <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
                                </div>
                                {/* Mouth */}
                                <div className="w-4 h-1.5 rounded-full border-b-2 border-white/80" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Label */}
                {!isOpen && !isDragging && (
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">AI Bot</span>
                    </div>
                )}
            </div>

            {/* Chat Panel */}
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

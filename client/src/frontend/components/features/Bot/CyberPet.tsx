/**
 * CyberPet — Animated Micro-Companion Pet with Energetic Physics & Expressive Motion
 * 
 * Features:
 * - Floating bobbing physics (idle sine-wave motion)
 * - Wiggling kinetic cyber-ears / antennae
 * - Expressive animated eyes that look around and blink
 * - Wagging cyber-tail / energy thruster
 * - Reactive states: Idle, Hovered (happy bounce & joyful eyes), Thinking (excited pulse)
 * - 100% SVG + GPU-accelerated CSS animations (Zero emojis)
 */

import React from "react";

interface CyberPetProps {
    isThinking?: boolean;
    isHovered?: boolean;
    mood?: "happy" | "curious" | "alert" | "idle";
    size?: number;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
}

export const CyberPet: React.FC<CyberPetProps> = ({
    isThinking = false,
    isHovered = false,
    mood: _mood = "idle",
    size = 24,
    className = "",
    onClick,
}) => {
    return (
        <div
            className={`cyber-pet-wrapper relative flex items-center justify-center select-none ${className}`}
            style={{ width: size, height: size }}
            title={isThinking ? "Akasha is synthesizing..." : isHovered ? "Akasha is ready!" : "Akasha Pet Companion"}
            onClick={onClick}
        >
            <svg
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`cyber-pet-svg w-full h-full overflow-visible transition-transform duration-300 ${
                    isThinking ? "pet-thinking" : isHovered ? "pet-hovered" : "pet-idle"
                }`}
            >
                <defs>
                    {/* Primary Cyber Pet Glow Gradient */}
                    <linearGradient id="petGradient" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="45%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>

                    {/* Thinking Warm Gradient */}
                    <linearGradient id="petThinkingGradient" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#f59e0b" />
                        <stop offset="50%" stopColor="#ec4899" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>

                    {/* Specular Edge Gradient */}
                    <linearGradient id="petRimGradient" x1="10" y1="8" x2="30" y2="32" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                        <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0.8" />
                    </linearGradient>

                    {/* Ambient Glow Filter */}
                    <filter id="petGlow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="1.8" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                {/* ── Outer Holographic Aura Ring ── */}
                <circle
                    cx="20"
                    cy="21"
                    r="17"
                    stroke={isThinking ? "url(#petThinkingGradient)" : "url(#petGradient)"}
                    strokeWidth="1.2"
                    strokeDasharray="4 3"
                    className="pet-aura-ring opacity-60"
                />

                {/* ── Inner Counter-Rotating Holographic Ring ── */}
                <circle
                    cx="20"
                    cy="21"
                    r="15"
                    stroke={isThinking ? "#ec4899" : "#38bdf8"}
                    strokeWidth="0.8"
                    strokeDasharray="2 6"
                    className="pet-aura-ring-inner opacity-40"
                />

                {/* ── Kinetic Thruster Flame / Wagging Tail ── */}
                <g className="pet-tail origin-[12px_26px]">
                    <path
                        d="M7 25 C 3 28, 4 33, 9 32 C 12 31, 11 27, 10 26 Z"
                        fill={isThinking ? "#f59e0b" : "#38bdf8"}
                        className="transition-colors duration-300"
                    />
                    {/* Inner flame thruster core */}
                    <path
                        d="M8 27 C 6 29, 6.5 31.5, 9 31 C 10.5 30.5, 10 28, 9.5 27.5 Z"
                        fill="#ffffff"
                        className="opacity-75"
                    />
                </g>

                {/* ── Kinetic Cyber Ears / Antennae ── */}
                {/* Left Ear */}
                <g className="pet-ear-left origin-[14px_14px]">
                    <path
                        d="M12 15 L7 4 L17 11 Z"
                        fill={isThinking ? "#ec4899" : "#0284c7"}
                        stroke={isThinking ? "#f59e0b" : "#38bdf8"}
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                    />
                    {/* Left Inner Core Detail */}
                    <path
                        d="M11 13 L8.5 7 L14.5 11 Z"
                        fill={isThinking ? "#fbbf24" : "#bae6fd"}
                        className="opacity-80"
                    />
                </g>

                {/* Right Ear */}
                <g className="pet-ear-right origin-[26px_14px]">
                    <path
                        d="M28 15 L33 4 L23 11 Z"
                        fill={isThinking ? "#ec4899" : "#0284c7"}
                        stroke={isThinking ? "#f59e0b" : "#38bdf8"}
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                    />
                    {/* Right Inner Core Detail */}
                    <path
                        d="M29 13 L31.5 7 L25.5 11 Z"
                        fill={isThinking ? "#fbbf24" : "#bae6fd"}
                        className="opacity-80"
                    />
                </g>

                {/* ── Head / Body Assembly (Bobs & Tilts) ── */}
                <g className="pet-head-assembly origin-[20px_22px]">
                    {/* Main Head Orb */}
                    <circle
                        cx="20"
                        cy="22"
                        r="12.5"
                        fill={isThinking ? "url(#petThinkingGradient)" : "url(#petGradient)"}
                        filter="url(#petGlow)"
                        className="pet-head"
                    />

                    {/* Specular Rim / Glass Crest Arc */}
                    <path
                        d="M11 18 A 12.5 12.5 0 0 1 29 18"
                        stroke="url(#petRimGradient)"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        fill="none"
                        className="opacity-80"
                    />

                    {/* Gloss Reflection Highlight */}
                    <ellipse
                        cx="16"
                        cy="15.5"
                        rx="4"
                        ry="2.2"
                        transform="rotate(-15 16 15.5)"
                        fill="#ffffff"
                        className="opacity-70"
                    />

                    {/* ── Expressive Eyes ── */}
                    {isHovered ? (
                        /* Happy joyful squinting eyes ^ ^ */
                        <g className="pet-eyes-happy stroke-white" strokeWidth="2.2" strokeLinecap="round">
                            <path d="M14 20 Q16.5 17 19 20" fill="none" />
                            <path d="M21 20 Q23.5 17 26 20" fill="none" />
                        </g>
                    ) : (
                        /* Lively Animated Cyber Eyes with Pupils & Blinking */
                        <g className="pet-eyes-group pet-eye-blink origin-[20px_21px]">
                            {/* Left Sclera */}
                            <ellipse cx="16" cy="21" rx="2.8" ry="3.6" fill="#090d16" />
                            {/* Left Pupil Group */}
                            <g className="pet-pupil">
                                <circle cx="16.6" cy="20.2" r="1.5" fill="#ffffff" />
                                <circle cx="15.2" cy="22.2" r="0.7" fill="#38bdf8" />
                            </g>

                            {/* Right Sclera */}
                            <ellipse cx="24" cy="21" rx="2.8" ry="3.6" fill="#090d16" />
                            {/* Right Pupil Group */}
                            <g className="pet-pupil">
                                <circle cx="24.6" cy="20.2" r="1.5" fill="#ffffff" />
                                <circle cx="23.2" cy="22.2" r="0.7" fill="#38bdf8" />
                            </g>
                        </g>
                    )}

                    {/* Cute Cheeks Blush */}
                    <circle cx="12.5" cy="25" r="2" fill={isThinking ? "#f43f5e" : "#38bdf8"} className="opacity-50 pet-blush" />
                    <circle cx="27.5" cy="25" r="2" fill={isThinking ? "#f43f5e" : "#38bdf8"} className="opacity-50 pet-blush" />

                    {/* Cute Cyber Snout / Mouth */}
                    {isHovered ? (
                        /* Happy Open Smiling Mouth */
                        <path
                            d="M17.5 24.5 Q20 27.5 22.5 24.5"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            fill="#090d16"
                        />
                    ) : (
                        /* Gentle Cyber Smile */
                        <path
                            d="M18.5 25 Q20 26.5 21.5 25"
                            stroke="#ffffff"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                            fill="none"
                        />
                    )}
                </g>

                {/* ── Vector Holographic Particle Stars (No Emojis) ── */}
                {isHovered && (
                    <g className="pet-vector-sparkle pointer-events-none">
                        {/* Upper right 4-point star sparkle */}
                        <path
                            d="M32 9 L33.5 12 L36.5 13.5 L33.5 15 L32 18 L30.5 15 L27.5 13.5 L30.5 12 Z"
                            fill="#38bdf8"
                            className="animate-ping opacity-75 origin-[32px_13.5px]"
                        />
                        {/* Upper left micro-sparkle */}
                        <circle cx="9" cy="8" r="1.2" fill="#bae6fd" className="animate-pulse" />
                    </g>
                )}
            </svg>
        </div>
    );
};

export default CyberPet;

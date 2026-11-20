import React, { useState } from 'react';
import { BorderTrail } from '@/components/motion-primitives';
import { useToast } from '../context/ToastContext';
import {
    Sparkles,
    Sliders,
    Copy,
    Check,
    Code,
    Zap,
    Palette,
    Terminal,
    Layout,
    RotateCw,
    Activity,
    Cpu
} from 'lucide-react';

interface ColorTheme {
    name: string;
    class: string;
    glow: string;
    previewHex: string;
}

const COLOR_THEMES: ColorTheme[] = [
    {
        name: 'Cyber Cyan',
        class: 'bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400',
        glow: 'rgba(6, 182, 212, 0.4)',
        previewHex: '#06b6d4'
    },
    {
        name: 'Matrix Emerald',
        class: 'bg-gradient-to-r from-emerald-400 via-teal-300 to-green-500',
        glow: 'rgba(16, 185, 129, 0.4)',
        previewHex: '#10b981'
    },
    {
        name: 'Nebula Purple',
        class: 'bg-gradient-to-r from-indigo-500 via-purple-400 to-pink-500',
        glow: 'rgba(168, 85, 247, 0.4)',
        previewHex: '#a855f7'
    },
    {
        name: 'Solar Amber',
        class: 'bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500',
        glow: 'rgba(245, 158, 11, 0.4)',
        previewHex: '#f59e0b'
    }
];

export const MotionLabPage: React.FC = () => {
    const toast = useToast();

    // Customization states
    const [size, setSize] = useState<number>(60);
    const [duration, setDuration] = useState<number>(4);
    const [selectedTheme, setSelectedTheme] = useState<ColorTheme>(COLOR_THEMES[0]);
    const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
    const [activeDemo, setActiveDemo] = useState<'card' | 'terminal' | 'button'>('card');
    const [copied, setCopied] = useState<boolean>(false);

    const generatedCode = `import { BorderTrail } from '@/components/motion-primitives';

export function GlowingFeatureCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d121f] p-6 shadow-2xl">
      <BorderTrail
        size={${size}}
        className="${selectedTheme.class}"
        transition={{
          repeat: Infinity,
          duration: ${duration},
          ease: 'linear',
        }}
      />
      <div className="relative z-10 space-y-2">
        <h3 className="text-lg font-bold text-white">Interactive Motion Card</h3>
        <p className="text-sm text-slate-400">
          Powered by Akasha Motion Primitives with reactive dynamic trails.
        </p>
      </div>
    </div>
  );
}`;

    const handleCopyCode = () => {
        navigator.clipboard.writeText(generatedCode);
        setCopied(true);
        toast.success('Motion TSX component copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="h-full w-full overflow-y-auto custom-scrollbar bg-[#080b14]/90 text-slate-100 select-none relative backdrop-blur-2xl">
            <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6 pb-24 relative z-10">

                {/* ━━ HEADER ━━ */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                                MOTION PRIMITIVES LAB
                            </span>
                            <span className="text-white/20">•</span>
                            <span className="text-[10px] font-mono text-indigo-400 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-cyan-400 animate-spin" />
                                Reactive Animation Engine
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                            Motion & Animation Studio
                        </h1>
                        <p className="text-xs text-slate-400 mt-1">
                            Interactive visual playground for designing, customizing, and exporting high-performance micro-animations and motion primitives.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveTab('preview')}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                activeTab === 'preview'
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                                    : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
                            }`}
                        >
                            <Layout className="w-3.5 h-3.5" />
                            Live Sandbox
                        </button>
                        <button
                            onClick={() => setActiveTab('code')}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                activeTab === 'code'
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                                    : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
                            }`}
                        >
                            <Code className="w-3.5 h-3.5" />
                            Export Code
                        </button>
                    </div>
                </div>

                {/* ━━ MAIN GRID ━━ */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Left Column: Interactive Controls (4 cols) */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-[#0d121f] p-6 rounded-2xl border border-white/10 shadow-2xl space-y-5">
                            <div className="flex items-center justify-between pb-2 border-b border-white/10">
                                <div className="flex items-center gap-2">
                                    <Sliders className="w-4 h-4 text-cyan-400" />
                                    <h3 className="text-sm font-bold text-slate-200">
                                        Primitive Controls
                                    </h3>
                                </div>
                                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                                    BorderTrail
                                </span>
                            </div>

                            {/* Trail Size Slider */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400 font-medium">Trail Size:</span>
                                    <span className="font-mono text-cyan-400 font-bold">{size}px</span>
                                </div>
                                <input
                                    type="range"
                                    min="20"
                                    max="140"
                                    step="5"
                                    value={size}
                                    onChange={(e) => setSize(Number(e.target.value))}
                                    className="w-full accent-cyan-400 cursor-pointer bg-slate-900 rounded-lg h-1.5"
                                />
                                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                                    <span>20px (Subtle)</span>
                                    <span>140px (Wide)</span>
                                </div>
                            </div>

                            {/* Animation Speed Slider */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400 font-medium">Loop Duration:</span>
                                    <span className="font-mono text-indigo-400 font-bold">{duration}s</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="0.5"
                                    value={duration}
                                    onChange={(e) => setDuration(Number(e.target.value))}
                                    className="w-full accent-indigo-400 cursor-pointer bg-slate-900 rounded-lg h-1.5"
                                />
                                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                                    <span>1s (High Speed)</span>
                                    <span>10s (Ambient Flow)</span>
                                </div>
                            </div>

                            {/* Color Palettes */}
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                                    <Palette className="w-3.5 h-3.5 text-purple-400" />
                                    Energy Beam Palette:
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {COLOR_THEMES.map((theme) => {
                                        const isSelected = selectedTheme.name === theme.name;
                                        return (
                                            <button
                                                key={theme.name}
                                                onClick={() => setSelectedTheme(theme)}
                                                className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all flex items-center gap-2 cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-white/10 border-cyan-400/80 shadow-md text-white'
                                                        : 'bg-black/30 border-white/5 hover:border-white/20 text-slate-400'
                                                }`}
                                            >
                                                <span
                                                    className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                                                    style={{ backgroundColor: theme.previewHex }}
                                                />
                                                <span className="truncate text-[11px]">{theme.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Demo Target Switcher */}
                            <div className="space-y-2 pt-2 border-t border-white/10">
                                <label className="text-xs text-slate-400 font-medium">
                                    Component Canvas Target:
                                </label>
                                <div className="grid grid-cols-3 gap-1.5 bg-[#05070e] p-1 rounded-xl border border-white/10">
                                    <button
                                        onClick={() => setActiveDemo('card')}
                                        className={`py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                                            activeDemo === 'card'
                                                ? 'bg-cyan-500/20 text-cyan-300'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Card
                                    </button>
                                    <button
                                        onClick={() => setActiveDemo('terminal')}
                                        className={`py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                                            activeDemo === 'terminal'
                                                ? 'bg-cyan-500/20 text-cyan-300'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Terminal
                                    </button>
                                    <button
                                        onClick={() => setActiveDemo('button')}
                                        className={`py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                                            activeDemo === 'button'
                                                ? 'bg-cyan-500/20 text-cyan-300'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Action CTA
                                    </button>
                                </div>
                            </div>

                            {/* Reset Button */}
                            <button
                                onClick={() => {
                                    setSize(60);
                                    setDuration(4);
                                    setSelectedTheme(COLOR_THEMES[0]);
                                    toast.info('Parameters reset to default presets');
                                }}
                                className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 border border-white/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <RotateCw className="w-3.5 h-3.5" />
                                Reset to Default Parameters
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Live Sandbox & Code Viewer (8 cols) */}
                    <div className="lg:col-span-8 space-y-4">
                        {activeTab === 'preview' ? (
                            <div className="bg-[#0b0f1a] rounded-2xl border border-white/10 p-8 flex flex-col items-center justify-center min-h-[520px] shadow-2xl relative overflow-hidden">

                                {/* Ambient Background Glow */}
                                <div
                                    className="absolute inset-0 pointer-events-none opacity-20 blur-3xl transition-all duration-700"
                                    style={{ background: `radial-gradient(circle at center, ${selectedTheme.glow}, transparent 70%)` }}
                                />

                                {/* DEMO 1: METRIC CARD */}
                                {activeDemo === 'card' && (
                                    <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0d121f]/90 p-8 shadow-2xl backdrop-blur-xl animate-fadeIn">
                                        <BorderTrail
                                            size={size}
                                            className={selectedTheme.class}
                                            transition={{
                                                repeat: Infinity,
                                                duration: duration,
                                                ease: 'linear'
                                            }}
                                        />

                                        <div className="relative z-10 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                                                        <Cpu className="w-5 h-5 animate-pulse" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-100">Antigravity Neural Node</h4>
                                                        <span className="text-[10px] font-mono text-emerald-400">● LIVE RUNTIME</span>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-mono font-bold bg-white/5 px-2 py-0.5 rounded border border-white/10 text-slate-300">
                                                    TRAIL ACTIVE
                                                </span>
                                            </div>

                                            <div className="bg-black/50 p-4 rounded-2xl border border-white/5 space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-400">Quantum Throughput:</span>
                                                    <span className="font-mono text-cyan-300 font-bold">98.4%</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-400">Memory Efficiency:</span>
                                                    <span className="font-mono text-emerald-300 font-bold">12.4 MB</span>
                                                </div>
                                            </div>

                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                High-frequency animated border trail rendered on continuous GPU offset paths. Zero layout thrashing.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* DEMO 2: CODE TERMINAL */}
                                {activeDemo === 'terminal' && (
                                    <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#05070e] p-6 shadow-2xl font-mono text-xs animate-fadeIn">
                                        <BorderTrail
                                            size={size}
                                            className={selectedTheme.class}
                                            transition={{
                                                repeat: Infinity,
                                                duration: duration,
                                                ease: 'linear'
                                            }}
                                        />

                                        <div className="relative z-10 space-y-3">
                                            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-slate-400 text-[11px]">
                                                <div className="flex items-center gap-2">
                                                    <Terminal className="w-4 h-4 text-emerald-400" />
                                                    <span>akasha-agent-engine ~ bash</span>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5 text-slate-300 text-[11px]">
                                                <div className="text-cyan-400">$ akasha-motion init --primitive=border-trail</div>
                                                <div className="text-emerald-400">✓ Injected shader container (size={size}px)</div>
                                                <div className="text-slate-400">→ Loop duration locked at {duration}s</div>
                                                <div className="text-slate-200">✨ Ready for visual assembly in Akasha Studio.</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* DEMO 3: CALL TO ACTION BUTTON */}
                                {activeDemo === 'button' && (
                                    <div className="flex flex-col items-center gap-6 animate-fadeIn">
                                        <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-[#0f1424] px-8 py-5 shadow-2xl">
                                            <BorderTrail
                                                size={size}
                                                className={selectedTheme.class}
                                                transition={{
                                                    repeat: Infinity,
                                                    duration: duration,
                                                    ease: 'linear'
                                                }}
                                            />

                                            <button
                                                type="button"
                                                onClick={() => toast.success('Motion button triggered!')}
                                                className="relative z-10 font-bold text-sm tracking-wide text-white flex items-center gap-2.5 cursor-pointer"
                                            >
                                                <Zap className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                                                Launch Autonomous Pipeline
                                            </button>
                                        </div>
                                        <span className="text-xs text-slate-500">
                                            Click button to test interactive hover and reactive ripple
                                        </span>
                                    </div>
                                )}

                                {/* Bottom Info Pill */}
                                <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-xs text-slate-400 bg-black/40 px-4 py-2.5 rounded-xl border border-white/5 backdrop-blur-md">
                                    <span className="flex items-center gap-2">
                                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Component Path: <code>@/components/motion-primitives/border-trail</code></span>
                                    </span>
                                    <span className="font-mono text-[11px] text-cyan-400">GPU Accelerated</span>
                                </div>
                            </div>
                        ) : (
                            /* CODE VIEWER TAB */
                            <div className="bg-[#090d18] rounded-2xl border border-white/10 p-6 flex flex-col h-[520px] shadow-2xl">
                                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                                    <div className="flex items-center gap-2">
                                        <Code className="w-4 h-4 text-cyan-400" />
                                        <h3 className="text-sm font-bold text-slate-200">
                                            Generated Component TSX Code
                                        </h3>
                                    </div>
                                    <button
                                        onClick={handleCopyCode}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-cyan-300 text-xs font-semibold cursor-pointer transition-all"
                                    >
                                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                        {copied ? 'Copied to Clipboard' : 'Copy Code'}
                                    </button>
                                </div>

                                <pre className="flex-1 overflow-y-auto mt-4 p-4 rounded-xl bg-black/80 border border-white/10 text-emerald-300 font-mono text-xs leading-relaxed select-all custom-scrollbar">
                                    {generatedCode}
                                </pre>

                                <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-slate-400">
                                    💡 <strong>Tip:</strong> Paste this directly into any view or page inside <code>client/src/frontend/components/</code> to enjoy butter-smooth micro-animations.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MotionLabPage;

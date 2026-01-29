import React, { useState, useEffect } from 'react';
import { Sparkles, Play, Clock, Zap } from 'lucide-react';

interface AnimationPanelProps {
    editor: any;
}

interface AnimationConfig {
    trigger: 'none' | 'load' | 'scroll' | 'hover' | 'click';
    type: 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'scale' | 'rotate' | 'bounce';
    duration: number;
    delay: number;
    easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
    iterationCount: number | 'infinite';
}

const defaultConfig: AnimationConfig = {
    trigger: 'none',
    type: 'none',
    duration: 0.5,
    delay: 0,
    easing: 'ease',
    iterationCount: 1,
};

const animationTypes = [
    { value: 'none', label: 'None' },
    { value: 'fade', label: 'Fade In' },
    { value: 'slide-up', label: 'Slide Up' },
    { value: 'slide-down', label: 'Slide Down' },
    { value: 'slide-left', label: 'Slide Left' },
    { value: 'slide-right', label: 'Slide Right' },
    { value: 'scale', label: 'Scale' },
    { value: 'rotate', label: 'Rotate' },
    { value: 'bounce', label: 'Bounce' },
];

const triggerTypes = [
    { value: 'none', label: 'None' },
    { value: 'load', label: 'On Page Load' },
    { value: 'scroll', label: 'On Scroll Into View' },
    { value: 'hover', label: 'On Hover' },
    { value: 'click', label: 'On Click' },
];

const easingTypes = [
    { value: 'ease', label: 'Ease' },
    { value: 'ease-in', label: 'Ease In' },
    { value: 'ease-out', label: 'Ease Out' },
    { value: 'ease-in-out', label: 'Ease In Out' },
    { value: 'linear', label: 'Linear' },
];

export const AnimationPanel: React.FC<AnimationPanelProps> = ({ editor }) => {
    const [config, setConfig] = useState<AnimationConfig>(defaultConfig);
    const [selectedComponent, setSelectedComponent] = useState<any>(null);

    useEffect(() => {
        if (!editor) return;

        const handleSelection = () => {
            const selected = editor.getSelected();
            setSelectedComponent(selected);

            if (selected) {
                // Load existing animation data
                const animData = selected.get('animation') || defaultConfig;
                setConfig(animData);
            }
        };

        editor.on('component:selected', handleSelection);
        handleSelection(); // Initial check

        return () => {
            editor.off('component:selected', handleSelection);
        };
    }, [editor]);

    const handleConfigChange = (key: keyof AnimationConfig, value: any) => {
        const newConfig = { ...config, [key]: value };
        setConfig(newConfig);

        if (selectedComponent) {
            selectedComponent.set('animation', newConfig);
            applyAnimationStyles(selectedComponent, newConfig);
        }
    };

    const applyAnimationStyles = (component: any, animConfig: AnimationConfig) => {
        if (!component || animConfig.type === 'none') {
            component?.removeClass('animate-fade animate-slide-up animate-slide-down animate-slide-left animate-slide-right animate-scale animate-rotate animate-bounce');
            return;
        }

        // Generate CSS keyframes and animation class
        const animationName = `anim-${animConfig.type}`;
        const animationClass = `animate-${animConfig.type}`;

        // Apply class to component
        component.addClass(animationClass);

        // Set inline animation styles
        component.addStyle({
            'animation-name': animationName,
            'animation-duration': `${animConfig.duration}s`,
            'animation-delay': `${animConfig.delay}s`,
            'animation-timing-function': animConfig.easing,
            'animation-iteration-count': animConfig.iterationCount === 'infinite' ? 'infinite' : animConfig.iterationCount.toString(),
            'animation-fill-mode': 'both',
        });
    };

    const handlePreview = () => {
        if (!selectedComponent) return;

        // Remove and re-add animation to trigger it
        const el = selectedComponent.getEl();
        if (el) {
            el.style.animation = 'none';
            el.offsetHeight; // Trigger reflow
            applyAnimationStyles(selectedComponent, config);
        }
    };

    if (!selectedComponent) {
        return (
            <div className="p-4 text-center text-slate-400">
                <Sparkles size={48} className="mx-auto mb-2 opacity-50" />
                <p>Select a component to add animations</p>
            </div>
        );
    }

    return (
        <div className="p-4 text-slate-200">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Sparkles size={20} />
                Animations
            </h3>

            <div className="space-y-4">
                {/* Trigger */}
                <div>
                    <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                        <Zap size={12} />
                        Trigger
                    </label>
                    <select
                        value={config.trigger}
                        onChange={(e) => handleConfigChange('trigger', e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        {triggerTypes.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>

                {/* Animation Type */}
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Animation Type</label>
                    <select
                        value={config.type}
                        onChange={(e) => handleConfigChange('type', e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        {animationTypes.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>

                {/* Duration */}
                <div>
                    <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                        <Clock size={12} />
                        Duration (seconds)
                    </label>
                    <input
                        type="number"
                        min="0.1"
                        max="10"
                        step="0.1"
                        value={config.duration}
                        onChange={(e) => handleConfigChange('duration', parseFloat(e.target.value))}
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>

                {/* Delay */}
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Delay (seconds)</label>
                    <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={config.delay}
                        onChange={(e) => handleConfigChange('delay', parseFloat(e.target.value))}
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>

                {/* Easing */}
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Easing</label>
                    <select
                        value={config.easing}
                        onChange={(e) => handleConfigChange('easing', e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        {easingTypes.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>

                {/* Iteration Count */}
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Repeat</label>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            min="1"
                            max="100"
                            value={config.iterationCount === 'infinite' ? 1 : config.iterationCount}
                            onChange={(e) => handleConfigChange('iterationCount', parseInt(e.target.value))}
                            disabled={config.iterationCount === 'infinite'}
                            className="flex-1 bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                        />
                        <button
                            onClick={() => handleConfigChange('iterationCount', config.iterationCount === 'infinite' ? 1 : 'infinite')}
                            className={`px-3 py-2 rounded text-sm ${config.iterationCount === 'infinite' ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-slate-400'}`}
                        >
                            ∞
                        </button>
                    </div>
                </div>

                {/* Preview Button */}
                <button
                    onClick={handlePreview}
                    className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                >
                    <Play size={16} />
                    Preview Animation
                </button>
            </div>
        </div>
    );
};

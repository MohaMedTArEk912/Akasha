/**
 * CSS-to-Tailwind Converter
 * 
 * Converts raw CSS properties to Tailwind utility classes.
 * This ensures ALL styles in the VFS are TailwindCSS-first.
 */

// ============================================================================
// SPACING SCALE (Tailwind default)
// ============================================================================

const SPACING_SCALE: Record<string, string> = {
    '0': '0',
    '0.5': '0.5',
    '1': '1',
    '1.5': '1.5',
    '2': '2',
    '2.5': '2.5',
    '3': '3',
    '3.5': '3.5',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    '10': '10',
    '11': '11',
    '12': '12',
    '14': '14',
    '16': '16',
    '20': '20',
    '24': '24',
    '28': '28',
    '32': '32',
    '36': '36',
    '40': '40',
    '44': '44',
    '48': '48',
    '52': '52',
    '56': '56',
    '60': '60',
    '64': '64',
    '72': '72',
    '80': '80',
    '96': '96',
};

// Convert px to rem scale value (1rem = 16px, Tailwind uses 0.25rem = 1 unit)
function pxToTailwindUnit(px: number): string | null {
    const rem = px / 4; // Each Tailwind unit is 0.25rem = 4px
    const remStr = String(rem);

    if (SPACING_SCALE[remStr]) {
        return SPACING_SCALE[remStr];
    }

    // Return closest match
    const units = Object.keys(SPACING_SCALE).map(Number).sort((a, b) => a - b);
    const closest = units.reduce((prev, curr) =>
        Math.abs(curr - rem) < Math.abs(prev - rem) ? curr : prev
    );

    return String(closest);
}

// ============================================================================
// COLOR CONVERSION
// ============================================================================

const TAILWIND_COLORS: Record<string, string> = {
    '#000000': 'black',
    '#ffffff': 'white',
    '#f8fafc': 'slate-50',
    '#f1f5f9': 'slate-100',
    '#e2e8f0': 'slate-200',
    '#cbd5e1': 'slate-300',
    '#94a3b8': 'slate-400',
    '#64748b': 'slate-500',
    '#475569': 'slate-600',
    '#334155': 'slate-700',
    '#1e293b': 'slate-800',
    '#0f172a': 'slate-900',
    '#f7fee7': 'lime-50',
    '#ecfccb': 'lime-100',
    '#d9f99d': 'lime-200',
    '#bef264': 'lime-300',
    '#a3e635': 'lime-400',
    '#84cc16': 'lime-500',
    '#65a30d': 'lime-600',
    '#4d7c0f': 'lime-700',
    '#3f6212': 'lime-800',
    '#365314': 'lime-900',
    '#ef4444': 'red-500',
    '#3b82f6': 'blue-500',
    '#22c55e': 'green-500',
    '#eab308': 'yellow-500',
    '#6366f1': 'indigo-500',
    '#8b5cf6': 'violet-500',
    '#ec4899': 'pink-500',
    'transparent': 'transparent',
    'currentColor': 'current',
};

function hexToTailwindColor(hex: string): string | null {
    const normalized = hex.toLowerCase();
    return TAILWIND_COLORS[normalized] || null;
}

function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// CONVERTER FUNCTIONS
// ============================================================================

type CSSProperty = string;
type CSSValue = string;
type TailwindClass = string;

interface ConversionResult {
    classes: TailwindClass[];
    unconverted: Array<{ property: CSSProperty; value: CSSValue }>;
}

/**
 * Convert a single CSS property-value pair to Tailwind class(es)
 */
function convertProperty(property: CSSProperty, value: CSSValue): TailwindClass[] {
    const classes: TailwindClass[] = [];
    const prop = property.toLowerCase().trim();
    const val = value.trim();

    // Parse pixel values
    const pxMatch = val.match(/^(\d+(?:\.\d+)?)\s*px$/i);
    const pxValue = pxMatch ? parseFloat(pxMatch[1]) : null;

    // ==================== MARGIN ====================
    if (prop === 'margin') {
        const values = val.split(/\s+/);
        if (values.length === 1 && pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`m-${unit}`);
        } else if (values.length === 2) {
            // vertical horizontal
            classes.push(...convertProperty('margin-top', values[0]));
            classes.push(...convertProperty('margin-right', values[1]));
        }
    } else if (prop === 'margin-top') {
        if (pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`mt-${unit}`);
        } else if (val === 'auto') {
            classes.push('mt-auto');
        }
    } else if (prop === 'margin-right') {
        if (pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`mr-${unit}`);
        } else if (val === 'auto') {
            classes.push('mr-auto');
        }
    } else if (prop === 'margin-bottom') {
        if (pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`mb-${unit}`);
        } else if (val === 'auto') {
            classes.push('mb-auto');
        }
    } else if (prop === 'margin-left') {
        if (pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`ml-${unit}`);
        } else if (val === 'auto') {
            classes.push('ml-auto');
        }
    }

    // ==================== PADDING ====================
    else if (prop === 'padding') {
        const values = val.split(/\s+/);
        if (values.length === 1 && pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`p-${unit}`);
        }
    } else if (prop === 'padding-top') {
        if (pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`pt-${unit}`);
        }
    } else if (prop === 'padding-right') {
        if (pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`pr-${unit}`);
        }
    } else if (prop === 'padding-bottom') {
        if (pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`pb-${unit}`);
        }
    } else if (prop === 'padding-left') {
        if (pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`pl-${unit}`);
        }
    }

    // ==================== WIDTH/HEIGHT ====================
    else if (prop === 'width') {
        if (val === '100%') classes.push('w-full');
        else if (val === 'auto') classes.push('w-auto');
        else if (val === 'fit-content') classes.push('w-fit');
        else if (val === 'max-content') classes.push('w-max');
        else if (val === 'min-content') classes.push('w-min');
        else if (val === '100vw') classes.push('w-screen');
        else if (pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`w-${unit}`);
        }
    } else if (prop === 'height') {
        if (val === '100%') classes.push('h-full');
        else if (val === 'auto') classes.push('h-auto');
        else if (val === 'fit-content') classes.push('h-fit');
        else if (val === '100vh') classes.push('h-screen');
        else if (pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`h-${unit}`);
        }
    }

    // ==================== DISPLAY ====================
    else if (prop === 'display') {
        const displayMap: Record<string, string> = {
            'block': 'block',
            'inline-block': 'inline-block',
            'inline': 'inline',
            'flex': 'flex',
            'inline-flex': 'inline-flex',
            'grid': 'grid',
            'inline-grid': 'inline-grid',
            'none': 'hidden',
            'table': 'table',
            'table-row': 'table-row',
            'table-cell': 'table-cell',
        };
        if (displayMap[val]) classes.push(displayMap[val]);
    }

    // ==================== FLEXBOX ====================
    else if (prop === 'flex-direction') {
        const dirMap: Record<string, string> = {
            'row': 'flex-row',
            'row-reverse': 'flex-row-reverse',
            'column': 'flex-col',
            'column-reverse': 'flex-col-reverse',
        };
        if (dirMap[val]) classes.push(dirMap[val]);
    } else if (prop === 'justify-content') {
        const justifyMap: Record<string, string> = {
            'flex-start': 'justify-start',
            'flex-end': 'justify-end',
            'center': 'justify-center',
            'space-between': 'justify-between',
            'space-around': 'justify-around',
            'space-evenly': 'justify-evenly',
        };
        if (justifyMap[val]) classes.push(justifyMap[val]);
    } else if (prop === 'align-items') {
        const alignMap: Record<string, string> = {
            'flex-start': 'items-start',
            'flex-end': 'items-end',
            'center': 'items-center',
            'baseline': 'items-baseline',
            'stretch': 'items-stretch',
        };
        if (alignMap[val]) classes.push(alignMap[val]);
    } else if (prop === 'flex-wrap') {
        const wrapMap: Record<string, string> = {
            'wrap': 'flex-wrap',
            'wrap-reverse': 'flex-wrap-reverse',
            'nowrap': 'flex-nowrap',
        };
        if (wrapMap[val]) classes.push(wrapMap[val]);
    } else if (prop === 'gap') {
        if (pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`gap-${unit}`);
        }
    }

    // ==================== POSITION ====================
    else if (prop === 'position') {
        const posMap: Record<string, string> = {
            'static': 'static',
            'relative': 'relative',
            'absolute': 'absolute',
            'fixed': 'fixed',
            'sticky': 'sticky',
        };
        if (posMap[val]) classes.push(posMap[val]);
    } else if (prop === 'top') {
        if (val === '0' || val === '0px') classes.push('top-0');
        else if (pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`top-${unit}`);
        }
    } else if (prop === 'right') {
        if (val === '0' || val === '0px') classes.push('right-0');
        else if (pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`right-${unit}`);
        }
    } else if (prop === 'bottom') {
        if (val === '0' || val === '0px') classes.push('bottom-0');
        else if (pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`bottom-${unit}`);
        }
    } else if (prop === 'left') {
        if (val === '0' || val === '0px') classes.push('left-0');
        else if (pxValue !== null) {
            const unit = pxToTailwindUnit(pxValue);
            if (unit) classes.push(`left-${unit}`);
        }
    } else if (prop === 'z-index') {
        const zMap: Record<string, string> = {
            '0': 'z-0',
            '10': 'z-10',
            '20': 'z-20',
            '30': 'z-30',
            '40': 'z-40',
            '50': 'z-50',
        };
        if (zMap[val]) classes.push(zMap[val]);
    }

    // ==================== COLORS ====================
    else if (prop === 'background-color' || prop === 'background') {
        const color = hexToTailwindColor(val);
        if (color) classes.push(`bg-${color}`);
    } else if (prop === 'color') {
        const color = hexToTailwindColor(val);
        if (color) classes.push(`text-${color}`);
    }

    // ==================== TYPOGRAPHY ====================
    else if (prop === 'font-size') {
        const sizeMap: Record<string, string> = {
            '12px': 'text-xs',
            '14px': 'text-sm',
            '16px': 'text-base',
            '18px': 'text-lg',
            '20px': 'text-xl',
            '24px': 'text-2xl',
            '30px': 'text-3xl',
            '36px': 'text-4xl',
            '48px': 'text-5xl',
            '60px': 'text-6xl',
            '72px': 'text-7xl',
            '96px': 'text-8xl',
            '128px': 'text-9xl',
        };
        if (sizeMap[val]) classes.push(sizeMap[val]);
    } else if (prop === 'font-weight') {
        const weightMap: Record<string, string> = {
            '100': 'font-thin',
            '200': 'font-extralight',
            '300': 'font-light',
            '400': 'font-normal',
            '500': 'font-medium',
            '600': 'font-semibold',
            '700': 'font-bold',
            '800': 'font-extrabold',
            '900': 'font-black',
            'normal': 'font-normal',
            'bold': 'font-bold',
        };
        if (weightMap[val]) classes.push(weightMap[val]);
    } else if (prop === 'text-align') {
        const alignMap: Record<string, string> = {
            'left': 'text-left',
            'center': 'text-center',
            'right': 'text-right',
            'justify': 'text-justify',
        };
        if (alignMap[val]) classes.push(alignMap[val]);
    }

    // ==================== BORDER ====================
    else if (prop === 'border-radius') {
        const radiusMap: Record<string, string> = {
            '0': 'rounded-none',
            '2px': 'rounded-sm',
            '4px': 'rounded',
            '6px': 'rounded-md',
            '8px': 'rounded-lg',
            '12px': 'rounded-xl',
            '16px': 'rounded-2xl',
            '24px': 'rounded-3xl',
            '9999px': 'rounded-full',
            '50%': 'rounded-full',
        };
        if (radiusMap[val]) classes.push(radiusMap[val]);
    } else if (prop === 'border-width' || prop === 'border') {
        if (val === '0' || val === 'none') classes.push('border-0');
        else if (val === '1px' || val.includes('1px')) classes.push('border');
        else if (val === '2px' || val.includes('2px')) classes.push('border-2');
        else if (val === '4px' || val.includes('4px')) classes.push('border-4');
        else if (val === '8px' || val.includes('8px')) classes.push('border-8');
    }

    // ==================== SHADOWS ====================
    else if (prop === 'box-shadow') {
        if (val === 'none') classes.push('shadow-none');
        else if (val.includes('0 1px 2px')) classes.push('shadow-sm');
        else if (val.includes('0 1px 3px')) classes.push('shadow');
        else if (val.includes('0 4px 6px')) classes.push('shadow-md');
        else if (val.includes('0 10px 15px')) classes.push('shadow-lg');
        else if (val.includes('0 20px 25px')) classes.push('shadow-xl');
        else if (val.includes('0 25px 50px')) classes.push('shadow-2xl');
    }

    // ==================== OPACITY ====================
    else if (prop === 'opacity') {
        const opacityMap: Record<string, string> = {
            '0': 'opacity-0',
            '0.05': 'opacity-5',
            '0.1': 'opacity-10',
            '0.2': 'opacity-20',
            '0.25': 'opacity-25',
            '0.3': 'opacity-30',
            '0.4': 'opacity-40',
            '0.5': 'opacity-50',
            '0.6': 'opacity-60',
            '0.7': 'opacity-70',
            '0.75': 'opacity-75',
            '0.8': 'opacity-80',
            '0.9': 'opacity-90',
            '0.95': 'opacity-95',
            '1': 'opacity-100',
        };
        if (opacityMap[val]) classes.push(opacityMap[val]);
    }

    // ==================== OVERFLOW ====================
    else if (prop === 'overflow') {
        const overflowMap: Record<string, string> = {
            'auto': 'overflow-auto',
            'hidden': 'overflow-hidden',
            'visible': 'overflow-visible',
            'scroll': 'overflow-scroll',
        };
        if (overflowMap[val]) classes.push(overflowMap[val]);
    }

    // ==================== CURSOR ====================
    else if (prop === 'cursor') {
        const cursorMap: Record<string, string> = {
            'pointer': 'cursor-pointer',
            'default': 'cursor-default',
            'move': 'cursor-move',
            'not-allowed': 'cursor-not-allowed',
            'wait': 'cursor-wait',
            'text': 'cursor-text',
        };
        if (cursorMap[val]) classes.push(cursorMap[val]);
    }

    return classes;
}

/**
 * Convert CSS object to Tailwind classes
 */
export function cssToTailwind(styles: Record<string, string>): ConversionResult {
    const allClasses: TailwindClass[] = [];
    const unconverted: Array<{ property: CSSProperty; value: CSSValue }> = [];

    for (const [property, value] of Object.entries(styles)) {
        const classes = convertProperty(property, value);

        if (classes.length > 0) {
            allClasses.push(...classes);
        } else {
            unconverted.push({ property, value });
        }
    }

    // Deduplicate classes
    const uniqueClasses = [...new Set(allClasses)];

    return {
        classes: uniqueClasses,
        unconverted
    };
}

/**
 * Convert inline style string to Tailwind classes
 */
export function inlineStyleToTailwind(inlineStyle: string): ConversionResult {
    const styles: Record<string, string> = {};

    // Parse inline style string
    const pairs = inlineStyle.split(';').filter(Boolean);
    for (const pair of pairs) {
        const [property, ...valueParts] = pair.split(':');
        if (property && valueParts.length > 0) {
            styles[property.trim()] = valueParts.join(':').trim();
        }
    }

    return cssToTailwind(styles);
}

/**
 * Merge Tailwind classes intelligently (dedupe conflicting classes)
 */
export function mergeTailwindClasses(existingClasses: string[], newClasses: string[]): string[] {
    // Simple merge - in production, use tailwind-merge library
    const combined = [...existingClasses, ...newClasses];
    return [...new Set(combined)];
}

export default {
    cssToTailwind,
    inlineStyleToTailwind,
    mergeTailwindClasses
};

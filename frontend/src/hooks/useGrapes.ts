import { useEffect, useRef, useState } from 'react';
import grapesjs from 'grapesjs';
// @ts-ignore - No types available for this plugin
import grapesjsTailwind from 'grapesjs-tailwind';
// @ts-ignore - No types available for this plugin
import grapesjsRulers from 'grapesjs-rulers';
import { initBlocks } from '../utils/blocks';
import { GrapesEditor } from '../types/grapes';


export const useGrapes = () => {
    const [editor, setEditor] = useState<GrapesEditor | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!editorRef.current) return;

        const editorInstance = grapesjs.init({
            container: editorRef.current,
            height: '100%',
            width: 'auto',
            fromElement: true,
            // Enable free-form absolute positioning validation
            dragMode: 'absolute',
            // Tailwind-first: All styling uses Tailwind CSS classes
            plugins: [grapesjsTailwind, grapesjsRulers],
            pluginsOpts: {
                // grapesjs-tailwind plugin options
                'grapesjs-tailwind': {
                    // Disable plugin's blocks - we use our own responsive blocks
                    blocks: [],
                    tailwindPlayCdn: true,
                },
                'grapesjs-rulers': {
                    dragMode: 'translate',
                }
            },
            storageManager: {
                type: 'local',
                id: 'gjs-ultimate-',
                autosave: true,
                autoload: false, // Always start with clean canvas
                stepsBeforeSave: 1,
            },
            deviceManager: {
                devices: [
                    { name: 'Desktop', width: '' }, // Full width, lg: breakpoint (>=1024px)
                    { name: 'Tablet', width: '768px', widthMedia: '768px' }, // md: breakpoint
                    { name: 'Mobile portrait', width: '375px', widthMedia: '640px' }, // Below sm: breakpoint
                ]
            },
            panels: { defaults: [] },
            blockManager: {
                appendTo: '#blocks-container',
            },
            layerManager: {
                appendTo: '#layers-container',
            },
            selectorManager: {
                appendTo: '#selectors-container',
            },
            styleManager: {
                appendTo: '#styles-container',
                sectors: [
                    {
                        name: 'General',
                        open: false,
                        buildProps: ['float', 'display', 'position', 'top', 'right', 'left', 'bottom'],
                    },
                    {
                        name: 'Flex',
                        open: false,
                        buildProps: [
                            'flex-direction', 'flex-wrap', 'justify-content', 'align-items',
                            'align-content', 'order', 'flex-basis', 'flex-grow', 'flex-shrink', 'align-self'
                        ],
                    },
                    {
                        name: 'Dimension',
                        open: false,
                        buildProps: ['width', 'height', 'max-width', 'min-width', 'max-height', 'min-height', 'margin', 'padding'],
                    },
                    {
                        name: 'Typography',
                        open: false,
                        buildProps: [
                            'font-family', 'font-size', 'font-weight', 'letter-spacing',
                            'color', 'line-height', 'text-align', 'text-decoration',
                            'text-transform', 'text-shadow'
                        ],
                    },
                    {
                        name: 'Decorations',
                        open: false,
                        buildProps: [
                            'opacity', 'background', 'background-color', 'border',
                            'border-radius', 'box-shadow'
                        ],
                    },
                    {
                        name: 'Extra',
                        open: false,
                        buildProps: ['transition', 'transform', 'cursor', 'overflow'],
                    },
                ],
            },
            traitManager: {
                appendTo: '#traits-container',
            },
            canvas: {
                styles: [
                    // Tailwind CSS CDN - enables all Tailwind utilities in the canvas
                    'https://cdn.tailwindcss.com',
                    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
                    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
                ],
                scripts: [
                    // Tailwind Play CDN for real-time Tailwind compilation
                    'https://cdn.tailwindcss.com',
                ],
                // Ensure the canvas frame has proper styling for responsive preview
                frameStyle: `
                    html {
                        height: 100%;
                        width: 100%;
                    }
                    body { 
                        background-color: #ffffff !important; 
                        margin: 0;
                        padding: 0;
                        min-height: 100vh !important;
                        height: 100%;
                        width: 100%;
                        overflow-x: hidden;
                    }
                    * { 
                        box-sizing: border-box; 
                    }
                    img, video, iframe, embed, object {
                        max-width: 100%;
                        height: auto;
                    }
                    section, div, article, aside, header, footer, nav, main {
                        max-width: 100%;
                    }
                `,
            },
        });


        initBlocks(editorInstance);
        setEditor(editorInstance);

        return () => {
            editorInstance.destroy();
        };
    }, []);

    return { editor, editorRef };
};

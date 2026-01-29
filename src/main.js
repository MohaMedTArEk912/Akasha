/**
 * GrapesJS Ultimate Editor - Main JavaScript
 * @description Initializes GrapesJS with custom blocks and event handlers
 * @version 1.0.0
 */

import { initBlocks } from './blocks.js';

/**
 * Wait for DOM to be ready
 */
document.addEventListener('DOMContentLoaded', function() {
  
  /**
   * Initialize the GrapesJS editor
   */
  const editor = grapesjs.init({
    container: '#gjs',
    height: '100%',
    width: 'auto',
    fromElement: true,
    
    // Storage configuration
    storageManager: {
      type: 'local',
      id: 'gjs-ultimate-',
      autosave: true,
      autoload: true,
      stepsBeforeSave: 1,
    },

    // Device Manager configuration
    deviceManager: {
      devices: [
        { name: 'Desktop', width: '' },
        { name: 'Tablet', width: '768px', widthMedia: '992px' },
        { name: 'Mobile portrait', width: '320px', widthMedia: '575px' },
      ]
    },

    // Panels configuration - we use custom panels outside
    panels: {
      defaults: []
    },

    // Block Manager configuration
    blockManager: {
      appendTo: '#blocks-container',
    },

    // Layer Manager configuration
    layerManager: {
      appendTo: '#layers-container',
    },

    // Selector Manager configuration
    selectorManager: {
      appendTo: '#selectors-container',
    },

    // Style Manager configuration
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

    // Trait Manager configuration
    traitManager: {
      appendTo: '#traits-container',
    },

    // Canvas configuration
    canvas: {
      styles: [
        'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
      ],
    },
  });

  // Store editor globally for debugging
  window.editor = editor;

  // Initialize custom blocks
  initBlocks(editor);

  // Setup event handlers
  setupEventHandlers(editor);

  // Hide loading overlay when editor is ready
  editor.on('load', () => {
    setTimeout(() => {
      document.getElementById('loading').classList.add('hidden');
    }, 300);
  });

  // Fallback to hide loading
  setTimeout(() => {
    document.getElementById('loading').classList.add('hidden');
  }, 2000);

  console.log('%c🍇 GrapesJS Ultimate Editor Loaded Successfully!', 
    'color: #6366f1; font-size: 16px; font-weight: bold;');
});

/**
 * Setup all event handlers for the editor UI
 * @param {Object} editor - GrapesJS editor instance
 */
function setupEventHandlers(editor) {
  // Undo button
  document.getElementById('btn-undo').addEventListener('click', () => {
    editor.UndoManager.undo();
  });

  // Redo button
  document.getElementById('btn-redo').addEventListener('click', () => {
    editor.UndoManager.redo();
  });

  // Clear canvas button
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the canvas? This action cannot be undone.')) {
      editor.DomComponents.clear();
      editor.CssComposer.clear();
    }
  });

  // View code button
  document.getElementById('btn-code').addEventListener('click', () => {
    const html = editor.getHtml();
    const css = editor.getCss();
    const modal = editor.Modal;
    modal.setTitle('HTML & CSS Code');
    modal.setContent(`
      <div style="padding: 20px; background: #0a0a1a; color: #e2e8f0; font-family: monospace; font-size: 12px; line-height: 1.5; max-height: 60vh; overflow: auto;">
        <h4 style="color: #6366f1; margin-top: 0;">HTML</h4>
        <pre style="background: #1a1a2e; padding: 15px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap;">${html.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        <h4 style="color: #6366f1;">CSS</h4>
        <pre style="background: #1a1a2e; padding: 15px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap;">${css}</pre>
      </div>
    `);
    modal.open();
  });

  // Preview button
  document.getElementById('btn-preview').addEventListener('click', () => {
    editor.runCommand('preview');
  });

  // Fullscreen button
  document.getElementById('btn-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });

  // Export button
  document.getElementById('btn-export').addEventListener('click', () => {
    const html = editor.getHtml();
    const css = editor.getCss();
    
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exported Page</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; }
    ${css}
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exported-page.html';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Device Switcher
  const deviceBtns = document.querySelectorAll('.device-btn');
  deviceBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      deviceBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      editor.setDevice(this.dataset.device);
    });
  });

  // Panel Tabs
  const panelTabs = document.querySelectorAll('.panel-tab');
  panelTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      panelTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      const panelId = this.dataset.panel;
      document.getElementById('styles-container').style.display = panelId === 'styles' ? 'block' : 'none';
      document.getElementById('selectors-container').style.display = panelId === 'styles' ? 'block' : 'none';
      document.getElementById('traits-container').style.display = panelId === 'traits' ? 'block' : 'none';
      document.getElementById('layers-container').style.display = panelId === 'layers' ? 'block' : 'none';
    });
  });

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Z = Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      editor.UndoManager.undo();
    }
    // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z = Redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      editor.UndoManager.redo();
    }
    // Ctrl/Cmd + S = Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      editor.store();
    }
  });
}

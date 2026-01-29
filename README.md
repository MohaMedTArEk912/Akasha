# GrapesJS Ultimate Editor

A powerful, customizable drag-and-drop web page builder powered by GrapesJS.

![GrapesJS Editor](https://img.shields.io/badge/GrapesJS-Editor-6366f1?style=for-the-badge)

## Features

- 🎨 **Modern Dark UI** - Sleek gradient-based theme with purple/pink accents
- 📱 **Device Preview** - Desktop, Tablet, and Mobile responsive views
- 📦 **25+ Pre-built Blocks** - Basic, Layout, Components, and Forms
- 💾 **Auto-Save** - LocalStorage persistence
- 📤 **Export** - Download your page as HTML
- ⌨️ **Keyboard Shortcuts** - Undo, Redo, Save

## Quick Start

`ash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
`

## Project Structure

`
grapes-editor/
├── index.html          # Main HTML file
├── package.json        # NPM configuration
├── vite.config.js      # Vite dev server config
└── src/
    ├── main.js         # Editor initialization
    ├── blocks.js       # Custom block definitions
    └── styles.css      # All styling
`

## Available Blocks

### Basic
- Section, Text, Image, Video, Map, Link, Link Block

### Layout
- 1 Column, 2 Columns, 3 Columns, 2 Columns (3/7 ratio)

### Components
- Button, Divider, Quote, Hero Section, Card, Testimonial, Pricing Card, Navbar, Footer

### Forms
- Form, Input, Textarea, Select, Checkbox, Radio

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+S | Save |

## License

MIT

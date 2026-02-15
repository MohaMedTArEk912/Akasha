//! Sync Engine - Handles bidirectional synchronization between IDE and file system
//!
//! This engine maps BlockSchema entities to physical TSX/CSS files and
//! parses code changes back into the schema.

use crate::generator::pascal_case;
use crate::schema::ProjectSchema;
use std::fs;
use std::path::PathBuf;

pub struct SyncEngine {
    pub root_path: PathBuf,
}

impl SyncEngine {
    pub fn new(root_path: impl Into<PathBuf>) -> Self {
        Self {
            root_path: root_path.into(),
        }
    }

    fn pages_dir(&self) -> PathBuf {
        self.root_path.join("client/src/pages")
    }

    fn legacy_pages_dir(&self) -> PathBuf {
        self.root_path.join("client/page")
    }

    fn components_dir(&self) -> PathBuf {
        self.root_path.join("client/src/components")
    }

    /// Ensure a component TSX file exists for the given block type.
    /// Creates the file with a default template if it doesn't exist.
    /// Returns the PascalCase component name.
    pub fn ensure_component_file(
        &self,
        block_type: &crate::schema::BlockType,
    ) -> std::io::Result<String> {
        let comp_name = Self::block_type_to_component_name(block_type);
        let comp_dir = self.components_dir();
        fs::create_dir_all(&comp_dir)?;

        let file_path = comp_dir.join(format!("{}.tsx", comp_name));
        if !file_path.exists() {
            let template = Self::component_template(block_type, &comp_name);
            fs::write(&file_path, template)?;
        }
        Ok(comp_name)
    }

    /// Map BlockType to a PascalCase component file name
    fn block_type_to_component_name(bt: &crate::schema::BlockType) -> String {
        use crate::schema::BlockType;
        match bt {
            BlockType::Container => "Container".into(),
            BlockType::Section => "Section".into(),
            BlockType::Card => "Card".into(),
            BlockType::Heading => "Heading".into(),
            BlockType::Text => "Text".into(),
            BlockType::Paragraph => "Paragraph".into(),
            BlockType::Button => "Button".into(),
            BlockType::Image => "Image".into(),
            BlockType::Input => "Input".into(),
            BlockType::Link => "Link".into(),
            BlockType::Form => "Form".into(),
            BlockType::Flex => "FlexBox".into(),
            BlockType::Grid => "GridLayout".into(),
            BlockType::Columns => "Columns".into(),
            BlockType::Column => "Column".into(),
            BlockType::Modal => "Modal".into(),
            BlockType::Tabs => "Tabs".into(),
            BlockType::Table => "DataTable".into(),
            BlockType::List => "ListBlock".into(),
            BlockType::Video => "Video".into(),
            BlockType::Icon => "Icon".into(),
            BlockType::TextArea => "TextArea".into(),
            BlockType::Select => "Select".into(),
            BlockType::Checkbox => "Checkbox".into(),
            BlockType::Radio => "Radio".into(),
            BlockType::Dropdown => "Dropdown".into(),
            BlockType::Accordion => "Accordion".into(),
            BlockType::Page => "PageWrapper".into(),
            BlockType::Instance => "ComponentInstance".into(),
            BlockType::Custom(s) => pascal_case(s),
        }
    }

    /// Generate a React component template for the given block type
    fn component_template(bt: &crate::schema::BlockType, name: &str) -> String {
        use crate::schema::BlockType;
        match bt {
            BlockType::Container | BlockType::Section | BlockType::Card => format!(
                r#"import React from 'react';
// @akasha-component type="{tag}"

interface {name}Props {{
  children?: React.ReactNode;
  className?: string;
}}

export default function {name}({{ children, className = '' }}: {name}Props) {{
  return (
    <div className={{`{default_cls} ${{className}}`}}>
      {{children}}
    </div>
  );
}}
"#,
                tag = name.to_lowercase(),
                name = name,
                default_cls = match bt {
                    BlockType::Card => "bg-white rounded-xl shadow-md p-6",
                    BlockType::Section => "py-12 px-4",
                    _ => "w-full",
                }
            ),
            BlockType::Heading => format!(
                r#"import React from 'react';
// @akasha-component type="heading"

interface {name}Props {{
  text?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
}}

export default function {name}({{ text = 'Heading', level = 1, className = '' }}: {name}Props) {{
  const Tag = `h${{level}}` as keyof JSX.IntrinsicElements;
  return <Tag className={{`font-bold text-gray-900 ${{className}}`}}>{{text}}</Tag>;
}}
"#,
                name = name
            ),
            BlockType::Text | BlockType::Paragraph => format!(
                r#"import React from 'react';
// @akasha-component type="text"

interface {name}Props {{
  text?: string;
  className?: string;
}}

export default function {name}({{ text = 'Text content', className = '' }}: {name}Props) {{
  return <p className={{`text-gray-600 ${{className}}`}}>{{text}}</p>;
}}
"#,
                name = name
            ),
            BlockType::Button => format!(
                r#"import React from 'react';
// @akasha-component type="button"

interface {name}Props {{
  text?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
}}

export default function {name}({{ text = 'Button', onClick, variant = 'primary', className = '' }}: {name}Props) {{
  const base = 'px-6 py-2.5 rounded-lg font-medium transition-all duration-200';
  const variants = {{
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md',
    secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
    outline: 'border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50',
  }};
  return (
    <button onClick={{onClick}} className={{`${{base}} ${{variants[variant]}} ${{className}}`}}>
      {{text}}
    </button>
  );
}}
"#,
                name = name
            ),
            BlockType::Input | BlockType::TextArea => format!(
                r#"import React from 'react';
// @akasha-component type="input"

interface {name}Props {{
  placeholder?: string;
  label?: string;
  type?: string;
  className?: string;
}}

export default function {name}({{ placeholder = 'Enter text...', label, type = 'text', className = '' }}: {name}Props) {{
  return (
    <div className={{`${{className}}`}}>
      {{label && <label className="block text-sm font-medium text-gray-700 mb-1">{{label}}</label>}}
      <input type={{type}} placeholder={{placeholder}} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all" />
    </div>
  );
}}
"#,
                name = name
            ),
            BlockType::Image => format!(
                r#"import React from 'react';
// @akasha-component type="image"

interface {name}Props {{
  src?: string;
  alt?: string;
  className?: string;
}}

export default function {name}({{ src = 'https://via.placeholder.com/400x300', alt = 'Image', className = '' }}: {name}Props) {{
  return <img src={{src}} alt={{alt}} className={{`max-w-full rounded-lg ${{className}}`}} />;
}}
"#,
                name = name
            ),
            // Fallback: generic wrapper component
            _ => format!(
                r#"import React from 'react';
// @akasha-component type="{tag}"

interface {name}Props {{
  children?: React.ReactNode;
  className?: string;
}}

export default function {name}({{ children, className = '' }}: {name}Props) {{
  return (
    <div className={{`${{className}}`}}>
      {{children || '{name} Component'}}
    </div>
  );
}}
"#,
                tag = name.to_lowercase(),
                name = name
            ),
        }
    }

    /// Initialize the physical directory structure for a new project
    pub fn init_project_structure(&self, project: &ProjectSchema) -> std::io::Result<()> {
        // Create root
        fs::create_dir_all(&self.root_path)?;

        // --- Client Structure ---
        let client_path = self.root_path.join("client");
        let client_src_path = client_path.join("src");
        let pages_path = client_src_path.join("pages");
        let components_path = client_src_path.join("components");
        let public_path = client_path.join("public");
        fs::create_dir_all(&client_src_path)?;
        fs::create_dir_all(&pages_path)?;
        fs::create_dir_all(&components_path)?;
        fs::create_dir_all(&public_path)?;

        // --- Server Structure ---
        let server_path = self.root_path.join("server");
        let server_src_path = server_path.join("src");
        let services_path = server_src_path.join("services");
        fs::create_dir_all(&services_path)?;

        // Write akasha.config.json
        let config_path = self.root_path.join("akasha.config.json");
        let config_json = serde_json::to_string_pretty(project).unwrap();
        fs::write(config_path, config_json)?;

        // --- Client Boilerplate ---

        // package.json
        let client_package_json = r#"{
  "name": "akasha-client",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@types/react-router-dom": "^5.3.3",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}"#;
        fs::write(client_path.join("package.json"), client_package_json)?;

        // tsconfig.json
        let client_tsconfig = r#"{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}"#;
        fs::write(client_path.join("tsconfig.json"), client_tsconfig)?;

        // tsconfig.node.json
        let client_tsconfig_node = r#"{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}"#;
        fs::write(client_path.join("tsconfig.node.json"), client_tsconfig_node)?;

        // vite.config.ts
        let vite_config = r#"import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
"#;
        fs::write(client_path.join("vite.config.ts"), vite_config)?;

        // tailwind.config.js
        let tailwind_config = r#"/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
"#;
        fs::write(client_path.join("tailwind.config.js"), tailwind_config)?;

        // postcss.config.js
        let postcss_config = r#"export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
"#;
        fs::write(client_path.join("postcss.config.js"), postcss_config)?;

        // index.html
        let index_html = format!(
            r#"<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
"#,
            project.name
        );
        fs::write(client_path.join("index.html"), index_html)?;

        // src/main.tsx
        let main_tsx = r#"import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
"#;
        fs::write(client_src_path.join("main.tsx"), main_tsx)?;

        // src/App.tsx
        let app_tsx = r#"import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';

/**
 * App Component
 * 
 * Main entry point for the scaffolded React application.
 */
function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
"#;
        fs::write(client_src_path.join("App.tsx"), app_tsx)?;

        // src/index.css
        let index_css = r#"@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
"#;
        fs::write(client_src_path.join("index.css"), index_css)?;

        // --- Server Boilerplate ---

        // package.json
        let server_package_json = r#"{
  "name": "akasha-server",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}"#;
        fs::write(server_path.join("package.json"), server_package_json)?;

        // tsconfig.json
        let server_tsconfig = r#"{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}"#;
        fs::write(server_path.join("tsconfig.json"), server_tsconfig)?;

        // src/index.ts
        let server_index_ts = r#"/**
 * Akasha Server Entry Point
 */

import { createServer } from 'node:http';

const port = process.env.PORT || 3001;

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Akasha Server is running',
    timestamp: new Date().toISOString()
  }));
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
"#;
        fs::write(server_src_path.join("index.ts"), server_index_ts)?;

        Ok(())
    }

    /// Sync a page to disk
    /// Sync a page to disk
    pub fn sync_page_to_disk(&self, page_id: &str, project: &ProjectSchema) -> std::io::Result<()> {
        let page = project
            .find_page(page_id)
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Page not found"))?;

        // Map page to dedicated source pages folder
        let page_dir = self.pages_dir();
        fs::create_dir_all(&page_dir)?;

        let mut page_content = String::new();
        page_content.push_str("import React from 'react';\n");

        // 1. Collect and import used components
        let mut used_components = std::collections::HashSet::new();
        if let Some(root_id) = &page.root_block_id {
            self.collect_used_components(root_id, project, &mut used_components);
        }

        // Ensure component files exist and generate imports
        let mut sorted_components: Vec<_> = used_components.into_iter().collect();
        sorted_components.sort();

        for comp_name in sorted_components {
            // Make sure the file exists in client/src/components/
            // We map the name back to a BlockType if possible, or defaulting to Container if not ideal.
            // Ideally we should pass the BlockType here, but we only store names in the Set.
            // Optimization: collect (BlockType, ComponentName) tuples?
            // For now, let's trust ensure_component_file is called during block creation/update.
            // BUT: if we pull a fresh repo, files might be missing.
            // Only way to ensure is to look up a block of that type?
            // Actually, we called collect_used_components which iterates blocks.
            // We should ensure files *during* collection or just rely on the API to have done it?
            // Let's rely on the API for now to avoid looking up BlockType from string name.

            page_content.push_str(&format!(
                "import {} from '../components/{}';\n",
                comp_name, comp_name
            ));
        }
        page_content.push('\n');

        page_content.push_str(&format!(
            "export default function {}() {{\n",
            pascal_case(&page.name)
        ));
        page_content.push_str("  return (\n    <div className=\"min-h-screen bg-white\">\n");

        if let Some(root_id) = &page.root_block_id {
            if let Some(block) = project.find_block(root_id) {
                if !block.archived {
                    self.append_block_to_content(&mut page_content, block, project, 3);
                }
            }
        }

        page_content.push_str("    </div>\n  );\n}");

        let file_name = format!("{}.tsx", pascal_case(&page.name));
        let tsx_path = page_dir.join(&file_name);
        fs::write(tsx_path, page_content)?;

        // Migration cleanup: remove any legacy copy if present
        let legacy_path = self.legacy_pages_dir().join(file_name);
        if legacy_path.exists() {
            let _ = fs::remove_file(legacy_path);
        }

        self.sync_app_routes_to_disk(project)?;

        Ok(())
    }

    /// Delete a page's physical file from disk
    pub fn delete_page_from_disk(
        &self,
        page_name: &str,
        project: &ProjectSchema,
    ) -> std::io::Result<()> {
        let file_name = format!("{}.tsx", pascal_case(page_name));
        let tsx_path = self.pages_dir().join(&file_name);
        let legacy_path = self.legacy_pages_dir().join(&file_name);

        if tsx_path.exists() {
            fs::remove_file(tsx_path)?;
        }
        if legacy_path.exists() {
            fs::remove_file(legacy_path)?;
        }

        // Always refresh routes
        self.sync_app_routes_to_disk(project)?;

        Ok(())
    }

    fn sync_app_routes_to_disk(&self, project: &ProjectSchema) -> std::io::Result<()> {
        let mut imports = String::new();
        let mut routes = String::new();

        for page in project.pages.iter().filter(|page| !page.archived) {
            let component_name = pascal_case(&page.name);
            if component_name.is_empty() {
                continue;
            }

            imports.push_str(&format!(
                "import {} from './pages/{}';\n",
                component_name, component_name
            ));

            let route_path = if page.path.trim().is_empty() {
                "/"
            } else {
                page.path.as_str()
            };
            routes.push_str(&format!(
                "          <Route path=\"{}\" element={{<{} />}} />\n",
                route_path, component_name
            ));
        }

        if routes.is_empty() {
            routes.push_str("          <Route path=\"/\" element={<div className=\"p-8 text-center text-gray-500\">Welcome to Akasha App</div>} />\n");
        }

        let app_content = format!(
            r#"import {{ BrowserRouter, Routes, Route }} from 'react-router-dom';
{imports}
function App() {{
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <Routes>
{routes}        </Routes>
      </div>
    </BrowserRouter>
  );
}}

export default App;
"#,
            imports = imports,
            routes = routes
        );

        fs::write(self.root_path.join("client/src/App.tsx"), app_content)?;
        Ok(())
    }

    fn collect_used_components(
        &self,
        block_id: &str,
        project: &ProjectSchema,
        components: &mut std::collections::HashSet<String>,
    ) {
        if let Some(block) = project.find_block(block_id) {
            if !block.archived {
                let comp_name = Self::block_type_to_component_name(&block.block_type);

                // Ensure the component file exists immediately
                let _ = self.ensure_component_file(&block.block_type);

                components.insert(comp_name);

                for child_id in &block.children {
                    self.collect_used_components(child_id, project, components);
                }
            }
        }
    }

    fn append_block_to_content(
        &self,
        content: &mut String,
        block: &crate::schema::BlockSchema,
        project: &ProjectSchema,
        indent: usize,
    ) {
        let indent_str = "  ".repeat(indent);
        let comp_name = Self::block_type_to_component_name(&block.block_type);

        let classes = block.classes.join(" ");
        let inner_text = block
            .properties
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        // Build props string
        let mut props = String::new();
        if !classes.is_empty() {
            props.push_str(&format!(" className=\"{}\"", classes));
        }

        // Add specific props based on block type
        match block.block_type {
            crate::schema::BlockType::Button => {
                if !inner_text.is_empty() {
                    props.push_str(&format!(" text=\"{}\"", inner_text));
                }
                // Check variant property
                if let Some(variant) = block.properties.get("variant").and_then(|v| v.as_str()) {
                    props.push_str(&format!(" variant=\"{}\"", variant));
                }
            }
            crate::schema::BlockType::Heading => {
                if !inner_text.is_empty() {
                    props.push_str(&format!(" text=\"{}\"", inner_text));
                }
                if let Some(level) = block.properties.get("level").and_then(|v| v.as_u64()) {
                    props.push_str(&format!(" level={{{}}}", level));
                }
            }
            crate::schema::BlockType::Text | crate::schema::BlockType::Paragraph => {
                if !inner_text.is_empty() {
                    props.push_str(&format!(" text=\"{}\"", inner_text));
                }
            }
            crate::schema::BlockType::Image => {
                if let Some(src) = block.properties.get("src").and_then(|v| v.as_str()) {
                    props.push_str(&format!(" src=\"{}\"", src));
                }
                if let Some(alt) = block.properties.get("alt").and_then(|v| v.as_str()) {
                    props.push_str(&format!(" alt=\"{}\"", alt));
                }
            }
            crate::schema::BlockType::Input => {
                if let Some(ph) = block.properties.get("placeholder").and_then(|v| v.as_str()) {
                    props.push_str(&format!(" placeholder=\"{}\"", ph));
                }
                if let Some(lbl) = block.properties.get("label").and_then(|v| v.as_str()) {
                    props.push_str(&format!(" label=\"{}\"", lbl));
                }
            }
            crate::schema::BlockType::Link => {
                if let Some(href) = block.properties.get("href").and_then(|v| v.as_str()) {
                    props.push_str(&format!(" href=\"{}\"", href));
                }
                // Links inside might wrap text or children
            }
            _ => {}
        }

        content.push_str(&format!(
            "{indent_str}/* @akasha-block id=\"{}\" */\n",
            block.id
        ));

        // Self-closing or with children?
        // Text/Heading/Button/Input/Image are usually self-closing in our component design (props drive content)
        // Container types have children.
        let is_container = matches!(
            block.block_type,
            crate::schema::BlockType::Container
                | crate::schema::BlockType::Section
                | crate::schema::BlockType::Card
                | crate::schema::BlockType::Flex
                | crate::schema::BlockType::Grid
                | crate::schema::BlockType::Columns
                | crate::schema::BlockType::Column
                | crate::schema::BlockType::Page
                | crate::schema::BlockType::List
                | crate::schema::BlockType::Form
        );

        if is_container {
            content.push_str(&format!("{indent_str}<{}{}>\n", comp_name, props));

            if !block.children.is_empty() {
                for child_id in &block.children {
                    if let Some(child) = project.find_block(child_id) {
                        self.append_block_to_content(content, child, project, indent + 1);
                    }
                }
            }

            content.push_str(&format!("{indent_str}</{}>\n", comp_name));
        } else {
            content.push_str(&format!("{indent_str}<{}{} />\n", comp_name, props));
        }

        content.push_str(&format!("{indent_str}/* @akasha-block-end */\n"));
    }

    /// Sync the page containing a specific block to disk
    pub fn sync_page_to_disk_by_block(
        &self,
        block_id: &str,
        project: &ProjectSchema,
    ) -> std::io::Result<()> {
        // Find which page contains this block
        for page in &project.pages {
            if page.archived {
                continue;
            }

            // Check if this block is the root or reachable from root
            if let Some(root_id) = &page.root_block_id {
                if self.is_block_in_tree(block_id, root_id, project) {
                    return self.sync_page_to_disk(&page.id, project);
                }
            }
        }
        Ok(())
    }

    fn is_block_in_tree(&self, target_id: &str, current_id: &str, project: &ProjectSchema) -> bool {
        if target_id == current_id {
            return true;
        }
        if let Some(block) = project.find_block(current_id) {
            for child_id in &block.children {
                if self.is_block_in_tree(target_id, child_id, project) {
                    return true;
                }
            }
        }
        false
    }

    /// Parse all pages from disk and update the project schema
    pub fn sync_disk_to_project(&self, project: &mut ProjectSchema) -> std::io::Result<()> {
        let mut updates = Vec::new();

        // 1. Collect all updates first (immutable phase)
        for page in &project.pages {
            if page.archived {
                continue;
            }

            let file_name = format!("{}.tsx", pascal_case(&page.name));
            let mut tsx_path = self.pages_dir().join(&file_name);
            if !tsx_path.exists() {
                // Backward compatibility for older projects
                tsx_path = self.legacy_pages_dir().join(file_name);
            }

            if tsx_path.exists() {
                let content = fs::read_to_string(tsx_path)?;
                let parsed_blocks = self.parse_file_to_blocks(&content);
                updates.push(parsed_blocks);
            }
        }

        // 2. Apply updates (mutable phase)
        for parsed_blocks in updates {
            for parsed_block in parsed_blocks {
                if let Some(existing_block) = project.find_block_mut(&parsed_block.id) {
                    existing_block.block_type = parsed_block.block_type;
                    existing_block.classes = parsed_block.classes;
                    existing_block.properties = parsed_block.properties;
                }
            }
        }
        Ok(())
    }

    /// Parse a TSX file and update the project schema based on markers
    pub fn parse_file_to_blocks(&self, file_content: &str) -> Vec<crate::schema::BlockSchema> {
        let mut blocks = Vec::new();

        // Regex for block markers
        let block_re = regex::Regex::new(
            r#"(?s)/\* @akasha-block id="([^"]+)" \*/(.*?)/\* @akasha-block-end \*/"#,
        )
        .unwrap();
        // Regex for basic prop extraction from the first tag in the block
        // Matches <tag className="...">Content</tag>
        let prop_re =
            regex::Regex::new(r#"<([a-z0-9]+)[^>]*\bclassName="([^"]*)"\b[^>]*>([^<]*)</[a-z0-9]+>"#).unwrap();

        for cap in block_re.captures_iter(file_content) {
            let id = cap[1].to_string();
            let inner_content = &cap[2].trim();

            // Default block
            let mut block = crate::schema::BlockSchema::new(
                id,
                crate::schema::BlockType::Container,
                "Synced Block",
            );

            // Try to extract metadata from the tag
            if let Some(prop_cap) = prop_re.captures(inner_content) {
                let tag = &prop_cap[1];
                let classes = &prop_cap[2];
                let text = &prop_cap[3];

                block.block_type = match tag {
                    "button" => crate::schema::BlockType::Button,
                    "h1" | "h2" | "h3" => crate::schema::BlockType::Heading,
                    "p" => crate::schema::BlockType::Paragraph,
                    _ => crate::schema::BlockType::Container,
                };

                block.classes = classes.split_whitespace().map(|s| s.to_string()).collect();
                if !text.contains('<') {
                    // Only set text if it doesn't contain other tags
                    block
                        .properties
                        .insert("text".into(), serde_json::Value::String(text.to_string()));
                }
            }

            blocks.push(block);
        }

        blocks
    }
}

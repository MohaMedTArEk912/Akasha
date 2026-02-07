//! Sync Engine - Handles bidirectional synchronization between IDE and file system
//! 
//! This engine maps BlockSchema entities to physical TSX/CSS files and 
//! parses code changes back into the schema.

use std::path::PathBuf;
use std::fs;
use crate::schema::ProjectSchema;
use crate::generator::pascal_case;

pub struct SyncEngine {
    pub root_path: PathBuf,
}

impl SyncEngine {
    pub fn new(root_path: impl Into<PathBuf>) -> Self {
        Self {
            root_path: root_path.into(),
        }
    }

    /// Initialize the physical directory structure for a new project
    pub fn init_project_structure(&self, project: &ProjectSchema) -> std::io::Result<()> {
        // Create root
        fs::create_dir_all(&self.root_path)?;

        // --- Client Structure ---
        let client_path = self.root_path.join("client");
        let client_src_path = client_path.join("src");
        let pages_path = client_path.join("page");
        let public_path = client_path.join("public");
        fs::create_dir_all(&client_src_path)?;
        fs::create_dir_all(&pages_path)?;
        fs::create_dir_all(&public_path)?;

        // --- Server Structure ---
        let server_path = self.root_path.join("server");
        let server_src_path = server_path.join("src");
        let services_path = server_src_path.join("services");
        fs::create_dir_all(&services_path)?;

        // Write grapes.config.json
        let config_path = self.root_path.join("grapes.config.json");
        let config_json = serde_json::to_string_pretty(project).unwrap();
        fs::write(config_path, config_json)?;

        // --- Client Boilerplate ---
        
        // package.json
        let client_package_json = r#"{
  "name": "grapes-client",
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
        let index_html = format!(r#"<!DOCTYPE html>
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
"#, project.name);
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
import Home from '../page/Home';

/**
 * App Component
 * 
 * Main entry point for the scaffolded React application.
 */
function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
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
  "name": "grapes-server",
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
 * Grapes Server Entry Point
 */

import { createServer } from 'node:http';

const port = process.env.PORT || 3001;

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Grapes Server is running',
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
    pub fn sync_page_to_disk(&self, page_id: &str, project: &ProjectSchema) -> std::io::Result<()> {
        let page = project.find_page(page_id).ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Page not found"))?;
        
        // Map page to dedicated page folder
        let page_dir = self.root_path.join("client/page");
        fs::create_dir_all(&page_dir)?;

        let mut page_content = format!("// @grapes-page id=\"{}\"\n", page.id);
        page_content.push_str("import React from 'react';\n\n");
        page_content.push_str(&format!("export default function {}() {{\n", pascal_case(&page.name)));
        page_content.push_str("  return (\n    <div className=\"min-h-screen bg-white\">\n");

        if let Some(root_id) = &page.root_block_id {
            if let Some(block) = project.find_block(root_id) {
                if !block.archived {
                    self.append_block_to_content(&mut page_content, block, project, 3);
                }
            }
        }

        page_content.push_str("    </div>\n  );\n}");
        
        let tsx_path = page_dir.join(format!("{}.tsx", pascal_case(&page.name)));
        fs::write(tsx_path, page_content)?;
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
                "import {} from '../page/{}';\n",
                component_name, component_name
            ));

            let route_path = if page.path.trim().is_empty() { "/" } else { page.path.as_str() };
            routes.push_str(&format!(
                "          <Route path=\"{}\" element={{<{} />}} />\n",
                route_path, component_name
            ));
        }

        if routes.is_empty() {
            routes.push_str("          <Route path=\"/\" element={<div className=\"p-8 text-center text-gray-500\">Welcome to Grapes App</div>} />\n");
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

    fn append_block_to_content(&self, content: &mut String, block: &crate::schema::BlockSchema, project: &ProjectSchema, indent: usize) {
        let indent_str = "  ".repeat(indent);
        let tag = match block.block_type {
            crate::schema::BlockType::Button => "button",
            crate::schema::BlockType::Heading => "h1",
            crate::schema::BlockType::Text | crate::schema::BlockType::Paragraph => "p",
            _ => "div",
        };

        let classes = block.classes.join(" ");
        let inner_text = block.properties.get("text").and_then(|v| v.as_str()).unwrap_or("");

        content.push_str(&format!("{indent_str}/* @grapes-block id=\"{}\" */\n", block.id));
        content.push_str(&format!("{indent_str}<{tag} className=\"{classes}\">{inner_text}", tag = tag, classes = classes, inner_text = inner_text));
        
        if !block.children.is_empty() {
            content.push('\n');
            for child_id in &block.children {
                if let Some(child) = project.find_block(child_id) {
                    self.append_block_to_content(content, child, project, indent + 1);
                }
            }
            content.push_str(&format!("{indent_str}</{tag}>\n", tag = tag));
        } else {
            content.push_str(&format!("</{tag}>\n", tag = tag));
        }
        
        content.push_str(&format!("{indent_str}/* @grapes-block-end */\n"));
    }

    /// Sync the page containing a specific block to disk
    pub fn sync_page_to_disk_by_block(&self, block_id: &str, project: &ProjectSchema) -> std::io::Result<()> {
        // Find which page contains this block
        for page in &project.pages {
            if page.archived { continue; }
            
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
        if target_id == current_id { return true; }
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
            if page.archived { continue; }

            let tsx_path = self.root_path.join("client/page").join(format!("{}.tsx", pascal_case(&page.name)));

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
        let block_re = regex::Regex::new(r#"(?s)/\* @grapes-block id="([^"]+)" \*/(.*?)/\* @grapes-block-end \*/"#).unwrap();
        // Regex for basic prop extraction from the first tag in the block
        // Matches <tag className="...">Content</tag>
        let prop_re = regex::Regex::new(r#"<([a-z0-9]+)\s+className="([^"]*)"\s*>(.*?)</\1>"#).unwrap();

        for cap in block_re.captures_iter(file_content) {
            let id = cap[1].to_string();
            let inner_content = &cap[2].trim();
            
            // Default block
            let mut block = crate::schema::BlockSchema::new(id, crate::schema::BlockType::Container, "Synced Block");
            
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
                if !text.contains('<') { // Only set text if it doesn't contain other tags
                    block.properties.insert("text".into(), serde_json::Value::String(text.to_string()));
                }
            }
            
            blocks.push(block);
        }
        
        blocks
    }
}

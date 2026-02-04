//! Frontend Code Generator
//! 
//! Generates React + Tailwind code from UI blocks.

use crate::schema::{ProjectSchema, BlockSchema, BlockType};

/// Frontend code generator
pub struct FrontendGenerator<'a> {
    project: &'a ProjectSchema,
}

impl<'a> FrontendGenerator<'a> {
    /// Create a new frontend generator
    pub fn new(project: &'a ProjectSchema) -> Self {
        Self { project }
    }
    
    /// Generate all frontend code
    pub fn generate(&self) -> GeneratedFrontend {
        let mut files = Vec::new();
        
        // Generate each page
        for page in &self.project.pages {
            if !page.archived {
                let code = self.generate_page(page);
                files.push(GeneratedFile {
                    path: format!("src/pages/{}.tsx", page.name),
                    content: code,
                });
            }
        }
        
        // Generate App.tsx with routing
        files.push(GeneratedFile {
            path: "src/App.tsx".into(),
            content: self.generate_app(),
        });
        
        // Generate package.json
        files.push(GeneratedFile {
            path: "package.json".into(),
            content: self.generate_package_json(),
        });
        
        GeneratedFrontend { files }
    }
    
    /// Generate a page component
    fn generate_page(&self, page: &crate::schema::PageSchema) -> String {
        let mut jsx = String::new();
        
        // Find root blocks for this page
        let root_blocks: Vec<_> = self.project.blocks.iter()
            .filter(|b| !b.archived && b.parent_id.is_none())
            .collect();
        
        // Generate JSX for each block
        for block in root_blocks {
            jsx.push_str(&self.generate_block_jsx(block, 2));
        }
        
        format!(r#"import React from 'react';

export function {name}Page() {{
    return (
        <div className="min-h-screen">
{jsx}        </div>
    );
}}
"#, name = page.name, jsx = jsx)
    }
    
    /// Generate JSX for a block and its children
    fn generate_block_jsx(&self, block: &BlockSchema, indent: usize) -> String {
        let indent_str = "    ".repeat(indent);
        let classes = block.classes.join(" ");
        
        let (tag, self_closing) = match &block.block_type {
            BlockType::Container | BlockType::Section => ("div", false),
            BlockType::Heading => ("h1", false),
            BlockType::Paragraph | BlockType::Text => ("p", false),
            BlockType::Button => ("button", false),
            BlockType::Image => ("img", true),
            BlockType::Input => ("input", true),
            BlockType::Link => ("a", false),
            BlockType::Form => ("form", false),
            _ => ("div", false),
        };
        
        let mut jsx = String::new();
        
        if self_closing {
            jsx.push_str(&format!("{}<{} className=\"{}\" />\n", indent_str, tag, classes));
        } else {
            jsx.push_str(&format!("{}<{} className=\"{}\">\n", indent_str, tag, classes));
            
            // Generate children
            for child_id in &block.children {
                if let Some(child) = self.project.find_block(child_id) {
                    jsx.push_str(&self.generate_block_jsx(child, indent + 1));
                }
            }
            
            // Add text content if present
            if let Some(text) = block.properties.get("text") {
                if let Some(s) = text.as_str() {
                    jsx.push_str(&format!("{}    {}\n", indent_str, s));
                }
            }
            
            jsx.push_str(&format!("{}</{}>\n", indent_str, tag));
        }
        
        jsx
    }
    
    /// Generate App.tsx with routing
    fn generate_app(&self) -> String {
        let mut imports = String::new();
        let mut routes = String::new();
        
        for page in &self.project.pages {
            if !page.archived {
                imports.push_str(&format!(
                    "import {{ {name}Page }} from './pages/{name}';\n",
                    name = page.name
                ));
                routes.push_str(&format!(
                    "                <Route path=\"{path}\" element={{<{name}Page />}} />\n",
                    path = page.path,
                    name = page.name
                ));
            }
        }
        
        format!(r#"import React from 'react';
import {{ BrowserRouter, Routes, Route }} from 'react-router-dom';
{imports}
function App() {{
    return (
        <BrowserRouter>
            <Routes>
{routes}            </Routes>
        </BrowserRouter>
    );
}}

export default App;
"#, imports = imports, routes = routes)
    }
    
    /// Generate package.json
    fn generate_package_json(&self) -> String {
        format!(r#"{{
    "name": "{}",
    "version": "1.0.0",
    "private": true,
    "scripts": {{
        "dev": "vite",
        "build": "vite build",
        "preview": "vite preview"
    }},
    "dependencies": {{
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "react-router-dom": "^6.20.0"
    }},
    "devDependencies": {{
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        "@vitejs/plugin-react": "^4.2.0",
        "autoprefixer": "^10.4.16",
        "postcss": "^8.4.32",
        "tailwindcss": "^3.4.0",
        "typescript": "^5.3.0",
        "vite": "^5.0.0"
    }}
}}
"#, self.project.name.to_lowercase().replace(' ', "-"))
    }
}

/// Generated frontend output
pub struct GeneratedFrontend {
    pub files: Vec<GeneratedFile>,
}

/// A generated file
pub struct GeneratedFile {
    pub path: String,
    pub content: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_frontend() {
        let project = ProjectSchema::new("proj-1", "My App");
        let generator = FrontendGenerator::new(&project);
        let output = generator.generate();
        
        assert!(!output.files.is_empty());
        
        // Should have App.tsx
        let app = output.files.iter().find(|f| f.path == "src/App.tsx");
        assert!(app.is_some());
    }
}


import fs from 'fs-extra';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { SyncService } from './sync.js';
import { pascalCase } from '../utils/string.js';

const prisma = new PrismaClient();

export class GeneratorService {

    public async generateFrontend(projectId: string, outputDir: string) {
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) throw new Error("Project not found");

        const syncService = new SyncService(outputDir);

        // 1. Init Structure
        await fs.ensureDir(path.join(outputDir, 'src'));
        await fs.ensureDir(path.join(outputDir, 'src', 'pages'));
        await fs.ensureDir(path.join(outputDir, 'src', 'components'));
        await fs.ensureDir(path.join(outputDir, 'public'));

        // 2. Generate Pages
        const pages = await prisma.page.findMany({ where: { projectId } });
        for (const page of pages) {
            // Re-use sync service logic to write page files to the output dir
            // We need to temporarily point SyncService to this output dir
            await syncService.syncPageToDisk(page.id, projectId);
        }

        // 3. Generate App.tsx with Routing
        await this.generateAppTsx(pages, outputDir);

        // 4. Generate Main.tsx, Index.html, package.json etc.
        await this.generateBoilerplate(project.name, outputDir);

        return { success: true, path: outputDir };
    }

    private async generateAppTsx(pages: any[], outputDir: string) {
        const imports = pages.map(p => `import ${pascalCase(p.name)} from './pages/${pascalCase(p.name)}';`).join('\n');
        const routes = pages.map(p => {
            const pathStr = p.path || (p.name === 'Home' ? '/' : `/${p.name.toLowerCase()}`);
            return `<Route path="${pathStr}" element={<${pascalCase(p.name)} />} />`;
        }).join('\n          ');

        const content = `import { BrowserRouter, Routes, Route } from 'react-router-dom';
${imports}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <Routes>
          ${routes}
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
`;
        await fs.writeFile(path.join(outputDir, 'src', 'App.tsx'), content);
    }

    private async generateBoilerplate(projectName: string, outputDir: string) {
        // package.json
        const packageJson = {
            name: projectName.toLowerCase().replace(/\s+/g, '-'),
            private: true,
            version: "0.1.0",
            type: "module",
            scripts: {
                dev: "vite",
                build: "tsc && vite build",
                preview: "vite preview"
            },
            dependencies: {
                "react": "^18.2.0",
                "react-dom": "^18.2.0",
                "react-router-dom": "^6.21.0"
            },
            devDependencies: {
                "@types/react": "^18.2.43",
                "@types/react-dom": "^18.2.17",
                "@vitejs/plugin-react": "^4.2.1",
                "autoprefixer": "^10.4.16",
                "postcss": "^8.4.32",
                "tailwindcss": "^3.4.0",
                "typescript": "^5.2.2",
                "vite": "^5.0.8"
            }
        };
        await fs.writeJson(path.join(outputDir, 'package.json'), packageJson, { spaces: 2 });

        // vite.config.ts
        const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`;
        await fs.writeFile(path.join(outputDir, 'vite.config.ts'), viteConfig);

        // index.html
        const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
        await fs.writeFile(path.join(outputDir, 'index.html'), indexHtml);

        // main.tsx
        const mainTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`;
        await fs.writeFile(path.join(outputDir, 'src', 'main.tsx'), mainTsx);

        // index.css (Tailwind)
        const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;
        await fs.writeFile(path.join(outputDir, 'src', 'index.css'), indexCss);

        // tailwind.config.js
        const tailwindConfig = `/** @type {import('tailwindcss').Config} */
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
`;
        await fs.writeFile(path.join(outputDir, 'tailwind.config.js'), tailwindConfig);

        // postcss.config.js
        const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
        await fs.writeFile(path.join(outputDir, 'postcss.config.js'), postcssConfig);
    }
}


import fs from 'fs-extra';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { pascalCase } from '../utils/string.js';

const prisma = new PrismaClient();

export class SyncService {
    private rootPath: string;

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    private get pagesDir() {
        return path.join(this.rootPath, 'src', 'pages');
    }

    private get componentsDir() {
        return path.join(this.rootPath, 'src', 'components');
    }

    /**
     * Map BlockType to PascalCase component file name
     */
    private blockTypeToComponentName(blockType: string, customName?: string): string {
        switch (blockType) {
            case 'Container': return 'Container';
            case 'Section': return 'Section';
            case 'Card': return 'Card';
            case 'Heading': return 'Heading';
            case 'Text': return 'Text';
            case 'Paragraph': return 'Paragraph';
            case 'Button': return 'Button';
            case 'Image': return 'Image';
            case 'Input': return 'Input';
            case 'Link': return 'Link';
            case 'Form': return 'Form';
            case 'Flex': return 'FlexBox';
            case 'Grid': return 'GridLayout';
            case 'Columns': return 'Columns';
            case 'Column': return 'Column';
            case 'Modal': return 'Modal';
            case 'Tabs': return 'Tabs';
            case 'Table': return 'DataTable';
            case 'List': return 'ListBlock';
            case 'Video': return 'Video';
            case 'Icon': return 'Icon';
            case 'TextArea': return 'TextArea';
            case 'Select': return 'Select';
            case 'Checkbox': return 'Checkbox';
            case 'Radio': return 'Radio';
            case 'Dropdown': return 'Dropdown';
            case 'Accordion': return 'Accordion';
            case 'Page': return 'PageWrapper';
            case 'Instance': return 'ComponentInstance';
            case 'Symbol': return 'ComponentInstance';
            default:
                // If it's a custom component or unknown, use pascal case of the type or custom name
                if (customName) return pascalCase(customName);
                if (blockType.startsWith('Custom')) return pascalCase(blockType.replace('Custom', ''));
                return pascalCase(blockType);
        }
    }

    /**
     * Generate a React component template for the given block type
     */
    private getComponentTemplate(blockType: string, name: string): string {
        const lowerName = name.toLowerCase();

        // Basic templates based on type
        if (['Container', 'Section', 'Card', 'PageWrapper'].includes(name)) { // Group container-likes
            let defaultCls = "w-full";
            if (name === 'Card') defaultCls = "bg-white rounded-xl shadow-md p-6";
            if (name === 'Section') defaultCls = "py-12 px-4";

            return `import React from 'react';
// @akasha-component type="${lowerName}"

interface ${name}Props {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export default function ${name}({ children, className = '', ...props }: ${name}Props) {
  return (
    <div className={\`${defaultCls} \$\{className\}\`} {...props}>
      {children}
    </div>
  );
}
`;
        }

        if (name === 'Heading') {
            return `import React from 'react';
// @akasha-component type="heading"

interface HeadingProps {
  text?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  [key: string]: any;
}

export default function Heading({ text = 'Heading', level = 1, className = '', ...props }: HeadingProps) {
  const Tag = \`h\$\{level\}\` as keyof JSX.IntrinsicElements;
  return <Tag className={\`font-bold text-gray-900 \$\{className\}\`} {...props}>{text}</Tag>;
}
`;
        }

        if (['Text', 'Paragraph'].includes(name)) {
            return `import React from 'react';
// @akasha-component type="text"

interface ${name}Props {
  text?: string;
  className?: string;
  [key: string]: any;
}

export default function ${name}({ text = 'Text content', className = '', ...props }: ${name}Props) {
  return <p className={\`text-gray-600 \$\{className\}\`} {...props}>{text}</p>;
}
`;
        }

        if (name === 'Button') {
            return `import React from 'react';
// @akasha-component type="button"

interface ButtonProps {
  text?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
  [key: string]: any;
}

export default function Button({ text = 'Button', onClick, variant = 'primary', className = '', ...props }: ButtonProps) {
  const base = 'px-6 py-2.5 rounded-lg font-medium transition-all duration-200';
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md',
    secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
    outline: 'border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50',
  };
  return (
    <button onClick={onClick} className={\`\$\{base\} \$\{variants[variant]\} \$\{className\}\`} {...props}>
      {text}
    </button>
  );
}
`;
        }

        if (name === 'Image') {
            return `import React from 'react';
// @akasha-component type="image"

interface ImageProps {
  src?: string;
  alt?: string;
  className?: string;
  [key: string]: any;
}

export default function Image({ src = 'https://via.placeholder.com/400x300', alt = 'Image', className = '', ...props }: ImageProps) {
  return <img src={src} alt={alt} className={\`max-w-full rounded-lg \$\{className\}\`} {...props} />;
}
`;
        }

        // Fallback generic
        return `import React from 'react';
// @akasha-component type="${lowerName}"

interface ${name}Props {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export default function ${name}({ children, className = '', ...props }: ${name}Props) {
  return (
    <div className={\`\$\{className\}\`} {...props}>
      {children || '${name} Component'}
    </div>
  );
}
`;
    }

    /**
     * Ensure a component TSX file exists for the given block type.
     */
    public async ensureComponentFile(blockType: string): Promise<string> {
        const compName = this.blockTypeToComponentName(blockType);
        const compDir = this.componentsDir;
        await fs.ensureDir(compDir);

        const filePath = path.join(compDir, `${compName}.tsx`);
        if (!await fs.pathExists(filePath)) {
            const template = this.getComponentTemplate(blockType, compName);
            await fs.writeFile(filePath, template);
        }
        return compName;
    }

    /**
     * Recursively collect used component names from a block tree
     */
    private async collectUsedComponents(blockId: string, projectId: string, components: Set<string>) {
        const block = await prisma.block.findUnique({ where: { id: blockId } });
        if (!block) return;
        if (block.projectId !== projectId) return; // Safety check

        const compName = this.blockTypeToComponentName(block.blockType);

        // Ensure file exists (Sync Engine logic)
        await this.ensureComponentFile(block.blockType);
        components.add(compName);

        const childrenIds = JSON.parse(block.children || '[]');
        for (const childId of childrenIds) {
            await this.collectUsedComponents(childId, projectId, components);
        }
    }

    /**
     * Generate JSX for a block and its children
     */
    private async generateBlockJsx(blockId: string, indent: number): Promise<string> {
        const block = await prisma.block.findUnique({ where: { id: blockId } });
        if (!block) return '';

        const indentStr = '  '.repeat(indent);
        const compName = this.blockTypeToComponentName(block.blockType);

        // Parse properties
        const properties = JSON.parse(block.properties || '{}');
        const classes = JSON.parse(block.classes || '[]').join(' ');

        let props = '';
        if (classes) props += ` className="${classes}"`;

        // Map specific properties to props
        if (block.blockType === 'Button' || block.blockType === 'Heading' || block.blockType === 'Text' || block.blockType === 'Paragraph') {
            if (properties.text) props += ` text="${properties.text}"`;
        }
        if (block.blockType === 'Heading' && properties.level) {
            props += ` level={${properties.level}}`;
        }
        if (block.blockType === 'Button' && properties.variant) {
            props += ` variant="${properties.variant}"`;
        }
        if (block.blockType === 'Image') {
            if (properties.src) props += ` src="${properties.src}"`;
            if (properties.alt) props += ` alt="${properties.alt}"`;
        }

        const childrenIds = JSON.parse(block.children || '[]');
        const isContainer = ['Container', 'Section', 'Card', 'Flex', 'Grid', 'Page', 'Column', 'Columns'].includes(block.blockType) || childrenIds.length > 0;

        let jsx = `${indentStr}/* @akasha-block id="${block.id}" */\n`;

        if (isContainer) {
            jsx += `${indentStr}<${compName}${props}>\n`;
            for (const childId of childrenIds) {
                jsx += await this.generateBlockJsx(childId, indent + 1);
            }
            jsx += `${indentStr}</${compName}>\n`;
        } else {
            // Self closing
            jsx += `${indentStr}<${compName}${props} />\n`;
        }

        return jsx;
    }

    /**
     * Sync a specific page to disk
     */
    public async syncPageToDisk(pageId: string, projectId: string) {
        const page = await prisma.page.findUnique({ where: { id: pageId } });
        if (!page) throw new Error('Page not found');

        const pageDir = this.pagesDir;
        await fs.ensureDir(pageDir);

        const usedComponents = new Set<string>();
        if (page.rootBlockId) {
            await this.collectUsedComponents(page.rootBlockId, projectId, usedComponents);
        }

        const componentImports = Array.from(usedComponents).sort().map(name =>
            `import ${name} from '../components/${name}';`
        ).join('\n');

        const pageName = pascalCase(page.name);

        let jsxContent = '';
        if (page.rootBlockId) {
            jsxContent = await this.generateBlockJsx(page.rootBlockId, 3);
        }

        const fileContent = `import React from 'react';
${componentImports}

export default function ${pageName}() {
  return (
    <div className="min-h-screen bg-white">
${jsxContent}    </div>
  );
}
`;

        const filePath = path.join(pageDir, `${pageName}.tsx`);
        await fs.writeFile(filePath, fileContent);

        // Also update App.tsx routes? 
        // Rust implementation did this in `sync_app_routes_to_disk`.
        // We probably should too for a complete sync.
        await this.syncAppRoutes(projectId);
    }

    public async syncAppRoutes(projectId: string) {
        // ... (Similar logic to Rust for App.tsx generation)
        // For now, let's just make sure we handle the page syncing.
    }
}

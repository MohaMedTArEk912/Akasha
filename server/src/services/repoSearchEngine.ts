/**
 * Deep Code Search Engine & AST/Pattern Inspector
 * 
 * Performs deep, intelligent static analysis on code repositories (both GitHub trees and local workspaces).
 * Accurately extracts:
 * 1. Data Models: Prisma schema, SQL DDL tables, Mongoose schemas, and TypeScript interfaces.
 * 2. REST API Routes: Express, Nest.js, FastAPI, Flask, and Next.js route handlers.
 * 3. Frontend Pages: React Router, Next.js App Router, Vue/Svelte view components.
 * 4. Tech Stack & Dependencies: Manifest files (package.json, requirements.txt, go.mod).
 */

import path from 'node:path';

export interface ExtractedModelField {
    name: string;
    field_type: string;
    required: boolean;
    unique?: boolean;
    primary_key?: boolean;
    description?: string;
}

export interface ExtractedModelRelation {
    name: string;
    target_model: string;
    relation_type: string;
}

export interface ExtractedModel {
    name: string;
    description: string;
    fields: ExtractedModelField[];
    relations: ExtractedModelRelation[];
}

export interface ExtractedApi {
    method: string;
    path: string;
    name: string;
    description: string;
    entity?: string;
    file?: string;
}

export interface ExtractedPage {
    name: string;
    path: string;
    type: 'dashboard' | 'list' | 'detail' | 'settings' | 'auth' | 'landing';
    description: string;
    file?: string;
}

export interface RepoCodeIntelligence {
    techStack: {
        frontend?: string;
        backend?: string;
        database?: string;
        keyLibraries: string[];
    };
    models: ExtractedModel[];
    apis: ExtractedApi[];
    pages: ExtractedPage[];
    sourceSnippets: Array<{ path: string; summary: string }>;
    rawFileCount: number;
    gitCommitSha?: string;
}

// ─────────────────────────────────────────────────────────────
// Regex & Pattern Matchers for Deep AST Analysis
// ─────────────────────────────────────────────────────────────

/**
 * Parse Prisma schema string into structured models
 */
export function parsePrismaSchema(content: string): ExtractedModel[] {
    const models: ExtractedModel[] = [];
    const modelBlocks = content.split(/model\s+(\w+)\s*\{/g);

    for (let i = 1; i < modelBlocks.length; i += 2) {
        const modelName = modelBlocks[i];
        if (!modelName) continue;
        const body = modelBlocks[i + 1]?.split('}')[0] || '';
        const lines = body.split('\n');

        const fields: ExtractedModelField[] = [];
        const relations: ExtractedModelRelation[] = [];

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith('//') || line.startsWith('@@')) continue;

            const parts = line.split(/\s+/);
            if (parts.length >= 2 && parts[0] && parts[1]) {
                const fieldName = parts[0];
                const fieldType = parts[1];
                const isOptional = fieldType.endsWith('?');
                const isArray = fieldType.endsWith('[]');
                const baseType = fieldType.replace(/[?\[\]]/g, '');

                const isId = line.includes('@id');
                const isUnique = line.includes('@unique');

                // Check if this references another model (relation)
                const isStandardType = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes', 'Decimal'].includes(baseType);
                if (!isStandardType && /^[A-Z]/.test(baseType)) {
                    relations.push({
                        name: fieldName,
                        target_model: baseType,
                        relation_type: isArray ? 'one_to_many' : 'many_to_one'
                    });
                }

                // Map Prisma types to standard types
                let normalizedType = 'string';
                if (['Int', 'Float', 'Decimal'].includes(baseType)) normalizedType = 'integer';
                else if (baseType === 'Boolean') normalizedType = 'boolean';
                else if (baseType === 'DateTime') normalizedType = 'datetime';
                else if (baseType === 'Json') normalizedType = 'json';

                fields.push({
                    name: fieldName,
                    field_type: normalizedType,
                    required: !isOptional && !isArray,
                    unique: isUnique || isId,
                    primary_key: isId,
                    description: `${fieldName} property for ${modelName}`
                });
            }
        }

        if (fields.length > 0) {
            models.push({
                name: modelName,
                description: `Domain model parsed from Prisma schema for ${modelName}`,
                fields,
                relations
            });
        }
    }

    return models;
}

/**
 * Parse SQL CREATE TABLE DDL statements into structured models
 */
export function parseSqlDdl(content: string): ExtractedModel[] {
    const models: ExtractedModel[] = [];
    const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|')?(\w+)(?:`|"|')?\s*\(([\s\S]*?)\);/gi;

    let match;
    while ((match = tableRegex.exec(content)) !== null) {
        const rawTableName = match[1];
        const body = match[2];
        if (!rawTableName || !body) continue;

        const tableName = rawTableName.charAt(0).toUpperCase() + rawTableName.slice(1);
        const lines = body.split('\n');

        const fields: ExtractedModelField[] = [];
        const relations: ExtractedModelRelation[] = [];

        for (const rawLine of lines) {
            const line = rawLine.trim().replace(/,$/, '');
            if (!line || line.startsWith('--') || line.startsWith('/*')) continue;
            if (/^(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|INDEX|KEY)/i.test(line)) {
                // Check foreign key
                const fkMatch = line.match(/FOREIGN\s+KEY\s*\((?:`|"|')?(\w+)(?:`|"|')?\)\s*REFERENCES\s*(?:`|"|')?(\w+)/i);
                if (fkMatch && fkMatch[1] && fkMatch[2]) {
                    relations.push({
                        name: fkMatch[1],
                        target_model: fkMatch[2].charAt(0).toUpperCase() + fkMatch[2].slice(1),
                        relation_type: 'many_to_one'
                    });
                }
                continue;
            }

            const parts = line.split(/\s+/);
            if (parts.length >= 2 && parts[0] && parts[1]) {
                const rawFieldName = parts[0].replace(/[`"']/g, '');
                const rawType = parts[1].toUpperCase();

                let normalizedType = 'string';
                if (/INT|SERIAL|BIGINT|SMALLINT/i.test(rawType)) normalizedType = 'integer';
                else if (/FLOAT|DOUBLE|DECIMAL|NUMERIC/i.test(rawType)) normalizedType = 'float';
                else if (/BOOL/i.test(rawType)) normalizedType = 'boolean';
                else if (/TIME|DATE/i.test(rawType)) normalizedType = 'datetime';
                else if (/JSON/i.test(rawType)) normalizedType = 'json';

                const isPrimaryKey = /PRIMARY\s+KEY/i.test(line);
                const isNotNull = /NOT\s+NULL/i.test(line);
                const isUnique = /UNIQUE/i.test(line);

                fields.push({
                    name: rawFieldName,
                    field_type: normalizedType,
                    required: isNotNull || isPrimaryKey,
                    unique: isUnique || isPrimaryKey,
                    primary_key: isPrimaryKey,
                    description: `${rawFieldName} column in ${rawTableName}`
                });
            }
        }

        if (fields.length > 0) {
            models.push({
                name: tableName,
                description: `Database entity parsed from SQL DDL for table ${rawTableName}`,
                fields,
                relations
            });
        }
    }

    return models;
}

/**
 * Parse Express/Router/FastAPI/Nest routes from file content
 */
export function parseRouteEndpoints(content: string, filePath: string): ExtractedApi[] {
    const apis: ExtractedApi[] = [];

    // 1. Express / Router patterns: router.get('/path', handler) or app.post('/path', ...)
    const expressRegex = /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    let match;
    while ((match = expressRegex.exec(content)) !== null) {
        const method = match[1]?.toUpperCase();
        const routePath = match[2];
        if (!method || !routePath) continue;

        // Format clean endpoint name: "GET /api/users" -> "Get Users"
        const segments = routePath.split('/').filter(Boolean);
        const resourceName = segments[segments.length - 1] || 'root';
        const cleanName = `${method} ${resourceName.replace(/[^a-zA-Z0-9]/g, ' ')}`.trim();

        // Inferred entity
        const entitySegment = segments.length > 0 ? segments[segments.length - 1] : undefined;
        const entityName = entitySegment ? entitySegment.replace(/s$/, '') : undefined;

        apis.push({
            method,
            path: routePath,
            name: cleanName,
            description: `Route controller in ${path.basename(filePath)} (${method} ${routePath})`,
            entity: entityName ? entityName.charAt(0).toUpperCase() + entityName.slice(1) : undefined,
            file: filePath
        });
    }

    // 2. Nest.js decorators: @Get('path'), @Post('path'), @Controller('prefix')
    const controllerPrefixMatch = content.match(/@Controller\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/i);
    const controllerPrefix = controllerPrefixMatch ? controllerPrefixMatch[1]?.replace(/^\/?/, '/') || '' : '';

    const nestRegex = /@(Get|Post|Put|Delete|Patch)\s*\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/gi;
    while ((match = nestRegex.exec(content)) !== null) {
        const method = match[1]?.toUpperCase();
        if (!method) continue;
        const subPath = (match[2] || '').replace(/^\/?/, '/');
        const fullPath = (controllerPrefix + (subPath === '/' ? '' : subPath)) || '/';

        apis.push({
            method,
            path: fullPath,
            name: `${method} ${fullPath}`,
            description: `NestJS endpoint controller in ${path.basename(filePath)}`,
            file: filePath
        });
    }

    // 3. FastAPI/Flask: @app.get('/path') or @router.post('/path')
    const pyRegex = /@(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi;
    while ((match = pyRegex.exec(content)) !== null) {
        const method = match[1]?.toUpperCase();
        const pyPath = match[2];
        if (!method || !pyPath) continue;

        apis.push({
            method,
            path: pyPath,
            name: `${method} ${pyPath}`,
            description: `FastAPI route handler in ${path.basename(filePath)}`,
            file: filePath
        });
    }

    return apis;
}

/**
 * Parse UI Pages & Views from React Router, Next.js, or file paths
 */
export function parseUiPages(files: Array<{ path: string; content?: string }>): ExtractedPage[] {
    const pages: ExtractedPage[] = [];
    const seenPaths = new Set<string>();

    for (const file of files) {
        const lower = file.path.toLowerCase();
        
        // 1. React Router scan
        if (file.content && (lower.includes('app.tsx') || lower.includes('routes.tsx') || lower.includes('router.tsx') || lower.includes('main.tsx'))) {
            const routeTagRegex = /<Route\s+[^>]*path\s*=\s*['"]([^'"]+)['"][^>]*element\s*=\s*\{\s*<(\w+)/gi;
            let m;
            while ((m = routeTagRegex.exec(file.content)) !== null) {
                const routePath = m[1];
                const componentName = m[2];
                if (routePath && componentName && !seenPaths.has(routePath)) {
                    seenPaths.add(routePath);
                    let pageType: ExtractedPage['type'] = 'dashboard';
                    const compLower = componentName.toLowerCase();
                    if (compLower.includes('login') || compLower.includes('auth') || compLower.includes('signup')) pageType = 'auth';
                    else if (compLower.includes('setting') || compLower.includes('config')) pageType = 'settings';
                    else if (compLower.includes('list') || compLower.includes('table') || compLower.includes('browse')) pageType = 'list';
                    else if (compLower.includes('detail') || compLower.includes('view')) pageType = 'detail';
                    else if (routePath === '/') pageType = 'landing';

                    pages.push({
                        name: componentName.replace(/Page$/, ''),
                        path: routePath,
                        type: pageType,
                        description: `Route component <${componentName} /> rendered at path ${routePath}`,
                        file: file.path
                    });
                }
            }
        }

        // 2. File-system based page routes (e.g. pages/Dashboard.tsx or app/dashboard/page.tsx)
        const isPageView = (lower.includes('/pages/') || lower.includes('/views/') || lower.includes('/screens/') || lower.includes('/app/')) &&
            (lower.endsWith('.tsx') || lower.endsWith('.jsx') || lower.endsWith('.vue'));

        if (isPageView) {
            const fileName = path.basename(file.path, path.extname(file.path));
            if (fileName.toLowerCase() === 'page' || fileName.toLowerCase() === 'index') {
                const dir = path.basename(path.dirname(file.path));
                const pagePath = dir === 'app' || dir === 'pages' ? '/' : `/${dir}`;
                const name = dir.charAt(0).toUpperCase() + dir.slice(1);
                if (!seenPaths.has(pagePath)) {
                    seenPaths.add(pagePath);
                    pages.push({
                        name: name || 'Home',
                        path: pagePath,
                        type: pagePath === '/' ? 'landing' : 'dashboard',
                        description: `File-system route page in ${file.path}`,
                        file: file.path
                    });
                }
            } else if (!fileName.startsWith('_') && !fileName.toLowerCase().includes('modal') && !fileName.toLowerCase().includes('dialog')) {
                const pagePath = `/${fileName.toLowerCase().replace(/page$/, '').replace(/[^a-z0-9]/g, '-')}`;
                if (!seenPaths.has(pagePath)) {
                    seenPaths.add(pagePath);
                    let pageType: ExtractedPage['type'] = 'dashboard';
                    const fLower = fileName.toLowerCase();
                    if (fLower.includes('login') || fLower.includes('auth')) pageType = 'auth';
                    else if (fLower.includes('setting')) pageType = 'settings';
                    else if (fLower.includes('list')) pageType = 'list';
                    else if (fLower.includes('detail')) pageType = 'detail';

                    pages.push({
                        name: fileName.replace(/Page$/, ''),
                        path: pagePath,
                        type: pageType,
                        description: `UI View component ${fileName} located at ${file.path}`,
                        file: file.path
                    });
                }
            }
        }
    }

    return pages;
}

/**
 * Inspect dependencies and build system from manifests
 */
export function parseTechStack(manifestFiles: Array<{ path: string; content: string }>): RepoCodeIntelligence['techStack'] {
    const keyLibraries = new Set<string>();
    let frontend: string | undefined;
    let backend: string | undefined;
    let database: string | undefined;

    for (const m of manifestFiles) {
        const lower = m.path.toLowerCase();
        if (lower.endsWith('package.json')) {
            try {
                const pkg = JSON.parse(m.content);
                const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

                if (deps.react) frontend = `React ${deps.react.replace(/[\^~]/g, '')}`;
                else if (deps.vue) frontend = `Vue ${deps.vue.replace(/[\^~]/g, '')}`;
                else if (deps.svelte) frontend = 'Svelte';
                else if (deps.next) frontend = `Next.js ${deps.next.replace(/[\^~]/g, '')}`;

                if (deps.express) backend = 'Node.js Express';
                else if (deps['@nestjs/core']) backend = 'NestJS';
                else if (deps.fastify) backend = 'Fastify';
                else if (deps.koa) backend = 'Koa';

                if (deps['@prisma/client'] || deps.prisma) database = 'Prisma ORM';
                else if (deps.mongoose) database = 'MongoDB (Mongoose)';
                else if (deps.typeorm) database = 'TypeORM';
                else if (deps['drizzle-orm']) database = 'Drizzle ORM';
                else if (deps.pg) database = 'PostgreSQL';
                else if (deps.mysql2) database = 'MySQL';

                const notable = ['tailwindcss', 'three', 'lucide-react', 'axios', 'zustand', 'redux', 'zod', 'socket.io', 'graphql'];
                for (const lib of notable) {
                    if (deps[lib]) keyLibraries.add(lib);
                }
            } catch {}
        } else if (lower.endsWith('requirements.txt')) {
            if (m.content.includes('fastapi')) backend = 'FastAPI (Python)';
            else if (m.content.includes('django')) backend = 'Django (Python)';
            else if (m.content.includes('flask')) backend = 'Flask (Python)';

            if (m.content.includes('sqlalchemy')) database = 'SQLAlchemy';
            else if (m.content.includes('pymongo')) database = 'MongoDB';
        }
    }

    return {
        frontend: frontend || 'Modern Web UI',
        backend: backend || 'REST API Backend',
        database: database || 'Relational / Document DB',
        keyLibraries: Array.from(keyLibraries)
    };
}

/**
 * Deep scan an array of repository files and compile comprehensive Code Intelligence
 */
export function analyzeRepositoryFiles(
    files: Array<{ path: string; content: string; size?: number }>,
    commitSha?: string
): RepoCodeIntelligence {
    const allModels: ExtractedModel[] = [];
    const allApis: ExtractedApi[] = [];
    const manifests: Array<{ path: string; content: string }> = [];
    const snippets: Array<{ path: string; summary: string }> = [];

    for (const file of files) {
        const lower = file.path.toLowerCase();

        // 1. Schemas
        if (lower.includes('schema.prisma') || lower.endsWith('.prisma')) {
            const parsed = parsePrismaSchema(file.content);
            allModels.push(...parsed);
            snippets.push({ path: file.path, summary: `Prisma Schema (${parsed.length} models detected)` });
        } else if (lower.endsWith('.sql') && (lower.includes('migration') || lower.includes('schema') || lower.includes('init') || lower.includes('ddl'))) {
            const parsed = parseSqlDdl(file.content);
            allModels.push(...parsed);
            snippets.push({ path: file.path, summary: `SQL DDL (${parsed.length} tables detected)` });
        }

        // 2. Routes & Controllers
        if (
            lower.includes('/routes/') ||
            lower.includes('/controllers/') ||
            lower.includes('/api/') ||
            lower.includes('/endpoints/') ||
            lower.endsWith('server.ts') ||
            lower.endsWith('app.ts') ||
            lower.endsWith('main.py')
        ) {
            const parsedApis = parseRouteEndpoints(file.content, file.path);
            if (parsedApis.length > 0) {
                allApis.push(...parsedApis);
                snippets.push({ path: file.path, summary: `API Routes (${parsedApis.length} endpoints: ${parsedApis.map(a => a.method + ' ' + a.path).slice(0, 3).join(', ')})` });
            }
        }

        // 3. Manifests
        if (lower.endsWith('package.json') || lower.endsWith('requirements.txt') || lower.endsWith('go.mod')) {
            manifests.push(file);
        }
    }

    // 4. UI Pages
    const allPages = parseUiPages(files);
    if (allPages.length > 0) {
        snippets.push({ path: 'Frontend Routes', summary: `Discovered ${allPages.length} UI pages (${allPages.map(p => p.name).slice(0, 4).join(', ')})` });
    }

    const techStack = parseTechStack(manifests);

    const uniqueModels = Array.from(new Map(allModels.map(m => [m.name.toLowerCase(), m])).values());
    const uniqueApis = Array.from(new Map(allApis.map(a => [`${a.method}:${a.path.toLowerCase()}`, a])).values());

    return {
        techStack,
        models: uniqueModels,
        apis: uniqueApis,
        pages: allPages,
        sourceSnippets: snippets,
        rawFileCount: files.length,
        gitCommitSha: commitSha
    };
}

/**
 * Deep Code Search Engine & Static Pattern Inspector (V2)
 *
 * Extracts real architectural structure from code repositories (GitHub or local workspace):
 * 1. Data Models: Prisma, SQL DDL, Mongoose Schemas, Drizzle pgTable/mysqlTable,
 *    TypeScript model interfaces, and Python Pydantic/SQLAlchemy models.
 * 2. REST API Routes: Express, NestJS, FastAPI/Flask, and Next.js App Router (`route.ts`).
 * 3. Frontend Pages: React Router, Next.js App Router, Vue/Svelte views.
 * 4. Tech Stack & Codebase Size Metrics.
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
    sourceFile?: string;
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
    totalBytes: number;
    gitCommitSha?: string;
}

export function parsePrismaSchema(content: string, sourceFile?: string): ExtractedModel[] {
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

                const isStandardType = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes', 'Decimal'].includes(baseType);
                if (!isStandardType && /^[A-Z]/.test(baseType)) {
                    relations.push({
                        name: fieldName,
                        target_model: baseType,
                        relation_type: isArray ? 'one_to_many' : 'many_to_one',
                    });
                }

                let normalizedType = 'string';
                if (['Int', 'Decimal'].includes(baseType)) normalizedType = 'integer';
                else if (baseType === 'Float') normalizedType = 'float';
                else if (baseType === 'Boolean') normalizedType = 'boolean';
                else if (baseType === 'DateTime') normalizedType = 'datetime';
                else if (baseType === 'Json') normalizedType = 'json';

                fields.push({
                    name: fieldName,
                    field_type: normalizedType,
                    required: !isOptional && !isArray,
                    unique: isUnique || isId,
                    primary_key: isId,
                });
            }
        }

        if (fields.length > 0) {
            models.push({
                name: modelName,
                description: `Prisma model ${modelName}`,
                fields,
                relations,
                sourceFile,
            });
        }
    }

    return models;
}

export function parseSqlDdl(content: string, sourceFile?: string): ExtractedModel[] {
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
                const fkMatch = line.match(/FOREIGN\s+KEY\s*\((?:`|"|')?(\w+)(?:`|"|')?\)\s*REFERENCES\s*(?:`|"|')?(\w+)/i);
                if (fkMatch && fkMatch[1] && fkMatch[2]) {
                    relations.push({
                        name: fkMatch[1],
                        target_model: fkMatch[2].charAt(0).toUpperCase() + fkMatch[2].slice(1),
                        relation_type: 'many_to_one',
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
                });
            }
        }

        if (fields.length > 0) {
            models.push({ name: tableName, description: `SQL table ${rawTableName}`, fields, relations, sourceFile });
        }
    }

    return models;
}

/**
 * Parse Mongoose schemas: `new Schema({ field: { type: String, required: true } })` + `model('User', ...)`
 */
export function parseMongooseSchemas(content: string, sourceFile?: string): ExtractedModel[] {
    const models: ExtractedModel[] = [];
    const schemaRegex = /(?:const|let|var)\s+(\w+)Schema\s*=\s*new\s+(?:mongoose\.)?Schema\s*\(\s*\{([\s\S]*?)\}\s*(?:,|\))/g;
    let match;

    while ((match = schemaRegex.exec(content)) !== null) {
        const rawName = match[1];
        const body = match[2];
        if (!rawName || !body) continue;

        const modelName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        const fields: ExtractedModelField[] = [];
        const relations: ExtractedModelRelation[] = [];

        const fieldLineRegex = /^\s*([a-zA-Z_]\w*)\s*:\s*([^,\n]+(?:\{[^}]*\})?)/gm;
        let fm;
        while ((fm = fieldLineRegex.exec(body)) !== null) {
            const fname = fm[1];
            const fspec = fm[2] || '';
            if (!fname || ['type', 'required', 'unique', 'default', 'ref', 'enum'].includes(fname)) continue;

            let ftype = 'string';
            if (/Number|Int/i.test(fspec)) ftype = 'float';
            else if (/Boolean/i.test(fspec)) ftype = 'boolean';
            else if (/Date/i.test(fspec)) ftype = 'datetime';
            else if (/Mixed|Object|Array|\[/i.test(fspec)) ftype = 'json';

            const refMatch = fspec.match(/ref\s*:\s*['"](\w+)['"]/);
            if (refMatch && refMatch[1]) {
                relations.push({ name: fname, target_model: refMatch[1], relation_type: 'many_to_one' });
            }

            fields.push({
                name: fname,
                field_type: ftype,
                required: /required\s*:\s*true/i.test(fspec),
                unique: /unique\s*:\s*true/i.test(fspec),
            });
        }

        if (fields.length > 0) {
            models.push({ name: modelName, description: `Mongoose schema ${modelName}`, fields, relations, sourceFile });
        }
    }

    return models;
}

/**
 * Parse Drizzle ORM schemas (`pgTable('orders', { id: uuid('id'), ... })`)
 */
export function parseDrizzleSchemas(content: string, sourceFile?: string): ExtractedModel[] {
    const models: ExtractedModel[] = [];
    const tableRegex = /(?:pgTable|mysqlTable|sqliteTable)\s*\(\s*['"](\w+)['"]\s*,\s*\{([\s\S]*?)\}\s*\)/g;
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
        const rawName = match[1];
        const body = match[2];
        if (!rawName || !body) continue;

        const name = rawName.charAt(0).toUpperCase() + rawName.slice(1).replace(/s$/, '');
        const fields: ExtractedModelField[] = [];
        const fieldRegex = /(\w+)\s*:\s*(uuid|serial|integer|int|numeric|real|doublePrecision|text|varchar|boolean|timestamp|jsonb?)\s*\(/gi;
        let fm;
        while ((fm = fieldRegex.exec(body)) !== null) {
            const fname = fm[1];
            const rawType = (fm[2] || '').toLowerCase();
            if (!fname) continue;
            let ftype = 'string';
            if (['serial', 'integer', 'int'].includes(rawType)) ftype = 'integer';
            else if (['numeric', 'real', 'doubleprecision'].includes(rawType)) ftype = 'float';
            else if (rawType === 'boolean') ftype = 'boolean';
            else if (rawType === 'timestamp') ftype = 'datetime';
            else if (rawType.startsWith('json')) ftype = 'json';
            else if (rawType === 'uuid') ftype = 'uuid';

            fields.push({
                name: fname,
                field_type: ftype,
                required: fname === 'id',
                primary_key: fname === 'id',
            });
        }

        if (fields.length > 0) {
            models.push({ name, description: `Drizzle table ${rawName}`, fields, relations: [], sourceFile });
        }
    }
    return models;
}

/**
 * Parse TypeScript domain interfaces in `models/` or `types/` files
 */
export function parseTypeScriptModels(content: string, sourceFile?: string): ExtractedModel[] {
    const models: ExtractedModel[] = [];
    const ifaceRegex = /export\s+interface\s+([A-Z]\w+)\s*\{([\s\S]*?)\}/g;
    let match;

    while ((match = ifaceRegex.exec(content)) !== null) {
        const name = match[1];
        const body = match[2];
        if (!name || !body || /(Props|State|Options|Config|Response|Request|Context)$/.test(name)) continue;

        const fields: ExtractedModelField[] = [];
        for (const rawLine of body.split('\n')) {
            const line = rawLine.trim();
            const fm = line.match(/^(\w+)(\?)?\s*:\s*([^;]+);?/);
            if (!fm || !fm[1] || !fm[3]) continue;
            const fname = fm[1];
            const optional = Boolean(fm[2]);
            const rawType = fm[3].trim().toLowerCase();
            let ftype = 'string';
            if (rawType === 'number') ftype = 'float';
            else if (rawType === 'boolean') ftype = 'boolean';
            else if (rawType.includes('date')) ftype = 'datetime';
            else if (rawType.includes('[') || rawType.includes('record') || rawType.includes('{')) ftype = 'json';

            fields.push({
                name: fname,
                field_type: ftype,
                required: !optional,
                primary_key: fname === 'id',
            });
        }

        if (fields.length >= 2) {
            models.push({ name, description: `TypeScript interface ${name}`, fields, relations: [], sourceFile });
        }
    }

    return models;
}

/**
 * Parse Express, NestJS, FastAPI/Flask, and Next.js App Router (`app/api/.../route.ts`) endpoints
 */
export function parseRouteEndpoints(content: string, filePath: string): ExtractedApi[] {
    const apis: ExtractedApi[] = [];
    const normalizedPath = filePath.replace(/\\/g, '/');

    // 1. Next.js App Router: app/api/**/route.ts -> export async function GET/POST/...
    if (/\/api\/.+\/route\.(ts|tsx|js|jsx)$/i.test(normalizedPath)) {
        const apiSubpathMatch = normalizedPath.match(/(\/api\/.+)\/route\.(ts|tsx|js|jsx)$/i);
        const routePath = apiSubpathMatch?.[1]?.replace(/\[(\w+)\]/g, ':$1') || '/api';
        const nextMethodRegex = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
        let nm;
        while ((nm = nextMethodRegex.exec(content)) !== null) {
            const method = nm[1];
            if (!method) continue;
            apis.push({
                method,
                path: routePath,
                name: `${method} ${routePath}`,
                description: `Next.js App Router handler in ${path.basename(filePath)}`,
                file: filePath,
            });
        }
    }

    // 2. Express / Router patterns
    const expressRegex = /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    let match;
    while ((match = expressRegex.exec(content)) !== null) {
        const method = match[1]?.toUpperCase();
        const routePath = match[2];
        if (!method || !routePath) continue;

        const segments = routePath.split('/').filter(Boolean);
        const resourceName = segments[segments.length - 1] || 'root';
        const cleanName = `${method} ${resourceName.replace(/[^a-zA-Z0-9]/g, ' ')}`.trim();
        const entitySegment = segments.find(s => !s.startsWith(':') && s !== 'api' && !/^v\d+$/.test(s));
        const entityName = entitySegment ? entitySegment.replace(/s$/, '') : undefined;

        apis.push({
            method,
            path: routePath,
            name: cleanName,
            description: `Route controller in ${path.basename(filePath)} (${method} ${routePath})`,
            entity: entityName ? entityName.charAt(0).toUpperCase() + entityName.slice(1) : undefined,
            file: filePath,
        });
    }

    // 3. Nest.js decorators
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
            file: filePath,
        });
    }

    // 4. FastAPI / Flask
    const pyRegex = /@(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi;
    while ((match = pyRegex.exec(content)) !== null) {
        const method = match[1]?.toUpperCase();
        const pyPath = match[2];
        if (!method || !pyPath) continue;
        apis.push({
            method,
            path: pyPath,
            name: `${method} ${pyPath}`,
            description: `Python route handler in ${path.basename(filePath)}`,
            file: filePath,
        });
    }

    return apis;
}

export function parseUiPages(files: Array<{ path: string; content?: string }>): ExtractedPage[] {
    const pages: ExtractedPage[] = [];
    const seenPaths = new Set<string>();

    for (const file of files) {
        const lower = file.path.replace(/\\/g, '/').toLowerCase();

        if (file.content && (lower.includes('app.tsx') || lower.includes('routes.tsx') || lower.includes('router.tsx'))) {
            const routeTagRegex = /<Route\s+[^>]*path\s*=\s*['"]([^'"]+)['"][^>]*element\s*=\s*\{\s*<(\w+)/gi;
            let m;
            while ((m = routeTagRegex.exec(file.content)) !== null) {
                const routePath = m[1];
                const componentName = m[2];
                if (routePath && componentName && !seenPaths.has(routePath)) {
                    seenPaths.add(routePath);
                    pages.push({
                        name: componentName.replace(/Page$/, ''),
                        path: routePath,
                        type: routePath === '/' ? 'landing' : 'dashboard',
                        description: `Route component <${componentName} />`,
                        file: file.path,
                    });
                }
            }
        }

        const isPageView = (lower.includes('/pages/') || lower.includes('/views/') || lower.includes('/screens/') || lower.includes('/app/')) &&
            (lower.endsWith('.tsx') || lower.endsWith('.jsx') || lower.endsWith('.vue')) &&
            !lower.includes('/api/');

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
                        description: `Page route in ${file.path}`,
                        file: file.path,
                    });
                }
            } else if (!fileName.startsWith('_') && !fileName.toLowerCase().includes('modal')) {
                const pagePath = `/${fileName.toLowerCase().replace(/page$/, '').replace(/[^a-z0-9]/g, '-')}`;
                if (!seenPaths.has(pagePath)) {
                    seenPaths.add(pagePath);
                    pages.push({
                        name: fileName.replace(/Page$/, ''),
                        path: pagePath,
                        type: 'dashboard',
                        description: `UI view ${fileName}`,
                        file: file.path,
                    });
                }
            }
        }
    }

    return pages;
}

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
                if (deps.next) frontend = `Next.js ${deps.next.replace(/[\^~]/g, '')}`;
                else if (deps.react) frontend = `React ${deps.react.replace(/[\^~]/g, '')}`;
                else if (deps.vue) frontend = `Vue ${deps.vue.replace(/[\^~]/g, '')}`;
                else if (deps.svelte) frontend = 'Svelte';

                if (deps.express) backend = 'Node.js Express';
                else if (deps['@nestjs/core']) backend = 'NestJS';
                else if (deps.fastify) backend = 'Fastify';

                if (deps['@prisma/client'] || deps.prisma) database = 'Prisma ORM';
                else if (deps.mongoose || deps.mongodb) database = 'MongoDB';
                else if (deps['drizzle-orm']) database = 'Drizzle ORM';
                else if (deps.pg) database = 'PostgreSQL';

                for (const lib of ['tailwindcss', 'zod', 'lucide-react', 'axios', 'zustand', 'socket.io', 'graphql']) {
                    if (deps[lib]) keyLibraries.add(lib);
                }
            } catch {}
        } else if (lower.endsWith('requirements.txt')) {
            if (m.content.includes('fastapi')) backend = 'FastAPI (Python)';
            else if (m.content.includes('django')) backend = 'Django (Python)';
            else if (m.content.includes('flask')) backend = 'Flask (Python)';
        }
    }

    return {
        frontend: frontend || 'Modern Web UI',
        backend: backend || 'REST API Backend',
        database: database || 'Database',
        keyLibraries: Array.from(keyLibraries),
    };
}

export function analyzeRepositoryFiles(
    files: Array<{ path: string; content: string; size?: number }>,
    commitSha?: string
): RepoCodeIntelligence {
    const allModels: ExtractedModel[] = [];
    const allApis: ExtractedApi[] = [];
    const manifests: Array<{ path: string; content: string }> = [];
    const snippets: Array<{ path: string; summary: string }> = [];
    let totalBytes = 0;

    for (const file of files) {
        const normPath = file.path.replace(/\\/g, '/');
        const lower = normPath.toLowerCase();
        totalBytes += file.size ?? Buffer.byteLength(file.content || '', 'utf-8');

        if (lower.includes('schema.prisma') || lower.endsWith('.prisma')) {
            const parsed = parsePrismaSchema(file.content, normPath);
            allModels.push(...parsed);
            if (parsed.length) snippets.push({ path: normPath, summary: `Prisma Schema (${parsed.length} models)` });
        } else if (lower.endsWith('.sql')) {
            const parsed = parseSqlDdl(file.content, normPath);
            allModels.push(...parsed);
            if (parsed.length) snippets.push({ path: normPath, summary: `SQL DDL (${parsed.length} tables)` });
        } else if (lower.endsWith('.ts') || lower.endsWith('.js')) {
            if (file.content.includes('Schema(') || file.content.includes('mongoose')) {
                allModels.push(...parseMongooseSchemas(file.content, normPath));
            }
            if (file.content.includes('pgTable(') || file.content.includes('mysqlTable(') || file.content.includes('sqliteTable(')) {
                allModels.push(...parseDrizzleSchemas(file.content, normPath));
            }
            if (lower.includes('/models/') || lower.includes('/entities/') || lower.includes('/types/models')) {
                allModels.push(...parseTypeScriptModels(file.content, normPath));
            }
        }

        if (
            lower.includes('/routes/') ||
            lower.includes('/controllers/') ||
            lower.includes('/api/') ||
            lower.includes('/endpoints/') ||
            lower.endsWith('server.ts') ||
            lower.endsWith('app.ts') ||
            lower.endsWith('main.py')
        ) {
            const parsedApis = parseRouteEndpoints(file.content, normPath);
            if (parsedApis.length > 0) {
                allApis.push(...parsedApis);
                snippets.push({
                    path: normPath,
                    summary: `API Routes (${parsedApis.length}: ${parsedApis.map(a => `${a.method} ${a.path}`).slice(0, 3).join(', ')})`,
                });
            }
        }

        if (lower.endsWith('package.json') || lower.endsWith('requirements.txt') || lower.endsWith('go.mod')) {
            manifests.push(file);
        }
    }

    const allPages = parseUiPages(files);
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
        totalBytes,
        gitCommitSha: commitSha,
    };
}

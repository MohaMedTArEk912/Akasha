import { randomUUID } from "crypto";
import { ObjectId } from "mongodb";
import prisma from "../lib/prisma.js";

type JsonRecord = Record<string, unknown>;

type NormalizedPage = {
    ref: string;
    name: string;
    path: string;
    rootBlockRef?: string;
    isDynamic: boolean;
    meta: JsonRecord;
    archived: boolean;
    sourceIndex: number;
};

type NormalizedBlock = {
    ref: string;
    scope: "page" | "component";
    blockType: string;
    name: string;
    pageRef: string | null;
    parentRef: string | null;
    order: number;
    properties: JsonRecord;
    styles: JsonRecord;
    responsiveStyles: JsonRecord;
    classes: string[];
    eventHandlers: JsonRecord[];
    bindings: JsonRecord;
    archived: boolean;
    childrenRefs: string[];
    sourceIndex: number;
};

type NormalizedLogicFlow = {
    ref: string;
    id: string;
    name: string;
    trigger: JsonRecord;
    nodes: unknown[];
    edges: unknown[];
    archived: boolean;
};

type NormalizedDataModel = {
    ref: string;
    id: string;
    name: string;
    fields: JsonRecord[];
    relations: JsonRecord[];
    archived: boolean;
};

type NormalizedVariable = {
    name: string;
    variableType: string;
    defaultValue: unknown;
    isSecret: boolean;
};

type NormalizedUseCase = {
    name: string;
    description: string;
    actors: string[];
    preconditions: string;
    postconditions: string;
    steps: JsonRecord[];
    priority: string;
    status: string;
    category: string;
    archived: boolean;
};

type NormalizedApi = {
    name: string;
    method: string;
    path: string;
    description: string;
    requestBody: unknown;
    responseBody: unknown;
    queryParams: JsonRecord[];
    pathParams: JsonRecord[];
    permissions: string[];
    logicFlowRef?: string;
    archived: boolean;
};

type NormalizedImportPayload = {
    version: string;
    project: {
        name: string;
        description: string;
        settings: JsonRecord;
    };
    pages: NormalizedPage[];
    blocks: NormalizedBlock[];
    components: NormalizedBlock[];
    logicFlows: NormalizedLogicFlow[];
    dataModels: NormalizedDataModel[];
    variables: NormalizedVariable[];
    useCases: NormalizedUseCase[];
    apis: NormalizedApi[];
};

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJsonValue<T>(value: unknown, fallback: T): T {
    if (typeof value !== "string") {
        return (value as T) ?? fallback;
    }

    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function asString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value.trim() : fallback;
}

function asRecord(value: unknown): JsonRecord {
    return isRecord(value) ? value : {};
}

function asRecordArray(value: unknown): JsonRecord[] {
    return Array.isArray(value) ? value.filter(isRecord) : [];
}

function asUnknownArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
}

function withLeadingSlash(pathValue: string, fallback: string): string {
    const trimmed = pathValue.trim();
    if (!trimmed) return fallback;
    if (trimmed === "/") return "/";
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function titleFromType(blockType: string): string {
    return (
        blockType
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, (match) => match.toUpperCase()) || "Block"
    );
}

function defaultDataModelFields(): JsonRecord[] {
    return [
        {
            id: "id",
            name: "id",
            field_type: "uuid",
            required: true,
            unique: true,
            primary_key: true,
        },
    ];
}

function ensureUnique(values: string[], label: string) {
    const seen = new Set<string>();
    for (const value of values) {
        if (seen.has(value)) {
            throw new Error(`Duplicate ${label}: ${value}`);
        }
        seen.add(value);
    }
}

function toPageSchema(page: any, blocks: any[] = []) {
    const meta = parseJsonValue<Record<string, unknown>>(page.meta, {});
    const inferredRootBlockId =
        typeof meta.root_block_id === "string" && meta.root_block_id
            ? meta.root_block_id
            : blocks.find(
                  (block) =>
                      String(block.pageId) === String(page.idRoot) &&
                      !block.parentId &&
                      !block.archived,
              )?.id;

    return {
        id: page.id,
        name: page.name,
        path: page.path,
        root_block_id: inferredRootBlockId,
        is_dynamic: page.isDynamic || false,
        meta,
        archived: page.archived || false,
    };
}

function toBlockSchema(block: any, pageIdByInternalId: Map<string, string>) {
    return {
        id: block.id,
        block_type: block.blockType,
        name: block.name,
        properties: parseJsonValue<Record<string, unknown>>(block.properties, {}),
        styles: parseJsonValue<Record<string, string | number | boolean>>(
            block.styles,
            {},
        ),
        responsive_styles: parseJsonValue<
            Record<string, Record<string, string | number | boolean>>
        >(block.responsiveStyles, {}),
        classes: parseJsonValue<string[]>(block.classes, []),
        event_handlers: parseJsonValue<any[]>(block.events, []),
        bindings: parseJsonValue<Record<string, unknown>>(block.bindings, {}),
        children: parseJsonValue<string[]>(block.children, []),
        parent_id: block.parentId || null,
        page_id: block.pageId
            ? pageIdByInternalId.get(String(block.pageId)) || null
            : null,
        order: block.order || 0,
        archived: block.archived || false,
    };
}

function toVariableSchema(variable: any) {
    return {
        id: variable.id,
        name: variable.name,
        variable_type: variable.type,
        scope: "global",
        default_value: variable.value
            ? parseJsonValue(variable.value, null)
            : null,
        archived: false,
    };
}

function toDataModelSchema(model: any) {
    const schema = parseJsonValue<JsonRecord>(model.schema, {});
    return {
        id: model.id,
        name: model.name,
        fields: asRecordArray(schema.fields ?? []),
        relations: asRecordArray(schema.relations ?? []),
        timestamps: true,
        soft_delete: false,
        archived: model.archived || false,
    };
}

function toLogicFlowSchema(flow: any) {
    return {
        id: flow.id,
        name: flow.name,
        description: "",
        trigger: asRecord(parseJsonValue(flow.trigger, {})),
        nodes: asUnknownArray(parseJsonValue(flow.nodes, [])),
        edges: asUnknownArray(parseJsonValue(flow.edges, [])),
        entry_node_id: undefined,
        context: "frontend",
        archived: flow.archived || false,
    };
}

function toApiSchema(api: any) {
    const config = parseJsonValue<JsonRecord>(api.config, {});
    return {
        id: api.id,
        method: api.method,
        path: api.path,
        name: api.name,
        description: asString(config.description),
        request_body: config.request_body ?? null,
        response_body: config.response_body ?? null,
        query_params: asRecordArray(config.query_params ?? []),
        path_params: asRecordArray(config.path_params ?? []),
        logic_flow_id:
            typeof api.logicFlowId === "string"
                ? api.logicFlowId
                : asString(config.logic_flow_id) || undefined,
        permissions: asStringArray(config.permissions),
        archived: api.archived || false,
    };
}

function toUseCaseSchema(useCase: any) {
    return {
        id: useCase.id,
        project_id: useCase.projectId,
        name: useCase.name,
        description: useCase.description || "",
        actors: parseJsonValue<string[]>(useCase.actors, []),
        preconditions: useCase.preconditions || "",
        postconditions: useCase.postconditions || "",
        steps: parseJsonValue<JsonRecord[]>(useCase.steps, []),
        priority: useCase.priority || "medium",
        status: useCase.status || "draft",
        category: useCase.category || "",
        created_at:
            useCase.createdAt instanceof Date
                ? useCase.createdAt.toISOString()
                : useCase.createdAt,
        updated_at:
            useCase.updatedAt instanceof Date
                ? useCase.updatedAt.toISOString()
                : useCase.updatedAt,
        archived: useCase.archived || false,
    };
}

export function toProjectSchema(
    project: any,
    pages: any[] = [],
    blocks: any[] = [],
    variables: any[] = [],
    dataModels: any[] = [],
    logicFlows: any[] = [],
    apis: any[] = [],
    useCases: any[] = [],
) {
    const pageBlocks = (blocks || []).filter(
        (block: any) => block.blockType !== "component",
    );
    const componentBlocks = (blocks || []).filter(
        (block: any) => block.blockType === "component",
    );
    const serializedPages = (pages || []).map((page: any) =>
        toPageSchema(page, pageBlocks),
    );
    const pageIdByInternalId = new Map<string, string>();

    for (const page of pages || []) {
        if (page.idRoot && page.id) {
            pageIdByInternalId.set(String(page.idRoot), String(page.id));
        }
    }

    return {
        id: project.id,
        name: project.name,
        description: project.description || "",
        created_at: (
            project.createdAt instanceof Date
                ? project.createdAt
                : new Date(project.createdAt)
        ).toISOString(),
        updated_at: (
            project.updatedAt instanceof Date
                ? project.updatedAt
                : new Date(project.updatedAt)
        ).toISOString(),
        root_path: project.rootPath || "",
        version: "1.0.0",
        settings: parseJsonValue<Record<string, unknown>>(project.settings, {}),
        blocks: pageBlocks.map((block: any) =>
            toBlockSchema(block, pageIdByInternalId),
        ),
        pages: serializedPages,
        apis: (apis || []).map(toApiSchema),
        logic_flows: (logicFlows || []).map(toLogicFlowSchema),
        data_models: (dataModels || []).map(toDataModelSchema),
        variables: (variables || []).map(toVariableSchema),
        components: componentBlocks.map((block: any) =>
            toBlockSchema(block, pageIdByInternalId),
        ),
        use_cases: (useCases || []).map(toUseCaseSchema),
    };
}

export async function serializeProjectById(projectId: string) {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            pages: true,
            blocks: true,
            variables: true,
            dataModels: true,
            apis: true,
            logicFlows: true,
            useCases: true,
        },
    });

    if (!project) return null;
    return toProjectSchema(
        project,
        project.pages,
        project.blocks,
        project.variables,
        project.dataModels,
        project.logicFlows,
        project.apis,
        project.useCases,
    );
}

export async function serializeProjectTransferById(projectId: string) {
    const project = await serializeProjectById(projectId);
    if (!project) return null;

    return {
        version: project.version,
        project: {
            name: project.name,
            description: project.description,
            settings: project.settings,
        },
        pages: project.pages,
        blocks: project.blocks,
        components: project.components,
        variables: project.variables,
        data_models: project.data_models,
        logic_flows: project.logic_flows,
        apis: project.apis,
        use_cases: Array.isArray((project as any).use_cases)
            ? (project as any).use_cases
            : [],
    };
}

export function buildProjectImportSample(projectName?: string) {
    const name = projectName?.trim() || "Sample Project";

    return {
        version: "1.0.0",
        project: {
            name,
            description:
                "Edit this sample JSON, then import it to create a project scaffold.",
            settings: {
                theme: {
                    primary_color: "#0ea5e9",
                    secondary_color: "#1e293b",
                    font_family: "Space Grotesk",
                    border_radius: 16,
                },
            },
        },
        pages: [
            {
                id: "home",
                name: "Home",
                path: "/",
                root_block_id: "home-root",
                is_dynamic: false,
                archived: false,
                meta: {
                    title: `${name} Home`,
                    description: "Landing page generated from JSON import.",
                },
            },
        ],
        blocks: [
            {
                id: "home-root",
                block_type: "canvas",
                name: "Page Root",
                page_id: "home",
                parent_id: null,
                order: 0,
                properties: {},
                styles: {
                    minHeight: "100%",
                    background: "#f8fafc",
                },
                responsive_styles: {},
                bindings: {},
                event_handlers: [],
                classes: [],
                children: ["hero-section"],
                archived: false,
            },
            {
                id: "hero-section",
                block_type: "section",
                name: "Hero Section",
                page_id: "home",
                parent_id: "home-root",
                order: 0,
                properties: {},
                styles: {
                    padding: "48px",
                    background: "#ffffff",
                    borderRadius: "24px",
                },
                responsive_styles: {},
                bindings: {},
                event_handlers: [],
                classes: [],
                children: ["hero-title", "hero-copy"],
                archived: false,
            },
            {
                id: "hero-title",
                block_type: "heading",
                name: "Hero Title",
                page_id: "home",
                parent_id: "hero-section",
                order: 0,
                properties: {
                    text: `Welcome to ${name}`,
                    level: 1,
                },
                styles: {
                    fontSize: "40px",
                    fontWeight: "800",
                    color: "#0f172a",
                },
                responsive_styles: {},
                bindings: {},
                event_handlers: [],
                classes: [],
                children: [],
                archived: false,
            },
            {
                id: "hero-copy",
                block_type: "paragraph",
                name: "Hero Copy",
                page_id: "home",
                parent_id: "hero-section",
                order: 1,
                properties: {
                    text:
                        "Replace this text, add more pages, or extend the project with data models, APIs, variables, and logic flows.",
                },
                styles: {
                    fontSize: "16px",
                    color: "#475569",
                },
                responsive_styles: {},
                bindings: {},
                event_handlers: [],
                classes: [],
                children: [],
                archived: false,
            },
        ],
        components: [],
        variables: [
            {
                id: "api-base-url",
                name: "API_BASE_URL",
                variable_type: "string",
                scope: "global",
                default_value: "https://api.example.com",
                archived: false,
            },
        ],
        data_models: [
            {
                id: "user-model",
                name: "User",
                fields: defaultDataModelFields(),
                relations: [],
                timestamps: true,
                soft_delete: false,
                archived: false,
            },
        ],
        logic_flows: [],
        apis: [],
        use_cases: [
            {
                id: "view-home",
                name: "View Home Page",
                description:
                    "A visitor opens the landing page and reads the hero content.",
                actors: ["Visitor"],
                preconditions:
                    "The project has been imported successfully.",
                postconditions: "The landing page is visible.",
                steps: [
                    { order: 1, description: "Navigate to the Home page." },
                    {
                        order: 2,
                        description:
                            "Read the hero heading and supporting copy.",
                    },
                ],
                priority: "medium",
                status: "draft",
                category: "Landing",
                archived: false,
            },
        ],
    };
}

function extractImportRoot(rawPayload: unknown): JsonRecord {
    if (typeof rawPayload === "string") {
        const parsed = parseJsonValue<unknown>(rawPayload, {});
        return isRecord(parsed) ? parsed : {};
    }

    if (!isRecord(rawPayload)) return {};

    if (typeof rawPayload.json === "string") {
        const parsed = parseJsonValue<unknown>(rawPayload.json, {});
        return isRecord(parsed) ? parsed : {};
    }

    if (isRecord(rawPayload.payload)) {
        return rawPayload.payload;
    }

    return rawPayload;
}

function normalizePages(rawPages: JsonRecord[]): NormalizedPage[] {
    const pages = rawPages.map((page, index) => ({
        ref: asString(page.id, `page-${index + 1}`),
        name: asString(page.name, index === 0 ? "Home" : `Page ${index + 1}`),
        path: withLeadingSlash(
            asString(page.path),
            index === 0 ? "/" : `/page-${index + 1}`,
        ),
        rootBlockRef: asString(page.root_block_id) || undefined,
        isDynamic: Boolean(page.is_dynamic),
        meta: asRecord(page.meta),
        archived: Boolean(page.archived),
        sourceIndex: index,
    }));

    if (pages.length === 0) {
        return [
            {
                ref: "home",
                name: "Home",
                path: "/",
                rootBlockRef: "home-root",
                isDynamic: false,
                meta: {},
                archived: false,
                sourceIndex: 0,
            },
        ];
    }

    ensureUnique(
        pages.map((page) => page.ref),
        "page id",
    );
    ensureUnique(
        pages.map((page) => page.path),
        "page path",
    );

    return pages;
}

function normalizeBlocks(
    rawBlocks: JsonRecord[],
    scope: "page" | "component",
): NormalizedBlock[] {
    return rawBlocks.map((block, index) => ({
        ref: asString(block.id, `${scope}-block-${index + 1}`),
        scope,
        blockType: asString(
            block.block_type,
            scope === "component" ? "component" : "container",
        ),
        name: asString(
            block.name,
            titleFromType(
                asString(
                    block.block_type,
                    scope === "component" ? "component" : "container",
                ),
            ),
        ),
        pageRef: scope === "page" ? asString(block.page_id) || null : null,
        parentRef: asString(block.parent_id) || null,
        order: typeof block.order === "number" ? block.order : index,
        properties: asRecord(block.properties),
        styles: asRecord(block.styles),
        responsiveStyles: asRecord(block.responsive_styles),
        classes: asStringArray(block.classes),
        eventHandlers: asRecordArray(block.event_handlers),
        bindings: asRecord(block.bindings),
        archived: Boolean(block.archived),
        childrenRefs: asStringArray(block.children),
        sourceIndex: index,
    }));
}

function normalizeLogicFlows(rawLogicFlows: JsonRecord[]): NormalizedLogicFlow[] {
    return rawLogicFlows.map((flow, index) => ({
        ref: asString(flow.id, `logic-flow-${index + 1}`),
        id: new ObjectId().toHexString(),
        name: asString(flow.name, `Logic Flow ${index + 1}`),
        trigger: asRecord(flow.trigger),
        nodes: asUnknownArray(flow.nodes),
        edges: asUnknownArray((flow as JsonRecord).edges),
        archived: Boolean(flow.archived),
    }));
}

function normalizeDataModels(rawModels: JsonRecord[]): NormalizedDataModel[] {
    return rawModels.map((model, index) => ({
        ref: asString(model.id, `data-model-${index + 1}`),
        id: new ObjectId().toHexString(),
        name: asString(model.name, `Model ${index + 1}`),
        fields:
            asRecordArray(model.fields).length > 0
                ? asRecordArray(model.fields)
                : defaultDataModelFields(),
        relations: asRecordArray(model.relations),
        archived: Boolean(model.archived),
    }));
}

function normalizeVariables(rawVariables: JsonRecord[]): NormalizedVariable[] {
    return rawVariables.map((variable, index) => ({
        name: asString(variable.name, `VARIABLE_${index + 1}`),
        variableType: asString(variable.variable_type, "string"),
        defaultValue: variable.default_value ?? null,
        isSecret: Boolean(variable.isSecret),
    }));
}

function normalizeUseCases(rawUseCases: JsonRecord[]): NormalizedUseCase[] {
    return rawUseCases.map((useCase, index) => ({
        name: asString(useCase.name, `Use Case ${index + 1}`),
        description: asString(useCase.description),
        actors: asStringArray(useCase.actors),
        preconditions: asString(useCase.preconditions),
        postconditions: asString(useCase.postconditions),
        steps: asRecordArray(useCase.steps),
        priority: asString(useCase.priority, "medium"),
        status: asString(useCase.status, "draft"),
        category: asString(useCase.category),
        archived: Boolean(useCase.archived),
    }));
}

function normalizeApis(rawApis: JsonRecord[]): NormalizedApi[] {
    return rawApis.map((api, index) => ({
        name: asString(api.name, `API ${index + 1}`),
        method: asString(api.method, "GET").toUpperCase(),
        path: withLeadingSlash(asString(api.path), `/endpoint-${index + 1}`),
        description: asString(api.description),
        requestBody: api.request_body ?? null,
        responseBody: api.response_body ?? null,
        queryParams: asRecordArray(api.query_params),
        pathParams: asRecordArray(api.path_params),
        permissions: asStringArray(api.permissions),
        logicFlowRef: asString(api.logic_flow_id) || undefined,
        archived: Boolean(api.archived),
    }));
}

function normalizeImportPayload(rawPayload: unknown): NormalizedImportPayload {
    const source = extractImportRoot(rawPayload);
    const projectNode = isRecord(source.project) ? source.project : source;

    return {
        version: asString(source.version, "1.0.0"),
        project: {
            name: asString(projectNode.name, "Imported Project"),
            description: asString(projectNode.description),
            settings: asRecord(projectNode.settings),
        },
        pages: normalizePages(asRecordArray(source.pages)),
        blocks: normalizeBlocks(asRecordArray(source.blocks), "page"),
        components: normalizeBlocks(
            asRecordArray(source.components),
            "component",
        ),
        logicFlows: normalizeLogicFlows(
            asRecordArray(source.logic_flows ?? source.logicFlows),
        ),
        dataModels: normalizeDataModels(
            asRecordArray(source.data_models ?? source.dataModels),
        ),
        variables: normalizeVariables(asRecordArray(source.variables)),
        useCases: normalizeUseCases(
            asRecordArray(source.use_cases ?? source.useCases),
        ),
        apis: normalizeApis(asRecordArray(source.apis)),
    };
}

function attachPageRootBlocks(
    pages: NormalizedPage[],
    blocks: NormalizedBlock[],
) {
    const allBlocks = [...blocks];
    const blockByRef = new Map<string, NormalizedBlock>();

    for (const block of allBlocks) {
        blockByRef.set(block.ref, block);
    }

    ensureUnique(
        allBlocks.map((block) => block.ref),
        "block id",
    );

    const pageRefByRootRef = new Map<string, string>();
    for (const page of pages) {
        if (page.rootBlockRef) {
            pageRefByRootRef.set(page.rootBlockRef, page.ref);
        }
    }

    for (const block of allBlocks) {
        if (
            block.scope === "page" &&
            !block.pageRef &&
            pageRefByRootRef.has(block.ref)
        ) {
            block.pageRef = pageRefByRootRef.get(block.ref) || null;
        }
    }

    let changed = true;
    while (changed) {
        changed = false;
        for (const block of allBlocks) {
            if (block.scope !== "page" || block.pageRef || !block.parentRef) {
                continue;
            }

            const parent = blockByRef.get(block.parentRef);
            if (parent?.pageRef) {
                block.pageRef = parent.pageRef;
                changed = true;
            }
        }
    }

    const defaultPageRef = pages[0]?.ref ?? null;
    for (const block of allBlocks) {
        if (block.scope === "page" && !block.pageRef && defaultPageRef) {
            block.pageRef = defaultPageRef;
        }
    }

    for (const page of pages) {
        let pageBlocks = allBlocks.filter(
            (block) => block.scope === "page" && block.pageRef === page.ref,
        );

        let rootBlock = page.rootBlockRef
            ? blockByRef.get(page.rootBlockRef)
            : undefined;
        if (
            !rootBlock ||
            rootBlock.scope !== "page" ||
            rootBlock.pageRef !== page.ref
        ) {
            rootBlock =
                pageBlocks.find(
                    (block) =>
                        block.parentRef === null && block.blockType === "canvas",
                ) || pageBlocks.find((block) => block.parentRef === null);
        }

        if (!rootBlock) {
            const syntheticRoot: NormalizedBlock = {
                ref: `${page.ref}-root`,
                scope: "page",
                blockType: "canvas",
                name: "Page Root",
                pageRef: page.ref,
                parentRef: null,
                order: -1,
                properties: {},
                styles: {},
                responsiveStyles: {},
                classes: [],
                eventHandlers: [],
                bindings: {},
                archived: false,
                childrenRefs: [],
                sourceIndex: -1,
            };
            allBlocks.push(syntheticRoot);
            blockByRef.set(syntheticRoot.ref, syntheticRoot);
            rootBlock = syntheticRoot;
            pageBlocks = [...pageBlocks, syntheticRoot];
        }

        rootBlock.blockType = "canvas";
        rootBlock.parentRef = null;
        page.rootBlockRef = rootBlock.ref;

        for (const block of pageBlocks) {
            if (block.ref !== rootBlock.ref && !block.parentRef) {
                block.parentRef = rootBlock.ref;
            }
        }
    }

    const childrenByParent = new Map<string, NormalizedBlock[]>();
    for (const block of allBlocks) {
        if (!block.parentRef) continue;
        const siblings = childrenByParent.get(block.parentRef) || [];
        siblings.push(block);
        childrenByParent.set(block.parentRef, siblings);
    }

    for (const block of allBlocks) {
        const children = (childrenByParent.get(block.ref) || []).sort(
            (left, right) =>
                left.order - right.order || left.sourceIndex - right.sourceIndex,
        );
        block.childrenRefs = children.map((child) => child.ref);
    }

    return allBlocks;
}

function mapEventHandlers(
    eventHandlers: JsonRecord[],
    logicFlowIdByRef: Map<string, string>,
) {
    return eventHandlers.map((handler) => {
        const logicFlowRef = asString(handler.logic_flow_id);
        return {
            ...handler,
            ...(logicFlowRef
                ? {
                      logic_flow_id:
                          logicFlowIdByRef.get(logicFlowRef) || logicFlowRef,
                  }
                : {}),
        };
    });
}

export async function importProjectFromPayload(rawPayload: unknown) {
    const payload = normalizeImportPayload(rawPayload);

    const project = await prisma.project.create({
        data: {
            name: payload.project.name,
            description: payload.project.description,
            settings: JSON.stringify(payload.project.settings),
        },
    });

    const pageEntries = new Map<
        string,
        { publicId: string; internalId: string; meta: JsonRecord }
    >();

    for (const page of payload.pages) {
        const createdPage = await prisma.page.create({
            data: {
                id: randomUUID(),
                projectId: project.id,
                name: page.name,
                path: page.path,
                isDynamic: page.isDynamic,
                meta: JSON.stringify(page.meta),
                archived: page.archived,
            },
        });

        pageEntries.set(page.ref, {
            publicId: createdPage.id,
            internalId: createdPage.idRoot,
            meta: page.meta,
        });
    }

    const logicFlowIdByRef = new Map<string, string>();
    await Promise.all(
        payload.logicFlows.map(async (flow) => {
            logicFlowIdByRef.set(flow.ref, flow.id);
            await prisma.logicFlow.create({
                data: {
                    id: flow.id,
                    projectId: project.id,
                    name: flow.name,
                    trigger: JSON.stringify(flow.trigger),
                    nodes: JSON.stringify(flow.nodes),
                    edges: JSON.stringify(flow.edges),
                    archived: flow.archived,
                },
            });
        }),
    );

    const dataModelIdByRef = new Map<string, string>();
    await Promise.all(
        payload.dataModels.map(async (model) => {
            dataModelIdByRef.set(model.ref, model.id);
            await prisma.dataModel.create({
                data: {
                    id: model.id,
                    projectId: project.id,
                    name: model.name,
                    schema: JSON.stringify({
                        fields: model.fields,
                        relations: model.relations.map((relation) => ({
                            ...relation,
                            target_model_id:
                                dataModelIdByRef.get(
                                    asString(relation.target_model_id),
                                ) || asString(relation.target_model_id),
                        })),
                    }),
                    archived: model.archived,
                },
            });
        }),
    );

    await Promise.all(
        payload.variables.map(async (variable) => {
            await prisma.variable.create({
                data: {
                    projectId: project.id,
                    name: variable.name,
                    type: variable.variableType,
                    value: JSON.stringify(variable.defaultValue),
                    isSecret: variable.isSecret,
                },
            });
        }),
    );

    await Promise.all(
        payload.useCases.map(async (useCase) => {
            await prisma.useCase.create({
                data: {
                    projectId: project.id,
                    name: useCase.name,
                    description: useCase.description,
                    actors: JSON.stringify(useCase.actors),
                    preconditions: useCase.preconditions,
                    postconditions: useCase.postconditions,
                    steps: JSON.stringify(useCase.steps),
                    priority: useCase.priority,
                    status: useCase.status,
                    category: useCase.category,
                    archived: useCase.archived,
                },
            });
        }),
    );

    await Promise.all(
        payload.apis.map(async (api) => {
            await prisma.apiEndpoint.create({
                data: {
                    projectId: project.id,
                    method: api.method,
                    path: api.path,
                    name: api.name,
                    logicFlowId: api.logicFlowRef
                        ? logicFlowIdByRef.get(api.logicFlowRef) ||
                          api.logicFlowRef
                        : null,
                    config: JSON.stringify({
                        description: api.description,
                        request_body: api.requestBody,
                        response_body: api.responseBody,
                        query_params: api.queryParams,
                        path_params: api.pathParams,
                        permissions: api.permissions,
                    }),
                    archived: api.archived,
                },
            });
        }),
    );

    const allBlocks = attachPageRootBlocks(payload.pages, [
        ...payload.blocks,
        ...payload.components,
    ]);
    const blockIdByRef = new Map<string, string>();
    for (const block of allBlocks) {
        blockIdByRef.set(block.ref, new ObjectId().toHexString());
    }

    await Promise.all(
        allBlocks.map(async (block) => {
            const pageInternalId = block.pageRef
                ? pageEntries.get(block.pageRef)?.internalId
                : undefined;
            await prisma.block.create({
                data: {
                    id: blockIdByRef.get(block.ref),
                    projectId: project.id,
                    pageId: pageInternalId || null,
                    parentId: block.parentRef
                        ? blockIdByRef.get(block.parentRef) || null
                        : null,
                    blockType: block.blockType,
                    name: block.name,
                    properties: JSON.stringify(block.properties),
                    styles: JSON.stringify(block.styles),
                    responsiveStyles: JSON.stringify(block.responsiveStyles),
                    classes: JSON.stringify(block.classes),
                    events: JSON.stringify(
                        mapEventHandlers(
                            block.eventHandlers,
                            logicFlowIdByRef,
                        ),
                    ),
                    bindings: JSON.stringify(block.bindings),
                    children: JSON.stringify(
                        block.childrenRefs
                            .map((childRef) => blockIdByRef.get(childRef))
                            .filter(Boolean),
                    ),
                    order: block.order,
                    archived: block.archived,
                },
            });
        }),
    );

    await Promise.all(
        payload.pages.map(async (page) => {
            const pageEntry = pageEntries.get(page.ref);
            const rootBlockId = page.rootBlockRef
                ? blockIdByRef.get(page.rootBlockRef)
                : undefined;
            if (!pageEntry || !rootBlockId) return;

            await prisma.page.update({
                where: { id: pageEntry.publicId },
                data: {
                    meta: JSON.stringify({
                        ...page.meta,
                        root_block_id: rootBlockId,
                    }),
                },
            });
        }),
    );

    return project.id;
}

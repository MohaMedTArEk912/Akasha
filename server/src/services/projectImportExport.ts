import { randomUUID } from "node:crypto";
import prisma from "../lib/prisma.js";

type JsonRecord = Record<string, unknown>;

export interface ProjectImportPage {
  id: string;
  name: string;
  path: string;
  is_dynamic?: boolean;
  archived?: boolean;
  meta?: JsonRecord;
}

export interface ProjectImportBlock {
  id: string;
  block_type: string;
  name: string;
  parent_id?: string | null;
  page_id?: string | null;
  order?: number;
  properties?: JsonRecord;
  styles?: Record<string, string | number | boolean>;
  responsive_styles?: Record<
    string,
    Record<string, string | number | boolean>
  >;
  bindings?: JsonRecord;
  event_handlers?: unknown[];
  classes?: string[];
  children?: string[];
  archived?: boolean;
}

export interface ProjectImportVariable {
  id?: string;
  name: string;
  variable_type: string;
  scope?: string;
  default_value?: unknown;
  archived?: boolean;
}

export interface ProjectImportDataModel {
  id?: string;
  name: string;
  fields?: unknown[];
  relations?: Array<{
    id?: string;
    name?: string;
    target_model_id?: string;
    relation_type?: string;
  }>;
  timestamps?: boolean;
  soft_delete?: boolean;
  archived?: boolean;
}

export interface ProjectImportLogicFlow {
  id?: string;
  name: string;
  description?: string;
  trigger?: JsonRecord;
  nodes?: unknown[];
  edges?: unknown[];
  context?: string;
  archived?: boolean;
}

export interface ProjectImportPayload {
  version?: string;
  project: {
    name: string;
    description?: string;
    settings?: JsonRecord;
  };
  pages?: ProjectImportPage[];
  blocks?: ProjectImportBlock[];
  variables?: ProjectImportVariable[];
  data_models?: ProjectImportDataModel[];
  logic_flows?: ProjectImportLogicFlow[];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRecord(value: unknown, fallback: JsonRecord = {}): JsonRecord {
  return isRecord(value) ? value : fallback;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizePagePath(path: string, fallback: string): string {
  const trimmed = path.trim();
  if (!trimmed) return fallback;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function ensureUniqueId(id: string, seen: Set<string>, label: string): string {
  if (seen.has(id)) {
    throw new Error(`Duplicate ${label} id "${id}" found in project JSON.`);
  }

  seen.add(id);
  return id;
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

function toDataModelSchema(model: any) {
  const schema = parseJsonValue<{ fields?: unknown[]; relations?: unknown[] }>(
    model.schema,
    {},
  );

  return {
    id: model.id,
    name: model.name,
    fields: Array.isArray(schema.fields) ? schema.fields : [],
    relations: Array.isArray(schema.relations) ? schema.relations : [],
    timestamps: true,
    soft_delete: false,
    archived: model.archived || false,
  };
}

function toLogicFlowSchema(flow: any) {
  return {
    id: flow.id,
    name: flow.name,
    description: flow.description || "",
    trigger: parseJsonValue<JsonRecord>(flow.trigger, { type: "manual" }),
    nodes: parseJsonValue<unknown[]>(flow.nodes, []),
    entry_node_id: flow.entryNodeId || null,
    context: flow.context || "frontend",
    archived: flow.archived || false,
  };
}

function toVariableSchema(variable: any) {
  return {
    id: variable.id,
    name: variable.name,
    variable_type: variable.type,
    scope: "global",
    default_value: variable.value ? parseJsonValue(variable.value, null) : null,
    archived: false,
  };
}

export function toProjectSchema(
  project: any,
  pages: any[] = [],
  blocks: any[] = [],
  variables: any[] = [],
  dataModels: any[] = [],
  logicFlows: any[] = [],
) {
  const serializedPages = (pages || []).map((page: any) =>
    toPageSchema(page, blocks),
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
    blocks: blocks.map((block: any) => ({
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
      event_handlers: parseJsonValue<unknown[]>(block.events, []),
      bindings: parseJsonValue<Record<string, unknown>>(block.bindings, {}),
      children: parseJsonValue<string[]>(block.children, []),
      parent_id: block.parentId || null,
      page_id: block.pageId
        ? pageIdByInternalId.get(String(block.pageId)) || null
        : null,
      order: block.order || 0,
      archived: block.archived || false,
    })),
    pages: serializedPages,
    apis: [],
    logic_flows: logicFlows.map(toLogicFlowSchema),
    data_models: dataModels.map(toDataModelSchema),
    variables: variables.map(toVariableSchema),
    components: [],
  };
}

export function buildProjectImportTemplate(
  projectName = "Sample Project",
): ProjectImportPayload {
  return {
    version: "1.0.0",
    project: {
      name: projectName,
      description:
        "Describe the project goals, users, and scope here. You can edit pages, blocks, models, variables, and logic before importing.",
      settings: {
        theme: {
          primary_color: "#3b82f6",
        },
      },
    },
    pages: [
      {
        id: "home",
        name: "Home",
        path: "/",
        is_dynamic: false,
        meta: {
          title: `${projectName} Home`,
          description: "Landing page for the imported project.",
          root_block_id: "home-root",
        },
      },
      {
        id: "about",
        name: "About",
        path: "/about",
        is_dynamic: false,
        meta: {
          title: `${projectName} About`,
          description: "Secondary page example.",
          root_block_id: "about-root",
        },
      },
    ],
    blocks: [
      {
        id: "home-root",
        block_type: "canvas",
        name: "Home Root",
        page_id: "home",
        parent_id: null,
        order: 0,
        children: ["hero-section"],
      },
      {
        id: "hero-section",
        block_type: "section",
        name: "Hero Section",
        page_id: "home",
        parent_id: "home-root",
        order: 0,
        styles: {
          padding: "48px",
          backgroundColor: "#0f172a",
          color: "#ffffff",
        },
        children: ["hero-title", "hero-copy", "hero-cta"],
      },
      {
        id: "hero-title",
        block_type: "heading",
        name: "Hero Title",
        page_id: "home",
        parent_id: "hero-section",
        order: 0,
        properties: {
          text: `${projectName}`,
          level: 1,
        },
        styles: {
          fontSize: "42px",
          fontWeight: "700",
          color: "#ffffff",
        },
      },
      {
        id: "hero-copy",
        block_type: "paragraph",
        name: "Hero Copy",
        page_id: "home",
        parent_id: "hero-section",
        order: 1,
        properties: {
          text: "Replace this with the value proposition for your project.",
        },
        styles: {
          fontSize: "16px",
          color: "#cbd5e1",
        },
      },
      {
        id: "hero-cta",
        block_type: "button",
        name: "Hero CTA",
        page_id: "home",
        parent_id: "hero-section",
        order: 2,
        properties: {
          text: "Get Started",
        },
        styles: {
          backgroundColor: "#38bdf8",
          color: "#082f49",
          fontWeight: "700",
        },
      },
      {
        id: "about-root",
        block_type: "canvas",
        name: "About Root",
        page_id: "about",
        parent_id: null,
        order: 0,
        children: ["about-section"],
      },
      {
        id: "about-section",
        block_type: "section",
        name: "About Section",
        page_id: "about",
        parent_id: "about-root",
        order: 0,
        children: ["about-title", "about-copy"],
      },
      {
        id: "about-title",
        block_type: "heading",
        name: "About Title",
        page_id: "about",
        parent_id: "about-section",
        order: 0,
        properties: {
          text: "About This Project",
          level: 2,
        },
      },
      {
        id: "about-copy",
        block_type: "paragraph",
        name: "About Copy",
        page_id: "about",
        parent_id: "about-section",
        order: 1,
        properties: {
          text: "Use this page to explain the product, team, or roadmap.",
        },
      },
    ],
    variables: [
      {
        name: "appName",
        variable_type: "string",
        scope: "global",
        default_value: projectName,
      },
    ],
    data_models: [
      {
        id: "user-model",
        name: "User",
        fields: [
          {
            id: "id",
            name: "id",
            field_type: "uuid",
            required: true,
            unique: true,
            primary_key: true,
          },
          {
            id: "email",
            name: "email",
            field_type: "string",
            required: true,
            unique: true,
            primary_key: false,
          },
        ],
        relations: [],
      },
    ],
    logic_flows: [
      {
        name: "App bootstrap",
        context: "frontend",
        trigger: { type: "manual" },
        nodes: [],
        edges: [],
      },
    ],
  };
}

function normalizePayload(input: unknown): ProjectImportPayload {
  const source = typeof input === "string" ? (JSON.parse(input) as unknown) : input;

  if (!isRecord(source)) {
    throw new Error("Project JSON must be an object.");
  }

  const projectSource = toRecord(source.project);
  const projectName =
    typeof projectSource.name === "string" && projectSource.name.trim()
      ? projectSource.name.trim()
      : "Imported Project";
  const projectDescription =
    typeof projectSource.description === "string"
      ? projectSource.description
      : "";
  const projectSettings = toRecord(projectSource.settings, {
    theme: { primary_color: "#3b82f6" },
  });

  const seenPageIds = new Set<string>();
  const rawPages = toArray<ProjectImportPage>(source.pages);
  const pages =
    rawPages.length > 0
      ? rawPages.map((page, index) => {
          const providedId =
            typeof page?.id === "string" && page.id.trim()
              ? page.id.trim()
              : index === 0
                ? "home"
                : randomUUID();
          const id = ensureUniqueId(providedId, seenPageIds, "page");
          const fallbackPath = index === 0 ? "/" : `/${id}`;

          return {
            id,
            name:
              typeof page?.name === "string" && page.name.trim()
                ? page.name.trim()
                : index === 0
                  ? "Home"
                  : `Page ${index + 1}`,
            path: normalizePagePath(
              typeof page?.path === "string" ? page.path : "",
              fallbackPath,
            ),
            is_dynamic: Boolean(page?.is_dynamic),
            archived: Boolean(page?.archived),
            meta: toRecord(page?.meta),
          };
        })
      : [
          {
            id: "home",
            name: "Home",
            path: "/",
            is_dynamic: false,
            archived: false,
            meta: { root_block_id: "home-root" },
          },
        ];

  const seenBlockIds = new Set<string>();
  const rawBlocks = toArray<ProjectImportBlock>(source.blocks);
  const blocks = rawBlocks.map((block, index) => {
    const providedId =
      typeof block?.id === "string" && block.id.trim()
        ? block.id.trim()
        : `block-${index + 1}`;

    const id = ensureUniqueId(providedId, seenBlockIds, "block");

    return {
      id,
      block_type:
        typeof block?.block_type === "string" && block.block_type.trim()
          ? block.block_type.trim()
          : "text",
      name:
        typeof block?.name === "string" && block.name.trim()
          ? block.name.trim()
          : `Block ${index + 1}`,
      parent_id:
        typeof block?.parent_id === "string" ? block.parent_id : null,
      page_id:
        typeof block?.page_id === "string"
          ? block.page_id
          : block?.page_id === null
            ? null
            : undefined,
      order: typeof block?.order === "number" ? block.order : index,
      properties: toRecord(block?.properties),
      styles: toRecord(block?.styles) as Record<
        string,
        string | number | boolean
      >,
      responsive_styles: toRecord(block?.responsive_styles) as Record<
        string,
        Record<string, string | number | boolean>
      >,
      bindings: toRecord(block?.bindings),
      event_handlers: Array.isArray(block?.event_handlers)
        ? block.event_handlers
        : [],
      classes: toStringArray(block?.classes),
      children: toStringArray(block?.children),
      archived: Boolean(block?.archived),
    };
  });

  const pageIds = new Set(pages.map((page) => page.id));
  const blockIds = new Set(blocks.map((block) => block.id));
  const fallbackSinglePageId =
    pages.length === 1 && typeof pages[0]?.id === "string"
      ? pages[0].id
      : null;

  for (const block of blocks) {
    if (block.page_id === undefined && fallbackSinglePageId) {
      block.page_id = fallbackSinglePageId;
    }

    if (typeof block.page_id === "string" && !pageIds.has(block.page_id)) {
      throw new Error(
        `Block "${block.id}" references unknown page "${block.page_id}".`,
      );
    }

    if (block.parent_id && !blockIds.has(block.parent_id)) {
      throw new Error(
        `Block "${block.id}" references unknown parent block "${block.parent_id}".`,
      );
    }
  }

  for (const page of pages) {
    const rootAlias =
      typeof page.meta?.root_block_id === "string" && page.meta.root_block_id
        ? page.meta.root_block_id
        : `${page.id}-root`;

    page.meta = {
      ...page.meta,
      root_block_id: rootAlias,
    };

    if (!blockIds.has(rootAlias)) {
      blocks.unshift({
        id: ensureUniqueId(rootAlias, seenBlockIds, "block"),
        block_type: "canvas",
        name: `${page.name} Root`,
        page_id: page.id,
        parent_id: null,
        order: 0,
        properties: {},
        styles: {},
        responsive_styles: {},
        bindings: {},
        event_handlers: [],
        classes: [],
        children: [],
        archived: false,
      });
      blockIds.add(rootAlias);
    }
  }

  const variables = toArray<ProjectImportVariable>(source.variables).map(
    (variable, index) => ({
      id:
        typeof variable?.id === "string" && variable.id.trim()
          ? variable.id.trim()
          : `variable-${index + 1}`,
      name:
        typeof variable?.name === "string" && variable.name.trim()
          ? variable.name.trim()
          : `variable_${index + 1}`,
      variable_type:
        typeof variable?.variable_type === "string" &&
        variable.variable_type.trim()
          ? variable.variable_type.trim()
          : "string",
      scope:
        typeof variable?.scope === "string" && variable.scope.trim()
          ? variable.scope.trim()
          : "global",
      default_value: variable?.default_value ?? null,
      archived: Boolean(variable?.archived),
    }),
  );

  const dataModels = toArray<ProjectImportDataModel>(source.data_models).map(
    (model, index) => ({
      id:
        typeof model?.id === "string" && model.id.trim()
          ? model.id.trim()
          : `model-${index + 1}`,
      name:
        typeof model?.name === "string" && model.name.trim()
          ? model.name.trim()
          : `Model ${index + 1}`,
      fields: Array.isArray(model?.fields) ? model.fields : [],
      relations: Array.isArray(model?.relations) ? model.relations : [],
      timestamps: model?.timestamps !== false,
      soft_delete: Boolean(model?.soft_delete),
      archived: Boolean(model?.archived),
    }),
  );

  const logicFlows = toArray<ProjectImportLogicFlow>(source.logic_flows).map(
    (flow, index) => ({
      id:
        typeof flow?.id === "string" && flow.id.trim()
          ? flow.id.trim()
          : `logic-flow-${index + 1}`,
      name:
        typeof flow?.name === "string" && flow.name.trim()
          ? flow.name.trim()
          : `Logic Flow ${index + 1}`,
      description:
        typeof flow?.description === "string" ? flow.description : "",
      trigger: toRecord(flow?.trigger, { type: "manual" }),
      nodes: Array.isArray(flow?.nodes) ? flow.nodes : [],
      edges: Array.isArray(flow?.edges) ? flow.edges : [],
      context:
        typeof flow?.context === "string" && flow.context.trim()
          ? flow.context.trim()
          : "frontend",
      archived: Boolean(flow?.archived),
    }),
  );

  return {
    version:
      typeof source.version === "string" && source.version.trim()
        ? source.version.trim()
        : "1.0.0",
    project: {
      name: projectName,
      description: projectDescription,
      settings: projectSettings,
    },
    pages,
    blocks,
    variables,
    data_models: dataModels,
    logic_flows: logicFlows,
  };
}

export async function exportProjectPayload(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      pages: true,
      blocks: true,
      variables: true,
      dataModels: true,
      logicFlows: true,
    },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  return {
    version: "1.0.0",
    project: {
      name: project.name,
      description: project.description || "",
      settings: parseJsonValue<Record<string, unknown>>(project.settings, {}),
    },
    pages: project.pages.map((page) => toPageSchema(page, project.blocks)),
    blocks: toProjectSchema(
      project,
      project.pages,
      project.blocks,
      project.variables,
      project.dataModels,
      project.logicFlows,
    ).blocks,
    variables: project.variables.map(toVariableSchema),
    data_models: project.dataModels.map(toDataModelSchema),
    logic_flows: project.logicFlows.map((flow) => ({
      ...toLogicFlowSchema(flow),
      nodes: parseJsonValue<unknown[]>(flow.nodes, []),
      trigger: parseJsonValue<JsonRecord>(flow.trigger, { type: "manual" }),
      edges: parseJsonValue<unknown[]>(flow.edges, []),
    })),
  };
}

export async function importProjectPayload(input: unknown) {
  const payload = normalizePayload(input);

  const project = await prisma.project.create({
    data: {
      name: payload.project.name,
      description: payload.project.description || "",
      settings: JSON.stringify(payload.project.settings || {}),
    },
  });

  const pageMap = new Map<
    string,
    { publicId: string; internalId: string; meta: JsonRecord }
  >();

  for (const page of payload.pages || []) {
    const createdPage = await prisma.page.create({
      data: {
        id: page.id,
        projectId: project.id,
        name: page.name,
        path: page.path,
        isDynamic: Boolean(page.is_dynamic),
        archived: Boolean(page.archived),
        meta: JSON.stringify({}),
      },
    });

    pageMap.set(page.id, {
      publicId: createdPage.id,
      internalId: createdPage.idRoot,
      meta: toRecord(page.meta),
    });
  }

  const blocks = payload.blocks || [];
  const blockOrderByAlias = new Map(
    blocks.map((block, index) => [
      block.id,
      typeof block.order === "number" ? block.order : index,
    ]),
  );
  const childAliasesByParent = new Map<string, string[]>();

  for (const block of blocks) {
    if (block.parent_id) {
      const existing = childAliasesByParent.get(block.parent_id) || [];
      existing.push(block.id);
      childAliasesByParent.set(block.parent_id, existing);
    }
  }

  const blockIdMap = new Map<string, string>();
  const createdBlocks = new Map<
    string,
    {
      databaseId: string;
      parentAlias: string | null;
    }
  >();

  for (const block of blocks) {
    const targetPage =
      block.page_id && pageMap.has(block.page_id)
        ? pageMap.get(block.page_id)
        : pageMap.size === 1
          ? [...pageMap.values()][0]
          : null;

    const createdBlock = await prisma.block.create({
      data: {
        projectId: project.id,
        pageId: targetPage?.internalId || null,
        parentId: null,
        blockType: block.block_type,
        name: block.name,
        properties: JSON.stringify(block.properties || {}),
        styles: JSON.stringify(block.styles || {}),
        responsiveStyles: JSON.stringify(block.responsive_styles || {}),
        classes: JSON.stringify(block.classes || []),
        events: JSON.stringify(block.event_handlers || []),
        bindings: JSON.stringify(block.bindings || {}),
        children: JSON.stringify([]),
        order: typeof block.order === "number" ? block.order : 0,
        archived: Boolean(block.archived),
      },
    });

    blockIdMap.set(block.id, createdBlock.id);
    createdBlocks.set(block.id, {
      databaseId: createdBlock.id,
      parentAlias: block.parent_id ?? null,
    });
  }

  for (const [alias, created] of createdBlocks.entries()) {
    const childAliases = childAliasesByParent.get(alias) || [];
    childAliases.sort(
      (left, right) =>
        (blockOrderByAlias.get(left) ?? 0) - (blockOrderByAlias.get(right) ?? 0),
    );

    await prisma.block.update({
      where: { id: created.databaseId },
      data: {
        parentId: created.parentAlias
          ? blockIdMap.get(created.parentAlias) || null
          : null,
        children: JSON.stringify(
          childAliases
            .map((childAlias) => blockIdMap.get(childAlias))
            .filter((childId): childId is string => typeof childId === "string"),
        ),
      },
    });
  }

  for (const [, pageEntry] of pageMap.entries()) {
    const meta = { ...pageEntry.meta };
    const rootAlias =
      typeof meta.root_block_id === "string" ? meta.root_block_id : null;

    if (rootAlias && blockIdMap.has(rootAlias)) {
      meta.root_block_id = blockIdMap.get(rootAlias);
    } else {
      delete meta.root_block_id;
    }

    await prisma.page.update({
      where: { id: pageEntry.publicId },
      data: { meta: JSON.stringify(meta) },
    });
  }

  for (const variable of payload.variables || []) {
    await prisma.variable.create({
      data: {
        projectId: project.id,
        name: variable.name,
        type: variable.variable_type,
        value: JSON.stringify(variable.default_value ?? null),
        isSecret: false,
      },
    });
  }

  const dataModelIdMap = new Map<string, string>();

  for (const model of payload.data_models || []) {
    const createdModel = await prisma.dataModel.create({
      data: {
        projectId: project.id,
        name: model.name,
        schema: JSON.stringify({
          fields: Array.isArray(model.fields) ? model.fields : [],
          relations: [],
          timestamps: model.timestamps !== false,
          soft_delete: Boolean(model.soft_delete),
        }),
        archived: Boolean(model.archived),
      },
    });

    dataModelIdMap.set(model.id || createdModel.id, createdModel.id);
  }

  for (const model of payload.data_models || []) {
    const createdModelId = dataModelIdMap.get(model.id || "");
    if (!createdModelId) continue;

    const relations = (model.relations || []).map((relation, index) => ({
      id:
        typeof relation.id === "string" && relation.id.trim()
          ? relation.id.trim()
          : `${createdModelId}-relation-${index + 1}`,
      name:
        typeof relation.name === "string" && relation.name.trim()
          ? relation.name.trim()
          : `Relation ${index + 1}`,
      target_model_id:
        typeof relation.target_model_id === "string"
          ? dataModelIdMap.get(relation.target_model_id) || relation.target_model_id
          : "",
      relation_type:
        typeof relation.relation_type === "string" &&
        relation.relation_type.trim()
          ? relation.relation_type.trim()
          : "has_many",
    }));

    await prisma.dataModel.update({
      where: { id: createdModelId },
      data: {
        schema: JSON.stringify({
          fields: Array.isArray(model.fields) ? model.fields : [],
          relations,
          timestamps: model.timestamps !== false,
          soft_delete: Boolean(model.soft_delete),
        }),
      },
    });
  }

  for (const flow of payload.logic_flows || []) {
    await prisma.logicFlow.create({
      data: {
        projectId: project.id,
        name: flow.name,
        trigger: JSON.stringify(flow.trigger || { type: "manual" }),
        nodes: JSON.stringify(flow.nodes || []),
        edges: JSON.stringify(flow.edges || []),
        archived: Boolean(flow.archived),
      },
    });
  }

  const importedProject = await prisma.project.findUnique({
    where: { id: project.id },
    include: {
      pages: true,
      blocks: true,
      variables: true,
      dataModels: true,
      logicFlows: true,
    },
  });

  if (!importedProject) {
    throw new Error("Imported project could not be loaded.");
  }

  return toProjectSchema(
    importedProject,
    importedProject.pages,
    importedProject.blocks,
    importedProject.variables,
    importedProject.dataModels,
    importedProject.logicFlows,
  );
}

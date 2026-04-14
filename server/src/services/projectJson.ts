import { randomUUID } from "node:crypto";
import prisma from "../lib/prisma.js";

type JsonObject = Record<string, unknown>;
type StyleValue = string | number | boolean;
type StyleRecord = Record<string, StyleValue>;

interface ProjectRelations {
  pages?: any[];
  blocks?: any[];
  variables?: any[];
  dataModels?: any[];
  logicFlows?: any[];
}

interface NormalizedBlockImport {
  token: string;
  parentToken: string | null;
  childTokens: string[];
  block_type: string;
  name: string;
  properties: JsonObject;
  styles: StyleRecord;
  responsive_styles: Record<string, StyleRecord>;
  classes: string[];
  bindings: JsonObject;
  event_handlers: Array<{ event: string; logic_flow_id: string }>;
  order: number;
  archived: boolean;
}

interface NormalizedPageImport {
  name: string;
  path: string;
  is_dynamic: boolean;
  meta: JsonObject;
  archived: boolean;
  blocks: NormalizedBlockImport[];
}

interface NormalizedVariableImport {
  id: string;
  name: string;
  variable_type: string;
  default_value: unknown;
  is_secret: boolean;
}

interface NormalizedFieldImport {
  id: string;
  name: string;
  field_type: string;
  required: boolean;
  unique: boolean;
  primary_key: boolean;
  default?: string;
  description?: string;
}

interface NormalizedRelationImport {
  id: string;
  name: string;
  target_model_token: string;
  relation_type: string;
}

interface NormalizedDataModelImport {
  token: string;
  name: string;
  fields: NormalizedFieldImport[];
  relations: NormalizedRelationImport[];
  timestamps: boolean;
  soft_delete: boolean;
  archived: boolean;
}

interface NormalizedLogicFlowImport {
  id: string;
  name: string;
  trigger: JsonObject;
  nodes: unknown[];
  archived: boolean;
}

interface NormalizedUseCaseImport {
  id: string;
  name: string;
  description: string;
  actors: string[];
  preconditions: string;
  postconditions: string;
  steps: Array<{ order: number; description: string }>;
  priority: "low" | "medium" | "high" | "critical";
  status: "draft" | "active" | "completed" | "archived";
  category: string;
  archived: boolean;
}

interface NormalizedProjectImport {
  version: string;
  project: {
    name: string;
    description: string;
    settings: JsonObject;
  };
  pages: NormalizedPageImport[];
  variables: NormalizedVariableImport[];
  data_models: NormalizedDataModelImport[];
  logic_flows: NormalizedLogicFlowImport[];
  use_cases: NormalizedUseCaseImport[];
}

export class ProjectImportValidationError extends Error {}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asObject(value: unknown): JsonObject {
  return isPlainObject(value) ? value : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function sanitizeStyleRecord(value: unknown): StyleRecord {
  const source = asObject(value);
  const result: StyleRecord = {};

  for (const [key, entry] of Object.entries(source)) {
    if (
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean"
    ) {
      result[key] = entry;
    }
  }

  return result;
}

function sanitizeResponsiveStyles(
  value: unknown,
): Record<string, StyleRecord> {
  const source = asObject(value);
  const result: Record<string, StyleRecord> = {};

  for (const [breakpoint, styles] of Object.entries(source)) {
    result[breakpoint] = sanitizeStyleRecord(styles);
  }

  return result;
}

function toKebabCase(input: string): string {
  const kebab = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return kebab || "page";
}

function normalizePagePath(path: string, fallbackIndex: number): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return fallbackIndex === 0 ? "/" : `/page-${fallbackIndex + 1}`;
  }

  if (trimmed === "/") {
    return "/";
  }

  const compact = trimmed.replace(/^\/+|\/+$/g, "");
  return `/${toKebabCase(compact.replace(/\//g, "-"))}`;
}

function defaultProjectSettings(): JsonObject {
  return {
    default_locale: "en",
    locales: ["en"],
    theme: {
      primary_color: "#3b82f6",
    },
  };
}

function mergeProjectSettings(settings: JsonObject): JsonObject {
  const defaults = defaultProjectSettings();
  const themeDefaults = asObject(defaults.theme);
  const incomingTheme = asObject(settings.theme);

  return {
    ...defaults,
    ...settings,
    theme: {
      ...themeDefaults,
      ...incomingTheme,
    },
  };
}

function parsePriority(
  value: unknown,
): "low" | "medium" | "high" | "critical" {
  return value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "critical"
    ? value
    : "medium";
}

function parseUseCaseStatus(
  value: unknown,
): "draft" | "active" | "completed" | "archived" {
  return value === "draft" ||
    value === "active" ||
    value === "completed" ||
    value === "archived"
    ? value
    : "draft";
}

function normalizeEventHandlers(
  value: unknown,
): Array<{ event: string; logic_flow_id: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const source = asObject(entry);
      const event = asString(source.event).trim();
      const logicFlowId = asString(source.logic_flow_id).trim();

      if (!event || !logicFlowId) {
        return null;
      }

      return { event, logic_flow_id: logicFlowId };
    })
    .filter(
      (
        entry,
      ): entry is { event: string; logic_flow_id: string } => entry !== null,
    );
}

function collectBlocks(
  entry: unknown,
  pageIndex: number,
  blockIndex: number,
  parentToken: string | null,
): NormalizedBlockImport[] {
  const source = asObject(entry);
  const fallbackToken = `page-${pageIndex + 1}-block-${blockIndex + 1}`;
  const token =
    asString(source.ref).trim() ||
    asString(source.id).trim() ||
    fallbackToken;

  const childEntries = Array.isArray(source.children) ? source.children : [];
  const explicitChildTokens = childEntries
    .filter((child): child is string => typeof child === "string" && child.trim().length > 0)
    .map((child) => child.trim());
  const nestedChildEntries = childEntries.filter((child) => isPlainObject(child));

  const current: NormalizedBlockImport = {
    token,
    parentToken:
      asString(source.parent_ref).trim() ||
      asString(source.parent_id).trim() ||
      parentToken,
    childTokens: explicitChildTokens,
    block_type:
      asString(source.block_type).trim() ||
      asString(source.blockType).trim() ||
      asString(source.type).trim() ||
      "section",
    name: asString(source.name).trim() || `Block ${blockIndex + 1}`,
    properties: asObject(source.properties),
    styles: sanitizeStyleRecord(source.styles),
    responsive_styles: sanitizeResponsiveStyles(source.responsive_styles),
    classes: asStringArray(source.classes),
    bindings: asObject(source.bindings),
    event_handlers: normalizeEventHandlers(source.event_handlers),
    order: asFiniteNumber(source.order, blockIndex),
    archived: asBoolean(source.archived, false),
  };

  const nestedBlocks = nestedChildEntries.flatMap((child, childIndex) =>
    collectBlocks(child, pageIndex, childIndex, token),
  );

  current.childTokens.push(...nestedBlocks.map((block) => block.token));
  return [current, ...nestedBlocks];
}

function normalizePageImport(
  value: unknown,
  pageIndex: number,
): NormalizedPageImport {
  const source = asObject(value);
  const name = asString(source.name).trim() || `Page ${pageIndex + 1}`;
  const blocks = Array.isArray(source.blocks)
    ? source.blocks.flatMap((entry, blockIndex) =>
        collectBlocks(entry, pageIndex, blockIndex, null),
      )
    : [];

  return {
    name,
    path: normalizePagePath(asString(source.path), pageIndex),
    is_dynamic: asBoolean(source.is_dynamic, false),
    meta: asObject(source.meta),
    archived: asBoolean(source.archived, false),
    blocks,
  };
}

function normalizeFieldImport(
  value: unknown,
  fieldIndex: number,
): NormalizedFieldImport {
  const source = asObject(value);
  const fieldType =
    asString(source.field_type).trim() ||
    asString(source.type).trim() ||
    "string";

  return {
    id: asString(source.id).trim() || randomUUID(),
    name: asString(source.name).trim() || `field_${fieldIndex + 1}`,
    field_type: fieldType,
    required: asBoolean(source.required, false),
    unique: asBoolean(source.unique, false),
    primary_key: asBoolean(source.primary_key, false),
    ...(typeof source.default === "string" ? { default: source.default } : {}),
    ...(typeof source.description === "string"
      ? { description: source.description }
      : {}),
  };
}

function normalizeRelationImport(
  value: unknown,
  relationIndex: number,
): NormalizedRelationImport {
  const source = asObject(value);
  const targetToken =
    asString(source.target_model_ref).trim() ||
    asString(source.target_model_id).trim();

  return {
    id: asString(source.id).trim() || randomUUID(),
    name: asString(source.name).trim() || `relation_${relationIndex + 1}`,
    target_model_token: targetToken,
    relation_type:
      asString(source.relation_type).trim() ||
      asString(source.type).trim() ||
      "one-to-many",
  };
}

function normalizeDataModelImport(
  value: unknown,
  modelIndex: number,
): NormalizedDataModelImport {
  const source = asObject(value);
  const token =
    asString(source.ref).trim() ||
    asString(source.id).trim() ||
    `model-${modelIndex + 1}`;

  return {
    token,
    name: asString(source.name).trim() || `Model ${modelIndex + 1}`,
    fields: Array.isArray(source.fields)
      ? source.fields.map((entry, fieldIndex) =>
          normalizeFieldImport(entry, fieldIndex),
        )
      : [
          {
            id: randomUUID(),
            name: "id",
            field_type: "uuid",
            required: true,
            unique: true,
            primary_key: true,
          },
        ],
    relations: Array.isArray(source.relations)
      ? source.relations.map((entry, relationIndex) =>
          normalizeRelationImport(entry, relationIndex),
        )
      : [],
    timestamps: asBoolean(source.timestamps, true),
    soft_delete: asBoolean(source.soft_delete, false),
    archived: asBoolean(source.archived, false),
  };
}

function normalizeLogicFlowImport(
  value: unknown,
  flowIndex: number,
): NormalizedLogicFlowImport {
  const source = asObject(value);

  return {
    id:
      asString(source.id).trim() ||
      asString(source.ref).trim() ||
      `logic-flow-${flowIndex + 1}`,
    name: asString(source.name).trim() || `Logic Flow ${flowIndex + 1}`,
    trigger: asObject(source.trigger),
    nodes: Array.isArray(source.nodes) ? source.nodes : [],
    archived: asBoolean(source.archived, false),
  };
}

function normalizeUseCaseImport(
  value: unknown,
  index: number,
): NormalizedUseCaseImport {
  const source = asObject(value);

  return {
    id: asString(source.id).trim() || randomUUID(),
    name: asString(source.name).trim() || `Use Case ${index + 1}`,
    description: asString(source.description),
    actors: asStringArray(source.actors),
    preconditions: asString(source.preconditions),
    postconditions: asString(source.postconditions),
    steps: Array.isArray(source.steps)
      ? source.steps
          .map((entry, stepIndex) => {
            const step = asObject(entry);
            const description = asString(step.description).trim();
            if (!description) {
              return null;
            }

            return {
              order: asFiniteNumber(step.order, stepIndex + 1),
              description,
            };
          })
          .filter(
            (entry): entry is { order: number; description: string } =>
              entry !== null,
          )
      : [],
    priority: parsePriority(source.priority),
    status: parseUseCaseStatus(source.status),
    category: asString(source.category),
    archived: asBoolean(source.archived, false),
  };
}

function normalizeProjectImport(raw: unknown): NormalizedProjectImport {
  const source = asObject(raw);
  const projectNode = isPlainObject(source.project) ? source.project : source;
  const projectName = asString(projectNode.name).trim();

  if (!projectName) {
    throw new ProjectImportValidationError(
      "Project JSON must include a non-empty project name.",
    );
  }

  const pages = Array.isArray(source.pages)
    ? source.pages.map((entry, pageIndex) => normalizePageImport(entry, pageIndex))
    : [];

  const normalizedPages =
    pages.length > 0
      ? pages
      : [
          {
            name: "Home",
            path: "/",
            is_dynamic: false,
            meta: {
              title: projectName,
            },
            archived: false,
            blocks: [],
          },
        ];

  for (const page of normalizedPages) {
    const blocksByToken = new Map(page.blocks.map((block) => [block.token, block]));

    for (const block of page.blocks) {
      for (const childToken of block.childTokens) {
        const child = blocksByToken.get(childToken);
        if (!child) {
          throw new ProjectImportValidationError(
            `Block "${block.token}" references missing child "${childToken}".`,
          );
        }

        if (!child.parentToken) {
          child.parentToken = block.token;
        }
      }
    }

    for (const block of page.blocks) {
      if (block.parentToken && !blocksByToken.has(block.parentToken)) {
        throw new ProjectImportValidationError(
          `Block "${block.token}" references missing parent "${block.parentToken}".`,
        );
      }
    }
  }

  return {
    version: asString(source.version, "1.0.0"),
    project: {
      name: projectName,
      description: asString(projectNode.description),
      settings: mergeProjectSettings(asObject(projectNode.settings)),
    },
    pages: normalizedPages,
    variables: Array.isArray(source.variables)
      ? source.variables.map((entry, index) => {
          const variable = asObject(entry);
          return {
            id: asString(variable.id).trim() || randomUUID(),
            name: asString(variable.name).trim() || `variable_${index + 1}`,
            variable_type:
              asString(variable.variable_type).trim() ||
              asString(variable.type).trim() ||
              "string",
            default_value: variable.default_value ?? null,
            is_secret: asBoolean(variable.is_secret, false),
          };
        })
      : [],
    data_models: Array.isArray(source.data_models)
      ? source.data_models.map((entry, index) =>
          normalizeDataModelImport(entry, index),
        )
      : [],
    logic_flows: Array.isArray(source.logic_flows)
      ? source.logic_flows.map((entry, index) =>
          normalizeLogicFlowImport(entry, index),
        )
      : [],
    use_cases: Array.isArray(source.use_cases)
      ? source.use_cases.map((entry, index) =>
          normalizeUseCaseImport(entry, index),
        )
      : [],
  };
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

export function toPageSchema(page: any, blocks: any[] = []) {
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

function toVariableSchema(variable: any) {
  return {
    id: variable.id,
    name: variable.name,
    variable_type: variable.type,
    scope: "global",
    default_value: variable.value
      ? parseJsonValue(variable.value, variable.value)
      : null,
    archived: false,
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
    description: "",
    trigger: parseJsonValue<Record<string, unknown>>(flow.trigger, {
      type: "manual",
    }),
    nodes: parseJsonValue<unknown[]>(flow.nodes, []),
    entry_node_id: undefined,
    context: "manual",
    archived: flow.archived || false,
  };
}

function toBlockSchema(block: any, pageIdByInternalId: Map<string, string>) {
  return {
    id: block.id,
    block_type: block.blockType,
    name: block.name,
    properties: parseJsonValue<Record<string, unknown>>(block.properties, {}),
    styles: parseJsonValue<StyleRecord>(block.styles, {}),
    responsive_styles: parseJsonValue<Record<string, StyleRecord>>(
      block.responsiveStyles,
      {},
    ),
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

export function toProjectSchema(project: any, relations: ProjectRelations = {}) {
  const pages = relations.pages || [];
  const blocks = relations.blocks || [];
  const variables = relations.variables || [];
  const dataModels = relations.dataModels || [];
  const logicFlows = relations.logicFlows || [];

  const pageIdByInternalId = new Map<string, string>();
  for (const page of pages) {
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
    blocks: blocks.map((block: any) => toBlockSchema(block, pageIdByInternalId)),
    pages: pages.map((page: any) => toPageSchema(page, blocks)),
    apis: [],
    logic_flows: logicFlows.map(toLogicFlowSchema),
    data_models: dataModels.map(toDataModelSchema),
    variables: variables.map(toVariableSchema),
    components: [],
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
      logicFlows: true,
    },
  });

  if (!project) {
    return null;
  }

  return toProjectSchema(project, project);
}

export function buildProjectImportSample(projectName = "Sample Project") {
  return {
    version: "1.0.0",
    project: {
      name: projectName,
      description:
        "Edit this sample and import it to create a project with starter pages, blocks, data models, variables, and logic flows.",
      settings: defaultProjectSettings(),
    },
    pages: [
      {
        name: "Home",
        path: "/",
        is_dynamic: false,
        meta: {
          title: `${projectName} Home`,
          description: "Landing page imported from JSON.",
        },
        blocks: [
          {
            id: "hero-title",
            block_type: "heading",
            name: "Hero Title",
            properties: {
              text: projectName,
              level: 1,
            },
            styles: {
              fontSize: "40px",
              fontWeight: 800,
              color: "#0f172a",
            },
          },
          {
            id: "hero-copy",
            block_type: "paragraph",
            name: "Hero Copy",
            properties: {
              text: "Replace this text with your project pitch.",
            },
            styles: {
              fontSize: "16px",
              color: "#475569",
            },
          },
          {
            id: "hero-cta",
            block_type: "button",
            name: "Hero CTA",
            properties: {
              text: "Get Started",
            },
            styles: {
              backgroundColor: "#06b6d4",
              color: "#06243a",
              fontWeight: 700,
            },
          },
        ],
      },
      {
        name: "About",
        path: "/about",
        is_dynamic: false,
        meta: {
          title: `${projectName} About`,
        },
        blocks: [
          {
            id: "about-title",
            block_type: "heading",
            name: "About Title",
            properties: {
              text: "About This Project",
              level: 2,
            },
          },
          {
            id: "about-copy",
            block_type: "paragraph",
            name: "About Copy",
            properties: {
              text: "Describe the product, scope, or roadmap here.",
            },
          },
        ],
      },
    ],
    variables: [
      {
        id: "app-name",
        name: "appName",
        variable_type: "string",
        default_value: projectName,
        is_secret: false,
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
        id: "app-bootstrap",
        name: "App bootstrap",
        trigger: {
          type: "manual",
        },
        nodes: [],
      },
    ],
    use_cases: [
      {
        id: "view-home",
        name: "View home page",
        description:
          "A visitor lands on the home page and reads the core pitch.",
        actors: ["Visitor"],
        preconditions: "The site is available.",
        postconditions:
          "The visitor understands the main value proposition.",
        steps: [
          { order: 1, description: "Open the home page." },
          { order: 2, description: "Read the heading and CTA." },
        ],
        priority: "medium",
        status: "draft",
        category: "marketing",
      },
    ],
  };
}

export async function exportProjectDocument(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      pages: true,
      blocks: true,
      variables: true,
      dataModels: true,
      logicFlows: true,
      useCases: true,
    },
  });

  if (!project) {
    return null;
  }

  return {
    version: "1.0.0",
    project: {
      name: project.name,
      description: project.description || "",
      settings: parseJsonValue<Record<string, unknown>>(project.settings, {}),
    },
    pages: project.pages.map((page: any) => {
      const meta = parseJsonValue<Record<string, unknown>>(page.meta, {});
      const rootBlockId =
        typeof meta.root_block_id === "string" && meta.root_block_id
          ? meta.root_block_id
          : project.blocks.find(
              (block: any) =>
                String(block.pageId) === String(page.idRoot) &&
                !block.parentId &&
                !block.archived,
            )?.id;

      const blocks = project.blocks
        .filter(
          (block: any) =>
            String(block.pageId) === String(page.idRoot) && block.id !== rootBlockId,
        )
        .sort((left: any, right: any) => left.order - right.order)
        .map((block: any) => ({
          id: block.id,
          ref: block.id,
          block_type: block.blockType,
          name: block.name,
          parent_id:
            block.parentId && block.parentId !== rootBlockId ? block.parentId : null,
          order: block.order,
          properties: parseJsonValue<Record<string, unknown>>(block.properties, {}),
          styles: parseJsonValue<StyleRecord>(block.styles, {}),
          responsive_styles: parseJsonValue<Record<string, StyleRecord>>(
            block.responsiveStyles,
            {},
          ),
          classes: parseJsonValue<string[]>(block.classes, []),
          bindings: parseJsonValue<Record<string, unknown>>(block.bindings, {}),
          event_handlers: parseJsonValue<any[]>(block.events, []),
          archived: block.archived || false,
        }));

      return {
        name: page.name,
        path: page.path,
        is_dynamic: page.isDynamic || false,
        meta: Object.fromEntries(
          Object.entries(meta).filter(([key]) => key !== "root_block_id"),
        ),
        archived: page.archived || false,
        blocks,
      };
    }),
    variables: project.variables.map((variable: any) => ({
      id: variable.id,
      name: variable.name,
      variable_type: variable.type,
      default_value: variable.value
        ? parseJsonValue(variable.value, variable.value)
        : null,
      is_secret: variable.isSecret || false,
    })),
    data_models: project.dataModels.map((model: any) => {
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
    }),
    logic_flows: project.logicFlows.map((flow: any) => ({
      id: flow.id,
      name: flow.name,
      trigger: parseJsonValue<JsonObject>(flow.trigger, { type: "manual" }),
      nodes: parseJsonValue<unknown[]>(flow.nodes, []),
      archived: flow.archived || false,
    })),
    use_cases: project.useCases.map((useCase: any) => ({
      id: useCase.id,
      name: useCase.name,
      description: useCase.description || "",
      actors: parseJsonValue<string[]>(useCase.actors, []),
      preconditions: useCase.preconditions || "",
      postconditions: useCase.postconditions || "",
      steps: parseJsonValue<Array<{ order: number; description: string }>>(
        useCase.steps,
        [],
      ),
      priority: useCase.priority,
      status: useCase.status,
      category: useCase.category || "",
      archived: useCase.archived || false,
    })),
  };
}

export async function importProjectFromPayload(rawPayload: unknown) {
  const payload =
    typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;
  const normalized = normalizeProjectImport(payload);

  const project = await prisma.project.create({
    data: {
      name: normalized.project.name,
      description: normalized.project.description,
      settings: JSON.stringify(normalized.project.settings),
    },
  });

  try {
    const dataModelIdByToken = new Map<string, string>();

    for (const page of normalized.pages) {
      const createdPage = await prisma.page.create({
        data: {
          id: randomUUID(),
          projectId: project.id,
          name: page.name,
          path: page.path,
          isDynamic: page.is_dynamic,
          archived: page.archived,
          meta: JSON.stringify({}),
        },
      });

      const rootBlock = await prisma.block.create({
        data: {
          projectId: project.id,
          pageId: createdPage.idRoot,
          parentId: null,
          blockType: "canvas",
          name: "Page Root",
          properties: JSON.stringify({}),
          styles: JSON.stringify({}),
          responsiveStyles: JSON.stringify({}),
          classes: JSON.stringify([]),
          events: JSON.stringify([]),
          bindings: JSON.stringify({}),
          children: JSON.stringify([]),
          order: 0,
          archived: false,
        },
      });

      const blockIdByToken = new Map<string, string>();
      const childTokensByParent = new Map<string, string[]>();

      for (const block of page.blocks) {
        const createdBlock = await prisma.block.create({
          data: {
            projectId: project.id,
            pageId: createdPage.idRoot,
            parentId: null,
            blockType: block.block_type,
            name: block.name,
            properties: JSON.stringify(block.properties),
            styles: JSON.stringify(block.styles),
            responsiveStyles: JSON.stringify(block.responsive_styles),
            classes: JSON.stringify(block.classes),
            events: JSON.stringify(block.event_handlers),
            bindings: JSON.stringify(block.bindings),
            children: JSON.stringify([]),
            order: block.order,
            archived: block.archived,
          },
        });

        blockIdByToken.set(block.token, createdBlock.id);
        if (block.parentToken) {
          const siblings = childTokensByParent.get(block.parentToken) || [];
          siblings.push(block.token);
          childTokensByParent.set(block.parentToken, siblings);
        }
      }

      const rootChildren = page.blocks
        .filter((block) => !block.parentToken)
        .sort((left, right) => left.order - right.order)
        .map((block) => blockIdByToken.get(block.token))
        .filter((blockId): blockId is string => typeof blockId === "string");

      await prisma.block.update({
        where: { id: rootBlock.id },
        data: {
          children: JSON.stringify(rootChildren),
        },
      });

      for (const block of page.blocks) {
        const blockId = blockIdByToken.get(block.token);
        if (!blockId) continue;

        const childIds = (childTokensByParent.get(block.token) || [])
          .map((childToken) => blockIdByToken.get(childToken))
          .filter((childId): childId is string => typeof childId === "string");

        await prisma.block.update({
          where: { id: blockId },
          data: {
            parentId: block.parentToken
              ? blockIdByToken.get(block.parentToken) || rootBlock.id
              : rootBlock.id,
            children: JSON.stringify(childIds),
          },
        });
      }

      await prisma.page.update({
        where: { id: createdPage.id },
        data: {
          meta: JSON.stringify({
            ...page.meta,
            root_block_id: rootBlock.id,
          }),
        },
      });
    }

    for (const variable of normalized.variables) {
      await prisma.variable.create({
        data: {
          projectId: project.id,
          name: variable.name,
          type: variable.variable_type,
          value: JSON.stringify(variable.default_value),
          isSecret: variable.is_secret,
        },
      });
    }

    for (const model of normalized.data_models) {
      const createdModel = await prisma.dataModel.create({
        data: {
          projectId: project.id,
          name: model.name,
          schema: JSON.stringify({
            fields: model.fields,
            relations: [],
            timestamps: model.timestamps,
            soft_delete: model.soft_delete,
          }),
          archived: model.archived,
        },
      });

      dataModelIdByToken.set(model.token, createdModel.id);
    }

    for (const model of normalized.data_models) {
      const createdModelId = dataModelIdByToken.get(model.token);
      if (!createdModelId) continue;

      const relations = model.relations.map((relation) => ({
        id: relation.id,
        name: relation.name,
        target_model_id:
          dataModelIdByToken.get(relation.target_model_token) ||
          relation.target_model_token,
        relation_type: relation.relation_type,
      }));

      await prisma.dataModel.update({
        where: { id: createdModelId },
        data: {
          schema: JSON.stringify({
            fields: model.fields,
            relations,
            timestamps: model.timestamps,
            soft_delete: model.soft_delete,
          }),
        },
      });
    }

    for (const flow of normalized.logic_flows) {
      await prisma.logicFlow.create({
        data: {
          projectId: project.id,
          name: flow.name,
          trigger: JSON.stringify(flow.trigger || { type: "manual" }),
          nodes: JSON.stringify(flow.nodes || []),
          edges: JSON.stringify([]),
          archived: flow.archived,
        },
      });
    }

    for (const useCase of normalized.use_cases) {
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
    }

    const serialized = await serializeProjectById(project.id);
    if (!serialized) {
      throw new Error("Imported project could not be loaded.");
    }

    return serialized;
  } catch (error) {
    await prisma.project.delete({ where: { id: project.id } }).catch(() => undefined);
    throw error;
  }
}


// Shared API Types

export interface ProjectSchema {
    version: string;
    id: string;
    name: string;
    description?: string;
    created_at: string;
    updated_at: string;
    blocks: BlockSchema[];
    pages: PageSchema[];
    apis: ApiSchema[];
    logic_flows: LogicFlowSchema[];
    data_models: DataModelSchema[];
    variables: VariableSchema[];
    settings: ProjectSettings;
    root_path?: string;
    components: BlockSchema[];
}

export interface InstallStep {
    target: string;
    success: boolean;
    timed_out: boolean;
    duration_ms: number;
    stdout: string;
    stderr: string;
    status: string;
}

export interface InstallResult {
    success: boolean;
    steps: InstallStep[];
}

export interface BlockSchema {
    id: string;
    block_type: string;
    name: string;
    parent_id?: string;
    page_id?: string;
    slot?: string;
    order: number;
    properties: Record<string, unknown>;
    styles: Record<string, string | number | boolean>;
    responsive_styles: Record<string, Record<string, string | number | boolean>>;
    bindings: Record<string, DataBinding>;
    event_handlers: EventHandler[];
    archived: boolean;
    component_id?: string;
    children?: string[];
    classes?: string[];
}

export type StyleValue = string | number | boolean;

export interface DataBinding {
    type: string;
    value: unknown;
}

export interface EventHandler {
    event: string;
    logic_flow_id: string;
}

export interface PageSchema {
    id: string;
    name: string;
    path: string;
    root_block_id?: string;
    meta?: PageMeta;
    is_dynamic: boolean;
    dynamic_param?: string;
    layout_id?: string;
    archived: boolean;
}

export interface PageMeta {
    title?: string;
    description?: string;
    og_image?: string;
}

export interface ApiSchema {
    id: string;
    method: string;
    path: string;
    name: string;
    description?: string;
    request_body?: DataShape;
    response_body?: DataShape;
    query_params?: ParamSchema[];
    path_params?: ParamSchema[];
    logic_flow_id?: string;
    permissions: string[];
    archived: boolean;
}

export interface DataShape {
    shape_type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'model';
    fields?: ShapeField[];
    item_shape?: DataShape;
    model_ref?: string;
}

export interface ShapeField {
    name: string;
    field_type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'model';
    required: boolean;
    nested?: DataShape;
}

export interface ParamSchema {
    name: string;
    param_type: string;
    required: boolean;
    default?: string;
}

export interface LogicFlowSchema {
    id: string;
    name: string;
    description?: string;
    trigger: TriggerType;
    nodes: LogicNode[];
    entry_node_id?: string;
    context: string;
    archived: boolean;
}

export interface TriggerType {
    type: 'event' | 'api' | 'mount' | 'schedule' | 'manual';
    component_id?: string;
    event?: string;
    api_id?: string;
    cron?: string;
}

export interface LogicNode {
    id: string;
    node_type: string;
    data: unknown;
    label?: string;
    next_nodes: string[];
    else_nodes: string[];
    position: { x: number; y: number };
}

export interface DataModelSchema {
    id: string;
    name: string;
    fields: FieldSchema[];
    relations: RelationSchema[];
    timestamps: boolean;
    soft_delete: boolean;
    archived: boolean;
}

export interface FieldSchema {
    id: string;
    name: string;
    field_type: string;
    required: boolean;
    unique: boolean;
    primary_key: boolean;
    default?: string;
    description?: string;
}

export interface RelationSchema {
    id: string;
    name: string;
    target_model_id: string;
    relation_type: string;
}

export interface VariableSchema {
    id: string;
    name: string;
    variable_type: string;
    scope: string;
    default_value?: unknown;
    archived: boolean;
}

export interface ProjectSettings {
    default_locale: string;
    locales: string[];
    theme?: {
        primary_color?: string;
        secondary_color?: string;
        font_family?: string;
        border_radius?: number;
    };
    build?: {
        frontend_framework?: string;
        backend_framework?: string;
        database_provider?: string;
        typescript?: boolean;
    };
    seo?: {
        title_suffix?: string;
        default_description?: string;
        default_og_image?: string;
        favicon?: string;
    };
}

export interface FileEntry {
    name: string;
    path: string;
    is_directory: boolean;
    size?: number;
    extension?: string;
}

export interface GitCommitInfo {
    id: string;
    message: string;
    author: string;
    timestamp: number;
    summary: string;
}

export interface GitFileStatus {
    path: string;
    status: string; // "M", "A", "D", "R", etc.
}

export interface GitStatus {
    is_repo: boolean;
    changed_files: GitFileStatus[];
    total_commits: number;
}

export interface DiagramEntry {
    name: string;
    path: string;
    last_modified?: number;
}

export interface AnalysisResult {
    // ... Simplified for brevity or copy full types later if needed
    graph: any;
    issues: any[];
    stats: any;
}

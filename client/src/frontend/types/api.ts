
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
    settings: ProjectSettings;
    root_path?: string;
    components: BlockSchema[];
}

export interface ProjectImportDocument {
    version: string;
    project: {
        name: string;
        description?: string;
        settings?: Record<string, unknown>;
    };
    pages: ProjectImportPage[];
    blocks: ProjectImportBlock[];
    components?: ProjectImportBlock[];
    data_models?: ProjectImportDataModel[];
    logic_flows?: ProjectImportLogicFlow[];
    apis?: ProjectImportApi[];
    use_cases?: ProjectImportUseCase[];
}

export interface ProjectImportPage {
    id: string;
    name: string;
    path: string;
    root_block_id?: string;
    is_dynamic?: boolean;
    archived?: boolean;
    meta?: Record<string, unknown>;
}

export interface ProjectImportBlock {
    id: string;
    block_type: string;
    name: string;
    parent_id?: string | null;
    page_id?: string | null;
    order?: number;
    properties?: Record<string, unknown>;
    styles?: Record<string, string | number | boolean>;
    responsive_styles?: Record<string, Record<string, string | number | boolean>>;
    bindings?: Record<string, unknown>;
    event_handlers?: Array<Record<string, unknown>>;
    classes?: string[];
    children?: string[];
    archived?: boolean;
}


export interface ProjectImportDataModel {
    id?: string;
    name: string;
    fields?: unknown[];
    relations?: unknown[];
    timestamps?: boolean;
    soft_delete?: boolean;
    archived?: boolean;
}

export interface ProjectImportLogicFlow {
    id?: string;
    name: string;
    description?: string;
    trigger?: Record<string, unknown>;
    nodes?: unknown[];
    edges?: unknown[];
    context?: string;
    archived?: boolean;
}

export interface ProjectImportApi {
    id?: string;
    method: string;
    path: string;
    name: string;
    description?: string;
    request_body?: unknown;
    response_body?: unknown;
    query_params?: Record<string, unknown>[];
    path_params?: Record<string, unknown>[];
    permissions?: string[];
    logic_flow_id?: string;
    archived?: boolean;
}

export interface ProjectImportUseCase {
    id?: string;
    name: string;
    description?: string;
    actors?: string[];
    preconditions?: string;
    postconditions?: string;
    steps?: Array<Record<string, unknown>>;
    priority?: string;
    status?: string;
    category?: string;
    archived?: boolean;
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


export interface StructuredIdeaDetails {
    ideaMetadata?: {
        ideaName: string; tagline: string; summary: string; industry: string; category: string; innovationType: string; creationDate: string;
    };
    problem?: {
        problemStatement: string; problemContext: string; whoHasThisProblem: string[]; painPoints: string[]; currentSolutions: string[]; whyCurrentSolutionsFail: string[]; urgencyLevel: string;
    };
    solution?: {
        productDescription: string; coreInnovation: string; valueProposition: string; keyBenefits: string[]; useCases: string[];
    };
    targetMarket?: {
        primaryUsers: string[]; customerSegments: string[]; marketSize: { tam: string; sam: string; som: string; }; geographicFocus: string; earlyAdopters: string[];
    };
    competition?: {
        directCompetitors: string[]; indirectCompetitors: string[]; competitiveAdvantages: string[]; weaknessesOfCompetitors: string[]; differentiationStrategy: string;
    };
    product?: {
        coreFeatures: string[]; advancedFeatures: string[]; futureFeatures: string[]; platforms: string[];
    };
    userExperience?: {
        onboardingFlow: string[]; mainUserJourney: string[]; retentionMechanisms: string[]; viralityMechanisms: string[];
    };
    monetization?: {
        revenueModel: string; pricingStrategy: string; pricingTiers: { free: string; pro: string; enterprise: string; }; estimatedLTV: string; estimatedCAC: string;
    };
    goToMarket?: {
        launchStrategy: string[]; marketingChannels: string[]; growthLoops: string[]; partnerships: string[];
    };
    technicalArchitecture?: {
        frontend: string; backend: string; database: string; aiComponents: string; infrastructure: string; integrations: string[]; security: string[]; scalabilityPlan: string;
    };
    dataModel?: {
        coreEntities: string[]; relationships: string[]; dataPrivacy: string;
    };
    aiStrategy?: {
        aiRoleInProduct: string; modelsUsed: string[]; trainingDataSources: string[]; aiRisks: string[];
    };
    mvpPlan?: {
        mvpGoal: string; mustHaveFeatures: string[]; developmentTimeEstimate: string; teamRequired: string[];
    };
    validation?: {
        assumptions: string[]; validationMethods: string[]; successCriteria: string[];
    };
    risks?: {
        technicalRisks: string[]; marketRisks: string[]; legalRisks: string[]; businessRisks: string[];
    };
    metrics?: {
        northStarMetric: string; kpis: string[];
    };
    roadmap?: {
        phase1: string; phase2: string; phase3: string; phase4: string;
    };
    ideaScore?: {
        marketPotential: string; technicalFeasibility: string; competitionLevel: string; buildDifficulty: string; overallScore: string | number;
    };
}

export interface UiArchitectSavedPlan {
    version: string;
    saved_at: string;
    form?: Record<string, unknown>;
    globals?: {
        themeMode?: string;
        spacingScale?: string;
        animationSpeed?: string;
        containerWidth?: string;
    };
    export_payload?: Record<string, unknown>;
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
    ideaDetails?: StructuredIdeaDetails;
    uiArchitectPlan?: UiArchitectSavedPlan;
    github_repo?: {
        owner: string;
        name: string;
        full_name: string;
        default_branch: string;
    };
    github_repos?: {
        owner: string;
        name: string;
        full_name: string;
        default_branch: string;
        is_default?: boolean;
    }[];
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

export interface UseCaseStep {
    order: number;
    description: string;
}

export interface UseCaseSchema {
    id: string;
    project_id: string;
    name: string;
    description: string;
    actors: string[];
    preconditions: string;
    postconditions: string;
    steps: UseCaseStep[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'draft' | 'active' | 'completed' | 'archived';
    category: string;
    created_at: string;
    updated_at: string;
    archived: boolean;
}

export interface ApiRequestEntry {
    id: string;
    project_id: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
    params: Record<string, string>;
    response_status: number | null;
    response_headers: Record<string, string>;
    response_body: string;
    duration: number;
    created_at: string;
}

export interface ProxyResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    duration_ms: number;
    url: string;
    error?: boolean;
}

// ===== Akasha Product Intelligence Types =====

export type NodeType = 'actor' | 'feature' | 'screen' | 'api' | 'database' | 'external_service' | 'decision' | 'process' | 'unknown';
export type RelationshipType = 'flow' | 'dependency' | 'association';
export type Severity = 'info' | 'warning' | 'error';

export interface ProductNode {
    id: string;
    label: string;
    node_type: NodeType;
    properties: Record<string, string>;
}

export interface ProductEdge {
    id: string;
    source: string;
    target: string;
    label: string;
    relationship_type: RelationshipType;
}

export interface ProductGraph {
    nodes: ProductNode[];
    edges: ProductEdge[];
}

export interface ValidationIssue {
    severity: Severity;
    message: string;
    element_id?: string;
    rule: string;
}

export interface GraphStats {
    total_nodes: number;
    total_edges: number;
    unknown_type_count: number;
    issue_count: number;
}

export interface AnalysisResult {
    graph: ProductGraph;
    issues: ValidationIssue[];
    stats: GraphStats;
}

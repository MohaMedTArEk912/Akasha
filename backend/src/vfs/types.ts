/**
 * Protection levels determine what operations are allowed
 */
export enum ProtectionLevel {
    /** Block-owned files: no delete, no rename, no raw edit */
    PROTECTED = 'protected',
    /** Schema files: no delete, editable via forms */
    SEMI_EDITABLE = 'semi_editable',
    /** Custom code: full access with warnings */
    FREE_CODE = 'free_code'
}

/**
 * File types in the VFS
 */
export enum FileType {
    PAGE = 'page',           // .page - protected
    COMPONENT = 'component', // .comp - protected
    LOGIC_FLOW = 'flow',     // .flow - protected
    STATE_STORE = 'store',   // .store - semi-editable
    CONFIG = 'config',       // .config - semi-editable
    TOKENS = 'tokens',       // .tokens - semi-editable
    CUSTOM_CSS = 'css',      // .css - free code
    CUSTOM_JS = 'js',        // .js - free code
    HEAD_INJECT = 'inject'   // .inject - free code
}

/**
 * Virtual File representation
 */
export interface VFSFile {
    id: string;
    projectId: string;
    name: string;
    path: string;               // e.g., "/pages/home.page"
    type: FileType;
    protection: ProtectionLevel;
    schema: Record<string, unknown>;  // File-specific data
    isArchived: boolean;
    archivedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Block belongs to exactly one file
 */
export interface VFSBlock {
    id: string;
    fileId: string;             // Owner file (REQUIRED)
    projectId: string;
    type: string;               // Block type (button, section, etc.)
    props: Record<string, unknown>;
    events: BlockEvent[];
    styles: TailwindStyles;     // ALWAYS Tailwind, never raw CSS
    constraints: BlockConstraints;
    order: number;
    parentBlockId?: string;     // For nested blocks
    createdAt: Date;
    updatedAt: Date;
}

export interface BlockEvent {
    trigger: 'click' | 'submit' | 'load' | 'hover' | 'scroll';
    actions: BlockAction[];
}

export interface BlockAction {
    type: 'setState' | 'apiCall' | 'navigate' | 'showHide' | 'custom';
    config: Record<string, unknown>;
}

export interface TailwindStyles {
    base: string[];             // Always-applied classes
    hover?: string[];
    focus?: string[];
    responsive?: {
        sm?: string[];
        md?: string[];
        lg?: string[];
        xl?: string[];
    };
}

export interface BlockConstraints {
    canDelete: boolean;
    canMove: boolean;
    canEdit: boolean;
    lockedProps: string[];      // Props that can't be changed
}

/**
 * Version snapshot for undo/restore
 */
export interface VFSVersion {
    id: string;
    projectId: string;
    label?: string;             // Named version (optional)
    snapshot: {
        files: VFSFile[];
        blocks: VFSBlock[];
    };
    trigger: 'auto' | 'manual' | 'before_risky_operation';
    createdAt: Date;
}

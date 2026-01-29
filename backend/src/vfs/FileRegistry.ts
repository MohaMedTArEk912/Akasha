import { VFSFile, FileType, ProtectionLevel } from './types';

/**
 * File type to protection level mapping
 */
const PROTECTION_MAP: Record<FileType, ProtectionLevel> = {
    [FileType.PAGE]: ProtectionLevel.PROTECTED,
    [FileType.COMPONENT]: ProtectionLevel.PROTECTED,
    [FileType.LOGIC_FLOW]: ProtectionLevel.PROTECTED,
    [FileType.STATE_STORE]: ProtectionLevel.SEMI_EDITABLE,
    [FileType.CONFIG]: ProtectionLevel.SEMI_EDITABLE,
    [FileType.TOKENS]: ProtectionLevel.SEMI_EDITABLE,
    [FileType.CUSTOM_CSS]: ProtectionLevel.FREE_CODE,
    [FileType.CUSTOM_JS]: ProtectionLevel.FREE_CODE,
    [FileType.HEAD_INJECT]: ProtectionLevel.FREE_CODE,
};

/**
 * File type to folder mapping (auto-organization)
 */
const FOLDER_MAP: Record<FileType, string> = {
    [FileType.PAGE]: '/pages',
    [FileType.COMPONENT]: '/components',
    [FileType.LOGIC_FLOW]: '/logic',
    [FileType.STATE_STORE]: '/data',
    [FileType.CONFIG]: '/data',
    [FileType.TOKENS]: '/styles',
    [FileType.CUSTOM_CSS]: '/custom',
    [FileType.CUSTOM_JS]: '/custom',
    [FileType.HEAD_INJECT]: '/custom',
};

/**
 * File type to extension mapping
 */
const EXTENSION_MAP: Record<FileType, string> = {
    [FileType.PAGE]: 'page',
    [FileType.COMPONENT]: 'comp',
    [FileType.LOGIC_FLOW]: 'flow',
    [FileType.STATE_STORE]: 'store',
    [FileType.CONFIG]: 'config',
    [FileType.TOKENS]: 'tokens',
    [FileType.CUSTOM_CSS]: 'css',
    [FileType.CUSTOM_JS]: 'js',
    [FileType.HEAD_INJECT]: 'inject',
};

export interface FileOperationResult {
    success: boolean;
    error?: string;
    file?: VFSFile;
}

/**
 * FileRegistry - Central authority for file permissions and operations
 * 
 * @description This service determines what operations are allowed on files
 * based on their protection level. It is the single source of truth for
 * file permissions.
 */
export class FileRegistry {
    /**
     * Check if file can be deleted
     * @param file - The file to check
     * @returns true only for FREE_CODE files
     */
    static canDelete(file: VFSFile): boolean {
        return file.protection === ProtectionLevel.FREE_CODE;
    }

    /**
     * Check if file can be renamed
     * @param file - The file to check
     * @returns true for SEMI_EDITABLE and FREE_CODE files
     */
    static canRename(file: VFSFile): boolean {
        return file.protection !== ProtectionLevel.PROTECTED;
    }

    /**
     * Check if file can be raw edited (Monaco Editor)
     * @param file - The file to check
     * @returns true only for FREE_CODE files
     */
    static canRawEdit(file: VFSFile): boolean {
        return file.protection === ProtectionLevel.FREE_CODE;
    }

    /**
     * Check if file can be edited via UI panels
     * @param file - The file to check
     * @returns always true - all files can be edited via proper UI
     */
    static canUIEdit(file: VFSFile): boolean {
        return true;
    }

    /**
     * Get protection level for file type
     * @param type - The file type
     * @returns The protection level for that type
     */
    static getProtection(type: FileType): ProtectionLevel {
        return PROTECTION_MAP[type];
    }

    /**
     * Get auto-organized folder for file type
     * @param type - The file type
     * @returns The folder path for that type
     */
    static getFolder(type: FileType): string {
        return FOLDER_MAP[type];
    }

    /**
     * Get file extension for file type
     * @param type - The file type
     * @returns The extension for that type
     */
    static getExtension(type: FileType): string {
        return EXTENSION_MAP[type];
    }

    /**
     * Generate file path based on type and name
     * @param type - The file type
     * @param name - The file name
     * @returns Full path like "/pages/home.page"
     */
    static generatePath(type: FileType, name: string): string {
        const folder = FOLDER_MAP[type];
        const extension = EXTENSION_MAP[type];
        const slug = name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
        return `${folder}/${slug}.${extension}`;
    }

    /**
     * Parse file path to extract components
     * @param path - The file path
     * @returns Object with folder, name, and extension
     */
    static parsePath(path: string): { folder: string; name: string; extension: string } {
        const parts = path.split('/');
        const filename = parts.pop() || '';
        const folder = '/' + parts.filter(Boolean).join('/');
        const [name, extension] = filename.includes('.')
            ? [filename.substring(0, filename.lastIndexOf('.')), filename.substring(filename.lastIndexOf('.') + 1)]
            : [filename, ''];
        return { folder, name, extension };
    }

    /**
     * Get FileType from extension
     * @param extension - The file extension
     * @returns The FileType or null if unknown
     */
    static getTypeFromExtension(extension: string): FileType | null {
        for (const [type, ext] of Object.entries(EXTENSION_MAP)) {
            if (ext === extension) {
                return type as FileType;
            }
        }
        return null;
    }

    /**
     * Validate file operation
     * @param file - The file to validate
     * @param operation - The operation to validate
     * @returns Result with success status and error message if failed
     */
    static validateOperation(
        file: VFSFile,
        operation: 'delete' | 'rename' | 'rawEdit' | 'uiEdit' | 'move' | 'archive'
    ): FileOperationResult {
        switch (operation) {
            case 'delete':
                if (!this.canDelete(file)) {
                    return {
                        success: false,
                        error: `Cannot delete ${file.type} files. They are managed by the editor. Use archive instead.`
                    };
                }
                break;

            case 'rename':
                if (!this.canRename(file)) {
                    return {
                        success: false,
                        error: `Cannot rename protected ${file.type} files. They are managed by the editor.`
                    };
                }
                break;

            case 'rawEdit':
                if (!this.canRawEdit(file)) {
                    return {
                        success: false,
                        error: `Cannot raw edit ${file.type} files. Use the visual editor instead.`
                    };
                }
                break;

            case 'move':
                if (file.protection === ProtectionLevel.PROTECTED) {
                    return {
                        success: false,
                        error: `Cannot move protected ${file.type} files. They are auto-organized.`
                    };
                }
                break;

            case 'archive':
                // Archive is always allowed as a safe alternative to delete
                break;

            case 'uiEdit':
                // UI edit is always allowed
                break;
        }

        return { success: true, file };
    }

    /**
     * Get all allowed operations for a file
     * @param file - The file to check
     * @returns Object with boolean flags for each operation
     */
    static getAllowedOperations(file: VFSFile): Record<string, boolean> {
        return {
            delete: this.canDelete(file),
            rename: this.canRename(file),
            rawEdit: this.canRawEdit(file),
            uiEdit: this.canUIEdit(file),
            move: file.protection !== ProtectionLevel.PROTECTED,
            archive: true, // Always allowed
            duplicate: true, // Always allowed
            export: true, // Always allowed
        };
    }

    /**
     * Create a new VFSFile with proper defaults
     * @param projectId - The project ID
     * @param name - The file name
     * @param type - The file type
     * @param schema - Optional initial schema data
     * @returns A new VFSFile object (not saved to DB)
     */
    static createFile(
        projectId: string,
        name: string,
        type: FileType,
        schema: Record<string, unknown> = {}
    ): Omit<VFSFile, 'id' | 'createdAt' | 'updatedAt'> {
        return {
            projectId,
            name,
            path: this.generatePath(type, name),
            type,
            protection: this.getProtection(type),
            schema,
            isArchived: false,
        };
    }
}

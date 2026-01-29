import mongoose, { Document, Schema } from 'mongoose';

/**
 * Protection levels enum values
 */
export const ProtectionLevelValues = ['protected', 'semi_editable', 'free_code'] as const;

/**
 * File type enum values
 */
export const FileTypeValues = [
    'page', 'component', 'flow', 'store', 'config', 'tokens', 'css', 'js', 'inject'
] as const;

export interface IVFSFile extends Document {
    projectId: mongoose.Types.ObjectId;
    name: string;
    path: string;
    type: typeof FileTypeValues[number];
    protection: typeof ProtectionLevelValues[number];
    dataSchema: Record<string, unknown>;
    isArchived: boolean;
    archivedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const VFSFileSchema = new Schema<IVFSFile>(
    {
        projectId: {
            type: Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255
        },
        path: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1024
        },
        type: {
            type: String,
            enum: FileTypeValues,
            required: true,
            index: true
        },
        protection: {
            type: String,
            enum: ProtectionLevelValues,
            required: true
        },
        schema: {
            type: Schema.Types.Mixed,
            default: {},
            alias: 'dataSchema'
        },
        isArchived: {
            type: Boolean,
            default: false,
            index: true
        },
        archivedAt: {
            type: Date
        }
    } as any,
    {
        timestamps: true,
        collection: 'vfs_files'
    }
);

// Unique path per project (only non-archived files)
VFSFileSchema.index(
    { projectId: 1, path: 1 },
    {
        unique: true,
        partialFilterExpression: { isArchived: false }
    }
);

// Fast lookup by type within project
VFSFileSchema.index({ projectId: 1, type: 1 });

// Fast lookup for non-archived files
VFSFileSchema.index({ projectId: 1, isArchived: 1 });

// Archive management - auto-set archivedAt
VFSFileSchema.pre('save', function (this: IVFSFile, next: any) {
    if (this.isModified('isArchived') && this.isArchived && !this.archivedAt) {
        this.archivedAt = new Date();
    }
    next();
});

export default mongoose.model<IVFSFile>('VFSFile', VFSFileSchema);

import mongoose, { Document, Schema } from 'mongoose';

/**
 * Version trigger types
 */
export const VersionTriggerValues = ['auto', 'manual', 'before_risky_operation'] as const;

export interface IVFSVersion extends Document {
    projectId: mongoose.Types.ObjectId;
    label?: string;
    snapshot: {
        files: Record<string, unknown>[];
        blocks: Record<string, unknown>[];
    };
    trigger: typeof VersionTriggerValues[number];
    metadata?: {
        operation?: string;
        userId?: string;
        description?: string;
    };
    createdAt: Date;
}

const VFSVersionSchema = new Schema<IVFSVersion>(
    {
        projectId: {
            type: Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
            index: true
        },
        label: {
            type: String,
            trim: true,
            maxlength: 255
        },
        snapshot: {
            files: {
                type: [Schema.Types.Mixed],
                required: true
            },
            blocks: {
                type: [Schema.Types.Mixed],
                required: true
            }
        },
        trigger: {
            type: String,
            enum: VersionTriggerValues,
            default: 'auto',
            index: true
        },
        metadata: {
            operation: String,
            userId: String,
            description: String
        }
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        collection: 'vfs_versions'
    }
);

// Index for fetching recent versions
VFSVersionSchema.index({ projectId: 1, createdAt: -1 });

// Index for finding named versions
VFSVersionSchema.index(
    { projectId: 1, label: 1 },
    { partialFilterExpression: { label: { $exists: true, $ne: null } } }
);

// Static method to cleanup old versions (keep last 50 per project)
VFSVersionSchema.statics.cleanupOldVersions = async function (projectId: string, keepCount = 50) {
    const versions = await this.find({ projectId })
        .sort({ createdAt: -1 })
        .skip(keepCount)
        .select('_id');

    if (versions.length > 0) {
        const idsToDelete = versions.map((v: any) => v._id);
        await this.deleteMany({ _id: { $in: idsToDelete } });
    }

    return versions.length;
};

// Static method to create snapshot
VFSVersionSchema.statics.createSnapshot = async function (
    projectId: string,
    files: any[],
    blocks: any[],
    trigger: typeof VersionTriggerValues[number] = 'auto',
    label?: string,
    metadata?: Record<string, string>
) {
    const version = await this.create({
        projectId,
        label,
        snapshot: { files, blocks },
        trigger,
        metadata
    });

    // Auto-cleanup after creating new version
    await this.cleanupOldVersions(projectId);

    return version;
};

export default mongoose.model<IVFSVersion>('VFSVersion', VFSVersionSchema);

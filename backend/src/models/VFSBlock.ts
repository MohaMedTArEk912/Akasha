import mongoose, { Document, Schema } from 'mongoose';

export interface IBlockEvent {
    trigger: 'click' | 'submit' | 'load' | 'hover' | 'scroll';
    actions: Array<{
        type: 'setState' | 'apiCall' | 'navigate' | 'showHide' | 'custom';
        config: Record<string, unknown>;
    }>;
}

export interface ITailwindStyles {
    base: string[];
    hover?: string[];
    focus?: string[];
    responsive?: {
        sm?: string[];
        md?: string[];
        lg?: string[];
        xl?: string[];
    };
}

export interface IBlockConstraints {
    canDelete: boolean;
    canMove: boolean;
    canEdit: boolean;
    lockedProps: string[];
}

export interface IVFSBlock extends Document {
    fileId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    type: string;
    props: Record<string, unknown>;
    events: IBlockEvent[];
    styles: ITailwindStyles;
    constraints: IBlockConstraints;
    order: number;
    parentBlockId?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const BlockEventSchema = new Schema({
    trigger: {
        type: String,
        enum: ['click', 'submit', 'load', 'hover', 'scroll'],
        required: true
    },
    actions: [{
        type: {
            type: String,
            enum: ['setState', 'apiCall', 'navigate', 'showHide', 'custom'],
            required: true
        },
        config: {
            type: Schema.Types.Mixed,
            default: {}
        }
    }]
}, { _id: false });

const TailwindStylesSchema = new Schema({
    base: {
        type: [String],
        default: []
    },
    hover: {
        type: [String],
        default: undefined
    },
    focus: {
        type: [String],
        default: undefined
    },
    responsive: {
        sm: [String],
        md: [String],
        lg: [String],
        xl: [String]
    }
}, { _id: false });

const BlockConstraintsSchema = new Schema({
    canDelete: {
        type: Boolean,
        default: true
    },
    canMove: {
        type: Boolean,
        default: true
    },
    canEdit: {
        type: Boolean,
        default: true
    },
    lockedProps: {
        type: [String],
        default: []
    }
}, { _id: false });

const VFSBlockSchema = new Schema<IVFSBlock>(
    {
        fileId: {
            type: Schema.Types.ObjectId,
            ref: 'VFSFile',
            required: [true, 'Block must belong to a file'],
            index: true
        },
        projectId: {
            type: Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
            index: true
        },
        type: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },
        props: {
            type: Schema.Types.Mixed,
            default: {}
        },
        events: {
            type: [BlockEventSchema],
            default: []
        },
        styles: {
            type: TailwindStylesSchema,
            default: () => ({ base: [] })
        },
        constraints: {
            type: BlockConstraintsSchema,
            default: () => ({ canDelete: true, canMove: true, canEdit: true, lockedProps: [] })
        },
        order: {
            type: Number,
            default: 0,
            index: true
        },
        parentBlockId: {
            type: Schema.Types.ObjectId,
            ref: 'VFSBlock',
            default: undefined,
            index: true
        }
    },
    {
        timestamps: true,
        collection: 'vfs_blocks'
    }
);

// CRITICAL: Ensure file exists before saving block
// CRITICAL: Ensure file exists before saving block
VFSBlockSchema.pre('save', async function () {
    if (this.isNew || this.isModified('fileId')) {
        const VFSFile = mongoose.model('VFSFile');
        // @ts-ignore - Mongoose typing issue
        const file = await VFSFile.findById(this.fileId);
        if (!file) {
            throw new Error(`CRITICAL: Cannot save block - owner file ${this.fileId} does not exist`);
        }
        if (file.isArchived) {
            throw new Error(`Cannot add block to archived file ${this.fileId}`);
        }
    }
});

// Fast lookup for file's blocks ordered
VFSBlockSchema.index({ fileId: 1, order: 1 });

// Fast lookup for nested blocks
VFSBlockSchema.index({ parentBlockId: 1, order: 1 });

// Project-wide block lookup
VFSBlockSchema.index({ projectId: 1, type: 1 });

export default mongoose.model<IVFSBlock>('VFSBlock', VFSBlockSchema);

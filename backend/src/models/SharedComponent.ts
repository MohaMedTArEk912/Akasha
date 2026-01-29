import mongoose, { Document, Schema } from 'mongoose';

export interface ISharedComponent extends Document {
    projectId: mongoose.Schema.Types.ObjectId;
    name: string;
    type: 'header' | 'footer' | 'sidebar' | 'custom';
    content: object;
    styles: string;
    usedOnPages: mongoose.Schema.Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

const SharedComponentSchema: Schema = new Schema(
    {
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
            index: true
        },
        name: { type: String, required: true, trim: true },
        type: {
            type: String,
            enum: ['header', 'footer', 'sidebar', 'custom'],
            required: true
        },
        content: { type: Object, default: {} },
        styles: { type: String, default: '' },
        usedOnPages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Page' }],
    },
    { timestamps: true }
);

// Unique type per project (only one header, one footer, etc.)
SharedComponentSchema.index({ projectId: 1, type: 1 }, { unique: true, sparse: true });

export default mongoose.model<ISharedComponent>('SharedComponent', SharedComponentSchema);

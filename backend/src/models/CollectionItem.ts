import mongoose, { Document, Schema } from 'mongoose';

export interface ICollectionItem extends Document {
    collectionId: mongoose.Schema.Types.ObjectId;
    data: Record<string, any>;
    status: 'draft' | 'published';
    createdAt: Date;
    updatedAt: Date;
}

const CollectionItemSchema: Schema = new Schema(
    {
        collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', required: true },
        data: { type: Object, required: true },
        status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    },
    { timestamps: true }
);

// Index for efficient querying
CollectionItemSchema.index({ collectionId: 1, status: 1, createdAt: -1 });

export default mongoose.model<ICollectionItem>('CollectionItem', CollectionItemSchema);

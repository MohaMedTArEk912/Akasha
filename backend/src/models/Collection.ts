import mongoose, { Document, Schema } from 'mongoose';

export interface FieldDefinition {
    name: string;
    type: 'text' | 'richtext' | 'number' | 'boolean' | 'date' | 'image' | 'reference';
    required?: boolean;
    defaultValue?: any;
}

export interface ICollection extends Document {
    name: string;
    slug: string;
    description?: string;
    fields: FieldDefinition[];
    owner: mongoose.Schema.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const FieldSchema = new Schema({
    name: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['text', 'richtext', 'number', 'boolean', 'date', 'image', 'reference']
    },
    required: { type: Boolean, default: false },
    defaultValue: { type: Schema.Types.Mixed },
});

const CollectionSchema: Schema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true },
        description: { type: String },
        fields: [FieldSchema],
        owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
);

// Unique slug per owner
CollectionSchema.index({ slug: 1, owner: 1 }, { unique: true });

export default mongoose.model<ICollection>('Collection', CollectionSchema);

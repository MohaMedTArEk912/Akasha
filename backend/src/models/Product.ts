import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
    projectId: mongoose.Schema.Types.ObjectId;
    name: string;
    description?: string;
    price: number;
    currency: string;
    image?: string;
    status: 'draft' | 'active';
    createdAt: Date;
    updatedAt: Date;
}

const ProductSchema: Schema = new Schema(
    {
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
            index: true
        },
        name: { type: String, required: true, trim: true },
        description: { type: String },
        price: { type: Number, required: true, min: 0 },
        currency: { type: String, default: 'USD' },
        image: { type: String },
        status: { type: String, enum: ['draft', 'active'], default: 'draft' },
    },
    { timestamps: true }
);

ProductSchema.index({ projectId: 1, name: 1 });

export default mongoose.model<IProduct>('Product', ProductSchema);
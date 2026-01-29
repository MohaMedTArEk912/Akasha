import mongoose, { Document, Schema } from 'mongoose';

export interface ISymbol extends Document {
    name: string;
    description?: string;
    content: object;  // GrapesJS component JSON
    styles: string;   // Associated CSS
    thumbnail?: string; // Base64 or URL for preview
    owner: mongoose.Schema.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const SymbolSchema: Schema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String },
        content: { type: Object, required: true },
        styles: { type: String, default: '' },
        thumbnail: { type: String },
        owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
);

// Index for faster queries
SymbolSchema.index({ owner: 1, name: 1 });

export default mongoose.model<ISymbol>('Symbol', SymbolSchema);

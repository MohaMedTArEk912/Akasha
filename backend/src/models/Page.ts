import mongoose, { Document, Schema } from 'mongoose';

export interface IPage extends Document {
    projectId: mongoose.Schema.Types.ObjectId;
    name: string;
    slug: string;
    content: object;
    styles: string;
    isHome: boolean;
    order: number;
    meta: {
        title?: string;
        description?: string;
        ogImage?: string;
        keywords?: string;
    };
    transition?: {
        type: 'none' | 'fade' | 'slide' | 'zoom';
        duration: number;
    };
    createdAt: Date;
    updatedAt: Date;
}

const PageSchema: Schema = new Schema(
    {
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
            index: true
        },
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true },
        content: { type: Object, default: {} },
        styles: { type: String, default: '' },
        isHome: { type: Boolean, default: false },
        order: { type: Number, default: 0 },
        meta: {
            title: { type: String },
            description: { type: String },
            ogImage: { type: String },
            keywords: { type: String },
        },
        transition: {
            type: { type: String, enum: ['none', 'fade', 'slide', 'zoom'], default: 'none' },
            duration: { type: Number, default: 300 },
        },
    },
    { timestamps: true }
);

// Unique slug per project
PageSchema.index({ projectId: 1, slug: 1 }, { unique: true });

// Ensure only one home page per project
PageSchema.pre('save', async function () {
    if (this.isHome) {
        // @ts-ignore - Mongoose 9 typing issue  
        await mongoose.model('Page').updateMany(
            { projectId: this.projectId, _id: { $ne: this._id } },
            { isHome: false }
        );
    }
});

export default mongoose.model<IPage>('Page', PageSchema);

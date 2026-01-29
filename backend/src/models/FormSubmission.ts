import mongoose, { Document, Schema } from 'mongoose';

export interface IFormSubmission extends Document {
    projectId: mongoose.Schema.Types.ObjectId;
    formName: string;
    data: Record<string, any>;
    metadata: {
        userAgent?: string;
        ip?: string;
        referrer?: string;
    };
    createdAt: Date;
}

const FormSubmissionSchema: Schema = new Schema(
    {
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
        formName: { type: String, required: true },
        data: { type: Object, required: true },
        metadata: {
            userAgent: { type: String },
            ip: { type: String },
            referrer: { type: String },
        },
    },
    { timestamps: true }
);

// Index for efficient querying
FormSubmissionSchema.index({ projectId: 1, createdAt: -1 });

export default mongoose.model<IFormSubmission>('FormSubmission', FormSubmissionSchema);

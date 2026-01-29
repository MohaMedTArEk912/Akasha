import mongoose, { Document, Schema } from 'mongoose';

export interface IPublishSchedule extends Document {
    projectId: mongoose.Schema.Types.ObjectId;
    provider: 'vercel' | 'netlify';
    name: string;
    html: string;
    css: string;
    scheduledAt: Date;
    status: 'scheduled' | 'running' | 'completed' | 'failed';
    lastRunAt?: Date;
    resultUrl?: string;
    errorMessage?: string;
    createdAt: Date;
    updatedAt: Date;
}

const PublishScheduleSchema: Schema = new Schema(
    {
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
            index: true
        },
        provider: {
            type: String,
            enum: ['vercel', 'netlify'],
            required: true
        },
        name: { type: String, required: true },
        html: { type: String, default: '' },
        css: { type: String, default: '' },
        scheduledAt: { type: Date, required: true, index: true },
        status: {
            type: String,
            enum: ['scheduled', 'running', 'completed', 'failed'],
            default: 'scheduled',
            index: true
        },
        lastRunAt: { type: Date },
        resultUrl: { type: String },
        errorMessage: { type: String },
    },
    { timestamps: true }
);

PublishScheduleSchema.index({ projectId: 1, scheduledAt: 1 });

export default mongoose.model<IPublishSchedule>('PublishSchedule', PublishScheduleSchema);
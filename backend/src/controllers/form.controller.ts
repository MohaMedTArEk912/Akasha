import { Request, Response } from 'express';
import mongoose from 'mongoose';
import FormSubmission from '../models/FormSubmission';
import Project from '../models/Project';

// @desc    Submit a form (Public endpoint for published sites)
// @route   POST /api/forms/:projectId/submit
// @access  Public
export const submitForm = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { formName, data } = req.body;

        // Validate project exists
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const submission = new FormSubmission({
            projectId,
            formName: formName || 'default',
            data,
            metadata: {
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                referrer: req.get('Referrer'),
            },
        });

        await submission.save();
        res.status(201).json({ message: 'Form submitted successfully', id: submission._id });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all form submissions for a project
// @route   GET /api/forms/:projectId/submissions
// @access  Private
export const getFormSubmissions = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        // Verify project ownership
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        // @ts-ignore
        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // @ts-ignore - Mongoose 9 typing issue
        const submissions = await FormSubmission.find({ projectId: new mongoose.Types.ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .limit(100);

        res.json(submissions);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get form submission stats for a project
// @route   GET /api/forms/:projectId/stats
// @access  Private
export const getFormStats = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;

        // Verify project ownership
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        // @ts-ignore
        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const stats = await FormSubmission.aggregate([
            { $match: { projectId: project._id } },
            {
                $group: {
                    _id: '$formName',
                    count: { $sum: 1 },
                    lastSubmission: { $max: '$createdAt' },
                },
            },
        ]);

        // @ts-ignore - Mongoose 9 typing issue
        const totalCount = await FormSubmission.countDocuments({ projectId: new mongoose.Types.ObjectId(projectId) });

        res.json({ total: totalCount, byForm: stats });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a form submission
// @route   DELETE /api/forms/submissions/:id
// @access  Private
export const deleteSubmission = async (req: Request, res: Response) => {
    try {
        const submission = await FormSubmission.findById(req.params.id).populate('projectId');

        if (!submission) {
            return res.status(404).json({ message: 'Submission not found' });
        }

        // Verify project ownership
        const project = await Project.findById(submission.projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        // @ts-ignore
        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        await submission.deleteOne();
        res.json({ message: 'Submission deleted' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

import { Request, Response } from 'express';
import SharedComponent from '../models/SharedComponent';
import Project from '../models/Project';

/**
 * @desc    Get all shared components for a project
 * @route   GET /api/shared/:projectId
 * @access  Private
 */
export const getSharedComponents = async (req: Request, res: Response) => {
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
        const components = await SharedComponent.find({ projectId });
        res.json(components);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get shared component by type
 * @route   GET /api/shared/:projectId/:type
 * @access  Private
 */
export const getSharedComponentByType = async (req: Request, res: Response) => {
    try {
        const { projectId, type } = req.params;

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
        const component = await SharedComponent.findOne({ projectId, type });
        if (!component) {
            return res.status(404).json({ message: 'Shared component not found' });
        }

        res.json(component);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Create or update a shared component
 * @route   POST /api/shared/:projectId
 * @access  Private
 */
export const upsertSharedComponent = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { name, type, content, styles, usedOnPages } = req.body;

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
        const component = await SharedComponent.findOneAndUpdate(
            { projectId, type } as any,
            {
                name: name || type.charAt(0).toUpperCase() + type.slice(1),
                type,
                content: content || {},
                styles: styles || '',
                usedOnPages: usedOnPages || [],
            },
            { new: true, upsert: true }
        );

        res.json(component);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * @desc    Delete a shared component
 * @route   DELETE /api/shared/:projectId/:type
 * @access  Private
 */
export const deleteSharedComponent = async (req: Request, res: Response) => {
    try {
        const { projectId, type } = req.params;

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
        const component = await SharedComponent.findOneAndDelete({ projectId, type });
        if (!component) {
            return res.status(404).json({ message: 'Shared component not found' });
        }

        res.json({ message: 'Shared component deleted' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

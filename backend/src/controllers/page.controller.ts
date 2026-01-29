import { Request, Response } from 'express';
import Page from '../models/Page';
import Project from '../models/Project';
import VFSFileModel from '../models/VFSFile';
import { FileRegistry } from '../vfs';
import { FileType } from '../vfs/types';

// ========== PAGE CRUD ==========

const upsertPageFile = async (projectId: string, page: any) => {
    // @ts-ignore - Mongoose typing
    const existing = await VFSFileModel.findOne({ projectId, 'schema.pageId': page._id });

    const schema = {
        pageId: page._id.toString(),
        slug: page.slug,
        isHome: page.isHome,
    };

    if (existing) {
        existing.name = page.name;
        existing.path = FileRegistry.generatePath(FileType.PAGE, page.name);
        // @ts-ignore - alias for schema
        existing.dataSchema = { ...existing.dataSchema, ...schema };
        await existing.save();
        return existing;
    }

    const fileData = FileRegistry.createFile(projectId, page.name, FileType.PAGE, schema);
    const created = await VFSFileModel.create({
        ...fileData,
        projectId,
    });
    return created;
};

/**
 * @desc    Get all pages for a project
 * @route   GET /api/pages/:projectId
 * @access  Private
 */
export const getPages = async (req: Request, res: Response) => {
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
        const pages = await Page.find({ projectId }).sort({ order: 1 });
        res.json(pages);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get single page
 * @route   GET /api/pages/:projectId/:pageId
 * @access  Private
 */
export const getPage = async (req: Request, res: Response) => {
    try {
        const { projectId, pageId } = req.params;

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
        const page = await Page.findOne({ _id: pageId, projectId });
        if (!page) {
            return res.status(404).json({ message: 'Page not found' });
        }

        res.json(page);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Create a new page
 * @route   POST /api/pages/:projectId
 * @access  Private
 */
export const createPage = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { name, slug, content, styles, isHome, meta, transition } = req.body;

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
        const maxOrder = await Page.findOne({ projectId }).sort({ order: -1 });
        const newOrder = maxOrder ? maxOrder.order + 1 : 0;

        // Generate slug if not provided
        const pageSlug = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const page = new Page({
            projectId,
            name,
            slug: pageSlug,
            content: content || {},
            styles: styles || '',
            isHome: isHome || false,
            order: newOrder,
            meta: meta || {},
            transition: transition || { type: 'none', duration: 300 },
        });

        const created = await page.save();
        await upsertPageFile(projectId, created);
        res.status(201).json(created);
    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Page with this slug already exists' });
        }
        res.status(400).json({ message: error.message });
    }
};

/**
 * @desc    Update a page
 * @route   PUT /api/pages/:projectId/:pageId
 * @access  Private
 */
export const updatePage = async (req: Request, res: Response) => {
    try {
        const { projectId, pageId } = req.params;
        const { name, slug, content, styles, isHome, meta, transition, order } = req.body;

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
        const page = await Page.findOne({ _id: pageId, projectId });
        if (!page) {
            return res.status(404).json({ message: 'Page not found' });
        }

        // Update fields
        if (name !== undefined) page.name = name;
        if (slug !== undefined) page.slug = slug;
        if (content !== undefined) page.content = content;
        if (styles !== undefined) page.styles = styles;
        if (isHome !== undefined) page.isHome = isHome;
        if (meta !== undefined) page.meta = { ...page.meta, ...meta };
        if (transition !== undefined) page.transition = { ...page.transition, ...transition };
        if (order !== undefined) page.order = order;

        const updated = await page.save();
        await upsertPageFile(projectId, updated);
        res.json(updated);
    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Page with this slug already exists' });
        }
        res.status(400).json({ message: error.message });
    }
};

/**
 * @desc    Delete a page
 * @route   DELETE /api/pages/:projectId/:pageId
 * @access  Private
 */
export const deletePage = async (req: Request, res: Response) => {
    try {
        const { projectId, pageId } = req.params;

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
        const page = await Page.findOne({ _id: pageId, projectId });
        if (!page) {
            return res.status(404).json({ message: 'Page not found' });
        }

        // @ts-ignore - Mongoose 9 typing issue
        const pageCount = await Page.countDocuments({ projectId });
        if (pageCount <= 1) {
            return res.status(400).json({ message: 'Cannot delete the only page' });
        }

        // Archive VFS file (safe delete)
        // @ts-ignore - Mongoose typing
        const vfsFile = await VFSFileModel.findOne({ projectId, 'schema.pageId': pageId });
        if (vfsFile && !vfsFile.isArchived) {
            vfsFile.isArchived = true;
            await vfsFile.save();
        }

        await page.deleteOne();
        res.json({ message: 'Page deleted' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Duplicate a page
 * @route   POST /api/pages/:projectId/:pageId/duplicate
 * @access  Private
 */
export const duplicatePage = async (req: Request, res: Response) => {
    try {
        const { projectId, pageId } = req.params;

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
        const sourcePage = await Page.findOne({ _id: pageId, projectId });
        if (!sourcePage) {
            return res.status(404).json({ message: 'Page not found' });
        }

        // @ts-ignore - Mongoose 9 typing issue
        const maxOrder = await Page.findOne({ projectId }).sort({ order: -1 });
        const newOrder = maxOrder ? maxOrder.order + 1 : 0;

        // Generate unique slug
        let newSlug = `${sourcePage.slug}-copy`;
        let counter = 1;
        // @ts-ignore - Mongoose 9 typing issue
        while (await Page.findOne({ projectId, slug: newSlug })) {
            newSlug = `${sourcePage.slug}-copy-${counter}`;
            counter++;
        }

        const duplicatedPage = new Page({
            projectId,
            name: `${sourcePage.name} (Copy)`,
            slug: newSlug,
            content: sourcePage.content,
            styles: sourcePage.styles,
            isHome: false,
            order: newOrder,
            meta: sourcePage.meta,
            transition: sourcePage.transition,
        });

        const created = await duplicatedPage.save();
        await upsertPageFile(projectId, created);
        res.status(201).json(created);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Reorder pages
 * @route   PUT /api/pages/:projectId/reorder
 * @access  Private
 */
export const reorderPages = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { pageOrder } = req.body;

        // Verify project ownership
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        // @ts-ignore
        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Update each page's order
        const updates = pageOrder.map((item: { id: string; order: number }) => {
            // @ts-ignore - Mongoose 9 typing issue
            return Page.updateOne(
                { _id: item.id, projectId },
                { order: item.order }
            );
        });

        await Promise.all(updates);

        // @ts-ignore - Mongoose 9 typing issue
        const pages = await Page.find({ projectId }).sort({ order: 1 });
        res.json(pages);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

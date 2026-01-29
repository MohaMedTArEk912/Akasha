import { Request, Response } from 'express';
import Product from '../models/Product';
import Project from '../models/Project';

/**
 * @desc    Get products for project
 * @route   GET /api/products/:projectId
 * @access  Private
 */
export const getProducts = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        // @ts-ignore
        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // @ts-ignore
        const products = await Product.find({ projectId }).sort({ updatedAt: -1 });
        res.json(products);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Create product
 * @route   POST /api/products/:projectId
 * @access  Private
 */
export const createProduct = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const { name, description, price, currency, image, status } = req.body;

        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        // @ts-ignore
        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const product = new Product({
            projectId,
            name,
            description,
            price,
            currency,
            image,
            status,
        });

        const created = await product.save();
        res.status(201).json(created);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * @desc    Update product
 * @route   PUT /api/products/:projectId/:productId
 * @access  Private
 */
export const updateProduct = async (req: Request, res: Response) => {
    try {
        const { projectId, productId } = req.params;
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        // @ts-ignore
        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // @ts-ignore
        const product = await Product.findOne({ _id: productId, projectId });
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const { name, description, price, currency, image, status } = req.body;
        if (name !== undefined) product.name = name;
        if (description !== undefined) product.description = description;
        if (price !== undefined) product.price = price;
        if (currency !== undefined) product.currency = currency;
        if (image !== undefined) product.image = image;
        if (status !== undefined) product.status = status;

        const updated = await product.save();
        res.json(updated);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * @desc    Delete product
 * @route   DELETE /api/products/:projectId/:productId
 * @access  Private
 */
export const deleteProduct = async (req: Request, res: Response) => {
    try {
        const { projectId, productId } = req.params;
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        // @ts-ignore
        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // @ts-ignore
        const product = await Product.findOne({ _id: productId, projectId });
        if (!product) return res.status(404).json({ message: 'Product not found' });

        await product.deleteOne();
        res.json({ message: 'Product removed' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
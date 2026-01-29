import { Request, Response } from 'express';
import Collection from '../models/Collection';
import CollectionItem from '../models/CollectionItem';

// ========== COLLECTION CRUD ==========

// @desc    Get all collections for current user
// @route   GET /api/cms/collections
// @access  Private
export const getCollections = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const collections = await Collection.find({ owner: req.user._id }).sort({ updatedAt: -1 });
        res.json(collections);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single collection
// @route   GET /api/cms/collections/:id
// @access  Private
export const getCollection = async (req: Request, res: Response) => {
    try {
        const collection = await Collection.findById(req.params.id);
        if (collection) {
            // @ts-ignore
            if (collection.owner.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }
            res.json(collection);
        } else {
            res.status(404).json({ message: 'Collection not found' });
        }
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a collection
// @route   POST /api/cms/collections
// @access  Private
export const createCollection = async (req: Request, res: Response) => {
    try {
        const { name, description, fields } = req.body;
        const slug = name.toLowerCase().replace(/\s+/g, '-');

        const collection = new Collection({
            name,
            slug,
            description,
            fields: fields || [],
            // @ts-ignore
            owner: req.user._id,
        });

        const created = await collection.save();
        res.status(201).json(created);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update a collection
// @route   PUT /api/cms/collections/:id
// @access  Private
export const updateCollection = async (req: Request, res: Response) => {
    try {
        const { name, description, fields } = req.body;
        const collection = await Collection.findById(req.params.id);

        if (collection) {
            // @ts-ignore
            if (collection.owner.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }

            collection.name = name || collection.name;
            collection.description = description !== undefined ? description : collection.description;
            collection.fields = fields || collection.fields;

            const updated = await collection.save();
            res.json(updated);
        } else {
            res.status(404).json({ message: 'Collection not found' });
        }
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a collection
// @route   DELETE /api/cms/collections/:id
// @access  Private
export const deleteCollection = async (req: Request, res: Response) => {
    try {
        const collection = await Collection.findById(req.params.id);

        if (collection) {
            // @ts-ignore
            if (collection.owner.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }

            // Delete all items in the collection
            // @ts-ignore - Mongoose 9 typing issue
            await CollectionItem.deleteMany({ collectionId: collection._id });
            await collection.deleteOne();
            res.json({ message: 'Collection and all items removed' });
        } else {
            res.status(404).json({ message: 'Collection not found' });
        }
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// ========== COLLECTION ITEMS CRUD ==========

// @desc    Get all items in a collection
// @route   GET /api/cms/collections/:collectionId/items
// @access  Private
export const getCollectionItems = async (req: Request, res: Response) => {
    try {
        const collection = await Collection.findById(req.params.collectionId);
        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }
        // @ts-ignore
        if (collection.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // @ts-ignore - Mongoose 9 typing issue
        const items = await CollectionItem.find({ collectionId: collection._id })
            .sort({ createdAt: -1 });

        res.json(items);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a collection item
// @route   POST /api/cms/collections/:collectionId/items
// @access  Private
export const createCollectionItem = async (req: Request, res: Response) => {
    try {
        const collection = await Collection.findById(req.params.collectionId);
        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }
        // @ts-ignore
        if (collection.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const { data, status } = req.body;

        const item = new CollectionItem({
            collectionId: collection._id,
            data,
            status: status || 'draft',
        });

        const created = await item.save();
        res.status(201).json(created);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update a collection item
// @route   PUT /api/cms/items/:id
// @access  Private
export const updateCollectionItem = async (req: Request, res: Response) => {
    try {
        const item = await CollectionItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const collection = await Collection.findById(item.collectionId);
        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }
        // @ts-ignore
        if (collection.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const { data, status } = req.body;
        item.data = data || item.data;
        item.status = status || item.status;

        const updated = await item.save();
        res.json(updated);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a collection item
// @route   DELETE /api/cms/items/:id
// @access  Private
export const deleteCollectionItem = async (req: Request, res: Response) => {
    try {
        const item = await CollectionItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const collection = await Collection.findById(item.collectionId);
        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }
        // @ts-ignore
        if (collection.owner.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        await item.deleteOne();
        res.json({ message: 'Item removed' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

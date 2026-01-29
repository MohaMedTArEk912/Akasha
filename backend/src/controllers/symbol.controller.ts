import { Request, Response } from 'express';
import Symbol from '../models/Symbol';

// @desc    Get all symbols for current user
// @route   GET /api/symbols
// @access  Private
export const getSymbols = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const symbols = await Symbol.find({ owner: req.user._id }).sort({ updatedAt: -1 });
        res.json(symbols);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single symbol
// @route   GET /api/symbols/:id
// @access  Private
export const getSymbol = async (req: Request, res: Response) => {
    try {
        const symbol = await Symbol.findById(req.params.id);

        if (symbol) {
            // @ts-ignore
            if (symbol.owner.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }
            res.json(symbol);
        } else {
            res.status(404).json({ message: 'Symbol not found' });
        }
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a symbol
// @route   POST /api/symbols
// @access  Private
export const createSymbol = async (req: Request, res: Response) => {
    try {
        const { name, description, content, styles, thumbnail } = req.body;

        const symbol = new Symbol({
            name,
            description,
            content,
            styles,
            thumbnail,
            // @ts-ignore
            owner: req.user._id,
        });

        const createdSymbol = await symbol.save();
        res.status(201).json(createdSymbol);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update a symbol
// @route   PUT /api/symbols/:id
// @access  Private
export const updateSymbol = async (req: Request, res: Response) => {
    try {
        const { name, description, content, styles, thumbnail } = req.body;
        const symbol = await Symbol.findById(req.params.id);

        if (symbol) {
            // @ts-ignore
            if (symbol.owner.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }

            symbol.name = name || symbol.name;
            symbol.description = description !== undefined ? description : symbol.description;
            symbol.content = content || symbol.content;
            symbol.styles = styles !== undefined ? styles : symbol.styles;
            symbol.thumbnail = thumbnail !== undefined ? thumbnail : symbol.thumbnail;

            const updatedSymbol = await symbol.save();
            res.json(updatedSymbol);
        } else {
            res.status(404).json({ message: 'Symbol not found' });
        }
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a symbol
// @route   DELETE /api/symbols/:id
// @access  Private
export const deleteSymbol = async (req: Request, res: Response) => {
    try {
        const symbol = await Symbol.findById(req.params.id);

        if (symbol) {
            // @ts-ignore
            if (symbol.owner.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }

            await symbol.deleteOne();
            res.json({ message: 'Symbol removed' });
        } else {
            res.status(404).json({ message: 'Symbol not found' });
        }
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

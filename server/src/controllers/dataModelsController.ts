import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';

export async function listDataModels(req: Request, res: Response) {
    try {
        const { projectId } = req.query;
        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'Project ID required' });
            return;
        }

        const models = await prisma.dataModel.findMany({
            where: { projectId, archived: false },
            orderBy: { name: 'asc' }
        });

        const hydrated = models.map(m => {
            const schema = safeJsonParse(m.schema, { fields: [], relations: [] }) as any;
            return {
                id: m.id, name: m.name,
                fields: schema.fields || [], relations: schema.relations || [],
                timestamps: true, soft_delete: false, archived: m.archived
            };
        });

        res.json(hydrated);
    } catch (error) {
        console.error('Error listing data models:', error);
        res.status(500).json({ error: 'Failed to list data models' });
    }
}

export async function createDataModel(req: Request, res: Response) {
    try {
        const { projectId, name } = req.body;
        const schema = {
            fields: [{ id: 'id', name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true }],
            relations: []
        };

        const model = await prisma.dataModel.create({
            data: { projectId, name, schema: JSON.stringify(schema) }
        });

        res.json({
            id: model.id, name: model.name,
            fields: schema.fields, relations: schema.relations,
            timestamps: true, soft_delete: false, archived: false
        });
    } catch (error) {
        console.error('Error creating data model:', error);
        res.status(500).json({ error: 'Failed to create data model' });
    }
}

export async function updateDataModel(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { name, fields, relations } = req.body;

        const model = await prisma.dataModel.findUnique({ where: { id: id as string } });
        if (!model) { res.status(404).json({ error: 'Model not found' }); return; }

        const currentSchema = safeJsonParse(model.schema, { fields: [], relations: [] }) as any;
        const newSchema = {
            fields: fields || currentSchema.fields,
            relations: relations || currentSchema.relations
        };

        const updated = await prisma.dataModel.update({
            where: { id: id as string },
            data: { name: name || model.name, schema: JSON.stringify(newSchema) }
        });

        res.json({
            id: updated.id, name: updated.name,
            fields: newSchema.fields, relations: newSchema.relations,
            timestamps: true, soft_delete: false, archived: updated.archived
        });
    } catch (error) {
        console.error('Error updating data model:', error);
        res.status(500).json({ error: 'Failed to update data model' });
    }
}

export async function deleteDataModel(req: Request, res: Response) {
    try {
        const { id } = req.params;
        await prisma.dataModel.update({ where: { id: id as string }, data: { archived: true } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
}

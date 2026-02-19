
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/data-models - List data models for a project
router.get('/', async (req, res) => {
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

        // Parse JSON fields
        const hydrated = models.map(m => {
            const schema = JSON.parse(m.schema);
            return {
                id: m.id,
                name: m.name,
                fields: schema.fields || [],
                relations: schema.relations || [],
                timestamps: true, // Mock defaults if not in schema
                soft_delete: false,
                archived: m.archived
            };
        });

        res.json(hydrated);
    } catch (error) {
        console.error('Error listing data models:', error);
        res.status(500).json({ error: 'Failed to list data models' });
    }
});

// POST /api/data-models - Create a new data model
router.post('/', async (req, res) => {
    try {
        const { projectId, name } = req.body;

        // Initial empty schema
        const schema = {
            fields: [
                { id: 'id', name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true }
            ],
            relations: []
        };

        const model = await prisma.dataModel.create({
            data: {
                projectId,
                name,
                schema: JSON.stringify(schema)
            }
        });

        res.json({
            id: model.id,
            name: model.name,
            fields: schema.fields,
            relations: schema.relations,
            timestamps: true,
            soft_delete: false,
            archived: false
        });
    } catch (error) {
        console.error('Error creating data model:', error);
        res.status(500).json({ error: 'Failed to create data model' });
    }
});

// POST /api/data-models/field - Add field (Helper endpoint)
// Or use PUT /api/data-models/:id to update entire schema
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, fields, relations } = req.body;

        const model = await prisma.dataModel.findUnique({ where: { id } });
        if (!model) {
            res.status(404).json({ error: 'Model not found' });
            return;
        }

        const currentSchema = JSON.parse(model.schema);
        const newSchema = {
            fields: fields || currentSchema.fields,
            relations: relations || currentSchema.relations
        };

        const updated = await prisma.dataModel.update({
            where: { id },
            data: {
                name: name || model.name,
                schema: JSON.stringify(newSchema)
            }
        });

        res.json({
            id: updated.id,
            name: updated.name,
            fields: newSchema.fields,
            relations: newSchema.relations,
            timestamps: true,
            soft_delete: false,
            archived: updated.archived
        });

    } catch (error) {
        console.error('Error updating data model:', error);
        res.status(500).json({ error: 'Failed to update data model' });
    }
});

// DELETE /api/data-models/:id - Archive
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.dataModel.update({
            where: { id },
            data: { archived: true }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

export default router;

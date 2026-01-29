import express from 'express';
import {
    getPages,
    getPage,
    createPage,
    updatePage,
    deletePage,
    duplicatePage,
    reorderPages,
} from '../controllers/page.controller';

const router = express.Router();

// Page routes (all protected by auth middleware in server.ts)
router.route('/:projectId').get(getPages).post(createPage);
router.put('/:projectId/reorder', reorderPages);
router.route('/:projectId/:pageId').get(getPage).put(updatePage).delete(deletePage);
router.post('/:projectId/:pageId/duplicate', duplicatePage);

export default router;

import express from 'express';
import {
    getSharedComponents,
    getSharedComponentByType,
    upsertSharedComponent,
    deleteSharedComponent,
} from '../controllers/shared.controller';

const router = express.Router();

router.route('/:projectId').get(getSharedComponents).post(upsertSharedComponent);
router.route('/:projectId/:type').get(getSharedComponentByType).delete(deleteSharedComponent);

export default router;

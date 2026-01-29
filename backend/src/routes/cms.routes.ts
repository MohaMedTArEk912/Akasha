import express from 'express';
import {
    getCollections,
    getCollection,
    createCollection,
    updateCollection,
    deleteCollection,
    getCollectionItems,
    createCollectionItem,
    updateCollectionItem,
    deleteCollectionItem,
} from '../controllers/cms.controller';

const router = express.Router();

// Collection routes
router.route('/collections').get(getCollections).post(createCollection);
router.route('/collections/:id').get(getCollection).put(updateCollection).delete(deleteCollection);

// Collection Items routes
router.route('/collections/:collectionId/items').get(getCollectionItems).post(createCollectionItem);
router.route('/items/:id').put(updateCollectionItem).delete(deleteCollectionItem);

export default router;

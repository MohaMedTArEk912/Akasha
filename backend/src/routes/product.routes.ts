import express from 'express';
import {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
} from '../controllers/product.controller';

const router = express.Router();

router.route('/:projectId').get(getProducts).post(createProduct);
router.route('/:projectId/:productId').put(updateProduct).delete(deleteProduct);

export default router;
import express from 'express';
import {
    getSymbols,
    getSymbol,
    createSymbol,
    updateSymbol,
    deleteSymbol,
} from '../controllers/symbol.controller';

const router = express.Router();

router.route('/').get(getSymbols).post(createSymbol);
router.route('/:id').get(getSymbol).put(updateSymbol).delete(deleteSymbol);

export default router;

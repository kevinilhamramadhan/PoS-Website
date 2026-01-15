/**
 * Ingredient Routes
 * GET /api/ingredients
 * GET /api/ingredients/low-stock
 * GET /api/ingredients/:id
 * POST /api/ingredients (Admin)
 * PUT /api/ingredients/:id (Admin)
 * DELETE /api/ingredients/:id (Admin)
 * POST /api/ingredients/:id/adjust-stock (Admin)
 * GET /api/ingredients/:id/history
 */

import { Router } from 'express';
import {
    getIngredients,
    getIngredient,
    createIngredient,
    updateIngredient,
    deleteIngredient,
    getLowStock,
    adjustStock,
    getStockHistory
} from '../controllers/ingredientController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { adminOnly } from '../middlewares/roleMiddleware.js';
import { validate } from '../middlewares/errorHandler.js';
import {
    ingredientValidator,
    ingredientUpdateValidator,
    stockAdjustmentValidator,
    uuidParamValidator
} from '../utils/validators.js';

const router = Router();

// All ingredient routes require authentication
router.use(authenticate);

// Low stock alert (before :id route to avoid conflict)
router.get('/low-stock', adminOnly, getLowStock);

// Basic CRUD
router.get('/', getIngredients);
router.get('/:id', uuidParamValidator, validate, getIngredient);
router.post('/', adminOnly, ingredientValidator, validate, createIngredient);
router.put('/:id', adminOnly, uuidParamValidator, ingredientUpdateValidator, validate, updateIngredient);
router.delete('/:id', adminOnly, uuidParamValidator, validate, deleteIngredient);

// Stock management
router.post('/:id/adjust-stock', adminOnly, uuidParamValidator, stockAdjustmentValidator, validate, adjustStock);
router.get('/:id/history', uuidParamValidator, validate, getStockHistory);

export default router;

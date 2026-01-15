/**
 * Recipe Routes
 * GET /api/recipes/product/:productId
 * POST /api/recipes
 * POST /api/recipes/bulk
 * PUT /api/recipes/:id
 * DELETE /api/recipes/:id
 */

import { Router } from 'express';
import {
    getRecipeByProduct,
    createRecipe,
    bulkUpdateRecipe,
    updateRecipe,
    deleteRecipe
} from '../controllers/recipeController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { adminOnly } from '../middlewares/roleMiddleware.js';
import { validate } from '../middlewares/errorHandler.js';
import {
    recipeValidator,
    recipeBulkValidator,
    uuidParamValidator,
    productIdParamValidator
} from '../utils/validators.js';

const router = Router();

// All recipe routes require admin
router.use(authenticate, adminOnly);

// Get recipe by product
router.get('/product/:productId', productIdParamValidator, validate, getRecipeByProduct);

// Create/Update recipes
router.post('/', recipeValidator, validate, createRecipe);
router.post('/bulk', recipeBulkValidator, validate, bulkUpdateRecipe);

// Update/Delete single recipe item
router.put('/:id', uuidParamValidator, validate, updateRecipe);
router.delete('/:id', uuidParamValidator, validate, deleteRecipe);

export default router;

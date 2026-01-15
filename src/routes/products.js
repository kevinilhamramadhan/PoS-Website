/**
 * Product Routes
 * GET /api/products
 * GET /api/products/:id
 * POST /api/products (Admin)
 * PUT /api/products/:id (Admin)
 * DELETE /api/products/:id (Admin)
 * GET /api/products/:id/cost-breakdown (Admin)
 * GET /api/products/:id/recipe
 */

import { Router } from 'express';
import {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getCostBreakdown,
    getProductWithRecipe
} from '../controllers/productController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { adminOnly } from '../middlewares/roleMiddleware.js';
import { validate } from '../middlewares/errorHandler.js';
import { productValidator, productUpdateValidator, uuidParamValidator } from '../utils/validators.js';

const router = Router();

// Public routes
router.get('/', getProducts);
router.get('/:id', uuidParamValidator, validate, getProduct);

// Admin only routes
router.post('/', authenticate, adminOnly, productValidator, validate, createProduct);
router.put('/:id', authenticate, adminOnly, uuidParamValidator, productUpdateValidator, validate, updateProduct);
router.delete('/:id', authenticate, adminOnly, uuidParamValidator, validate, deleteProduct);

// Cost breakdown (Admin only)
router.get('/:id/cost-breakdown', authenticate, adminOnly, uuidParamValidator, validate, getCostBreakdown);
router.get('/:id/recipe', authenticate, uuidParamValidator, validate, getProductWithRecipe);

export default router;

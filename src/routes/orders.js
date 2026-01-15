/**
 * Order Routes
 * GET /api/orders
 * GET /api/orders/:id
 * POST /api/orders
 * PUT /api/orders/:id
 * PATCH /api/orders/:id/status
 * DELETE /api/orders/:id
 * GET /api/orders/:id/revisions
 * POST /api/orders/:id/items
 * DELETE /api/orders/:id/items/:productId
 */

import { Router } from 'express';
import {
    getOrders,
    getOrder,
    createOrder,
    updateOrder,
    updateOrderStatus,
    deleteOrder,
    getOrderRevisions,
    addOrderItem,
    removeOrderItem
} from '../controllers/orderController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/errorHandler.js';
import {
    orderValidator,
    orderUpdateValidator,
    orderStatusValidator,
    uuidParamValidator
} from '../utils/validators.js';

const router = Router();

// All order routes require authentication
router.use(authenticate);

// Basic CRUD
router.get('/', getOrders);
router.get('/:id', uuidParamValidator, validate, getOrder);
router.post('/', orderValidator, validate, createOrder);
router.put('/:id', uuidParamValidator, orderUpdateValidator, validate, updateOrder);
router.delete('/:id', uuidParamValidator, validate, deleteOrder);

// Status update
router.patch('/:id/status', uuidParamValidator, orderStatusValidator, validate, updateOrderStatus);

// Revisions history
router.get('/:id/revisions', uuidParamValidator, validate, getOrderRevisions);

// Item management
router.post('/:id/items', uuidParamValidator, validate, addOrderItem);
router.delete('/:id/items/:productId', validate, removeOrderItem);

export default router;

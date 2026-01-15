/**
 * Chatbot Integration Routes
 * These endpoints are designed for AI chatbot function calling
 * 
 * GET /api/chatbot/menu
 * POST /api/chatbot/check-availability
 * POST /api/chatbot/create-order
 * PUT /api/chatbot/update-order/:id
 * GET /api/chatbot/order-status/:id
 * GET /api/chatbot/customer-orders/:email
 */

import { Router } from 'express';
import {
    getMenu,
    checkAvailability,
    createOrder,
    updateOrder,
    getOrderStatus,
    getCustomerOrders
} from '../controllers/chatbotController.js';
import { validate } from '../middlewares/errorHandler.js';
import {
    chatbotOrderValidator,
    availabilityCheckValidator
} from '../utils/validators.js';

const router = Router();

// Public menu endpoint
router.get('/menu', getMenu);

// Availability check
router.post('/check-availability', availabilityCheckValidator, validate, checkAvailability);

// Order management
router.post('/create-order', chatbotOrderValidator, validate, createOrder);
router.put('/update-order/:id', updateOrder);

// Order status
router.get('/order-status/:id', getOrderStatus);

// Customer orders
router.get('/customer-orders/:email', getCustomerOrders);

export default router;

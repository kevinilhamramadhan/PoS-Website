/**
 * Report Routes (Admin only)
 * GET /api/reports/dashboard
 * GET /api/reports/sales-summary
 * GET /api/reports/popular-products
 * GET /api/reports/stock-alerts
 * GET /api/reports/profit-margin
 */

import { Router } from 'express';
import {
    getDashboard,
    getSalesSummary,
    getPopularProducts,
    getStockAlerts,
    getProfitMargin
} from '../controllers/reportController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { adminOnly } from '../middlewares/roleMiddleware.js';
import { validate } from '../middlewares/errorHandler.js';
import { dateRangeValidator } from '../utils/validators.js';

const router = Router();

// All report routes require admin
router.use(authenticate, adminOnly);

// Dashboard overview
router.get('/dashboard', getDashboard);

// Individual reports
router.get('/sales-summary', dateRangeValidator, validate, getSalesSummary);
router.get('/popular-products', dateRangeValidator, validate, getPopularProducts);
router.get('/stock-alerts', getStockAlerts);
router.get('/profit-margin', getProfitMargin);

export default router;

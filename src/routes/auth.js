/**
 * Auth Routes
 * POST /api/auth/register
 * POST /api/auth/login
 * GET /api/auth/me
 * PUT /api/auth/me
 */

import { Router } from 'express';
import { register, login, getCurrentUser, updateProfile } from '../controllers/authController.js';
import { authenticate, optionalAuth } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/errorHandler.js';
import { registerValidator, loginValidator } from '../utils/validators.js';

const router = Router();

// Public routes
router.post('/register', registerValidator, validate, register);
router.post('/login', loginValidator, validate, login);

// Protected routes
router.get('/me', authenticate, getCurrentUser);
router.put('/me', authenticate, updateProfile);

export default router;

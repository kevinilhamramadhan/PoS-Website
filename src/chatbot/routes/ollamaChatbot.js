/**
 * Ollama Chatbot Routes
 * Routes untuk integrasi chatbot dengan Ollama AI
 * 
 * POST /api/ollama-chat/chat - Main chat endpoint
 * POST /api/ollama-chat/clear-session - Clear conversation history
 * GET  /api/ollama-chat/cart/:sessionId - Get cart for session
 */

import { Router } from 'express';
import { handleChat, clearSession, getCartEndpoint } from '../controllers/ollamaChatbotController.js';

const router = Router();

// Main chat endpoint - public (no auth required)
router.post('/chat', handleChat);

// Clear session endpoint - optional utility
router.post('/clear-session', clearSession);

// Cart endpoint - get current cart
router.get('/cart/:sessionId', getCartEndpoint);

export default router;


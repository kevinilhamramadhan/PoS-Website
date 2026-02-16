/**
 * Point of Sale (PoS) API Server
 * Main Express application setup
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import ingredientRoutes from './routes/ingredients.js';
import recipeRoutes from './routes/recipes.js';
import orderRoutes from './routes/orders.js';
import reportRoutes from './routes/reports.js';
import chatbotRoutes from './routes/chatbot.js';
import { ollamaChatbotRoutes } from './chatbot/index.js';

// Import error handlers
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'PoS API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API info
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'Welcome to Bakery PoS API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            products: '/api/products',
            ingredients: '/api/ingredients',
            recipes: '/api/recipes',
            orders: '/api/orders',
            reports: '/api/reports',
            chatbot: '/api/chatbot'
        },
        documentation: '/api/docs'
    });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/ollama-chat', ollamaChatbotRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log('');
    console.log('🧁 ================================');
    console.log('🧁  Bakery PoS API Server');
    console.log('🧁 ================================');
    console.log('');
    console.log(`📍 Server running on port ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log(`📚 API docs: http://localhost:${PORT}/api`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  POST /api/auth/register');
    console.log('  POST /api/auth/login');
    console.log('  GET  /api/auth/me');
    console.log('  GET  /api/products');
    console.log('  GET  /api/ingredients');
    console.log('  GET  /api/orders');
    console.log('  GET  /api/reports/dashboard');
    console.log('  GET  /api/chatbot/menu');
    console.log('  POST /api/ollama-chat/chat');
    console.log('');
    console.log('🟢 Ready to accept connections');
    console.log('');
});

export default app;

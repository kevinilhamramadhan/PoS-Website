/**
 * Centralized Error Handler Middleware
 * Handles all errors and returns consistent error responses
 */

import { validationResult } from 'express-validator';

/**
 * Custom API Error class
 * Use this to throw errors with specific status codes
 */
export class ApiError extends Error {
    constructor(statusCode, message, code = 'API_ERROR', details = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;
    }

    static badRequest(message, code = 'BAD_REQUEST', details = null) {
        return new ApiError(400, message, code, details);
    }

    static unauthorized(message = 'Tidak memiliki akses', code = 'UNAUTHORIZED') {
        return new ApiError(401, message, code);
    }

    static forbidden(message = 'Akses ditolak', code = 'FORBIDDEN') {
        return new ApiError(403, message, code);
    }

    static notFound(message = 'Resource tidak ditemukan', code = 'NOT_FOUND') {
        return new ApiError(404, message, code);
    }

    static conflict(message, code = 'CONFLICT') {
        return new ApiError(409, message, code);
    }

    static internal(message = 'Terjadi kesalahan server', code = 'INTERNAL_ERROR') {
        return new ApiError(500, message, code);
    }
}

/**
 * Middleware to validate request using express-validator
 * Place this after validation rules in route
 */
export const validate = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
        }));

        console.log('❌ Validation errors:', formattedErrors);

        return res.status(400).json({
            success: false,
            error: 'Validasi gagal',
            code: 'VALIDATION_ERROR',
            details: formattedErrors
        });
    }

    next();
};

/**
 * 404 Not Found handler for undefined routes
 */
export const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        success: false,
        error: `Route tidak ditemukan: ${req.method} ${req.originalUrl}`,
        code: 'ROUTE_NOT_FOUND'
    });
};

/**
 * Global error handler middleware
 * This should be the LAST middleware in the chain
 */
export const errorHandler = (err, req, res, next) => {
    console.error('🔥 Error:', err);

    // Handle ApiError instances
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.message,
            code: err.code,
            ...(err.details && { details: err.details })
        });
    }

    // Handle PostgreSQL errors
    if (err.code && err.message && err.details) {
        // PostgreSQL unique violation
        if (err.code === '23505') {
            return res.status(409).json({
                success: false,
                error: 'Data sudah ada (duplikat)',
                code: 'DUPLICATE_ENTRY',
                details: err.details
            });
        }

        // PostgreSQL foreign key violation
        if (err.code === '23503') {
            return res.status(400).json({
                success: false,
                error: 'Referensi data tidak valid',
                code: 'INVALID_REFERENCE',
                details: err.details
            });
        }

        // PostgreSQL check constraint violation
        if (err.code === '23514') {
            return res.status(400).json({
                success: false,
                error: 'Data tidak memenuhi constraint',
                code: 'CONSTRAINT_VIOLATION',
                details: err.details
            });
        }
    }

    // Handle JWT errors (in case they slip through)
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            error: 'Token tidak valid',
            code: 'INVALID_TOKEN'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: 'Token sudah expired',
            code: 'TOKEN_EXPIRED'
        });
    }

    // Handle syntax errors in JSON body
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            error: 'Format JSON tidak valid',
            code: 'INVALID_JSON'
        });
    }

    // Default to 500 Internal Server Error
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Terjadi kesalahan pada server'
        : err.message;

    res.status(statusCode).json({
        success: false,
        error: message,
        code: 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
};

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors automatically
 * 
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

export default {
    ApiError,
    validate,
    notFoundHandler,
    errorHandler,
    asyncHandler
};

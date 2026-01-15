/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

/**
 * Middleware to verify JWT token
 * Extracts token from Authorization header (Bearer token)
 * Attaches decoded user info to req.user
 */
export const authenticate = (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'Akses ditolak. Token tidak ditemukan.',
                code: 'NO_TOKEN'
            });
        }

        // Check Bearer format
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Format token tidak valid. Gunakan: Bearer <token>',
                code: 'INVALID_TOKEN_FORMAT'
            });
        }

        // Extract token
        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Attach user info to request
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            full_name: decoded.full_name
        };

        console.log(`🔐 Authenticated: ${decoded.email} (${decoded.role})`);

        next();
    } catch (error) {
        console.error('❌ Auth error:', error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token sudah expired. Silakan login kembali.',
                code: 'TOKEN_EXPIRED'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Token tidak valid.',
                code: 'INVALID_TOKEN'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Terjadi kesalahan saat verifikasi token.',
            code: 'AUTH_ERROR'
        });
    }
};

/**
 * Optional authentication - doesn't fail if no token
 * Useful for endpoints that work for both guests and authenticated users
 */
export const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            req.user = null;
            return next();
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            full_name: decoded.full_name
        };

        next();
    } catch (error) {
        // Token invalid but continue without user
        req.user = null;
        next();
    }
};

export default { authenticate, optionalAuth };

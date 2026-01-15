/**
 * Auth Controller
 * Handles user authentication: register, login, get current user
 */

import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ApiError, asyncHandler } from '../middlewares/errorHandler.js';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token for user
 */
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
            full_name: user.full_name
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

/**
 * POST /api/auth/register
 * Register a new user
 */
export const register = asyncHandler(async (req, res) => {
    const { email, password, full_name, phone, role } = req.body;

    console.log(`📝 Register attempt: ${email}`);

    // Check if email already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
        throw ApiError.conflict('Email sudah terdaftar');
    }

    // Create user (default role: customer)
    // Only allow admin role if current user is admin
    let userRole = 'customer';
    if (role === 'admin' && req.user?.role === 'admin') {
        userRole = 'admin';
    }

    const user = await User.create({
        email,
        password,
        full_name,
        phone,
        role: userRole
    });

    // Generate token
    const token = generateToken(user);

    console.log(`✅ User registered: ${email}`);

    res.status(201).json({
        success: true,
        message: 'Registrasi berhasil',
        data: {
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                phone: user.phone
            },
            token
        }
    });
});

/**
 * POST /api/auth/login
 * Login user and return JWT token
 */
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    console.log(`🔐 Login attempt: ${email}`);

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
        throw ApiError.unauthorized('Email atau password salah');
    }

    // Verify password
    const isValidPassword = await User.verifyPassword(password, user.password);
    if (!isValidPassword) {
        throw ApiError.unauthorized('Email atau password salah');
    }

    // Generate token
    const token = generateToken(user);

    console.log(`✅ Login success: ${email} (${user.role})`);

    res.json({
        success: true,
        message: 'Login berhasil',
        data: {
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                phone: user.phone
            },
            token
        }
    });
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        throw ApiError.notFound('User tidak ditemukan');
    }

    res.json({
        success: true,
        data: {
            user
        }
    });
});

/**
 * PUT /api/auth/me
 * Update current user profile
 */
export const updateProfile = asyncHandler(async (req, res) => {
    const { full_name, phone, password } = req.body;

    const updateData = {};
    if (full_name) updateData.full_name = full_name;
    if (phone) updateData.phone = phone;
    if (password) updateData.password = password;

    const user = await User.update(req.user.id, updateData);

    res.json({
        success: true,
        message: 'Profil berhasil diupdate',
        data: { user }
    });
});

export default {
    register,
    login,
    getCurrentUser,
    updateProfile
};

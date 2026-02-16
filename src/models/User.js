/**
 * User Model
 * Handles all database operations for users table
 */

import { query } from '../utils/db.js';
import bcrypt from 'bcryptjs';

const User = {
    /**
     * Find user by ID
     * @param {string} id - User UUID
     * @returns {Object|null} User object or null
     */
    async findById(id) {
        const { rows } = await query(
            'SELECT id, email, full_name, role, phone, created_at, updated_at FROM users WHERE id = $1',
            [id]
        );
        return rows[0] || null;
    },

    /**
     * Find user by email
     * @param {string} email - User email
     * @returns {Object|null} User object (including password) or null
     */
    async findByEmail(email) {
        const { rows } = await query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        return rows[0] || null;
    },

    /**
     * Create a new user
     * @param {Object} userData - User data { email, password, full_name, role?, phone? }
     * @returns {Object} Created user (without password)
     */
    async create(userData) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userData.password, salt);

        const { rows } = await query(
            `INSERT INTO users (email, password, full_name, role, phone)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, email, full_name, role, phone, created_at`,
            [
                userData.email,
                hashedPassword,
                userData.full_name,
                userData.role || 'customer',
                userData.phone || null
            ]
        );

        console.log(`✅ User created: ${rows[0].email}`);
        return rows[0];
    },

    /**
     * Update user by ID
     * @param {string} id - User UUID
     * @param {Object} updateData - Fields to update
     * @returns {Object} Updated user
     */
    async update(id, updateData) {
        if (updateData.password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(updateData.password, salt);
        }

        const fields = Object.keys(updateData);
        const values = Object.values(updateData);
        const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');

        const { rows } = await query(
            `UPDATE users SET ${setClause} WHERE id = $1
             RETURNING id, email, full_name, role, phone, created_at, updated_at`,
            [id, ...values]
        );

        if (rows.length === 0) throw new Error('User not found');
        console.log(`✅ User updated: ${rows[0].email}`);
        return rows[0];
    },

    /**
     * Verify user password
     * @param {string} plainPassword - Plain text password
     * @param {string} hashedPassword - Hashed password from database
     * @returns {boolean} True if password matches
     */
    async verifyPassword(plainPassword, hashedPassword) {
        return bcrypt.compare(plainPassword, hashedPassword);
    },

    /**
     * Get all users (admin function)
     * @param {Object} options - { page, limit, role }
     * @returns {Object} List of users with pagination
     */
    async findAll({ page = 1, limit = 10, role = null } = {}) {
        const offset = (page - 1) * limit;
        let whereClause = '';
        const params = [];

        if (role) {
            whereClause = 'WHERE role = $1';
            params.push(role);
        }

        const countResult = await query(
            `SELECT COUNT(*) FROM users ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        const dataParams = [...params, limit, offset];
        const { rows } = await query(
            `SELECT id, email, full_name, role, phone, created_at, updated_at
             FROM users ${whereClause}
             ORDER BY created_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            dataParams
        );

        return {
            users: rows,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    },

    /**
     * Delete user by ID
     * @param {string} id - User UUID
     * @returns {boolean} True if deleted
     */
    async delete(id) {
        await query('DELETE FROM users WHERE id = $1', [id]);
        console.log(`✅ User deleted: ${id}`);
        return true;
    }
};

export default User;

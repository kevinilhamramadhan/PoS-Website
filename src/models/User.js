/**
 * User Model
 * Handles all database operations for users table
 */

import supabase from '../utils/supabaseClient.js';
import bcrypt from 'bcryptjs';

const User = {
    /**
     * Find user by ID
     * @param {string} id - User UUID
     * @returns {Object|null} User object or null
     */
    async findById(id) {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, full_name, role, phone, created_at, updated_at')
            .eq('id', id)
            .single();

        if (error) {
            console.error('❌ Error finding user by ID:', error);
            return null;
        }
        return data;
    },

    /**
     * Find user by email
     * @param {string} email - User email
     * @returns {Object|null} User object (including password) or null
     */
    async findByEmail(email) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
            console.error('❌ Error finding user by email:', error);
        }
        return data;
    },

    /**
     * Create a new user
     * @param {Object} userData - User data { email, password, full_name, role?, phone? }
     * @returns {Object} Created user (without password)
     */
    async create(userData) {
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userData.password, salt);

        const { data, error } = await supabase
            .from('users')
            .insert({
                email: userData.email,
                password: hashedPassword,
                full_name: userData.full_name,
                role: userData.role || 'customer',
                phone: userData.phone || null
            })
            .select('id, email, full_name, role, phone, created_at')
            .single();

        if (error) {
            console.error('❌ Error creating user:', error);
            throw error;
        }

        console.log(`✅ User created: ${data.email}`);
        return data;
    },

    /**
     * Update user by ID
     * @param {string} id - User UUID
     * @param {Object} updateData - Fields to update
     * @returns {Object} Updated user
     */
    async update(id, updateData) {
        // If updating password, hash it
        if (updateData.password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(updateData.password, salt);
        }

        const { data, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', id)
            .select('id, email, full_name, role, phone, created_at, updated_at')
            .single();

        if (error) {
            console.error('❌ Error updating user:', error);
            throw error;
        }

        console.log(`✅ User updated: ${data.email}`);
        return data;
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
     * @returns {Array} List of users
     */
    async findAll({ page = 1, limit = 10, role = null } = {}) {
        let query = supabase
            .from('users')
            .select('id, email, full_name, role, phone, created_at, updated_at', { count: 'exact' });

        if (role) {
            query = query.eq('role', role);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('❌ Error finding users:', error);
            throw error;
        }

        return {
            users: data,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit)
        };
    },

    /**
     * Delete user by ID
     * @param {string} id - User UUID
     * @returns {boolean} True if deleted
     */
    async delete(id) {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('❌ Error deleting user:', error);
            throw error;
        }

        console.log(`✅ User deleted: ${id}`);
        return true;
    }
};

export default User;

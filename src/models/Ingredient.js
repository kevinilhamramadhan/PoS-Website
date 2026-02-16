/**
 * Ingredient Model
 * Handles all database operations for ingredients table
 */

import { query } from '../utils/db.js';

const Ingredient = {
    /**
     * Find ingredient by ID
     * @param {string} id - Ingredient UUID
     * @returns {Object|null} Ingredient object or null
     */
    async findById(id) {
        const { rows } = await query('SELECT * FROM ingredients WHERE id = $1', [id]);
        return rows[0] || null;
    },

    /**
     * Find ingredient by name (case-insensitive)
     * @param {string} name - Ingredient name
     * @returns {Object|null} Ingredient object or null
     */
    async findByName(name) {
        const { rows } = await query(
            'SELECT * FROM ingredients WHERE LOWER(name) = LOWER($1)',
            [name]
        );
        return rows[0] || null;
    },

    /**
     * Get all ingredients
     * @param {Object} options - { page, limit, search }
     * @returns {Object} { ingredients, total, page, limit, totalPages }
     */
    async findAll({ page = 1, limit = 20, search = null } = {}) {
        const conditions = [];
        const params = [];
        let paramIdx = 1;

        if (search) {
            conditions.push(`name ILIKE $${paramIdx++}`);
            params.push(`%${search}%`);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const countResult = await query(
            `SELECT COUNT(*) FROM ingredients ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        const offset = (page - 1) * limit;
        const { rows } = await query(
            `SELECT * FROM ingredients ${whereClause}
             ORDER BY name ASC
             LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...params, limit, offset]
        );

        return {
            ingredients: rows,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    },

    /**
     * Create a new ingredient
     * @param {Object} ingredientData - Ingredient data
     * @returns {Object} Created ingredient
     */
    async create(ingredientData) {
        const { rows } = await query(
            `INSERT INTO ingredients (name, unit, stock_quantity, min_stock_threshold, unit_price)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                ingredientData.name,
                ingredientData.unit,
                ingredientData.stock_quantity || 0,
                ingredientData.min_stock_threshold || 0,
                ingredientData.unit_price
            ]
        );

        console.log(`✅ Ingredient created: ${rows[0].name}`);
        return rows[0];
    },

    /**
     * Update ingredient by ID
     * @param {string} id - Ingredient UUID
     * @param {Object} updateData - Fields to update
     * @returns {Object} Updated ingredient
     */
    async update(id, updateData) {
        const fields = Object.keys(updateData);
        const values = Object.values(updateData);
        const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');

        const { rows } = await query(
            `UPDATE ingredients SET ${setClause} WHERE id = $1 RETURNING *`,
            [id, ...values]
        );

        if (rows.length === 0) throw new Error('Ingredient not found');
        console.log(`✅ Ingredient updated: ${rows[0].name}`);
        return rows[0];
    },

    /**
     * Delete ingredient by ID
     * @param {string} id - Ingredient UUID
     * @returns {boolean} True if deleted
     */
    async delete(id) {
        await query('DELETE FROM ingredients WHERE id = $1', [id]);
        console.log(`✅ Ingredient deleted: ${id}`);
        return true;
    },

    /**
     * Get ingredients with low stock
     * @returns {Array} Ingredients where stock <= threshold
     */
    async findLowStock() {
        const { rows } = await query(
            `SELECT *, (min_stock_threshold - stock_quantity) AS shortage_amount
             FROM ingredients
             WHERE stock_quantity <= min_stock_threshold
             ORDER BY (min_stock_threshold - stock_quantity) DESC`
        );
        return rows;
    },

    /**
     * Update stock quantity (direct update)
     * @param {string} id - Ingredient UUID
     * @param {number} newQuantity - New stock quantity
     * @returns {Object} Updated ingredient
     */
    async updateStock(id, newQuantity) {
        const { rows } = await query(
            'UPDATE ingredients SET stock_quantity = $2 WHERE id = $1 RETURNING *',
            [id, newQuantity]
        );

        if (rows.length === 0) throw new Error('Ingredient not found');
        console.log(`✅ Stock updated: ${rows[0].name} = ${newQuantity} ${rows[0].unit}`);
        return rows[0];
    },

    /**
     * Adjust stock (add or subtract)
     * @param {string} id - Ingredient UUID
     * @param {number} adjustment - Amount to add (positive) or subtract (negative)
     * @returns {Object} Updated ingredient
     */
    async adjustStock(id, adjustment) {
        const current = await this.findById(id);
        if (!current) throw new Error(`Ingredient ${id} not found`);

        const newQuantity = Math.max(0, parseFloat(current.stock_quantity) + parseFloat(adjustment));
        return this.updateStock(id, newQuantity);
    },

    /**
     * Batch update stocks (for order processing)
     * @param {Array} updates - Array of { id, adjustment }
     * @returns {Array} Updated ingredients
     */
    async batchAdjustStock(updates) {
        const results = [];
        for (const update of updates) {
            const result = await this.adjustStock(update.id, update.adjustment);
            results.push(result);
        }
        return results;
    },

    /**
     * Check if ingredients have sufficient stock
     * @param {Array} requirements - Array of { ingredient_id, quantity_needed }
     * @returns {Object} { sufficient: boolean, shortages: Array }
     */
    async checkStockSufficiency(requirements) {
        const shortages = [];

        for (const req of requirements) {
            const ingredient = await this.findById(req.ingredient_id);

            if (!ingredient) {
                shortages.push({
                    ingredient_id: req.ingredient_id,
                    ingredient_name: 'Unknown',
                    required: req.quantity_needed,
                    available: 0,
                    shortage: req.quantity_needed
                });
                continue;
            }

            if (ingredient.stock_quantity < req.quantity_needed) {
                shortages.push({
                    ingredient_id: ingredient.id,
                    ingredient_name: ingredient.name,
                    unit: ingredient.unit,
                    required: req.quantity_needed,
                    available: ingredient.stock_quantity,
                    shortage: req.quantity_needed - ingredient.stock_quantity
                });
            }
        }

        return { sufficient: shortages.length === 0, shortages };
    }
};

export default Ingredient;

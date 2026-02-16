/**
 * Recipe Model
 * Handles many-to-many relationship between products and ingredients
 */

import { query, getClient } from '../utils/db.js';

const Recipe = {
    /**
     * Find recipe item by ID
     * @param {string} id - Recipe UUID
     * @returns {Object|null} Recipe object or null
     */
    async findById(id) {
        const { rows } = await query(
            `SELECT r.*, 
                    json_build_object('id', p.id, 'name', p.name, 'selling_price', p.selling_price) AS products,
                    json_build_object('id', i.id, 'name', i.name, 'unit', i.unit, 'unit_price', i.unit_price) AS ingredients
             FROM recipes r
             JOIN products p ON r.product_id = p.id
             JOIN ingredients i ON r.ingredient_id = i.id
             WHERE r.id = $1`,
            [id]
        );
        return rows[0] || null;
    },

    /**
     * Get all recipe items for a product
     * @param {string} productId - Product UUID
     * @returns {Array} Recipe items with ingredient details
     */
    async findByProductId(productId) {
        const { rows } = await query(
            `SELECT r.id, r.quantity_needed, r.created_at,
                    i.id AS ingredient_id, i.name AS ingredient_name, i.unit,
                    i.unit_price, i.stock_quantity
             FROM recipes r
             JOIN ingredients i ON r.ingredient_id = i.id
             WHERE r.product_id = $1
             ORDER BY r.created_at ASC`,
            [productId]
        );

        return rows.map(r => ({
            id: r.id,
            ingredient_id: r.ingredient_id,
            ingredient_name: r.ingredient_name,
            unit: r.unit,
            quantity_needed: r.quantity_needed,
            unit_price: r.unit_price,
            stock_quantity: r.stock_quantity,
            ingredient_cost: r.quantity_needed * r.unit_price,
            created_at: r.created_at
        }));
    },

    /**
     * Get all products using a specific ingredient
     * @param {string} ingredientId - Ingredient UUID
     * @returns {Array} Products using this ingredient
     */
    async findByIngredientId(ingredientId) {
        const { rows } = await query(
            `SELECT r.id, r.quantity_needed,
                    json_build_object('id', p.id, 'name', p.name, 'selling_price', p.selling_price, 'is_available', p.is_available) AS products
             FROM recipes r
             JOIN products p ON r.product_id = p.id
             WHERE r.ingredient_id = $1`,
            [ingredientId]
        );
        return rows;
    },

    /**
     * Create or update recipe item (upsert)
     * @param {Object} recipeData - { product_id, ingredient_id, quantity_needed }
     * @returns {Object} Created/updated recipe
     */
    async upsert(recipeData) {
        const { rows } = await query(
            `INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
             VALUES ($1, $2, $3)
             ON CONFLICT (product_id, ingredient_id)
             DO UPDATE SET quantity_needed = EXCLUDED.quantity_needed
             RETURNING *`,
            [recipeData.product_id, recipeData.ingredient_id, recipeData.quantity_needed]
        );

        // Fetch with ingredient details
        const { rows: detailRows } = await query(
            `SELECT r.id, r.quantity_needed,
                    json_build_object('id', i.id, 'name', i.name, 'unit', i.unit, 'unit_price', i.unit_price) AS ingredients
             FROM recipes r
             JOIN ingredients i ON r.ingredient_id = i.id
             WHERE r.id = $1`,
            [rows[0].id]
        );

        console.log(`✅ Recipe updated: ${recipeData.product_id} <- ${recipeData.ingredient_id}`);
        return detailRows[0];
    },

    /**
     * Create recipe item
     * @param {Object} recipeData - { product_id, ingredient_id, quantity_needed }
     * @returns {Object} Created recipe
     */
    async create(recipeData) {
        const { rows } = await query(
            `INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [recipeData.product_id, recipeData.ingredient_id, recipeData.quantity_needed]
        );

        // Fetch with ingredient details
        const { rows: detailRows } = await query(
            `SELECT r.id, r.product_id, r.ingredient_id, r.quantity_needed,
                    json_build_object('id', i.id, 'name', i.name, 'unit', i.unit, 'unit_price', i.unit_price) AS ingredients
             FROM recipes r
             JOIN ingredients i ON r.ingredient_id = i.id
             WHERE r.id = $1`,
            [rows[0].id]
        );

        console.log(`✅ Recipe created for product ${recipeData.product_id}`);
        return detailRows[0];
    },

    /**
     * Update recipe item
     * @param {string} id - Recipe UUID
     * @param {Object} updateData - { quantity_needed }
     * @returns {Object} Updated recipe
     */
    async update(id, updateData) {
        const { rows } = await query(
            `UPDATE recipes SET quantity_needed = $2 WHERE id = $1 RETURNING *`,
            [id, updateData.quantity_needed]
        );

        if (rows.length === 0) throw new Error('Recipe not found');

        const { rows: detailRows } = await query(
            `SELECT r.id, r.quantity_needed,
                    json_build_object('id', i.id, 'name', i.name, 'unit', i.unit) AS ingredients
             FROM recipes r
             JOIN ingredients i ON r.ingredient_id = i.id
             WHERE r.id = $1`,
            [id]
        );

        return detailRows[0];
    },

    /**
     * Delete recipe item by ID
     * @param {string} id - Recipe UUID
     * @returns {boolean} True if deleted
     */
    async delete(id) {
        await query('DELETE FROM recipes WHERE id = $1', [id]);
        console.log(`✅ Recipe deleted: ${id}`);
        return true;
    },

    /**
     * Delete all recipes for a product
     * @param {string} productId - Product UUID
     * @returns {boolean} True if deleted
     */
    async deleteByProductId(productId) {
        await query('DELETE FROM recipes WHERE product_id = $1', [productId]);
        console.log(`✅ All recipes deleted for product: ${productId}`);
        return true;
    },

    /**
     * Bulk create/update recipes for a product
     * @param {string} productId - Product UUID
     * @param {Array} ingredients - Array of { ingredient_id, quantity_needed }
     * @returns {Array} Created recipes
     */
    async bulkUpdate(productId, ingredients) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            // Delete existing recipes
            await client.query('DELETE FROM recipes WHERE product_id = $1', [productId]);

            // Insert new recipes
            const results = [];
            for (const ing of ingredients) {
                const { rows } = await client.query(
                    `INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
                     VALUES ($1, $2, $3)
                     RETURNING *`,
                    [productId, ing.ingredient_id, ing.quantity_needed]
                );
                results.push(rows[0]);
            }

            await client.query('COMMIT');

            // Fetch with ingredient details
            const { rows: detailRows } = await query(
                `SELECT r.id, r.quantity_needed,
                        json_build_object('id', i.id, 'name', i.name, 'unit', i.unit, 'unit_price', i.unit_price) AS ingredients
                 FROM recipes r
                 JOIN ingredients i ON r.ingredient_id = i.id
                 WHERE r.product_id = $1`,
                [productId]
            );

            console.log(`✅ Bulk updated ${detailRows.length} recipes for product ${productId}`);
            return detailRows;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Calculate total cost for a product based on recipe
     * @param {string} productId - Product UUID
     * @returns {number} Total cost
     */
    async calculateCost(productId) {
        const recipes = await this.findByProductId(productId);
        const totalCost = recipes.reduce((sum, r) => sum + (r.quantity_needed * r.unit_price), 0);
        return Math.round(totalCost * 100) / 100;
    },

    /**
     * Get stock requirements for making a product
     * @param {string} productId - Product UUID
     * @param {number} quantity - Number of products to make
     * @returns {Array} Array of { ingredient_id, ingredient_name, quantity_needed }
     */
    async getStockRequirements(productId, quantity = 1) {
        const recipes = await this.findByProductId(productId);
        return recipes.map(r => ({
            ingredient_id: r.ingredient_id,
            ingredient_name: r.ingredient_name,
            unit: r.unit,
            quantity_needed: r.quantity_needed * quantity,
            current_stock: r.stock_quantity
        }));
    }
};

export default Recipe;

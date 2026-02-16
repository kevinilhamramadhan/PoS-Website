/**
 * Product Model
 * Handles all database operations for products table
 */

import { query } from '../utils/db.js';

const Product = {
    /**
     * Find product by ID
     * @param {string} id - Product UUID
     * @returns {Object|null} Product object or null
     */
    async findById(id) {
        const { rows } = await query('SELECT * FROM products WHERE id = $1', [id]);
        return rows[0] || null;
    },

    /**
     * Find product by name (case-insensitive)
     * @param {string} name - Product name
     * @returns {Object|null} Product object or null
     */
    async findByName(name) {
        const { rows } = await query(
            'SELECT * FROM products WHERE LOWER(name) = LOWER($1)',
            [name]
        );
        return rows[0] || null;
    },

    /**
     * Get all products
     * @param {Object} options - { page, limit, available_only, search }
     * @returns {Object} { products, total, page, limit, totalPages }
     */
    async findAll({ page = 1, limit = 20, available_only = false, search = null } = {}) {
        const conditions = [];
        const params = [];
        let paramIdx = 1;

        if (available_only) {
            conditions.push(`is_available = $${paramIdx++}`);
            params.push(true);
        }

        if (search) {
            conditions.push(`name ILIKE $${paramIdx++}`);
            params.push(`%${search}%`);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const countResult = await query(
            `SELECT COUNT(*) FROM products ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        const offset = (page - 1) * limit;
        const { rows } = await query(
            `SELECT * FROM products ${whereClause}
             ORDER BY created_at DESC
             LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...params, limit, offset]
        );

        return {
            products: rows,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    },

    /**
     * Create a new product
     * @param {Object} productData - Product data
     * @returns {Object} Created product
     */
    async create(productData) {
        const { rows } = await query(
            `INSERT INTO products (name, description, selling_price, cost_price, image_url, is_available)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                productData.name,
                productData.description || null,
                productData.selling_price,
                productData.cost_price || 0,
                productData.image_url || null,
                productData.is_available !== undefined ? productData.is_available : true
            ]
        );

        console.log(`✅ Product created: ${rows[0].name}`);
        return rows[0];
    },

    /**
     * Update product by ID
     * @param {string} id - Product UUID
     * @param {Object} updateData - Fields to update
     * @returns {Object} Updated product
     */
    async update(id, updateData) {
        const fields = Object.keys(updateData);
        const values = Object.values(updateData);
        const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');

        const { rows } = await query(
            `UPDATE products SET ${setClause} WHERE id = $1 RETURNING *`,
            [id, ...values]
        );

        if (rows.length === 0) throw new Error('Product not found');
        console.log(`✅ Product updated: ${rows[0].name}`);
        return rows[0];
    },

    /**
     * Delete product by ID
     * @param {string} id - Product UUID
     * @returns {boolean} True if deleted
     */
    async delete(id) {
        await query('DELETE FROM products WHERE id = $1', [id]);
        console.log(`✅ Product deleted: ${id}`);
        return true;
    },

    /**
     * Get product with recipe details
     * @param {string} id - Product UUID
     * @returns {Object} Product with recipe ingredients
     */
    async findWithRecipe(id) {
        const { rows: productRows } = await query('SELECT * FROM products WHERE id = $1', [id]);
        if (productRows.length === 0) throw new Error('Product not found');
        const product = productRows[0];

        const { rows: recipes } = await query(
            `SELECT r.id AS recipe_id, r.quantity_needed,
                    i.id AS ingredient_id, i.name AS ingredient_name,
                    i.unit, i.unit_price, i.stock_quantity
             FROM recipes r
             JOIN ingredients i ON r.ingredient_id = i.id
             WHERE r.product_id = $1`,
            [id]
        );

        return {
            ...product,
            recipe: recipes.map(r => ({
                recipe_id: r.recipe_id,
                ingredient_id: r.ingredient_id,
                ingredient_name: r.ingredient_name,
                unit: r.unit,
                quantity_needed: r.quantity_needed,
                unit_price: r.unit_price,
                stock_quantity: r.stock_quantity,
                cost: r.quantity_needed * r.unit_price
            }))
        };
    },

    /**
     * Update product cost_price
     * @param {string} id - Product UUID
     * @param {number} costPrice - New cost price
     * @returns {Object} Updated product
     */
    async updateCostPrice(id, costPrice) {
        const { rows } = await query(
            'UPDATE products SET cost_price = $2 WHERE id = $1 RETURNING *',
            [id, costPrice]
        );

        if (rows.length === 0) throw new Error('Product not found');
        console.log(`✅ Product cost updated: ${rows[0].name} = ${costPrice}`);
        return rows[0];
    },

    /**
     * Get available products with sufficient stock
     * @param {number} quantity - Quantity to make
     * @returns {Array} Products that can be made
     */
    async findAvailableWithStock(quantity = 1) {
        const { rows: products } = await query(
            `SELECT p.*,
                    COALESCE(json_agg(
                        json_build_object(
                            'quantity_needed', r.quantity_needed,
                            'ingredient_id', i.id,
                            'ingredient_name', i.name,
                            'stock_quantity', i.stock_quantity
                        )
                    ) FILTER (WHERE r.id IS NOT NULL), '[]') AS recipes
             FROM products p
             LEFT JOIN recipes r ON p.id = r.product_id
             LEFT JOIN ingredients i ON r.ingredient_id = i.id
             WHERE p.is_available = true
             GROUP BY p.id`
        );

        return products.map(product => {
            const recipes = typeof product.recipes === 'string'
                ? JSON.parse(product.recipes) : product.recipes;

            const canMake = recipes.length === 0 || recipes.every(recipe => {
                const requiredStock = recipe.quantity_needed * quantity;
                return recipe.stock_quantity >= requiredStock;
            });

            return {
                ...product,
                recipes: undefined,
                can_order: canMake,
                max_quantity: recipes.length > 0
                    ? Math.floor(Math.min(...recipes.map(r =>
                        r.stock_quantity / r.quantity_needed
                    )))
                    : 999
            };
        });
    }
};

export default Product;

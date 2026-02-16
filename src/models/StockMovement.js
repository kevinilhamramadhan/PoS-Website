/**
 * Stock Movement Model
 * Tracks all stock changes for audit trail
 */

import { query } from '../utils/db.js';

const StockMovement = {
    /**
     * Create a stock movement record
     * @param {Object} movementData - Movement data
     * @returns {Object} Created movement record
     */
    async create(movementData) {
        const { rows } = await query(
            `INSERT INTO stock_movements (ingredient_id, movement_type, quantity, reference_type, reference_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                movementData.ingredient_id,
                movementData.movement_type,
                movementData.quantity,
                movementData.reference_type,
                movementData.reference_id || null,
                movementData.notes || null
            ]
        );

        // Fetch with ingredient details
        const { rows: detailRows } = await query(
            `SELECT sm.*, json_build_object('id', i.id, 'name', i.name, 'unit', i.unit) AS ingredients
             FROM stock_movements sm
             JOIN ingredients i ON sm.ingredient_id = i.id
             WHERE sm.id = $1`,
            [rows[0].id]
        );

        const result = detailRows[0];
        console.log(`📦 Stock ${movementData.movement_type}: ${movementData.quantity} (${result.ingredients.name})`);
        return result;
    },

    /**
     * Batch create stock movements (for orders)
     * @param {Array} movements - Array of movement data
     * @returns {Array} Created movements
     */
    async createBatch(movements) {
        const results = [];
        for (const m of movements) {
            const { rows } = await query(
                `INSERT INTO stock_movements (ingredient_id, movement_type, quantity, reference_type, reference_id, notes)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [m.ingredient_id, m.movement_type, m.quantity, m.reference_type, m.reference_id || null, m.notes || null]
            );
            results.push(rows[0]);
        }

        // Fetch with ingredient details
        if (results.length > 0) {
            const ids = results.map(r => r.id);
            const { rows: detailRows } = await query(
                `SELECT sm.*, json_build_object('id', i.id, 'name', i.name, 'unit', i.unit) AS ingredients
                 FROM stock_movements sm
                 JOIN ingredients i ON sm.ingredient_id = i.id
                 WHERE sm.id = ANY($1)`,
                [ids]
            );
            console.log(`📦 Batch stock movement: ${detailRows.length} items`);
            return detailRows;
        }

        return results;
    },

    /**
     * Get stock movements for an ingredient
     * @param {string} ingredientId - Ingredient UUID
     * @param {Object} options - { page, limit }
     * @returns {Object} Movements with pagination
     */
    async findByIngredient(ingredientId, { page = 1, limit = 50 } = {}) {
        const offset = (page - 1) * limit;

        const countResult = await query(
            'SELECT COUNT(*) FROM stock_movements WHERE ingredient_id = $1',
            [ingredientId]
        );
        const total = parseInt(countResult.rows[0].count);

        const { rows } = await query(
            `SELECT * FROM stock_movements
             WHERE ingredient_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [ingredientId, limit, offset]
        );

        return {
            movements: rows,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    },

    /**
     * Get stock movements by reference
     * @param {string} referenceType - Reference type
     * @param {string} referenceId - Reference UUID
     * @returns {Array} Related movements
     */
    async findByReference(referenceType, referenceId) {
        const { rows } = await query(
            `SELECT sm.*, json_build_object('id', i.id, 'name', i.name, 'unit', i.unit) AS ingredients
             FROM stock_movements sm
             JOIN ingredients i ON sm.ingredient_id = i.id
             WHERE sm.reference_type = $1 AND sm.reference_id = $2
             ORDER BY sm.created_at ASC`,
            [referenceType, referenceId]
        );
        return rows;
    },

    /**
     * Get all stock movements with filters
     * @param {Object} options - Filters and pagination
     * @returns {Object} Movements with pagination
     */
    async findAll({
        page = 1, limit = 50,
        ingredient_id = null, movement_type = null,
        reference_type = null, start_date = null, end_date = null
    } = {}) {
        const conditions = [];
        const params = [];
        let paramIdx = 1;

        if (ingredient_id) {
            conditions.push(`sm.ingredient_id = $${paramIdx++}`);
            params.push(ingredient_id);
        }
        if (movement_type) {
            conditions.push(`sm.movement_type = $${paramIdx++}`);
            params.push(movement_type);
        }
        if (reference_type) {
            conditions.push(`sm.reference_type = $${paramIdx++}`);
            params.push(reference_type);
        }
        if (start_date) {
            conditions.push(`sm.created_at >= $${paramIdx++}`);
            params.push(start_date);
        }
        if (end_date) {
            conditions.push(`sm.created_at <= $${paramIdx++}`);
            params.push(end_date);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const countResult = await query(
            `SELECT COUNT(*) FROM stock_movements sm ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        const offset = (page - 1) * limit;
        const { rows } = await query(
            `SELECT sm.*, json_build_object('id', i.id, 'name', i.name, 'unit', i.unit) AS ingredients
             FROM stock_movements sm
             JOIN ingredients i ON sm.ingredient_id = i.id
             ${whereClause}
             ORDER BY sm.created_at DESC
             LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...params, limit, offset]
        );

        return {
            movements: rows,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    },

    /**
     * Get stock summary for date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Object} Stock movement summary
     */
    async getSummary(startDate, endDate) {
        const { rows } = await query(
            `SELECT sm.ingredient_id, sm.movement_type, sm.quantity,
                    i.name AS ingredient_name, i.unit
             FROM stock_movements sm
             JOIN ingredients i ON sm.ingredient_id = i.id
             WHERE sm.created_at >= $1 AND sm.created_at <= $2`,
            [startDate.toISOString(), endDate.toISOString()]
        );

        const summary = {};
        rows.forEach(m => {
            if (!summary[m.ingredient_id]) {
                summary[m.ingredient_id] = {
                    ingredient_id: m.ingredient_id,
                    ingredient_name: m.ingredient_name,
                    unit: m.unit,
                    total_in: 0, total_out: 0, adjustments: 0
                };
            }

            const qty = parseFloat(m.quantity);
            if (m.movement_type === 'in') summary[m.ingredient_id].total_in += qty;
            else if (m.movement_type === 'out') summary[m.ingredient_id].total_out += Math.abs(qty);
            else summary[m.ingredient_id].adjustments += qty;
        });

        return Object.values(summary);
    },

    /**
     * Record stock out for order
     * @param {string} orderId - Order UUID
     * @param {Array} ingredients - Array of { ingredient_id, quantity }
     * @param {string} notes - Optional notes
     * @returns {Array} Created movements
     */
    async recordOrderOut(orderId, ingredients, notes = null) {
        const movements = ingredients.map(ing => ({
            ingredient_id: ing.ingredient_id,
            movement_type: 'out',
            quantity: -Math.abs(ing.quantity),
            reference_type: 'order',
            reference_id: orderId,
            notes: notes || `Stock deduction for order ${orderId}`
        }));
        return this.createBatch(movements);
    },

    /**
     * Record stock return for cancelled order
     * @param {string} orderId - Order UUID
     * @param {Array} ingredients - Array of { ingredient_id, quantity }
     * @returns {Array} Created movements
     */
    async recordOrderCancel(orderId, ingredients) {
        const movements = ingredients.map(ing => ({
            ingredient_id: ing.ingredient_id,
            movement_type: 'in',
            quantity: Math.abs(ing.quantity),
            reference_type: 'order_cancel',
            reference_id: orderId,
            notes: `Stock returned from cancelled order ${orderId}`
        }));
        return this.createBatch(movements);
    },

    /**
     * Record manual stock adjustment
     * @param {string} ingredientId - Ingredient UUID
     * @param {number} quantity - Adjustment quantity
     * @param {string} notes - Reason for adjustment
     * @returns {Object} Created movement
     */
    async recordManualAdjustment(ingredientId, quantity, notes) {
        return this.create({
            ingredient_id: ingredientId,
            movement_type: 'adjustment',
            quantity, reference_type: 'manual',
            reference_id: null, notes
        });
    },

    /**
     * Record stock purchase/restock
     * @param {string} ingredientId - Ingredient UUID
     * @param {number} quantity - Quantity added
     * @param {string} notes - Purchase notes
     * @returns {Object} Created movement
     */
    async recordPurchase(ingredientId, quantity, notes = null) {
        return this.create({
            ingredient_id: ingredientId,
            movement_type: 'in',
            quantity: Math.abs(quantity),
            reference_type: 'purchase',
            reference_id: null,
            notes: notes || 'Stock purchase'
        });
    }
};

export default StockMovement;

/**
 * Stock Movement Model
 * Tracks all stock changes for audit trail
 */

import supabase from '../utils/supabaseClient.js';

const StockMovement = {
    /**
     * Create a stock movement record
     * @param {Object} movementData - Movement data
     * @param {string} movementData.ingredient_id - Ingredient UUID
     * @param {string} movementData.movement_type - 'in', 'out', or 'adjustment'
     * @param {number} movementData.quantity - Movement quantity (positive for in, negative for out)
     * @param {string} movementData.reference_type - 'order', 'purchase', 'manual', 'order_cancel'
     * @param {string} movementData.reference_id - Related order/purchase ID
     * @param {string} movementData.notes - Additional notes
     * @returns {Object} Created movement record
     */
    async create(movementData) {
        const { data, error } = await supabase
            .from('stock_movements')
            .insert({
                ingredient_id: movementData.ingredient_id,
                movement_type: movementData.movement_type,
                quantity: movementData.quantity,
                reference_type: movementData.reference_type,
                reference_id: movementData.reference_id || null,
                notes: movementData.notes || null
            })
            .select(`
        *,
        ingredients (id, name, unit)
      `)
            .single();

        if (error) {
            console.error('❌ Error creating stock movement:', error);
            throw error;
        }

        console.log(`📦 Stock ${movementData.movement_type}: ${movementData.quantity} (${data.ingredients.name})`);
        return data;
    },

    /**
     * Batch create stock movements (for orders)
     * @param {Array} movements - Array of movement data
     * @returns {Array} Created movements
     */
    async createBatch(movements) {
        const { data, error } = await supabase
            .from('stock_movements')
            .insert(movements)
            .select(`
        *,
        ingredients (id, name, unit)
      `);

        if (error) {
            console.error('❌ Error creating batch stock movements:', error);
            throw error;
        }

        console.log(`📦 Batch stock movement: ${data.length} items`);
        return data;
    },

    /**
     * Get stock movements for an ingredient
     * @param {string} ingredientId - Ingredient UUID
     * @param {Object} options - { page, limit }
     * @returns {Object} Movements with pagination
     */
    async findByIngredient(ingredientId, { page = 1, limit = 50 } = {}) {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, error, count } = await supabase
            .from('stock_movements')
            .select('*', { count: 'exact' })
            .eq('ingredient_id', ingredientId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('❌ Error finding stock movements:', error);
            throw error;
        }

        return {
            movements: data,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit)
        };
    },

    /**
     * Get stock movements by reference (e.g., for an order)
     * @param {string} referenceType - Reference type
     * @param {string} referenceId - Reference UUID
     * @returns {Array} Related movements
     */
    async findByReference(referenceType, referenceId) {
        const { data, error } = await supabase
            .from('stock_movements')
            .select(`
        *,
        ingredients (id, name, unit)
      `)
            .eq('reference_type', referenceType)
            .eq('reference_id', referenceId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('❌ Error finding movements by reference:', error);
            throw error;
        }

        return data;
    },

    /**
     * Get all stock movements with filters
     * @param {Object} options - Filters and pagination
     * @returns {Object} Movements with pagination
     */
    async findAll({
        page = 1,
        limit = 50,
        ingredient_id = null,
        movement_type = null,
        reference_type = null,
        start_date = null,
        end_date = null
    } = {}) {
        let query = supabase
            .from('stock_movements')
            .select(`
        *,
        ingredients (id, name, unit)
      `, { count: 'exact' });

        if (ingredient_id) {
            query = query.eq('ingredient_id', ingredient_id);
        }

        if (movement_type) {
            query = query.eq('movement_type', movement_type);
        }

        if (reference_type) {
            query = query.eq('reference_type', reference_type);
        }

        if (start_date) {
            query = query.gte('created_at', start_date);
        }

        if (end_date) {
            query = query.lte('created_at', end_date);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('❌ Error finding stock movements:', error);
            throw error;
        }

        return {
            movements: data,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit)
        };
    },

    /**
     * Get stock summary for date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Object} Stock movement summary
     */
    async getSummary(startDate, endDate) {
        const { data, error } = await supabase
            .from('stock_movements')
            .select(`
        ingredient_id,
        movement_type,
        quantity,
        ingredients (name, unit)
      `)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

        if (error) {
            console.error('❌ Error getting stock summary:', error);
            throw error;
        }

        // Aggregate by ingredient
        const summary = {};
        data.forEach(m => {
            if (!summary[m.ingredient_id]) {
                summary[m.ingredient_id] = {
                    ingredient_id: m.ingredient_id,
                    ingredient_name: m.ingredients.name,
                    unit: m.ingredients.unit,
                    total_in: 0,
                    total_out: 0,
                    adjustments: 0
                };
            }

            const qty = parseFloat(m.quantity);
            if (m.movement_type === 'in') {
                summary[m.ingredient_id].total_in += qty;
            } else if (m.movement_type === 'out') {
                summary[m.ingredient_id].total_out += Math.abs(qty);
            } else {
                summary[m.ingredient_id].adjustments += qty;
            }
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
            quantity: -Math.abs(ing.quantity), // Ensure negative for out
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
            quantity: Math.abs(ing.quantity), // Ensure positive for in
            reference_type: 'order_cancel',
            reference_id: orderId,
            notes: `Stock returned from cancelled order ${orderId}`
        }));

        return this.createBatch(movements);
    },

    /**
     * Record manual stock adjustment
     * @param {string} ingredientId - Ingredient UUID
     * @param {number} quantity - Adjustment quantity (positive or negative)
     * @param {string} notes - Reason for adjustment
     * @returns {Object} Created movement
     */
    async recordManualAdjustment(ingredientId, quantity, notes) {
        return this.create({
            ingredient_id: ingredientId,
            movement_type: 'adjustment',
            quantity: quantity,
            reference_type: 'manual',
            reference_id: null,
            notes: notes
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

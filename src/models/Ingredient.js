/**
 * Ingredient Model
 * Handles all database operations for ingredients table
 */

import supabase from '../utils/supabaseClient.js';

const Ingredient = {
    /**
     * Find ingredient by ID
     * @param {string} id - Ingredient UUID
     * @returns {Object|null} Ingredient object or null
     */
    async findById(id) {
        const { data, error } = await supabase
            .from('ingredients')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('❌ Error finding ingredient:', error);
            throw error;
        }
        return data;
    },

    /**
     * Find ingredient by name (case-insensitive)
     * @param {string} name - Ingredient name
     * @returns {Object|null} Ingredient object or null
     */
    async findByName(name) {
        const { data, error } = await supabase
            .from('ingredients')
            .select('*')
            .ilike('name', name)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('❌ Error finding ingredient by name:', error);
        }
        return data;
    },

    /**
     * Get all ingredients
     * @param {Object} options - { page, limit, search }
     * @returns {Object} { ingredients, total, page, limit, totalPages }
     */
    async findAll({ page = 1, limit = 20, search = null } = {}) {
        let query = supabase
            .from('ingredients')
            .select('*', { count: 'exact' });

        if (search) {
            query = query.ilike('name', `%${search}%`);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, error, count } = await query
            .order('name', { ascending: true })
            .range(from, to);

        if (error) {
            console.error('❌ Error finding ingredients:', error);
            throw error;
        }

        return {
            ingredients: data,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit)
        };
    },

    /**
     * Create a new ingredient
     * @param {Object} ingredientData - Ingredient data
     * @returns {Object} Created ingredient
     */
    async create(ingredientData) {
        const { data, error } = await supabase
            .from('ingredients')
            .insert({
                name: ingredientData.name,
                unit: ingredientData.unit,
                stock_quantity: ingredientData.stock_quantity || 0,
                min_stock_threshold: ingredientData.min_stock_threshold || 0,
                unit_price: ingredientData.unit_price
            })
            .select('*')
            .single();

        if (error) {
            console.error('❌ Error creating ingredient:', error);
            throw error;
        }

        console.log(`✅ Ingredient created: ${data.name}`);
        return data;
    },

    /**
     * Update ingredient by ID
     * @param {string} id - Ingredient UUID
     * @param {Object} updateData - Fields to update
     * @returns {Object} Updated ingredient
     */
    async update(id, updateData) {
        const { data, error } = await supabase
            .from('ingredients')
            .update(updateData)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            console.error('❌ Error updating ingredient:', error);
            throw error;
        }

        console.log(`✅ Ingredient updated: ${data.name}`);
        return data;
    },

    /**
     * Delete ingredient by ID
     * @param {string} id - Ingredient UUID
     * @returns {boolean} True if deleted
     */
    async delete(id) {
        const { error } = await supabase
            .from('ingredients')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('❌ Error deleting ingredient:', error);
            throw error;
        }

        console.log(`✅ Ingredient deleted: ${id}`);
        return true;
    },

    /**
     * Get ingredients with low stock
     * @returns {Array} Ingredients where stock <= threshold
     */
    async findLowStock() {
        const { data, error } = await supabase
            .from('v_low_stock_ingredients')
            .select('*');

        if (error) {
            // If view doesn't exist, use direct query
            console.log('⚠️ View not available, using direct query');
            const { data: directData, error: directError } = await supabase
                .from('ingredients')
                .select('*')
                .lte('stock_quantity', supabase.raw('min_stock_threshold'));

            if (directError) {
                // Fallback: get all and filter
                const { data: allData, error: allError } = await supabase
                    .from('ingredients')
                    .select('*');

                if (allError) throw allError;

                return allData.filter(i => i.stock_quantity <= i.min_stock_threshold);
            }
            return directData;
        }

        return data;
    },

    /**
     * Update stock quantity (direct update)
     * @param {string} id - Ingredient UUID
     * @param {number} newQuantity - New stock quantity
     * @returns {Object} Updated ingredient
     */
    async updateStock(id, newQuantity) {
        const { data, error } = await supabase
            .from('ingredients')
            .update({ stock_quantity: newQuantity })
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            console.error('❌ Error updating stock:', error);
            throw error;
        }

        console.log(`✅ Stock updated: ${data.name} = ${newQuantity} ${data.unit}`);
        return data;
    },

    /**
     * Adjust stock (add or subtract)
     * @param {string} id - Ingredient UUID
     * @param {number} adjustment - Amount to add (positive) or subtract (negative)
     * @returns {Object} Updated ingredient
     */
    async adjustStock(id, adjustment) {
        // First get current stock
        const current = await this.findById(id);
        if (!current) {
            throw new Error(`Ingredient ${id} not found`);
        }

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

        return {
            sufficient: shortages.length === 0,
            shortages
        };
    }
};

export default Ingredient;

/**
 * Recipe Model
 * Handles many-to-many relationship between products and ingredients
 */

import supabase from '../utils/supabaseClient.js';

const Recipe = {
    /**
     * Find recipe item by ID
     * @param {string} id - Recipe UUID
     * @returns {Object|null} Recipe object or null
     */
    async findById(id) {
        const { data, error } = await supabase
            .from('recipes')
            .select(`
        *,
        products (id, name, selling_price),
        ingredients (id, name, unit, unit_price)
      `)
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('❌ Error finding recipe:', error);
            throw error;
        }
        return data;
    },

    /**
     * Get all recipe items for a product
     * @param {string} productId - Product UUID
     * @returns {Array} Recipe items with ingredient details
     */
    async findByProductId(productId) {
        const { data, error } = await supabase
            .from('recipes')
            .select(`
        id,
        quantity_needed,
        created_at,
        ingredients (
          id,
          name,
          unit,
          unit_price,
          stock_quantity
        )
      `)
            .eq('product_id', productId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('❌ Error finding recipes for product:', error);
            throw error;
        }

        return data.map(r => ({
            id: r.id,
            ingredient_id: r.ingredients.id,
            ingredient_name: r.ingredients.name,
            unit: r.ingredients.unit,
            quantity_needed: r.quantity_needed,
            unit_price: r.ingredients.unit_price,
            stock_quantity: r.ingredients.stock_quantity,
            ingredient_cost: r.quantity_needed * r.ingredients.unit_price,
            created_at: r.created_at
        }));
    },

    /**
     * Get all products using a specific ingredient
     * @param {string} ingredientId - Ingredient UUID
     * @returns {Array} Products using this ingredient
     */
    async findByIngredientId(ingredientId) {
        const { data, error } = await supabase
            .from('recipes')
            .select(`
        id,
        quantity_needed,
        products (
          id,
          name,
          selling_price,
          is_available
        )
      `)
            .eq('ingredient_id', ingredientId);

        if (error) {
            console.error('❌ Error finding products for ingredient:', error);
            throw error;
        }

        return data;
    },

    /**
     * Create or update recipe item
     * Uses upsert to handle both create and update
     * @param {Object} recipeData - { product_id, ingredient_id, quantity_needed }
     * @returns {Object} Created/updated recipe
     */
    async upsert(recipeData) {
        const { data, error } = await supabase
            .from('recipes')
            .upsert({
                product_id: recipeData.product_id,
                ingredient_id: recipeData.ingredient_id,
                quantity_needed: recipeData.quantity_needed
            }, {
                onConflict: 'product_id,ingredient_id'
            })
            .select(`
        id,
        quantity_needed,
        ingredients (id, name, unit, unit_price)
      `)
            .single();

        if (error) {
            console.error('❌ Error upserting recipe:', error);
            throw error;
        }

        console.log(`✅ Recipe updated: ${recipeData.product_id} <- ${recipeData.ingredient_id}`);
        return data;
    },

    /**
     * Create recipe item
     * @param {Object} recipeData - { product_id, ingredient_id, quantity_needed }
     * @returns {Object} Created recipe
     */
    async create(recipeData) {
        const { data, error } = await supabase
            .from('recipes')
            .insert({
                product_id: recipeData.product_id,
                ingredient_id: recipeData.ingredient_id,
                quantity_needed: recipeData.quantity_needed
            })
            .select(`
        id,
        product_id,
        ingredient_id,
        quantity_needed,
        ingredients (id, name, unit, unit_price)
      `)
            .single();

        if (error) {
            console.error('❌ Error creating recipe:', error);
            throw error;
        }

        console.log(`✅ Recipe created for product ${recipeData.product_id}`);
        return data;
    },

    /**
     * Update recipe item
     * @param {string} id - Recipe UUID
     * @param {Object} updateData - { quantity_needed }
     * @returns {Object} Updated recipe
     */
    async update(id, updateData) {
        const { data, error } = await supabase
            .from('recipes')
            .update({ quantity_needed: updateData.quantity_needed })
            .eq('id', id)
            .select(`
        id,
        quantity_needed,
        ingredients (id, name, unit)
      `)
            .single();

        if (error) {
            console.error('❌ Error updating recipe:', error);
            throw error;
        }

        return data;
    },

    /**
     * Delete recipe item by ID
     * @param {string} id - Recipe UUID
     * @returns {boolean} True if deleted
     */
    async delete(id) {
        const { error } = await supabase
            .from('recipes')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('❌ Error deleting recipe:', error);
            throw error;
        }

        console.log(`✅ Recipe deleted: ${id}`);
        return true;
    },

    /**
     * Delete all recipes for a product
     * @param {string} productId - Product UUID
     * @returns {boolean} True if deleted
     */
    async deleteByProductId(productId) {
        const { error } = await supabase
            .from('recipes')
            .delete()
            .eq('product_id', productId);

        if (error) {
            console.error('❌ Error deleting recipes for product:', error);
            throw error;
        }

        console.log(`✅ All recipes deleted for product: ${productId}`);
        return true;
    },

    /**
     * Bulk create/update recipes for a product
     * Replaces all existing recipes with new ones
     * @param {string} productId - Product UUID
     * @param {Array} ingredients - Array of { ingredient_id, quantity_needed }
     * @returns {Array} Created recipes
     */
    async bulkUpdate(productId, ingredients) {
        // Delete existing recipes
        await this.deleteByProductId(productId);

        // Create new recipes
        const recipesToInsert = ingredients.map(ing => ({
            product_id: productId,
            ingredient_id: ing.ingredient_id,
            quantity_needed: ing.quantity_needed
        }));

        const { data, error } = await supabase
            .from('recipes')
            .insert(recipesToInsert)
            .select(`
        id,
        quantity_needed,
        ingredients (id, name, unit, unit_price)
      `);

        if (error) {
            console.error('❌ Error bulk updating recipes:', error);
            throw error;
        }

        console.log(`✅ Bulk updated ${data.length} recipes for product ${productId}`);
        return data;
    },

    /**
     * Calculate total cost for a product based on recipe
     * @param {string} productId - Product UUID
     * @returns {number} Total cost
     */
    async calculateCost(productId) {
        const recipes = await this.findByProductId(productId);

        const totalCost = recipes.reduce((sum, r) => {
            return sum + (r.quantity_needed * r.unit_price);
        }, 0);

        return Math.round(totalCost * 100) / 100; // Round to 2 decimal places
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
